# 🧠 MASTER BRAIN — OccupantKiller Project Context

> **FOR AGENT REBOOT / CRASH RECOVERY**: Read this file FIRST on every new session.
> This doc aggregates all critical project knowledge so you never start cold.

---

## 1. PROJECT IDENTITY

**OccupantKiller** — Browser-based 3D voxel FPS built with Three.js r137.
- **Theme**: Ukraine warfare, 12 stages, hybrid voxel combat
- **Stack**: Vanilla JS (IIFE singletons), Three.js, Web Audio API, custom Node HTTP server
- **Port**: 3000 (`server.js`)
- **Working Dir**: `D:\occupantkiller\occupantkiller`
- **Total LOC**: ~16,500+ across ~40 JS modules

### Quick Start
```bash
node server.js   # port 3000
# or
start.bat        # Windows, kills conflicts first
```

---

## 2. CRITICAL BOOT SEQUENCE (Every Session)

1. **Read THIS file** (`MASTER_BRAIN.md`) — you are here
2. **Read `.github/CHECKPOINT.md`** — last session state, current task, next steps
3. **Read `.github/TASK_QUEUE.md`** — pending/in-progress tasks
4. **Read `.github/AUDIT-33-ISSUES.md`** — known bugs (33 issues, P0-P2 ranked)
5. **Check server**: `Invoke-WebRequest http://localhost:3000/healthz` → must be 200
6. **Check git status**: uncommitted changes from prior session?

### If user types `/recovery`
Trigger `.github/prompts/recovery.prompt.md` — auto-reads checkpoint + task queue.

---

## 3. ARCHITECTURE & MODULES

### IIFE Singleton Pattern
Every module: `const Module = (function() { ... })();`
Required exports: `init()`, `update(delta)`, `clear()`

### Core Files (load order in `index.html`)
| File | Purpose |
|------|---------|
| `server.js` | HTTP server (gzip, cache, security headers, `/healthz`) |
| `game-manager.js` | Main orchestrator (stages, waves, player, game loop) |
| `voxel-world.js` | Procedural voxel terrain + biome generators |
| `weapons.js` | Weapon system (fire, reload, attachments, raycasting) |
| `enemies.js` | Enemy spawning, AI, damage, wave management |
| `enemy-types.js` | 30+ enemy type definitions |
| `npc-system.js` | Friendly NPC AI, squads |
| `vehicles.js` | Vehicle spawning, driving, AI, tanks (major polish area) |
| `drone-system.js` | Drone control, AI, camera, possession |
| `camera-system.js` | FPS/RTS/Drone/Vehicle camera modes |
| `audio-system.js` | Procedural SFX, ambient loops (Web Audio API) |
| `jukebox.js` | **Music player** — procedural Ukrainian rap + MP3 jukebox |
| `hud.js` | HUD rendering |
| `blockchain.js` | MetaMask/web3 integration |
| `marketplace.js` | OKC economy |
| `economy.js` | Resources |
| `progression.js` | XP, ranks, daily missions |
| `building.js` | Structure placement |
| `weather-system.js` | Dynamic weather |
| `time-system.js` | Day/night cycle |
| `traversal.js` | Mantling, sliding, prone |
| `combat-extras.js` | Grenades, melee, attachments |
| `perks.js` | Perk tree |
| `skills.js` | Skill system |
| `ranks.js` | Military ranks |
| `feedback.js` | Kill feed, hit markers |
| `tracers.js` | Bullet tracers, impacts |
| `stage-vfx.js` | Stage effects |
| `flags.js` | World flags |
| `environment.js` | Trees, fire, airdrops |
| `world-features.js` | Sandbags, mines, water |
| `refinery-strike.js` | Special mission |
| `enemy-artillery.js` | Mortar/artillery |
| `mortar.js` | Player mortar |
| `bradley.js` | Bradley IFV |
| `gyro.js` | Mobile gyro aim |
| `lottery.js` | Slot machine |
| `premium.js` | Premium subscriptions |
| `tokenomics.js` | OKC token logic |
| `ml-system.js` / `npc-ml.js` | ML difficulty |
| `birds.js` | Bird ambient |
| `api-client.js` | Backend API client |

### Key Global Objects
- `window.THREE` — Three.js r137
- `window.GameManager` — main game orchestrator
- `window.VoxelWorld` — voxel terrain API
- `window.AudioSystem` — SFX engine
- `window.Jukebox` — music player (procedural + MP3)
- `window.Weapons` / `Enemies` / `HUD` / `Economy` / `Blockchain`
- `window.DroneSystem` / `VehicleSystem` / `CameraSystem`

---

## 4. CURRENT STATE SNAPSHOT

### Last Session (Session 38, 2026-04-27)
- **Status**: P0 fixes shipped. User audit response complete.
- **Done**: Boot preloader with progress bar, unified start screen, inline drone choice, scrollable overlay-start
- **QA**: test-master 38/0/0, test-qa-v2 21/0, test-gameplay Errors NONE

### Known Pending (from TASK_QUEUE.md)
| Priority | Task | Status |
|----------|------|--------|
| P0 | Unify start screens + preloader | DONE |
| P0 | Investigate "action under terrain" | DONE |
| P1 | Full-time Overseer agent | DONE |
| P1 | 333-screenshot QA per level | PENDING |
| P1 | God-mode dugout building | DONE |
| P1 | Clear RF Dugouts mission | DONE |
| P1 | Grenade gear default 5 / god ∞ | DONE |
| P1 | NPC sitting-mat detail | DONE |
| P1 | Detail polish pass | DONE (round 1) |
| P0 | Project tracking improvements | IN-PROGRESS |

### 33 Known Issues (AUDIT-33-ISSUES.md)
**P0 (gameplay-blocking)**: #19 launcher grenade HUD bug, #22 vehicle turret self-hit, #24 mobile pause invisible, #33 vehicle exit fire key stuck
**P1 (UX)**: top-bar collision, compass dead-center, resource tofu glyphs, weapon occlusion, crosshair static
**P2 (polish)**: muzzle flash missing, flat buildings, chunk edges, etc.

---

## 5. AGENT HIERARCHY & RULES

### Agent Roles (from `copilot-instructions.md`)
| Priority | Agent | Role |
|----------|-------|------|
| P0 | `king` | Supreme orchestrator — YOU are KING |
| P0 | `qa` | Proxy QA runner |
| P1 | `qa-syntax` | Syntax checks |
| P1 | `qa-runtime` | Crash analysis |
| P1 | `qa-visual` | UI/DOM verification |
| P1 | `qa-integration` | Cross-module checks |
| P1 | `qa-security` | Security & memory |
| P2 | `mr-jopa` | Gaming Professor consultant |
| P2 | `lead` | Lead dev coordination |
| P3 | Specialists | weapon-smith, enemy-architect, vfx-artist, sound-engineer, ui-artist, level-designer, economy-designer, world-builder, network-architect, ml-tracker, voxelbrain, watcher |

### Non-Negotiable Rules
1. **QA on EVERY batch** — 5 specialists, raw terminal output
2. **`node --check` on ALL changed JS files** before shipping
3. **Server UP** (`/healthz` 200) before claiming anything works
4. **Never use external scripts to edit source** — only `replace_string_in_file`
5. **Commit after every batch**
6. **Zero idling** — if no todos, audit for bugs
7. **Credit-saver mode** — think first, batch tool calls

---

## 6. QA PROTOCOL (Mandatory)

### Before Reporting Done
1. `node --check <changed-files>` — exit 0
2. `Invoke-WebRequest http://localhost:3000/healthz` — 200
3. `node tools/test-master.js` — 38 passed, 0 failed
4. `node tools/test-qa-v2.js http://localhost:3000` — 21 passed, 0 failed
5. `node tools/test-gameplay.js http://localhost:3000` — 0 errors

### Every Response With Code Changes Must End With
- `✅ QA done in proxy` — if all 5 specialists passed
- `❌ QA NOT done in proxy` — if any skipped (with reason)

---

## 7. GAME DATA REFERENCE

### Stages (4 implemented of 12 planned)
1. Hostomel Airport (grassland/airport)
2. Avdiivka Sector (urban/industrial)
3. Bakhmut Ruins (wasteland)
4. Kherson Dnipro (coastal)

### Weapons (26 defined)
Army Shovel (MPL-50), Makarov PM, Glock-19, AK-74M, M4A1, RPK-74, PKM, SVD, AS VAL, VSS Vintorez, SVU-A, DShK, NSV Utyos, AGS-17, RPG-7, NLAW, FGM-148 Javelin, Stugna-P, Igla-MANPADS, GP-25, RPO-A Shmel, KS-23, Flashbang, MON-50, TM-62M, F-1

### Challenge Modes
Normal, HARDCORE, SPEEDRUN, PACIFIST, ONE_SHOT, SNIPER_ONLY, NIGHT_OPS

### Roles
Assault Brigade (squad), Lone Wolf (freestyle)

### Drone Types
FPV Attack, Surveillance, Bomber

---

## 8. CRASH RECOVERY PROTOCOL

1. Read THIS file
2. Read `.github/CHECKPOINT.md`
3. Read `.github/TASK_QUEUE.md`
4. Kill stale node processes on port 3000:
   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*server.js*' } | ForEach-Object { taskkill /F /PID $_.ProcessId }
   ```
5. Start server: `node server.js`
6. Resume from first unchecked item in CHECKPOINT.md

---

## 9. MUSIC / JUKEBOX SYSTEM

**Location**: `jukebox.js` + `gamemusic/` folder

### MP3 Files (server-side)
- `gamemusic/Glory to Ukraine.mp3`
- `gamemusic/No Occupants.mp3`
- `gamemusic/Russian Soldier.mp3`

### API Endpoint
- `GET /api/music` → JSON array of `{filename, title, artist, src}`

### Jukebox Modes
1. **MP3 Mode** — HTMLAudioElement playback of actual music files
2. **Procedural Mode** — Web Audio API generated Ukrainian rap/drill

### Controls
- In-game HUD: `🎵 JUKEBOX` button (top bar) + panel (play/pause, prev/next, volume, track list)
- Inventory overlay: jukebox mini-controls embedded in pause menu
- Hotkey: `J` toggles jukebox panel

---

## 10. FILE REFERENCES

| Doc | Path | Purpose |
|-----|------|---------|
| Master Brain | `.github/MASTER_BRAIN.md` | This file — session reboot reference |
| Checkpoint | `.github/CHECKPOINT.md` | Last session state + next steps |
| Task Queue | `.github/TASK_QUEUE.md` | All pending/completed tasks |
| Copilot Instructions | `.github/copilot-instructions.md` | Agent rules & QA protocol |
| Audit 2026-04-27 | `.github/AUDIT-2026-04-27.md` | Honest audit of missed work |
| Audit 33 Issues | `AUDIT-33-ISSUES.md` | Known bugs with evidence |
| Session Progress | `memories/session/progress.md` | Detailed session history |
| Recovery Prompt | `.github/prompts/recovery.prompt.md` | `/recovery` command handler |

---

## 11. USER PREFERENCES & TRUST

- User explicitly said **"i dont trust you anymore"** (Session 38)
- **Mandate**: Over-deliver honesty — real raw QA output, no inflated claims
- User wants crash-proof session tracking (this doc is part of that)
- User wants features shipped, not docs — but docs must be accurate

---

*Updated: 2026-04-29 — Session reboot brain doc created*
