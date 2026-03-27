/**
 * weapons.js – Weapon state and raycasted shooting
 * Depends on: Three.js global (THREE), HUD
 */

const Weapons = (() => {
  // ── Config ────────────────────────────────────────────────
  const GUN = {
    name:        'Assault Rifle',
    damage:      25,
    fireRate:    0.12,   // seconds between shots
    clipSize:    30,
    maxReserve:  90,
    reloadTime:  2.0,    // seconds
    spread:      0.02,   // radians
    auto:        true,
  };

  // ── State ─────────────────────────────────────────────────
  let clip       = GUN.clipSize;
  let reserve    = GUN.maxReserve;
  let reloading  = false;
  let reloadTimer = 0;
  let fireCooldown = 0;

  // ── Muzzle flash (simple plane) ───────────────────────────
  let muzzleFlash = null;
  let muzzleTimer = 0;

  function createMuzzleFlash(scene, camera) {
    const geo = new THREE.PlaneGeometry(0.3, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    muzzleFlash = new THREE.Mesh(geo, mat);
    // Position in front of camera, slightly down-right (gun barrel position)
    muzzleFlash.position.set(0.18, -0.14, -0.45);
    camera.add(muzzleFlash);
    scene.add(camera);
  }

  function showMuzzle() {
    if (!muzzleFlash) return;
    muzzleFlash.material.opacity = 1;
    muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    muzzleTimer = 0.06;
  }

  // ── Gun mesh (simple box representation) ──────────────────
  let gunMesh = null;

  function createGunMesh(camera) {
    const group = new THREE.Group();

    // Barrel
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.36),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    barrel.position.set(0.18, -0.14, -0.38);

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.08, 0.24),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    body.position.set(0.18, -0.15, -0.24);

    // Grip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.11, 0.06),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    grip.position.set(0.18, -0.22, -0.2);

    group.add(barrel, body, grip);
    gunMesh = group;
    camera.add(gunMesh);
  }

  // ── Shooting ───────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const spread    = new THREE.Vector2();

  /**
   * Attempt to fire. Returns hit { object, point, normal } or null.
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D[]} targets – meshes that can be hit
   * @param {number} delta – seconds since last frame
   */
  function tryFire(camera, targets, delta, onHit) {
    fireCooldown -= delta;
    if (reloading) return;

    if (fireCooldown > 0) return;
    fireCooldown = GUN.fireRate;

    if (clip <= 0) {
      startReload();
      return;
    }

    clip--;
    HUD.setAmmo(clip, reserve);

    // Apply spread to ray direction
    spread.set(
      (Math.random() - 0.5) * GUN.spread * 2,
      (Math.random() - 0.5) * GUN.spread * 2
    );

    raycaster.setFromCamera(spread, camera);
    const hits = raycaster.intersectObjects(targets, true);

    showMuzzle();

    if (hits.length > 0) {
      onHit(hits[0], GUN.damage);
    }

    if (clip === 0 && reserve > 0) {
      startReload();
    }
  }

  function startReload() {
    if (reloading || reserve <= 0 || clip === GUN.clipSize) return;
    reloading   = true;
    reloadTimer = GUN.reloadTime;
    HUD.showReload(true);
  }

  function update(delta) {
    // Muzzle flash fade
    if (muzzleTimer > 0) {
      muzzleTimer -= delta;
      if (muzzleFlash) {
        muzzleFlash.material.opacity = Math.max(0, muzzleTimer / 0.06);
      }
    }

    // Reload countdown
    if (reloading) {
      reloadTimer -= delta;
      if (reloadTimer <= 0) {
        const need  = GUN.clipSize - clip;
        const fill  = Math.min(need, reserve);
        clip       += fill;
        reserve    -= fill;
        reloading   = false;
        HUD.showReload(false);
        HUD.setAmmo(clip, reserve);
      }
    }
  }

  function reset() {
    clip     = GUN.clipSize;
    reserve  = GUN.maxReserve;
    reloading  = false;
    reloadTimer = 0;
    fireCooldown = 0;
    HUD.setAmmo(clip, reserve);
  }

  function forceReload() { startReload(); }
  function isReloading() { return reloading; }
  function getClip()     { return clip; }
  function getReserve()  { return reserve; }
  function getDamage()   { return GUN.damage; }

  return {
    createGunMesh,
    createMuzzleFlash,
    tryFire,
    update,
    reset,
    forceReload,
    isReloading,
    getClip,
    getReserve,
    getDamage,
  };
})();
