// ══════════════════════════════════════════════════════════════
// ENVIRONMENTAL HAZARDS
// 8 dynamic environmental threats and disasters
// ══════════════════════════════════════════════════════════════

const EnvironmentalHazards = (() => {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // 1. TOXIC GAS CLOUDS
  // ──────────────────────────────────────────────────────────────
  const ToxicGas = {
    clouds: [],
    
    init() {
      this.clouds = [];
    },

    spawnCloud(x, z, radius = 15, duration = 45) {
      const cloud = {
        x, z,
        radius,
        spawnTime: Date.now() / 1000,
        duration,
        damage: 8, // per second
        spreadRate: 0.5, // radius growth per second
        maxRadius: radius * 2,
        color: 0x88ff44
      };
      this.clouds.push(cloud);
      return cloud;
    },

    update(dt, entities) {
      const now = Date.now() / 1000;

      // Remove expired clouds
      this.clouds = this.clouds.filter(c => 
        now - c.spawnTime < c.duration
      );

      this.clouds.forEach(cloud => {
        // Expand cloud
        if (cloud.radius < cloud.maxRadius) {
          cloud.radius += cloud.spreadRate * dt;
        }

        // Damage entities in cloud
        entities.forEach(entity => {
          const dx = entity.x - cloud.x;
          const dz = entity.z - cloud.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          if (dist < cloud.radius) {
            entity.toxicDamage = (entity.toxicDamage || 0) + cloud.damage * dt;
            entity.inToxicGas = true;
          }
        });
      });
    },

    getClouds() {
      return this.clouds;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 2. FLOODING SYSTEM
  // ──────────────────────────────────────────────────────────────
  const Flooding = {
    waterLevel: 0,
    rising: false,
    riseRate: 0.3, // blocks per second
    maxLevel: 10,
    
    init() {
      this.waterLevel = 0;
      this.rising = false;
    },

    startFlood() {
      this.rising = true;
    },

    stopFlood() {
      this.rising = false;
    },

    update(dt, entities, voxelWorld) {
      if (this.rising && this.waterLevel < this.maxLevel) {
        this.waterLevel += this.riseRate * dt;
      } else if (!this.rising && this.waterLevel > 0) {
        this.waterLevel = Math.max(0, this.waterLevel - this.riseRate * 0.5 * dt);
      }

      // Affect entities below water level
      entities.forEach(entity => {
        if (entity.y < this.waterLevel) {
          entity.swimming = true;
          entity.drowning = true;
          entity.drownDamage = (entity.drownDamage || 0) + 3 * dt;
          
          // Slow movement
          if (entity.vx !== undefined) {
            entity.vx *= 0.5;
            entity.vz *= 0.5;
          }
        }
      });

      // Destroy low blocks
      if (voxelWorld && this.waterLevel > 0) {
        // Mark blocks below water level for removal
        return { affectedBlocks: Math.floor(this.waterLevel) };
      }
    },

    getWaterLevel() {
      return this.waterLevel;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 3. SANDSTORM/DUST STORM
  // ──────────────────────────────────────────────────────────────
  const Sandstorm = {
    active: false,
    intensity: 0,
    maxIntensity: 1,
    buildupRate: 0.1,
    
    init() {
      this.active = false;
      this.intensity = 0;
    },

    start() {
      this.active = true;
    },

    end() {
      this.active = false;
    },

    update(dt, player, enemies) {
      // Build up or fade out
      if (this.active && this.intensity < this.maxIntensity) {
        this.intensity = Math.min(this.maxIntensity, this.intensity + this.buildupRate * dt);
      } else if (!this.active && this.intensity > 0) {
        this.intensity = Math.max(0, this.intensity - this.buildupRate * dt);
      }

      if (this.intensity > 0) {
        // Reduce visibility
        const visibilityReduction = this.intensity * 30;
        player.visibilityReduction = visibilityReduction;

        // Damage over time
        const damage = this.intensity * 2 * dt;
        player.sandDamage = (player.sandDamage || 0) + damage;

        // Reduce accuracy
        player.accuracyPenalty = this.intensity * 0.4;

        // Affect enemies too
        enemies.forEach(e => {
          e.visibilityReduction = visibilityReduction;
          e.accuracyPenalty = this.intensity * 0.5;
        });
      }
    },

    getIntensity() {
      return this.intensity;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 4. BLIZZARD SYSTEM
  // ──────────────────────────────────────────────────────────────
  const Blizzard = {
    active: false,
    severity: 0, // 0-1
    temperature: 20, // celsius
    
    init() {
      this.active = false;
      this.severity = 0;
      this.temperature = 20;
    },

    start(severity = 0.7) {
      this.active = true;
      this.severity = severity;
    },

    end() {
      this.active = false;
    },

    update(dt, player, npcs) {
      if (this.active) {
        // Drop temperature
        this.temperature = Math.max(-30, this.temperature - 5 * dt * this.severity);
        
        // Hypothermia damage
        if (this.temperature < 0) {
          const damage = Math.abs(this.temperature) * 0.1 * dt;
          player.coldDamage = (player.coldDamage || 0) + damage;
          
          // Slow movement
          const slowdown = Math.min(0.5, Math.abs(this.temperature) / 60);
          player.coldSlowdown = slowdown;
        }

        // Reduced visibility
        player.visibilityReduction = this.severity * 40;

        // NPCs affected
        npcs.forEach(npc => {
          npc.coldDamage = (npc.coldDamage || 0) + Math.abs(this.temperature) * 0.05 * dt;
          npc.coldSlowdown = Math.min(0.3, Math.abs(this.temperature) / 80);
        });
      } else if (this.temperature < 20) {
        // Warm up slowly
        this.temperature = Math.min(20, this.temperature + 2 * dt);
      }
    },

    getTemperature() {
      return this.temperature;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 5. EARTHQUAKE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const Earthquake = {
    active: false,
    magnitude: 0, // 0-10
    duration: 0,
    elapsed: 0,
    
    init() {
      this.active = false;
      this.magnitude = 0;
    },

    trigger(magnitude = 5, duration = 15) {
      this.active = true;
      this.magnitude = magnitude;
      this.duration = duration;
      this.elapsed = 0;
    },

    update(dt, player, voxelWorld, buildings) {
      if (!this.active) return;

      this.elapsed += dt;
      if (this.elapsed >= this.duration) {
        this.active = false;
        return;
      }

      // Camera shake intensity based on magnitude
      const shakeIntensity = this.magnitude * 0.15;
      player.earthquakeShake = shakeIntensity;

      // Random block destruction
      if (Math.random() < this.magnitude * 0.01 * dt && voxelWorld) {
        const x = Math.floor(player.position.x + (Math.random() - 0.5) * 30);
        const z = Math.floor(player.position.z + (Math.random() - 0.5) * 30);
        const y = Math.floor(Math.random() * 20);
        
        // Signal to destroy this block
        player.earthquakeDestroyBlock = { x, y, z };
      }

      // Damage buildings
      if (buildings && buildings.length > 0) {
        buildings.forEach(b => {
          if (Math.random() < this.magnitude * 0.005 * dt) {
            b.hp = Math.max(0, b.hp - this.magnitude * 5);
          }
        });
      }

      // Knock player around
      if (this.magnitude > 6) {
        player.vx = (player.vx || 0) + (Math.random() - 0.5) * this.magnitude * 0.3;
        player.vz = (player.vz || 0) + (Math.random() - 0.5) * this.magnitude * 0.3;
      }
    },

    isActive() {
      return this.active;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 6. COLLAPSING BUILDINGS
  // ──────────────────────────────────────────────────────────────
  const CollapsingBuildings = {
    collapsingStructures: [],
    
    init() {
      this.collapsingStructures = [];
    },

    triggerCollapse(building, x, z, width, height, depth) {
      const collapse = {
        building,
        x, z,
        width, height, depth,
        startTime: Date.now() / 1000,
        duration: 5,
        progress: 0,
        warningDuration: 3,
        warned: false
      };
      this.collapsingStructures.push(collapse);
      return collapse;
    },

    update(dt, player, voxelWorld) {
      const now = Date.now() / 1000;

      this.collapsingStructures.forEach(collapse => {
        const elapsed = now - collapse.startTime;
        collapse.progress = elapsed / collapse.duration;

        // Warning phase
        if (elapsed < collapse.warningDuration && !collapse.warned) {
          // Check if player is inside
          const inX = Math.abs(player.position.x - collapse.x) < collapse.width / 2;
          const inZ = Math.abs(player.position.z - collapse.z) < collapse.depth / 2;
          
          if (inX && inZ) {
            player.collapseWarning = true;
          }
        }

        // Actual collapse
        if (elapsed >= collapse.warningDuration && elapsed < collapse.duration) {
          // Destroy blocks progressively
          const layersToDrop = Math.floor((elapsed - collapse.warningDuration) / (collapse.duration - collapse.warningDuration) * collapse.height);
          
          collapse.currentLayer = collapse.height - layersToDrop;

          // Check if player is crushed
          const inX = Math.abs(player.position.x - collapse.x) < collapse.width / 2;
          const inZ = Math.abs(player.position.z - collapse.z) < collapse.depth / 2;
          
          if (inX && inZ && player.position.y < collapse.currentLayer + 2) {
            player.crushDamage = (player.crushDamage || 0) + 50 * dt;
          }
        }
      });

      // Remove completed collapses
      this.collapsingStructures = this.collapsingStructures.filter(c => c.progress < 1);
    },

    getCollapsingStructures() {
      return this.collapsingStructures;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 7. ELECTRIFIED WATER
  // ──────────────────────────────────────────────────────────────
  const ElectrifiedWater = {
    zones: [],
    
    init() {
      this.zones = [];
    },

    electrifyZone(x, z, radius = 10, voltage = 100, duration = 30) {
      const zone = {
        x, z,
        radius,
        voltage,
        startTime: Date.now() / 1000,
        duration,
        damage: voltage * 0.5, // 50 damage for 100V
        pulseInterval: 0.5,
        lastPulse: 0
      };
      this.zones.push(zone);
      return zone;
    },

    update(dt, entities) {
      const now = Date.now() / 1000;

      // Remove expired zones
      this.zones = this.zones.filter(z => 
        now - z.startTime < z.duration
      );

      this.zones.forEach(zone => {
        // Pulse effect
        if (now - zone.lastPulse >= zone.pulseInterval) {
          zone.lastPulse = now;

          // Damage entities in water
          entities.forEach(entity => {
            const dx = entity.x - zone.x;
            const dz = entity.z - zone.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist < zone.radius && entity.swimming) {
              entity.electricDamage = (entity.electricDamage || 0) + zone.damage;
              entity.stunned = true;
              entity.stunDuration = 1.5;
            }
          });
        }
      });
    },

    getZones() {
      return this.zones;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 8. TOXIC BARREL EXPLOSIONS
  // ──────────────────────────────────────────────────────────────
  const ToxicBarrels = {
    barrels: [],
    
    init() {
      this.barrels = [];
    },

    placeBarrel(x, y, z) {
      const barrel = {
        x, y, z,
        hp: 50,
        maxHP: 50,
        explosive: true,
        toxic: true,
        blastRadius: 8,
        blastDamage: 120,
        toxicRadius: 15,
        toxicDuration: 25
      };
      this.barrels.push(barrel);
      return barrel;
    },

    damageBarrel(barrel, damage) {
      barrel.hp -= damage;
      
      if (barrel.hp <= 0) {
        this.explodeBarrel(barrel);
        return true;
      }
      return false;
    },

    explodeBarrel(barrel) {
      barrel.exploded = true;
      barrel.explosionTime = Date.now() / 1000;
      
      // Will create explosion and toxic cloud
      barrel.createExplosion = true;
      barrel.createToxicCloud = true;
    },

    update(dt, entities) {
      this.barrels.forEach(barrel => {
        if (!barrel.exploded) return;

        // Damage nearby entities from blast
        if (barrel.createExplosion) {
          entities.forEach(entity => {
            const dx = entity.x - barrel.x;
            const dz = entity.z - barrel.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist < barrel.blastRadius) {
              const dmg = barrel.blastDamage * (1 - dist / barrel.blastRadius);
              entity.barrelBlastDamage = (entity.barrelBlastDamage || 0) + dmg;
            }
          });
          
          barrel.createExplosion = false;
        }
      });

      // Remove exploded barrels after animation
      const now = Date.now() / 1000;
      this.barrels = this.barrels.filter(b => 
        !b.exploded || (now - b.explosionTime < 1)
      );
    },

    getBarrels() {
      return this.barrels;
    },

    getActiveBarrels() {
      return this.barrels.filter(b => !b.exploded);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────
  return {
    init() {
      ToxicGas.init();
      Flooding.init();
      Sandstorm.init();
      Blizzard.init();
      Earthquake.init();
      CollapsingBuildings.init();
      ElectrifiedWater.init();
      ToxicBarrels.init();
    },

    update(dt, gameState) {
      const { player, enemies, npcs, voxelWorld, buildings } = gameState;
      
      // Add null checks for safety
      const safeEnemies = enemies || [];
      const safeNpcs = npcs || [];
      const safeBuildings = buildings || [];
      const allEntities = [player, ...safeEnemies, ...safeNpcs];
      
      ToxicGas.update(dt, allEntities);
      Flooding.update(dt, allEntities, voxelWorld);
      Sandstorm.update(dt, player, safeEnemies);
      Blizzard.update(dt, player, safeNpcs);
      Earthquake.update(dt, player, voxelWorld, safeBuildings);
      CollapsingBuildings.update(dt, player, voxelWorld);
      ElectrifiedWater.update(dt, allEntities);
      ToxicBarrels.update(dt, allEntities);
    },

    // Expose subsystems
    ToxicGas,
    Flooding,
    Sandstorm,
    Blizzard,
    Earthquake,
    CollapsingBuildings,
    ElectrifiedWater,
    ToxicBarrels
  };
})();
