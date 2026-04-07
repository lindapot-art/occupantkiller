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
  // Shared blood particle resources (pool geometry + 2 materials)
  var _bloodGeo = new THREE.BoxGeometry(1, 1, 1);
  var _bloodMatDark = new THREE.MeshLambertMaterial({ color: 0x880000 });
  var _bloodMatLight = new THREE.MeshLambertMaterial({ color: 0xaa0000 });

  // ── Floating damage numbers ────────────────────────────────
  const _dmgNumbers = [];

  // ── Alert icon shared texture ("!" above enemy) ───────────
  let _alertTexture = null;
  function getAlertTexture() {
    if (_alertTexture) return _alertTexture;
    var c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = '#ff3300';
    ctx.beginPath(); ctx.arc(16, 16, 15, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('!', 16, 16);
    _alertTexture = new THREE.CanvasTexture(c);
    return _alertTexture;
  }
  function buildAlertIcon() {
    var mat = new THREE.SpriteMaterial({ map: getAlertTexture(), depthTest: false, transparent: true });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.45, 0.45, 1);
    sprite.visible = false;
    return sprite;
  }

  function spawnDmgNumber(pos, amount, isHeadshot) {
    if (!scene) return;
    var canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 32;
    var ctx = canvas.getContext('2d');
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = isHeadshot ? '#ff4444' : '#ffcc00';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    var txt = Math.round(amount).toString();
    ctx.strokeText(txt, 4, 24);
    ctx.fillText(txt, 4, 24);
    var tex = new THREE.CanvasTexture(canvas);
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.2, 0.6, 1);
    sprite.position.copy(pos);
    sprite.position.y += 1.5 + Math.random() * 0.5;
    sprite.position.x += (Math.random() - 0.5) * 0.4;
    scene.add(sprite);
    _dmgNumbers.push({ sprite: sprite, life: 0.8, vy: 2.5 });
  }
  function updateDmgNumbers(delta) {
    for (var i = _dmgNumbers.length - 1; i >= 0; i--) {
      var d = _dmgNumbers[i];
      d.sprite.position.y += d.vy * delta;
      d.life -= delta;
      d.sprite.material.opacity = Math.max(0, d.life / 0.8);
      if (d.life <= 0) {
        scene.remove(d.sprite);
        d.sprite.material.map.dispose();
        d.sprite.material.dispose();
        _dmgNumbers.splice(i, 1);
      }
    }
  }

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
      range: 15, rangedDmg: 5, rangedRate: 1.5, accuracy: 0.3,
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
      range: 10, rangedDmg: 4, rangedRate: 0.8, accuracy: 0.2,
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
      range: 12, rangedDmg: 8, rangedRate: 2.0, accuracy: 0.4,
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
      range: 0, rangedDmg: 0, rangedRate: 0, accuracy: 0,
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
      range: 20, rangedDmg: 10, rangedRate: 1.2, accuracy: 0.5,
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
      range: 40, rangedDmg: 25, rangedRate: 3.0, accuracy: 0.7,
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
      range: 8, rangedDmg: 6, rangedRate: 1.0, accuracy: 0.25,
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
      range: 18, rangedDmg: 7, rangedRate: 1.4, accuracy: 0.35,
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
      range: 8, rangedDmg: 12, rangedRate: 0.5, accuracy: 0.6,
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
      range: 12, rangedDmg: 15, rangedRate: 0.8, accuracy: 0.45,
    },
    // ── Advanced types from EnemyTypes ──────────────────────
    BOSS: {
      name: 'BOSS', hpBase: 500, speedBase: 1.5, scale: 1.6,
      camoVariant: 'dark', bodyColor: 0x990000, headColor: 0xd0b090,
      limbColor: 0x1a1a0a, helmetColor: 0x1a0a0a, eyeColor: 0xff0000,
      attackDmg: 45, attackRate: 1.8, scoreValue: 2000, dropChance: 1.0,
      role: 'boss', range: 8, rangedDmg: 20, rangedRate: 2.0, accuracy: 0.5,
    },
    BOMBER: {
      name: 'BOMBER', hpBase: 30, speedBase: 6.0, scale: 1.0,
      camoVariant: 'dark', bodyColor: 0xff4400, headColor: 0xb09070,
      limbColor: 0x2a1a0a, helmetColor: 0x2a2a1a, eyeColor: 0xff8800,
      attackDmg: 0, attackRate: 999, scoreValue: 350, dropChance: 0.0,
      role: 'bomber', range: 0, rangedDmg: 0, rangedRate: 0, accuracy: 0,
    },
    WAR_DOG: {
      name: 'WAR_DOG', hpBase: 25, speedBase: 9.0, scale: 0.6,
      camoVariant: 'dark', bodyColor: 0x554433, headColor: 0x554433,
      limbColor: 0x443322, helmetColor: 0x554433, eyeColor: 0xffcc00,
      attackDmg: 25, attackRate: 0.8, scoreValue: 200, dropChance: 0.0,
      role: 'war_dog', range: 0, rangedDmg: 0, rangedRate: 0, accuracy: 0,
    },
    SHIELD_BEARER: {
      name: 'SHIELD_BEARER', hpBase: 120, speedBase: 2.0, scale: 1.2,
      camoVariant: 'dark', bodyColor: 0x333333, headColor: 0xd0b090,
      limbColor: 0x222222, helmetColor: 0x1a1a1a, eyeColor: 0xff2200,
      attackDmg: 18, attackRate: 1.2, scoreValue: 500, dropChance: 0.55,
      role: 'shield', range: 0, rangedDmg: 0, rangedRate: 0, accuracy: 0,
    },
    MORTAR: {
      name: 'MORTAR', hpBase: 70, speedBase: 1.0, scale: 1.1,
      camoVariant: 'dark', bodyColor: 0x666633, headColor: 0xd0b090,
      limbColor: 0x444422, helmetColor: 0x333322, eyeColor: 0xcc6600,
      attackDmg: 0, attackRate: 999, scoreValue: 750, dropChance: 0.65,
      role: 'mortar', range: 40, rangedDmg: 0, rangedRate: 0, accuracy: 0,
    },
    SNIPER_ELITE: {
      name: 'SNIPER_ELITE', hpBase: 60, speedBase: 1.0, scale: 1.0,
      camoVariant: 'dark', bodyColor: 0x445544, headColor: 0xb09070,
      limbColor: 0x1a2a0a, helmetColor: 0x1a2a1a, eyeColor: 0xff0000,
      attackDmg: 70, attackRate: 2.0, scoreValue: 800, dropChance: 0.60,
      role: 'sniper_elite', range: 50, rangedDmg: 70, rangedRate: 3.0, accuracy: 0.7,
    },
    // ── Advanced types (referenced by pickTypeForWave) ──────
    PARATROOP: {
      name: 'PARATROOP', hpBase: 75, speedBase: 4.5, scale: 1.0,
      camoVariant: 'dark', bodyColor: 0x4466aa, headColor: 0xb09070,
      limbColor: 0x334488, helmetColor: 0x3366aa, eyeColor: 0xffcc00,
      attackDmg: 28, attackRate: 1.0, scoreValue: 450, dropChance: 0.45,
      role: 'paratroop', range: 12, rangedDmg: 20, rangedRate: 1.2, accuracy: 0.45,
    },
    TANK: {
      name: 'TANK', hpBase: 1500, speedBase: 1.2, scale: 2.5,
      camoVariant: 'dark', bodyColor: 0x445533, headColor: 0x445533,
      limbColor: 0x445533, helmetColor: 0x445533, eyeColor: 0xff0000,
      attackDmg: 200, attackRate: 4.0, scoreValue: 2000, dropChance: 1.0,
      role: 'tank', range: 35, rangedDmg: 200, rangedRate: 4.0, accuracy: 0.6,
    },
    SPETSNAZ: {
      name: 'SPETSNAZ', hpBase: 130, speedBase: 5.0, scale: 1.05,
      camoVariant: 'dark', bodyColor: 0x1a1a1a, headColor: 0xb09070,
      limbColor: 0x111111, helmetColor: 0x0a0a0a, eyeColor: 0xff2200,
      attackDmg: 35, attackRate: 0.8, scoreValue: 700, dropChance: 0.65,
      role: 'spetsnaz', range: 15, rangedDmg: 30, rangedRate: 1.0, accuracy: 0.6,
    },
    KADYROVITE: {
      name: 'KADYROVITE', hpBase: 95, speedBase: 3.0, scale: 1.1,
      camoVariant: 'dark', bodyColor: 0x334411, headColor: 0xb09070,
      limbColor: 0x223300, helmetColor: 0x2a2a1a, eyeColor: 0xff4400,
      attackDmg: 22, attackRate: 1.0, scoreValue: 400, dropChance: 0.50,
      role: 'kadyrovite', range: 10, rangedDmg: 18, rangedRate: 1.2, accuracy: 0.4,
    },
    WAGNER: {
      name: 'WAGNER', hpBase: 40, speedBase: 5.5, scale: 1.0,
      camoVariant: 'dark', bodyColor: 0x554433, headColor: 0xb09070,
      limbColor: 0x443322, helmetColor: 0x333322, eyeColor: 0xff6600,
      attackDmg: 18, attackRate: 0.6, scoreValue: 200, dropChance: 0.25,
      role: 'wagner', range: 3, rangedDmg: 0, rangedRate: 0, accuracy: 0,
    },
    BTR: {
      name: 'BTR', hpBase: 600, speedBase: 2.5, scale: 2.0,
      camoVariant: 'dark', bodyColor: 0x445544, headColor: 0x445544,
      limbColor: 0x445544, helmetColor: 0x445544, eyeColor: 0xff4400,
      attackDmg: 30, attackRate: 0.2, scoreValue: 1200, dropChance: 0.90,
      role: 'btr', range: 20, rangedDmg: 30, rangedRate: 0.2, accuracy: 0.5,
    },
    KAMIKAZE_DRONE: {
      name: 'KAMIKAZE_DRONE', hpBase: 20, speedBase: 8.0, scale: 0.5,
      camoVariant: 'dark', bodyColor: 0x666666, headColor: 0x666666,
      limbColor: 0x666666, helmetColor: 0x666666, eyeColor: 0xff0000,
      attackDmg: 120, attackRate: 999, scoreValue: 300, dropChance: 0.0,
      role: 'kamikaze_drone', range: 0, rangedDmg: 0, rangedRate: 0, accuracy: 0,
    },
    HEAVY_SNIPER: {
      name: 'HEAVY_SNIPER', hpBase: 90, speedBase: 0.8, scale: 1.1,
      camoVariant: 'dark', bodyColor: 0x2a3a2a, headColor: 0xb09070,
      limbColor: 0x1a2a0a, helmetColor: 0x1a2a1a, eyeColor: 0x00ff00,
      attackDmg: 120, attackRate: 3.0, scoreValue: 900, dropChance: 0.65,
      role: 'heavy_sniper', range: 60, rangedDmg: 120, rangedRate: 3.0, accuracy: 0.75,
    },
    COMMISSAR: {
      name: 'COMMISSAR', hpBase: 100, speedBase: 1.5, scale: 1.2,
      camoVariant: 'dark', bodyColor: 0x880000, headColor: 0xd0b090,
      limbColor: 0x660000, helmetColor: 0x440000, eyeColor: 0xff0000,
      attackDmg: 20, attackRate: 1.0, scoreValue: 850, dropChance: 0.70,
      role: 'commissar', range: 10, rangedDmg: 15, rangedRate: 1.2, accuracy: 0.4,
    },
    THERMOBARIC: {
      name: 'THERMOBARIC', hpBase: 80, speedBase: 1.2, scale: 1.15,
      camoVariant: 'dark', bodyColor: 0xff3300, headColor: 0xd0b090,
      limbColor: 0xcc2200, helmetColor: 0x992200, eyeColor: 0xff8800,
      attackDmg: 200, attackRate: 8.0, scoreValue: 1000, dropChance: 0.75,
      role: 'thermobaric', range: 35, rangedDmg: 200, rangedRate: 8.0, accuracy: 0.5,
    },
    EW_OPERATOR: {
      name: 'EW_OPERATOR', hpBase: 60, speedBase: 2.0, scale: 1.0,
      camoVariant: 'dark', bodyColor: 0x4488aa, headColor: 0xb09070,
      limbColor: 0x336688, helmetColor: 0x224466, eyeColor: 0x00ccff,
      attackDmg: 15, attackRate: 1.4, scoreValue: 700, dropChance: 0.55,
      role: 'ew_operator', range: 8, rangedDmg: 10, rangedRate: 1.4, accuracy: 0.35,
    },
    ASSAULT_MECH: {
      name: 'ASSAULT_MECH', hpBase: 3000, speedBase: 1.0, scale: 3.0,
      camoVariant: 'dark', bodyColor: 0x444444, headColor: 0x444444,
      limbColor: 0x333333, helmetColor: 0x222222, eyeColor: 0xff0000,
      attackDmg: 80, attackRate: 0.5, scoreValue: 3000, dropChance: 1.0,
      role: 'assault_mech', range: 25, rangedDmg: 80, rangedRate: 0.5, accuracy: 0.55,
    },
    SWARM_OP: {
      name: 'SWARM_OP', hpBase: 45, speedBase: 1.0, scale: 1.0,
      camoVariant: 'dark', bodyColor: 0x777777, headColor: 0xb09070,
      limbColor: 0x555555, helmetColor: 0x444444, eyeColor: 0x00ccff,
      attackDmg: 8, attackRate: 1.0, scoreValue: 750, dropChance: 0.50,
      role: 'swarm_op', range: 5, rangedDmg: 5, rangedRate: 1.0, accuracy: 0.3,
    },
    // ── Stage Boss Types (meshes reuse humanoid but scaled) ─
    BOSS_MARIUPOL: {
      name: 'BOSS_MARIUPOL', hpBase: 800, speedBase: 1.8, scale: 1.8,
      camoVariant: 'dark', bodyColor: 0xff4400, headColor: 0xd0b090,
      limbColor: 0xcc3300, helmetColor: 0x992200, eyeColor: 0xff0000,
      attackDmg: 55, attackRate: 1.2, scoreValue: 5000, dropChance: 1.0,
      role: 'boss', range: 10, rangedDmg: 40, rangedRate: 1.5, accuracy: 0.5,
    },
    BOSS_CRIMEA: {
      name: 'BOSS_CRIMEA', hpBase: 1000, speedBase: 1.2, scale: 1.7,
      camoVariant: 'dark', bodyColor: 0x2244aa, headColor: 0xd0b090,
      limbColor: 0x113388, helmetColor: 0x002266, eyeColor: 0x00ccff,
      attackDmg: 40, attackRate: 1.0, scoreValue: 6000, dropChance: 1.0,
      role: 'boss', range: 30, rangedDmg: 100, rangedRate: 2.0, accuracy: 0.6,
    },
    BOSS_CHORNOBYL: {
      name: 'BOSS_CHORNOBYL', hpBase: 1200, speedBase: 2.0, scale: 2.0,
      camoVariant: 'dark', bodyColor: 0x44ff22, headColor: 0xaacc88,
      limbColor: 0x33cc11, helmetColor: 0x228800, eyeColor: 0x00ff00,
      attackDmg: 50, attackRate: 1.0, scoreValue: 7000, dropChance: 1.0,
      role: 'boss', range: 12, rangedDmg: 35, rangedRate: 1.2, accuracy: 0.45,
    },
    BOSS_MOSCOW: {
      name: 'BOSS_MOSCOW', hpBase: 1800, speedBase: 3.0, scale: 1.6,
      camoVariant: 'dark', bodyColor: 0x111111, headColor: 0xd0b090,
      limbColor: 0x0a0a0a, helmetColor: 0x050505, eyeColor: 0xff4400,
      attackDmg: 65, attackRate: 0.8, scoreValue: 8000, dropChance: 1.0,
      role: 'boss', range: 18, rangedDmg: 50, rangedRate: 1.0, accuracy: 0.65,
    },
    BOSS_SEVASTOPOL: {
      name: 'BOSS_SEVASTOPOL', hpBase: 2000, speedBase: 1.0, scale: 2.2,
      camoVariant: 'dark', bodyColor: 0x335588, headColor: 0xd0b090,
      limbColor: 0x224477, helmetColor: 0x113366, eyeColor: 0x00aaff,
      attackDmg: 80, attackRate: 1.5, scoreValue: 10000, dropChance: 1.0,
      role: 'boss', range: 35, rangedDmg: 150, rangedRate: 2.5, accuracy: 0.55,
    },
    BOSS_DONBAS: {
      name: 'BOSS_DONBAS', hpBase: 2500, speedBase: 1.4, scale: 2.0,
      camoVariant: 'dark', bodyColor: 0x553322, headColor: 0xd0b090,
      limbColor: 0x442211, helmetColor: 0x331100, eyeColor: 0xff2200,
      attackDmg: 60, attackRate: 1.0, scoreValue: 12000, dropChance: 1.0,
      role: 'boss', range: 15, rangedDmg: 120, rangedRate: 2.0, accuracy: 0.5,
    },
    BOSS_BELGOROD: {
      name: 'BOSS_BELGOROD', hpBase: 3000, speedBase: 1.2, scale: 2.5,
      camoVariant: 'dark', bodyColor: 0x445533, headColor: 0xd0b090,
      limbColor: 0x334422, helmetColor: 0x223311, eyeColor: 0xff0000,
      attackDmg: 90, attackRate: 1.2, scoreValue: 15000, dropChance: 1.0,
      role: 'boss', range: 25, rangedDmg: 130, rangedRate: 2.0, accuracy: 0.6,
    },
    BOSS_KREMLIN: {
      name: 'BOSS_KREMLIN', hpBase: 5000, speedBase: 1.5, scale: 3.0,
      camoVariant: 'dark', bodyColor: 0xcc0000, headColor: 0xd0b090,
      limbColor: 0xaa0000, helmetColor: 0x880000, eyeColor: 0xff0000,
      attackDmg: 100, attackRate: 1.0, scoreValue: 25000, dropChance: 1.0,
      role: 'boss', range: 20, rangedDmg: 250, rangedRate: 2.5, accuracy: 0.7,
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
  var _aliveMembersBuf = [];  // reusable buffer for alive member indices

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
  let _aiStrategy = null; // ML counter-strategy for this wave
  let _adaptiveMult = 1.0; // B25: adaptive difficulty multiplier

  const ARENA_SIZE = 24;
  const DETECTION_RANGE = 14;   // enemies detect player within this range
  const DETECTION_ANGLE = 1.2;  // ~70° half-cone FOV for detection
  const SPOT_TIME = 1.5;        // seconds to fully spot player

  // ── Reusable temp vectors (avoids GC pressure in hot loop) ──
  const _tmpVec3 = new THREE.Vector3();
  const _tmpVec3b = new THREE.Vector3();
  const _tmpVec3c = new THREE.Vector3();
  const _tmpVec3d = new THREE.Vector3();
  const _tmpVec3e = new THREE.Vector3();
  const _tmpVec3f = new THREE.Vector3();

  // ── Cached getAll results (rebuilt once per update frame) ──
  let _cachedAlive = [];
  let _cachedMeshes = [];
  let _cacheFrame = -1;

  // ── Enemy grenade system ─────────────────────────────────
  const _enemyGrenades = [];
  const _grenadeGeo = new THREE.SphereGeometry(0.12, 6, 4);
  const _grenadeMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  function throwEnemyGrenade(from, target) {
    if (!scene) return;
    var mesh = new THREE.Mesh(_grenadeGeo, _grenadeMat);
    mesh.position.copy(from);
    mesh.position.y += 1.2;
    var dx = target.x - from.x;
    var dz = target.z - from.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var t = Math.max(0.6, dist / 12); // flight time
    var vx = dx / t;
    var vz = dz / t;
    var vy = 6 + dist * 0.15; // arc upward
    scene.add(mesh);
    _enemyGrenades.push({ mesh: mesh, vx: vx, vy: vy, vz: vz, life: t + 0.5, dmg: 35, radius: 4 });
  }
  function updateEnemyGrenades(delta, playerPos) {
    for (var i = _enemyGrenades.length - 1; i >= 0; i--) {
      var g = _enemyGrenades[i];
      g.mesh.position.x += g.vx * delta;
      g.mesh.position.y += g.vy * delta;
      g.mesh.position.z += g.vz * delta;
      g.vy -= 15 * delta; // gravity
      g.life -= delta;
      // Explode on ground or timeout
      var terrainY = (typeof VoxelWorld !== 'undefined') ? VoxelWorld.getTerrainHeight(g.mesh.position.x, g.mesh.position.z) : 0;
      if (g.mesh.position.y <= terrainY + 0.2 || g.life <= 0) {
        var pos = g.mesh.position;
        if (typeof Tracers !== 'undefined' && Tracers.spawnExplosion) Tracers.spawnExplosion(pos, 2);
        if (typeof AudioSystem !== 'undefined') AudioSystem.playExplosion();
        // Damage player if in radius
        if (playerPos) {
          var d = pos.distanceTo(playerPos);
          if (d < g.radius && onPlayerHit) {
            var falloff = Math.max(0, 1 - d / g.radius);
            onPlayerHit(Math.round(g.dmg * falloff), pos);
          }
        }
        scene.remove(g.mesh);
        _enemyGrenades.splice(i, 1);
      }
    }
  }

  // ── Choose a type appropriate for the current wave ────────
  function pickTypeForWave(w) {
    // AI Smart Learning: ML system may override type selection
    if (_aiStrategy && _aiStrategy.preferredTypes && _aiStrategy.preferredTypes.length > 0 &&
        _aiStrategy.adaptationLevel > 0 && Math.random() < 0.3 * _aiStrategy.adaptationLevel) {
      return _aiStrategy.preferredTypes[Math.floor(Math.random() * _aiStrategy.preferredTypes.length)];
    }

    const r = Math.random();
    // Stage boss on final wave, mini-boss every 5th wave
    if (w % 5 === 0 && w >= 5 && r < 0.08) {
      if (typeof EnemyTypes !== 'undefined' && EnemyTypes.getBossForStage) {
        return EnemyTypes.getBossForStage(_stageId);
      }
      return 'BOSS';
    }
    // Endgame enemy types (stages 9-12, wave ~15+)
    if (w >= 20 && r < 0.04) return 'ASSAULT_MECH';
    if (w >= 16 && r < 0.07) return 'THERMOBARIC';
    if (w >= 16 && r < 0.10) return 'HEAVY_SNIPER';
    if (w >= 14 && r < 0.13) return 'SWARM_OP';
    if (w >= 14 && r < 0.16) return 'EW_OPERATOR';
    if (w >= 12 && r < 0.19) return 'COMMISSAR';
    // Mid-game types
    if (w >= 7 && r < 0.22) return 'MORTAR';
    if (w >= 7 && r < 0.25) return 'SNIPER_ELITE';
    if (w >= 6 && r < 0.29) return 'SHIELD_BEARER';
    if (w >= 5 && r < 0.34) return 'BOMBER';
    if (w >= 4 && r < 0.39) return 'WAR_DOG';
    // Original types
    if (w >= 7 && r < 0.42) return 'SABOTEUR';
    if (w >= 7 && r < 0.45) return 'DRONE_OP';
    if (w >= 6 && r < 0.50) return 'SNIPER';
    if (w >= 6 && r < 0.55) return 'FLAMETHROWER';
    if (w >= 5 && r < 0.60) return 'ENGINEER';
    if (w >= 5 && r < 0.70) return 'ARMORED';
    if (w >= 3 && r < 0.80) return 'STORMER';
    if (w >= 2 && r < 0.25) return 'ENGINEER';
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

  // ── Texture cache to avoid per-enemy canvas regeneration ──
  const _texCache = {};
  function getCachedTex(key, genFn) {
    if (!_texCache[key]) _texCache[key] = genFn();
    return _texCache[key];
  }

  // ── Build humanoid mesh scaled to typeCfg ─────────────────
  // Full EMR camo uniforms, white Z on helmet, white armband
  function buildMesh(typeCfg) {
    const group = new THREE.Group();
    const s     = typeCfg.scale;

    // Generate EMR Digital Flora camo texture for this unit (cached by variant)
    const camoTex = getCachedTex('camo_' + (typeCfg.camoVariant || 'light'), function() {
      return makeEMRCamoTexture(typeCfg.camoVariant || 'light');
    });

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
    const helmetZTex = getCachedTex('helmet_' + typeCfg.helmetColor, function() {
      return makeHelmetZTexture(typeCfg.helmetColor);
    });
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.40 * s, 0.18 * s, 0.40 * s),
      new THREE.MeshLambertMaterial({ map: helmetZTex })
    );
    helmet.position.y = 1.55 * s;

    // ── Legs (camo textured, darker variant) ──────────────
    const legCamo = getCachedTex('camo_dark', function() {
      return makeEMRCamoTexture('dark');
    });
    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.21 * s, 0.55 * s, 0.21 * s),
      new THREE.MeshLambertMaterial({ map: legCamo })
    );
    legL.position.set(-0.14 * s, 0.28 * s, 0);
    const legR = legL.clone();
    legR.position.set(0.14 * s, 0.28 * s, 0);

    // ── Left arm with WHITE ARMBAND (Russian ID marking) ──
    const armbandTex = getCachedTex('armband_' + typeCfg.limbColor, function() {
      return makeWhiteArmbandTexture(typeCfg.limbColor);
    });
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
    CONSCRIPT:    { len: 0.22, color: 0x3a3a28, name: 'AK-74' },
    STORMER:      { len: 0.16, color: 0x2a2a2a, name: 'PP-19 Vityaz' },
    ARMORED:      { len: 0.30, color: 0x2a2a1a, name: 'PKP Pecheneg' },
    MEDIC:        { len: 0.12, color: 0x333333, name: 'Makarov PM' },
    OFFICER:      { len: 0.24, color: 0x2a2a2a, name: 'AK-12' },
    SNIPER:       { len: 0.35, color: 0x3a3a2a, name: 'SV-98' },
    ENGINEER:     { len: 0.20, color: 0x3a3a28, name: 'AKS-74U' },
    DRONE_OP:     { len: 0.14, color: 0x2a2a2a, name: 'Makarov PM' },
    FLAMETHROWER: { len: 0.28, color: 0x4a2a0a, name: 'RPO-A Shmel' },
    SABOTEUR:     { len: 0.18, color: 0x1a1a1a, name: 'SR-2 Veresk' },
    BOSS:          { len: 0.30, color: 0x2a2a2a, name: 'PKM' },
    BOMBER:        { len: 0,    color: 0x000000, name: 'Explosive Vest' },
    WAR_DOG:       { len: 0,    color: 0x000000, name: 'Teeth' },
    SHIELD_BEARER: { len: 0.16, color: 0x2a2a2a, name: 'Makarov PM' },
    MORTAR:        { len: 0.24, color: 0x444422, name: '2B14 Podnos' },
    SNIPER_ELITE:  { len: 0.32, color: 0x2a3a2a, name: 'ORSIS T-5000' },
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
    if (scene) scene.add(group);
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
    mesh.scale.setScalar(0.01); // start tiny for spawn animation
    if (scene) scene.add(mesh);

    // Build alert icon as child of mesh (auto-positioned above head)
    var _alertIcon = buildAlertIcon();
    _alertIcon.position.set(0, 1.75 * typeCfg.scale + 0.6, 0);
    mesh.add(_alertIcon);

    const waveHpBonus    = (1 + (wave - 1) * 0.22) * stageMult * _adaptiveMult;
    const waveSpeedBonus = (1 + (wave - 1) * 0.06) * (1 + (stageMult - 1) * 0.3);
    const hp             = typeCfg.hpBase * waveHpBonus * rank.hpMult;

    // Determine squad role
    let squadRole = SQUAD_ROLE.RIFLEMAN;
    if (typeCfg.role === 'medic') squadRole = SQUAD_ROLE.MEDIC;
    else if (typeCfg.role === 'officer') squadRole = SQUAD_ROLE.OFFICER;

    const idx = enemies.length;
    enemies.push({
      id:          idx,
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
      _spawnTimer: 0.3, // spawn-in scale animation duration
      alertIcon: _alertIcon,
    });
    return idx;
  }

  // ── Spawn an assault group ─────────────────────────────────
  function spawnAssaultGroup(groupId, sc) {
    // AI Smart Learning: bias spawn angle toward player's vulnerable direction
    var baseAngle = (groupId / NUM_ASSAULT_GROUPS) * Math.PI * 2 + Math.random() * 0.5;
    if (_aiStrategy && _aiStrategy.attackFromVulnerable && _aiStrategy.preferredSpawnAngle && groupId === 0) {
      // First group spawns from vulnerable direction (convert player-relative to world-space)
      var spawnYaw = 0;
      if (typeof CameraSystem !== 'undefined' && CameraSystem.getYaw) {
        spawnYaw = CameraSystem.getYaw();
      }
      baseAngle = spawnYaw + _aiStrategy.preferredSpawnAngle + (Math.random() - 0.5) * 0.5;
    }
    var spawnDistMod = (_aiStrategy && _aiStrategy.spawnDistanceMult) || 1.0;
    const dist = (ARENA_SIZE * 0.44 + Math.random() * 6) * spawnDistMod;
    const center = new THREE.Vector3(Math.cos(baseAngle) * dist, 0, Math.sin(baseAngle) * dist);

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
  var _stageId = 1;

  function startWave(w, sc, stageMultiplier, aiStrategy, stageId) {
    wave      = w;
    scene     = sc;
    stageMult = stageMultiplier || 1;
    _stageId  = stageId || 1;
    enemies   = [];
    allDead   = false;
    assaultGroups.length = 0;
    _aiStrategy = aiStrategy || null;

    // ── B25: Adaptive difficulty — scale enemy HP based on player performance ──
    if (typeof MLSystem !== 'undefined' && MLSystem.getPerformanceRating) {
      var perfRating = MLSystem.getPerformanceRating(); // 0.0 (bad) to 1.0 (great)
      _adaptiveMult = 0.8 + perfRating * 0.6; // range: 0.8x to 1.4x HP
    } else {
      _adaptiveMult = 1.0;
    }

    // AI Smart Learning: adjust group spread based on strategy
    var groupSpread = (_aiStrategy && _aiStrategy.groupSpreadFactor) || 1.0;

    // Spawn 5 enemy assault groups (Russian army штурмовые группы)
    for (let g = 0; g < NUM_ASSAULT_GROUPS; g++) {
      spawnAssaultGroup(g, sc);
    }

    // AI Smart Learning: adjust formation spread for all groups
    if (groupSpread !== 1.0) {
      for (var gi = 0; gi < assaultGroups.length; gi++) {
        assaultGroups[gi].formationSpread *= groupSpread;
      }
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
      // Shrink in last 0.5s (avoids shared material mutation)
      if (blood.life < 0.5) {
        var fadeScale = (blood.life / 0.5) * blood._origScale;
        blood.mesh.scale.setScalar(Math.max(0.01, fadeScale));
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

    // Update floating damage numbers
    updateDmgNumbers(delta);

    // Update enemy grenades
    updateEnemyGrenades(delta, playerPos);

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
      if (!e) continue; // null = removed corpse, skip

      if (!e.alive) {
        // Hide HP bar, sink corpse with topple animation, then remove
        if (e.hpBar) e.hpBar.group.visible = false;
        e.deathTimer -= delta;
        // Topple rotation
        if (e._deathTiltX) {
          e.mesh.rotation.x += e._deathTiltX * delta * 2.5;
          e.mesh.rotation.x = Math.max(-1.8, Math.min(1.8, e.mesh.rotation.x));
        }
        // Upward pop then sink
        if (e._deathPopY !== undefined) {
          e._deathPopY -= 12 * delta; // gravity on corpse
          e.mesh.position.y += e._deathPopY * delta;
        }
        // Sink into ground in final phase
        if (e.deathTimer < 0.8) {
          e.mesh.position.y -= delta * 1.0;
        }
        if (e.deathTimer <= 0) {
          // Clean up sniper laser line
          if (e._laserLine) {
            e._laserLine.geometry.dispose();
            e._laserLine.material.dispose();
            scene.remove(e._laserLine);
            e._laserLine = null;
          }
          disposeMeshTree(e.mesh);
          scene.remove(e.mesh);
          if (e.hpBar) {
            disposeMeshTree(e.hpBar.group);
            scene.remove(e.hpBar.group);
            e.hpBar = null;
          }
          enemies[i] = null;
          _cacheFrame = -1; // force cache rebuild
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

      // Spawn-in scale animation
      if (e._spawnTimer > 0) {
        e._spawnTimer -= delta;
        var spawnT = 1 - Math.max(0, e._spawnTimer) / 0.3;
        // Elastic overshoot: pop up slightly past 1.0 then settle
        var sc = e.typeCfg.scale || 1;
        var spawnScale = sc * (spawnT < 0.7
          ? (spawnT / 0.7) * 1.15
          : 1.15 - 0.15 * ((spawnT - 0.7) / 0.3));
        e.mesh.scale.setScalar(spawnScale);
        if (e._spawnTimer <= 0) e.mesh.scale.setScalar(sc);
      }

      // Stagger timer: skip movement while staggered
      if (e._staggerTimer && e._staggerTimer > 0) {
        e._staggerTimer -= delta;
      }

      // Stun timer (flashbang): skip all AI while stunned
      if (e._stunTimer && e._stunTimer > 0) {
        e._stunTimer -= delta;
        // Stunned enemies wobble in place
        if (e.mesh) e.mesh.rotation.z = Math.sin(e._stunTimer * 12) * 0.15;
        if (e._stunTimer <= 0) { if (e.mesh) e.mesh.rotation.z = 0; }
        continue; // skip entire AI update
      }

      // Smoke LOS block: if enemy is inside smoke, pause targeting
      if (typeof Weapons !== 'undefined' && Weapons.isInSmoke && Weapons.isInSmoke(e.mesh.position.x, e.mesh.position.z)) {
        e.playerSpotted = false;
        e.spotLevel = 0;
      }

      // Fire arm reset: lower arm after firing
      if (e._fireArmTimer && e._fireArmTimer > 0) {
        e._fireArmTimer -= delta;
        if (e._fireArmTimer <= 0) {
          var faParts = e.mesh.userData.parts;
          if (faParts && faParts[6]) faParts[6].rotation.x = 0;
        }
      }

      // Always follow terrain height
      if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight) {
        e.mesh.position.y = VoxelWorld.getTerrainHeight(e.mesh.position.x, e.mesh.position.z);
      }

      // ── Detection system: enemies must spot the player ──
      const dirToPlayer = _tmpVec3
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
        const facingDir = _tmpVec3d.set(0, 0, -1).applyQuaternion(e.mesh.quaternion);
        const angleToPlayer = facingDir.angleTo(_tmpVec3e.copy(dirToPlayer).normalize());
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
        if (!e.playerSpotted && typeof AudioSystem !== 'undefined' && AudioSystem.playEnemyAlert) {
          AudioSystem.playEnemyAlert();
        }
        e.playerSpotted = true;
      }

      // Alert icon visibility
      if (e.alertIcon) e.alertIcon.visible = e.playerSpotted;

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
          if (!e._wanderTarget) e._wanderTarget = new THREE.Vector3();
          // Prioritize patrolling toward friendly positions, buildings, or roads
          var gotTarget = false;
          // Try to target friendly NPCs in area
          if (typeof NPCSystem !== 'undefined' && NPCSystem.getAll) {
            var friendlies = NPCSystem.getAll();
            if (friendlies.length > 0) {
              var picked = friendlies[Math.floor(Math.random() * friendlies.length)];
              if (picked.alive) { e._wanderTarget.copy(picked.position); gotTarget = true; }
            }
          }
          // Try road waypoints for flanking maneuvers
          if (!gotTarget && typeof VoxelWorld !== 'undefined' && VoxelWorld.getRoadWaypoints) {
            var roadWPs = VoxelWorld.getRoadWaypoints();
            if (roadWPs.length > 0) {
              e._wanderTarget.copy(roadWPs[Math.floor(Math.random() * roadWPs.length)]);
              gotTarget = true;
            }
          }
          // Fallback to directed patrol toward center with spread
          if (!gotTarget) {
            var wa = Math.random() * Math.PI * 2;
            var wd = 6 + Math.random() * 10;
            e._wanderTarget.set(Math.cos(wa) * wd, 0, Math.sin(wa) * wd);
          }
        }
        moveTarget = e._wanderTarget;
        targetDist = e.mesh.position.distanceTo(moveTarget);
      }

      // ── Movement toward target with obstacle avoidance + strategic flanking ──
      // Enemies with ranged weapons hold position at firing distance instead of rushing
      var engageDist = 1.0; // default: close to melee
      if (e.playerSpotted && !targetIsNPC && e.typeCfg.rangedDmg > 0) {
        // Ranged enemies stop at their preferred engagement distance
        var typeName = e.typeCfg.name;
        if (typeName === 'SNIPER' || typeName === 'HEAVY_SNIPER') engageDist = 25;
        else if (typeName === 'MORTAR' || typeName === 'THERMOBARIC') engageDist = 20;
        else if (typeName === 'SUPPORT' || typeName === 'PKM') engageDist = 15;
        else engageDist = 8 + (e.id % 5) * 2; // regular troops: 8-16 range, staggered by ID
        // Squad role modifiers
        if (e.squadRole === SQUAD_ROLE.SUPPORT) engageDist = Math.max(engageDist, 14);
        if (e.squadRole === SQUAD_ROLE.POINTMAN) engageDist = Math.min(engageDist, 5);
      }
      if (moveTarget && targetDist > engageDist) {
        const dir = _tmpVec3b.subVectors(moveTarget, e.mesh.position).setY(0).normalize();

        // ── AI Smart Learning: ML-guided flanking and tactical behavior ──
        if (e.playerSpotted && !targetIsNPC && _aiStrategy) {
          // Exploit player's vulnerable direction (convert from player-relative to world-space)
          if (_aiStrategy.attackFromVulnerable && _aiStrategy.vulnerableSector >= 0 && targetDist > 8) {
            var playerYaw = 0;
            if (typeof CameraSystem !== 'undefined' && CameraSystem.getYaw) {
              playerYaw = CameraSystem.getYaw();
            }
            var vulnAngle = playerYaw + _aiStrategy.vulnerableSector * (Math.PI * 0.25);
            var vulnDir = _tmpVec3d.set(Math.sin(vulnAngle), 0, Math.cos(vulnAngle));
            var vulnWeight = 0.3 * _aiStrategy.adaptationLevel;
            dir.addScaledVector(vulnDir, vulnWeight).normalize();
          }

          // ML-guided position prediction: intercept predicted position
          if (typeof MLSystem !== 'undefined' && MLSystem.predictPlayerPosition && targetDist > 10) {
            var predicted = MLSystem.predictPlayerPosition(2.0);
            if (predicted) {
              var predDir = _tmpVec3e.set(predicted.x - e.mesh.position.x, 0, predicted.z - e.mesh.position.z);
              if (predDir.lengthSq() > 1) {
                predDir.normalize();
                dir.lerp(predDir, 0.2 * _aiStrategy.adaptationLevel).normalize();
              }
            }
          }

          // ML-guided rush timing: coordinate attack during predicted reload
          if (_aiStrategy.attackDuringReload && typeof MLSystem !== 'undefined') {
            var mlBehav = MLSystem.getBehavior();
            if (mlBehav && mlBehav.timingPatterns) {
              var tSinceReload = (performance.now() - mlBehav.timingPatterns.lastReloadTime) / 1000;
              var dynReloadWin = Math.max(0, mlBehav.timingPatterns.avgTimeBetweenReloads - tSinceReload);
              if (dynReloadWin < 2 && dynReloadWin > 0) {
                // Sprint toward player during their reload window
                e.speed = e.typeCfg.speedBase * (1 + (wave - 1) * 0.06) * stageMult * 1.5;
              }
            }
          }

          // ML aggression override
          var aggMod = _aiStrategy.overallAggression || 0.5;
          if (aggMod > 0.7 && targetDist > 5) {
            // More aggressive: close distance faster
            e.speed = Math.max(e.speed, e.typeCfg.speedBase * 1.3 * stageMult);
          }
        }

        // ── Strategic flanking: stormers and officers approach from the side ──
        if (e.playerSpotted && !targetIsNPC && targetDist > 6 && targetDist < 25) {
          const typeName = e.typeCfg.name;
          // AI Smart Learning: increase flank intensity based on ML strategy
          var flankMod = (_aiStrategy && _aiStrategy.flankIntensity) || 0.3;
          if (typeName === 'STORMER' || typeName === 'OFFICER' || typeName === 'SABOTEUR') {
            // Flank: perpendicular offset based on enemy ID (alternating L/R)
            const flankSign = (e.id % 2 === 0) ? 1 : -1;
            const flankStrength = Math.min(1, (targetDist - 6) / 10) * Math.max(0.7, flankMod);
            const perp = _tmpVec3d.set(-dir.z * flankSign, 0, dir.x * flankSign);
            dir.addScaledVector(perp, flankStrength).normalize();
          } else if (typeName === 'SNIPER') {
            // Snipers maintain distance: slow approach, prefer to hold at range
            if (targetDist < 12) {
              const retreatStrength = (12 - targetDist) / 12 * 0.6;
              dir.multiplyScalar(-retreatStrength).normalize();
            }
          } else if (flankMod > 0.5 && Math.random() < flankMod * 0.3) {
            // ML: even regular troops get some flanking behavior when AI is adapting
            const flankSign2 = (e.id % 2 === 0) ? 1 : -1;
            const flankStr2 = Math.min(1, (targetDist - 6) / 15) * flankMod * 0.5;
            const perp2 = _tmpVec3d.set(-dir.z * flankSign2, 0, dir.x * flankSign2);
            dir.addScaledVector(perp2, flankStr2).normalize();
          }
        }

        var speedMult = 1;
        if (e._officerBuffSpd) { speedMult *= e._officerBuffSpd; e._officerBuffSpd = 0; }
        if (e._rallyBuff && !e._officerBuffDmg) { speedMult *= e._rallyBuff; } // rally also boosts speed
        const stepDist = e.speed * speedMult * delta * (e._staggerTimer > 0 ? 0 : 1);
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
          const sideDir = _tmpVec3d.set(-dir.z * e._avoidDir, 0, dir.x * e._avoidDir);
          e.mesh.position.addScaledVector(sideDir, stepDist);
          if (e._avoidTimer > 1.5) { e._avoidDir *= -1; e._avoidTimer = 0; }
        } else {
          e._avoidTimer = 0;
          e.mesh.position.addScaledVector(dir, stepDist);
        }

        // Face toward target
        e.mesh.lookAt(moveTarget.x, e.mesh.position.y, moveTarget.z);

        // Leg swing animation
        var prevLeg = e.legAngle;
        e.legAngle += e.legDir * (e.speed / 2.2) * 4 * delta;
        if (Math.abs(e.legAngle) > 0.45) e.legDir *= -1;
        // Play footstep when leg passes zero (step transition)
        if (prevLeg * e.legAngle < 0 && typeof AudioSystem !== 'undefined' && AudioSystem.playEnemyFootstep) {
          var eDist = e.mesh.position.distanceTo(playerPos);
          AudioSystem.playEnemyFootstep(eDist);
        }
      } else if (e.playerSpotted && engageDist > 1 && targetDist <= engageDist) {
        // At engage distance: strafe sideways while facing player
        if (!e._strafeDir) e._strafeDir = (e.id % 2 === 0) ? 1 : -1;
        e._strafeTimer = (e._strafeTimer || 0) + delta;
        if (e._strafeTimer > 2 + Math.random()) { e._strafeDir *= -1; e._strafeTimer = 0; }
        var sDir = _tmpVec3b.subVectors(playerPos, e.mesh.position).setY(0).normalize();
        var strafe = _tmpVec3d.set(-sDir.z * e._strafeDir, 0, sDir.x * e._strafeDir);
        var sStep = e.speed * 0.4 * delta;
        e.mesh.position.addScaledVector(strafe, sStep);
        e.mesh.lookAt(playerPos.x, e.mesh.position.y, playerPos.z);
        // Subtle leg animation at half speed
        e.legAngle += e.legDir * (e.speed / 4.4) * 4 * delta;
        if (Math.abs(e.legAngle) > 0.3) e.legDir *= -1;
      }
      // Shared animation for both moving and strafing
      {
        const parts = e.mesh.userData.parts;
        if (parts[3]) parts[3].rotation.x =  e.legAngle;
        if (parts[4]) parts[4].rotation.x = -e.legAngle;
        // Arm swing (counter to legs)
        if (parts[5]) parts[5].rotation.x = -e.legAngle * 0.5;
        if (parts[6]) parts[6].rotation.x =  e.legAngle * 0.5;
        // Torso bob
        if (parts[0]) parts[0].rotation.z = Math.sin(e.legAngle) * 0.04;
      }

      // ── B25: Retreat when wounded (30-50% HP) — run away from player ──
      if (!e.surrendered && !e.retreating && e.hp < e.maxHp * 0.3 && e.hp > e.maxHp * 0.1) {
        if (Math.random() < 0.15 * delta) {
          e.retreating = true;
          e._retreatTimer = 3 + Math.random() * 2; // retreat for 3-5 seconds
        }
      }
      if (e.retreating) {
        e._retreatTimer -= delta;
        // Run away from player
        if (playerPos) {
          var awayDir = _tmpVec3c.subVectors(e.mesh.position, playerPos).setY(0).normalize();
          e.mesh.position.addScaledVector(awayDir, e.speed * 1.5 * delta);
          // Snap to terrain height
          if (typeof VoxelWorld !== 'undefined') {
            e.mesh.position.y = VoxelWorld.getTerrainHeight(e.mesh.position.x, e.mesh.position.z);
          }
          e.mesh.lookAt(e.mesh.position.x + awayDir.x, e.mesh.position.y, e.mesh.position.z + awayDir.z);
        }
        if (e._retreatTimer <= 0) e.retreating = false;
        // Update HP bar and continue
        updateHpBar(e, playerPos);
        continue;
      }

      // ── Surrender system: low-HP enemies may surrender ──
      if (!e.surrendered && e.hp < e.maxHp * 0.15 && e.hp > 0) {
        // 2% chance per frame to surrender when below 15% HP
        // ~20% chance per second to surrender (0.2 * delta)
        if (Math.random() < 0.2 * delta) {
          e.surrendered = true;
          e.speed = 0;
          // Raise hands animation: arms up, kneel
          var parts = e.mesh.userData.parts;
          if (parts) {
            // Arms: indices 5 (left arm) and 6 (right arm) — raise straight up
            if (parts[5]) { parts[5].rotation.x = -2.8; parts[5].rotation.z = 0.2; }
            if (parts[6]) { parts[6].rotation.x = -2.8; parts[6].rotation.z = -0.2; }
          }
          // Kneel: lower body slightly
          e.mesh.position.y -= 0.3;
          // White flag: change helmet to white (parts[2] is helmet)
          var parts = e.mesh.userData.parts;
          if (parts && parts[2] && parts[2].material) {
            parts[2].material = parts[2].material.clone();
            parts[2].material.map = null;
            parts[2].material.color.setHex(0xffffff);
            parts[2].material.needsUpdate = true;
          }
        }
      }
      // Surrendered enemies don't attack — give bonus score if player walks close
      if (e.surrendered) {
        e.attackTimer = 999;
        if (playerPos) {
          const surrenderDist = e.mesh.position.distanceTo(playerPos);
          if (surrenderDist < 3 && !e._surrenderClaimed) {
            e._surrenderClaimed = true;
            // Award POW capture bonus directly (scoreValue on death won't fire for surrendered)
            if (typeof onEnemyDied === 'function') {
              onEnemyDied({ scoreValue: 200, typeName: e.typeName, mesh: e.mesh, alive: false, hp: 0 }, false);
            }
          }
        }
        continue;
      }

      // ── Combat: ranged attack on player if spotted ──
      if (e.playerSpotted && !targetIsNPC && e.typeCfg.range > 0) {
        if (distToPlayer < e.typeCfg.range && distToPlayer > 2.5) {
          if (!e._rangedTimer) e._rangedTimer = 0;
          e._rangedTimer -= delta;

          // AI Smart Learning: faster fire rate during player's reload window
          var fireRateMod = 1.0;
          if (_aiStrategy && _aiStrategy.attackDuringReload && typeof MLSystem !== 'undefined') {
            // Dynamically compute reload window instead of using stale strategy value
            var mlBehavior = MLSystem.getBehavior();
            if (mlBehavior && mlBehavior.timingPatterns) {
              var timeSinceReload = (performance.now() - mlBehavior.timingPatterns.lastReloadTime) / 1000;
              var dynamicReloadWindow = Math.max(0, mlBehavior.timingPatterns.avgTimeBetweenReloads - timeSinceReload);
              if (dynamicReloadWindow < 1.5 && dynamicReloadWindow > 0) {
                fireRateMod = 0.6; // 40% faster firing during reload
              }
            }
          }
          // AI Smart Learning: synchronized attacks when strategy calls for it
          if (_aiStrategy && _aiStrategy.syncedAttack && e._rangedTimer < e.typeCfg.rangedRate * 0.3) {
            fireRateMod = Math.min(fireRateMod, 0.7);
          }

          if (e._rangedTimer <= 0) {
            // Apply boss rage multiplier (faster attacks when low HP)
            var rageMod = e._rageMult || 1.0;
            e._rangedTimer = e.typeCfg.rangedRate * fireRateMod / rageMod;

            // Chance to throw grenade instead of shooting (8% when dist 8-20)
            if (distToPlayer > 8 && distToPlayer < 20 && Math.random() < 0.08) {
              throwEnemyGrenade(e.mesh.position, playerPos);
            } else {
            // Accuracy check - affected by distance
            var hitChance = Math.max(0, e.typeCfg.accuracy * (1 - distToPlayer / (e.typeCfg.range * 1.5)));
            // AI Smart Learning: slight accuracy boost when countering
            if (_aiStrategy && _aiStrategy.adaptationLevel >= 2) {
              hitChance = Math.min(0.85, hitChance * 1.15);
            }
            if (Math.random() < hitChance) {
              var eDmg = e.typeCfg.rangedDmg;
              if (e._officerBuffDmg) { eDmg *= e._officerBuffDmg; e._officerBuffDmg = 0; }
              if (e._rallyBuff) { eDmg *= e._rallyBuff; e._rallyBuff = 0; }
              onPlayerHit(eDmg, e.mesh.position);
            }
            // Firing arm raise animation
            var eParts = e.mesh.userData.parts;
            if (eParts && eParts[6]) {
              eParts[6].rotation.x = -0.6;
              e._fireArmTimer = 0.15;
            }
            // Spawn tracer toward player
            if (typeof Tracers !== 'undefined' && Tracers.spawnTracer) {
              var tOrigin = _tmpVec3d.copy(e.mesh.position);
              tOrigin.y += 1.2;
              var tDir = _tmpVec3e.set(playerPos.x, playerPos.y + 0.8, playerPos.z).sub(tOrigin).normalize();
              Tracers.spawnTracer(tOrigin, tDir, 0xff4400, 80);
            }
            // Enemy gunshot audio (spatial panning)
            if (typeof AudioSystem !== 'undefined') {
              if (AudioSystem.playSpatialGunshot) {
                var camAngle = (typeof CameraSystem !== 'undefined' && CameraSystem.getYaw) ? CameraSystem.getYaw() : 0;
                AudioSystem.playSpatialGunshot('rifle', e.mesh.position, playerPos, camAngle);
              } else if (AudioSystem.playGunshot) {
                AudioSystem.playGunshot('rifle');
              }
            }
            }
          }
        }
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
      // ── EnemyTypes special AI behaviors ──
      if (typeof EnemyTypes !== 'undefined') {
        var etResult = null;
        // Sync shorthand position props for EnemyTypes functions
        e.x = e.mesh.position.x; e.y = e.mesh.position.y; e.z = e.mesh.position.z;
        switch (e.typeCfg.name) {
          case 'BOMBER':
            etResult = EnemyTypes.updateBomber(e, playerPos, delta);
            if (etResult && etResult.detonate) {
              var bDist = Math.sqrt(
                Math.pow(playerPos.x - e.mesh.position.x, 2) +
                Math.pow(playerPos.z - e.mesh.position.z, 2)
              );
              if (bDist < EnemyTypes.TYPES.BOMBER.explosionRadius && onPlayerHit) {
                var bDmg = EnemyTypes.TYPES.BOMBER.explosionDamage * Math.max(0, 1 - bDist / EnemyTypes.TYPES.BOMBER.explosionRadius);
                onPlayerHit(bDmg, e.mesh.position);
              }
              if (typeof AudioSystem !== 'undefined') AudioSystem.playExplosion();
              if (typeof Tracers !== 'undefined') Tracers.spawnExplosion(e.mesh.position, 3);
              e.hp = 0; e.alive = false; e.deathTimer = 2.0;
              e._deathTiltX = -1.5; e._deathPopY = 2;
            }
            // Bomber beep warning: flash body red
            if (etResult && etResult.beep) {
              e.mesh.userData.parts.forEach(function(p) {
                if (p.material) p.material.color.setHex(0xff2222);
              });
              e.flashTimer = 0.12;
              // Scale pulse
              e.mesh.scale.setScalar(e.typeCfg.scale * 1.1);
              setTimeout(function() { if (e.mesh) e.mesh.scale.setScalar(e.typeCfg.scale); }, 100);
            }
            break;
          case 'MORTAR':
            etResult = EnemyTypes.updateMortar(e, playerPos, delta);
            if (etResult && etResult.fire && onPlayerHit) {
              var mDist = Math.sqrt(
                Math.pow(playerPos.x - etResult.targetX, 2) +
                Math.pow(playerPos.z - etResult.targetZ, 2)
              );
              if (mDist < etResult.radius) {
                onPlayerHit(etResult.damage * (1 - mDist / etResult.radius), e.mesh.position);
              }
              if (typeof AudioSystem !== 'undefined') AudioSystem.playExplosion();
            }
            break;
          case 'SHIELD_BEARER':
            EnemyTypes.updateShieldBearer(e, playerPos);
            break;
          case 'WAR_DOG':
            etResult = EnemyTypes.updateWarDog(e, playerPos, delta);
            if (etResult && etResult.leap && onPlayerHit) {
              onPlayerHit(etResult.damage, e.mesh.position);
              // Leap arc: launch upward and forward
              e._leapTimer = 0.35;
              e._leapDirX = etResult.dirX || 0;
              e._leapDirZ = etResult.dirZ || 0;
              e._leapVelY = 4.0;
            }
            // Animate leap arc
            if (e._leapTimer && e._leapTimer > 0) {
              e._leapTimer -= delta;
              e._leapVelY -= 12 * delta; // gravity
              if (e.mesh) {
                e.mesh.position.y += e._leapVelY * delta;
                e.mesh.position.x += (e._leapDirX || 0) * 8 * delta;
                e.mesh.position.z += (e._leapDirZ || 0) * 8 * delta;
                // Spin during leap
                e.mesh.rotation.x = (0.35 - e._leapTimer) / 0.35 * Math.PI * 0.5;
              }
              if (e._leapTimer <= 0) {
                e._leapTimer = 0;
                if (e.mesh) e.mesh.rotation.x = 0;
              }
            }
            break;
          case 'SNIPER_ELITE':
            etResult = EnemyTypes.updateSniper(e, playerPos, delta);
            if (etResult && etResult.fire && onPlayerHit) {
              onPlayerHit(etResult.damage, e.mesh.position);
              // Tracer line from sniper to player on fire
              if (typeof Tracers !== 'undefined' && Tracers.spawnTracer) {
                Tracers.spawnTracer(e.mesh.position, playerPos, 0xff2222);
              }
            }
            // Sniper laser sight while aiming
            if (etResult && etResult.aiming && e.mesh) {
              if (!e._laserLine) {
                var _laserPositions = new Float32Array(6);
                var laserGeo = new THREE.BufferGeometry();
                laserGeo.setAttribute('position', new THREE.BufferAttribute(_laserPositions, 3));
                var laserMat = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });
                e._laserLine = new THREE.Line(laserGeo, laserMat);
                e._laserLine._posArr = _laserPositions;
                scene.add(e._laserLine);
              }
              var lp = e._laserLine._posArr;
              lp[0] = e.mesh.position.x; lp[1] = e.mesh.position.y; lp[2] = e.mesh.position.z;
              lp[3] = playerPos.x; lp[4] = playerPos.y; lp[5] = playerPos.z;
              e._laserLine.geometry.attributes.position.needsUpdate = true;
              // Pulse opacity with aim progress
              e._laserLine.material.opacity = 0.2 + etResult.progress * 0.6;
              e._laserLine.visible = true;
            } else if (e._laserLine) {
              e._laserLine.visible = false;
            }
            break;
          case 'BOSS':
          case 'BOSS_MARIUPOL':
          case 'BOSS_CRIMEA':
          case 'BOSS_CHORNOBYL':
          case 'BOSS_MOSCOW':
          case 'BOSS_SEVASTOPOL':
          case 'BOSS_DONBAS':
          case 'BOSS_BELGOROD':
          case 'BOSS_KREMLIN':
            etResult = EnemyTypes.updateBoss(e, playerPos, delta, wave || 1);
            if (etResult) {
              if (etResult.summon) {
                for (var si = 0; si < etResult.summonCount; si++) {
                  spawnQueue.push(pickTypeForWave(wave || 1));
                }
              }
              // B22: Update boss health bar
              if (typeof HUD !== 'undefined' && HUD.showBossBar) {
                var bossMaxHp = EnemyTypes.getBossHP(wave || 1);
                HUD.showBossBar(e.typeCfg.name || 'BOSS', e.hp, bossMaxHp);
              }
            }
            break;
          case 'ENGINEER':
            etResult = EnemyTypes.updateEngineer(e, delta, typeof VoxelWorld !== 'undefined' ? VoxelWorld.setBlock : null);
            break;
          case 'MEDIC':
            etResult = EnemyTypes.updateMedic(e, enemies, delta);
            break;
          // ── B18/B19: New enemy type AI ──
          case 'FLAMETHROWER':
            etResult = EnemyTypes.updateFlamethrower ? EnemyTypes.updateFlamethrower(e, playerPos, delta) : null;
            if (etResult && etResult.flame) {
              // Spawn fire VFX + apply burn
              if (typeof Tracers !== 'undefined' && Tracers.spawnFire) Tracers.spawnFire(e.mesh.position, 2, 1.5);
              if (onPlayerHit) onPlayerHit(etResult.damage, e.mesh.position);
            }
            break;
          case 'PARATROOP':
            etResult = EnemyTypes.updateParatroop ? EnemyTypes.updateParatroop(e, playerPos, delta) : null;
            if (etResult && etResult.dropping) {
              e.mesh.position.y = etResult.y;
            }
            break;
          case 'TANK':
            etResult = EnemyTypes.updateTank ? EnemyTypes.updateTank(e, playerPos, delta) : null;
            if (etResult) {
              if (etResult.mainGun) {
                if (typeof AudioSystem !== 'undefined' && AudioSystem.playTankCannon) AudioSystem.playTankCannon();
                if (typeof Tracers !== 'undefined' && Tracers.spawnExplosion) Tracers.spawnExplosion(new THREE.Vector3(etResult.targetX, e.mesh.position.y, etResult.targetZ), 3);
                if (typeof Feedback !== 'undefined' && Feedback.triggerScreenShake) Feedback.triggerScreenShake(8, 0.5);
                if (onPlayerHit) onPlayerHit(etResult.damage * 0.3, e.mesh.position); // reduced by distance
              }
              if (etResult.mg && onPlayerHit) onPlayerHit(etResult.mgDamage, e.mesh.position);
              // B22: Boss-like HP bar for tanks
              if (typeof HUD !== 'undefined' && HUD.showBossBar) HUD.showBossBar('T-72B3 TANK', e.hp, e.maxHp);
            }
            break;
          case 'DRONE_OP':
            etResult = EnemyTypes.updateDroneOp ? EnemyTypes.updateDroneOp(e, playerPos, delta) : null;
            if (etResult && etResult.launchDrone) {
              if (typeof DroneSystem !== 'undefined' && DroneSystem.spawnEnemyDrone) {
                DroneSystem.spawnEnemyDrone(e.mesh.position.x, e.mesh.position.y + 5, e.mesh.position.z, 'enemy_fpv');
              }
            }
            break;
          case 'SPETSNAZ':
            etResult = EnemyTypes.updateSpetsnaz ? EnemyTypes.updateSpetsnaz(e, playerPos, delta) : null;
            if (etResult && etResult.flashbang) {
              if (typeof AudioSystem !== 'undefined' && AudioSystem.playFlashbang) AudioSystem.playFlashbang();
              if (typeof HUD !== 'undefined' && HUD.showGrenadeWarning) HUD.showGrenadeWarning();
              // Actual flashbang blind effect
              var fbOverlay = document.getElementById('flashbang-overlay');
              if (fbOverlay) {
                fbOverlay.style.transition = 'opacity 0.05s';
                fbOverlay.style.opacity = '1';
                setTimeout(function() {
                  fbOverlay.style.transition = 'opacity 2.5s';
                  fbOverlay.style.opacity = '0';
                }, 200);
              }
              // Stun: reduce player input sensitivity for 2s
              if (typeof GameManager !== 'undefined') {
                GameManager._flashbangStun = 2.0;
              }
            }
            break;
          case 'KADYROVITE':
            etResult = EnemyTypes.updateKadyrovite ? EnemyTypes.updateKadyrovite(e, enemies) : null;
            break;
          case 'WAGNER':
            etResult = EnemyTypes.updateWagner ? EnemyTypes.updateWagner(e, playerPos, delta) : null;
            if (etResult && etResult.berserker) {
              if (!e._baseSpeed) e._baseSpeed = e.speed;
              e.speed = e._baseSpeed * etResult.speedMult;
              // Visual: make mesh red-tinted
              if (e.mesh && e.mesh.children[0] && e.mesh.children[0].material) {
                e.mesh.children[0].material.emissive = new THREE.Color(0x660000);
              }
            }
            break;
          case 'BTR':
            etResult = EnemyTypes.updateBTR ? EnemyTypes.updateBTR(e, playerPos, delta, enemies) : null;
            if (etResult) {
              if (etResult.fire && onPlayerHit) onPlayerHit(etResult.damage, e.mesh.position);
              if (etResult.spawnInfantry) {
                for (var bi = 0; bi < etResult.infantryCount; bi++) {
                  spawnQueue.push('CONSCRIPT');
                }
              }
              if (typeof HUD !== 'undefined' && HUD.showBossBar) HUD.showBossBar('BTR-82A APC', e.hp, e.maxHp);
            }
            break;
          case 'KAMIKAZE_DRONE':
            etResult = EnemyTypes.updateKamikazeDrone ? EnemyTypes.updateKamikazeDrone(e, playerPos, delta) : null;
            if (etResult) {
              if (etResult.flying) e.mesh.position.y = etResult.height || 8;
              if (etResult.detonate) {
                if (typeof Tracers !== 'undefined' && Tracers.spawnExplosion) Tracers.spawnExplosion(e.mesh.position, 2.5);
                if (typeof AudioSystem !== 'undefined') AudioSystem.playExplosion();
                if (onPlayerHit) onPlayerHit(etResult.damage, e.mesh.position);
                e.hp = 0; e.alive = false;
              }
            }
            break;
          case 'OFFICER':
            etResult = EnemyTypes.updateOfficer ? EnemyTypes.updateOfficer(e, enemies, delta) : null;
            if (etResult && etResult.reinforce) {
              for (var oi = 0; oi < etResult.reinforceCount; oi++) {
                spawnQueue.push(pickTypeForWave(wave || 1));
              }
              if (typeof AudioSystem !== 'undefined' && AudioSystem.playEnemyBark) AudioSystem.playEnemyBark();
            }
            break;
          case 'HEAVY_SNIPER':
            etResult = EnemyTypes.updateHeavySniper ? EnemyTypes.updateHeavySniper(e, playerPos, delta) : null;
            if (etResult) {
              if (etResult.fire && onPlayerHit) {
                onPlayerHit(etResult.damage, e.mesh.position);
                if (typeof Tracers !== 'undefined' && Tracers.spawnTracer) {
                  var hsOrigin = _tmpVec3d.copy(e.mesh.position); hsOrigin.y += 1.2;
                  var hsDir = _tmpVec3e.set(playerPos.x, playerPos.y + 0.8, playerPos.z).sub(hsOrigin).normalize();
                  Tracers.spawnTracer(hsOrigin, hsDir, 0x00ff00, 200);
                }
                if (typeof AudioSystem !== 'undefined') {
                  if (AudioSystem.playSpatialGunshot) {
                    var hsYaw = (typeof CameraSystem !== 'undefined' && CameraSystem.getYaw) ? CameraSystem.getYaw() : 0;
                    AudioSystem.playSpatialGunshot('heavy_sniper', e.mesh.position, playerPos, hsYaw);
                  } else AudioSystem.playGunshot('sniper');
                }
              }
              if (etResult.relocating && e.mesh) {
                e.mesh.position.x += (Math.random() - 0.5) * 0.5;
                e.mesh.position.z += (Math.random() - 0.5) * 0.5;
              }
            }
            break;
          case 'COMMISSAR':
            etResult = EnemyTypes.updateCommissar ? EnemyTypes.updateCommissar(e, enemies, delta) : null;
            if (etResult && etResult.executed) {
              if (typeof AudioSystem !== 'undefined' && AudioSystem.playGunshot) AudioSystem.playGunshot('pistol');
            }
            break;
          case 'THERMOBARIC':
            etResult = EnemyTypes.updateThermobaric ? EnemyTypes.updateThermobaric(e, playerPos, delta) : null;
            if (etResult && etResult.fire) {
              if (typeof Tracers !== 'undefined' && Tracers.spawnExplosion) {
                var tbTarget = _tmpVec3d.set(etResult.targetX, playerPos.y, etResult.targetZ);
                Tracers.spawnExplosion(tbTarget, etResult.radius * 0.4);
              }
              if (typeof AudioSystem !== 'undefined') AudioSystem.playExplosion();
              // AoE damage — check distance from target to player
              var tbdx = playerPos.x - etResult.targetX, tbdz = playerPos.z - etResult.targetZ;
              var tbDist = Math.sqrt(tbdx * tbdx + tbdz * tbdz);
              if (tbDist < etResult.radius && onPlayerHit) {
                var tbFalloff = 1 - (tbDist / etResult.radius);
                onPlayerHit(Math.round(etResult.damage * tbFalloff), e.mesh.position);
              }
            }
            break;
          case 'EW_OPERATOR':
            etResult = EnemyTypes.updateEWOperator ? EnemyTypes.updateEWOperator(e, playerPos, delta) : null;
            if (etResult && etResult.jamming) {
              // Jam player HUD — disable minimap and compass temporarily
              if (typeof HUD !== 'undefined') {
                if (HUD.setMinimapJammed) HUD.setMinimapJammed(true);
                if (HUD.setCompassJammed) HUD.setCompassJammed(true);
              }
              e._isJamming = true;
            } else if (e._isJamming) {
              // Un-jam when out of range
              e._isJamming = false;
              if (typeof HUD !== 'undefined') {
                if (HUD.setMinimapJammed) HUD.setMinimapJammed(false);
                if (HUD.setCompassJammed) HUD.setCompassJammed(false);
              }
            }
            if (etResult && etResult.fleeing && e.mesh) {
              e.mesh.position.x = e.x;
              e.mesh.position.z = e.z;
            }
            break;
          case 'ASSAULT_MECH':
            etResult = EnemyTypes.updateAssaultMech ? EnemyTypes.updateAssaultMech(e, playerPos, delta) : null;
            if (etResult) {
              if (etResult.mg && onPlayerHit) {
                var mechHitChance = e.typeCfg.accuracy * (1 - distToPlayer / (e.typeCfg.range * 1.5));
                if (Math.random() < mechHitChance) onPlayerHit(etResult.mgDamage, e.mesh.position);
                if (typeof AudioSystem !== 'undefined') {
                  if (AudioSystem.playSpatialGunshot) {
                    var mechYaw = (typeof CameraSystem !== 'undefined' && CameraSystem.getYaw) ? CameraSystem.getYaw() : 0;
                    AudioSystem.playSpatialGunshot('hmg', e.mesh.position, playerPos, mechYaw);
                  } else AudioSystem.playGunshot('hmg');
                }
              }
              if (etResult.rockets) {
                for (var ri = 0; ri < etResult.count; ri++) {
                  if (typeof Tracers !== 'undefined' && Tracers.spawnExplosion) {
                    var rTarget = _tmpVec3d.set(
                      playerPos.x + (Math.random() - 0.5) * 6,
                      playerPos.y,
                      playerPos.z + (Math.random() - 0.5) * 6
                    );
                    Tracers.spawnExplosion(rTarget, 1.5);
                  }
                }
                if (typeof AudioSystem !== 'undefined') AudioSystem.playExplosion();
                if (onPlayerHit && distToPlayer < 8) onPlayerHit(etResult.rocketDamage, e.mesh.position);
              }
              // Show boss bar for mech
              if (typeof HUD !== 'undefined' && HUD.showBossBar) HUD.showBossBar('ASSAULT WALKER', e.hp, e.maxHp);
            }
            break;
          case 'SWARM_OP':
            etResult = EnemyTypes.updateSwarmOp ? EnemyTypes.updateSwarmOp(e, playerPos, delta) : null;
            if (etResult && etResult.launchSwarm) {
              // Spawn enemy drones as the swarm
              if (typeof DroneSystem !== 'undefined' && DroneSystem.spawnEnemyDrone) {
                for (var si = 0; si < etResult.count; si++) {
                  DroneSystem.spawnEnemyDrone(
                    e.mesh.position.x + (Math.random() - 0.5) * 3,
                    e.mesh.position.y + 4 + Math.random() * 3,
                    e.mesh.position.z + (Math.random() - 0.5) * 3,
                    'enemy_fpv'
                  );
                }
              }
              if (typeof AudioSystem !== 'undefined' && AudioSystem.playEnemyBark) AudioSystem.playEnemyBark();
            }
            break;
        }
        // Sync position writes back to mesh
        e.mesh.position.x = e.x; e.mesh.position.y = e.y; e.mesh.position.z = e.z;
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

    // Wave complete? (alive counter tracks living enemies; null entries are cleaned corpses)
    if (spawnQueue.length === 0 && alive === 0 && !allDead) {
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
      if (!e || !e.alive || e === medic || e.groupId !== medic.groupId) continue;
      if (e.hp < e.maxHp * 0.6) {
        const d = medic.mesh.position.distanceTo(e.mesh.position);
        if (d < wDist) { wDist = d; wounded = e; }
      }
    }
    if (!wounded) return false;

    // Move toward wounded
    if (wDist > 1.5) {
      _tmpVec3e.subVectors(wounded.mesh.position, medic.mesh.position).setY(0).normalize();
      medic.mesh.position.addScaledVector(_tmpVec3e, medic.speed * 1.2 * delta);
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
      // Count alive members (reuse buffer to avoid per-frame alloc)
      _aliveMembersBuf.length = 0;
      for (var mi = 0; mi < grp.members.length; mi++) {
        var idx = grp.members[mi];
        if (enemies[idx] && enemies[idx].alive) _aliveMembersBuf.push(idx);
      }
      var aliveMembers = _aliveMembersBuf;
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
            // AI Smart Learning: ML-guided retreat threshold
            var retreatMoraleThreshold = 40;
            if (_aiStrategy) {
              retreatMoraleThreshold = Math.max(10, 40 * (1 - _aiStrategy.overallAggression * 0.5));
            }
            grp.state = grp.morale < retreatMoraleThreshold ? GROUP_STATE.RETREATING : GROUP_STATE.REGROUPING;
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
            // AI Smart Learning: set objective toward predicted player position
            var oAngle, oDist;
            if (_aiStrategy && _aiStrategy.adaptationLevel >= 1 && typeof MLSystem !== 'undefined' && MLSystem.predictPlayerPosition) {
              var predicted = MLSystem.predictPlayerPosition(5.0);
              if (predicted) {
                oAngle = Math.atan2(predicted.z, predicted.x) + (Math.random() - 0.5) * 0.8;
                oDist = Math.sqrt(predicted.x * predicted.x + predicted.z * predicted.z) * 0.6;
                oDist = Math.max(6, Math.min(20, oDist));
              } else {
                oAngle = Math.random() * Math.PI * 2;
                oDist = 6 + Math.random() * 14;
              }
            } else {
              oAngle = Math.random() * Math.PI * 2;
              oDist = 6 + Math.random() * 14;
            }
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
  function damage(enemy, amount, isHeadshot) {
    if (!enemy.alive) return 0;

    // Shield bearer: route damage through EnemyTypes shield check
    if (typeof EnemyTypes !== 'undefined' && enemy.typeCfg && enemy.typeCfg.name === 'SHIELD_BEARER') {
      var fromAngle = 0;
      if (_playerPos) {
        fromAngle = Math.atan2(_playerPos.x - enemy.mesh.position.x, _playerPos.z - enemy.mesh.position.z);
      }
      amount = EnemyTypes.applyDamage(enemy, amount, fromAngle);
      if (amount <= 0) {
        enemy.flashTimer = 0.04;
        return enemy.hp;
      }
    }
    // Tank armor: route damage through directional armor reduction
    if (typeof EnemyTypes !== 'undefined' && enemy.typeCfg && enemy.typeCfg.name === 'TANK') {
      var tankAngle = 0;
      if (_playerPos) {
        tankAngle = Math.atan2(_playerPos.x - enemy.mesh.position.x, _playerPos.z - enemy.mesh.position.z);
      }
      amount = EnemyTypes.applyTankArmor(enemy, amount, tankAngle);
    }

    enemy.hp = Math.max(0, enemy.hp - amount);

    // Floating damage number + white flash on hit
    if (enemy.mesh) {
      // 3D damage numbers disabled — Feedback.spawnDamageNumber (CSS DOM) handles this
      // spawnDmgNumber(enemy.mesh.position, amount, !!isHeadshot);

      // White flash on hit — start timer; update() resets colors
      if (enemy.mesh.userData && enemy.mesh.userData.parts) {
        enemy.mesh.userData.parts.forEach(p => {
          if (p.material && p.material.visible !== false && !p.material.transparent) {
            // Cache original color on first hit
            if (p.userData.origColor === undefined) {
              p.userData.origColor = p.material.color.getHex();
            }
            p.material.color.setHex(0xffffff);
          }
        });
      }
    }
    enemy.flashTimer = 0.08;

    // Hit flinch: push enemy backward from damage source
    if (_playerPos && enemy.mesh) {
      _tmpVec3f.subVectors(enemy.mesh.position, _playerPos).setY(0).normalize();
      var flinchDist = amount > 30 ? 0.5 : 0.3;
      enemy.mesh.position.addScaledVector(_tmpVec3f, flinchDist);
      // Heavy hit stagger: pause movement briefly
      if (amount > 30) {
        enemy._staggerTimer = 0.3;
      }
    }

    // Spawn blood voxel particles (shared geometry + materials)
    if (scene && enemy.mesh) {
      var bloodCount = Math.min(8, Math.ceil(amount / 10));
      for (var b = 0; b < bloodCount; b++) {
        var bloodSize = 0.08 + Math.random() * 0.12;
        var bloodMesh = new THREE.Mesh(_bloodGeo, Math.random() < 0.5 ? _bloodMatLight : _bloodMatDark);
        bloodMesh.scale.setScalar(bloodSize);
        bloodMesh.position.copy(enemy.mesh.position);
        bloodMesh.position.y += 0.5 + Math.random() * 1.0;
        scene.add(bloodMesh);
        bloodParticles.push({
          mesh: bloodMesh,
          _origScale: bloodSize,
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
      enemy.deathTimer = 2.0;
      // Death topple: random tilt direction
      var tiltX = (Math.random() > 0.5 ? 1 : -1) * (1.0 + Math.random() * 0.5);
      enemy._deathTiltX = tiltX;
      enemy._deathPopY = 1.5; // brief upward pop velocity
      _cacheFrame = -1; // invalidate cache on death
    }
    return enemy.hp;
  }

  // ── Find enemy by intersected mesh (walk hierarchy) ───────
  function findByMesh(mesh) {
    let obj = mesh;
    while (obj) {
      const found = enemies.find(e => e && e.mesh === obj);
      if (found) return found;
      obj = obj.parent;
    }
    return null;
  }

  function _rebuildCache() {
    var f = performance.now();
    if (f === _cacheFrame) return;
    _cacheFrame = f;
    _cachedAlive.length = 0;
    _cachedMeshes.length = 0;
    for (var ci = 0; ci < enemies.length; ci++) {
      var ce = enemies[ci];
      if (!ce) continue; // null = removed
      if (ce.alive) {
        _cachedAlive.push(ce);
        var pp = ce.mesh.userData.parts;
        if (pp) { for (var pi = 0; pi < pp.length; pi++) _cachedMeshes.push(pp[pi]); }
        else _cachedMeshes.push(ce.mesh);
      }
    }
  }

  function getEnemyMeshes() {
    _rebuildCache();
    return _cachedMeshes;
  }

  function getAliveCount() {
    _rebuildCache();
    return _cachedAlive.length + spawnQueue.length;
  }

  function isWaveDone() { return allDead; }

  function clear() {
    // Clean up blood particles
    bloodParticles.forEach(bp => {
      if (scene) scene.remove(bp.mesh);
    });
    bloodParticles.length = 0;

    // Clean up enemy grenades
    for (var gi = _enemyGrenades.length - 1; gi >= 0; gi--) {
      if (scene) scene.remove(_enemyGrenades[gi].mesh);
    }
    _enemyGrenades.length = 0;

    enemies.forEach(e => {
      if (!e) return; // null = already removed
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
    allDead    = true;   // Prevent premature wave-complete check during startGame→beginWave gap
    assaultGroups.length = 0;
  }

  // ── Area damage (explosions) ────────────────────────────────
  function damageInRadius(pos, radius, amount) {
    const results = [];
    for (const e of enemies) {
      if (!e || !e.alive) continue;
      const dist = e.mesh.position.distanceTo(pos);
      if (dist <= radius) {
        const falloff = 1 - (dist / radius) * 0.5;
        const remaining = damage(e, amount * falloff);
        results.push({ enemy: e, remaining });
      }
    }
    return results;
  }

  function stunInRadius(pos, radius, duration) {
    for (const e of enemies) {
      if (!e || !e.alive) continue;
      const dist = e.mesh.position.distanceTo(pos);
      if (dist <= radius) {
        e._stunTimer = duration * Math.max(0.3, 1 - dist / radius);
        // Flash enemy white to show stun
        e.mesh.userData.parts.forEach(function(p) {
          if (p.material) p.material.color.setHex(0xffffff);
        });
        e.flashTimer = 0.3;
      }
    }
  }

  // ── Get all alive enemies ─────────────────────────────────
  function getAll() { _rebuildCache(); return _cachedAlive; }

  // ── Get assault groups info ───────────────────────────────
  function getAssaultGroups() { return assaultGroups; }

  function getSurrenderCount() {
    return enemies.filter(e => e && e.alive && e.surrendered).length;
  }

  return {
    startWave,
    update,
    damage,
    damageInRadius,
    stunInRadius,
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
