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

  function init(scene, camera) {
    _scene = scene;
    _camera = camera;
    createParticleSystem();
    // Start with clear weather
    setWeather(WEATHER.CLEAR);
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
