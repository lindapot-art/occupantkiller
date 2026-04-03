/* ============================================================
 *  MISSION-TYPES.JS — 6 new mission type features
 *  Features: escort, demolition, capture zone, assassination,
 *  rescue, defuse
 * ============================================================ */
const MissionTypes = (function () {
  'use strict';

  /* ── Mission Type Definitions ──────────────── */
  const TYPES = {
    // Feature 40: Escort Mission
    ESCORT: {
      id: 'ESCORT', name: 'Escort VIP', icon: '🛡️', tier: 2,
      desc: 'Protect the VIP as they move to the extraction point.',
      objectives: [
        { type: 'protect_npc', label: 'Keep VIP alive' },
        { type: 'reach_zone', label: 'Reach extraction zone' }
      ],
      vipHP: 100, vipSpeed: 2.5,
      timeLimit: 180, // 3 minutes
      rewardOKC: 150, rewardXP: 200,
      failOnVIPDeath: true
    },
    // Feature 41: Demolition Mission
    DEMOLITION: {
      id: 'DEMOLITION', name: 'Demolition', icon: '💣', tier: 2,
      desc: 'Plant explosives on the target structure and escape.',
      objectives: [
        { type: 'reach_target', label: 'Reach target building' },
        { type: 'plant_charge', label: 'Plant explosive (5s)' },
        { type: 'escape_radius', label: 'Clear blast radius' }
      ],
      plantTime: 5, blastRadius: 15, blastDamage: 500,
      timeLimit: 120,
      rewardOKC: 200, rewardXP: 250
    },
    // Feature 42: Capture Zone
    CAPTURE_ZONE: {
      id: 'CAPTURE_ZONE', name: 'Capture Zone', icon: '🚩', tier: 1,
      desc: 'Hold the designated area for 60 seconds.',
      objectives: [
        { type: 'enter_zone', label: 'Enter capture zone' },
        { type: 'hold_zone', label: 'Hold zone for 60s' }
      ],
      holdTime: 60, zoneRadius: 8,
      contestPause: true, // timer pauses if enemies in zone
      timeLimit: 180,
      rewardOKC: 120, rewardXP: 150
    },
    // Feature 43: Assassination
    ASSASSINATION: {
      id: 'ASSASSINATION', name: 'Assassination', icon: '🎯', tier: 3,
      desc: 'Eliminate the high-value target before they escape.',
      objectives: [
        { type: 'locate_hvt', label: 'Locate the HVT' },
        { type: 'kill_hvt', label: 'Eliminate the HVT' }
      ],
      hvtHP: 250, hvtSpeed: 4, hvtEscapeTime: 120,
      bodyguardCount: 6,
      timeLimit: 150,
      rewardOKC: 300, rewardXP: 400
    },
    // Feature 44: Rescue
    RESCUE: {
      id: 'RESCUE', name: 'Rescue POWs', icon: '🔓', tier: 2,
      desc: 'Free the prisoners and escort them to safety.',
      objectives: [
        { type: 'reach_prison', label: 'Reach the prison' },
        { type: 'free_pows', label: 'Free prisoners (3s each)' },
        { type: 'escort_out', label: 'Escort to safe zone' }
      ],
      powCount: 3, freeTime: 3, powHP: 50, powSpeed: 2,
      timeLimit: 240,
      rewardOKC: 180, rewardXP: 220
    },
    // Feature 45: Defuse
    DEFUSE: {
      id: 'DEFUSE', name: 'Bomb Defusal', icon: '⏱️', tier: 3,
      desc: 'Find and defuse bombs before they detonate.',
      objectives: [
        { type: 'locate_bombs', label: 'Locate bombs (0/3)' },
        { type: 'defuse_all', label: 'Defuse all bombs' }
      ],
      bombCount: 3, defuseTime: 7,
      detonationTimer: 120, // bombs explode after 2 min
      blastDamage: 300, blastRadius: 10,
      timeLimit: 150,
      rewardOKC: 250, rewardXP: 350
    }
  };

  /* ── Active Mission State ──────────────────── */
  let activeMission = null;
  let missionProgress = {};

  function startMission(typeId, zoneX, zoneZ) {
    const type = TYPES[typeId];
    if (!type) return false;
    activeMission = {
      type: typeId,
      config: type,
      startTime: Date.now(),
      zoneX: zoneX || 0,
      zoneZ: zoneZ || 0,
      state: 'ACTIVE',
      objectiveIndex: 0,
      timers: {},
      data: {}
    };
    // Initialize type-specific data
    switch (typeId) {
      case 'ESCORT':
        missionProgress = { vipHP: type.vipHP, vipReached: false };
        break;
      case 'DEMOLITION':
        missionProgress = { planted: false, plantProgress: 0, escaped: false };
        break;
      case 'CAPTURE_ZONE':
        missionProgress = { holdTimer: 0, inZone: false };
        break;
      case 'ASSASSINATION':
        missionProgress = { hvtLocated: false, hvtDead: false, hvtHP: type.hvtHP };
        break;
      case 'RESCUE':
        missionProgress = { freed: 0, escorted: 0, freeing: false, freeProgress: 0 };
        break;
      case 'DEFUSE':
        missionProgress = { located: 0, defused: 0, defusing: false, defuseProgress: 0, detonationTimer: type.detonationTimer };
        break;
    }
    return true;
  }

  function update(dt, playerPos) {
    if (!activeMission || activeMission.state !== 'ACTIVE') return null;
    const m = activeMission;
    const cfg = m.config;
    const result = { type: m.type, state: 'ACTIVE' };

    // Time limit check
    const elapsed = (Date.now() - m.startTime) / 1000;
    if (elapsed > cfg.timeLimit) {
      m.state = 'FAILED';
      return { type: m.type, state: 'FAILED', reason: 'TIME_UP' };
    }
    result.timeRemaining = cfg.timeLimit - elapsed;

    // Type-specific updates
    switch (m.type) {
      case 'ESCORT':
        if (missionProgress.vipHP <= 0) {
          m.state = 'FAILED';
          return { ...result, state: 'FAILED', reason: 'VIP_DEAD' };
        }
        result.vipHP = missionProgress.vipHP;
        break;

      case 'CAPTURE_ZONE': {
        const dx = playerPos.x - m.zoneX, dz = playerPos.z - m.zoneZ;
        const inZone = dx * dx + dz * dz < cfg.zoneRadius * cfg.zoneRadius;
        missionProgress.inZone = inZone;
        if (inZone) {
          missionProgress.holdTimer += dt;
        }
        result.holdProgress = missionProgress.holdTimer / cfg.holdTime;
        result.inZone = inZone;
        if (missionProgress.holdTimer >= cfg.holdTime) {
          m.state = 'COMPLETE';
          return { ...result, state: 'COMPLETE' };
        }
        break;
      }

      case 'DEMOLITION':
        if (missionProgress.planted && missionProgress.escaped) {
          m.state = 'COMPLETE';
          return { ...result, state: 'COMPLETE' };
        }
        result.planted = missionProgress.planted;
        result.plantProgress = missionProgress.plantProgress;
        break;

      case 'ASSASSINATION':
        if (missionProgress.hvtDead) {
          m.state = 'COMPLETE';
          return { ...result, state: 'COMPLETE' };
        }
        result.hvtHP = missionProgress.hvtHP;
        result.hvtLocated = missionProgress.hvtLocated;
        break;

      case 'RESCUE':
        result.freed = missionProgress.freed;
        result.escorted = missionProgress.escorted;
        if (missionProgress.escorted >= cfg.powCount) {
          m.state = 'COMPLETE';
          return { ...result, state: 'COMPLETE' };
        }
        break;

      case 'DEFUSE':
        missionProgress.detonationTimer -= dt;
        if (missionProgress.detonationTimer <= 0) {
          m.state = 'FAILED';
          return { ...result, state: 'FAILED', reason: 'DETONATION' };
        }
        result.defused = missionProgress.defused;
        result.detonationTimer = missionProgress.detonationTimer;
        if (missionProgress.defused >= cfg.bombCount) {
          m.state = 'COMPLETE';
          return { ...result, state: 'COMPLETE' };
        }
        break;
    }
    return result;
  }

  /* ── Interaction handlers ──────────────────── */
  function interact(action, data) {
    if (!activeMission || activeMission.state !== 'ACTIVE') return null;
    const m = activeMission;

    switch (action) {
      case 'PLANT_CHARGE':
        if (m.type === 'DEMOLITION' && !missionProgress.planted) {
          missionProgress.plantProgress += data.dt / m.config.plantTime;
          if (missionProgress.plantProgress >= 1) { missionProgress.planted = true; }
          return { planting: true, progress: missionProgress.plantProgress };
        }
        break;
      case 'ESCAPE_BLAST':
        if (m.type === 'DEMOLITION' && missionProgress.planted) {
          missionProgress.escaped = true;
          return { escaped: true };
        }
        break;
      case 'DAMAGE_VIP':
        if (m.type === 'ESCORT') {
          missionProgress.vipHP -= data.damage;
          return { vipHP: missionProgress.vipHP };
        }
        break;
      case 'DAMAGE_HVT':
        if (m.type === 'ASSASSINATION') {
          missionProgress.hvtHP -= data.damage;
          missionProgress.hvtLocated = true;
          if (missionProgress.hvtHP <= 0) missionProgress.hvtDead = true;
          return { hvtHP: missionProgress.hvtHP, dead: missionProgress.hvtDead };
        }
        break;
      case 'FREE_POW':
        if (m.type === 'RESCUE') {
          missionProgress.freeProgress += data.dt / m.config.freeTime;
          if (missionProgress.freeProgress >= 1) {
            missionProgress.freed++;
            missionProgress.freeProgress = 0;
            return { freed: missionProgress.freed };
          }
          return { freeing: true, progress: missionProgress.freeProgress };
        }
        break;
      case 'ESCORT_POW':
        if (m.type === 'RESCUE') {
          missionProgress.escorted++;
          return { escorted: missionProgress.escorted };
        }
        break;
      case 'DEFUSE_BOMB':
        if (m.type === 'DEFUSE') {
          missionProgress.defuseProgress += data.dt / m.config.defuseTime;
          if (missionProgress.defuseProgress >= 1) {
            missionProgress.defused++;
            missionProgress.defuseProgress = 0;
            return { defused: missionProgress.defused };
          }
          return { defusing: true, progress: missionProgress.defuseProgress };
        }
        break;
    }
    return null;
  }

  function getActive() { return activeMission; }
  function getProgress() { return missionProgress; }

  function cancelMission() {
    if (activeMission) activeMission.state = 'CANCELLED';
    activeMission = null;
    missionProgress = {};
  }

  function completeMission() {
    if (!activeMission) return null;
    activeMission.state = 'COMPLETE';
    const reward = { okc: activeMission.config.rewardOKC, xp: activeMission.config.rewardXP };
    const type = activeMission.type;
    activeMission = null;
    missionProgress = {};
    return { type, ...reward };
  }

  function clear() {
    activeMission = null;
    missionProgress = {};
  }

  return {
    TYPES, startMission, update, interact,
    getActive, getProgress, cancelMission, completeMission, clear
  };
})();
