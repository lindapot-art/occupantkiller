/* ───────────────────────────────────────────────────────────────────────
   DRONE CONTROL SYSTEM — recon, FPV attack, bomb, surveillance drones
   ─────────────────────────────────────────────────────────────────────── */
const DroneSystem = (function () {
  'use strict';

  /* ── Drone Types ─────────────────────────────────────────────────── */
  // Reusable temp vectors for possessed drone update (avoids per-frame alloc)
  var _dTmpFwd = new THREE.Vector3();
  var _dTmpRight = new THREE.Vector3();

  const DRONE_TYPE = Object.freeze({
    RECON:        'recon',
    FPV_ATTACK:   'fpv_attack',
    BOMB:         'bomb',
    SURVEILLANCE: 'surveillance',
    ENEMY_BOMBER: 'enemy_bomber',
    ENEMY_FPV:    'enemy_fpv',
  });

  const DRONE_STATS = {
    recon:         { speed: 12, health: 30,  battery: 120, damage: 0,   range: 80 },
    fpv_attack:    { speed: 18, health: 15,  battery: 45,  damage: 80,  range: 50 },
    bomb:          { speed: 8,  health: 40,  battery: 90,  damage: 200, range: 60 },
    surveillance:  { speed: 6,  health: 50,  battery: 300, damage: 0,   range: 100 },
    enemy_bomber:  { speed: 7,  health: 35,  battery: 80,  damage: 150, range: 50 },
    enemy_fpv:     { speed: 22, health: 10,  battery: 30,  damage: 100, range: 40 },
  };

  /* ── Faction helpers ────────────────────────────────────────────── */
  function factionForType(type) {
    if (type === DRONE_TYPE.ENEMY_BOMBER || type === DRONE_TYPE.ENEMY_FPV) return 'russian';
    return 'ukrainian';
  }

  /* ── State ───────────────────────────────────────────────────────── */
  const drones = [];
  let _scene = null;
  let _camera = null;
  let nextId = 1;
  let _possessedDrone = null;
  var _explosionIntervals = [];

  /* ── Create Drone Mesh ───────────────────────────────────────────── */
  function addRussianFlag(group) {
    const stripeGeo = new THREE.BoxGeometry(0.3, 0.02, 0.05);
    const white = new THREE.Mesh(stripeGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    white.position.set(0, 0.095, -0.05);
    group.add(white);
    const blue = new THREE.Mesh(stripeGeo.clone(), new THREE.MeshLambertMaterial({ color: 0x0039A6 }));
    blue.position.set(0, 0.095, 0);
    group.add(blue);
    const red = new THREE.Mesh(stripeGeo.clone(), new THREE.MeshLambertMaterial({ color: 0xD52B1E }));
    red.position.set(0, 0.095, 0.05);
    group.add(red);
  }

  function buildDroneMesh(type) {
    const group = new THREE.Group();
    const stats = DRONE_STATS[type];
    const faction = factionForType(type);

    // Body color by faction and type
    let bodyColor;
    if (faction === 'russian') {
      bodyColor = type === DRONE_TYPE.ENEMY_BOMBER ? 0x3a3a2a : 0x8B0000;
    } else {
      bodyColor = 0x0057B8; // Ukrainian blue for all friendly drones
    }

    const bodyGeo = new THREE.BoxGeometry(0.5, 0.15, 0.5);
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Russian flag stripe on enemy drones
    if (faction === 'russian') {
      addRussianFlag(group);
    }

    // 4 Arms + rotors
    const armPositions = [
      [-0.35, 0.05, -0.35], [0.35, 0.05, -0.35],
      [-0.35, 0.05,  0.35], [0.35, 0.05,  0.35]
    ];
    for (const pos of armPositions) {
      // Arm
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        new THREE.MeshLambertMaterial({ color: 0x222222 })
      );
      arm.position.set(...pos);
      group.add(arm);

      // Rotor disc
      const rotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.02, 8),
        new THREE.MeshBasicMaterial({ color: 0xAABBCC, transparent: true, opacity: 0.4 })
      );
      rotor.position.set(pos[0], pos[1] + 0.06, pos[2]);
      rotor.userData.isRotor = true;
      group.add(rotor);
    }

    // Camera lens (front)
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x001122 })
    );
    lens.position.set(0, -0.05, -0.28);
    group.add(lens);

    // Payload indicator for bomb drone
    if (type === DRONE_TYPE.BOMB) {
      const payload = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.06, 0.2, 8),
        new THREE.MeshLambertMaterial({ color: 0x666622 })
      );
      payload.position.set(0, -0.15, 0);
      payload.userData.isPayload = true;
      group.add(payload);
    }

    group.castShadow = true;
    return group;
  }

  /* ── Init ────────────────────────────────────────────────────────── */
  function init(scene, camera) {
    _scene = scene;
    _camera = camera;
    drones.length = 0;
    nextId = 1;
    _possessedDrone = null;
  }

  /* ── Spawn Drone ─────────────────────────────────────────────────── */
  function spawn(x, y, z, type) {
    type = type || DRONE_TYPE.RECON;
    const stats = DRONE_STATS[type];
    const drone = {
      id: nextId++,
      type,
      faction: factionForType(type),
      position: new THREE.Vector3(x, y, z),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
      health:   stats.health,
      battery:  stats.battery,
      maxBattery: stats.battery,
      speed:    stats.speed,
      damage:   stats.damage,
      range:    stats.range,
      mesh:     null,
      alive:    true,
      active:   true,  // powered on
      hasPayload: type === DRONE_TYPE.BOMB || type === DRONE_TYPE.ENEMY_BOMBER,

      // AI patrol (for surveillance drones)
      patrolPoints: [],
      patrolIdx: 0,
      aiControlled: false,

      // Marks (recon)
      marks: [],
    };

    drone.mesh = buildDroneMesh(type);
    drone.mesh.position.copy(drone.position);
    drone.mesh.userData.droneId = drone.id;

    if (_scene) _scene.add(drone.mesh);
    drones.push(drone);
    return drone;
  }

  /* ── Possess / Release Drone ─────────────────────────────────────── */
  function possess(droneId) {
    const drone = drones.find(d => d.id === droneId && d.alive && d.active);
    if (!drone) return false;
    _possessedDrone = drone;
    drone.aiControlled = false;
    if (typeof CameraSystem !== 'undefined') {
      CameraSystem.setMode(CameraSystem.MODE.DRONE);
      CameraSystem.setDroneTarget(drone.mesh);
    }
    return true;
  }

  function release() {
    if (_possessedDrone) {
      _possessedDrone = null;
      if (typeof CameraSystem !== 'undefined') CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    }
  }

  function getPossessed() { return _possessedDrone; }
  function isPossessing() { return _possessedDrone !== null; }

  /* ── Drone Input (when possessed) ────────────────────────────────── */
  const _droneKeys = { w: false, a: false, s: false, d: false, up: false, down: false };

  function setDroneKey(key, pressed) {
    if (key in _droneKeys) _droneKeys[key] = pressed;
  }

  /* ── Enemy Drone AI ───────────────────────────────────────────────── */
  function updateEnemyDrone(drone, delta) {
    // Get player position from GameManager
    var gm = (typeof GameManager !== 'undefined') ? GameManager : null;
    var _p = gm && gm.getPlayer ? gm.getPlayer() : null;
    var playerPos = _p && _p.position ? _p.position : new THREE.Vector3(0, 5, 0);

    var dx = playerPos.x - drone.position.x;
    var dz = playerPos.z - drone.position.z;
    var distXZ = Math.sqrt(dx * dx + dz * dz);

    if (drone.type === DRONE_TYPE.ENEMY_BOMBER) {
      // Bomber: circle at altitude 18, drop bombs when close
      var targetAlt = 18;
      var altDiff = targetAlt - drone.position.y;
      drone.velocity.y = altDiff * 2;

      if (distXZ > 8) {
        // Move toward player
        var nx = dx / distXZ;
        var nz = dz / distXZ;
        drone.velocity.x = nx * drone.speed * 0.6;
        drone.velocity.z = nz * drone.speed * 0.6;
      } else {
        // Circle around player
        drone._circleAngle = (drone._circleAngle || Math.atan2(dz, dx)) + delta * 1.5;
        var angle = drone._circleAngle;
        drone.velocity.x = Math.cos(angle) * drone.speed * 0.4;
        drone.velocity.z = Math.sin(angle) * drone.speed * 0.4;

        // Drop bomb every 4 seconds
        if (!drone._bombTimer) drone._bombTimer = 4;
        drone._bombTimer -= delta;
        if (drone._bombTimer <= 0 && distXZ < 12) {
          drone._bombTimer = 4;
          // Create explosion at ground below drone
          var bombX = drone.position.x;
          var bombZ = drone.position.z;
          var bombY = (typeof VoxelWorld !== 'undefined') ? VoxelWorld.getTerrainHeight(bombX, bombZ) : 0;
          if (typeof Enemies !== 'undefined' && Enemies.damageInRadius) {
            // Damage player via GameManager
            var bombPos = new THREE.Vector3(bombX, bombY, bombZ);
            var distToPlayer = bombPos.distanceTo(playerPos);
            if (distToPlayer < 6 && gm) {
              var dmg = Math.max(1, Math.floor(drone.damage * (1 - distToPlayer / 6)));
              var p = gm.getPlayer();
              if (p) p.hp -= dmg;
            }
          }
          // Terrain destruction
          if (typeof VoxelWorld !== 'undefined' && VoxelWorld.setBlock) {
            for (var rx = -2; rx <= 2; rx++) {
              for (var rz = -2; rz <= 2; rz++) {
                VoxelWorld.setBlock(Math.floor(bombX) + rx, Math.floor(bombY), Math.floor(bombZ) + rz, 0);
              }
            }
          }
          // Visual: spawn smoke
          if (typeof Tracers !== 'undefined' && Tracers.spawnSmoke) {
            Tracers.spawnSmoke(new THREE.Vector3(bombX, bombY, bombZ));
          }
        }
      }
    } else if (drone.type === DRONE_TYPE.ENEMY_FPV) {
      // FPV kamikaze: dive directly at player at high speed
      var targetY = playerPos.y + 1;
      var dy = targetY - drone.position.y;
      var dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist3D > 2) {
        // Approach phase - dive toward player
        var speed = drone.speed;
        drone.velocity.x = (dx / dist3D) * speed;
        drone.velocity.y = (dy / dist3D) * speed;
        drone.velocity.z = (dz / dist3D) * speed;
      } else {
        // Impact! Explode and damage player
        if (gm) {
          var p = gm.getPlayer();
          if (p) p.hp -= drone.damage;
        }
        // Terrain destruction at impact
        var ix = Math.floor(drone.position.x);
        var iy = Math.floor(drone.position.y);
        var iz = Math.floor(drone.position.z);
        if (typeof VoxelWorld !== 'undefined' && VoxelWorld.setBlock) {
          for (var bx = -1; bx <= 1; bx++) {
            for (var bz = -1; bz <= 1; bz++) {
              VoxelWorld.setBlock(ix + bx, iy, iz + bz, 0);
            }
          }
        }
        if (typeof Tracers !== 'undefined' && Tracers.spawnSmoke) {
          Tracers.spawnSmoke(drone.position.clone());
        }
        destroyDrone(drone);
        return;
      }
    }

    // Face movement direction
    if (drone.velocity.length() > 0.1) {
      drone.rotation.y = Math.atan2(drone.velocity.x, drone.velocity.z);
    }
  }

  /* ── Spawn Enemy Drone (convenience) ────────────────────────────── */
  function spawnEnemyDrone(x, y, z, type) {
    type = type || DRONE_TYPE.ENEMY_BOMBER;
    var d = spawn(x, y, z, type);
    d.aiControlled = true; // Enable AI processing
    return d;
  }

  /* ── Update All Drones ───────────────────────────────────────────── */
  var _droneMotorActive = false;
  function update(delta) {
    var nearestDroneDist = Infinity;
    for (const drone of drones) {
      if (!drone.alive || !drone.active) continue;

      // Battery drain (only when actively flying/possessed; idle friendly drones recharge)
      if (drone === _possessedDrone || drone.aiControlled || drone.faction === 'russian') {
        drone.battery -= delta * 0.5;
        if (drone.battery <= 0) {
          drone.active = false;
          // Drone falls
          drone.velocity.y = -5;
        }
      } else if (drone.faction === 'ukrainian' && drone.battery < drone.maxBattery) {
        // Idle friendly drones auto-recharge
        drone.battery = Math.min(drone.maxBattery, drone.battery + delta * 1.0);
      }

      if (drone === _possessedDrone) {
        updatePossessedDrone(drone, delta);
      } else if (drone.aiControlled) {
        updateAIDrone(drone, delta);
      } else if (drone.faction === 'russian') {
        updateEnemyDrone(drone, delta);
      }

      // Apply velocity
      drone.position.addScaledVector(drone.velocity, delta);

      // Ground collision
      const terrainH = (typeof VoxelWorld !== 'undefined' ? VoxelWorld.getTerrainHeight(drone.position.x, drone.position.z) : 0) + 1;
      if (drone.position.y < terrainH) {
        drone.position.y = terrainH;
        if (!drone.active) {
          destroyDrone(drone);
          continue;
        }
      }

      // Update mesh
      drone.mesh.position.copy(drone.position);

      // Rotor animation
      drone.mesh.children.forEach(child => {
        if (child.userData.isRotor) {
          child.rotation.y += delta * 30;
        }
      });

      // Track nearest drone distance for motor sound
      if (typeof CameraSystem !== 'undefined') {
        var cam = CameraSystem.getCamera ? CameraSystem.getCamera() : null;
        if (cam) {
          var dd = drone.position.distanceTo(cam.position);
          if (dd < nearestDroneDist) nearestDroneDist = dd;
        }
      }
    }

    // Drone motor sound — start/update/stop based on nearest drone
    if (typeof AudioSystem !== 'undefined') {
      if (nearestDroneDist < 40) {
        if (!_droneMotorActive) { AudioSystem.startDroneMotor(); _droneMotorActive = true; }
        AudioSystem.updateDroneMotor(nearestDroneDist);
      } else if (_droneMotorActive) {
        AudioSystem.stopDroneMotor();
        _droneMotorActive = false;
      }
    }
  }

  function updatePossessedDrone(drone, delta) {
    const yaw = (typeof CameraSystem !== 'undefined') ? CameraSystem.getYaw() : 0;
    const pitch = (typeof CameraSystem !== 'undefined') ? CameraSystem.getPitch() : 0;

    // Movement in drone's local space
    _dTmpFwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    _dTmpRight.set(Math.cos(yaw), 0, -Math.sin(yaw));

    drone.velocity.set(0, 0, 0);

    if (_droneKeys.w) drone.velocity.addScaledVector(_dTmpFwd, drone.speed);
    if (_droneKeys.s) drone.velocity.addScaledVector(_dTmpFwd, -drone.speed);
    if (_droneKeys.a) drone.velocity.addScaledVector(_dTmpRight, -drone.speed);
    if (_droneKeys.d) drone.velocity.addScaledVector(_dTmpRight, drone.speed);
    if (_droneKeys.up) drone.velocity.y = drone.speed * 0.6;
    if (_droneKeys.down) drone.velocity.y = -drone.speed * 0.6;

    // Tilt based on velocity
    drone.mesh.rotation.set(
      drone.velocity.z * 0.02,
      yaw,
      -drone.velocity.x * 0.02
    );
  }

  function updateAIDrone(drone, delta) {
    if (drone.patrolPoints.length === 0) return;

    const target = drone.patrolPoints[drone.patrolIdx];
    _dTmpFwd.copy(target).sub(drone.position);
    const dist = _dTmpFwd.length();

    if (dist < 2) {
      drone.patrolIdx = (drone.patrolIdx + 1) % drone.patrolPoints.length;
      return;
    }

    _dTmpFwd.normalize().multiplyScalar(drone.speed * 0.5);
    drone.velocity.copy(_dTmpFwd);
    drone.mesh.rotation.y = Math.atan2(_dTmpFwd.x, _dTmpFwd.z);
  }

  /* ── Drone Actions ───────────────────────────────────────────────── */
  function markTarget(droneId, worldPos) {
    const drone = drones.find(d => d.id === droneId);
    if (!drone || drone.type !== DRONE_TYPE.RECON) return false;
    drone.marks.push(worldPos.clone());
    return true;
  }

  function dropPayload(droneId) {
    const drone = drones.find(d => d.id === droneId);
    if (!drone || !drone.hasPayload) return false;
    drone.hasPayload = false;
    // Remove payload mesh
    drone.mesh.children.forEach(child => {
      if (child.userData.isPayload) child.visible = false;
    });
    // Create explosion at drop point
    const dropPos = drone.position.clone();
    dropPos.y -= 1; // Drop below drone
    if (typeof Enemies !== 'undefined') {
      Enemies.damageInRadius(dropPos, 5, drone.damage);
    }
    createDroneExplosion(dropPos);
    if (typeof AudioSystem !== 'undefined') AudioSystem.playGunshot('launcher');
    return { position: dropPos, damage: drone.damage };
  }

  function fireAttack(droneId) {
    const drone = drones.find(d => d.id === droneId);
    if (!drone || drone.type !== DRONE_TYPE.FPV_ATTACK) return false;
    // FPV kamikaze: damage enemies at drone position, destroy drone
    if (typeof Enemies !== 'undefined') {
      Enemies.damageInRadius(drone.position, 3, drone.damage);
    }
    createDroneExplosion(drone.position.clone());
    if (typeof AudioSystem !== 'undefined') AudioSystem.playGunshot('launcher');
    destroyDrone(drone);
    return true;
  }

  function createDroneExplosion(pos) {
    if (!_scene) return;
    const flashGeo = new THREE.SphereGeometry(2, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos);
    _scene.add(flash);
    let t = 0.3;
    const fadeInterval = setInterval(function () {
      t -= 0.016;
      flash.material.opacity = Math.max(0, t / 0.3) * 0.9;
      flash.scale.setScalar(1 + (0.3 - t) * 4);
      if (t <= 0) {
        if (_scene) _scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
        clearInterval(fadeInterval);
        var idx = _explosionIntervals.indexOf(fadeInterval);
        if (idx >= 0) _explosionIntervals.splice(idx, 1);
      }
    }, 16);
    _explosionIntervals.push(fadeInterval);
  }

  function setPatrol(droneId, points) {
    const drone = drones.find(d => d.id === droneId);
    if (!drone) return false;
    drone.patrolPoints = points;
    drone.patrolIdx = 0;
    drone.aiControlled = true;
    return true;
  }

  /* ── Damage / Destroy ────────────────────────────────────────────── */
  function damageDrone(droneId, amount) {
    const drone = drones.find(d => d.id === droneId);
    if (!drone || !drone.alive) return;
    drone.health -= amount;
    if (drone.health <= 0) destroyDrone(drone);
  }

  function destroyDrone(drone) {
    drone.alive = false;
    drone.active = false;
    if (drone === _possessedDrone) release();
    if (drone.mesh) {
      drone.mesh.traverse(function (child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      if (_scene) _scene.remove(drone.mesh);
    }
  }

  /* ── Queries ─────────────────────────────────────────────────────── */
  var _droneAliveCache = [];
  var _droneCacheFrame = -1;
  function _rebuildDroneCache() {
    var f = performance.now();
    if (f === _droneCacheFrame) return;
    _droneCacheFrame = f;
    _droneAliveCache.length = 0;
    for (var i = 0; i < drones.length; i++) {
      if (drones[i].alive) _droneAliveCache.push(drones[i]);
    }
  }
  function getAll()        { _rebuildDroneCache(); return _droneAliveCache; }
  function getActive()     { return drones.filter(d => d.alive && d.active); }
  function getById(id)     { return drones.find(d => d.id === id && d.alive); }
  function getByType(type) { return drones.filter(d => d.alive && d.type === type); }

  function clear() {
    // Clear any active explosion fade intervals
    for (var ei = 0; ei < _explosionIntervals.length; ei++) {
      clearInterval(_explosionIntervals[ei]);
    }
    _explosionIntervals.length = 0;
    for (const drone of drones) {
      if (drone.mesh) {
        drone.mesh.traverse(function (child) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        if (_scene) _scene.remove(drone.mesh);
      }
    }
    drones.length = 0;
    _possessedDrone = null;
  }

  /* ── Drone Swarm ─────────────────────────────────────────────────── */
  var _swarmActive = false;
  var _swarmDrones = [];

  function launchSwarm(count, target, scene) {
    count = Math.max(3, Math.min(5, count || 3));
    _swarmDrones = [];
    _swarmActive = true;
    for (var i = 0; i < count; i++) {
      var offsetX = (Math.random() - 0.5) * 6;
      var offsetZ = (Math.random() - 0.5) * 6;
      var spawnPos = target.clone().add(new THREE.Vector3(offsetX, 15 + Math.random() * 5, offsetZ));
      var d = spawn(spawnPos.x, spawnPos.y, spawnPos.z, DRONE_TYPE.FPV_ATTACK);
      d.aiControlled = true;
      d._swarmTarget = target.clone();
      d.patrolPoints = [target.clone()];
      d.patrolIdx = 0;
      _swarmDrones.push(d);
    }
    return _swarmDrones;
  }

  function isSwarmActive() {
    if (!_swarmActive) return false;
    var anyAlive = false;
    for (var i = 0; i < _swarmDrones.length; i++) {
      if (_swarmDrones[i].alive) { anyAlive = true; break; }
    }
    if (!anyAlive) _swarmActive = false;
    return _swarmActive;
  }

  /* ── Drone Camera Feed (PIP) ─────────────────────────────────────── */
  var _pipActive = false;
  var _pipDroneId = null;

  function activatePIP(droneId) {
    var d = drones.find(function (d) { return d.id === droneId && d.alive && d.active; });
    if (!d) return false;
    _pipActive = true;
    _pipDroneId = droneId;
    return true;
  }

  function deactivatePIP() {
    _pipActive = false;
    _pipDroneId = null;
  }

  function isPIPActive() { return _pipActive; }
  function getPIPDroneId() { return _pipDroneId; }

  /* ── Counter-Drone System ────────────────────────────────────────── */
  var _enemyDrones = [];

  function spawnEnemyDroneCD(pos, scene) {
    var type = Math.random() > 0.5 ? DRONE_TYPE.ENEMY_BOMBER : DRONE_TYPE.ENEMY_FPV;
    var d = spawn(pos.x, pos.y || 20, pos.z, type);
    d.aiControlled = true;
    _enemyDrones.push(d);
    return d;
  }

  function updateEnemyDrones(delta, playerPos) {
    for (var i = _enemyDrones.length - 1; i >= 0; i--) {
      var d = _enemyDrones[i];
      if (!d.alive) { _enemyDrones.splice(i, 1); continue; }
      // Enemy drone AI is already handled in main update via updateEnemyDrone
    }
  }

  function shootDownDrone(droneId) {
    var d = drones.find(function (d) { return d.id === droneId && d.alive; });
    if (!d) return false;
    destroyDrone(d);
    for (var i = _enemyDrones.length - 1; i >= 0; i--) {
      if (_enemyDrones[i].id === droneId) { _enemyDrones.splice(i, 1); break; }
    }
    return true;
  }

  function getEnemyDronesList() {
    return _enemyDrones.filter(function (d) { return d.alive; });
  }

  /* ── Drone Upgrades ──────────────────────────────────────────────── */
  var DRONE_UPGRADES = {
    extended_battery: { label: 'Extended Battery', effect: 'battery_mult', value: 1.5 },
    armor_plating:    { label: 'Armor Plating',    effect: 'hp_add',       value: 30 },
    thermal_camera:   { label: 'Thermal Camera',   effect: 'thermal',      value: true },
    speed_boost:      { label: 'Speed Boost',      effect: 'speed_mult',   value: 1.3 },
    emp_payload:      { label: 'EMP Payload',      effect: 'emp',          value: true },
  };

  var _droneUpgrades = {}; // droneId -> [upgradeId]

  function upgradeDrone(droneId, upgradeId) {
    var d = drones.find(function (d) { return d.id === droneId && d.alive; });
    if (!d) return false;
    var upg = DRONE_UPGRADES[upgradeId];
    if (!upg) return false;
    if (!_droneUpgrades[droneId]) _droneUpgrades[droneId] = [];
    if (_droneUpgrades[droneId].indexOf(upgradeId) !== -1) return false;
    _droneUpgrades[droneId].push(upgradeId);
    if (upg.effect === 'battery_mult') {
      d.maxBattery = Math.floor(d.maxBattery * upg.value);
      d.battery = Math.min(d.battery + d.maxBattery * 0.3, d.maxBattery);
    } else if (upg.effect === 'hp_add') {
      d.health += upg.value;
    } else if (upg.effect === 'speed_mult') {
      d.speed = Math.floor(d.speed * upg.value);
    } else if (upg.effect === 'thermal') {
      d._hasThermal = true;
    } else if (upg.effect === 'emp') {
      d._hasEMP = true;
    }
    return true;
  }

  function getDroneUpgrades(droneId) {
    return _droneUpgrades[droneId] ? _droneUpgrades[droneId].slice() : [];
  }

  return {
    DRONE_TYPE,
    DRONE_STATS,
    init,
    spawn,
    possess,
    release,
    getPossessed,
    isPossessing,
    setDroneKey,
    update,
    markTarget,
    dropPayload,
    fireAttack,
    setPatrol,
    damageDrone,
    destroyDrone,
    getAll,
    getActive,
    getById,
    getByType,
    getEnemyDrones: function() { return drones.filter(function(d) { return d.alive && d.faction === 'russian'; }); },
    getFriendlyDrones: function() { return drones.filter(function(d) { return d.alive && d.faction === 'ukrainian'; }); },
    spawnEnemyDrone,
    clear,
    // Drone Swarm
    launchSwarm: launchSwarm,
    isSwarmActive: isSwarmActive,
    // Drone Camera Feed (PIP)
    activatePIP: activatePIP,
    deactivatePIP: deactivatePIP,
    isPIPActive: isPIPActive,
    getPIPDroneId: getPIPDroneId,
    // Counter-Drone System
    spawnEnemyDroneCD: spawnEnemyDroneCD,
    updateEnemyDrones: updateEnemyDrones,
    shootDownDrone: shootDownDrone,
    getEnemyDronesList: getEnemyDronesList,
    // Drone Upgrades
    DRONE_UPGRADES: DRONE_UPGRADES,
    upgradeDrone: upgradeDrone,
    getDroneUpgrades: getDroneUpgrades,
  };
})();
