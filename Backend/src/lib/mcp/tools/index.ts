import getDocs from "./get_docs";
import getInstanceInfo from "./get_instance_info";
import listNamespaces from "./list_namespaces";
import createNamespace from "./create_namespace";
import renameNamespace from "./rename_namespace";
import deleteNamespace from "./delete_namespace";
import listFunctions from "./list_functions";
import getFunction from "./get_function";
import createFunction from "./create_function";
import updateFunction from "./update_function";
import deleteFunction from "./delete_function";
import executeFunction from "./execute_function";
import listFiles from "./list_files";
import readFile from "./read_file";
import writeFile from "./write_file";
import deleteFile from "./delete_file";
import renameFile from "./rename_file";
import { McpToolDef } from "./shared";

export type { McpToolResult, ToolContext, ToolHandler, McpToolDef } from "./shared";

export const tools: McpToolDef[] = [
	getDocs,
	getInstanceInfo,
	listNamespaces,
	createNamespace,
	renameNamespace,
	deleteNamespace,
	listFunctions,
	getFunction,
	createFunction,
	updateFunction,
	deleteFunction,
	executeFunction,
	listFiles,
	readFile,
	writeFile,
	deleteFile,
	renameFile,
];

export const toolMap = new Map<string, McpToolDef>(tools.map((t) => [t.name, t]));
