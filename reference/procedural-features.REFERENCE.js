// Procedural Generation & Feature Placement Functions
// (for reference, not used directly)

function generateModernMansion(ox, oz, w, d) {
  // Large, glass-heavy, multi-level mansion
  const h = 5;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const isEdge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
    if (isEdge || (y === h - 1 && (x % 2 === 0 || z % 2 === 0))) setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + y, oz + z, y === 2 ? BLOCK.GLASS : BLOCK.CONCRETE);
    else if (y === 0) setBlock(ox + x, getTerrainHeight(ox + x, oz + z), oz + z, BLOCK.CARPET);
  }
  // Pool and garden
  for (let px = 2; px < w - 2; px++) for (let pz = d; pz < d + 2; pz++) setBlock(ox + px, getTerrainHeight(ox + px, oz + pz), oz + pz, BLOCK.WATER);
  placeFountain(ox + Math.floor(w/2), 3, oz + d + 2);
}

function generateTinyHome(ox, oz, w, d) {
  // Very small, efficient home
  const h = 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const isWall = x === 0 || x === w - 1 || z === 0 || z === d - 1;
    setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + y, oz + z, isWall ? BLOCK.WOOD : BLOCK.AIR);
  }
  setBlock(ox + Math.floor(w/2), getTerrainHeight(ox + Math.floor(w/2), oz), oz, BLOCK.AIR);
}

function generateSovietBlock(ox, oz, w, d) {
  // Tall, rectangular, concrete apartment block
  const h = 7;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
    const isEdge = x === 0 || x === w - 1 || z === 0 || z === d - 1;
    setBlock(ox + x, getTerrainHeight(ox + x, oz + z) + y, oz + z, isEdge ? BLOCK.CONCRETE : (y % 2 === 0 ? BLOCK.GLASS : BLOCK.AIR));
  }
}

function generateDiagonalRoad(ox, oz, length, dir) {
  // dir: 'NE', 'NW', 'SE', 'SW'
  for (let i = 0; i < length; i++) {
    let dx = (dir === 'NE' || dir === 'SE') ? i : -i;
    let dz = (dir === 'SE' || dir === 'SW') ? i : -i;
    setBlock(ox + dx, getTerrainHeight(ox + dx, oz + dz), oz + dz, BLOCK.ASPHALT);
  }
}

function generateOverpass(ox, oz, length, height) {
  // Elevated road
  for (let i = 0; i < length; i++) {
    for (let h = 0; h < height; h++) {
      setBlock(ox + i, getTerrainHeight(ox + i, oz) + h + 2, oz, h === height - 1 ? BLOCK.ASPHALT : BLOCK.CONCRETE);
    }
  }
}

function placeFountain(wx, wy, wz) {
  setBlock(wx, wy, wz, BLOCK.WATER);
  setBlock(wx, wy + 1, wz, BLOCK.GLASS);
  setBlock(wx, wy + 2, wz, BLOCK.STONE);
}

function placeStreetlight(wx, wy, wz) {
  setBlock(wx, wy, wz, BLOCK.STREETLIGHT);
  setBlock(wx, wy + 1, wz, BLOCK.LAMPPOST);
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
  // Garden (bushes, trees)
  placeBush(ox - 1, 3, oz + 1);
  placeTree(ox + w + 1, 3, oz + d + 1, 2);
}

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
