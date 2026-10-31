import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LogAnalysisBadge, LogAnalysisDetails, LogAnalysisPanel } from "./LogAnalysis";
import type { ExecutionAnalyticsItem, ExecutionLogAnalysis, LogAnalysisSummary } from "../types/Analytics";

const completed: ExecutionLogAnalysis = {
	status: "completed", failureProbability: 0.92, failureDetected: true, attentionPriority: 8,
	attentionConfidence: 0.15, model: "vendor/decider", error: null, costUsd: 0.00002, analyzedAt: "2026-10-01T00:00:00.000Z",
	attentionDistribution: { "7": 0.4, "8": 0.6, "9": 0.001 },
};

const emptySummary: LogAnalysisSummary = {
	analyzed: 0, pending: 0, unavailable: 0, notAnalyzed: 4, failureSignals: 0,
	priorityDistribution: Array(10).fill(0), avgConfidence: null, costUsd: 0, highPriority: [],
};

describe("LogAnalysis components", () => {
	it("distinguishes not analyzed, pending, failed, and completed low-confidence results", () => {
		const { container, rerender } = render(<LogAnalysisBadge analysis={null} />);
		expect(container).toBeEmptyDOMElement();
		rerender(<LogAnalysisBadge analysis={{ ...completed, status: "pending", attentionPriority: null }} />);
		expect(screen.getByText("Analysis queued")).toBeInTheDocument();
		rerender(<LogAnalysisBadge analysis={{ ...completed, status: "failed", attentionPriority: null, error: "OpenRouter rejected the API key." }} />);
		expect(screen.getByText("Analysis failed")).toHaveAttribute("title", "OpenRouter rejected the API key.");
		rerender(<LogAnalysisBadge analysis={completed} />);
		expect(screen.getByText("P8 · failure signal")).toBeInTheDocument();
	});

	it("shows per-execution details as advisory with model and confidence", () => {
		render(<LogAnalysisDetails analysis={completed} />);
		expect(screen.getByText("8 / 10")).toBeInTheDocument();
		expect(screen.getByText("92%")).toBeInTheDocument();
		expect(screen.getByText("15%")).toBeInTheDocument();
		expect(screen.getByText("vendor/decider")).toBeInTheDocument();
		expect(screen.getByText("P7 40% · P8 60%")).toBeInTheDocument();
		expect(screen.getByText(/exit code above is the recorded result/)).toBeInTheDocument();
	});

	it("explains unavailable details and never-analyzed logs", () => {
		const { rerender } = render(<LogAnalysisDetails analysis={null} />);
		expect(screen.getByText(/Not analyzed/)).toBeInTheDocument();
		rerender(<LogAnalysisDetails analysis={{ ...completed, status: "skipped", error: "No OpenRouter API key is configured." }} />);
		expect(screen.getByText("Analysis unavailable: No OpenRouter API key is configured.")).toBeInTheDocument();
	});

	it("keeps the dashboard usable with no analysis data", () => {
		render(<MemoryRouter><LogAnalysisPanel summary={emptySummary} /></MemoryRouter>);
		expect(screen.getByText(/off by default/)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Set it up" })).toHaveAttribute("href", "/account#log-analysis");
	});

	it("summarizes signals, distribution, failures, and high-priority executions", () => {
		const execution = { executionId: 9, functionId: 3, functionName: "billing", createdAt: "2026-10-01T00:00:00.000Z", exitCode: 0, analysis: completed } as ExecutionAnalyticsItem;
		const priorityDistribution = Array(10).fill(0);
		priorityDistribution[7] = 1;
		render(<MemoryRouter><LogAnalysisPanel summary={{ ...emptySummary, analyzed: 1, unavailable: 2, pending: 1, failureSignals: 1, priorityDistribution, avgConfidence: 0.15, costUsd: 0.00002, highPriority: [execution] }} /></MemoryRouter>);
		expect(screen.getByRole("img", { name: /P8 1/ })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "billing" })).toHaveAttribute("href", "/functions/3");
		expect(screen.getByText("Exit 0")).toBeInTheDocument();
		expect(screen.getByText(/Success rate above uses exit codes only/)).toBeInTheDocument();
		expect(screen.getByText("Unavailable").nextSibling).toHaveTextContent("2");
	});
});
