/**
 * environment.js — Ambient environmental life
 *  • Wind vector with periodic gusts
 *  • Drifting dust motes around player
 *  • Wind-borne leaves (rise/spin/blow with gusts)
 *  • Tumbling paper/garbage scraps
 *  • Grass-tuft flecks kicked up by strong gusts at ground level
 * All visuals are procedural — zero texture downloads.
 * Depends on: THREE, optionally VoxelWorld for terrain height.
 */
const Environment = (function () {
  'use strict';

  let _scene = null;
  let _camera = null;
  let _enabled = true;

  // ── Wind ───────────────────────────────────────────────
  const _wind = new THREE.Vector3(1, 0, 0);
  let _windDir = 0;                 // radians (rotates slowly)
  let _windStrength = 1.5;          // base m/s
  let _gustT = 0;                   // current gust timer
  let _gustNext = 6 + Math.random() * 10;
  let _gustStrength = 0;            // 0..1 gust intensity (eases in/out)
  let _gustPhase = 0;               // 0=quiet 1=ramping 2=peak 3=fading
  let _gustElapsed = 0;
  let _gustDur = 0;
  const _tmp3 = new THREE.Vector3();

  // ── Particle pools ─────────────────────────────────────
  const dust    = [];   // small brown spheres
  const leaves  = [];   // tiny stretched green planes
  const scraps  = [];   // tumbling white/grey paper
  const tufts   = [];   // gust-kicked grass blades

  const MAX_DUST   = 90;
  const MAX_LEAVES = 60;
  const MAX_SCRAPS = 24;
  const MAX_TUFTS  = 40;

  // Shared geometries (reuse on GPU)
  const _gDust   = new THREE.SphereGeometry(0.04, 4, 3);
  const _gLeaf   = new THREE.PlaneGeometry(0.18, 0.10);
  const _gScrap  = new THREE.PlaneGeometry(0.22, 0.16);
  const _gTuft   = new THREE.PlaneGeometry(0.06, 0.22);

  // Shared materials (color set per-spawn)
  const _mDust = new THREE.MeshBasicMaterial({
    color: 0xC2A878, transparent: true, opacity: 0.45, depthWrite: false,
    fog: true,
  });
  const _mLeafA = new THREE.MeshBasicMaterial({
    color: 0x7A9F3F, transparent: true, opacity: 0.85,
    depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
  const _mLeafB = new THREE.MeshBasicMaterial({
    color: 0xC8A04A, transparent: true, opacity: 0.85,
    depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
  const _mScrap = new THREE.MeshBasicMaterial({
    color: 0xE8E2C8, transparent: true, opacity: 0.92,
    depthWrite: false, side: THREE.DoubleSide, fog: true,
  });
  const _mTuft = new THREE.MeshBasicMaterial({
    color: 0x4E6B2C, transparent: true, opacity: 0.9,
    depthWrite: false, side: THREE.DoubleSide, fog: true,
  });

  function _playerPos() {
    try {
      if (typeof GameManager !== 'undefined' && GameManager.getPlayer) {
        var p = GameManager.getPlayer();
        if (p && p.position) return p.position;
      }
    } catch (e) {}
    if (_camera && _camera.position) return _camera.position;
    return new THREE.Vector3(0, 4, 0);
  }

  function _groundAt(x, z) {
    try {
      if (typeof window !== 'undefined' && window.VoxelWorld && window.VoxelWorld.getTerrainHeight) {
        return window.VoxelWorld.getTerrainHeight(x, z);
      }
    } catch (e) {}
    return 0;
  }

  // ── Spawners ──────────────────────────────────────────
  function _spawnDust(px, pz) {
    if (dust.length >= MAX_DUST) return;
    var ang = Math.random() * Math.PI * 2;
    var rad = 6 + Math.random() * 22;
    var x = px + Math.cos(ang) * rad;
    var z = pz + Math.sin(ang) * rad;
    var gy = _groundAt(x, z);
    var y = gy + 0.4 + Math.random() * 2.2;
    var m = new THREE.Mesh(_gDust, _mDust);
    m.position.set(x, y, z);
    var s = 0.7 + Math.random() * 1.3;
    m.scale.setScalar(s);
    _scene.add(m);
    dust.push({
      mesh: m, life: 4 + Math.random() * 3, maxLife: 7,
      vx: 0, vy: 0.05 + Math.random() * 0.1, vz: 0,
      ph: Math.random() * Math.PI * 2,
    });
  }

  function _spawnLeaf(px, pz) {
    if (leaves.length >= MAX_LEAVES) return;
    var ang = Math.random() * Math.PI * 2;
    var rad = 5 + Math.random() * 25;
    var x = px + Math.cos(ang) * rad;
    var z = pz + Math.sin(ang) * rad;
    var gy = _groundAt(x, z);
    var y = gy + 0.2 + Math.random() * 4;
    var mat = (Math.random() < 0.55) ? _mLeafA : _mLeafB;
    var m = new THREE.Mesh(_gLeaf, mat);
    m.position.set(x, y, z);
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    _scene.add(m);
    leaves.push({
      mesh: m, life: 5 + Math.random() * 4, maxLife: 9,
      vy: 0.1 + Math.random() * 0.4,
      spinX: (Math.random() - 0.5) * 4, spinY: (Math.random() - 0.5) * 4, spinZ: (Math.random() - 0.5) * 4,
      ph: Math.random() * Math.PI * 2,
    });
  }

  function _spawnScrap(px, pz) {
    if (scraps.length >= MAX_SCRAPS) return;
    var ang = Math.random() * Math.PI * 2;
    var rad = 4 + Math.random() * 18;
    var x = px + Math.cos(ang) * rad;
    var z = pz + Math.sin(ang) * rad;
    var gy = _groundAt(x, z);
    var m = new THREE.Mesh(_gScrap, _mScrap);
    m.position.set(x, gy + 0.05, z);
    m.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    m.rotation.z = Math.random() * Math.PI;
    _scene.add(m);
    scraps.push({
      mesh: m, life: 6 + Math.random() * 5, maxLife: 11,
      vy: 0.0,
      tumble: 0, spin: (Math.random() - 0.5) * 3,
      ph: Math.random() * Math.PI * 2,
    });
  }

  function _spawnTuft(px, pz) {
    if (tufts.length >= MAX_TUFTS) return;
    var ang = Math.random() * Math.PI * 2;
    var rad = 2 + Math.random() * 14;
    var x = px + Math.cos(ang) * rad;
    var z = pz + Math.sin(ang) * rad;
    var gy = _groundAt(x, z);
    var m = new THREE.Mesh(_gTuft, _mTuft);
    m.position.set(x, gy + 0.12, z);
    m.rotation.z = (Math.random() - 0.5) * 0.4;
    _scene.add(m);
    tufts.push({
      mesh: m, life: 1.0 + Math.random() * 0.8, maxLife: 1.6,
      vy: 0.6 + Math.random() * 0.6,
      ph: Math.random() * Math.PI * 2,
    });
  }

  // ── Init ─────────────────────────────────────────────
  function init(scene, camera) {
    _scene = scene;
    _camera = camera || _camera;
    var pp = _playerPos();
    // Pre-seed a small population so the world feels alive immediately
    for (var i = 0; i < 50; i++) _spawnDust(pp.x, pp.z);
    for (var j = 0; j < 30; j++) _spawnLeaf(pp.x, pp.z);
    for (var k = 0; k < 12; k++) _spawnScrap(pp.x, pp.z);
  }

  // ── Update ───────────────────────────────────────────
  function update(delta) {
    if (!_scene || !_enabled) return;
    delta = Math.min(delta || 0.016, 0.1);
    var pp = _playerPos();

    // Wind direction drifts slowly
    _windDir += delta * 0.05;
    var bx = Math.cos(_windDir);
    var bz = Math.sin(_windDir);

    // Gust state machine
    _gustT += delta;
    if (_gustPhase === 0 && _gustT >= _gustNext) {
      _gustPhase = 1;
      _gustElapsed = 0;
      _gustDur = 1.0 + Math.random() * 1.2;
      _gustT = 0;
    }
    if (_gustPhase === 1) {
      _gustElapsed += delta;
      _gustStrength = Math.min(1, _gustElapsed / _gustDur);
      if (_gustStrength >= 1) { _gustPhase = 2; _gustElapsed = 0; _gustDur = 1.5 + Math.random() * 2.0; }
    } else if (_gustPhase === 2) {
      _gustElapsed += delta;
      if (_gustElapsed >= _gustDur) { _gustPhase = 3; _gustElapsed = 0; _gustDur = 1.5 + Math.random() * 2.0; }
    } else if (_gustPhase === 3) {
      _gustElapsed += delta;
      _gustStrength = Math.max(0, 1 - _gustElapsed / _gustDur);
      if (_gustStrength <= 0) {
        _gustPhase = 0;
        _gustStrength = 0;
        _gustNext = 7 + Math.random() * 14;
      }
    }
    var totalWind = _windStrength + _gustStrength * 5.5;
    _wind.set(bx * totalWind, 0, bz * totalWind);

    // Trickle-spawn ambient particles
    if (Math.random() < 0.55) _spawnDust(pp.x, pp.z);
    if (Math.random() < 0.32) _spawnLeaf(pp.x, pp.z);
    if (Math.random() < 0.06) _spawnScrap(pp.x, pp.z);

    // Gust burst — kick up grass + extra leaves + scraps
    if (_gustPhase === 1 && _gustStrength < 0.4 && Math.random() < 0.8) {
      for (var bn = 0; bn < 8; bn++) _spawnTuft(pp.x, pp.z);
      for (var bl = 0; bl < 4; bl++) _spawnLeaf(pp.x, pp.z);
      for (var bs = 0; bs < 2; bs++) _spawnScrap(pp.x, pp.z);
    }

    // ── Update DUST ────────────────────────────────
    for (var di = dust.length - 1; di >= 0; di--) {
      var d = dust[di];
      d.life -= delta;
      d.ph += delta * 1.7;
      var w = totalWind * 0.45;
      d.mesh.position.x += (_wind.x * 0.3 + Math.sin(d.ph) * 0.05) * delta;
      d.mesh.position.z += (_wind.z * 0.3 + Math.cos(d.ph * 0.8) * 0.05) * delta;
      d.mesh.position.y += d.vy * delta;
      var lr = d.life / d.maxLife;
      d.mesh.material.opacity = Math.max(0, Math.min(0.45, lr * 0.45));
      var distSq = (d.mesh.position.x - pp.x) * (d.mesh.position.x - pp.x)
                 + (d.mesh.position.z - pp.z) * (d.mesh.position.z - pp.z);
      if (d.life <= 0 || distSq > 1600) {
        _scene.remove(d.mesh);
        dust.splice(di, 1);
      }
    }

    // ── Update LEAVES ──────────────────────────────
    for (var li = leaves.length - 1; li >= 0; li--) {
      var L = leaves[li];
      L.life -= delta;
      L.ph += delta * 2.4;
      var lift = (L.vy + Math.sin(L.ph) * 0.3 + _gustStrength * 1.6) * delta;
      L.mesh.position.x += (_wind.x * 0.6) * delta;
      L.mesh.position.z += (_wind.z * 0.6) * delta;
      L.mesh.position.y += lift;
      L.mesh.rotation.x += L.spinX * delta;
      L.mesh.rotation.y += L.spinY * delta;
      L.mesh.rotation.z += L.spinZ * delta;
      var lrl = L.life / L.maxLife;
      L.mesh.material.opacity = Math.max(0, Math.min(0.9, lrl * 0.9));
      var dsl = (L.mesh.position.x - pp.x) * (L.mesh.position.x - pp.x)
              + (L.mesh.position.z - pp.z) * (L.mesh.position.z - pp.z);
      if (L.life <= 0 || dsl > 2500) {
        _scene.remove(L.mesh);
        leaves.splice(li, 1);
      }
    }

    // ── Update SCRAPS / GARBAGE rolling ──────────────
    for (var si = scraps.length - 1; si >= 0; si--) {
      var S = scraps[si];
      S.life -= delta;
      S.ph += delta * 1.5;
      // Garbage skitters along the ground; under gusts it tumbles up briefly
      var rolling = totalWind * 0.7;
      S.mesh.position.x += _wind.x * 0.55 * delta;
      S.mesh.position.z += _wind.z * 0.55 * delta;
      // Tumble height: small hops correlated to wind strength
      S.tumble += delta * (2 + _gustStrength * 4);
      var hop = Math.max(0, Math.sin(S.tumble) ) * (0.06 + _gustStrength * 0.5);
      var gy = _groundAt(S.mesh.position.x, S.mesh.position.z);
      S.mesh.position.y = gy + 0.05 + hop;
      // Spin around vertical when sliding, tumble forward when airborne
      if (hop > 0.1) {
        S.mesh.rotation.x += rolling * delta;
        S.mesh.rotation.z += S.spin * delta * 0.4;
      } else {
        S.mesh.rotation.z += S.spin * delta * 0.6;
      }
      var lrs = S.life / S.maxLife;
      S.mesh.material.opacity = Math.max(0, Math.min(0.92, lrs * 0.92));
      var dss = (S.mesh.position.x - pp.x) * (S.mesh.position.x - pp.x)
              + (S.mesh.position.z - pp.z) * (S.mesh.position.z - pp.z);
      if (S.life <= 0 || dss > 1600) {
        _scene.remove(S.mesh);
        scraps.splice(si, 1);
      }
    }

    // ── Update TUFTS (gust-kicked grass) ─────────────
    for (var ti = tufts.length - 1; ti >= 0; ti--) {
      var T = tufts[ti];
      T.life -= delta;
      T.ph += delta * 3;
      T.mesh.position.x += _wind.x * 0.7 * delta;
      T.mesh.position.z += _wind.z * 0.7 * delta;
      T.mesh.position.y += T.vy * delta;
      T.vy -= 1.4 * delta; // settle back down
      T.mesh.rotation.x += 6 * delta;
      T.mesh.rotation.z += 4 * delta;
      var lrt = T.life / T.maxLife;
      T.mesh.material.opacity = Math.max(0, Math.min(0.9, lrt * 0.9));
      if (T.life <= 0) {
        _scene.remove(T.mesh);
        tufts.splice(ti, 1);
      }
    }
  }

  function clear() {
    if (!_scene) return;
    for (var i = 0; i < dust.length; i++)   _scene.remove(dust[i].mesh);
    for (var j = 0; j < leaves.length; j++) _scene.remove(leaves[j].mesh);
    for (var k = 0; k < scraps.length; k++) _scene.remove(scraps[k].mesh);
    for (var m = 0; m < tufts.length; m++)  _scene.remove(tufts[m].mesh);
    dust.length = 0; leaves.length = 0; scraps.length = 0; tufts.length = 0;
    _gustPhase = 0; _gustStrength = 0; _gustT = 0; _gustNext = 6 + Math.random() * 10;
  }

  function getWind(out) {
    out = out || _tmp3;
    out.copy(_wind);
    return out;
  }

  function getGust() { return _gustStrength; }
  function setEnabled(on) { _enabled = !!on; if (!_enabled) clear(); }

  return { init, update, clear, getWind, getGust, setEnabled };
})();
if (typeof window !== 'undefined') window.Environment = Environment;
