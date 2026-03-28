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

    save: save,
    load: load,
  };
})();
