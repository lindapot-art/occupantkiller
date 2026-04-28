// Live verification of cloud layer + snow accumulation.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  page.on('console', m => { const t=m.type(); if (t==='error'||t==='warning') console.log('[CONSOLE-'+t.toUpperCase()+']', m.text()); });
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait GameManager + preloader gone
  for (let i=0;i<200;i++){ if (await page.evaluate(()=>!!(window.GameManager&&window.GameManager.startGame))) break; await new Promise(r=>setTimeout(r,100)); }
  for (let i=0;i<100;i++){ if (await page.evaluate(()=>{const p=document.getElementById('boot-preloader');return !p||p.style.opacity==='0';})) break; await new Promise(r=>setTimeout(r,100)); }
  // Start game
  await page.evaluate(()=>{const b=document.getElementById('quick-start-btn');b&&b.click();});
  await new Promise(r=>setTimeout(r,2500));

  const outDir = path.join(__dirname,'screenshots','weather');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});

  const checks = [];
  // 1. Confirm cloud-layer + snow-cover exist
  const sceneInfo = await page.evaluate(() => {
    const s = window.GameManager.getScene && window.GameManager.getScene();
    if (!s) return { error: 'no scene' };
    let cloudGroup=null, snowCover=null, cloudCount=0;
    s.traverse(o => {
      if (o.name === 'cloud-layer') { cloudGroup = o; cloudCount = o.children.length; }
      if (o.name === 'snow-cover') snowCover = o;
    });
    return {
      hasCloudGroup: !!cloudGroup,
      cloudCount,
      hasSnowCover: !!snowCover,
      snowVisible: snowCover ? snowCover.visible : false,
      snowOpacity: snowCover && snowCover.material ? snowCover.material.opacity : -1,
    };
  });
  console.log('SCENE INFO:', sceneInfo);
  checks.push({ name: 'cloud group exists with sprites', pass: sceneInfo.hasCloudGroup && sceneInfo.cloudCount > 30 });
  checks.push({ name: 'snow cover instanced mesh exists', pass: sceneInfo.hasSnowCover });
  checks.push({ name: 'snow cover hidden when not snowing', pass: sceneInfo.snowVisible === false });

  // 2. Force CLEAR weather → screenshot
  await page.evaluate(()=>window.WeatherSystem.setWeather('clear'));
  await new Promise(r=>setTimeout(r,800));
  await page.screenshot({ path: path.join(outDir,'01-clear.png'), fullPage: false });

  // 3. Force OVERCAST → screenshot (clouds should darken+thicken)
  await page.evaluate(()=>window.WeatherSystem.setWeather('overcast'));
  await new Promise(r=>setTimeout(r,1500));
  await page.screenshot({ path: path.join(outDir,'02-overcast.png') });

  // 4. Force RAIN
  await page.evaluate(()=>window.WeatherSystem.setWeather('rain'));
  await new Promise(r=>setTimeout(r,1500));
  await page.screenshot({ path: path.join(outDir,'03-rain.png') });

  // 5. Force SNOW → wait for accumulation → check snow cover visible & opacity > 0.3
  await page.evaluate(()=>window.WeatherSystem.setWeather('snow'));
  await new Promise(r=>setTimeout(r,5000)); // accumulate
  const snowInfo = await page.evaluate(()=>{
    const s = window.GameManager.getScene();
    let sc=null; s.traverse(o=>{if(o.name==='snow-cover')sc=o;});
    return sc ? { visible: sc.visible, opacity: sc.material.opacity, instanceCount: sc.count } : null;
  });
  console.log('SNOW AFTER 5s:', snowInfo);
  checks.push({ name: 'snow cover visible during snow', pass: !!snowInfo && snowInfo.visible === true });
  checks.push({ name: 'snow opacity grew (>0.05 after 5s)', pass: !!snowInfo && snowInfo.opacity > 0.05 });
  await page.screenshot({ path: path.join(outDir,'04-snow.png') });

  // 6. Back to CLEAR → snow should melt away
  await page.evaluate(()=>window.WeatherSystem.setWeather('clear'));
  await new Promise(r=>setTimeout(r,7000));
  const meltInfo = await page.evaluate(()=>{
    const s = window.GameManager.getScene();
    let sc=null; s.traverse(o=>{if(o.name==='snow-cover')sc=o;});
    return sc ? { visible: sc.visible, opacity: sc.material.opacity } : null;
  });
  console.log('AFTER MELT:', meltInfo);
  checks.push({ name: 'snow opacity decayed back', pass: !!meltInfo && meltInfo.opacity < snowInfo.opacity });

  console.log('\n=== VERDICT ===');
  let allPass = true;
  for (const c of checks) {
    console.log((c.pass ? 'PASS' : 'FAIL') + ' :: ' + c.name);
    if (!c.pass) allPass = false;
  }
  console.log(allPass ? '\nALL CHECKS PASSED' : '\nFAILURES PRESENT');
  await browser.close();
  process.exit(allPass ? 0 : 1);
})();
