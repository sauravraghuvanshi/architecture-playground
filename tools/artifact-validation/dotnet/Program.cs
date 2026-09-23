using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Bicep.Core.Diagnostics;
using Bicep.Core.Parsing;
using Bicep.Core.Syntax;

var json = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
    RespectNullableAnnotations = true,
    MaxDepth = 128,
};
try
{
    if (args.Length == 1 && args[0] == "--ready")
    {
        const string warmup = "param warmup string = 'ready'";
        var warmParser = new Parser(warmup);
        var warmProgram = warmParser.Program();
        var warmProjector = new Projector(warmup);
        _ = JsonSerializer.Serialize(new ParseResult(
            "azure-bicep-parser", "0.47.16", true, true, [],
            warmProjector.Program(warmProgram)), json);
        Console.WriteLine("DIAGRAMMATIC_PARSER_READY_V1");
        Console.Out.Flush();
    }
    else if (args.Length != 0) throw new InvalidDataException();

    using var input = Console.OpenStandardInput();
    using var buffer = new MemoryStream();
    var chunk = new byte[8192];
    int read;
    while ((read = input.Read(chunk)) > 0)
    {
        if (buffer.Length + read > 1_000_000) throw new InvalidDataException();
        buffer.Write(chunk, 0, read);
    }
    var request = JsonSerializer.Deserialize<ParseRequest>(buffer.ToArray(), json)
        ?? throw new InvalidDataException();
    if (request.Language != "bicep" || request.Code.Length > 120_000) throw new InvalidDataException();

    // Lexer/parser only: do not construct a compiler, semantic model or file resolver.
    var parser = new Parser(request.Code);
    var program = parser.Program();
    var diagnostics = parser.LexingErrorLookup.Concat(parser.ParsingErrorLookup)
        .Where(item => item.Level == DiagnosticLevel.Error)
        .OrderBy(item => item.Span.Position)
        .Take(24)
        .Select(item =>
        {
            var offset = Math.Clamp(item.Span.Position, 0, request.Code.Length);
            var prefix = request.Code.AsSpan(0, offset);
            var line = prefix.Count('\n') + 1;
            var lastLine = prefix.LastIndexOf('\n');
            return new ParseDiagnostic(item.Code, item.Message.Length > 3000 ? item.Message[..3000] : item.Message, line, offset - lastLine);
        }).ToArray();
    var projector = new Projector(request.Code);
    var body = diagnostics.Length == 0 ? projector.Program(program) : null;
    Console.Write(JsonSerializer.Serialize(new ParseResult(
        "azure-bicep-parser", "0.47.16", diagnostics.Length == 0,
        diagnostics.Length == 0 && projector.Complete, diagnostics, body), json));
}
catch
{
    Console.Error.Write("Trusted Bicep parser could not process the bounded request.");
    Environment.ExitCode = 2;
}

sealed record ParseRequest([property: JsonRequired] string Language, [property: JsonRequired] string Code);
sealed record ParseDiagnostic(string Code, string Message, int Line, int Column);
sealed record ParseResult(string Parser, string Version, bool Valid, bool Complete, ParseDiagnostic[] Diagnostics, ArtifactBody? Body);
sealed record Expr(string Kind, string? Text = null, bool? Boolean = null, Expr[]? Items = null, Entry[]? Entries = null);
sealed record Entry(Expr Key, Expr Value);
sealed record AttributeValue(string Name, Expr Value);
sealed record ArtifactBody(AttributeValue[] Attributes, ArtifactBlock[] Blocks);
sealed record ArtifactBlock(string Type, string[] Labels, ArtifactBody Body, string[]? Flags = null);

sealed class Projector(string source)
{
    private int nodes;
    public bool Complete { get; private set; } = true;
    private Expr Unsupported(string reason)
    {
        Complete = false;
        return new("unsupported", reason);
    }
    private bool Step(int depth)
    {
        if (++nodes <= 10000 && depth <= 64) return true;
        Complete = false;
        return false;
    }
    private string Text(SyntaxBase node) => source.Substring(node.Span.Position, node.Span.Length);
    private static ArtifactBody ValueBody(params AttributeValue[] attributes) => new(attributes, []);

    public ArtifactBody Program(ProgramSyntax program)
    {
        var attributes = new List<AttributeValue>();
        var blocks = new List<ArtifactBlock>();
        foreach (var declaration in program.Declarations)
        {
            if (!Step(0)) break;
            switch (declaration)
            {
                case ResourceDeclarationSyntax resource:
                    var resourceType = resource.TypeString?.TryGetLiteralValue();
                    if (resourceType is null) Complete = false;
                    var flags = new List<string>();
                    if (resource.IsExistingResource()) flags.Add("existing");
                    var resourceBody = resource.Value is ObjectSyntax resourceObject
                        ? Body(resourceObject, 1) : ValueBody(new AttributeValue("value", Unsupported("computed_resource_body")));
                    blocks.Add(new("resource", [resource.Name.IdentifierName, resourceType ?? ""], resourceBody, flags.ToArray()));
                    break;
                case ParameterDeclarationSyntax parameter:
                    var values = new List<AttributeValue> { new("type", new("string", Text(parameter.Type).Trim())) };
                    if (parameter.Modifier is ParameterDefaultValueSyntax defaultValue)
                        values.Add(new("default", Expression(defaultValue.DefaultValue, 1)));
                    blocks.Add(new("param", [parameter.Name.IdentifierName], ValueBody(values.ToArray())));
                    break;
                case VariableDeclarationSyntax variable:
                    blocks.Add(new("var", [variable.Name.IdentifierName], ValueBody(new AttributeValue("value", Expression(variable.Value, 1)))));
                    break;
                case OutputDeclarationSyntax output:
                    blocks.Add(new("output", [output.Name.IdentifierName], ValueBody(new AttributeValue("value", Expression(output.Value, 1)))));
                    break;
                case TargetScopeSyntax target:
                    attributes.Add(new("targetScope", Expression(target.Value, 1)));
                    break;
                default:
                    Complete = false;
                    blocks.Add(new("unsupported", [declaration.GetType().Name], ValueBody()));
                    break;
            }
        }
        return new(attributes.ToArray(), blocks.ToArray());
    }

    private ArtifactBody Body(ObjectSyntax input, int depth)
    {
        if (!Step(depth)) return ValueBody(new AttributeValue("value", Unsupported("analysis_limit")));
        if (input.Resources.Any()) Complete = false;
        var attributes = new List<AttributeValue>();
        foreach (var property in input.Properties)
        {
            if (nodes >= 10000) { Complete = false; break; }
            var key = property.TryGetKeyText();
            if (key is null)
                attributes.Add(new("unsupported", Unsupported("computed_property_key")));
            else attributes.Add(new(key, Expression(property.Value, depth + 1)));
        }
        return new(attributes.ToArray(), []);
    }

    private Expr Expression(SyntaxBase syntax, int depth)
    {
        if (!Step(depth)) return Unsupported("analysis_limit");
        switch (syntax)
        {
            case StringSyntax value:
                var literal = value.TryGetLiteralValue();
                if (literal is not null) return new("string", literal);
                var parts = new List<Expr>();
                for (var index = 0; index < value.SegmentValues.Length; index++)
                {
                    if (!Step(depth + 1)) return Unsupported("analysis_limit");
                    if (value.SegmentValues[index].Length > 0) parts.Add(new("string", value.SegmentValues[index]));
                    if (index < value.Expressions.Length) parts.Add(Expression(value.Expressions[index], depth + 1));
                }
                return new("template", Items: parts.ToArray());
            case IntegerLiteralSyntax value:
                return new("number", Convert.ToString(value.Value, CultureInfo.InvariantCulture));
            case BooleanLiteralSyntax value:
                return new("boolean", Boolean: value.Value);
            case NullLiteralSyntax:
                return new("null");
            case VariableAccessSyntax value:
                return new("reference", value.Name.IdentifierName);
            case PropertyAccessSyntax value:
                return new("access", value.PropertyName.IdentifierName, Items: [Expression(value.BaseExpression, depth + 1)]);
            case FunctionCallSyntax value:
                return new("call", value.Name.IdentifierName, Items: value.Arguments.Select(argument => Expression(argument.Expression, depth + 1)).ToArray());
            case ArrayAccessSyntax value:
                return new("index", Items: [Expression(value.BaseExpression, depth + 1), Expression(value.IndexExpression, depth + 1)]);
            case ParenthesizedExpressionSyntax value:
                return Expression(value.Expression, depth + 1);
            case ArraySyntax value:
                return new("array", Items: value.Items.Take(10000).Select(item => Expression(item.Value, depth + 1)).ToArray());
            case ObjectSyntax value:
                if (value.Resources.Any()) Complete = false;
                return new("object", Entries: value.Properties.Take(10000).Select(property => new Entry(
                    property.TryGetKeyText() is string key ? new("string", key) : Expression(property.Key, depth + 1),
                    Expression(property.Value, depth + 1))).ToArray());
            default:
                return Unsupported(syntax.GetType().Name);
        }
    }
}
