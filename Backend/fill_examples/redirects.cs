using System.Text.Json;
using SHSF;

var payload = Runtime.LoadPayloadJson<JsonElement>();
var body = payload.TryGetProperty("body", out var bodyValue) ? bodyValue : default;

var target = GetString(body, "target") ?? "https://example.com";
var redirectType = GetString(body, "type") ?? "temporary";
var statusCode = redirectType == "permanent" ? 301 : 302;

Runtime.Return(new
{
    _shsf = "v2",
    _code = statusCode,
    _location = target
});

static string? GetString(JsonElement element, string propertyName)
{
    return element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(propertyName, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
