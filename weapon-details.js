/**
 * weapon-details.js — 39 Visual Enhancement Features for Weapon System
 *
 * Features:
 *  1. Reflective gun-metal materials (MeshPhong, high shininess/specular)
 *  2. Wood-grain materials with warm sheen
 *  3. Polymer/rubber materials (dark matte modern furniture)
 *  4. Chrome/nickel accent materials for screws, pins, buttons
 *  5. Glass/lens materials for scope optics
 *  6. Universal ADS zoom for ALL weapons (right-click)
 *  7. Hyper-zoom for snipers/AMR (10° FOV)
 *  8. Per-type zoom FOV table
 *  9. Scope overlay (dark vignette when zoomed with scoped weapon)
 * 10. Iron-sight alignment (weapon shifts to center on ADS)
 * 11. Front sight post on all rifles/SMGs
 * 12. Rear sight notch on all rifles/SMGs
 * 13. Trigger mesh on all firearms
 * 14. Trigger guard loop on all firearms
 * 15. Ejection port detail on rifles/pistols
 * 16. Charging handle on rifles (animated on fire)
 * 17. Magazine release button
 * 18. Forward assist on NATO rifles
 * 19. Dust cover on AK-pattern rifles
 * 20. Muzzle-brake detail (slotted)
 * 21. Picatinny rail teeth segments
 * 22. Scope ring mounts
 * 23. Scope turret adjustment knobs
 * 24. Sling attachment points
 * 25. Barrel threading marks
 * 26. Screws/pins/rivets scatter
 * 27. Bolt cycling animation on fire (rifles)
 * 28. Trigger pull animation on fire
 * 29. Gatling barrel spin animation
 * 30. Magazine wobble during reload
 * 31. Bipod detail on MGs
 * 32. Muzzle smoke wisps after firing
 * 33. Scope lens glint effect
 * 34. Laser sight beam (red line)
 * 35. Enhanced barrel heat glow
 * 36. Ammo counter LED on Gatling/Minigun
 * 37. Weapon camo tint system
 * 38. Blood splatter decal on melee weapon after kills
 * 39. Scope lens glass material (transparent tinted)
 *
 * IIFE singleton — exposes init(), update(), clear(), enhanceMesh(), etc.
 * Depends on: THREE (global)
 */
const WeaponDetails = (() => {
  'use strict';

  let _scene = null;
  let _camera = null;

  // ══════════════════════════════════════════════════════════
  //  MATERIAL LIBRARY (Features 1-5)
  // ══════════════════════════════════════════════════════════
  const M = {};

  function initMaterials() {
    if (M._ready) return;
    // ── Metals ──
    M.gunMetal   = new THREE.MeshPhongMaterial({ color: 0x2a2a2e, shininess: 120, specular: 0x666677 });
    M.blueSteel  = new THREE.MeshPhongMaterial({ color: 0x1e2030, shininess: 150, specular: 0x8888bb });
    M.parkerized = new THREE.MeshPhongMaterial({ color: 0x3a3a3c, shininess: 40,  specular: 0x333344 });
    M.stainless  = new THREE.MeshPhongMaterial({ color: 0x999999, shininess: 180, specular: 0xdddddd });
    M.chrome     = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 250, specular: 0xffffff });
    M.nickel     = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 160, specular: 0xcccccc });
    M.brass      = new THREE.MeshPhongMaterial({ color: 0xb8860b, shininess: 140, specular: 0xffdd88 });
    M.darkMetal  = new THREE.MeshPhongMaterial({ color: 0x1a1a1e, shininess: 100, specular: 0x555566 });
    M.blackOxide = new THREE.MeshPhongMaterial({ color: 0x111114, shininess: 80,  specular: 0x444455 });
    // ── Wood ──
    M.walnut     = new THREE.MeshPhongMaterial({ color: 0x5a3a1a, shininess: 45, specular: 0x332211 });
    M.birch      = new THREE.MeshPhongMaterial({ color: 0x8a7a5a, shininess: 35, specular: 0x443322 });
    M.darkWood   = new THREE.MeshPhongMaterial({ color: 0x3a2a18, shininess: 30, specular: 0x221100 });
    // ── Polymer / Rubber ──
    M.polymer    = new THREE.MeshPhongMaterial({ color: 0x1a1a1e, shininess: 60, specular: 0x333344 });
    M.rubber     = new THREE.MeshPhongMaterial({ color: 0x0e0e0e, shininess: 8,  specular: 0x111111 });
    M.fde        = new THREE.MeshPhongMaterial({ color: 0x9a8a6a, shininess: 30, specular: 0x554433 });
    M.odGreen    = new THREE.MeshPhongMaterial({ color: 0x4a5a3a, shininess: 25, specular: 0x222211 });
    // ── Glass / Optics ──
    M.lensBlue   = new THREE.MeshPhongMaterial({ color: 0x224488, shininess: 250, specular: 0xffffff, transparent: true, opacity: 0.35 });
    M.lensAmber  = new THREE.MeshPhongMaterial({ color: 0xaa6622, shininess: 250, specular: 0xffffff, transparent: true, opacity: 0.3 });
    // ── Special ──
    M.ledGreen   = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
    M.ledRed     = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    M.laserRed   = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    M.blood      = new THREE.MeshBasicMaterial({ color: 0x880000, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    M._ready = true;
  }

  // ══════════════════════════════════════════════════════════
  //  PER-TYPE ZOOM FOV MAP (Features 6-8)
  // ══════════════════════════════════════════════════════════
  var ZOOM_FOV = {
    SNIPER: 15, AMR: 15,
    ATGM: 18, AT_HEAVY: 18,
    AT: 28, AT_LIGHT: 28, AA: 28,
    THERMOBARIC: 26,
    GRENADE: 35,
    ASSAULT: 50, NATO: 50, NATO_HEAVY: 48,
    SILENT: 46,
    LMG: 55, HMG: 55, MACHINEGUN: 55, HMG_HEAVY: 55,
    SMG: 58,
    SHOTGUN: 60,
    PISTOL: 62,
    MINIGUN: 58, GATLING: 58,
    INCENDIARY: 65, MINE: 70, SMOKE: 70, FLASHBANG: 70, EXPLOSIVE: 65,
    MELEE: 70
  };

  function getZoomFov(type) { return ZOOM_FOV[type] || 50; }

  // ══════════════════════════════════════════════════════════
  //  ADS POSITION OFFSET (Feature 10 — iron-sight alignment)
  // ══════════════════════════════════════════════════════════
  function getAdsOffset(weaponDef, adsLerp) {
    if (!weaponDef) return { x: 0, y: 0, z: 0 };
    if (weaponDef.hasScope) {
      // Scoped: bring near center but lower so scope lens doesn't fill screen
      return { x: -0.13 * adsLerp, y: -0.32 * adsLerp, z: -0.45 * adsLerp };
    }
    // Iron sights: partial center, push lower so irons don't block target
    return { x: -0.11 * adsLerp * 0.65, y: -0.22 * adsLerp * 0.65, z: -0.38 * adsLerp };
  }

  // ══════════════════════════════════════════════════════════
  //  SUB-PART HELPER FACTORIES (Features 11-26, 31, 34, 36)
  // ══════════════════════════════════════════════════════════

  // Tiny screw head (Feature 26)
  function screw(x, y, z) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.003, 6), M.nickel);
    m.position.set(x, y, z); m.rotation.z = Math.PI / 2; return m;
  }

  // Pin / rivet (Feature 26)
  function pin(x, y, z) {
    var m = new THREE.Mesh(new THREE.SphereGeometry(0.003, 4, 4), M.chrome);
    m.position.set(x, y, z); return m;
  }

  // Front sight post (Feature 11)
  function frontSight(x, y, z) {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.008), M.gunMetal);
    var post = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.013, 0.002), M.gunMetal);
    post.position.y = 0.013;
    var wingL = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.016, 0.006), M.gunMetal);
    wingL.position.set(-0.006, 0.006, 0);
    var wingR = wingL.clone(); wingR.position.x = 0.006;
    g.add(base, post, wingL, wingR);
    g.position.set(x, y, z); return g;
  }

  // Rear sight aperture (Feature 12)
  function rearSight(x, y, z) {
    var g = new THREE.Group();
    var block = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.013, 0.010), M.gunMetal);
    var notch = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.007, 0.012), M.blackOxide);
    notch.position.y = 0.004;
    g.add(block, notch);
    g.position.set(x, y, z); return g;
  }

  // Trigger (Feature 13)
  function trigger(x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.007), M.darkMetal);
    m.position.set(x, y, z); m.name = '_trigger'; return m;
  }

  // Trigger guard loop (Feature 14)
  function triggerGuard(x, y, z) {
    var g = new THREE.Group();
    var bar = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.035), M.gunMetal);
    bar.position.y = -0.013;
    var front = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.022, 0.003), M.gunMetal);
    front.position.set(0, 0, 0.015);
    var rear = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.022, 0.003), M.gunMetal);
    rear.position.set(0, 0, -0.015);
    g.add(bar, front, rear);
    g.position.set(x, y, z); return g;
  }

  // Ejection port (Feature 15)
  function ejectionPort(x, y, z) {
    var g = new THREE.Group();
    var recess = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.010, 0.018), M.blackOxide);
    var deflector = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.003, 0.020), M.gunMetal);
    deflector.position.y = 0.007;
    g.add(recess, deflector);
    g.position.set(x, y, z); return g;
  }

  // Bolt carrier (Feature 15 companion)
  function boltCarrier(x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.022), M.stainless);
    m.position.set(x, y, z); m.name = '_bolt'; return m;
  }

  // Charging handle (Feature 16)
  function chargingHandle(x, y, z) {
    var g = new THREE.Group();
    var handle = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.006, 0.016), M.gunMetal);
    var latch = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.007), M.darkMetal);
    latch.position.set(0.006, 0, 0.008);
    g.add(handle, latch);
    g.position.set(x, y, z); g.name = '_chargingHandle'; return g;
  }

  // Magazine release button (Feature 17)
  function magRelease(x, y, z) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 6), M.darkMetal);
    m.rotation.z = Math.PI / 2; m.position.set(x, y, z); return m;
  }

  // Forward assist button (Feature 18)
  function forwardAssist(x, y, z) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8), M.parkerized);
    m.rotation.z = Math.PI / 2; m.position.set(x, y, z); return m;
  }

  // Dust cover hinge (Feature 19)
  function dustCover(x, y, z) {
    var g = new THREE.Group();
    var cover = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.010, 0.022), M.parkerized);
    var hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.012, 4), M.darkMetal);
    hinge.rotation.x = Math.PI / 2; hinge.position.z = -0.012;
    g.add(cover, hinge);
    g.position.set(x, y, z); return g;
  }

  // Muzzle brake detail (Feature 20)
  function muzzleBrake(x, y, z) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.035, 8), M.gunMetal);
    body.rotation.x = Math.PI / 2;
    for (var i = 0; i < 4; i++) {
      var a = (i / 4) * Math.PI * 2;
      var slot = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.020, 0.005), M.blackOxide);
      slot.position.set(Math.cos(a) * 0.013, Math.sin(a) * 0.013, 0);
      g.add(slot);
    }
    g.add(body); g.position.set(x, y, z); return g;
  }

  // Picatinny rail teeth (Feature 21)
  function railSegment(x, y, z, len) {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, len), M.gunMetal);
    var teeth = Math.floor(len / 0.007);
    for (var i = 0; i < teeth; i++) {
      var tooth = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.0025, 0.002), M.gunMetal);
      tooth.position.set(0, 0.003, -len / 2 + 0.003 + i * 0.007);
      g.add(tooth);
    }
    g.add(base); g.position.set(x, y, z); return g;
  }

  // Scope ring mount (Feature 22)
  function scopeRing(x, y, z, r) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(r || 0.014, 0.003, 6, 12), M.gunMetal);
    m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m;
  }

  // Scope turret (Feature 23)
  function scopeTurret(x, y, z) {
    var g = new THREE.Group();
    var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.013, 8), M.darkMetal);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.002, 8), M.gunMetal);
    cap.position.y = 0.008;
    g.add(knob, cap); g.position.set(x, y, z); return g;
  }

  // Scope lens glass (Features 5, 39)
  function scopeLens(x, y, z, r) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r || 0.018, r || 0.018, 0.002, 12), M.lensBlue);
    m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.name = '_scopeLens'; return m;
  }

  // Sling attachment point (Feature 24)
  function slingPoint(x, y, z) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.0015, 4, 8), M.darkMetal);
    m.position.set(x, y, z); return m;
  }

  // Barrel threading (Feature 25)
  function barrelThread(x, y, z, len) {
    var g = new THREE.Group();
    var n = Math.floor(len / 0.004);
    for (var i = 0; i < n; i++) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0008, 4, 8), M.darkMetal);
      ring.rotation.x = Math.PI / 2; ring.position.z = i * 0.004;
      g.add(ring);
    }
    g.position.set(x, y, z); return g;
  }

  // Bipod detail (Feature 31)
  function bipodDetail(x, y, z) {
    var g = new THREE.Group();
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.08, 0.005), M.gunMetal);
    legL.position.set(-0.02, -0.04, 0); legL.rotation.z = 0.2;
    var legR = legL.clone(); legR.position.x = 0.02; legR.rotation.z = -0.2;
    var hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), M.darkMetal);
    hinge.rotation.z = Math.PI / 2;
    g.add(legL, legR, hinge); g.position.set(x, y, z); return g;
  }

  // Laser sight module (Feature 34)
  function laserModule(x, y, z) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.010, 0.022), M.darkMetal);
    var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.002, 6), M.ledRed);
    lens.rotation.x = Math.PI / 2; lens.position.z = -0.012;
    g.add(body, lens); g.position.set(x, y, z); return g;
  }

  // Ammo counter LED (Feature 36)
  function ammoCounter(x, y, z) {
    var g = new THREE.Group();
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.007), M.ledGreen);
    screen.name = '_ammoScreen';
    var frame = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.011, 0.003), M.darkMetal);
    frame.position.z = 0.002;
    g.add(frame, screen); g.position.set(x, y, z); return g;
  }

  // ══════════════════════════════════════════════════════════
  //  VOXEL SUBDIVISION SYSTEM — Lego-like detail (Feature 40)
  // ══════════════════════════════════════════════════════════
  var VOXEL_SIZE = 0.006; // 6mm voxels — chunky Lego look
  var _voxelBoxGeo = null;

  function getVoxelGeo() {
    if (!_voxelBoxGeo) _voxelBoxGeo = new THREE.BoxGeometry(VOXEL_SIZE * 0.92, VOXEL_SIZE * 0.92, VOXEL_SIZE * 0.92);
    return _voxelBoxGeo;
  }

  /**
   * Voxelize a THREE.Group: replace each mesh child with an InstancedMesh
   * grid of small cubes, giving a Lego-like aesthetic.
   * Preserves named sub-groups (moving parts) and recurses into them.
   */
  function voxelizeGroup(group, vs) {
    vs = vs || VOXEL_SIZE;
    var directChildren = [];
    for (var ci = 0; ci < group.children.length; ci++) directChildren.push(group.children[ci]);

    for (var di = 0; di < directChildren.length; di++) {
      var child = directChildren[di];
      // Recurse into named sub-groups (slide, bolt, etc.)
      if (child.isGroup && child.name && child.name.charAt(0) === '_') {
        voxelizeGroup(child, vs);
        continue;
      }
      if (!child.isMesh || !child.geometry) continue;
      // Skip transparent/emissive/basic materials
      if (child.material && (child.material.transparent || child.material.type === 'MeshBasicMaterial')) continue;

      child.geometry.computeBoundingBox();
      var bb = child.geometry.boundingBox;
      if (!bb) continue;
      var sx = (bb.max.x - bb.min.x) || 0.001;
      var sy = (bb.max.y - bb.min.y) || 0.001;
      var sz = (bb.max.z - bb.min.z) || 0.001;
      var maxDim = Math.max(sx, sy, sz);
      if (maxDim < vs * 0.3) continue; // too tiny

      var color = child.material.color ? child.material.color.getHex() : 0x333333;
      var shin = child.material.shininess || 60;
      var spec = child.material.specular ? child.material.specular.getHex() : 0x444444;

      var nx = Math.max(1, Math.round(sx / vs));
      var ny = Math.max(1, Math.round(sy / vs));
      var nz = Math.max(1, Math.round(sz / vs));
      var count = nx * ny * nz;
      if (count > 2000) continue; // safety cap

      // For cylinder geometries, carve to approximate circular cross-section
      var isCylinder = !!(child.geometry.parameters && child.geometry.parameters.radiusTop !== undefined);
      var cylR = isCylinder ? (child.geometry.parameters.radiusTop || 0.01) : 0;
      var cylAxis = 1; // default: Y-axis cylinder
      // Detect rotated cylinders (rotated to Z-axis is common for barrels)
      if (isCylinder && child.rotation && Math.abs(child.rotation.x - Math.PI / 2) < 0.1) cylAxis = 2;

      var geo = new THREE.BoxGeometry(vs * 0.92, vs * 0.92, vs * 0.92);
      var mat = new THREE.MeshPhongMaterial({ color: color, shininess: shin, specular: spec });
      // Add slight color variation per voxel for realism
      var inst = new THREE.InstancedMesh(geo, mat, count);
      var m4 = new THREE.Matrix4();
      var col = new THREE.Color();
      var idx = 0;
      for (var ix = 0; ix < nx; ix++) {
        for (var iy = 0; iy < ny; iy++) {
          for (var iz = 0; iz < nz; iz++) {
            var lx = bb.min.x + (ix + 0.5) * sx / nx;
            var ly = bb.min.y + (iy + 0.5) * sy / ny;
            var lz = bb.min.z + (iz + 0.5) * sz / nz;
            // Cylinder carving: skip voxels outside the radius
            if (isCylinder) {
              var cdx, cdy;
              if (cylAxis === 1) { cdx = lx; cdy = lz; }
              else { cdx = lx; cdy = ly; }
              if (Math.sqrt(cdx * cdx + cdy * cdy) > cylR * 1.1) { continue; }
            }
            m4.makeTranslation(lx, ly, lz);
            // Slight color jitter for voxel texture
            var jitter = 0.95 + Math.random() * 0.1;
            col.setHex(color);
            col.r *= jitter; col.g *= jitter; col.b *= jitter;
            inst.setMatrixAt(idx, m4);
            inst.setColorAt(idx, col);
            idx++;
          }
        }
      }
      // Trim if cylinder carving removed some
      if (idx < count) { inst.count = idx; }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

      var vg = new THREE.Group();
      vg.position.copy(child.position);
      vg.rotation.copy(child.rotation);
      vg.scale.copy(child.scale);
      vg.name = child.name;
      if (child.userData) Object.assign(vg.userData, child.userData);
      // For cylinders that were rotated, reset rotation since voxels are axis-aligned
      if (isCylinder && cylAxis === 2) vg.rotation.x = 0;
      vg.add(inst);

      group.remove(child);
      child.geometry.dispose();
      if (child.material && child.material.dispose) child.material.dispose();
      group.add(vg);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  MATERIAL UPGRADE — Lambert → Phong with reflections (Feature 1)
  // ══════════════════════════════════════════════════════════
  function upgradeMaterials(group) {
    group.traverse(function (child) {
      if (!child.isMesh || !child.material) return;
      var mat = child.material;
      // Skip already-good PhongMaterial or BasicMaterial (emissives, transparents)
      if (mat.type === 'MeshPhongMaterial' && mat.shininess >= 30) return;
      if (mat.type === 'MeshBasicMaterial') return;
      if (mat.type !== 'MeshLambertMaterial') return;

      var hex = mat.color ? mat.color.getHex() : 0x333333;
      var r = (hex >> 16) & 0xFF, g = (hex >> 8) & 0xFF, b = hex & 0xFF;
      var bright = r + g + b;

      var newMat;
      if (bright < 120) {
        newMat = M.blackOxide.clone();
      } else if (bright < 250 && r > g && r > b) {
        newMat = M.walnut.clone();          // brownish → wood
      } else if (bright < 250 && g > r) {
        newMat = M.odGreen.clone();          // greenish → olive
      } else if (bright < 350) {
        newMat = M.gunMetal.clone();
      } else {
        newMat = M.parkerized.clone();
      }
      newMat.color.setHex(hex);
      if (mat.transparent) { newMat.transparent = true; newMat.opacity = mat.opacity; }
      child.material = newMat;
    });
  }

  // ══════════════════════════════════════════════════════════
  //  TYPE-BASED DETAIL ENHANCER — POST-BUILD (Features 11-31, 34, 36)
  // ══════════════════════════════════════════════════════════
  var RIFLE   = ['ASSAULT', 'NATO', 'NATO_HEAVY', 'LMG', 'SILENT', 'MACHINEGUN'];
  var SNIPER  = ['SNIPER', 'AMR'];
  var PISTOL  = ['PISTOL'];
  var SMG     = ['SMG'];
  var HMG     = ['HMG', 'HMG_HEAVY', 'MINIGUN', 'GATLING'];
  var LAUNCH  = ['AT', 'ATGM', 'AT_HEAVY', 'AT_LIGHT', 'AA', 'THERMOBARIC'];
  var THROWN  = ['GRENADE', 'INCENDIARY', 'SMOKE', 'FLASHBANG', 'MINE', 'EXPLOSIVE'];

  function enhanceMesh(group, weaponDef, weaponIdx) {
    initMaterials();
    var type = weaponDef.type;
    var id   = weaponDef.id;
    var anim = {};

    // 1. Upgrade every Lambert child → Phong with reflections
    upgradeMaterials(group);

    var isFirearm = type !== 'MELEE' && THROWN.indexOf(type) < 0;
    var isRifle   = RIFLE.indexOf(type) >= 0 || SMG.indexOf(type) >= 0;
    var isSniper  = SNIPER.indexOf(type) >= 0;
    var isPistol  = PISTOL.indexOf(type) >= 0;
    var isHmg     = HMG.indexOf(type) >= 0;
    var isLauncher = LAUNCH.indexOf(type) >= 0;

    // 2. Iron sights on non-scoped firearms (Features 11, 12)
    if (isFirearm && !weaponDef.hasScope && !isLauncher) {
      group.add(frontSight(0.17, -0.08, -0.55));
      group.add(rearSight(0.17, -0.08, -0.17));
    }

    // 3. Trigger + trigger guard (Features 13, 14)
    if (isFirearm && !isLauncher) {
      var trig = trigger(0.17, -0.195, -0.21);
      group.add(trig);
      group.add(triggerGuard(0.17, -0.19, -0.21));
      anim.trigger = trig;
    }

    // 4. Ejection port + bolt carrier (Feature 15)
    if (isRifle || isSniper) {
      group.add(ejectionPort(0.20, -0.12, -0.27));
      var bolt = boltCarrier(0.20, -0.12, -0.27);
      group.add(bolt);
      anim.bolt = bolt;
      anim.boltHome = bolt.position.z;
    }
    if (isPistol) {
      group.add(ejectionPort(0.19, -0.12, -0.25));
    }

    // 5. Charging handle on rifles (Feature 16)
    if (isRifle || isSniper) {
      var ch = chargingHandle(0.17, -0.095, -0.19);
      group.add(ch);
      anim.chargingHandle = ch;
    }

    // 6. Magazine release (Feature 17)
    if (isRifle || isPistol || SMG.indexOf(type) >= 0) {
      group.add(magRelease(0.20, -0.17, -0.22));
    }

    // 7. Forward assist on NATO rifles (Feature 18)
    if (type === 'NATO' || type === 'NATO_HEAVY') {
      group.add(forwardAssist(0.21, -0.11, -0.24));
    }

    // 8. Dust cover on AK-pattern (Feature 19)
    if (id === 'AK74' || id === 'AK12' || id === 'RPK74') {
      group.add(dustCover(0.20, -0.11, -0.25));
    }

    // 9. Muzzle brake (Feature 20)
    if (isRifle || isSniper) {
      group.add(muzzleBrake(0.17, -0.13, -0.62));
    }

    // 10. Picatinny rail (Feature 21)
    if (isRifle || type === 'NATO' || type === 'NATO_HEAVY') {
      group.add(railSegment(0.17, -0.095, -0.34, 0.12));
    }

    // 11. Scope enhancements (Features 22, 23, 39)
    if (weaponDef.hasScope) {
      group.add(scopeRing(0.17, -0.07, -0.23));
      group.add(scopeRing(0.17, -0.07, -0.33));
      group.add(scopeTurret(0.17, -0.045, -0.28));
      group.add(scopeTurret(0.19, -0.06, -0.28));
      var lens = scopeLens(0.17, -0.07, -0.39, 0.016);
      group.add(lens);
      group.add(scopeLens(0.17, -0.07, -0.19, 0.013));
      anim.scopeLens = lens;
    }

    // 12. Sling points (Feature 24)
    if (isRifle || isSniper || isHmg) {
      group.add(slingPoint(0.17, -0.16, -0.54));
      group.add(slingPoint(0.17, -0.16, -0.07));
    }

    // 13. Barrel threading (Feature 25)
    if (isRifle || SMG.indexOf(type) >= 0) {
      group.add(barrelThread(0.17, -0.13, -0.56, 0.025));
    }

    // 14. Screws + pins scatter (Feature 26)
    if (isFirearm) {
      group.add(screw(0.20, -0.13, -0.22));
      group.add(screw(0.20, -0.13, -0.25));
      group.add(pin(0.14, -0.15, -0.20));
      group.add(pin(0.14, -0.15, -0.23));
    }

    // 15. Bipod on MGs and sniper (Feature 31)
    if (type === 'LMG' || type === 'HMG' || type === 'MACHINEGUN' || type === 'HMG_HEAVY') {
      group.add(bipodDetail(0.17, -0.18, -0.50));
    }

    // 16. Laser module on rifles, SMGs, pistols, and launchers (Feature 34)
    if (isRifle || SMG.indexOf(type) >= 0 || isPistol || isLauncher) {
      var laserZ = isPistol ? -0.30 : isLauncher ? -0.35 : -0.40;
      var laserY = isPistol ? -0.16 : -0.07;
      group.add(laserModule(0.15, laserY, laserZ));
    }

    // 16b. Scope mounts + optics on pistols and launchers (tactical rail scope)
    if (isPistol) {
      group.add(railSegment(0.17, -0.115, -0.26, 0.06));
      group.add(scopeRing(0.17, -0.095, -0.24, 0.008));
      group.add(scopeRing(0.17, -0.095, -0.28, 0.008));
    }
    if (isLauncher && !weaponDef.hasScope) {
      group.add(railSegment(0.17, -0.04, -0.30, 0.08));
      group.add(scopeRing(0.17, -0.02, -0.26));
      group.add(scopeRing(0.17, -0.02, -0.34));
      group.add(scopeTurret(0.17, -0.01, -0.30));
      var launchLens = scopeLens(0.17, -0.02, -0.38, 0.012);
      group.add(launchLens);
    }

    // 17. Ammo counter on Gatling/Minigun (Feature 36)
    if (type === 'GATLING' || type === 'MINIGUN') {
      var counter = ammoCounter(0.22, -0.10, -0.14);
      group.add(counter);
      anim.ammoCounter = counter;
    }

    // 18. Gatling/Minigun barrel grouping for spin animation (Feature 29)
    if (type === 'GATLING' || type === 'MINIGUN') {
      var barrelGroup = new THREE.Group();
      var toMove = [];
      var cx = 0.17, cy = -0.12;
      for (var ci = group.children.length - 1; ci >= 0; ci--) {
        var child = group.children[ci];
        if (child.isMesh && child.geometry && child.geometry.parameters) {
          var p = child.geometry.parameters;
          if (p.radiusTop && p.radiusTop < 0.02 && p.height && p.height > 0.3) {
            toMove.push(child);
          }
        }
      }
      if (toMove.length > 2) {
        var avgZ = 0;
        for (var ti = 0; ti < toMove.length; ti++) avgZ += toMove[ti].position.z;
        avgZ /= toMove.length;
        barrelGroup.position.set(cx, cy, avgZ);
        for (var ti = 0; ti < toMove.length; ti++) {
          var c = toMove[ti];
          group.remove(c);
          c.position.set(c.position.x - cx, c.position.y - cy, c.position.z - avgZ);
          barrelGroup.add(c);
        }
        group.add(barrelGroup);
        anim.barrelGroup = barrelGroup;
      }
    }

    // Store animation references
    group.userData._anim = anim;
    group.userData._weaponType = type;
    group.userData._weaponId = id;

    // 19. Pistol slide grouping for animation (Feature 41)
    if (isPistol) {
      var slideGroup = null;
      for (var si = group.children.length - 1; si >= 0; si--) {
        var sch = group.children[si];
        if (sch.isGroup && sch.name === '_slide') { slideGroup = sch; break; }
      }
      if (!slideGroup) {
        // Auto-detect: barrel + top body meshes → slide
        slideGroup = new THREE.Group();
        slideGroup.name = '_slide';
        var slideParts = [];
        for (var si2 = group.children.length - 1; si2 >= 0; si2--) {
          var sch2 = group.children[si2];
          if (sch2.isMesh && sch2.position.y > -0.16 && sch2.position.y < -0.10) {
            slideParts.push(sch2);
          }
        }
        if (slideParts.length > 0) {
          for (var sp = 0; sp < slideParts.length; sp++) {
            group.remove(slideParts[sp]);
            slideGroup.add(slideParts[sp]);
          }
          group.add(slideGroup);
        }
      }
      if (slideGroup.children.length > 0) {
        anim.slide = slideGroup;
        anim.slideHome = slideGroup.position.z;
      }
    }

    // 20. VOXEL SUBDIVISION — Convert all mesh parts to Lego-like voxel cubes (Feature 40)
    // Skip melee and thrown for performance; voxelize everything else
    if (type !== 'MELEE' && THROWN.indexOf(type) < 0) {
      voxelizeGroup(group, VOXEL_SIZE);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  ANIMATION SYSTEM (Features 27-30, 32-33, 35)
  // ══════════════════════════════════════════════════════════
  var _boltTimer = 0;
  var _boltActive = false;
  var _slideTimer = 0;
  var _slideActive = false;
  var _gatlingAngle = 0;
  var _gatlingSpeed = 0;
  var _smokeParticles = [];
  var _scopeGlintTime = 0;
  var _laserLine = null;

  // Called when a weapon fires
  function onFire(mesh, weaponDef) {
    if (!mesh || !mesh.userData || !mesh.userData._anim) return;
    var anim = mesh.userData._anim;

    // Bolt cycling (Feature 27)
    if (anim.bolt) {
      _boltTimer = 0.055;
      _boltActive = true;
    }

    // Pistol slide cycling (Feature 41)
    if (anim.slide) {
      _slideTimer = 0.065;
      _slideActive = true;
    }

    // Trigger pull (Feature 28)
    if (anim.trigger) {
      anim.trigger.rotation.x = 0.15;
    }

    // Gatling spin ramp (Feature 29)
    if (weaponDef.type === 'GATLING' || weaponDef.type === 'MINIGUN') {
      _gatlingSpeed = Math.min(_gatlingSpeed + 2, 45);
    }

    // Muzzle smoke wisp (Feature 32)
    spawnSmoke(mesh);
  }

  function spawnSmoke(mesh) {
    if (!_scene) return;
    var pos = new THREE.Vector3(0.17, -0.11, -0.65);
    mesh.localToWorld(pos);
    var geo = new THREE.SphereGeometry(0.015 + Math.random() * 0.02, 4, 4);
    var mat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.25, depthWrite: false });
    var sm = new THREE.Mesh(geo, mat);
    sm.position.copy(pos);
    _scene.add(sm);
    _smokeParticles.push({
      mesh: sm, life: 0.6,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.4 + Math.random() * 0.3, (Math.random() - 0.5) * 0.2)
    });
    // Cap smoke particles
    while (_smokeParticles.length > 15) {
      var old = _smokeParticles.shift();
      _scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose();
    }
  }

  function updateAnimations(delta, mesh, weaponDef, isFiring) {
    if (!mesh || !mesh.userData || !mesh.userData._anim) return;
    var anim = mesh.userData._anim;

    // Bolt cycling (Feature 27)
    if (_boltActive && anim.bolt) {
      _boltTimer -= delta;
      var home = anim.boltHome || -0.27;
      if (_boltTimer > 0.028) {
        anim.bolt.position.z = home + (0.055 - _boltTimer) * 60 * 0.015;
      } else if (_boltTimer > 0) {
        anim.bolt.position.z = home + _boltTimer * 60 * 0.015;
      } else {
        anim.bolt.position.z = home;
        _boltActive = false;
      }
    }

    // Pistol slide cycling (Feature 41) — slide snaps back then returns
    if (_slideActive && anim.slide) {
      _slideTimer -= delta;
      var shome = anim.slideHome || 0;
      if (_slideTimer > 0.035) {
        anim.slide.position.z = shome + (0.065 - _slideTimer) * 50 * 0.012;
      } else if (_slideTimer > 0) {
        anim.slide.position.z = shome + _slideTimer * 50 * 0.012;
      } else {
        anim.slide.position.z = shome;
        _slideActive = false;
      }
    }

    // Trigger return spring (Feature 28)
    if (anim.trigger) {
      anim.trigger.rotation.x *= (1 - Math.min(1, delta * 22));
    }

    // Gatling barrel spin (Feature 29)
    if (anim.barrelGroup) {
      if (!isFiring) _gatlingSpeed *= (1 - Math.min(1, delta * 2.5));
      _gatlingAngle += _gatlingSpeed * delta;
      // Spin around the local Z axis (bore direction) using quaternion for clean rotation
      anim.barrelGroup.rotation.z = _gatlingAngle;
    }

    // Charging handle vibration (Feature 16)
    if (anim.chargingHandle && isFiring) {
      anim.chargingHandle.position.z += (Math.random() - 0.5) * 0.0015;
    }

    // Scope lens glint pulse (Feature 33)
    if (anim.scopeLens && anim.scopeLens.material) {
      _scopeGlintTime += delta;
      anim.scopeLens.material.opacity = 0.35 + Math.sin(_scopeGlintTime * 2.5) * 0.08;
    }

    // Muzzle smoke particles (Feature 32)
    for (var i = _smokeParticles.length - 1; i >= 0; i--) {
      var p = _smokeParticles[i];
      p.life -= delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      p.mesh.scale.setScalar(1 + (0.6 - p.life) * 1.8);
      p.mesh.material.opacity = Math.max(0, p.life * 0.4);
      if (p.life <= 0) {
        _scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose();
        _smokeParticles.splice(i, 1);
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  //  LASER BEAM (Feature 34)
  // ══════════════════════════════════════════════════════════
  function updateLaser(camera, active) {
    if (!_scene) return;
    if (!active) {
      if (_laserLine) _laserLine.visible = false;
      return;
    }
    if (!_laserLine) {
      initMaterials();
      var geo = new THREE.CylinderGeometry(0.0015, 0.0015, 50, 4);
      geo.rotateX(Math.PI / 2);
      _laserLine = new THREE.Mesh(geo, M.laserRed);
      _scene.add(_laserLine);
    }
    _laserLine.visible = true;
    var pos = camera.getWorldPosition(new THREE.Vector3());
    var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    _laserLine.position.copy(pos).addScaledVector(dir, 25);
    _laserLine.quaternion.copy(camera.quaternion);
  }

  // ══════════════════════════════════════════════════════════
  //  SCOPE OVERLAY (Feature 9)
  // ══════════════════════════════════════════════════════════
  var _scopeOverlay = null;

  function showScopeOverlay(show, hasScope) {
    if (!_scopeOverlay) _scopeOverlay = document.getElementById('scope-overlay');
    if (_scopeOverlay) {
      _scopeOverlay.style.display = (show && hasScope) ? 'block' : 'none';
    }
  }

  // ══════════════════════════════════════════════════════════
  //  WEAPON CAMO SYSTEM (Feature 37)
  // ══════════════════════════════════════════════════════════
  var CAMO = {
    DEFAULT:  null,
    WOODLAND: { a: 0x3a4a2a, b: 0x2a3a1a, c: 0x5a4a3a },
    DESERT:   { a: 0x9a8a6a, b: 0x7a6a4a, c: 0x5a4a2a },
    SNOW:     { a: 0xcccccc, b: 0xaaaaaa, c: 0x888888 },
    URBAN:    { a: 0x555555, b: 0x3a3a3a, c: 0x666666 },
    GOLD:     { a: 0xffd700, b: 0xdaa520, c: 0xb8860b },
    CHROME:   { a: 0xcccccc, b: 0xaaaaaa, c: 0xdddddd },
    BLOODIED: { a: 0x3a1a1a, b: 0x2a0a0a, c: 0x550000 },
  };

  function applyCamo(group, camoName) {
    var c = CAMO[camoName];
    if (!c) return;
    group.traverse(function (child) {
      if (!child.isMesh || !child.material || child.material.transparent) return;
      var hex = child.material.color ? child.material.color.getHex() : 0;
      var brightness = ((hex >> 16) & 0xFF) + ((hex >> 8) & 0xFF) + (hex & 0xFF);
      if (brightness < 200) child.material.color.setHex(c.b);
      else if (brightness < 400) child.material.color.setHex(c.a);
      else child.material.color.setHex(c.c);
    });
  }

  // ══════════════════════════════════════════════════════════
  //  BLOOD SPLATTER ON MELEE (Feature 38)
  // ══════════════════════════════════════════════════════════
  function addBloodSplatter(mesh) {
    if (!mesh) return;
    initMaterials();
    var splat = new THREE.Mesh(
      new THREE.PlaneGeometry(0.025, 0.025),
      M.blood.clone()
    );
    splat.position.set(
      0.17 + (Math.random() - 0.5) * 0.04,
      -0.42 - Math.random() * 0.06,
      -0.27
    );
    splat.rotation.set(Math.random() * 0.4, Math.random() * 0.4, Math.random() * Math.PI);
    mesh.add(splat);
    setTimeout(function () {
      mesh.remove(splat);
      splat.geometry.dispose();
      splat.material.dispose();
    }, 8000);
  }

  // ══════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════
  function init(scene, camera) {
    _scene = scene;
    _camera = camera;
    initMaterials();
  }

  function update(delta, currentMesh, weaponDef, weaponState, isFiring, isZoomed) {
    updateAnimations(delta, currentMesh, weaponDef, isFiring);
    // Laser (off when zoomed or melee/thrown)
    if (_camera) {
      var laserOff = !weaponDef || isZoomed ||
        weaponDef.type === 'MELEE' || THROWN.indexOf(weaponDef.type) >= 0;
      updateLaser(_camera, !laserOff);
    }
    showScopeOverlay(isZoomed, weaponDef && weaponDef.hasScope);
  }

  function clear() {
    for (var i = _smokeParticles.length - 1; i >= 0; i--) {
      if (_scene) _scene.remove(_smokeParticles[i].mesh);
      _smokeParticles[i].mesh.geometry.dispose();
      _smokeParticles[i].mesh.material.dispose();
    }
    _smokeParticles.length = 0;
    if (_laserLine && _scene) { _scene.remove(_laserLine); _laserLine = null; }
    _gatlingAngle = 0;
    _gatlingSpeed = 0;
    _boltTimer = 0;
    _boltActive = false;
    _scopeGlintTime = 0;
  }

  return {
    init: init,
    update: update,
    clear: clear,
    enhanceMesh: enhanceMesh,
    onFire: onFire,
    getZoomFov: getZoomFov,
    getAdsOffset: getAdsOffset,
    ZOOM_FOV: ZOOM_FOV,
    CAMO: CAMO,
    applyCamo: applyCamo,
    addBloodSplatter: addBloodSplatter,
    showScopeOverlay: showScopeOverlay,
  };
})();

if (typeof window !== 'undefined') window.WeaponDetails = WeaponDetails;
