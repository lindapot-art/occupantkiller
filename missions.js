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
          startCount: Building.getStructures().length,
        };
      },
      check(mission) {
        return Building.getStructures().length >= mission.startCount + mission.targetCount;
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
        const reward = Economy.missionReward(m.tier);
        RankSystem.onMissionComplete(m.tier);

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
  };
})();
