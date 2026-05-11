using System.Text.Json;
using SHSF;

var payload = Runtime.LoadPayloadJson<JsonElement>();
var body = payload.TryGetProperty("body", out var bodyValue) ? bodyValue : default;
var requiredField = body.ValueKind == JsonValueKind.Object
    && body.TryGetProperty("required_field", out var fieldValue)
    && fieldValue.ValueKind != JsonValueKind.Null
        ? fieldValue
        : default;

if (requiredField.ValueKind == JsonValueKind.Undefined)
{
    Runtime.Return(new
    {
        _shsf = "v2",
        _code = 400,
        _res = new
        {
            state = false,
            error = "Missing required_field in request"
        },
        _headers = new Dictionary<string, string>
        {
            ["X-Custom-Header"] = "validation-failed"
        }
    });
    return;
}

Runtime.Return(new
{
    _shsf = "v2",
    _code = 200,
    _res = new
    {
        state = true,
        message = "Request processed successfully",
        data = requiredField
    },
    _headers = new Dictionary<string, string>
    {
        ["X-Custom-Header"] = "validation-success"
    }
});
