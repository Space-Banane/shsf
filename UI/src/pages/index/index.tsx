const IndexPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="h-[90vh] flex items-center justify-center px-4">
        <div className="text-center space-y-8">
          <div className="mb-8">
            <h1 className="text-7xl font-bold text-primary mb-4">
              {"<SHSF/>"}
            </h1>
            <div className="h-1 w-32 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
          </div>
          <h2 className="text-3xl font-semibold text-text/90 max-w-3xl mx-auto">
            Self-Hostable Serverless Functions
          </h2>
          <p className="text-xl text-text/70 max-w-2xl mx-auto leading-relaxed">
            Deploy Functions with HTTP endpoints, scheduled triggers, and
            environment variables. All running on your own infrastructure.
          </p>
          <div className="flex gap-6 justify-center mt-12">
            <a
              className="px-8 py-4 bg-primary text-background text-xl font-bold rounded-xl 
							hover:shadow-[0_0_30px_rgba(124,131,253,0.3)] hover:scale-105 transition-all duration-300"
              href="/functions"
            >
              Deploy Functions
            </a>
            <a
              className="px-8 py-4 border-2 border-primary text-primary text-xl font-bold rounded-xl 
							hover:bg-primary/10 hover:shadow-lg transition-all duration-300"
              href="/docs"
            >
              Documentation
            </a>
          </div>
        </div>
      </div>

      {/* Key Features Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-primary text-center mb-16">
            Everything You Need for Serverless
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🚀"
              title="Instant Deployment"
              description="Upload your code and dependencies. SHSF handles the runtime and execution automatically."
            />
            <FeatureCard
              icon="⏰"
              title="Scheduled Triggers"
              description="Run functions on cron schedules. Perfect for automation, backups, and periodic tasks."
            />
            <FeatureCard
              icon="🌐"
              title="HTTP Endpoints"
              description="Every function gets an HTTP endpoint. Handle webhooks, APIs, and user requests with ease."
            />
            <FeatureCard
              icon="🔐"
              title="Environment Variables"
              description="Securely manage API keys and sensitive data with built-in environment variable support."
            />
            <FeatureCard
              icon="📁"
              title="File Management"
              description="Built-in file editor and dependency management. No need for external tools or complex setups."
            />
            <FeatureCard
              icon="🏠"
              title="Self-Hosted"
              description="Full control over your infrastructure. Deploy on your servers with Docker Compose."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-primary text-center mb-16">
            How SHSF Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <WorkflowStep
                number="1"
                title="Write Your Function"
                description="Create Functions with a simple main(args) entry point. Access HTTP data, query parameters, and custom trigger payloads."
              />
              <WorkflowStep
                number="2"
                title="Set Up Triggers"
                description="Configure HTTP endpoints or scheduled cron jobs. Pass JSON data to your functions when they execute."
              />
              <WorkflowStep
                number="3"
                title="Deploy & Monitor"
                description="Functions run automatically based on your triggers. View logs, manage files, and update code through the web interface."
              />
            </div>
			<div className="bg-gray-900 rounded-xl p-4 font-mono text-sm">
			  <div className="text-green-400 mb-2"># Example Function</div>
			  <pre className="bg-gray-800 rounded-lg p-3 overflow-x-auto border border-gray-700">
				<code className="language-python text-green-200">
				  {`def main(args):
	name = args.get("queries", {}).get("name", "World")
	return f"Hello, {name}!"
`}
				</code>
			  </pre>
			</div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-primary text-center mb-16">
            Perfect For These Use Cases
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <UseCaseCard
              title="Discord/Slack Bots 🤖"
              description="Handle webhooks and send automated messages. Schedule daily reminders, process commands, and integrate with your team workflows."
              tags={["Webhooks", "Scheduling", "HTTP"]}
            />
            <UseCaseCard
              title="API Integrations 🔗"
              description="Connect different services together. Process webhook data, sync information between platforms, and automate data flows."
              tags={["REST APIs", "Data Processing", "Automation"]}
            />
            <UseCaseCard
              title="Scheduled Tasks ⏱️"
              description="Backup databases, send reports, clean up files. Any task that needs to run on a schedule without manual intervention."
              tags={["Cron Jobs", "Automation", "Maintenance"]}
            />
            <UseCaseCard
              title="Microservices 🏗️"
              description="Build lightweight, single-purpose services. Handle specific business logic with dedicated functions and clear interfaces."
              tags={["Architecture", "Scalability", "Organization"]}
            />
          </div>
        </div>
      </section>

      {/* Getting Started CTA */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-2xl p-12">
            <h2 className="text-4xl font-bold text-primary mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-text/80 mb-8 max-w-2xl mx-auto">
              Deploy SHSF with Docker Compose and start building serverless
              Functions in minutes. Full documentation and tutorials
              included.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                className="px-8 py-4 bg-primary text-background text-lg font-bold rounded-xl 
								hover:shadow-[0_0_30px_rgba(124,131,253,0.3)] hover:scale-105 transition-all duration-300"
                href="/docs/getting-started"
              >
                Installation Guide
              </a>
              <a
                className="px-8 py-4 border-2 border-primary text-primary text-lg font-bold rounded-xl 
								hover:bg-primary/10 hover:shadow-lg transition-all duration-300"
                href="/docs/my-first-function"
              >
                First Function Tutorial
              </a>
            </div>
            <div className="mt-8 flex justify-center gap-2 text-sm text-text/60">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                Docker
              </span>
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full">
                Self-Hosted
              </span>
              <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full">
                Open Source
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-background border border-primary/20 rounded-xl p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-primary mb-3">{title}</h3>
      <p className="text-text/80 leading-relaxed">{description}</p>
    </div>
  );
}

function WorkflowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-12 h-12 bg-primary text-background rounded-full flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <div>
        <h3 className="text-xl font-bold text-primary mb-2">{title}</h3>
        <p className="text-text/80 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function UseCaseCard({
  title,
  description,
  tags,
}: {
  title: string;
  description: string;
  tags: string[];
}) {
  return (
    <div className="bg-background border border-primary/20 rounded-xl p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300">
      <h3 className="text-xl font-bold text-primary mb-3">{title}</h3>
      <p className="text-text/80 leading-relaxed mb-4">{description}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default IndexPage;
