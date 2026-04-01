/**
 * enemies.js – Occupant spawning, AI, floating HP bars, and hit detection
 * Level 1 "ZOMBIELAND" – based on Avdiivka assault waves.
 * Three enemy types: CONSCRIPT (cannon fodder), STORMER (rusher), ARMORED (heavy)
 * Uniforms: Russian EMR Digital Flora camo — accurate palette.
 * Insignia: White «Z» on helmet side + white armband on left arm.
 * Depends on: Three.js global (THREE)
 */

const Enemies = (() => {

  const MAX_CLIMBABLE_HEIGHT = 2; // Max terrain height difference enemies can climb

  // ── Russian EMR Digital Flora camo palette ─────────────────
  // 4 tones used across body/limb meshes via procedural canvas texture
  const EMR_CAMO = {
    light:  0x5a7a4a,  // light olive-green
    medium: 0x4a6a3a,  // medium olive
    dark:   0x2a3a1a,  // dark olive / near-black
    tan:    0x8a7a6a,  // grey-tan (urban accent)
  };

  // Canvas-based digital-pixel camo texture generator
  function makeEMRCamoTexture(variant) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Palette in CSS hex strings
    const palette = variant === 'dark'
      ? ['#2a3a1a', '#3a4a2a', '#4a5a3a', '#1a2a0a']
      : ['#5a7a4a', '#4a6a3a', '#3a5a2a', '#8a7a6a'];

    // Fill base
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, size, size);

    // Digital pixel squares (4×4 blocks)
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

  // ── Enemy type definitions ────────────────────────────────
  const TYPES = {
    CONSCRIPT: {
      name:        'CONSCRIPT',
      hpBase:      40,
      speedBase:   2.0,
      scale:       1.0,
      camoVariant: 'light',           // EMR standard green
      bodyColor:   EMR_CAMO.medium,   // fallback flat color
      headColor:   0xc8a882,          // skin tone
      limbColor:   EMR_CAMO.dark,
      helmetColor: 0x3a3a2a,          // steel-dark EMR helmet
      eyeColor:    0x880000,
      attackDmg:   8,
      attackRate:  1.2,
      scoreValue:  100,
      dropChance:  0.30,
    },
    STORMER: {
      name:        'STORMER',
      hpBase:      30,
      speedBase:   4.2,
      scale:       0.85,
      camoVariant: 'dark',            // darker field uniform
      bodyColor:   EMR_CAMO.dark,
      headColor:   0xb09070,
      limbColor:   0x2a3a1a,
      helmetColor: 0x2a2a1a,
      eyeColor:    0xff4400,
      attackDmg:   6,
      attackRate:  0.7,
      scoreValue:  150,
      dropChance:  0.20,
    },
    ARMORED: {
      name:        'ARMORED',
      hpBase:      220,
      speedBase:   1.0,
      scale:       1.4,
      camoVariant: 'dark',            // heavy armour over dark EMR
      bodyColor:   EMR_CAMO.dark,
      headColor:   0xd0b090,
      limbColor:   0x1a2a0a,
      helmetColor: 0x1a1a10,
      eyeColor:    0xff0000,
      attackDmg:   22,
      attackRate:  1.8,
      scoreValue:  350,
      dropChance:  0.85,
    },
    MEDIC: {
      name:        'MEDIC',
      hpBase:      35,
      speedBase:   2.5,
      scale:       1.0,
      camoVariant: 'light',
      bodyColor:   EMR_CAMO.medium,
      headColor:   0xc8a882,
      limbColor:   EMR_CAMO.dark,
      helmetColor: 0x3a3a2a,
      eyeColor:    0x00aa00,
      attackDmg:   4,
      attackRate:  2.0,
      scoreValue:  200,
      dropChance:  0.50,
      role:        'medic',
    },
    OFFICER: {
      name:        'OFFICER',
      hpBase:      80,
      speedBase:   1.8,
      scale:       1.1,
      camoVariant: 'dark',
      bodyColor:   EMR_CAMO.dark,
      headColor:   0xd0b090,
      limbColor:   0x2a3a1a,
      helmetColor: 0x2a2a2a,
      eyeColor:    0xff2200,
      attackDmg:   14,
      attackRate:  1.0,
      scoreValue:  500,
      dropChance:  0.60,
      role:        'officer',
    },
  };

  // ── Enemy Roles for Assault Groups ──────────────────────
  const SQUAD_ROLE = Object.freeze({
    POINTMAN:  'pointman',   // leads group, scouts ahead
    RIFLEMAN:  'rifleman',   // basic combat
    SUPPORT:   'support',    // suppressive fire
    MEDIC:     'medic',      // heals wounded
    OFFICER:   'officer',    // group leader, boosts morale
    EVAC:      'evac',       // drags wounded to safety
  });

  // ── Assault Group System ────────────────────────────────
  // 5 enemy assault groups, Russian army "штурмовая группа" style
  const NUM_ASSAULT_GROUPS = 5;
  const assaultGroups = [];

  // Group states
  const GROUP_STATE = Object.freeze({
    FORMING:    'forming',     // gathering at rally point
    ADVANCING:  'advancing',   // moving toward objective
    ASSAULTING: 'assaulting',  // attacking objective/NPCs
    RETREATING: 'retreating',  // falling back with wounded
    REGROUPING: 'regrouping',  // reforming after losses
    EVAC:       'evac',        // evacuating wounded
  });

  function createAssaultGroup(id, spawnCenter) {
    const objectiveAngle = Math.random() * Math.PI * 2;
    const objectiveDist = 8 + Math.random() * 12;
    return {
      id: id,
      state: GROUP_STATE.FORMING,
      stateTimer: 3 + Math.random() * 5,
      rallyPoint: spawnCenter.clone(),
      objective: new THREE.Vector3(
        Math.cos(objectiveAngle) * objectiveDist,
        0,
        Math.sin(objectiveAngle) * objectiveDist
      ),
      members: [],        // enemy indices
      wounded: [],         // wounded member indices
      morale: 80 + Math.random() * 20,
      hasOfficer: false,
      hasMedic: false,
      formationSpread: 2 + Math.random() * 2,
    };
  }

  // ── Military Ranks ───────────────────────────────────────
  const RANKS = [
    { id: 'PRIVATE',    name: 'Рядовой',    hpMult: 0.8, spdMult: 1.0, score: 50,   dropTier: 0 },
    { id: 'CORPORAL',   name: 'Єфрейтор',   hpMult: 1.0, spdMult: 1.0, score: 100,  dropTier: 0 },
    { id: 'SERGEANT',   name: 'Сержант',     hpMult: 1.2, spdMult: 1.1, score: 200,  dropTier: 1 },
    { id: 'WARRANT',    name: 'Старшина',    hpMult: 1.5, spdMult: 1.0, score: 300,  dropTier: 1 },
    { id: 'LIEUTENANT', name: 'Лейтенант',   hpMult: 1.8, spdMult: 0.9, score: 500,  dropTier: 2 },
    { id: 'CAPTAIN',    name: 'Капітан',     hpMult: 2.0, spdMult: 0.9, score: 750,  dropTier: 2 },
    { id: 'MAJOR',      name: 'Майор',       hpMult: 2.5, spdMult: 0.8, score: 1000, dropTier: 3 },
    { id: 'COLONEL',    name: 'Полковник',   hpMult: 3.0, spdMult: 0.7, score: 2000, dropTier: 3 },
    { id: 'GENERAL',    name: 'Генерал',     hpMult: 5.0, spdMult: 0.5, score: 5000, dropTier: 4 },
  ];

  // ── Unit Types ───────────────────────────────────────────
  const UNITS = [
    { id: 'REGULAR',  name: 'Regular Army',   marking: 'Z',  armband: 0xffffff },
    { id: 'VDV',      name: 'VDV Airborne',   marking: 'V',  armband: 0xffffff, beret: 0x3366aa },
    { id: 'WAGNER',   name: 'Wagner PMC',     marking: 'W',  armband: 0x111111 },
    { id: 'DNR',      name: 'DNR Militia',    marking: 'Z',  armband: 0xff8800 },
    { id: 'SPETSNAZ', name: 'Spetsnaz',       marking: 'Z',  armband: 0xffffff },
    { id: 'MARINES',  name: 'Naval Infantry', marking: 'Z',  armband: 0xffffff, beret: 0x111111 },
  ];

  // ── Pick rank based on wave number ───────────────────────
  function pickRank(waveNum) {
    const r = Math.random();
    if (waveNum >= 5 && r < 0.03) return RANKS[8]; // GENERAL
    if (waveNum >= 4 && r < 0.08) return RANKS[7]; // COLONEL
    if (waveNum >= 4 && r < 0.15) return RANKS[6]; // MAJOR
    if (waveNum >= 3 && r < 0.25) return RANKS[5]; // CAPTAIN
    if (waveNum >= 3 && r < 0.35) return RANKS[4]; // LIEUTENANT
    if (waveNum >= 2 && r < 0.50) return RANKS[3]; // WARRANT
    if (waveNum >= 2 && r < 0.65) return RANKS[2]; // SERGEANT
    if (r < 0.80) return RANKS[1]; // CORPORAL
    return RANKS[0]; // PRIVATE
  }

  // ── Pick random unit ────────────────────────────────────
  function pickUnit() {
    return UNITS[Math.floor(Math.random() * UNITS.length)];
  }

  // ── Internal state ────────────────────────────────────────
  let scene      = null;
  let enemies    = [];
  let wave       = 1;
  let spawnQueue = [];   // array of type-name strings
  let spawnTimer = 0;
  let allDead    = false;
  let stageMult  = 1;    // stage difficulty multiplier
  let _playerPos = null; // cached player position for spawning
  let _playerStealth = false; // player stealth state

  const ARENA_SIZE = 24;
  const DETECTION_RANGE = 14;   // enemies detect player within this range
  const DETECTION_ANGLE = 1.2;  // ~70° half-cone FOV for detection
  const SPOT_TIME = 1.5;        // seconds to fully spot player

  // ── Choose a type appropriate for the current wave ────────
  function pickTypeForWave(w) {
    const r = Math.random();
    if (w >= 5 && r < 0.20) return 'ARMORED';
    if (w >= 3 && r < 0.50) return 'STORMER';
    return 'CONSCRIPT';
  }

  // ── White «Z» texture for helmet side ─────────────────────
  // Draws a white Z letter on a dark olive canvas
  function makeHelmetZTexture(helmetColorHex) {
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

    // White Z – drawn with 3 pixel-art lines
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 8, 16, 3);        // top bar
    // Diagonal (stair-stepped)
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(20 - i * 3, 11 + i * 2, 4, 3);
    }
    ctx.fillRect(8, 21, 16, 3);       // bottom bar

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  // ── White armband texture ──────────────────────────────────
  function makeWhiteArmbandTexture(limbColorHex) {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base arm color
    const r = (limbColorHex >> 16) & 0xff;
    const g = (limbColorHex >> 8)  & 0xff;
    const b =  limbColorHex        & 0xff;
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(0, 0, size, size);

    // White band in upper third (like an armband near shoulder)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 2, size, 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  // ── Build humanoid mesh scaled to typeCfg ─────────────────
  // Full EMR camo uniforms, white Z on helmet, white armband
  function buildMesh(typeCfg) {
    const group = new THREE.Group();
    const s     = typeCfg.scale;

    // Generate EMR Digital Flora camo texture for this unit
    const camoTex = makeEMRCamoTexture(typeCfg.camoVariant || 'light');

    // ── Torso (camo textured) ─────────────────────────────
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.52 * s, 0.7 * s, 0.26 * s),
      new THREE.MeshLambertMaterial({ map: camoTex })
    );
    torso.position.y = 0.85 * s;

    // ── Head (skin) ───────────────────────────────────────
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.34 * s, 0.34 * s, 0.34 * s),
      new THREE.MeshLambertMaterial({ color: typeCfg.headColor })
    );
    head.position.y = 1.4 * s;

    // ── Helmet with white «Z» insignia ────────────────────
    const helmetZTex = makeHelmetZTexture(typeCfg.helmetColor);
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.40 * s, 0.18 * s, 0.40 * s),
      new THREE.MeshLambertMaterial({ map: helmetZTex })
    );
    helmet.position.y = 1.55 * s;

    // ── Legs (camo textured, darker variant) ──────────────
    const legCamo = makeEMRCamoTexture('dark');
    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.21 * s, 0.55 * s, 0.21 * s),
      new THREE.MeshLambertMaterial({ map: legCamo })
    );
    legL.position.set(-0.14 * s, 0.28 * s, 0);
    const legR = legL.clone();
    legR.position.set(0.14 * s, 0.28 * s, 0);

    // ── Left arm with WHITE ARMBAND (Russian ID marking) ──
    const armbandTex = makeWhiteArmbandTexture(typeCfg.limbColor);
    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * s, 0.52 * s, 0.18 * s),
      new THREE.MeshLambertMaterial({ map: armbandTex })
    );
    armL.position.set(-0.35 * s, 0.82 * s, 0);

    // ── Right arm (plain camo) ────────────────────────────
    const armR = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * s, 0.52 * s, 0.18 * s),
      new THREE.MeshLambertMaterial({ map: camoTex })
    );
    armR.position.set(0.35 * s, 0.82 * s, 0);

    group.add(torso, head, helmet, legL, legR, armL, armR);

    // ── Body Armor (6B45 vest over torso) ─────────────────
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.56 * s, 0.55 * s, 0.30 * s),
      new THREE.MeshLambertMaterial({ color: 0x3A4A2A })
    );
    vest.position.y = 0.92 * s;
    group.add(vest);

    // ── Magazine pouches on chest ─────────────────────────
    for (let i = -1; i <= 1; i++) {
      const pouch = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 * s, 0.08 * s, 0.04 * s),
        new THREE.MeshLambertMaterial({ color: 0x2a3a1a })
      );
      pouch.position.set(i * 0.1 * s, 0.95 * s, 0.16 * s);
      group.add(pouch);
    }

    // ── Canteen on hip ────────────────────────────────────
    const canteen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.08 * s, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a3a1a })
    );
    canteen.position.set(-0.30 * s, 0.50 * s, 0);
    group.add(canteen);

    // ── Radio on chest ────────────────────────────────────
    const radio = new THREE.Mesh(
      new THREE.BoxGeometry(0.04 * s, 0.06 * s, 0.02 * s),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    radio.position.set(0.20 * s, 1.05 * s, 0.14 * s);
    group.add(radio);

    // ── Belt / equipment strip (dark webbing) ─────────────
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.54 * s, 0.06 * s, 0.28 * s),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    belt.position.y = 0.53 * s;
    group.add(belt);

    // ── Boots (dark brown — historically accurate) ────────
    for (const legMesh of [legL, legR]) {
      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.22 * s, 0.18 * s, 0.22 * s),
        new THREE.MeshLambertMaterial({ color: 0x2A1A0A })
      );
      boot.position.copy(legMesh.position);
      boot.position.y = 0.04 * s;
      group.add(boot);

      // Knee pad
      const kneePad = new THREE.Mesh(
        new THREE.BoxGeometry(0.10 * s, 0.06 * s, 0.04 * s),
        new THREE.MeshLambertMaterial({ color: 0x1a1a0a })
      );
      kneePad.position.copy(legMesh.position);
      kneePad.position.y = 0.18 * s;
      kneePad.position.z = 0.12 * s;
      group.add(kneePad);
    }

    // Eye glow
    const eyeGeo = new THREE.SphereGeometry(0.04 * s, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: typeCfg.eyeColor });
    const eyeL   = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08 * s, 1.42 * s, 0.18 * s);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.08 * s, 1.42 * s, 0.18 * s);
    group.add(eyeL, eyeR);

    // Invisible hitbox — use transparent+opacity:0 so Raycaster still detects it
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.6 * s, 1.75 * s, 0.4 * s),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    );
    hitbox.position.y = 0.87 * s;
    group.add(hitbox);

    group.userData.headMesh = head;
    group.userData.hitbox   = hitbox;
    group.userData.parts    = [torso, head, helmet, legL, legR, armL, armR, hitbox];
    group.userData.faction  = 'occupant';

    return group;
  }

  // ── Floating HP bar (lives in scene, follows enemy) ───────
  function buildHpBar() {
    const group = new THREE.Group();

    const bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.09),
      new THREE.MeshBasicMaterial({
        color:      0x330000,
        side:       THREE.DoubleSide,
        depthTest:  true,
        depthWrite: false,
        transparent: true,
        opacity:    0.85,
      })
    );

    const fgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.09),
      new THREE.MeshBasicMaterial({
        color:      0x44ff44,
        side:       THREE.DoubleSide,
        depthTest:  true,
        depthWrite: false,
        transparent: true,
        opacity:    0.9,
      })
    );
    fgMesh.position.z = 0.002;

    group.add(bgMesh, fgMesh);
    scene.add(group);
    return { group, fg: fgMesh };
  }

  // ── Spawn one enemy ───────────────────────────────────────
  function spawnOne(typeName, groupId, spawnPos) {
    const typeCfg = TYPES[typeName] || TYPES.CONSCRIPT;
    const rank = pickRank(wave);
    const unit = pickUnit();

    // Spawn position: if spawnPos provided (for group), use it; else around player
    let sx, sz;
    if (spawnPos) {
      sx = spawnPos.x + (Math.random() - 0.5) * 4;
      sz = spawnPos.z + (Math.random() - 0.5) * 4;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const r     = ARENA_SIZE * 0.46 + Math.random() * 4;
      const px = _playerPos ? _playerPos.x : 0;
      const pz = _playerPos ? _playerPos.z : 0;
      sx = px + Math.cos(angle) * r;
      sz = pz + Math.sin(angle) * r;
    }
    const sy = (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight)
      ? VoxelWorld.getTerrainHeight(sx, sz) : 0;
    const mesh  = buildMesh(typeCfg);
    mesh.position.set(sx, sy, sz);
    scene.add(mesh);

    const waveHpBonus    = (1 + (wave - 1) * 0.22) * stageMult;
    const waveSpeedBonus = (1 + (wave - 1) * 0.06) * (1 + (stageMult - 1) * 0.3);
    const hp             = typeCfg.hpBase * waveHpBonus * rank.hpMult;

    // Determine squad role
    let squadRole = SQUAD_ROLE.RIFLEMAN;
    if (typeCfg.role === 'medic') squadRole = SQUAD_ROLE.MEDIC;
    else if (typeCfg.role === 'officer') squadRole = SQUAD_ROLE.OFFICER;

    const idx = enemies.length;
    enemies.push({
      mesh,
      hpBar:       buildHpBar(),
      typeCfg,
      typeName,
      rank,
      unit,
      hp,
      maxHp:       hp,
      speed:       typeCfg.speedBase * waveSpeedBonus * rank.spdMult,
      attackDmg:   typeCfg.attackDmg,
      attackTimer: Math.random() * typeCfg.attackRate,
      attackRate:  typeCfg.attackRate,
      scoreValue:  rank.score,
      dropChance:  typeCfg.dropChance,
      alive:       true,
      flashTimer:  0,
      legAngle:    0,
      legDir:      1,
      deathTimer:  0,
      // Assault group & detection
      groupId:     groupId !== undefined ? groupId : -1,
      squadRole:   squadRole,
      spotLevel:   0,           // 0=unaware, >=SPOT_TIME = spotted player
      playerSpotted: false,     // true = actively targeting player
      npcTarget:   null,        // reference to friendly NPC being targeted
      wounded:     false,       // wounded, needs medic
      retreating:  false,       // falling back
    });
    return idx;
  }

  // ── Spawn an assault group ─────────────────────────────────
  function spawnAssaultGroup(groupId, sc) {
    const angle = (groupId / NUM_ASSAULT_GROUPS) * Math.PI * 2 + Math.random() * 0.5;
    const dist = ARENA_SIZE * 0.44 + Math.random() * 6;
    const center = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

    const group = createAssaultGroup(groupId, center);

    // Compose group: 1 officer, 1 medic, 2-4 riflemen, 1 stormer(pointman)
    const officerIdx = spawnOne('OFFICER', groupId, center);
    group.members.push(officerIdx);
    group.hasOfficer = true;

    const medicIdx = spawnOne('MEDIC', groupId, center);
    group.members.push(medicIdx);
    group.hasMedic = true;

    // Pointman (stormer)
    const pointIdx = spawnOne('STORMER', groupId, center);
    enemies[pointIdx].squadRole = SQUAD_ROLE.POINTMAN;
    group.members.push(pointIdx);

    // Riflemen
    const rifleCt = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rifleCt; i++) {
      const typ = Math.random() < 0.3 ? 'ARMORED' : 'CONSCRIPT';
      const idx = spawnOne(typ, groupId, center);
      group.members.push(idx);
    }

    assaultGroups.push(group);
    return group;
  }

  // ── Initialise a wave ─────────────────────────────────────
  function startWave(w, sc, stageMultiplier) {
    wave      = w;
    scene     = sc;
    stageMult = stageMultiplier || 1;
    enemies   = [];
    allDead   = false;
    assaultGroups.length = 0;

    // Spawn 5 enemy assault groups (Russian army штурмовые группы)
    for (let g = 0; g < NUM_ASSAULT_GROUPS; g++) {
      spawnAssaultGroup(g, sc);
    }

    // Additional loose enemies spawn over time (stragglers, reinforcements)
    // Longer waves: 12 base + 5 per wave, slower spawn rate
    const baseExtra = 12 + (w - 1) * 5;
    const extraCount = Math.floor(baseExtra * (1 + (stageMult - 1) * 0.5));
    spawnQueue  = Array.from({ length: extraCount }, () => pickTypeForWave(w));
    spawnTimer  = 8 + Math.random() * 4; // delay before first reinforcement
  }

  // ── Per-frame update ──────────────────────────────────────
  function update(delta, playerPos, onPlayerHit, onEnemyDied) {
    // Cache player position for spawning
    _playerPos = playerPos;

    // Spawn from queue
    if (spawnQueue.length > 0) {
      spawnTimer -= delta;
      if (spawnTimer <= 0) {
        spawnOne(spawnQueue.pop());
        spawnTimer = 0.45 + Math.random() * 0.75;
      }
    }

    let alive = 0;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (!e.alive) {
        // Hide HP bar, sink corpse, then remove
        if (e.hpBar) e.hpBar.group.visible = false;
        e.deathTimer -= delta;
        e.mesh.position.y -= delta * 1.2;
        if (e.deathTimer <= 0) {
          scene.remove(e.mesh);
          if (e.hpBar) { scene.remove(e.hpBar.group); e.hpBar = null; }
          enemies.splice(i, 1);
        }
        continue;
      }

      alive++;

      // Reset hit-flash colour
      if (e.flashTimer > 0) {
        e.flashTimer -= delta;
        if (e.flashTimer <= 0) {
          e.mesh.userData.parts.forEach(p => {
            if (p.material && p.userData.origColor !== undefined) {
              p.material.color.setHex(p.userData.origColor);
            }
          });
        }
      }

      // Walk toward player with obstacle avoidance
      const dir = new THREE.Vector3()
        .subVectors(playerPos, e.mesh.position)
        .setY(0);
      const dist = dir.length();

      // Always follow terrain height (even when idle/attacking)
      if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight) {
        e.mesh.position.y = VoxelWorld.getTerrainHeight(e.mesh.position.x, e.mesh.position.z);
      }

      if (dist > 0.1) {
        dir.normalize();

        // Simple obstacle avoidance: check if path ahead is blocked
        const stepDist = e.speed * delta;
        const nextX = e.mesh.position.x + dir.x * stepDist * 2;
        const nextZ = e.mesh.position.z + dir.z * stepDist * 2;
        let blocked = false;
        if (typeof VoxelWorld !== 'undefined' && VoxelWorld.isSolid) {
          const nextH = VoxelWorld.getTerrainHeight(nextX, nextZ);
          const curH = e.mesh.position.y;
          // If terrain ahead is more than climbable height, try to go around
          if (nextH - curH > MAX_CLIMBABLE_HEIGHT) {
            blocked = true;
          }
          // Also check for walls at head height
          if (VoxelWorld.isSolid(nextX, curH + 1, nextZ)) {
            blocked = true;
          }
        }

        if (blocked) {
          // Steer sideways: try perpendicular directions
          if (!e._avoidDir) e._avoidDir = Math.random() > 0.5 ? 1 : -1;
          e._avoidTimer = (e._avoidTimer || 0) + delta;
          const sideDir = new THREE.Vector3(-dir.z * e._avoidDir, 0, dir.x * e._avoidDir);
          e.mesh.position.addScaledVector(sideDir, stepDist);
          // After 1.5s of avoiding, try the other direction
          if (e._avoidTimer > 1.5) {
            e._avoidDir *= -1;
            e._avoidTimer = 0;
          }
        } else {
          e._avoidTimer = 0;
          e.mesh.position.addScaledVector(dir, stepDist);
        }

        e.mesh.lookAt(playerPos.x, e.mesh.position.y, playerPos.z);

        // Leg swing animation (speed-scaled)
        e.legAngle += e.legDir * (e.speed / 2.2) * 4 * delta;
        if (Math.abs(e.legAngle) > 0.45) e.legDir *= -1;
        const parts = e.mesh.userData.parts;
        if (parts[3]) parts[3].rotation.x =  e.legAngle;
        if (parts[4]) parts[4].rotation.x = -e.legAngle;
      }

      // Melee attack when close enough
      const meleeRange = 1.6 * e.typeCfg.scale;
      if (dist < meleeRange) {
        e.attackTimer -= delta;
        if (e.attackTimer <= 0) {
          onPlayerHit(e.attackDmg);
          e.attackTimer = e.attackRate;
        }
      }

      // Update floating HP bar
      if (e.hpBar) {
        const pct    = e.hp / e.maxHp;
        e.hpBar.fg.scale.x     = pct;
        e.hpBar.fg.position.x  = -0.35 * (1 - pct);   // left-anchor the fill
        const hpColor = pct > 0.6 ? 0x44ff44 : pct > 0.3 ? 0xffaa00 : 0xff2222;
        e.hpBar.fg.material.color.setHex(hpColor);

        const barY = e.mesh.position.y + 1.75 * e.typeCfg.scale + 0.35;
        e.hpBar.group.position.set(e.mesh.position.x, barY, e.mesh.position.z);
        e.hpBar.group.lookAt(playerPos.x, barY, playerPos.z);
      }
    }

    // Wave complete?
    if (spawnQueue.length === 0 && alive === 0 && enemies.length === 0 && !allDead) {
      allDead = true;
      onEnemyDied(true);
    }
  }

  // ── Apply damage, return remaining HP ─────────────────────
  function damage(enemy, amount) {
    if (!enemy.alive) return 0;
    enemy.hp = Math.max(0, enemy.hp - amount);

      // White flash on hit — start timer; update() resets colors
    enemy.mesh.userData.parts.forEach(p => {
      if (p.material && p.material.visible !== false && !p.material.transparent) {
        // Cache original color on first hit
        if (p.userData.origColor === undefined) {
          p.userData.origColor = p.material.color.getHex();
        }
        p.material.color.setHex(0xffffff);
      }
    });
    enemy.flashTimer = 0.08;

    if (enemy.hp <= 0) {
      enemy.alive      = false;
      enemy.deathTimer = 0.6;
    }
    return enemy.hp;
  }

  // ── Find enemy by intersected mesh (walk hierarchy) ───────
  function findByMesh(mesh) {
    let obj = mesh;
    while (obj) {
      const found = enemies.find(e => e.mesh === obj);
      if (found) return found;
      obj = obj.parent;
    }
    return null;
  }

  function getEnemyMeshes() {
    return enemies.filter(e => e.alive).flatMap(e => e.mesh.userData.parts || [e.mesh]);
  }

  function getAliveCount() {
    return enemies.filter(e => e.alive).length + spawnQueue.length;
  }

  function isWaveDone() { return allDead; }

  function clear() {
    enemies.forEach(e => {
      if (scene) {
        scene.remove(e.mesh);
        if (e.hpBar) scene.remove(e.hpBar.group);
      }
    });
    enemies    = [];
    spawnQueue = [];
    allDead    = false;
  }

  // ── Area damage (explosions) ────────────────────────────────
  function damageInRadius(pos, radius, amount) {
    const results = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      const dist = e.mesh.position.distanceTo(pos);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius) * 0.5;
        const remaining = damage(e, amount * falloff);
        results.push({ enemy: e, remaining });
      }
    }
    return results;
  }

  // ── Get all alive enemies ─────────────────────────────────
  function getAll() { return enemies.filter(e => e.alive); }

  return {
    startWave,
    update,
    damage,
    damageInRadius,
    findByMesh,
    getEnemyMeshes,
    getAliveCount,
    isWaveDone,
    clear,
    getAll,
    RANKS,
    UNITS,
  };
})();
