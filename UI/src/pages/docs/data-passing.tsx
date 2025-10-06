export const DataPassingPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs" className="text-sm text-blue-500 hover:underline">
            ← Back to docs
          </a>
        </div>

        <h1 className="text-3xl font-bold text-primary mb-2">Data Passing</h1>
        <p className="mt-3 text-lg text-text/90 mb-8">
          Learn how to pass data between triggers and functions using JSON
          payloads.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-6">
          Understanding Data Passing
        </h2>
        <p className="mb-4 text-text/90">
          In SHSF, data can be passed between triggers and functions using JSON
          payloads. This allows you to send structured data that your functions
          can easily parse and utilize.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-6">
          Passing Data from Triggers to Functions
        </h2>
        <p className="mb-4 text-text/90">
          When setting up a trigger, you can define a JSON payload that will be
          sent to the function when the trigger is activated. This payload can
          include any data your function needs to perform its task.
        </p>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>
            {`{
  "event": "user_signup",
  "user": {
    "id": "12345",
    "name": "John Doe",
    "email": "john.doe@example.com"
    }
}`}
          </code>
        </pre>
        <p className="mb-4 text-text/90">
          In this example, the trigger sends a payload containing user
          information when a new user signs up.
        </p>
        <p className="mb-4 text-text/90 italic">
          You can access this via <code>args.body</code> in your function.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-6">
          Accessing Data in Functions
        </h2>
        <p className="mb-4 text-text/90">
          Inside your function, you can access the passed data through{" "}
          <code>args</code>. This is how you can take a look at it in Python:
        </p>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>
            {`def main(args):
    print(args)
`}
          </code>
        </pre>
        <p className="mb-4 text-text/90">
          The <code>args</code> parameter contains any data passed to the
          function, either via HTTP or a Trigger. You can parse this data and
          use it as needed in your function logic.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-6">HTTP Data</h2>
        <p className="mb-4 text-text/90">
          When invoking functions via HTTP requests, you can also pass data in
          the request body as JSON. This is useful for scenarios where you want
          to trigger a function manually or from an external service.
        </p>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>
            {`POST (FUNCTIONURL)
Content-Type: application/json
{
  "task": "process_data",
  "data": {
    "item1": "value1",
    "item2": "value2"
  }
}`}
          </code>
        </pre>
        <p className="mb-4 text-text/90">
          In this example, an HTTP POST request is made to the function's URL
          with a JSON body containing a task and associated data.
        </p>
        <h3 className="text-xl font-semibold text-primary mt-6 mb-3">
          Accessing HTTP Data in Functions
        </h3>
        <p className="mb-4 text-text/90">
          To access the HTTP request data in your function, you can use the same
          approach as with trigger data. Here's an example in Python:
        </p>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>
            {`def main(args):
    body = args.get("body")
    print(body)
`}
          </code>
        </pre>
        <p className="mb-4 text-text/90">
          The <code>args</code> parameter contains the JSON payload sent by the
          HTTP request. You can parse this data and use it as needed in your
          function logic.
        </p>

        <h3 className="text-xl font-semibold text-primary mt-6 mb-3">
          HTTP Parameters
        </h3>
        <p className="mb-4 text-text/90">
          You can also pass data via URL parameters in HTTP requests. For
          example, if your function URL is{" "}
          <code>https://example.com/function</code>, you can append query
          parameters like this:{" "}
          <code>
            https://example.com/function?param1=value1&amp;param2=value2
          </code>
          .
        </p>
        <p className="mb-4 text-text/90">
          To access these parameters in your function, you can use the following
          code:
        </p>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>
            {`def main(args):
    queries = args.get("queries")
    param1 = queries.get("param1")
    param2 = queries.get("param2")
    print(f"Param1: {param1}, Param2: {param2}")
`}
          </code>
        </pre>
        <p className="mb-4 text-text/90">
          This will retrieve the values of <code>param1</code> and{" "}
          <code>param2</code> from the URL query parameters.
        </p>

        <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-300">
            <strong>⚠️ Warning:</strong> You can always use queries and body at
            the same time. However, in GET requests, the body will be empty, or
            undefined. Be aware to check types!
          </p>
        </div>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-6">Routes</h2>
        <p className="mb-4 text-text/90">
          You can define multiple routes within your code, retrieve the route
          from <code>args.route</code>, here is how:
        </p>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>
            {`def main(args):
    route = args.get("route")
    if route == "/task1":
        return handle_task1(args)
    elif route == "/task2":
        return handle_task2(args)
    else:
        return "Custom response here" # We will learn this next
`}
          </code>
        </pre>

        <h2 className="text-2xl font-bold text-primary mt-8 mb-6">
          Conclusion
        </h2>
        <p className="mb-4 text-text/90">
          Passing data into a function using JSON payloads or a HTTP Request is
          a powerful feature of SHSF. It allows you to create dynamic and
          responsive serverless applications that can handle a variety of tasks
          based on the data they receive.
        </p>
        <p className="mb-4 text-text/90">
          Experiment with different data structures and see how you can leverage
          this capability to enhance your serverless functions!
        </p>

        <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            🚀 Next Steps - Custom Responses
          </h2>
          <p className="text-text/90 mb-4">
            Now that we know how to pass data into a function, lets learn how we
            can return custom responses from our functions.
          </p>
          <a
            href="/docs/custom-responses"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            #3 Custom Responses
            <span className="text-lg">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};
