export interface TimingEntry {
	timestamp: number;
	value: number;
	description: string;
}

export type RunMode = "classic" | "streaming";

export interface HtmlResultContent {
	headers: Record<string, string>;
	html: string;
	code: number;
}

export interface ImageResultContent {
	headers: Record<string, string>;
	code: number;
	src: string;
	contentType: string;
}

export interface ValueResultContent {
	title: string;
	value: unknown;
	type: string;
}

export type PopupResult =
	| ({ kind: "html" } & HtmlResultContent)
	| ({ kind: "image" } & ImageResultContent);
