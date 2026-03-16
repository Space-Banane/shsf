import React, { useState } from "react";
import Modal from "./Modal";
import {
massReplace,
getMassReplaceFindings,
} from "../../services/backend.functions";

interface MassReplaceModalProps {
isOpen: boolean;
onClose: () => void;
onSuccess: (message: string) => void;
}

interface Finding {
fileId: number;
fileName: string;
functionName: string;
matches: {
lineNumber: number;
oldLine: string;
newLine: string;
}[];
}

function MassReplaceModal({
isOpen,
onClose,
onSuccess,
}: MassReplaceModalProps) {
const [find, setFind] = useState("");
const [replace, setReplace] = useState("");
const [isLoading, setIsLoading] = useState(false);
const [findings, setFindings] = useState<Finding[] | null>(null);
const [error, setError] = useState<string | null>(null);
const [step, setStep] = useState<"search" | "preview">("search");

const handleSearch = async () => {
setError(null);
if (!find) {
setError("Please enter a string to find");
return;
}

setIsLoading(true);
try {
const result = await getMassReplaceFindings(find, replace);
if (result.status === "OK") {
setFindings(result.data);
setStep("preview");
} else {
setError(result.message);
}
} catch (err: any) {
setError(err.message || "An error occurred during search");
} finally {
setIsLoading(false);
}
};

const handleReplace = async () => {
setError(null);
setIsLoading(true);
try {
const result = await massReplace(find, replace);
if (result.status === "OK") {
onSuccess(result.message);
resetAndClose();
} else {
setError(result.message);
}
} catch (err: any) {
setError(err.message || "An error occurred during replacement");
} finally {
setIsLoading(false);
}
};

const resetAndClose = () => {
setFind("");
setReplace("");
setFindings(null);
setStep("search");
setError(null);
onClose();
};

const handleClose = () => {
if (!isLoading) {
resetAndClose();
}
};

return (
<Modal
isOpen={isOpen}
onClose={handleClose}
title="Mass String Find and Replace"
isLoading={isLoading}
>
<div className="space-y-6">
{step === "search" ? (
<>
<p className="text-sm text-gray-400">
This will find and replace text in all function files you own,
<strong className="text-red-400"> ignoring</strong> functions that
are configured with a Git URL.
</p>

<div className="space-y-2">
<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
Find
</label>
<input
type="text"
placeholder="String to find"
value={find}
onChange={(e) => setFind(e.target.value)}
className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
/>
</div>

<div className="space-y-2">
<label className="flex items-center gap-2 text-sm font-medium text-gray-300">
Replace With
</label>
<input
type="text"
placeholder="Replacement string"
value={replace}
onChange={(e) => setReplace(e.target.value)}
className="w-full p-3 bg-gray-800/50 border border-gray-600/50 text-white rounded-lg focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-300"
/>
</div>
</>
) : (
<div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
<header className="flex justify-between items-center sticky top-0 bg-gray-900/95 py-2 z-10">
<h3 className="text-sm font-semibold text-gray-300">
Preview Changes
</h3>
<span className="text-xs text-gray-400">
{findings?.length || 0} files affected
</span>
</header>

{findings && findings.length > 0 ? (
findings.map((finding) => (
<div
key={finding.fileId}
className="bg-gray-800/30 border border-gray-700/50 rounded-lg overflow-hidden"
>
<div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700/50 flex justify-between items-center">
<span className="text-xs font-medium text-primary">
{finding.functionName} / {finding.fileName}
</span>
</div>
<div className="text-[11px] font-mono leading-tight">
{finding.matches.map((match, idx) => (
<div key={idx} className="border-b border-gray-700/30 last:border-0">
<div className="flex bg-red-900/20 px-2 py-1">
<span className="w-8 text-red-500/50 shrink-0">
{match.lineNumber}
</span>
<span className="text-red-300 break-all">
- {match.oldLine}
</span>
</div>
<div className="flex bg-green-900/20 px-2 py-1">
<span className="w-8 text-green-500/50 shrink-0">
{match.lineNumber}
</span>
<span className="text-green-300 break-all">
+ {match.newLine}
</span>
</div>
</div>
))}
</div>
</div>
))
) : (
<div className="text-center py-8 text-gray-400 italic">
No matches found.
</div>
)}
</div>
)}

{error && (
<div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
{error}
</div>
)}

<div className="flex justify-end gap-3 mt-8">
<button
onClick={handleClose}
disabled={isLoading}
className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
>
Cancel
</button>

{step === "search" ? (
<button
onClick={handleSearch}
disabled={isLoading}
className="px-6 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-50"
>
{isLoading ? "Searching..." : "Preview Findings"}
</button>
) : (
<>
<button
onClick={() => setStep("search")}
disabled={isLoading}
className="px-4 py-2 border border-gray-600/50 text-gray-300 hover:bg-gray-800 text-sm font-medium rounded-lg transition-all duration-300"
>
Back to Edit
</button>
<button
onClick={handleReplace}
disabled={isLoading || findings?.length === 0}
className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-50"
>
{isLoading ? "Replacing..." : "Apply All"}
</button>
</>
)}
</div>
</div>
</Modal>
);
}

export default MassReplaceModal;
