/* ============================================================
 *  COMBAT-EXTRAS.JS — 10 new combat features
 *  Features: tactical lean, weapon inspect, bullet penetration,
 *  ricochet, bayonet charge, quick melee, weapon heat, ammo types,
 *  blind fire, weapon maintenance
 * ============================================================ */
const CombatExtras = (function () {
  'use strict';

  /* ── Config ─────────────────────────────────── */
  const CFG = {
    LEAN_ANGLE: 0.22,           // radians (~12°)
    LEAN_OFFSET: 1.2,           // units sideways
    LEAN_SPEED: 6,              // lerp speed
    INSPECT_DURATION: 2.5,      // seconds
    PENETRATION_LOSS: 0.4,      // damage retained through thin wall
    RICOCHET_CHANCE: 0.25,      // 25% off metal
    RICOCHET_DMG_MULT: 0.5,     // ricochet damage multiplier
    BAYONET_SPEED_MULT: 1.8,    // sprint speed boost during charge
    BAYONET_DAMAGE: 80,         // charge damage
    BAYONET_DURATION: 1.2,      // seconds
    QUICK_MELEE_DMG: 20,        // pistol whip damage
    QUICK_MELEE_RANGE: 2.5,     // units
    QUICK_MELEE_CD: 0.8,        // cooldown seconds
    HEAT_PER_SHOT: 0.04,        // heat gained per bullet (auto weapons)
    HEAT_COOLDOWN_RATE: 0.12,   // heat dissipated per second
    OVERHEAT_PENALTY: 2.0,      // seconds locked out when overheated
    MAINTENANCE_INTERVAL: 300,  // shots before jam chance increases
    MAINTENANCE_DURATION: 3.0,  // seconds to clean weapon
    BLIND_FIRE_SPREAD: 3.0,     // multiplier on spread
    BLIND_FIRE_DMG: 0.6         // damage multiplier
  };

  /* ── Ammo Types ────────────────────────────── */
  const AMMO_TYPES = {
    STANDARD: { id: 0, name: 'Standard',    dmgMult: 1.0, color: 0xffff00, penetration: 0.0 },
    AP:       { id: 1, name: 'Armor-Piercing', dmgMult: 0.9, color: 0x00ccff, penetration: 0.6 },
    INCENDIARY: { id: 2, name: 'Incendiary', dmgMult: 1.1, color: 0xff4400, penetration: 0.0, burnDmg: 5, burnDur: 3 },
    HOLLOW:   { id: 3, name: 'Hollow Point', dmgMult: 1.4, color: 0xff00ff, penetration: -0.2 },
    SUBSONIC: { id: 4, name: 'Subsonic',     dmgMult: 0.8, color: 0x888888, penetration: 0.0, silent: true }
  };
  const ammoTypeKeys = Object.keys(AMMO_TYPES);

  /* ── State ──────────────────────────────────── */
  let state = {
    leanDir: 0,           // -1 left, 0 center, 1 right
    leanAmount: 0,        // current lerped value
    inspecting: false,
    inspectTimer: 0,
    bayonetCharging: false,
    bayonetTimer: 0,
    quickMeleeCD: 0,
    heat: 0,              // 0..1
    overheated: false,
    overheatTimer: 0,
    currentAmmoType: 0,   // index into ammoTypeKeys
    blindFiring: false,
    maintenanceLevel: 1.0, // 1.0 = perfect, 0 = jammed
    shotsSinceMaint: 0,
    maintaining: false,
    maintainTimer: 0
  };

  function reset() {
    state = {
      leanDir: 0, leanAmount: 0, inspecting: false, inspectTimer: 0,
      bayonetCharging: false, bayonetTimer: 0, quickMeleeCD: 0,
      heat: 0, overheated: false, overheatTimer: 0, currentAmmoType: 0,
      blindFiring: false, maintenanceLevel: 1.0, shotsSinceMaint: 0,
      maintaining: false, maintainTimer: 0
    };
  }

  /* ── Feature 1: Tactical Lean ──────────────── */
  function setLean(dir) { state.leanDir = dir; }

  function updateLean(dt) {
    const target = state.leanDir * CFG.LEAN_OFFSET;
    state.leanAmount += (target - state.leanAmount) * Math.min(1, CFG.LEAN_SPEED * dt);
    return { offset: state.leanAmount, angle: state.leanAmount * CFG.LEAN_ANGLE / CFG.LEAN_OFFSET };
  }

  function isLeaning() { return Math.abs(state.leanAmount) > 0.05; }

  /* ── Feature 2: Weapon Inspect ─────────────── */
  function startInspect() {
    if (state.inspecting) return;
    state.inspecting = true;
    state.inspectTimer = CFG.INSPECT_DURATION;
  }

  function updateInspect(dt) {
    if (!state.inspecting) return null;
    state.inspectTimer -= dt;
    if (state.inspectTimer <= 0) { state.inspecting = false; return null; }
    const t = 1 - state.inspectTimer / CFG.INSPECT_DURATION;
    return {
      rotY: Math.sin(t * Math.PI * 2) * 0.6,
      rotX: Math.sin(t * Math.PI) * 0.3,
      posZ: Math.sin(t * Math.PI) * -0.2,
      active: true
    };
  }

  function isInspecting() { return state.inspecting; }

  /* ── Feature 3: Bullet Penetration ─────────── */
  function calcPenetration(blockType, baseDmg) {
    const ammo = AMMO_TYPES[ammoTypeKeys[state.currentAmmoType]];
    const penMod = CFG.PENETRATION_LOSS + ammo.penetration;
    // thin materials: glass, wood, fence, crate
    const thinBlocks = [4, 10, 15, 13]; // WOOD, GLASS, FENCE, CRATE
    if (thinBlocks.includes(blockType)) {
      return { penetrates: true, remainingDmg: baseDmg * Math.max(0.1, penMod) };
    }
    return { penetrates: false, remainingDmg: 0 };
  }

  /* ── Feature 4: Ricochet ───────────────────── */
  function calcRicochet(blockType, inDir) {
    const metalBlocks = [5, 14]; // METAL, REINFORCED
    if (!metalBlocks.includes(blockType)) return null;
    if (Math.random() > CFG.RICOCHET_CHANCE) return null;
    // reflect direction with random scatter
    const scatter = 0.3;
    return {
      dirX: -inDir.x + (Math.random() - 0.5) * scatter,
      dirY: Math.abs(inDir.y) * 0.5 + Math.random() * 0.2,
      dirZ: -inDir.z + (Math.random() - 0.5) * scatter,
      dmgMult: CFG.RICOCHET_DMG_MULT
    };
  }

  /* ── Feature 5: Bayonet Charge ─────────────── */
  function startBayonetCharge() {
    if (state.bayonetCharging) return false;
    state.bayonetCharging = true;
    state.bayonetTimer = CFG.BAYONET_DURATION;
    return true;
  }

  function updateBayonet(dt) {
    if (!state.bayonetCharging) return null;
    state.bayonetTimer -= dt;
    if (state.bayonetTimer <= 0) { state.bayonetCharging = false; return null; }
    return { speedMult: CFG.BAYONET_SPEED_MULT, damage: CFG.BAYONET_DAMAGE, active: true };
  }

  function isBayonetCharging() { return state.bayonetCharging; }

  /* ── Feature 6: Quick Melee ────────────────── */
  function tryQuickMelee() {
    if (state.quickMeleeCD > 0) return null;
    state.quickMeleeCD = CFG.QUICK_MELEE_CD;
    return { damage: CFG.QUICK_MELEE_DMG, range: CFG.QUICK_MELEE_RANGE };
  }

  function updateQuickMelee(dt) { if (state.quickMeleeCD > 0) state.quickMeleeCD -= dt; }

  /* ── Feature 7: Weapon Heat ────────────────── */
  function addHeat(isAutoWeapon) {
    if (!isAutoWeapon) return;
    state.heat = Math.min(1, state.heat + CFG.HEAT_PER_SHOT);
    if (state.heat >= 1) { state.overheated = true; state.overheatTimer = CFG.OVERHEAT_PENALTY; }
  }

  function updateHeat(dt) {
    if (state.overheated) {
      state.overheatTimer -= dt;
      if (state.overheatTimer <= 0) { state.overheated = false; state.heat = 0.5; }
    } else {
      state.heat = Math.max(0, state.heat - CFG.HEAT_COOLDOWN_RATE * dt);
    }
    return { heat: state.heat, overheated: state.overheated };
  }

  function isOverheated() { return state.overheated; }
  function getHeat() { return state.heat; }

  /* ── Feature 8: Ammo Types ─────────────────── */
  function cycleAmmoType() {
    state.currentAmmoType = (state.currentAmmoType + 1) % ammoTypeKeys.length;
    return getAmmoType();
  }

  function getAmmoType() { return AMMO_TYPES[ammoTypeKeys[state.currentAmmoType]]; }

  function getAmmoModifiers() {
    const a = getAmmoType();
    return { dmgMult: a.dmgMult, color: a.color, silent: !!a.silent, burnDmg: a.burnDmg || 0, burnDur: a.burnDur || 0 };
  }

  /* ── Feature 9: Blind Fire ─────────────────── */
  function toggleBlindFire() { state.blindFiring = !state.blindFiring; return state.blindFiring; }

  function getBlindFireMods() {
    if (!state.blindFiring) return null;
    return { spreadMult: CFG.BLIND_FIRE_SPREAD, dmgMult: CFG.BLIND_FIRE_DMG };
  }

  function isBlindFiring() { return state.blindFiring; }

  /* ── Feature 10: Weapon Maintenance ────────── */
  function registerShot() {
    state.shotsSinceMaint++;
    if (state.shotsSinceMaint > CFG.MAINTENANCE_INTERVAL) {
      const jamChance = (state.shotsSinceMaint - CFG.MAINTENANCE_INTERVAL) * 0.001;
      state.maintenanceLevel = Math.max(0.3, 1 - jamChance * 10);
    }
  }

  function startMaintenance() {
    if (state.maintaining) return false;
    state.maintaining = true;
    state.maintainTimer = CFG.MAINTENANCE_DURATION;
    return true;
  }

  function updateMaintenance(dt) {
    if (!state.maintaining) return false;
    state.maintainTimer -= dt;
    if (state.maintainTimer <= 0) {
      state.maintaining = false;
      state.maintenanceLevel = 1.0;
      state.shotsSinceMaint = 0;
      return true; // done
    }
    return false;
  }

  function getMaintenanceLevel() { return state.maintenanceLevel; }
  function isMaintaining() { return state.maintaining; }

  /* ── Feature 11: Weapon Juggling ─────────────── */
  let _lastWeaponIdx = -1;

  function quickSwap() {
    if (_lastWeaponIdx < 0) return false;
    if (typeof Weapons === 'undefined') return false;
    const cur = Weapons.getCurrentIdx();
    const target = _lastWeaponIdx;
    _lastWeaponIdx = cur;
    Weapons.switchTo(target);
    return true;
  }

  function _trackWeaponSwap(newIdx) {
    if (typeof Weapons !== 'undefined') {
      _lastWeaponIdx = newIdx;
    }
  }

  /* ── Feature 12: Tactical Reload ───────────── */
  let _tacticalReloadPending = false;

  function tacticalReload() {
    if (typeof Weapons === 'undefined') return false;
    const clip = Weapons.getClip ? Weapons.getClip() : -1;
    if (clip <= 0) return false;
    _tacticalReloadPending = true;
    if (Weapons.reload) Weapons.reload();
    return true;
  }

  function isTacticalReload() { return _tacticalReloadPending; }

  function completeTacticalReload() {
    if (!_tacticalReloadPending) return false;
    _tacticalReloadPending = false;
    if (typeof Weapons !== 'undefined' && Weapons.getClip && Weapons.setClip) {
      Weapons.setClip(Weapons.getClip() + 1);
    }
    return true;
  }

  /* ── Feature 13: Execution System ──────────── */
  function tryExecution(enemy) {
    if (!enemy || typeof enemy.hp === 'undefined') return { success: false, bonusXP: 0 };
    const dist = enemy.distance !== undefined ? enemy.distance : Infinity;
    if (enemy.hp >= 20 || dist >= 2) return { success: false, bonusXP: 0 };
    enemy.hp = 0;
    const bonusXP = 50;
    return { success: true, bonusXP: bonusXP };
  }

  /* ── Feature 14: Weapon Mastery ────────────── */
  const MASTERY_RANKS = [
    { name: 'Novice',   kills: 0 },
    { name: 'Regular',  kills: 25 },
    { name: 'Skilled',  kills: 50 },
    { name: 'Expert',   kills: 100 },
    { name: 'Master',   kills: 200 },
    { name: 'Legend',   kills: 500 }
  ];

  const _weaponMastery = {};

  function _ensureMastery(weaponId) {
    if (!_weaponMastery[weaponId]) {
      _weaponMastery[weaponId] = { kills: 0, rank: 0 };
    }
  }

  function addWeaponKill(weaponId) {
    _ensureMastery(weaponId);
    _weaponMastery[weaponId].kills++;
    const m = _weaponMastery[weaponId];
    for (let i = MASTERY_RANKS.length - 1; i >= 0; i--) {
      if (m.kills >= MASTERY_RANKS[i].kills) {
        m.rank = i;
        break;
      }
    }
    return getWeaponMastery(weaponId);
  }

  function getWeaponMastery(weaponId) {
    _ensureMastery(weaponId);
    const m = _weaponMastery[weaponId];
    const nextIdx = Math.min(m.rank + 1, MASTERY_RANKS.length - 1);
    return {
      kills: m.kills,
      rank: m.rank,
      rankName: MASTERY_RANKS[m.rank].name,
      nextRankKills: m.rank < MASTERY_RANKS.length - 1 ? MASTERY_RANKS[nextIdx].kills : null
    };
  }

  function getMasteryBonus(weaponId) {
    _ensureMastery(weaponId);
    const rank = _weaponMastery[weaponId].rank;
    return {
      damageMult: 1.0 + rank * 0.03,
      reloadMult: 1.0 - rank * 0.02
    };
  }

  /* ── Feature 15: Combat Roll ───────────────── */
  let _rollTimer = 0;
  let _rollCooldown = 0;
  let _rollDir = null;
  const ROLL_DURATION = 0.4;
  const ROLL_COOLDOWN = 1.2;
  const ROLL_SPEED = 10;

  function tryRoll(direction) {
    if (_rollTimer > 0 || _rollCooldown > 0) return false;
    if (!direction) return false;
    _rollTimer = ROLL_DURATION;
    _rollCooldown = ROLL_COOLDOWN;
    _rollDir = { x: direction.x, y: direction.y || 0, z: direction.z };
    return true;
  }

  function isRolling() { return _rollTimer > 0; }

  function updateRoll(delta) {
    if (_rollCooldown > 0) _rollCooldown -= delta;
    if (_rollTimer <= 0) return null;
    _rollTimer -= delta;
    if (_rollTimer <= 0) { _rollTimer = 0; _rollDir = null; return { active: false }; }
    return {
      active: true,
      iframes: true,
      moveX: _rollDir.x * ROLL_SPEED * delta,
      moveZ: _rollDir.z * ROLL_SPEED * delta
    };
  }

  /* ── Update all ────────────────────────────── */
  function update(dt) {
    const lean = updateLean(dt);
    const inspect = updateInspect(dt);
    const bayonet = updateBayonet(dt);
    const heatInfo = updateHeat(dt);
    updateQuickMelee(dt);
    updateMaintenance(dt);
    const roll = updateRoll(dt);
    return { lean, inspect, bayonet, heat: heatInfo, roll };
  }

  /* ── Public API ────────────────────────────── */
  return {
    CFG, AMMO_TYPES, reset, update, init: reset, clear: reset,
    // Lean
    setLean, isLeaning,
    // Inspect
    startInspect, isInspecting,
    // Penetration
    calcPenetration,
    // Ricochet
    calcRicochet,
    // Bayonet
    startBayonetCharge, isBayonetCharging,
    // Quick melee
    tryQuickMelee,
    // Heat
    addHeat, isOverheated, getHeat,
    // Ammo types
    cycleAmmoType, getAmmoType, getAmmoModifiers,
    // Blind fire
    toggleBlindFire, getBlindFireMods, isBlindFiring,
    // Maintenance
    registerShot, startMaintenance, getMaintenanceLevel, isMaintaining,
    // Weapon juggling
    quickSwap, _trackWeaponSwap,
    // Tactical reload
    tacticalReload, isTacticalReload, completeTacticalReload,
    // Execution
    tryExecution,
    // Weapon mastery
    addWeaponKill, getWeaponMastery, getMasteryBonus,
    // Combat roll
    tryRoll, isRolling, updateRoll
  };
})();
