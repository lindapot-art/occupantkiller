// Slow-network boot test: throttle to 3G-fast, ensure boot completes within new 120s budget
const puppeteer = require('puppeteer');
(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  const cdp = await page.target().createCDPSession();
  // Slow 3G: ~400 Kbps down, 400ms latency
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
    latency: 400,
  });
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  console.log('[SLOW] Throttled to ~400Kbps + 400ms latency. Boot timeout=120s.');
  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.error('[SLOW] navigation failed: ' + e.message);
    await browser.close(); process.exit(1);
  }
  // Wait up to 130s for boot to complete OR error overlay to show
  const start = Date.now();
  let state;
  while (Date.now() - start < 130000) {
    state = await page.evaluate(() => {
      const ov = document.getElementById('error-overlay');
      const ovVisible = ov && ov.style.display !== 'none';
      const pre = document.getElementById('boot-preloader');
      const preVisible = pre && pre.style.display !== 'none';
      return { ovVisible, ovText: ovVisible ? ov.innerText.slice(0,300) : '', preVisible, gm: typeof window.GameManager };
    });
    if (state.ovVisible) {
      console.error('[SLOW] BOOT ERROR after ' + ((Date.now()-t0)/1000).toFixed(1) + 's:\n' + state.ovText);
      await browser.close(); process.exit(1);
    }
    if (!state.preVisible && state.gm === 'object') {
      console.log('[SLOW] BOOT OK after ' + ((Date.now()-t0)/1000).toFixed(1) + 's. Errors=' + errors.length);
      await browser.close(); process.exit(0);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.error('[SLOW] TIMEOUT — preloader still visible after 130s');
  await browser.close(); process.exit(2);
})();
