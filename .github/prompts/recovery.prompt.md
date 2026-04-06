---
description: "Crash Recovery — Restores session state after Copilot crash"
mode: "king"
---

# CRASH RECOVERY PROTOCOL

You crashed in a previous session. The user's work and requests may be incomplete.

## IMMEDIATE ACTIONS — Do these NOW:

### Step 1: Read the checkpoint
Read `.github/CHECKPOINT.md` to see:
- What task was in progress
- Which steps were completed
- Which files were changed
- What the last known good state was

### Step 2: Read the task queue
Read `.github/TASK_QUEUE.md` to see:
- All pending requests from the user
- Priority and status of each task

### Step 3: Verify file integrity
For every file listed in CHECKPOINT.md under "Files Changed This Session":
- Verify the file exists
- Run `node --check` on any .js files
- Check for partial/truncated content

### Step 4: Report to user
Tell the user:
- What was being worked on when the crash happened
- What was completed vs incomplete
- What you're about to resume

### Step 5: Resume work
Pick up from the first unchecked step in CHECKPOINT.md and continue.

## RULES
- Do NOT ask the user to re-explain anything that's in CHECKPOINT.md or TASK_QUEUE.md
- Do NOT start fresh — always resume from checkpoint
- Run QA on any files that were mid-edit before claiming they're good
- Update CHECKPOINT.md as you make progress
