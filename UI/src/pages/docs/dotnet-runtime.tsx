import { DocsContentShell } from "./DocsContentShell";
import { Callout, CodeCaption, DocHeader, NextStep } from "./_components";

export const DocsDotnetRuntime = () => {
	return (
		<DocsContentShell>
			<DocHeader title=".NET Runtime">
				SHSF supports multi-file C# projects. Save <code>.cs</code>,{" "}
				<code>.csproj</code>, and <code>.sln</code> files in the editor and
				run them inside a .NET SDK container. Generated helper classes under
				the <code>SHSF</code> namespace handle payload loading, responses,
				and database communication.
			</DocHeader>

			<Callout variant="info" title="Startup file is disabled for .NET">
				<p>
					SHSF resolves the runnable project from your <code>.csproj</code>{" "}
					files automatically. The startup-file field has no effect for .NET
					functions.
				</p>
			</Callout>

			<h2>Supported .NET versions</h2>
			<ul>
				<li>
					<code>mcr.microsoft.com/dotnet/sdk:8.0</code> — .NET 8
				</li>
				<li>
					<code>mcr.microsoft.com/dotnet/sdk:9.0</code> — .NET 9
				</li>
				<li>
					<code>mcr.microsoft.com/dotnet/sdk:10.0</code> — .NET 10
				</li>
			</ul>

			<h2>How SHSF runs .NET functions</h2>
			<ul>
				<li>
					<strong>UI Run button</strong> — uses <code>dotnet run</code>{" "}
					(builds and runs).
				</li>
				<li>
					<strong>HTTP/cron invocations</strong> — uses{" "}
					<code>dotnet run --no-build</code> for speed. Click the{" "}
					<strong>.NET Build</strong> button in the function dashboard after
					changing project files.
				</li>
				<li>
					Stdout and stderr are captured as execution logs.
				</li>
				<li>
					Return your response with <code>SHSF.Runtime.Return(...)</code> — not
					via <code>Console.WriteLine</code>.
				</li>
			</ul>

			<h2>Generated helpers</h2>
			<p>
				Every .NET function gets two auto-generated helper classes:
			</p>
			<ul>
				<li>
					<code>SHSF.Runtime</code> — <code>LoadPayload()</code>,{" "}
					<code>LoadPayloadJson&lt;T&gt;()</code>, and <code>Return(...)</code>
				</li>
				<li>
					<code>SHSF.Database</code> — key-value storage via the internal
					transport (no API token needed)
				</li>
			</ul>

			<h2>Example project files</h2>
			<CodeCaption>MyFunction.csproj</CodeCaption>
			<pre>
				<code>{`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>`}</code>
			</pre>

			<CodeCaption>Program.cs — minimal function</CodeCaption>
			<pre>
				<code>{`using SHSF;

var payload = Runtime.LoadPayload();
Runtime.Return(new { message = "Hello from .NET!", payloadSize = payload.Length });`}</code>
			</pre>

			<h2>Deserialising the payload</h2>
			<CodeCaption>Program.cs — typed payload</CodeCaption>
			<pre>
				<code>{`using SHSF;

public sealed class Input
{
    public string? Name  { get; set; }
    public string? Route { get; set; }
}

var input = Runtime.LoadPayloadJson<Input>() ?? new Input();

Runtime.Return(new
{
    greeting = $"Hello, {input.Name ?? "world"}!",
    route    = input.Route ?? "default"
});`}</code>
			</pre>

			<h2>Custom HTTP responses</h2>
			<CodeCaption>Program.cs — v2 envelope</CodeCaption>
			<pre>
				<code>{`using SHSF;

Runtime.Return(new
{
    _shsf    = "v2",
    _code    = 201,
    _headers = new Dictionary<string, string>
    {
        ["Content-Type"] = "application/json",
        ["X-Powered-By"] = "SHSF .NET"
    },
    _res = new { status = "created", runtime = ".NET" }
});`}</code>
			</pre>

			<h2>Database communication</h2>
			<CodeCaption>Program.cs — create, write, read</CodeCaption>
			<pre>
				<code>{`using SHSF;

var db = new Database();

await db.CreateStorage("users", "User profile data");
await db.Set("users", "alice", new { name = "Alice", tier = "pro" });
var user = await db.Get("users", "alice");

Runtime.Return(new { user });`}</code>
			</pre>

			<CodeCaption>Program.cs — list, exists, delete</CodeCaption>
			<pre>
				<code>{`using SHSF;

var db = new Database();
var items  = await db.ListItems("users");
var exists = await db.Exists("users", "alice");
await db.DeleteItem("users", "alice");

Runtime.Return(new { items, exists });`}</code>
			</pre>

			<h2>Logging</h2>
			<p>
				Use <code>Console.WriteLine</code> or{" "}
				<code>Console.Error.WriteLine</code> for log output. Only call{" "}
				<code>Runtime.Return()</code> once per invocation — that is the
				function's response.
			</p>
			<CodeCaption>Program.cs — logging</CodeCaption>
			<pre>
				<code>{`using SHSF;

Console.WriteLine("Starting...");
Console.Error.WriteLine("Both stdout and stderr appear in logs.");

Runtime.Return(new { ok = true });`}</code>
			</pre>

			<NextStep href="/docs/kickoff" label="#22 Kickoff">
				Next: use SHSF's AI code generation to scaffold function files in
				Python, Go, or .NET from a plain-English description.
			</NextStep>
		</DocsContentShell>
	);
};
