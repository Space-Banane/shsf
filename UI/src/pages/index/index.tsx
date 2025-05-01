const IndexPage = () => {
	return (
		<div className="min-h-screen bg-background">
			{/* Hero Section */}
			<div className="h-[90vh] flex items-center justify-center px-4 pt-[-10vh]">
				<div className="text-center space-y-8">
					<h1 className="text-7xl font-bold text-primary">{"<SHSF/>"}</h1>
					<p className="text-2xl text-text/80 max-w-2xl mx-auto">
						Self Hostable Serverless Functions.
					</p>
					<div className="flex gap-6 justify-center mt-12">
						<a
							className="px-6 py-4 bg-primary text-background text-xl font-bold rounded-xl 
		  hover:shadow-[0_0_30px_rgba(124,131,253,0.3)] hover:scale-105 transition-all duration-300"
							href="/functions"
						>
							Get Started
						</a>
						<a
							className="px-6 py-4 border-2 border-primary text-primary text-xl font-bold rounded-xl 
		  hover:bg-primary/10 hover:shadow-lg transition-all duration-300"
							href="/docs"
						>
							Documentation
						</a>
					</div>
				</div>
			</div>

			{/* Cloud Functions Intro Section */}
			<section className="py-24 px-4">
				<div className="max-w-3xl mx-auto">
					<h2 className="text-5xl font-bold text-primary text-center mb-8 ">
						Introduction to Cloud Functions
					</h2>
					<p className="text-xl text-text/80 text-center max-w-2xl mx-auto">
						Cloud Functions are single-purpose, serverless operations that run
						in response to events. Write code that solves one specific problem,
						without worrying about the underlying infrastructure.
					</p>
				</div>
			</section>

			{/* How to execute a function Section */}
			<section className="py-24 px-4">
				<div className="max-w-3xl mx-auto">
					<h2 className="text-5xl font-bold text-primary text-center mb-8 ">
						How to Execute a Function
					</h2>
					<p className="text-xl text-text/80 text-center max-w-2xl mx-auto">
						In SHSF, you can execute a Function using a HTTP Request. <br />
						You can also setup a trigger, which is like a cron job, to run your function at a specific time or interval.
					</p>
				</div>
				<div className="flex justify-center mt-8">
					<a
						className="px-4 py-2 bg-primary text-background text-xl font-bold rounded-xl
						 hover:shadow-[0_0_30px_rgba(124,131,253,0.3)] hover:scale-105 transition-all duration-300"
						href="/functions"
					>
						Deploy a Function
					</a>
				</div>
			</section>

			{/* Use Case Section */}
			<section className="py-24 px-4">
				<div className="max-w-7xl mx-auto">
					<h2 className="text-5xl font-bold text-primary text-center mb-10">
						Real World Example
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
						<RealWorldExample title="Image Processing Pipeline🖼️" description="
							Use Cloud Functions to process images in real time. Upload an image,
							and trigger a function to resize, filter, or analyze it.
						" extra="Speed obviously depends on the backend."/>
						<RealWorldExample title="Data Processing🛠️" description="
							Leverage Cloud Functions to process large datasets efficiently. 
							Trigger functions on data uploads or scheduled events.
						" extra="A very nice addition to what you can do!"/>
						<RealWorldExample title="Quick Response to User Actions👥" description="
							Use Cloud Functions to respond to user actions, such as sending
							email notifications or updating databases.
						" extra="Very possible, but not recommended for big tech." />
						<RealWorldExample title="Webhook Handling🕸️" description="
							Use Cloud Functions to handle webhooks from third-party services.
							Process incoming data and trigger further actions.
						" extra="This is the main idea"/>
					</div>
				</div>
			</section>

			{/* Supported Languages Section */}
			<section className="py-24 px-4">
				<div className="max-w-6xl mx-auto text-center">
					<h2 className="text-5xl font-bold text-primary mb-16">
						Supported Languages
					</h2>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto mb-16">
						<SupportedLanguage language="NodeJS🟢" tag="Slow Packaging" tagcolor="bg-yellow-500"/>
						<SupportedLanguage language="Python🐍" tag="Perfect" tagcolor="bg-green-600" />
						<SupportedLanguage language="Go💨" soon={true} />
						<SupportedLanguage language="Lua🟣" soon={true} />
					</div>
					<p className="text-xl text-text/80 italic">
						Have fun building amazing serverless applications!
					</p>
				</div>
			</section>
		</div>
	);
};

function SupportedLanguage({ language, soon, tag, tagcolor }: { language: string; soon?: boolean; tag?: string; tagcolor?: string }) {
	return (
		<div
			className={`relative flex items-center justify-center text-2xl font-bold text-subhead 
				bg-primary/5 rounded-2xl p-6 shadow-lg hover:shadow-xl 
				hover:bg-primary/10 transition-all duration-300 
				${soon ? 'filter grayscale opacity-70 hover:opacity-80' : 'hover:scale-105'}`}
		>
			{soon && (
				<span className="absolute -top-2 -right-2 bg-red-500/90 text-white text-xs font-bold 
					px-3 py-1.5 rounded-xl shadow-md transform hover:scale-110 transition-transform">
					Coming Soon
				</span>
			)}
			{tag && (
				<span className={`absolute -top-2 -right-2 ${tagcolor ? tagcolor : "bg-blue-600"} text-white text-xs font-bold 
					px-3 py-1.5 rounded-xl shadow-md transform hover:scale-110 transition-transform`}>
					{tag}
				</span>
			)}
			<span className="drop-shadow-sm">{language}</span>
		</div>
	);
}

function RealWorldExample({ title, description, extra }: { title: string; description: string; extra?: string }) {
	return (
		<div className="bg-primary/5 rounded-3xl p-12">
			<h3 className="text-2xl font-bold text-subhead mb-6">{title}</h3>
			<p className="text-xl text-text/80 mb-4">{description}</p>
			{extra && <p className="text-lg text-text/60 italic">{extra}</p>}
		</div>
	);
}

export default IndexPage;
