/* ============================================================
 * NPC-ML — Per-NPC machine-learning brain (session-scoped)
 * ------------------------------------------------------------
 * Core unique feature: every NPC (friendly + enemy) gets a
 * lightweight in-memory brain that learns during the session.
 * Tracks: combat experience, damage sectors, weapon threats,
 * preferred engagement range, aggression/caution drift.
 * Cleared on world clear() — never persisted to disk.
 * ============================================================ */
const NPCML = (function () {
  'use strict';

  // Per-session live counter (just for IDs/diagnostics; brains owned by entities)
  let _nextId = 0;
  let _liveCount = 0;
  // Aggregate session totals (lifetime of session, even after entities die)
  const _agg = { shotsFired: 0, shotsHit: 0, kills: 0, dmgTaken: 0, brainsCreated: 0 };

  function createBrain(owner) {
    _liveCount++;
    _agg.brainsCreated++;
    return {
      id: _nextId++,
      ownerType: (owner && owner.typeName) || (owner && owner.rank) || 'unit',
      // Drift in 0..1
      aggression: 0.5,
      caution:    0.5,
      // Counters
      shotsFired:   0,
      shotsHit:     0,
      damageTaken:  0,
      damageDealt:  0,
      kills:        0,
      alliesLost:   0,
      // 8-sector damage memory (decays)
      sectorDmg: new Float32Array(8),
      // Preferred engagement range (EMA, in meters)
      pRange: 12,
      // Weapon threat memory
      wepEff: Object.create(null),
      // Cover-seek pressure
      preferCover: 0,
    };
  }

  function _ema(prev, val, alpha) { return prev * (1 - alpha) + val * alpha; }

  function onFired(b) {
    if (!b) return;
    b.shotsFired++;
    _agg.shotsFired++;
  }

  function onHit(b, dmg) {
    if (!b) return;
    b.shotsHit++;
    b.damageDealt += dmg;
    b.aggression = Math.min(1, b.aggression + 0.008);
    _agg.shotsHit++;
  }

  function onDamaged(b, dmg, srcDir, srcWeapon) {
    if (!b) return;
    b.damageTaken += dmg;
    b.caution = Math.min(1, b.caution + 0.015);
    _agg.dmgTaken += dmg;
    if (srcDir && typeof srcDir.x === 'number') {
      var ang = Math.atan2(srcDir.x, srcDir.z) + Math.PI;
      var sec = Math.floor((ang / (Math.PI * 2)) * 8) % 8;
      if (sec < 0) sec += 8;
      b.sectorDmg[sec] += dmg;
    }
    if (srcWeapon) b.wepEff[srcWeapon] = (b.wepEff[srcWeapon] || 0) + dmg;
    if (dmg > 25) b.preferCover += 1;
  }

  function onKill(b) {
    if (!b) return;
    b.kills++;
    _agg.kills++;
    b.aggression = Math.min(1, b.aggression + 0.04);
    b.caution    = Math.max(0, b.caution    - 0.02);
  }

  function onAllyLost(b) {
    if (!b) return;
    b.alliesLost++;
    b.caution    = Math.min(1, b.caution    + 0.05);
    b.aggression = Math.max(0, b.aggression - 0.015);
  }

  function onEngagementSurvived(b, range) {
    if (!b) return;
    if (typeof range === 'number' && range > 0) {
      b.pRange = _ema(b.pRange, range, 0.18);
    }
  }

  // Decision query: returns adaptive parameters for AI logic
  function getDecision(b) {
    if (!b) return _defaultDecision;
    var hitRate = b.shotsHit / Math.max(1, b.shotsFired);
    var accBonus = Math.min(0.25, b.shotsFired * 0.0002 + hitRate * 0.10);
    var retreatHp = 0.15 + b.caution * 0.30 - b.aggression * 0.12;
    // Find safest sector (least cumulative damage)
    var safest = 0, minDmg = Infinity;
    for (var i = 0; i < 8; i++) {
      if (b.sectorDmg[i] < minDmg) { minDmg = b.sectorDmg[i]; safest = i; }
    }
    var safeAngle = (safest / 8) * Math.PI * 2 - Math.PI;
    return {
      accuracyBonus:   accBonus,
      retreatHpFrac:   Math.max(0.05, Math.min(0.6, retreatHp)),
      preferredRange:  b.pRange,
      safestAngle:     safeAngle,
      shouldSeekCover: b.preferCover > 2 || b.caution > 0.7,
      aggression:      b.aggression,
      caution:         b.caution,
    };
  }
  var _defaultDecision = {
    accuracyBonus: 0, retreatHpFrac: 0.2, preferredRange: 12,
    safestAngle: 0, shouldSeekCover: false, aggression: 0.5, caution: 0.5
  };

  // Per-frame decay applied to a single brain (caller iterates its own entities)
  function decayBrain(b, delta) {
    if (!b || !delta || delta <= 0) return;
    var decay = Math.exp(-delta * 0.05);
    var coverDecay = Math.exp(-delta * 0.08);
    for (var s = 0; s < 8; s++) b.sectorDmg[s] *= decay;
    b.preferCover *= coverDecay;
  }

  // Notify ML when an entity dies (for stats only — brain is GC'd with owner)
  function releaseBrain(_b) {
    if (_liveCount > 0) _liveCount--;
  }

  function clear() {
    // Reset session aggregates and counter; entity-owned brains are GC'd by callers
    _liveCount = 0;
    _nextId = 0;
    _agg.shotsFired = 0; _agg.shotsHit = 0;
    _agg.kills = 0; _agg.dmgTaken = 0; _agg.brainsCreated = 0;
  }

  function getStats() {
    return {
      liveBrains: _liveCount,
      brainsCreated: _agg.brainsCreated,
      totalShots: _agg.shotsFired,
      totalHits: _agg.shotsHit,
      hitRate: _agg.shotsHit / Math.max(1, _agg.shotsFired),
      totalKills: _agg.kills,
      totalDmgTaken: _agg.dmgTaken,
    };
  }

  function getBrain(idOrOwner) {
    if (idOrOwner && idOrOwner._ml) return idOrOwner._ml;
    return null;
  }

  return {
    createBrain: createBrain,
    onFired: onFired, onHit: onHit, onDamaged: onDamaged,
    onKill: onKill, onAllyLost: onAllyLost,
    onEngagementSurvived: onEngagementSurvived,
    getDecision: getDecision,
    decayBrain: decayBrain,
    releaseBrain: releaseBrain,
    clear: clear,
    getStats: getStats, getBrain: getBrain,
  };
})();
if (typeof window !== 'undefined') window.NPCML = NPCML;
