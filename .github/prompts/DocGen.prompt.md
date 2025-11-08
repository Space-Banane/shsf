---
mode: agent
description: Generate a Document for a Feature or Topic
model: GPT-4.1 (copilot)
tools: ['edit', 'search', 'usages', 'problems', 'changes']
---
You've been provided with the Task of Generating a Document.

## How to write a good doc
- When formatting code, use a proper background, proper indentation, and appropriate syntax highlighting for readability.
- Structure your document with clear headings and subheadings to organize content logically.
- Use concise and precise language to explain concepts, avoiding unnecessary jargon.
- Include examples and sample code snippets to illustrate key points.
- Provide step-by-step instructions for complex tasks or workflows.
- Proofread your document for grammar, spelling, and clarity.
- Add warning or note boxes for important information that users should be aware of.


## How to add a Doc
PRE-WRITING:
- Take a look at older docs, see how they are structured and formatted.
- Identify the last doc in the sequence to link from it to the new doc.
1. Write the within the UI/src/pages/docs directory
2. Add it as a Route within UI/src/Routes.tsx
3. Add a entry in the lessons const list within UI/src/pages/index/docs.tsx
4. Find out the last doc and add a propper next link to it, to the new doc
5. To the new doc add the message back to the previous doc that the user should keep their instance updated as there is no new doc after the new one yet.

## Task
Ask for the information, feature and specifics you need to generate a good document about.
If told to "Check the Changes" or "Look at the Changes", use the changes tool to find out what has changed in the codebase recently.