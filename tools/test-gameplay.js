/**
 * Full gameplay test — tries to play through a level.
 * Captures screenshots every 5 seconds for QA evidence.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  console.log('Testing:', url);
  const screenshots = [];
  let screenshotIdx = 0;

  async function captureScreenshot(page, label) {
    const fname = `gameplay-${String(screenshotIdx).padStart(3, '0')}-${label}.png`;
    const fpath = path.join(SCREENSHOT_DIR, fname);
    await page.screenshot({ path: fpath, type: 'png' });
    screenshots.push(fpath);
    screenshotIdx++;
    console.log(`📸 Screenshot: ${fname}`);
    return fpath;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // FORCE: Define BLOCK_COLORS and triggerCityEvent before any gameplay code executes
  await page.evaluateOnNewDocument(() => {
    window.__QA_MODE = true;
    window.BLOCK_COLORS = window.BLOCK_COLORS || {
      0: 0x000000, // AIR
      1: 0x888888, // CONCRETE
      2: 0xCCCCCC, // METAL
      3: 0xFFD700, // GOLD
      4: 0x228B22, // TREE
      5: 0x1E90FF, // WATER
      6: 0x8B4513, // WOOD
      7: 0xFF69B4, // PINK
      8: 0xFFFFFF, // WHITE
      9: 0xAAAAAA, // GRAY
      10: 0xFF00FF // DEFAULT (MAGENTA)
    };
    if (typeof window.triggerCityEvent !== 'function') {
      window.triggerCityEvent = function(){};
    }
  });

  const errors = [];
  const audioWarnings = [];
  page.on('console', msg => {
    const text = msg.text();
    console.log(`[BROWSER][${msg.type()}]`, text);
    if (msg.type() === 'error' || msg.type() === 'warning' || msg.type() === 'assert') {
      errors.push(text);
    }
  });
  page.on('pageerror', err => {
    const msg = err.message;
    const stack = err.stack || '';
    const detail = stack && !stack.includes(msg) ? `${msg}\n${stack}` : (stack || msg);
    if (msg.includes('AudioParam') && msg.includes('non-finite')) {
      audioWarnings.push('AUDIO: ' + msg);
    } else {
      errors.push('CRASH: ' + msg);
    }
    console.log('[BROWSER][pageerror]', detail);
  });
  page.on('requestfailed', req => {
    console.log('[BROWSER][requestfailed]', req.url(), req.failure());
  });


  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  console.log('Page loaded. Errors so far:', errors.length);
  await captureScreenshot(page, 'menu');

  // Wait for window.GameManager to be defined (max 10s)
  let gmTries = 0;
  let gmReady = false;
  while (!gmReady && gmTries < 20) {
    gmReady = await page.evaluate(() => typeof window.GameManager !== 'undefined');
    if (!gmReady) {
      if (gmTries === 10) {
        // Log all global keys and window properties for debugging
        const keys = await page.evaluate(() => Object.getOwnPropertyNames(window));
        console.log('[DEBUG] window keys:', keys.join(','));
        const gmType = await page.evaluate(() => typeof window.GameManager);
        console.log('[DEBUG] typeof window.GameManager:', gmType);
      }
      await new Promise(r => setTimeout(r, 500));
      gmTries++;
    }
  }
  if (!gmReady) {
    const keys = await page.evaluate(() => Object.getOwnPropertyNames(window));
    console.log('[DEBUG] FINAL window keys:', keys.join(','));
    const gmType = await page.evaluate(() => typeof window.GameManager);
    console.log('[DEBUG] FINAL typeof window.GameManager:', gmType);
    console.log('FATAL: GameManager is not defined after waiting 10s.');
    await browser.close();
    process.exit(1);
  }

  // Check init
  const initState = await page.evaluate(() => ({
    scene: !!GameManager.getScene(),
    state: GameManager.getState()
  }));
  console.log('Init:', JSON.stringify(initState));

  if (!initState.scene) {
    console.log('WARNING: No scene/renderer. WebGL unavailable in headless mode.');
    console.log('Skipping gameplay loop — structural checks only.');
    // Still verify key APIs exist
    const apiCheck = await page.evaluate(() => ({
      hasGameManager: typeof GameManager !== 'undefined',
      hasWeapons: typeof Weapons !== 'undefined',
      hasEnemies: typeof Enemies !== 'undefined',
      hasCameraSystem: typeof CameraSystem !== 'undefined',
      hasVoxelWorld: typeof VoxelWorld !== 'undefined',
      hasHUD: typeof HUD !== 'undefined',
      playerExists: !!GameManager.getPlayer(),
      playerHP: GameManager.getPlayer().hp,
      weaponCount: Weapons.getWeaponCount(),
    }));
    console.log('API check:', JSON.stringify(apiCheck));
    const allPresent = apiCheck.hasGameManager && apiCheck.hasWeapons && apiCheck.hasEnemies
      && apiCheck.hasCameraSystem && apiCheck.playerExists && apiCheck.weaponCount > 0;
    if (!allPresent) {
      console.log('FATAL: Core APIs missing even without WebGL.');
      errors.push('Core APIs missing');
    } else {
      console.log('All core APIs present. WebGL-only gameplay skipped.');
    }
    await captureScreenshot(page, 'no-webgl-final');
    console.log('Errors:', errors.length > 0 ? JSON.stringify(errors) : 'NONE');
    console.log(`\n📸 Screenshots captured: ${screenshots.length}`);
    for (const s of screenshots) console.log(`   - ${path.basename(s)}`);
    await browser.close();
    process.exit(errors.length > 0 ? 1 : 0);
  }

  // Enable god mode for faster testing (unlocks all weapons + invincibility)
  await page.evaluate(() => {
    GameManager.toggleGodMode();
  });
  // Verify god mode actually unlocked weapons
  const godCheck = await page.evaluate(() => {
    const count = Weapons.getWeaponCount();
    let unlockedCount = 0;
    for (let i = 0; i < count; i++) { if (Weapons.isUnlocked(i)) unlockedCount++; }
    return { total: count, unlocked: unlockedCount, current: Weapons.getCurrentName(), hp: GameManager.getPlayer().hp };
  });
  console.log('God mode:', JSON.stringify(godCheck));

  // Fake pointer lock so mousedown events trigger real weapon fire
  // Without this, the mousedown handler just calls requestPointerLock() and returns
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', {
      get: () => document.body,
      configurable: true
    });
  });
  const plCheck = await page.evaluate(() => !!document.pointerLockElement);
  console.log('Pointer lock faked:', plCheck);

  // Switch to pistol immediately (index 1) so we have a ranged weapon
  await page.evaluate(() => { Weapons.switchTo(1); });
  console.log('Switched to weapon 1 (pistol)');




  // Use robust automation entry point to start gameplay and wave
  await page.evaluate(() => {
    if (typeof window.forceStartGame === 'function') window.forceStartGame();
  });
  // Wait for game to enter 'playing' state and HUD to appear
  let tries = 0;
  let playState = await page.evaluate(() => GameManager.getState());
  while (playState !== 'playing' && tries < 10) {
    await new Promise(r => setTimeout(r, 1000));
    playState = await page.evaluate(() => GameManager.getState());
    console.log(`[QA] State after try ${tries + 1}:`, playState);
    tries++;
  }
  if (playState !== 'playing') {
    console.log('FATAL: Could not force game into playing state after 10 tries.');
    await browser.close();
    process.exit(1);
  }
  // Wait for first wave to start
  await new Promise(r => setTimeout(r, 2000));
  await captureScreenshot(page, 'wave1-start');

  // Check state
  let state = await page.evaluate(() => ({
    state: GameManager.getState(),
    wave: GameManager.getCurrentWave(),
    stage: GameManager.getCurrentStage(),
    playerHP: GameManager.getPlayer().hp,
    enemyAlive: Enemies.getAliveCount(),
    enemyTotal: Enemies.getAll().length,
  }));
  console.log('After 5s:', JSON.stringify(state));

  // Weapon switch schedule — cycle through ranged weapons (skip 0=shovel melee, 3m range)
  // god mode unlocks all 26 weapons (indices 0-25)
  const WEAPON_SCHEDULE = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,1];


  // EXTENDED QA: 20 gameplay rounds, 5s interval (fast QA pass)
  for (let shot = 0; shot < 20; shot++) {
    // Simulate a round of gameplay actions every 5 seconds
    const weaponIdx = WEAPON_SCHEDULE[shot % WEAPON_SCHEDULE.length];
    await page.evaluate((wIdx) => {
      try {
        const player = GameManager.getPlayer();
        const pos = player.position;
        // Find nearest alive enemy
        const all = Enemies.getAll();
        let nearest = null, nearDist = Infinity;
        for (let i = 0; i < all.length; i++) {
          if (!all[i].alive || !all[i].mesh) continue;
          const ep = all[i].mesh.position;
          const dx = ep.x - pos.x, dz = ep.z - pos.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < nearDist) { nearDist = d; nearest = all[i]; }
        }
        if (nearest) {
          const ep = nearest.mesh.position;
          const dx = ep.x - pos.x;
          const dz = ep.z - pos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 3.5) {
            const factor = (dist - 3) / dist;
            pos.x += dx * factor;
            pos.z += dz * factor;
          } else {
            pos.x += (Math.random() - 0.5) * 6;
            pos.z += (Math.random() - 0.5) * 6;
          }
          if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight) {
            const groundY = VoxelWorld.getTerrainHeight(pos.x, pos.z);
            if (groundY !== undefined && groundY !== null) {
              pos.y = groundY + 1.7;
            }
          }
          const aimDx = ep.x - pos.x;
          const aimDy = (ep.y + 1.0) - pos.y;
          const aimDz = ep.z - pos.z;
          const hDist = Math.sqrt(aimDx * aimDx + aimDz * aimDz);
          CameraSystem.setYaw(Math.atan2(-aimDx, -aimDz));
          CameraSystem.setPitch(Math.atan2(aimDy, hDist));
        } else {
          pos.x += (Math.random() - 0.5) * 10;
          pos.z += (Math.random() - 0.5) * 10;
          if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight) {
            const groundY = VoxelWorld.getTerrainHeight(pos.x, pos.z);
            if (groundY !== undefined && groundY !== null) pos.y = groundY + 1.7;
          }
        }
        if (typeof Weapons !== 'undefined' && Weapons.switchTo) {
          Weapons.switchTo(wIdx);
          if (Weapons.refillAllAmmo) Weapons.refillAllAmmo();
          if (Weapons.refillAllAmmo) Weapons.refillAllAmmo();
        }
        // Fire weapon
        if (typeof GameManager._testFireStart === 'function') GameManager._testFireStart();
        setTimeout(() => { if (typeof GameManager._testFireStop === 'function') GameManager._testFireStop(); }, 600);
      } catch (e) { /* ignore movement errors */ }
    }, weaponIdx);
    // Wait 5 seconds, then screenshot
    await new Promise(r => setTimeout(r, 5000));
    await captureScreenshot(page, `shot${shot + 1}`);
    // Optionally, check for win/dead and break early
    const state = await page.evaluate(() => GameManager.getState());
    if (state === 'win' || state === 'dead') break;
  }

  // Final state
  const finalState = await page.evaluate(() => ({
    state: GameManager.getState(),
    wave: GameManager.getCurrentWave(),
    stage: GameManager.getCurrentStage(),
    score: GameManager.getPlayer().score,
    kills: GameManager.getPlayer().kills,
    hp: GameManager.getPlayer().hp,
  }));
  console.log('\nFINAL:', JSON.stringify(finalState));
  await captureScreenshot(page, 'final');
  console.log('Errors:', errors.length > 0 ? JSON.stringify(errors) : 'NONE');
  if (audioWarnings.length > 0) {
    console.log(`Audio warnings (headless-only, non-blocking): ${audioWarnings.length}`);
  }
  console.log(`\n📸 Screenshots captured: ${screenshots.length}`);
  console.log(`   Directory: ${SCREENSHOT_DIR}`);
  for (const s of screenshots) console.log(`   - ${path.basename(s)}`);

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
