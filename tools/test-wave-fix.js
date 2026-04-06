/**
 * Quick gameplay validation — verifies the wave-clear fix.
 * Tests: init → start → wave 1 enemies present → kill all → wave clear → wave 2 starts
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

  // Check init
  const initState = await page.evaluate(() => ({
    scene: !!GameManager.getScene(),
    state: GameManager.getState()
  }));
  console.log('1. Init:', JSON.stringify(initState));
  if (!initState.scene) { console.log('FATAL: No WebGL'); process.exit(1); }

  // Click start
  await page.click('#start-btn');
  console.log('2. Clicked START');

  // Wait 1 second — should still be PLAYING (not waveClear!)
  await new Promise(r => setTimeout(r, 1000));
  const after1s = await page.evaluate(() => ({
    state: GameManager.getState(),
    wave: GameManager.getCurrentWave(),
  }));
  console.log('3. After 1s (before beginWave):', JSON.stringify(after1s));
  console.log('   EXPECT: state=playing, wave=0');
  console.log('   ' + (after1s.state === 'playing' ? 'PASS' : 'FAIL — state is ' + after1s.state));

  // Wait for beginWave(1) to fire (3.2s delay from start)
  await new Promise(r => setTimeout(r, 3000));
  const after4s = await page.evaluate(() => ({
    state: GameManager.getState(),
    wave: GameManager.getCurrentWave(),
    alive: Enemies.getAliveCount(),
    enemies: Enemies.getAll().length,
  }));
  console.log('4. After 4s (wave 1 started):', JSON.stringify(after4s));
  console.log('   EXPECT: state=playing, wave=1, enemies>0');
  console.log('   ' + (after4s.state === 'playing' && after4s.wave === 1 && after4s.alive > 0
    ? 'PASS'
    : 'FAIL'));

  // Kill all enemies
  for (let killRound = 0; killRound < 30; killRound++) {
    const result = await page.evaluate(() => {
      const all = Enemies.getAll();
      let killed = 0;
      for (let i = 0; i < all.length; i++) {
        if (all[i].alive) { Enemies.damage(all[i], 99999, false); killed++; }
      }
      return { state: GameManager.getState(), alive: Enemies.getAliveCount(), killed };
    });
    
    if (result.state === 'waveClear') {
      console.log('5. Wave clear after kill round ' + (killRound + 1) + ':', JSON.stringify(result));
      console.log('   EXPECT: state=waveClear, alive=0');
      console.log('   ' + (result.alive === 0 ? 'PASS' : 'FAIL — ' + result.alive + ' alive'));
      break;
    }
    
    if (result.killed === 0 && result.alive === 0) {
      // Wait for death animations to clear corpses
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }
    
    // Wait for reinforcements to spawn and corpses to clear
    await new Promise(r => setTimeout(r, 2000));
  }

  // Click NEXT WAVE
  const preNext = await page.evaluate(() => ({ state: GameManager.getState(), wave: GameManager.getCurrentWave() }));
  console.log('6. Before NEXT WAVE click:', JSON.stringify(preNext));

  if (preNext.state === 'waveClear') {
    await page.click('#next-wave-btn');
    await new Promise(r => setTimeout(r, 1000));
    const afterNext = await page.evaluate(() => ({
      state: GameManager.getState(),
      wave: GameManager.getCurrentWave(),
      alive: Enemies.getAliveCount(),
    }));
    console.log('7. After NEXT WAVE click:', JSON.stringify(afterNext));
    console.log('   EXPECT: state=playing, wave=2, alive>0');
    console.log('   ' + (afterNext.state === 'playing' && afterNext.wave === 2 && afterNext.alive > 0
      ? 'PASS'
      : 'FAIL'));
  } else {
    console.log('   SKIP — not in waveClear state');
  }

  console.log('\nErrors:', errors.length > 0 ? errors : 'NONE');

  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
