/* ───────────────────────────────────────────────────────────────────────
   SKILL SYSTEM — player skills that improve through usage
   ─────────────────────────────────────────────────────────────────────── */
const SkillSystem = (function () {
  'use strict';

  /* ── Skill Categories ────────────────────────────────────────────── */
  const SKILLS = {
    // Combat
    shooting_accuracy: { category: 'combat', base: 10, max: 100 },
    recoil_control:    { category: 'combat', base: 5,  max: 100 },
    tactical_movement: { category: 'combat', base: 5,  max: 100 },

    // Engineering
    build_speed:       { category: 'engineering', base: 10, max: 100 },
    advanced_structures:{ category: 'engineering', base: 0,  max: 100 },
    automation_efficiency:{ category: 'engineering', base: 0, max: 100 },

    // Drone
    fpv_precision:     { category: 'drone', base: 5,  max: 100 },
    drone_endurance:   { category: 'drone', base: 5,  max: 100 },
    multi_drone:       { category: 'drone', base: 0,  max: 100 },

    // Leadership
    squad_morale:      { category: 'leadership', base: 5,  max: 100 },
    command_speed:     { category: 'leadership', base: 5,  max: 100 },
    npc_loyalty:       { category: 'leadership', base: 5,  max: 100 },
  };

  /* ── State ───────────────────────────────────────────────────────── */
  const levels = {};
  const xp     = {};

  function xpToLevel(currentXp) {
    // 100 xp = level 1, exponential growth
    return Math.floor(Math.sqrt(currentXp / 25));
  }

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    for (const [name, def] of Object.entries(SKILLS)) {
      levels[name] = def.base;
      xp[name] = def.base * 25; // reverse of xpToLevel
    }
  }

  /* ── Gain XP ─────────────────────────────────────────────────────── */
  function addXP(skillName, amount) {
    if (!(skillName in SKILLS)) return;
    xp[skillName] = (xp[skillName] || 0) + amount;
    const newLevel = Math.min(SKILLS[skillName].max, xpToLevel(xp[skillName]));
    const oldLevel = levels[skillName];
    levels[skillName] = newLevel;
    return newLevel > oldLevel; // true if leveled up
  }

  /* ── Usage-based XP gain ─────────────────────────────────────────── */
  function onShoot(hit, headshot) {
    addXP('shooting_accuracy', hit ? (headshot ? 5 : 2) : 0.5);
    addXP('recoil_control', 0.3);
  }

  function onSprint() {
    addXP('tactical_movement', 0.05);
  }

  function onBuild() {
    addXP('build_speed', 1);
    addXP('advanced_structures', 0.3);
  }

  function onAutomation() {
    addXP('automation_efficiency', 0.5);
  }

  function onDroneFly(delta) {
    addXP('fpv_precision', delta * 0.5);
    addXP('drone_endurance', delta * 0.2);
  }

  function onDroneMulti() {
    addXP('multi_drone', 2);
  }

  function onCommand() {
    addXP('squad_morale', 0.5);
    addXP('command_speed', 0.3);
    addXP('npc_loyalty', 0.2);
  }

  /* ── Getters ─────────────────────────────────────────────────────── */
  function getLevel(name) { return levels[name] || 0; }
  function getXP(name)    { return xp[name] || 0; }

  function getCategory(cat) {
    const result = {};
    for (const [name, def] of Object.entries(SKILLS)) {
      if (def.category === cat) {
        result[name] = { level: levels[name], xp: xp[name], max: def.max };
      }
    }
    return result;
  }

  function getAllSkills() {
    const result = {};
    for (const name of Object.keys(SKILLS)) {
      result[name] = { level: levels[name], xp: xp[name], category: SKILLS[name].category };
    }
    return result;
  }

  function getCategoryAverage(cat) {
    let total = 0, count = 0;
    for (const [name, def] of Object.entries(SKILLS)) {
      if (def.category === cat) { total += levels[name]; count++; }
    }
    return count > 0 ? total / count : 0;
  }

  /* ── Gameplay modifiers based on skill ───────────────────────────── */
  function getSpreadMod() {
    // Lower spread with higher accuracy (up to 50% reduction)
    return 1.0 - (levels.shooting_accuracy || 0) * 0.005;
  }

  function getRecoilMod() {
    return 1.0 - (levels.recoil_control || 0) * 0.005;
  }

  function getBuildSpeedMod() {
    return 1.0 + (levels.build_speed || 0) * 0.01;
  }

  function getAutomationMod() {
    return 1.0 + (levels.automation_efficiency || 0) * 0.01;
  }

  function getDroneBatteryMod() {
    return 1.0 + (levels.drone_endurance || 0) * 0.01;
  }

  function getMoraleMod() {
    return 1.0 + (levels.squad_morale || 0) * 0.005;
  }

  function getMaxDrones() {
    return 1 + Math.floor((levels.multi_drone || 0) / 20);
  }

  /* ── Skill Trees ───────────────────────────── */
  const SKILL_TREE = {
    ASSAULT: [
      { id: 'rapid_fire',    name: 'Rapid Fire',    description: '+15% fire rate',                  skillReq: { shooting_accuracy: 20 }, unlocked: false, bonus: { fireRate: 1.15 } },
      { id: 'double_tap',    name: 'Double Tap',     description: '10% chance to fire twice',        skillReq: { shooting_accuracy: 40 }, unlocked: false, bonus: { doubleTap: 0.10 } },
      { id: 'bullet_storm',  name: 'Bullet Storm',   description: '+25% fire rate, -10% accuracy',   skillReq: { shooting_accuracy: 70 }, unlocked: false, bonus: { fireRate: 1.25, accuracy: 0.90 } }
    ],
    DEFENSE: [
      { id: 'tough_skin',    name: 'Tough Skin',     description: '-10% incoming damage',            skillReq: { tactical_movement: 20 }, unlocked: false, bonus: { damageTaken: 0.90 } },
      { id: 'iron_will',     name: 'Iron Will',      description: '-20% incoming damage',            skillReq: { tactical_movement: 40 }, unlocked: false, bonus: { damageTaken: 0.80 } },
      { id: 'fortress',      name: 'Fortress',       description: '-30% incoming damage, +20 max HP', skillReq: { tactical_movement: 70 }, unlocked: false, bonus: { damageTaken: 0.70, maxHP: 20 } }
    ],
    SUPPORT: [
      { id: 'field_medic',   name: 'Field Medic',    description: '+10% squad heal rate',            skillReq: { squad_morale: 20 }, unlocked: false, bonus: { healRate: 1.10 } },
      { id: 'quick_fix',     name: 'Quick Fix',      description: '+20% squad heal rate',            skillReq: { squad_morale: 40 }, unlocked: false, bonus: { healRate: 1.20 } },
      { id: 'miracle_worker', name: 'Miracle Worker', description: '+35% squad heal, +15% squad dmg', skillReq: { squad_morale: 70 }, unlocked: false, bonus: { healRate: 1.35, squadDamage: 1.15 } }
    ]
  };

  function checkSkillTreeUnlocks() {
    var unlocked = [];
    for (var treeName of Object.keys(SKILL_TREE)) {
      for (var node of SKILL_TREE[treeName]) {
        if (node.unlocked) continue;
        var met = true;
        for (var skill of Object.keys(node.skillReq)) {
          if ((levels[skill] || 0) < node.skillReq[skill]) { met = false; break; }
        }
        if (met) {
          node.unlocked = true;
          unlocked.push(node);
        }
      }
    }
    return unlocked;
  }

  function getSkillTree(treeName) {
    if (!SKILL_TREE[treeName]) return null;
    return SKILL_TREE[treeName].map(function (n) { return { ...n }; });
  }

  function isNodeUnlocked(nodeId) {
    for (var treeName of Object.keys(SKILL_TREE)) {
      for (var node of SKILL_TREE[treeName]) {
        if (node.id === nodeId) return node.unlocked;
      }
    }
    return false;
  }

  /* ── Passive Abilities ─────────────────────── */
  const PASSIVE_ABILITIES = [
    { id: 'steady_hands',     name: 'Steady Hands',     skill: 'shooting_accuracy', threshold: 50, stat: 'weaponSway',   bonus: 0.85, description: '-15% weapon sway' },
    { id: 'iron_grip',        name: 'Iron Grip',         skill: 'recoil_control',    threshold: 50, stat: 'recoil',       bonus: 0.80, description: '-20% recoil' },
    { id: 'master_builder',   name: 'Master Builder',    skill: 'build_speed',       threshold: 50, stat: 'buildSpeed',   bonus: 1.30, description: '+30% build speed' },
    { id: 'eagle_eye',        name: 'Eagle Eye',         skill: 'fpv_precision',     threshold: 50, stat: 'droneRange',   bonus: 1.25, description: '+25% drone range' },
    { id: 'inspiring_leader', name: 'Inspiring Leader',  skill: 'squad_morale',      threshold: 50, stat: 'squadDamage',  bonus: 1.10, description: '+10% squad damage' },
    { id: 'quick_feet',       name: 'Quick Feet',        skill: 'tactical_movement', threshold: 50, stat: 'moveSpeed',    bonus: 1.10, description: '+10% move speed' }
  ];

  function getActivePassives() {
    var active = [];
    for (var p of PASSIVE_ABILITIES) {
      if ((levels[p.skill] || 0) >= p.threshold) {
        active.push({ ...p });
      }
    }
    return active;
  }

  function getPassiveBonus(statName) {
    for (var p of PASSIVE_ABILITIES) {
      if (p.stat === statName && (levels[p.skill] || 0) >= p.threshold) {
        return p.bonus;
      }
    }
    return 1.0;
  }

  /* ── Skill Reset ───────────────────────────── */
  function resetSkills() {
    if (typeof Economy !== 'undefined' && Economy.getBalance && Economy.spend) {
      if (Economy.getBalance() < 500) return false;
      Economy.spend(500);
    }
    for (var name of Object.keys(SKILLS)) {
      levels[name] = SKILLS[name].base;
      xp[name] = SKILLS[name].base * 25;
    }
    // Reset skill tree unlocks
    for (var treeName of Object.keys(SKILL_TREE)) {
      for (var node of SKILL_TREE[treeName]) { node.unlocked = false; }
    }
    return true;
  }

  function resetSingleSkill(skillName) {
    if (!(skillName in SKILLS)) return false;
    if (typeof Economy !== 'undefined' && Economy.getBalance && Economy.spend) {
      if (Economy.getBalance() < 100) return false;
      Economy.spend(100);
    }
    levels[skillName] = SKILLS[skillName].base;
    xp[skillName] = SKILLS[skillName].base * 25;
    checkSkillTreeUnlocks(); // re-evaluate tree
    return true;
  }

  return {
    SKILLS, SKILL_TREE, PASSIVE_ABILITIES,
    init,
    addXP,
    onShoot,
    onSprint,
    onBuild,
    onAutomation,
    onDroneFly,
    onDroneMulti,
    onCommand,
    getLevel,
    getXP,
    getCategory,
    getAllSkills,
    getCategoryAverage,
    getSpreadMod,
    getRecoilMod,
    getBuildSpeedMod,
    getAutomationMod,
    getDroneBatteryMod,
    getMoraleMod,
    getMaxDrones,
    // Skill Trees
    checkSkillTreeUnlocks,
    getSkillTree,
    isNodeUnlocked,
    // Passive Abilities
    getActivePassives,
    getPassiveBonus,
    // Skill Reset
    resetSkills,
    resetSingleSkill,
  };
})();
