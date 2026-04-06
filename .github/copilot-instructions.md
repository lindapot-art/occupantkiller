# OccupantKiller — Global Rules (Apply to ALL Agents)

## KING Rules All
- The **KING agent** is the supreme authority over all other agents
- Every agent must defer to KING's decisions
- KING coordinates all work and approves all output

## Mandatory QA — NON-NEGOTIABLE
These rules apply to EVERY agent, regardless of who is in charge:

1. **Every batch of code changes MUST pass QA before shipping**
2. **QA means 5 specialists must approve**: qa-syntax, qa-runtime, qa-visual, qa-integration, qa-security
3. **QA evidence must be raw terminal output** — never trust subagent word alone
4. **`node --check` must pass on ALL .js files** before any batch is complete
5. **Server must be verified UP (HTTP 200)** before claiming anything works
6. **If ANY QA specialist flags FAIL, work stops until fixed**

## QA Stamp — Required on Every Response
Every response that includes code changes MUST end with:
- `✅ QA done in proxy` — if ALL 5 QA specialists passed
- `❌ QA NOT done in proxy` — if any were skipped (with reason)

## Crash Recovery — NON-NEGOTIABLE
Every agent MUST follow this protocol:

1. **CHECKPOINT after every significant step**: Update `.github/CHECKPOINT.md` with:
   - What step just completed
   - What files were changed
   - What the next step is
2. **TASK_QUEUE is the source of truth**: All user requests go into `.github/TASK_QUEUE.md`
   - Never rely on conversation memory alone
   - Mark tasks IN-PROGRESS when starting, DONE when finished
3. **On session start**: ALWAYS read `.github/CHECKPOINT.md` and `.github/TASK_QUEUE.md`
   - If there's unfinished work, RESUME it — don't ask the user to repeat themselves
4. **Recovery prompt**: User can type `/recovery` to trigger `.github/prompts/recovery.prompt.md`
   - This reads checkpoint + task queue and resumes automatically

## Project Standards
- IIFE singleton pattern for all modules
- All modules expose init(), update(delta), clear()
- Meshes are procedural THREE.js geometry
- Custom server.js on port 3000 (NOT npx serve)
- `node --check` for syntax validation
- Path: D:\occupantkiller\occupantkiller
