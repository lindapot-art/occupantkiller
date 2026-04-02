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
  const bloodParticles = [];

  // ── Dispose helper — release Three.js GPU resources ────────
  function disposeMeshTree(obj) {
    if (!obj) return;
    obj.traverse(function (child) {
      if (child.geometry)  child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }

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
    SNIPER: {
      name:        'SNIPER',
      hpBase:      45,
      speedBase:   1.2,
      scale:       1.0,
      camoVariant: 'dark',
      bodyColor:   EMR_CAMO.dark,
      headColor:   0xb09070,
      limbColor:   0x1a2a0a,
      helmetColor: 0x1a2a1a,
      eyeColor:    0xff6600,
      attackDmg:   28,
      attackRate:  2.8,
      scoreValue:  400,
      dropChance:  0.55,
      role:        'sniper',
    },
    ENGINEER: {
      name:        'ENGINEER',
      hpBase:      65,
      speedBase:   1.6,
      scale:       1.05,
      camoVariant: 'light',
      bodyColor:   EMR_CAMO.medium,
      headColor:   0xc8a882,
      limbColor:   EMR_CAMO.dark,
      helmetColor: 0x3a4a3a,
      eyeColor:    0xffaa00,
      attackDmg:   10,
      attackRate:  1.4,
      scoreValue:  300,
      dropChance:  0.65,
      role:        'engineer',
    },
    DRONE_OP: {
      name:        'DRONE_OP',
      hpBase:      35,
      speedBase:   1.8,
      scale:       0.95,
      camoVariant: 'light',
      bodyColor:   EMR_CAMO.medium,
      headColor:   0xc8a882,
      limbColor:   EMR_CAMO.dark,
      helmetColor: 0x2a3a2a,
      eyeColor:    0x00ccff,
      attackDmg:   15,
      attackRate:  3.0,
      scoreValue:  350,
      dropChance:  0.45,
      role:        'drone_op',
    },
    FLAMETHROWER: {
      name:        'FLAMETHROWER',
      hpBase:      90,
      speedBase:   1.4,
      scale:       1.2,
      camoVariant: 'dark',
      bodyColor:   0x2a2a1a,
      headColor:   0xd0b090,
      limbColor:   0x1a2a0a,
      helmetColor: 0x1a1a10,
      eyeColor:    0xff4400,
      attackDmg:   18,
      attackRate:  0.8,
      scoreValue:  450,
      dropChance:  0.70,
      role:        'flamethrower',
    },
    SABOTEUR: {
      name:        'SABOTEUR',
      hpBase:      25,
      speedBase:   5.0,
      scale:       0.9,
      camoVariant: 'dark',
      bodyColor:   0x1a2a0a,
      headColor:   0xb09070,
      limbColor:   0x0a1a0a,
      helmetColor: 0x0a0a0a,
      eyeColor:    0xcc00ff,
      attackDmg:   20,
      attackRate:  0.5,
      scoreValue:  500,
      dropChance:  0.40,
      role:        'saboteur',
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
    // Late waves: introduce specialists and heavy units
    if (w >= 7 && r < 0.05) return 'SABOTEUR';
    if (w >= 7 && r < 0.08) return 'DRONE_OP';
    if (w >= 6 && r < 0.12) return 'SNIPER';
    if (w >= 6 && r < 0.16) return 'FLAMETHROWER';
    if (w >= 5 && r < 0.18) return 'ENGINEER';
    if (w >= 5 && r < 0.30) return 'ARMORED';
    if (w >= 3 && r < 0.50) return 'STORMER';
    if (w >= 2 && r < 0.10) return 'ENGINEER';
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
    // Include ALL mesh parts so raycaster can detect hits on vest, boots, equipment
    group.userData.parts    = [torso, head, helmet, legL, legR, armL, armR, hitbox,
                               vest, canteen, radio, belt, eyeL, eyeR];
    // Add boots and knee pads from the group's children
    group.children.forEach(function (child) {
      if (group.userData.parts.indexOf(child) < 0) {
        group.userData.parts.push(child);
      }
    });
    group.userData.faction  = 'occupant';

    return group;
  }

  // ── Rank-based weapon visual for enemy mesh ───────────────
  // Adds a weapon mesh to the right arm based on enemy rank/type
  const ENEMY_WEAPON_VISUALS = {
    CONSCRIPT:  { len: 0.22, color: 0x3a3a28, name: 'AK-74' },
    STORMER:    { len: 0.16, color: 0x2a2a2a, name: 'PP-19 Vityaz' },
    ARMORED:    { len: 0.30, color: 0x2a2a1a, name: 'PKP Pecheneg' },
    MEDIC:      { len: 0.12, color: 0x333333, name: 'Makarov PM' },
    OFFICER:    { len: 0.24, color: 0x2a2a2a, name: 'AK-12' },
    SNIPER:     { len: 0.35, color: 0x3a3a2a, name: 'SV-98' },
    ENGINEER:   { len: 0.20, color: 0x3a3a28, name: 'AKS-74U' },
    DRONE_OP:   { len: 0.14, color: 0x2a2a2a, name: 'Makarov PM' },
  };

  function attachWeaponVisual(mesh, typeCfg) {
    const wInfo = ENEMY_WEAPON_VISUALS[typeCfg.name];
    if (!wInfo) return;
    const s = typeCfg.scale;
    // Weapon barrel attached to right arm area
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04 * s, 0.04 * s, wInfo.len * s),
      new THREE.MeshLambertMaterial({ color: wInfo.color })
    );
    barrel.position.set(0.35 * s, 0.70 * s, 0.18 * s);
    mesh.add(barrel);
    // Weapon body (receiver)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.05 * s, 0.05 * s, 0.10 * s),
      new THREE.MeshLambertMaterial({ color: wInfo.color })
    );
    body.position.set(0.35 * s, 0.72 * s, 0.06 * s);
    mesh.add(body);
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
    // Attach rank-based weapon visual to enemy mesh
    attachWeaponVisual(mesh, typeCfg);
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
      surrendered: false,
      _surrenderClaimed: false,
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

    // Update blood voxel particles
    for (var bp = bloodParticles.length - 1; bp >= 0; bp--) {
      var blood = bloodParticles[bp];
      blood.velocity.y -= blood.gravity * delta;
      blood.mesh.position.addScaledVector(blood.velocity, delta);
      blood.mesh.rotation.x += delta * 3;
      blood.mesh.rotation.z += delta * 2;
      blood.life -= delta;
      // Fade out in last 0.5s
      if (blood.life < 0.5) {
        blood.mesh.material.opacity = blood.life / 0.5;
        blood.mesh.material.transparent = true;
      }
      // Ground collision
      if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight) {
        var groundY = VoxelWorld.getTerrainHeight(blood.mesh.position.x, blood.mesh.position.z);
        if (blood.mesh.position.y <= groundY + 0.05) {
          blood.mesh.position.y = groundY + 0.05;
          blood.velocity.set(0, 0, 0);
          blood.gravity = 0;
        }
      }
      if (blood.life <= 0) {
        if (scene) scene.remove(blood.mesh);
        bloodParticles.splice(bp, 1);
      }
    }

    // Spawn reinforcements from queue (slow drip every 3-6s)
    if (spawnQueue.length > 0) {
      spawnTimer -= delta;
      if (spawnTimer <= 0) {
        spawnOne(spawnQueue.pop());
        spawnTimer = 3.0 + Math.random() * 3.0;
      }
    }

    // Update assault groups
    updateAssaultGroups(delta, playerPos);

    // Get friendly NPCs for NPC-vs-NPC combat
    const friendlyNPCs = (typeof NPCSystem !== 'undefined' && NPCSystem.getAll)
      ? NPCSystem.getAll() : [];

    let alive = 0;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (!e.alive) {
        // Hide HP bar, sink corpse, then remove
        if (e.hpBar) e.hpBar.group.visible = false;
        e.deathTimer -= delta;
        e.mesh.position.y -= delta * 1.2;
        if (e.deathTimer <= 0) {
          disposeMeshTree(e.mesh);
          scene.remove(e.mesh);
          if (e.hpBar) {
            disposeMeshTree(e.hpBar.group);
            scene.remove(e.hpBar.group);
            e.hpBar = null;
          }
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

      // Always follow terrain height
      if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight) {
        e.mesh.position.y = VoxelWorld.getTerrainHeight(e.mesh.position.x, e.mesh.position.z);
      }

      // ── Detection system: enemies must spot the player ──
      const dirToPlayer = new THREE.Vector3()
        .subVectors(playerPos, e.mesh.position).setY(0);
      const distToPlayer = dirToPlayer.length();

      // Medic behavior: heal wounded groupmates instead of fighting
      if (e.squadRole === SQUAD_ROLE.MEDIC && !e.playerSpotted) {
        const healed = updateMedicBehavior(e, delta);
        if (healed) {
          updateHpBar(e, playerPos);
          continue;
        }
      }

      // Determine primary target: NPC or player
      let moveTarget = null;
      let targetIsNPC = false;
      let targetDist = Infinity;

      // Find nearest friendly NPC to attack
      let nearestNPC = null;
      let nearestNPCDist = Infinity;
      for (const npc of friendlyNPCs) {
        if (!npc.alive) continue;
        const d = e.mesh.position.distanceTo(npc.position);
        if (d < nearestNPCDist) {
          nearestNPCDist = d;
          nearestNPC = npc;
        }
      }

      // Player detection: only spot if not stealthed and within detection range/angle
      if (!_playerStealth && distToPlayer < DETECTION_RANGE) {
        // Check if player is roughly in front of enemy (FOV cone)
        const facingDir = new THREE.Vector3(0, 0, -1).applyQuaternion(e.mesh.quaternion);
        const angleToPlayer = facingDir.angleTo(dirToPlayer.clone().normalize());
        if (angleToPlayer < DETECTION_ANGLE || distToPlayer < 4) {
          e.spotLevel = Math.min(SPOT_TIME + 0.5, e.spotLevel + delta);
        } else {
          e.spotLevel = Math.max(0, e.spotLevel - delta * 0.3);
        }
      } else {
        e.spotLevel = Math.max(0, e.spotLevel - delta * 0.5);
      }
      e.playerSpotted = e.spotLevel >= SPOT_TIME;

      // If player shot this enemy, immediately spot them
      if (e.flashTimer > 0.07) {
        e.spotLevel = SPOT_TIME + 0.5;
        e.playerSpotted = true;
      }

      // Choose target priority: nearest NPC within 20, or spotted player
      if (nearestNPC && nearestNPCDist < 20) {
        moveTarget = nearestNPC.position;
        targetIsNPC = true;
        targetDist = nearestNPCDist;
        e.npcTarget = nearestNPC;
      }
      if (e.playerSpotted && distToPlayer < nearestNPCDist * 0.8) {
        moveTarget = playerPos;
        targetIsNPC = false;
        targetDist = distToPlayer;
        e.npcTarget = null;
      }

      // If no target, follow group objective or patrol
      if (!moveTarget && e.groupId >= 0 && e.groupId < assaultGroups.length) {
        const grp = assaultGroups[e.groupId];
        if (grp) {
          moveTarget = grp.state === GROUP_STATE.RETREATING ? grp.rallyPoint : grp.objective;
          targetDist = e.mesh.position.distanceTo(moveTarget);
        }
      }
      if (!moveTarget) {
        // Tactical patrol: enemies patrol toward strategic objectives instead of wandering
        if (!e._wanderTarget || e.mesh.position.distanceTo(e._wanderTarget) < 2) {
          // Prioritize patrolling toward friendly positions, buildings, or roads
          var strategicTarget = null;
          // Try to target friendly NPCs in area
          if (typeof NPCSystem !== 'undefined' && NPCSystem.getAll) {
            var friendlies = NPCSystem.getAll();
            if (friendlies.length > 0) {
              var picked = friendlies[Math.floor(Math.random() * friendlies.length)];
              if (picked.alive) strategicTarget = picked.position.clone();
            }
          }
          // Try road waypoints for flanking maneuvers
          if (!strategicTarget && typeof VoxelWorld !== 'undefined' && VoxelWorld.getRoadWaypoints) {
            var roadWPs = VoxelWorld.getRoadWaypoints();
            if (roadWPs.length > 0) {
              strategicTarget = roadWPs[Math.floor(Math.random() * roadWPs.length)].clone();
            }
          }
          // Fallback to directed patrol toward center with spread
          if (!strategicTarget) {
            var wa = Math.random() * Math.PI * 2;
            var wd = 6 + Math.random() * 10;
            strategicTarget = new THREE.Vector3(
              Math.cos(wa) * wd, 0,
              Math.sin(wa) * wd
            );
          }
          e._wanderTarget = strategicTarget;
        }
        moveTarget = e._wanderTarget;
        targetDist = e.mesh.position.distanceTo(moveTarget);
      }

      // ── Movement toward target with obstacle avoidance + strategic flanking ──
      if (moveTarget && targetDist > 1.0) {
        const dir = new THREE.Vector3().subVectors(moveTarget, e.mesh.position).setY(0).normalize();

        // ── Strategic flanking: stormers and officers approach from the side ──
        if (e.playerSpotted && !targetIsNPC && targetDist > 6 && targetDist < 25) {
          const typeName = e.typeCfg.name;
          if (typeName === 'STORMER' || typeName === 'OFFICER') {
            // Flank: perpendicular offset based on enemy ID (alternating L/R)
            const flankSign = (e.id % 2 === 0) ? 1 : -1;
            const flankStrength = Math.min(1, (targetDist - 6) / 10) * 0.7;
            const perp = new THREE.Vector3(-dir.z * flankSign, 0, dir.x * flankSign);
            dir.addScaledVector(perp, flankStrength).normalize();
          } else if (typeName === 'SNIPER') {
            // Snipers maintain distance: slow approach, prefer to hold at range
            if (targetDist < 12) {
              const retreatStrength = (12 - targetDist) / 12 * 0.6;
              dir.multiplyScalar(-retreatStrength).normalize();
            }
          }
        }

        const stepDist = e.speed * delta;
        const nextX = e.mesh.position.x + dir.x * stepDist * 2;
        const nextZ = e.mesh.position.z + dir.z * stepDist * 2;
        let blocked = false;
        if (typeof VoxelWorld !== 'undefined' && VoxelWorld.isSolid) {
          const nextH = VoxelWorld.getTerrainHeight(nextX, nextZ);
          const curH = e.mesh.position.y;
          if (nextH - curH > MAX_CLIMBABLE_HEIGHT) blocked = true;
          if (VoxelWorld.isSolid(nextX, curH + 1, nextZ)) blocked = true;
        }

        if (blocked) {
          if (!e._avoidDir) e._avoidDir = Math.random() > 0.5 ? 1 : -1;
          e._avoidTimer = (e._avoidTimer || 0) + delta;
          const sideDir = new THREE.Vector3(-dir.z * e._avoidDir, 0, dir.x * e._avoidDir);
          e.mesh.position.addScaledVector(sideDir, stepDist);
          if (e._avoidTimer > 1.5) { e._avoidDir *= -1; e._avoidTimer = 0; }
        } else {
          e._avoidTimer = 0;
          e.mesh.position.addScaledVector(dir, stepDist);
        }

        // Face toward target
        e.mesh.lookAt(moveTarget.x, e.mesh.position.y, moveTarget.z);

        // Leg swing animation
        e.legAngle += e.legDir * (e.speed / 2.2) * 4 * delta;
        if (Math.abs(e.legAngle) > 0.45) e.legDir *= -1;
        const parts = e.mesh.userData.parts;
        if (parts[3]) parts[3].rotation.x =  e.legAngle;
        if (parts[4]) parts[4].rotation.x = -e.legAngle;
      }

      // ── Surrender system: low-HP enemies may surrender ──
      if (!e.surrendered && e.hp < e.maxHp * 0.15 && e.hp > 0) {
        // 2% chance per frame to surrender when below 15% HP
        // ~20% chance per second to surrender (0.2 * delta)
        if (Math.random() < 0.2 * delta) {
          e.surrendered = true;
          e.speed = 0;
          // Raise arms visual: tilt mesh
          e.mesh.rotation.x = -0.3;
          // White flag: change helmet to white
          e.mesh.traverse(function(child) {
            if (child.material && child.userData && child.userData.isHelmet) {
              child.material.color.setHex(0xffffff);
            }
          });
        }
      }
      // Surrendered enemies don't attack — give bonus score if player walks close
      if (e.surrendered) {
        e.attackTimer = 999;
        if (playerPos) {
          const surrenderDist = e.mesh.position.distanceTo(playerPos);
          if (surrenderDist < 3 && !e._surrenderClaimed) {
            e._surrenderClaimed = true;
            e.scoreValue += 200; // Bonus for POW capture
          }
        }
        continue;
      }

      // ── Combat: melee attack on player if spotted and close ──
      if (e.playerSpotted && !targetIsNPC) {
        const meleeRange = 1.6 * e.typeCfg.scale;
        if (distToPlayer < meleeRange) {
          e.attackTimer -= delta;
          if (e.attackTimer <= 0) {
            onPlayerHit(e.attackDmg, e.mesh.position);
            e.attackTimer = e.attackRate;
          }
        }
      }

      // ── Combat: attack friendly NPCs ──
      if (targetIsNPC && e.npcTarget && e.npcTarget.alive) {
        const npcDist = e.mesh.position.distanceTo(e.npcTarget.position);
        const attackRange = 2.0 * e.typeCfg.scale;
        if (npcDist < attackRange) {
          e.attackTimer -= delta;
          if (e.attackTimer <= 0) {
            e.attackTimer = e.attackRate;
            if (typeof NPCSystem !== 'undefined' && NPCSystem.damage) {
              NPCSystem.damage(e.npcTarget.id, e.attackDmg);
            }
          }
        }
      }

      // ── Anti-drone combat: enemies shoot at nearby drones ──
      if (typeof DroneSystem !== 'undefined' && DroneSystem.getAll) {
        var drones = DroneSystem.getAll();
        for (var di = 0; di < drones.length; di++) {
          var drone = drones[di];
          if (!drone.alive || !drone.active) continue;
          var droneDist = e.mesh.position.distanceTo(drone.position);
          // Enemies shoot at drones within 18 range, DRONE_OP type has 30 range
          var droneEngageRange = e.typeCfg.name === 'DRONE_OP' ? 30 : 18;
          if (droneDist < droneEngageRange) {
            if (!e._droneFireTimer) e._droneFireTimer = 0;
            e._droneFireTimer -= delta;
            if (e._droneFireTimer <= 0) {
              // Accuracy depends on distance and enemy type
              var droneHitChance = e.typeCfg.name === 'DRONE_OP' ? 0.35 :
                                   e.typeCfg.name === 'SNIPER' ? 0.25 : 0.12;
              if (Math.random() < droneHitChance) {
                DroneSystem.damageDrone(drone.id, e.attackDmg * 0.6);
              }
              e._droneFireTimer = e.attackRate * 1.5;
            }
            break; // Only target one drone at a time
          }
        }
      }

      // Update floating HP bar
      updateHpBar(e, playerPos);
    }

    // Wave complete?
    if (spawnQueue.length === 0 && alive === 0 && enemies.length === 0 && !allDead) {
      allDead = true;
      onEnemyDied(true);
    }
  }

  // ── Update HP bar helper ──────────────────────────────────
  function updateHpBar(e, playerPos) {
    if (e.hpBar) {
      const pct    = e.hp / e.maxHp;
      e.hpBar.fg.scale.x     = pct;
      e.hpBar.fg.position.x  = -0.35 * (1 - pct);
      const hpColor = pct > 0.6 ? 0x44ff44 : pct > 0.3 ? 0xffaa00 : 0xff2222;
      e.hpBar.fg.material.color.setHex(hpColor);

      const barY = e.mesh.position.y + 1.75 * e.typeCfg.scale + 0.35;
      e.hpBar.group.position.set(e.mesh.position.x, barY, e.mesh.position.z);
      e.hpBar.group.lookAt(playerPos.x, barY, playerPos.z);
    }
  }

  // ── Medic behavior: heal nearest wounded groupmate ────────
  function updateMedicBehavior(medic, delta) {
    if (medic.groupId < 0) return false;
    // Find wounded groupmate (hp < 60% of max)
    let wounded = null;
    let wDist = Infinity;
    for (const e of enemies) {
      if (!e.alive || e === medic || e.groupId !== medic.groupId) continue;
      if (e.hp < e.maxHp * 0.6) {
        const d = medic.mesh.position.distanceTo(e.mesh.position);
        if (d < wDist) { wDist = d; wounded = e; }
      }
    }
    if (!wounded) return false;

    // Move toward wounded
    if (wDist > 1.5) {
      const dir = new THREE.Vector3().subVectors(wounded.mesh.position, medic.mesh.position).setY(0).normalize();
      medic.mesh.position.addScaledVector(dir, medic.speed * 1.2 * delta);
      medic.mesh.lookAt(wounded.mesh.position.x, medic.mesh.position.y, wounded.mesh.position.z);
    } else {
      // Heal
      wounded.hp = Math.min(wounded.maxHp, wounded.hp + 8 * delta);
      wounded.wounded = wounded.hp < wounded.maxHp * 0.4;
    }
    return true;
  }

  // ── Assault Group AI ──────────────────────────────────────
  function updateAssaultGroups(delta, playerPos) {
    for (const grp of assaultGroups) {
      // Count alive members
      const aliveMembers = grp.members.filter(idx => enemies[idx] && enemies[idx].alive);
      if (aliveMembers.length === 0) continue;

      grp.stateTimer -= delta;

      // Calculate group center
      let cx = 0, cz = 0;
      for (const idx of aliveMembers) {
        cx += enemies[idx].mesh.position.x;
        cz += enemies[idx].mesh.position.z;
      }
      cx /= aliveMembers.length;
      cz /= aliveMembers.length;

      // Morale drop on losses
      const lossRatio = 1 - aliveMembers.length / grp.members.length;
      grp.morale = Math.max(10, grp.morale - lossRatio * delta * 5);

      // State machine
      switch (grp.state) {
        case GROUP_STATE.FORMING:
          if (grp.stateTimer <= 0) {
            grp.state = GROUP_STATE.ADVANCING;
            grp.stateTimer = 15 + Math.random() * 20;
          }
          break;

        case GROUP_STATE.ADVANCING:
          // Move toward objective
          if (grp.stateTimer <= 0 || lossRatio > 0.3) {
            grp.state = lossRatio > 0.5 ? GROUP_STATE.RETREATING : GROUP_STATE.ASSAULTING;
            grp.stateTimer = 20 + Math.random() * 30;
          }
          // Set objective on terrain
          if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight) {
            grp.objective.y = VoxelWorld.getTerrainHeight(grp.objective.x, grp.objective.z);
          }
          break;

        case GROUP_STATE.ASSAULTING:
          // Pick new objective near friendly NPCs
          if (typeof NPCSystem !== 'undefined' && NPCSystem.getAll) {
            const friendlies = NPCSystem.getAll();
            if (friendlies.length > 0) {
              const target = friendlies[Math.floor(Math.random() * friendlies.length)];
              grp.objective.copy(target.position);
            }
          }
          if (grp.stateTimer <= 0) {
            grp.state = grp.morale < 40 ? GROUP_STATE.RETREATING : GROUP_STATE.REGROUPING;
            grp.stateTimer = 10 + Math.random() * 15;
          }
          break;

        case GROUP_STATE.RETREATING:
          // Check for wounded — trigger evac
          const hasWounded = aliveMembers.some(idx => enemies[idx].hp < enemies[idx].maxHp * 0.3);
          if (hasWounded && grp.hasMedic) {
            grp.state = GROUP_STATE.EVAC;
            grp.stateTimer = 8 + Math.random() * 10;
          } else if (grp.stateTimer <= 0) {
            grp.state = GROUP_STATE.REGROUPING;
            grp.stateTimer = 8 + Math.random() * 12;
            // Pick new rally point further from center
            const rAngle = Math.random() * Math.PI * 2;
            const rDist = ARENA_SIZE * 0.3 + Math.random() * 8;
            grp.rallyPoint.set(Math.cos(rAngle) * rDist, 0, Math.sin(rAngle) * rDist);
          }
          break;

        case GROUP_STATE.EVAC:
          if (grp.stateTimer <= 0) {
            // Heal wounded members slightly during evac
            for (const idx of aliveMembers) {
              if (enemies[idx].hp < enemies[idx].maxHp * 0.5) {
                enemies[idx].hp = Math.min(enemies[idx].maxHp, enemies[idx].hp + enemies[idx].maxHp * 0.2);
                enemies[idx].wounded = false;
              }
            }
            grp.state = GROUP_STATE.REGROUPING;
            grp.stateTimer = 5 + Math.random() * 8;
          }
          break;

        case GROUP_STATE.REGROUPING:
          if (grp.stateTimer <= 0) {
            // Pick new objective and re-advance
            const oAngle = Math.random() * Math.PI * 2;
            const oDist = 6 + Math.random() * 14;
            grp.objective.set(Math.cos(oAngle) * oDist, 0, Math.sin(oAngle) * oDist);
            grp.morale = Math.min(100, grp.morale + 15);
            grp.state = GROUP_STATE.ADVANCING;
            grp.stateTimer = 15 + Math.random() * 20;
          }
          break;
      }
    }
  }

  // ── Set player stealth state ──────────────────────────────
  function setPlayerStealth(val) { _playerStealth = !!val; }

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

    // Spawn blood voxel particles
    if (scene) {
      var bloodCount = Math.min(8, Math.ceil(amount / 10));
      for (var b = 0; b < bloodCount; b++) {
        var bloodSize = 0.08 + Math.random() * 0.12;
        var bloodMesh = new THREE.Mesh(
          new THREE.BoxGeometry(bloodSize, bloodSize, bloodSize),
          new THREE.MeshLambertMaterial({ color: Math.random() < 0.5 ? 0xaa0000 : 0x880000 })
        );
        bloodMesh.position.copy(enemy.mesh.position);
        bloodMesh.position.y += 0.5 + Math.random() * 1.0;
        scene.add(bloodMesh);
        bloodParticles.push({
          mesh: bloodMesh,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            1.5 + Math.random() * 3,
            (Math.random() - 0.5) * 4
          ),
          life: 1.5 + Math.random() * 1.0,
          gravity: 12,
        });
      }
    }

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
    // Clean up blood particles
    bloodParticles.forEach(bp => {
      if (scene) scene.remove(bp.mesh);
    });
    bloodParticles.length = 0;

    enemies.forEach(e => {
      if (scene) {
        disposeMeshTree(e.mesh);
        scene.remove(e.mesh);
        if (e.hpBar) {
          disposeMeshTree(e.hpBar.group);
          scene.remove(e.hpBar.group);
        }
      }
    });
    enemies    = [];
    spawnQueue = [];
    allDead    = false;
    assaultGroups.length = 0;
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

  // ── Get assault groups info ───────────────────────────────
  function getAssaultGroups() { return assaultGroups; }

  function getSurrenderCount() {
    return enemies.filter(e => e.alive && e.surrendered).length;
  }

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
    getAssaultGroups,
    setPlayerStealth,
    getSurrenderCount,
    spawnSingle: function (typeName, pos) { spawnOne(typeName, -1, pos); },
    RANKS,
    UNITS,
  };
})();
