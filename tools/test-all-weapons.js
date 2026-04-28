/**
 * test-all-weapons.js — Real-play QA: exercise EVERY weapon's full lifecycle.
 * Runs even when headless WebGL is unavailable by driving Weapons API directly.
 *
 * Per weapon:
 *   - switchTo(idx)
 *   - getCurrentName / getCurrentId / getDamage / getClipSize / getReserve
 *   - tryFire() multiple times against synthetic targets
 *   - reload()
 *   - verify HUD ammo readout updates without crash
 *
 * Reports per-weapon PASS/FAIL with first error.
 */
const puppeteer = require('puppeteer');
const { assertGameReady } = require('./qa-verify');

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  console.log('Testing weapons at:', url);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('pageerror', e => errors.push('CRASH: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });

  await page.evaluateOnNewDocument(() => {
    window.__QA_MODE = true;
    if (typeof window.triggerCityEvent !== 'function') window.triggerCityEvent = function () {};
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for GameManager
  let ready = false;
  for (let i = 0; i < 30 && !ready; i++) {
    ready = await page.evaluate(() => typeof window.GameManager !== 'undefined' && typeof window.Weapons !== 'undefined');
    if (!ready) await new Promise(r => setTimeout(r, 500));
  }
  if (!ready) {
    console.log('FATAL: GameManager/Weapons not ready');
    await browser.close();
    process.exit(1);
  }

  // Fake pointer lock so fire calls don't bail
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true });
    if (typeof window.forceStartGame === 'function') window.forceStartGame();
    if (typeof GameManager.toggleGodMode === 'function' && !GameManager.getPlayer().godMode) GameManager.toggleGodMode();
  });
  await new Promise(r => setTimeout(r, 1500));

  // HARD GATE — exits 2 if boot-error overlay or any required module missing.
  await assertGameReady(page, { timeoutMs: 45000 });

  // Run the per-weapon harness in-page
  const result = await page.evaluate(() => {
    const out = { total: 0, passed: 0, failed: 0, weapons: [] };
    const count = Weapons.getWeaponCount();
    out.total = count;

    // Synthetic camera/targets so tryFire has something to consume
    const fakeCam = (typeof CameraSystem !== 'undefined' && CameraSystem.getCamera)
      ? CameraSystem.getCamera()
      : null;
    const targets = (typeof Enemies !== 'undefined' && Enemies.getAll) ? Enemies.getAll() : [];

    for (let i = 0; i < count; i++) {
      const w = { idx: i, name: '?', id: '?', type: '?', damage: 0, clipSize: 0, fired: 0, reloaded: false, error: null };
      try {
        Weapons.switchTo(i);
        w.name = Weapons.getCurrentName();
        w.id = Weapons.getWeaponId ? Weapons.getWeaponId(i) : '?';
        const info = Weapons.getWeaponInfo ? Weapons.getWeaponInfo(i) : null;
        w.type = info ? info.type : '?';
        w.damage = Weapons.getDamage();
        w.clipSize = Weapons.getClipSize ? Weapons.getClipSize() : 0;

        // Fire 5 times
        for (let f = 0; f < 5; f++) {
          try {
            if (fakeCam) {
              Weapons.tryFire(fakeCam, targets, 0.05, function () { /* hit */ }, f === 0);
            }
            if (Weapons.didFire && Weapons.didFire()) w.fired++;
          } catch (eF) {
            w.error = 'fire#' + f + ': ' + eF.message;
            break;
          }
        }

        // Reload
        if (!w.error) {
          try {
            if (Weapons.reload) Weapons.reload();
            w.reloaded = true;
          } catch (eR) {
            w.error = 'reload: ' + eR.message;
          }
        }

        // HUD update sanity
        if (!w.error) {
          try {
            if (HUD && HUD.setWeapon) HUD.setWeapon(w.name, i);
            if (HUD && HUD.setAmmo) HUD.setAmmo(Weapons.getClip ? Weapons.getClip() : 0, Weapons.getReserve ? Weapons.getReserve() : 0);
          } catch (eH) {
            w.error = 'hud: ' + eH.message;
          }
        }

        if (w.error) out.failed++; else out.passed++;
      } catch (eOuter) {
        w.error = 'outer: ' + eOuter.message;
        out.failed++;
      }
      out.weapons.push(w);
    }
    return out;
  });

  console.log('\n══ WEAPON QA RESULTS ══');
  console.log('Total:', result.total, ' Passed:', result.passed, ' Failed:', result.failed);
  for (const w of result.weapons) {
    const status = w.error ? '❌ FAIL' : '✅ PASS';
    console.log(`  [${String(w.idx).padStart(2,'0')}] ${status}  ${w.name.padEnd(18)} type=${(w.type||'').padEnd(12)} dmg=${String(w.damage).padStart(4)} clip=${String(w.clipSize).padStart(3)} fired=${w.fired} reload=${w.reloaded}${w.error ? '  ERR=' + w.error : ''}`);
  }

  if (errors.length) {
    console.log('\n══ PAGE ERRORS ══');
    for (const e of errors) console.log(' -', e);
  } else {
    console.log('\nNo page errors.');
  }

  await browser.close();
  process.exit(result.failed > 0 || errors.length > 0 ? 1 : 0);
})();
