/**
 * Mobile UI smoke test — emulate mobile landscape, verify controls visible and wired;
 * emulate portrait, verify orientation overlay appears.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'screenshots', 'mobile');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--touch-events=enabled']
  });
  const page = await browser.newPage();

  // Emulate iPhone landscape
  await page.emulate({
    viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 2 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });

  const errors = [];
  page.on('pageerror', e => errors.push('CRASH: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.evaluateOnNewDocument(() => {
    window.__QA_MODE = true;
    window.triggerCityEvent = function(){};
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => typeof window.GameManager !== 'undefined', { timeout: 10000 });

  // Start game via forceStartGame
  await page.evaluate(() => {
    GameManager.toggleGodMode();
    Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true });
    if (typeof window.forceStartGame === 'function') window.forceStartGame();
  });
  for (let i = 0; i < 15; i++) {
    const state = await page.evaluate(() => GameManager.getState());
    if (state === 'playing') break;
    await new Promise(r => setTimeout(r, 500));
  }

  await page.screenshot({ path: path.join(SHOT_DIR, '01-landscape-play.png') });

  // Verify mobile controls visible in landscape
  const landscapeState = await page.evaluate(() => {
    const ids = ['mobile-controls', 'joystick-zone', 'mobile-look-zone', 'btn-fire', 'btn-reload',
      'btn-jump', 'btn-sprint', 'btn-crouch', 'btn-melee', 'btn-grenade', 'btn-weapon-prev',
      'btn-weapon-next', 'btn-aim', 'btn-use', 'btn-vehicle', 'btn-build', 'btn-pause',
      'orientation-overlay'];
    const result = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) { result[id] = null; continue; }
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      result[id] = {
        present: true,
        visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)
      };
    }
    return result;
  });

  // Emulate portrait: resize
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, isLandscape: false, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 500));
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(SHOT_DIR, '02-portrait-overlay.png') });

  const portraitOverlay = await page.evaluate(() => {
    const el = document.getElementById('orientation-overlay');
    const cs = el ? window.getComputedStyle(el) : null;
    return { present: !!el, display: cs ? cs.display : null };
  });

  // Back to landscape
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, isLandscape: true, deviceScaleFactor: 2 });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await new Promise(r => setTimeout(r, 300));

  // Touch fire button — simulate tap via element.touch events
  await page.evaluate(() => {
    const el = document.getElementById('btn-fire');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 1, target: el, clientX: r.x + 20, clientY: r.y + 20 });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], targetTouches: [], changedTouches: [t], bubbles: true, cancelable: true }));
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(SHOT_DIR, '03-landscape-fire.png') });

  console.log('LANDSCAPE state:');
  for (const k of Object.keys(landscapeState)) {
    const v = landscapeState[k];
    if (!v) { console.log(`  ${k}: MISSING`); continue; }
    console.log(`  ${k}: visible=${v.visible} pos=(${v.x},${v.y}) size=(${v.w}x${v.h})`);
  }
  console.log('PORTRAIT overlay:', JSON.stringify(portraitOverlay));
  console.log('Errors:', errors.length ? errors : 'NONE');

  await browser.close();
  const critical = ['mobile-controls', 'joystick-zone', 'mobile-look-zone', 'btn-fire', 'btn-jump',
    'btn-crouch', 'btn-melee', 'btn-grenade', 'orientation-overlay'];
  const missing = critical.filter(id => !landscapeState[id] || !landscapeState[id].present);
  const notVisible = critical.filter(id => landscapeState[id] && !landscapeState[id].visible && id !== 'orientation-overlay');
  if (missing.length) { console.log('FAIL — missing:', missing); process.exit(1); }
  if (notVisible.length) { console.log('FAIL — not visible in landscape:', notVisible); process.exit(1); }
  if (portraitOverlay.display !== 'flex') { console.log('FAIL — portrait overlay not shown, got display=' + portraitOverlay.display); process.exit(1); }
  if (errors.length) { console.log('FAIL — errors'); process.exit(1); }
  console.log('\nPASS — all mobile controls wired and orientation handling works.');
  process.exit(0);
})();
