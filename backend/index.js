// ── Occupant Killer — Backend API ──
// Express + SQLite (better-sqlite3) + ethers v6 (oracle signing).
// Serves on PORT (default 3001). The static game server (server.js) keeps
// port 3000. Frontend fetches /api/* either through a reverse proxy or by
// calling http://host:3001/api/* directly (CORS enabled).

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const path    = require('path');
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');

const { initDB, getOrCreatePlayer, getStats, creditOKC, debitOKC, newNonce } = require('./db');
const oracle = require('./oracle');

const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());

const db = initDB();
console.log('[backend] DB ready');

// ── Earn rates (source of truth — frontend reads /api/config) ──
const EARN_RATES = {
  kill:        5,
  headshot:    15,
  wave:        50,
  stage:       200,
  streak3:     10,
  streak5:     25,
  streak10:    75,
  dailyLogin:  100,
  mission:     30,
};
const EARN_WINDOW_SEC     = 60;
const EARN_MAX_PER_WINDOW = { kill: 300, headshot: 60, wave: 20, stage: 5, mission: 20, streak3: 30, streak5: 30, streak10: 30, dailyLogin: 1 };
const CLAIM_MIN_OKC = 100;  // min off-chain balance to allow on-chain claim

// ── Veteran NFT tier requirements (must match on-chain contract) ──
const VETERAN_TIERS = [
  { id: 1, label: 'Recruit',   killsRequired: 50,   multiplierBps: 10500 },
  { id: 2, label: 'Soldier',   killsRequired: 250,  multiplierBps: 11000 },
  { id: 3, label: 'Hardened',  killsRequired: 500,  multiplierBps: 12500 },
  { id: 4, label: 'Elite',     killsRequired: 1500, multiplierBps: 15000 },
  { id: 5, label: 'Liberator', killsRequired: 5000, multiplierBps: 20000 },
];

// ── App setup ──
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS, credentials: false }));
app.use(express.json({ limit: '64kb' }));

const globalLimiter    = rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false });
const financialLimiter = rateLimit({ windowMs: 60_000, max: 10,  standardHeaders: true, legacyHeaders: false });
const syncLimiter      = rateLimit({ windowMs: 60_000, max: 5,   standardHeaders: true, legacyHeaders: false });
app.use('/api/', globalLimiter);

// ── Auth middleware: X-Anon-Id header ──
function authAnon(req, res, next) {
  const anonId = req.get('X-Anon-Id');
  if (!anonId) return res.status(401).json({ error: 'missing X-Anon-Id' });
  try {
    const p = getOrCreatePlayer(db, anonId);
    if (p.is_banned) return res.status(403).json({ error: 'banned', reason: p.ban_reason });
    req.player = p;
    next();
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

// ── Health ──
app.get('/api/health', (req, res) => {
  const row = db.prepare('SELECT COUNT(*) AS n FROM players').get();
  let oracleAddr = null;
  try { oracleAddr = oracle.oracleAddress(); } catch (_) {}
  res.json({ ok: true, players: row.n, oracle: oracleAddr, time: new Date().toISOString() });
});

// ── Public config (earn rates + veteran tiers) ──
app.get('/api/config', (req, res) => {
  res.json({ earnRates: EARN_RATES, earnCaps: EARN_MAX_PER_WINDOW, claimMin: CLAIM_MIN_OKC, veteranTiers: VETERAN_TIERS });
});

// ── Player auth / profile ──
app.post('/api/player/auth', (req, res) => {
  const anonId = req.body?.anonId || req.get('X-Anon-Id');
  if (!anonId) return res.status(400).json({ error: 'anonId required' });
  const p = getOrCreatePlayer(db, anonId);
  const s = getStats(db, p.id);
  res.json({ player: { id: p.id, anonId: p.anon_id, username: p.username, wallet: p.wallet_addr }, stats: s });
});

app.get('/api/player/profile', authAnon, (req, res) => {
  const s = getStats(db, req.player.id);
  const inventory = db.prepare('SELECT token_id, amount FROM inventory WHERE player_id = ? AND amount > 0').all(req.player.id);
  res.json({
    player: { id: req.player.id, anonId: req.player.anon_id, username: req.player.username, wallet: req.player.wallet_addr },
    stats: s,
    inventory,
  });
});

// ── Link wallet (signed message proves ownership) ──
app.post('/api/player/link-wallet', authAnon, (req, res) => {
  const { wallet, signature, timestamp } = req.body || {};
  if (!wallet || !signature || !timestamp) return res.status(400).json({ error: 'wallet, signature, timestamp required' });
  if (!ethers.isAddress(wallet)) return res.status(400).json({ error: 'invalid wallet' });
  const age = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(age) || age > 5 * 60 * 1000) return res.status(400).json({ error: 'timestamp drift too large' });
  const msg = `OccupantKiller link-wallet: anonId=${req.player.anon_id} ts=${timestamp}`;
  const recovered = oracle.verifyPersonalSig(msg, signature);
  if (!recovered || recovered.toLowerCase() !== wallet.toLowerCase()) {
    return res.status(401).json({ error: 'bad signature' });
  }
  db.prepare('UPDATE players SET wallet_addr = ? WHERE id = ?').run(wallet.toLowerCase(), req.player.id);
  res.json({ ok: true, wallet: wallet.toLowerCase() });
});

// ── Earn OKC (validated server-side) ──
app.post('/api/player/okc-earn', authAnon, financialLimiter, (req, res) => {
  const { reason, count = 1, meta } = req.body || {};
  if (!reason || typeof reason !== 'string' || !(reason in EARN_RATES)) {
    return res.status(400).json({ error: 'invalid reason' });
  }
  const n = Math.max(1, Math.min(50, Math.floor(count)));
  const cap = EARN_MAX_PER_WINDOW[reason];
  if (cap) {
    const sinceIso = new Date(Date.now() - EARN_WINDOW_SEC * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS used
                             FROM earn_events WHERE player_id = ? AND reason = ? AND created_at >= ?`)
      .get(req.player.id, reason, sinceIso);
    if ((row.used || 0) + n > cap) return res.status(429).json({ error: 'earn rate cap', reason, cap, windowSec: EARN_WINDOW_SEC });
  }
  const amount = EARN_RATES[reason] * n;
  creditOKC(db, req.player.id, amount, reason, meta);
  db.prepare('INSERT INTO earn_events (player_id, reason, amount) VALUES (?, ?, ?)')
    .run(req.player.id, reason, n);

  // Bump kill counters for NFT progression
  if (reason === 'kill') {
    db.prepare('UPDATE player_stats SET total_kills = total_kills + ? WHERE player_id = ?').run(n, req.player.id);
  } else if (reason === 'headshot') {
    db.prepare('UPDATE player_stats SET total_headshots = total_headshots + ? WHERE player_id = ?').run(n, req.player.id);
  }
  const stats = getStats(db, req.player.id);
  res.json({ ok: true, earned: amount, balance: stats.okc_balance, stats });
});

// ── Request an on-chain OKC claim signature ──
app.post('/api/player/okc-claim', authAnon, financialLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet_addr;
    if (!wallet) return res.status(400).json({ error: 'wallet not linked' });
    const { amount } = req.body || {};
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < CLAIM_MIN_OKC) return res.status(400).json({ error: `min claim = ${CLAIM_MIN_OKC} OKC` });

    const stats = getStats(db, req.player.id);
    if (stats.okc_balance < amt) return res.status(400).json({ error: 'insufficient balance' });

    const amountWei = ethers.parseUnits(amt.toFixed(4), 18);
    const nonce = newNonce();
    const sig = await oracle.signOkcClaim(wallet, amountWei, nonce);

    const tx = db.transaction(() => {
      db.prepare('UPDATE player_stats SET okc_balance = okc_balance - ?, total_claimed = total_claimed + ? WHERE player_id = ?')
        .run(amt, amt, req.player.id);
      db.prepare('INSERT INTO okc_ledger (player_id, delta, reason, meta) VALUES (?, ?, ?, ?)')
        .run(req.player.id, -amt, 'claim-signed', JSON.stringify({ nonce }));
      db.prepare('INSERT INTO claim_nonces (nonce, player_id, amount_wei, signature, kind) VALUES (?, ?, ?, ?, ?)')
        .run(nonce, req.player.id, amountWei.toString(), JSON.stringify(sig), 'OKC');
    });
    tx();

    res.json({
      ok: true,
      wallet,
      amountWei: amountWei.toString(),
      amount: amt,
      nonce,
      v: sig.v, r: sig.r, s: sig.s,
    });
  } catch (e) {
    console.error('[okc-claim]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Veteran NFT mint signature ──
app.post('/api/nft/veteran-mint', authAnon, financialLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet_addr;
    if (!wallet) return res.status(400).json({ error: 'wallet not linked' });
    const tierId = Number(req.body?.tierId);
    const tier = VETERAN_TIERS.find(t => t.id === tierId);
    if (!tier) return res.status(400).json({ error: 'bad tierId' });
    const stats = getStats(db, req.player.id);
    if (stats.total_kills < tier.killsRequired) {
      return res.status(400).json({ error: 'insufficient kills', required: tier.killsRequired, have: stats.total_kills });
    }
    const nonce = newNonce();
    const sig = await oracle.signVeteranMint(wallet, tierId, stats.total_kills, nonce);
    db.prepare('INSERT INTO claim_nonces (nonce, player_id, amount_wei, signature, kind, token_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(nonce, req.player.id, '0', JSON.stringify(sig), 'VETERAN', String(tierId));
    res.json({ ok: true, wallet, tierId, kills: stats.total_kills, nonce, v: sig.v, r: sig.r, s: sig.s });
  } catch (e) {
    console.error('[veteran-mint]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Cosmetics catalog + buy ──
app.get('/api/cosmetics/catalog', (req, res) => {
  const rows = db.prepare('SELECT * FROM cosmetics_catalog WHERE active = 1 ORDER BY rarity ASC, price_okc ASC').all();
  res.json({ items: rows });
});

app.post('/api/cosmetics/buy', authAnon, financialLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet_addr;
    if (!wallet) return res.status(400).json({ error: 'wallet not linked' });
    const tokenId = String(req.body?.tokenId || '');
    const amount  = Math.max(1, Math.min(10, Number(req.body?.amount || 1)));
    const item = db.prepare('SELECT * FROM cosmetics_catalog WHERE token_id = ? AND active = 1').get(tokenId);
    if (!item) return res.status(404).json({ error: 'item not found' });
    if (!item.price_okc || item.price_okc <= 0) return res.status(400).json({ error: 'item not OKC-purchaseable' });
    const cost = item.price_okc * amount;
    debitOKC(db, req.player.id, cost, 'cosmetic-buy', { tokenId, amount });
    const nonce = newNonce();
    const sig = await oracle.signWeaponMint(wallet, BigInt(tokenId), amount, nonce);
    db.prepare('INSERT INTO claim_nonces (nonce, player_id, amount_wei, signature, kind, token_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(nonce, req.player.id, String(amount), JSON.stringify(sig), 'WEAPON', tokenId);
    db.prepare(`INSERT INTO inventory (player_id, token_id, amount) VALUES (?, ?, ?)
                ON CONFLICT(player_id, token_id) DO UPDATE SET amount = amount + excluded.amount, updated_at = datetime('now')`)
      .run(req.player.id, tokenId, amount);
    res.json({ ok: true, tokenId, amount, cost, nonce, v: sig.v, r: sig.r, s: sig.s });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Market — off-chain orderbook (EIP-712 seller signatures) ──
app.get('/api/market/active', (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  db.prepare("UPDATE market_orders SET status = 'EXPIRED' WHERE status = 'ACTIVE' AND expires_at < ?").run(now);
  const rows = db.prepare(`SELECT * FROM market_orders WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 200`).all();
  res.json({ orders: rows });
});

app.post('/api/market/list', authAnon, financialLimiter, (req, res) => {
  const { tokenContract, tokenId, amount = 1, priceWei, expiresAt, nonce, isErc1155 = false, signature } = req.body || {};
  if (!tokenContract || !tokenId || !priceWei || !expiresAt || !nonce || !signature) {
    return res.status(400).json({ error: 'missing fields' });
  }
  if (!ethers.isAddress(tokenContract) || !req.player.wallet_addr) {
    return res.status(400).json({ error: 'bad contract or wallet not linked' });
  }
  db.prepare(`INSERT INTO market_orders
              (nonce, seller, token_contract, token_id, amount, price_wei, expires_at, is_erc1155, signature)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(nonce, req.player.wallet_addr, tokenContract.toLowerCase(), String(tokenId), Number(amount),
         String(priceWei), Number(expiresAt), isErc1155 ? 1 : 0, signature);
  res.json({ ok: true, nonce });
});

app.post('/api/market/cancel', authAnon, (req, res) => {
  const { nonce } = req.body || {};
  if (!nonce) return res.status(400).json({ error: 'nonce required' });
  const order = db.prepare('SELECT * FROM market_orders WHERE nonce = ?').get(nonce);
  if (!order) return res.status(404).json({ error: 'not found' });
  if (order.seller?.toLowerCase() !== req.player.wallet_addr?.toLowerCase()) {
    return res.status(403).json({ error: 'not seller' });
  }
  db.prepare("UPDATE market_orders SET status = 'CANCELLED' WHERE nonce = ?").run(nonce);
  res.json({ ok: true });
});

// ── Ledger (recent entries) ──
app.get('/api/player/ledger', authAnon, (req, res) => {
  const rows = db.prepare('SELECT delta, reason, meta, created_at FROM okc_ledger WHERE player_id = ? ORDER BY id DESC LIMIT 100').all(req.player.id);
  res.json({ entries: rows });
});

// ── Deployments (public — contract addresses for the frontend) ──
app.get('/api/deployments', (req, res) => {
  try {
    const fs = require('fs');
    const network = (req.query.network || process.env.ACTIVE_NETWORK || 'amoy').toString();
    const p = path.resolve(__dirname, '..', 'contracts', 'deployments', `${network}.json`);
    if (!fs.existsSync(p)) return res.json({ network, deployed: false });
    const record = JSON.parse(fs.readFileSync(p, 'utf8'));
    res.json({ network, deployed: true, ...record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'internal' });
});

app.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}`);
  try { console.log(`[backend] oracle address: ${oracle.oracleAddress()}`); }
  catch (e) { console.warn(`[backend] ORACLE DISABLED: ${e.message}`); }
});
