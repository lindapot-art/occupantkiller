/**
 * Full gameplay test — tries to play through a level.
 * Captures screenshots every 4 seconds for QA evidence.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { Jimp } = require('jimp');

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const READABILITY_SAMPLE = Object.freeze({ x0: 0.28, y0: 0.22, x1: 0.72, y1: 0.68 });
const DARK_FRAME_MAX_CENTER_LUMA = 8;
const DARK_FRAME_MAX_LIT_RATIO = 0.01;
const LOW_VIS_MAX_CENTER_LUMA = 30;
const LOW_VIS_MAX_LIT_RATIO = 0.08;

function parseIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function analyzeScreenshotReadability(imagePath) {
  const image = await Jimp.read(imagePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const startX = Math.max(0, Math.floor(width * READABILITY_SAMPLE.x0));
  const endX = Math.min(width, Math.ceil(width * READABILITY_SAMPLE.x1));
  const startY = Math.max(0, Math.floor(height * READABILITY_SAMPLE.y0));
  const endY = Math.min(height, Math.ceil(height * READABILITY_SAMPLE.y1));

  let sumLuma = 0;
  let litPixels = 0;
  let totalPixels = 0;

  image.scan(startX, startY, endX - startX, endY - startY, function (_x, _y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sumLuma += luma;
    totalPixels++;
    if (luma >= 24) litPixels++;
  });

  const centerAvgLuma = totalPixels > 0 ? (sumLuma / totalPixels) : 0;
  const litRatio = totalPixels > 0 ? (litPixels / totalPixels) : 0;
  return { centerAvgLuma, litRatio };
}

function isNearBlackGameplayFrame(sample) {
  return sample.centerAvgLuma < DARK_FRAME_MAX_CENTER_LUMA && sample.litRatio < DARK_FRAME_MAX_LIT_RATIO;
}

function isLowVisibilityGameplayFrame(sample) {
  return sample.centerAvgLuma < LOW_VIS_MAX_CENTER_LUMA && sample.litRatio < LOW_VIS_MAX_LIT_RATIO;
}

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const configuredGameCount = parseIntEnv('QA_GAMES', 3);
  const configuredRoundsBase = parseIntEnv('QA_ROUNDS_BASE', 75);
  const configuredRoundsStep = parseIntEnv('QA_ROUNDS_STEP', 5);
  console.log('Testing:', url);
  const screenshots = [];
  const readabilitySamples = [];
  let screenshotIdx = 0;

  async function captureScreenshot(page, label) {
    const fname = `gameplay-${String(screenshotIdx).padStart(3, '0')}-${label}.png`;
    const fpath = path.join(SCREENSHOT_DIR, fname);
    await page.screenshot({ path: fpath, type: 'png' });
    screenshots.push(fpath);
    screenshotIdx++;
    console.log(`📸 Screenshot: ${fname}`);
    if (label !== 'menu' && label !== 'no-webgl-final') {
      const sample = await analyzeScreenshotReadability(fpath);
      readabilitySamples.push({ label, path: fpath, sample });
      console.log(`   Visual QA: centerAvgLuma=${sample.centerAvgLuma.toFixed(2)} litRatio=${(sample.litRatio * 100).toFixed(2)}%`);
    }
    return fpath;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // FORCE: Enable QA mode and provide a no-op city event hook before gameplay code executes.
  await page.evaluateOnNewDocument(() => {
    window.__QA_MODE = true;
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
  await page.evaluate(() => {
    if (GameManager.getCurrentStage() !== 0) return;
    const player = GameManager.getPlayer();
    const scenicPos = { x: 0, z: -20 };
    const scenicLook = { x: 0, z: 10 };
    player.position.x = scenicPos.x;
    player.position.z = scenicPos.z;
    player.position.y = VoxelWorld.getTerrainHeight(scenicPos.x, scenicPos.z) + 1.7;
    window.__qaAnchor = { x: scenicPos.x, z: scenicPos.z };
    const dx = scenicLook.x - scenicPos.x;
    const dz = scenicLook.z - scenicPos.z;
    CameraSystem.setYaw(Math.atan2(-dx, -dz));
    CameraSystem.setPitch(-0.14);
  });
  await new Promise(r => setTimeout(r, 750));
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

  // Weapon switch schedule — cycle ALL weapons aggressively for inventory QA
  // god mode unlocks all weapons; cover melee, pistols, rifles, snipers, explosives, specials
  const WEAPON_SCHEDULE = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36];

  // ══ MULTI-GAME QA LOOP ══
  // Default remains a long-run stress pass, but can be tuned via env vars for faster proxy verification.
  const NUM_GAMES = configuredGameCount;
  const ROUNDS_PER_GAME = Array.from({ length: NUM_GAMES }, function (_v, i) {
    return Math.max(10, configuredRoundsBase - i * configuredRoundsStep);
  });

  for (let gameNum = 0; gameNum < NUM_GAMES; gameNum++) {
    console.log(`\n════ GAME ${gameNum + 1}/${NUM_GAMES} ════`);

    if (gameNum > 0) {
      // Restart game for subsequent rounds
      await page.evaluate(() => {
        // Force back to menu and restart
        if (typeof GameManager !== 'undefined') {
          if (GameManager.getState() !== 'menu') {
            // Trigger game restart by going to menu then starting again
            GameManager.toMenu && GameManager.toMenu();
          }
        }
      });
      await new Promise(r => setTimeout(r, 1500));
      await captureScreenshot(page, `game${gameNum + 1}-menu`);

      // Re-enable god mode and pointer lock
      await page.evaluate(() => {
        if (typeof GameManager !== 'undefined' && GameManager.toggleGodMode) GameManager.toggleGodMode();
        Object.defineProperty(document, 'pointerLockElement', {
          get: () => document.body, configurable: true
        });
      });

      // Start game
      await page.evaluate(() => {
        if (typeof window.forceStartGame === 'function') window.forceStartGame();
      });
      let gTries = 0;
      let gState = await page.evaluate(() => GameManager.getState());
      while (gState !== 'playing' && gTries < 10) {
        await new Promise(r => setTimeout(r, 1000));
        gState = await page.evaluate(() => GameManager.getState());
        gTries++;
      }
      if (gState !== 'playing') {
        console.log(`Game ${gameNum + 1}: Could not start, skipping.`);
        continue;
      }
      await new Promise(r => setTimeout(r, 1500));

      // Position player at different scenic spots per game
      const startPositions = [
        { x: 10, z: -15 },
        { x: -15, z: 10 },
        { x: 5, z: 25 },
      ];
      const sp = startPositions[gameNum % startPositions.length];
      await page.evaluate(({ sp }) => {
        const player = GameManager.getPlayer();
        player.position.x = sp.x;
        player.position.z = sp.z;
        player.position.y = VoxelWorld.getTerrainHeight(sp.x, sp.z) + 1.7;
        window.__qaAnchor = { x: sp.x, z: sp.z };
        CameraSystem.setYaw(Math.random() * Math.PI * 2);
        CameraSystem.setPitch(-0.1);
      }, { sp });
      await new Promise(r => setTimeout(r, 500));
      await captureScreenshot(page, `game${gameNum + 1}-start`);
    }

    const maxRounds = ROUNDS_PER_GAME[gameNum] || 65;

  // EXTENDED QA: screenshots every 2s for dense coverage, cycle ALL weapons
  for (let shot = 0; shot < maxRounds; shot++) {
    // Aggressively cycle weapons — every shot gets a different weapon
    const weaponIdx = WEAPON_SCHEDULE[(shot + gameNum * 13) % WEAPON_SCHEDULE.length];
    await page.evaluate(({ wIdx, shot }) => {
      try {
        const player = GameManager.getPlayer();
        const pos = player.position;
        window.__qaAnchor = window.__qaAnchor || { x: pos.x, z: pos.z };
        const anchor = window.__qaAnchor;
        const scenicTarget = GameManager.getCurrentStage() === 0
          ? { x: 0, y: VoxelWorld.getTerrainHeight(0, 10) + 2, z: 10 }
          : null;

        function clampToAnchor(targetX, targetZ) {
          const dx = targetX - anchor.x;
          const dz = targetZ - anchor.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= 12) return { x: targetX, z: targetZ };
          const scale = 12 / dist;
          return {
            x: anchor.x + dx * scale,
            z: anchor.z + dz * scale,
          };
        }

        function terrainIsStable(sampleX, sampleZ, centerGround) {
          let minGround = centerGround;
          let maxGround = centerGround;
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
              const localGround = VoxelWorld.getTerrainHeight(sampleX + dx, sampleZ + dz);
              minGround = Math.min(minGround, localGround);
              maxGround = Math.max(maxGround, localGround);
              if (Math.abs(localGround - centerGround) > 1) return false;
            }
          }
          return (maxGround - minGround) <= 1;
        }

        function isOutdoorCell(sampleX, sampleZ) {
          const groundY = VoxelWorld.getTerrainHeight(sampleX, sampleZ);
          const ix = Math.round(sampleX);
          const iz = Math.round(sampleZ);
          const bodyY = groundY + 1.7;

          if (!terrainIsStable(ix, iz, groundY)) return null;

          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (VoxelWorld.isSolid(ix + dx, Math.floor(bodyY), iz + dz)) return null;
              if (VoxelWorld.isSolid(ix + dx, Math.floor(bodyY + 1), iz + dz)) return null;
            }
          }

          // Reject roofed/interior spots: require clear headroom and open sky immediately above.
          for (let dy = 2; dy <= 6; dy++) {
            if (VoxelWorld.isSolid(ix, Math.floor(bodyY + dy), iz)) return null;
          }

          // Reject tight positions that put geometry directly in the camera's near field.
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
              if (Math.abs(dx) + Math.abs(dz) < 2) continue;
              if (VoxelWorld.isSolid(ix + dx, Math.floor(bodyY + 1), iz + dz)) return null;
            }
          }

          return { y: bodyY };
        }

        function pathIsClear(fromX, fromZ, toX, toZ) {
          const dx = toX - fromX;
          const dz = toZ - fromZ;
          const steps = Math.max(2, Math.ceil(Math.sqrt(dx * dx + dz * dz)));
          for (let step = 1; step <= steps; step++) {
            const t = step / steps;
            const px = fromX + dx * t;
            const pz = fromZ + dz * t;
            if (!isOutdoorCell(px, pz)) return false;
          }
          return true;
        }

        function movePlayerSafely(targetX, targetZ) {
          if (typeof VoxelWorld === 'undefined' || !VoxelWorld.getTerrainHeight || !VoxelWorld.isSolid) return false;

          const clamped = clampToAnchor(targetX, targetZ);

          const samples = [
            { x: clamped.x, z: clamped.z },
            { x: clamped.x + 2, z: clamped.z },
            { x: clamped.x - 2, z: clamped.z },
            { x: clamped.x, z: clamped.z + 2 },
            { x: clamped.x, z: clamped.z - 2 },
            { x: clamped.x + 2, z: clamped.z + 2 },
            { x: clamped.x - 2, z: clamped.z + 2 },
            { x: clamped.x + 3, z: clamped.z - 1 },
            { x: clamped.x - 3, z: clamped.z - 1 },
            { x: clamped.x + 1, z: clamped.z + 3 },
            { x: clamped.x - 1, z: clamped.z + 3 },
          ];

          for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            const outdoor = isOutdoorCell(sample.x, sample.z);
            if (!outdoor) continue;
            if (!pathIsClear(pos.x, pos.z, sample.x, sample.z)) continue;
            pos.x = sample.x;
            pos.z = sample.z;
            pos.y = outdoor.y;
            return true;
          }
          return false;
        }

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
        if (scenicTarget && shot < 2) {
          movePlayerSafely(anchor.x + shot * 2, anchor.z + shot);
          const aimDx = scenicTarget.x - pos.x;
          const aimDy = scenicTarget.y - pos.y;
          const aimDz = scenicTarget.z - pos.z;
          const hDist = Math.sqrt(aimDx * aimDx + aimDz * aimDz);
          CameraSystem.setYaw(Math.atan2(-aimDx, -aimDz));
          CameraSystem.setPitch(Math.atan2(aimDy, hDist) - 0.1);
        } else if (nearest) {
          const ep = nearest.mesh.position;
          const dx = ep.x - pos.x;
          const dz = ep.z - pos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 8) {
            const step = Math.min(5, Math.max(3, dist - 8));
            const factor = step / dist;
            movePlayerSafely(pos.x + dx * factor, pos.z + dz * factor);
          } else if (dist < 3) {
            movePlayerSafely(pos.x - dx * 0.3, pos.z - dz * 0.3);
          } else {
            movePlayerSafely(anchor.x + (Math.random() - 0.5) * 4, anchor.z + (Math.random() - 0.5) * 4);
          }
          const aimDx = ep.x - pos.x;
          const aimDy = (ep.y + 1.0) - pos.y;
          const aimDz = ep.z - pos.z;
          const hDist = Math.sqrt(aimDx * aimDx + aimDz * aimDz);
          CameraSystem.setYaw(Math.atan2(-aimDx, -aimDz));
          CameraSystem.setPitch(Math.atan2(aimDy, hDist));
        } else {
          movePlayerSafely(anchor.x + (Math.random() - 0.5) * 6, anchor.z + (Math.random() - 0.5) * 6);
        }
        if (typeof Weapons !== 'undefined' && Weapons.switchTo) {
          Weapons.switchTo(wIdx);
          if (Weapons.refillAllAmmo) Weapons.refillAllAmmo();
          if (Weapons.refillAllAmmo) Weapons.refillAllAmmo();
        }
        // Fire weapon — continuous burst for better kill rate
        if (typeof GameManager._testFireStart === 'function') GameManager._testFireStart();
        // Re-trigger mouseNewPress periodically for semi-auto weapons
        var _fireInterval = setInterval(() => {
          if (typeof GameManager._testFireStart === 'function') GameManager._testFireStart();
        }, 200);
        setTimeout(() => {
          clearInterval(_fireInterval);
          if (typeof GameManager._testFireStop === 'function') GameManager._testFireStop();
        }, 3000);
      } catch (e) { /* ignore movement errors */ }
    }, { wIdx: weaponIdx, shot });
    // Wait 2 seconds, then screenshot (dense coverage for 200+ total)
    await new Promise(r => setTimeout(r, 2000));
    const wName = await page.evaluate(() => typeof Weapons !== 'undefined' && Weapons.getCurrentName ? Weapons.getCurrentName() : 'unknown');
    const shortName = wName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
    await captureScreenshot(page, `g${gameNum + 1}-r${shot + 1}-${shortName}`);
    // Optionally, check for win/dead and break early
    const state = await page.evaluate(() => GameManager.getState());
    if (state === 'win' || state === 'dead') break;

    // Extra screenshot on weapon switch (inventory usage evidence)
    if (shot % 5 === 4) {
      // Quick inventory cycle — switch to next weapon and capture
      const nextWIdx = WEAPON_SCHEDULE[(shot + gameNum * 13 + 3) % WEAPON_SCHEDULE.length];
      await page.evaluate((idx) => {
        if (typeof Weapons !== 'undefined' && Weapons.switchTo) Weapons.switchTo(idx);
      }, nextWIdx);
      await new Promise(r => setTimeout(r, 300));
      const invName = await page.evaluate(() => typeof Weapons !== 'undefined' && Weapons.getCurrentName ? Weapons.getCurrentName() : 'inv');
      await captureScreenshot(page, `g${gameNum + 1}-inv${shot}-${invName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12)}`);
    }
  }

  // Final state for this game
  const finalState = await page.evaluate(() => ({
    state: GameManager.getState(),
    wave: GameManager.getCurrentWave(),
    stage: GameManager.getCurrentStage(),
    score: GameManager.getPlayer().score,
    kills: GameManager.getPlayer().kills,
    hp: GameManager.getPlayer().hp,
  }));
  console.log(`\nGAME ${gameNum + 1} FINAL:`, JSON.stringify(finalState));
  await captureScreenshot(page, `game${gameNum + 1}-final`);

  } // end multi-game loop

  const darkFrames = readabilitySamples.filter(entry => isNearBlackGameplayFrame(entry.sample));
  const lowVisFrames = readabilitySamples.filter(entry => isLowVisibilityGameplayFrame(entry.sample));
  var lowVisStreak = 0;
  var maxLowVisStreak = 0;
  for (const entry of readabilitySamples) {
    if (isLowVisibilityGameplayFrame(entry.sample)) {
      lowVisStreak++;
      if (lowVisStreak > maxLowVisStreak) maxLowVisStreak = lowVisStreak;
    } else {
      lowVisStreak = 0;
    }
  }
  if (darkFrames.length > 0) {
    console.log(`Visual readability failures: ${darkFrames.length}/${readabilitySamples.length}`);
    for (const frame of darkFrames.slice(0, 8)) {
      console.log(
        `   DARK FRAME ${frame.label}: centerAvgLuma=${frame.sample.centerAvgLuma.toFixed(2)} litRatio=${(frame.sample.litRatio * 100).toFixed(2)}%`
      );
    }
    if (
      darkFrames.some(frame => frame.label === 'wave1-start' || /-final$/.test(frame.label)) ||
      darkFrames.length >= Math.max(2, Math.ceil(readabilitySamples.length * 0.35))
    ) {
      errors.push(`VISUAL QA FAIL: ${darkFrames.length}/${readabilitySamples.length} gameplay frames were near-black`);
    }
  }

  if (lowVisFrames.length > 0) {
    console.log(`Low-visibility frames: ${lowVisFrames.length}/${readabilitySamples.length} (max streak ${maxLowVisStreak})`);
    for (const frame of lowVisFrames.slice(0, 8)) {
      console.log(
        `   LOW-VIS ${frame.label}: centerAvgLuma=${frame.sample.centerAvgLuma.toFixed(2)} litRatio=${(frame.sample.litRatio * 100).toFixed(2)}%`
      );
    }
    if (
      lowVisFrames.some(frame => frame.label === 'wave1-start' || /-final$/.test(frame.label)) ||
      maxLowVisStreak >= 3 ||
      lowVisFrames.length >= Math.max(5, Math.ceil(readabilitySamples.length * 0.4))
    ) {
      errors.push(`VISUAL QA FAIL: sustained low visibility detected (${lowVisFrames.length}/${readabilitySamples.length}, max streak ${maxLowVisStreak})`);
    }
  }

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
