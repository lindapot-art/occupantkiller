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
    // Tiered color/size based on damage magnitude (more visceral feedback for big hits)
    var bigHit = amount >= 100;
    var hugeHit = amount >= 250;
    var color = isHeadshot ? '#ff4444'
              : hugeHit    ? '#ff2200'
              : bigHit     ? '#ff8800'
              : isCrit     ? '#ffaa00'
              : amount >= 40 ? '#ffdd44'
              : '#ffffff';
    var size = isHeadshot ? 24
             : hugeHit    ? 30
             : bigHit     ? 26
             : isCrit     ? 20
             : 16;
    var glow = (hugeHit || isHeadshot) ? `,0 0 8px ${color}` : '';
    el.style.cssText = `position:absolute;left:${screenX}px;top:${screenY}px;font-weight:bold;font-size:${size}px;color:${color};text-shadow:1px 1px 2px #000${glow};pointer-events:none;transition:all ${CFG.DMG_NUMBER_DURATION}s ease-out;`;
    if (isHeadshot) el.textContent += ' HS!';
    else if (hugeHit) el.textContent += '!!';
    else if (isCrit) el.textContent += ' CRIT!';
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

  // Escape HTML utility
  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  function addKillFeedEntry(killerName, victimName, weapon, isHeadshot) {
    if (!_feedContainer) initKillFeed();
    const el = document.createElement('div');
    el.style.cssText = 'padding:4px 8px;margin:2px 0;background:rgba(0,0,0,0.7);color:#fff;font-size:12px;border-radius:3px;border-left:3px solid #ff4444;transition:opacity 0.5s;';
    const hs = isHeadshot ? ' 💀' : '';
    el.innerHTML = `<span style="color:#44ff44">${escapeHTML(killerName)}</span> <span style="color:#888">[${escapeHTML(weapon)}]</span> <span style="color:#ff6666">${escapeHTML(victimName)}</span>${hs}`;
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
        var deadEl = killFeed[i].el;
        deadEl.style.opacity = '0';
        setTimeout(function() { if (deadEl.parentNode) deadEl.remove(); }, 500);
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
    // Defer to HUD compass if available (avoid duplicate writes to #tactical-compass)
    if (typeof HUD !== 'undefined' && HUD.updateCompass) return;
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
    if (typeof AudioSystem !== 'undefined' && AudioSystem.playAchievementUnlock) AudioSystem.playAchievementUnlock();
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

  /* ── Feature: Screen Shake ─────────────────── */
  let _shakeIntensity = 0;
  let _shakeDecay = 0;
  let _shakeOffsetX = 0;
  let _shakeOffsetY = 0;

  function triggerScreenShake(intensity, duration) {
    _shakeIntensity = Math.max(_shakeIntensity, intensity);
    _shakeDecay = duration || 0.3;
  }

  function updateScreenShake(dt) {
    if (_shakeIntensity <= 0.001) {
      _shakeOffsetX = 0; _shakeOffsetY = 0;
      return;
    }
    _shakeOffsetX = (Math.random() - 0.5) * 2 * _shakeIntensity;
    _shakeOffsetY = (Math.random() - 0.5) * 2 * _shakeIntensity;
    _shakeIntensity -= (_shakeIntensity / _shakeDecay) * dt;
    if (_shakeIntensity < 0.001) _shakeIntensity = 0;
  }

  function getShakeOffset() { return { x: _shakeOffsetX, y: _shakeOffsetY }; }

  /* ── Feature: Hit Direction Indicator ──────── */
  let _hitIndicators = [];
  let _hitContainer = null;

  function initHitIndicators() {
    _hitContainer = document.getElementById('hit-indicators');
    if (!_hitContainer) {
      _hitContainer = document.createElement('div');
      _hitContainer.id = 'hit-indicators';
      _hitContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:180;';
      document.body.appendChild(_hitContainer);
    }
  }

  function showHitDirection(angle) {
    if (!_hitContainer) initHitIndicators();
    const el = document.createElement('div');
    const deg = (angle * 180 / Math.PI) + 90;
    el.style.cssText = `position:absolute;top:50%;left:50%;width:80px;height:6px;background:linear-gradient(90deg,transparent,rgba(255,50,50,0.8));transform-origin:0 50%;transform:translate(-50%,-50%) rotate(${deg}deg) translateX(60px);border-radius:3px;`;
    _hitContainer.appendChild(el);
    _hitIndicators.push({ el, timer: 1.5 });
  }

  function updateHitIndicators(dt) {
    for (let i = _hitIndicators.length - 1; i >= 0; i--) {
      _hitIndicators[i].timer -= dt;
      _hitIndicators[i].el.style.opacity = Math.max(0, _hitIndicators[i].timer / 1.5);
      if (_hitIndicators[i].timer <= 0) {
        _hitIndicators[i].el.remove();
        _hitIndicators.splice(i, 1);
      }
    }
  }

  /* ── Feature: Kill Confirmation Effects ────── */
  let _killConfirmTimer = 0;
  function showKillConfirm() {
    _killConfirmTimer = 0.4;
    const el = document.getElementById('kill-confirm');
    if (!el) {
      const d = document.createElement('div');
      d.id = 'kill-confirm';
      d.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff4444;font-size:28px;font-weight:bold;pointer-events:none;z-index:210;text-shadow:0 0 8px #ff0000;opacity:0;transition:opacity 0.15s;';
      d.textContent = '✕';
      document.body.appendChild(d);
      requestAnimationFrame(() => { d.style.opacity = '1'; });
    } else {
      el.style.opacity = '1';
    }
  }

  function updateKillConfirm(dt) {
    if (_killConfirmTimer > 0) {
      _killConfirmTimer -= dt;
      if (_killConfirmTimer <= 0) {
        const el = document.getElementById('kill-confirm');
        if (el) el.style.opacity = '0';
      }
    }
  }

  /* ── Feature: XP Pop-up ────────────────────── */
  function showXPGain(amount, screenX, screenY) {
    if (!_dmgContainer) initDamageNumbers();
    const el = document.createElement('div');
    el.textContent = '+' + amount + ' XP';
    el.style.cssText = `position:absolute;left:${screenX || window.innerWidth / 2}px;top:${screenY || window.innerHeight * 0.4}px;color:#44ddff;font-size:14px;font-weight:bold;text-shadow:0 0 4px #00aaff;pointer-events:none;transition:all 1.0s ease-out;`;
    _dmgContainer.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = ((screenY || window.innerHeight * 0.4) - 30) + 'px';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 1100);
  }

  /* ── Feature: Streak Score Multiplier Pop-up ────── */
  function showStreakMult(mult, screenX, screenY) {
    if (!_dmgContainer) initDamageNumbers();
    if (mult <= 1.05) return; // skip trivial
    const el = document.createElement('div');
    el.textContent = '×' + mult.toFixed(1);
    var hot = mult >= 2.0;
    var color = hot ? '#ff8800' : '#ffcc44';
    var size = hot ? '22px' : '18px';
    var glow = hot ? '0 0 8px #ff5500,0 0 14px #ff0000' : '0 0 5px #aa6600';
    el.style.cssText = 'position:absolute;left:' + (screenX || window.innerWidth / 2) + 'px;top:' + (screenY || window.innerHeight * 0.42) + 'px;color:' + color + ';font-size:' + size + ';font-weight:bold;text-shadow:' + glow + ';pointer-events:none;transition:all 0.9s ease-out;font-family:monospace;';
    _dmgContainer.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = ((screenY || window.innerHeight * 0.42) - 38) + 'px';
      el.style.opacity = '0';
      el.style.transform = 'scale(1.4)';
    });
    setTimeout(() => el.remove(), 1000);
  }

  /* ── Feature: Critical Hit Slow-Mo Flash ───── */
  let _slowMoTimer = 0;
  let _slowMoRate = 1.0;

  function triggerSlowMo(duration, rate) {
    _slowMoTimer = duration || 0.2;
    _slowMoRate = rate || 0.3;
  }

  function getSlowMoRate() {
    return _slowMoTimer > 0 ? _slowMoRate : 1.0;
  }

  function updateSlowMo(dt) {
    if (_slowMoTimer > 0) _slowMoTimer -= dt;
  }

  /* ── Feature: Hitstop (Kill Impact Freeze) ───── */
  var _hitStopTimer = 0;

  function triggerHitStop(frames) {
    // frames: 1 = normal kill (~16ms), 3 = headshot (~50ms), 4 = explosive multi (~66ms)
    var duration = (frames || 1) * 0.016;
    if (duration > _hitStopTimer) _hitStopTimer = duration;
  }

  function isHitStopped() {
    return _hitStopTimer > 0;
  }

  function updateHitStop(realDt) {
    if (_hitStopTimer > 0) _hitStopTimer -= realDt;
  }

  /* ── Feature: Weapon Pickup Notification ───── */
  function showWeaponPickup(weaponName) {
    let el = document.getElementById('weapon-pickup-notify');
    if (!el) {
      el = document.createElement('div');
      el.id = 'weapon-pickup-notify';
      el.style.cssText = 'position:fixed;bottom:25%;left:50%;transform:translateX(-50%);color:#ffdd44;font-size:18px;font-weight:bold;text-shadow:0 0 6px #aa8800;pointer-events:none;z-index:200;transition:opacity 0.5s;';
      document.body.appendChild(el);
    }
    el.textContent = '🔫 ' + weaponName + ' ACQUIRED';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
  }

  /* ── Feature: Environmental Warning ────────── */
  function showEnvironmentWarning(text) {
    let el = document.getElementById('env-warning');
    if (!el) {
      el = document.createElement('div');
      el.id = 'env-warning';
      el.style.cssText = 'position:fixed;top:18%;left:50%;transform:translateX(-50%);color:#ffaa00;font-size:16px;font-weight:bold;text-shadow:0 0 4px #cc6600;pointer-events:none;z-index:200;transition:opacity 0.5s;';
      document.body.appendChild(el);
    }
    el.textContent = '⚠ ' + text;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 3000);
  }

  /* ── Master Update ─────────────────────────── */
  function update(dt, yaw) {
    updateDamageNumbers(dt);
    updateKillFeed(dt);
    updatePings(dt);
    updateCompass(dt, yaw || 0);
    updateScreenShake(dt);
    updateHitIndicators(dt);
    updateKillConfirm(dt);
    updateSlowMo(dt);
  }

  function init() {
    initDamageNumbers();
    initKillFeed();
    initCompass();
    initAchievements();
    initDynamicCrosshair();
    initHitIndicators();
  }

  function clear() {
    damageNumbers.forEach(d => d.el.remove());
    killFeed.forEach(k => k.el.remove());
    damageNumbers = [];
    killFeed = [];
    pings = [];
    achievementQueue = [];
    _hitIndicators.forEach(h => h.el.remove());
    _hitIndicators = [];
    _shakeIntensity = 0;
    _killConfirmTimer = 0;
    _slowMoTimer = 0;
    _hitStopTimer = 0;
  }

  function resetAchievements() {
    unlockedAchievements.clear();
    achievementQueue = [];
  }

  // ── Battlefield Radio Chatter ────────────────────────────────────
  var _radioLines = {
    wave_start: [
      '📻 Command: Contacts bearing north, engage at will',
      '📻 Spotter: Movement ahead, multiple hostiles',
      '📻 Command: Wave inbound, weapons free',
      '📻 Intel: Enemy force mobilizing, stand ready',
    ],
    mid_wave: [
      '📻 Spotter: Heavy armor moving up the road',
      '📻 Recon: Flankers spotted, watch your six',
      '📻 Command: Keep pushing, they\'re faltering',
      '📻 Intel: Enemy reinforcements en route',
    ],
    low_hp: [
      '📻 Medic: Soldier, get to cover NOW!',
      '📻 Command: We see you\'re hit, find cover and patch up',
      '📻 Medic: Stay alive, don\'t be a hero',
    ],
    kill_streak: [
      '📻 Command: Outstanding work, keep it up',
      '📻 Spotter: They\'re running scared',
      '📻 Command: That\'s how it\'s done, soldier',
    ],
    wave_clear: [
      '📻 All clear. Good shooting, soldier.',
      '📻 Command: Area secured, standby for next wave',
      '📻 Recon: Hostiles eliminated. Take a breath.',
    ],
    stage_clear: [
      '📻 Command: Sector secured! Outstanding performance.',
      '📻 HQ: Move to next objective, soldier. Glory to Ukraine.',
      '📻 Command: All units, advance to next sector.',
    ],
    first_blood: [
      '📻 Spotter: First contact confirmed. Good kill.',
      '📻 Command: First blood. Let\'s keep the pressure on.',
    ],
  };
  var _lastRadioTime = 0;
  var _radioCooldown = 8000; // min ms between radio lines

  function radioChatter(context) {
    var now = Date.now();
    if (now - _lastRadioTime < _radioCooldown) return;
    var lines = _radioLines[context];
    if (!lines || lines.length === 0) return;
    var line = lines[Math.floor(Math.random() * lines.length)];
    _lastRadioTime = now;
    if (typeof HUD !== 'undefined' && HUD.addCombatLog) {
      HUD.addCombatLog(line, '#7cb342');
    }
  }

  /* ── Contextual Input Tips (adaptive tutorial) ───── */
  var _tips = [
    { id: 'lean',     wave: 2, text: '💡 Press Q/E to lean around cover' },
    { id: 'build',    wave: 3, text: '💡 Press B to enter Build Mode — place walls & turrets' },
    { id: 'sprint',   wave: 1, text: '💡 Hold SHIFT to sprint' },
    { id: 'drone',    wave: 4, text: '💡 Press F to deploy your recon drone' },
    { id: 'vehicle',  wave: 5, text: '💡 Press G near a vehicle to drive it' },
    { id: 'ammo',     wave: 3, text: '💡 Press T to switch ammo types' },
    { id: 'reload',   wave: 1, text: '💡 Press R to reload your weapon' },
  ];
  var _shownTips = {};
  var _tipCheckTimer = 0;
  var _tipEl = null;
  var _tipFadeTimer = null;
  try {
    var _st = localStorage.getItem('ok_tips_shown');
    if (_st) _shownTips = JSON.parse(_st) || {};
  } catch (e) { _shownTips = {}; }

  function showTip(text) {
    if (!_tipEl) {
      _tipEl = document.createElement('div');
      _tipEl.style.cssText = 'position:fixed;bottom:18%;left:50%;transform:translateX(-50%);color:#4fc3f7;font-size:14px;font-weight:bold;text-shadow:0 0 8px rgba(79,195,247,0.4);pointer-events:none;z-index:250;transition:opacity 0.6s;text-align:center;max-width:500px;';
      document.body.appendChild(_tipEl);
    }
    _tipEl.textContent = text;
    _tipEl.style.opacity = '1';
    if (_tipFadeTimer) clearTimeout(_tipFadeTimer);
    _tipFadeTimer = setTimeout(function () { if (_tipEl) _tipEl.style.opacity = '0'; }, 4000);
  }

  function dismissTip(id) {
    if (_tipFadeTimer) clearTimeout(_tipFadeTimer);
    if (_tipEl) _tipEl.style.opacity = '0';
    if (id) {
      _shownTips[id] = true;
      try { localStorage.setItem('ok_tips_shown', JSON.stringify(_shownTips)); } catch (e) {}
    }
  }

  function checkTips(currentWave) {
    _tipCheckTimer += 0.016; // roughly per-frame, throttled by caller
    if (_tipCheckTimer < 1.0) return; // check every 1s
    _tipCheckTimer = 0;
    // Desktop key tips (SHIFT/R/T/B/F/G/Q/E) are useless and visually intrusive on mobile.
    var isMobile = typeof document !== 'undefined' && document.documentElement
      && document.documentElement.classList && document.documentElement.classList.contains('is-mobile');
    if (isMobile) return;
    for (var i = 0; i < _tips.length; i++) {
      var tip = _tips[i];
      if (_shownTips[tip.id]) continue;
      if (currentWave >= tip.wave) {
        _shownTips[tip.id] = true;
        try { localStorage.setItem('ok_tips_shown', JSON.stringify(_shownTips)); } catch (e) {}
        showTip(tip.text);
        return; // only one tip per check
      }
    }
  }

  function resetTips() {
    _shownTips = {};
    try { localStorage.removeItem('ok_tips_shown'); } catch (e) {}
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
    updateDynamicCrosshair, initDynamicCrosshair,
    // Screen shake
    triggerScreenShake, getShakeOffset,
    // Hit direction
    showHitDirection,
    // Kill confirm
    showKillConfirm,
    // XP popup
    showXPGain,
    showStreakMult,
    // Slow-mo
    triggerSlowMo, getSlowMoRate,
    // Hitstop
    triggerHitStop, isHitStopped, updateHitStop,
    // Weapon pickup
    showWeaponPickup,
    // Environment warning
    showEnvironmentWarning,
    radioChatter,
    // Contextual tips
    checkTips, resetTips, showTip, dismissTip,
  };
})();
if (typeof window !== 'undefined') window.Feedback = Feedback;
