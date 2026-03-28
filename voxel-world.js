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
  };
})();
