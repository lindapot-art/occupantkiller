// QA probe: triggers ASSAULT_DUGOUTS, polls enemy positions over 10s.
// Asserts garrison defenders stay anchored to their dugout posts (no random wandering).
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { assertGameReady } = require('./qa-verify');

const URL = process.argv[2] || 'http://localhost:3000';
const SHOTS = path.resolve(__dirname, 'screenshots', 'dugout-garrison');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1280,720']
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.on('pageerror', e => console.log('[PAGEERR]', e.message));

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => { if (window.GameManager && window.GameManager.forceStartGame) window.GameManager.forceStartGame(); });
    await new Promise(r => setTimeout(r, 3000));
    await assertGameReady(page, { timeoutMs: 45000 });

    // god mode + start mission
    await page.evaluate(() => {
      if (window.GameManager) {
        if (window.GameManager.setGodMode) window.GameManager.setGodMode(true);
        var p = window.GameManager.getPlayerPos ? window.GameManager.getPlayerPos() : { x: 0, z: 0 };
        if (window.MissionTypes && window.MissionTypes.startMission) {
          window.MissionTypes.startMission('ASSAULT_DUGOUTS', p.x + 25, p.z + 25);
        }
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    // Snapshot enemy positions over time
    const samples = [];
    for (let i = 0; i < 6; i++) {
      const snap = await page.evaluate(() => {
        if (!window.Enemies || !window.Enemies.getAll) return [];
        return window.Enemies.getAll().filter(e => e && e.alive).map(e => ({
          id: e.id,
          type: e.typeName,
          x: +e.mesh.position.x.toFixed(2),
          z: +e.mesh.position.z.toFixed(2),
          guardPost: e._guardPost ? { x: +e._guardPost.x.toFixed(2), z: +e._guardPost.z.toFixed(2) } : null,
          role: e._garrisonRole || null,
          spotted: !!e.playerSpotted
        }));
      });
      samples.push(snap);
      await page.screenshot({ path: path.join(SHOTS, `garrison-${String(i).padStart(2, '0')}.png`) });
      await new Promise(r => setTimeout(r, 1500));
    }

    // Diagnostic: print first/last positions for guard-bound enemies
    const first = samples[0];
    const last = samples[samples.length - 1];
    let guardCount = 0, driftedCount = 0, maxDrift = 0;
    for (const e of first) {
      if (!e.guardPost) continue;
      const eLast = last.find(x => x.id === e.id);
      if (!eLast) continue;
      guardCount++;
      const dx = eLast.x - e.guardPost.x;
      const dz = eLast.z - e.guardPost.z;
      const drift = Math.sqrt(dx * dx + dz * dz);
      maxDrift = Math.max(maxDrift, drift);
      if (drift > 8) driftedCount++; // leash is 5*2.5=12.5 max, but garrisons should be tighter
      console.log(`  enemy ${e.id} (${e.role}): post=(${e.guardPost.x},${e.guardPost.z}) now=(${eLast.x},${eLast.z}) drift=${drift.toFixed(2)}m spotted=${eLast.spotted}`);
    }
    console.log(`[GARRISON] guards=${guardCount} drifted(>8m)=${driftedCount} maxDrift=${maxDrift.toFixed(2)}m`);
    if (guardCount === 0) {
      console.error('[FAIL] No guard-bound enemies found — mission spawn failed.');
      process.exit(2);
    }
    if (driftedCount > guardCount * 0.3) {
      console.error('[FAIL] More than 30% of garrison drifted >8m from their post.');
      process.exit(3);
    }
    console.log('[GARRISON] PASS — garrison holds position.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('[ERR]', e); process.exit(1); });
