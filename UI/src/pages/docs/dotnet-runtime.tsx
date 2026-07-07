import { DocsContentShell } from "./DocsContentShell";

export const DocsDotnetRuntime = () => {
	return (
		<DocsContentShell>
			<h1 className="text-3xl font-bold text-primary mb-2">.NET Runtime</h1>
			<p className="mt-3 text-lg text-text/90 mb-8">
				Learn how to build SHSF functions in C# with the generated{" "}
				<code>SHSF</code> helpers for payload loading, responses, and database
				communication.
			</p>

			<h2 className="text-2xl font-bold text-primary mt-8 mb-6">Overview</h2>
			<p className="mb-6 text-text/90">
				SHSF supports the .NET SDK runtime for multi-file C# projects. You can save
				your <code>.cs</code>, <code>.csproj</code>, and <code>.sln</code> files
				directly in the editor, then run them inside a .NET SDK container.
			</p>

			<div className="mb-6 p-4 bg-cyan-900/20 border-l-4 border-cyan-400 rounded">
				<b>Important:</b> SHSF resolves the runnable project from your{" "}
				<code>.csproj</code> files automatically. The startup-file field is disabled
				for .NET functions on purpose.
			</div>

			<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
				Supported .NET Versions
			</h2>
			<ul className="list-disc list-inside mb-6 text-text/90 space-y-2">
				<li>.NET 8</li>
				<li>.NET 9</li>
				<li>.NET 10</li>
			</ul>

			<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
				How SHSF Runs .NET Functions
			</h2>
			<ul className="list-disc list-inside mb-6 text-text/90 space-y-2">
				<li>
					Development UI runs use <code>dotnet run</code>.
				</li>
				<li>
					HTTP routes, cron jobs, and production-style trigger execution use{" "}
					<code>dotnet run --no-build</code>.
				</li>
				<li>
					Use the <code>.NET Build</code> button in Function Detail after changing
					project files and before relying on production routes.
				</li>
				<li>
					SHSF captures stdout and stderr as logs. Return the response with{" "}
					<code>SHSF.Runtime.Return(...)</code>.
				</li>
			</ul>

			<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
				Generated SHSF Helpers
			</h2>
			<p className="mb-4 text-text/90">
				Every .NET function gets generated helper classes under the{" "}
				<code>SHSF</code> namespace:
			</p>
			<ul className="list-disc list-inside mb-6 text-text/90 space-y-2">
				<li>
					<code>SHSF.Runtime</code> for payload loading and response output
				</li>
				<li>
					<code>SHSF.Database</code> for persistent storage communication
				</li>
			</ul>

			<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
				Example Project Files
			</h2>

			<h3 className="text-xl font-semibold text-primary mb-4">1. Example .csproj</h3>
			<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
				<code>{`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>`}</code>
			</pre>

			<h3 className="text-xl font-semibold text-primary mb-4">
				2. Basic Program.cs
			</h3>
			<p className="mb-4 text-text/90">
				Use <code>SHSF.Runtime.LoadPayload()</code> to read the raw payload file and{" "}
				<code>SHSF.Runtime.Return(...)</code> to send the response back to SHSF.
			</p>
			<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
				<code>{`using SHSF;

var payload = Runtime.LoadPayload();
Console.Error.WriteLine("Raw payload length: " + payload.Length);

Runtime.Return(new
{
    message = "Hello from .NET",
    payload
});`}</code>
			</pre>

			<h3 className="text-xl font-semibold text-primary mb-4">
				3. Deserialize JSON Payloads
			</h3>
			<p className="mb-4 text-text/90">
				Use <code>LoadPayloadJson&lt;T&gt;()</code> when you expect JSON input.
			</p>
			<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
				<code>{`using SHSF;

public sealed class RunPayload
{
    public string? Name { get; set; }
    public string? Route { get; set; }
}

var payload = Runtime.LoadPayloadJson<RunPayload>() ?? new RunPayload();

Runtime.Return(new
{
    greeting = $"Hello, {payload.Name ?? "world"}!",
    route = payload.Route ?? "default"
});`}</code>
			</pre>

			<h3 className="text-xl font-semibold text-primary mb-4">
				4. Custom HTTP Responses
			</h3>
			<p className="mb-4 text-text/90">
				You can still return SHSF custom response envelopes from C#.
			</p>
			<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
				<code>{`using SHSF;

Runtime.Return(new
{
    _shsf = "v2",
    _code = 201,
    _headers = new Dictionary<string, string>
    {
        ["Content-Type"] = "application/json",
        ["X-Powered-By"] = "SHSF .NET"
    },
    _res = new
    {
        status = "created",
        runtime = ".NET"
    }
});`}</code>
			</pre>

			<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
				Using The Database Helper
			</h2>
			<p className="mb-4 text-text/90">
				SHSF generates a <code>SHSF.Database</code> class for .NET functions so you
				can read and write persistent data without building your own HTTP client or
				shipping API tokens in your function code.
			</p>

			<h3 className="text-xl font-semibold text-primary mb-4">
				Create and Write Data
			</h3>
			<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
				<code>{`using SHSF;

var db = new Database();

await db.CreateStorage("users", "Stores user profile data");
await db.Set("users", "alice", new
{
    name = "Alice",
    tier = "pro"
});

Runtime.Return(new { status = "saved" });`}</code>
			</pre>

			<h3 className="text-xl font-semibold text-primary mb-4">Read Data</h3>
			<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
				<code>{`using SHSF;

var db = new Database();
var user = await db.Get("users", "alice");

Runtime.Return(new
{
    user
});`}</code>
			</pre>

			<h3 className="text-xl font-semibold text-primary mb-4">
				Check If A Key Exists
			</h3>
			<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
				<code>{`using SHSF;

var db = new Database();
var exists = await db.Exists("users", "alice");

Runtime.Return(new
{
    exists
});`}</code>
			</pre>

			<h3 className="text-xl font-semibold text-primary mb-4">
				List and Delete Items
			</h3>
			<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
				<code>{`using SHSF;

var db = new Database();
var items = await db.ListItems("users");
await db.DeleteItem("users", "alice");

Runtime.Return(new
{
    items
});`}</code>
			</pre>

			<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
				Logging and Responses
			</h2>
			<p className="mb-4 text-text/90">
				Write normal logs with <code>Console.WriteLine</code> or{" "}
				<code>Console.Error.WriteLine</code>. Return the actual function response
				only with <code>SHSF.Runtime.Return(...)</code>.
			</p>
			<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
				<code>{`using SHSF;

Console.WriteLine("Starting request processing...");
Console.Error.WriteLine("This is also captured as a log line.");

Runtime.Return(new
{
    ok = true
});`}</code>
			</pre>

			<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
				<h2 className="text-xl font-bold text-primary mb-3">
					🚀 Next Step - Kickoff
				</h2>
				<p className="text-text/90 mb-4">
					Now that you know the .NET runtime contract, you can generate starter
					files faster with SHSF Kickoff.
				</p>
				<a
					href="/docs/kickoff"
					className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
				>
					#22 Kickoff
					<span className="text-lg">→</span>
				</a>
			</div>
		</DocsContentShell>
	);
};
