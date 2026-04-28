/* ───────────────────────────────────────────────────────────────────────
   TOKENOMICS — OKC token supply, emission schedule, sinks, fiat rates
   Single source of truth for in-game economy parameters.
   Depends on: nothing (pure data + helpers)
   ─────────────────────────────────────────────────────────────────────── */
const Tokenomics = (function () {
  'use strict';

  /* ── Hard cap & distribution (1 billion OKC total) ──────────────── */
  const TOTAL_SUPPLY = 1_000_000_000; // 1B OKC
  const DISTRIBUTION = {
    playToEarn:  { pct: 50, amount: 500_000_000, label: 'Play-to-Earn Reward Pool',  vesting: '8-year halving schedule' },
    treasury:    { pct: 20, amount: 200_000_000, label: 'DAO Treasury',              vesting: '4-year linear unlock'   },
    liquidity:   { pct: 12, amount: 120_000_000, label: 'Liquidity & Market Making', vesting: 'Unlocked at TGE'        },
    team:        { pct: 10, amount: 100_000_000, label: 'Team & Founders',           vesting: '12mo cliff, 36mo vest'  },
    donations:   { pct:  5, amount:  50_000_000, label: 'Ukraine Army Donations',    vesting: '5% of all proceeds'     },
    advisors:    { pct:  2, amount:  20_000_000, label: 'Advisors & Partners',       vesting: '6mo cliff, 24mo vest'   },
    airdrops:    { pct:  1, amount:  10_000_000, label: 'Community Airdrops',        vesting: 'Discretionary'          },
  };

  /* ── Halving schedule for play-to-earn emission ─────────────────── */
  const EMISSION = {
    initialDailyEmission: 200_000,   // OKC/day in year 1
    halvingPeriodDays:    365,       // halve every 12 months
    minEmission:          12_500,    // floor (year 5+)
  };

  /* ── Fiat exchange rate (off-chain reference price) ────────────── */
  /* Initial peg: $1 USD = 1000 OKC (i.e. 1 OKC = $0.001).
     Will adjust based on liquidity-pool TWAP once on-chain. */
  let usdPerOKC = 0.001;
  function getUsdPerOKC() { return usdPerOKC; }
  function setUsdPerOKC(v) { if (v > 0 && v < 1000) usdPerOKC = v; }
  function usdToOKC(usd)  { return Math.floor(Number(usd) / usdPerOKC); }
  function okcToUSD(okc)  { return parseFloat((Number(okc) * usdPerOKC).toFixed(4)); }

  /* ── Fiat purchase tiers (CashApp-friendly amounts) ─────────────── */
  /* Bonus % rewards larger top-ups. */
  const FIAT_PACKS = [
    { id: 'pack_starter', label: 'Starter',   usd:  5,  baseOKC:  5_000,  bonusPct:  0  },
    { id: 'pack_grunt',   label: 'Grunt',     usd: 10,  baseOKC: 10_000,  bonusPct:  5  },
    { id: 'pack_squad',   label: 'Squad',     usd: 25,  baseOKC: 25_000,  bonusPct: 10  },
    { id: 'pack_platoon', label: 'Platoon',   usd: 50,  baseOKC: 50_000,  bonusPct: 15  },
    { id: 'pack_company', label: 'Company',   usd: 100, baseOKC: 100_000, bonusPct: 25  },
    { id: 'pack_battalion',label:'Battalion', usd: 250, baseOKC: 250_000, bonusPct: 35  },
    { id: 'pack_brigade', label: 'Brigade',   usd: 500, baseOKC: 500_000, bonusPct: 50  },
  ];

  function getFiatPacks() {
    return FIAT_PACKS.map(function (p) {
      var bonus = Math.floor(p.baseOKC * p.bonusPct / 100);
      return Object.assign({}, p, {
        bonusOKC:  bonus,
        totalOKC:  p.baseOKC + bonus,
        effectiveRate: (p.baseOKC + bonus) / p.usd, // OKC per $1
      });
    });
  }

  function getPackById(id) {
    return getFiatPacks().find(function (p) { return p.id === id; }) || null;
  }

  /* ── Sinks (deflationary outflows) ──────────────────────────────── */
  /* % of every spend that is BURNED rather than recycled to treasury. */
  const BURN_RATES = {
    premium:        0.20, // 20% of premium subscription cost burned
    premiumAmmo:    0.30, // 30% of premium ammo cost burned
    cosmetics:      0.10, // 10% of cosmetic asset cost burned
    weaponUnlock:   0.15, // 15% of weapon unlock cost burned
    ammoRefill:     0.05, // 5% of ammo refill cost burned
  };

  /* ── Emission helpers (read by frontend HUD/admin) ──────────────── */
  function currentDailyEmission(daysSinceTGE) {
    var halvings = Math.floor((daysSinceTGE || 0) / EMISSION.halvingPeriodDays);
    var emission = EMISSION.initialDailyEmission / Math.pow(2, halvings);
    return Math.max(EMISSION.minEmission, Math.floor(emission));
  }

  /* Live stats: cross-references Marketplace state when present. */
  function getLiveStats() {
    var okcOwned = 0;
    if (typeof Marketplace !== 'undefined' && Marketplace.getOKC) okcOwned = Marketplace.getOKC();
    var premium = false;
    if (typeof Marketplace !== 'undefined' && Marketplace.isPremium) premium = Marketplace.isPremium();
    return {
      totalSupply:     TOTAL_SUPPLY,
      circulating:     null, /* filled by backend in production */
      yourBalance:     okcOwned,
      premiumActive:   premium,
      currentRateUSD:  usdPerOKC,
      okcPerDollar:    Math.round(1 / usdPerOKC),
    };
  }

  /* ── Public API ─────────────────────────────────────────────────── */
  var api = {
    TOTAL_SUPPLY, DISTRIBUTION, EMISSION, BURN_RATES,
    getUsdPerOKC, setUsdPerOKC,
    usdToOKC, okcToUSD,
    getFiatPacks, getPackById,
    currentDailyEmission, getLiveStats,
  };
  if (typeof window !== 'undefined') window.Tokenomics = api;
  return api;
})();
