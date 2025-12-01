import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const MyFirstFunctionDoc = () => {
	return (
		<div className="min-h-screen bg-background text-text p-8">
			<div className="max-w-4xl mx-auto">
				<div className="mb-6">
					<a href="/docs" className="text-sm text-blue-500 hover:underline">
						← Back to docs
					</a>
				</div>

				<ScrollProgressbar />

				<h1 className="text-3xl font-bold text-primary mb-2">My First Function</h1>
				<p className="mt-3 text-lg text-text/90 mb-8">
					Let's create a function that sends a Discord message every Monday at
					midnight!
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Setting Up Your Function
				</h2>
				<p className="mb-6 text-text/90">
					We'll build a function that automatically wishes your Discord server a
					happy Monday. This tutorial covers function creation, file management,
					dependency installation, and scheduling.
				</p>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Navigate to Functions
				</h3>
				<p className="mb-6 text-text/90">
					Go to{" "}
					<a href="/functions" className="text-blue-500 hover:underline">
						Functions
					</a>{" "}
					in the SHSF interface. If you haven't created a namespace yet, click
					"Create Namespace" to organize your functions.
				</p>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Create Your Function
				</h3>
				<p className="mb-4 text-text/90">
					Click "Create Function" and fill out the required fields including name,
					description, and select the namespace you created.
				</p>
				<div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
					<p className="text-sm text-blue-300">
						<strong>Info:</strong> Most settings can be changed later via the UI. If
						something can't be modified, simply recreate the function - they're
						lightweight!
					</p>
				</div>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Access Function Dashboard
				</h3>
				<p className="mb-6 text-text/90">
					Navigate to your newly created function from the functions list. You'll see
					the function dashboard with various controls and tabs.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Writing Your Script
				</h2>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Create the Main File
				</h3>
				<p className="mb-4 text-text/90">
					In the file manager, click "Create File" and name it according to your
					startup file setting (you can change this later with the "Update Function"
					button).
				</p>

				<h3 className="text-xl font-semibold text-primary mb-4">Add the Code</h3>
				<p className="mb-4 text-text/90">
					Open the file by clicking on it and add the following Discord webhook code:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>{`import requests

def main(args):
    send_data = {"content": "Happy Monday, @everyone! Let's make this week productive and positive! 🌟"}
    webhook_url = "Your Discord Webhook"
    
    # Get webhook information
    response = requests.get(webhook_url)
    if response.status_code == 200:
        print("Webhook is valid!")
        webhook_info = response.json()
        username = webhook_info.get("name", "Default")
        username += " (via SHSF)"
        requests.post(webhook_url, json={"username": username, **send_data})
        print("Done!")
    else:
        print("Invalid webhook URL. Please check the URL.")
        
    return {"message": "Monday greeting sent!"}`}</code>
				</pre>

				<h3 className="text-xl font-semibold text-primary mb-4">Save Your Work</h3>
				<p className="mb-6 text-text/90">
					Click the save button at the top of the editor, near the run button, to
					save your changes.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Managing Dependencies
				</h2>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Install Required Packages
				</h3>
				<p className="mb-4 text-text/90">
					Our script uses the <code>requests</code> library, which might not be
					installed by default. Let's add it to our dependencies.
				</p>
				<p className="mb-4 text-text/90">
					Create a file named <code>requirements.txt</code> and set its content to:
				</p>
				<pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-6">
					<code>requests</code>
				</pre>
				<p className="mb-6 text-text/90">
					Save the requirements file. SHSF will automatically install these
					dependencies when your function runs.
				</p>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Setting Up Automation
				</h2>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Navigate to Triggers
				</h3>
				<p className="mb-4 text-text/90">
					Head over to the "Triggers" tab in your function dashboard.
				</p>
				<div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
					<p className="text-sm text-blue-300">
						<strong>Fun fact:</strong> Triggers can also be HTTP events! Enable "Allow
						HTTP" in function settings to create a webhook URL for your function.
					</p>
				</div>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Create a Scheduled Trigger
				</h3>
				<p className="mb-4 text-text/90">
					Click "Create Trigger" and provide a name and description for your Monday
					greeting trigger.
				</p>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Configure the Schedule
				</h3>
				<p className="mb-4 text-text/90">
					Set the cron expression to <code>0 0 * * 1</code> to run every Monday at
					midnight.
				</p>
				<div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
					<p className="text-sm text-blue-300">
						<strong>Tip:</strong> You can use the preset options for common schedules
						- really handy for beginners!
					</p>
				</div>

				<h3 className="text-xl font-semibold text-primary mb-4">
					Finalize the Trigger
				</h3>
				<p className="mb-6 text-text/90">
					No JSON data is needed for this example. Make sure "Enabled" is checked and
					click "Create Trigger".
				</p>

				<div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
					<p className="text-yellow-300">
						<strong>⚠️ Important:</strong> Don't forget to replace "Your Discord
						Webhook" with your actual Discord webhook URL in the code!
					</p>
				</div>

				<h2 className="text-2xl font-bold text-primary mt-8 mb-6">
					Testing Your Function
				</h2>
				<p className="mb-4 text-text/90">
					Let's test our function! Click the "Run" button in the function dashboard.
				</p>
				<p className="mb-6 text-text/90">
					It's normal to get an error on the first run - wait a minute or two for
					dependency installation (timing depends on your system performance). Run it
					again after installation completes, and you should see your Discord message
					appear!
				</p>

				<div className="mt-8 p-6 bg-green-900/20 border border-green-500/30 rounded-lg">
					<h3 className="text-lg font-semibold text-green-300 mb-3">
						🎉 What You've Accomplished
					</h3>
					<ul className="space-y-2 text-green-200">
						<li>• Created and configured your first SHSF function</li>
						<li>• Managed files in the function environment</li>
						<li>• Installed Python dependencies automatically</li>
						<li>• Set up scheduled triggers with cron expressions</li>
						<li>• Tested and debugged your function</li>
						<li>• Integrated with external services (Discord webhooks)</li>
					</ul>
				</div>

				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						🚀 Next Steps - Data Passing
					</h2>
					<p className="text-text/90 mb-4">
						Now that you've created your first function, let's explore how to pass
						data between triggers/HTTP requests and functions using JSON payloads.
					</p>
					<a
						href="/docs/data-passing"
						className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
					>
						#2 Data Passing
						<span className="text-lg">→</span>
					</a>
				</div>
			</div>
		</div>
	);
};
