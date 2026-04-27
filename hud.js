  // ── Skill HUD Overlay ─────────────────────────────────────────────
  // Import escapeHTML from feedback.js
  const escapeHTML = window.Feedback && window.Feedback.escapeHTML ? window.Feedback.escapeHTML : (str => String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]));
  const skillHudEl = document.getElementById('skill-hud-overlay');
  const skillHudBtn = document.getElementById('skill-hud-btn');
  let skillHudOpen = false;

  function renderSkillHud() {
    if (!skillHudEl) return;
    const skills = SkillSystem.getAllSkills();
    let html = '<h2 style="color:#44aaff;text-align:center;margin-bottom:12px">🧠 SKILL PROGRESSION</h2>';
    html += '<div>';
    for (const [name, data] of Object.entries(skills)) {
      const def = SkillSystem.SKILLS[name];
      const pct = Math.min(100, (data.xp / (def.max * 25)) * 100);
      html += `<div class='skill-row'><span class='skill-name'>${escapeHTML(name.replace(/_/g,' '))}</span><div class='skill-bar'><div class='skill-bar-fill' style='width:${pct}%;'></div></div><span class='skill-lvl'>Lv${escapeHTML(data.level)}</span></div>`;
    }
    html += '</div>';
    // Perks
    html += '<div class="perk-row"><b>Unlocked Perks:</b><br>';
    const passives = SkillSystem.getActivePassives();
    if (passives.length === 0) html += '<span class="perk-locked">None yet — level up skills!</span>';
    else for (const p of passives) html += `<span class='perk-unlocked'>${escapeHTML(p.name)}</span>: <span style='color:#aaa'>${escapeHTML(p.description)}</span><br>`;
    html += '</div>';
    // Skill Trees
    html += '<div class="perk-row"><b>Skill Tree Unlocks:</b><br>';
    for (const tree of Object.keys(SkillSystem.SKILL_TREE)) {
      html += `<div style='margin-top:4px;color:#aaccff'><b>${escapeHTML(tree)}</b>:</div>`;
      for (const node of SkillSystem.SKILL_TREE[tree]) {
        const unlocked = node.unlocked;
        html += `<span class='${unlocked ? 'perk-unlocked' : 'perk-locked'}'>${escapeHTML(node.name)}</span> <span style='color:#aaa'>${escapeHTML(node.description)}</span><br>`;
      }
    }
    html += '</div>';
    skillHudEl.innerHTML = html;
  }

  function toggleSkillHud(force) {
    skillHudOpen = typeof force === 'boolean' ? force : !skillHudOpen;
    if (skillHudEl) skillHudEl.style.display = skillHudOpen ? 'block' : 'none';
    if (skillHudOpen) renderSkillHud();
  }

  if (skillHudBtn) {
    skillHudBtn.onclick = () => toggleSkillHud();
  }
  window.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P') toggleSkillHud();
    // Direct weapon slot keys: 1–9, 0, F1–F12 (10–21), Shift+1–4 (22–25)
    if (!e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey) {
      let idx = -1;
      if (e.key >= '1' && e.key <= '9') idx = parseInt(e.key, 10) - 1;
      else if (e.key === '0') idx = 9;
      else if (e.code.startsWith('F')) {
        let fnum = parseInt(e.code.slice(1), 10);
        if (fnum >= 1 && fnum <= 12) idx = 9 + fnum;
      } else if (e.shiftKey && e.key >= '1' && e.key <= '4') {
        idx = 21 + parseInt(e.key, 10);
      }
      // Defensive: ensure slot exists and is unlocked
      if (idx >= 0 && typeof window.Weapons !== 'undefined' && window.Weapons.select) {
        if (window.Weapons.getCount && idx < window.Weapons.getCount()) {
          window.Weapons.select(idx);
          e.preventDefault();
        } else {
          console.warn('[HUD] Weapon slot index out of range:', idx);
        }
      }
    }
  });
  // ── NPC Morale HUD Overlay ─────────────────────────────
  const moraleHudEl = document.getElementById('npc-morale-hud');

  // Map: npcId → {el, lastMorale}
  let _moraleIndicators = {};

  // Call this every frame with [{id, position, morale, alive}]
  function updateNpcMoraleIndicators(npcList, camera, renderer) {
    if (!moraleHudEl || !Array.isArray(npcList) || !camera || !renderer) return;
    const width = renderer.domElement.width;
    const height = renderer.domElement.height;
    // Track which NPCs are present this frame
    const seen = new Set();
    for (const npc of npcList) {
      if (!npc.alive) continue;
      seen.add(npc.id);
      let ind = _moraleIndicators[npc.id];
      if (!ind) {
        const el = document.createElement('div');
        el.className = 'npc-morale-indicator';
        el.style.position = 'absolute';
        el.style.pointerEvents = 'none';
        el.style.fontSize = '22px';
        el.style.fontFamily = 'monospace';
        el.style.transition = 'transform 0.18s, filter 0.18s';
        moraleHudEl.appendChild(el);
        ind = {el, lastMorale: npc.morale};
        _moraleIndicators[npc.id] = ind;
      }
      // Project world position to screen
      const pos = npc.position.clone();
      pos.y += 1.7; // above head
      pos.project(camera);
      const sx = (pos.x * 0.5 + 0.5) * width;
      const sy = (-pos.y * 0.5 + 0.5) * height;
      ind.el.style.left = Math.round(sx - 16) + 'px';
      ind.el.style.top = Math.round(sy - 32) + 'px';
      // Morale → emoji/color
      let emoji = '😐', color = '#aaa', filter = '';
      if (npc.morale >= 80) { emoji = '😎'; color = '#44ff88'; filter = 'drop-shadow(0 0 8px #44ff88)'; }
      else if (npc.morale >= 60) { emoji = '🙂'; color = '#aaffaa'; }
      else if (npc.morale >= 40) { emoji = '😐'; color = '#ffe066'; }
      else if (npc.morale >= 20) { emoji = '😰'; color = '#ffbb33'; filter = 'drop-shadow(0 0 8px #ffbb33)'; }
      else { emoji = '😱'; color = '#ff4444'; filter = 'drop-shadow(0 0 10px #ff4444)'; }
      ind.el.textContent = emoji;
      ind.el.style.color = color;
      ind.el.style.filter = filter;
      // Animate if morale changed a lot
      if (Math.abs(npc.morale - ind.lastMorale) > 25) {
        ind.el.style.transform = 'scale(1.35)';
        setTimeout(() => { ind.el.style.transform = ''; }, 180);
      }
      ind.lastMorale = npc.morale;
    }
    // Remove indicators for NPCs not present
    for (const id in _moraleIndicators) {
      if (!seen.has(Number(id))) {
        moraleHudEl.removeChild(_moraleIndicators[id].el);
        delete _moraleIndicators[id];
      }
    }
  }
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
    weaponSlots:  [], // Will be populated dynamically
    reload:       document.getElementById('reload-indicator'),
    hitMarker:    document.getElementById('hit-marker'),
    vignette:     document.getElementById('damage-vignette'),
    waveAnn:      document.getElementById('wave-announce'),
    headshotNotif: document.getElementById('headshot-notif'),
    pickupNotif:   document.getElementById('pickup-notif'),
  };

  // Dynamically generate weapon slots based on WEAPONS array
  function createWeaponSlots() {
    const slotContainer = document.getElementById('weapon-slot-container');
    if (!slotContainer || typeof Weapons === 'undefined' || !Weapons.getAll) return;
    slotContainer.innerHTML = '';
    el.weaponSlots = [];
    const weapons = Weapons.getAll();
    // Limit to 26 slots (1-9, 0, F1-F12, Shift+1-4)
    const maxSlots = 26;
    for (let i = 0; i < Math.min(weapons.length, maxSlots); i++) {
      const slot = document.createElement('div');
      slot.className = 'weapon-slot';
      slot.id = 'wslot-' + i;
      slot.innerHTML = `<span>${i + 1}</span>`;
      slotContainer.appendChild(slot);
      el.weaponSlots.push(slot);
    }
  }

  // Call createWeaponSlots on HUD init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWeaponSlots);
  } else {
    createWeaponSlots();
  }

  let hitMarkerTimer   = null;
  let vignetteTimer    = null;
  let headshotTimer    = null;
  let pickupTimer      = null;

  function show() { el.hud.style.display = 'block'; }
  function hide() { el.hud.style.display = 'none'; }

  function setScore(v)   {
    el.score.textContent   = 'SCORE: '   + v;
    // Brief pulse-pop when score updates
    el.score.style.transition = 'none';
    el.score.style.transform = 'scale(1.18)';
    el.score.style.color = '#ffe060';
    setTimeout(function() {
      el.score.style.transition = 'transform 0.22s ease-out, color 0.22s ease-out';
      el.score.style.transform = 'scale(1)';
      el.score.style.color = '';
    }, 16);
  }
  function setWave(v, total) {
    el.wave.textContent = total ? 'WAVE: ' + v + '/' + total : 'WAVE: ' + v;
  }
  function setKills(v)   {
    el.kills.textContent    = 'KILLS: '   + v;
    el.kills.style.transition = 'none';
    el.kills.style.transform = 'scale(1.15)';
    el.kills.style.color = '#ff6644';
    setTimeout(function() {
      el.kills.style.transition = 'transform 0.22s ease-out, color 0.22s ease-out';
      el.kills.style.transform = 'scale(1)';
      el.kills.style.color = '';
    }, 16);
  }
  function setEnemies(v) { el.enemies.textContent  = 'ENEMIES: ' + v; }
  function setStage(num, name) {
    if (el.stage) el.stage.textContent = 'STAGE ' + num + ': ' + name;
  }

  function setHealth(current, max) {
    if (!max || !el.healthBar) return;
    const pct = Math.max(0, current / max) * 100;
    el.healthBar.style.width  = pct + '%';
    el.healthBar.style.background = pct > 60
      ? 'linear-gradient(90deg,#00cc44,#44ff88)'
      : pct > 30
        ? 'linear-gradient(90deg,#ff8800,#ffcc00)'
        : 'linear-gradient(90deg,#ff0000,#ff3333)';
    if (pct <= 30) el.healthBar.style.animation = 'lowHpPulse 0.6s infinite';
    else el.healthBar.style.animation = '';
    el.healthVal.textContent = Math.ceil(current) + ' / ' + max;
    // Adrenaline vignette: persistent red/dark border when critical
    _updateAdrenalineVignette(pct);
  }

  // Persistent low-HP red vignette overlay (layered above damage flash)
  var _adrEl = null;
  function _updateAdrenalineVignette(pct) {
    if (pct > 25) {
      if (_adrEl) _adrEl.style.opacity = '0';
      return;
    }
    if (!_adrEl) {
      _adrEl = document.createElement('div');
      _adrEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:140;background:radial-gradient(ellipse at center,transparent 38%,rgba(180,0,0,0.18) 70%,rgba(255,0,0,0.55) 100%);opacity:0;transition:opacity 0.4s;animation:adrPulse 1.4s ease-in-out infinite;';
      document.body.appendChild(_adrEl);
      // Inject keyframes once
      if (!document.getElementById('adr-kf')) {
        var st = document.createElement('style');
        st.id = 'adr-kf';
        st.textContent = '@keyframes adrPulse{0%,100%{filter:brightness(0.9)}50%{filter:brightness(1.35)}}';
        document.head.appendChild(st);
      }
    }
    // Intensity scales: 25% HP = 0.4 opacity, 0% HP = 1.0
    var t = Math.max(0, Math.min(1, (25 - pct) / 25));
    _adrEl.style.opacity = String(0.35 + t * 0.55);
  }

  // ── Incoming grenade warning ─────────────────────────────────
  // dist: distance to nearest enemy grenade in metres, or -1 to clear
  var _grenWarnEl = null;
  function setGrenadeWarning(dist) {
    if (dist == null || dist < 0) {
      if (_grenWarnEl) _grenWarnEl.style.opacity = '0';
      return;
    }
    if (!_grenWarnEl) {
      _grenWarnEl = document.createElement('div');
      _grenWarnEl.style.cssText = 'position:fixed;top:30%;left:50%;transform:translate(-50%,0);color:#ffaa00;font-size:24px;font-family:monospace;font-weight:bold;text-shadow:0 0 8px #ff4400,0 0 14px #000;pointer-events:none;z-index:170;opacity:0;transition:opacity 0.15s;letter-spacing:2px;';
      _grenWarnEl.textContent = '⚠ GRENADE ⚠';
      document.body.appendChild(_grenWarnEl);
      if (!document.getElementById('gren-warn-kf')) {
        var st = document.createElement('style');
        st.id = 'gren-warn-kf';
        st.textContent = '@keyframes grenWarnPulse{0%,100%{transform:translate(-50%,0) scale(1)}50%{transform:translate(-50%,0) scale(1.18)}}';
        document.head.appendChild(st);
      }
      _grenWarnEl.style.animation = 'grenWarnPulse 0.45s ease-in-out infinite';
    }
    // Closer = brighter & faster pulse
    var t2 = 1 - Math.min(1, dist / 8);
    _grenWarnEl.style.opacity = String(0.55 + t2 * 0.45);
    _grenWarnEl.style.color = t2 > 0.6 ? '#ff3030' : '#ffaa00';
  }

  // Sprint motion vignette: subtle dark edges intensify on sprint start
  var _sprintEl = null;
  function setSprintIntensity(amount) {
    var v = Math.max(0, Math.min(1, amount || 0));
    if (!_sprintEl) {
      if (v <= 0) return;
      _sprintEl = document.createElement('div');
      _sprintEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:135;background:radial-gradient(ellipse at center,transparent 48%,rgba(0,0,0,0.55) 100%);opacity:0;transition:opacity 0.22s;';
      document.body.appendChild(_sprintEl);
    }
    _sprintEl.style.opacity = String(v * 0.6);
  }

  function setAmmo(clip, reserve, clipSize) {
    if (!el.ammo || !el.ammoRes) return;
    el.ammo.textContent    = clip;
    el.ammoRes.textContent = '/ ' + reserve;
    // Low ammo warning flash + sound
    if (clipSize && typeof clip === 'number' && clip > 0 && clip <= clipSize * 0.25) {
      el.ammo.style.color = '#ff4444';
      el.ammo.style.animation = 'lowAmmoFlash 0.4s infinite';
      if (window.AudioSystem && AudioSystem.playLowAmmo) AudioSystem.playLowAmmo();
    } else {
      el.ammo.style.color = '';
      el.ammo.style.animation = '';
    }
  }

  function setWeapon(name, idx) {
    if (el.weaponName) el.weaponName.textContent = name;
    el.weaponSlots.forEach((s, i) => {
      if (!s) return;
      s.classList.toggle('active', i === idx);
      const isLocked = typeof Weapons !== 'undefined' && !Weapons.isUnlocked(i);
      s.classList.toggle('locked', isLocked);
      // Hide locked slots to prevent overflow
      s.style.display = isLocked ? 'none' : '';
    });
  }

  function showReload(on, progress) {
    if (on) el.reload.classList.add('visible');
    else    el.reload.classList.remove('visible');
    // Lazy-create a progress bar under the reload indicator
    var rb = document.getElementById('reload-progress-bar');
    if (on) {
      if (!rb) {
        rb = document.createElement('div');
        rb.id = 'reload-progress-bar';
        rb.style.cssText = 'position:fixed;left:50%;top:58%;transform:translateX(-50%);width:120px;height:4px;background:rgba(0,0,0,0.55);border:1px solid #ffaa00;border-radius:2px;z-index:160;pointer-events:none;overflow:hidden;';
        var fill = document.createElement('div');
        fill.id = 'reload-progress-fill';
        fill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#ffaa00,#ffdd44);box-shadow:0 0 6px #ffaa00;transition:width 0.05s linear;';
        rb.appendChild(fill);
        document.body.appendChild(rb);
      }
      var pct = Math.max(0, Math.min(1, progress || 0)) * 100;
      var fillEl = document.getElementById('reload-progress-fill');
      if (fillEl) fillEl.style.width = pct.toFixed(1) + '%';
      rb.style.display = 'block';
    } else if (rb) {
      rb.style.display = 'none';
    }
  }

  let _chFlashTimer = null;
  function flashHit(isHeadshot, isKill) {
    el.hitMarker.classList.remove('visible', 'headshot', 'kill');
    void el.hitMarker.offsetWidth; // force reflow for re-trigger
    el.hitMarker.classList.add('visible');
    if (isHeadshot) el.hitMarker.classList.add('headshot');
    if (isKill) el.hitMarker.classList.add('kill');
    clearTimeout(hitMarkerTimer);
    hitMarkerTimer = setTimeout(() => {
      el.hitMarker.classList.remove('visible', 'headshot', 'kill');
    }, isKill ? 350 : 180);

    // Crosshair red flash on headshot
    if (isHeadshot) {
      var ch = document.getElementById('crosshair');
      if (ch) {
        ch.classList.remove('headshot-flash');
        void ch.offsetWidth;
        ch.classList.add('headshot-flash');
        clearTimeout(_chFlashTimer);
        _chFlashTimer = setTimeout(() => ch.classList.remove('headshot-flash'), 300);
      }
    }
  }

  function flashDamage() {
    el.vignette.classList.add('hit');
    clearTimeout(vignetteTimer);
    vignetteTimer = setTimeout(() => el.vignette.classList.remove('hit'), 300);
  }

  // ── Dynamic crosshair spread (0..1) — pushes 4 lines outward proportionally
  var _chLineCache = null;
  function setCrosshairSpread(amount) {
    if (!_chLineCache) {
      _chLineCache = {
        top:    document.querySelector('#crosshair .cl-top'),
        bottom: document.querySelector('#crosshair .cl-bottom'),
        left:   document.querySelector('#crosshair .cl-left'),
        right:  document.querySelector('#crosshair .cl-right'),
      };
    }
    var s = Math.max(0, Math.min(1, amount || 0));
    var px = Math.round(s * 8); // up to 8px outward
    if (_chLineCache.top)    _chLineCache.top.style.transform    = 'translateY(' + (-px) + 'px)';
    if (_chLineCache.bottom) _chLineCache.bottom.style.transform = 'translateY(' + ( px) + 'px)';
    if (_chLineCache.left)   _chLineCache.left.style.transform   = 'translateX(' + (-px) + 'px)';
    if (_chLineCache.right)  _chLineCache.right.style.transform  = 'translateX(' + ( px) + 'px)';
  }

  // ── Crosshair target tint: red glow when aimed at an enemy ──
  var _chTargetActive = false;
  function setCrosshairTarget(onTarget) {
    var want = !!onTarget;
    if (want === _chTargetActive) return;
    _chTargetActive = want;
    if (!_chLineCache) {
      _chLineCache = {
        top:    document.querySelector('#crosshair .cl-top'),
        bottom: document.querySelector('#crosshair .cl-bottom'),
        left:   document.querySelector('#crosshair .cl-left'),
        right:  document.querySelector('#crosshair .cl-right'),
      };
    }
    var col = want ? '#ff3030' : '';
    var glow = want ? '0 0 6px #ff0000,0 0 10px #ff5050' : '';
    ['top', 'bottom', 'left', 'right'].forEach(function (k) {
      var el = _chLineCache[k];
      if (!el) return;
      el.style.backgroundColor = col;
      el.style.boxShadow = glow;
    });
  }

  // Range readout under crosshair when ADS-aimed at enemy
  var _rangeEl = null;
  function setRangeReadout(metres) {
    if (metres == null || metres < 0) {
      if (_rangeEl) _rangeEl.style.opacity = '0';
      return;
    }
    if (!_rangeEl) {
      _rangeEl = document.createElement('div');
      _rangeEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,18px);color:#ff8866;font-size:11px;font-family:monospace;font-weight:bold;text-shadow:0 0 4px #000;pointer-events:none;z-index:165;opacity:0;transition:opacity 0.15s;';
      document.body.appendChild(_rangeEl);
    }
    _rangeEl.textContent = Math.round(metres) + 'm';
    _rangeEl.style.opacity = '1';
  }

  // Green heal flash vignette (briefly tint screen on health pickup)
  var _healFlashEl = null;
  var _healFlashTimer = null;
  function flashHeal() {
    if (!_healFlashEl) {
      _healFlashEl = document.createElement('div');
      _healFlashEl.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:191;box-shadow:inset 0 0 70px 25px rgba(34,255,85,0.45);opacity:0;transition:opacity 0.18s linear';
      document.body.appendChild(_healFlashEl);
    }
    _healFlashEl.style.opacity = '1';
    clearTimeout(_healFlashTimer);
    _healFlashTimer = setTimeout(() => { if (_healFlashEl) _healFlashEl.style.opacity = '0'; }, 280);
  }

  // ── Persistent blood drops on damage ──────────────────────
  function showBloodDrops(severity) {
    // severity 0-1: 0 = light scratch, 1 = heavy hit
    var count = Math.max(2, Math.min(6, Math.round(severity * 5 + 1)));
    var container = document.getElementById('hud');
    if (!container) return;
    for (var i = 0; i < count; i++) {
      var drop = document.createElement('div');
      drop.className = 'blood-drop';
      var size = 10 + Math.random() * 25 * severity;
      drop.style.width = size + 'px';
      drop.style.height = (size * (1.2 + Math.random() * 0.6)) + 'px';
      drop.style.left = (5 + Math.random() * 90) + '%';
      drop.style.top = (5 + Math.random() * 90) + '%';
      drop.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      container.appendChild(drop);
      // Auto-remove after animation completes
      (function(d) {
        setTimeout(function() { if (d.parentNode) d.parentNode.removeChild(d); }, 2600);
      })(drop);
    }
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
    el.waveAnn.innerHTML = '<h2>WAVE ' + escapeHTML(number) + progress + '</h2><p>' + escapeHTML(enemyCount) + ' OCCUPANTS STORMING</p>';
    el.waveAnn.classList.remove('visible');
    void el.waveAnn.offsetWidth;
    el.waveAnn.classList.add('visible');
    setTimeout(() => el.waveAnn.classList.remove('visible'), 2200);
  }

  function announceStage(stageNum, stageName, description) {
    el.waveAnn.innerHTML =
      '<h2 style="color:#44ff88">STAGE ' + escapeHTML(stageNum) + '</h2>' +
      '<p style="font-size:22px;color:#fff;margin-bottom:6px">' + escapeHTML(stageName) + '</p>' +
      '<p style="font-size:13px;color:#aaa">' + escapeHTML(description || '') + '</p>';
    el.waveAnn.classList.remove('visible');
    void el.waveAnn.offsetWidth;
    el.waveAnn.classList.add('visible');
    setTimeout(() => el.waveAnn.classList.remove('visible'), 3000);
  }

  // ── Kill Feed ──────────────────────────────────────────────
  const killFeedEl = document.getElementById('kill-feed');

  function addKill(weaponName, enemyType, isHeadshot) {
    if (!killFeedEl) return;
    if (typeof Feedback !== 'undefined') return; // Feedback module owns kill feed
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

  // ── Targeting Assistant (on-weapon digital readout) ─────────
  var _taEl = null;
  var _taEntries = null;
  var _taTimer = 0;

  function updateTargetAssist(px, pz, pyaw, enemies) {
    if (!_taEl) _taEl = document.getElementById('target-assist');
    if (!_taEntries) _taEntries = document.getElementById('ta-entries');
    if (!_taEl || !_taEntries) return;

    _taTimer += 0.05;
    // Show only during gameplay
    if (!enemies || enemies.length === 0) { _taEl.style.display = 'none'; return; }
    _taEl.style.display = '';

    // Find closest 5 living enemies
    var sorted = [];
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      // Enemies module uses .alive + .hp; .health was wrong field — caused dead enemies to show on HUD
      if (!e || !e.mesh || e.alive === false || (typeof e.hp === 'number' && e.hp <= 0)) continue;
      var dx = e.mesh.position.x - px;
      var dz = e.mesh.position.z - pz;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 80) continue; // range limit
      // Direction arrow: angle relative to player facing
      var angle = Math.atan2(dx, -dz) - pyaw;
      var mh = (typeof e.maxHp === 'number' && e.maxHp > 0) ? e.maxHp
             : (typeof e.maxHealth === 'number' && e.maxHealth > 0) ? e.maxHealth : 100;
      var hh = (typeof e.hp === 'number' && isFinite(e.hp)) ? e.hp
             : (typeof e.health === 'number' && isFinite(e.health)) ? e.health : mh;
      sorted.push({ dist: dist, angle: angle, type: e.type || 'INF', health: hh, maxHp: mh });
    }
    sorted.sort(function(a, b) { return a.dist - b.dist; });
    if (sorted.length > 5) sorted.length = 5;

    // Render entries
    var html = '';
    for (var si = 0; si < sorted.length; si++) {
      var s = sorted[si];
      // Direction arrow
      var a = ((s.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      var arrow;
      if (a < 0.39 || a > 5.89) arrow = '↑';
      else if (a < 1.18) arrow = '↗';
      else if (a < 1.96) arrow = '→';
      else if (a < 2.75) arrow = '↘';
      else if (a < 3.53) arrow = '↓';
      else if (a < 4.32) arrow = '↙';
      else if (a < 5.10) arrow = '←';
      else arrow = '↖';

      var cls = si === 0 ? 'ta-row ta-priority' : 'ta-row';
      var distStr = s.dist < 10 ? s.dist.toFixed(1) : Math.round(s.dist);
      var hpPct = s.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((s.health / s.maxHp) * 100))) : 0;
      html += '<div class="' + cls + '">'
        + '<span class="ta-dir">' + arrow + '</span>'
        + '<span class="ta-type">' + (s.type.substring(0, 6)) + ' ' + hpPct + '%</span>'
        + '<span class="ta-dist">' + distStr + 'm</span>'
        + '</div>';
    }
    _taEntries.innerHTML = html;
  }

  // ── Minimap / Radar ────────────────────────────────────────
  const minimapCanvas = document.getElementById('minimap-canvas');
  const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
  const MM_SIZE = 180;
  const MM_HALF = MM_SIZE / 2;
  const MM_SCALE = 2.5;
  var _minimapJammed = false;
  var _compassJammed = false;

  function setMinimapJammed(jammed) { _minimapJammed = !!jammed; }
  function setCompassJammed(jammed) { _compassJammed = !!jammed; }

  function updateMinimap(px, pz, pyaw, enemies, npcs, vehicles, drones, pickups) {
    if (!minimapCtx) return;
    const ctx = minimapCtx;
    ctx.clearRect(0, 0, MM_SIZE, MM_SIZE);
    if (_minimapJammed) {
      var imgData = ctx.createImageData(MM_SIZE, MM_SIZE);
      for (var pi = 0; pi < imgData.data.length; pi += 4) {
        var v = Math.random() * 100 | 0;
        imgData.data[pi] = v; imgData.data[pi+1] = v + 20; imgData.data[pi+2] = v;
        imgData.data[pi+3] = 220;
      }
      ctx.putImageData(imgData, 0, 0);
      ctx.fillStyle = '#ff0000'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('JAMMED', MM_HALF, MM_HALF);
      return;
    }
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
    // Enemies — color-coded by type
    var _mmEnemyColors = {
      CONSCRIPT: '#ff3333', STORMER: '#ff6600', ARMORED: '#cc00cc',
      SNIPER: '#ffff00', SNIPER_ELITE: '#ffff00', OFFICER: '#ff00ff',
      BOMBER: '#ff8800', MEDIC: '#00ff88', ENGINEER: '#00ccff',
      BOSS: '#ffffff', WAR_DOG: '#bb6600', SHIELD_BEARER: '#8888ff',
      MORTAR: '#ff4488', FLAMETHROWER: '#ff4400', SABOTEUR: '#aa00ff',
      DRONE_OP: '#00ffcc'
    };
    if (enemies) {
      var _mmNow = performance.now() * 0.006;
      var _mmPulse = 0.5 + Math.sin(_mmNow) * 0.5;
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!e.alive) continue;
        var ep = e.mesh ? e.mesh.position : e.position;
        if (!ep) continue;
        var mp = toMM(ep.x, ep.z);
        if (Math.abs(mp.x - MM_HALF) < MM_HALF && Math.abs(mp.y - MM_HALF) < MM_HALF) {
          var tn = e.typeCfg ? e.typeCfg.name : '';
          var col = _mmEnemyColors[tn] || '#ff3333';
          var r = (tn === 'BOSS') ? 4 : 2.5;
          // Threat halo: enemy actively targeting player gets a pulsing red ring
          if (e.playerSpotted) {
            ctx.strokeStyle = 'rgba(255,40,40,' + (0.35 + _mmPulse * 0.45) + ')';
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(mp.x, mp.y, r + 2 + _mmPulse * 1.5, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(mp.x, mp.y, r, 0, Math.PI * 2); ctx.fill();
          // Facing tick
          if (e.mesh && e.mesh.quaternion) {
            try {
              var fwdX = -Math.sin(e.mesh.rotation.y);
              var fwdZ = -Math.cos(e.mesh.rotation.y);
              // Apply same map-rotation as toMM
              var fcos = Math.cos(-pyaw), fsin = Math.sin(-pyaw);
              var rx = fwdX * fcos - fwdZ * fsin;
              var ry = fwdX * fsin + fwdZ * fcos;
              ctx.strokeStyle = col;
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(mp.x, mp.y); ctx.lineTo(mp.x + rx * (r + 3), mp.y + ry * (r + 3)); ctx.stroke();
            } catch (eFt) {}
          }
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

    // Pickups — small color-coded squares (health=green, ammo=yellow, armor=blue, other=cyan)
    if (pickups) {
      var _puColors = { HEALTH: '#22ff66', MEDKIT: '#22ff66', AMMO: '#ffcc00', ARMOR: '#4488ff', STIM: '#cc44ff', INTEL: '#00ffff', SHIELD: '#ffd700', WEAPON: '#ff8800' };
      for (var pu = 0; pu < pickups.length; pu++) {
        var puk = pickups[pu];
        if (!puk || !puk.mesh) continue;
        var pup = toMM(puk.mesh.position.x, puk.mesh.position.z);
        if (Math.abs(pup.x - MM_HALF) < MM_HALF && Math.abs(pup.y - MM_HALF) < MM_HALF) {
          ctx.fillStyle = _puColors[puk.type] || '#88ffff';
          ctx.fillRect(pup.x - 1.5, pup.y - 1.5, 3, 3);
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

    // FOV cone indicator — translucent fan in front of player
    ctx.fillStyle = 'rgba(0,255,80,0.12)';
    ctx.beginPath();
    ctx.moveTo(MM_HALF, MM_HALF);
    var _coneR = MM_HALF * 0.95;
    ctx.arc(MM_HALF, MM_HALF, _coneR, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
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
  var _compassLastUpdate = 0;

  function updateCompass(yaw) {
    if (!compassEl) return;
    if (_compassJammed) {
      compassEl.innerHTML = '<span style="position:absolute;left:50%;transform:translateX(-50%);color:#ff0000;font-weight:bold;font-size:13px">EW JAMMED</span>';
      return;
    }
    // Throttle to ~10fps (100ms) to avoid per-frame innerHTML rebuild
    var now = performance.now();
    if (now - _compassLastUpdate < 100) return;
    _compassLastUpdate = now;
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

  var _streakNames = {
    2: 'DOUBLE KILL', 3: 'TRIPLE KILL', 4: 'MULTI KILL',
    5: 'MEGA KILL', 7: 'ULTRA KILL', 10: 'UNSTOPPABLE',
    15: 'GODLIKE', 20: 'LEGENDARY'
  };
  function showStreak(count, multiplier) {
    if (!streakEl) return;
    if (count < 2) { streakEl.style.display = 'none'; return; }
    streakEl.style.display = 'block';
    var color = count >= 10 ? '#ff0000' : count >= 5 ? '#ff8800' : '#ffcc00';
    // Find highest matching streak name
    var label = '';
    var thresholds = [20, 15, 10, 7, 5, 4, 3, 2];
    for (var t = 0; t < thresholds.length; t++) {
      if (count >= thresholds[t]) { label = _streakNames[thresholds[t]]; break; }
    }
    streakEl.innerHTML = '🔥 ' + escapeHTML(label) + ' <span style="font-size:0.85em;color:' + color + '">(' + escapeHTML(count) + 'x · ' + escapeHTML(multiplier.toFixed(1)) + 'x)</span>';
    streakEl.style.color = color;
    streakEl.style.fontSize = count >= 10 ? '28px' : count >= 5 ? '24px' : '20px';
    streakEl.style.textShadow = '0 0 10px ' + color;
  }

  // ── Indicator Priority Stack ─────────────────────────────────
  // Limits bottom-center indicators to MAX_VISIBLE at once.
  // Priority: 1=critical (always show), 2=action, 3=info
  var MAX_VISIBLE_INDICATORS = 3;
  var INDICATOR_STACK_BOTTOM = 95; // starting bottom px
  var INDICATOR_STACK_GAP = 28;    // px between stacked indicators
  var _indicatorRegistry = [
    // { id, el, priority, wanted }
    { id: 'bleed-indicator',    el: null, priority: 1, wanted: false },
    { id: 'jam-indicator',      el: null, priority: 1, wanted: false },
    { id: 'overheat-indicator', el: null, priority: 1, wanted: false },
    { id: 'laststand-indicator',el: null, priority: 1, wanted: false },
    { id: 'slide-indicator',    el: null, priority: 2, wanted: false },
    { id: 'wallrun-indicator',  el: null, priority: 2, wanted: false },
    { id: 'tacsprint-indicator',el: null, priority: 2, wanted: false },
    { id: 'bayonet-indicator',  el: null, priority: 2, wanted: false },
    { id: 'swim-indicator',     el: null, priority: 2, wanted: false },
    { id: 'mantle-indicator',   el: null, priority: 2, wanted: false },
    { id: 'prone-indicator',    el: null, priority: 3, wanted: false },
    { id: 'dual-wield-indicator',el: null, priority: 3, wanted: false },
    { id: 'blindfire-indicator', el: null, priority: 3, wanted: false },
    { id: 'maintenance-indicator', el: null, priority: 3, wanted: false },
    { id: 'adrenaline-indicator',el: null, priority: 3, wanted: false },
  ];
  // Lazy-init element refs
  function _getIndEl(entry) {
    if (!entry.el) entry.el = document.getElementById(entry.id);
    return entry.el;
  }
  // Set wanted state for a registered indicator
  function _setIndicatorWanted(id, active) {
    for (var i = 0; i < _indicatorRegistry.length; i++) {
      if (_indicatorRegistry[i].id === id) { _indicatorRegistry[i].wanted = !!active; break; }
    }
  }
  // Refresh: show top N by priority, hide rest, reposition dynamically
  function _refreshIndicatorStack() {
    // Collect wanted indicators sorted by priority (lower = higher priority)
    var active = [];
    for (var i = 0; i < _indicatorRegistry.length; i++) {
      var entry = _indicatorRegistry[i];
      var el = _getIndEl(entry);
      if (!el) continue;
      // For indicators set directly by game-manager, check if they're display:block
      // but only if HUD didn't set 'wanted' (external control)
      if (entry.wanted) {
        active.push(entry);
      } else {
        el.style.display = 'none';
      }
    }
    // Sort by priority (1 first), then by registry order for same priority
    active.sort(function(a, b) { return a.priority - b.priority; });
    // Show top N, hide rest
    for (var j = 0; j < active.length; j++) {
      var el = _getIndEl(active[j]);
      if (j < MAX_VISIBLE_INDICATORS) {
        el.style.display = 'block';
        el.style.bottom = (INDICATOR_STACK_BOTTOM + j * INDICATOR_STACK_GAP) + 'px';
      } else {
        el.style.display = 'none';
      }
    }
  }
  // Public refresh — also picks up indicators toggled directly by game-manager.js
  function refreshIndicators() {
    for (var i = 0; i < _indicatorRegistry.length; i++) {
      var entry = _indicatorRegistry[i];
      var el = _getIndEl(entry);
      if (!el) continue;
      // Sync: if game-manager.js set display:block directly, treat as wanted
      if (el.style.display === 'block' && !entry.wanted) entry.wanted = true;
      if (el.style.display === 'none' && entry.wanted) {
        // HUD may have hidden it — check if it was externally hidden
        // Only clear wanted if it wasn't set by a HUD show* function
      }
    }
    _refreshIndicatorStack();
  }

  // ── Bleed Indicator ────────────────────────────────────────
  const bleedEl = document.getElementById('bleed-indicator');

  function showBleed(active) {
    if (!bleedEl) return;
    _setIndicatorWanted('bleed-indicator', active);
    _refreshIndicatorStack();
  }

  // ── Prone Indicator ────────────────────────────────────────
  const proneEl = document.getElementById('prone-indicator');

  function showProne(active) {
    if (!proneEl) return;
    _setIndicatorWanted('prone-indicator', active);
    _refreshIndicatorStack();
  }

  // ── Jam Indicator ──────────────────────────────────────────
  const jamEl = document.getElementById('jam-indicator');

  function showJam(active) {
    if (!jamEl) return;
    _setIndicatorWanted('jam-indicator', active);
    _refreshIndicatorStack();
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

  function showInteractionPrompt(text, persist) {
    if (!interactEl) return;
    interactEl.textContent = text;
    interactEl.style.display = 'block';
    clearTimeout(_interactTimer);
    if (persist) return;
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

  // ── Feature 6: Armor Bar ─────────────────────────────────────────
  const armorBarEl = document.getElementById('armor-bar');
  function updateArmor(pct) {
    if (armorBarEl) armorBarEl.style.width = (pct * 100) + '%';
  }

  // ── Feature 3: Slide Indicator ───────────────────────────────────
  const slideEl = document.getElementById('slide-indicator');
  function showSlide(active) { _setIndicatorWanted('slide-indicator', active); _refreshIndicatorStack(); }

  // ── Feature 2: Wall Run Indicator ────────────────────────────────
  const wallrunEl = document.getElementById('wallrun-indicator');
  function showWallRun(active) { _setIndicatorWanted('wallrun-indicator', active); _refreshIndicatorStack(); }

  // ── Feature 7: Tactical Sprint Indicator ─────────────────────────
  const tacSprintEl = document.getElementById('tacsprint-indicator');
  function showTacSprint(active) { _setIndicatorWanted('tacsprint-indicator', active); _refreshIndicatorStack(); }

  // ── Feature 8: Last Stand Indicator ──────────────────────────────
  const lastStandEl = document.getElementById('laststand-indicator');
  function showLastStand(active) { _setIndicatorWanted('laststand-indicator', active); _refreshIndicatorStack(); }

  // ── Feature 9: Focus Mode ────────────────────────────────────────
  const focusEl = document.getElementById('focus-indicator');
  function showFocus(active) { if (focusEl) focusEl.style.display = active ? 'block' : 'none'; }

  // ── Feature 10: Revenge Marker ───────────────────────────────────
  const revengeEl = document.getElementById('revenge-marker');
  function showRevenge(active, label) {
    if (!revengeEl) return;
    revengeEl.style.display = active ? 'block' : 'none';
    if (label) revengeEl.textContent = label;
  }

  // ── Feature 11: Dual Wield ───────────────────────────────────────
  const dualWieldEl = document.getElementById('dual-wield-indicator');
  function showDualWield(active) { _setIndicatorWanted('dual-wield-indicator', active); _refreshIndicatorStack(); }

  // ── Feature 15: Weapon Heat ──────────────────────────────────────
  const heatBarEl = document.getElementById('heat-bar');
  function updateHeat(pct) { if (heatBarEl) heatBarEl.style.width = (pct * 100) + '%'; }

  // ── Feature 20: Ammo Type ────────────────────────────────────────
  const ammoTypeEl = document.getElementById('ammo-type-indicator') || document.getElementById('ammo-type');
  const AMMO_COLORS = { 'Standard': '#aaa', 'Armor-Piercing': '#00ccff', 'Incendiary': '#ff4400', 'Hollow Point': '#ff00ff', 'Subsonic': '#888' };
  function updateAmmoType(label) {
    if (ammoTypeEl) {
      ammoTypeEl.textContent = label;
      ammoTypeEl.style.color = AMMO_COLORS[label] || '#aaa';
    }
  }

  // ── Feature 35: Fog of War ───────────────────────────────────────
  const fogEl = document.getElementById('fog-of-war');
  function showFogOfWar(active) { if (fogEl) fogEl.style.display = active ? 'block' : 'none'; }

  // ── Feature 37: Radiation Warning ────────────────────────────────
  const radEl = document.getElementById('radiation-warning');
  function showRadiation(active) { if (radEl) radEl.style.display = active ? 'block' : 'none'; }

  // ── Feature 42: Combat Log ───────────────────────────────────────
  const combatLogEl = document.getElementById('combat-log');
  function addCombatLog(text, color) {
    if (!combatLogEl) return;
    var entry = document.createElement('div');
    entry.style.color = color || '#aaa';
    entry.style.marginBottom = '2px';
    entry.style.opacity = '1';
    entry.textContent = text;
    combatLogEl.appendChild(entry);
    while (combatLogEl.children.length > 8) combatLogEl.removeChild(combatLogEl.firstChild);
    setTimeout(function () {
      entry.style.transition = 'opacity 1s';
      entry.style.opacity = '0';
      setTimeout(function () { if (entry.parentNode) entry.parentNode.removeChild(entry); }, 1000);
    }, 6000);
  }

  // ── Feature 44: Achievement Popup ────────────────────────────────
  const achievePopup = document.getElementById('achievement-popup');
  const achieveName = document.getElementById('achievement-name');
  let _achieveTimer = null;
  function showAchievement(name) {
    if (!achievePopup || !achieveName) return;
    achieveName.textContent = name;
    achievePopup.style.display = 'block';
    clearTimeout(_achieveTimer);
    _achieveTimer = setTimeout(function () { achievePopup.style.display = 'none'; }, 3000);
  }

  // ── Feature 45: Tactical Map ─────────────────────────────────────
  const tacMapEl = document.getElementById('tactical-map');
  const tacMapCanvas = document.getElementById('tactical-map-canvas');
  const tacMapCtx = tacMapCanvas ? tacMapCanvas.getContext('2d') : null;
  function showTacticalMap(active) { if (tacMapEl) tacMapEl.style.display = active ? 'block' : 'none'; }
  function isTacticalMapVisible() { return tacMapEl && tacMapEl.style.display !== 'none'; }
  function updateTacticalMap(px, pz, pyaw, enemies, npcs, pickups) {
    if (!tacMapCtx) return;
    var W = 400, H = 400, cx = W / 2, cy = H / 2, sc = 1.8;
    tacMapCtx.clearRect(0, 0, W, H);
    tacMapCtx.fillStyle = 'rgba(0,10,0,0.95)';
    tacMapCtx.fillRect(0, 0, W, H);
    // Grid
    tacMapCtx.strokeStyle = 'rgba(0,255,0,0.08)';
    tacMapCtx.lineWidth = 0.5;
    for (var g = -100; g <= 100; g += 10) {
      tacMapCtx.beginPath(); tacMapCtx.moveTo(cx + g * sc, 0); tacMapCtx.lineTo(cx + g * sc, H); tacMapCtx.stroke();
      tacMapCtx.beginPath(); tacMapCtx.moveTo(0, cy + g * sc); tacMapCtx.lineTo(W, cy + g * sc); tacMapCtx.stroke();
    }
    function toMap(wx, wz) { return { x: cx + (wx - px) * sc, y: cy + (wz - pz) * sc }; }
    // Enemies
    if (enemies) {
      tacMapCtx.fillStyle = '#ff3333';
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i]; if (!e.alive || !e.mesh) continue;
        var mp = toMap(e.mesh.position.x, e.mesh.position.z);
        if (mp.x > 0 && mp.x < W && mp.y > 0 && mp.y < H) {
          tacMapCtx.beginPath(); tacMapCtx.arc(mp.x, mp.y, 3, 0, Math.PI * 2); tacMapCtx.fill();
        }
      }
    }
    // NPCs
    if (npcs) {
      tacMapCtx.fillStyle = '#4488ff';
      for (var j = 0; j < npcs.length; j++) {
        var n = npcs[j]; if (!n.alive || !n.position) continue;
        var np = toMap(n.position.x, n.position.z);
        if (np.x > 0 && np.x < W && np.y > 0 && np.y < H) {
          tacMapCtx.beginPath(); tacMapCtx.arc(np.x, np.y, 3, 0, Math.PI * 2); tacMapCtx.fill();
        }
      }
    }
    // Pickups
    if (pickups) {
      tacMapCtx.fillStyle = '#ffcc00';
      for (var k = 0; k < pickups.length; k++) {
        var p = pickups[k]; if (!p.mesh) continue;
        var pp = toMap(p.mesh.position.x, p.mesh.position.z);
        if (pp.x > 0 && pp.x < W && pp.y > 0 && pp.y < H) {
          tacMapCtx.fillRect(pp.x - 2, pp.y - 2, 4, 4);
        }
      }
    }
    // Player
    tacMapCtx.fillStyle = '#00ff44';
    tacMapCtx.save();
    tacMapCtx.translate(cx, cy);
    tacMapCtx.rotate(-pyaw);
    tacMapCtx.beginPath(); tacMapCtx.moveTo(0, -8); tacMapCtx.lineTo(-5, 6); tacMapCtx.lineTo(5, 6); tacMapCtx.closePath(); tacMapCtx.fill();
    tacMapCtx.restore();
  }

  // ── Feature 46: Supply Menu ──────────────────────────────────────
  const supplyMenuEl = document.getElementById('supply-menu');
  function showSupplyMenu(active) { if (supplyMenuEl) supplyMenuEl.style.display = active ? 'block' : 'none'; }

  // ── Feature 47: Field Promotion ──────────────────────────────────
  const promoEl = document.getElementById('field-promotion');
  function showFieldPromotion(active) { if (promoEl) promoEl.style.display = active ? 'block' : 'none'; }

  // ── Feature 50: Wave Stats ───────────────────────────────────────
  const waveStatsEl = document.getElementById('wave-stats');
  const waveStatsContent = document.getElementById('wave-stats-content');
  function showWaveStats(stats) {
    if (!waveStatsEl || !waveStatsContent) return;
    waveStatsContent.innerHTML =
      '💀 Kills: <b>' + escapeHTML(stats.kills || 0) + '</b><br>' +
      '🎯 Accuracy: <b>' + escapeHTML(stats.accuracy || 0) + '%</b><br>' +
      '💀 Headshots: <b>' + escapeHTML(stats.headshots || 0) + '</b><br>' +
      '⏱ Time: <b>' + escapeHTML(stats.time || '0s') + '</b><br>' +
      '❤ Damage Taken: <b>' + escapeHTML(stats.damageTaken || 0) + '</b><br>' +
      '🔥 Best Streak: <b>' + escapeHTML(stats.bestStreak || 0) + '</b>';
    waveStatsEl.style.display = 'block';
    setTimeout(function () { waveStatsEl.style.display = 'none'; }, 5000);
  }

  // ── Feature 43: Death Statistics ─────────────────────────────────
  function showDeathStats(stats) {
    var el = document.getElementById('dead-statistics');
    if (!el) return;
    el.innerHTML =
      '🎯 Accuracy: ' + escapeHTML(stats.accuracy || 0) + '% | ' +
      '💀 Headshot%: ' + escapeHTML(stats.headshotPct || 0) + '%<br>' +
      '🔫 Favorite: ' + escapeHTML(stats.favWeapon || 'N/A') + ' | ' +
      '⏱ Playtime: ' + escapeHTML(stats.playtime || '0s') + '<br>' +
      '📏 Distance: ' + escapeHTML(stats.distance || 0) + 'm';
  }

  // ── OKC HUD Update ──────────────────────────────────────────────
  function updateOKC(val) {
    var el = document.getElementById('hud-okc');
    if (el) el.textContent = '🪙 ' + val + ' OKC';
  }

  // ── B22: Boss Health Bar ─────────────────────────────────────────
  let _bossBarEl = null;
  let _bossBarFill = null;
  let _bossBarName = null;

  function showBossBar(name, hp, maxHp) {
    if (!_bossBarEl) {
      _bossBarEl = document.createElement('div');
      _bossBarEl.id = 'boss-health-bar';
      _bossBarEl.style.cssText = 'position:fixed;top:5%;left:50%;transform:translateX(-50%);width:400px;background:rgba(0,0,0,0.7);border:2px solid #cc0000;border-radius:4px;padding:4px;z-index:200;text-align:center;display:none;';
      _bossBarName = document.createElement('div');
      _bossBarName.style.cssText = 'color:#ff4444;font-size:14px;font-weight:bold;margin-bottom:2px;';
      _bossBarFill = document.createElement('div');
      _bossBarFill.style.cssText = 'height:12px;background:linear-gradient(90deg,#cc0000,#ff4444);border-radius:2px;transition:width 0.3s;';
      _bossBarEl.appendChild(_bossBarName);
      _bossBarEl.appendChild(_bossBarFill);
      document.body.appendChild(_bossBarEl);
    }
    _bossBarName.textContent = '☠ ' + name;
    _bossBarFill.style.width = Math.max(0, (hp / maxHp) * 100) + '%';
    _bossBarEl.style.display = 'block';
  }

  function hideBossBar() {
    if (_bossBarEl) _bossBarEl.style.display = 'none';
  }

  // ── B22: XP Progress Bar ────────────────────────────────────────
  let _xpBarEl = null;
  let _xpBarFill = null;
  let _xpBarText = null;

  function updateXPBar(currentXP, nextLevelXP, level) {
    if (!_xpBarEl) {
      _xpBarEl = document.createElement('div');
      _xpBarEl.style.cssText = 'position:fixed;bottom:2px;left:50%;transform:translateX(-50%);width:300px;background:rgba(0,0,0,0.5);border:1px solid #4488ff;border-radius:3px;padding:2px;z-index:150;';
      _xpBarFill = document.createElement('div');
      _xpBarFill.style.cssText = 'height:6px;background:linear-gradient(90deg,#2266cc,#44aaff);border-radius:2px;transition:width 0.4s;';
      _xpBarText = document.createElement('div');
      _xpBarText.style.cssText = 'color:#aaccff;font-size:10px;text-align:center;';
      _xpBarEl.appendChild(_xpBarFill);
      _xpBarEl.appendChild(_xpBarText);
      document.body.appendChild(_xpBarEl);
    }
    var pct = nextLevelXP > 0 ? Math.min(100, (currentXP / nextLevelXP) * 100) : 100;
    _xpBarFill.style.width = pct + '%';
    // Glow pulse intensifies as you near level-up
    if (pct >= 85) {
      var glowAmt = Math.floor(6 + (pct - 85) * 0.8);
      _xpBarFill.style.boxShadow = '0 0 ' + glowAmt + 'px #66ccff, 0 0 ' + (glowAmt * 1.5) + 'px #88ddff';
      _xpBarEl.style.borderColor = pct >= 95 ? '#ffdd44' : '#88ccff';
    } else {
      _xpBarFill.style.boxShadow = 'none';
      _xpBarEl.style.borderColor = '#4488ff';
    }
    _xpBarText.textContent = 'LVL ' + level + ' — ' + currentXP + '/' + nextLevelXP + ' XP';
  }

  // ── B22: Objective Waypoint ──────────────────────────────────────
  let _objectiveEl = null;

  function showObjective(text) {
    if (!_objectiveEl) {
      _objectiveEl = document.createElement('div');
      _objectiveEl.id = 'objective-marker';
      _objectiveEl.style.cssText = 'position:fixed;top:12%;left:50%;transform:translateX(-50%);color:#ffcc44;font-size:14px;font-weight:bold;text-shadow:0 0 6px #886600;pointer-events:none;z-index:180;transition:opacity 0.5s;';
      document.body.appendChild(_objectiveEl);
    }
    _objectiveEl.textContent = '📍 ' + text;
    _objectiveEl.style.opacity = '1';
  }

  function hideObjective() {
    if (_objectiveEl) _objectiveEl.style.opacity = '0';
  }

  // ── B22: Kill Streak Banner ──────────────────────────────────────
  function showStreakBanner(streakName, count) {
    var el = document.getElementById('streak-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'streak-banner';
      el.style.cssText = 'position:fixed;top:25%;left:50%;transform:translateX(-50%);color:#ffdd44;font-size:26px;font-weight:bold;text-shadow:0 0 12px #ff8800;pointer-events:none;z-index:220;opacity:0;transition:opacity 0.3s,transform 0.3s;';
      document.body.appendChild(el);
    }
    el.textContent = '🔥 ' + streakName.toUpperCase() + ' (' + count + ' KILLS)';
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) scale(1.2)';
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) scale(1)';
    }, 2500);
  }

  // ── Boss Intro Banner ────────────────────────────────────────────
  function showBossIntro(name) {
    var el = document.getElementById('boss-intro');
    if (!el) {
      el = document.createElement('div');
      el.id = 'boss-intro';
      el.style.cssText = 'position:fixed;top:35%;left:50%;transform:translate(-50%,-50%) scale(0.6);color:#ff2222;font-size:42px;font-weight:900;letter-spacing:3px;text-shadow:0 0 18px #ff0000,0 0 36px #aa0000;pointer-events:none;z-index:240;opacity:0;transition:opacity 0.35s,transform 0.5s cubic-bezier(.34,1.56,.64,1);font-family:"Impact","Arial Black",sans-serif;';
      document.body.appendChild(el);
    }
    el.textContent = '⚠ ' + (name || 'BOSS') + ' ⚠';
    void el.offsetWidth;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,-50%) scale(1.15)';
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(0.85)';
    }, 2200);
  }

  // ── B22: Damage Log (scrolling combat text) ──────────────────────
  let _dmgLogEl = null;

  function addDamageLog(text, color) {
    if (!_dmgLogEl) {
      _dmgLogEl = document.createElement('div');
      _dmgLogEl.id = 'damage-log';
      _dmgLogEl.style.cssText = 'position:fixed;bottom:15%;right:10px;width:200px;max-height:120px;overflow:hidden;pointer-events:none;z-index:150;font-size:11px;';
      document.body.appendChild(_dmgLogEl);
    }
    var entry = document.createElement('div');
    entry.textContent = text;
    entry.style.cssText = 'color:' + (color || '#cccccc') + ';opacity:1;transition:opacity 2s;margin-bottom:1px;';
    _dmgLogEl.appendChild(entry);
    // limit entries
    while (_dmgLogEl.children.length > 8) _dmgLogEl.removeChild(_dmgLogEl.firstChild);
    setTimeout(function () { entry.style.opacity = '0'; }, 3000);
    setTimeout(function () { if (entry.parentNode) entry.remove(); }, 5000);
  }

  // ── B22: Grenade Indicator ───────────────────────────────────────
  function showGrenadeWarning(direction) {
    var el = document.getElementById('grenade-warning');
    if (!el) {
      el = document.createElement('div');
      el.id = 'grenade-warning';
      el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#ff4400;font-size:32px;font-weight:bold;text-shadow:0 0 10px #ff0000;pointer-events:none;z-index:250;opacity:0;transition:opacity 0.2s;';
      document.body.appendChild(el);
    }
    el.textContent = '💣 GRENADE!';
    el.style.opacity = '1';
    setTimeout(function () { el.style.opacity = '0'; }, 1500);
  }

  // ── B22: Stage Progress Bar ──────────────────────────────────────
  let _stageProgressEl = null;
  let _stageProgressFill = null;

  function updateStageProgress(currentWave, totalWaves) {
    if (!_stageProgressEl) {
      _stageProgressEl = document.createElement('div');
      _stageProgressEl.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:3px;background:rgba(0,0,0,0.3);z-index:150;';
      _stageProgressFill = document.createElement('div');
      _stageProgressFill.style.cssText = 'height:100%;background:linear-gradient(90deg,#ffcc00,#ff6600);transition:width 0.5s;';
      _stageProgressEl.appendChild(_stageProgressFill);
      document.body.appendChild(_stageProgressEl);
    }
    _stageProgressFill.style.width = Math.min(100, (currentWave / totalWaves) * 100) + '%';
  }

  // ── B22: Damage Flash with Color ─────────────────────────────────
  function showDamageFlash(color, opacity) {
    var el = document.getElementById('damage-vignette');
    if (!el) return;
    var prev = el.style.background;
    el.style.background = 'radial-gradient(ellipse at center, transparent 50%, ' + (typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color || 'rgba(255,0,0,0.4)') + ' 100%)';
    el.style.opacity = opacity || '0.5';
    el.style.display = 'block';
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { el.style.display = 'none'; el.style.background = prev; }, 300);
    }, 200);
  }

  // ── B26: FPS Counter ──
  var _fpsEl = null, _fpsTimes = [], _fpsVisible = false;
  (function initFPSCounter() {
    _fpsEl = document.createElement('div');
    _fpsEl.id = 'fps-counter';
    _fpsEl.style.cssText = 'position:fixed;top:4px;left:4px;color:#0f0;font:bold 14px monospace;' +
      'z-index:9999;pointer-events:none;text-shadow:1px 1px 2px #000;display:none;';
    document.body.appendChild(_fpsEl);
  })();
  function toggleFPS() {
    _fpsVisible = !_fpsVisible;
    if (_fpsEl) _fpsEl.style.display = _fpsVisible ? 'block' : 'none';
  }
  function updateFPS() {
    if (!_fpsVisible || !_fpsEl) return;
    var now = performance.now();
    _fpsTimes.push(now);
    while (_fpsTimes.length > 0 && _fpsTimes[0] <= now - 1000) _fpsTimes.shift();
    _fpsEl.textContent = _fpsTimes.length + ' FPS';
  }

  // ── B26: Settings Panel ──
  var _settingsOpen = false;
  var _settings = {
    musicVol: 0.5, sfxVol: 0.8, sensitivity: 1.0, fov: 70,
    showFPS: false, crosshairColor: '#ffffff', crosshairSize: 1.0,
  };
  var _settingsEl = null;
  (function initSettingsPanel() {
    _settingsEl = document.createElement('div');
    _settingsEl.id = 'settings-panel';
    _settingsEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(0,0,0,0.92);border:2px solid #ffcc00;border-radius:12px;padding:24px;' +
      'color:#fff;font:14px sans-serif;z-index:10000;display:none;min-width:320px;';
    _settingsEl.innerHTML = '<h2 style="margin:0 0 16px;color:#ffcc00;text-align:center;">⚙ SETTINGS</h2>' +
      '<label>Music Volume <input type="range" id="set-music" min="0" max="100" value="50"></label><br>' +
      '<label>SFX Volume <input type="range" id="set-sfx" min="0" max="100" value="80"></label><br>' +
      '<label>Mouse Sensitivity <input type="range" id="set-sens" min="10" max="300" value="100"></label><br>' +
      '<label>FOV <input type="range" id="set-fov" min="50" max="120" value="70"></label><br>' +
      '<label>Show FPS <input type="checkbox" id="set-fps"></label><br>' +
      '<label>Crosshair Color <input type="color" id="set-xhair" value="#ffffff"></label><br>' +
      '<div style="text-align:center;margin-top:16px;"><button id="set-close" style="padding:8px 24px;'+
      'background:#ffcc00;color:#000;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">CLOSE</button></div>';
    document.body.appendChild(_settingsEl);
    setTimeout(function () {
      var btn = document.getElementById('set-close');
      if (btn) btn.onclick = function () { toggleSettings(); };
      var fpsCheck = document.getElementById('set-fps');
      if (fpsCheck) fpsCheck.onchange = function () {
        _settings.showFPS = fpsCheck.checked;
        if (_settings.showFPS && !_fpsVisible) toggleFPS();
        else if (!_settings.showFPS && _fpsVisible) toggleFPS();
      };
      var fovSlider = document.getElementById('set-fov');
      if (fovSlider) fovSlider.oninput = function () {
        _settings.fov = parseInt(fovSlider.value);
      };
    }, 100);
  })();
  function toggleSettings() {
    _settingsOpen = !_settingsOpen;
    if (_settingsEl) _settingsEl.style.display = _settingsOpen ? 'block' : 'none';
  }
  function getSettings() { return _settings; }

  // ── Weapon Unlock Card ────────────────────────────────────────────
  var _weaponCardEl = null;
  var _weaponCardTimer = null;
  var _shownWeapons = {}; // track which weapons have shown the big card
  // Restore shown weapons from localStorage
  try { var _sw = localStorage.getItem('ok_shown_weapons'); if (_sw) _shownWeapons = JSON.parse(_sw); } catch(e){}

  function showWeaponUnlockCard(weaponDef) {
    if (!weaponDef || !weaponDef.name) return;
    // Only show the big card on FIRST ever unlock of this weapon
    if (_shownWeapons[weaponDef.id]) return;
    _shownWeapons[weaponDef.id] = true;
    try { localStorage.setItem('ok_shown_weapons', JSON.stringify(_shownWeapons)); } catch(e){}

    if (!_weaponCardEl) {
      _weaponCardEl = document.createElement('div');
      _weaponCardEl.style.cssText = 'position:fixed;top:25%;left:50%;transform:translateX(-50%) scale(0.6);' +
        'background:rgba(10,10,10,0.92);border:2px solid #ffcc00;border-radius:8px;padding:16px 28px;' +
        'z-index:300;pointer-events:none;text-align:center;font-family:monospace;' +
        'transition:transform 0.25s ease-out, opacity 0.3s;opacity:0;min-width:240px;' +
        'box-shadow:0 0 30px rgba(255,200,0,0.3),inset 0 0 20px rgba(255,200,0,0.05);';
      document.body.appendChild(_weaponCardEl);
    }
    var typeLabel = weaponDef.type || '';
    var dmg = weaponDef.damage || 0;
    var rpm = weaponDef.fireRate ? Math.round(60 / weaponDef.fireRate) : 0;
    var clipStr = weaponDef.clipSize ? weaponDef.clipSize + ' / ' + weaponDef.maxReserve : '∞';
    _weaponCardEl.innerHTML =
      '<div style="color:#ffcc00;font-size:10px;letter-spacing:3px;margin-bottom:4px">🔓 NEW WEAPON UNLOCKED</div>' +
      '<div style="color:#fff;font-size:20px;font-weight:bold;margin:6px 0;text-shadow:0 0 8px rgba(255,200,0,0.4)">' + escapeHTML(weaponDef.name) + '</div>' +
      '<div style="color:#888;font-size:11px;margin-bottom:8px">' + escapeHTML(typeLabel) + '</div>' +
      '<div style="display:flex;justify-content:center;gap:18px;color:#aaa;font-size:11px">' +
        '<span>⚔ ' + escapeHTML(dmg) + ' DMG</span>' +
        (rpm ? '<span>🔥 ' + escapeHTML(rpm) + ' RPM</span>' : '') +
        '<span>📦 ' + escapeHTML(clipStr) + '</span>' +
      '</div>';
    _weaponCardEl.style.opacity = '1';
    _weaponCardEl.style.transform = 'translateX(-50%) scale(1)';
    clearTimeout(_weaponCardTimer);
    _weaponCardTimer = setTimeout(function () {
      _weaponCardEl.style.opacity = '0';
      _weaponCardEl.style.transform = 'translateX(-50%) scale(0.8)';
    }, 2800);
  }

  // ── Last Wave Summary Overlay ──
  let _waveSummaryEl = null;
  function showWaveSummary(stats) {
    if (!_waveSummaryEl) {
      _waveSummaryEl = document.createElement('div');
      _waveSummaryEl.id = 'wave-summary-overlay';
      _waveSummaryEl.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.93);border:2px solid #44aaff;border-radius:12px;padding:32px 48px;z-index:10001;color:#fff;font-family:monospace;min-width:340px;text-align:center;box-shadow:0 0 40px #44aaff44;display:none;';
      document.body.appendChild(_waveSummaryEl);
    }
    let html = '<h2 style="color:#44aaff;margin-bottom:18px">WAVE COMPLETE!</h2>';
    html += `<div style='font-size:18px;margin-bottom:10px'>Wave <b>${stats.wave}</b> cleared</div>`;
    html += `<div>Kills: <b>${stats.kills}</b> &nbsp; | &nbsp; Score: <b>${stats.score}</b></div>`;
    html += `<div>Headshots: <b>${stats.headshots}</b> &nbsp; | &nbsp; Damage Taken: <b>${stats.damageTaken}</b></div>`;
    html += `<div style='margin-top:12px;font-size:13px;color:#aaa'>Time: <b>${stats.time}s</b></div>`;
    html += `<button id='wave-summary-close' style='margin-top:18px;padding:8px 28px;background:#44aaff;color:#000;border:none;border-radius:6px;font-weight:bold;cursor:pointer;font-size:15px;'>CONTINUE</button>`;
    _waveSummaryEl.innerHTML = html;
    _waveSummaryEl.style.display = 'block';
    document.getElementById('wave-summary-close').onclick = function() {
      _waveSummaryEl.style.display = 'none';
    };
  }

  return {
    show, hide,
    setScore, setWave, setKills, setEnemies, setStage,
    setHealth, setAmmo, setWeapon, showReload,
    flashHit, flashDamage, flashHeal, showBloodDrops,
    showHeadshot, notifyPickup, setCrosshairSpread, setCrosshairTarget, setRangeReadout, setSprintIntensity, setGrenadeWarning,
    announceWave, announceStage,
    addKill, showHitDirection, updateMinimap,
    updateCompass, showStreak, showBleed, showProne, showJam,
    setMinimapJammed, setCompassJammed,
    showVehicleHUD, hideVehicleHUD, updateVehicleHUD, showHijackProgress,
    updateStamina, showNightVision, updateWeatherDisplay,
    showInteractionPrompt, hideInteractionPrompt,
    showLowHP, showShield,
    // ── New Feature HUD Functions ──
    updateArmor, showSlide, showWallRun, showTacSprint,
    showLastStand, showFocus, showRevenge,
    showDualWield, updateHeat, updateAmmoType,
    showFogOfWar, showRadiation,
    addCombatLog, showAchievement,
    showTacticalMap, isTacticalMapVisible, updateTacticalMap,
    showSupplyMenu, showFieldPromotion, showWaveStats,
    showDeathStats, updateOKC,
    // ── B22: New HUD ──
    showBossBar, hideBossBar,
    updateXPBar, showObjective, hideObjective,
    showStreakBanner, showBossIntro, addDamageLog,
    showGrenadeWarning, updateStageProgress,
    showDamageFlash,
    // ── B26: QoL ──
    toggleFPS, updateFPS, toggleSettings, getSettings,
    refreshIndicators,
    showWeaponUnlockCard,
    // ── NPC Morale HUD Overlay ──
    updateNpcMoraleIndicators,
    // ── Targeting Assistant ──
    updateTargetAssist,
  };
})();
