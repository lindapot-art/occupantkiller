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
  }

  return { init, spawnTracer, spawnSmoke, update, clear };
})();
