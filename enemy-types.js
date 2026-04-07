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

    // ── Stage-Specific Boss Types (Stages 5-12) ──────────────

    // Stage 5: MARIUPOL STEELWORKS — Forge Master amid molten steel
    BOSS_MARIUPOL: {
      id: 'BOSS_MARIUPOL', name: 'Azovstal Forge Master', tier: 4,
      hp: 800, speed: 1.8, damage: 55, attackRange: 10,
      color: 0xff4400, scale: 1.8, xpReward: 350,
      abilities: ['summon_reinforcements', 'rage_mode', 'flame_aura'],
      lootTable: ['WEAPON', 'ARMOR', 'MEDKIT', 'RARE_WEAPON'],
      spawnMessage: '🔥 THE FORGE MASTER EMERGES FROM THE FURNACE!',
      behavior: 'boss',
      burnDPS: 5, burnRadius: 6, // passive fire aura
      rageThreshold: 0.5, rageDamageMult: 1.6,
      summonTypes: ['FLAMETHROWER', 'SHIELD_BEARER'], summonCount: 3, summonInterval: 18
    },

    // Stage 6: CRIMEA BRIDGE — Admiral raining down naval fire
    BOSS_CRIMEA: {
      id: 'BOSS_CRIMEA', name: 'Kerch Bridge Admiral', tier: 4,
      hp: 1000, speed: 1.2, damage: 40, attackRange: 30,
      color: 0x2244aa, scale: 1.7, xpReward: 450,
      abilities: ['summon_reinforcements', 'rage_mode', 'naval_barrage'],
      lootTable: ['WEAPON', 'ARMOR', 'MEDKIT', 'RARE_WEAPON'],
      spawnMessage: '⚓ KERCH BRIDGE ADMIRAL ON DECK!',
      behavior: 'boss',
      barrageDamage: 100, barrageRadius: 6, barrageInterval: 10,
      rageThreshold: 0.4, rageDamageMult: 1.5,
      summonTypes: ['PARATROOP', 'KAMIKAZE_DRONE'], summonCount: 4, summonInterval: 16
    },

    // Stage 7: CHORNOBYL ZONE — Irradiated mutant commander, regenerates
    BOSS_CHORNOBYL: {
      id: 'BOSS_CHORNOBYL', name: 'Irradiated Stalker', tier: 4,
      hp: 1200, speed: 2.0, damage: 50, attackRange: 12,
      color: 0x44ff22, scale: 2.0, xpReward: 550,
      abilities: ['summon_reinforcements', 'rage_mode', 'radiation_aura', 'regeneration'],
      lootTable: ['WEAPON', 'ARMOR', 'MEDKIT', 'RARE_WEAPON', 'XP_BOOST'],
      spawnMessage: '☢️ IRRADIATED STALKER CRAWLS FROM THE REACTOR!',
      behavior: 'boss',
      radDPS: 8, radRadius: 10, // radiation damages player nearby
      regenRate: 15, // HP per second when not taking damage for 3s
      rageThreshold: 0.35, rageDamageMult: 1.7,
      summonTypes: ['WAR_DOG', 'BOMBER', 'WAGNER'], summonCount: 5, summonInterval: 14
    },

    // Stage 8: MOSCOW FINALE — Elite FSB field commander, fast & lethal
    BOSS_MOSCOW: {
      id: 'BOSS_MOSCOW', name: 'FSB Black Colonel', tier: 5,
      hp: 1800, speed: 3.0, damage: 65, attackRange: 18,
      color: 0x111111, scale: 1.6, xpReward: 700,
      abilities: ['summon_reinforcements', 'rage_mode', 'flashbang_salvo', 'tactical_dodge'],
      lootTable: ['RARE_WEAPON', 'ARMOR', 'MEDKIT', 'XP_BOOST'],
      spawnMessage: '🕶️ FSB BLACK COLONEL HAS ENTERED THE FIELD!',
      behavior: 'boss',
      dodgeChance: 0.25, flashbangInterval: 8,
      rageThreshold: 0.4, rageDamageMult: 1.8, rageSpeedMult: 1.5,
      summonTypes: ['SPETSNAZ', 'SNIPER_ELITE', 'EW_OPERATOR'], summonCount: 4, summonInterval: 15
    },

    // Stage 9: SEVASTOPOL NAVAL BASE — Fleet Commander with heavy ordnance
    BOSS_SEVASTOPOL: {
      id: 'BOSS_SEVASTOPOL', name: 'Black Sea Fleet Commander', tier: 5,
      hp: 2000, speed: 1.0, damage: 80, attackRange: 35,
      color: 0x335588, scale: 2.2, xpReward: 850,
      abilities: ['summon_reinforcements', 'rage_mode', 'cruise_missile', 'torpedo_salvo'],
      lootTable: ['RARE_WEAPON', 'ARMOR', 'MEDKIT', 'XP_BOOST', 'LEGENDARY_WEAPON'],
      spawnMessage: '🚢 BLACK SEA FLEET COMMANDER ORDERS ALL HANDS!',
      behavior: 'boss',
      missileDamage: 150, missileRadius: 7, missileInterval: 12,
      armorFront: 0.5, armorSide: 0.3,
      rageThreshold: 0.35, rageDamageMult: 1.6,
      summonTypes: ['BTR', 'DRONE_OP', 'HEAVY_SNIPER'], summonCount: 3, summonInterval: 20
    },

    // Stage 10: DONBAS FINAL PUSH — Entrenched warlord, overwhelming reinforcements
    BOSS_DONBAS: {
      id: 'BOSS_DONBAS', name: 'Donbas Warlord', tier: 5,
      hp: 2500, speed: 1.4, damage: 60, attackRange: 15,
      color: 0x553322, scale: 2.0, xpReward: 1000,
      abilities: ['summon_reinforcements', 'rage_mode', 'fortify', 'artillery_call'],
      lootTable: ['RARE_WEAPON', 'LEGENDARY_WEAPON', 'ARMOR', 'MEDKIT', 'XP_BOOST'],
      spawnMessage: '💀 THE DONBAS WARLORD CALLS HIS HORDE!',
      behavior: 'boss',
      artilleryDamage: 120, artilleryRadius: 5, artilleryInterval: 10,
      shieldHP: 300, // temporary barrier
      rageThreshold: 0.3, rageDamageMult: 1.8,
      summonTypes: ['KADYROVITE', 'WAGNER', 'COMMISSAR', 'MORTAR'], summonCount: 6, summonInterval: 12
    },

    // Stage 11: BELGOROD OFFENSIVE — Walking fortress general
    BOSS_BELGOROD: {
      id: 'BOSS_BELGOROD', name: 'Belgorod Iron General', tier: 5,
      hp: 3000, speed: 1.2, damage: 90, attackRange: 25,
      color: 0x445533, scale: 2.5, xpReward: 1200,
      abilities: ['summon_reinforcements', 'rage_mode', 'rocket_salvo', 'armor_plates'],
      lootTable: ['LEGENDARY_WEAPON', 'ARMOR', 'MEDKIT', 'XP_BOOST'],
      spawnMessage: '🛡️ THE IRON GENERAL ROLLS INTO BATTLE!',
      behavior: 'boss',
      armorFront: 0.6, armorSide: 0.4, armorRear: 0.15,
      rocketSalvoDmg: 130, rocketSalvoCount: 6, rocketInterval: 8,
      rageThreshold: 0.25, rageDamageMult: 2.0, rageArmorBoost: 0.2,
      summonTypes: ['TANK', 'THERMOBARIC', 'ASSAULT_MECH'], summonCount: 3, summonInterval: 22
    },

    // Stage 12: KREMLIN SHOWDOWN — The Tyrant, final boss of the game
    BOSS_KREMLIN: {
      id: 'BOSS_KREMLIN', name: 'The Tyrant', tier: 5,
      hp: 5000, speed: 1.5, damage: 100, attackRange: 20,
      color: 0xcc0000, scale: 3.0, xpReward: 2500,
      abilities: ['summon_reinforcements', 'rage_mode', 'nuclear_briefcase', 'body_doubles', 'bunker_shield'],
      lootTable: ['LEGENDARY_WEAPON', 'LEGENDARY_WEAPON', 'XP_BOOST', 'VICTORY_TOKEN'],
      spawnMessage: '👑 THE TYRANT MAKES HIS LAST STAND!',
      behavior: 'boss',
      phaseThresholds: [0.75, 0.5, 0.25], // 4-phase fight
      shieldHP: 800, shieldRegenRate: 5,
      nukeDamage: 250, nukeRadius: 12, nukeInterval: 20,
      rageThreshold: 0.25, rageDamageMult: 2.5, rageSpeedMult: 2.0,
      summonTypes: ['SPETSNAZ', 'ASSAULT_MECH', 'THERMOBARIC', 'SWARM_OP'], summonCount: 5, summonInterval: 15
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
      if (!ally || ally === enemy || !ally.alive) continue;
      const dx = ally.mesh.position.x - enemy.mesh.position.x, dz = ally.mesh.position.z - enemy.mesh.position.z;
      if (dx * dx + dz * dz < range * range) {
        const cfg = getTypeConfig(ally.typeName) || { hp: 50 };
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

  /* ── Stage-Specific Boss Selection ─────────── */
  const STAGE_BOSS_MAP = {
    5:  'BOSS_MARIUPOL',    // Azovstal Forge Master
    6:  'BOSS_CRIMEA',      // Kerch Bridge Admiral
    7:  'BOSS_CHORNOBYL',   // Irradiated Stalker
    8:  'BOSS_MOSCOW',      // FSB Black Colonel
    9:  'BOSS_SEVASTOPOL',  // Black Sea Fleet Commander
    10: 'BOSS_DONBAS',      // Donbas Warlord
    11: 'BOSS_BELGOROD',    // Belgorod Iron General
    12: 'BOSS_KREMLIN'      // The Tyrant
  };

  /**
   * Returns the boss type ID for a given stage (1-based stage id).
   * Stages 1-4 use the generic 'BOSS'. Stages 5-12 have unique bosses.
   */
  function getBossForStage(stageId) {
    return STAGE_BOSS_MAP[stageId] || 'BOSS';
  }

  /**
   * Returns max HP for any boss type, with optional wave-based scaling.
   * Stage bosses use their base HP + 5% per wave beyond their spawn wave.
   */
  function getStageBossHP(bossTypeId, wave) {
    const cfg = TYPES[bossTypeId];
    if (!cfg) return getBossHP(wave);
    return cfg.hp + Math.floor(wave * 0.05 * cfg.hp);
  }

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
      if (!ally || ally === enemy || !ally.alive) continue;
      const dx = ally.mesh.position.x - enemy.mesh.position.x, dz = ally.mesh.position.z - enemy.mesh.position.z;
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
      if (!ally || ally === enemy || !ally.alive) continue;
      const dx = ally.mesh.position.x - enemy.mesh.position.x, dz = ally.mesh.position.z - enemy.mesh.position.z;
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
    TYPES, WAVE_COMPOSITIONS, STAGE_BOSS_MAP,
    init, selectType, getTypeConfig,
    updateBomber, updateSniper, updateMedic, updateEngineer,
    updateWarDog, updateShieldBearer, updateMortar, updateBoss,
    updateFlamethrower, updateParatroop, updateTank, updateDroneOp,
    updateSpetsnaz, updateKadyrovite, updateWagner, updateBTR,
    updateKamikazeDrone, updateOfficer,
    applyDamage, applyTankArmor, getBossHP,
    getBossForStage, getStageBossHP
  };
})();
