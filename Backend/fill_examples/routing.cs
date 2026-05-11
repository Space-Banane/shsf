using System.Text.Json;
using SHSF;

var payload = Runtime.LoadPayloadJson<JsonElement>();
var route = GetString(payload, "route") ?? "default";

Runtime.Return(route switch
{
    "register" => HandleRegister(payload),
    "login" => HandleLogin(payload),
    "profile" => HandleProfile(),
    "default" => HandleDefault(),
    _ => new
    {
        _shsf = "v2",
        _code = 404,
        _res = new
        {
            state = false,
            error = $"Route '{route}' not found",
            available_routes = new[] { "register", "login", "profile", "default" }
        }
    }
});

static object HandleRegister(JsonElement payload)
{
    var body = GetBody(payload);
    var username = GetString(body, "username");
    var email = GetString(body, "email");

    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email))
    {
        return new
        {
            _shsf = "v2",
            _code = 400,
            _res = new
            {
                state = false,
                error = "Username and email are required"
            }
        };
    }

    return new
    {
        _shsf = "v2",
        _code = 200,
        _res = new
        {
            state = true,
            message = $"User {username} registered successfully",
            route = "register"
        }
    };
}

static object HandleLogin(JsonElement payload)
{
    var username = GetString(GetBody(payload), "username") ?? "example_user";

    return new
    {
        _shsf = "v2",
        _code = 200,
        _res = new
        {
            state = true,
            message = $"User {username} logged in",
            route = "login",
            token = "example-auth-token"
        }
    };
}

static object HandleProfile()
{
    return new
    {
        _shsf = "v2",
        _code = 200,
        _res = new
        {
            state = true,
            route = "profile",
            user = new
            {
                username = "example_user",
                email = "user@example.com"
            }
        }
    };
}

static object HandleDefault()
{
    return new
    {
        _shsf = "v2",
        _code = 200,
        _res = new
        {
            state = true,
            message = "Welcome to the API",
            routes = new Dictionary<string, string>
            {
                ["/register"] = "POST - Register a new user",
                ["/login"] = "POST - Login a user",
                ["/profile"] = "GET - Get user profile",
                ["/"] = "GET - This message"
            }
        }
    };
}

static JsonElement GetBody(JsonElement payload)
{
    return payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("body", out var body)
        ? body
        : default;
}

static string? GetString(JsonElement element, string propertyName)
{
    return element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(propertyName, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
