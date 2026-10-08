export function isFunctionOwnedByUser(
	functionData: { id: number; userId: number } | null,
	userId: number,
): functionData is { id: number; userId: number } {
	return functionData !== null && functionData.userId === userId;
}
