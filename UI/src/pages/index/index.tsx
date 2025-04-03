const IndexPage = () => {
	return (
		<div className="bg-gray-900 p-4 flex items-center justify-center">
			<div className="max-w-3xl w-full bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
				<div className="p-6">
					<h1 className="text-4xl font-extrabold text-white text-center mb-4">
						Self-Host Serverless Functions (SHSF)
					</h1>
					<p className="text-lg text-gray-300 leading-relaxed text-center">
						This app is a self-hosted serverless function platform, designed to provide an alternative to cloud solutions like AWS Lambda or DigitalOcean Functions. It allows users to execute code on demand with features like event-driven architecture, cron jobs, and a web-based UI for managing functions, triggers, and databases.
					</p>
					<p className="mt-2 text-lg text-gray-300 leading-relaxed text-center">
						The system is scalable using Docker and Kubernetes, with a focus on flexibility, security, and user-friendliness.
					</p>
					<div className="mt-6 flex justify-center">
						<button className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition">
							Get Started
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default IndexPage;
