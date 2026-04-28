// Minimal THEMES object for robust QA/headless/test harness
const THEMES = {
  grassland: {
    fogColor: 0xBFD8FF,
    heightScale: 1.0,
    surfaceBlock: typeof BLOCK !== 'undefined' ? BLOCK.GRASS : 2,
    subBlock: typeof BLOCK !== 'undefined' ? BLOCK.DIRT : 1
  },
  urban: {
    fogColor: 0x8F877C,
    heightScale: 0.65,
    surfaceBlock: typeof BLOCK !== 'undefined' ? BLOCK.CONCRETE : 9,
    subBlock: typeof BLOCK !== 'undefined' ? BLOCK.BRICK : 10
  },
  industrial: {
    fogColor: 0x5D626B,
    heightScale: 0.55,
    surfaceBlock: typeof BLOCK !== 'undefined' ? BLOCK.ASPHALT : 18,
    subBlock: typeof BLOCK !== 'undefined' ? BLOCK.METAL : 5
  },
  coastal: {
    fogColor: 0x87B4D8,
    heightScale: 0.8,
    surfaceBlock: typeof BLOCK !== 'undefined' ? BLOCK.SAND : 7,
    subBlock: typeof BLOCK !== 'undefined' ? BLOCK.DIRT : 1
  },
  wasteland: {
    fogColor: 0x807255,
    heightScale: 0.9,
    surfaceBlock: typeof BLOCK !== 'undefined' ? BLOCK.DIRT : 1,
    subBlock: typeof BLOCK !== 'undefined' ? BLOCK.STONE : 3
  },
  cityscape: {
    fogColor: 0x6E727A,
    heightScale: 0.45,
    surfaceBlock: typeof BLOCK !== 'undefined' ? BLOCK.CONCRETE : 9,
    subBlock: typeof BLOCK !== 'undefined' ? BLOCK.STONE : 3
  }
};
// Ensure window.BLOCK and window.VoxelWorld are always defined before any code runs (robust for QA/headless)
if (typeof window !== 'undefined') {
  if (typeof window.BLOCK === 'undefined') window.BLOCK = {};
  if (typeof window.VoxelWorld === 'undefined') window.VoxelWorld = {};
  if (typeof window.WORLD_CHUNKS === 'undefined') window.WORLD_CHUNKS = 32;
  if (typeof window.CHUNK_SIZE === 'undefined') window.CHUNK_SIZE = 32;
  if (typeof window.CHUNK_HEIGHT === 'undefined') window.CHUNK_HEIGHT = 64;
  if (typeof window.BLOCK_SIZE === 'undefined') window.BLOCK_SIZE = 1;
}
const WORLD_CHUNKS = typeof window !== 'undefined' ? window.WORLD_CHUNKS : 32;
const CHUNK_SIZE = typeof window !== 'undefined' ? window.CHUNK_SIZE : 32;
const CHUNK_HEIGHT = typeof window !== 'undefined' ? window.CHUNK_HEIGHT : 64;
const BLOCK_SIZE = typeof window !== 'undefined' ? window.BLOCK_SIZE : 1;
// (Removed: window.BLOCK export here; handled at end of file)
  function generateRoundabout(ox, oz, radius) {
    // Draw a circular asphalt road
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      const rx = Math.round(ox + Math.cos(angle) * radius);
      const rz = Math.round(oz + Math.sin(angle) * radius);
      setBlock(rx, getTerrainHeight(rx, rz), rz, BLOCK.ASPHALT);
      // Center garden
      if (angle % 0.3 < 0.1) setBlock(ox + Math.round(Math.cos(angle) * (radius - 2)), 3, oz + Math.round(Math.sin(angle) * (radius - 2)), BLOCK.BUSH);
    }
    // Connect roads in 4 directions
    generateRoad(ox - radius, oz, ox - radius - 8, oz, 3);
    generateRoad(ox + radius, oz, ox + radius + 8, oz, 3);
    generateRoad(ox, oz - radius, ox, oz - radius - 8, 3);
    generateRoad(ox, oz + radius, ox, oz + radius + 8, 3);
  }













// Universal Module Definition for VoxelWorld
window.VoxelWorld = (function () {
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
    ROOFTILE:    19,
    PLASTER:     20,
    CARPET:      21,
    LINOLEUM:    22,
    WALLPAPER:   23,
    CERAMIC:     24,
    SHINGLE:     25,
    BUSH:        26,
    LIGHT:       27,
    CAR:         28,
    DOOR:        29,
    LADDER:      30,
    LAMPPOST:    31,
    STREETLIGHT: 32,
    BENCH:       33,
    SIGN:        34,
    BRIDGE:      35,
    TUNNEL:      36,
    FIRE:        37,
    FLAG:        38,
    BANNER:      39,
    LOOT_CRATE:  40,
    ROOFTOP_HATCH: 41,
    BREAKABLE_FENCE: 42,
    ZIPLINE:     43,
    TRUCK:       44,
    BUS:         45,
    SHOP_SIGN:   46,
    SHELF:       47,
    COUNTER:     48,
    MAILBOX:     49,
    STREET_SIGN: 50,
    BUS_STOP:    51,
    PARK_TREE:   52,
    SLIDE:       53,
    SWING:       54,
    STATUE:      55,
    UMBRELLA:    56,
    GOALPOST:    57,
    TABLE:       58,
    SANDBOX:     59,
    CONFETTI:    60,
    CROWD:       61,
    FIREWORK:    62,
    PARADE_VEHICLE: 63,
    BLUE_TILE:   64,
    WHITE_TILE:  65,
  });
  if (typeof window !== 'undefined') window.BLOCK = BLOCK;

  const chunks = new Map();

  function chunkKey(cx, cz) {
    return cx + ',' + cz;
  }

  function blockIndex(lx, ly, lz) {
    return ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
  }

  function worldToChunk(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { cx, cz, lx, lz };
  }

  function getChunk(cx, cz) {
    return chunks.get(chunkKey(cx, cz)) || null;
  }

  function createChunk(cx, cz) {
    const chunk = {
      cx: cx,
      cz: cz,
      data: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE),
      mesh: null,
      waterMesh: null,
      dirty: true,
    };
    chunks.set(chunkKey(cx, cz), chunk);
    return chunk;
  }

  function getBlock(wx, wy, wz) {
    const iy = Math.floor(wy);
    if (iy < 0 || iy >= CHUNK_HEIGHT) return BLOCK.AIR;
    const world = worldToChunk(Math.floor(wx), Math.floor(wz));
    const chunk = getChunk(world.cx, world.cz);
    if (!chunk) return BLOCK.AIR;
    return chunk.data[blockIndex(world.lx, iy, world.lz)] || BLOCK.AIR;
  }

  function setBlock(wx, wy, wz, type) {
    const iy = Math.floor(wy);
    if (iy < 0 || iy >= CHUNK_HEIGHT) return false;
    const world = worldToChunk(Math.floor(wx), Math.floor(wz));
    let chunk = getChunk(world.cx, world.cz);
    if (!chunk) chunk = createChunk(world.cx, world.cz);
    chunk.data[blockIndex(world.lx, iy, world.lz)] = type;
    chunk.dirty = true;
    if (world.lx === 0) markDirty(world.cx - 1, world.cz);
    if (world.lx === CHUNK_SIZE - 1) markDirty(world.cx + 1, world.cz);
    if (world.lz === 0) markDirty(world.cx, world.cz - 1);
    if (world.lz === CHUNK_SIZE - 1) markDirty(world.cx, world.cz + 1);
    return true;
  }

  // --- Collision helpers (hoisted for closure order) ---
  function isSolid(wx, wy, wz) {
    const b = getBlock(Math.floor(wx), Math.floor(wy), Math.floor(wz));
    return b !== BLOCK.AIR && b !== BLOCK.WATER;
  }

  // --- Terrain Themes (hoisted for closure order) ---
  let _theme = {
    name: 'grassland',
    isSolid: isSolid,

    // Expose new terrain/prop features as part of the API if needed
    generateOverpass,
    placeBench,
    placeFountain,
    placeStreetlight,
    placePond,
    placePark,
    generateLuxuryVilla,
    generateRoundabout
  };
  // --- Orphaned functions moved inside IIFE ---
  function generateOverpass(ox, oz, length, height) {
    // Elevated road
    for (let i = 0; i < length; i++) {
      for (let h = 0; h < height; h++) {
        setBlock(ox + i, getTerrainHeight(ox + i, oz) + h + 2, oz, h === height - 1 ? BLOCK.ASPHALT : BLOCK.CONCRETE);
      }
    }
  }

  function placeBench(wx, wy, wz) {
    (typeof setBlock !== 'undefined' ? setBlock : (typeof VoxelWorld !== 'undefined' ? VoxelWorld.setBlock : null))(wx, wy, wz, BLOCK.BENCH);
  }


  function placeStreetlight(wx, wy, wz) {
    setBlock(wx, wy, wz, BLOCK.STREETLIGHT);
    setBlock(wx, wy + 1, wz, BLOCK.LAMPPOST);
  }

  function placeMailbox(wx, wy, wz) {
    // Short post + box on top
    setBlock(wx, wy, wz, BLOCK.LAMPPOST);
    setBlock(wx, wy + 1, wz, BLOCK.METAL);
  }

  function placeStreetSign(wx, wy, wz) {
    // Pole + sign-block on top
    setBlock(wx, wy, wz, BLOCK.LAMPPOST);
    setBlock(wx, wy + 1, wz, BLOCK.GLASS);
  }

  function placeBusStop(wx, wy, wz) {
    // Simple shelter: 3 wall blocks + roof
    setBlock(wx, wy, wz, BLOCK.GLASS);
    setBlock(wx, wy + 1, wz, BLOCK.GLASS);
    setBlock(wx, wy + 2, wz, BLOCK.METAL);
  }

  // Russian dugout / trench position. Carves a pit, lines it with sandbags,
  // adds a couple wood plank covers, and spits out a center anchor for spawning a garrison.
  function placeDugout(wx, wy, wz, length) {
    var L = Math.max(3, length || 5);
    var W = 3;
    var depth = 2;
    // Carve trench
    for (var dx = 0; dx < L; dx++) {
      for (var dz = 0; dz < W; dz++) {
        for (var dy = 0; dy < depth; dy++) {
          setBlock(wx + dx, wy - dy, wz + dz, BLOCK.AIR);
        }
        // floor = dirt
        setBlock(wx + dx, wy - depth, wz + dz, BLOCK.DIRT);
      }
    }
    // Sandbag walls along long edges (top of trench)
    for (var i = 0; i < L; i++) {
      setBlock(wx + i, wy + 1, wz - 1, BLOCK.SANDBAG);
      setBlock(wx + i, wy + 1, wz + W, BLOCK.SANDBAG);
      if (i % 2 === 0) {
        setBlock(wx + i, wy + 2, wz - 1, BLOCK.SANDBAG);
        setBlock(wx + i, wy + 2, wz + W, BLOCK.SANDBAG);
      }
    }
    // Wood plank covers (partial)
    if (BLOCK.WOOD !== undefined) {
      setBlock(wx + 1, wy + 1, wz, BLOCK.WOOD);
      setBlock(wx + 1, wy + 1, wz + 1, BLOCK.WOOD);
      setBlock(wx + L - 2, wy + 1, wz + 1, BLOCK.WOOD);
      setBlock(wx + L - 2, wy + 1, wz + 2, BLOCK.WOOD);
    }
    // Mark dirt mound at end of trench (entry)
    setBlock(wx, wy, wz - 1, BLOCK.DIRT);
    setBlock(wx + L - 1, wy, wz + W, BLOCK.DIRT);
    return {
      x: wx + Math.floor(L / 2),
      y: wy - depth + 1,
      z: wz + Math.floor(W / 2),
      length: L, width: W, depth: depth
    };
  }

  function placeFountain(wx, wy, wz) {
    setBlock(wx, wy, wz, BLOCK.WATER);
    setBlock(wx, wy + 1, wz, BLOCK.GLASS);
    setBlock(wx, wy + 2, wz, BLOCK.STONE);
  }


  function placePond(wx, wy, wz, r) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx*dx + dz*dz <= r*r) setBlock(wx + dx, wy, wz + dz, BLOCK.WATER);
    }
  }

  function placePark(wx, wy, wz, w, d) {
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) setBlock(wx + x, wy, wz + z, BLOCK.GRASS);
    if (w > 3 && d > 3) placeFountain(wx + Math.floor(w/2), wy, wz + Math.floor(d/2));
    for (let t = 0; t < 3; t++) placeTree(wx + 1 + t*2, wy + 1, wz + 1 + t*2, t % 3);
  }

  function generateLuxuryVilla(ox, oz, w, d) {
    // Large, modern house with glass, pool, and garden
    const h = 4;
    // Main structure: white concrete walls, lots of glass
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
      const isWall = x === 0 || x === w - 1 || z === 0 || z === d - 1;
      if (isWall) setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + y, oz + z, BLOCK.CONCRETE);
      else if (y === h - 1) setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + y, oz + z, BLOCK.ROOFTILE);
      else if (x % 2 === 0 && z % 2 === 0 && y === 1) setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + y, oz + z, BLOCK.GLASS);
    }
    // Pool in the yard
    for (let px = 2; px < w - 2; px++) for (let pz = d; pz < d + 3; pz++) {
      setBlock(ox + px, getTerrainHeight(ox + px, oz + pz), oz + pz, BLOCK.WATER);
    }
  }

  // Each vehicle is an object: { type, pos: {x,y,z}, dir, speed, waypointIdx }
  let _activeVehicles = [];
  function spawnVehicle(type, startPos, dir, speed) {
    const vehicle = {
      type: type || 'truck',
      pos: startPos ? { x: startPos.x || 0, y: startPos.y || 0, z: startPos.z || 0 } : { x: 0, y: 0, z: 0 },
      dir: dir || 0,
      speed: speed || 0,
      waypointIdx: 0
    };
    _activeVehicles.push(vehicle);
    return vehicle;
  }
  // Expose global no-op for test harness
  if (typeof window !== 'undefined') window.spawnVehicle = spawnVehicle;

  function updateVehicles(dt) {
    const delta = Number.isFinite(dt) ? dt : 0;
    if (!delta || _activeVehicles.length === 0) return;
    for (const vehicle of _activeVehicles) {
      vehicle.pos.x += Math.cos(vehicle.dir) * vehicle.speed * delta;
      vehicle.pos.z += Math.sin(vehicle.dir) * vehicle.speed * delta;
    }
  }

  function getActiveVehicles() {
    return _activeVehicles.slice();
  }

  function clearVehicles() {
    _activeVehicles.length = 0;
  }

  // Moved BLOCK_COLORS inside IIFE
  const BLOCK_COLORS = {
    [BLOCK.DIRT]:       0x7A5A3A,
    [BLOCK.GRASS]:      0x005BBB,
    [BLOCK.STONE]:      0x7F7F86,
    [BLOCK.WOOD]:       0x8B5A2B,
    [BLOCK.METAL]:      0x6F7C85,
    [BLOCK.ELECTRONICS]:0x3A5F8C,
    [BLOCK.SAND]:       0xC9B27C,
    [BLOCK.WATER]:      0x3D7FB3,
    [BLOCK.CONCRETE]:   0xA4A7AC,
    [BLOCK.BRICK]:      0xA54B3F,
    [BLOCK.GLASS]:      0xA9D8E8,
    [BLOCK.FUEL_BARREL]:0xB2472F,
    [BLOCK.CRATE]:      0x8A6A3C,
    [BLOCK.REINFORCED]: 0x545B66,
    [BLOCK.FENCE]:      0x857A6A,
    [BLOCK.RUBBLE]:     0x6F6256,
    [BLOCK.SANDBAG]:    0xA89A72,
    [BLOCK.ASPHALT]:    0x34363A,
    [BLOCK.ROOFTILE]:   0x78433B,
    [BLOCK.PLASTER]:    0xD7D2C8,
    [BLOCK.CARPET]:     0x8A2F2F,
    [BLOCK.LINOLEUM]:   0x8E8A74,
    [BLOCK.WALLPAPER]:  0xC7C19E,
    [BLOCK.CERAMIC]:    0xD9DDD8,
    [BLOCK.SHINGLE]:    0x4D535C,
    [BLOCK.BUSH]:       0x0057A0,
    [BLOCK.LIGHT]:      0xFFE8A3,
    [BLOCK.CAR]:        0x2C4B7C,
    [BLOCK.DOOR]:       0x6B4627,
    [BLOCK.LADDER]:     0x8D6B3F,
    [BLOCK.LAMPPOST]:   0x4F545B,
    [BLOCK.STREETLIGHT]:0xD6C26E,
    [BLOCK.BENCH]:      0x7B5632,
    [BLOCK.SIGN]:       0xC8C39B,
    [BLOCK.BRIDGE]:     0x70757D,
    [BLOCK.TUNNEL]:     0x595146,
    [BLOCK.FIRE]:       0xFF6A00,
    [BLOCK.FLAG]:       0x2F65C7,
    [BLOCK.BANNER]:     0xB33A3A,
    [BLOCK.LOOT_CRATE]: 0x9A793A,
    [BLOCK.ROOFTOP_HATCH]: 0x5A6068,
    [BLOCK.BREAKABLE_FENCE]: 0x9B8A6E,
    [BLOCK.ZIPLINE]:    0xC8B45A,
    [BLOCK.TRUCK]:      0x444444,  // dark gray truck
    [BLOCK.BUS]:        0xFFD700,  // yellow bus
    [BLOCK.SHOP_SIGN]:  0xFFD700,  // yellow shop sign
    [BLOCK.SHELF]:      0x8B5A2B,  // brown shelf
    [BLOCK.COUNTER]:    0xC2B280,  // tan counter
    [BLOCK.MAILBOX]:    0x1E90FF,  // blue mailbox
    [BLOCK.STREET_SIGN]:0x228B22,  // green sign
    [BLOCK.BUS_STOP]:   0xAAAAAA,  // gray bus stop
    [BLOCK.PARK_TREE]:  0x228B22,  // green tree
    [BLOCK.SLIDE]:      0xFFD700,  // yellow slide
    [BLOCK.SWING]:      0x2222FF,  // blue swing
    [BLOCK.STATUE]:     0xCCCCCC,  // gray statue
    [BLOCK.UMBRELLA]:   0xFF69B4,  // pink umbrella
    [BLOCK.GOALPOST]:   0xFFFFFF,  // white goalpost
    [BLOCK.TABLE]:      0x8B4513,  // brown table
    [BLOCK.SANDBOX]:    0xFFF8DC,  // sand color
    [BLOCK.BLUE_TILE]:  0x0057B8,  // Ukrainian blue tile (hallways)
    [BLOCK.WHITE_TILE]: 0xF0F0F0,  // white tile (upper hallway walls)
  };
  // Expose BLOCK_COLORS globally for legacy/stray references
  if (typeof window !== 'undefined') window.BLOCK_COLORS = BLOCK_COLORS;

  // --- New Feature Placement Functions ---
  // ── Military Checkpoint Feature ──
  function generateMilitaryCheckpoint(ox, oz) {
    // Sandbag barriers
    for (let i = 0; i < 7; i++) {
      setBlock(ox + i, getTerrainHeight(ox + i, oz), oz, BLOCK.SANDBAG);
      setBlock(ox + i, getTerrainHeight(ox + i, oz + 4), oz + 4, BLOCK.SANDBAG);
    }
    for (let j = 1; j < 4; j++) {
      setBlock(ox, getTerrainHeight(ox, oz + j), oz + j, BLOCK.SANDBAG);
      setBlock(ox + 6, getTerrainHeight(ox + 6, oz + j), oz + j, BLOCK.SANDBAG);
    }
    // Guard hut
    for (let y = 0; y < 3; y++) for (let x = 2; x < 5; x++) for (let z = 1; z < 4; z++) {
      setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + y, oz + z, y === 2 ? BLOCK.METAL : BLOCK.CONCRETE);
    }
    // Barriers
    setBlock(ox + 3, getTerrainHeight(ox + 3, oz) + 1, oz, BLOCK.FENCE);
    setBlock(ox + 3, getTerrainHeight(ox + 3, oz + 4) + 1, oz + 4, BLOCK.FENCE);
  }

  // ── City Event System (moved to top level for global access) ──
  let activeEvents = [];
  function triggerCityEvent(type) {
            // Ensure triggerCityEvent is available globally immediately after definition
            if (typeof window !== 'undefined') window.triggerCityEvent = triggerCityEvent;
            if (type === 'abduction') {
              // Random beams of light, missing props, floating cows
              for (let i = 0; i < 8; i++) {
                const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
                const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
                for (let y = 0; y < 8; y++) setBlock(ox, getTerrainHeight(ox, oz) + y, oz, BLOCK.LIGHT);
                // Remove random prop
                if (Math.random() < 0.5) setBlock(ox, getTerrainHeight(ox, oz), oz, BLOCK.AIR);
                // Floating cow (use CAR block as placeholder)
                if (Math.random() < 0.3) setBlock(ox, getTerrainHeight(ox, oz) + 9, oz, BLOCK.CAR);
              }
            }
                else if (type === 'abduction') {
                  // Remove beams and floating cows
                  for (let j = 0; j < 10; j++) {
                    const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
                    const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
                    for (let y = 0; y < 8; y++) if (getBlock(ox, getTerrainHeight(ox, oz) + y, oz) === BLOCK.LIGHT) setBlock(ox, getTerrainHeight(ox, oz) + y, oz, BLOCK.AIR);
                    if (getBlock(ox, getTerrainHeight(ox, oz) + 9, oz) === BLOCK.CAR) setBlock(ox, getTerrainHeight(ox, oz) + 9, oz, BLOCK.AIR);
                  }
                }
        if (type === 'sandstorm') {
          // Reduce visibility, tint sky, spawn sand piles
          if (typeof WeatherSystem !== 'undefined' && WeatherSystem.setWeather)
            WeatherSystem.setWeather('sandstorm');
          for (let i = 0; i < 30; i++) {
            const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
            const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
            for (let h = 0; h < 3 + Math.floor(Math.random() * 3); h++) {
              setBlock(ox, getTerrainHeight(ox, oz) + h, oz, BLOCK.SAND);
            }
          }
        }
    // Example: fire, flood, festival, parade
    let duration = 30 + Math.random() * 30;
    if (type === 'festival' || type === 'parade') duration = 45 + Math.random() * 30;
    activeEvents.push({ type, timer: duration });
    if (type === 'fire') {
      // Ignite several burning ruins
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
        const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        generateBurningRuin(ox, oz);
      }
    } else if (type === 'flood') {
      // Flood low-lying areas with water blocks
      for (let i = 0; i < 10; i++) {
        const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        const surfH = getTerrainHeight(ox, oz);
        for (let h = 0; h < 2 + Math.floor(Math.random() * 2); h++) {
          setBlock(ox, surfH + h, oz, BLOCK.WATER);
        }
      }
    } else if (type === 'festival') {
      // Place festival decorations and crowds
      for (let i = 0; i < 6; i++) {
        const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        setBlock(ox, getTerrainHeight(ox, oz) + 1, oz, BLOCK.FLAG);
        setBlock(ox + 1, getTerrainHeight(ox + 1, oz) + 1, oz, BLOCK.CROWD);
      }
      // Fireworks: place colored blocks in the sky
      for (let i = 0; i < 8; i++) {
        const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        setBlock(ox, getTerrainHeight(ox, oz) + 8 + Math.floor(Math.random() * 6), oz, BLOCK.FIREWORK);
      }
    } else if (type === 'meteor') {
      // Meteor strike: spawn craters and fire
      for (let i = 0; i < 5; i++) {
        const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        for (let r = 2; r < 5; r++) for (let a = 0; a < 360; a += 20) {
          const rad = a * Math.PI / 180;
          const x = ox + Math.round(Math.cos(rad) * r);
          const z = oz + Math.round(Math.sin(rad) * r);
          setBlock(x, getTerrainHeight(x, z), z, BLOCK.AIR);
          setBlock(x, getTerrainHeight(x, z) - 1, z, BLOCK.FIRE);
        }
      }
    } else if (type === 'parade') {
      // Place parade vehicles and banners
      for (let i = 0; i < 4; i++) {
        const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        setBlock(ox, getTerrainHeight(ox, oz) + 1, oz, BLOCK.PARADE_VEHICLE);
        setBlock(ox, getTerrainHeight(ox, oz) + 2, oz, BLOCK.BANNER);
      }
      // Confetti: sprinkle colored blocks
      for (let i = 0; i < 20; i++) {
        const ox = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        const oz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.8);
        setBlock(ox, getTerrainHeight(ox, oz) + 3 + Math.floor(Math.random() * 3), oz, BLOCK.CONFETTI);
      }
    }
  }
  // (Removed stray/partial duplicate updateCityEvents stub)
  function clearCityEvents() { activeEvents = []; }
        // ── Rooftop, Ladder, Zipline Placement ──
        function placeLadder(x, y, z, height = 4) {
          for (let i = 0; i < height; i++) setBlock(x, y + i, z, BLOCK.LADDER);
        }

        function placeZipline(x1, y1, z1, x2, y2, z2) {
          // Place ZIPLINE blocks between two points (simple straight line)
          const steps = Math.max(Math.abs(x2-x1), Math.abs(y2-y1), Math.abs(z2-z1));
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = Math.round(x1 + (x2-x1)*t);
            const y = Math.round(y1 + (y2-y1)*t);
            const z = Math.round(z1 + (z2-z1)*t);
            setBlock(x, y, z, BLOCK.ZIPLINE);
          }
        }

        function placeRooftopHatch(x, y, z) {
          setBlock(x, y, z, BLOCK.ROOFTOP_HATCH);
        }

      function closeDoor(x, y, z) {
        // Close door (set to DOOR, play anim, trigger event)
        if (getBlock(x, y, z) === BLOCK.AIR) {
          setBlock(x, y, z, BLOCK.DOOR);
          if (typeof window.AudioSystem !== 'undefined') {
            window.AudioSystem.playImpact && window.AudioSystem.playImpact(4); // Wood impact
          }
          // Trigger event: could dispatch a custom event if needed
        }
      }

      function openCrate(x, y, z) {
        // Open loot crate (set to AIR, spawn loot)
        if (getBlock(x, y, z) === BLOCK.LOOT_CRATE) {
          setBlock(x, y, z, BLOCK.AIR);
          spawnLoot(x, y, z);
          if (typeof window.AudioSystem !== 'undefined') {
            window.AudioSystem.playImpact && window.AudioSystem.playImpact(11); // Glass impact
          }
          // Trigger event: could dispatch a custom event if needed
        }
      }

      function breakFence(x, y, z) {
        // Break fence (set to AIR, spawn debris)
        if (getBlock(x, y, z) === BLOCK.BREAKABLE_FENCE) {
          setBlock(x, y, z, BLOCK.AIR);
          spawnDebris(x, y, z, BLOCK.BREAKABLE_FENCE);
          if (typeof window.AudioSystem !== 'undefined') {
            window.AudioSystem.playRicochet && window.AudioSystem.playRicochet();
          }
          // Trigger event: could dispatch a custom event if needed
        }
      }

      // --- Road Types: Bridge & Tunnel Placement ---
      function placeBridge(x, y, z, length, width) {
        for (let i = 0; i < length; i++) {
          for (let w = 0; w < width; w++) {
            setBlock(x + i, y, z + w, BLOCK.BRIDGE);
          }
        }
      }

      function placeTunnel(x, y, z, length, height, width) {
        for (let i = 0; i < length; i++) {
          for (let h = 0; h < height; h++) {
            for (let w = 0; w < width; w++) {
              setBlock(x + i, y + h, z + w, BLOCK.TUNNEL);
            }
          }
        }
      }

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
    [BLOCK.ASPHALT]:    3,
    [BLOCK.ROOFTILE]:   2,
    [BLOCK.PLASTER]:    1.5,
    [BLOCK.CARPET]:     0.5,
    [BLOCK.LINOLEUM]:   0.5,
    [BLOCK.WALLPAPER]:  1,
    [BLOCK.CERAMIC]:    2,
    [BLOCK.SHINGLE]:    2,
    [BLOCK.BENCH]:      1.2,
    [BLOCK.STREETLIGHT]:2.5,
    [BLOCK.LAMPPOST]:   2.5,
    [BLOCK.BUSH]:       0.3,
    [BLOCK.CAR]:        2.0,
    [BLOCK.BLUE_TILE]:  2,
    [BLOCK.WHITE_TILE]: 1.5,
  // (global export block moved to end of file)
  };

  const BLOCK_TRANSPARENT = new Set([BLOCK.AIR, BLOCK.WATER, BLOCK.GLASS]);

  // ── Cover Degradation System ────────────────────────────────
  // Blocks track accumulated damage. When damage exceeds HP → block breaks.
  // HP = BLOCK_HARDNESS * 30 (soft blocks break fast, reinforced takes sustained fire)
  const _blockDamage = {};  // key "x,y,z" → { hp: remaining, maxHp: initial }
  const _damageDecayRate = 2;  // HP restored per second (cover slowly "recovers" if not shot)
  const _damageDecayDelay = 3; // seconds of no hits before decay starts
  const _blockLastHit = {};    // key → timestamp of last hit

  function _blockKey(x, y, z) { return x + ',' + y + ',' + z; }

  function damageBlock(x, y, z, weaponDamage) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    var blockType = getBlock(x, y, z);
    if (!blockType || blockType === BLOCK.AIR || blockType === BLOCK.WATER) return false;
    var hardness = BLOCK_HARDNESS[blockType] || 1;
    var maxHp = hardness * 30;
    var key = _blockKey(x, y, z);
    if (!_blockDamage[key]) _blockDamage[key] = { hp: maxHp, maxHp: maxHp };
    var dmg = _blockDamage[key];
    // Weapon damage scales inversely with hardness (high-caliber breaks hard cover faster)
    var effectiveDmg = Math.max(1, weaponDamage / hardness);
    dmg.hp -= effectiveDmg;
    _blockLastHit[key] = performance.now() / 1000;
    if (dmg.hp <= 0) {
      // Block destroyed — convert to rubble or air
      delete _blockDamage[key];
      delete _blockLastHit[key];
      if (hardness >= 3 && blockType !== BLOCK.GLASS) {
        setBlock(x, y, z, BLOCK.RUBBLE);
      } else {
        setBlock(x, y, z, BLOCK.AIR);
      }
      return true; // block broke
    }
    return false;
  }

  function updateCoverDegradation(delta) {
    var now = performance.now() / 1000;
    var keysToRemove = [];
    for (var key in _blockDamage) {
      var lastHit = _blockLastHit[key] || 0;
      if (now - lastHit > _damageDecayDelay) {
        var dmg = _blockDamage[key];
        dmg.hp = Math.min(dmg.maxHp, dmg.hp + _damageDecayRate * delta);
        if (dmg.hp >= dmg.maxHp) keysToRemove.push(key);
      }
    }
    for (var i = 0; i < keysToRemove.length; i++) {
      delete _blockDamage[keysToRemove[i]];
      delete _blockLastHit[keysToRemove[i]];
    }
  }

  function getBlockDamageRatio(x, y, z) {
    var key = _blockKey(Math.floor(x), Math.floor(y), Math.floor(z));
    var dmg = _blockDamage[key];
    if (!dmg) return 0;
    return 1 - (dmg.hp / dmg.maxHp);
  }

  function placeBush(wx, wy, wz) {
    setBlock(wx, wy, wz, BLOCK.BUSH);
    setBlock(wx, wy + 1, wz, BLOCK.BUSH);
  }

  function placeCar(wx, wy, wz) {
    setBlock(wx, wy, wz, BLOCK.CAR);
    setBlock(wx + 1, wy, wz, BLOCK.CAR);
  }
  function placeTruck(wx, wy, wz) {
    setBlock(wx, wy, wz, BLOCK.TRUCK);
    setBlock(wx + 1, wy, wz, BLOCK.TRUCK);
  }
  function placeBus(wx, wy, wz) {
    setBlock(wx, wy, wz, BLOCK.BUS);
    setBlock(wx + 1, wy, wz, BLOCK.BUS);
    setBlock(wx + 2, wy, wz, BLOCK.BUS);
  }
    function placeFountain(wx, wy, wz) {
      setBlock(wx, wy, wz, BLOCK.WATER);
      setBlock(wx, wy + 1, wz, BLOCK.GLASS);
      setBlock(wx, wy + 2, wz, BLOCK.STONE);
    }
    // ...existing code for roundabout...

  // --- House Type Generators ---
  function generateCottage(ox, oz, w, d) {
    // Small house, wood walls, sloped roof
    // Simple implementation: rectangle with wood walls, peaked roof
    const h = 3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          const isWall = x === 0 || x === w - 1 || z === 0 || z === d - 1;
          if (isWall) setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + y, oz + z, BLOCK.WOOD);
          else if (y === h - 1) setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + y, oz + z, BLOCK.ROOFTILE);
        }
      }
    }
    // Door
    setBlock(ox + Math.floor(w / 2), getTerrainHeight(ox + Math.floor(w / 2), oz), oz, BLOCK.DOOR);
    // Simple peaked roof
    for (let x = -1; x <= w; x++) {
      for (let z = -1; z <= d; z++) {
        setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + h, oz + z, BLOCK.ROOFTILE);
      }
    }
    // Add a window
    setBlock(ox + 1, getTerrainHeight(ox + 1, oz + Math.floor(d / 2)) + 1, oz + Math.floor(d / 2), BLOCK.GLASS);
    // Add a bush outside
    if (typeof placeBush !== 'undefined') placeBush(ox - 1, 2, oz + 1);
  }

  function markDirty(cx, cz) {
    const c = getChunk(cx, cz);
    if (c) c.dirty = true;
  }


  // Theme setter/getter
  function setTheme(themeName) {
    _theme = Object.assign({ seed: 0 }, THEMES[themeName] || THEMES.grassland);
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

  // Exported terrain height function for test harness and modules
  function getTerrainHeight(wx, wz) {
    return getHeight(wx, wz);
  }

  // Returns the Y coordinate of the topmost solid block at (wx, wz).
  // Unlike getTerrainHeight (which returns the procedural noise height and
  // ignores carved craters / placed structures), this scans actual voxel
  // state from the world ceiling downward. Use this for player spawn
  // placement and ground-snap correctness so the camera can never end up
  // beneath solid geometry.
  function getTopSolidY(wx, wz) {
    var ix = Math.floor(wx);
    var iz = Math.floor(wz);
    // Start a few blocks above the noise height to cover placed structures.
    var startY = Math.min(CHUNK_HEIGHT - 1, getHeight(ix, iz) + 24);
    for (var y = startY; y >= 0; y--) {
      if (isSolid(ix, y, iz)) return y + 1; // top surface = first AIR above solid
    }
    return getHeight(ix, iz) + 1;
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
      if (scene) scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (chunk.waterMesh) {
      if (scene) scene.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }

    const positions = [];
    const normals   = [];
    const colors    = [];
    const indices   = [];
    let vertCount   = 0;

    // Separate arrays for water geometry
    const wPositions = [];
    const wNormals   = [];
    const wColors    = [];
    const wIndices   = [];
    let wVertCount   = 0;

    const ox = chunk.cx * CHUNK_SIZE;
    const oz = chunk.cz * CHUNK_SIZE;

    // AO darkening factors: index = occlusion level (0=full shadow, 3=no shadow)
    const AO_CURVE = [0.45, 0.65, 0.82, 1.0];

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const bt = chunk.data[blockIndex(lx, ly, lz)];
          if (bt === BLOCK.AIR) continue;

          const wx = ox + lx;
          const wz = oz + lz;
          const col = new THREE.Color(BLOCK_COLORS[bt] || 0xFF00FF);
          const isWater = (bt === BLOCK.WATER);

          for (const face of _faceNormals) {
            const fnx = face.dir[0], fny = face.dir[1], fnz = face.dir[2];
            const nbx = wx + fnx;
            const nby = ly + fny;
            const nbz = wz + fnz;

            const nb = getBlock(nbx, nby, nbz);
            // For water blocks: only draw face if neighbor is AIR (skip water-to-water)
            if (isWater) {
              if (nb !== BLOCK.AIR) continue;
            } else {
              if (!BLOCK_TRANSPARENT.has(nb)) continue;
            }

            // Pick target arrays (water vs solid)
            const tPos = isWater ? wPositions : positions;
            const tNrm = isWater ? wNormals : normals;
            const tCol = isWater ? wColors : colors;
            const tIdx = isWater ? wIndices : indices;
            let tVert = isWater ? wVertCount : vertCount;

            // Determine the two tangent axes for AO sampling
            let t0, t1;
            if (fnx !== 0) { t0 = 1; t1 = 2; }
            else if (fny !== 0) { t0 = 0; t1 = 2; }
            else { t0 = 0; t1 = 1; }

            const aoVals = [];
            for (const c of face.corners) {
              // Direction from face center to this corner along each tangent
              const d0 = c[t0] === 0 ? -1 : 1;
              const d1 = c[t1] === 0 ? -1 : 1;

              // Three AO neighbor offsets from the face-neighbor block
              const s1 = [0, 0, 0]; s1[t0] = d0;
              const s2 = [0, 0, 0]; s2[t1] = d1;

              const side1 = isTransparent(nbx + s1[0], nby + s1[1], nbz + s1[2]) ? 0 : 1;
              const side2 = isTransparent(nbx + s2[0], nby + s2[1], nbz + s2[2]) ? 0 : 1;
              const corn  = isTransparent(nbx + s1[0] + s2[0], nby + s1[1] + s2[1], nbz + s1[2] + s2[2]) ? 0 : 1;

              const ao = (side1 && side2) ? 0 : 3 - (side1 + side2 + corn);
              aoVals.push(ao);
              const f = isWater ? 1.0 : AO_CURVE[ao]; // no AO darkening on water

              tPos.push(
                (lx + c[0]) * BLOCK_SIZE,
                (ly + c[1]) * BLOCK_SIZE,
                (lz + c[2]) * BLOCK_SIZE
              );
              tNrm.push(fnx, fny, fnz);
              tCol.push(col.r * f, col.g * f, col.b * f);
            }

            // Flip quad when AO is anisotropic to avoid ugly diagonal artifact
            if (aoVals[0] + aoVals[2] > aoVals[1] + aoVals[3]) {
              tIdx.push(
                tVert, tVert + 1, tVert + 2,
                tVert, tVert + 2, tVert + 3
              );
            } else {
              tIdx.push(
                tVert + 1, tVert + 2, tVert + 3,
                tVert + 1, tVert + 3, tVert
              );
            }
            if (isWater) { wVertCount += 4; } else { vertCount += 4; }
          }
        }
      }
    }


    if (vertCount === 0 && wVertCount === 0) { chunk.dirty = false; return; }

    // Solid terrain mesh
    if (vertCount > 0) {
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

      if (scene) scene.add(mesh);
      else console.warn('[VoxelWorld] Skipped mesh add: scene is null', mesh);
      chunk.mesh = mesh;
    }

    // Transparent water mesh
    if (wVertCount > 0) {
      const wGeo = new THREE.BufferGeometry();
      wGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPositions, 3));
      wGeo.setAttribute('normal',   new THREE.Float32BufferAttribute(wNormals, 3));
      wGeo.setAttribute('color',    new THREE.Float32BufferAttribute(wColors, 3));
      wGeo.setIndex(wIndices);
      wGeo.computeBoundingSphere();

      const wMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const wMesh = new THREE.Mesh(wGeo, wMat);
      wMesh.position.set(ox * BLOCK_SIZE, 0, oz * BLOCK_SIZE);
      if (scene) scene.add(wMesh);
      else console.warn('[VoxelWorld] Skipped water mesh add: scene is null', wMesh);
      chunk.waterMesh = wMesh;
    }

    chunk.dirty = false;
  }

  /* ── World Init & Update ─────────────────────────────────────────── */
  let _scene = null;
  const HALF = Math.floor(WORLD_CHUNKS / 2);

  function init(scene) {
    _scene = scene || null;
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
    if (Math.random() < 0.2) triggerCityEvent('fire');
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
      if (chunk.waterMesh) {
        _scene.remove(chunk.waterMesh);
        chunk.waterMesh.geometry.dispose();
        chunk.waterMesh.material.dispose();
        chunk.waterMesh = null;
      }
    }
    chunks.clear();
    _roadWaypoints.length = 0;

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
    // PRELOAD: build every chunk synchronously up-front. The budgeted
    // updateDirtyChunks() path is for runtime block edits only — using it
    // here causes visible pop-in on spawn (only 4 chunks/frame appear).
    for (const chunk of chunks.values()) {
      chunk.dirty = true;
    }
    if (typeof chunks !== 'object' || !chunks.values) return;
    for (const chunk of chunks.values()) {
      if (chunk.dirty) buildChunkMesh(chunk, _scene);
    }
  }

  let _rebuildBudget = 4; // max chunks to rebuild per frame (runtime edits only)
  function updateDirtyChunks() {
    let count = 0;
    if (typeof chunks !== 'object' || !chunks.values) {
      console.warn('[VoxelWorld] updateDirtyChunks called with invalid context:', this);
      return {};
    }
    for (const chunk of chunks.values()) {
      if (chunk.dirty) {
        buildChunkMesh(chunk, _scene);
        count++;
        if (count >= _rebuildBudget) break;
      }
    }
    // Update city events/disasters
    if (typeof updateCityEvents === 'function') updateCityEvents(1/60); // assume 60fps step
    // No return value needed; function is for side effects only
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


  // (Removed duplicate/broken getTerrainHeight definition)

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
    { id: 'HOSTOMEL',  name: 'Hostomel Airport',    desc: 'Stop the airborne assault',  theme: 'grassland', wavesPerLevel: 7, difficulty: 1.0, fogColor: 0xD4A017, spawnCandidates: [{ x: 0, z: -22 }, { x: -10, z: -22 }, { x: 10, z: -22 }, { x: -6, z: -26 }, { x: 6, z: -26 }, { x: 0, z: -16 }], spawnLookTarget: { x: 0, z: 18 } },
    { id: 'AVDIIVKA',  name: 'Avdiivka Industrial Zone', desc: 'Hold the coking plant',  theme: 'urban',     wavesPerLevel: 7, difficulty: 1.3, fogColor: 0x3a3028 },
    { id: 'BAKHMUT',   name: 'Bakhmut Ruins',        desc: 'Defend the city',             theme: 'urban',     wavesPerLevel: 7, difficulty: 1.6, fogColor: 0x2a2a2a },
    { id: 'KHERSON',   name: 'Kherson Bridgehead',   desc: 'Cross the Dnipro',            theme: 'grassland', wavesPerLevel: 7, difficulty: 1.9, fogColor: 0xD4A017 },
    { id: 'MARIUPOL',  name: 'Mariupol Steelworks',  desc: 'Fight through Azovstal',      theme: 'industrial', wavesPerLevel: 7, difficulty: 2.2, fogColor: 0x1a1a20 },
    { id: 'CRIMEA',    name: 'Crimea Bridge',        desc: 'Cut the supply line',         theme: 'coastal',   wavesPerLevel: 7, difficulty: 2.5, fogColor: 0x5577aa },
    { id: 'CHORNOBYL', name: 'Chornobyl Zone',       desc: 'Irradiated exclusion zone',   theme: 'wasteland', wavesPerLevel: 7, difficulty: 2.8, fogColor: 0x3a3520 },
    { id: 'MOSCOW',    name: 'Moscow Finale',        desc: 'End it at the Kremlin',       theme: 'cityscape', wavesPerLevel: 9, difficulty: 3.5, fogColor: 0x222228 },
    { id: 'SEVASTOPOL', name: 'Sevastopol Naval Base', desc: 'Destroy the Black Sea Fleet', theme: 'coastal',  wavesPerLevel: 7, difficulty: 3.8, fogColor: 0x3355aa },
    { id: 'DONBAS',    name: 'Donbas Final Push',     desc: 'Liberate the last stronghold', theme: 'urban',   wavesPerLevel: 8, difficulty: 4.2, fogColor: 0x2a2020 },
    { id: 'BELGOROD',  name: 'Belgorod Offensive',    desc: 'Cross into enemy territory',   theme: 'grassland', wavesPerLevel: 8, difficulty: 4.6, fogColor: 0xD4A017 },
    { id: 'KREMLIN',   name: 'Kremlin Showdown',      desc: 'The final battle for peace',   theme: 'cityscape', wavesPerLevel: 10, difficulty: 5.0, fogColor: 0x111118 },
    { id: 'KYIV',      name: 'Siege of Kyiv',         desc: 'Ambush the Russian armored convoy', theme: 'urban', wavesPerLevel: 8, difficulty: 1.5, fogColor: 0x6a7080, tankFocus: true, spawnCandidates: [{ x: 0, z: -24 }, { x: -8, z: -24 }, { x: 8, z: -24 }, { x: -4, z: -28 }, { x: 4, z: -28 }], spawnLookTarget: { x: 0, z: 22 } },
    { id: 'SNAKE',     name: 'Snake Island Defense',  desc: '"Russian warship, go fuck yourself."', theme: 'coastal', wavesPerLevel: 6, difficulty: 1.4, fogColor: 0x4a6680 },
    { id: 'SAKY',      name: 'Saky Airbase Strike',   desc: 'Crimea airbase — ground every Su-24', theme: 'coastal', wavesPerLevel: 7, difficulty: 1.7, fogColor: 0x886644 },
    { id: 'VUHLEDAR',  name: 'Vuhledar Tank Graveyard', desc: 'Bury the 155th in the minefield', theme: 'wasteland', wavesPerLevel: 8, difficulty: 1.9, fogColor: 0x4a4030, tankFocus: true },
    { id: 'ANTONOV',   name: 'Antonov Bridge Strike', desc: 'HIMARS the supply line into Kherson', theme: 'urban', wavesPerLevel: 7, difficulty: 2.0, fogColor: 0x556677 },
    { id: 'REFINERY',  name: 'Refinery Strike (FPV)', desc: 'Fly an FPV drone into the oil refinery', theme: 'industrial', wavesPerLevel: 1, difficulty: 1.6, fogColor: 0x2a2620, droneOnly: true, spawnCandidates: [{ x: 0, z: 50 }], spawnLookTarget: { x: 0, z: 0 } },
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
        const wx = horizontal ? cx + i : cx;
        const wz = horizontal ? cz : cz + i;

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

  function levelArea(minX, maxX, minZ, maxZ, surfaceY, topBlock, fillBlock) {
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = 0; y < surfaceY; y++) {
          setBlock(x, y, z, fillBlock);
        }
        setBlock(x, surfaceY, z, topBlock);
        for (let y = surfaceY + 1; y <= surfaceY + 18; y++) {
          setBlock(x, y, z, BLOCK.AIR);
        }
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

  // Replaces old grid with new variety grid
  // Usage: generateStreetGridVariety(ox, oz, gridW, gridD, blockSize);

  /* ── Road Generation System ─────────────────────────────────────── */
  // Stores road waypoints for vehicle AI to follow
  const _roadWaypoints = [];
  let _levelSpawnPoint = { x: 0, y: 0, z: 0 };

  function hasStableSpawnFooting(x, z, groundY) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const localY = getTerrainHeight(x + dx, z + dz);
        if (Math.abs(localY - groundY) > 1) return false;
      }
    }
    return true;
  }

  function isSpawnAreaClear(x, z, groundY, lookTarget) {
    const baseY = Math.floor(groundY) + 1;
    const ix = Math.round(x);
    const iz = Math.round(z);

    if (!hasStableSpawnFooting(ix, iz, groundY)) return false;

    // Require a wider clear bubble around the player body.
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (isSolid(ix + dx, baseY, iz + dz) || isSolid(ix + dx, baseY + 1, iz + dz)) {
          return false;
        }
      }
    }

    // Require generous headroom so spawn framing doesn't start under eaves/roofs.
    for (let dy = 2; dy <= 5; dy++) {
      if (isSolid(ix, baseY + dy, iz)) return false;
    }

    let dirX = 0;
    let dirZ = 1;
    if (lookTarget && isFinite(lookTarget.x) && isFinite(lookTarget.z)) {
      const dx = lookTarget.x - x;
      const dz = lookTarget.z - z;
      const len = Math.hypot(dx, dz);
      if (len > 0.001) {
        dirX = dx / len;
        dirZ = dz / len;
      }
    }

    // Keep the immediate view corridor open in the direction the stage intro camera will face.
    for (let step = 1; step <= 12; step++) {
      for (let lateral = -3; lateral <= 3; lateral++) {
        const sampleX = Math.round(x + dirX * step + dirZ * lateral);
        const sampleZ = Math.round(z + dirZ * step - dirX * lateral);
        if (isSolid(sampleX, baseY + 1, sampleZ)) return false;
        if (isSolid(sampleX, baseY + 2, sampleZ)) return false;
      }
    }

    return true;
  }

  function scoreSpawnCandidate(x, z, originX, originZ) {
    const centerH = getTerrainHeight(x, z);
    let variance = 0;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        variance += Math.abs(getTerrainHeight(x + dx, z + dz) - centerH);
      }
    }
    const distPenalty = Math.abs(x - originX) + Math.abs(z - originZ);
    return variance + distPenalty * 0.15;
  }

  function resolveLevelSpawnPoint(level) {
    const preferred = level && Array.isArray(level.spawnCandidates) ? level.spawnCandidates : [];
    const fallback = [
      { x: 0, z: 0 },
      { x: 0, z: 8 },
      { x: 8, z: 0 },
      { x: -8, z: 0 },
      { x: 0, z: -8 },
      { x: 16, z: 8 },
      { x: -16, z: 8 },
      { x: 12, z: -12 },
      { x: -12, z: -12 },
    ];
    const candidates = preferred.concat(fallback);
    const anchor = candidates[0] || { x: 0, z: 0 };
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const groundY = getTerrainHeight(candidate.x, candidate.z);
      if (!isSpawnAreaClear(candidate.x, candidate.z, groundY, level && level.spawnLookTarget)) continue;

      const score = scoreSpawnCandidate(candidate.x, candidate.z, anchor.x, anchor.z);
      if (score < bestScore) {
        bestScore = score;
        best = { x: candidate.x, y: groundY, z: candidate.z };
      }
    }

    if (best) return best;

    const fallbackGround = getTerrainHeight(0, 0);
    return { x: 0, y: fallbackGround, z: 0 };
  }

  function getSpawnPoint() {
    return { x: _levelSpawnPoint.x, y: _levelSpawnPoint.y, z: _levelSpawnPoint.z };
  }

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
      if (steps === 0) return undefined;
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
            // Place props along the road
            if (wx === -hw && s % 12 === 0 && Math.random() > 0.7) placeBench(bx - 1, h + 1, bz);
            if (wx === hw && s % 16 === 0 && Math.random() > 0.8) {
              if (Math.random() > 0.5) placeCar(bx + 1, h + 1, bz);
              else if (Math.random() > 0.5) placeTruck(bx + 1, h + 1, bz);
              else placeBus(bx + 1, h + 1, bz);
            }
            if (wx === 0 && s % 10 === 0 && Math.random() > 0.6) {
              placeBush(bx, h + 1, bz + 1);
              if (Math.random() > 0.7) placeMailbox(bx, h + 1, bz);
              if (Math.random() > 0.8) placeStreetSign(bx, h + 1, bz + 2);
              if (Math.random() > 0.85) placeBusStop(bx, h + 1, bz - 1);
            }
          } else {
            // Primarily vertical road — expand in X
            const bx = cx + wx;
            const bz = cz + 0;
            const h = getTerrainHeight(bx, bz);
            setBlock(bx, h, bz, BLOCK.ASPHALT);
            // Place props along the road
            if (wz === -hw && s % 12 === 0 && Math.random() > 0.7) placeBench(bx, h + 1, bz - 1);
            if (wz === hw && s % 16 === 0 && Math.random() > 0.8) {
              if (Math.random() > 0.5) placeCar(bx, h + 1, bz + 1);
              else if (Math.random() > 0.5) placeTruck(bx, h + 1, bz + 1);
              else placeBus(bx, h + 1, bz + 1);
            }
            if (wz === 0 && s % 10 === 0 && Math.random() > 0.6) {
              placeBush(bx + 1, h + 1, bz);
              if (Math.random() > 0.7) placeMailbox(bx + 2, h + 1, bz);
              if (Math.random() > 0.8) placeStreetSign(bx, h + 1, bz + 2);
              if (Math.random() > 0.85) placeBusStop(bx - 1, h + 1, bz);
            }
          }
        }
      }
      // Register waypoints every 8 blocks for vehicle road-following
      if (s % 8 === 0) {
        const h = getTerrainHeight(cx, cz);
        _roadWaypoints.push(new THREE.Vector3(cx, h + 0.5, cz));
        // Place streetlights at major waypoints
        if (Math.random() > 0.5) placeStreetlight(cx, h + 1, cz);
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
      if (floors < 2) return undefined; // Not enough room for a building
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

  /* ── Ukrainian Apartment Building (6 or 12 stories, full interior) ── */
  function generateUkrainianApartment(ox, oz, stories) {
    const surfH = getTerrainHeight(ox, oz);
    const W = 18;   // width (x axis)
    const D = 10;   // depth (z axis)
    const FH = 3;   // floor height (slab-to-slab)
    stories = stories || 6;

    // Cap floors to chunk height
    const maxFloors = Math.floor((CHUNK_HEIGHT - surfH - 2) / FH);
    stories = Math.min(stories, maxFloors);
    if (stories < 3) return;

    // Register this building so missions (CLEAR_BUILDING) can target it.
    _buildings.push({
      kind: 'apartment',
      x: ox, z: oz, w: W, d: D,
      baseY: surfH, floorH: FH, floors: stories,
      // Hallway center for enemy placement
      cx: ox + Math.floor(W / 2),
      cz: oz + Math.floor(D / 2),
    });

    // Hallway runs at z-center: z offsets 4 and 5 (2-block wide corridor)
    const hallZ1 = 4;
    const hallZ2 = 5;
    // Stairwell zone at x=1..3
    const stairX1 = 1;
    const stairX2 = 3;
    // Apartment dividing walls (x positions)
    const dividers = [6, 11, 15];
    // Door positions into apartments (centered in each bay)
    const doorXPositions = [4, 8, 13, 16];

    for (let floor = 0; floor < stories; floor++) {
      const baseY = surfH + floor * FH;

      // ─── Floor slab ───
      for (let x = 0; x < W; x++) {
        for (let z = 0; z < D; z++) {
          setBlock(ox + x, baseY, oz + z, BLOCK.CONCRETE);
        }
      }

      // ─── Clear interior air (between slabs) ───
      for (let dy = 1; dy < FH; dy++) {
        for (let x = 1; x < W - 1; x++) {
          for (let z = 1; z < D - 1; z++) {
            setBlock(ox + x, baseY + dy, oz + z, BLOCK.AIR);
          }
        }
      }

      // ─── Exterior walls ───
      for (let dy = 1; dy < FH; dy++) {
        for (let x = 0; x < W; x++) {
          setBlock(ox + x, baseY + dy, oz, BLOCK.CONCRETE);           // front
          setBlock(ox + x, baseY + dy, oz + D - 1, BLOCK.CONCRETE);   // back
        }
        for (let z = 0; z < D; z++) {
          setBlock(ox, baseY + dy, oz + z, BLOCK.CONCRETE);           // left
          setBlock(ox + W - 1, baseY + dy, oz + z, BLOCK.CONCRETE);   // right
        }
      }

      // ─── Hallway walls (blue bottom / white top) ───
      for (let x = 1; x < W - 1; x++) {
        // Skip stairwell area
        if (x >= stairX1 && x <= stairX2 + 1) continue;
        // South hallway wall (z = hallZ1 - 1 = 3)
        setBlock(ox + x, baseY + 1, oz + hallZ1 - 1, BLOCK.BLUE_TILE);
        if (FH > 2) setBlock(ox + x, baseY + 2, oz + hallZ1 - 1, BLOCK.WHITE_TILE);
        // North hallway wall (z = hallZ2 + 1 = 6)
        setBlock(ox + x, baseY + 1, oz + hallZ2 + 1, BLOCK.BLUE_TILE);
        if (FH > 2) setBlock(ox + x, baseY + 2, oz + hallZ2 + 1, BLOCK.WHITE_TILE);
      }

      // ─── Apartment dividing walls ───
      for (var di = 0; di < dividers.length; di++) {
        var dx = dividers[di];
        if (dx >= W - 1) continue;
        for (let dy = 1; dy < FH; dy++) {
          // South-side apartments (z = 1..hallZ1-2)
          for (let z = 1; z <= hallZ1 - 2; z++) {
            setBlock(ox + dx, baseY + dy, oz + z, BLOCK.PLASTER);
          }
          // North-side apartments (z = hallZ2+2..D-2)
          for (let z = hallZ2 + 2; z <= D - 2; z++) {
            setBlock(ox + dx, baseY + dy, oz + z, BLOCK.PLASTER);
          }
        }
      }

      // ─── Apartment doorways to hallway ───
      for (var ddi = 0; ddi < doorXPositions.length; ddi++) {
        var ddx = doorXPositions[ddi];
        if (ddx <= stairX2 + 1 || ddx >= W - 1) continue;
        // South apartment doors
        setBlock(ox + ddx, baseY + 1, oz + hallZ1 - 1, BLOCK.AIR);
        setBlock(ox + ddx, baseY + 2, oz + hallZ1 - 1, BLOCK.AIR);
        // North apartment doors
        setBlock(ox + ddx, baseY + 1, oz + hallZ2 + 1, BLOCK.AIR);
        setBlock(ox + ddx, baseY + 2, oz + hallZ2 + 1, BLOCK.AIR);
      }

      // ─── Windows (exterior) ───
      for (let x = 2; x < W - 2; x += 3) {
        // Front windows (south)
        setBlock(ox + x, baseY + 1, oz, BLOCK.GLASS);
        if (FH > 2) setBlock(ox + x, baseY + 2, oz, BLOCK.GLASS);
        // Back windows (north)
        setBlock(ox + x, baseY + 1, oz + D - 1, BLOCK.GLASS);
        if (FH > 2) setBlock(ox + x, baseY + 2, oz + D - 1, BLOCK.GLASS);
      }
      // Side windows
      for (let z = 2; z < D - 2; z += 3) {
        setBlock(ox, baseY + 1, oz + z, BLOCK.GLASS);
        if (FH > 2) setBlock(ox, baseY + 2, oz + z, BLOCK.GLASS);
        setBlock(ox + W - 1, baseY + 1, oz + z, BLOCK.GLASS);
        if (FH > 2) setBlock(ox + W - 1, baseY + 2, oz + z, BLOCK.GLASS);
      }

      // ─── Sniper windows: remove glass on upper floors for shooting ───
      if (floor >= 3) {
        // Open a few windows on each upper floor (front and back only)
        var sniperX = 5 + (floor % 3) * 4;
        if (sniperX < W - 2) {
          setBlock(ox + sniperX, baseY + 1, oz, BLOCK.AIR);
          if (FH > 2) setBlock(ox + sniperX, baseY + 2, oz, BLOCK.AIR);
          setBlock(ox + sniperX, baseY + 1, oz + D - 1, BLOCK.AIR);
          if (FH > 2) setBlock(ox + sniperX, baseY + 2, oz + D - 1, BLOCK.AIR);
        }
      }

      // ─── Stairwell ───
      // Stairwell walls (blue tiles)
      for (let dy = 1; dy < FH; dy++) {
        // East stairwell wall separating from hallway
        for (let z = hallZ1 - 1; z <= hallZ2 + 1; z++) {
          setBlock(ox + stairX2 + 1, baseY + dy, oz + z, BLOCK.BLUE_TILE);
        }
        // Blue accent on side walls inside stairwell
        for (let x = stairX1; x <= stairX2; x++) {
          setBlock(ox + x, baseY + 1, oz + hallZ1 - 1, BLOCK.BLUE_TILE);
          setBlock(ox + x, baseY + 1, oz + hallZ2 + 1, BLOCK.BLUE_TILE);
        }
      }

      // Stairwell door from hallway
      setBlock(ox + stairX2 + 1, baseY + 1, oz + hallZ1, BLOCK.AIR);
      setBlock(ox + stairX2 + 1, baseY + 2, oz + hallZ1, BLOCK.AIR);

      // Ladder blocks (alternating sides each floor for realism)
      if (floor % 2 === 0) {
        setBlock(ox + stairX1, baseY + 1, oz + hallZ1, BLOCK.LADDER);
        setBlock(ox + stairX1, baseY + 2, oz + hallZ1, BLOCK.LADDER);
        // Hole in ceiling above ladder for floor access
        if (floor < stories - 1) {
          setBlock(ox + stairX1, baseY + FH, oz + hallZ1, BLOCK.AIR);
        }
      } else {
        setBlock(ox + stairX2, baseY + 1, oz + hallZ2, BLOCK.LADDER);
        setBlock(ox + stairX2, baseY + 2, oz + hallZ2, BLOCK.LADDER);
        if (floor < stories - 1) {
          setBlock(ox + stairX2, baseY + FH, oz + hallZ2, BLOCK.AIR);
        }
      }
      // Also open the opposite side's ceiling hole for descent
      if (floor > 0) {
        if (floor % 2 === 0) {
          setBlock(ox + stairX2, baseY, oz + hallZ2, BLOCK.AIR);
        } else {
          setBlock(ox + stairX1, baseY, oz + hallZ1, BLOCK.AIR);
        }
      }
    }

    // ─── Roof slab ───
    var roofY = surfH + stories * FH;
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        setBlock(ox + x, roofY, oz + z, BLOCK.CONCRETE);
      }
    }
    // Roof access hatch
    setBlock(ox + stairX1 + 1, roofY, oz + hallZ1 + 1, BLOCK.AIR);

    // ─── Ground floor entrances ───
    // Front entrance (centered)
    var entranceX = Math.floor(W / 2);
    setBlock(ox + entranceX, surfH, oz, BLOCK.AIR);
    setBlock(ox + entranceX, surfH + 1, oz, BLOCK.AIR);
    setBlock(ox + entranceX, surfH + 2, oz, BLOCK.AIR);
    setBlock(ox + entranceX + 1, surfH, oz, BLOCK.AIR);
    setBlock(ox + entranceX + 1, surfH + 1, oz, BLOCK.AIR);
    setBlock(ox + entranceX + 1, surfH + 2, oz, BLOCK.AIR);
    // Back entrance
    setBlock(ox + entranceX, surfH, oz + D - 1, BLOCK.AIR);
    setBlock(ox + entranceX, surfH + 1, oz + D - 1, BLOCK.AIR);
    setBlock(ox + entranceX, surfH + 2, oz + D - 1, BLOCK.AIR);
    // Side entrance (stairwell)
    setBlock(ox, surfH, oz + hallZ1, BLOCK.AIR);
    setBlock(ox, surfH + 1, oz + hallZ1, BLOCK.AIR);
    setBlock(ox, surfH + 2, oz + hallZ1, BLOCK.AIR);
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
      const r = Math.random();
      if (r < 0.30)      generateWreckedTank(vx, vz);
      else if (r < 0.50) generateWreckedAPC(vx, vz);
      else if (r < 0.70) generateWreckedCar(vx, vz);
      else if (r < 0.85) generateWreckedTruck(vx, vz);
      else if (r < 0.95) generateWreckedBus(vx, vz);
      else               generateWreckedAmbulance(vx, vz);
    }
  }

  // ── Wrecked T-72 / BMP-style tank: hull, blown turret, broken track,
  //    open hatch, scorched hull, oil/fuel rubble, ammo cookoff blast ring.
  function generateWreckedTank(ox, oz) {
    const h = getTerrainHeight(ox, oz);
    if (h < 1) return;
    // Hull (6x3x2) — METAL
    for (let x = 0; x < 6; x++) {
      for (let z = 0; z < 3; z++) {
        setBlock(ox + x, h + 1, oz + z, BLOCK.METAL);
        if (x > 0 && x < 5) setBlock(ox + x, h + 2, oz + z, BLOCK.METAL);
      }
    }
    // Tracks — left & right rows, partly blown off
    for (let x = 0; x < 6; x++) {
      if (Math.random() < 0.7) setBlock(ox + x, h + 1, oz - 1, BLOCK.METAL);
      if (Math.random() < 0.7) setBlock(ox + x, h + 1, oz + 3, BLOCK.METAL);
    }
    // Turret BLOWN OFF — landed beside hull, upside-down
    const turX = ox + 3 + (Math.random() < 0.5 ? -5 : 5);
    const turZ = oz + (Math.random() < 0.5 ? -3 : 4);
    for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) {
      setBlock(turX + x, h + 1, turZ + z, BLOCK.METAL);
    }
    // Gun barrel sticking from displaced turret
    for (let i = 0; i < 4; i++) setBlock(turX - 1 - i, h + 1, turZ, BLOCK.METAL);
    // Hatch hole (open) on top of hull
    setBlock(ox + 2, h + 3, oz + 1, BLOCK.AIR);
    // Scorch/oil ring
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 2 + Math.random() * 4;
      const rx = ox + 3 + Math.floor(Math.cos(ang) * rad);
      const rz = oz + 1 + Math.floor(Math.sin(ang) * rad);
      const rh = getTerrainHeight(rx, rz);
      if (rh > 0) setBlock(rx, rh + 1, rz, BLOCK.RUBBLE);
    }
    // Fire pocket on hull (cookoff)
    if (Math.random() < 0.6) setBlock(ox + 2, h + 3, oz + 1, BLOCK.FIRE);
  }

  // ── Wrecked BTR / MT-LB APC: 8-wheeled-style wider hull, blown roof, no turret.
  function generateWreckedAPC(ox, oz) {
    const h = getTerrainHeight(ox, oz);
    if (h < 1) return;
    for (let x = 0; x < 7; x++) {
      for (let z = 0; z < 3; z++) {
        setBlock(ox + x, h + 1, oz + z, BLOCK.METAL);
        if (x > 0 && x < 6 && Math.random() > 0.15) setBlock(ox + x, h + 2, oz + z, BLOCK.METAL);
      }
    }
    // Roof blown — random gaps
    for (let x = 1; x < 6; x++) for (let z = 0; z < 3; z++) {
      if (Math.random() < 0.4) setBlock(ox + x, h + 2, oz + z, BLOCK.AIR);
    }
    // Wheels (visible as METAL pylons on each side)
    for (let i = 0; i < 4; i++) {
      const wx = ox + 1 + i * 1.5 | 0;
      if (Math.random() < 0.7) setBlock(wx, h + 1, oz - 1, BLOCK.METAL);
      if (Math.random() < 0.7) setBlock(wx, h + 1, oz + 3, BLOCK.METAL);
    }
    // Debris ring
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 2 + Math.random() * 3;
      const rx = ox + 3 + Math.floor(Math.cos(ang) * rad);
      const rz = oz + 1 + Math.floor(Math.sin(ang) * rad);
      const rh = getTerrainHeight(rx, rz);
      if (rh > 0) setBlock(rx, rh + 1, rz, BLOCK.RUBBLE);
    }
    if (Math.random() < 0.4) setBlock(ox + 3, h + 2, oz + 1, BLOCK.FIRE);
  }

  // ── Wrecked civilian car: small, flipped, smashed glass.
  function generateWreckedCar(ox, oz) {
    const h = getTerrainHeight(ox, oz);
    if (h < 1) return;
    const flipped = Math.random() < 0.4;
    // Body 3x2
    for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) {
      setBlock(ox + x, h + 1, oz + z, BLOCK.METAL);
    }
    if (!flipped) {
      // Roof / cabin
      for (let x = 1; x < 3; x++) {
        setBlock(ox + x, h + 2, oz, Math.random() < 0.6 ? BLOCK.METAL : BLOCK.GLASS);
        setBlock(ox + x, h + 2, oz + 1, Math.random() < 0.6 ? BLOCK.METAL : BLOCK.GLASS);
      }
      // Hood blown open (RUBBLE on engine)
      setBlock(ox, h + 1, oz, BLOCK.RUBBLE);
    } else {
      // Flipped: wheels up
      setBlock(ox, h + 2, oz, BLOCK.METAL);
      setBlock(ox + 2, h + 2, oz, BLOCK.METAL);
      setBlock(ox, h + 2, oz + 1, BLOCK.METAL);
      setBlock(ox + 2, h + 2, oz + 1, BLOCK.METAL);
    }
    // Glass shards around
    for (let i = 0; i < 5; i++) {
      const rx = ox + Math.floor((Math.random() - 0.5) * 6);
      const rz = oz + Math.floor((Math.random() - 0.5) * 6);
      const rh = getTerrainHeight(rx, rz);
      if (rh > 0) setBlock(rx, rh + 1, rz, Math.random() < 0.4 ? BLOCK.GLASS : BLOCK.RUBBLE);
    }
    if (Math.random() < 0.25) setBlock(ox + 1, h + 2, oz, BLOCK.FIRE);
  }

  // ── Wrecked civilian truck (fuel/grain truck): longer, cargo bed crushed.
  function generateWreckedTruck(ox, oz) {
    const h = getTerrainHeight(ox, oz);
    if (h < 1) return;
    // Cab 2x2
    for (let x = 0; x < 2; x++) for (let z = 0; z < 2; z++) {
      setBlock(ox + x, h + 1, oz + z, BLOCK.METAL);
      setBlock(ox + x, h + 2, oz + z, x === 0 ? BLOCK.GLASS : BLOCK.METAL);
    }
    // Cargo bed 4x2 (some crushed)
    for (let x = 2; x < 6; x++) for (let z = 0; z < 2; z++) {
      setBlock(ox + x, h + 1, oz + z, BLOCK.METAL);
      if (Math.random() < 0.7) setBlock(ox + x, h + 2, oz + z, BLOCK.RUBBLE);
    }
    // Wheels visual hint
    for (let x = 0; x < 6; x += 2) {
      setBlock(ox + x, h + 1, oz - 1, BLOCK.METAL);
      setBlock(ox + x, h + 1, oz + 2, BLOCK.METAL);
    }
    // Fuel spill / scorch
    for (let i = 0; i < 8; i++) {
      const rx = ox + Math.floor((Math.random() - 0.5) * 8);
      const rz = oz + Math.floor((Math.random() - 0.5) * 8);
      const rh = getTerrainHeight(rx, rz);
      if (rh > 0) setBlock(rx, rh + 1, rz, BLOCK.RUBBLE);
    }
    if (Math.random() < 0.5) setBlock(ox + 3, h + 2, oz + 1, BLOCK.FIRE);
  }

  // ── Wrecked bus (yellow/marshrutka style): long hull, broken windows row.
  function generateWreckedBus(ox, oz) {
    const h = getTerrainHeight(ox, oz);
    if (h < 1) return;
    for (let x = 0; x < 8; x++) for (let z = 0; z < 2; z++) {
      setBlock(ox + x, h + 1, oz + z, BLOCK.METAL);
      // Window row — half blown out
      if (Math.random() < 0.45) setBlock(ox + x, h + 2, oz + z, BLOCK.GLASS);
      // Roof (some collapsed)
      if (Math.random() < 0.5) setBlock(ox + x, h + 3, oz + z, BLOCK.METAL);
    }
    // Wheels
    for (let x = 1; x < 8; x += 3) {
      setBlock(ox + x, h + 1, oz - 1, BLOCK.METAL);
      setBlock(ox + x, h + 1, oz + 2, BLOCK.METAL);
    }
    // Glass shards & rubble
    for (let i = 0; i < 12; i++) {
      const rx = ox + Math.floor((Math.random() - 0.5) * 10);
      const rz = oz + Math.floor((Math.random() - 0.5) * 6);
      const rh = getTerrainHeight(rx, rz);
      if (rh > 0) setBlock(rx, rh + 1, rz, Math.random() < 0.4 ? BLOCK.GLASS : BLOCK.RUBBLE);
    }
    if (Math.random() < 0.4) setBlock(ox + 4, h + 3, oz + 1, BLOCK.FIRE);
  }

  // ── Wrecked ambulance / civilian van: shorter than bus, RED-CROSS hint via FLAG block.
  function generateWreckedAmbulance(ox, oz) {
    const h = getTerrainHeight(ox, oz);
    if (h < 1) return;
    for (let x = 0; x < 5; x++) for (let z = 0; z < 2; z++) {
      setBlock(ox + x, h + 1, oz + z, BLOCK.METAL);
      setBlock(ox + x, h + 2, oz + z, x < 2 ? BLOCK.GLASS : BLOCK.METAL);
    }
    // Red cross marker (SIGN block on side if available)
    setBlock(ox + 3, h + 2, oz - 1, BLOCK.SIGN || BLOCK.METAL);
    // Wheels
    setBlock(ox, h + 1, oz - 1, BLOCK.METAL);
    setBlock(ox + 4, h + 1, oz - 1, BLOCK.METAL);
    setBlock(ox, h + 1, oz + 2, BLOCK.METAL);
    setBlock(ox + 4, h + 1, oz + 2, BLOCK.METAL);
    // Rubble ring
    for (let i = 0; i < 6; i++) {
      const rx = ox + Math.floor((Math.random() - 0.5) * 7);
      const rz = oz + Math.floor((Math.random() - 0.5) * 5);
      const rh = getTerrainHeight(rx, rz);
      if (rh > 0) setBlock(rx, rh + 1, rz, BLOCK.RUBBLE);
    }
    if (Math.random() < 0.3) setBlock(ox + 2, h + 2, oz + 1, BLOCK.FIRE);
  }

  // Convoy cluster: 2-4 wrecks lined up along an axis (ambushed column).
  function generateWreckedConvoy(ox, oz) {
    const horizontal = Math.random() < 0.5;
    const cnt = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < cnt; i++) {
      const off = i * (8 + Math.floor(Math.random() * 4));
      const cx = ox + (horizontal ? off : 0);
      const cz = oz + (horizontal ? 0 : off);
      const r = Math.random();
      if (r < 0.4)      generateWreckedTank(cx, cz);
      else if (r < 0.7) generateWreckedAPC(cx, cz);
      else              generateWreckedTruck(cx, cz);
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
  function generateBridgeFortification(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
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

  // ─── Kyiv Maidan Nezalezhnosti — historical recreation ─────────────
  // Recreates the Independence Square / Khreshchatyk approach where
  // Russian armored columns were stopped on the road into Kyiv (Feb–Mar 2022).
  // Layout (looking down, +Z is south = player side, -Z is north = tank approach):
  //   z=-45..-15  approach highway flanked by 9-story Soviet apartments
  //   z=-15..+10  central plaza with Independence Monument + roundabout
  //   z=+5..+15   gold-domed Orthodox church (east) + government building (west)
  //   z=+18..+22  Ukrainian defensive line: hedgehogs, sandbags, parked busses
  function generateKyivMaidanSquare(ox, oz) {
    var bx = ox, bz = oz; // origin = plaza center
    function gh(x, z) { return getTerrainHeight(x, z); }

    // ── 1. North–South main avenue (Khreshchatyk-style boulevard, 10 wide)
    for (var z = -45; z <= 25; z++) {
      for (var x = -5; x <= 5; x++) {
        var ay = gh(bx + x, bz + z);
        setBlock(bx + x, ay, bz + z, BLOCK.ASPHALT);
      }
      // Center white road markings (dashed)
      if ((z % 3) === 0) {
        var my = gh(bx, bz + z);
        setBlock(bx, my, bz + z, BLOCK.WHITE_TILE);
      }
      // Yellow shoulder lines (every block, edge of asphalt)
      var sy = gh(bx - 5, bz + z);
      setBlock(bx - 5, sy, bz + z, BLOCK.WHITE_TILE);
      setBlock(bx + 5, sy, bz + z, BLOCK.WHITE_TILE);
    }

    // ── 2. East–West cross avenue at plaza (8 wide)
    for (var x2 = -30; x2 <= 30; x2++) {
      for (var z2 = -2; z2 <= 5; z2++) {
        var ay2 = gh(bx + x2, bz + z2);
        setBlock(bx + x2, ay2, bz + z2, BLOCK.ASPHALT);
      }
      if ((x2 % 3) === 0) setBlock(bx + x2, gh(bx + x2, bz + 1), bz + 1, BLOCK.WHITE_TILE);
    }

    // ── 3. Crosswalks at intersection (zebra stripes)
    function crosswalk(cx, cz, dir) {
      // dir 'h' = horizontal stripes across z, 'v' = vertical
      for (var i = 0; i < 8; i++) {
        if (dir === 'h') {
          if (i % 2 === 0) {
            for (var k = -4; k <= 4; k++) {
              setBlock(cx + k, gh(cx + k, cz + i - 4), cz + i - 4, BLOCK.WHITE_TILE);
            }
          }
        } else {
          if (i % 2 === 0) {
            for (var k2 = -4; k2 <= 4; k2++) {
              setBlock(cx + i - 4, gh(cx + i - 4, cz + k2), cz + k2, BLOCK.WHITE_TILE);
            }
          }
        }
      }
    }
    crosswalk(bx, bz - 8, 'h');
    crosswalk(bx, bz + 10, 'h');

    // ── 4. Stoplights at the four corners of the intersection
    function stoplight(sx, sz) {
      var y = gh(bx + sx, bz + sz);
      setBlock(bx + sx, y + 1, bz + sz, BLOCK.METAL);
      setBlock(bx + sx, y + 2, bz + sz, BLOCK.METAL);
      setBlock(bx + sx, y + 3, bz + sz, BLOCK.METAL);
      setBlock(bx + sx, y + 4, bz + sz, BLOCK.METAL);
      setBlock(bx + sx, y + 5, bz + sz, BLOCK.LIGHT); // light fixture
    }
    stoplight(-7, -4); stoplight(7, -4);
    stoplight(-7, 7);  stoplight(7, 7);

    // ── 5. Independence Square center: Monument (column with statue)
    var cy = gh(bx, bz + 1);
    // Circular roundabout base (10 radius)
    for (var rx = -10; rx <= 10; rx++) {
      for (var rz = -8; rz <= 8; rz++) {
        var d = Math.sqrt(rx * rx + rz * rz);
        if (d > 7 && d < 9) {
          var py = gh(bx + rx, bz + rz);
          setBlock(bx + rx, py, bz + rz, BLOCK.WHITE_TILE);
        }
      }
    }
    // Monument column (Berehynia-style — 12 high)
    for (var my2 = 0; my2 < 12; my2++) {
      setBlock(bx, cy + 1 + my2, bz + 1, BLOCK.CONCRETE);
    }
    // Gold orb on top (statue)
    setBlock(bx, cy + 13, bz + 1, BLOCK.METAL);
    setBlock(bx, cy + 14, bz + 1, BLOCK.LIGHT);
    setBlock(bx - 1, cy + 13, bz + 1, BLOCK.METAL);
    setBlock(bx + 1, cy + 13, bz + 1, BLOCK.METAL);
    // Pedestal (4x4 concrete base)
    for (var pbx = -1; pbx <= 1; pbx++) {
      for (var pbz = 0; pbz <= 2; pbz++) {
        setBlock(bx + pbx, cy + 1, bz + pbz, BLOCK.CONCRETE);
      }
    }

    // ── 6. Soviet 9-story apartments lining the approach (west + east)
    // West side
    generateUkrainianApartment(bx - 24, bz - 38, 9);
    generateUkrainianApartment(bx - 24, bz - 22, 9);
    generateUkrainianApartment(bx - 24, bz - 6, 6);
    // East side
    generateUkrainianApartment(bx + 12, bz - 38, 9);
    generateUkrainianApartment(bx + 12, bz - 22, 9);
    generateUkrainianApartment(bx + 12, bz - 6, 6);

    // ── 7. Hotel Ukraina-style tall building at north end of plaza
    var hx = bx - 6, hz = bz - 18;
    var hy = gh(hx, hz);
    for (var hbx = 0; hbx < 12; hbx++) {
      for (var hbz = 0; hbz < 8; hbz++) {
        for (var hby = 0; hby < 18; hby++) {
          var isShell = hbx === 0 || hbx === 11 || hbz === 0 || hbz === 7 || hby === 17;
          if (isShell) {
            setBlock(hx + hbx, hy + hby, hz + hbz, BLOCK.CONCRETE);
          } else if (hby > 0 && hby < 17 && hby % 3 === 0 && (hbx === 0 || hbx === 11)) {
            setBlock(hx + hbx, hy + hby, hz + hbz, BLOCK.GLASS);
          }
        }
      }
    }
    // Hotel entrance
    setBlock(hx + 5, hy, hz + 7, BLOCK.AIR);
    setBlock(hx + 5, hy + 1, hz + 7, BLOCK.AIR);
    setBlock(hx + 6, hy, hz + 7, BLOCK.AIR);
    setBlock(hx + 6, hy + 1, hz + 7, BLOCK.AIR);

    // ── 8. Gold-domed Orthodox church (east of plaza)
    generateChurch(bx + 14, bz + 8);
    // Replace church steeple metal cross with gold dome (LIGHT block = bright/gold)
    var churchSurfH = gh(bx + 14, bz + 8);
    for (var dy = 0; dy < 2; dy++) {
      for (var ddx = -1; ddx <= 1; ddx++) {
        for (var ddz = -1; ddz <= 1; ddz++) {
          if (Math.abs(ddx) + Math.abs(ddz) <= 1) {
            setBlock(bx + 14 + 3 + ddx, churchSurfH + 12 + dy, bz + 8 + 2 + ddz, BLOCK.LIGHT);
          }
        }
      }
    }

    // ── 9. Government building (west of plaza)
    var gx = bx - 18, gz = bz + 6;
    var gy = gh(gx, gz);
    for (var gbx = 0; gbx < 14; gbx++) {
      for (var gbz = 0; gbz < 8; gbz++) {
        for (var gby = 0; gby < 8; gby++) {
          var isGShell = gbx === 0 || gbx === 13 || gbz === 0 || gbz === 7 || gby === 7;
          if (isGShell) setBlock(gx + gbx, gy + gby, gz + gbz, BLOCK.STONE);
          else if (gby >= 2 && gby <= 5 && gbx % 2 === 0 && (gbz === 0 || gbz === 7)) {
            setBlock(gx + gbx, gy + gby, gz + gbz, BLOCK.GLASS);
          }
        }
      }
    }
    // Pillared facade (classical Soviet style)
    for (var pIdx = 0; pIdx < 5; pIdx++) {
      var pcx = gx + 1 + pIdx * 3;
      for (var pcy = 0; pcy < 6; pcy++) {
        setBlock(pcx, gy + pcy, gz - 1, BLOCK.STONE);
      }
    }
    // Ukrainian flag on top
    setBlock(gx + 6, gy + 8, gz + 3, BLOCK.METAL);
    setBlock(gx + 6, gy + 9, gz + 3, BLOCK.METAL);
    setBlock(gx + 6, gy + 10, gz + 3, BLOCK.FLAG);

    // ── 10. Civilian vehicles parked along avenue + on approach road
    function placeVehicle(vx, vz, type) {
      var vy = gh(bx + vx, bz + vz);
      var b = (type === 'bus') ? BLOCK.BUS : (type === 'truck') ? BLOCK.TRUCK : BLOCK.CAR;
      var len = (type === 'bus') ? 5 : (type === 'truck') ? 4 : 3;
      for (var vi = 0; vi < len; vi++) {
        setBlock(bx + vx + vi, vy + 1, bz + vz, b);
        if (type === 'bus' || type === 'truck') {
          setBlock(bx + vx + vi, vy + 2, bz + vz, b);
        }
      }
    }
    placeVehicle(-9, -36, 'bus');
    placeVehicle(7, -32, 'truck');
    placeVehicle(-9, -28, 'car');
    placeVehicle(7, -24, 'car');
    placeVehicle(-9, -20, 'truck');
    placeVehicle(7, -16, 'bus');
    placeVehicle(-9, 12, 'car');
    placeVehicle(7, 14, 'bus');

    // ── 11. Streetlights every 8 along the avenue
    for (var slz = -40; slz <= 20; slz += 8) {
      var sly1 = gh(bx - 6, bz + slz);
      var sly2 = gh(bx + 6, bz + slz);
      for (var sly = 1; sly <= 4; sly++) {
        setBlock(bx - 6, sly1 + sly, bz + slz, BLOCK.STREETLIGHT);
        setBlock(bx + 6, sly2 + sly, bz + slz, BLOCK.STREETLIGHT);
      }
      setBlock(bx - 6, sly1 + 5, bz + slz, BLOCK.LIGHT);
      setBlock(bx + 6, sly2 + 5, bz + slz, BLOCK.LIGHT);
    }

    // ── 12. Ukrainian defensive line (south = player side)
    // Anti-tank hedgehogs (Czech hedgehogs) blocking the avenue
    var hedgePositions = [[-4, 18], [-2, 19], [0, 18], [2, 19], [4, 18], [-3, 20], [3, 20]];
    for (var hp = 0; hp < hedgePositions.length; hp++) {
      var hgx = bx + hedgePositions[hp][0];
      var hgz = bz + hedgePositions[hp][1];
      var hgy = gh(hgx, hgz);
      setBlock(hgx, hgy + 1, hgz, BLOCK.METAL);
      setBlock(hgx, hgy + 2, hgz, BLOCK.METAL);
    }
    // Sandbag emplacements at flanks
    function sandbagWall(sgx, sgz, len, horiz) {
      for (var sgi = 0; sgi < len; sgi++) {
        var sgX = bx + sgx + (horiz ? sgi : 0);
        var sgZ = bz + sgz + (horiz ? 0 : sgi);
        var sgy = gh(sgX, sgZ);
        setBlock(sgX, sgy + 1, sgZ, BLOCK.SANDBAG);
        setBlock(sgX, sgy + 2, sgZ, BLOCK.SANDBAG);
      }
    }
    sandbagWall(-12, 21, 6, true);
    sandbagWall(7, 21, 6, true);
    sandbagWall(-12, 17, 5, false);
    sandbagWall(11, 17, 5, false);

    // ── 13. Bus stops, billboards, bench seating along avenue
    generateBillboard(bx - 14, bz - 10);
    generateBillboard(bx + 8, bz - 14);
    // Bus stop shelters (BUS_STOP block)
    function busShelter(bsx, bsz) {
      var bsy = gh(bx + bsx, bz + bsz);
      setBlock(bx + bsx, bsy + 1, bz + bsz, BLOCK.BUS_STOP);
      setBlock(bx + bsx + 1, bsy + 1, bz + bsz, BLOCK.BUS_STOP);
      setBlock(bx + bsx, bsy + 2, bz + bsz, BLOCK.GLASS);
      setBlock(bx + bsx + 1, bsy + 2, bz + bsz, BLOCK.GLASS);
    }
    busShelter(-9, -10);
    busShelter(7, -8);

    // ── 14. Park trees + benches around plaza
    for (var pti = 0; pti < 10; pti++) {
      var ang = (pti / 10) * Math.PI * 2;
      var ptx = bx + Math.round(Math.cos(ang) * 11);
      var ptz = bz + Math.round(Math.sin(ang) * 9) + 1;
      var pty = gh(ptx, ptz);
      // Skip trees that would land on the road
      if (Math.abs(ptx - bx) < 6 && ptz < bz - 2) continue;
      setBlock(ptx, pty + 1, ptz, BLOCK.PARK_TREE);
      setBlock(ptx, pty + 2, ptz, BLOCK.PARK_TREE);
      setBlock(ptx, pty + 3, ptz, BLOCK.LEAVES || BLOCK.BUSH);
    }

    // ── 15. Add this square to road waypoint list so vehicles can drive in
    for (var wpz = -40; wpz <= 20; wpz += 6) {
      _roadWaypoints.push(new THREE.Vector3(bx, gh(bx, bz + wpz) + 0.5, bz + wpz));
    }
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

  /* ── Prebuilt: Complete Avdiivka Residential Home ────────────────── */
  function generateAvdiivkaHome(ox, oz, variant) {
    variant = variant || 0;
    const surfH = getTerrainHeight(ox, oz);
    const floors = 2 + (variant % 2);  // 2-3 story homes
    const w = 6 + (variant % 3);       // 6-8 wide
    const d = 5 + (variant % 2);       // 5-6 deep
    const floorH = 3;                  // 3 blocks per floor

    for (let floor = 0; floor < floors; floor++) {
      const baseY = surfH + 1 + floor * floorH;

      // Floor surface
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          let floorBlock = floor === 0 ? BLOCK.LINOLEUM : BLOCK.CARPET;
          if (variant % 3 === 1 && floor > 0) floorBlock = BLOCK.WOOD;
          setBlock(ox + x, baseY, oz + z, floorBlock);
        }
      }

      // Walls — brick exterior, wallpaper/plaster interior
      for (let y = 1; y <= floorH - 1; y++) {
        for (let x = 0; x < w; x++) {
          // Front and back walls
          setBlock(ox + x, baseY + y, oz, BLOCK.BRICK);
          setBlock(ox + x, baseY + y, oz + d - 1, BLOCK.BRICK);
        }
        for (let z = 0; z < d; z++) {
          // Side walls
          setBlock(ox, baseY + y, oz + z, BLOCK.BRICK);
          setBlock(ox + w - 1, baseY + y, oz + z, BLOCK.BRICK);
        }

        // Interior wallpaper lining (1 block inside exterior walls)
        if (y <= floorH - 2) {
          for (let x = 1; x < w - 1; x++) {
            setBlock(ox + x, baseY + y, oz + 1, BLOCK.WALLPAPER);
            setBlock(ox + x, baseY + y, oz + d - 2, BLOCK.WALLPAPER);
          }
          for (let z = 1; z < d - 1; z++) {
            setBlock(ox + 1, baseY + y, oz + z, BLOCK.WALLPAPER);
            setBlock(ox + w - 2, baseY + y, oz + z, BLOCK.WALLPAPER);
          }
        }

        // Interior partition wall (divides rooms)
        const partX = Math.floor(w / 2);
        for (let z = 1; z < d - 1; z++) {
          if (z !== Math.floor(d / 2)) { // doorway gap
            setBlock(ox + partX, baseY + y, oz + z, BLOCK.PLASTER);
          }
        }
      }

      // Windows (glass panes in walls) — front and back
      for (let x = 2; x < w - 2; x += 2) {
        setBlock(ox + x, baseY + 1, oz, BLOCK.GLASS);
        setBlock(ox + x, baseY + 1, oz + d - 1, BLOCK.GLASS);
      }
      // Side windows
      for (let z = 2; z < d - 2; z += 2) {
        setBlock(ox, baseY + 1, oz + z, BLOCK.GLASS);
        setBlock(ox + w - 1, baseY + 1, oz + z, BLOCK.GLASS);
      }

      // Door on ground floor front
      if (floor === 0) {
        setBlock(ox + Math.floor(w / 2), baseY + 1, oz, BLOCK.AIR);
        setBlock(ox + Math.floor(w / 2), baseY + 2, oz, BLOCK.AIR);
      }

      // Kitchen area (ceramic tiles on ground floor in one room)
      if (floor === 0) {
        for (let x = 1; x < partX; x++) {
          for (let z = 1; z < d - 1; z++) {
            setBlock(ox + x, baseY, oz + z, BLOCK.CERAMIC);
          }
        }
      }
    }

    // Roof — pitched with rooftiles
    const roofBaseY = surfH + 1 + floors * floorH;
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        setBlock(ox + x, roofBaseY, oz + z, BLOCK.ROOFTILE);
      }
    }
    // Peaked ridge
    const midZ = Math.floor(d / 2);
    for (let x = 0; x < w; x++) {
      setBlock(ox + x, roofBaseY + 1, oz + midZ, BLOCK.SHINGLE);
    }

    // Battle damage — random holes in walls (war-torn effect)
    const holeCount = 2 + (variant % 3);
    for (let h = 0; h < holeCount; h++) {
      const hx = ox + 1 + Math.floor(Math.random() * (w - 2));
      const hy = surfH + 2 + Math.floor(Math.random() * (floors * floorH - 2));
      const hz = (Math.random() > 0.5) ? oz : oz + d - 1;
      setBlock(hx, hy, hz, BLOCK.AIR);
      if (Math.random() > 0.5) setBlock(hx + 1, hy, hz, BLOCK.AIR);
      // Rubble below
      setBlock(hx, surfH, hz + (hz === oz ? -1 : 1), BLOCK.RUBBLE);
    }
  }

  /* ── Prebuilt: Hostomel Airport Terminal (full voxel) ──────────── */
  function generateHostomelTerminal(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    // Main terminal building: 24 wide x 12 deep x 5 high
    const tw = 24, td = 12, th = 5;


    // Foundation pad (concrete)
    for (let x = -2; x < tw + 2; x++) {
      for (let z = -2; z < td + 2; z++) {
        setBlock(ox + x, surfH, oz + z, BLOCK.CONCRETE);
      }
    }

    // Terminal floor — linoleum/ceramic
    for (let x = 0; x < tw; x++) {
      for (let z = 0; z < td; z++) {
        setBlock(ox + x, surfH + 1, oz + z, (x + z) % 4 < 2 ? BLOCK.CERAMIC : BLOCK.LINOLEUM);
      }
    }


    // Terminal walls — reinforced concrete with glass curtain wall front
    for (let y = 1; y <= th; y++) {
      for (let x = 0; x < tw; x++) {
        // Back wall (solid concrete)
        setBlock(ox + x, surfH + 1 + y, oz + td - 1, BLOCK.CONCRETE);
        // Front wall (glass curtain wall with concrete columns every 4 blocks)
        if (x % 4 === 0) {
          setBlock(ox + x, surfH + 1 + y, oz, BLOCK.REINFORCED);
        } else if (y <= th - 1) {
          setBlock(ox + x, surfH + 1 + y, oz, BLOCK.GLASS);
        } else {
          setBlock(ox + x, surfH + 1 + y, oz, BLOCK.CONCRETE);
        }
      }
      for (let z = 0; z < td; z++) {
        // Side walls (concrete)
        setBlock(ox, surfH + 1 + y, oz + z, BLOCK.CONCRETE);
        setBlock(ox + tw - 1, surfH + 1 + y, oz + z, BLOCK.CONCRETE);
      }
    }

    // Entrances (3 double doors in front glass wall)
    for (let door = 0; door < 3; door++) {
      const doorX = ox + 4 + door * 8;
      for (let dx = 0; dx < 2; dx++) {
        setBlock(doorX + dx, surfH + 2, oz, BLOCK.AIR);
        setBlock(doorX + dx, surfH + 3, oz, BLOCK.AIR);
      }
    }

    // Interior columns (reinforced pillars every 6 blocks)
    for (let x = 3; x < tw; x += 6) {
      for (let z = 3; z < td; z += 6) {
        for (let y = 2; y <= th; y++) {
          setBlock(ox + x, surfH + y, oz + z, BLOCK.REINFORCED);
        }
      }
    }

    // Interior partition walls (check-in counters, security)
    // Check-in counter row at z=3
    for (let x = 2; x < tw - 2; x++) {
      setBlock(ox + x, surfH + 2, oz + 3, BLOCK.METAL);
      setBlock(ox + x, surfH + 3, oz + 3, BLOCK.ELECTRONICS);
    }
    // Gap for walkthrough every 4 blocks
    for (let x = 5; x < tw - 2; x += 5) {
      setBlock(ox + x, surfH + 2, oz + 3, BLOCK.AIR);
      setBlock(ox + x, surfH + 3, oz + 3, BLOCK.AIR);
    }

    // Security screening at z=6
    for (let x = 4; x < tw - 4; x += 3) {
      setBlock(ox + x, surfH + 2, oz + 6, BLOCK.METAL);
      setBlock(ox + x + 1, surfH + 2, oz + 6, BLOCK.METAL);
    }

    // Gate waiting areas (bench rows)
    for (let gateZ = 8; gateZ <= 10; gateZ += 2) {
      for (let x = 2; x < tw - 2; x += 4) {
        setBlock(ox + x, surfH + 2, oz + gateZ, BLOCK.WOOD);
        setBlock(ox + x + 1, surfH + 2, oz + gateZ, BLOCK.WOOD);
      }
    }

    // Flat roof (reinforced + metal)
    for (let x = -1; x < tw + 1; x++) {
      for (let z = -1; z < td + 1; z++) {
        setBlock(ox + x, surfH + 1 + th + 1, oz + z, BLOCK.REINFORCED);
      }
    }

    // Boarding bridges (2 jetways extending from back wall)
    for (let jw = 0; jw < 2; jw++) {
      const jwX = ox + 6 + jw * 12;
      for (let z = td; z < td + 6; z++) {
        setBlock(jwX, surfH + 3, oz + z, BLOCK.METAL);
        setBlock(jwX + 1, surfH + 3, oz + z, BLOCK.METAL);
        setBlock(jwX, surfH + 4, oz + z, BLOCK.METAL);
        setBlock(jwX + 1, surfH + 4, oz + z, BLOCK.METAL);
        // Floor of jetway
        setBlock(jwX, surfH + 2, oz + z, BLOCK.LINOLEUM);
        setBlock(jwX + 1, surfH + 2, oz + z, BLOCK.LINOLEUM);
        // Roof
        setBlock(jwX, surfH + 5, oz + z, BLOCK.METAL);
        setBlock(jwX + 1, surfH + 5, oz + z, BLOCK.METAL);
      }
    }

    // Battle damage — shell holes in terminal
    for (let dmg = 0; dmg < 5; dmg++) {
      const dmgX = ox + 2 + Math.floor(Math.random() * (tw - 4));
      const dmgY = surfH + 2 + Math.floor(Math.random() * th);
      const dmgZ = Math.random() > 0.5 ? oz : oz + td - 1;
      setBlock(dmgX, dmgY, dmgZ, BLOCK.AIR);
      setBlock(dmgX + 1, dmgY, dmgZ, BLOCK.AIR);
      // Rubble scatter
      setBlock(dmgX, surfH, dmgZ + (dmgZ === oz ? -1 : 1), BLOCK.RUBBLE);
    }
  }

  /* ── Prebuilt: Full Hostomel Airport Complex ───────────────────── */
  function generateHostomelAirport(ox, oz) {
    const levelSamples = [
      getTerrainHeight(ox - 32, oz),
      getTerrainHeight(ox, oz),
      getTerrainHeight(ox + 32, oz),
      getTerrainHeight(ox - 8, oz + 20),
      getTerrainHeight(ox + 16, oz + 22),
    ];
    const airportBaseY = Math.round(levelSamples.reduce((sum, value) => sum + value, 0) / levelSamples.length);

    // Flatten the whole airport footprint before stamping the runway, hangars, and terminal.
    levelArea(ox - 44, ox + 44, oz - 32, oz + 34, airportBaseY, BLOCK.DIRT, BLOCK.DIRT);

    // Main runway (extended, 80 blocks long x 8 wide)
    generateRunway(ox - 40, oz, 80, 8);

    // Parallel taxiway
    for (let x = ox - 35; x < ox + 35; x++) {
      for (let w = 0; w < 4; w++) {
        const ty = getTerrainHeight(x, oz + 14);
        setBlock(x, ty, oz + 14 + w, BLOCK.ASPHALT);
      }
    }

    // Full terminal building
    generateHostomelTerminal(ox - 12, oz + 20);

    // Control tower (tall, 8 floors)
    const ctOx = ox + 16, ctOz = oz + 22;
    const ctH = getTerrainHeight(ctOx, ctOz);
    // Tower shaft
    for (let y = 1; y <= 12; y++) {
      for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
          if (x === 0 || x === 2 || z === 0 || z === 2) {
            setBlock(ctOx + x, ctH + y, ctOz + z, BLOCK.REINFORCED);
          } else {
            setBlock(ctOx + x, ctH + y, ctOz + z, BLOCK.AIR);
          }
        }
      }
    }
    // Observation deck at top (glass)
    for (let x = -1; x < 4; x++) {
      for (let z = -1; z < 4; z++) {
        setBlock(ctOx + x, ctH + 13, ctOz + z, BLOCK.REINFORCED);
        if (x === -1 || x === 3 || z === -1 || z === 3) {
          setBlock(ctOx + x, ctH + 14, ctOz + z, BLOCK.GLASS);
          setBlock(ctOx + x, ctH + 15, ctOz + z, BLOCK.GLASS);
        }
        setBlock(ctOx + x, ctH + 16, ctOz + z, BLOCK.METAL);
      }
    }
    // Radar dome on top
    setBlock(ctOx + 1, ctH + 17, ctOz + 1, BLOCK.METAL);
    setBlock(ctOx + 1, ctH + 18, ctOz + 1, BLOCK.ELECTRONICS);

    // Hangars (3 large)
    for (let hi = 0; hi < 3; hi++) {
      const hx = ox - 30 + hi * 20;
      const hz = oz - 8;
      const hH = getTerrainHeight(hx, hz);
      // Hangar building 10x8x6
      for (let y = 1; y <= 6; y++) {
        for (let x = 0; x < 10; x++) {
          setBlock(hx + x, hH + y, hz, BLOCK.METAL);
          setBlock(hx + x, hH + y, hz + 7, BLOCK.METAL);
          if (x === 0 || x === 9) {
            for (let z = 0; z < 8; z++) {
              setBlock(hx + x, hH + y, hz + z, BLOCK.METAL);
            }
          }
        }
      }
      // Hangar roof
      for (let x = 0; x < 10; x++) {
        for (let z = 0; z < 8; z++) {
          setBlock(hx + x, hH + 7, hz + z, BLOCK.SHINGLE);
        }
      }
      // Hangar bay door (open)
      for (let dx = 2; dx < 8; dx++) {
        for (let dy = 1; dy <= 4; dy++) {
          setBlock(hx + dx, hH + dy, hz, BLOCK.AIR);
        }
      }
      // Hangar floor
      for (let x = 0; x < 10; x++) {
        for (let z = 0; z < 8; z++) {
          setBlock(hx + x, hH, hz + z, BLOCK.CONCRETE);
        }
      }
    }

    // Apron/parking area (concrete pads between runway and terminal)
    for (let x = ox - 20; x < ox + 20; x++) {
      for (let z = oz + 8; z < oz + 18; z++) {
        const apH = getTerrainHeight(x, z);
        setBlock(x, apH, z, BLOCK.CONCRETE);
      }
    }
  }

  /* ── Drone Nest Generator ──────────────────────────────────────── */
  var _droneNestPositions = [];
  // Track every clearable building generated this level (for mission targeting).
  var _buildings = [];

  function generateDroneNest(cx, cz) {
    var surfH = getTerrainHeight(cx, cz);
    // 5x5 concrete bunker with camo netting (metal roof)
    for (var y = 0; y < 3; y++) {
      for (var x = -2; x <= 2; x++) {
        for (var z = -2; z <= 2; z++) {
          var isWall = Math.abs(x) === 2 || Math.abs(z) === 2;
          var isRoof = y === 2;
          if (isWall || isRoof) {
            setBlock(cx + x, surfH + y, cz + z, isRoof ? BLOCK.METAL : BLOCK.CONCRETE);
          }
        }
      }
    }
    // Door opening on south side
    setBlock(cx, surfH, cz - 2, BLOCK.AIR);
    setBlock(cx, surfH + 1, cz - 2, BLOCK.AIR);
    // Antenna mast on roof
    for (var ay = 3; ay < 7; ay++) {
      setBlock(cx + 1, surfH + ay, cz + 1, BLOCK.METAL);
    }
    // Red signal light at top
    setBlock(cx + 1, surfH + 7, cz + 1, BLOCK.BRICK);
    // Control equipment inside (table)
    setBlock(cx - 1, surfH, cz, BLOCK.WOOD);
    setBlock(cx - 1, surfH + 1, cz, BLOCK.METAL);
    // Sandbag perimeter
    for (var sx = -3; sx <= 3; sx++) {
      setBlock(cx + sx, surfH, cz - 3, BLOCK.SAND);
      setBlock(cx + sx, surfH, cz + 3, BLOCK.SAND);
    }
    for (var sz = -3; sz <= 3; sz++) {
      setBlock(cx - 3, surfH, cz + sz, BLOCK.SAND);
      setBlock(cx + 3, surfH, cz + sz, BLOCK.SAND);
    }
    _droneNestPositions.push({ x: cx, y: surfH, z: cz });
  }

  /* ── Level Generation ──────────────────────────────────────────── */
  /* ════════════════════════════════════════════════════════════════
   *  WAR-ZONE RUINED-BUILDINGS GENERATOR
   *  Real-reference: post-strike apartment blocks, blown-out shop fronts,
   *  sheared-off facades, exposed reinforced-concrete floor slabs, twisted
   *  rebar columns, smashed glass, smoking craters, scattered debris.
   * ═════════════════════════════════════════════════════════════════ */

  // A single ruined HOUSE (1-2 storey, residential): partial walls, blown
  // roof, broken windows, scorched, rubble pile inside, debris around.
  function generateRuinedHouse(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    const w = 5 + Math.floor(Math.random() * 3);          // 5-7 wide
    const d = 5 + Math.floor(Math.random() * 3);          // 5-7 deep
    const storeys = 1 + (Math.random() < 0.5 ? 1 : 0);    // 1-2 floors
    const wallMat = Math.random() < 0.5 ? BLOCK.BRICK : BLOCK.PLASTER;
    const collapseSide = Math.floor(Math.random() * 4);   // 0=N,1=S,2=E,3=W

    for (let s = 0; s < storeys; s++) {
      const floorY = surfH + s * 4;
      // Floor slab (reinforced concrete) — partially broken on upper storeys
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          if (s > 0 && Math.random() < 0.30) continue;    // collapsed slab tiles
          setBlock(ox + x, floorY, oz + z, BLOCK.CONCRETE);
        }
      }
      // Walls — perimeter, with damage
      for (let y = 1; y <= 3; y++) {
        for (let x = 0; x < w; x++) {
          for (let z = 0; z < d; z++) {
            const isWall = (x === 0 || x === w - 1 || z === 0 || z === d - 1);
            if (!isWall) continue;
            // Mark a "blown-out" side: skip large chunk of that wall
            if (collapseSide === 0 && z === 0      && y >= 2 && Math.random() < 0.75) continue;
            if (collapseSide === 1 && z === d - 1  && y >= 2 && Math.random() < 0.75) continue;
            if (collapseSide === 2 && x === w - 1  && y >= 2 && Math.random() < 0.75) continue;
            if (collapseSide === 3 && x === 0      && y >= 2 && Math.random() < 0.75) continue;
            // Random shrapnel holes
            if (Math.random() < 0.18) continue;
            // Window slots row at y=2
            if (y === 2 && (x === Math.floor(w / 2) || z === Math.floor(d / 2))) {
              if (Math.random() < 0.4) continue;          // broken window = hole
              setBlock(ox + x, floorY + y, oz + z, BLOCK.GLASS);
              continue;
            }
            setBlock(ox + x, floorY + y, oz + z, wallMat);
          }
        }
      }
    }
    // Rubble pile inside (1-3 high)
    const rubbleN = 6 + Math.floor(Math.random() * 6);
    for (let r = 0; r < rubbleN; r++) {
      const rx = ox + 1 + Math.floor(Math.random() * (w - 2));
      const rz = oz + 1 + Math.floor(Math.random() * (d - 2));
      const rh = 1 + Math.floor(Math.random() * 2);
      for (let yy = 0; yy < rh; yy++) {
        setBlock(rx, surfH + 1 + yy, rz, BLOCK.RUBBLE);
      }
    }
    // Twisted rebar (vertical METAL columns sticking up where roof failed)
    for (let r = 0; r < 3 + Math.floor(Math.random() * 3); r++) {
      const rx = ox + 1 + Math.floor(Math.random() * (w - 2));
      const rz = oz + 1 + Math.floor(Math.random() * (d - 2));
      const rh = 2 + Math.floor(Math.random() * 3);
      for (let yy = 0; yy < rh; yy++) {
        setBlock(rx, surfH + 4 + yy, rz, BLOCK.METAL);
      }
    }
    // Scorch / soot ring (RUBBLE blocks scattered around perimeter)
    for (let r = 0; r < 14; r++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = (Math.max(w, d) / 2) + 1 + Math.random() * 3;
      const rx = ox + Math.floor(w / 2) + Math.floor(Math.cos(ang) * rad);
      const rz = oz + Math.floor(d / 2) + Math.floor(Math.sin(ang) * rad);
      const rh = getTerrainHeight(rx, rz);
      if (rh > 0) setBlock(rx, rh + 1, rz, BLOCK.RUBBLE);
    }
    // Doorway hole (front face)
    setBlock(ox + Math.floor(w / 2), surfH + 1, oz, BLOCK.AIR);
    setBlock(ox + Math.floor(w / 2), surfH + 2, oz, BLOCK.AIR);
    // Burning fire pocket inside (small, ~25% chance)
    if (Math.random() < 0.25) {
      setBlock(ox + 1, surfH + 1, oz + 1, BLOCK.FIRE);
    }
  }

  // A single ruined COMMERCIAL building (shop / office): wider, shop-front
  // glass mostly shattered, signage block, sheared upper floors, more rubble.
  function generateRuinedCommercial(ox, oz) {
    const surfH = getTerrainHeight(ox, oz);
    const w = 8 + Math.floor(Math.random() * 5);          // 8-12 wide
    const d = 6 + Math.floor(Math.random() * 4);          // 6-9 deep
    const storeys = 2 + Math.floor(Math.random() * 2);    // 2-3 floors
    const collapseSide = Math.floor(Math.random() * 4);

    for (let s = 0; s < storeys; s++) {
      const floorY = surfH + s * 4;
      // Concrete floor slab (with damage on upper floors)
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          if (s > 0 && Math.random() < 0.40) continue;    // upper floor partially gone
          setBlock(ox + x, floorY, oz + z, BLOCK.CONCRETE);
        }
      }
      // Walls — mostly concrete
      for (let y = 1; y <= 3; y++) {
        for (let x = 0; x < w; x++) {
          for (let z = 0; z < d; z++) {
            const isWall = (x === 0 || x === w - 1 || z === 0 || z === d - 1);
            if (!isWall) continue;
            // Blown-out face on collapse side, upper half
            if (collapseSide === 0 && z === 0     && y >= 2 && Math.random() < 0.85) continue;
            if (collapseSide === 1 && z === d - 1 && y >= 2 && Math.random() < 0.85) continue;
            if (collapseSide === 2 && x === w - 1 && y >= 2 && Math.random() < 0.85) continue;
            if (collapseSide === 3 && x === 0     && y >= 2 && Math.random() < 0.85) continue;
            // Ground floor = shop-front: alternate glass and concrete pillars
            if (s === 0 && y === 1 && (z === 0 || z === d - 1)) {
              const isPillar = (x % 3 === 0);
              if (isPillar) {
                setBlock(ox + x, floorY + y, oz + z, BLOCK.CONCRETE);
              } else if (Math.random() < 0.35) {
                setBlock(ox + x, floorY + y, oz + z, BLOCK.GLASS);
              } // else hole (smashed shopfront)
              continue;
            }
            // Upper floors: random window grid
            if (y === 2 && Math.random() < 0.30) continue; // blown window
            // Random shrapnel holes
            if (Math.random() < 0.14) continue;
            setBlock(ox + x, floorY + y, oz + z, BLOCK.CONCRETE);
          }
        }
      }
    }
    // Hanging signage (METAL block at front-top)
    setBlock(ox + Math.floor(w / 2), surfH + storeys * 4 - 1, oz - 1, BLOCK.SIGN || BLOCK.METAL);

    // Big rubble pile inside (15-25 blocks)
    const rubbleN = 15 + Math.floor(Math.random() * 11);
    for (let r = 0; r < rubbleN; r++) {
      const rx = ox + 1 + Math.floor(Math.random() * (w - 2));
      const rz = oz + 1 + Math.floor(Math.random() * (d - 2));
      const rh = 1 + Math.floor(Math.random() * 3);
      for (let yy = 0; yy < rh; yy++) {
        setBlock(rx, surfH + 1 + yy, rz, BLOCK.RUBBLE);
      }
    }
    // Twisted rebar (vertical METAL stalks)
    for (let r = 0; r < 6; r++) {
      const rx = ox + 1 + Math.floor(Math.random() * (w - 2));
      const rz = oz + 1 + Math.floor(Math.random() * (d - 2));
      const rh = 3 + Math.floor(Math.random() * 4);
      for (let yy = 0; yy < rh; yy++) {
        setBlock(rx, surfH + storeys * 4 + yy - 2, rz, BLOCK.METAL);
      }
    }
    // Glass shards & broken-window debris around
    for (let r = 0; r < 25; r++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = (Math.max(w, d) / 2) + 1 + Math.random() * 4;
      const rx = ox + Math.floor(w / 2) + Math.floor(Math.cos(ang) * rad);
      const rz = oz + Math.floor(d / 2) + Math.floor(Math.sin(ang) * rad);
      const rh = getTerrainHeight(rx, rz);
      if (rh > 0) setBlock(rx, rh + 1, rz, Math.random() < 0.3 ? BLOCK.GLASS : BLOCK.RUBBLE);
    }
    // 1-2 fire pockets inside
    for (let f = 0; f < 1 + Math.floor(Math.random() * 2); f++) {
      const fx = ox + 1 + Math.floor(Math.random() * (w - 2));
      const fz = oz + 1 + Math.floor(Math.random() * (d - 2));
      setBlock(fx, surfH + 1, fz, BLOCK.FIRE);
    }
    // Doorway / smashed entrance
    for (let dx = -1; dx <= 1; dx++) {
      setBlock(ox + Math.floor(w / 2) + dx, surfH + 1, oz, BLOCK.AIR);
      setBlock(ox + Math.floor(w / 2) + dx, surfH + 2, oz, BLOCK.AIR);
    }
  }

  // Distribute many ruined homes + commercial buildings across the map,
  // avoiding the central ~25 m radius (player spawn) and any existing
  // friendly outpost area. Real-zone density: 25-40 ruins per stage.
  function generateWarZoneRuins(opts) {
    opts = opts || {};
    const homeCount       = opts.homes       || (18 + Math.floor(Math.random() * 8));   // 18-25
    const commercialCount = opts.commercial  || (8  + Math.floor(Math.random() * 6));   // 8-13
    const minR            = opts.minR        || 22;   // keep clear of player spawn
    const maxR            = opts.maxR        || (WORLD_CHUNKS * CHUNK_SIZE * 0.42);

    function pick(size) {
      // Try a few times to find a flat spot
      for (let attempt = 0; attempt < 6; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = minR + Math.random() * (maxR - minR);
        const ox = Math.floor(Math.cos(ang) * rad);
        const oz = Math.floor(Math.sin(ang) * rad);
        // Avoid water
        const h = getTerrainHeight(ox, oz);
        if (h < 1) continue;
        // Avoid already-occupied spots (cheap test: top block isn't AIR)
        const top = getBlock(ox, h + 1, oz);
        if (top !== BLOCK.AIR) continue;
        return { ox, oz };
      }
      return null;
    }

    for (let i = 0; i < homeCount; i++) {
      const p = pick(7);
      if (p) generateRuinedHouse(p.ox, p.oz);
    }
    for (let i = 0; i < commercialCount; i++) {
      const p = pick(12);
      if (p) generateRuinedCommercial(p.ox, p.oz);
    }
    // Bonus: a "destroyed block" cluster — 3-4 ruins close together (city block hit hard)
    for (let cluster = 0; cluster < 2; cluster++) {
      const center = pick(20);
      if (!center) continue;
      const cnt = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < cnt; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r   = 8 + Math.random() * 10;
        const cx  = center.ox + Math.floor(Math.cos(ang) * r);
        const cz  = center.oz + Math.floor(Math.sin(ang) * r);
        if (Math.random() < 0.5) generateRuinedHouse(cx, cz);
        else                     generateRuinedCommercial(cx, cz);
      }
    }
  }

  function generateLevel(index) {
    const level = getLevelDef(index);
    setTheme(level.theme);
    _theme.seed = index * 3137;

    regenerate();
    _droneNestPositions.length = 0; // Reset nests for this level
    _buildings.length = 0;          // Reset clearable building registry

    // Main road network — every stage gets visible asphalt arteries so
    // the world doesn't look like an empty sandbox. User reported "no
    // roads"; previously roads only existed at outpost rims.
    generateRoadNetwork([
      [-120,   0,  120,   0, 4],   // east-west main road
      [   0,-120,    0, 120, 4],   // north-south main road
      [ -60, -60,   60, -60, 3],   // southern parallel
      [ -60,  60,   60,  60, 3],   // northern parallel
      [ -80,   0,  -80, -80, 3],   // west connector
      [  80,   0,   80,  80, 3],   // east connector
    ]);
    if (level.id === 'HOSTOMEL') {
      generateHostomelAirport(0, 0);
      generateUkrainianApartment(-35, -30, 6);
      generateUkrainianApartment(-35, -50, 12);
      generateUkrainianApartment(25, -35, 6);
      // Enemy drone nests around the airport perimeter
      generateDroneNest(40, 25);
      generateDroneNest(-38, 20);
    } else if (level.id === 'AVDIIVKA') {
      generateUkrainianApartment(-20, -20, 6);
      generateUkrainianApartment(-20, -42, 12);
      generateUkrainianApartment(10, -25, 6);
      generateUkrainianApartment(10, -47, 12);
      generateDroneNest(35, -35);
      generateDroneNest(-35, -55);
      generateDroneNest(30, 15);
    } else if (level.id === 'BAKHMUT') {
      generateUkrainianApartment(-25, -20, 6);
      generateUkrainianApartment(-25, -42, 6);
      generateUkrainianApartment(15, -15, 12);
      generateUkrainianApartment(15, -37, 6);
      generateDroneNest(40, -30);
      generateDroneNest(-40, -10);
      generateDroneNest(20, 30);
    } else if (level.id === 'KHERSON') {
      generateUkrainianApartment(-30, -25, 12);
      generateUkrainianApartment(-30, -47, 6);
      generateUkrainianApartment(20, -30, 6);
      generateDroneNest(35, -40);
      generateDroneNest(-35, -55);
    } else if (level.id === 'KYIV') {
      // Real-map recreation: Maidan Nezalezhnosti / Khreshchatyk approach
      // where Russian armored columns were stopped on the road into Kyiv
      generateKyivMaidanSquare(0, 0);
      // Drone nests along enemy approach corridor
      generateDroneNest(36, -40);
      generateDroneNest(-36, -40);
    }
    // ── War-zone ruined homes & commercial buildings (every stage) ──
    // Real Ukraine war reference: Mariupol, Bakhmut, Avdiivka districts
    // after months of bombardment — partial walls, blown roofs, exposed
    // rebar, smashed shopfronts, rubble piles, scorched ruins, fire pockets.
    try {
      generateWarZoneRuins({
        homes:      18 + Math.floor(Math.random() * 8),
        commercial:  8 + Math.floor(Math.random() * 6),
      });
    } catch (e) { console.warn('warZoneRuins generation skipped:', e); }
    // Ruined military + civilian vehicles scattered + 2 ambushed convoys.
    // Real Ukraine reference: shattered armoured columns near Hostomel,
    // burnt marshrutky and ambulances near Bakhmut, civilian wrecks on
    // every approach road.
    try {
      generateDestroyedVehicles(14 + Math.floor(Math.random() * 8));
      // Ambushed convoy clusters along axis lines (off-road)
      for (let c = 0; c < 2; c++) {
        const cx = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.7);
        const cz = Math.floor((Math.random() - 0.5) * WORLD_CHUNKS * CHUNK_SIZE * 0.7);
        if (getTerrainHeight(cx, cz) > 0) generateWreckedConvoy(cx, cz);
      }
    } catch (e) { console.warn('destroyedVehicles generation skipped:', e); }
    rebuildAll();
    _levelSpawnPoint = resolveLevelSpawnPoint(level);
    return level;
  }

  function dispose() {
    // Dispose all chunk meshes/materials
    for (const chunk of chunks.values()) {
      if (chunk.mesh && chunk.mesh.geometry) chunk.mesh.geometry.dispose();
      if (chunk.mesh && chunk.mesh.material) chunk.mesh.material.dispose();
      if (chunk.waterMesh && chunk.waterMesh.geometry) chunk.waterMesh.geometry.dispose();
      if (chunk.waterMesh && chunk.waterMesh.material) chunk.waterMesh.material.dispose();
    }
    chunks.clear();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  // (Removed duplicate return block)
  return {
    BLOCK,
    BLOCK_COLORS,
    BLOCK_HARDNESS,
    CHUNK_SIZE,
    CHUNK_HEIGHT,
    BLOCK_SIZE,
    THEMES,
    init: typeof init === 'function' ? init : function () {},
    regenerate: typeof regenerate === 'function' ? regenerate : function () {},
    dispose: typeof dispose === 'function' ? dispose : function () {},
    setTheme: typeof setTheme === 'function' ? setTheme : function () {},
    getTheme: typeof getTheme === 'function' ? getTheme : function () { return THEMES.grassland; },
    getBlock: typeof getBlock === 'function' ? getBlock : function () { return BLOCK.AIR; },
    setBlock: typeof setBlock === 'function' ? setBlock : function () { return false; },
    getTerrainHeight: typeof getTerrainHeight === 'function' ? getTerrainHeight : function () { return 0; },
    getTopSolidY: typeof getTopSolidY === 'function' ? getTopSolidY : function (x, z) { return (typeof getTerrainHeight === 'function' ? getTerrainHeight(x, z) : 0) + 1; },
    raycastBlock: typeof raycastBlock === 'function' ? raycastBlock : function () { return null; },
    updateDirtyChunks: typeof updateDirtyChunks === 'function' ? updateDirtyChunks : function () {},
    rebuildAll: typeof rebuildAll === 'function' ? rebuildAll : function () {},
    scatterResources,
    worldToChunk,
    getLevelDef,
    getSpawnPoint,
    generateLevel: typeof generateLevel === 'function' ? generateLevel : function () { return null; },
    getRoadWaypoints: function () { return _roadWaypoints.slice(); },
    getDroneNestPositions: function () { return _droneNestPositions.slice(); },
    getBuildings: function () { return _buildings.slice(); },
    spawnVehicle,
    updateVehicles,
    getActiveVehicles,
    clearVehicles,
    placeDugout: typeof placeDugout === 'function' ? placeDugout : function () { return null; },
    isSolid: typeof isSolid === 'function' ? isSolid : function () { return false; },
    // Cover degradation
    damageBlock: damageBlock,
    updateCoverDegradation: updateCoverDegradation,
    getBlockDamageRatio: getBlockDamageRatio,
  };

})();


// Ensure isSolid is always exported to window, even if VoxelWorld is not yet defined
if (typeof window !== 'undefined') {
  // If VoxelWorld is defined, use its isSolid; otherwise, fallback to the local isSolid
  window.isSolid = (window.VoxelWorld && window.VoxelWorld.isSolid) ? window.VoxelWorld.isSolid : function () { return false; };
}




// --- GUARANTEED GLOBAL EXPORTS: BLOCK and isSolid ---
// These must be assigned AFTER the VoxelWorld IIFE is fully defined
if (typeof window !== 'undefined' && window.VoxelWorld) {
  window.BLOCK = window.VoxelWorld.BLOCK;
  window.isSolid = window.VoxelWorld.isSolid;
}







