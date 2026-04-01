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
  };

  /* ── Wave State ──────────────────────────────────────────────────── */
  let currentWave = 0;
  const SCORE_WAVE_BONUS = 500;
  let autoAdvance = false;   // auto-advance waves/stages

  /* ── Stage Definitions ──────────────────────────────────────────── */
  const STAGES = [
    {
      id:           1,
      name:         'HOSTOMEL AIRPORT',
      theme:        'grassland',
      wavesPerStage: 5,
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
      wavesPerStage: 5,
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
      wavesPerStage: 5,
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
      wavesPerStage: 5,
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

    // Create scene
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x3a3028);
    _scene.fog = new THREE.Fog(0x3a3028, 14, 80);

    // Create camera
    _camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    // Lighting
    ambLight = new THREE.AmbientLight(0x4a3c2a, 1.0);
    _scene.add(ambLight);

    sunLight = new THREE.DirectionalLight(0xff8833, 0.85);
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

    hemiLight = new THREE.HemisphereLight(0x3a2a18, 0x101008, 0.5);
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

    // Spawn starter vehicle fleet
    const vh = VoxelWorld.getTerrainHeight(8, 8);
    VehicleSystem.spawn(8, vh, 8, 'transport');
    const startVh2 = VoxelWorld.getTerrainHeight(12, 5);
    VehicleSystem.spawn(12, startVh2, 5, 'combat');
    const startVh3 = VoxelWorld.getTerrainHeight(-8, -8);
    VehicleSystem.spawn(-8, startVh3, -8, 'turret_rover');

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

        // Vehicle enter/exit
        if (e.code === 'KeyG') {
          if (VehicleSystem.isInVehicle()) {
            const exitPos = VehicleSystem.exit();
            if (exitPos) {
              player.position.copy(exitPos);
              player.position.y += player.height;
            }
          } else {
            const nearby = VehicleSystem.getNearby(player.position, 5);
            if (nearby.length > 0) VehicleSystem.enter(nearby[0].id);
          }
        }

        // Stealth / invisibility toggle
        if (e.code === 'KeyI') {
          player.stealth = !player.stealth;
          const stInd = document.getElementById('stealth-indicator');
          if (stInd) stInd.style.display = player.stealth ? 'block' : 'none';
          HUD.notifyPickup(player.stealth ? '👻 STEALTH ON' : '👁 STEALTH OFF', player.stealth ? '#00ff66' : '#ff6600');
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
          const invOv = document.getElementById('inventory-overlay');
          if (invOv) {
            showInventory();
            invOv.style.display = 'flex';
          } else {
            showOverlay('pause');
          }
        } else if (gameState === STATE.PAUSED) {
          gameState = STATE.PLAYING;
          const invOv = document.getElementById('inventory-overlay');
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
    AudioSystem.resume();
    gameState = STATE.PLAYING;
    player.hp = player.maxHp;
    player.score = 0;
    player.kills = 0;
    currentWave = 0;
    currentStage = 0;
    player.velocity.set(0, 0, 0);

    // Apply first stage
    applyStage(0);

    const spawnH = VoxelWorld.getTerrainHeight(0, 0);
    player.position.set(0, spawnH + player.height, 0);

    Weapons.reset();
    Enemies.clear();
    Pickups.clear();
    VehicleSystem.clear();
    DroneSystem.clear();

    // Respawn vehicle fleet for first stage
    const sgVh = VoxelWorld.getTerrainHeight(8, 8);
    VehicleSystem.spawn(8, sgVh, 8, 'transport');
    const sgVh2 = VoxelWorld.getTerrainHeight(12, 5);
    VehicleSystem.spawn(12, sgVh2, 5, 'combat');
    const sgVh3 = VoxelWorld.getTerrainHeight(-8, -8);
    VehicleSystem.spawn(-8, sgVh3, -8, 'turret_rover');

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

    // Respawn vehicle fleet
    const vh = VoxelWorld.getTerrainHeight(8, 8);
    VehicleSystem.clear();
    VehicleSystem.spawn(8, vh, 8, 'transport');
    const vh2 = VoxelWorld.getTerrainHeight(12, 5);
    VehicleSystem.spawn(12, vh2, 5, 'combat');
    const vh3 = VoxelWorld.getTerrainHeight(-8, -8);
    VehicleSystem.spawn(-8, vh3, -8, 'turret_rover');

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
  }

  function onWaveComplete() {
    player.score += SCORE_WAVE_BONUS;
    HUD.setScore(player.score);
    MLSystem.onWaveComplete(currentWave, currentStage, player.hp / player.maxHp);
    RankSystem.onWaveComplete(currentWave);
    MissionSystem.onWaveCompleted();

    const stageDef = STAGES[currentStage];

    // Check if all waves in this stage are done
    if (currentWave >= stageDef.wavesPerStage) {
      // Stage clear!
      player.score += 1000; // Stage clear bonus
      HUD.setScore(player.score);

      if (currentStage >= STAGES.length - 1) {
        // Final stage cleared — win!
        gameState = STATE.WIN;
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
      const speed = MOVE_SPEED * (player.sprinting ? SPRINT_MULT : 1);
      moveDir.multiplyScalar(speed * delta);

      if (player.sprinting) SkillSystem.onSprint();
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
      const audioMap = { MELEE: 'melee', PISTOL: 'pistol', ASSAULT: 'rifle', LMG: 'rifle', SNIPER: 'sniper', HMG: 'hmg', AT: 'launcher', ATGM: 'launcher', NATO: 'rifle', AT_HEAVY: 'launcher', AT_LIGHT: 'launcher', AA: 'launcher', GRENADE: 'launcher', NATO_HEAVY: 'rifle', HMG_HEAVY: 'hmg', INCENDIARY: 'launcher' };
      Weapons.tryFire(_camera, targets, delta, function (hit) {
        onEnemyHit(hit);
      }, mouseNewPress);
      // Play sound on every actual shot (auto-fire included), not just first click
      if (Weapons.didFire()) {
        AudioSystem.playGunshot(audioMap[weaponType] || 'rifle');
        MLSystem.onShot(weaponId);
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

      // Pickup spawn
      if (Math.random() < enemy.dropChance) {
        const type = Math.random() < 0.5 ? 'HEALTH' : 'AMMO';
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

  function onPlayerHit(dmg) {
    MLSystem.onDamageTaken(dmg);
    player.hp = Math.max(0, player.hp - dmg);
    HUD.setHealth(player.hp, player.maxHp);
    HUD.flashDamage();

    if (player.hp <= 0) {
      gameState = STATE.DEAD;
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
        } else {
          Weapons.addAmmo(30);
          HUD.notifyPickup('+30 AMMO', '#ffcc00');
        }
      });

      // Hybrid systems
      NPCSystem.update(delta, TimeSystem.getInfo());
      DroneSystem.update(delta);
      VehicleSystem.update(delta);
      Automation.update(delta);
      MissionSystem.update(delta);

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
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const count = Weapons.getWeaponCount();
    const curIdx = Weapons.getCurrentIdx();
    for (let i = 0; i < count; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      const isUnlocked = Weapons.isUnlocked(i);
      if (!isUnlocked) {
        slot.classList.add('locked');
        slot.textContent = '🔒 ' + Weapons.getWeaponName(i);
      } else {
        const info = Weapons.getWeaponInfo(i);
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

    const statsEl = document.getElementById('player-stats');
    if (statsEl) {
      const stage = STAGES[currentStage];
      statsEl.innerHTML =
        '❤ HP: ' + player.hp + '/' + player.maxHp +
        ' &nbsp;|&nbsp; 🏆 Score: ' + player.score +
        ' &nbsp;|&nbsp; 💀 Kills: ' + player.kills +
        '<br>📍 Stage ' + stage.id + ': ' + stage.name +
        ' &nbsp;|&nbsp; 🌊 Wave: ' + currentWave + '/' + stage.wavesPerStage;
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
