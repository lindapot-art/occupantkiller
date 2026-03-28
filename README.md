# Occupant Killer — 3D FPS

A browser-based first-person shooter built with [Three.js](https://threejs.org/).  
Survive 10 waves of increasingly dangerous **occupants** before they overrun you.

## Play

Open `index.html` in any modern browser (Chrome, Firefox, Edge).  
No build step required — Three.js r137 is included as a local file (`three.min.js`).

## Controls

| Key / Action | Description |
|---|---|
| `W A S D` / Arrow keys | Move |
| Mouse | Look |
| Left click | Shoot (hold for auto-fire) |
| `R` | Reload |
| `Shift` | Sprint |
| `Space` | Jump |
| `Esc` | Pause / Resume |

## Game Mechanics

- **10 waves** of enemies, each wave harder than the last
- **3 enemy types** — Occupant (normal), Runner (fast/weak, wave 3+), Tank (slow/tough, wave 5+)
- **Headshots** deal 2× damage and display a special indicator
- **Pickups** drop randomly when enemies die: green health packs (+25 HP) and yellow ammo crates (+30 rounds)
- **Floating HP bars** above every enemy, colour-coded by remaining health
- **Jump** (Space) and **camera bob** while moving for a natural feel
- **Pause** with Escape at any time

## Project Structure

```
index.html   – Entry point & HTML layout
style.css    – All styles (HUD, overlays, notifications, layout)
game.js      – Core engine (scene, renderer, camera, player movement, jump, pause, game loop)
weapons.js   – Gun state, raycasted shooting, muzzle flash, reload logic
enemies.js   – 3 enemy types, floating HP bars, occupant AI, pickup drop logic
hud.js       – HUD DOM helpers (health, ammo, score, wave, enemies, headshot/pickup notifications)
pickups.js   – Animated health & ammo collectible spawning and collection
```
