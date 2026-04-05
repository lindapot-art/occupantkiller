/* ============================================================
 *  ENEMY-TYPES.JS — 24 enemy type features
 *  Features: boss, bomber, sniper, medic, engineer, war dog,
 *  shield bearer, mortar, flamethrower, paratroop, tank,
 *  drone operator, spetsnaz, kadyrovite, wagner, BTR,
 *  kamikaze drone, officer, heavy sniper, commissar,
 *  thermobaric, EW operator, assault mech, swarm operator
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
    },
    // Feature 24: Flamethrower
    FLAMETHROWER: {
      id: 'FLAMETHROWER', name: 'Flamethrower', tier: 3,
      hp: 100, speed: 2.5, damage: 0, attackRange: 10,
      color: 0xff6600, scale: 1.1, xpReward: 85,
      flameDamage: 25, flameRate: 0.1, flameRange: 10,
      burnDuration: 3, burnDPS: 8,
      behavior: 'advance_and_burn'
    },
    // Feature 25: Paratroop
    PARATROOP: {
      id: 'PARATROOP', name: 'VDV Paratrooper', tier: 2,
      hp: 75, speed: 4.5, damage: 28, attackRange: 12,
      color: 0x4466aa, scale: 1.0, xpReward: 65,
      dropHeight: 30, parachuteSpeed: 3,
      behavior: 'air_drop_assault'
    },
    // Feature 26: T-72 Tank
    TANK: {
      id: 'TANK', name: 'T-72B3 Tank', tier: 4,
      hp: 1500, speed: 1.2, damage: 200, attackRange: 35,
      color: 0x445533, scale: 2.5, xpReward: 300,
      armorFront: 0.8, armorSide: 0.5, armorRear: 0.2,
      reloadTime: 4, mgDamage: 15, mgRate: 0.15,
      behavior: 'tank_advance'
    },
    // Feature 27: Drone Operator
    DRONE_OP: {
      id: 'DRONE_OP', name: 'FPV Drone Operator', tier: 2,
      hp: 50, speed: 1.5, damage: 10, attackRange: 5,
      color: 0x888888, scale: 1.0, xpReward: 70,
      droneHP: 15, droneDamage: 100, droneSpeed: 12,
      droneInterval: 8, maxDrones: 2,
      behavior: 'send_drones'
    },
    // Feature 28: Spetsnaz
    SPETSNAZ: {
      id: 'SPETSNAZ', name: 'Spetsnaz Operator', tier: 3,
      hp: 130, speed: 5, damage: 35, attackRange: 15,
      color: 0x1a1a1a, scale: 1.05, xpReward: 100,
      dodgeChance: 0.3, flashbangInterval: 12,
      canFlank: true, grenadeRange: 18,
      behavior: 'tactical_assault'
    },
    // Feature 29: Kadyrovite
    KADYROVITE: {
      id: 'KADYROVITE', name: 'Kadyrovite Fighter', tier: 2,
      hp: 95, speed: 3, damage: 22, attackRange: 10,
      color: 0x334411, scale: 1.1, xpReward: 55,
      rallyRadius: 12, rallyBuff: 1.3,
      behavior: 'rally_and_push'
    },
    // Feature 30: Wagner Prisoner
    WAGNER: {
      id: 'WAGNER', name: 'Wagner Convict', tier: 1,
      hp: 40, speed: 5.5, damage: 18, attackRange: 3,
      color: 0x554433, scale: 1.0, xpReward: 25,
      berserkerHP: 0.3, berserkerSpeedMult: 1.8,
      behavior: 'zerg_rush'
    },
    // Feature 31: BTR APC
    BTR: {
      id: 'BTR', name: 'BTR-82A APC', tier: 3,
      hp: 600, speed: 2.5, damage: 30, attackRange: 20,
      color: 0x445544, scale: 2.0, xpReward: 180,
      armorAll: 0.5, autocannonRate: 0.2,
      canSpawnInfantry: true, infantryCount: 3, infantryInterval: 15,
      behavior: 'apc_advance'
    },
    // Feature 32: Kamikaze Drone
    KAMIKAZE_DRONE: {
      id: 'KAMIKAZE_DRONE', name: 'Shahed Drone', tier: 2,
      hp: 20, speed: 8, damage: 0, attackRange: 1.5,
      color: 0x666666, scale: 0.5, xpReward: 40,
      explosionDamage: 120, explosionRadius: 4,
      flyHeight: 8, diveSpeed: 15,
      behavior: 'fly_and_dive'
    },
    // Feature 33: Officer
    OFFICER: {
      id: 'OFFICER', name: 'Russian Officer', tier: 3,
      hp: 110, speed: 2, damage: 25, attackRange: 12,
      color: 0x334455, scale: 1.15, xpReward: 120,
      buffRadius: 15, buffDamage: 1.25, buffSpeed: 1.2,
      callReinforcementInterval: 20, reinforceCount: 4,
      behavior: 'command_and_buff'
    },
    // Feature 34: Heavy Sniper
    HEAVY_SNIPER: {
      id: 'HEAVY_SNIPER', name: 'Anti-Material Sniper', tier: 4,
      hp: 90, speed: 0.8, damage: 120, attackRange: 60,
      color: 0x2a3a2a, scale: 1.1, xpReward: 150,
      aimTime: 3.0, relocateAfterShots: 1,
      penetration: true, canHitVehicles: true,
      laserSight: true, laserColor: 0x00ff00,
      behavior: 'camp_and_snipe'
    },
    // Feature 35: Commissar (political officer that prevents retreat)
    COMMISSAR: {
      id: 'COMMISSAR', name: 'Political Commissar', tier: 3,
      hp: 100, speed: 1.5, damage: 20, attackRange: 10,
      color: 0x880000, scale: 1.2, xpReward: 130,
      fearRadius: 20, moraleBuff: 1.5,
      preventsFlee: true, executesDeserters: true,
      behavior: 'command_and_execute'
    },
    // Feature 36: Thermobaric Launcher
    THERMOBARIC: {
      id: 'THERMOBARIC', name: 'TOS-1 Operator', tier: 4,
      hp: 80, speed: 1.2, damage: 0, attackRange: 35,
      color: 0xff3300, scale: 1.15, xpReward: 160,
      thermobaricDamage: 200, thermobaricRadius: 8,
      thermobaricInterval: 8, setupTime: 4,
      burnDuration: 5, burnDPS: 15,
      behavior: 'indirect_fire'
    },
    // Feature 37: Electronic Warfare Operator (jams player HUD)
    EW_OPERATOR: {
      id: 'EW_OPERATOR', name: 'EW Jammer', tier: 3,
      hp: 60, speed: 2, damage: 15, attackRange: 8,
      color: 0x4488aa, scale: 1.0, xpReward: 100,
      jamRadius: 25, jamEffect: 'hud_static',
      disablesMinimap: true, disablesCompass: true,
      behavior: 'hide_and_jam'
    },
    // Feature 38: Assault Mech (prototype heavy walker)
    ASSAULT_MECH: {
      id: 'ASSAULT_MECH', name: 'Assault Walker', tier: 5,
      hp: 3000, speed: 1.0, damage: 80, attackRange: 25,
      color: 0x444444, scale: 3.0, xpReward: 500,
      armorFront: 0.85, armorSide: 0.6, armorRear: 0.3,
      rocketSalvoDmg: 150, rocketSalvoCount: 4, rocketInterval: 6,
      mgDamage: 20, mgRate: 0.12,
      shieldHP: 500, shieldRegenRate: 10,
      behavior: 'mech_advance'
    },
    // Feature 39: Suicide Drone Swarm Operator
    SWARM_OP: {
      id: 'SWARM_OP', name: 'Drone Swarm Operator', tier: 3,
      hp: 45, speed: 1.0, damage: 8, attackRange: 5,
      color: 0x777777, scale: 1.0, xpReward: 110,
      swarmSize: 5, droneDamage: 40, droneSpeed: 15, droneHP: 8,
      swarmInterval: 12,
      behavior: 'send_swarm'
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
    10: { types: ['BOSS', 'ARMORED', 'SHIELD_BEARER', 'MORTAR', 'SNIPER_ELITE', 'MEDIC'], weights: [0.1, 0.25, 0.2, 0.15, 0.15, 0.15] },
    // Stage 5+ waves: introduce new types
    11: { types: ['FLAMETHROWER', 'WAGNER', 'KADYROVITE', 'STORMER', 'MEDIC'], weights: [0.2, 0.25, 0.2, 0.2, 0.15] },
    12: { types: ['PARATROOP', 'SPETSNAZ', 'DRONE_OP', 'SNIPER_ELITE'], weights: [0.25, 0.25, 0.25, 0.25] },
    13: { types: ['BTR', 'FLAMETHROWER', 'SHIELD_BEARER', 'WAGNER', 'KAMIKAZE_DRONE'], weights: [0.1, 0.2, 0.2, 0.3, 0.2] },
    14: { types: ['TANK', 'SPETSNAZ', 'OFFICER', 'MORTAR', 'DRONE_OP'], weights: [0.08, 0.25, 0.17, 0.25, 0.25] },
    15: { types: ['BOSS', 'TANK', 'SPETSNAZ', 'KAMIKAZE_DRONE', 'FLAMETHROWER', 'OFFICER'], weights: [0.08, 0.12, 0.2, 0.2, 0.2, 0.2] },
    // Stages 9-10: Naval & Donbas endgame waves
    16: { types: ['HEAVY_SNIPER', 'BTR', 'SPETSNAZ', 'DRONE_OP', 'SHIELD_BEARER'], weights: [0.15, 0.15, 0.25, 0.25, 0.2] },
    17: { types: ['COMMISSAR', 'WAGNER', 'KADYROVITE', 'FLAMETHROWER', 'MORTAR'], weights: [0.1, 0.25, 0.2, 0.25, 0.2] },
    18: { types: ['THERMOBARIC', 'TANK', 'HEAVY_SNIPER', 'SPETSNAZ', 'EW_OPERATOR'], weights: [0.1, 0.15, 0.2, 0.3, 0.25] },
    19: { types: ['BOSS', 'THERMOBARIC', 'COMMISSAR', 'BTR', 'SWARM_OP', 'HEAVY_SNIPER'], weights: [0.08, 0.15, 0.12, 0.2, 0.25, 0.2] },
    20: { types: ['BOSS', 'ASSAULT_MECH', 'TANK', 'THERMOBARIC', 'SWARM_OP', 'SPETSNAZ'], weights: [0.1, 0.05, 0.15, 0.2, 0.25, 0.25] },
    // Stages 11-12: Belgorod & Kremlin — maximum intensity
    21: { types: ['ASSAULT_MECH', 'HEAVY_SNIPER', 'COMMISSAR', 'EW_OPERATOR', 'THERMOBARIC', 'SWARM_OP'], weights: [0.08, 0.2, 0.15, 0.17, 0.2, 0.2] },
    22: { types: ['BOSS', 'ASSAULT_MECH', 'TANK', 'BTR', 'THERMOBARIC', 'SWARM_OP', 'COMMISSAR'], weights: [0.1, 0.08, 0.12, 0.15, 0.2, 0.2, 0.15] },
    23: { types: ['BOSS', 'ASSAULT_MECH', 'HEAVY_SNIPER', 'SPETSNAZ', 'THERMOBARIC', 'EW_OPERATOR', 'SWARM_OP'], weights: [0.12, 0.1, 0.15, 0.18, 0.15, 0.15, 0.15] },
    // Wave 24 = Kremlin final — everything
    24: { types: ['BOSS', 'ASSAULT_MECH', 'TANK', 'THERMOBARIC', 'HEAVY_SNIPER', 'COMMISSAR', 'SWARM_OP', 'SPETSNAZ'], weights: [0.15, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.13] },
  };

  /* ── AI Behavior State ─────────────────────── */
  let activeEnemies = [];

  function init() { activeEnemies = []; }

  function selectType(wave) {
    const comp = WAVE_COMPOSITIONS[Math.min(wave, 24)] || WAVE_COMPOSITIONS[24];
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

  /* ── New AI update functions for B18 enemy types ─── */

  function updateFlamethrower(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    const dx = playerPos.x - enemy.x, dz = playerPos.z - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < TYPES.FLAMETHROWER.flameRange) {
      enemy._flameTimer = (enemy._flameTimer || 0) + dt;
      if (enemy._flameTimer >= TYPES.FLAMETHROWER.flameRate) {
        enemy._flameTimer = 0;
        return { flame: true, damage: TYPES.FLAMETHROWER.flameDamage, burn: TYPES.FLAMETHROWER.burnDuration, burnDPS: TYPES.FLAMETHROWER.burnDPS };
      }
    }
    return null;
  }

  function updateParatroop(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    if (enemy._dropping) {
      enemy.y = (enemy.y || 30) - TYPES.PARATROOP.parachuteSpeed * dt;
      if (enemy.y <= (enemy._groundY || 5)) {
        enemy._dropping = false;
        enemy.y = enemy._groundY || 5;
      }
      return { dropping: true, y: enemy.y };
    }
    return null; // normal combat handled by base AI
  }

  function updateTank(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    enemy._reloadTimer = (enemy._reloadTimer || 0) + dt;
    enemy._mgTimer = (enemy._mgTimer || 0) + dt;
    const dx = playerPos.x - enemy.x, dz = playerPos.z - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const result = {};
    // Main gun
    if (dist < TYPES.TANK.attackRange && enemy._reloadTimer >= TYPES.TANK.reloadTime) {
      enemy._reloadTimer = 0;
      result.mainGun = true;
      result.damage = TYPES.TANK.damage;
      result.targetX = playerPos.x + (Math.random() - 0.5) * 3;
      result.targetZ = playerPos.z + (Math.random() - 0.5) * 3;
    }
    // Coaxial MG
    if (dist < 25 && enemy._mgTimer >= TYPES.TANK.mgRate) {
      enemy._mgTimer = 0;
      result.mg = true;
      result.mgDamage = TYPES.TANK.mgDamage;
    }
    return result.mainGun || result.mg ? result : null;
  }

  function updateDroneOp(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    enemy._droneTimer = (enemy._droneTimer || 0) + dt;
    enemy._activeDrones = enemy._activeDrones || 0;
    if (enemy._droneTimer >= TYPES.DRONE_OP.droneInterval && enemy._activeDrones < TYPES.DRONE_OP.maxDrones) {
      enemy._droneTimer = 0;
      enemy._activeDrones++;
      return { launchDrone: true, droneDamage: TYPES.DRONE_OP.droneDamage, droneSpeed: TYPES.DRONE_OP.droneSpeed };
    }
    return null;
  }

  function updateSpetsnaz(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    enemy._flashTimer = (enemy._flashTimer || 0) + dt;
    const dx = playerPos.x - enemy.x, dz = playerPos.z - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Dodge chance on incoming fire handled in applyDamage
    if (dist < TYPES.SPETSNAZ.grenadeRange && enemy._flashTimer >= TYPES.SPETSNAZ.flashbangInterval) {
      enemy._flashTimer = 0;
      return { flashbang: true, targetX: playerPos.x, targetZ: playerPos.z };
    }
    if (TYPES.SPETSNAZ.canFlank && dist < 20 && dist > 8) {
      // Try to flank: move perpendicular
      const perpX = -dz / dist, perpZ = dx / dist;
      return { flanking: true, moveX: perpX, moveZ: perpZ };
    }
    return null;
  }

  function updateKadyrovite(enemy, allEnemies) {
    if (!enemy.alive) return null;
    // Rally nearby allies
    const range = TYPES.KADYROVITE.rallyRadius;
    let rallied = 0;
    for (const ally of allEnemies) {
      if (ally === enemy || !ally.alive) continue;
      const dx = ally.x - enemy.x, dz = ally.z - enemy.z;
      if (dx * dx + dz * dz < range * range) {
        ally._rallyBuff = TYPES.KADYROVITE.rallyBuff;
        rallied++;
      }
    }
    return rallied > 0 ? { rallying: true, count: rallied } : null;
  }

  function updateWagner(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    // Berserker mode at low HP
    const cfg = TYPES.WAGNER;
    if (enemy.hp < cfg.hp * cfg.berserkerHP) {
      enemy._berserker = true;
      return { berserker: true, speedMult: cfg.berserkerSpeedMult };
    }
    return null;
  }

  function updateBTR(enemy, playerPos, dt, allEnemies) {
    if (!enemy.alive) return null;
    const result = {};
    enemy._cannonTimer = (enemy._cannonTimer || 0) + dt;
    enemy._spawnTimer = (enemy._spawnTimer || 0) + dt;
    const dx = playerPos.x - enemy.x, dz = playerPos.z - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Autocannon
    if (dist < TYPES.BTR.attackRange && enemy._cannonTimer >= TYPES.BTR.autocannonRate) {
      enemy._cannonTimer = 0;
      result.fire = true;
      result.damage = TYPES.BTR.damage;
    }
    // Spawn infantry
    if (TYPES.BTR.canSpawnInfantry && enemy._spawnTimer >= TYPES.BTR.infantryInterval) {
      enemy._spawnTimer = 0;
      result.spawnInfantry = true;
      result.infantryCount = TYPES.BTR.infantryCount;
    }
    return result.fire || result.spawnInfantry ? result : null;
  }

  function updateKamikazeDrone(enemy, playerPos, dt) {
    if (!enemy.alive) return null;
    const dx = playerPos.x - enemy.x, dz = playerPos.z - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Fly high then dive when close
    if (enemy._diving) {
      if (dist < TYPES.KAMIKAZE_DRONE.attackRange) {
        return { detonate: true, damage: TYPES.KAMIKAZE_DRONE.explosionDamage, radius: TYPES.KAMIKAZE_DRONE.explosionRadius };
      }
      return { diving: true };
    }
    if (dist < 15) {
      enemy._diving = true;
      return { startDive: true };
    }
    return { flying: true, height: TYPES.KAMIKAZE_DRONE.flyHeight };
  }

  function updateOfficer(enemy, allEnemies, dt) {
    if (!enemy.alive) return null;
    const result = {};
    enemy._reinforceTimer = (enemy._reinforceTimer || 0) + dt;
    // Buff nearby allies
    const range = TYPES.OFFICER.buffRadius;
    let buffed = 0;
    for (const ally of allEnemies) {
      if (ally === enemy || !ally.alive) continue;
      const dx = ally.x - enemy.x, dz = ally.z - enemy.z;
      if (dx * dx + dz * dz < range * range) {
        ally._officerBuffDmg = TYPES.OFFICER.buffDamage;
        ally._officerBuffSpd = TYPES.OFFICER.buffSpeed;
        buffed++;
      }
    }
    if (buffed > 0) result.buffing = true;
    // Call reinforcements
    if (enemy._reinforceTimer >= TYPES.OFFICER.callReinforcementInterval) {
      enemy._reinforceTimer = 0;
      result.reinforce = true;
      result.reinforceCount = TYPES.OFFICER.reinforceCount;
    }
    return result.buffing || result.reinforce ? result : null;
  }

  /* ── Tank armor damage reduction ──────────── */
  function applyTankArmor(enemy, damage, fromAngle) {
    if (enemy.type !== 'TANK') return damage;
    const facingAngle = enemy.rotation || 0;
    let angleDiff = fromAngle - facingAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const absDiff = Math.abs(angleDiff);
    let reduction;
    if (absDiff < Math.PI * 0.3) reduction = TYPES.TANK.armorFront;
    else if (absDiff > Math.PI * 0.7) reduction = TYPES.TANK.armorRear;
    else reduction = TYPES.TANK.armorSide;
    return damage * (1 - reduction);
  }

  return {
    TYPES, WAVE_COMPOSITIONS,
    init, selectType, getTypeConfig,
    updateBomber, updateSniper, updateMedic, updateEngineer,
    updateWarDog, updateShieldBearer, updateMortar, updateBoss,
    updateFlamethrower, updateParatroop, updateTank, updateDroneOp,
    updateSpetsnaz, updateKadyrovite, updateWagner, updateBTR,
    updateKamikazeDrone, updateOfficer,
    applyDamage, applyTankArmor, getBossHP
  };
})();
