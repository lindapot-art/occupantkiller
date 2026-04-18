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
    TANK:       'tank',
  });

  const VEHICLE_STATS = {
    transport:    { speed: 15, health: 200, seats: 6,  armor: 1,  flying: false },
    combat:       { speed: 12, health: 400, seats: 3,  armor: 3,  flying: false, damage: 50 },
    logistics:    { speed: 8,  health: 300, seats: 2,  armor: 2,  flying: false, cargo: 200 },
    helicopter:   { speed: 20, health: 150, seats: 4,  armor: 1,  flying: true },
    plane:        { speed: 35, health: 120, seats: 2,  armor: 1,  flying: true },
    turret_rover: { speed: 5,  health: 250, seats: 0,  armor: 3,  flying: false, damage: 35, ai: true },
    tank:         { speed: 8,  health: 800, seats: 3,  armor: 6,  flying: false, damage: 200, cannonReload: 3.0, mgDamage: 15, mgRate: 0.1 },
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

  /* ── Tank-specific State ─────────────────────────────────────────── */
  const TANK_CANNON_PROJ_SPEED = 60;
  const TANK_MG_PROJ_SPEED = 80;
  const TANK_MIN_PITCH = -0.12;
  const TANK_MAX_PITCH = 0.32;
  const TANK_DUST_INTERVAL = 0.12;
  const TANK_EXHAUST_INTERVAL = 0.22;
  var _tankMGCooldown = 0;
  var _tankCannonAmmo = 20;

  /* ── Scorch mark pool ────────────────────────────────────────────── */
  var scorchMarks = [];
  var _scorchGeo = null;
  var _scorchMat = null;

  /* ── Cannon muzzle flash light ───────────────────────────────────── */
  var _muzzleFlashLight = null;
  var _muzzleFlashTimer = 0;

  /* ── MG strobe flash light ───────────────────────────────────────── */
  var _mgStrobeLight = null;
  var _mgStrobeTimer = 0;

  /* ── Shell tracer trails ─────────────────────────────────────────── */
  var shellTrails = [];

  /* ── Tank tread marks ────────────────────────────────────────────── */
  var treadMarks = [];
  var _treadMarkInterval = 0.18;  // seconds between marks
  var _lastTreadPos = new THREE.Vector3();
  var _treadDistAccum = 0;
  var _treadGeo = null;

  /* ── MG shell casings ─────────────────────────────────────────── */
  var mgCasings = [];
  var _casingGeo = null;
  var _casingMat = null;

  /* ── Cannon impact shockwave rings ─────────────────────────────── */
  var shockwaveRings = [];
  var _shockwaveGeo = null;

  var _tankMGAmmo = 500;
  var _tankMaxCannonAmmo = 20;
  var _tankMaxMGAmmo = 500;
  var _tankReloading = false;
  var _tankReloadTimer = 0;

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

  /* ── Build Tank Mesh ─────────────────────────────────────────────── */
  function buildTankMesh() {
    var group = new THREE.Group();
    var matHull  = new THREE.MeshLambertMaterial({ color: 0x3A4A2A }); // olive drab
    var matDark  = new THREE.MeshLambertMaterial({ color: 0x2A2A1A });
    var matTrack = new THREE.MeshLambertMaterial({ color: 0x1A1A1A });
    var matGun   = new THREE.MeshLambertMaterial({ color: 0x333333 });
    var matERA   = new THREE.MeshLambertMaterial({ color: 0x4A5A3A });

    // ── Hull (lower body — sloped front) ──
    var hull = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 4.5), matHull);
    hull.position.set(0, 0.6, 0);
    group.add(hull);

    // Front slope
    var frontSlope = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.2), matHull);
    frontSlope.position.set(0, 0.85, -2.2);
    frontSlope.rotation.x = 0.35;
    group.add(frontSlope);

    // Rear engine deck
    var rearDeck = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.8), matDark);
    rearDeck.position.set(0, 1.1, 1.8);
    group.add(rearDeck);

    // Engine exhaust pipes
    for (var ex = -1; ex <= 1; ex += 2) {
      var exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), matGun);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(ex * 0.4, 1.2, 2.3);
      exhaust.userData.isTankExhaust = true;
      group.add(exhaust);
    }

    // ── Tracks (left and right) ──
    for (var side = -1; side <= 1; side += 2) {
      // Track housing
      var trackHousing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 4.8), matTrack);
      trackHousing.position.set(side * 1.65, 0.4, 0);
      group.add(trackHousing);

      // Track top guard (fender)
      var fender = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 4.6), matHull);
      fender.position.set(side * 1.65, 0.8, 0);
      group.add(fender);

      // Road wheels (6 per side)
      for (var wi = 0; wi < 6; wi++) {
        var wz = -2.0 + wi * 0.8;
        var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8), matGun);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side * 1.65, 0.3, wz);
        wheel.userData.isWheel = true;
        wheel.userData.isTankWheel = true;
        group.add(wheel);
      }

      // Drive sprocket (front)
      var sprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 8), matDark);
      sprocket.rotation.z = Math.PI / 2;
      sprocket.position.set(side * 1.65, 0.5, -2.5);
      group.add(sprocket);

      // Idler wheel (rear)
      var idler = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 8), matDark);
      idler.rotation.z = Math.PI / 2;
      idler.position.set(side * 1.65, 0.5, 2.3);
      group.add(idler);

      // ERA (Explosive Reactive Armor) blocks on sides
      for (var ei = 0; ei < 4; ei++) {
        var era = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.5), matERA);
        era.position.set(side * 1.5, 0.95, -1.5 + ei * 0.8);
        group.add(era);
      }
    }

    // ── Turret (rotating group) ──
    var turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.3, -0.3);
    turretGroup.userData.isTurret = true;

    // Turret body (tapered)
    var turretBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 2.2), matHull);
    turretBody.position.set(0, 0.3, 0);
    turretGroup.add(turretBody);

    // Turret top
    var turretTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 1.8), matDark);
    turretTop.position.set(0, 0.65, 0);
    turretGroup.add(turretTop);

    // Main gun mantlet (thick part where gun emerges)
    var mantlet = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 8), matGun);
    mantlet.rotation.z = Math.PI / 2;
    mantlet.position.set(0, 0.35, -1.1);
    turretGroup.add(mantlet);

    // Main gun barrel (125mm cannon)
    var mainGun = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.0, 8), matGun);
    mainGun.rotation.x = Math.PI / 2;
    mainGun.position.set(0, 0.35, -2.6);
    mainGun.userData.isMainGun = true;
    mainGun.userData.baseZ = -2.6;
    mainGun.userData.baseRotationX = Math.PI / 2;
    turretGroup.add(mainGun);

    // Muzzle brake
    var muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.2, 8), matGun);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.35, -4.15);
    muzzle.userData.isTankMuzzle = true;
    muzzle.userData.baseRotationX = Math.PI / 2;
    turretGroup.add(muzzle);

    // Coaxial MG (right of main gun)
    var coaxMG = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), matGun);
    coaxMG.rotation.x = Math.PI / 2;
    coaxMG.position.set(0.25, 0.3, -1.8);
    coaxMG.userData.isCoaxMG = true;
    coaxMG.userData.coaxTipOffset = -0.78;
    coaxMG.userData.baseRotationX = Math.PI / 2;
    turretGroup.add(coaxMG);

    // Commander's cupola (top hatch with MG)
    var cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.2, 8), matDark);
    cupola.position.set(-0.3, 0.75, 0.3);
    turretGroup.add(cupola);

    // Commander's MG (NSVT or similar)
    var cmdMG = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6), matGun);
    cmdMG.rotation.x = Math.PI / 2;
    cmdMG.position.set(-0.3, 0.9, -0.1);
    turretGroup.add(cmdMG);

    // Turret ERA blocks (front face)
    for (var te = -1; te <= 1; te++) {
      var tEra = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.1), matERA);
      tEra.position.set(te * 0.55, 0.3, -1.15);
      turretGroup.add(tEra);
    }

    // Turret basket / stowage at rear
    var basket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.6), matDark);
    basket.position.set(0, 0.3, 1.15);
    turretGroup.add(basket);

    group.add(turretGroup);

    // ── Accessories ──
    // Antenna
    var antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 1.5, 4), matGun);
    antenna.position.set(0.8, 2.2, 0.5);
    antenna.userData.isAntenna = true;
    antenna.userData.baseRotX = 0;
    antenna.userData.baseRotZ = 0;
    group.add(antenna);

    // Headlights
    for (var hl = -1; hl <= 1; hl += 2) {
      var light = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), new THREE.MeshLambertMaterial({ color: 0xffffaa }));
      light.rotation.x = Math.PI / 2;
      light.position.set(hl * 0.9, 0.75, -2.6);
      group.add(light);
      // Working SpotLight beam per headlight
      var spot = new THREE.SpotLight(0xffffcc, 0, 25, Math.PI / 6, 0.6, 1.5);
      spot.position.set(hl * 0.9, 0.75, -2.6);
      // Target placed forward of headlight
      var spotTarget = new THREE.Object3D();
      spotTarget.position.set(hl * 0.9, 0.3, -12);
      group.add(spotTarget);
      spot.target = spotTarget;
      spot.userData.isHeadlight = true;
      group.add(spot);
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
      fireRate: type === 'tank' ? 3.0 : type === 'combat' ? 1.5 : type === 'turret_rover' ? 2.0 : 0,
      crewExposed: (type === 'combat'),  // tank crew is NOT exposed
      viewMode: type === 'tank' ? 'first' : 'third',        // tanks start in first-person (interior view)
      // Tank-specific
      isTank: type === 'tank',
      mgCooldown: 0,
      mgFiring: false,
      cannonAmmo: type === 'tank' ? _tankMaxCannonAmmo : 0,
      mgAmmo: type === 'tank' ? _tankMaxMGAmmo : 0,
      turretYaw: 0,   // independent turret rotation
      turretPitch: 0,
      cannonRecoil: 0,
      dustTimer: 0,
      exhaustTimer: 0,
      damageSmokeTimer: 0,
      impactFxCooldown: 0,
      wrecked: false,
      wreckTimer: 0,
      wreckSmokeTimer: 0,
      // Antenna spring state
      antennaVelX: 0,
      antennaVelZ: 0,
      antennaDispX: 0,
      antennaDispZ: 0,
      // Hull roll state
      hullRoll: 0,
      hullPitch: 0,
      _prevYaw: 0,
      _prevHSpeed: 0,
      _headlightsOn: false,
    };

    vehicle.mesh = type === 'tank' ? buildTankMesh() : buildVehicleMesh(type);
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
    // Tank-specific: sync ammo counters
    if (v.isTank) {
      _tankCannonAmmo = v.cannonAmmo;
      _tankMGAmmo = v.mgAmmo;
    }
    // Apply correct camera mode based on vehicle view preference
    if (v.viewMode === 'first') {
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    } else {
      CameraSystem.setMode(CameraSystem.MODE.VEHICLE);
    }
    CameraSystem.setVehicleTarget(v.mesh);
    if (typeof HUD !== 'undefined' && HUD.showVehicleHUD) HUD.showVehicleHUD(v);
    if (typeof AudioSystem !== 'undefined' && AudioSystem.startEngine) AudioSystem.startEngine();
    // Tank-specific notification
    if (v.isTank && typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup('\uD83D\uDE94 TANK ENTERED! LMB=Cannon RMB=MG T=Toggle View', '#00ff88');
    }
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
    if (v.isTank) {
      _tankCannonAmmo = v.cannonAmmo;
      _tankMGAmmo = v.mgAmmo;
    }
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
    if (v.isTank && typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup('\uD83D\uDE94 TANK CAPTURED! LMB=Cannon RMB=MG T=Toggle View', '#00ff88');
    }
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
    if (v.isTank) {
      _tankCannonAmmo = v.cannonAmmo;
      _tankMGAmmo = v.mgAmmo;
    }
    if (v.viewMode === 'first') {
      CameraSystem.setMode(CameraSystem.MODE.FIRST_PERSON);
    } else {
      CameraSystem.setMode(CameraSystem.MODE.VEHICLE);
    }
    CameraSystem.setVehicleTarget(v.mesh);
    if (typeof HUD !== 'undefined' && HUD.showVehicleHUD) HUD.showVehicleHUD(v);
    if (v.isTank && typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup('\uD83D\uDE94 TANK CAPTURED! LMB=Cannon RMB=MG T=Toggle View', '#00ff88');
    }
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
  const _vKeys = { w: false, a: false, s: false, d: false, up: false, down: false, fire: false, mgFire: false };
  function setVehicleKey(key, pressed) {
    if (key in _vKeys) _vKeys[key] = pressed;
    // Update MG firing state on occupied tank
    if (key === 'mgFire' && _occupiedVehicle && _occupiedVehicle.isTank) {
      _occupiedVehicle.mgFiring = pressed;
    }
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
      if (!v.alive) {
        if (v.wrecked) updateVehicleWreck(v, delta);
        continue;
      }

      // Fire cooldown
      if (v.fireCooldown > 0) v.fireCooldown -= delta;
      if (v.mgCooldown > 0) v.mgCooldown -= delta;

      if (v === _occupiedVehicle) {
        updatePlayerVehicle(v, delta);
        // Tank turret follows camera
        if (v.isTank) updateTankTurret(v, delta);
        // Player vehicle fires with mouse/fire key
        if (_vKeys.fire && v.damage > 0 && v.fireCooldown <= 0) {
          fireTurret(v);
        }
        // Tank MG fire (secondary fire key)
        if (v.isTank && v.mgFiring && v.mgCooldown <= 0 && v.mgAmmo > 0) {
          fireTankMG(v);
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
        // Hard ground-lock: zero upward velocity for ground vehicles (prevents BMP flying)
        if (v.velocity.y > 0) v.velocity.y = 0;
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

      if (v.isTank) updateTankEffects(v, delta);

      // Tank idle engine vibration — subtle camera rumble when stationary
      if (v.isTank && v === _occupiedVehicle) {
        var hSpd = Math.sqrt(v.velocity.x * v.velocity.x + v.velocity.z * v.velocity.z);
        if (hSpd < 0.5 && typeof CameraSystem !== 'undefined' && CameraSystem.shake) {
          v._idleVibTimer = (v._idleVibTimer || 0) + delta;
          if (v._idleVibTimer >= 0.25) {
            v._idleVibTimer = 0;
            CameraSystem.shake(0.003, 0.2);  // very subtle rumble
          }
        }
      }

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
    updateScorchMarks(delta);
    updateMuzzleFlashLight(delta);
    updateShellTrails(delta);
    updateTreadMarks(delta);
    updateShockwaveRings(delta);
    updateMGCasings(delta);

    // Update vehicle HUD
    if (_occupiedVehicle && typeof HUD !== 'undefined' && HUD.updateVehicleHUD) {
      HUD.updateVehicleHUD(_occupiedVehicle);
    }
  }

  function updateVehicleWreck(v, delta) {
    if (!v || !v.wrecked || !v.mesh) return;
    v.wreckTimer -= delta;
    v.wreckSmokeTimer -= delta;

    if (v.wreckSmokeTimer <= 0) {
      v.wreckSmokeTimer = 0.14;
      spawnTankDamageSmoke(v, 2);
      if (typeof Tracers !== 'undefined' && Tracers.spawnSparks && Math.random() < 0.35) {
        _vTmp1.set(
          v.position.x + (Math.random() - 0.5) * 1.8,
          v.position.y + 0.8 + Math.random() * 1.2,
          v.position.z + (Math.random() - 0.5) * 2.8
        );
        Tracers.spawnSparks(_vTmp1);
      }
    }

    if (v.wreckTimer <= 0) {
      disposeVehicleMesh(v);
      v.wrecked = false;
    }
  }

  /* ── Cannon Scorch Marks ─────────────────────────────────────────── */
  function spawnScorchMark(pos) {
    if (!_scene) return;
    if (!_scorchGeo) _scorchGeo = new THREE.CircleGeometry(1.8, 8);
    if (!_scorchMat) _scorchMat = new THREE.MeshBasicMaterial({
      color: 0x1a1a1a, transparent: true, opacity: 0.7, depthWrite: false,
    });
    var mesh = new THREE.Mesh(_scorchGeo, _scorchMat.clone());
    mesh.rotation.x = -Math.PI / 2;                     // flat on ground
    mesh.position.set(pos.x, pos.y + 0.05, pos.z);      // just above terrain
    var scale = 0.8 + Math.random() * 0.6;
    mesh.scale.set(scale, scale, 1);
    mesh.rotation.z = Math.random() * Math.PI * 2;      // random twist
    _scene.add(mesh);
    scorchMarks.push({ mesh: mesh, life: 18 });
    // Cap pool to 20 marks
    if (scorchMarks.length > 20) {
      var old = scorchMarks.shift();
      if (old.mesh) { old.mesh.material.dispose(); _scene.remove(old.mesh); }
    }
  }

  function updateScorchMarks(delta) {
    for (var i = scorchMarks.length - 1; i >= 0; i--) {
      var s = scorchMarks[i];
      s.life -= delta;
      // Fade out over last 4 seconds
      if (s.life < 4) s.mesh.material.opacity = Math.max(0, s.life / 4 * 0.7);
      if (s.life <= 0) {
        s.mesh.material.dispose();
        _scene.remove(s.mesh);
        scorchMarks.splice(i, 1);
      }
    }
  }

  function spawnBulletTerrainImpact(pos) {
    if (!_scene) return;
    if (typeof Tracers !== 'undefined' && Tracers.spawnSparks) {
      Tracers.spawnSparks(pos);
    }
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playRicochet) {
      AudioSystem.playRicochet();
    }
  }

  /* ── Muzzle flash light fade ─────────────────────────────────────── */
  function updateMuzzleFlashLight(delta) {
    if (_muzzleFlashTimer > 0) {
      _muzzleFlashTimer -= delta;
      if (_muzzleFlashLight) {
        _muzzleFlashLight.intensity = 3.0 * Math.max(0, _muzzleFlashTimer / 0.15);
      }
      if (_muzzleFlashTimer <= 0 && _muzzleFlashLight) {
        _muzzleFlashLight.intensity = 0;
      }
    }
    // MG strobe
    if (_mgStrobeTimer > 0) {
      _mgStrobeTimer -= delta;
      if (_mgStrobeLight) {
        _mgStrobeLight.intensity = 1.5 * Math.max(0, _mgStrobeTimer / 0.06);
      }
      if (_mgStrobeTimer <= 0 && _mgStrobeLight) {
        _mgStrobeLight.intensity = 0;
      }
    }
  }

  /* ── Tank tread marks ────────────────────────────────────────────── */
  function spawnTreadMark(v) {
    if (!_scene) return;
    if (!_treadGeo) _treadGeo = new THREE.PlaneGeometry(0.6, 2.0);
    var yaw = v.rotation.y;
    var rightX = Math.cos(yaw);
    var rightZ = -Math.sin(yaw);
    for (var side = -1; side <= 1; side += 2) {
      var mat = new THREE.MeshBasicMaterial({ color: 0x222211, transparent: true, opacity: 0.5, depthWrite: false });
      var mesh = new THREE.Mesh(_treadGeo, mat);
      mesh.position.set(
        v.position.x + rightX * side * 1.4,
        v.position.y + 0.02,
        v.position.z + rightZ * side * 1.4
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = -yaw;
      _scene.add(mesh);
      treadMarks.push({ mesh: mesh, life: 12 });
    }
    // Pool cap
    while (treadMarks.length > 120) {
      var old = treadMarks.shift();
      old.mesh.material.dispose();
      _scene.remove(old.mesh);
    }
  }

  function updateTreadMarks(delta) {
    for (var i = treadMarks.length - 1; i >= 0; i--) {
      var t = treadMarks[i];
      t.life -= delta;
      t.mesh.material.opacity = 0.5 * Math.max(0, t.life / 12);
      if (t.life <= 0) {
        t.mesh.material.dispose();
        _scene.remove(t.mesh);
        treadMarks.splice(i, 1);
      }
    }
  }

  /* ── Cannon impact shockwave rings ───────────────────────────────── */
  function spawnShockwaveRing(pos) {
    if (!_scene) return;
    if (!_shockwaveGeo) _shockwaveGeo = new THREE.RingGeometry(0.2, 0.5, 24);
    var mat = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    var mesh = new THREE.Mesh(_shockwaveGeo, mat);
    mesh.position.set(pos.x, pos.y + 0.1, pos.z);
    mesh.rotation.x = -Math.PI / 2;
    _scene.add(mesh);
    shockwaveRings.push({ mesh: mesh, age: 0, maxAge: 0.4 });
    // Cap pool
    if (shockwaveRings.length > 8) {
      var old = shockwaveRings.shift();
      old.mesh.material.dispose();
      _scene.remove(old.mesh);
    }
  }

  function updateShockwaveRings(delta) {
    for (var i = shockwaveRings.length - 1; i >= 0; i--) {
      var r = shockwaveRings[i];
      r.age += delta;
      var t = r.age / r.maxAge;
      // Expand from scale 1 to 12 over lifetime
      var s = 1 + t * 11;
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = 0.7 * (1 - t);
      if (r.age >= r.maxAge) {
        r.mesh.material.dispose();
        _scene.remove(r.mesh);
        shockwaveRings.splice(i, 1);
      }
    }
  }

  /* ── MG Shell Casing Ejection ──────────────────────────────────── */
  function spawnMGCasing(firePos, camYaw) {
    if (!_scene) return;
    if (!_casingGeo) _casingGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 4);
    if (!_casingMat) _casingMat = new THREE.MeshLambertMaterial({ color: 0xC8A832 });
    var mesh = new THREE.Mesh(_casingGeo, _casingMat);
    mesh.position.copy(firePos);
    // Eject to the right of the gun, slightly up
    var rightX = Math.cos(camYaw);
    var rightZ = -Math.sin(camYaw);
    _scene.add(mesh);
    mgCasings.push({
      mesh: mesh,
      vx: rightX * (2.5 + Math.random() * 1.5) + (Math.random() - 0.5) * 0.5,
      vy: 1.8 + Math.random() * 1.2,
      vz: rightZ * (2.5 + Math.random() * 1.5) + (Math.random() - 0.5) * 0.5,
      rotSpeed: (Math.random() - 0.5) * 20,
      life: 1.5
    });
    // Cap pool size
    while (mgCasings.length > 30) {
      var old = mgCasings.shift();
      if (_scene) _scene.remove(old.mesh);
    }
  }

  function updateMGCasings(delta) {
    for (var i = mgCasings.length - 1; i >= 0; i--) {
      var c = mgCasings[i];
      c.life -= delta;
      c.vy -= 9.8 * delta; // gravity
      c.mesh.position.x += c.vx * delta;
      c.mesh.position.y += c.vy * delta;
      c.mesh.position.z += c.vz * delta;
      c.mesh.rotation.x += c.rotSpeed * delta;
      c.mesh.rotation.z += c.rotSpeed * 0.7 * delta;
      // Fade out in last 0.4s
      if (c.life < 0.4) {
        c.mesh.visible = c.life > 0;
      }
      if (c.life <= 0) {
        if (_scene) _scene.remove(c.mesh);
        mgCasings.splice(i, 1);
      }
    }
  }

  /* ── Shell tracer trails update ──────────────────────────────────── */
  function updateShellTrails(delta) {
    for (var i = shellTrails.length - 1; i >= 0; i--) {
      var t = shellTrails[i];
      t.life -= delta;
      var positions = t.line.geometry.attributes.position.array;
      // Tail end stays at origin initially, then fades toward head
      if (t.proj && t.proj.mesh && t.proj.mesh.parent) {
        // Head follows projectile
        positions[3] = t.proj.mesh.position.x;
        positions[4] = t.proj.mesh.position.y;
        positions[5] = t.proj.mesh.position.z;
      }
      t.line.geometry.attributes.position.needsUpdate = true;
      // Fade opacity
      var alpha = Math.max(0, t.life / 4.0);
      t.line.material.opacity = alpha * 0.9;
      if (t.life <= 0) {
        t.line.geometry.dispose();
        t.line.material.dispose();
        if (_scene) _scene.remove(t.line);
        shellTrails.splice(i, 1);
      }
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
    // Track turn rate for hull roll
    v._turnRate = (_vKeys.a ? 1.5 : 0) + (_vKeys.d ? -1.5 : 0);

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

  function updateTankEffects(v, delta) {
    if (!v || !v.mesh) return;
    var hSpeed = Math.sqrt(v.velocity.x * v.velocity.x + v.velocity.z * v.velocity.z);
    var terrainH = typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight
      ? VoxelWorld.getTerrainHeight(v.position.x, v.position.z)
      : v.position.y;
    var grounded = v.position.y <= terrainH + 0.05;

    if (v.cannonRecoil > 0) {
      v.cannonRecoil = Math.max(0, v.cannonRecoil - delta * 1.4);
    }

    for (var ci = 0; ci < v.mesh.children.length; ci++) {
      var child = v.mesh.children[ci];
      if (child.userData && child.userData.isTurret) {
        for (var ti = 0; ti < child.children.length; ti++) {
          var turretChild = child.children[ti];
          if (turretChild.userData && turretChild.userData.isMainGun) {
            var baseZ = turretChild.userData.baseZ || -2.6;
            turretChild.position.z = baseZ + v.cannonRecoil * 0.5;
          }
        }
      }
    }

    if (grounded && hSpeed > 1.4) {
      v.dustTimer -= delta;
      if (v.dustTimer <= 0) {
        v.dustTimer = TANK_DUST_INTERVAL;
        spawnTankDust(v, Math.min(1, hSpeed / Math.max(1, v.speed)));
      }
      // Tread marks — spawn at intervals based on distance traveled
      _treadDistAccum += hSpeed * delta;
      if (_treadDistAccum >= 2.0) {
        _treadDistAccum = 0;
        spawnTreadMark(v);
      }
    } else {
      v.dustTimer = Math.min(v.dustTimer, 0.05);
      _treadDistAccum = 0;
    }

    v.exhaustTimer -= delta;
    if (v.exhaustTimer <= 0) {
      v.exhaustTimer = grounded && hSpeed > 0.8 ? TANK_EXHAUST_INTERVAL : TANK_EXHAUST_INTERVAL * 1.8;
      spawnTankExhaust(v, grounded && hSpeed > 0.8 ? 2 : 1);
    }

    var healthRatio = v.maxHealth > 0 ? (v.health / v.maxHealth) : 0;
    if (healthRatio < 0.45) {
      v.damageSmokeTimer -= delta;
      if (v.damageSmokeTimer <= 0) {
        v.damageSmokeTimer = healthRatio < 0.2 ? 0.08 : 0.16;
        spawnTankDamageSmoke(v, healthRatio < 0.2 ? 2 : 1);
      }
    } else {
      v.damageSmokeTimer = 0;
    }

    if (v.impactFxCooldown > 0) {
      v.impactFxCooldown = Math.max(0, v.impactFxCooldown - delta);
    }

    // ── Antenna spring wobble ──
    // Driving forces: velocity changes + cannon recoil kick
    var accelForceX = -v.velocity.x * 0.3;
    var accelForceZ = -v.velocity.z * 0.3;
    if (v.cannonRecoil > 0.3) {
      // Cannon just fired — big kick
      accelForceX += (Math.random() - 0.5) * 4;
      accelForceZ += (Math.random() - 0.5) * 4;
    }
    var springK = 25;   // stiffness
    var damping = 4.5;  // damping
    v.antennaVelX += (-springK * v.antennaDispX - damping * v.antennaVelX + accelForceX) * delta;
    v.antennaVelZ += (-springK * v.antennaDispZ - damping * v.antennaVelZ + accelForceZ) * delta;
    v.antennaDispX += v.antennaVelX * delta;
    v.antennaDispZ += v.antennaVelZ * delta;
    // Clamp displacement
    var maxDisp = 0.35;
    v.antennaDispX = Math.max(-maxDisp, Math.min(maxDisp, v.antennaDispX));
    v.antennaDispZ = Math.max(-maxDisp, Math.min(maxDisp, v.antennaDispZ));
    // Apply to antenna mesh
    for (var ai = 0; ai < v.mesh.children.length; ai++) {
      if (v.mesh.children[ai].userData && v.mesh.children[ai].userData.isAntenna) {
        v.mesh.children[ai].rotation.x = v.antennaDispZ * 0.8;
        v.mesh.children[ai].rotation.z = v.antennaDispX * 0.8;
        break;
      }
    }

    // ── Hull body roll on turns ──
    var targetRoll = (v._turnRate || 0) * hSpeed * 0.012; // lean proportional to turn × speed
    targetRoll = Math.max(-0.06, Math.min(0.06, targetRoll)); // cap at ~3.4 degrees
    v.hullRoll += (targetRoll - v.hullRoll) * Math.min(1, delta * 6);
    v.mesh.rotation.z = v.hullRoll;

    // ── Suspension pitch on accel/brake ──
    var accelDelta = hSpeed - (v._prevHSpeed || 0);
    var targetPitch = -accelDelta * 0.4; // nose dips on brake (decel), rises on accel
    targetPitch = Math.max(-0.04, Math.min(0.04, targetPitch)); // cap ~2.3 degrees
    v.hullPitch += (targetPitch - v.hullPitch) * Math.min(1, delta * 5);
    v.mesh.rotation.x = v.hullPitch;
    v._prevHSpeed = hSpeed;

    // ── Headlight beams ──
    if (!v._headlightsOn && v.occupied) {
      v._headlightsOn = true;
      v.mesh.traverse(function(ch) {
        if (ch.isSpotLight && ch.userData && ch.userData.isHeadlight) ch.intensity = 1.8;
      });
    } else if (v._headlightsOn && !v.occupied) {
      v._headlightsOn = false;
      v.mesh.traverse(function(ch) {
        if (ch.isSpotLight && ch.userData && ch.userData.isHeadlight) ch.intensity = 0;
      });
    }

    // Hull damage darkening — tint hull materials toward charred black as HP drops
    if (healthRatio < 0.9) {
      var darkFactor = Math.max(0, healthRatio);  // 1.0=pristine, 0=charred
      if (!v._origColors) {
        v._origColors = [];
        v.mesh.traverse(function(child) {
          if (child.isMesh && child.material && child.material.color) {
            v._origColors.push({ mat: child.material, r: child.material.color.r, g: child.material.color.g, b: child.material.color.b });
          }
        });
      }
      for (var oc = 0; oc < v._origColors.length; oc++) {
        var entry = v._origColors[oc];
        entry.mat.color.setRGB(
          entry.r * darkFactor,
          entry.g * darkFactor,
          entry.b * darkFactor
        );
      }
    }
  }

  function spawnTankDust(v, intensity) {
    if (typeof Tracers === 'undefined' || !Tracers.spawnSmoke) return;
    var yaw = v.rotation.y;
    var backX = Math.sin(yaw);
    var backZ = Math.cos(yaw);
    var rightX = Math.cos(yaw);
    var rightZ = -Math.sin(yaw);
    for (var side = -1; side <= 1; side += 2) {
      _vTmp1.set(
        v.position.x + rightX * side * 1.6 + backX * 1.6,
        v.position.y + 0.15,
        v.position.z + rightZ * side * 1.6 + backZ * 1.6
      );
      Tracers.spawnSmoke(_vTmp1);
      if (intensity > 0.65) {
        _vTmp2.copy(_vTmp1);
        _vTmp2.x += (Math.random() - 0.5) * 0.35;
        _vTmp2.z += (Math.random() - 0.5) * 0.35;
        Tracers.spawnSmoke(_vTmp2);
      }
    }
  }

  function spawnTankExhaust(v, count) {
    if (typeof Tracers === 'undefined' || !Tracers.spawnSmoke) return;
    count = count || 1;
    var yaw = v.rotation.y;
    var backX = Math.sin(yaw);
    var backZ = Math.cos(yaw);
    var rightX = Math.cos(yaw);
    var rightZ = -Math.sin(yaw);
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < count; i++) {
        _vTmp1.set(
          v.position.x + rightX * side * 0.45 + backX * 2.45 + (Math.random() - 0.5) * 0.08,
          v.position.y + 1.2 + Math.random() * 0.08,
          v.position.z + rightZ * side * 0.45 + backZ * 2.45 + (Math.random() - 0.5) * 0.08
        );
        Tracers.spawnSmoke(_vTmp1);
      }
    }
  }

  function spawnTankDamageSmoke(v, count) {
    if (typeof Tracers === 'undefined' || !Tracers.spawnSmoke) return;
    count = count || 1;
    for (var i = 0; i < count; i++) {
      _vTmp1.set(
        v.position.x + (Math.random() - 0.5) * 0.8,
        v.position.y + 1.6 + Math.random() * 0.35,
        v.position.z + 0.6 + (Math.random() - 0.5) * 0.8
      );
      Tracers.spawnSmoke(_vTmp1);
    }
  }

  function spawnTankImpactFeedback(v, amount, actualDmg) {
    if (!v || !v.mesh) return;

    var armorAbsorbed = Math.max(0, amount - actualDmg);
    var mostlyDeflected = armorAbsorbed >= Math.max(4, amount * 0.4);
    _vTmp1.set(
      v.position.x + (Math.random() - 0.5) * 2.1,
      v.position.y + 0.8 + Math.random() * 1.1,
      v.position.z + (Math.random() - 0.5) * 3.3
    );

    if (typeof Tracers !== 'undefined') {
      if (Tracers.spawnSparks) Tracers.spawnSparks(_vTmp1);
      if (Tracers.spawnBlockImpact) Tracers.spawnBlockImpact(_vTmp1, mostlyDeflected ? 0xb8bfc7 : 0x5f666d);
    }

    if (mostlyDeflected) {
      if (typeof AudioSystem !== 'undefined' && AudioSystem.playRicochet) AudioSystem.playRicochet();
    } else if (typeof AudioSystem !== 'undefined' && AudioSystem.playHit) {
      AudioSystem.playHit();
    }

    if (v === _occupiedVehicle && typeof CameraSystem !== 'undefined' && CameraSystem.shake) {
      CameraSystem.shake(Math.min(0.18, 0.05 + actualDmg * 0.006), mostlyDeflected ? 0.12 : 0.18);
      // Flash red vignette on the periscope overlay
      var flashEl = document.getElementById('tank-hit-flash');
      if (flashEl) {
        flashEl.classList.remove('active');
        void flashEl.offsetWidth;          // reflow to restart animation
        flashEl.classList.add('active');
      }
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
    // Tank uses specific cannon fire
    if (v.isTank) { fireTankCannon(v); return; }
    v.fireCooldown = v.fireRate;
    // Fire in the direction the camera is facing (player-controlled)
    const yaw = CameraSystem.getYaw();
    _vTmp1.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    spawnTurretProjectile(v.position, _vTmp1, v.damage);
    if (typeof AudioSystem !== 'undefined') AudioSystem.playGunshot('hmg');
  }

  /* ── Tank Cannon Fire (LMB — heavy projectile with explosion) ──── */
  function fireTankCannon(v) {
    if (!_scene || v.fireCooldown > 0 || v.cannonAmmo <= 0) return;
    v.fireCooldown = v.fireRate;
    v.cannonAmmo--;
    v.cannonRecoil = 0.35;
    _tankCannonAmmo = v.cannonAmmo;

    var camYaw = CameraSystem.getYaw();
    var camPitch = CameraSystem.getPitch();
    // Direction from camera aim (includes vertical aiming)
    _vTmp1.set(
      -Math.sin(camYaw) * Math.cos(camPitch),
      Math.sin(camPitch),
      -Math.cos(camYaw) * Math.cos(camPitch)
    ).normalize();

    // Spawn from actual cannon muzzle when available
    if (!getTankWeaponMountWorld(v, 'cannon', _vTmp2)) {
      _vTmp2.copy(v.position);
      _vTmp2.y += 1.65;
      _vTmp2.x += -Math.sin(camYaw) * 4.5;
      _vTmp2.z += -Math.cos(camYaw) * 4.5;
    }

    // Cannon shell (larger, faster projectile)
    var shellMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.04, 0.5, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6600 })
    );
    shellMesh.position.copy(_vTmp2);
    shellMesh.lookAt(_vTmp2.x + _vTmp1.x, _vTmp2.y + _vTmp1.y, _vTmp2.z + _vTmp1.z);
    _scene.add(shellMesh);
    turretProjectiles.push({
      mesh: shellMesh, dir: _vTmp1.clone(), speed: TANK_CANNON_PROJ_SPEED,
      damage: v.damage, life: 4.0, isCannonShell: true,
    });

    // Screen shake for cannon blast
    if (typeof CameraSystem !== 'undefined' && CameraSystem.shake) CameraSystem.shake(0.08, 0.3);
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playGunshot) AudioSystem.playGunshot('launcher');
    // Muzzle flash
    if (typeof Tracers !== 'undefined' && Tracers.spawnMuzzleFlash) {
      Tracers.spawnMuzzleFlash(_vTmp2, _vTmp1);
    }
    // Muzzle flash point light (brief orange light burst)
    if (_scene) {
      if (!_muzzleFlashLight) {
        _muzzleFlashLight = new THREE.PointLight(0xff8800, 0, 18);
        _scene.add(_muzzleFlashLight);
      }
      _muzzleFlashLight.position.copy(_vTmp2);
      _muzzleFlashLight.intensity = 3.0;
      _muzzleFlashTimer = 0.15;
    }
    // Shell tracer trail — glowing line that follows the projectile
    if (_scene) {
      var trailGeo = new THREE.BufferGeometry();
      var positions = new Float32Array(6); // 2 vertices × 3 coords
      positions[0] = _vTmp2.x; positions[1] = _vTmp2.y; positions[2] = _vTmp2.z;
      positions[3] = _vTmp2.x; positions[4] = _vTmp2.y; positions[5] = _vTmp2.z;
      trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var trailLine = new THREE.Line(trailGeo,
        new THREE.LineBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 })
      );
      _scene.add(trailLine);
      var lastProj = turretProjectiles[turretProjectiles.length - 1];
      shellTrails.push({ line: trailLine, proj: lastProj, origin: _vTmp2.clone(), life: 4.0 });
    }
    spawnTankExhaust(v, 3);
    // Reload notification
    if (typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup('\uD83D\uDCA5 CANNON FIRED! Reloading... (' + v.cannonAmmo + ' shells left)', '#ff8800');
    }
  }

  /* ── Tank MG Fire (RMB — rapid fire coaxial machine gun) ─────── */
  function fireTankMG(v) {
    if (!_scene || v.mgCooldown > 0 || v.mgAmmo <= 0) return;
    var stats = VEHICLE_STATS[v.type];
    v.mgCooldown = stats.mgRate || 0.1;
    v.mgAmmo--;
    _tankMGAmmo = v.mgAmmo;

    var camYaw = CameraSystem.getYaw();
    var camPitch = CameraSystem.getPitch();
    // Slight spread for MG
    var spread = 0.02;
    _vTmp1.set(
      -Math.sin(camYaw) * Math.cos(camPitch) + (Math.random() - 0.5) * spread,
      Math.sin(camPitch) + (Math.random() - 0.5) * spread,
      -Math.cos(camYaw) * Math.cos(camPitch) + (Math.random() - 0.5) * spread
    ).normalize();

    if (!getTankWeaponMountWorld(v, 'coax', _vTmp2)) {
      _vTmp2.copy(v.position);
      _vTmp2.y += 1.6;
      _vTmp2.x += -Math.sin(camYaw) * 2.5;
      _vTmp2.z += -Math.cos(camYaw) * 2.5;
    }

    var bulletMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.2),
      new THREE.MeshBasicMaterial({ color: 0xffcc22 })
    );
    bulletMesh.position.copy(_vTmp2);
    bulletMesh.lookAt(_vTmp2.x + _vTmp1.x, _vTmp2.y + _vTmp1.y, _vTmp2.z + _vTmp1.z);
    _scene.add(bulletMesh);
    turretProjectiles.push({
      mesh: bulletMesh, dir: _vTmp1.clone(), speed: TANK_MG_PROJ_SPEED,
      damage: stats.mgDamage || 15, life: 2.0, isCannonShell: false,
    });

    // Tracer every 3rd shot
    if (v.mgAmmo % 3 === 0 && typeof Tracers !== 'undefined' && Tracers.spawnTracer) {
      Tracers.spawnTracer(_vTmp2, _vTmp1, 0xffcc44, 100);
    }
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playGunshot) AudioSystem.playGunshot('hmg');
    // Shell casing ejection
    spawnMGCasing(_vTmp2, camYaw);
    // MG strobe flash light (brief yellow flash at coax mount)
    if (_scene) {
      if (!_mgStrobeLight) {
        _mgStrobeLight = new THREE.PointLight(0xffdd44, 0, 10);
        _scene.add(_mgStrobeLight);
      }
      _mgStrobeLight.position.copy(_vTmp2);
      _mgStrobeLight.intensity = 1.5;
      _mgStrobeTimer = 0.06;
    }
  }

  /* ── Tank Turret Rotation (follows camera yaw) ──────────────────── */
  function updateTankTurret(v, delta) {
    if (!v.isTank || !v.mesh) return;
    var camYaw = CameraSystem.getYaw();
    var camPitch = CameraSystem.getPitch();
    // Turret rotates relative to hull
    var targetTurretYaw = camYaw - v.rotation.y;
    var targetTurretPitch = Math.max(TANK_MIN_PITCH, Math.min(TANK_MAX_PITCH, camPitch));
    // Smooth rotation
    var diff = targetTurretYaw - v.turretYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.turretYaw += diff * Math.min(1, delta * 5);
    v.turretPitch += (targetTurretPitch - v.turretPitch) * Math.min(1, delta * 6);
    // Apply to turret group in mesh
    for (var ci = 0; ci < v.mesh.children.length; ci++) {
      if (v.mesh.children[ci].userData && v.mesh.children[ci].userData.isTurret) {
        v.mesh.children[ci].rotation.y = v.turretYaw;
        for (var ti = 0; ti < v.mesh.children[ci].children.length; ti++) {
          var turretChild = v.mesh.children[ci].children[ti];
          if (turretChild.userData && (turretChild.userData.isMainGun || turretChild.userData.isTankMuzzle || turretChild.userData.isCoaxMG)) {
            turretChild.rotation.x = (turretChild.userData.baseRotationX || (Math.PI / 2)) - v.turretPitch;
          }
        }
        break;
      }
    }
  }

  function getTankWeaponMountWorld(v, mountType, outPos) {
    if (!v || !v.mesh || !outPos) return false;
    for (var ci = 0; ci < v.mesh.children.length; ci++) {
      var child = v.mesh.children[ci];
      if (!(child.userData && child.userData.isTurret)) continue;
      for (var ti = 0; ti < child.children.length; ti++) {
        var turretChild = child.children[ti];
        if (mountType === 'cannon' && turretChild.userData && turretChild.userData.isTankMuzzle) {
          turretChild.getWorldPosition(outPos);
          outPos.z -= 0.12;
          return true;
        }
        if (mountType === 'coax' && turretChild.userData && turretChild.userData.isCoaxMG) {
          outPos.set(0, 0, turretChild.userData.coaxTipOffset || -0.75);
          turretChild.localToWorld(outPos);
          return true;
        }
      }
    }
    return false;
  }

  /* ── Tank Ammo Getters ──────────────────────────────────────────── */
  function getTankAmmo() {
    if (_occupiedVehicle && _occupiedVehicle.isTank) {
      return {
        cannon: _occupiedVehicle.cannonAmmo,
        maxCannon: _tankMaxCannonAmmo,
        mg: _occupiedVehicle.mgAmmo,
        maxMG: _tankMaxMGAmmo,
      };
    }
    return { cannon: _tankCannonAmmo, maxCannon: _tankMaxCannonAmmo, mg: _tankMGAmmo, maxMG: _tankMaxMGAmmo };
  }

  function isTankReloading() {
    return !!(_occupiedVehicle && _occupiedVehicle.isTank && _occupiedVehicle.fireCooldown > 0);
  }

  function getTankReloadProgress() {
    if (!_occupiedVehicle || !_occupiedVehicle.isTank) return 0;
    if (_occupiedVehicle.fireCooldown <= 0) return 1;
    return 1 - (_occupiedVehicle.fireCooldown / _occupiedVehicle.fireRate);
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
      // Gravity drop for cannon shells (realistic arc)
      if (p.isCannonShell) {
        p.dir.y -= 4.8 * delta / p.speed;  // ~4.8 m/s² effective gravity scaled to speed
      }
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
          // Cannon shell: splash damage to nearby enemies
          if (p.isCannonShell) {
            var shellPos = p.mesh.position;
            var splashRadius = 6;
            var allE = Enemies.getAll ? Enemies.getAll() : [];
            for (var se = 0; se < allE.length; se++) {
              var sEnemy = allE[se];
              if (!sEnemy.alive || !sEnemy.mesh || sEnemy === enemy) continue;
              var sDist = shellPos.distanceTo(sEnemy.mesh.position);
              if (sDist < splashRadius) {
                var splashDmg = Math.floor(p.damage * 0.5 * (1 - sDist / splashRadius));
                if (splashDmg > 0) Enemies.damage(sEnemy, splashDmg);
              }
            }
          }
        }
      }

      // Check terrain collision
      let terrainHit = null;
      if (!hit && typeof VoxelWorld !== 'undefined') {
        _vTmp2.copy(p.mesh.position);
        const fakeCamera = {
          position: _vTmp2,
          getWorldDirection: function(v) { return v.copy(p.dir); },
        };
        terrainHit = VoxelWorld.raycastBlock(fakeCamera, p.speed * delta + 0.5);
        if (terrainHit) hit = true;
      }

      if (hit || p.life <= 0) {
        // Cannon shell explosion effect
        if (p.isCannonShell && hit) {
          if (typeof Tracers !== 'undefined' && Tracers.spawnExplosion) {
            Tracers.spawnExplosion(p.mesh.position, 2.5);
          }
          if (typeof AudioSystem !== 'undefined' && AudioSystem.playExplosion) AudioSystem.playExplosion();
          // Terrain destruction from cannon
          if (typeof WorldFeatures !== 'undefined' && WorldFeatures.applyExplosionDamage) {
            WorldFeatures.applyExplosionDamage(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, 4, 150);
          }
          // Scorch mark at impact site
          spawnScorchMark(p.mesh.position);
          // Shockwave ring at impact
          spawnShockwaveRing(p.mesh.position);
        } else if (terrainHit) {
          _vTmp2.set(
            terrainHit.hit.x + 0.5,
            terrainHit.hit.y + 0.5,
            terrainHit.hit.z + 0.5
          );
          spawnBulletTerrainImpact(_vTmp2);
        }
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
    if (v.isTank && v.impactFxCooldown <= 0) {
      v.impactFxCooldown = actualDmg <= 2 ? 0.08 : 0.12;
      spawnTankImpactFeedback(v, amount, actualDmg);
    }
    v.health -= actualDmg;
    if (v.health <= 0) destroyVehicle(v);
  }

  function destroyVehicle(v) {
    v.alive = false;
    if (_scene && typeof Tracers !== 'undefined' && Tracers.spawnExplosion) {
      Tracers.spawnExplosion(v.position, v.isTank ? 3.8 : 2.4);
    }
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playExplosion) {
      AudioSystem.playExplosion();
    }
    if (v === _occupiedVehicle) {
      detachPlayerBody();
      exit();
    }
    if (v.isTank && v.mesh) {
      v.wrecked = true;
      v.wreckTimer = 14;
      v.wreckSmokeTimer = 0.05;
      v.velocity.set(0, 0, 0);
      v.rotation.z = (Math.random() - 0.5) * 0.12;
      v.rotation.x = (Math.random() - 0.5) * 0.05;
      v.mesh.rotation.copy(v.rotation);
      v.mesh.position.copy(v.position);
      v.mesh.traverse(function (child) {
        if (child.material && child.material.color) {
          child.material.color.multiplyScalar(0.55);
        }
      });
      return;
    }
    disposeVehicleMesh(v);
  }

  function disposeVehicleMesh(v) {
    if (v.mesh) {
      v.mesh.traverse(function (child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      if (_scene) _scene.remove(v.mesh);
      v.mesh = null;
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
    // Clean up scorch marks
    for (var si = 0; si < scorchMarks.length; si++) {
      if (scorchMarks[si].mesh) {
        scorchMarks[si].mesh.material.dispose();
        if (_scene) _scene.remove(scorchMarks[si].mesh);
      }
    }
    scorchMarks.length = 0;
    if (_scorchGeo) { _scorchGeo.dispose(); _scorchGeo = null; }
    if (_scorchMat) { _scorchMat.dispose(); _scorchMat = null; }
    // Clean up muzzle flash light
    if (_muzzleFlashLight) {
      if (_scene) _scene.remove(_muzzleFlashLight);
      _muzzleFlashLight.dispose();
      _muzzleFlashLight = null;
    }
    _muzzleFlashTimer = 0;
    // Clean up MG strobe light
    if (_mgStrobeLight) {
      if (_scene) _scene.remove(_mgStrobeLight);
      _mgStrobeLight.dispose();
      _mgStrobeLight = null;
    }
    _mgStrobeTimer = 0;
    // Clean up shell trails
    for (var ti = 0; ti < shellTrails.length; ti++) {
      shellTrails[ti].line.geometry.dispose();
      shellTrails[ti].line.material.dispose();
      if (_scene) _scene.remove(shellTrails[ti].line);
    }
    shellTrails.length = 0;
    // Clean up tread marks
    for (var tri = 0; tri < treadMarks.length; tri++) {
      treadMarks[tri].mesh.material.dispose();
      if (_scene) _scene.remove(treadMarks[tri].mesh);
    }
    treadMarks.length = 0;
    if (_treadGeo) { _treadGeo.dispose(); _treadGeo = null; }
    _treadDistAccum = 0;
    // Clean up shockwave rings
    for (var sri = 0; sri < shockwaveRings.length; sri++) {
      shockwaveRings[sri].mesh.material.dispose();
      if (_scene) _scene.remove(shockwaveRings[sri].mesh);
    }
    shockwaveRings.length = 0;
    if (_shockwaveGeo) { _shockwaveGeo.dispose(); _shockwaveGeo = null; }
    // Clean up MG casings
    for (var csi = 0; csi < mgCasings.length; csi++) {
      if (_scene) _scene.remove(mgCasings[csi].mesh);
    }
    mgCasings.length = 0;
    if (_casingGeo) { _casingGeo.dispose(); _casingGeo = null; }
    if (_casingMat) { _casingMat.dispose(); _casingMat = null; }
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
    // Tank System
    fireTankCannon: fireTankCannon,
    fireTankMG: fireTankMG,
    getTankAmmo: getTankAmmo,
    isTankReloading: isTankReloading,
    getTankReloadProgress: getTankReloadProgress,
  };
})();
