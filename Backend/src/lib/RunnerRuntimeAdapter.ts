import { getRuntimeType } from "./RunnerUtils";

export function getRuntimeCommand(runtimeType: ReturnType<typeof getRuntimeType>, payloadPath: string, resultPath: string): string[] {
	if (runtimeType === "python") return ["/bin/sh", "/app/_runner.py", payloadPath, resultPath];
	if (runtimeType === "golang" || runtimeType === "node") return ["/bin/sh", "/app/_runner.sh", payloadPath, resultPath];
	throw new Error(`Unsupported runtime type for exec command: ${runtimeType}`);
}
