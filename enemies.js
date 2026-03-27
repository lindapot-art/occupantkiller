/**
 * enemies.js – Occupant spawning, AI, and hit detection
 * Depends on: Three.js global (THREE), HUD
 */

const Enemies = (() => {
  // ── Enemy config ──────────────────────────────────────────
  const BASE_HP      = 60;
  const BASE_SPEED   = 2.2;
  const ATTACK_RANGE = 1.6;   // distance at which enemy melee-attacks player
  const ATTACK_DMG   = 8;
  const ATTACK_RATE  = 1.2;   // seconds between attacks

  const BODY_COLOR   = 0xcc2222;
  const HEAD_COLOR   = 0xffccaa;
  const LIMB_COLOR   = 0x992222;

  // ── Internal state ────────────────────────────────────────
  let scene       = null;
  let enemies     = [];         // array of enemy objects
  let wave        = 1;
  let waveEnemies = 0;
  let spawnQueue  = 0;
  let spawnTimer  = 0;
  let allDead     = false;

  // ── Arena bounds for spawning ─────────────────────────────
  const ARENA_SIZE = 24;

  // ── Build a simple humanoid mesh ──────────────────────────
  function buildMesh() {
    const group = new THREE.Group();

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.7, 0.26),
      new THREE.MeshLambertMaterial({ color: BODY_COLOR })
    );
    torso.position.y = 0.85;

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.34),
      new THREE.MeshLambertMaterial({ color: HEAD_COLOR })
    );
    head.position.y = 1.4;

    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.55, 0.21),
      new THREE.MeshLambertMaterial({ color: LIMB_COLOR })
    );
    legL.position.set(-0.14, 0.28, 0);

    const legR = legL.clone();
    legR.position.set(0.14, 0.28, 0);

    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.52, 0.18),
      new THREE.MeshLambertMaterial({ color: LIMB_COLOR })
    );
    armL.position.set(-0.35, 0.82, 0);

    const armR = armL.clone();
    armR.position.set(0.35, 0.82, 0);

    group.add(torso, head, legL, legR, armL, armR);

    // Eye glow
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eyeL   = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08, 1.42, 0.18);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.08, 1.42, 0.18);
    group.add(eyeL, eyeR);

    // Collision helper (invisible bounding box approximation)
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.65, 0.4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 0.82;
    group.add(hitbox);

    group.userData.hitbox = hitbox;
    group.userData.parts  = [torso, head, legL, legR, armL, armR, hitbox];

    return group;
  }

  // ── Spawn one enemy at a random arena perimeter position ──
  function spawnOne(hpMultiplier, speedMultiplier) {
    const angle = Math.random() * Math.PI * 2;
    const r     = ARENA_SIZE * 0.46 + Math.random() * 4;
    const x     = Math.cos(angle) * r;
    const z     = Math.sin(angle) * r;

    const mesh  = buildMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);

    const enemy = {
      mesh,
      hp:           BASE_HP * hpMultiplier,
      maxHp:        BASE_HP * hpMultiplier,
      speed:        BASE_SPEED * speedMultiplier,
      attackTimer:  Math.random() * ATTACK_RATE,
      alive:        true,
      legAngle:     0,
      legDir:       1,
      deathTimer:   0,
    };
    enemies.push(enemy);
    return enemy;
  }

  // ── Initialise a wave ─────────────────────────────────────
  function startWave(w, sc) {
    wave        = w;
    scene       = sc;
    enemies     = [];
    allDead     = false;

    // Scale up difficulty each wave
    waveEnemies = 4 + (w - 1) * 2;   // 4, 6, 8, 10 …
    spawnQueue  = waveEnemies;
    spawnTimer  = 0;
  }

  // ── Per-frame update ──────────────────────────────────────
  function update(delta, playerPos, onPlayerHit, onEnemyDied) {
    // Spawn from queue
    if (spawnQueue > 0) {
      spawnTimer -= delta;
      if (spawnTimer <= 0) {
        const hpMult    = 1 + (wave - 1) * 0.25;
        const speedMult = 1 + (wave - 1) * 0.08;
        spawnOne(hpMult, speedMult);
        spawnQueue--;
        spawnTimer = 0.5 + Math.random() * 0.8;
      }
    }

    let alive = 0;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (!e.alive) {
        // Sink corpse into ground then remove
        e.deathTimer -= delta;
        e.mesh.position.y -= delta * 1.2;
        if (e.deathTimer <= 0) {
          scene.remove(e.mesh);
          enemies.splice(i, 1);
        }
        continue;
      }

      alive++;

      // Walk toward player
      const dir = new THREE.Vector3()
        .subVectors(playerPos, e.mesh.position)
        .setY(0);
      const dist = dir.length();

      if (dist > 0.1) {
        dir.normalize();
        e.mesh.position.addScaledVector(dir, e.speed * delta);
        e.mesh.lookAt(playerPos.x, e.mesh.position.y, playerPos.z);

        // Leg animation
        e.legAngle += e.legDir * 4 * delta;
        if (Math.abs(e.legAngle) > 0.45) e.legDir *= -1;
        const parts = e.mesh.userData.parts;
        if (parts[2]) parts[2].rotation.x =  e.legAngle;
        if (parts[3]) parts[3].rotation.x = -e.legAngle;
      }

      // Attack player
      if (dist < ATTACK_RANGE) {
        e.attackTimer -= delta;
        if (e.attackTimer <= 0) {
          onPlayerHit(ATTACK_DMG);
          e.attackTimer = ATTACK_RATE;
        }
      }
    }

    // Check if wave is done (all spawned and all dead)
    if (spawnQueue === 0 && alive === 0 && enemies.length === 0 && !allDead) {
      allDead = true;
      onEnemyDied(true);  // "wave complete" signal
    }
  }

  // ── Take damage (returns remaining hp) ────────────────────
  function damage(enemy, amount) {
    if (!enemy.alive) return 0;
    enemy.hp -= amount;
    // Flash red
    enemy.mesh.userData.parts.forEach(p => {
      if (p.material && p.material.visible !== false) {
        const orig = p.material.color.getHex();
        p.material.color.setHex(0xffffff);
        setTimeout(() => p.material.color.setHex(orig), 80);
      }
    });
    if (enemy.hp <= 0) {
      enemy.alive     = false;
      enemy.deathTimer = 0.6;
    }
    return Math.max(0, enemy.hp);
  }

  // ── Find enemy by hit mesh (walk up the hierarchy) ────────
  function findByMesh(mesh) {
    let obj = mesh;
    while (obj) {
      const found = enemies.find(e => e.mesh === obj);
      if (found) return found;
      obj = obj.parent;
    }
    return null;
  }

  function getEnemyMeshes() {
    return enemies.filter(e => e.alive).flatMap(e => e.mesh.userData.parts || [e.mesh]);
  }

  function getAliveCount() {
    return enemies.filter(e => e.alive).length + spawnQueue;
  }

  function isWaveDone() { return allDead; }

  function clear() {
    enemies.forEach(e => scene && scene.remove(e.mesh));
    enemies     = [];
    spawnQueue  = 0;
  }

  return {
    startWave,
    update,
    damage,
    findByMesh,
    getEnemyMeshes,
    getAliveCount,
    isWaveDone,
    clear,
  };
})();
