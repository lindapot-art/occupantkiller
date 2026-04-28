/* ───────────────────────────────────────────────────────────────────────
   MISSION SYSTEM — procedural missions with objectives
   ─────────────────────────────────────────────────────────────────────── */
const MissionSystem = (function () {
  'use strict';

  /* ── Mission Types ───────────────────────────────────────────────── */
  const MISSION_TYPE = Object.freeze({
    GATHER:         'gather',
    EXPAND:         'expand',
    RECON:          'recon',
    DEFENSE:        'defense',
    ESCORT:         'escort',
    INFILTRATE:     'infiltrate',
    CLEAR_BUILDING: 'clear_building',
  });

  /* ── Templates ───────────────────────────────────────────────────── */
  const TEMPLATES = {
            // NEW: Bradley IFV Mission
            bradley_mission: {
              name: 'Bradley IFV Assault',
              description: 'Ride the Bradley IFV, use Bushmaster Gatling and 25mm cannon. Enter/exit vehicle. Defend convoy on forest road.',
              tier: 5,
              generate() {
                return {
                  type: 'bradley_mission',
                  inVehicle: true,
                  convoyHealth: 200,
                  roadSegments: 5,
                  completedSegments: 0,
                  canExit: true,
                  forestAmbush: true
                };
              },
              check(mission) { return mission.completedSegments >= mission.roadSegments && mission.convoyHealth > 0; },
            },
        // NEW: Airborne Assault (Hostomel)
        airborne_assault: {
          name: 'Airborne Assault',
          description: 'Repel Russian airborne troops and secure the landing zone.',
          tier: 4,
          generate() {
            return {
              type: 'airborne_assault',
              waves: 3 + Math.floor(Math.random() * 2),
              completedWaves: 0,
              landingZones: [
                { x: -20, z: 30 },
                { x: 15, z: -25 }
              ],
              reinforcements: true
            };
          },
          check(mission) { return mission.completedWaves >= mission.waves; },
        },
        // NEW: Urban Breakout (Kyiv)
        urban_breakout: {
          name: 'Urban Breakout',
          description: 'Break out of encirclement and reach friendly lines.',
          tier: 5,
          generate() {
            return {
              type: 'urban_breakout',
              breakoutPoints: [
                { x: 40, z: -10 },
                { x: -35, z: 25 }
              ],
              reached: false,
              timeLimit: 180
            };
          },
          check(mission) { return mission.reached; },
        },
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
          scoutedPoints: points.map(function () { return false; }),
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

    // ── INFILTRATE: Player starts disguised as a Russian occupant.
    //    Walk among them undetected; when ready, ambush and kill the
    //    designated number of high-value targets. Disguise is blown the
    //    instant the player damages anyone — survive the resulting alarm.
    infiltrate: {
      name: 'Infiltrate the Occupants',
      description: 'You are inserted in a Russian uniform. Walk among them, then eliminate {kills} occupants. Disguise breaks when you attack — survive the response.',
      tier: 4,
      generate() {
        const kills = 8 + Math.floor(Math.random() * 5); // 8–12
        return {
          type: MISSION_TYPE.INFILTRATE,
          targetKills: kills,
          kills: 0,
          disguiseBlown: false,
          completed: false,
          // Bonus objective: stealth-kill at least 3 before disguise is blown
          stealthKills: 0,
          stealthBonus: 3,
        };
      },
      check(mission) { return mission.kills >= mission.targetKills; },
    },

    // ── CLEAR_BUILDING: Player enters a marked apartment block and
    //    eliminates every Russian occupant inside.  Enemies are spawned
    //    on each floor's hallway when the mission starts.  Mission
    //    completes when no enemies remain inside the building bbox.
    clear_building: {
      name: 'Clear the Building',
      description: 'Russian occupants have holed up inside an apartment block. Enter and eliminate every hostile on every floor.',
      tier: 3,
      generate() {
        var building = null;
        try {
          if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getBuildings) {
            var list = VoxelWorld.getBuildings();
            if (list && list.length) building = list[Math.floor(Math.random() * list.length)];
          }
        } catch (e) {}
        // Fallback: synthesize a small bbox at world origin if no apartments
        if (!building) {
          building = { kind: 'apartment', x: -9, z: -5, w: 18, d: 10, baseY: 0, floorH: 3, floors: 4, cx: 0, cz: 0 };
        }
        // Spawn 2 enemies per floor in the hallway center.
        var spawned = 0;
        try {
          if (typeof Enemies !== 'undefined' && Enemies.spawnSingle) {
            var types = ['CONSCRIPT', 'RIFLEMAN', 'GRENADIER'];
            for (var f = 0; f < building.floors; f++) {
              for (var n = 0; n < 2; n++) {
                var tp = types[Math.floor(Math.random() * types.length)];
                var px = building.x + 4 + Math.floor(Math.random() * (building.w - 8));
                var pz = building.cz + (n === 0 ? -1 : 1);
                var py = building.baseY + f * building.floorH + 1; // stand on slab
                Enemies.spawnSingle(tp, { x: px + 0.5, z: pz + 0.5, y: py });
                spawned++;
              }
            }
          }
        } catch (e2) {}
        return {
          type: MISSION_TYPE.CLEAR_BUILDING,
          building: building,
          spawned: spawned,
          remaining: spawned,
          completed: false,
        };
      },
      check(mission) {
        // Count enemies whose mesh.position lies inside the building bbox.
        if (typeof Enemies === 'undefined' || !Enemies.getAll) return mission.spawned === 0;
        var b = mission.building;
        var minX = b.x, maxX = b.x + b.w;
        var minZ = b.z, maxZ = b.z + b.d;
        var minY = b.baseY - 1;
        var maxY = b.baseY + b.floors * b.floorH + 1;
        var alive = 0;
        var all = Enemies.getAll();
        for (var i = 0; i < all.length; i++) {
          var e = all[i];
          if (!e || e.dead || !e.mesh) continue;
          var p = e.mesh.position;
          if (p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ &&
              p.y >= minY && p.y <= maxY) alive++;
        }
        mission.remaining = alive;
        // Completion requires the player to have actually entered (i.e. at
        // least one enemy was spawned) and the building is now empty.
        return mission.spawned > 0 && alive === 0;
      },
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
    // INFILTRATE: activate Russian-uniform disguise on the player.
    try {
      if (type === MISSION_TYPE.INFILTRATE && typeof Enemies !== 'undefined' && Enemies.setPlayerDisguised) {
        Enemies.setPlayerDisguised(true);
        if (typeof HUD !== 'undefined' && HUD.showToast) {
          HUD.showToast('🕵 DISGUISE ACTIVE — Russian uniform on. Walk among them.', 4500, '#88ff88');
        }
      }
    } catch (e) {}
    // CLEAR_BUILDING: show building coords + floor count so the player
    // knows where to push.
    try {
      if (type === MISSION_TYPE.CLEAR_BUILDING && typeof HUD !== 'undefined' && HUD.showToast) {
        var b = mission.data.building;
        var msg = '🏚 CLEAR BUILDING — ' + mission.data.spawned + ' hostiles across ' +
                  b.floors + ' floors @ (' + Math.round(b.x + b.w/2) + ', ' + Math.round(b.z + b.d/2) + ')';
        HUD.showToast(msg, 5000, '#ffaa44');
      }
    } catch (eCB) {}
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

        // INFILTRATE: turn off disguise on completion.
        try {
          if (m.type === MISSION_TYPE.INFILTRATE && typeof Enemies !== 'undefined' && Enemies.setPlayerDisguised) {
            Enemies.setPlayerDisguised(false);
            if (typeof HUD !== 'undefined' && HUD.showToast) {
              const stealth = m.data.stealthKills || 0;
              const bonus = stealth >= (m.data.stealthBonus || 0) ? ' +STEALTH BONUS' : '';
              HUD.showToast(`✓ INFILTRATION COMPLETE (${stealth} stealth kills)${bonus}`, 4000, '#88ff88');
            }
          }
        } catch (eIC) {}

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

  // INFILTRATE: called every time the player kills a Russian occupant.
  function onEnemyKilled() {
    for (const m of activeMissions) {
      if (m.data.type === MISSION_TYPE.INFILTRATE) {
        m.data.kills++;
        // Stealth bonus: kills before disguise was blown
        const blown = (typeof Enemies !== 'undefined' && Enemies.isDisguiseBlown) ? Enemies.isDisguiseBlown() : true;
        if (!blown) m.data.stealthKills++;
        else m.data.disguiseBlown = true;
      }
    }
  }

  function onDroneScout(position) {
    for (const m of activeMissions) {
      if (m.data.type === MISSION_TYPE.RECON) {
        for (let i = 0; i < m.data.targetPoints.length; i++) {
          const pt = m.data.targetPoints[i];
          if (!m.data.scoutedPoints[i] && position.distanceTo(pt) < 10) {
            m.data.scoutedPoints[i] = true;
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
    if (!passed) return false;
    return {
      completed: true,
      id: activeSideObj.id,
      name: activeSideObj.name,
      reward: activeSideObj.reward,
    };
  }

  function getSideObjective() {
    return activeSideObj;
  }

  /* ── 2. Mission Chains ───────────────────────────────────────────── */
  const MISSION_CHAINS = [
            // Bradley IFV Forest Road Mission
            {
              id: 'bradley_forest',
              name: 'Bradley Forest Road',
              stages: [
                { name: 'Convoy Start', type: 'bradley_mission', desc: 'Defend the convoy while riding the Bradley IFV through a Ukrainian forest road.' },
                { name: 'Ambush Defense', type: MISSION_TYPE.DEFENSE, desc: 'Repel ambushes and protect the convoy.' },
                { name: 'Breakout', type: MISSION_TYPE.ESCORT, desc: 'Escort survivors to safety after exiting the vehicle.' }
              ]
            },
        // Hostomel Airport Assault (campaign & skirmish)
        {
          id: 'hostomel_airport',
          name: 'Hostomel Airport Assault',
          stages: [
            { name: 'Repel Airborne', type: 'airborne_assault', desc: 'Defend against Russian VDV landings' },
            { name: 'Secure Runway', type: MISSION_TYPE.DEFENSE, desc: 'Hold the runway for reinforcements' },
            { name: 'Counterattack', type: MISSION_TYPE.ESCORT, desc: 'Lead a counterattack to clear the airport' }
          ]
        },
        // Kyiv Siege: First Day (campaign)
        {
          id: 'kyiv_siege_day1',
          name: 'Kyiv Siege: First Day',
          stages: [
            { name: 'Urban Defense', type: MISSION_TYPE.DEFENSE, desc: 'Hold defensive lines in Kyiv suburbs' },
            { name: 'Breakout', type: 'urban_breakout', desc: 'Break out of partial encirclement' },
            { name: 'Rescue Civilians', type: MISSION_TYPE.ESCORT, desc: 'Escort civilians to safety' }
          ]
        },
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
    if (typeof MissionTypes !== 'undefined' && MissionTypes.getActive && MissionTypes.getActive()) {
      return;
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
    // Expose new mission types for IIFE compliance
    TEMPLATES,
    init,
    generateMission,
    generateRandom,
    update,
    onResourceGathered,
    onWaveCompleted,
    onDroneScout,
    onEnemyKilled,
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
