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
  };

  /* ── Wave State ──────────────────────────────────────────────────── */
  let currentWave = 0;
  const SCORE_WAVE_BONUS = 500;

  /* ── Stage Definitions ──────────────────────────────────────────── */
  const STAGES = [
    {
      id:           1,
      name:         'AVDIIVKA SECTOR',
      theme:        'grassland',
      wavesPerStage: 5,
      difficulty:   1.0,
      fogColor:     0x3a3028,
      bgColor:      0x3a3028,
      sunColor:     0xff8833,
      sunIntensity: 0.85,
      description:  'Green fields of Avdiivka. Hold the line.',
    },
    {
      id:           2,
      name:         'BAKHMUT RUINS',
      theme:        'urban',
      wavesPerStage: 5,
      difficulty:   1.4,
      fogColor:     0x2a2a2a,
      bgColor:      0x2a2a2a,
      sunColor:     0xccccdd,
      sunIntensity: 0.65,
      description:  'Urban ruins of Bakhmut. Every corner hides danger.',
    },
    {
      id:           3,
      name:         'KHERSON CROSSING',
      theme:        'desert',
      wavesPerStage: 5,
      difficulty:   1.8,
      fogColor:     0x5a4a30,
      bgColor:      0x5a4a30,
      sunColor:     0xffaa44,
      sunIntensity: 1.0,
      description:  'Sandy banks of Kherson. Final push to victory.',
    },
  ];

  let currentStage = 0;  // 0-based index into STAGES

  /* ── Physics Constants ───────────────────────────────────────────── */
  const MOVE_SPEED   = 6.0;
  const SPRINT_MULT  = 1.65;
  const GRAVITY      = 18;
  const JUMP_SPEED   = 7.0;

  /* ── Input State ─────────────────────────────────────────────────── */
  const keys = {};
  let mouseDown = false;
  let mouseNewPress = false;

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

    // Scatter resources on terrain
    VoxelWorld.scatterResources(VoxelWorld.BLOCK.WOOD, 0.004);
    VoxelWorld.scatterResources(VoxelWorld.BLOCK.METAL, 0.001);
    VoxelWorld.scatterResources(VoxelWorld.BLOCK.ELECTRONICS, 0.0005);

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

    // Spawn a starter vehicle
    const vh = VoxelWorld.getTerrainHeight(8, 8);
    VehicleSystem.spawn(8, vh, 8, 'transport');

    // Input setup
    setupInput();

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
          } else {
            gameState = STATE.BUILD_MODE;
            Building.setBuildMode(true);
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

        // Weapon switching (1-9)
        if (e.code === 'Digit1') Weapons.switchTo(0);
        if (e.code === 'Digit2') Weapons.switchTo(1);
        if (e.code === 'Digit3') Weapons.switchTo(2);
        if (e.code === 'Digit4' && gameState === STATE.PLAYING) Weapons.switchTo(3);
        if (e.code === 'Digit5' && gameState === STATE.PLAYING) Weapons.switchTo(4);
        if (e.code === 'Digit6' && gameState === STATE.PLAYING) Weapons.switchTo(5);
        if (e.code === 'Digit7' && gameState === STATE.PLAYING) Weapons.switchTo(6);
        if (e.code === 'Digit8') Weapons.switchTo(7);
        if (e.code === 'Digit9') Weapons.switchTo(8);
        if (e.code === 'KeyR')   Weapons.forceReload();

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
          showOverlay('pause');
        } else if (gameState === STATE.PAUSED) {
          gameState = STATE.PLAYING;
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
      if (e.button === 0) {
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
        gameState = STATE.PAUSED;
        showOverlay('pause');
      }
    });
  }

  /* ── Build interactions ──────────────────────────────────────────── */
  function handleBuildClick() {
    if (Building.getSelectedTemplate()) {
      const ray = VoxelWorld.raycastBlock(_camera, 12);
      if (ray) {
        const p = ray.place;
        const resources = Economy.getResources();
        if (Building.placeTemplate(p.x, p.y, p.z, resources)) {
          // Sync economy state
          const newRes = Economy.getResources();
          for (const k of Object.keys(newRes)) {
            // Economy already deducted in placeTemplate
          }
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
    gameState = STATE.PLAYING;
    player.hp = player.maxHp;
    player.score = 0;
    player.kills = 0;
    currentWave = 0;
    currentStage = 0;
    player.velocity.set(0, 0, 0);

    // Apply first stage
    applyStage(STAGES[0]);

    const spawnH = VoxelWorld.getTerrainHeight(0, 0);
    player.position.set(0, spawnH + player.height, 0);

    Weapons.reset();
    Enemies.clear();
    Pickups.clear();

    hideOverlays();
    HUD.show();
    HUD.setHealth(player.hp, player.maxHp);
    HUD.setScore(0);
    HUD.setWave(0);
    HUD.setKills(0);
    HUD.setStage(STAGES[0].id, STAGES[0].name);

    requestPointerLock();

    // Announce first stage then begin first wave after delay
    HUD.announceStage(STAGES[0].id, STAGES[0].name, STAGES[0].description);
    setTimeout(function () {
      beginWave(1);
    }, 3200);

    // Generate an initial mission
    MissionSystem.generateRandom();
  }

  /* ── Stage Management ───────────────────────────────────────────── */
  function applyStage(stageDef) {
    // Update terrain theme
    VoxelWorld.setTheme(stageDef.theme);
    VoxelWorld.regenerate();

    // Scatter resources on new terrain
    VoxelWorld.scatterResources(VoxelWorld.BLOCK.WOOD, 0.004);
    VoxelWorld.scatterResources(VoxelWorld.BLOCK.METAL, 0.001);
    VoxelWorld.scatterResources(VoxelWorld.BLOCK.ELECTRONICS, 0.0005);

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
    applyStage(stageDef);

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

    // Respawn vehicle
    const vh = VoxelWorld.getTerrainHeight(8, 8);
    VehicleSystem.clear();
    VehicleSystem.spawn(8, vh, 8, 'transport');

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
    Enemies.startWave(w, _scene, stageDef.difficulty);
    HUD.setWave(w, stageDef.wavesPerStage);
    HUD.announceWave(w, Enemies.getAliveCount(), stageDef.wavesPerStage);
  }

  function onWaveComplete() {
    player.score += SCORE_WAVE_BONUS;
    HUD.setScore(player.score);
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

    const yaw = CameraSystem.getYaw();
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right   = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const moveDir = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp'])    moveDir.add(forward);
    if (keys['KeyS'] || keys['ArrowDown'])  moveDir.sub(forward);
    if (keys['KeyA'] || keys['ArrowLeft'])  moveDir.sub(right);
    if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(right);

    const isMoving = moveDir.lengthSq() > 0;
    if (isMoving) {
      moveDir.normalize();
      player.sprinting = !!keys['ShiftLeft'];
      const speed = MOVE_SPEED * (player.sprinting ? SPRINT_MULT : 1);
      moveDir.multiplyScalar(speed * delta);

      if (player.sprinting) SkillSystem.onSprint();
    }

    // Gravity
    player.velocity.y -= GRAVITY * delta;

    // Jump
    if ((keys['Space']) && player.onGround) {
      player.velocity.y = JUMP_SPEED;
      player.onGround = false;
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
    if (DroneSystem.isPossessing() || VehicleSystem.isInVehicle()) return;
    if (CameraSystem.getMode() === CameraSystem.MODE.STRATEGIC) return;

    if (mouseDown) {
      const targets = Enemies.getEnemyMeshes();
      Weapons.tryFire(_camera, targets, delta, function (hit) {
        onEnemyHit(hit);
      }, mouseNewPress);
      mouseNewPress = false;
    }
  }

  function onEnemyHit(hit) {
    const enemy = Enemies.findByMesh(hit.object);
    if (!enemy || !enemy.alive) return;

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

      // Weapon unlock drop (pickup weapons 2-8)
      if (Math.random() < 0.12) {
        const candidates = [];
        for (let wi = 2; wi <= 8; wi++) {
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
    player.hp = Math.max(0, player.hp - dmg);
    HUD.setHealth(player.hp, player.maxHp);
    HUD.flashDamage();

    if (player.hp <= 0) {
      gameState = STATE.DEAD;
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
      updatePlayer(delta);
      updateCombat(delta);

      Weapons.update(delta);
      Enemies.update(delta, player.position, onPlayerHit, function (waveDone) {
        if (waveDone) onWaveComplete();
      });
      Pickups.update(delta, player.position, function (type) {
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
