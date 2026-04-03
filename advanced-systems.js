// ══════════════════════════════════════════════════════════════
// ADVANCED TACTICAL SYSTEMS
// 10 high-level strategic features for command & control
// ══════════════════════════════════════════════════════════════

const AdvancedSystems = (() => {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // 1. TACTICAL COMMAND SYSTEM
  // ──────────────────────────────────────────────────────────────
  const TacticalCommand = {
    commandRadius: 30,
    commandBonus: 0.15, // 15% damage/accuracy boost
    activeCommands: [],
    cooldown: 60, // seconds
    lastCommandTime: 0,

    init() {
      this.activeCommands = [];
      this.lastCommandTime = 0;
    },

    issueCommand(player, type) {
      const now = Date.now() / 1000;
      if (now - this.lastCommandTime < this.cooldown) return false;

      const cmd = {
        type, // 'ATTACK', 'DEFEND', 'RETREAT', 'FLANK', 'SUPPRESSING_FIRE'
        position: { x: player.position.x, y: player.position.y, z: player.position.z },
        duration: 20,
        startTime: now,
        radius: this.commandRadius
      };

      this.activeCommands.push(cmd);
      this.lastCommandTime = now;
      return true;
    },

    update(dt, npcs) {
      const now = Date.now() / 1000;
      this.activeCommands = this.activeCommands.filter(cmd => 
        now - cmd.startTime < cmd.duration
      );

      // Apply command bonuses to NPCs in range
      this.activeCommands.forEach(cmd => {
        npcs.forEach(npc => {
          const dx = npc.x - cmd.position.x;
          const dz = npc.z - cmd.position.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          if (dist < cmd.radius) {
            npc.commandBonus = this.commandBonus;
            npc.activeCommand = cmd.type;
          }
        });
      });
    },

    getActiveCommands() {
      return this.activeCommands;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 2. SUPPLY LINE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const SupplyLines = {
    supplyRoutes: [],
    supplyDepots: [],
    convoySpeed: 5,
    convoyHealth: 150,

    init() {
      this.supplyRoutes = [];
      this.supplyDepots = [];
    },

    createDepot(x, z) {
      const depot = {
        x, z,
        supplies: 500,
        maxSupplies: 1000,
        regenRate: 2, // per second
        radius: 8
      };
      this.supplyDepots.push(depot);
      return depot;
    },

    createRoute(fromDepot, toDepot) {
      const route = {
        from: fromDepot,
        to: toDepot,
        convoy: null,
        active: true,
        interval: 120 // seconds between convoys
      };
      this.supplyRoutes.push(route);
      return route;
    },

    update(dt, player) {
      // Regenerate depot supplies
      this.supplyDepots.forEach(depot => {
        if (depot.supplies < depot.maxSupplies) {
          depot.supplies = Math.min(
            depot.maxSupplies,
            depot.supplies + depot.regenRate * dt
          );
        }

        // Player in depot range = auto-resupply
        const dx = player.position.x - depot.x;
        const dz = player.position.z - depot.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        
        if (dist < depot.radius && depot.supplies > 0) {
          player.supplyBonus = true; // Flag for game-manager to handle
          depot.supplies = Math.max(0, depot.supplies - 10 * dt);
        }
      });

      // Update convoys (simplified - just track progress)
      this.supplyRoutes.forEach(route => {
        if (route.convoy) {
          route.convoy.progress += this.convoySpeed * dt;
          if (route.convoy.progress >= route.convoy.distance) {
            // Convoy arrived
            route.to.supplies = Math.min(
              route.to.maxSupplies,
              route.to.supplies + route.convoy.cargo
            );
            route.convoy = null;
          }
        }
      });
    },

    getDepots() {
      return this.supplyDepots;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 3. MORALE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const MoraleSystem = {
    globalMorale: 100,
    maxMorale: 150,
    minMorale: 0,
    
    factors: {
      kill: 2,
      death: -5,
      waveComplete: 10,
      waveFailed: -15,
      commanderPresent: 0.5, // per second
      lowHealth: -0.2, // per second if HP < 30%
      victory: 20,
      defeat: -30
    },

    init() {
      this.globalMorale = 100;
    },

    adjustMorale(amount, reason) {
      this.globalMorale = Math.max(
        this.minMorale,
        Math.min(this.maxMorale, this.globalMorale + amount)
      );
      return { newMorale: this.globalMorale, reason };
    },

    update(dt, player, npcs) {
      // Commander presence boost
      if (player.rank >= 3) { // Officer or higher
        this.adjustMorale(this.factors.commanderPresent * dt, 'commander');
      }

      // Low health penalty
      if (player.hp < player.maxHp * 0.3) {
        this.adjustMorale(this.factors.lowHealth * dt, 'lowHealth');
      }

      // Natural decay towards 100
      if (this.globalMorale > 100) {
        this.globalMorale -= 1 * dt;
      } else if (this.globalMorale < 100) {
        this.globalMorale += 0.5 * dt;
      }
    },

    getMoraleMultiplier() {
      // 0.7x at 0 morale, 1.0x at 100, 1.3x at 150
      return 0.7 + (this.globalMorale / 100) * 0.6;
    },

    getMorale() {
      return this.globalMorale;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 4. ADVANCED FORTIFICATION SYSTEM
  // ──────────────────────────────────────────────────────────────
  const Fortifications = {
    structures: [],
    types: {
      BUNKER: { hp: 400, cost: 100, buildTime: 10, protection: 0.6 },
      TRENCH: { hp: 200, cost: 50, buildTime: 5, protection: 0.4 },
      WATCHTOWER: { hp: 150, cost: 80, buildTime: 8, visionBonus: 20 },
      MACHINEGUN_NEST: { hp: 250, cost: 120, buildTime: 12, damage: 30, fireRate: 0.2 },
      ANTI_TANK: { hp: 200, cost: 150, buildTime: 15, damage: 200, fireRate: 2 },
      CHECKPOINT: { hp: 300, cost: 90, buildTime: 7, slowsEnemies: 0.5 }
    },

    init() {
      this.structures = [];
    },

    build(type, x, z, player) {
      const config = this.types[type];
      if (!config) return null;

      const structure = {
        type,
        x, z,
        hp: config.hp,
        maxHP: config.hp,
        buildProgress: 0,
        buildTime: config.buildTime,
        active: false,
        lastFireTime: 0,
        ...config
      };

      this.structures.push(structure);
      return structure;
    },

    update(dt, enemies, player) {
      this.structures = this.structures.filter(s => s.hp > 0);

      this.structures.forEach(s => {
        // Build progress
        if (!s.active && s.buildProgress < s.buildTime) {
          s.buildProgress += dt;
          if (s.buildProgress >= s.buildTime) {
            s.active = true;
          }
        }

        if (!s.active) return;

        // Automated defenses
        if (s.type === 'MACHINEGUN_NEST' || s.type === 'ANTI_TANK') {
          const now = Date.now() / 1000;
          if (now - s.lastFireTime >= s.fireRate) {
            // Find nearest enemy
            let nearest = null;
            let nearestDist = Infinity;
            
            enemies.forEach(e => {
              const dx = e.x - s.x;
              const dz = e.z - s.z;
              const dist = Math.sqrt(dx*dx + dz*dz);
              const range = s.type === 'MACHINEGUN_NEST' ? 25 : 40;
              
              if (dist < range && dist < nearestDist) {
                nearest = e;
                nearestDist = dist;
              }
            });

            if (nearest) {
              nearest.pendingDamage = (nearest.pendingDamage || 0) + s.damage;
              s.lastFireTime = now;
            }
          }
        }

        // Watchtower vision bonus
        if (s.type === 'WATCHTOWER') {
          const dx = player.position.x - s.x;
          const dz = player.position.z - s.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          if (dist < 15) {
            player.visionBonus = s.visionBonus;
          }
        }
      });
    },

    getStructures() {
      return this.structures;
    },

    damageStructure(structure, damage) {
      structure.hp = Math.max(0, structure.hp - damage);
      return structure.hp <= 0;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 5. ARTILLERY STRIKE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const ArtillerySystem = {
    strikes: [],
    types: {
      MORTAR: { delay: 3, damage: 80, radius: 6, cost: 50, shells: 3 },
      HOWITZER: { delay: 5, damage: 150, radius: 10, cost: 100, shells: 1 },
      MLRS: { delay: 4, damage: 60, radius: 5, cost: 120, shells: 12 },
      PRECISION: { delay: 6, damage: 200, radius: 4, cost: 150, shells: 1 },
      CREEPING: { delay: 2, damage: 50, radius: 5, cost: 80, shells: 20 }
    },

    init() {
      this.strikes = [];
    },

    callStrike(type, x, z) {
      const config = this.types[type];
      if (!config) return null;

      const strike = {
        type,
        x, z,
        delay: config.delay,
        damage: config.damage,
        radius: config.radius,
        shells: config.shells,
        shellsFired: 0,
        startTime: Date.now() / 1000,
        active: false
      };

      this.strikes.push(strike);
      return strike;
    },

    update(dt, enemies) {
      const now = Date.now() / 1000;

      this.strikes.forEach(strike => {
        if (!strike.active && now - strike.startTime >= strike.delay) {
          strike.active = true;
        }

        if (strike.active && strike.shellsFired < strike.shells) {
          // Fire a shell every 0.5 seconds for MLRS/CREEPING
          const fireInterval = strike.type === 'MLRS' || strike.type === 'CREEPING' ? 0.5 : 1;
          const timeSinceActive = now - (strike.startTime + strike.delay);
          const shouldFire = Math.floor(timeSinceActive / fireInterval);
          
          if (shouldFire > strike.shellsFired) {
            strike.shellsFired++;
            
            // Apply damage to enemies in radius
            const impactX = strike.type === 'CREEPING' 
              ? strike.x + (strike.shellsFired * 2) 
              : strike.x + (Math.random() - 0.5) * 3;
            const impactZ = strike.z + (Math.random() - 0.5) * 3;

            enemies.forEach(e => {
              const dx = e.x - impactX;
              const dz = e.z - impactZ;
              const dist = Math.sqrt(dx*dx + dz*dz);
              
              if (dist < strike.radius) {
                const dmg = strike.damage * (1 - dist / strike.radius);
                e.pendingDamage = (e.pendingDamage || 0) + dmg;
              }
            });
          }
        }
      });

      // Remove completed strikes
      this.strikes = this.strikes.filter(s => s.shellsFired < s.shells);
    },

    getActiveStrikes() {
      return this.strikes.filter(s => s.active);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 6. RECONNAISSANCE NETWORK
  // ──────────────────────────────────────────────────────────────
  const ReconNetwork = {
    sensors: [],
    detectedEnemies: new Map(),
    sensorTypes: {
      MOTION: { range: 20, duration: 180, cost: 30 },
      ACOUSTIC: { range: 30, duration: 120, cost: 40 },
      SEISMIC: { range: 25, duration: 240, cost: 35 },
      THERMAL: { range: 35, duration: 150, cost: 50 }
    },

    init() {
      this.sensors = [];
      this.detectedEnemies.clear();
    },

    deploySensor(type, x, z) {
      const config = this.sensorTypes[type];
      if (!config) return null;

      const sensor = {
        type,
        x, z,
        range: config.range,
        deployTime: Date.now() / 1000,
        duration: config.duration,
        active: true
      };

      this.sensors.push(sensor);
      return sensor;
    },

    update(dt, enemies) {
      const now = Date.now() / 1000;
      
      // Remove expired sensors
      this.sensors = this.sensors.filter(s => 
        now - s.deployTime < s.duration
      );

      // Detect enemies
      this.detectedEnemies.clear();
      
      this.sensors.forEach(sensor => {
        enemies.forEach(e => {
          const dx = e.x - sensor.x;
          const dz = e.z - sensor.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          if (dist < sensor.range) {
            this.detectedEnemies.set(e, {
              detectedBy: sensor.type,
              position: { x: e.x, z: e.z },
              timestamp: now
            });
          }
        });
      });
    },

    isEnemyDetected(enemy) {
      return this.detectedEnemies.has(enemy);
    },

    getDetectedEnemies() {
      return Array.from(this.detectedEnemies.keys());
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 7. ELECTRONIC WARFARE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const ElectronicWarfare = {
    jammers: [],
    hackAttempts: [],
    
    init() {
      this.jammers = [];
      this.hackAttempts = [];
    },

    deployJammer(x, z, radius = 15, duration = 60) {
      const jammer = {
        x, z,
        radius,
        deployTime: Date.now() / 1000,
        duration,
        active: true
      };
      this.jammers.push(jammer);
      return jammer;
    },

    attemptHack(target, player) {
      const hackTime = 8; // seconds
      const attempt = {
        target,
        startTime: Date.now() / 1000,
        duration: hackTime,
        progress: 0,
        success: false
      };
      this.hackAttempts.push(attempt);
      return attempt;
    },

    update(dt, enemies, drones) {
      const now = Date.now() / 1000;

      // Remove expired jammers
      this.jammers = this.jammers.filter(j => 
        now - j.deployTime < j.duration
      );

      // Jammer effects
      this.jammers.forEach(jammer => {
        // Disable enemy drones in range
        drones.forEach(drone => {
          if (drone.faction === 'enemy') {
            const dx = drone.x - jammer.x;
            const dz = drone.z - jammer.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist < jammer.radius) {
              drone.jammed = true;
              drone.battery = Math.max(0, drone.battery - 2 * dt);
            }
          }
        });

        // Reduce enemy accuracy
        enemies.forEach(e => {
          const dx = e.x - jammer.x;
          const dz = e.z - jammer.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          if (dist < jammer.radius) {
            e.accuracyPenalty = 0.5; // 50% accuracy loss
          }
        });
      });

      // Update hack attempts
      this.hackAttempts.forEach(attempt => {
        attempt.progress += dt;
        if (attempt.progress >= attempt.duration) {
          attempt.success = true;
          // Convert enemy drone to friendly
          if (attempt.target.faction === 'enemy') {
            attempt.target.faction = 'player';
          }
        }
      });

      this.hackAttempts = this.hackAttempts.filter(a => a.progress < a.duration);
    },

    isInJammedZone(x, z) {
      return this.jammers.some(j => {
        const dx = x - j.x;
        const dz = z - j.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        return dist < j.radius;
      });
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 8. FIELD MEDICAL SYSTEM
  // ──────────────────────────────────────────────────────────────
  const MedicalSystem = {
    medics: [],
    casualties: [],
    triage: {
      CRITICAL: { priority: 3, bleedRate: 5 },
      SERIOUS: { priority: 2, bleedRate: 2 },
      STABLE: { priority: 1, bleedRate: 0 }
    },

    init() {
      this.medics = [];
      this.casualties = [];
    },

    assignMedic(npc) {
      npc.role = 'MEDIC';
      npc.healRate = 15; // HP per second
      npc.reviveTime = 10; // seconds
      this.medics.push(npc);
    },

    reportCasualty(npc, severity) {
      const casualty = {
        npc,
        severity, // CRITICAL, SERIOUS, STABLE
        reportTime: Date.now() / 1000,
        bleeding: true,
        bleedDamage: 0,
        assignedMedic: null
      };
      this.casualties.push(casualty);
      return casualty;
    },

    update(dt, npcs) {
      // Casualties bleed out
      this.casualties.forEach(cas => {
        if (cas.bleeding) {
          const bleedRate = this.triage[cas.severity].bleedRate;
          cas.bleedDamage += bleedRate * dt;
          cas.npc.hp = Math.max(0, cas.npc.hp - bleedRate * dt);
        }
      });

      // Assign medics to casualties
      this.medics.forEach(medic => {
        if (!medic.currentPatient) {
          // Find highest priority casualty
          let best = null;
          let bestPriority = 0;
          
          this.casualties.forEach(cas => {
            const priority = this.triage[cas.severity].priority;
            if (priority > bestPriority && !cas.assignedMedic) {
              best = cas;
              bestPriority = priority;
            }
          });

          if (best) {
            medic.currentPatient = best;
            best.assignedMedic = medic;
          }
        }

        // Treat patient
        if (medic.currentPatient) {
          const dx = medic.x - medic.currentPatient.npc.x;
          const dz = medic.z - medic.currentPatient.npc.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          if (dist < 2) {
            // In range - apply healing
            medic.currentPatient.npc.hp = Math.min(
              medic.currentPatient.npc.maxHP,
              medic.currentPatient.npc.hp + medic.healRate * dt
            );
            medic.currentPatient.bleeding = false;
            
            if (medic.currentPatient.npc.hp >= medic.currentPatient.npc.maxHP * 0.8) {
              // Patient stabilized
              this.casualties = this.casualties.filter(c => c !== medic.currentPatient);
              medic.currentPatient = null;
            }
          }
        }
      });

      // Remove dead casualties
      this.casualties = this.casualties.filter(c => c.npc.hp > 0);
    },

    getCasualties() {
      return this.casualties;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 9. LOGISTICS HUB
  // ──────────────────────────────────────────────────────────────
  const LogisticsHub = {
    hubs: [],
    
    init() {
      this.hubs = [];
    },

    createHub(x, z) {
      const hub = {
        x, z,
        level: 1,
        maxLevel: 5,
        storage: {
          wood: 0, metal: 0, energy: 0, fuel: 0, stone: 0, food: 0
        },
        capacity: 1000,
        productionRate: 5, // per second
        distribution: []
      };
      this.hubs.push(hub);
      return hub;
    },

    upgradeHub(hub) {
      if (hub.level < hub.maxLevel) {
        hub.level++;
        hub.capacity += 500;
        hub.productionRate += 2;
        return true;
      }
      return false;
    },

    update(dt, player) {
      this.hubs.forEach(hub => {
        // Auto-produce resources
        const resourceTypes = Object.keys(hub.storage);
        resourceTypes.forEach(type => {
          const total = Object.values(hub.storage).reduce((a, b) => a + b, 0);
          if (total < hub.capacity) {
            hub.storage[type] += hub.productionRate * dt / resourceTypes.length;
          }
        });

        // Distribute to player if nearby
        const dx = player.position.x - hub.x;
        const dz = player.position.z - hub.z;
        const dist = Math.sqrt(dx*dx + dz*dz);
        
        if (dist < 10) {
          player.nearLogisticsHub = hub;
        }
      });
    },

    transferToPlayer(hub, player, resourceType, amount) {
      if (hub.storage[resourceType] >= amount) {
        hub.storage[resourceType] -= amount;
        return amount;
      }
      return 0;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 10. CALL-IN SUPPORT SYSTEM
  // ──────────────────────────────────────────────────────────────
  const CallInSupport = {
    availableSupport: {
      AMMO_DROP: { cooldown: 45, cost: 25, active: true },
      MEDEVAC: { cooldown: 90, cost: 50, active: true },
      REINFORCEMENTS: { cooldown: 120, cost: 100, active: true },
      AIR_SUPPORT: { cooldown: 180, cost: 150, active: true },
      RESUPPLY: { cooldown: 60, cost: 40, active: true }
    },
    lastCallTimes: {},

    init() {
      this.lastCallTimes = {};
    },

    callSupport(type, x, z, player) {
      const support = this.availableSupport[type];
      if (!support) return null;

      const now = Date.now() / 1000;
      const lastCall = this.lastCallTimes[type] || 0;
      
      if (now - lastCall < support.cooldown) {
        return { error: 'ON_COOLDOWN', remaining: support.cooldown - (now - lastCall) };
      }

      this.lastCallTimes[type] = now;

      return {
        type,
        position: { x, z },
        eta: 5 + Math.random() * 3, // 5-8 seconds
        callTime: now
      };
    },

    getCooldowns() {
      const now = Date.now() / 1000;
      const cooldowns = {};
      
      Object.keys(this.availableSupport).forEach(type => {
        const lastCall = this.lastCallTimes[type] || 0;
        const elapsed = now - lastCall;
        const remaining = Math.max(0, this.availableSupport[type].cooldown - elapsed);
        cooldowns[type] = {
          ready: remaining === 0,
          remaining
        };
      });

      return cooldowns;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────
  return {
    init() {
      TacticalCommand.init();
      SupplyLines.init();
      MoraleSystem.init();
      Fortifications.init();
      ArtillerySystem.init();
      ReconNetwork.init();
      ElectronicWarfare.init();
      MedicalSystem.init();
      LogisticsHub.init();
      CallInSupport.init();
    },

    update(dt, gameState) {
      const { player, enemies, npcs, drones } = gameState;
      
      // Add null checks for safety
      const safeEnemies = enemies || [];
      const safeNpcs = npcs || [];
      const safeDrones = drones || [];
      
      TacticalCommand.update(dt, safeNpcs);
      SupplyLines.update(dt, player);
      MoraleSystem.update(dt, player, safeNpcs);
      Fortifications.update(dt, safeEnemies, player);
      ArtillerySystem.update(dt, safeEnemies);
      ReconNetwork.update(dt, safeEnemies);
      ElectronicWarfare.update(dt, safeEnemies, safeDrones);
      MedicalSystem.update(dt, safeNpcs);
      LogisticsHub.update(dt, player);
    },

    // Expose subsystems
    TacticalCommand,
    SupplyLines,
    MoraleSystem,
    Fortifications,
    ArtillerySystem,
    ReconNetwork,
    ElectronicWarfare,
    MedicalSystem,
    LogisticsHub,
    CallInSupport
  };
})();
