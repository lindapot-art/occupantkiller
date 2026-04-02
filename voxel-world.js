/* ───────────────────────────────────────────────────────────────────────
   VOXEL WORLD ENGINE — chunk-based voxel terrain with instanced rendering
   ─────────────────────────────────────────────────────────────────────── */
const VoxelWorld = (function () {
  'use strict';

  /* ── Block Type Registry ─────────────────────────────────────────── */
  const BLOCK = Object.freeze({
    AIR:         0,
    DIRT:        1,
    GRASS:       2,
    STONE:       3,
    WOOD:        4,
    METAL:       5,
    ELECTRONICS: 6,
    SAND:        7,
    WATER:       8,
    CONCRETE:    9,
    BRICK:       10,
    GLASS:       11,
    FUEL_BARREL: 12,
    CRATE:       13,
    REINFORCED:  14,
    FENCE:       15,
    RUBBLE:      16,
    SANDBAG:     17,
    ASPHALT:     18,
  });

  const BLOCK_COLORS = {
    [BLOCK.DIRT]:        0x8B6914,
    [BLOCK.GRASS]:       0x0057B8, // Ukrainian blue theme
    [BLOCK.STONE]:       0x808080,
    [BLOCK.WOOD]:        0xA0724A,
    [BLOCK.METAL]:       0x909698,
    [BLOCK.ELECTRONICS]: 0x2C6E49,
    [BLOCK.SAND]:        0xD4B896,
    [BLOCK.WATER]:       0x2E86C1,
    [BLOCK.CONCRETE]:    0xA0A0A0,
    [BLOCK.BRICK]:       0xB04030,
    [BLOCK.GLASS]:       0xADD8E6,
    [BLOCK.FUEL_BARREL]: 0xFF6600,
    [BLOCK.CRATE]:       0xC19A6B,
    [BLOCK.REINFORCED]:  0x505860,
    [BLOCK.FENCE]:       0x8B7355,
    [BLOCK.RUBBLE]:      0x7a6a5a,
    [BLOCK.SANDBAG]:     0xC2B280,
    18: 0x333338,  // dark asphalt
  };

  const BLOCK_HARDNESS = {
    [BLOCK.DIRT]:        1,
    [BLOCK.GRASS]:       1,
    [BLOCK.STONE]:       3,
    [BLOCK.WOOD]:        2,
    [BLOCK.METAL]:       4,
    [BLOCK.ELECTRONICS]: 2,
    [BLOCK.SAND]:        0.5,
    [BLOCK.WATER]:       0,
    [BLOCK.CONCRETE]:    4,
    [BLOCK.BRICK]:       3,
    [BLOCK.GLASS]:       0.5,
    [BLOCK.FUEL_BARREL]: 2,
    [BLOCK.CRATE]:       1.5,
    [BLOCK.REINFORCED]:  6,
    [BLOCK.FENCE]:       1,
    [BLOCK.RUBBLE]:      2,
    [BLOCK.SANDBAG]:     1,
    18: 3,  // asphalt road
  };

  const BLOCK_TRANSPARENT = new Set([BLOCK.AIR, BLOCK.WATER, BLOCK.GLASS]);

  /* ── Chunk Constants ─────────────────────────────────────────────── */
  const CHUNK_SIZE   = 16;
  const CHUNK_HEIGHT = 32;
  const BLOCK_SIZE   = 1.0;
  const WORLD_CHUNKS = 8;   // 8×8 chunks = 128×128 block world

  /* ── Chunk Storage ───────────────────────────────────────────────── */
  const chunks = new Map();

  function chunkKey(cx, cz) { return cx + ',' + cz; }

  function getChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (!chunks.has(key)) return null;
    return chunks.get(key);
  }

  function createChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const chunk = { cx, cz, data, dirty: true, mesh: null };
    chunks.set(key, chunk);
    return chunk;
  }

  function blockIndex(lx, ly, lz) {
    return ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
  }

  /* ── World-space ↔ Chunk-space ──────────────────────────────────── */
  function worldToChunk(wx, wz) {
    return {
      cx: Math.floor(wx / CHUNK_SIZE),
      cz: Math.floor(wz / CHUNK_SIZE)
    };
  }

  function worldToLocal(wx, wy, wz) {
    let lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    let lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { lx: Math.floor(lx), ly: Math.floor(wy), lz: Math.floor(lz) };
  }

  /* ── Get / Set Block ─────────────────────────────────────────────── */
  function getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BLOCK.AIR;
    const { cx, cz } = worldToChunk(wx, wz);
    const chunk = getChunk(cx, cz);
    if (!chunk) return BLOCK.AIR;
    const { lx, ly, lz } = worldToLocal(wx, wy, wz);
    return chunk.data[blockIndex(lx, ly, lz)];
  }

  function setBlock(wx, wy, wz, blockType) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return;
    const { cx, cz } = worldToChunk(wx, wz);
    let chunk = getChunk(cx, cz);
    if (!chunk) chunk = createChunk(cx, cz);
    const { lx, ly, lz } = worldToLocal(wx, wy, wz);
    chunk.data[blockIndex(lx, ly, lz)] = blockType;
    chunk.dirty = true;

    // Mark neighboring chunks dirty if on edge
    if (lx === 0) markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) markDirty(cx + 1, cz);
    if (lz === 0) markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) markDirty(cx, cz + 1);
  }

  function markDirty(cx, cz) {
    const c = getChunk(cx, cz);
    if (c) c.dirty = true;
  }

  /* ── Terrain Themes ────────────────────────────────────────────── */
  let _theme = {
    name: 'grassland',
    seed: 0,
    surfaceBlock: BLOCK.GRASS,
    subBlock:     BLOCK.DIRT,
    baseBlock:    BLOCK.STONE,
    fogColor:     0x3a3028,
    bgColor:      0x3a3028,
    heightScale:  1.0,
  };

  const THEMES = {
    grassland: {
      name: 'grassland',
      seed: 0,
      surfaceBlock: BLOCK.GRASS,
      subBlock:     BLOCK.DIRT,
      baseBlock:    BLOCK.STONE,
      fogColor:     0x3a3028,
      bgColor:      0x3a3028,
      heightScale:  1.0,
    },
    urban: {
      name: 'urban',
      seed: 7777,
      surfaceBlock: BLOCK.CONCRETE,
      subBlock:     BLOCK.STONE,
      baseBlock:    BLOCK.STONE,
      fogColor:     0x2a2a2a,
      bgColor:      0x2a2a2a,
      heightScale:  0.6,
    },
    desert: {
      name: 'desert',
      seed: 15555,
      surfaceBlock: BLOCK.SAND,
      subBlock:     BLOCK.SAND,
      baseBlock:    BLOCK.STONE,
      fogColor:     0x5a4a30,
      bgColor:      0x5a4a30,
      heightScale:  1.3,
    },
  };

  function setTheme(themeName) {
    _theme = THEMES[themeName] || THEMES.grassland;
  }

  function getTheme() { return _theme; }

  /* ── Terrain Generation ──────────────────────────────────────────── */
  // Simple heightmap with value noise
  function seededRandom(x, z) {
    let n = Math.sin((x + _theme.seed) * 12.9898 + (z + _theme.seed) * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function smoothNoise(x, z, scale) {
    const sx = x / scale, sz = z / scale;
    const ix = Math.floor(sx), iz = Math.floor(sz);
    const fx = sx - ix, fz = sz - iz;
    const a = seededRandom(ix, iz);
    const b = seededRandom(ix + 1, iz);
    const c = seededRandom(ix, iz + 1);
    const d = seededRandom(ix + 1, iz + 1);
    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  function getHeight(wx, wz) {
    const hs = _theme.heightScale;
    const n1 = smoothNoise(wx, wz, 32) * 8 * hs;
    const n2 = smoothNoise(wx + 100, wz + 100, 16) * 4 * hs;
    const n3 = smoothNoise(wx + 200, wz + 200, 8) * 2 * hs;
    return Math.floor(2 + n1 + n2 + n3);
  }

  function generateChunkTerrain(chunk) {
    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = ox + lx;
        const wz = oz + lz;
        const h = Math.min(getHeight(wx, wz), CHUNK_HEIGHT - 1);

        for (let ly = 0; ly <= h; ly++) {
          let type;
          if (ly === h) {
            type = _theme.surfaceBlock;
          } else if (ly >= h - 3) {
            type = _theme.subBlock;
          } else {
            type = BLOCK.STONE;
          }
          chunk.data[blockIndex(lx, ly, lz)] = type;
        }
      }
    }
    chunk.dirty = true;
  }

  /* ── Mesh Building (greedy-ish per-block face culling) ───────────── */
  const _faceNormals = [
    { dir: [ 1,  0,  0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] }, // +X
    { dir: [-1,  0,  0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] }, // -X
    { dir: [ 0,  1,  0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] }, // +Y
    { dir: [ 0, -1,  0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] }, // -Y
    { dir: [ 0,  0,  1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] }, // +Z
    { dir: [ 0,  0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }, // -Z
  ];

  function isTransparent(wx, wy, wz) {
    return BLOCK_TRANSPARENT.has(getBlock(wx, wy, wz));
  }

  function buildChunkMesh(chunk, scene) {
    if (chunk.mesh) {
      scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }

    const positions = [];
    const normals   = [];
    const colors    = [];
    const indices   = [];
    let vertCount   = 0;

    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const bt = chunk.data[blockIndex(lx, ly, lz)];
          if (bt === BLOCK.AIR) continue;

          const wx = ox + lx;
          const wz = oz + lz;
          const col = new THREE.Color(BLOCK_COLORS[bt] || 0xFF00FF);

          for (const face of _faceNormals) {
            const nx = wx + face.dir[0];
            const ny = ly + face.dir[1];
            const nz = wz + face.dir[2];

            if (!isTransparent(nx, ny, nz)) continue;

            for (const c of face.corners) {
              positions.push(
                (lx + c[0]) * BLOCK_SIZE,
                (ly + c[1]) * BLOCK_SIZE,
                (lz + c[2]) * BLOCK_SIZE
              );
              normals.push(face.dir[0], face.dir[1], face.dir[2]);
              colors.push(col.r, col.g, col.b);
            }
            indices.push(
              vertCount, vertCount + 1, vertCount + 2,
              vertCount, vertCount + 2, vertCount + 3
            );
            vertCount += 4;
          }
        }
      }
    }

    if (vertCount === 0) { chunk.dirty = false; return; }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ox * BLOCK_SIZE, 0, oz * BLOCK_SIZE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isVoxelTerrain = true;

    scene.add(mesh);
    chunk.mesh = mesh;
    chunk.dirty = false;
  }

  /* ── World Init & Update ─────────────────────────────────────────── */
  let _scene = null;
  const HALF = Math.floor(WORLD_CHUNKS / 2);

  function init(scene) {
    _scene = scene;
    chunks.clear();

    // Generate terrain chunks
    for (let cx = -HALF; cx < HALF; cx++) {
      for (let cz = -HALF; cz < HALF; cz++) {
        const chunk = createChunk(cx, cz);
        generateChunkTerrain(chunk);
      }
    }

    // Build all meshes
    rebuildAll();
  }

  function regenerate() {
    // Remove all existing chunk meshes
    for (const chunk of chunks.values()) {
      if (chunk.mesh) {
        _scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh.material.dispose();
        chunk.mesh = null;
      }
    }
    chunks.clear();

    // Regenerate with current theme
    for (let cx = -HALF; cx < HALF; cx++) {
      for (let cz = -HALF; cz < HALF; cz++) {
        const chunk = createChunk(cx, cz);
        generateChunkTerrain(chunk);
      }
    }
    rebuildAll();
  }

  function rebuildAll() {
    for (const chunk of chunks.values()) {
      chunk.dirty = true;
    }
    updateDirtyChunks();
  }

  let _rebuildBudget = 4; // max chunks to rebuild per frame
  function updateDirtyChunks() {
    let count = 0;
    for (const chunk of chunks.values()) {
      if (chunk.dirty) {
        buildChunkMesh(chunk, _scene);
        count++;
        if (count >= _rebuildBudget) break;
      }
    }
  }

  /* ── Raycast Helpers for Block Interaction ────────────────────────── */
  function raycastBlock(camera, maxDist) {
    maxDist = maxDist || 8;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pos = camera.position.clone();

    const step = 0.1;
    for (let d = 0; d < maxDist; d += step) {
      const px = Math.floor(pos.x + dir.x * d);
      const py = Math.floor(pos.y + dir.y * d);
      const pz = Math.floor(pos.z + dir.z * d);
      const block = getBlock(px, py, pz);
      if (block !== BLOCK.AIR && block !== BLOCK.WATER) {
        // Previous position for placement
        const prevD = d - step;
        const prevX = Math.floor(pos.x + dir.x * prevD);
        const prevY = Math.floor(pos.y + dir.y * prevD);
        const prevZ = Math.floor(pos.z + dir.z * prevD);
        return {
          hit: { x: px, y: py, z: pz, block },
          place: { x: prevX, y: prevY, z: prevZ }
        };
      }
    }
    return null;
  }

  /* ── Collision helpers ───────────────────────────────────────────── */
  function isSolid(wx, wy, wz) {
    const b = getBlock(Math.floor(wx), Math.floor(wy), Math.floor(wz));
    return b !== BLOCK.AIR && b !== BLOCK.WATER;
  }

  function getTerrainHeight(wx, wz) {
    const ix = Math.floor(wx), iz = Math.floor(wz);
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (getBlock(ix, y, iz) !== BLOCK.AIR) return y + 1;
    }
    return 0;
  }

  /* ── Cleanup ─────────────────────────────────────────────────────── */
  function dispose() {
    for (const chunk of chunks.values()) {
      if (chunk.mesh) {
        _scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh.material.dispose();
      }
    }
    chunks.clear();
  }

  /* ── Scatter resources on terrain ────────────────────────────────── */
  function scatterResources(type, density) {
    const total = Math.floor(WORLD_CHUNKS * CHUNK_SIZE * WORLD_CHUNKS * CHUNK_SIZE * density);
    const minX = -HALF * CHUNK_SIZE, maxX = HALF * CHUNK_SIZE;
    const minZ = -HALF * CHUNK_SIZE, maxZ = HALF * CHUNK_SIZE;
    let placed = 0;
    for (let i = 0; i < total * 3 && placed < total; i++) {
      const wx = Math.floor(minX + Math.random() * (maxX - minX));
      const wz = Math.floor(minZ + Math.random() * (maxZ - minZ));
      const h = getTerrainHeight(wx, wz);
      if (h > 1 && h < CHUNK_HEIGHT - 2) {
        setBlock(wx, h, wz, type);
        if (type === BLOCK.WOOD) {
          // Place a small tree (trunk + canopy)
          for (let ty = 1; ty <= 4; ty++) setBlock(wx, h + ty, wz, BLOCK.WOOD);
          for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++)
              for (let dy = 3; dy <= 5; dy++)
                if (!(dx === 0 && dz === 0 && dy <= 4))
                  setBlock(wx + dx, h + dy, wz + dz, BLOCK.GRASS);
          placed++;
        } else {
          placed++;
        }
      }
    }
  }

  /* ── Level Definitions ────────────────────────────────────────────── */
  const LEVELS = [
    { id: 'HOSTOMEL',  name: 'Hostomel Airport',    desc: 'Stop the airborne assault',  theme: 'grassland', wavesPerLevel: 7, difficulty: 1.0, fogColor: 0x4a5a3a },
    { id: 'AVDIIVKA',  name: 'Avdiivka Industrial Zone', desc: 'Hold the coking plant',  theme: 'urban',     wavesPerLevel: 7, difficulty: 1.3, fogColor: 0x3a3028 },
    { id: 'BAKHMUT',   name: 'Bakhmut Ruins',        desc: 'Defend the city',             theme: 'urban',     wavesPerLevel: 7, difficulty: 1.6, fogColor: 0x2a2a2a },
    { id: 'KHERSON',   name: 'Kherson Bridgehead',   desc: 'Cross the Dnipro',            theme: 'grassland', wavesPerLevel: 7, difficulty: 1.9, fogColor: 0x4a5a3a },
  ];

  const PROC_CITIES = ['Mariupol','Severodonetsk','Lysychansk','Bucha','Irpin','Izium','Kupyansk','Robotyne','Vuhledar'];

  function getLevelDef(index) {
    if (index >= 0 && index < LEVELS.length) return LEVELS[index];
    const cityIdx = (index - LEVELS.length) % PROC_CITIES.length;
    const themeNames = Object.keys(THEMES);
    const theme = themeNames[Math.floor(seededRandom(index * 7, index * 13) * themeNames.length)];
    return {
      id: 'PROC_' + index,
      name: PROC_CITIES[cityIdx],
      desc: 'Liberate ' + PROC_CITIES[cityIdx],
      theme: theme,
      wavesPerLevel: 7,
      difficulty: 1.0 + index * 0.35,
      fogColor: THEMES[theme].fogColor,
    };
  }

  /* ── Terrain Feature Generators ─────────────────────────────────── */
  const worldMin = -HALF * CHUNK_SIZE;
  const worldMax =  HALF * CHUNK_SIZE;

  function randInWorld() {
    return Math.floor(worldMin + Math.random() * (worldMax - worldMin));
  }

  function generateTrenches() {
    const segments = 5 + Math.floor(Math.random() * 4);
    let cx = randInWorld() * 0.5;
    let cz = randInWorld() * 0.5;
    const trenchWidth = 1 + Math.floor(Math.random() * 2);
    const trenchDepth = 2 + Math.floor(Math.random() * 2);

    for (let seg = 0; seg < segments; seg++) {
      const len = 8 + Math.floor(Math.random() * 12);
      const horizontal = seg % 2 === 0;

      for (let i = 0; i < len; i++) {
        const wx = Math.floor(horizontal ? cx + i : cx);
        const wz = Math.floor(horizontal ? cz : cz + i);

        for (let tw = 0; tw < trenchWidth; tw++) {
          const bx = horizontal ? wx : wx + tw;
          const bz = horizontal ? wz + tw : wz;
          const surfH = getTerrainHeight(bx, bz);

          // Dig the trench
          for (let d = 0; d < trenchDepth; d++) {
            setBlock(bx, surfH - 1 - d, bz, BLOCK.AIR);
          }

          // Reinforced walls on sides
          if (tw === 0 || tw === trenchWidth - 1) {
            for (let d = 0; d < trenchDepth; d++) {
              const wallOff = tw === 0 ? -1 : 1;
              const wallX = horizontal ? bx : bx + wallOff;
              const wallZ = horizontal ? bz + wallOff : bz;
              if (getBlock(wallX, surfH - 1 - d, wallZ) !== BLOCK.AIR) {
                setBlock(wallX, surfH - 1 - d, wallZ, BLOCK.SANDBAG);
              }
            }
          }
        }
      }
      // Zigzag: advance perpendicular
      if (horizontal) { cz += (Math.random() > 0.5 ? 1 : -1) * (3 + Math.floor(Math.random() * 4)); cx += len; }
      else            { cx += (Math.random() > 0.5 ? 1 : -1) * (3 + Math.floor(Math.random() * 4)); cz += len; }
    }
  }

  function generateCraters(count) {
    for (let c = 0; c < count; c++) {
      const cx = randInWorld();
      const cz = randInWorld();
      const radius = 2 + Math.floor(Math.random() * 4);
      const depth = 1 + Math.floor(Math.random() * 3);
      const surfH = getTerrainHeight(cx, cz);

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= radius) {
            const localDepth = Math.floor(depth * (1 - dist / radius));
            for (let d = 0; d <= localDepth; d++) {
              setBlock(cx + dx, surfH - d, cz + dz, BLOCK.AIR);
            }
            // Rim: pile rubble at edge
            if (dist > radius - 1.5 && dist <= radius) {
              setBlock(cx + dx, surfH + 1, cz + dz, BLOCK.RUBBLE);
            }
          }
        }
      }
    }
  }

  function generateRuins(count) {
    for (let r = 0; r < count; r++) {
      const ox = randInWorld();
      const oz = randInWorld();
      const w = 4 + Math.floor(Math.random() * 6);
      const d = 4 + Math.floor(Math.random() * 6);
      const h = 3 + Math.floor(Math.random() * 5);
      const surfH = getTerrainHeight(ox, oz);
      const wallBlock = Math.random() > 0.5 ? BLOCK.BRICK : BLOCK.CONCRETE;

      // Four walls with random gaps
      for (let y = 0; y < h; y++) {
        for (let i = 0; i < w; i++) {
          if (Math.random() > 0.25) setBlock(ox + i, surfH + y, oz, wallBlock);
          if (Math.random() > 0.25) setBlock(ox + i, surfH + y, oz + d - 1, wallBlock);
        }
        for (let j = 0; j < d; j++) {
          if (Math.random() > 0.25) setBlock(ox, surfH + y, oz + j, wallBlock);
          if (Math.random() > 0.25) setBlock(ox + w - 1, surfH + y, oz + j, wallBlock);
        }
      }

      // Rubble inside
      const rubbleCount = Math.floor(w * d * 0.2);
      for (let rb = 0; rb < rubbleCount; rb++) {
        const rx = ox + 1 + Math.floor(Math.random() * (w - 2));
        const rz = oz + 1 + Math.floor(Math.random() * (d - 2));
        setBlock(rx, surfH, rz, BLOCK.RUBBLE);
      }
    }
  }

  function generateDugouts(count) {
    for (let dg = 0; dg < count; dg++) {
      const ox = randInWorld();
      const oz = randInWorld();
      const rw = 3 + Math.floor(Math.random() * 3);
      const rd = 3 + Math.floor(Math.random() * 3);
      const surfH = getTerrainHeight(ox, oz);
      const roomY = Math.max(1, surfH - 3);

      // Hollow out room underground
      for (let dx = 0; dx < rw; dx++) {
        for (let dz = 0; dz < rd; dz++) {
          for (let dy = 0; dy < 3; dy++) {
            setBlock(ox + dx, roomY + dy, oz + dz, BLOCK.AIR);
          }
        }
      }

      // Reinforce ceiling
      for (let dx = 0; dx < rw; dx++) {
        for (let dz = 0; dz < rd; dz++) {
          setBlock(ox + dx, roomY + 3, oz + dz, BLOCK.REINFORCED);
        }
      }

      // Entrance: stairs down from surface
      for (let s = 0; s < 3; s++) {
        setBlock(ox - 1, surfH - s, oz + Math.floor(rd / 2), BLOCK.AIR);
        setBlock(ox - 1, surfH - s + 1, oz + Math.floor(rd / 2), BLOCK.AIR);
      }
    }
  }

  function generateBrokenTrees(count) {
    for (let t = 0; t < count; t++) {
      const tx = randInWorld();
      const tz = randInWorld();
      const surfH = getTerrainHeight(tx, tz);
      if (surfH <= 1) continue;
      const trunkH = 2 + Math.floor(Math.random() * 3);
      for (let y = 0; y < trunkH; y++) {
        setBlock(tx, surfH + y, tz, BLOCK.WOOD);
      }
    }
  }

  function generateRunway(ox, oz, length, width) {
    for (let x = ox; x < ox + length; x++) {
      for (let z = oz; z < oz + width; z++) {
        const h = getTerrainHeight(x, z);
        setBlock(x, h, z, BLOCK.CONCRETE);
      }
    }
  }

  function generateBuilding(ox, oz, w, d, h, blockType) {
    const surfH = getTerrainHeight(ox, oz);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          const isWall = x === 0 || x === w - 1 || z === 0 || z === d - 1;
          const isRoof = y === h - 1;
          if (isWall || isRoof) {
            setBlock(ox + x, surfH + y, oz + z, blockType);
          }
        }
      }
    }
    // Door
    setBlock(ox + Math.floor(w / 2), surfH, oz, BLOCK.AIR);
    setBlock(ox + Math.floor(w / 2), surfH + 1, oz, BLOCK.AIR);
  }

  function generateControlTower(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Base
    generateBuilding(ox, oz, 5, 5, 4, BLOCK.CONCRETE);
    // Tower column
    for (let y = 4; y < 10; y++) {
      for (let x = 1; x <= 3; x++) {
        for (let z = 1; z <= 3; z++) {
          setBlock(ox + x, surfH + y, oz + z, BLOCK.METAL);
        }
      }
    }
    // Glass observation deck
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        const isEdge = x === 0 || x === 4 || z === 0 || z === 4;
        setBlock(ox + x, surfH + 10, oz + z, BLOCK.CONCRETE);
        if (isEdge) {
          setBlock(ox + x, surfH + 11, oz + z, BLOCK.GLASS);
          setBlock(ox + x, surfH + 12, oz + z, BLOCK.GLASS);
        }
        setBlock(ox + x, surfH + 13, oz + z, BLOCK.CONCRETE);
      }
    }
  }

  function generateRiver(startX, width) {
    for (let z = worldMin; z < worldMax; z++) {
      const waver = Math.floor(Math.sin(z * 0.08) * 3);
      for (let w = 0; w < width; w++) {
        const rx = startX + waver + w;
        const surfH = getTerrainHeight(rx, z);
        // Carve and fill with water
        for (let y = surfH; y >= Math.max(0, surfH - 2); y--) {
          setBlock(rx, y, z, BLOCK.WATER);
        }
      }
    }
  }

  function generateBridge(x, z, length, width) {
    for (let i = 0; i < length; i++) {
      const surfH = getTerrainHeight(x + i, z);
      const bridgeY = surfH + 2;
      for (let w = 0; w < width; w++) {
        setBlock(x + i, bridgeY, z + w, BLOCK.CONCRETE);
      }
      // Railings
      if (i % 2 === 0) {
        setBlock(x + i, bridgeY + 1, z, BLOCK.FENCE);
        setBlock(x + i, bridgeY + 1, z + width - 1, BLOCK.FENCE);
      }
    }
    // Support pillars
    for (let p = 0; p < length; p += 4) {
      const pH = getTerrainHeight(x + p, z);
      for (let y = pH; y <= pH + 2; y++) {
        setBlock(x + p, y, z + Math.floor(width / 2), BLOCK.CONCRETE);
      }
    }
  }

  function generateDefensivePosition(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Sandbag ring
    for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
      const r = 3;
      const bx = ox + Math.round(Math.cos(angle) * r);
      const bz = oz + Math.round(Math.sin(angle) * r);
      setBlock(bx, surfH, bz, BLOCK.SANDBAG);
      setBlock(bx, surfH + 1, bz, BLOCK.SANDBAG);
    }
  }

  function generateStreetGrid(ox, oz, gridW, gridD, blockSize) {
    const streetWidth = 2;
    for (let gx = 0; gx < gridW; gx++) {
      for (let gz = 0; gz < gridD; gz++) {
        const bx = ox + gx * (blockSize + streetWidth);
        const bz = oz + gz * (blockSize + streetWidth);
        const h = 3 + Math.floor(Math.random() * 5);
        const wallType = Math.random() > 0.3 ? BLOCK.BRICK : BLOCK.CONCRETE;
        generateBuilding(bx, bz, blockSize, blockSize, h, wallType);
        // Some buildings get basements
        if (Math.random() > 0.5) {
          generateDugouts(1);
        }
      }
    }
    // Pave streets with ASPHALT
    for (let gx = 0; gx <= gridW; gx++) {
      const sx = ox + gx * (blockSize + streetWidth) - streetWidth;
      for (let z = oz; z < oz + gridD * (blockSize + streetWidth); z++) {
        for (let sw = 0; sw < streetWidth; sw++) {
          const h = getTerrainHeight(sx + sw, z);
          setBlock(sx + sw, h, z, BLOCK.ASPHALT);
        }
      }
    }
    for (let gz = 0; gz <= gridD; gz++) {
      const sz = oz + gz * (blockSize + streetWidth) - streetWidth;
      for (let x = ox; x < ox + gridW * (blockSize + streetWidth); x++) {
        for (let sw = 0; sw < streetWidth; sw++) {
          const h = getTerrainHeight(x, sz + sw);
          setBlock(x, h, sz + sw, BLOCK.ASPHALT);
        }
      }
    }
  }

  /* ── Road Generation System ─────────────────────────────────────── */
  // Stores road waypoints for vehicle AI to follow
  const _roadWaypoints = [];

  /**
   * Generate an asphalt road between two points using Bresenham-style line with width.
   * Also registers waypoints for vehicle AI road-following.
   * @param {number} x1 - Start X
   * @param {number} z1 - Start Z
   * @param {number} x2 - End X
   * @param {number} z2 - End Z
   * @param {number} [width=3] - Road width in blocks
   */
  function generateRoad(x1, z1, x2, z2, width) {
    const w = width || 3;
    const hw = Math.floor(w / 2);
    const dx = x2 - x1;
    const dz = z2 - z1;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));
    if (steps === 0) return;
    const xInc = dx / steps;
    const zInc = dz / steps;

    for (let s = 0; s <= steps; s++) {
      const cx = Math.round(x1 + xInc * s);
      const cz = Math.round(z1 + zInc * s);
      for (let wx = -hw; wx <= hw; wx++) {
        for (let wz = -hw; wz <= hw; wz++) {
          // Only place blocks along the perpendicular width (not diagonal fill)
          if (Math.abs(dx) >= Math.abs(dz)) {
            // Primarily horizontal road — expand in Z
            const bx = cx + 0;
            const bz = cz + wx;
            const h = getTerrainHeight(bx, bz);
            setBlock(bx, h, bz, BLOCK.ASPHALT);
          } else {
            // Primarily vertical road — expand in X
            const bx = cx + wx;
            const bz = cz + 0;
            const h = getTerrainHeight(bx, bz);
            setBlock(bx, h, bz, BLOCK.ASPHALT);
          }
        }
      }
      // Register waypoints every 8 blocks for vehicle road-following
      if (s % 8 === 0) {
        const h = getTerrainHeight(cx, cz);
        _roadWaypoints.push(new THREE.Vector3(cx, h + 0.5, cz));
      }
    }
  }

  /**
   * Generate a road network for a level. Accepts an array of road segments.
   * Each segment is [x1, z1, x2, z2, width].
   */
  function generateRoadNetwork(segments) {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      generateRoad(seg[0], seg[1], seg[2], seg[3], seg[4] || 3);
    }
  }

  function generateMarsh(count) {
    for (let m = 0; m < count; m++) {
      const mx = randInWorld();
      const mz = randInWorld();
      const radius = 3 + Math.floor(Math.random() * 5);
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx * dx + dz * dz <= radius * radius) {
            const h = getTerrainHeight(mx + dx, mz + dz);
            setBlock(mx + dx, h, mz + dz, BLOCK.WATER);
          }
        }
      }
    }
  }

  /* ── NEW Terrain Feature Generators (25 Level Improvement Ideas) ── */

  // IDEA 1: Soviet apartment blocks (5-9 story panel buildings)
  function generateApartmentBlock(ox, oz, floors) {
    const surfH = getTerrainHeight(ox, oz);
    const w = 10 + Math.floor(Math.random() * 6);
    const d = 6;
    const floorH = 3;
    floors = floors || (5 + Math.floor(Math.random() * 5));
    // Cap floors so building doesn't exceed chunk height
    const maxFloors = Math.floor((CHUNK_HEIGHT - surfH - 2) / floorH);
    floors = Math.min(floors, maxFloors);
    if (floors < 2) return; // Not enough room for a building
    const totalH = floors * floorH;

    for (let y = 0; y < totalH; y++) {
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          const isWall = x === 0 || x === w - 1 || z === 0 || z === d - 1;
          const isFloor = y % floorH === 0;
          if (isWall || isFloor) {
            // Random damage on upper floors
            if (y > floorH * 2 && Math.random() < 0.15) continue;
            setBlock(ox + x, surfH + y, oz + z, BLOCK.CONCRETE);
          }
        }
      }
      // Windows every 2 blocks on walls (air gaps)
      if (y % floorH === 1 || y % floorH === 2) {
        for (let x = 2; x < w - 2; x += 3) {
          setBlock(ox + x, surfH + y, oz, BLOCK.AIR);
          setBlock(ox + x, surfH + y, oz + d - 1, BLOCK.AIR);
        }
      }
    }
    // Roof
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        setBlock(ox + x, surfH + totalH, oz + z, BLOCK.CONCRETE);
      }
    }
    // Stairwell (internal column)
    for (let y = 0; y < totalH; y++) {
      setBlock(ox + Math.floor(w / 2), surfH + y, oz + 2, BLOCK.CONCRETE);
      setBlock(ox + Math.floor(w / 2), surfH + y, oz + 3, BLOCK.CONCRETE);
    }
    // Entrance
    setBlock(ox + Math.floor(w / 2), surfH, oz, BLOCK.AIR);
    setBlock(ox + Math.floor(w / 2), surfH + 1, oz, BLOCK.AIR);
    setBlock(ox + Math.floor(w / 2), surfH + 2, oz, BLOCK.AIR);
  }

  // IDEA 2: Industrial complex (coking plant for Avdiivka)
  function generateIndustrialComplex(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Main factory hall
    const hallW = 20, hallD = 12, hallH = 8;
    for (let y = 0; y < hallH; y++) {
      for (let x = 0; x < hallW; x++) {
        for (let z = 0; z < hallD; z++) {
          const isWall = x === 0 || x === hallW - 1 || z === 0 || z === hallD - 1;
          const isRoof = y === hallH - 1;
          if (isWall || isRoof) {
            if (Math.random() < 0.12) continue; // Battle damage
            setBlock(ox + x, surfH + y, oz + z, BLOCK.METAL);
          }
        }
      }
    }
    // Smokestacks (tall chimneys)
    for (let i = 0; i < 3; i++) {
      const sx = ox + 4 + i * 6;
      const sz = oz + hallD + 2;
      for (let y = 0; y < 14; y++) {
        setBlock(sx, surfH + y, sz, BLOCK.BRICK);
        setBlock(sx + 1, surfH + y, sz, BLOCK.BRICK);
        setBlock(sx, surfH + y, sz + 1, BLOCK.BRICK);
        setBlock(sx + 1, surfH + y, sz + 1, BLOCK.BRICK);
      }
    }
    // Storage silos
    for (let i = 0; i < 2; i++) {
      const cx = ox - 5 + i * (hallW + 8);
      const cz = oz + 3;
      for (let y = 0; y < 6; y++) {
        for (let a = 0; a < Math.PI * 2; a += 0.4) {
          const bx = Math.round(Math.cos(a) * 2.5);
          const bz = Math.round(Math.sin(a) * 2.5);
          setBlock(cx + bx, surfH + y, cz + bz, BLOCK.METAL);
        }
      }
      // Cap
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (dx * dx + dz * dz <= 6) {
            setBlock(cx + dx, surfH + 6, cz + dz, BLOCK.METAL);
          }
        }
      }
    }
    // Loading dock
    for (let x = 0; x < 8; x++) {
      for (let z = 0; z < 4; z++) {
        setBlock(ox + hallW + 1 + x, surfH, oz + z, BLOCK.CONCRETE);
      }
      setBlock(ox + hallW + 1 + x, surfH + 1, oz, BLOCK.CONCRETE);
    }
    // Pipe network (connecting buildings)
    for (let x = 0; x < hallW + 10; x++) {
      setBlock(ox + x, surfH + hallH + 1, oz + Math.floor(hallD / 2), BLOCK.METAL);
    }
    // Rubble around (battle damage)
    for (let rb = 0; rb < 30; rb++) {
      const rx = ox + Math.floor(Math.random() * (hallW + 10)) - 3;
      const rz = oz + Math.floor(Math.random() * (hallD + 8)) - 3;
      const h = getTerrainHeight(rx, rz);
      if (h > 0) setBlock(rx, h, rz, BLOCK.RUBBLE);
    }
  }

  // IDEA 3: Railway tracks
  function generateRailway(startX, startZ, length, horizontal) {
    for (let i = 0; i < length; i++) {
      const wx = horizontal ? startX + i : startX;
      const wz = horizontal ? startZ : startZ + i;
      const h = getTerrainHeight(wx, wz);
      // Rail bed (stone)
      for (let w = -1; w <= 1; w++) {
        const rx = horizontal ? wx : wx + w;
        const rz = horizontal ? wz + w : wz;
        setBlock(rx, h, rz, BLOCK.STONE);
      }
      // Rails (metal on top)
      if (i % 2 === 0) {
        const r1x = horizontal ? wx : wx - 1;
        const r1z = horizontal ? wz - 1 : wz;
        const r2x = horizontal ? wx : wx + 1;
        const r2z = horizontal ? wz + 1 : wz;
        setBlock(r1x, h + 1, r1z, BLOCK.METAL);
        setBlock(r2x, h + 1, r2z, BLOCK.METAL);
      }
      // Sleepers (wood crossbars every 3 blocks)
      if (i % 3 === 0) {
        for (let w = -1; w <= 1; w++) {
          const sx = horizontal ? wx : wx + w;
          const sz = horizontal ? wz + w : wz;
          setBlock(sx, h + 1, sz, BLOCK.WOOD);
        }
      }
    }
  }

  // IDEA 4: Destroyed vehicles as cover
  function generateDestroyedVehicles(count) {
    for (let v = 0; v < count; v++) {
      const vx = randInWorld();
      const vz = randInWorld();
      const h = getTerrainHeight(vx, vz);
      if (h <= 1) continue;
      const type = Math.random();
      if (type < 0.5) {
        // Destroyed car/truck (small)
        for (let x = 0; x < 3; x++) {
          for (let z = 0; z < 2; z++) {
            setBlock(vx + x, h, vz + z, BLOCK.METAL);
            if (x > 0 && x < 2) setBlock(vx + x, h + 1, vz + z, BLOCK.METAL);
          }
        }
        // Burnt marks
        setBlock(vx + 1, h + 2, vz, BLOCK.RUBBLE);
      } else {
        // Destroyed APC/tank (larger)
        for (let x = 0; x < 5; x++) {
          for (let z = 0; z < 3; z++) {
            setBlock(vx + x, h, vz + z, BLOCK.METAL);
            if (x >= 1 && x <= 3 && z >= 0 && z <= 2) {
              setBlock(vx + x, h + 1, vz + z, BLOCK.METAL);
            }
          }
        }
        // Turret
        setBlock(vx + 2, h + 2, vz + 1, BLOCK.METAL);
        setBlock(vx + 3, h + 2, vz + 1, BLOCK.METAL);
        // Rubble/debris around
        setBlock(vx - 1, h, vz + 1, BLOCK.RUBBLE);
        setBlock(vx + 5, h, vz, BLOCK.RUBBLE);
      }
    }
  }

  // IDEA 5: Power line towers
  function generatePowerLines(ox, oz, count) {
    for (let i = 0; i < count; i++) {
      const px = ox + i * 16;
      const h = getTerrainHeight(px, oz);
      // Tower base
      setBlock(px, h, oz, BLOCK.METAL);
      setBlock(px + 1, h, oz, BLOCK.METAL);
      setBlock(px, h, oz + 1, BLOCK.METAL);
      setBlock(px + 1, h, oz + 1, BLOCK.METAL);
      // Tower shaft
      for (let y = 1; y < 10; y++) {
        setBlock(px, h + y, oz, BLOCK.METAL);
        setBlock(px + 1, h + y, oz + 1, BLOCK.METAL);
      }
      // Cross arms
      for (let a = -2; a <= 3; a++) {
        setBlock(px + a, h + 9, oz, BLOCK.METAL);
        setBlock(px + a, h + 10, oz, BLOCK.METAL);
      }
      // Some towers damaged (broken top)
      if (Math.random() < 0.3) {
        for (let y = 7; y <= 10; y++) {
          setBlock(px, h + y, oz, BLOCK.AIR);
          setBlock(px + 1, h + y, oz + 1, BLOCK.AIR);
        }
        setBlock(px, h + 7, oz, BLOCK.RUBBLE);
      }
    }
  }

  // IDEA 6: Grain silos (for Kherson agricultural theme)
  function generateGrainSilo(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    const radius = 3;
    const height = 10;
    // Cylindrical silo
    for (let y = 0; y < height; y++) {
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const bx = Math.round(Math.cos(a) * radius);
        const bz = Math.round(Math.sin(a) * radius);
        setBlock(ox + bx, surfH + y, oz + bz, BLOCK.METAL);
      }
    }
    // Conical roof
    for (let r = radius; r >= 0; r--) {
      const y = surfH + height + (radius - r);
      for (let a = 0; a < Math.PI * 2; a += 0.3) {
        const bx = Math.round(Math.cos(a) * r);
        const bz = Math.round(Math.sin(a) * r);
        setBlock(ox + bx, y, oz + bz, BLOCK.METAL);
      }
    }
    // Access door
    setBlock(ox + radius, surfH, oz, BLOCK.AIR);
    setBlock(ox + radius, surfH + 1, oz, BLOCK.AIR);
  }

  // IDEA 7: Salt mine entrance (for Bakhmut/Soledar)
  function generateSaltMine(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Entrance structure
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 4; z++) {
        setBlock(ox + x, surfH, oz + z, BLOCK.CONCRETE);
        setBlock(ox + x, surfH + 3, oz + z, BLOCK.CONCRETE);
        if (x === 0 || x === 5 || z === 0 || z === 3) {
          setBlock(ox + x, surfH + 1, oz + z, BLOCK.CONCRETE);
          setBlock(ox + x, surfH + 2, oz + z, BLOCK.CONCRETE);
        }
      }
    }
    // Entrance opening
    for (let x = 2; x <= 3; x++) {
      for (let y = 0; y < 3; y++) {
        setBlock(ox + x, surfH + y, oz, BLOCK.AIR);
      }
    }
    // Tunnel going underground
    for (let depth = 1; depth <= 12; depth++) {
      const ty = surfH - depth;
      if (ty < 1) break;
      for (let x = 1; x <= 4; x++) {
        for (let z = 0; z < 4; z++) {
          setBlock(ox + x, ty, oz + z - depth, BLOCK.AIR);
        }
        // Support beams
        if (depth % 3 === 0) {
          setBlock(ox + 1, ty, oz - depth, BLOCK.WOOD);
          setBlock(ox + 4, ty, oz - depth, BLOCK.WOOD);
          for (let bx = 1; bx <= 4; bx++) {
            setBlock(ox + bx, ty + 3, oz - depth, BLOCK.WOOD);
          }
        }
      }
    }
    // Mining cart tracks
    for (let d = 0; d < 10; d++) {
      const ty = surfH - d;
      if (ty < 1) break;
      setBlock(ox + 2, ty, oz - d, BLOCK.METAL);
      setBlock(ox + 3, ty, oz - d, BLOCK.METAL);
    }
  }

  // IDEA 8: Water tower
  function generateWaterTower(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Support legs (4 corners)
    for (let y = 0; y < 8; y++) {
      setBlock(ox, surfH + y, oz, BLOCK.METAL);
      setBlock(ox + 3, surfH + y, oz, BLOCK.METAL);
      setBlock(ox, surfH + y, oz + 3, BLOCK.METAL);
      setBlock(ox + 3, surfH + y, oz + 3, BLOCK.METAL);
    }
    // Cross bracing
    for (let y = 3; y < 8; y += 3) {
      for (let x = 0; x <= 3; x++) {
        setBlock(ox + x, surfH + y, oz, BLOCK.METAL);
        setBlock(ox + x, surfH + y, oz + 3, BLOCK.METAL);
      }
    }
    // Tank (cylindrical)
    for (let y = 0; y < 4; y++) {
      for (let dx = -1; dx <= 4; dx++) {
        for (let dz = -1; dz <= 4; dz++) {
          const cx = dx - 1.5, cz = dz - 1.5;
          if (cx * cx + cz * cz <= 7) {
            setBlock(ox + dx, surfH + 8 + y, oz + dz, BLOCK.METAL);
          }
        }
      }
    }
  }

  // IDEA 9: Checkpoint/roadblock
  function generateCheckpoint(ox, oz, horizontal) {
    const surfH = getTerrainHeight(ox, oz);
    // Concrete barriers
    for (let i = 0; i < 6; i++) {
      const bx = horizontal ? ox + i : ox;
      const bz = horizontal ? oz : oz + i;
      setBlock(bx, surfH, bz, BLOCK.CONCRETE);
      setBlock(bx, surfH + 1, bz, BLOCK.CONCRETE);
    }
    // Gap in middle for passage
    const mx = horizontal ? ox + 3 : ox;
    const mz = horizontal ? oz : oz + 3;
    setBlock(mx, surfH, mz, BLOCK.AIR);
    setBlock(mx, surfH + 1, mz, BLOCK.AIR);
    // Sandbag positions on sides
    for (let s = -2; s <= -1; s++) {
      const sx = horizontal ? ox + s : ox;
      const sz = horizontal ? oz : oz + s;
      setBlock(sx, surfH, sz, BLOCK.SANDBAG);
      setBlock(sx, surfH + 1, sz, BLOCK.SANDBAG);
    }
    for (let s = 7; s <= 8; s++) {
      const sx = horizontal ? ox + s : ox;
      const sz = horizontal ? oz : oz + s;
      setBlock(sx, surfH, sz, BLOCK.SANDBAG);
      setBlock(sx, surfH + 1, sz, BLOCK.SANDBAG);
    }
    // Guard booth
    const gx = horizontal ? ox - 3 : ox - 2;
    const gz = horizontal ? oz - 2 : oz - 3;
    generateBuilding(gx, gz, 3, 3, 3, BLOCK.WOOD);
  }

  // IDEA 10: Barbed wire obstacles
  function generateBarbedWire(ox, oz, length, horizontal) {
    for (let i = 0; i < length; i++) {
      const wx = horizontal ? ox + i : ox;
      const wz = horizontal ? oz : oz + i;
      const h = getTerrainHeight(wx, wz);
      // Posts
      if (i % 3 === 0) {
        setBlock(wx, h, wz, BLOCK.WOOD);
        setBlock(wx, h + 1, wz, BLOCK.WOOD);
      }
      // Wire (fence blocks)
      setBlock(wx, h + 1, wz, BLOCK.FENCE);
    }
  }

  // IDEA 11: Anti-tank hedgehogs (Czech hedgehogs)
  function generateAntiTankHedgehogs(count) {
    for (let i = 0; i < count; i++) {
      const hx = randInWorld();
      const hz = randInWorld();
      const h = getTerrainHeight(hx, hz);
      if (h <= 1) continue;
      // X-shaped metal structure
      setBlock(hx, h, hz, BLOCK.METAL);
      setBlock(hx, h + 1, hz, BLOCK.METAL);
      setBlock(hx - 1, h, hz, BLOCK.METAL);
      setBlock(hx + 1, h, hz, BLOCK.METAL);
      setBlock(hx, h, hz - 1, BLOCK.METAL);
      setBlock(hx, h, hz + 1, BLOCK.METAL);
    }
  }

  // IDEA 12: Ammunition depot
  function generateAmmoDepot(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Bunker-style building
    for (let x = 0; x < 8; x++) {
      for (let z = 0; z < 6; z++) {
        setBlock(ox + x, surfH, oz + z, BLOCK.REINFORCED);
        setBlock(ox + x, surfH + 3, oz + z, BLOCK.REINFORCED);
        if (x === 0 || x === 7 || z === 0 || z === 5) {
          for (let y = 1; y < 3; y++) {
            setBlock(ox + x, surfH + y, oz + z, BLOCK.REINFORCED);
          }
        }
      }
    }
    // Door
    setBlock(ox + 4, surfH + 1, oz, BLOCK.AIR);
    setBlock(ox + 4, surfH + 2, oz, BLOCK.AIR);
    // Crates inside
    for (let c = 0; c < 6; c++) {
      const cx = ox + 2 + Math.floor(Math.random() * 4);
      const cz = oz + 1 + Math.floor(Math.random() * 4);
      setBlock(cx, surfH + 1, cz, BLOCK.CRATE);
      if (Math.random() > 0.5) setBlock(cx, surfH + 2, cz, BLOCK.CRATE);
    }
    // Sandbag perimeter
    for (let i = -1; i <= 8; i++) {
      setBlock(ox + i, surfH, oz - 1, BLOCK.SANDBAG);
      setBlock(ox + i, surfH + 1, oz - 1, BLOCK.SANDBAG);
    }
  }

  // IDEA 13: Field hospital tent
  function generateFieldHospital(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Tent structure (fabric represented by wood blocks for color)
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 8; z++) {
        // Floor
        setBlock(ox + x, surfH, oz + z, BLOCK.CONCRETE);
        // Roof (peaked)
        const peakY = x < 3 ? x : 5 - x;
        setBlock(ox + x, surfH + 2 + peakY, oz + z, BLOCK.WOOD);
      }
    }
    // Side walls (partial)
    for (let z = 0; z < 8; z++) {
      setBlock(ox, surfH + 1, oz + z, BLOCK.WOOD);
      setBlock(ox + 5, surfH + 1, oz + z, BLOCK.WOOD);
    }
    // Entrance (open ends)
    // Crates inside for supplies
    for (let c = 0; c < 3; c++) {
      setBlock(ox + 1 + c * 2, surfH + 1, oz + 2, BLOCK.CRATE);
    }
  }

  // IDEA 14: Communication tower/antenna
  function generateCommTower(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Base building
    generateBuilding(ox - 1, oz - 1, 4, 4, 3, BLOCK.CONCRETE);
    // Tower (tall metal lattice)
    for (let y = 0; y < 16; y++) {
      setBlock(ox, surfH + 3 + y, oz, BLOCK.METAL);
      setBlock(ox + 1, surfH + 3 + y, oz + 1, BLOCK.METAL);
      // Cross members every 4 blocks
      if (y % 4 === 0) {
        setBlock(ox + 1, surfH + 3 + y, oz, BLOCK.METAL);
        setBlock(ox, surfH + 3 + y, oz + 1, BLOCK.METAL);
      }
    }
    // Dish at top
    setBlock(ox - 1, surfH + 18, oz, BLOCK.METAL);
    setBlock(ox + 2, surfH + 18, oz, BLOCK.METAL);
    setBlock(ox, surfH + 19, oz, BLOCK.METAL);
    setBlock(ox + 1, surfH + 19, oz, BLOCK.METAL);
  }

  // IDEA 15: Underground bunker command post
  function generateUndergroundBunker(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    const roomY = Math.max(1, surfH - 5);
    // Large underground room
    for (let dx = 0; dx < 8; dx++) {
      for (let dz = 0; dz < 8; dz++) {
        for (let dy = 0; dy < 4; dy++) {
          setBlock(ox + dx, roomY + dy, oz + dz, BLOCK.AIR);
        }
        // Reinforced ceiling
        setBlock(ox + dx, roomY + 4, oz + dz, BLOCK.REINFORCED);
        // Reinforced floor
        setBlock(ox + dx, roomY - 1, oz + dz, BLOCK.REINFORCED);
      }
    }
    // Support pillars
    for (let px = 2; px <= 5; px += 3) {
      for (let pz = 2; pz <= 5; pz += 3) {
        for (let y = 0; y < 4; y++) {
          setBlock(ox + px, roomY + y, oz + pz, BLOCK.REINFORCED);
        }
      }
    }
    // Entrance stairwell
    for (let s = 0; s <= 5; s++) {
      setBlock(ox - 1, surfH - s, oz + 3, BLOCK.AIR);
      setBlock(ox - 1, surfH - s, oz + 4, BLOCK.AIR);
      setBlock(ox - 1, surfH - s + 1, oz + 3, BLOCK.AIR);
      setBlock(ox - 1, surfH - s + 1, oz + 4, BLOCK.AIR);
    }
    // Equipment inside
    setBlock(ox + 1, roomY, oz + 1, BLOCK.ELECTRONICS);
    setBlock(ox + 2, roomY, oz + 1, BLOCK.ELECTRONICS);
    setBlock(ox + 6, roomY, oz + 1, BLOCK.CRATE);
    setBlock(ox + 6, roomY, oz + 6, BLOCK.CRATE);
  }

  // IDEA 16: Bridge fortifications
  function generateFortifiedBridge(ox, oz, length, width) {
    // Base bridge
    generateBridge(ox, oz, length, width);
    const surfH = getTerrainHeight(ox, oz);
    const bridgeY = surfH + 2;
    // Sandbag barriers on bridge
    for (let i = 0; i < length; i += 5) {
      for (let w = 0; w < width; w++) {
        setBlock(ox + i, bridgeY + 1, oz + w, BLOCK.SANDBAG);
        setBlock(ox + i, bridgeY + 2, oz + w, BLOCK.SANDBAG);
      }
    }
    // Checkpoint at bridge entrance
    for (let w = 0; w < width; w++) {
      setBlock(ox, bridgeY + 1, oz + w, BLOCK.CONCRETE);
      setBlock(ox, bridgeY + 2, oz + w, BLOCK.CONCRETE);
      setBlock(ox + length - 1, bridgeY + 1, oz + w, BLOCK.CONCRETE);
      setBlock(ox + length - 1, bridgeY + 2, oz + w, BLOCK.CONCRETE);
    }
    // Gate opening
    setBlock(ox, bridgeY + 1, oz + Math.floor(width / 2), BLOCK.AIR);
    setBlock(ox, bridgeY + 2, oz + Math.floor(width / 2), BLOCK.AIR);
    setBlock(ox + length - 1, bridgeY + 1, oz + Math.floor(width / 2), BLOCK.AIR);
    setBlock(ox + length - 1, bridgeY + 2, oz + Math.floor(width / 2), BLOCK.AIR);
  }

  // IDEA 17: Crop fields (for Kherson)
  function generateCropFields(ox, oz, fieldW, fieldD) {
    // Flat farmland with dirt rows
    for (let x = 0; x < fieldW; x++) {
      for (let z = 0; z < fieldD; z++) {
        const h = getTerrainHeight(ox + x, oz + z);
        setBlock(ox + x, h, oz + z, BLOCK.DIRT);
        // Crop rows (alternate grass blocks = crops)
        if (z % 2 === 0 && Math.random() > 0.2) {
          setBlock(ox + x, h + 1, oz + z, BLOCK.GRASS);
        }
      }
    }
    // Farm path borders
    for (let x = 0; x < fieldW; x++) {
      setBlock(ox + x, getTerrainHeight(ox + x, oz - 1), oz - 1, BLOCK.DIRT);
      setBlock(ox + x, getTerrainHeight(ox + x, oz + fieldD), oz + fieldD, BLOCK.DIRT);
    }
  }

  // IDEA 18: Flag pole (Ukrainian flag at objectives)
  function generateFlagPole(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Pole
    for (let y = 0; y < 8; y++) {
      setBlock(ox, surfH + y, oz, BLOCK.METAL);
    }
    // Flag (blue + yellow blocks) - Ukrainian colors
    // Blue stripe (top)
    setBlock(ox + 1, surfH + 7, oz, BLOCK.WATER);
    setBlock(ox + 2, surfH + 7, oz, BLOCK.WATER);
    setBlock(ox + 1, surfH + 6, oz, BLOCK.WATER);
    setBlock(ox + 2, surfH + 6, oz, BLOCK.WATER);
    // Yellow stripe (bottom)
    setBlock(ox + 1, surfH + 5, oz, BLOCK.SAND);
    setBlock(ox + 2, surfH + 5, oz, BLOCK.SAND);
    setBlock(ox + 1, surfH + 4, oz, BLOCK.SAND);
    setBlock(ox + 2, surfH + 4, oz, BLOCK.SAND);
  }

  // IDEA 19: Propaganda signs / billboards
  function generateBillboard(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Support posts
    setBlock(ox, surfH, oz, BLOCK.METAL);
    setBlock(ox, surfH + 1, oz, BLOCK.METAL);
    setBlock(ox, surfH + 2, oz, BLOCK.METAL);
    setBlock(ox, surfH + 3, oz, BLOCK.METAL);
    setBlock(ox + 5, surfH, oz, BLOCK.METAL);
    setBlock(ox + 5, surfH + 1, oz, BLOCK.METAL);
    setBlock(ox + 5, surfH + 2, oz, BLOCK.METAL);
    setBlock(ox + 5, surfH + 3, oz, BLOCK.METAL);
    // Board surface
    for (let x = 0; x <= 5; x++) {
      setBlock(ox + x, surfH + 4, oz, BLOCK.WOOD);
      setBlock(ox + x, surfH + 5, oz, BLOCK.WOOD);
      setBlock(ox + x, surfH + 6, oz, BLOCK.WOOD);
    }
  }

  // IDEA 20: Church/memorial
  function generateChurch(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Main structure
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        for (let z = 0; z < 6; z++) {
          const isWall = x === 0 || x === 7 || z === 0 || z === 5;
          const isRoof = y === 5;
          if (isWall || isRoof) {
            setBlock(ox + x, surfH + y, oz + z, BLOCK.BRICK);
          }
        }
      }
    }
    // Peaked roof
    for (let r = 0; r < 3; r++) {
      for (let z = 0; z < 6; z++) {
        setBlock(ox + 2 + r, surfH + 6 + r, oz + z, BLOCK.BRICK);
        setBlock(ox + 5 - r, surfH + 6 + r, oz + z, BLOCK.BRICK);
      }
    }
    // Bell tower/steeple
    for (let y = 0; y < 4; y++) {
      setBlock(ox + 3, surfH + 9 + y, oz + 2, BLOCK.BRICK);
      setBlock(ox + 4, surfH + 9 + y, oz + 2, BLOCK.BRICK);
      setBlock(ox + 3, surfH + 9 + y, oz + 3, BLOCK.BRICK);
      setBlock(ox + 4, surfH + 9 + y, oz + 3, BLOCK.BRICK);
    }
    // Cross on top
    setBlock(ox + 3, surfH + 13, oz + 2, BLOCK.METAL);
    setBlock(ox + 3, surfH + 14, oz + 2, BLOCK.METAL);
    setBlock(ox + 2, surfH + 13, oz + 2, BLOCK.METAL);
    setBlock(ox + 4, surfH + 13, oz + 2, BLOCK.METAL);
    // Windows (glass on walls)
    for (let y = 2; y <= 3; y++) {
      setBlock(ox, surfH + y, oz + 2, BLOCK.GLASS);
      setBlock(ox + 7, surfH + y, oz + 2, BLOCK.GLASS);
      setBlock(ox, surfH + y, oz + 3, BLOCK.GLASS);
      setBlock(ox + 7, surfH + y, oz + 3, BLOCK.GLASS);
    }
    // Entrance
    setBlock(ox + 3, surfH, oz, BLOCK.AIR);
    setBlock(ox + 3, surfH + 1, oz, BLOCK.AIR);
    setBlock(ox + 3, surfH + 2, oz, BLOCK.AIR);
    setBlock(ox + 4, surfH, oz, BLOCK.AIR);
    setBlock(ox + 4, surfH + 1, oz, BLOCK.AIR);
    setBlock(ox + 4, surfH + 2, oz, BLOCK.AIR);
  }

  // IDEA 21: Evacuation bus/civilian vehicles
  function generateEvacVehicles(count) {
    for (let v = 0; v < count; v++) {
      const vx = randInWorld();
      const vz = randInWorld();
      const h = getTerrainHeight(vx, vz);
      if (h <= 1) continue;
      // Bus shape
      for (let x = 0; x < 6; x++) {
        for (let z = 0; z < 2; z++) {
          setBlock(vx + x, h, vz + z, BLOCK.METAL);
          setBlock(vx + x, h + 1, vz + z, BLOCK.METAL);
          if (x >= 1 && x <= 4) {
            setBlock(vx + x, h + 2, vz + z, BLOCK.GLASS); // windows
          }
          setBlock(vx + x, h + 3, vz + z, BLOCK.METAL); // roof
        }
      }
    }
  }

  // IDEA 22: Minefield warning signs
  function generateMinefieldSigns(count) {
    for (let m = 0; m < count; m++) {
      const mx = randInWorld();
      const mz = randInWorld();
      const h = getTerrainHeight(mx, mz);
      if (h <= 1) continue;
      // Warning post
      setBlock(mx, h, mz, BLOCK.WOOD);
      setBlock(mx, h + 1, mz, BLOCK.WOOD);
      // Sign (red block = danger)
      setBlock(mx, h + 2, mz, BLOCK.BRICK);
      // Scattered disturbed dirt around (mines beneath)
      for (let d = 0; d < 8; d++) {
        const dx = mx + Math.floor(Math.random() * 10) - 5;
        const dz = mz + Math.floor(Math.random() * 10) - 5;
        const dh = getTerrainHeight(dx, dz);
        if (dh > 1) setBlock(dx, dh, dz, BLOCK.DIRT);
      }
    }
  }

  // IDEA 23: Sniper nest in ruins
  function generateSniperNest(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Tall ruined building
    const h = 7 + Math.floor(Math.random() * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < 5; x++) {
        for (let z = 0; z < 5; z++) {
          const isWall = x === 0 || x === 4 || z === 0 || z === 4;
          if (isWall) {
            if (Math.random() < 0.1 && y > 3) continue; // damage
            setBlock(ox + x, surfH + y, oz + z, BLOCK.CONCRETE);
          }
        }
      }
    }
    // Observation slit at top
    setBlock(ox + 2, surfH + h - 1, oz, BLOCK.AIR);
    setBlock(ox + 2, surfH + h - 2, oz, BLOCK.AIR);
    // Floor at top
    for (let x = 1; x < 4; x++) {
      for (let z = 1; z < 4; z++) {
        setBlock(ox + x, surfH + h - 3, oz + z, BLOCK.CONCRETE);
      }
    }
    // Sandbag firing position
    setBlock(ox + 1, surfH + h - 2, oz + 1, BLOCK.SANDBAG);
    setBlock(ox + 3, surfH + h - 2, oz + 1, BLOCK.SANDBAG);
    // Internal stairs
    for (let y = 0; y < h - 3; y++) {
      setBlock(ox + 1, surfH + y, oz + 3, BLOCK.STONE);
    }
    // Entrance
    setBlock(ox + 2, surfH, oz, BLOCK.AIR);
    setBlock(ox + 2, surfH + 1, oz, BLOCK.AIR);
  }

  // IDEA 24: Farm buildings (for Kherson)
  function generateFarmBuilding(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Barn
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 8; x++) {
        for (let z = 0; z < 6; z++) {
          const isWall = x === 0 || x === 7 || z === 0 || z === 5;
          const isRoof = y === 4;
          if (isWall || isRoof) {
            setBlock(ox + x, surfH + y, oz + z, BLOCK.WOOD);
          }
        }
      }
    }
    // Peaked roof
    for (let r = 0; r < 3; r++) {
      for (let z = 0; z < 6; z++) {
        setBlock(ox + 2 + r, surfH + 5, oz + z, BLOCK.WOOD);
        setBlock(ox + 5 - r, surfH + 5, oz + z, BLOCK.WOOD);
      }
    }
    // Barn door
    for (let y = 0; y < 3; y++) {
      setBlock(ox + 3, surfH + y, oz, BLOCK.AIR);
      setBlock(ox + 4, surfH + y, oz, BLOCK.AIR);
    }
    // Haystacks next to barn
    for (let hx = 0; hx < 3; hx++) {
      setBlock(ox + 9 + hx, surfH, oz + 2, BLOCK.SAND);
      setBlock(ox + 9 + hx, surfH + 1, oz + 2, BLOCK.SAND);
      setBlock(ox + 10, surfH + 2, oz + 2, BLOCK.SAND);
    }
    // Fence around area
    for (let f = -2; f < 12; f++) {
      setBlock(ox + f, surfH, oz - 2, BLOCK.FENCE);
      setBlock(ox + f, surfH + 1, oz - 2, BLOCK.FENCE);
      setBlock(ox + f, surfH, oz + 8, BLOCK.FENCE);
      setBlock(ox + f, surfH + 1, oz + 8, BLOCK.FENCE);
    }
  }

  // IDEA 25: Burning/fire ruins (visual only - rubble with "fire" colored blocks)
  function generateBurningRuin(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    const w = 5 + Math.floor(Math.random() * 4);
    const d = 5 + Math.floor(Math.random() * 4);
    // Collapsed structure
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        setBlock(ox + x, surfH, oz + z, BLOCK.RUBBLE);
        if (Math.random() > 0.5) {
          setBlock(ox + x, surfH + 1, oz + z, BLOCK.RUBBLE);
        }
        // "Fire" represented by fuel barrel blocks (orange color)
        if (Math.random() < 0.15) {
          setBlock(ox + x, surfH + 1, oz + z, BLOCK.FUEL_BARREL);
          if (Math.random() < 0.3) {
            setBlock(ox + x, surfH + 2, oz + z, BLOCK.FUEL_BARREL);
          }
        }
      }
    }
    // Remaining wall fragments
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < w; x++) {
        if (Math.random() < 0.3) {
          setBlock(ox + x, surfH + y + 1, oz, BLOCK.BRICK);
        }
      }
    }
  }

  // ── New Terrain Generators ──────────────────────────────────────

  function generateMortarPit(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Dig a circular pit
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (dx * dx + dz * dz <= 5) {
          setBlock(ox + dx, surfH, oz + dz, BLOCK.AIR);
          setBlock(ox + dx, surfH - 1, oz + dz, BLOCK.DIRT);
        }
      }
    }
    // Sandbag ring
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const d = dx * dx + dz * dz;
        if (d >= 7 && d <= 10) {
          setBlock(ox + dx, surfH, oz + dz, BLOCK.SANDBAG);
          setBlock(ox + dx, surfH + 1, oz + dz, BLOCK.SANDBAG);
        }
      }
    }
    // Mortar tube (metal block stack)
    setBlock(ox, surfH, oz, BLOCK.METAL);
    setBlock(ox, surfH + 1, oz, BLOCK.METAL);
  }

  function generateWatchtower(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // 4 legs
    for (let y = 0; y < 8; y++) {
      setBlock(ox - 1, surfH + y + 1, oz - 1, BLOCK.WOOD);
      setBlock(ox + 1, surfH + y + 1, oz - 1, BLOCK.WOOD);
      setBlock(ox - 1, surfH + y + 1, oz + 1, BLOCK.WOOD);
      setBlock(ox + 1, surfH + y + 1, oz + 1, BLOCK.WOOD);
    }
    // Platform
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        setBlock(ox + dx, surfH + 8, oz + dz, BLOCK.WOOD);
      }
    }
    // Railing
    for (let dx = -2; dx <= 2; dx++) {
      setBlock(ox + dx, surfH + 9, oz - 2, BLOCK.FENCE);
      setBlock(ox + dx, surfH + 9, oz + 2, BLOCK.FENCE);
    }
    for (let dz = -2; dz <= 2; dz++) {
      setBlock(ox - 2, surfH + 9, oz + dz, BLOCK.FENCE);
      setBlock(ox + 2, surfH + 9, oz + dz, BLOCK.FENCE);
    }
    // Ladder
    for (let y = 1; y <= 8; y++) {
      setBlock(ox, surfH + y, oz - 2, BLOCK.WOOD);
    }
  }

  function generateAmmoCache(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Small enclosed ammo storage
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        setBlock(ox + dx, surfH + 1, oz + dz, BLOCK.CRATE);
        if (Math.random() < 0.5) setBlock(ox + dx, surfH + 2, oz + dz, BLOCK.CRATE);
      }
    }
    // Sandbag surround
    for (let dx = -2; dx <= 2; dx++) {
      setBlock(ox + dx, surfH + 1, oz - 2, BLOCK.SANDBAG);
      setBlock(ox + dx, surfH + 1, oz + 2, BLOCK.SANDBAG);
    }
    for (let dz = -1; dz <= 1; dz++) {
      setBlock(ox - 2, surfH + 1, oz + dz, BLOCK.SANDBAG);
      setBlock(ox + 2, surfH + 1, oz + dz, BLOCK.SANDBAG);
    }
  }

  function generateRazorWireMaze(ox, oz, segments) {
    // Zigzag fence wire pattern; segments = number of zigzag legs
    let cx = ox, cz = oz;
    for (let seg = 0; seg < segments; seg++) {
      const len = 4 + Math.floor(Math.random() * 6);
      const horizontal = seg % 2 === 0;
      for (let i = 0; i < len; i++) {
        const wx = horizontal ? cx + i : cx;
        const wz = horizontal ? cz : cz + i;
        const h = getTerrainHeight(wx, wz);
        setBlock(wx, h + 1, wz, BLOCK.FENCE);
      }
      if (horizontal) cx += len; else cz += len;
    }
  }

  function generateSupplyTent(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Green canvas tent (using grass blocks as proxy)
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const roofH = 3 - Math.abs(dx);
        setBlock(ox + dx, surfH + roofH, oz + dz, BLOCK.GRASS);
      }
    }
    // Support poles
    setBlock(ox - 2, surfH + 1, oz - 3, BLOCK.WOOD);
    setBlock(ox + 2, surfH + 1, oz - 3, BLOCK.WOOD);
    setBlock(ox - 2, surfH + 1, oz + 3, BLOCK.WOOD);
    setBlock(ox + 2, surfH + 1, oz + 3, BLOCK.WOOD);
    // Crates inside
    setBlock(ox, surfH + 1, oz, BLOCK.CRATE);
    setBlock(ox + 1, surfH + 1, oz, BLOCK.CRATE);
    setBlock(ox - 1, surfH + 1, oz + 1, BLOCK.CRATE);
  }

  // ── ROUND 2: New Terrain Generators ──────────────────────────

  function generateUndergroundTunnel(ox, oz, length) {
    // Dig a tunnel 2 blocks below surface, length blocks long
    const surfH = getTerrainHeight(ox, oz);
    const tunnelY = surfH - 2;
    const dir = Math.random() > 0.5; // true=X, false=Z
    for (let i = 0; i < (length || 12); i++) {
      const tx = dir ? ox + i : ox;
      const tz = dir ? oz : oz + i;
      // Tunnel bore: 2 wide, 2 tall
      for (let dx = 0; dx < 2; dx++) {
        setBlock(tx + (dir ? 0 : dx), tunnelY, tz + (dir ? dx : 0), BLOCK.AIR);
        setBlock(tx + (dir ? 0 : dx), tunnelY + 1, tz + (dir ? dx : 0), BLOCK.AIR);
      }
      // Timber supports every 3 blocks
      if (i % 3 === 0) {
        setBlock(tx, tunnelY - 1, tz, BLOCK.WOOD);
        setBlock(tx, tunnelY + 2, tz, BLOCK.WOOD);
        setBlock(tx + (dir ? 0 : 1), tunnelY + 2, tz + (dir ? 1 : 0), BLOCK.WOOD);
      }
    }
    // Entrance: open hole in surface with sandbag cover
    setBlock(ox, surfH, oz, BLOCK.AIR);
    setBlock(ox, surfH - 1, oz, BLOCK.AIR);
    setBlock(ox - 1, surfH, oz, BLOCK.SANDBAG);
    setBlock(ox + 1, surfH, oz, BLOCK.SANDBAG);
    setBlock(ox, surfH, oz - 1, BLOCK.SANDBAG);
    setBlock(ox, surfH, oz + 1, BLOCK.SANDBAG);
    // Exit hole at far end
    const ex = dir ? ox + (length || 12) : ox;
    const ez = dir ? oz : oz + (length || 12);
    setBlock(ex, getTerrainHeight(ex, ez), ez, BLOCK.AIR);
    setBlock(ex, getTerrainHeight(ex, ez) - 1, ez, BLOCK.AIR);
  }

  function generateCollapsedBridge(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Two intact bridge supports (concrete pillars)
    for (let y = 0; y < 6; y++) {
      for (let dz = -1; dz <= 1; dz++) {
        setBlock(ox - 6, surfH + y, oz + dz, BLOCK.CONCRETE);
        setBlock(ox + 6, surfH + y, oz + dz, BLOCK.CONCRETE);
      }
    }
    // Collapsed middle section — rubble spanning the gap
    for (let x = -5; x <= 5; x++) {
      for (let dz = -2; dz <= 2; dz++) {
        // Sagging middle: higher near supports, lower in center
        const height = Math.max(1, 5 - Math.abs(x) * 0.6);
        for (let y = 0; y < height; y++) {
          const block = y === 0 ? BLOCK.RUBBLE : (Math.random() < 0.4 ? BLOCK.RUBBLE : BLOCK.CONCRETE);
          setBlock(ox + x, surfH + y, oz + dz, block);
        }
      }
    }
    // Rebar sticking out (metal blocks)
    setBlock(ox - 3, surfH + 3, oz, BLOCK.METAL);
    setBlock(ox + 2, surfH + 4, oz, BLOCK.METAL);
    setBlock(ox, surfH + 2, oz - 1, BLOCK.METAL);
    // Debris around base
    for (let i = 0; i < 6; i++) {
      const rx = ox + Math.floor((Math.random() - 0.5) * 14);
      const rz = oz + Math.floor((Math.random() - 0.5) * 6);
      const rh = getTerrainHeight(rx, rz);
      setBlock(rx, rh + 1, rz, BLOCK.RUBBLE);
    }
  }

  function generateFuelDepot(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Concrete pad
    for (let x = -3; x <= 3; x++) {
      for (let z = -2; z <= 2; z++) {
        setBlock(ox + x, surfH, oz + z, BLOCK.CONCRETE);
      }
    }
    // Fuel barrel clusters (orange blocks)
    for (let x = -2; x <= 2; x += 2) {
      for (let z = -1; z <= 1; z++) {
        setBlock(ox + x, surfH + 1, oz + z, BLOCK.FUEL_BARREL);
        if (Math.random() < 0.5) setBlock(ox + x, surfH + 2, oz + z, BLOCK.FUEL_BARREL);
      }
    }
    // Metal roof cover
    for (let x = -3; x <= 3; x++) {
      for (let z = -2; z <= 2; z++) {
        setBlock(ox + x, surfH + 4, oz + z, BLOCK.METAL);
      }
    }
    // Support pillars
    setBlock(ox - 3, surfH + 1, oz - 2, BLOCK.METAL);
    setBlock(ox - 3, surfH + 2, oz - 2, BLOCK.METAL);
    setBlock(ox - 3, surfH + 3, oz - 2, BLOCK.METAL);
    setBlock(ox + 3, surfH + 1, oz + 2, BLOCK.METAL);
    setBlock(ox + 3, surfH + 2, oz + 2, BLOCK.METAL);
    setBlock(ox + 3, surfH + 3, oz + 2, BLOCK.METAL);
    setBlock(ox + 3, surfH + 1, oz - 2, BLOCK.METAL);
    setBlock(ox + 3, surfH + 2, oz - 2, BLOCK.METAL);
    setBlock(ox + 3, surfH + 3, oz - 2, BLOCK.METAL);
    setBlock(ox - 3, surfH + 1, oz + 2, BLOCK.METAL);
    setBlock(ox - 3, surfH + 2, oz + 2, BLOCK.METAL);
    setBlock(ox - 3, surfH + 3, oz + 2, BLOCK.METAL);
    // Warning sign (fence block)
    setBlock(ox, surfH + 1, oz - 3, BLOCK.FENCE);
    setBlock(ox, surfH + 2, oz - 3, BLOCK.FENCE);
  }

  function generateArtilleryBattery(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // 3 gun emplacements in a line
    for (let gun = 0; gun < 3; gun++) {
      const gx = ox + gun * 6;
      const gz = oz;
      // Circular pit
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (dx * dx + dz * dz <= 5) {
            setBlock(gx + dx, surfH, gz + dz, BLOCK.DIRT);
          }
        }
      }
      // Sandbag wall around pit
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const d = dx * dx + dz * dz;
          if (d >= 7 && d <= 10) {
            setBlock(gx + dx, surfH + 1, gz + dz, BLOCK.SANDBAG);
          }
        }
      }
      // Gun barrel (metal stack)
      setBlock(gx, surfH + 1, gz, BLOCK.METAL);
      setBlock(gx, surfH + 2, gz, BLOCK.METAL);
      setBlock(gx + 1, surfH + 2, gz, BLOCK.METAL);
      setBlock(gx + 2, surfH + 2, gz, BLOCK.METAL);
    }
    // Ammo crates behind guns
    for (let c = 0; c < 3; c++) {
      setBlock(ox + c * 6, surfH + 1, oz + 4, BLOCK.CRATE);
      setBlock(ox + c * 6 + 1, surfH + 1, oz + 4, BLOCK.CRATE);
    }
  }

  function generateRadarTower(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Square concrete base
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        setBlock(ox + x, surfH + 1, oz + z, BLOCK.CONCRETE);
      }
    }
    // Steel tower (4 legs)
    for (let y = 2; y < 12; y++) {
      setBlock(ox - 1, surfH + y, oz - 1, BLOCK.METAL);
      setBlock(ox + 1, surfH + y, oz - 1, BLOCK.METAL);
      setBlock(ox - 1, surfH + y, oz + 1, BLOCK.METAL);
      setBlock(ox + 1, surfH + y, oz + 1, BLOCK.METAL);
    }
    // Cross-bracing every 3 levels
    for (let y = 4; y < 12; y += 3) {
      setBlock(ox, surfH + y, oz - 1, BLOCK.METAL);
      setBlock(ox, surfH + y, oz + 1, BLOCK.METAL);
      setBlock(ox - 1, surfH + y, oz, BLOCK.METAL);
      setBlock(ox + 1, surfH + y, oz, BLOCK.METAL);
    }
    // Radar platform at top
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        setBlock(ox + x, surfH + 12, oz + z, BLOCK.METAL);
      }
    }
    // Radar dish (electronics blocks)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        setBlock(ox + dx, surfH + 13, oz + dz, BLOCK.ELECTRONICS);
      }
    }
    setBlock(ox, surfH + 14, oz, BLOCK.ELECTRONICS);
    // Railing
    for (let x = -2; x <= 2; x++) {
      setBlock(ox + x, surfH + 13, oz - 2, BLOCK.FENCE);
      setBlock(ox + x, surfH + 13, oz + 2, BLOCK.FENCE);
    }
    for (let z = -2; z <= 2; z++) {
      setBlock(ox - 2, surfH + 13, oz + z, BLOCK.FENCE);
      setBlock(ox + 2, surfH + 13, oz + z, BLOCK.FENCE);
    }
  }

  /* ── Military Structure Generators ────────────────────────────── */

  function generateBunker(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // Dig out 6x6 underground room, 4 blocks deep
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 6; z++) {
        for (let d = 1; d <= 4; d++) {
          setBlock(cx + x, surfH - d, cz + z, BLOCK.AIR);
        }
        // Concrete walls (perimeter only)
        if (x === 0 || x === 5 || z === 0 || z === 5) {
          for (let d = 1; d <= 4; d++) {
            setBlock(cx + x, surfH - d, cz + z, BLOCK.CONCRETE);
          }
        }
        // Concrete floor
        setBlock(cx + x, surfH - 4, cz + z, BLOCK.CONCRETE);
        // Reinforced roof at surface level
        setBlock(cx + x, surfH, cz + z, BLOCK.REINFORCED);
      }
    }
    // Entry ramp on the south side (z=0), dirt steps going down
    for (let s = 0; s < 4; s++) {
      setBlock(cx + 2, surfH - s, cz - 1 - s, BLOCK.DIRT);
      setBlock(cx + 3, surfH - s, cz - 1 - s, BLOCK.DIRT);
      setBlock(cx + 2, surfH - s + 1, cz - 1 - s, BLOCK.AIR);
      setBlock(cx + 3, surfH - s + 1, cz - 1 - s, BLOCK.AIR);
    }
    // Interior: crate for ammo, metal table
    setBlock(cx + 2, surfH - 3, cz + 2, BLOCK.CRATE);
    setBlock(cx + 3, surfH - 3, cz + 4, BLOCK.METAL);
  }

  function generateMGNest(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // Concrete floor 5x3
    for (let x = -2; x <= 2; x++) {
      for (let z = -1; z <= 1; z++) {
        setBlock(cx + x, surfH, cz + z, BLOCK.CONCRETE);
      }
    }
    // Semi-circle of sandbags on the front and sides, 3 blocks tall
    for (let angle = -Math.PI / 2; angle <= Math.PI / 2; angle += 0.35) {
      const bx = cx + Math.round(Math.cos(angle) * 2.5);
      const bz = cz + Math.round(Math.sin(angle) * 2.5);
      for (let y = 1; y <= 3; y++) {
        setBlock(bx, surfH + y, bz, BLOCK.SANDBAG);
      }
    }
    // Metal "gun" in center: metal on metal
    setBlock(cx, surfH + 1, cz, BLOCK.METAL);
    setBlock(cx, surfH + 2, cz, BLOCK.METAL);
  }

  function generateFoxhole(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // 2x2 hole, 2 blocks deep
    for (let x = 0; x < 2; x++) {
      for (let z = 0; z < 2; z++) {
        setBlock(cx + x, surfH, cz + z, BLOCK.AIR);
        setBlock(cx + x, surfH - 1, cz + z, BLOCK.AIR);
        setBlock(cx + x, surfH - 2, cz + z, BLOCK.DIRT);
      }
    }
    // Sandbag rim on 3 sides (north, east, west — south open as entrance)
    for (let x = -1; x <= 2; x++) {
      setBlock(cx + x, surfH, cz + 2, BLOCK.SANDBAG);
      setBlock(cx + x, surfH + 1, cz + 2, BLOCK.SANDBAG);
    }
    for (let z = -1; z <= 2; z++) {
      setBlock(cx - 1, surfH, cz + z, BLOCK.SANDBAG);
      setBlock(cx + 2, surfH, cz + z, BLOCK.SANDBAG);
      setBlock(cx - 1, surfH + 1, cz + z, BLOCK.SANDBAG);
      setBlock(cx + 2, surfH + 1, cz + z, BLOCK.SANDBAG);
    }
  }

  function generateMinefield(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // 8x8 dirt area with scattered mine markers (FUEL_BARREL)
    for (let x = 0; x < 8; x++) {
      for (let z = 0; z < 8; z++) {
        setBlock(cx + x, surfH, cz + z, BLOCK.DIRT);
        // Scatter mines roughly every 3rd cell with some randomness
        if ((x + z) % 3 === 0 && Math.random() > 0.4) {
          setBlock(cx + x, surfH + 1, cz + z, BLOCK.FUEL_BARREL);
        }
      }
    }
    // Warning sign: FENCE post with CRATE on top at corner
    setBlock(cx - 1, surfH + 1, cz - 1, BLOCK.FENCE);
    setBlock(cx - 1, surfH + 2, cz - 1, BLOCK.FENCE);
    setBlock(cx - 1, surfH + 3, cz - 1, BLOCK.CRATE);
  }

  function generateFieldHospitalTent(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // 6x4 wood frame
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 4; z++) {
        setBlock(cx + x, surfH, cz + z, BLOCK.CONCRETE);
      }
    }
    // Corner posts
    for (let y = 1; y <= 3; y++) {
      setBlock(cx, surfH + y, cz, BLOCK.WOOD);
      setBlock(cx + 5, surfH + y, cz, BLOCK.WOOD);
      setBlock(cx, surfH + y, cz + 3, BLOCK.WOOD);
      setBlock(cx + 5, surfH + y, cz + 3, BLOCK.WOOD);
    }
    // GLASS "tent" roof
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 4; z++) {
        setBlock(cx + x, surfH + 3, cz + z, BLOCK.GLASS);
      }
    }
    // Interior: 2 CRATE beds
    setBlock(cx + 1, surfH + 1, cz + 1, BLOCK.CRATE);
    setBlock(cx + 2, surfH + 1, cz + 1, BLOCK.CRATE);
    setBlock(cx + 1, surfH + 1, cz + 2, BLOCK.CRATE);
    setBlock(cx + 2, surfH + 1, cz + 2, BLOCK.CRATE);
    // ELECTRONICS medical equipment
    setBlock(cx + 4, surfH + 1, cz + 1, BLOCK.ELECTRONICS);
    setBlock(cx + 4, surfH + 1, cz + 2, BLOCK.ELECTRONICS);
    // Red cross on front wall using BRICK blocks (cross pattern)
    setBlock(cx + 3, surfH + 2, cz, BLOCK.BRICK);
    setBlock(cx + 2, surfH + 1, cz, BLOCK.BRICK);
    setBlock(cx + 3, surfH + 1, cz, BLOCK.BRICK);
    setBlock(cx + 4, surfH + 1, cz, BLOCK.BRICK);
  }

  function generateCommandPost(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // 5x5 reinforced walls, 3 high
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 5; z++) {
        if (x === 0 || x === 4 || z === 0 || z === 4) {
          for (let y = 1; y <= 3; y++) {
            setBlock(cx + x, surfH + y, cz + z, BLOCK.REINFORCED);
          }
        }
        // Flat concrete roof
        setBlock(cx + x, surfH + 4, cz + z, BLOCK.CONCRETE);
      }
    }
    // Door
    setBlock(cx + 2, surfH + 1, cz, BLOCK.AIR);
    setBlock(cx + 2, surfH + 2, cz, BLOCK.AIR);
    // Antenna: metal pole 3 high on roof
    for (let y = 5; y <= 7; y++) {
      setBlock(cx + 2, surfH + y, cz + 2, BLOCK.METAL);
    }
    // Interior: ELECTRONICS (radio), CRATE (maps table)
    setBlock(cx + 1, surfH + 1, cz + 3, BLOCK.ELECTRONICS);
    setBlock(cx + 3, surfH + 1, cz + 3, BLOCK.CRATE);
    // Sandbag perimeter 2 blocks out
    for (let x = -2; x <= 6; x++) {
      setBlock(cx + x, surfH, cz - 2, BLOCK.SANDBAG);
      setBlock(cx + x, surfH + 1, cz - 2, BLOCK.SANDBAG);
      setBlock(cx + x, surfH, cz + 6, BLOCK.SANDBAG);
      setBlock(cx + x, surfH + 1, cz + 6, BLOCK.SANDBAG);
    }
    for (let z = -1; z <= 5; z++) {
      setBlock(cx - 2, surfH, cz + z, BLOCK.SANDBAG);
      setBlock(cx - 2, surfH + 1, cz + z, BLOCK.SANDBAG);
      setBlock(cx + 6, surfH, cz + z, BLOCK.SANDBAG);
      setBlock(cx + 6, surfH + 1, cz + z, BLOCK.SANDBAG);
    }
  }

  function generateAntiAirPosition(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // Circular sandbag wall (radius 3)
    for (let angle = 0; angle < Math.PI * 2; angle += 0.35) {
      const bx = cx + Math.round(Math.cos(angle) * 3);
      const bz = cz + Math.round(Math.sin(angle) * 3);
      setBlock(bx, surfH + 1, bz, BLOCK.SANDBAG);
      setBlock(bx, surfH + 2, bz, BLOCK.SANDBAG);
    }
    // Central metal pedestal 2 high
    setBlock(cx, surfH + 1, cz, BLOCK.METAL);
    setBlock(cx, surfH + 2, cz, BLOCK.METAL);
    // "Gun barrel" = metal blocks extending up and out at angle
    setBlock(cx, surfH + 3, cz, BLOCK.METAL);
    setBlock(cx, surfH + 4, cz - 1, BLOCK.METAL);
    setBlock(cx, surfH + 5, cz - 2, BLOCK.METAL);
  }

  function generateAmmoDumpBerm(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // 4x4 earthen berm: dirt walls 2 high around
    for (let x = 0; x < 4; x++) {
      for (let z = 0; z < 4; z++) {
        if (x === 0 || x === 3 || z === 0 || z === 3) {
          setBlock(cx + x, surfH + 1, cz + z, BLOCK.DIRT);
          setBlock(cx + x, surfH + 2, cz + z, BLOCK.DIRT);
        }
      }
    }
    // Interior filled with CRATE blocks
    for (let x = 1; x <= 2; x++) {
      for (let z = 1; z <= 2; z++) {
        setBlock(cx + x, surfH + 1, cz + z, BLOCK.CRATE);
        setBlock(cx + x, surfH + 2, cz + z, BLOCK.CRATE);
      }
    }
    // METAL roof
    for (let x = 0; x < 4; x++) {
      for (let z = 0; z < 4; z++) {
        setBlock(cx + x, surfH + 3, cz + z, BLOCK.METAL);
      }
    }
  }

  function generateObservationPost(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // 4 WOOD corner posts going up 8 blocks
    for (let y = 1; y <= 8; y++) {
      setBlock(cx, surfH + y, cz, BLOCK.WOOD);
      setBlock(cx + 2, surfH + y, cz, BLOCK.WOOD);
      setBlock(cx, surfH + y, cz + 2, BLOCK.WOOD);
      setBlock(cx + 2, surfH + y, cz + 2, BLOCK.WOOD);
    }
    // Platform at top (wood floor 3x3)
    for (let x = 0; x <= 2; x++) {
      for (let z = 0; z <= 2; z++) {
        setBlock(cx + x, surfH + 8, cz + z, BLOCK.WOOD);
      }
    }
    // FENCE railing
    for (let x = 0; x <= 2; x++) {
      setBlock(cx + x, surfH + 9, cz, BLOCK.FENCE);
      setBlock(cx + x, surfH + 9, cz + 2, BLOCK.FENCE);
    }
    for (let z = 0; z <= 2; z++) {
      setBlock(cx, surfH + 9, cz + z, BLOCK.FENCE);
      setBlock(cx + 2, surfH + 9, cz + z, BLOCK.FENCE);
    }
    // Ladder: METAL blocks on one side going up
    for (let y = 1; y <= 8; y++) {
      setBlock(cx - 1, surfH + y, cz, BLOCK.METAL);
    }
  }

  function generateDestroyedTank(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // 5x3x2 hull of METAL blocks
    for (let x = 0; x < 5; x++) {
      for (let z = 0; z < 3; z++) {
        setBlock(cx + x, surfH + 1, cz + z, BLOCK.METAL);
        setBlock(cx + x, surfH + 2, cz + z, BLOCK.METAL);
      }
    }
    // Turret: 2x2 METAL on top
    setBlock(cx + 2, surfH + 3, cz, BLOCK.METAL);
    setBlock(cx + 3, surfH + 3, cz, BLOCK.METAL);
    setBlock(cx + 2, surfH + 3, cz + 1, BLOCK.METAL);
    setBlock(cx + 3, surfH + 3, cz + 1, BLOCK.METAL);
    // Angled "barrel" extending forward
    setBlock(cx + 4, surfH + 3, cz, BLOCK.METAL);
    setBlock(cx + 5, surfH + 4, cz, BLOCK.METAL);
    // Damaged: remove random blocks from hull
    for (let i = 0; i < 3; i++) {
      const rx = cx + Math.floor(Math.random() * 5);
      const rz = cz + Math.floor(Math.random() * 3);
      setBlock(rx, surfH + 2, rz, BLOCK.AIR);
    }
    // Add RUBBLE around
    for (let i = 0; i < 6; i++) {
      const rx = cx - 1 + Math.floor(Math.random() * 7);
      const rz = cz - 1 + Math.floor(Math.random() * 5);
      setBlock(rx, surfH, rz, BLOCK.RUBBLE);
    }
    // Burning: FUEL_BARREL block inside
    setBlock(cx + 2, surfH + 2, cz + 1, BLOCK.FUEL_BARREL);
  }

  function generateTrenchNetwork(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // Z-shaped trench, 2 blocks deep, 2 wide
    // Segment 1: east-west
    for (let x = 0; x < 8; x++) {
      for (let w = 0; w < 2; w++) {
        setBlock(cx + x, surfH, cz + w, BLOCK.AIR);
        setBlock(cx + x, surfH - 1, cz + w, BLOCK.AIR);
        setBlock(cx + x, surfH - 2, cz + w, BLOCK.DIRT);
        // Occasional wooden duckboard floor
        if (x % 3 === 0) setBlock(cx + x, surfH - 2, cz + w, BLOCK.WOOD);
      }
      // Sandbag parapets on top edges
      setBlock(cx + x, surfH + 1, cz - 1, BLOCK.SANDBAG);
      setBlock(cx + x, surfH + 1, cz + 2, BLOCK.SANDBAG);
    }
    // Segment 2: diagonal connector (north-south)
    for (let z = 2; z < 8; z++) {
      for (let w = 0; w < 2; w++) {
        setBlock(cx + 7 + w, surfH, cz + z, BLOCK.AIR);
        setBlock(cx + 7 + w, surfH - 1, cz + z, BLOCK.AIR);
        setBlock(cx + 7 + w, surfH - 2, cz + z, BLOCK.DIRT);
        if (z % 3 === 0) setBlock(cx + 7 + w, surfH - 2, cz + z, BLOCK.WOOD);
      }
      setBlock(cx + 6, surfH + 1, cz + z, BLOCK.SANDBAG);
      setBlock(cx + 9, surfH + 1, cz + z, BLOCK.SANDBAG);
    }
    // Segment 3: east-west return
    for (let x = 0; x < 8; x++) {
      for (let w = 0; w < 2; w++) {
        setBlock(cx + x, surfH, cz + 8 + w, BLOCK.AIR);
        setBlock(cx + x, surfH - 1, cz + 8 + w, BLOCK.AIR);
        setBlock(cx + x, surfH - 2, cz + 8 + w, BLOCK.DIRT);
        if (x % 3 === 0) setBlock(cx + x, surfH - 2, cz + 8 + w, BLOCK.WOOD);
      }
      setBlock(cx + x, surfH + 1, cz + 7, BLOCK.SANDBAG);
      setBlock(cx + x, surfH + 1, cz + 10, BLOCK.SANDBAG);
    }
  }

  function generateRazorWireField(cx, cz) {
    const surfH = getTerrainHeight(cx, cz);
    // 10x3 area of FENCE blocks at ground+1 level, spaced every other block
    for (let x = 0; x < 10; x++) {
      for (let z = 0; z < 3; z++) {
        if ((x + z) % 2 === 0) {
          setBlock(cx + x, surfH + 1, cz + z, BLOCK.FENCE);
        }
      }
    }
  }

  /* ── Level Generation ──────────────────────────────────────────── */
  function generateLevel(index) {
    const level = getLevelDef(index);
    setTheme(level.theme);
    _theme.seed = index * 3137;

    // Clear and regenerate base terrain
    for (const chunk of chunks.values()) {
      if (chunk.mesh && _scene) {
        _scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh.material.dispose();
        chunk.mesh = null;
      }
    }
    chunks.clear();

    for (let cx = -HALF; cx < HALF; cx++) {
      for (let cz = -HALF; cz < HALF; cz++) {
        const chunk = createChunk(cx, cz);
        generateChunkTerrain(chunk);
      }
    }

    // Level-specific features — historically accurate terrain for each battle
    switch (level.id) {
      case 'HOSTOMEL':
        // Battle of Hostomel Airport, Feb 24-25, 2022
        // VDV airborne assault on Antonov Airport
        // ── Road network: airport access roads based on real Hostomel layout ──
        _roadWaypoints.length = 0;
        generateRoadNetwork([
          // Main E40 highway (east-west through Hostomel, south of airport)
          [-45, 20, 45, 20, 4],
          // Airport access road (north from highway to terminal)
          [0, 20, 0, -5, 3],
          // Perimeter road around airport (north side)
          [-35, -8, 35, -8, 3],
          // Taxiway parallel to runway
          [-30, 2, 30, 2, 2],
          // Side road to hangars (west)
          [-25, 20, -25, -10, 2],
          // Side road to eastern positions
          [25, 20, 25, -15, 2],
        ]);
        generateRunway(-30, -3, 60, 6);
        generateBuilding(-10, 10, 12, 8, 4, BLOCK.CONCRETE);  // terminal
        generateControlTower(15, 10);
        generateBuilding(-25, -10, 10, 8, 5, BLOCK.METAL);    // hangar 1
        generateBuilding(20, -10, 10, 8, 5, BLOCK.METAL);     // hangar 2
        generateTrenches();
        generateDugouts(2);
        generateDefensivePosition(-18, 15);
        generateDefensivePosition(25, -15);
        generateDestroyedVehicles(5);       // IDEA 4: destroyed Russian vehicles on runway
        generateAntiTankHedgehogs(8);       // IDEA 11: Ukrainian defenses
        generateCheckpoint(-5, 0, true);    // IDEA 9: airport checkpoint
        generateFlagPole(0, 12);            // IDEA 18: Ukrainian flag at terminal
        generateBarbedWire(-25, 5, 30, true); // IDEA 10: perimeter wire
        generateFieldHospital(30, 5);       // IDEA 13: medical station
        generateWatchtower(-15, -18);       // NEW: observation watchtower
        generateMortarPit(18, 18);          // NEW: mortar position
        generateAmmoCache(-28, 12);         // NEW: ammo crate storage
        generateSupplyTent(25, 18);         // NEW: supply tent
        generateRazorWireMaze(-35, -10, 4); // NEW: razor wire obstacle
        generateUndergroundTunnel(-20, -5, 10); // NEW R2: tunnel under runway
        generateFuelDepot(20, -15);             // NEW R2: airport fuel storage
        generateRadarTower(-30, 5);             // NEW R2: radar tower
        generateBunker(20, 20);                     // NEW R3: underground bunker
        generateMGNest(-15, 25);                    // NEW R3: MG nest position
        generateFoxhole(30, -10);                   // NEW R3: fighting position
        generateFieldHospitalTent(-25, -20);        // NEW R3: medical tent
        generateObservationPost(35, 15);            // NEW R3: lookout tower
        scatterResources(BLOCK.WOOD, 0.003);
        break;

      case 'AVDIIVKA':
        // Battle of Avdiivka, Oct 2023 - Feb 2024
        // Industrial zone centered on the coking plant, Soviet apartment blocks,
        // dense trench networks, constant shelling creating massive crater fields
        // ── Road network: Avdiivka's real industrial roads ──
        _roadWaypoints.length = 0;
        generateRoadNetwork([
          // Main M04 highway (north-south through Avdiivka)
          [0, -45, 0, 45, 4],
          // Industrial access road to coking plant (east-west)
          [-40, 0, 40, 0, 3],
          // Residential street grid (east side)
          [15, -30, 15, 30, 2],
          [30, -30, 30, 30, 2],
          [15, -15, 30, -15, 2],
          [15, 15, 30, 15, 2],
          // Railway crossing road
          [-35, -20, -10, -20, 2],
          // Southern approach road
          [-20, 35, 20, 35, 3],
        ]);
        generateIndustrialComplex(-15, -10);  // IDEA 2: Avdiivka Coking Plant (main objective)
        generateApartmentBlock(-35, 10, 7);   // IDEA 1: Soviet 7-story apartment block
        generateApartmentBlock(-35, 25, 5);   // IDEA 1: Another apartment block
        generateApartmentBlock(25, -20, 9);   // IDEA 1: Tall apartment block (eastern front)
        generateApartmentBlock(30, 10, 6);    // IDEA 1: Apartment block near plant
        generateRailway(-40, 0, 80, true);    // IDEA 3: Railway through industrial zone
        generateCraters(35);                  // Heavy shelling — more craters than before
        generateTrenches();                   // Triple trench network
        generateTrenches();
        generateTrenches();
        generateBrokenTrees(45);              // Almost no trees survive the shelling
        generateRuins(12);                    // Many destroyed buildings
        generateDugouts(6);                   // Underground positions critical for survival
        generateDefensivePosition(-25, 10);
        generateDefensivePosition(15, -20);
        generateDefensivePosition(0, 25);
        generateDefensivePosition(-10, -30);
        generateDestroyedVehicles(12);        // IDEA 4: Destroyed Russian armor everywhere
        generateAntiTankHedgehogs(15);        // IDEA 11: Anti-tank obstacles on approaches
        generatePowerLines(-40, -25, 5);      // IDEA 5: Damaged power infrastructure
        generateCheckpoint(10, 0, true);      // IDEA 9: Ukrainian checkpoint
        generateAmmoDepot(-30, -25);          // IDEA 12: Ammunition storage
        generateUndergroundBunker(5, -15);    // IDEA 15: Underground command post
        generateSniperNest(-20, 30);          // IDEA 23: Sniper position in ruins
        generateSniperNest(20, -30);          // IDEA 23: Second sniper nest
        generateBarbedWire(-30, -15, 40, true); // IDEA 10: Defensive perimeter
        generateBarbedWire(20, -25, 30, false); // IDEA 10: Eastern approach wire
        generateCommTower(35, 0);             // IDEA 14: Military communications
        generateBurningRuin(-8, -25);         // IDEA 25: Recently shelled building
        generateBurningRuin(15, 20);          // IDEA 25: Another burning ruin
        generateBillboard(-20, 0);            // IDEA 19: Billboard sign
        generateMinefieldSigns(4);            // IDEA 22: Minefields around approaches
        generateFlagPole(0, 0);               // IDEA 18: Ukrainian flag at center
        generateMortarPit(-25, 20);           // NEW: mortar pit near apartments
        generateMortarPit(30, -15);           // NEW: second mortar position
        generateWatchtower(35, 25);           // NEW: observation tower
        generateAmmoCache(-5, 30);            // NEW: ammo storage
        generateAmmoCache(25, -25);           // NEW: second ammo cache
        generateSupplyTent(-35, -5);          // NEW: supply tent
        generateRazorWireMaze(-15, 25, 6);    // NEW: razor wire defensive maze
        generateUndergroundTunnel(-30, -10, 14); // NEW R2: underground tunnel
        generateCollapsedBridge(0, -35);         // NEW R2: collapsed overpass
        generateFuelDepot(-25, -30);             // NEW R2: fuel depot
        generateArtilleryBattery(30, 30);        // NEW R2: artillery position
        generateRadarTower(-35, 20);             // NEW R2: radar tower
        generateBunker(-20, 15);                    // NEW R3: underground bunker
        generateCommandPost(25, -20);               // NEW R3: fortified command center
        generateAmmoDumpBerm(-30, 10);              // NEW R3: ammo storage berm
        generateDestroyedTank(15, 30);              // NEW R3: wrecked tank hull
        generateTrenchNetwork(-10, -25);            // NEW R3: zig-zag trench system
        // Heavy rubble scatter (coking plant battle damage)
        for (let rb = 0; rb < 80; rb++) {
          const rx = randInWorld(), rz = randInWorld();
          const rh = getTerrainHeight(rx, rz);
          if (rh > 1) setBlock(rx, rh, rz, BLOCK.RUBBLE);
        }
        break;

      case 'BAKHMUT':
        // Battle of Bakhmut (Artyomovsk), Aug 2022 - May 2023
        // Total urban devastation, Wagner PMC wave attacks,
        // salt mines (Soledar nearby), every building destroyed
        // ── Road network: Bakhmut's devastated urban roads ──
        _roadWaypoints.length = 0;
        generateRoadNetwork([
          // T0504 highway (main east-west road through Bakhmut)
          [-45, 0, 45, 0, 4],
          // M03 highway (north-south arterial)
          [0, -45, 0, 45, 4],
          // Chasiv Yar road (western approach)
          [-45, -15, -10, -15, 3],
          // Soledar road (northeast approach to salt mines)
          [10, 10, 40, 40, 3],
          // Inner city ring road
          [-20, -20, 20, -20, 2],
          [20, -20, 20, 20, 2],
          [-20, 20, 20, 20, 2],
          [-20, -20, -20, 20, 2],
          // Southern residential streets
          [-15, -35, 15, -35, 2],
          [0, -35, 0, -20, 2],
        ]);
        generateStreetGrid(-30, -30, 5, 5, 6); // Dense urban grid
        generateStreetGrid(5, 5, 3, 3, 8);     // Additional city blocks
        generateRuins(25);                      // Massive destruction
        generateCraters(20);                    // Heavy shelling
        generateBrokenTrees(10);                // Almost no vegetation
        generateTrenches();                     // Triple trench network around city
        generateTrenches();
        generateTrenches();
        generateDugouts(6);                     // Underground fighting positions
        generateDefensivePosition(-20, 20);
        generateDefensivePosition(20, -20);
        generateDefensivePosition(-30, -10);
        generateDefensivePosition(30, 10);
        generateSaltMine(-25, 25);              // IDEA 7: Salt mine entrance (Soledar connection)
        generateSaltMine(30, -25);              // IDEA 7: Second mine entrance
        generateDestroyedVehicles(15);          // IDEA 4: Destroyed vehicles everywhere
        generateSniperNest(-15, -15);           // IDEA 23: Sniper positions in ruins
        generateSniperNest(15, 15);             // IDEA 23: Another sniper nest
        generateSniperNest(-25, 10);            // IDEA 23: Third sniper nest
        generateUndergroundBunker(-10, -20);    // IDEA 15: Underground command bunker
        generateUndergroundBunker(15, 10);      // IDEA 15: Second bunker
        generateAmmoDepot(25, 0);               // IDEA 12: Ammo depot
        generateFieldHospital(-30, 0);          // IDEA 13: Field hospital
        generateCommTower(0, 30);               // IDEA 14: Communications tower
        generateAntiTankHedgehogs(12);          // IDEA 11: Anti-tank obstacles
        generateBarbedWire(-25, -20, 50, true); // IDEA 10: Wire barriers
        generateBarbedWire(20, -30, 40, false); // IDEA 10: More wire
        generateBurningRuin(-10, 10);           // IDEA 25: Burning buildings
        generateBurningRuin(10, -10);           // IDEA 25: More burning
        generateBurningRuin(-5, -30);           // IDEA 25: More burning
        generateEvacVehicles(4);                // IDEA 21: Abandoned civilian vehicles
        generateMinefieldSigns(6);              // IDEA 22: Minefields
        generateChurch(0, -20);                 // IDEA 20: Damaged church
        generateBillboard(-15, 5);              // IDEA 19: Billboard
        generateFlagPole(0, 0);                 // IDEA 18: Ukrainian flag at center
        generatePowerLines(-35, 15, 4);         // IDEA 5: Destroyed power lines
        generateMortarPit(-20, -25);            // NEW: mortar in ruins
        generateMortarPit(25, 20);              // NEW: mortar in city
        generateWatchtower(-30, -30);           // NEW: watchtower on perimeter
        generateAmmoCache(10, 25);              // NEW: ammo in building
        generateAmmoCache(-25, -15);            // NEW: hidden ammo cache
        generateSupplyTent(30, -20);            // NEW: supply tent
        generateRazorWireMaze(-10, -35, 8);     // NEW: heavy razor wire maze
        generateRazorWireMaze(15, 25, 5);       // NEW: more razor wire
        generateUndergroundTunnel(-20, -20, 16); // NEW R2: tunnel system
        generateUndergroundTunnel(10, 15, 12);   // NEW R2: second tunnel
        generateCollapsedBridge(-25, 0);         // NEW R2: collapsed bridge
        generateFuelDepot(20, -25);              // NEW R2: fuel storage
        generateArtilleryBattery(-30, 30);       // NEW R2: artillery battery
        generateRadarTower(30, 30);              // NEW R2: radar installation
        generateBunker(10, -30);                    // NEW R3: underground bunker
        generateMGNest(25, 20);                     // NEW R3: MG nest position
        generateAntiAirPosition(-20, -15);          // NEW R3: AA emplacement
        generateRazorWireField(30, -25);            // NEW R3: razor wire obstacle
        generateFieldHospitalTent(-30, 25);         // NEW R3: medical tent
        // Extra rubble — city is total devastation
        for (let rb2 = 0; rb2 < 100; rb2++) {
          const rx2 = randInWorld(), rz2 = randInWorld();
          const rh2 = getTerrainHeight(rx2, rz2);
          if (rh2 > 1) setBlock(rx2, rh2, rz2, BLOCK.RUBBLE);
        }
        break;

      case 'KHERSON':
        // Kherson counteroffensive, Aug-Nov 2022
        // Flat agricultural terrain, Dnipro River crossing,
        // Antonivskyi Bridge, farmland, liberation theme
        // ── Road network: Kherson's real roads to Antonivskyi Bridge ──
        _roadWaypoints.length = 0;
        generateRoadNetwork([
          // M14 highway (main approach road to Antonivskyi Bridge, east-west)
          [-45, -5, 45, -5, 4],
          // Antonivskyi Bridge approach road (north-south to bridge)
          [-10, -30, -10, 10, 3],
          // Farm access road (western agricultural area)
          [-40, -25, -40, 25, 2],
          // Eastern rural road
          [30, -30, 30, 30, 2],
          // Southern perimeter road
          [-30, -35, 30, -35, 2],
          // Northern riverside road
          [-30, 25, 30, 25, 2],
          // Cross-road connecting farms
          [-40, 0, -10, 0, 2],
        ]);
        generateRiver(-5, 12);                  // Wide Dnipro River (wider than before)
        generateRiver(5, 8);                    // Second river channel (delta islands)
        generateFortifiedBridge(-10, -2, 24, 5); // IDEA 16: Fortified Antonivskyi Bridge
        generateMarsh(8);                       // Wetlands near river
        generateDefensivePosition(-20, -15);
        generateDefensivePosition(20, 15);
        generateDefensivePosition(-15, 20);
        generateDefensivePosition(10, -25);
        generateTrenches();
        generateTrenches();
        generateDugouts(4);
        generateGrainSilo(-30, -20);            // IDEA 6: Agricultural grain silos
        generateGrainSilo(25, -15);             // IDEA 6: Second silo
        generateFarmBuilding(-25, 15);          // IDEA 24: Farm buildings
        generateFarmBuilding(20, -30);          // IDEA 24: Second farm
        generateCropFields(-20, -35, 15, 10);   // IDEA 17: Agricultural fields
        generateCropFields(15, 25, 12, 8);      // IDEA 17: More fields
        generateCropFields(-35, -10, 10, 15);   // IDEA 17: Fields near river
        generateCheckpoint(-8, -10, true);      // IDEA 9: Ukrainian checkpoint
        generateCheckpoint(15, 5, false);       // IDEA 9: Another checkpoint
        generateDestroyedVehicles(8);           // IDEA 4: Destroyed vehicles at crossing
        generateAntiTankHedgehogs(10);          // IDEA 11: Bridge defenses
        generateBarbedWire(-20, -5, 40, true);  // IDEA 10: Wire along riverbank
        generateWaterTower(-30, 5);             // IDEA 8: Water tower
        generateWaterTower(30, -10);            // IDEA 8: Second water tower
        generateFieldHospital(25, 20);          // IDEA 13: Medical station
        generateAmmoDepot(-30, -30);            // IDEA 12: Supply depot
        generateBillboard(10, -20);             // IDEA 19: Billboard
        generateFlagPole(0, 0);                 // IDEA 18: Ukrainian flag (liberation!)
        generateFlagPole(-15, 15);              // IDEA 18: Flag at checkpoint
        generateFlagPole(20, -20);              // IDEA 18: Flag at farm
        generateChurch(30, 25);                 // IDEA 20: Village church
        generateEvacVehicles(3);                // IDEA 21: Civilian evacuation vehicles
        generateMinefieldSigns(5);              // IDEA 22: Russian minefields
        generatePowerLines(-35, -30, 4);        // IDEA 5: Power infrastructure
        generateBrokenTrees(15);                // Some damaged trees
        generateMortarPit(-25, -20);            // NEW: mortar position
        generateWatchtower(25, 25);             // NEW: watchtower near river
        generateAmmoCache(-20, 20);             // NEW: ammo cache at checkpoint
        generateSupplyTent(-10, -25);           // NEW: supply tent
        generateRazorWireMaze(10, 10, 5);       // NEW: razor wire near bridge
        generateUndergroundTunnel(-15, -10, 12); // NEW R2: tunnel under road
        generateCollapsedBridge(15, 20);         // NEW R2: collapsed bridge
        generateFuelDepot(-30, -10);             // NEW R2: fuel depot
        generateArtilleryBattery(20, -25);       // NEW R2: artillery battery
        generateRadarTower(-25, 30);             // NEW R2: radar tower
        generateCommandPost(20, -20);               // NEW R3: fortified command center
        generateObservationPost(-25, 15);           // NEW R3: lookout tower
        generateMinefield(30, 25);                  // NEW R3: buried mines area
        generateDestroyedTank(-15, -30);            // NEW R3: wrecked tank hull
        generateMGNest(10, 35);                     // NEW R3: MG nest position
        scatterResources(BLOCK.WOOD, 0.003);    // More vegetation than Bakhmut
        break;

      default:
        // Procedural: rich random mix of all features
        generateCraters(10 + Math.floor(Math.random() * 15));
        generateRuins(5 + Math.floor(Math.random() * 10));
        generateTrenches();
        generateTrenches();
        generateBrokenTrees(15 + Math.floor(Math.random() * 20));
        generateDugouts(2 + Math.floor(Math.random() * 4));
        if (Math.random() > 0.5) generateRiver(randInWorld(), 5 + Math.floor(Math.random() * 4));
        if (Math.random() > 0.5) generateMarsh(3);
        generateDefensivePosition(randInWorld(), randInWorld());
        generateDefensivePosition(randInWorld(), randInWorld());
        generateDestroyedVehicles(5 + Math.floor(Math.random() * 8));
        generateAntiTankHedgehogs(5 + Math.floor(Math.random() * 8));
        if (Math.random() > 0.5) generateApartmentBlock(randInWorld(), randInWorld(), 5);
        if (Math.random() > 0.5) generateSniperNest(randInWorld(), randInWorld());
        if (Math.random() > 0.3) generateCheckpoint(randInWorld(), randInWorld(), Math.random() > 0.5);
        generateBarbedWire(randInWorld(), randInWorld(), 20, Math.random() > 0.5);
        generateMinefieldSigns(2 + Math.floor(Math.random() * 3));
        generateFlagPole(0, 0);
        if (Math.random() > 0.5) generateChurch(randInWorld(), randInWorld());
        // NEW procedural features
        if (Math.random() > 0.4) generateMortarPit(randInWorld(), randInWorld());
        if (Math.random() > 0.4) generateWatchtower(randInWorld(), randInWorld());
        if (Math.random() > 0.5) generateAmmoCache(randInWorld(), randInWorld());
        if (Math.random() > 0.5) generateSupplyTent(randInWorld(), randInWorld());
        if (Math.random() > 0.3) generateRazorWireMaze(randInWorld(), randInWorld(), 3 + Math.floor(Math.random() * 4));
        if (Math.random() > 0.6) generateIndustrialComplex(randInWorld(), randInWorld());
        if (Math.random() > 0.6) generateGrainSilo(randInWorld(), randInWorld());
        if (Math.random() > 0.5) generateBurningRuin(randInWorld(), randInWorld());
        if (Math.random() > 0.5) generateFieldHospital(randInWorld(), randInWorld());
        if (Math.random() > 0.6) generateCommTower(randInWorld(), randInWorld());
        if (Math.random() > 0.4) generateUndergroundTunnel(randInWorld(), randInWorld(), 8 + Math.floor(Math.random() * 8));
        if (Math.random() > 0.5) generateCollapsedBridge(randInWorld(), randInWorld());
        if (Math.random() > 0.5) generateFuelDepot(randInWorld(), randInWorld());
        if (Math.random() > 0.6) generateArtilleryBattery(randInWorld(), randInWorld());
        if (Math.random() > 0.6) generateRadarTower(randInWorld(), randInWorld());
        // NEW R3: military structure generators
        if (Math.random() > 0.4) generateBunker(randInWorld(), randInWorld());
        if (Math.random() > 0.5) generateMGNest(randInWorld(), randInWorld());
        if (Math.random() > 0.5) generateDestroyedTank(randInWorld(), randInWorld());
        // Procedural road network
        _roadWaypoints.length = 0;
        generateRoadNetwork([
          [-40, 0, 40, 0, 3],
          [0, -40, 0, 40, 3],
          [-30, -30, 30, -30, 2],
          [-30, 30, 30, 30, 2],
        ]);
        break;
    }
    rebuildAll();
    return level;
  }

  /* ── Public API ──────────────────────────────────────────────────── */
  return {
    BLOCK,
    BLOCK_COLORS,
    BLOCK_HARDNESS,
    CHUNK_SIZE,
    CHUNK_HEIGHT,
    BLOCK_SIZE,
    THEMES,
    init,
    regenerate,
    dispose,
    setTheme,
    getTheme,
    getBlock,
    setBlock,
    isSolid,
    getTerrainHeight,
    raycastBlock,
    updateDirtyChunks,
    rebuildAll,
    scatterResources,
    worldToChunk,
    getLevelDef,
    generateLevel,
    getRoadWaypoints: function () { return _roadWaypoints.slice(); },
  };
})();
