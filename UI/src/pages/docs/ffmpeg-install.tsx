import React from "react";
import { ScrollProgressbar } from "../../components/motion/ScrollProgressbar";

export const FfmpegInstallPage = () => {
  return (
    <div className="min-h-screen bg-background text-text p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <a href="/docs" className="text-sm text-blue-500 hover:underline">
            ← Back to docs
          </a>
        </div>

        <ScrollProgressbar />

        <h1 className="text-3xl font-bold text-primary mb-2">
          FFmpeg Installation
        </h1>

        <p className="mt-3 text-lg text-text/90 mb-6">
          Enable the <b>Install FFmpeg</b> option to automatically install
          FFmpeg in your function's container environment. This is perfect for
          functions that need to process video, audio, or other media files.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          What is FFmpeg?
        </h2>
        <p className="mb-4 text-text/90">
          FFmpeg is a powerful multimedia framework that can decode, encode,
          transcode, mux, demux, stream, filter, and play almost any media
          format. It's widely used for video and audio processing tasks.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          How to Enable
        </h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>
            When creating or updating a function, toggle the{" "}
            <b>Install FFmpeg</b> option in the advanced settings section of the
            modal.
          </li>
          <li>
            During container initialization, SHSF will check if FFmpeg is
            installed and install it automatically if needed.
          </li>
          <li>
            The installation happens once when the container is first created or
            when the setting is toggled on.
          </li>
        </ul>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Example Use Cases
        </h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>
            Converting video formats (e.g., MP4 to WebM, AVI to MP4).
          </li>
          <li>Extracting audio from video files.</li>
          <li>
            Generating video thumbnails or creating GIFs from videos.
          </li>
          <li>Compressing or resizing media files.</li>
          <li>Adding watermarks or overlays to videos.</li>
        </ul>

        <h3 className="text-xl font-semibold text-primary mt-8 mb-2">
          Example: Convert Video to WebM
        </h3>
        <div className="mb-8">
          <pre className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white rounded-lg p-6 overflow-x-auto text-sm shadow-lg">
            {`def main(args):
    import subprocess
    import base64
    
    # Get base64 encoded video from payload
    video_data = base64.b64decode(args.get("video"))
    
    # Write input file
    with open("/app/input.mp4", "wb") as f:
        f.write(video_data)
    
    # Convert to WebM using FFmpeg
    result = subprocess.run([
        "ffmpeg", "-i", "/app/input.mp4",
        "-c:v", "libvpx-vp9",
        "-crf", "30",
        "-b:v", "0",
        "/app/output.webm"
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        return {"error": result.stderr}
    
    # Read and return the converted file
    with open("/app/output.webm", "rb") as f:
        output_data = base64.b64encode(f.read()).decode()
    
    return {
        "success": True,
        "video": output_data,
        "format": "webm"
    }`}
          </pre>
          <p className="text-text/80 mt-2">
            This example shows how to use FFmpeg to convert an MP4 video to WebM
            format. The function receives a base64-encoded video, processes it
            with FFmpeg, and returns the converted result.
          </p>
        </div>

        <h3 className="text-xl font-semibold text-primary mt-8 mb-2">
          Example: Generate Video Thumbnail
        </h3>
        <div className="mb-8">
          <pre className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white rounded-lg p-6 overflow-x-auto text-sm shadow-lg">
            {`def main(args):
    import subprocess
    import base64
    
    # Get video URL or base64 data
    video_url = args.get("video_url")
    
    # Generate thumbnail at 5 seconds
    result = subprocess.run([
        "ffmpeg", "-i", video_url,
        "-ss", "00:00:05",
        "-vframes", "1",
        "-vf", "scale=320:180",
        "/app/thumbnail.jpg"
    ], capture_output=True, text=True)
    
    if result.returncode != 0:
        return {"error": result.stderr}
    
    # Read and return thumbnail
    with open("/app/thumbnail.jpg", "rb") as f:
        thumbnail_data = base64.b64encode(f.read()).decode()
    
    return {
        "success": True,
        "thumbnail": thumbnail_data,
        "timestamp": "5s"
    }`}
          </pre>
          <p className="text-text/80 mt-2">
            This example extracts a thumbnail from a video at the 5-second mark,
            scales it to 320x180 pixels, and returns it as a base64-encoded JPEG.
          </p>
        </div>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Installation Details
        </h2>
        <p className="mb-4 text-text/90">
          When FFmpeg installation is enabled, SHSF runs the following command
          during container initialization:
        </p>
        <div className="mb-6">
          <pre className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white rounded-lg p-4 overflow-x-auto text-sm">
            {`command -v ffmpeg || sudo apt-get install -y ffmpeg`}
          </pre>
        </div>
        <p className="mb-4 text-text/90">
          This command checks if FFmpeg is already installed and only installs it
          if it's not found. The installation is cached in the container, so
          subsequent executions are fast.
        </p>

        <h2 className="text-2xl font-bold text-primary mt-6 mb-4">
          Performance Considerations
        </h2>
        <ul className="list-disc list-inside mb-4 text-text/90">
          <li>
            FFmpeg operations can be CPU and memory intensive. Make sure to
            allocate sufficient resources to your function.
          </li>
          <li>
            The first run after enabling FFmpeg installation will be slower due
            to the installation process.
          </li>
          <li>
            Consider using the <code>/app</code> directory for temporary files
            during processing; <code>/tmp</code> is very experimental.
          </li>
          <li>
            For large media files, you may need to increase the function timeout
            setting.
          </li>
        </ul>

        <div className="mt-12 p-6 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-600/30 rounded-xl">
          <h2 className="text-xl font-bold text-purple-400 mb-3">
            🎬 Media Processing Made Easy
          </h2>
          <p className="text-text/90 mb-4">
            With FFmpeg installed, your functions can handle complex media
            processing tasks without any additional setup. Just toggle the option
            and start processing!
          </p>
        </div>

        <div className="mt-10 mb-8 p-4 bg-yellow-100/10 border border-yellow-400/30 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-700 mb-2 flex items-center gap-2">
            🛠️ Troubleshooting: FFmpeg Install Failed?
          </h3>
          <p className="text-text/90 mb-2">
            If FFmpeg installation fails or you need to force a reinstall, you can remove the install marker file from the function container:
          </p>
          <pre className="bg-gray-900 text-yellow-100 rounded p-3 text-sm overflow-x-auto">
            {`docker exec -it shsf_func_{FUNCTION_ID} rm /app/.already_installed_ffmpeg`}
          </pre>
          <p className="text-text/80 mt-2">
            Replace <code>{`{FUNCTION_ID}`}</code> with your function's ID (visible in the URL). On next run, FFmpeg will be reinstalled automatically.
          </p>
        </div>

        <div className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-primary/30 rounded-xl">
          <h2 className="text-xl font-bold text-primary mb-3">
            📚 Keep Your Instance Updated
          </h2>
          <p className="text-text/90 mb-4">
            This is the latest documentation available. Make sure to keep your
            SHSF instance updated to get access to new features and improvements!
          </p>
        </div>
      </div>
    </div>
  );
};
