import { prisma, API_URL } from "..";

export async function getFunctionExecInfo(functionId: number) {
    return prisma.function.findUnique({
        where: { id: functionId },
        select: { namespaceId: true, executionId: true },
    });
}

export function buildApiBase(namespaceId: number, executionId: string) {
    if (!API_URL) return `/api/exec/${namespaceId}/${executionId}`;
    return API_URL.replace(/\/+$/, "") + `/api/exec/${namespaceId}/${executionId}`;
}

export function replaceApiBaseInContent(content: string | Buffer, namespaceId: number, executionId: string): string | Buffer {
    if (typeof content !== "string") return content;
    if (!content.includes("{{API_BASE}}")) return content;
    const apiBase = buildApiBase(namespaceId, executionId);
    return content.split("{{API_BASE}}").join(apiBase);
}

export async function replaceApiBaseUsingFunction(functionId: number, content: string | Buffer) {
    const info = await getFunctionExecInfo(functionId);
    if (!info) return content;
    return replaceApiBaseInContent(content, info.namespaceId, info.executionId);
}

export default {
    getFunctionExecInfo,
    buildApiBase,
    replaceApiBaseInContent,
    replaceApiBaseUsingFunction,
};
