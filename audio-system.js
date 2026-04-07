/* ───────────────────────────────────────────────────────────
   AUDIO SYSTEM — Procedural sound effects via Web Audio API
   ─────────────────────────────────────────────────────────── */
const AudioSystem = (function () {
  'use strict';

  let ctx = null;
  let masterGain = null;
  let enabled = true;
  let volume = 0.5;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
    } catch (e) {
      enabled = false;
    }
  }

  // Resume context on user gesture (required by browsers)
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Sound Generators ────────────────────────────────────

  function playGunshot(type) {
    // type: 'pistol', 'rifle', 'sniper', 'hmg', 'shotgun'
    if (!enabled || !ctx) return;
    resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const noise = createNoise(0.08);
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Different gun types have different characteristics
    const params = {
      pistol:       { freq: 800, decay: 0.06, noiseVol: 0.4, filterFreq: 3000 },
      rifle:        { freq: 400, decay: 0.10, noiseVol: 0.6, filterFreq: 2000 },
      sniper:       { freq: 200, decay: 0.15, noiseVol: 0.8, filterFreq: 1500 },
      heavy_sniper: { freq: 120, decay: 0.22, noiseVol: 0.95, filterFreq: 1000 },
      hmg:          { freq: 300, decay: 0.08, noiseVol: 0.7, filterFreq: 1800 },
      launcher:     { freq: 150, decay: 0.25, noiseVol: 0.9, filterFreq: 800 },
      melee:        { freq: 600, decay: 0.05, noiseVol: 0.3, filterFreq: 4000 },
      shotgun:      { freq: 250, decay: 0.12, noiseVol: 0.85, filterFreq: 1200 },
      smg:          { freq: 650, decay: 0.04, noiseVol: 0.5, filterFreq: 2800 },
      explosive:    { freq: 100, decay: 0.30, noiseVol: 1.0, filterFreq: 600 },
    }[type] || { freq: 400, decay: 0.10, noiseVol: 0.6, filterFreq: 2000 };

    filter.type = 'lowpass';
    filter.frequency.value = params.filterFreq;

    osc.frequency.setValueAtTime(params.freq, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + params.decay);
    osc.type = 'sawtooth';

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + params.decay);

    osc.connect(filter);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + params.decay);
  }

  function playExplosion() {
    if (!enabled || !ctx) return;
    resume();
    const now = ctx.currentTime;
    const noise = createNoise(0.5);
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.5);

    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
  }

  function playFlashbang() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    // High-pitched burst + ringing
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(4000, now);
    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.5);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.8);
    // Tinnitus ring
    var ring = ctx.createOscillator();
    var ringGain = ctx.createGain();
    ring.type = 'sine';
    ring.frequency.value = 3200;
    ringGain.gain.setValueAtTime(0.1, now + 0.1);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    ring.connect(ringGain);
    ringGain.connect(masterGain);
    ring.start(now + 0.1);
    ring.stop(now + 2.0);
  }

  // ── Spatial panning helper ─────────────────────────────
  // pos = {x,z} sound source, listener = {x,z} camera, angle = camera Y rotation
  function _calcPan(pos, listener, angle) {
    if (!pos || !listener) return 0;
    var dx = pos.x - listener.x, dz = pos.z - listener.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.1) return 0;
    // Angle from listener to source relative to listener facing direction
    var toSource = Math.atan2(dx, dz);
    var rel = toSource - (angle || 0);
    return Math.max(-1, Math.min(1, Math.sin(rel)));
  }

  function playSpatialGunshot(type, worldPos, listenerPos, listenerAngle) {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var noise = createNoise(0.08);
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    var params = {
      pistol:       { freq: 800, decay: 0.06, noiseVol: 0.4, filterFreq: 3000 },
      rifle:        { freq: 400, decay: 0.10, noiseVol: 0.6, filterFreq: 2000 },
      sniper:       { freq: 200, decay: 0.15, noiseVol: 0.8, filterFreq: 1500 },
      heavy_sniper: { freq: 120, decay: 0.22, noiseVol: 0.95, filterFreq: 1000 },
      hmg:          { freq: 300, decay: 0.08, noiseVol: 0.7, filterFreq: 1800 },
    }[type] || { freq: 400, decay: 0.10, noiseVol: 0.6, filterFreq: 2000 };
    filter.type = 'lowpass';
    filter.frequency.value = params.filterFreq;
    osc.frequency.setValueAtTime(params.freq, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + params.decay);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + params.decay);
    // Spatial panning (guarded for Safari < 14.1)
    var panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.value = _calcPan(worldPos, listenerPos, listenerAngle);
    // Distance attenuation
    if (listenerPos && worldPos) {
      var ddx = worldPos.x - listenerPos.x, ddz = worldPos.z - listenerPos.z;
      var dd = Math.sqrt(ddx * ddx + ddz * ddz);
      gain.gain.setValueAtTime(0.3 * Math.max(0.05, 1 - dd / 80), now);
    }
    osc.connect(filter);
    noise.connect(filter);
    filter.connect(gain);
    if (panner) { gain.connect(panner); panner.connect(masterGain); }
    else { gain.connect(masterGain); }
    osc.start(now);
    osc.stop(now + params.decay);
  }

  function playHit() {
    if (!enabled || !ctx) return;
    resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  function playReload() {
    if (!enabled || !ctx) return;
    resume();
    const now = ctx.currentTime;
    // Click-clack sound
    [0, 0.3, 0.6].forEach(function (t) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 2000 + Math.random() * 1000;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.1, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.03);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + t);
      osc.stop(now + t + 0.04);
    });
  }

  function playPickup() {
    if (!enabled || !ctx) return;
    resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.1);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function playDeath() {
    if (!enabled || !ctx) return;
    resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  function playFootstep() {
    if (!enabled || !ctx) return;
    resume();
    const now = ctx.currentTime;
    const noise = createNoise(0.04);
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
  }

  // Landing thud — low-frequency impact sound scaled by intensity
  function playLandingThud(intensity) {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var noise = createNoise(0.1 + intensity * 0.1);
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200 + intensity * 300;
    gain.gain.setValueAtTime(0.15 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
  }

  // ── Bullet snap / near-miss whizz ───────────────────────────
  function playBulletSnap(pan) {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var source = createNoise(0.04);
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000 + Math.random() * 4000;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    source.connect(hp);
    hp.connect(gain);
    var panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan || 0));
      gain.connect(panner);
      panner.connect(masterGain);
    } else {
      gain.connect(masterGain);
    }
  }

  // Enemy footstep sound — distance-attenuated
  function playEnemyFootstep(distance) {
    if (!enabled || !ctx || distance > 25) return;
    resume();
    var vol = Math.max(0.005, 0.04 * (1 - distance / 25));
    var now = ctx.currentTime;
    var noise = createNoise(0.03);
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500 + Math.random() * 200;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
  }

  // Vehicle engine sound (oscillator-based)
  var _engineOsc = null;
  var _engineGain = null;
  function startEngine() {
    if (!enabled || !ctx) return;
    stopEngine(); // prevent orphaned oscillator leak
    resume();
    _engineOsc = ctx.createOscillator();
    _engineOsc.type = 'sawtooth';
    _engineOsc.frequency.value = 80;
    _engineGain = ctx.createGain();
    _engineGain.gain.value = 0;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    _engineOsc.connect(filter);
    filter.connect(_engineGain);
    _engineGain.connect(masterGain);
    _engineOsc.start();
  }
  function updateEngine(speed) {
    if (!_engineOsc || !_engineGain) return;
    _engineOsc.frequency.value = 80 + speed * 3;
    _engineGain.gain.value = Math.min(0.12, speed * 0.008);
  }
  function stopEngine() {
    if (_engineOsc) { try { _engineOsc.stop(); } catch(e){} _engineOsc = null; }
    _engineGain = null;
  }

  // Ricochet ping — metallic high-freq chirp
  function playRicochet() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3000 + Math.random() * 2000, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Drone motor buzz — continuous oscillator pair, call update to change volume
  var _droneOsc1 = null, _droneOsc2 = null, _droneGain = null;
  function startDroneMotor() {
    if (!enabled || !ctx || _droneOsc1) return;
    resume();
    _droneOsc1 = ctx.createOscillator();
    _droneOsc1.type = 'sawtooth';
    _droneOsc1.frequency.value = 180;
    _droneOsc2 = ctx.createOscillator();
    _droneOsc2.type = 'square';
    _droneOsc2.frequency.value = 183; // slight detune for buzz
    _droneGain = ctx.createGain();
    _droneGain.gain.value = 0.04;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 2;
    _droneOsc1.connect(filter);
    _droneOsc2.connect(filter);
    filter.connect(_droneGain);
    _droneGain.connect(masterGain);
    _droneOsc1.start();
    _droneOsc2.start();
  }
  function updateDroneMotor(distance) {
    if (!_droneGain) return;
    if (distance > 40) { _droneGain.gain.value = 0; return; }
    _droneGain.gain.value = Math.max(0.005, 0.06 * (1 - distance / 40));
  }
  function stopDroneMotor() {
    if (_droneOsc1) { try { _droneOsc1.stop(); } catch(e){} _droneOsc1 = null; }
    if (_droneOsc2) { try { _droneOsc2.stop(); } catch(e){} _droneOsc2 = null; }
    _droneGain = null;
  }

  function playAmbientWind() {
    if (!enabled || !ctx) return;
    resume();
    // Continuous wind loop using filtered noise
    const noise = createNoise(10);
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 300;
    filter.Q.value = 0.5;
    gain.gain.value = 0.03;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    return { stop: function () { try { gain.gain.value = 0; } catch(e){} } };
  }

  // ── Stage-specific ambient loop ───────────────────────────
  var _ambientNodes = [];   // gain nodes for volume kill
  var _ambientSources = []; // oscillators + buffer sources to .stop()
  var _ambientTimers = [];  // setInterval IDs

  function stopAmbientLoop() {
    var i;
    for (i = 0; i < _ambientTimers.length; i++) {
      clearInterval(_ambientTimers[i]);
    }
    for (i = 0; i < _ambientSources.length; i++) {
      try { _ambientSources[i].stop(); } catch(e){}
    }
    for (i = 0; i < _ambientNodes.length; i++) {
      try { _ambientNodes[i].disconnect(); } catch(e){}
    }
    _ambientNodes = [];
    _ambientSources = [];
    _ambientTimers = [];
  }

  // Helper: looping noise source connected through filter → gain → master
  function _ambientNoise(duration, filterType, filterFreq, filterQ, vol) {
    var src = createNoise(duration);
    src.loop = true;
    var flt = ctx.createBiquadFilter();
    flt.type = filterType; flt.frequency.value = filterFreq;
    if (filterQ !== undefined) flt.Q.value = filterQ;
    var g = ctx.createGain();
    g.gain.value = vol;
    src.connect(flt); flt.connect(g); g.connect(masterGain);
    _ambientSources.push(src);
    _ambientNodes.push(g, flt);
    return g;
  }

  // Helper: LFO-gated oscillator (intermittent tone)
  function _ambientTone(freq, oscType, lfoFreq, vol) {
    var osc = ctx.createOscillator();
    osc.type = oscType; osc.frequency.value = freq;
    var lfo = ctx.createOscillator();
    lfo.type = 'square'; lfo.frequency.value = lfoFreq;
    var amp = ctx.createGain(); amp.gain.value = 0;
    lfo.connect(amp.gain);
    var g = ctx.createGain(); g.gain.value = vol;
    osc.connect(amp); amp.connect(g); g.connect(masterGain);
    osc.start(); lfo.start();
    _ambientSources.push(osc, lfo);
    _ambientNodes.push(g, amp);
    return g;
  }

  // Helper: continuous oscillator
  function _ambientOsc(freq, oscType, vol) {
    var osc = ctx.createOscillator();
    osc.type = oscType; osc.frequency.value = freq;
    var g = ctx.createGain(); g.gain.value = vol;
    osc.connect(g); g.connect(masterGain);
    osc.start();
    _ambientSources.push(osc);
    _ambientNodes.push(g);
    return g;
  }

  // Helper: periodic one-shot event (boom, clank, etc.)
  function _ambientPeriodicShot(intervalMs, jitterMs, builder) {
    var id = setInterval(function () {
      if (!enabled || !ctx) return;
      var jitter = Math.random() * jitterMs;
      setTimeout(function () { builder(ctx.currentTime); }, jitter);
    }, intervalMs);
    _ambientTimers.push(id);
  }

  function startAmbientLoop(theme) {
    if (!enabled || !ctx) return;
    resume();
    stopAmbientLoop();

    // ── Base wind layer (all stages) ──
    // Gentle lowpassed white noise — always present
    _ambientNoise(10, 'lowpass', 400, 0.7, 0.025);

    if (theme === 'grassland') {
      // ── Grassland ──────────────────────────────────────
      // Bird chirps: high sine blips, LFO-gated at ~0.4 Hz
      _ambientTone(3800, 'sine', 0.4, 0.010);
      // Second bird, slightly detuned, slower cadence
      _ambientTone(4400, 'sine', 0.25, 0.007);
      // Rustling: bandpassed noise pulsing via LFO
      _ambientNoise(6, 'bandpass', 2200, 1.5, 0.015);

    } else if (theme === 'urban') {
      // ── Urban ──────────────────────────────────────────
      // Low city rumble
      _ambientNoise(8, 'lowpass', 120, 0.7, 0.045);
      // Creaking metal: narrow bandpass tone, slow LFO
      _ambientTone(320, 'sawtooth', 0.12, 0.006);
      // Distant artillery: periodic booms
      _ambientPeriodicShot(4000, 3000, function (now) {
        var n = createNoise(0.4);
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.setValueAtTime(300, now);
        f.frequency.exponentialRampToValueAtTime(60, now + 0.4);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.07, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        n.connect(f); f.connect(g); g.connect(masterGain);
      });

    } else if (theme === 'industrial') {
      // ── Industrial ─────────────────────────────────────
      // Machine hum: low sawtooth drone
      _ambientOsc(55, 'sawtooth', 0.04);
      // Steam hiss: high bandpassed noise
      _ambientNoise(6, 'bandpass', 6000, 3, 0.012);
      // Metal clanking: periodic sharp transients
      _ambientPeriodicShot(2500, 2000, function (now) {
        var osc = ctx.createOscillator();
        osc.type = 'square'; osc.frequency.value = 1800 + Math.random() * 600;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(g); g.connect(masterGain);
        osc.start(now); osc.stop(now + 0.07);
      });

    } else if (theme === 'coastal') {
      // ── Coastal ────────────────────────────────────────
      // Ocean waves: filtered noise with slow amplitude LFO
      var waveSrc = createNoise(10);
      waveSrc.loop = true;
      var waveFilter = ctx.createBiquadFilter();
      waveFilter.type = 'lowpass'; waveFilter.frequency.value = 500;
      var waveLfo = ctx.createOscillator();
      waveLfo.type = 'sine'; waveLfo.frequency.value = 0.15;
      var waveAmp = ctx.createGain(); waveAmp.gain.value = 0.06;
      waveLfo.connect(waveAmp.gain);
      var waveVol = ctx.createGain(); waveVol.gain.value = 0.08;
      waveSrc.connect(waveFilter); waveFilter.connect(waveAmp);
      waveAmp.connect(waveVol); waveVol.connect(masterGain);
      waveSrc.start ? void 0 : waveSrc.start(); // already started by createNoise
      waveLfo.start();
      _ambientSources.push(waveSrc, waveLfo);
      _ambientNodes.push(waveVol, waveAmp, waveFilter);
      // Seagulls: high sine chirps, intermittent
      _ambientTone(2800, 'sine', 0.3, 0.008);
      // Wind is already in base layer, boost it slightly for coast
      _ambientNoise(8, 'bandpass', 350, 0.5, 0.02);

    } else if (theme === 'wasteland') {
      // ── Wasteland ──────────────────────────────────────
      // Low ominous drone
      _ambientOsc(42, 'sine', 0.05);
      // Eerie detuned wind: narrow bandpass noise
      _ambientNoise(8, 'bandpass', 800, 4, 0.02);
      // Geiger crackle: rapid tiny clicks via high-freq LFO-gated noise
      _ambientPeriodicShot(200, 300, function (now) {
        if (Math.random() > 0.3) return; // sparse crackle
        var osc = ctx.createOscillator();
        osc.type = 'square'; osc.frequency.value = 8000 + Math.random() * 4000;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.03, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
        osc.connect(g); g.connect(masterGain);
        osc.start(now); osc.stop(now + 0.01);
      });

    } else if (theme === 'cityscape') {
      // ── Cityscape ──────────────────────────────────────
      // Distant siren: sine sweep oscillating slowly
      var sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      var sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'sine'; sirenLfo.frequency.value = 0.5;
      var sirenLfoGain = ctx.createGain(); sirenLfoGain.gain.value = 200;
      sirenLfo.connect(sirenLfoGain);
      sirenLfoGain.connect(sirenOsc.frequency);
      sirenOsc.frequency.value = 700;
      var sirenVol = ctx.createGain(); sirenVol.gain.value = 0.012;
      sirenOsc.connect(sirenVol); sirenVol.connect(masterGain);
      sirenOsc.start(); sirenLfo.start();
      _ambientSources.push(sirenOsc, sirenLfo);
      _ambientNodes.push(sirenVol, sirenLfoGain);
      // Wind through buildings: bandpassed with resonance
      _ambientNoise(8, 'bandpass', 600, 6, 0.018);
      // Distant gunfire echoes: periodic muffled cracks
      _ambientPeriodicShot(3000, 4000, function (now) {
        var n = createNoise(0.08);
        var f = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.04, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        n.connect(f); f.connect(g); g.connect(masterGain);
      });

    } else if (theme === 'desert') {
      // ── Desert ─────────────────────────────────────────
      // Hot wind: higher-pitched bandpassed noise, slow swell
      var desertSrc = createNoise(10);
      desertSrc.loop = true;
      var desertFilter = ctx.createBiquadFilter();
      desertFilter.type = 'bandpass'; desertFilter.frequency.value = 500;
      desertFilter.Q.value = 1.2;
      var desertLfo = ctx.createOscillator();
      desertLfo.type = 'sine'; desertLfo.frequency.value = 0.08;
      var desertAmp = ctx.createGain(); desertAmp.gain.value = 0.04;
      desertLfo.connect(desertAmp.gain);
      var desertVol = ctx.createGain(); desertVol.gain.value = 0.06;
      desertSrc.connect(desertFilter); desertFilter.connect(desertAmp);
      desertAmp.connect(desertVol); desertVol.connect(masterGain);
      desertLfo.start();
      _ambientSources.push(desertSrc, desertLfo);
      _ambientNodes.push(desertVol, desertAmp, desertFilter);
      // Sand rustling: very high filtered noise, faint
      _ambientNoise(4, 'highpass', 4000, 1, 0.010);
    }
    // Unknown themes get base wind only — silent fallback
  }

  function playWaveStart() {
    if (!enabled || !ctx) return;
    resume();
    const now = ctx.currentTime;
    // Alarm/siren sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.3);
    osc.frequency.linearRampToValueAtTime(600, now + 0.6);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.setValueAtTime(0.15, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  // ── Noise generator helper (pooled buffers) ──────────────────
  var _noisePool = {};
  function _getNoiseBuffer(duration) {
    // Round to nearest 0.01 to maximize cache hits
    var key = Math.round(duration * 100);
    if (!_noisePool[key]) {
      var bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      _noisePool[key] = buffer;
    }
    return _noisePool[key];
  }
  function createNoise(duration) {
    var source = ctx.createBufferSource();
    source.buffer = _getNoiseBuffer(duration);
    source.start();
    return source;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = volume;
  }

  // ── Background Music System (procedural) ──────────────
  let _musicPlaying = false;
  let _musicNodes = [];
  let _musicGain = null;
  let _musicVolume = 0.18;
  let _musicBeatInterval = null;

  function playMusic(style) {
    // style: 'battle', 'ambient', 'victory'
    if (!enabled || !ctx) return;
    stopMusic();
    resume();

    _musicGain = ctx.createGain();
    _musicGain.gain.value = _musicVolume;
    _musicGain.connect(masterGain);
    _musicPlaying = true;

    if (style === 'battle' || !style) {
      // Procedural war drums + bass pulse
      var bpm = 110;
      var beatTime = 60 / bpm;
      var beat = 0;

      _musicBeatInterval = setInterval(function () {
        if (!enabled || !ctx || !_musicPlaying) return;
        var now = ctx.currentTime;

        // Kick drum (low thump)
        if (beat % 4 === 0) {
          var kickOsc = ctx.createOscillator();
          var kickGain = ctx.createGain();
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(120, now);
          kickOsc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
          kickGain.gain.setValueAtTime(0.5, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          kickOsc.connect(kickGain);
          kickGain.connect(_musicGain);
          kickOsc.start(now);
          kickOsc.stop(now + 0.2);
        }

        // Snare hit (noise burst)
        if (beat % 4 === 2) {
          var snareNoise = createNoise(0.08);
          var snareGain = ctx.createGain();
          var snareFilter = ctx.createBiquadFilter();
          snareFilter.type = 'highpass';
          snareFilter.frequency.value = 2000;
          snareGain.gain.setValueAtTime(0.25, now);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          snareNoise.connect(snareFilter);
          snareFilter.connect(snareGain);
          snareGain.connect(_musicGain);
        }

        // Hi-hat (fast noise tick)
        var hhNoise = createNoise(0.02);
        var hhGain = ctx.createGain();
        var hhFilter = ctx.createBiquadFilter();
        hhFilter.type = 'highpass';
        hhFilter.frequency.value = 6000;
        hhGain.gain.setValueAtTime(beat % 2 === 0 ? 0.12 : 0.06, now);
        hhGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        hhNoise.connect(hhFilter);
        hhFilter.connect(hhGain);
        hhGain.connect(_musicGain);

        // Bass line (low drone pulse every 8 beats)
        if (beat % 8 === 0) {
          var bassOsc = ctx.createOscillator();
          var bassGain = ctx.createGain();
          bassOsc.type = 'sawtooth';
          var bassNotes = [55, 65, 55, 73]; // Am pentatonic bass
          bassOsc.frequency.value = bassNotes[Math.floor(beat / 8) % bassNotes.length];
          bassGain.gain.setValueAtTime(0.15, now);
          bassGain.gain.exponentialRampToValueAtTime(0.001, now + beatTime * 3);
          var bassFilter = ctx.createBiquadFilter();
          bassFilter.type = 'lowpass';
          bassFilter.frequency.value = 200;
          bassOsc.connect(bassFilter);
          bassFilter.connect(bassGain);
          bassGain.connect(_musicGain);
          bassOsc.start(now);
          bassOsc.stop(now + beatTime * 4);
        }

        beat++;
      }, beatTime * 1000);

    } else if (style === 'ambient') {
      // Soft ambient pad
      var padOsc = ctx.createOscillator();
      var padOsc2 = ctx.createOscillator();
      var padGain = ctx.createGain();
      var padFilter = ctx.createBiquadFilter();
      padOsc.type = 'sine';
      padOsc2.type = 'sine';
      padOsc.frequency.value = 220;
      padOsc2.frequency.value = 330;
      padGain.gain.value = 0.06;
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 600;
      padOsc.connect(padFilter);
      padOsc2.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(_musicGain);
      padOsc.start();
      padOsc2.start();
      _musicNodes.push(padOsc, padOsc2);

    } else if (style === 'victory') {
      // Triumphant fanfare
      var now = ctx.currentTime;
      var notes = [440, 554, 659, 880];
      notes.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, now + i * 0.3);
        g.gain.linearRampToValueAtTime(0.15, now + i * 0.3 + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.3 + 0.8);
        osc.connect(g);
        g.connect(_musicGain);
        osc.start(now + i * 0.3);
        osc.stop(now + i * 0.3 + 0.8);
      });
    }
  }

  function setMusicIntensity(intensity) {
    // intensity: 0.0 (calm) to 1.0 (maximum combat)
    if (!_musicPlaying || !_musicGain) return;
    // Scale music volume: base volume at 0 intensity, 2x at full
    var targetVol = _musicVolume * (0.5 + intensity * 1.5);
    _musicGain.gain.value = Math.min(1.0, targetVol);
  }

  function stopMusic() {
    _musicPlaying = false;
    if (_musicBeatInterval) {
      clearInterval(_musicBeatInterval);
      _musicBeatInterval = null;
    }
    _musicNodes.forEach(function (n) {
      try { n.stop(); } catch (e) { /* already stopped */ }
    });
    _musicNodes = [];
    if (_musicGain) {
      try { _musicGain.disconnect(); } catch (e) { /* ok */ }
      _musicGain = null;
    }
  }

  function setMusicVolume(v) {
    _musicVolume = Math.max(0, Math.min(1, v));
    if (_musicGain) _musicGain.gain.value = _musicVolume;
  }

  function isMusicPlaying() { return _musicPlaying; }

  /* ── New Audio Features (B21) ──────────────────────────── */

  // Enemy bark / shout SFX
  function playEnemyBark(npcId, bark) {
    if (!enabled || !ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 120 + Math.random() * 60;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(g); g.connect(masterGain);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  }

  // Headshot ding 
  function playHeadshotDing() {
    if (!enabled || !ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(g); g.connect(masterGain);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  }

  // Level complete jingle
  function playLevelComplete() {
    if (!enabled || !ctx) return;
    var now = ctx.currentTime;
    var notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach(function(freq, i) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now + i * 0.15);
      g.gain.linearRampToValueAtTime(0.12, now + i * 0.15 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
      osc.connect(g); g.connect(masterGain);
      osc.start(now + i * 0.15); osc.stop(now + i * 0.15 + 0.4);
    });
  }

  // Grenade bounce sound
  function playGrenadeBounce() {
    if (!enabled || !ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(g); g.connect(masterGain);
    osc.start(); osc.stop(ctx.currentTime + 0.08);
  }

  // Tank cannon fire (deep boom)
  function playTankCannon() {
    if (!enabled || !ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(g); g.connect(masterGain);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
    // layered noise burst
    var buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    var noise = ctx.createBufferSource();
    noise.buffer = buf;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.2, ctx.currentTime);
    ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    noise.connect(ng); ng.connect(masterGain);
    noise.start(); noise.stop(ctx.currentTime + 0.3);
  }

  // Knife throw whoosh
  function playKnifeThrow() {
    if (!enabled || !ctx) return;
    var buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / data.length);
    var noise = ctx.createBufferSource();
    noise.buffer = buf;
    var g = ctx.createGain();
    var filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 2000;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    noise.connect(filt); filt.connect(g); g.connect(masterGain);
    noise.start(); noise.stop(ctx.currentTime + 0.15);
  }

  // Fire crackle ambient
  let _fireCrackle = null;
  function startFireCrackle() {
    if (!enabled || !ctx || _fireCrackle) return;
    // Looping noise with bandpass = crackle
    var buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.92 ? 0.5 : 0.05);
    }
    var noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    var filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 3000;
    filt.Q.value = 2;
    var g = ctx.createGain();
    g.gain.value = 0.04;
    noise.connect(filt); filt.connect(g); g.connect(masterGain);
    noise.start();
    _fireCrackle = { source: noise, gain: g };
  }

  function stopFireCrackle() {
    if (_fireCrackle) {
      try { _fireCrackle.source.stop(); } catch(e) {}
      _fireCrackle = null;
    }
  }

  // Radiation geiger tick
  function playGeigerTick() {
    if (!enabled || !ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 4000 + Math.random() * 2000;
    g.gain.setValueAtTime(0.03, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
    osc.connect(g); g.connect(masterGain);
    osc.start(); osc.stop(ctx.currentTime + 0.02);
  }

  function toggle() {
    enabled = !enabled;
    return enabled;
  }

  // ── New Sound Functions ───────────────────────────────────

  function playVehicleEngine(type) {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sawtooth';
    var params = {
      idle:   { freq: 50, vol: 0.06, dur: 0.3 },
      moving: { freq: 65, vol: 0.10, dur: 0.2 },
      boost:  { freq: 80, vol: 0.14, dur: 0.15 },
    }[type] || { freq: 50, vol: 0.06, dur: 0.3 };
    osc.frequency.setValueAtTime(params.freq, now);
    osc.frequency.linearRampToValueAtTime(params.freq * 1.2, now + params.dur);
    gain.gain.setValueAtTime(params.vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + params.dur);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + params.dur + 0.01);
  }

  function playGrappleHook() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  function playWallRun() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var noise = createNoise(0.1);
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 3;
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
  }

  function playAchievementUnlock() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now + i * 0.12);
      g.gain.linearRampToValueAtTime(0.14, now + i * 0.12 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.5);
      // Reverb delay echo
      var echo = ctx.createOscillator();
      var eg = ctx.createGain();
      echo.type = 'triangle';
      echo.frequency.value = freq;
      eg.gain.setValueAtTime(0, now + i * 0.12 + 0.15);
      eg.gain.linearRampToValueAtTime(0.04, now + i * 0.12 + 0.19);
      eg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);
      echo.connect(eg);
      eg.connect(masterGain);
      echo.start(now + i * 0.12 + 0.15);
      echo.stop(now + i * 0.12 + 0.6);
    });
  }

  function playLevelUp() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  function playRollDodge() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var noise = createNoise(0.2);
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
  }

  function playCriticalHit() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 100;
    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
    var noise = createNoise(0.15);
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.15, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(ng);
    ng.connect(masterGain);
  }

  function playEnemyAlert() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    for (var i = 0; i < 2; i++) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 600;
      var t = now + i * 0.15;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  function playBountyComplete() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    for (var i = 0; i < 6; i++) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 2000 + Math.random() * 2000;
      var t = now + i * 0.06;
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  function playFortificationBuild() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var noise = createNoise(0.2);
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.connect(ng);
    ng.connect(masterGain);
    var osc = ctx.createOscillator();
    var og = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 100;
    og.gain.setValueAtTime(0.15, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(og);
    og.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  // ── Weapon switch click — sharp metallic tick ──
  function playWeaponSwitch() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.03);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // ── Dry fire click — empty chamber ──
  function playDryFire() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.02);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  // ── Kill confirm chime — short rising tone on every kill ──
  function playKillConfirm() {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.07);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // ── Multi-kill chord burst — escalating layers for 2+ rapid kills ──
  function playMultiKill(count) {
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    var baseFreq = 600 + Math.min(count, 6) * 100;
    // Layer 1: base tone
    var osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = baseFreq;
    var g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.08, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(g1); g1.connect(masterGain);
    osc1.start(now); osc1.stop(now + 0.16);
    // Layer 2: major third above
    var osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = baseFreq * 1.25;
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.06, now + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc2.connect(g2); g2.connect(masterGain);
    osc2.start(now); osc2.stop(now + 0.16);
    // Layer 3: fifth above (only for 3+ kills)
    if (count >= 3) {
      var osc3 = ctx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.value = baseFreq * 1.5;
      var g3 = ctx.createGain();
      g3.gain.setValueAtTime(0.05, now + 0.03);
      g3.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc3.connect(g3); g3.connect(masterGain);
      osc3.start(now); osc3.stop(now + 0.16);
    }
  }

  // ── First blood — deep powerful confirm on first kill of session ──
  var _firstBloodPlayed = false;
  function playFirstBlood() {
    if (!enabled || !ctx || _firstBloodPlayed) return;
    _firstBloodPlayed = true;
    resume();
    var now = ctx.currentTime;
    // Low power tone
    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    osc.connect(filter); filter.connect(g); g.connect(masterGain);
    osc.start(now); osc.stop(now + 0.31);
    // Bright harmonic on top
    var osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(800, now + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.15);
    var g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.08, now + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(g2); g2.connect(masterGain);
    osc2.start(now); osc2.stop(now + 0.26);
  }
  function resetFirstBlood() { _firstBloodPlayed = false; }

  /* ── Heartbeat effect for low HP ───── */
  var _heartbeatTimer = 0;
  function playHeartbeat(intensity) {
    // intensity: 0-1 (0 = barely low, 1 = near death)
    if (!enabled || !ctx) return;
    resume();
    var now = ctx.currentTime;
    // BPM: 80 at intensity 0, 160 at intensity 1
    var interval = 60 / (80 + intensity * 80);
    if ((now - _heartbeatTimer) < interval) return;
    _heartbeatTimer = now;
    var vol = 0.06 + intensity * 0.12;
    // Two-thump heartbeat: lub...dub
    for (var i = 0; i < 2; i++) {
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55 - i * 10, now + i * 0.12);
      g.gain.setValueAtTime(vol, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.08);
      osc.connect(g); g.connect(masterGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.09);
    }
  }

  return {
    init: init,
    resume: resume,
    playGunshot: playGunshot,
    playSpatialGunshot: playSpatialGunshot,
    playExplosion: playExplosion,
    playHit: playHit,
    playReload: playReload,
    playPickup: playPickup,
    playDeath: playDeath,
    playFootstep: playFootstep,
    playEnemyFootstep: playEnemyFootstep,
    startEngine: startEngine,
    updateEngine: updateEngine,
    stopEngine: stopEngine,
    playAmbientWind: playAmbientWind,
    startAmbientLoop: startAmbientLoop,
    stopAmbientLoop: stopAmbientLoop,
    playWaveStart: playWaveStart,
    playMusic: playMusic,
    stopMusic: stopMusic,
    setMusicVolume: setMusicVolume,
    setMusicIntensity: setMusicIntensity,
    playFlashbang: playFlashbang,
    playRicochet: playRicochet,
    startDroneMotor: startDroneMotor,
    updateDroneMotor: updateDroneMotor,
    stopDroneMotor: stopDroneMotor,
    isMusicPlaying: isMusicPlaying,
    setVolume: setVolume,
    toggle: toggle,
    isEnabled: function () { return enabled; },
    // B21: New audio
    playEnemyBark: playEnemyBark,
    playBark: playEnemyBark,
    playHeadshotDing: playHeadshotDing,
    playLevelComplete: playLevelComplete,
    playGrenadeBounce: playGrenadeBounce,
    playTankCannon: playTankCannon,
    playKnifeThrow: playKnifeThrow,
    startFireCrackle: startFireCrackle,
    stopFireCrackle: stopFireCrackle,
    playGeigerTick: playGeigerTick,
    // New sounds
    playVehicleEngine: playVehicleEngine,
    playGrappleHook: playGrappleHook,
    playWallRun: playWallRun,
    playAchievementUnlock: playAchievementUnlock,
    playLevelUp: playLevelUp,
    playRollDodge: playRollDodge,
    playCriticalHit: playCriticalHit,
    playEnemyAlert: playEnemyAlert,
    playBountyComplete: playBountyComplete,
    playFortificationBuild: playFortificationBuild,
    playWeaponSwitch: playWeaponSwitch,
    playDryFire: playDryFire,
    playKillConfirm: playKillConfirm,
    playMultiKill: playMultiKill,
    playFirstBlood: playFirstBlood,
    resetFirstBlood: resetFirstBlood,
    playHeartbeat: playHeartbeat,
    playLandingThud: playLandingThud,
    playBulletSnap: playBulletSnap,
  };
})();
