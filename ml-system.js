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

  /* ═══════════════════════════════════════════════════════════════
     AI SMART LEARNING — Behavioral Profiling & Counter-Strategy
     Learns player patterns across sessions, enemies adapt in real-time
     ═══════════════════════════════════════════════════════════════ */

  /* ── Behavior Profile (persisted across sessions) ──────────── */
  var behavior = {
    // Position heatmap: grid cells tracking where player spends time
    // 20x20 grid covering the arena (-50..50 mapped to 0..19)
    positionHeatmap: new Array(400).fill(0),
    heatmapSamples: 0,

    // Movement style classification
    movementStyle: {
      campingScore: 0,        // 0=never camps, 1=always camps
      aggressionScore: 0.5,   // 0=very defensive, 1=very aggressive
      mobilityScore: 0.5,     // 0=stationary, 1=always moving
      flankingScore: 0,       // 0=frontal, 1=loves flanking
      samples: 0,
    },

    // Weapon preference tracking
    weaponPrefs: {
      favoriteWeapon: -1,     // most used weapon index
      avgEngageRange: 12,     // average range at which player engages
      prefersScope: false,    // true if player frequently uses scoped weapons
      prefersAuto: false,     // true if player uses full-auto weapons
      prefersExplosive: false, // true if player uses explosive weapons
      weaponUseCounts: {},    // { weaponId: fireCount }
      rangeHistogram: new Array(10).fill(0), // 0-5, 5-10, 10-15, ..., 45-50
    },

    // Directional vulnerability (which angles player gets hit from most)
    // 8 compass sectors: N, NE, E, SE, S, SW, W, NW
    vulnerableDirections: new Array(8).fill(0),
    totalHitsReceived: 0,

    // Timing patterns
    timingPatterns: {
      avgTimeBetweenReloads: 5.0,
      avgTimeBetweenKills: 3.0,
      avgExposureTime: 2.0,    // how long player stays exposed
      peekDuration: 1.5,       // average peek-and-shoot duration
      lastReloadTime: 0,
      lastKillTime: 0,
      lastMoveTime: 0,
      stationaryTime: 0,       // current stationary duration
      reloadIntervals: [],
      killIntervals: [],
    },

    // Combat style classification (updated every wave)
    combatStyle: 'balanced',   // 'aggressive', 'defensive', 'sniper', 'rusher', 'balanced', 'camper'
    styleConfidence: 0,        // 0-1 how confident the classification is

    // Counter-strategy memory (what worked against the player)
    counterMemory: {
      flankKills: 0,           // times flanking killed the player
      rushKills: 0,            // times rushing killed the player
      sniperKills: 0,          // times sniping killed the player
      ambushKills: 0,          // times ambush killed the player
      totalPlayerDeaths: 0,
      effectiveStrategies: [], // recent strategies that worked
    },

    // Prediction state
    predictedPosition: null,   // where we think player will be
    predictedWeapon: -1,       // weapon we think player will use
    lastPositions: [],         // ring buffer of recent positions for trajectory
  };

  /* ── Position Tracking ─────────────────────────────────────── */
  var _lastTrackPos = null;
  var _posTrackTimer = 0;
  var _lastPlayerPos = { x: 0, z: 0 };
  var _movementSamples = [];

  function trackPlayerPosition(px, pz, delta) {
    _posTrackTimer += delta;
    if (_posTrackTimer < 0.5) return; // Sample every 0.5s
    _posTrackTimer = 0;

    // Update heatmap (20x20 grid, arena -50..50)
    var gx = Math.floor(Math.max(0, Math.min(19, (px + 50) / 5)));
    var gz = Math.floor(Math.max(0, Math.min(19, (pz + 50) / 5)));
    var cellIdx = gz * 20 + gx;
    if (cellIdx >= 0 && cellIdx < 400) {
      behavior.positionHeatmap[cellIdx]++;
      behavior.heatmapSamples++;
    }

    // Track movement for mobility/camping detection
    var dx = px - _lastPlayerPos.x;
    var dz = pz - _lastPlayerPos.z;
    var moveDist = Math.sqrt(dx * dx + dz * dz);
    _lastPlayerPos = { x: px, z: pz };

    _movementSamples.push(moveDist);
    if (_movementSamples.length > 60) _movementSamples.shift(); // 30 seconds of data

    // Stationary detection
    if (moveDist < 0.3) {
      behavior.timingPatterns.stationaryTime += 0.5;
    } else {
      // Player started moving again — record exposure/peek duration
      if (behavior.timingPatterns.stationaryTime > 0.5) {
        behavior.timingPatterns.peekDuration =
          behavior.timingPatterns.peekDuration * 0.9 +
          behavior.timingPatterns.stationaryTime * 0.1;
      }
      behavior.timingPatterns.stationaryTime = 0;
      behavior.timingPatterns.lastMoveTime = performance.now();
    }

    // Store recent positions for trajectory prediction (last 20 positions)
    behavior.lastPositions.push({ x: px, z: pz, t: performance.now() });
    if (behavior.lastPositions.length > 20) behavior.lastPositions.shift();

    // Update movement style scores
    updateMovementStyle();
  }

  function updateMovementStyle() {
    if (_movementSamples.length < 10) return;

    var ms = behavior.movementStyle;
    ms.samples++;

    // Mobility: average movement per sample
    var totalMove = 0;
    for (var i = 0; i < _movementSamples.length; i++) totalMove += _movementSamples[i];
    var avgMove = totalMove / _movementSamples.length;

    // Camping: consecutive low-movement samples
    var campFrames = 0;
    for (var j = 0; j < _movementSamples.length; j++) {
      if (_movementSamples[j] < 0.3) campFrames++;
    }
    var campRatio = campFrames / _movementSamples.length;

    // Smooth updates (exponential moving average)
    ms.mobilityScore = ms.mobilityScore * 0.95 + Math.min(1, avgMove / 3) * 0.05;
    ms.campingScore = ms.campingScore * 0.95 + campRatio * 0.05;
  }

  /* ── Weapon Preference Tracking ────────────────────────────── */
  function trackWeaponUse(weaponId, engagementRange) {
    var wp = behavior.weaponPrefs;
    if (!wp.weaponUseCounts[weaponId]) wp.weaponUseCounts[weaponId] = 0;
    wp.weaponUseCounts[weaponId]++;

    // Update engagement range histogram
    if (engagementRange >= 0) {
      var bucket = Math.floor(Math.min(9, engagementRange / 5));
      wp.rangeHistogram[bucket]++;
      wp.avgEngageRange = wp.avgEngageRange * 0.95 + engagementRange * 0.05;
    }

    // Find favorite weapon
    var maxUse = 0;
    for (var wid in wp.weaponUseCounts) {
      if (wp.weaponUseCounts[wid] > maxUse) {
        maxUse = wp.weaponUseCounts[wid];
        wp.favoriteWeapon = parseInt(wid);
      }
    }
  }

  function trackWeaponType(weaponType) {
    var wp = behavior.weaponPrefs;
    if (weaponType === 'SNIPER' || weaponType === 'AMR') wp.prefersScope = true;
    if (weaponType === 'ASSAULT' || weaponType === 'LMG' || weaponType === 'HMG' ||
        weaponType === 'MACHINEGUN' || weaponType === 'MINIGUN' || weaponType === 'SMG') {
      wp.prefersAuto = true;
    }
    if (weaponType === 'AT' || weaponType === 'ATGM' || weaponType === 'AT_HEAVY' ||
        weaponType === 'AT_LIGHT' || weaponType === 'GRENADE' || weaponType === 'INCENDIARY' ||
        weaponType === 'THERMOBARIC') {
      wp.prefersExplosive = true;
    }
  }

  /* ── Directional Vulnerability Tracking ────────────────────── */
  function trackHitDirection(attackerX, attackerZ, playerX, playerZ, playerYaw) {
    var dx = attackerX - playerX;
    var dz = attackerZ - playerZ;
    var worldAngle = Math.atan2(dx, dz);
    var relAngle = playerYaw - worldAngle;

    // Normalize to 0..2PI
    while (relAngle < 0) relAngle += Math.PI * 2;
    while (relAngle >= Math.PI * 2) relAngle -= Math.PI * 2;

    // Map to 8 sectors (0=N/front, 1=NE, 2=E/right, etc.)
    var sector = Math.floor(relAngle / (Math.PI * 0.25)) % 8;
    behavior.vulnerableDirections[sector]++;
    behavior.totalHitsReceived++;
  }

  function getMostVulnerableDirection() {
    if (behavior.totalHitsReceived < 5) return -1;
    var maxHits = 0;
    var maxSector = 0;
    for (var i = 0; i < 8; i++) {
      if (behavior.vulnerableDirections[i] > maxHits) {
        maxHits = behavior.vulnerableDirections[i];
        maxSector = i;
      }
    }
    return maxSector; // 0=front, 2=right, 4=behind, 6=left
  }

  /* ── Timing Pattern Tracking ───────────────────────────────── */
  function trackReload() {
    var now = performance.now();
    if (behavior.timingPatterns.lastReloadTime > 0) {
      var interval = (now - behavior.timingPatterns.lastReloadTime) / 1000;
      behavior.timingPatterns.reloadIntervals.push(interval);
      if (behavior.timingPatterns.reloadIntervals.length > 20) {
        behavior.timingPatterns.reloadIntervals.shift();
      }
      // Average reload interval
      var sum = 0;
      for (var i = 0; i < behavior.timingPatterns.reloadIntervals.length; i++) {
        sum += behavior.timingPatterns.reloadIntervals[i];
      }
      behavior.timingPatterns.avgTimeBetweenReloads =
        sum / behavior.timingPatterns.reloadIntervals.length;
    }
    behavior.timingPatterns.lastReloadTime = now;
  }

  function trackKillTiming() {
    var now = performance.now();
    if (behavior.timingPatterns.lastKillTime > 0) {
      var interval = (now - behavior.timingPatterns.lastKillTime) / 1000;
      behavior.timingPatterns.killIntervals.push(interval);
      if (behavior.timingPatterns.killIntervals.length > 30) {
        behavior.timingPatterns.killIntervals.shift();
      }
      var sum = 0;
      for (var i = 0; i < behavior.timingPatterns.killIntervals.length; i++) {
        sum += behavior.timingPatterns.killIntervals[i];
      }
      behavior.timingPatterns.avgTimeBetweenKills =
        sum / behavior.timingPatterns.killIntervals.length;
    }
    behavior.timingPatterns.lastKillTime = now;
  }

  /* ── Combat Style Classification ───────────────────────────── */
  function classifyCombatStyle() {
    var ms = behavior.movementStyle;
    var wp = behavior.weaponPrefs;
    var tp = behavior.timingPatterns;

    var scores = {
      aggressive: 0,
      defensive: 0,
      sniper: 0,
      rusher: 0,
      camper: 0,
      balanced: 0,
    };

    // Aggression indicators
    if (ms.aggressionScore > 0.6) scores.aggressive += 2;
    if (ms.mobilityScore > 0.6) scores.aggressive += 1;
    if (tp.avgTimeBetweenKills < 2) scores.aggressive += 2;

    // Defensive indicators
    if (ms.campingScore > 0.4) scores.defensive += 2;
    if (ms.mobilityScore < 0.3) scores.defensive += 1;
    if (tp.stationaryTime > 5) scores.defensive += 1;

    // Sniper indicators
    if (wp.prefersScope) scores.sniper += 3;
    if (wp.avgEngageRange > 25) scores.sniper += 2;
    if (ms.campingScore > 0.3) scores.sniper += 1;

    // Rusher indicators
    if (wp.avgEngageRange < 8) scores.rusher += 2;
    if (ms.mobilityScore > 0.7) scores.rusher += 2;
    if (wp.prefersAuto) scores.rusher += 1;
    if (ms.aggressionScore > 0.7) scores.rusher += 1;

    // Camper indicators
    if (ms.campingScore > 0.6) scores.camper += 3;
    if (tp.stationaryTime > 10) scores.camper += 2;
    if (ms.mobilityScore < 0.2) scores.camper += 1;

    // Balanced
    if (ms.aggressionScore > 0.3 && ms.aggressionScore < 0.7) scores.balanced += 1;
    if (ms.mobilityScore > 0.3 && ms.mobilityScore < 0.7) scores.balanced += 1;
    if (wp.avgEngageRange > 8 && wp.avgEngageRange < 25) scores.balanced += 1;

    // Find highest scoring style
    var bestStyle = 'balanced';
    var bestScore = 0;
    for (var style in scores) {
      if (scores[style] > bestScore) {
        bestScore = scores[style];
        bestStyle = style;
      }
    }

    behavior.combatStyle = bestStyle;
    behavior.styleConfidence = Math.min(1, bestScore / 8);
    return bestStyle;
  }

  /* ── Position Prediction ───────────────────────────────────── */
  function predictPlayerPosition(secondsAhead) {
    var positions = behavior.lastPositions;
    if (positions.length < 3) return null;

    // Linear extrapolation from recent movement
    var p1 = positions[positions.length - 2];
    var p2 = positions[positions.length - 1];
    var dt = (p2.t - p1.t) / 1000;
    if (dt < 0.01) return { x: p2.x, z: p2.z };

    var vx = (p2.x - p1.x) / dt;
    var vz = (p2.z - p1.z) / dt;

    // Weighted prediction: recent velocity + heatmap attraction
    var predX = p2.x + vx * secondsAhead;
    var predZ = p2.z + vz * secondsAhead;

    // Bias toward frequently visited areas (heatmap pull)
    if (behavior.heatmapSamples > 50) {
      var hotX = 0, hotZ = 0, hotWeight = 0;
      for (var gz = 0; gz < 20; gz++) {
        for (var gx = 0; gx < 20; gx++) {
          var heat = behavior.positionHeatmap[gz * 20 + gx];
          if (heat > 0) {
            var wx = (gx * 5 - 50) + 2.5;
            var wz = (gz * 5 - 50) + 2.5;
            hotX += wx * heat;
            hotZ += wz * heat;
            hotWeight += heat;
          }
        }
      }
      if (hotWeight > 0) {
        hotX /= hotWeight;
        hotZ /= hotWeight;
        // Gentle pull toward hot zones (10% weight)
        predX = predX * 0.9 + hotX * 0.1;
        predZ = predZ * 0.9 + hotZ * 0.1;
      }
    }

    behavior.predictedPosition = { x: predX, z: predZ };
    return behavior.predictedPosition;
  }

  /* ── Counter-Strategy Generator ────────────────────────────── */
  function generateCounterStrategy() {
    var style = behavior.combatStyle;
    var vulnDir = getMostVulnerableDirection();
    var wp = behavior.weaponPrefs;
    var tp = behavior.timingPatterns;

    var strategy = {
      // Spawn positioning
      preferredSpawnAngle: 0,       // angle offset from default spawn (radians)
      spawnDistanceMult: 1.0,       // multiply normal spawn distance

      // Movement behavior modifiers for enemies
      flankIntensity: 0.3,          // 0-1 how aggressively enemies flank
      rushProbability: 0.2,         // 0-1 chance of rush attack
      retreatThreshold: 0.3,        // HP% at which enemies retreat
      groupSpreadFactor: 1.0,       // how spread out assault groups are

      // Timing exploitation
      attackDuringReload: false,     // coordinate attacks during predicted reload
      predictedReloadWindow: 0,     // seconds until next predicted reload
      syncedAttack: false,          // multiple enemies attack simultaneously

      // Composition recommendations
      preferredTypes: [],            // enemy types that counter player's style
      avoidTypes: [],                // types the player handles easily

      // Attack direction
      attackFromVulnerable: false,   // attack from player's weak direction
      vulnerableSector: vulnDir,     // 0-7 compass sector

      // Aggression level
      overallAggression: 0.5,       // 0=passive, 1=hyper-aggressive

      // Adaptation notifications
      adaptationLevel: 0,           // 0=learning, 1=adapting, 2=countering
      adaptationMessage: '',        // message for HUD

      // Anti-camping measures
      antiCampFlush: false,         // send stormers to flush campers
      antiCampMortar: false,        // drop mortar on camping position
    };

    // ── Style-specific counters ──────────────────────────────
    if (style === 'sniper') {
      // Counter snipers: rush with stormers, use smoke, close range
      strategy.rushProbability = 0.6;
      strategy.flankIntensity = 0.8;
      strategy.preferredTypes = ['STORMER', 'SABOTEUR', 'FLAMETHROWER'];
      strategy.avoidTypes = ['CONSCRIPT']; // easy sniper targets
      strategy.groupSpreadFactor = 1.5; // spread to avoid multi-kills
      strategy.overallAggression = 0.8;
      strategy.adaptationMessage = '🧠 AI: Countering sniper tactics...';
    } else if (style === 'rusher') {
      // Counter rushers: defensive setup, snipers, armored units
      strategy.rushProbability = 0.1;
      strategy.retreatThreshold = 0.5; // enemies hold ground longer
      strategy.preferredTypes = ['ARMORED', 'SNIPER', 'OFFICER'];
      strategy.avoidTypes = ['STORMER']; // player kills rushers easily
      strategy.groupSpreadFactor = 0.6; // tight groups resist rushes
      strategy.overallAggression = 0.3;
      strategy.adaptationMessage = '🧠 AI: Setting defensive positions...';
    } else if (style === 'camper') {
      // Counter campers: flush them out!
      strategy.antiCampFlush = true;
      strategy.antiCampMortar = behavior.timingPatterns.stationaryTime > 15;
      strategy.flankIntensity = 0.9;
      strategy.rushProbability = 0.7;
      strategy.preferredTypes = ['STORMER', 'FLAMETHROWER', 'SABOTEUR'];
      strategy.overallAggression = 0.9;
      strategy.adaptationMessage = '🧠 AI: Flushing out camper position!';
    } else if (style === 'aggressive') {
      // Counter aggression: traps, defensive lines, counter-flanks
      strategy.retreatThreshold = 0.15;
      strategy.flankIntensity = 0.5;
      strategy.preferredTypes = ['ARMORED', 'ENGINEER', 'OFFICER'];
      strategy.groupSpreadFactor = 0.8;
      strategy.overallAggression = 0.6;
      strategy.adaptationMessage = '🧠 AI: Reinforcing defensive line...';
    } else if (style === 'defensive') {
      // Counter defensive play: pincer movements, indirect fire
      strategy.flankIntensity = 0.7;
      strategy.syncedAttack = true;
      strategy.preferredTypes = ['STORMER', 'OFFICER', 'DRONE_OP'];
      strategy.overallAggression = 0.7;
      strategy.adaptationMessage = '🧠 AI: Coordinating pincer attack...';
    } else {
      // Balanced: mixed response
      strategy.flankIntensity = 0.4;
      strategy.rushProbability = 0.3;
      strategy.overallAggression = 0.5;
      strategy.adaptationMessage = '🧠 AI: Analyzing patterns...';
    }

    // ── Exploit weapon preferences ──────────────────────────
    if (wp.prefersExplosive) {
      // Spread out more to avoid splash damage
      strategy.groupSpreadFactor = Math.max(strategy.groupSpreadFactor, 1.8);
    }
    if (wp.prefersScope) {
      // Close the distance aggressively
      strategy.spawnDistanceMult = 0.7;
    }
    if (wp.prefersAuto) {
      // Use cover and burst from multiple angles
      strategy.flankIntensity = Math.max(strategy.flankIntensity, 0.6);
    }

    // ── Exploit vulnerable direction ────────────────────────
    if (vulnDir >= 0) {
      strategy.attackFromVulnerable = true;
      // Convert sector to angle (0=front, 2=right, 4=back, 6=left)
      strategy.preferredSpawnAngle = vulnDir * (Math.PI * 0.25);
    }

    // ── Exploit timing patterns ─────────────────────────────
    if (tp.avgTimeBetweenReloads < 8 && tp.reloadIntervals.length >= 5) {
      strategy.attackDuringReload = true;
      // Predict next reload window
      var timeSinceReload = (performance.now() - tp.lastReloadTime) / 1000;
      strategy.predictedReloadWindow = Math.max(0, tp.avgTimeBetweenReloads - timeSinceReload);
    }

    // ── Adaptation level based on data quality ──────────────
    var dataPoints = behavior.heatmapSamples + behavior.totalHitsReceived +
      tp.reloadIntervals.length + tp.killIntervals.length;
    if (dataPoints > 200) {
      strategy.adaptationLevel = 2; // Countering
    } else if (dataPoints > 50) {
      strategy.adaptationLevel = 1; // Adapting
    } else {
      strategy.adaptationLevel = 0; // Learning
    }

    return strategy;
  }

  /* ── NPC Assistance Recommendations ────────────────────────── */
  function getNPCAssistStrategy() {
    var vulnDir = getMostVulnerableDirection();
    var style = behavior.combatStyle;

    var assist = {
      // Cover player's weak side
      coverDirection: -1,       // angle in radians to position NPCs
      formationType: 'spread',  // 'spread', 'line', 'wedge', 'diamond'
      healPriority: 0.5,        // 0-1 how much to prioritize healing
      aggressionMod: 0,         // modifier to NPC aggression (-1 to +1)
      followDistance: 8,        // how close NPCs stay to player
    };

    // Cover player's vulnerable side
    if (vulnDir >= 0) {
      assist.coverDirection = vulnDir * (Math.PI * 0.25);
    }

    // Adapt to player style
    if (style === 'sniper') {
      assist.formationType = 'line';
      assist.followDistance = 12; // give sniper space
      assist.aggressionMod = 0.3; // NPCs more aggressive to push
    } else if (style === 'rusher') {
      assist.formationType = 'wedge';
      assist.followDistance = 4; // stay close
      assist.aggressionMod = 0.5;
      assist.healPriority = 0.8; // rushers take more damage
    } else if (style === 'camper') {
      assist.formationType = 'diamond';
      assist.followDistance = 6;
      assist.aggressionMod = 0.2;
    } else if (style === 'aggressive') {
      assist.formationType = 'wedge';
      assist.followDistance = 5;
      assist.aggressionMod = 0.4;
      assist.healPriority = 0.7;
    } else {
      assist.formationType = 'spread';
      assist.followDistance = 8;
    }

    return assist;
  }

  /* ── Smart Wave Composition ────────────────────────────────── */
  function getSmartWaveComposition(baseTypes, waveNum) {
    var strategy = generateCounterStrategy();
    var result = [];

    for (var i = 0; i < baseTypes.length; i++) {
      var baseType = baseTypes[i];

      // Chance to swap in counter-types based on AI learning
      if (strategy.preferredTypes.length > 0 && Math.random() < 0.35 * strategy.adaptationLevel) {
        var counterType = strategy.preferredTypes[Math.floor(Math.random() * strategy.preferredTypes.length)];
        result.push(counterType);
      } else if (strategy.avoidTypes.indexOf(baseType) >= 0 && Math.random() < 0.25 * strategy.adaptationLevel) {
        // Replace types player handles easily
        var replacement = strategy.preferredTypes.length > 0
          ? strategy.preferredTypes[Math.floor(Math.random() * strategy.preferredTypes.length)]
          : baseType;
        result.push(replacement);
      } else {
        result.push(baseType);
      }
    }

    return result;
  }

  /* ── Track Kill to Update Aggression Score ─────────────────── */
  function trackCombatEngagement(wasAggressive) {
    var ms = behavior.movementStyle;
    ms.aggressionScore = ms.aggressionScore * 0.95 + (wasAggressive ? 1 : 0) * 0.05;
  }

  /* ── Track Player Death Context ────────────────────────────── */
  function trackDeathContext(killerType, killerAngle) {
    var cm = behavior.counterMemory;
    cm.totalPlayerDeaths++;

    if (killerType === 'flank') cm.flankKills++;
    else if (killerType === 'rush') cm.rushKills++;
    else if (killerType === 'sniper') cm.sniperKills++;
    else if (killerType === 'ambush') cm.ambushKills++;

    // Store effective strategy
    cm.effectiveStrategies.push({
      type: killerType,
      angle: killerAngle,
      timestamp: Date.now(),
    });
    if (cm.effectiveStrategies.length > 20) {
      cm.effectiveStrategies.shift();
    }
  }

  /* ── Get Camping Position (for anti-camp flush) ────────────── */
  function getCampingPosition() {
    if (behavior.timingPatterns.stationaryTime < 8) return null;
    var pos = behavior.lastPositions;
    if (pos.length === 0) return null;
    var last = pos[pos.length - 1];
    return { x: last.x, z: last.z };
  }

  /* ── Get Behavior Summary (for debug/HUD) ──────────────────── */
  function getBehaviorSummary() {
    return {
      style: behavior.combatStyle,
      confidence: behavior.styleConfidence,
      mobility: behavior.movementStyle.mobilityScore,
      camping: behavior.movementStyle.campingScore,
      aggression: behavior.movementStyle.aggressionScore,
      avgRange: behavior.weaponPrefs.avgEngageRange,
      favoriteWeapon: behavior.weaponPrefs.favoriteWeapon,
      vulnerableSector: getMostVulnerableDirection(),
      dataPoints: behavior.heatmapSamples + behavior.totalHitsReceived,
    };
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
    // ── Round 3: AI Smart Learning ──────────────────────────
    { id: 'ML_BEHAVIOR_PROFILER', cat: 'ml',      desc: 'AI tracks player position heatmap, movement style, weapon prefs, timing patterns' },
    { id: 'ML_COMBAT_STYLE',     cat: 'ml',       desc: 'AI classifies player as aggressive/defensive/sniper/rusher/camper/balanced' },
    { id: 'ML_COUNTER_STRATEGY', cat: 'ml',       desc: 'AI generates enemy counter-strategies: flank angles, rush timing, type composition' },
    { id: 'ML_POSITION_PREDICT', cat: 'ml',       desc: 'AI predicts player position using trajectory + heatmap attraction' },
    { id: 'ML_VULN_TRACKING',    cat: 'ml',       desc: 'AI tracks directional vulnerability (8 compass sectors of incoming damage)' },
    { id: 'ML_TIMING_EXPLOIT',   cat: 'ml',       desc: 'AI learns reload intervals and coordinates attacks during reload windows' },
    { id: 'ML_NPC_ASSIST',       cat: 'ml',       desc: 'AI recommends NPC formations and cover positions based on player style' },
    { id: 'ML_SMART_WAVES',      cat: 'ml',       desc: 'AI adapts wave composition to counter player weapon preferences' },
    { id: 'ML_ANTI_CAMP',        cat: 'ml',       desc: 'AI detects camping and sends flush squads from multiple angles' },
    { id: 'ML_DEATH_CONTEXT',    cat: 'ml',       desc: 'AI remembers what strategies killed the player and reuses effective ones' },
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

    // AI Smart Learning — Behavior Profiling
    trackPlayerPosition: trackPlayerPosition,
    trackWeaponUse: trackWeaponUse,
    trackWeaponType: trackWeaponType,
    trackHitDirection: trackHitDirection,
    trackReload: trackReload,
    trackKillTiming: trackKillTiming,
    trackCombatEngagement: trackCombatEngagement,
    trackDeathContext: trackDeathContext,
    classifyCombatStyle: classifyCombatStyle,

    // AI Smart Learning — Counter Strategy
    generateCounterStrategy: generateCounterStrategy,
    getNPCAssistStrategy: getNPCAssistStrategy,
    getSmartWaveComposition: getSmartWaveComposition,
    predictPlayerPosition: predictPlayerPosition,
    getCampingPosition: getCampingPosition,
    getBehaviorSummary: getBehaviorSummary,
    getMostVulnerableDirection: getMostVulnerableDirection,
    getBehavior: function () { return behavior; },

    // B25: Adaptive difficulty rating based on recent performance
    getPerformanceRating: function () {
      // Combine accuracy, K/D, and kill timing into a 0-1 rating
      var acc = session.hits / Math.max(1, session.shots);
      var kd = session.kills / Math.max(1, session.deaths + 1);
      var rating = (acc * 0.4) + (Math.min(kd / 5, 1) * 0.4) + (Math.min(session.kills / 50, 1) * 0.2);
      return Math.min(1, Math.max(0, rating));
    },

    save: save,
    load: load,
  };
})();
