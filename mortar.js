// ============================================================
//  mortar.js — Deployable mortar with auto bird's-eye-view aim cam
//  - Player presses M to deploy / undeploy mortar at feet
//  - When deployed, camera switches to top-down birds-eye on a target marker
//  - Mouse moves marker; click fires mortar shell with arc + impact explosion
//  Public API: init(scene, camera, controls), update(dt), clear(), deploy(), undeploy(), isDeployed()
// ============================================================
window.Mortar = (function () {
  'use strict';

  let _scene = null;
  let _gameCam = null;     // original first-person camera
  let _controls = null;
  let _deployed = false;
  let _topCam = null;      // ortho top-down cam used while deployed
  let _marker = null;      // ground crosshair
  let _stationMesh = null; // mortar tube on ground
  let _shells = [];        // active shells in flight
  let _ammo = 8;
  let _cooldown = 0;
  var _COOL_TIME = 1.6;

  function _makeStation() {
    var g = new THREE.Group();
    var baseMat = new THREE.MeshLambertMaterial({ color: 0x223322 });
    var tubeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.18, 12), baseMat);
    base.position.y = 0.09; g.add(base);
    var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 12), tubeMat);
    tube.position.y = 0.9;
    tube.rotation.x = -0.4; // tilted up
    g.add(tube);
    var bipodMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    var bipod1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), bipodMat);
    bipod1.position.set( 0.30, 0.6, 0.30); bipod1.rotation.z = 0.3; g.add(bipod1);
    var bipod2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), bipodMat);
    bipod2.position.set(-0.30, 0.6, 0.30); bipod2.rotation.z = -0.3; g.add(bipod2);
    return g;
  }

  function _makeMarker() {
    var g = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.9, depthTest: false });
    var ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.6, 24), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);
    var inner = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 16), mat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.05;
    g.add(inner);
    g.renderOrder = 999;
    return g;
  }

  function init(scene, camera, controls) {
    _scene = scene;
    _gameCam = camera;
    _controls = controls;
    _deployed = false;
    _shells = [];
    _ammo = 8;
    _cooldown = 0;
  }

  function clear() {
    if (_deployed) undeploy();
    for (var i = 0; i < _shells.length; i++) {
      try { _scene.remove(_shells[i].mesh); } catch (e) {}
    }
    _shells.length = 0;
    _ammo = 8;
  }

  function isDeployed() { return _deployed; }
  function getAmmo() { return _ammo; }
  function addAmmo(n) { _ammo = Math.max(0, _ammo + (n | 0)); }

  function deploy() {
    if (_deployed || !_scene || !_gameCam) return false;
    if (_ammo <= 0) {
      try { window.HUD && window.HUD.showToast && window.HUD.showToast('No mortar ammo', 1500, '#ff8888'); } catch (e) {}
      return false;
    }
    _deployed = true;
    // Place station at player position
    if (!_stationMesh) _stationMesh = _makeStation();
    var px = _gameCam.position.x;
    var pz = _gameCam.position.z;
    var py = 0;
    try {
      if (window.VoxelWorld && window.VoxelWorld.getTerrainHeight) {
        py = window.VoxelWorld.getTerrainHeight(px, pz) || 0;
      }
    } catch (e) {}
    _stationMesh.position.set(px, py, pz);
    _scene.add(_stationMesh);
    // Bird's-eye orthographic camera
    if (!_topCam) {
      _topCam = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 500);
    }
    _topCam.position.set(px, py + 80, pz);
    _topCam.lookAt(px, py, pz);
    _topCam.updateProjectionMatrix();
    // Marker
    if (!_marker) _marker = _makeMarker();
    _marker.position.set(px + 20, py + 0.05, pz);
    _scene.add(_marker);
    // Push our cam onto GameManager
    try {
      if (window.GameManager && window.GameManager._setActiveCamera) {
        window.GameManager._setActiveCamera(_topCam);
      } else if (window.GameManager) {
        window.GameManager.__mortarCam = _topCam;
      }
    } catch (e) {}
    try { window.HUD && window.HUD.showToast && window.HUD.showToast('🎯 MORTAR DEPLOYED — click to fire (M to exit)', 2500, '#ffd500'); } catch (e) {}
    return true;
  }

  function undeploy() {
    if (!_deployed) return;
    _deployed = false;
    if (_stationMesh) try { _scene.remove(_stationMesh); } catch (e) {}
    if (_marker) try { _scene.remove(_marker); } catch (e) {}
    try {
      if (window.GameManager && window.GameManager._setActiveCamera) {
        window.GameManager._setActiveCamera(_gameCam);
      }
    } catch (e) {}
  }

  function _fireShell(targetX, targetZ) {
    if (_cooldown > 0 || _ammo <= 0 || !_stationMesh) return;
    _cooldown = _COOL_TIME;
    _ammo--;
    var startX = _stationMesh.position.x;
    var startY = _stationMesh.position.y + 1.5;
    var startZ = _stationMesh.position.z;
    var shellMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    var shellMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.55, 8), shellMat);
    shellMesh.position.set(startX, startY, startZ);
    _scene.add(shellMesh);
    // Arc: high lob, ~3-4 second flight depending on distance
    var dx = targetX - startX, dz = targetZ - startZ;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var flightT = Math.max(2.0, Math.min(5.0, dist / 18));
    var vx = dx / flightT;
    var vz = dz / flightT;
    var g = 18;
    // y = startY + vy*t - 0.5*g*t^2 ; want y(flightT) = targetY (~startY)
    var vy = 0.5 * g * flightT;
    _shells.push({ mesh: shellMesh, x: startX, y: startY, z: startZ, vx: vx, vy: vy, vz: vz, t: 0, total: flightT, tx: targetX, tz: targetZ });
    try {
      if (window.AudioSystem && window.AudioSystem.playMortarFire) window.AudioSystem.playMortarFire();
      else if (window.AudioSystem && window.AudioSystem.playExplosion) window.AudioSystem.playExplosion(0.4, true);
    } catch (e) {}
  }

  // Hook called externally on click while deployed (or by pointer move)
  function aimAt(worldPos) {
    if (!_deployed || !_marker) return;
    _marker.position.x = worldPos.x;
    _marker.position.z = worldPos.z;
  }
  function fire() {
    if (!_deployed || !_marker) return;
    _fireShell(_marker.position.x, _marker.position.z);
  }

  // Convert mouse coords to world XZ via top camera unproject
  function _mouseToWorld(ev) {
    if (!_topCam) return null;
    var rect = (window.GameManager && window.GameManager.getRenderer)
      ? window.GameManager.getRenderer().domElement.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    var mx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    var my = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    var v = new THREE.Vector3(mx, my, 0).unproject(_topCam);
    var py = _stationMesh ? _stationMesh.position.y : 0;
    return new THREE.Vector3(v.x, py, v.z);
  }

  function update(dt) {
    if (_cooldown > 0) _cooldown -= dt;
    // Top cam follow player (slow drift)
    if (_deployed && _topCam && _stationMesh) {
      _topCam.position.x = _stationMesh.position.x;
      _topCam.position.z = _stationMesh.position.z;
      _topCam.lookAt(_stationMesh.position.x, _stationMesh.position.y, _stationMesh.position.z);
    }
    // Step shells
    for (var i = _shells.length - 1; i >= 0; i--) {
      var s = _shells[i];
      s.t += dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.vy -= 18 * dt;
      s.y += s.vy * dt;
      s.mesh.position.set(s.x, s.y, s.z);
      // Tilt mesh forward
      s.mesh.rotation.x = Math.atan2(s.vy, Math.sqrt(s.vx * s.vx + s.vz * s.vz));
      if (s.t >= s.total || s.y <= 0.2) {
        // Impact
        try {
          if (window.Tracers && window.Tracers.spawnExplosion) {
            window.Tracers.spawnExplosion(new THREE.Vector3(s.tx, 0.5, s.tz), 4.5);
          }
          if (window.AudioSystem && window.AudioSystem.playExplosion) {
            window.AudioSystem.playExplosion(1.2, true);
          }
          // Damage enemies in radius
          if (window.Enemies && window.Enemies.damageInRadius) {
            window.Enemies.damageInRadius(new THREE.Vector3(s.tx, 0, s.tz), 8, 250, 'EXPLOSIVE');
          } else if (window.Enemies && window.Enemies.getEnemies) {
            var es = window.Enemies.getEnemies();
            for (var k = 0; k < es.length; k++) {
              var e = es[k];
              if (!e || !e.mesh) continue;
              var ddx = e.mesh.position.x - s.tx, ddz = e.mesh.position.z - s.tz;
              if (ddx * ddx + ddz * ddz < 64) {
                if (window.Enemies.damage) window.Enemies.damage(e, 250, false, 'EXPLOSIVE');
              }
            }
          }
        } catch (e) {}
        _scene.remove(s.mesh);
        _shells.splice(i, 1);
      }
    }
  }

  // Internal: hook pointermove + click while deployed
  function _onPointerMove(ev) {
    if (!_deployed) return;
    var p = _mouseToWorld(ev);
    if (p) aimAt(p);
  }
  function _onPointerDown(ev) {
    if (!_deployed) return;
    var p = _mouseToWorld(ev);
    if (p) { aimAt(p); fire(); }
  }
  function _onKey(ev) {
    if (ev.code === 'KeyM' && !ev.repeat) {
      if (_deployed) undeploy(); else deploy();
    } else if (ev.code === 'Escape' && _deployed) {
      undeploy();
    }
  }
  function _bindUI() {
    window.addEventListener('pointermove', _onPointerMove);
    window.addEventListener('pointerdown', _onPointerDown);
    window.addEventListener('keydown', _onKey);
  }
  // Auto-bind on first init call
  var _bound = false;
  var _origInit = init;
  init = function (scene, camera, controls) {
    _origInit(scene, camera, controls);
    if (!_bound) { _bound = true; _bindUI(); }
  };

  return {
    init: init, update: update, clear: clear,
    deploy: deploy, undeploy: undeploy, isDeployed: isDeployed,
    aimAt: aimAt, fire: fire,
    getAmmo: getAmmo, addAmmo: addAmmo,
  };
})();
