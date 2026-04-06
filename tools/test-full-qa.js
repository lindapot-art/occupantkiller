/**
 * FULL QA TEST — Puppeteer end-to-end test
 * Tests: page load, all scripts, console errors, game boot, wave spawn, combat
 */
const puppeteer = require('puppeteer');

const URL = process.argv[2] || 'http://localhost:3000';
const TIMEOUT = 60000;
let browser, page;
const errors = [];
const warnings = [];
const scriptResults = [];
let passed = 0, failed = 0;

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function fail(label, detail) { failed++; errors.push(`${label}: ${detail}`); console.log(`  ❌ ${label} — ${detail}`); }

(async () => {
  console.log(`\n═══ FULL QA TEST ═══`);
  console.log(`Target: ${URL}\n`);

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', '--disable-setuid-sandbox',
        '--enable-webgl', '--use-gl=swiftshader',
        '--disable-software-rasterizer',
        '--ignore-gpu-blocklist',
        '--enable-gpu-rasterization'
      ]
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Collect console messages
    const consoleErrors = [];
    const consoleWarnings = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });

    // Collect page errors (uncaught exceptions)
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // Track script loading via responses
    const scriptLoads = {};
    page.on('response', async resp => {
      const url = resp.url();
      // Match .js and .css by extension
      const match = url.match(/\/([^\/\?]+\.(js|css))(\?|$)/);
      if (match) {
        scriptLoads[match[1]] = resp.status();
      }
    });

    // ═══ TEST 1: Page Load ═══
    console.log('▸ TEST 1: Page Load');
    const resp = await page.goto(URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    if (resp.status() === 200) ok(`HTTP ${resp.status()}`);
    else fail('Page load', `HTTP ${resp.status()}`);

    // ═══ TEST 2: Script Loading ═══
    console.log('\n▸ TEST 2: Script Loading');
    const expectedScripts = [
      'three.min.js', 'voxel-world.js', 'camera-system.js', 'time-system.js',
      'economy.js', 'blockchain.js', 'marketplace.js', 'skills.js', 'ranks.js',
      'building.js', 'npc-system.js', 'drone-system.js', 'vehicles.js',
      'automation.js', 'missions.js', 'pickups.js', 'hud.js', 'weapons.js',
      'enemies.js', 'audio-system.js', 'weather-system.js', 'ml-system.js',
      'tracers.js', 'stage-vfx.js', 'combat-extras.js', 'traversal.js',
      'enemy-types.js', 'world-features.js', 'perks.js', 'mission-types.js',
      'feedback.js', 'progression.js', 'game-manager.js'
    ];
    let scriptsOk = 0, scriptsFail = 0;
    for (const s of expectedScripts) {
      if (scriptLoads[s] === 200) { scriptsOk++; }
      else { scriptsFail++; fail(`Script ${s}`, `status ${scriptLoads[s] || 'NOT LOADED'}`); }
    }
    if (scriptsFail === 0) ok(`All ${scriptsOk} scripts loaded (HTTP 200)`);
    if (scriptLoads['style.css'] === 200) ok('style.css loaded');
    else fail('style.css', `status ${scriptLoads['style.css'] || 'NOT LOADED'}`);

    // ═══ TEST 3: DOM Elements ═══
    console.log('\n▸ TEST 3: DOM Elements');
    const domChecks = [
      '#game-container', '#crosshair', '#health-bar', '#ammo-display',
      '#wave-display', '#stage-display', '#kill-feed', '#minimap-canvas',
      '#start-btn', '#weapon-name-display', '#damage-vignette'
    ];
    for (const sel of domChecks) {
      const el = await page.$(sel);
      if (el) ok(`DOM: ${sel}`);
      else fail(`DOM: ${sel}`, 'not found');
    }

    // ═══ TEST 4: Global Objects ═══
    console.log('\n▸ TEST 4: Global Objects (modules loaded)');
    const globals = [
      'THREE', 'VoxelWorld', 'CameraSystem', 'TimeSystem', 'Economy',
      'Blockchain', 'Marketplace', 'Skills', 'Ranks', 'Building',
      'NPCSystem', 'DroneSystem', 'VehicleSystem', 'Automation',
      'MissionSystem', 'Pickups', 'HUD', 'Weapons', 'Enemies',
      'AudioSystem', 'WeatherSystem', 'MLSystem', 'Tracers',
      'StageVFX', 'CombatExtras', 'Traversal', 'EnemyTypes',
      'WorldFeatures', 'Perks', 'MissionTypes', 'Feedback',
      'Progression', 'GameManager'
    ];
    const globResults = await page.evaluate((names) => {
      return names.map(n => ({ name: n, exists: typeof window[n] !== 'undefined' }));
    }, globals);
    let globOk = 0, globFail = 0;
    for (const g of globResults) {
      if (g.exists) globOk++;
      else { globFail++; fail(`Global: ${g.name}`, 'undefined'); }
    }
    if (globFail === 0) ok(`All ${globOk} modules exist on window`);
    else ok(`${globOk}/${globResults.length} modules loaded`);

    // ═══ TEST 5: Console Errors Before Game Start ═══
    console.log('\n▸ TEST 5: Console Errors (pre-game)');
    if (consoleErrors.length === 0) ok('No console errors');
    else {
      for (const e of consoleErrors) {
        // Filter out known non-critical errors (e.g., WebGL warnings, favicon)
        if (e.includes('favicon') || e.includes('404') && e.includes('.ico')) continue;
        fail('Console error', e.substring(0, 120));
      }
      if (failed === 0) ok('No critical console errors');
    }
    if (pageErrors.length === 0) ok('No uncaught exceptions');
    else {
      for (const e of pageErrors) fail('Uncaught exception', e.substring(0, 120));
    }

    // ═══ TEST 6: Start Game ═══
    console.log('\n▸ TEST 6: Start Game');
    // Clear error counters for game phase
    const preGameErrors = consoleErrors.length;
    const prePageErrors = pageErrors.length;

    // Click pointer lock (simulate) and start button
    const startBtn = await page.$('#start-btn');
    if (!startBtn) {
      fail('Start button', 'not found');
    } else {
      // Bypass pointer lock requirement for headless testing
      await page.evaluate(() => {
        // Mock pointer lock API for headless
        if (!document.pointerLockElement) {
          Object.defineProperty(document, 'pointerLockElement', {
            get: () => document.getElementById('game-container'),
            configurable: true
          });
        }
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.requestPointerLock = () => {
            Object.defineProperty(document, 'pointerLockElement', {
              get: () => canvas,
              configurable: true
            });
            document.dispatchEvent(new Event('pointerlockchange'));
          };
        }
      });

      await startBtn.click();
      ok('Start button clicked');

      // Wait for game to initialize (terrain gen + wave start)
      await new Promise(r => setTimeout(r, 5000));

      // ═══ TEST 7: Game State After Start ═══
      console.log('\n▸ TEST 7: Game State');
      const gameState = await page.evaluate(() => {
        const state = {};
        try {
          state.hasScene = typeof GameManager !== 'undefined' && GameManager.getScene && !!GameManager.getScene();
        } catch(e) { state.hasScene = false; }
        try {
          state.hasCamera = typeof GameManager !== 'undefined' && GameManager.getCamera && !!GameManager.getCamera();
        } catch(e) { state.hasCamera = false; }
        try {
          state.enemyCount = typeof Enemies !== 'undefined' && Enemies.getAliveCount ? Enemies.getAliveCount() : -1;
        } catch(e) { state.enemyCount = -1; }
        try {
          state.waveDisplay = document.getElementById('wave-display') ? document.getElementById('wave-display').textContent : '';
        } catch(e) { state.waveDisplay = ''; }
        try {
          state.stageDisplay = document.getElementById('stage-display') ? document.getElementById('stage-display').textContent : '';
        } catch(e) { state.stageDisplay = ''; }
        try {
          state.healthBar = document.getElementById('health-bar');
          state.healthVisible = state.healthBar ? getComputedStyle(state.healthBar.parentElement).display !== 'none' : false;
        } catch(e) { state.healthVisible = false; }
        try {
          state.canvasExists = !!document.querySelector('canvas');
          if (state.canvasExists) {
            const c = document.querySelector('canvas');
            state.canvasSize = `${c.width}x${c.height}`;
          }
        } catch(e) {}
        try {
          state.npcCount = typeof NPCSystem !== 'undefined' && NPCSystem.getCount ? NPCSystem.getCount() : -1;
        } catch(e) { state.npcCount = -1; }
        try {
          state.vehicleCount = typeof VehicleSystem !== 'undefined' && VehicleSystem.getAll ? VehicleSystem.getAll().length : -1;
        } catch(e) { state.vehicleCount = -1; }
        return state;
      });

      if (gameState.hasScene) ok('THREE.Scene created');
      else fail('Scene', 'not created');
      if (gameState.hasCamera) ok('Camera created');
      else fail('Camera', 'not created');
      if (gameState.canvasExists) ok(`Canvas: ${gameState.canvasSize || 'exists'}`);
      else fail('Canvas', 'not found');
      if (gameState.enemyCount > 0) ok(`Enemies alive: ${gameState.enemyCount}`);
      else if (gameState.enemyCount === 0) fail('Enemies', 'count is 0 (wave didnt spawn?)');
      else fail('Enemies', 'getAliveCount unavailable');
      if (gameState.npcCount >= 0) ok(`NPCs: ${gameState.npcCount}`);
      if (gameState.vehicleCount >= 0) ok(`Vehicles: ${gameState.vehicleCount}`);
      console.log(`    Wave: "${gameState.waveDisplay}", Stage: "${gameState.stageDisplay}"`);

      // ═══ TEST 8: Let Game Run (check for crashes) ═══
      console.log('\n▸ TEST 8: Stability (10s runtime)');
      await new Promise(r => setTimeout(r, 10000));

      const postErrors = consoleErrors.slice(preGameErrors);
      const postPageErrors = pageErrors.slice(prePageErrors);

      // Check FPS
      const fps = await page.evaluate(() => {
        if (typeof GameManager !== 'undefined' && GameManager.getFPS) return GameManager.getFPS();
        return -1;
      });
      if (fps > 0) ok(`FPS: ${fps}`);
      else console.log('    (FPS not measurable in headless)');

      // Check enemy count still valid (game didn't crash mid-loop)
      const postEnemies = await page.evaluate(() => {
        try { return Enemies.getAliveCount(); } catch(e) { return -99; }
      });
      if (postEnemies >= 0) ok(`Enemies after 10s: ${postEnemies} (game loop stable)`);
      else fail('Game loop', 'Enemies.getAliveCount crashed');

      // Filter non-critical errors
      const criticalErrors = postErrors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('.ico') &&
        !e.includes('AudioContext') &&
        !e.includes('autoplay') &&
        !e.includes('The AudioContext was not allowed') &&
        !e.includes('getUserMedia') &&
        !e.includes('DOMException') &&
        !e.includes('NotAllowedError') &&
        !e.includes('play()') &&
        !e.includes('ERR_CONNECTION_REFUSED')
      );
      const criticalPageErrors = postPageErrors.filter(e =>
        !e.includes('AudioContext') &&
        !e.includes('autoplay')
      );

      if (criticalErrors.length === 0 && criticalPageErrors.length === 0) {
        ok('No critical errors during 10s gameplay');
      } else {
        for (const e of criticalErrors) fail('Runtime error', e.substring(0, 150));
        for (const e of criticalPageErrors) fail('Uncaught exception', e.substring(0, 150));
      }

      if (postErrors.length > 0) {
        console.log(`    (${postErrors.length} total console errors, ${criticalErrors.length} critical)`);
      }
    }

    // ═══ SUMMARY ═══
    console.log('\n═══════════════════════════════════');
    console.log(`  PASSED: ${passed}`);
    console.log(`  FAILED: ${failed}`);
    console.log(`═══════════════════════════════════`);
    if (failed > 0) {
      console.log('\nFAILURES:');
      for (const e of errors) console.log(`  • ${e}`);
    }
    console.log(`\nVERDICT: ${failed === 0 ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}\n`);

  } catch (err) {
    console.error('FATAL:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    process.exit(failed > 0 ? 1 : 0);
  }
})();
