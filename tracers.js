/**
 * tracers.js – Bullet tracer lines and flying projectile smoke trails
 * Depends on: Three.js global (THREE), VoxelWorld (optional)
 */
const Tracers = (() => {
  let _scene = null;
  const tracers = [];
  const trails = [];
  const _activeIntervals = [];

  // ── Shared geometries (GPU reuse) ───────────────────────
  const _sphereGeo4 = new THREE.SphereGeometry(1, 4, 4);   // scale per-instance
  const _sphereGeo3 = new THREE.SphereGeometry(1, 3, 3);   // blood (low poly)
  const _boxGeoSpark = new THREE.BoxGeometry(0.03, 0.03, 0.08);
  const _boxGeoImpact = new THREE.BoxGeometry(1, 1, 1);    // scale per-instance
  const _planeGeoFlash = new THREE.PlaneGeometry(1, 1);     // scale per-instance
  const _ringGeoShock = new THREE.RingGeometry(0.1, 0.3, 16);
  const _sphereGeoFire = new THREE.SphereGeometry(1, 4, 4); // fire, scale per-instance

  // ── Pre-allocated tracer buffer ─────────────────────────
  const _tracerPositions = new Float32Array(6);
  const _tTmp = new THREE.Vector3();

  function init(scene) { _scene = scene; }

  function spawnTracer(origin, direction, color, speed) {
    if (!_scene) return;
    color = color || 0xffcc44;
    speed = speed || 120;
    const len = speed * 0.07;
    // Build positions inline — no clone needed
    _tracerPositions[0] = origin.x;
    _tracerPositions[1] = origin.y;
    _tracerPositions[2] = origin.z;
    _tracerPositions[3] = origin.x + direction.x * len;
    _tracerPositions[4] = origin.y + direction.y * len;
    _tracerPositions[5] = origin.z + direction.z * len;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(_tracerPositions), 3));
    const mat = new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geom, mat);
    _scene.add(line);
    _tTmp.copy(direction);
    tracers.push({
      line: line, dir: _tTmp.clone(), speed: speed,
      life: 0.15, maxLife: 0.15,
    });
  }

  function spawnSmoke(pos) {
    if (!_scene) return;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x888888, transparent: true, opacity: 0.4,
      depthWrite: false,
    });
    const m = new THREE.Mesh(_sphereGeo4, mat);
    m.scale.setScalar(0.08);
    m.position.copy(pos);
    _scene.add(m);
    trails.push({ mesh: m, life: 0.6 });
  }

  /* ── Muzzle Flash ─────────────────────────────────────────────── */
  const flashes = [];

  function spawnMuzzleFlash(pos, dir) {
    if (!_scene) return;
    var flashSize = 0.5 + Math.random() * 0.2;
    var flashColor = Math.random() < 0.5 ? 0xffdd44 : 0xffaa22;
    var flashMat = new THREE.MeshBasicMaterial({
      color: flashColor, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    var flash = new THREE.Mesh(_planeGeoFlash, flashMat);
    flash.scale.setScalar(flashSize);
    flash.position.copy(pos).addScaledVector(dir, 0.5);
    _tTmp.copy(pos).add(dir);
    flash.lookAt(_tTmp);
    flash.rotation.z = Math.random() * Math.PI;
    _scene.add(flash);
    // Second perpendicular plane (cross-billboard)
    var flash2 = flash.clone();
    flash2.rotation.z += Math.PI * 0.5;
    _scene.add(flash2);
    // Point light for illumination
    var light = new THREE.PointLight(0xffaa22, 3, 8);
    light.position.copy(flash.position);
    _scene.add(light);
    flashes.push({ mesh: flash, light: light, life: 0.08 });
    flashes.push({ mesh: flash2, light: null, life: 0.08 });
  }

  /* ── Explosion Particles ────────────────────────────────────── */
  const explosionParts = [];

  function spawnExplosion(pos, radius) {
    if (!_scene) return;
    radius = radius || 3;
    const count = 12 + Math.floor(radius * 3);
    for (let i = 0; i < count; i++) {
      const size = 0.15 + Math.random() * 0.25;
      const isFire = Math.random() < 0.6;
      const mat = new THREE.MeshBasicMaterial({
        color: isFire ? (Math.random() < 0.5 ? 0xff6600 : 0xffaa00) : 0x444444,
        transparent: true, opacity: 0.85,
        blending: isFire ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(_sphereGeo4, mat);
      mesh.scale.setScalar(size);
      mesh.position.copy(pos);
      _scene.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * radius * 2,
        Math.random() * radius * 1.5 + 1,
        (Math.random() - 0.5) * radius * 2
      );
      explosionParts.push({
        mesh: mesh, vel: vel,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.4 + Math.random() * 0.5,
        isFire: isFire, _baseSize: size,
      });
    }
    // Central flash light
    const light = new THREE.PointLight(0xff6600, 5, radius * 4);
    light.position.copy(pos);
    _scene.add(light);
    flashes.push({ mesh: null, light: light, life: 0.2 });
    // Shake camera
    if (typeof CameraSystem !== 'undefined' && CameraSystem.shake) {
      CameraSystem.shake(radius * 0.06, 0.4);
    }
    // Shockwave ring (render-loop driven, not setInterval)
    spawnShockwave(pos, radius * 2.5, 0xffaa44);
  }

  /* ── Blood Splatter ─────────────────────────────────────────── */
  function spawnBlood(pos) {
    if (!_scene) return;
    var count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      var size = 0.06 + Math.random() * 0.06;
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xcc0000 : 0x880000,
        transparent: true, opacity: 0.85, depthWrite: false,
      });
      const mesh = new THREE.Mesh(_sphereGeo3, mat);
      mesh.scale.setScalar(size);
      mesh.position.copy(pos);
      _scene.add(mesh);
      var _bSize = size;
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );
      explosionParts.push({
        mesh: mesh, vel: vel,
        life: 0.6 + Math.random() * 0.6,
        maxLife: 1.0, isFire: false, _baseSize: _bSize,
      });
    }
  }

  function update(delta) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= delta;
      // Move the line forward
      const positions = t.line.geometry.attributes.position.array;
      for (let j = 0; j < 6; j += 3) {
        positions[j]     += t.dir.x * t.speed * delta;
        positions[j + 1] += t.dir.y * t.speed * delta;
        positions[j + 2] += t.dir.z * t.speed * delta;
      }
      t.line.geometry.attributes.position.needsUpdate = true;
      t.line.material.opacity = Math.max(0, t.life / t.maxLife * 0.8);
      if (t.life <= 0) {
        _scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        tracers.splice(i, 1);
      }
    }
    for (let i = trails.length - 1; i >= 0; i--) {
      const s = trails[i];
      s.life -= delta;
      s.mesh.material.opacity = Math.max(0, s.life / 0.6 * 0.4);
      s.mesh.scale.setScalar(0.08 * (1 + (0.6 - s.life) * 2));
      if (s.life <= 0) {
        _scene.remove(s.mesh);
        s.mesh.material.dispose();
        trails.splice(i, 1);
      }
    }
    // Update muzzle flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= delta;
      if (f.life <= 0) {
        if (f.mesh) { _scene.remove(f.mesh); f.mesh.material.dispose(); }
        if (f.light) { _scene.remove(f.light); f.light.dispose(); }
        flashes.splice(i, 1);
      } else {
        if (f.mesh) f.mesh.material.opacity = f.life / 0.06;
        if (f.light) f.light.intensity = f.life / 0.06 * 2;
      }
    }
    // Update explosion particles
    for (let i = explosionParts.length - 1; i >= 0; i--) {
      const p = explosionParts[i];
      p.life -= delta;
      p.vel.y -= 9.8 * delta; // gravity
      p.mesh.position.addScaledVector(p.vel, delta);
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife * 0.85);
      if (!p.isFire) p.mesh.scale.setScalar((p._baseSize || 0.2) * (1 + (p.maxLife - p.life) * 1.5));
      if (p.life <= 0) {
        _scene.remove(p.mesh);
        p.mesh.material.dispose();
        explosionParts.splice(i, 1);
      }
    }
  }

  function clear() {
    for (const t of tracers) {
      _scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
    }
    tracers.length = 0;
    for (const s of trails) {
      _scene.remove(s.mesh);
      s.mesh.material.dispose();
    }
    trails.length = 0;
    for (const f of flashes) {
      if (f.mesh) { _scene.remove(f.mesh); f.mesh.material.dispose(); }
      if (f.light) { _scene.remove(f.light); f.light.dispose(); }
    }
    flashes.length = 0;
    for (const p of explosionParts) {
      _scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    explosionParts.length = 0;
    for (var ii = 0; ii < _activeIntervals.length; ii++) clearInterval(_activeIntervals[ii]);
    _activeIntervals.length = 0;
  }

  /* ── Block Impact Particles (terrain hit) ─────────────────── */
  function spawnBlockImpact(pos, color) {
    if (!_scene) return;
    var impactColor = color || 0x8B7355;
    for (var i = 0; i < 5; i++) {
      var size = 0.05 + Math.random() * 0.08;
      var mat = new THREE.MeshLambertMaterial({ color: impactColor });
      var mesh = new THREE.Mesh(_boxGeoImpact, mat);
      mesh.scale.setScalar(size);
      mesh.position.copy(pos);
      _scene.add(mesh);
      var _bSize = size;
      var vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2.5 + 0.5,
        (Math.random() - 0.5) * 3
      );
      explosionParts.push({
        mesh: mesh, vel: vel,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8, isFire: false, _baseSize: _bSize,
      });
    }
  }

  // ── Shell casing ejection ────────────────────────────────
  const _casingGeo = new THREE.BoxGeometry(0.02, 0.012, 0.04);
  const _casingMat = new THREE.MeshLambertMaterial({ color: 0xccaa44, emissive: 0x554400 });
  const casings = [];

  const _casingTmpPos = new THREE.Vector3();
  const _casingRight = new THREE.Vector3();
  const _casingUp = new THREE.Vector3(0, 1, 0);
  const _casingVel = new THREE.Vector3();

  function spawnCasing(camera) {
    if (!_scene || !camera) return;
    const mesh = new THREE.Mesh(_casingGeo, _casingMat);
    camera.getWorldPosition(_casingTmpPos);
    _casingRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    mesh.position.copy(_casingTmpPos).addScaledVector(_casingRight, 0.15).addScaledVector(_casingUp, -0.05);
    _scene.add(mesh);
    // Eject right + up + slight random
    const vel = new THREE.Vector3(
      _casingRight.x * (2 + Math.random()) + _casingUp.x * (1.5 + Math.random()) + (Math.random()-0.5)*0.5,
      _casingRight.y * (2 + Math.random()) + _casingUp.y * (1.5 + Math.random()),
      _casingRight.z * (2 + Math.random()) + _casingUp.z * (1.5 + Math.random()) + (Math.random()-0.5)*0.5
    );
    casings.push({
      mesh: mesh, vel: vel,
      spin: new THREE.Vector3(Math.random()*15, Math.random()*15, Math.random()*15),
      life: 1.0,
    });
  }

  // Metal impact sparks
  const sparks = [];
  function spawnSparks(pos) {
    if (!_scene) return;
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffdd44, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const m = new THREE.Mesh(_boxGeoSpark, mat);
      m.position.copy(pos);
      _scene.add(m);
      sparks.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random()-0.5)*8, Math.random()*6+2, (Math.random()-0.5)*8),
        life: 0.2 + Math.random() * 0.15,
      });
    }
  }

  function updateSparks(delta) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vel.y -= 15 * delta;
      s.mesh.position.addScaledVector(s.vel, delta);
      s.life -= delta;
      s.mesh.material.opacity = Math.max(0, s.life / 0.35);
      if (s.life <= 0) {
        _scene.remove(s.mesh);
        sparks.splice(i, 1);
      }
    }
  }

  function updateCasings(delta) {
    for (let i = casings.length - 1; i >= 0; i--) {
      const c = casings[i];
      c.vel.y -= 12 * delta; // gravity
      c.mesh.position.addScaledVector(c.vel, delta);
      c.mesh.rotation.x += c.spin.x * delta;
      c.mesh.rotation.y += c.spin.y * delta;
      c.mesh.rotation.z += c.spin.z * delta;
      c.life -= delta;
      if (c.life <= 0.3) c.mesh.material.opacity = c.life / 0.3;
      if (c.life <= 0) {
        _scene.remove(c.mesh);
        casings.splice(i, 1);
      }
    }
  }

  // ── Bullet hole decals ───────────────────────────────────
  const _bulletHoles = [];
  const _holeGeo = new THREE.PlaneGeometry(0.18, 0.18);
  const _holeMat = new THREE.MeshBasicMaterial({
    color: 0x111111, transparent: true, opacity: 0.7,
    depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1
  });
  var MAX_HOLES = 60;
  function spawnBulletHole(pos, normal) {
    if (!_scene) return;
    var mesh = new THREE.Mesh(_holeGeo, _holeMat.clone());
    mesh.position.copy(pos);
    // Offset slightly along normal to prevent z-fighting
    mesh.position.addScaledVector(normal, 0.02);
    mesh.lookAt(pos.x + normal.x, pos.y + normal.y, pos.z + normal.z);
    _scene.add(mesh);
    _bulletHoles.push({ mesh: mesh, life: 8.0 });
    // Cap max decals
    if (_bulletHoles.length > MAX_HOLES) {
      var old = _bulletHoles.shift();
      _scene.remove(old.mesh);
      old.mesh.material.dispose();
    }
  }
  function updateBulletHoles(delta) {
    for (var i = _bulletHoles.length - 1; i >= 0; i--) {
      var h = _bulletHoles[i];
      h.life -= delta;
      if (h.life < 2) h.mesh.material.opacity = h.life / 2 * 0.7;
      if (h.life <= 0) {
        _scene.remove(h.mesh);
        h.mesh.material.dispose();
        _bulletHoles.splice(i, 1);
      }
    }
  }

  // ── Rain particle system ─────────────────────────────────
  let _rainMesh = null;
  let _rainActive = false;
  const RAIN_COUNT = 2000;

  function startRain(scene) {
    if (_rainMesh) return;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaaaacc, size: 0.08, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    _rainMesh = new THREE.Points(geo, mat);
    (scene || _scene).add(_rainMesh);
    _rainActive = true;
  }

  function stopRain() {
    if (_rainMesh && _scene) {
      _scene.remove(_rainMesh);
      _rainMesh.geometry.dispose();
      _rainMesh = null;
    }
    _rainActive = false;
  }

  function updateRain(dt, playerPos) {
    if (!_rainMesh || !_rainActive) return;
    const pos = _rainMesh.geometry.attributes.position.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      pos[i * 3 + 1] -= 25 * dt; // fall speed
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3]     = (playerPos ? playerPos.x : 0) + (Math.random() - 0.5) * 80;
        pos[i * 3 + 1] = 35 + Math.random() * 5;
        pos[i * 3 + 2] = (playerPos ? playerPos.z : 0) + (Math.random() - 0.5) * 80;
      }
    }
    _rainMesh.geometry.attributes.position.needsUpdate = true;
    if (playerPos) _rainMesh.position.set(0, 0, 0);
  }

  // ── Shockwave ring effect ────────────────────────────────
  const _shockwaves = [];

  function spawnShockwave(pos, maxRadius, color) {
    if (!_scene) return;
    const mat = new THREE.MeshBasicMaterial({
      color: color || 0xff8800, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(_ringGeoShock, mat);
    mesh.position.copy(pos);
    mesh.rotation.x = -Math.PI / 2;
    _scene.add(mesh);
    _shockwaves.push({ mesh, life: 0.5, maxLife: 0.5, maxRadius: maxRadius || 8 });
  }

  function updateShockwaves(dt) {
    for (let i = _shockwaves.length - 1; i >= 0; i--) {
      const s = _shockwaves[i];
      s.life -= dt;
      const t = 1 - s.life / s.maxLife;
      const scale = 1 + t * s.maxRadius;
      s.mesh.scale.set(scale, scale, 1);
      s.mesh.material.opacity = (1 - t) * 0.8;
      if (s.life <= 0) {
        _scene.remove(s.mesh);
        _shockwaves.splice(i, 1);
      }
    }
  }

  // ── Fire particle effect (for flamethrower, molotov, etc) ──
  const _fireParticles = [];

  function spawnFire(pos, radius, duration) {
    if (!_scene) return;
    const count = 8;
    for (let i = 0; i < count; i++) {
      const size = 0.15 + Math.random() * 0.1;
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xff6600 : 0xffaa00,
        transparent: true, opacity: 0.7, depthWrite: false,
      });
      const mesh = new THREE.Mesh(_sphereGeoFire, mat);
      mesh.scale.setScalar(size);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * (radius || 2),
        pos.y + Math.random() * 1.5,
        pos.z + (Math.random() - 0.5) * (radius || 2)
      );
      _scene.add(mesh);
      _fireParticles.push({
        mesh, life: (duration || 2) + Math.random(),
        vx: (Math.random() - 0.5) * 0.5,
        vy: 1 + Math.random(),
        vz: (Math.random() - 0.5) * 0.5,
      });
    }
  }

  function updateFire(dt) {
    for (let i = _fireParticles.length - 1; i >= 0; i--) {
      const p = _fireParticles[i];
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.material.opacity = Math.max(0, p.life * 0.35);
      p.mesh.scale.multiplyScalar(1 - dt * 0.5);
      if (p.life <= 0) {
        _scene.remove(p.mesh);
        p.mesh.material.dispose();
        _fireParticles.splice(i, 1);
      }
    }
  }

  return {
    init, spawnTracer, spawnSmoke, spawnMuzzleFlash, spawnExplosion, spawnBlood,
    spawnBlockImpact, spawnCasing, spawnSparks, spawnBulletHole,
    spawnShockwave, spawnFire,
    startRain, stopRain,
    update: function(delta, playerPos) {
      update(delta);
      updateCasings(delta);
      updateSparks(delta);
      updateBulletHoles(delta);
      updateShockwaves(delta);
      updateFire(delta);
      updateRain(delta, playerPos);
    },
    clear: function() {
      clear();
      stopRain();
      _shockwaves.forEach(s => { if (_scene) _scene.remove(s.mesh); s.mesh.material.dispose(); });
      _shockwaves.length = 0;
      _fireParticles.forEach(f => { if (_scene) _scene.remove(f.mesh); f.mesh.material.dispose(); });
      _fireParticles.length = 0;
      // Clean casings, sparks, bullet holes (GPU leak fix)
      casings.forEach(c => { if (_scene) _scene.remove(c.mesh); });
      casings.length = 0;
      sparks.forEach(s => { if (_scene) _scene.remove(s.mesh); s.mesh.material.dispose(); });
      sparks.length = 0;
      _bulletHoles.forEach(h => { if (_scene) _scene.remove(h.mesh); h.mesh.material.dispose(); });
      _bulletHoles.length = 0;
    }
  };
})();
