/* ════════════════════════════════════════════════════════════════════
 *  ENEMY ARTILLERY / MORTAR / DRONE STRIKE SYSTEM
 *  ─────────────────────────────────────────────────────────────────
 *  Periodic indirect-fire events: artillery shells, mortar rounds,
 *  FPV kamikaze drones, bomber drones. Strikes target random points
 *  within play radius — friendly-fire to BOTH enemies and player.
 *  Shows "INCOMING" alert + ground marker + visible falling shell.
 *
 *  Public API:
 *    EnemyArtillery.init(scene)       — call once after scene exists
 *    EnemyArtillery.update(delta)     — per-frame
 *    EnemyArtillery.clear()           — reset (between stages/restarts)
 *    EnemyArtillery.fire(type, x, z)  — manual trigger (debug)
 * ═════════════════════════════════════════════════════════════════ */
const EnemyArtillery = (function () {
  'use strict';

  let _scene = null;
  const _activeStrikes  = [];   // pending impacts (warning + travel)
  const _activeDebris   = [];   // smoke/crater fade-out
  let _nextStrikeIn     = 12;   // seconds until next random strike
  let _nextDroneIn      = 28;   // seconds until next random enemy drone

  // ── Strike type definitions (real-reference: 152mm / 82mm / Lancet / Geran-2) ──
  const STRIKE_TYPES = {
    ARTILLERY: {
      label:    '⚠ INCOMING ARTILLERY',
      color:    '#ff3300',
      warningS: 3.5,            // delay between alert and impact
      radius:   8.0,
      damage:   75,
      shake:    1.4,
      shellHi:  90,             // start altitude
      shellRad: 0.18,
      shellLen: 0.85,
      shellCol: 0x4a4030,
      flashCol: 0xffaa44,
      craterR:  6.0,
    },
    MORTAR: {
      label:    '💣 MORTAR INCOMING',
      color:    '#ff8800',
      warningS: 2.5,
      radius:   4.5,
      damage:   45,
      shake:    1.0,
      shellHi:  60,
      shellRad: 0.10,
      shellLen: 0.45,
      shellCol: 0x2a2a2a,
      flashCol: 0xff8844,
      craterR:  3.5,
    },
    FPV_DRONE: {
      label:    '🛸 FPV DRONE STRIKE',
      color:    '#ff00aa',
      warningS: 1.5,
      radius:   1.5,
      damage:   60,
      shake:    0.8,
      shellHi:  20,
      shellRad: 0.14,
      shellLen: 0.30,
      shellCol: 0x111111,
      flashCol: 0xff4488,
      craterR:  1.5,
    },
    BOMBER: {
      label:    '✈ AIRSTRIKE INBOUND',
      color:    '#ffaa00',
      warningS: 4.0,
      radius:   6.0,
      damage:   55,
      shake:    1.2,
      shellHi:  120,
      shellRad: 0.20,
      shellLen: 1.20,
      shellCol: 0x666666,
      flashCol: 0xffcc66,
      craterR:  5.0,
    },
  };

  function init(scene) {
    _scene = scene || (window.GameManager && window.GameManager.getScene && window.GameManager.getScene());
    _activeStrikes.length = 0;
    _activeDebris.length  = 0;
    _nextStrikeIn = 8 + Math.random() * 8;   // first strike 8-16 s into play
    _nextDroneIn  = 22 + Math.random() * 14; // first drone  22-36 s
  }

  // Pick a random target — usually near the player, sometimes near random enemies
  function _pickTargetXZ() {
    const player = (window.GameManager && window.GameManager.getPlayer) ? window.GameManager.getPlayer() : null;
    if (!player || !player.position) return null;
    // 70% target near player, 30% target a random enemy cluster
    if (Math.random() < 0.30 && typeof window.Enemies !== 'undefined' && window.Enemies.getAll) {
      const list = window.Enemies.getAll().filter(e => e && e.alive && e.mesh);
      if (list.length > 0) {
        const e = list[Math.floor(Math.random() * list.length)];
        return { x: e.mesh.position.x + (Math.random() - 0.5) * 8,
                 z: e.mesh.position.z + (Math.random() - 0.5) * 8 };
      }
    }
    // Random ring around player 8-25 m
    const ang = Math.random() * Math.PI * 2;
    const rad = 8 + Math.random() * 17;
    return {
      x: player.position.x + Math.cos(ang) * rad,
      z: player.position.z + Math.sin(ang) * rad,
    };
  }

  function _groundY(x, z) {
    if (typeof VoxelWorld !== 'undefined' && VoxelWorld.getTopSolidY) {
      return VoxelWorld.getTopSolidY(x, z);
    }
    return 0;
  }

  function fire(typeKey, x, z) {
    if (!_scene) return;
    const T = STRIKE_TYPES[typeKey] || STRIKE_TYPES.MORTAR;
    if (typeof x !== 'number' || typeof z !== 'number') {
      const p = _pickTargetXZ();
      if (!p) return;
      x = p.x; z = p.z;
    }
    const gy = _groundY(x, z);

    // ── HUD alert ──
    if (typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup(T.label, T.color);
    }
    // Audio cue (whistle)
    try {
      if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
        AudioSystem.play('explosion', 0.2);
      }
    } catch (e) {}

    // ── Ground marker (red ring) ──
    const ringGeo  = new THREE.RingGeometry(T.radius * 0.8, T.radius, 24);
    const ringMat  = new THREE.MeshBasicMaterial({
      color: T.color === '#ff8800' ? 0xff8800 : (T.color === '#ffaa00' ? 0xffaa00 : (T.color === '#ff00aa' ? 0xff00aa : 0xff3300)),
      transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
    });
    const marker = new THREE.Mesh(ringGeo, ringMat);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, gy + 0.12, z);
    _scene.add(marker);

    // Inner pulse
    const pulseGeo = new THREE.RingGeometry(T.radius * 0.05, T.radius * 0.18, 16);
    const pulseMat = ringMat.clone(); pulseMat.opacity = 0.85;
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.set(x, gy + 0.13, z);
    _scene.add(pulse);

    // ── Shell mesh (drops from sky) ──
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(T.shellRad * 0.8, T.shellRad, T.shellLen, 8),
      new THREE.MeshLambertMaterial({ color: T.shellCol })
    );
    shell.position.set(x, gy + T.shellHi, z);
    // Tilted to look like it's falling
    shell.rotation.x = Math.PI * 0.05;
    _scene.add(shell);

    // Vapor trail (thin cylinder above shell)
    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.04, T.shellHi * 0.5, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })
    );
    trail.position.set(x, gy + T.shellHi + T.shellHi * 0.25, z);
    _scene.add(trail);

    _activeStrikes.push({
      type: typeKey, T, x, z, gy,
      timeLeft: T.warningS,
      marker, pulse, pulseScale: 1.0,
      shell, trail,
    });
  }

  function _detonate(s) {
    const T = s.T;
    const gy = s.gy;
    // Damage player
    try {
      const player = window.GameManager && window.GameManager.getPlayer && window.GameManager.getPlayer();
      if (player && player.position && !player.godMode) {
        const dx = player.position.x - s.x;
        const dz = player.position.z - s.z;
        const d  = Math.sqrt(dx * dx + dz * dz);
        if (d < T.radius) {
          const falloff = 1 - (d / T.radius);
          const dmg = Math.floor(T.damage * (0.4 + 0.6 * falloff));
          player.hp = Math.max(1, (player.hp || 100) - dmg);
          if (typeof HUD !== 'undefined' && HUD.setHealth) HUD.setHealth(player.hp, player.maxHp || 100);
          if (typeof HUD !== 'undefined' && HUD.showDamageFlash) HUD.showDamageFlash(0xff3300, 0.5);
        }
      }
    } catch (e) {}
    // Damage enemies in radius (random fire DOES hurt friendlies)
    try {
      if (typeof window.Enemies !== 'undefined' && window.Enemies.damageInRadius) {
        const pos = new THREE.Vector3(s.x, gy + 1, s.z);
        window.Enemies.damageInRadius(pos, T.radius, T.damage);
      }
    } catch (e) {}
    // Damage friendly NPCs too if API exists
    try {
      if (typeof window.NPCSystem !== 'undefined' && window.NPCSystem.damageInRadius) {
        const pos2 = new THREE.Vector3(s.x, gy + 1, s.z);
        window.NPCSystem.damageInRadius(pos2, T.radius, T.damage);
      }
    } catch (e) {}

    // Screen shake + flash
    if (typeof Feedback !== 'undefined' && Feedback.screenShake) Feedback.screenShake(T.shake);

    // Explosion flash sphere
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(T.radius * 0.55, 12, 8),
      new THREE.MeshBasicMaterial({ color: T.flashCol, transparent: true, opacity: 0.9, depthWrite: false })
    );
    flash.position.set(s.x, gy + 1.0, s.z);
    _scene.add(flash);

    // Smoke column
    const smoke = new THREE.Mesh(
      new THREE.CylinderGeometry(T.craterR * 0.45, T.craterR * 0.25, 6, 8),
      new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.7, depthWrite: false })
    );
    smoke.position.set(s.x, gy + 3.0, s.z);
    _scene.add(smoke);

    // Crater patch
    const craterMat = new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.85 });
    const crater = new THREE.Mesh(new THREE.CircleGeometry(T.craterR, 16), craterMat);
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(s.x, gy + 0.05, s.z);
    _scene.add(crater);

    _activeDebris.push({ flash, smoke, crater, life: 0, maxLife: 4.0 });

    // Audio
    try {
      if (typeof AudioSystem !== 'undefined' && AudioSystem.play) {
        AudioSystem.play('explosion', 0.7);
      }
    } catch (e) {}

    // Remove warning meshes
    if (s.marker)  _scene.remove(s.marker);
    if (s.pulse)   _scene.remove(s.pulse);
    if (s.shell)   _scene.remove(s.shell);
    if (s.trail)   _scene.remove(s.trail);
  }

  function _spawnRandomEnemyDrone() {
    if (typeof window.DroneSystem === 'undefined' || !window.DroneSystem.spawnEnemyDrone) return;
    const player = window.GameManager && window.GameManager.getPlayer && window.GameManager.getPlayer();
    if (!player || !player.position) return;
    const ang = Math.random() * Math.PI * 2;
    const rad = 35 + Math.random() * 20;
    const x = player.position.x + Math.cos(ang) * rad;
    const z = player.position.z + Math.sin(ang) * rad;
    const y = _groundY(x, z) + 18 + Math.random() * 10;
    const type = Math.random() < 0.55 ? 'enemy_fpv' : 'enemy_bomber';
    try { window.DroneSystem.spawnEnemyDrone(x, y, z, type); } catch (e) {}
    if (typeof HUD !== 'undefined' && HUD.notifyPickup) {
      HUD.notifyPickup(
        type === 'enemy_fpv' ? '⚠ FPV DRONE INBOUND' : '⚠ BOMBER DRONE INBOUND',
        type === 'enemy_fpv' ? '#ff00aa' : '#ffaa00'
      );
    }
  }

  function update(delta) {
    if (!_scene) {
      // Lazy-init if scene comes online later
      if (window.GameManager && window.GameManager.getScene) {
        const s = window.GameManager.getScene();
        if (s) _scene = s;
      }
      if (!_scene) return;
    }
    // Only run during active gameplay
    const player = (window.GameManager && window.GameManager.getPlayer) ? window.GameManager.getPlayer() : null;
    if (!player || !player.position) return;
    if (player.hp !== undefined && player.hp <= 0) return;

    // ── Random strike scheduler ──
    _nextStrikeIn -= delta;
    if (_nextStrikeIn <= 0) {
      // Pick weighted strike type — mortar most common, artillery medium, FPV/bomber rarer
      const r = Math.random();
      let type;
      if      (r < 0.45) type = 'MORTAR';
      else if (r < 0.75) type = 'ARTILLERY';
      else if (r < 0.90) type = 'FPV_DRONE';
      else               type = 'BOMBER';
      fire(type);
      // Sometimes a salvo of 2-3 mortars
      if (type === 'MORTAR' && Math.random() < 0.50) {
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          setTimeout(() => fire('MORTAR'), 400 + i * 700);
        }
      }
      _nextStrikeIn = 9 + Math.random() * 12; // 9-21 s between strikes
    }

    // ── Random enemy drone scheduler ──
    _nextDroneIn -= delta;
    if (_nextDroneIn <= 0) {
      _spawnRandomEnemyDrone();
      _nextDroneIn = 25 + Math.random() * 25; // 25-50 s
    }

    // ── Active strike progression ──
    for (let i = _activeStrikes.length - 1; i >= 0; i--) {
      const s = _activeStrikes[i];
      s.timeLeft -= delta;
      // Pulse marker
      if (s.pulse) {
        s.pulseScale += delta * 2.5;
        if (s.pulseScale > 4.0) s.pulseScale = 1.0;
        s.pulse.scale.setScalar(s.pulseScale);
        s.pulse.material.opacity = Math.max(0.0, 0.85 - s.pulseScale * 0.18);
      }
      // Shell descent
      const T = s.T;
      const t = 1 - Math.max(0, s.timeLeft / T.warningS); // 0..1 over warning window
      if (s.shell) {
        s.shell.position.y = s.gy + T.shellHi * (1 - t * t); // ease-in
      }
      if (s.trail) {
        s.trail.position.y = s.shell ? s.shell.position.y + T.shellHi * 0.25 * (1 - t) : s.trail.position.y;
        s.trail.scale.y = Math.max(0.05, 1 - t);
        s.trail.material.opacity = Math.max(0, 0.35 * (1 - t));
      }
      if (s.timeLeft <= 0) {
        _detonate(s);
        _activeStrikes.splice(i, 1);
      }
    }

    // ── Debris fade ──
    for (let i = _activeDebris.length - 1; i >= 0; i--) {
      const d = _activeDebris[i];
      d.life += delta;
      const k = d.life / d.maxLife;
      if (d.flash) {
        d.flash.scale.setScalar(1 + k * 1.5);
        d.flash.material.opacity = Math.max(0, 0.9 * (1 - k * 1.6));
      }
      if (d.smoke) {
        d.smoke.position.y += delta * 1.5;
        d.smoke.scale.y    = 1 + k * 1.5;
        d.smoke.material.opacity = Math.max(0, 0.7 * (1 - k));
      }
      if (d.crater) {
        d.crater.material.opacity = Math.max(0, 0.85 * (1 - k * 0.5));
      }
      if (k >= 1) {
        if (d.flash)  _scene.remove(d.flash);
        if (d.smoke)  _scene.remove(d.smoke);
        if (d.crater) _scene.remove(d.crater);
        _activeDebris.splice(i, 1);
      }
    }
  }

  function clear() {
    if (_scene) {
      for (const s of _activeStrikes) {
        if (s.marker) _scene.remove(s.marker);
        if (s.pulse)  _scene.remove(s.pulse);
        if (s.shell)  _scene.remove(s.shell);
        if (s.trail)  _scene.remove(s.trail);
      }
      for (const d of _activeDebris) {
        if (d.flash)  _scene.remove(d.flash);
        if (d.smoke)  _scene.remove(d.smoke);
        if (d.crater) _scene.remove(d.crater);
      }
    }
    _activeStrikes.length = 0;
    _activeDebris.length  = 0;
    _nextStrikeIn = 12;
    _nextDroneIn  = 28;
  }

  return { init, update, clear, fire, STRIKE_TYPES };
})();

if (typeof window !== 'undefined') window.EnemyArtillery = EnemyArtillery;
