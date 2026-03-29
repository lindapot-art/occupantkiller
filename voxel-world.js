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
  });

  const BLOCK_COLORS = {
    [BLOCK.DIRT]:        0x8B6914,
    [BLOCK.GRASS]:       0x4A7C2E,
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
    { id: 'HOSTOMEL',  name: 'Hostomel Airport',    desc: 'Stop the airborne assault',  theme: 'grassland', wavesPerLevel: 5, difficulty: 1.0, fogColor: 0x4a5a3a },
    { id: 'AVDIIVKA',  name: 'Avdiivka Zombieland',  desc: 'Hold the industrial zone',   theme: 'urban',     wavesPerLevel: 5, difficulty: 1.3, fogColor: 0x3a3028 },
    { id: 'BAKHMUT',   name: 'Bakhmut Ruins',        desc: 'Defend the city',             theme: 'urban',     wavesPerLevel: 5, difficulty: 1.6, fogColor: 0x2a2a2a },
    { id: 'KHERSON',   name: 'Kherson Bridgehead',   desc: 'Cross the Dnipro',            theme: 'desert',    wavesPerLevel: 5, difficulty: 1.9, fogColor: 0x5a4a30 },
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
      wavesPerLevel: 5,
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
    // Pave streets
    for (let gx = 0; gx <= gridW; gx++) {
      const sx = ox + gx * (blockSize + streetWidth) - streetWidth;
      for (let z = oz; z < oz + gridD * (blockSize + streetWidth); z++) {
        for (let sw = 0; sw < streetWidth; sw++) {
          const h = getTerrainHeight(sx + sw, z);
          setBlock(sx + sw, h, z, BLOCK.CONCRETE);
        }
      }
    }
    for (let gz = 0; gz <= gridD; gz++) {
      const sz = oz + gz * (blockSize + streetWidth) - streetWidth;
      for (let x = ox; x < ox + gridW * (blockSize + streetWidth); x++) {
        for (let sw = 0; sw < streetWidth; sw++) {
          const h = getTerrainHeight(x, sz + sw);
          setBlock(x, h, sz + sw, BLOCK.CONCRETE);
        }
      }
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

    // Level-specific features
    switch (level.id) {
      case 'HOSTOMEL':
        generateRunway(-30, -3, 60, 6);
        generateBuilding(-10, 10, 12, 8, 4, BLOCK.CONCRETE);  // terminal
        generateControlTower(15, 10);
        generateBuilding(-25, -10, 10, 8, 5, BLOCK.METAL);    // hangar 1
        generateBuilding(20, -10, 10, 8, 5, BLOCK.METAL);     // hangar 2
        generateTrenches();
        generateDugouts(2);
        generateDefensivePosition(-18, 15);
        generateDefensivePosition(25, -15);
        scatterResources(BLOCK.WOOD, 0.003);
        break;

      case 'AVDIIVKA':
        generateCraters(28);
        generateTrenches();
        generateTrenches();
        generateBrokenTrees(40);
        generateRuins(8);
        generateDugouts(4);
        generateDefensivePosition(-25, 10);
        generateDefensivePosition(15, -20);
        generateDefensivePosition(0, 25);
        // Industrial buildings
        generateBuilding(-20, -15, 15, 10, 6, BLOCK.METAL);
        generateBuilding(10, 15, 12, 8, 5, BLOCK.CONCRETE);
        generateBuilding(-5, 20, 10, 10, 4, BLOCK.BRICK);
        // Scatter rubble
        for (let rb = 0; rb < 50; rb++) {
          const rx = randInWorld(), rz = randInWorld();
          const h = getTerrainHeight(rx, rz);
          if (h > 1) setBlock(rx, h, rz, BLOCK.RUBBLE);
        }
        break;

      case 'BAKHMUT':
        generateStreetGrid(-30, -30, 5, 5, 6);
        generateRuins(18);
        generateCraters(15);
        generateBrokenTrees(15);
        generateTrenches();  // double trench network for heavy fortification
        generateTrenches();
        generateDugouts(5);
        generateDefensivePosition(-20, 20);
        generateDefensivePosition(20, -20);
        break;

      case 'KHERSON':
        generateRiver(0, 8);
        generateBridge(-6, -2, 20, 4);
        generateMarsh(6);
        generateDefensivePosition(-20, -15);
        generateDefensivePosition(20, 15);
        generateDefensivePosition(-15, 20);
        generateTrenches();
        generateDugouts(3);
        generateBrokenTrees(20);
        scatterResources(BLOCK.WOOD, 0.002);
        break;

      default:
        // Procedural: random mix
        generateCraters(10 + Math.floor(Math.random() * 15));
        generateRuins(5 + Math.floor(Math.random() * 10));
        generateTrenches();
        generateBrokenTrees(15 + Math.floor(Math.random() * 20));
        generateDugouts(2 + Math.floor(Math.random() * 4));
        if (Math.random() > 0.5) generateRiver(randInWorld(), 5 + Math.floor(Math.random() * 4));
        if (Math.random() > 0.5) generateMarsh(3);
        generateDefensivePosition(randInWorld(), randInWorld());
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
  };
})();
