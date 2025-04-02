const IndexPage = () => {
	return (
		<div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 space-y-4">
			<div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden md:max-w-2xl">
				<div className="md:flex">
					<div className="p-8">
						<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
							I HATE Angular, so I'm learning React!
						</h1>
						<p className="mt-2 text-gray-600 dark:text-gray-400">
							This app is a simple self-hosted cloud functions platform.{" "}
							<span className="italic">Currently, it only has the <code>/run</code> route.</span>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default IndexPage;
