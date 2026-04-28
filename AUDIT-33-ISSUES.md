# 33 Issues — Live Audit (2026-04-28)

Sources:
- 21 desktop screenshots: `tools/screenshots/gameplay-*.png`
- 40 mobile screenshots: `tools/screenshots/mobile-real/*.png`
- 5 vehicle-proof screenshots: `tools/screenshots/vehicle-proof/*.png` (commit 877b1f5)
- Code grep across workspace JS

Verdict: 33 distinct issues, evidence-backed.

---

## A. HUD layout / readability (desktop)

1. **Top-bar collision** — `STAGE 1: HOSTOMEL AIRPORT  SCORE 0  WAVE 1/7  KILLS 0  ENEMIES N` runs under the recruit-rank progress bar; both share the top ~30px and overlap.
2. **Compass bar dead-center** — green compass strip rendered around y≈90 center-screen (`211° SW`) where the crosshair lives; should be top-anchored.
3. **STEALTH ACTIVE button mid-screen** — free-floating green pill at ~y=145 with no logical home; should live in HUD-left under challenges.
4. **Resource pills show tofu boxes** — top row reads `□10049 ▤10029 ⚡10009 ▦10019 ▦10039 ▦10059 ▦999999`; only `⚡` renders, others are missing-glyph rectangles.
5. **Daily Challenges checkboxes are tofu** — `☐` glyph in front of `Endurance / Fortifier / Flawless` falls back to rectangle.
6. **"LONE WOLF" overlaps "LEARNING | Style: BALANCED (38%)"** — top-right; pink style chip drawn on top of yellow Lone Wolf badge.
7. **"Hold SHIFT to sprint" tooltip never fades** — visible at wave 5 (`gameplay-006-g1-r5-RPK74.png`) and wave 7 (`gameplay-009-g1-r7-PKM.png`); should auto-dismiss after first sprint or N seconds.
8. **NPC list crammed over health bar** — bottom-left `NPCs: 17 | Morale: 87%` and `Urban Breakout (active)` sit ~6px above `HEALTH 999999/999999`.
9. **Compass numeric value flickers** — `211°` shown in `006-r5` but missing in `009-r7`.
10. **Bounties chip free-floats** — yellow `BOUNTIES Collect 5 pickups…` is detached from the Daily Challenges card with no parent grouping.

## B. World / rendering (desktop)

11. **Hard chunk edge on right side** — at `x≈1130-1280, y=380-560` voxel blocks abruptly stop into haze (`gameplay-006-g1-r5`); no horizon fog or skirt.
12. **Floating white square specks** mid-air (~y=380, x=300-700) on `gameplay-006-r5` — pickup glints rendered at z=0 height before terrain settled.
13. **No muzzle flash drawn** on any of 21 desktop shots while firing (RPK, PKM, AK, M4, Javelin, etc.) — either `Tracers.spawnMuzzleFlash` not invoked for those weapons, or its lifetime < headless 5fps interval.
14. **First-person hand is a flat orange rectangle** — no detail or shading, visible on every weapon shot.
15. **Weapon model occludes ~25% of right viewport** (RPK74, PKM frames) — rifle takes the entire right third of the screen.
16. **Buildings have flat dark green faces** — every wall reads identical color; no normal-map or face-luminance variation, no AO.
17. **Distant blue grid visible** at right horizon — uncolored / unfilled chunk boundary tiles bleed through.
18. **Stage banner does not fade** — `STAGE 1: HOSTOMEL AIRPORT` mission title persists through wave 5+ in headless captures; needs alpha-out timer.

## C. Combat / weapons logic

19. **Launchers show `GRENADES ∞`** — NLAW, FGM-148 Javelin, RPG-7, Stugna-P, Igla-MANPADS all read `GRENADES ∞ G to throw` in HUD (`gameplay-014-r11-FGM148Javeli`); these are not grenade weapons. Wrong inventory mapping.
20. **No lock-on UI for guided ATGM** — Javelin (FGM-148) and Stugna-P are top-attack guided but no reticle / no SEEKER indicator drawn during aim.
21. **Crosshair never spreads / never hit-marks** — single static `+` even during sustained PKM fire (250-round belt). No dynamic spread, no kill x-mark.
22. **Vehicle turret projectile self-removed in 1 frame when terrain raycast hits at spawn** — proven in `tools/diag-vehicle.js`. If vehicle is jammed against a wall, every shot dies on its own muzzle voxel.
23. **`fireTurret(v)` only respects camera *yaw*** (`vehicles.js:1610-1612`, `_vTmp1.set(-Math.sin(yaw),0,-Math.cos(yaw))`) — combat-vehicle turret cannot aim up at helicopters or down at infantry; only the **tank** path uses pitch.

## D. Mobile UX

24. **Pause overlay is invisible/blank** — `iphone-landscape-new-ov-overlay-pause.png` shows the regular game frame, no dimming, no "PAUSED" text, no resume/restart buttons. Audit logs `display:none` for `overlay-pause` even when paused.
25. **Subtitle clips behind crosshair / inventory pills** — `Stop the airborne assault at Hostomel Airport.` line on iPhone-landscape-new is overdrawn by the inventory pills row.
26. **Top-right action stack is unintelligible** — eye / banana / target / M emoji icons on a 46×46 button only show the colored circle; glyphs barely legible at this density.
27. **Look-stick (right) is enormous** — ~200×200 px circle covers a quarter of the right-side game world; too large for landscape phones.
28. **HEALTH/AMMO/WEAPON panel eats ~30% of vertical screen** on mobile — black rounded rectangle anchored bottom-center severely shrinks play area on 390-tall viewport.
29. **D-pad bottom-right has redundant controls** — `▼` `↑` `▲` `🔃` `🏃` cluster overlaps with weapon-prev/-next icons; multiple controls in same 60-px column.
30. **`btn-vehicle` and `btn-build` placed at y=0** (audit log: `"x":611,"y":0,"w":46,"h":46`) — risk of being eaten by Safari notch/status bar on real iPhones.

## E. Network / backend / sound

31. **`/api/player/auth` 4× ERR_CONNECTION_REFUSED** — client retries 4 times to backend on `:3001` even though offline play should silence after 1 attempt (`api-client.js`); 4× wasted offline-mode network.
32. **Audio system never primes in headless** — mobile-real test shows zero gunshot/footstep/UI sound events, but frames still capture; no silent-mode flag. On a real device with locked audio context the same path will be silent until first tap.

## F. Code hygiene

33. **`_occupiedVehicle` exit doesn't null `_vKeys.fire`** — if user exits the vehicle while LMB held, `_vKeys.fire` stays `true`. Next time you enter any vehicle, `update()` immediately fires turret (`vehicles.js:781-783, 691-740`).

---

## Priority

- **P0 (gameplay-blocking):** #19, #22, #24, #33
- **P1 (UX):** #1, #2, #4, #7, #15, #21, #28
- **P2 (polish):** remainder

QA: report compiled from 61 live screenshots (luma 60-92, litRatio 94-99%, 0 console errors) plus targeted code grep. No source modifications in this commit.
