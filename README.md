# Occupant Killer — 3D FPS

A browser-based first-person shooter built with [Three.js](https://threejs.org/).  
Survive 10 waves of increasingly dangerous **occupants** before they overrun you.

## Play

Open `index.html` in any modern browser (Chrome, Firefox, Edge).  
No build step required — Three.js r128 is included as a local file (`three.min.js`).

## Controls

| Key / Action | Description |
|---|---|
| `W A S D` / Arrow keys | Move |
| Mouse | Look |
| Left click | Shoot |
| `R` | Reload |
| `Shift` | Sprint |

## Game Mechanics

- **10 waves** of enemies, each wave harder than the last
- Enemies are **occupants** — humanoid melee attackers that chase you
- **Shoot** them before they reach you — each occupant has a visible health pool
- Pick up ammo bonuses by surviving each wave
- Score: **100 pts** per kill, **500 pts** wave clear bonus

## Project Structure

```
index.html   – Entry point & HTML layout
style.css    – All styles (HUD, overlays, layout)
game.js      – Core engine (scene, renderer, camera, player movement, game loop)
weapons.js   – Gun state, raycasted shooting, muzzle flash, reload logic
enemies.js   – Occupant spawning, pathfinding AI, hit detection
hud.js       – Heads-up display DOM helpers
```
