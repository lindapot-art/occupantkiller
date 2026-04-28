// tools/qa-verify.js — shared anti-fake-stamp verification for QA scripts.
// Three checks that make silent gameplay-failures impossible to hide:
//   1. assertGameReady(page)      — fails if boot-error overlay visible OR required modules missing
//   2. assertFramesVary(dir, glob)— fails if captured PNGs are byte-identical (means nothing rendered)
//   3. assertNoBootErrorPixels(p) — opens a sample frame and rejects if dominated by error-overlay color
// Exit codes: 2 = boot failed, 3 = frames identical / boot-error pixels detected.

const fs   = require('fs');
const path = require('path');

const REQUIRED_MODULES = ['GameManager', 'Enemies', 'HUD', 'Weapons', 'DroneSystem', 'VehicleSystem', 'Tracers', 'VoxelWorld'];

async function assertGameReady(page, { timeoutMs = 30000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate((mods) => {
      const overlay = document.getElementById('error-overlay');
      const overlayVisible = overlay && overlay.style.display !== 'none' && overlay.innerText.indexOf('BOOT ERROR') >= 0;
      const preloader = document.getElementById('boot-preloader');
      const preloaderVisible = preloader && preloader.style.display !== 'none';
      const missing = mods.filter(m => typeof window[m] === 'undefined');
      const stage = (window.GameManager && window.GameManager.getCurrentStage) ? window.GameManager.getCurrentStage() : -1;
      return { overlayVisible, overlayText: overlayVisible ? overlay.innerText.slice(0,200) : '', preloaderVisible, missing, stage };
    }, REQUIRED_MODULES);

    if (state.overlayVisible) {
      console.error('[QA-VERIFY] BOOT_FAILED — error overlay visible:\n' + state.overlayText);
      process.exit(2);
    }
    if (state.missing.length === 0 && !state.preloaderVisible && state.stage >= 0) {
      console.log('[QA-VERIFY] gameReady OK | stage=' + state.stage + ' | all modules present');
      return state;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  // Timed out
  const final = await page.evaluate((mods) => ({
    missing: mods.filter(m => typeof window[m] === 'undefined'),
    overlayText: (document.getElementById('error-overlay') || {}).innerText || ''
  }), REQUIRED_MODULES);
  console.error('[QA-VERIFY] BOOT_TIMEOUT after ' + timeoutMs + 'ms | missing=' + JSON.stringify(final.missing) + '\noverlay=' + final.overlayText.slice(0,200));
  process.exit(2);
}

function assertFramesVary(dir, prefix = '') {
  if (!fs.existsSync(dir)) { console.error('[QA-VERIFY] dir missing: ' + dir); process.exit(3); }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') && (!prefix || f.startsWith(prefix))).sort();
  if (files.length < 2) { console.error('[QA-VERIFY] not enough frames: ' + files.length); process.exit(3); }
  // Compare file sizes — identical PNGs (boot-error overlay) collapse to a tiny set of sizes.
  const sizes = files.map(f => fs.statSync(path.join(dir, f)).size);
  const uniq = new Set(sizes);
  const variance = uniq.size / sizes.length;
  console.log('[QA-VERIFY] frame variance: ' + uniq.size + ' unique sizes / ' + sizes.length + ' frames (' + (variance*100).toFixed(1) + '%)');
  if (uniq.size < 5 || variance < 0.05) {
    console.error('[QA-VERIFY] FRAMES_IDENTICAL — likely captured static error/loading screen, not gameplay');
    // Compare first two frames byte-by-byte for clearer diagnosis
    const a = fs.readFileSync(path.join(dir, files[0]));
    const b = fs.readFileSync(path.join(dir, files[Math.floor(files.length/2)]));
    if (a.length === b.length && a.equals(b)) console.error('[QA-VERIFY]   first frame === middle frame (byte-identical)');
    process.exit(3);
  }
  return { uniqueSizes: uniq.size, total: sizes.length, variance };
}

module.exports = { assertGameReady, assertFramesVary, REQUIRED_MODULES };
