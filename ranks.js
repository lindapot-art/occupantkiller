/* ───────────────────────────────────────────────────────────────────────
   RANK & PROGRESSION SYSTEM — player ranks with unlock tiers
   ─────────────────────────────────────────────────────────────────────── */
const RankSystem = (function () {
  'use strict';

  const RANKS = [
    {
      id: 'recruit',
      name: 'Recruit',
      xpRequired: 0,
      unlocks: ['pistol', 'basic_building'],
      maxSquad: 0,
      maxDrones: 0,
      icon: '⬜',
    },
    {
      id: 'operator',
      name: 'Operator',
      xpRequired: 500,
      unlocks: ['shotgun', 'smg', 'recon_drone'],
      maxSquad: 2,
      maxDrones: 1,
      icon: '🟩',
    },
    {
      id: 'squad_leader',
      name: 'Squad Leader',
      xpRequired: 2000,
      unlocks: ['sniper', 'fpv_drone', 'barracks', 'factory'],
      maxSquad: 5,
      maxDrones: 2,
      icon: '🟦',
    },
    {
      id: 'commander',
      name: 'Commander',
      xpRequired: 6000,
      unlocks: ['bomb_drone', 'turret', 'command_center', 'vehicles'],
      maxSquad: 10,
      maxDrones: 4,
      icon: '🟪',
    },
    {
      id: 'strategist',
      name: 'Strategist',
      xpRequired: 15000,
      unlocks: ['strategic_view', 'surveillance_drone', 'automation', 'missions'],
      maxSquad: 20,
      maxDrones: 8,
      icon: '🟧',
    },
    {
      id: 'warlord',
      name: 'Warlord',
      xpRequired: 40000,
      unlocks: ['all_weapons', 'all_buildings', 'all_drones', 'nft_layer'],
      maxSquad: 50,
      maxDrones: 16,
      icon: '🟥',
    },
  ];

  /* ── State ───────────────────────────────────────────────────────── */
  let totalXP   = 0;
  let rankIndex = 0;

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    totalXP = 0;
    rankIndex = 0;
  }

  /* ── XP ──────────────────────────────────────────────────────────── */
  function addXP(amount) {
    totalXP += amount;
    // Check for rank up
    while (rankIndex < RANKS.length - 1 && totalXP >= RANKS[rankIndex + 1].xpRequired) {
      rankIndex++;
    }
    return RANKS[rankIndex];
  }

  /* ── XP Sources ──────────────────────────────────────────────────── */
  function onKill(isHeadshot)     { addXP(isHeadshot ? 30 : 15); }
  function onWaveComplete(wave)   { addXP(50 + wave * 20); }
  function onBuild()              { addXP(20); }
  function onMissionComplete(tier){ addXP(tier * 100); }
  function onDroneOp()            { addXP(10); }

  /* ── Getters ─────────────────────────────────────────────────────── */
  function getRank()     { return RANKS[rankIndex]; }
  function getRankName() { return RANKS[rankIndex].name; }
  function getRankIcon() { return RANKS[rankIndex].icon; }
  function getTotalXP()  { return totalXP; }
  function getRankIndex(){ return rankIndex; }

  function getNextRank() {
    if (rankIndex >= RANKS.length - 1) return null;
    return RANKS[rankIndex + 1];
  }

  function getProgress() {
    const current = RANKS[rankIndex].xpRequired;
    const next = rankIndex < RANKS.length - 1 ? RANKS[rankIndex + 1].xpRequired : totalXP;
    const denom = next - current;
    return {
      current: totalXP - current,
      needed: denom,
      percent: denom > 0 ? Math.min(100, ((totalXP - current) / denom) * 100) : 100,
    };
  }

  function isUnlocked(feature) {
    for (let i = 0; i <= rankIndex; i++) {
      if (RANKS[i].unlocks.includes(feature)) return true;
    }
    return false;
  }

  function getMaxSquad() { return RANKS[rankIndex].maxSquad; }
  function getMaxDrones(){ return RANKS[rankIndex].maxDrones; }

  function getAllRanks() { return RANKS; }

  return {
    RANKS,
    init,
    addXP,
    onKill,
    onWaveComplete,
    onBuild,
    onMissionComplete,
    onDroneOp,
    getRank,
    getRankName,
    getRankIcon,
    getTotalXP,
    getRankIndex,
    getNextRank,
    getProgress,
    isUnlocked,
    getMaxSquad,
    getMaxDrones,
    getAllRanks,
  };
})();
