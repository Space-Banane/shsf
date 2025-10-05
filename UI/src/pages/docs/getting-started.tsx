import React from "react";

export const DocsGettingStarted = () => {
    return (
        <div className="min-h-screen bg-background text-text p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <a href="/docs" className="text-sm text-blue-500 hover:underline">← Back to docs</a>
                </div>

                <h1 className="text-3xl font-bold text-primary mb-2">Getting Started</h1>
                <p className="mt-3 text-lg text-text/90 mb-8">
                    Let's get SHSF up and running!
                </p>

                <h2 className="text-2xl font-bold text-primary mt-8 mb-6">Installation</h2>
                <p className="mb-6 text-text/90">
                    Follow these steps to install and configure SHSF on your system.
                </p>

                <h3 className="text-xl font-semibold text-primary mb-4">Clone the Repository</h3>
                <p className="mb-4 text-text/90">
                    Start by cloning the SHSF repository to your local machine:
                </p>
                <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
                    <code>git clone https://github.com/Space-Banane/shsf && cd shsf</code>
                </pre>

                <h3 className="text-xl font-semibold text-primary mb-4">Configure Environment Variables</h3>
                <p className="mb-4 text-text/90">
                    Copy the example environment file and customize it for your setup. You must provide database credentials and URLs.
                </p>
                <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
                    <code>cp example.env .env</code>
                </pre>
                <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-300">
                        <strong>Tip:</strong> See the example.env file for detailed configuration options and recommended settings.
                    </p>
                </div>

                <h3 className="text-xl font-semibold text-primary mb-4">Set Up Database Server</h3>
                <p className="mb-4 text-text/90">
                    You can use your own MariaDB/MySQL server, or uncomment the <code>database</code> service in <code>docker-compose.yml</code> to run one locally.
                </p>
                <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-300">
                        <strong>Note:</strong> Make sure your database is accessible and the credentials in your .env file are correct before proceeding.
                    </p>
                </div>

                <h3 className="text-xl font-semibold text-primary mb-4">Start the Stack</h3>
                <p className="mb-4 text-text/90">
                    Launch all SHSF services using Docker Compose:
                </p>
                <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
                    <code>docker compose up -d</code>
                </pre>
                <div className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-300">
                        <strong>Success:</strong> This command will start all SHSF services in the background. Wait a few moments for everything to initialize.
                    </p>
                </div>

                <h3 className="text-xl font-semibold text-primary mb-4">Access the UI</h3>
                <p className="mb-4 text-text/90">
                    Open your browser and navigate to <code>http://localhost:3000</code> (or your configured <code>UI_URL</code>).
                </p>
                <div className="mb-8 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                    <p className="text-sm text-purple-300">
                        <strong>🎉 You're ready!</strong> If you see the SHSF interface, everything is working correctly.
                    </p>
                </div>

                <h2 className="text-2xl font-bold text-primary mt-8 mb-6">Usage</h2>
                
                <h3 className="text-xl font-semibold text-primary mb-4">Account Setup</h3>
                <p className="mb-6 text-text/90">
                    By default, registration is open. Create an account and then close registration by setting the appropriate flag in your <code>.env</code> file for security.
                </p>

                <h3 className="text-xl font-semibold text-primary mb-4">Function Limits</h3>
                <p className="mb-6 text-text/90">
                    You can create as many functions as your system resources can handle. SHSF doesn't impose artificial limits - scale according to your needs and hardware capabilities.
                </p>

                <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
                    <h2 className="text-xl font-bold text-primary mb-3">🚀 Next Steps - Create Your First Function</h2>
                    <p className="text-text/90 mb-4">
                        Now that SHSF is running, let's create your first function! Follow our comprehensive tutorial to build a Discord webhook bot.
                    </p>
                    <a href="/docs/my-first-function" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        Create Your First Function
                        <span className="text-lg">→</span>
                    </a>
                </div>
            </div>
        </div>
    );
};