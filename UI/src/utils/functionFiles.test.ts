import JSZip from "jszip";
import { toast } from "react-toastify";
import {
	buildCliPullCommand,
	extractZipFiles,
	getDefaultLanguage,
	isHtmlOnlyFunction,
	normalizeZipEntryName,
} from "./functionFiles";
import { importDroppedFiles, notifyUploadOutcome } from "./functionUpload";
import { buildFunctionExport } from "./functionExport";
import type { FunctionFile, Trigger, XFunction } from "../types/Prisma";

vi.mock("react-toastify", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("..", () => ({ BASE_URL: "", PUBLIC_BASE_URL: "http://localhost" }));

describe("function file helpers", () => {
	it("picks an editor language from the name or extension", () => {
		expect(getDefaultLanguage("main.py")).toBe("python");
		expect(getDefaultLanguage("go.mod")).toBe("go");
		expect(getDefaultLanguage("Dockerfile")).toBe("dockerfile");
		expect(getDefaultLanguage("notes.unknown")).toBe("plaintext");
	});

	it("detects HTML-only functions from the startup file", () => {
		expect(isHtmlOnlyFunction({ startup_file: "Index.HTML" })).toBe(true);
		expect(isHtmlOnlyFunction({ startup_file: "main.py" })).toBe(false);
		expect(isHtmlOnlyFunction(null)).toBe(false);
	});

	it("builds a CLI pull command with a slugged folder name", () => {
		expect(buildCliPullCommand({ id: 7, name: " My Cool Func! " })).toBe(
			"shsf remote pull --id 7 --into ./my-cool-func --force",
		);
		expect(buildCliPullCommand({ id: 1, name: "!!!" })).toBe(
			"shsf remote pull --id 1 --into ./my-func --force",
		);
	});

	it("rejects zip entries that escape the function directory", () => {
		expect(normalizeZipEntryName("src\\main.py")).toBe("src/main.py");
		expect(normalizeZipEntryName("./a//b.txt")).toBe("a/b.txt");
		expect(normalizeZipEntryName("../evil.py")).toBeNull();
		expect(normalizeZipEntryName("a/../../evil.py")).toBeNull();
		expect(normalizeZipEntryName("C:/windows.txt")).toBeNull();
		expect(normalizeZipEntryName("   ")).toBeNull();
	});
});

describe("importDroppedFiles", () => {
	const persist = vi.fn(async (name: string) => ({ success: true as const, name }));

	beforeEach(() => vi.clearAllMocks());

	const zipFile = async (entries: Record<string, string>) => {
		const zip = new JSZip();
		for (const [name, content] of Object.entries(entries)) zip.file(name, content);
		const bytes = await zip.generateAsync({ type: "uint8array" });
		return new File([bytes as BlobPart], "bundle.zip");
	};

	it("unpacks zips, skipping unsafe entries, existing names and wrong types", async () => {
		const bundle = await zipFile({
			"a.html": "<p>a</p>",
			"b.py": "print(1)",
			"taken.html": "x",
		});
		const outcome = await importDroppedFiles({
			droppedFiles: [bundle],
			unzipArchives: true,
			existingNames: new Set(["taken.html"]),
			htmlOnly: true,
			persistFile: persist,
		});

		expect(outcome.created).toEqual(["a.html"]);
		expect(outcome.skippedInvalidType).toEqual(["b.py"]);
		expect(outcome.skippedExisting).toEqual(["taken.html"]);
		expect(persist).toHaveBeenCalledTimes(1);
	});

	it("skips zips when unzipping is off and reports it", async () => {
		const outcome = await importDroppedFiles({
			droppedFiles: [await zipFile({ "a.py": "1" })],
			unzipArchives: false,
			existingNames: new Set(),
			htmlOnly: false,
			persistFile: persist,
		});
		expect(outcome.skippedZipFiles).toEqual(["bundle.zip"]);
		expect(persist).not.toHaveBeenCalled();

		notifyUploadOutcome(outcome);
		expect(toast.error).toHaveBeenCalledWith(
			"bundle.zip was skipped because Auto Unzip Files is off.",
		);
	});

	it("does not create the same name twice within one drop", async () => {
		const outcome = await importDroppedFiles({
			droppedFiles: [new File(["1"], "a.py"), new File(["2"], "a.py")],
			unzipArchives: true,
			existingNames: new Set(),
			htmlOnly: false,
			persistFile: persist,
		});
		expect(outcome.created).toEqual(["a.py"]);
		expect(outcome.skippedExisting).toEqual(["a.py"]);
	});

	it("reports per-file persistence failures", async () => {
		const outcome = await importDroppedFiles({
			droppedFiles: [new File(["1"], "a.py")],
			unzipArchives: true,
			existingNames: new Set(),
			htmlOnly: false,
			persistFile: async () => ({ success: false, message: "nope" }),
		});
		expect(outcome.created).toEqual([]);
		expect(toast.error).toHaveBeenCalledWith("Failed to create a.py: nope");
	});

	it("summarises created files", () => {
		notifyUploadOutcome({
			created: ["a", "b"],
			skippedExisting: [],
			skippedInvalidType: [],
			skippedZipEntries: [],
			skippedZipFiles: [],
		});
		expect(toast.success).toHaveBeenCalledWith("Created 2 files");
	});
});

describe("extractZipFiles", () => {
	it("returns file contents and the entries it had to skip", async () => {
		const zip = new JSZip();
		zip.file("ok.txt", "hello");
		zip.file("C:/bad.txt", "nope");
		const bytes = await zip.generateAsync({ type: "uint8array" });
		const { extracted, skippedEntries } = await extractZipFiles(new File([bytes as BlobPart], "z.zip"));
		expect(extracted).toEqual([{ name: "ok.txt", content: "hello" }]);
		expect(skippedEntries).toEqual(["C:/bad.txt"]);
	});
});

describe("buildFunctionExport", () => {
	const fn = {
		name: "demo",
		description: "d",
		image: "python:3.12",
		startup_file: "main.py",
		docker_mount: false,
		network_restricted: true,
		ffmpeg_install: false,
		max_ram: 128,
		timeout: 30,
		allow_http: true,
		env: JSON.stringify([{ name: "API_KEY", value: "secret" }, { name: "TOKEN", value: "s2" }]),
	} as unknown as XFunction;

	it("exports env names but never env values", () => {
		const data = buildFunctionExport({
			functionData: fn,
			files: [{ name: "main.py", content: "print(1)", id: 1 } as FunctionFile],
			triggers: [
				{ name: "t", description: "", cron: "* * * * *", data: "{}", enabled: true, id: 9 } as Trigger,
			],
			version: "2.1.0",
		});

		expect(data.env_keys).toEqual(["API_KEY", "TOKEN"]);
		expect(JSON.stringify(data)).not.toContain("secret");
		expect(data.files).toEqual([{ name: "main.py", content: "print(1)" }]);
		expect(data.triggers).toEqual([
			{ name: "t", description: "", cron: "* * * * *", data: "{}", enabled: true },
		]);
		expect(data.settings).toEqual({ max_ram: 128, timeout: 30, allow_http: true });
	});

	it("omits env_keys when the env can't be read", () => {
		const data = buildFunctionExport({
			functionData: { ...fn, env: "not json" } as unknown as XFunction,
			files: [],
			triggers: [],
			version: "",
		});
		expect(data).not.toHaveProperty("env_keys");
	});
});
