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
  });

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
      speed:    2.5,
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

    npc.mesh = buildNPCMesh(npc);
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

    // ── Helmet with blue-yellow cross tape ────────────────
    const helmetTex = makeUkrainianHelmetTexture(helmetColor);
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.16, 0.40),
      new THREE.MeshLambertMaterial({ map: helmetTex })
    );
    helmet.position.y = 1.44;
    group.add(helmet);

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
    return group;
  }

  /* ── Init ────────────────────────────────────────────────────────── */
  function init(scene) {
    _scene = scene;
    npcs.length = 0;
    nextId = 1;
    friendlyGroups.length = 0;
  }

  /* ── Spawn NPC ───────────────────────────────────────────────────── */
  function spawn(x, y, z, rank) {
    const npc = createNPC(x, y, z, rank);
    npcs.push(npc);
    _npcById[npc.id] = npc;
    if (_scene) _scene.add(npc.mesh);
    return npc;
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
      updateNeeds(npc, delta, timeInfo);
      updateBehavior(npc, delta, timeInfo);
      updateMovement(npc, delta);
      updateAnimation(npc, delta);
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
                npc.target = grp.guardPoint.clone();
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
                npc.guardPos = grp.guardPoint.clone();
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
                npc.target = grp.guardPoint.clone();
              }
            }
          }
          break;

        case FGROUP_STATE.RETREATING:
          for (const npc of aliveMembers) {
            npc.target = grp.rallyPoint.clone();
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
                npc.target = wounded.position.clone();
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
      if (!e.mesh) continue;
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

    const dist = target.dist;
    const enemy = target.enemy;
    const wep = npc.weapon;

    if (dist > wep.range * 0.7) {
      // Move toward enemy, stop at ~50% of max range
      var dir = _nTmp1.subVectors(enemy.mesh.position, npc.position).setY(0).normalize();
      npc.target = npc.position.clone().add(dir.multiplyScalar(dist - wep.range * 0.5));
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
        // Weapon damage + skill bonus
        const dmg = wep.damage + npc.skills.combat * 0.15;

        if (typeof Enemies !== 'undefined' && Enemies.damage) {
          const remaining = Enemies.damage(enemy, dmg);
          if (remaining <= 0) {
            npc.stress = Math.max(0, npc.stress - 5);
            npc.morale = Math.min(100, npc.morale + 5);
            npc.combatTarget = null;
          }
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
      npc.target = npc.position.clone().add(away.multiplyScalar(6));
    }
  }

  /* ── AI Behavior ─────────────────────────────────────────────────── */
  function updateBehavior(npc, delta, timeInfo) {
    // Combat takes highest priority for ALL armed NPCs (except medics who heal first)
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
            var coverTarget = new THREE.Vector3(
              playerPos.x + Math.sin(worldCoverAngle) * coverDist + (Math.random() - 0.5) * 3,
              0,
              playerPos.z + Math.cos(worldCoverAngle) * coverDist + (Math.random() - 0.5) * 3
            );
            coverTarget.y = 0;
            npc.target = coverTarget;
          }
        }
        if (!npc.target) {
          // Default: Move toward center (0,0,0) where battles happen, with some randomness
          const toCenter = new THREE.Vector3(-npc.position.x, 0, -npc.position.z).normalize();
          const randomOffset = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10
          );
          const huntTarget = npc.position.clone().add(toCenter.multiplyScalar(5 + Math.random() * 10)).add(randomOffset);
          huntTarget.y = 0;
          npc.target = huntTarget;
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
          npc.target = wounded.position.clone();
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
        npc.target = npc.guardPos.clone();
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

    // Wander if idle — patrol toward battle areas, not random
    if (npc.job === JOB.IDLE && !npc.target) {
      // Move toward center where enemies likely are, with randomness
      const toCenter = new THREE.Vector3(-npc.position.x, 0, -npc.position.z).normalize();
      const idleOffset = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        0,
        (Math.random() - 0.5) * 8
      );
      const idleTarget = npc.position.clone().add(toCenter.multiplyScalar(3 + Math.random() * 8)).add(idleOffset);
      idleTarget.y = 0;
      npc.target = idleTarget;
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
    const move = dir.multiplyScalar(npc.speed * delta);
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
    if (npc.mesh) {
      disposeMesh(npc.mesh);
      if (_scene) _scene.remove(npc.mesh);
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
