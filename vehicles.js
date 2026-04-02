/* ───────────────────────────────────────────────────────────────────────
   VEHICLE SYSTEM — ground & air vehicles, turret rovers
   ─────────────────────────────────────────────────────────────────────── */
const VehicleSystem = (function () {
  'use strict';

  /* ── Vehicle Types ───────────────────────────────────────────────── */
  const VEHICLE_TYPE = Object.freeze({
    TRANSPORT:  'transport',
    COMBAT:     'combat',
    LOGISTICS:  'logistics',
    HELICOPTER: 'helicopter',
    PLANE:      'plane',
    TURRET_ROVER: 'turret_rover',
  });

  const VEHICLE_STATS = {
    transport:    { speed: 15, health: 200, seats: 6,  armor: 1,  flying: false },
    combat:       { speed: 12, health: 400, seats: 3,  armor: 3,  flying: false, damage: 50 },
    logistics:    { speed: 8,  health: 300, seats: 2,  armor: 2,  flying: false, cargo: 200 },
    helicopter:   { speed: 20, health: 150, seats: 4,  armor: 1,  flying: true },
    plane:        { speed: 35, health: 120, seats: 2,  armor: 1,  flying: true },
    turret_rover: { speed: 5,  health: 250, seats: 0,  armor: 3,  flying: false, damage: 35, ai: true },
  };

  /* ── State ───────────────────────────────────────────────────────── */
  const vehicles = [];
  let _scene = null;
  let nextId = 1;
  let _occupiedVehicle = null;

  /* ── Turret Projectile State ────────────────────────────────────── */
  const turretProjectiles = [];
  const TURRET_PROJ_SPEED = 40;

  /* ── Build Vehicle Mesh ──────────────────────────────────────────── */
  function buildVehicleMesh(type) {
    const group = new THREE.Group();
    const stats = VEHICLE_STATS[type];

    if (stats.flying) {
      // Helicopter / plane body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.8, 3),
        new THREE.MeshLambertMaterial({ color: type === 'helicopter' ? 0x445544 : 0x555566 })
      );
      group.add(body);

      if (type === 'helicopter') {
        // Main rotor
        const rotor = new THREE.Mesh(
          new THREE.BoxGeometry(4, 0.05, 0.2),
          new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        rotor.position.y = 0.6;
        rotor.userData.isRotor = true;
        group.add(rotor);

        // Tail
        const tail = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.3, 2),
          new THREE.MeshLambertMaterial({ color: 0x445544 })
        );
        tail.position.set(0, 0.2, 2);
        group.add(tail);
      } else {
        // Wings
        for (let side = -1; side <= 1; side += 2) {
          const wing = new THREE.Mesh(
            new THREE.BoxGeometry(3, 0.1, 1),
            new THREE.MeshLambertMaterial({ color: 0x555566 })
          );
          wing.position.set(side * 2, 0, 0);
          group.add(wing);
        }
      }
    } else {
      // Ground vehicle body
      const bodyColor = type === 'combat' ? 0x3A4A2A :
                        type === 'turret_rover' ? 0x333333 : 0x5A5A4A;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1, 3.5),
        new THREE.MeshLambertMaterial({ color: bodyColor })
      );
      body.position.y = 0.7;
      group.add(body);

      // Wheels
      for (let x = -1; x <= 1; x += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8),
            new THREE.MeshLambertMaterial({ color: 0x222222 })
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x * 1.1, 0.4, z * 1.2);
          wheel.userData.isWheel = true;
          group.add(wheel);
        }
      }

      // Turret for combat / turret_rover
      if (type === 'combat' || type === 'turret_rover') {
        const turret = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.6, 0.5, 8),
          new THREE.MeshLambertMaterial({ color: 0x2A3A1A })
        );
        turret.position.set(0, 1.5, -0.3);
        group.add(turret);

        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6),
          new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 1.5, -1.2);
        group.add(barrel);
      }
    }

    group.castShadow = true;
    return group;
  }

  /* ── Init ────────────────────────────────────────────────────────── */
  function init(scene) {
    _scene = scene;
    vehicles.length = 0;
    nextId = 1;
    _occupiedVehicle = null;
  }

  /* ── Spawn ───────────────────────────────────────────────────────── */
  function spawn(x, y, z, type) {
    type = type || VEHICLE_TYPE.TRANSPORT;
    const stats = VEHICLE_STATS[type];
    const vehicle = {
      id: nextId++,
      type,
      faction: 'friendly',     // 'friendly' or 'enemy' — determines hijack behavior
      position: new THREE.Vector3(x, y, z),
      rotation: new THREE.Euler(0, 0, 0),
      velocity: new THREE.Vector3(),
      health: stats.health,
      maxHealth: stats.health,
      speed: stats.speed,
      seats: stats.seats,
      armor: stats.armor,
      damage: stats.damage || 0,
      flying: stats.flying,
      cargo: stats.cargo || 0,
      ai: stats.ai || false,
      mesh: null,
      alive: true,
      occupied: false,
      occupiedByNPC: false,      // true when an NPC gunner is aboard
      npcGunner: null,           // reference to NPC using this vehicle's gun
      passengers: [],
      fireCooldown: 0,
      fireRate: type === 'combat' ? 1.5 : type === 'turret_rover' ? 2.0 : 0,
      crewExposed: (type === 'combat'),  // tank crew is exposed in hatches
      viewMode: 'third',        // 'first' or 'third' — camera mode when occupied
    };

    vehicle.mesh = buildVehicleMesh(type);
    vehicle.mesh.position.copy(vehicle.position);
    vehicle.mesh.userData.vehicleId = vehicle.id;

    if (_scene) _scene.add(vehicle.mesh);
    vehicles.push(vehicle);
    return vehicle;
  }

  /* ── Enter / Exit / Hijack ─────────────────────────────────────────── */
  function enter(vehicleId) {
    const v = vehicles.find(v => v.id === vehicleId && v.alive && !v.occupied);
    if (!v || v.seats <= 0) return false;
    v.occupied = true;
    _occupiedVehicle = v;
    // Apply correct camera mode based on vehicle view preference
    if (v.viewMode === 'first') {
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    } else {
      CameraSystem.setMode(CameraSystem.MODE.VEHICLE);
    }
    CameraSystem.setVehicleTarget(v.mesh);
    return true;
  }

  /** Hijack a vehicle (steal from enemy or friendly). Changes faction to friendly. */
  function hijack(vehicleId) {
    const v = vehicles.find(v => v.id === vehicleId && v.alive);
    if (!v || v.seats <= 0) return false;
    // Clean up prior state
    if (v.occupiedByNPC) {
      v.occupiedByNPC = false;
      v.npcGunner = null;
    }
    v.faction = 'friendly';
    v.occupied = true;
    _occupiedVehicle = v;
    if (v.viewMode === 'first') {
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    } else {
      CameraSystem.setMode(CameraSystem.MODE.VEHICLE);
    }
    CameraSystem.setVehicleTarget(v.mesh);
    return true;
  }

  /** Toggle between first-person and third-person view while in vehicle */
  function toggleVehicleView() {
    if (!_occupiedVehicle) return;
    if (_occupiedVehicle.viewMode === 'first') {
      _occupiedVehicle.viewMode = 'third';
      CameraSystem.setMode(CameraSystem.MODE.VEHICLE);
    } else {
      _occupiedVehicle.viewMode = 'first';
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    }
    CameraSystem.setVehicleTarget(_occupiedVehicle.mesh);
  }

  function exit() {
    if (_occupiedVehicle) {
      _occupiedVehicle.occupied = false;
      _occupiedVehicle.velocity.set(0, 0, 0);
      const exitPos = _occupiedVehicle.position.clone();
      // Eject NPC gunner too
      if (_occupiedVehicle.npcGunner) {
        _occupiedVehicle.occupiedByNPC = false;
        _occupiedVehicle.npcGunner = null;
      }
      _occupiedVehicle = null;
      // Clear vehicle camera target so FPS camera doesn't stay locked to vehicle
      CameraSystem.setVehicleTarget(null);
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
      return exitPos;
    }
    return null;
  }

  /** Spawn an enemy vehicle (for tactical enemy vehicle spawns) */
  function spawnEnemy(x, y, z, type) {
    var v = spawn(x, y, z, type);
    if (v) v.faction = 'enemy';
    return v;
  }

  /** Let an NPC board as gunner */
  function boardNPCGunner(vehicleId, npc) {
    var v = vehicles.find(v => v.id === vehicleId && v.alive);
    if (!v || v.occupiedByNPC) return false;
    v.occupiedByNPC = true;
    v.npcGunner = npc;
    return true;
  }

  function getOccupied() { return _occupiedVehicle; }
  function isInVehicle() { return _occupiedVehicle !== null; }

  /* ── Vehicle Input ───────────────────────────────────────────────── */
  const _vKeys = { w: false, a: false, s: false, d: false, up: false, down: false, fire: false };
  function setVehicleKey(key, pressed) {
    if (key in _vKeys) _vKeys[key] = pressed;
  }

  /* ── Update ──────────────────────────────────────────────────────── */
  function update(delta) {
    for (const v of vehicles) {
      if (!v.alive) continue;

      // Fire cooldown
      if (v.fireCooldown > 0) v.fireCooldown -= delta;

      if (v === _occupiedVehicle) {
        updatePlayerVehicle(v, delta);
        // Player vehicle fires with mouse/fire key
        if (_vKeys.fire && v.damage > 0 && v.fireCooldown <= 0) {
          fireTurret(v);
        }
        // NPC gunner fires at nearby enemies while player drives
        if (v.occupiedByNPC && v.npcGunner && v.damage > 0) {
          updateNPCGunner(v, delta);
        }
      } else {
        // ALL unoccupied vehicles get autonomous AI movement
        updateAIVehicle(v, delta);
      }

      // Apply velocity
      v.position.add(v.velocity.clone().multiplyScalar(delta));

      // Ground collision for non-flying
      if (!v.flying || !v.occupied) {
        const terrainH = VoxelWorld.getTerrainHeight(v.position.x, v.position.z);
        if (v.position.y < terrainH) v.position.y = terrainH;
      }

      // Keep within world bounds
      v.position.x = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, v.position.x));
      v.position.z = Math.max(-WORLD_BOUND, Math.min(WORLD_BOUND, v.position.z));

      // Update mesh
      v.mesh.position.copy(v.position);
      v.mesh.rotation.copy(v.rotation);

      // Rotor animation
      v.mesh.children.forEach(child => {
        if (child.userData.isRotor) child.rotation.y += delta * 20;
        if (child.userData.isWheel) child.rotation.x += delta * v.velocity.length() * 2;
      });

      // Friction
      v.velocity.multiplyScalar(0.95);
    }

    // Update turret projectiles
    updateTurretProjectiles(delta);
  }

  function updatePlayerVehicle(v, delta) {
    const yaw = CameraSystem.getYaw();
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right   = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const accel = v.speed * 2;

    if (_vKeys.w) v.velocity.add(forward.clone().multiplyScalar(accel * delta));
    if (_vKeys.s) v.velocity.add(forward.clone().multiplyScalar(-accel * delta * 0.5));
    if (_vKeys.a) v.rotation.y += delta * 1.5;
    if (_vKeys.d) v.rotation.y -= delta * 1.5;

    if (v.flying) {
      if (_vKeys.up) v.velocity.y += accel * delta * 0.5;
      if (_vKeys.down) v.velocity.y -= accel * delta * 0.5;
    }

    // Speed cap
    const hSpeed = new THREE.Vector2(v.velocity.x, v.velocity.z).length();
    if (hSpeed > v.speed) {
      const scale = v.speed / hSpeed;
      v.velocity.x *= scale;
      v.velocity.z *= scale;
    }
  }

  /* ── AI Patrol Waypoint System ─────────────────────────────────── */
  const WORLD_BOUND   = 45;             // hard position clamp
  const PATROL_BOUND  = 43;             // waypoints stay inside hard clamp
  const PATROL_RADIUS = 30;             // how far from spawn to patrol
  const WAYPOINT_ARRIVE_DIST = 4;       // close enough = pick new waypoint
  const PATROL_SPEED_FACTOR = 0.35;     // fraction of max speed for patrol
  const COMBAT_SPEED_FACTOR = 0.55;     // fraction of max speed when engaging
  const COMBAT_ENGAGE_RANGE = 25;       // notice enemies within this range
  const COMBAT_HOLD_RANGE = 10;         // stop advancing at this distance
  const ROAD_SPEED_FACTOR = 0.65;       // faster speed when on roads

  function pickWaypoint(v) {
    // Prefer road waypoints when available (vehicles drive on roads)
    if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getRoadWaypoints) {
      const roadWPs = VoxelWorld.getRoadWaypoints();
      if (roadWPs.length > 0) {
        // Pick the nearest road waypoint that is different from current target
        let bestIdx = -1;
        let bestDist = Infinity;
        // Find nearest road waypoint first
        for (let i = 0; i < roadWPs.length; i++) {
          const d = v.position.distanceTo(roadWPs[i]);
          if (d < bestDist && d > WAYPOINT_ARRIVE_DIST) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          // Once on a road, follow sequential waypoints for realistic driving
          if (v._roadIdx === undefined) v._roadIdx = bestIdx;
          v._roadIdx = (v._roadIdx + 1) % roadWPs.length;
          v.waypoint = roadWPs[v._roadIdx].clone();
          v.waypoint.y = 0;
          v._onRoad = true;
          v.waypointTimer = 12 + Math.random() * 8;
          return;
        }
      }
    }
    // Fallback: Random point within PATROL_RADIUS of spawn
    v._onRoad = false;
    const home = v.spawnPos;
    const angle = Math.random() * Math.PI * 2;
    const dist  = 8 + Math.random() * PATROL_RADIUS;
    const wx = home.x + Math.cos(angle) * dist;
    const wz = home.z + Math.sin(angle) * dist;
    // Clamp within patrol bounds
    v.waypoint = new THREE.Vector3(
      Math.max(-PATROL_BOUND, Math.min(PATROL_BOUND, wx)),
      0,
      Math.max(-PATROL_BOUND, Math.min(PATROL_BOUND, wz))
    );
    v.waypointTimer = 8 + Math.random() * 10; // timeout to force new waypoint
  }

  function updateAIVehicle(v, delta) {
    // Initialize patrol state on first call
    if (!v.spawnPos) {
      v.spawnPos = v.position.clone();
      pickWaypoint(v);
    }

    // Decrement waypoint timeout
    if (v.waypointTimer !== undefined) {
      v.waypointTimer -= delta;
      if (v.waypointTimer <= 0) pickWaypoint(v);
    }

    // ── Find nearest target (depends on vehicle faction) ──
    let nearestEnemy = null;
    let nearestDist = COMBAT_ENGAGE_RANGE;

    if (v.faction === 'enemy') {
      // Enemy vehicles target friendly NPCs and the player
      if (typeof NPCSystem !== 'undefined' && NPCSystem.getAll) {
        var friendlies = NPCSystem.getAll();
        for (var fi = 0; fi < friendlies.length; fi++) {
          var npc = friendlies[fi];
          if (!npc.alive) continue;
          var nd = v.position.distanceTo(npc.position);
          if (nd < nearestDist) {
            nearestDist = nd;
            nearestEnemy = { alive: true, mesh: { position: npc.position } };
          }
        }
      }
      // Also fire at player if closer (via onPlayerHit callback not available here,
      // so just drive toward player position for aggression)
    } else {
      // Friendly vehicles target occupant enemies
      if (typeof Enemies !== 'undefined') {
        const enemies = Enemies.getAll ? Enemies.getAll() : [];
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (!e.alive || !e.mesh) continue;
          const d = v.position.distanceTo(e.mesh.position);
          if (d < nearestDist) {
            nearestDist = d;
            nearestEnemy = e;
          }
        }
      }
    }

    // ── Combat behavior (armed vehicles) ──
    if (nearestEnemy && v.damage > 0) {
      const toEnemy = nearestEnemy.mesh.position.clone().sub(v.position);
      const enemyDist = toEnemy.length();
      const faceDir = toEnemy.normalize();
      v.rotation.y = Math.atan2(faceDir.x, faceDir.z);

      // Fire at enemy
      if (v.fireCooldown <= 0) {
        fireTurretAt(v, nearestEnemy.mesh.position);
      }

      // Drive towards enemy if far, hold position if close
      if (enemyDist > COMBAT_HOLD_RANGE) {
        const moveSpeed = v.speed * COMBAT_SPEED_FACTOR;
        v.velocity.x = faceDir.x * moveSpeed;
        v.velocity.z = faceDir.z * moveSpeed;
      } else {
        v.velocity.x = 0;
        v.velocity.z = 0;
      }
      return; // skip patrol when in combat
    }

    // ── Patrol behavior (all vehicles when no enemy) ──
    if (!v.waypoint) pickWaypoint(v);

    const toWP = v.waypoint.clone().sub(v.position);
    toWP.y = 0;
    const distToWP = toWP.length();

    if (distToWP < WAYPOINT_ARRIVE_DIST) {
      // Arrived at waypoint — pick a new one
      v.velocity.x = 0;
      v.velocity.z = 0;
      pickWaypoint(v);
      return;
    }

    // Drive towards waypoint
    const dir = toWP.normalize();
    const moveSpeed = v.speed * (v._onRoad ? ROAD_SPEED_FACTOR : PATROL_SPEED_FACTOR);
    v.velocity.x = dir.x * moveSpeed;
    v.velocity.z = dir.z * moveSpeed;
    // Smoothly face movement direction
    const targetYaw = Math.atan2(dir.x, dir.z);
    let yawDiff = targetYaw - v.rotation.y;
    // Normalize to [-PI, PI]
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    v.rotation.y += yawDiff * Math.min(1, delta * 3);
  }

  /* ── Turret Fire ────────────────────────────────────────────────── */
  function fireTurret(v) {
    if (!_scene || v.fireCooldown > 0 || v.damage <= 0) return;
    v.fireCooldown = v.fireRate;
    // Fire in the direction the camera is facing (player-controlled)
    const yaw = CameraSystem.getYaw();
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    spawnTurretProjectile(v.position, dir, v.damage);
    if (typeof AudioSystem !== 'undefined') AudioSystem.playGunshot('hmg');
  }

  function fireTurretAt(v, targetPos) {
    if (!_scene || v.fireCooldown > 0 || v.damage <= 0) return;
    v.fireCooldown = v.fireRate;
    const dir = targetPos.clone().sub(v.position).normalize();
    spawnTurretProjectile(v.position, dir, v.damage);
    if (typeof AudioSystem !== 'undefined') AudioSystem.playGunshot('hmg');
  }

  /** NPC gunner AI: finds nearest enemy and fires turret at it */
  function updateNPCGunner(v, delta) {
    if (!v.occupiedByNPC || v.fireCooldown > 0) return;
    // Find nearest enemy
    if (typeof Enemies === 'undefined' || !Enemies.getAll) return;
    var enemies = Enemies.getAll();
    var nearestDist = COMBAT_ENGAGE_RANGE;
    var nearestEnemy = null;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive || !e.mesh) continue;
      var d = v.position.distanceTo(e.mesh.position);
      if (d < nearestDist) {
        nearestDist = d;
        nearestEnemy = e;
      }
    }
    if (nearestEnemy) {
      fireTurretAt(v, nearestEnemy.mesh.position);
    }
  }

  function spawnTurretProjectile(origin, dir, damage) {
    if (!_scene) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffcc22 })
    );
    const start = origin.clone();
    start.y += 1.6; // Turret height
    mesh.position.copy(start);
    mesh.lookAt(start.clone().add(dir));
    _scene.add(mesh);
    turretProjectiles.push({
      mesh: mesh, dir: dir.clone(), speed: TURRET_PROJ_SPEED,
      damage: damage, life: 3.0,
    });
  }

  function updateTurretProjectiles(delta) {
    for (let i = turretProjectiles.length - 1; i >= 0; i--) {
      const p = turretProjectiles[i];
      p.mesh.position.addScaledVector(p.dir, p.speed * delta);
      p.life -= delta;

      // Check enemy collision
      let hit = false;
      if (typeof Enemies !== 'undefined') {
        const enemyMeshes = Enemies.getEnemyMeshes();
        const rc = new THREE.Raycaster(
          p.mesh.position.clone(),
          p.dir.clone(),
          0,
          p.speed * delta + 0.5
        );
        const hits = rc.intersectObjects(enemyMeshes, true);
        if (hits.length > 0) {
          hit = true;
          const enemy = Enemies.findByMesh(hits[0].object);
          if (enemy && enemy.alive) {
            Enemies.damage(enemy, p.damage);
          }
        }
      }

      // Check terrain collision
      if (!hit && typeof VoxelWorld !== 'undefined') {
        const fakeCamera = {
          position: p.mesh.position.clone(),
          getWorldDirection: function(v) { return v.copy(p.dir); },
        };
        const ray = VoxelWorld.raycastBlock(fakeCamera, p.speed * delta + 0.5);
        if (ray) hit = true;
      }

      if (hit || p.life <= 0) {
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        if (_scene) _scene.remove(p.mesh);
        turretProjectiles.splice(i, 1);
      }
    }
  }

  /* ── Damage ──────────────────────────────────────────────────────── */
  function damageVehicle(vehicleId, amount) {
    const v = vehicles.find(v => v.id === vehicleId);
    if (!v || !v.alive) return;
    const actualDmg = Math.max(1, amount - v.armor * 5);
    v.health -= actualDmg;
    if (v.health <= 0) destroyVehicle(v);
  }

  function destroyVehicle(v) {
    v.alive = false;
    if (v === _occupiedVehicle) exit();
    if (v.mesh) {
      v.mesh.traverse(function (child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      if (_scene) _scene.remove(v.mesh);
    }
  }

  /* ── Queries ─────────────────────────────────────────────────────── */
  function getAll()        { return vehicles.filter(v => v.alive); }
  function getById(id)     { return vehicles.find(v => v.id === id && v.alive); }
  function getByType(type) { return vehicles.filter(v => v.alive && v.type === type); }
  function getNearby(pos, radius) {
    return vehicles.filter(v => v.alive && v.position.distanceTo(pos) < radius);
  }

  function clear() {
    for (const v of vehicles) {
      if (v.mesh) {
        v.mesh.traverse(function (child) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        if (_scene) _scene.remove(v.mesh);
      }
    }
    vehicles.length = 0;
    _occupiedVehicle = null;
    // Clean up turret projectiles
    for (const p of turretProjectiles) {
      if (p.mesh) {
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        if (_scene) _scene.remove(p.mesh);
      }
    }
    turretProjectiles.length = 0;
  }

  return {
    VEHICLE_TYPE,
    VEHICLE_STATS,
    init,
    spawn,
    spawnEnemy,
    enter,
    exit,
    hijack,
    toggleVehicleView,
    boardNPCGunner,
    getOccupied,
    isInVehicle,
    setVehicleKey,
    update,
    fireTurret,
    damageVehicle,
    getAll,
    getById,
    getByType,
    getNearby,
    clear,
  };
})();
