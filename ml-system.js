/* ───────────────────────────────────────────────────────────
   ML SYSTEM — Machine Learning & Adaptive Optimization
   Tracks player behavior, adjusts difficulty, optimizes performance
   ─────────────────────────────────────────────────────────── */
var MLSystem = (function () {
  'use strict';

  var STORAGE_KEY = 'occupantkiller_ml';

  /* ── Persistent State (survives page reloads) ───────────── */
  var data = {
    sessions: 0,
    totalPlayTime: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalShots: 0,
    totalHits: 0,
    avgAccuracy: 0,
    avgSurvivalTime: 0,
    bestScore: 0,
    bestWave: 0,
    bestLevel: 0,
    weaponStats: {},        // { weaponId: { kills, shots, hits, favTime } }
    levelAttempts: {},       // { levelIndex: { attempts, completions, avgTime } }
    difficultyProfile: 0.5, // 0=easy .. 1=hard (learned over time)
    performanceProfile: {
      avgFPS: 60,
      lowFPS: false,
      reducedParticles: false,
      reducedShadows: false,
      reducedEnemies: false,
    },
    // Codebase memory - stores key facts about the project
    projectMemory: {
      lastAnalysis: null,
      facts: [],
      version: '1.0',
    },
  };

  /* ── Session State (current play session) ───────────────── */
  var session = {
    startTime: 0,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    damageTaken: 0,
    damageDealt: 0,
    wavesCompleted: 0,
    currentScore: 0,
    peakHP: 100,
    lowestHP: 100,
    weaponSwitches: 0,
    timesReloaded: 0,
    blocksDestroyed: 0,
    pickupsCollected: 0,
    fpsHistory: [],
    difficultyAdjustments: 0,
  };

  /* ── Adaptive Difficulty Engine ──────────────────────────── */
  var difficultyMult = 1.0;
  var recentPerformance = []; // sliding window of recent wave results

  function calculateDifficulty() {
    // Factors that make game easier:
    // - Low accuracy (player is struggling to hit)
    // - Frequent deaths (dying too fast)
    // - Low survival time
    // Factors that make game harder:
    // - High accuracy (player is too skilled)
    // - No deaths (player is dominating)
    // - Fast wave completion

    if (recentPerformance.length < 2) return difficultyMult;

    var recent = recentPerformance.slice(-5);
    var avgAccuracy = recent.reduce(function (s, r) { return s + r.accuracy; }, 0) / recent.length;
    var avgSurvival = recent.reduce(function (s, r) { return s + r.survivalPct; }, 0) / recent.length;
    var deathRate = recent.filter(function (r) { return r.died; }).length / recent.length;

    // Weighted scoring for difficulty adjustment
    var adjustment = 0;

    // Accuracy factor
    if (avgAccuracy > 0.6) adjustment += 0.05;      // Very accurate = harder
    else if (avgAccuracy < 0.2) adjustment -= 0.08;  // Struggling = easier

    // Survival factor
    if (avgSurvival > 0.8) adjustment += 0.04;       // Barely damaged = harder
    else if (avgSurvival < 0.3) adjustment -= 0.06;  // Taking heavy damage = easier

    // Death rate factor
    if (deathRate > 0.5) adjustment -= 0.10;          // Dying a lot = much easier
    else if (deathRate === 0) adjustment += 0.03;     // Never dying = harder

    // Apply with momentum (gradual changes)
    difficultyMult = Math.max(0.5, Math.min(2.0, difficultyMult + adjustment));

    // Update persistent profile
    data.difficultyProfile = data.difficultyProfile * 0.8 + (difficultyMult / 2.0) * 0.2;

    return difficultyMult;
  }

  /* ── Performance Optimizer ──────────────────────────────── */
  var fpsAccum = 0;
  var fpsSamples = 0;
  var lastOptimizeCheck = 0;

  function trackFPS(delta) {
    var fps = 1 / Math.max(delta, 0.001);
    fpsAccum += fps;
    fpsSamples++;
    session.fpsHistory.push(fps);
    if (session.fpsHistory.length > 300) session.fpsHistory.shift();

    lastOptimizeCheck += delta;
    if (lastOptimizeCheck > 5) { // Check every 5 seconds
      lastOptimizeCheck = 0;
      optimizePerformance();
    }
  }

  function optimizePerformance() {
    if (fpsSamples === 0) return;
    var avgFPS = fpsAccum / fpsSamples;
    data.performanceProfile.avgFPS = avgFPS;
    fpsAccum = 0;
    fpsSamples = 0;

    var recommendations = {};

    if (avgFPS < 25) {
      // Critical performance
      recommendations.shadowMapSize = 512;
      recommendations.maxEnemies = 15;
      recommendations.particleCount = 500;
      recommendations.chunkBudget = 2;
      data.performanceProfile.lowFPS = true;
      data.performanceProfile.reducedShadows = true;
      data.performanceProfile.reducedEnemies = true;
      data.performanceProfile.reducedParticles = true;
    } else if (avgFPS < 40) {
      // Low performance
      recommendations.shadowMapSize = 1024;
      recommendations.maxEnemies = 25;
      recommendations.particleCount = 1500;
      recommendations.chunkBudget = 3;
      data.performanceProfile.lowFPS = true;
      data.performanceProfile.reducedShadows = true;
    } else {
      // Good performance
      recommendations.shadowMapSize = 2048;
      recommendations.maxEnemies = 50;
      recommendations.particleCount = 3000;
      recommendations.chunkBudget = 4;
      data.performanceProfile.lowFPS = false;
      data.performanceProfile.reducedShadows = false;
      data.performanceProfile.reducedEnemies = false;
      data.performanceProfile.reducedParticles = false;
    }

    return recommendations;
  }

  /* ── Event Tracking ─────────────────────────────────────── */
  function onShot(weaponId) {
    session.shots++;
    if (!data.weaponStats[weaponId]) {
      data.weaponStats[weaponId] = { kills: 0, shots: 0, hits: 0, favTime: 0 };
    }
    data.weaponStats[weaponId].shots++;
    data.totalShots++;
  }

  function onHit(weaponId) {
    session.hits++;
    if (data.weaponStats[weaponId]) data.weaponStats[weaponId].hits++;
    data.totalHits++;
  }

  function onKill(weaponId) {
    session.kills++;
    if (data.weaponStats[weaponId]) data.weaponStats[weaponId].kills++;
    data.totalKills++;
  }

  function onDeath() {
    session.deaths++;
    data.totalDeaths++;
  }

  function onWaveComplete(waveNum, levelIdx, hpPct) {
    session.wavesCompleted++;
    recentPerformance.push({
      accuracy: session.shots > 0 ? session.hits / session.shots : 0,
      survivalPct: hpPct,
      died: false,
      wave: waveNum,
    });
    if (recentPerformance.length > 10) recentPerformance.shift();
    calculateDifficulty();
  }

  function onPickup() { session.pickupsCollected++; }
  function onReload() { session.timesReloaded++; }
  function onWeaponSwitch() { session.weaponSwitches++; }
  function onBlockDestroyed() { session.blocksDestroyed++; }
  function onDamageTaken(amount) {
    session.damageTaken += amount;
    session.lowestHP = Math.min(session.lowestHP, session.peakHP - session.damageTaken);
  }
  function onDamageDealt(amount) { session.damageDealt += amount; }

  /* ── Project Memory (helps agents remember across sessions) */
  function storeProjectFact(fact, source) {
    data.projectMemory.facts.push({
      fact: fact,
      source: source,
      timestamp: Date.now(),
    });
    // Keep last 50 facts
    if (data.projectMemory.facts.length > 50) {
      data.projectMemory.facts = data.projectMemory.facts.slice(-50);
    }
    data.projectMemory.lastAnalysis = Date.now();
    save();
  }

  function getProjectFacts() {
    return data.projectMemory.facts;
  }

  /* ── Feature Registry — tracks all implemented features ──────── */
  var FEATURE_REGISTRY = [
    { id: 'WEAPON_SHOVEL',       cat: 'weapons',   desc: 'Army Shovel melee weapon with auto-mine (hold to dig)' },
    { id: 'WEAPON_23_ARSENAL',   cat: 'weapons',   desc: '23 weapons: pistol, rifles, LMGs, snipers, AT, grenades, shotgun, minigun, crossbow' },
    { id: 'WEAPON_FULL_AUTO',    cat: 'weapons',   desc: 'Full-auto fire for AK74, RPK74, PKM, M4A1, SCAR, DShK, MG3, MP5, Minigun' },
    { id: 'WEAPON_SWITCHER',     cat: 'weapons',   desc: 'In-game weapon switcher: keys 1-0, Q/E cycle, scroll wheel, HUD slots' },
    { id: 'TERRAIN_DESTRUCTION', cat: 'world',     desc: 'Bullets/explosions/shovel destroy terrain blocks (create holes)' },
    { id: 'VOXEL_WORLD',        cat: 'world',     desc: 'Chunk-based voxel world with 19 block types, Perlin noise terrain' },
    { id: 'ENEMY_8_TYPES',      cat: 'enemies',   desc: '8 enemy types: Conscript, Stormer, Armored, Medic, Officer, Sniper, Engineer, Drone_Op' },
    { id: 'ENEMY_HITBOXES',     cat: 'enemies',   desc: 'Full hitbox system with all mesh parts for raycaster detection' },
    { id: 'ENEMY_ASSAULT_GROUPS', cat: 'enemies',  desc: '5 assault groups with state machine (forming/advancing/assaulting/retreating)' },
    { id: 'NPC_SIMS',           cat: 'npcs',      desc: 'Ukrainian friendly NPCs with needs (health/hunger/fatigue/morale/stress), jobs, skills' },
    { id: 'NPC_COMBAT',         cat: 'npcs',      desc: 'NPCs actively seek and fight enemies with rank-based weapons' },
    { id: 'NPC_WEAPONS',        cat: 'npcs',      desc: 'NPC weapon assignment by rank: Trainee=PM, Infantry=AK74, Specialist=RPK74, Veteran=PKM, Elite=M4A1' },
    { id: 'NPC_ASSAULT_GROUPS', cat: 'npcs',      desc: '4 friendly assault groups with staging/advancing/engaging/defending/retreating/regrouping' },
    { id: 'VEHICLES_GROUND',    cat: 'vehicles',  desc: 'Ground vehicles with gravity, ground clamping, patrol AI' },
    { id: 'VEHICLES_AIR',       cat: 'vehicles',  desc: 'Helicopter and plane with flying controls' },
    { id: 'VEHICLES_TURRET',    cat: 'vehicles',  desc: 'Turret combat system for player and AI vehicles' },
    { id: 'DRONES',             cat: 'vehicles',  desc: 'Recon, FPV attack, and bomb drones with possession system' },
    { id: 'BUILDING_SYSTEM',    cat: 'building',  desc: '6 structure templates: Barracks, Factory, Turret, Drone Hangar, Command Center, Wall' },
    { id: 'MATERIAL_INVENTORY', cat: 'economy',   desc: '6 resources: wood, metal, electronics, fuel, stone, food + currency' },
    { id: 'ECONOMY_TRADING',    cat: 'economy',   desc: 'Market trading with fluctuating prices, production buildings' },
    { id: 'MUSIC_SYSTEM',       cat: 'audio',     desc: 'Procedural music: battle drums, ambient pads, victory fanfare' },
    { id: 'AUDIO_SFX',          cat: 'audio',     desc: 'Procedural SFX: gunshots, explosions, hits, reload, pickup, death, footstep, wind, wave alarm' },
    { id: 'HUD_FULL',           cat: 'ui',        desc: 'HUD: health bar, ammo, weapon slots, kill feed, minimap, hit direction, crosshair' },
    { id: 'WAVE_SYSTEM',        cat: 'gameplay',  desc: '4 stages x 7 waves with progressive enemy types and battlefield events' },
    { id: 'STEALTH',            cat: 'gameplay',  desc: 'Stealth toggle with enemy detection changes' },
    { id: 'PICKUPS',            cat: 'gameplay',  desc: '6 pickup types: Health, Ammo, Armor, Grenade, Medkit, Stim' },
    { id: 'RANKS',              cat: 'gameplay',  desc: 'Player rank progression system' },
    { id: 'SKILLS',             cat: 'gameplay',  desc: 'Player skill system affecting recoil, reload, accuracy' },
    { id: 'MISSIONS',           cat: 'gameplay',  desc: 'Mission system with objectives' },
    { id: 'ML_DIFFICULTY',      cat: 'ml',        desc: 'Adaptive difficulty (0.5-2.0x) based on player accuracy, survival, death rate' },
    { id: 'ML_PERFORMANCE',     cat: 'ml',        desc: 'FPS tracking with auto-quality recommendations' },
    { id: 'ML_PERSISTENCE',     cat: 'ml',        desc: 'LocalStorage player profile with weapon stats, level attempts, project memory' },
    { id: 'WEATHER',            cat: 'world',     desc: 'Weather system affecting gameplay' },
    { id: 'TIME_CYCLE',         cat: 'world',     desc: 'Day/night cycle with time-based NPC behavior' },
    { id: 'TRACERS',            cat: 'visual',    desc: 'Bullet tracers and smoke effects' },
    { id: 'RECOIL',             cat: 'weapons',   desc: 'Per-weapon recoil with visual gun kick and camera shake' },
    // ── Round 2 features ─────────────────────────────────────
    { id: 'WEAPON_CLAYMORE',    cat: 'weapons',   desc: 'M18 Claymore placeable proximity mine' },
    { id: 'WEAPON_SMOKE',       cat: 'weapons',   desc: 'Smoke grenade for concealment' },
    { id: 'WEAPON_FLASHBANG',   cat: 'weapons',   desc: 'M84 Flashbang stun grenade' },
    { id: 'WEAPON_JAMMING',     cat: 'weapons',   desc: 'Weapons jam after sustained fire, R to clear' },
    { id: 'KILL_STREAK',        cat: 'gameplay',  desc: 'Rapid kill combo system with score multiplier up to 3x' },
    { id: 'PRONE_STANCE',       cat: 'gameplay',  desc: 'Z key prone stance: 0.3x speed, harder to detect' },
    { id: 'BLEED_BANDAGE',      cat: 'gameplay',  desc: 'Heavy hits cause bleed DOT, X key bandage to stop' },
    { id: 'DOG_TAGS',           cat: 'gameplay',  desc: 'Collect dog tags from kills, bonus score every 10' },
    { id: 'AIRDROP_BEACON',     cat: 'gameplay',  desc: 'N key calls supply airdrop with 45s cooldown' },
    { id: 'TACTICAL_COMPASS',   cat: 'ui',        desc: 'Compass bar at top of screen with cardinal directions' },
    { id: 'ENEMY_SURRENDER',    cat: 'enemies',   desc: 'Low-HP enemies surrender, bonus score for POW capture' },
    { id: 'ENEMY_FLAMETHROWER', cat: 'enemies',   desc: 'Flamethrower enemy type: AOE fire attacker' },
    { id: 'ENEMY_SABOTEUR',     cat: 'enemies',   desc: 'Saboteur enemy: fast stealthy flanker' },
    { id: 'TERRAIN_TUNNEL',     cat: 'world',     desc: 'Underground tunnel terrain with timber supports' },
    { id: 'TERRAIN_COLLAPSED_BRIDGE', cat: 'world', desc: 'Collapsed bridge with rubble and rebar' },
    { id: 'TERRAIN_FUEL_DEPOT', cat: 'world',     desc: 'Fuel depot with barrel clusters under metal roof' },
    { id: 'TERRAIN_ARTILLERY',  cat: 'world',     desc: 'Artillery battery with 3 gun emplacements' },
    { id: 'TERRAIN_RADAR',      cat: 'world',     desc: 'Radar tower with electronics dish and platform' },
    { id: 'DYNAMIC_MUSIC',      cat: 'audio',     desc: 'Music intensity scales with combat proximity' },
    { id: 'BATTLE_EVENTS_R2',   cat: 'gameplay',  desc: 'New events: Chemical attack, EMP blast, Tunnel breach' },
  ];

  function getFeatureRegistry() { return FEATURE_REGISTRY; }
  function getFeatureCount() { return FEATURE_REGISTRY.length; }
  function getFeaturesByCategory(cat) { return FEATURE_REGISTRY.filter(function(f) { return f.cat === cat; }); }

  /* ── Persistence ────────────────────────────────────────── */
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* storage full or disabled */ }
  }

  function load() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        // Merge with defaults (keep new fields from code updates)
        Object.assign(data, parsed);
      }
    } catch (e) { /* corrupt data, use defaults */ }
  }

  /* ── Init & Session Management ──────────────────────────── */
  function init() {
    load();
    data.sessions++;
    session.startTime = performance.now();

    // Restore difficulty from persistent profile
    difficultyMult = 0.5 + data.difficultyProfile;

    // Auto-save every 30 seconds
    setInterval(save, 30000);

    // Store initial project facts
    if (data.projectMemory.facts.length === 0) {
      storeProjectFact('Game uses IIFE singletons loaded via script tags', 'architecture');
      storeProjectFact('THREE.js r137 for 3D rendering', 'engine');
      storeProjectFact('Voxel world: 16x32x16 chunks, 8x8 grid', 'world');
      storeProjectFact('Enemy hitbox needs transparent:true,opacity:0 for raycasting', 'critical-bug');
      storeProjectFact('Weapons: shovel,pistol,AK74,RPK74,SVD,PKM,NLAW,Stugna,M4A1', 'weapons');
      storeProjectFact('Ukrainian NPCs: MM-14 camo, blue-yellow patches', 'factions');
      storeProjectFact('Russian enemies: EMR Digital Flora, Z/V/O markings', 'factions');
    }
  }

  function endSession() {
    data.totalPlayTime += (performance.now() - session.startTime) / 1000;
    data.avgAccuracy = data.totalHits / Math.max(1, data.totalShots);
    if (session.currentScore > data.bestScore) data.bestScore = session.currentScore;
    save();
  }

  /* ── Public API ─────────────────────────────────────────── */
  return {
    init: init,
    endSession: endSession,
    trackFPS: trackFPS,
    getDifficultyMult: function () { return difficultyMult; },
    getPerformanceProfile: function () { return data.performanceProfile; },
    getSessionStats: function () { var r = {}; for (var k in session) r[k] = session[k]; return r; },
    getPersistentData: function () { var r = {}; for (var k in data) r[k] = data[k]; return r; },
    getPerformanceRecommendations: optimizePerformance,

    // Event tracking
    onShot: onShot,
    onHit: onHit,
    onKill: onKill,
    onDeath: onDeath,
    onWaveComplete: onWaveComplete,
    onPickup: onPickup,
    onReload: onReload,
    onWeaponSwitch: onWeaponSwitch,
    onBlockDestroyed: onBlockDestroyed,
    onDamageTaken: onDamageTaken,
    onDamageDealt: onDamageDealt,

    // Project memory
    storeProjectFact: storeProjectFact,
    getProjectFacts: getProjectFacts,

    // Feature registry
    getFeatureRegistry: getFeatureRegistry,
    getFeatureCount: getFeatureCount,
    getFeaturesByCategory: getFeaturesByCategory,

    save: save,
    load: load,
  };
})();
