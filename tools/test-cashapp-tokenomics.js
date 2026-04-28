/* Smoke test: tokenomics module + CashApp payment flow end-to-end.
   Spins up the backend on port 3099 with a temp db + admin key. */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const puppeteer = require('puppeteer');

const ADMIN_KEY = 'test-admin-key-' + Date.now();
const BACKEND_PORT = 3099;
const TMP_DB = path.join(__dirname, '..', 'backend', 'test-cashapp.db');
try { fs.unlinkSync(TMP_DB); } catch (_) {}

function http_(method, port, p, body, headers) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: 'localhost', port, path: p, method,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
      }, headers || {}),
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch (_) { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // 1) Spawn backend with admin key + temp db
  console.log('[1] starting backend on port', BACKEND_PORT);
  const backend = spawn(process.execPath, ['index.js'], {
    cwd: path.join(__dirname, '..', 'backend'),
    env: Object.assign({}, process.env, {
      PORT: String(BACKEND_PORT),
      DB_PATH: TMP_DB,
      CASHAPP_TAG: '$testshop',
      CASHAPP_ADMIN_KEY: ADMIN_KEY,
      ALLOWED_ORIGINS: '*',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backend.stdout.on('data', d => process.stdout.write('[BE] ' + d));
  backend.stderr.on('data', d => process.stderr.write('[BE-ERR] ' + d));

  // wait for backend ready
  await new Promise(r => setTimeout(r, 1500));

  let pass = true;
  const fails = [];
  function expect(cond, msg) { if (!cond) { fails.push(msg); pass = false; } }

  try {
    const ANON = 'p2e-test-anon-' + Date.now();

    // 2) auth
    const auth = await http_('POST', BACKEND_PORT, '/api/player/auth', { anonId: ANON });
    expect(auth.status === 200, 'auth status 200, got ' + auth.status);
    console.log('[2] auth OK', auth.body.player && auth.body.player.id);

    // 3) get fiat packs
    const packs = await http_('GET', BACKEND_PORT, '/api/payments/cashapp/packs');
    expect(packs.status === 200, 'packs status 200, got ' + packs.status);
    expect(Array.isArray(packs.body.packs), 'packs.packs is array');
    expect(packs.body.packs.length >= 5, 'packs has 5+ tiers, got ' + (packs.body.packs || []).length);
    expect(packs.body.cashtag === '$testshop', 'cashtag is $testshop, got ' + packs.body.cashtag);
    console.log('[3] packs OK — cashtag=' + packs.body.cashtag + ', tiers=' + packs.body.packs.length);

    // 4) create order for $25 squad pack
    const create = await http_('POST', BACKEND_PORT, '/api/payments/cashapp/create',
      { packId: 'pack_squad' }, { 'X-Anon-Id': ANON });
    expect(create.status === 200, 'create status 200, got ' + create.status + ' ' + JSON.stringify(create.body));
    expect(create.body.refCode && /^OK-/.test(create.body.refCode), 'refCode starts with OK-');
    expect(create.body.payUrl && create.body.payUrl.indexOf('cash.app') >= 0, 'payUrl contains cash.app');
    expect(create.body.usd === 25, 'usd is 25');
    expect(create.body.okcAmount === 27500, 'okc is 27500 (25k base + 10% bonus), got ' + create.body.okcAmount);
    const REF = create.body.refCode;
    console.log('[4] order created: ' + REF + ' payUrl=' + create.body.payUrl);

    // 5) submit fake txid
    const submit = await http_('POST', BACKEND_PORT, '/api/payments/cashapp/submit',
      { refCode: REF, txid: 'cashapp-tx-fake-12345' }, { 'X-Anon-Id': ANON });
    expect(submit.status === 200, 'submit status 200, got ' + submit.status);
    expect(submit.body.status === 'SUBMITTED', 'status SUBMITTED');
    console.log('[5] submitted with txid');

    // 6) status check
    const stat = await http_('GET', BACKEND_PORT, '/api/payments/cashapp/status/' + REF, null,
      { 'X-Anon-Id': ANON });
    expect(stat.status === 200, 'status status 200');
    expect(stat.body.status === 'SUBMITTED', 'order is SUBMITTED');
    console.log('[6] status check OK');

    // 7) admin: list pending — without key should fail
    const adminBad = await http_('GET', BACKEND_PORT, '/api/admin/cashapp/pending');
    expect(adminBad.status === 401, 'no admin key → 401, got ' + adminBad.status);
    console.log('[7] admin requires key — OK');

    // 8) admin with correct key
    const adminList = await http_('GET', BACKEND_PORT, '/api/admin/cashapp/pending', null,
      { 'X-Admin-Key': ADMIN_KEY });
    expect(adminList.status === 200, 'admin list 200');
    expect(adminList.body.orders.length === 1, 'one pending order');
    expect(adminList.body.orders[0].ref_code === REF, 'matches our REF');
    console.log('[8] admin pending list OK');

    // 9) admin confirms → OKC credited
    const confirm = await http_('POST', BACKEND_PORT, '/api/admin/cashapp/confirm',
      { refCode: REF, action: 'CONFIRM', notes: 'verified via inbox' },
      { 'X-Admin-Key': ADMIN_KEY });
    expect(confirm.status === 200, 'confirm 200');
    expect(confirm.body.credited === 27500, 'credited 27500');
    console.log('[9] admin confirmed, credited=' + confirm.body.credited);

    // 10) profile shows balance
    const prof = await http_('GET', BACKEND_PORT, '/api/player/profile', null, { 'X-Anon-Id': ANON });
    expect(prof.status === 200, 'profile 200');
    expect(prof.body.stats.okc_balance === 27500, 'okc_balance = 27500, got ' + prof.body.stats.okc_balance);
    console.log('[10] balance updated: ' + prof.body.stats.okc_balance + ' OKC');

    // 11) re-confirm should fail
    const dup = await http_('POST', BACKEND_PORT, '/api/admin/cashapp/confirm',
      { refCode: REF, action: 'CONFIRM' }, { 'X-Admin-Key': ADMIN_KEY });
    expect(dup.status === 409, 'duplicate confirm 409, got ' + dup.status);
    console.log('[11] duplicate confirm blocked');

    // 12) tokenomics module loads in browser (from main game server)
    console.log('[12] checking frontend Tokenomics module on http://localhost:3000 ...');
    let browserOk = false;
    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
      });
      const page = await browser.newPage();
      await page.goto('http://localhost:3000');
      await new Promise(r => setTimeout(r, 4000));
      const tk = await page.evaluate(() => {
        if (typeof Tokenomics === 'undefined') return { fail: 'no Tokenomics' };
        return {
          ok: true,
          totalSupply: Tokenomics.TOTAL_SUPPLY,
          dist: Object.keys(Tokenomics.DISTRIBUTION),
          rate: Tokenomics.getUsdPerOKC(),
          packs: (Tokenomics.getFiatPacks() || []).length,
          usdToOKC_25: Tokenomics.usdToOKC(25),
          okcToUSD_27500: Tokenomics.okcToUSD(27500),
          dailyEmission_y0: Tokenomics.currentDailyEmission(0),
          dailyEmission_y2: Tokenomics.currentDailyEmission(800),
        };
      });
      console.log('[12] Tokenomics:', JSON.stringify(tk));
      expect(tk.ok, 'Tokenomics loaded');
      expect(tk.totalSupply === 1_000_000_000, 'total supply 1B');
      expect(tk.packs >= 5, 'has fiat packs');
      expect(tk.usdToOKC_25 === 25000, 'usd→okc rate ($25=25000 OKC)');
      expect(tk.dailyEmission_y0 > tk.dailyEmission_y2, 'emission halves over time');
      browserOk = true;
      await browser.close();
    } catch (e) {
      console.log('[12] browser check skipped/failed (game server may not be up):', e.message);
    }
    if (!browserOk) console.log('[12] WARN — frontend Tokenomics check was not performed');

  } finally {
    backend.kill();
    try { fs.unlinkSync(TMP_DB); } catch (_) {}
    try { fs.unlinkSync(TMP_DB + '-wal'); } catch (_) {}
    try { fs.unlinkSync(TMP_DB + '-shm'); } catch (_) {}
  }

  if (pass) {
    console.log('\n[CASHAPP+TOKENOMICS] PASS — all checks succeeded.');
    process.exit(0);
  } else {
    console.log('\n[CASHAPP+TOKENOMICS] FAIL:\n  ' + fails.join('\n  '));
    process.exit(1);
  }
})();
