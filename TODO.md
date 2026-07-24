# TODO.md

## P0 - Priority 0 (Critical)
- [x] Remove .NET / C# Entirely
- [x] Add NodeJS as runtime
- [ ] Rewrite our function runtime code injector (db, and now the callF stuff) to be simpler to maintain and to add stuff to. Same callable stuff within functions, just a better way for us to add new features like callF
- [ ] Fix SHSF Global & Redo it (security fixed: link-status/unlink now require admin or instance secret; full redo still open)

## P1 - Priority 1 (High)
- [ ] Find a way to speed up function execution more (completly diffrent approach to the current one?)
- [ ] Make more use of the testing ui for functions
- [ ] Call other functions within a function via a builtin function into the inject runtime runner (example, `callF("functionName", {args} (args here are passed into the args.body and the who ran param will be "func_"+id of the calling function (embedded in the callF function generated at runtime)))` or something like that)
- [ ] dev/prod modes for functions.
    > Like you can have a select in the env modal that switches the functions "env_state" to whatever profile you have, by default we have the "prod" profile, but users should also be able to add a "dev" (or custom) profile that can be used to test functions in a different environment. Switching would mean that all requests to that function would be routed to the dev profile for example, which we dont want, thats why on api exec calls we can use a "x-use-env" to use the custom, non "prod" profile for that function, and the default would be prod. This would allow users to test functions in a dev environment without affecting the prod environment.
- [ ] Relating execution logs
    > On an Execution log, the function should be able to call a function from the runtime like this: `makeLog("log message", {level: "info"})` and it will create a log entry in the existing execution logs for that execution. This will allow users to log messages from within their functions and have them show up in the execution logs for that function. So they dont have to keep digging in the print statements and so that agents can work better with this
- [ ] Keep MCP server up-to-date with the lastest features

## P2 - Priority 2 (Medium)
- [ ] Manage runtimes & images (CRUD) and move hard coded stuff to this. Migration baseline needed tho for existing instances. & pre pulling images on button presses with live ui statuses

## P3 - Priority 3 (Low)
- [ ] Better way to have the "Next Step" dynamic and not hardcoded in the documentation UI part. IF i remove a doc i need to update the last doc before that, i dont want to do that.

## P4 - Priority 4 (Trivial)

## AI Slop
- [ ] AI Performance Analytics (Code Check)
- [ ] Improve AI's capeability
- [ ] Support OpenAI API Keys
