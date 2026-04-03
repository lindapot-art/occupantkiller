// ══════════════════════════════════════════════════════════════
// STEALTH SYSTEM
// 6 stealth mechanics for tactical gameplay
// ══════════════════════════════════════════════════════════════

const StealthSystem = (() => {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // 1. SHADOW/LIGHT DETECTION
  // ──────────────────────────────────────────────────────────────
  const ShadowDetection = {
    shadowZones: [],
    detectionModifier: 1.0,
    
    init() {
      this.shadowZones = [];
      this.detectionModifier = 1.0;
    },

    createShadowZone(x, z, radius, darkness = 0.8) {
      const zone = {
        x, z,
        radius,
        darkness // 0 = full light, 1 = pitch black
      };
      this.shadowZones.push(zone);
      return zone;
    },

    update(dt, player, enemies, timeOfDay) {
      // Base detection based on time of day
      let baseDetection = 1.0;
      
      // Night time reduces detection
      if (timeOfDay >= 20 || timeOfDay <= 6) {
        baseDetection = 0.3;
      } else if (timeOfDay >= 18 || timeOfDay <= 8) {
        baseDetection = 0.6; // Dusk/dawn
      }

      // Check if player is in shadow
      let inShadow = false;
      let shadowDarkness = 0;

      this.shadowZones.forEach(zone => {
        const dx = player.x - zone.x;
        const dz = player.z - zone.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        
        if (dist < zone.radius) {
          inShadow = true;
          shadowDarkness = Math.max(shadowDarkness, zone.darkness);
        }
      });

      // Calculate final detection modifier
      if (inShadow) {
        this.detectionModifier = baseDetection * (1 - shadowDarkness * 0.7);
      } else {
        this.detectionModifier = baseDetection;
      }

      // Apply to enemies
      enemies.forEach(e => {
        e.detectionModifier = this.detectionModifier;
      });

      player.inShadow = inShadow;
      player.shadowDarkness = shadowDarkness;
    },

    getDetectionModifier() {
      return this.detectionModifier;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 2. NOISE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const NoiseSystem = {
    noiseSources: [],
    
    init() {
      this.noiseSources = [];
    },

    makeNoise(x, z, volume, type) {
      // volume: 0-100
      // type: 'FOOTSTEP', 'GUNSHOT', 'EXPLOSION', 'DOOR', 'GLASS', 'VOICE'
      const noise = {
        x, z,
        volume,
        type,
        timestamp: Date.now() / 1000,
        radius: volume * 0.5, // 0-50 unit radius
        decayRate: 2 // volume per second
      };
      
      this.noiseSources.push(noise);
      return noise;
    },

    update(dt, enemies) {
      const now = Date.now() / 1000;

      // Decay noise over time
      this.noiseSources.forEach(noise => {
        const age = now - noise.timestamp;
        noise.currentVolume = Math.max(0, noise.volume - age * noise.decayRate);
      });

      // Remove silent noises
      this.noiseSources = this.noiseSources.filter(n => n.currentVolume > 0);

      // Alert enemies to noise
      this.noiseSources.forEach(noise => {
        enemies.forEach(e => {
          const dx = e.x - noise.x;
          const dz = e.z - noise.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          if (dist < noise.radius && noise.currentVolume > 20) {
            e.heardNoise = true;
            e.noiseSource = { x: noise.x, z: noise.z };
            e.alertLevel = Math.min(100, (e.alertLevel || 0) + noise.currentVolume * 0.5);
          }
        });
      });
    },

    getNoiseSources() {
      return this.noiseSources;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 3. DISTRACTION ITEMS
  // ──────────────────────────────────────────────────────────────
  const DistractionItems = {
    activeDistractions: [],
    inventory: {
      ROCK: 10,
      BOTTLE: 5,
      SMOKE_GRENADE: 3,
      NOISE_MAKER: 2,
      DECOY: 1
    },
    
    init() {
      this.activeDistractions = [];
    },

    throwDistraction(type, x, z, player) {
      if ((this.inventory[type] || 0) <= 0) return null;

      this.inventory[type]--;

      const distraction = {
        type,
        x, z,
        throwTime: Date.now() / 1000,
        duration: this.getDuration(type),
        noise: this.getNoiseLevel(type),
        visual: this.isVisual(type),
        radius: this.getRadius(type)
      };

      this.activeDistractions.push(distraction);
      return distraction;
    },

    getDuration(type) {
      const durations = {
        ROCK: 3,
        BOTTLE: 5,
        SMOKE_GRENADE: 15,
        NOISE_MAKER: 20,
        DECOY: 30
      };
      return durations[type] || 3;
    },

    getNoiseLevel(type) {
      const levels = {
        ROCK: 40,
        BOTTLE: 60,
        SMOKE_GRENADE: 30,
        NOISE_MAKER: 80,
        DECOY: 50
      };
      return levels[type] || 30;
    },

    getRadius(type) {
      const radii = {
        ROCK: 8,
        BOTTLE: 12,
        SMOKE_GRENADE: 10,
        NOISE_MAKER: 25,
        DECOY: 15
      };
      return radii[type] || 10;
    },

    isVisual(type) {
      return type === 'SMOKE_GRENADE' || type === 'DECOY';
    },

    update(dt, enemies) {
      const now = Date.now() / 1000;

      // Remove expired distractions
      this.activeDistractions = this.activeDistractions.filter(d => 
        now - d.throwTime < d.duration
      );

      // Distract enemies
      this.activeDistractions.forEach(dist => {
        enemies.forEach(e => {
          const dx = e.x - dist.x;
          const dz = e.z - dist.z;
          const distToDistraction = Math.sqrt(dx*dx + dz*dz);
          
          if (distToDistraction < dist.radius) {
            e.distracted = true;
            e.distractionPoint = { x: dist.x, z: dist.z };
            e.distractionTime = 5; // seconds to investigate
          }
        });
      });
    },

    getActiveDistractions() {
      return this.activeDistractions;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 4. DISGUISE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const DisguiseSystem = {
    currentDisguise: null,
    disguises: {
      ENEMY_UNIFORM: { effectiveness: 0.8, duration: Infinity, suspicious: 0.02 },
      CIVILIAN: { effectiveness: 0.6, duration: Infinity, suspicious: 0.05 },
      GHILLIE_SUIT: { effectiveness: 0.9, duration: Infinity, suspicious: 0.01 }
    },
    
    init() {
      this.currentDisguise = null;
    },

    equip(type) {
      if (!this.disguises[type]) return false;
      
      this.currentDisguise = {
        type,
        ...this.disguises[type],
        equipTime: Date.now() / 1000,
        compromised: false
      };
      
      return true;
    },

    remove() {
      this.currentDisguise = null;
    },

    update(dt, player, enemies) {
      if (!this.currentDisguise) {
        player.disguised = false;
        return;
      }

      player.disguised = true;

      // Check if disguise is compromised
      if (!this.currentDisguise.compromised) {
        enemies.forEach(e => {
          const dx = e.x - player.x;
          const dz = e.z - player.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          // Close inspection can blow cover
          if (dist < 3 && Math.random() < this.currentDisguise.suspicious * dt) {
            this.currentDisguise.compromised = true;
            e.suspicious = true;
          }
        });
      }

      // Reduce enemy aggro based on effectiveness
      if (!this.currentDisguise.compromised) {
        enemies.forEach(e => {
          const detectionReduction = this.currentDisguise.effectiveness;
          e.detectionModifier = (e.detectionModifier || 1) * (1 - detectionReduction);
        });
      }
    },

    isDisguised() {
      return this.currentDisguise !== null && !this.currentDisguise.compromised;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 5. SILENT TAKEDOWN SYSTEM
  // ──────────────────────────────────────────────────────────────
  const SilentTakedown = {
    inProgress: false,
    target: null,
    progress: 0,
    requiredTime: 2.5, // seconds
    
    init() {
      this.inProgress = false;
      this.target = null;
      this.progress = 0;
    },

    initiateTakedown(player, enemy) {
      // Check if behind enemy and in range
      const dx = enemy.x - player.x;
      const dz = enemy.z - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist > 2.5) return false;

      // Check if behind
      const angleToPlayer = Math.atan2(dz, dx);
      const enemyFacing = enemy.yaw || 0;
      const angleDiff = Math.abs(angleToPlayer - enemyFacing);
      
      // Must be within 60 degrees of directly behind
      if (angleDiff < Math.PI * 0.66 || angleDiff > Math.PI * 1.33) return false;

      this.inProgress = true;
      this.target = enemy;
      this.progress = 0;
      return true;
    },

    update(dt, player) {
      if (!this.inProgress || !this.target) return;

      // Check if still in range
      const dx = this.target.x - player.x;
      const dz = this.target.z - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist > 3) {
        this.cancel();
        return;
      }

      // Progress takedown
      this.progress += dt;

      if (this.progress >= this.requiredTime) {
        this.complete();
      }
    },

    complete() {
      if (this.target) {
        this.target.hp = 0;
        this.target.silentKill = true;
        this.target.makeNoise = false;
      }
      
      this.inProgress = false;
      this.target = null;
      this.progress = 0;
    },

    cancel() {
      this.inProgress = false;
      this.target = null;
      this.progress = 0;
    },

    getProgress() {
      return this.inProgress ? this.progress / this.requiredTime : 0;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 6. BODY DRAGGING SYSTEM
  // ──────────────────────────────────────────────────────────────
  const BodyDragging = {
    draggedBody: null,
    hiddenBodies: [],
    
    init() {
      this.draggedBody = null;
      this.hiddenBodies = [];
    },

    startDrag(player, body) {
      const dx = body.x - player.x;
      const dz = body.z - player.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      if (dist > 2) return false;

      this.draggedBody = body;
      body.beingDragged = true;
      return true;
    },

    stopDrag() {
      if (this.draggedBody) {
        this.draggedBody.beingDragged = false;
        this.draggedBody = null;
      }
    },

    hideBody(body, x, z) {
      body.hidden = true;
      body.hiddenAt = { x, z };
      this.hiddenBodies.push(body);
      
      if (this.draggedBody === body) {
        this.stopDrag();
      }
    },

    update(dt, player, enemies) {
      // Update dragged body position
      if (this.draggedBody) {
        // Body follows player at offset
        const offsetDist = 1.5;
        const angle = player.yaw + Math.PI; // Behind player
        
        this.draggedBody.x = player.x + Math.cos(angle) * offsetDist;
        this.draggedBody.z = player.z + Math.sin(angle) * offsetDist;
        
        // Slow down player
        player.dragSlowdown = 0.5; // 50% speed reduction
      }

      // Enemies investigate visible bodies
      const visibleBodies = this.hiddenBodies.filter(b => !b.hidden);
      
      visibleBodies.forEach(body => {
        enemies.forEach(e => {
          const dx = e.x - body.x;
          const dz = e.z - body.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          if (dist < 15 && !body.investigated) {
            e.investigating = true;
            e.investigationTarget = body;
            e.alertLevel = (e.alertLevel || 0) + 50;
          }
        });
      });
    },

    isDragging() {
      return this.draggedBody !== null;
    },

    getHiddenBodies() {
      return this.hiddenBodies.filter(b => b.hidden);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────
  return {
    init() {
      ShadowDetection.init();
      NoiseSystem.init();
      DistractionItems.init();
      DisguiseSystem.init();
      SilentTakedown.init();
      BodyDragging.init();
    },

    update(dt, gameState) {
      const { player, enemies, timeOfDay } = gameState;
      
      ShadowDetection.update(dt, player, enemies, timeOfDay);
      NoiseSystem.update(dt, enemies);
      DistractionItems.update(dt, enemies);
      DisguiseSystem.update(dt, player, enemies);
      SilentTakedown.update(dt, player);
      BodyDragging.update(dt, player, enemies);
    },

    // Expose subsystems
    ShadowDetection,
    NoiseSystem,
    DistractionItems,
    DisguiseSystem,
    SilentTakedown,
    BodyDragging
  };
})();
