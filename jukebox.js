/* ───────────────────────────────────────────────────────────────────────
   JUKEBOX — Procedural Ukrainian rap / drill tracks
   ─────────────────────────────────────────────────────────────────────── */
window.Jukebox = (function () {
  'use strict';

  // ── Ukrainian folk-scale fragments ────────────────────────────────────
  // Notes are MIDI numbers. Phrygian-dominant + harmonic minor are the
  // backbone of Ukrainian rap / drill (Alyona Alyona, Ярмак, alyona alyona,
  // KALUSH ORCHESTRA, OTOY, Skofka).
  const SCALES = {
    // A Phrygian-dominant — classic Ukrainian/Eastern fire
    phrygDom: [57, 58, 61, 62, 64, 65, 68, 69, 70, 73, 74],
    // D harmonic minor — KALUSH "Stefania" feel
    harmMin:  [50, 52, 53, 55, 57, 58, 61, 62, 64, 65, 67, 69, 70],
    // E Dorian — drill bounce
    dorian:   [52, 54, 55, 57, 59, 61, 62, 64, 66, 67, 69, 71],
    // C minor pentatonic — straight rap
    minPent:  [48, 51, 53, 55, 58, 60, 63, 65, 67, 70],
  };

  // ── Track catalog ─────────────────────────────────────────────────────
  // Each track: title (with Ukrainian flair), BPM, scale, pattern.
  // Patterns are procedurally generated each tick from the scale + a
  // rhythmic seed so two listens of the same track are *similar* but not
  // identical — like a real DJ set / cypher.
  const TRACKS = [
    { id: 'STEFANIA',  title: 'Stefania (Battle Cypher)',     artist: 'Procedural · KALUSH-style',   bpm: 90,  scale: 'harmMin',  vibe: 'anthem', flag: true },
    { id: 'PUTIN_HUYLO', title: 'Putin Khuylo!',               artist: 'Procedural · Football chant', bpm: 120, scale: 'phrygDom', vibe: 'chant',  flag: true },
    { id: 'BAYRAKTAR', title: 'Bayraktar Drill',                artist: 'Procedural · Trap',           bpm: 140, scale: 'phrygDom', vibe: 'drill',  flag: false },
    { id: 'CHERVONA',  title: 'Червона Калина (Red Viburnum)', artist: 'Procedural · Patriotic',      bpm: 78,  scale: 'harmMin',  vibe: 'anthem', flag: true },
    { id: 'KOZAK',     title: 'Kozak Rap',                      artist: 'Procedural · Boom-bap',       bpm: 95,  scale: 'minPent',  vibe: 'boom',   flag: false },
    { id: 'GHOST',     title: 'Ghost of Kyiv',                  artist: 'Procedural · Phonk',          bpm: 130, scale: 'phrygDom', vibe: 'phonk',  flag: false },
    { id: 'AZOV',      title: 'Steel of Azovstal',              artist: 'Procedural · Industrial',     bpm: 110, scale: 'dorian',   vibe: 'industrial', flag: false },
    { id: 'HIMARS',    title: 'HIMARS Anthem',                  artist: 'Procedural · Hyperpop',       bpm: 150, scale: 'phrygDom', vibe: 'hyper',  flag: false },
  ];

  let _ctx = null, _master = null, _tickInterval = null;
  let _currentIdx = 0, _playing = false, _volume = 0.35, _muted = false;
  let _beat = 0;

  function _ensureCtx() {
    if (_ctx) return _ctx;
    if (typeof AudioSystem !== 'undefined' && AudioSystem.resume) AudioSystem.resume();
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _master = _ctx.createGain();
      _master.gain.value = _volume;
      _master.connect(_ctx.destination);
    } catch (e) { return null; }
    return _ctx;
  }

  function _midiToHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function _noise(durSec) {
    const len = Math.floor(_ctx.sampleRate * durSec);
    const buf = _ctx.createBuffer(1, len, _ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() - 0.5) * 2;
    const src = _ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  // ── Drum kit ─────────────────────────────────────────────────────────
  function _kick(now, vel) {
    vel = vel == null ? 1 : vel;
    const o = _ctx.createOscillator(); const g = _ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, now);
    o.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    g.gain.setValueAtTime(0.7 * vel, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    o.connect(g); g.connect(_master);
    o.start(now); o.stop(now + 0.25);
  }
  function _snare(now, vel) {
    vel = vel == null ? 1 : vel;
    const n = _noise(0.15); const f = _ctx.createBiquadFilter(); const g = _ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 1800;
    g.gain.setValueAtTime(0.35 * vel, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    n.connect(f); f.connect(g); g.connect(_master);
    n.start(now);
  }
  function _hat(now, vel, open) {
    vel = vel == null ? 0.6 : vel;
    const n = _noise(open ? 0.18 : 0.04);
    const f = _ctx.createBiquadFilter(); const g = _ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(0.18 * vel, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (open ? 0.16 : 0.035));
    n.connect(f); f.connect(g); g.connect(_master);
    n.start(now);
  }
  function _clap(now) {
    for (let i = 0; i < 3; i++) {
      const n = _noise(0.05); const f = _ctx.createBiquadFilter(); const g = _ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.5;
      g.gain.setValueAtTime(0.25, now + i * 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.012 + 0.06);
      n.connect(f); f.connect(g); g.connect(_master);
      n.start(now + i * 0.012);
    }
  }
  function _808(now, midi, durSec) {
    const o = _ctx.createOscillator(); const g = _ctx.createGain();
    const f = _ctx.createBiquadFilter();
    o.type = 'sine';
    o.frequency.setValueAtTime(_midiToHz(midi - 12), now);
    o.frequency.exponentialRampToValueAtTime(_midiToHz(midi - 12) * 0.5, now + durSec);
    f.type = 'lowpass'; f.frequency.value = 200;
    g.gain.setValueAtTime(0.55, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + durSec);
    o.connect(f); f.connect(g); g.connect(_master);
    o.start(now); o.stop(now + durSec + 0.05);
  }

  // ── Lead synth (vocal chop / saw stab) ───────────────────────────────
  function _stab(now, midi, durSec, type) {
    type = type || 'sawtooth';
    const o1 = _ctx.createOscillator(), o2 = _ctx.createOscillator();
    const g = _ctx.createGain(); const f = _ctx.createBiquadFilter();
    o1.type = type; o2.type = type;
    o1.frequency.value = _midiToHz(midi);
    o2.frequency.value = _midiToHz(midi) * 1.005; // detune
    f.type = 'lowpass'; f.frequency.setValueAtTime(2400, now);
    f.frequency.exponentialRampToValueAtTime(800, now + durSec);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.20, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + durSec);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(_master);
    o1.start(now); o2.start(now); o1.stop(now + durSec + 0.05); o2.stop(now + durSec + 0.05);
  }

  // ── Pad / pluck (folk-string feel) ───────────────────────────────────
  function _pluck(now, midi, durSec) {
    const o = _ctx.createOscillator(); const g = _ctx.createGain();
    const f = _ctx.createBiquadFilter();
    o.type = 'triangle';
    o.frequency.value = _midiToHz(midi);
    f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 4;
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + durSec);
    o.connect(f); f.connect(g); g.connect(_master);
    o.start(now); o.stop(now + durSec + 0.05);
  }

  // ── Track tick scheduler ─────────────────────────────────────────────
  function _tick() {
    if (!_playing || !_ctx || _muted) return;
    const trk = TRACKS[_currentIdx];
    const scale = SCALES[trk.scale];
    const beatTime = 60 / trk.bpm;
    const now = _ctx.currentTime + 0.03;
    const b = _beat % 16;     // 16th-note grid
    const bar = Math.floor(_beat / 16) % 4;

    // ── Drums ──
    // Kick on 1 + variable second hit
    if (b === 0 || b === 6 || (b === 10 && trk.vibe === 'drill')) _kick(now, b === 0 ? 1 : 0.7);
    // Snare/clap on 2 and 4
    if (b === 4 || b === 12) {
      if (trk.vibe === 'phonk' || trk.vibe === 'drill') _clap(now);
      else _snare(now, 0.85);
    }
    // Hi-hats: 8th notes, with 16th rolls in drill/hyperpop
    if (trk.vibe === 'drill' || trk.vibe === 'hyper') {
      _hat(now, b % 4 === 0 ? 0.6 : 0.4, false);
      if (bar === 3 && b >= 12) _hat(now + beatTime / 4, 0.5, false); // 16th roll in last bar
    } else if (b % 2 === 0) {
      _hat(now, b === 0 ? 0.5 : 0.35, b === 14);
    }

    // ── 808 / sub-bass — every 4 beats, walking through scale ──
    if (b === 0 || b === 8) {
      const root = scale[0] - 12;
      const walk = [0, -2, 3, 5];
      _808(now, root + walk[bar], beatTime * 2);
    }

    // ── Lead stabs / pluck melody — every 2nd 16th, scale walk ──
    const seed = (_beat * 9301 + 49297) % 233280;
    const noteIdx = Math.floor((seed / 233280) * scale.length);
    const note = scale[noteIdx];

    if (trk.vibe === 'anthem' || trk.vibe === 'boom') {
      // Folk-pluck pattern: bandura-style picked notes
      if (b % 2 === 0) _pluck(now, note + 12, beatTime * 0.45);
      if (b === 6 || b === 14) _pluck(now, note + 19, beatTime * 0.35);
    } else if (trk.vibe === 'drill' || trk.vibe === 'phonk') {
      // Drill: dark detuned saw stabs, sparse
      if (b === 0 || b === 7 || b === 10) _stab(now, note, beatTime * 0.9, 'sawtooth');
    } else if (trk.vibe === 'hyper') {
      // Hyperpop: every 16th, square wave, octave jumps
      _stab(now, note + (b % 4 === 0 ? 12 : 0), beatTime * 0.4, 'square');
    } else if (trk.vibe === 'industrial') {
      // Industrial: distorted saws on downbeats only
      if (b === 0 || b === 4 || b === 8 || b === 12) _stab(now, note, beatTime * 1.1, 'sawtooth');
    } else if (trk.vibe === 'chant') {
      // Football-chant: simple repeating motif on 1 and 3
      if (b === 0) _stab(now, scale[0], beatTime * 0.9, 'square');
      if (b === 4) _stab(now, scale[2], beatTime * 0.9, 'square');
      if (b === 8) _stab(now, scale[4], beatTime * 0.9, 'square');
      if (b === 12) _stab(now, scale[2], beatTime * 0.9, 'square');
    }

    _beat++;
  }

  // ── Public API ────────────────────────────────────────────────────────
  function play(idx) {
    if (typeof idx === 'number') _currentIdx = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
    if (!_ensureCtx()) return false;
    if (_ctx.state === 'suspended') _ctx.resume();
    stop();
    _playing = true;
    _beat = 0;
    const trk = TRACKS[_currentIdx];
    const tickMs = 1000 * (60 / trk.bpm) / 4;     // 16th-note grid
    _tickInterval = setInterval(_tick, tickMs);
    _emit();
    return true;
  }
  function stop() {
    _playing = false;
    if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; }
    _emit();
  }
  function next() { return play(_currentIdx + 1); }
  function prev() { return play(_currentIdx - 1); }
  function toggle() { return _playing ? (stop(), false) : play(_currentIdx); }
  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (_master) _master.gain.value = _muted ? 0 : _volume;
  }
  function mute(on) {
    _muted = !!on;
    if (_master) _master.gain.value = _muted ? 0 : _volume;
  }
  function isPlaying() { return _playing; }
  function getCurrent() { return TRACKS[_currentIdx]; }
  function getTracks() { return TRACKS.slice(); }
  function getVolume() { return _volume; }

  // ── Event bus for UI ──
  const _listeners = [];
  function onChange(cb) { if (typeof cb === 'function') _listeners.push(cb); }
  function _emit() { for (let i = 0; i < _listeners.length; i++) try { _listeners[i](); } catch (e) {} }

  return {
    play, stop, next, prev, toggle, setVolume, getVolume, mute,
    isPlaying, getCurrent, getTracks, onChange,
  };
})();
