// === 33 Modern 3D World Effects (for implementation tracking) ===
// 1. Screen-space ambient occlusion (SSAO)
// 2. Distance blur (DOF)
// 3. Bloom
// 4. Motion blur
// 5. God rays (volumetric light shafts)
// 6. Dynamic fog (volumetric)
// 7. Rain/snow/precipitation
// 8. Wetness/reflection on surfaces
// 9. Lens dirt/flare
// 10. Chromatic aberration
// 11. Color grading/film LUT
// 12. Vignette
// 13. Sharpen filter
// 14. Heat distortion
// 15. Blood splatter on camera
// 16. Water droplets on camera
// 17. Screen cracks (damage)
// 18. Dynamic sun shadow maps
// 19. Real-time reflections (SSR)
// 20. Subsurface scattering (skin)
// 21. Particle light interaction
// 22. Lightning flashes
// 23. Wind-blown debris
// 24. Fire/smoke volumetrics
// 25. Explosive shockwave distortion
// 26. Ground scorch marks
// 27. Tracer round glow
// 28. Muzzle flash bloom
// 29. Nightvision post-process
// 30. Thermal vision post-process
// 31. EMP/flicker effect
// 32. Underwater caustics
// 33. Camera shake/trauma

// SSAO and blur effect hooks (to be implemented in render pipeline)
// Example: StageVFX.enableSSAO(true); StageVFX.setBlurAmount(0.5);
/* ───────────────────────────────────────────────────────────
   STAGE VFX — Per-stage environmental particle effects
   Depends on: THREE (global)
   ─────────────────────────────────────────────────────────── */
var StageVFX = (function () {
  'use strict';

  var MAX_PARTICLES = 200;
  var _scene = null;
  var _activeTheme = null;

  /* ── Object Pool ──────────────────────────────────────────── */
  var pool = [];          // inactive particles (available for reuse)
  var active = [];        // active particles being animated
  var groupMesh = null;   // parent Object3D for easy cleanup

  /* ── Shared Geometries & Materials (created once) ─────────── */
  var _geo = {};
  var _mat = {};

  function _createSharedAssets() {
    _geo.box = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    _geo.boxMed = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    _geo.plane = new THREE.PlaneGeometry(0.15, 0.15);
    _geo.smokePlane = new THREE.PlaneGeometry(0.4, 0.4);

    _mat.ember = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    _mat.spark = new THREE.MeshBasicMaterial({
      color: 0xffcc00, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    _mat.smoke = new THREE.MeshBasicMaterial({
      color: 0x666666, transparent: true, opacity: 0.35,
      depthWrite: false, side: THREE.DoubleSide
    });
    _mat.dust = new THREE.MeshBasicMaterial({
      color: 0xccbb99, transparent: true, opacity: 0.3,
      depthWrite: false
    });
    _mat.spray = new THREE.MeshBasicMaterial({
      color: 0xaaddff, transparent: true, opacity: 0.4,
      depthWrite: false
    });
    _mat.fogWisp = new THREE.MeshBasicMaterial({
      color: 0x99aacc, transparent: true, opacity: 0.2,
      depthWrite: false, side: THREE.DoubleSide
    });
    _mat.radiation = new THREE.MeshBasicMaterial({
      color: 0x44ff44, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    _mat.radDust = new THREE.MeshBasicMaterial({
      color: 0x99aa77, transparent: true, opacity: 0.25,
      depthWrite: false
    });
    _mat.debris = new THREE.MeshBasicMaterial({
      color: 0x888888, transparent: true, opacity: 0.7,
      depthWrite: false
    });
    _mat.ash = new THREE.MeshBasicMaterial({
      color: 0x444444, transparent: true, opacity: 0.4,
      depthWrite: false
    });
    _mat.fireGlow = new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    _mat.concrete = new THREE.MeshBasicMaterial({
      color: 0x999999, transparent: true, opacity: 0.3,
      depthWrite: false
    });
    _mat.sand = new THREE.MeshBasicMaterial({
      color: 0xddcc88, transparent: true, opacity: 0.35,
      depthWrite: false
    });
  }

  /* ── Pool Management ──────────────────────────────────────── */
  function _getParticle(geometry, material) {
    if (!groupMesh || !geometry || !material) return null;
    var p;
    if (pool.length > 0) {
      p = pool.pop();
      // Swap geometry and material
      p.mesh.geometry = geometry;
      // Clone material so per-particle opacity doesn't mutate shared material
      if (p.mesh.material) p.mesh.material.dispose();
      p.mesh.material = material.clone();
      p.mesh.visible = true;
    } else if (active.length >= MAX_PARTICLES) {
      // steal oldest active particle
      p = active.shift();
      p.mesh.geometry = geometry;
      if (p.mesh.material) p.mesh.material.dispose();
      p.mesh.material = material.clone();
      p.mesh.visible = true;
    } else {
      // create new — clone material for per-particle opacity
      var mesh = new THREE.Mesh(geometry, material.clone());
      mesh.frustumCulled = false;
      groupMesh.add(mesh);
      p = { mesh: mesh };
    }
    p.velocity = new THREE.Vector3(0, 0, 0);
    p.life = 1.0;
    p.maxLife = 1.0;
    p.gravity = 0;
    p.fadeOut = true;
    p.spin = 0;
    p.scaleStart = 1;
    p.scaleEnd = 1;
    return p;
  }

  function _recycleParticle(p) {
    p.mesh.visible = false;
    pool.push(p);
  }

  /* ── Spawner Timers ───────────────────────────────────────── */
  var _spawners = [];   // array of { fn, interval, timer }
  var _flashTimer = 0;
  var _flashActive = false;
  var _flashLight = null;

  function _addSpawner(fn, interval) {
    _spawners.push({ fn: fn, interval: interval, timer: Math.random() * interval });
  }

  /* ─────────────────────────────────────────────────────────────
     THEME DEFINITIONS — each returns spawner configs
     ───────────────────────────────────────────────────────────── */

  function _setupIndustrial() {
    // Rising embers
    _addSpawner(function () {
      var p = _getParticle(_geo.box, _mat.ember);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 60,
        Math.random() * 2,
        (Math.random() - 0.5) * 60
      );
      p.velocity.set(
        (Math.random() - 0.5) * 0.5,
        1.5 + Math.random() * 2.0,
        (Math.random() - 0.5) * 0.5
      );
      p.life = 1.0;
      p.maxLife = 2.5 + Math.random() * 1.5;
      p.gravity = -0.2; // slight upward buoyancy (negative = up for ember)
      p.spin = (Math.random() - 0.5) * 3;
      active.push(p);
    }, 0.08);

    // Smoke columns (big slow-rising planes)
    _addSpawner(function () {
      var p = _getParticle(_geo.smokePlane, _mat.smoke);
      if (!p) return;
      var cx = (Math.random() - 0.5) * 40;
      var cz = (Math.random() - 0.5) * 40;
      p.mesh.position.set(cx, Math.random() * 3, cz);
      p.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      p.velocity.set(
        (Math.random() - 0.5) * 0.2,
        0.8 + Math.random() * 0.5,
        (Math.random() - 0.5) * 0.2
      );
      p.life = 1.0;
      p.maxLife = 4.0 + Math.random() * 2.0;
      p.scaleStart = 0.5;
      p.scaleEnd = 2.5;
      p.spin = (Math.random() - 0.5) * 0.5;
      active.push(p);
    }, 0.5);
  }

  function _setupCoastal() {
    // Sea spray particles
    _addSpawner(function () {
      var p = _getParticle(_geo.box, _mat.spray);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 60,
        0.5 + Math.random() * 1.5,
        (Math.random() - 0.5) * 60
      );
      p.velocity.set(
        1.0 + Math.random() * 1.5,
        1.0 + Math.random() * 2.0,
        (Math.random() - 0.5) * 0.5
      );
      p.life = 1.0;
      p.maxLife = 1.5 + Math.random() * 1.0;
      p.gravity = 4.0;
      active.push(p);
    }, 0.12);

    // Fog wisps (slow drifting planes)
    _addSpawner(function () {
      var p = _getParticle(_geo.smokePlane, _mat.fogWisp);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 50,
        2 + Math.random() * 6,
        (Math.random() - 0.5) * 50
      );
      p.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      p.velocity.set(0.4 + Math.random() * 0.3, 0, (Math.random() - 0.5) * 0.2);
      p.life = 1.0;
      p.maxLife = 6.0 + Math.random() * 3.0;
      p.scaleStart = 1.0;
      p.scaleEnd = 3.0;
      p.spin = (Math.random() - 0.5) * 0.15;
      active.push(p);
    }, 1.2);
  }

  function _setupWasteland() {
    // Green radiation particles (rising, erratic)
    _addSpawner(function () {
      var p = _getParticle(_geo.box, _mat.radiation);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 50,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 50
      );
      p.velocity.set(
        (Math.random() - 0.5) * 0.8,
        0.5 + Math.random() * 1.2,
        (Math.random() - 0.5) * 0.8
      );
      p.life = 1.0;
      p.maxLife = 2.0 + Math.random() * 2.0;
      p.spin = (Math.random() - 0.5) * 4;
      active.push(p);
    }, 0.15);

    // Floating dust motes
    _addSpawner(function () {
      var p = _getParticle(_geo.box, _mat.radDust);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 60,
        1 + Math.random() * 8,
        (Math.random() - 0.5) * 60
      );
      p.velocity.set(
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.3
      );
      p.life = 1.0;
      p.maxLife = 5.0 + Math.random() * 3.0;
      active.push(p);
    }, 0.4);

    // Occasional green flash (using a point light)
    _flashTimer = 8 + Math.random() * 12;
  }

  function _setupCityscape() {
    // Falling debris
    _addSpawner(function () {
      var p = _getParticle(_geo.boxMed, _mat.debris);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 50,
        15 + Math.random() * 10,
        (Math.random() - 0.5) * 50
      );
      p.velocity.set(
        (Math.random() - 0.5) * 1.0,
        -1.0 - Math.random() * 0.5,
        (Math.random() - 0.5) * 1.0
      );
      p.life = 1.0;
      p.maxLife = 3.5 + Math.random() * 2.0;
      p.gravity = 3.0;
      p.spin = (Math.random() - 0.5) * 5;
      active.push(p);
    }, 0.2);

    // Ash fall (slow descending small particles)
    _addSpawner(function () {
      var p = _getParticle(_geo.box, _mat.ash);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 60,
        12 + Math.random() * 8,
        (Math.random() - 0.5) * 60
      );
      p.velocity.set(
        (Math.random() - 0.5) * 0.5,
        -0.4 - Math.random() * 0.3,
        (Math.random() - 0.5) * 0.5
      );
      p.life = 1.0;
      p.maxLife = 5.0 + Math.random() * 3.0;
      p.spin = (Math.random() - 0.5) * 1;
      active.push(p);
    }, 0.15);

    // Distant fire glow (slow pulsing planes low on horizon)
    _addSpawner(function () {
      var p = _getParticle(_geo.smokePlane, _mat.fireGlow);
      if (!p) return;
      var angle = Math.random() * Math.PI * 2;
      var dist = 40 + Math.random() * 20;
      p.mesh.position.set(
        Math.cos(angle) * dist,
        2 + Math.random() * 4,
        Math.sin(angle) * dist
      );
      p.mesh.rotation.set(0, Math.random() * Math.PI, 0);
      p.velocity.set(0, 0.1 + Math.random() * 0.1, 0);
      p.life = 1.0;
      p.maxLife = 3.0 + Math.random() * 2.0;
      p.scaleStart = 1.5;
      p.scaleEnd = 3.0;
      active.push(p);
    }, 1.0);
  }

  function _setupGrassland() {
    // Dust motes in sunlight
    _addSpawner(function () {
      var p = _getParticle(_geo.box, _mat.dust);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 50,
        2 + Math.random() * 10,
        (Math.random() - 0.5) * 50
      );
      p.velocity.set(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.2
      );
      p.life = 1.0;
      p.maxLife = 6.0 + Math.random() * 4.0;
      active.push(p);
    }, 0.6);
  }

  function _setupUrban() {
    // Concrete dust particles
    _addSpawner(function () {
      var p = _getParticle(_geo.box, _mat.concrete);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 50,
        1 + Math.random() * 8,
        (Math.random() - 0.5) * 50
      );
      p.velocity.set(
        (Math.random() - 0.5) * 0.6,
        -0.1 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.6
      );
      p.life = 1.0;
      p.maxLife = 4.0 + Math.random() * 2.0;
      active.push(p);
    }, 0.2);

    // Smoke wisps
    _addSpawner(function () {
      var p = _getParticle(_geo.smokePlane, _mat.smoke);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 40,
        Math.random() * 3,
        (Math.random() - 0.5) * 40
      );
      p.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      p.velocity.set(
        (Math.random() - 0.5) * 0.3,
        0.5 + Math.random() * 0.4,
        (Math.random() - 0.5) * 0.3
      );
      p.life = 1.0;
      p.maxLife = 4.0 + Math.random() * 2.0;
      p.scaleStart = 0.4;
      p.scaleEnd = 2.0;
      p.spin = (Math.random() - 0.5) * 0.4;
      active.push(p);
    }, 0.8);
  }

  function _setupDesert() {
    // Blowing sand particles
    _addSpawner(function () {
      var p = _getParticle(_geo.box, _mat.sand);
      if (!p) return;
      p.mesh.position.set(
        (Math.random() - 0.5) * 60,
        0.3 + Math.random() * 3,
        (Math.random() - 0.5) * 60
      );
      // Wind blows mostly in one direction
      p.velocity.set(
        2.0 + Math.random() * 2.0,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 1.0
      );
      p.life = 1.0;
      p.maxLife = 2.0 + Math.random() * 2.0;
      p.gravity = 0.8;
      p.spin = (Math.random() - 0.5) * 2;
      active.push(p);
    }, 0.06);
  }

  /* ── Public API ───────────────────────────────────────────── */

  function init(scene) {
    _scene = scene;
    groupMesh = new THREE.Object3D();
    _scene.add(groupMesh);
    _createSharedAssets();
  }

  function startStageEffects(theme) {
    if (!_scene || !groupMesh) return; // not initialized yet
    // Clear previous effects
    _clearParticles();
    _spawners.length = 0;
    _flashTimer = 0;
    _flashActive = false;
    _activeTheme = theme;

    switch (theme) {
      case 'industrial': _setupIndustrial(); break;
      case 'coastal':    _setupCoastal();    break;
      case 'wasteland':  _setupWasteland();  break;
      case 'cityscape':  _setupCityscape();  break;
      case 'grassland':  _setupGrassland();  break;
      case 'urban':      _setupUrban();      break;
      case 'desert':     _setupDesert();     break;
    }
    // Spawn ambient world props for all themes
    clearAmbientProps();
    spawnAmbientProps();
  }

  function update(delta) {
    if (!_scene || !groupMesh) return;

    // Run spawners
    var i, s;
    for (i = 0; i < _spawners.length; i++) {
      s = _spawners[i];
      s.timer -= delta;
      if (s.timer <= 0) {
        // Only spawn if under budget
        if (active.length < MAX_PARTICLES) {
          s.fn();
        }
        s.timer = s.interval;
      }
    }

    // Update ambient world props (fire glow, flickering lights)
    updateAmbientProps(delta);

    // Wasteland green flash logic
    if (_activeTheme === 'wasteland') {
      _flashTimer -= delta;
      if (_flashTimer <= 0 && !_flashActive) {
        _flashActive = true;
        _flashTimer = 0.15; // flash duration
        if (!_flashLight) {
          _flashLight = new THREE.PointLight(0x44ff44, 0, 80);
          _flashLight.position.set(
            (Math.random() - 0.5) * 40,
            10,
            (Math.random() - 0.5) * 40
          );
          groupMesh.add(_flashLight);
        }
        _flashLight.intensity = 3.0;
        _flashLight.position.set(
          (Math.random() - 0.5) * 40,
          8 + Math.random() * 5,
          (Math.random() - 0.5) * 40
        );
      }
      if (_flashActive) {
        _flashTimer -= delta;
        if (_flashTimer <= 0) {
          _flashActive = false;
          _flashTimer = 6 + Math.random() * 10;
          if (_flashLight) _flashLight.intensity = 0;
        }
      }
    }

    // Animate active particles
    var p, t;
    for (i = active.length - 1; i >= 0; i--) {
      p = active[i];
      if (!p || !p.mesh) { active.splice(i, 1); continue; }
      p.life -= delta / p.maxLife;

      if (p.life <= 0) {
        _recycleParticle(p);
        active.splice(i, 1);
        continue;
      }

      // Move
      p.mesh.position.x += p.velocity.x * delta;
      p.mesh.position.y += p.velocity.y * delta;
      p.mesh.position.z += p.velocity.z * delta;

      // Gravity
      if (p.gravity !== 0) {
        p.velocity.y -= p.gravity * delta;
      }

      // Spin
      if (p.spin !== 0) {
        p.mesh.rotation.z += p.spin * delta;
      }

      // Scale interpolation
      if (p.scaleStart !== p.scaleEnd) {
        t = 1.0 - p.life;
        var sc = p.scaleStart + (p.scaleEnd - p.scaleStart) * t;
        p.mesh.scale.setScalar(sc);
      }

      // Fade out
      if (p.fadeOut && p.mesh.material.opacity !== undefined) {
        // Fade in first 10%, fade out last 30%
        if (p.life > 0.9) {
          p.mesh.material.opacity = (1.0 - p.life) * 10; // 0→1 over first 10%
        } else if (p.life < 0.3) {
          p.mesh.material.opacity = p.life / 0.3;
        }
      }
    }
  }

  function _clearParticles() {
    var i;
    for (i = active.length - 1; i >= 0; i--) {
      if (active[i].mesh.material) active[i].mesh.material.dispose();
      active[i].mesh.visible = false;
      pool.push(active[i]);
    }
    active.length = 0;

    // Kill flash light
    if (_flashLight) {
      _flashLight.intensity = 0;
    }
  }

  // ── Ambient world motion: persistent animated props ────────────
  var _ambientProps = [];  // { mesh, type, timer }

  function spawnAmbientProps() {
    // Smoke columns at random positions near spawn area
    for (var i = 0; i < 4; i++) {
      var sx = (Math.random() - 0.5) * 80;
      var sz = (Math.random() - 0.5) * 80;
      var smokeLight = new THREE.PointLight(0xff6600, 0.5, 8);
      smokeLight.position.set(sx, 2, sz);
      if (groupMesh) groupMesh.add(smokeLight);
      _ambientProps.push({ mesh: smokeLight, type: 'fire-glow', timer: Math.random() * 6.28 });
    }
    // Flickering window lights
    for (var j = 0; j < 6; j++) {
      var lx = (Math.random() - 0.5) * 60;
      var ly = 3 + Math.random() * 8;
      var lz = (Math.random() - 0.5) * 60;
      var windowLight = new THREE.PointLight(0xffcc66, 0.3, 6);
      windowLight.position.set(lx, ly, lz);
      if (groupMesh) groupMesh.add(windowLight);
      _ambientProps.push({ mesh: windowLight, type: 'flicker', timer: Math.random() * 6.28 });
    }
  }

  function updateAmbientProps(delta) {
    for (var i = 0; i < _ambientProps.length; i++) {
      var p = _ambientProps[i];
      p.timer += delta;
      if (p.type === 'fire-glow') {
        // Pulsing fire glow
        p.mesh.intensity = 0.3 + Math.sin(p.timer * 3) * 0.2 + Math.sin(p.timer * 7.3) * 0.1;
      } else if (p.type === 'flicker') {
        // Random window flicker
        p.mesh.intensity = 0.15 + Math.sin(p.timer * 5) * 0.1 + (Math.sin(p.timer * 13.7) > 0.7 ? 0.2 : 0);
      }
    }
  }

  function clearAmbientProps() {
    for (var i = 0; i < _ambientProps.length; i++) {
      var p = _ambientProps[i];
      if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
      if (p.mesh.dispose) p.mesh.dispose();
    }
    _ambientProps.length = 0;
  }

  function clear() {
    _clearParticles();
    _spawners.length = 0;
    _activeTheme = null;
    _flashTimer = 0;
    _flashActive = false;
    clearAmbientProps();

    // Dispose all pooled meshes (including cloned materials)
    var i;
    for (i = 0; i < pool.length; i++) {
      if (pool[i].mesh.material) pool[i].mesh.material.dispose();
      if (pool[i].mesh.parent) pool[i].mesh.parent.remove(pool[i].mesh);
    }
    pool.length = 0;

    // Remove flash light
    if (_flashLight) {
      if (_flashLight.parent) _flashLight.parent.remove(_flashLight);
      _flashLight.dispose();
      _flashLight = null;
    }

    // Remove group from scene
    if (groupMesh && _scene) {
      _scene.remove(groupMesh);
      groupMesh = null;
    }

    // Dispose shared geometries
    var key;
    for (key in _geo) {
      if (_geo[key] && _geo[key].dispose) _geo[key].dispose();
    }
    _geo = {};
    for (key in _mat) {
      if (_mat[key] && _mat[key].dispose) _mat[key].dispose();
    }
    _mat = {};
  }

  return {
    init: init,
    startStageEffects: startStageEffects,
    update: update,
    clear: clear
  };
})();
