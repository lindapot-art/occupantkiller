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

  return {
    SKILLS,
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
  };
})();
