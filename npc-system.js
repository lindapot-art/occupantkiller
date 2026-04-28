    // --- Wildlife Types ---
    const WILDLIFE_TYPE = Object.freeze({
      BIRD: 'bird',
      DOG:  'dog',
      CAT:  'cat',
    });

    // --- Wildlife NPC Template ---
    function createWildlifeNPC(type, x, y, z) {
      const id = nextId++;
      let mesh;
      if (type === WILDLIFE_TYPE.BIRD) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 6, 6),
          new THREE.MeshLambertMaterial({ color: 0x888888 })
        );
        mesh.position.y += 0.1;
      } else if (type === WILDLIFE_TYPE.DOG) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.18, 0.12),
          new THREE.MeshLambertMaterial({ color: 0x8B7355 })
        );
        mesh.position.y += 0.09;
      } else if (type === WILDLIFE_TYPE.CAT) {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.13, 0.10),
          new THREE.MeshLambertMaterial({ color: 0xB0B0B0 })
        );
        mesh.position.y += 0.065;
      }
      mesh.castShadow = true;
      mesh.userData.npcId = id;
      mesh.userData.faction = 'wildlife';
      const npc = {
        id,
        type,
        rank: 'wildlife',
        job: 'wander',
        position: new THREE.Vector3(x, y, z),
        mesh,
        alive: true,
        aiState: 'idle',
        aiTimer: Math.random() * 2 + 1,
        speed: (type === WILDLIFE_TYPE.BIRD) ? 2.2 : 1.1,
        target: null,
      };
      mesh.position.copy(npc.position);
      return npc;
    }

    // --- Wildlife AI ---
    function updateWildlifeAI(npc, delta) {
      if (!npc.alive) return;
      npc.aiTimer -= delta;
      if (npc.aiTimer <= 0) {
        if (npc.aiState === 'idle') {
          // Pick a random wander target nearby
          npc.target = npc.position.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            0,
            (Math.random() - 0.5) * 4
          ));
          npc.aiState = 'wander';
          npc.aiTimer = 2 + Math.random() * 3;
        } else if (npc.aiState === 'wander') {
          npc.aiState = 'idle';
          npc.aiTimer = 1 + Math.random() * 2;
        }
      }
      // Move toward target if wandering
      if (npc.aiState === 'wander' && npc.target) {
        const dir = npc.target.clone().sub(npc.position);
        const dist = dir.length();
        if (dist > 0.1) {
          dir.normalize();
          npc.position.addScaledVector(dir, npc.speed * delta);
          npc.mesh.position.copy(npc.position);
        } else {
          npc.aiState = 'idle';
          npc.aiTimer = 1 + Math.random() * 2;
        }
      }
      // Flee if player is very close (stub: can be expanded)
      // Integrate with player position for more realism
      if (typeof window.GameManager !== 'undefined' && window.GameManager.getPlayer) {
        const player = window.GameManager.getPlayer();
        if (player && player.position) {
          const playerDist = npc.position.distanceTo(player.position);
          if (playerDist < 6) { // Flee if player is within 6 units
            // Set flee direction away from player
            const away = npc.position.clone().sub(player.position).setY(0).normalize();
            const fleeTarget = npc.position.clone().addScaledVector(away, 8 + Math.random() * 4);
            npc.target = fleeTarget;
            npc.aiState = 'flee';
            npc.aiTimer = 2 + Math.random() * 2;
            return;
          }
        }
      }
    }

    // --- Wildlife Spawning ---
    function spawnWildlifeFromWorld() {
      if (window._pendingWildlifeSpawns) {
        for (const pos of window._pendingWildlifeSpawns) {
          // Randomly pick wildlife type
          const types = [WILDLIFE_TYPE.BIRD, WILDLIFE_TYPE.DOG, WILDLIFE_TYPE.CAT];
          for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
            const t = types[Math.floor(Math.random() * types.length)];
            const offset = new THREE.Vector3(
              (Math.random() - 0.5) * 4,
              0,
              (Math.random() - 0.5) * 4
            );
            const npc = createWildlifeNPC(t, pos.x + offset.x, pos.y, pos.z + offset.z);
            npcs.push(npc);
            _npcById[npc.id] = npc;
            if (_scene) _scene.add(npc.mesh);
          }
        }
        window._pendingWildlifeSpawns.length = 0;
      }
    }
  // NEW: Ukrainian AI Tactics (Hostomel, Kyiv)
  function ukrainianTacticsHostomel(npc, context) {
    // Mobile defense, use cover, counter-flank airborne
    if (context.isAirborneAssault) {
      npc.seekCover();
      if (npc.canFlank()) npc.flankEnemy();
      if (npc.canCallReinforcements) npc.callReinforcements();
    }
  }

  function ukrainianTacticsKyiv(npc, context) {
    // Urban defense, ambush, fallback, breakout
    if (context.isUrbanBreakout) {
      npc.ambushEnemy();
      if (npc.isEncircled) npc.breakout();
      if (npc.canRescueCivilians) npc.rescueCivilians();
    }
  }

  // NEW: Russian AI Tactics (Hostomel, Kyiv)
  function russianTacticsHostomel(npc, context) {
    // Airborne drop, massed assault, attempt to seize runway
    if (context.isAirborneAssault) {
      npc.rushObjective();
      if (npc.canSuppress) npc.suppressDefenders();
      if (npc.canDeploySmoke) npc.deploySmoke();
    }
  }

  function russianTacticsKyiv(npc, context) {
    // Encirclement, urban push, block breakout
    if (context.isUrbanBreakout) {
      npc.blockEscapeRoutes();
      if (npc.canCallArmor) npc.callArmorSupport();
      if (npc.canLayMines) npc.layMines();
    }
  }

  // Expose for scenario use
  window.UkrainianTactics = { hostomel: ukrainianTacticsHostomel, kyiv: ukrainianTacticsKyiv };
  window.RussianTactics = { hostomel: russianTacticsHostomel, kyiv: russianTacticsKyiv };
/* ───────────────────────────────────────────────────────────────────────
   NPC SIMULATION SYSTEM — Sims-like agents with needs, jobs, AI
   ─────────────────────────────────────────────────────────────────────── */
const NPCSystem = (function () {
  'use strict';

  /* ── NPC Ranks ───────────────────────────────────────────────────── */
  const NPC_RANK = Object.freeze({
    CIVILIAN:   'civilian',
    TRAINEE:    'trainee',
    INFANTRY:   'infantry',
    SPECIALIST: 'specialist',
    VETERAN:    'veteran',
    ELITE:      'elite',
  });

  const RANK_ORDER = [
    NPC_RANK.CIVILIAN, NPC_RANK.TRAINEE, NPC_RANK.INFANTRY,
    NPC_RANK.SPECIALIST, NPC_RANK.VETERAN, NPC_RANK.ELITE
  ];

  /* ── Job Types ───────────────────────────────────────────────────── */
  const JOB = Object.freeze({
    IDLE:       'idle',
    GATHER:     'gather',
    BUILD:      'build',
    GUARD:      'guard',
    PATROL:     'patrol',
    CRAFT:      'craft',
    TRAIN:      'train',
    REPAIR:     'repair',
    DRONE_OP:   'drone_op',
    SCOUT:      'scout',
    REST:       'rest',
    MEDIC:      'medic',
    EVAC:       'evac',
    ASSAULT:    'assault',
    WANDER:     'wander',
    FLEE:       'flee',
    SHOPKEEPER: 'shopkeeper',
    HIDE:       'hide'
  });

// ── Civilian Mesh Variant ──
function buildCivilianMesh(npc) {
  const group = new THREE.Group();
  // Simple body (random civilian color)
  const colors = [0xC2B280, 0x8B7355, 0xB0E0E6, 0xA0522D, 0xD2B48C];
  const bodyColor = colors[npc.id % colors.length];
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.7, 0.28),
    new THREE.MeshLambertMaterial({ color: bodyColor })
  );
  body.position.y = 0.75;
  group.add(body);
  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xEEC9A1 })
  );
  head.position.y = 1.22;
  group.add(head);
  // Arms
  for (let side = -1; side <= 1; side += 2) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.48, 0.10),
      new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    arm.position.set(side * 0.22, 0.85, 0);
    group.add(arm);
  }
  // Legs
  for (let side = -1; side <= 1; side += 2) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.45, 0.11),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    leg.position.set(side * 0.10, 0.23, 0);
    group.add(leg);
  }
  group.userData.npcId = npc.id;
  group.userData.faction = 'civilian';
  group.castShadow = true;
  return group;
}

  /* ── Friendly Assault Group System ─────────────────────────────── */
  const NUM_FRIENDLY_GROUPS = 4;
  const friendlyGroups = [];

  const FGROUP_STATE = Object.freeze({
    STAGING:    'staging',
    ADVANCING:  'advancing',
    ENGAGING:   'engaging',
    DEFENDING:  'defending',
    RETREATING: 'retreating',
    REGROUPING: 'regrouping',
  });

  // Reusable temp vectors to avoid per-frame allocations
  var _nTmp1 = new THREE.Vector3();
  var _nTmp2 = new THREE.Vector3();
  var _nTmp3 = new THREE.Vector3();

  function createFriendlyGroup(id) {
    const angle = (id / NUM_FRIENDLY_GROUPS) * Math.PI * 2 + 0.4;
    const dist = 4 + Math.random() * 6;
    const pos = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    // Defensive objective (guard point)
    const defAngle = angle + (Math.random() - 0.5) * 0.6;
    const defDist = 8 + Math.random() * 8;

    return {
      id: id,
      state: FGROUP_STATE.STAGING,
      stateTimer: 2 + Math.random() * 3,
      rallyPoint: pos.clone(),
      guardPoint: new THREE.Vector3(Math.cos(defAngle) * defDist, 0, Math.sin(defAngle) * defDist),
      members: [],       // npc ids
      morale: 85 + Math.random() * 15,
      hasMedic: false,
    };
  }

  /* ── State ───────────────────────────────────────────────────────── */
  const npcs = [];
  var _npcById = {};  // id → npc lookup for O(1) access
  var _aliveGrpBuf = [];  // reusable buffer for alive group members
  let _scene = null;
  let nextId = 1;
  let _mlAssistStrategy = null; // ML-guided NPC assistance strategy

  /* ── Rank-based Weapon Assignment ────────────────────────────────── */
  // Maps NPC rank to weapon: name, damage, fire rate, range, sound type
  const RANK_WEAPONS = {
    [NPC_RANK.CIVILIAN]:   null, // unarmed
    [NPC_RANK.TRAINEE]:    { name: 'Makarov PM',  damage: 12, fireRate: 1.4, range: 14, soundType: 'pistol',  color: 0x333333, barrelLen: 0.10 },
    [NPC_RANK.INFANTRY]:   { name: 'AK-74M',      damage: 24, fireRate: 1.0, range: 18, soundType: 'rifle',   color: 0x3a3a28, barrelLen: 0.28 },
    [NPC_RANK.SPECIALIST]: { name: 'RPK-74',      damage: 20, fireRate: 0.7, range: 20, soundType: 'rifle',   color: 0x3a3a28, barrelLen: 0.34 },
    [NPC_RANK.VETERAN]:    { name: 'PKM',         damage: 16, fireRate: 0.5, range: 22, soundType: 'hmg',     color: 0x2a2a18, barrelLen: 0.38 },
    [NPC_RANK.ELITE]:      { name: 'M4A1',        damage: 28, fireRate: 0.6, range: 24, soundType: 'rifle',   color: 0x3a3a3a, barrelLen: 0.30 },
  };

  /* ── Build a simple weapon mesh for NPC's right hand ────────────── */
  function buildNPCWeaponMesh(weaponDef) {
    if (!weaponDef) return null;
    const g = new THREE.Group();
    // Barrel
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, weaponDef.barrelLen),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    barrel.position.set(0, 0, -weaponDef.barrelLen / 2 - 0.06);
    g.add(barrel);
    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, 0.14),
      new THREE.MeshLambertMaterial({ color: weaponDef.color })
    );
    body.position.set(0, 0, -0.04);
    g.add(body);
    // Magazine
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.08, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    mag.position.set(0, -0.06, -0.04);
    g.add(mag);
    // Pistol grip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.06, 0.03),
      new THREE.MeshLambertMaterial({ color: 0x141414 })
    );
    grip.position.set(0, -0.05, 0.03);
    g.add(grip);
    // Stock for rifles/MGs (barrel >= 0.25)
    if (weaponDef.barrelLen >= 0.25) {
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.05, 0.16),
        new THREE.MeshLambertMaterial({ color: 0x3a2a18 })
      );
      stock.position.set(0, 0, 0.12);
      g.add(stock);
    }
    // Picatinny optic for ELITE/VETERAN
    if (weaponDef.soundType === 'rifle' || weaponDef.soundType === 'hmg') {
      const optic = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.04, 0.08),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      optic.position.set(0, 0.05, -0.04);
      g.add(optic);
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.022, 0.005),
        new THREE.MeshBasicMaterial({ color: 0x66aaff })
      );
      lens.position.set(0, 0.05, -0.084);
      g.add(lens);
    }
    return g;
  }

  /* ── NPC Template ────────────────────────────────────────────────── */
  function createNPC(x, y, z, rank) {
    const weaponDef = RANK_WEAPONS[rank] || null;
    const npc = {
      id: nextId++,
      rank: rank || NPC_RANK.CIVILIAN,
      job: JOB.IDLE,
      weapon: weaponDef,

      // Needs (0-100)
      health:   100,
      hunger:   80,   // starts fed
      fatigue:  0,    // starts rested
      morale:   70,
      loyalty:  60,
      stress:   10,

      // Skills (0-100)
      skills: {
        combat:     { civilian: 5, trainee: 5, infantry: 30, specialist: 50, veteran: 70, elite: 90 }[rank] || 5,
        building:   10,
        crafting:   5,
        droneOps:   0,
        leadership: 0,
      },

      // Position & movement
      position: new THREE.Vector3(x, y, z),
      target:   null,
      speed:    1.4,
      mesh:     null,

      // Job state
      jobTimer: 0,
      jobTarget: null,
      assigned: false,

      // State
      alive:  true,
      asleep: false,

      // Combat
      combatTarget: null,
      combatCooldown: 0,
      fireFlash: 0,

      // Assault group
      groupId:   -1,
      groupRole: null,
      guardPos:  null,
    };

    npc.mesh = (rank === NPC_RANK.CIVILIAN) ? buildCivilianMesh(npc) : buildNPCMesh(npc);
    npc.mesh.position.copy(npc.position);
    return npc;
  }

  /* ── Ukrainian MM-14 Digital Camo Palette ──────────────────────────── */
  const MM14_CAMO = {
    light:  0x6b9050,  // sage green
    medium: 0x5a7a3f,  // olive green
    dark:   0x3a4a1f,  // dark olive
    tan:    0x8a6a4a,  // khaki accent
  };

  /* ── Ukrainian flag / insignia colors ────────────────────────────── */
  const UA_BLUE   = 0x0057B8;
  const UA_YELLOW = 0xFFD700;

  /* ── Canvas-based MM-14 digital pixel camo texture ───────────────── */
  function makeMM14CamoTexture(variant) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const palette = variant === 'dark'
      ? ['#3a4a1f', '#4a5a2f', '#5a6a3f', '#2a3a0f']
      : ['#6b9050', '#5a7a3f', '#3a4a1f', '#8a6a4a'];

    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, size, size);

    const block = 4;
    for (let y = 0; y < size; y += block) {
      for (let x = 0; x < size; x += block) {
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        ctx.fillRect(x, y, block, block);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /* ── Blue-yellow flag sleeve patch texture ───────────────────────── */
  function makeUkrainianPatchTexture(baseColorHex) {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base arm color
    const r = (baseColorHex >> 16) & 0xff;
    const g = (baseColorHex >> 8)  & 0xff;
    const b =  baseColorHex        & 0xff;
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(0, 0, size, size);

    // Flag patch (8×10 rectangle near top)
    const px = 4, py = 3, pw = 24, ph = 12;
    // Blue upper half
    ctx.fillStyle = '#0057B8';
    ctx.fillRect(px, py, pw, ph / 2);
    // Yellow lower half
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(px, py + ph / 2, pw, ph / 2);

    // Thin dark border
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    // Small trident (tryzub) in center of patch — simplified pixel art
    ctx.fillStyle = '#FFD700';
    // Center prong
    ctx.fillRect(15, py + 1, 2, 5);
    // Left prong
    ctx.fillRect(11, py + 2, 2, 4);
    // Right prong
    ctx.fillRect(19, py + 2, 2, 4);
    // Base bar
    ctx.fillRect(11, py + 6, 10, 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  /* ── Ukrainian helmet texture: blue-yellow cross tape ────────────── */
  function makeUkrainianHelmetTexture(helmetColorHex) {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base helmet color
    const r = (helmetColorHex >> 16) & 0xff;
    const g = (helmetColorHex >> 8)  & 0xff;
    const b =  helmetColorHex        & 0xff;
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(0, 0, size, size);

    // Blue cross (horizontal + vertical blue tape)
    ctx.fillStyle = '#0057B8';
    ctx.fillRect(0, 13, size, 6);    // horizontal
    ctx.fillRect(13, 0, 6, size);    // vertical

    // Yellow outline on cross
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(0, 12, size, 1);
    ctx.fillRect(0, 19, size, 1);
    ctx.fillRect(12, 0, 1, size);
    ctx.fillRect(19, 0, 1, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  /* ── NPC Visual Mesh — Ukrainian forces with proper insignia ─────── */
  function buildNPCMesh(npc) {
    const group = new THREE.Group();

    // Rank determines camo variant: higher ranks get darker, more worn camo
    const isDark = ['veteran', 'elite', 'specialist'].includes(npc.rank);
    const camoVariant = isDark ? 'dark' : 'light';
    const camoTex = makeMM14CamoTexture(camoVariant);
    const helmetColor = isDark ? 0x4a5a2f : 0x5a6a3f;

    // ── Body (MM-14 camo) ─────────────────────────────────
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.7, 0.3),
      new THREE.MeshLambertMaterial({ map: camoTex })
    );
    body.position.y = 0.75;
    group.add(body);

    // ── Head (skin) ───────────────────────────────────────
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xDDAA88 })
    );
    head.position.y = 1.28;
    group.add(head);

    // ── Helmet — composite PASGT/MICH (shell + crown + brim + nape) ──
    const helmetTex = makeUkrainianHelmetTexture(helmetColor);
    const helmetMat = new THREE.MeshLambertMaterial({ map: helmetTex });
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.16, 0.40),
      helmetMat
    );
    helmet.position.y = 1.44;
    const helmetCrown = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.06, 0.34),
      new THREE.MeshLambertMaterial({ color: helmetColor })
    );
    helmetCrown.position.y = 1.54;
    const helmetBrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.04, 0.10),
      new THREE.MeshLambertMaterial({ color: helmetColor })
    );
    helmetBrim.position.set(0, 1.38, 0.20);
    const helmetNape = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.10, 0.06),
      new THREE.MeshLambertMaterial({ color: helmetColor })
    );
    helmetNape.position.set(0, 1.39, -0.21);
    // Yellow ID combat tape strip across helmet front (current war marking)
    const yellowTape = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.02, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xFFD700 })
    );
    yellowTape.position.set(0, 1.40, 0.21);
    group.add(helmet, helmetCrown, helmetBrim, helmetNape, yellowTape);

    // ── Legs (dark camo) ──────────────────────────────────
    const legCamo = makeMM14CamoTexture('dark');
    for (let side = -1; side <= 1; side += 2) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.5, 0.14),
        new THREE.MeshLambertMaterial({ map: legCamo })
      );
      leg.position.set(side * 0.12, 0.25, 0);
      leg.userData.isLeg = true;
      group.add(leg);

      // Boot (tan/coyote — NATO style)
      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.12, 0.15),
        new THREE.MeshLambertMaterial({ color: 0x8B7355 })
      );
      boot.position.set(side * 0.12, 0.02, 0);
      group.add(boot);
    }

    // ── Left arm with BLUE-YELLOW PATCH (Ukrainian insignia) ─
    const patchBaseColor = isDark ? 0x3a4a1f : 0x5a7a3f;
    const patchTex = makeUkrainianPatchTexture(patchBaseColor);
    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.12),
      new THREE.MeshLambertMaterial({ map: patchTex })
    );
    armL.position.set(-0.32, 0.8, 0);
    armL.userData.isArm = true;
    group.add(armL);

    // ── Right arm (plain camo) ────────────────────────────
    const armR = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.12),
      new THREE.MeshLambertMaterial({ map: camoTex })
    );
    armR.position.set(0.32, 0.8, 0);
    armR.userData.isArm = true;
    group.add(armR);

    // ── Plate Carrier (coyote brown — NATO style) ─────────
    const plateCarrier = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.50, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x8B7355 })
    );
    plateCarrier.position.y = 0.82;
    group.add(plateCarrier);

    // ── Medical cross patch on plate carrier ──────────────
    const medPatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.001),
      new THREE.MeshLambertMaterial({ color: 0xCC0000 })
    );
    medPatch.position.set(-0.15, 0.85, 0.18);
    group.add(medPatch);

    // ── Tourniquet (orange/red band on chest strap) ───────
    const tourniquet = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.12, 0.03),
      new THREE.MeshLambertMaterial({ color: 0xFF4400 })
    );
    tourniquet.position.set(0.22, 0.90, 0.10);
    group.add(tourniquet);

    // ── Blue armband (Ukrainian ID marking on right arm) ──
    const blueArmband = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.04, 0.13),
      new THREE.MeshLambertMaterial({ color: 0x0057B8 })
    );
    blueArmband.position.set(0.32, 0.95, 0);
    group.add(blueArmband);

    // ── NVG mount on helmet ───────────────────────────────
    const nvgMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 0.03),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    nvgMount.position.set(0, 1.48, 0.18);
    group.add(nvgMount);

    // ── Belt (coyote brown webbing) ───────────────────────
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.05, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x8B7355 })
    );
    belt.position.y = 0.42;
    group.add(belt);

    // ── Tactical gloves (black) on hands ──────────────────
    const ukrGloveMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const ukrGloveL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.13), ukrGloveMat);
    ukrGloveL.position.set(-0.32, 0.52, 0);
    const ukrGloveR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.13), ukrGloveMat);
    ukrGloveR.position.set(0.32, 0.52, 0);
    group.add(ukrGloveL, ukrGloveR);

    // ── Admin pouch (right chest) ─────────────────────────
    const ukrAdmin = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.10, 0.04),
      new THREE.MeshLambertMaterial({ color: 0x6a5230 })
    );
    ukrAdmin.position.set(0.10, 0.95, 0.18);
    group.add(ukrAdmin);

    // ── Mag pouches (3, on chest plate) ───────────────────
    for (let i = -1; i <= 1; i++) {
      const mp = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.10, 0.04),
        new THREE.MeshLambertMaterial({ color: 0x6a5230 })
      );
      mp.position.set(i * 0.09, 0.78, 0.18);
      group.add(mp);
    }

    // ── Dump pouch (left hip) ─────────────────────────────
    const ukrDump = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.14, 0.10),
      new THREE.MeshLambertMaterial({ color: 0x6a5230 })
    );
    ukrDump.position.set(-0.27, 0.58, 0.04);
    group.add(ukrDump);

    // ── Boots (taller laced — replace earlier short boots) ─
    // (Earlier short boots already added; layer a tall shaft on top.)
    for (let side = -1; side <= 1; side += 2) {
      const bootShaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.14, 0.13),
        new THREE.MeshLambertMaterial({ color: 0x6a4f30 })
      );
      bootShaft.position.set(side * 0.12, 0.13, 0);
      group.add(bootShaft);
    }

    // ── Ukrainian flag shoulder patch (right shoulder, blue over yellow) ──
    const ukrFlagBlue = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.03, 0.005),
      new THREE.MeshBasicMaterial({ color: 0x0057B8 })
    );
    ukrFlagBlue.position.set(0.33, 1.00, 0.07);
    ukrFlagBlue.rotation.y = -Math.PI / 2;
    const ukrFlagYellow = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.03, 0.005),
      new THREE.MeshBasicMaterial({ color: 0xFFD700 })
    );
    ukrFlagYellow.position.set(0.33, 0.97, 0.07);
    ukrFlagYellow.rotation.y = -Math.PI / 2;
    group.add(ukrFlagBlue, ukrFlagYellow);

    // ── Eyes (green glow for friendlies) ──────────────────
    const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00CC00 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.06, 1.30, 0.14);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.06, 1.30, 0.14);
    group.add(eyeL, eyeR);

    // ── Weapon mesh (attached to right arm, based on rank) ──
    const weaponDef = RANK_WEAPONS[npc.rank] || null;
    if (weaponDef) {
      const weaponMesh = buildNPCWeaponMesh(weaponDef);
      if (weaponMesh) {
        weaponMesh.position.set(0.32, 0.65, -0.12);
        weaponMesh.rotation.x = -0.15;
        group.add(weaponMesh);
        group.userData.weaponMesh = weaponMesh;
      }
    }

    group.userData.npcId   = npc.id;
    group.userData.faction = 'ukrainian';
    group.castShadow = true;
    // Attach Ukrainian flag patch on back + shoulder
    if (typeof Flags !== 'undefined' && Flags.attachToSoldier) {
      try { Flags.attachToSoldier(group, 'ukrainian'); } catch (e) {}
    }
    // Grenade pouch on belt — small dark cube cluster (visual gear)
    try {
      var pouchG = new THREE.Group();
      var pouchMat = new THREE.MeshLambertMaterial({ color: 0x2a3018 });
      for (var pg = 0; pg < 3; pg++) {
        var nade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.06), pouchMat);
        nade.position.set(-0.06 + pg * 0.06, 0.50, 0.18);
        pouchG.add(nade);
      }
      group.add(pouchG);
      group.userData.gearGrenadePouch = pouchG;
    } catch (e) {}
    // ~40% of NPCs carry a sitting mat: rolled cylinder while walking, flat plane when sitting
    if (Math.random() < 0.4) {
      try {
        var matMat = new THREE.MeshLambertMaterial({ color: 0x6a4a26 });
        var rolled = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8), matMat);
        rolled.rotation.z = Math.PI / 2;
        rolled.position.set(0, 0.42, -0.20);
        group.add(rolled);
        var flatMat = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.10), matMat);
        flatMat.rotation.x = -Math.PI / 2;
        flatMat.position.set(0, 0.02, 0);
        flatMat.visible = false;
        group.add(flatMat);
        group.userData.sittingMatRolled = rolled;
        group.userData.sittingMatFlat = flatMat;
      } catch (e) {}
    }
    // Mag pouches on chest (every soldier) — 2 stacked rectangles
    try {
      var magMat = new THREE.MeshLambertMaterial({ color: 0x3a4022 });
      var magL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.05), magMat);
      magL.position.set(-0.10, 0.78, 0.16);
      var magR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.05), magMat);
      magR.position.set(0.10, 0.78, 0.16);
      group.add(magL); group.add(magR);
    } catch (e) {}
    // Entrenching tool (small shovel) on lower back — ~25% of NPCs
    if (Math.random() < 0.25) {
      try {
        var shovelG = new THREE.Group();
        var handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.03),
          new THREE.MeshLambertMaterial({ color: 0x5a3a1a }));
        var blade = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.02),
          new THREE.MeshLambertMaterial({ color: 0x202020 }));
        blade.position.y = -0.18;
        shovelG.add(handle); shovelG.add(blade);
        shovelG.position.set(0, 0.55, -0.18);
        group.add(shovelG);
      } catch (e) {}
    }
    // Antenna (radioman) — ~15% of NPCs get tall whip antenna from backpack
    if (Math.random() < 0.15) {
      try {
        var antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, 0.65, 6),
          new THREE.MeshLambertMaterial({ color: 0x111111 }));
        antenna.position.set(-0.08, 1.05, -0.18);
        antenna.rotation.z = -0.18;
        group.add(antenna);
      } catch (e) {}
    }
    // Canteen on hip (every soldier) — short olive cylinder
    try {
      var canteen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.13, 8),
        new THREE.MeshLambertMaterial({ color: 0x5a6a3a })
      );
      canteen.position.set(0.22, 0.46, 0.04);
      group.add(canteen);
    } catch (e) {}
    // Helmet scrim/cover with grass tufts — ~30% of NPCs
    if (Math.random() < 0.3) {
      try {
        var scrimMat = new THREE.MeshLambertMaterial({ color: 0x3a4a1a });
        for (var st = 0; st < 4; st++) {
          var tuft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), scrimMat);
          var ang = (st / 4) * Math.PI * 2;
          tuft.position.set(Math.cos(ang) * 0.10, 1.62, Math.sin(ang) * 0.10);
          tuft.rotation.y = ang;
          tuft.rotation.z = (Math.random() - 0.5) * 0.4;
          group.add(tuft);
        }
      } catch (e) {}
    }
    // Knee pads — ~25% of NPCs
    if (Math.random() < 0.25) {
      try {
        var kpMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        var kpL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.13), kpMat);
        kpL.position.set(-0.10, 0.30, 0.08);
        var kpR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.13), kpMat);
        kpR.position.set(0.10, 0.30, 0.08);
        group.add(kpL); group.add(kpR);
      } catch (e) {}
    }
    // Sleeping roll across top of backpack — ~20% of NPCs
    if (Math.random() < 0.20) {
      try {
        var rollMat = new THREE.MeshLambertMaterial({ color: 0x55421a });
        var sleepRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 8), rollMat);
        sleepRoll.rotation.z = Math.PI / 2;
        sleepRoll.position.set(0, 0.95, -0.22);
        group.add(sleepRoll);
      } catch (e) {}
    }
    // Cigarette + smoke puff — ~15% of NPCs are smokers (only visible while sitting/idle)
    if (Math.random() < 0.15) {
      try {
        var cigGroup = new THREE.Group();
        var cigBody = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6),
          new THREE.MeshLambertMaterial({ color: 0xe8dcc0 })
        );
        cigBody.rotation.z = Math.PI / 2;
        cigBody.position.set(0.04, 0, 0);
        cigGroup.add(cigBody);
        var ember = new THREE.Mesh(
          new THREE.SphereGeometry(0.008, 6, 4),
          new THREE.MeshBasicMaterial({ color: 0xff5a14 })
        );
        ember.position.set(0.075, 0, 0);
        cigGroup.add(ember);
        // Smoke puff above ember
        var puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 6, 4),
          new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.35 })
        );
        puff.position.set(0.10, 0.06, 0);
        cigGroup.add(puff);
        cigGroup.position.set(0.10, 1.55, 0.12); // near mouth
        cigGroup.visible = false; // shown when sitting
        group.add(cigGroup);
        group.userData.cigarette = cigGroup;
        group.userData.cigEmber = ember;
        group.userData.cigPuff = puff;
      } catch (e) {}
    }
    return group;
  }

  /* ── Init ────────────────────────────────────────────────────────── */
  function init(scene) {
    _scene = scene;
    npcs.length = 0;
    nextId = 1;
    friendlyGroups.length = 0;
    spawnWildlifeFromWorld();
  }

  /* ── Spawn NPC ───────────────────────────────────────────────────── */
  function spawn(x, y, z, rank) {
    const npc = createNPC(x, y, z, rank);
    npcs.push(npc);
    _npcById[npc.id] = npc;
    if (_scene) _scene.add(npc.mesh);
    return npc;
    // ── Civilian Spawning (from shopkeeper spawn points) ──
    function spawnCiviliansFromWorld() {
      if (window._pendingShopkeeperSpawns) {
        for (const pos of window._pendingShopkeeperSpawns) {
          const civ = spawn(pos.x, pos.y, pos.z, NPC_RANK.CIVILIAN);
          civ.job = JOB.SHOPKEEPER;
        }
        window._pendingShopkeeperSpawns.length = 0;
      }
    }
  }

  /* ── Spawn Friendly Assault Groups ──────────────────────────────── */
  function spawnAssaultGroups() {
    friendlyGroups.length = 0;
    for (let g = 0; g < NUM_FRIENDLY_GROUPS; g++) {
      const group = createFriendlyGroup(g);

      // Group composition: 1 specialist (leader), 1 medic, 2-3 infantry
      const leaderAngle = (g / NUM_FRIENDLY_GROUPS) * Math.PI * 2 + 0.4;
      const leaderDist = 4 + Math.random() * 4;
      const lx = Math.cos(leaderAngle) * leaderDist;
      const lz = Math.sin(leaderAngle) * leaderDist;
      const lh = (typeof VoxelWorld !== 'undefined') ? VoxelWorld.getTerrainHeight(lx, lz) : 0;

      // Leader (specialist)
      const leader = spawn(lx, lh, lz, NPC_RANK.SPECIALIST);
      leader.job = JOB.ASSAULT;
      leader.groupId = g;
      leader.groupRole = 'leader';
      group.members.push(leader.id);

      // Medic (infantry rank, medic job)
      const mx = lx + (Math.random() - 0.5) * 3;
      const mz = lz + (Math.random() - 0.5) * 3;
      const mh = (typeof VoxelWorld !== 'undefined') ? VoxelWorld.getTerrainHeight(mx, mz) : 0;
      const medic = spawn(mx, mh, mz, NPC_RANK.INFANTRY);
      medic.job = JOB.MEDIC;
      medic.groupId = g;
      medic.groupRole = 'medic';
      group.members.push(medic.id);
      group.hasMedic = true;

      // 2-3 infantry
      const infantryCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < infantryCount; i++) {
        const ix = lx + (Math.random() - 0.5) * 4;
        const iz = lz + (Math.random() - 0.5) * 4;
        const ih = (typeof VoxelWorld !== 'undefined') ? VoxelWorld.getTerrainHeight(ix, iz) : 0;
        const rank = Math.random() < 0.4 ? NPC_RANK.VETERAN : NPC_RANK.INFANTRY;
        const inf = spawn(ix, ih, iz, rank);
        inf.job = JOB.ASSAULT;
        inf.groupId = g;
        inf.groupRole = 'rifleman';
        group.members.push(inf.id);
      }

      friendlyGroups.push(group);
      // Camp prop: ~50% of squads have a clothesline with drying laundry behind their leader
      if (_scene && Math.random() < 0.5) {
        try {
          var camp = new THREE.Group();
          // Two short posts
          var postMat = new THREE.MeshLambertMaterial({ color: 0x4a3018 });
          var p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), postMat);
          p1.position.set(-1.0, 0.7, 0);
          var p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), postMat);
          p2.position.set(1.0, 0.7, 0);
          camp.add(p1); camp.add(p2);
          // Rope (thin cylinder horizontal)
          var rope = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 2.0, 4),
            new THREE.MeshLambertMaterial({ color: 0xb0a070 })
          );
          rope.rotation.z = Math.PI / 2;
          rope.position.set(0, 1.30, 0);
          camp.add(rope);
          // 3-4 garments (rectangles) hanging
          var shirtColors = [0x4a5028, 0x6a4030, 0x405068, 0x553322, 0x707048];
          var nGar = 3 + Math.floor(Math.random() * 2);
          for (var ig = 0; ig < nGar; ig++) {
            var col = shirtColors[Math.floor(Math.random() * shirtColors.length)];
            var shirt = new THREE.Mesh(
              new THREE.PlaneGeometry(0.30, 0.42),
              new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide })
            );
            shirt.position.set(-0.7 + ig * 0.45, 1.05, 0);
            shirt.rotation.y = (Math.random() - 0.5) * 0.2;
            camp.add(shirt);
          }
          // Place behind leader
          camp.position.set(lx + Math.cos(leaderAngle + Math.PI) * 2.0, lh, lz + Math.sin(leaderAngle + Math.PI) * 2.0);
          camp.rotation.y = leaderAngle;
          _scene.add(camp);
        } catch (eC) {}
      }
    }
  }

  /* ── Assign Guard Positions ─────────────────────────────────────── */
  function assignGuardPositions(positions) {
    const guards = npcs.filter(n => n.alive && n.weapon && n.job !== JOB.MEDIC);
    for (let i = 0; i < Math.min(positions.length, guards.length); i++) {
      const npc = guards[i];
      npc.job = JOB.GUARD;
      npc.guardPos = positions[i].clone();
      npc.target = positions[i].clone();
    }
  }

  /* ── Update All NPCs ─────────────────────────────────────────────── */
  function update(delta, timeInfo) {
    // Update friendly assault group AI
    updateFriendlyGroups(delta);

    for (const npc of npcs) {
      if (!npc.alive) continue;
      if (npc.rank === 'wildlife' || npc.type === 'wildlife' || npc.type === WILDLIFE_TYPE.BIRD || npc.type === WILDLIFE_TYPE.DOG || npc.type === WILDLIFE_TYPE.CAT) {
        updateWildlifeAI(npc, delta);
      } else {
        updateNeeds(npc, delta, timeInfo);
        updateBehavior(npc, delta, timeInfo);
        updateMovement(npc, delta);
        updateAnimation(npc, delta);
        // Sitting mat: toggle rolled vs flat plane based on idle time
        var ud = npc.mesh && npc.mesh.userData;
        if (ud && ud.sittingMatRolled && ud.sittingMatFlat) {
          var moving = !!(npc.velocity && (Math.abs(npc.velocity.x) + Math.abs(npc.velocity.z) > 0.05));
          npc._idleTime = (moving ? 0 : (npc._idleTime || 0) + delta);
          var sitting = npc._idleTime > 4.0;
          ud.sittingMatRolled.visible = !sitting;
          ud.sittingMatFlat.visible = sitting;
        }
        // Cigarette: only visible while idle/sitting; ember pulses, puff drifts
        if (ud && ud.cigarette) {
          var movingC = !!(npc.velocity && (Math.abs(npc.velocity.x) + Math.abs(npc.velocity.z) > 0.05));
          npc._idleTime = (movingC ? 0 : (npc._idleTime || 0) + delta);
          var smoking = npc._idleTime > 2.5;
          ud.cigarette.visible = smoking;
          if (smoking) {
            npc._cigT = (npc._cigT || 0) + delta;
            if (ud.cigEmber) {
              var glow = 0.6 + 0.4 * Math.sin(npc._cigT * 4 + npc.id * 0.7);
              ud.cigEmber.scale.setScalar(0.8 + glow * 0.5);
            }
            if (ud.cigPuff) {
              // drift puff up slowly, reset every ~2s
              var puffPhase = (npc._cigT % 2.0) / 2.0;
              ud.cigPuff.position.y = 0.06 + puffPhase * 0.15;
              ud.cigPuff.material.opacity = 0.35 * (1 - puffPhase);
              ud.cigPuff.scale.setScalar(1 + puffPhase * 0.8);
            }
          }
        }
      }
    }
  }

  /* ── Friendly Assault Group AI ──────────────────────────────────── */
  function updateFriendlyGroups(delta) {
    for (const grp of friendlyGroups) {
      // Reuse buffer to avoid per-frame alloc
      _aliveGrpBuf.length = 0;
      for (var mi = 0; mi < grp.members.length; mi++) {
        var n = _npcById[grp.members[mi]];
        if (n && n.alive) _aliveGrpBuf.push(n);
      }
      var aliveMembers = _aliveGrpBuf;
      if (aliveMembers.length === 0) continue;

      grp.stateTimer -= delta;
      const lossRatio = 1 - aliveMembers.length / grp.members.length;
      grp.morale = Math.max(10, grp.morale - lossRatio * delta * 3);

      // Check if any member is in combat
      const inCombat = aliveMembers.some(n => n.combatTarget);

      switch (grp.state) {
        case FGROUP_STATE.STAGING:
          if (grp.stateTimer <= 0) {
            grp.state = FGROUP_STATE.ADVANCING;
            grp.stateTimer = 5 + Math.random() * 8;
            // Set guard point as target for all members
            for (const npc of aliveMembers) {
              if (npc.job === JOB.ASSAULT || npc.job === JOB.IDLE) {
                npc.job = JOB.ASSAULT;
                if (npc.target) npc.target.copy(grp.guardPoint);
                else npc.target = grp.guardPoint.clone();
              }
            }
          }
          break;

        case FGROUP_STATE.ADVANCING:
          if (inCombat) {
            grp.state = FGROUP_STATE.ENGAGING;
            grp.stateTimer = 15 + Math.random() * 15;
          } else if (grp.stateTimer <= 0) {
            grp.state = FGROUP_STATE.DEFENDING;
            grp.stateTimer = 15 + Math.random() * 15;
            for (const npc of aliveMembers) {
              if (npc.job === JOB.ASSAULT) {
                npc.job = JOB.GUARD;
                if (npc.guardPos) npc.guardPos.copy(grp.guardPoint);
                else npc.guardPos = grp.guardPoint.clone();
              }
            }
          }
          break;

        case FGROUP_STATE.ENGAGING:
          if (grp.morale < 35) {
            grp.state = FGROUP_STATE.RETREATING;
            grp.stateTimer = 8 + Math.random() * 10;
          } else if (grp.stateTimer <= 0 && !inCombat) {
            grp.state = FGROUP_STATE.DEFENDING;
            grp.stateTimer = 20 + Math.random() * 20;
          }
          break;

        case FGROUP_STATE.DEFENDING:
          if (grp.stateTimer <= 0) {
            // Re-advance to new position
            const angle = Math.random() * Math.PI * 2;
            const dist = 6 + Math.random() * 10;
            grp.guardPoint.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
            grp.state = FGROUP_STATE.ADVANCING;
            grp.stateTimer = 12 + Math.random() * 15;
            for (const npc of aliveMembers) {
              if (npc.job === JOB.GUARD) {
                npc.job = JOB.ASSAULT;
                if (npc.target) npc.target.copy(grp.guardPoint);
                else npc.target = grp.guardPoint.clone();
              }
            }
          }
          break;

        case FGROUP_STATE.RETREATING:
          for (const npc of aliveMembers) {
            if (npc.target) npc.target.copy(grp.rallyPoint);
            else npc.target = grp.rallyPoint.clone();
          }
          if (grp.stateTimer <= 0) {
            grp.state = FGROUP_STATE.REGROUPING;
            grp.stateTimer = 10 + Math.random() * 10;
            grp.morale = Math.min(100, grp.morale + 20);
          }
          break;

        case FGROUP_STATE.REGROUPING:
          // Medics heal wounded during regroup
          for (const npc of aliveMembers) {
            if (npc.job === JOB.MEDIC) {
              const wounded = aliveMembers.find(m => m.health < 60 && m !== npc);
              if (wounded) {
                if (npc.target) npc.target.copy(wounded.position);
                else npc.target = wounded.position.clone();
                const d = npc.position.distanceTo(wounded.position);
                if (d < 2) {
                  wounded.health = Math.min(100, wounded.health + delta * 10);
                }
              }
            }
          }
          if (grp.stateTimer <= 0) {
            grp.state = FGROUP_STATE.STAGING;
            grp.stateTimer = 3 + Math.random() * 4;
          }
          break;
      }
    }
  }

  /* ── Needs Simulation ────────────────────────────────────────────── */
  function updateNeeds(npc, delta, timeInfo) {
    // Hunger decreases over time
    npc.hunger = Math.max(0, npc.hunger - delta * 0.15);

    // Fatigue increases when working, decreases when sleeping
    if (npc.asleep) {
      npc.fatigue = Math.max(0, npc.fatigue - delta * 3);
      if (npc.fatigue <= 5) npc.asleep = false;
    } else {
      const workRate = npc.job === JOB.IDLE || npc.job === JOB.REST ? 0.05 : 0.3;
      npc.fatigue = Math.min(100, npc.fatigue + delta * workRate);
    }

    // Morale affected by hunger, fatigue, stress
    const idealMorale = 100 - (100 - npc.hunger) * 0.3 - npc.fatigue * 0.2 - npc.stress * 0.3;
    npc.morale += (idealMorale - npc.morale) * delta * 0.1;
    npc.morale = Math.max(0, Math.min(100, npc.morale));

    // Stress reduces slowly when resting
    if (npc.job === JOB.REST || npc.asleep) {
      npc.stress = Math.max(0, npc.stress - delta * 0.5);
    }

    // Health regeneration when fed and rested
    if (npc.hunger > 50 && npc.fatigue < 30) {
      npc.health = Math.min(100, npc.health + delta * 0.2);
    }

    // Death check
    if (npc.health <= 0) {
      killNPC(npc);
    }
  }

  /* ── NPC Combat ───────────────────────────────────────────────────── */
  function findNearestEnemy(npc) {
    const allEnemies = (typeof Enemies !== 'undefined' && Enemies.getAll) ? Enemies.getAll() : [];
    let nearest = null;
    let nearDist = Infinity;
    for (const e of allEnemies) {
      if (!e.mesh || !e.alive) continue;
      const dist = npc.position.distanceTo(e.mesh.position);
      if (dist < nearDist) {
        nearDist = dist;
        nearest = e;
      }
    }
    // Extended detection range: weapon range + 10 bonus, minimum 30
    const maxRange = npc.weapon ? Math.max(30, npc.weapon.range + 10) : 30;
    if (nearest && nearDist < maxRange) return { enemy: nearest, dist: nearDist };
    return null;
  }

  function updateCombat(npc, delta, target) {
    // Civilians and unarmed NPCs cannot fight
    if (!npc.weapon) return;

    const enemy = target.enemy;
    if (!enemy || !enemy.mesh) { npc.combatTarget = null; return; }

    // Apply morale effects
    var moraleFx = applyMoraleEffects(npc);
    if (moraleFx.fleeing) {
      // Fleeing NPC runs away from enemy
      var awayFlee = _nTmp1.subVectors(npc.position, enemy.mesh.position).setY(0).normalize();
      _nTmp2.copy(npc.position).addScaledVector(awayFlee, 10);
      if (npc.target) npc.target.copy(_nTmp2);
      else npc.target = _nTmp2.clone();
      npc.combatTarget = null;
      return;
    }

    const dist = target.dist;
    const wep = npc.weapon;

    if (dist > wep.range * 0.7) {
      // Move toward enemy, stop at ~50% of max range
      var dir = _nTmp1.subVectors(enemy.mesh.position, npc.position).setY(0).normalize();
      _nTmp2.copy(npc.position).addScaledVector(dir, dist - wep.range * 0.5);
      if (npc.target) npc.target.copy(_nTmp2);
      else npc.target = _nTmp2.clone();
    } else if (dist >= 4) {
      // Stop and shoot
      npc.target = null;
      // Face enemy
      var lookDir = _nTmp1.subVectors(enemy.mesh.position, npc.position).setY(0);
      if (lookDir.length() > 0.1) {
        npc.mesh.rotation.y = Math.atan2(lookDir.x, lookDir.z);
      }

      npc.combatCooldown -= delta;
      if (npc.combatCooldown <= 0) {
        npc.combatCooldown = Math.max(0.3, wep.fireRate - npc.skills.combat * 0.005);
        // Weapon damage + skill bonus, morale accuracy modifier
        var baseDmg = wep.damage + npc.skills.combat * 0.15;
        var hitChance = moraleFx.accuracyMult * (0.5 + npc.skills.combat * 0.005);
        var dmg = Math.random() < hitChance ? baseDmg : 0; // miss on low morale/skill

        if (dmg > 0 && typeof Enemies !== 'undefined' && Enemies.damage) {
          const remaining = Enemies.damage(enemy, dmg);
          if (remaining <= 0) {
            npc.stress = Math.max(0, npc.stress - 5);
            npc.morale = Math.min(100, npc.morale + 5);
            npc.combatTarget = null;
          }
        }

        // NPC tracer VFX
        if (typeof Tracers !== 'undefined' && Tracers.spawnTracer) {
          var muzzlePos = _nTmp3.copy(npc.position);
          muzzlePos.y += 0.8;
          var tracerDir = _nTmp1.subVectors(enemy.mesh.position, muzzlePos).normalize();
          Tracers.spawnTracer(muzzlePos, tracerDir, 0xffcc44, 100);
        }

        // Play NPC gunshot sound
        if (typeof AudioSystem !== 'undefined' && AudioSystem.playGunshot) {
          AudioSystem.playGunshot(wep.soundType);
        }

        // Flash arms white when firing
        npc.fireFlash = 0.1;
        npc.mesh.children.forEach(child => {
          if (child.userData.isArm) {
            if (!child.userData._savedMaterial) {
              child.userData._savedMaterial = child.material;
              child.userData._flashMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
            }
            child.material = child.userData._flashMaterial;
          }
        });
      }
    } else {
      // Too close — back away
      var away = _nTmp1.subVectors(npc.position, enemy.mesh.position).setY(0).normalize();
      _nTmp2.copy(npc.position).addScaledVector(away, 6);
      if (npc.target) npc.target.copy(_nTmp2);
      else npc.target = _nTmp2.clone();
    }
  }

  /* ── AI Behavior ─────────────────────────────────────────────────── */
  function updateBehavior(npc, delta, timeInfo) {
    // Civilian AI: flee/react to combat, wander, hide
    if (npc.rank === NPC_RANK.CIVILIAN) {
      // If combat nearby, flee
      const danger = findNearestEnemy(npc);
      if (danger && danger.dist < 18) {
        npc.job = JOB.FLEE;
        // Run away from enemy
        var away = _nTmp1.subVectors(npc.position, danger.enemy.mesh.position).setY(0).normalize();
        _nTmp2.copy(npc.position).addScaledVector(away, 10 + Math.random() * 8);
        if (npc.target) npc.target.copy(_nTmp2);
        else npc.target = _nTmp2.clone();
        npc.stress = Math.min(100, npc.stress + delta * 8);
        return;
      }
      // If not in danger, wander or idle in shop
      if (npc.job === JOB.SHOPKEEPER) {
        // Idle behind counter, maybe pace a little
        if (!npc.target && Math.random() < 0.01) {
          _nTmp2.copy(npc.position).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 1));
          npc.target = _nTmp2.clone();
        }
        return;
      }
      if (npc.job === JOB.FLEE) {
        // After fleeing for a while, switch to wander
        if (npc.jobTimer > 6) {
          npc.job = JOB.WANDER;
          npc.jobTimer = 0;
        }
        return;
      }
      // Wander randomly
      if (npc.job === JOB.WANDER || npc.job === JOB.IDLE) {
        if (!npc.target || Math.random() < 0.01) {
          _nTmp2.copy(npc.position).add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6));
          npc.target = _nTmp2.clone();
        }
        return;
      }
      // Default: idle
      return;
    }
    if (npc.weapon && npc.job !== JOB.MEDIC) {
      const nearestEnemy = findNearestEnemy(npc);
      if (nearestEnemy) {
        npc.combatTarget = nearestEnemy.enemy;
        updateCombat(npc, delta, nearestEnemy);
        return;
      }
      // No enemy in range — actively patrol toward center / known battle areas
      if (!npc.target && npc.job !== JOB.REST && npc.job !== JOB.MEDIC) {
        // AI Smart Learning: NPCs cover player's vulnerable direction
        if (_mlAssistStrategy && _mlAssistStrategy.coverDirection >= 0) {
          var coverAngle = _mlAssistStrategy.coverDirection;
          var coverDist = _mlAssistStrategy.followDistance || 8;
          // Position NPC at player's vulnerable side using GameManager player position
          var playerPos = (typeof GameManager !== 'undefined' && GameManager.getPlayer) ? GameManager.getPlayer().position : null;
          if (playerPos) {
            var playerYaw = (typeof CameraSystem !== 'undefined' && CameraSystem.getYaw) ? CameraSystem.getYaw() : 0;
            var worldCoverAngle = playerYaw + coverAngle;
            var coverTarget = _nTmp3.set(
              playerPos.x + Math.sin(worldCoverAngle) * coverDist + (Math.random() - 0.5) * 3,
              0,
              playerPos.z + Math.cos(worldCoverAngle) * coverDist + (Math.random() - 0.5) * 3
            );
            if (npc.target) npc.target.copy(coverTarget);
            else npc.target = coverTarget.clone();
          }
        }
        if (!npc.target) {
          // Default: Move toward center (0,0,0) where battles happen, with some randomness
          _nTmp1.set(-npc.position.x, 0, -npc.position.z).normalize();
          _nTmp2.copy(npc.position).addScaledVector(_nTmp1, 5 + Math.random() * 10);
          _nTmp2.x += (Math.random() - 0.5) * 10;
          _nTmp2.z += (Math.random() - 0.5) * 10;
          _nTmp2.y = 0;
          if (npc.target) npc.target.copy(_nTmp2);
          else npc.target = _nTmp2.clone();
        }
      }
    }

    // Medic behavior: heal nearby wounded friendlies, then fight
    if (npc.job === JOB.MEDIC) {
      const wounded = npcs.find(n => n.alive && n !== npc && n.health < 60 &&
        npc.position.distanceTo(n.position) < 18);
      if (wounded) {
        const d = npc.position.distanceTo(wounded.position);
        if (d > 2) {
          if (npc.target) npc.target.copy(wounded.position);
          else npc.target = wounded.position.clone();
        } else {
          npc.target = null;
          wounded.health = Math.min(100, wounded.health + delta * 12);
          wounded.stress = Math.max(0, wounded.stress - delta * 2);
        }
        return;
      }
      // If no wounded, engage enemies
      if (npc.weapon) {
        const nearestEnemy = findNearestEnemy(npc);
        if (nearestEnemy) {
          npc.combatTarget = nearestEnemy.enemy;
          updateCombat(npc, delta, nearestEnemy);
          return;
        }
      }
    }

    // Guard position behavior: return to guard point if too far
    if (npc.job === JOB.GUARD && npc.guardPos) {
      const gDist = npc.position.distanceTo(npc.guardPos);
      if (gDist > 3 && !npc.combatTarget) {
        if (npc.target) npc.target.copy(npc.guardPos);
        else npc.target = npc.guardPos.clone();
      }
    }

    // Assault job: handled by group AI, just ensure combat readiness
    if (npc.job === JOB.ASSAULT && !npc.target) {
      // If no group target, look for enemies
      const nearestEnemy = findNearestEnemy(npc);
      if (nearestEnemy) {
        npc.combatTarget = nearestEnemy.enemy;
        updateCombat(npc, delta, nearestEnemy);
        return;
      }
    }

    // Critical needs override job
    if (npc.fatigue > 85 && npc.job !== JOB.REST) {
      npc.asleep = true;
      npc.job = JOB.REST;
      npc.target = null;
      return;
    }

    if (npc.hunger < 15 && npc.job !== JOB.REST) {
      npc.stress = Math.min(100, npc.stress + delta * 0.5);
    }

    // Night behavior: non-combat roles go to rest
    if (timeInfo && timeInfo.phase === 'night') {
      if (npc.job !== JOB.GUARD && npc.job !== JOB.PATROL &&
          npc.job !== JOB.REST && npc.job !== JOB.ASSAULT && npc.job !== JOB.MEDIC) {
        if (npc.fatigue > 40) {
          npc.job = JOB.REST;
          npc.asleep = true;
          return;
        }
      }
    }

    // Job timer
    npc.jobTimer += delta;

    // Skill improvement through work
    if (npc.jobTimer > 10) {
      npc.jobTimer = 0;
      improveSkill(npc);
    }

    // Wander if idle — follow player loosely, not wander to center
    if (npc.job === JOB.IDLE && !npc.target) {
      // Follow player at a loose distance
      var playerPos = (typeof GameManager !== 'undefined' && GameManager.getPlayer) ? GameManager.getPlayer().position : null;
      if (playerPos) {
        var pDist = npc.position.distanceTo(playerPos);
        if (pDist > 10) {
          // Move toward player, stop at ~6-8 units away
          var followDist = 6 + (npc.id % 3) * 2; // stagger follow distance by NPC id
          var followAngle = ((npc.id % 6) / 6) * Math.PI * 2; // spread around player
          _nTmp2.set(
            playerPos.x + Math.sin(followAngle) * followDist,
            0,
            playerPos.z + Math.cos(followAngle) * followDist
          );
          if (npc.target) npc.target.copy(_nTmp2);
          else npc.target = _nTmp2.clone();
        }
      } else {
        // Fallback: patrol toward center
        _nTmp1.set(-npc.position.x, 0, -npc.position.z).normalize();
        _nTmp2.copy(npc.position).addScaledVector(_nTmp1, 3 + Math.random() * 8);
        _nTmp2.x += (Math.random() - 0.5) * 8;
        _nTmp2.z += (Math.random() - 0.5) * 8;
        _nTmp2.y = 0;
        if (npc.target) npc.target.copy(_nTmp2);
        else npc.target = _nTmp2.clone();
      }
    }
  }

  /* ── Skill Improvement ───────────────────────────────────────────── */
  function improveSkill(npc) {
    const gain = 0.1 + Math.random() * 0.2;
    switch (npc.job) {
      case JOB.GUARD:
      case JOB.PATROL:
        npc.skills.combat = Math.min(100, npc.skills.combat + gain);
        break;
      case JOB.BUILD:
      case JOB.REPAIR:
        npc.skills.building = Math.min(100, npc.skills.building + gain);
        break;
      case JOB.CRAFT:
        npc.skills.crafting = Math.min(100, npc.skills.crafting + gain);
        break;
      case JOB.DRONE_OP:
        npc.skills.droneOps = Math.min(100, npc.skills.droneOps + gain);
        break;
      case JOB.TRAIN:
        npc.skills.combat = Math.min(100, npc.skills.combat + gain * 1.5);
        break;
    }

    // Check for rank promotion
    checkPromotion(npc);
  }

  function checkPromotion(npc) {
    const totalSkill = Object.values(npc.skills).reduce((s, v) => s + v, 0);
    const rankIdx = RANK_ORDER.indexOf(npc.rank);
    const thresholds = [0, 30, 80, 150, 250, 400];
    if (rankIdx < RANK_ORDER.length - 1 && totalSkill >= thresholds[rankIdx + 1]) {
      npc.rank = RANK_ORDER[rankIdx + 1];
      // Upgrade weapon on promotion
      const newWeapon = RANK_WEAPONS[npc.rank] || null;
      if (newWeapon && (!npc.weapon || newWeapon.damage >= npc.weapon.damage)) {
        npc.weapon = newWeapon;
        // Replace weapon mesh on NPC — dispose old mesh to prevent memory leak
        if (npc.mesh && npc.mesh.userData.weaponMesh) {
          disposeMesh(npc.mesh.userData.weaponMesh);
          npc.mesh.remove(npc.mesh.userData.weaponMesh);
        }
        if (npc.mesh) {
          const wepMesh = buildNPCWeaponMesh(newWeapon);
          if (wepMesh) {
            wepMesh.position.set(0.32, 0.65, -0.12);
            wepMesh.rotation.x = -0.15;
            npc.mesh.add(wepMesh);
            npc.mesh.userData.weaponMesh = wepMesh;
          }
        }
      }
    }
  }

  /* ── Movement ────────────────────────────────────────────────────── */
  function updateMovement(npc, delta) {
    if (!npc.target || npc.asleep) return;

    const dir = _nTmp2.copy(npc.target).sub(npc.position);
    dir.y = 0;
    const dist = dir.length();

    if (dist < 0.5) {
      npc.target = null;
      return;
    }

    dir.normalize();
    // Apply morale speed modifier
    var moraleFx = applyMoraleEffects(npc);
    const move = dir.multiplyScalar(npc.speed * moraleFx.speedMult * delta);
    npc.position.add(move);

    // Terrain follow
    const terrainY = (typeof VoxelWorld !== 'undefined') ? VoxelWorld.getTerrainHeight(npc.position.x, npc.position.z) : 0;
    npc.position.y = terrainY;

    npc.mesh.position.copy(npc.position);

    // Face movement direction
    npc.mesh.rotation.y = Math.atan2(dir.x, dir.z);
  }

  /* ── Animation ───────────────────────────────────────────────────── */
  let _animTime = 0;
  function updateAnimation(npc, delta) {
    _animTime += delta;

    // Reset fire flash
    if (npc.fireFlash > 0) {
      npc.fireFlash -= delta;
      if (npc.fireFlash <= 0) {
        npc.mesh.children.forEach(child => {
          if (child.userData.isArm && child.userData._savedMaterial) {
            child.material = child.userData._savedMaterial;
          }
        });
      }
    }

    if (npc.target && !npc.asleep) {
      npc.mesh.children.forEach(child => {
        if (child.userData.isLeg) {
          child.rotation.x = Math.sin(_animTime * 6 + (child.position.x > 0 ? Math.PI : 0)) * 0.4;
        }
        if (child.userData.isArm) {
          child.rotation.x = Math.sin(_animTime * 6 + (child.position.x > 0 ? 0 : Math.PI)) * 0.3;
        }
      });
    }
  }

  /* ── Dispose helper — release Three.js GPU resources ─────────── */
  function disposeMesh(obj) {
    if (!obj) return;
    obj.traverse(function (child) {
      if (child.geometry)  child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }

  /* ── NPC Death ───────────────────────────────────────────────────── */
  function killNPC(npc) {
    npc.alive = false;
    delete _npcById[npc.id];
    if (npc.mesh) {
      disposeMesh(npc.mesh);
      if (_scene) _scene.remove(npc.mesh);
      npc.mesh = null;
    }
  }

  /* ── Job Assignment ──────────────────────────────────────────────── */
  function assignJob(npcId, job, target) {
    const npc = npcs.find(n => n.id === npcId);
    if (!npc || !npc.alive) return false;
    npc.job = job;
    npc.jobTarget = target || null;
    npc.jobTimer = 0;
    npc.assigned = true;
    return true;
  }

  /* ── Damage NPC ──────────────────────────────────────────────────── */
  function damage(npcId, amount) {
    const npc = npcs.find(n => n.id === npcId);
    if (!npc || !npc.alive) return;
    npc.health -= amount;
    npc.stress = Math.min(100, npc.stress + 15);
    if (npc.health <= 0) killNPC(npc);
  }

  /* ── Feed NPC ────────────────────────────────────────────────────── */
  function feedNPC(npcId, amount) {
    const npc = npcs.find(n => n.id === npcId);
    if (!npc || !npc.alive) return;
    npc.hunger = Math.min(100, npc.hunger + amount);
  }

  /* ── Queries ─────────────────────────────────────────────────────── */
  var _npcAliveCache = [];
  var _npcCacheFrame = -1;
  function _rebuildNpcCache() {
    var f = performance.now();
    if (f === _npcCacheFrame) return;
    _npcCacheFrame = f;
    _npcAliveCache.length = 0;
    for (var i = 0; i < npcs.length; i++) {
      if (npcs[i].alive) _npcAliveCache.push(npcs[i]);
    }
  }
  function getAll()      { _rebuildNpcCache(); return _npcAliveCache; }
  function getCount()    { _rebuildNpcCache(); return _npcAliveCache.length; }
  function getById(id)   { return npcs.find(n => n.id === id && n.alive); }
  function getByJob(job) { return npcs.filter(n => n.alive && n.job === job); }
  function getByRank(r)  { return npcs.filter(n => n.alive && n.rank === r); }

  function getAverageMorale() {
    const alive = getAll();
    if (alive.length === 0) return 0;
    return alive.reduce((s, n) => s + n.morale, 0) / alive.length;
  }

  /* ── Cleanup ─────────────────────────────────────────────────────── */
  function clear() {
    for (const npc of npcs) {
      if (npc.mesh) {
        disposeMesh(npc.mesh);
        if (_scene) _scene.remove(npc.mesh);
      }
    }
    npcs.length = 0;
    _npcById = {};
    friendlyGroups.length = 0;
  }

  /* ── NPC Dialogue System — Context-sensitive barks ─────────────── */
  const NPC_BARKS = {
    idle: [
      'Слава Україні!', 'Все чисто!', 'Тримай позицію!',
      'Sector clear, moving up.', 'Quiet... too quiet.', 'Copy that, holding position.'
    ],
    combat: [
      'Contact front!', 'Covering fire!', 'Перезаряджаюсь!',
      'Suppressing!', 'Grenade out!', 'Keep firing!'
    ],
    wounded: [
      'Need medic!', 'Мені потрібна допомога!', 'I\'m hit!', 'Medic! Over here!'
    ],
    victory: [
      'Target down!', 'Ворог знищений!', 'Area secured.', 'Героям слава!'
    ],
    spotted_enemy: [
      'ВРАГ! ВОРОГ!', 'Enemy spotted!', 'Ammunition low!', 'Moving up!'
    ]
  };

  function getRandomBark(category) {
    const lines = NPC_BARKS[category];
    if (!lines || lines.length === 0) return '';
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function triggerBark(npcId, category) {
    const bark = getRandomBark(category);
    if (!bark) return null;
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playBark) {
      AudioSystem.playBark(npcId, bark);
    }
    return bark;
  }

  /* ── NPC Morale Effects ──────────────────────────────────────────── */
  function applyMoraleEffects(npc) {
    const m = npc.morale;
    const result = { speedMult: 1, accuracyMult: 1, fleeing: false };
    if (m < 30) {
      result.accuracyMult = 0.75;
      if (Math.random() < 0.2) result.fleeing = true;
    } else if (m < 50) {
      result.accuracyMult = 0.75;
    }
    if (m > 80) {
      result.speedMult = 1.15;
    }
    return result;
  }

  /* ── NPC Equipment Upgrades ──────────────────────────────────────── */
  const NPC_UPGRADES = {
    body_armor:    { label: 'Body Armor',    hpBonus: 50 },
    better_weapon: { label: 'Better Weapon', damageMult: 1.25 },
    radio:         { label: 'Radio',         detectionMult: 1.5 },
    medkit:        { label: 'Medkit',        selfHeal: true },
    nvg:           { label: 'NVG',           nightPenalty: 0 }
  };

  const _npcUpgrades = {}; // npcId -> Set of upgrade ids

  function upgradeNPC(npcId, upgradeId) {
    const npc = npcs.find(n => n.id === npcId && n.alive);
    if (!npc) return false;
    const def = NPC_UPGRADES[upgradeId];
    if (!def) return false;
    if (!_npcUpgrades[npcId]) _npcUpgrades[npcId] = new Set();
    if (_npcUpgrades[npcId].has(upgradeId)) return false;
    _npcUpgrades[npcId].add(upgradeId);
    if (upgradeId === 'body_armor') npc.health = Math.min(150, npc.health + def.hpBonus);
    if (upgradeId === 'better_weapon' && npc.weapon) {
      npc.weapon = Object.assign({}, npc.weapon, { damage: npc.weapon.damage * def.damageMult });
    }
    return true;
  }

  function getUpgrades(npcId) {
    return _npcUpgrades[npcId] ? Array.from(_npcUpgrades[npcId]) : [];
  }

  /* ── NPC Squad Commands ──────────────────────────────────────────── */
  function commandSquad(groupId, command) {
    const grp = friendlyGroups.find(g => g.id === groupId);
    if (!grp) return false;
    const aliveMembers = grp.members
      .map(id => npcs.find(n => n.id === id))
      .filter(n => n && n.alive);
    if (aliveMembers.length === 0) return false;

    switch (command) {
      case 'attack':
        grp.state = FGROUP_STATE.ADVANCING;
        grp.stateTimer = 20;
        for (const npc of aliveMembers) {
          npc.job = JOB.ASSAULT;
          npc.target = grp.guardPoint.clone();
        }
        break;
      case 'defend':
        grp.state = FGROUP_STATE.DEFENDING;
        grp.stateTimer = 30;
        for (const npc of aliveMembers) {
          npc.job = JOB.GUARD;
          npc.guardPos = grp.guardPoint.clone();
        }
        break;
      case 'regroup':
        grp.state = FGROUP_STATE.REGROUPING;
        grp.stateTimer = 10;
        for (const npc of aliveMembers) {
          npc.target = grp.rallyPoint.clone();
        }
        break;
      case 'flank_left': {
        grp.state = FGROUP_STATE.ADVANCING;
        grp.stateTimer = 15;
        const flankL = grp.guardPoint.clone();
        flankL.x -= 12;
        for (const npc of aliveMembers) {
          npc.job = JOB.ASSAULT;
          npc.target = flankL.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
        }
        break;
      }
      case 'flank_right': {
        grp.state = FGROUP_STATE.ADVANCING;
        grp.stateTimer = 15;
        const flankR = grp.guardPoint.clone();
        flankR.x += 12;
        for (const npc of aliveMembers) {
          npc.job = JOB.ASSAULT;
          npc.target = flankR.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
        }
        break;
      }
      case 'hold_fire':
        grp.state = FGROUP_STATE.DEFENDING;
        grp.stateTimer = 60;
        for (const npc of aliveMembers) {
          npc.combatTarget = null;
          npc.target = null;
          npc.job = JOB.GUARD;
          npc.guardPos = npc.position.clone();
        }
        break;
      default:
        return false;
    }
    return true;
  }

  return {
    NPC_RANK,
    JOB,
    init,
    spawn,
    update,
    assignJob,
    damage,
    feedNPC,
    killNPC,
    getAll,
    getCount,
    getById,
    getByJob,
    getByRank,
    getAverageMorale,
    clear,
    spawnAssaultGroups,
    assignGuardPositions,
    getFriendlyGroups: function () { return friendlyGroups; },
    setMLStrategy: function (strategy) { _mlAssistStrategy = strategy; },
    // Dialogue
    NPC_BARKS,
    getRandomBark,
    triggerBark,
    // Morale effects
    applyMoraleEffects,
    // Equipment upgrades
    NPC_UPGRADES,
    upgradeNPC,
    getUpgrades,
    // Squad commands
    commandSquad,
  };
})();
