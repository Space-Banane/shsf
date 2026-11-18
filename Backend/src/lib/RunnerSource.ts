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

async function writeFileIfChanged(filePath: string, content: string | Buffer): Promise<boolean> {
	const next = typeof content === "string" ? Buffer.from(content, "utf8") : content;
	try {
		const current = await fs.readFile(filePath);
		if (current.equals(next)) return false;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}

	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, content);
	return true;
}

export async function prepareRunnerSource({ functionData, files, funcAppDir, runtimeType, mark, trace }: {
	functionData: Function; files: FunctionFile[]; funcAppDir: string;
	runtimeType: ReturnType<typeof getRuntimeType>; mark: (description: string) => void; trace: (message: string) => void;
}) {
	const startupFile = functionData.startup_file;
	let initScript = "#!/bin/sh\nset -e\necho '[SHSF INIT] Starting environment setup...'\ncd /app\n";
	// Skip writing User files when git version control is active (git_url is set)
	if (!functionData.git_url) {
		// Write only files whose content actually changed; unchanged source is
		// left untouched so a repeat invocation does not rewrite the whole app.
		let written = 0;
		await Promise.all(
			files.map(async (file) => {
				const filePath = path.join(funcAppDir, file.name);
				let content: string | Buffer = file.content;
				if (typeof content === "string") {
					content = replaceApiBaseInContent(content, functionData.namespaceId, functionData.executionId);
				}
				if (await writeFileIfChanged(filePath, content)) written++;
			})
		);
		mark(written > 0 ? `Write user files (${files.length})` : "User files unchanged");
	} else {
		log.info({ functionId: functionData.id }, "[GIT] Git source active — skipping DB file writes");
		mark(`Skip DB file writes (git_url set)`);
	}

	// For Go runtime, generate the runner wrapper file and go.mod if needed
	let scriptsChanged = false;
	if (runtimeType === "golang") {
		if (await writeFileIfChanged(path.join(funcAppDir, "shsf_runner.go"), generateGoRunnerWrapperCode())) {
			scriptsChanged = true;
		}

		const goModPath = path.join(funcAppDir, "go.mod");
		if (!fsSync.existsSync(goModPath)) {
			await fs.writeFile(goModPath, `module shsf_function_${functionData.id}\n\ngo 1.23\n`);
			scriptsChanged = true;
		}
		trace("Go runner wrapper written");
	}

	// Regenerate the runner scripts only when their generated content changed.
	if (runtimeType === "python") {
		const wrapperPath = path.join(funcAppDir, "_runner.py");
		if (await writeFileIfChanged(wrapperPath, generatePythonRunnerScript(startupFile ?? "main"))) {
			await fs.chmod(wrapperPath, "755");
			scriptsChanged = true;
		}
		trace("Python runner script written");
	} else if (runtimeType === "golang") {
		const wrapperPath = path.join(funcAppDir, "_runner.sh");
		if (await writeFileIfChanged(wrapperPath, generateGoRunnerShScript())) {
			await fs.chmod(wrapperPath, "755");
			scriptsChanged = true;
		}
		trace("Go runner script written");  // intermediate — mark fires after init.sh below
	} else if (runtimeType === "node") {
		const jsRunnerPath = path.join(funcAppDir, "_shsf_runner.js");
		if (await writeFileIfChanged(jsRunnerPath, generateNodeJsRunnerScript(startupFile ?? "index.js"))) {
			scriptsChanged = true;
		}
		const shWrapperPath = path.join(funcAppDir, "_runner.sh");
		if (await writeFileIfChanged(shWrapperPath, generateNodeJsRunnerShScript())) {
			await fs.chmod(shWrapperPath, "755");
			scriptsChanged = true;
		}
		trace("Node.js runner scripts written");
	} else {
		log.warn({ runtimeType, functionId: functionData.id }, "Runner script generation skipped: unsupported runtime type");
	}

	// Regenerate init.sh only when its inputs (flags, function id, templates) changed.
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
	const initPath = path.join(funcAppDir, "init.sh");
	if (await writeFileIfChanged(initPath, initScript)) {
		await fs.chmod(initPath, "755");
		scriptsChanged = true;
	}
	mark(scriptsChanged ? "Generate scripts" : "Scripts unchanged"); // runner script(s) + init.sh

	const requiresDbCom = files.some((f) => f.content.includes("_db_com") || f.content.includes("dbcom"));
	if (requiresDbCom) {
		let helperChanged = false;
		if (runtimeType === "python") {
			helperChanged = await writeFileIfChanged(path.join(funcAppDir, "_db_com.py"), DbComScriptPY);
			if (helperChanged) await fs.chmod(path.join(funcAppDir, "_db_com.py"), "755");
		} else if (runtimeType === "golang") {
			const dbComDir = path.join(funcAppDir, "dbcom");
			await fs.mkdir(dbComDir, { recursive: true });
			helperChanged = await writeFileIfChanged(path.join(dbComDir, "dbcom.go"), DbComScriptGO);
		} else if (runtimeType === "node") {
			helperChanged = await writeFileIfChanged(path.join(funcAppDir, "_db_com.js"), DbComScriptJS);
		}
		if (helperChanged) mark("Storage helper script");
	}

	// Always inject the callF helper so functions can call each other without
	// any conditional check — the scripts are small and immediately available.
	if (runtimeType === "python") {
		const callFuncPath = path.join(funcAppDir, "_call_func.py");
		if (await writeFileIfChanged(callFuncPath, CallFuncScriptPY)) {
			await fs.chmod(callFuncPath, "755");
		}
	} else if (runtimeType === "golang") {
		const callFuncDir = path.join(funcAppDir, "callfunc");
		await fs.mkdir(callFuncDir, { recursive: true });
		await writeFileIfChanged(path.join(callFuncDir, "callfunc.go"), CallFuncScriptGO);
	} else if (runtimeType === "node") {
		await writeFileIfChanged(path.join(funcAppDir, "_call_func.js"), CallFuncScriptJS);
	}

}
