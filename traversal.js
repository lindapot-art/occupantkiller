/* ============================================================
 *  TRAVERSAL.JS — 5 new movement features
 *  Features: mantling, dolphin dive, rope rappel, zipline, swimming
 * ============================================================ */
/* ============================================================
 *  TRAVERSAL.JS — 5 new movement features
 *  Features: mantling, dolphin dive, rope rappel, zipline, swimming
 * ============================================================ */
console.log('[Traversal.js] Script loaded');
const Traversal = (function () {
  'use strict';

  const CFG = {
      // Ladder
      LADDER_CLIMB_SPEED: 3.0,
    // Mantling
    MANTLE_HEIGHT: 2.0,       // max block height to auto-climb
    MANTLE_SPEED: 4.0,        // units/sec upward during mantle
    MANTLE_DURATION: 0.4,     // seconds
    MANTLE_RANGE: 1.5,        // forward detection range
    // Dolphin dive
    DIVE_SPEED: 12,           // forward burst speed
    DIVE_DURATION: 0.6,       // seconds in air
    DIVE_COOLDOWN: 2.0,       // seconds
    DIVE_DAMAGE: 15,          // fall damage to nearby enemies on impact
    // Rope rappel
    RAPPEL_SPEED: 5,          // units/sec descend
    RAPPEL_MAX_LENGTH: 20,    // max rope length in blocks
    // Zipline
    ZIP_SPEED: 14,            // travel speed on zipline
    ZIP_MAX_DIST: 60,         // max zipline length
    // Swimming
    SWIM_SPEED: 3.0,          // reduced movement in water
    SWIM_STAMINA_DRAIN: 0.25, // stamina drain per sec while swimming
    DROWN_THRESHOLD: 0,       // start drowning at 0 stamina
    DROWN_DAMAGE: 10          // damage per second when drowning
  }


  let state = {
    climbingLadder: false,
    ladderDir: 0,
    ladderY: 0,
    // Mantling
    mantling: false,
    mantleTimer: 0,
    mantleStartY: 0,
    mantleTargetY: 0,
    mantleFwdX: 0,
    mantleFwdZ: 0,
    mantleStartX: 0,
    mantleStartZ: 0,
    // Dolphin dive
    diving: false,
    diveTimer: 0,
    diveDir: null,
    diveCooldown: 0,
    // Rope
    rappelling: false,
    rappelAnchorY: 0,
    rappelRopeLen: 0,
    // Zipline
    onZipline: false,
    zipStart: null,
    zipEnd: null,
    zipProgress: 0,
    // Swimming
    swimming: false,
    underwater: false,
    breathTimer: 10    // seconds of breath
  };

    // ── Feature: Ladder Climbing ──
    function tryClimbLadder(playerPos, getBlock) {
  // Check if player is at a LADDER block
  const bx = Math.floor(playerPos.x);
  const by = Math.floor(playerPos.y);
  const bz = Math.floor(playerPos.z);
  if (getBlock(bx, by, bz) === 37) { // BLOCK.LADDER
    state.climbingLadder = true;
    state.ladderY = playerPos.y;
    return true;
  }
  return false;
}

function updateLadderClimb(dt, inputUp, inputDown) {
  if (!state.climbingLadder) return null;
  if (inputUp) state.ladderY += CFG.LADDER_CLIMB_SPEED * dt;
  if (inputDown) state.ladderY -= CFG.LADDER_CLIMB_SPEED * dt;
  // Optionally: check for top/bottom exit
  return { y: state.ladderY, climbing: true };
}

function exitLadder() { state.climbingLadder = false; }

function isClimbingLadder() { return state.climbingLadder; }
// ── Feature: Rooftop Access ──
function tryRooftopAccess(playerPos, getBlock) {
  // Check for ROOFTOP_HATCH at feet or head
  const bx = Math.floor(playerPos.x);
  const by = Math.floor(playerPos.y);
  const bz = Math.floor(playerPos.z);
  if (getBlock(bx, by, bz) === 39 || getBlock(bx, by + 1, bz) === 39) {
    // Enter/exit rooftop
    return true;
  }
  return false;
}
/* ── Feature: Zipline Mount ── */
function tryMountZipline(playerPos, getBlock) {
  // Check for ZIPLINE block at head
  const bx = Math.floor(playerPos.x);
  const by = Math.floor(playerPos.y + 1);
  const bz = Math.floor(playerPos.z);
  if (getBlock(bx, by, bz) === 38) { // BLOCK.ZIPLINE
    return true;
  }
  return false;
}

  /* ── Feature 11: Mantling ──────────────────── */
  function tryMantle(playerPos, playerVelY, forwardDir, getBlock) {
    if (state.mantling || state.diving) return false;
    // check for climbable surface ahead
    const checkX = Math.floor(playerPos.x + forwardDir.x * CFG.MANTLE_RANGE);
    const checkZ = Math.floor(playerPos.z + forwardDir.z * CFG.MANTLE_RANGE);
    const playerBlockY = Math.floor(playerPos.y);

    // find top of wall (check up to MANTLE_HEIGHT blocks above player feet)
    for (let dy = 0; dy <= CFG.MANTLE_HEIGHT; dy++) {
      const blockBelow = getBlock(checkX, playerBlockY + dy, checkZ);
      const blockAbove = getBlock(checkX, playerBlockY + dy + 1, checkZ);
      if (blockBelow && !blockAbove) {
        state.mantling = true;
        state.mantleTimer = CFG.MANTLE_DURATION;
        state.mantleStartY = playerPos.y;
        state.mantleTargetY = playerBlockY + dy + 1.5;
        state.mantleFwdX = forwardDir.x;
        state.mantleFwdZ = forwardDir.z;
        state.mantleStartX = playerPos.x;
        state.mantleStartZ = playerPos.z;
        return true;
      }
    }
    return false;
  }

  function updateMantle(dt) {
    if (!state.mantling) return null;
    state.mantleTimer -= dt;
    const t = 1 - state.mantleTimer / CFG.MANTLE_DURATION;
    const currentY = state.mantleStartY + (state.mantleTargetY - state.mantleStartY) * Math.min(1, t);
    // Push forward 1.5 units over the mantle duration so player lands on top
    var fwd = Math.min(1, t) * 1.5;
    var currentX = state.mantleStartX + state.mantleFwdX * fwd;
    var currentZ = state.mantleStartZ + state.mantleFwdZ * fwd;
    if (state.mantleTimer <= 0) { state.mantling = false; }
    return { y: currentY, x: currentX, z: currentZ, active: state.mantling || t >= 0.99 };
  }

  function isMantling() { return state.mantling; }

  /* ── Feature 12: Dolphin Dive ──────────────── */
  function tryDolphinDive(forwardDir, isSprinting) {
    if (!isSprinting || state.diveCooldown > 0 || state.diving) return false;
    state.diving = true;
    state.diveTimer = CFG.DIVE_DURATION;
    state.diveDir = { x: forwardDir.x, z: forwardDir.z };
    state.diveCooldown = CFG.DIVE_COOLDOWN;
    return true;
  }

  function updateDive(dt) {
    if (state.diveCooldown > 0) state.diveCooldown -= dt;
    if (!state.diving) return null;
    state.diveTimer -= dt;
    if (state.diveTimer <= 0) { state.diving = false; return { landing: true, damage: CFG.DIVE_DAMAGE }; }
    const t = state.diveTimer / CFG.DIVE_DURATION;
    return {
      moveX: state.diveDir.x * CFG.DIVE_SPEED * dt,
      moveZ: state.diveDir.z * CFG.DIVE_SPEED * dt,
      heightOffset: Math.sin(t * Math.PI) * 0.8,
      active: true
    };
  }

  function isDiving() { return state.diving; }

  /* ── Feature 13: Rope Rappel ───────────────── */
  function startRappel(playerY) {
    if (state.rappelling) return false;
    state.rappelling = true;
    state.rappelAnchorY = playerY;
    state.rappelRopeLen = 0;
    return true;
  }

  function updateRappel(dt, inputDown) {
    if (!state.rappelling) return null;
    if (inputDown) {
      state.rappelRopeLen += CFG.RAPPEL_SPEED * dt;
    }
    if (state.rappelRopeLen >= CFG.RAPPEL_MAX_LENGTH) {
      state.rappelling = false;
      return { finished: true };
    }
    return { y: state.rappelAnchorY - state.rappelRopeLen, active: true };
  }

  function stopRappel() { state.rappelling = false; }
  function isRappelling() { return state.rappelling; }

  /* ── Feature 14: Zipline ───────────────────── */
  function startZipline(startPos, endPos) {
    const dx = endPos.x - startPos.x, dz = endPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > CFG.ZIP_MAX_DIST || dist < 3) return false;
    state.onZipline = true;
    state.zipStart = { ...startPos };
    state.zipEnd = { ...endPos };
    state.zipProgress = 0;
    return true;
  }

  function updateZipline(dt) {
    if (!state.onZipline) return null;
    const dx = state.zipEnd.x - state.zipStart.x;
    const dy = state.zipEnd.y - state.zipStart.y;
    const dz = state.zipEnd.z - state.zipStart.z;
    const totalDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    state.zipProgress += (CFG.ZIP_SPEED * dt) / totalDist;
    if (state.zipProgress >= 1) {
      state.onZipline = false;
      return { x: state.zipEnd.x, y: state.zipEnd.y, z: state.zipEnd.z, finished: true };
    }
    return {
      x: state.zipStart.x + dx * state.zipProgress,
      y: state.zipStart.y + dy * state.zipProgress,
      z: state.zipStart.z + dz * state.zipProgress,
      active: true
    };
  }

  function isOnZipline() { return state.onZipline; }
  function exitZipline() { state.onZipline = false; }

  /* ── Feature 15: Swimming ──────────────────── */
  function checkWater(blockType) {
    return blockType === 8; // WATER block
  }

  function updateSwimming(dt, inWater, stamina) {
    state.swimming = inWater;
    if (!inWater) {
      state.breathTimer = Math.min(10, state.breathTimer + dt * 2);
      state.underwater = false;
      return null;
    }
    const staminaDrain = CFG.SWIM_STAMINA_DRAIN * dt;
    let drowning = false;
    let drownDmg = 0;
    if (stamina <= CFG.DROWN_THRESHOLD) {
      state.breathTimer -= dt;
      if (state.breathTimer <= 0) {
        drowning = true;
        drownDmg = CFG.DROWN_DAMAGE * dt;
      }
    }
    return {
      speedMult: CFG.SWIM_SPEED / 6, // relative to normal walk speed
      staminaDrain,
      drowning,
      drownDmg,
      breath: state.breathTimer,
      active: true
    };
  }

  function isSwimming() { return state.swimming; }

  /* ── Feature 16: Wall Run ───────────────────── */
  const WALLRUN_DURATION = 1.5;
  const WALLRUN_LIFT = 2.0;

  let _wallRunState = { active: false, timer: 0, wallNormal: null };

  function tryWallRun(playerPos, moveDir, getBlock) {
    if (_wallRunState.active || state.mantling || state.diving) return false;
    // check left and right for adjacent walls
    const dirs = [
      { x: -moveDir.z, z: moveDir.x },  // left
      { x: moveDir.z, z: -moveDir.x }   // right
    ];
    for (const side of dirs) {
      const cx = Math.floor(playerPos.x + side.x * 1.2);
      const cz = Math.floor(playerPos.z + side.z * 1.2);
      const cy = Math.floor(playerPos.y);
      if (getBlock(cx, cy, cz)) {
        _wallRunState.active = true;
        _wallRunState.timer = WALLRUN_DURATION;
        _wallRunState.wallNormal = { x: -side.x, y: 0, z: -side.z };
        return true;
      }
    }
    return false;
  }

  function updateWallRun(delta) {
    if (!_wallRunState.active) return { active: false, offsetY: 0, wallNormal: null };
    _wallRunState.timer -= delta;
    if (_wallRunState.timer <= 0) {
      _wallRunState.active = false;
      return { active: false, offsetY: 0, wallNormal: null };
    }
    const t = _wallRunState.timer / WALLRUN_DURATION;
    const offsetY = Math.sin(t * Math.PI) * WALLRUN_LIFT;
    return { active: true, offsetY: offsetY, wallNormal: _wallRunState.wallNormal };
  }

  function isWallRunning() { return _wallRunState.active; }

  /* ── Feature 17: Grapple Hook ──────────────── */
  const GRAPPLE_SPEED = 15;
  const GRAPPLE_PULL_FORCE = 12;

  let _grappleState = { active: false, anchor: null, extending: false, retracting: false, ropeLen: 0 };

  function launchGrapple(origin, direction, maxRange, getBlock) {
    if (_grappleState.active) return false;
    // simple raycast to find anchor point
    const step = 0.5;
    for (let d = step; d <= maxRange; d += step) {
      const px = origin.x + direction.x * d;
      const py = origin.y + direction.y * d;
      const pz = origin.z + direction.z * d;
      if (getBlock(Math.floor(px), Math.floor(py), Math.floor(pz))) {
        _grappleState.active = true;
        _grappleState.anchor = { x: px - direction.x * step, y: py - direction.y * step, z: pz - direction.z * step };
        _grappleState.extending = false;
        _grappleState.retracting = true;
        _grappleState.ropeLen = d;
        return true;
      }
    }
    return false;
  }

  function updateGrapple(delta, playerPos) {
    if (!_grappleState.active) return { active: false, targetPos: null, force: null };
    const a = _grappleState.anchor;
    const dx = a.x - playerPos.x;
    const dy = a.y - playerPos.y;
    const dz = a.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1.5) {
      releaseGrapple();
      return { active: false, targetPos: a, force: null };
    }
    const inv = GRAPPLE_PULL_FORCE / dist;
    return {
      active: true,
      targetPos: a,
      force: { x: dx * inv, y: dy * inv, z: dz * inv }
    };
  }

  function releaseGrapple() {
    _grappleState.active = false;
    _grappleState.anchor = null;
    _grappleState.extending = false;
    _grappleState.retracting = false;
    _grappleState.ropeLen = 0;
  }

  function isGrappling() { return _grappleState.active; }

  /* ── Feature 18: Ledge Grab ────────────────── */
  let _ledgeState = { hanging: false, ledgePos: null };

  function checkLedgeGrab(playerPos, velocity, getBlock) {
    if (_ledgeState.hanging || state.mantling) return false;
    // only grab when falling
    if (velocity.y >= 0) return false;
    const py = Math.floor(playerPos.y);
    // check blocks around player at head level
    const offsets = [ { x:1,z:0 }, { x:-1,z:0 }, { x:0,z:1 }, { x:0,z:-1 } ];
    for (const off of offsets) {
      const bx = Math.floor(playerPos.x) + off.x;
      const bz = Math.floor(playerPos.z) + off.z;
      const solidAtFeet = getBlock(bx, py, bz);
      const emptyAbove = !getBlock(bx, py + 1, bz);
      if (solidAtFeet && emptyAbove) {
        _ledgeState.hanging = true;
        _ledgeState.ledgePos = { x: bx + 0.5, y: py + 1.0, z: bz + 0.5 };
        return true;
      }
    }
    return false;
  }

  function updateLedgeHang(delta) {
    if (!_ledgeState.hanging) return { hanging: false, position: null };
    return { hanging: true, position: _ledgeState.ledgePos };
  }

  function pullUp() {
    if (!_ledgeState.hanging) return null;
    const pos = { x: _ledgeState.ledgePos.x, y: _ledgeState.ledgePos.y + 0.5, z: _ledgeState.ledgePos.z };
    _ledgeState.hanging = false;
    _ledgeState.ledgePos = null;
    return pos;
  }

  function dropDown() {
    _ledgeState.hanging = false;
    _ledgeState.ledgePos = null;
  }

  function isHanging() { return _ledgeState.hanging; }

  /* ── Feature 19: Vault ─────────────────────── */
  const VAULT_DURATION = 0.3;
  const VAULT_HEIGHT = 1.5;

  let _vaultState = { active: false, timer: 0, startPos: null, endPos: null };

  function tryVault(playerPos, moveDir, getBlock) {
    if (_vaultState.active || state.mantling) return false;
    const ahead = {
      x: Math.floor(playerPos.x + moveDir.x * 1.2),
      z: Math.floor(playerPos.z + moveDir.z * 1.2)
    };
    const py = Math.floor(playerPos.y);
    // 1-block high obstacle: solid at feet, empty above
    const solidAtFeet = getBlock(ahead.x, py, ahead.z);
    const emptyAbove = !getBlock(ahead.x, py + 1, ahead.z);
    const emptyBeyond = !getBlock(ahead.x + Math.sign(moveDir.x), py, ahead.z + Math.sign(moveDir.z));
    if (solidAtFeet && emptyAbove && emptyBeyond) {
      _vaultState.active = true;
      _vaultState.timer = VAULT_DURATION;
      _vaultState.startPos = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
      _vaultState.endPos = {
        x: ahead.x + 0.5 + moveDir.x * 1.0,
        y: playerPos.y,
        z: ahead.z + 0.5 + moveDir.z * 1.0
      };
      return true;
    }
    return false;
  }

  function updateVault(delta) {
    if (!_vaultState.active) return { active: false, position: null };
    _vaultState.timer -= delta;
    const t = 1 - _vaultState.timer / VAULT_DURATION;
    const s = _vaultState.startPos;
    const e = _vaultState.endPos;
    const pos = {
      x: s.x + (e.x - s.x) * t,
      y: s.y + Math.sin(t * Math.PI) * VAULT_HEIGHT,
      z: s.z + (e.z - s.z) * t
    };
    if (_vaultState.timer <= 0) {
      _vaultState.active = false;
      return { active: false, position: e };
    }
    return { active: true, position: pos };
  }

  function isVaulting() { return _vaultState.active; }

  /* ── Master Update ─────────────────────────── */
  function update(dt) {
    const mantle = updateMantle(dt);
    const dive = updateDive(dt);
    const wallRun = updateWallRun(dt);
    const vault = updateVault(dt);
    return { mantle, dive, wallRun, vault };
  }

  function reset() {
    state.mantling = false; state.mantleTimer = 0;
    state.mantleFwdX = 0; state.mantleFwdZ = 0;
    state.mantleStartX = 0; state.mantleStartZ = 0;
    state.diving = false; state.diveTimer = 0; state.diveCooldown = 0;
    state.rappelling = false; state.onZipline = false;
    state.swimming = false; state.breathTimer = 10;
    _wallRunState = { active: false, timer: 0, wallNormal: null };
    _grappleState = { active: false, anchor: null, extending: false, retracting: false, ropeLen: 0 };
    _ledgeState = { hanging: false, ledgePos: null };
    _vaultState = { active: false, timer: 0, startPos: null, endPos: null };
  }

  // Stub for updateVehicleTraffic to prevent runtime crash
  const updateVehicleTraffic = function() {
    // No-op: vehicle traffic system not implemented yet
  };

  return {
    update,
    tryMantle, isMantling,
    tryDolphinDive, isDiving,
    startRappel, updateRappel, stopRappel, isRappelling,
    startZipline, updateZipline, isOnZipline, exitZipline,
    checkWater, updateSwimming, isSwimming,
    // Wall run
    tryWallRun, updateWallRun, isWallRunning,
    // Grapple hook
    launchGrapple, updateGrapple, releaseGrapple, isGrappling,
    // Ledge grab
    checkLedgeGrab, updateLedgeHang, pullUp, dropDown, isHanging,
    // Vault
    tryVault, updateVault, isVaulting,
    // Vehicle traffic
    updateVehicleTraffic,
    // Ladder/verticality/zipline/rooftop
    tryClimbLadder, updateLadderClimb, exitLadder, isClimbingLadder,
    tryRooftopAccess,
    tryMountZipline,

    reset
  };
})();


// RUNTIME ASSERTION: Ensure Traversal.update is present immediately after IIFE
if (typeof Traversal === 'undefined') {
  console.error('[Traversal.js] FATAL: Traversal is undefined after IIFE');
} else if (typeof Traversal.update !== 'function') {
  console.error('[Traversal.js] FATAL: Traversal.update is missing after IIFE. Keys:', Object.keys(Traversal));
  // Attempt to forcibly assign if possible
  if (typeof update === 'function') {
    Traversal.update = update;
    console.warn('[Traversal.js] Assigned Traversal.update from local update function');
  }
}

// Ensure Traversal is exported globally for browser/legacy code
if (typeof window !== 'undefined' && Traversal) {
  window.Traversal = Traversal;
  if (typeof Traversal.updateVehicleTraffic === 'function') {
    window.updateVehicleTraffic = Traversal.updateVehicleTraffic;
  }
  // Debug: log Traversal keys and forcibly assign reset if missing
  console.log('[Traversal export] window.Traversal keys:', Object.keys(window.Traversal));
  if (typeof window.Traversal.reset !== 'function' && typeof Traversal.reset === 'function') {
    window.Traversal.reset = Traversal.reset;
    console.log('[Traversal export] Assigned window.Traversal.reset manually');
  }
  if (typeof window.Traversal.update !== 'function' && typeof Traversal.update === 'function') {
    window.Traversal.update = Traversal.update;
    console.warn('[Traversal export] Assigned window.Traversal.update manually');
  }
  if (typeof window.Traversal.reset === 'function') {
    console.log('[Traversal export] Traversal.reset is present');
  } else {
    console.warn('[Traversal export] Traversal.reset is STILL missing!');
  }
  if (typeof window.Traversal.update === 'function') {
    console.log('[Traversal export] Traversal.update is present');
  } else {
    console.error('[Traversal export] Traversal.update is STILL missing!');
  }
}
