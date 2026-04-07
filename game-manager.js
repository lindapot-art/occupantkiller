/* ───────────────────────────────────────────────────────────────────────
   GAME MANAGER — central orchestrator for all hybrid game systems
   ─────────────────────────────────────────────────────────────────────── */
const GameManager = (function () {
  'use strict';

  /* ── Game States ─────────────────────────────────────────────────── */
  const STATE = Object.freeze({
    MENU:        'menu',
    PLAYING:     'playing',
    PAUSED:      'paused',
    BUILD_MODE:  'buildMode',
    DEAD:        'dead',
    WAVE_CLEAR:  'waveClear',
    STAGE_CLEAR: 'stageClear',
    WIN:         'win',
  });

  /* ── Core State ──────────────────────────────────────────────────── */
  let gameState     = STATE.MENU;
  let _scene        = null;
  let _camera       = null;
  let _renderer     = null;

  // Reusable temp vectors for update loops (avoids per-frame GC)
  var _gmTmp1 = new THREE.Vector3();
  var _gmTmp2 = new THREE.Vector3();
  var _gmTmp3 = new THREE.Vector3();
  var _gmNewPos = new THREE.Vector3();
  var _waveStartTimer = null;
  var _hudSlowTimer = 0; // throttle slow HUD updates (dailies, bounties, prestige)

  /* ── Player State ────────────────────────────────────────────────── */
  const GOD_MODE_HP = 999999;
  const player = {
    position:   new THREE.Vector3(0, 10, 0),
    velocity:   new THREE.Vector3(0, 0, 0),
    hp:         100,
    maxHp:      100,
    score:      0,
    kills:      0,
    onGround:   false,
    sprinting:  false,
    height:     1.7,
    stealth:    false,        // invisibility toggle
    role:       'lonewolf',   // 'brigade' or 'lonewolf'
    godMode: false,       // God Mode: all weapons, invincible, invisible
    prone:      false,        // prone stance for accuracy
    bleeding:   false,        // bleed DOT status
    bleedTimer: 0,            // time remaining on bleed
    killStreak: 0,            // consecutive rapid kills
    streakTimer: 0,           // time since last kill (resets streak)
    dogTags:    0,            // collected dog tags
    airdropCooldown: 0,       // cooldown for airdrop beacon
    stamina:    1.0,          // 0-1, drains on sprint, regens on walk
    nightVision: false,       // night vision toggle
    shieldTimer: 0,           // temporary shield timer
    intelTimer: 0,            // intel reveal timer
    armor:      0,            // armor points (0-100), reduces damage
    lastDamageTime: 0,        // time since last damage (for health regen)
    // ── Loot & Building ──
    lootParticles: [],        // active loot particles in world
    buildMaterials: { wood: 0, stone: 0, metal: 0, dirt: 0, sand: 0, brick: 0 },
    // ── Stats Tracking ──
    totalShots: 0,
    totalHits: 0,
    totalHeadshots: 0,
    totalDamageTaken: 0,
    waveStartTime: 0,
    bestStreak: 0,
    waveKills: 0,
    waveShots: 0,
    waveHits: 0,
    waveHeadshots: 0,
    waveDamageTaken: 0,
    distanceWalked: 0,
    _lastPos: null,
    playStartTime: 0,
    // ── B23: New Gameplay State ──
    xp: 0,
    level: 1,
    grenadeCooked: false,
    grenadeCookTimer: 0,
    _radTimer: 0,
    _geigerTimer: 0,
    executionTarget: null,
    lastKillWeapon: null,
    multikillTimer: 0,
    multikillCount: 0,
    // ── B24: Cover & Crouch ──
    isCrouching: false,
    crouchTimer: 0,        // smooth crouch lerp
    inCover: false,         // near a wall while crouching
    slideTimer: 0,
    slideDir: null,
    _usedLastStand: false,
  };

  /* ── Wave State ──────────────────────────────────────────────────── */
  let currentWave = 0;
  const SCORE_WAVE_BONUS = 500;

  /* ── Stamina Config ──────────────────────────────────────────────── */
  const STAMINA_DRAIN_RATE = 0.15;  // per second while sprinting
  const STAMINA_REGEN_RATE = 0.08;  // per second while not sprinting

  /* ── Battlefield Events ─────────────────────────────────────────── */
  const BATTLE_EVENTS = [
    { id: 'ARTILLERY',     label: '💥 ARTILLERY BARRAGE!',      color: '#ff4444', chance: 0.20 },
    { id: 'SUPPLY_DROP',   label: '📦 SUPPLY DROP INCOMING!',   color: '#44ff88', chance: 0.18 },
    { id: 'MORTAR',        label: '💣 MORTAR STRIKE!',          color: '#ff8800', chance: 0.12 },
    { id: 'REINFORCEMENT', label: '🛡 ALLIED REINFORCEMENTS!',  color: '#4488ff', chance: 0.10 },
    { id: 'AMBUSH',        label: '⚠ ENEMY AMBUSH!',           color: '#ff2222', chance: 0.10 },
    { id: 'SNIPER_DUEL',   label: '🎯 SNIPER DUEL!',           color: '#ffaa00', chance: 0.08 },
    { id: 'ARMOR_PUSH',    label: '🛡 ENEMY ARMOR PUSH!',      color: '#cc0000', chance: 0.07 },
    { id: 'AIR_SUPPORT',   label: '✈ FRIENDLY AIR SUPPORT!',   color: '#00aaff', chance: 0.08 },
    { id: 'DRONE_SWARM',   label: '🤖 ENEMY DRONE SWARM!',     color: '#ff4488', chance: 0.07 },
    { id: 'CHEMICAL',       label: '☣ CHEMICAL ATTACK!',       color: '#aaff00', chance: 0.05 },
    { id: 'EMP',            label: '⚡ EMP BLAST!',             color: '#4400ff', chance: 0.04 },
    { id: 'TUNNEL_BREACH',  label: '🕳 TUNNEL BREACH!',        color: '#884400', chance: 0.06 },
  ];

  function triggerBattlefieldEvent() {
    const roll = Math.random();
    let cumulative = 0;
    let event = null;
    for (const ev of BATTLE_EVENTS) {
      cumulative += ev.chance;
      if (roll < cumulative) { event = ev; break; }
    }
    if (!event) return;

    HUD.notifyPickup(event.label, event.color);

    switch (event.id) {
      case 'ARTILLERY':
        // Damage enemies in a random area
        for (let i = 0; i < 5; i++) {
          const bx = player.position.x + (Math.random() - 0.5) * 30;
          const bz = player.position.z + (Math.random() - 0.5) * 30;
          const bh = VoxelWorld.getTerrainHeight(bx, bz);
          Enemies.damageInRadius(new THREE.Vector3(bx, bh, bz), 5, 40);
        }
        break;
      case 'SUPPLY_DROP':
        // Drop pickups near player
        for (let i = 0; i < 4; i++) {
          const sx = player.position.x + (Math.random() - 0.5) * 12;
          const sz = player.position.z + (Math.random() - 0.5) * 12;
          const sh = VoxelWorld.getTerrainHeight(sx, sz);
          const types = ['HEALTH', 'AMMO', 'ARMOR', 'MEDKIT', 'GRENADE', 'STIM'];
          Pickups.spawn(new THREE.Vector3(sx, sh, sz), types[Math.floor(Math.random() * types.length)]);
        }
        break;
      case 'MORTAR':
        // Single large explosion near enemies
        const all = Enemies.getAll();
        if (all.length > 0) {
          const target = all[Math.floor(Math.random() * all.length)];
          if (target.alive && target.mesh) {
            Enemies.damageInRadius(target.mesh.position, 8, 80);
          }
        }
        break;
      case 'REINFORCEMENT':
        // Spawn extra friendly NPCs
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 4 + Math.random() * 6;
          const nx = player.position.x + Math.cos(angle) * dist;
          const nz = player.position.z + Math.sin(angle) * dist;
          const nh = VoxelWorld.getTerrainHeight(nx, nz);
          NPCSystem.spawn(nx, nh, nz, 'infantry');
        }
        break;
      case 'AMBUSH':
        // Enemy ambush: spawn fast stormers all around the player
        for (let i = 0; i < 6; i++) {
          const aa = (i / 6) * Math.PI * 2;
          const ad = 8 + Math.random() * 4;
          Enemies.spawnSingle('STORMER', new THREE.Vector3(
            player.position.x + Math.cos(aa) * ad, 0,
            player.position.z + Math.sin(aa) * ad
          ));
        }
        break;
      case 'SNIPER_DUEL':
        // Spawn enemy snipers at long range + give player ammo
        for (let i = 0; i < 3; i++) {
          const sa = Math.random() * Math.PI * 2;
          const sd = 18 + Math.random() * 8;
          Enemies.spawnSingle('SNIPER', new THREE.Vector3(
            player.position.x + Math.cos(sa) * sd, 0,
            player.position.z + Math.sin(sa) * sd
          ));
        }
        Weapons.addAmmo(20);
        break;
      case 'ARMOR_PUSH':
        // Spawn armored enemies in formation (full 360° around player)
        for (let i = 0; i < 4; i++) {
          const fa = Math.random() * Math.PI * 2;
          const fd = 15 + Math.random() * 6;
          Enemies.spawnSingle('ARMORED', new THREE.Vector3(
            player.position.x + Math.cos(fa) * fd, 0,
            player.position.z + Math.sin(fa) * fd
          ));
        }
        break;
      case 'AIR_SUPPORT':
        // Massive damage to enemies in a large area
        const allEnemies = Enemies.getAll();
        for (let i = 0; i < allEnemies.length && i < 10; i++) {
          if (allEnemies[i].alive && allEnemies[i].mesh) {
            Enemies.damageInRadius(allEnemies[i].mesh.position, 6, 60);
          }
        }
        break;
      case 'DRONE_SWARM':
        // Spawn extra drones for the player
        for (let i = 0; i < 2; i++) {
          const dx = player.position.x + (Math.random() - 0.5) * 10;
          const dz = player.position.z + (Math.random() - 0.5) * 10;
          const dh = VoxelWorld.getTerrainHeight(dx, dz) + 8;
          DroneSystem.spawn(dx, dh, dz, i === 0 ? 'fpv_attack' : 'bomb');
        }
        break;
      case 'CHEMICAL':
        // Chemical attack: slow damage to all enemies in area + player warning
        for (let i = 0; i < 8; i++) {
          const cx = player.position.x + (Math.random() - 0.5) * 20;
          const cz = player.position.z + (Math.random() - 0.5) * 20;
          const ch = VoxelWorld.getTerrainHeight(cx, cz);
          Enemies.damageInRadius(new THREE.Vector3(cx, ch, cz), 4, 25);
        }
        // Player takes minor damage if not stealth
        if (!player.stealth) {
          player.hp = Math.max(1, player.hp - 10);
          HUD.setHealth(player.hp, player.maxHp);
        }
        break;
      case 'EMP':
        // EMP: disables enemy drones temporarily, damages drone ops
        Enemies.getAll().forEach(function (e) {
          if (e.typeName === 'DRONE_OP') Enemies.damage(e, 30);
        });
        break;
      case 'TUNNEL_BREACH':
        // Enemies emerge from underground behind the player
        for (let i = 0; i < 4; i++) {
          const ta = Math.PI + (Math.random() - 0.5) * 1.0; // behind player
          const yaw = CameraSystem.getYaw();
          const td = 5 + Math.random() * 5;
          Enemies.spawnSingle('STORMER', new THREE.Vector3(
            player.position.x + Math.cos(yaw + ta) * td, 0,
            player.position.z + Math.sin(yaw + ta) * td
          ));
        }
        break;
    }
  }

  /* ── Loot Particle System (Sonic-style gold rings from terrain) ── */
  const _lootParticles = [];
  const _lootGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
  const _lootMat = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0xaa8800 });
  const LOOT_CONFIG = {
    VALUE: 5,             // gold per loot particle collected
    COLLECT_RANGE: 2.5,   // distance to auto-collect
    LIFETIME: 15,         // seconds before despawn
    MAGNET_RANGE: 5,      // auto-attract within this range
  };

  function spawnLootParticle(worldPos, count) {
    if (!_scene) return;
    for (var i = 0; i < (count || 1); i++) {
      var mesh = new THREE.Mesh(_lootGeo, _lootMat.clone());
      // Scatter slightly from source
      mesh.position.set(
        worldPos.x + (Math.random() - 0.5) * 1.5,
        worldPos.y + 0.5 + Math.random() * 1.0,
        worldPos.z + (Math.random() - 0.5) * 1.5
      );
      mesh.userData.vy = 3 + Math.random() * 2; // bounce up velocity
      mesh.userData.age = 0;
      mesh.userData.baseY = worldPos.y;
      _scene.add(mesh);
      _lootParticles.push(mesh);
    }
  }

  function updateLootParticles(delta) {
    for (var i = _lootParticles.length - 1; i >= 0; i--) {
      var lp = _lootParticles[i];
      lp.userData.age += delta;
      // Gravity + bounce
      lp.userData.vy -= 12 * delta;
      lp.position.y += lp.userData.vy * delta;
      var groundH = VoxelWorld.getTerrainHeight(lp.position.x, lp.position.z) + 0.15;
      if (lp.position.y < groundH) {
        lp.position.y = groundH;
        lp.userData.vy = Math.abs(lp.userData.vy) * 0.4; // bounce
        if (Math.abs(lp.userData.vy) < 0.5) lp.userData.vy = 0;
      }
      // Spin
      lp.rotation.y += delta * 5;
      // Magnet toward player
      var dist = lp.position.distanceTo(player.position);
      if (dist < LOOT_CONFIG.MAGNET_RANGE) {
        var pullDir = _gmTmp1.copy(player.position).sub(lp.position).normalize();
        var pullSpeed = (1 - dist / LOOT_CONFIG.MAGNET_RANGE) * 12;
        lp.position.addScaledVector(pullDir, pullSpeed * delta);
      }
      // Collect
      if (dist < LOOT_CONFIG.COLLECT_RANGE) {
        Economy.addCurrency(LOOT_CONFIG.VALUE);
        player.score += LOOT_CONFIG.VALUE;
        HUD.setScore(player.score);
        if (HUD.addCombatLog) HUD.addCombatLog('+' + LOOT_CONFIG.VALUE + ' gold (loot)', '#ffd700');
        _scene.remove(lp);
        lp.geometry.dispose();
        lp.material.dispose();
        _lootParticles.splice(i, 1);
        AudioSystem.playPickup();
        continue;
      }
      // Blink before despawning (last 3 seconds)
      if (lp.userData.age > LOOT_CONFIG.LIFETIME - 3) {
        lp.visible = Math.floor(lp.userData.age * 6) % 2 === 0;
      }
      // Despawn after lifetime
      if (lp.userData.age > LOOT_CONFIG.LIFETIME) {
        _scene.remove(lp);
        lp.geometry.dispose();
        lp.material.dispose();
        _lootParticles.splice(i, 1);
      }
    }
  }

  /* ── Block-to-Material Mapping (Minecraft style) ────────────────── */
  function blockToMaterialName(blockType) {
    var B = VoxelWorld.BLOCK;
    if (blockType === B.WOOD || blockType === B.LOG) return 'wood';
    if (blockType === B.STONE || blockType === B.REINFORCED) return 'stone';
    if (blockType === B.METAL || blockType === B.ELECTRONICS) return 'metal';
    if (blockType === B.DIRT || blockType === B.GRASS) return 'dirt';
    if (blockType === B.SAND || blockType === B.SANDBAG) return 'sand';
    if (blockType === B.BRICK || blockType === B.CONCRETE || blockType === B.ASPHALT) return 'brick';
    return 'dirt'; // fallback
  }

  function blockToEconomyResource(blockType) {
    var B = VoxelWorld.BLOCK;
    if (blockType === B.WOOD || blockType === B.LOG) return 'wood';
    if (blockType === B.STONE || blockType === B.REINFORCED) return 'stone';
    if (blockType === B.METAL || blockType === B.ELECTRONICS) return 'metal';
    return null; // non-resource blocks just give gold loot
  }

  /* ── Terrain Destruction Loot Handler ───────────────────────────── */
  function onTerrainDestroyed(x, y, z, blockType) {
    if (!blockType || blockType === 0) return; // AIR, skip
    var worldPos = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
    // Spawn terrain impact particle debris
    if (typeof Tracers !== 'undefined' && Tracers.spawnBlockImpact) {
      var BLOCK_COLORS = (typeof VoxelWorld !== 'undefined' && VoxelWorld.BLOCK_COLORS) ? (VoxelWorld.BLOCK_COLORS[blockType] || 0x8B7355) : 0x8B7355;
      Tracers.spawnBlockImpact(worldPos, BLOCK_COLORS);
    }
    // 5% chance to spawn 1-2 gold loot particles
    if (Math.random() < 0.05) {
      spawnLootParticle(worldPos, 1 + Math.floor(Math.random() * 2));
    }
  }

  /* ── Shovel Mining Handler (gives materials like Minecraft) ─────── */
  function onShovelMine(x, y, z, blockType) {
    if (!blockType || blockType === 0) return;
    var matName = blockToMaterialName(blockType);
    var ecoRes = blockToEconomyResource(blockType);
    if (ecoRes) {
      // Give actual building resource
      Economy.add(ecoRes, 1);
      player.buildMaterials[matName] = (player.buildMaterials[matName] || 0) + 1;
      if (HUD.addCombatLog) HUD.addCombatLog('+1 ' + ecoRes + ' (mined)', '#8B6914');
      HUD.notifyPickup('⛏ +1 ' + ecoRes.toUpperCase(), '#8B6914');
    } else {
      // Non-resource block: give gold loot instead
      player.buildMaterials[matName] = (player.buildMaterials[matName] || 0) + 1;
      var worldPos = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
      spawnLootParticle(worldPos, 1);
      if (HUD.addCombatLog) HUD.addCombatLog('+1 ' + matName + ' (mined)', '#888');
    }
  }

  /* ── Stage Definitions ──────────────────────────────────────────── */
  const STAGES = [
    {
      id:           1,
      name:         'HOSTOMEL AIRPORT',
      theme:        'grassland',
      wavesPerStage: 7,
      difficulty:   0.8,
      fogColor:     0x4a5a3a,
      bgColor:      0x4a5a3a,
      sunColor:     0xff8833,
      sunIntensity: 0.85,
      description:  'Stop the airborne assault at Hostomel Airport.',
    },
    {
      id:           2,
      name:         'AVDIIVKA SECTOR',
      theme:        'urban',
      wavesPerStage: 7,
      difficulty:   1.0,
      fogColor:     0x3a3028,
      bgColor:      0x3a3028,
      sunColor:     0xccccdd,
      sunIntensity: 0.7,
      description:  'Industrial ruins of Avdiivka. Defend the coking plant.',
    },
    {
      id:           3,
      name:         'BAKHMUT RUINS',
      theme:        'urban',
      wavesPerStage: 7,
      difficulty:   1.4,
      fogColor:     0x2a2a2a,
      bgColor:      0x2a2a2a,
      sunColor:     0xccccdd,
      sunIntensity: 0.65,
      description:  'Total destruction in Bakhmut. The city is a graveyard.',
    },
    {
      id:           4,
      name:         'KHERSON CROSSING',
      theme:        'grassland',
      wavesPerStage: 7,
      difficulty:   1.8,
      fogColor:     0x4a5a3a,
      bgColor:      0x4a5a3a,
      sunColor:     0xffcc55,
      sunIntensity: 0.9,
      description:  'Cross the Dnipro at Kherson. Liberate the bridgehead.',
    },
    {
      id:           5,
      name:         'MARIUPOL STEELWORKS',
      theme:        'industrial',
      wavesPerStage: 7,
      difficulty:   2.2,
      fogColor:     0x1a1a20,
      bgColor:      0x1a1a20,
      sunColor:     0xff6622,
      sunIntensity: 0.5,
      description:  'Fight through the burning Azovstal steelworks. No retreat.',
    },
    {
      id:           6,
      name:         'CRIMEA BRIDGE',
      theme:        'coastal',
      wavesPerStage: 7,
      difficulty:   2.5,
      fogColor:     0x5577aa,
      bgColor:      0x5577aa,
      sunColor:     0xffddaa,
      sunIntensity: 0.95,
      description:  'Assault the Kerch Strait bridge. Cut off their supply line.',
    },
    {
      id:           7,
      name:         'CHORNOBYL ZONE',
      theme:        'wasteland',
      wavesPerStage: 7,
      difficulty:   2.8,
      fogColor:     0x3a3520,
      bgColor:      0x3a3520,
      sunColor:     0xaacc44,
      sunIntensity: 0.55,
      description:  'The irradiated exclusion zone. Radiation adds periodic damage.',
    },
    {
      id:           8,
      name:         'MOSCOW FINALE',
      theme:        'cityscape',
      wavesPerStage: 9,
      difficulty:   3.5,
      fogColor:     0x222228,
      bgColor:      0x222228,
      sunColor:     0xeeeeff,
      sunIntensity: 0.4,
      description:  'The final push to the Kremlin. End it here.',
    },
    {
      id:           9,
      name:         'SEVASTOPOL NAVAL BASE',
      theme:        'coastal',
      wavesPerStage: 7,
      difficulty:   3.8,
      fogColor:     0x3355aa,
      bgColor:      0x3355aa,
      sunColor:     0xddccaa,
      sunIntensity: 0.85,
      description:  'Destroy the Black Sea Fleet at Sevastopol. Sink them all.',
    },
    {
      id:           10,
      name:         'DONBAS FINAL PUSH',
      theme:        'urban',
      wavesPerStage: 8,
      difficulty:   4.2,
      fogColor:     0x2a2020,
      bgColor:      0x2a2020,
      sunColor:     0xdd6633,
      sunIntensity: 0.6,
      description:  'Liberate the last occupied stronghold in Donbas.',
    },
    {
      id:           11,
      name:         'BELGOROD OFFENSIVE',
      theme:        'grassland',
      wavesPerStage: 8,
      difficulty:   4.6,
      fogColor:     0x3a4a2a,
      bgColor:      0x3a4a2a,
      sunColor:     0xffaa44,
      sunIntensity: 0.75,
      description:  'Cross into enemy territory. Take the fight to them.',
    },
    {
      id:           12,
      name:         'KREMLIN SHOWDOWN',
      theme:        'cityscape',
      wavesPerStage: 10,
      difficulty:   5.0,
      fogColor:     0x111118,
      bgColor:      0x111118,
      sunColor:     0xff3322,
      sunIntensity: 0.3,
      description:  'The ultimate battle for peace. Storm the Kremlin. End the war.',
    },
  ];

  let currentStage = 0;  // 0-based index into STAGES

  /* ── Physics Constants ───────────────────────────────────────────── */
  const MOVE_SPEED   = 6.0;
  const SPRINT_MULT  = 1.65;
  const GRAVITY      = 18;
  const JUMP_SPEED   = 7.0;

  /* ── Mobile Detection ──────────────────────────────────────────── */
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
                   ('ontouchstart' in window && window.innerWidth < 1200);

  /* ── Input State ─────────────────────────────────────────────────── */
  const keys = {};
  let mouseDown = false;
  let mouseNewPress = false;

  /* ── Touch State ─────────────────────────────────────────────────── */
  const touch = {
    moveX: 0, moveY: 0,
    lookX: 0, lookY: 0,
    firing: false,
    jumping: false,
    reloading: false,
    sprinting: false,
    moveActive: false,
    lookActive: false,
    moveTouchId: null,
    lookTouchId: null,
    moveStartX: 0, moveStartY: 0,
  };

  /* ── Lighting References ─────────────────────────────────────────── */
  let sunLight  = null;
  var _skyDome = null;
  let ambLight  = null;
  let hemiLight = null;

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    // Create renderer
    _renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    _renderer.setSize(window.innerWidth, window.innerHeight);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('game-container').appendChild(_renderer.domElement);

    // Create scene — Ukrainian theme (golden sky)
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0xFFD700);
    _scene.fog = new THREE.Fog(0xFFD700, 14, 80);

    // Create camera
    _camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    // Lighting — Ukrainian theme
    ambLight = new THREE.AmbientLight(0x888866, 0.8);
    _scene.add(ambLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(20, 30, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left   = -50;
    sunLight.shadow.camera.right  =  50;
    sunLight.shadow.camera.top    =  50;
    sunLight.shadow.camera.bottom = -50;
    _scene.add(sunLight);

    hemiLight = new THREE.HemisphereLight(0xFFD700, 0x0057B8, 0.6);
    _scene.add(hemiLight);

    // Gradient sky dome (hemisphere)
    (function createSkyDome() {
      var skyGeo = new THREE.SphereGeometry(180, 24, 16);
      var skyVertices = skyGeo.attributes.position;
      var skyColors = new Float32Array(skyVertices.count * 3);
      for (var si = 0; si < skyVertices.count; si++) {
        var y = skyVertices.getY(si);
        var t = Math.max(0, Math.min(1, (y + 180) / 360)); // 0 = bottom, 1 = top
        // Warm top → cool horizon → dark bottom
        var r = 0.35 + t * 0.45;
        var g = 0.45 + t * 0.35;
        var b = 0.55 + t * 0.15;
        skyColors[si * 3] = r;
        skyColors[si * 3 + 1] = g;
        skyColors[si * 3 + 2] = b;
      }
      skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
      var skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false });
      _skyDome = new THREE.Mesh(skyGeo, skyMat);
      _scene.add(_skyDome);
    })();

    // ── Init all sub-systems ─────────────────────────────────
    CameraSystem.init(_camera);
    VoxelWorld.init(_scene);

    TimeSystem.init(_scene, sunLight, ambLight, hemiLight);
    Building.init(_scene);
    NPCSystem.init(_scene);
    DroneSystem.init(_scene, _camera);
    VehicleSystem.init(_scene);
    Economy.init();
    SkillSystem.init();
    RankSystem.init();
    MissionSystem.init();
    Automation.init();
    Pickups.init(_scene);

    // Tracers system
    if (typeof Tracers !== 'undefined') Tracers.init(_scene);

    // Audio, Weather & ML systems
    AudioSystem.init();
    WeatherSystem.init(_scene, _camera);
    MLSystem.init();
    if (typeof StageVFX !== 'undefined') StageVFX.init(_scene);

    // ── New feature systems init ──────────────────────────
    if (typeof CombatExtras !== 'undefined') CombatExtras.reset();
    if (typeof Traversal !== 'undefined') Traversal.reset();
    if (typeof EnemyTypes !== 'undefined') EnemyTypes.init();
    if (typeof WorldFeatures !== 'undefined') WorldFeatures.init(_scene, THREE);
    if (typeof Perks !== 'undefined') Perks.reset();
    if (typeof MissionTypes !== 'undefined') MissionTypes.clear();
    if (typeof Feedback !== 'undefined') Feedback.init();
    if (typeof Progression !== 'undefined') Progression.init();

    // Create weapons
    Weapons.createGunMesh(_camera);
    Weapons.createMuzzleFlash(_scene, _camera);

    // Wire terrain destruction callbacks for loot & mining
    Weapons.setOnTerrainDig(function (x, y, z, blockType) {
      onShovelMine(x, y, z, blockType);
    });
    Weapons.setOnTerrainShot(function (x, y, z, blockType) {
      onTerrainDestroyed(x, y, z, blockType);
      // ── B29: Destructible environment — explosive weapons destroy blocks ──
      var wType = Weapons.getCurrentType();
      var isExpl = ['AT', 'ATGM', 'AT_HEAVY', 'AT_LIGHT', 'GRENADE', 'INCENDIARY', 'THERMOBARIC'].indexOf(wType) >= 0;
      if (isExpl && typeof WorldFeatures !== 'undefined' && WorldFeatures.applyExplosionDamage) {
        var bRadius = Weapons.getBlastRadius() || 3;
        WorldFeatures.applyExplosionDamage(x, y, z, bRadius, 100);
      }
    });

    // Time system callbacks
    TimeSystem.onWeekChange(function () {
      Economy.weeklyUpdate();
    });
    TimeSystem.onPhaseChange(function (phase) {
      HUD.notifyPickup(phase === 'night' ? '🌙 NIGHT FALLS' : '☀️ DAY BREAKS', '#FFCC00');
    });

    // Mission completion callback — with replenishment
    MissionSystem.onMissionComplete(function (mission, reward) {
      HUD.notifyPickup('MISSION COMPLETE: ' + mission.name + ' +' + (reward || 0), '#00FF88');
      // Replenish: generate a new mission after 10s
      setTimeout(function () {
        if (gameState === STATE.PLAYING) {
          MissionSystem.generateRandom();
          var active = MissionSystem.getActive();
          if (active && active.length > 0) {
            HUD.notifyPickup('📋 NEW MISSION: ' + active[active.length - 1].name, '#ffcc00');
          }
        }
      }, 10000);
    });

    // Set player spawn on terrain
    const spawnH = VoxelWorld.getTerrainHeight(0, 0);
    player.position.set(0, spawnH + player.height, 0);

    // Spawn initial NPCs
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const dist = 5 + Math.random() * 5;
      const nx = Math.cos(angle) * dist;
      const nz = Math.sin(angle) * dist;
      const nh = VoxelWorld.getTerrainHeight(nx, nz);
      NPCSystem.spawn(nx, nh, nz, i < 2 ? 'civilian' : 'trainee');
    }

    // Spawn starter vehicle fleet on roads (road-level positions)
    var roadWPs = (VoxelWorld.getRoadWaypoints ? VoxelWorld.getRoadWaypoints() : []);
    var _rp0 = roadWPs.length > 2 ? roadWPs[2] : new THREE.Vector3(8, 0, 20);
    var _rp1 = roadWPs.length > 6 ? roadWPs[6] : new THREE.Vector3(12, 0, 20);
    var _rp2 = roadWPs.length > 10 ? roadWPs[10] : new THREE.Vector3(-8, 0, 20);
    var vh = VoxelWorld.getTerrainHeight(_rp0.x, _rp0.z);
    VehicleSystem.spawn(_rp0.x, vh, _rp0.z, 'transport');
    var startVh2 = VoxelWorld.getTerrainHeight(_rp1.x, _rp1.z);
    VehicleSystem.spawn(_rp1.x, startVh2, _rp1.z, 'combat');
    var startVh3 = VoxelWorld.getTerrainHeight(_rp2.x, _rp2.z);
    VehicleSystem.spawn(_rp2.x, startVh3, _rp2.z, 'turret_rover');

    // Spawn starter drones
    const startDh1 = VoxelWorld.getTerrainHeight(5, 5) + 8;
    DroneSystem.spawn(5, startDh1, 5, 'recon');
    const startDh2 = VoxelWorld.getTerrainHeight(-5, 5) + 8;
    DroneSystem.spawn(-5, startDh2, 5, 'fpv_attack');
    const startDh3 = VoxelWorld.getTerrainHeight(0, -10) + 10;
    DroneSystem.spawn(0, startDh3, -10, 'bomb');

    // Input setup
    setupInput();

    // Mobile controls
    if (isMobile) {
      document.getElementById('mobile-controls').style.display = 'block';
      setupMobileControls();
    }

    // Handle resize
    window.addEventListener('resize', onResize);

    return { scene: _scene, camera: _camera, renderer: _renderer };
  }

  /* ── Input ───────────────────────────────────────────────────────── */
  var _skipNextEsc = false;

  // Detect fullscreen exit to prevent ESC from also toggling pause
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) _skipNextEsc = true;
  });
  document.addEventListener('webkitfullscreenchange', function () {
    if (!document.webkitFullscreenElement) _skipNextEsc = true;
  });

  function setupInput() {
    document.addEventListener('keydown', function (e) {
      keys[e.code] = true;

      if (gameState === STATE.PLAYING || gameState === STATE.BUILD_MODE) {
        // Speed controls (only in build mode, since 4-7 are weapons in play mode)
        if (gameState === STATE.BUILD_MODE) {
          if (e.code === 'Digit4') TimeSystem.setSpeed(1);
          if (e.code === 'Digit5') TimeSystem.setSpeed(2);
          if (e.code === 'Digit6') TimeSystem.setSpeed(5);
          if (e.code === 'Digit7') TimeSystem.setSpeed(10);
        }
        // KeyP reserved for perks menu in PLAYING state (see below)

        // Camera mode toggle
        if (e.code === 'KeyV') CameraSystem.cycleMode();

        // Build mode
        if (e.code === 'KeyB') {
          if (gameState === STATE.BUILD_MODE) {
            gameState = STATE.PLAYING;
            Building.setBuildMode(false);
            Building.cancelTemplate();
            document.getElementById('build-hud').style.display = 'none';
          } else if (!player.sprinting) {
            gameState = STATE.BUILD_MODE;
            Building.setBuildMode(true);
            document.getElementById('build-hud').style.display = 'block';
          }
        }

        // F key priority chain: 1) drone release  2) mission interact  3) drone possess  4) quick melee
        if (e.code === 'KeyF') {
          var fHandled = false;
          // Priority 1: release drone if possessing
          if (DroneSystem.isPossessing()) {
            DroneSystem.release();
            fHandled = true;
          }
          // Priority 2: mission zone interaction
          if (!fHandled && typeof MissionTypes !== 'undefined' && MissionTypes.getActive && MissionTypes.getActive()) {
            var mt = MissionTypes.getActive();
            if (mt && mt.config) {
            var mtDx = player.position.x - (mt.zoneX || 0);
            var mtDz = player.position.z - (mt.zoneZ || 0);
            if (mtDx * mtDx + mtDz * mtDz < 64) {
              if (mt.config.id === 'DEMOLITION') {
                MissionTypes.interact('PLANT_CHARGE', { dt: 0.5 });
                HUD.notifyPickup('\ud83d\udca3 PLANTING CHARGE...', '#ff8800');
                fHandled = true;
              } else if (mt.config.id === 'RESCUE') {
                MissionTypes.interact('FREE_POW', { dt: 0.5 });
                HUD.notifyPickup('\ud83d\udd13 FREEING POW...', '#88ff88');
                fHandled = true;
              } else if (mt.config.id === 'DEFUSE') {
                MissionTypes.interact('DEFUSE_BOMB', { dt: 0.5 });
                HUD.notifyPickup('\u23f1\ufe0f DEFUSING...', '#ffcc00');
                fHandled = true;
              }
            }
            } // end mt && mt.config
          }
          // Priority 3: possess nearest drone
          if (!fHandled) {
            const drones = DroneSystem.getAll();
            if (drones.length > 0) {
              DroneSystem.possess(drones[0].id);
              fHandled = true;
            }
          }
          // Priority 4: quick melee
          if (!fHandled && typeof CombatExtras !== 'undefined') {
            var qm = CombatExtras.tryQuickMelee();
            if (qm) {
              var enemies = Enemies.getAll();
              for (var qi = 0; qi < enemies.length; qi++) {
                var qe = enemies[qi];
                if (!qe.alive || !qe.mesh) continue;
                var qdx = qe.mesh.position.x - player.position.x;
                var qdz = qe.mesh.position.z - player.position.z;
                if (qdx * qdx + qdz * qdz < qm.range * qm.range) {
                  Enemies.damage(qe, qm.damage);
                  break;
                }
              }
            }
          }
        }

        // Vehicle enter/exit/hijack
        if (e.code === 'KeyG') {
          if (VehicleSystem.isHijacking()) {
            // Cancel hijack if pressing G again during hijack
            VehicleSystem.cancelHijack();
            HUD.notifyPickup('❌ HIJACK CANCELLED', '#ff4444');
          } else if (VehicleSystem.isInVehicle()) {
            const exitPos = VehicleSystem.exit();
            if (exitPos) {
              player.position.copy(exitPos);
              player.position.y += player.height;
            }
          } else {
            const nearby = VehicleSystem.getNearby(player.position, 5);
            if (nearby.length > 0) {
              const targetVehicle = nearby[0];
              if (targetVehicle.faction === 'enemy') {
                // Start animated hijack of enemy vehicle
                VehicleSystem.startHijack(targetVehicle.id);
                HUD.notifyPickup('🚗 HIJACKING… Hold steady!', '#ff4444');
              } else if (targetVehicle.occupied) {
                // Commandeer friendly vehicle (faster)
                VehicleSystem.startHijack(targetVehicle.id);
                HUD.notifyPickup('🚗 COMMANDEERING…', '#ffaa00');
              } else {
                VehicleSystem.enter(targetVehicle.id);
                HUD.notifyPickup('🚗 ENTERED VEHICLE', '#44ff44');
              }
            }
          }
        }

        // Toggle vehicle camera view (first person / third person)
        if (e.code === 'KeyT' && VehicleSystem.isInVehicle()) {
          VehicleSystem.toggleVehicleView();
          var veh = VehicleSystem.getOccupied();
          HUD.notifyPickup(veh && veh.viewMode === 'first' ? '👁 FIRST PERSON VIEW' : '🎥 THIRD PERSON VIEW', '#00ccff');
        }

        // Stealth / invisibility toggle (moved to Backquote)
        if (e.code === 'Backquote') {
          toggleStealth();
        }

        // Inventory toggle (I key)
        if (e.code === 'KeyI') {
          toggleInventory();
        }

        // Prone toggle
        if (e.code === 'KeyZ') {
          player.prone = !player.prone;
          player.isCrouching = false; // stand if going prone
          player.height = player.prone ? 0.6 : 1.7;
          if (HUD.showProne) HUD.showProne(player.prone);
          HUD.notifyPickup(player.prone ? '🔽 PRONE' : '🔼 STANDING', player.prone ? '#888' : '#fff');
        }

        // Bandage (stop bleeding)
        if (e.code === 'KeyX') {
          if (player.bleeding) {
            player.bleeding = false;
            player.bleedTimer = 0;
            if (HUD.showBleed) HUD.showBleed(false);
            HUD.notifyPickup('🩹 BANDAGE APPLIED', '#22ff55');
          }
        }

        // Airdrop beacon
        if (e.code === 'KeyN' && player.airdropCooldown <= 0) {
          player.airdropCooldown = 45; // 45 second cooldown
          HUD.notifyPickup('📦 AIRDROP BEACON DEPLOYED!', '#44ff88');
          setTimeout(function () {
            // Drop 6 pickups near player after 3s delay
            for (var ai = 0; ai < 6; ai++) {
              var ax = player.position.x + (Math.random() - 0.5) * 10;
              var az = player.position.z + (Math.random() - 0.5) * 10;
              var ah = VoxelWorld.getTerrainHeight(ax, az);
              var types = ['HEALTH', 'AMMO', 'ARMOR', 'MEDKIT', 'GRENADE', 'STIM'];
              Pickups.spawn(new THREE.Vector3(ax, ah, az), types[Math.floor(Math.random() * types.length)]);
            }
            AudioSystem.playExplosion();
            HUD.notifyPickup('📦 AIRDROP ARRIVED!', '#44ff88');
          }, 3000);
        }

        // Clear weapon jam
        if (e.code === 'KeyR' && Weapons.isJammed && Weapons.isJammed()) {
          Weapons.clearJam();
          AudioSystem.playReload();
          HUD.notifyPickup('🔧 JAM CLEARED!', '#ffcc00');
          return; // Don't also trigger reload
        }

        // Music toggle (Comma key)
        if (e.code === 'Comma') {
          if (AudioSystem.isMusicPlaying && AudioSystem.isMusicPlaying()) {
            AudioSystem.stopMusic();
            HUD.notifyPickup('🔇 MUSIC OFF', '#888888');
          } else {
            AudioSystem.playMusic('battle');
            HUD.notifyPickup('🎵 MUSIC ON', '#00ff88');
          }
        }

        // Night vision toggle
        if (e.code === 'KeyL') {
          player.nightVision = !player.nightVision;
          if (HUD.showNightVision) HUD.showNightVision(player.nightVision);
          HUD.notifyPickup(player.nightVision ? '🔦 NIGHT VISION ON' : '🔦 NIGHT VISION OFF',
            player.nightVision ? '#00ff44' : '#888888');
          // Enhance scene lighting for NV effect
          if (player.nightVision) {
            if (ambLight) ambLight.intensity = 1.8;
            if (_scene.fog) { _scene.fog.near = 80; _scene.fog.far = 200; }
          } else {
            if (ambLight) ambLight.intensity = 0.8;
            if (_scene.fog) { _scene.fog.near = 30; _scene.fog.far = 140; }
          }
        }

        /* ═══ NEW FEATURE KEYBINDS (59 features) ═══ */

        // Tactical lean (Q/E override when not switching weapons in non-build mode)
        if (e.code === 'KeyQ' && !VehicleSystem.isInVehicle() && !DroneSystem.isPossessing() && keys['AltLeft']) {
          if (typeof CombatExtras !== 'undefined') CombatExtras.setLean(-1);
        }
        if (e.code === 'KeyE' && !VehicleSystem.isInVehicle() && !DroneSystem.isPossessing() && keys['AltLeft']) {
          if (typeof CombatExtras !== 'undefined') CombatExtras.setLean(1);
        }

        // Weapon inspect (hold V - only if not in vehicle)
        if (e.code === 'KeyV' && !VehicleSystem.isInVehicle() && keys['ShiftLeft']) {
          if (typeof CombatExtras !== 'undefined') CombatExtras.startInspect();
        }

        // Cycle ammo type (C key)
        if (e.code === 'KeyC') {
          if (typeof CombatExtras !== 'undefined') {
            var ammoInfo = CombatExtras.cycleAmmoType();
            HUD.notifyPickup('🔄 AMMO: ' + ammoInfo.name, '#' + ammoInfo.color.toString(16).padStart(6, '0'));
            var ammoIndicator = document.getElementById('ammo-type-indicator');
            if (ammoIndicator) ammoIndicator.textContent = ammoInfo.name.toUpperCase();
          }
        }

        // Field bandage perk (H key)
        if (e.code === 'KeyH') {
          if (typeof Perks !== 'undefined' && Perks.useBandage()) {
            HUD.notifyPickup('🩹 FIELD BANDAGE APPLIED!', '#22ff55');
          }
        }

        // Killstreak activation (K key - toggles panel)
        if (e.code === 'KeyK') {
          var ksPanel = document.getElementById('killstreak-panel');
          if (ksPanel) {
            ksPanel.style.display = ksPanel.style.display === 'none' ? 'block' : 'none';
          }
        }

        // ── B24: Crouch toggle (Ctrl) ──
        if (e.code === 'ControlLeft' && gameState === STATE.PLAYING) {
          player.isCrouching = !player.isCrouching;
          if (player.isCrouching && keys['ShiftLeft']) {
            // Slide: sprint + crouch = slide
            player.slideTimer = 0.6;
            var fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(_camera.quaternion);
            fwd.y = 0; fwd.normalize();
            player.slideDir = fwd;
            HUD.notifyPickup('🏃 SLIDE', '#00ddff');
          }
        }

        // Ping/mark system (M key)
        if (e.code === 'KeyM' && gameState === STATE.PLAYING) {
          if (typeof Feedback !== 'undefined') {
            var pingPos = player.position.clone();
            var fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(_camera.quaternion);
            pingPos.add(fwd.multiplyScalar(20));
            Feedback.addPing(pingPos.x, pingPos.y, pingPos.z, 'MARK', '#ffff00');
            HUD.notifyPickup('📍 POSITION MARKED', '#ffff00');
          }
        }

        // Perks menu (P key — override time pause in gameplay)
        if (e.code === 'KeyP' && gameState === STATE.PLAYING) {
          var perksMenu = document.getElementById('perks-menu');
          if (perksMenu) {
            if (perksMenu.style.display === 'none' || !perksMenu.style.display) {
              _openPerksMenu();
              perksMenu.style.display = 'block';
            } else {
              perksMenu.style.display = 'none';
            }
          }
        }

        // War journal (Y key)
        if (e.code === 'KeyY') {
          var journalPanel = document.getElementById('journal-panel');
          if (journalPanel) {
            if (journalPanel.style.display === 'none' || !journalPanel.style.display) {
              _openJournal();
              journalPanel.style.display = 'block';
            } else {
              journalPanel.style.display = 'none';
            }
          }
        }

        // (F-key actions consolidated into priority chain above)

        // Bayonet charge (B key while sprinting, only if not in build mode)
        if (e.code === 'KeyB' && player.sprinting && gameState === STATE.PLAYING && typeof CombatExtras !== 'undefined') {
          if (CombatExtras.startBayonetCharge()) {
            HUD.notifyPickup('🔪 BAYONET CHARGE!', '#ff2222');
          }
        }

        // Weapon maintenance (hold R + M)
        if (e.code === 'KeyR' && keys['KeyM'] && typeof CombatExtras !== 'undefined') {
          if (CombatExtras.startMaintenance()) {
            HUD.notifyPickup('🔧 MAINTAINING WEAPON...', '#cccc00');
          }
        }

        // Blind fire toggle (Alt + LMB mode toggle with KeyO)
        if (e.code === 'KeyO' && typeof CombatExtras !== 'undefined') {
          var blindOn = CombatExtras.toggleBlindFire();
          HUD.notifyPickup(blindOn ? '🔫 BLIND FIRE ON' : '🔫 BLIND FIRE OFF', blindOn ? '#bbb' : '#fff');
          var bfInd = document.getElementById('blindfire-indicator');
          if (bfInd) bfInd.style.display = blindOn ? 'block' : 'none';
        }

        // ── B30: Combat Roll (double-tap A/D or Alt+A/D) ──
        if ((e.code === 'KeyA' || e.code === 'KeyD') && keys['AltLeft'] && typeof CombatExtras !== 'undefined' && CombatExtras.tryRoll) {
          var rollDir = new THREE.Vector3();
          var rRight = new THREE.Vector3(Math.cos(CameraSystem.getYaw()), 0, -Math.sin(CameraSystem.getYaw()));
          rollDir.copy(rRight).multiplyScalar(e.code === 'KeyD' ? 1 : -1);
          if (CombatExtras.tryRoll(rollDir)) {
            HUD.notifyPickup('🔄 DODGE ROLL', '#00ccff');
            if (AudioSystem.playRollDodge) AudioSystem.playRollDodge();
          }
        }

        // ── B30: Quick Weapon Swap (double-tap Q) ──
        if (e.code === 'KeyQ' && keys['AltLeft'] && typeof CombatExtras !== 'undefined' && CombatExtras.quickSwap) {
          CombatExtras.quickSwap();
        }

        // ── B30: Grapple Hook (KeyF + Shift) ──
        if (e.code === 'KeyF' && keys['ShiftLeft'] && typeof Traversal !== 'undefined' && Traversal.launchGrapple) {
          var grapDir = new THREE.Vector3(0, 0, -1).applyQuaternion(_camera.quaternion);
          var grapResult = Traversal.launchGrapple(player.position, grapDir, 30, function (bx, by, bz) { return VoxelWorld.getBlock(bx, by, bz); });
          if (grapResult) {
            HUD.notifyPickup('🪝 GRAPPLE!', '#ff8800');
            if (AudioSystem.playGrappleHook) AudioSystem.playGrappleHook();
          }
        }

        // ── B29: Squad Commands (Numpad 1-6) ──
        if (typeof NPCSystem !== 'undefined' && NPCSystem.commandSquad) {
          var squadCmds = { 'Numpad1': 'attack', 'Numpad2': 'defend', 'Numpad3': 'regroup', 'Numpad4': 'flank_left', 'Numpad5': 'flank_right', 'Numpad6': 'hold_fire' };
          if (squadCmds[e.code]) {
            var fGroups = NPCSystem.getFriendlyGroups();
            for (var gi = 0; gi < fGroups.length; gi++) NPCSystem.commandSquad(fGroups[gi].id, squadCmds[e.code]);
            HUD.notifyPickup('📢 SQUAD: ' + squadCmds[e.code].toUpperCase().replace('_', ' '), '#44ddff');
          }
        }

        // ── B29: Build Fortification (Shift+F1..F4) ──
        if (keys['ShiftLeft'] && typeof WorldFeatures !== 'undefined' && WorldFeatures.buildFortification) {
          var fortMap = { 'F1': 'bunker', 'F2': 'barricade', 'F3': 'watchtower', 'F4': 'ammo_cache' };
          if (fortMap[e.code] && gameState === STATE.PLAYING) {
            e.preventDefault();
            var fwd3 = new THREE.Vector3(0, 0, -1).applyQuaternion(_camera.quaternion);
            var fx = player.position.x + fwd3.x * 3;
            var fz = player.position.z + fwd3.z * 3;
            var fy = VoxelWorld.getTerrainHeight(fx, fz);
            WorldFeatures.buildFortification(fortMap[e.code], fx, fy, fz, _scene);
            HUD.notifyPickup('🏗 ' + fortMap[e.code].toUpperCase() + ' BUILT', '#88cc44');
            if (AudioSystem.playFortificationBuild) AudioSystem.playFortificationBuild();
          }
        }

        // ── B32: Vehicle Horn (KeyN while in vehicle) ──
        if (e.code === 'KeyN' && typeof VehicleSystem !== 'undefined' && VehicleSystem.isInVehicle()) {
          var veh = VehicleSystem.getOccupied();
          if (veh && VehicleSystem.honkHorn) VehicleSystem.honkHorn(veh.id);
        }

        // Dolphin dive (Ctrl while sprinting)
        if (e.code === 'ControlLeft' && player.sprinting && typeof Traversal !== 'undefined') {
          var fwdDir = new THREE.Vector3(0, 0, -1).applyQuaternion(_camera.quaternion);
          if (Traversal.tryDolphinDive({ x: fwdDir.x, z: fwdDir.z }, true)) {
            HUD.notifyPickup('💨 DOLPHIN DIVE!', '#00aaff');
          }
        }

        // Landmine placement (KeyU)
        if (e.code === 'KeyU' && typeof WorldFeatures !== 'undefined') {
          var mineY = VoxelWorld.getTerrainHeight(player.position.x, player.position.z);
          if (WorldFeatures.placeMine(player.position.x, mineY, player.position.z, 'player')) {
            HUD.notifyPickup('💣 LANDMINE PLACED!', '#44aa44');
          }
        }

        // Weapon inspect (Home key)
        if (e.code === 'Home' && Weapons.startInspect) Weapons.startInspect();

        // Sandbag quick-deploy (KeyJ + Shift)
        if (e.code === 'KeyJ' && keys['ShiftLeft'] && typeof WorldFeatures !== 'undefined') {
          var fwdSB = new THREE.Vector3(0, 0, -1).applyQuaternion(_camera.quaternion);
          var sbX = player.position.x + fwdSB.x * 2;
          var sbZ = player.position.z + fwdSB.z * 2;
          var sbY = VoxelWorld.getTerrainHeight(sbX, sbZ);
          if (WorldFeatures.startSandbagDeploy(sbX, sbY, sbZ)) {
            HUD.notifyPickup('🏗️ DEPLOYING SANDBAG...', '#c2b280');
          }
        }
        // Marketplace (KeyJ without Shift — opens inventory Shop tab)
        if (e.code === 'KeyJ' && !keys['ShiftLeft']) {
          toggleInventory();
          // Switch to shop tab
          var shopTab = document.querySelector('.inv-tab[data-tab="shop"]');
          if (shopTab) shopTab.click();
        }

        // Inventory/Tab toggle
        if (e.code === 'Tab') {
          e.preventDefault();
          toggleInventory();
        }

        // Weapon switching (1-9 = weapons 0-8, 0 = weapon 9)
        if (e.code === 'Digit1') Weapons.switchTo(0);
        if (e.code === 'Digit2') Weapons.switchTo(1);
        if (e.code === 'Digit3') Weapons.switchTo(2);
        if (e.code === 'Digit4' && gameState === STATE.PLAYING) Weapons.switchTo(3);
        if (e.code === 'Digit5' && gameState === STATE.PLAYING) Weapons.switchTo(4);
        if (e.code === 'Digit6' && gameState === STATE.PLAYING) Weapons.switchTo(5);
        if (e.code === 'Digit7' && gameState === STATE.PLAYING) Weapons.switchTo(6);
        if (e.code === 'Digit8') Weapons.switchTo(7);
        if (e.code === 'Digit9') Weapons.switchTo(8);
        if (e.code === 'Digit0') Weapons.switchTo(9);
        if (e.code === 'KeyQ' && !keys['AltLeft'])   Weapons.switchPrev();
        if (e.code === 'KeyE' && !keys['AltLeft'] && gameState === STATE.PLAYING) Weapons.switchNext();
        if (e.code === 'KeyR' && !(Weapons.isJammed && Weapons.isJammed()) && !keys['KeyM'])   { Weapons.forceReload(); AudioSystem.playReload(); MLSystem.onReload(); MLSystem.trackReload(); }

        // Build mode: template selection
        if (gameState === STATE.BUILD_MODE) {
          const templateKeys = {
            'F1': 'barracks',
            'F2': 'factory',
            'F3': 'turret',
            'F4': 'droneHangar',
            'F5': 'commandCenter',
            'F6': 'wall',
          };
          if (templateKeys[e.code]) {
            e.preventDefault();
            Building.selectTemplate(templateKeys[e.code]);
          }
        }

        // RTS camera keys
        if (CameraSystem.getMode() === CameraSystem.MODE.STRATEGIC) {
          if (e.code === 'ArrowUp'    || e.code === 'KeyW') CameraSystem.setRTSKey('up', true);
          if (e.code === 'ArrowDown'  || e.code === 'KeyS') CameraSystem.setRTSKey('down', true);
          if (e.code === 'ArrowLeft'  || e.code === 'KeyA') CameraSystem.setRTSKey('left', true);
          if (e.code === 'ArrowRight' || e.code === 'KeyD') CameraSystem.setRTSKey('right', true);
        }

        // Drone keys
        if (DroneSystem.isPossessing()) {
          if (e.code === 'KeyW') DroneSystem.setDroneKey('w', true);
          if (e.code === 'KeyS') DroneSystem.setDroneKey('s', true);
          if (e.code === 'KeyA') DroneSystem.setDroneKey('a', true);
          if (e.code === 'KeyD') DroneSystem.setDroneKey('d', true);
          if (e.code === 'Space')    DroneSystem.setDroneKey('up', true);
          if (e.code === 'ShiftLeft') DroneSystem.setDroneKey('down', true);
        }

        // Vehicle keys
        if (VehicleSystem.isInVehicle()) {
          if (e.code === 'KeyW') VehicleSystem.setVehicleKey('w', true);
          if (e.code === 'KeyS') VehicleSystem.setVehicleKey('s', true);
          if (e.code === 'KeyA') VehicleSystem.setVehicleKey('a', true);
          if (e.code === 'KeyD') VehicleSystem.setVehicleKey('d', true);
          if (e.code === 'Space')     VehicleSystem.setVehicleKey('up', true);
          if (e.code === 'ShiftLeft') VehicleSystem.setVehicleKey('down', true);
        }
      }

      // ── B26: FPS display toggle (F10) ──
      if (e.code === 'F10') {
        e.preventDefault();
        if (HUD.toggleFPS) HUD.toggleFPS();
      }
      // ── B26: Settings panel toggle (F9) ──
      if (e.code === 'F9') {
        e.preventDefault();
        if (HUD.toggleSettings) HUD.toggleSettings();
      }

      // Pause toggle — skip if we just exited fullscreen (browser ESC exits fullscreen first)
      if (e.code === 'Escape') {
        if (document.fullscreenElement || document.webkitFullscreenElement || _skipNextEsc) {
          _skipNextEsc = false;
          return; // Let the browser handle fullscreen exit without toggling pause
        }
        if (gameState === STATE.PLAYING || gameState === STATE.BUILD_MODE) {
          gameState = STATE.PAUSED;
          var invOv = document.getElementById('inventory-overlay');
          if (invOv) {
            showInventory();
            invOv.style.display = 'flex';
          }
        } else if (gameState === STATE.PAUSED) {
          gameState = STATE.PLAYING;
          var invOv = document.getElementById('inventory-overlay');
          if (invOv) invOv.style.display = 'none';
          hideOverlays();
          requestPointerLock();
        }
      }
    });

    document.addEventListener('keyup', function (e) {
      keys[e.code] = false;

      // Reset lean on Q/E release
      if ((e.code === 'KeyQ' || e.code === 'KeyE') && typeof CombatExtras !== 'undefined') {
        CombatExtras.setLean(0);
      }

      if (CameraSystem.getMode() === CameraSystem.MODE.STRATEGIC) {
        if (e.code === 'ArrowUp'    || e.code === 'KeyW') CameraSystem.setRTSKey('up', false);
        if (e.code === 'ArrowDown'  || e.code === 'KeyS') CameraSystem.setRTSKey('down', false);
        if (e.code === 'ArrowLeft'  || e.code === 'KeyA') CameraSystem.setRTSKey('left', false);
        if (e.code === 'ArrowRight' || e.code === 'KeyD') CameraSystem.setRTSKey('right', false);
      }
      if (DroneSystem.isPossessing()) {
        if (e.code === 'KeyW') DroneSystem.setDroneKey('w', false);
        if (e.code === 'KeyS') DroneSystem.setDroneKey('s', false);
        if (e.code === 'KeyA') DroneSystem.setDroneKey('a', false);
        if (e.code === 'KeyD') DroneSystem.setDroneKey('d', false);
        if (e.code === 'Space')    DroneSystem.setDroneKey('up', false);
        if (e.code === 'ShiftLeft') DroneSystem.setDroneKey('down', false);
      }
      if (VehicleSystem.isInVehicle()) {
        if (e.code === 'KeyW') VehicleSystem.setVehicleKey('w', false);
        if (e.code === 'KeyS') VehicleSystem.setVehicleKey('s', false);
        if (e.code === 'KeyA') VehicleSystem.setVehicleKey('a', false);
        if (e.code === 'KeyD') VehicleSystem.setVehicleKey('d', false);
        if (e.code === 'Space')     VehicleSystem.setVehicleKey('up', false);
        if (e.code === 'ShiftLeft') VehicleSystem.setVehicleKey('down', false);
      }
    });

    document.addEventListener('mousedown', function (e) {
      // Resume audio context on any user gesture
      AudioSystem.resume();

      if (e.button === 0) {
        // If playing without pointer lock, re-acquire it on click
        if (!isMobile && (gameState === STATE.PLAYING || gameState === STATE.BUILD_MODE)
            && !document.pointerLockElement) {
          requestPointerLock();
          return; // Don't fire on the lock-acquiring click
        }

        mouseDown = true;
        mouseNewPress = true;

        if (gameState === STATE.BUILD_MODE) {
          handleBuildClick();
        }
      }
      if (e.button === 2 && gameState === STATE.BUILD_MODE) {
        // Right-click removes block
        handleBuildRemove();
      }
      if (e.button === 2 && gameState === STATE.PLAYING) {
        // Minecraft-style building: right-click with shovel places a block
        if (Weapons.getCurrentType() === 'MELEE') {
          handleMinecraftPlace();
        } else {
          Weapons.handleRightDown();
        }
      }
    });

    document.addEventListener('mouseup', function (e) {
      if (e.button === 0) { mouseDown = false; mouseNewPress = false; }
      if (e.button === 2) { Weapons.handleRightUp(); }
    });

    document.addEventListener('mousemove', function (e) {
      if (document.pointerLockElement) {
        var stunScale = GameManager._flashbangStun > 0 ? 0.15 : 1;
        CameraSystem.handleMouseMove(e.movementX * stunScale, e.movementY * stunScale);
      }
    });

    document.addEventListener('wheel', function (e) {
      if (gameState === STATE.PLAYING) {
        if (e.deltaY > 0) Weapons.switchNext();
        else if (e.deltaY < 0) Weapons.switchPrev();
      } else {
        CameraSystem.handleWheel(e.deltaY);
      }
    });

    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.addEventListener('pointerlockchange', function () {
      if (!document.pointerLockElement && gameState === STATE.PLAYING) {
        if (!isMobile) {
          gameState = STATE.PAUSED;
          showOverlay('pause');
        }
      }
    });

    /* ── Touch look controls (right half of canvas) ──────────── */
    if (isMobile) {
      const canvas = _renderer.domElement;
      canvas.addEventListener('touchstart', function (e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.clientX < window.innerWidth * 0.4) {
            // Left side — movement handled by joystick zone
          } else if (t.clientX > window.innerWidth * 0.5 && touch.lookTouchId === null) {
            touch.lookTouchId = t.identifier;
            touch.lookActive = true;
            touch._lookPrevX = t.clientX;
            touch._lookPrevY = t.clientY;
          }
        }
      }, { passive: true });
      canvas.addEventListener('touchmove', function (e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === touch.lookTouchId) {
            const dx = t.clientX - touch._lookPrevX;
            const dy = t.clientY - touch._lookPrevY;
            touch.lookX = dx;
            touch.lookY = dy;
            touch._lookPrevX = t.clientX;
            touch._lookPrevY = t.clientY;
          }
        }
      }, { passive: true });
      canvas.addEventListener('touchend', function (e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touch.lookTouchId) {
            touch.lookTouchId = null;
            touch.lookActive = false;
            touch.lookX = 0;
            touch.lookY = 0;
          }
        }
      }, { passive: true });
      canvas.addEventListener('touchcancel', function (e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touch.lookTouchId) {
            touch.lookTouchId = null;
            touch.lookActive = false;
            touch.lookX = 0;
            touch.lookY = 0;
          }
        }
      }, { passive: true });
    }
  }

  /* ── Build interactions ──────────────────────────────────────────── */
  function handleBuildClick() {
    if (Building.getSelectedTemplate()) {
      const ray = VoxelWorld.raycastBlock(_camera, 12);
      if (ray) {
        const p = ray.place;
        const tmpl = Building.getSelectedTemplate();
        if (!tmpl || !tmpl.cost) return;
        const cost = tmpl.cost;
        // Check and deduct resources via Economy (not a copy)
        if (!Economy.hasMultiple(cost)) {
          HUD.notifyPickup('NOT ENOUGH RESOURCES', '#FF4444');
          return;
        }
        if (Building.placeTemplate(p.x, p.y, p.z)) {
          Economy.spendMultiple(cost);
          SkillSystem.onBuild();
          RankSystem.onBuild();
          HUD.notifyPickup('STRUCTURE BUILT!', '#00FF88');
        }
      }
    } else {
      // Free-form block placement
      const ray = VoxelWorld.raycastBlock(_camera, 8);
      if (ray) {
        Building.placeBlock(ray.place.x, ray.place.y, ray.place.z);
      }
    }
  }

  function handleBuildRemove() {
    const ray = VoxelWorld.raycastBlock(_camera, 8);
    if (ray) {
      const blockType = Building.removeBlock(ray.hit.x, ray.hit.y, ray.hit.z);
      if (blockType) {
        // Convert removed block to resource
        const blockToResource = {
          [VoxelWorld.BLOCK.WOOD]:  'wood',
          [VoxelWorld.BLOCK.METAL]: 'metal',
          [VoxelWorld.BLOCK.STONE]: 'stone',
          [VoxelWorld.BLOCK.ELECTRONICS]: 'electronics',
        };
        const res = blockToResource[blockType];
        if (res) {
          Economy.add(res, 1);
          MissionSystem.onResourceGathered(res, 1);
        }
      }
    }
  }

  /* ── Minecraft-style block placement (right-click with shovel) ──── */
  function handleMinecraftPlace() {
    var ray = VoxelWorld.raycastBlock(_camera, 6);
    if (!ray) return;
    var p = ray.place;
    // Determine which material to place based on resources
    // Priority: wood > stone > brick > dirt > sand
    var B = VoxelWorld.BLOCK;
    var placeType = null;
    var resType = null;
    if (Economy.getResources().wood > 0) { placeType = B.WOOD; resType = 'wood'; }
    else if (Economy.getResources().stone > 0) { placeType = B.STONE; resType = 'stone'; }
    else if (Economy.getResources().metal > 0) { placeType = B.METAL; resType = 'metal'; }
    else {
      // Use build materials from mining
      if (player.buildMaterials.wood > 0) { placeType = B.WOOD; player.buildMaterials.wood--; }
      else if (player.buildMaterials.stone > 0) { placeType = B.STONE; player.buildMaterials.stone--; }
      else if (player.buildMaterials.brick > 0) { placeType = B.BRICK; player.buildMaterials.brick--; }
      else if (player.buildMaterials.dirt > 0) { placeType = B.DIRT; player.buildMaterials.dirt--; }
      else if (player.buildMaterials.sand > 0) { placeType = B.SAND; player.buildMaterials.sand--; }
      else if (player.buildMaterials.metal > 0) { placeType = B.METAL; player.buildMaterials.metal--; }
      if (placeType) {
        VoxelWorld.setBlock(p.x, p.y, p.z, placeType);
        HUD.notifyPickup('🧱 BLOCK PLACED', '#8B6914');
        if (HUD.addCombatLog) HUD.addCombatLog('Placed block', '#8B6914');
        return;
      }
      HUD.notifyPickup('No materials! Mine with shovel (LMB)', '#ff4444');
      return;
    }
    // Spend economy resource
    if (resType && Economy.spend(resType, 1)) {
      VoxelWorld.setBlock(p.x, p.y, p.z, placeType);
      HUD.notifyPickup('🧱 BLOCK PLACED (-1 ' + resType + ')', '#8B6914');
      if (HUD.addCombatLog) HUD.addCombatLog('Placed ' + resType + ' block', '#8B6914');
    } else {
      HUD.notifyPickup('No materials! Mine with shovel (LMB)', '#ff4444');
    }
  }

  /* ── Pointer lock helpers ────────────────────────────────────────── */
  function requestPointerLock() {
    if (isMobile) return;   // Touch controls replace pointer lock on mobile
    _renderer.domElement.requestPointerLock();
  }

  /* ── Overlay helpers ─────────────────────────────────────────────── */
  function showOverlay(name) {
    document.querySelectorAll('.overlay').forEach(function (el) { el.style.display = 'none'; });
    var el = document.getElementById('overlay-' + name);
    if (el) el.style.display = 'flex';
  }

  function hideOverlays() {
    document.querySelectorAll('.overlay').forEach(function (el) { el.style.display = 'none'; });
  }

  /* ── Start Game ──────────────────────────────────────────────────── */
  function startGame() {
    try {
    AudioSystem.resume();
    // Start battle music
    if (AudioSystem.playMusic) AudioSystem.playMusic('battle');
    gameState = STATE.PLAYING;
    player.hp = player.maxHp;
    player.score = 0;
    player.kills = 0;
    currentWave = 0;
    currentStage = 0;
    player.velocity.set(0, 0, 0);
    player.armor = 0;
    player.lastDamageTime = 10; // Start high so health regen kicks in immediately at game start
    player.totalShots = 0;
    player.totalHits = 0;
    player.totalHeadshots = 0;
    player.totalDamageTaken = 0;
    player.bestStreak = 0;
    player.waveKills = 0;
    player.waveShots = 0;
    player.waveHits = 0;
    player.waveHeadshots = 0;
    player.waveDamageTaken = 0;
    player.distanceWalked = 0;
    player._lastPos = null;
    player.playStartTime = performance.now();
    player.buildMaterials = { wood: 0, stone: 0, metal: 0, dirt: 0, sand: 0, brick: 0 };
    // Clear loot particles (shared _lootGeo — only dispose cloned materials)
    for (var li = _lootParticles.length - 1; li >= 0; li--) {
      if (_scene) _scene.remove(_lootParticles[li]);
      _lootParticles[li].material.dispose();
    }
    _lootParticles.length = 0;

    // Reset skills on new game (skills are designed to accrue per-run, not persist)
    if (typeof SkillSystem !== 'undefined' && SkillSystem.init) SkillSystem.init();

    // Reset god mode effects on game start
    if (player.godMode) {
      player.maxHp = GOD_MODE_HP;
      player.hp = GOD_MODE_HP;
      // Unlock all weapons in god mode
      for (var i = 0; i < Weapons.getWeaponCount(); i++) {
        Weapons.unlockWeapon(i);
      }
      player.stealth = true;
    }

    // ═══ NEW: Apply challenge mode modifiers ═══
    if (typeof Progression !== 'undefined') {
      var chalMods = Progression.getChallengeModifiers();
      if (chalMods.hpMult) {
        player.maxHp = Math.round(player.maxHp * chalMods.hpMult);
        player.hp = player.maxHp;
      }
    }
    // Reset new feature systems on game start
    if (typeof CombatExtras !== 'undefined') CombatExtras.reset();
    if (typeof Traversal !== 'undefined') Traversal.reset();
    if (typeof WorldFeatures !== 'undefined') WorldFeatures.clear();
    if (typeof Perks !== 'undefined') Perks.reset();
    if (typeof MissionTypes !== 'undefined') MissionTypes.clear();
    if (typeof Feedback !== 'undefined') Feedback.clear();
    if (typeof Marketplace !== 'undefined') Marketplace.setOKC(0);
    if (typeof Progression !== 'undefined') {
      Progression.refreshDailies();
    }

    // Apply first stage
    applyStage(0);

    const spawnH = VoxelWorld.getTerrainHeight(0, 0);
    player.position.set(0, spawnH + player.height, 0);

    Weapons.reset();
    Enemies.clear();
    Pickups.clear();
    VehicleSystem.clear();
    DroneSystem.clear();
    NPCSystem.clear();
    if (typeof Building !== 'undefined' && Building.clear) Building.clear();
    if (typeof Tracers !== 'undefined') Tracers.clear();
    if (typeof StageVFX !== 'undefined' && StageVFX.clear) StageVFX.clear();
    if (typeof WeatherSystem !== 'undefined' && WeatherSystem.clear) WeatherSystem.clear();
    if (typeof WeatherSystem !== 'undefined' && WeatherSystem.init) WeatherSystem.init(_scene, _camera);

    // Respawn vehicle fleet on roads for first stage
    var _rwps = (VoxelWorld.getRoadWaypoints ? VoxelWorld.getRoadWaypoints() : []);
    var _sp0 = _rwps.length > 2 ? _rwps[2] : new THREE.Vector3(8, 0, 20);
    var _sp1 = _rwps.length > 6 ? _rwps[6] : new THREE.Vector3(12, 0, 20);
    var _sp2 = _rwps.length > 10 ? _rwps[10] : new THREE.Vector3(-8, 0, 20);
    var sgVh = VoxelWorld.getTerrainHeight(_sp0.x, _sp0.z);
    VehicleSystem.spawn(_sp0.x, sgVh, _sp0.z, 'transport');
    var sgVh2 = VoxelWorld.getTerrainHeight(_sp1.x, _sp1.z);
    VehicleSystem.spawn(_sp1.x, sgVh2, _sp1.z, 'combat');
    var sgVh3 = VoxelWorld.getTerrainHeight(_sp2.x, _sp2.z);
    VehicleSystem.spawn(_sp2.x, sgVh3, _sp2.z, 'turret_rover');

    // Respawn drones
    const sgDh1 = VoxelWorld.getTerrainHeight(5, 5) + 8;
    DroneSystem.spawn(5, sgDh1, 5, 'recon');
    const sgDh2 = VoxelWorld.getTerrainHeight(-5, 5) + 8;
    DroneSystem.spawn(-5, sgDh2, 5, 'fpv_attack');
    const sgDh3 = VoxelWorld.getTerrainHeight(0, -10) + 10;
    DroneSystem.spawn(0, sgDh3, -10, 'bomb');

    hideOverlays();
    HUD.show();
    HUD.setHealth(player.hp, player.maxHp);
    HUD.setScore(0);
    HUD.setWave(0);
    HUD.setKills(0);
    HUD.setStage(STAGES[0].id, STAGES[0].name);

    // Delay pointer lock slightly so the button click doesn't interfere
    setTimeout(function () {
      requestPointerLock();
    }, 100);

    // Announce first stage then begin first wave after delay
    HUD.announceStage(STAGES[0].id, STAGES[0].name, STAGES[0].description);
    if (_waveStartTimer) clearTimeout(_waveStartTimer);
    _waveStartTimer = setTimeout(function () {
      beginWave(1);
    }, 3200);

    // Generate an initial mission
    MissionSystem.generateRandom();
    } catch (err) {
      console.error('Failed to initialize game:', err);
    }
  }

  /* ── Stage Management ───────────────────────────────────────────── */
  function applyStage(stageIndex) {
    const stageDef = STAGES[stageIndex];

    // Generate level terrain and features
    VoxelWorld.generateLevel(stageIndex);

    // Update scene colors
    _scene.background = new THREE.Color(stageDef.bgColor);
    _scene.fog = new THREE.Fog(stageDef.fogColor, 30, 140);

    // Update sky dome colors for this stage
    if (_skyDome) {
      var bgCol = new THREE.Color(stageDef.bgColor);
      var skyAttr = _skyDome.geometry.attributes.color;
      for (var si = 0; si < skyAttr.count; si++) {
        var y = _skyDome.geometry.attributes.position.getY(si);
        var t = Math.max(0, Math.min(1, (y + 180) / 360));
        // Blend stage bg color with sky gradient
        var topCol = new THREE.Color(stageDef.sunColor || 0xffffff);
        skyAttr.setXYZ(si,
          bgCol.r * (1 - t * 0.5) + topCol.r * t * 0.5,
          bgCol.g * (1 - t * 0.5) + topCol.g * t * 0.5,
          bgCol.b * (1 - t * 0.3) + topCol.b * t * 0.3 + t * 0.15
        );
      }
      skyAttr.needsUpdate = true;
    }

    // Update lighting
    if (sunLight) {
      sunLight.color.setHex(stageDef.sunColor);
      sunLight.intensity = stageDef.sunIntensity;
    }

    // Start stage-specific ambient sound loop
    if (typeof AudioSystem !== 'undefined' && AudioSystem.startAmbientLoop) {
      AudioSystem.startAmbientLoop(stageDef.theme);
    }

    // Start stage-specific environmental VFX
    if (typeof StageVFX !== 'undefined' && StageVFX.startStageEffects) {
      StageVFX.startStageEffects(stageDef.theme);
    }
  }

  function getCurrentStage() { return STAGES[currentStage]; }

  function nextStage() {
    currentStage++;
    if (currentStage >= STAGES.length) {
      // All stages done — win!
      gameState = STATE.WIN;
      showOverlay('win');
      document.getElementById('win-score').textContent = player.score;
      document.getElementById('win-kills').textContent = player.kills;
      document.getElementById('win-stages').textContent = STAGES.length;
      return;
    }

    // Stage-based weapon unlocks
    var stageUnlocks = [
      [],                          // Stage 0→1: nothing extra (player earns via drops)
      [2, 3, 4, 5],               // Stage 1→2: AK-74M, RPK-74, SVD, PKM
      [6, 7, 8, 9, 10, 11, 12, 13], // Stage 2→3: NLAW thru SCAR-H
      [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29], // Stage 3→4: DShK thru Glock
      [30, 31, 32, 33, 34, 35],  // Stage 4→5: KS-23 thru C4
      [],  // Stage 5→6
      [],  // Stage 6→7
      [],  // Stage 7→8
      [],  // Stage 8→9
      [],  // Stage 9→10
      [],  // Stage 10→11
      [],  // Stage 11→12
    ];
    var rewards = stageUnlocks[currentStage] || [];
    for (var ri = 0; ri < rewards.length; ri++) {
      if (!Weapons.isUnlocked(rewards[ri])) {
        Weapons.unlockWeapon(rewards[ri]);
        HUD.notifyPickup('WEAPON UNLOCKED: ' + Weapons.getWeaponName(rewards[ri]), '#ff8800');
      }
    }

    const stageDef = STAGES[currentStage];
    applyStage(currentStage);

    // Reset wave count for new stage
    currentWave = 0;

    // Heal player between stages (50% of missing HP restored)
    const missingHp = player.maxHp - player.hp;
    player.hp = Math.min(player.maxHp, player.hp + Math.ceil(missingHp * 0.5));
    HUD.setHealth(player.hp, player.maxHp);

    // Reset player position on new terrain
    const spawnH = VoxelWorld.getTerrainHeight(0, 0);
    player.position.set(0, spawnH + player.height, 0);
    player.velocity.set(0, 0, 0);

    // Clear enemies, pickups, and module state from old stage
    Enemies.clear();
    Pickups.clear();
    DroneSystem.clear();
    if (typeof Building !== 'undefined' && Building.clear) Building.clear();
    if (typeof Tracers !== 'undefined' && Tracers.clear) Tracers.clear();
    if (typeof StageVFX !== 'undefined' && StageVFX.clear) StageVFX.clear();
    if (typeof WorldFeatures !== 'undefined' && WorldFeatures.clear) WorldFeatures.clear();
    if (typeof CombatExtras !== 'undefined' && CombatExtras.reset) CombatExtras.reset();
    if (typeof Traversal !== 'undefined' && Traversal.reset) Traversal.reset();
    if (typeof MissionTypes !== 'undefined' && MissionTypes.clear) MissionTypes.clear();
    if (typeof Feedback !== 'undefined' && Feedback.clear) Feedback.clear();
    if (typeof WeatherSystem !== 'undefined' && WeatherSystem.clear) WeatherSystem.clear();
    if (typeof WeatherSystem !== 'undefined' && WeatherSystem.init) WeatherSystem.init(_scene, _camera);

    // Respawn NPCs on new terrain
    NPCSystem.clear();
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const dist = 5 + Math.random() * 5;
      const nx = Math.cos(angle) * dist;
      const nz = Math.sin(angle) * dist;
      const nh = VoxelWorld.getTerrainHeight(nx, nz);
      NPCSystem.spawn(nx, nh, nz, i < 2 ? 'civilian' : 'trainee');
    }

    // Respawn vehicle fleet on roads
    var _nsWps = (VoxelWorld.getRoadWaypoints ? VoxelWorld.getRoadWaypoints() : []);
    var _nsp0 = _nsWps.length > 2 ? _nsWps[2] : new THREE.Vector3(8, 0, 20);
    var _nsp1 = _nsWps.length > 6 ? _nsWps[6] : new THREE.Vector3(12, 0, 20);
    var _nsp2 = _nsWps.length > 10 ? _nsWps[10] : new THREE.Vector3(-8, 0, 20);
    var vh = VoxelWorld.getTerrainHeight(_nsp0.x, _nsp0.z);
    VehicleSystem.clear();
    VehicleSystem.spawn(_nsp0.x, vh, _nsp0.z, 'transport');
    var vh2 = VoxelWorld.getTerrainHeight(_nsp1.x, _nsp1.z);
    VehicleSystem.spawn(_nsp1.x, vh2, _nsp1.z, 'combat');
    var vh3 = VoxelWorld.getTerrainHeight(_nsp2.x, _nsp2.z);
    VehicleSystem.spawn(_nsp2.x, vh3, _nsp2.z, 'turret_rover');

    // Spawn drones
    const dh1 = VoxelWorld.getTerrainHeight(5, 5) + 8;
    DroneSystem.spawn(5, dh1, 5, 'recon');
    const dh2 = VoxelWorld.getTerrainHeight(-5, 5) + 8;
    DroneSystem.spawn(-5, dh2, 5, 'fpv_attack');
    const dh3 = VoxelWorld.getTerrainHeight(0, -10) + 10;
    DroneSystem.spawn(0, dh3, -10, 'bomb');

    // Update HUD
    HUD.setStage(stageDef.id, stageDef.name);
    HUD.setWave(0);

    hideOverlays();
    gameState = STATE.PLAYING;
    requestPointerLock();

    // Announce new stage then begin first wave after delay
    HUD.announceStage(stageDef.id, stageDef.name, stageDef.description);
    if (_waveStartTimer) clearTimeout(_waveStartTimer);
    _waveStartTimer = setTimeout(function () {
      beginWave(1);
    }, 3200);
  }

  /* ── Wave Management ─────────────────────────────────────────────── */
  function beginWave(w) {
    currentWave = w;
    player.waveStartTime = performance.now();
    const stageDef = STAGES[currentStage];
    const mlDiff = MLSystem.getDifficultyMult();

    // AI Smart Learning: classify combat style each wave and pass counter-strategy
    MLSystem.classifyCombatStyle();
    var aiStrategy = MLSystem.generateCounterStrategy();

    // Show AI adaptation notification
    if (aiStrategy.adaptationLevel > 0 && HUD.notifyPickup) {
      HUD.notifyPickup(aiStrategy.adaptationMessage, '#ff00ff');
    }

    // Pass AI strategy to enemies for adaptive behavior
    Enemies.startWave(w, _scene, stageDef.difficulty * mlDiff, aiStrategy, stageDef.id);
    AudioSystem.playWaveStart();
    HUD.setWave(w, stageDef.wavesPerStage);
    HUD.announceWave(w, Enemies.getAliveCount(), stageDef.wavesPerStage);

    // ═══ Stage Boss on final wave ═══
    if (w === stageDef.wavesPerStage) {
      var bossType = (typeof EnemyTypes !== 'undefined' && EnemyTypes.getBossForStage)
        ? EnemyTypes.getBossForStage(stageDef.id) : 'BOSS';
      Enemies.spawnSingle(bossType, new THREE.Vector3(
        player.position.x + (Math.random() - 0.5) * 20,
        0,
        player.position.z + 30 + Math.random() * 10
      ));
      HUD.notifyPickup('⚠ BOSS INCOMING: ' + (typeof EnemyTypes !== 'undefined' && EnemyTypes.TYPES && EnemyTypes.TYPES[bossType] ? EnemyTypes.TYPES[bossType].name : 'COMMANDER'), '#ff0000');
    }

    // ═══ Blood Moon effect on final 2 waves ═══
    var isBloodMoon = (w >= stageDef.wavesPerStage - 1);
    if (isBloodMoon && _skyDome) {
      var skyAttr = _skyDome.geometry.attributes.color;
      for (var bmi = 0; bmi < skyAttr.count; bmi++) {
        var bmy = _skyDome.geometry.attributes.position.getY(bmi);
        var bmt = Math.max(0, Math.min(1, (bmy + 180) / 360));
        skyAttr.setXYZ(bmi,
          0.55 + bmt * 0.35,   // heavy red
          0.08 + bmt * 0.06,   // minimal green
          0.08 + bmt * 0.10    // minimal blue
        );
      }
      skyAttr.needsUpdate = true;
      if (_scene.fog) {
        _scene.fog.color.setHex(0x330505);
      }
      _scene.background = new THREE.Color(0x1a0303);
      if (HUD.notifyPickup) HUD.notifyPickup('🌑 BLOOD MOON RISING', '#ff2200');
    }

    // AI Smart Learning: update NPC assist strategy
    if (typeof NPCSystem !== 'undefined' && NPCSystem.setMLStrategy) {
      NPCSystem.setMLStrategy(MLSystem.getNPCAssistStrategy());
    }

    // Update AI learning indicator on HUD
    updateAIIndicator(aiStrategy);

    // AI Anti-camping: if player was camping, send flush squad
    if (aiStrategy.antiCampFlush) {
      var campPos = MLSystem.getCampingPosition();
      if (campPos) {
        HUD.notifyPickup('⚠ ENEMIES TARGETING YOUR POSITION!', '#ff2222');
        // Spawn stormers aimed at camping position from multiple angles
        for (var fi = 0; fi < 3; fi++) {
          var flushAngle = (fi / 3) * Math.PI * 2 + Math.random() * 0.5;
          var flushDist = 20 + Math.random() * 10;
          var flushX = campPos.x + Math.cos(flushAngle) * flushDist;
          var flushZ = campPos.z + Math.sin(flushAngle) * flushDist;
          Enemies.spawnSingle('STORMER', new THREE.Vector3(flushX, 0, flushZ));
        }
      }
    }

    // Spawn enemy vehicles on later waves (Russian armored assault)
    if (w >= 3) {
      var enemySpawnAngle = Math.random() * Math.PI * 2;
      var enemySpawnDist = 35 + Math.random() * 10;
      var evx = Math.cos(enemySpawnAngle) * enemySpawnDist;
      var evz = Math.sin(enemySpawnAngle) * enemySpawnDist;
      var evy = VoxelWorld.getTerrainHeight(evx, evz);
      VehicleSystem.spawnEnemy(evx, evy, evz, 'combat');
      HUD.notifyPickup('⚠ ENEMY ARMOR SPOTTED!', '#ff4444');
    }
    if (w >= 5) {
      var evAngle2 = Math.random() * Math.PI * 2;
      var evDist2 = 30 + Math.random() * 10;
      var evx2 = Math.cos(evAngle2) * evDist2;
      var evz2 = Math.sin(evAngle2) * evDist2;
      var evy2 = VoxelWorld.getTerrainHeight(evx2, evz2);
      VehicleSystem.spawnEnemy(evx2, evy2, evz2, 'transport');
    }

    // Spawn enemy drones
    if (w >= 2 && typeof DroneSystem !== 'undefined' && DroneSystem.spawnEnemyDrone) {
      var droneSpawnH = 20 + Math.random() * 10;
      var droneAngle = Math.random() * Math.PI * 2;
      var droneDist = 30 + Math.random() * 15;
      
      // FPV drone
      var fpvX = player.position.x + Math.cos(droneAngle) * droneDist;
      var fpvZ = player.position.z + Math.sin(droneAngle) * droneDist;
      DroneSystem.spawnEnemyDrone(fpvX, droneSpawnH, fpvZ, 'enemy_fpv');
      
      if (w >= 4) {
        // Bomber drone
        var bomberAngle = droneAngle + Math.PI * 0.5;
        var bomberX = player.position.x + Math.cos(bomberAngle) * droneDist;
        var bomberZ = player.position.z + Math.sin(bomberAngle) * droneDist;
        DroneSystem.spawnEnemyDrone(bomberX, droneSpawnH + 5, bomberZ, 'enemy_bomber');
        
        // Extra FPV
        var fpv2Angle = droneAngle + Math.PI;
        var fpv2X = player.position.x + Math.cos(fpv2Angle) * droneDist;
        var fpv2Z = player.position.z + Math.sin(fpv2Angle) * droneDist;
        DroneSystem.spawnEnemyDrone(fpv2X, droneSpawnH, fpv2Z, 'enemy_fpv');
      }
      
      if (w >= 6) {
        // Additional bombers and FPVs
        for (var ei = 0; ei < 2; ei++) {
          var extraAngle = Math.random() * Math.PI * 2;
          var exX = player.position.x + Math.cos(extraAngle) * (droneDist + 10);
          var exZ = player.position.z + Math.sin(extraAngle) * (droneDist + 10);
          DroneSystem.spawnEnemyDrone(exX, droneSpawnH + ei * 3, exZ, ei === 0 ? 'enemy_bomber' : 'enemy_fpv');
        }
      }
      
      HUD.notifyPickup('⚠ ENEMY DRONES DETECTED!', '#ff4488');
    }

    // ═══ NEW: Wave-begin integrations for 59 features ═══
    // Generate bounties for this wave
    if (typeof Progression !== 'undefined') {
      Progression.generateBounties(w);
      Progression.trackStat('wavesCleared', 0); // track at begin; increment at complete
    }
    // Spawn a random mission type every 3 waves
    if (w % 3 === 0 && typeof MissionTypes !== 'undefined') {
      var mTypes = Object.keys(MissionTypes.TYPES);
      var mType = mTypes[Math.floor(Math.random() * mTypes.length)];
      MissionTypes.startMission(mType, player.position.x + (Math.random() - 0.5) * 40, player.position.z + (Math.random() - 0.5) * 40);
      HUD.notifyPickup('📍 NEW MISSION: ' + MissionTypes.TYPES[mType].name, '#ffcc00');
    }
    // Spawn supply airdrop every 4 waves
    if (w % 4 === 0 && typeof WorldFeatures !== 'undefined') {
      var adX = player.position.x + (Math.random() - 0.5) * 30;
      var adZ = player.position.z + (Math.random() - 0.5) * 30;
      var adY = VoxelWorld.getTerrainHeight(adX, adZ);
      WorldFeatures.spawnAirdrop(adX, adZ, adY);
      HUD.notifyPickup('📦 SUPPLY DROP INCOMING!', '#44ff88');
    }
    // Place enemy landmines on later waves
    if (w >= 4 && typeof WorldFeatures !== 'undefined') {
      for (var lmi = 0; lmi < Math.min(w, 8); lmi++) {
        var lmAngle = Math.random() * Math.PI * 2;
        var lmDist = 10 + Math.random() * 20;
        var lmX = player.position.x + Math.cos(lmAngle) * lmDist;
        var lmZ = player.position.z + Math.sin(lmAngle) * lmDist;
        var lmY = VoxelWorld.getTerrainHeight(lmX, lmZ);
        WorldFeatures.placeMine(lmX, lmY, lmZ, 'enemy');
      }
    }
    // Spawn radiation zones on wave 6+
    if (w === 6 && typeof WorldFeatures !== 'undefined') {
      WorldFeatures.addRadiationZone(player.position.x + 30, player.position.z + 30, 8);
      HUD.notifyPickup('☢ RADIATION ZONE DETECTED!', '#00ff00');
    }
    // Reset combat extras per wave
    if (typeof CombatExtras !== 'undefined') {
      CombatExtras.reset();
    }
  }

  function onWaveComplete() {
    player.score += SCORE_WAVE_BONUS;
    HUD.setScore(player.score);
    MLSystem.onWaveComplete(currentWave, currentStage, player.hp / player.maxHp);
    RankSystem.onWaveComplete(currentWave);
    MissionSystem.onWaveCompleted();

    // Show wave stats (Feature 50)
    if (HUD.showWaveStats) {
      var elapsed = ((performance.now() - player.waveStartTime) / 1000);
      var mins = Math.floor(elapsed / 60);
      var secs = Math.floor(elapsed % 60);
      HUD.showWaveStats({
        kills: player.waveKills,
        accuracy: player.waveShots > 0 ? Math.round((player.waveHits / player.waveShots) * 100) : 0,
        headshots: player.waveHeadshots,
        time: mins + 'm ' + secs + 's',
        damageTaken: Math.round(player.waveDamageTaken),
        bestStreak: player.bestStreak,
      });
    }
    // Play-to-Earn: OKC for wave clear
    if (typeof Marketplace !== 'undefined') {
      Marketplace.onWaveClear();
      HUD.updateOKC(Marketplace.getOKC());
    }

    // ═══ NEW: Wave-complete integrations for 59 features ═══
    // Progression stats (BEFORE resetting wave stats so values are accurate)
    if (typeof Progression !== 'undefined') {
      Progression.trackStat('wavesCleared', 1);
      // Check flawless wave
      if (player.waveDamageTaken === 0) {
        Progression.trackStat('flawlessWaves', 1);
      }
      // Speed wave bounty
      var waveTime = (performance.now() - player.waveStartTime) / 1000;
      Progression.updateBounty('speed_wave', 1);
      Progression.updateBounty('survive', 1);
      Progression.updateBounty('low_damage', Math.round(player.waveDamageTaken));
      Progression.save();
    }
    // Achievement checks
    if (typeof Feedback !== 'undefined') {
      if (currentWave >= 5) Feedback.unlockAchievement('SURVIVOR');
      if (currentWave >= 10) Feedback.unlockAchievement('WAVE_10');
      if (player.waveDamageTaken === 0) Feedback.unlockAchievement('NO_DAMAGE');
      var waveElapsed = (performance.now() - player.waveStartTime) / 1000;
      if (waveElapsed < 30) Feedback.unlockAchievement('SPEED_RUN');
    }
    // Journal unlocks by wave
    if (typeof Progression !== 'undefined') {
      if (currentWave >= 3) Progression.unlockJournalEntry('entry_flanking');
      if (currentWave >= 5) Progression.unlockJournalEntry('entry_shield');
      if (currentWave >= 7) Progression.unlockJournalEntry('entry_mortar');
    }

    // Reset wave stats (AFTER all tracking above)
    player.waveKills = 0;
    player.waveShots = 0;
    player.waveHits = 0;
    player.waveHeadshots = 0;
    player.waveDamageTaken = 0;

    // ── B27: Economy wave hooks ──
    if (typeof Economy !== 'undefined') {
      Economy.produce(); // production cycle per wave
      if (Economy.processInvestments) Economy.processInvestments();
      if (Economy.triggerRandomEvent && Math.random() < 0.3) {
        Economy.triggerRandomEvent();
        var evt = Economy.getActiveEvent ? Economy.getActiveEvent() : null;
        if (evt) HUD.notifyPickup('📢 ' + evt.name, '#ffaa00');
      }
      if (Economy.refreshBlackMarket) Economy.refreshBlackMarket();
    }

    // ── B28: Side objective check ──
    if (typeof MissionSystem !== 'undefined' && MissionSystem.checkSideObjective) {
      var waveElapsed2 = (performance.now() - player.waveStartTime) / 1000;
      var sideResult = MissionSystem.checkSideObjective({
        damageTaken: player.waveDamageTaken, kills: player.waveKills,
        headshots: player.waveHeadshots, time: waveElapsed2,
        accuracy: player.waveShots > 0 ? player.waveHits / player.waveShots : 0,
        hp: player.hp, ammoRatio: 0.5, spotted: false, explosiveMulti: 0,
      });
      if (sideResult && sideResult.completed) {
        if (typeof Marketplace !== 'undefined') Marketplace.addOKC(sideResult.reward);
        HUD.notifyPickup('⭐ SIDE OBJ COMPLETE: ' + sideResult.name + ' (+' + sideResult.reward + ' OKC)', '#ffdd00');
      }
      if (MissionSystem.generateSideObjective) MissionSystem.generateSideObjective();
    }

    // ── B31: Achievement checks on wave clear ──
    if (typeof Progression !== 'undefined' && Progression.checkAchievement) {
      Progression.checkAchievement('SURVIVOR', currentWave);
      Progression.checkAchievement('SLAYER', player.kills);
      Progression.checkAchievement('HEADHUNTER', player.totalHeadshots);
      if (player.waveDamageTaken === 0) Progression.checkAchievement('IRONMAN', 1);
      if (typeof Marketplace !== 'undefined') Progression.checkAchievement('WEALTHY', Marketplace.getOKC());
      Progression.checkAchievement('LEGENDARY', player.level);
      if (Progression.addSeasonXP) Progression.addSeasonXP(50 + currentWave * 10);
    }

    // ── B32: Weather forecast & temperature update ──
    if (typeof WeatherSystem !== 'undefined') {
      if (WeatherSystem.generateForecast) WeatherSystem.generateForecast();
      if (WeatherSystem.updateTemperature) {
        var _tsInfo = typeof TimeSystem !== 'undefined' ? TimeSystem.getInfo() : null;
        var tod = _tsInfo ? _tsInfo.timeOfDay : 0.5;
        var season = _tsInfo ? _tsInfo.season : 'Summer';
        WeatherSystem.updateTemperature(tod, season);
      }
    }

    // Trigger a random battlefield event between waves (from wave 2+)
    if (currentWave >= 2) {
      setTimeout(triggerBattlefieldEvent, 1500);
    }

    const stageDef = STAGES[currentStage];

    // Check if all waves in this stage are done
    if (currentWave >= stageDef.wavesPerStage) {
      // Stage clear!
      // Stage clear bonus
      player.score += 1000; // Stage clear bonus
      HUD.setScore(player.score);

      // Play-to-Earn: OKC for stage clear
      if (typeof Marketplace !== 'undefined') {
        Marketplace.onStageClear();
        HUD.updateOKC(Marketplace.getOKC());
      }

      if (currentStage >= STAGES.length - 1) {
        // Final stage cleared — win!
        gameState = STATE.WIN;
        if (AudioSystem.playMusic) AudioSystem.playMusic('victory');
        showOverlay('win');
        document.getElementById('win-score').textContent = player.score;
        document.getElementById('win-kills').textContent = player.kills;
        document.getElementById('win-stages').textContent = STAGES.length;
        return;
      }

      // Show stage clear overlay
      gameState = STATE.STAGE_CLEAR;
      if (typeof AudioSystem !== 'undefined' && AudioSystem.playLevelComplete) AudioSystem.playLevelComplete();
      showOverlay('stageclear');
      document.getElementById('stageclear-num').textContent = stageDef.id;
      document.getElementById('stageclear-name').textContent = stageDef.name;
      document.getElementById('stageclear-score').textContent = player.score;
      document.getElementById('stageclear-kills').textContent = player.kills;

      // Show heal preview
      const missingHp = player.maxHp - player.hp;
      const healAmount = Math.ceil(missingHp * 0.5);
      const healEl = document.getElementById('stageclear-heal');
      if (healEl) {
        healEl.textContent = healAmount > 0
          ? '❤ +' + healAmount + ' HP will be restored'
          : '❤ Full health!';
      }

      const nextStageDef = STAGES[currentStage + 1];
      document.getElementById('stageclear-next-name').textContent = nextStageDef.name;
      document.getElementById('stageclear-next-label').style.display = '';
      return;
    }

    gameState = STATE.WAVE_CLEAR;
    showOverlay('waveclear');
    document.getElementById('waveclear-num').textContent = currentWave;
    document.getElementById('waveclear-total').textContent = stageDef.wavesPerStage;
    document.getElementById('waveclear-stage-info').textContent =
      'Stage ' + stageDef.id + ': ' + stageDef.name;
  }

  /* ── Player Movement ─────────────────────────────────────────────── */
  function updatePlayer(delta) {
    // Skip if in drone or vehicle
    if (DroneSystem.isPossessing() || VehicleSystem.isInVehicle()) return;
    if (CameraSystem.getMode() === CameraSystem.MODE.STRATEGIC) return;

    // Apply touch look rotation
    if (isMobile && (touch.lookX !== 0 || touch.lookY !== 0)) {
      CameraSystem.handleMouseMove(touch.lookX * 0.35, touch.lookY * 0.35);
      touch.lookX = 0;
      touch.lookY = 0;
    }

    const yaw = CameraSystem.getYaw();
    const forward = _gmTmp1.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right   = _gmTmp2.set(Math.cos(yaw), 0, -Math.sin(yaw));

    const moveDir = _gmTmp3.set(0, 0, 0);

    // Keyboard movement
    if (keys['KeyW'] || keys['ArrowUp'])    moveDir.add(forward);
    if (keys['KeyS'] || keys['ArrowDown'])  moveDir.sub(forward);
    if (keys['KeyA'] || keys['ArrowLeft'])  moveDir.sub(right);
    if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(right);

    // Touch joystick movement (additive)
    if (isMobile && touch.moveActive) {
      moveDir.addScaledVector(forward, -touch.moveY);
      moveDir.addScaledVector(right, touch.moveX);
    }

    const isMoving = moveDir.lengthSq() > 0;
    if (isMoving) {
      moveDir.normalize();
      player.sprinting = !!keys['ShiftLeft'] || touch.sprinting;
      // Cancel reload when sprinting
      if (player.sprinting && Weapons.isReloading()) {
        Weapons.cancelReload();
      }
      let speed = MOVE_SPEED * (player.sprinting ? SPRINT_MULT : 1) * (player.prone ? 0.3 : 1);
      // Stim boost: +60% speed while active
      if (player._stimTimer && player._stimTimer > 0) speed *= 1.6;
      // Weather speed modifier
      if (typeof WeatherSystem !== 'undefined' && WeatherSystem.getModifiers) {
        speed *= WeatherSystem.getModifiers().speedMod;
      }
      // ── B31: Skill passive speed bonus ──
      if (typeof SkillSystem !== 'undefined' && SkillSystem.getPassiveBonus) {
        speed *= SkillSystem.getPassiveBonus('moveSpeed');
      }
      // ── B24: Crouch speed reduction ──
      if (player.isCrouching) speed *= 0.5;
      // ── B32: Blizzard slow ──
      if (player._blizzardSlow) speed *= player._blizzardSlow;
      moveDir.multiplyScalar(speed * delta);

      // Stamina drain on sprint
      if (player.sprinting && player.stamina > 0) {
        player.stamina = Math.max(0, player.stamina - STAMINA_DRAIN_RATE * delta);
        if (player.stamina <= 0) {
          player.sprinting = false; // exhausted
        }
      }

      if (player.sprinting) SkillSystem.onSprint();
    } else {
      // Stamina regen when not sprinting
      player.stamina = Math.min(1.0, player.stamina + STAMINA_REGEN_RATE * delta);
    }

    // Decay stim timer
    if (player._stimTimer && player._stimTimer > 0) {
      player._stimTimer -= delta;
    }

    // ── B24: Crouch height + slide + cover detection ──
    if (!player.prone) {
      var targetH = player.isCrouching ? 1.1 : 1.7;
      player.height += (targetH - player.height) * Math.min(1, delta * 12);
    }
    if (player.slideTimer > 0) {
      player.slideTimer -= delta;
      if (player.slideDir) {
        var slideSpeed = 12 * (player.slideTimer / 0.6);
        moveDir.addScaledVector(player.slideDir, slideSpeed * delta);
      }
      if (player.slideTimer <= 0) player.slideDir = null;
    }
    // Cover: if crouching and there's a solid block adjacent at head height
    if (player.isCrouching) {
      var headY = player.position.y + 0.5;
      var cx = player.position.x, cz = player.position.z;
      player.inCover = VoxelWorld.isSolid(cx + 1, headY, cz) || VoxelWorld.isSolid(cx - 1, headY, cz) ||
                        VoxelWorld.isSolid(cx, headY, cz + 1) || VoxelWorld.isSolid(cx, headY, cz - 1);
    } else {
      player.inCover = false;
    }

    // Gravity
    player.velocity.y -= GRAVITY * delta;

    // Jump (keyboard or touch)
    if ((keys['Space'] || touch.jumping) && player.onGround) {
      player.velocity.y = JUMP_SPEED;
      player.onGround = false;
      touch.jumping = false;
    }

    // Apply movement
    const newPos = _gmNewPos.copy(player.position);
    newPos.x += moveDir.x;
    newPos.z += moveDir.z;
    newPos.y += player.velocity.y * delta;

    // Terrain collision
    const terrainH = VoxelWorld.getTerrainHeight(newPos.x, newPos.z) + player.height;

    // Horizontal block collision
    const checkH = newPos.y - player.height + 0.5;
    if (VoxelWorld.isSolid(newPos.x, checkH, newPos.z)) {
      // Try mantling over a wall when blocked horizontally and not on ground
      if (!player.onGround && typeof Traversal !== 'undefined' && !Traversal.isMantling()) {
        _gmTmp2.set(0, 0, -1).applyQuaternion(_camera.quaternion);
        Traversal.tryMantle(player.position, player.velocity.y, { x: _gmTmp2.x, z: _gmTmp2.z }, function (bx, by, bz) {
          return VoxelWorld.getBlock(bx, by, bz);
        });
      }
      // Try sliding along axes
      if (!VoxelWorld.isSolid(player.position.x, checkH, newPos.z)) {
        newPos.x = player.position.x;
      } else if (!VoxelWorld.isSolid(newPos.x, checkH, player.position.z)) {
        newPos.z = player.position.z;
      } else {
        newPos.x = player.position.x;
        newPos.z = player.position.z;
      }
    }

    if (newPos.y <= terrainH) {
      newPos.y = terrainH;
      player.velocity.y = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    player.position.copy(newPos);

    // Update camera
    CameraSystem.update(delta, player.position, isMoving, player.onGround);

    // Player footstep sounds
    if (isMoving && player.onGround && typeof AudioSystem !== 'undefined') {
      player._footstepTimer = (player._footstepTimer || 0) - delta;
      if (player._footstepTimer <= 0) {
        AudioSystem.playFootstep();
        player._footstepTimer = player.sprinting ? 0.28 : 0.42;
      }
    }
  }

  /* ── Combat ──────────────────────────────────────────────────────── */
  function updateCombat(delta) {
    // Drone combat: LMB triggers drone action
    if (DroneSystem.isPossessing()) {
      if (mouseDown || touch.firing) {
        const drone = DroneSystem.getPossessed();
        if (drone) {
          if (drone.type === 'fpv_attack') {
            DroneSystem.fireAttack(drone.id);
          } else if (drone.type === 'bomb' && drone.hasPayload) {
            DroneSystem.dropPayload(drone.id);
          }
        }
        mouseNewPress = false;
      }
      return;
    }

    // Vehicle combat: LMB triggers turret fire
    if (VehicleSystem.isInVehicle()) {
      if (mouseDown || touch.firing) {
        VehicleSystem.setVehicleKey('fire', true);
      } else {
        VehicleSystem.setVehicleKey('fire', false);
      }
      return;
    }

    if (CameraSystem.getMode() === CameraSystem.MODE.STRATEGIC) return;

    if (mouseDown || touch.firing) {
      const targets = Enemies.getEnemyMeshes().slice();
      // Add vehicle meshes as targets so player can damage/destroy vehicles
      var allVehicles = VehicleSystem.getAll();
      for (var vi = 0; vi < allVehicles.length; vi++) {
        var veh = allVehicles[vi];
        if (veh.mesh && veh !== VehicleSystem.getOccupied()) {
          targets.push(veh.mesh);
        }
      }
      const weaponType = Weapons.getCurrentType();
      const weaponId = Weapons.getCurrentId();
      // Map weapon type to audio sound type
      const audioMap = { MELEE: 'melee', PISTOL: 'pistol', ASSAULT: 'rifle', LMG: 'rifle', SNIPER: 'sniper', HMG: 'hmg', AT: 'launcher', ATGM: 'launcher', NATO: 'rifle', AT_HEAVY: 'launcher', AT_LIGHT: 'launcher', AA: 'launcher', GRENADE: 'launcher', NATO_HEAVY: 'rifle', HMG_HEAVY: 'hmg', INCENDIARY: 'launcher', MACHINEGUN: 'hmg', SMG: 'smg', AMR: 'heavy_sniper', MINIGUN: 'hmg', SILENT: 'pistol', THERMOBARIC: 'launcher', SHOTGUN: 'shotgun', MINE: 'explosive', SMOKE: 'launcher', FLASHBANG: 'launcher', EXPLOSIVE: 'explosive' };
      Weapons.tryFire(_camera, targets, delta, function (hit) {
        // Check if hit a vehicle mesh
        var hitVehicle = null;
        for (var hvi = 0; hvi < allVehicles.length; hvi++) {
          if (allVehicles[hvi].mesh === hit.object || (hit.object.parent && allVehicles[hvi].mesh === hit.object.parent)) {
            hitVehicle = allVehicles[hvi];
            break;
          }
        }
        if (hitVehicle) {
          onVehicleHit(hitVehicle, Weapons.getDamage());
        } else {
          onEnemyHit(hit);
        }
      }, mouseNewPress);
      // Play sound on every actual shot (auto-fire included), not just first click
      if (Weapons.didFire()) {
        AudioSystem.playGunshot(audioMap[weaponType] || 'rifle');
        MLSystem.onShot(weaponId);
        player.totalShots++;
        player.waveShots++;
        // Register heat + maintenance per shot (not per hit, to avoid shotgun 8x issue)
        if (typeof CombatExtras !== 'undefined') {
          CombatExtras.registerShot();
          var isAutoWep = ['ASSAULT', 'NATO', 'NATO_HEAVY', 'LMG', 'HMG', 'SMG', 'HMG_HEAVY', 'MACHINEGUN', 'MINIGUN'].indexOf(weaponType) >= 0;
          CombatExtras.addHeat(isAutoWep);
        }
        // Spawn bullet tracer
        if (typeof Tracers !== 'undefined' && weaponType !== 'MELEE') {
          _gmTmp2.copy(_camera.position);
          _camera.getWorldDirection(_gmTmp3);
          var isHeavy = ['HMG', 'HMG_HEAVY', 'MACHINEGUN', 'MINIGUN'].indexOf(weaponType) >= 0;
          var isExplosive = ['AT', 'ATGM', 'AT_HEAVY', 'AT_LIGHT', 'AA', 'GRENADE', 'INCENDIARY', 'THERMOBARIC'].indexOf(weaponType) >= 0;
          if (!isExplosive) {
            _gmNewPos.copy(_gmTmp2).addScaledVector(_gmTmp3, 0.5);
            Tracers.spawnTracer(_gmNewPos, _gmTmp3, isHeavy ? 0xff4400 : 0xffcc44, 120);
          }
          // Muzzle flash on every shot
          if (Tracers.spawnMuzzleFlash) {
            Tracers.spawnMuzzleFlash(_gmTmp2, _gmTmp3);
          }
          // Screen shake for heavy weapons
          if (isHeavy && CameraSystem.shake) {
            CameraSystem.shake(0.02, 0.1);
          }
        }
      }
      mouseNewPress = false;
    }
  }

  function onEnemyHit(hit) {
    const enemy = Enemies.findByMesh(hit.object);
    if (!enemy || !enemy.alive) return;

    AudioSystem.playHit();
    // Blood splatter on hit
    if (typeof Tracers !== 'undefined' && Tracers.spawnBlood) {
      Tracers.spawnBlood(hit.point || enemy.mesh.position);
    }
    MLSystem.onHit(Weapons.getCurrentId());
    // AI Smart Learning: track weapon engagement range
    var engageRange = enemy.mesh.position.distanceTo(player.position);
    MLSystem.trackWeaponUse(Weapons.getCurrentId(), engageRange);
    MLSystem.trackWeaponType(Weapons.getCurrentType());
    // Track if player is being aggressive (moving toward enemies)
    MLSystem.trackCombatEngagement(engageRange < 10);

    const isHeadshot = hit.object === enemy.mesh.userData.headMesh;
    let baseDmg = Weapons.getDamage();

    // ═══ NEW: Apply ammo type and perk damage modifiers ═══
    if (typeof CombatExtras !== 'undefined') {
      var ammoMods = CombatExtras.getAmmoModifiers();
      baseDmg = Math.round(baseDmg * ammoMods.dmgMult);
    }
    // Dead eye crit check
    if (typeof Perks !== 'undefined' && Perks.isDeadEyeShot()) {
      baseDmg = Math.round(baseDmg * Perks.getDeadEyeMult());
      HUD.notifyPickup('🎯 DEAD EYE CRIT!', '#ff4400');
    }
    // Prestige damage bonus
    if (typeof Progression !== 'undefined') {
      var pBonuses = Progression.getPrestigeBonuses();
      baseDmg = Math.round(baseDmg * pBonuses.damageMult);
    }
    const dmg = isHeadshot ? baseDmg * 2 : baseDmg;

    const remaining = Enemies.damage(enemy, dmg, isHeadshot);

    // Floating damage number on hit (not just kill)
    if (typeof Feedback !== 'undefined') {
      Feedback.spawnDamageNumber(
        window.innerWidth / 2 + (Math.random() - 0.5) * 40,
        window.innerHeight / 2 - 20 + (Math.random() - 0.5) * 30,
        dmg, isHeadshot, false
      );
    }

    SkillSystem.onShoot(true, isHeadshot);
    HUD.flashHit(isHeadshot, remaining <= 0);
    player.totalHits++;
    player.waveHits++;

    if (isHeadshot) {
      HUD.showHeadshot();
      if (typeof AudioSystem !== 'undefined' && AudioSystem.playCriticalHit) AudioSystem.playCriticalHit();
      player.score += 50;
      player.totalHeadshots++;
      player.waveHeadshots++;
    }

    if (remaining <= 0) {
      AudioSystem.playDeath();
      // Death explosion effect
      if (typeof Tracers !== 'undefined' && Tracers.spawnExplosion) {
        Tracers.spawnExplosion(enemy.mesh.position, 1.5);
      }
      MLSystem.onKill(Weapons.getCurrentId());
      MLSystem.trackKillTiming(); // AI Smart Learning: track kill timing patterns
      player.score += enemy.scoreValue;
      player.kills++;
      player.waveKills++;
      HUD.setScore(player.score);
      HUD.setKills(player.kills);
      RankSystem.onKill(isHeadshot);
      HUD.addKill(Weapons.getCurrentName(), enemy.typeCfg ? enemy.typeCfg.name : 'ENEMY', isHeadshot);

      // ── B23: XP system ──
      var xpGain = (enemy.typeCfg ? enemy.typeCfg.xpReward : 20) || 20;
      if (isHeadshot) xpGain = Math.floor(xpGain * 1.5);
      player.xp += xpGain;
      var xpNeeded = player.level * 200;
      if (player.xp >= xpNeeded) {
        player.xp -= xpNeeded;
        player.level++;
        if (HUD.showStreakBanner) HUD.showStreakBanner('LEVEL UP! LVL ' + player.level, player.level);
        if (typeof AudioSystem !== 'undefined' && AudioSystem.playLevelUp) AudioSystem.playLevelUp();
        // Unlock a weapon every 3 levels
        if (player.level % 3 === 0) Weapons.unlockNext();
      }
      if (HUD.updateXPBar) HUD.updateXPBar(player.xp, xpNeeded, player.level);
      if (Feedback.showXPGain) Feedback.showXPGain(xpGain);

      // ── B23: Multikill tracking ──
      player.multikillTimer = 2.0;
      player.multikillCount++;
      if (player.multikillCount >= 2) {
        var mkNames = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'MULTI KILL', 'MEGA KILL', 'ULTRA KILL'];
        var mkName = mkNames[Math.min(player.multikillCount, 6)];
        if (HUD.showStreakBanner) HUD.showStreakBanner(mkName, player.multikillCount);
      }

      // ── B23: Kill confirm effect ──
      if (Feedback.showKillConfirm) Feedback.showKillConfirm();
      if (isHeadshot && AudioSystem.playHeadshotDing) AudioSystem.playHeadshotDing();

      // ── B22: Boss bar update ──
      if (enemy.type === 'BOSS') {
        if (HUD.hideBossBar) HUD.hideBossBar();
      }

      // ── B22: Damage log ──
      if (HUD.addDamageLog) HUD.addDamageLog('Killed ' + (enemy.typeCfg ? enemy.typeCfg.name : 'Enemy') + ' (+' + xpGain + ' XP)', '#44ff44');

      // ═══ NEW: Progression, Perks, Feedback tracking on kill ═══
      // Kill feed entry
      if (typeof Feedback !== 'undefined') {
        Feedback.addKillFeedEntry('You', enemy.typeCfg ? enemy.typeCfg.name : 'Enemy', Weapons.getCurrentName(), isHeadshot);
      }
      // Floating damage number
      if (typeof Feedback !== 'undefined') {
        Feedback.spawnDamageNumber(window.innerWidth / 2, window.innerHeight / 2 - 30, dmg, isHeadshot, false);
      }
      // Perk: kill tracking & killstreaks
      if (typeof Perks !== 'undefined') {
        Perks.onKill();
        // Scavenger auto-loot
        var scavRange = Perks.getScavengerRange();
        if (scavRange > 0) {
          Weapons.addAmmo(Perks.getScavengerAmmo());
          HUD.notifyPickup('🔄 SCAVENGER: +' + Perks.getScavengerAmmo() + ' ammo', '#88ff88');
        }
        // Update killstreak panel
        var ksList = document.getElementById('killstreak-list');
        if (ksList) {
          var avail = Perks.getAvailableStreaks();
          if (avail.length > 0) {
            document.getElementById('killstreak-panel').style.display = 'block';
            var ksHTML = '';
            for (var ksi = 0; ksi < avail.length; ksi++) {
              ksHTML += '<div style="margin:3px 0;cursor:pointer;padding:2px 4px;border:1px solid #ff6600;border-radius:3px" onclick="GameManager._activateStreak(' + ksi + ')">' + avail[ksi].icon + ' ' + avail[ksi].name + '</div>';
            }
            ksList.innerHTML = ksHTML;
          }
        }
      }
      // Progression: stats tracking
      if (typeof Progression !== 'undefined') {
        Progression.trackStat('totalKills', 1);
        Progression.trackWeaponKill(Weapons.getCurrentName());
        if (isHeadshot) Progression.trackStat('headshots', 1);
        Progression.trackStat('totalDamageDealt', dmg);
        // Check bounties
        var completedBounties = Progression.updateBounty('weapon_kill', 1);
        if (isHeadshot) Progression.updateBounty('headshot_wave', 1);
        Progression.updateBounty('damage', dmg);
        for (var cbi = 0; cbi < completedBounties.length; cbi++) {
          HUD.notifyPickup('💰 BOUNTY COMPLETE! +' + completedBounties[cbi].reward + ' OKC', '#ffaa00');
          if (typeof Marketplace !== 'undefined') Marketplace.addOKC(completedBounties[cbi].reward);
          if (typeof AudioSystem !== 'undefined' && AudioSystem.playBountyComplete) AudioSystem.playBountyComplete();
        }
        // Achievement checks
        if (typeof Feedback !== 'undefined') {
          if (player.kills === 1) Feedback.unlockAchievement('FIRST_BLOOD');
          if (player.totalHeadshots >= 10) Feedback.unlockAchievement('SHARPSHOOTER');
          if (player.killStreak >= 4) Feedback.unlockAchievement('MULTI_KILL');
          if (Weapons.getCurrentIdx() === 0) {
            Progression.trackStat('meleeKills', 1);
            if (Progression.getStats().meleeKills >= 10) Feedback.unlockAchievement('MELEE_MASTER');
          }
        }
        // Journal unlock by kills
        if (player.kills >= 5) Progression.unlockJournalEntry('entry_conscript');
        if (player.kills >= 10) Progression.unlockJournalEntry('entry_stormer');
        if (player.kills >= 15) Progression.unlockJournalEntry('entry_armored');
      }

      // Kill streak tracking
      player.killStreak++;
      if (player.killStreak > player.bestStreak) player.bestStreak = player.killStreak;

      // ── B30: Weapon Mastery tracking ──
      if (typeof CombatExtras !== 'undefined' && CombatExtras.addWeaponKill) {
        var masteryUp = CombatExtras.addWeaponKill(Weapons.getCurrentId());
        if (masteryUp) {
          var mastery = CombatExtras.getWeaponMastery(Weapons.getCurrentId());
          if (mastery) HUD.notifyPickup('⭐ ' + Weapons.getCurrentName() + ' MASTERY: ' + mastery.rankName, '#ffdd44');
        }
      }

      // ── B27: Economy bounty tracking ──
      if (typeof Economy !== 'undefined' && Economy.updateBounty) {
        if (isHeadshot) Economy.updateBounty('headshot', 1);
        Economy.updateBounty('kills', 1);
        if (Weapons.getCurrentType() === 'MELEE') Economy.updateBounty('melee', 1);
        if (player.killStreak >= 5) Economy.updateBounty('streak', player.killStreak);
      }

      // ── B31: Progression achievements on kill milestones ──
      if (typeof Progression !== 'undefined' && Progression.checkAchievement) {
        Progression.checkAchievement('FIRST_BLOOD', player.kills);
        Progression.checkAchievement('SLAYER', player.kills);
        Progression.checkAchievement('HEADHUNTER', player.totalHeadshots);
        if (player.totalShots >= 100) {
          var accPct = player.totalHits / player.totalShots;
          Progression.checkAchievement('SHARPSHOOTER', accPct * 100);
        }
        if (Progression.addSeasonXP) Progression.addSeasonXP(5 + (isHeadshot ? 5 : 0));
      }
      player.streakTimer = 4.0; // 4 seconds to chain another kill
      var streakMult = 1.0 + Math.min(player.killStreak - 1, 10) * 0.2; // up to 3.0x at 11+ streak
      var streakBonus = Math.floor(enemy.scoreValue * (streakMult - 1));
      if (streakBonus > 0) {
        player.score += streakBonus;
        HUD.setScore(player.score);
      }
      if (HUD.showStreak) HUD.showStreak(player.killStreak, streakMult);

      // Wire enemy kill to MissionTypes ASSASSINATION tracking
      if (typeof MissionTypes !== 'undefined' && MissionTypes.getActive && MissionTypes.getActive()) {
        var mt = MissionTypes.getActive();
        if (mt.config && mt.config.id === 'ASSASSINATION' && enemy.mesh) {
          var mtDx = enemy.mesh.position.x - mt.zoneX;
          var mtDz = enemy.mesh.position.z - mt.zoneZ;
          if (mtDx * mtDx + mtDz * mtDz < 400) {
            MissionTypes.interact('DAMAGE_HVT', { damage: dmg });
          }
        }
      }

      // Dog tag collection (every kill drops a dog tag)
      player.dogTags++;
      if (player.dogTags % 10 === 0) {
        player.score += 500;
        HUD.setScore(player.score);
        HUD.notifyPickup('🏷 10 DOG TAGS! +500 SCORE', '#ffaa00');
      }

      // Play-to-Earn: award OKC for kills
      if (typeof Marketplace !== 'undefined') {
        Marketplace.onKill(isHeadshot);
        if (player.killStreak === 3 || player.killStreak === 5 || player.killStreak >= 10) {
          Marketplace.onStreak(player.killStreak);
        }
        HUD.updateOKC(Marketplace.getOKC());
      }

      // Pickup spawn — expanded loot table
      if (Math.random() < enemy.dropChance) {
        const lootRoll = Math.random();
        let type;
        if (lootRoll < 0.25)      type = 'HEALTH';
        else if (lootRoll < 0.45) type = 'AMMO';
        else if (lootRoll < 0.58) type = 'ARMOR';
        else if (lootRoll < 0.68) type = 'GRENADE';
        else if (lootRoll < 0.77) type = 'MEDKIT';
        else if (lootRoll < 0.85) type = 'STIM';
        else if (lootRoll < 0.92) type = 'INTEL';
        else                      type = 'SHIELD';
        Pickups.spawn(enemy.mesh.position, type);
        // Loot drop sparkle
        if (typeof Tracers !== 'undefined' && Tracers.spawnSparks) Tracers.spawnSparks(enemy.mesh.position);
      }

      // Weapon unlock drop (pickup weapons 2-15)
      if (Math.random() < 0.12) {
        const candidates = [];
        const weaponCount = Weapons.getWeaponCount();
        for (let wi = 2; wi < weaponCount; wi++) {
          if (!Weapons.isUnlocked(wi)) candidates.push(wi);
        }
        if (candidates.length > 0) {
          const idx = candidates[Math.floor(Math.random() * candidates.length)];
          Weapons.unlockWeapon(idx);
          HUD.notifyPickup('WEAPON UNLOCKED: ' + Weapons.getWeaponName(idx), '#ff8800');
        }
      }
    }
  }

  function onVehicleHit(vehicle, dmg) {
    if (!vehicle || !vehicle.alive) return;
    VehicleSystem.damageVehicle(vehicle.id, dmg);
    AudioSystem.playHit();
    if (HUD.addCombatLog) HUD.addCombatLog('Hit vehicle (-' + dmg + ')', '#ff8800');
    // Spawn sparks on vehicle hit
    if (typeof Tracers !== 'undefined' && Tracers.spawnMuzzleFlash) {
      _gmTmp1.set(0, 1, 0);
      Tracers.spawnMuzzleFlash(vehicle.position, _gmTmp1);
    }
    // Check if destroyed
    if (vehicle.health <= 0) {
      player.score += 200;
      HUD.setScore(player.score);
      HUD.notifyPickup('🚗 VEHICLE DESTROYED! +200', '#ff8800');
      if (HUD.addCombatLog) HUD.addCombatLog('Vehicle destroyed! +200 score', '#ff4400');
      // Spawn loot from destroyed vehicle
      spawnLootParticle(vehicle.position, 5 + Math.floor(Math.random() * 5));
      // Explosion effect
      if (typeof Tracers !== 'undefined' && Tracers.spawnExplosion) {
        Tracers.spawnExplosion(vehicle.position, 3);
      }
    }
  }

  function onPlayerHit(dmg, attackerPos) {
    if (gameState !== STATE.PLAYING) return; // can't take damage when dead/paused
    if (player.godMode) return; // God mode: immune to damage
    // Shield absorbs damage
    if (player.shieldTimer > 0) {
      HUD.notifyPickup('🛡 SHIELDED!', '#ffd700');
      return;
    }
    // B24: Crouch reduces damage 15%, cover reduces 40%
    if (player.inCover) {
      dmg = Math.round(dmg * 0.6);
    } else if (player.isCrouching) {
      dmg = Math.round(dmg * 0.85);
    }
    // Perk: Juggernaut reduces incoming damage
    if (typeof Perks !== 'undefined') {
      dmg = Math.round(dmg * Perks.getDamageTakenMult());
    }
    // Challenge mode: hardcore double damage
    if (typeof Progression !== 'undefined') {
      var chalMods = Progression.getChallengeModifiers();
      if (chalMods.enemyDmgMult) dmg = Math.round(dmg * chalMods.enemyDmgMult);
    }
    // Armor absorbs up to 50% of incoming damage, capped by available armor points
    if (player.armor > 0) {
      var absorbed = Math.min(player.armor, dmg * 0.5);
      player.armor = Math.max(0, player.armor - absorbed);
      dmg = dmg - absorbed;
      if (HUD.updateArmor) HUD.updateArmor(player.armor / 100);
    }
    player.lastDamageTime = 0; // reset health regen timer
    player.totalDamageTaken += dmg;
    player.waveDamageTaken += dmg;
    MLSystem.onDamageTaken(dmg);
    player.hp = Math.max(0, player.hp - dmg);
    HUD.setHealth(player.hp, player.maxHp);
    HUD.flashDamage();
    // Player-hit audio feedback
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playHit) AudioSystem.playHit();
    // Screen shake on hit
    if (CameraSystem.shake) {
      CameraSystem.shake(dmg * 0.004, 0.2);
    }

    // AI Smart Learning: track directional vulnerability
    if (attackerPos) {
      MLSystem.trackHitDirection(
        attackerPos.x, attackerPos.z,
        player.position.x, player.position.z,
        CameraSystem.getYaw()
      );
    }

    // Heavy hits cause bleeding (25% chance on hits > 15 dmg)
    if (dmg > 15 && Math.random() < 0.25 && !player.bleeding) {
      player.bleeding = true;
      player.bleedTimer = 6.0; // 6 seconds of bleed
      if (HUD.showBleed) HUD.showBleed(true);
      HUD.notifyPickup('🩸 BLEEDING! Press X to bandage', '#ff2222');
    }

    // Hit direction indicator
    if (attackerPos && HUD.showHitDirection) {
      var dx = attackerPos.x - player.position.x;
      var dz = attackerPos.z - player.position.z;
      var worldAngle = Math.atan2(dx, dz);
      var relAngle = CameraSystem.getYaw() - worldAngle + Math.PI;
      HUD.showHitDirection(relAngle);
    }

    if (player.hp <= 0) {
      // ── B24: Last Stand — once per life, survive fatal hit ──
      if (!player._usedLastStand && player.level >= 5) {
        player._usedLastStand = true;
        player.hp = 1;
        player.shieldTimer = 2.0; // 2 sec invulnerability
        HUD.setHealth(player.hp, player.maxHp);
        if (HUD.showStreakBanner) HUD.showStreakBanner('💀 LAST STAND!', 0);
        if (HUD.showDamageFlash) HUD.showDamageFlash('#ffff00');
        if (CameraSystem.shake) CameraSystem.shake(0.08, 0.5);
        return;
      }
      gameState = STATE.DEAD;
      // Force exit vehicle / release drone on death
      if (VehicleSystem.isInVehicle()) VehicleSystem.exit();
      if (DroneSystem.isPossessing()) DroneSystem.release();
      if (AudioSystem.stopMusic) AudioSystem.stopMusic();
      Weapons.exitZoom();
      MLSystem.onDeath();
      // Track death in progression
      if (typeof Progression !== 'undefined') {
        Progression.trackStat('deathCount', 1);
        Progression.trackStat('totalDamageTaken', player.totalDamageTaken);
        var rank = Progression.submitScore('Player', player.score, currentWave, STAGES[currentStage].id, player.kills);
        var deadLB = document.getElementById('dead-leaderboard');
        if (deadLB) {
          deadLB.textContent = '🏆 Leaderboard Rank: #' + rank;
        }
        Progression.save();
      }
      // Reset perk streak on death
      if (typeof Perks !== 'undefined') Perks.resetStreak();
      // AI Smart Learning: classify combat style on death and track death context
      MLSystem.classifyCombatStyle();
      if (attackerPos) {
        var deathDist = player.position.distanceTo(attackerPos);
        var deathType = deathDist < 5 ? 'rush' : (deathDist > 25 ? 'sniper' : 'flank');
        var deathAngle = Math.atan2(attackerPos.x - player.position.x, attackerPos.z - player.position.z);
        MLSystem.trackDeathContext(deathType, deathAngle);
      }
      showOverlay('dead');
      document.getElementById('dead-stage').textContent = STAGES[currentStage].id;
      document.getElementById('dead-score').textContent = player.score;
      document.getElementById('dead-kills').textContent = player.kills;
      document.getElementById('dead-wave').textContent = currentWave;
      // Death statistics (Feature 43)
      if (HUD.showDeathStats) {
        var playTime = Math.floor((performance.now() - player.playStartTime) / 1000);
        var pm = Math.floor(playTime / 60);
        var ps = playTime % 60;
        HUD.showDeathStats({
          accuracy: player.totalShots > 0 ? Math.round((player.totalHits / player.totalShots) * 100) : 0,
          headshotPct: player.totalHits > 0 ? Math.round((player.totalHeadshots / player.totalHits) * 100) : 0,
          favWeapon: Weapons.getCurrentName(),
          playtime: pm + 'm ' + ps + 's',
          distance: Math.round(player.distanceWalked),
        });
      }
    }
  }

  /* ── Main Update Loop ────────────────────────────────────────────── */
  let prevTime = performance.now();
  var _fpsAccum = 0;
  var _fpsSamples = 0;
  var _perfCheckTimer = 0;
  var _qualityReduced = false;

  function update() {
    requestAnimationFrame(update);

    const now = performance.now();
    const delta = Math.min((now - prevTime) / 1000, 0.1);
    prevTime = now;

    // Adaptive quality: measure FPS, reduce quality if below 30
    _fpsAccum += delta;
    _fpsSamples++;
    _perfCheckTimer += delta;
    if (_perfCheckTimer > 3 && _fpsSamples > 10) {
      var avgFps = _fpsSamples / _fpsAccum;
      if (avgFps < 25 && !_qualityReduced && _renderer) {
        _qualityReduced = true;
        _renderer.setPixelRatio(1);
        if (_scene && _scene.fog) _scene.fog.far = 50;
        if (sunLight) sunLight.castShadow = false;
      }
      _fpsAccum = 0;
      _fpsSamples = 0;
      _perfCheckTimer = 0;
    }

    // ── B26: FPS counter ──
    if (HUD.updateFPS) HUD.updateFPS();

    if (gameState === STATE.PLAYING || gameState === STATE.BUILD_MODE) {
      // Core systems
      TimeSystem.update(delta);
      WeatherSystem.update(delta);
      MLSystem.trackFPS(delta);
      // AI Smart Learning: track player position for behavior profiling
      MLSystem.trackPlayerPosition(player.position.x, player.position.z, delta);
      updatePlayer(delta);

      // Bleed DOT
      if (player.bleeding && player.bleedTimer > 0) {
        player.bleedTimer -= delta;
        player.hp = Math.max(1, player.hp - 3 * delta); // 3 HP/sec bleed
        HUD.setHealth(player.hp, player.maxHp);
        if (player.bleedTimer <= 0) {
          player.bleeding = false;
          if (HUD.showBleed) HUD.showBleed(false);
        }
      }

      // Flashbang stun timer
      if (GameManager._flashbangStun > 0) {
        GameManager._flashbangStun -= delta;
        if (GameManager._flashbangStun <= 0) GameManager._flashbangStun = 0;
      }

      // Kill streak decay
      if (player.streakTimer > 0) {
        player.streakTimer -= delta;
        if (player.streakTimer <= 0) {
          player.killStreak = 0;
          if (HUD.showStreak) HUD.showStreak(0, 1.0);
        }
      }

      // Chornobyl Zone radiation damage (stage 7)
      if (STAGES[currentStage] && STAGES[currentStage].id === 7) {
        player._radTimer = (player._radTimer || 0) + delta;
        if (player._radTimer >= 3.0) {  // 2 HP every 3 seconds
          player._radTimer = 0;
          player.hp = Math.max(1, player.hp - 2);
          HUD.setHealth(player.hp, player.maxHp);
          if (HUD.showDamageFlash) HUD.showDamageFlash(0x44ff00, 0.15); // green flash
        }
        // Geiger tick sounds
        player._geigerTimer = (player._geigerTimer || 0) + delta;
        if (player._geigerTimer >= 0.3 + Math.random() * 0.5) {
          player._geigerTimer = 0;
          if (AudioSystem.playGeigerTick) AudioSystem.playGeigerTick();
        }
        if (HUD.showRadiation) HUD.showRadiation(true);
      } else {
        if (HUD.showRadiation) HUD.showRadiation(false);
      }

      // B23: Multikill timer decay
      if (player.multikillTimer > 0) {
        player.multikillTimer -= delta;
        if (player.multikillTimer <= 0) player.multikillCount = 0;
      }

      // B22: Stage progress bar
      if (HUD.updateStageProgress && STAGES[currentStage]) {
        HUD.updateStageProgress(currentWave, STAGES[currentStage].wavesPerStage);
      }

      // B23: Feedback screen shake
      if (typeof Feedback !== 'undefined') {
        var shake = Feedback.getShakeOffset ? Feedback.getShakeOffset() : null;
        if (shake && _camera) {
          _camera.position.x += shake.x * 0.01;
          _camera.position.y += shake.y * 0.01;
        }
      }

      // Airdrop cooldown
      if (player.airdropCooldown > 0) player.airdropCooldown -= delta;

      // Stamina HUD
      if (HUD.updateStamina) HUD.updateStamina(player.stamina);

      // Weather indicator
      if (HUD.updateWeatherDisplay && WeatherSystem.getModifiers) {
        HUD.updateWeatherDisplay(WeatherSystem.getModifiers().label);
      }

      // Low HP vignette pulse
      if (HUD.showLowHP) {
        HUD.showLowHP(player.hp > 0 && player.hp <= player.maxHp * 0.25);
      }

      // Shield timer countdown
      if (player.shieldTimer > 0) {
        player.shieldTimer -= delta;
        if (player.shieldTimer <= 0) {
          if (HUD.showShield) HUD.showShield(false);
        }
      }

      // Intel timer countdown
      if (player.intelTimer > 0) {
        player.intelTimer -= delta;
      }

      // Interaction prompts (vehicle/drone nearby)
      if (!VehicleSystem.isInVehicle() && !DroneSystem.isPossessing()) {
        const nearVeh = VehicleSystem.getNearby(player.position, 5);
        if (nearVeh.length > 0 && HUD.showInteractionPrompt) {
          const nv = nearVeh[0];
          if (nv.faction === 'enemy') {
            HUD.showInteractionPrompt('Press [G] to HIJACK ' + nv.type.toUpperCase());
          } else {
            HUD.showInteractionPrompt('Press [G] to enter ' + nv.type.toUpperCase());
          }
        } else if (HUD.hideInteractionPrompt) {
          HUD.hideInteractionPrompt();
        }
      }

      // Compass update
      if (HUD.updateCompass) HUD.updateCompass(CameraSystem.getYaw());

      // Weapon jam indicator
      if (HUD.showJam && Weapons.isJammed) HUD.showJam(Weapons.isJammed());

      // Build materials HUD (show when holding shovel)
      var buildMatHud = document.getElementById('build-materials-hud');
      if (buildMatHud) {
        if (Weapons.getCurrentType() === 'MELEE') {
          buildMatHud.style.display = 'block';
          var matList = document.getElementById('build-mat-list');
          if (matList) {
            var mats = player.buildMaterials;
            var eco = Economy.getResources();
            matList.innerHTML =
              '🪵 Wood: ' + ((mats.wood || 0) + (eco.wood || 0)) + '<br>' +
              '🪨 Stone: ' + ((mats.stone || 0) + (eco.stone || 0)) + '<br>' +
              '🔩 Metal: ' + ((mats.metal || 0) + (eco.metal || 0)) + '<br>' +
              '🟫 Dirt: ' + (mats.dirt || 0) + '<br>' +
              '🏖 Sand: ' + (mats.sand || 0) + '<br>' +
              '🧱 Brick: ' + (mats.brick || 0);
          }
        } else {
          buildMatHud.style.display = 'none';
        }
      }

      // Dynamic music intensity based on nearby enemies
      if (AudioSystem.setMusicIntensity && AudioSystem.isMusicPlaying()) {
        var nearEnemies = 0;
        var allEn = Enemies.getAll();
        for (var mei = 0; mei < allEn.length; mei++) {
          if (allEn[mei].mesh && allEn[mei].mesh.position.distanceTo(player.position) < 25) nearEnemies++;
        }
        AudioSystem.setMusicIntensity(Math.min(1.0, nearEnemies / 8));
      }

      updateCombat(delta);

      // Feed player velocity to weapon sway
      if (Weapons.setPlayerSpeed) Weapons.setPlayerSpeed(player.velocity.length());
      // Hold breath: Shift while zoomed and not moving steadies scope
      if (Weapons.setHoldBreath) Weapons.setHoldBreath(Weapons.isZoomed() && keys['ShiftLeft'] && player.velocity.length() < 0.5);
      Weapons.update(delta);
      Enemies.update(delta, player.position, onPlayerHit, function (waveDone) {
        if (waveDone) onWaveComplete();
      });
      Pickups.update(delta, player.position, function (type) {
        AudioSystem.playPickup();
        MLSystem.onPickup();
        if (type === 'HEALTH') {
          player.hp = Math.min(player.maxHp, player.hp + 25);
          HUD.setHealth(player.hp, player.maxHp);
          HUD.notifyPickup('+25 HP', '#22ff55');
        } else if (type === 'AMMO') {
          Weapons.addAmmo(30);
          HUD.notifyPickup('+30 AMMO', '#ffcc00');
        } else if (type === 'ARMOR') {
          player.armor = Math.min(100, player.armor + 50);
          if (HUD.updateArmor) HUD.updateArmor(player.armor / 100);
          HUD.notifyPickup('+50 ARMOR', '#4488ff');
        } else if (type === 'GRENADE') {
          // Area damage around player pickup spot
          Enemies.damageInRadius(player.position, 6, 60);
          HUD.notifyPickup('GRENADE BLAST!', '#ff6622');
        } else if (type === 'MEDKIT') {
          player.hp = player.maxHp;
          HUD.setHealth(player.hp, player.maxHp);
          HUD.notifyPickup('FULL HEAL!', '#ff4444');
        } else if (type === 'STIM') {
          // Temporary speed boost (handled via flag)
          player._stimTimer = 8.0;
          HUD.notifyPickup('STIM BOOST! 8s', '#cc44ff');
        } else if (type === 'INTEL') {
          // Reveal all enemies on minimap for 10 seconds
          player.intelTimer = 10.0;
          HUD.notifyPickup('📡 INTEL! Enemies revealed 10s', '#00ffff');
        } else if (type === 'SHIELD') {
          // Temporary invulnerability 5 seconds
          player.shieldTimer = 5.0;
          if (HUD.showShield) HUD.showShield(true);
          HUD.notifyPickup('🛡 SHIELD ACTIVE! 5s', '#ffd700');
        }
      });

      // Hybrid systems
      NPCSystem.update(delta, TimeSystem.getInfo());
      DroneSystem.update(delta);
      VehicleSystem.update(delta);
      Automation.update(delta);
      MissionSystem.update(delta);

      // ── B29: NPC combat barks (random chance per second) ──
      if (typeof NPCSystem !== 'undefined' && NPCSystem.triggerBark) {
        var allNpcsBark = NPCSystem.getAll();
        for (var nbi = 0; nbi < allNpcsBark.length; nbi++) {
          var nb = allNpcsBark[nbi];
          if (!nb.alive) continue;
          nb._barkTimer = (nb._barkTimer || 0) - delta;
          if (nb._barkTimer <= 0) {
            nb._barkTimer = 8 + Math.random() * 12; // bark every 8-20 seconds
            var bCat = nb.job === 'guard' || nb.job === 'assault' ? 'combat' : 'idle';
            if (nb.hp && nb.maxHp && nb.hp < nb.maxHp * 0.3) bCat = 'wounded';
            NPCSystem.triggerBark(nb.id, bCat);
          }
        }
      }

      // ── B31: Skill tree unlock checks per wave ──
      if (typeof SkillSystem !== 'undefined' && SkillSystem.checkSkillTreeUnlocks) {
        SkillSystem.checkSkillTreeUnlocks();
      }

      // ── NPC auto-boarding: friendly NPCs jump into nearby player vehicles ──
      if (VehicleSystem.isInVehicle()) {
        var playerVeh = VehicleSystem.getOccupied();
        if (playerVeh && playerVeh.damage > 0 && !playerVeh.occupiedByNPC) {
          // Find nearest armed NPC to board as gunner
          var allNPCs = (typeof NPCSystem !== 'undefined' && NPCSystem.getAll) ? NPCSystem.getAll() : [];
          var bestNPC = null;
          var bestDist = 8; // NPC must be within 8 units to board
          for (var ni = 0; ni < allNPCs.length; ni++) {
            var npc = allNPCs[ni];
            if (!npc.alive || npc.rank === 'civilian') continue;
            var nd = playerVeh.position.distanceTo(npc.position);
            if (nd < bestDist) {
              bestDist = nd;
              bestNPC = npc;
            }
          }
          if (bestNPC) {
            VehicleSystem.boardNPCGunner(playerVeh.id, bestNPC);
            HUD.notifyPickup('👥 NPC GUNNER BOARDED!', '#00ff88');
          }
        }
      }

      // Voxel chunk rebuilds
      VoxelWorld.updateDirtyChunks();

      // Update loot particles
      updateLootParticles(delta);

      // Minecraft-style building: right-click with shovel to place blocks
      // (handled in mousedown handler below)

      // Health regen: tier 1 (2hp/s after 5s, cap 50%) + tier 2 (1hp/s after 10s, cap 75%)
      player.lastDamageTime += delta;
      if (player.lastDamageTime > 5 && player.hp > 0 && player.hp < player.maxHp * 0.75) {
        if (player.hp < player.maxHp * 0.5) {
          // Tier 1: fast regen to 50%
          player.hp = Math.min(player.maxHp * 0.5, player.hp + 2 * delta);
        } else if (player.lastDamageTime > 10) {
          // Tier 2: slow regen to 75%
          player.hp = Math.min(player.maxHp * 0.75, player.hp + 1 * delta);
        }
        HUD.setHealth(player.hp, player.maxHp);
      }

      // Armor HUD
      if (HUD.updateArmor) HUD.updateArmor(player.armor / 100);

      // Distance tracking
      if (player._lastPos) {
        var dx = player.position.x - player._lastPos.x;
        var dz = player.position.z - player._lastPos.z;
        player.distanceWalked += Math.sqrt(dx * dx + dz * dz);
      }
      player._lastPos = player.position.clone();

      // Build mode ghost update
      if (gameState === STATE.BUILD_MODE && Building.getSelectedTemplate()) {
        const ray = VoxelWorld.raycastBlock(_camera, 12);
        if (ray) Building.updateGhost(ray.place.x, ray.place.y, ray.place.z);
      }

      // HUD updates
      HUD.setAmmo(Weapons.getClip(), Weapons.getReserve(), Weapons.getClipSize ? Weapons.getClipSize() : 0);
      HUD.setWeapon(Weapons.getCurrentName(), Weapons.getCurrentIdx());
      HUD.showReload(Weapons.isReloading());
      HUD.setEnemies(Enemies.getAliveCount());

      // Update extended HUD
      updateExtendedHUD();

      // Update minimap
      if (HUD.updateMinimap) {
        var mmEnemies = Enemies.getAll();
        var mmNPCs = (typeof NPCSystem !== 'undefined' && NPCSystem.getAll) ? NPCSystem.getAll() : [];
        var mmVehicles = (typeof VehicleSystem !== 'undefined' && VehicleSystem.getAll) ? VehicleSystem.getAll() : [];
        var mmDrones = (typeof DroneSystem !== 'undefined' && DroneSystem.getAll) ? DroneSystem.getAll() : [];
        HUD.updateMinimap(player.position.x, player.position.z, CameraSystem.getYaw(), mmEnemies, mmNPCs, mmVehicles, mmDrones);
      }

      // Enemy drone proximity warning
      if (typeof DroneSystem !== 'undefined' && DroneSystem.getAll) {
        var allDrones = DroneSystem.getAll();
        for (var di = 0; di < allDrones.length; di++) {
          var dr = allDrones[di];
          if (dr.faction === 'enemy' && dr.alive !== false && dr.position) {
            var ddist = player.position.distanceTo(dr.position);
            if (ddist < 20) {
              HUD.notifyPickup('⚠ ENEMY DRONE NEARBY!', '#ff4488');
              break;
            }
          }
        }
      }

      // Update tracers
      if (typeof Tracers !== 'undefined') Tracers.update(delta, player.position);
      if (typeof StageVFX !== 'undefined') StageVFX.update(delta);

      // ═══ NEW FEATURE SYSTEM UPDATES (59 features) ═══

      // Combat extras update (lean, inspect, bayonet, heat, maintenance)
      if (typeof CombatExtras !== 'undefined') {
        var combatResult = CombatExtras.update(delta);

        // Lean HUD indicator
        var leanInd = document.getElementById('lean-indicator');
        if (leanInd) leanInd.style.display = CombatExtras.isLeaning() ? 'block' : 'none';

        // Inspect overlay
        var inspInd = document.getElementById('inspect-overlay');
        if (inspInd) inspInd.style.display = CombatExtras.isInspecting() ? 'block' : 'none';

        // Bayonet indicator
        var bayInd = document.getElementById('bayonet-indicator');
        if (bayInd) bayInd.style.display = CombatExtras.isBayonetCharging() ? 'block' : 'none';

        // Bayonet charge damage
        if (combatResult.bayonet && combatResult.bayonet.active) {
          var enemies = Enemies.getAll();
          for (var bi = 0; bi < enemies.length; bi++) {
            var be = enemies[bi];
            if (!be.alive || !be.mesh) continue;
            var bdx = be.mesh.position.x - player.position.x;
            var bdz = be.mesh.position.z - player.position.z;
            if (bdx * bdx + bdz * bdz < 4) {
              Enemies.damage(be, combatResult.bayonet.damage * delta * 2);
            }
          }
        }

        // Heat bar HUD
        if (combatResult.heat) {
          var heatBar = document.getElementById('heat-bar');
          if (heatBar) heatBar.style.width = (combatResult.heat.heat * 100) + '%';
          var ovhInd = document.getElementById('overheat-indicator');
          if (ovhInd) ovhInd.style.display = combatResult.heat.overheated ? 'block' : 'none';
        }

        // Maintenance indicator
        var maintInd = document.getElementById('maintenance-indicator');
        if (maintInd) maintInd.style.display = CombatExtras.isMaintaining() ? 'block' : 'none';

        // Ammo type display
        if (CombatExtras.getAmmoType && HUD.updateAmmoType) {
          var at = CombatExtras.getAmmoType();
          if (at) HUD.updateAmmoType(at.name);
        }
      }

      // Traversal update (mantle, dive)
      if (typeof Traversal !== 'undefined') {
        var travResult = Traversal.update(delta);
        // Apply mantle position override if mantling
        if (travResult && travResult.mantle && travResult.mantle.active) {
          player.position.x = travResult.mantle.x;
          player.position.y = travResult.mantle.y;
          player.position.z = travResult.mantle.z;
          player.velocity.y = 0;
        }

        // Apply dolphin dive movement
        if (travResult && travResult.dive && travResult.dive.active) {
          player.position.x += travResult.dive.moveX;
          player.position.z += travResult.dive.moveZ;
          player.position.y += travResult.dive.heightOffset;
        }

        // Apply vault movement
        if (travResult && travResult.vault && travResult.vault.active && travResult.vault.position) {
          player.position.x = travResult.vault.position.x;
          player.position.y = travResult.vault.position.y;
          player.position.z = travResult.vault.position.z;
          player.velocity.y = 0;
        }

        // Swimming check
        var blockUnderPlayer = VoxelWorld.getBlock(
          Math.floor(player.position.x),
          Math.floor(player.position.y - 1),
          Math.floor(player.position.z)
        );
        var inWater = blockUnderPlayer === 8; // WATER
        var swimResult = Traversal.updateSwimming(delta, inWater, player.stamina);
        var swimInd = document.getElementById('swim-indicator');
        var breathBar = document.getElementById('breath-bar-container');
        if (swimResult && swimResult.active) {
          if (swimInd) swimInd.style.display = 'block';
          if (breathBar) {
            breathBar.style.display = 'block';
            var bBar = document.getElementById('breath-bar');
            if (bBar) bBar.style.width = (swimResult.breath / 10 * 100) + '%';
          }
          if (swimResult.drowning) {
            player.hp = Math.max(0, player.hp - swimResult.drownDmg);
            HUD.setHealth(player.hp, player.maxHp);
          }
        } else {
          if (swimInd) swimInd.style.display = 'none';
          if (breathBar) breathBar.style.display = 'none';
        }

        // Mantle indicator
        var mantleInd = document.getElementById('mantle-indicator');
        if (mantleInd) mantleInd.style.display = Traversal.isMantling() ? 'block' : 'none';

        // ── B30: Grapple hook update ──
        if (Traversal.isGrappling && Traversal.isGrappling()) {
          var grapUp = Traversal.updateGrapple(delta, player.position);
          if (grapUp && grapUp.active && grapUp.force) {
            player.position.addScaledVector(grapUp.force, delta);
            player.velocity.y = Math.max(player.velocity.y, 2);
          }
        }

        // ── B30: Wall run update (uses result from Traversal.update above, not a second call) ──
        if (travResult && travResult.wallRun && travResult.wallRun.active) {
          player.position.y += travResult.wallRun.offsetY * delta;
          player.velocity.y = 0;
          if (AudioSystem.playWallRun) AudioSystem.playWallRun();
        }

        // ── B30: Ledge grab update ──
        if (Traversal.isHanging && Traversal.isHanging()) {
          var ledgeUp = Traversal.updateLedgeHang(delta);
          if (ledgeUp && ledgeUp.hanging) {
            player.velocity.y = 0;
          }
        } else if (player.velocity.y < -2 && Traversal.checkLedgeGrab) {
          Traversal.checkLedgeGrab(player.position, player.velocity, function (bx, by, bz) {
            return VoxelWorld.getBlock(bx, by, bz);
          });
        }
      }

      // ── B30: Combat roll update (uses result from CombatExtras.update above) ──
      if (combatResult && combatResult.roll && combatResult.roll.active) {
        player.position.x += combatResult.roll.moveX;
        player.position.z += combatResult.roll.moveZ;
      }

      // ── B29: Hazard zone check ──
      if (typeof WorldFeatures !== 'undefined' && WorldFeatures.checkHazards) {
        var hazard = WorldFeatures.checkHazards(player.position.x, player.position.z);
        if (hazard && hazard.inHazard) {
          player.hp = Math.max(0, player.hp - hazard.damage * delta);
          HUD.setHealth(player.hp, player.maxHp);
          if (Feedback.showEnvironmentWarning) Feedback.showEnvironmentWarning(hazard.type.toUpperCase());
        }
        WorldFeatures.updateHazards(delta);
      }

      // ── B32: Extreme weather update ──
      if (typeof WeatherSystem !== 'undefined' && WeatherSystem.updateExtremeEvent) {
        WeatherSystem.updateExtremeEvent(delta);
        var extreme = WeatherSystem.getExtremeEvent ? WeatherSystem.getExtremeEvent() : null;
        if (extreme && extreme.active) {
          if (extreme.type === 'hailstorm') {
            player.hp = Math.max(0, player.hp - 1 * delta);
            HUD.setHealth(player.hp, player.maxHp);
          }
          if (extreme.type === 'blizzard') {
            // Slow movement during blizzard
            player._blizzardSlow = 0.5;
          } else {
            player._blizzardSlow = 1.0;
          }
        } else {
          player._blizzardSlow = 1.0;
        }
      }

      // ── B32: Vehicle fuel consumption ──
      if (typeof VehicleSystem !== 'undefined' && VehicleSystem.isInVehicle() && VehicleSystem.consumeFuel) {
        var occVeh = VehicleSystem.getOccupied();
        if (occVeh) VehicleSystem.consumeFuel(occVeh.id, delta * 2);
      }

      // ── B28: Mission timer update ──
      if (typeof MissionSystem !== 'undefined' && MissionSystem.updateMissionTimer) {
        MissionSystem.updateMissionTimer(delta);
      }

      // World features update (fires, trees, mines, airdrops, smoke)
      if (typeof WorldFeatures !== 'undefined') {
        var enemyPositions = [];
        var allEn2 = Enemies.getAll();
        for (var wei = 0; wei < allEn2.length; wei++) {
          if (allEn2[wei].alive && allEn2[wei].mesh) {
            enemyPositions.push({ x: allEn2[wei].mesh.position.x, z: allEn2[wei].mesh.position.z });
          }
        }
        var wfResult = WorldFeatures.update(delta,
          function (x, y, z) { return VoxelWorld.getBlock(x, y, z); },
          function (x, y, z, b) { VoxelWorld.setBlock(x, y, z, b); },
          player.position, enemyPositions
        );

        // Fire damage to player
        if (wfResult.fireDmg) {
          for (var fi = 0; fi < wfResult.fireDmg.length; fi++) {
            var fz = wfResult.fireDmg[fi];
            var fdx = player.position.x - fz.x;
            var fdz = player.position.z - fz.z;
            if (fdx * fdx + fdz * fdz < fz.radius * fz.radius) {
              player.hp = Math.max(0, player.hp - fz.dps * delta);
              HUD.setHealth(player.hp, player.maxHp);
            }
          }
        }

        // Mine explosions
        if (wfResult.mineExplosions && wfResult.mineExplosions.length > 0) {
          for (var mi = 0; mi < wfResult.mineExplosions.length; mi++) {
            var me = wfResult.mineExplosions[mi];
            AudioSystem.playExplosion();
            if (typeof Tracers !== 'undefined') Tracers.spawnExplosion(new THREE.Vector3(me.x, me.y, me.z), me.radius * 0.5);
            if (CameraSystem.shake) CameraSystem.shake(0.3, 0.5);
            if (me.target === 'player') {
              onPlayerHit(me.damage, new THREE.Vector3(me.x, me.y, me.z));
            } else {
              Enemies.damageInRadius(new THREE.Vector3(me.x, me.y, me.z), me.radius, me.damage);
            }
          }
        }

        // Airdrop collection
        var airdropResult = WorldFeatures.collectAirdrop(player.position);
        if (airdropResult) {
          HUD.notifyPickup('📦 AIRDROP: ' + airdropResult + '!', '#44ff88');
          AudioSystem.playPickup();
          if (airdropResult === 'AMMO_CRATE') Weapons.addAmmo(100);
          else if (airdropResult === 'MEDKIT') { player.hp = player.maxHp; HUD.setHealth(player.hp, player.maxHp); }
          else if (airdropResult === 'ARMOR') { player.armor = 100; if (HUD.updateArmor) HUD.updateArmor(1); }
        }

        // Radiation zone check
        var radCheck = WorldFeatures.checkRadiation(player.position.x, player.position.z);
        var radWarn = document.getElementById('radiation-warning');
        if (radCheck.inZone) {
          if (radWarn) radWarn.style.display = 'block';
          player.hp = Math.max(0, player.hp - radCheck.damage * delta);
          HUD.setHealth(player.hp, player.maxHp);
        } else {
          if (radWarn) radWarn.style.display = 'none';
        }

        // Barbed wire check
        var wireCheck = WorldFeatures.checkWire(player.position.x, player.position.z);
        if (wireCheck.inWire) {
          player.hp = Math.max(0, player.hp - wireCheck.tickDmg * delta);
          HUD.setHealth(player.hp, player.maxHp);
        }
      }

      // Perks update
      if (typeof Perks !== 'undefined') {
        var perkResult = Perks.update(delta);
        if (perkResult.healThisTick > 0) {
          player.hp = Math.min(player.maxHp, player.hp + perkResult.healThisTick);
          HUD.setHealth(player.hp, player.maxHp);
        }
        // Gunship DPS to random enemy (no per-frame filter allocation)
        if (perkResult.gunshipDPS > 0 && Enemies.getAliveCount() > 0) {
          var _allE = Enemies.getAll();
          var _aliveCount = Enemies.getAliveCount();
          var _pick = Math.floor(Math.random() * _aliveCount);
          var _seen = 0;
          for (var _gi = 0; _gi < _allE.length; _gi++) {
            if (_allE[_gi].alive) {
              if (_seen === _pick) {
                Enemies.damage(_allE[_gi], perkResult.gunshipDPS * delta);
                break;
              }
              _seen++;
            }
          }
        }
        // UAV indicator
        var uavInd = document.getElementById('uav-indicator');
        if (uavInd) uavInd.style.display = Perks.isUAVActive() ? 'block' : 'none';

        // Adrenaline indicator
        var adrInd = document.getElementById('adrenaline-indicator');
        if (adrInd) adrInd.style.display = (Perks.getSpeedMult() > 1.1) ? 'block' : 'none';
      }

      // Mission types update
      if (typeof MissionTypes !== 'undefined') {
        var missionResult = MissionTypes.update(delta, player.position);
        if (missionResult) {
          var mTracker = document.getElementById('mission-tracker');
          if (mTracker) {
            if (missionResult.state === 'ACTIVE') {
              mTracker.style.display = 'block';
              var mTitle = document.getElementById('mission-tracker-title');
              if (mTitle) mTitle.textContent = '📍 ' + (MissionTypes.getActive() ? MissionTypes.getActive().config.name : 'MISSION');
              var mTimer = document.getElementById('mission-tracker-timer');
              if (mTimer && missionResult.timeRemaining !== undefined) {
                mTimer.textContent = '⏱ ' + Math.ceil(missionResult.timeRemaining) + 's';
              }
            } else if (missionResult.state === 'COMPLETE') {
              var reward = MissionTypes.completeMission();
              if (reward) {
                HUD.notifyPickup('✅ MISSION COMPLETE! +' + reward.okc + ' OKC +' + reward.xp + ' XP', '#44ff88');
                if (typeof Marketplace !== 'undefined') Marketplace.addOKC(reward.okc);
                if (typeof RankSystem !== 'undefined') RankSystem.addXP(reward.xp);
                if (typeof Progression !== 'undefined') Progression.trackStat('wavesCleared', 0); // mission tracking
              }
              mTracker.style.display = 'none';
            } else if (missionResult.state === 'FAILED') {
              HUD.notifyPickup('❌ MISSION FAILED: ' + (missionResult.reason || ''), '#ff4444');
              mTracker.style.display = 'none';
            }
          }
        }
      }

      // Feedback system update (damage numbers, kill feed, pings, compass)
      if (typeof Feedback !== 'undefined') {
        Feedback.update(delta, CameraSystem.getYaw());

        // Dynamic crosshair update
        var isMoving = player.velocity.length() > 0.1;
        var isFiring = Weapons.didFire && Weapons.didFire();
        var isADS = Weapons.isZoomed && Weapons.isZoomed();
        Feedback.updateDynamicCrosshair(0, isMoving, isFiring, isADS);
      }

      // Progression tracking - play time
      if (typeof Progression !== 'undefined') {
        Progression.trackStat('totalPlayTime', delta);

        // Throttle slow HUD updates (dailies, bounties, prestige) to once per second
        _hudSlowTimer -= delta;
        if (_hudSlowTimer <= 0) {
          _hudSlowTimer = 1.0;

        // Daily challenges display
        var dailyPanel = document.getElementById('daily-challenges');
        if (dailyPanel) {
          var dailies = Progression.getDailies();
          if (dailies.length > 0) {
            dailyPanel.style.display = 'block';
            var dailyList = document.getElementById('daily-challenges-list');
            if (dailyList) {
              var dHTML = '';
              for (var di2 = 0; di2 < dailies.length; di2++) {
                var d = dailies[di2];
                var pct = Math.min(100, Math.round((d.progress / d.target) * 100));
                var color = d.completed ? '#44ff44' : '#ccc';
                dHTML += '<div style="color:' + color + '">' + (d.completed ? '✅' : '⬜') + ' ' + d.name + ': ' + d.progress + '/' + d.target + ' (' + pct + '%)</div>';
              }
              dailyList.innerHTML = dHTML;
            }
          }
        }

        // Bounty display
        var bountyPanel = document.getElementById('bounty-display');
        if (bountyPanel) {
          var bounties = Progression.getBounties();
          if (bounties.length > 0) {
            bountyPanel.style.display = 'block';
            var bountyList = document.getElementById('bounty-list');
            if (bountyList) {
              var bHTML = '';
              for (var bi2 = 0; bi2 < bounties.length; bi2++) {
                var b = bounties[bi2];
                var bpct = Math.min(100, Math.round((b.progress / b.target) * 100));
                var bcolor = b.completed ? '#44ff44' : '#ffaa00';
                bHTML += '<div style="color:' + bcolor + '">' + (b.completed ? '✅' : '💰') + ' ' + b.name + ': ' + b.progress + '/' + b.target + ' (+' + b.reward + ' OKC)</div>';
              }
              bountyList.innerHTML = bHTML;
            }
          }
        }

        // Prestige indicator
        var prestigeInd = document.getElementById('prestige-indicator');
        if (prestigeInd && Progression.getPrestigeLevel() > 0) {
          prestigeInd.textContent = Progression.getPrestigeIcon() + ' P' + Progression.getPrestigeLevel();
        }
        } // end _hudSlowTimer throttle
      }

      // Sync stealth state to enemy detection system
      Enemies.setPlayerStealth(player.stealth);

      // God mode: keep health maxed and stealth on
      if (player.godMode) {
        player.hp = player.maxHp;
        player.stealth = true;
        Enemies.setPlayerStealth(true);
      }
    }

    _renderer.render(_scene, _camera);
  }

  /* ── Extended HUD Updates ────────────────────────────────────────── */
  function updateAIIndicator(strategy) {
    var aiEl = document.getElementById('ai-learning-indicator');
    if (!aiEl) return;
    if (!strategy) {
      aiEl.style.display = 'none';
      return;
    }
    aiEl.style.display = 'block';
    var levels = ['📡 LEARNING', '🔄 ADAPTING', '🧠 COUNTERING'];
    var colors = ['#888888', '#ffaa00', '#ff00ff'];
    var summary = MLSystem.getBehaviorSummary();
    aiEl.textContent = levels[strategy.adaptationLevel] + ' | Style: ' +
      summary.style.toUpperCase() + ' (' + Math.round(summary.confidence * 100) + '%)';
    aiEl.style.color = colors[strategy.adaptationLevel];
    aiEl.style.borderColor = colors[strategy.adaptationLevel];
  }

  function updateExtendedHUD() {
    const timeEl = document.getElementById('hud-time');
    if (timeEl) {
      const info = TimeSystem.getInfo();
      timeEl.textContent = info.time + ' ' + info.phase.toUpperCase() +
        ' | Day ' + info.day + ' | ' + info.season +
        (info.speed > 1 ? ' [x' + info.speed + ']' : '') +
        (info.isPaused ? ' [PAUSED]' : '');
    }

    const rankEl = document.getElementById('hud-rank');
    if (rankEl) {
      const rank = RankSystem.getRank();
      const prog = RankSystem.getProgress();
      rankEl.textContent = rank.icon + ' ' + rank.name +
        ' (' + Math.floor(prog.percent) + '%)';
    }

    const resEl = document.getElementById('hud-resources');
    if (resEl) {
      const r = Economy.getResources();
      resEl.textContent =
        '🪵' + r.wood + ' 🔩' + r.metal + ' ⚡' + r.electronics +
        ' ⛽' + r.fuel + ' 🪨' + r.stone + ' 🍞' + r.food +
        ' | 💰' + Economy.getCurrency();
    }

    const modeEl = document.getElementById('hud-mode');
    if (modeEl) {
      const mode = CameraSystem.getMode();
      const modeNames = { fps: 'FPS', tps: '3RD PERSON', rts: 'STRATEGIC', drone: 'DRONE FPV', vehicle: 'VEHICLE' };
      let label = modeNames[mode] || mode;
      if (gameState === STATE.BUILD_MODE) label = 'BUILD MODE';
      if (DroneSystem.isPossessing()) {
        const d = DroneSystem.getPossessed();
        label = 'DRONE: ' + d.type.toUpperCase() + ' [' + Math.floor(d.battery) + 's]';
      }
      if (VehicleSystem.isInVehicle()) {
        const v = VehicleSystem.getOccupied();
        label = 'VEHICLE: ' + v.type.toUpperCase() + ' [' + v.health + '/' + v.maxHealth + ']';
      }
      modeEl.textContent = label;
    }

    const npcEl = document.getElementById('hud-npcs');
    if (npcEl) {
      npcEl.textContent = 'NPCs: ' + NPCSystem.getCount() +
        ' | Morale: ' + Math.floor(NPCSystem.getAverageMorale()) + '%';
    }

    const missionEl = document.getElementById('hud-missions');
    if (missionEl) {
      const active = MissionSystem.getActive();
      if (active.length > 0) {
        missionEl.textContent = '📋 ' + active[0].name + ' (' + active[0].status + ')';
      } else {
        missionEl.textContent = '📋 No active missions';
      }
    }
  }

  /* ── Mobile Controls Setup ─────────────────────────────────────── */
  function setupMobileControls() {
    const joystickZone  = document.getElementById('joystick-zone');
    const joystickThumb = document.getElementById('joystick-thumb');
    const baseSize      = joystickZone.offsetWidth || 140;
    const thumbSize     = joystickThumb.offsetWidth || 60;
    const maxDist       = (baseSize - thumbSize) / 2;

    // Joystick touch handling
    joystickZone.addEventListener('touchstart', function (e) {
      e.preventDefault();
      const t = e.changedTouches[0];
      touch.moveTouchId = t.identifier;
      touch.moveActive = true;
      const rect = joystickZone.getBoundingClientRect();
      touch.moveStartX = rect.left + baseSize / 2;
      touch.moveStartY = rect.top + baseSize / 2;
    }, { passive: false });

    joystickZone.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touch.moveTouchId) {
          let dx = t.clientX - touch.moveStartX;
          let dy = t.clientY - touch.moveStartY;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > maxDist) {
            dx = dx / dist * maxDist;
            dy = dy / dist * maxDist;
            dist = maxDist;
          }
          touch.moveX = dx / maxDist;
          touch.moveY = dy / maxDist;
          joystickThumb.style.left = (baseSize / 2 - thumbSize / 2 + dx) + 'px';
          joystickThumb.style.top  = (baseSize / 2 - thumbSize / 2 + dy) + 'px';
        }
      }
    }, { passive: false });

    function resetJoystick() {
      touch.moveTouchId = null;
      touch.moveActive = false;
      touch.moveX = 0;
      touch.moveY = 0;
      joystickThumb.style.left = (baseSize / 2 - thumbSize / 2) + 'px';
      joystickThumb.style.top  = (baseSize / 2 - thumbSize / 2) + 'px';
    }
    joystickZone.addEventListener('touchend', function (e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touch.moveTouchId) resetJoystick();
      }
    }, { passive: true });
    joystickZone.addEventListener('touchcancel', function (e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touch.moveTouchId) resetJoystick();
      }
    }, { passive: true });

    // Fire button
    const btnFire = document.getElementById('btn-fire');
    btnFire.addEventListener('touchstart', function (e) {
      e.preventDefault();
      touch.firing = true;
      mouseNewPress = true;
      btnFire.classList.add('active');
    }, { passive: false });
    btnFire.addEventListener('touchend', function () {
      touch.firing = false;
      mouseNewPress = false;
      btnFire.classList.remove('active');
    });
    btnFire.addEventListener('touchcancel', function () {
      touch.firing = false;
      mouseNewPress = false;
      btnFire.classList.remove('active');
    });

    // Reload button
    const btnReload = document.getElementById('btn-reload');
    btnReload.addEventListener('touchstart', function (e) {
      e.preventDefault();
      Weapons.forceReload();
      AudioSystem.playReload();
      MLSystem.onReload();
      btnReload.classList.add('active');
    }, { passive: false });
    btnReload.addEventListener('touchend', function () { btnReload.classList.remove('active'); });

    // Jump button
    const btnJump = document.getElementById('btn-jump');
    btnJump.addEventListener('touchstart', function (e) {
      e.preventDefault();
      touch.jumping = true;
      btnJump.classList.add('active');
    }, { passive: false });
    btnJump.addEventListener('touchend', function () {
      touch.jumping = false;
      btnJump.classList.remove('active');
    });

    // Sprint button (toggle)
    const btnSprint = document.getElementById('btn-sprint');
    btnSprint.addEventListener('touchstart', function (e) {
      e.preventDefault();
      touch.sprinting = !touch.sprinting;
      btnSprint.classList.toggle('active', touch.sprinting);
    }, { passive: false });

    // Weapon prev/next
    const btnPrev = document.getElementById('btn-weapon-prev');
    const btnNext = document.getElementById('btn-weapon-next');
    btnPrev.addEventListener('touchstart', function (e) {
      e.preventDefault();
      Weapons.switchPrev();
      btnPrev.classList.add('active');
    }, { passive: false });
    btnPrev.addEventListener('touchend', function () { btnPrev.classList.remove('active'); });
    btnNext.addEventListener('touchstart', function (e) {
      e.preventDefault();
      Weapons.switchNext();
      btnNext.classList.add('active');
    }, { passive: false });
    btnNext.addEventListener('touchend', function () { btnNext.classList.remove('active'); });

    // Pause / inventory button
    const btnPause = document.getElementById('btn-pause');
    btnPause.addEventListener('touchstart', function (e) {
      e.preventDefault();
      toggleInventory();
    }, { passive: false });
  }

  /* ── Inventory / Pause Toggle ───────────────────────────────────── */
  function toggleInventory() {
    const invOverlay = document.getElementById('inventory-overlay');
    if (gameState === STATE.PLAYING || gameState === STATE.BUILD_MODE) {
      gameState = STATE.PAUSED;
      showInventory();
      invOverlay.style.display = 'flex';
    } else if (gameState === STATE.PAUSED) {
      gameState = STATE.PLAYING;
      invOverlay.style.display = 'none';
      hideOverlays();
      requestPointerLock();
    }
  }

  function showInventory() {
    // ── Materials / Resources section ──
    var matGrid = document.getElementById('materials-grid');
    if (matGrid) {
      matGrid.innerHTML = '';
      var resIcons = { wood: '🪵', metal: '🔩', electronics: '⚡', fuel: '⛽', stone: '🪨', food: '🍞' };
      var resColors = { wood: '#8B6914', metal: '#aaa', electronics: '#00ccff', fuel: '#ff8800', stone: '#999', food: '#aacc44' };
      var resources = Economy.getResources();
      for (var resType in resources) {
        var cell = document.createElement('div');
        cell.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid ' + (resColors[resType] || '#555') + ';border-radius:4px;padding:6px;text-align:center';
        cell.innerHTML = '<div style="font-size:20px">' + (resIcons[resType] || '📦') + '</div>' +
          '<div style="font-size:11px;color:#ccc;text-transform:uppercase">' + resType + '</div>' +
          '<div style="font-size:16px;font-weight:bold;color:' + (resColors[resType] || '#fff') + '">' + resources[resType] + '</div>';
        matGrid.appendChild(cell);
      }
    }
    var currDisplay = document.getElementById('currency-display');
    if (currDisplay) {
      currDisplay.textContent = '💰 Currency: ' + Economy.getCurrency() + ' gold';
    }

    // ── Weapons grid ──
    var grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var count = Weapons.getWeaponCount();
    var curIdx = Weapons.getCurrentIdx();
    for (var i = 0; i < count; i++) {
      var slot = document.createElement('div');
      slot.className = 'inv-slot';
      var isUnlocked = Weapons.isUnlocked(i);
      if (!isUnlocked) {
        slot.classList.add('locked');
        slot.textContent = '🔒 ' + Weapons.getWeaponName(i);
      } else {
        var info = Weapons.getWeaponInfo(i);
        if (i === curIdx) slot.classList.add('active');
        slot.textContent = info.name + '\n⚔' + info.damage;
        if (info.clip !== undefined && info.type !== 'MELEE') {
          slot.textContent += ' | ' + info.clip + '/' + info.reserve;
        }
      }
      slot.style.whiteSpace = 'pre-line';

      // Allow tapping to switch weapons
      if (isUnlocked) {
        (function (idx) {
          slot.addEventListener('click', function () {
            Weapons.switchTo(idx);
            showInventory();
          });
        })(i);
      }
      grid.appendChild(slot);
    }

    var statsEl = document.getElementById('player-stats');
    if (statsEl) {
      var stage = STAGES[currentStage];
      var npcCount = (typeof NPCSystem !== 'undefined' && NPCSystem.getAll) ? NPCSystem.getAll().length : 0;
      var vehicleCount = VehicleSystem.getAll().length;
      var droneCount = (typeof DroneSystem !== 'undefined' && DroneSystem.getAll) ? DroneSystem.getAll().length : 0;
      statsEl.innerHTML =
        '❤ HP: ' + player.hp + '/' + player.maxHp +
        ' &nbsp;|&nbsp; 🏆 Score: ' + player.score +
        ' &nbsp;|&nbsp; 💀 Kills: ' + player.kills +
        '<br>📍 Stage ' + stage.id + ': ' + stage.name +
        ' &nbsp;|&nbsp; 🌊 Wave: ' + currentWave + '/' + stage.wavesPerStage +
        '<br>👥 NPCs: ' + npcCount +
        ' &nbsp;|&nbsp; 🚗 Vehicles: ' + vehicleCount +
        ' &nbsp;|&nbsp; 🛸 Drones: ' + droneCount;
    }
  }

  /* ── Role / Stealth / Weapons-grid helpers ────────────────────────── */
  function setRole(r) {
    player.role = (r === 'brigade') ? 'brigade' : 'lonewolf';
    updateRoleIndicator();
    HUD.notifyPickup(player.role === 'brigade' ? '🎖 ASSAULT BRIGADE' : '🐺 LONE WOLF',
      player.role === 'brigade' ? '#00aaff' : '#ffaa00');
  }

  function updateRoleIndicator() {
    var el = document.getElementById('role-indicator');
    if (el) {
      el.textContent = player.role === 'brigade' ? '🎖 BRIGADE' : '🐺 LONE WOLF';
      el.style.color = player.role === 'brigade' ? '#0af' : '#fa0';
    }
    // highlight active button on start screen
    var sb = document.getElementById('start-role-brigade');
    var sl = document.getElementById('start-role-lonewolf');
    if (sb) sb.style.opacity = player.role === 'brigade' ? '1' : '0.4';
    if (sl) sl.style.opacity = player.role === 'lonewolf' ? '1' : '0.4';
    // highlight active button on pause screen
    var pb = document.getElementById('role-brigade-btn');
    var pl = document.getElementById('role-lonewolf-btn');
    if (pb) pb.style.opacity = player.role === 'brigade' ? '1' : '0.4';
    if (pl) pl.style.opacity = player.role === 'lonewolf' ? '1' : '0.4';
  }

  function toggleStealth() {
    player.stealth = !player.stealth;
    var stInd = document.getElementById('stealth-indicator');
    if (stInd) stInd.style.display = player.stealth ? 'block' : 'none';
    HUD.notifyPickup(player.stealth ? '👻 STEALTH ON' : '👁 STEALTH OFF',
      player.stealth ? '#00ff66' : '#ff6600');
    // update pause button text
    var btn = document.getElementById('stealth-toggle-btn');
    if (btn) btn.textContent = player.stealth ? '👻 STEALTH ON' : '👻 TOGGLE STEALTH';
  }

  function toggleGodMode() {
    player.godMode = !player.godMode;
    if (player.godMode) {
      // Unlock all weapons
      for (var i = 0; i < Weapons.getWeaponCount(); i++) {
        Weapons.unlockWeapon(i);
      }
      // Set infinite health
      player.maxHp = GOD_MODE_HP;
      player.hp = GOD_MODE_HP;
      HUD.setHealth(player.hp, player.maxHp);
      // Enable stealth (enemies can't see player)
      player.stealth = true;
      Enemies.setPlayerStealth(true);
      var stInd = document.getElementById('stealth-indicator');
      if (stInd) stInd.style.display = 'block';
      HUD.notifyPickup('⚡ GOD MODE ACTIVATED', '#ffff00');
    } else {
      // Reset health
      player.maxHp = 100;
      player.hp = 100;
      HUD.setHealth(player.hp, player.maxHp);
      // Disable forced stealth
      player.stealth = false;
      Enemies.setPlayerStealth(false);
      var stInd = document.getElementById('stealth-indicator');
      if (stInd) stInd.style.display = 'none';
      HUD.notifyPickup('⚡ GOD MODE DEACTIVATED', '#ff6600');
    }
  }

  function isGodMode() { return player.godMode; }

  function populateWeaponsGrid(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    var count = Weapons.getWeaponCount();
    for (var i = 0; i < count; i++) {
      var info = Weapons.getWeaponInfo(i);
      if (!info) continue;
      var cell = document.createElement('div');
      cell.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid #444;padding:4px;border-radius:3px;text-align:center;color:#ccc';
      var key = i < 9 ? String(i + 1) : (i === 9 ? '0' : '');
      cell.innerHTML = '<div style="color:#fff;font-weight:bold;font-size:11px">' + (key ? '[' + key + '] ' : '') + info.name + '</div>' +
        '<div style="font-size:9px;color:#aaa">' + info.type + ' · DMG ' + info.damage + '</div>';
      el.appendChild(cell);
    }
  }

  /* ── Resize ──────────────────────────────────────────────────────── */
  function onResize() {
    _camera.aspect = window.innerWidth / window.innerHeight;
    _camera.updateProjectionMatrix();
    _renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ── Marketplace UI Builder ─────────────────────────────────────── */
  function refreshMarketplaceUI(tab) {
    /* Update OKC display everywhere */
    var okc = typeof Marketplace !== 'undefined' ? Marketplace.getOKC() : 0;
    var okcEl = document.getElementById('inv-okc-display');
    if (okcEl) okcEl.textContent = '🪙 ' + okc + ' OKC';
    var hudOkc = document.getElementById('hud-okc');
    if (hudOkc) hudOkc.textContent = '🪙 ' + okc + ' OKC';

    /* Premium tag */
    var premTag = document.getElementById('hud-premium-tag');
    if (premTag && typeof Marketplace !== 'undefined' && Marketplace.isPremium()) {
      var pi = Marketplace.getPremiumInfo();
      premTag.textContent = pi.name + ' (' + pi.daysLeft + 'd)';
      premTag.style.display = 'inline';
    } else if (premTag) {
      premTag.style.display = 'none';
    }

    if (tab === 'shop') { buildShopUI(); }
    else if (tab === 'sell') { buildSellUI(); }
    else if (tab === 'premium') { buildPremiumUI(); }
    else if (tab === 'assets') { buildAssetsUI(); }
  }

  function buildShopUI() {
    var grid = document.getElementById('shop-items-grid');
    if (!grid || typeof Marketplace === 'undefined') return;
    grid.innerHTML = '';
    var items = Marketplace.getShopItems();
    for (var i = 0; i < items.length; i++) {
      (function (idx) {
        var it = items[idx];
        var cell = document.createElement('div');
        cell.style.cssText = 'background:rgba(255,215,0,0.05);border:1px solid #555;border-radius:6px;padding:8px;text-align:center';
        var discOkc = Marketplace.getDiscountedPrice(it.okcCost);
        cell.innerHTML =
          '<div style="color:#fff;font-weight:bold;font-size:12px">' + it.name + '</div>' +
          '<div style="font-size:10px;color:#ffd700;margin:4px 0">🪙 ' + discOkc + ' OKC | 💎 ' + it.polCost + ' POL</div>';
        var btnOkc = document.createElement('button');
        btnOkc.className = 'btn';
        btnOkc.style.cssText = 'font-size:10px;padding:2px 8px;border-color:#ffd700;color:#ffd700;margin:2px';
        btnOkc.textContent = 'Buy (OKC)';
        btnOkc.addEventListener('click', function () {
          var result = Marketplace.buyItemWithOKC(idx);
          if (result) {
            applyShopItem(result);
            HUD.notifyPickup('✅ ' + result.name, '#ffd700');
            refreshMarketplaceUI('shop');
          } else {
            HUD.notifyPickup('❌ Not enough OKC', '#ff4444');
          }
        });
        cell.appendChild(btnOkc);

        var btnPol = document.createElement('button');
        btnPol.className = 'btn';
        btnPol.style.cssText = 'font-size:10px;padding:2px 8px;border-color:#8247e5;color:#8247e5;margin:2px';
        btnPol.textContent = 'Buy (POL)';
        btnPol.addEventListener('click', function () {
          Marketplace.buyItemWithPOL(idx).then(function (result) {
            if (result) {
              applyShopItem(result);
              HUD.notifyPickup('✅ ' + result.name + ' (POL)', '#8247e5');
              refreshMarketplaceUI('shop');
            } else {
              HUD.notifyPickup('❌ Transaction failed', '#ff4444');
            }
          });
        });
        cell.appendChild(btnPol);
        grid.appendChild(cell);
      })(i);
    }
  }

  function applyShopItem(item) {
    if (item.type === 'ammo') { Weapons.addAmmo(item.value); }
    else if (item.type === 'health') {
      player.hp = Math.min(player.maxHp, player.hp + item.value);
      HUD.setHealth(player.hp, player.maxHp);
    } else if (item.type === 'armor') {
      player.maxHp += item.value;
      player.hp += item.value;
      HUD.setHealth(player.hp, player.maxHp);
    } else if (item.type === 'grenade') {
      Weapons.addAmmo(item.value);
    }
  }

  function buildSellUI() {
    var grid = document.getElementById('sell-weapons-grid');
    var ammoGrid = document.getElementById('sell-ammo-grid');
    if (!grid || typeof Marketplace === 'undefined') return;
    grid.innerHTML = '';
    if (ammoGrid) ammoGrid.innerHTML = '';
    var count = Weapons.getWeaponCount();
    for (var i = 0; i < count; i++) {
      (function (idx) {
        var info = Weapons.getWeaponInfo(idx);
        if (!info) return;
        var priceOkc = Marketplace.getWeaponPriceOKC(info.id || Weapons.getWeaponId(idx));
        var pricePol = Marketplace.getWeaponPricePOL(info.id || Weapons.getWeaponId(idx));
        if (priceOkc <= 0) return;
        if (!Weapons.isUnlocked(idx)) return;

        var cell = document.createElement('div');
        cell.style.cssText = 'background:rgba(255,136,68,0.05);border:1px solid #555;border-radius:6px;padding:6px;text-align:center';
        cell.innerHTML =
          '<div style="color:#fff;font-size:11px;font-weight:bold">' + info.name + '</div>' +
          '<div style="font-size:10px;color:#ff8844;margin:2px 0">🪙 ' + priceOkc + ' OKC | 💎 ' + pricePol + ' POL</div>';

        var sellBtn = document.createElement('button');
        sellBtn.className = 'btn';
        sellBtn.style.cssText = 'font-size:10px;padding:2px 8px;border-color:#ff8844;color:#ff8844;margin:2px';
        sellBtn.textContent = 'Sell (OKC)';
        sellBtn.addEventListener('click', function () {
          var earned = Marketplace.sellWeaponForOKC(idx);
          if (earned > 0) {
            HUD.notifyPickup('💰 Sold for ' + earned + ' OKC', '#ffd700');
            refreshMarketplaceUI('sell');
          }
        });
        cell.appendChild(sellBtn);
        grid.appendChild(cell);

        /* Ammo sell option */
        var state = Weapons.getWeaponState(idx);
        if (state && state.reserve > 0 && ammoGrid) {
          var aCell = document.createElement('div');
          aCell.style.cssText = 'background:rgba(255,136,68,0.05);border:1px solid #444;border-radius:6px;padding:6px;text-align:center';
          var sellAmt = Math.min(state.reserve, 50);
          var ammoVal = sellAmt * 2;
          aCell.innerHTML =
            '<div style="color:#ccc;font-size:10px">' + info.name + ' ammo (' + state.reserve + ')</div>' +
            '<div style="font-size:10px;color:#ffd700">Sell ' + sellAmt + ' → 🪙 ' + ammoVal + ' OKC</div>';
          var aSellBtn = document.createElement('button');
          aSellBtn.className = 'btn';
          aSellBtn.style.cssText = 'font-size:9px;padding:2px 6px;border-color:#ff8844;color:#ff8844;margin:2px';
          aSellBtn.textContent = 'Sell Ammo';
          aSellBtn.addEventListener('click', function () {
            var earned = Marketplace.sellAmmoForOKC(idx, sellAmt);
            if (earned > 0) {
              HUD.notifyPickup('💰 Sold ammo for ' + earned + ' OKC', '#ffd700');
              refreshMarketplaceUI('sell');
            }
          });
          aCell.appendChild(aSellBtn);
          ammoGrid.appendChild(aCell);
        }
      })(i);
    }
  }

  function buildPremiumUI() {
    var grid = document.getElementById('premium-tiers-grid');
    var status = document.getElementById('premium-status');
    if (!grid || typeof Marketplace === 'undefined') return;
    grid.innerHTML = '';

    if (Marketplace.isPremium()) {
      var pi = Marketplace.getPremiumInfo();
      if (status) {
        status.style.display = 'block';
        status.innerHTML = '✅ Active: <b>' + pi.name + '</b> — ' + pi.daysLeft + ' days remaining';
      }
    } else if (status) {
      status.style.display = 'none';
    }

    var tiers = Marketplace.getPremiumTiers();
    for (var i = 0; i < tiers.length; i++) {
      (function (idx) {
        var tier = tiers[idx];
        var cell = document.createElement('div');
        cell.style.cssText = 'background:rgba(130,71,229,0.08);border:1px solid #8247e5;border-radius:8px;padding:10px;text-align:center';
        var perksHtml = tier.perks.map(function (p) { return '<div style="font-size:9px;color:#aaa">• ' + p + '</div>'; }).join('');
        cell.innerHTML =
          '<div style="color:#fff;font-weight:bold;font-size:13px">' + tier.name + '</div>' +
          '<div style="font-size:11px;color:#8247e5;margin:4px 0">' + tier.duration + ' days</div>' +
          perksHtml +
          '<div style="font-size:11px;color:#ffd700;margin:6px 0">🪙 ' + tier.okcCost + ' OKC | 💎 ' + tier.polCost + ' POL</div>';

        var btnOkc = document.createElement('button');
        btnOkc.className = 'btn';
        btnOkc.style.cssText = 'font-size:10px;padding:3px 8px;border-color:#ffd700;color:#ffd700;margin:2px';
        btnOkc.textContent = 'Buy (OKC)';
        btnOkc.addEventListener('click', function () {
          if (Marketplace.buyPremiumWithOKC(idx)) {
            HUD.notifyPickup('⭐ ' + tier.name + ' activated!', '#8247e5');
            refreshMarketplaceUI('premium');
          } else {
            HUD.notifyPickup('❌ Not enough OKC', '#ff4444');
          }
        });
        cell.appendChild(btnOkc);

        var btnPol = document.createElement('button');
        btnPol.className = 'btn';
        btnPol.style.cssText = 'font-size:10px;padding:3px 8px;border-color:#8247e5;color:#8247e5;margin:2px';
        btnPol.textContent = 'Buy (POL)';
        btnPol.addEventListener('click', function () {
          Marketplace.buyPremiumWithPOL(idx).then(function (ok) {
            if (ok) {
              HUD.notifyPickup('⭐ ' + tier.name + ' activated! (POL)', '#8247e5');
              refreshMarketplaceUI('premium');
            } else {
              HUD.notifyPickup('❌ Transaction failed', '#ff4444');
            }
          });
        });
        cell.appendChild(btnPol);
        grid.appendChild(cell);
      })(i);
    }
  }

  function buildAssetsUI() {
    var grid = document.getElementById('assets-grid');
    if (!grid || typeof Marketplace === 'undefined') return;
    grid.innerHTML = '';
    var assets = Marketplace.getGameAssets();
    for (var i = 0; i < assets.length; i++) {
      (function (idx) {
        var asset = assets[idx];
        var owned = Marketplace.ownsAsset(asset.id);
        var cell = document.createElement('div');
        cell.style.cssText = 'background:rgba(0,255,204,0.05);border:1px solid ' + (owned ? '#0f6' : '#555') + ';border-radius:6px;padding:8px;text-align:center';
        cell.innerHTML =
          '<div style="color:#fff;font-weight:bold;font-size:11px">' + asset.name + '</div>' +
          '<div style="font-size:9px;color:#aaa;margin:2px 0">' + asset.type.toUpperCase() + '</div>' +
          (owned ? '<div style="color:#0f6;font-size:10px">✅ OWNED</div>'
            : '<div style="font-size:10px;color:#ffd700;margin:4px 0">🪙 ' + asset.okcCost + ' OKC | 💎 ' + asset.polCost + ' POL</div>');

        if (!owned) {
          var btnOkc = document.createElement('button');
          btnOkc.className = 'btn';
          btnOkc.style.cssText = 'font-size:9px;padding:2px 6px;border-color:#ffd700;color:#ffd700;margin:2px';
          btnOkc.textContent = 'Buy (OKC)';
          btnOkc.addEventListener('click', function () {
            if (Marketplace.buyAssetWithOKC(idx)) {
              HUD.notifyPickup('🎨 ' + asset.name + ' unlocked!', '#00ffcc');
              refreshMarketplaceUI('assets');
            } else {
              HUD.notifyPickup('❌ Not enough OKC', '#ff4444');
            }
          });
          cell.appendChild(btnOkc);

          var btnPol = document.createElement('button');
          btnPol.className = 'btn';
          btnPol.style.cssText = 'font-size:9px;padding:2px 6px;border-color:#8247e5;color:#8247e5;margin:2px';
          btnPol.textContent = 'Buy (POL)';
          btnPol.addEventListener('click', function () {
            Marketplace.buyAssetWithPOL(idx).then(function (ok) {
              if (ok) {
                HUD.notifyPickup('🎨 ' + asset.name + ' unlocked! (POL)', '#00ffcc');
                refreshMarketplaceUI('assets');
              } else {
                HUD.notifyPickup('❌ Transaction failed', '#ff4444');
              }
            });
          });
          cell.appendChild(btnPol);
        }
        grid.appendChild(cell);
      })(i);
    }
  }

  /* ── 59 Features: Helper Functions ──────────────────────────────── */

  /** Open perks selection menu */
  function _openPerksMenu() {
    if (typeof Perks === 'undefined') return;
    var grid = document.getElementById('perks-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var allPerks = Object.values(Perks.PERK_LIST);
    for (var i = 0; i < allPerks.length; i++) {
      (function (perk) {
        var cell = document.createElement('div');
        var equipped = Perks.hasPerk(perk.id);
        cell.style.cssText = 'padding:10px;border:1px solid ' + (equipped ? '#44ff44' : '#555') + ';border-radius:6px;cursor:pointer;background:rgba(' + (equipped ? '0,100,0' : '50,50,50') + ',0.3)';
        cell.innerHTML = '<div style="font-size:20px">' + perk.icon + '</div><div style="color:#ffcc00;font-weight:bold;font-size:12px">' + perk.name + '</div><div style="color:#aaa;font-size:10px;margin-top:4px">' + perk.desc + '</div>' + (equipped ? '<div style="color:#44ff44;font-size:10px;margin-top:4px">✅ EQUIPPED</div>' : '');
        cell.addEventListener('click', function () {
          if (equipped) {
            Perks.unequipPerk(perk.id);
          } else {
            if (!Perks.equipPerk(perk.id)) {
              HUD.notifyPickup('⚠ Max 3 perks equipped!', '#ff4444');
              return;
            }
          }
          _openPerksMenu(); // refresh
          _updatePerkDisplay();
        });
        grid.appendChild(cell);
      })(allPerks[i]);
    }
  }

  /** Update perk display slots in HUD */
  function _updatePerkDisplay() {
    if (typeof Perks === 'undefined') return;
    var equipped = Perks.getEquipped();
    for (var i = 0; i < 3; i++) {
      var slot = document.getElementById('perk-slot-' + (i + 1));
      if (!slot) continue;
      if (equipped[i]) {
        slot.style.display = 'block';
        slot.textContent = equipped[i].icon + ' ' + equipped[i].name;
      } else {
        slot.style.display = 'none';
      }
    }
  }

  /** Open war journal panel */
  function _openJournal() {
    if (typeof Progression === 'undefined') return;
    var content = document.getElementById('journal-content');
    if (!content) return;
    var entries = Progression.getJournal();
    if (entries.length === 0) {
      content.innerHTML = '<div style="color:#888;text-align:center">No entries yet. Kill enemies and explore to unlock intel.</div>';
      return;
    }
    var html = '';
    var cats = Progression.JOURNAL_CATEGORIES;
    for (var cat in cats) {
      var catEntries = Progression.getJournalByCategory(cat);
      if (catEntries.length === 0) continue;
      html += '<div style="color:#8B6914;font-weight:bold;margin-top:12px;border-bottom:1px solid #444;padding-bottom:4px">' + cats[cat] + '</div>';
      for (var j = 0; j < catEntries.length; j++) {
        html += '<div style="margin:6px 0;padding:6px;background:rgba(139,105,20,0.1);border-radius:4px"><div style="color:#ddd;font-weight:bold">' + catEntries[j].title + '</div><div style="color:#aaa;font-size:11px">' + catEntries[j].text + '</div></div>';
      }
    }
    content.innerHTML = html;
  }

  /** Activate a killstreak reward */
  function _activateStreak(index) {
    if (typeof Perks === 'undefined') return;
    var streak = Perks.activateStreak(index);
    if (!streak) return;
    HUD.notifyPickup(streak.icon + ' ' + streak.name + ' ACTIVATED!', '#ff6600');
    AudioSystem.playExplosion();
    if (CameraSystem.shake) CameraSystem.shake(0.4, 0.5);

    if (streak.id === 'ARTILLERY' || streak.id === 'AIRSTRIKE') {
      // Damage enemies in area around player's aim point
      var fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(_camera.quaternion);
      var target = player.position.clone().add(fwd.multiplyScalar(30));
      Enemies.damageInRadius(target, streak.radius || 15, streak.damage || 200);
      if (typeof Tracers !== 'undefined') Tracers.spawnExplosion(target, (streak.radius || 15) * 0.3);
    } else if (streak.id === 'NUKE') {
      // Kill all enemies
      var allEn = Enemies.getAll();
      for (var i = 0; i < allEn.length; i++) {
        if (allEn[i].alive) Enemies.damage(allEn[i], 99999);
      }
      if (typeof Tracers !== 'undefined') Tracers.spawnExplosion(player.position, 10);
      HUD.notifyPickup('☢️ TACTICAL NUKE DEPLOYED!', '#ff0000');
    } else if (streak.id === 'ORBITAL') {
      // Massive area damage
      Enemies.damageInRadius(player.position, streak.radius || 20, streak.damage || 500);
      if (typeof Tracers !== 'undefined') Tracers.spawnExplosion(player.position, 8);
    }
    // Refresh killstreak panel
    var ksList = document.getElementById('killstreak-list');
    if (ksList) {
      var avail = Perks.getAvailableStreaks();
      if (avail.length === 0) {
        document.getElementById('killstreak-panel').style.display = 'none';
        ksList.innerHTML = '';
      }
    }
  }

  /* ── Public API ──────────────────────────────────────────────────── */
  return {
    STATE,
    STAGES,
    init,
    startGame,
    nextStage,
    update,
    beginWave,
    showOverlay,
    hideOverlays,
    requestPointerLock,
    toggleInventory,
    isMobile,
    setRole,
    toggleStealth,
    toggleGodMode,
    isGodMode,
    populateWeaponsGrid,
    updateRoleIndicator,
    refreshMarketplaceUI,
    getState:        function () { return gameState; },
    setState:        function (s) { gameState = s; },
    getPlayer:       function () { return player; },
    getScene:        function () { return _scene; },
    getCamera:       function () { return _camera; },
    getCurrentWave:  function () { return currentWave; },
    getCurrentStage: function () { return currentStage; },
    getStageInfo:    function () { return STAGES[currentStage]; },
    isSprinting:     function () { return player.sprinting; },
    _activateStreak: _activateStreak,
    _openPerksMenu: _openPerksMenu,
    _openJournal: _openJournal,
  };
})();
