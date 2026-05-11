using System.Text.Json;
using SHSF;

var payload = Runtime.LoadPayloadJson<JsonElement>();
var body = payload.TryGetProperty("body", out var bodyValue) ? bodyValue : default;

var eventName = GetString(body, "event") ?? "unknown";
var user = body.ValueKind == JsonValueKind.Object && body.TryGetProperty("user", out var userValue)
    ? userValue
    : default;
var userName = GetString(user, "name") ?? "Guest";
var userEmail = GetString(user, "email") ?? "N/A";

Console.Error.WriteLine($"Event: {eventName}");
Console.Error.WriteLine($"User: {userName} ({userEmail})");

Runtime.Return(new
{
    _shsf = "v2",
    _code = 200,
    _res = new
    {
        message = $"Processed {eventName} event for {userName}",
        received_data = body.ValueKind == JsonValueKind.Undefined ? null : body
    }
});

static string? GetString(JsonElement element, string propertyName)
{
    return element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(propertyName, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
