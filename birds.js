// ============================================================
//  birds.js — Atmospheric bird flock + "scared scatter" reaction
//  - Crows / pigeons / sparrows circle overhead
//  - When shots fire near them, they scatter chaotically and caw
//  Public API: init(scene), update(dt), clear(), scareNear(pos, radius), spawnFlock(n)
// ============================================================
window.Birds = (function () {
  'use strict';

  let _scene = null;
  let _birds = [];
  let _t = 0;

  // Procedural bird mesh: tiny 3-voxel body + 2 flapping wings
  function _makeBird(color) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color || 0x111111 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.32), bodyMat);
    g.add(body);
    var wingGeo = new THREE.BoxGeometry(0.55, 0.04, 0.18);
    var wingMat = new THREE.MeshLambertMaterial({ color: color || 0x111111 });
    var wL = new THREE.Mesh(wingGeo, wingMat); wL.position.set(-0.30, 0.04, 0); g.add(wL);
    var wR = new THREE.Mesh(wingGeo, wingMat); wR.position.set( 0.30, 0.04, 0); g.add(wR);
    g._wL = wL; g._wR = wR;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.10), bodyMat);
    head.position.set(0, 0.04, -0.20); g.add(head);
    return g;
  }

  function _newBird() {
    var palette = [0x111111, 0x222230, 0x554433, 0x999999, 0x4a3a28];
    var c = palette[Math.floor(Math.random() * palette.length)];
    var m = _makeBird(c);
    var ang = Math.random() * Math.PI * 2;
    var r = 60 + Math.random() * 80;
    m.position.set(Math.cos(ang) * r, 22 + Math.random() * 18, Math.sin(ang) * r);
    var hv = 6 + Math.random() * 4;
    return {
      mesh: m,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * hv,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * hv
      ),
      flapPhase: Math.random() * Math.PI * 2,
      flapSpeed: 16 + Math.random() * 10,
      panic: 0,
      baseY: m.position.y,
      _alive: true,
    };
  }

  function spawnFlock(n) {
    if (!_scene) return;
    n = n || 12;
    for (var i = 0; i < n; i++) {
      var b = _newBird();
      _scene.add(b.mesh);
      _birds.push(b);
    }
  }

  function init(scene) {
    _scene = scene;
    clear();
    spawnFlock(14);
  }

  function clear() {
    if (_scene) {
      for (var i = 0; i < _birds.length; i++) {
        try { _scene.remove(_birds[i].mesh); } catch (e) {}
      }
    }
    _birds.length = 0;
    _t = 0;
  }

  function scareNear(pos, radius) {
    if (!pos) return;
    var r2 = (radius || 30) * (radius || 30);
    var cawed = false;
    for (var i = 0; i < _birds.length; i++) {
      var b = _birds[i];
      var dx = b.mesh.position.x - pos.x;
      var dz = b.mesh.position.z - pos.z;
      var d2 = dx * dx + dz * dz;
      if (d2 < r2) {
        b.panic = Math.max(b.panic, 1.0 + Math.random() * 0.8);
        // Repulsion + upward escape
        var d = Math.sqrt(d2) || 0.1;
        b.vel.x += (dx / d) * (10 + Math.random() * 6);
        b.vel.z += (dz / d) * (10 + Math.random() * 6);
        b.vel.y += 4 + Math.random() * 5;
        b.flapSpeed = 36 + Math.random() * 18;
        cawed = true;
      }
    }
    if (cawed) {
      try {
        if (window.AudioSystem && window.AudioSystem.playBirdCaw) {
          window.AudioSystem.playBirdCaw();
        }
      } catch (e) {}
    }
  }

  function update(dt) {
    if (!_scene || !_birds.length) return;
    _t += dt;
    var camPos = null;
    try {
      if (window.GameManager && window.GameManager.getCamera) {
        var c = window.GameManager.getCamera();
        if (c) camPos = c.position;
      }
    } catch (e) {}

    for (var i = 0; i < _birds.length; i++) {
      var b = _birds[i];
      // Flap
      b.flapPhase += dt * b.flapSpeed;
      var flap = Math.sin(b.flapPhase) * 0.7;
      b.mesh._wL.rotation.z =  flap;
      b.mesh._wR.rotation.z = -flap;
      // Panic decays back to lazy circling
      b.panic = Math.max(0, b.panic - dt * 0.6);
      if (b.panic <= 0) {
        b.flapSpeed = Math.max(14, b.flapSpeed - dt * 12);
        // Lazy tendency: return to baseY
        b.vel.y += (b.baseY - b.mesh.position.y) * dt * 0.15;
        // Apply gentle steering toward circular motion
        var tgtAng = _t * 0.05 + i;
        var tx = Math.cos(tgtAng) * 70;
        var tz = Math.sin(tgtAng) * 70;
        b.vel.x += (tx - b.mesh.position.x) * dt * 0.005;
        b.vel.z += (tz - b.mesh.position.z) * dt * 0.005;
        // Speed cap
        var sp = b.vel.length();
        if (sp > 9) b.vel.multiplyScalar(9 / sp);
      } else {
        // Panic: high speed, no cap
        var spP = b.vel.length();
        if (spP > 22) b.vel.multiplyScalar(22 / spP);
      }
      // Apply velocity
      b.mesh.position.x += b.vel.x * dt;
      b.mesh.position.y += b.vel.y * dt;
      b.mesh.position.z += b.vel.z * dt;
      // Floor & ceiling clamp
      if (b.mesh.position.y < 14) { b.mesh.position.y = 14; b.vel.y = Math.abs(b.vel.y); }
      if (b.mesh.position.y > 60) { b.mesh.position.y = 60; b.vel.y = -Math.abs(b.vel.y) * 0.5; }
      // Yaw mesh toward velocity
      if (Math.abs(b.vel.x) + Math.abs(b.vel.z) > 0.1) {
        b.mesh.rotation.y = Math.atan2(b.vel.x, b.vel.z);
      }
      // Recycle far birds back near camera
      if (camPos) {
        var ddx = b.mesh.position.x - camPos.x;
        var ddz = b.mesh.position.z - camPos.z;
        if (ddx * ddx + ddz * ddz > 200 * 200) {
          var ang2 = Math.random() * Math.PI * 2;
          var rr = 70 + Math.random() * 30;
          b.mesh.position.set(camPos.x + Math.cos(ang2) * rr, 22 + Math.random() * 16, camPos.z + Math.sin(ang2) * rr);
          b.vel.set((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
          b.panic = 0;
        }
      }
    }
  }

  return { init: init, update: update, clear: clear, scareNear: scareNear, spawnFlock: spawnFlock };
})();
