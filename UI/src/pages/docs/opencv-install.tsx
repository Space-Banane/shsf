import { DocsContentShell } from "./DocsContentShell";

export const OpencvInstallPage = () => {
	return (
		<DocsContentShell>
				{/* Header */}
				<div className="mb-12">
					<div className="mb-4 flex items-center gap-4">
						<span className="text-teal-400 font-mono text-sm">#24</span>
					</div>
					<h1 className="text-4xl text-left font-bold text-primary mb-4 flex items-center gap-3">
						<span className="text-5xl">👁️</span> OpenCV Installation
					</h1>
					<p className="text-xl text-text/80 leading-relaxed">
						Learn how to enable automatic OpenCV installation for computer vision in your functions.
					</p>
				</div>

				{/* How It Works */}
				<div className="mb-12">
					<h2 className="text-2xl font-bold text-primary mb-4 border-b border-primary/20 pb-2">
						How It Works
					</h2>
					<p className="mb-4 text-text/90">
						When you enable the <strong>Install OpenCV</strong> option, SHSF will
						automatically install <code>python3-opencv</code> inside your function's
						isolated container using <code>apt install</code>. Due to its size, OpenCV is not
						included by default to keep base images small and fast.
					</p>

					<div className="bg-blue-900/10 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
						<p className="text-blue-200 text-sm">
							<strong>Note:</strong> OpenCV installation is currently only supported for
							Python functions (e.g., Python 3.9, 3.11). It is automatically disabled
							for HTML functions.
						</p>
					</div>
				</div>

				{/* Enabling OpenCV */}
				<div className="mb-12">
					<h2 className="text-2xl font-bold text-primary mb-4 border-b border-primary/20 pb-2">
						1. Enabling OpenCV during Creation
					</h2>
					<p className="mb-4 text-text/90">
						When creating a new function, scroll down to the <strong>Install OpenCV</strong> section. Toggle the switch to enable it. Once your function is created, SHSF will execute an initialization script that installs <code>python3-opencv</code> inside the container before your code runs.
					</p>
				</div>

				{/* Updating & Reinstalling */}
				<div className="mb-12">
					<h2 className="text-2xl font-bold text-primary mb-4 border-b border-primary/20 pb-2">
						2. Updating & Reinstalling
					</h2>
					<p className="mb-4 text-text/90">
						You can also enable OpenCV for an existing function:
					</p>
					<ul className="list-disc pl-6 mb-6 space-y-2 text-text/90">
						<li>
							Open the <strong>Update Function</strong> modal for your function.
						</li>
						<li>
							Toggle the <strong>Install OpenCV</strong> switch ON.
						</li>
						<li>
							Click <strong>Update</strong> to apply the changes.
						</li>
					</ul>
					<p className="mb-4 text-text/90">
						If you ever encounter errors with the OpenCV installation (e.g., after the container is restarted without persistent dependencies), you can manually trigger a re-installation.
					</p>

					<div className="bg-gray-800/50 p-6 rounded-lg border border-primary/20 mb-6">
						<h3 className="text-lg font-semibold text-primary mb-3">
							How to manually trigger a reinstall:
						</h3>
						<ul className="list-decimal pl-6 space-y-2 text-text/90">
							<li>
								In the <strong>Update Function</strong> modal, if OpenCV is enabled, a
								<code>🔄 Trigger Reinstall</code> button will appear.
							</li>
							<li>
								Alternatively, on the Function Details page, click the
								<code>👁️ OpenCV</code> button next to the normal Pip Install button.
							</li>
						</ul>
					</div>
					<p className="text-text/90">
						When you trigger a re-installation, SHSF runs the install command natively inside the running container—without pausing or stopping it—so you don't lose any temporary states.
					</p>
				</div>

				{/* Code Example */}
				<div className="mb-12">
					<h2 className="text-2xl font-bold text-primary mb-4 border-b border-primary/20 pb-2">
						3. Using OpenCV in your Code
					</h2>
					<p className="mb-4 text-text/90">
						Once installed, you can simply import and use OpenCV (cv2) in your
						Python scripts:
					</p>
					<pre className="bg-gray-900 text-gray-200 p-4 rounded-lg overflow-x-auto text-sm mb-6">
						<code>{`import cv2
import numpy as np

def main(args):
    # Create a simple blank black image (100x100 RGB)
    image = np.zeros((100, 100, 3), dtype=np.uint8)
    
    # Check if OpenCV is loaded correctly
    version = cv2.__version__
    
    return {
        "status": "success",
        "message": f"OpenCV {version} is ready and working!",
        "image_shape": list(image.shape)
    }`}</code>
					</pre>
				</div>

				{/* Footer / CTA */}
				<div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
					<h2 className="text-xl font-bold text-primary mb-3">
						📚 Keep Your Instance Updated
					</h2>
					<p className="text-text/90 mb-4">
						This is the latest documentation available. Make sure to keep your SHSF
						instance updated to get access to new features and improvements!
					</p>
					<div className="flex flex-wrap gap-4">
						<a
							href="/docs/clone-function"
							className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
						>
							← CLONE FUNCTION
						</a>
						<a
							href="/docs/ffmpeg-install"
							className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors text-sm"
						>
							FFMPEG INSTALLATION →
						</a>
					</div>
				</div>
		</DocsContentShell>
	);
};
