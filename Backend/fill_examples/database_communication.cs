using SHSF;
using System.Text.Json.Nodes;

var db = new Database();
var storageName = "example_storage";

await db.CreateStorage(storageName, "Example storage for testing");
await db.Set(storageName, "test_key", new
{
    message = "Hello from .NET persistent storage",
    saved_at = DateTimeOffset.UtcNow
});

var value = await db.Get(storageName, "test_key");
var items = await db.ListItems(storageName);
var exists = await db.Exists(storageName, "test_key");

Runtime.Return(new
{
    _shsf = "v2",
    _code = 200,
    _res = new
    {
        state = true,
        value,
        item_count = items is JsonArray itemArray ? itemArray.Count : 0,
        exists
    }
});
