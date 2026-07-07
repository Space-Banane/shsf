# TODO.md

## P0 - Priority 0 (Critical)
- [ ] Add UI unit testing / Improve it
- [ ] Add Backend unit testing / Improve it (eg. rename files, move into seperate testing folder etc etc /src/tests)
- [x] Migrate env checking to a seperate module using zod
- [x] Rewrite Runner.ts & split
- [ ] Docker image & Propper compose
- [ ] Seperate pip cache for each function - enchances security and prevents functions from accessing each others pip cache
- [x] Shift Enter Submits on modals (any modal) (add as a agent rule for the future)

## P1 - Priority 1 (High)
- [x] Replace data transport layer between backend and functions with a more robust and safe solution.
- [ ] Find a way to speed up function execution more (completly diffrent approach to the current one?)
- [x] Move system crons to a diffrent approach, move into src/lib(?)

## P2 - Priority 2 (Medium)
- [x] Resolve most of the 83 warnings (no-explicit-any) in backend
- [ ] Storage Limits for Function Data
- [ ] Fully rework builtin docs
- [x] Reworked Admin Panel (UI) - Add more features, make it more user friendly
    - Disable Guest Access
    - Disable External Access
    - Manage User Permissions to docker mount
    - Manage runtimes & images (enable disable)
    - Manage Users (CRUD)
    - Execution Statistics (timings and resource usage)
- [ ] Manage runtimes & images (CRUD) and move hard coded stuff to this. Migration baseline needed tho for existing instances.

## P3 - Priority 3 (Low)
- [ ] Account Wide Environment Variables
- [ ] Add a way to manage function dependencies (eg. requirements.txt) from the UI
- [ ] Runner & Backend: Implement a Block for interactions on Functions while "Container ready." not reached (pretty much wait for “[SHSF] Container ready.”). Message would be something like "Function is not ready yet."
- [ ] Function Logs Update
    - Investigate (Shows only Errors)
    - Hide Specifics (regex blur)
    - Toggle to only log Generic Headers
- [ ] any Modal(???) / function update: Scroll to top on error or move errors to toast (preferred)
- [ ] Remove "Error fetching files: File edits are disabled while git is configured for this function. Remove git configuration to edit files."

## P4 - Priority 4 (Trivial)
- [x] Redesign the entire UI to be more user friendly, modern, dark and visually organized. Currently cluttered and not super friendly. Tool tips and such are missing. (eg. add a "?" icon next to each setting that explains what it does)

## AI Slop
- [ ] AI Performance Analytics (Code Check)
- [ ] Improve AI's capeability
- [ ] Support OpenAI API Keys