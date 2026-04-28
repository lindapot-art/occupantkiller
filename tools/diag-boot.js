// quick diagnostic: load page, capture ALL console + page errors + failed requests, dump module presence
const puppeteer = require('puppeteer');
(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [], failed = [], logs = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + (e.stack ? '\n  ' + e.stack.split('\n').slice(0,3).join('\n  ') : '')));
  page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: ' + m.text()); else logs.push('[' + m.type() + '] ' + m.text()); });
  page.on('requestfailed', r => failed.push('FAILED: ' + r.url() + ' (' + r.failure().errorText + ')'));
  page.on('response', r => { if (r.status() >= 400) failed.push('HTTP ' + r.status() + ': ' + r.url()); });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  // Wait up to 35s for boot to settle, polling state
  const start = Date.now();
  let state;
  while (Date.now() - start < 35000) {
    state = await page.evaluate(() => {
      const mods = ['THREE','VoxelWorld','AudioSystem','Weapons','Enemies','HUD','GameManager','DroneSystem','VehicleSystem','Tracers'];
      const presence = {}; mods.forEach(m => presence[m] = typeof window[m]);
      const ov = document.getElementById('error-overlay');
      const ovVisible = ov && ov.style.display !== 'none';
      const ovText = ovVisible ? ov.innerText.slice(0,500) : '';
      const preloader = document.getElementById('boot-preloader');
      const preVisible = preloader && preloader.style.display !== 'none';
      return { presence, ovVisible, ovText, preVisible };
    });
    if (state.ovVisible || (!state.preVisible && state.presence.GameManager === 'object')) break;
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('\n========== PAGE FAILED REQUESTS ==========');
  failed.forEach(f => console.log(f));
  console.log('\n========== PAGE ERRORS ==========');
  errors.forEach(e => console.log(e));
  console.log('\n========== MODULE PRESENCE ==========');
  console.log(JSON.stringify(state.presence, null, 2));
  console.log('\n========== BOOT STATE ==========');
  console.log('error overlay visible: ' + state.ovVisible);
  if (state.ovText) console.log('overlay text:\n' + state.ovText);
  console.log('preloader visible: ' + state.preVisible);
  console.log('\n========== LAST 20 LOGS ==========');
  logs.slice(-20).forEach(l => console.log(l));
  await browser.close();
  process.exit(state.ovVisible ? 1 : 0);
})();
