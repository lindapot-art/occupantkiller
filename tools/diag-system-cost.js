// Wraps every system's update() to measure per-frame cost
const puppeteer = require('puppeteer');
(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  for (let i=0; i<60; i++) { if (await page.evaluate(()=>typeof window.GameManager==='object')) break; await new Promise(r=>setTimeout(r,500)); }

  // Wrap update methods BEFORE starting game
  await page.evaluate(()=> {
    window.__sysCosts = {};
    const systems = ['Weapons','Enemies','Pickups','NPCSystem','DroneSystem','VehicleSystem','Automation','MissionSystem','RefineryStrike','Tracers','StageVFX','Flags','Environment','CombatExtras','Traversal','WorldFeatures','TimeSystem','WeatherSystem','HUD','Building','Skills','Progression','Perks','Feedback','VoxelWorld','MLSystem','NPCML','CameraSystem'];
    for (const name of systems) {
      const sys = window[name];
      if (!sys || typeof sys.update !== 'function') continue;
      const orig = sys.update.bind(sys);
      window.__sysCosts[name] = { calls: 0, total: 0, max: 0 };
      sys.update = function(...args){
        const t0 = performance.now();
        const r = orig(...args);
        const dt = performance.now() - t0;
        const s = window.__sysCosts[name];
        s.calls++; s.total += dt; if (dt > s.max) s.max = dt;
        return r;
      };
    }
  });

  await page.evaluate(()=> { const b=document.getElementById('quick-start-btn'); b&&b.click(); });
  await new Promise(r=>setTimeout(r,4000));
  // Reset stats after start
  await page.evaluate(()=> { for (const k in window.__sysCosts) window.__sysCosts[k] = { calls:0, total:0, max:0 }; window.__t0 = performance.now(); window.__frames = 0; (function tick(){ window.__frames++; requestAnimationFrame(tick);})(); });
  await new Promise(r=>setTimeout(r,15000));
  const out = await page.evaluate(()=> ({ frames: window.__frames, costs: window.__sysCosts, elapsed: performance.now()-window.__t0 }));

  console.log('Frames in ' + (out.elapsed/1000).toFixed(1) + 's: ' + out.frames + ' (' + (out.frames/(out.elapsed/1000)).toFixed(1) + ' fps)');
  const rows = Object.entries(out.costs).filter(([_,s])=>s.calls>0).map(([k,s])=>({sys:k, calls:s.calls, totalMs:s.total.toFixed(0), avgMs:(s.total/s.calls).toFixed(2), maxMs:s.max.toFixed(1)}));
  rows.sort((a,b)=>parseFloat(b.totalMs)-parseFloat(a.totalMs));
  console.log('\nPER-SYSTEM UPDATE COST (sorted by total time):');
  console.log('  SYSTEM              calls  total   avg    max');
  rows.forEach(r=> console.log('  ' + r.sys.padEnd(20) + r.calls.toString().padStart(5) + r.totalMs.padStart(7) + 'ms ' + r.avgMs.padStart(6) + 'ms ' + r.maxMs.padStart(6) + 'ms'));
  await browser.close();
})();
