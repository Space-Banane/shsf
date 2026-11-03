import type { FunctionFile, Trigger } from "../../types/Prisma";

/** Which dialog is open on the function page, with the target it acts on. */
export type FunctionModal =
	| { type: "settings" }
	| { type: "env" }
	| { type: "guests" }
	| { type: "git" }
	| { type: "ai" }
	| { type: "loadDefault" }
	| { type: "dependencies" }
	| { type: "createFile"; parentPath: string }
	| {
			type: "folder";
			mode: "create" | "rename";
			parentPath: string;
			targetPath: string;
	  }
	| { type: "renameFile"; file: FunctionFile }
	| { type: "deleteFile"; file: FunctionFile }
	| { type: "createTrigger" }
	| { type: "editTrigger"; trigger: Trigger }
	| { type: "deleteTrigger"; trigger: Trigger };
