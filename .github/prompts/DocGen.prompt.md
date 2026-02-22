---
agent: agent
description: Generate and sequence a new documentation page based on codebase changes
model: Claude Sonnet 4.6 (copilot)
tools: ["edit", "search", "search/changes", "read", "edit/editFiles", "edit/createFile", "agent", "read/readFile"]
---

You are tasked with generating a new documentation page by analyzing recent codebase modifications and integrating it into the existing sequence. People generally fail to keep track of updates, so you must ensure the chain is unbroken.

## Requirements

1. **Mandatory Change Analysis:** Use the `changes` tool to perform a comprehensive review of all recent commits and file modifications. Do not guess; rely strictly on the diffs to understand what actually happened in the code.
2. **Identify Sequence:** Locate the current "latest" documentation file in `UI/src/pages/docs` to determine the correct numbering and identify which file needs to be updated to point to the new one.

## Implementation Steps

1. **Create Document:** Write the new file within `UI/src/pages/docs`.
   - The content must reflect the analyzed changes accurately.
   - Include a "Previous" link pointing to the old last doc.
   - Add a notice: "Keep your instance updated; there is no newer documentation beyond this page yet."
2. **Link the Chain:** Open the file that was previously the "last" doc. Edit it to remove any "latest" notices and add a "Next" link pointing to the new document you just created.
3. **Register Route:** Add the new page as a Route within `UI/src/Routes.tsx`.
4. **Update Gallery/Index:** Add an entry to the `lessons` constant list within `UI/src/pages/index/docs.tsx`.

## Task Initiation

Begin by using the `changes` tool to identify the latest modifications. If the user hasn't specified a feature, report what you found and ask which specific logic requires the new doc.