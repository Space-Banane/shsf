# Browser memory profiling: Function Detail

Issue: #73

## Repeatable profiling scenario

Use Chrome DevTools Performance Monitor and Memory panels against a development or production-like SHSF instance. Run the test with an authenticated account that has two functions, each with several source files and execution logs.

1. Open the first function and switch between each source file ten times.
2. Run a function that streams output for at least 30 seconds, then navigate to the function list while it is running. Repeat ten times.
3. Open the second function, view its logs, navigate back to the list, and repeat ten times.
4. Force garbage collection after each group of ten cycles, then compare JavaScript heap, DOM nodes, listeners, and Monaco models to the baseline.

Expected result: after forced GC, retained heap, DOM nodes, and Monaco model count return close to the baseline instead of increasing with each abandoned execution. Temporary allocations while loading files, logs, and Monaco are expected; browser measurements do not include backend process memory.

## Investigation and fix

The source-level lifecycle audit found a confirmed retention path in `UI/src/pages/functions/FunctionDetail.tsx`: navigating away during a classic or streaming execution left its request and a 1 ms UI timer alive until the server finished or the 15-minute client timeout elapsed. The closures retained the page's React state and streamed output. The detail page now aborts either execution mode and clears its timer and editor view-state cache on unmount. The display timer runs every 50 ms, matching the two-decimal display without scheduling 1,000 React updates per second.

`@monaco-editor/react` owns the editor/model disposal on unmount; this page now drops its remaining editor reference and saved view states at the same boundary. Existing file contents and logs are unchanged.

## Evidence and follow-up measurement

The cancellation signal is covered by `UI/src/services/backend.functions.test.ts`. This task environment could not collect browser heap snapshots: T3's shared browser failed to start because the host blocks its sandbox with AppArmor, and no backend fixture was available. This is an environment limitation, not a claim about production browser memory.

Before/after verification on a running SHSF instance should attach heap snapshots from the scenario above to issue #73. The key before/after check is that navigating away during a long execution leaves no active request or repeating timer for the discarded Function Detail page after forced GC.
