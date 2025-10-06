export const PersistentDataPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs" className="text-sm text-blue-500 hover:underline">
            ← Back to docs
          </a>
        </div>

        <h1 className="text-3xl font-bold text-primary mb-2">
          Persistent Data
        </h1>

        <p className="mt-3 text-lg text-text/90 mb-6">
          When working with Functions, you might want to save data. Doing it via
          a big database can cause performance issues, thats why we can use
          redis or storing it in files, if we only need it when the function
          runs.
        </p>
        <p className="mb-4 text-text/90">
          You obviously can store stuff in databases if you like, or need. But
          it isn't fully recomended for a reason
        </p>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Filesystem Storage
        </h2>
        <p className="mb-4 text-text/90">
          You can store files in the filesystem, and they will persist between
          function invocations. This is useful for caching data or storing
          temporary files.
        </p>
        <p className="mb-4 text-text/90">
          ALWAYS store within the <code>/app/</code> directory, as other
          directories are NOT persist between invocations. <br />
          Use <code>/tmp/</code> for temporary files that do not need to
          persist.
        </p>
        <p className="mb-4 text-text/90">
          Here is how you can read and write files in a Python Runtime:
        </p>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>{`def main(args):
    # Writing to a file
    with open("/app/myfile.txt", "w") as f:
        f.write("Hello, World!")

    # Reading from a file
    with open("/app/myfile.txt", "r") as f:
        content = f.read()

    return {"content": content}
`}</code>
        </pre>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Redis Storage
        </h2>
        <p className="mb-4 text-text/90">
          You can use Redis to store key-value pairs that persist between
          function invocations. This is useful for caching data or storing
          session information.
        </p>
        <p className="mb-4 text-text/90">
          Here is how you can connect to Redis in a Python Runtime:
        </p>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
          <code>{`import redis

r = redis.Redis(host="localhost", port=6379, db=0)
def main(args):
    # Set a value
    r.set("mykey", "Hello, World!")

    # Get a value
    value = r.get("mykey")
    return {"value": value.decode("utf-8")}
`}</code>
        </pre>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Important Notes
        </h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>
            Always handle exceptions when working with files or Redis to avoid
            crashes.
          </li>
          <li>
            Be mindful of the storage limits and performance implications of
            using filesystem or Redis.
          </li>
          <li>
            Regularly clean up old or unused data to free up space and improve
            performance.
          </li>
        </ul>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Summary
        </h2>
        <p className="mb-4 text-text/90">
          In summary, when working with persistent data in Functions, you have several options including filesystem storage and Redis. Each method has its own use cases, benefits, and limitations. Always consider the specific requirements of your application and choose the most appropriate storage solution.
        </p>

        <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            No next step! Keep your instance up to date for the latest docs!
          </h2>
          <p className="text-text/90 mb-4">No new docs yet.</p>
        </div>
      </div>
    </div>
  );
};
