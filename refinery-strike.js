/* ───────────────────────────────────────────────────────────────────────
   REFINERY STRIKE — FPV kamikaze drone-only mission
   Player flies an FPV drone into Russian oil refinery targets.
   Wave clears when all primary targets destroyed.
   Depends on: THREE, DroneSystem, CameraSystem, HUD, VoxelWorld
   ─────────────────────────────────────────────────────────────────────── */
const RefineryStrike = (function () {
  'use strict';

  let _scene = null;
  let _active = false;
  let _targets = [];          // { mesh, group, x, y, z, hp, maxHp, alive, kind }
  let _initialDrone = null;
  let _onComplete = null;
  let _explosions = [];
  let _spawnPoint = null;     // { x, y, z }

  /* ── Build a refinery target (oil storage tank) ─────────────────── */
  function buildOilTank(x, y, z, scale) {
    var s = scale || 1.0;
    var g = new THREE.Group();
    // Cylindrical storage tank
    var tankGeo = new THREE.CylinderGeometry(4 * s, 4 * s, 6 * s, 16);
    var tankMat = new THREE.MeshLambertMaterial({ color: 0xb08040 });
    var tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.y = 3 * s;
    g.add(tank);
    // Top cap
    var capGeo = new THREE.CylinderGeometry(4.1 * s, 4.1 * s, 0.4 * s, 16);
    var capMat = new THREE.MeshLambertMaterial({ color: 0x886030 });
    var cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 6.2 * s;
    g.add(cap);
    // Pipes
    var pipeGeo = new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 5 * s, 6);
    var pipeMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    var p1 = new THREE.Mesh(pipeGeo, pipeMat);
    p1.position.set(4.2 * s, 2.5 * s, 0);
    p1.rotation.z = Math.PI * 0.5;
    g.add(p1);
    // Hazard stripe
    var stripeGeo = new THREE.RingGeometry(4.05 * s, 4.15 * s, 32);
    var stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, side: THREE.DoubleSide });
    var stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 4 * s;
    stripe.rotation.x = Math.PI * 0.5;
    g.add(stripe);
    g.position.set(x, y, z);
    return g;
  }

  function buildRefineryTower(x, y, z) {
    var g = new THREE.Group();
    // Distillation column
    var colGeo = new THREE.CylinderGeometry(1.2, 1.2, 14, 12);
    var colMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
    var col = new THREE.Mesh(colGeo, colMat);
    col.position.y = 7;
    g.add(col);
    // Top flare
    var flareGeo = new THREE.ConeGeometry(0.6, 1.5, 8);
    var flareMat = new THREE.MeshBasicMaterial({ color: 0xff6622 });
    var flare = new THREE.Mesh(flareGeo, flareMat);
    flare.position.y = 14.7;
    g.add(flare);
    // Side platform
    var platGeo = new THREE.BoxGeometry(3, 0.3, 3);
    var platMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    var plat = new THREE.Mesh(platGeo, platMat);
    plat.position.set(0, 9, 0);
    g.add(plat);
    g.position.set(x, y, z);
    return g;
  }

  /* ── Init / Setup level ─────────────────────────────────────────── */
  function init(scene) {
    _scene = scene;
  }

  /* Place targets, spawn FPV drone, possess it. */
  function startMission(opts) {
    if (!_scene) return false;
    opts = opts || {};
    clear();
    _active = true;
    _onComplete = opts.onComplete || null;

    var groundY = (typeof window !== 'undefined' && window.VoxelWorld && window.VoxelWorld.getTerrainHeight)
      ? window.VoxelWorld.getTerrainHeight(0, 0)
      : 0;

    // Drone launch pad: well behind/above terrain
    _spawnPoint = { x: 0, y: groundY + 12, z: 50 };

    // Target layout — refinery cluster centred at world origin
    var layout = [
      { x:  -18, z:  -10, scale: 1.4, hp: 250, kind: 'tank',   name: 'Oil Storage Tank A' },
      { x:    0, z:  -10, scale: 1.4, hp: 250, kind: 'tank',   name: 'Oil Storage Tank B' },
      { x:   18, z:  -10, scale: 1.4, hp: 250, kind: 'tank',   name: 'Oil Storage Tank C' },
      { x:  -10, z:   12, scale: 1.0, hp: 180, kind: 'tower',  name: 'Distillation Column 1' },
      { x:   10, z:   12, scale: 1.0, hp: 180, kind: 'tower',  name: 'Distillation Column 2' },
      { x:    0, z:   28, scale: 1.6, hp: 320, kind: 'tank',   name: 'Main Crude Reservoir' },
    ];

    for (var i = 0; i < layout.length; i++) {
      var L = layout[i];
      var ty = (typeof window !== 'undefined' && window.VoxelWorld && window.VoxelWorld.getTerrainHeight)
        ? window.VoxelWorld.getTerrainHeight(L.x, L.z)
        : 0;
      var grp = (L.kind === 'tank') ? buildOilTank(L.x, ty, L.z, L.scale) : buildRefineryTower(L.x, ty, L.z);
      _scene.add(grp);
      _targets.push({
        group: grp,
        x: L.x, y: ty, z: L.z,
        hp: L.hp, maxHp: L.hp,
        alive: true, kind: L.kind, name: L.name,
        scale: L.scale,
      });
    }

    // Spawn the FPV kamikaze drone at the launch pad and possess it
    if (typeof DroneSystem !== 'undefined' && DroneSystem.spawn && DroneSystem.possess) {
      // Use 'fpv_attack' so the drone has speed + damage AND survives multiple hits
      _initialDrone = DroneSystem.spawn(_spawnPoint.x, _spawnPoint.y, _spawnPoint.z, 'fpv_attack');
      if (_initialDrone) {
        DroneSystem.possess(_initialDrone.id);
        // Aim toward refinery
        _initialDrone.rotation.set(-0.15, Math.PI, 0, 'YXZ');
      }
    }

    // HUD
    if (typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup('🚁 FPV STRIKE — DESTROY THE OIL REFINERY', '#ff8844');
      setTimeout(function () {
        if (HUD.notifyPickup) HUD.notifyPickup('🎯 ' + _targets.length + ' TARGETS LOCKED', '#ffcc44');
      }, 1500);
      setTimeout(function () {
        if (HUD.notifyPickup) HUD.notifyPickup('⚠ NO RESPAWNS — REQUEST NEW DRONE WITH [B]', '#ff4444');
      }, 3000);
    }

    return true;
  }

  /* Damage the nearest target if drone is close on impact */
  function checkDroneImpact(drone) {
    if (!drone || !drone.alive) return;
    if (!_active) return;
    var bestIdx = -1;
    var bestDistSq = Infinity;
    for (var i = 0; i < _targets.length; i++) {
      var t = _targets[i];
      if (!t.alive) continue;
      var dx = drone.position.x - t.x;
      var dy = drone.position.y - (t.y + 3 * t.scale);
      var dz = drone.position.z - t.z;
      var dsq = dx * dx + dy * dy + dz * dz;
      var hitR = (4.5 * t.scale + 1.5);
      if (dsq < hitR * hitR && dsq < bestDistSq) {
        bestIdx = i;
        bestDistSq = dsq;
      }
    }
    if (bestIdx >= 0) {
      damageTarget(bestIdx, drone.damage || 120);
      // Kill the drone (kamikaze impact)
      drone.health = 0;
      drone.alive = false;
      spawnExplosion(drone.position.x, drone.position.y, drone.position.z, 1.5);
    }
  }

  function damageTarget(idx, amount) {
    var t = _targets[idx];
    if (!t || !t.alive) return;
    t.hp -= amount;
    if (t.hp <= 0) {
      t.alive = false;
      destroyTarget(idx);
    } else {
      // Smoke puff on hit (lightweight)
      spawnExplosion(t.x, t.y + 4 * t.scale, t.z, 0.6);
    }
  }

  function destroyTarget(idx) {
    var t = _targets[idx];
    if (!t) return;
    // Big fireball
    spawnExplosion(t.x, t.y + 4 * t.scale, t.z, 3.5);
    // Replace mesh with smoldering wreckage
    if (_scene && t.group) {
      t.group.traverse(function (c) {
        if (c.isMesh && c.material) {
          c.material = c.material.clone();
          c.material.color = new THREE.Color(0x222222);
          if (c.material.emissive) c.material.emissive = new THREE.Color(0x441100);
        }
      });
      // Sink into ground
      t.group.scale.y = 0.3;
      t.group.position.y -= 1;
    }
    if (typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup('💥 ' + t.name + ' DESTROYED', '#ff6622');
    }
    if (typeof Marketplace !== 'undefined' && Marketplace.addOKC) {
      Marketplace.addOKC(75);
    }
    // Mission complete?
    if (allDestroyed()) {
      onMissionSuccess();
    }
  }

  function allDestroyed() {
    for (var i = 0; i < _targets.length; i++) if (_targets[i].alive) return false;
    return true;
  }

  function onMissionSuccess() {
    if (!_active) return;
    _active = false;
    if (typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup('✅ REFINERY OBLITERATED — STAGE CLEAR', '#22ff55');
    }
    if (typeof _onComplete === 'function') {
      try { _onComplete(); } catch (_) {}
    }
  }

  /* ── Explosion effect (lightweight expanding sphere) ──────────── */
  function spawnExplosion(x, y, z, scale) {
    if (!_scene) return;
    var geo = new THREE.SphereGeometry(0.5, 12, 8);
    var mat = new THREE.MeshBasicMaterial({ color: 0xff8822, transparent: true, opacity: 0.9 });
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    _scene.add(m);
    _explosions.push({
      mesh: m, mat: mat,
      t: 0, life: 0.7,
      grow: scale * 6,
    });
  }

  function update(delta) {
    if (!_active && _explosions.length === 0) return;
    // Animate explosions
    for (var i = _explosions.length - 1; i >= 0; i--) {
      var e = _explosions[i];
      e.t += delta;
      var k = e.t / e.life;
      if (k >= 1) {
        if (_scene) _scene.remove(e.mesh);
        if (e.mesh.geometry) e.mesh.geometry.dispose();
        if (e.mat) e.mat.dispose();
        _explosions.splice(i, 1);
        continue;
      }
      var s = 1 + k * e.grow;
      e.mesh.scale.set(s, s, s);
      e.mat.opacity = 0.9 * (1 - k);
    }
    // Detect drone impact
    if (_active && typeof DroneSystem !== 'undefined' && DroneSystem.getPossessed) {
      var d = DroneSystem.getPossessed();
      if (d && d.alive) checkDroneImpact(d);
      // If drone lost, give the player a fresh one (reuse)
      if (d && !d.alive) {
        scheduleRespawn();
      } else if (!d && !_respawnPending) {
        scheduleRespawn();
      }
    }
  }

  var _respawnPending = false;
  function scheduleRespawn() {
    if (_respawnPending || !_active) return;
    _respawnPending = true;
    if (typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup('🔄 NEW DRONE INBOUND — 3s', '#ffcc44');
    }
    setTimeout(function () {
      _respawnPending = false;
      if (!_active) return;
      if (typeof DroneSystem === 'undefined' || !DroneSystem.spawn) return;
      var newDrone = DroneSystem.spawn(_spawnPoint.x, _spawnPoint.y, _spawnPoint.z, 'fpv_attack');
      if (newDrone && DroneSystem.possess) {
        DroneSystem.possess(newDrone.id);
        newDrone.rotation.set(-0.15, Math.PI, 0, 'YXZ');
      }
    }, 3000);
  }

  function isActive()    { return _active; }
  function getTargets()  { return _targets.slice(); }
  function getProgress() {
    if (_targets.length === 0) return { done: 0, total: 0 };
    var done = 0;
    for (var i = 0; i < _targets.length; i++) if (!_targets[i].alive) done++;
    return { done: done, total: _targets.length };
  }

  function clear() {
    _active = false;
    _onComplete = null;
    _respawnPending = false;
    if (_scene) {
      for (var i = 0; i < _targets.length; i++) {
        var t = _targets[i];
        if (t.group) {
          t.group.traverse(function (c) {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
              if (Array.isArray(c.material)) c.material.forEach(function (m) { m.dispose(); });
              else c.material.dispose();
            }
          });
          _scene.remove(t.group);
        }
      }
      for (var j = 0; j < _explosions.length; j++) {
        var e = _explosions[j];
        if (e.mesh) {
          if (e.mesh.geometry) e.mesh.geometry.dispose();
          if (e.mat) e.mat.dispose();
          _scene.remove(e.mesh);
        }
      }
    }
    _targets = [];
    _explosions = [];
    _initialDrone = null;
  }

  return {
    init, startMission, update, clear,
    isActive, getTargets, getProgress,
    checkDroneImpact,
  };
})();

if (typeof window !== 'undefined') window.RefineryStrike = RefineryStrike;
