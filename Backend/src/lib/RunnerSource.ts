import { Function, FunctionFile } from "@prisma/client";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { replaceApiBaseInContent } from "./FileHelpers";
import { createLogger } from "./logger";
import { getRuntimeType } from "./RunnerUtils";
import { DbComScriptPY, DbComScriptGO, DbComScriptJS, CallFuncScriptPY, CallFuncScriptGO, CallFuncScriptJS } from "./RunnerScripts";
import { generateGoRunnerWrapperCode, generatePythonRunnerScript, generateGoRunnerShScript, generatePythonInitBody, generateGoInitBody, generateNodeJsRunnerScript, generateNodeJsRunnerShScript, generateNodeJsInitBody } from "./RunnerRuntimeScripts";

const log = createLogger("Runner");

export async function prepareRunnerSource({ functionData, files, funcAppDir, runtimeType, mark, trace }: {
	functionData: Function; files: FunctionFile[]; funcAppDir: string;
	runtimeType: ReturnType<typeof getRuntimeType>; mark: (description: string) => void; trace: (message: string) => void;
}) {
	const startupFile = functionData.startup_file;
	let initScript = "#!/bin/sh\nset -e\necho '[SHSF INIT] Starting environment setup...'\ncd /app\n";
	// Skip writing User files when git version control is active (git_url is set)
	if (!functionData.git_url) {
		// Write files to disk
		await Promise.all(
			files.map(async (file) => {
				const filePath = path.join(funcAppDir, file.name);
				await fs.mkdir(path.dirname(filePath), { recursive: true });
				let content: string | Buffer = file.content;
				if (typeof content === "string") {
					content = replaceApiBaseInContent(content, functionData.namespaceId, functionData.executionId);
				}
				await fs.writeFile(filePath, content);
			})
		);
		mark(`Write user files (${files.length})`);
	} else {
		log.info({ functionId: functionData.id }, "[GIT] Git source active — skipping DB file writes");
		mark(`Skip DB file writes (git_url set)`);
	}

	// For Go runtime, generate the runner wrapper file and go.mod if needed
	if (runtimeType === "golang") {
		await fs.writeFile(path.join(funcAppDir, "shsf_runner.go"), generateGoRunnerWrapperCode());

		const goModPath = path.join(funcAppDir, "go.mod");
		if (!fsSync.existsSync(goModPath)) {
			await fs.writeFile(goModPath, `module shsf_function_${functionData.id}\n\ngo 1.23\n`);
		}
		trace("Go runner wrapper written");
	}

	// Always generate/update the runner script to accept payload file path as argument
	if (runtimeType === "python") {
		const wrapperPath = path.join(funcAppDir, "_runner.py");
		await fs.writeFile(wrapperPath, generatePythonRunnerScript(startupFile ?? "main"));
		await fs.chmod(wrapperPath, "755");
		trace("Python runner script written");
	} else if (runtimeType === "golang") {
		const wrapperPath = path.join(funcAppDir, "_runner.sh");
		await fs.writeFile(wrapperPath, generateGoRunnerShScript());
		await fs.chmod(wrapperPath, "755");
		trace("Go runner script written");  // intermediate — mark fires after init.sh below
	} else if (runtimeType === "node") {
		const jsRunnerPath = path.join(funcAppDir, "_shsf_runner.js");
		await fs.writeFile(jsRunnerPath, generateNodeJsRunnerScript(startupFile ?? "index.js"));
		const shWrapperPath = path.join(funcAppDir, "_runner.sh");
		await fs.writeFile(shWrapperPath, generateNodeJsRunnerShScript());
		await fs.chmod(shWrapperPath, "755");
		trace("Node.js runner scripts written");
	} else {
		log.warn({ runtimeType, functionId: functionData.id }, "Runner script generation skipped: unsupported runtime type");
	}

	// Always generate/update the init.sh script
	if (runtimeType === "python") {
		initScript += generatePythonInitBody(functionData.id, {
			ffmpeg_install: functionData.ffmpeg_install,
			opencv_install: functionData.opencv_install,
		});
	} else if (runtimeType === "golang") {
		initScript += generateGoInitBody(functionData.id, { ffmpeg_install: functionData.ffmpeg_install });
	} else if (runtimeType === "node") {
		initScript += generateNodeJsInitBody(functionData.id, { ffmpeg_install: functionData.ffmpeg_install });
	} else {
		// This was already checked for runner script, but as a safeguard for init.sh:
		log.warn({ runtimeType, functionId: functionData.id }, "init.sh script generation skipped: unsupported runtime type");
	}

	initScript +=
		"\necho '[SHSF INIT] Environment setup finished successfully.'\n";
	await fs.writeFile(path.join(funcAppDir, "init.sh"), initScript);
	await fs.chmod(path.join(funcAppDir, "init.sh"), "755");
	mark("Generate scripts"); // runner script(s) + init.sh

	const requiresDbCom = files.some((f) => f.content.includes("_db_com") || f.content.includes("dbcom"));
	if (requiresDbCom) {
		if (runtimeType === "python") {
			await fs.writeFile(path.join(funcAppDir, "_db_com.py"), DbComScriptPY);
			await fs.chmod(path.join(funcAppDir, "_db_com.py"), "755");
		} else if (runtimeType === "golang") {
			const dbComDir = path.join(funcAppDir, "dbcom");
			await fs.mkdir(dbComDir, { recursive: true });
			await fs.writeFile(path.join(dbComDir, "dbcom.go"), DbComScriptGO);
		} else if (runtimeType === "node") {
			await fs.writeFile(path.join(funcAppDir, "_db_com.js"), DbComScriptJS);
		}
		mark("Storage helper script");
	}

	// Always inject the callF helper so functions can call each other without
	// any conditional check — the scripts are small and immediately available.
	if (runtimeType === "python") {
		await fs.writeFile(path.join(funcAppDir, "_call_func.py"), CallFuncScriptPY);
		await fs.chmod(path.join(funcAppDir, "_call_func.py"), "755");
	} else if (runtimeType === "golang") {
		const callFuncDir = path.join(funcAppDir, "callfunc");
		await fs.mkdir(callFuncDir, { recursive: true });
		await fs.writeFile(path.join(callFuncDir, "callfunc.go"), CallFuncScriptGO);
	} else if (runtimeType === "node") {
		await fs.writeFile(path.join(funcAppDir, "_call_func.js"), CallFuncScriptJS);
	}

}
