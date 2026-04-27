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

  function _disposeMesh(m) {
    if (!m) return;
    m.traverse(function (child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(function (mt) { mt.dispose(); });
        else child.material.dispose();
      }
    });
  }

  function clear() {
    fires.forEach(function (f) {
      if (f.mesh) { _scene.remove(f.mesh); _disposeMesh(f.mesh); }
      if (f.light) _scene.remove(f.light);
    });
    trees.forEach(function (t) { if (t.mesh) { _scene.remove(t.mesh); _disposeMesh(t.mesh); } });
    airdrops.forEach(function (a) { if (a.mesh) { _scene.remove(a.mesh); _disposeMesh(a.mesh); } });
    landmines.forEach(function (m) { if (m.mesh) { _scene.remove(m.mesh); _disposeMesh(m.mesh); } });
    barbedWire.forEach(function (w) { if (w.mesh) { _scene.remove(w.mesh); _disposeMesh(w.mesh); } });
    sandbags.forEach(function (s) { if (s.mesh) { _scene.remove(s.mesh); _disposeMesh(s.mesh); } });
    smokeZones.forEach(function (s) { if (s.mesh) { _scene.remove(s.mesh); _disposeMesh(s.mesh); } });
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
        _scene.remove(f.mesh); _disposeMesh(f.mesh); _scene.remove(f.light);
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
            _scene.remove(t.mesh); _disposeMesh(t.mesh);
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
    // Crate
    const geo = new _THREE.BoxGeometry(2, 1.5, 2);
    const mat = new _THREE.MeshLambertMaterial({ color: 0x556b2f });
    const mesh = new _THREE.Mesh(geo, mat);
    // Parachute (hemisphere)
    const chuteGeo = new _THREE.SphereGeometry(1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const chuteMat = new _THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const chute = new _THREE.Mesh(chuteGeo, chuteMat);
    chute.position.set(0, 1.5, 0);
    mesh.add(chute);
    // Start position
    const startY = 50;
    mesh.position.set(x, startY, z);
    _scene.add(mesh);
    const contents = CFG.AIRDROP_CONTENTS[Math.floor(Math.random() * CFG.AIRDROP_CONTENTS.length)];
    airdrops.push({ mesh, chute, targetY: targetY + 1, contents, landed: false, collectRange: 3, landedVFX: false });
  }

  function updateAirdrops(dt) {
    const landed = [];
    for (let i = airdrops.length - 1; i >= 0; i--) {
      const a = airdrops[i];
      if (!a.landed) {
        a.mesh.position.y -= CFG.AIRDROP_FALL_SPEED * dt;
        // Parachute swaying animation
        if (a.chute) {
          a.chute.rotation.z = Math.sin(Date.now() * 0.001 + i) * 0.18;
          a.chute.material.opacity = 0.85 - 0.2 * Math.abs(Math.sin(Date.now() * 0.001 + i));
        }
        if (a.mesh.position.y <= a.targetY) {
          a.mesh.position.y = a.targetY;
          a.landed = true;
          landed.push(a);
        }
      } else if (!a.landedVFX) {
        // Play landing sound and VFX once
        a.landedVFX = true;
        if (a.chute) {
          a.mesh.remove(a.chute);
        }
        if (typeof window !== 'undefined' && window.AudioSystem && AudioSystem.playPickup) {
          AudioSystem.playPickup(); // Use pickup sound for now
        }
        // Simple dust VFX: spawn a transparent sphere that fades out
        if (_scene && _THREE) {
          const dustGeo = new _THREE.SphereGeometry(1.2, 10, 8);
          const dustMat = new _THREE.MeshBasicMaterial({ color: 0xccccaa, transparent: true, opacity: 0.35 });
          const dust = new _THREE.Mesh(dustGeo, dustMat);
          dust.position.copy(a.mesh.position);
          _scene.add(dust);
          setTimeout(() => { if (_scene) _scene.remove(dust); _disposeMesh(dust); }, 700);
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
        _scene.remove(a.mesh); _disposeMesh(a.mesh);
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
          _scene.remove(m.mesh); _disposeMesh(m.mesh);
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
            _scene.remove(m.mesh); _disposeMesh(m.mesh);
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

  // ── Explosive barrel detonation + chain reaction ──────────
  var _barrelCooldown = {};  // prevent infinite chain loops
  function detonateBarrel(bx, by, bz) {
    var key = bx + ',' + by + ',' + bz;
    if (_barrelCooldown[key]) return;
    _barrelCooldown[key] = true;
    // Remove the barrel block
    if (typeof VoxelWorld !== 'undefined' && VoxelWorld.setBlock) {
      VoxelWorld.setBlock(bx, by, bz, 0);
    }
    // Spawn fire at barrel location
    ignite(bx, by, bz);
    // Explosion VFX + audio
    if (typeof Tracers !== 'undefined' && Tracers.spawnExplosion) {
      Tracers.spawnExplosion(new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5));
    }
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playExplosion) {
      AudioSystem.playExplosion();
    }
    // Camera shake
    if (typeof CameraSystem !== 'undefined' && CameraSystem.shake) {
      CameraSystem.shake(0.05, 0.4);
    }
    // Destroy nearby blocks
    applyExplosionDamage(bx, by, bz, 3, 60);
    // Damage enemies in blast radius
    if (typeof Enemies !== 'undefined' && Enemies.damageInRadius) {
      Enemies.damageInRadius(new THREE.Vector3(bx + 0.5, by + 0.5, bz + 0.5), 5, 80);
    }
    // Chain reaction — find nearby barrels
    for (var dx = -2; dx <= 2; dx++) {
      for (var dy = -2; dy <= 2; dy++) {
        for (var dz = -2; dz <= 2; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue;
          var nx = bx + dx, ny = by + dy, nz = bz + dz;
          if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getBlock(nx, ny, nz) === 12) {
            // Delay chain reaction slightly for dramatic effect
            setTimeout(function(x, y, z) { return function() { detonateBarrel(x, y, z); }; }(nx, ny, nz), 150 + Math.random() * 200);
          }
        }
      }
    }
    // Clean up cooldown after chain is done
    setTimeout(function() { delete _barrelCooldown[key]; }, 2000);
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
    getSmokeZones: () => smokeZones,
    detonateBarrel: detonateBarrel,
  };
})();

// ══════════════════════════════════════════════════════════════
//  WATER SYSTEM — Ponds, rivers, reflections, fishable fish
// ══════════════════════════════════════════════════════════════
// (Appended outside IIFE but integrated via WorldFeatures)
(function() {
  var _scene = null;
  var _waterBodies = [];
  var _fish = [];
  var _fishPool = [];
  var _waterMat = null;
  var _fishGeo = null;
  var _fishMat = null;

  function initWaterSystem(scene) {
    _scene = scene;
    _waterMat = new THREE.MeshPhongMaterial({
      color: 0x2266aa, transparent: true, opacity: 0.55,
      shininess: 200, specular: 0xaaddff,
      side: THREE.DoubleSide, depthWrite: false,
    });
    _fishGeo = new THREE.BoxGeometry(0.3, 0.12, 0.08);
    _fishMat = new THREE.MeshLambertMaterial({ color: 0x886644 });
  }

  function spawnWaterBody(cx, cz, radiusX, radiusZ, depth) {
    if (!_scene || !_waterMat) return null;
    depth = depth || 1.5;
    radiusX = radiusX || 8;
    radiusZ = radiusZ || 6;

    // Water surface plane
    var geo = new THREE.PlaneGeometry(radiusX * 2, radiusZ * 2, 4, 4);
    var mesh = new THREE.Mesh(geo, _waterMat.clone());
    var surfaceY = (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight)
      ? VoxelWorld.getTerrainHeight(cx, cz) - 0.3 : 2;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, surfaceY, cz);
    _scene.add(mesh);

    // Riverbed (dark bottom)
    var bedGeo = new THREE.PlaneGeometry(radiusX * 2 - 1, radiusZ * 2 - 1);
    var bedMat = new THREE.MeshLambertMaterial({ color: 0x2a2210, side: THREE.DoubleSide });
    var bed = new THREE.Mesh(bedGeo, bedMat);
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(cx, surfaceY - depth, cz);
    _scene.add(bed);

    var body = {
      cx: cx, cz: cz, rx: radiusX, rz: radiusZ,
      surfaceY: surfaceY, depth: depth,
      mesh: mesh, bed: bed, time: 0
    };
    _waterBodies.push(body);

    // Spawn fish in water body
    var fishCount = Math.max(2, Math.floor(radiusX * radiusZ / 12));
    for (var i = 0; i < fishCount; i++) {
      spawnFish(body);
    }

    return body;
  }

  function spawnFish(waterBody) {
    if (!_scene || !_fishGeo) return;
    var mesh;
    if (_fishPool.length > 0) {
      mesh = _fishPool.pop();
      mesh.visible = true;
    } else {
      mesh = new THREE.Mesh(_fishGeo, _fishMat.clone());
    }
    var angle = Math.random() * Math.PI * 2;
    var rx = (Math.random() * 0.7) * waterBody.rx;
    var rz = (Math.random() * 0.7) * waterBody.rz;
    mesh.position.set(
      waterBody.cx + Math.cos(angle) * rx,
      waterBody.surfaceY - 0.3 - Math.random() * (waterBody.depth * 0.6),
      waterBody.cz + Math.sin(angle) * rz
    );
    mesh.rotation.y = angle;
    _scene.add(mesh);
    _fish.push({
      mesh: mesh, waterBody: waterBody,
      angle: angle, speed: 0.5 + Math.random() * 1.5,
      radius: Math.sqrt(rx * rx + rz * rz),
      alive: true, caught: false
    });
  }

  function updateWater(delta) {
    // Animate water surfaces (gentle wave via vertex displacement)
    for (var wi = 0; wi < _waterBodies.length; wi++) {
      var wb = _waterBodies[wi];
      wb.time += delta;
      // Simple wave: oscillate Y position
      wb.mesh.position.y = wb.surfaceY + Math.sin(wb.time * 1.5) * 0.05;
      // Update opacity for "reflection" shimmer
      if (wb.mesh.material) {
        wb.mesh.material.opacity = 0.50 + Math.sin(wb.time * 2.5) * 0.08;
      }
    }
    // Animate fish
    for (var fi = _fish.length - 1; fi >= 0; fi--) {
      var f = _fish[fi];
      if (!f.alive || f.caught) continue;
      f.angle += f.speed * delta * 0.3;
      var wb2 = f.waterBody;
      var fr = f.radius * 0.8;
      f.mesh.position.x = wb2.cx + Math.cos(f.angle) * fr;
      f.mesh.position.z = wb2.cz + Math.sin(f.angle) * fr;
      f.mesh.rotation.y = f.angle + Math.PI / 2;
      // Subtle bob
      f.mesh.position.y += Math.sin(f.angle * 3) * 0.01;
    }
  }

  function checkInWater(px, pz) {
    for (var i = 0; i < _waterBodies.length; i++) {
      var wb = _waterBodies[i];
      var dx = (px - wb.cx) / wb.rx;
      var dz = (pz - wb.cz) / wb.rz;
      if (dx * dx + dz * dz <= 1) {
        return { inWater: true, surfaceY: wb.surfaceY, depth: wb.depth, body: wb };
      }
    }
    return { inWater: false };
  }

  function tryFish(px, pz) {
    // Try to catch a fish near the player
    for (var i = 0; i < _fish.length; i++) {
      var f = _fish[i];
      if (!f.alive || f.caught) continue;
      var dx = f.mesh.position.x - px;
      var dz = f.mesh.position.z - pz;
      if (Math.sqrt(dx * dx + dz * dz) < 3) {
        f.caught = true;
        f.alive = false;
        if (_scene) _scene.remove(f.mesh);
        f.mesh.visible = false;
        _fishPool.push(f.mesh);
        // Respawn after 30s
        var wb = f.waterBody;
        _fish.splice(i, 1);
        setTimeout(function() { spawnFish(wb); }, 30000);
        return { caught: true, resource: 'FISH', foodValue: 25, materialValue: 5 };
      }
    }
    return { caught: false };
  }

  function getFish() { return _fish; }
  function getWaterBodies() { return _waterBodies; }

  function clearWater() {
    for (var i = 0; i < _waterBodies.length; i++) {
      if (_scene) {
        _scene.remove(_waterBodies[i].mesh);
        _scene.remove(_waterBodies[i].bed);
      }
      _waterBodies[i].mesh.geometry.dispose();
      _waterBodies[i].mesh.material.dispose();
      _waterBodies[i].bed.geometry.dispose();
      _waterBodies[i].bed.material.dispose();
    }
    _waterBodies.length = 0;
    for (var j = 0; j < _fish.length; j++) {
      if (_scene) _scene.remove(_fish[j].mesh);
    }
    _fish.length = 0;
    _fishPool.length = 0;
  }

  // Patch into WorldFeatures
  if (typeof WorldFeatures !== 'undefined') {
    var origInit = WorldFeatures.init;
    WorldFeatures.init = function(scene, THREE_ref) {
      origInit(scene, THREE_ref);
      initWaterSystem(scene);
    };
    var origClear = WorldFeatures.clear;
    WorldFeatures.clear = function() {
      origClear();
      clearWater();
    };
    var origUpdate = WorldFeatures.update;
    WorldFeatures.update = function(delta, px, py, pz) {
      var result = origUpdate(delta, px, py, pz);
      updateWater(delta);
      return result;
    };
    WorldFeatures.spawnWaterBody = spawnWaterBody;
    WorldFeatures.getWaterBodies = getWaterBodies;
    WorldFeatures.checkInWater = checkInWater;
    WorldFeatures.updateWater = updateWater;
    WorldFeatures.tryFish = tryFish;
    WorldFeatures.getFish = getFish;
  }
})();
