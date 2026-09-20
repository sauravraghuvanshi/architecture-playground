package main

import (
	"strings"
	"testing"
)

func TestSyntaxGate(t *testing.T) {
	for _, sample := range []struct {
		name, code string
		valid      bool
	}{
		{"resource", "resource \"azurerm_linux_web_app\" \"app\" {\nname = \"api-${var.suffix}\"\nhttps_only = true\n}", true},
		{"empty", "", true},
		{"multiple assignments on one line", "variable \"name\" { type = string default = \"x\" }", false},
		{"duplicate argument", "x = 1\nx = 2\n", false},
		{"unclosed block", "resource \"x\" \"y\" {\n", false},
		{"invalid template", "x = \"${\"\n", false},
	} {
		t.Run(sample.name, func(t *testing.T) {
			result := parse([]byte(sample.code))
			if result.Valid != sample.valid {
				t.Fatalf("valid=%v, diagnostics=%+v", result.Valid, result.Diagnostics)
			}
			if !sample.valid && len(result.Diagnostics) == 0 {
				t.Fatal("invalid syntax needs explicit diagnostics")
			}
		})
	}
}

func TestFileFunctionRemainsUnexecutedSyntax(t *testing.T) {
	result := parse([]byte("locals {\nsource = file(\"/file-that-must-never-be-opened\")\n}\n"))
	if !result.Valid || result.Body == nil {
		t.Fatalf("syntax rejected: %+v", result.Diagnostics)
	}
	value := result.Body.Blocks[0].Body.Attributes[0].Value
	if value.Kind != "call" || value.Text != "file" || value.Items[0].Text != "/file-that-must-never-be-opened" {
		t.Fatalf("function was not retained as syntax: %+v", value)
	}
}

func TestStaticProjection(t *testing.T) {
	result := parse([]byte("resource \"azurerm_storage_account\" \"host\" {\nname = \"host-${var.environment}\"\ntags = { owner = \"team\", private = true }\nidentity { type = \"SystemAssigned\" }\n}\n"))
	if !result.Valid || !result.Complete || result.Body == nil {
		t.Fatalf("projection failed: %+v", result)
	}
	resource := result.Body.Blocks[0]
	if resource.Type != "resource" || resource.Labels[0] != "azurerm_storage_account" || resource.Labels[1] != "host" {
		t.Fatal("resource labels were lost")
	}
	if resource.Body.Attributes[0].Value.Kind != "template" || resource.Body.Attributes[1].Value.Kind != "object" {
		t.Fatal("structured expressions were lost")
	}
	if resource.Body.Blocks[0].Type != "identity" || len(resource.Body.Blocks[0].Labels) != 0 {
		t.Fatal("nested block was lost")
	}
}

func TestUnsupportedExpressionsAreExplicit(t *testing.T) {
	result := parse([]byte("value = condition ? \"one\" : \"two\"\n"))
	if !result.Valid || result.Complete || result.Body.Attributes[0].Value.Kind != "unsupported" {
		t.Fatal("computed expressions must not become a successful complete projection")
	}
	deep := parse([]byte("value = var" + strings.Repeat(".attribute", 100)))
	if !deep.Valid || deep.Complete {
		t.Fatal("deep traversal must be bounded rather than producing an unbounded projection")
	}
}

func TestInputAndNestingLimits(t *testing.T) {
	for _, code := range []string{
		strings.Repeat(" ", maxCodeBytes+1),
		"x = " + strings.Repeat("[", 100) + "1" + strings.Repeat("]", 100),
	} {
		result := parse([]byte(code))
		if result.Valid || len(result.Diagnostics) == 0 {
			t.Fatal("parser limit was not reported")
		}
	}
}
