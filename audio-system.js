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
      pistol:  { freq: 800, decay: 0.06, noiseVol: 0.4, filterFreq: 3000 },
      rifle:   { freq: 400, decay: 0.10, noiseVol: 0.6, filterFreq: 2000 },
      sniper:  { freq: 200, decay: 0.15, noiseVol: 0.8, filterFreq: 1500 },
      hmg:     { freq: 300, decay: 0.08, noiseVol: 0.7, filterFreq: 1800 },
      launcher:{ freq: 150, decay: 0.25, noiseVol: 0.9, filterFreq: 800 },
      melee:   { freq: 600, decay: 0.05, noiseVol: 0.3, filterFreq: 4000 },
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

  // ── Noise generator helper ──────────────────────────────
  function createNoise(duration) {
    var bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.start();
    return source;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = volume;
  }

  function toggle() {
    enabled = !enabled;
    return enabled;
  }

  return {
    init: init,
    resume: resume,
    playGunshot: playGunshot,
    playExplosion: playExplosion,
    playHit: playHit,
    playReload: playReload,
    playPickup: playPickup,
    playDeath: playDeath,
    playFootstep: playFootstep,
    playAmbientWind: playAmbientWind,
    playWaveStart: playWaveStart,
    setVolume: setVolume,
    toggle: toggle,
    isEnabled: function () { return enabled; },
  };
})();
