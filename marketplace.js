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
  let activePremium = null;  // { tier, expiresAt }

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
    if (activePremium && activePremium.expiresAt > Date.now()) {
      return activePremium.tier.earnMultiplier;
    }
    return 1.0;
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
  async function buyPremiumWithPOL(tierIdx) {
    var tier = PREMIUM_TIERS[tierIdx];
    if (!tier) return false;
    if (!Blockchain.isConnected()) { return false; }
    var result = await Blockchain.purchaseWithDonation(GAME_WALLET, tier.polCost);
    if (result) {
      activePremium = { tier: tier, expiresAt: Date.now() + tier.duration * 86400000 };
      addTx('premium', 'Purchased ' + tier.name, -tier.polCost, 'POL');
      return true;
    }
    return false;
  }

  function buyPremiumWithOKC(tierIdx) {
    var tier = PREMIUM_TIERS[tierIdx];
    if (!tier) return false;
    if (okcBalance >= tier.okcCost) {
      okcBalance -= tier.okcCost;
      activePremium = { tier: tier, expiresAt: Date.now() + tier.duration * 86400000 };
      addTx('premium', 'Purchased ' + tier.name, -tier.okcCost, 'OKC');
      return true;
    }
    return false;
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

  /* ── Reset ─────────────────────────────────────────────────────── */
  function reset() {
    okcBalance    = 0;
    activePremium = null;
    ownedAssets   = [];
    txHistory     = [];
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
    sellAmmoForOKC,

    /* buy */
    buyItemWithOKC, buyItemWithPOL,
    buyAssetWithOKC, buyAssetWithPOL,
    buyPremiumWithPOL, buyPremiumWithOKC,

    /* premium */
    isPremium, getPremiumInfo, getEarnMultiplier, getShopDiscount,

    /* convert */
    convertOKCToGold, convertGoldToOKC,

    /* getters */
    getShopItems, getPremiumTiers, getGameAssets,
    getOwnedAssets, ownsAsset,
    getTxHistory, getEarnRates,
    getWeaponPriceOKC, getWeaponPricePOL,
    getDiscountedPrice,
    initBackendSync, refreshFromBackend, refreshCatalog,
    claimOKC, mintVeteranTier, buyCatalogAssetWithOKC,

    /* lifecycle */
    reset,

    /* constants */
    OKC_PER_POL,
    GAME_WALLET,
  };
})();
