// ── Occupant Killer — Database Schema (SQLite / better-sqlite3) ──
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'game.db');

function initDB() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Players
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      anon_id       TEXT    UNIQUE NOT NULL,
      username      TEXT    DEFAULT 'Liberator',
      wallet_addr   TEXT,
      created_at    TEXT    DEFAULT (datetime('now')),
      last_login    TEXT    DEFAULT (datetime('now')),
      is_admin      INTEGER DEFAULT 0,
      is_banned     INTEGER DEFAULT 0,
      ban_reason    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_players_anon ON players(anon_id);
    CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(wallet_addr);
  `);

  // Player stats — off-chain OKC balance + game counters
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_stats (
      player_id       INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      okc_balance     REAL    DEFAULT 0,
      total_earned    REAL    DEFAULT 0,
      total_claimed   REAL    DEFAULT 0,
      total_kills     INTEGER DEFAULT 0,
      total_headshots INTEGER DEFAULT 0,
      max_wave        INTEGER DEFAULT 0,
      max_stage       INTEGER DEFAULT 0,
      login_streak    INTEGER DEFAULT 0,
      last_streak_at  TEXT
    );
  `);

  // OKC ledger — every earn/claim/spend recorded
  db.exec(`
    CREATE TABLE IF NOT EXISTS okc_ledger (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      delta      REAL    NOT NULL,
      reason     TEXT    NOT NULL,
      meta       TEXT,
      created_at TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ledger_player ON okc_ledger(player_id, created_at DESC);
  `);

  // Claim nonces — oracle signatures issued for on-chain claims
  db.exec(`
    CREATE TABLE IF NOT EXISTS claim_nonces (
      nonce        TEXT    PRIMARY KEY,
      player_id    INTEGER NOT NULL REFERENCES players(id),
      amount_wei   TEXT    NOT NULL,
      signature    TEXT    NOT NULL,
      kind         TEXT    NOT NULL,
      token_id     TEXT,
      created_at   TEXT    DEFAULT (datetime('now')),
      consumed_at  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_claim_player ON claim_nonces(player_id, created_at DESC);
  `);

  // Market orders — off-chain orderbook (sellers signed EIP-712)
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_orders (
      nonce          TEXT    PRIMARY KEY,
      seller         TEXT    NOT NULL,
      token_contract TEXT    NOT NULL,
      token_id       TEXT    NOT NULL,
      amount         INTEGER NOT NULL DEFAULT 1,
      price_wei      TEXT    NOT NULL,
      expires_at     INTEGER NOT NULL,
      is_erc1155     INTEGER NOT NULL DEFAULT 0,
      signature      TEXT    NOT NULL,
      status         TEXT    NOT NULL DEFAULT 'ACTIVE',
      created_at     TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_market_status ON market_orders(status, expires_at);
    CREATE INDEX IF NOT EXISTS idx_market_seller ON market_orders(seller);
  `);

  // Cosmetics catalog — items available for purchase (seeded from admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cosmetics_catalog (
      token_id       TEXT    PRIMARY KEY,
      item_type      INTEGER NOT NULL,
      rarity         INTEGER NOT NULL,
      bonus_bps      INTEGER NOT NULL DEFAULT 0,
      label          TEXT    NOT NULL,
      weapon_key     TEXT,
      price_okc      REAL    DEFAULT 0,
      price_pol_wei  TEXT,
      active         INTEGER DEFAULT 1,
      created_at     TEXT    DEFAULT (datetime('now'))
    );
  `);

  // Inventory cache (off-chain mirror of ERC-1155 balances)
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      token_id   TEXT    NOT NULL,
      amount     INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT    DEFAULT (datetime('now')),
      PRIMARY KEY (player_id, token_id)
    );
  `);

  // Rate-limit helper: earn events keyed by reason to cap per-minute abuse
  db.exec(`
    CREATE TABLE IF NOT EXISTS earn_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id  INTEGER NOT NULL,
      reason     TEXT    NOT NULL,
      amount     REAL    NOT NULL,
      created_at TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_earn_player_time ON earn_events(player_id, created_at);
  `);

  // CashApp / fiat orders — manual settlement (no merchant API)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cashapp_orders (
      ref_code     TEXT    PRIMARY KEY,
      player_id    INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      pack_id      TEXT    NOT NULL,
      usd_amount   REAL    NOT NULL,
      okc_amount   INTEGER NOT NULL,
      cashtag      TEXT    NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'PENDING',
      txid_user    TEXT,
      admin_notes  TEXT,
      created_at   TEXT    DEFAULT (datetime('now')),
      submitted_at TEXT,
      confirmed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cashapp_player ON cashapp_orders(player_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cashapp_status ON cashapp_orders(status, created_at DESC);
  `);

  return db;
}

// ── Player helpers ──
function getOrCreatePlayer(db, anonId) {
  if (!anonId || typeof anonId !== 'string' || anonId.length < 4 || anonId.length > 128) {
    throw new Error('invalid anon_id');
  }
  let p = db.prepare('SELECT * FROM players WHERE anon_id = ?').get(anonId);
  if (!p) {
    const info = db.prepare('INSERT INTO players (anon_id) VALUES (?)').run(anonId);
    db.prepare('INSERT INTO player_stats (player_id) VALUES (?)').run(info.lastInsertRowid);
    p = db.prepare('SELECT * FROM players WHERE id = ?').get(info.lastInsertRowid);
  } else {
    db.prepare("UPDATE players SET last_login = datetime('now') WHERE id = ?").run(p.id);
  }
  return p;
}

function getStats(db, playerId) {
  let s = db.prepare('SELECT * FROM player_stats WHERE player_id = ?').get(playerId);
  if (!s) {
    db.prepare('INSERT INTO player_stats (player_id) VALUES (?)').run(playerId);
    s = db.prepare('SELECT * FROM player_stats WHERE player_id = ?').get(playerId);
  }
  return s;
}

function creditOKC(db, playerId, amount, reason, meta) {
  const tx = db.transaction(() => {
    db.prepare(`UPDATE player_stats
                SET okc_balance  = okc_balance  + ?,
                    total_earned = total_earned + ?
                WHERE player_id = ?`).run(amount, amount, playerId);
    db.prepare('INSERT INTO okc_ledger (player_id, delta, reason, meta) VALUES (?, ?, ?, ?)')
      .run(playerId, amount, reason, meta ? JSON.stringify(meta) : null);
  });
  tx();
}

function debitOKC(db, playerId, amount, reason, meta) {
  const stats = getStats(db, playerId);
  if (stats.okc_balance < amount) throw new Error('insufficient OKC balance');
  const tx = db.transaction(() => {
    db.prepare('UPDATE player_stats SET okc_balance = okc_balance - ? WHERE player_id = ?')
      .run(amount, playerId);
    db.prepare('INSERT INTO okc_ledger (player_id, delta, reason, meta) VALUES (?, ?, ?, ?)')
      .run(playerId, -amount, reason, meta ? JSON.stringify(meta) : null);
  });
  tx();
}

function newNonce() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

module.exports = { initDB, getOrCreatePlayer, getStats, creditOKC, debitOKC, newNonce, DB_PATH };
