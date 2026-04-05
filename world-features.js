/* ============================================================
 *  WORLD-FEATURES.JS — 8 new world/environment features
 *  Features: fire spread, destructible trees, radiation zones,
 *  supply airdrops, landmines, barbed wire, sandbag deploy, smoke zones
 * ============================================================ */
const WorldFeatures = (function () {
  'use strict';

  let _scene = null;
  let _THREE = null;

  const CFG = {
    // Fire spread
    FIRE_SPREAD_RATE: 0.5,     // chance per second to spread
    FIRE_SPREAD_RADIUS: 2,     // blocks
    FIRE_DAMAGE: 8,            // dps to player/enemies in fire
    FIRE_DURATION: 10,         // seconds per fire cell
    FIRE_MAX: 50,              // max simultaneous fires
    // Destructible trees
    TREE_HP: 40,
    TREE_FALL_SPEED: 2.0,      // radians/sec when falling
    // Radiation zones
    RAD_DAMAGE: 5,             // dps in radiation
    RAD_BLUR: 0.3,             // screen effect intensity
    // Supply airdrops
    AIRDROP_FALL_SPEED: 4,     // units/sec
    AIRDROP_CONTENTS: ['WEAPON', 'AMMO_CRATE', 'MEDKIT', 'ARMOR', 'KILLSTREAK'],
    // Landmines
    MINE_TRIGGER_RADIUS: 1.5,
    MINE_DAMAGE: 120,
    MINE_BLAST_RADIUS: 4,
    MINE_MAX: 20,
    // Barbed wire
    WIRE_SLOW: 0.3,            // speed multiplier in wire
    WIRE_TICK_DMG: 2,          // damage per second in wire
    WIRE_HP: 25,
    // Sandbag
    SANDBAG_HP: 60,
    SANDBAG_DEPLOY_TIME: 1.0,  // seconds to place
    // Smoke zones
    SMOKE_DURATION: 12,        // seconds
    SMOKE_RADIUS: 5,           // units
    SMOKE_MAX: 10
  };

  /* ── State ──────────────────────────────────── */
  let fires = [];
  let trees = [];
  let radiationZones = [];
  let airdrops = [];
  let landmines = [];
  let barbedWire = [];
  let sandbags = [];
  let smokeZones = [];

  function init(scene, THREE) {
    _scene = scene;
    _THREE = THREE;
    clear();
  }

  function clear() {
    fires.forEach(f => { if (f.mesh) _scene.remove(f.mesh); });
    trees.forEach(t => { if (t.mesh) _scene.remove(t.mesh); });
    airdrops.forEach(a => { if (a.mesh) _scene.remove(a.mesh); });
    landmines.forEach(m => { if (m.mesh) _scene.remove(m.mesh); });
    barbedWire.forEach(w => { if (w.mesh) _scene.remove(w.mesh); });
    sandbags.forEach(s => { if (s.mesh) _scene.remove(s.mesh); });
    smokeZones.forEach(s => { if (s.mesh) _scene.remove(s.mesh); });
    fires = []; trees = []; radiationZones = []; airdrops = [];
    landmines = []; barbedWire = []; sandbags = []; smokeZones = [];
  }

  /* ── Feature 24: Dynamic Fire Spread ───────── */
  function ignite(x, y, z) {
    if (fires.length >= CFG.FIRE_MAX) return;
    if (fires.some(f => f.x === x && f.y === y && f.z === z)) return;
    const geo = new _THREE.BoxGeometry(1, 1.5, 1);
    const mat = new _THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 });
    const mesh = new _THREE.Mesh(geo, mat);
    mesh.position.set(x + 0.5, y + 0.75, z + 0.5);
    _scene.add(mesh);
    // add light for fire glow
    const light = new _THREE.PointLight(0xff6600, 1.5, 6);
    light.position.copy(mesh.position);
    _scene.add(light);
    fires.push({ x, y, z, mesh, light, timer: CFG.FIRE_DURATION, spreadCD: 1 });
  }

  function updateFires(dt, getBlock, setBlock) {
    const damageZones = [];
    for (let i = fires.length - 1; i >= 0; i--) {
      const f = fires[i];
      f.timer -= dt;
      f.mesh.material.opacity = 0.4 + Math.sin(Date.now() * 0.01) * 0.3;
      f.mesh.scale.y = 1 + Math.sin(Date.now() * 0.008 + i) * 0.2;
      if (f.timer <= 0) {
        _scene.remove(f.mesh); _scene.remove(f.light);
        fires.splice(i, 1);
        continue;
      }
      damageZones.push({ x: f.x + 0.5, y: f.y, z: f.z + 0.5, radius: 1.5, dps: CFG.FIRE_DAMAGE });
      // spread
      f.spreadCD -= dt;
      if (f.spreadCD <= 0) {
        f.spreadCD = 1 / CFG.FIRE_SPREAD_RATE;
        if (Math.random() < CFG.FIRE_SPREAD_RATE * 0.3) {
          const dx = Math.floor(Math.random() * 3) - 1;
          const dz = Math.floor(Math.random() * 3) - 1;
          const nb = getBlock(f.x + dx, f.y, f.z + dz);
          if (nb === 4) ignite(f.x + dx, f.y, f.z + dz); // WOOD burns
        }
      }
    }
    return damageZones;
  }

  /* ── Feature 25: Destructible Trees ────────── */
  function spawnTree(x, y, z) {
    const trunk = new _THREE.CylinderGeometry(0.3, 0.4, 4, 6);
    const tMat = new _THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const crown = new _THREE.SphereGeometry(2, 6, 5);
    const cMat = new _THREE.MeshLambertMaterial({ color: 0x228B22 });
    const group = new _THREE.Group();
    group.add(new _THREE.Mesh(trunk, tMat));
    const crownMesh = new _THREE.Mesh(crown, cMat);
    crownMesh.position.y = 3;
    group.add(crownMesh);
    group.position.set(x, y, z);
    _scene.add(group);
    trees.push({ mesh: group, hp: CFG.TREE_HP, falling: false, fallAngle: 0, fallDir: Math.random() * Math.PI * 2, x, y, z });
    return trees[trees.length - 1];
  }

  function damageTree(tree, dmg) {
    tree.hp -= dmg;
    if (tree.hp <= 0 && !tree.falling) {
      tree.falling = true;
    }
  }

  function updateTrees(dt) {
    for (let i = trees.length - 1; i >= 0; i--) {
      const t = trees[i];
      if (t.falling) {
        t.fallAngle += CFG.TREE_FALL_SPEED * dt;
        t.mesh.rotation.z = Math.sin(t.fallDir) * t.fallAngle;
        t.mesh.rotation.x = Math.cos(t.fallDir) * t.fallAngle;
        if (t.fallAngle > Math.PI / 2) {
          // tree has fallen, mark as debris
          t.mesh.position.y -= dt;
          if (t.mesh.position.y < t.y - 2) {
            _scene.remove(t.mesh);
            trees.splice(i, 1);
          }
        }
      }
    }
  }

  function findTreeNear(x, y, z, radius) {
    return trees.find(t => {
      const dx = t.x - x, dz = t.z - z;
      return dx * dx + dz * dz < radius * radius && !t.falling;
    });
  }

  /* ── Feature 26: Radiation Zones ───────────── */
  function addRadiationZone(x, z, radius) {
    radiationZones.push({ x, z, radius, damage: CFG.RAD_DAMAGE });
  }

  function checkRadiation(px, pz) {
    for (const zone of radiationZones) {
      const dx = px - zone.x, dz = pz - zone.z;
      if (dx * dx + dz * dz < zone.radius * zone.radius) {
        return { inZone: true, damage: zone.damage, blur: CFG.RAD_BLUR };
      }
    }
    return { inZone: false, damage: 0, blur: 0 };
  }

  /* ── Feature 27: Supply Airdrops ───────────── */
  function spawnAirdrop(x, z, targetY) {
    const geo = new _THREE.BoxGeometry(2, 1.5, 2);
    const mat = new _THREE.MeshLambertMaterial({ color: 0x556b2f });
    const mesh = new _THREE.Mesh(geo, mat);
    const startY = 50;
    mesh.position.set(x, startY, z);
    _scene.add(mesh);
    const contents = CFG.AIRDROP_CONTENTS[Math.floor(Math.random() * CFG.AIRDROP_CONTENTS.length)];
    airdrops.push({ mesh, targetY: targetY + 1, contents, landed: false, collectRange: 3 });
  }

  function updateAirdrops(dt) {
    const landed = [];
    for (let i = airdrops.length - 1; i >= 0; i--) {
      const a = airdrops[i];
      if (!a.landed) {
        a.mesh.position.y -= CFG.AIRDROP_FALL_SPEED * dt;
        if (a.mesh.position.y <= a.targetY) {
          a.mesh.position.y = a.targetY;
          a.landed = true;
          landed.push(a);
        }
      }
    }
    return landed;
  }

  function collectAirdrop(playerPos) {
    for (let i = airdrops.length - 1; i >= 0; i--) {
      const a = airdrops[i];
      if (!a.landed) continue;
      const dx = playerPos.x - a.mesh.position.x, dz = playerPos.z - a.mesh.position.z;
      if (dx * dx + dz * dz < a.collectRange * a.collectRange) {
        _scene.remove(a.mesh);
        const result = a.contents;
        airdrops.splice(i, 1);
        return result;
      }
    }
    return null;
  }

  /* ── Feature 28: Landmines ─────────────────── */
  function placeMine(x, y, z, faction) {
    if (landmines.length >= CFG.MINE_MAX) return false;
    const geo = new _THREE.CylinderGeometry(0.4, 0.4, 0.1, 8);
    const mat = new _THREE.MeshLambertMaterial({ color: faction === 'player' ? 0x44aa44 : 0xaa4444 });
    const mesh = new _THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.05, z);
    _scene.add(mesh);
    landmines.push({ mesh, x, y, z, faction, armed: true });
    return true;
  }

  function updateMines(playerPos, enemyPositions) {
    const explosions = [];
    for (let i = landmines.length - 1; i >= 0; i--) {
      const m = landmines[i];
      if (!m.armed) continue;
      // check player (enemy mines)
      if (m.faction === 'enemy') {
        const dx = playerPos.x - m.x, dz = playerPos.z - m.z;
        if (dx * dx + dz * dz < CFG.MINE_TRIGGER_RADIUS * CFG.MINE_TRIGGER_RADIUS) {
          explosions.push({ x: m.x, y: m.y, z: m.z, damage: CFG.MINE_DAMAGE, radius: CFG.MINE_BLAST_RADIUS, target: 'player' });
          _scene.remove(m.mesh);
          landmines.splice(i, 1);
          continue;
        }
      }
      // check enemies (player mines)
      if (m.faction === 'player' && enemyPositions) {
        for (const ep of enemyPositions) {
          const dx = ep.x - m.x, dz = ep.z - m.z;
          if (dx * dx + dz * dz < CFG.MINE_TRIGGER_RADIUS * CFG.MINE_TRIGGER_RADIUS) {
            explosions.push({ x: m.x, y: m.y, z: m.z, damage: CFG.MINE_DAMAGE, radius: CFG.MINE_BLAST_RADIUS, target: 'enemy' });
            _scene.remove(m.mesh);
            landmines.splice(i, 1);
            break;
          }
        }
      }
    }
    return explosions;
  }

  /* ── Feature 29: Barbed Wire ───────────────── */
  function placeWire(x, y, z) {
    const geo = new _THREE.BoxGeometry(2, 0.8, 2);
    const mat = new _THREE.MeshLambertMaterial({ color: 0x888888, wireframe: true });
    const mesh = new _THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.4, z);
    _scene.add(mesh);
    barbedWire.push({ mesh, x, y, z, hp: CFG.WIRE_HP, radius: 1.5 });
    return true;
  }

  function checkWire(px, pz) {
    for (const w of barbedWire) {
      const dx = px - w.x, dz = pz - w.z;
      if (dx * dx + dz * dz < w.radius * w.radius) {
        return { inWire: true, speedMult: CFG.WIRE_SLOW, tickDmg: CFG.WIRE_TICK_DMG };
      }
    }
    return { inWire: false };
  }

  function damageWire(x, z, dmg) {
    for (let i = barbedWire.length - 1; i >= 0; i--) {
      const w = barbedWire[i];
      const dx = x - w.x, dz = z - w.z;
      if (dx * dx + dz * dz < 3) {
        w.hp -= dmg;
        if (w.hp <= 0) {
          _scene.remove(w.mesh);
          barbedWire.splice(i, 1);
        }
        return true;
      }
    }
    return false;
  }

  /* ── Feature 30: Sandbag Quick-Deploy ──────── */
  let sandbagDeploying = false, sandbagTimer = 0, sandbagPending = null;

  function startSandbagDeploy(x, y, z) {
    if (sandbagDeploying) return false;
    sandbagDeploying = true;
    sandbagTimer = CFG.SANDBAG_DEPLOY_TIME;
    sandbagPending = { x, y, z };
    return true;
  }

  function updateSandbagDeploy(dt) {
    if (!sandbagDeploying) return null;
    sandbagTimer -= dt;
    if (sandbagTimer <= 0) {
      sandbagDeploying = false;
      const s = sandbagPending;
      const geo = new _THREE.BoxGeometry(2, 1, 1);
      const mat = new _THREE.MeshLambertMaterial({ color: 0xc2b280 });
      const mesh = new _THREE.Mesh(geo, mat);
      mesh.position.set(s.x, s.y + 0.5, s.z);
      _scene.add(mesh);
      sandbags.push({ mesh, x: s.x, y: s.y, z: s.z, hp: CFG.SANDBAG_HP });
      return { placed: true, x: s.x, y: s.y, z: s.z };
    }
    return { progress: 1 - sandbagTimer / CFG.SANDBAG_DEPLOY_TIME };
  }

  /* ── Feature 31: Smoke Zones ───────────────── */
  function createSmoke(x, y, z) {
    if (smokeZones.length >= CFG.SMOKE_MAX) return false;
    const geo = new _THREE.SphereGeometry(CFG.SMOKE_RADIUS, 8, 6);
    const mat = new _THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.4 });
    const mesh = new _THREE.Mesh(geo, mat);
    mesh.position.set(x, y + CFG.SMOKE_RADIUS * 0.5, z);
    _scene.add(mesh);
    smokeZones.push({ mesh, x, y, z, timer: CFG.SMOKE_DURATION, radius: CFG.SMOKE_RADIUS });
    return true;
  }

  function updateSmoke(dt) {
    for (let i = smokeZones.length - 1; i >= 0; i--) {
      const s = smokeZones[i];
      s.timer -= dt;
      s.mesh.material.opacity = 0.4 * (s.timer / CFG.SMOKE_DURATION);
      if (s.timer <= 0) {
        _scene.remove(s.mesh);
        smokeZones.splice(i, 1);
      }
    }
  }

  function isInSmoke(px, py, pz) {
    for (const s of smokeZones) {
      const dx = px - s.x, dy = py - s.y, dz = pz - s.z;
      if (dx * dx + dy * dy + dz * dz < s.radius * s.radius) return true;
    }
    return false;
  }

  /* ── Destructible Environment ────────────── */
  function applyExplosionDamage(x, y, z, radius, damage) {
    const destroyed = [];
    if (typeof VoxelWorld === 'undefined' || !VoxelWorld.getBlock || !VoxelWorld.setBlock) return destroyed;
    const r = Math.ceil(radius);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > radius) continue;
          const bx = Math.floor(x) + dx;
          const by = Math.floor(y) + dy;
          const bz = Math.floor(z) + dz;
          const block = VoxelWorld.getBlock(bx, by, bz);
          if (block === 0) continue;
          // Weak blocks: wood(4), glass(6), dirt(1) — destroy if damage sufficient
          const weakBlocks = { 1: 30, 4: 20, 6: 10 };
          const threshold = weakBlocks[block];
          if (threshold !== undefined) {
            const falloff = 1 - (dist / radius);
            if (damage * falloff >= threshold) {
              VoxelWorld.setBlock(bx, by, bz, 0);
              destroyed.push({ x: bx, y: by, z: bz, wasBlock: block });
            }
          }
        }
      }
    }
    return destroyed;
  }

  /* ── Weather Hazards ───────────────────────── */
  const HAZARD_ZONES = [];
  let _hazardNextId = 1;

  function addHazardZone(x, z, radius, type, damage) {
    const id = _hazardNextId++;
    HAZARD_ZONES.push({ id, x, z, radius, type, damage, duration: 30, elapsed: 0 });
    return id;
  }

  function checkHazards(px, pz) {
    for (const h of HAZARD_ZONES) {
      const dx = px - h.x, dz = pz - h.z;
      if (dx * dx + dz * dz < h.radius * h.radius) {
        let effect = 'none';
        if (h.type === 'toxic_gas') effect = 'poison';
        else if (h.type === 'oil_fire') effect = 'burn';
        else if (h.type === 'electric') effect = 'stun';
        else if (h.type === 'quicksand') effect = 'slow';
        return { inHazard: true, type: h.type, damage: h.damage, effect };
      }
    }
    return { inHazard: false, type: null, damage: 0, effect: 'none' };
  }

  function updateHazards(delta) {
    for (let i = HAZARD_ZONES.length - 1; i >= 0; i--) {
      HAZARD_ZONES[i].elapsed += delta;
      if (HAZARD_ZONES[i].elapsed >= HAZARD_ZONES[i].duration) {
        HAZARD_ZONES.splice(i, 1);
      }
    }
  }

  /* ── Fortification System ──────────────────── */
  const FORTIFICATION_TYPES = {
    bunker:     { hp: 100, label: 'Bunker',     blocksBullets: true,  color: 0x555555, size: [3, 2, 3] },
    barricade:  { hp: 50,  label: 'Barricade',   slowsEnemies: true,  color: 0x8B7355, size: [2, 1, 1] },
    watchtower: { hp: 80,  label: 'Watchtower',  grantsVision: true,  color: 0x6B4226, size: [2, 4, 2] },
    ammo_cache: { hp: 40,  label: 'Ammo Cache',  resupplies: true,    color: 0x556B2F, size: [1, 1, 1] }
  };

  const _fortifications = [];
  let _fortNextId = 1;

  function buildFortification(type, x, y, z, scene) {
    const def = FORTIFICATION_TYPES[type];
    if (!def) return null;
    const s = scene || _scene;
    const geo = new _THREE.BoxGeometry(def.size[0], def.size[1], def.size[2]);
    const mat = new _THREE.MeshLambertMaterial({ color: def.color });
    const mesh = new _THREE.Mesh(geo, mat);
    mesh.position.set(x, y + def.size[1] / 2, z);
    if (s) s.add(mesh);
    const fort = { id: _fortNextId++, type, hp: def.hp, maxHp: def.hp, mesh, x, y, z };
    _fortifications.push(fort);
    return fort;
  }

  function getFortifications() {
    return _fortifications;
  }

  function damageFortification(id, dmg) {
    const fort = _fortifications.find(f => f.id === id);
    if (!fort) return false;
    fort.hp -= dmg;
    if (fort.hp <= 0) {
      if (fort.mesh && _scene) _scene.remove(fort.mesh);
      const idx = _fortifications.indexOf(fort);
      if (idx !== -1) _fortifications.splice(idx, 1);
      return true; // destroyed
    }
    return false;
  }

  /* ── Dynamic Cover Points ──────────────────── */
  function findCoverPoints(playerPos, enemyDir, count) {
    const covers = [];
    if (typeof VoxelWorld === 'undefined' || !VoxelWorld.getBlock) return covers;
    const searchRadius = 12;
    const px = Math.floor(playerPos.x);
    const py = Math.floor(playerPos.y);
    const pz = Math.floor(playerPos.z);
    // Normalize enemy direction
    const edx = enemyDir.x || 0;
    const edz = enemyDir.z || 0;
    const elen = Math.sqrt(edx * edx + edz * edz) || 1;
    const enx = edx / elen;
    const enz = edz / elen;

    for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
      for (let dz = -searchRadius; dz <= searchRadius; dz += 2) {
        const bx = px + dx;
        const bz = pz + dz;
        // Check if there's a solid block that could be cover
        const block = VoxelWorld.getBlock(bx, py, bz);
        const blockAbove = VoxelWorld.getBlock(bx, py + 1, bz);
        if (block !== 0 && blockAbove === 0) {
          // Quality = how much this block is between player and enemy
          const toBlockX = bx - px;
          const toBlockZ = bz - pz;
          const dot = toBlockX * enx + toBlockZ * enz;
          if (dot > 0) {
            const dist = Math.sqrt(dx * dx + dz * dz);
            const quality = Math.max(0, 1 - dist / searchRadius) * (dot / (dist || 1));
            covers.push({ x: bx, y: py, z: bz, quality });
          }
        }
      }
    }
    covers.sort((a, b) => b.quality - a.quality);
    return covers.slice(0, count || 5);
  }

  /* ── Master Update ─────────────────────────── */
  function update(dt, getBlock, setBlock, playerPos, enemyPositions) {
    const fireDmg = updateFires(dt, getBlock, setBlock);
    updateTrees(dt);
    const landedDrops = updateAirdrops(dt);
    const mineExplosions = updateMines(playerPos, enemyPositions);
    const sandbagResult = updateSandbagDeploy(dt);
    updateSmoke(dt);
    updateHazards(dt);
    return { fireDmg, landedDrops, mineExplosions, sandbagResult };
  }

  return {
    CFG, init, clear, update,
    // Fire
    ignite, updateFires,
    // Trees
    spawnTree, damageTree, findTreeNear,
    // Radiation
    addRadiationZone, checkRadiation,
    // Airdrops
    spawnAirdrop, collectAirdrop,
    // Mines
    placeMine, updateMines,
    // Wire
    placeWire, checkWire, damageWire,
    // Sandbags
    startSandbagDeploy,
    // Smoke
    createSmoke, isInSmoke,
    // Destructible environment
    applyExplosionDamage,
    // Weather hazards
    HAZARD_ZONES,
    addHazardZone,
    checkHazards,
    updateHazards,
    // Fortifications
    FORTIFICATION_TYPES,
    buildFortification,
    getFortifications,
    damageFortification,
    // Dynamic cover
    findCoverPoints,
    // Getters
    getFires: () => fires,
    getTrees: () => trees,
    getRadZones: () => radiationZones,
    getAirdrops: () => airdrops,
    getMines: () => landmines,
    getWire: () => barbedWire,
    getSandbags: () => sandbags,
    getSmokeZones: () => smokeZones
  };
})();
