/**
 * pickups.js – Animated health & ammo collectibles
 * Depends on: Three.js global (THREE)
 */

const Pickups = (() => {
  const COLLECT_DIST = 1.5;
  const ROTATE_SPEED = 1.8;
  const HOVER_SPEED  = 1.4;
  const HOVER_RANGE  = 0.1;

  const COLLECT_DIST_SQ = COLLECT_DIST * COLLECT_DIST;
  const MAGNET_DIST = 4.0; // pickups glide toward player within this radius
  const MAGNET_DIST_SQ = MAGNET_DIST * MAGNET_DIST;

  const TYPE_CONFIG = {
    HEALTH:  { color: 0x22ff55, emissive: 0x115522, size: 0.28 },
    AMMO:    { color: 0xffcc00, emissive: 0x664400, size: 0.24 },
    ARMOR:   { color: 0x4488ff, emissive: 0x224488, size: 0.30 },
    GRENADE: { color: 0xff6622, emissive: 0x883311, size: 0.20 },
    MEDKIT:  { color: 0xff4444, emissive: 0x882222, size: 0.32 },
    STIM:    { color: 0xcc44ff, emissive: 0x662288, size: 0.18 },
    INTEL:   { color: 0x00ffff, emissive: 0x006666, size: 0.22 },
    SHIELD:  { color: 0xffd700, emissive: 0x886600, size: 0.26 },
    WEAPON:  { color: 0xff8800, emissive: 0x884400, size: 0.30 },
  };

  let scene   = null;
  let pickups = [];
  let time    = 0;

  // Shared geometry instances (reused across all pickups)
  var _boxGeos = {};   // keyed by size
  var _ringGeo = null; // single torus shared by all

  function _getBoxGeo(size) {
    if (!_boxGeos[size]) _boxGeos[size] = new THREE.BoxGeometry(size, size, size);
    return _boxGeos[size];
  }
  function _getRingGeo() {
    if (!_ringGeo) _ringGeo = new THREE.TorusGeometry(0.25, 0.025, 8, 20);
    return _ringGeo;
  }
  var _beamGeo = null;
  function _getBeamGeo() {
    if (!_beamGeo) _beamGeo = new THREE.CylinderGeometry(0.06, 0.10, 8, 6, 1, true);
    return _beamGeo;
  }

  function init(sc) { scene = sc; }

  function spawn(worldPos, type, data) {
    if (!scene) return;
    const cfg = TYPE_CONFIG[type];
    if (!cfg) return;

    const group = new THREE.Group();

    const boxMesh = new THREE.Mesh(
      _getBoxGeo(cfg.size),
      new THREE.MeshLambertMaterial({
        color:             cfg.color,
        emissive:          cfg.emissive,
        emissiveIntensity: 0.5,
      })
    );

    // Decorative spinning ring
    const ringMesh = new THREE.Mesh(
      _getRingGeo(),
      new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.75 })
    );
    ringMesh.rotation.x = Math.PI / 2;

    // Vertical light beam — visible from a distance
    const beamMesh = new THREE.Mesh(
      _getBeamGeo(),
      new THREE.MeshBasicMaterial({
        color: cfg.color, transparent: true, opacity: 0.18,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    beamMesh.position.y = 4; // tall pillar above pickup

    group.add(boxMesh, ringMesh, beamMesh);
    const spawnY = worldPos.y + 0.3;
    group.position.set(worldPos.x, spawnY, worldPos.z);
    scene.add(group);

    pickups.push({
      group,
      boxMesh,
      ringMesh,
      beamMesh,
      type,
      data: data || null,
      baseY: spawnY,
      phase: Math.random() * Math.PI * 2,
      life: type === 'WEAPON' ? 30 : Infinity, // weapon drops expire after 30s
    });
  }

  function update(delta, playerPos, onCollect) {
    time += delta;

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];

      // Weapon drop lifetime expiry
      if (p.life !== Infinity) {
        p.life -= delta;
        if (p.life <= 0) {
          scene.remove(p.group);
          if (p.boxMesh && p.boxMesh.material) p.boxMesh.material.dispose();
          if (p.ringMesh && p.ringMesh.material) p.ringMesh.material.dispose();
          if (p.beamMesh && p.beamMesh.material) p.beamMesh.material.dispose();
          pickups.splice(i, 1);
          continue;
        }
        // Flash when about to expire (last 5s)
        if (p.life < 5) {
          p.group.visible = Math.sin(time * 8) > 0;
        }
      }

      // Hover + rotate animations
      p.group.position.y = p.baseY + Math.sin(time * HOVER_SPEED + p.phase) * HOVER_RANGE;
      p.boxMesh.rotation.y  += ROTATE_SPEED * delta;
      p.ringMesh.rotation.z += ROTATE_SPEED * 0.6 * delta;
      // Proximity scale-up: pickups grow + glow brighter as you approach
      try {
        var pdx = p.group.position.x - playerPos.x;
        var pdz = p.group.position.z - playerPos.z;
        var pDistSq = pdx * pdx + pdz * pdz;
        var proxAmt = pDistSq < 64 ? Math.max(0, 1 - Math.sqrt(pDistSq) / 8) : 0; // within 8m
        var proxScale = 1 + proxAmt * 0.35;
        p.boxMesh.scale.setScalar(proxScale);
        p.ringMesh.scale.setScalar(proxScale);
        if (p.boxMesh.material && p.boxMesh.material.emissiveIntensity !== undefined) {
          p.boxMesh.material.emissiveIntensity = 0.5 + proxAmt * 0.7;
        }
      } catch (eP) {}
      // Pulse the beam — a subtle breath that helps it stand out at distance
      if (p.beamMesh && p.beamMesh.material) {
        p.beamMesh.material.opacity = 0.14 + (Math.sin(time * 2.4 + p.phase) * 0.5 + 0.5) * 0.16;
      }

      // Proximity collection (XZ + Y check to prevent through-floor collection)
      const dx = p.group.position.x - playerPos.x;
      const dz = p.group.position.z - playerPos.z;
      const dy = Math.abs(p.group.position.y - playerPos.y);
      const distSq = dx * dx + dz * dz;
      // Magnet glide: drift toward player within MAGNET_DIST (skip weapon drops to avoid auto-grab unintended weapons)
      if (p.type !== 'WEAPON' && distSq < MAGNET_DIST_SQ && distSq > COLLECT_DIST_SQ && dy < 3) {
        const pull = 6 * delta * (1 - Math.sqrt(distSq) / MAGNET_DIST);
        p.group.position.x -= dx * pull;
        p.group.position.z -= dz * pull;
        p.baseY += (playerPos.y + 0.5 - p.baseY) * pull * 0.5;
      }
      if (distSq < COLLECT_DIST_SQ && dy < 3) {
        // Collection spark burst — gratifying visual confirmation
        if (typeof Tracers !== 'undefined' && Tracers.spawnSparks) {
          try { Tracers.spawnSparks(p.group.position); } catch (eS) {}
        }
        scene.remove(p.group);
        if (p.boxMesh && p.boxMesh.material) p.boxMesh.material.dispose();
        if (p.ringMesh && p.ringMesh.material) p.ringMesh.material.dispose();
        if (p.beamMesh && p.beamMesh.material) p.beamMesh.material.dispose();
        pickups.splice(i, 1);
        onCollect(p.type, p.data);
      }
    }
  }

  function clear() {
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (scene) scene.remove(p.group);
      if (p.boxMesh && p.boxMesh.material) p.boxMesh.material.dispose();
      if (p.ringMesh && p.ringMesh.material) p.ringMesh.material.dispose();
      if (p.beamMesh && p.beamMesh.material) p.beamMesh.material.dispose();
    }
    pickups = [];
    time    = 0;
    // Dispose shared geometry on full clear (stage transition)
    for (var k in _boxGeos) { _boxGeos[k].dispose(); }
    _boxGeos = {};
    if (_ringGeo) { _ringGeo.dispose(); _ringGeo = null; }
    if (_beamGeo) { _beamGeo.dispose(); _beamGeo = null; }
  }

  return { init, spawn, update, clear, getAll: function () { return pickups; } };
})();
