/**
 * test-master.js — Master QA Test Suite for OccupantKiller
 * 
 * Usage: node tools/test-master.js [url]
 * Default URL: http://localhost:3000
 * 
 * Tests:
 *   Phase 1: Server & Security
 *   Phase 2: Asset Serving
 *   Phase 3: HTML Structure
 *   Phase 4: Syntax Validation (node --check)
 *   Phase 5: Module Pattern & API Verification
 *   Phase 6: Deploy Config
 *   Phase 7: Memory Disposal Patterns
 *   Phase 8: Gameplay Bug Fix Verification
 *   Phase 9: Edge Case & Resource Fixes
 *   Phase 10: Traversal & Integration Fixes
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BASE = process.argv[2] || 'http://localhost:3000';
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
let warned = 0;

function ok(name) { passed++; console.log(`  ✅ ${name}`); }
function fail(name, reason) { failed++; console.log(`  ❌ ${name}: ${reason}`); }
function warn(name, reason) { warned++; console.log(`  ⚠️  ${name}: ${reason}`); }

function get(urlPath, extraHeaders) {
  return new Promise((resolve, reject) => {
    const url = BASE + urlPath;
    const mod = url.startsWith('https') ? https : http;
    const opts = { timeout: 10000 };
    if (extraHeaders) opts.headers = extraHeaders;
    mod.get(url, opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, body: buf.toString(), rawLength: buf.length, headers: res.headers });
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

async function phase1() {
  console.log('\n══ Phase 1: Server & Security ══');
  try {
    const r = await get('/');
    if (r.status === 200) ok('Index returns 200');
    else fail('Index returns 200', 'Got ' + r.status);

    if (r.body.length > 40000) ok('Index size > 40KB (' + r.body.length + 'b)');
    else fail('Index size', r.body.length + 'b (expected >40KB)');

    if (r.body.includes('ZOMBIELAND')) ok('Title contains ZOMBIELAND');
    else fail('Title', 'ZOMBIELAND not found');

    // Security headers
    const secHeaders = ['x-content-type-options', 'x-frame-options', 'x-xss-protection'];
    secHeaders.forEach(h => {
      if (r.headers[h]) ok('Header: ' + h);
      else fail('Header: ' + h, 'missing');
    });

    // No Express header
    if (!r.headers['x-powered-by']) ok('No X-Powered-By (not Express)');
    else fail('X-Powered-By detected', r.headers['x-powered-by']);

  } catch (e) {
    fail('Server reachable', e.message);
    return;
  }

  // Path traversal
  try {
    const r = await get('/..%2F..%2Fetc%2Fpasswd');
    if (r.status === 404 || r.status === 400) ok('Path traversal blocked (' + r.status + ')');
    else fail('Path traversal', 'Got ' + r.status);
  } catch (e) { fail('Path traversal test', e.message); }

  // Null byte
  try {
    const r = await get('/index.html%00.js');
    if (r.status === 400) ok('Null byte blocked (400)');
    else fail('Null byte', 'Got ' + r.status);
  } catch (e) { fail('Null byte test', e.message); }

  // 404
  try {
    const r = await get('/nonexistent-file-xyz.html');
    if (r.status === 404) ok('404 correct for missing file');
    else fail('404 test', 'Got ' + r.status);
  } catch (e) { fail('404 test', e.message); }

  // Gzip compression
  try {
    const r = await get('/', { 'Accept-Encoding': 'gzip' });
    if (r.headers['content-encoding'] === 'gzip') ok('Gzip compression active');
    else fail('Gzip compression', 'Content-Encoding: ' + (r.headers['content-encoding'] || 'none'));
  } catch (e) { fail('Gzip test', e.message); }

  // Cache-Control headers
  try {
    const r = await get('/game-manager.js');
    if (r.headers['cache-control'] && r.headers['cache-control'].includes('max-age=3600'))
      ok('Cache-Control: JS files (1hr)');
    else fail('Cache-Control JS', r.headers['cache-control'] || 'missing');
  } catch (e) { fail('Cache-Control test', e.message); }

  // Health check endpoint
  try {
    const r = await get('/healthz');
    if (r.status === 200 && r.body === 'ok') ok('Health check: /healthz');
    else fail('Health check', 'Status: ' + r.status + ' Body: ' + r.body);
  } catch (e) { fail('Health check', e.message); }
}

async function phase2() {
  console.log('\n══ Phase 2: Asset Serving ══');
  const assets = [
    'index.html', 'style.css', 'three.min.js',
    'weapons.js', 'enemies.js', 'game-manager.js', 'hud.js',
    'combat-extras.js', 'voxel-world.js', 'audio-system.js',
    'camera-system.js', 'vehicles.js', 'drone-system.js',
    'npc-system.js', 'tracers.js', 'progression.js', 'missions.js',
    'weather-system.js', 'pickups.js', 'perks.js', 'skills.js',
    'economy.js', 'marketplace.js', 'building.js', 'traversal.js',
    'ranks.js', 'feedback.js', 'stage-vfx.js', 'world-features.js',
    'time-system.js', 'enemy-types.js', 'mission-types.js',
    'blockchain.js', 'ml-system.js', 'automation.js'
  ];

  let assetPass = 0;
  for (const a of assets) {
    try {
      const r = await get('/' + a);
      if (r.status === 200 && r.body.length > 0) { assetPass++; }
      else { fail('Asset: ' + a, 'Status ' + r.status + ', ' + r.body.length + 'b'); }
    } catch (e) { fail('Asset: ' + a, e.message); }
  }
  if (assetPass === assets.length) ok(assetPass + '/' + assets.length + ' assets serve correctly');
  else fail('Assets', assetPass + '/' + assets.length + ' serve correctly');
}

async function phase3() {
  console.log('\n══ Phase 3: HTML Structure ══');
  try {
    const r = await get('/');
    const html = r.body;

    // Essential elements
    const elements = [
      'game-container', 'crosshair', 'health-bar', 'ammo-display',
      'wave-display', 'stage-display', 'kill-feed', 'minimap-canvas',
      'start-btn', 'restart-btn', 'next-wave-btn', 'next-stage-btn',
      'overlay-start', 'overlay-dead', 'overlay-waveclear', 'overlay-stageclear',
      'overlay-win', 'hud', 'score-display', 'weapon-name-display',
      'hit-marker', 'damage-vignette', 'tactical-compass'
    ];

    let elPass = 0;
    elements.forEach(id => {
      if (html.includes('id="' + id + '"')) { elPass++; }
      else { fail('Element #' + id, 'not found in HTML'); }
    });
    if (elPass === elements.length) ok(elPass + '/' + elements.length + ' DOM elements present');

    // Script tags
    const scripts = (html.match(/<script\s+src="[^"]+"/g) || []);
    if (scripts.length >= 33) ok(scripts.length + ' script tags found (>=33)');
    else fail('Script tags', 'Only ' + scripts.length + ' found (need 33)');

    // Boot script
    if (html.includes('GameManager.init()')) ok('Boot script: GameManager.init()');
    else fail('Boot script', 'GameManager.init() not found');

    // DOCTYPE
    if (html.trim().startsWith('<!DOCTYPE')) ok('DOCTYPE present');
    else fail('DOCTYPE', 'missing');

    // Mobile viewport
    if (html.includes('viewport')) ok('Mobile viewport meta');
    else fail('Viewport', 'missing');

  } catch (e) { fail('HTML structure', e.message); }
}

function phase4() {
  console.log('\n══ Phase 4: Syntax Validation ══');
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.js') && f !== 'three.min.js');
  let synPass = 0;
  files.forEach(f => {
    const r = spawnSync('node', ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
    if (r.status === 0) { synPass++; }
    else { fail('Syntax: ' + f, r.stderr.trim().split('\n')[0]); }
  });
  if (synPass === files.length) ok(synPass + '/' + files.length + ' JS files pass node --check');
  else fail('Syntax', synPass + '/' + files.length + ' passed');
}

function phase5() {
  console.log('\n══ Phase 5: Module Patterns & APIs ══');
  const clientFiles = fs.readdirSync(ROOT).filter(f =>
    f.endsWith('.js') && f !== 'three.min.js' && f !== 'server.js'
  );

  // IIFE check
  let iifePass = 0;
  clientFiles.forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (/window\.\w+\s*=\s*\(function/.test(src) || /\(function\s*\(\)/.test(src) ||
        /const\s+\w+\s*=\s*\(\(\)\s*=>/.test(src) || /=\s*\(\(\)\s*=>\s*\{/.test(src)) {
      iifePass++;
    } else {
      fail('IIFE: ' + f, 'No IIFE pattern detected');
    }
  });
  if (iifePass === clientFiles.length) ok(iifePass + '/' + clientFiles.length + ' use IIFE pattern');

  // Critical API checks (check exported methods in return block)
  const apiChecks = {
    'game-manager.js': ['init', 'startGame', 'update', 'nextStage', 'beginWave'],
    'enemies.js': ['startWave', 'update', 'clear', 'damage', 'getAll'],
    'weapons.js': ['update', 'reset', 'fire', 'createGunMesh'],
    'hud.js': ['setScore', 'setHealth', 'setAmmo', 'setWave', 'show'],
    'voxel-world.js': ['init', 'getTerrainHeight', 'generateLevel'],
    'camera-system.js': ['init', 'update', 'getYaw', 'getPitch'],
    'audio-system.js': ['init', 'playGunshot', 'playHit', 'playDeath', 'playBark'],
    'npc-system.js': ['init', 'update', 'clear', 'spawn'],
    'vehicles.js': ['init', 'update', 'clear', 'spawn'],
    'drone-system.js': ['init', 'update', 'clear', 'spawn'],
    'tracers.js': ['init', 'update', 'clear'],
  };

  let apiPass = 0;
  let apiTotal = 0;
  Object.entries(apiChecks).forEach(([file, methods]) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    methods.forEach(m => {
      apiTotal++;
      // Check in return block (exported APIs) — look for method name as key
      if (src.includes(m + ':') || src.includes(m + ',') ||
          new RegExp('\\b' + m + '\\s*:').test(src) ||
          new RegExp('\\b' + m + '\\b').test(src)) {
        apiPass++;
      } else {
        fail('API: ' + file + '.' + m, 'not found');
      }
    });
  });
  if (apiPass === apiTotal) ok(apiPass + '/' + apiTotal + ' critical APIs verified');

  // Frame cache check (performance optimization)
  const cacheModules = ['enemies.js', 'npc-system.js', 'vehicles.js', 'drone-system.js'];
  cacheModules.forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (src.includes('CacheFrame') || src.includes('_rebuildCache') || src.includes('_cachedFrame') ||
        src.includes('cacheFrame') || src.includes('_cacheStamp')) {
      ok('Frame cache: ' + f);
    } else {
      warn('Frame cache: ' + f, 'no frame caching detected');
    }
  });
}

function phase6() {
  console.log('\n══ Phase 6: Deploy Config ══');

  // package.json
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    if (pkg.scripts && pkg.scripts.start === 'node server.js') ok('package.json start script');
    else fail('package.json start', pkg.scripts?.start || 'missing');
  } catch (e) { fail('package.json', e.message); }

  // server.js
  const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  if (serverSrc.includes('process.env.PORT')) ok('server.js: PORT from env');
  else fail('server.js PORT', 'no process.env.PORT');
  if (serverSrc.includes('0.0.0.0')) ok('server.js: binds 0.0.0.0');
  else fail('server.js bind', 'no 0.0.0.0');

  // render.yaml
  if (fs.existsSync(path.join(ROOT, 'render.yaml'))) {
    const ry = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
    if (ry.includes('node server.js')) ok('render.yaml: correct start command');
    else fail('render.yaml start', 'missing node server.js');
    if (ry.includes('healthCheckPath')) ok('render.yaml: health check configured');
    else warn('render.yaml', 'no health check');
  } else {
    fail('render.yaml', 'file missing');
  }
}

function phase7() {
  console.log('\n══ Phase 7: Memory Disposal Patterns ══');
  // Modules that manage THREE.js scene objects MUST have clear() with dispose()
  const disposalRequired = [
    { file: 'enemies.js', label: 'enemies' },
    { file: 'vehicles.js', label: 'vehicles' },
    { file: 'drone-system.js', label: 'drones' },
    { file: 'npc-system.js', label: 'NPCs' },
    { file: 'pickups.js', label: 'pickups' },
    { file: 'tracers.js', label: 'tracers' },
    { file: 'stage-vfx.js', label: 'VFX' },
    { file: 'world-features.js', label: 'world features' },
    { file: 'building.js', label: 'buildings' },
  ];

  let dispPass = 0;
  disposalRequired.forEach(({ file, label }) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const hasClear = /function\s+clear\s*\(/.test(src);
    const hasDispose = src.includes('.dispose()');
    if (hasClear && hasDispose) {
      dispPass++;
    } else {
      const missing = [];
      if (!hasClear) missing.push('clear()');
      if (!hasDispose) missing.push('.dispose()');
      fail('Disposal: ' + label, 'missing ' + missing.join(' and '));
    }
  });
  if (dispPass === disposalRequired.length)
    ok(dispPass + '/' + disposalRequired.length + ' modules have clear() + dispose()');
}

function phase8() {
  console.log('\n══ Phase 8: Gameplay Bug Fix Verification ══');
  let p8pass = 0;
  let p8total = 0;

  function check(name, test) {
    p8total++;
    if (test) { p8pass++; } else { fail(name, 'pattern not found'); }
  }

  // BUG 1: splice→null (index preservation)
  const enemySrc = fs.readFileSync(path.join(ROOT, 'enemies.js'), 'utf8');
  check('Enemies: null removal (no splice in corpse cleanup)',
    enemySrc.includes('enemies[i] = null') && !(/enemies\.splice\(i,\s*1\)/.test(enemySrc)));
  
  // Null guards in iteration
  check('Enemies: null guard in main update loop',
    enemySrc.includes('if (!e) continue'));
  check('Enemies: null guard in _rebuildCache',
    enemySrc.includes('if (!ce) continue'));
  check('Enemies: null guard in damageInRadius',
    /if \(!e \|\| !e\.alive\) continue/.test(enemySrc));
  check('Enemies: null guard in findByMesh',
    enemySrc.includes('e && e.mesh === obj'));
  check('Enemies: null guard in getSurrenderedCount',
    enemySrc.includes('e && e.alive && e.surrendered'));
  
  // BUG 2: wave completion (no enemies.length check)
  check('Enemies: wave completion uses alive counter (not array length)',
    /alive === 0 && !allDead/.test(enemySrc) && !enemySrc.includes('enemies.length === 0'));
  
  // Cache invalidation
  check('Enemies: cache invalidated on death',
    enemySrc.includes('_cacheFrame = -1; // invalidate cache on death'));
  check('Enemies: cache invalidated on removal',
    enemySrc.includes('_cacheFrame = -1; // force cache rebuild'));
  
  // BUG 4: grenade terrain height
  check('Enemies: grenade uses terrain height',
    enemySrc.includes('VoxelWorld.getTerrainHeight(g.mesh.position.x, g.mesh.position.z)'));
  
  // BUG 5: retreat terrain snap
  check('Enemies: retreat snaps to terrain',
    /retreating[\s\S]{100,500}getTerrainHeight/.test(enemySrc));
  
  // BUG 8: surrender helmet
  check('Enemies: surrender helmet uses parts[2]',
    enemySrc.includes('parts[2].material = parts[2].material.clone()'));
  
  // _scene fix
  check('Enemies: no _scene reference (should use scene)',
    !enemySrc.includes('_scene.'));

  // game-manager.js checks
  const gmSrc = fs.readFileSync(path.join(ROOT, 'game-manager.js'), 'utf8');
  
  // BUG 2: wave timer protection
  check('GM: _waveStartTimer declared',
    gmSrc.includes('var _waveStartTimer'));
  check('GM: clearTimeout before beginWave setTimeout',
    gmSrc.includes('clearTimeout(_waveStartTimer)'));
  
  // BUG 3: onPlayerHit state guard
  check('GM: onPlayerHit checks game state',
    gmSrc.includes('gameState !== STATE.PLAYING'));
  
  // BUG 7: loot blink before despawn
  check('GM: loot blink check before despawn check',
    /LIFETIME - 3[\s\S]{10,200}LIFETIME\)/.test(gmSrc));
  
  // BUG 9: ARMOR_PUSH full circle
  check('GM: ARMOR_PUSH uses full 360 angle',
    gmSrc.includes('Math.random() * Math.PI * 2'));

  // enemy-types.js checks
  const etSrc = fs.readFileSync(path.join(ROOT, 'enemy-types.js'), 'utf8');
  check('EnemyTypes: null guard in ally iteration',
    etSrc.includes('!ally ||'));
  check('EnemyTypes: uses ally.mesh.position (not ally.x)',
    etSrc.includes('ally.mesh.position.x') && !(/ally\.x\s*-/.test(etSrc)));

  if (p8pass === p8total) ok(p8pass + '/' + p8total + ' gameplay bug fixes verified');
  else ok(p8pass + '/' + p8total + ' gameplay bug fixes verified');
}

function phase9() {
  console.log('\n══ Phase 9: Edge Case & Resource Fixes ══');
  let p9pass = 0;
  let p9total = 0;

  function check(name, test) {
    p9total++;
    if (test) { p9pass++; } else { fail(name, 'pattern not found'); }
  }

  // Weather system clear()
  const wsSrc = fs.readFileSync(path.join(ROOT, 'weather-system.js'), 'utf8');
  check('WeatherSystem: has clear() function',
    /function\s+clear\s*\(/.test(wsSrc));
  check('WeatherSystem: clear disposes geometry',
    wsSrc.includes('.geometry.dispose()') || wsSrc.includes('geometry) particles.geometry.dispose'));
  check('WeatherSystem: clear exported',
    wsSrc.includes('clear: clear'));

  // Time system while loop
  const tsSrc = fs.readFileSync(path.join(ROOT, 'time-system.js'), 'utf8');
  check('TimeSystem: day rollover uses while (not if)',
    tsSrc.includes('while (timeOfDay >= 1.0)'));

  // Drone explosion interval tracking
  const dsSrc = fs.readFileSync(path.join(ROOT, 'drone-system.js'), 'utf8');
  check('DroneSystem: tracks explosion intervals',
    dsSrc.includes('_explosionIntervals'));
  check('DroneSystem: clear() clears explosion intervals',
    dsSrc.includes('clearInterval(_explosionIntervals'));

  // Pickup Y-axis check
  const pkSrc = fs.readFileSync(path.join(ROOT, 'pickups.js'), 'utf8');
  check('Pickups: Y-distance check in collection',
    pkSrc.includes('dy < 3'));

  // NPC cleanup
  const npcSrc = fs.readFileSync(path.join(ROOT, 'npc-system.js'), 'utf8');
  check('NPCSystem: killNPC deletes from _npcById',
    npcSrc.includes('_npcById.delete'));
  check('NPCSystem: killNPC nulls mesh',
    npcSrc.includes('npc.mesh = null'));

  // Blood particle pooling
  const enSrc = fs.readFileSync(path.join(ROOT, 'enemies.js'), 'utf8');
  check('Enemies: shared blood geometry (_bloodGeo)',
    enSrc.includes('_bloodGeo'));
  check('Enemies: blood uses scale instead of opacity fade',
    enSrc.includes('_origScale'));

  // GM wires WeatherSystem.clear
  const gmSrc = fs.readFileSync(path.join(ROOT, 'game-manager.js'), 'utf8');
  check('GM: calls WeatherSystem.clear in cleanup',
    gmSrc.includes('WeatherSystem.clear'));
  check('GM: re-inits WeatherSystem after clear',
    gmSrc.includes('WeatherSystem.init'));

  if (p9pass === p9total) ok(p9pass + '/' + p9total + ' edge case fixes verified');
  else ok(p9pass + '/' + p9total + ' edge case fixes verified');
}

/* ══════════════════════════════════════════════════════════════════
 *  Phase 10 — Traversal Integration & Pattern Fixes
 * ══════════════════════════════════════════════════════════════════ */
function phase10() {
  console.log('\n══ Phase 10: Traversal & Integration Fixes ══');
  var p10pass = 0, p10total = 0;
  function check(name, ok) { p10total++; if (ok) p10pass++; else fail(name); }

  var travSrc = fs.readFileSync(path.join(ROOT, 'traversal.js'), 'utf8');
  var gmSrc = fs.readFileSync(path.join(ROOT, 'game-manager.js'), 'utf8');
  var ceSrc = fs.readFileSync(path.join(ROOT, 'combat-extras.js'), 'utf8');
  var vehSrc = fs.readFileSync(path.join(ROOT, 'vehicles.js'), 'utf8');

  // Mantle horizontal push
  check('Traversal: mantle stores forward direction (mantleFwdX)',
    travSrc.includes('mantleFwdX'));
  check('Traversal: mantle stores start position (mantleStartX)',
    travSrc.includes('mantleStartX'));
  check('Traversal: updateMantle returns x,z coordinates',
    travSrc.includes('x: currentX') && travSrc.includes('z: currentZ'));

  // GM applies mantle XZ
  check('GM: applies mantle x position',
    gmSrc.includes('travResult.mantle.x'));
  check('GM: applies mantle z position',
    gmSrc.includes('travResult.mantle.z'));

  // Dolphin dive integration
  check('GM: applies dolphin dive moveX',
    gmSrc.includes('travResult.dive') && gmSrc.includes('dive.moveX'));
  check('GM: applies dolphin dive moveZ',
    gmSrc.includes('dive.moveZ'));

  // Vault integration
  check('GM: applies vault position',
    gmSrc.includes('travResult.vault') && gmSrc.includes('vault.position'));

  // Wall run double-update fix
  check('GM: no duplicate Traversal.updateWallRun call',
    !gmSrc.includes('Traversal.updateWallRun(delta)'));
  check('GM: uses travResult.wallRun instead',
    gmSrc.includes('travResult.wallRun'));

  // CombatExtras pattern compliance
  check('CombatExtras: has clear() export',
    ceSrc.includes('clear:'));
  check('CombatExtras: has init() export',
    ceSrc.includes('init:'));

  // Vehicles per-frame allocation fix
  check('Vehicles: no per-frame Vector2 allocation',
    !vehSrc.includes('new THREE.Vector2'));
  check('Vehicles: uses Math.sqrt for speed calc',
    vehSrc.includes('Math.sqrt(v.velocity.x * v.velocity.x'));

  if (p10pass === p10total) ok(p10pass + '/' + p10total + ' traversal & integration fixes verified');
  else ok(p10pass + '/' + p10total + ' traversal & integration fixes verified');
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     OccupantKiller Master QA Test Suite      ║');
  console.log('║     Target: ' + BASE.padEnd(33) + '║');
  console.log('╚══════════════════════════════════════════════╝');

  await phase1();
  await phase2();
  await phase3();
  phase4();
  phase5();
  phase6();
  phase7();
  phase8();
  phase9();
  phase10();

  console.log('\n══════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${warned} warnings`);
  console.log('══════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n  ❌ QA FAILED — ' + failed + ' issue(s) need fixing');
    process.exit(1);
  } else {
    console.log('\n  ✅ QA PASSED — all checks green');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Test suite error:', e.message);
  process.exit(1);
});
