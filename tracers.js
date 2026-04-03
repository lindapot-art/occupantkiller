/**
 * tracers.js – Bullet tracer lines and flying projectile smoke trails
 * Depends on: Three.js global (THREE), VoxelWorld (optional)
 */
const Tracers = (() => {
  let _scene = null;
  const tracers = [];
  const trails = [];

  function init(scene) { _scene = scene; }

  function spawnTracer(origin, direction, color, speed) {
    if (!_scene) return;
    color = color || 0xffcc44;
    speed = speed || 120;
    const len = speed * 0.07;
    const end = origin.clone().addScaledVector(direction, len);
    const geom = new THREE.BufferGeometry().setFromPoints([origin.clone(), end]);
    const mat = new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geom, mat);
    _scene.add(line);
    tracers.push({
      line: line, dir: direction.clone(), speed: speed,
      life: 0.15, maxLife: 0.15,
    });
  }

  function spawnSmoke(pos) {
    if (!_scene) return;
    const geo = new THREE.SphereGeometry(0.08, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x888888, transparent: true, opacity: 0.4,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    _scene.add(m);
    trails.push({ mesh: m, life: 0.6 });
  }

  /* ── Muzzle Flash ─────────────────────────────────────────────── */
  const flashes = [];

  function spawnMuzzleFlash(pos, dir) {
    if (!_scene) return;
    const flashGeo = new THREE.PlaneGeometry(0.4, 0.4);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffdd44, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(pos).addScaledVector(dir, 0.5);
    flash.lookAt(pos.clone().add(dir));
    flash.rotation.z = Math.random() * Math.PI;
    _scene.add(flash);
    // Point light for illumination
    const light = new THREE.PointLight(0xffaa22, 2, 6);
    light.position.copy(flash.position);
    _scene.add(light);
    flashes.push({ mesh: flash, light: light, life: 0.06 });
  }

  /* ── Explosion Particles ────────────────────────────────────── */
  const explosionParts = [];

  function spawnExplosion(pos, radius) {
    if (!_scene) return;
    radius = radius || 3;
    const count = 12 + Math.floor(radius * 3);
    for (let i = 0; i < count; i++) {
      const size = 0.15 + Math.random() * 0.25;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const isFire = Math.random() < 0.6;
      const mat = new THREE.MeshBasicMaterial({
        color: isFire ? (Math.random() < 0.5 ? 0xff6600 : 0xffaa00) : 0x444444,
        transparent: true, opacity: 0.85,
        blending: isFire ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
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
        isFire: isFire,
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
  }

  /* ── Blood Splatter ─────────────────────────────────────────── */
  function spawnBlood(pos) {
    if (!_scene) return;
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 3, 3);
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xcc0000 : 0x880000,
        transparent: true, opacity: 0.8, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      _scene.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 2 + 0.5,
        (Math.random() - 0.5) * 3
      );
      explosionParts.push({
        mesh: mesh, vel: vel,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.5, isFire: false,
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
      s.mesh.scale.setScalar(1 + (0.6 - s.life) * 2);
      if (s.life <= 0) {
        _scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        trails.splice(i, 1);
      }
    }
    // Update muzzle flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= delta;
      if (f.life <= 0) {
        if (f.mesh) { _scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); }
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
      if (!p.isFire) p.mesh.scale.setScalar(1 + (p.maxLife - p.life) * 1.5);
      if (p.life <= 0) {
        _scene.remove(p.mesh);
        p.mesh.geometry.dispose();
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
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    }
    trails.length = 0;
    for (const f of flashes) {
      if (f.mesh) { _scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); }
      if (f.light) { _scene.remove(f.light); f.light.dispose(); }
    }
    flashes.length = 0;
    for (const p of explosionParts) {
      _scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    explosionParts.length = 0;
  }

  return { init, spawnTracer, spawnSmoke, spawnMuzzleFlash, spawnExplosion, spawnBlood, update, clear };
})();
