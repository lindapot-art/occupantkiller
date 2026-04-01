/* ───────────────────────────────────────────────────────────────────────
   DRONE CONTROL SYSTEM — recon, FPV attack, bomb, surveillance drones
   ─────────────────────────────────────────────────────────────────────── */
const DroneSystem = (function () {
  'use strict';

  /* ── Drone Types ─────────────────────────────────────────────────── */
  const DRONE_TYPE = Object.freeze({
    RECON:        'recon',
    FPV_ATTACK:   'fpv_attack',
    BOMB:         'bomb',
    SURVEILLANCE: 'surveillance',
  });

  const DRONE_STATS = {
    recon:        { speed: 12, health: 30,  battery: 120, damage: 0,   range: 80 },
    fpv_attack:   { speed: 18, health: 15,  battery: 45,  damage: 80,  range: 50 },
    bomb:         { speed: 8,  health: 40,  battery: 90,  damage: 200, range: 60 },
    surveillance: { speed: 6,  health: 50,  battery: 300, damage: 0,   range: 100 },
  };

  /* ── State ───────────────────────────────────────────────────────── */
  const drones = [];
  let _scene = null;
  let _camera = null;
  let nextId = 1;
  let _possessedDrone = null;

  /* ── Create Drone Mesh ───────────────────────────────────────────── */
  function buildDroneMesh(type) {
    const group = new THREE.Group();
    const stats = DRONE_STATS[type];

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.15, 0.5);
    const bodyMat = new THREE.MeshLambertMaterial({
      color: type === DRONE_TYPE.FPV_ATTACK ? 0xFF4444 :
             type === DRONE_TYPE.BOMB ? 0x444444 :
             type === DRONE_TYPE.SURVEILLANCE ? 0x4488FF : 0x44FF44
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

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
      hasPayload: type === DRONE_TYPE.BOMB,

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
    CameraSystem.setMode(CameraSystem.MODE.DRONE);
    CameraSystem.setDroneTarget(drone.mesh);
    return true;
  }

  function release() {
    if (_possessedDrone) {
      _possessedDrone = null;
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    }
  }

  function getPossessed() { return _possessedDrone; }
  function isPossessing() { return _possessedDrone !== null; }

  /* ── Drone Input (when possessed) ────────────────────────────────── */
  const _droneKeys = { w: false, a: false, s: false, d: false, up: false, down: false };

  function setDroneKey(key, pressed) {
    if (key in _droneKeys) _droneKeys[key] = pressed;
  }

  /* ── Update All Drones ───────────────────────────────────────────── */
  function update(delta) {
    for (const drone of drones) {
      if (!drone.alive || !drone.active) continue;

      // Battery drain
      drone.battery -= delta * 0.5;
      if (drone.battery <= 0) {
        drone.active = false;
        // Drone falls
        drone.velocity.y = -5;
      }

      if (drone === _possessedDrone) {
        updatePossessedDrone(drone, delta);
      } else if (drone.aiControlled) {
        updateAIDrone(drone, delta);
      }

      // Apply velocity
      drone.position.add(drone.velocity.clone().multiplyScalar(delta));

      // Ground collision
      const terrainH = VoxelWorld.getTerrainHeight(drone.position.x, drone.position.z) + 1;
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
    }
  }

  function updatePossessedDrone(drone, delta) {
    const yaw = CameraSystem.getYaw();
    const pitch = CameraSystem.getPitch();

    // Movement in drone's local space
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right   = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    drone.velocity.set(0, 0, 0);

    if (_droneKeys.w) drone.velocity.add(forward.clone().multiplyScalar(drone.speed));
    if (_droneKeys.s) drone.velocity.add(forward.clone().multiplyScalar(-drone.speed));
    if (_droneKeys.a) drone.velocity.add(right.clone().multiplyScalar(-drone.speed));
    if (_droneKeys.d) drone.velocity.add(right.clone().multiplyScalar(drone.speed));
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
    const dir = target.clone().sub(drone.position);
    const dist = dir.length();

    if (dist < 2) {
      drone.patrolIdx = (drone.patrolIdx + 1) % drone.patrolPoints.length;
      return;
    }

    dir.normalize().multiplyScalar(drone.speed * 0.5);
    drone.velocity.copy(dir);
    drone.mesh.rotation.y = Math.atan2(dir.x, dir.z);
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
        _scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
        clearInterval(fadeInterval);
      }
    }, 16);
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
  function getAll()        { return drones.filter(d => d.alive); }
  function getActive()     { return drones.filter(d => d.alive && d.active); }
  function getById(id)     { return drones.find(d => d.id === id && d.alive); }
  function getByType(type) { return drones.filter(d => d.alive && d.type === type); }

  function clear() {
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
    clear,
  };
})();
