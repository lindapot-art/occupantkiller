/* ───────────────────────────────────────────────────────────────────────
   CAMERA SYSTEM — FPS / Third Person / Strategic (RTS) view modes
   ─────────────────────────────────────────────────────────────────────── */
const CameraSystem = (function () {
  'use strict';

  const MODE = Object.freeze({
    FIRST_PERSON:  'fps',
    THIRD_PERSON:  'tps',
    STRATEGIC:     'rts',
    DRONE:         'drone',
    VEHICLE:       'vehicle',
  });

  /* ── State ───────────────────────────────────────────────────────── */
  let currentMode   = MODE.FIRST_PERSON;
  let _camera       = null;
  let _playerObj    = null;  // object the camera follows
  let yaw           = 0;
  let pitch         = 0;
  const pitchLimit  = Math.PI / 2 - 0.05;

  /* ── Third-person config ─────────────────────────────────────────── */
  let tpsDist     = 6;
  let tpsHeight   = 3;
  let tpsSmooth   = 8;
  const TPS_DIST_MIN = 2;
  const TPS_DIST_MAX = 15;

  /* ── Strategic view config ───────────────────────────────────────── */
  let rtsHeight   = 40;
  let rtsPitch    = -Math.PI / 3; // 60° down
  let rtsYaw      = 0;
  const rtsTarget = new THREE.Vector3();
  let rtsZoom     = 40;
  const RTS_ZOOM_MIN = 15;
  const RTS_ZOOM_MAX = 100;
  const RTS_PAN_SPEED = 40;

  /* ── Drone / Vehicle references ──────────────────────────────────── */
  let _droneObj   = null;
  let _vehicleObj = null;

  /* ── Head bob (FPS) ──────────────────────────────────────────────── */
  let bobPhase   = 0;
  let bobActive  = false;
  const BOB_AMP  = 0.038;
  const BOB_FREQ = 10;

  /* ── Screen Shake ───────────────────────────────────────────────── */
  let shakeIntensity = 0;
  let shakeDecay     = 0;
  let shakeOffsetX   = 0;
  let shakeOffsetY   = 0;

  /* ── Strafe Camera Roll ─────────────────────────────────────────── */
  let _strafeTilt = 0;   // current roll in radians
  let _strafeDir  = 0;   // -1/0/1 from game manager

  /* ── Damage Flinch ──────────────────────────────────────────────── */
  let _flinchYaw   = 0;
  let _flinchPitch = 0;
  let _flinchDecay = 0;

  /* ── Reusable temp objects (avoid per-frame allocation) ──────────── */
  const _tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const _tmpVec3a = new THREE.Vector3();
  const _tmpVec3b = new THREE.Vector3();
  const _tmpVec3c = new THREE.Vector3();
  const _tmpFwdDir = new THREE.Vector3();

  /* ── Init ────────────────────────────────────────────────────────── */
  function init(camera) {
    _camera = camera;
    currentMode = MODE.FIRST_PERSON;
    yaw = 0;
    pitch = 0;
    rtsTarget.set(0, 0, 0);
  }

  /* ── Mode switching ──────────────────────────────────────────────── */
  function setMode(mode) {
    if (!Object.values(MODE).includes(mode)) return;
    currentMode = mode;

    if (mode === MODE.STRATEGIC) {
      // Start RTS camera at player position
      if (_playerObj) {
        rtsTarget.copy(_playerObj.position || _camera.position);
      }
    }
  }

  function getMode() { return currentMode; }

  function cycleMode() {
    const modes = [MODE.FIRST_PERSON, MODE.THIRD_PERSON, MODE.STRATEGIC];
    const idx = modes.indexOf(currentMode);
    if (idx >= 0) {
      setMode(modes[(idx + 1) % modes.length]);
    }
  }

  /* ── Mouse input ─────────────────────────────────────────────────── */
  function handleMouseMove(dx, dy, sensitivity) {
    if (_killCamActive) return; // block mouse-look during kill cam
    sensitivity = sensitivity || 0.002;

    if (currentMode === MODE.FIRST_PERSON || currentMode === MODE.DRONE) {
      yaw   -= dx * sensitivity;
      pitch -= dy * sensitivity;
      pitch  = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
    } else if (currentMode === MODE.THIRD_PERSON) {
      yaw   -= dx * sensitivity;
      pitch -= dy * sensitivity;
      pitch  = Math.max(-1.2, Math.min(0.6, pitch));
    } else if (currentMode === MODE.STRATEGIC) {
      // right-click drag to rotate RTS camera
      rtsYaw -= dx * sensitivity * 0.5;
    }
  }

  function handleWheel(deltaY) {
    if (currentMode === MODE.THIRD_PERSON) {
      tpsDist += deltaY * 0.01;
      tpsDist = Math.max(TPS_DIST_MIN, Math.min(TPS_DIST_MAX, tpsDist));
    } else if (currentMode === MODE.STRATEGIC) {
      rtsZoom += deltaY * 0.05;
      rtsZoom = Math.max(RTS_ZOOM_MIN, Math.min(RTS_ZOOM_MAX, rtsZoom));
    }
  }

  /* ── Update per frame ────────────────────────────────────────────── */
  function update(delta, playerPos, isMoving, isGrounded) {
    if (!_camera) return;

    switch (currentMode) {
      case MODE.FIRST_PERSON:
        updateFPS(delta, playerPos, isMoving, isGrounded);
        break;
      case MODE.THIRD_PERSON:
        updateTPS(delta, playerPos);
        break;
      case MODE.STRATEGIC:
        updateRTS(delta);
        break;
      case MODE.DRONE:
        updateDrone(delta);
        break;
      case MODE.VEHICLE:
        updateVehicle(delta);
        break;
    }
  }

  /* ── Screen Shake API ─────────────────────────────────────────────── */
  function shake(intensity, duration) {
    shakeIntensity = Math.max(shakeIntensity, intensity);
    shakeDecay = duration || 0.3;
  }

  function updateShake(delta) {
    if (shakeIntensity > 0.001) {
      shakeOffsetX = (Math.random() - 0.5) * shakeIntensity;
      shakeOffsetY = (Math.random() - 0.5) * shakeIntensity;
      shakeIntensity *= Math.max(0, 1 - delta / shakeDecay);
    } else {
      shakeOffsetX = 0;
      shakeOffsetY = 0;
      shakeIntensity = 0;
    }
    // Damage flinch decay
    if (Math.abs(_flinchYaw) > 0.0005 || Math.abs(_flinchPitch) > 0.0005) {
      var fDecay = Math.min(1, delta * 12);
      _flinchYaw   *= (1 - fDecay);
      _flinchPitch *= (1 - fDecay);
    } else {
      _flinchYaw = 0;
      _flinchPitch = 0;
    }
  }

  /**
   * Directional camera flinch from damage.
   * @param {number} yawDelta  - horizontal kick (radians, + = right)
   * @param {number} pitchDelta - vertical kick (radians, + = up)
   */
  function flinch(yawDelta, pitchDelta) {
    _flinchYaw   += yawDelta;
    _flinchPitch += pitchDelta;
  }

  /* ── FPS Camera ──────────────────────────────────────────────────── */
  function updateFPS(delta, playerPos, isMoving, isGrounded) {
    updateShake(delta);

    // If we have a vehicle target (first-person vehicle mode), use vehicle pos
    if (_vehicleObj) {
      _tmpVec3a.copy(_vehicleObj.position);
      _tmpVec3a.y += 2.0; // Hatch view height
      _camera.position.copy(_tmpVec3a);
      _camera.position.x += shakeOffsetX;
      _camera.position.y += shakeOffsetY;
      // Use vehicle yaw as base + allow limited freelook via mouse offset
      var vehicleYaw = _vehicleObj.rotation.y;
      var lookYaw = vehicleYaw + (yaw - vehicleYaw) * 1.0; // freelook from vehicle heading
      var vEuler = _tmpEuler.set(pitch + shakeOffsetY * 0.5, lookYaw + shakeOffsetX * 0.5, 0, 'YXZ');
      _camera.quaternion.setFromEuler(vEuler);
      return;
    }

    // Head bob
    if (isMoving && isGrounded) {
      bobPhase += delta * BOB_FREQ;
      bobActive = true;
    } else {
      bobPhase *= 0.9;
      bobActive = false;
    }
    const bobOffset = Math.sin(bobPhase) * BOB_AMP * (bobActive ? 1 : 0);

    _camera.position.set(
      playerPos.x + shakeOffsetX,
      playerPos.y + bobOffset + shakeOffsetY,
      playerPos.z
    );

    const euler = _tmpEuler.set(
      pitch + shakeOffsetY * 0.5 + _flinchPitch,
      yaw + shakeOffsetX * 0.5 + _flinchYaw,
      0, 'YXZ'
    );
    // Strafe camera roll
    var strafeTarg = _strafeDir * 0.035;
    _strafeTilt += (strafeTarg - _strafeTilt) * Math.min(1, delta * 8);
    euler.z = _strafeTilt;
    _camera.quaternion.setFromEuler(euler);
  }

  /* ── Third Person Camera ─────────────────────────────────────────── */
  function updateTPS(delta, playerPos) {
    _tmpVec3a.set(
      Math.sin(yaw) * tpsDist,
      tpsHeight - pitch * 2,
      Math.cos(yaw) * tpsDist
    );

    _tmpVec3b.copy(playerPos).add(_tmpVec3a);
    _camera.position.lerp(_tmpVec3b, Math.min(1, tpsSmooth * delta));
    _camera.lookAt(playerPos.x, playerPos.y + 1, playerPos.z);
  }

  /* ── Strategic / RTS Camera ──────────────────────────────────────── */
  const _rtsKeys = { up: false, down: false, left: false, right: false };

  function setRTSKey(key, pressed) {
    if (key in _rtsKeys) _rtsKeys[key] = pressed;
  }

  function updateRTS(delta) {
    // Pan based on keys or edge scroll
    const panX = (_rtsKeys.right ? 1 : 0) - (_rtsKeys.left ? 1 : 0);
    const panZ = (_rtsKeys.down  ? 1 : 0) - (_rtsKeys.up   ? 1 : 0);

    const forward = _tmpVec3a.set(-Math.sin(rtsYaw), 0, -Math.cos(rtsYaw));
    const right   = _tmpVec3b.set(Math.cos(rtsYaw), 0, -Math.sin(rtsYaw));

    rtsTarget.addScaledVector(right,   panX * RTS_PAN_SPEED * delta);
    rtsTarget.addScaledVector(forward, panZ * RTS_PAN_SPEED * delta);

    // Position camera above target
    _tmpVec3c.copy(rtsTarget);
    _tmpVec3c.y += rtsZoom;
    _tmpVec3c.x += Math.sin(rtsYaw) * rtsZoom * 0.5;
    _tmpVec3c.z += Math.cos(rtsYaw) * rtsZoom * 0.5;

    _camera.position.lerp(_tmpVec3c, Math.min(1, 6 * delta));
    _camera.lookAt(rtsTarget);
  }

  function getRTSTarget() { return rtsTarget.clone(); }

  /* ── Drone Camera ────────────────────────────────────────────────── */
  function setDroneTarget(obj) { _droneObj = obj; }

  function updateDrone(delta) {
    if (!_droneObj) return;
    _camera.position.copy(_droneObj.position);
    const euler = _tmpEuler.set(pitch, yaw, 0, 'YXZ');
    _camera.quaternion.setFromEuler(euler);
  }

  /* ── Vehicle Camera ──────────────────────────────────────────────── */
  function setVehicleTarget(obj) { _vehicleObj = obj; }

  function updateVehicle(delta) {
    if (!_vehicleObj) return;
    // Follow behind vehicle based on vehicle's own rotation
    var vYaw = _vehicleObj.rotation.y;
    // Smooth camera follow: offset behind vehicle
    var behindDist = 8;
    var aboveHeight = 3;
    var cx = _vehicleObj.position.x + Math.sin(vYaw) * behindDist;
    var cy = _vehicleObj.position.y + aboveHeight;
    var cz = _vehicleObj.position.z + Math.cos(vYaw) * behindDist;
    _camera.position.set(cx, cy, cz);
    _camera.lookAt(_vehicleObj.position);
  }

  /** Get the vehicle target for FPS mode inside vehicle */
  function getVehicleObj() { return _vehicleObj; }

  /* ── Getters ─────────────────────────────────────────────────────── */
  function getYaw()   { return yaw; }
  function getPitch() { return pitch; }
  function setYaw(v)  { yaw = v; }
  function setPitch(v) { pitch = v; }

  function getForwardDir() {
    _camera.getWorldDirection(_tmpFwdDir);
    return _tmpFwdDir;
  }

  function getMoveDir() {
    // Horizontal forward (no pitch)
    return _tmpVec3a.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  }

  /* ── Wave Last-Kill Camera ──────────────────────────────────────── */
  var _killCamActive = false;
  var _killCamTimer = 0;
  var _killCamDuration = 1.2;
  var _killCamSavedYaw = 0;
  var _killCamSavedPitch = 0;
  var _killCamTargetYaw = 0;
  var _killCamTargetPitch = 0;

  function playLastKillCam(targetPos, camPos) {
    if (!targetPos || !camPos) return;
    _killCamSavedYaw = yaw;
    _killCamSavedPitch = pitch;
    // Calculate yaw/pitch to look at target
    var dx = targetPos.x - camPos.x;
    var dz = targetPos.z - camPos.z;
    var dy = targetPos.y - camPos.y;
    var dist = Math.sqrt(dx * dx + dz * dz);
    _killCamTargetYaw = Math.atan2(-dx, -dz);
    _killCamTargetPitch = Math.atan2(dy, dist);
    _killCamActive = true;
    _killCamTimer = _killCamDuration;
  }

  function updateKillCam(delta) {
    if (!_killCamActive) return false;
    _killCamTimer -= delta;
    if (_killCamTimer <= 0) {
      // Revert to saved camera orientation
      yaw = _killCamSavedYaw;
      pitch = _killCamSavedPitch;
      _killCamActive = false;
      return false;
    }
    var t = 1 - _killCamTimer / _killCamDuration;
    if (t < 0.3) {
      // Phase 1: lerp toward target
      var p = t / 0.3;
      yaw = _killCamSavedYaw + (_killCamTargetYaw - _killCamSavedYaw) * p;
      pitch = _killCamSavedPitch + (_killCamTargetPitch - _killCamSavedPitch) * p;
    }
    // Phase 2: hold on target (t 0.3-0.8) — yaw/pitch stay at target
    // Phase 3: auto-revert happens when timer expires
    return true; // camera is overridden
  }

  function isKillCamActive() { return _killCamActive; }

  function setStrafeDir(dir) { _strafeDir = dir; }

  return {
    MODE,
    init,
    update,
    setMode,
    getMode,
    cycleMode,
    handleMouseMove,
    handleWheel,
    setRTSKey,
    getRTSTarget,
    setDroneTarget,
    setVehicleTarget,
    getYaw,
    getPitch,
    setYaw,
    setPitch,
    getForwardDir,
    getMoveDir,
    shake,
    flinch,
    playLastKillCam,
    updateKillCam,
    isKillCamActive,
    setStrafeDir,
  };
})();
