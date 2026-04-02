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
  };

  /* ── Wave State ──────────────────────────────────────────────────── */
  let currentWave = 0;
  const SCORE_WAVE_BONUS = 500;

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
          Enemies.damageInRadius(target.mesh.position, 8, 80);
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
        // Spawn armored enemies in formation
        for (let i = 0; i < 4; i++) {
          const fa = (Math.random() - 0.5) * 1.5;
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
          if (allEnemies[i].alive) {
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
  let ambLight  = null;
  let hemiLight = null;

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    // Create renderer
    _renderer = new THREE.WebGLRenderer({ antialias: true });
    _renderer.setSize(window.innerWidth, window.innerHeight);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left   = -50;
    sunLight.shadow.camera.right  =  50;
    sunLight.shadow.camera.top    =  50;
    sunLight.shadow.camera.bottom = -50;
    _scene.add(sunLight);

    hemiLight = new THREE.HemisphereLight(0xFFD700, 0x0057B8, 0.6);
    _scene.add(hemiLight);

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

    // Create weapons
    Weapons.createGunMesh(_camera);
    Weapons.createMuzzleFlash(_scene, _camera);

    // Time system callbacks
    TimeSystem.onWeekChange(function () {
      Economy.weeklyUpdate();
    });
    TimeSystem.onPhaseChange(function (phase) {
      HUD.notifyPickup(phase === 'night' ? '🌙 NIGHT FALLS' : '☀️ DAY BREAKS', '#FFCC00');
    });

    // Mission completion callback
    MissionSystem.onMissionComplete(function (mission, reward) {
      HUD.notifyPickup('MISSION COMPLETE: ' + mission.name, '#00FF88');
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
        if (e.code === 'KeyP')   TimeSystem.togglePause();

        // Camera mode toggle
        if (e.code === 'KeyV') CameraSystem.cycleMode();

        // Build mode
        if (e.code === 'KeyB') {
          if (gameState === STATE.BUILD_MODE) {
            gameState = STATE.PLAYING;
            Building.setBuildMode(false);
            Building.cancelTemplate();
            document.getElementById('build-hud').style.display = 'none';
          } else {
            gameState = STATE.BUILD_MODE;
            Building.setBuildMode(true);
            document.getElementById('build-hud').style.display = 'block';
          }
        }

        // Drone possession
        if (e.code === 'KeyF') {
          if (DroneSystem.isPossessing()) {
            DroneSystem.release();
          } else {
            const drones = DroneSystem.getAll();
            if (drones.length > 0) DroneSystem.possess(drones[0].id);
          }
        }

        // Vehicle enter/exit/hijack
        if (e.code === 'KeyG') {
          if (VehicleSystem.isInVehicle()) {
            const exitPos = VehicleSystem.exit();
            if (exitPos) {
              player.position.copy(exitPos);
              player.position.y += player.height;
            }
          } else {
            const nearby = VehicleSystem.getNearby(player.position, 5);
            if (nearby.length > 0) {
              var targetVehicle = nearby[0];
              if (targetVehicle.faction === 'enemy') {
                // Hijack enemy vehicle — steal it
                VehicleSystem.hijack(targetVehicle.id);
                HUD.notifyPickup('🚗 VEHICLE HIJACKED!', '#ff4444');
              } else if (targetVehicle.occupied) {
                // Hijack friendly vehicle if already occupied
                VehicleSystem.hijack(targetVehicle.id);
                HUD.notifyPickup('🚗 VEHICLE COMMANDEERED!', '#ffaa00');
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

        // Stealth / invisibility toggle
        if (e.code === 'KeyI') {
          toggleStealth();
        }

        // Prone toggle
        if (e.code === 'KeyZ') {
          player.prone = !player.prone;
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
        }

        // Music toggle
        if (e.code === 'KeyM') {
          if (AudioSystem.isMusicPlaying && AudioSystem.isMusicPlaying()) {
            AudioSystem.stopMusic();
            HUD.notifyPickup('🔇 MUSIC OFF', '#888888');
          } else {
            AudioSystem.playMusic('battle');
            HUD.notifyPickup('🎵 MUSIC ON', '#00ff88');
          }
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
        if (e.code === 'KeyQ')   Weapons.switchPrev();
        if (e.code === 'KeyE' && gameState === STATE.PLAYING) Weapons.switchNext();
        if (e.code === 'KeyR')   { Weapons.forceReload(); AudioSystem.playReload(); MLSystem.onReload(); }

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

      // Pause toggle
      if (e.code === 'Escape') {
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
        Weapons.handleRightDown();
      }
    });

    document.addEventListener('mouseup', function (e) {
      if (e.button === 0) { mouseDown = false; mouseNewPress = false; }
      if (e.button === 2) { Weapons.handleRightUp(); }
    });

    document.addEventListener('mousemove', function (e) {
      if (document.pointerLockElement) {
        CameraSystem.handleMouseMove(e.movementX, e.movementY);
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

    // Apply first stage
    applyStage(0);

    const spawnH = VoxelWorld.getTerrainHeight(0, 0);
    player.position.set(0, spawnH + player.height, 0);

    Weapons.reset();
    Enemies.clear();
    Pickups.clear();
    VehicleSystem.clear();
    DroneSystem.clear();
    if (typeof Tracers !== 'undefined') Tracers.clear();

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
    setTimeout(function () {
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
    _scene.fog = new THREE.Fog(stageDef.fogColor, 14, 80);

    // Update lighting
    if (sunLight) {
      sunLight.color.setHex(stageDef.sunColor);
      sunLight.intensity = stageDef.sunIntensity;
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

    // Clear enemies and pickups from old stage
    Enemies.clear();
    Pickups.clear();
    DroneSystem.clear();

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
    setTimeout(function () {
      beginWave(1);
    }, 3200);
  }

  /* ── Wave Management ─────────────────────────────────────────────── */
  function beginWave(w) {
    currentWave = w;
    const stageDef = STAGES[currentStage];
    const mlDiff = MLSystem.getDifficultyMult();
    Enemies.startWave(w, _scene, stageDef.difficulty * mlDiff);
    AudioSystem.playWaveStart();
    HUD.setWave(w, stageDef.wavesPerStage);
    HUD.announceWave(w, Enemies.getAliveCount(), stageDef.wavesPerStage);

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
  }

  function onWaveComplete() {
    player.score += SCORE_WAVE_BONUS;
    HUD.setScore(player.score);
    MLSystem.onWaveComplete(currentWave, currentStage, player.hp / player.maxHp);
    RankSystem.onWaveComplete(currentWave);
    MissionSystem.onWaveCompleted();

    // Trigger a random battlefield event between waves (from wave 2+)
    if (currentWave >= 2) {
      setTimeout(triggerBattlefieldEvent, 1500);
    }

    const stageDef = STAGES[currentStage];

    // Check if all waves in this stage are done
    if (currentWave >= stageDef.wavesPerStage) {
      // Stage clear!
      player.score += 1000; // Stage clear bonus
      HUD.setScore(player.score);

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
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right   = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const moveDir = new THREE.Vector3();

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
      let speed = MOVE_SPEED * (player.sprinting ? SPRINT_MULT : 1) * (player.prone ? 0.3 : 1);
      // Stim boost: +60% speed while active
      if (player._stimTimer && player._stimTimer > 0) speed *= 1.6;
      moveDir.multiplyScalar(speed * delta);

      if (player.sprinting) SkillSystem.onSprint();
    }

    // Decay stim timer
    if (player._stimTimer && player._stimTimer > 0) {
      player._stimTimer -= delta;
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
    const newPos = player.position.clone();
    newPos.x += moveDir.x;
    newPos.z += moveDir.z;
    newPos.y += player.velocity.y * delta;

    // Terrain collision
    const terrainH = VoxelWorld.getTerrainHeight(newPos.x, newPos.z) + player.height;

    // Horizontal block collision
    const checkH = newPos.y - player.height + 0.5;
    if (VoxelWorld.isSolid(newPos.x, checkH, newPos.z)) {
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
      const targets = Enemies.getEnemyMeshes();
      const weaponType = Weapons.getCurrentType();
      const weaponId = Weapons.getCurrentId();
      // Map weapon type to audio sound type
      const audioMap = { MELEE: 'melee', PISTOL: 'pistol', ASSAULT: 'rifle', LMG: 'rifle', SNIPER: 'sniper', HMG: 'hmg', AT: 'launcher', ATGM: 'launcher', NATO: 'rifle', AT_HEAVY: 'launcher', AT_LIGHT: 'launcher', AA: 'launcher', GRENADE: 'launcher', NATO_HEAVY: 'rifle', HMG_HEAVY: 'hmg', INCENDIARY: 'launcher', MACHINEGUN: 'hmg', SMG: 'pistol', AMR: 'sniper', MINIGUN: 'hmg', SILENT: 'pistol', THERMOBARIC: 'launcher', SHOTGUN: 'rifle' };
      Weapons.tryFire(_camera, targets, delta, function (hit) {
        onEnemyHit(hit);
      }, mouseNewPress);
      // Play sound on every actual shot (auto-fire included), not just first click
      if (Weapons.didFire()) {
        AudioSystem.playGunshot(audioMap[weaponType] || 'rifle');
        MLSystem.onShot(weaponId);
        // Spawn bullet tracer
        if (typeof Tracers !== 'undefined' && weaponType !== 'MELEE') {
          var tOrigin = _camera.position.clone();
          var tDir = new THREE.Vector3();
          _camera.getWorldDirection(tDir);
          var isHeavy = ['HMG', 'HMG_HEAVY', 'MACHINEGUN', 'MINIGUN'].indexOf(weaponType) >= 0;
          var isExplosive = ['AT', 'ATGM', 'AT_HEAVY', 'AT_LIGHT', 'AA', 'GRENADE', 'INCENDIARY', 'THERMOBARIC'].indexOf(weaponType) >= 0;
          if (!isExplosive) {
            Tracers.spawnTracer(tOrigin.clone().addScaledVector(tDir, 0.5), tDir, isHeavy ? 0xff4400 : 0xffcc44, 120);
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
    MLSystem.onHit(Weapons.getCurrentId());
    const isHeadshot = hit.object === enemy.mesh.userData.headMesh;
    const baseDmg = Weapons.getDamage();
    const dmg = isHeadshot ? baseDmg * 2 : baseDmg;

    const remaining = Enemies.damage(enemy, dmg);

    SkillSystem.onShoot(true, isHeadshot);
    HUD.flashHit(isHeadshot);

    if (isHeadshot) {
      HUD.showHeadshot();
      player.score += 50;
    }

    if (remaining <= 0) {
      AudioSystem.playDeath();
      MLSystem.onKill(Weapons.getCurrentId());
      player.score += enemy.scoreValue;
      player.kills++;
      HUD.setScore(player.score);
      HUD.setKills(player.kills);
      RankSystem.onKill(isHeadshot);
      HUD.addKill(Weapons.getCurrentName(), enemy.typeCfg ? enemy.typeCfg.name : 'ENEMY', isHeadshot);

      // Kill streak tracking
      player.killStreak++;
      player.streakTimer = 4.0; // 4 seconds to chain another kill
      var streakMult = 1.0 + Math.min(player.killStreak - 1, 10) * 0.2; // up to 3.0x at 11+ streak
      var streakBonus = Math.floor(enemy.scoreValue * (streakMult - 1));
      if (streakBonus > 0) {
        player.score += streakBonus;
        HUD.setScore(player.score);
      }
      if (HUD.showStreak) HUD.showStreak(player.killStreak, streakMult);

      // Dog tag collection (every kill drops a dog tag)
      player.dogTags++;
      if (player.dogTags % 10 === 0) {
        player.score += 500;
        HUD.setScore(player.score);
        HUD.notifyPickup('🏷 10 DOG TAGS! +500 SCORE', '#ffaa00');
      }

      // Pickup spawn — expanded loot table
      if (Math.random() < enemy.dropChance) {
        const lootRoll = Math.random();
        let type;
        if (lootRoll < 0.30)      type = 'HEALTH';
        else if (lootRoll < 0.55) type = 'AMMO';
        else if (lootRoll < 0.70) type = 'ARMOR';
        else if (lootRoll < 0.82) type = 'GRENADE';
        else if (lootRoll < 0.92) type = 'MEDKIT';
        else                      type = 'STIM';
        Pickups.spawn(enemy.mesh.position, type);
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

  function onPlayerHit(dmg, attackerPos) {
    if (player.godMode) return; // God mode: immune to damage
    MLSystem.onDamageTaken(dmg);
    player.hp = Math.max(0, player.hp - dmg);
    HUD.setHealth(player.hp, player.maxHp);
    HUD.flashDamage();

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
      gameState = STATE.DEAD;
      if (AudioSystem.stopMusic) AudioSystem.stopMusic();
      Weapons.exitZoom();
      MLSystem.onDeath();
      showOverlay('dead');
      document.getElementById('dead-stage').textContent = STAGES[currentStage].id;
      document.getElementById('dead-score').textContent = player.score;
      document.getElementById('dead-kills').textContent = player.kills;
      document.getElementById('dead-wave').textContent = currentWave;
    }
  }

  /* ── Main Update Loop ────────────────────────────────────────────── */
  let prevTime = performance.now();

  function update() {
    requestAnimationFrame(update);

    const now = performance.now();
    const delta = Math.min((now - prevTime) / 1000, 0.1);
    prevTime = now;

    if (gameState === STATE.PLAYING || gameState === STATE.BUILD_MODE) {
      // Core systems
      TimeSystem.update(delta);
      WeatherSystem.update(delta);
      MLSystem.trackFPS(delta);
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

      // Kill streak decay
      if (player.streakTimer > 0) {
        player.streakTimer -= delta;
        if (player.streakTimer <= 0) {
          player.killStreak = 0;
          if (HUD.showStreak) HUD.showStreak(0, 1.0);
        }
      }

      // Airdrop cooldown
      if (player.airdropCooldown > 0) player.airdropCooldown -= delta;

      // Compass update
      if (HUD.updateCompass) HUD.updateCompass(CameraSystem.getYaw());

      // Weapon jam indicator
      if (HUD.showJam && Weapons.isJammed) HUD.showJam(Weapons.isJammed());

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
          player.hp = Math.min(player.maxHp + 50, player.hp + 50);
          HUD.setHealth(player.hp, player.maxHp);
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
        }
      });

      // Hybrid systems
      NPCSystem.update(delta, TimeSystem.getInfo());
      DroneSystem.update(delta);
      VehicleSystem.update(delta);
      Automation.update(delta);
      MissionSystem.update(delta);

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

      // Build mode ghost update
      if (gameState === STATE.BUILD_MODE && Building.getSelectedTemplate()) {
        const ray = VoxelWorld.raycastBlock(_camera, 12);
        if (ray) Building.updateGhost(ray.place.x, ray.place.y, ray.place.z);
      }

      // HUD updates
      HUD.setAmmo(Weapons.getClip(), Weapons.getReserve());
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
      if (typeof Tracers !== 'undefined') Tracers.update(delta);

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
    getState:        function () { return gameState; },
    setState:        function (s) { gameState = s; },
    getPlayer:       function () { return player; },
    getScene:        function () { return _scene; },
    getCamera:       function () { return _camera; },
    getCurrentWave:  function () { return currentWave; },
    getCurrentStage: function () { return currentStage; },
    getStageInfo:    function () { return STAGES[currentStage]; },
  };
})();
