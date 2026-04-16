/* ============================================================
 *  PERKS.JS — 8 new player perk/ability features
 *  Features: perk system, killstreak rewards, field bandage,
 *  adrenaline rush, dead eye, scavenger, ghost, juggernaut
 * ============================================================ */
const Perks = (function () {
  'use strict';

  /* ── Perk Definitions ──────────────────────── */
  const PERK_LIST = {
        // NEW: Drone Recon
        DRONE_RECON: {
          id: 'DRONE_RECON', name: 'Drone Recon', icon: '🛰️',
          desc: 'Call in a recon drone to scout enemy positions. 90s cooldown.',
          effect: function () {
            if (typeof DroneSystem !== 'undefined' && DroneSystem.callRecon) {
              DroneSystem.callRecon();
            }
          },
          cooldown: 90
        },
        // NEW: Artillery Strike
        ARTILLERY_STRIKE: {
          id: 'ARTILLERY_STRIKE', name: 'Artillery Strike', icon: '💥',
          desc: 'Call in an artillery barrage on a target area. 120s cooldown.',
          effect: function () {
            if (typeof VFX !== 'undefined' && VFX.artilleryBarrage) {
              VFX.artilleryBarrage();
            }
          },
          cooldown: 120
        },
    // Feature 33: Field Bandage
    FIELD_BANDAGE: {
      id: 'FIELD_BANDAGE', name: 'Field Bandage', icon: '🩹',
      desc: 'Press H to heal 30 HP over 5 seconds. 30s cooldown.',
      healTotal: 30, healDuration: 5, cooldown: 30
    },
    // Feature 34: Adrenaline Rush
    ADRENALINE: {
      id: 'ADRENALINE', name: 'Adrenaline Rush', icon: '⚡',
      desc: 'Multi-kills grant 40% speed boost for 4 seconds.',
      speedBoost: 0.4, duration: 4, killThreshold: 2
    },
    // Feature 35: Dead Eye
    DEAD_EYE: {
      id: 'DEAD_EYE', name: 'Dead Eye', icon: '🎯',
      desc: 'Every 8th kill guarantees a critical hit (3× damage).',
      killInterval: 8, critMult: 3.0
    },
    // Feature 36: Scavenger
    SCAVENGER: {
      id: 'SCAVENGER', name: 'Scavenger', icon: '🔄',
      desc: 'Auto-loot ammo from killed enemies within 5m.',
      range: 5, ammoPerKill: 10
    },
    // Feature 37: Ghost
    GHOST: {
      id: 'GHOST', name: 'Ghost', icon: '👻',
      desc: 'Enemies detect you 50% slower. Reduced footstep sound.',
      detectionMult: 0.5, footstepMult: 0.3
    },
    // Feature 38: Juggernaut
    JUGGERNAUT: {
      id: 'JUGGERNAUT', name: 'Juggernaut', icon: '🛡️',
      desc: 'Take 25% less damage. Move 10% slower.',
      damageMult: 0.75, speedMult: 0.9
    },
    // Extra perks for variety
    QUICK_HANDS: {
      id: 'QUICK_HANDS', name: 'Quick Hands', icon: '🖐️',
      desc: 'Reload 35% faster. Swap weapons instantly.',
      reloadMult: 0.65, swapTime: 0
    },
    MARATHON: {
      id: 'MARATHON', name: 'Marathon', icon: '🏃',
      desc: 'Unlimited sprint. Stamina drains 60% slower.',
      staminaMult: 0.4
    }
  };

  /* ── Killstreak Rewards (Feature 32) ───────── */
  const KILLSTREAKS = {
    3:  { id: 'UAV',       name: 'UAV Scan',        icon: '📡', desc: 'Reveals all enemies for 15s', duration: 15 },
    5:  { id: 'ARTILLERY', name: 'Artillery Strike', icon: '💥', desc: 'Call artillery on target area', damage: 200, radius: 10 },
    7:  { id: 'AIRSTRIKE', name: 'Air Strike',       icon: '✈️', desc: 'Carpet bomb a line', damage: 300, width: 6, length: 25 },
    10: { id: 'GUNSHIP',   name: 'Gunship Support',  icon: '🚁', desc: 'AI gunship attacks enemies for 20s', duration: 20, dps: 40 },
    15: { id: 'NUKE',      name: 'Tactical Nuke',    icon: '☢️', desc: 'Ends the wave. Kills all enemies.', endsWave: true },
    20: { id: 'ORBITAL',   name: 'Orbital Strike',   icon: '🛰️', desc: 'Massive area denial for 30s', duration: 30, damage: 500, radius: 20 }
  };

  /* ── State ──────────────────────────────────── */
  const MAX_PERKS = 3;
  let equipped = [];
  let killCount = 0;
  let multiKillTimer = 0;
  let multiKillCount = 0;
  let deadEyeCounter = 0;

  // Perk-specific timers
  let bandageActive = false, bandageTimer = 0, bandageCooldown = 0, bandageHealRate = 0;
  let adrenalineActive = false, adrenalineTimer = 0;
  let uavActive = false, uavTimer = 0;
  let gunshipActive = false, gunshipTimer = 0;
  let pendingStreaks = [];

  function reset() {
    equipped = [];
    killCount = 0; multiKillTimer = 0; multiKillCount = 0; deadEyeCounter = 0;
    bandageActive = false; bandageTimer = 0; bandageCooldown = 0;
    adrenalineActive = false; adrenalineTimer = 0;
    uavActive = false; uavTimer = 0;
    gunshipActive = false; gunshipTimer = 0;
    pendingStreaks = [];
  }

  /* ── Feature 32: Perk System ───────────────── */
  function equipPerk(perkId) {
    if (equipped.length >= MAX_PERKS) return false;
    if (equipped.includes(perkId)) return false;
    if (!PERK_LIST[perkId]) return false;
    equipped.push(perkId);
    return true;
  }

  function unequipPerk(perkId) {
    const idx = equipped.indexOf(perkId);
    if (idx === -1) return false;
    equipped.splice(idx, 1);
    return true;
  }

  function hasPerk(perkId) { return equipped.includes(perkId); }
  function getEquipped() { return equipped.map(id => PERK_LIST[id]); }

  /* ── Feature 32: Killstreak Rewards ────────── */
  function onKill() {
    killCount++;
    multiKillCount++;
    multiKillTimer = 3; // 3s window for multi-kill
    deadEyeCounter++;

    // Check killstreak
    if (KILLSTREAKS[killCount]) {
      pendingStreaks.push({ ...KILLSTREAKS[killCount] });
    }

    // Adrenaline check
    if (hasPerk('ADRENALINE') && multiKillCount >= PERK_LIST.ADRENALINE.killThreshold) {
      adrenalineActive = true;
      adrenalineTimer = PERK_LIST.ADRENALINE.duration;
    }
  }

  function resetStreak() { killCount = 0; }

  function getAvailableStreaks() { return pendingStreaks; }

  function activateStreak(index) {
    if (index < 0 || index >= pendingStreaks.length) return null;
    const streak = pendingStreaks.splice(index, 1)[0];

    if (streak.id === 'UAV') { uavActive = true; uavTimer = streak.duration; }
    if (streak.id === 'GUNSHIP') { gunshipActive = true; gunshipTimer = streak.duration; }

    return streak;
  }

  /* ── Feature 34: Field Bandage ─────────────── */
  function useBandage() {
    if (!hasPerk('FIELD_BANDAGE') || bandageActive || bandageCooldown > 0) return false;
    const p = PERK_LIST.FIELD_BANDAGE;
    bandageActive = true;
    bandageTimer = p.healDuration;
    bandageHealRate = p.healTotal / p.healDuration;
    bandageCooldown = p.cooldown;
    return true;
  }

  /* ── Feature 35: Dead Eye Check ────────────── */
  function isDeadEyeShot() {
    if (!hasPerk('DEAD_EYE')) return false;
    if (deadEyeCounter >= PERK_LIST.DEAD_EYE.killInterval) {
      deadEyeCounter = 0;
      return true;
    }
    return false;
  }

  function getDeadEyeMult() { return PERK_LIST.DEAD_EYE.critMult; }

  /* ── Modifier Getters ──────────────────────── */
  function getDamageTakenMult() {
    return hasPerk('JUGGERNAUT') ? PERK_LIST.JUGGERNAUT.damageMult : 1.0;
  }

  function getSpeedMult() {
    let mult = 1.0;
    if (hasPerk('JUGGERNAUT')) mult *= PERK_LIST.JUGGERNAUT.speedMult;
    if (adrenalineActive) mult *= (1 + PERK_LIST.ADRENALINE.speedBoost);
    return mult;
  }

  function getDetectionMult() {
    return hasPerk('GHOST') ? PERK_LIST.GHOST.detectionMult : 1.0;
  }

  function getReloadMult() {
    return hasPerk('QUICK_HANDS') ? PERK_LIST.QUICK_HANDS.reloadMult : 1.0;
  }

  function getStaminaMult() {
    return hasPerk('MARATHON') ? PERK_LIST.MARATHON.staminaMult : 1.0;
  }

  function getScavengerRange() {
    return hasPerk('SCAVENGER') ? PERK_LIST.SCAVENGER.range : 0;
  }

  function getScavengerAmmo() {
    return hasPerk('SCAVENGER') ? PERK_LIST.SCAVENGER.ammoPerKill : 0;
  }

  function isUAVActive() { return uavActive; }
  function isGunshipActive() { return gunshipActive; }

  /* ── Update ────────────────────────────────── */
  function update(dt) {
    // Multi-kill timer
    if (multiKillTimer > 0) {
      multiKillTimer -= dt;
      if (multiKillTimer <= 0) multiKillCount = 0;
    }

    // Bandage
    let healThisTick = 0;
    if (bandageActive) {
      bandageTimer -= dt;
      healThisTick = bandageHealRate * dt;
      if (bandageTimer <= 0) bandageActive = false;
    }
    if (bandageCooldown > 0) bandageCooldown -= dt;

    // Adrenaline
    if (adrenalineActive) {
      adrenalineTimer -= dt;
      if (adrenalineTimer <= 0) adrenalineActive = false;
    }

    // UAV
    if (uavActive) {
      uavTimer -= dt;
      if (uavTimer <= 0) uavActive = false;
    }

    // Gunship
    let gunshipDPS = 0;
    if (gunshipActive) {
      gunshipTimer -= dt;
      gunshipDPS = 40; // damage per second to random enemy
      if (gunshipTimer <= 0) gunshipActive = false;
    }

    return { healThisTick, gunshipDPS };
  }

  return {
    PERK_LIST, KILLSTREAKS, MAX_PERKS,
    reset, update,
    equipPerk, unequipPerk, hasPerk, getEquipped,
    onKill, resetStreak, getAvailableStreaks, activateStreak,
    useBandage,
    isDeadEyeShot, getDeadEyeMult,
    getDamageTakenMult, getSpeedMult, getDetectionMult,
    getReloadMult, getStaminaMult,
    getScavengerRange, getScavengerAmmo,
    isUAVActive, isGunshipActive
  };
})();
