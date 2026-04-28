// QA: per-NPC ML brain — verifies brains attach, learn, and clear with session.
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { assertGameReady } = require('./qa-verify');

const URL = process.argv[2] || 'http://localhost:3000';
const SHOTS = path.resolve(__dirname, 'screenshots', 'npc-ml');
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

    // Verify NPCML module exists
    const hasNPCML = await page.evaluate(() => typeof window.NPCML === 'object' && typeof window.NPCML.createBrain === 'function');
    if (!hasNPCML) { console.error('[FAIL] NPCML module not found on window'); process.exit(2); }
    console.log('[NPCML] module exposed: OK');

    // Wait for entities to spawn naturally
    await new Promise(r => setTimeout(r, 4000));

    // Sample 1: count brains attached to live entities
    const sample1 = await page.evaluate(() => {
      const stats = window.NPCML.getStats();
      const npcs = (window.NPCSystem && window.NPCSystem.getAll) ? window.NPCSystem.getAll() : [];
      const enemies = (window.Enemies && window.Enemies.getAll) ? window.Enemies.getAll() : [];
      const npcWithBrain = npcs.filter(n => n && n.alive && n._ml).length;
      const enemyWithBrain = enemies.filter(e => e && e.alive && e._ml).length;
      const sampleBrain = (npcs.find(n => n && n._ml) || enemies.find(e => e && e._ml) || {})._ml || null;
      return {
        stats, npcCount: npcs.length, enemyCount: enemies.length,
        npcWithBrain, enemyWithBrain,
        sampleBrainShape: sampleBrain ? Object.keys(sampleBrain) : null,
        sampleAggression: sampleBrain ? sampleBrain.aggression : null,
      };
    });
    console.log('[NPCML] sample1:', JSON.stringify(sample1, null, 2));

    if (sample1.stats.brainsCreated === 0) {
      console.error('[FAIL] No brains created at all — createBrain hook never fired.');
      process.exit(3);
    }

    // Force combat: spawn ASSAULT_DUGOUTS to ensure firefight, then let it run
    await page.evaluate(() => {
      if (window.GameManager && window.GameManager.setGodMode) window.GameManager.setGodMode(true);
      const p = window.GameManager.getPlayerPos ? window.GameManager.getPlayerPos() : { x: 0, z: 0 };
      if (window.MissionTypes && window.MissionTypes.startMission) {
        window.MissionTypes.startMission('ASSAULT_DUGOUTS', p.x + 20, p.z + 20);
      }
    });
    await new Promise(r => setTimeout(r, 8000));

    // Manually inject some shots/damage to confirm event hooks fire end-to-end
    await page.evaluate(() => {
      const enemies = (window.Enemies && window.Enemies.getAll) ? window.Enemies.getAll() : [];
      const live = enemies.filter(e => e && e.alive).slice(0, 5);
      for (const e of live) {
        if (window.Enemies.damage) window.Enemies.damage(e, 10, false, 'PISTOL');
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    const sample2 = await page.evaluate(() => {
      const stats = window.NPCML.getStats();
      // Find a brain with data
      const enemies = (window.Enemies && window.Enemies.getAll) ? window.Enemies.getAll() : [];
      const hurt = enemies.filter(e => e && e._ml && e._ml.damageTaken > 0).map(e => ({
        type: e.typeName,
        damageTaken: +e._ml.damageTaken.toFixed(2),
        caution: +e._ml.caution.toFixed(3),
        sectorDmg: Array.from(e._ml.sectorDmg).map(v => +v.toFixed(2)),
        wepEff: e._ml.wepEff,
      }));
      return { stats, hurtBrains: hurt.length, samples: hurt.slice(0, 3) };
    });
    console.log('[NPCML] sample2 (after damage):', JSON.stringify(sample2, null, 2));

    if (sample2.hurtBrains === 0) {
      console.error('[FAIL] No brain registered damage events after explicit damage call.');
      process.exit(4);
    }
    if (sample2.stats.totalDmgTaken <= 0) {
      console.error('[FAIL] Aggregate dmg taken is 0 — onDamaged hook not firing.');
      process.exit(5);
    }

    // Test clear() resets aggregate
    await page.evaluate(() => { window.NPCML.clear(); });
    const afterClear = await page.evaluate(() => window.NPCML.getStats());
    console.log('[NPCML] after clear:', JSON.stringify(afterClear));
    if (afterClear.totalShots !== 0 || afterClear.totalDmgTaken !== 0 || afterClear.brainsCreated !== 0) {
      console.error('[FAIL] clear() did not reset session aggregates.');
      process.exit(6);
    }

    await page.screenshot({ path: path.join(SHOTS, 'final.png') });
    console.log('[NPCML] PASS — per-NPC brains attach, learn, and clear with session.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('[ERR]', e); process.exit(1); });
