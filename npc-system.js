/* ───────────────────────────────────────────────────────────────────────
   NPC SIMULATION SYSTEM — Sims-like agents with needs, jobs, AI
   ─────────────────────────────────────────────────────────────────────── */
const NPCSystem = (function () {
  'use strict';

  /* ── NPC Ranks ───────────────────────────────────────────────────── */
  const NPC_RANK = Object.freeze({
    CIVILIAN:   'civilian',
    TRAINEE:    'trainee',
    INFANTRY:   'infantry',
    SPECIALIST: 'specialist',
    VETERAN:    'veteran',
    ELITE:      'elite',
  });

  const RANK_ORDER = [
    NPC_RANK.CIVILIAN, NPC_RANK.TRAINEE, NPC_RANK.INFANTRY,
    NPC_RANK.SPECIALIST, NPC_RANK.VETERAN, NPC_RANK.ELITE
  ];

  /* ── Job Types ───────────────────────────────────────────────────── */
  const JOB = Object.freeze({
    IDLE:       'idle',
    GATHER:     'gather',
    BUILD:      'build',
    GUARD:      'guard',
    PATROL:     'patrol',
    CRAFT:      'craft',
    TRAIN:      'train',
    REPAIR:     'repair',
    DRONE_OP:   'drone_op',
    SCOUT:      'scout',
    REST:       'rest',
  });

  /* ── State ───────────────────────────────────────────────────────── */
  const npcs = [];
  let _scene = null;
  let nextId = 1;

  /* ── NPC Template ────────────────────────────────────────────────── */
  function createNPC(x, y, z, rank) {
    const npc = {
      id: nextId++,
      rank: rank || NPC_RANK.CIVILIAN,
      job: JOB.IDLE,

      // Needs (0-100)
      health:   100,
      hunger:   80,   // starts fed
      fatigue:  0,    // starts rested
      morale:   70,
      loyalty:  60,
      stress:   10,

      // Skills (0-100)
      skills: {
        combat:     rank === NPC_RANK.INFANTRY ? 30 : 5,
        building:   10,
        crafting:   5,
        droneOps:   0,
        leadership: 0,
      },

      // Position & movement
      position: new THREE.Vector3(x, y, z),
      target:   null,
      speed:    2.5,
      mesh:     null,

      // Job state
      jobTimer: 0,
      jobTarget: null,
      assigned: false,

      // State
      alive:  true,
      asleep: false,
    };

    npc.mesh = buildNPCMesh(npc);
    npc.mesh.position.copy(npc.position);
    return npc;
  }

  /* ── NPC Visual Mesh (simple humanoid) ───────────────────────────── */
  function buildNPCMesh(npc) {
    const group = new THREE.Group();
    const rankColors = {
      civilian:   0x88AA66,
      trainee:    0x6688AA,
      infantry:   0x446633,
      specialist: 0x336688,
      veteran:    0x554422,
      elite:      0x882222,
    };
    const col = rankColors[npc.rank] || 0x888888;

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.7, 0.3),
      new THREE.MeshLambertMaterial({ color: col })
    );
    body.position.y = 0.75;
    group.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xDDAA88 })
    );
    head.position.y = 1.28;
    group.add(head);

    // Legs
    for (let side = -1; side <= 1; side += 2) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.5, 0.14),
        new THREE.MeshLambertMaterial({ color: 0x333333 })
      );
      leg.position.set(side * 0.12, 0.25, 0);
      leg.userData.isLeg = true;
      group.add(leg);
    }

    // Arms
    for (let side = -1; side <= 1; side += 2) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.5, 0.12),
        new THREE.MeshLambertMaterial({ color: col })
      );
      arm.position.set(side * 0.32, 0.8, 0);
      arm.userData.isArm = true;
      group.add(arm);
    }

    group.userData.npcId = npc.id;
    group.castShadow = true;
    return group;
  }

  /* ── Init ────────────────────────────────────────────────────────── */
  function init(scene) {
    _scene = scene;
    npcs.length = 0;
    nextId = 1;
  }

  /* ── Spawn NPC ───────────────────────────────────────────────────── */
  function spawn(x, y, z, rank) {
    const npc = createNPC(x, y, z, rank);
    npcs.push(npc);
    if (_scene) _scene.add(npc.mesh);
    return npc;
  }

  /* ── Update All NPCs ─────────────────────────────────────────────── */
  function update(delta, timeInfo) {
    for (const npc of npcs) {
      if (!npc.alive) continue;
      updateNeeds(npc, delta, timeInfo);
      updateBehavior(npc, delta, timeInfo);
      updateMovement(npc, delta);
      updateAnimation(npc, delta);
    }
  }

  /* ── Needs Simulation ────────────────────────────────────────────── */
  function updateNeeds(npc, delta, timeInfo) {
    // Hunger decreases over time
    npc.hunger = Math.max(0, npc.hunger - delta * 0.15);

    // Fatigue increases when working, decreases when sleeping
    if (npc.asleep) {
      npc.fatigue = Math.max(0, npc.fatigue - delta * 3);
      if (npc.fatigue <= 5) npc.asleep = false;
    } else {
      const workRate = npc.job === JOB.IDLE || npc.job === JOB.REST ? 0.05 : 0.3;
      npc.fatigue = Math.min(100, npc.fatigue + delta * workRate);
    }

    // Morale affected by hunger, fatigue, stress
    const idealMorale = 100 - (100 - npc.hunger) * 0.3 - npc.fatigue * 0.2 - npc.stress * 0.3;
    npc.morale += (idealMorale - npc.morale) * delta * 0.1;
    npc.morale = Math.max(0, Math.min(100, npc.morale));

    // Stress reduces slowly when resting
    if (npc.job === JOB.REST || npc.asleep) {
      npc.stress = Math.max(0, npc.stress - delta * 0.5);
    }

    // Health regeneration when fed and rested
    if (npc.hunger > 50 && npc.fatigue < 30) {
      npc.health = Math.min(100, npc.health + delta * 0.2);
    }

    // Death check
    if (npc.health <= 0) {
      killNPC(npc);
    }
  }

  /* ── AI Behavior ─────────────────────────────────────────────────── */
  function updateBehavior(npc, delta, timeInfo) {
    // Critical needs override job
    if (npc.fatigue > 85 && npc.job !== JOB.REST) {
      npc.asleep = true;
      npc.job = JOB.REST;
      npc.target = null;
      return;
    }

    if (npc.hunger < 15 && npc.job !== JOB.REST) {
      // Should find food (go to nearest supply)
      npc.stress = Math.min(100, npc.stress + delta * 0.5);
    }

    // Night behavior: non-guards go to rest
    if (timeInfo && timeInfo.phase === 'night') {
      if (npc.job !== JOB.GUARD && npc.job !== JOB.PATROL && npc.job !== JOB.REST) {
        if (npc.fatigue > 40) {
          npc.job = JOB.REST;
          npc.asleep = true;
          return;
        }
      }
    }

    // Job timer
    npc.jobTimer += delta;

    // Skill improvement through work
    if (npc.jobTimer > 10) {
      npc.jobTimer = 0;
      improveSkill(npc);
    }

    // Wander if idle
    if (npc.job === JOB.IDLE && !npc.target) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * 8;
      npc.target = npc.position.clone().add(
        new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
      );
    }
  }

  /* ── Skill Improvement ───────────────────────────────────────────── */
  function improveSkill(npc) {
    const gain = 0.1 + Math.random() * 0.2;
    switch (npc.job) {
      case JOB.GUARD:
      case JOB.PATROL:
        npc.skills.combat = Math.min(100, npc.skills.combat + gain);
        break;
      case JOB.BUILD:
      case JOB.REPAIR:
        npc.skills.building = Math.min(100, npc.skills.building + gain);
        break;
      case JOB.CRAFT:
        npc.skills.crafting = Math.min(100, npc.skills.crafting + gain);
        break;
      case JOB.DRONE_OP:
        npc.skills.droneOps = Math.min(100, npc.skills.droneOps + gain);
        break;
      case JOB.TRAIN:
        npc.skills.combat = Math.min(100, npc.skills.combat + gain * 1.5);
        break;
    }

    // Check for rank promotion
    checkPromotion(npc);
  }

  function checkPromotion(npc) {
    const totalSkill = Object.values(npc.skills).reduce((s, v) => s + v, 0);
    const rankIdx = RANK_ORDER.indexOf(npc.rank);
    const thresholds = [0, 30, 80, 150, 250, 400];
    if (rankIdx < RANK_ORDER.length - 1 && totalSkill >= thresholds[rankIdx + 1]) {
      npc.rank = RANK_ORDER[rankIdx + 1];
    }
  }

  /* ── Movement ────────────────────────────────────────────────────── */
  function updateMovement(npc, delta) {
    if (!npc.target || npc.asleep) return;

    const dir = npc.target.clone().sub(npc.position);
    dir.y = 0;
    const dist = dir.length();

    if (dist < 0.5) {
      npc.target = null;
      return;
    }

    dir.normalize();
    const move = dir.multiplyScalar(npc.speed * delta);
    npc.position.add(move);

    // Terrain follow
    const terrainY = VoxelWorld.getTerrainHeight(npc.position.x, npc.position.z);
    npc.position.y = terrainY;

    npc.mesh.position.copy(npc.position);

    // Face movement direction
    npc.mesh.rotation.y = Math.atan2(dir.x, dir.z);
  }

  /* ── Animation ───────────────────────────────────────────────────── */
  let _animTime = 0;
  function updateAnimation(npc, delta) {
    _animTime += delta;
    if (npc.target && !npc.asleep) {
      npc.mesh.children.forEach(child => {
        if (child.userData.isLeg) {
          child.rotation.x = Math.sin(_animTime * 6 + (child.position.x > 0 ? Math.PI : 0)) * 0.4;
        }
        if (child.userData.isArm) {
          child.rotation.x = Math.sin(_animTime * 6 + (child.position.x > 0 ? 0 : Math.PI)) * 0.3;
        }
      });
    }
  }

  /* ── NPC Death ───────────────────────────────────────────────────── */
  function killNPC(npc) {
    npc.alive = false;
    if (npc.mesh && _scene) {
      _scene.remove(npc.mesh);
    }
  }

  /* ── Job Assignment ──────────────────────────────────────────────── */
  function assignJob(npcId, job, target) {
    const npc = npcs.find(n => n.id === npcId);
    if (!npc || !npc.alive) return false;
    npc.job = job;
    npc.jobTarget = target || null;
    npc.jobTimer = 0;
    npc.assigned = true;
    return true;
  }

  /* ── Damage NPC ──────────────────────────────────────────────────── */
  function damage(npcId, amount) {
    const npc = npcs.find(n => n.id === npcId);
    if (!npc || !npc.alive) return;
    npc.health -= amount;
    npc.stress = Math.min(100, npc.stress + 15);
    if (npc.health <= 0) killNPC(npc);
  }

  /* ── Feed NPC ────────────────────────────────────────────────────── */
  function feedNPC(npcId, amount) {
    const npc = npcs.find(n => n.id === npcId);
    if (!npc || !npc.alive) return;
    npc.hunger = Math.min(100, npc.hunger + amount);
  }

  /* ── Queries ─────────────────────────────────────────────────────── */
  function getAll()      { return npcs.filter(n => n.alive); }
  function getCount()    { return npcs.filter(n => n.alive).length; }
  function getById(id)   { return npcs.find(n => n.id === id && n.alive); }
  function getByJob(job) { return npcs.filter(n => n.alive && n.job === job); }
  function getByRank(r)  { return npcs.filter(n => n.alive && n.rank === r); }

  function getAverageMorale() {
    const alive = getAll();
    if (alive.length === 0) return 0;
    return alive.reduce((s, n) => s + n.morale, 0) / alive.length;
  }

  /* ── Cleanup ─────────────────────────────────────────────────────── */
  function clear() {
    for (const npc of npcs) {
      if (npc.mesh && _scene) _scene.remove(npc.mesh);
    }
    npcs.length = 0;
  }

  return {
    NPC_RANK,
    JOB,
    init,
    spawn,
    update,
    assignJob,
    damage,
    feedNPC,
    killNPC,
    getAll,
    getCount,
    getById,
    getByJob,
    getByRank,
    getAverageMorale,
    clear,
  };
})();
