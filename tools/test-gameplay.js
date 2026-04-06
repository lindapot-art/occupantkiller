/**
 * Full gameplay test — tries to play through a level.
 */
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  console.log('Testing:', url);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('CRASH: ' + err.message));

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  console.log('Page loaded. Errors so far:', errors.length);

  // Check init
  const initState = await page.evaluate(() => ({
    scene: !!GameManager.getScene(),
    state: GameManager.getState()
  }));
  console.log('Init:', JSON.stringify(initState));

  if (!initState.scene) {
    console.log('FATAL: No scene/renderer. WebGL failed.');
    await browser.close();
    process.exit(1);
  }

  // Enable god mode for faster testing
  await page.evaluate(() => {
    GameManager.toggleGodMode();
  });
  console.log('God mode enabled');

  // Click start
  await page.click('#start-btn');
  console.log('Clicked START MISSION');

  // Wait for first wave to start
  await new Promise(r => setTimeout(r, 5000));

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

  // Kill all enemies by direct damage
  for (let round = 0; round < 20; round++) {
    const roundState = await page.evaluate(() => {
      try {
        const st = GameManager.getState();
        const wave = GameManager.getCurrentWave();
        const stage = GameManager.getCurrentStage();
        const alive = Enemies.getAliveCount();

        // Kill all alive enemies
        const all = Enemies.getAll();
        let killed = 0;
        for (let i = 0; i < all.length; i++) {
          if (all[i].alive) {
            Enemies.damage(all[i], 99999, false);
            killed++;
          }
        }

        return {
          state: st,
          wave: wave,
          stage: stage,
          alive: alive,
          killed: killed,
          playerHP: GameManager.getPlayer().hp,
        };
      } catch (e) {
        return { error: e.message, stack: e.stack ? e.stack.substring(0, 200) : '' };
      }
    });
    console.log(`Round ${round + 1}:`, JSON.stringify(roundState));

    if (roundState.error) {
      console.log('ERROR during combat round');
      break;
    }

    // Check for wave/stage transitions
    if (roundState.state === 'waveClear' || roundState.state === 'stageClear') {
      console.log('>>> Transition detected: ' + roundState.state);

      // Click the corresponding button
      if (roundState.state === 'waveClear') {
        try {
          await page.click('#next-wave-btn');
          console.log('  Clicked NEXT WAVE');
        } catch (e) {
          console.log('  Could not click next wave:', e.message);
        }
      } else if (roundState.state === 'stageClear') {
        try {
          await page.click('#next-stage-btn');
          console.log('  Clicked NEXT STAGE');
        } catch (e) {
          console.log('  Could not click next stage:', e.message);
        }
      }
    }

    if (roundState.state === 'win') {
      console.log('>>> VICTORY!');
      break;
    }

    if (roundState.state === 'dead') {
      console.log('>>> PLAYER DIED (should be impossible in god mode)');
      break;
    }

    // Wait for next wave to spawn
    await new Promise(r => setTimeout(r, 4000));
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
  console.log('Errors:', errors.length > 0 ? JSON.stringify(errors) : 'NONE');

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
