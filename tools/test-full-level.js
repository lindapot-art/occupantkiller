/**
 * Full level playthrough test — waves 1 through stage clear.
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

  // Verify init
  const init = await page.evaluate(() => !!GameManager.getScene());
  if (!init) { console.log('FATAL: No WebGL'); process.exit(1); }
  console.log('Init: OK');

  // Enable god mode, click start
  await page.evaluate(() => GameManager.toggleGodMode());
  await page.click('#start-btn');
  console.log('Started game (god mode)');

  // Wait for wave 1
  await new Promise(r => setTimeout(r, 4000));

  let state = await page.evaluate(() => ({
    state: GameManager.getState(),
    wave: GameManager.getCurrentWave(),
    alive: Enemies.getAliveCount(),
  }));
  console.log('Wave 1 check:', JSON.stringify(state));

  if (state.state !== 'playing' || state.wave !== 1) {
    console.log('FAIL: Expected playing/wave1');
    console.log('Errors:', errors.slice(0, 5));
    await browser.close();
    process.exit(1);
  }

  // Play through waves
  let maxWave = 0;
  for (let attempt = 0; attempt < 100; attempt++) {
    // Kill all currently alive enemies
    const killResult = await page.evaluate(() => {
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

    if (killResult.wave > maxWave) {
      maxWave = killResult.wave;
      console.log(`Wave ${maxWave}: ${killResult.killed} killed, ${killResult.alive} remaining, state=${killResult.state}`);
    }

    if (killResult.state === 'stageClear') {
      console.log('>>> STAGE CLEAR! Wave ' + killResult.wave);
      break;
    }

    if (killResult.state === 'waveClear') {
      console.log(`Wave ${killResult.wave} clear. Clicking NEXT WAVE...`);
      await page.click('#next-wave-btn');
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (killResult.state === 'win') {
      console.log('>>> VICTORY!');
      break;
    }

    if (killResult.state === 'dead') {
      console.log('>>> DIED');
      break;
    }

    // Wait for reinforcements/death anims
    await new Promise(r => setTimeout(r, 2000));
  }

  const final = await page.evaluate(() => ({
    state: GameManager.getState(),
    wave: GameManager.getCurrentWave(),
    stage: GameManager.getCurrentStage(),
    kills: GameManager.getPlayer().kills,
    score: GameManager.getPlayer().score,
  }));
  console.log('\nFINAL:', JSON.stringify(final));
  console.log('Unique errors:', [...new Set(errors)].length > 0 ? [...new Set(errors)] : 'NONE');

  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
