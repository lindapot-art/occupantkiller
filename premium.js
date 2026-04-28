// ============================================================
//  premium.js — WoT-style Premium Time tiers paid in OKC token
//  Tiers: DAILY / WEEKLY / MONTHLY / YEARLY
//  Active premium gives:
//    - Coin earnings multiplier
//    - XP / skill earnings multiplier
//    - Daily login bonus (coins)
//  Persisted in localStorage. Blockchain hook stub: window.Blockchain.purchasePremium
// ============================================================
window.Premium = (function () {
  'use strict';

  var LS_KEY = 'okc_premium_v1';
  var LISTENERS = [];

  // Prices in OKC token (occupantkiller token).  Real chain-side handled by Blockchain module.
  var TIERS = {
    DAILY:   { id: 'DAILY',   label: '24h Premium',   hours:   24, coinMult: 1.5, xpMult: 1.5, priceOKC:   5,  loginBonusOKC:  20 },
    WEEKLY:  { id: 'WEEKLY',  label: '7-Day Premium', hours:  168, coinMult: 1.6, xpMult: 1.6, priceOKC:  25,  loginBonusOKC:  35 },
    MONTHLY: { id: 'MONTHLY', label: '30-Day Premium',hours:  720, coinMult: 1.8, xpMult: 1.8, priceOKC:  80,  loginBonusOKC:  60 },
    YEARLY:  { id: 'YEARLY',  label: '1-Year Premium',hours: 8760, coinMult: 2.0, xpMult: 2.5, priceOKC: 700,  loginBonusOKC: 120 },
  };

  function _now() { return Date.now(); }
  function _read() {
    try {
      var s = localStorage.getItem(LS_KEY);
      if (!s) return null;
      return JSON.parse(s);
    } catch (e) { return null; }
  }
  function _write(o) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function _emit() { for (var i = 0; i < LISTENERS.length; i++) try { LISTENERS[i](getState()); } catch (e) {} }

  function getActiveTier() {
    var s = _read();
    if (!s) return null;
    if (s.expiresAt > _now()) {
      return TIERS[s.tier] || null;
    }
    return null;
  }
  function getRemainingMs() {
    var s = _read();
    if (!s) return 0;
    return Math.max(0, s.expiresAt - _now());
  }
  function getCoinMult() {
    var t = getActiveTier();
    return t ? t.coinMult : 1.0;
  }
  function getXpMult() {
    var t = getActiveTier();
    return t ? t.xpMult : 1.0;
  }
  function isActive() { return !!getActiveTier(); }

  // Activate premium (called after purchase confirmed on chain or test/free grant).
  function activate(tierId, hoursOverride) {
    var t = TIERS[tierId];
    if (!t) return false;
    var hours = (typeof hoursOverride === 'number' && hoursOverride > 0) ? hoursOverride : t.hours;
    var s = _read() || { tier: tierId, expiresAt: 0, lastLoginBonus: 0 };
    var base = Math.max(s.expiresAt, _now());
    s.tier = tierId;
    s.expiresAt = base + hours * 3600 * 1000;
    _write(s);
    _emit();
    try {
      if (window.HUD && window.HUD.showToast)
        window.HUD.showToast('🌟 PREMIUM ACTIVE: ' + t.label, 3000, '#ffd500');
    } catch (e) {}
    return true;
  }

  // Async purchase via blockchain (stub falls back to optimistic activate)
  function purchase(tierId, onResult) {
    var t = TIERS[tierId];
    if (!t) { if (onResult) onResult({ ok: false, reason: 'unknown tier' }); return; }
    function _ok() { activate(tierId); if (onResult) onResult({ ok: true, tier: tierId }); }
    if (window.Blockchain && typeof window.Blockchain.purchasePremium === 'function') {
      try {
        window.Blockchain.purchasePremium(tierId, t.priceOKC, function (res) {
          if (res && res.ok) _ok();
          else if (onResult) onResult({ ok: false, reason: (res && res.reason) || 'tx failed' });
        });
        return;
      } catch (e) {}
    }
    // Stub fallback: deduct from in-game economy currency if available
    try {
      if (window.Economy && typeof window.Economy.spendCurrency === 'function' &&
          window.Economy.getCurrency() >= t.priceOKC) {
        window.Economy.spendCurrency(t.priceOKC);
        _ok();
        return;
      }
    } catch (e) {}
    if (onResult) onResult({ ok: false, reason: 'insufficient OKC' });
  }

  // Daily login bonus — returns the coin amount granted (0 if already claimed today).
  function claimDailyBonus() {
    var t = getActiveTier();
    if (!t) return 0;
    var s = _read() || { tier: t.id, expiresAt: _now(), lastLoginBonus: 0 };
    var DAY = 24 * 3600 * 1000;
    if (_now() - (s.lastLoginBonus || 0) < DAY) return 0;
    s.lastLoginBonus = _now();
    _write(s);
    var amt = t.loginBonusOKC;
    try {
      if (window.Economy && window.Economy.addCurrency) window.Economy.addCurrency(amt);
    } catch (e) {}
    try {
      if (window.HUD && window.HUD.showToast)
        window.HUD.showToast('🎁 Daily premium bonus: +' + amt + ' OKC', 3000, '#ffd500');
    } catch (e) {}
    _emit();
    return amt;
  }

  function init() {
    // Wrap Economy.addCurrency once so premium multiplier applies to all coin grants.
    try {
      if (window.Economy && typeof window.Economy.addCurrency === 'function' &&
          !window.Economy._premiumWrapped) {
        var orig = window.Economy.addCurrency.bind(window.Economy);
        window.Economy.addCurrency = function (amount) {
          var m = getCoinMult();
          var grant = Math.round((amount || 0) * m);
          return orig(grant);
        };
        window.Economy._premiumWrapped = true;
      }
    } catch (e) {}
    // Auto-claim daily bonus if eligible after a brief startup delay.
    setTimeout(function () { try { claimDailyBonus(); } catch (e) {} }, 4000);
  }
  function update() {}
  function clear() {}

  function onChange(cb) { if (typeof cb === 'function') LISTENERS.push(cb); }
  function getState() {
    var t = getActiveTier();
    return {
      active: !!t,
      tier: t ? t.id : null,
      label: t ? t.label : null,
      coinMult: getCoinMult(),
      xpMult: getXpMult(),
      remainingMs: getRemainingMs(),
    };
  }
  function getTiers() {
    var out = [];
    for (var k in TIERS) if (TIERS.hasOwnProperty(k)) out.push(TIERS[k]);
    return out;
  }
  function grantTrial(hours) {
    activate('DAILY', hours || 24);
  }

  return {
    init: init, update: update, clear: clear,
    TIERS: TIERS,
    getCoinMult: getCoinMult,
    getXpMult: getXpMult,
    isActive: isActive,
    getState: getState,
    getTiers: getTiers,
    activate: activate,
    purchase: purchase,
    claimDailyBonus: claimDailyBonus,
    grantTrial: grantTrial,
    onChange: onChange,
  };
})();
