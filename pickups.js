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

  const TYPE_CONFIG = {
    HEALTH:  { color: 0x22ff55, emissive: 0x115522, size: 0.28 },
    AMMO:    { color: 0xffcc00, emissive: 0x664400, size: 0.24 },
    ARMOR:   { color: 0x4488ff, emissive: 0x224488, size: 0.30 },
    GRENADE: { color: 0xff6622, emissive: 0x883311, size: 0.20 },
    MEDKIT:  { color: 0xff4444, emissive: 0x882222, size: 0.32 },
    STIM:    { color: 0xcc44ff, emissive: 0x662288, size: 0.18 },
    INTEL:   { color: 0x00ffff, emissive: 0x006666, size: 0.22 },
    SHIELD:  { color: 0xffd700, emissive: 0x886600, size: 0.26 },
  };

  let scene   = null;
  let pickups = [];
  let time    = 0;

  function init(sc) { scene = sc; }

  function spawn(worldPos, type) {
    if (!scene) return;
    const cfg = TYPE_CONFIG[type];
    if (!cfg) return;

    const group = new THREE.Group();

    const boxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.size, cfg.size, cfg.size),
      new THREE.MeshLambertMaterial({
        color:             cfg.color,
        emissive:          cfg.emissive,
        emissiveIntensity: 0.5,
      })
    );

    // Decorative spinning ring
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.025, 8, 20),
      new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.75 })
    );
    ringMesh.rotation.x = Math.PI / 2;

    group.add(boxMesh, ringMesh);
    const spawnY = worldPos.y + 0.3;
    group.position.set(worldPos.x, spawnY, worldPos.z);
    scene.add(group);

    pickups.push({
      group,
      boxMesh,
      ringMesh,
      type,
      baseY: spawnY,
      phase: Math.random() * Math.PI * 2,
    });
  }

  function update(delta, playerPos, onCollect) {
    time += delta;

    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];

      // Hover + rotate animations
      p.group.position.y = p.baseY + Math.sin(time * HOVER_SPEED + p.phase) * HOVER_RANGE;
      p.boxMesh.rotation.y  += ROTATE_SPEED * delta;
      p.ringMesh.rotation.z += ROTATE_SPEED * 0.6 * delta;

      // Proximity collection
      const dx = p.group.position.x - playerPos.x;
      const dz = p.group.position.z - playerPos.z;
      if (dx * dx + dz * dz < COLLECT_DIST_SQ) {
        scene.remove(p.group);
        if (p.boxMesh)  { if (p.boxMesh.geometry) p.boxMesh.geometry.dispose(); if (p.boxMesh.material) p.boxMesh.material.dispose(); }
        if (p.ringMesh) { if (p.ringMesh.geometry) p.ringMesh.geometry.dispose(); if (p.ringMesh.material) p.ringMesh.material.dispose(); }
        pickups.splice(i, 1);
        onCollect(p.type);
      }
    }
  }

  function clear() {
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (scene) scene.remove(p.group);
      if (p.boxMesh)  { if (p.boxMesh.geometry) p.boxMesh.geometry.dispose(); if (p.boxMesh.material) p.boxMesh.material.dispose(); }
      if (p.ringMesh) { if (p.ringMesh.geometry) p.ringMesh.geometry.dispose(); if (p.ringMesh.material) p.ringMesh.material.dispose(); }
    }
    pickups = [];
    time    = 0;
  }

  return { init, spawn, update, clear, getAll: function () { return pickups; } };
})();
