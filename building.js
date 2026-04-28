/* ───────────────────────────────────────────────────────────────────────
   BUILDING SYSTEM — block placement, structure templates, build queue
   ─────────────────────────────────────────────────────────────────────── */
const Building = (function () {
  'use strict';

  const B = (typeof window.VoxelWorld !== 'undefined' && window.VoxelWorld.BLOCK) ? window.VoxelWorld.BLOCK : {};

  /* ── Structure Templates ─────────────────────────────────────────── */
  const TEMPLATES = {
    barracks: {
      name: 'Barracks',
      cost: { wood: 40, metal: 10 },
      size: { x: 6, y: 4, z: 8 },
      npcCapacity: 8,
      generate(ox, oy, oz) {
        const blocks = [];
        for (let x = 0; x < 6; x++)
          for (let z = 0; z < 8; z++) {
            blocks.push({ x: ox + x, y: oy, z: oz + z, t: B.CONCRETE }); // floor
            blocks.push({ x: ox + x, y: oy + 4, z: oz + z, t: B.WOOD }); // roof
          }
        // Walls
        for (let y = 1; y <= 3; y++) {
          for (let x = 0; x < 6; x++) {
            blocks.push({ x: ox + x, y: oy + y, z: oz, t: B.BRICK });
            blocks.push({ x: ox + x, y: oy + y, z: oz + 7, t: B.BRICK });
          }
          for (let z = 1; z < 7; z++) {
            blocks.push({ x: ox, y: oy + y, z: oz + z, t: B.BRICK });
            blocks.push({ x: ox + 5, y: oy + y, z: oz + z, t: B.BRICK });
          }
        }
        // Door
        blocks.push({ x: ox + 2, y: oy + 1, z: oz, t: B.AIR });
        blocks.push({ x: ox + 2, y: oy + 2, z: oz, t: B.AIR });
        blocks.push({ x: ox + 3, y: oy + 1, z: oz, t: B.AIR });
        blocks.push({ x: ox + 3, y: oy + 2, z: oz, t: B.AIR });
        // Windows
        blocks.push({ x: ox + 1, y: oy + 2, z: oz, t: B.GLASS });
        blocks.push({ x: ox + 4, y: oy + 2, z: oz, t: B.GLASS });
        return blocks;
      }
    },

    factory: {
      name: 'Factory',
      cost: { metal: 60, electronics: 20, wood: 20 },
      size: { x: 8, y: 5, z: 8 },
      autoType: 'craft',
      generate(ox, oy, oz) {
        const blocks = [];
        for (let x = 0; x < 8; x++)
          for (let z = 0; z < 8; z++) {
            blocks.push({ x: ox + x, y: oy, z: oz + z, t: B.CONCRETE });
            blocks.push({ x: ox + x, y: oy + 5, z: oz + z, t: B.METAL });
          }
        for (let y = 1; y <= 4; y++) {
          for (let x = 0; x < 8; x++) {
            blocks.push({ x: ox + x, y: oy + y, z: oz, t: B.METAL });
            blocks.push({ x: ox + x, y: oy + y, z: oz + 7, t: B.METAL });
          }
          for (let z = 1; z < 7; z++) {
            blocks.push({ x: ox, y: oy + y, z: oz + z, t: B.METAL });
            blocks.push({ x: ox + 7, y: oy + y, z: oz + z, t: B.METAL });
          }
        }
        // Large door
        for (let dx = 2; dx <= 5; dx++)
          for (let dy = 1; dy <= 3; dy++)
            blocks.push({ x: ox + dx, y: oy + dy, z: oz, t: B.AIR });
        return blocks;
      }
    },

    turret: {
      name: 'Defense Turret',
      cost: { metal: 30, electronics: 15 },
      size: { x: 3, y: 4, z: 3 },
      defense: true,
      generate(ox, oy, oz) {
        const blocks = [];
        // Base platform
        for (let x = 0; x < 3; x++)
          for (let z = 0; z < 3; z++)
            blocks.push({ x: ox + x, y: oy, z: oz + z, t: B.REINFORCED });
        // Pillar
        for (let y = 1; y <= 3; y++)
          blocks.push({ x: ox + 1, y: oy + y, z: oz + 1, t: B.METAL });
        // Top platform
        for (let x = 0; x < 3; x++)
          for (let z = 0; z < 3; z++)
            blocks.push({ x: ox + x, y: oy + 3, z: oz + z, t: B.REINFORCED });
        // Walls on top
        blocks.push({ x: ox, y: oy + 4, z: oz, t: B.REINFORCED });
        blocks.push({ x: ox + 2, y: oy + 4, z: oz, t: B.REINFORCED });
        blocks.push({ x: ox, y: oy + 4, z: oz + 2, t: B.REINFORCED });
        blocks.push({ x: ox + 2, y: oy + 4, z: oz + 2, t: B.REINFORCED });
        return blocks;
      }
    },

    droneHangar: {
      name: 'Drone Hangar',
      cost: { metal: 50, electronics: 40, wood: 10 },
      size: { x: 6, y: 4, z: 6 },
      droneCapacity: 4,
      generate(ox, oy, oz) {
        const blocks = [];
        for (let x = 0; x < 6; x++)
          for (let z = 0; z < 6; z++) {
            blocks.push({ x: ox + x, y: oy, z: oz + z, t: B.CONCRETE });
            blocks.push({ x: ox + x, y: oy + 4, z: oz + z, t: B.METAL });
          }
        for (let y = 1; y <= 3; y++) {
          for (let x = 0; x < 6; x++) {
            blocks.push({ x: ox + x, y: oy + y, z: oz, t: B.METAL });
            blocks.push({ x: ox + x, y: oy + y, z: oz + 5, t: B.METAL });
          }
          for (let z = 1; z < 5; z++) {
            blocks.push({ x: ox, y: oy + y, z: oz + z, t: B.METAL });
            blocks.push({ x: ox + 5, y: oy + y, z: oz + z, t: B.METAL });
          }
        }
        for (let dx = 1; dx <= 4; dx++)
          for (let dy = 1; dy <= 3; dy++)
            blocks.push({ x: ox + dx, y: oy + dy, z: oz, t: B.AIR });
        return blocks;
      }
    },

    commandCenter: {
      name: 'Command Center',
      cost: { metal: 80, electronics: 60, stone: 40 },
      size: { x: 10, y: 6, z: 10 },
      unlocks: ['strategic_view', 'missions'],
      generate(ox, oy, oz) {
        const blocks = [];
        for (let x = 0; x < 10; x++)
          for (let z = 0; z < 10; z++) {
            blocks.push({ x: ox + x, y: oy, z: oz + z, t: B.REINFORCED });
            blocks.push({ x: ox + x, y: oy + 6, z: oz + z, t: B.REINFORCED });
          }
        for (let y = 1; y <= 5; y++) {
          for (let x = 0; x < 10; x++) {
            blocks.push({ x: ox + x, y: oy + y, z: oz, t: B.CONCRETE });
            blocks.push({ x: ox + x, y: oy + y, z: oz + 9, t: B.CONCRETE });
          }
          for (let z = 1; z < 9; z++) {
            blocks.push({ x: ox, y: oy + y, z: oz + z, t: B.CONCRETE });
            blocks.push({ x: ox + 9, y: oy + y, z: oz + z, t: B.CONCRETE });
          }
        }
        // Entrance
        for (let dx = 3; dx <= 6; dx++)
          for (let dy = 1; dy <= 3; dy++)
            blocks.push({ x: ox + dx, y: oy + dy, z: oz, t: B.AIR });
        // Windows (upper floor)
        for (let x = 2; x <= 7; x += 2)
          blocks.push({ x: ox + x, y: oy + 4, z: oz, t: B.GLASS });
        return blocks;
      }
    },

    wall: {
      name: 'Wall Section',
      cost: { stone: 10 },
      size: { x: 5, y: 3, z: 1 },
      generate(ox, oy, oz) {
        const blocks = [];
        for (let x = 0; x < 5; x++)
          for (let y = 0; y < 3; y++)
            blocks.push({ x: ox + x, y: oy + y, z: oz, t: B.CONCRETE });
        return blocks;
      }
    },

    dugout: {
      name: 'Foxhole / Dugout',
      cost: { dirt: 20, wood: 15 },
      size: { x: 4, y: 3, z: 4 },
      generate(ox, oy, oz) {
        const blocks = [];
        // Carve out 2-deep pit, 3x3 inside footprint
        for (let x = 0; x < 3; x++)
          for (let z = 0; z < 3; z++) {
            blocks.push({ x: ox + x + 1, y: oy - 1, z: oz + z + 1, t: B.AIR });
            blocks.push({ x: ox + x + 1, y: oy - 2, z: oz + z + 1, t: B.AIR });
          }
        // Sandbag rim around pit (1 block tall)
        for (let x = 0; x < 4; x++) {
          blocks.push({ x: ox + x, y: oy, z: oz, t: B.SAND });
          blocks.push({ x: ox + x, y: oy, z: oz + 3, t: B.SAND });
        }
        for (let z = 1; z < 3; z++) {
          blocks.push({ x: ox, y: oy, z: oz + z, t: B.SAND });
          blocks.push({ x: ox + 3, y: oy, z: oz + z, t: B.SAND });
        }
        // Wooden plank roof partial (front-facing firing slit open)
        for (let x = 0; x < 4; x++) {
          blocks.push({ x: ox + x, y: oy + 1, z: oz + 3, t: B.WOOD });
        }
        // Leave firing slit at front (oz=0) — no roof cover there
        return blocks;
      }
    },
  };

  /* ── Placed structures tracking ──────────────────────────────────── */
  const structures = [];
  let _scene = null;
  let _ghostMesh = null;
  let _selectedTemplate = null;
  let _ghostPos = { x: 0, y: 0, z: 0 };

  /* ── Build mode state ────────────────────────────────────────────── */
  let buildMode = false;
  let selectedBlockType = B.CONCRETE;

  /* ── Init ────────────────────────────────────────────────────────── */
  function init(scene) {
    _scene = scene;
  }

  /* ── Free-form block placement ───────────────────────────────────── */
  function placeBlock(wx, wy, wz, type) {
    if (wy < 0 || wy >= window.VoxelWorld.CHUNK_HEIGHT) return false;
    window.VoxelWorld.setBlock(wx, wy, wz, type || selectedBlockType);
    return true;
  }

  function removeBlock(wx, wy, wz) {
    const current = window.VoxelWorld.getBlock(wx, wy, wz);
    if (current === B.AIR) return null;
    window.VoxelWorld.setBlock(wx, wy, wz, B.AIR);
    return current; // return block type for resource recovery
  }

  /* ── Template placement ──────────────────────────────────────────── */
  function selectTemplate(templateName) {
    _selectedTemplate = TEMPLATES[templateName] || null;
    if (_selectedTemplate) {
      createGhost();
    }
    return _selectedTemplate;
  }

  function createGhost() {
    if (_ghostMesh) {
      _scene.remove(_ghostMesh);
      _ghostMesh.geometry.dispose();
      _ghostMesh.material.dispose();
    }
    if (!_selectedTemplate) return;

    const s = _selectedTemplate.size;
    const geo = new THREE.BoxGeometry(s.x, s.y, s.z);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00FF88,
      transparent: true,
      opacity: 0.3,
      wireframe: false,
    });
    _ghostMesh = new THREE.Mesh(geo, mat);
    _ghostMesh.position.set(0, 0, 0);
    _scene.add(_ghostMesh);
  }

  function updateGhost(wx, wy, wz) {
    if (!_ghostMesh || !_selectedTemplate) return;
    const s = _selectedTemplate.size;
    _ghostPos = { x: wx, y: wy, z: wz };
    _ghostMesh.position.set(
      wx + s.x / 2,
      wy + s.y / 2,
      wz + s.z / 2
    );
  }

  function canPlaceTemplate(wx, wy, wz) {
    if (!_selectedTemplate) return false;
    // Check if area is clear
    const s = _selectedTemplate.size;
    for (let x = 0; x < s.x; x++)
      for (let y = 0; y < s.y; y++)
        for (let z = 0; z < s.z; z++) {
          const b = window.VoxelWorld.getBlock(wx + x, wy + y, wz + z);
          if (b !== B.AIR && b !== B.WATER && b !== B.GRASS) return false;
        }
    // Check foundation (ground underneath)
    for (let x = 0; x < s.x; x++)
      for (let z = 0; z < s.z; z++) {
        if (!window.VoxelWorld.isSolid(wx + x, wy - 1, wz + z)) return false;
      }
    return true;
  }

  function placeTemplate(wx, wy, wz) {
    if (!_selectedTemplate) return false;
    if (!canPlaceTemplate(wx, wy, wz)) return false;

    // Place blocks
    const blockList = _selectedTemplate.generate(wx, wy, wz);
    for (const b of blockList) {
      window.VoxelWorld.setBlock(b.x, b.y, b.z, b.t);
    }

    // Track structure
    structures.push({
      template: _selectedTemplate.name,
      pos: { x: wx, y: wy, z: wz },
      size: { ..._selectedTemplate.size },
      npcCapacity: _selectedTemplate.npcCapacity || 0,
      droneCapacity: _selectedTemplate.droneCapacity || 0,
      autoType: _selectedTemplate.autoType || null,
      defense: _selectedTemplate.defense || false,
      unlocks: _selectedTemplate.unlocks || [],
      health: 100,
    });

    // Cleanup ghost
    if (_ghostMesh) {
      _scene.remove(_ghostMesh);
      _ghostMesh.geometry.dispose();
      _ghostMesh.material.dispose();
      _ghostMesh = null;
    }
    _selectedTemplate = null;

    return true;
  }

  function cancelTemplate() {
    if (_ghostMesh) {
      _scene.remove(_ghostMesh);
      _ghostMesh.geometry.dispose();
      _ghostMesh.material.dispose();
      _ghostMesh = null;
    }
    _selectedTemplate = null;
  }

  /* ── Queries ─────────────────────────────────────────────────────── */
  function getStructures() { return structures; }
  function getTemplateNames() { return Object.keys(TEMPLATES); }
  function getTemplate(name) { return TEMPLATES[name]; }
  function getSelectedTemplate() { return _selectedTemplate; }
  function isBuildMode() { return buildMode; }
  function setBuildMode(on) { buildMode = on; }
  function setBlockType(t) { selectedBlockType = t; }
  function getBlockType() { return selectedBlockType; }

  function getTotalNPCCapacity() {
    return structures.reduce((s, b) => s + (b.npcCapacity || 0), 0);
  }

  function getTotalDroneCapacity() {
    return structures.reduce((s, b) => s + (b.droneCapacity || 0), 0);
  }

  function hasUnlock(name) {
    return structures.some(s => s.unlocks && s.unlocks.includes(name));
  }

  function clear() {
    if (_ghostMesh) {
      _scene && _scene.remove(_ghostMesh);
      _ghostMesh.geometry.dispose();
      _ghostMesh.material.dispose();
      _ghostMesh = null;
    }
    _selectedTemplate = null;
    buildMode = false;
    structures.length = 0;
  }

  /* ── Auto-Build: AI selects best location near player and builds ── */
  function autoBuild(templateName, px, py, pz) {
    var tmpl = TEMPLATES[templateName];
    if (!tmpl) return { ok: false, reason: 'unknown template' };
    var sz = tmpl.size;
    // Search spiral pattern around player for valid placement
    var bestX = null, bestZ = null, bestY = null;
    var getH = (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight)
      ? VoxelWorld.getTerrainHeight : function() { return 2; };
    var isSolid = (typeof VoxelWorld !== 'undefined' && VoxelWorld.isSolid)
      ? VoxelWorld.isSolid : function() { return false; };
    for (var ring = 3; ring < 25; ring += 2) {
      for (var trial = 0; trial < 8; trial++) {
        var angle = trial * Math.PI * 0.25 + ring * 0.3;
        var tx = Math.round(px + Math.cos(angle) * ring);
        var tz = Math.round(pz + Math.sin(angle) * ring);
        var ty = Math.floor(getH(tx, tz));
        // Check flatness: all corners within 1 block height
        var flat = true;
        var cornerH = [
          getH(tx, tz), getH(tx + sz.x, tz),
          getH(tx, tz + sz.z), getH(tx + sz.x, tz + sz.z)
        ];
        var minH = cornerH[0], maxH = cornerH[0];
        for (var ci = 1; ci < 4; ci++) {
          if (cornerH[ci] < minH) minH = cornerH[ci];
          if (cornerH[ci] > maxH) maxH = cornerH[ci];
        }
        if (maxH - minH > 2) continue;
        // Check no solid blocks in build area
        var blocked = false;
        for (var bx = 0; bx < sz.x && !blocked; bx++) {
          for (var bz = 0; bz < sz.z && !blocked; bz++) {
            for (var by = 1; by <= sz.y; by++) {
              if (isSolid(tx + bx, ty + by, tz + bz)) { blocked = true; break; }
            }
          }
        }
        if (blocked) continue;
        bestX = tx; bestZ = tz; bestY = ty;
        break;
      }
      if (bestX !== null) break;
    }
    if (bestX === null) return { ok: false, reason: 'no valid location found' };
    // Select template and place
    _selectedTemplate = tmpl;
    var result = placeTemplate(bestX, bestY, bestZ);
    return { ok: result, x: bestX, y: bestY, z: bestZ, template: templateName };
  }

  /* ── Auto-Fortify: builds defenses around a position automatically ── */
  function autoFortify(px, py, pz) {
    var built = [];
    // Build turret nearby
    selectTemplate('turret');
    var t1 = autoBuild('turret', px, py, pz);
    if (t1.ok) built.push(t1);
    // Build wall sections on two sides
    selectTemplate('wall');
    var w1 = autoBuild('wall', px + 8, py, pz);
    if (w1.ok) built.push(w1);
    var w2 = autoBuild('wall', px - 8, py, pz);
    if (w2.ok) built.push(w2);
    cancelTemplate();
    return built;
  }

  return {
    TEMPLATES,
    init,
    clear,
    placeBlock,
    removeBlock,
    selectTemplate,
    updateGhost,
    canPlaceTemplate,
    placeTemplate,
    cancelTemplate,
    getStructures,
    getTemplateNames,
    getTemplate,
    getSelectedTemplate,
    isBuildMode,
    setBuildMode,
    setBlockType,
    getBlockType,
    getTotalNPCCapacity,
    getTotalDroneCapacity,
    hasUnlock,
    autoBuild,
    autoFortify,
  };
})();
