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

      // Combat
      combatTarget: null,
      combatCooldown: 0,
      fireFlash: 0,
    };

    npc.mesh = buildNPCMesh(npc);
    npc.mesh.position.copy(npc.position);
    return npc;
  }

  /* ── Ukrainian MM-14 Digital Camo Palette ──────────────────────────── */
  const MM14_CAMO = {
    light:  0x6b9050,  // sage green
    medium: 0x5a7a3f,  // olive green
    dark:   0x3a4a1f,  // dark olive
    tan:    0x8a6a4a,  // khaki accent
  };

  /* ── Ukrainian flag / insignia colors ────────────────────────────── */
  const UA_BLUE   = 0x0057B8;
  const UA_YELLOW = 0xFFD700;

  /* ── Canvas-based MM-14 digital pixel camo texture ───────────────── */
  function makeMM14CamoTexture(variant) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const palette = variant === 'dark'
      ? ['#3a4a1f', '#4a5a2f', '#5a6a3f', '#2a3a0f']
      : ['#6b9050', '#5a7a3f', '#3a4a1f', '#8a6a4a'];

    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, size, size);

    const block = 4;
    for (let y = 0; y < size; y += block) {
      for (let x = 0; x < size; x += block) {
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
        ctx.fillRect(x, y, block, block);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  /* ── Blue-yellow flag sleeve patch texture ───────────────────────── */
  function makeUkrainianPatchTexture(baseColorHex) {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base arm color
    const r = (baseColorHex >> 16) & 0xff;
    const g = (baseColorHex >> 8)  & 0xff;
    const b =  baseColorHex        & 0xff;
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(0, 0, size, size);

    // Flag patch (8×10 rectangle near top)
    const px = 4, py = 3, pw = 24, ph = 12;
    // Blue upper half
    ctx.fillStyle = '#0057B8';
    ctx.fillRect(px, py, pw, ph / 2);
    // Yellow lower half
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(px, py + ph / 2, pw, ph / 2);

    // Thin dark border
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    // Small trident (tryzub) in center of patch — simplified pixel art
    ctx.fillStyle = '#FFD700';
    // Center prong
    ctx.fillRect(15, py + 1, 2, 5);
    // Left prong
    ctx.fillRect(11, py + 2, 2, 4);
    // Right prong
    ctx.fillRect(19, py + 2, 2, 4);
    // Base bar
    ctx.fillRect(11, py + 6, 10, 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  /* ── Ukrainian helmet texture: blue-yellow cross tape ────────────── */
  function makeUkrainianHelmetTexture(helmetColorHex) {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base helmet color
    const r = (helmetColorHex >> 16) & 0xff;
    const g = (helmetColorHex >> 8)  & 0xff;
    const b =  helmetColorHex        & 0xff;
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(0, 0, size, size);

    // Blue cross (horizontal + vertical blue tape)
    ctx.fillStyle = '#0057B8';
    ctx.fillRect(0, 13, size, 6);    // horizontal
    ctx.fillRect(13, 0, 6, size);    // vertical

    // Yellow outline on cross
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(0, 12, size, 1);
    ctx.fillRect(0, 19, size, 1);
    ctx.fillRect(12, 0, 1, size);
    ctx.fillRect(19, 0, 1, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  /* ── NPC Visual Mesh — Ukrainian forces with proper insignia ─────── */
  function buildNPCMesh(npc) {
    const group = new THREE.Group();

    // Rank determines camo variant: higher ranks get darker, more worn camo
    const isDark = ['veteran', 'elite', 'specialist'].includes(npc.rank);
    const camoVariant = isDark ? 'dark' : 'light';
    const camoTex = makeMM14CamoTexture(camoVariant);
    const helmetColor = isDark ? 0x4a5a2f : 0x5a6a3f;

    // ── Body (MM-14 camo) ─────────────────────────────────
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.7, 0.3),
      new THREE.MeshLambertMaterial({ map: camoTex })
    );
    body.position.y = 0.75;
    group.add(body);

    // ── Head (skin) ───────────────────────────────────────
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xDDAA88 })
    );
    head.position.y = 1.28;
    group.add(head);

    // ── Helmet with blue-yellow cross tape ────────────────
    const helmetTex = makeUkrainianHelmetTexture(helmetColor);
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.16, 0.40),
      new THREE.MeshLambertMaterial({ map: helmetTex })
    );
    helmet.position.y = 1.44;
    group.add(helmet);

    // ── Legs (dark camo) ──────────────────────────────────
    const legCamo = makeMM14CamoTexture('dark');
    for (let side = -1; side <= 1; side += 2) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.5, 0.14),
        new THREE.MeshLambertMaterial({ map: legCamo })
      );
      leg.position.set(side * 0.12, 0.25, 0);
      leg.userData.isLeg = true;
      group.add(leg);

      // Boot (black)
      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.12, 0.15),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      boot.position.set(side * 0.12, 0.02, 0);
      group.add(boot);
    }

    // ── Left arm with BLUE-YELLOW PATCH (Ukrainian insignia) ─
    const patchBaseColor = isDark ? 0x3a4a1f : 0x5a7a3f;
    const patchTex = makeUkrainianPatchTexture(patchBaseColor);
    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.12),
      new THREE.MeshLambertMaterial({ map: patchTex })
    );
    armL.position.set(-0.32, 0.8, 0);
    armL.userData.isArm = true;
    group.add(armL);

    // ── Right arm (plain camo) ────────────────────────────
    const armR = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.5, 0.12),
      new THREE.MeshLambertMaterial({ map: camoTex })
    );
    armR.position.set(0.32, 0.8, 0);
    armR.userData.isArm = true;
    group.add(armR);

    // ── Belt (dark webbing) ───────────────────────────────
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.05, 0.32),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    belt.position.y = 0.42;
    group.add(belt);

    // ── Eyes (green glow for friendlies) ──────────────────
    const eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00CC00 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.06, 1.30, 0.14);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.06, 1.30, 0.14);
    group.add(eyeL, eyeR);

    group.userData.npcId   = npc.id;
    group.userData.faction = 'ukrainian';
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

  /* ── NPC Combat ───────────────────────────────────────────────────── */
  function findNearestEnemy(npc) {
    const allEnemies = (typeof Enemies !== 'undefined' && Enemies.getAll) ? Enemies.getAll() : [];
    let nearest = null;
    let nearDist = Infinity;
    for (const e of allEnemies) {
      const dist = npc.position.distanceTo(e.mesh.position);
      if (dist < nearDist) {
        nearDist = dist;
        nearest = e;
      }
    }
    if (nearest && nearDist < 20) return { enemy: nearest, dist: nearDist };
    return null;
  }

  function updateCombat(npc, delta, target) {
    const dist = target.dist;
    const enemy = target.enemy;

    if (dist > 12) {
      // Move toward enemy, stop 8 units away
      const dir = new THREE.Vector3().subVectors(enemy.mesh.position, npc.position).setY(0).normalize();
      npc.target = npc.position.clone().add(dir.multiplyScalar(dist - 8));
    } else if (dist >= 4) {
      // Stop and shoot
      npc.target = null;
      // Face enemy
      const lookDir = new THREE.Vector3().subVectors(enemy.mesh.position, npc.position).setY(0);
      if (lookDir.length() > 0.1) {
        npc.mesh.rotation.y = Math.atan2(lookDir.x, lookDir.z);
      }

      npc.combatCooldown -= delta;
      if (npc.combatCooldown <= 0) {
        const fireRate = 1.5 - npc.skills.combat * 0.007; // 0.8-1.5s
        npc.combatCooldown = Math.max(0.8, fireRate);
        const dmg = 5 + npc.skills.combat * 0.3;

        if (typeof Enemies !== 'undefined' && Enemies.damage) {
          const remaining = Enemies.damage(enemy, dmg);
          if (remaining <= 0) {
            npc.stress = Math.max(0, npc.stress - 5);
            npc.morale = Math.min(100, npc.morale + 5);
            npc.combatTarget = null;
          }
        }

        // Flash arms white when firing
        npc.fireFlash = 0.1;
        npc.mesh.children.forEach(child => {
          if (child.userData.isArm) {
            if (!child.userData._savedMaterial) {
              child.userData._savedMaterial = child.material;
              child.userData._flashMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
            }
            child.material = child.userData._flashMaterial;
          }
        });
      }
    } else {
      // Too close — back away
      const away = new THREE.Vector3().subVectors(npc.position, enemy.mesh.position).setY(0).normalize();
      npc.target = npc.position.clone().add(away.multiplyScalar(6));
    }
  }

  /* ── AI Behavior ─────────────────────────────────────────────────── */
  function updateBehavior(npc, delta, timeInfo) {
    // Combat takes highest priority for guards, patrols, and infantry+ ranks
    if (['guard', 'patrol'].includes(npc.job) ||
        RANK_ORDER.indexOf(npc.rank) >= RANK_ORDER.indexOf(NPC_RANK.INFANTRY)) {
      const nearestEnemy = findNearestEnemy(npc);
      if (nearestEnemy && nearestEnemy.dist < 20) {
        npc.combatTarget = nearestEnemy.enemy;
        updateCombat(npc, delta, nearestEnemy);
        return;
      }
    }

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

    // Reset fire flash
    if (npc.fireFlash > 0) {
      npc.fireFlash -= delta;
      if (npc.fireFlash <= 0) {
        npc.mesh.children.forEach(child => {
          if (child.userData.isArm && child.userData._savedMaterial) {
            child.material = child.userData._savedMaterial;
          }
        });
      }
    }

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
