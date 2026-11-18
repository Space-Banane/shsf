export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

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

/** Parses `page`/`limit` query params, clamped to a bounded page size. */
export function parsePagination(queries: { get(key: string): string | null }): PaginationQuery {
	const page = Math.max(1, Number(queries.get("page") ?? 1) || 1);
	const limit = Math.min(
		MAX_PAGE_SIZE,
		Math.max(1, Number(queries.get("limit") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
	);
	return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginationMeta(page: number, limit: number, total: number): PaginationMeta {
	return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
