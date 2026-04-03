/* ============================================================
 *  FEEDBACK.JS — 7 new UI/feedback features
 *  Features: floating damage numbers, kill feed, ping markers,
 *  tactical compass, weapon comparison, mini achievements,
 *  dynamic crosshair
 * ============================================================ */
const Feedback = (function () {
  'use strict';

  /* ── Configuration ─────────────────────────── */
  const CFG = {
    DMG_NUMBER_DURATION: 1.2,     // seconds
    DMG_NUMBER_RISE: 40,          // pixels upward
    KILL_FEED_MAX: 6,             // entries visible
    KILL_FEED_DURATION: 5,        // seconds per entry
    PING_DURATION: 8,             // seconds
    PING_MAX: 5,
    COMPASS_UPDATE_RATE: 0.1,     // seconds between compass updates
    ACHIEVEMENT_DISPLAY: 4,       // seconds
    CROSSHAIR_BASE: 8,            // px
    CROSSHAIR_MAX_SPREAD: 24      // px
  };

  /* ── Feature 46: Floating Damage Numbers ───── */
  let damageNumbers = [];
  let _dmgContainer = null;

  function initDamageNumbers() {
    _dmgContainer = document.getElementById('damage-numbers');
    if (!_dmgContainer) {
      _dmgContainer = document.createElement('div');
      _dmgContainer.id = 'damage-numbers';
      _dmgContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:200;overflow:hidden;';
      document.body.appendChild(_dmgContainer);
    }
  }

  function spawnDamageNumber(screenX, screenY, amount, isHeadshot, isCrit) {
    if (!_dmgContainer) initDamageNumbers();
    const el = document.createElement('div');
    el.className = 'dmg-number';
    el.textContent = Math.round(amount);
    el.style.cssText = `position:absolute;left:${screenX}px;top:${screenY}px;font-weight:bold;font-size:${isHeadshot ? 24 : isCrit ? 20 : 16}px;color:${isHeadshot ? '#ff4444' : isCrit ? '#ffaa00' : '#ffffff'};text-shadow:1px 1px 2px #000;pointer-events:none;transition:all ${CFG.DMG_NUMBER_DURATION}s ease-out;`;
    if (isHeadshot) el.textContent += ' HS!';
    if (isCrit) el.textContent += ' CRIT!';
    _dmgContainer.appendChild(el);
    // animate
    requestAnimationFrame(() => {
      el.style.top = (screenY - CFG.DMG_NUMBER_RISE) + 'px';
      el.style.opacity = '0';
    });
    damageNumbers.push({ el, timer: CFG.DMG_NUMBER_DURATION });
  }

  function updateDamageNumbers(dt) {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      damageNumbers[i].timer -= dt;
      if (damageNumbers[i].timer <= 0) {
        damageNumbers[i].el.remove();
        damageNumbers.splice(i, 1);
      }
    }
  }

  /* ── Feature 47: Kill Feed ─────────────────── */
  let killFeed = [];
  let _feedContainer = null;

  function initKillFeed() {
    _feedContainer = document.getElementById('kill-feed');
    if (!_feedContainer) {
      _feedContainer = document.createElement('div');
      _feedContainer.id = 'kill-feed';
      _feedContainer.style.cssText = 'position:fixed;top:80px;right:10px;width:280px;pointer-events:none;z-index:200;font-family:monospace;';
      document.body.appendChild(_feedContainer);
    }
  }

  function addKillFeedEntry(killerName, victimName, weapon, isHeadshot) {
    if (!_feedContainer) initKillFeed();
    const el = document.createElement('div');
    el.style.cssText = 'padding:4px 8px;margin:2px 0;background:rgba(0,0,0,0.7);color:#fff;font-size:12px;border-radius:3px;border-left:3px solid #ff4444;transition:opacity 0.5s;';
    const hs = isHeadshot ? ' 💀' : '';
    el.innerHTML = `<span style="color:#44ff44">${killerName}</span> <span style="color:#888">[${weapon}]</span> <span style="color:#ff6666">${victimName}</span>${hs}`;
    _feedContainer.prepend(el);
    killFeed.unshift({ el, timer: CFG.KILL_FEED_DURATION });
    // prune
    while (killFeed.length > CFG.KILL_FEED_MAX) {
      const old = killFeed.pop();
      old.el.remove();
    }
  }

  function updateKillFeed(dt) {
    for (let i = killFeed.length - 1; i >= 0; i--) {
      killFeed[i].timer -= dt;
      if (killFeed[i].timer <= 0) {
        killFeed[i].el.style.opacity = '0';
        setTimeout(() => { killFeed[i] && killFeed[i].el.remove(); }, 500);
        killFeed.splice(i, 1);
      }
    }
  }

  /* ── Feature 48: Ping/Marker System ────────── */
  let pings = [];

  function addPing(worldX, worldY, worldZ, label, color) {
    if (pings.length >= CFG.PING_MAX) pings.shift();
    pings.push({
      x: worldX, y: worldY, z: worldZ,
      label: label || 'MARK', color: color || '#ffff00',
      timer: CFG.PING_DURATION
    });
  }

  function updatePings(dt) {
    for (let i = pings.length - 1; i >= 0; i--) {
      pings[i].timer -= dt;
      if (pings[i].timer <= 0) pings.splice(i, 1);
    }
  }

  function getPings() { return pings; }

  /* ── Feature 49: Tactical Compass ──────────── */
  let _compassEl = null;
  let compassTimer = 0;

  function initCompass() {
    _compassEl = document.getElementById('tactical-compass');
    if (!_compassEl) {
      _compassEl = document.createElement('div');
      _compassEl.id = 'tactical-compass';
      _compassEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);width:300px;height:30px;background:rgba(0,0,0,0.6);color:#fff;font-family:monospace;font-size:11px;text-align:center;line-height:30px;border-radius:4px;z-index:200;pointer-events:none;';
      document.body.appendChild(_compassEl);
    }
  }

  function updateCompass(dt, yaw) {
    compassTimer -= dt;
    if (compassTimer > 0) return;
    compassTimer = CFG.COMPASS_UPDATE_RATE;
    if (!_compassEl) initCompass();

    const deg = (((-yaw * 180 / Math.PI) % 360) + 360) % 360;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    const bearing = Math.round(deg);

    let markers = '';
    // Show nearby cardinal directions
    for (let offset = -2; offset <= 2; offset++) {
      const di = ((idx + offset) % 8 + 8) % 8;
      const style = offset === 0 ? 'color:#ff4444;font-weight:bold' : 'color:#888';
      markers += `<span style="${style};margin:0 12px">${dirs[di]}</span>`;
    }
    _compassEl.innerHTML = `${markers} <span style="color:#aaa;font-size:10px">${bearing}°</span>`;
  }

  /* ── Feature 50: Weapon Comparison ─────────── */
  let _compareEl = null;

  function showWeaponCompare(weapon1, weapon2) {
    if (!_compareEl) {
      _compareEl = document.createElement('div');
      _compareEl.id = 'weapon-compare';
      _compareEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;background:rgba(0,0,0,0.9);color:#fff;padding:20px;border:1px solid #444;border-radius:8px;z-index:500;font-family:monospace;font-size:13px;';
      document.body.appendChild(_compareEl);
    }
    const stats = ['damage', 'fireRate', 'clipSize', 'range', 'spread'];
    let html = '<div style="text-align:center;font-size:16px;margin-bottom:12px;color:#ffcc00">⚔️ WEAPON COMPARISON</div>';
    html += '<table style="width:100%;border-collapse:collapse">';
    html += `<tr style="border-bottom:1px solid #555"><th></th><th style="color:#44ff44">${weapon1.name}</th><th style="color:#ff6644">${weapon2.name}</th></tr>`;
    for (const stat of stats) {
      const v1 = weapon1[stat] || 0, v2 = weapon2[stat] || 0;
      const c1 = v1 > v2 ? '#44ff44' : v1 < v2 ? '#ff4444' : '#888';
      const c2 = v2 > v1 ? '#44ff44' : v2 < v1 ? '#ff4444' : '#888';
      html += `<tr><td style="padding:4px;color:#aaa">${stat}</td><td style="color:${c1};text-align:center">${v1}</td><td style="color:${c2};text-align:center">${v2}</td></tr>`;
    }
    html += '</table><div style="text-align:center;margin-top:10px;color:#666;font-size:11px">Press ESC to close</div>';
    _compareEl.innerHTML = html;
    _compareEl.style.display = 'block';
  }

  function hideWeaponCompare() {
    if (_compareEl) _compareEl.style.display = 'none';
  }

  /* ── Feature 51: Mini Achievement Popups ───── */
  const ACHIEVEMENTS = {
    FIRST_BLOOD: { name: 'First Blood', desc: 'Get your first kill', icon: '🩸', points: 10 },
    SHARPSHOOTER: { name: 'Sharpshooter', desc: '10 headshots', icon: '🎯', points: 25 },
    DEMOLISHER: { name: 'Demolisher', desc: 'Destroy 50 blocks', icon: '💥', points: 15 },
    SURVIVOR: { name: 'Survivor', desc: 'Survive 5 waves', icon: '🛡️', points: 20 },
    MILLIONAIRE: { name: 'Millionaire', desc: 'Earn 10000 OKC', icon: '💰', points: 30 },
    VEHICULAR: { name: 'Road Warrior', desc: 'Get 5 vehicle kills', icon: '🚗', points: 20 },
    DRONE_ACE: { name: 'Drone Ace', desc: '10 drone kills', icon: '🤖', points: 25 },
    ARCHITECT: { name: 'Master Builder', desc: 'Build 20 structures', icon: '🏗️', points: 20 },
    WAVE_10: { name: 'Wave Master', desc: 'Complete wave 10', icon: '🌊', points: 50 },
    NO_DAMAGE: { name: 'Untouchable', desc: 'Complete wave without damage', icon: '✨', points: 40 },
    SPEED_RUN: { name: 'Speed Demon', desc: 'Clear wave in under 30s', icon: '⚡', points: 35 },
    SNIPER_ELITE_ACH: { name: 'Sniper Elite', desc: '5 kills at 30m+', icon: '🔭', points: 30 },
    MELEE_MASTER: { name: 'Melee Master', desc: '10 melee kills', icon: '🗡️', points: 25 },
    EXPLOSION_KING: { name: 'Explosion King', desc: '3 multi-kills with explosions', icon: '🔥', points: 30 },
    COLLECTOR: { name: 'Collector', desc: 'Own 10 weapons', icon: '🎒', points: 20 },
    COMMANDER: { name: 'Commander', desc: 'Have 5 NPCs active', icon: '⭐', points: 25 },
    ECONOMIST: { name: 'Economist', desc: 'Buy 5 items from shop', icon: '🏪', points: 15 },
    EXPLORER: { name: 'Explorer', desc: 'Visit all map regions', icon: '🗺️', points: 20 },
    MULTI_KILL: { name: 'Multi Kill', desc: '4 kills in 3 seconds', icon: '💀', points: 30 },
    PACIFIST_WAVE: { name: 'Pacifist', desc: 'Let 5 enemies surrender', icon: '🏳️', points: 35 }
  };

  let unlockedAchievements = new Set();
  let achievementQueue = [];
  let _achContainer = null;

  function initAchievements() {
    _achContainer = document.getElementById('achievement-popups');
    if (!_achContainer) {
      _achContainer = document.createElement('div');
      _achContainer.id = 'achievement-popups';
      _achContainer.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:300;pointer-events:none;';
      document.body.appendChild(_achContainer);
    }
  }

  function unlockAchievement(id) {
    if (unlockedAchievements.has(id)) return false;
    const ach = ACHIEVEMENTS[id];
    if (!ach) return false;
    unlockedAchievements.add(id);
    achievementQueue.push({ ...ach, timer: CFG.ACHIEVEMENT_DISPLAY });
    showAchievementPopup(ach);
    return true;
  }

  function showAchievementPopup(ach) {
    if (!_achContainer) initAchievements();
    const el = document.createElement('div');
    el.style.cssText = 'background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #e94560;color:#fff;padding:12px 20px;border-radius:8px;margin:4px;font-family:monospace;text-align:center;animation:achievePop 0.3s ease-out;';
    el.innerHTML = `<div style="font-size:20px">${ach.icon}</div><div style="color:#e94560;font-weight:bold;font-size:14px">ACHIEVEMENT UNLOCKED</div><div style="color:#fff;font-size:12px">${ach.name}</div><div style="color:#888;font-size:10px">${ach.desc} (+${ach.points}pts)</div>`;
    _achContainer.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.5s'; }, (CFG.ACHIEVEMENT_DISPLAY - 0.5) * 1000);
    setTimeout(() => el.remove(), CFG.ACHIEVEMENT_DISPLAY * 1000);
  }

  function getAchievements() { return ACHIEVEMENTS; }
  function getUnlocked() { return [...unlockedAchievements]; }
  function getAchievementPoints() {
    let total = 0;
    for (const id of unlockedAchievements) {
      if (ACHIEVEMENTS[id]) total += ACHIEVEMENTS[id].points;
    }
    return total;
  }

  /* ── Feature 52: Dynamic Crosshair ─────────── */
  let _crosshairLines = null;
  let currentSpread = CFG.CROSSHAIR_BASE;

  function initDynamicCrosshair() {
    // Crosshair is managed via CSS transforms on existing crosshair element
    _crosshairLines = document.querySelectorAll('.crosshair-line');
  }

  function updateDynamicCrosshair(spread, moving, firing, ads) {
    let targetSpread = CFG.CROSSHAIR_BASE;
    if (moving) targetSpread += 6;
    if (firing) targetSpread += 8;
    if (ads) targetSpread = Math.max(2, targetSpread * 0.4);
    targetSpread += spread * 10;
    targetSpread = Math.min(targetSpread, CFG.CROSSHAIR_MAX_SPREAD);
    currentSpread += (targetSpread - currentSpread) * 0.15;

    if (_crosshairLines && _crosshairLines.length >= 4) {
      _crosshairLines[0].style.transform = `translateY(-${currentSpread}px)`;
      _crosshairLines[1].style.transform = `translateY(${currentSpread}px)`;
      _crosshairLines[2].style.transform = `translateX(-${currentSpread}px)`;
      _crosshairLines[3].style.transform = `translateX(${currentSpread}px)`;
    }
  }

  /* ── Master Update ─────────────────────────── */
  function update(dt, yaw) {
    updateDamageNumbers(dt);
    updateKillFeed(dt);
    updatePings(dt);
    updateCompass(dt, yaw || 0);
  }

  function init() {
    initDamageNumbers();
    initKillFeed();
    initCompass();
    initAchievements();
    initDynamicCrosshair();
  }

  function clear() {
    damageNumbers.forEach(d => d.el.remove());
    killFeed.forEach(k => k.el.remove());
    damageNumbers = [];
    killFeed = [];
    pings = [];
    achievementQueue = [];
  }

  function resetAchievements() {
    unlockedAchievements.clear();
    achievementQueue = [];
  }

  return {
    CFG, ACHIEVEMENTS,
    init, clear, update,
    // Damage numbers
    spawnDamageNumber,
    // Kill feed
    addKillFeedEntry,
    // Pings
    addPing, getPings,
    // Compass
    updateCompass,
    // Weapon compare
    showWeaponCompare, hideWeaponCompare,
    // Achievements
    unlockAchievement, getAchievements, getUnlocked, getAchievementPoints, resetAchievements,
    // Crosshair
    updateDynamicCrosshair, initDynamicCrosshair
  };
})();
