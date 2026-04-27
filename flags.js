// flags.js — Faction flag system (Ukrainian vs Russian Federation)
// Procedural THREE.js meshes, no external assets.
// IIFE singleton, exposes init/update/clear plus mesh builders.

window.Flags = (function () {
  'use strict';

  // ── Colors ──────────────────────────────────────────────────────
  // Ukraine: blue top, yellow bottom (1:1)
  const UKR_TOP    = 0x0057B7;
  const UKR_BOTTOM = 0xFFD700;
  // Russian Federation: white / blue / red horizontal stripes
  const RUS_WHITE  = 0xF8F8F8;
  const RUS_BLUE   = 0x0033A0;
  const RUS_RED    = 0xDA291C;

  // Track wavers so update() can animate
  const _wavers = [];
  let _scene = null;
  let _flagpoles = []; // { mesh, faction, x, z }

  function _factionKey(f) {
    if (f === 'ukrainian' || f === 'friendly' || f === 'ukr') return 'ukrainian';
    if (f === 'russian'   || f === 'enemy'    || f === 'rus') return 'russian';
    // Default to Russian for ambiguous "enemy_*" drone types is handled by caller
    return 'ukrainian';
  }

  // ── Texture: bicolor Ukrainian (canvas → Texture) ───────────────
  let _ukrTex = null;
  function _ukrFlagTexture() {
    if (_ukrTex) return _ukrTex;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 48;
    const g = c.getContext('2d');
    g.fillStyle = '#0057B7'; g.fillRect(0, 0, 64, 24);
    g.fillStyle = '#FFD700'; g.fillRect(0, 24, 64, 24);
    _ukrTex = new THREE.CanvasTexture(c);
    _ukrTex.minFilter = THREE.LinearFilter;
    _ukrTex.magFilter = THREE.LinearFilter;
    return _ukrTex;
  }

  // ── Texture: tricolor Russian Federation ────────────────────────
  let _rusTex = null;
  function _rusFlagTexture() {
    if (_rusTex) return _rusTex;
    const c = document.createElement('canvas');
    c.width = 60; c.height = 48;
    const g = c.getContext('2d');
    g.fillStyle = '#F8F8F8'; g.fillRect(0,  0, 60, 16);
    g.fillStyle = '#0033A0'; g.fillRect(0, 16, 60, 16);
    g.fillStyle = '#DA291C'; g.fillRect(0, 32, 60, 16);
    _rusTex = new THREE.CanvasTexture(c);
    _rusTex.minFilter = THREE.LinearFilter;
    _rusTex.magFilter = THREE.LinearFilter;
    return _rusTex;
  }

  function _flagTextureFor(faction) {
    return _factionKey(faction) === 'russian' ? _rusFlagTexture() : _ukrFlagTexture();
  }

  // ── Small back/torso patch (for soldiers) ───────────────────────
  // Returns a Mesh — caller positions it. Size ~ 0.18 wide, 0.12 tall
  function makePatch(faction, width) {
    width = width || 0.18;
    const h = width * 0.66;
    const tex = _flagTextureFor(faction);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h), mat);
    mesh.userData.isFactionPatch = true;
    return mesh;
  }

  // ── Pennant for vehicles & larger drones ────────────────────────
  // Returns Group: tiny pole + small cloth that gently waves
  function makePennant(faction, scale) {
    scale = scale || 1.0;
    const g = new THREE.Group();
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025 * scale, 0.025 * scale, 0.9 * scale, 6),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    pole.position.y = 0.45 * scale;
    g.add(pole);
    // Cloth (plane)
    const tex = _flagTextureFor(faction);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5 * scale, 0.32 * scale),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    );
    cloth.position.set(0.27 * scale, 0.74 * scale, 0);
    g.add(cloth);
    g.userData.isPennant = true;
    g.userData.cloth = cloth;
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.scale = scale;
    _wavers.push(g);
    return g;
  }

  // ── Full flagpole for the world (3-4m tall) ─────────────────────
  function makeFlagpole(faction, height) {
    height = height || 4.0;
    const g = new THREE.Group();
    // Pole (silver/grey)
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.10, height, 8),
      new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
    );
    pole.position.y = height * 0.5;
    g.add(pole);
    // Top cap
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffd84a })
    );
    cap.position.y = height + 0.05;
    g.add(cap);
    // Cloth
    const tex = _flagTextureFor(faction);
    const cw = 1.4, ch = 0.9;
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(cw, ch),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    );
    cloth.position.set(cw * 0.5 + 0.05, height - ch * 0.5 - 0.1, 0);
    g.add(cloth);
    g.userData.isFlagpole = true;
    g.userData.faction = _factionKey(faction);
    g.userData.cloth = cloth;
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.scale = 1;
    _wavers.push(g);
    return g;
  }

  // ── Attach helpers ──────────────────────────────────────────────
  function attachToVehicle(vehicle) {
    if (!vehicle || !vehicle.mesh) return;
    if (vehicle.mesh.userData.flagAttached) return;
    const f = vehicle.faction === 'enemy' ? 'russian' : 'ukrainian';
    const scale = vehicle.isTank ? 1.1 : (vehicle.flying ? 0.9 : 0.85);
    const p = makePennant(f, scale);
    // Place at rear-top of vehicle
    const rearZ = vehicle.flying ? 0 : -1.6;
    const topY  = vehicle.isTank ? 1.6 : (vehicle.flying ? 1.2 : 1.4);
    p.position.set(0, topY, rearZ);
    vehicle.mesh.add(p);
    vehicle.mesh.userData.flagAttached = true;
    vehicle.mesh.userData.flagPennant = p;
  }

  function attachToDrone(drone) {
    if (!drone || !drone.mesh) return;
    if (drone.mesh.userData.flagAttached) return;
    const isEnemy = (drone.faction === 'russian') ||
                    (typeof drone.type === 'string' && drone.type.indexOf('enemy_') === 0);
    const f = isEnemy ? 'russian' : 'ukrainian';
    // Tiny patch on body (no pole — drones too small for a flagpole)
    const patch = makePatch(f, 0.22);
    patch.position.set(0, 0.28, 0);
    patch.rotation.y = Math.PI; // face rear
    drone.mesh.add(patch);
    drone.mesh.userData.flagAttached = true;
    drone.mesh.userData.flagPatch = patch;
  }

  function attachToSoldier(group, faction) {
    if (!group || group.userData.flagAttached) return;
    const patch = makePatch(faction, 0.18);
    // On upper-back of torso (torso is roughly y=0.85, depth 0.26)
    patch.position.set(0, 1.0, -0.14);
    patch.rotation.y = Math.PI;
    group.add(patch);
    // Small shoulder pennant on right arm (more visible from front)
    const shoulder = makePatch(faction, 0.12);
    shoulder.position.set(0.27, 1.05, 0.14);
    shoulder.rotation.y = -0.3;
    group.add(shoulder);
    group.userData.flagAttached = true;
    group.userData.factionPatch = patch;
  }

  // ── Spawn flagpoles in the world at given positions ─────────────
  function spawnFlagpole(x, y, z, faction, height) {
    if (!_scene) return null;
    const fp = makeFlagpole(faction, height || 4.0);
    fp.position.set(x, y, z);
    _scene.add(fp);
    _flagpoles.push({ mesh: fp, faction: _factionKey(faction), x: x, z: z });
    return fp;
  }

  // ── Update (animate cloth wave) ─────────────────────────────────
  function update(delta) {
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
    for (let i = _wavers.length - 1; i >= 0; i--) {
      const w = _wavers[i];
      if (!w || !w.parent) { _wavers.splice(i, 1); continue; }
      const cloth = w.userData.cloth;
      if (!cloth) continue;
      const ph = w.userData.phase || 0;
      // Gentle Y rotation wobble = waving in the wind
      cloth.rotation.y = Math.sin(t * 2.2 + ph) * 0.18;
      cloth.rotation.z = Math.sin(t * 1.4 + ph) * 0.05;
    }
  }

  function init(scene) {
    _scene = scene;
    _wavers.length = 0;
    _flagpoles.length = 0;
  }

  function clear() {
    if (_scene) {
      for (const fp of _flagpoles) {
        if (fp.mesh && fp.mesh.parent) fp.mesh.parent.remove(fp.mesh);
      }
    }
    _flagpoles.length = 0;
    _wavers.length = 0;
  }

  function getFlagpoles() { return _flagpoles.slice(); }

  return {
    init: init,
    update: update,
    clear: clear,
    makePatch: makePatch,
    makePennant: makePennant,
    makeFlagpole: makeFlagpole,
    attachToVehicle: attachToVehicle,
    attachToDrone: attachToDrone,
    attachToSoldier: attachToSoldier,
    spawnFlagpole: spawnFlagpole,
    getFlagpoles: getFlagpoles,
  };
})();
