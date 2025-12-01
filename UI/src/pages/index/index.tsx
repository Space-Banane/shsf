import { motion } from "motion/react";

const IndexPage = () => {
	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<div className="h-[90vh] flex items-center justify-center px-4">
				<div className="text-center space-y-8">
					<motion.div
						className="mb-8"
						initial={{ opacity: 0, y: -50 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, ease: "easeOut" }}
					>
						<motion.h1
							className="text-7xl font-semibold text-primary mb-4 font-fredericka"
							initial={{ opacity: 0, scale: 0.5 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
						>
							<span className="font-semibold font-sans">{"<"}</span>
							{"SHSF"}
							<span className="font-semibold font-sans">{"/>"}</span>
						</motion.h1>
						<motion.div
							className="h-1 w-32 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"
							initial={{ width: 0 }}
							animate={{ width: 128 }}
							transition={{ duration: 0.8, delay: 0.8 }}
						></motion.div>
					</motion.div>
					<motion.h2
						className="text-3xl text-text/90 max-w-3xl mx-auto font-sriracha"
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.5 }}
					>
						Self-Hostable Serverless Functions
					</motion.h2>
					<motion.p
						className="text-xl text-text/70 max-w-2xl mx-auto leading-relaxed"
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.7 }}
					>
						Deploy Functions with HTTP endpoints, scheduled triggers, and environment
						variables. All running on your own infrastructure.
					</motion.p>
					<motion.div
						className="flex gap-6 justify-center mt-12"
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.9 }}
					>
						<motion.button
							whileHover={{
								scale: 1.05,
								boxShadow: "0 0 30px rgba(124,131,253,0.3)",
							}}
							whileTap={{ scale: 0.97 }}
							className="px-8 py-4 bg-primary text-background text-xl rounded-xl inline-block font-margarine"
							onClick={() => {
								setTimeout(() => {
									window.location.href = "/functions";
								}, 100);
							}}
						>
							Deploy Functions
						</motion.button>
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.976 }}
							onHoverStart={() => console.log("hover started!")}
							className="px-8 py-4 border-2 border-primary text-primary text-xl rounded-xl font-margarine 
              hover:bg-primary/10 hover:shadow-lg"
							onClick={() => {
								setTimeout(() => {
									window.location.href = "/docs/getting-started";
								}, 100);
							}}
						>
							Documentation
						</motion.button>
					</motion.div>
				</div>
			</div>

			{/* Key Features Section */}
			<motion.section
				className="py-24 px-4"
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true, margin: "-100px" }}
				transition={{ duration: 0.8 }}
			>
				<div className="max-w-6xl mx-auto">
					<motion.h2
						className="text-4xl font-bold text-primary text-center mb-16"
						initial={{ opacity: 0, y: 50 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
					>
						Everything You Need for Serverless
					</motion.h2>
					<motion.div
						className="grid grid-cols-1 md:grid-cols-3 gap-8"
						initial={{ opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
						transition={{ staggerChildren: 0.1, delayChildren: 0.3 }}
					>
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
					</motion.div>
				</div>
			</motion.section>

			{/* How It Works Section */}
			<motion.section
				className="py-24 px-4"
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true, margin: "-100px" }}
				transition={{ duration: 0.8 }}
			>
				<div className="max-w-5xl mx-auto">
					<motion.h2
						className="text-4xl font-bold text-primary text-center mb-16"
						initial={{ opacity: 0, y: 50 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
					>
						How SHSF Works
					</motion.h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
						<motion.div
							className="space-y-8"
							initial={{ opacity: 0, x: -50 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							transition={{ staggerChildren: 0.2, delayChildren: 0.3 }}
						>
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
						</motion.div>
						<motion.div
							className="bg-gray-900 rounded-xl p-4 font-mono text-sm"
							initial={{ opacity: 0, x: 50, rotateY: -15 }}
							whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.8, delay: 0.4 }}
							whileHover={{ scale: 1.02, rotateY: 2 }}
						>
							<div className="text-green-400 mb-2"># Example Function</div>
							<pre className="bg-gray-800 rounded-lg p-3 overflow-x-auto border border-gray-700">
								<code className="language-python text-green-200">
									{`def main(args):
	name = args.get("queries", {}).get("name", "World")
	return f"Hello, {name}!"
`}
								</code>
							</pre>
						</motion.div>
					</div>
				</div>
			</motion.section>

			{/* Use Cases Section */}
			<motion.section
				className="py-24 px-4"
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true, margin: "-100px" }}
				transition={{ duration: 0.8 }}
			>
				<div className="max-w-6xl mx-auto">
					<motion.h2
						className="text-4xl font-bold text-primary text-center mb-16"
						initial={{ opacity: 0, y: 50 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
					>
						Perfect For These Use Cases
					</motion.h2>
					<motion.div
						className="grid grid-cols-1 md:grid-cols-2 gap-8"
						initial={{ opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
						transition={{ staggerChildren: 0.15, delayChildren: 0.3 }}
					>
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
					</motion.div>
				</div>
			</motion.section>

			{/* Getting Started CTA */}
			<motion.section
				className="py-24 px-4"
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true, margin: "-100px" }}
				transition={{ duration: 0.8 }}
			>
				<div className="max-w-4xl mx-auto text-center">
					<motion.div
						className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-2xl p-12"
						initial={{ opacity: 0, y: 50, scale: 0.95 }}
						whileInView={{ opacity: 1, y: 0, scale: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.8 }}
						whileHover={{ scale: 1.02 }}
					>
						<motion.h2
							className="text-4xl font-bold text-primary mb-6"
							initial={{ opacity: 0 }}
							whileInView={{ opacity: 1 }}
							viewport={{ once: true }}
							transition={{ delay: 0.3 }}
						>
							Ready to Get Started?
						</motion.h2>
						<motion.p
							className="text-xl text-text/80 mb-8 max-w-2xl mx-auto"
							initial={{ opacity: 0 }}
							whileInView={{ opacity: 1 }}
							viewport={{ once: true }}
							transition={{ delay: 0.5 }}
						>
							Deploy SHSF with Docker Compose and start building serverless Functions
							in minutes. Full documentation and tutorials included.
						</motion.p>
						<motion.div
							className="flex flex-col sm:flex-row gap-4 justify-center"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ delay: 0.7 }}
						>
							<motion.a
								className="px-8 py-4 bg-primary text-background text-lg font-bold rounded-xl 
								hover:shadow-[0_0_30px_rgba(124,131,253,0.3)] hover:scale-105 transition-all duration-300"
								href="/docs/getting-started"
								whileHover={{ scale: 1.05, y: -2 }}
								whileTap={{ scale: 0.95 }}
							>
								Installation Guide
							</motion.a>
							<motion.a
								className="px-8 py-4 border-2 border-primary text-primary text-lg font-bold rounded-xl 
								hover:bg-primary/10 hover:shadow-lg transition-all duration-300"
								href="/docs/my-first-function"
								whileHover={{ scale: 1.05, y: -2 }}
								whileTap={{ scale: 0.95 }}
							>
								First Function Tutorial
							</motion.a>
						</motion.div>
						<motion.div
							className="mt-8 flex justify-center gap-2 text-sm text-text/60"
							initial={{ opacity: 0 }}
							whileInView={{ opacity: 1 }}
							viewport={{ once: true }}
							transition={{ delay: 0.9, staggerChildren: 0.1 }}
						>
							<motion.span
								className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full"
								initial={{ scale: 0 }}
								whileInView={{ scale: 1 }}
								viewport={{ once: true }}
								whileHover={{ scale: 1.1 }}
							>
								Docker
							</motion.span>
							<motion.span
								className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full"
								initial={{ scale: 0 }}
								whileInView={{ scale: 1 }}
								viewport={{ once: true }}
								transition={{ delay: 0.1 }}
								whileHover={{ scale: 1.1 }}
							>
								Self-Hosted
							</motion.span>
							<motion.span
								className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full"
								initial={{ scale: 0 }}
								whileInView={{ scale: 1 }}
								viewport={{ once: true }}
								transition={{ delay: 0.2 }}
								whileHover={{ scale: 1.1 }}
							>
								Open Source
							</motion.span>
						</motion.div>
					</motion.div>
				</div>
			</motion.section>
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
		<motion.div
			className="flex gap-4"
			initial={{ opacity: 0, x: -30 }}
			whileInView={{ opacity: 1, x: 0 }}
			viewport={{ once: true }}
			whileHover={{ x: 10 }}
			transition={{ duration: 0.3 }}
		>
			<motion.div
				className="flex-shrink-0 w-12 h-12 bg-primary text-background rounded-full flex items-center justify-center font-bold text-lg"
				whileHover={{ scale: 1.1, rotate: 360 }}
				transition={{ duration: 0.3 }}
			>
				{number}
			</motion.div>
			<div>
				<h3 className="text-xl font-bold text-primary mb-2">{title}</h3>
				<p className="text-text/80 leading-relaxed">{description}</p>
			</div>
		</motion.div>
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
		<motion.div
			className="bg-background border border-primary/20 rounded-xl p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300"
			initial={{ opacity: 0, y: 50 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true }}
			whileHover={{ y: -8, scale: 1.02 }}
			transition={{ duration: 0.3 }}
		>
			<h3 className="text-xl font-bold text-primary mb-3">{title}</h3>
			<p className="text-text/80 leading-relaxed mb-4">{description}</p>
			<motion.div
				className="flex flex-wrap gap-2"
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true }}
				transition={{ staggerChildren: 0.1, delayChildren: 0.3 }}
			>
				{tags.map((tag, index) => (
					<motion.span
						key={tag}
						className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
						initial={{ scale: 0, opacity: 0 }}
						whileInView={{ scale: 1, opacity: 1 }}
						viewport={{ once: true }}
						transition={{ delay: index * 0.1 }}
						whileHover={{ scale: 1.1 }}
					>
						{tag}
					</motion.span>
				))}
			</motion.div>
		</motion.div>
	);
}

export default IndexPage;
