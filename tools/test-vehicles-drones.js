// tools/test-vehicles-drones.js — Headless test for vehicle entry/driving/firing + drone spawning/possession
// Usage: node tools/test-vehicles-drones.js http://localhost:3000

const puppeteer = require('puppeteer');

const url = process.argv[2] || 'http://localhost:3000';
const VEHICLE_TYPES = ['transport', 'combat', 'logistics', 'helicopter', 'plane', 'turret_rover', 'tank'];
const DRONE_TYPES   = ['recon', 'fpv_attack', 'bomb', 'surveillance', 'kamikaze',
                       'enemy_bomber', 'enemy_fpv', 'enemy_observer'];

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
    if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
  });

  console.log('[TEST] Loading', url);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for GameManager
  for (let i = 0; i < 30 && !(await page.evaluate(() => typeof window.GameManager !== 'undefined')); i++) {
    await new Promise(r => setTimeout(r, 250));
  }
  // Force start
  await page.evaluate(() => {
    if (typeof window.forceStartGame === 'function') window.forceStartGame();
  });
  await new Promise(r => setTimeout(r, 2500));

  /* ─── VEHICLE TESTS ─── */
  console.log('\n=== VEHICLE TESTS ===');
  const vehicleResults = await page.evaluate((types) => {
    const out = [];
    if (typeof VehicleSystem === 'undefined') return [{ ok: false, type: '*', reason: 'VehicleSystem undefined' }];
    if (typeof GameManager === 'undefined' || !GameManager.getPlayer) return [{ ok: false, type: '*', reason: 'GameManager missing' }];
    const p = GameManager.getPlayer ? GameManager.getPlayer() : null;
    const px = p && p.position ? p.position.x : 0;
    const pz = p && p.position ? p.position.z : 0;
    const py = p && p.position ? p.position.y : 5;
    for (const t of types) {
      const r = { type: t, ok: false, steps: [] };
      try {
        // Spawn 4m in front
        const v = VehicleSystem.spawn(px + 4, py, pz, t);
        if (!v) { r.reason = 'spawn returned null'; out.push(r); continue; }
        r.steps.push('spawn');
        r.id = v.id;
        // turret_rover is AI-only (seats:0). Skip enter; verify spawn only.
        if (t === 'turret_rover') {
          r.steps.push('ai-only');
          r.ok = true;
          out.push(r);
          continue;
        }
        // Enter
        const entered = VehicleSystem.enter(v.id);
        if (!entered) { r.reason = 'enter returned false'; out.push(r); continue; }
        r.steps.push('enter');
        // Drive: simulate forward velocity for one tick
        const occ = VehicleSystem.getOccupied();
        if (!occ || occ.id !== v.id) { r.reason = 'occupied mismatch'; out.push(r); continue; }
        r.steps.push('occupied');
        // Apply forward thrust if API exists; otherwise just call update
        if (typeof VehicleSystem.update === 'function') {
          VehicleSystem.update(0.1, p ? p.position : null);
          r.steps.push('update');
        }
        // Fire if vehicle has weapons (combat/turret_rover/tank)
        const wepTypes = ['combat', 'turret_rover', 'tank'];
        if (wepTypes.indexOf(t) >= 0) {
          // Fire cannon / turret
          if (t === 'tank' && typeof VehicleSystem.fireTankCannon === 'function') {
            VehicleSystem.fireTankCannon(v);
            r.steps.push('fireCannon');
          }
          if (t === 'tank' && typeof VehicleSystem.fireTankMG === 'function') {
            VehicleSystem.fireTankMG(v);
            r.steps.push('fireMG');
          }
          if (t === 'combat' && typeof VehicleSystem.fireTurret === 'function') {
            VehicleSystem.fireTurret(v);
            r.steps.push('fireTurret');
          }
        }
        // Toggle view if tank
        if (t === 'tank' && typeof VehicleSystem.toggleVehicleView === 'function') {
          VehicleSystem.toggleVehicleView();
          r.steps.push('toggleView');
        }
        // Exit
        const exitPos = VehicleSystem.exit();
        if (!exitPos) { r.reason = 'exit returned null'; out.push(r); continue; }
        r.steps.push('exit');
        r.ok = true;
      } catch (e) {
        r.reason = 'exception: ' + (e && e.message);
      }
      out.push(r);
    }
    return out;
  }, VEHICLE_TYPES);

  let vPass = 0, vFail = 0;
  for (const r of vehicleResults) {
    const tag = r.ok ? 'PASS' : 'FAIL';
    console.log(`  [${tag}] ${r.type}  steps=${(r.steps || []).join(',')}${r.reason ? ' reason=' + r.reason : ''}`);
    if (r.ok) vPass++; else vFail++;
  }

  /* ─── DRONE TESTS ─── */
  console.log('\n=== DRONE TESTS ===');
  const droneResults = await page.evaluate((types) => {
    const out = [];
    if (typeof DroneSystem === 'undefined') return [{ ok: false, type: '*', reason: 'DroneSystem undefined' }];
    const p = (typeof GameManager !== 'undefined' && GameManager.getPlayer) ? GameManager.getPlayer() : null;
    const px = p && p.position ? p.position.x : 0;
    const pz = p && p.position ? p.position.z : 0;
    const py = (p && p.position ? p.position.y : 5) + 8;
    for (const t of types) {
      const r = { type: t, ok: false, steps: [] };
      try {
        let d = null;
        const isEnemy = t.startsWith('enemy_');
        if (isEnemy && typeof DroneSystem.spawnEnemyDrone === 'function') {
          d = DroneSystem.spawnEnemyDrone(px + 6, py, pz + 6, t);
          r.steps.push('spawnEnemy');
        } else if (typeof DroneSystem.spawn === 'function') {
          d = DroneSystem.spawn(px + 6, py, pz + 6, t);
          r.steps.push('spawn');
        }
        if (!d) { r.reason = 'spawn returned null'; out.push(r); continue; }
        r.id = d.id || null;
        // Update one tick
        if (typeof DroneSystem.update === 'function') {
          DroneSystem.update(0.1, p ? p.position : { x: 0, y: 5, z: 0 });
          r.steps.push('update');
        }
        // For player-controllable drones, attempt possession
        const possessable = ['recon', 'fpv_attack', 'bomb', 'surveillance', 'kamikaze'];
        if (possessable.indexOf(t) >= 0) {
          if (typeof DroneSystem.possess === 'function' && d.id) {
            try {
              DroneSystem.possess(d.id);
              r.steps.push('possess');
              if (typeof DroneSystem.release === 'function') {
                DroneSystem.release();
                r.steps.push('release');
              }
            } catch (e) { r.possessErr = e && e.message; }
          }
        }
        r.ok = true;
      } catch (e) {
        r.reason = 'exception: ' + (e && e.message);
      }
      out.push(r);
    }
    return out;
  }, DRONE_TYPES);

  let dPass = 0, dFail = 0;
  for (const r of droneResults) {
    const tag = r.ok ? 'PASS' : 'FAIL';
    console.log(`  [${tag}] ${r.type}  steps=${(r.steps || []).join(',')}${r.reason ? ' reason=' + r.reason : ''}`);
    if (r.ok) dPass++; else dFail++;
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Vehicles: ${vPass}/${VEHICLE_TYPES.length} passed`);
  console.log(`Drones:   ${dPass}/${DRONE_TYPES.length} passed`);
  console.log(`Errors:   ${errors.length}`);
  if (errors.length) {
    console.log('--- ERRORS ---');
    errors.slice(0, 10).forEach(e => console.log('  ' + e));
  }

  await browser.close();
  const allOk = vFail === 0 && dFail === 0 && errors.length === 0;
  console.log(allOk ? '\nVERDICT: PASS' : '\nVERDICT: FAIL');
  process.exit(allOk ? 0 : 1);
})().catch(err => {
  console.error('FATAL', err);
  process.exit(1);
});
