/**
 * hud.js – Heads-Up Display helpers
 * Depends on: nothing (pure DOM)
 */

const HUD = (() => {
  const el = {
    hud:       document.getElementById('hud'),
    score:     document.getElementById('score-display'),
    wave:      document.getElementById('wave-display'),
    kills:     document.getElementById('kills-display'),
    healthBar: document.getElementById('health-bar'),
    healthVal: document.getElementById('health-value'),
    ammo:      document.getElementById('ammo-display'),
    ammoRes:   document.getElementById('ammo-reserve'),
    reload:    document.getElementById('reload-indicator'),
    hitMarker: document.getElementById('hit-marker'),
    vignette:  document.getElementById('damage-vignette'),
    waveAnn:   document.getElementById('wave-announce'),
  };

  let hitMarkerTimer  = null;
  let vignetteTimer   = null;

  function show() { el.hud.style.display = 'block'; }
  function hide() { el.hud.style.display = 'none'; }

  function setScore(v) { el.score.textContent = 'SCORE: ' + v; }
  function setWave(v)  { el.wave.textContent  = 'WAVE: '  + v; }
  function setKills(v) { el.kills.textContent = 'KILLS: ' + v; }

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

  function showReload(on) {
    if (on) el.reload.classList.add('visible');
    else    el.reload.classList.remove('visible');
  }

  function flashHit() {
    el.hitMarker.classList.add('visible');
    clearTimeout(hitMarkerTimer);
    hitMarkerTimer = setTimeout(() => el.hitMarker.classList.remove('visible'), 140);
  }

  function flashDamage() {
    el.vignette.classList.add('hit');
    clearTimeout(vignetteTimer);
    vignetteTimer = setTimeout(() => el.vignette.classList.remove('hit'), 300);
  }

  function announceWave(number, enemyCount) {
    el.waveAnn.innerHTML = `<h2>WAVE ${number}</h2><p>${enemyCount} OCCUPANTS INCOMING</p>`;
    el.waveAnn.classList.remove('visible');
    // Force reflow so animation restarts
    void el.waveAnn.offsetWidth;
    el.waveAnn.classList.add('visible');
    setTimeout(() => el.waveAnn.classList.remove('visible'), 2200);
  }

  return { show, hide, setScore, setWave, setKills, setHealth, setAmmo, showReload, flashHit, flashDamage, announceWave };
})();
