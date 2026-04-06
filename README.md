# Occupant Killer — 3D FPS

A browser-based first-person shooter built with [Three.js](https://threejs.org/) r137.  
Fight through **12 stages** of increasingly dangerous occupants across Ukraine and beyond.

## Quick Start

```bash
node server.js          # Start on port 3000
# or
start.bat               # Windows: auto-kills port conflict + starts server
```

Open `http://localhost:3000` in Chrome, Firefox, or Edge.

## Controls

| Key / Action | Description |
|---|---|
| `W A S D` / Arrow keys | Move |
| Mouse | Look |
| Left click | Shoot (hold for auto-fire) |
| `R` | Reload |
| `Shift` | Sprint |
| `Space` | Jump |
| `C` | Crouch |
| `V` | Mantle over obstacles |
| `E` | Enter/exit vehicle |
| `Q` | Toggle drone possession |
| `B` | Toggle build mode |
| `Tab` | Scoreboard |
| `1-9` | Weapon select |
| `Esc` | Pause / Resume |

## Game Features

- **12 stages** (Hostomel Airport → Kremlin Showdown), 7-10 waves each
- **30+ enemy types** — infantry, snipers, medics, tanks, drones, mechs, 9 unique bosses
- **Extensive weapon arsenal** with attachments, recoil patterns, and ammo types
- **Vehicles** — transport, combat, turret rover (drivable + AI patrols)
- **Drones** — recon, combat, supply (possessable with Q key)
- **Friendly NPCs** — civilians, trainees, squadmates with squad commands
- **Building system** — barracks, factories, walls, hangars, command centers
- **Voxel world** — procedural terrain, destructible environment, 12 biomes
- **Dynamic weather** — rain, snow, fog, sandstorm, radiation
- **Progression** — XP, ranks, prestige, daily missions, perks, skills
- **Economy** — resources, marketplace, OKC currency, blockchain integration
- **Audio** — procedural SFX, ambient soundscapes, adaptive music

## Architecture

All client modules use the IIFE singleton pattern (`const Module = (function() { ... })();`).  
Custom static file server with gzip compression and security headers (no Express).

### Core Files (33 JS modules)

| File | Purpose |
|---|---|
| `server.js` | HTTP server (gzip, cache, security headers, /healthz) |
| `game-manager.js` | Main orchestrator (stages, waves, player, game loop) |
| `voxel-world.js` | Procedural voxel terrain + 12 biome generators |
| `weapons.js` | Weapon system (fire, reload, attachments, raycasting) |
| `enemies.js` | Enemy spawning, AI, damage, death, wave management |
| `enemy-types.js` | 30+ enemy type definitions and specialized AI |
| `npc-system.js` | Friendly NPC AI, squads, combat, patrol |
| `vehicles.js` | Vehicle spawning, driving, AI patrols, turrets |
| `drone-system.js` | Drone control, AI, camera, possession |
| `camera-system.js` | FPS/RTS/Drone/Vehicle camera modes |
| `audio-system.js` | Procedural SFX, ambient, music (Web Audio API) |
| `hud.js` | HUD rendering (health, ammo, minimap, compass) |
| `combat-extras.js` | Grenades, melee, prone, attachments |
| `tracers.js` | Bullet tracers, casings, impact effects |
| `pickups.js` | Health, ammo, armor collectibles |
| `building.js` | Structure placement, templates, build queue |
| `weather-system.js` | Dynamic weather (rain, snow, fog, sandstorm) |
| `world-features.js` | Fire, trees, airdrops, landmines, sandbags |
| `stage-vfx.js` | Stage-specific particle effects |
| `progression.js` | XP, levels, prestige, daily missions |
| `missions.js` | Mission objectives and tracking |
| `mission-types.js` | Mission type definitions |
| `economy.js` | Resources, prices, buy/sell |
| `marketplace.js` | OKC marketplace integration |
| `blockchain.js` | On-chain economy (conceptual) |
| `perks.js` | Perk tree and effects |
| `skills.js` | Skill system |
| `ranks.js` | Military rank progression |
| `traversal.js` | Mantling, climbing, sliding |
| `feedback.js` | Hit markers, kill feed, notifications |
| `time-system.js` | Day/night cycle |
| `automation.js` | Auto-crafting, auto-repair |
| `ml-system.js` | ML-based difficulty adaptation |

## Testing

```bash
node tools/test-master.js   # 32 tests across 7 phases
```

## Deployment

Configured for [Render.com](https://render.com) via `render.yaml`. Health check at `/healthz`.
