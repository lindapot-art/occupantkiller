// Live verification of vehicle entry / driving / firing.
// Spawns a vehicle near the player, walks them in via getNearby+enter,
// drives forward 2s, fires 1.5s, screenshots each phase, and prints PASS/FAIL.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  page.on('console', m => { const t=m.type(); if (t==='error') console.log('[CONSOLE-ERR]', m.text()); });
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // wait for game manager + preloader
  for (let i=0;i<200;i++){ if (await page.evaluate(()=>!!(window.GameManager&&window.GameManager.startGame))) break; await new Promise(r=>setTimeout(r,100)); }
  for (let i=0;i<100;i++){ if (await page.evaluate(()=>{const p=document.getElementById('boot-preloader');return !p||p.style.opacity==='0';})) break; await new Promise(r=>setTimeout(r,100)); }
  // start game
  await page.evaluate(()=>{const b=document.getElementById('quick-start-btn');b&&b.click();});
  await new Promise(r=>setTimeout(r,2500));

  const outDir = path.join(__dirname,'screenshots','vehicle-proof');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});

  const checks = [];

  // ── Phase 1: spawn a vehicle 4m in front of the player ──
  const spawnInfo = await page.evaluate(() => {
    const VS = window.VehicleSystem;
    if (!VS) return { error: 'VehicleSystem not on window' };
    const player = window.GameManager.getPlayer();
    if (!player) return { error: 'no player' };
    // spawn just in front of player so getNearby(5) finds it
    const x = player.position.x + 3;
    const y = player.position.y;
    const z = player.position.z;
    const v = VS.spawn(x, y, z, 'combat');
    return v ? { ok: true, id: v.id, type: v.type, alive: v.alive, hp: v.hp, pos: { x: v.position.x, y: v.position.y, z: v.position.z } } : { error: 'spawn returned null' };
  });
  console.log('SPAWN:', spawnInfo);
  checks.push({ name: 'vehicle spawn returns object', pass: !!(spawnInfo && spawnInfo.ok) });
  await new Promise(r=>setTimeout(r,400));
  await page.screenshot({ path: path.join(outDir,'01-spawned.png') });

  // ── Phase 2: enter the vehicle WE just spawned (not whatever else is around) ──
  const enterInfo = await page.evaluate((spawnedId) => {
    const VS = window.VehicleSystem;
    const ok = VS.enter(spawnedId);
    const occ = VS.getOccupied();
    return { ok, inVehicle: VS.isInVehicle(), occupiedId: occ ? occ.id : null, occupiedType: occ ? occ.type : null };
  }, spawnInfo.id);
  console.log('ENTER:', enterInfo);
  checks.push({ name: 'enter() returns true on our combat vehicle', pass: enterInfo.ok === true });
  checks.push({ name: 'isInVehicle() true after enter', pass: enterInfo.inVehicle === true });
  checks.push({ name: 'occupied vehicle is the combat we spawned', pass: enterInfo.occupiedId === spawnInfo.id });
  await new Promise(r=>setTimeout(r,500));
  await page.screenshot({ path: path.join(outDir,'02-entered.png') });

  // ── Phase 3: drive forward (W) for 3s ──
  const startPos = await page.evaluate(() => {
    const occ = window.VehicleSystem.getOccupied();
    return occ ? { x: occ.position.x, y: occ.position.y, z: occ.position.z } : null;
  });
  console.log('PRE-DRIVE pos:', startPos);
  await page.evaluate(() => window.VehicleSystem.setVehicleKey('w', true));
  await new Promise(r=>setTimeout(r,3000));
  const midPos = await page.evaluate(() => {
    const occ = window.VehicleSystem.getOccupied();
    return occ ? { x: occ.position.x, y: occ.position.y, z: occ.position.z, vel: { x: occ.velocity.x, z: occ.velocity.z, mag: Math.hypot(occ.velocity.x, occ.velocity.z) } } : null;
  });
  console.log('MID-DRIVE pos:', midPos);
  await page.screenshot({ path: path.join(outDir,'03-driving.png') });
  await page.evaluate(() => window.VehicleSystem.setVehicleKey('w', false));
  const dist = startPos && midPos ? Math.hypot(midPos.x-startPos.x, midPos.z-startPos.z) : 0;
  console.log('Drive distance:', dist.toFixed(2), 'm  /  speed mag:', midPos ? midPos.vel.mag.toFixed(2) : '?', 'm/s');
  checks.push({ name: 'vehicle moved >3m after pressing W for 3s', pass: dist > 3 });
  checks.push({ name: 'vehicle reached speed > 4 m/s', pass: !!midPos && midPos.vel.mag > 4 });

  // ── Phase 4: fire turret for 2.5s. Force cooldown to 0 first so we don't lose the first shot. ──
  // First, stop the vehicle and elevate it 30m so projectiles fly into open sky (not into terrain).
  // fireTurret uses only camera yaw → horizontal dir — so we need clear horizontal sightlines.
  await page.evaluate(() => {
    const occ = window.VehicleSystem.getOccupied();
    if (occ) {
      occ.velocity.set(0,0,0);
      occ.position.y += 30;
      if (occ.mesh) occ.mesh.position.copy(occ.position);
    }
  });
  await new Promise(r=>setTimeout(r,300));
  const preFire = await page.evaluate(() => {
    const occ = window.VehicleSystem.getOccupied();
    if (occ) occ.fireCooldown = 0;
    const scene = window.GameManager.getScene();
    return {
      fireCooldown: occ ? occ.fireCooldown : -1,
      damage: occ ? occ.damage : -1,
      fireRate: occ ? occ.fireRate : -1,
      childCount: scene.children.length,
      projCount: window.VehicleSystem.getProjectileCount ? window.VehicleSystem.getProjectileCount() : -1,
    };
  });
  console.log('PRE-FIRE:', preFire);
  await page.evaluate(() => {
    // Use the official test hook so GameManager's updateCombat won't immediately
    // clobber _vKeys.fire on the next frame.
    if (window.GameManager && window.GameManager._testFireStart) window.GameManager._testFireStart();
    else window.VehicleSystem.setVehicleKey('fire', true);
  });
  // Sanity: confirm fire flag is actually set after we toggle it
  const fireFlagDbg = await page.evaluate(() => {
    return {
      vsExists: typeof window.VehicleSystem !== 'undefined',
      gmUpdateExists: typeof window.GameManager !== 'undefined',
      occupied: !!window.VehicleSystem.getOccupied(),
      hasTestHook: !!(window.GameManager && window.GameManager._testFireStart),
    };
  });
  console.log('FIRE FLAG DBG:', fireFlagDbg);
  // Snapshot game state and _vKeys.fire periodically to diagnose
  const stateDbg = await page.evaluate(() => {
    return {
      gameState: window.GameManager.getState ? window.GameManager.getState() : '?',
    };
  });
  console.log('STATE DBG:', stateDbg);
  let peakProj = 0, peakChildren = 0, totalShots = 0, lastProj = preFire.projCount;
  let firstFireKeys = null;
  for (let i=0; i<28; i++) {
    const sample = await page.evaluate(() => {
      const scene = window.GameManager.getScene();
      const occ = window.VehicleSystem.getOccupied();
      const keys = window.VehicleSystem._getVehicleKeys ? window.VehicleSystem._getVehicleKeys() : null;
      return {
        childCount: scene.children.length,
        projCount: window.VehicleSystem.getProjectileCount ? window.VehicleSystem.getProjectileCount() : -1,
        cd: occ ? occ.fireCooldown : -1,
        damage: occ ? occ.damage : -1,
        keys: keys,
      };
    });
    if (i === 3) firstFireKeys = sample;
    if (i % 5 === 0) console.log('  sample i='+i, 'cd='+(sample.cd?.toFixed(2)), 'fire='+sample.keys?.fire, 'proj='+sample.projCount);
    if (sample.projCount > peakProj) peakProj = sample.projCount;
    if (sample.childCount > peakChildren) peakChildren = sample.childCount;
    if (sample.projCount > lastProj) totalShots += (sample.projCount - lastProj);
    lastProj = sample.projCount;
    if (i === 5) await page.screenshot({ path: path.join(outDir,'04-firing.png') });
    await new Promise(r=>setTimeout(r,100));
  }
  await page.evaluate(() => {
    if (window.GameManager && window.GameManager._testFireStop) window.GameManager._testFireStop();
    window.VehicleSystem.setVehicleKey('fire', false);
  });
  console.log('FIRE: peakProjectiles=', peakProj, ' peakChildren=', peakChildren, '(was', preFire.childCount + ')  approxShotsObserved=', totalShots);
  console.log('MID-FIRE sample (i=3):', firstFireKeys);
  // Direct fireTurret() bypass to isolate where the failure is
  const directFire = await page.evaluate(() => {
    const occ = window.VehicleSystem.getOccupied();
    if (!occ) return { error: 'no occupied vehicle' };
    occ.fireCooldown = 0;
    const before = window.VehicleSystem.getProjectileCount();
    // VehicleSystem.fireTurret is exposed
    if (typeof window.VehicleSystem.fireTurret === 'function') {
      window.VehicleSystem.fireTurret(occ);
    }
    const after = window.VehicleSystem.getProjectileCount();
    return { before, after, fired: after > before };
  });
  console.log('DIRECT fireTurret call:', directFire);
  checks.push({ name: 'vehicle has damage value > 0', pass: preFire.damage > 0 });
  checks.push({ name: 'turret spawned at least 1 projectile while firing', pass: peakProj > preFire.projCount });

  // ── Phase 5: exit ──
  const exitInfo = await page.evaluate(() => {
    const VS = window.VehicleSystem;
    const exitPos = VS.exit();
    return { exitPos: exitPos ? { x: exitPos.x, y: exitPos.y, z: exitPos.z } : null, inVehicle: VS.isInVehicle() };
  });
  console.log('EXIT:', exitInfo);
  checks.push({ name: 'exit() returned position', pass: !!exitInfo.exitPos });
  checks.push({ name: 'isInVehicle() false after exit', pass: exitInfo.inVehicle === false });
  await new Promise(r=>setTimeout(r,500));
  await page.screenshot({ path: path.join(outDir,'05-exited.png') });

  console.log('\n=== VERDICT ===');
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? 'PASS' : 'FAIL') + ' :: ' + c.name);
    if (!c.pass) allPass = false;
  }
  console.log(allPass ? '\nALL CHECKS PASSED' : '\nFAILURES PRESENT');
  await browser.close();
  process.exit(allPass ? 0 : 1);
})();
