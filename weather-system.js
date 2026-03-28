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

  return {
    WEATHER: WEATHER,
    init: init,
    update: update,
    setWeather: setWeather,
    getWeather: getWeather,
  };
})();
