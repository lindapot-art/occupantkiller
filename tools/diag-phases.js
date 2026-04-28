// Time each phase: boot, init, click-start, world-ready
const puppeteer = require('puppeteer');
(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const tDom = Date.now();
  // Wait until GameManager is ready (post-init)
  for (let i=0; i<200; i++) {
    const r = await page.evaluate(()=> typeof window.GameManager === 'object' && !!(window.GameManager && window.GameManager.startGame));
    if (r) break;
    await new Promise(r=>setTimeout(r,100));
  }
  // Wait for preloader to actually hide
  for (let i=0; i<200; i++) {
    const hidden = await page.evaluate(()=> { const p=document.getElementById('boot-preloader'); return !p || getComputedStyle(p).display==='none'; });
    if (hidden) break;
    await new Promise(r=>setTimeout(r,100));
  }
  const tInit = Date.now();
  // Click start
  await page.evaluate(()=> { const b=document.getElementById('quick-start-btn'); b&&b.click(); });
  const tClick = Date.now();
  // Wait for game to actually be in PLAYING state
  for (let i=0; i<200; i++) {
    const playing = await page.evaluate(()=> {
      const ov = document.getElementById('overlay-start');
      return ov && getComputedStyle(ov).display === 'none';
    });
    if (playing) break;
    await new Promise(r=>setTimeout(r,100));
  }
  const tPlay = Date.now();
  console.log('PHASE TIMINGS:');
  console.log('  navigate→DOM:           ' + (tDom-t0) + ' ms');
  console.log('  DOM→preloader hidden:   ' + (tInit-tDom) + ' ms  (boot+init phase)');
  console.log('  preloader→click start:  ' + (tClick-tInit) + ' ms');
  console.log('  click→game playing:     ' + (tPlay-tClick) + ' ms  (world build phase)');
  console.log('  TOTAL navigate→playing: ' + (tPlay-t0) + ' ms');
  await browser.close();
})();
