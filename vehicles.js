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
  let _hijackState = null;  // { vehicle, timer, duration }
  let _playerBodyMesh = null;  // shown half-in during hijack/riding

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

  /* ── Player Body Mesh (half-body visible from vehicle hatch) ───── */
  function buildPlayerBodyMesh() {
    const body = new THREE.Group();
    // Torso
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.6, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x3A5A2A })
    );
    torso.position.y = 0.3;
    body.add(torso);
    // Head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xD4A06A })
    );
    head.position.y = 0.75;
    body.add(head);
    // Helmet
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.15, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x3A4A2A })
    );
    helmet.position.y = 0.95;
    body.add(helmet);
    // Arms (posed as gripping hatch rim)
    for (let side = -1; side <= 1; side += 2) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.45, 0.15),
        new THREE.MeshLambertMaterial({ color: 0x3A5A2A })
      );
      arm.position.set(side * 0.35, 0.2, 0);
      arm.rotation.z = side * 0.3;
      body.add(arm);
    }
    body.castShadow = true;
    return body;
  }

  function attachPlayerBody(vehicle) {
    if (!_scene) return;
    if (_playerBodyMesh) {
      _scene.remove(_playerBodyMesh);
      _playerBodyMesh = null;
    }
    _playerBodyMesh = buildPlayerBodyMesh();
    // Position on top of vehicle (emerging from hatch)
    _playerBodyMesh.position.set(0, 1.4, 0);
    vehicle.mesh.add(_playerBodyMesh);
  }

  function detachPlayerBody() {
    if (_playerBodyMesh) {
      if (_playerBodyMesh.parent) _playerBodyMesh.parent.remove(_playerBodyMesh);
      _playerBodyMesh.traverse(function (c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      _playerBodyMesh = null;
    }
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
    attachPlayerBody(v);
    // Apply correct camera mode based on vehicle view preference
    if (v.viewMode === 'first') {
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    } else {
      CameraSystem.setMode(CameraSystem.MODE.VEHICLE);
    }
    CameraSystem.setVehicleTarget(v.mesh);
    if (typeof HUD !== 'undefined' && HUD.showVehicleHUD) HUD.showVehicleHUD(v);
    if (typeof AudioSystem !== 'undefined' && AudioSystem.startEngine) AudioSystem.startEngine();
    return true;
  }

  /** Start hijacking a vehicle (animated transition). Returns true if started. */
  function startHijack(vehicleId) {
    const v = vehicles.find(v => v.id === vehicleId && v.alive);
    if (!v || v.seats <= 0) return false;
    // Duration depends on faction: enemy takes longer
    const duration = v.faction === 'enemy' ? 2.0 : 0.8;
    _hijackState = { vehicle: v, timer: 0, duration: duration };
    if (typeof HUD !== 'undefined' && HUD.showHijackProgress) HUD.showHijackProgress(0.01);
    return true;
  }

  /** Complete the hijack (called when timer finishes) */
  function completeHijack() {
    if (!_hijackState) return false;
    const v = _hijackState.vehicle;
    _hijackState = null;
    if (!v || !v.alive) return false;
    // Clean up prior state
    if (v.occupiedByNPC) {
      v.occupiedByNPC = false;
      v.npcGunner = null;
    }
    v.faction = 'friendly';
    v.occupied = true;
    _occupiedVehicle = v;
    attachPlayerBody(v);
    if (v.viewMode === 'first') {
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    } else {
      CameraSystem.setMode(CameraSystem.MODE.VEHICLE);
    }
    CameraSystem.setVehicleTarget(v.mesh);
    if (typeof HUD !== 'undefined') {
      if (HUD.showVehicleHUD) HUD.showVehicleHUD(v);
      if (HUD.showHijackProgress) HUD.showHijackProgress(0);
    }
    if (typeof AudioSystem !== 'undefined' && AudioSystem.startEngine) AudioSystem.startEngine();
    return true;
  }

  /** Legacy hijack (instant) for backward compat */
  function hijack(vehicleId) {
    const v = vehicles.find(v => v.id === vehicleId && v.alive);
    if (!v || v.seats <= 0) return false;
    if (v.occupiedByNPC) {
      v.occupiedByNPC = false;
      v.npcGunner = null;
    }
    v.faction = 'friendly';
    v.occupied = true;
    _occupiedVehicle = v;
    attachPlayerBody(v);
    if (v.viewMode === 'first') {
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    } else {
      CameraSystem.setMode(CameraSystem.MODE.VEHICLE);
    }
    CameraSystem.setVehicleTarget(v.mesh);
    if (typeof HUD !== 'undefined' && HUD.showVehicleHUD) HUD.showVehicleHUD(v);
    return true;
  }

  /** Toggle between first-person and third-person view while in vehicle */
  function toggleVehicleView() {
    if (!_occupiedVehicle) return;
    if (_occupiedVehicle.viewMode === 'first') {
      _occupiedVehicle.viewMode = 'third';
      CameraSystem.setMode(CameraSystem.MODE.VEHICLE);
      // Show player body mesh in third person
      if (_playerBodyMesh) _playerBodyMesh.visible = true;
    } else {
      _occupiedVehicle.viewMode = 'first';
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
      // Hide player body in first person (camera IS the player)
      if (_playerBodyMesh) _playerBodyMesh.visible = false;
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
      detachPlayerBody();
      _occupiedVehicle = null;
      _hijackState = null;
      // Clear vehicle camera target so FPS camera doesn't stay locked to vehicle
      CameraSystem.setVehicleTarget(null);
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
      if (typeof HUD !== 'undefined' && HUD.hideVehicleHUD) HUD.hideVehicleHUD();
      // Stop engine sound
      if (typeof AudioSystem !== 'undefined' && AudioSystem.stopEngine) AudioSystem.stopEngine();
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
    // Process hijack animation
    if (_hijackState) {
      _hijackState.timer += delta;
      const progress = Math.min(1, _hijackState.timer / _hijackState.duration);
      if (typeof HUD !== 'undefined' && HUD.showHijackProgress) HUD.showHijackProgress(progress);
      if (progress >= 1) {
        completeHijack();
      }
    }

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
      v.position.addScaledVector(v.velocity, delta);

      // Gravity for non-flying vehicles — prevent going airborne
      if (!v.flying) {
        v.velocity.y -= 25 * delta; // stronger gravity
        const terrainH = VoxelWorld.getTerrainHeight(v.position.x, v.position.z);
        if (v.position.y <= terrainH) {
          v.position.y = terrainH;
          if (v.velocity.y < 0) v.velocity.y = 0;
        }
        // Clamp any upward velocity to prevent launches
        if (v.velocity.y > 1) v.velocity.y = 1;
        // Hard speed cap for AI vehicles to prevent erratic movement
        if (v !== _occupiedVehicle) {
          var hSpd = Math.sqrt(v.velocity.x * v.velocity.x + v.velocity.z * v.velocity.z);
          var maxSpd = v.speed * 0.7;
          if (hSpd > maxSpd) {
            v.velocity.x *= maxSpd / hSpd;
            v.velocity.z *= maxSpd / hSpd;
          }
        }
      } else if (!v.occupied) {
        // Unoccupied flying vehicles settle to ground
        const terrainH = VoxelWorld.getTerrainHeight(v.position.x, v.position.z);
        v.velocity.y -= 5 * delta;
        if (v.position.y < terrainH + 2) {
          v.position.y = terrainH + 2;
          v.velocity.y = 0;
        }
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

      // Friction (higher for ground vehicles, lower for flying)
      v.velocity.multiplyScalar(v.flying ? 0.95 : 0.90);
    }

    // Update turret projectiles
    updateTurretProjectiles(delta);

    // Update vehicle HUD
    if (_occupiedVehicle && typeof HUD !== 'undefined' && HUD.updateVehicleHUD) {
      HUD.updateVehicleHUD(_occupiedVehicle);
    }
  }

  function updatePlayerVehicle(v, delta) {
    // Use vehicle's own rotation for movement direction (not camera yaw)
    // This prevents the vehicle from flying off based on where the camera looks
    const vYaw = v.rotation.y;
    _vTmp1.set(-Math.sin(vYaw), 0, -Math.cos(vYaw));

    const accel = v.speed * 2;

    if (_vKeys.w) v.velocity.addScaledVector(_vTmp1, accel * delta);
    if (_vKeys.s) v.velocity.addScaledVector(_vTmp1, -accel * delta * 0.5);
    if (_vKeys.a) v.rotation.y += delta * 1.5;
    if (_vKeys.d) v.rotation.y -= delta * 1.5;

    if (v.flying) {
      if (_vKeys.up) v.velocity.y += accel * delta * 0.5;
      if (_vKeys.down) v.velocity.y -= accel * delta * 0.5;
    } else {
      // Ground vehicles cannot have vertical input — zero out any Y velocity from movement
      v.velocity.y = Math.min(v.velocity.y, 0);
    }

    // Speed cap
    const hSpeed = Math.sqrt(v.velocity.x * v.velocity.x + v.velocity.z * v.velocity.z);
    if (hSpeed > v.speed) {
      const scale = v.speed / hSpeed;
      v.velocity.x *= scale;
      v.velocity.z *= scale;
    }
    // Update engine sound with current speed
    if (typeof AudioSystem !== 'undefined' && AudioSystem.updateEngine) AudioSystem.updateEngine(hSpeed);
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
          if (v.waypoint) v.waypoint.copy(roadWPs[v._roadIdx]);
          else v.waypoint = roadWPs[v._roadIdx].clone();
          v.waypoint.y = 0;
          v._onRoad = true;
          v.waypointTimer = 12 + Math.random() * 8;
          return;
        }
      }
    }
    // Try to find road waypoint
    var roadWPs = (typeof VoxelWorld !== 'undefined' && VoxelWorld.getRoadWaypoints) ? VoxelWorld.getRoadWaypoints() : [];
    if (roadWPs.length > 0) {
      // Pick nearest road waypoint to current position
      var bestRoad = null;
      var bestDist = Infinity;
      for (var ri = 0; ri < roadWPs.length; ri++) {
        var rd = v.position.distanceTo(roadWPs[ri]);
        // Pick a road point that's not too close (at least 8 units away) and not too far
        if (rd > 8 && rd < 40 && rd < bestDist) {
          bestDist = rd;
          bestRoad = roadWPs[ri];
        }
      }
      if (bestRoad) {
        if (v._patrolTarget) v._patrolTarget.set(bestRoad.x, VoxelWorld.getTerrainHeight(bestRoad.x, bestRoad.z), bestRoad.z);
        else { v._patrolTarget = bestRoad.clone(); v._patrolTarget.y = VoxelWorld.getTerrainHeight(bestRoad.x, bestRoad.z); }
      }
    }

    // Fallback: Random point within PATROL_RADIUS of spawn
    v._onRoad = false;
    const home = v.spawnPos;
    const angle = Math.random() * Math.PI * 2;
    const dist  = 8 + Math.random() * PATROL_RADIUS;
    const wx = Math.max(-PATROL_BOUND, Math.min(PATROL_BOUND, home.x + Math.cos(angle) * dist));
    const wz = Math.max(-PATROL_BOUND, Math.min(PATROL_BOUND, home.z + Math.sin(angle) * dist));
    if (v.waypoint) v.waypoint.set(wx, 0, wz);
    else v.waypoint = new THREE.Vector3(wx, 0, wz);
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
      _vTmp1.copy(nearestEnemy.mesh.position).sub(v.position);
      const enemyDist = _vTmp1.length();
      const faceDir = _vTmp1.normalize();
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

    _vTmp1.copy(v.waypoint).sub(v.position);
    _vTmp1.y = 0;
    const distToWP = _vTmp1.length();

    if (distToWP < WAYPOINT_ARRIVE_DIST) {
      // Arrived at waypoint — pick a new one
      v.velocity.x = 0;
      v.velocity.z = 0;
      pickWaypoint(v);
      return;
    }

    // Drive towards waypoint
    const dir = _vTmp1.normalize();
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
    _vTmp1.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    spawnTurretProjectile(v.position, _vTmp1, v.damage);
    if (typeof AudioSystem !== 'undefined') AudioSystem.playGunshot('hmg');
  }

  function fireTurretAt(v, targetPos) {
    if (!_scene || v.fireCooldown > 0 || v.damage <= 0) return;
    v.fireCooldown = v.fireRate;
    _vTmp1.copy(targetPos).sub(v.position).normalize();
    spawnTurretProjectile(v.position, _vTmp1, v.damage);
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
    _vTmp2.copy(origin);
    _vTmp2.y += 1.6; // Turret height
    mesh.position.copy(_vTmp2);
    mesh.lookAt(_vTmp2.x + dir.x, _vTmp2.y + dir.y, _vTmp2.z + dir.z);
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
        _vRaycaster.set(p.mesh.position, p.dir);
        _vRaycaster.near = 0;
        _vRaycaster.far = p.speed * delta + 0.5;
        const hits = _vRaycaster.intersectObjects(enemyMeshes, true);
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
        _vTmp2.copy(p.mesh.position);
        const fakeCamera = {
          position: _vTmp2,
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
    if (v === _occupiedVehicle) {
      detachPlayerBody();
      exit();
    }
    if (v.mesh) {
      v.mesh.traverse(function (child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      if (_scene) _scene.remove(v.mesh);
    }
  }

  /* ── Queries ─────────────────────────────────────────────────────── */
  var _vehAliveCache = [];
  var _vehCacheFrame = -1;
  // ── Reusable temp vectors ──
  var _vTmp1 = new THREE.Vector3();
  var _vTmp2 = new THREE.Vector3();
  var _vRaycaster = new THREE.Raycaster(); // hoisted for turret projectile collision
  function _rebuildVehicleCache() {
    var f = performance.now();
    if (f === _vehCacheFrame) return;
    _vehCacheFrame = f;
    _vehAliveCache.length = 0;
    for (var i = 0; i < vehicles.length; i++) {
      if (vehicles[i].alive) _vehAliveCache.push(vehicles[i]);
    }
  }
  function getAll()        { _rebuildVehicleCache(); return _vehAliveCache; }
  function getById(id)     { return vehicles.find(v => v.id === id && v.alive); }
  function getByType(type) { return vehicles.filter(v => v.alive && v.type === type); }
  function getNearby(pos, radius) {
    return vehicles.filter(v => v.alive && v.position.distanceTo(pos) < radius);
  }

  function clear() {
    detachPlayerBody();
    _hijackState = null;
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
    if (typeof HUD !== 'undefined' && HUD.hideVehicleHUD) HUD.hideVehicleHUD();
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

  /* ── Vehicle Repair ──────────────────────────────────────────────── */
  function isRepairable(vehicleId) {
    var v = vehicles.find(function (v) { return v.id === vehicleId && v.alive; });
    return v ? v.health < v.maxHealth : false;
  }

  function repairVehicle(vehicleId, amount) {
    var v = vehicles.find(function (v) { return v.id === vehicleId && v.alive; });
    if (!v) return false;
    v.health = Math.min(v.maxHealth, v.health + amount);
    return true;
  }

  /* ── Vehicle Upgrades ────────────────────────────────────────────── */
  var VEHICLE_UPGRADES = {
    armor_plating:      { label: 'Armor Plating',      effect: 'hp_mult',    value: 1.3 },
    turbo_engine:       { label: 'Turbo Engine',        effect: 'speed_mult', value: 1.25 },
    mounted_gun:        { label: 'Mounted Gun',         effect: 'add_turret', value: 25 },
    reinforced_chassis: { label: 'Reinforced Chassis',  effect: 'ram_mult',   value: 1.5 },
    smoke_launcher:     { label: 'Smoke Launcher',      effect: 'smoke',      value: true },
  };

  var _vehicleUpgrades = {}; // vehicleId -> [upgradeId]

  function upgradeVehicle(vehicleId, upgradeId) {
    var v = vehicles.find(function (v) { return v.id === vehicleId && v.alive; });
    if (!v) return false;
    var upg = VEHICLE_UPGRADES[upgradeId];
    if (!upg) return false;
    if (!_vehicleUpgrades[vehicleId]) _vehicleUpgrades[vehicleId] = [];
    if (_vehicleUpgrades[vehicleId].indexOf(upgradeId) !== -1) return false; // already applied
    _vehicleUpgrades[vehicleId].push(upgradeId);
    // Apply effect
    if (upg.effect === 'hp_mult') {
      v.maxHealth = Math.floor(v.maxHealth * upg.value);
      v.health = Math.min(v.health + Math.floor(v.maxHealth * 0.3), v.maxHealth);
    } else if (upg.effect === 'speed_mult') {
      v.speed = Math.floor(v.speed * upg.value);
    } else if (upg.effect === 'add_turret') {
      if (v.damage <= 0) { v.damage = upg.value; v.fireRate = 2.0; }
    } else if (upg.effect === 'ram_mult') {
      v._ramMult = upg.value;
    } else if (upg.effect === 'smoke') {
      v._hasSmoke = true;
    }
    return true;
  }

  function getVehicleUpgrades(vehicleId) {
    return _vehicleUpgrades[vehicleId] ? _vehicleUpgrades[vehicleId].slice() : [];
  }

  /* ── Vehicle Horn ────────────────────────────────────────────────── */
  function honkHorn(vehicleId) {
    var v = vehicles.find(function (v) { return v.id === vehicleId && v.alive; });
    if (!v) return false;
    // Play horn sound
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playVehicleEngine) {
      AudioSystem.playVehicleEngine('boost');
    }
    // Stun enemies within 10m
    if (typeof Enemies !== 'undefined' && Enemies.getAll) {
      var enemies = Enemies.getAll();
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e.alive || !e.mesh) continue;
        if (v.position.distanceTo(e.mesh.position) < 10) {
          e.stunTimer = (e.stunTimer || 0) + 1.0;
        }
      }
    }
    return true;
  }

  /* ── Fuel System ─────────────────────────────────────────────────── */
  var _fuelLevels = {}; // vehicleId -> fuel (0-100)

  function _initFuel(vehicleId) {
    if (_fuelLevels[vehicleId] === undefined) _fuelLevels[vehicleId] = 100;
  }

  function consumeFuel(vehicleId, amount) {
    _initFuel(vehicleId);
    _fuelLevels[vehicleId] = Math.max(0, _fuelLevels[vehicleId] - amount);
    return _fuelLevels[vehicleId];
  }

  function refuelVehicle(vehicleId, amount) {
    _initFuel(vehicleId);
    _fuelLevels[vehicleId] = Math.min(100, _fuelLevels[vehicleId] + amount);
    return _fuelLevels[vehicleId];
  }

  function getFuel(vehicleId) {
    _initFuel(vehicleId);
    return _fuelLevels[vehicleId];
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
    startHijack,
    completeHijack,
    isHijacking: function () { return _hijackState !== null; },
    cancelHijack: function () {
      _hijackState = null;
      if (typeof HUD !== 'undefined' && HUD.showHijackProgress) HUD.showHijackProgress(0);
    },
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
    // Vehicle Repair
    repairVehicle: repairVehicle,
    isRepairable: isRepairable,
    // Vehicle Upgrades
    VEHICLE_UPGRADES: VEHICLE_UPGRADES,
    upgradeVehicle: upgradeVehicle,
    getVehicleUpgrades: getVehicleUpgrades,
    // Vehicle Horn
    honkHorn: honkHorn,
    // Fuel System
    consumeFuel: consumeFuel,
    refuelVehicle: refuelVehicle,
    getFuel: getFuel,
  };
})();
