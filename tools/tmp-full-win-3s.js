const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'tools', 'screenshots', `full-win-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('pageerror', e => errors.push(e.message || String(e)));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.evaluateOnNewDocument(() => {
    window.__QA_MODE = true;
    if (typeof window.triggerCityEvent !== 'function') window.triggerCityEvent = function(){};
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
  await page.waitForFunction(() => typeof window.GameManager !== 'undefined', { timeout: 15000 });

  const hasScene = await page.evaluate(() => !!GameManager.getScene());
  if (!hasScene) throw new Error('No WebGL scene available in this run');

  await page.evaluate(() => {
    if (typeof GameManager.toggleGodMode === 'function') GameManager.toggleGodMode();
    Object.defineProperty(document, 'pointerLockElement', { get: () => document.body, configurable: true });
    if (typeof window.forceStartGame === 'function') window.forceStartGame();
    else if (typeof GameManager.startGame === 'function') GameManager.startGame();
  });

  let shot = 0;
  let lastShotAt = 0;
  let lastAdvanceAt = 0;
  const stateLog = [];
  const start = Date.now();
  const timeoutMs = 20 * 60 * 1000;
  let lastState = 'unknown';
  let lastStage = -1;
  let lastWave = -1;
  let sameStateSince = Date.now();

  async function snap(label) {
    const name = `${String(shot).padStart(4, '0')}-${label}.png`;
    const file = path.join(outDir, name);
    await page.screenshot({ path: file, type: 'png' });
    shot++;
    return name;
  }

  await snap('start');

  while (Date.now() - start < timeoutMs) {
    const info = await page.evaluate(() => {
      const st = GameManager.getState();
      const stage = GameManager.getCurrentStage();
      const wave = GameManager.getCurrentWave();
      const alive = (typeof Enemies !== 'undefined' && Enemies.getAliveCount) ? Enemies.getAliveCount() : -1;
      return { st, stage, wave, alive };
    });

    if (info.st !== lastState || info.stage !== lastStage || info.wave !== lastWave) {
      const line = `${new Date().toISOString()} state=${info.st} stage=${info.stage} wave=${info.wave} alive=${info.alive}`;
      stateLog.push(line);
      console.log(line);
      lastState = info.st; lastStage = info.stage; lastWave = info.wave;
      sameStateSince = Date.now();
    }

    if (Date.now() - lastShotAt >= 3000) {
      await snap(`s${info.stage+1}-w${info.wave}-${info.st}`);
      lastShotAt = Date.now();
    }

    if (info.st === 'win') break;

    const stallMs = Date.now() - sameStateSince;
    const shouldAdvance = (Date.now() - lastAdvanceAt) >= 2900;
    if (shouldAdvance) {
      await page.evaluate((stallMs, aliveCount) => {
        const st = GameManager.getState();
        const MAX_WAVES = 7;
        if (st === 'playing') {
          if (typeof Enemies !== 'undefined' && Enemies.getAll && Enemies.damage) {
            const all = Enemies.getAll();
            for (let i = 0; i < all.length; i++) {
              if (all[i] && all[i].alive) Enemies.damage(all[i], 999999, false);
            }
          }
          try {
            if (typeof Enemies !== 'undefined' && Enemies.clear) Enemies.clear();
            if (GameManager && GameManager.STATE && GameManager.setState) {
              GameManager.setState(GameManager.STATE.WAVE_CLEAR);
            }
          } catch (_e) {}
        } else if (st === 'waveClear') {
          const btn = document.getElementById('next-wave-btn');
          if (btn) btn.click();
          const nextWave = (GameManager.getCurrentWave ? GameManager.getCurrentWave() : 0) + 1;
          if (nextWave <= MAX_WAVES) {
            GameManager.hideOverlays && GameManager.hideOverlays();
            GameManager.setState && GameManager.setState(GameManager.STATE.PLAYING);
            GameManager.beginWave && GameManager.beginWave(nextWave);
          } else {
            GameManager.hideOverlays && GameManager.hideOverlays();
            GameManager.setState && GameManager.setState(GameManager.STATE.STAGE_CLEAR);
          }
        } else if (st === 'stageClear') {
          const btn = document.getElementById('next-stage-btn');
          if (btn) btn.click();
          if (typeof GameManager.nextStage === 'function') GameManager.nextStage();
        } else if (st === 'menu') {
          if (typeof window.forceStartGame === 'function') window.forceStartGame();
          else if (typeof GameManager.startGame === 'function') GameManager.startGame();
        }
      }, stallMs, info.alive);
      lastAdvanceAt = Date.now();
    }

    await new Promise(r => setTimeout(r, 200));
  }

  const final = await page.evaluate(() => ({
    state: GameManager.getState(),
    stage: GameManager.getCurrentStage(),
    wave: GameManager.getCurrentWave(),
    score: GameManager.getPlayer() ? GameManager.getPlayer().score : 0,
    kills: GameManager.getPlayer() ? GameManager.getPlayer().kills : 0,
    hp: GameManager.getPlayer() ? GameManager.getPlayer().hp : 0,
  }));

  await snap(`final-${final.state}`);

  const report = {
    url,
    outDir,
    screenshots: shot,
    final,
    reachedWin: final.state === 'win',
    errors,
    stateLog
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  console.log('RUN_OUTDIR:' + outDir);
  console.log('RUN_SHOTS:' + shot);
  console.log('RUN_FINAL:' + JSON.stringify(final));
  console.log('RUN_WIN:' + (final.state === 'win'));
  console.log('RUN_ERRORS:' + errors.length);

  await browser.close();
  process.exit(final.state === 'win' ? 0 : 2);
})().catch(async (e) => {
  console.error('RUN_FATAL:', e && e.message ? e.message : e);
  process.exit(1);
});
