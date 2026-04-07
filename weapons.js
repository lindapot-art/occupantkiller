/**
 * weapons.js – 23-weapon Ukrainian war arsenal with melee, projectiles, grenades, fire & scope zoom
 * Switch with keys 1-0, Q/E scroll. Weapons 0 (shovel) and 1 (pistol) start unlocked.
 * Depends on: Three.js global (THREE), HUD, VoxelWorld, Enemies
 */

const Weapons = (() => {
  // ── Weapon definitions ────────────────────────────────────
  const WEAPONS = [
    {
      id: 'SHOVEL', name: 'Army Shovel (МПЛ-50)', damage: 35,
      fireRate: 0.25, clipSize: 0, maxReserve: 0, reloadTime: 0,
      spread: 0, auto: true, type: 'MELEE', recoilY: 0, recoilX: 0,
    },
    {
      id: 'MAKAROV', name: 'Makarov PM', damage: 18,
      fireRate: 0.12, clipSize: 8, maxReserve: 48, reloadTime: 1.0,
      spread: 0.02, auto: false, type: 'PISTOL', recoilY: 0.006, recoilX: 0.002,
      quickDraw: true,
    },
    {
      id: 'AK74', name: 'AK-74M', damage: 30,
      fireRate: 0.095, clipSize: 30, maxReserve: 150, reloadTime: 1.8,
      spread: 0.018, auto: true, type: 'ASSAULT', recoilY: 0.013, recoilX: 0.005,
    },
    {
      id: 'RPK74', name: 'RPK-74', damage: 22,
      fireRate: 0.08, clipSize: 45, maxReserve: 180, reloadTime: 3.5,
      spread: 0.035, auto: true, type: 'LMG', recoilY: 0.020, recoilX: 0.010,
    },
    {
      id: 'SVD', name: 'SVD Dragunov', damage: 115,
      fireRate: 0.85, clipSize: 10, maxReserve: 40, reloadTime: 3.5,
      spread: 0.004, auto: false, type: 'SNIPER', hasScope: true, recoilY: 0.040, recoilX: 0.010,
    },
    {
      id: 'PKM', name: 'PKM', damage: 18,
      fireRate: 0.07, clipSize: 100, maxReserve: 250, reloadTime: 4.5,
      spread: 0.048, auto: true, type: 'HMG', recoilY: 0.025, recoilX: 0.012,
    },
    {
      id: 'NLAW', name: 'NLAW', damage: 500,
      fireRate: 2.0, clipSize: 1, maxReserve: 3, reloadTime: 4.0,
      spread: 0, auto: false, type: 'AT', blastRadius: 4, recoilY: 0.060, recoilX: 0.020,
    },
    {
      id: 'STUGNA', name: 'Stugna-P', damage: 800,
      fireRate: 3.0, clipSize: 1, maxReserve: 2, reloadTime: 5.0,
      spread: 0, auto: false, type: 'ATGM', hasScope: true, blastRadius: 5, recoilY: 0.050, recoilX: 0.015,
    },
    {
      id: 'M4A1', name: 'M4A1', damage: 30,
      fireRate: 0.09, clipSize: 30, maxReserve: 120, reloadTime: 2.0,
      spread: 0.018, auto: true, type: 'NATO', recoilY: 0.013, recoilX: 0.005,
    },
    {
      id: 'JAVELIN', name: 'FGM-148 Javelin', damage: 1200,
      fireRate: 4.0, clipSize: 1, maxReserve: 2, reloadTime: 6.0,
      spread: 0, auto: false, type: 'AT_HEAVY', hasScope: true, blastRadius: 6, recoilY: 0.060, recoilX: 0.020,
    },
    {
      id: 'RPG7', name: 'RPG-7', damage: 350,
      fireRate: 2.5, clipSize: 1, maxReserve: 4, reloadTime: 3.5,
      spread: 0.01, auto: false, type: 'AT_LIGHT', blastRadius: 3.5, recoilY: 0.055, recoilX: 0.018,
    },
    {
      id: 'IGLA', name: 'Igla MANPADS', damage: 600,
      fireRate: 3.5, clipSize: 1, maxReserve: 2, reloadTime: 5.0,
      spread: 0, auto: false, type: 'AA', blastRadius: 4, recoilY: 0.050, recoilX: 0.015,
    },
    {
      id: 'GP25', name: 'GP-25 Grenade Launcher', damage: 150,
      fireRate: 1.5, clipSize: 1, maxReserve: 8, reloadTime: 2.5,
      spread: 0.015, auto: false, type: 'GRENADE', blastRadius: 3, recoilY: 0.035, recoilX: 0.012,
    },
    {
      id: 'SCARH', name: 'FN SCAR-H', damage: 35,
      fireRate: 0.085, clipSize: 20, maxReserve: 100, reloadTime: 2.3,
      spread: 0.016, auto: true, type: 'NATO_HEAVY', recoilY: 0.018, recoilX: 0.007,
    },
    {
      id: 'DSHK', name: 'DShK', damage: 45,
      fireRate: 0.10, clipSize: 50, maxReserve: 150, reloadTime: 5.0,
      spread: 0.05, auto: true, type: 'HMG_HEAVY', recoilY: 0.028, recoilX: 0.014,
    },
    {
      id: 'MOLOTOV', name: 'Molotov Cocktail', damage: 80,
      fireRate: 1.0, clipSize: 1, maxReserve: 5, reloadTime: 0.5,
      spread: 0.02, auto: false, type: 'INCENDIARY', blastRadius: 3, recoilY: 0.010, recoilX: 0.005,
    },
    // ── 7 new weapons ──────────────────────────────────────
    {
      id: 'MG3', name: 'MG3 Machine Gun', damage: 24,
      fireRate: 0.065, clipSize: 120, maxReserve: 360, reloadTime: 5.5,
      spread: 0.055, auto: true, type: 'MACHINEGUN', recoilY: 0.022, recoilX: 0.011,
    },
    {
      id: 'MP5', name: 'MP5 SMG', damage: 18,
      fireRate: 0.06, clipSize: 30, maxReserve: 150, reloadTime: 2.0,
      spread: 0.04, auto: true, type: 'SMG', recoilY: 0.010, recoilX: 0.005,
    },
    {
      id: 'BARRETTM82', name: 'Barrett M82', damage: 250,
      fireRate: 1.5, clipSize: 10, maxReserve: 30, reloadTime: 4.0,
      spread: 0.002, auto: false, type: 'AMR', hasScope: true, recoilY: 0.045, recoilX: 0.012,
    },
    {
      id: 'MINIGUN', name: 'M134 Minigun', damage: 12,
      fireRate: 0.02, clipSize: 500, maxReserve: 1000, reloadTime: 8.0,
      spread: 0.08, auto: true, type: 'MINIGUN', recoilY: 0.012, recoilX: 0.008,
    },
    {
      id: 'CROSSBOW', name: 'Tactical Crossbow', damage: 130,
      fireRate: 1.2, clipSize: 1, maxReserve: 15, reloadTime: 1.8,
      spread: 0.006, auto: false, type: 'SILENT', recoilY: 0, recoilX: 0,
    },
    {
      id: 'FLAMETHROWER', name: 'RPO-A Shmel', damage: 200,
      fireRate: 2.0, clipSize: 1, maxReserve: 3, reloadTime: 3.5,
      spread: 0.03, auto: false, type: 'THERMOBARIC', blastRadius: 5, recoilY: 0.060, recoilX: 0.020,
    },
    {
      id: 'DOUBLEBARREL', name: 'IZH-43 Shotgun', damage: 120,
      fireRate: 0.3, clipSize: 2, maxReserve: 24, reloadTime: 2.0,
      spread: 0.12, auto: false, type: 'SHOTGUN', recoilY: 0.035, recoilX: 0.015,
    },
    // ── 3 new special weapons ──────────────────────────────
    {
      id: 'CLAYMORE', name: 'M18 Claymore Mine', damage: 300,
      fireRate: 1.5, clipSize: 1, maxReserve: 3, reloadTime: 2.0,
      spread: 0, auto: false, type: 'MINE', blastRadius: 5, recoilY: 0, recoilX: 0,
    },
    {
      id: 'SMOKE', name: 'Smoke Grenade', damage: 0,
      fireRate: 1.0, clipSize: 1, maxReserve: 4, reloadTime: 1.5,
      spread: 0.02, auto: false, type: 'SMOKE', blastRadius: 6, recoilY: 0.005, recoilX: 0.002,
    },
    {
      id: 'FLASHBANG', name: 'M84 Flashbang', damage: 5,
      fireRate: 1.2, clipSize: 1, maxReserve: 3, reloadTime: 1.5,
      spread: 0.02, auto: false, type: 'FLASHBANG', blastRadius: 8, recoilY: 0.005, recoilX: 0.002,
    },
    // ── 10 new weapons (B16) ──────────────────────────────
    {
      id: 'AK12', name: 'AK-12', damage: 32,
      fireRate: 0.085, clipSize: 30, maxReserve: 150, reloadTime: 2.1,
      spread: 0.018, auto: true, type: 'ASSAULT', recoilY: 0.014, recoilX: 0.005,
    },
    {
      id: 'P90', name: 'FN P90', damage: 20,
      fireRate: 0.055, clipSize: 50, maxReserve: 200, reloadTime: 2.3,
      spread: 0.032, auto: true, type: 'SMG', recoilY: 0.009, recoilX: 0.004,
    },
    {
      id: 'AT4', name: 'AT4 Launcher', damage: 450,
      fireRate: 2.5, clipSize: 1, maxReserve: 3, reloadTime: 4.5,
      spread: 0.005, auto: false, type: 'AT_LIGHT', blastRadius: 4, recoilY: 0.055, recoilX: 0.018,
    },
    {
      id: 'GLOCK', name: 'Glock 17', damage: 17,
      fireRate: 0.10, clipSize: 17, maxReserve: 68, reloadTime: 1.3,
      spread: 0.025, auto: false, type: 'PISTOL', recoilY: 0.007, recoilX: 0.003,
    },
    {
      id: 'KS23', name: 'KS-23 Shotgun', damage: 180,
      fireRate: 0.8, clipSize: 3, maxReserve: 15, reloadTime: 3.0,
      spread: 0.10, auto: false, type: 'SHOTGUN', recoilY: 0.040, recoilX: 0.018,
    },
    {
      id: 'AGS17', name: 'AGS-17 Grenade MG', damage: 80,
      fireRate: 0.35, clipSize: 6, maxReserve: 30, reloadTime: 4.0,
      spread: 0.04, auto: false, type: 'GRENADE', blastRadius: 3.5, recoilY: 0.030, recoilX: 0.015,
    },
    {
      id: 'VSS', name: 'VSS Vintorez', damage: 42,
      fireRate: 0.12, clipSize: 20, maxReserve: 80, reloadTime: 2.5,
      spread: 0.010, auto: true, type: 'SILENT', hasScope: true, recoilY: 0.012, recoilX: 0.005,
    },
    {
      id: 'STINGER', name: 'FIM-92 Stinger', damage: 700,
      fireRate: 3.5, clipSize: 1, maxReserve: 2, reloadTime: 5.5,
      spread: 0, auto: false, type: 'AA', blastRadius: 5, recoilY: 0.050, recoilX: 0.015,
    },
    {
      id: 'THROWKNIFE', name: 'Throwing Knife', damage: 90,
      fireRate: 0.5, clipSize: 1, maxReserve: 8, reloadTime: 0.3,
      spread: 0.008, auto: false, type: 'SILENT', recoilY: 0, recoilX: 0,
    },
    {
      id: 'C4', name: 'C4 Explosive', damage: 500,
      fireRate: 1.5, clipSize: 1, maxReserve: 3, reloadTime: 2.0,
      spread: 0, auto: false, type: 'EXPLOSIVE', blastRadius: 7, recoilY: 0, recoilX: 0,
    },
  ];

  // ── Per-weapon mutable state ───────────────────────────────
  function makeState(cfg) {
    return {
      clip: cfg.clipSize, reserve: cfg.maxReserve,
      reloading: false, reloadTimer: 0, fireCooldown: 0,
      jammed: false, shotsSinceClean: 0,
    };
  }
  let states     = WEAPONS.map(makeState);
  let currentIdx = 0;
  // Only Shovel (0) + Makarov (1) start unlocked; rest earned via drops & stage clears
  let unlocked   = WEAPONS.map(function(_, i) { return i <= 1; });

  function cur()      { return WEAPONS[currentIdx]; }
  function curState() { return states[currentIdx]; }

  // ── Terrain dig callbacks ────────────────────────────────
  let _onTerrainDig = null;    // called when shovel mines a block
  let _onTerrainShot = null;   // called when bullet/explosion destroys a block

  function setOnTerrainDig(fn) { _onTerrainDig = fn; }
  function setOnTerrainShot(fn) { _onTerrainShot = fn; }

  // Helper: destroy a block and notify
  function destroyBlock(x, y, z, isShovel) {
    if (typeof VoxelWorld === 'undefined') return;
    var blockType = VoxelWorld.getBlock(x, y, z);
    if (!blockType || blockType === 0) return; // already air
    VoxelWorld.setBlock(x, y, z, 0);
    if (isShovel && _onTerrainDig) {
      _onTerrainDig(x, y, z, blockType);
    } else if (!isShovel && _onTerrainShot) {
      _onTerrainShot(x, y, z, blockType);
    }
  }

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
    // Wooden handle — tapered, longer
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.50, 8),
      new THREE.MeshLambertMaterial({ color: 0x6B4226 })
    );
    handle.position.set(0.18, -0.18, -0.25);
    g.add(handle);

    // Grip wrap (darker rubber/leather tape near top)
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.08, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a1a0a })
    );
    grip.position.set(0.18, 0.03, -0.25);
    g.add(grip);

    // T-handle crossbar at top
    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.06, 6),
      new THREE.MeshLambertMaterial({ color: 0x6B4226 })
    );
    crossbar.position.set(0.18, 0.07, -0.25);
    crossbar.rotation.z = Math.PI / 2;
    g.add(crossbar);

    // Steel blade — wider spade shape
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.14, 0.008),
      new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 60, specular: 0x555555 })
    );
    blade.position.set(0.18, -0.46, -0.27);
    blade.rotation.x = -0.25;
    g.add(blade);

    // Blade edge (sharpened lighter steel strip)
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.015, 0.009),
      new THREE.MeshPhongMaterial({ color: 0xbbbbbb, shininess: 90, specular: 0x999999 })
    );
    edge.position.set(0.18, -0.535, -0.28);
    edge.rotation.x = -0.25;
    g.add(edge);

    // Steel collar where blade meets handle
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8),
      new THREE.MeshLambertMaterial({ color: 0x555555 })
    );
    collar.position.set(0.18, -0.38, -0.26);
    g.add(collar);

    // Rivet dots on blade (2 rivets)
    for (let i = -1; i <= 1; i += 2) {
      const rivet = new THREE.Mesh(
        new THREE.SphereGeometry(0.005, 4, 4),
        new THREE.MeshLambertMaterial({ color: 0x444444 })
      );
      rivet.position.set(0.18 + i * 0.03, -0.41, -0.263);
      g.add(rivet);
    }

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

  function buildMg3Mesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.65),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.17, -0.12, -0.52);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.10, 0.30),
      new THREE.MeshLambertMaterial({ color: 0x3a3a28 })
    );
    body.position.set(0.17, -0.13, -0.22);
    const beltBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.10, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x4a4a2a })
    );
    beltBox.position.set(0.24, -0.18, -0.20);
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.05, 0.16),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
    );
    stock.position.set(0.17, -0.13, -0.02);
    const bipod1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.14, 0.012),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    bipod1.position.set(0.13, -0.22, -0.60);
    bipod1.rotation.z = 0.25;
    const bipod2 = bipod1.clone();
    bipod2.position.set(0.21, -0.22, -0.60);
    bipod2.rotation.z = -0.25;
    g.add(barrel, body, beltBox, stock, bipod1, bipod2);
    return g;
  }

  function buildMp5Mesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 0.22),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    barrel.position.set(0.18, -0.14, -0.38);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.07, 0.20),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    body.position.set(0.18, -0.14, -0.22);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.12, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    mag.position.set(0.18, -0.24, -0.22);
    mag.rotation.x = 0.08;
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.04, 0.10),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    stock.position.set(0.18, -0.14, -0.08);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.07, 0.035),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    grip.position.set(0.18, -0.22, -0.16);
    g.add(barrel, body, mag, stock, grip);
    return g;
  }

  function buildBarrettMesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.75),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.17, -0.12, -0.60);
    const brake = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    brake.position.set(0.17, -0.12, -1.00);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.12, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a })
    );
    body.position.set(0.17, -0.13, -0.24);
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.15, 8),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0.17, -0.04, -0.30);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.12, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    mag.position.set(0.17, -0.24, -0.22);
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.07, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a })
    );
    stock.position.set(0.17, -0.12, -0.02);
    g.add(barrel, brake, body, scope, mag, stock);
    return g;
  }

  function buildMinigunMesh() {
    const g = new THREE.Group();
    // 6 rotating barrels
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.50, 6),
        new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
      );
      b.rotation.x = Math.PI / 2;
      b.position.set(0.17 + Math.cos(a) * 0.04, -0.12 + Math.sin(a) * 0.04, -0.50);
      g.add(b);
    }
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.20, 10),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a })
    );
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0.17, -0.12, -0.22);
    const ammo = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.10, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x4a4a2a })
    );
    ammo.position.set(0.17, -0.26, -0.18);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.10, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    grip.position.set(0.17, -0.22, -0.08);
    g.add(housing, ammo, grip);
    return g;
  }

  function buildCrossbowMesh() {
    const g = new THREE.Group();
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a })
    );
    stock.position.set(0.17, -0.14, -0.30);
    const limb = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.02, 0.03),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    limb.position.set(0.17, -0.12, -0.48);
    const string = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.005, 0.005),
      new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
    );
    string.position.set(0.17, -0.12, -0.42);
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.08, 6),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0.17, -0.08, -0.30);
    g.add(stock, limb, string, scope);
    return g;
  }

  function buildFlamethrowerMesh() {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.55, 10),
      new THREE.MeshLambertMaterial({ color: 0x4a5a3a })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.17, -0.12, -0.40);
    const capFront = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x3a4a2a })
    );
    capFront.rotation.x = -Math.PI / 2;
    capFront.position.set(0.17, -0.12, -0.68);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.10, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    grip.position.set(0.17, -0.22, -0.25);
    const sight = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.04, 0.02),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    sight.position.set(0.17, -0.05, -0.50);
    g.add(tube, capFront, grip, sight);
    return g;
  }

  function buildDoubleBarrelMesh() {
    const g = new THREE.Group();
    const barrel1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel1.rotation.x = Math.PI / 2;
    barrel1.position.set(0.15, -0.12, -0.45);
    const barrel2 = barrel1.clone();
    barrel2.position.set(0.19, -0.12, -0.45);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, 0.15),
      new THREE.MeshLambertMaterial({ color: 0x3a3a28 })
    );
    body.position.set(0.17, -0.13, -0.18);
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.05, 0.20),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
    );
    stock.position.set(0.17, -0.14, -0.02);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.08, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a })
    );
    grip.position.set(0.17, -0.22, -0.14);
    g.add(barrel1, barrel2, body, stock, grip);
    return g;
  }

  // ── Claymore Mine mesh ──
  function buildClaymoreMesh() {
    const g = new THREE.Group();
    // Curved body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x4a5a3a })
    );
    body.position.set(0.17, -0.16, -0.22);
    // Legs
    const leg1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.06, 4),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    leg1.position.set(0.13, -0.20, -0.22);
    leg1.rotation.z = 0.3;
    const leg2 = leg1.clone();
    leg2.position.x = 0.21;
    leg2.rotation.z = -0.3;
    // "FRONT TOWARD ENEMY" label
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.10, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xcccc88 })
    );
    label.position.set(0.17, -0.155, -0.249);
    g.add(body, leg1, leg2, label);
    return g;
  }

  // ── Smoke Grenade mesh ──
  function buildSmokeMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.10, 8),
      new THREE.MeshLambertMaterial({ color: 0x556655 })
    );
    body.position.set(0.17, -0.14, -0.22);
    // Top cap
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.027, 0.027, 0.015, 8),
      new THREE.MeshLambertMaterial({ color: 0x777777 })
    );
    cap.position.set(0.17, -0.088, -0.22);
    // Spoon/lever
    const spoon = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.07, 0.015),
      new THREE.MeshLambertMaterial({ color: 0x888888 })
    );
    spoon.position.set(0.185, -0.12, -0.22);
    // Smoke band
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.02, 8),
      new THREE.MeshLambertMaterial({ color: 0x88aa88 })
    );
    band.position.set(0.17, -0.14, -0.22);
    g.add(body, cap, spoon, band);
    return g;
  }

  // ── Flashbang mesh ──
  function buildFlashbangMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.08, 8),
      new THREE.MeshPhongMaterial({ color: 0x444444, shininess: 60 })
    );
    body.position.set(0.17, -0.14, -0.22);
    // Blue band (flash indicator)
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.023, 0.023, 0.015, 8),
      new THREE.MeshLambertMaterial({ color: 0x3366cc })
    );
    band.position.set(0.17, -0.12, -0.22);
    // Fuze/cap
    const fuze = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.024, 0.02, 8),
      new THREE.MeshLambertMaterial({ color: 0x666666 })
    );
    fuze.position.set(0.17, -0.098, -0.22);
    // Pin ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.012, 0.003, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0xaaaa66 })
    );
    ring.position.set(0.19, -0.098, -0.22);
    ring.rotation.y = Math.PI / 2;
    g.add(body, band, fuze, ring);
    return g;
  }

  // ── AK-12 mesh ──
  function buildAk12Mesh() {
    const g = new THREE.Group();
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.05, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    receiver.position.set(0.17, -0.13, -0.30);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.28, 6),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.17, -0.115, -0.55);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.12, 0.035),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    mag.position.set(0.17, -0.20, -0.28);
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.04, 0.15),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    stock.position.set(0.17, -0.13, -0.08);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.012, 0.15),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    rail.position.set(0.17, -0.098, -0.35);
    g.add(receiver, barrel, mag, stock, rail);
    return g;
  }

  // ── P90 mesh ──
  function buildP90Mesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.08, 0.30),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a })
    );
    body.position.set(0.17, -0.13, -0.28);
    const topMag = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.02, 0.20),
      new THREE.MeshLambertMaterial({ color: 0x444422 })
    );
    topMag.position.set(0.17, -0.085, -0.28);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.17, -0.12, -0.46);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.05, 0.025),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    grip.position.set(0.17, -0.19, -0.22);
    g.add(body, topMag, barrel, grip);
    return g;
  }

  // ── AT4 mesh ──
  function buildAt4Mesh() {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8),
      new THREE.MeshLambertMaterial({ color: 0x556633 })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.17, -0.12, -0.32);
    const sight = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.04, 0.015),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    sight.position.set(0.17, -0.075, -0.25);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.05, 0.02),
      new THREE.MeshLambertMaterial({ color: 0x443322 })
    );
    grip.position.set(0.17, -0.17, -0.28);
    g.add(tube, sight, grip);
    return g;
  }

  // ── Glock mesh ──
  function buildGlockMesh() {
    const g = new THREE.Group();
    const slide = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.028, 0.14),
      new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 40 })
    );
    slide.position.set(0.17, -0.13, -0.24);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.04, 0.10),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    frame.position.set(0.17, -0.16, -0.22);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.05, 0.022),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    mag.position.set(0.17, -0.20, -0.22);
    g.add(slide, frame, mag);
    return g;
  }

  // ── KS-23 mesh ──
  function buildKs23Mesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.020, 0.45, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.17, -0.12, -0.38);
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.06, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
    );
    stock.position.set(0.17, -0.14, -0.06);
    const pump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.10, 6),
      new THREE.MeshLambertMaterial({ color: 0x443322 })
    );
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0.17, -0.15, -0.35);
    g.add(barrel, stock, pump);
    return g;
  }

  // ── AGS-17 mesh ──
  function buildAgs17Mesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.25),
      new THREE.MeshLambertMaterial({ color: 0x3a3a2a })
    );
    body.position.set(0.17, -0.13, -0.30);
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a2a1a })
    );
    drum.position.set(0.17, -0.10, -0.25);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.20, 6),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.17, -0.13, -0.50);
    const tripod1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.10, 4),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    tripod1.position.set(0.14, -0.20, -0.35);
    tripod1.rotation.z = 0.3;
    const tripod2 = tripod1.clone();
    tripod2.position.x = 0.20;
    tripod2.rotation.z = -0.3;
    g.add(body, drum, barrel, tripod1, tripod2);
    return g;
  }

  // ── VSS Vintorez mesh ──
  function buildVssMesh() {
    const g = new THREE.Group();
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.04, 0.28),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    receiver.position.set(0.17, -0.13, -0.30);
    const suppressor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0.17, -0.13, -0.52);
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.035, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a })
    );
    stock.position.set(0.17, -0.13, -0.10);
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.08, 6),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0.17, -0.09, -0.30);
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.08, 0.025),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    mag.position.set(0.17, -0.19, -0.26);
    g.add(receiver, suppressor, stock, scope, mag);
    return g;
  }

  // ── Stinger mesh ──
  function buildStingerMesh() {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.60, 8),
      new THREE.MeshLambertMaterial({ color: 0x556644 })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.17, -0.12, -0.35);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.06, 0.03),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    grip.position.set(0.17, -0.19, -0.25);
    const seeker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.06, 8),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    seeker.rotation.x = Math.PI / 2;
    seeker.position.set(0.17, -0.08, -0.20);
    g.add(tube, grip, seeker);
    return g;
  }

  // ── Throwing Knife mesh ──
  function buildThrowKnifeMesh() {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.003, 0.12),
      new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 80 })
    );
    blade.position.set(0.17, -0.13, -0.28);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6),
      new THREE.MeshLambertMaterial({ color: 0x2a1a0a })
    );
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.17, -0.13, -0.16);
    g.add(blade, handle);
    return g;
  }

  // ── C4 mesh ──
  function buildC4Mesh() {
    const g = new THREE.Group();
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x556644 })
    );
    block.position.set(0.17, -0.14, -0.24);
    const det = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.04, 6),
      new THREE.MeshLambertMaterial({ color: 0xcc2222 })
    );
    det.position.set(0.17, -0.115, -0.20);
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.002, 0.002, 0.06, 4),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    wire.position.set(0.19, -0.115, -0.22);
    wire.rotation.z = Math.PI / 4;
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.005, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    led.position.set(0.15, -0.115, -0.20);
    g.add(block, det, wire, led);
    return g;
  }

  const meshBuilders = [
    buildShovelMesh, buildMakarovMesh, buildAkMesh, buildRpkMesh,
    buildSvdMesh, buildPkmMesh, buildNlawMesh, buildStugnaMesh, buildM4Mesh,
    buildJavelinMesh, buildRpg7Mesh, buildIglaMesh, buildGp25Mesh,
    buildScarHMesh, buildDshkMesh, buildMolotovMesh,
    buildMg3Mesh, buildMp5Mesh, buildBarrettMesh, buildMinigunMesh,
    buildCrossbowMesh, buildFlamethrowerMesh, buildDoubleBarrelMesh,
    buildClaymoreMesh, buildSmokeMesh, buildFlashbangMesh,
    buildAk12Mesh, buildP90Mesh, buildAt4Mesh, buildGlockMesh,
    buildKs23Mesh, buildAgs17Mesh, buildVssMesh, buildStingerMesh,
    buildThrowKnifeMesh, buildC4Mesh,
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
  let _muzzleLight = null;

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

    // Dynamic point light for muzzle flash illumination
    _muzzleLight = new THREE.PointLight(0xff8833, 0, 8);
    _muzzleLight.position.set(0, -0.05, -0.7);
    camera.add(_muzzleLight);

    scene.add(camera);
  }

  function showMuzzle() {
    if (!muzzleFlash) return;
    muzzleFlash.material.opacity = 1;
    muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    muzzleTimer = 0.06;
    // Flash point light burst
    if (_muzzleLight) _muzzleLight.intensity = 2.5;
    // Shell casing eject for hitscan/shotgun weapons
    if (_camera && typeof Tracers !== 'undefined' && Tracers.spawnCasing) {
      Tracers.spawnCasing(_camera);
    }
  }

  // ── Recoil / reload animation state ───────────────────────
  let recoilOffset = 0;
  let recoilOffsetY = 0;
  let recoilOffsetZ = 0;
  let switchAnimTimer = 0;  // weapon switch bob animation
  const SWITCH_ANIM_DUR_DEFAULT = 0.22;
  const SWITCH_SPEED_BY_TYPE = {
    MELEE: 0.12, PISTOL: 0.16, SMG: 0.20, SILENT: 0.20,
    ASSAULT: 0.24, NATO: 0.24, SHOTGUN: 0.24,
    SNIPER: 0.35, AMR: 0.35,
    LMG: 0.40, HMG: 0.40, MACHINEGUN: 0.40, NATO_HEAVY: 0.35, HMG_HEAVY: 0.45,
    AT: 0.45, ATGM: 0.45, AT_HEAVY: 0.50, AT_LIGHT: 0.40, AA: 0.45,
    MINIGUN: 0.55, THERMOBARIC: 0.50,
    GRENADE: 0.18, SMOKE: 0.18, FLASHBANG: 0.18, MINE: 0.20,
    INCENDIARY: 0.22, EXPLOSIVE: 0.30
  };
  function getSwitchDur() {
    var w = cur();
    return SWITCH_SPEED_BY_TYPE[w.type] || SWITCH_ANIM_DUR_DEFAULT;
  }
  let walkSwayTime = 0;    // weapon walk sway accumulator
  let _playerSpeed = 0;    // fed from game-manager
  let _sprintLowerY = 0;     // current sprint lower offset (lerped)
  let _sprintLowerRotX = 0;  // current sprint tilt (lerped)
  let _sprintLowerZ = 0;     // current sprint forward offset (lerped)
  let _scopeSwayTime = 0;  // scope idle drift accumulator
  let _holdingBreath = false;
  let _inspectTimer = 0;   // weapon inspect animation timer
  const INSPECT_DUR = 1.8; // seconds for full inspect cycle
  let reloadAnimAngle = 0;

  // ── Recoil recovery (camera returns after spray) ──────────
  let _recoilPitchAccum = 0;
  let _recoilYawAccum = 0;
  let _lastFireTime = 0;
  const RECOIL_RECOVERY_DELAY = 0.12;
  const RECOIL_RECOVERY_RATE = 4;

  function applyLandingBob(intensity) {
    recoilOffsetY = -0.04 * intensity;
    recoilOffsetZ = -0.02 * intensity;
  }

  function applyRecoil() {
    const w = cur();
    if (!w.recoilY && !w.recoilX) return;
    const recoilMod = (typeof SkillSystem !== 'undefined' && typeof SkillSystem.getRecoilMod === 'function')
      ? SkillSystem.getRecoilMod() : 1.0;
    var appliedYaw = (Math.random() - 0.5) * w.recoilX * 2 * recoilMod;
    if (typeof CameraSystem !== 'undefined') {
      CameraSystem.setPitch(CameraSystem.getPitch() + w.recoilY * recoilMod);
      CameraSystem.setYaw(CameraSystem.getYaw() + appliedYaw);
    }
    // Track accumulated recoil for auto-recovery
    _recoilPitchAccum += w.recoilY * recoilMod;
    _recoilYawAccum += appliedYaw;
    _lastFireTime = performance.now() / 1000;
    // Scale visual kick with weapon recoil intensity
    const intensity = Math.min(1, (w.recoilY || 0) / 0.04);
    recoilOffsetZ = -0.02 - intensity * 0.04;
    recoilOffsetY = 0.01 + intensity * 0.02;
  }

  // ── Weapon switching ──────────────────────────────────────
  function switchTo(idx) {
    if (idx < 0 || idx >= WEAPONS.length) return;
    if (!unlocked[idx]) return;
    if (idx === currentIdx) return;
    if (zoomed) exitZoom();
    // Cancel reload on old weapon before switching
    var oldState = states[currentIdx];
    if (oldState && oldState.reloading) {
      oldState.reloading = false;
      oldState.reloadTimer = 0;
    }
    if (gunMeshes[currentIdx]) gunMeshes[currentIdx].visible = false;
    // Track weapon swap for CombatExtras quick-swap feature
    if (typeof CombatExtras !== 'undefined') {
      if (CombatExtras._trackWeaponSwap) CombatExtras._trackWeaponSwap(currentIdx);
      // Clear blind fire on weapon switch
      if (CombatExtras.isBlindFiring && CombatExtras.isBlindFiring()) CombatExtras.toggleBlindFire();
    }
    currentIdx = idx;
    if (gunMeshes[currentIdx]) gunMeshes[currentIdx].visible = true;
    recoilOffset = 0;
    recoilOffsetY = 0;
    recoilOffsetZ = 0;
    reloadAnimAngle = 0;
    switchAnimTimer = getSwitchDur(); // trigger bob-up animation (per-type speed)
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playWeaponSwitch) AudioSystem.playWeaponSwitch();
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
    const isSmoke = wep.type === 'SMOKE';
    const isFlash = wep.type === 'FLASHBANG';
    const projColor = isMolotov ? 0xff4400 : isGrenade ? 0x555544 : isSmoke ? 0x88aa88 : isFlash ? 0xffffcc : 0xffaa22;
    const projSize = isMolotov ? [0.06, 0.06, 0.12] : isGrenade ? [0.05, 0.05, 0.10] : [0.08, 0.08, 0.25];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(projSize[0], projSize[1], projSize[2]),
      new THREE.MeshBasicMaterial({ color: projColor })
    );
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(camera.quaternion);
    // Grenades, smoke, flashbangs have upward arc
    if (isGrenade || isMolotov || isSmoke || isFlash) dir.y += 0.3;
    dir.normalize();
    const pos = camera.getWorldPosition(_wTmp1);
    mesh.position.copy(pos).addScaledVector(dir, 1.0);
    _wTmp2.copy(pos).addScaledVector(dir, 2);
    mesh.lookAt(_wTmp2);
    _scene.add(mesh);
    const speed = (isGrenade || isMolotov || isSmoke || isFlash) ? 18 : PROJ_SPEED;
    projectiles.push({
      mesh, dir: dir.clone(), speed: speed,
      damage: wep.damage, radius: wep.blastRadius || 4,
      life: 5.0,
      gravity: (isGrenade || isMolotov || isSmoke || isFlash) ? 12 : 0,
      isMolotov: isMolotov,
      isSmoke: isSmoke,
      isFlash: isFlash,
      weaponType: wep.type,
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
        // Grenade bounce clank when close to ground
        if (!p._bounced && typeof VoxelWorld !== 'undefined') {
          var gndH = VoxelWorld.getTerrainHeight(p.mesh.position.x, p.mesh.position.z);
          if (p.mesh.position.y <= gndH + 0.5 && p.dir.y < 0) {
            p._bounced = true;
            if (typeof AudioSystem !== 'undefined') AudioSystem.playRicochet();
          }
        }
      }
      p.life -= delta;

      // Check enemy collision
      let hit = false;
      const enemyMeshes = Enemies.getEnemyMeshes();
      _projRaycaster.set(p.mesh.position, p.dir);
      _projRaycaster.near = 0;
      _projRaycaster.far = p.speed * delta + 0.5;
      const hits = _projRaycaster.intersectObjects(enemyMeshes, true);
      if (hits.length > 0) hit = true;

      // Check terrain collision via VoxelWorld
      if (!hit && typeof VoxelWorld !== 'undefined') {
        _wTmpFakePos.copy(p.mesh.position);
        const fakeCamera = {
          position: _wTmpFakePos,
          getWorldDirection: function(v) { return v.copy(p.dir); },
        };
        const ray = VoxelWorld.raycastBlock(fakeCamera, p.speed * delta + 0.5);
        if (ray) hit = true;
      }

      if (hit || p.life <= 0) {
        // Smoke grenade: spawn obscuring cloud instead of explosion
        if (p.isSmoke) {
          createSmokeCloud(p.mesh.position, p.radius);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          _scene.remove(p.mesh);
          projectiles.splice(i, 1);
          continue;
        }
        // Flashbang: screen flash + enemy stun
        if (p.isFlash) {
          triggerFlashbang(p.mesh.position, p.radius);
          p.mesh.geometry.dispose();
          p.mesh.material.dispose();
          _scene.remove(p.mesh);
          projectiles.splice(i, 1);
          continue;
        }
        // Explosion effect
        Enemies.damageInRadius(p.mesh.position, p.radius, p.damage);
        // Destroy terrain blocks in blast radius
        if (typeof VoxelWorld !== 'undefined') {
          const cx = Math.round(p.mesh.position.x);
          const cy = Math.round(p.mesh.position.y);
          const cz = Math.round(p.mesh.position.z);
          const blastR = Math.ceil(p.radius);
          for (let bx = -blastR; bx <= blastR; bx++) {
            for (let by = -blastR; by <= blastR; by++) {
              for (let bz = -blastR; bz <= blastR; bz++) {
                if (bx * bx + by * by + bz * bz <= blastR * blastR) {
                  destroyBlock(cx + bx, cy + by, cz + bz, false);
                }
              }
            }
          }
        }
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

  // ── Smoke Cloud ────────────────────────────────────────────
  const _smokeClouds = []; // active smoke zones for LOS checks

  function createSmokeCloud(pos, radius) {
    if (!_scene) return;
    // Visual: multiple translucent spheres
    const group = new THREE.Group();
    group.position.copy(pos);
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(radius * (0.5 + Math.random() * 0.5), 8, 6),
        new THREE.MeshBasicMaterial({
          color: 0xcccccc, transparent: true, opacity: 0.45,
          depthWrite: false,
        })
      );
      s.position.set(
        (Math.random() - 0.5) * radius * 0.6,
        Math.random() * radius * 0.4,
        (Math.random() - 0.5) * radius * 0.6
      );
      group.add(s);
    }
    _scene.add(group);
    const cloud = { group: group, pos: pos.clone(), radius: radius, life: 6.0 };
    _smokeClouds.push(cloud);
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playExplosion) AudioSystem.playExplosion();

    // Animate fade-out
    const fadeInt = setInterval(function () {
      cloud.life -= 0.1;
      // Drift upward slowly
      group.position.y += 0.02;
      // Expand slightly
      group.scale.setScalar(1 + (6.0 - cloud.life) * 0.05);
      // Fade in last 2 seconds
      if (cloud.life < 2.0) {
        group.children.forEach(function (c) {
          c.material.opacity = 0.45 * (cloud.life / 2.0);
        });
      }
      if (cloud.life <= 0) {
        group.children.forEach(function (c) { c.geometry.dispose(); c.material.dispose(); });
        _scene.remove(group);
        const idx = _smokeClouds.indexOf(cloud);
        if (idx >= 0) _smokeClouds.splice(idx, 1);
        clearInterval(fadeInt);
      }
    }, 100);
  }

  function isInSmoke(px, pz) {
    for (let i = 0; i < _smokeClouds.length; i++) {
      const c = _smokeClouds[i];
      const dx = px - c.pos.x, dz = pz - c.pos.z;
      if (dx * dx + dz * dz < c.radius * c.radius) return true;
    }
    return false;
  }

  // ── Flashbang Effect ────────────────────────────────────────
  function triggerFlashbang(pos, radius) {
    if (!_scene) return;
    // 1) Screen flash — player gets flashed if within radius
    var flashOverlay = document.getElementById('flashbang-overlay');
    if (flashOverlay && _camera) {
      var camPos = _camera.getWorldPosition(new THREE.Vector3());
      var dist = camPos.distanceTo(pos);
      if (dist < radius * 1.5) {
        var intensity = Math.max(0, 1 - dist / (radius * 1.5));
        flashOverlay.style.opacity = intensity;
        setTimeout(function () { flashOverlay.style.transition = 'opacity 2s'; flashOverlay.style.opacity = '0'; }, 100);
        setTimeout(function () { flashOverlay.style.transition = 'opacity 0.05s'; }, 2200);
      }
    }
    // 2) Stun enemies in radius
    if (typeof Enemies !== 'undefined' && Enemies.stunInRadius) {
      Enemies.stunInRadius(pos, radius, 3.0);
    }
    // 3) Audio
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playFlashbang) AudioSystem.playFlashbang();
    // 4) Bright flash light
    var flashLight = new THREE.PointLight(0xffffff, 8, radius * 3);
    flashLight.position.copy(pos);
    _scene.add(flashLight);
    setTimeout(function () { _scene.remove(flashLight); }, 200);
  }

  // ── Shovel swing animation state ──────────────────────────
  let swingTimer = 0;

  // ── Shooting / Melee ──────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const _projRaycaster = new THREE.Raycaster(); // hoisted for projectile collision checks
  const spreadVec = new THREE.Vector2();
  const _wTmp1 = new THREE.Vector3(); // reusable temp vectors for fire/projectile paths
  const _wTmp2 = new THREE.Vector3();
  const _wTmpFakePos = new THREE.Vector3();
  const _wTmp3 = new THREE.Vector3(); // bullet hole position
  const _wTmp4 = new THREE.Vector3(); // bullet hole normal
  const _wTmpSpark = new THREE.Vector3(); // ricochet spark position

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
    // Block firing when weapon is overheated
    if (typeof CombatExtras !== 'undefined' && CombatExtras.isOverheated()) return;
    st.fireCooldown = wep.fireRate;
    _firedThisFrame = true;

    // ── Weapon jamming system ────────────────────────────
    if (wep.type !== 'MELEE' && wep.type !== 'MINE' && wep.type !== 'SMOKE' && wep.type !== 'FLASHBANG') {
      st.shotsSinceClean++;
      // Jam chance increases with sustained fire (0.1% per shot after 60 shots)
      if (st.shotsSinceClean > 60 && Math.random() < (st.shotsSinceClean - 60) * 0.001) {
        st.jammed = true;
        _firedThisFrame = false;
        return;
      }
    }
    if (st.jammed) { _firedThisFrame = false; return; }

    applyRecoil();

    // ── Melee: shovel ───────────────────────────────────
    if (wep.type === 'MELEE') {
      swingTimer = 0.2;
      // Lunge when sprinting: extended range + bonus damage
      var meleeRange = 3;
      var meleeDmg = wep.damage;
      if (typeof GameManager !== 'undefined' && GameManager.isSprinting && GameManager.isSprinting()) {
        meleeRange = 5;
        meleeDmg = Math.round(wep.damage * 1.8);
        swingTimer = 0.3;
      }
      raycaster.set(
        camera.getWorldPosition(_wTmp1),
        camera.getWorldDirection(_wTmp2)
      );
      raycaster.far = meleeRange;
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        onHit(hits[0], meleeDmg);
      } else if (typeof VoxelWorld !== 'undefined') {
        // Dig terrain (shovel)
        const ray = VoxelWorld.raycastBlock(camera, meleeRange);
        if (ray) {
          destroyBlock(ray.hit.x, ray.hit.y, ray.hit.z, true);
        }
      }
      return;
    }

    // ── Mine: place claymore at feet ──────────────────────
    if (wep.type === 'MINE') {
      if (st.clip <= 0) { startReload(); _firedThisFrame = false; return; }
      st.clip--;
      HUD.setAmmo(st.clip, st.reserve);
      // Mine is placed as a projectile that lands and waits
      spawnProjectile(camera, wep);
      if (st.clip === 0 && st.reserve > 0) startReload();
      return;
    }

    // ── Smoke grenade: launch smoke projectile ────────────
    if (wep.type === 'SMOKE') {
      if (st.clip <= 0) { startReload(); _firedThisFrame = false; return; }
      st.clip--;
      HUD.setAmmo(st.clip, st.reserve);
      spawnProjectile(camera, wep);
      if (st.clip === 0 && st.reserve > 0) startReload();
      return;
    }

    // ── Flashbang: launch flash projectile ────────────────
    if (wep.type === 'FLASHBANG') {
      if (st.clip <= 0) { startReload(); _firedThisFrame = false; return; }
      st.clip--;
      HUD.setAmmo(st.clip, st.reserve);
      spawnProjectile(camera, wep);
      if (st.clip === 0 && st.reserve > 0) startReload();
      return;
    }

    // ── Projectile weapons (AT/ATGM/AT_HEAVY/AT_LIGHT/AA/GRENADE/INCENDIARY/THERMOBARIC/EXPLOSIVE) ──
    if (wep.type === 'AT' || wep.type === 'ATGM' || wep.type === 'AT_HEAVY' ||
        wep.type === 'AT_LIGHT' || wep.type === 'AA' || wep.type === 'GRENADE' ||
        wep.type === 'INCENDIARY' || wep.type === 'THERMOBARIC' || wep.type === 'EXPLOSIVE') {
      if (st.clip <= 0) { startReload(); _firedThisFrame = false; return; }
      st.clip--;
      HUD.setAmmo(st.clip, st.reserve);
      showMuzzle();
      spawnProjectile(camera, wep);
      recoilOffset = 0.04;
      if (st.clip === 0 && st.reserve > 0) startReload();
      return;
    }

    // ── Shotgun: multi-pellet hitscan (8 pellets per shot) ──
    if (wep.type === 'SHOTGUN') {
      if (st.clip <= 0) { startReload(); _firedThisFrame = false; return; }
      st.clip--;
      HUD.setAmmo(st.clip, st.reserve);
      showMuzzle();
      recoilOffset = 0.05;
      const pellets = 8;
      for (let p = 0; p < pellets; p++) {
        spreadVec.set(
          (Math.random() - 0.5) * wep.spread * 2,
          (Math.random() - 0.5) * wep.spread * 2
        );
        raycaster.setFromCamera(spreadVec, camera);
        raycaster.far = 25; // shotgun effective range
        const pelletHits = raycaster.intersectObjects(targets, true);
        if (pelletHits.length > 0) {
          onHit(pelletHits[0], Math.floor(wep.damage / pellets));
        } else if (typeof VoxelWorld !== 'undefined') {
          // Pellet missed — dig terrain using pellet's spread direction
          _wTmp1.copy(raycaster.ray.direction);
          var _pelletX = _wTmp1.x, _pelletY = _wTmp1.y, _pelletZ = _wTmp1.z;
          const pelletCam = {
            position: camera.position,
            getWorldDirection: function(v) { return v.set(_pelletX, _pelletY, _pelletZ); },
          };
          const pRay = VoxelWorld.raycastBlock(pelletCam, 25);
          if (pRay) destroyBlock(pRay.hit.x, pRay.hit.y, pRay.hit.z, false);
        }
      }
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

    if (hits.length > 0) {
      onHit(hits[0], wep.damage);
      // Bullet penetration for high-caliber weapons — hit 2nd target at reduced damage
      var penTypes = ['SNIPER', 'LMG', 'HMG', 'HMG_HEAVY', 'MINIGUN', 'AMR', 'MACHINEGUN'];
      if (penTypes.indexOf(wep.type) >= 0 && hits.length > 1) {
        // Find next hit that belongs to a different root enemy mesh
        var firstRoot = hits[0].object;
        while (firstRoot.parent && firstRoot.parent.type !== 'Scene') firstRoot = firstRoot.parent;
        for (var pi = 1; pi < hits.length; pi++) {
          var pRoot = hits[pi].object;
          while (pRoot.parent && pRoot.parent.type !== 'Scene') pRoot = pRoot.parent;
          if (pRoot !== firstRoot) {
            onHit(hits[pi], Math.round(wep.damage * 0.6));
            break;
          }
        }
      }
    } else if (typeof VoxelWorld !== 'undefined') {
      // Bullet missed enemies — dig terrain on impact using bullet's spread direction
      _wTmp1.copy(raycaster.ray.direction);
      var _bx = _wTmp1.x, _by = _wTmp1.y, _bz = _wTmp1.z;
      const bulletCam = {
        position: camera.position,
        getWorldDirection: function(v) { return v.set(_bx, _by, _bz); },
      };
      const bRay = VoxelWorld.raycastBlock(bulletCam, 80);
      if (bRay) {
        // Bullet hole decal on terrain
        if (typeof Tracers !== 'undefined' && Tracers.spawnBulletHole) {
          _wTmp3.set(bRay.hit.x + 0.5, bRay.hit.y + 0.5, bRay.hit.z + 0.5);
          _wTmp4.set(
            bRay.place.x - bRay.hit.x,
            bRay.place.y - bRay.hit.y,
            bRay.place.z - bRay.hit.z
          ).normalize();
          if (_wTmp4.lengthSq() > 0) {
            _wTmp3.addScaledVector(_wTmp4, 0.5);
            Tracers.spawnBulletHole(_wTmp3, _wTmp4);
          }
        }
        // Ricochet check on metal/reinforced surfaces
        if (typeof CombatExtras !== 'undefined') {
          var blockType = VoxelWorld.getBlock(bRay.hit.x, bRay.hit.y, bRay.hit.z);
          var ric = CombatExtras.calcRicochet(blockType, _wTmp1);
          if (ric) {
            if (typeof AudioSystem !== 'undefined') AudioSystem.playRicochet();
            if (typeof Tracers !== 'undefined') Tracers.spawnSparks(_wTmpSpark.set(bRay.hit.x, bRay.hit.y, bRay.hit.z));
          }
        }
        destroyBlock(bRay.hit.x, bRay.hit.y, bRay.hit.z, false);
      }
    }
    if (st.clip === 0 && st.reserve > 0) startReload();
  }

  function startReload() {
    const wep = cur();
    const st  = curState();
    if (wep.type === 'MELEE') return;
    if (st.reloading || st.clip === wep.clipSize) return;
    if (st.reserve <= 0) {
      // No ammo — dry fire click
      if (typeof AudioSystem !== 'undefined' && AudioSystem.playDryFire) AudioSystem.playDryFire();
      return;
    }
    st.reloading   = true;
    st.reloadTimer = wep.reloadTime;
    reloadAnimAngle = 0;
    HUD.showReload(true);
  }

  function cancelReload() {
    const st = curState();
    if (!st.reloading) return;
    st.reloading = false;
    st.reloadTimer = 0;
    reloadAnimAngle = 0;
    var mesh = gunMeshes[currentIdx];
    if (mesh) mesh.rotation.x = 0;
    HUD.showReload(false);
  }

  // ── Per-frame update ──────────────────────────────────────
  function update(delta) {
    // Muzzle flash fade
    if (muzzleTimer > 0) {
      muzzleTimer -= delta;
      if (muzzleFlash) muzzleFlash.material.opacity = Math.max(0, muzzleTimer / 0.06);
      if (_muzzleLight) _muzzleLight.intensity = Math.max(0, (muzzleTimer / 0.06) * 2.5);
    }

    // Projectiles
    updateProjectiles(delta);

    // Recoil recovery (visual gun kick)
    const mesh = gunMeshes[currentIdx];
    if (recoilOffsetZ < 0) recoilOffsetZ = Math.min(0, recoilOffsetZ + delta * 12 * 0.04);
    if (recoilOffsetY > 0) recoilOffsetY = Math.max(0, recoilOffsetY - delta * 12 * 0.02);
    if (recoilOffset > 0) recoilOffset = Math.max(0, recoilOffset - delta * 0.3);

    // Camera recoil recovery: pitch/yaw return after firing stops
    var timeSinceFire = (performance.now() / 1000) - _lastFireTime;
    if (timeSinceFire > RECOIL_RECOVERY_DELAY && _recoilPitchAccum > 0.001 && typeof CameraSystem !== 'undefined') {
      var recoveryAmt = RECOIL_RECOVERY_RATE * delta;
      var pitchRecover = Math.min(_recoilPitchAccum, recoveryAmt);
      CameraSystem.setPitch(CameraSystem.getPitch() - pitchRecover);
      _recoilPitchAccum = Math.max(0, _recoilPitchAccum - pitchRecover);
      // Yaw recovery (gentler, 60% rate)
      var yawRecover = Math.min(Math.abs(_recoilYawAccum), recoveryAmt * 0.6);
      CameraSystem.setYaw(CameraSystem.getYaw() - Math.sign(_recoilYawAccum) * yawRecover);
      _recoilYawAccum *= (1 - delta * 3);
      if (Math.abs(_recoilYawAccum) < 0.001) _recoilYawAccum = 0;
    }
    if (mesh) {
      // Weapon switch bob-up animation
      let switchY = 0;
      if (switchAnimTimer > 0) {
        switchAnimTimer -= delta;
        if (switchAnimTimer < 0) switchAnimTimer = 0;
        // Smooth ease-out: weapon rises from below
        const t = switchAnimTimer / getSwitchDur();
        switchY = -0.12 * t * t;
      }
      // Weapon walk sway (figure-8 pattern)
      let swayX = 0, swayY = 0;
      if (_playerSpeed > 0.5) {
        walkSwayTime += delta * 8;
        const swayAmt = zoomed ? 0.0008 : 0.003;
        swayX = Math.sin(walkSwayTime) * _playerSpeed * swayAmt;
        swayY = Math.sin(walkSwayTime * 2) * _playerSpeed * swayAmt * 0.6;
      } else {
        // Idle micro-sway (breathing)
        walkSwayTime += delta * 1.5;
        swayX = Math.sin(walkSwayTime) * 0.0005;
        swayY = Math.sin(walkSwayTime * 0.7) * 0.0003;
      }
      // Scope sway (drift when zoomed, reduced when holding breath via Shift)
      if (zoomed) {
        _scopeSwayTime += delta;
        var breathMult = _holdingBreath ? 0.1 : 1.0;
        swayX += Math.sin(_scopeSwayTime * 1.3) * 0.004 * breathMult;
        swayY += Math.cos(_scopeSwayTime * 0.9) * 0.003 * breathMult;
      }
      // Sprint weapon lowering (lerp down when sprinting, up when not)
      var isSprint = typeof GameManager !== 'undefined' && GameManager.isSprinting && GameManager.isSprinting() && !zoomed;
      var sprintTargY = isSprint ? -0.08 : 0;
      var sprintTargRotX = isSprint ? 0.3 : 0;
      var sprintTargZ = isSprint ? 0.04 : 0;
      var sprintLerp = 1 - Math.pow(0.001, delta); // ~6.9/s
      _sprintLowerY += (sprintTargY - _sprintLowerY) * sprintLerp;
      _sprintLowerRotX += (sprintTargRotX - _sprintLowerRotX) * sprintLerp;
      _sprintLowerZ += (sprintTargZ - _sprintLowerZ) * sprintLerp;

      mesh.position.x = swayX;
      mesh.position.z = recoilOffsetZ + recoilOffset + _sprintLowerZ;
      mesh.position.y = recoilOffsetY + switchY + swayY + _sprintLowerY;
      mesh.rotation.x = reloadAnimAngle + _sprintLowerRotX;
    }

    // Weapon inspect animation
    if (_inspectTimer > 0 && mesh) {
      _inspectTimer -= delta;
      var t = 1 - _inspectTimer / INSPECT_DUR;
      // Phase 1: tilt right (0→0.4) Phase 2: rotate (0.4→0.7) Phase 3: return (0.7→1.0)
      if (t < 0.4) {
        var p = t / 0.4;
        mesh.rotation.z = p * 0.6;
        mesh.rotation.y = p * 0.3;
        mesh.position.x = swayX + p * 0.05;
      } else if (t < 0.7) {
        var p2 = (t - 0.4) / 0.3;
        mesh.rotation.z = 0.6;
        mesh.rotation.y = 0.3 + p2 * 0.5;
        mesh.position.x = swayX + 0.05;
      } else {
        var p3 = (t - 0.7) / 0.3;
        mesh.rotation.z = 0.6 * (1 - p3);
        mesh.rotation.y = 0.8 * (1 - p3);
        mesh.position.x = swayX + 0.05 * (1 - p3);
      }
      if (_inspectTimer <= 0) {
        mesh.rotation.z = 0;
        mesh.rotation.y = 0;
      }
    }

    // Shovel swing animation
    if (swingTimer > 0 && mesh) {
      swingTimer -= delta;
      mesh.rotation.x = -Math.sin((0.2 - swingTimer) / 0.2 * Math.PI) * 0.8;
      if (swingTimer <= 0) mesh.rotation.x = 0;
    }

    // Barrel overheat glow
    if (mesh && typeof CombatExtras !== 'undefined' && CombatExtras.getHeat) {
      var curHeat = CombatExtras.getHeat();
      if (curHeat > 0.3) {
        var glow = (curHeat - 0.3) / 0.7; // 0..1 from 30% to 100% heat
        mesh.traverse(function(child) {
          if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissive.setRGB(glow * 0.8, glow * 0.15, 0);
          }
        });
        mesh._heatGlowing = true;
      } else if (mesh._heatGlowing) {
        mesh.traverse(function(child) {
          if (child.isMesh && child.material && child.material.emissive) {
            child.material.emissive.setRGB(0, 0, 0);
          }
        });
        mesh._heatGlowing = false;
      }
    }

    // Reload
    const wep = cur();
    const st  = curState();
    if (st.reloading) {
      st.reloadTimer -= delta;
      // Per-type reload animation
      if (mesh) {
        const progress = 1 - st.reloadTimer / wep.reloadTime;
        var rType = wep.type;
        var rRotX = 0, rRotZ = 0, rPosY = 0;
        if (rType === 'PISTOL' || rType === 'SMG' || rType === 'SILENT') {
          // Slide rack: quick Z snap at 60%, brief tilt
          if (progress < 0.4) {
            rRotX = progress / 0.4 * 0.15;
            rPosY = -progress / 0.4 * 0.03;
          } else if (progress < 0.6) {
            var t2 = (progress - 0.4) / 0.2;
            rRotZ = Math.sin(t2 * Math.PI) * 0.2;
            rRotX = 0.15;
            rPosY = -0.03;
          } else {
            var t2 = (progress - 0.6) / 0.4;
            rRotX = 0.15 * (1 - t2);
            rPosY = -0.03 * (1 - t2);
          }
        } else if (rType === 'LMG' || rType === 'HMG' || rType === 'HMG_HEAVY' || rType === 'MACHINEGUN' || rType === 'MINIGUN') {
          // Belt feed: slow roll + longer hold at bottom
          if (progress < 0.3) {
            rRotX = progress / 0.3 * (Math.PI / 8);
            rPosY = -progress / 0.3 * 0.06;
          } else if (progress < 0.7) {
            rRotX = Math.PI / 8;
            rPosY = -0.06;
            rRotZ = Math.sin((progress - 0.3) / 0.4 * Math.PI) * 0.12;
          } else {
            var t2 = (progress - 0.7) / 0.3;
            rRotX = Math.PI / 8 * (1 - t2);
            rPosY = -0.06 * (1 - t2);
          }
        } else if (rType === 'SNIPER' || rType === 'AMR') {
          // Bolt action: X rotation + Z offset pull
          if (progress < 0.25) {
            rRotX = progress / 0.25 * 0.1;
          } else if (progress < 0.5) {
            var t2 = (progress - 0.25) / 0.25;
            rRotX = 0.1;
            rRotZ = t2 * 0.25;
          } else if (progress < 0.75) {
            var t2 = (progress - 0.5) / 0.25;
            rRotZ = 0.25 * (1 - t2);
            rRotX = 0.1;
          } else {
            rRotX = 0.1 * (1 - (progress - 0.75) / 0.25);
          }
        } else if (rType === 'AT' || rType === 'ATGM' || rType === 'AT_HEAVY' || rType === 'AT_LIGHT' || rType === 'AA' || rType === 'THERMOBARIC') {
          // Tube load: full Y drop + slow rise
          if (progress < 0.4) {
            rPosY = -progress / 0.4 * 0.1;
            rRotX = progress / 0.4 * (Math.PI / 6);
          } else if (progress < 0.6) {
            rPosY = -0.1;
            rRotX = Math.PI / 6;
          } else {
            var t2 = (progress - 0.6) / 0.4;
            rPosY = -0.1 * (1 - t2);
            rRotX = Math.PI / 6 * (1 - t2);
          }
        } else if (rType === 'SHOTGUN') {
          // Pump action: tilt + Z-pull snap
          if (progress < 0.3) {
            rRotX = progress / 0.3 * 0.12;
          } else if (progress < 0.6) {
            var t2 = (progress - 0.3) / 0.3;
            rRotX = 0.12;
            rRotZ = Math.sin(t2 * Math.PI) * 0.15;
          } else {
            rRotX = 0.12 * (1 - (progress - 0.6) / 0.4);
          }
        } else {
          // Default (ASSAULT, NATO, GRENADE, etc): magazine swap
          if (progress < 0.5) {
            rRotX = progress * 2 * (Math.PI / 12);
          } else {
            rRotX = (1 - (progress - 0.5) * 2) * (Math.PI / 12);
          }
        }
        reloadAnimAngle = rRotX;
        mesh.rotation.x = rRotX + _sprintLowerRotX;
        mesh.rotation.z = (mesh.rotation.z || 0) * 0.5 + rRotZ * 0.5; // smooth Z
        mesh.position.y += rPosY;
      }
      if (st.reloadTimer <= 0) {
        const need = wep.clipSize - st.clip;
        const fill = Math.min(need, st.reserve);
        st.clip    += fill;
        st.reserve -= fill;
        st.reloading = false;
        reloadAnimAngle = 0;
        if (mesh) { mesh.rotation.x = _sprintLowerRotX; mesh.rotation.z = 0; }
        HUD.showReload(false);
        HUD.setAmmo(st.clip, st.reserve);
      }
    }
  }

  function reset() {
    states     = WEAPONS.map(makeState);
    currentIdx = 0;
    unlocked   = WEAPONS.map((_, i) => i <= 1);
    if (zoomed) exitZoom();
    recoilOffset = 0;
    recoilOffsetY = 0;
    recoilOffsetZ = 0;
    reloadAnimAngle = 0;
    swingTimer = 0;
    switchAnimTimer = 0;
    walkSwayTime = 0;
    _playerSpeed = 0;
    _scopeSwayTime = 0;
    _holdingBreath = false;
    _inspectTimer = 0;
    _sprintLowerY = 0;
    _sprintLowerRotX = 0;
    _sprintLowerZ = 0;
    // Remove lingering projectiles with proper disposal
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (_scene) _scene.remove(projectiles[i].mesh);
      if (projectiles[i].mesh) {
        if (projectiles[i].mesh.geometry) projectiles[i].mesh.geometry.dispose();
        if (projectiles[i].mesh.material) projectiles[i].mesh.material.dispose();
      }
    }
    projectiles.length = 0;
    // Clear smoke clouds with proper disposal
    for (let i = _smokeClouds.length - 1; i >= 0; i--) {
      var sc = _smokeClouds[i];
      if (sc.group) {
        sc.group.children.forEach(function (c) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
        if (_scene) _scene.remove(sc.group);
      }
    }
    _smokeClouds.length = 0;
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
  function setClip(val) { var st = curState(); if (typeof val === 'number') { st.clip = Math.min(val, cur().clipSize || val); HUD.setAmmo(st.clip, st.reserve); } }

  function clearJam() {
    const st = curState();
    if (st.jammed) {
      st.jammed = false;
      st.shotsSinceClean = 0;
    }
  }
  function isJammed() { return curState().jammed; }

  function isReloading() { return curState().reloading; }
  function getClip()     { return cur().type === 'MELEE' ? Infinity : curState().clip; }
  function getReserve()  { return cur().type === 'MELEE' ? '—' : curState().reserve; }
  function getClipSize() { return cur().clipSize || 0; }
  function getDamage()   { return cur().damage; }
  function isZoomed()    { return zoomed; }
  function setHoldBreath(v) { _holdingBreath = !!v; }
  function startInspect() { if (_inspectTimer <= 0 && !curState().reloading) _inspectTimer = INSPECT_DUR; }
  function getWeaponName(idx) { return WEAPONS[idx] ? WEAPONS[idx].name : ''; }

  function refillAllAmmo() {
    for (var i = 0; i < states.length; i++) {
      var w = WEAPONS[i];
      if (w && w.type !== 'MELEE') {
        states[i].clip = w.clipSize;
        states[i].reserve = w.maxReserve;
      }
    }
  }

  // ── B24: Unlock next locked weapon ──
  function unlockNext() {
    for (var i = 0; i < WEAPONS.length; i++) {
      if (!unlocked[i]) {
        unlocked[i] = true;
        if (typeof HUD !== 'undefined' && HUD.notifyPickup) {
          HUD.notifyPickup('🔓 UNLOCKED: ' + WEAPONS[i].name, '#ffdd44');
        }
        if (typeof Feedback !== 'undefined' && Feedback.showWeaponPickup) {
          Feedback.showWeaponPickup(WEAPONS[i].name);
        }
        return i;
      }
    }
    return -1;
  }

  // ── B24: Weapon Attachment System ──
  const ATTACHMENTS = {
    SUPPRESSOR:   { id: 'SUPPRESSOR',   name: 'Suppressor',   damageMult: 0.85, spreadMult: 0.9, sound: 'silent' },
    EXT_MAG:      { id: 'EXT_MAG',      name: 'Extended Mag', clipMult: 1.5 },
    RAPID_FIRE:   { id: 'RAPID_FIRE',   name: 'Rapid Fire',   fireRateMult: 0.8 },
    GRIP:         { id: 'GRIP',         name: 'Foregrip',     recoilMult: 0.7, spreadMult: 0.85 },
    LASER:        { id: 'LASER',        name: 'Laser Sight',  spreadMult: 0.75 },
    SCOPE_4X:     { id: 'SCOPE_4X',     name: '4x Scope',     hasScope: true, zoomFOV: 20 },
    FMJ:          { id: 'FMJ',          name: 'FMJ Rounds',   damageMult: 1.15, penetration: true },
    SPEED_LOADER: { id: 'SPEED_LOADER', name: 'Speed Loader',  reloadMult: 0.7 },
  };

  let weaponAttachments = {}; // { weaponIdx: [attachmentId, ...] }

  function addAttachment(weaponIdx, attachId) {
    if (!ATTACHMENTS[attachId]) return false;
    if (!weaponAttachments[weaponIdx]) weaponAttachments[weaponIdx] = [];
    if (weaponAttachments[weaponIdx].length >= 3) return false; // max 3 attachments
    if (weaponAttachments[weaponIdx].indexOf(attachId) >= 0) return false; // already has it
    weaponAttachments[weaponIdx].push(attachId);
    return true;
  }

  function removeAttachment(weaponIdx, attachId) {
    if (!weaponAttachments[weaponIdx]) return;
    var idx = weaponAttachments[weaponIdx].indexOf(attachId);
    if (idx >= 0) weaponAttachments[weaponIdx].splice(idx, 1);
  }

  function getAttachments(weaponIdx) {
    return (weaponAttachments[weaponIdx] || []).map(function(id) { return ATTACHMENTS[id]; });
  }

  function getModifiedStats(weaponIdx) {
    var w = WEAPONS[weaponIdx];
    if (!w) return null;
    var stats = { damage: w.damage, spread: w.spread, fireRate: w.fireRate, clipSize: w.clipSize, reloadTime: w.reloadTime, recoilY: w.recoilY };
    var attachs = weaponAttachments[weaponIdx] || [];
    for (var i = 0; i < attachs.length; i++) {
      var a = ATTACHMENTS[attachs[i]];
      if (!a) continue;
      if (a.damageMult) stats.damage = Math.round(stats.damage * a.damageMult);
      if (a.spreadMult) stats.spread *= a.spreadMult;
      if (a.fireRateMult) stats.fireRate *= a.fireRateMult;
      if (a.clipMult) stats.clipSize = Math.floor(stats.clipSize * a.clipMult);
      if (a.reloadMult) stats.reloadTime *= a.reloadMult;
      if (a.recoilMult) stats.recoilY *= a.recoilMult;
    }
    return stats;
  }

  return {
    createGunMesh,
    createMuzzleFlash,
    tryFire,
    update,
    reset,
    addAmmo,
    forceReload,
    reload: forceReload,
    setClip,
    cancelReload,
    isReloading,
    getClip,
    getReserve,
    getClipSize,
    getDamage,
    switchTo,
    switchNext,
    switchPrev,
    unlockWeapon,
    refillAllAmmo,
    handleRightDown,
    handleRightUp,
    exitZoom,
    isZoomed,
    setPlayerSpeed: function(s) { _playerSpeed = s; },
    setHoldBreath,
    startInspect,
    isInSmoke: isInSmoke,
    getWeaponCount: function () { return WEAPONS.length; },
    getCurrentIdx:  function () { return currentIdx; },
    getCurrentType: function () { return cur().type; },
    getCurrentId:   function () { return cur().id; },
    getCurrentName: function () { return cur().name; },
    getCurrent:     function () { return cur(); },
    getState:       function () { return curState(); },
    getWeaponName:  getWeaponName,
    getWeaponInfo:  function (i) {
      if (!WEAPONS[i]) return null;
      const s = states[i];
      return { id: WEAPONS[i].id, name: WEAPONS[i].name, damage: WEAPONS[i].damage, clip: s.clip, reserve: s.reserve, type: WEAPONS[i].type };
    },
    getWeaponDef: function (i) { return WEAPONS[i] || null; },
    isUnlocked:     function (i) { return !!unlocked[i]; },
    lockWeapon:     function (i) {
      if (i < 2) return;  // can't lock starter weapons
      unlocked[i] = false;
      if (currentIdx === i) switchTo(0);
    },
    getWeaponState: function (i) {
      if (!states[i]) return null;
      return { clip: states[i].clip, reserve: states[i].reserve };
    },
    removeAmmo:     function (idx, amount) {
      if (!states[idx]) return;
      states[idx].reserve = Math.max(0, states[idx].reserve - amount);
      if (idx === currentIdx) HUD.setAmmo(states[idx].clip, states[idx].reserve);
    },
    getWeaponId:    function (i) { return WEAPONS[i] ? WEAPONS[i].id : ''; },
    didFire:        function () { return _firedThisFrame; },
    applyRecoil:    applyRecoil,
    applyLandingBob: applyLandingBob,
    clearJam:       clearJam,
    isJammed:       isJammed,
    getBlastRadius: function () { return cur().blastRadius || 0; },
    setOnTerrainDig: setOnTerrainDig,
    setOnTerrainShot: setOnTerrainShot,
    // B24 exports
    unlockNext:       unlockNext,
    ATTACHMENTS:      ATTACHMENTS,
    addAttachment:    addAttachment,
    removeAttachment: removeAttachment,
    getAttachments:   getAttachments,
    getModifiedStats: getModifiedStats,
  };
})();
