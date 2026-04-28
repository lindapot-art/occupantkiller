// ============================================================
//  bradley.js — M2A3 Bradley IFV (drivable)
//
//  Real-world reference (M2A3 Bradley):
//    - Main gun: M242 Bushmaster 25mm chain gun (200 rpm cyclic,
//      dual-feed alternating HE-T M792 / APDS-T M791)
//    - Coax:    M240C 7.62mm machine gun (~700 rpm)
//    - ATGM:    BGM-71 TOW (2-tube launcher, right-side turret)
//    - Crew 3 + 6 dismounts, tracked, ~66 km/h
//
//  Controls (while driving):
//    WASD  = drive (W/S throttle, A/D steer)
//    Mouse = aim turret (yaw + pitch)
//    LMB   = M242 Bushmaster 25mm  (alt HE/AP)
//    RMB   = M240 coax 7.62mm
//    B     = enter / exit
//    V     = swap shoulder camera
//
//  Public API: init(scene,camera,controls), update(dt), clear(),
//              spawnAt(pos), enter(), exit(), isActive(), getHealth()
// ============================================================
window.Bradley = (function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  var _scene = null, _gameCam = null, _controls = null;
  var _bound = false;
  var _vehicle = null;          // { group, hull, turret, barrel, coax, towL, towR, vx, vz, yaw, hp }
  var _active = false;          // player is driving
  var _chaseCam = null;         // 3rd-person camera
  var _camYaw = 0, _camPitch = -0.18;
  var _turretYaw = 0, _turretPitch = 0;
  var _shoulderSide = 1;        // +1 right, -1 left
  // Fire timing
  var _bushCool = 0;            // 0.30s cyclic = 200 rpm
  var _coaxCool = 0;            // 0.085s = 700 rpm
  var _firingBush = false, _firingCoax = false;
  var _heAp = 0;                // alt 0=HE, 1=AP
  // Visual extras
  var _casings = [];
  var _projectiles = [];        // bushmaster shells (visible tracer + impact)
  // Input state
  var _key = { w: false, s: false, a: false, d: false };

  var BUSH_RPM_INTERVAL = 0.30;   // 200 rpm cyclic
  var COAX_RPM_INTERVAL = 0.085;  // ~700 rpm
  var BUSH_DMG_HE = 70, BUSH_AOE = 2.6;
  var BUSH_DMG_AP = 95;
  var COAX_DMG = 20;
  var DRIVE_ACCEL = 7.5, DRIVE_MAX = 14, DRIVE_FRICTION = 3.0;
  var TURN_RATE = 1.2; // rad/s at full input
  var BARREL_LEN = 2.6;

  // ── Mesh: procedural M2A3 ─────────────────────────────────
  function _build() {
    var g = new THREE.Group();

    // Hull — sloped armor body (olive drab)
    var hullMat = new THREE.MeshLambertMaterial({ color: 0x4a5530 });
    var hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6.5), hullMat);
    hull.position.y = 1.05;
    g.add(hull);
    // Front glacis (sloped plate)
    var glacis = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 1.6), hullMat);
    glacis.position.set(0, 1.05, -3.6);
    glacis.rotation.x = -0.55;
    g.add(glacis);
    // Rear ramp
    var ramp = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.4, 0.2), hullMat);
    ramp.position.set(0, 1.0, 3.3);
    g.add(ramp);
    // Side skirts (ERA blocks)
    var skirtMat = new THREE.MeshLambertMaterial({ color: 0x3a4528 });
    for (var sx = 0; sx < 2; sx++) {
      var x = sx === 0 ? -1.7 : 1.7;
      for (var b = 0; b < 5; b++) {
        var sk = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 1.05), skirtMat);
        sk.position.set(x, 0.85, -2.4 + b * 1.2);
        g.add(sk);
      }
    }
    // Tracks (left/right)
    var trackMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    for (var t = 0; t < 2; t++) {
      var tx = t === 0 ? -1.85 : 1.85;
      var trk = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 6.3), trackMat);
      trk.position.set(tx, 0.45, 0);
      g.add(trk);
      // Road wheels
      for (var w = 0; w < 6; w++) {
        var wh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12),
          new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
        );
        wh.rotation.z = Math.PI / 2;
        wh.position.set(tx, 0.45, -2.6 + w * 1.05);
        g.add(wh);
      }
    }

    // ── Turret group (yaws independently) ──
    var turret = new THREE.Group();
    turret.position.set(0, 1.85, -0.4);
    g.add(turret);

    var turMat = new THREE.MeshLambertMaterial({ color: 0x4a5530 });
    var turBox = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 2.4), turMat);
    turret.add(turBox);
    // Commander's hatch + cupola
    var cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.3, 12), turMat);
    cupola.position.set(0.5, 0.55, -0.2);
    turret.add(cupola);
    var hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 12), new THREE.MeshLambertMaterial({ color: 0x2a3318 }));
    hatch.position.set(0.5, 0.73, -0.2);
    turret.add(hatch);
    // Smoke grenade dischargers
    for (var sg = 0; sg < 4; sg++) {
      var d = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      d.position.set(-0.85 + sg * 0.18, 0.4, -1.05);
      d.rotation.x = -0.35;
      turret.add(d);
    }
    // ── M242 Bushmaster 25mm chain gun (barrel pivots in pitch) ──
    var gunMount = new THREE.Group();
    gunMount.position.set(0, 0.05, 0.6);
    turret.add(gunMount);

    var mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.6), turMat);
    mantlet.position.set(0, 0, 0);
    gunMount.add(mantlet);

    var barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.085, BARREL_LEN, 12),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, BARREL_LEN / 2 + 0.25);
    gunMount.add(barrel);
    // Muzzle brake (slotted)
    var brake = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 12), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    brake.rotation.x = Math.PI / 2;
    brake.position.set(0, 0.05, BARREL_LEN + 0.18);
    gunMount.add(brake);

    // ── M240C coax 7.62 (mounted on left of mantlet) ──
    var coax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 1.4, 10),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    coax.rotation.x = Math.PI / 2;
    coax.position.set(-0.35, 0.0, 0.95);
    gunMount.add(coax);

    // ── BGM-71 TOW launcher (2-tube box on right of turret) ──
    var towGroup = new THREE.Group();
    towGroup.position.set(1.0, 0.25, 0.0);
    turret.add(towGroup);
    var towHousing = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 1.4), new THREE.MeshLambertMaterial({ color: 0x3a4528 }));
    towGroup.add(towHousing);
    var towL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5, 10), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    towL.rotation.x = Math.PI / 2;
    towL.position.set(0, 0.12, 0.05);
    towGroup.add(towL);
    var towR = towL.clone();
    towR.position.y = -0.12;
    towGroup.add(towR);

    // Antenna whip
    var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 1.8, 6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    ant.position.set(-0.85, 0.95, -0.9);
    turret.add(ant);

    g.castShadow = false; g.receiveShadow = false;
    return { group: g, turret: turret, gunMount: gunMount, barrel: barrel, brake: brake };
  }

  function _spawnVehicle(pos) {
    var built = _build();
    built.group.position.copy(pos || new THREE.Vector3(0, 0, 0));
    _scene.add(built.group);
    _vehicle = {
      group: built.group, turret: built.turret, gunMount: built.gunMount,
      barrel: built.barrel, brake: built.brake,
      vx: 0, vz: 0, yaw: 0, hp: 1500, maxHp: 1500
    };
    return _vehicle;
  }

  function spawnAt(pos) {
    if (!_scene) return null;
    if (_vehicle) try { _scene.remove(_vehicle.group); } catch (e) {}
    return _spawnVehicle(pos);
  }

  function _ensureChaseCam() {
    if (_chaseCam) return _chaseCam;
    _chaseCam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1500);
    return _chaseCam;
  }

  function enter() {
    if (!_vehicle) {
      // Spawn a Bradley right in front of the player
      var px = _gameCam.position.x, pz = _gameCam.position.z;
      var py = 0;
      try { if (window.VoxelWorld && VoxelWorld.getTerrainHeight) py = VoxelWorld.getTerrainHeight(px, pz) || 0; } catch (e) {}
      _spawnVehicle(new THREE.Vector3(px, py, pz - 6));
    }
    _active = true;
    _camYaw = _vehicle.group.rotation.y;
    _camPitch = -0.22;
    _turretYaw = 0; _turretPitch = 0;
    _ensureChaseCam();
    try {
      if (window.GameManager) {
        window.GameManager.__bradleyCam = _chaseCam;
      }
    } catch (e) {}
    try { window.HUD && window.HUD.showToast && window.HUD.showToast('🚛 BRADLEY — LMB: 25mm Bushmaster | RMB: Coax 7.62 | WASD drive | B exit', 4000, '#88ff88'); } catch (e) {}
    try { window.AudioSystem && window.AudioSystem.playVehicleIdle && (_vehicle.idleHandle = window.AudioSystem.playVehicleIdle(800)); } catch (e) {}
  }

  function exit() {
    if (!_active) return;
    _active = false;
    try { if (_vehicle && _vehicle.idleHandle && _vehicle.idleHandle.stop) _vehicle.idleHandle.stop(); } catch (e) {}
    try { if (window.GameManager) window.GameManager.__bradleyCam = null; } catch (e) {}
    // Place player beside Bradley
    try {
      if (_vehicle && _gameCam) {
        var vp = _vehicle.group.position;
        _gameCam.position.set(vp.x + 3, vp.y + 1.7, vp.z);
      }
    } catch (e) {}
  }

  function isActive() { return _active; }
  function getHealth() { return _vehicle ? _vehicle.hp : 0; }
  function getVehicle() { return _vehicle; }

  // ── Damage hook (called by external systems) ──
  function takeDamage(amount) {
    if (!_vehicle) return;
    _vehicle.hp = Math.max(0, _vehicle.hp - amount);
    if (_vehicle.hp <= 0 && _active) {
      try { window.HUD && window.HUD.showToast && window.HUD.showToast('💥 BRADLEY DESTROYED', 3500, '#ff5555'); } catch (e) {}
      try {
        if (window.Tracers && window.Tracers.spawnExplosion) {
          window.Tracers.spawnExplosion(_vehicle.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 6.5);
        }
        if (window.AudioSystem && window.AudioSystem.playExplosion) window.AudioSystem.playExplosion(1.5, true);
      } catch (e) {}
      exit();
    }
  }

  // ── Firing ─────────────────────────────────────────────────
  function _muzzleWorld() {
    if (!_vehicle) return new THREE.Vector3();
    var v = new THREE.Vector3(0, 0, BARREL_LEN + 0.35);
    v.applyMatrix4(_vehicle.gunMount.matrixWorld);
    return v;
  }
  function _aimDirWorld() {
    if (!_vehicle) return new THREE.Vector3(0, 0, 1);
    var d = new THREE.Vector3(0, 0, 1);
    d.applyQuaternion(_vehicle.gunMount.getWorldQuaternion(new THREE.Quaternion()));
    return d.normalize();
  }

  function _fireBushmaster() {
    if (_bushCool > 0 || !_vehicle) return;
    _bushCool = BUSH_RPM_INTERVAL;
    var origin = _muzzleWorld();
    var dir = _aimDirWorld();
    var isHE = (_heAp++ % 2 === 0);
    var color = isHE ? 0xff8833 : 0xfff066;
    // Tracer
    try {
      if (window.Tracers && window.Tracers.spawnTracer) {
        window.Tracers.spawnTracer(origin.clone(), dir.clone(), color, 220);
      }
      if (window.Tracers && window.Tracers.spawnMuzzleFlash) {
        window.Tracers.spawnMuzzleFlash(origin.clone(), dir.clone());
      }
    } catch (e) {}
    // Hitscan to ~250m: damage nearest enemy in cone
    var hitPos = _hitscan(origin, dir, 220, isHE);
    // HE: AOE; AP: single
    if (hitPos) {
      try {
        if (isHE) {
          if (window.Tracers && window.Tracers.spawnExplosion) window.Tracers.spawnExplosion(hitPos, BUSH_AOE * 1.3);
          if (window.Enemies && window.Enemies.damageInRadius) window.Enemies.damageInRadius(hitPos, BUSH_AOE, BUSH_DMG_HE, 'EXPLOSIVE');
        }
      } catch (e) {}
    }
    // Audio
    try {
      if (window.AudioSystem && window.AudioSystem.playExplosion) window.AudioSystem.playExplosion(0.35, false);
    } catch (e) {}
    // Casing eject (right side of turret)
    _ejectCasing(true);
    // Recoil flick
    _vehicle.gunMount.rotation.x += 0.04;
  }

  function _fireCoax() {
    if (_coaxCool > 0 || !_vehicle) return;
    _coaxCool = COAX_RPM_INTERVAL;
    var origin = _muzzleWorld(); origin.x -= 0.2;
    var dir = _aimDirWorld();
    try {
      if (window.Tracers && window.Tracers.spawnTracer) {
        window.Tracers.spawnTracer(origin.clone(), dir.clone(), 0xffaa44, 260);
      }
    } catch (e) {}
    var hp = _hitscan(origin, dir, 200, false);
    if (hp && window.Enemies && window.Enemies.damageInRadius) {
      try { window.Enemies.damageInRadius(hp, 0.6, COAX_DMG, 'BULLET'); } catch (e) {}
    }
    _ejectCasing(false);
  }

  function _hitscan(origin, dir, maxDist, isHE) {
    if (!window.Enemies || !window.Enemies.getAll) return null;
    var all = window.Enemies.getAll();
    var best = null, bestT = 1e9, bestPos = null;
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (!e || e.dead || !e.mesh) continue;
      var to = e.mesh.position.clone().sub(origin);
      var t = to.dot(dir);
      if (t < 0 || t > maxDist) continue;
      var perp = to.sub(dir.clone().multiplyScalar(t)).length();
      if (perp > 1.4) continue; // ~enemy radius
      if (t < bestT) { bestT = t; best = e; bestPos = e.mesh.position.clone(); }
    }
    if (best) return bestPos;
    // Otherwise return point at maxDist (for AOE on dirt — skip)
    return null;
  }

  function _ejectCasing(isBush) {
    if (!_vehicle) return;
    var size = isBush ? 0.18 : 0.06;
    var len  = isBush ? 0.4 : 0.12;
    var col  = isBush ? 0xddaa55 : 0xc0985a;
    var c = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.4, size * 0.4, len, 6),
      new THREE.MeshLambertMaterial({ color: col })
    );
    var origin = new THREE.Vector3(0.4, 0.1, 0.5).applyMatrix4(_vehicle.turret.matrixWorld);
    c.position.copy(origin);
    var sideDir = new THREE.Vector3(1, 0, 0).applyQuaternion(_vehicle.turret.getWorldQuaternion(new THREE.Quaternion()));
    _scene.add(c);
    _casings.push({
      mesh: c,
      vx: sideDir.x * 4 + (Math.random() - 0.5),
      vy: 4 + Math.random() * 2,
      vz: sideDir.z * 4 + (Math.random() - 0.5),
      life: 1.5,
      spin: (Math.random() - 0.5) * 18
    });
  }

  // ── Main update tick ──────────────────────────────────────
  function update(dt) {
    if (_bushCool > 0) _bushCool -= dt;
    if (_coaxCool > 0) _coaxCool -= dt;

    // Casings physics
    for (var i = _casings.length - 1; i >= 0; i--) {
      var ca = _casings[i];
      ca.life -= dt;
      ca.vy -= 18 * dt;
      ca.mesh.position.x += ca.vx * dt;
      ca.mesh.position.y += ca.vy * dt;
      ca.mesh.position.z += ca.vz * dt;
      ca.mesh.rotation.x += ca.spin * dt;
      if (ca.mesh.position.y < 0.05) { ca.mesh.position.y = 0.05; ca.vy = 0; ca.vx *= 0.4; ca.vz *= 0.4; }
      if (ca.life <= 0) { _scene.remove(ca.mesh); _casings.splice(i, 1); }
    }

    if (!_active || !_vehicle) return;

    // Drive
    var fwdInput = (_key.w ? 1 : 0) - (_key.s ? 1 : 0);
    var turnInput = (_key.a ? 1 : 0) - (_key.d ? 1 : 0);
    _vehicle.yaw += turnInput * TURN_RATE * dt * (Math.abs(fwdInput) > 0.05 ? 1 : 0.5);
    _vehicle.group.rotation.y = _vehicle.yaw;
    var fx = -Math.sin(_vehicle.yaw), fz = -Math.cos(_vehicle.yaw);
    _vehicle.vx += fx * fwdInput * DRIVE_ACCEL * dt;
    _vehicle.vz += fz * fwdInput * DRIVE_ACCEL * dt;
    // Friction
    var spd = Math.sqrt(_vehicle.vx * _vehicle.vx + _vehicle.vz * _vehicle.vz);
    if (spd > DRIVE_MAX) {
      _vehicle.vx = _vehicle.vx / spd * DRIVE_MAX;
      _vehicle.vz = _vehicle.vz / spd * DRIVE_MAX;
    }
    var fric = DRIVE_FRICTION * dt;
    if (Math.abs(_vehicle.vx) > fric) _vehicle.vx -= Math.sign(_vehicle.vx) * fric; else _vehicle.vx = 0;
    if (Math.abs(_vehicle.vz) > fric) _vehicle.vz -= Math.sign(_vehicle.vz) * fric; else _vehicle.vz = 0;
    _vehicle.group.position.x += _vehicle.vx * dt;
    _vehicle.group.position.z += _vehicle.vz * dt;
    // Snap to terrain
    try {
      if (window.VoxelWorld && VoxelWorld.getTerrainHeight) {
        var th = VoxelWorld.getTerrainHeight(_vehicle.group.position.x, _vehicle.group.position.z);
        if (typeof th === 'number') _vehicle.group.position.y = th;
      }
    } catch (e) {}

    // Idle audio rpm
    try {
      if (_vehicle.idleHandle && _vehicle.idleHandle.setRpm) {
        var rpm = 700 + Math.min(1, spd / DRIVE_MAX) * 1400;
        _vehicle.idleHandle.setRpm(rpm);
      }
    } catch (e) {}

    // Turret aim from camYaw/camPitch (turret follows the chase camera)
    _turretYaw = _camYaw - _vehicle.yaw;
    _turretPitch = Math.max(-0.18, Math.min(0.4, _camPitch + 0.05));
    _vehicle.turret.rotation.y = _turretYaw;
    _vehicle.gunMount.rotation.x = -_turretPitch;

    // Auto-fire while held
    if (_firingBush) _fireBushmaster();
    if (_firingCoax) _fireCoax();

    // Chase camera
    var cam = _ensureChaseCam();
    var off = new THREE.Vector3(_shoulderSide * 1.3, 3.2, 7.0);
    var s = Math.sin(_camYaw), c = Math.cos(_camYaw);
    var camPos = new THREE.Vector3(
      _vehicle.group.position.x + off.x * c + off.z * s,
      _vehicle.group.position.y + off.y,
      _vehicle.group.position.z - off.x * s + off.z * c
    );
    cam.position.lerp(camPos, 0.25);
    var look = new THREE.Vector3(_vehicle.group.position.x, _vehicle.group.position.y + 1.6, _vehicle.group.position.z);
    cam.lookAt(look);
    cam.updateProjectionMatrix();
    // Sync first-person camera position so Enemies AI tracks the Bradley
    try {
      if (_gameCam) {
        _gameCam.position.set(_vehicle.group.position.x, _vehicle.group.position.y + 1.5, _vehicle.group.position.z);
      }
    } catch (e) {}

    // Recoil restore (gunMount pitch eased back)
    if (_vehicle.gunMount.rotation.x > -_turretPitch) {
      _vehicle.gunMount.rotation.x -= dt * 1.2;
    }
  }

  function clear() {
    if (_vehicle) try { _scene.remove(_vehicle.group); } catch (e) {}
    _vehicle = null; _active = false;
    for (var i = 0; i < _casings.length; i++) try { _scene.remove(_casings[i].mesh); } catch (e) {}
    _casings.length = 0;
    try { if (window.GameManager) window.GameManager.__bradleyCam = null; } catch (e) {}
  }

  // ── Input ──────────────────────────────────────────────────
  function _onKeyDown(ev) {
    if (ev.code === 'KeyB' && !ev.repeat) {
      if (_active) exit(); else enter();
      return;
    }
    if (!_active) return;
    if (ev.code === 'KeyW') _key.w = true;
    else if (ev.code === 'KeyS') _key.s = true;
    else if (ev.code === 'KeyA') _key.a = true;
    else if (ev.code === 'KeyD') _key.d = true;
    else if (ev.code === 'KeyV' && !ev.repeat) _shoulderSide = -_shoulderSide;
    else if (ev.code === 'Escape') exit();
  }
  function _onKeyUp(ev) {
    if (ev.code === 'KeyW') _key.w = false;
    else if (ev.code === 'KeyS') _key.s = false;
    else if (ev.code === 'KeyA') _key.a = false;
    else if (ev.code === 'KeyD') _key.d = false;
  }
  function _onMouseMove(ev) {
    if (!_active) return;
    var dx = ev.movementX || 0, dy = ev.movementY || 0;
    _camYaw -= dx * 0.0022;
    _camPitch -= dy * 0.0018;
    if (_camPitch < -0.55) _camPitch = -0.55;
    if (_camPitch > 0.45) _camPitch = 0.45;
  }
  function _onMouseDown(ev) {
    if (!_active) { return; }
    if (ev.button === 0) _firingBush = true;
    else if (ev.button === 2) _firingCoax = true;
  }
  function _onMouseUp(ev) {
    if (ev.button === 0) _firingBush = false;
    else if (ev.button === 2) _firingCoax = false;
  }

  function _bind() {
    if (_bound) return;
    _bound = true;
    window.addEventListener('keydown', _onKeyDown);
    window.addEventListener('keyup', _onKeyUp);
    window.addEventListener('mousemove', _onMouseMove);
    window.addEventListener('mousedown', _onMouseDown);
    window.addEventListener('mouseup', _onMouseUp);
    window.addEventListener('contextmenu', function (e) { if (_active) e.preventDefault(); });
  }

  function init(scene, camera, controls) {
    _scene = scene; _gameCam = camera; _controls = controls;
    _vehicle = null; _active = false;
    _casings.length = 0; _projectiles.length = 0;
    _key.w = _key.s = _key.a = _key.d = false;
    _firingBush = _firingCoax = false;
    _bushCool = _coaxCool = 0;
    _bind();
  }

  return {
    init: init, update: update, clear: clear,
    spawnAt: spawnAt, enter: enter, exit: exit,
    isActive: isActive, getHealth: getHealth, getVehicle: getVehicle,
    takeDamage: takeDamage
  };
})();
