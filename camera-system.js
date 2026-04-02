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

  /* ── FPS Camera ──────────────────────────────────────────────────── */
  function updateFPS(delta, playerPos, isMoving, isGrounded) {
    // If we have a vehicle target (first-person vehicle mode), use vehicle pos
    if (_vehicleObj) {
      var vPos = _vehicleObj.position.clone();
      vPos.y += 2.0; // Hatch view height
      _camera.position.copy(vPos);
      var euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
      _camera.quaternion.setFromEuler(euler);
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

    _camera.position.set(playerPos.x, playerPos.y + bobOffset, playerPos.z);

    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    _camera.quaternion.setFromEuler(euler);
  }

  /* ── Third Person Camera ─────────────────────────────────────────── */
  function updateTPS(delta, playerPos) {
    const idealOffset = new THREE.Vector3(
      Math.sin(yaw) * tpsDist,
      tpsHeight - pitch * 2,
      Math.cos(yaw) * tpsDist
    );

    const target = playerPos.clone().add(idealOffset);
    _camera.position.lerp(target, Math.min(1, tpsSmooth * delta));
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

    const forward = new THREE.Vector3(-Math.sin(rtsYaw), 0, -Math.cos(rtsYaw));
    const right   = new THREE.Vector3(Math.cos(rtsYaw), 0, -Math.sin(rtsYaw));

    rtsTarget.addScaledVector(right,   panX * RTS_PAN_SPEED * delta);
    rtsTarget.addScaledVector(forward, panZ * RTS_PAN_SPEED * delta);

    // Position camera above target
    const camPos = rtsTarget.clone();
    camPos.y += rtsZoom;
    camPos.x += Math.sin(rtsYaw) * rtsZoom * 0.5;
    camPos.z += Math.cos(rtsYaw) * rtsZoom * 0.5;

    _camera.position.lerp(camPos, Math.min(1, 6 * delta));
    _camera.lookAt(rtsTarget);
  }

  function getRTSTarget() { return rtsTarget.clone(); }

  /* ── Drone Camera ────────────────────────────────────────────────── */
  function setDroneTarget(obj) { _droneObj = obj; }

  function updateDrone(delta) {
    if (!_droneObj) return;
    _camera.position.copy(_droneObj.position);
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    _camera.quaternion.setFromEuler(euler);
  }

  /* ── Vehicle Camera ──────────────────────────────────────────────── */
  function setVehicleTarget(obj) { _vehicleObj = obj; }

  function updateVehicle(delta) {
    if (!_vehicleObj) return;
    // Follow behind vehicle (third person vehicle view)
    const behind = new THREE.Vector3(0, 3, 8);
    behind.applyQuaternion(_vehicleObj.quaternion);
    _camera.position.copy(_vehicleObj.position).add(behind);
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
    const dir = new THREE.Vector3();
    _camera.getWorldDirection(dir);
    return dir;
  }

  function getMoveDir() {
    // Horizontal forward (no pitch)
    return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  }

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
  };
})();
