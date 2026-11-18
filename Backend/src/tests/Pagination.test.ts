import { describe, expect, it } from "vitest";
import {
	DEFAULT_PAGE_SIZE,
	MAX_PAGE_SIZE,
	paginationMeta,
	parsePagination,
} from "../lib/Pagination";

function queries(values: Record<string, string>) {
	return {
		get(key: string) {
			return values[key] ?? null;
		},
	};
}

describe("parsePagination", () => {
	it("defaults to the first page with the default page size", () => {
		expect(parsePagination(queries({}))).toEqual({
			page: 1,
			limit: DEFAULT_PAGE_SIZE,
			skip: 0,
			take: DEFAULT_PAGE_SIZE,
		});
	});

	it("applies page and limit to skip/take", () => {
		expect(parsePagination(queries({ page: "3", limit: "10" }))).toEqual({
			page: 3,
			limit: 10,
			skip: 20,
			take: 10,
		});
	});

	it("clamps invalid and oversized values", () => {
		expect(parsePagination(queries({ page: "-2", limit: "1000" }))).toMatchObject({
			page: 1,
			limit: MAX_PAGE_SIZE,
			skip: 0,
		});
		expect(parsePagination(queries({ page: "abc", limit: "0" }))).toMatchObject({
			page: 1,
			limit: DEFAULT_PAGE_SIZE,
		});
	});
});

describe("paginationMeta", () => {
	it("reports totals and page count", () => {
		expect(paginationMeta(2, 25, 60)).toEqual({
			page: 2,
			limit: 25,
			total: 60,
			totalPages: 3,
		});
	});
});
