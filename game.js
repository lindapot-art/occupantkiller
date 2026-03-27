/**
 * game.js – Core engine: scene, renderer, pointer-lock controls, game loop
 * Depends on: Three.js (THREE), HUD, Weapons, Enemies
 */

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────
  const PLAYER_HEIGHT   = 1.7;
  const MOVE_SPEED      = 6.0;
  const SPRINT_MULT     = 1.65;
  const PLAYER_MAX_HP   = 100;
  const TOTAL_WAVES     = 10;
  const ARENA_SIZE      = 24;   // half-extent of the arena
  const SCORE_PER_KILL  = 100;
  const SCORE_WAVE_BONUS = 500;
  const GRAVITY         = 18;

  // ── State ─────────────────────────────────────────────────
  let playerHp    = PLAYER_MAX_HP;
  let score       = 0;
  let kills       = 0;
  let currentWave = 1;
  let gameState   = 'start';    // 'start' | 'playing' | 'dead' | 'waveClear' | 'win'

  // Player velocity (for gravity / jump – kept simple, no jump in MVP)
  const velocity   = new THREE.Vector3();
  const direction  = new THREE.Vector3();
  const keys       = {};
  let   mouseDown  = false;
  let   yaw        = 0;
  let   pitch      = 0;
  const pitchLimit = Math.PI / 2 - 0.05;

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
    // Floor
    const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE * 2, ARENA_SIZE * 2, 30, 30);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const floor    = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid lines overlay
    const grid = new THREE.GridHelper(ARENA_SIZE * 2, 24, 0x330000, 0x220000);
    scene.add(grid);

    // Walls (4 sides)
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x1e0a0a });
    const wallH   = 4;
    const wallT   = 0.5;
    const wallLen = ARENA_SIZE * 2;
    const walls   = [
      { pos: [0, wallH / 2, -ARENA_SIZE], rot: [0, 0, 0],          size: [wallLen, wallH, wallT] },
      { pos: [0, wallH / 2,  ARENA_SIZE], rot: [0, Math.PI, 0],    size: [wallLen, wallH, wallT] },
      { pos: [-ARENA_SIZE, wallH / 2, 0], rot: [0, -Math.PI / 2, 0], size: [wallLen, wallH, wallT] },
      { pos: [ ARENA_SIZE, wallH / 2, 0], rot: [0,  Math.PI / 2, 0], size: [wallLen, wallH, wallT] },
    ];
    walls.forEach(({ pos, rot, size }) => {
      const geo  = new THREE.BoxGeometry(...size);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
    });

    // Scattered cover crates
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    const cratePositions = [
      [-6, 2],  [6, 2],   [-6, -2],  [6, -2],
      [0, 7],   [0, -7],  [-10, 5],  [10, 5],
      [-10, -5],[10, -5], [-4, 12],  [4, 12],
    ];
    cratePositions.forEach(([x, z]) => {
      const h   = 0.9 + Math.random() * 0.6;
      const geo = new THREE.BoxGeometry(1.0 + Math.random() * 0.5, h, 1.0 + Math.random() * 0.5);
      const m   = new THREE.Mesh(geo, crateMat);
      m.position.set(x, h / 2, z);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    });

    // Atmospheric red point lights
    const spots = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
    spots.forEach(([x, z]) => {
      const pt = new THREE.PointLight(0xff1100, 1.2, 18);
      pt.position.set(x, 2.5, z);
      scene.add(pt);
    });
  }

  buildArena();
  Weapons.createGunMesh(camera);
  Weapons.createMuzzleFlash(scene, camera);

  // ── Pointer Lock ──────────────────────────────────────────
  const canvas = renderer.domElement;

  canvas.addEventListener('click', () => {
    if (gameState === 'playing') canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && gameState === 'playing') {
      // Paused – player unlocked pointer intentionally
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    yaw   -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch  = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
  });

  document.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouseDown = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
  });

  // ── Keyboard ──────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyR' && gameState === 'playing') Weapons.forceReload();
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // ── UI Buttons ────────────────────────────────────────────
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);
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
  document.getElementById('play-again-btn').addEventListener('click', startGame);

  // ── Game flow ─────────────────────────────────────────────
  function hideAllScreens() {
    ['start-screen', 'dead-screen', 'wave-screen', 'win-screen'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
  }

  function startGame() {
    playerHp    = PLAYER_MAX_HP;
    score       = 0;
    kills       = 0;
    currentWave = 1;

    Weapons.reset();
    Enemies.clear();

    HUD.setScore(0);
    HUD.setKills(0);
    HUD.setHealth(playerHp, PLAYER_MAX_HP);
    HUD.setAmmo(Weapons.getClip(), Weapons.getReserve());

    // Reset player position
    camera.position.set(0, PLAYER_HEIGHT, 0);
    yaw   = 0;
    pitch = 0;

    hideAllScreens();
    HUD.show();
    beginWave(1);
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

    const remaining = Enemies.damage(enemy, dmgAmount);
    HUD.flashHit();

    if (remaining === 0) {
      kills++;
      score += SCORE_PER_KILL;
      HUD.setKills(kills);
      HUD.setScore(score);
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

  // ── Movement & camera ─────────────────────────────────────
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  function updatePlayer(delta) {
    if (gameState !== 'playing') return;

    // Camera orientation
    euler.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(euler);

    const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed  = MOVE_SPEED * (sprint ? SPRINT_MULT : 1.0);

    direction.set(0, 0, 0);
    if (keys['KeyW'] || keys['ArrowUp'])    direction.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown'])  direction.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft'])  direction.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) direction.x += 1;
    direction.normalize();

    // Move relative to camera yaw only
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right   = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));

    velocity.set(0, 0, 0);
    velocity.addScaledVector(forward, direction.z * speed);
    velocity.addScaledVector(right,   direction.x * speed);

    camera.position.addScaledVector(velocity, delta);

    // Clamp to arena
    camera.position.x = Math.max(-(ARENA_SIZE - 0.5), Math.min(ARENA_SIZE - 0.5, camera.position.x));
    camera.position.z = Math.max(-(ARENA_SIZE - 0.5), Math.min(ARENA_SIZE - 0.5, camera.position.z));
    camera.position.y = PLAYER_HEIGHT;

    // Auto-fire when mouse held
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
    const delta = Math.min((now - prevTime) / 1000, 0.1);   // cap at 100ms
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
    }

    renderer.render(scene, camera);
  }

  animate();
})();
