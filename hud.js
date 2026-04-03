/**
 * hud.js – Heads-Up Display helpers
 * Depends on: nothing (pure DOM)
 */

const HUD = (() => {
  const el = {
    hud:          document.getElementById('hud'),
    score:        document.getElementById('score-display'),
    wave:         document.getElementById('wave-display'),
    kills:        document.getElementById('kills-display'),
    enemies:      document.getElementById('enemies-display'),
    stage:        document.getElementById('stage-display'),
    healthBar:    document.getElementById('health-bar'),
    healthVal:    document.getElementById('health-value'),
    ammo:         document.getElementById('ammo-display'),
    ammoRes:      document.getElementById('ammo-reserve'),
    weaponName:   document.getElementById('weapon-name-display'),
    weaponSlots:  Array.from({length: 30}, function(_, i) { return document.getElementById('wslot-' + i); }),
    reload:       document.getElementById('reload-indicator'),
    hitMarker:    document.getElementById('hit-marker'),
    vignette:     document.getElementById('damage-vignette'),
    waveAnn:      document.getElementById('wave-announce'),
    headshotNotif: document.getElementById('headshot-notif'),
    pickupNotif:   document.getElementById('pickup-notif'),
  };

  let hitMarkerTimer   = null;
  let vignetteTimer    = null;
  let headshotTimer    = null;
  let pickupTimer      = null;

  function show() { el.hud.style.display = 'block'; }
  function hide() { el.hud.style.display = 'none'; }

  function setScore(v)   { el.score.textContent   = 'SCORE: '   + v; }
  function setWave(v, total) {
    el.wave.textContent = total ? 'WAVE: ' + v + '/' + total : 'WAVE: ' + v;
  }
  function setKills(v)   { el.kills.textContent    = 'KILLS: '   + v; }
  function setEnemies(v) { el.enemies.textContent  = 'ENEMIES: ' + v; }
  function setStage(num, name) {
    if (el.stage) el.stage.textContent = 'STAGE ' + num + ': ' + name;
  }

  function setHealth(current, max) {
    const pct = Math.max(0, current / max) * 100;
    el.healthBar.style.width  = pct + '%';
    el.healthBar.style.background = pct > 50
      ? 'linear-gradient(90deg,#ff2222,#ff6666)'
      : pct > 25
        ? 'linear-gradient(90deg,#ff6600,#ffaa44)'
        : 'linear-gradient(90deg,#ff0000,#ff3333)';
    el.healthVal.textContent = Math.ceil(current) + ' / ' + max;
  }

  function setAmmo(clip, reserve) {
    el.ammo.textContent    = clip;
    el.ammoRes.textContent = '/ ' + reserve;
  }

  function setWeapon(name, idx) {
    if (el.weaponName) el.weaponName.textContent = name;
    el.weaponSlots.forEach((s, i) => {
      if (!s) return;
      s.classList.toggle('active', i === idx);
      const isLocked = typeof Weapons !== 'undefined' && !Weapons.isUnlocked(i);
      s.classList.toggle('locked', isLocked);
    });
  }

  function showReload(on) {
    if (on) el.reload.classList.add('visible');
    else    el.reload.classList.remove('visible');
  }

  function flashHit(isHeadshot) {
    el.hitMarker.classList.add('visible');
    if (isHeadshot) el.hitMarker.classList.add('headshot');
    else            el.hitMarker.classList.remove('headshot');
    clearTimeout(hitMarkerTimer);
    hitMarkerTimer = setTimeout(() => {
      el.hitMarker.classList.remove('visible', 'headshot');
    }, 140);
  }

  function flashDamage() {
    el.vignette.classList.add('hit');
    clearTimeout(vignetteTimer);
    vignetteTimer = setTimeout(() => el.vignette.classList.remove('hit'), 300);
  }

  function showHeadshot() {
    el.headshotNotif.classList.remove('visible');
    void el.headshotNotif.offsetWidth;
    el.headshotNotif.classList.add('visible');
    clearTimeout(headshotTimer);
    headshotTimer = setTimeout(() => el.headshotNotif.classList.remove('visible'), 1200);
  }

  function notifyPickup(text, color) {
    el.pickupNotif.textContent  = text;
    el.pickupNotif.style.color  = color;
    el.pickupNotif.classList.remove('visible');
    void el.pickupNotif.offsetWidth;
    el.pickupNotif.classList.add('visible');
    clearTimeout(pickupTimer);
    pickupTimer = setTimeout(() => el.pickupNotif.classList.remove('visible'), 1600);
  }

  function announceWave(number, enemyCount, totalWaves) {
    const progress = totalWaves ? ' OF ' + totalWaves : '';
    el.waveAnn.innerHTML = '<h2>WAVE ' + number + progress + '</h2><p>' + enemyCount + ' OCCUPANTS STORMING</p>';
    el.waveAnn.classList.remove('visible');
    void el.waveAnn.offsetWidth;
    el.waveAnn.classList.add('visible');
    setTimeout(() => el.waveAnn.classList.remove('visible'), 2200);
  }

  function announceStage(stageNum, stageName, description) {
    el.waveAnn.innerHTML =
      '<h2 style="color:#44ff88">STAGE ' + stageNum + '</h2>' +
      '<p style="font-size:22px;color:#fff;margin-bottom:6px">' + stageName + '</p>' +
      '<p style="font-size:13px;color:#aaa">' + (description || '') + '</p>';
    el.waveAnn.classList.remove('visible');
    void el.waveAnn.offsetWidth;
    el.waveAnn.classList.add('visible');
    setTimeout(() => el.waveAnn.classList.remove('visible'), 3000);
  }

  // ── Kill Feed ──────────────────────────────────────────────
  const killFeedEl = document.getElementById('kill-feed');

  function addKill(weaponName, enemyType, isHeadshot) {
    if (!killFeedEl) return;
    const entry = document.createElement('div');
    entry.className = 'kill-entry' + (isHeadshot ? ' headshot' : '');
    entry.textContent = (isHeadshot ? '💀 HEADSHOT ' : '☠ ') + weaponName + ' → ' + (enemyType || 'ENEMY');
    killFeedEl.appendChild(entry);
    // Keep max 6 entries
    while (killFeedEl.children.length > 6) killFeedEl.removeChild(killFeedEl.firstChild);
    // Auto-remove after 4s
    setTimeout(function () { if (entry.parentNode) entry.parentNode.removeChild(entry); }, 4000);
  }

  // ── Hit Direction Indicator ────────────────────────────────
  const hitDirEl = document.getElementById('hit-direction');

  function showHitDirection(angle) {
    if (!hitDirEl) return;
    const arc = document.createElement('div');
    arc.className = 'hit-arc';
    const deg = (angle * 180 / Math.PI);
    arc.style.transform = 'translate(-50%, 0) rotate(' + deg + 'deg)';
    hitDirEl.appendChild(arc);
    setTimeout(function () { if (arc.parentNode) arc.parentNode.removeChild(arc); }, 800);
  }

  // ── Minimap / Radar ────────────────────────────────────────
  const minimapCanvas = document.getElementById('minimap-canvas');
  const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
  const MM_SIZE = 180;
  const MM_HALF = MM_SIZE / 2;
  const MM_SCALE = 2.5;

  function updateMinimap(px, pz, pyaw, enemies, npcs, vehicles, drones) {
    if (!minimapCtx) return;
    const ctx = minimapCtx;
    ctx.clearRect(0, 0, MM_SIZE, MM_SIZE);
    ctx.save();

    // Clip to circle
    ctx.beginPath();
    ctx.arc(MM_HALF, MM_HALF, MM_HALF - 2, 0, Math.PI * 2);
    ctx.clip();

    // Background
    ctx.fillStyle = 'rgba(10,15,10,0.85)';
    ctx.fillRect(0, 0, MM_SIZE, MM_SIZE);

    // Grid (rotates with player)
    ctx.save();
    ctx.translate(MM_HALF, MM_HALF);
    ctx.rotate(-pyaw);
    ctx.strokeStyle = 'rgba(0,255,0,0.1)';
    ctx.lineWidth = 0.5;
    for (let g = -80; g <= 80; g += 20) {
      ctx.beginPath(); ctx.moveTo(g * MM_SCALE, -MM_HALF); ctx.lineTo(g * MM_SCALE, MM_HALF); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-MM_HALF, g * MM_SCALE); ctx.lineTo(MM_HALF, g * MM_SCALE); ctx.stroke();
    }
    ctx.restore();

    // Helper: world pos to minimap pos
    function toMM(wx, wz) {
      var dx = wx - px;
      var dz = wz - pz;
      var cos = Math.cos(-pyaw);
      var sin = Math.sin(-pyaw);
      return {
        x: MM_HALF + (dx * cos - dz * sin) * MM_SCALE,
        y: MM_HALF + (dx * sin + dz * cos) * MM_SCALE,
      };
    }

    // Enemies - red dots
    if (enemies) {
      ctx.fillStyle = '#ff3333';
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e.alive) continue;
        var ep = e.mesh ? e.mesh.position : e.position;
        if (!ep) continue;
        var mp = toMM(ep.x, ep.z);
        if (Math.abs(mp.x - MM_HALF) < MM_HALF && Math.abs(mp.y - MM_HALF) < MM_HALF) {
          ctx.beginPath(); ctx.arc(mp.x, mp.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // NPCs - blue dots
    if (npcs) {
      ctx.fillStyle = '#4488ff';
      for (var j = 0; j < npcs.length; j++) {
        var n = npcs[j];
        if (!n.alive || !n.position) continue;
        var np = toMM(n.position.x, n.position.z);
        if (Math.abs(np.x - MM_HALF) < MM_HALF && Math.abs(np.y - MM_HALF) < MM_HALF) {
          ctx.beginPath(); ctx.arc(np.x, np.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Vehicles - yellow squares
    if (vehicles) {
      ctx.fillStyle = '#ffcc00';
      for (var k = 0; k < vehicles.length; k++) {
        var v = vehicles[k];
        var vpos = v.mesh ? v.mesh.position : v.position;
        if (!vpos) continue;
        var vp = toMM(vpos.x, vpos.z);
        if (Math.abs(vp.x - MM_HALF) < MM_HALF && Math.abs(vp.y - MM_HALF) < MM_HALF) {
          ctx.fillRect(vp.x - 3, vp.y - 3, 6, 6);
        }
      }
    }

    // Drones - cyan diamonds
    if (drones) {
      ctx.fillStyle = '#00ffcc';
      for (var d = 0; d < drones.length; d++) {
        var dr = drones[d];
        var dpos = dr.mesh ? dr.mesh.position : dr.position;
        if (!dpos) continue;
        var dp = toMM(dpos.x, dpos.z);
        if (Math.abs(dp.x - MM_HALF) < MM_HALF && Math.abs(dp.y - MM_HALF) < MM_HALF) {
          ctx.save();
          ctx.translate(dp.x, dp.y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-2.5, -2.5, 5, 5);
          ctx.restore();
        }
      }
    }

    // Player - green triangle at center
    ctx.fillStyle = '#00ff44';
    ctx.beginPath();
    ctx.moveTo(MM_HALF, MM_HALF - 6);
    ctx.lineTo(MM_HALF - 4, MM_HALF + 4);
    ctx.lineTo(MM_HALF + 4, MM_HALF + 4);
    ctx.closePath();
    ctx.fill();

    // Compass labels (rotate with player)
    ctx.fillStyle = 'rgba(0,255,0,0.6)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    var dirs = [{label:'N', a:0}, {label:'E', a:Math.PI/2}, {label:'S', a:Math.PI}, {label:'W', a:-Math.PI/2}];
    for (var ci = 0; ci < dirs.length; ci++) {
      var ca = dirs[ci].a - pyaw;
      var cx = MM_HALF + Math.sin(ca) * (MM_HALF - 10);
      var cy = MM_HALF - Math.cos(ca) * (MM_HALF - 10);
      ctx.fillText(dirs[ci].label, cx, cy + 3);
    }

    ctx.restore();
  }

  // ── Tactical Compass ──────────────────────────────────────
  const compassEl = document.getElementById('tactical-compass');

  function updateCompass(yaw) {
    if (!compassEl) return;
    // Cardinal directions spread across compass bar based on player yaw
    var degs = (-yaw * 180 / Math.PI) % 360;
    if (degs < 0) degs += 360;
    var dirs = [
      {label:'N', deg:0}, {label:'NE', deg:45}, {label:'E', deg:90},
      {label:'SE', deg:135}, {label:'S', deg:180}, {label:'SW', deg:225},
      {label:'W', deg:270}, {label:'NW', deg:315}
    ];
    var html = '';
    for (var i = 0; i < dirs.length; i++) {
      var diff = dirs[i].deg - degs;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      if (Math.abs(diff) < 60) {
        var pos = 50 + diff * 1.5; // percentage position
        var opacity = 1 - Math.abs(diff) / 60;
        var isCardinal = dirs[i].label.length === 1;
        html += '<span style="position:absolute;left:' + pos + '%;transform:translateX(-50%);' +
          'opacity:' + opacity.toFixed(2) + ';color:' + (isCardinal ? '#00ff44' : '#888') +
          ';font-size:' + (isCardinal ? '13px' : '10px') + ';font-weight:' + (isCardinal ? 'bold' : 'normal') +
          '">' + dirs[i].label + '</span>';
      }
    }
    // Degree readout at center
    html += '<span style="position:absolute;left:50%;transform:translateX(-50%);bottom:0;font-size:9px;color:#666">' + Math.round(degs) + '°</span>';
    compassEl.innerHTML = html;
  }

  // ── Kill Streak Display ────────────────────────────────────
  const streakEl = document.getElementById('streak-display');

  function showStreak(count, multiplier) {
    if (!streakEl) return;
    if (count < 2) { streakEl.style.display = 'none'; return; }
    streakEl.style.display = 'block';
    var color = count >= 10 ? '#ff0000' : count >= 5 ? '#ff8800' : '#ffcc00';
    streakEl.innerHTML = '🔥 ' + count + 'x STREAK <span style="color:' + color + '">(' + multiplier.toFixed(1) + 'x)</span>';
    streakEl.style.color = color;
  }

  // ── Bleed Indicator ────────────────────────────────────────
  const bleedEl = document.getElementById('bleed-indicator');

  function showBleed(active) {
    if (!bleedEl) return;
    bleedEl.style.display = active ? 'block' : 'none';
  }

  // ── Prone Indicator ────────────────────────────────────────
  const proneEl = document.getElementById('prone-indicator');

  function showProne(active) {
    if (!proneEl) return;
    proneEl.style.display = active ? 'block' : 'none';
  }

  // ── Jam Indicator ──────────────────────────────────────────
  const jamEl = document.getElementById('jam-indicator');

  function showJam(active) {
    if (!jamEl) return;
    jamEl.style.display = active ? 'block' : 'none';
  }

  // ── Vehicle HUD ──────────────────────────────────────────────────
  const vehicleHudEl = document.getElementById('vehicle-hud');
  const vhTypeEl = document.getElementById('vehicle-hud-type');
  const vhHealthBar = document.getElementById('vehicle-health-bar');
  const vhHealthVal = document.getElementById('vehicle-health-val');
  const vhSpeedEl = document.getElementById('vehicle-hud-speed');
  const vhControlsEl = document.getElementById('vehicle-hud-controls');
  const vhHijackBar = document.getElementById('vehicle-hijack-bar');
  const vhHijackFill = document.getElementById('vehicle-hijack-fill');

  const VEHICLE_ICONS = {
    transport: '🚛', combat: '🪖', logistics: '📦',
    helicopter: '🚁', plane: '✈️', turret_rover: '🤖'
  };

  function showVehicleHUD(vehicle) {
    if (!vehicleHudEl || !vehicle) return;
    vehicleHudEl.style.display = 'block';
    const icon = VEHICLE_ICONS[vehicle.type] || '🚗';
    vhTypeEl.textContent = icon + ' ' + vehicle.type.toUpperCase().replace('_', ' ');
    if (vehicle.flying) {
      vhControlsEl.textContent = 'WASD · Fly | SPACE · Ascend | SHIFT · Descend | G · Exit | T · View | LMB · Fire';
    } else if (vehicle.damage > 0) {
      vhControlsEl.textContent = 'WASD · Drive | G · Exit | T · View | LMB · Fire Turret';
    } else {
      vhControlsEl.textContent = 'WASD · Drive | G · Exit | T · View';
    }
  }

  function hideVehicleHUD() {
    if (vehicleHudEl) vehicleHudEl.style.display = 'none';
  }

  function updateVehicleHUD(vehicle) {
    if (!vehicleHudEl || !vehicle) return;
    // Health bar
    const hpPct = Math.max(0, vehicle.health / vehicle.maxHealth) * 100;
    if (vhHealthBar) {
      vhHealthBar.style.width = hpPct + '%';
      if (hpPct > 50) {
        vhHealthBar.style.background = 'linear-gradient(90deg, #00ff44, #44ff88)';
      } else if (hpPct > 25) {
        vhHealthBar.style.background = 'linear-gradient(90deg, #ff8800, #ffcc00)';
      } else {
        vhHealthBar.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
      }
    }
    if (vhHealthVal) vhHealthVal.textContent = Math.ceil(vehicle.health) + '/' + vehicle.maxHealth;
    // Speed
    if (vhSpeedEl) {
      const speed = vehicle.velocity ? Math.round(vehicle.velocity.length() * 3.6) : 0;
      vhSpeedEl.textContent = speed + ' km/h';
    }
  }

  function showHijackProgress(progress) {
    if (!vhHijackBar) return;
    if (progress <= 0 || progress >= 1) {
      vhHijackBar.style.display = 'none';
      return;
    }
    vhHijackBar.style.display = 'block';
    if (vhHijackFill) vhHijackFill.style.width = (progress * 100) + '%';
  }

  // ── Stamina Bar ──────────────────────────────────────────────────
  const staminaBarEl = document.getElementById('stamina-bar');

  function updateStamina(pct) {
    if (!staminaBarEl) return;
    staminaBarEl.style.width = (pct * 100) + '%';
    if (pct < 0.25) {
      staminaBarEl.style.background = 'linear-gradient(90deg, #ff4444, #ff6644)';
    } else if (pct < 0.5) {
      staminaBarEl.style.background = 'linear-gradient(90deg, #ff8800, #ffaa44)';
    } else {
      staminaBarEl.style.background = 'linear-gradient(90deg, #ffcc00, #ffee66)';
    }
  }

  // ── Night Vision ─────────────────────────────────────────────────
  const nightVisionEl = document.getElementById('night-vision-overlay');

  function showNightVision(active) {
    if (nightVisionEl) nightVisionEl.style.display = active ? 'block' : 'none';
  }

  // ── Weather Indicator ────────────────────────────────────────────
  const weatherEl = document.getElementById('weather-indicator');

  function updateWeatherDisplay(label) {
    if (weatherEl) weatherEl.textContent = label;
  }

  // ── Interaction Prompt ───────────────────────────────────────────
  const interactEl = document.getElementById('interaction-prompt');
  let _interactTimer = null;

  function showInteractionPrompt(text) {
    if (!interactEl) return;
    interactEl.textContent = text;
    interactEl.style.display = 'block';
    clearTimeout(_interactTimer);
    _interactTimer = setTimeout(function () {
      interactEl.style.display = 'none';
    }, 2000);
  }

  function hideInteractionPrompt() {
    if (interactEl) interactEl.style.display = 'none';
    clearTimeout(_interactTimer);
  }

  // ── Low HP Effects ───────────────────────────────────────────────
  const lowHpEl = document.getElementById('low-hp-vignette');
  const shieldEl = document.getElementById('shield-indicator');

  function showLowHP(active) {
    if (lowHpEl) lowHpEl.style.display = active ? 'block' : 'none';
  }

  function showShield(active) {
    if (shieldEl) shieldEl.style.display = active ? 'block' : 'none';
  }

  // ── OKC Display ─────────────────────────────────────────────────
  const okcEl = document.getElementById('hud-okc');

  function updateOKC(amount) {
    if (okcEl) okcEl.textContent = '🪙 ' + Math.floor(amount) + ' OKC';
  }

  // ── Damage Numbers (floating combat text) ─────────────────────
  const dmgContainer = document.getElementById('damage-numbers') || (function () {
    var d = document.createElement('div');
    d.id = 'damage-numbers';
    d.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:210;overflow:hidden';
    document.getElementById('hud').appendChild(d);
    return d;
  })();

  function showDamageNumber(screenX, screenY, amount, isHeadshot) {
    if (!dmgContainer) return;
    var num = document.createElement('div');
    num.className = 'dmg-number' + (isHeadshot ? ' dmg-headshot' : '');
    num.textContent = (isHeadshot ? '💀 ' : '') + Math.round(amount);
    num.style.left = screenX + 'px';
    num.style.top = screenY + 'px';
    dmgContainer.appendChild(num);
    setTimeout(function () { if (num.parentNode) num.parentNode.removeChild(num); }, 1000);
  }

  // ── Skills Display Panel ──────────────────────────────────────
  function buildSkillsPanel(container) {
    if (!container || typeof SkillSystem === 'undefined') return;
    container.innerHTML = '';
    var cats = ['combat', 'engineering', 'drone', 'leadership'];
    var catIcons = { combat: '⚔️', engineering: '🔧', drone: '🛸', leadership: '🎖️' };
    var catColors = { combat: '#ff4444', engineering: '#ffaa00', drone: '#00ccff', leadership: '#44ff44' };
    for (var ci = 0; ci < cats.length; ci++) {
      var cat = cats[ci];
      var skills = SkillSystem.getCategory(cat);
      var section = document.createElement('div');
      section.style.cssText = 'margin-bottom:8px';
      section.innerHTML = '<div style="color:' + catColors[cat] + ';font-weight:bold;font-size:12px;margin-bottom:4px">' +
        catIcons[cat] + ' ' + cat.toUpperCase() + '</div>';
      for (var sname in skills) {
        var sk = skills[sname];
        var pct = Math.min(100, (sk.xp / (Math.pow((sk.level + 1), 2) * 25)) * 100);
        var bar = document.createElement('div');
        bar.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0;font-size:11px';
        bar.innerHTML =
          '<span style="color:#ccc;width:130px;text-transform:capitalize">' + sname.replace(/_/g, ' ') + '</span>' +
          '<span style="color:' + catColors[cat] + ';width:30px;text-align:right">Lv ' + sk.level + '</span>' +
          '<div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">' +
          '<div style="width:' + pct + '%;height:100%;background:' + catColors[cat] + ';border-radius:3px"></div></div>';
        section.appendChild(bar);
      }
      container.appendChild(section);
    }
  }

  // ── Rank Progress Panel ───────────────────────────────────────
  function buildRankPanel(container) {
    if (!container || typeof RankSystem === 'undefined') return;
    container.innerHTML = '';
    var rank = RankSystem.getRank();
    var prog = RankSystem.getProgress();
    var next = RankSystem.getNextRank();
    container.innerHTML =
      '<div style="text-align:center;margin-bottom:6px">' +
      '<span style="font-size:24px">' + rank.icon + '</span>' +
      '<div style="font-size:16px;font-weight:bold;color:#ffcc00">' + rank.name.toUpperCase() + '</div>' +
      '<div style="font-size:11px;color:#aaa">Total XP: ' + RankSystem.getTotalXP() + '</div>' +
      '</div>' +
      '<div style="height:10px;background:rgba(255,255,255,0.1);border-radius:5px;overflow:hidden;margin:6px 0">' +
      '<div style="width:' + Math.floor(prog.percent) + '%;height:100%;background:linear-gradient(90deg,#ffcc00,#ff8800);border-radius:5px;transition:width 0.3s"></div>' +
      '</div>' +
      '<div style="font-size:11px;color:#888;text-align:center">' +
      Math.floor(prog.current) + ' / ' + prog.needed + ' XP' +
      (next ? ' → ' + next.name : ' (MAX RANK)') +
      '</div>' +
      (rank.unlocks ? '<div style="font-size:10px;color:#666;margin-top:4px;text-align:center">Unlocks: ' + rank.unlocks.join(', ') + '</div>' : '');
  }

  return {
    show, hide,
    setScore, setWave, setKills, setEnemies, setStage,
    setHealth, setAmmo, setWeapon, showReload,
    flashHit, flashDamage,
    showHeadshot, notifyPickup,
    announceWave, announceStage,
    addKill, showHitDirection, updateMinimap,
    updateCompass, showStreak, showBleed, showProne, showJam,
    showVehicleHUD, hideVehicleHUD, updateVehicleHUD, showHijackProgress,
    updateStamina, showNightVision, updateWeatherDisplay,
    showInteractionPrompt, hideInteractionPrompt,
    showLowHP, showShield,
    updateOKC, showDamageNumber,
    buildSkillsPanel, buildRankPanel,
  };
})();
