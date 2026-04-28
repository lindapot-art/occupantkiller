// ============================================================
//  gyro.js — Mobile gyroscope aim assist
//  Uses DeviceOrientationEvent: tilt phone to nudge camera yaw/pitch.
//  Only active when running mobile fullscreen.  Toggleable from settings.
//  Public API: init(camera), update(dt), clear(), enable(), disable(), isEnabled()
// ============================================================
window.Gyro = (function () {
  'use strict';

  var LS_KEY = 'okc_gyro_v1';
  let _camera = null;
  let _enabled = false;
  let _yawRate = 0;       // rad/sec from gamma
  let _pitchRate = 0;     // rad/sec from beta
  let _calibBeta = null;  // resting tilt (portrait/landscape)
  let _calibGamma = null;
  var _SENSITIVITY = 1.4;  // scale of effective rotation rate

  function _isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function _onOrient(ev) {
    if (!_enabled || !_camera) return;
    var beta = ev.beta;   // -180..180 (front/back tilt)
    var gamma = ev.gamma; // -90..90 (left/right tilt)
    if (beta == null || gamma == null) return;
    if (_calibBeta == null) { _calibBeta = beta; _calibGamma = gamma; return; }
    var dGamma = (gamma - _calibGamma);   // left/right
    var dBeta  = (beta  - _calibBeta);    // up/down
    // Dead zone
    if (Math.abs(dGamma) < 3) dGamma = 0;
    if (Math.abs(dBeta)  < 3) dBeta  = 0;
    // Map to rotation rates (rad/sec); landscape: gamma = yaw, beta = pitch
    _yawRate   = -dGamma * 0.012 * _SENSITIVITY;
    _pitchRate = -dBeta  * 0.010 * _SENSITIVITY;
  }

  function enable() {
    if (_enabled) return;
    // iOS 13+ requires permission request on user gesture
    var ask = (typeof DeviceOrientationEvent !== 'undefined' &&
               typeof DeviceOrientationEvent.requestPermission === 'function');
    if (ask) {
      try {
        DeviceOrientationEvent.requestPermission().then(function (state) {
          if (state === 'granted') _attach();
          else { _enabled = false; }
        }).catch(function () {});
      } catch (e) {}
    } else {
      _attach();
    }
    try { localStorage.setItem(LS_KEY, '1'); } catch (e) {}
  }
  function _attach() {
    _enabled = true;
    _calibBeta = null; _calibGamma = null;
    window.addEventListener('deviceorientation', _onOrient, true);
    try {
      if (window.HUD && window.HUD.showToast) window.HUD.showToast('🎮 Gyro aim ON', 1500, '#00ffaa');
    } catch (e) {}
  }
  function disable() {
    _enabled = false;
    _yawRate = 0; _pitchRate = 0;
    window.removeEventListener('deviceorientation', _onOrient, true);
    try { localStorage.setItem(LS_KEY, '0'); } catch (e) {}
  }
  function isEnabled() { return _enabled; }
  function toggle() { if (_enabled) disable(); else enable(); }
  function recalibrate() { _calibBeta = null; _calibGamma = null; }

  function init(camera) {
    _camera = camera;
    if (!_isMobile()) return;
    var pref = null;
    try { pref = localStorage.getItem(LS_KEY); } catch (e) {}
    // Only auto-enable if user previously opted in (avoids surprise permission prompt)
    if (pref === '1') enable();
  }

  function update(dt) {
    if (!_enabled || !_camera) return;
    if (Math.abs(_yawRate) < 1e-5 && Math.abs(_pitchRate) < 1e-5) return;
    // Try PointerLockControls path first (camera is rotated by controls.yawObject/pitchObject if any)
    var rotated = false;
    try {
      if (window.GameManager && window.GameManager.getControls) {
        var c = window.GameManager.getControls();
        if (c && c.getObject) {
          var yawObj = c.getObject();
          yawObj.rotation.y += _yawRate * dt;
          rotated = true;
        }
      }
    } catch (e) {}
    if (!rotated) {
      _camera.rotation.y += _yawRate * dt;
      _camera.rotation.x = Math.max(-Math.PI / 2 + 0.05,
                                    Math.min(Math.PI / 2 - 0.05,
                                             _camera.rotation.x + _pitchRate * dt));
    } else {
      // Pitch on the camera child
      _camera.rotation.x = Math.max(-Math.PI / 2 + 0.05,
                                    Math.min(Math.PI / 2 - 0.05,
                                             _camera.rotation.x + _pitchRate * dt));
    }
  }
  function clear() {}

  return {
    init: init, update: update, clear: clear,
    enable: enable, disable: disable, toggle: toggle,
    isEnabled: isEnabled, recalibrate: recalibrate,
  };
})();
