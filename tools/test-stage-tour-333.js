// tools/test-stage-tour-333.js — Visit all 4 stages, capture 333 screenshots/stage every 4s
// Plays the game: cycles weapons, kills drones, fires bursts, runs missions, places dugouts in god mode.
// Usage: node tools/test-stage-tour-333.js [http://localhost:3000] [shotsPerStage=333] [intervalMs=4000]

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { assertGameReady, assertFramesVary } = require('./qa-verify');

const URL_BASE  = process.argv[2] || 'http://localhost:3000';
const PER_STAGE = parseInt(process.argv[3] || '333', 10);
const INTERVAL  = parseInt(process.argv[4] || '4000', 10);

const SHOTS_DIR = path.join(__dirname, 'screenshots', 'stage-tour-333');
if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
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

  console.log(`[TOUR-333] ${URL_BASE} | ${PER_STAGE} shots/stage @ ${INTERVAL}ms`);
  await page.goto(URL_BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  for (let i = 0; i < 40 && !(await page.evaluate(() => typeof window.GameManager !== 'undefined')); i++) {
    await sleep(250);
  }
  await page.evaluate(() => { if (window.forceStartGame) window.forceStartGame(); });
  await sleep(3000);

  // HARD GATE — exits non-zero if boot-error overlay visible or required modules missing.
  // Cannot be silenced. Replaces the silent try/catch hide-failure pattern.
  await assertGameReady(page, { timeoutMs: 45000 });

  // Unlock all + god mode (gives all materials, all weapons, infinite grenades, all perks)
  await page.evaluate(() => {
    if (typeof Weapons !== 'undefined' && Weapons.unlockWeapon) {
      const n = Weapons.getWeaponCount();
      for (let i = 0; i < n; i++) Weapons.unlockWeapon(i);
    }
    if (window.GameManager && !GameManager.isGodMode()) GameManager.toggleGodMode();
  });

  const STAGES = [0, 1, 2, 3];
  const WEAPON_COUNT = await page.evaluate(() =>
    (typeof Weapons !== 'undefined' && Weapons.getWeaponCount) ? Weapons.getWeaponCount() : 26);
  console.log('[TOUR-333] Weapons:', WEAPON_COUNT);

  let totalShots = 0;

  async function captureFrame(stageIdx, frame) {
    const name = `stage${stageIdx}-frame${String(frame).padStart(4,'0')}.png`;
    await page.screenshot({ path: path.join(SHOTS_DIR, name), type: 'png' });
    totalShots++;
  }

  for (const stageIdx of STAGES) {
    await page.evaluate((s) => {
      try {
        let guard = 12;
        while (GameManager.getCurrentStage() < s && guard-- > 0) {
          if (typeof GameManager.nextStage === 'function') GameManager.nextStage();
          else break;
        }
      } catch (e) {}
    }, stageIdx);
    await sleep(2500);

    const info = await page.evaluate(() => {
      const s = GameManager.getStageInfo ? GameManager.getStageInfo() : null;
      return { name: s ? s.name : '?', stage: GameManager.getCurrentStage() };
    });
    console.log(`\n[STAGE ${info.stage}] ${info.name} — capturing ${PER_STAGE} frames`);

    for (let f = 0; f < PER_STAGE; f++) {
      // Per-frame gameplay action mix
      await page.evaluate((args) => {
        try {
          const f = args.f;
          const wc = args.wc;
          // Cycle weapon every 2 frames
          if (f % 2 === 0 && typeof Weapons !== 'undefined' && Weapons.switchTo) {
            Weapons.switchTo(f % wc);
          }
          // Random move + yaw
          const p = GameManager.getPlayer && GameManager.getPlayer();
          if (p && p.position) {
            p.position.x += (Math.random() - 0.5) * 6;
            p.position.z += (Math.random() - 0.5) * 6;
          }
          if (window.CameraSystem && CameraSystem.setYaw) {
            CameraSystem.setYaw((Math.random() * 2 - 1) * Math.PI);
          }
          // Every 8 frames spawn an enemy drone
          if (f % 8 === 4 && window.DroneSystem && DroneSystem.spawnEnemyDrone) {
            try {
              const px = (p && p.position) ? p.position.x : 0;
              const pz = (p && p.position) ? p.position.z : 0;
              DroneSystem.spawnEnemyDrone(px + 8, 12, pz + 8);
            } catch (e) {}
          }
          // Every 12 frames place a dugout near player
          if (f % 12 === 6 && window.VoxelWorld && VoxelWorld.placeDugout && VoxelWorld.getTerrainHeight) {
            try {
              if (p && p.position) {
                const dx = Math.floor(p.position.x + 5);
                const dz = Math.floor(p.position.z + 5);
                const dy = VoxelWorld.getTerrainHeight(dx, dz);
                VoxelWorld.placeDugout(dx, dy, dz, 5);
              }
            } catch (e) {}
          }
          // Every 16 frames start a mission (rotate types incl. ASSAULT_DUGOUTS)
          if (f % 16 === 8 && window.MissionTypes && MissionTypes.startMission) {
            try {
              const types = ['ESCORT','DEMOLITION','CAPTURE_ZONE','ASSASSINATION','RESCUE','DEFUSE','ASSAULT_DUGOUTS'];
              const id = types[Math.floor(f / 16) % types.length];
              MissionTypes.startMission(id);
            } catch (e) {}
          }
          // Fire bursts on most frames
          if (f % 3 !== 0 && GameManager._testFireStart) GameManager._testFireStart();
        } catch (e) {
          // Surface per-frame failures instead of swallowing — anti-fake-stamp rule.
          if (window.__qaFrameErrs === undefined) window.__qaFrameErrs = [];
          window.__qaFrameErrs.push(String(e && e.message || e));
        }
      }, { f, wc: Math.max(1, WEAPON_COUNT) });

      await sleep(Math.min(600, INTERVAL / 4));
      await page.evaluate(() => { if (GameManager._testFireStop) GameManager._testFireStop(); });
      await sleep(Math.max(0, INTERVAL - 600));

      await captureFrame(stageIdx, f);
      if (f % 25 === 0) console.log(`  stage${stageIdx} frame ${f}/${PER_STAGE} (errors so far: ${errors.length})`);
    }
  }

  console.log(`\n[TOUR-333] Captured ${totalShots} shots in ${SHOTS_DIR}`);
  console.log(`[TOUR-333] Errors: ${errors.length}`);
  if (errors.length) errors.slice(0, 25).forEach(e => console.log('  ' + e));

  // Surface per-frame action failures (previously swallowed).
  const frameErrs = await page.evaluate(() => window.__qaFrameErrs || []);
  if (frameErrs.length) {
    console.log(`[TOUR-333] Per-frame action failures: ${frameErrs.length}`);
    const counts = {};
    frameErrs.forEach(e => counts[e] = (counts[e] || 0) + 1);
    Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([msg,n]) => console.log(`  x${n}: ${msg}`));
  }

  // HARD GATE — fails if frames are byte-identical (boot error / static screen).
  assertFramesVary(SHOTS_DIR);

  await browser.close();
  process.exit(errors.length === 0 ? 0 : 1);
})().catch(err => { console.error('FATAL', err); process.exit(1); });
