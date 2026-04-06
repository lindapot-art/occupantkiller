/* ───────────────────────────────────────────────────────────────────────
   MISSION SYSTEM — procedural missions with objectives
   ─────────────────────────────────────────────────────────────────────── */
const MissionSystem = (function () {
  'use strict';

  /* ── Mission Types ───────────────────────────────────────────────── */
  const MISSION_TYPE = Object.freeze({
    GATHER:     'gather',
    EXPAND:     'expand',
    RECON:      'recon',
    DEFENSE:    'defense',
    ESCORT:     'escort',
  });

  /* ── Templates ───────────────────────────────────────────────────── */
  const TEMPLATES = {
    gather: {
      name: 'Resource Gathering',
      description: 'Collect {amount} {resource} from the world.',
      tier: 1,
      generate() {
        const resources = ['wood', 'metal', 'stone'];
        const res = resources[Math.floor(Math.random() * resources.length)];
        const amount = 20 + Math.floor(Math.random() * 40);
        return {
          type: MISSION_TYPE.GATHER,
          resource: res,
          targetAmount: amount,
          currentAmount: 0,
        };
      },
      check(mission) { return mission.currentAmount >= mission.targetAmount; },
    },

    expand: {
      name: 'Base Expansion',
      description: 'Build {count} new structure(s).',
      tier: 2,
      generate() {
        return {
          type: MISSION_TYPE.EXPAND,
          targetCount: 1 + Math.floor(Math.random() * 2),
          startCount: (typeof Building !== 'undefined' && Building.getStructures) ? Building.getStructures().length : 0,
        };
      },
      check(mission) {
        var cur = (typeof Building !== 'undefined' && Building.getStructures) ? Building.getStructures().length : 0;
        return cur >= mission.startCount + mission.targetCount;
      },
    },

    recon: {
      name: 'Drone Reconnaissance',
      description: 'Scout {count} locations with a recon drone.',
      tier: 2,
      generate() {
        const points = [];
        for (let i = 0; i < 3; i++) {
          points.push(new THREE.Vector3(
            -40 + Math.random() * 80,
            10 + Math.random() * 10,
            -40 + Math.random() * 80
          ));
        }
        return {
          type: MISSION_TYPE.RECON,
          targetPoints: points,
          scoutedCount: 0,
          targetCount: 3,
        };
      },
      check(mission) { return mission.scoutedCount >= mission.targetCount; },
    },

    defense: {
      name: 'Defensive Survival',
      description: 'Survive {waves} enemy waves without losing your base.',
      tier: 3,
      generate() {
        return {
          type: MISSION_TYPE.DEFENSE,
          targetWaves: 3 + Math.floor(Math.random() * 3),
          completedWaves: 0,
          baseHealthStart: 100,
        };
      },
      check(mission) { return mission.completedWaves >= mission.targetWaves; },
    },

    escort: {
      name: 'Logistics Escort',
      description: 'Escort supply convoy to destination safely.',
      tier: 3,
      generate() {
        return {
          type: MISSION_TYPE.ESCORT,
          destination: new THREE.Vector3(
            -30 + Math.random() * 60,
            0,
            -30 + Math.random() * 60
          ),
          convoyHealth: 100,
          arrived: false,
        };
      },
      check(mission) { return mission.arrived && mission.convoyHealth > 0; },
    },
  };

  /* ── State ───────────────────────────────────────────────────────── */
  const activeMissions  = [];
  const completedMissions = [];
  let missionCount = 0;
  let _onComplete = null;

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    activeMissions.length = 0;
    completedMissions.length = 0;
    missionCount = 0;
  }

  /* ── Generate Mission ────────────────────────────────────────────── */
  function generateMission(type) {
    const template = TEMPLATES[type];
    if (!template) return null;

    const data = template.generate();
    const mission = {
      id: ++missionCount,
      name: template.name,
      description: template.description,
      tier: template.tier,
      type: type,
      data,
      status: 'active',
      startTime: Date.now(),
    };

    activeMissions.push(mission);
    return mission;
  }

  function generateRandom() {
    const types = Object.keys(TEMPLATES);
    return generateMission(types[Math.floor(Math.random() * types.length)]);
  }

  /* ── Update / Check ──────────────────────────────────────────────── */
  function update(delta) {
    for (let i = activeMissions.length - 1; i >= 0; i--) {
      const m = activeMissions[i];
      const template = TEMPLATES[m.type];
      if (template && template.check(m.data)) {
        m.status = 'completed';
        completedMissions.push(m);
        activeMissions.splice(i, 1);

        // Reward
        var reward = (typeof Economy !== 'undefined' && Economy.missionReward) ? Economy.missionReward(m.tier) : 0;
        if (typeof RankSystem !== 'undefined' && RankSystem.onMissionComplete) RankSystem.onMissionComplete(m.tier);

        if (_onComplete) _onComplete(m, reward);
      }
    }
  }

  /* ── Mission Progress Updates ────────────────────────────────────── */
  function onResourceGathered(type, amount) {
    for (const m of activeMissions) {
      if (m.data.type === MISSION_TYPE.GATHER && m.data.resource === type) {
        m.data.currentAmount += amount;
      }
    }
  }

  function onWaveCompleted() {
    for (const m of activeMissions) {
      if (m.data.type === MISSION_TYPE.DEFENSE) {
        m.data.completedWaves++;
      }
    }
  }

  function onDroneScout(position) {
    for (const m of activeMissions) {
      if (m.data.type === MISSION_TYPE.RECON) {
        for (const pt of m.data.targetPoints) {
          if (position.distanceTo(pt) < 10) {
            m.data.scoutedCount++;
          }
        }
      }
    }
  }

  /* ── Queries ─────────────────────────────────────────────────────── */
  function getActive()    { return activeMissions; }
  function getCompleted() { return completedMissions; }
  function getById(id)    { return activeMissions.find(m => m.id === id); }

  function onMissionComplete(cb) { _onComplete = cb; }

  /* ── 1. Side Objectives ──────────────────────────────────────────── */
  const SIDE_OBJECTIVES = [
    { id: 'no_damage',      name: 'No Damage Taken',  desc: 'Survive wave without taking damage',         reward: 200, check: function (s) { return s.damageTaken === 0; } },
    { id: 'headshots_only', name: 'Headshots Only',    desc: 'All kills must be headshots',                reward: 300, check: function (s) { return s.kills > 0 && s.headshots === s.kills; } },
    { id: 'speed_run',      name: 'Speed Run',         desc: 'Complete wave under 60 seconds',             reward: 250, check: function (s) { return s.waveTime < 60; } },
    { id: 'knife_only',     name: 'Knife Only',        desc: 'Use only melee weapons',                     reward: 400, check: function (s) { return s.kills > 0 && s.meleeKills === s.kills; } },
    { id: 'pacifist_start', name: 'Pacifist Start',    desc: 'Don\'t kill for the first 15 seconds',       reward: 150, check: function (s) { return s.firstKillTime >= 15; } },
    { id: 'conserve_ammo',  name: 'Conserve Ammo',     desc: 'Finish wave with >50% ammo remaining',       reward: 200, check: function (s) { return s.ammoPercent > 50; } },
    { id: 'ghost',          name: 'Ghost',             desc: 'Don\'t get spotted for 30 seconds',          reward: 300, check: function (s) { return s.undetectedTime >= 30; } },
    { id: 'collateral',     name: 'Collateral',        desc: 'Kill 3+ enemies with one explosive',         reward: 350, check: function (s) { return s.maxExplosiveKill >= 3; } },
    { id: 'marksman',       name: 'Marksman',          desc: '>80% accuracy this wave',                    reward: 250, check: function (s) { return s.shotsFired > 0 && (s.shotsHit / s.shotsFired) > 0.8; } },
    { id: 'survivor',       name: 'Survivor',          desc: 'Finish wave with less than 20 HP',           reward: 200, check: function (s) { return s.hpAtEnd < 20 && s.hpAtEnd > 0; } },
  ];

  let activeSideObj = null;

  function generateSideObjective() {
    activeSideObj = SIDE_OBJECTIVES[Math.floor(Math.random() * SIDE_OBJECTIVES.length)];
    return activeSideObj;
  }

  function checkSideObjective(stats) {
    if (!activeSideObj) return false;
    var passed = activeSideObj.check(stats);
    if (passed && typeof Economy !== 'undefined' && Economy.addOKC) {
      Economy.addOKC(activeSideObj.reward);
    }
    return passed;
  }

  function getSideObjective() {
    return activeSideObj;
  }

  /* ── 2. Mission Chains ───────────────────────────────────────────── */
  const MISSION_CHAINS = [
    {
      id: 'operation_viper',
      name: 'Operation Viper',
      stages: [
        { name: 'Recon',        type: MISSION_TYPE.RECON,    desc: 'Scout enemy stronghold locations' },
        { name: 'Assassinate',  type: MISSION_TYPE.DEFENSE,  desc: 'Eliminate the garrison commander' },
        { name: 'Extract',      type: MISSION_TYPE.ESCORT,   desc: 'Extract intel to base safely' },
      ],
    },
    {
      id: 'supply_line',
      name: 'Supply Line',
      stages: [
        { name: 'Gather Resources', type: MISSION_TYPE.GATHER,  desc: 'Collect supplies for the convoy' },
        { name: 'Defend Convoy',     type: MISSION_TYPE.DEFENSE, desc: 'Protect the supply convoy from ambush' },
        { name: 'Deliver Supplies',  type: MISSION_TYPE.ESCORT,  desc: 'Deliver supplies to the forward base' },
      ],
    },
    {
      id: 'liberation',
      name: 'Liberation',
      stages: [
        { name: 'Capture Zone',       type: MISSION_TYPE.EXPAND,   desc: 'Seize the occupied territory' },
        { name: 'Eliminate Garrison',  type: MISSION_TYPE.DEFENSE,  desc: 'Wipe out remaining enemy forces' },
        { name: 'Rebuild',            type: MISSION_TYPE.EXPAND,   desc: 'Reconstruct the liberated zone' },
      ],
    },
    {
      id: 'deep_strike',
      name: 'Deep Strike',
      stages: [
        { name: 'Scout',          type: MISSION_TYPE.RECON,    desc: 'Locate the target bridge' },
        { name: 'Demolish Bridge', type: MISSION_TYPE.DEFENSE, desc: 'Plant charges and defend the site' },
        { name: 'Escape',         type: MISSION_TYPE.ESCORT,   desc: 'Escape the blast zone before reinforcements arrive' },
      ],
    },
  ];

  let activeChain = null;
  let chainProgress = 0;

  function startChain(chainId) {
    var chain = MISSION_CHAINS.find(function (c) { return c.id === chainId; });
    if (!chain) return null;
    activeChain = chain;
    chainProgress = 0;
    var stage = chain.stages[0];
    return generateMission(stage.type);
  }

  function advanceChain() {
    if (!activeChain) return null;
    chainProgress++;
    if (chainProgress >= activeChain.stages.length) {
      var finished = { chain: activeChain.name, completed: true };
      activeChain = null;
      chainProgress = 0;
      return finished;
    }
    var stage = activeChain.stages[chainProgress];
    return generateMission(stage.type);
  }

  function getChainProgress() {
    if (!activeChain) return null;
    return {
      chain: activeChain,
      current: chainProgress,
      total: activeChain.stages.length,
      stage: activeChain.stages[chainProgress] || null,
    };
  }

  /* ── 3. Dynamic Mission Difficulty ───────────────────────────────── */
  function scaleMission(mission, playerLevel) {
    var factor = 1 + (playerLevel - 1) * 0.15;
    var d = mission.data;
    if (d.targetAmount)  d.targetAmount  = Math.ceil(d.targetAmount * factor);
    if (d.targetWaves)   d.targetWaves   = Math.ceil(d.targetWaves * factor);
    if (d.targetCount)   d.targetCount   = Math.ceil(d.targetCount * factor);
    if (d.convoyHealth)  d.convoyHealth  = Math.round(d.convoyHealth * factor);
    mission.tier = Math.min(5, Math.ceil(mission.tier * factor));
    return mission;
  }

  /* ── 4. Mission Timer ────────────────────────────────────────────── */
  var missionTimerLeft = 0;
  var missionTimerActive = false;

  function startMissionTimer(seconds) {
    missionTimerLeft = seconds;
    missionTimerActive = true;
  }

  function updateMissionTimer(delta) {
    if (!missionTimerActive) return;
    missionTimerLeft -= delta;
    if (missionTimerLeft <= 0) {
      missionTimerLeft = 0;
      missionTimerActive = false;
    }
    if (typeof HUD !== 'undefined' && HUD.showTimer) {
      HUD.showTimer(missionTimerLeft);
    }
  }

  function getMissionTimeLeft() {
    return missionTimerLeft;
  }

  return {
    MISSION_TYPE,
    init,
    generateMission,
    generateRandom,
    update,
    onResourceGathered,
    onWaveCompleted,
    onDroneScout,
    getActive,
    getCompleted,
    getById,
    onMissionComplete,
    /* Side Objectives */
    SIDE_OBJECTIVES,
    generateSideObjective,
    checkSideObjective,
    getSideObjective,
    /* Mission Chains */
    MISSION_CHAINS,
    startChain,
    advanceChain,
    getChainProgress,
    /* Dynamic Difficulty */
    scaleMission,
    /* Mission Timer */
    startMissionTimer,
    updateMissionTimer,
    getMissionTimeLeft,
  };
})();
