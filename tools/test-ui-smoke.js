/**
 * Quick UI smoke test — loads game, enables god mode, takes 8 screenshots,
 * checks for JS errors, verifies HUD sizing.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'screenshots', 'ui-smoke');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('pageerror', e => errors.push('CRASH: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });

  await page.evaluateOnNewDocument(() => {
    window.__QA_MODE = true;
    window.triggerCityEvent = function(){};
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.screenshot({ path: path.join(SHOT_DIR, '00-menu.png') });

  // Wait for GameManager
  await page.waitForFunction(() => typeof window.GameManager !== 'undefined', { timeout: 10000 });

  // Start game
  await page.evaluate(() => {
    GameManager.toggleGodMode();
    Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true });
    if (typeof window.forceStartGame === 'function') window.forceStartGame();
  });

  // Wait for playing state
  for (let i = 0; i < 15; i++) {
    const state = await page.evaluate(() => GameManager.getState());
    if (state === 'playing') break;
    await new Promise(r => setTimeout(r, 500));
  }

  // Check HUD element bounding rects for overlaps
  const hudRects = await page.evaluate(() => {
    const ids = [
      'conn-status', 'skill-hud-btn', 'inventory-btn', 'controls-legend-toggle',
      'extended-top-bar', 'top-bar', 'resource-bar', 'tactical-compass',
      'hud-okc-bar', 'weather-indicator', 'streak-display',
      'minimap-canvas', 'bottom-bar', 'target-assist', 'kill-feed'
    ];
    const result = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) { result[id] = null; continue; }
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      result[id] = {
        visible: cs.display !== 'none' && cs.visibility !== 'hidden',
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height)
      };
    }
    return result;
  });

  // Detect overlaps between visible elements in top region (y < 120)
  const overlaps = [];
  const ids = Object.keys(hudRects).filter(id => hudRects[id] && hudRects[id].visible && hudRects[id].y < 120 && hudRects[id].w > 0);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = hudRects[ids[i]], b = hudRects[ids[j]];
      const ax2 = a.x + a.w, ay2 = a.y + a.h;
      const bx2 = b.x + b.w, by2 = b.y + b.h;
      if (a.x < bx2 && ax2 > b.x && a.y < by2 && ay2 > b.y) {
        overlaps.push(`${ids[i]} ↔ ${ids[j]}`);
      }
    }
  }

  // Take a few screenshots during play
  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(SHOT_DIR, `0${i+1}-play.png`) });
  }

  // Check weapon cycle
  const weaponCheck = await page.evaluate(() => {
    const names = [];
    for (let i = 0; i < 5; i++) {
      Weapons.switchTo(i);
      names.push(Weapons.getCurrentName());
    }
    return names;
  });
  await page.screenshot({ path: path.join(SHOT_DIR, '06-weapon-switch.png') });

  console.log('HUD rects:', JSON.stringify(hudRects, null, 2));
  console.log('Top-region overlaps:', overlaps.length ? overlaps : 'NONE');
  console.log('Weapons cycled:', weaponCheck.join(' / '));
  console.log('Errors:', errors.length ? errors : 'NONE');

  await browser.close();
  process.exit(errors.length > 0 || overlaps.length > 3 ? 1 : 0);
})();
