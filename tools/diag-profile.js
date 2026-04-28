// CPU profile during gameplay to find the freeze source
const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  for (let i=0; i<60; i++) { if (await page.evaluate(()=>typeof window.GameManager==='object')) break; await new Promise(r=>setTimeout(r,500)); }
  await page.evaluate(()=> { const b=document.getElementById('quick-start-btn'); b&&b.click(); });
  await new Promise(r=>setTimeout(r,4000));
  await page.tracing.start({ path: 'tools/screenshots/trace.json', categories: ['devtools.timeline'] });
  await new Promise(r=>setTimeout(r,15000));
  await page.tracing.stop();
  // Also capture per-system tick counts via stub
  const stats = await page.evaluate(()=> {
    const arr = (window.GameManager && window.GameManager.scene && window.GameManager.scene.children) || [];
    return {
      sceneObjects: arr.length,
      enemies: (window.Enemies && window.Enemies.list && window.Enemies.list().length) || 'n/a',
      drones: (window.DroneSystem && window.DroneSystem.list && window.DroneSystem.list().length) || 'n/a',
      voxelChunks: (window.VoxelWorld && window.VoxelWorld.chunkCount && window.VoxelWorld.chunkCount()) || 'n/a',
      npcs: (window.NPCSystem && window.NPCSystem.list && window.NPCSystem.list().length) || 'n/a',
    };
  });
  console.log('STATS:', JSON.stringify(stats, null, 2));
  // parse trace for top FunctionCall costs
  const trace = JSON.parse(fs.readFileSync('tools/screenshots/trace.json','utf8'));
  const events = trace.traceEvents || trace;
  const fnCosts = new Map();
  for (const e of events) {
    if (e.name === 'FunctionCall' && e.args && e.args.data) {
      const fn = e.args.data.functionName || (e.args.data.url + ':' + e.args.data.lineNumber);
      const dur = e.dur || 0;
      fnCosts.set(fn, (fnCosts.get(fn) || 0) + dur);
    }
  }
  const top = [...fnCosts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15);
  console.log('\nTOP 15 FUNCTION COSTS (μs):');
  top.forEach(([fn,us])=> console.log('  ' + (us/1000).toFixed(0) + ' ms  ' + fn));
  await browser.close();
})();
