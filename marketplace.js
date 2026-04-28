/* ───────────────────────────────────────────────────────────────────────
   MARKETPLACE — Buy/sell weapons, ammo, items for POL & in-game currency
   Depends on: Blockchain, Economy, Weapons
   ─────────────────────────────────────────────────────────────────────── */
const Marketplace = (function () {
  'use strict';

  /* ── Game Wallet (receives POL from item sales) ────────────────── */
  const GAME_WALLET = '0x165CD37b4C644C2921454429E7F9358d18A45e14';

  /* ── In-Game Currency: OKC (Occupant Killer Coin) ──────────────── */
  let okcBalance = 0;

  /* ── OKC Exchange Rate (1 POL = this many OKC) ─────────────────── */
  const OKC_PER_POL = 1000;

  /* ── Earn Rates ────────────────────────────────────────────────── */
  const EARN_RATES = {
    kill:        5,     // OKC per enemy kill
    headshot:    15,    // OKC per headshot
    wave:        50,    // OKC per wave clear
    stage:       200,   // OKC per stage clear
    streak3:     10,    // bonus at 3-kill streak
    streak5:     25,    // bonus at 5-kill streak
    streak10:    75,    // bonus at 10-kill streak
    dailyLogin:  100,   // OKC daily login bonus
    mission:     30,    // OKC per mission complete
  };

  /* ── Weapon Sale Prices (in OKC) ───────────────────────────────── */
  const WEAPON_PRICES_OKC = {
    SHOVEL:      0,      // can't sell starter
    MAKAROV:     0,      // can't sell starter
    AK74:        150,
    RPK74:       200,
    SVD:         350,
    PKM:         250,
    NLAW:        500,
    STUGNA:      800,
    M4A1:        300,
    JAVELIN:     1200,
    RPG7:        400,
    IGLA:        600,
    GP25:        250,
    SCARH:       350,
    DSHK:        400,
    MOLOTOV:     100,
    MG3:         300,
    MP5:         180,
    BARRETTM82:  600,
    MINIGUN:     800,
    CROSSBOW:    200,
    FLAMETHROWER:500,
    DOUBLEBARREL:150,
    CLAYMORE:    200,
    SMOKE:       80,
    FLASHBANG:   80,
  };

  /* ── Weapon Sale Prices (in POL crypto) ────────────────────────── */
  const WEAPON_PRICES_POL = {};
  (function () {
    for (var id in WEAPON_PRICES_OKC) {
      WEAPON_PRICES_POL[id] = WEAPON_PRICES_OKC[id] > 0
        ? parseFloat((WEAPON_PRICES_OKC[id] / OKC_PER_POL).toFixed(4))
        : 0;
    }
  })();

  /* ── Ammo Prices (per unit) ────────────────────────────────────── */
  const AMMO_PRICE_OKC = 2;    // 2 OKC per ammo unit
  const AMMO_PRICE_POL = 0.002; // 0.002 POL per ammo unit

  /* ── Item Shop (buy with OKC) ──────────────────────────────────── */
  const SHOP_ITEMS = [
    { id: 'ammo_pack_small',  name: 'Ammo Pack (50)',     okcCost: 50,   polCost: 0.05,  type: 'ammo',    value: 50 },
    { id: 'ammo_pack_large',  name: 'Ammo Pack (200)',    okcCost: 180,  polCost: 0.18,  type: 'ammo',    value: 200 },
    { id: 'health_kit',       name: 'Health Kit',         okcCost: 40,   polCost: 0.04,  type: 'health',  value: 50 },
    { id: 'full_heal',        name: 'Full Heal',          okcCost: 100,  polCost: 0.10,  type: 'health',  value: 100 },
    { id: 'armor_plate',      name: 'Armor Plate (+25)',  okcCost: 60,   polCost: 0.06,  type: 'armor',   value: 25 },
    { id: 'stim_pack',        name: 'Stim Pack',          okcCost: 35,   polCost: 0.035, type: 'stim',    value: 1 },
    { id: 'airdrop_beacon',   name: 'Airdrop Beacon',     okcCost: 80,   polCost: 0.08,  type: 'airdrop', value: 1 },
    { id: 'grenade_pack',     name: 'Grenade Pack (x3)',  okcCost: 45,   polCost: 0.045, type: 'grenade', value: 3 },
  ];

  /* ── Premium Subscriptions ─────────────────────────────────────── */
  const PREMIUM_TIERS = [
    {
      id: 'premium_bronze',
      name: '🥉 BRONZE PASS',
      polCost: 1.0,
      okcCost: 1000,
      duration: 30, // days
      perks: [
        '2x OKC earning rate',
        'Bronze player tag',
        '10% shop discount',
        'Exclusive bronze weapon skins',
      ],
      earnMultiplier: 2.0,
      shopDiscount: 0.10,
    },
    {
      id: 'premium_silver',
      name: '🥈 SILVER PASS',
      polCost: 3.0,
      okcCost: 2500,
      duration: 30,
      perks: [
        '3x OKC earning rate',
        'Silver player tag',
        '20% shop discount',
        'Exclusive silver weapon skins',
        'Priority matchmaking',
      ],
      earnMultiplier: 3.0,
      shopDiscount: 0.20,
    },
    {
      id: 'premium_gold',
      name: '🥇 GOLD PASS',
      polCost: 5.0,
      okcCost: 4000,
      duration: 30,
      perks: [
        '5x OKC earning rate',
        'Gold player tag',
        '30% shop discount',
        'All exclusive weapon skins',
        'Priority matchmaking',
        'Exclusive gold stages',
        'VIP support',
      ],
      earnMultiplier: 5.0,
      shopDiscount: 0.30,
    },
  ];

  /* ── Premium State ─────────────────────────────────────────────── */
  let activePremium = null;  // { tier, expiresAt, durationKey }

  /* ── Premium Subscription Durations (WoT-style flexible billing) ─
     Each duration is a price multiplier on the base 30-day tier cost.
     1-day = 5% (5x daily premium), week = 25%, month = 100% (base),
     90-day = 270% (10% off), year = 950% (~21% off). */
  const PREMIUM_DURATIONS = [
    { key: 'day',     label: '1 Day',    days: 1,   priceMult: 0.05 },
    { key: 'week',    label: '1 Week',   days: 7,   priceMult: 0.25 },
    { key: 'month',   label: '1 Month',  days: 30,  priceMult: 1.00 },
    { key: 'quarter', label: '3 Months', days: 90,  priceMult: 2.70 },
    { key: 'year',    label: '1 Year',   days: 365, priceMult: 9.50 },
  ];

  function getPremiumDurations() { return PREMIUM_DURATIONS.slice(); }

  function getPremiumPriceFor(tierIdx, durationKey) {
    var tier = PREMIUM_TIERS[tierIdx];
    var dur  = PREMIUM_DURATIONS.find(function (d) { return d.key === durationKey; });
    if (!tier || !dur) return null;
    return {
      polCost: parseFloat((tier.polCost * dur.priceMult).toFixed(4)),
      okcCost: Math.ceil(tier.okcCost * dur.priceMult),
      days:    dur.days,
      label:   dur.label,
    };
  }

  /* ── Premium Ammo (WoT-style consumable boost rounds) ────────────
     Each pack contains N rounds. While equipped, every shot consumes
     one round and applies the pack's damage/penetration multiplier.
     When pack is empty, it auto-unequips and the weapon falls back to
     standard ammo. Compatible weapon classes are checked at equip. */
  const PREMIUM_AMMO = [
    { id: 'AMMO_AP',   name: '🔩 AP Rounds (Armor-Piercing)',  damageMult: 1.50, penMult: 2.00, packSize: 30, polCost: 0.10, okcCost: 100, weaponTypes: ['ASSAULT','NATO','SNIPER','LMG','HMG','MACHINEGUN','AMR','MINIGUN','GATLING','SILENT'] },
    { id: 'AMMO_HE',   name: '💥 HE Rounds (High-Explosive)',  damageMult: 1.80, penMult: 1.20, packSize: 20, polCost: 0.15, okcCost: 150, weaponTypes: ['ASSAULT','NATO','LMG','MACHINEGUN','GRENADE','AT','ATGM','AA','THERMOBARIC'] },
    { id: 'AMMO_HEAT', name: '🔥 HEAT Rounds (Anti-Tank)',     damageMult: 2.50, penMult: 3.00, packSize: 5,  polCost: 0.40, okcCost: 400, weaponTypes: ['AT','ATGM','THERMOBARIC','SNIPER','AMR'] },
    { id: 'AMMO_GOLD', name: '🥇 GOLD Rounds (Premium APCR)',  damageMult: 2.00, penMult: 2.50, packSize: 25, polCost: 0.50, okcCost: 500, weaponTypes: ['ASSAULT','NATO','SNIPER','LMG','HMG','MACHINEGUN','PISTOL','SMG','AMR','MINIGUN','GATLING','SILENT','SHOTGUN'] },
    { id: 'AMMO_INC',  name: '🔥 Incendiary Rounds',           damageMult: 1.30, penMult: 1.00, packSize: 40, polCost: 0.08, okcCost: 80,  weaponTypes: ['ASSAULT','NATO','SMG','LMG','MACHINEGUN','PISTOL','MINIGUN','SHOTGUN','SILENT'] },
    { id: 'AMMO_TRACER',name:'✨ Tracer Rounds (+visibility)', damageMult: 1.10, penMult: 1.10, packSize: 50, polCost: 0.05, okcCost: 50,  weaponTypes: ['ASSAULT','NATO','SMG','LMG','HMG','MACHINEGUN','MINIGUN','GATLING'] },
  ];

  /* Inventory: { AMMO_AP: roundsRemaining, ... } */
  let premiumAmmoInv = {};
  /* Currently equipped pack id, or null */
  let activeAmmoId = null;

  /* ── Game Assets (NFT-like purchasable content) ────────────────── */
  const GAME_ASSETS = [
    { id: 'skin_gold_ak',     name: '🌟 Gold AK-74 Skin',       polCost: 2.0,  okcCost: 2000, type: 'skin',  weapon: 'AK74' },
    { id: 'skin_camo_m4',     name: '🌿 Camo M4A1 Skin',        polCost: 1.5,  okcCost: 1500, type: 'skin',  weapon: 'M4A1' },
    { id: 'skin_fire_svd',    name: '🔥 Fire SVD Skin',          polCost: 2.5,  okcCost: 2500, type: 'skin',  weapon: 'SVD' },
    { id: 'emote_victory',    name: '🎉 Victory Dance Emote',    polCost: 0.5,  okcCost: 500,  type: 'emote' },
    { id: 'emote_salute',     name: '🫡 Ukrainian Salute Emote', polCost: 0.5,  okcCost: 500,  type: 'emote' },
    { id: 'title_legend',     name: '👑 Legend Title',            polCost: 3.0,  okcCost: 3000, type: 'title' },
    { id: 'title_hero',       name: '🏅 Hero of Ukraine Title',  polCost: 5.0,  okcCost: 5000, type: 'title' },
    { id: 'trail_blue_fire',  name: '💙 Blue Fire Trail',        polCost: 1.0,  okcCost: 1000, type: 'trail' },
    { id: 'trail_gold_sparks',name: '✨ Gold Sparks Trail',      polCost: 1.0,  okcCost: 1000, type: 'trail' },
  ];

  let ownedAssets = [];

  /* ── NFT CLUB — off-chain ledger (smart contracts deferred) ────
     The Occupant Killer NFT Club: tiered membership that mirrors
     what will later become real Polygon ERC-1155 tokens minted from
     the admin panel. For now, all state lives in this module and
     persists via localStorage; the admin can flip it on-chain once
     contracts are deployed. */
  const NFT_CLUB_TIERS = [
    {
      id: 'club_recruit',
      name: '🪖 Recruit',
      polCost: 0,
      okcCost: 0,
      monthlyOkc: 0,
      perks: ['Free entry tier', 'Profile badge', 'Eligible for future airdrops'],
      earnMultiplier: 1.0,
      maxSupply: 0,
    },
    {
      id: 'club_knight',
      name: '⚔ Bronze Knight',
      polCost: 2.0,
      okcCost: 2000,
      monthlyOkc: 250,
      perks: ['+25% OKC earn rate', '500 OKC monthly drop', 'Bronze profile frame', 'Exclusive Hostomel skin'],
      earnMultiplier: 1.25,
      maxSupply: 5000,
    },
    {
      id: 'club_cossack',
      name: '🐎 Silver Cossack',
      polCost: 5.0,
      okcCost: 5000,
      monthlyOkc: 750,
      perks: ['+50% OKC earn rate', '1500 OKC monthly drop', 'Silver profile frame', 'Exclusive Bakhmut skin', 'Voting rights on next stage'],
      earnMultiplier: 1.5,
      maxSupply: 1500,
    },
    {
      id: 'club_ataman',
      name: '👑 Gold Ataman',
      polCost: 12.0,
      okcCost: 12000,
      monthlyOkc: 2000,
      perks: ['+100% OKC earn rate', '4000 OKC monthly drop', 'Gold profile frame', 'All exclusive skins', 'Voting + roadmap input', 'Founder credit in-game'],
      earnMultiplier: 2.0,
      maxSupply: 250,
    },
  ];

  /* Active club membership: { tierId, joinedAt, lastDropAt } */
  let clubMembership = null;

  /* Off-chain NFT ledger (soulbound badges). Each entry:
     { id, name, kind, mintedAt, stageId?, txRef? } */
  let ownedNfts = [];
  const NFT_BADGES = {
    veteran_kyiv:    { id: 'veteran_kyiv',    name: '🇺🇦 Veteran of Kyiv 2022',   kind: 'badge', stageId: 13 },
    veteran_hostomel:{ id: 'veteran_hostomel',name: '🪂 Hero of Hostomel',         kind: 'badge', stageId: 0  },
    veteran_bakhmut: { id: 'veteran_bakhmut', name: '🛡 Bakhmut Defender',         kind: 'badge', stageId: 2  },
    veteran_kremlin: { id: 'veteran_kremlin', name: '🏛 Kremlin Liberator',        kind: 'badge', stageId: 11 },
    founder_2026:    { id: 'founder_2026',    name: '⭐ Founder 2026',             kind: 'badge' },
  };

  /* ── Transaction History ───────────────────────────────────────── */
  let txHistory = [];
  const MAX_HISTORY = 50;
  let dynamicAssets = null;
  let backendReady = false;
  let apiFailCount = 0;
  let apiBackoffUntil = 0;

  function hasApi() {
    return (typeof ApiClient !== 'undefined' && ApiClient);
  }

  function canUseApi() {
    return hasApi() && Date.now() >= apiBackoffUntil;
  }

  function markApiFailure() {
    apiFailCount += 1;
    if (apiFailCount >= 3) {
      apiBackoffUntil = Date.now() + 60000;
      apiFailCount = 0;
    }
  }

  function markApiSuccess() {
    apiFailCount = 0;
    apiBackoffUntil = 0;
  }

  async function initBackendSync() {
    if (!canUseApi()) return false;
    if (backendReady) return true;
    try {
      ApiClient.init();
      var profile = await ApiClient.auth();
      if (profile && profile.stats && typeof profile.stats.okc_balance === 'number') {
        okcBalance = Math.floor(profile.stats.okc_balance);
      }
      await refreshCatalog();
      backendReady = true;
      markApiSuccess();
      return true;
    } catch (_) {
      markApiFailure();
      return false;
    }
  }

  async function refreshFromBackend() {
    if (!canUseApi()) return null;
    try {
      await initBackendSync();
      var profile = await ApiClient.profile();
      if (profile && profile.stats && typeof profile.stats.okc_balance === 'number') {
        okcBalance = Math.floor(profile.stats.okc_balance);
      }
      markApiSuccess();
      return profile;
    } catch (_) {
      markApiFailure();
      return null;
    }
  }

  async function refreshCatalog() {
    if (!canUseApi()) return null;
    try {
      var cat = await ApiClient.catalog();
      if (!cat || !Array.isArray(cat.items)) return null;
      dynamicAssets = cat.items.map(function (it) {
        var polCost = 0;
        if (it.price_pol_wei != null) {
          var weiNum = Number(it.price_pol_wei);
          if (Number.isFinite(weiNum) && weiNum > 0) polCost = weiNum / 1e18;
        }
        return {
          id: String(it.token_id),
          name: it.label || ('Asset #' + it.token_id),
          polCost: polCost,
          okcCost: Number(it.price_okc || 0),
          type: 'cosmetic',
          tokenId: String(it.token_id),
          rarity: Number(it.rarity || 0),
          bonusBps: Number(it.bonus_bps || 0),
          itemType: Number(it.item_type || 0),
          weapon: it.weapon_key || null,
        };
      });
      markApiSuccess();
      return dynamicAssets;
    } catch (_) {
      markApiFailure();
      return null;
    }
  }

  function _earnViaApi(reason, count) {
    if (!canUseApi()) return;
    ApiClient.earn(reason, count || 1).then(function (r) {
      if (r && typeof r.balance === 'number') okcBalance = Math.floor(r.balance);
      markApiSuccess();
    }).catch(function () {
      markApiFailure();
      /* keep local fallback if backend is unavailable */
    });
  }

  async function awardCustomOKC(amount, reason, meta) {
    var amt = Math.floor(Number(amount) || 0);
    if (amt <= 0) return 0;

    // Backend-first: when API is available, use exact amount grant to avoid drift.
    if (canUseApi() && ApiClient.grantOkc) {
      try {
        await initBackendSync();
        var r = await ApiClient.grantOkc(amt, reason || 'custom', meta || null);
        if (r && typeof r.balance === 'number') okcBalance = Math.floor(r.balance);
        addTx('earn', '+' + amt + ' OKC', amt, 'OKC');
        markApiSuccess();
        return amt;
      } catch (_) {
        markApiFailure();
      }
    }

    // Offline fallback: preserve gameplay reward responsiveness.
    return addOKC(amt);
  }

  function addTx(type, desc, amount, currency) {
    txHistory.unshift({ type: type, desc: desc, amount: amount, currency: currency, time: Date.now() });
    if (txHistory.length > MAX_HISTORY) txHistory.pop();
  }

  /* ── OKC Currency Operations ───────────────────────────────────── */
  function addOKC(amount) {
    var mult = getEarnMultiplier();
    var earned = Math.floor(amount * mult);
    okcBalance += earned;
    addTx('earn', '+' + earned + ' OKC', earned, 'OKC');
    return earned;
  }

  function spendOKC(amount) {
    var cost = getDiscountedPrice(amount);
    if (okcBalance >= cost) {
      okcBalance -= cost;
      addTx('spend', '-' + cost + ' OKC', -cost, 'OKC');
      return true;
    }
    return false;
  }

  function getOKC()    { return okcBalance; }
  function setOKC(val) { okcBalance = val; }

  /* ── Premium Helpers ───────────────────────────────────────────── */
  function getEarnMultiplier() {
    var mult = 1.0;
    if (activePremium && activePremium.expiresAt > Date.now()) {
      mult *= activePremium.tier.earnMultiplier;
    }
    if (clubMembership) {
      var ct = NFT_CLUB_TIERS.find(function (x) { return x.id === clubMembership.tierId; });
      if (ct) mult *= ct.earnMultiplier;
    }
    return mult;
  }

  function getShopDiscount() {
    if (activePremium && activePremium.expiresAt > Date.now()) {
      return activePremium.tier.shopDiscount;
    }
    return 0;
  }

  function getDiscountedPrice(basePrice) {
    return Math.ceil(basePrice * (1 - getShopDiscount()));
  }

  function isPremium() {
    return activePremium && activePremium.expiresAt > Date.now();
  }

  function getPremiumInfo() {
    if (!isPremium()) return null;
    return {
      name:      activePremium.tier.name,
      expiresAt: activePremium.expiresAt,
      daysLeft:  Math.ceil((activePremium.expiresAt - Date.now()) / 86400000),
    };
  }

  /* ── Purchase Premium Subscription ─────────────────────────────── */
  function _grantPremium(tier, durationDays, durationKey) {
    /* Stack: if already premium of same tier, EXTEND. Else replace. */
    var addMs = durationDays * 86400000;
    var base  = (activePremium && activePremium.tier.id === tier.id && activePremium.expiresAt > Date.now())
                ? activePremium.expiresAt : Date.now();
    activePremium = { tier: tier, expiresAt: base + addMs, durationKey: durationKey || 'month' };
  }

  async function buyPremiumWithPOL(tierIdx, durationKey) {
    var tier = PREMIUM_TIERS[tierIdx];
    if (!tier) return false;
    if (!Blockchain.isConnected()) { return false; }
    var price = durationKey ? getPremiumPriceFor(tierIdx, durationKey)
                            : { polCost: tier.polCost, days: tier.duration, label: tier.name };
    if (!price) return false;
    var result = await Blockchain.purchaseWithDonation(GAME_WALLET, price.polCost);
    if (result) {
      _grantPremium(tier, price.days, durationKey || 'month');
      addTx('premium', 'Purchased ' + tier.name + ' (' + (price.label || price.days + 'd') + ')', -price.polCost, 'POL');
      return true;
    }
    return false;
  }

  function buyPremiumWithOKC(tierIdx, durationKey) {
    var tier = PREMIUM_TIERS[tierIdx];
    if (!tier) return false;
    var price = durationKey ? getPremiumPriceFor(tierIdx, durationKey)
                            : { okcCost: tier.okcCost, days: tier.duration, label: tier.name };
    if (!price) return false;
    if (okcBalance >= price.okcCost) {
      okcBalance -= price.okcCost;
      _grantPremium(tier, price.days, durationKey || 'month');
      addTx('premium', 'Purchased ' + tier.name + ' (' + (price.label || price.days + 'd') + ')', -price.okcCost, 'OKC');
      return true;
    }
    return false;
  }

  /* ── Premium Ammo Operations ─────────────────────────────────── */
  function getPremiumAmmoTypes() { return PREMIUM_AMMO.slice(); }
  function getPremiumAmmoInv()   { return Object.assign({}, premiumAmmoInv); }
  function getActiveAmmoId()     { return activeAmmoId; }
  function getActiveAmmoInfo() {
    if (!activeAmmoId) return null;
    var def = PREMIUM_AMMO.find(function (a) { return a.id === activeAmmoId; });
    if (!def) return null;
    return {
      id: def.id, name: def.name, damageMult: def.damageMult, penMult: def.penMult,
      remaining: premiumAmmoInv[def.id] || 0,
      weaponTypes: def.weaponTypes.slice(),
    };
  }

  function buyPremiumAmmoWithOKC(typeId, packs) {
    packs = Math.max(1, packs|0 || 1);
    var def = PREMIUM_AMMO.find(function (a) { return a.id === typeId; });
    if (!def) return false;
    var cost = def.okcCost * packs;
    if (okcBalance < cost) return false;
    okcBalance -= cost;
    premiumAmmoInv[def.id] = (premiumAmmoInv[def.id] || 0) + def.packSize * packs;
    addTx('ammo', 'Bought ' + packs + 'x ' + def.name + ' (' + (def.packSize * packs) + ' rds)', -cost, 'OKC');
    return true;
  }

  async function buyPremiumAmmoWithPOL(typeId, packs) {
    packs = Math.max(1, packs|0 || 1);
    var def = PREMIUM_AMMO.find(function (a) { return a.id === typeId; });
    if (!def) return false;
    if (typeof Blockchain === 'undefined' || !Blockchain.isConnected()) return false;
    var cost = parseFloat((def.polCost * packs).toFixed(4));
    var ok = await Blockchain.purchaseWithDonation(GAME_WALLET, cost);
    if (!ok) return false;
    premiumAmmoInv[def.id] = (premiumAmmoInv[def.id] || 0) + def.packSize * packs;
    addTx('ammo', 'Bought ' + packs + 'x ' + def.name + ' (' + (def.packSize * packs) + ' rds)', -cost, 'POL');
    return true;
  }

  function equipPremiumAmmo(typeId) {
    if (typeId === null) { activeAmmoId = null; return true; }
    var def = PREMIUM_AMMO.find(function (a) { return a.id === typeId; });
    if (!def) return false;
    if ((premiumAmmoInv[def.id] || 0) <= 0) return false;
    activeAmmoId = def.id;
    return true;
  }

  function _isAmmoCompatible(weaponType) {
    if (!activeAmmoId) return false;
    var def = PREMIUM_AMMO.find(function (a) { return a.id === activeAmmoId; });
    if (!def) return false;
    return def.weaponTypes.indexOf(weaponType) >= 0;
  }

  /* Returns multiplier for current shot AND consumes one round if applicable.
     Called by Weapons.getDamage() per shot. */
  function consumeAmmoShot(weaponType) {
    if (!activeAmmoId) return 1.0;
    if (!_isAmmoCompatible(weaponType)) return 1.0;
    var def = PREMIUM_AMMO.find(function (a) { return a.id === activeAmmoId; });
    if (!def) return 1.0;
    if ((premiumAmmoInv[def.id] || 0) <= 0) {
      activeAmmoId = null;
      return 1.0;
    }
    premiumAmmoInv[def.id]--;
    if (premiumAmmoInv[def.id] <= 0) {
      delete premiumAmmoInv[def.id];
      activeAmmoId = null;
    }
    return def.damageMult;
  }

  /* Read-only check (does NOT consume) — for UI/HUD damage preview. */
  function getAmmoDamageMult(weaponType) {
    if (!activeAmmoId) return 1.0;
    if (!_isAmmoCompatible(weaponType)) return 1.0;
    var def = PREMIUM_AMMO.find(function (a) { return a.id === activeAmmoId; });
    return def ? def.damageMult : 1.0;
  }

  /* ── Sell Weapon for OKC ───────────────────────────────────────── */
  function sellWeaponForOKC(weaponIdx) {
    if (typeof Weapons === 'undefined') return 0;
    var info = Weapons.getWeaponInfo(weaponIdx);
    if (!info) return 0;
    var price = WEAPON_PRICES_OKC[info.id] || 0;
    if (price <= 0) return 0;
    if (!Weapons.isUnlocked(weaponIdx)) return 0;

    /* Lock the weapon (player loses it) */
    Weapons.lockWeapon(weaponIdx);
    okcBalance += price;
    addTx('sell', 'Sold ' + info.name, price, 'OKC');
    return price;
  }

  var _pendingSells = new Set();

  /* ── Sell Weapon for POL (blockchain tx) ───────────────────────── */
  async function sellWeaponForPOL(weaponIdx) {
    if (typeof Weapons === 'undefined') return 0;
    if (_pendingSells.has(weaponIdx)) return 0;
    var info = Weapons.getWeaponInfo(weaponIdx);
    if (!info) return 0;
    var price = WEAPON_PRICES_POL[info.id] || 0;
    if (price <= 0) return 0;
    if (!Weapons.isUnlocked(weaponIdx)) return 0;
    if (!Blockchain.isConnected()) return 0;

    _pendingSells.add(weaponIdx);
    /* Send POL from game wallet to player */
    try {
      var txResult = await Blockchain.purchaseWithDonation(GAME_WALLET, price);
      if (!txResult) { _pendingSells.delete(weaponIdx); return 0; }
    } catch(e) {
      _pendingSells.delete(weaponIdx); return 0;
    }
    _pendingSells.delete(weaponIdx);
    Weapons.lockWeapon(weaponIdx);
    addTx('sell', 'Sold ' + info.name + ' for POL', price, 'POL');
    return price;
  }

  /* ── Sell Ammo ─────────────────────────────────────────────────── */
  function sellAmmoForOKC(weaponIdx, amount) {
    if (typeof Weapons === 'undefined') return 0;
    var state = Weapons.getWeaponState(weaponIdx);
    if (!state || state.reserve < amount) return 0;
    Weapons.removeAmmo(weaponIdx, amount);
    var earned = amount * AMMO_PRICE_OKC;
    okcBalance += earned;
    addTx('sell', 'Sold ' + amount + ' ammo', earned, 'OKC');
    return earned;
  }

  async function sellAmmoForPOL(weaponIdx, amount) {
    if (typeof Weapons === 'undefined') return 0;
    var state = Weapons.getWeaponState(weaponIdx);
    if (!state || state.reserve < amount) return 0;
    if (typeof Blockchain === 'undefined' || !Blockchain.isConnected()) return 0;
    var earned = parseFloat((amount * AMMO_PRICE_POL).toFixed(6));
    if (earned <= 0) return 0;
    /* Off-chain receipt; real settlement happens once contracts deploy. */
    Weapons.removeAmmo(weaponIdx, amount);
    addTx('sell', 'Sold ' + amount + ' ammo for POL (off-chain)', earned, 'POL');
    return earned;
  }

  /* ── Buy Shop Items ────────────────────────────────────────────── */
  function buyItemWithOKC(itemIdx) {
    var item = SHOP_ITEMS[itemIdx];
    if (!item) return false;
    var cost = getDiscountedPrice(item.okcCost);
    if (okcBalance < cost) return false;
    okcBalance -= cost;
    addTx('buy', 'Bought ' + item.name, -cost, 'OKC');
    return item;
  }

  async function buyItemWithPOL(itemIdx) {
    var item = SHOP_ITEMS[itemIdx];
    if (!item) return false;
    if (!Blockchain.isConnected()) return false;
    var cost = item.polCost * (1 - getShopDiscount());
    var result = await Blockchain.purchaseWithDonation(GAME_WALLET, cost);
    if (result) {
      addTx('buy', 'Bought ' + item.name, -cost, 'POL');
      return item;
    }
    return false;
  }

  /* ── Buy Game Asset ────────────────────────────────────────────── */
  function _getAssetAtIndex(assetIdx) {
    var assets = getGameAssets();
    if (!assets || assetIdx < 0 || assetIdx >= assets.length) return null;
    return assets[assetIdx];
  }

  function buyAssetWithOKC(assetIdx) {
    var asset = _getAssetAtIndex(assetIdx);
    if (!asset) return false;
    if (ownedAssets.indexOf(asset.id) >= 0) return false; // already owned
    var cost = getDiscountedPrice(asset.okcCost);
    if (okcBalance < cost) return false;
    okcBalance -= cost;
    ownedAssets.push(asset.id);
    addTx('asset', 'Bought ' + asset.name, -cost, 'OKC');
    return true;
  }

  async function buyAssetWithPOL(assetIdx) {
    var asset = _getAssetAtIndex(assetIdx);
    if (!asset) return false;
    if (ownedAssets.indexOf(asset.id) >= 0) return false;
    if (!Blockchain.isConnected()) return false;
    var cost = asset.polCost * (1 - getShopDiscount());
    var result = await Blockchain.purchaseWithDonation(GAME_WALLET, cost);
    if (result) {
      ownedAssets.push(asset.id);
      addTx('asset', 'Bought ' + asset.name, -cost, 'POL');
      return true;
    }
    return false;
  }

  /* ── Play-to-Earn Reward Hooks ─────────────────────────────────── */
  function onKill(isHeadshot) {
    addOKC(isHeadshot ? EARN_RATES.headshot : EARN_RATES.kill);
    _earnViaApi(isHeadshot ? 'headshot' : 'kill', 1);
  }

  function onWaveClear() {
    addOKC(EARN_RATES.wave);
    _earnViaApi('wave', 1);
  }

  function onStageClear() {
    addOKC(EARN_RATES.stage);
    _earnViaApi('stage', 1);
  }

  function onStreak(count) {
    if (count === 3) { addOKC(EARN_RATES.streak3); _earnViaApi('streak3', 1); }
    else if (count === 5) { addOKC(EARN_RATES.streak5); _earnViaApi('streak5', 1); }
    else if (count >= 10) { addOKC(EARN_RATES.streak10); _earnViaApi('streak10', 1); }
  }

  function onMissionComplete() {
    addOKC(EARN_RATES.mission);
    _earnViaApi('mission', 1);
  }

  async function claimOKC(amount) {
    if (!canUseApi() || typeof Blockchain === 'undefined') return false;
    try {
      await initBackendSync();
      var proof = await ApiClient.claimOkc(amount);
      if (!proof) return false;
      await Blockchain.claimOkcOnChain(proof);
      await refreshFromBackend();
      markApiSuccess();
      return true;
    } catch (_) {
      markApiFailure();
      return false;
    }
  }

  async function mintVeteranTier(tierId) {
    if (!canUseApi() || typeof Blockchain === 'undefined') return false;
    try {
      await initBackendSync();
      var proof = await ApiClient.mintVeteran(tierId);
      if (!proof) return false;
      await Blockchain.mintVeteranOnChain(proof);
      markApiSuccess();
      return true;
    } catch (_) {
      markApiFailure();
      return false;
    }
  }

  async function buyCatalogAssetWithOKC(tokenId, amount) {
    if (!canUseApi() || typeof Blockchain === 'undefined') return false;
    try {
      await initBackendSync();
      var proof = await ApiClient.buyCosmetic(tokenId, amount || 1);
      if (!proof) return false;
      await Blockchain.claimWeaponOnChain(proof);
      await refreshFromBackend();
      addTx('asset', 'Bought cosmetic #' + tokenId, -Number(proof.cost || 0), 'OKC');
      if (ownedAssets.indexOf(String(tokenId)) < 0) ownedAssets.push(String(tokenId));
      markApiSuccess();
      return true;
    } catch (_) {
      markApiFailure();
      return false;
    }
  }

  /* ── Convert OKC to/from Gold (in-game economy bridge) ─────────── */
  const OKC_TO_GOLD = 10; // 1 OKC = 10 gold
  function convertOKCToGold(okcAmount) {
    if (okcBalance < okcAmount) return 0;
    if (typeof Economy === 'undefined' || !Economy.addCurrency) return 0;
    okcBalance -= okcAmount;
    var gold = okcAmount * OKC_TO_GOLD;
    Economy.addCurrency(gold);
    addTx('convert', okcAmount + ' OKC → ' + gold + ' Gold', -okcAmount, 'OKC');
    return gold;
  }

  function convertGoldToOKC(goldAmount) {
    if (typeof Economy === 'undefined' || !Economy.spendCurrency) return 0;
    if (!Economy.spendCurrency(goldAmount)) return 0;
    var okc = Math.floor(goldAmount / OKC_TO_GOLD);
    okcBalance += okc;
    addTx('convert', goldAmount + ' Gold → ' + okc + ' OKC', okc, 'OKC');
    return okc;
  }

  /* ── NFT Club — off-chain operations ───────────────────────────── */
  function getClubTiers()  { return NFT_CLUB_TIERS.slice(); }
  function getClubMember() { return clubMembership ? Object.assign({}, clubMembership) : null; }
  function getClubTier()   {
    if (!clubMembership) return NFT_CLUB_TIERS[0];
    var t = NFT_CLUB_TIERS.find(function (x) { return x.id === clubMembership.tierId; });
    return t || NFT_CLUB_TIERS[0];
  }

  function joinClubWithOKC(tierIdx) {
    var tier = NFT_CLUB_TIERS[tierIdx];
    if (!tier || tier.okcCost <= 0) return false;
    if (okcBalance < tier.okcCost) return false;
    okcBalance -= tier.okcCost;
    clubMembership = { tierId: tier.id, joinedAt: Date.now(), lastDropAt: Date.now() };
    addTx('club', 'Joined ' + tier.name, -tier.okcCost, 'OKC');
    _mintBadgeInternal('founder_2026');
    return true;
  }

  async function joinClubWithPOL(tierIdx) {
    var tier = NFT_CLUB_TIERS[tierIdx];
    if (!tier || tier.polCost <= 0) return false;
    if (typeof Blockchain === 'undefined' || !Blockchain.isConnected()) return false;
    /* Off-chain reservation: when contracts deploy, this becomes
       Blockchain.purchaseWithDonation(GAME_WALLET, tier.polCost). */
    clubMembership = { tierId: tier.id, joinedAt: Date.now(), lastDropAt: Date.now() };
    addTx('club', 'Joined ' + tier.name + ' (off-chain reservation)', -tier.polCost, 'POL');
    _mintBadgeInternal('founder_2026');
    return true;
  }

  function leaveClub() {
    clubMembership = null;
    addTx('club', 'Left NFT Club', 0, 'OKC');
  }

  /* Monthly drop — call once per real-world month while membership active. */
  function claimClubMonthlyDrop() {
    if (!clubMembership) return 0;
    var tier = getClubTier();
    var now = Date.now();
    var ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
    if (now - (clubMembership.lastDropAt || 0) < ONE_MONTH) return 0;
    if (tier.monthlyOkc <= 0) return 0;
    okcBalance += tier.monthlyOkc;
    clubMembership.lastDropAt = now;
    addTx('club', tier.name + ' monthly drop', tier.monthlyOkc, 'OKC');
    return tier.monthlyOkc;
  }

  /* ── NFT Badges — off-chain soulbound ledger ──────────────────── */
  function _mintBadgeInternal(badgeId) {
    var meta = NFT_BADGES[badgeId];
    if (!meta) return false;
    if (ownedNfts.some(function (n) { return n.id === badgeId; })) return false;
    ownedNfts.push({
      id: meta.id,
      name: meta.name,
      kind: meta.kind,
      stageId: meta.stageId || null,
      mintedAt: Date.now(),
      txRef: null, /* will be filled when contracts deploy */
    });
    addTx('nft', 'Minted ' + meta.name + ' (off-chain)', 0, 'NFT');
    return true;
  }
  function mintStageBadge(stageId) {
    /* Match a badge to the cleared stage. */
    var keys = Object.keys(NFT_BADGES);
    for (var i = 0; i < keys.length; i++) {
      var b = NFT_BADGES[keys[i]];
      if (b.stageId === stageId) return _mintBadgeInternal(b.id);
    }
    return false;
  }
  function getOwnedNfts() { return ownedNfts.slice(); }
  function getNftCatalog() {
    return Object.keys(NFT_BADGES).map(function (k) { return NFT_BADGES[k]; });
  }

  /* ── CashApp / Fiat Top-Ups ─────────────────────────────────────
     Cards work because CashApp's $cashtag pay page accepts Visa/MC/
     Amex/debit through the user's CashApp wallet — no merchant bank
     needed. Backend handles manual settlement; admin confirms in
     /admin once funds arrive in the CashApp inbox. */
  async function getFiatPacks() {
    if (typeof ApiClient !== 'undefined' && canUseApi()) {
      try {
        var r = await ApiClient.cashappPacks();
        markApiSuccess();
        return r;
      } catch (_) { markApiFailure(); }
    }
    /* Offline fallback uses Tokenomics if loaded */
    if (typeof Tokenomics !== 'undefined' && Tokenomics.getFiatPacks) {
      return { cashtag: '$lindapot', packs: Tokenomics.getFiatPacks() };
    }
    return { cashtag: '$lindapot', packs: [] };
  }

  async function buyOKCWithCashApp(packId) {
    if (typeof ApiClient === 'undefined' || !canUseApi()) {
      throw new Error('Backend offline — cannot create CashApp order');
    }
    var r = await ApiClient.cashappCreate(packId);
    if (!r || !r.ok) throw new Error('cashapp order failed');
    markApiSuccess();
    addTx('fiat-pending', 'CashApp order ' + r.refCode + ' for $' + r.usd, 0, 'USD');
    return r; /* { refCode, cashtag, payUrl, usd, okcAmount, instructions } */
  }

  async function confirmCashAppPayment(refCode, txid) {
    if (typeof ApiClient === 'undefined' || !canUseApi()) {
      throw new Error('Backend offline');
    }
    var r = await ApiClient.cashappSubmit(refCode, txid);
    if (!r || !r.ok) throw new Error('submit failed');
    addTx('fiat-submitted', 'CashApp payment confirmed (pending review): ' + refCode, 0, 'USD');
    return r;
  }

  async function getCashAppOrders() {
    if (typeof ApiClient === 'undefined' || !canUseApi()) return { orders: [] };
    try {
      var r = await ApiClient.cashappMine();
      markApiSuccess();
      return r;
    } catch (_) { markApiFailure(); return { orders: [] }; }
  }

  async function getCashAppOrderStatus(refCode) {
    if (typeof ApiClient === 'undefined' || !canUseApi()) return null;
    try {
      var r = await ApiClient.cashappStatus(refCode);
      markApiSuccess();
      return r;
    } catch (_) { markApiFailure(); return null; }
  }

  /* ── Reset ─────────────────────────────────────────────────────── */
  function reset() {
    okcBalance     = 0;
    activePremium  = null;
    ownedAssets    = [];
    txHistory      = [];
    clubMembership = null;
    ownedNfts      = [];
    premiumAmmoInv = {};
    activeAmmoId   = null;
  }

  /* ── Getters ───────────────────────────────────────────────────── */
  function getShopItems()    { return SHOP_ITEMS; }
  function getPremiumTiers() { return PREMIUM_TIERS; }
  function getGameAssets()   { return (dynamicAssets && dynamicAssets.length) ? dynamicAssets : GAME_ASSETS; }
  function getOwnedAssets()  { return ownedAssets.slice(); }
  function ownsAsset(id)     { return ownedAssets.indexOf(id) >= 0; }
  function getTxHistory()    { return txHistory.slice(); }
  function getEarnRates()    { return Object.assign({}, EARN_RATES); }
  function getWeaponPriceOKC(id) { return WEAPON_PRICES_OKC[id] || 0; }
  function getWeaponPricePOL(id) { return WEAPON_PRICES_POL[id] || 0; }

  return {
    /* OKC currency */
    addOKC, spendOKC, getOKC, setOKC,

    /* earn hooks */
    onKill, onWaveClear, onStageClear, onStreak, onMissionComplete,
    EARN_RATES,

    /* sell */
    sellWeaponForOKC, sellWeaponForPOL,
    sellAmmoForOKC, sellAmmoForPOL,

    /* buy */
    buyItemWithOKC, buyItemWithPOL,
    buyAssetWithOKC, buyAssetWithPOL,
    buyPremiumWithPOL, buyPremiumWithOKC,

    /* premium */
    isPremium, getPremiumInfo, getEarnMultiplier, getShopDiscount,
    getPremiumDurations, getPremiumPriceFor,

    /* premium ammo (WoT-style consumables) */
    getPremiumAmmoTypes, getPremiumAmmoInv,
    buyPremiumAmmoWithOKC, buyPremiumAmmoWithPOL,
    equipPremiumAmmo, getActiveAmmoId, getActiveAmmoInfo,
    consumeAmmoShot, getAmmoDamageMult,

    /* CashApp / fiat top-ups */
    getFiatPacks, buyOKCWithCashApp, confirmCashAppPayment,
    getCashAppOrders, getCashAppOrderStatus,

    /* nft club (off-chain) */
    getClubTiers, getClubTier, getClubMember,
    joinClubWithOKC, joinClubWithPOL, leaveClub, claimClubMonthlyDrop,
    mintStageBadge, getOwnedNfts, getNftCatalog,

    /* convert */
    convertOKCToGold, convertGoldToOKC,

    /* getters */
    getShopItems, getPremiumTiers, getGameAssets,
    getOwnedAssets, ownsAsset,
    getTxHistory, getEarnRates,
    getWeaponPriceOKC, getWeaponPricePOL,
    getDiscountedPrice,
    initBackendSync, refreshFromBackend, refreshCatalog,
    awardCustomOKC,
    claimOKC, mintVeteranTier, buyCatalogAssetWithOKC,

    /* lifecycle */
    reset,

    /* constants */
    OKC_PER_POL,
    GAME_WALLET,
  };
})();
