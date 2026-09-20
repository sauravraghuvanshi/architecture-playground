package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"

	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclsyntax"
	"github.com/zclconf/go-cty/cty"
)

const maxCodeBytes = 480000
const maxNodes = 10000

type request struct {
	Code string `json:"code"`
}

type diagnostic struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
}

type expression struct {
	Kind    string       `json:"kind"`
	Text    string       `json:"text,omitempty"`
	Boolean *bool        `json:"boolean,omitempty"`
	Items   []expression `json:"items,omitempty"`
	Entries []entry      `json:"entries,omitempty"`
}

type entry struct {
	Key   expression `json:"key"`
	Value expression `json:"value"`
}

type attribute struct {
	Name  string     `json:"name"`
	Value expression `json:"value"`
}

type body struct {
	Attributes []attribute `json:"attributes"`
	Blocks     []block     `json:"blocks"`
}

type block struct {
	Type   string   `json:"type"`
	Labels []string `json:"labels"`
	Body   body     `json:"body"`
}

type response struct {
	Parser      string       `json:"parser"`
	Version     string       `json:"version"`
	Valid       bool         `json:"valid"`
	Complete    bool         `json:"complete"`
	Diagnostics []diagnostic `json:"diagnostics"`
	Body        *body        `json:"body,omitempty"`
}

type converter struct {
	nodes    int
	complete bool
}

func (c *converter) step(depth int) bool {
	c.nodes++
	if c.nodes > maxNodes || depth > 64 {
		c.complete = false
		return false
	}
	return true
}

func literal(value cty.Value) expression {
	if !value.IsKnown() {
		return expression{Kind: "unsupported", Text: "unknown_literal"}
	}
	if value.IsNull() {
		return expression{Kind: "null"}
	}
	switch value.Type() {
	case cty.String:
		return expression{Kind: "string", Text: value.AsString()}
	case cty.Bool:
		boolean := value.True()
		return expression{Kind: "boolean", Boolean: &boolean}
	case cty.Number:
		return expression{Kind: "number", Text: value.AsBigFloat().Text('g', -1)}
	default:
		return expression{Kind: "unsupported", Text: "non_scalar_literal"}
	}
}

func (c *converter) traversal(base expression, traversal hcl.Traversal, depth int) expression {
	for index, part := range traversal {
		if !c.step(depth + index) {
			return expression{Kind: "unsupported", Text: "traversal_limit"}
		}
		switch step := part.(type) {
		case hcl.TraverseRoot:
			base = expression{Kind: "reference", Text: step.Name}
		case hcl.TraverseAttr:
			base = expression{Kind: "access", Text: step.Name, Items: []expression{base}}
		case hcl.TraverseIndex:
			base = expression{Kind: "index", Items: []expression{base, literal(step.Key)}}
		default:
			c.complete = false
			return expression{Kind: "unsupported", Text: "traversal"}
		}
	}
	return base
}

func (c *converter) expr(input hclsyntax.Expression, depth int) expression {
	if !c.step(depth) {
		return expression{Kind: "unsupported", Text: "analysis_limit"}
	}
	switch value := input.(type) {
	case *hclsyntax.LiteralValueExpr:
		return literal(value.Val)
	case *hclsyntax.ParenthesesExpr:
		return c.expr(value.Expression, depth+1)
	case *hclsyntax.ScopeTraversalExpr:
		return c.traversal(expression{}, value.Traversal, depth)
	case *hclsyntax.RelativeTraversalExpr:
		return c.traversal(c.expr(value.Source, depth+1), value.Traversal, depth)
	case *hclsyntax.IndexExpr:
		return expression{Kind: "index", Items: []expression{c.expr(value.Collection, depth+1), c.expr(value.Key, depth+1)}}
	case *hclsyntax.TemplateWrapExpr:
		return c.expr(value.Wrapped, depth+1)
	case *hclsyntax.TemplateExpr:
		items := make([]expression, 0, len(value.Parts))
		for _, part := range value.Parts {
			if c.nodes >= maxNodes {
				c.complete = false
				break
			}
			items = append(items, c.expr(part, depth+1))
		}
		if len(items) == 1 && items[0].Kind == "string" {
			return items[0]
		}
		return expression{Kind: "template", Items: items}
	case *hclsyntax.FunctionCallExpr:
		items := make([]expression, 0, len(value.Args))
		for _, arg := range value.Args {
			if c.nodes >= maxNodes {
				c.complete = false
				break
			}
			items = append(items, c.expr(arg, depth+1))
		}
		if value.ExpandFinal {
			c.complete = false
			return expression{Kind: "unsupported", Text: "expanded_arguments"}
		}
		return expression{Kind: "call", Text: value.Name, Items: items}
	case *hclsyntax.TupleConsExpr:
		items := make([]expression, 0, len(value.Exprs))
		for _, item := range value.Exprs {
			if c.nodes >= maxNodes {
				c.complete = false
				break
			}
			items = append(items, c.expr(item, depth+1))
		}
		return expression{Kind: "array", Items: items}
	case *hclsyntax.ObjectConsExpr:
		entries := make([]entry, 0, len(value.Items))
		for _, item := range value.Items {
			if c.nodes >= maxNodes {
				c.complete = false
				break
			}
			entries = append(entries, entry{Key: c.expr(item.KeyExpr, depth+1), Value: c.expr(item.ValueExpr, depth+1)})
		}
		return expression{Kind: "object", Entries: entries}
	case *hclsyntax.ObjectConsKeyExpr:
		if !value.ForceNonLiteral {
			if traversal, ok := value.Wrapped.(*hclsyntax.ScopeTraversalExpr); ok && len(traversal.Traversal) == 1 {
				if root, ok := traversal.Traversal[0].(hcl.TraverseRoot); ok {
					return expression{Kind: "string", Text: root.Name}
				}
			}
		}
		return c.expr(value.Wrapped, depth+1)
	default:
		c.complete = false
		return expression{Kind: "unsupported", Text: "computed_expression"}
	}
}

func (c *converter) body(input *hclsyntax.Body, depth int) body {
	result := body{Attributes: []attribute{}, Blocks: []block{}}
	if !c.step(depth) {
		return result
	}
	names := make([]string, 0, len(input.Attributes))
	for name := range input.Attributes {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		if c.nodes >= maxNodes {
			c.complete = false
			break
		}
		result.Attributes = append(result.Attributes, attribute{Name: name, Value: c.expr(input.Attributes[name].Expr, depth+1)})
	}
	for _, item := range input.Blocks {
		if c.nodes >= maxNodes || depth >= 64 {
			c.complete = false
			break
		}
		result.Blocks = append(result.Blocks, block{Type: item.Type, Labels: append([]string{}, item.Labels...), Body: c.body(item.Body, depth+1)})
	}
	return result
}

func parse(code []byte) response {
	result := response{Parser: "hashicorp-hcl", Version: "2.25.0", Diagnostics: []diagnostic{}}
	if len(code) > maxCodeBytes {
		result.Diagnostics = append(result.Diagnostics, diagnostic{Code: "input_limit", Message: "Artifact exceeds the parser input limit."})
		return result
	}
	tokens, lexDiagnostics := hclsyntax.LexConfig(code, "artifact.tf", hcl.InitialPos)
	if len(tokens) > 30000 {
		result.Diagnostics = append(result.Diagnostics, diagnostic{Code: "token_limit", Message: "Artifact exceeds the parser token limit."})
		return result
	}
	depth := 0
	for _, token := range tokens {
		switch token.Type {
		case hclsyntax.TokenOBrace, hclsyntax.TokenOBrack, hclsyntax.TokenOParen:
			depth++
		case hclsyntax.TokenCBrace, hclsyntax.TokenCBrack, hclsyntax.TokenCParen:
			depth--
		}
		if depth > 96 {
			result.Diagnostics = append(result.Diagnostics, diagnostic{Code: "nesting_limit", Message: "Artifact exceeds the parser nesting limit.", Line: token.Range.Start.Line, Column: token.Range.Start.Column})
			return result
		}
	}
	if lexDiagnostics.HasErrors() {
		appendDiagnostics(&result, lexDiagnostics)
		return result
	}
	// Parsing only: never call Expression.Value or provide an evaluation context.
	file, diagnostics := hclsyntax.ParseConfig(code, "artifact.tf", hcl.InitialPos)
	appendDiagnostics(&result, diagnostics)
	result.Valid = !diagnostics.HasErrors()
	if result.Valid {
		ast, ok := file.Body.(*hclsyntax.Body)
		if !ok {
			result.Complete = false
			return result
		}
		converter := converter{complete: true}
		converted := converter.body(ast, 0)
		result.Body = &converted
		result.Complete = converter.complete
	}
	return result
}

func appendDiagnostics(result *response, diagnostics hcl.Diagnostics) {
	for _, item := range diagnostics {
		if item.Severity != hcl.DiagError {
			continue
		}
		if len(result.Diagnostics) == 24 {
			break
		}
		message := diagnostic{Code: "syntax_error", Message: item.Summary}
		if item.Subject != nil {
			message.Line, message.Column = item.Subject.Start.Line, item.Subject.Start.Column
		}
		result.Diagnostics = append(result.Diagnostics, message)
	}
}

func main() {
	data, err := io.ReadAll(io.LimitReader(os.Stdin, 1000001))
	if err != nil || len(data) > 1000000 {
		fmt.Fprintln(os.Stderr, "Invalid parser request size.")
		os.Exit(2)
	}
	var input request
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		fmt.Fprintln(os.Stderr, "Invalid parser request.")
		os.Exit(2)
	}
	var trailing any
	if decoder.Decode(&trailing) != io.EOF {
		fmt.Fprintln(os.Stderr, "Parser accepts one request.")
		os.Exit(2)
	}
	if err := json.NewEncoder(os.Stdout).Encode(parse([]byte(input.Code))); err != nil {
		fmt.Fprintln(os.Stderr, "Could not encode parser result.")
		os.Exit(2)
	}
}
