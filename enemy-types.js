/* ============================================================
 *  ENEMY-TYPES.JS — 8 new enemy type features
 *  Features: boss enemies, suicide bomber, sniper, medic,
 *  engineer, war dog, shield bearer, mortar
 * ============================================================ */
const EnemyTypes = (function () {
  'use strict';

  /* ── New Enemy Type Definitions ────────────── */
  const TYPES = {
    // Feature 16: Boss enemies (appear every 5th wave)
    BOSS: {
      id: 'BOSS', name: 'Commander Boss', tier: 4,
      hp: 500, speed: 1.5, damage: 45, attackRange: 8,
      color: 0x990000, scale: 1.6, xpReward: 200,
      abilities: ['summon_reinforcements', 'rage_mode', 'shield_bash'],
      lootTable: ['WEAPON', 'ARMOR', 'MEDKIT'],
      spawnMessage: '⚠️ ENEMY COMMANDER APPROACHING!'
    },
    // Feature 17: Suicide Bomber
    BOMBER: {
      id: 'BOMBER', name: 'Suicide Bomber', tier: 2,
      hp: 30, speed: 6, damage: 0, attackRange: 2,
      color: 0xff4400, scale: 1.0, xpReward: 35,
      explosionDamage: 150, explosionRadius: 5,
      behavior: 'rush_and_explode',
      warningBeep: true, beepInterval: 0.5
    },
    // Feature 18: Sniper
    SNIPER_ELITE: {
      id: 'SNIPER_ELITE', name: 'Elite Sniper', tier: 3,
      hp: 60, speed: 1, damage: 70, attackRange: 50,
      color: 0x445544, scale: 1.0, xpReward: 80,
      aimTime: 2.0, relocateAfterShots: 2,
      laserSight: true, laserColor: 0xff0000,
      behavior: 'camp_and_snipe'
    },
    // Feature 19: Medic
    MEDIC: {
      id: 'MEDIC', name: 'Combat Medic', tier: 2,
      hp: 80, speed: 3, damage: 15, attackRange: 6,
      color: 0xffffff, scale: 1.0, xpReward: 60,
      healRange: 8, healRate: 15, healInterval: 2,
      priorityTarget: true, // player should target medics first
      behavior: 'heal_allies'
    },
    // Feature 20: Engineer
    ENGINEER: {
      id: 'ENGINEER', name: 'Combat Engineer', tier: 2,
      hp: 90, speed: 2.5, damage: 20, attackRange: 5,
      color: 0x886644, scale: 1.1, xpReward: 55,
      buildInterval: 8, // seconds between placing cover
      coverHP: 40,
      behavior: 'build_and_fight'
    },
    // Feature 21: War Dog
    WAR_DOG: {
      id: 'WAR_DOG', name: 'Attack Dog', tier: 1,
      hp: 25, speed: 9, damage: 25, attackRange: 1.5,
      color: 0x554433, scale: 0.6, xpReward: 20,
      leapRange: 5, leapDamage: 35, leapCooldown: 4,
      behavior: 'chase_and_leap'
    },
    // Feature 22: Shield Bearer
    SHIELD_BEARER: {
      id: 'SHIELD_BEARER', name: 'Riot Shield', tier: 2,
      hp: 120, speed: 2, damage: 18, attackRange: 2,
      color: 0x333333, scale: 1.2, xpReward: 50,
      shieldHP: 200, shieldArc: Math.PI * 0.6, // frontal shield
      behavior: 'advance_with_shield'
    },
    // Feature 23: Mortar
    MORTAR: {
      id: 'MORTAR', name: 'Mortar Team', tier: 3,
      hp: 70, speed: 1, damage: 0, attackRange: 40,
      color: 0x666633, scale: 1.1, xpReward: 75,
      mortarDamage: 80, mortarRadius: 4, mortarInterval: 5,
      setupTime: 3, // seconds to deploy mortar
      behavior: 'indirect_fire'
    }
  };

  /* ── Wave Composition Rules ────────────────── */
  const WAVE_COMPOSITIONS = {
    1:  { types: ['CONSCRIPT'], weights: [1] },
    2:  { types: ['CONSCRIPT', 'BOMBER'], weights: [0.8, 0.2] },
    3:  { types: ['CONSCRIPT', 'STORMER', 'WAR_DOG'], weights: [0.5, 0.3, 0.2] },
    4:  { types: ['CONSCRIPT', 'STORMER', 'SNIPER_ELITE', 'MEDIC'], weights: [0.4, 0.3, 0.15, 0.15] },
    5:  { types: ['BOSS', 'STORMER', 'SHIELD_BEARER'], weights: [0.05, 0.5, 0.45] },
    6:  { types: ['STORMER', 'ARMORED', 'ENGINEER', 'BOMBER'], weights: [0.3, 0.3, 0.2, 0.2] },
    7:  { types: ['ARMORED', 'SNIPER_ELITE', 'MORTAR', 'MEDIC'], weights: [0.3, 0.25, 0.25, 0.2] },
    8:  { types: ['ARMORED', 'SHIELD_BEARER', 'ENGINEER', 'MORTAR'], weights: [0.3, 0.25, 0.25, 0.2] },
    9:  { types: ['BOSS', 'ARMORED', 'SNIPER_ELITE', 'BOMBER', 'WAR_DOG'], weights: [0.05, 0.3, 0.25, 0.2, 0.2] },
    10: { types: ['BOSS', 'ARMORED', 'SHIELD_BEARER', 'MORTAR', 'SNIPER_ELITE', 'MEDIC'], weights: [0.1, 0.25, 0.2, 0.15, 0.15, 0.15] }
  };

  /* ── AI Behavior State ─────────────────────── */
  let activeEnemies = [];

  function init() { activeEnemies = []; }

  function selectType(wave) {
    const comp = WAVE_COMPOSITIONS[Math.min(wave, 10)] || WAVE_COMPOSITIONS[10];
    const roll = Math.random();
    let cumulative = 0;
    for (let i = 0; i < comp.types.length; i++) {
      cumulative += comp.weights[i];
      if (roll < cumulative) return comp.types[i];
    }
    return comp.types[0];
  }

  function getTypeConfig(typeId) {
    return TYPES[typeId] || null;
  }

  /* ── Per-Type AI Update Helpers ────────────── */
  function updateBomber(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    const dx = playerPos.x - enemy.x, dz = playerPos.z - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // beeping gets faster as closer
    enemy._beepTimer = (enemy._beepTimer || 0) - dt;
    const beepRate = Math.max(0.1, dist * 0.05);
    const shouldBeep = enemy._beepTimer <= 0;
    if (shouldBeep) enemy._beepTimer = beepRate;
    // check detonation
    if (dist < TYPES.BOMBER.attackRange) {
      return {
        detonate: true,
        x: enemy.x, y: enemy.y, z: enemy.z,
        damage: TYPES.BOMBER.explosionDamage,
        radius: TYPES.BOMBER.explosionRadius
      };
    }
    return { beep: shouldBeep };
  }

  function updateSniper(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    enemy._aimTimer = (enemy._aimTimer || 0) + dt;
    enemy._shotCount = enemy._shotCount || 0;
    const dx = playerPos.x - enemy.x, dz = playerPos.z - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > TYPES.SNIPER_ELITE.attackRange) return null;
    if (enemy._aimTimer >= TYPES.SNIPER_ELITE.aimTime) {
      enemy._aimTimer = 0;
      enemy._shotCount++;
      const shouldRelocate = enemy._shotCount >= TYPES.SNIPER_ELITE.relocateAfterShots;
      if (shouldRelocate) enemy._shotCount = 0;
      return {
        fire: true, damage: TYPES.SNIPER_ELITE.damage,
        relocate: shouldRelocate
      };
    }
    return { aiming: true, progress: enemy._aimTimer / TYPES.SNIPER_ELITE.aimTime };
  }

  function updateMedic(enemy, allEnemies, dt) {
    if (!enemy.alive) return null;
    enemy._healTimer = (enemy._healTimer || 0) + dt;
    if (enemy._healTimer < TYPES.MEDIC.healInterval) return null;
    enemy._healTimer = 0;
    // find wounded ally in range
    const range = TYPES.MEDIC.healRange;
    for (const ally of allEnemies) {
      if (ally === enemy || !ally.alive) continue;
      const dx = ally.x - enemy.x, dz = ally.z - enemy.z;
      if (dx * dx + dz * dz < range * range) {
        const cfg = getTypeConfig(ally.type) || { hp: 50 };
        if (ally.hp < cfg.hp) {
          return { heal: true, target: ally, amount: TYPES.MEDIC.healRate };
        }
      }
    }
    return null;
  }

  function updateEngineer(enemy, dt, placeBlock) {
    if (!enemy.alive) return null;
    enemy._buildTimer = (enemy._buildTimer || 0) + dt;
    if (enemy._buildTimer >= TYPES.ENGINEER.buildInterval) {
      enemy._buildTimer = 0;
      // place a cover block nearby
      const bx = Math.floor(enemy.x + (Math.random() - 0.5) * 3);
      const bz = Math.floor(enemy.z + (Math.random() - 0.5) * 3);
      if (placeBlock) placeBlock(bx, Math.floor(enemy.y), bz, 9); // CONCRETE
      return { built: true, x: bx, z: bz };
    }
    return null;
  }

  function updateWarDog(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    enemy._leapCD = (enemy._leapCD || 0) - dt;
    const dx = playerPos.x - enemy.x, dz = playerPos.z - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < TYPES.WAR_DOG.leapRange && enemy._leapCD <= 0) {
      enemy._leapCD = TYPES.WAR_DOG.leapCooldown;
      return { leap: true, damage: TYPES.WAR_DOG.leapDamage, dirX: dx / dist, dirZ: dz / dist };
    }
    return null;
  }

  function updateShieldBearer(enemy, playerPos) {
    if (!enemy.alive) return null;
    const dx = playerPos.x - enemy.x, dz = playerPos.z - enemy.z;
    const angleToPlayer = Math.atan2(dx, dz);
    const facingAngle = enemy.rotation || 0;
    let angleDiff = angleToPlayer - facingAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const shieldBlocking = Math.abs(angleDiff) < TYPES.SHIELD_BEARER.shieldArc / 2;
    return { shieldFacing: shieldBlocking, shieldHP: enemy._shieldHP || TYPES.SHIELD_BEARER.shieldHP };
  }

  function updateMortar(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    enemy._mortarTimer = (enemy._mortarTimer || 0) + dt;
    enemy._setupTimer = (enemy._setupTimer || 0) + dt;
    if (enemy._setupTimer < TYPES.MORTAR.setupTime) {
      return { settingUp: true, progress: enemy._setupTimer / TYPES.MORTAR.setupTime };
    }
    if (enemy._mortarTimer >= TYPES.MORTAR.mortarInterval) {
      enemy._mortarTimer = 0;
      // target player position with some scatter
      return {
        fire: true,
        targetX: playerPos.x + (Math.random() - 0.5) * 6,
        targetZ: playerPos.z + (Math.random() - 0.5) * 6,
        damage: TYPES.MORTAR.mortarDamage,
        radius: TYPES.MORTAR.mortarRadius
      };
    }
    return null;
  }

  function updateBoss(enemy, playerPos, dt, wave) {
    if (!enemy.alive) return null;
    const result = {};
    // Rage mode at < 50% HP
    const bossMaxHP = TYPES.BOSS.hp + (wave - 1) * 50;
    if (enemy.hp < bossMaxHP * 0.5) {
      result.rageMode = true;
      enemy._rageMult = 1.5; // faster attacks
    }
    // Summon reinforcements every 15s
    enemy._summonTimer = (enemy._summonTimer || 0) + dt;
    if (enemy._summonTimer >= 15) {
      enemy._summonTimer = 0;
      result.summon = true;
      result.summonCount = 2 + Math.floor(wave / 3);
    }
    return result;
  }

  /* ── Damage handler for shield enemies ─────── */
  function applyDamage(enemy, damage, fromAngle) {
    if (enemy.type === 'SHIELD_BEARER') {
      const facingAngle = enemy.rotation || 0;
      let angleDiff = fromAngle - facingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) < TYPES.SHIELD_BEARER.shieldArc / 2) {
        enemy._shieldHP = (enemy._shieldHP !== undefined ? enemy._shieldHP : TYPES.SHIELD_BEARER.shieldHP);
        enemy._shieldHP -= damage;
        if (enemy._shieldHP > 0) return 0; // shield absorbed
        const overflow = -enemy._shieldHP;
        enemy._shieldHP = 0;
        return overflow;
      }
    }
    return damage; // full damage (unshielded)
  }

  /* ── Boss scaling per wave ─────────────────── */
  function getBossHP(wave) { return TYPES.BOSS.hp + (wave - 1) * 50; }

  return {
    TYPES, WAVE_COMPOSITIONS,
    init, selectType, getTypeConfig,
    updateBomber, updateSniper, updateMedic, updateEngineer,
    updateWarDog, updateShieldBearer, updateMortar, updateBoss,
    applyDamage, getBossHP
  };
})();
