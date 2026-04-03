/* ============================================================
 *  TRAVERSAL.JS — 5 new movement features
 *  Features: mantling, dolphin dive, rope rappel, zipline, swimming
 * ============================================================ */
const Traversal = (function () {
  'use strict';

  const CFG = {
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
  };

  let state = {
    // Mantling
    mantling: false,
    mantleTimer: 0,
    mantleStartY: 0,
    mantleTargetY: 0,
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
    if (state.mantleTimer <= 0) { state.mantling = false; }
    return { y: currentY, active: state.mantling || t >= 0.99 };
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

  /* ── Master Update ─────────────────────────── */
  function update(dt) {
    const mantle = updateMantle(dt);
    const dive = updateDive(dt);
    return { mantle, dive };
  }

  function reset() {
    state.mantling = false; state.mantleTimer = 0;
    state.diving = false; state.diveTimer = 0; state.diveCooldown = 0;
    state.rappelling = false; state.onZipline = false;
    state.swimming = false; state.breathTimer = 10;
  }

  return {
    CFG, reset, update,
    tryMantle, isMantling,
    tryDolphinDive, isDiving,
    startRappel, updateRappel, stopRappel, isRappelling,
    startZipline, updateZipline, isOnZipline, exitZipline,
    checkWater, updateSwimming, isSwimming
  };
})();
