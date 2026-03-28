/**
 * weapons.js – Multi-weapon system: PKM Machine Gun, AK-74M, SVD Dragunov
 * Switch with keys 1 / 2 / 3.
 * Depends on: Three.js global (THREE), HUD
 */

const Weapons = (() => {
  // ── Weapon definitions ────────────────────────────────────
  const WEAPONS = [
    {
      id:         'PKM',
      name:       'PKM Machine Gun',
      damage:     18,
      fireRate:   0.07,    // very fast – machine gun
      clipSize:   100,
      maxReserve: 250,
      reloadTime: 4.5,
      spread:     0.048,
      auto:       true,
    },
    {
      id:         'AK74',
      name:       'AK-74M',
      damage:     28,
      fireRate:   0.10,
      clipSize:   30,
      maxReserve: 120,
      reloadTime: 2.2,
      spread:     0.022,
      auto:       true,
    },
    {
      id:         'SVD',
      name:       'SVD Dragunov',
      damage:     115,
      fireRate:   0.85,    // semi-auto sniper
      clipSize:   10,
      maxReserve: 40,
      reloadTime: 3.5,
      spread:     0.004,
      auto:       false,
    },
  ];

  // ── Per-weapon mutable state ───────────────────────────────
  function makeState(cfg) {
    return { clip: cfg.clipSize, reserve: cfg.maxReserve, reloading: false, reloadTimer: 0, fireCooldown: 0 };
  }
  let states     = WEAPONS.map(makeState);
  let currentIdx = 0;
  function cur()      { return WEAPONS[currentIdx]; }
  function curState() { return states[currentIdx]; }

  // ── Gun meshes (one group per weapon, toggled by visibility) ─
  const gunMeshes = [];

  function buildPkmMesh() {
    const g = new THREE.Group();
    // Long heavy barrel
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.048, 0.65),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.17, -0.13, -0.54);
    // Receiver
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.10, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x3a3a28 })
    );
    body.position.set(0.17, -0.14, -0.22);
    // Round drum magazine
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.072, 12),
      new THREE.MeshLambertMaterial({ color: 0x2a2a18 })
    );
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0.17, -0.21, -0.22);
    // Grip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.10, 0.056),
      new THREE.MeshLambertMaterial({ color: 0x1a1a0a })
    );
    grip.position.set(0.17, -0.22, -0.16);
    // Bipod leg L
    const bipL = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.14, 0.012),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    bipL.position.set(0.14, -0.18, -0.48);
    bipL.rotation.z = 0.25;
    const bipR = bipL.clone();
    bipR.position.set(0.20, -0.18, -0.48);
    bipR.rotation.z = -0.25;
    g.add(barrel, body, drum, grip, bipL, bipR);
    return g;
  }

  function buildAkMesh() {
    const g = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.40),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    barrel.position.set(0.18, -0.14, -0.41);
    // Muzzle brake
    const brake = new THREE.Mesh(
      new THREE.BoxGeometry(0.054, 0.054, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    brake.position.set(0.18, -0.14, -0.63);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.08, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x443a28 })
    );
    body.position.set(0.18, -0.15, -0.24);
    // Curved banana magazine
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.13, 0.065),
      new THREE.MeshLambertMaterial({ color: 0x2a2218 })
    );
    mag.position.set(0.18, -0.25, -0.22);
    mag.rotation.x = 0.15;
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.10, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x221a0a })
    );
    grip.position.set(0.18, -0.22, -0.17);
    g.add(barrel, brake, body, mag, grip);
    return g;
  }

  function buildSvdMesh() {
    const g = new THREE.Group();
    // Long thin barrel
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.028, 0.60),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    barrel.position.set(0.17, -0.13, -0.56);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.07, 0.28),
      new THREE.MeshLambertMaterial({ color: 0x3a2a18 })
    );
    body.position.set(0.17, -0.145, -0.22);
    // Scope (cylinder on top)
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.24, 8),
      new THREE.MeshLambertMaterial({ color: 0x181818 })
    );
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0.17, -0.085, -0.28);
    // Straight magazine
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.10, 0.052),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    mag.position.set(0.17, -0.22, -0.22);
    // Skeletal stock cutout indicator (thin rear plate)
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.055, 0.14),
      new THREE.MeshLambertMaterial({ color: 0x3a2a18 })
    );
    stock.position.set(0.17, -0.155, -0.06);
    g.add(barrel, body, scope, mag, stock);
    return g;
  }

  function createGunMesh(camera) {
    gunMeshes.push(buildPkmMesh());
    gunMeshes.push(buildAkMesh());
    gunMeshes.push(buildSvdMesh());
    gunMeshes.forEach((m, i) => {
      m.visible = (i === currentIdx);
      camera.add(m);
    });
  }

  // ── Muzzle flash ──────────────────────────────────────────
  let muzzleFlash = null;
  let muzzleTimer = 0;

  function createMuzzleFlash(scene, camera) {
    const geo = new THREE.PlaneGeometry(0.3, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      color:       0xffdd44,
      transparent: true,
      opacity:     0,
      depthTest:   false,
      blending:    THREE.AdditiveBlending,
    });
    muzzleFlash = new THREE.Mesh(geo, mat);
    muzzleFlash.position.set(0.17, -0.11, -0.60);
    camera.add(muzzleFlash);
    scene.add(camera);
  }

  function showMuzzle() {
    if (!muzzleFlash) return;
    muzzleFlash.material.opacity = 1;
    muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    muzzleTimer = 0.06;
  }

  // ── Weapon switching ──────────────────────────────────────
  function switchTo(idx) {
    if (idx < 0 || idx >= WEAPONS.length) return;
    if (gunMeshes[currentIdx]) gunMeshes[currentIdx].visible = false;
    currentIdx = idx;
    if (gunMeshes[currentIdx]) gunMeshes[currentIdx].visible = true;
    const st = curState();
    HUD.setWeapon(cur().name, currentIdx);
    HUD.setAmmo(st.clip, st.reserve);
    HUD.showReload(st.reloading);
  }

  // ── Shooting ───────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const spreadVec = new THREE.Vector2();

  function tryFire(camera, targets, delta, onHit) {
    const wep = cur();
    const st  = curState();
    st.fireCooldown -= delta;
    if (st.reloading) return;
    if (st.fireCooldown > 0) return;
    st.fireCooldown = wep.fireRate;

    if (st.clip <= 0) {
      startReload();
      return;
    }

    st.clip--;
    HUD.setAmmo(st.clip, st.reserve);

    spreadVec.set(
      (Math.random() - 0.5) * wep.spread * 2,
      (Math.random() - 0.5) * wep.spread * 2
    );
    raycaster.setFromCamera(spreadVec, camera);
    const hits = raycaster.intersectObjects(targets, true);
    showMuzzle();

    if (hits.length > 0) onHit(hits[0], wep.damage);
    if (st.clip === 0 && st.reserve > 0) startReload();
  }

  function startReload() {
    const wep = cur();
    const st  = curState();
    if (st.reloading || st.reserve <= 0 || st.clip === wep.clipSize) return;
    st.reloading   = true;
    st.reloadTimer = wep.reloadTime;
    HUD.showReload(true);
  }

  function update(delta) {
    if (muzzleTimer > 0) {
      muzzleTimer -= delta;
      if (muzzleFlash) muzzleFlash.material.opacity = Math.max(0, muzzleTimer / 0.06);
    }
    const wep = cur();
    const st  = curState();
    if (st.reloading) {
      st.reloadTimer -= delta;
      if (st.reloadTimer <= 0) {
        const need = wep.clipSize - st.clip;
        const fill = Math.min(need, st.reserve);
        st.clip    += fill;
        st.reserve -= fill;
        st.reloading = false;
        HUD.showReload(false);
        HUD.setAmmo(st.clip, st.reserve);
      }
    }
  }

  function reset() {
    states     = WEAPONS.map(makeState);
    currentIdx = 0;
    gunMeshes.forEach((m, i) => { if (m) m.visible = (i === 0); });
    const st = curState();
    HUD.setAmmo(st.clip, st.reserve);
    HUD.setWeapon(cur().name, 0);
  }

  function addAmmo(amount) {
    const wep = cur();
    const st  = curState();
    st.reserve = Math.min(wep.maxReserve, st.reserve + amount);
    HUD.setAmmo(st.clip, st.reserve);
  }

  function forceReload() { startReload(); }
  function isReloading() { return curState().reloading; }
  function getClip()     { return curState().clip; }
  function getReserve()  { return curState().reserve; }
  function getDamage()   { return cur().damage; }

  return {
    createGunMesh,
    createMuzzleFlash,
    tryFire,
    update,
    reset,
    addAmmo,
    forceReload,
    isReloading,
    getClip,
    getReserve,
    getDamage,
    switchTo,
    getWeaponCount: () => WEAPONS.length,
    getCurrentIdx:  () => currentIdx,
    getCurrentName: () => cur().name,
  };
})();
