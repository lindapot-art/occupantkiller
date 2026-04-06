/* ───────────────────────────────────────────────────────────────────────
   AUTOMATION SYSTEM — auto-gather, craft, repair, train, deploy
   ─────────────────────────────────────────────────────────────────────── */
const Automation = (function () {
  'use strict';

  /* ── Automation Tasks ────────────────────────────────────────────── */
  const AUTO_TYPE = Object.freeze({
    GATHER:     'gather',
    CRAFT:      'craft',
    REPAIR:     'repair',
    TRAIN:      'train',
    DEPLOY:     'deploy',
  });

  /* ── Config ──────────────────────────────────────────────────────── */
  const BASE_INTERVAL = 30; // seconds between auto-ticks
  const UPGRADE_MULTIPLIER = 0.85; // each upgrade reduces interval

  /* ── State ───────────────────────────────────────────────────────── */
  const tasks = [];
  let nextId = 1;

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    tasks.length = 0;
    nextId = 1;
  }

  /* ── Create automation task ──────────────────────────────────────── */
  function create(type, config) {
    const task = {
      id: nextId++,
      type,
      config: config || {},
      level: 1,
      timer: 0,
      interval: BASE_INTERVAL,
      active: true,
      totalProduced: 0,
    };
    tasks.push(task);
    return task;
  }

  /* ── Upgrade ─────────────────────────────────────────────────────── */
  function upgrade(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return false;

    const cost = task.level * 50;
    if (typeof Economy === 'undefined' || !Economy.spendCurrency || !Economy.spendCurrency(cost)) return false;

    task.level++;
    task.interval = BASE_INTERVAL * Math.pow(UPGRADE_MULTIPLIER, task.level - 1);
    return true;
  }

  /* ── Update ──────────────────────────────────────────────────────── */
  function update(delta) {
    var effMod = (typeof SkillSystem !== 'undefined' && SkillSystem.getAutomationMod) ? SkillSystem.getAutomationMod() : 1;

    for (const task of tasks) {
      if (!task.active) continue;

      task.timer += delta * effMod;

      if (task.timer >= task.interval) {
        task.timer -= task.interval;
        executeTick(task);
        task.totalProduced++;
      }
    }
  }

  function executeTick(task) {
    switch (task.type) {
      case AUTO_TYPE.GATHER:
        executeGather(task);
        break;
      case AUTO_TYPE.CRAFT:
        executeCraft(task);
        break;
      case AUTO_TYPE.REPAIR:
        executeRepair(task);
        break;
      case AUTO_TYPE.TRAIN:
        executeTrain(task);
        break;
      case AUTO_TYPE.DEPLOY:
        executeDeploy(task);
        break;
    }
  }

  function executeGather(task) {
    if (typeof Economy === 'undefined') return;
    const resource = task.config.resource || 'wood';
    const amount = task.level * 2;
    Economy.add(resource, amount);
    if (typeof SkillSystem !== 'undefined' && SkillSystem.onAutomation) SkillSystem.onAutomation();
  }

  function executeCraft(task) {
    if (typeof Economy === 'undefined') return;
    // Convert raw resources into processed goods
    if (Economy.has('metal', 5)) {
      Economy.spend('metal', 5);
      Economy.add('electronics', 1 * task.level);
      if (typeof SkillSystem !== 'undefined' && SkillSystem.onAutomation) SkillSystem.onAutomation();
    }
  }

  function executeRepair(task) {
    if (typeof Building === 'undefined' || !Building.getStructures) return;
    // Repair structures
    const structures = Building.getStructures();
    for (const s of structures) {
      if (s.health < 100) {
        s.health = Math.min(100, s.health + 5 * task.level);
        break;
      }
    }
  }

  function executeTrain(task) {
    if (typeof NPCSystem === 'undefined' || !NPCSystem.getAll) return;
    // Improve NPC skills
    const npcs = NPCSystem.getAll();
    for (let i = 0; i < task.level && i < npcs.length; i++) {
      const npc = npcs[i];
      if (!npc.skills) continue;
      const skillKeys = Object.keys(npc.skills);
      if (skillKeys.length === 0) continue;
      const key = skillKeys[Math.floor(Math.random() * skillKeys.length)];
      npc.skills[key] = Math.min(100, npc.skills[key] + 0.5);
    }
  }

  function executeDeploy(task) {
    if (typeof DroneSystem === 'undefined' || !DroneSystem.getAll) return;
    // Auto-deploy drones on patrol
    const drones = DroneSystem.getAll();
    for (const drone of drones) {
      if (!drone.aiControlled && drone.type === 'surveillance') {
        // Create simple patrol loop
        const center = drone.position.clone();
        const points = [];
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
          points.push(new THREE.Vector3(
            center.x + Math.cos(a) * 30,
            center.y,
            center.z + Math.sin(a) * 30
          ));
        }
        DroneSystem.setPatrol(drone.id, points);
        break;
      }
    }
  }

  /* ── Queries ─────────────────────────────────────────────────────── */
  function getAll()       { return tasks; }
  function getActive()    { return tasks.filter(t => t.active); }
  function getById(id)    { return tasks.find(t => t.id === id); }

  function toggle(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) task.active = !task.active;
  }

  function remove(taskId) {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx >= 0) tasks.splice(idx, 1);
  }

  return {
    AUTO_TYPE,
    init,
    create,
    upgrade,
    update,
    getAll,
    getActive,
    getById,
    toggle,
    remove,
  };
})();
