// ============================================================
//  lottery.js — Slot machine + sign-up bonus
//  - First launch awards a guaranteed sign-up bonus
//  - Player can spin daily slot for chance at OKC, weapons, premium time, AP rounds
//  Public API: init(), open(), close(), spin(), grantSignupBonusIfNew()
// ============================================================
window.Lottery = (function () {
  'use strict';

  var LS_KEY = 'okc_lottery_v1';
  var SIGNUP_KEY = 'okc_signup_v1';

  // Reels: 3 reels, weighted symbols.
  var SYMBOLS = [
    { id: 'CHERRY', label: '🍒',  weight: 30, payout: 'COINS_50',  desc: '+50 OKC' },
    { id: 'BAR',    label: '🅱',  weight: 22, payout: 'COINS_120', desc: '+120 OKC' },
    { id: 'STAR',   label: '⭐', weight: 16, payout: 'COINS_300', desc: '+300 OKC' },
    { id: 'AK',     label: '🔫', weight: 12, payout: 'WEAPON',    desc: 'Random weapon' },
    { id: 'SHIELD', label: '🛡', weight: 10, payout: 'AP_AMMO',   desc: '+30 AP rounds' },
    { id: 'CROWN',  label: '👑', weight:  6, payout: 'PREMIUM_24',desc: '24h Premium' },
    { id: 'DIAMOND',label: '💎', weight:  3, payout: 'PREMIUM_7', desc: '7-Day Premium' },
    { id: 'NUKE',   label: '☢',  weight:  1, payout: 'JACKPOT',   desc: 'JACKPOT! 5000 OKC + 30d Premium' },
  ];
  var SYM_BY_ID = {};
  for (var i = 0; i < SYMBOLS.length; i++) SYM_BY_ID[SYMBOLS[i].id] = SYMBOLS[i];

  function _read() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { return {}; } }
  function _write(o) { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {} }

  function _weightedPick() {
    var total = 0;
    for (var i = 0; i < SYMBOLS.length; i++) total += SYMBOLS[i].weight;
    var r = Math.random() * total;
    for (var j = 0; j < SYMBOLS.length; j++) {
      r -= SYMBOLS[j].weight;
      if (r <= 0) return SYMBOLS[j];
    }
    return SYMBOLS[0];
  }

  function _grantPayout(payoutCode) {
    if (payoutCode === 'COINS_50')      _giveCoins(50);
    else if (payoutCode === 'COINS_120')_giveCoins(120);
    else if (payoutCode === 'COINS_300')_giveCoins(300);
    else if (payoutCode === 'WEAPON')   _giveRandomWeapon();
    else if (payoutCode === 'AP_AMMO')  _giveAPAmmo(30);
    else if (payoutCode === 'PREMIUM_24') { try { window.Premium && window.Premium.activate('DAILY'); } catch (e) {} }
    else if (payoutCode === 'PREMIUM_7')  { try { window.Premium && window.Premium.activate('WEEKLY'); } catch (e) {} }
    else if (payoutCode === 'JACKPOT')  {
      _giveCoins(5000);
      try { window.Premium && window.Premium.activate('MONTHLY'); } catch (e) {}
    }
  }
  function _giveCoins(amt) {
    try { if (window.Economy && window.Economy.addCurrency) window.Economy.addCurrency(amt); } catch (e) {}
  }
  function _giveAPAmmo(n) {
    try { if (window.Weapons && window.Weapons.addAPAmmo) window.Weapons.addAPAmmo(n); } catch (e) {}
  }
  function _giveRandomWeapon() {
    try {
      if (window.Weapons && window.Weapons.unlockRandomWeapon) {
        window.Weapons.unlockRandomWeapon();
      }
    } catch (e) {}
  }

  function spin() {
    // 3 reels. Match-3 = full payout. Any pair = half (rounded up).
    var r1 = _weightedPick(), r2 = _weightedPick(), r3 = _weightedPick();
    var matched = (r1.id === r2.id && r2.id === r3.id);
    var pair = (!matched && (r1.id === r2.id || r2.id === r3.id || r1.id === r3.id));
    var winSym = matched ? r1 : (pair ? (r1.id === r2.id ? r1 : (r2.id === r3.id ? r2 : r1)) : null);
    var result = { reels: [r1.label, r2.label, r3.label], match: matched, pair: pair, payout: null, desc: 'No win' };
    if (matched) {
      _grantPayout(winSym.payout);
      result.payout = winSym.payout; result.desc = '★ MATCH-3: ' + winSym.desc;
    } else if (pair && winSym) {
      // Half payout = small coin grant only
      _giveCoins(20);
      result.payout = 'COINS_20'; result.desc = 'Pair: +20 OKC';
    }
    return result;
  }

  function grantSignupBonusIfNew() {
    if (localStorage.getItem(SIGNUP_KEY)) return false;
    try { localStorage.setItem(SIGNUP_KEY, '1'); } catch (e) {}
    // Generous starter bundle
    _giveCoins(500);
    _giveAPAmmo(50);
    try { window.Premium && window.Premium.grantTrial(24); } catch (e) {}
    try {
      if (window.HUD && window.HUD.showToast) {
        window.HUD.showToast('🎉 Welcome bonus: 500 OKC + 50 AP rounds + 24h Premium!', 5000, '#ffd500');
      }
    } catch (e) {}
    return true;
  }

  // ── UI ──────────────────────────────────────────────
  function _ensureUI() {
    if (document.getElementById('lottery-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'lottery-overlay';
    ov.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:600;justify-content:center;align-items:center;font-family:monospace;color:#fff';
    ov.innerHTML = (
      '<div style="width:380px;background:linear-gradient(180deg,#1a0f1a 0%,#3a1a3a 100%);border:3px solid #ffd500;border-radius:12px;padding:18px;box-shadow:0 0 40px rgba(255,213,0,0.5)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
        '<div style="font-size:18px;color:#ffd500;text-shadow:0 0 8px #ffd500">🎰 OCCUPANT SLOTS</div>' +
        '<button id="lottery-close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer">✕</button>' +
      '</div>' +
      '<div id="lottery-reels" style="display:flex;justify-content:space-between;font-size:64px;background:#000;border:2px solid #ffd500;padding:18px;border-radius:8px;margin-bottom:10px">' +
        '<div id="lr0">❓</div><div id="lr1">❓</div><div id="lr2">❓</div>' +
      '</div>' +
      '<div id="lottery-result" style="text-align:center;min-height:24px;color:#ffd500;font-size:13px;margin-bottom:10px">Press SPIN — costs 25 OKC</div>' +
      '<button id="lottery-spin" style="width:100%;padding:12px;background:#ffd500;color:#000;border:none;border-radius:6px;font-weight:bold;font-size:16px;cursor:pointer">SPIN (25 OKC)</button>' +
      '<div style="font-size:9px;color:#aaa;text-align:center;margin-top:8px">Match-3 wins coins, weapons, AP ammo, or premium time. JACKPOT = 5000 OKC + 30d premium.</div>' +
      '</div>'
    );
    document.body.appendChild(ov);
    document.getElementById('lottery-close').onclick = close;
    document.getElementById('lottery-spin').onclick = function () {
      // Cost
      var COST = 25;
      try {
        if (!window.Economy || typeof window.Economy.getCurrency !== 'function' ||
            window.Economy.getCurrency() < COST) {
          document.getElementById('lottery-result').textContent = '❌ Need 25 OKC to spin';
          return;
        }
        window.Economy.spendCurrency(COST);
      } catch (e) {}
      _animateSpin();
    };
  }
  function _animateSpin() {
    var lr = [document.getElementById('lr0'), document.getElementById('lr1'), document.getElementById('lr2')];
    var spinBtn = document.getElementById('lottery-spin');
    if (spinBtn) spinBtn.disabled = true;
    var iv = setInterval(function () {
      for (var i = 0; i < 3; i++) lr[i].textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].label;
    }, 60);
    setTimeout(function () {
      clearInterval(iv);
      var res = spin();
      lr[0].textContent = res.reels[0];
      lr[1].textContent = res.reels[1];
      lr[2].textContent = res.reels[2];
      document.getElementById('lottery-result').textContent = res.desc;
      if (spinBtn) spinBtn.disabled = false;
    }, 1000);
  }
  function open() {
    _ensureUI();
    var ov = document.getElementById('lottery-overlay');
    if (ov) ov.style.display = 'flex';
  }
  function close() {
    var ov = document.getElementById('lottery-overlay');
    if (ov) ov.style.display = 'none';
  }

  function init() {
    setTimeout(grantSignupBonusIfNew, 1500);
  }
  function update() {}
  function clearMod() {}

  return {
    init: init, update: update, clear: clearMod,
    open: open, close: close, spin: spin,
    grantSignupBonusIfNew: grantSignupBonusIfNew,
    SYMBOLS: SYMBOLS,
  };
})();
