/**
 * Headless browser test for the live game.
 * Loads the page, clicks START MISSION, waits, captures ALL console errors.
 */
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'https://lindapot-art.github.io/occupantkiller/';
  console.log('Testing:', url);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Collect ALL console messages
  const errors = [];
  const warnings = [];
  const logs = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') errors.push(text);
    else if (type === 'warning') warnings.push(text);
    else logs.push(text);
  });

  page.on('pageerror', err => {
    errors.push('PAGE CRASH: ' + err.message);
  });

  page.on('requestfailed', req => {
    errors.push('LOAD FAIL: ' + req.url() + ' ' + (req.failure() ? req.failure().errorText : ''));
  });

  // 1. Load the page
  console.log('\n=== PHASE 1: Page Load ===');
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('Page loaded OK');
  } catch (e) {
    console.log('Page load FAILED:', e.message);
  }

  // Check if start screen is visible
  const startVisible = await page.evaluate(() => {
    const overlay = document.getElementById('overlay-start');
    return overlay ? overlay.style.display !== 'none' : false;
  });
  console.log('Start screen visible:', startVisible);

  // Check critical globals exist
  const globals = await page.evaluate(() => {
    return {
      THREE: typeof THREE !== 'undefined',
      GameManager: typeof GameManager !== 'undefined',
      Weapons: typeof Weapons !== 'undefined',
      Enemies: typeof Enemies !== 'undefined',
      VoxelWorld: typeof VoxelWorld !== 'undefined',
      CameraSystem: typeof CameraSystem !== 'undefined',
      HUD: typeof HUD !== 'undefined',
      NPCSystem: typeof NPCSystem !== 'undefined',
      DroneSystem: typeof DroneSystem !== 'undefined',
      VehicleSystem: typeof VehicleSystem !== 'undefined',
      Feedback: typeof Feedback !== 'undefined',
      Progression: typeof Progression !== 'undefined',
    };
  });
  console.log('Globals:', JSON.stringify(globals));

  // Print any errors from loading
  if (errors.length) {
    console.log('\n--- ERRORS DURING LOAD ---');
    errors.forEach(e => console.log('  ERROR:', e));
  }
  if (warnings.length) {
    console.log('\n--- WARNINGS DURING LOAD ---');
    warnings.forEach(w => console.log('  WARN:', w));
  }

  // 2. Click START MISSION
  console.log('\n=== PHASE 2: Click START MISSION ===');
  errors.length = 0; // Reset errors for this phase
  
  try {
    await page.click('#start-btn');
    console.log('Clicked start button');
  } catch (e) {
    console.log('Click FAILED:', e.message);
  }

  // Wait 3 seconds for game to initialize
  await new Promise(r => setTimeout(r, 3000));

  // Check game state
  const gameState = await page.evaluate(() => {
    try {
      return {
        state: GameManager.getState(),
        playerHP: GameManager.getPlayer() ? GameManager.getPlayer().hp : 'NO PLAYER',
        playerPos: GameManager.getPlayer() ? {
          x: GameManager.getPlayer().position.x.toFixed(1),
          y: GameManager.getPlayer().position.y.toFixed(1),
          z: GameManager.getPlayer().position.z.toFixed(1)
        } : null,
        currentWave: GameManager.getCurrentWave(),
        currentStage: GameManager.getCurrentStage(),
        enemyCount: typeof Enemies !== 'undefined' ? Enemies.getAliveCount() : -1,
        hudVisible: document.getElementById('hud') ? document.getElementById('hud').style.display : 'missing',
        overlayStart: document.getElementById('overlay-start') ? document.getElementById('overlay-start').style.display : 'missing',
        canvasExists: !!document.querySelector('canvas'),
        rendererExists: !!GameManager.getScene(),
      };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Game State:', JSON.stringify(gameState, null, 2));

  if (errors.length) {
    console.log('\n--- ERRORS AFTER START ---');
    errors.forEach(e => console.log('  ERROR:', e));
  }

  // 3. Wait 8 more seconds for wave to start and enemies to spawn
  console.log('\n=== PHASE 3: Wait for gameplay (8s) ===');
  errors.length = 0;
  await new Promise(r => setTimeout(r, 8000));

  const gameplayState = await page.evaluate(() => {
    try {
      var p = GameManager.getPlayer();
      return {
        state: GameManager.getState(),
        wave: GameManager.getCurrentWave(),
        stage: GameManager.getCurrentStage(),
        playerHP: p ? p.hp : null,
        playerMaxHP: p ? p.maxHp : null,
        playerY: p ? p.position.y.toFixed(2) : null,
        enemyAlive: Enemies.getAliveCount(),
        enemyTotal: Enemies.getAll().length,
        weaponName: Weapons.getCurrentName(),
        weaponClip: Weapons.getClip(),
        weaponReserve: Weapons.getReserve(),
      };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Gameplay:', JSON.stringify(gameplayState, null, 2));

  if (errors.length) {
    console.log('\n--- ERRORS DURING GAMEPLAY ---');
    errors.forEach(e => console.log('  ERROR:', e));
  }

  // 4. Simulate shooting at enemies for 5 seconds
  console.log('\n=== PHASE 4: Simulate combat (5s) ===');
  errors.length = 0;

  // Press mouse down to fire
  await page.evaluate(() => {
    // Simulate firing by calling weapons tryFire directly for 100 frames
    try {
      var camera = GameManager.getCamera();
      var targets = Enemies.getEnemyMeshes();
      for (var i = 0; i < 100; i++) {
        Weapons.tryFire(camera, targets, 0.016, function(hit) {
          var enemy = Enemies.findByMesh(hit.object);
          if (enemy && enemy.alive) {
            Enemies.damage(enemy, Weapons.getDamage(), false);
          }
        }, i === 0);
      }
    } catch(e) {
      console.error('COMBAT ERROR: ' + e.message + ' at ' + e.stack);
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  const combatState = await page.evaluate(() => {
    try {
      return {
        playerHP: GameManager.getPlayer().hp,
        enemyAlive: Enemies.getAliveCount(),
        enemyTotal: Enemies.getAll().length,
        kills: GameManager.getPlayer().kills,
        score: GameManager.getPlayer().score,
      };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('After combat:', JSON.stringify(combatState, null, 2));

  if (errors.length) {
    console.log('\n--- ERRORS DURING COMBAT ---');
    errors.forEach(e => console.log('  ERROR:', e));
  }

  // Summary
  console.log('\n========== SUMMARY ==========');
  const allErrors = [...errors];
  if (allErrors.length === 0) {
    console.log('NO ERRORS DETECTED');
  } else {
    console.log(allErrors.length + ' ERRORS:');
    allErrors.forEach(e => console.log('  ' + e));
  }

  await browser.close();
  process.exit(allErrors.length > 0 ? 1 : 0);
})();
