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
  const _tracerPool = [];  // recycled tracer line objects

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
    // Reuse pooled tracer or create new one
    var entry;
    if (_tracerPool.length > 0) {
      entry = _tracerPool.pop();
      var posArr = entry.line.geometry.attributes.position.array;
      posArr[0] = _tracerPositions[0]; posArr[1] = _tracerPositions[1]; posArr[2] = _tracerPositions[2];
      posArr[3] = _tracerPositions[3]; posArr[4] = _tracerPositions[4]; posArr[5] = _tracerPositions[5];
      entry.line.geometry.attributes.position.needsUpdate = true;
      entry.line.material.color.set(color);
      entry.line.material.opacity = 0.8;
      entry.line.visible = true;
      _scene.add(entry.line);
    } else {
      var geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(_tracerPositions), 3));
      var mat = new THREE.LineBasicMaterial({
        color: color, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      entry = { line: new THREE.Line(geom, mat) };
      _scene.add(entry.line);
    }
    entry.dx = direction.x;
    entry.dy = direction.y;
    entry.dz = direction.z;
    entry.speed = speed;
    entry.life = 0.15;
    entry.maxLife = 0.15;
    tracers.push(entry);
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
    // 20% of previous size — was 0.5..0.7, now 0.10..0.14 to stop blocking the player view
    var flashSize = 0.10 + Math.random() * 0.04;
    var flashColor = Math.random() < 0.5 ? 0xffdd44 : 0xffaa22;
    var flashMat = new THREE.MeshBasicMaterial({
      color: flashColor, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    var flash = new THREE.Mesh(_planeGeoFlash, flashMat);
    flash.scale.setScalar(flashSize);
    // Move flash slightly further from origin so the small puff still reads at distance
    flash.position.copy(pos).addScaledVector(dir, 0.35);
    _tTmp.copy(pos).add(dir);
    flash.lookAt(_tTmp);
    flash.rotation.z = Math.random() * Math.PI;
    _scene.add(flash);
    // Single billboard now (cross-billboard removed; doubled the visual mass with no readability gain)
    // Dim point light for illumination — was intensity 3, range 8
    var light = new THREE.PointLight(0xffaa22, 1.2, 4);
    light.position.copy(flash.position);
    _scene.add(light);
    flashes.push({ mesh: flash, light: light, life: 0.14 });
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
    // Shake camera — falls off with distance from player so distant booms feel distant
    if (typeof CameraSystem !== 'undefined' && CameraSystem.shake) {
      var _shakeAmt = radius * 0.06;
      try {
        if (typeof GameManager !== 'undefined' && GameManager.getPlayer) {
          var _pp = GameManager.getPlayer();
          if (_pp && _pp.position) {
            var _ddx = pos.x - _pp.position.x;
            var _ddy = (pos.y || 0) - _pp.position.y;
            var _ddz = pos.z - _pp.position.z;
            var _dD = Math.sqrt(_ddx*_ddx + _ddy*_ddy + _ddz*_ddz);
            // Falloff: full strength <8m, zero past 60m
            var _fall = Math.max(0, 1 - Math.max(0, _dD - 8) / 52);
            _shakeAmt *= _fall;
          }
        }
      } catch (eS) {}
      if (_shakeAmt > 0.001) CameraSystem.shake(_shakeAmt, 0.4);
    }
    // Shockwave ring (render-loop driven, not setInterval)
    spawnShockwave(pos, radius * 2.5, 0xffaa44);
    // Lingering smoke pillar — rises from explosion site for ~1.5s
    try {
      var smokeBase = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z);
      _smokePillars.push({ base: smokeBase, radius: radius, age: 0, dur: 1.5 });
    } catch (eSp) {}
    // Persistent scorch mark on the ground beneath explosion
    try {
      var groundY = pos.y;
      if (typeof window !== 'undefined' && window.VoxelWorld && window.VoxelWorld.getTerrainHeight) {
        groundY = window.VoxelWorld.getTerrainHeight(pos.x, pos.z) + 0.04;
      }
      var scorchMat = new THREE.MeshBasicMaterial({
        color: 0x111111, transparent: true, opacity: 0.75,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
      });
      var scorch = new THREE.Mesh(_scorchGeo, scorchMat);
      scorch.rotation.x = -Math.PI / 2;
      scorch.position.set(pos.x, groundY, pos.z);
      var sScale = (radius || 3) * 0.7;
      scorch.scale.set(sScale, sScale, 1);
      _scene.add(scorch);
      _scorchMarks.push({ mesh: scorch, mat: scorchMat, life: 25, maxLife: 25 });
      if (_scorchMarks.length > MAX_SCORCH) {
        var oldS = _scorchMarks.shift();
        _scene.remove(oldS.mesh); oldS.mat.dispose();
      }
    } catch (eSc) {}
  }

  /* ── Blood Splatter ─────────────────────────────────────────── */
  // Directional exit-wound spray. dir is optional bullet travel direction (Vector3).
  function spawnBlood(pos, dir) {
    if (!_scene) return;
    var count = 8 + Math.floor(Math.random() * 5);
    var hasDir = !!(dir && typeof dir.x === 'number');
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
      var vel;
      if (hasDir) {
        // Bias the spurt along bullet direction (exit wound) with some scatter
        var biasX = dir.x * (3 + Math.random() * 3);
        var biasY = (dir.y || 0) * (2 + Math.random() * 2) + Math.random() * 2 + 0.5;
        var biasZ = dir.z * (3 + Math.random() * 3);
        vel = new THREE.Vector3(
          biasX + (Math.random() - 0.5) * 2.5,
          biasY,
          biasZ + (Math.random() - 0.5) * 2.5
        );
      } else {
        vel = new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 4
        );
      }
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
      const dx = t.dx * t.speed * delta;
      const dy = t.dy * t.speed * delta;
      const dz = t.dz * t.speed * delta;
      positions[0] += dx; positions[1] += dy; positions[2] += dz;
      positions[3] += dx; positions[4] += dy; positions[5] += dz;
      t.line.geometry.attributes.position.needsUpdate = true;
      t.line.material.opacity = Math.max(0, t.life / t.maxLife * 0.8);
      if (t.life <= 0) {
        _scene.remove(t.line);
        t.line.visible = false;
        if (_tracerPool.length < 50) {
          _tracerPool.push(t);
        } else {
          t.line.geometry.dispose();
          t.line.material.dispose();
        }
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
    // Drain pool
    for (const p of _tracerPool) {
      p.line.geometry.dispose();
      p.line.material.dispose();
    }
    _tracerPool.length = 0;
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
      life: 6.0, settled: false,
    });
    // Cap casing count for perf
    if (casings.length > 80) {
      var oldC = casings.shift();
      if (oldC && oldC.mesh && _scene) _scene.remove(oldC.mesh);
    }
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

  // Pickup burst — coloured ascending particles to celebrate item collection
  function spawnPickupBurst(pos, color) {
    if (!_scene) return;
    var col = color || 0xffffff;
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const m = new THREE.Mesh(_boxGeoSpark, mat);
      m.position.copy(pos);
      _scene.add(m);
      sparks.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random()-0.5)*5, Math.random()*5+3, (Math.random()-0.5)*5),
        life: 0.5 + Math.random() * 0.3,
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
        s.mesh.material.dispose();
        sparks.splice(i, 1);
      }
    }
  }

  function updateCasings(delta) {
    for (let i = casings.length - 1; i >= 0; i--) {
      const c = casings[i];
      if (!c.settled) {
        c.vel.y -= 12 * delta; // gravity
        c.mesh.position.addScaledVector(c.vel, delta);
        c.mesh.rotation.x += c.spin.x * delta;
        c.mesh.rotation.y += c.spin.y * delta;
        c.mesh.rotation.z += c.spin.z * delta;
        // Settle when ground reached and velocity low
        var groundY = 0;
        if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTerrainHeight) {
          groundY = VoxelWorld.getTerrainHeight(c.mesh.position.x, c.mesh.position.z) + 0.02;
        }
        if (c.mesh.position.y <= groundY) {
          c.mesh.position.y = groundY;
          // Bounce once with damping
          if (Math.abs(c.vel.y) > 1.5) {
            c.vel.y = -c.vel.y * 0.35;
            c.vel.x *= 0.6;
            c.vel.z *= 0.6;
            c.spin.multiplyScalar(0.5);
          } else {
            c.settled = true;
            c.vel.set(0, 0, 0);
            // Lay flat on ground
            c.mesh.rotation.x = Math.PI / 2;
          }
        }
      }
      c.life -= delta;
      if (c.life <= 0) {
        _scene.remove(c.mesh);
        casings.splice(i, 1);
      }
    }
  }

  // ── Bullet hole decals ───────────────────────────────────
  const _bulletHoles = [];
  const _holeGeo = new THREE.PlaneGeometry(0.18, 0.18);
  const _scorchMarks = [];
  const _scorchGeo = new THREE.PlaneGeometry(1, 1);
  var MAX_SCORCH = 40;
  const _smokePillars = [];
  const _holeMat = new THREE.MeshBasicMaterial({
    color: 0x111111, transparent: true, opacity: 0.7,
    depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1
  });
  var MAX_HOLES = 120;
  // Surface type → impact color for bullet holes
  const _surfaceColors = {
    5:  0xC0C0C0,  // METAL → bright silver
    9:  0x888888,  // CONCRETE → gray dust
    10: 0x8B3020,  // BRICK → reddish
    4:  0x8B6914,  // WOOD → brown splinters
    11: 0xCCEEFF,  // GLASS → blue-white
    3:  0x666666,  // STONE → dark gray
    7:  0xD4B896,  // SAND → tan
    1:  0x6B4410,  // DIRT → dark brown
    14: 0x404850,  // REINFORCED → dark steel
  };
  function spawnBulletHole(pos, normal, surfaceType) {
    if (!_scene) return;
    var holeColor = _surfaceColors[surfaceType] || 0x111111;
    var mat = _holeMat.clone();
    mat.color.set(holeColor);
    var mesh = new THREE.Mesh(_holeGeo, mat);
    mesh.position.copy(pos);
    // Offset slightly along normal to prevent z-fighting
    mesh.position.addScaledVector(normal, 0.02);
    mesh.lookAt(pos.x + normal.x, pos.y + normal.y, pos.z + normal.z);
    _scene.add(mesh);
    _bulletHoles.push({ mesh: mesh, life: 20.0 });
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
      if (h.life < 4) h.mesh.material.opacity = h.life / 4 * 0.7;
      if (h.life <= 0) {
        _scene.remove(h.mesh);
        h.mesh.material.dispose();
        _bulletHoles.splice(i, 1);
      }
    }
  }
  function updateScorchMarks(delta) {
    for (var i = _scorchMarks.length - 1; i >= 0; i--) {
      var s = _scorchMarks[i];
      s.life -= delta;
      if (s.life < 5) s.mat.opacity = (s.life / 5) * 0.75;
      if (s.life <= 0) {
        if (_scene) _scene.remove(s.mesh);
        s.mat.dispose();
        _scorchMarks.splice(i, 1);
      }
    }
  }
  function updateSmokePillars(delta) {
    for (var i = _smokePillars.length - 1; i >= 0; i--) {
      var sp = _smokePillars[i];
      sp.age += delta;
      // Spawn smoke puffs every ~80ms, rising and drifting
      sp._next = (sp._next || 0) - delta;
      if (sp._next <= 0 && sp.age < sp.dur) {
        sp._next = 0.08;
        var puffPos = sp.base.clone();
        puffPos.x += (Math.random() - 0.5) * sp.radius * 0.4;
        puffPos.z += (Math.random() - 0.5) * sp.radius * 0.4;
        puffPos.y += sp.age * 2.5; // rises
        if (typeof spawnSmoke === 'function') spawnSmoke(puffPos);
      }
      if (sp.age >= sp.dur) _smokePillars.splice(i, 1);
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
      _rainMesh.material.dispose();
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
        s.mesh.material.dispose();
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

  /* ── Bullet Projectiles (fast visible particles) ──────────── */
  const bullets = [];
  const _bulletPool = [];
  const MAX_BULLETS = 120;
  // Stretched sphere reused for every bullet (streak look via scale.z)
  const _bulletGeo = new THREE.SphereGeometry(1, 5, 4);

  function spawnBullet(origin, direction, color, speed) {
    if (!_scene || !origin || !direction) return;
    color = (color === undefined || color === null) ? 0xffee66 : color;
    speed = speed || 180;
    var entry;
    if (_bulletPool.length > 0) {
      entry = _bulletPool.pop();
      entry.core.material.color.setHex(color);
      entry.core.material.opacity = 1.0;
      entry.glow.material.color.setHex(color);
      entry.glow.material.opacity = 0.55;
      entry.core.visible = true;
      entry.glow.visible = true;
      _scene.add(entry.core);
      _scene.add(entry.glow);
    } else {
      var coreMat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 1.0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      var glowMat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      var core = new THREE.Mesh(_bulletGeo, coreMat);
      var glow = new THREE.Mesh(_bulletGeo, glowMat);
      _scene.add(core);
      _scene.add(glow);
      entry = { core: core, glow: glow };
    }
    // Start a touch in front of origin so it doesn't clip the muzzle
    var sx = origin.x + direction.x * 0.35;
    var sy = origin.y + direction.y * 0.35;
    var sz = origin.z + direction.z * 0.35;
    entry.core.position.set(sx, sy, sz);
    entry.glow.position.set(sx, sy, sz);
    // Orient streak along travel direction
    _tTmp.set(sx + direction.x, sy + direction.y, sz + direction.z);
    entry.core.lookAt(_tTmp);
    entry.glow.lookAt(_tTmp);
    // Stretched along local Z = forward
    entry.core.scale.set(0.045, 0.045, 0.55);
    entry.glow.scale.set(0.13, 0.13, 0.85);
    entry.dx = direction.x;
    entry.dy = direction.y;
    entry.dz = direction.z;
    entry.speed = speed;
    entry.life = 0.45;
    entry.maxLife = 0.45;
    bullets.push(entry);
    if (bullets.length > MAX_BULLETS) {
      var old = bullets.shift();
      _scene.remove(old.core); _scene.remove(old.glow);
      old.core.visible = false; old.glow.visible = false;
      if (_bulletPool.length < 60) _bulletPool.push(old);
      else {
        old.core.material.dispose(); old.glow.material.dispose();
      }
    }
  }

  function updateBullets(delta) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.life -= delta;
      var step = b.speed * delta;
      b.core.position.x += b.dx * step;
      b.core.position.y += b.dy * step;
      b.core.position.z += b.dz * step;
      b.glow.position.copy(b.core.position);
      // Slight fade near end of life
      var lifeRatio = b.life / b.maxLife;
      if (lifeRatio < 0.4) {
        b.core.material.opacity = Math.max(0, lifeRatio / 0.4);
        b.glow.material.opacity = Math.max(0, lifeRatio / 0.4 * 0.55);
      }
      if (b.life <= 0) {
        _scene.remove(b.core);
        _scene.remove(b.glow);
        b.core.visible = false; b.glow.visible = false;
        if (_bulletPool.length < 60) {
          _bulletPool.push(b);
        } else {
          b.core.material.dispose();
          b.glow.material.dispose();
        }
        bullets.splice(i, 1);
      }
    }
  }

  function clearBullets() {
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      if (_scene) { _scene.remove(b.core); _scene.remove(b.glow); }
      b.core.material.dispose();
      b.glow.material.dispose();
    }
    bullets.length = 0;
    for (var j = 0; j < _bulletPool.length; j++) {
      var p = _bulletPool[j];
      p.core.material.dispose();
      p.glow.material.dispose();
    }
    _bulletPool.length = 0;
  }

  return {
    init, spawnTracer, spawnSmoke, spawnMuzzleFlash, spawnExplosion, spawnBlood,
    spawnBlockImpact, spawnCasing, spawnSparks, spawnPickupBurst, spawnBulletHole,
    spawnShockwave, spawnFire, spawnBullet,
    startRain, stopRain,
    update: function(delta, playerPos) {
      update(delta);
      updateCasings(delta);
      updateSparks(delta);
      updateBulletHoles(delta);
      updateShockwaves(delta);
      updateFire(delta);
      updateRain(delta, playerPos);
      updateScorchMarks(delta);
      updateSmokePillars(delta);
      updateBullets(delta);
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
      _scorchMarks.forEach(s => { if (_scene) _scene.remove(s.mesh); s.mat.dispose(); });
      _scorchMarks.length = 0;
      clearBullets();
    }
  };
})();

if (typeof window !== 'undefined') window.Tracers = Tracers;
