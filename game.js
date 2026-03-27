/**
 * game.js – Core engine: scene, renderer, pointer-lock controls, game loop
 * Depends on: Three.js (THREE), HUD, Weapons, Enemies, Pickups
 */

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────
  const PLAYER_HEIGHT   = 1.7;
  const MOVE_SPEED      = 6.0;
  const SPRINT_MULT     = 1.65;
  const PLAYER_MAX_HP   = 100;
  const TOTAL_WAVES     = 10;
  const ARENA_SIZE      = 24;
  const SCORE_WAVE_BONUS     = 500;
  const GRAVITY              = 18;
  const JUMP_SPEED           = 7.0;
  const HEALTH_DROP_PROBABILITY = 0.5;  // chance a drop is health vs ammo

  // ── State ─────────────────────────────────────────────────
  let playerHp    = PLAYER_MAX_HP;
  let score       = 0;
  let kills       = 0;
  let currentWave = 1;
  let gameState   = 'start';    // 'start' | 'playing' | 'paused' | 'dead' | 'waveClear' | 'win'

  const velocity   = new THREE.Vector3();
  const direction  = new THREE.Vector3();
  const keys       = {};
  let   mouseDown  = false;
  let   yaw        = 0;
  let   pitch      = 0;
  const pitchLimit = Math.PI / 2 - 0.05;

  // Jump & bob
  let verticalVel = 0;
  let isGrounded  = true;
  let bobTime     = 0;

  // ── Three.js setup ────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x111111);
  document.getElementById('game-container').prepend(renderer.domElement);

  const scene  = new THREE.Scene();
  scene.fog    = new THREE.Fog(0x111111, 15, 45);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, PLAYER_HEIGHT, 0);

  // ── Lighting ──────────────────────────────────────────────
  const ambient = new THREE.AmbientLight(0x404040, 1.2);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xff6644, 1.0);
  sun.position.set(8, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far  = 80;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
  sun.shadow.camera.right = sun.shadow.camera.top   =  30;
  scene.add(sun);

  const fill = new THREE.HemisphereLight(0x220022, 0x000011, 0.6);
  scene.add(fill);

  // ── Arena geometry ────────────────────────────────────────
  function buildArena() {
    const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE * 2, ARENA_SIZE * 2, 30, 30);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const floor    = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(ARENA_SIZE * 2, 24, 0x330000, 0x220000);
    scene.add(grid);

    // Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x1e0a0a });
    const wallH   = 4;
    const wallLen = ARENA_SIZE * 2;
    [
      { pos: [0, wallH / 2, -ARENA_SIZE], rot: [0, 0, 0],              size: [wallLen, wallH, 0.5] },
      { pos: [0, wallH / 2,  ARENA_SIZE], rot: [0, Math.PI, 0],        size: [wallLen, wallH, 0.5] },
      { pos: [-ARENA_SIZE, wallH / 2, 0], rot: [0, -Math.PI / 2, 0],   size: [wallLen, wallH, 0.5] },
      { pos: [ ARENA_SIZE, wallH / 2, 0], rot: [0,  Math.PI / 2, 0],   size: [wallLen, wallH, 0.5] },
    ].forEach(({ pos, rot, size }) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), wallMat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    });

    // Cover crates
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    [
      [-6, 2], [6, 2], [-6, -2], [6, -2],
      [0, 7],  [0, -7], [-10, 5], [10, 5],
      [-10, -5], [10, -5], [-4, 12], [4, 12],
    ].forEach(([x, z]) => {
      const h   = 0.9 + Math.random() * 0.6;
      const geo = new THREE.BoxGeometry(1.0 + Math.random() * 0.5, h, 1.0 + Math.random() * 0.5);
      const m   = new THREE.Mesh(geo, crateMat);
      m.position.set(x, h / 2, z);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    });

    // Atmospheric point lights
    [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(([x, z]) => {
      const pt = new THREE.PointLight(0xff1100, 1.2, 18);
      pt.position.set(x, 2.5, z);
      scene.add(pt);
    });
  }

  buildArena();
  Pickups.init(scene);
  Weapons.createGunMesh(camera);
  Weapons.createMuzzleFlash(scene, camera);

  // ── Pointer Lock ──────────────────────────────────────────
  const canvas = renderer.domElement;

  canvas.addEventListener('click', () => {
    if (gameState === 'playing') canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    // Auto-pause when pointer lock is lost mid-game
    if (document.pointerLockElement !== canvas && gameState === 'playing') {
      gameState = 'paused';
      document.getElementById('pause-screen').style.display = 'flex';
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    yaw   -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch  = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
  });

  document.addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; });
  document.addEventListener('mouseup',   (e) => { if (e.button === 0) mouseDown = false; });

  // ── Keyboard ──────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyR' && gameState === 'playing') {
      Weapons.forceReload();
    }
    if (e.code === 'Escape') {
      if (gameState === 'playing') {
        gameState = 'paused';
        document.exitPointerLock();
        document.getElementById('pause-screen').style.display = 'flex';
      } else if (gameState === 'paused') {
        resumeGame();
      }
    }
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // ── UI Buttons ────────────────────────────────────────────
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('play-again-btn').addEventListener('click', startGame);

  document.getElementById('resume-btn').addEventListener('click', resumeGame);
  document.getElementById('quit-btn').addEventListener('click', () => {
    Enemies.clear();
    Pickups.clear();
    hideAllScreens();
    HUD.hide();
    gameState = 'start';
    document.getElementById('start-screen').style.display = 'flex';
  });

  document.getElementById('next-wave-btn').addEventListener('click', () => {
    currentWave++;
    if (currentWave > TOTAL_WAVES) {
      showWin();
    } else {
      hideAllScreens();
      HUD.show();
      beginWave(currentWave);
      gameState = 'playing';
      canvas.requestPointerLock();
    }
  });

  // ── Game flow ─────────────────────────────────────────────
  function hideAllScreens() {
    ['start-screen', 'dead-screen', 'wave-screen', 'win-screen', 'pause-screen'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
  }

  function startGame() {
    playerHp    = PLAYER_MAX_HP;
    score       = 0;
    kills       = 0;
    currentWave = 1;
    verticalVel = 0;
    isGrounded  = true;
    bobTime     = 0;

    Weapons.reset();
    Enemies.clear();
    Pickups.clear();

    HUD.setScore(0);
    HUD.setKills(0);
    HUD.setEnemies(0);
    HUD.setHealth(playerHp, PLAYER_MAX_HP);
    HUD.setAmmo(Weapons.getClip(), Weapons.getReserve());

    camera.position.set(0, PLAYER_HEIGHT, 0);
    yaw   = 0;
    pitch = 0;

    hideAllScreens();
    HUD.show();
    beginWave(1);
    gameState = 'playing';
    canvas.requestPointerLock();
  }

  function resumeGame() {
    document.getElementById('pause-screen').style.display = 'none';
    gameState = 'playing';
    canvas.requestPointerLock();
  }

  function beginWave(w) {
    HUD.setWave(w);
    const count = 4 + (w - 1) * 2;
    HUD.announceWave(w, count);
    Enemies.startWave(w, scene);
  }

  function onPlayerHit(dmg) {
    playerHp = Math.max(0, playerHp - dmg);
    HUD.setHealth(playerHp, PLAYER_MAX_HP);
    HUD.flashDamage();
    if (playerHp <= 0) triggerDeath();
  }

  function onEnemyHit(intersection, dmgAmount) {
    const enemy = Enemies.findByMesh(intersection.object);
    if (!enemy || !enemy.alive) return;

    // 2× damage on headshot – check hit mesh and its parents against the head mesh
    const headMesh   = enemy.mesh.userData.headMesh;
    let   hitObj     = intersection.object;
    let   isHeadshot = false;
    while (hitObj) {
      if (hitObj === headMesh) { isHeadshot = true; break; }
      hitObj = hitObj.parent;
      if (hitObj === enemy.mesh) break;   // don't go above the enemy group
    }
    const actualDmg  = isHeadshot ? dmgAmount * 2 : dmgAmount;

    const remaining = Enemies.damage(enemy, actualDmg);
    HUD.flashHit(isHeadshot);

    if (remaining === 0) {
      kills++;
      score += enemy.scoreValue * (isHeadshot ? 2 : 1);
      HUD.setKills(kills);
      HUD.setScore(score);
      if (isHeadshot) HUD.showHeadshot();

      // Random pickup drop
      if (Math.random() < enemy.dropChance) {
        Pickups.spawn(
          enemy.mesh.position,
          Math.random() < HEALTH_DROP_PROBABILITY ? 'HEALTH' : 'AMMO'
        );
      }
    }
  }

  function onPickupCollect(type) {
    if (type === 'HEALTH') {
      playerHp = Math.min(PLAYER_MAX_HP, playerHp + 25);
      HUD.setHealth(playerHp, PLAYER_MAX_HP);
      HUD.notifyPickup('+25 HP', '#44ff55');
    } else if (type === 'AMMO') {
      Weapons.addAmmo(30);
      HUD.notifyPickup('+30 AMMO', '#ffcc00');
    }
  }

  function onWaveComplete() {
    if (gameState !== 'playing') return;
    score += SCORE_WAVE_BONUS;
    HUD.setScore(score);

    if (currentWave >= TOTAL_WAVES) {
      showWin();
      return;
    }

    gameState = 'waveClear';
    document.exitPointerLock();
    HUD.hide();
    document.getElementById('wave-score').textContent = 'SCORE: ' + score;
    document.getElementById('wave-screen').style.display = 'flex';
  }

  function triggerDeath() {
    if (gameState !== 'playing') return;
    gameState = 'dead';
    document.exitPointerLock();
    HUD.hide();
    Enemies.clear();
    Pickups.clear();

    document.getElementById('final-score').textContent  = 'SCORE: '          + score;
    document.getElementById('final-kills').textContent  = 'KILLS: '          + kills;
    document.getElementById('final-wave').textContent   = 'WAVES SURVIVED: ' + (currentWave - 1);
    document.getElementById('dead-screen').style.display = 'flex';
  }

  function showWin() {
    gameState = 'win';
    document.exitPointerLock();
    HUD.hide();
    document.getElementById('win-score').textContent = 'SCORE: ' + score;
    document.getElementById('win-kills').textContent = 'KILLS: ' + kills;
    document.getElementById('win-screen').style.display = 'flex';
  }

  // ── Movement, jump & camera bob ───────────────────────────
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  function updatePlayer(delta) {
    if (gameState !== 'playing') return;

    // Camera orientation
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);

    // Horizontal movement
    const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed  = MOVE_SPEED * (sprint ? SPRINT_MULT : 1.0);

    direction.set(0, 0, 0);
    if (keys['KeyW'] || keys['ArrowUp'])    direction.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown'])  direction.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft'])  direction.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) direction.x += 1;
    const isMoving = direction.lengthSq() > 0;
    direction.normalize();

    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right   = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));
    velocity.set(0, 0, 0);
    velocity.addScaledVector(forward, direction.z * speed);
    velocity.addScaledVector(right,   direction.x * speed);
    camera.position.addScaledVector(velocity, delta);

    // Arena clamp
    camera.position.x = Math.max(-(ARENA_SIZE - 0.5), Math.min(ARENA_SIZE - 0.5, camera.position.x));
    camera.position.z = Math.max(-(ARENA_SIZE - 0.5), Math.min(ARENA_SIZE - 0.5, camera.position.z));

    // Jump & gravity
    if (keys['Space'] && isGrounded) {
      verticalVel = JUMP_SPEED;
      isGrounded  = false;
    }
    verticalVel -= GRAVITY * delta;
    camera.position.y += verticalVel * delta;

    if (camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT;
      verticalVel       = 0;
      isGrounded        = true;
    }

    // Camera bob (only when grounded and moving)
    if (isMoving && isGrounded) {
      bobTime           += delta * (sprint ? 14 : 10);
      camera.position.y += Math.sin(bobTime) * 0.038;
    }

    // Auto-fire
    if (mouseDown && document.pointerLockElement === canvas) {
      Weapons.tryFire(camera, Enemies.getEnemyMeshes(), delta, onEnemyHit);
    }
  }

  // ── Resize ────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Game loop ─────────────────────────────────────────────
  let prevTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);

    const now   = performance.now();
    const delta = Math.min((now - prevTime) / 1000, 0.1);
    prevTime    = now;

    if (gameState === 'playing') {
      updatePlayer(delta);
      Weapons.update(delta);
      Enemies.update(
        delta,
        camera.position,
        onPlayerHit,
        (waveComplete) => { if (waveComplete) onWaveComplete(); }
      );
      Pickups.update(delta, camera.position, onPickupCollect);
      HUD.setEnemies(Enemies.getAliveCount());
    }

    renderer.render(scene, camera);
  }

  animate();
})();
