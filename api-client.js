/* ───────────────────────────────────────────────────────────────────────
   API-CLIENT — Occupant Killer backend gateway (port 3001 by default)
   ───────────────────────────────────────────────────────────────────────
   IIFE singleton. Exposes: init(opts), auth(), profile(), earn(reason,count),
   claim(amount), mintVeteran(tierId), buyCosmetic(tokenId, amount),
   marketList(order,sig), marketActive(), marketCancel(nonce),
   deployments(network), linkWallet(address, signer), ledger().

   All requests send X-Anon-Id header (auto-persisted in localStorage).
   ─────────────────────────────────────────────────────────────────────── */
const ApiClient = (function () {
  'use strict';

  const LS_ANON = 'okc:anonId';
  let _baseUrl  = 'http://localhost:3001';
  let _anonId   = null;
  let _profile  = null;
  let _inflight = new Map();

  function _ensureAnonId() {
    if (_anonId) return _anonId;
    try { _anonId = localStorage.getItem(LS_ANON); } catch (_) {}
    if (!_anonId) {
      const rnd = (typeof crypto !== 'undefined' && crypto.getRandomValues)
        ? Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2,'0')).join('')
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      _anonId = 'ok-' + rnd;
      try { localStorage.setItem(LS_ANON, _anonId); } catch (_) {}
    }
    return _anonId;
  }

  async function _request(method, pathname, body) {
    const url  = _baseUrl + pathname;
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Anon-Id':    _ensureAnonId(),
      },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    // Dedupe identical in-flight requests
    const key = method + ' ' + pathname + ':' + (body ? JSON.stringify(body) : '');
    if (_inflight.has(key)) return _inflight.get(key);

    const p = (async () => {
      try {
        const res = await fetch(url, opts);
        let data = null;
        try { data = await res.json(); } catch (_) { data = { error: 'bad json' }; }
        if (!res.ok) {
          const e = new Error(data.error || ('HTTP ' + res.status));
          e.status = res.status; e.data = data;
          throw e;
        }
        return data;
      } finally {
        _inflight.delete(key);
      }
    })();
    _inflight.set(key, p);
    return p;
  }

  // ── Public API ──
  function init(opts) {
    if (opts && typeof opts.baseUrl === 'string') _baseUrl = opts.baseUrl.replace(/\/$/, '');
    _ensureAnonId();
    return _anonId;
  }

  function getAnonId() { return _ensureAnonId(); }
  function getBaseUrl() { return _baseUrl; }

  async function health()      { return _request('GET',  '/api/health'); }
  async function config()      { return _request('GET',  '/api/config'); }
  async function auth()        { const r = await _request('POST', '/api/player/auth', { anonId: _ensureAnonId() }); _profile = r; return r; }
  async function profile()     { const r = await _request('GET',  '/api/player/profile'); _profile = r; return r; }
  async function ledger()      { return _request('GET',  '/api/player/ledger'); }

  async function linkWallet(address, signature, timestamp) {
    return _request('POST', '/api/player/link-wallet', { wallet: address, signature, timestamp });
  }

  async function earn(reason, count, meta) {
    return _request('POST', '/api/player/okc-earn', { reason, count: count || 1, meta });
  }

  async function grantOkc(amount, reason, meta) {
    return _request('POST', '/api/player/okc-grant', { amount, reason, meta });
  }

  async function claimOkc(amount) {
    return _request('POST', '/api/player/okc-claim', { amount });
  }

  async function mintVeteran(tierId) {
    return _request('POST', '/api/nft/veteran-mint', { tierId });
  }

  async function catalog()   { return _request('GET',  '/api/cosmetics/catalog'); }
  async function buyCosmetic(tokenId, amount) {
    return _request('POST', '/api/cosmetics/buy', { tokenId, amount: amount || 1 });
  }

  async function marketActive() { return _request('GET',  '/api/market/active'); }
  async function marketList(order) { return _request('POST', '/api/market/list', order); }
  async function marketCancel(nonce) { return _request('POST', '/api/market/cancel', { nonce }); }

  async function deployments(network) {
    return _request('GET', '/api/deployments' + (network ? ('?network=' + encodeURIComponent(network)) : ''));
  }

  function cachedProfile() { return _profile; }

  return {
    init, getAnonId, getBaseUrl,
    health, config, auth, profile, ledger,
    linkWallet, earn, grantOkc, claimOkc,
    mintVeteran, catalog, buyCosmetic,
    marketActive, marketList, marketCancel,
    deployments, cachedProfile,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ApiClient;
if (typeof window !== 'undefined') window.ApiClient = ApiClient;
