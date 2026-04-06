/**
 * FULL QA TEST v2 — Tests everything testable without GPU WebGL
 * Phase 1: Server-side checks (all assets serve correctly)
 * Phase 2: HTML structure validation
 * Phase 3: JS syntax validation (node --check)
 * Phase 4: Module export validation
 * Phase 5: Live URL check (Render.com deployment)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = process.argv[2] || 'http://localhost:3000';
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
const failures = [];

function ok(label) { passed++; console.log(`  ✅ ${label}`); }
function fail(label, detail) { failed++; failures.push(`${label}: ${detail}`); console.log(`  ❌ ${label} — ${detail}`); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? require('https') : http;
    proto.get(url, { timeout: 10000 }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on('error', reject);
  });
}

(async () => {
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  FULL QA TEST v2 — ${new Date().toISOString()}`);
  console.log(`  Target: ${BASE}`);
  console.log(`═══════════════════════════════════════════════\n`);

  // ═══ PHASE 1: Server & Asset Loading ═══
  console.log('▸ PHASE 1: Server & Asset Loading');
  try {
    const index = await httpGet(BASE);
    if (index.status === 200) ok(`index.html: HTTP 200 (${index.body.length} bytes)`);
    else fail('index.html', `HTTP ${index.status}`);

    // Security headers
    const secHeaders = ['x-content-type-options', 'x-frame-options', 'x-xss-protection'];
    for (const h of secHeaders) {
      if (index.headers[h]) ok(`Header: ${h} = ${index.headers[h]}`);
      else fail(`Header: ${h}`, 'missing');
    }

    // Path traversal
    const trav = await httpGet(`${BASE}/..%2F..%2F..%2Fetc%2Fpasswd`);
    if (trav.status === 404 || trav.status === 403) ok(`Path traversal blocked (${trav.status})`);
    else fail('Path traversal', `returned ${trav.status}`);

    // Null byte
    const nullB = await httpGet(`${BASE}/%00`);
    if (nullB.status === 400) ok(`Null byte blocked (400)`);
    else fail('Null byte', `returned ${nullB.status}`);

    // All scripts
    const scripts = [
      'three.min.js', 'voxel-world.js', 'camera-system.js', 'time-system.js',
      'economy.js', 'blockchain.js', 'marketplace.js', 'skills.js', 'ranks.js',
      'building.js', 'npc-system.js', 'drone-system.js', 'vehicles.js',
      'automation.js', 'missions.js', 'pickups.js', 'hud.js', 'weapons.js',
      'enemies.js', 'audio-system.js', 'weather-system.js', 'ml-system.js',
      'tracers.js', 'stage-vfx.js', 'combat-extras.js', 'traversal.js',
      'enemy-types.js', 'world-features.js', 'perks.js', 'mission-types.js',
      'feedback.js', 'progression.js', 'game-manager.js', 'style.css'
    ];
    let assetsOk = 0;
    for (const s of scripts) {
      try {
        const r = await httpGet(`${BASE}/${s}`);
        if (r.status === 200 && r.body.length > 100) {
          assetsOk++;
        } else {
          fail(`Asset: ${s}`, `status=${r.status}, size=${r.body.length}`);
        }
      } catch(e) {
        fail(`Asset: ${s}`, e.message);
      }
    }
    if (assetsOk === scripts.length) ok(`All ${assetsOk} assets serve HTTP 200`);
    else ok(`${assetsOk}/${scripts.length} assets loaded`);

  } catch(e) {
    fail('Server connection', e.message);
  }

  // ═══ PHASE 2: HTML Structure ═══
  console.log('\n▸ PHASE 2: HTML Structure');
  try {
    const htmlContent = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    const domIds = [
      'game-container', 'crosshair', 'health-bar', 'ammo-display',
      'wave-display', 'stage-display', 'kill-feed', 'minimap-canvas',
      'start-btn', 'weapon-name-display', 'damage-vignette', 'hud',
      'score-display', 'kills-display', 'reload-indicator', 'compass',
      'stamina-bar', 'armor-bar', 'vehicle-hud', 'build-hud'
    ];
    let domOk = 0, domFail = 0;
    for (const id of domIds) {
      if (htmlContent.includes(`id="${id}"`)) domOk++;
      else { domFail++; fail(`DOM: #${id}`, 'not found in HTML'); }
    }
    if (domFail === 0) ok(`All ${domOk} required DOM elements present`);

    const scriptTagCount = (htmlContent.match(/<script\s+src=/g) || []).length;
    if (scriptTagCount >= 33) ok(`${scriptTagCount} script tags found`);
    else fail('Script tags', `only ${scriptTagCount} found, expected 33+`);

    if (htmlContent.startsWith('<!DOCTYPE html>')) ok('DOCTYPE present');
    else fail('DOCTYPE', 'missing');

    if (htmlContent.includes('GameManager.init()')) ok('Boot script: GameManager.init() present');
    else fail('Boot script', 'GameManager.init() missing');

    if (htmlContent.includes("getElementById('start-btn')")) ok('Start button wired');
    else fail('Start button', 'click handler missing');

  } catch(e) {
    fail('HTML read', e.message);
  }

  // ═══ PHASE 3: JS Syntax Validation ═══
  console.log('\n▸ PHASE 3: JS Syntax (node --check)');
  const jsFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
  let syntaxOk = 0, syntaxFail = 0;
  for (const f of jsFiles) {
    try {
      execSync(`node --check "${path.join(ROOT, f)}"`, { stdio: 'pipe' });
      syntaxOk++;
    } catch(e) {
      syntaxFail++;
      fail(`Syntax: ${f}`, e.stderr ? e.stderr.toString().trim().substring(0, 100) : 'failed');
    }
  }
  if (syntaxFail === 0) ok(`All ${syntaxOk} JS files pass syntax check`);

  // ═══ PHASE 4: Module Structure ═══
  console.log('\n▸ PHASE 4: Module Structure');
  const moduleFiles = jsFiles.filter(f => f !== 'three.min.js' && f !== 'server.js');
  let iifeOk = 0;
  for (const f of moduleFiles) {
    const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (content.match(/^(const|var|let)\s+\w+\s*=\s*\(?\s*function/m) ||
        content.match(/^(const|var|let)\s+\w+\s*=\s*\(\s*\(\)\s*=>/m)) {
      iifeOk++;
    } else {
      console.log(`    ⚠ ${f}: non-standard module pattern`);
    }
  }
  ok(`${iifeOk}/${moduleFiles.length} modules use IIFE pattern`);

  const apiChecks = {
    'enemies.js': ['getAll', 'getAliveCount', 'getEnemyMeshes', 'damage', 'startWave', 'clear', 'update'],
    'npc-system.js': ['init', 'update', 'clear', 'getAll', 'getCount'],
    'vehicles.js': ['init', 'update', 'clear', 'getAll'],
    'drone-system.js': ['init', 'update', 'clear', 'getAll'],
    'tracers.js': ['init', 'update', 'clear', 'spawnTracer', 'spawnExplosion', 'spawnBlood'],
    'weapons.js': ['tryFire', 'update', 'getCurrentType'],
    'game-manager.js': ['init', 'startGame', 'getScene', 'getCamera'],
  };
  let apiOk = true;
  for (const [file, methods] of Object.entries(apiChecks)) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of methods) {
      if (!content.includes(m)) {
        fail(`API: ${file}`, `missing '${m}'`);
        apiOk = false;
      }
    }
  }
  if (apiOk) ok('All critical module APIs present');

  // ═══ PHASE 5: Render.com Deployment ═══
  console.log('\n▸ PHASE 5: Render.com Deployment');
  try {
    if (fs.existsSync(path.join(ROOT, 'render.yaml'))) {
      const ry = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
      if (ry.includes('node server.js')) ok('render.yaml: startCommand correct');
      else fail('render.yaml', 'missing startCommand');
      if (ry.includes('npm install')) ok('render.yaml: buildCommand correct');
      else fail('render.yaml', 'missing buildCommand');
      if (ry.includes('healthCheckPath')) ok('render.yaml: healthCheck configured');
      else fail('render.yaml', 'missing healthCheck');
    } else {
      fail('render.yaml', 'file not found');
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    if (pkg.scripts && pkg.scripts.start === 'node server.js') ok('package.json: start script correct');
    else fail('package.json', `start script wrong: ${pkg.scripts && pkg.scripts.start}`);

    const serverContent = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    if (serverContent.includes('process.env.PORT')) ok('server.js: reads PORT env var');
    else fail('server.js', 'does not read process.env.PORT');
    if (serverContent.includes("'0.0.0.0'")) ok('server.js: binds 0.0.0.0');
    else fail('server.js', 'does not bind 0.0.0.0');

    console.log('\n  Checking live Render deployment...');
    try {
      const live = await httpGet('https://occupantkiller.onrender.com');
      if (live.status === 200) {
        ok(`Render LIVE: HTTP 200 (${live.body.length} bytes)`);
        if (live.body.includes('ZOMBIELAND')) ok('Render: game title present');
        if (live.body.includes('game-container')) ok('Render: game-container present');
        if (live.body.includes('GameManager.init()')) ok('Render: boot script present');
      } else if (live.status === 301 || live.status === 302) {
        console.log(`    ⚠ Render: HTTP ${live.status} (redirect — deploy may be in progress)`);
      } else {
        fail('Render LIVE', `HTTP ${live.status}`);
      }
    } catch(e) {
      console.log(`    ⚠ Render not reachable: ${e.message.substring(0, 80)}`);
      console.log('    (Expected if deploy is still building — check dashboard)');
    }

  } catch(e) {
    fail('Deploy check', e.message);
  }

  // ═══ SUMMARY ═══
  console.log('\n═══════════════════════════════════════════════');
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`═══════════════════════════════════════════════`);
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log(`  • ${f}`);
  }
  console.log(`\nVERDICT: ${failed === 0 ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED'}\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
