// tools/test-stage-tour.js — Visit all 4 stages, capture screenshots every 3s, cycle weapons
// Usage: node tools/test-stage-tour.js http://localhost:3000

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SHOTS_DIR = path.join(__dirname, 'screenshots', 'stage-tour');
if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument(() => { window.__QA_MODE = true; });

  const errors = [];
  page.on('pageerror', err => errors.push('CRASH: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/ERR_CONNECTION_REFUSED|favicon/.test(t)) errors.push('CONSOLE: ' + t);
    }
  });

  console.log('[TOUR] Loading', url);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  for (let i = 0; i < 30 && !(await page.evaluate(() => typeof window.GameManager !== 'undefined')); i++) {
    await new Promise(r => setTimeout(r, 250));
  }
  await page.evaluate(() => { if (window.forceStartGame) window.forceStartGame(); });
  await new Promise(r => setTimeout(r, 3000));

  let idx = 0;
  async function shot(label) {
    const name = `tour-${String(idx).padStart(3,'0')}-${label}.png`;
    await page.screenshot({ path: path.join(SHOTS_DIR, name), type: 'png' });
    console.log('  shot', name);
    idx++;
  }

  const STAGES = [0, 1, 2, 3];
  const WEAPON_COUNT = await page.evaluate(() =>
    (typeof Weapons !== 'undefined' && Weapons.getWeaponCount) ? Weapons.getWeaponCount() : 0);
  console.log('[TOUR] Weapons available:', WEAPON_COUNT);

  // Unlock all weapons + god mode for full tour
  await page.evaluate(() => {
    if (typeof Weapons !== 'undefined' && Weapons.unlockWeapon) {
      const n = Weapons.getWeaponCount();
      for (let i = 0; i < n; i++) Weapons.unlockWeapon(i);
    }
    if (window.GameManager && !GameManager.isGodMode()) GameManager.toggleGodMode();
  });

  for (const stageIdx of STAGES) {
    // Force jump to this stage
    await page.evaluate((s) => {
      try {
        // Walk through nextStage until we reach target stage
        let guard = 10;
        while (GameManager.getCurrentStage() < s && guard-- > 0) {
          if (typeof GameManager.nextStage === 'function') GameManager.nextStage();
          else break;
        }
      } catch (e) {}
    }, stageIdx);
    await new Promise(r => setTimeout(r, 2500));

    const stageInfo = await page.evaluate(() => {
      const s = GameManager.getStageInfo();
      return { name: s ? s.name : '?', stage: GameManager.getCurrentStage() };
    });
    console.log(`\n[STAGE ${stageInfo.stage}] ${stageInfo.name}`);

    // 3 screenshots @ 3s apart, cycling weapons
    for (let i = 0; i < 3; i++) {
      // Cycle weapon
      const wIdx = ((stageIdx * 3 + i) * 4) % Math.max(WEAPON_COUNT, 1);
      const wName = await page.evaluate((wi) => {
        try {
          if (typeof Weapons !== 'undefined' && Weapons.switchTo) {
            Weapons.switchTo(wi);
            const info = Weapons.getWeaponInfo(wi);
            return info ? (info.name || 'unknown') : 'no-info';
          }
        } catch (e) { return 'err:' + e.message; }
        return 'no-api';
      }, wIdx);
      // Move player a bit
      await page.evaluate(() => {
        try {
          const p = GameManager.getPlayer();
          if (p && p.position) {
            p.position.x += (Math.random() - 0.5) * 4;
            p.position.z += (Math.random() - 0.5) * 4;
          }
          // Yaw rotate
          if (window.CameraSystem && CameraSystem.setYaw) {
            CameraSystem.setYaw((Math.random() * 2 - 1) * Math.PI);
          }
        } catch (e) {}
      });
      // Fire briefly
      await page.evaluate(() => { if (GameManager._testFireStart) GameManager._testFireStart(); });
      await new Promise(r => setTimeout(r, 600));
      await page.evaluate(() => { if (GameManager._testFireStop) GameManager._testFireStop(); });

      await new Promise(r => setTimeout(r, 2400));
      const safeName = String(wName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 14);
      await shot(`stage${stageIdx}-w${wIdx}-${safeName}`);
    }
  }

  // Final overview
  await new Promise(r => setTimeout(r, 1000));
  await shot('final');

  console.log(`\n[TOUR] Captured ${idx} screenshots in ${SHOTS_DIR}`);
  console.log(`[TOUR] Errors: ${errors.length}`);
  if (errors.length) errors.slice(0, 15).forEach(e => console.log('  ' + e));

  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
})().catch(err => { console.error('FATAL', err); process.exit(1); });
