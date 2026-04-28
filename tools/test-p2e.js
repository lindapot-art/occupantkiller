/* Smoke test: play-to-earn / NFT / premium / premium-ammo end-to-end */
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[PAGEERR]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[CONERR]', m.text()); });
  await page.goto(url);
  await new Promise(r => setTimeout(r, 4000));

  const r = await page.evaluate(() => {
    const out = { steps: [] };
    if (typeof Marketplace === 'undefined') { out.fail = 'no Marketplace'; return out; }
    const M = Marketplace;

    // --- 1. premium subscription durations (day/week/month/year)
    const durs = M.getPremiumDurations();
    out.steps.push({ s: 'durations', count: durs.length, keys: durs.map(d => d.key) });

    // --- 2. price calc per duration on bronze tier (idx 0)
    const prices = durs.map(d => ({
      key: d.key,
      ...M.getPremiumPriceFor(0, d.key),
    }));
    out.steps.push({ s: 'bronzePrices', prices });

    // --- 3. buy 1-day premium with OKC (give OKC first)
    M.addOKC(10000);
    const beforeOKC = M.getOKC();
    const dayBuy = M.buyPremiumWithOKC(0, 'day');
    out.steps.push({ s: 'buy-1-day', success: dayBuy, deductedOKC: beforeOKC - M.getOKC(), isPremium: M.isPremium() });

    // --- 4. buy 1-year premium with OKC (stacking)
    M.addOKC(20000);
    const yrBuy = M.buyPremiumWithOKC(0, 'year');
    out.steps.push({ s: 'buy-1-year', success: yrBuy, isPremium: M.isPremium(), info: M.getPremiumInfo() });

    // --- 5. premium ammo catalog
    const ammoTypes = M.getPremiumAmmoTypes();
    out.steps.push({ s: 'ammoCatalog', count: ammoTypes.length, ids: ammoTypes.map(a => a.id) });

    // --- 6. buy 2 packs of GOLD ammo with OKC
    M.addOKC(2000);
    const goldBuy = M.buyPremiumAmmoWithOKC('AMMO_GOLD', 2);
    out.steps.push({ s: 'buy-gold-ammo', success: goldBuy, inv: M.getPremiumAmmoInv() });

    // --- 7. equip GOLD ammo
    const eq = M.equipPremiumAmmo('AMMO_GOLD');
    out.steps.push({ s: 'equip-gold', success: eq, active: M.getActiveAmmoInfo() });

    // --- 8. read base damage of current weapon, then read with premium consumption
    if (typeof Weapons === 'undefined') { out.weapons = 'missing'; return out; }
    // Switch to AK74 (idx 3) for predictable rifle test — UNLOCK FIRST
    Weapons.unlockWeapon && Weapons.unlockWeapon(3);
    Weapons.switchTo(3);
    const def = Weapons.getWeaponDef(3);
    out.steps.push({ s: 'baseDef', name: def.name, type: def.type, damage: def.damage });

    // call getDamage 3 times — each should consume a GOLD round
    const invBefore = (M.getPremiumAmmoInv().AMMO_GOLD) || 0;
    const dmgs = [Weapons.getDamage(), Weapons.getDamage(), Weapons.getDamage()];
    const invAfter = (M.getPremiumAmmoInv().AMMO_GOLD) || 0;
    out.steps.push({ s: 'gold-consume', invBefore, invAfter, dmgs, baseDmg: def.damage, mult: 2.0 });

    // --- 9. unequip
    M.equipPremiumAmmo(null);
    const dmgPlain = Weapons.getDamage();
    out.steps.push({ s: 'unequip-back-to-base', dmgPlain });

    // --- 10. NFT badges + club
    const nfts = M.getNftCatalog();
    const clubTiers = M.getClubTiers();
    out.steps.push({ s: 'nft-club', nftCount: nfts.length, clubCount: clubTiers.length });

    // --- 11. mint stage badge after stage clear (Hostomel = 0)
    const minted = M.mintStageBadge(0);
    out.steps.push({ s: 'mint-stage-badge', success: minted, owned: M.getOwnedNfts().length });

    // --- 12. join club
    M.addOKC(3000);
    const joined = M.joinClubWithOKC(1); // Bronze Knight
    out.steps.push({ s: 'join-club', success: joined, tier: M.getClubTier().name });

    // --- 13. earn multiplier (premium*5 * club*1.25 = 6.25x)
    out.steps.push({ s: 'earn-mult', mult: M.getEarnMultiplier() });

    return out;
  });

  console.log(JSON.stringify(r, null, 2));

  // Validate
  let pass = true;
  const fails = [];
  if (r.fail) { fails.push('init: ' + r.fail); pass = false; }
  for (const step of (r.steps || [])) {
    if (step.s === 'durations' && step.count !== 5) { fails.push('expected 5 durations'); pass = false; }
    if (step.s === 'buy-1-day' && !step.success) { fails.push('1-day buy failed'); pass = false; }
    if (step.s === 'buy-1-year' && !step.success) { fails.push('1-year buy failed'); pass = false; }
    if (step.s === 'buy-gold-ammo' && !step.success) { fails.push('gold ammo buy failed'); pass = false; }
    if (step.s === 'equip-gold' && !step.success) { fails.push('equip gold failed'); pass = false; }
    if (step.s === 'gold-consume') {
      const expected = Math.round(step.baseDmg * step.mult);
      if (!step.dmgs.every(d => d === expected)) { fails.push('damage mult wrong: got ' + step.dmgs + ' expected ' + expected); pass = false; }
      if (step.invBefore - step.invAfter !== 3) { fails.push('inv not consumed by 3: ' + step.invBefore + '->' + step.invAfter); pass = false; }
    }
    if (step.s === 'unequip-back-to-base' && step.dmgPlain !== 30) { fails.push('plain damage not 30: ' + step.dmgPlain); pass = false; }
    if (step.s === 'mint-stage-badge' && !step.success) { fails.push('badge mint failed'); pass = false; }
    if (step.s === 'join-club' && !step.success) { fails.push('club join failed'); pass = false; }
  }

  await browser.close();
  if (pass) {
    console.log('\n[P2E] PASS — premium durations, premium ammo (consume+damage), NFT badges, club all working.');
    process.exit(0);
  } else {
    console.log('\n[P2E] FAIL:\n  ' + fails.join('\n  '));
    process.exit(1);
  }
})();
