// Detect freezes (frame stalls > 200ms) + count concurrent visible overlays during play
const puppeteer = require('puppeteer');
(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + e.message));
  page.on('console', m => { if (m.type()==='error') { const t=m.text(); if(!/ERR_CONNECTION_REFUSED/.test(t)) errors.push('CONSOLE: ' + t); }});
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  // Wait for boot
  for (let i=0; i<60; i++) {
    const ready = await page.evaluate(()=> typeof window.GameManager === 'object' && typeof window.forceStartGame === 'function');
    if (ready) break;
    await new Promise(r=>setTimeout(r,500));
  }
  // Click whichever start button is visible (quick or advanced)
  const clicked = await page.evaluate(()=> {
    const ids = ['quick-start-btn','start-btn'];
    for (const id of ids) { const b = document.getElementById(id); if (b && getComputedStyle(b).display !== 'none' && b.offsetWidth>0) { b.click(); return id; } }
    return null;
  });
  console.log('[FREEZE] clicked: ' + clicked);
  await new Promise(r=>setTimeout(r,3000));

  // Inject frame-stall detector
  await page.evaluate(()=> {
    window.__stalls = [];
    window.__lastT = performance.now();
    window.__frames = 0;
    function tick(){
      const now = performance.now();
      const dt = now - window.__lastT;
      if (dt > 200) window.__stalls.push({ at: Math.round(now), dt: Math.round(dt) });
      window.__lastT = now;
      window.__frames++;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  // Sample overlay counts every second for 30s while game runs
  const samples = [];
  for (let i=0; i<30; i++) {
    await new Promise(r=>setTimeout(r,1000));
    const sample = await page.evaluate(()=> {
      const overlays = ['overlay-start','overlay-pause','overlay-drone-select','overlay-dead','overlay-waveclear','overlay-stageclear','overlay-win','inventory-overlay'];
      const visible = overlays.filter(id => {
        const el = document.getElementById(id);
        if (!el) return false;
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      return { visible, frames: window.__frames, stallCount: window.__stalls.length, worstStall: window.__stalls.length ? Math.max(...window.__stalls.map(s=>s.dt)) : 0 };
    });
    samples.push(sample);
  }
  const last = samples[samples.length-1];
  const concurrent = samples.filter(s => s.visible.length >= 2);
  const fpsAvg = (last.frames / 30).toFixed(1);
  console.log('\n========== FREEZE REPORT ==========');
  console.log('Total frames in 30s: ' + last.frames + ' (avg ' + fpsAvg + ' fps)');
  console.log('Stalls > 200ms: ' + last.stallCount + ' | worst: ' + last.worstStall + 'ms');
  console.log('\n========== OVERLAY STACKING ==========');
  console.log('Samples with 2+ visible overlays: ' + concurrent.length + '/30');
  if (concurrent.length) console.log('  examples: ' + JSON.stringify(concurrent.slice(0,3).map(s=>s.visible)));
  console.log('\nVisible-overlay timeline:');
  samples.forEach((s,i)=> { if (s.visible.length) console.log('  t=' + (i+1) + 's: [' + s.visible.join(', ') + ']'); });
  console.log('\n========== ERRORS ==========');
  errors.forEach(e=>console.log(e));
  await browser.close();
})();
