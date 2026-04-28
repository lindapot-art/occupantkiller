/* ───────────────────────────────────────────────────────────
   WEATHER SYSTEM — Dynamic weather effects with particles
   ─────────────────────────────────────────────────────────── */
const WeatherSystem = (function () {
  'use strict';

  var WEATHER = Object.freeze({
    CLEAR: 'clear',
    OVERCAST: 'overcast',
    RAIN: 'rain',
    HEAVY_RAIN: 'heavy_rain',
    SNOW: 'snow',
    FOG: 'fog',
  });

  var _scene = null;
  var _camera = null;
  var currentWeather = WEATHER.CLEAR;
  var particles = null;
  var particleCount = 0;
  var weatherTimer = 0;
  var weatherDuration = 120; // seconds between weather changes
  var targetFogDensity = 0;
  var _lightningTimer = 0;
  var _lightningFlash = null;

  // ── Cloud layer (drifting billboard sprites high above world) ──
  var _cloudGroup = null;
  var _clouds = [];          // [{ sprite, baseScale }]
  var _cloudWind = { x: -2.5, z: 0.6 }; // m/s
  var _cloudTargetOpacity = 0.85;
  var _cloudTargetTint = new THREE.Color(1, 1, 1);
  var CLOUD_COUNT = 56;
  var CLOUD_HEIGHT = 130;
  var CLOUD_RADIUS = 260;

  // ── Snow ground accumulation ──
  var _snowCover = null;     // InstancedMesh of small white discs on terrain top
  var _snowDummy = null;
  var _snowAccumulation = 0; // 0..1 — drives instance opacity
  var _snowAccumulationTarget = 0;
  var SNOW_PATCH_COUNT = 220;
  var SNOW_PATCH_RADIUS = 90; // m around camera
  var _hemiLight = null;
  var _ambLight = null;
  var _baseHemiSky = null;
  var _baseAmbColor = null;

  function init(scene, camera) {
    _scene = scene;
    _camera = camera;
    createParticleSystem();
    createCloudLayer();
    createSnowCover();
    // Cache lights for snow tint
    if (_scene) {
      _scene.traverse(function (o) {
        if (o.isHemisphereLight && !_hemiLight) {
          _hemiLight = o;
          _baseHemiSky = o.color.clone();
        } else if (o.isAmbientLight && !_ambLight) {
          _ambLight = o;
          _baseAmbColor = o.color.clone();
        }
      });
    }
    // Start with clear weather
    setWeather(WEATHER.CLEAR);
  }

  /* ── Cloud layer ─────────────────────────────────────────────── */
  function _makeCloudTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var ctx = c.getContext('2d');
    // Draw 6-8 overlapping radial-gradient puffs to make a fluffy blob.
    var puffs = 7;
    for (var p = 0; p < puffs; p++) {
      var px = 64 + (Math.random() - 0.5) * 70;
      var py = 64 + (Math.random() - 0.5) * 50;
      var pr = 28 + Math.random() * 18;
      var g = ctx.createRadialGradient(px, py, 1, px, py, pr);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  function createCloudLayer() {
    if (!_scene) return;
    var tex = _makeCloudTexture();
    _cloudGroup = new THREE.Group();
    _cloudGroup.name = 'cloud-layer';
    for (var i = 0; i < CLOUD_COUNT; i++) {
      var mat = new THREE.SpriteMaterial({
        map: tex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        fog: false,
      });
      var s = new THREE.Sprite(mat);
      var scale = 30 + Math.random() * 50;
      s.scale.set(scale, scale * 0.55, 1);
      s.position.set(
        (Math.random() - 0.5) * CLOUD_RADIUS * 2,
        CLOUD_HEIGHT + (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * CLOUD_RADIUS * 2
      );
      _cloudGroup.add(s);
      _clouds.push({ sprite: s, baseScale: scale });
    }
    _scene.add(_cloudGroup);
  }

  function _setCloudWeather(weather) {
    switch (weather) {
      case WEATHER.CLEAR:
        _cloudTargetOpacity = 0.45;
        _cloudTargetTint.setRGB(1.0, 1.0, 1.0);
        _cloudWind.x = -2.5; _cloudWind.z = 0.6;
        break;
      case WEATHER.OVERCAST:
        _cloudTargetOpacity = 0.95;
        _cloudTargetTint.setRGB(0.78, 0.80, 0.86);
        _cloudWind.x = -3.5; _cloudWind.z = 0.8;
        break;
      case WEATHER.RAIN:
        _cloudTargetOpacity = 1.0;
        _cloudTargetTint.setRGB(0.55, 0.58, 0.66);
        _cloudWind.x = -5.0; _cloudWind.z = 1.2;
        break;
      case WEATHER.HEAVY_RAIN:
        _cloudTargetOpacity = 1.0;
        _cloudTargetTint.setRGB(0.36, 0.38, 0.46);
        _cloudWind.x = -8.0; _cloudWind.z = 1.8;
        break;
      case WEATHER.SNOW:
        _cloudTargetOpacity = 0.95;
        _cloudTargetTint.setRGB(0.86, 0.88, 0.93);
        _cloudWind.x = -1.5; _cloudWind.z = 0.4;
        break;
      case WEATHER.FOG:
        _cloudTargetOpacity = 0.6;
        _cloudTargetTint.setRGB(0.85, 0.85, 0.85);
        _cloudWind.x = -1.0; _cloudWind.z = 0.3;
        break;
    }
  }

  function _updateClouds(delta) {
    if (!_cloudGroup || !_camera) return;
    var camX = _camera.position.x, camZ = _camera.position.z;
    for (var i = 0; i < _clouds.length; i++) {
      var c = _clouds[i];
      var p = c.sprite.position;
      p.x += _cloudWind.x * delta;
      p.z += _cloudWind.z * delta;
      // Recycle clouds that drift too far from camera (wrap to the other side).
      var dx = p.x - camX, dz = p.z - camZ;
      if (Math.abs(dx) > CLOUD_RADIUS) p.x = camX - Math.sign(dx) * CLOUD_RADIUS + (Math.random() - 0.5) * 40;
      if (Math.abs(dz) > CLOUD_RADIUS) p.z = camZ - Math.sign(dz) * CLOUD_RADIUS + (Math.random() - 0.5) * 40;
      // Lerp tint + opacity toward weather targets.
      var m = c.sprite.material;
      m.opacity += (_cloudTargetOpacity - m.opacity) * Math.min(1, delta * 0.4);
      m.color.lerp(_cloudTargetTint, Math.min(1, delta * 0.4));
    }
  }

  /* ── Snow ground accumulation ────────────────────────────────── */
  function _makeSnowPatchTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(245,250,255,0.7)');
    g.addColorStop(1, 'rgba(220,230,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }

  function createSnowCover() {
    if (!_scene) return;
    var geo = new THREE.PlaneGeometry(3.6, 3.6);
    geo.rotateX(-Math.PI / 2);
    var mat = new THREE.MeshBasicMaterial({
      map: _makeSnowPatchTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    _snowCover = new THREE.InstancedMesh(geo, mat, SNOW_PATCH_COUNT);
    _snowCover.frustumCulled = false;
    _snowCover.name = 'snow-cover';
    _snowCover.visible = false;
    _snowDummy = new THREE.Object3D();
    // Initial scatter; will be re-snapped to terrain when snow starts.
    for (var i = 0; i < SNOW_PATCH_COUNT; i++) {
      _snowDummy.position.set(0, -1000, 0);
      _snowDummy.updateMatrix();
      _snowCover.setMatrixAt(i, _snowDummy.matrix);
    }
    _snowCover.instanceMatrix.needsUpdate = true;
    _scene.add(_snowCover);
  }

  function _resnapSnowPatches() {
    if (!_snowCover || !_camera) return;
    var camX = _camera.position.x, camZ = _camera.position.z;
    for (var i = 0; i < SNOW_PATCH_COUNT; i++) {
      var ang = Math.random() * Math.PI * 2;
      var r = Math.sqrt(Math.random()) * SNOW_PATCH_RADIUS;
      var x = camX + Math.cos(ang) * r;
      var z = camZ + Math.sin(ang) * r;
      var y = 0.05;
      if (window.VoxelWorld && typeof window.VoxelWorld.getHeight === 'function') {
        try { y = window.VoxelWorld.getHeight(x, z) + 0.06; } catch (e) {}
      }
      var rot = Math.random() * Math.PI * 2;
      var sc = 0.7 + Math.random() * 0.9;
      _snowDummy.position.set(x, y, z);
      _snowDummy.rotation.set(0, rot, 0);
      _snowDummy.scale.set(sc, 1, sc);
      _snowDummy.updateMatrix();
      _snowCover.setMatrixAt(i, _snowDummy.matrix);
    }
    _snowCover.instanceMatrix.needsUpdate = true;
  }

  function _updateSnowCover(delta) {
    if (!_snowCover) return;
    // Accumulate during SNOW; melt otherwise. Lerp constant 0.35 ≈ 3s to peak.
    _snowAccumulation += (_snowAccumulationTarget - _snowAccumulation) * Math.min(1, delta * 0.35);
    var op = Math.max(0, Math.min(0.95, _snowAccumulation));
    if (_snowCover.material) _snowCover.material.opacity = op;
    _snowCover.visible = op > 0.02;

    // Tint scene lights toward cool white during snow accumulation.
    if (_hemiLight && _baseHemiSky) {
      _hemiLight.color.copy(_baseHemiSky).lerp(new THREE.Color(0xc8d8ff), op * 0.5);
    }
    if (_ambLight && _baseAmbColor) {
      _ambLight.color.copy(_baseAmbColor).lerp(new THREE.Color(0xeaf0ff), op * 0.4);
    }
  }

  function createParticleSystem() {
    var maxParticles = 3000;
    var geometry = new THREE.BufferGeometry();
    var positions = new Float32Array(maxParticles * 3);
    var velocities = new Float32Array(maxParticles * 3);

    for (var i = 0; i < maxParticles; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.userData.velocities = velocities;

    var material = new THREE.PointsMaterial({
      color: 0xcccccc,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    particles = new THREE.Points(geometry, material);
    particles.visible = false;
    _scene.add(particles);
    particleCount = maxParticles;
  }

  function setWeather(weather) {
    currentWeather = weather;
    _setCloudWeather(weather);
    // Snow accumulation: ramp up during SNOW, melt back to 0 otherwise.
    if (weather === WEATHER.SNOW) {
      _snowAccumulationTarget = 0.85;
      _resnapSnowPatches();
    } else {
      _snowAccumulationTarget = 0;
    }

    switch (weather) {
      case WEATHER.CLEAR:
        particles.visible = false;
        targetFogDensity = 0;
        break;
      case WEATHER.OVERCAST:
        particles.visible = false;
        targetFogDensity = 0.01;
        break;
      case WEATHER.RAIN:
        particles.visible = true;
        particles.material.color.setHex(0x8888cc);
        particles.material.size = 0.1;
        particles.material.opacity = 0.4;
        targetFogDensity = 0.015;
        setParticleVelocities(0.5, -12, 0.3); // light rain
        break;
      case WEATHER.HEAVY_RAIN:
        particles.visible = true;
        particles.material.color.setHex(0x6666aa);
        particles.material.size = 0.15;
        particles.material.opacity = 0.5;
        targetFogDensity = 0.025;
        setParticleVelocities(1.0, -18, 0.5); // heavy rain
        break;
      case WEATHER.SNOW:
        particles.visible = true;
        particles.material.color.setHex(0xffffff);
        particles.material.size = 0.2;
        particles.material.opacity = 0.7;
        targetFogDensity = 0.02;
        setParticleVelocities(0.3, -2, 0.3); // slow falling snow
        break;
      case WEATHER.FOG:
        particles.visible = false;
        targetFogDensity = 0.04;
        break;
    }
  }

  function setParticleVelocities(windX, fallSpeed, windZ) {
    var vels = particles.geometry.userData.velocities;
    for (var i = 0; i < particleCount; i++) {
      vels[i * 3] = windX + (Math.random() - 0.5) * 0.5;
      vels[i * 3 + 1] = fallSpeed + (Math.random() - 0.5) * 2;
      vels[i * 3 + 2] = windZ + (Math.random() - 0.5) * 0.5;
    }
  }

  function update(delta) {
    if (!_scene || !_camera) return;

    _updateClouds(delta);
    _updateSnowCover(delta);

    // Weather transition timer
    weatherTimer += delta;
    if (weatherTimer > weatherDuration) {
      weatherTimer = 0;
      weatherDuration = 60 + Math.random() * 180; // 1-4 minutes
      // Random weather change
      var weathers = Object.values(WEATHER);
      var newWeather = weathers[Math.floor(Math.random() * weathers.length)];
      setWeather(newWeather);
    }

    // Update fog
    if (_scene.fog) {
      var currentDensity = _scene.fog.far ? (1 / _scene.fog.far * 50) : 0;
      var newDensity = currentDensity + (targetFogDensity - currentDensity) * delta * 0.5;
      if (newDensity > 0.001) {
        _scene.fog.far = 50 / newDensity;
        _scene.fog.near = _scene.fog.far * 0.3;
      } else {
        _scene.fog.far = 200;
        _scene.fog.near = 0.1;
      }
    }

    // Lightning during heavy rain
    if (currentWeather === WEATHER.HEAVY_RAIN) {
      _lightningTimer -= delta;
      if (_lightningTimer <= 0) {
        _lightningTimer = 3 + Math.random() * 8; // every 3-11 seconds
        // Flash the scene bright
        if (!_lightningFlash) {
          _lightningFlash = new THREE.PointLight(0xffffff, 0, 200);
          _lightningFlash.position.set(0, 50, 0);
          _scene.add(_lightningFlash);
        }
        _lightningFlash.intensity = 8;
        _lightningFlash.position.set(
          _camera.position.x + (Math.random() - 0.5) * 40,
          40,
          _camera.position.z + (Math.random() - 0.5) * 40
        );
        // Thunder sound
        if (typeof AudioSystem !== 'undefined' && AudioSystem.playExplosion) {
          setTimeout(function () { AudioSystem.playExplosion(); }, 300 + Math.random() * 1500);
        }
        // Screen shake
        if (typeof CameraSystem !== 'undefined' && CameraSystem.shake) {
          setTimeout(function () { CameraSystem.shake(0.015, 0.3); }, 300 + Math.random() * 1500);
        }
      }
      // Decay lightning flash
      if (_lightningFlash && _lightningFlash.intensity > 0) {
        _lightningFlash.intensity *= Math.max(0, 1 - delta * 12);
        if (_lightningFlash.intensity < 0.1) _lightningFlash.intensity = 0;
      }
    } else {
      if (_lightningFlash) _lightningFlash.intensity = 0;
    }

    // Update particles
    if (particles && particles.visible) {
      var positions = particles.geometry.attributes.position.array;
      var velocities = particles.geometry.userData.velocities;
      var camPos = _camera.position;

      for (var i = 0; i < particleCount; i++) {
        var idx = i * 3;
        positions[idx] += velocities[idx] * delta;
        positions[idx + 1] += velocities[idx + 1] * delta;
        positions[idx + 2] += velocities[idx + 2] * delta;

        // Re-center particles around camera
        if (positions[idx + 1] < 0) {
          positions[idx] = camPos.x + (Math.random() - 0.5) * 80;
          positions[idx + 1] = camPos.y + 20 + Math.random() * 20;
          positions[idx + 2] = camPos.z + (Math.random() - 0.5) * 80;
        }

        // Keep particles near camera horizontally
        var dx = positions[idx] - camPos.x;
        var dz = positions[idx + 2] - camPos.z;
        if (Math.abs(dx) > 40 || Math.abs(dz) > 40) {
          positions[idx] = camPos.x + (Math.random() - 0.5) * 60;
          positions[idx + 2] = camPos.z + (Math.random() - 0.5) * 60;
        }
      }

      particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  function getWeather() { return currentWeather; }

  /** Get gameplay modifiers based on current weather */
  function getModifiers() {
    switch (currentWeather) {
      case WEATHER.RAIN:
        return { accuracyMod: 0.9, speedMod: 1.0, visionRange: 0.85, label: '🌧 Rain' };
      case WEATHER.HEAVY_RAIN:
        return { accuracyMod: 0.75, speedMod: 0.95, visionRange: 0.65, label: '⛈ Storm' };
      case WEATHER.SNOW:
        return { accuracyMod: 0.95, speedMod: 0.85, visionRange: 0.75, label: '🌨 Snow' };
      case WEATHER.FOG:
        return { accuracyMod: 1.0, speedMod: 1.0, visionRange: 0.4, label: '🌫 Fog' };
      case WEATHER.OVERCAST:
        return { accuracyMod: 1.0, speedMod: 1.0, visionRange: 0.95, label: '☁ Overcast' };
      default:
        return { accuracyMod: 1.0, speedMod: 1.0, visionRange: 1.0, label: '☀ Clear' };
    }
  }

  /* ── Extreme Weather Events ──────────────────────────────────────── */
  var EXTREME_EVENTS = {
    blizzard:     { label: 'Blizzard',     visionMod: 0.05, speedMod: 0.5,  dmgPerSec: 0, duration: 30 },
    sandstorm:    { label: 'Sandstorm',    visionMod: 0.15, speedMod: 0.7,  dmgPerSec: 2, duration: 25 },
    tornado:      { label: 'Tornado',      visionMod: 0.3,  speedMod: 0.4,  dmgPerSec: 0, duration: 20, windForce: 30 },
    hailstorm:    { label: 'Hailstorm',    visionMod: 0.5,  speedMod: 0.85, dmgPerSec: 3, duration: 20 },
    thunderstorm: { label: 'Thunderstorm', visionMod: 0.35, speedMod: 0.9,  dmgPerSec: 0, duration: 30, lightning: true },
  };

  var _extremeEvent = null;
  var _extremeTimer = 0;

  function triggerExtremeEvent(type) {
    var ev = EXTREME_EVENTS[type];
    if (!ev) return false;
    _extremeEvent = { type: type, config: ev, elapsed: 0 };
    _extremeTimer = ev.duration;
    return true;
  }

  function updateExtremeEvent(delta) {
    if (!_extremeEvent) return null;
    _extremeEvent.elapsed += delta;
    _extremeTimer -= delta;
    if (_extremeTimer <= 0) {
      var finished = _extremeEvent;
      _extremeEvent = null;
      _extremeTimer = 0;
      return finished;
    }
    // Apply periodic damage
    var cfg = _extremeEvent.config;
    if (cfg.dmgPerSec > 0 && typeof GameManager !== 'undefined') {
      var p = GameManager.getPlayer();
      if (p) p.hp -= cfg.dmgPerSec * delta;
    }
    // Lightning strikes during thunderstorm kill nearby enemies
    if (cfg.lightning && Math.random() < delta * 0.3) {
      if (typeof Enemies !== 'undefined' && Enemies.getAll) {
        var enemies = Enemies.getAll();
        if (enemies.length > 0) {
          var target = enemies[Math.floor(Math.random() * enemies.length)];
          if (target.alive) {
            Enemies.damage(target, 999);
            if (typeof AudioSystem !== 'undefined' && AudioSystem.playExplosion) AudioSystem.playExplosion();
          }
        }
      }
    }
    return _extremeEvent;
  }

  function getExtremeEvent() {
    return _extremeEvent;
  }

  /* ── Weather Forecast ────────────────────────────────────────────── */
  var _forecast = [];

  function generateForecast() {
    _forecast = [];
    var weathers = Object.values(WEATHER);
    for (var i = 0; i < 3; i++) {
      _forecast.push({
        weather: weathers[Math.floor(Math.random() * weathers.length)],
        timeUntil: (i + 1) * (60 + Math.floor(Math.random() * 120)),
      });
    }
    return _forecast;
  }

  function getForecast() {
    if (_forecast.length === 0) generateForecast();
    return _forecast.slice();
  }

  /* ── Temperature System ──────────────────────────────────────────── */
  var _temperature = 20; // Celsius

  function updateTemperature(timeOfDay, season) {
    // timeOfDay: 0-24 hours, season: 'spring'|'summer'|'autumn'|'winter'
    var baseTemps = {
      spring: 15, summer: 28, autumn: 12, winter: -5,
    };
    var base = baseTemps[season] || 20;
    // Cooler at night (0-6, 18-24), warmer midday (10-14)
    var hourFactor = 0;
    if (timeOfDay >= 10 && timeOfDay <= 14) {
      hourFactor = 8;
    } else if (timeOfDay >= 0 && timeOfDay < 6) {
      hourFactor = -6;
    } else if (timeOfDay >= 18) {
      hourFactor = -4;
    }
    _temperature = base + hourFactor + (Math.random() - 0.5) * 2;
    return _temperature;
  }

  function getTemperature() {
    return _temperature;
  }

  function getTemperatureEffects() {
    var staminaDrain = 1.0;
    var healRate = 1.0;
    if (_temperature > 35) {
      staminaDrain = 1.5;  // heat exhaustion
      healRate = 0.8;
    } else if (_temperature < 0) {
      staminaDrain = 1.3;  // cold saps energy
      healRate = 0.7;
    } else if (_temperature >= 18 && _temperature <= 25) {
      staminaDrain = 0.9;  // comfortable
      healRate = 1.1;
    }
    return { staminaDrain: staminaDrain, healRate: healRate };
  }

  function clear() {
    if (particles) {
      if (_scene) _scene.remove(particles);
      if (particles.geometry) particles.geometry.dispose();
      if (particles.material) particles.material.dispose();
      particles = null;
    }
    if (_lightningFlash) {
      if (_scene) _scene.remove(_lightningFlash);
      _lightningFlash.dispose();
      _lightningFlash = null;
    }
    if (_cloudGroup) {
      for (var ci = 0; ci < _clouds.length; ci++) {
        var sm = _clouds[ci].sprite.material;
        if (sm.map) sm.map.dispose();
        sm.dispose();
      }
      if (_scene) _scene.remove(_cloudGroup);
      _cloudGroup = null;
      _clouds.length = 0;
    }
    if (_snowCover) {
      if (_scene) _scene.remove(_snowCover);
      if (_snowCover.geometry) _snowCover.geometry.dispose();
      if (_snowCover.material) {
        if (_snowCover.material.map) _snowCover.material.map.dispose();
        _snowCover.material.dispose();
      }
      _snowCover = null;
      _snowDummy = null;
    }
    // Restore light tints
    if (_hemiLight && _baseHemiSky) _hemiLight.color.copy(_baseHemiSky);
    if (_ambLight && _baseAmbColor) _ambLight.color.copy(_baseAmbColor);
    _hemiLight = null; _ambLight = null;
    _baseHemiSky = null; _baseAmbColor = null;
    _snowAccumulation = 0;
    _snowAccumulationTarget = 0;
    particleCount = 0;
    currentWeather = WEATHER.CLEAR;
    weatherTimer = 0;
    targetFogDensity = 0;
    _lightningTimer = 0;
    _extremeEvent = null;
    _extremeTimer = 0;
    _forecast = [];
    _temperature = 20;
  }

  return {
    WEATHER: WEATHER,
    init: init,
    update: update,
    clear: clear,
    setWeather: setWeather,
    getWeather: getWeather,
    getModifiers: getModifiers,
    // Extreme Weather Events
    EXTREME_EVENTS: EXTREME_EVENTS,
    triggerExtremeEvent: triggerExtremeEvent,
    updateExtremeEvent: updateExtremeEvent,
    getExtremeEvent: getExtremeEvent,
    // Weather Forecast
    generateForecast: generateForecast,
    getForecast: getForecast,
    // Temperature System
    updateTemperature: updateTemperature,
    getTemperature: getTemperature,
    getTemperatureEffects: getTemperatureEffects,
  };
})();

// Expose globally so other modules and test harnesses can access it.
if (typeof window !== 'undefined') window.WeatherSystem = WeatherSystem;
