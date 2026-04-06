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
    if (typeof NPCSystem !== 'undefined' && NPCSystem.getCount && NPCSystem.getAll) {
      const npcCount = NPCSystem.getCount();
      const foodNeeded = npcCount * 2;
      if (resources.food >= foodNeeded) {
        resources.food -= foodNeeded;
        // Feed all NPCs
        NPCSystem.getAll().forEach(function (npc) { if (NPCSystem.feedNPC) NPCSystem.feedNPC(npc.id, 40); });
      } else {
        // Starvation: reduce morale
        NPCSystem.getAll().forEach(function (npc) {
          npc.morale = Math.max(0, npc.morale - 20);
          npc.hunger = Math.max(0, npc.hunger - 30);
        });
      }
    }

    // Fuel consumption for drones/vehicles
    if (typeof DroneSystem !== 'undefined' && DroneSystem.getActive) {
      const activeDrones = DroneSystem.getActive().length;
      const fuelNeeded = activeDrones * 1;
      resources.fuel = Math.max(0, resources.fuel - fuelNeeded);
    }
  }

  /* ── Production cycle (called by automation) ─────────────────────── */
  function produce(buildingType) {
    // If no buildingType given, produce for ALL placed buildings
    if (!buildingType) {
      if (typeof Building !== 'undefined' && Building.getStructures) {
        const structs = Building.getStructures();
        for (let i = 0; i < structs.length; i++) {
          const key = structs[i].autoType || structs[i].template.toLowerCase().replace(/\s+/g, '');
          const rates = PRODUCTION_RATES[key];
          if (rates) {
            for (const [res, amount] of Object.entries(rates)) {
              add(res, amount);
            }
          }
        }
      }
      return;
    }
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

  /* ── Black Market System ──────────────────────────────────────────── */
  const CONTRABAND = [
    { name: 'Rare Ammo',           effect: 'reserve_ammo', value: 50,  price: 300,  desc: '+50 reserve ammo' },
    { name: 'Stolen Intel',        effect: 'reveal_enemies', value: 1, price: 500,  desc: 'Reveals enemies on minimap' },
    { name: 'Smuggled Armor',      effect: 'armor',        value: 50,  price: 200,  desc: '+50 armor' },
    { name: 'Black Market Weapon', effect: 'weapon_unlock', value: 1,  price: 1000, desc: 'Random weapon unlock' },
    { name: 'Stim Pack',           effect: 'speed_boost',  value: 30,  price: 150,  desc: 'Speed boost 30s' },
    { name: 'EMP Device',          effect: 'emp_stun',     value: 5,   price: 600,  desc: 'Stun all enemies 5s' },
    { name: 'Counterfeit ID',      effect: 'reduce_detection', value: 0.5, price: 400, desc: 'Reduces enemy detection range' },
    { name: 'Illegal Mods',        effect: 'weapon_attachment', value: 1, price: 350, desc: 'Random weapon attachment' },
  ];

  let blackMarketStock = [];

  function refreshBlackMarket() {
    blackMarketStock = [];
    const pool = CONTRABAND.slice();
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      blackMarketStock.push({ ...pool[idx], sold: false });
      pool.splice(idx, 1);
    }
    return blackMarketStock;
  }

  function buyContraband(index) {
    if (index < 0 || index >= blackMarketStock.length) return null;
    const item = blackMarketStock[index];
    if (!item || item.sold) return null;
    if (currency < item.price) return null;
    currency -= item.price;
    item.sold = true;
    return { effect: item.effect, value: item.value, name: item.name };
  }

  /* ── Resource Scarcity Events ─────────────────────────────────────── */
  const SCARCITY_EVENTS = [
    { name: 'Supply Shortage',  effect: 'production_mult', value: 0.5,  desc: '-50% production' },
    { name: 'Trade Boom',       effect: 'sell_mult',       value: 1.3,  desc: '+30% sell prices' },
    { name: 'Fuel Crisis',      effect: 'fuel_cost_mult',  value: 2.0,  desc: 'Fuel cost x2' },
    { name: 'Arms Deal',        effect: 'weapon_price_mult', value: 0.75, desc: 'Weapon prices -25%' },
    { name: 'Refugee Wave',     effect: 'food_consumption_mult', value: 2.0, desc: 'Food consumption x2' },
    { name: 'Foreign Aid',      effect: 'bonus_resource',  value: 100,  desc: '+100 of random resource' },
  ];

  let activeEvent = null;

  function triggerRandomEvent() {
    const evt = SCARCITY_EVENTS[Math.floor(Math.random() * SCARCITY_EVENTS.length)];
    activeEvent = { ...evt, startedAt: Date.now() };
    if (evt.effect === 'bonus_resource') {
      const keys = Object.keys(resources);
      const key = keys[Math.floor(Math.random() * keys.length)];
      resources[key] += evt.value;
      activeEvent.bonusType = key;
    }
    return activeEvent;
  }

  function getActiveEvent() {
    return activeEvent ? { ...activeEvent } : null;
  }

  /* ── Investment System ────────────────────────────────────────────── */
  const investments = [];

  const INVESTMENT_PROFILES = {
    safe:     { returnRate: 0.05, lossChance: 0 },
    moderate: { returnRate: 0.15, lossChance: 0.15 },
    risky:    { returnRate: 0.40, lossChance: 0.40 },
  };

  function invest(amount, risk) {
    const profile = INVESTMENT_PROFILES[risk];
    if (!profile) return null;
    if (amount <= 0 || currency < amount) return null;
    currency -= amount;
    const entry = { amount, risk, returnRate: profile.returnRate, lossChance: profile.lossChance, pending: true };
    investments.push(entry);
    return entry;
  }

  function processInvestments() {
    const results = [];
    for (let i = investments.length - 1; i >= 0; i--) {
      const inv = investments[i];
      if (!inv.pending) continue;
      inv.pending = false;
      const lost = Math.random() < inv.lossChance;
      if (lost) {
        const lostAmount = Math.floor(inv.amount * (0.5 + Math.random() * 0.5));
        const returned = inv.amount - lostAmount;
        currency += returned;
        results.push({ amount: inv.amount, risk: inv.risk, outcome: 'loss', returned });
      } else {
        const gained = Math.floor(inv.amount * inv.returnRate);
        currency += inv.amount + gained;
        results.push({ amount: inv.amount, risk: inv.risk, outcome: 'profit', gained, returned: inv.amount + gained });
      }
      investments.splice(i, 1);
    }
    return results;
  }

  function getInvestments() {
    return investments.map(inv => ({ ...inv }));
  }

  /* ── Bounty Board ────────────────────────────────────────────────── */
  const BOUNTY_TEMPLATES = [
    { type: 'headshot_kills', target: 10, reward: 200, desc: 'Kill 10 with headshots' },
    { type: 'melee_kills',    target: 5,  reward: 150, desc: 'Kill 5 with melee' },
    { type: 'long_range_kills', target: 3, reward: 250, desc: 'Kill 3 from >30m' },
    { type: 'boss_kill',      target: 1,  reward: 500, desc: 'Kill a boss' },
    { type: 'wave_kills',     target: 20, reward: 300, desc: 'Kill 20 enemies in one wave' },
    { type: 'kill_streak',    target: 5,  reward: 200, desc: 'Get a 5-kill streak' },
  ];

  let activeBounties = [];

  function generateBounties() {
    activeBounties = [];
    const pool = BOUNTY_TEMPLATES.slice();
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      activeBounties.push({ ...pool[idx], progress: 0, completed: false });
      pool.splice(idx, 1);
    }
    return activeBounties;
  }

  function updateBounty(type, value) {
    const results = [];
    for (const bounty of activeBounties) {
      if (bounty.completed || bounty.type !== type) continue;
      bounty.progress += value;
      if (bounty.progress >= bounty.target) {
        bounty.progress = bounty.target;
        bounty.completed = true;
        currency += bounty.reward;
        results.push({ type: bounty.type, reward: bounty.reward, desc: bounty.desc });
      }
    }
    return results;
  }

  function getBounties() {
    return activeBounties.map(b => ({ ...b }));
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
    // Black Market
    CONTRABAND,
    blackMarketStock,
    refreshBlackMarket,
    buyContraband,
    // Resource Scarcity
    SCARCITY_EVENTS,
    triggerRandomEvent,
    getActiveEvent,
    // Investments
    invest,
    processInvestments,
    getInvestments,
    // Bounty Board
    BOUNTY_TEMPLATES,
    generateBounties,
    updateBounty,
    getBounties,
  };
})();
