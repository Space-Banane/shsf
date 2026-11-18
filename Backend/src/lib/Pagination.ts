export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 1_000_000;

export interface PaginationQuery {
	page: number;
	limit: number;
	skip: number;
	take: number;
}

export interface PaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

function positiveInteger(raw: string | null, fallback: number, max: number): number {
	if (raw === null || raw.trim() === "") return fallback;
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) return fallback;
	return Math.min(max, Math.max(1, Math.floor(value)));
}

/** Parses `page`/`limit` query params, clamped to a bounded page size. */
export function parsePagination(queries: { get(key: string): string | null }): PaginationQuery {
	const page = positiveInteger(queries.get("page"), 1, MAX_PAGE);
	const limit = positiveInteger(queries.get("limit"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
	return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
	return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
