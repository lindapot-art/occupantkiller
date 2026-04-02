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
    playMusic: playMusic,
    stopMusic: stopMusic,
    setMusicVolume: setMusicVolume,
    setMusicIntensity: setMusicIntensity,
    playFlashbang: playFlashbang,
    isMusicPlaying: isMusicPlaying,
    setVolume: setVolume,
    toggle: toggle,
    isEnabled: function () { return enabled; },
  };
})();
