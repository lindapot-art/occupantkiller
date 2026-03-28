/* ───────────────────────────────────────────────────────────────────────
   ECONOMY & RESOURCE SYSTEM — currencies, resources, trading
   ─────────────────────────────────────────────────────────────────────── */
const Economy = (function () {
  'use strict';

  /* ── Resource Types ──────────────────────────────────────────────── */
  const RESOURCE = Object.freeze({
    WOOD:        'wood',
    METAL:       'metal',
    ELECTRONICS: 'electronics',
    FUEL:        'fuel',
    STONE:       'stone',
    FOOD:        'food',
  });

  /* ── State ───────────────────────────────────────────────────────── */
  let currency = 500;
  const resources = {
    wood:        50,
    metal:       30,
    electronics: 10,
    fuel:        20,
    stone:       40,
    food:        60,
  };

  /* ── Production rates (per building per cycle) ───────────────────── */
  const PRODUCTION_RATES = {
    factory:   { metal: 5, electronics: 2 },
    lumberMill:{ wood: 8 },
    mine:      { stone: 6, metal: 3 },
    farm:      { food: 10 },
    refinery:  { fuel: 4 },
  };

  /* ── Resource values for trading ─────────────────────────────────── */
  const BASE_VALUE = {
    wood: 5, metal: 10, electronics: 25, fuel: 15, stone: 3, food: 4,
  };

  let marketMultiplier = 1.0;  // fluctuates with economy

  /* ── Init ────────────────────────────────────────────────────────── */
  function init() {
    currency = 500;
    resources.wood = 50;
    resources.metal = 30;
    resources.electronics = 10;
    resources.fuel = 20;
    resources.stone = 40;
    resources.food = 60;
    marketMultiplier = 1.0;
  }

  /* ── Resource Operations ─────────────────────────────────────────── */
  function add(type, amount) {
    if (type in resources) {
      resources[type] += amount;
      return true;
    }
    return false;
  }

  function spend(type, amount) {
    if (type in resources && resources[type] >= amount) {
      resources[type] -= amount;
      return true;
    }
    return false;
  }

  function has(type, amount) {
    return (resources[type] || 0) >= amount;
  }

  function hasMultiple(costs) {
    for (const [type, amount] of Object.entries(costs)) {
      if ((resources[type] || 0) < amount) return false;
    }
    return true;
  }

  function spendMultiple(costs) {
    if (!hasMultiple(costs)) return false;
    for (const [type, amount] of Object.entries(costs)) {
      resources[type] -= amount;
    }
    return true;
  }

  /* ── Currency ────────────────────────────────────────────────────── */
  function addCurrency(amount) { currency += amount; }
  function spendCurrency(amount) {
    if (currency >= amount) { currency -= amount; return true; }
    return false;
  }
  function getCurrency() { return currency; }

  /* ── Trading ─────────────────────────────────────────────────────── */
  function sellResource(type, amount) {
    if (!spend(type, amount)) return 0;
    const value = Math.floor(BASE_VALUE[type] * amount * marketMultiplier);
    currency += value;
    return value;
  }

  function buyResource(type, amount) {
    const cost = Math.ceil(BASE_VALUE[type] * amount * marketMultiplier * 1.2);
    if (currency < cost) return false;
    currency -= cost;
    add(type, amount);
    return cost;
  }

  /* ── Weekly economy update ───────────────────────────────────────── */
  function weeklyUpdate() {
    // Market fluctuation
    marketMultiplier = 0.7 + Math.random() * 0.6;

    // Feed NPCs
    const npcCount = NPCSystem.getCount();
    const foodNeeded = npcCount * 2;
    if (resources.food >= foodNeeded) {
      resources.food -= foodNeeded;
      // Feed all NPCs
      NPCSystem.getAll().forEach(npc => NPCSystem.feedNPC(npc.id, 40));
    } else {
      // Starvation: reduce morale
      NPCSystem.getAll().forEach(npc => {
        npc.morale = Math.max(0, npc.morale - 20);
        npc.hunger = Math.max(0, npc.hunger - 30);
      });
    }

    // Fuel consumption for drones/vehicles
    const activeDrones = DroneSystem.getActive().length;
    const fuelNeeded = activeDrones * 1;
    resources.fuel = Math.max(0, resources.fuel - fuelNeeded);
  }

  /* ── Production cycle (called by automation) ─────────────────────── */
  function produce(buildingType) {
    const rates = PRODUCTION_RATES[buildingType];
    if (!rates) return;
    for (const [res, amount] of Object.entries(rates)) {
      add(res, amount);
    }
  }

  /* ── Mission rewards ─────────────────────────────────────────────── */
  function missionReward(tier) {
    const rewards = {
      1: { currency: 100, wood: 10, metal: 5 },
      2: { currency: 250, metal: 15, electronics: 5 },
      3: { currency: 500, electronics: 15, fuel: 10 },
      4: { currency: 1000, metal: 30, electronics: 20, fuel: 15 },
    };
    const r = rewards[tier] || rewards[1];
    if (r.currency) currency += r.currency;
    for (const [res, amount] of Object.entries(r)) {
      if (res !== 'currency') add(res, amount);
    }
    return r;
  }

  /* ── Getters ─────────────────────────────────────────────────────── */
  function getResources() { return { ...resources }; }
  function getResource(type) { return resources[type] || 0; }
  function getMarketMultiplier() { return marketMultiplier; }

  function getSummary() {
    return {
      currency,
      resources: { ...resources },
      market: marketMultiplier,
    };
  }

  return {
    RESOURCE,
    init,
    add,
    spend,
    has,
    hasMultiple,
    spendMultiple,
    addCurrency,
    spendCurrency,
    getCurrency,
    sellResource,
    buyResource,
    weeklyUpdate,
    produce,
    missionReward,
    getResources,
    getResource,
    getMarketMultiplier,
    getSummary,
  };
})();
