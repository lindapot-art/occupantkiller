/* ============================================================
 *  PROGRESSION.JS — 7 new progression/meta features
 *  Features: prestige system, daily challenges, bounty board,
 *  war journal, stats tracking, leaderboard, challenge modes
 * ============================================================ */
const Progression = (function () {
  'use strict';

  /* ── Feature 53: Prestige System ───────────── */
  const PRESTIGE = {
    MAX_LEVEL: 10,
    BONUSES_PER_LEVEL: {
      xpMult: 0.1,        // +10% XP per prestige
      okcMult: 0.05,      // +5% OKC per prestige
      startingWeapon: 1,   // extra starting weapon slot per prestige
      maxHP: 5,            // +5 HP per prestige
      damageBonus: 0.02    // +2% damage per prestige
    },
    ICONS: ['⭐', '⭐⭐', '🌟', '🌟🌟', '💫', '💫💫', '🏆', '🏆🏆', '👑', '👑👑']
  };

  let prestigeLevel = 0;
  let prestigeXPRequired = 50000; // XP needed to prestige
  var _highestStage = 0;

  function canPrestige(totalXP) { return totalXP >= prestigeXPRequired && prestigeLevel < PRESTIGE.MAX_LEVEL; }

  function doPrestige() {
    if (prestigeLevel >= PRESTIGE.MAX_LEVEL) return false;
    prestigeLevel++;
    prestigeXPRequired = Math.floor(prestigeXPRequired * 1.5);
    return {
      level: prestigeLevel,
      icon: PRESTIGE.ICONS[prestigeLevel - 1],
      bonuses: getPrestigeBonuses()
    };
  }

  function getPrestigeBonuses() {
    const b = PRESTIGE.BONUSES_PER_LEVEL;
    return {
      xpMult: 1 + b.xpMult * prestigeLevel,
      okcMult: 1 + b.okcMult * prestigeLevel,
      startingWeapons: b.startingWeapon * prestigeLevel,
      maxHPBonus: b.maxHP * prestigeLevel,
      damageMult: 1 + b.damageBonus * prestigeLevel
    };
  }

  function getPrestigeLevel() { return prestigeLevel; }
  function getPrestigeIcon() { return prestigeLevel > 0 ? PRESTIGE.ICONS[prestigeLevel - 1] : ''; }

  /* ── Feature 54: Daily Challenges ──────────── */
  const DAILY_CHALLENGES = [
    { id: 'headshot_10', name: 'Headhunter', desc: 'Get 10 headshots', target: 10, reward: 200, stat: 'headshots' },
    { id: 'kill_50', name: 'Body Count', desc: 'Kill 50 enemies', target: 50, reward: 150, stat: 'kills' },
    { id: 'survive_5', name: 'Endurance', desc: 'Survive 5 waves', target: 5, reward: 100, stat: 'wavesCleared' },
    { id: 'no_damage_wave', name: 'Flawless', desc: 'Clear a wave without taking damage', target: 1, reward: 250, stat: 'flawlessWaves' },
    { id: 'melee_5', name: 'Up Close', desc: 'Get 5 melee kills', target: 5, reward: 120, stat: 'meleeKills' },
    { id: 'build_10', name: 'Fortifier', desc: 'Build 10 structures', target: 10, reward: 100, stat: 'structures' },
    { id: 'drone_kills_5', name: 'Drone Pilot', desc: '5 kills with drones', target: 5, reward: 130, stat: 'droneKills' },
    { id: 'explosive_multi', name: 'Blast Zone', desc: '3 explosive multi-kills', target: 3, reward: 180, stat: 'explosiveMultis' },
    { id: 'sniper_3', name: 'Long Shot', desc: '3 kills at 30m+ range', target: 3, reward: 160, stat: 'longRangeKills' },
    { id: 'collect_20', name: 'Scavenger', desc: 'Collect 20 pickups', target: 20, reward: 90, stat: 'pickupsCollected' },
    { id: 'vehicle_kill', name: 'Road Rage', desc: 'Destroy 2 vehicles', target: 2, reward: 140, stat: 'vehicleKills' },
    { id: 'streak_7', name: 'On Fire', desc: 'Get a 7-kill streak', target: 7, reward: 200, stat: 'maxStreak' }
  ];

  let activeDailies = [];
  let dailyProgress = {};
  let lastDailyRefresh = 0;

  function refreshDailies() {
    // Pick 3 random challenges
    const shuffled = [...DAILY_CHALLENGES].sort(() => Math.random() - 0.5);
    activeDailies = shuffled.slice(0, 3).map(c => ({ ...c, completed: false }));
    dailyProgress = {};
    for (const c of activeDailies) dailyProgress[c.id] = 0;
    lastDailyRefresh = Date.now();
  }

  function getDailies() { return activeDailies.map(c => ({ ...c, progress: dailyProgress[c.id] || 0 })); }

  function updateDailyStat(stat, amount) {
    const completions = [];
    for (const c of activeDailies) {
      if (c.completed || c.stat !== stat) continue;
      dailyProgress[c.id] = (dailyProgress[c.id] || 0) + amount;
      if (dailyProgress[c.id] >= c.target) {
        c.completed = true;
        completions.push({ ...c });
      }
    }
    return completions;
  }

  /* ── Feature 55: Bounty Board ──────────────── */
  const BOUNTY_TEMPLATES = [
    { name: 'Kill {n} enemies with {weapon}', type: 'weapon_kill', rewards: [50, 100, 200] },
    { name: 'Survive {n} waves without dying', type: 'survive', rewards: [75, 150, 300] },
    { name: 'Build {n} structures', type: 'build', rewards: [40, 80, 160] },
    { name: 'Collect {n} pickups', type: 'collect', rewards: [30, 60, 120] },
    { name: 'Deal {n} total damage', type: 'damage', rewards: [60, 120, 240] },
    { name: 'Get {n} headshots in one wave', type: 'headshot_wave', rewards: [80, 160, 320] },
    { name: 'Complete wave in under {n}s', type: 'speed_wave', rewards: [100, 200, 400] },
    { name: 'Take less than {n} damage in a wave', type: 'low_damage', rewards: [70, 140, 280] }
  ];

  let activeBounties = [];
  let completedBounties = 0;

  function generateBounties(wave) {
    activeBounties = [];
    const count = Math.min(3, 1 + Math.floor(wave / 3));
    const shuffled = [...BOUNTY_TEMPLATES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const template = shuffled[i];
      const tier = Math.min(2, Math.floor(wave / 4));
      const targets = { weapon_kill: [5, 10, 20], survive: [2, 4, 6], build: [3, 6, 10], collect: [5, 10, 15], damage: [500, 1000, 2000], headshot_wave: [3, 5, 8], speed_wave: [60, 45, 30], low_damage: [50, 25, 10] };
      const targetVal = (targets[template.type] || [5, 10, 20])[tier];
      let resolvedName = template.name.replace('{n}', targetVal);
      if (resolvedName.indexOf('{weapon}') !== -1) {
        const weaponNames = ['AK-74M', 'RPK-74', 'SVD Dragunov', 'PKM', 'M4A1', 'FN SCAR-H', 'Barrett M82', 'MP5 SMG'];
        resolvedName = resolvedName.replace('{weapon}', weaponNames[Math.floor(Math.random() * weaponNames.length)]);
      }
      activeBounties.push({
        ...template,
        name: resolvedName,
        tier,
        target: targetVal,
        reward: template.rewards[tier],
        progress: 0,
        completed: false
      });
    }
  }

  function updateBounty(type, amount) {
    const completed = [];
    for (const b of activeBounties) {
      if (b.completed || b.type !== type) continue;
      b.progress += amount;
      if (b.progress >= b.target) {
        b.completed = true;
        completedBounties++;
        completed.push(b);
      }
    }
    return completed;
  }

  function getBounties() { return activeBounties; }

  /* ── Feature 56: War Journal / Codex ───────── */
  const JOURNAL_CATEGORIES = {
    ENEMIES: 'Enemy Intel',
    WEAPONS: 'Weapon Data',
    LOCATIONS: 'Field Reports',
    LORE: 'War Stories',
    TACTICS: 'Tactical Notes'
  };

  let journalEntries = [];

  const CODEX_ENTRIES = [
    { id: 'entry_conscript', cat: 'ENEMIES', title: 'Conscript Profile', text: 'Poorly trained infantry, forced into service. Low accuracy but dangerous in numbers.', unlockKills: 5 },
    { id: 'entry_stormer', cat: 'ENEMIES', title: 'Stormer Profile', text: 'Aggressive assault infantry. Trained for close-quarters combat. Fast and deadly.', unlockKills: 10 },
    { id: 'entry_armored', cat: 'ENEMIES', title: 'Armored Profile', text: 'Heavy infantry with body armor and reinforced helmets. Slow but extremely tough.', unlockKills: 15 },
    { id: 'entry_boss', cat: 'ENEMIES', title: 'Commander Intel', text: 'Enemy field commander. Can summon reinforcements and enters rage mode when wounded.', unlockKills: 1 },
    { id: 'entry_ak74', cat: 'WEAPONS', title: 'AK-74M Analysis', text: 'Standard-issue assault rifle. Reliable in all conditions. Moderate recoil.', unlockShots: 100 },
    { id: 'entry_svd', cat: 'WEAPONS', title: 'SVD Report', text: 'Designated marksman rifle. Devastating at range. Requires patience and precision.', unlockShots: 50 },
    { id: 'entry_hostomol', cat: 'LOCATIONS', title: 'Hostomol Briefing', text: 'Strategic airport. Site of fierce early resistance. Watch for aircraft wreckage.', unlockVisit: true },
    { id: 'entry_avdiivka', cat: 'LOCATIONS', title: 'Avdiivka Report', text: 'Industrial city under prolonged siege. Dense urban combat expected.', unlockVisit: true },
    { id: 'entry_bayraktar', cat: 'LORE', title: 'Bayraktar Song', text: 'The famous combat drone that became a symbol of resistance.', unlockDrone: true },
    { id: 'entry_flanking', cat: 'TACTICS', title: 'Flanking Tactics', text: 'Enemies attempt flanking maneuvers. Watch your sides during waves 3+.', unlockWave: 3 },
    { id: 'entry_mortar', cat: 'TACTICS', title: 'Indirect Fire', text: 'Mortar teams set up at range. Eliminate quickly or relocate to avoid barrages.', unlockWave: 7 },
    { id: 'entry_shield', cat: 'TACTICS', title: 'Shield Tactics', text: 'Shield bearers block frontal damage. Flank them or use explosives.', unlockWave: 5 }
  ];

  let unlockedEntries = new Set();

  function unlockJournalEntry(entryId) {
    if (unlockedEntries.has(entryId)) return false;
    const entry = CODEX_ENTRIES.find(e => e.id === entryId);
    if (!entry) return false;
    unlockedEntries.add(entryId);
    journalEntries.push({ ...entry, unlockedAt: Date.now() });
    return true;
  }

  function getJournal() { return journalEntries; }
  function getJournalByCategory(cat) { return journalEntries.filter(e => e.cat === cat); }
  function isEntryUnlocked(id) { return unlockedEntries.has(id); }

  /* ── Feature 57: Stats Tracking ────────────── */
  let stats = {
    totalKills: 0, headshots: 0, meleeKills: 0, droneKills: 0,
    vehicleKills: 0, longRangeKills: 0, explosiveMultis: 0,
    totalDamageDealt: 0, totalDamageTaken: 0,
    shotsFired: 0, shotsHit: 0,
    wavesCleared: 0, flawlessWaves: 0, stagesCleared: 0,
    deathCount: 0, totalPlayTime: 0,
    structures: 0, blocksDestroyed: 0,
    pickupsCollected: 0, okCEarned: 0,
    longestStreak: 0, maxStreak: 0,
    favoriteWeapon: '', weaponKills: {},
    distanceTraveled: 0,
    lastPosition: null
  };

  function trackStat(stat, amount) {
    if (stats[stat] !== undefined) {
      if (typeof stats[stat] === 'number') {
        stats[stat] += amount;
      }
    }
    // Also update daily challenges
    return updateDailyStat(stat, amount);
  }

  function trackWeaponKill(weaponName) {
    stats.weaponKills[weaponName] = (stats.weaponKills[weaponName] || 0) + 1;
    // Find favorite
    let maxKills = 0;
    for (const [name, kills] of Object.entries(stats.weaponKills)) {
      if (kills > maxKills) { maxKills = kills; stats.favoriteWeapon = name; }
    }
  }

  function getStats() { return { ...stats }; }

  function getAccuracy() {
    if (stats.shotsFired === 0) return 0;
    return Math.round((stats.shotsHit / stats.shotsFired) * 100);
  }

  function getKDR() {
    if (stats.deathCount === 0) return stats.totalKills;
    return Math.round((stats.totalKills / stats.deathCount) * 100) / 100;
  }

  /* ── Feature 58: Leaderboard (Local) ───────── */
  let leaderboard = [];
  const MAX_ENTRIES = 20;

  function loadLeaderboard() {
    try {
      const data = localStorage.getItem('ok_leaderboard');
      if (data) leaderboard = JSON.parse(data);
    } catch (_e) { leaderboard = []; }
  }

  function saveLeaderboard() {
    try { localStorage.setItem('ok_leaderboard', JSON.stringify(leaderboard)); } catch (_e) { /* noop */ }
  }

  function submitScore(playerName, score, wave, stage, kills) {
    const entry = {
      name: playerName || 'Player',
      score, wave, stage, kills,
      accuracy: getAccuracy(),
      date: new Date().toISOString().split('T')[0],
      prestige: prestigeLevel
    };
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    if (leaderboard.length > MAX_ENTRIES) leaderboard = leaderboard.slice(0, MAX_ENTRIES);
    saveLeaderboard();
    return leaderboard.indexOf(entry) + 1; // rank
  }

  function getLeaderboard() { return leaderboard; }

  /* ── Feature 59: Challenge Modes ───────────── */
  const CHALLENGE_MODES = {
    HARDCORE: {
      id: 'HARDCORE', name: 'Hardcore', icon: '💀',
      desc: 'No HUD. 50% HP. Enemies deal 2× damage. No respawn.',
      modifiers: { hpMult: 0.5, enemyDmgMult: 2.0, noHUD: true, noRespawn: true, xpMult: 2.0 }
    },
    SPEEDRUN: {
      id: 'SPEEDRUN', name: 'Speedrun', icon: '⏱️',
      desc: 'Timer runs. Beat all waves as fast as possible. Score = time-based.',
      modifiers: { timed: true, xpMult: 1.5, scoreByTime: true }
    },
    PACIFIST: {
      id: 'PACIFIST', name: 'Pacifist', icon: '🕊️',
      desc: 'Cannot shoot. Must survive using only building and abilities.',
      modifiers: { noShooting: true, buildSpeedMult: 2.0, xpMult: 3.0 }
    },
    ONE_SHOT: {
      id: 'ONE_SHOT', name: 'One in the Chamber', icon: '🎱',
      desc: 'One bullet. Kills give one bullet. Melee is your backup.',
      modifiers: { oneAmmo: true, xpMult: 2.5 }
    },
    JUGGERNAUT_MODE: {
      id: 'JUGGERNAUT_MODE', name: 'Juggernaut', icon: '🛡️',
      desc: '3× HP, can\'t sprint. Enemies spawn 2× faster.',
      modifiers: { hpMult: 3.0, noSprint: true, spawnRateMult: 2.0, xpMult: 1.5 }
    },
    SNIPER_ONLY: {
      id: 'SNIPER_ONLY', name: 'Sniper Only', icon: '🔭',
      desc: 'Only sniper rifles. Headshots deal 5× damage.',
      modifiers: { sniperOnly: true, headshotMult: 5.0, xpMult: 2.0 }
    },
    NIGHT_OPS: {
      id: 'NIGHT_OPS', name: 'Night Operations', icon: '🌙',
      desc: 'Permanent night. Limited visibility. Night vision recommended.',
      modifiers: { permanentNight: true, visRange: 15, xpMult: 1.8 }
    }
  };

  let activeChallengeMode = null;

  function setChallenge(modeId) {
    if (!CHALLENGE_MODES[modeId]) return false;
    activeChallengeMode = modeId;
    return true;
  }

  function getChallengeMode() {
    if (!activeChallengeMode) return null;
    return CHALLENGE_MODES[activeChallengeMode];
  }

  function getChallengeModifiers() {
    if (!activeChallengeMode) return {};
    return CHALLENGE_MODES[activeChallengeMode].modifiers || {};
  }

  function clearChallenge() { activeChallengeMode = null; }

  /* ── Achievement System ──────────────────────── */
  const ACHIEVEMENTS = {
    FIRST_BLOOD:    { id: 'FIRST_BLOOD',    name: 'First Blood',    description: 'Get your first kill',              icon: '🩸', requirement: 1,     reward: { okc: 50,   xp: 100 }  },
    SHARPSHOOTER:   { id: 'SHARPSHOOTER',   name: 'Sharpshooter',   description: '50% accuracy over 100 shots',      icon: '🎯', requirement: 50,    reward: { okc: 200,  xp: 500 }  },
    HEADHUNTER:     { id: 'HEADHUNTER',     name: 'Headhunter',     description: 'Get 100 headshots',                icon: '💀', requirement: 100,   reward: { okc: 300,  xp: 750 }  },
    SURVIVOR:       { id: 'SURVIVOR',        name: 'Survivor',       description: 'Survive 10 waves',                 icon: '🛡️', requirement: 10,    reward: { okc: 150,  xp: 400 }  },
    SLAYER:         { id: 'SLAYER',          name: 'Slayer',         description: '1000 total kills',                  icon: '⚔️', requirement: 1000,  reward: { okc: 500,  xp: 1000 } },
    DEMOLITIONIST:  { id: 'DEMOLITIONIST',  name: 'Demolitionist',  description: 'Destroy 50 structures',            icon: '💥', requirement: 50,    reward: { okc: 200,  xp: 500 }  },
    DRONE_ACE:      { id: 'DRONE_ACE',      name: 'Drone Ace',      description: 'Get 50 drone kills',               icon: '🛩️', requirement: 50,    reward: { okc: 250,  xp: 600 }  },
    TREASURE_HUNTER:{ id: 'TREASURE_HUNTER', name: 'Treasure Hunter', description: 'Collect 50 pickups',              icon: '💎', requirement: 50,    reward: { okc: 150,  xp: 350 }  },
    SPEEDRUNNER:    { id: 'SPEEDRUNNER',    name: 'Speedrunner',    description: 'Clear a wave under 30 seconds',    icon: '⚡', requirement: 30,    reward: { okc: 300,  xp: 700 }  },
    IRONMAN:        { id: 'IRONMAN',         name: 'Ironman',        description: 'Clear a wave without taking damage', icon: '🏋️', requirement: 1,     reward: { okc: 400,  xp: 800 }  },
    PRESTIGE:       { id: 'PRESTIGE',        name: 'Prestige',       description: 'Prestige at least once',           icon: '⭐', requirement: 1,     reward: { okc: 500,  xp: 1000 } },
    COLLECTOR:      { id: 'COLLECTOR',       name: 'Collector',      description: 'Unlock all weapons',               icon: '🗄️', requirement: 1,     reward: { okc: 600,  xp: 1200 } },
    COMMANDER:      { id: 'COMMANDER',       name: 'Commander',      description: 'Have 10 NPCs alive at once',       icon: '👥', requirement: 10,    reward: { okc: 350,  xp: 700 }  },
    WEALTHY:        { id: 'WEALTHY',         name: 'Wealthy',        description: 'Earn 10000 OKC total',             icon: '💰', requirement: 10000, reward: { okc: 1000, xp: 2000 } },
    LEGENDARY:      { id: 'LEGENDARY',       name: 'Legendary',      description: 'Reach level 50',                   icon: '👑', requirement: 50,    reward: { okc: 2000, xp: 5000 } }
  };

  const unlockedAchievements = new Set();

  function checkAchievement(id, value) {
    if (!ACHIEVEMENTS[id] || unlockedAchievements.has(id)) return null;
    if (value >= ACHIEVEMENTS[id].requirement) {
      unlockedAchievements.add(id);
      return { ...ACHIEVEMENTS[id], unlockedAt: Date.now() };
    }
    return null;
  }

  function getAchievements() {
    return Object.values(ACHIEVEMENTS).map(a => ({
      ...a,
      unlocked: unlockedAchievements.has(a.id)
    }));
  }

  function isAchievementUnlocked(id) { return unlockedAchievements.has(id); }

  /* ── Season Pass ───────────────────────────── */
  const SEASON_REWARDS = [];
  (function buildSeasonRewards() {
    const freePool = [
      { type: 'okc', amount: 50 },  { type: 'okc', amount: 100 }, { type: 'okc', amount: 150 },
      { type: 'ammo', amount: 30 },  { type: 'ammo', amount: 60 },
      { type: 'xp_boost', amount: 1.25 }, { type: 'xp_boost', amount: 1.5 }
    ];
    const premiumPool = [
      { type: 'skin', id: 'skin_gold_ak' },     { type: 'skin', id: 'skin_neon_smg' },
      { type: 'skin', id: 'skin_camo_sniper' },  { type: 'skin', id: 'skin_chrome_pistol' },
      { type: 'skin', id: 'skin_flame_shotgun' }, { type: 'weapon', id: 'weapon_plasma' },
      { type: 'weapon', id: 'weapon_railgun' },   { type: 'cosmetic', id: 'cosmetic_helmet_gold' },
      { type: 'cosmetic', id: 'cosmetic_trail_fire' }, { type: 'cosmetic', id: 'cosmetic_emblem_skull' }
    ];
    for (let i = 0; i < 50; i++) {
      SEASON_REWARDS.push({
        level: i + 1,
        free: freePool[i % freePool.length],
        premium: premiumPool[i % premiumPool.length]
      });
    }
  })();

  let seasonLevel = 0;
  let seasonXP = 0;
  let seasonPremium = false;
  const SEASON_XP_PER_LEVEL = 1000;

  function addSeasonXP(amount) {
    seasonXP += amount;
    const newLevel = Math.min(50, Math.floor(seasonXP / SEASON_XP_PER_LEVEL));
    const leveled = newLevel > seasonLevel;
    seasonLevel = newLevel;
    return leveled ? seasonLevel : false;
  }

  function getSeasonLevel() { return seasonLevel; }

  function getSeasonRewards(level) {
    if (level < 1 || level > 50) return null;
    return SEASON_REWARDS[level - 1];
  }

  function isSeasonPremium() { return seasonPremium; }

  /* ── Combat Rating ─────────────────────────── */
  function calculateCombatRating() {
    var accuracy = stats.shotsFired > 0 ? (stats.shotsHit / stats.shotsFired) * 100 : 0;
    var kd = stats.deathCount > 0 ? stats.totalKills / stats.deathCount : stats.totalKills;
    var hsRatio = stats.totalKills > 0 ? (stats.headshots / stats.totalKills) * 100 : 0;
    var waves = stats.wavesCleared;
    var prestige = prestigeLevel;

    var raw =
      (Math.min(accuracy, 100) / 100) * 1500 * 0.30 +
      Math.min(kd, 20) / 20 * 1250 * 0.25 +
      (Math.min(hsRatio, 100) / 100) * 1000 * 0.20 +
      Math.min(waves, 100) / 100 * 750 * 0.15 +
      (prestige / PRESTIGE.MAX_LEVEL) * 500 * 0.10;

    var rating = Math.round(Math.min(5000, raw));
    var rankThresholds = [
      { min: 0,    rank: 'Bronze',   stars: 1 },
      { min: 500,  rank: 'Bronze',   stars: 2 },
      { min: 1000, rank: 'Bronze',   stars: 3 },
      { min: 1500, rank: 'Silver',   stars: 1 },
      { min: 2000, rank: 'Silver',   stars: 2 },
      { min: 2250, rank: 'Silver',   stars: 3 },
      { min: 2500, rank: 'Gold',     stars: 1 },
      { min: 2800, rank: 'Gold',     stars: 2 },
      { min: 3000, rank: 'Gold',     stars: 3 },
      { min: 3300, rank: 'Platinum', stars: 1 },
      { min: 3600, rank: 'Platinum', stars: 2 },
      { min: 3800, rank: 'Platinum', stars: 3 },
      { min: 4000, rank: 'Diamond',  stars: 1 },
      { min: 4300, rank: 'Diamond',  stars: 2 },
      { min: 4500, rank: 'Diamond',  stars: 3 },
      { min: 4700, rank: 'Master',   stars: 1 },
      { min: 4850, rank: 'Master',   stars: 2 },
      { min: 5000, rank: 'Master',   stars: 3 }
    ];
    var result = { rating: rating, rank: 'Bronze', stars: 1 };
    for (var i = rankThresholds.length - 1; i >= 0; i--) {
      if (rating >= rankThresholds[i].min) {
        result.rank = rankThresholds[i].rank;
        result.stars = rankThresholds[i].stars;
        break;
      }
    }
    return result;
  }

  /* ── Loadout Presets ───────────────────────── */
  const _loadouts = [];
  const MAX_LOADOUTS = 5;

  function saveLoadout(name, weaponIds, perkIds) {
    if (_loadouts.length >= MAX_LOADOUTS) return false;
    _loadouts.push({ name: name, weapons: weaponIds.slice(), perks: perkIds.slice(), createdAt: Date.now() });
    return true;
  }

  function loadLoadout(index) {
    if (index < 0 || index >= _loadouts.length) return null;
    return { ..._loadouts[index], weapons: _loadouts[index].weapons.slice(), perks: _loadouts[index].perks.slice() };
  }

  function getLoadouts() { return _loadouts.map(function (l) { return { ...l }; }); }

  function deleteLoadout(index) {
    if (index < 0 || index >= _loadouts.length) return false;
    _loadouts.splice(index, 1);
    return true;
  }

  /* ── Save/Load ─────────────────────────────── */
  function save() {
    try {
      var saveData = {
        prestigeLevel, stats, unlockedEntries: [...unlockedEntries],
        unlockedAchievements: typeof Feedback !== 'undefined' ? Feedback.getUnlocked() : [],
        highestStage: _highestStage || 0,
      };
      // Save weapon unlocks
      if (typeof Weapons !== 'undefined' && Weapons.getWeaponCount && Weapons.isUnlocked) {
        var wUnlocks = [];
        for (var wi = 0; wi < Weapons.getWeaponCount(); wi++) wUnlocks.push(Weapons.isUnlocked(wi));
        saveData.weaponUnlocks = wUnlocks;
      }
      // Save economy currency
      if (typeof Economy !== 'undefined' && Economy.getCurrency) {
        saveData.currency = Economy.getCurrency();
      }
      localStorage.setItem('ok_progression', JSON.stringify(saveData));
    } catch (_e) { /* noop */ }
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem('ok_progression') || '{}');
      if (data.prestigeLevel !== undefined) prestigeLevel = data.prestigeLevel;
      if (data.stats) Object.assign(stats, data.stats);
      if (data.unlockedEntries) data.unlockedEntries.forEach(id => unlockedEntries.add(id));
      if (data.highestStage !== undefined) _highestStage = data.highestStage;
      // Restore weapon unlocks
      if (data.weaponUnlocks && typeof Weapons !== 'undefined' && Weapons.unlockWeapon) {
        for (var wi = 0; wi < data.weaponUnlocks.length; wi++) {
          if (data.weaponUnlocks[wi]) Weapons.unlockWeapon(wi);
        }
      }
      // Restore economy currency
      if (data.currency !== undefined && typeof Economy !== 'undefined' && Economy.setCurrency) {
        Economy.setCurrency(data.currency);
      }
    } catch (_e) { /* noop */ }
    loadLeaderboard();
  }

  function reset() {
    stats = {
      totalKills: 0, headshots: 0, meleeKills: 0, droneKills: 0,
      vehicleKills: 0, longRangeKills: 0, explosiveMultis: 0,
      totalDamageDealt: 0, totalDamageTaken: 0,
      shotsFired: 0, shotsHit: 0,
      wavesCleared: 0, flawlessWaves: 0, stagesCleared: 0,
      deathCount: 0, totalPlayTime: 0,
      structures: 0, blocksDestroyed: 0,
      pickupsCollected: 0, okCEarned: 0,
      longestStreak: 0, maxStreak: 0,
      favoriteWeapon: '', weaponKills: {},
      distanceTraveled: 0, lastPosition: null
    };
    activeDailies = [];
    dailyProgress = {};
    activeBounties = [];
    activeChallengeMode = null;
  }

  function init() {
    load();
    refreshDailies();
  }

  return {
    PRESTIGE, CHALLENGE_MODES, DAILY_CHALLENGES, BOUNTY_TEMPLATES,
    JOURNAL_CATEGORIES, CODEX_ENTRIES, ACHIEVEMENTS, SEASON_REWARDS,
    init, reset, save, load,
    // Prestige
    canPrestige, doPrestige, getPrestigeBonuses, getPrestigeLevel, getPrestigeIcon,
    // Dailies
    refreshDailies, getDailies, updateDailyStat,
    // Bounties
    generateBounties, updateBounty, getBounties,
    // Journal
    unlockJournalEntry, getJournal, getJournalByCategory, isEntryUnlocked,
    // Stats
    trackStat, trackWeaponKill, getStats, getAccuracy, getKDR,
    // Leaderboard
    submitScore, getLeaderboard,
    // Challenge modes
    setChallenge, getChallengeMode, getChallengeModifiers, clearChallenge,
    // Achievements
    checkAchievement, getAchievements, isAchievementUnlocked,
    // Season Pass
    addSeasonXP, getSeasonLevel, getSeasonRewards, isSeasonPremium,
    // Combat Rating
    calculateCombatRating,
    // Loadout Presets
    saveLoadout, loadLoadout, getLoadouts, deleteLoadout,
    // Stage persistence
    getHighestStage: function () { return _highestStage; },
    setHighestStage: function (s) { if (s > _highestStage) _highestStage = s; }
  };
})();
