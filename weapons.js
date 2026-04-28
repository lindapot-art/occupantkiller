// Ensure window.Weapons is always defined before any code runs (robust for QA/headless)
if (typeof window !== 'undefined' && typeof window.Weapons === 'undefined') {
  window.Weapons = {};
}
/**
 * weapons.js – 23-weapon Ukrainian war arsenal with melee, projectiles, grenades, fire & scope zoom
 * Switch with keys 1-0, Q/E scroll. Weapons 0 (shovel) and 1 (pistol) start unlocked.
 * Depends on: Three.js global (THREE), HUD, VoxelWorld, Enemies
 */

const Weapons = (() => {
  // ── Weapon definitions ────────────────────────────────────
  const WEAPONS = [
    // NEW: Gatling Machine Gun (first available)
    {
      id: 'GATLING', name: 'Gatling Machine Gun', damage: 14,
      fireRate: 0.015, clipSize: 200, maxReserve: 800, reloadTime: 7.0,
      spread: 0.09, auto: true, type: 'GATLING', recoilY: 0.010, recoilX: 0.006,
      barrels: 6, spinUp: 0.3, spinDown: 0.5, description: 'Six rotating barrels, extremely high fire rate.'
    },
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
      hasScope: true,
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
      spread: 0, auto: false, type: 'ATGM', hasScope: true, homing: true, blastRadius: 5, recoilY: 0.050, recoilX: 0.015,
    },
    {
      id: 'M4A1', name: 'M4A1', damage: 30,
      fireRate: 0.09, clipSize: 30, maxReserve: 120, reloadTime: 2.0,
      spread: 0.018, auto: true, type: 'NATO', recoilY: 0.013, recoilX: 0.005,
      hasScope: true,
    },
    {
      id: 'JAVELIN', name: 'FGM-148 Javelin', damage: 1200,
      fireRate: 4.0, clipSize: 1, maxReserve: 2, reloadTime: 6.0,
      spread: 0, auto: false, type: 'AT_HEAVY', hasScope: true, homing: true, blastRadius: 6, recoilY: 0.060, recoilX: 0.020,
    },
    {
      id: 'RPG7', name: 'RPG-7', damage: 350,
      fireRate: 2.5, clipSize: 1, maxReserve: 4, reloadTime: 3.5,
      spread: 0.01, auto: false, type: 'AT_LIGHT', blastRadius: 3.5, recoilY: 0.055, recoilX: 0.018,
    },
    {
      id: 'IGLA', name: 'Igla MANPADS', damage: 600,
      fireRate: 3.5, clipSize: 1, maxReserve: 2, reloadTime: 5.0,
      spread: 0, auto: false, type: 'AA', hasScope: true, homing: true, blastRadius: 4, recoilY: 0.050, recoilX: 0.015,
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
      hasScope: true,
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
      hasScope: true,
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
      spread: 0, auto: false, type: 'AA', hasScope: true, homing: true, blastRadius: 5, recoilY: 0.050, recoilX: 0.015,
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
    var initReserve = cfg.maxReserve;
    // Ensure player always starts with at least 5 grenades available
    if (cfg.type === 'GRENADE' && initReserve < 5) initReserve = 5;
    return {
      clip: cfg.clipSize, reserve: initReserve,
      reloading: false, reloadTimer: 0, fireCooldown: 0,
      jammed: false, shotsSinceClean: 0,
    };
  }
  let states     = WEAPONS.map(makeState);
  let currentIdx = 0;
  // Only Shovel (0) + Makarov (1) start unlocked; rest earned via drops & stage clears
  // Only Gatling and Shovel start unlocked (indices 0 and 1)
  // Only Gatling (0) and Shovel (1) start unlocked; rest locked
  // Unlock pacing: only first 2 weapons unlocked at start, rest unlock per stage
  let unlocked   = WEAPONS.map(function(_, i) { return i <= 1; });

  // Unlock weapons per stage (example: 2 new weapons per stage)
  function unlockForStage(stageNum) {
    // Always keep first 2 unlocked
    for (let i = 2; i < WEAPONS.length; i++) {
      unlocked[i] = false;
    }
    // Example: unlock 2 new weapons per stage (after first 2)
    let unlockCount = Math.min(2 * stageNum, WEAPONS.length - 2);
    for (let i = 2; i < 2 + unlockCount; i++) {
      if (i < WEAPONS.length) unlocked[i] = true;
    }
  }

  function cur()      { return WEAPONS[currentIdx]; }
  function curState() { return states[currentIdx]; }

  function refreshWeaponHud() {
    if (typeof HUD === 'undefined' || !HUD.setWeapon) return;
    HUD.setWeapon(cur().name, currentIdx);
    if (cur().type === 'MELEE') {
      HUD.setAmmo('∞', '—');
      return;
    }
    const st = curState();
    HUD.setAmmo(st.clip, st.reserve);
  }

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
  // All eligible weapons now have hasScope: true for proper scope overlay/zoom
  let _camera      = null;
  let _scene       = null;
  let zoomed       = false;
  let rightMouseDown = false;
  const FOV_DEFAULT = 75;
  const FOV_ZOOMED  = 25;

  // ── Gun meshes ────────────────────────────────────────────
  const gunMeshes = [];

  /* ════════════════════════════════════════════════════════════════
   * WD — Weapon Detail Kit.
   * Reusable mini-mesh helpers for super-detailed firearm meshes:
   * Picatinny rails, iron sights, safety selectors with engravings,
   * checkered grips, bolt-carrier faces, muzzle crowns, screws,
   * rivets, mag-window slots, heat-shield vents, charging-handle
   * knurling, lever/button details. All take a parent group + anchor.
   * Based on real firearm reference (AK-74M, M4A1, Makarov PM,
   * Glock 17, SVD Dragunov, MP5A3, RPG-7).
   * ════════════════════════════════════════════════════════════════ */
  const WD = (function () {
    const M = (c, opts) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, opts || {}));
    const P = (c, sh) => new THREE.MeshPhongMaterial({ color: c, shininess: sh || 60, specular: 0x666666 });
    // Cached materials — avoid re-creating per rivet
    const matSteel    = P(0x9aa0a6, 80);
    const matBlued    = P(0x1a1c20, 40);
    const matMatte    = M(0x2a2a2e);
    const matDark     = M(0x14141a);
    const matBrass    = P(0xb88a3a, 50);
    const matWhite    = M(0xe6e6ea);
    const matRed      = M(0xc02020);
    const matRubber   = M(0x101012);

    // ── Picatinny rail: row of teeth + slots, MIL-STD-1913 spaced ──
    function picatinnyRail(g, ax, ay, az, length, opts) {
      opts = opts || {};
      const width = opts.width || 0.022;
      const height = opts.height || 0.008;
      const teeth = Math.max(3, Math.floor(length / 0.015));
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(width, height * 0.55, length),
        matMatte
      );
      base.position.set(ax, ay, az);
      g.add(base);
      for (let i = 0; i < teeth; i++) {
        const t = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, 0.008),
          matBlued
        );
        t.position.set(ax, ay + height * 0.30, az - length * 0.5 + 0.006 + i * (length / teeth));
        g.add(t);
      }
    }

    // ── Iron sights: front post with protective ears + rear aperture/notch ──
    function ironSights(g, frontPos, rearPos, opts) {
      opts = opts || {};
      // Front post + ears
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.004), matSteel);
      post.position.copy(frontPos);
      g.add(post);
      const earL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.020, 0.005), matMatte);
      earL.position.set(frontPos.x - 0.008, frontPos.y, frontPos.z); g.add(earL);
      const earR = earL.clone(); earR.position.x = frontPos.x + 0.008; g.add(earR);
      // Front sight base
      const fbase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.014), matMatte);
      fbase.position.set(frontPos.x, frontPos.y - 0.013, frontPos.z); g.add(fbase);
      // Rear sight: aperture or notch
      if (opts.aperture) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0018, 6, 12), matMatte);
        ring.position.copy(rearPos); ring.rotation.y = Math.PI / 2; g.add(ring);
      } else {
        const rear = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.006), matMatte);
        rear.position.copy(rearPos); g.add(rear);
        const notch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.005, 0.008), matDark);
        notch.position.set(rearPos.x, rearPos.y + 0.003, rearPos.z); g.add(notch);
        // White dots either side of notch
        for (let s = -1; s <= 1; s += 2) {
          const dot = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0015, 0.0015), matWhite);
          dot.position.set(rearPos.x + s * 0.005, rearPos.y + 0.001, rearPos.z); g.add(dot);
        }
      }
    }

    // ── Safety selector lever with engraved markings (S / F / A) ──
    function safetySelector(g, ax, ay, az, opts) {
      opts = opts || {};
      // Lever
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.030, 0.012), matBlued);
      lever.position.set(ax, ay, az); g.add(lever);
      // Pivot screw
      const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.005, 8), matSteel);
      pivot.position.set(ax, ay, az); pivot.rotation.z = Math.PI / 2; g.add(pivot);
      // Slot (Phillips cross)
      const sl1 = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.0008, 0.0008), matDark);
      sl1.position.set(ax + 0.002, ay, az); g.add(sl1);
      const sl2 = sl1.clone(); sl2.rotation.x = Math.PI / 2; g.add(sl2);
      // Engraved S/F/A pip markings (simulated as tiny white boxes)
      const marks = opts.marks || ['S', 'F', 'A'];
      for (let i = 0; i < marks.length; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.0008), matWhite);
        m.position.set(ax - 0.004, ay + 0.004 - i * 0.008, az); g.add(m);
      }
    }

    // ── Diagonal checkering for pistol grip (reference: Glock RTF) ──
    function checkering(g, ax, ay, az, w, h, opts) {
      opts = opts || {};
      const rows = opts.rows || 8;
      const cols = opts.cols || 4;
      const matG = M(opts.color || 0x111114);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dot = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.0025, 0.0025), matG);
          dot.position.set(
            ax + (c - cols / 2 + 0.5) * (w / cols),
            ay - (r - rows / 2 + 0.5) * (h / rows),
            az
          );
          g.add(dot);
        }
      }
    }

    // ── Finger grooves (pistol front-strap) ──
    function fingerGrooves(g, ax, ay, az, count, w) {
      count = count || 4;
      w = w || 0.024;
      for (let i = 0; i < count; i++) {
        const grv = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, w, 6), M(0x080808));
        grv.position.set(ax, ay - i * 0.011, az);
        grv.rotation.z = Math.PI / 2; g.add(grv);
      }
    }

    // ── Bolt-carrier face with extractor + firing pin (visible thru port) ──
    function boltFace(g, ax, ay, az) {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.003, 12), matSteel);
      face.position.set(ax, ay, az); face.rotation.x = Math.PI / 2; g.add(face);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0015, 0.002), matDark);
      pin.position.set(ax, ay, az + 0.0015); g.add(pin);
      const ext = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.005, 0.002), matBlued);
      ext.position.set(ax + 0.005, ay + 0.002, az + 0.0015); g.add(ext);
    }

    // ── Muzzle crown: recessed ring with rifling slot hint ──
    function muzzleCrown(g, ax, ay, az, radius) {
      radius = radius || 0.012;
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.95, 0.005, 12),
        matBlued
      );
      crown.position.set(ax, ay, az); crown.rotation.x = Math.PI / 2; g.add(crown);
      const bore = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 0.004, 10),
        matDark
      );
      bore.position.set(ax, ay, az); bore.rotation.x = Math.PI / 2; g.add(bore);
      // Suggest 4 lands of rifling
      for (let i = 0; i < 4; i++) {
        const land = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.4, 0.0008, 0.003), matSteel);
        land.position.set(ax, ay, az + 0.0005);
        land.rotation.z = (i / 4) * Math.PI; g.add(land);
      }
    }

    // ── Phillips screw head ──
    function screw(g, ax, ay, az, size) {
      size = size || 0.005;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(size, size, size * 0.4, 8), matSteel);
      head.position.set(ax, ay, az); head.rotation.x = Math.PI / 2; g.add(head);
      const sl1 = new THREE.Mesh(new THREE.BoxGeometry(size * 1.6, size * 0.3, size * 0.15), matDark);
      sl1.position.set(ax, ay, az + size * 0.21); g.add(sl1);
      const sl2 = sl1.clone(); sl2.rotation.z = Math.PI / 2; g.add(sl2);
    }

    // ── Rivet (small metallic dome) ──
    function rivet(g, ax, ay, az, size) {
      size = size || 0.003;
      const r = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 4), matSteel);
      r.position.set(ax, ay, az); g.add(r);
    }

    // ── Charging handle knurled grip ──
    function chargingHandle(g, ax, ay, az, opts) {
      opts = opts || {};
      const len = opts.len || 0.018;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, len), matMatte);
      handle.position.set(ax, ay, az); g.add(handle);
      // Knurl ridges
      for (let i = 0; i < 6; i++) {
        const k = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.0015, 0.0015), matDark);
        k.position.set(ax, ay + 0.006, az - len * 0.4 + i * (len * 0.16));
        g.add(k);
      }
    }

    // ── Mag release button (round, paddle, or AK-style catch) ──
    function magReleaseButton(g, ax, ay, az, opts) {
      opts = opts || {};
      const r = opts.radius || 0.005;
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.004, 8), matBlued);
      btn.position.set(ax, ay, az); btn.rotation.z = Math.PI / 2; g.add(btn);
      // Outer ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.3, r * 0.25, 4, 10), matMatte);
      ring.position.set(ax, ay, az); ring.rotation.y = Math.PI / 2; g.add(ring);
    }

    // ── Heat-shield vent slots (handguard) ──
    function heatShieldVents(g, ax, ay, az, count, length) {
      count = count || 6;
      length = length || 0.10;
      for (let i = 0; i < count; i++) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.001, 0.006), matDark);
        slot.position.set(ax, ay, az - length * 0.4 + i * (length * 0.85 / count));
        g.add(slot);
      }
    }

    // ── Mag witness/inspection holes (round count holes) ──
    function magWitnessHoles(g, ax, ay, az, count) {
      count = count || 5;
      for (let i = 0; i < count; i++) {
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.001, 6), matDark);
        hole.position.set(ax, ay - i * 0.012, az);
        hole.rotation.x = Math.PI / 2; g.add(hole);
      }
    }

    // ── Receiver ribs (top-cover stamping detail, AK-style) ──
    function receiverRibs(g, ax, ay, az, length, count) {
      count = count || 4;
      for (let i = 0; i < count; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.001, 0.003), matBlued);
        rib.position.set(ax, ay, az - length * 0.4 + i * (length * 0.8 / count));
        g.add(rib);
      }
    }

    // ── Sling swivel + ring ──
    function slingSwivel(g, ax, ay, az) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.005, 0.006), matMatte);
      base.position.set(ax, ay, az); g.add(base);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.0012, 4, 8), matSteel);
      ring.position.set(ax, ay - 0.006, az); ring.rotation.y = Math.PI / 2; g.add(ring);
    }

    // ── Manufacturer/serial micro-stamp (visual hint only) ──
    function serialStamp(g, ax, ay, az, len) {
      len = len || 0.030;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(len, 0.001, 0.006), matMatte);
      plate.position.set(ax, ay, az); g.add(plate);
      // Micro-letters (5 tiny boxes)
      for (let i = 0; i < 5; i++) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.0008, 0.0008), matDark);
        l.position.set(ax - len * 0.4 + i * (len * 0.2), ay + 0.001, az);
        g.add(l);
      }
    }

    return {
      picatinnyRail, ironSights, safetySelector, checkering, fingerGrooves,
      boltFace, muzzleCrown, screw, rivet, chargingHandle, magReleaseButton,
      heatShieldVents, magWitnessHoles, receiverRibs, slingSwivel, serialStamp,
      // ── Universal auto-detail ──
      // Walks the largest mesh in the weapon group and stamps proportional
      // rivets, screws, an info-plate, and surface texture stippling so every
      // weapon (including placeholders) reads as a real machined firearm.
      autoDetail(g, weaponName) {
        if (!g || !g.children || g.children.length === 0) return;
        // Find the geometric center & bbox of the whole weapon
        const box = new THREE.Box3().setFromObject(g);
        if (box.isEmpty()) return;
        const size = box.getSize(new THREE.Vector3());
        const cen  = box.getCenter(new THREE.Vector3());
        const halfW = size.x / 2, halfH = size.y / 2, halfL = size.z / 2;
        // Skip super-small things (knives, throwables) but still add a few details
        const isSmall = (size.length() < 0.3);
        // Top side
        const top = cen.y + halfH * 0.85;
        const right = cen.x + halfW * 0.95;
        const front = cen.z - halfL * 0.85;
        const back  = cen.z + halfL * 0.85;
        // Stippled texture (random micro-bumps along the body — wear marks)
        const stippleCount = isSmall ? 6 : 18;
        for (let i = 0; i < stippleCount; i++) {
          const px = cen.x + (Math.random() - 0.5) * size.x * 0.7;
          const py = cen.y + (Math.random() - 0.5) * size.y * 0.7;
          const pz = cen.z + (Math.random() - 0.5) * size.z * 0.85;
          const dot = new THREE.Mesh(
            new THREE.BoxGeometry(0.0015, 0.0015, 0.0015),
            new THREE.MeshLambertMaterial({ color: 0x0a0a0c })
          );
          dot.position.set(px, py, pz); g.add(dot);
        }
        // Rivet line along receiver side (right face)
        const rivetCount = isSmall ? 3 : 7;
        for (let i = 0; i < rivetCount; i++) {
          const t = i / (rivetCount - 1 || 1);
          rivet(g, right, cen.y, cen.z + (t - 0.5) * size.z * 0.55, 0.0022);
        }
        // 2 screws on the underside
        if (!isSmall) {
          screw(g, cen.x - halfW * 0.5, cen.y - halfH * 0.85, cen.z + halfL * 0.30, 0.004);
          screw(g, cen.x + halfW * 0.5, cen.y - halfH * 0.85, cen.z + halfL * 0.30, 0.004);
        }
        // Tiny serial-stamp on right side
        if (!isSmall) {
          serialStamp(g, right, cen.y - halfH * 0.40, cen.z, Math.min(0.04, size.z * 0.22));
        }
        // Top vent grooves (heat-relief texture, near the front half)
        if (!isSmall && size.z > 0.4) {
          const ventCount = 5;
          for (let i = 0; i < ventCount; i++) {
            const groove = new THREE.Mesh(
              new THREE.BoxGeometry(size.x * 0.28, 0.001, 0.004),
              new THREE.MeshLambertMaterial({ color: 0x05050a })
            );
            groove.position.set(cen.x, top - 0.001, front + 0.04 + i * 0.020);
            g.add(groove);
          }
        }
      },
    };
  })();

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
    const met = 0x2a2a2e, frame_c = 0x333336, grip_c = 0x1a1a0a, panel_c = 0x2a1a0a;

    // ── Slide assembly (moves back on fire) ──
    const slide = new THREE.Group();
    slide.name = '_slide';
    // Slide body
    const slideBody = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.135), new THREE.MeshLambertMaterial({ color: met }));
    slideBody.position.set(0.18, -0.125, -0.285);
    // Barrel (inside slide)
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.145), new THREE.MeshLambertMaterial({ color: 0x222226 }));
    barrel.position.set(0.18, -0.132, -0.29);
    // Muzzle crown
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.020, 0.008), new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
    muzzle.position.set(0.18, -0.130, -0.365);
    // Rear serrations (grip lines)
    for (let i = 0; i < 8; i++) {
      const ser = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.002, 0.003), new THREE.MeshLambertMaterial({ color: 0x222228 }));
      ser.position.set(0.18, -0.125, -0.22 + i * 0.005);
      slide.add(ser);
    }
    // Front sight
    const fsight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.004), new THREE.MeshLambertMaterial({ color: met }));
    fsight.position.set(0.18, -0.107, -0.35);
    // Rear sight notch
    const rsight = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, 0.006), new THREE.MeshLambertMaterial({ color: met }));
    rsight.position.set(0.18, -0.107, -0.22);
    const rnotch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.005, 0.008), new THREE.MeshLambertMaterial({ color: 0x111114 }));
    rnotch.position.set(0.18, -0.105, -0.22);
    // Ejection port
    const eport = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.018), new THREE.MeshLambertMaterial({ color: 0x111114 }));
    eport.position.set(0.198, -0.120, -0.27);
    // Extractor
    const ext = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.005, 0.020), new THREE.MeshLambertMaterial({ color: 0x444448 }));
    ext.position.set(0.198, -0.112, -0.28);
    slide.add(slideBody, barrel, muzzle, fsight, rsight, rnotch, eport, ext);

    // ── Frame (static) ──
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.018, 0.095), new THREE.MeshLambertMaterial({ color: frame_c }));
    frame.position.set(0.18, -0.148, -0.25);
    // Dust cover / rail area
    const dustc = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, 0.035), new THREE.MeshLambertMaterial({ color: frame_c }));
    dustc.position.set(0.18, -0.155, -0.30);

    // ── Trigger assembly ──
    const trig = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.016, 0.006), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    trig.position.set(0.18, -0.165, -0.255);
    // Trigger guard
    const gFront = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.004, 0.004), new THREE.MeshLambertMaterial({ color: frame_c }));
    gFront.position.set(0.18, -0.178, -0.28);
    const gBottom = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.004, 0.032), new THREE.MeshLambertMaterial({ color: frame_c }));
    gBottom.position.set(0.18, -0.182, -0.262);
    const gRear = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.004, 0.004), new THREE.MeshLambertMaterial({ color: frame_c }));
    gRear.position.set(0.18, -0.168, -0.244);

    // ── Grip ──
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.065, 0.032), new THREE.MeshLambertMaterial({ color: grip_c }));
    grip.position.set(0.18, -0.195, -0.225);
    grip.rotation.x = 0.12;
    // Grip panels (textured)
    const panL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.050, 0.028), new THREE.MeshLambertMaterial({ color: panel_c }));
    panL.position.set(0.163, -0.190, -0.225);
    panL.rotation.x = 0.12;
    const panR = panL.clone(); panR.position.x = 0.197;
    // Grip screws
    const scrL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.004), new THREE.MeshLambertMaterial({ color: 0x999999 }));
    scrL.position.set(0.162, -0.190, -0.225);
    const scrR = scrL.clone(); scrR.position.x = 0.198;
    // Grip texture lines
    for (let i = 0; i < 6; i++) {
      const ln = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.028), new THREE.MeshLambertMaterial({ color: 0x151510 }));
      ln.position.set(0.163, -0.170 - i * 0.008, -0.225);
      ln.rotation.x = 0.12;
      g.add(ln);
      const lnR = ln.clone(); lnR.position.x = 0.197; g.add(lnR);
    }

    // ── Magazine base plate ──
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.008, 0.028), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    magBase.position.set(0.18, -0.234, -0.218);
    // Magazine release
    const magRel = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.005), new THREE.MeshLambertMaterial({ color: 0x555555 }));
    magRel.position.set(0.198, -0.155, -0.235);

    // ── Hammer ──
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.014, 0.006), new THREE.MeshLambertMaterial({ color: 0x444448 }));
    hammer.position.set(0.18, -0.115, -0.205);
    // Safety lever
    const safety = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.012, 0.010), new THREE.MeshLambertMaterial({ color: 0x555558 }));
    safety.position.set(0.198, -0.125, -0.215);
    // Slide stop
    const slideStop = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.008), new THREE.MeshLambertMaterial({ color: 0x444448 }));
    slideStop.position.set(0.198, -0.140, -0.260);

    // ── Lanyard loop ──
    const lanyard = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.010, 0.004), new THREE.MeshLambertMaterial({ color: frame_c }));
    lanyard.position.set(0.18, -0.230, -0.200);

    g.add(slide, frame, dustc, trig, gFront, gBottom, gRear,
          grip, panL, panR, scrL, scrR, magBase, magRel,
          hammer, safety, slideStop, lanyard);

    // ── Super-detail pass (WD kit) — Makarov PM ──
    // Real PM has decocker safety (top-rear of slide), 3-dot sights, slide-stop notch,
    // checkered grip panels with star medallion, lanyard loop, takedown screw.
    WD.muzzleCrown(g, 0.18, -0.130, -0.368, 0.009);
    WD.boltFace(g, 0.198, -0.120, -0.27);
    WD.checkering(g, 0.163, -0.195, -0.225, 0.022, 0.040, { rows: 6, cols: 3 });
    WD.checkering(g, 0.197, -0.195, -0.225, 0.022, 0.040, { rows: 6, cols: 3 });
    WD.screw(g, 0.180, -0.218, -0.225, 0.004); // grip-panel screw bottom
    WD.screw(g, 0.180, -0.165, -0.225, 0.004); // grip-panel screw top
    WD.magReleaseButton(g, 0.198, -0.155, -0.235, { radius: 0.004 });
    WD.serialStamp(g, 0.198, -0.142, -0.260, 0.020);
    // 5 slide-serration mirrors on right side
    for (let si = 0; si < 8; si++) {
      const ser = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.002, 0.003), new THREE.MeshLambertMaterial({ color: 0x222228 }));
      ser.position.set(0.18, -0.144, -0.22 + si * 0.005);
      g.add(ser);
    }
    // Star medallion (CCCP) on grip
    const star = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.0015, 5), new THREE.MeshLambertMaterial({ color: 0xb88a3a }));
    star.position.set(0.163, -0.190, -0.224); star.rotation.y = Math.PI / 2; g.add(star);
    const star2 = star.clone(); star2.position.x = 0.197; g.add(star2);
    return g;
  }

  function buildAkMesh() {
    const g = new THREE.Group();
    const bk = 0x2a2a2e, wd = 0x5a3a1a, dk = 0x222226, frm = 0x333336;
    // ── Gas tube + handguard (wood) ──
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.042, 0.16), new THREE.MeshLambertMaterial({ color: wd }));
    handguard.position.set(0.18, -0.14, -0.42);
    const handguardLo = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.015, 0.16), new THREE.MeshLambertMaterial({ color: 0x4a2a12 }));
    handguardLo.position.set(0.18, -0.165, -0.42);
    const gasTube = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.18), new THREE.MeshLambertMaterial({ color: bk }));
    gasTube.position.set(0.18, -0.118, -0.42);
    // Gas block
    const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.030, 0.020), new THREE.MeshLambertMaterial({ color: bk }));
    gasBlock.position.set(0.18, -0.125, -0.52);
    // ── Barrel ──
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.38), new THREE.MeshLambertMaterial({ color: frm }));
    barrel.position.set(0.18, -0.14, -0.44);
    // ── Muzzle brake (slotted) ──
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.04), new THREE.MeshLambertMaterial({ color: dk }));
    brake.position.set(0.18, -0.14, -0.64);
    for (let i = 0; i < 4; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.003, 0.008), new THREE.MeshLambertMaterial({ color: 0x111114 }));
      slot.position.set(0.18, -0.14, -0.625 + i * 0.010);
      slot.rotation.z = (i % 2) * Math.PI / 4;
      g.add(slot);
    }
    // ── Receiver (main body) ──
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.055, 0.22), new THREE.MeshLambertMaterial({ color: bk }));
    receiver.position.set(0.18, -0.14, -0.24);
    // Receiver cover
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.010, 0.18), new THREE.MeshLambertMaterial({ color: frm }));
    cover.position.set(0.18, -0.110, -0.24);
    // ── Dust cover / ejection port ──
    const ejPort = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.016, 0.022), new THREE.MeshLambertMaterial({ color: 0x111114 }));
    ejPort.position.set(0.208, -0.125, -0.27);
    // ── Bolt carrier (visible through ejection port) ──
    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.025), new THREE.MeshLambertMaterial({ color: 0x999999 }));
    bolt.position.set(0.207, -0.128, -0.27); bolt.name = '_bolt';
    // ── Charging handle ──
    const chHandle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.014), new THREE.MeshLambertMaterial({ color: frm }));
    chHandle.position.set(0.21, -0.120, -0.22);
    // ── Curved AK magazine ──
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.11, 0.048), new THREE.MeshLambertMaterial({ color: 0x2a2218 }));
    mag.position.set(0.18, -0.23, -0.24); mag.rotation.x = 0.18;
    // Magazine ribs
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.003, 0.004), new THREE.MeshLambertMaterial({ color: 0x1a180e }));
      rib.position.set(0.18, -0.19 - i * 0.025, -0.24 + i * 0.004);
      g.add(rib);
    }
    // Mag catch
    const magCatch = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.008), new THREE.MeshLambertMaterial({ color: frm }));
    magCatch.position.set(0.18, -0.175, -0.215);
    // ── Pistol grip ──
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.085, 0.040), new THREE.MeshLambertMaterial({ color: 0x1a1a0e }));
    grip.position.set(0.18, -0.21, -0.17); grip.rotation.x = 0.10;
    // Grip texture
    for (let i = 0; i < 5; i++) {
      const gt = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.036), new THREE.MeshLambertMaterial({ color: 0x121210 }));
      gt.position.set(0.163, -0.180 - i * 0.012, -0.17);
      g.add(gt);
      const gt2 = gt.clone(); gt2.position.x = 0.197; g.add(gt2);
    }
    // Grip screw
    const gScrew = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.005), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
    gScrew.position.set(0.163, -0.205, -0.17);
    const gScrew2 = gScrew.clone(); gScrew2.position.x = 0.197;
    // ── Stock (folding polymer AK-74M) ──
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.045, 0.20), new THREE.MeshLambertMaterial({ color: 0x1a1a0e }));
    stock.position.set(0.18, -0.14, -0.04);
    const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.048, 0.010), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    buttpad.position.set(0.18, -0.14, 0.06);
    // Stock hinge
    const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.020, 0.015), new THREE.MeshLambertMaterial({ color: frm }));
    hinge.position.set(0.18, -0.14, -0.13);
    // ── Trigger + guard ──
    const trig = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.006), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    trig.position.set(0.18, -0.175, -0.195);
    const grdFr = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.004, 0.004), new THREE.MeshLambertMaterial({ color: bk }));
    grdFr.position.set(0.18, -0.188, -0.22);
    const grdBt = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.004, 0.035), new THREE.MeshLambertMaterial({ color: bk }));
    grdBt.position.set(0.18, -0.192, -0.200);
    // ── Safety lever ──
    const safetyLvr = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.035, 0.008), new THREE.MeshLambertMaterial({ color: frm }));
    safetyLvr.position.set(0.21, -0.130, -0.21);
    // ── Sling loop ──
    const slingF = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.004), new THREE.MeshLambertMaterial({ color: bk }));
    slingF.position.set(0.18, -0.175, -0.53);
    const slingR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.004), new THREE.MeshLambertMaterial({ color: bk }));
    slingR.position.set(0.18, -0.160, 0.04);
    // ── Cleaning rod (under barrel) ──
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.35), new THREE.MeshLambertMaterial({ color: 0x666666 }));
    rod.position.set(0.18, -0.170, -0.42);

    g.add(handguard, handguardLo, gasTube, gasBlock, barrel, brake,
          receiver, cover, ejPort, bolt, chHandle,
          mag, magCatch, grip, gScrew, gScrew2,
          stock, buttpad, hinge,
          trig, grdFr, grdBt, safetyLvr,
          slingF, slingR, rod);

    // ── Super-detail pass (WD kit) ──
    // Real AK-74M: Picatinny side rail, S/F/A safety with engravings, dust-cover ribs,
    // mag witness ribs, front sight ears, rear notch sight, knurled charging handle,
    // muzzle crown, grip checkering, stock screws, sling swivels, serial stamp.
    WD.ironSights(g,
      new THREE.Vector3(0.18, -0.118, -0.55),  // front post (gas block)
      new THREE.Vector3(0.18, -0.110, -0.32),  // rear notch (receiver)
      { aperture: false }
    );
    WD.safetySelector(g, 0.211, -0.140, -0.245, { marks: ['A', 'D'] }); // AK selector AB/OD
    WD.muzzleCrown(g, 0.18, -0.140, -0.66, 0.014);
    WD.boltFace(g, 0.207, -0.128, -0.265);
    WD.chargingHandle(g, 0.214, -0.118, -0.215, { len: 0.020 });
    WD.receiverRibs(g, 0.18, -0.110, -0.235, 0.16, 5);
    WD.heatShieldVents(g, 0.18, -0.118, -0.42, 6, 0.16);
    WD.checkering(g, 0.180, -0.205, -0.150, 0.034, 0.060, { rows: 8, cols: 5, color: 0x0a0a08 });
    WD.fingerGrooves(g, 0.180, -0.180, -0.183, 4, 0.030);
    WD.magWitnessHoles(g, 0.202, -0.215, -0.236, 4);
    WD.screw(g, 0.180, -0.140, -0.13, 0.005);  // stock hinge screw
    WD.screw(g, 0.180, -0.140,  0.05, 0.005);  // butt-pad screw
    WD.slingSwivel(g, 0.180, -0.182, -0.530);
    WD.slingSwivel(g, 0.180, -0.165,  0.040);
    WD.serialStamp(g, 0.207, -0.140, -0.235, 0.040);
    // 6 rivets along receiver (real AK stamping)
    for (let ri = 0; ri < 6; ri++) {
      WD.rivet(g, 0.207, -0.155, -0.32 + ri * 0.025, 0.0025);
    }
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
    const bk = 0x2a2a2e, wd = 0x3a2a18, frm = 0x333336;
    // ── Barrel (long, thin) ──
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.020, 0.55), new THREE.MeshLambertMaterial({ color: bk }));
    barrel.position.set(0.17, -0.13, -0.54);
    // Barrel fluting (visual grooves)
    for (let i = 0; i < 6; i++) {
      const flute = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.003, 0.40), new THREE.MeshLambertMaterial({ color: 0x222226 }));
      flute.position.set(0.17, -0.13, -0.48);
      flute.rotation.z = (i / 6) * Math.PI;
      g.add(flute);
    }
    // Flash hider
    const flash = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.035), new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
    flash.position.set(0.17, -0.13, -0.82);
    for (let i = 0; i < 3; i++) {
      const fSlot = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.004, 0.006), new THREE.MeshLambertMaterial({ color: 0x111114 }));
      fSlot.position.set(0.17, -0.13, -0.81 + i * 0.010);
      g.add(fSlot);
    }
    // Gas tube
    const gasT = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.22), new THREE.MeshLambertMaterial({ color: bk }));
    gasT.position.set(0.17, -0.108, -0.48);
    // Gas block
    const gasB = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.025, 0.018), new THREE.MeshLambertMaterial({ color: bk }));
    gasB.position.set(0.17, -0.115, -0.60);
    // ── Handguard (skeletal wood) ──
    const hgTop = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.012, 0.15), new THREE.MeshLambertMaterial({ color: wd }));
    hgTop.position.set(0.17, -0.102, -0.38);
    const hgBot = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.012, 0.15), new THREE.MeshLambertMaterial({ color: wd }));
    hgBot.position.set(0.17, -0.152, -0.38);
    // ── Receiver ──
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.048, 0.22), new THREE.MeshLambertMaterial({ color: bk }));
    receiver.position.set(0.17, -0.130, -0.22);
    // Receiver cover
    const rCover = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.008, 0.18), new THREE.MeshLambertMaterial({ color: frm }));
    rCover.position.set(0.17, -0.102, -0.22);
    // Ejection port
    const ej = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.014, 0.020), new THREE.MeshLambertMaterial({ color: 0x111114 }));
    ej.position.set(0.193, -0.120, -0.25);
    // ── PSO-1 Scope ──
    const scopeTube = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.030, 0.22), new THREE.MeshLambertMaterial({ color: 0x181818 }));
    scopeTube.position.set(0.17, -0.085, -0.28);
    // Scope eyepiece (wider)
    const eyepiece = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.025), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    eyepiece.position.set(0.17, -0.085, -0.17);
    // Scope objective lens
    const objLens = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.034, 0.020), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    objLens.position.set(0.17, -0.085, -0.39);
    // Scope elevation turret
    const turretE = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.012), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    turretE.position.set(0.17, -0.068, -0.28);
    // Scope windage turret
    const turretW = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.012), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    turretW.position.set(0.188, -0.085, -0.28);
    // Scope mount rail
    const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.10), new THREE.MeshLambertMaterial({ color: frm }));
    scopeMount.position.set(0.17, -0.098, -0.25);
    // ── Magazine ──
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.090, 0.038), new THREE.MeshLambertMaterial({ color: bk }));
    mag.position.set(0.17, -0.21, -0.24); mag.rotation.x = 0.10;
    // Mag ribs
    for (let i = 0; i < 3; i++) {
      const mr = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.003, 0.004), new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
      mr.position.set(0.17, -0.18 - i * 0.022, -0.24 + i * 0.002);
      g.add(mr);
    }
    // ── Pistol grip (SVD skeleton) ──
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.075, 0.030), new THREE.MeshLambertMaterial({ color: wd }));
    grip.position.set(0.17, -0.200, -0.155); grip.rotation.x = 0.12;
    // ── Thumbhole stock ──
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.048, 0.18), new THREE.MeshLambertMaterial({ color: wd }));
    stock.position.set(0.17, -0.140, -0.04);
    const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.018, 0.08), new THREE.MeshLambertMaterial({ color: wd }));
    cheekRest.position.set(0.17, -0.115, -0.02);
    const buttplate = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.050, 0.008), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    buttplate.position.set(0.17, -0.140, 0.07);
    // ── Trigger + guard ──
    const trig = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.016, 0.006), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    trig.position.set(0.17, -0.165, -0.185);
    const tGuard = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.004, 0.032), new THREE.MeshLambertMaterial({ color: bk }));
    tGuard.position.set(0.17, -0.178, -0.185);

    g.add(barrel, flash, gasT, gasB, hgTop, hgBot,
          receiver, rCover, ej, scopeTube, eyepiece, objLens,
          turretE, turretW, scopeMount,
          mag, grip, stock, cheekRest, buttplate,
          trig, tGuard);
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
    const bk = 0x2a2a2e, fde = 0x8a7a5a, frm = 0x333336;
    // ── Barrel (M4 carbine profile) ──
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.020, 0.32), new THREE.MeshLambertMaterial({ color: frm }));
    barrel.position.set(0.18, -0.14, -0.44);
    // Barrel nut
    const bNut = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.015), new THREE.MeshLambertMaterial({ color: bk }));
    bNut.position.set(0.18, -0.14, -0.28);
    // Flash hider (A2 birdcage)
    const flashH = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.030), new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
    flashH.position.set(0.18, -0.14, -0.62);
    for (let i = 0; i < 3; i++) {
      const fSlot = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.004, 0.005), new THREE.MeshLambertMaterial({ color: 0x111114 }));
      fSlot.position.set(0.18, -0.14, -0.610 + i * 0.008);
      g.add(fSlot);
    }
    // ── Handguard (M-LOK free-float) ──
    const hg = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.22), new THREE.MeshLambertMaterial({ color: bk }));
    hg.position.set(0.18, -0.14, -0.39);
    // M-LOK slots
    for (let i = 0; i < 5; i++) {
      const mlok = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.010, 0.018), new THREE.MeshLambertMaterial({ color: 0x111114 }));
      mlok.position.set(0.200, -0.14, -0.32 - i * 0.035);
      g.add(mlok);
      const mlok2 = mlok.clone(); mlok2.position.x = 0.160; g.add(mlok2);
    }
    // Gas block (low profile)
    const gasB = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.020, 0.012), new THREE.MeshLambertMaterial({ color: bk }));
    gasB.position.set(0.18, -0.125, -0.50);
    // ── Top rail (full-length Picatinny) ──
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.35), new THREE.MeshLambertMaterial({ color: frm }));
    topRail.position.set(0.18, -0.098, -0.34);
    // Rail teeth
    for (let i = 0; i < 20; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.003, 0.002), new THREE.MeshLambertMaterial({ color: frm }));
      tooth.position.set(0.18, -0.094, -0.18 - i * 0.015);
      g.add(tooth);
    }
    // ── Upper receiver ──
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.044, 0.14), new THREE.MeshLambertMaterial({ color: bk }));
    upper.position.set(0.18, -0.130, -0.22);
    // ── Lower receiver ──
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.035, 0.12), new THREE.MeshLambertMaterial({ color: bk }));
    lower.position.set(0.18, -0.165, -0.22);
    // Ejection port
    const ePort = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.014, 0.020), new THREE.MeshLambertMaterial({ color: 0x111114 }));
    ePort.position.set(0.203, -0.120, -0.24);
    // Brass deflector
    const defl = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.015), new THREE.MeshLambertMaterial({ color: frm }));
    defl.position.set(0.203, -0.110, -0.24);
    // Forward assist
    const fAssist = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.010, 0.012), new THREE.MeshLambertMaterial({ color: bk }));
    fAssist.position.set(0.203, -0.118, -0.21);
    // Charging handle
    const chH = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.020), new THREE.MeshLambertMaterial({ color: frm }));
    chH.position.set(0.18, -0.098, -0.16);
    // Bolt carrier (visible through port)
    const boltC = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.010, 0.022), new THREE.MeshLambertMaterial({ color: 0x999999 }));
    boltC.position.set(0.203, -0.125, -0.24); boltC.name = '_bolt';
    // ── STANAG magazine ──
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.100, 0.038), new THREE.MeshLambertMaterial({ color: fde }));
    mag.position.set(0.18, -0.225, -0.24); mag.rotation.x = 0.06;
    // Mag base plate
    const magPlate = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.006, 0.040), new THREE.MeshLambertMaterial({ color: 0x7a6a4a }));
    magPlate.position.set(0.18, -0.278, -0.24);
    // Mag release
    const magRel = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.010, 0.006), new THREE.MeshLambertMaterial({ color: frm }));
    magRel.position.set(0.203, -0.160, -0.240);
    // ── Pistol grip (A2) ──
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.078, 0.036), new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
    grip.position.set(0.18, -0.210, -0.170); grip.rotation.x = 0.10;
    // Grip texture
    for (let i = 0; i < 4; i++) {
      const gt = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, 0.030), new THREE.MeshLambertMaterial({ color: 0x111114 }));
      gt.position.set(0.163, -0.185 - i * 0.012, -0.170);
      g.add(gt);
      const gt2 = gt.clone(); gt2.position.x = 0.197; g.add(gt2);
    }
    // Grip screw
    const gS = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.005), new THREE.MeshLambertMaterial({ color: 0xaaaaaa }));
    gS.position.set(0.163, -0.200, -0.170);
    // ── Collapsible stock ──
    const bufferTube = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.16), new THREE.MeshLambertMaterial({ color: bk }));
    bufferTube.position.set(0.18, -0.138, -0.06);
    const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.042, 0.10), new THREE.MeshLambertMaterial({ color: bk }));
    stockBody.position.set(0.18, -0.138, 0.01);
    const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.044, 0.008), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    buttpad.position.set(0.18, -0.138, 0.06);
    // Stock latch
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.006), new THREE.MeshLambertMaterial({ color: frm }));
    latch.position.set(0.18, -0.115, -0.02);
    // ── Trigger + guard ──
    const trig = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.006), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    trig.position.set(0.18, -0.185, -0.200);
    const tGuard = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.004, 0.036), new THREE.MeshLambertMaterial({ color: bk }));
    tGuard.position.set(0.18, -0.196, -0.205);
    const tGuardFr = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.020, 0.004), new THREE.MeshLambertMaterial({ color: bk }));
    tGuardFr.position.set(0.18, -0.183, -0.224);
    // Safety selector
    const safety = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.015, 0.005), new THREE.MeshLambertMaterial({ color: frm }));
    safety.position.set(0.203, -0.155, -0.195);
    // ── Sling mount ──
    const sMount = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.010, 0.004), new THREE.MeshLambertMaterial({ color: bk }));
    sMount.position.set(0.18, -0.160, -0.50);

    g.add(barrel, bNut, flashH, hg, gasB, topRail,
          upper, lower, ePort, defl, fAssist, chH, boltC,
          mag, magPlate, magRel, grip, gS,
          bufferTube, stockBody, buttpad, latch,
          trig, tGuard, tGuardFr, safety, sMount);

    // ── Super-detail pass (WD kit) — M4A1 carbine ──
    // Real M4A1: SAFE/SEMI/AUTO selector, A2 pistol grip checkering, BUIS sights,
    // M-LOK rail teeth, shell-deflector ridges, dust-cover hinge, takedown pins.
    WD.ironSights(g,
      new THREE.Vector3(0.18, -0.085, -0.45),  // front BUIS post
      new THREE.Vector3(0.18, -0.085, -0.16),  // rear BUIS aperture
      { aperture: true }
    );
    WD.safetySelector(g, 0.203, -0.155, -0.195, { marks: ['S', 'F', 'A'] });
    WD.muzzleCrown(g, 0.18, -0.140, -0.640, 0.012);
    WD.boltFace(g, 0.203, -0.125, -0.235);
    WD.chargingHandle(g, 0.180, -0.092, -0.155, { len: 0.022 });
    WD.checkering(g, 0.180, -0.205, -0.150, 0.030, 0.060, { rows: 7, cols: 4 });
    WD.fingerGrooves(g, 0.180, -0.180, -0.183, 4, 0.026);
    WD.magWitnessHoles(g, 0.197, -0.220, -0.236, 5);
    WD.magReleaseButton(g, 0.207, -0.160, -0.240, { radius: 0.005 });
    // Takedown pins (front + rear)
    WD.screw(g, 0.205, -0.155, -0.165, 0.004);
    WD.screw(g, 0.205, -0.155, -0.275, 0.004);
    WD.slingSwivel(g, 0.180, -0.160, -0.500);
    WD.slingSwivel(g, 0.180, -0.155,  0.030);
    WD.serialStamp(g, 0.205, -0.165, -0.220, 0.040);
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
    const bk = 0x1a1a1e, frm = 0x222226, poly = 0x1e1e22;

    // ── Slide (moving part) ──
    const slide = new THREE.Group();
    slide.name = '_slide';
    const slideBody = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.024, 0.135), new THREE.MeshPhongMaterial({ color: bk, shininess: 60 }));
    slideBody.position.set(0.17, -0.122, -0.255);
    // Barrel inside
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.14), new THREE.MeshLambertMaterial({ color: 0x2a2a2e }));
    barrel.position.set(0.17, -0.128, -0.26);
    // Muzzle
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.006), new THREE.MeshLambertMaterial({ color: 0x111114 }));
    muzzle.position.set(0.17, -0.126, -0.325);
    // Front sight (Glock-style dot)
    const fs = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.004), new THREE.MeshLambertMaterial({ color: bk }));
    fs.position.set(0.17, -0.105, -0.31);
    const fsDot = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.003), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    fsDot.position.set(0.17, -0.102, -0.31);
    // Rear sight
    const rs = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.006), new THREE.MeshLambertMaterial({ color: bk }));
    rs.position.set(0.17, -0.105, -0.195);
    // Rear serrations
    for (let i = 0; i < 10; i++) {
      const ser = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.002, 0.002), new THREE.MeshLambertMaterial({ color: 0x151518 }));
      ser.position.set(0.17, -0.122, -0.19 + i * 0.004);
      slide.add(ser);
    }
    // Front serrations
    for (let i = 0; i < 5; i++) {
      const ser = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.002, 0.002), new THREE.MeshLambertMaterial({ color: 0x151518 }));
      ser.position.set(0.17, -0.122, -0.300 + i * 0.004);
      slide.add(ser);
    }
    // Ejection port
    const ePort = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.016), new THREE.MeshLambertMaterial({ color: 0x111114 }));
    ePort.position.set(0.186, -0.115, -0.25);
    // Extractor
    const extr = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.004, 0.018), new THREE.MeshLambertMaterial({ color: 0x444448 }));
    extr.position.set(0.186, -0.108, -0.255);
    slide.add(slideBody, barrel, muzzle, fs, fsDot, rs, ePort, extr);

    // ── Frame (polymer) ──
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.020, 0.095), new THREE.MeshLambertMaterial({ color: poly }));
    frame.position.set(0.17, -0.143, -0.235);
    // Accessory rail (Glock-style)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.008, 0.028), new THREE.MeshLambertMaterial({ color: poly }));
    rail.position.set(0.17, -0.155, -0.28);
    for (let i = 0; i < 3; i++) {
      const rSlot = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.003, 0.003), new THREE.MeshLambertMaterial({ color: 0x111114 }));
      rSlot.position.set(0.17, -0.152, -0.272 + i * 0.008);
      g.add(rSlot);
    }
    // Trigger guard (squared Glock style)
    const grd = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.004, 0.032), new THREE.MeshLambertMaterial({ color: poly }));
    grd.position.set(0.17, -0.168, -0.245);
    const grdFr = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.020, 0.004), new THREE.MeshLambertMaterial({ color: poly }));
    grdFr.position.set(0.17, -0.155, -0.262);
    // Trigger
    const trig = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.006), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    trig.position.set(0.17, -0.155, -0.243);
    // Trigger safety tab
    const trigSafe = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.004, 0.003), new THREE.MeshLambertMaterial({ color: 0x666666 }));
    trigSafe.position.set(0.17, -0.150, -0.244);

    // ── Grip (stippled polymer) ──
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.058, 0.030), new THREE.MeshLambertMaterial({ color: poly }));
    grip.position.set(0.17, -0.188, -0.215); grip.rotation.x = 0.08;
    // Grip texture (stippling pattern)
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        const dot = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.003), new THREE.MeshLambertMaterial({ color: 0x0e0e0e }));
        dot.position.set(0.155, -0.168 - i * 0.010, -0.208 - j * 0.008);
        g.add(dot);
        const dot2 = dot.clone(); dot2.position.x = 0.185; g.add(dot2);
      }
    }
    // Backstrap
    const backstrap = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.050, 0.006), new THREE.MeshLambertMaterial({ color: 0x151518 }));
    backstrap.position.set(0.17, -0.185, -0.198); backstrap.rotation.x = 0.08;

    // ── Magazine ──
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.024), new THREE.MeshLambertMaterial({ color: bk }));
    mag.position.set(0.17, -0.225, -0.215);
    // Mag base plate
    const magPlate = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.006, 0.026), new THREE.MeshLambertMaterial({ color: 0x111114 }));
    magPlate.position.set(0.17, -0.255, -0.215);
    // Mag release
    const magRel = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.008, 0.006), new THREE.MeshLambertMaterial({ color: frm }));
    magRel.position.set(0.184, -0.148, -0.228);

    // ── Slide stop ──
    const slideStop = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.010), new THREE.MeshLambertMaterial({ color: frm }));
    slideStop.position.set(0.184, -0.135, -0.242);
    // ── Take-down lever ──
    const tdLever = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.008), new THREE.MeshLambertMaterial({ color: frm }));
    tdLever.position.set(0.184, -0.140, -0.255);

    g.add(slide, frame, rail, grd, grdFr, trig, trigSafe,
          grip, backstrap, mag, magPlate, magRel,
          slideStop, tdLever);
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


  // ── Gatling Machine Gun mesh (6 rotating barrels, heavy housing) ──
  function buildGatlingMesh() {
    const g = new THREE.Group();
    // 6 rotating barrels
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.55, 6),
        new THREE.MeshPhongMaterial({ color: 0x2a2a2e, shininess: 100, specular: 0x555566 })
      );
      b.rotation.x = Math.PI / 2;
      b.position.set(0.17 + Math.cos(a) * 0.036, -0.12 + Math.sin(a) * 0.036, -0.52);
      g.add(b);
    }
    // Front clamp ring
    const frontRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.007, 6, 12),
      new THREE.MeshPhongMaterial({ color: 0x333338, shininess: 80, specular: 0x444455 })
    );
    frontRing.position.set(0.17, -0.12, -0.73);
    g.add(frontRing);
    // Rear clamp ring
    const rearRing = frontRing.clone();
    rearRing.position.z = -0.34;
    g.add(rearRing);
    // Motor/receiver housing
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.20, 10),
      new THREE.MeshPhongMaterial({ color: 0x3a3a3e, shininess: 60, specular: 0x333344 })
    );
    housing.rotation.x = Math.PI / 2;
    housing.position.set(0.17, -0.12, -0.20);
    g.add(housing);
    // Ammo drum
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.075, 12),
      new THREE.MeshPhongMaterial({ color: 0x4a4a2e, shininess: 35, specular: 0x222211 })
    );
    drum.position.set(0.17, -0.22, -0.17);
    g.add(drum);
    // Carry handle
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.010, 0.11),
      new THREE.MeshPhongMaterial({ color: 0x333338, shininess: 60, specular: 0x333344 })
    );
    handle.position.set(0.17, -0.04, -0.20);
    g.add(handle);
    const handleL = new THREE.Mesh(
      new THREE.BoxGeometry(0.010, 0.035, 0.010),
      new THREE.MeshPhongMaterial({ color: 0x333338, shininess: 60, specular: 0x333344 })
    );
    handleL.position.set(0.14, -0.055, -0.25);
    g.add(handleL);
    const handleR = handleL.clone();
    handleR.position.x = 0.20;
    g.add(handleR);
    // Pistol grip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.10, 0.04),
      new THREE.MeshPhongMaterial({ color: 0x1a1a1e, shininess: 30, specular: 0x222222 })
    );
    grip.position.set(0.17, -0.22, -0.08);
    g.add(grip);
    // Trigger guard
    const tGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.012, 0.035),
      new THREE.MeshPhongMaterial({ color: 0x2a2a2e, shininess: 60, specular: 0x333344 })
    );
    tGuard.position.set(0.17, -0.17, -0.08);
    g.add(tGuard);
    return g;
  }

  // Placeholder mesh builder for missing weapons
  function buildPlaceholderMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.6);
    const mesh = new THREE.Mesh(geo, mat);
    g.add(mesh);
    return g;
  }

  const meshBuilders = [
    buildGatlingMesh, buildShovelMesh, buildMakarovMesh, buildAkMesh, buildRpkMesh,
    buildSvdMesh, buildPkmMesh, buildNlawMesh, buildStugnaMesh, buildM4Mesh,
    buildJavelinMesh, buildRpg7Mesh, buildIglaMesh, buildGp25Mesh,
    buildScarHMesh, buildDshkMesh, buildMolotovMesh,
    buildMg3Mesh, buildMp5Mesh, buildBarrettMesh, buildMinigunMesh,
    buildCrossbowMesh, buildFlamethrowerMesh, buildDoubleBarrelMesh,
    buildClaymoreMesh, buildSmokeMesh, buildFlashbangMesh,
    buildAk12Mesh, buildP90Mesh, buildAt4Mesh, buildGlockMesh,
    buildKs23Mesh, buildAgs17Mesh, buildVssMesh, buildStingerMesh,
    buildThrowKnifeMesh, buildC4Mesh
  ];

  // Ensure meshBuilders matches WEAPONS length
  while (meshBuilders.length < WEAPONS.length) {
    meshBuilders.push(buildPlaceholderMesh);
  }

  function createGunMesh(camera) {
    _camera = camera;
    for (let i = 0; i < WEAPONS.length; i++) {
      const m = meshBuilders[i]();
      // Enhance with reflective materials, sub-details, and animation rigging
      if (typeof WeaponDetails !== 'undefined' && WeaponDetails.enhanceMesh) {
        WeaponDetails.enhanceMesh(m, WEAPONS[i], i);
      }
      // Universal weapon-detail pass — rivets, screws, serial stamp, vents, stippled wear.
      // Adds 30+ micro-meshes per weapon for realistic surface detail.
      try { WD.autoDetail(m, WEAPONS[i]); } catch (e) {}
      // Weld visual gaps so parts don't look detached / floating in air
      try { _unifyWeaponMesh(m); } catch (e) {}
      // Apply equipped skin (if any) to the freshly built mesh
      try { if (weaponSkins[i]) applySkinToMesh(m, weaponSkins[i]); } catch (e) {}
      gunMeshes.push(m);
      m.visible = (i === currentIdx);
      camera.add(m);
    }
  }

  // Post-process a built weapon mesh: detect children that are visually orphaned
  // from the dominant cluster (large gap in space) and add thin dark connector
  // strips so the weapon reads as a single contiguous object.
  function _unifyWeaponMesh(g) {
    if (!g || !g.children || g.children.length < 2) return;
    // Snapshot direct children only (some builders nest scopes/sub-groups)
    const kids = [];
    for (let i = 0; i < g.children.length; i++) {
      const c = g.children[i];
      if (!c || c.userData && c.userData._unifyConnector) continue;
      kids.push(c);
    }
    if (kids.length < 2) return;
    // Compute per-child world-equivalent (here local) bounding boxes
    const bboxes = [];
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i];
      try {
        const b = new THREE.Box3().setFromObject(c);
        if (!b.isEmpty()) bboxes.push({ obj: c, box: b, center: b.getCenter(new THREE.Vector3()) });
      } catch (e) {}
    }
    if (bboxes.length < 2) return;
    // Overall bbox
    const overall = new THREE.Box3();
    for (let i = 0; i < bboxes.length; i++) overall.union(bboxes[i].box);
    const size = overall.getSize(new THREE.Vector3());
    const longLen = Math.max(size.x, size.y, size.z);
    if (longLen <= 0) return;
    // Gap threshold: parts farther than 5% of longest side from any other
    // along the firing axis (Z is forward in this engine; X is gun-right).
    const gapTol = longLen * 0.05;
    const connMat = new THREE.MeshLambertMaterial({ color: 0x1d1d20 });
    const added = [];
    // For each child, find nearest neighbour. If gap > tol, drop a thin
    // connector box that bridges the two centroids.
    for (let i = 0; i < bboxes.length; i++) {
      const a = bboxes[i];
      let nearest = null, nearestDist = Infinity;
      for (let j = 0; j < bboxes.length; j++) {
        if (i === j) continue;
        const b = bboxes[j];
        // Distance between bbox surfaces along Z (the long gun axis)
        const dz = Math.max(0,
          Math.max(a.box.min.z, b.box.min.z) - Math.min(a.box.max.z, b.box.max.z));
        const dx = Math.max(0,
          Math.max(a.box.min.x, b.box.min.x) - Math.min(a.box.max.x, b.box.max.x));
        const dy = Math.max(0,
          Math.max(a.box.min.y, b.box.min.y) - Math.min(a.box.max.y, b.box.max.y));
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < nearestDist) { nearestDist = dist; nearest = b; }
      }
      if (!nearest || nearestDist <= gapTol) continue;
      // Build a thin connector from a.center to nearest.center
      const start = a.center, end = nearest.center;
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const span = new THREE.Vector3().subVectors(end, start);
      const len = span.length();
      if (len <= 0) continue;
      const thick = Math.max(0.006, longLen * 0.012);
      const geo = new THREE.BoxGeometry(thick, thick, len);
      const conn = new THREE.Mesh(geo, connMat);
      conn.position.copy(mid);
      // Orient connector along the span
      conn.lookAt(end);
      conn.userData._unifyConnector = true;
      added.push(conn);
    }
    for (let i = 0; i < added.length; i++) g.add(added[i]);
  }


  // ── Muzzle flash ──────────────────────────────────────────
  let muzzleFlash = null;
  let muzzleTimer = 0;
  let _muzzleLight = null;
  // Lingering muzzle smoke puff (plane that fades + drifts up)
  let _muzzleSmoke = null;
  let _muzzleSmokeTimer = 0;
  const _MUZZLE_SMOKE_LIFE = 0.45;

  function createMuzzleFlash(scene, camera) {
    _scene = scene;
    _camera = camera;
    // Initialize weapon details visual system
    if (typeof WeaponDetails !== 'undefined' && WeaponDetails.init) {
      WeaponDetails.init(scene, camera);
    }
    // Muzzle flash: 5x smaller footprint, elongated forward for realism
    const geo = new THREE.PlaneGeometry(0.06, 0.10);
    const mat = new THREE.MeshBasicMaterial({
      color:       0xffdd44,
      transparent: true,
      opacity:     0,
      depthTest:   false,
      blending:    THREE.AdditiveBlending,
    });
    muzzleFlash = new THREE.Mesh(geo, mat);
    muzzleFlash.position.set(0.17, -0.11, -0.62);
    camera.add(muzzleFlash);

    // Dynamic point light for muzzle flash illumination
    _muzzleLight = new THREE.PointLight(0xff8833, 0, 8);
    _muzzleLight.position.set(0, -0.05, -0.7);
    camera.add(_muzzleLight);

    // Lingering smoke puff plane (additive grey, faces camera)
    var smokeGeo = new THREE.PlaneGeometry(0.18, 0.18);
    var smokeMat = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false,
      blending: THREE.NormalBlending,
    });
    _muzzleSmoke = new THREE.Mesh(smokeGeo, smokeMat);
    _muzzleSmoke.position.set(0.17, -0.10, -0.60);
    _muzzleSmoke.visible = false;
    camera.add(_muzzleSmoke);

    scene.add(camera);
  }

  function showMuzzle() {
    if (!muzzleFlash) return;
    var _mfm = getMuzzleFlashMult(currentIdx);
    muzzleFlash.material.opacity = 1 * _mfm;
    muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    muzzleFlash.scale.setScalar(_mfm);
    muzzleTimer = 0.06;
    // Flash point light burst
    if (_muzzleLight) _muzzleLight.intensity = 2.5 * _mfm;
    // Trigger lingering smoke puff
    if (_muzzleSmoke) {
      _muzzleSmoke.visible = true;
      _muzzleSmoke.material.opacity = 0.55;
      _muzzleSmoke.position.set(
        0.17 + (Math.random() - 0.5) * 0.02,
        -0.10,
        -0.60 + (Math.random() - 0.5) * 0.02
      );
      _muzzleSmoke.rotation.z = Math.random() * Math.PI * 2;
      _muzzleSmoke.scale.setScalar(0.6 + Math.random() * 0.2);
      _muzzleSmokeTimer = _MUZZLE_SMOKE_LIFE;
    }
    // Shell casing eject for hitscan/shotgun weapons
    if (_camera && typeof Tracers !== 'undefined' && Tracers.spawnCasing) {
      Tracers.spawnCasing(_camera);
    }
    // Scare birds nearby — chaotic flock scatter on every shot
    try {
      if (window.Birds && window.Birds.scareNear && _camera) {
        window.Birds.scareNear(_camera.position, 40);
      }
    } catch (eSB) {}
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

  // ── Viewmodel inertia (mouse-look lag) ────────────────────
  let _prevYaw = 0;
  let _prevPitch = 0;
  let _inertiaX = 0;  // horizontal lag offset
  let _inertiaY = 0;  // vertical lag offset
  const INERTIA_MAX = 0.06;
  const INERTIA_WEIGHT = { PISTOL: 0.75, SMG: 0.7, ASSAULT: 0.6, NATO: 0.6, SILENT: 0.65,
    SHOTGUN: 0.55, SNIPER: 0.45, AMR: 0.4, LMG: 0.35, HMG: 0.3, MACHINEGUN: 0.35,
    MINIGUN: 0.25, AT: 0.35, ATGM: 0.35, MELEE: 0.85, GRENADE: 0.8 };

  // ── Viewmodel fire kick rotation ──────────────────────────
  let _fireKickRot = 0;   // upward barrel kick (radians)
  let _fireKickZ = 0;     // backward snap offset

  // ── Smooth ADS transition ─────────────────────────────────
  let _adsLerp = 0;       // 0 = hip, 1 = fully zoomed
  let _adsTarget = 0;     // 0 or 1

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
    // Viewmodel fire kick: barrel snaps up + backward
    _fireKickRot += (w.recoilY || 0.01) * 12;
    _fireKickZ -= intensity * 0.02;
    // Camera screen shake — adds visceral kick scaled to recoil intensity
    if (typeof CameraSystem !== 'undefined' && CameraSystem.shake) {
      CameraSystem.shake(0.004 + intensity * 0.012, 0.12 + intensity * 0.08);
    }
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
    if (idx >= 0 && idx < WEAPONS.length) {
      unlocked[idx] = true;
      refreshWeaponHud();
    }
  }

  // ── Scope zoom ────────────────────────────────────────────
  function enterZoom() {
    if (!_camera) return;
    if (cur().type === 'MELEE') return; // no zoom on melee
    zoomed = true;
    _adsTarget = 1;
  }

  function exitZoom() {
    if (!_camera) return;
    zoomed = false;
    _adsTarget = 0;
  }

  function handleRightDown() {
    rightMouseDown = true;
    enterZoom();
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

    // ── Heat-seeking / fire-and-forget guidance ──
    // AA (Igla/Stinger) → lock onto enemy aircraft (drones)
    // ATGM/AT_HEAVY (Stugna/Javelin) → lock onto nearest enemy in cone
    var homingTarget = null;
    if (wep.homing) {
      var origin = pos.clone();
      var fwd = dir.clone();
      var bestScore = -Infinity;
      var maxRange = 220;
      var minDot = 0.85; // ~32° cone half-angle
      function _scoreCand(tpos) {
        var dx = tpos.x - origin.x, dy = tpos.y - origin.y, dz = tpos.z - origin.z;
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > maxRange || dist < 1) return null;
        var dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / dist;
        if (dot < minDot) return null;
        return dot - dist * 0.001;
      }
      if (wep.type === 'AA' && typeof DroneSystem !== 'undefined' && DroneSystem.getEnemyDrones) {
        var dlist = DroneSystem.getEnemyDrones() || [];
        for (var di = 0; di < dlist.length; di++) {
          var dr = dlist[di];
          if (!dr || !dr.position || dr.destroyed || dr.alive === false) continue;
          var s = _scoreCand(dr.position);
          if (s !== null && s > bestScore) { bestScore = s; homingTarget = { kind: 'drone', ref: dr }; }
        }
      } else if (typeof Enemies !== 'undefined' && Enemies.getAll) {
        var elist = Enemies.getAll();
        for (var ei = 0; ei < elist.length; ei++) {
          var e2 = elist[ei];
          if (!e2 || !e2.alive || !e2.mesh) continue;
          var s2 = _scoreCand(e2.mesh.position);
          if (s2 !== null && s2 > bestScore) { bestScore = s2; homingTarget = { kind: 'enemy', ref: e2 }; }
        }
      }
      if (homingTarget && typeof window.AudioSystem !== 'undefined' && window.AudioSystem.playPickup) {
        // brief lock-on chirp
        try { window.AudioSystem.playPickup(); } catch (_e) {}
      }
    }

    projectiles.push({
      mesh, dir: dir.clone(), speed: speed,
      damage: wep.damage, radius: wep.blastRadius || 4,
      life: 5.0,
      gravity: (isGrenade || isMolotov || isSmoke || isFlash) ? 12 : 0,
      isMolotov: isMolotov,
      isSmoke: isSmoke,
      isFlash: isFlash,
      weaponType: wep.type,
      homing: !!wep.homing,
      target: homingTarget,
      turnRate: (wep.type === 'AA') ? 3.0 : 1.6,
    });
  }

  function updateProjectiles(delta) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      // ── Homing guidance: steer dir toward locked target ──
      if (p.homing && p.target && p.target.ref) {
        var tref = p.target.ref;
        var tpos = (p.target.kind === 'drone') ? tref.position : (tref.mesh && tref.mesh.position);
        var tAlive = (p.target.kind === 'drone') ? !tref.destroyed : !!tref.alive;
        if (tpos && tAlive) {
          _wTmp2.copy(tpos).sub(p.mesh.position).normalize();
          var maxTurn = Math.min(1, (p.turnRate || 2.0) * delta);
          p.dir.lerp(_wTmp2, maxTurn).normalize();
          p.mesh.lookAt(_wTmp1.copy(p.mesh.position).add(p.dir));
        } else {
          p.target = null;
        }
      }
      p.mesh.position.addScaledVector(p.dir, p.speed * delta);
      // Smoke trail behind projectiles (visibility aid for grenades/rockets)
      p._trailTimer = (p._trailTimer || 0) - delta;
      if (p._trailTimer <= 0 && typeof Tracers !== 'undefined' && Tracers.spawnSmoke) {
        Tracers.spawnSmoke(p.mesh.position);
        p._trailTimer = (p.weaponType === 'AT' || p.weaponType === 'ATGM' || p.weaponType === 'AA') ? 0.025 : 0.06;
      }
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
        // Play unique mine sound for MINE type
        if (p.weaponType === 'MINE' && typeof window.AudioSystem !== 'undefined' && window.AudioSystem.playMine) {
          window.AudioSystem.playMine();
        } else if (typeof window.AudioSystem !== 'undefined' && window.AudioSystem.playExplosion) {
          window.AudioSystem.playExplosion();
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
    if (typeof window.AudioSystem !== 'undefined' && window.AudioSystem.playSmoke) window.AudioSystem.playSmoke();

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
    st.fireCooldown = effectiveFireRate(currentIdx);
    _firedThisFrame = true;

    // Trigger visual animations (bolt cycle, barrel spin, muzzle smoke)
    if (typeof WeaponDetails !== 'undefined' && WeaponDetails.onFire) {
      WeaponDetails.onFire(gunMeshes[currentIdx], wep);
    }

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
      var _isGod = (typeof GameManager !== 'undefined' && GameManager.isGodMode && GameManager.isGodMode());
      if (_isGod && wep.type === 'GRENADE') {
        // Unlimited grenades in god mode — top up clip + reserve so ammo never depletes
        st.clip = wep.clipSize; st.reserve = wep.maxReserve;
      }
      if (st.clip <= 0) { startReload(); _firedThisFrame = false; return; }
      if (!_isGod) st.clip--;
      HUD.setAmmo(st.clip, st.reserve);
      showMuzzle();
      spawnProjectile(camera, wep);
      recoilOffset = 0.04;
      if (!_isGod && st.clip === 0 && st.reserve > 0) startReload();
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

    // Bullet drop: for long-range weapons, distant hits drift downward
    var _dropTypes = { SNIPER: 0.5, AMR: 0.3, ASSAULT: 1.0, NATO: 0.9, LMG: 1.2, HMG: 1.0 };
    var _dropG = _dropTypes[wep.type];

    if (hits.length > 0) {
      var hitDist = hits[0].distance;
      // Bullet drop: check if gravity would cause a miss at this distance
      var dropMiss = false;
      if (_dropG && hitDist > 40) {
        var travelTime = hitDist / 200; // bullet speed ~200 units/s
        var dropAmount = 0.5 * _dropG * travelTime * travelTime;
        // If drop exceeds enemy hitbox height (~2 units), it's a miss
        if (dropAmount > 1.8) {
          dropMiss = true;
        } else if (dropAmount > 0.3) {
          // Partial drop: reduce damage proportionally for marginal hits
          var dropPenalty = 1 - (dropAmount - 0.3) / 1.5;
          hits[0]._dropDamageMult = Math.max(0.3, dropPenalty);
        }
      }
      if (!dropMiss) {
        var dropDmgMult = hits[0]._dropDamageMult || 1;
        onHit(hits[0], Math.round(wep.damage * dropDmgMult));
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
      } // end !dropMiss
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
        var hitBlockType = VoxelWorld.getBlock(bRay.hit.x, bRay.hit.y, bRay.hit.z);
        // Bullet hole decal on terrain (surface-aware)
        if (typeof Tracers !== 'undefined' && Tracers.spawnBulletHole) {
          _wTmp3.set(bRay.hit.x + 0.5, bRay.hit.y + 0.5, bRay.hit.z + 0.5);
          _wTmp4.set(
            bRay.place.x - bRay.hit.x,
            bRay.place.y - bRay.hit.y,
            bRay.place.z - bRay.hit.z
          ).normalize();
          if (_wTmp4.lengthSq() > 0) {
            _wTmp3.addScaledVector(_wTmp4, 0.5);
            Tracers.spawnBulletHole(_wTmp3, _wTmp4, hitBlockType);
          }
        }
        // Surface-aware impact audio
        if (typeof AudioSystem !== 'undefined' && AudioSystem.playImpact) {
          AudioSystem.playImpact(hitBlockType);
        }
        // Surface-aware impact particles
        if (typeof Tracers !== 'undefined' && Tracers.spawnBlockImpact) {
          var impactPos = _wTmpSpark.set(bRay.hit.x + 0.5, bRay.hit.y + 0.5, bRay.hit.z + 0.5);
          var impactColor = (hitBlockType === 5 || hitBlockType === 14) ? 0xC0C0C0 :
                            (hitBlockType === 11) ? 0xCCEEFF :
                            (hitBlockType === 4) ? 0x8B6914 : undefined;
          Tracers.spawnBlockImpact(impactPos, impactColor);
        }
        // Metal/glass sparks
        if ((hitBlockType === 5 || hitBlockType === 14 || hitBlockType === 11) && typeof Tracers !== 'undefined') {
          Tracers.spawnSparks(_wTmpSpark.set(bRay.hit.x + 0.5, bRay.hit.y + 0.5, bRay.hit.z + 0.5));
        }
        // Ricochet check on metal/reinforced surfaces
        if (typeof CombatExtras !== 'undefined') {
          var blockType = hitBlockType;
          var ric = CombatExtras.calcRicochet(blockType, _wTmp1);
          if (ric) {
            if (typeof AudioSystem !== 'undefined') AudioSystem.playRicochet();
            if (typeof Tracers !== 'undefined') Tracers.spawnSparks(_wTmpSpark.set(bRay.hit.x, bRay.hit.y, bRay.hit.z));
          }
        }
        // Fuel barrel detonation (block type 12 = FUEL_BARREL)
        if (hitBlockType === 12 && typeof WorldFeatures !== 'undefined' && WorldFeatures.detonateBarrel) {
          WorldFeatures.detonateBarrel(bRay.hit.x, bRay.hit.y, bRay.hit.z);
        } else {
          // Cover degradation: accumulate damage instead of instant destroy
          var wepDmg = wep.damage || 10;
          // Explosives and high-caliber weapons deal more block damage
          if (wep.type === 'EXPLOSIVE' || wep.type === 'RPG' || wep.type === 'GRENADE_LAUNCHER') wepDmg *= 5;
          else if (wep.type === 'AMR' || wep.type === 'HMG' || wep.type === 'HMG_HEAVY') wepDmg *= 3;
          else if (wep.type === 'SNIPER' || wep.type === 'LMG') wepDmg *= 2;
          else if (wep.type === 'SHOTGUN') wepDmg *= 1.5;
          if (typeof VoxelWorld !== 'undefined' && VoxelWorld.damageBlock) {
            VoxelWorld.damageBlock(bRay.hit.x, bRay.hit.y, bRay.hit.z, wepDmg);
          } else {
            destroyBlock(bRay.hit.x, bRay.hit.y, bRay.hit.z, false);
          }
        }
      }
    }
    if (st.clip === 0 && st.reserve > 0) startReload();
  }

  function startReload() {
    const wep = cur();
    const st  = curState();
    if (wep.type === 'MELEE') return;
    var effClip = effectiveClipSize(currentIdx);
    if (st.reloading || st.clip === effClip) return;
    if (st.reserve <= 0) {
      // No ammo — dry fire click
      if (typeof AudioSystem !== 'undefined' && AudioSystem.playDryFire) AudioSystem.playDryFire();
      return;
    }
    st.reloading   = true;
    st.reloadTimer = effectiveReloadTime(currentIdx);
    reloadAnimAngle = 0;
    HUD.showReload(true);
    // Mag-drop visual: spawn a small black mag that falls + fades
    try {
      if (_scene && _camera && wep.type !== 'MELEE' && wep.clipSize >= 5) {
        var _magGeo = new THREE.BoxGeometry(0.08, 0.18, 0.05);
        var _magMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.9 });
        var _mag = new THREE.Mesh(_magGeo, _magMat);
        // Spawn near gun position (slightly below + right of camera)
        var _camDir = new THREE.Vector3();
        _camera.getWorldDirection(_camDir);
        var _camRight = new THREE.Vector3().crossVectors(_camDir, new THREE.Vector3(0, 1, 0)).normalize();
        _mag.position.copy(_camera.position)
          .addScaledVector(_camDir, 0.6)
          .addScaledVector(_camRight, 0.18)
          .y -= 0.25;
        _mag.userData.vy = -0.2;
        _mag.userData.vx = (Math.random() - 0.5) * 0.3;
        _mag.userData.vz = (Math.random() - 0.5) * 0.3;
        _mag.userData.life = 1.4;
        _mag.userData.rotSpd = (Math.random() - 0.5) * 6;
        _scene.add(_mag);
        _droppedMags.push(_mag);
      }
    } catch (eMD) {}
  }
  var _droppedMags = [];
  function _updateDroppedMags(delta) {
    for (var i = _droppedMags.length - 1; i >= 0; i--) {
      var m = _droppedMags[i];
      m.userData.vy -= 9.8 * delta;
      m.position.x += m.userData.vx * delta;
      m.position.y += m.userData.vy * delta;
      m.position.z += m.userData.vz * delta;
      m.rotation.x += m.userData.rotSpd * delta;
      m.rotation.z += m.userData.rotSpd * 0.7 * delta;
      m.userData.life -= delta;
      if (m.userData.life < 0.5) m.material.opacity = Math.max(0, m.userData.life / 0.5) * 0.9;
      if (m.userData.life <= 0) {
        if (_scene) _scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
        _droppedMags.splice(i, 1);
      }
    }
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
    _updateDroppedMags(delta);
    _updateBloodStains(delta);
    // Muzzle flash fade
    if (muzzleTimer > 0) {
      muzzleTimer -= delta;
      if (muzzleFlash) muzzleFlash.material.opacity = Math.max(0, muzzleTimer / 0.06);
      if (_muzzleLight) _muzzleLight.intensity = Math.max(0, (muzzleTimer / 0.06) * 2.5);
    }
    // Lingering muzzle smoke puff: drift up & fade
    if (_muzzleSmokeTimer > 0 && _muzzleSmoke) {
      _muzzleSmokeTimer -= delta;
      var sFrac = Math.max(0, _muzzleSmokeTimer / _MUZZLE_SMOKE_LIFE);
      _muzzleSmoke.material.opacity = sFrac * 0.55;
      _muzzleSmoke.position.y += delta * 0.18;
      _muzzleSmoke.position.z -= delta * 0.06;
      _muzzleSmoke.scale.x += delta * 0.6;
      _muzzleSmoke.scale.y += delta * 0.6;
      if (_muzzleSmokeTimer <= 0) _muzzleSmoke.visible = false;
    }

    // Projectiles
    updateProjectiles(delta);

    // Recoil recovery (visual gun kick)
    const mesh = gunMeshes[currentIdx];
    if (recoilOffsetZ < 0) recoilOffsetZ = Math.min(0, recoilOffsetZ + delta * 12 * 0.04);
    if (recoilOffsetY > 0) recoilOffsetY = Math.max(0, recoilOffsetY - delta * 12 * 0.02);
    if (recoilOffset > 0) recoilOffset = Math.max(0, recoilOffset - delta * 0.3);

    // Smooth ADS FOV transition
    if (_camera) {
      var adsSpeed = 8;
      _adsLerp += (_adsTarget - _adsLerp) * Math.min(1, delta * adsSpeed);
      if (Math.abs(_adsLerp - _adsTarget) < 0.005) _adsLerp = _adsTarget;
      var _zoomFov = (typeof WeaponDetails !== 'undefined' && WeaponDetails.getZoomFov)
        ? WeaponDetails.getZoomFov(cur().type) : FOV_ZOOMED;
      _camera.fov = FOV_DEFAULT + (_zoomFov - FOV_DEFAULT) * _adsLerp;
      _camera.updateProjectionMatrix();
    }

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

      // Viewmodel inertia: weapon lags behind camera rotation
      if (typeof CameraSystem !== 'undefined' && CameraSystem.getYaw) {
        var curYaw = CameraSystem.getYaw();
        var curPitch = CameraSystem.getPitch();
        var dY = curYaw - _prevYaw;
        var dP = curPitch - _prevPitch;
        _prevYaw = curYaw;
        _prevPitch = curPitch;
        var wType = cur().type;
        var follow = INERTIA_WEIGHT[wType] || 0.6;
        var inertiaLerp = 1 - Math.pow(1 - follow, delta * 60);
        _inertiaX += dY * 0.4;
        _inertiaY += dP * 0.3;
        _inertiaX *= (1 - inertiaLerp);
        _inertiaY *= (1 - inertiaLerp);
        _inertiaX = Math.max(-INERTIA_MAX, Math.min(INERTIA_MAX, _inertiaX));
        _inertiaY = Math.max(-INERTIA_MAX, Math.min(INERTIA_MAX, _inertiaY));
      }

      // Fire kick decay
      _fireKickRot *= (1 - Math.min(1, delta * 15));
      _fireKickZ *= (1 - Math.min(1, delta * 12));

      // ADS iron-sight / scope alignment offset
      var _adsOff = (typeof WeaponDetails !== 'undefined' && WeaponDetails.getAdsOffset)
        ? WeaponDetails.getAdsOffset(cur(), _adsLerp) : { x: 0, y: 0, z: 0 };
      mesh.position.x = swayX + _inertiaX - _adsLerp * swayX * 0.8 + _adsOff.x;
      mesh.position.z = recoilOffsetZ + recoilOffset + _sprintLowerZ + _fireKickZ + _adsOff.z;
      mesh.position.y = recoilOffsetY + switchY + swayY + _sprintLowerY + _inertiaY + _adsLerp * 0.03 + _adsOff.y;
      mesh.rotation.x = reloadAnimAngle + _sprintLowerRotX - _fireKickRot;
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

    // WeaponDetails visual animations (bolt, barrel spin, laser, smoke, scope overlay)
    if (typeof WeaponDetails !== 'undefined' && WeaponDetails.update) {
      WeaponDetails.update(delta, mesh, cur(), curState(), _firedThisFrame, zoomed);
    }

    // Reload
    const wep = cur();
    const st  = curState();
    if (st.reloading) {
      st.reloadTimer -= delta;
      // Per-type reload animation
      if (mesh) {
        const progress = 1 - st.reloadTimer / wep.reloadTime;
        // Push reload progress to HUD bar
        if (typeof HUD !== 'undefined' && HUD.showReload) HUD.showReload(true, progress);
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
        const need = effectiveClipSize(currentIdx) - st.clip;
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
    _adsLerp = 0;
    _adsTarget = 0;
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
    if (typeof WeaponDetails !== 'undefined' && WeaponDetails.clear) WeaponDetails.clear();
    gunMeshes.forEach(function (m, i) { if (m) m.visible = (i === 0); });
    refreshWeaponHud();
  }

  function addAmmo(amount) {
    const wep = cur();
    const st  = curState();
    if (wep.type === 'MELEE') return;
    st.reserve = Math.min(wep.maxReserve, st.reserve + amount);
    HUD.setAmmo(st.clip, st.reserve);
  }

  function forceReload() { startReload(); }
  function setClip(val) { var st = curState(); if (typeof val === 'number') { st.clip = Math.min(val, effectiveClipSize(currentIdx) || val); HUD.setAmmo(st.clip, st.reserve); } }

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
  function getClipSize() { return effectiveClipSize(currentIdx) || 0; }
  function getDamage()   {
    var base = effectiveDamage(currentIdx);
    /* WoT-style premium ammo: if equipped + compatible, multiply damage AND
       consume one round. Falls back to 1.0 when no pack equipped or empty. */
    if (typeof Marketplace !== 'undefined' && typeof Marketplace.consumeAmmoShot === 'function') {
      var mult = Marketplace.consumeAmmoShot(cur().type);
      if (mult && mult !== 1.0) return Math.round(base * mult);
    }
    return base;
  }
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
    SUPPRESSOR:   { id: 'SUPPRESSOR',   name: 'Suppressor',     damageMult: 0.85, spreadMult: 0.9, sound: 'silent', muzzleFlashMult: 0.25, silent: true, cost: 800,  icon: '🔇' },
    EXT_MAG:      { id: 'EXT_MAG',      name: 'Extended Mag',   clipMult: 1.5,                                                                              cost: 600,  icon: '📦' },
    DRUM_MAG:     { id: 'DRUM_MAG',     name: 'Drum Magazine',  clipMult: 2.5, reloadMult: 1.25,                                                            cost: 1400, icon: '🥁' },
    RAPID_FIRE:   { id: 'RAPID_FIRE',   name: 'Rapid Fire',     fireRateMult: 0.8,                                                                          cost: 900,  icon: '⚡' },
    GRIP:         { id: 'GRIP',         name: 'Foregrip',       recoilMult: 0.7, spreadMult: 0.85,                                                          cost: 500,  icon: '✊' },
    LASER:        { id: 'LASER',        name: 'Laser Sight',    spreadMult: 0.75,                                                                           cost: 400,  icon: '🔴' },
    SCOPE_4X:     { id: 'SCOPE_4X',     name: '4x Scope',       hasScope: true, zoomFOV: 20,                                                                cost: 1100, icon: '🎯' },
    FMJ:          { id: 'FMJ',          name: 'FMJ Rounds',     damageMult: 1.15, penetration: true,                                                        cost: 700,  icon: '💥' },
    SPEED_LOADER: { id: 'SPEED_LOADER', name: 'Speed Loader',   reloadMult: 0.7,                                                                            cost: 600,  icon: '🔄' },
    HEAVY_BARREL: { id: 'HEAVY_BARREL', name: 'Heavy Barrel',   damageMult: 1.20, recoilMult: 1.10, fireRateMult: 1.05,                                     cost: 1000, icon: '🛢' },
  };

  // Compatibility: which attachments suit which weapon TYPE.
  // Suppressors only on subsonic-friendly types (no rockets, no shotguns of huge
  // bore, no AT/AGS/HMG/AA/MELEE etc.). Drum mags only on auto fed.
  const ATTACHMENT_COMPAT = {
    SUPPRESSOR:   ['PISTOL','ASSAULT','NATO','NATO_HEAVY','SMG','SNIPER','AMR','SILENT','MACHINEGUN','HMG','HMG_HEAVY','LMG'],
    EXT_MAG:      ['PISTOL','ASSAULT','NATO','NATO_HEAVY','SMG','LMG','MACHINEGUN','HMG','HMG_HEAVY','MINIGUN','GATLING','SNIPER','AMR','SILENT','SHOTGUN'],
    DRUM_MAG:     ['ASSAULT','NATO','NATO_HEAVY','SMG','LMG','MACHINEGUN','HMG','HMG_HEAVY'],
    RAPID_FIRE:   ['ASSAULT','NATO','NATO_HEAVY','SMG','LMG','MACHINEGUN','HMG','HMG_HEAVY','MINIGUN','GATLING','PISTOL','SILENT','SHOTGUN'],
    GRIP:         ['ASSAULT','NATO','NATO_HEAVY','SMG','LMG','MACHINEGUN','HMG','HMG_HEAVY','SHOTGUN','SNIPER','AMR'],
    LASER:        ['PISTOL','ASSAULT','NATO','NATO_HEAVY','SMG','SHOTGUN','SILENT'],
    SCOPE_4X:     ['ASSAULT','NATO','NATO_HEAVY','SMG','LMG','MACHINEGUN','SNIPER','AMR','SILENT'],
    FMJ:          ['PISTOL','ASSAULT','NATO','NATO_HEAVY','SMG','LMG','MACHINEGUN','HMG','HMG_HEAVY','SNIPER','AMR','SILENT','SHOTGUN','MINIGUN','GATLING'],
    SPEED_LOADER: ['PISTOL','ASSAULT','NATO','NATO_HEAVY','SMG','LMG','MACHINEGUN','HMG','HMG_HEAVY','SNIPER','AMR','SILENT','SHOTGUN'],
    HEAVY_BARREL: ['SNIPER','AMR','SILENT','LMG','MACHINEGUN','HMG','HMG_HEAVY','ASSAULT','NATO','NATO_HEAVY'],
  };

  function isCompatible(weaponIdx, attachId) {
    var w = WEAPONS[weaponIdx];
    if (!w) return false;
    var list = ATTACHMENT_COMPAT[attachId];
    return list && list.indexOf(w.type) >= 0;
  }
  function getCompatibleAttachments(weaponIdx) {
    var out = [];
    for (var key in ATTACHMENTS) {
      if (isCompatible(weaponIdx, key)) out.push(ATTACHMENTS[key]);
    }
    return out;
  }

  // ── Weapon Skins (cosmetic + premium upgrades) ──
  // Each skin defines tint colors mapped onto the procedural mesh.  metal =
  // primary body, accent = highlight (rails, sights), wood = grips/stock, glow
  // = optional emissive for premium tiers.
  const SKINS = {
    DEFAULT:   { id: 'DEFAULT',   name: 'Standard',          rarity: 'common',    cost: 0,    icon: '⬜', metal: null,     accent: null,     wood: null     },
    BLACK:     { id: 'BLACK',     name: 'Tactical Black',    rarity: 'common',    cost: 200,  icon: '⬛', metal: 0x111111, accent: 0x222222, wood: 0x222222 },
    DESERT:    { id: 'DESERT',    name: 'Desert Tan',        rarity: 'uncommon',  cost: 600,  icon: '🏜', metal: 0xc7a679, accent: 0x8a7146, wood: 0x6b4d2a },
    WOODLAND:  { id: 'WOODLAND',  name: 'Woodland Camo',     rarity: 'uncommon',  cost: 600,  icon: '🌲', metal: 0x4a5d3a, accent: 0x2c3a22, wood: 0x3d2e1b },
    URBAN:     { id: 'URBAN',     name: 'Urban Camo',        rarity: 'uncommon',  cost: 600,  icon: '🏙', metal: 0x6b6e72, accent: 0x33363a, wood: 0x2a2c2e },
    JUNGLE:    { id: 'JUNGLE',    name: 'Jungle Tigerstripe', rarity: 'uncommon', cost: 700,  icon: '🐅', metal: 0x445d2a, accent: 0x1a1a0d, wood: 0x2d1f0d },
    ARCTIC:    { id: 'ARCTIC',    name: 'Arctic White',      rarity: 'uncommon',  cost: 700,  icon: '❄',  metal: 0xe8eef2, accent: 0xb0b8c0, wood: 0xc8cfd3 },
    DIGITAL:   { id: 'DIGITAL',   name: 'Digital Pixel',     rarity: 'rare',      cost: 1000, icon: '🔳', metal: 0x556680, accent: 0x223344, wood: 0x33445a },
    REDSTAR:   { id: 'REDSTAR',   name: 'Red Star',          rarity: 'rare',      cost: 1200, icon: '⭐', metal: 0x551111, accent: 0xcc1111, wood: 0x331111 },
    CHROME:    { id: 'CHROME',    name: 'Chrome',            rarity: 'epic',      cost: 1800, icon: '🪙', metal: 0xeeeef2, accent: 0xb8bfc8, wood: 0x4a4a4e, metalness: 1.0, roughness: 0.15 },
    GOLD:      { id: 'GOLD',      name: 'Gold Plated',       rarity: 'legendary', cost: 3000, icon: '🌟', metal: 0xf2c14a, accent: 0xb88b1f, wood: 0x3a2410, metalness: 1.0, roughness: 0.20, glow: 0xffaa00 },
    OBSIDIAN:  { id: 'OBSIDIAN',  name: 'Obsidian',          rarity: 'epic',      cost: 1800, icon: '🖤', metal: 0x0a0a14, accent: 0x141422, wood: 0x0a0a14, metalness: 0.7, roughness: 0.25 },
    FIRE:      { id: 'FIRE',      name: 'Fire Inferno',      rarity: 'legendary', cost: 3000, icon: '🔥', metal: 0xc23a0c, accent: 0xff7a1a, wood: 0x3a0c0c, glow: 0xff4400 },
    NEON:      { id: 'NEON',      name: 'Neon Cyber',        rarity: 'legendary', cost: 3000, icon: '💜', metal: 0x1a1a3a, accent: 0x9a44ff, wood: 0x2a1a3a, glow: 0xaa44ff },
    PRESTIGE:  { id: 'PRESTIGE',  name: 'Founder Prestige',  rarity: 'mythic',    cost: 6000, icon: '👑', metal: 0xd9b347, accent: 0xff2a2a, wood: 0x1a0a0a, metalness: 1.0, roughness: 0.10, glow: 0xff5500 },
  };

  // Storage: { weaponIdx: skinId }
  let weaponSkins = {};

  // ── Effective-stat helpers (applied at firing/reload time) ──
  function _stats(weaponIdx) {
    var w = WEAPONS[weaponIdx];
    if (!w) return null;
    var s = { damage: w.damage, spread: w.spread, fireRate: w.fireRate,
              clipSize: w.clipSize, reloadTime: w.reloadTime, recoilY: w.recoilY,
              silent: false, muzzleFlashMult: 1 };
    var atts = weaponAttachments[weaponIdx] || [];
    for (var i = 0; i < atts.length; i++) {
      var a = ATTACHMENTS[atts[i]]; if (!a) continue;
      if (a.damageMult)        s.damage     = Math.round(s.damage * a.damageMult);
      if (a.spreadMult)        s.spread    *= a.spreadMult;
      if (a.fireRateMult)      s.fireRate  *= a.fireRateMult;
      if (a.clipMult)          s.clipSize   = Math.max(1, Math.floor(s.clipSize * a.clipMult));
      if (a.reloadMult)        s.reloadTime *= a.reloadMult;
      if (a.recoilMult)        s.recoilY   *= a.recoilMult;
      if (a.silent)            s.silent     = true;
      if (a.muzzleFlashMult != null) s.muzzleFlashMult = Math.min(s.muzzleFlashMult, a.muzzleFlashMult);
    }
    return s;
  }
  function _curStats() { return _stats(currentIdx); }
  function effectiveClipSize(idx)  { var s = _stats(idx == null ? currentIdx : idx); return s ? s.clipSize   : 0; }
  function effectiveReloadTime(idx){ var s = _stats(idx == null ? currentIdx : idx); return s ? s.reloadTime : 0; }
  function effectiveFireRate(idx)  { var s = _stats(idx == null ? currentIdx : idx); return s ? s.fireRate   : 0; }
  function effectiveDamage(idx)    { var s = _stats(idx == null ? currentIdx : idx); return s ? s.damage     : 0; }
  function effectiveSpread(idx)    { var s = _stats(idx == null ? currentIdx : idx); return s ? s.spread     : 0; }
  function isSilenced(idx)         { var s = _stats(idx == null ? currentIdx : idx); return !!(s && s.silent); }
  function getMuzzleFlashMult(idx) { var s = _stats(idx == null ? currentIdx : idx); return s ? s.muzzleFlashMult : 1; }

  // ── Skin equip + mesh tint ──
  function setWeaponSkin(weaponIdx, skinId) {
    if (!SKINS[skinId]) return false;
    weaponSkins[weaponIdx] = skinId;
    if (gunMeshes && gunMeshes[weaponIdx]) applySkinToMesh(gunMeshes[weaponIdx], skinId);
    return true;
  }
  function getWeaponSkin(weaponIdx) { return weaponSkins[weaponIdx] || 'DEFAULT'; }

  function applySkinToMesh(mesh, skinId) {
    if (!mesh || !skinId) return;
    var skin = SKINS[skinId];
    if (!skin || skinId === 'DEFAULT') return;
    mesh.traverse(function (child) {
      if (!child.material || !child.material.color) return;
      var mat = child.material;
      // Don't tint glass/scope-lens (transparent) or very dark eye dots.
      if (mat.transparent && mat.opacity < 0.7) return;
      var name = (child.name || '').toLowerCase();
      var c = mat.color.getHex();
      // Heuristic: wood-toned (browns) → wood color; otherwise → metal/accent.
      var r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
      var isWoody = (r > g && g > b && r - b > 30 && r < 200);
      var target = null;
      if (isWoody && skin.wood != null)                target = skin.wood;
      else if (skin.metal != null)                      target = skin.metal;
      // Accent for very small parts (rails, sight blades) — name hint
      if (skin.accent != null && (name.indexOf('rail') >= 0 || name.indexOf('sight') >= 0)) {
        target = skin.accent;
      }
      if (target != null) mat.color.setHex(target);
      if (skin.metalness != null && 'metalness' in mat) mat.metalness = skin.metalness;
      if (skin.roughness != null && 'roughness' in mat) mat.roughness = skin.roughness;
      if (skin.glow != null && 'emissive' in mat) {
        mat.emissive = new THREE.Color(skin.glow);
        mat.emissiveIntensity = 0.35;
      }
    });
  }


  let weaponAttachments = {}; // { weaponIdx: [attachmentId, ...] }

  // ── Blood-stain layer on the current weapon mesh ────────────────────
  // Each kill paints a small red sprite on the gun (handle / barrel).
  // Stains slowly fade after ~30 s without further blood.  Kept on the
  // weapon group so it persists across attacks but vanishes if the weapon
  // is swapped out.
  let _bloodStainSprites = [];   // { mesh, life }
  let _bloodStainGeo = null;
  function _initBloodGeo() {
    if (_bloodStainGeo) return;
    _bloodStainGeo = new THREE.PlaneGeometry(1, 1);
  }
  function markBlooded(amount) {
    try {
      var g = gunMeshes && gunMeshes[currentIdx];
      if (!g) return;
      _initBloodGeo();
      // Pick a child mesh that's most likely a barrel/blade — the
      // longest-axis box.  Fallback to the gun root.
      var host = g;
      var bestLen = 0;
      g.traverse(function (c) {
        if (!c.geometry || !c.geometry.boundingBox) {
          if (c.geometry && c.geometry.computeBoundingBox) try { c.geometry.computeBoundingBox(); } catch(e){}
        }
        if (c.geometry && c.geometry.boundingBox) {
          var s = c.geometry.boundingBox.getSize(new THREE.Vector3());
          var ml = Math.max(s.x, s.y, s.z);
          if (ml > bestLen) { bestLen = ml; host = c; }
        }
      });
      var n = 1 + Math.floor(Math.min(3, (amount || 10) / 30));
      for (var i = 0; i < n; i++) {
        var col = Math.random() < 0.4 ? 0x550000 : 0x880000;
        var mat = new THREE.MeshBasicMaterial({
          color: col, transparent: true, opacity: 0.85,
          depthWrite: false, side: THREE.DoubleSide,
        });
        var sp = new THREE.Mesh(_bloodStainGeo, mat);
        var sz = 0.018 + Math.random() * 0.025;
        sp.scale.set(sz, sz, sz);
        // Random spot on host mesh
        sp.position.set(
          (Math.random() - 0.5) * 0.04,
          (Math.random() - 0.5) * 0.04,
          (Math.random() - 0.5) * 0.10
        );
        sp.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        host.add(sp);
        _bloodStainSprites.push({ mesh: sp, mat: mat, life: 30, host: host });
      }
      // Cap accumulated stains
      while (_bloodStainSprites.length > 24) {
        var old = _bloodStainSprites.shift();
        if (old.host && old.mesh) try { old.host.remove(old.mesh); } catch(e){}
        if (old.mat) try { old.mat.dispose(); } catch(e){}
      }
    } catch (e) {}
  }
  function _updateBloodStains(delta) {
    for (var i = _bloodStainSprites.length - 1; i >= 0; i--) {
      var s = _bloodStainSprites[i];
      s.life -= delta;
      if (s.life <= 5 && s.mat) s.mat.opacity = Math.max(0, (s.life / 5) * 0.85);
      if (s.life <= 0) {
        if (s.host && s.mesh) try { s.host.remove(s.mesh); } catch(e){}
        if (s.mat) try { s.mat.dispose(); } catch(e){}
        _bloodStainSprites.splice(i, 1);
      }
    }
  }

  function addAttachment(weaponIdx, attachId) {
    if (!ATTACHMENTS[attachId]) return false;
    if (!isCompatible(weaponIdx, attachId)) return false;
    if (!weaponAttachments[weaponIdx]) weaponAttachments[weaponIdx] = [];
    if (weaponAttachments[weaponIdx].length >= 3) return false; // max 3 attachments
    if (weaponAttachments[weaponIdx].indexOf(attachId) >= 0) return false; // already has it
    // Mutually exclusive: EXT_MAG and DRUM_MAG share a slot
    if (attachId === 'EXT_MAG' && weaponAttachments[weaponIdx].indexOf('DRUM_MAG') >= 0) return false;
    if (attachId === 'DRUM_MAG' && weaponAttachments[weaponIdx].indexOf('EXT_MAG') >= 0) return false;
    weaponAttachments[weaponIdx].push(attachId);
    // If an extended mag was just added and current clip is at base capacity,
    // refill into the new larger capacity from reserve.
    var st = states[weaponIdx];
    if (st && (attachId === 'EXT_MAG' || attachId === 'DRUM_MAG')) {
      var newCap = effectiveClipSize(weaponIdx);
      var fill = Math.min(newCap - st.clip, st.reserve);
      if (fill > 0) { st.clip += fill; st.reserve -= fill; }
    }
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
    getRecoilAccum: function() { return _recoilPitchAccum; },
    startInspect,
    isInSmoke: isInSmoke,
    getWeaponCount: function () { return WEAPONS.length; },
    unlockForStage: unlockForStage,
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
    getUnlockedList: function () {
      var list = [];
      for (var i = 0; i < unlocked.length; i++) { if (unlocked[i]) list.push(i); }
      return list;
    },
    lockWeapon:     function (i) {
      if (i < 2) return;  // can't lock starter weapons
      unlocked[i] = false;
      if (currentIdx === i) switchTo(0);
      refreshWeaponHud();
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
    ATTACHMENT_COMPAT: ATTACHMENT_COMPAT,
    addAttachment:    addAttachment,
    removeAttachment: removeAttachment,
    getAttachments:   getAttachments,
    getModifiedStats: getModifiedStats,
    isCompatible:           isCompatible,
    getCompatibleAttachments: getCompatibleAttachments,
    effectiveClipSize:      effectiveClipSize,
    effectiveReloadTime:    effectiveReloadTime,
    effectiveFireRate:      effectiveFireRate,
    effectiveDamage:        effectiveDamage,
    effectiveSpread:        effectiveSpread,
    isSilenced:             isSilenced,
    getMuzzleFlashMult:     getMuzzleFlashMult,
    SKINS:                  SKINS,
    setWeaponSkin:          setWeaponSkin,
    getWeaponSkin:          getWeaponSkin,
    applySkinToMesh:        applySkinToMesh,
    markBlooded:            markBlooded,
    // AP Ammo (premium): more penetration, larger damage on hit
    addAPAmmo: function (n) {
      try { window._apAmmo = (window._apAmmo || 0) + (n | 0); } catch (e) {}
      try { window.HUD && window.HUD.showToast && window.HUD.showToast('🛡 +' + n + ' AP rounds', 1800, '#88ddff'); } catch (e) {}
    },
    getAPAmmo: function () { return window._apAmmo || 0; },
    consumeAPAmmo: function (n) {
      var have = window._apAmmo || 0;
      if (have <= 0) return false;
      window._apAmmo = Math.max(0, have - (n | 1));
      return true;
    },
    // Unlock a random not-yet-owned weapon (used by lottery prize)
    unlockRandomWeapon: function () {
      var locked = [];
      for (var i = 0; i < unlocked.length; i++) { if (!unlocked[i]) locked.push(i); }
      if (!locked.length) return -1;
      var pick = locked[Math.floor(Math.random() * locked.length)];
      unlocked[pick] = true;
      try {
        var wname = (WEAPONS[pick] && WEAPONS[pick].name) || ('Weapon #' + pick);
        if (window.HUD && window.HUD.showToast) window.HUD.showToast('🎁 New weapon unlocked: ' + wname, 3500, '#00ff88');
      } catch (e) {}
      return pick;
    },
  };
})();

// Quick weapon swap: swap to last used weapon.
// This must be wired after the Weapons singleton exists to avoid TDZ crashes during script load.
let _lastWeaponIdx = 0;
function quickSwapLast() {
  if (typeof Weapons === 'undefined' || !Weapons.getCurrentIdx || !Weapons.switchTo) return;
  const cur = Weapons.getCurrentIdx();
  Weapons.switchTo(_lastWeaponIdx);
  _lastWeaponIdx = cur;
}

if (typeof Weapons !== 'undefined' && typeof Weapons.switchTo === 'function' && !Weapons.quickSwapLast) {
  const _origSwitchTo = Weapons.switchTo;
  Weapons.switchTo = function(idx) {
    if (typeof Weapons.getCurrentIdx === 'function') {
      _lastWeaponIdx = Weapons.getCurrentIdx();
    }
    return _origSwitchTo.call(this, idx);
  };
  Weapons.quickSwapLast = quickSwapLast;
}

if (typeof window !== 'undefined') {
  window.Weapons = Weapons;
}
