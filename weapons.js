/**
 * weapons.js – 16-weapon Ukrainian war arsenal with melee, projectiles, grenades, fire & scope zoom
 * Switch with keys 1-0, Q/E scroll. Weapons 0 (shovel) and 1 (pistol) start unlocked.
 * Depends on: Three.js global (THREE), HUD, VoxelWorld, Enemies
 */

const Weapons = (() => {
  // ── Weapon definitions ────────────────────────────────────
  const WEAPONS = [
    {
      id: 'SHOVEL', name: 'Army Shovel (МПЛ-50)', damage: 35,
      fireRate: 0.4, clipSize: 0, maxReserve: 0, reloadTime: 0,
      spread: 0, auto: false, type: 'MELEE',
    },
    {
      id: 'MAKAROV', name: 'Makarov PM', damage: 15,
      fireRate: 0.15, clipSize: 8, maxReserve: 40, reloadTime: 1.5,
      spread: 0.03, auto: false, type: 'PISTOL',
    },
    {
      id: 'AK74', name: 'AK-74M', damage: 28,
      fireRate: 0.10, clipSize: 30, maxReserve: 120, reloadTime: 2.2,
      spread: 0.022, auto: true, type: 'ASSAULT',
    },
    {
      id: 'RPK74', name: 'RPK-74', damage: 22,
      fireRate: 0.08, clipSize: 45, maxReserve: 180, reloadTime: 3.5,
      spread: 0.035, auto: true, type: 'LMG',
    },
    {
      id: 'SVD', name: 'SVD Dragunov', damage: 115,
      fireRate: 0.85, clipSize: 10, maxReserve: 40, reloadTime: 3.5,
      spread: 0.004, auto: false, type: 'SNIPER', hasScope: true,
    },
    {
      id: 'PKM', name: 'PKM', damage: 18,
      fireRate: 0.07, clipSize: 100, maxReserve: 250, reloadTime: 4.5,
      spread: 0.048, auto: true, type: 'HMG',
    },
    {
      id: 'NLAW', name: 'NLAW', damage: 500,
      fireRate: 2.0, clipSize: 1, maxReserve: 3, reloadTime: 4.0,
      spread: 0, auto: false, type: 'AT', blastRadius: 4,
    },
    {
      id: 'STUGNA', name: 'Stugna-P', damage: 800,
      fireRate: 3.0, clipSize: 1, maxReserve: 2, reloadTime: 5.0,
      spread: 0, auto: false, type: 'ATGM', hasScope: true, blastRadius: 5,
    },
    {
      id: 'M4A1', name: 'M4A1', damage: 30,
      fireRate: 0.09, clipSize: 30, maxReserve: 120, reloadTime: 2.0,
      spread: 0.018, auto: true, type: 'NATO',
    },
    {
      id: 'JAVELIN', name: 'FGM-148 Javelin', damage: 1200,
      fireRate: 4.0, clipSize: 1, maxReserve: 2, reloadTime: 6.0,
      spread: 0, auto: false, type: 'AT_HEAVY', hasScope: true, blastRadius: 6,
    },
    {
      id: 'RPG7', name: 'RPG-7', damage: 350,
      fireRate: 2.5, clipSize: 1, maxReserve: 4, reloadTime: 3.5,
      spread: 0.01, auto: false, type: 'AT_LIGHT', blastRadius: 3.5,
    },
    {
      id: 'IGLA', name: 'Igla MANPADS', damage: 600,
      fireRate: 3.5, clipSize: 1, maxReserve: 2, reloadTime: 5.0,
      spread: 0, auto: false, type: 'AA', blastRadius: 4,
    },
    {
      id: 'GP25', name: 'GP-25 Grenade Launcher', damage: 150,
      fireRate: 1.5, clipSize: 1, maxReserve: 8, reloadTime: 2.5,
      spread: 0.015, auto: false, type: 'GRENADE', blastRadius: 3,
    },
    {
      id: 'SCARH', name: 'FN SCAR-H', damage: 35,
      fireRate: 0.085, clipSize: 20, maxReserve: 100, reloadTime: 2.3,
      spread: 0.016, auto: true, type: 'NATO_HEAVY',
    },
    {
      id: 'DSHK', name: 'DShK', damage: 45,
      fireRate: 0.10, clipSize: 50, maxReserve: 150, reloadTime: 5.0,
      spread: 0.05, auto: true, type: 'HMG_HEAVY',
    },
    {
      id: 'MOLOTOV', name: 'Molotov Cocktail', damage: 80,
      fireRate: 1.0, clipSize: 1, maxReserve: 5, reloadTime: 0.5,
      spread: 0.02, auto: false, type: 'INCENDIARY', blastRadius: 3,
    },
  ];

  // ── Per-weapon mutable state ───────────────────────────────
  function makeState(cfg) {
    return {
      clip: cfg.clipSize, reserve: cfg.maxReserve,
      reloading: false, reloadTimer: 0, fireCooldown: 0,
    };
  }
  let states     = WEAPONS.map(makeState);
  let currentIdx = 0;
  let unlocked   = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];

  function cur()      { return WEAPONS[currentIdx]; }
  function curState() { return states[currentIdx]; }

  // ── Scope zoom state ──────────────────────────────────────
  let _camera      = null;
  let _scene       = null;
  let zoomed       = false;
  let rightMouseDown = false;
  const FOV_DEFAULT = 75;
  const FOV_ZOOMED  = 25;

  // ── Gun meshes ────────────────────────────────────────────
  const gunMeshes = [];

  function buildShovelMesh() {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.40, 0.025),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
    );
    handle.position.set(0.18, -0.22, -0.25);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.12, 0.015),
      new THREE.MeshLambertMaterial({ color: 0x666666 })
    );
    blade.position.set(0.18, -0.43, -0.27);
    blade.rotation.x = -0.2;
    g.add(handle, blade);
    return g;
  }

  function buildMakarovMesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.025, 0.14),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.18, -0.14, -0.32);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.05, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    body.position.set(0.18, -0.145, -0.24);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.07, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x1a1a0a })
    );
    grip.position.set(0.18, -0.20, -0.20);
    g.add(barrel, body, grip);
    return g;
  }

  function buildAkMesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.40),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    barrel.position.set(0.18, -0.14, -0.41);
    const brake = new THREE.Mesh(
      new THREE.BoxGeometry(0.054, 0.054, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    brake.position.set(0.18, -0.14, -0.63);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.08, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x443a28 })
    );
    body.position.set(0.18, -0.15, -0.24);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.13, 0.065),
      new THREE.MeshLambertMaterial({ color: 0x2a2218 })
    );
    mag.position.set(0.18, -0.25, -0.22);
    mag.rotation.x = 0.15;
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.10, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x221a0a })
    );
    grip.position.set(0.18, -0.22, -0.17);
    g.add(barrel, brake, body, mag, grip);
    return g;
  }

  function buildRpkMesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.52),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    barrel.position.set(0.18, -0.14, -0.48);
    const brake = new THREE.Mesh(
      new THREE.BoxGeometry(0.054, 0.054, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    brake.position.set(0.18, -0.14, -0.76);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.08, 0.28),
      new THREE.MeshLambertMaterial({ color: 0x443a28 })
    );
    body.position.set(0.18, -0.15, -0.24);
    // Drum magazine
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.065, 12),
      new THREE.MeshLambertMaterial({ color: 0x2a2218 })
    );
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0.18, -0.22, -0.24);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.10, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x221a0a })
    );
    grip.position.set(0.18, -0.22, -0.17);
    g.add(barrel, brake, body, drum, grip);
    return g;
  }

  function buildSvdMesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.028, 0.60),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.17, -0.13, -0.56);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.07, 0.28),
      new THREE.MeshLambertMaterial({ color: 0x3a2a18 })
    );
    body.position.set(0.17, -0.145, -0.22);
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.24, 8),
      new THREE.MeshLambertMaterial({ color: 0x181818 })
    );
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0.17, -0.085, -0.28);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.10, 0.052),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    mag.position.set(0.17, -0.22, -0.22);
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.055, 0.14),
      new THREE.MeshLambertMaterial({ color: 0x3a2a18 })
    );
    stock.position.set(0.17, -0.155, -0.06);
    g.add(barrel, body, scope, mag, stock);
    return g;
  }

  function buildPkmMesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.048, 0.65),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.17, -0.13, -0.54);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.10, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x3a3a28 })
    );
    body.position.set(0.17, -0.14, -0.22);
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.072, 12),
      new THREE.MeshLambertMaterial({ color: 0x2a2a18 })
    );
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0.17, -0.21, -0.22);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.10, 0.056),
      new THREE.MeshLambertMaterial({ color: 0x1a1a0a })
    );
    grip.position.set(0.17, -0.22, -0.16);
    const bipL = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.14, 0.012),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    bipL.position.set(0.14, -0.18, -0.48);
    bipL.rotation.z = 0.25;
    const bipR = bipL.clone();
    bipR.position.set(0.20, -0.18, -0.48);
    bipR.rotation.z = -0.25;
    g.add(barrel, body, drum, grip, bipL, bipR);
    return g;
  }

  function buildNlawMesh() {
    const g = new THREE.Group();
    // Launch tube
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.55, 10),
      new THREE.MeshLambertMaterial({ color: 0x3a5a2a })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.17, -0.12, -0.38);
    // Front sight
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.06, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x2a3a1a })
    );
    front.position.set(0.17, -0.07, -0.58);
    // Grip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.09, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    grip.position.set(0.17, -0.20, -0.25);
    g.add(tube, front, grip);
    return g;
  }

  function buildStugnaMesh() {
    const g = new THREE.Group();
    // Launch tube
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.45, 10),
      new THREE.MeshLambertMaterial({ color: 0x3a4a2a })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.17, -0.10, -0.38);
    // Scope housing
    const scopeBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.10),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    scopeBox.position.set(0.17, -0.05, -0.30);
    // Tripod legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const legGeo = new THREE.BoxGeometry(0.012, 0.18, 0.012);
    const l1 = new THREE.Mesh(legGeo, legMat);
    l1.position.set(0.12, -0.22, -0.42); l1.rotation.z = 0.3;
    const l2 = new THREE.Mesh(legGeo, legMat);
    l2.position.set(0.22, -0.22, -0.42); l2.rotation.z = -0.3;
    const l3 = new THREE.Mesh(legGeo, legMat);
    l3.position.set(0.17, -0.22, -0.32); l3.rotation.x = -0.3;
    g.add(tube, scopeBox, l1, l2, l3);
    return g;
  }

  function buildM4Mesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.035, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.18, -0.14, -0.42);
    // Rail system on top
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.018, 0.30),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    rail.position.set(0.18, -0.10, -0.36);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.07, 0.22),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a })
    );
    body.position.set(0.18, -0.15, -0.22);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.12, 0.055),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    mag.position.set(0.18, -0.24, -0.22);
    mag.rotation.x = 0.08;
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    stock.position.set(0.18, -0.15, -0.08);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.09, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    grip.position.set(0.18, -0.22, -0.17);
    g.add(barrel, rail, body, mag, stock, grip);
    return g;
  }

  function buildJavelinMesh() {
    const g = new THREE.Group();
    // CLU (Command Launch Unit) housing
    const clu = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.10, 0.20),
      new THREE.MeshLambertMaterial({ color: 0x4a5a3a })
    );
    clu.position.set(0.17, -0.12, -0.28);
    // Launch tube
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.55, 10),
      new THREE.MeshLambertMaterial({ color: 0x5a6a4a })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.17, -0.08, -0.42);
    // Scope/seeker housing
    const scope = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.07, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    scope.position.set(0.17, -0.02, -0.32);
    // Grip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.10, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    grip.position.set(0.17, -0.22, -0.20);
    // Shoulder rest
    const rest = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.06, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x3a4a2a })
    );
    rest.position.set(0.17, -0.14, -0.10);
    g.add(clu, tube, scope, grip, rest);
    return g;
  }

  function buildRpg7Mesh() {
    const g = new THREE.Group();
    // Main tube
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.035, 0.70, 8),
      new THREE.MeshLambertMaterial({ color: 0x4a5a3a })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.17, -0.12, -0.40);
    // Warhead (front cone)
    const warhead = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.15, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a3a2a })
    );
    warhead.rotation.x = -Math.PI / 2;
    warhead.position.set(0.17, -0.12, -0.80);
    // Rear flare (exhaust bell)
    const flare = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.08, 8),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    flare.rotation.x = Math.PI / 2;
    flare.position.set(0.17, -0.12, -0.02);
    // Grip + trigger guard
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.10, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a })
    );
    grip.position.set(0.17, -0.22, -0.30);
    // Heat shield
    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.02, 0.15),
      new THREE.MeshLambertMaterial({ color: 0x4a4a3a })
    );
    shield.position.set(0.17, -0.08, -0.40);
    g.add(tube, warhead, flare, grip, shield);
    return g;
  }

  function buildIglaMesh() {
    const g = new THREE.Group();
    // Main tube (olive green, longer than NLAW)
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.65, 10),
      new THREE.MeshLambertMaterial({ color: 0x5a6a4a })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.17, -0.10, -0.44);
    // Seeker unit (front cap)
    const seeker = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    seeker.rotation.x = -Math.PI / 2;
    seeker.position.set(0.17, -0.10, -0.78);
    // Grip mechanism (trigger assembly)
    const gripAssembly = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.12, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    gripAssembly.position.set(0.17, -0.20, -0.30);
    // Battery unit
    const battery = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    battery.position.set(0.17, -0.26, -0.30);
    g.add(tube, seeker, gripAssembly, battery);
    return g;
  }

  function buildGp25Mesh() {
    const g = new THREE.Group();
    // Grenade launcher barrel (stubby, wide bore)
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.28, 10),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.17, -0.16, -0.38);
    // Breech block
    const breech = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.10),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    breech.position.set(0.17, -0.16, -0.20);
    // Trigger guard / grip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.08, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x2a1a0a })
    );
    grip.position.set(0.17, -0.23, -0.22);
    // Sight (leaf sight)
    const sight = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.06, 0.015),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    sight.position.set(0.17, -0.10, -0.35);
    g.add(barrel, breech, grip, sight);
    return g;
  }

  function buildScarHMesh() {
    const g = new THREE.Group();
    // Barrel with integrated suppressor look
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.038, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x3a3a28 })
    );
    barrel.position.set(0.18, -0.14, -0.42);
    // Picatinny rail
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.015, 0.28),
      new THREE.MeshLambertMaterial({ color: 0x4a4a3a })
    );
    rail.position.set(0.18, -0.10, -0.35);
    // Receiver body (FDE tan color)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.075, 0.24),
      new THREE.MeshLambertMaterial({ color: 0x8a7a5a })
    );
    body.position.set(0.18, -0.15, -0.22);
    // Magazine
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.11, 0.058),
      new THREE.MeshLambertMaterial({ color: 0x3a3a2a })
    );
    mag.position.set(0.18, -0.24, -0.22);
    mag.rotation.x = 0.06;
    // Folding stock
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.05, 0.14),
      new THREE.MeshLambertMaterial({ color: 0x8a7a5a })
    );
    stock.position.set(0.18, -0.15, -0.06);
    // Grip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.09, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    grip.position.set(0.18, -0.22, -0.17);
    g.add(barrel, rail, body, mag, stock, grip);
    return g;
  }

  function buildDshkMesh() {
    const g = new THREE.Group();
    // Heavy barrel
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.70),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.17, -0.12, -0.55);
    // Flash hider
    const flash = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    flash.position.set(0.17, -0.12, -0.93);
    // Receiver
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.30),
      new THREE.MeshLambertMaterial({ color: 0x3a3a28 })
    );
    body.position.set(0.17, -0.13, -0.22);
    // Belt-fed ammo box
    const ammoBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.10, 0.10),
      new THREE.MeshLambertMaterial({ color: 0x4a4a2a })
    );
    ammoBox.position.set(0.24, -0.18, -0.22);
    // Spade grips (butterfly triggers)
    const gripL = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.10, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    gripL.position.set(0.12, -0.22, -0.10);
    const gripR = gripL.clone();
    gripR.position.set(0.22, -0.22, -0.10);
    g.add(barrel, flash, body, ammoBox, gripL, gripR);
    return g;
  }

  function buildMolotovMesh() {
    const g = new THREE.Group();
    // Bottle body
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.035, 0.18, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a5a1a, transparent: true, opacity: 0.7 })
    );
    bottle.position.set(0.18, -0.16, -0.26);
    // Bottle neck
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.06, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a5a1a, transparent: true, opacity: 0.7 })
    );
    neck.position.set(0.18, -0.05, -0.26);
    // Rag / wick (sticking out the top)
    const rag = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.06, 0.02),
      new THREE.MeshLambertMaterial({ color: 0x8a6a3a })
    );
    rag.position.set(0.18, -0.01, -0.26);
    // Flame on wick
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.04, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6600 })
    );
    flame.position.set(0.18, 0.03, -0.26);
    // Liquid inside (visible through glass)
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.030, 0.12, 8),
      new THREE.MeshBasicMaterial({ color: 0xcc6600, transparent: true, opacity: 0.5 })
    );
    liquid.position.set(0.18, -0.18, -0.26);
    g.add(bottle, neck, rag, flame, liquid);
    return g;
  }

  const meshBuilders = [
    buildShovelMesh, buildMakarovMesh, buildAkMesh, buildRpkMesh,
    buildSvdMesh, buildPkmMesh, buildNlawMesh, buildStugnaMesh, buildM4Mesh,
    buildJavelinMesh, buildRpg7Mesh, buildIglaMesh, buildGp25Mesh,
    buildScarHMesh, buildDshkMesh, buildMolotovMesh,
  ];

  function createGunMesh(camera) {
    _camera = camera;
    for (let i = 0; i < WEAPONS.length; i++) {
      const m = meshBuilders[i]();
      gunMeshes.push(m);
      m.visible = (i === currentIdx);
      camera.add(m);
    }
  }

  // ── Muzzle flash ──────────────────────────────────────────
  let muzzleFlash = null;
  let muzzleTimer = 0;

  function createMuzzleFlash(scene, camera) {
    _scene = scene;
    _camera = camera;
    const geo = new THREE.PlaneGeometry(0.3, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      color:       0xffdd44,
      transparent: true,
      opacity:     0,
      depthTest:   false,
      blending:    THREE.AdditiveBlending,
    });
    muzzleFlash = new THREE.Mesh(geo, mat);
    muzzleFlash.position.set(0.17, -0.11, -0.60);
    camera.add(muzzleFlash);
    scene.add(camera);
  }

  function showMuzzle() {
    if (!muzzleFlash) return;
    muzzleFlash.material.opacity = 1;
    muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    muzzleTimer = 0.06;
  }

  // ── Recoil / reload animation state ───────────────────────
  let recoilOffset = 0;
  let reloadAnimAngle = 0;

  // ── Weapon switching ──────────────────────────────────────
  function switchTo(idx) {
    if (idx < 0 || idx >= WEAPONS.length) return;
    if (!unlocked[idx]) return;
    if (zoomed) exitZoom();
    if (gunMeshes[currentIdx]) gunMeshes[currentIdx].visible = false;
    currentIdx = idx;
    if (gunMeshes[currentIdx]) gunMeshes[currentIdx].visible = true;
    recoilOffset = 0;
    reloadAnimAngle = 0;
    const st = curState();
    HUD.setWeapon(cur().name, currentIdx);
    if (cur().type === 'MELEE') {
      HUD.setAmmo('∞', '—');
    } else {
      HUD.setAmmo(st.clip, st.reserve);
    }
    HUD.showReload(st.reloading);
  }

  function switchNext() {
    const ids = [];
    for (let i = 0; i < WEAPONS.length; i++) { if (unlocked[i]) ids.push(i); }
    if (ids.length <= 1) return;
    const ci = ids.indexOf(currentIdx);
    switchTo(ids[(ci + 1) % ids.length]);
  }

  function switchPrev() {
    const ids = [];
    for (let i = 0; i < WEAPONS.length; i++) { if (unlocked[i]) ids.push(i); }
    if (ids.length <= 1) return;
    const ci = ids.indexOf(currentIdx);
    switchTo(ids[(ci - 1 + ids.length) % ids.length]);
  }

  function unlockWeapon(idx) {
    if (idx >= 0 && idx < WEAPONS.length) unlocked[idx] = true;
  }

  // ── Scope zoom ────────────────────────────────────────────
  function enterZoom() {
    if (!_camera || !cur().hasScope) return;
    zoomed = true;
    _camera.fov = FOV_ZOOMED;
    _camera.updateProjectionMatrix();
  }

  function exitZoom() {
    if (!_camera) return;
    zoomed = false;
    _camera.fov = FOV_DEFAULT;
    _camera.updateProjectionMatrix();
  }

  function handleRightDown() {
    rightMouseDown = true;
    if (cur().hasScope) enterZoom();
  }

  function handleRightUp() {
    rightMouseDown = false;
    if (zoomed) exitZoom();
  }

  // ── Projectile system (NLAW / Stugna) ────────────────────
  const projectiles = [];
  const PROJ_SPEED = 30;

  function spawnProjectile(camera, wep) {
    if (!_scene) return;
    const isGrenade = wep.type === 'GRENADE';
    const isMolotov = wep.type === 'INCENDIARY';
    const projColor = isMolotov ? 0xff4400 : isGrenade ? 0x555544 : 0xffaa22;
    const projSize = isMolotov ? [0.06, 0.06, 0.12] : isGrenade ? [0.05, 0.05, 0.10] : [0.08, 0.08, 0.25];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(projSize[0], projSize[1], projSize[2]),
      new THREE.MeshBasicMaterial({ color: projColor })
    );
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(camera.quaternion);
    // Grenades and molotovs have upward arc
    if (isGrenade || isMolotov) dir.y += 0.3;
    dir.normalize();
    const pos = camera.getWorldPosition(new THREE.Vector3());
    mesh.position.copy(pos).addScaledVector(dir, 1.0);
    mesh.lookAt(pos.clone().addScaledVector(dir, 2));
    _scene.add(mesh);
    const speed = (isGrenade || isMolotov) ? 18 : PROJ_SPEED;
    projectiles.push({
      mesh, dir: dir.clone(), speed: speed,
      damage: wep.damage, radius: wep.blastRadius || 4,
      life: 5.0,
      gravity: (isGrenade || isMolotov) ? 12 : 0,
      isMolotov: isMolotov,
    });
  }

  function updateProjectiles(delta) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.mesh.position.addScaledVector(p.dir, p.speed * delta);
      // Apply gravity for arc projectiles (grenades, molotovs)
      if (p.gravity) {
        p.dir.y -= p.gravity * delta / p.speed;
        p.mesh.position.y -= p.gravity * delta * delta * 0.5;
      }
      p.life -= delta;

      // Check enemy collision
      let hit = false;
      const enemyMeshes = Enemies.getEnemyMeshes();
      const rc = new THREE.Raycaster(
        p.mesh.position.clone(),
        p.dir.clone(),
        0,
        p.speed * delta + 0.5
      );
      const hits = rc.intersectObjects(enemyMeshes, true);
      if (hits.length > 0) hit = true;

      // Check terrain collision via VoxelWorld
      if (!hit && typeof VoxelWorld !== 'undefined') {
        const fakeCamera = {
          position: p.mesh.position.clone(),
          getWorldDirection: function(v) { return v.copy(p.dir); },
        };
        const ray = VoxelWorld.raycastBlock(fakeCamera, p.speed * delta + 0.5);
        if (ray) hit = true;
      }

      if (hit || p.life <= 0) {
        // Explosion effect
        Enemies.damageInRadius(p.mesh.position, p.radius, p.damage);
        if (p.isMolotov) {
          createFireArea(p.mesh.position, p.radius);
        } else {
          createExplosionFlash(p.mesh.position);
        }
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        _scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }
  }

  function createExplosionFlash(pos) {
    if (!_scene) return;
    const flashGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos);
    _scene.add(flash);
    let t = 0.2;
    const fadeInterval = setInterval(function () {
      t -= 0.016;
      flash.material.opacity = Math.max(0, t / 0.2) * 0.9;
      flash.scale.setScalar(1 + (0.2 - t) * 5);
      if (t <= 0) {
        _scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
        clearInterval(fadeInterval);
      }
    }, 16);
  }

  function createFireArea(pos, radius) {
    if (!_scene) return;
    // Flat fire disc on the ground
    const fireGeo = new THREE.CylinderGeometry(radius, radius, 0.15, 12);
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const fire = new THREE.Mesh(fireGeo, fireMat);
    fire.position.copy(pos);
    fire.position.y += 0.1;
    _scene.add(fire);
    // Fire burns for 3 seconds, dealing damage over time
    let burnTime = 3.0;
    const burnInterval = setInterval(function () {
      burnTime -= 0.25;
      // Pulse the fire
      fire.material.opacity = 0.4 + Math.sin(burnTime * 6) * 0.3;
      fire.scale.setScalar(0.8 + Math.sin(burnTime * 4) * 0.2);
      // Damage enemies in area every 0.25s
      if (typeof Enemies !== 'undefined') {
        Enemies.damageInRadius(pos, radius, 15);
      }
      if (burnTime <= 0) {
        _scene.remove(fire);
        fireGeo.dispose();
        fireMat.dispose();
        clearInterval(burnInterval);
      }
    }, 250);
  }

  // ── Shovel swing animation state ──────────────────────────
  let swingTimer = 0;

  // ── Shooting / Melee ──────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const spreadVec = new THREE.Vector2();

  // Track whether a shot was actually fired this frame (for sound)
  let _firedThisFrame = false;

  function tryFire(camera, targets, delta, onHit, newPress) {
    const wep = cur();
    const st  = curState();
    _firedThisFrame = false;
    st.fireCooldown -= delta;
    if (st.reloading) return;
    if (st.fireCooldown > 0) return;
    if (!wep.auto && !newPress) return;
    st.fireCooldown = wep.fireRate;
    _firedThisFrame = true;

    // ── Melee: shovel ───────────────────────────────────
    if (wep.type === 'MELEE') {
      swingTimer = 0.2;
      raycaster.set(
        camera.getWorldPosition(new THREE.Vector3()),
        camera.getWorldDirection(new THREE.Vector3())
      );
      raycaster.far = 3;
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        onHit(hits[0], wep.damage);
      } else if (typeof VoxelWorld !== 'undefined') {
        // Dig terrain
        const ray = VoxelWorld.raycastBlock(camera, 3);
        if (ray) {
          VoxelWorld.setBlock(ray.hit.x, ray.hit.y, ray.hit.z, 0);
        }
      }
      return;
    }

    // ── Projectile weapons (AT/ATGM/AT_HEAVY/AT_LIGHT/AA/GRENADE/INCENDIARY) ──
    if (wep.type === 'AT' || wep.type === 'ATGM' || wep.type === 'AT_HEAVY' ||
        wep.type === 'AT_LIGHT' || wep.type === 'AA' || wep.type === 'GRENADE' ||
        wep.type === 'INCENDIARY') {
      if (st.clip <= 0) { startReload(); _firedThisFrame = false; return; }
      st.clip--;
      HUD.setAmmo(st.clip, st.reserve);
      showMuzzle();
      spawnProjectile(camera, wep);
      recoilOffset = 0.04;
      if (st.clip === 0 && st.reserve > 0) startReload();
      return;
    }

    // ── Standard hitscan fire ───────────────────────────
    if (st.clip <= 0) { startReload(); _firedThisFrame = false; return; }
    st.clip--;
    HUD.setAmmo(st.clip, st.reserve);

    spreadVec.set(
      (Math.random() - 0.5) * wep.spread * 2,
      (Math.random() - 0.5) * wep.spread * 2
    );
    raycaster.setFromCamera(spreadVec, camera);
    raycaster.far = Infinity;
    const hits = raycaster.intersectObjects(targets, true);
    showMuzzle();
    recoilOffset = 0.02;

    if (hits.length > 0) onHit(hits[0], wep.damage);
    if (st.clip === 0 && st.reserve > 0) startReload();
  }

  function startReload() {
    const wep = cur();
    const st  = curState();
    if (wep.type === 'MELEE') return;
    if (st.reloading || st.reserve <= 0 || st.clip === wep.clipSize) return;
    st.reloading   = true;
    st.reloadTimer = wep.reloadTime;
    reloadAnimAngle = 0;
    HUD.showReload(true);
  }

  // ── Per-frame update ──────────────────────────────────────
  function update(delta) {
    // Muzzle flash fade
    if (muzzleTimer > 0) {
      muzzleTimer -= delta;
      if (muzzleFlash) muzzleFlash.material.opacity = Math.max(0, muzzleTimer / 0.06);
    }

    // Projectiles
    updateProjectiles(delta);

    // Recoil recovery
    const mesh = gunMeshes[currentIdx];
    if (mesh) {
      if (recoilOffset > 0) {
        recoilOffset = Math.max(0, recoilOffset - delta * 0.3);
        mesh.position.z = recoilOffset;
      } else {
        mesh.position.z = 0;
      }
    }

    // Shovel swing animation
    if (swingTimer > 0 && mesh) {
      swingTimer -= delta;
      mesh.rotation.x = -Math.sin((0.2 - swingTimer) / 0.2 * Math.PI) * 0.8;
      if (swingTimer <= 0) mesh.rotation.x = 0;
    }

    // Reload
    const wep = cur();
    const st  = curState();
    if (st.reloading) {
      st.reloadTimer -= delta;
      // Reload animation: tilt down then back
      if (mesh) {
        const progress = 1 - st.reloadTimer / wep.reloadTime;
        if (progress < 0.5) {
          reloadAnimAngle = progress * 2 * (Math.PI / 12);
        } else {
          reloadAnimAngle = (1 - (progress - 0.5) * 2) * (Math.PI / 12);
        }
        mesh.rotation.x = reloadAnimAngle;
      }
      if (st.reloadTimer <= 0) {
        const need = wep.clipSize - st.clip;
        const fill = Math.min(need, st.reserve);
        st.clip    += fill;
        st.reserve -= fill;
        st.reloading = false;
        reloadAnimAngle = 0;
        if (mesh) mesh.rotation.x = 0;
        HUD.showReload(false);
        HUD.setAmmo(st.clip, st.reserve);
      }
    }
  }

  function reset() {
    states     = WEAPONS.map(makeState);
    currentIdx = 0;
    unlocked   = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];
    if (zoomed) exitZoom();
    recoilOffset = 0;
    reloadAnimAngle = 0;
    swingTimer = 0;
    // Remove lingering projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (_scene) _scene.remove(projectiles[i].mesh);
    }
    projectiles.length = 0;
    gunMeshes.forEach(function (m, i) { if (m) m.visible = (i === 0); });
    const st = curState();
    HUD.setAmmo('∞', '—');
    HUD.setWeapon(cur().name, 0);
  }

  function addAmmo(amount) {
    const wep = cur();
    const st  = curState();
    if (wep.type === 'MELEE') return;
    st.reserve = Math.min(wep.maxReserve, st.reserve + amount);
    HUD.setAmmo(st.clip, st.reserve);
  }

  function forceReload() { startReload(); }
  function isReloading() { return curState().reloading; }
  function getClip()     { return cur().type === 'MELEE' ? '∞' : curState().clip; }
  function getReserve()  { return cur().type === 'MELEE' ? '—' : curState().reserve; }
  function getDamage()   { return cur().damage; }
  function isZoomed()    { return zoomed; }
  function getWeaponName(idx) { return WEAPONS[idx] ? WEAPONS[idx].name : ''; }

  return {
    createGunMesh,
    createMuzzleFlash,
    tryFire,
    update,
    reset,
    addAmmo,
    forceReload,
    isReloading,
    getClip,
    getReserve,
    getDamage,
    switchTo,
    switchNext,
    switchPrev,
    unlockWeapon,
    handleRightDown,
    handleRightUp,
    exitZoom,
    isZoomed,
    getWeaponCount: function () { return WEAPONS.length; },
    getCurrentIdx:  function () { return currentIdx; },
    getCurrentType: function () { return cur().type; },
    getCurrentId:   function () { return cur().id; },
    getCurrentName: function () { return cur().name; },
    getWeaponName:  getWeaponName,
    getWeaponInfo:  function (i) {
      if (!WEAPONS[i]) return null;
      const s = states[i];
      return { name: WEAPONS[i].name, damage: WEAPONS[i].damage, clip: s.clip, reserve: s.reserve, type: WEAPONS[i].type };
    },
    isUnlocked:     function (i) { return !!unlocked[i]; },
    didFire:        function () { return _firedThisFrame; },
  };
})();
