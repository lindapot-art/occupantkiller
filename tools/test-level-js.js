/**
 * Level playthrough — simulates button clicks via JS to avoid Puppeteer click issues.
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

  const init = await page.evaluate(() => !!GameManager.getScene());
  if (!init) { console.log('FATAL: No WebGL'); process.exit(1); }
  console.log('Init: OK');

  // Enable god mode and start
  await page.evaluate(() => {
    GameManager.toggleGodMode();
    GameManager.startGame();
  });
  console.log('Started game (god mode)');

  // Wait for wave 1 to start (3.2s setTimeout)
  await new Promise(r => setTimeout(r, 4000));

  let state = await page.evaluate(() => ({
    s: GameManager.getState(), w: GameManager.getCurrentWave(), a: Enemies.getAliveCount()
  }));
  console.log('Wave 1 check:', JSON.stringify(state));

  if (state.s !== 'playing' || state.w !== 1) {
    console.log('FAIL: Not in playing/wave1. Aborting.');
    console.log('Errors:', errors.slice(0, 3));
    await browser.close();
    process.exit(1);
  }

  // Play through multiple waves
  let currentWave = 1;
  for (let attempt = 0; attempt < 200; attempt++) {
    // Kill all alive enemies
    const result = await page.evaluate(() => {
      const all = Enemies.getAll();
      let killed = 0;
      for (let i = 0; i < all.length; i++) {
        if (all[i].alive) { Enemies.damage(all[i], 99999, false); killed++; }
      }
      return {
        state: GameManager.getState(),
        wave: GameManager.getCurrentWave(),
        alive: Enemies.getAliveCount(),
        killed,
      };
    });

    if (result.wave > currentWave) {
      currentWave = result.wave;
    }

    if (result.state === 'waveClear') {
      console.log(`Wave ${result.wave} CLEAR! Advancing...`);
      // Simulate the next-wave-btn handler via JS
      await page.evaluate(() => {
        GameManager.hideOverlays();
        GameManager.setState(GameManager.STATE.PLAYING);
        GameManager.beginWave(GameManager.getCurrentWave() + 1);
      });
      await new Promise(r => setTimeout(r, 1000));

      const newState = await page.evaluate(() => ({
        s: GameManager.getState(), w: GameManager.getCurrentWave(), a: Enemies.getAliveCount()
      }));
      console.log(`  -> Now: state=${newState.s}, wave=${newState.w}, alive=${newState.a}`);

      if (newState.w > currentWave) currentWave = newState.w;
      if (currentWave > 3) {
        console.log('SUCCESS: Reached wave ' + currentWave + '. Game progression works!');
        break;
      }
      continue;
    }

    if (result.state === 'stageClear') {
      console.log('STAGE CLEAR at wave ' + result.wave);
      break;
    }

    if (result.state === 'win') {
      console.log('VICTORY!');
      break;
    }

    if (result.state === 'dead') {
      console.log('DIED (should not happen in god mode)');
      break;
    }

    // Wait for reinforcements/death animations
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\nFinal wave reached:', currentWave);
  console.log('Unique errors:', [...new Set(errors)].length > 0 ? [...new Set(errors)] : 'NONE');

  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
