/* ───────────────────────────────────────────────────────────────────────
   TIME SYSTEM — day/night cycles, weekly/seasonal, speed controls
   ─────────────────────────────────────────────────────────────────────── */
const TimeSystem = (function () {
  'use strict';

  /* ── Constants ───────────────────────────────────────────────────── */
  const DAY_DURATION   = 600;  // real seconds for one full day (10 min)
  const DAYS_PER_WEEK  = 7;
  const WEEKS_PER_SEASON = 4;
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

  /* ── State ───────────────────────────────────────────────────────── */
  let timeOfDay  = 0.25;  // 0–1, 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
  let dayNumber  = 1;
  let weekNumber = 1;
  let seasonIdx  = 0;
  let speed      = 1;     // 0=paused, 1=normal, 2, 5, 10
  let isPaused   = false;

  /* ── Lighting references ─────────────────────────────────────────── */
  let _sunLight     = null;
  let _ambientLight = null;
  let _hemisphereLight = null;
  let _scene        = null;
  let _fog          = null;

  /* ── Callbacks ───────────────────────────────────────────────────── */
  let _onDayChange    = null;
  let _onWeekChange   = null;
  let _onSeasonChange = null;
  let _onPhaseChange  = null;  // day↔night

  /* ── Phase ───────────────────────────────────────────────────────── */
  function getPhase() {
    if (timeOfDay >= 0.22 && timeOfDay < 0.75) return 'day';
    return 'night';
  }

  function isDaytime() { return getPhase() === 'day'; }
  function isNighttime() { return getPhase() === 'night'; }

  /* ── Sun position & color calculation ────────────────────────────── */
  function getSunAngle() {
    return (timeOfDay - 0.25) * Math.PI * 2;
  }

  function lerpColor(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bv = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bv;
  }

  /* ── Season effects on environment ───────────────────────────────── */
  const SEASON_TINTS = {
    Spring: { fog: 0x88AA88, ambient: 0x506050, sunTint: 0xFFEEDD },
    Summer: { fog: 0xAAAA88, ambient: 0x606050, sunTint: 0xFFDD99 },
    Autumn: { fog: 0x998866, ambient: 0x504030, sunTint: 0xFF9944 },
    Winter: { fog: 0xCCCCDD, ambient: 0x405060, sunTint: 0xCCDDFF },
  };

  /* ── Init ────────────────────────────────────────────────────────── */
  function init(scene, sunLight, ambientLight, hemisphereLight) {
    _scene = scene;
    _sunLight = sunLight;
    _ambientLight = ambientLight;
    _hemisphereLight = hemisphereLight;
    _fog = scene.fog;
    timeOfDay = 0.3; // start at morning
    dayNumber = 1;
    weekNumber = 1;
    seasonIdx = 0;
    speed = 1;
    isPaused = false;
  }

  /* ── Update ──────────────────────────────────────────────────────── */
  function update(delta) {
    if (isPaused || speed === 0) return;

    const prevPhase = getPhase();
    const prevDay = dayNumber;

    // Advance time
    timeOfDay += (delta * speed) / DAY_DURATION;

    // Day rollover
    if (timeOfDay >= 1.0) {
      timeOfDay -= 1.0;
      dayNumber++;

      if (_onDayChange) _onDayChange(dayNumber);

      // Week rollover
      if ((dayNumber - 1) % DAYS_PER_WEEK === 0) {
        weekNumber++;
        if (_onWeekChange) _onWeekChange(weekNumber);

        // Season rollover
        if ((weekNumber - 1) % WEEKS_PER_SEASON === 0) {
          seasonIdx = (seasonIdx + 1) % SEASONS.length;
          if (_onSeasonChange) _onSeasonChange(SEASONS[seasonIdx]);
        }
      }
    }

    // Phase change notification
    const newPhase = getPhase();
    if (newPhase !== prevPhase && _onPhaseChange) {
      _onPhaseChange(newPhase);
    }

    // Update lighting
    updateLighting();
  }

  /* ── Lighting Update ─────────────────────────────────────────────── */
  function updateLighting() {
    if (!_sunLight) return;

    const season = SEASONS[seasonIdx];
    const tint = SEASON_TINTS[season];
    const angle = getSunAngle();

    // Sun position (circular arc)
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle) * 0.5;
    const sunZ = Math.cos(angle) * 0.866;

    _sunLight.position.set(sunX * 50, Math.max(sunY * 50, -10), sunZ * 50);

    // Sun intensity based on height
    const sunIntensity = Math.max(0, sunY);
    _sunLight.intensity = sunIntensity * 1.2;

    // Sun color: warm at low angles, white at zenith
    const warmth = 1 - sunIntensity;
    const sunColor = lerpColor(0xFFFFFF, tint.sunTint, warmth * 0.6);
    _sunLight.color.setHex(sunColor);

    // Ambient light: brighter during day, dark at night
    if (_ambientLight) {
      const ambientStr = 0.15 + sunIntensity * 0.5;
      _ambientLight.intensity = ambientStr;
      const nightAmbient = 0x101828;
      const dayAmbient = tint.ambient;
      _ambientLight.color.setHex(lerpColor(nightAmbient, dayAmbient, sunIntensity));
    }

    // Hemisphere light
    if (_hemisphereLight) {
      _hemisphereLight.intensity = 0.2 + sunIntensity * 0.4;
    }

    // Fog color shifts
    if (_fog) {
      const nightFog = 0x101018;
      const dayFog = tint.fog;
      _fog.color.setHex(lerpColor(nightFog, dayFog, sunIntensity));
      _scene.background = _fog.color;
    }
  }

  /* ── Speed Controls ──────────────────────────────────────────────── */
  function setSpeed(s) {
    speed = s;
    if (s > 0) isPaused = false;
  }
  function pause()  { isPaused = true; }
  function resume() { isPaused = false; }
  function togglePause() { isPaused = !isPaused; }

  /* ── Formatted Time ──────────────────────────────────────────────── */
  function getFormattedTime() {
    const hours = Math.floor(timeOfDay * 24);
    const minutes = Math.floor((timeOfDay * 24 - hours) * 60);
    const hStr = String(hours).padStart(2, '0');
    const mStr = String(minutes).padStart(2, '0');
    return hStr + ':' + mStr;
  }

  function getInfo() {
    return {
      time: getFormattedTime(),
      timeOfDay,
      phase: getPhase(),
      day: dayNumber,
      week: weekNumber,
      season: SEASONS[seasonIdx],
      speed,
      isPaused,
    };
  }

  /* ── Callbacks ───────────────────────────────────────────────────── */
  function onDayChange(cb)    { _onDayChange = cb; }
  function onWeekChange(cb)   { _onWeekChange = cb; }
  function onSeasonChange(cb) { _onSeasonChange = cb; }
  function onPhaseChange(cb)  { _onPhaseChange = cb; }

  return {
    init,
    update,
    setSpeed,
    pause,
    resume,
    togglePause,
    isDaytime,
    isNighttime,
    getPhase,
    getFormattedTime,
    getInfo,
    onDayChange,
    onWeekChange,
    onSeasonChange,
    onPhaseChange,
    DAY_DURATION,
    SEASONS,
  };
})();
