// Live verification of wave-clear UX changes:
//   1. Countdown DOM text says "5" not "15"
//   2. Skip-hint paragraph is rendered
//   3. 300ms grace period blocks early click
//   4. Click after grace period actually advances the wave
const puppeteer = require('puppeteer');
(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  page.on('console', m => { if (m.type()==='error') console.log('[CONSOLE-ERR]', m.text()); });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait for GameManager
  for (let i=0; i<200; i++) {
    if (await page.evaluate(()=> !!(window.GameManager && window.GameManager.startGame))) break;
    await new Promise(r=>setTimeout(r,100));
  }
  // Wait for preloader fade
  for (let i=0; i<100; i++) {
    if (await page.evaluate(()=> { const p=document.getElementById('boot-preloader'); return !p || p.style.opacity==='0'; })) break;
    await new Promise(r=>setTimeout(r,100));
  }
  // Force-show wave-clear overlay & invoke the same code path the real game uses.
  // We can't easily replay a full wave in headless; instead call showOverlay('waveclear') directly,
  // which is what game-manager.js does, then run the countdown setup block by triggering the
  // wave-end logic. Easiest: call window.GameManager.endWave or simulate by directly poking.
  const result = await page.evaluate(async () => {
    const out = { steps: [] };
    // Force-init game so overlay-waveclear's countdown setup runs.
    const qs = document.getElementById('quick-start-btn');
    if (qs) qs.click();
    await new Promise(r=>setTimeout(r,1500));
    out.steps.push('game started');
    // Force wave clear via GameManager API if available
    const gm = window.GameManager;
    out.gmKeys = Object.keys(gm).slice(0, 30);
    // Directly drive the overlay flow by calling endWave/showWaveClear if exposed,
    // else manually trigger by emptying enemies and calling update.
    if (typeof gm.onWaveComplete === 'function') { gm.onWaveComplete(); out.steps.push('onWaveComplete called'); }
    else if (typeof gm.endWave === 'function') { gm.endWave(); out.steps.push('endWave called'); }
    else { out.steps.push('NO wave-clear API exposed'); }
    await new Promise(r=>setTimeout(r,500));
    // Now read DOM
    const ovWC = document.getElementById('overlay-waveclear');
    const cd = document.getElementById('shop-countdown');
    out.overlayDisplay = ovWC ? getComputedStyle(ovWC).display : 'NO OVERLAY';
    out.countdownText = cd ? cd.textContent : 'NO COUNTDOWN';
    out.hasSkipBound = ovWC ? !!ovWC.__skipBound : false;
    out.skipArmedAt = ovWC ? ovWC.__skipArmedAt : null;
    out.skipHint = !!Array.from(document.querySelectorAll('#overlay-waveclear p')).find(p => /skip/i.test(p.textContent));
    return out;
  });
  console.log(JSON.stringify(result, null, 2));

  // If overlay actually shown, test grace period + skip with PROPER timing.
  // Grace is 300ms after overlay opens; so we re-trigger the overlay then click within ~50ms.
  if (result.overlayDisplay && result.overlayDisplay !== 'none') {
    console.log('\n--- TESTING SKIP BEHAVIOR ---');
    // Reset: re-trigger overlay (NEXT WAVE button, then onWaveComplete again)
    const graceTest = await page.evaluate(async () => {
      // Hide and re-show overlay to reset grace timer
      document.getElementById('next-wave-btn').click();
      await new Promise(r=>setTimeout(r,300));
      // Force a wave-clear again
      window.GameManager.onWaveComplete();
      // Click within 50ms (well inside the 300ms grace)
      const t0 = Date.now();
      document.getElementById('overlay-waveclear').click();
      const elapsed = Date.now() - t0;
      const stillUp = getComputedStyle(document.getElementById('overlay-waveclear')).display;
      return { elapsed, stillUp };
    });
    console.log('Grace test (click within ~' + graceTest.elapsed + 'ms): overlay display =', graceTest.stillUp, '(expect: "flex" — grace blocked the skip)');

    // Now wait past grace and click — should skip
    await new Promise(r=>setTimeout(r,400));
    await page.evaluate(()=> document.getElementById('overlay-waveclear').click());
    await new Promise(r=>setTimeout(r,300));
    const stillUp2 = await page.evaluate(()=> getComputedStyle(document.getElementById('overlay-waveclear')).display);
    console.log('Post-grace click: overlay display =', stillUp2, '(expect: "none")');
  }
  await browser.close();
})();
