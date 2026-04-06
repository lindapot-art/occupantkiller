# Task Queue — Crash-Proof Request Log

> **HOW TO USE**: Write your requests below. Even if Copilot crashes,
> your requests survive here. On recovery, KING reads this file FIRST
> and resumes work.

## Format
```
### [PRIORITY] Task Title
Status: PENDING | IN-PROGRESS | DONE | BLOCKED
Requested: [date]
Details: [what you want done]
```

---

## Active Tasks

### [HIGH] Full QA Testing — "u test all, im not your qa guy"
Status: DONE
Requested: 2026-04-06
Completed: 2026-04-06
Details: Full end-to-end QA. Killed "Old Eden" imposter on port 3000. Server verified (HTTP 200, 56KB, ZOMBIELAND, security headers). 33/33 syntax checks PASS. 35/35 assets serve. All 5 QA specialists PASS. Fixed: enemies.js null guards, game-manager.js mesh guard + missing clear/reset calls on stage transitions, ml-system.js interval leak, audio-system.js playBark alias. Pushed commit 493a92b.

### [MEDIUM] Comprehensive Gameplay Logic Audit
Status: IN-PROGRESS
Requested: 2026-04-06 (auto-generated from QA findings)
Details: Review wave flow, scoring, progression system, weapon unlocks, economy flow. Ensure game loop is correct from start → waves → stage clear → next stage → win.

### [LOW] Render.com Live Deployment Verification
Status: PENDING
Requested: 2026-04-06
Details: https://occupantkiller.onrender.com times out (free tier sleeping). Need to verify once it wakes up. Code-side deploy config is correct (render.yaml, package.json start script, PORT env var, 0.0.0.0 bind).

### [LOW] Code Cleanup & Dead Code Sweep
Status: PENDING
Requested: 2026-04-06 (auto-generated)
Details: Remove unused variables, dead code paths, commented-out blocks. Low priority.

### [LOW] innerHTML XSS Hardening
Status: PENDING
Requested: 2026-04-06 (qa-security recommendation)
Details: Review all innerHTML assignments for potential user-controlled data. Currently game-generated content only — low risk.

<!-- Add your requests below this line -->

---

## Completed Tasks

<!-- Completed tasks are moved here for history -->

### [HIGH] Perfection Sweep Round 2 — Runtime + Integration + Security
Status: DONE
Requested: 2026-04-06
Completed: 2026-04-06
Details: Fixed 10 bugs across 6 files. drone-system.js: 6 crash paths (VoxelWorld/CameraSystem/getPlayer guards). feedback.js: closure bug in kill feed. npc-system.js: VoxelWorld guard + mesh null guard. marketplace.js: sell flow now calls blockchain + double-spend prevention. weapons.js: getWeaponInfo returns id. hud.js: kill feed deduplicated.

### [HIGH] Port Change 8080→3000
Status: DONE
Requested: 2026-04-06
Completed: 2026-04-06
Details: Changed server port from 8080 to 3000 across 10+ files to avoid occupying default localhost ports.

### [HIGH] Full Auto Perfection Sweep
Status: DONE
Requested: 2026-04-05
Completed: 2026-04-05
Details: Fixed 3 HIGH logic bugs (Economy.produce, Weapons.reload, Weapons.setClip), 2 CRITICAL integration mismatches (TimeSystem API, BLOCK_COLORS), 3 CRITICAL security vulns (null byte DoS, missing headers, wrangler.toml exposure), performance optimizations (camera-system per-frame allocations).

### [HIGH] Crash Recovery System
Status: DONE
Requested: 2026-04-04
Completed: 2026-04-04
Details: Built crash recovery mechanism with CHECKPOINT.md, TASK_QUEUE.md, recovery.prompt.md, and updates to copilot-instructions, king.agent, and watcher.agent.

