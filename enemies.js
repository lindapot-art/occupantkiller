/**
 * enemies.js – Occupant spawning, AI, floating HP bars, and hit detection
 * Level 1 "ZOMBIELAND" – based on Avdiivka assault waves.
 * Three enemy types: CONSCRIPT (cannon fodder), STORMER (rusher), ARMORED (heavy)
 * Depends on: Three.js global (THREE)
 */

const Enemies = (() => {
  // ── Enemy type definitions ────────────────────────────────
  const TYPES = {
    CONSCRIPT: {
      name:        'CONSCRIPT',
      hpBase:      40,
      speedBase:   2.0,
      scale:       1.0,
      bodyColor:   0x4a5230,   // olive-drab uniform
      headColor:   0xc8a882,   // skin tone
      limbColor:   0x3a4224,   // dark olive
      helmetColor: 0x3a4020,   // steel helmet
      eyeColor:    0x880000,
      attackDmg:   8,
      attackRate:  1.2,
      scoreValue:  100,
      dropChance:  0.30,
    },
    STORMER: {
      name:        'STORMER',
      hpBase:      30,
      speedBase:   4.2,
      scale:       0.85,
      bodyColor:   0x3a4a3a,   // dark field uniform
      headColor:   0xb09070,
      limbColor:   0x2a3a2a,
      helmetColor: 0x2a3020,
      eyeColor:    0xff4400,
      attackDmg:   6,
      attackRate:  0.7,
      scoreValue:  150,
      dropChance:  0.20,
    },
    ARMORED: {
      name:        'ARMORED',
      hpBase:      220,
      speedBase:   1.0,
      scale:       1.4,
      bodyColor:   0x3a4a3a,   // heavy armored vest
      headColor:   0xd0b090,
      limbColor:   0x2a3820,
      helmetColor: 0x1a2010,
      eyeColor:    0xff0000,
      attackDmg:   22,
      attackRate:  1.8,
      scoreValue:  350,
      dropChance:  0.85,
    },
  };

  // ── Internal state ────────────────────────────────────────
  let scene      = null;
  let enemies    = [];
  let wave       = 1;
  let spawnQueue = [];   // array of type-name strings
  let spawnTimer = 0;
  let allDead    = false;

  const ARENA_SIZE = 24;

  // ── Choose a type appropriate for the current wave ────────
  function pickTypeForWave(w) {
    const r = Math.random();
    if (w >= 5 && r < 0.20) return 'ARMORED';
    if (w >= 3 && r < 0.50) return 'STORMER';
    return 'CONSCRIPT';
  }

  // ── Build humanoid mesh scaled to typeCfg ─────────────────
  function buildMesh(typeCfg) {
    const group = new THREE.Group();
    const s     = typeCfg.scale;

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.52 * s, 0.7 * s, 0.26 * s),
      new THREE.MeshLambertMaterial({ color: typeCfg.bodyColor })
    );
    torso.position.y = 0.85 * s;

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.34 * s, 0.34 * s, 0.34 * s),
      new THREE.MeshLambertMaterial({ color: typeCfg.headColor })
    );
    head.position.y = 1.4 * s;

    // Steel helmet (flat-top box slightly wider than head)
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.40 * s, 0.18 * s, 0.40 * s),
      new THREE.MeshLambertMaterial({ color: typeCfg.helmetColor })
    );
    helmet.position.y = 1.55 * s;

    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.21 * s, 0.55 * s, 0.21 * s),
      new THREE.MeshLambertMaterial({ color: typeCfg.limbColor })
    );
    legL.position.set(-0.14 * s, 0.28 * s, 0);
    const legR = legL.clone();
    legR.position.set(0.14 * s, 0.28 * s, 0);

    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.18 * s, 0.52 * s, 0.18 * s),
      new THREE.MeshLambertMaterial({ color: typeCfg.limbColor })
    );
    armL.position.set(-0.35 * s, 0.82 * s, 0);
    const armR = armL.clone();
    armR.position.set(0.35 * s, 0.82 * s, 0);

    group.add(torso, head, helmet, legL, legR, armL, armR);

    // Eye glow
    const eyeGeo = new THREE.SphereGeometry(0.04 * s, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: typeCfg.eyeColor });
    const eyeL   = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08 * s, 1.42 * s, 0.18 * s);
    const eyeR = eyeL.clone();
    eyeR.position.set(0.08 * s, 1.42 * s, 0.18 * s);
    group.add(eyeL, eyeR);

    // Invisible hitbox
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.6 * s, 1.75 * s, 0.4 * s),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 0.87 * s;
    group.add(hitbox);

    group.userData.headMesh = head;
    group.userData.hitbox   = hitbox;
    group.userData.parts    = [torso, head, helmet, legL, legR, armL, armR, hitbox];

    return group;
  }

  // ── Floating HP bar (lives in scene, follows enemy) ───────
  function buildHpBar() {
    const group = new THREE.Group();

    const bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.09),
      new THREE.MeshBasicMaterial({
        color:      0x330000,
        side:       THREE.DoubleSide,
        depthTest:  false,
        depthWrite: false,
      })
    );

    const fgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.09),
      new THREE.MeshBasicMaterial({
        color:      0x44ff44,
        side:       THREE.DoubleSide,
        depthTest:  false,
        depthWrite: false,
      })
    );
    fgMesh.position.z = 0.002;

    group.add(bgMesh, fgMesh);
    scene.add(group);
    return { group, fg: fgMesh };
  }

  // ── Spawn one enemy ───────────────────────────────────────
  function spawnOne(typeName) {
    const typeCfg = TYPES[typeName] || TYPES.CONSCRIPT;

    const angle = Math.random() * Math.PI * 2;
    const r     = ARENA_SIZE * 0.46 + Math.random() * 4;
    const mesh  = buildMesh(typeCfg);
    mesh.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    scene.add(mesh);

    const waveHpBonus    = 1 + (wave - 1) * 0.22;
    const waveSpeedBonus = 1 + (wave - 1) * 0.06;
    const hp             = typeCfg.hpBase * waveHpBonus;

    enemies.push({
      mesh,
      hpBar:       buildHpBar(),
      typeCfg,
      typeName,
      hp,
      maxHp:       hp,
      speed:       typeCfg.speedBase * waveSpeedBonus,
      attackDmg:   typeCfg.attackDmg,
      attackTimer: Math.random() * typeCfg.attackRate,
      attackRate:  typeCfg.attackRate,
      scoreValue:  typeCfg.scoreValue,
      dropChance:  typeCfg.dropChance,
      alive:       true,
      flashTimer:  0,
      legAngle:    0,
      legDir:      1,
      deathTimer:  0,
    });
  }

  // ── Initialise a wave ─────────────────────────────────────
  function startWave(w, sc) {
    wave    = w;
    scene   = sc;
    enemies = [];
    allDead = false;

    // Avdiivka-style: 8 on wave 1, +3 per wave (up to ~35 on wave 10)
    const count = 8 + (w - 1) * 3;
    spawnQueue  = Array.from({ length: count }, () => pickTypeForWave(w));
    spawnTimer  = 0;
  }

  // ── Per-frame update ──────────────────────────────────────
  function update(delta, playerPos, onPlayerHit, onEnemyDied) {
    // Spawn from queue
    if (spawnQueue.length > 0) {
      spawnTimer -= delta;
      if (spawnTimer <= 0) {
        spawnOne(spawnQueue.pop());
        spawnTimer = 0.45 + Math.random() * 0.75;
      }
    }

    let alive = 0;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (!e.alive) {
        // Hide HP bar, sink corpse, then remove
        if (e.hpBar) e.hpBar.group.visible = false;
        e.deathTimer -= delta;
        e.mesh.position.y -= delta * 1.2;
        if (e.deathTimer <= 0) {
          scene.remove(e.mesh);
          if (e.hpBar) { scene.remove(e.hpBar.group); e.hpBar = null; }
          enemies.splice(i, 1);
        }
        continue;
      }

      alive++;

      // Reset hit-flash colour
      if (e.flashTimer > 0) {
        e.flashTimer -= delta;
        if (e.flashTimer <= 0) {
          e.mesh.userData.parts.forEach(p => {
            if (p.material && p.userData.origColor !== undefined) {
              p.material.color.setHex(p.userData.origColor);
            }
          });
        }
      }

      // Walk toward player
      const dir = new THREE.Vector3()
        .subVectors(playerPos, e.mesh.position)
        .setY(0);
      const dist = dir.length();

      if (dist > 0.1) {
        dir.normalize();
        e.mesh.position.addScaledVector(dir, e.speed * delta);
        e.mesh.lookAt(playerPos.x, e.mesh.position.y, playerPos.z);

        // Leg swing animation (speed-scaled)
        e.legAngle += e.legDir * (e.speed / 2.2) * 4 * delta;
        if (Math.abs(e.legAngle) > 0.45) e.legDir *= -1;
        const parts = e.mesh.userData.parts;
        if (parts[3]) parts[3].rotation.x =  e.legAngle;
        if (parts[4]) parts[4].rotation.x = -e.legAngle;
      }

      // Melee attack when close enough
      const meleeRange = 1.6 * e.typeCfg.scale;
      if (dist < meleeRange) {
        e.attackTimer -= delta;
        if (e.attackTimer <= 0) {
          onPlayerHit(e.attackDmg);
          e.attackTimer = e.attackRate;
        }
      }

      // Update floating HP bar
      if (e.hpBar) {
        const pct    = e.hp / e.maxHp;
        e.hpBar.fg.scale.x     = pct;
        e.hpBar.fg.position.x  = -0.35 * (1 - pct);   // left-anchor the fill
        const hpColor = pct > 0.6 ? 0x44ff44 : pct > 0.3 ? 0xffaa00 : 0xff2222;
        e.hpBar.fg.material.color.setHex(hpColor);

        const barY = 1.75 * e.typeCfg.scale + 0.35;
        e.hpBar.group.position.set(e.mesh.position.x, barY, e.mesh.position.z);
        e.hpBar.group.lookAt(playerPos.x, barY, playerPos.z);
      }
    }

    // Wave complete?
    if (spawnQueue.length === 0 && alive === 0 && enemies.length === 0 && !allDead) {
      allDead = true;
      onEnemyDied(true);
    }
  }

  // ── Apply damage, return remaining HP ─────────────────────
  function damage(enemy, amount) {
    if (!enemy.alive) return 0;
    enemy.hp = Math.max(0, enemy.hp - amount);

      // White flash on hit — start timer; update() resets colors
    enemy.mesh.userData.parts.forEach(p => {
      if (p.material && p.material.visible !== false) {
        // Cache original color on first hit
        if (p.userData.origColor === undefined) {
          p.userData.origColor = p.material.color.getHex();
        }
        p.material.color.setHex(0xffffff);
      }
    });
    enemy.flashTimer = 0.08;

    if (enemy.hp <= 0) {
      enemy.alive      = false;
      enemy.deathTimer = 0.6;
    }
    return enemy.hp;
  }

  // ── Find enemy by intersected mesh (walk hierarchy) ───────
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
    return enemies.filter(e => e.alive).length + spawnQueue.length;
  }

  function isWaveDone() { return allDead; }

  function clear() {
    enemies.forEach(e => {
      if (scene) {
        scene.remove(e.mesh);
        if (e.hpBar) scene.remove(e.hpBar.group);
      }
    });
    enemies    = [];
    spawnQueue = [];
    allDead    = false;
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
