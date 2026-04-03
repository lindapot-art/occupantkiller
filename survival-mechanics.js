// ══════════════════════════════════════════════════════════════
// SURVIVAL MECHANICS
// 8 hardcore survival systems for realistic gameplay
// ══════════════════════════════════════════════════════════════

const SurvivalMechanics = (() => {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // 1. HUNGER SYSTEM
  // ──────────────────────────────────────────────────────────────
  const HungerSystem = {
    hunger: 100, // 0-100, 100 = full
    maxHunger: 100,
    depletionRate: 1.5, // per minute (0.025 per second)
    
    init() {
      this.hunger = 100;
    },

    update(dt, player) {
      // Deplete hunger over time
      this.hunger = Math.max(0, this.hunger - (this.depletionRate / 60) * dt);

      // Faster depletion when active
      if (player.sprinting) {
        this.hunger = Math.max(0, this.hunger - (this.depletionRate / 60) * dt * 2);
      }

      // Effects based on hunger level
      if (this.hunger < 30) {
        player.hungerPenalty = {
          staminaRegen: 0.5,
          healthRegen: 0.3,
          maxStamina: 0.7
        };
      } else if (this.hunger < 60) {
        player.hungerPenalty = {
          staminaRegen: 0.8,
          healthRegen: 0.7,
          maxStamina: 0.9
        };
      } else {
        player.hungerPenalty = null;
      }

      // Starvation damage
      if (this.hunger === 0) {
        player.starvationDamage = (player.starvationDamage || 0) + 2 * dt;
      }
    },

    eat(foodValue) {
      this.hunger = Math.min(this.maxHunger, this.hunger + foodValue);
      return this.hunger;
    },

    getHunger() {
      return this.hunger;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 2. THIRST SYSTEM
  // ──────────────────────────────────────────────────────────────
  const ThirstSystem = {
    thirst: 100, // 0-100, 100 = hydrated
    maxThirst: 100,
    depletionRate: 2, // per minute (faster than hunger)
    
    init() {
      this.thirst = 100;
    },

    update(dt, player, temperature) {
      // Base depletion
      let rate = this.depletionRate / 60;

      // Faster in hot weather
      if (temperature > 30) {
        rate *= 1.5;
      }

      // Faster when exerting
      if (player.sprinting) {
        rate *= 2;
      }

      this.thirst = Math.max(0, this.thirst - rate * dt);

      // Effects based on thirst level
      if (this.thirst < 20) {
        player.thirstPenalty = {
          staminaDrain: 2.0,
          aimShake: 0.3,
          moveSpeed: 0.6
        };
      } else if (this.thirst < 50) {
        player.thirstPenalty = {
          staminaDrain: 1.5,
          aimShake: 0.15,
          moveSpeed: 0.8
        };
      } else {
        player.thirstPenalty = null;
      }

      // Dehydration damage
      if (this.thirst === 0) {
        player.dehydrationDamage = (player.dehydrationDamage || 0) + 5 * dt;
      }
    },

    drink(waterValue) {
      this.thirst = Math.min(this.maxThirst, this.thirst + waterValue);
      return this.thirst;
    },

    getThirst() {
      return this.thirst;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 3. TEMPERATURE REGULATION
  // ──────────────────────────────────────────────────────────────
  const TemperatureSystem = {
    bodyTemp: 37, // celsius, normal = 37
    normalTemp: 37,
    minTemp: 30,
    maxTemp: 42,
    
    init() {
      this.bodyTemp = 37;
    },

    update(dt, player, environmentTemp) {
      // Body temp moves towards environment temp
      const tempDiff = environmentTemp - this.bodyTemp;
      const changeRate = 0.5; // degrees per minute
      
      this.bodyTemp += (tempDiff * changeRate / 60) * dt;
      this.bodyTemp = Math.max(this.minTemp, Math.min(this.maxTemp, this.bodyTemp));

      // Hypothermia (< 35°C)
      if (this.bodyTemp < 35) {
        const severity = (35 - this.bodyTemp) / 5; // 0-1
        player.hypothermia = {
          shivering: severity > 0.2,
          moveSpeed: 1 - severity * 0.5,
          staminaDrain: 1 + severity,
          damage: severity > 0.6 ? severity * 3 * dt : 0
        };
      } else {
        player.hypothermia = null;
      }

      // Hyperthermia (> 38°C)
      if (this.bodyTemp > 38) {
        const severity = (this.bodyTemp - 38) / 4; // 0-1
        player.hyperthermia = {
          sweating: severity > 0.1,
          thirstRate: 1 + severity * 2,
          staminaMax: 1 - severity * 0.4,
          damage: severity > 0.7 ? severity * 4 * dt : 0
        };
      } else {
        player.hyperthermia = null;
      }
    },

    getBodyTemp() {
      return this.bodyTemp;
    },

    getStatus() {
      if (this.bodyTemp < 35) return 'HYPOTHERMIC';
      if (this.bodyTemp > 38) return 'HYPERTHERMIC';
      return 'NORMAL';
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 4. FATIGUE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const FatigueSystem = {
    fatigue: 0, // 0-100, 0 = fresh, 100 = exhausted
    maxFatigue: 100,
    gainRate: 3, // per minute of activity
    restRate: 10, // per minute of rest
    
    init() {
      this.fatigue = 0;
    },

    update(dt, player) {
      // Gain fatigue from activity
      if (player.sprinting) {
        this.fatigue = Math.min(this.maxFatigue, this.fatigue + (this.gainRate / 60) * dt * 2);
      } else if (player.moving) {
        this.fatigue = Math.min(this.maxFatigue, this.fatigue + (this.gainRate / 60) * dt);
      } else {
        // Rest reduces fatigue
        this.fatigue = Math.max(0, this.fatigue - (this.restRate / 60) * dt);
      }

      // Carrying weight increases fatigue
      if (player.carryWeight > 30) {
        const weightFactor = (player.carryWeight - 30) / 50;
        this.fatigue = Math.min(this.maxFatigue, this.fatigue + weightFactor * dt);
      }

      // Effects based on fatigue level
      if (this.fatigue > 70) {
        player.fatiguePenalty = {
          moveSpeed: 0.7,
          aimShake: 0.4,
          staminaMax: 0.5,
          breathingNoise: true
        };
      } else if (this.fatigue > 40) {
        player.fatiguePenalty = {
          moveSpeed: 0.85,
          aimShake: 0.2,
          staminaMax: 0.75,
          breathingNoise: false
        };
      } else {
        player.fatiguePenalty = null;
      }
    },

    rest(duration) {
      this.fatigue = Math.max(0, this.fatigue - this.restRate * (duration / 60));
    },

    getFatigue() {
      return this.fatigue;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 5. INJURY SYSTEM
  // ──────────────────────────────────────────────────────────────
  const InjurySystem = {
    injuries: [],
    types: {
      BLEEDING: { 
        damagePerSec: 3, 
        treatmentTime: 5, 
        requiresBandage: true 
      },
      FRACTURE: { 
        moveSpeed: 0.6, 
        aimPenalty: 0.3, 
        treatmentTime: 15, 
        requiresSplint: true 
      },
      CONCUSSION: { 
        visionBlur: 0.5, 
        aimShake: 0.4, 
        duration: 30, 
        requiresPainkillers: true 
      },
      BURN: { 
        damagePerSec: 2, 
        duration: 20, 
        requiresMedkit: true 
      },
      POISON: { 
        damagePerSec: 4, 
        duration: 15, 
        requiresAntidote: true 
      }
    },
    
    init() {
      this.injuries = [];
    },

    addInjury(type, severity = 1.0) {
      const config = this.types[type];
      if (!config) return null;

      const injury = {
        type,
        severity, // 0.5 = minor, 1.0 = standard, 2.0 = severe
        timestamp: Date.now() / 1000,
        ...config
      };

      this.injuries.push(injury);
      return injury;
    },

    update(dt, player) {
      const now = Date.now() / 1000;

      // Remove expired injuries
      this.injuries = this.injuries.filter(inj => {
        if (inj.duration) {
          return (now - inj.timestamp) < inj.duration;
        }
        return true;
      });

      // Apply injury effects
      let totalBleedDamage = 0;
      let totalBurnDamage = 0;
      let totalPoisonDamage = 0;
      let worstMoveSpeed = 1;
      let worstAimPenalty = 0;
      let worstVisionBlur = 0;
      let worstAimShake = 0;

      this.injuries.forEach(inj => {
        if (inj.type === 'BLEEDING') {
          totalBleedDamage += inj.damagePerSec * inj.severity * dt;
        }
        if (inj.type === 'BURN') {
          totalBurnDamage += inj.damagePerSec * inj.severity * dt;
        }
        if (inj.type === 'POISON') {
          totalPoisonDamage += inj.damagePerSec * inj.severity * dt;
        }
        if (inj.moveSpeed) {
          worstMoveSpeed = Math.min(worstMoveSpeed, inj.moveSpeed);
        }
        if (inj.aimPenalty) {
          worstAimPenalty = Math.max(worstAimPenalty, inj.aimPenalty * inj.severity);
        }
        if (inj.visionBlur) {
          worstVisionBlur = Math.max(worstVisionBlur, inj.visionBlur * inj.severity);
        }
        if (inj.aimShake) {
          worstAimShake = Math.max(worstAimShake, inj.aimShake * inj.severity);
        }
      });

      player.injuryEffects = {
        bleedDamage: totalBleedDamage,
        burnDamage: totalBurnDamage,
        poisonDamage: totalPoisonDamage,
        moveSpeed: worstMoveSpeed,
        aimPenalty: worstAimPenalty,
        visionBlur: worstVisionBlur,
        aimShake: worstAimShake
      };
    },

    treatInjury(injuryIndex, item) {
      if (injuryIndex >= this.injuries.length) return false;
      
      const injury = this.injuries[injuryIndex];
      
      // Check if correct treatment item
      if (injury.requiresBandage && item !== 'BANDAGE') return false;
      if (injury.requiresSplint && item !== 'SPLINT') return false;
      if (injury.requiresPainkillers && item !== 'PAINKILLERS') return false;
      if (injury.requiresMedkit && item !== 'MEDKIT') return false;
      if (injury.requiresAntidote && item !== 'ANTIDOTE') return false;

      // Remove injury
      this.injuries.splice(injuryIndex, 1);
      return true;
    },

    getInjuries() {
      return this.injuries;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 6. DISEASE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const DiseaseSystem = {
    diseases: [],
    types: {
      INFECTION: {
        damagePerSec: 1,
        feverChance: 0.3,
        duration: 300,
        contagious: false
      },
      RADIATION_SICKNESS: {
        damagePerSec: 2,
        vomitChance: 0.1,
        duration: 180,
        contagious: false
      },
      DYSENTERY: {
        staminaDrain: 2.0,
        duration: 240,
        contagious: true
      },
      PNEUMONIA: {
        damagePerSec: 1.5,
        moveSpeed: 0.8,
        duration: 360,
        contagious: true
      }
    },
    
    init() {
      this.diseases = [];
    },

    contract(type, severity = 1.0) {
      // Check if already infected
      if (this.diseases.find(d => d.type === type)) return false;

      const config = this.types[type];
      if (!config) return false;

      const disease = {
        type,
        severity,
        contractTime: Date.now() / 1000,
        ...config
      };

      this.diseases.push(disease);
      return true;
    },

    update(dt, player, npcs) {
      const now = Date.now() / 1000;

      // Remove cured diseases
      this.diseases = this.diseases.filter(d => {
        const elapsed = now - d.contractTime;
        return elapsed < d.duration;
      });

      // Apply disease effects
      let totalDamage = 0;
      let worstStaminaDrain = 1.0;
      let worstMoveSpeed = 1.0;

      this.diseases.forEach(disease => {
        if (disease.damagePerSec) {
          totalDamage += disease.damagePerSec * disease.severity * dt;
        }
        if (disease.staminaDrain) {
          worstStaminaDrain = Math.max(worstStaminaDrain, disease.staminaDrain);
        }
        if (disease.moveSpeed) {
          worstMoveSpeed = Math.min(worstMoveSpeed, disease.moveSpeed);
        }

        // Random symptoms
        if (disease.vomitChance && Math.random() < disease.vomitChance * dt) {
          player.vomiting = true;
        }
        if (disease.feverChance && Math.random() < disease.feverChance * dt) {
          player.fever = true;
        }

        // Contagion
        if (disease.contagious && npcs) {
          npcs.forEach(npc => {
            const dx = npc.x - player.position.x;
            const dz = npc.z - player.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist < 3 && Math.random() < 0.01 * dt) {
              // NPC can get sick too
              npc.diseased = disease.type;
            }
          });
        }
      });

      player.diseaseEffects = {
        damage: totalDamage,
        staminaDrain: worstStaminaDrain,
        moveSpeed: worstMoveSpeed
      };
    },

    cure(diseaseType) {
      this.diseases = this.diseases.filter(d => d.type !== diseaseType);
    },

    getDiseases() {
      return this.diseases;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 7. MENTAL HEALTH SYSTEM
  // ──────────────────────────────────────────────────────────────
  const MentalHealthSystem = {
    stress: 0, // 0-100
    morale: 100, // 0-100
    sanity: 100, // 0-100
    
    init() {
      this.stress = 0;
      this.morale = 100;
      this.sanity = 100;
    },

    update(dt, player, gameState) {
      // Stress increases in combat
      if (gameState.enemiesNearby > 5) {
        this.stress = Math.min(100, this.stress + 5 * dt);
      } else {
        this.stress = Math.max(0, this.stress - 2 * dt);
      }

      // Low health increases stress
      if (player.hp < player.maxHp * 0.3) {
        this.stress = Math.min(100, this.stress + 3 * dt);
      }

      // Morale affected by victories/defeats
      // (This would be called from game events)
      
      // Natural morale recovery
      if (this.morale < 100) {
        this.morale = Math.min(100, this.morale + 1 * dt);
      }

      // Sanity affected by extreme conditions
      if (gameState.inDarkness && gameState.alone) {
        this.sanity = Math.max(0, this.sanity - 0.5 * dt);
      } else if (this.sanity < 100) {
        this.sanity = Math.min(100, this.sanity + 2 * dt);
      }

      // Effects of poor mental health
      if (this.stress > 70) {
        player.stressEffects = {
          aimShake: 0.3,
          tunnelVision: true,
          panicChance: 0.05
        };
      } else {
        player.stressEffects = null;
      }

      if (this.morale < 30) {
        player.lowMorale = {
          damageOutput: 0.8,
          accuracyPenalty: 0.2
        };
      } else {
        player.lowMorale = null;
      }

      if (this.sanity < 50) {
        player.lowSanity = {
          hallucinations: this.sanity < 30,
          visionDistortion: 0.5 - this.sanity / 100,
          audioDistortion: true
        };
      } else {
        player.lowSanity = null;
      }
    },

    adjustStress(amount) {
      this.stress = Math.max(0, Math.min(100, this.stress + amount));
    },

    adjustMorale(amount) {
      this.morale = Math.max(0, Math.min(100, this.morale + amount));
    },

    adjustSanity(amount) {
      this.sanity = Math.max(0, Math.min(100, this.sanity + amount));
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 8. REST & SLEEP SYSTEM
  // ──────────────────────────────────────────────────────────────
  const RestSystem = {
    restLevel: 100, // 0-100, 100 = well rested
    sleepDebt: 0, // accumulated hours of missed sleep
    
    init() {
      this.restLevel = 100;
      this.sleepDebt = 0;
    },

    update(dt, player, timeOfDay) {
      // Rest depletes over time (need ~8 hours sleep per 24 hours)
      const depletionRate = 100 / (16 * 3600); // 16 hours of wakefulness
      this.restLevel = Math.max(0, this.restLevel - depletionRate * dt);

      // Accumulate sleep debt
      if (this.restLevel < 20) {
        this.sleepDebt += dt / 3600; // Convert to hours
      }

      // Effects of being tired
      if (this.restLevel < 30) {
        player.tiredEffects = {
          aimShake: 0.3,
          visionBlur: 0.2,
          reactionTime: 1.5,
          microSleep: this.restLevel < 10
        };
      } else if (this.restLevel < 60) {
        player.tiredEffects = {
          aimShake: 0.15,
          visionBlur: 0.1,
          reactionTime: 1.2,
          microSleep: false
        };
      } else {
        player.tiredEffects = null;
      }

      // Sleep debt penalties
      if (this.sleepDebt > 12) {
        player.sleepDebtPenalty = {
          maxHP: 0.7,
          maxStamina: 0.6,
          healingRate: 0.5
        };
      } else if (this.sleepDebt > 6) {
        player.sleepDebtPenalty = {
          maxHP: 0.85,
          maxStamina: 0.8,
          healingRate: 0.7
        };
      } else {
        player.sleepDebtPenalty = null;
      }
    },

    sleep(duration) {
      // duration in seconds
      const hours = duration / 3600;
      const restGain = (100 / 8) * hours; // 8 hours = full rest
      
      this.restLevel = Math.min(100, this.restLevel + restGain);
      this.sleepDebt = Math.max(0, this.sleepDebt - hours);
      
      return {
        restLevel: this.restLevel,
        sleepDebt: this.sleepDebt
      };
    },

    canSleep(timeOfDay) {
      // Can only sleep at night or in safe zones
      return (timeOfDay >= 20 || timeOfDay <= 6);
    },

    getRestLevel() {
      return this.restLevel;
    },

    getSleepDebt() {
      return this.sleepDebt;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────
  return {
    init() {
      HungerSystem.init();
      ThirstSystem.init();
      TemperatureSystem.init();
      FatigueSystem.init();
      InjurySystem.init();
      DiseaseSystem.init();
      MentalHealthSystem.init();
      RestSystem.init();
    },

    update(dt, gameState) {
      const { player, environmentTemp, timeOfDay, npcs } = gameState;
      
      HungerSystem.update(dt, player);
      ThirstSystem.update(dt, player, environmentTemp);
      TemperatureSystem.update(dt, player, environmentTemp);
      FatigueSystem.update(dt, player);
      InjurySystem.update(dt, player);
      DiseaseSystem.update(dt, player, npcs);
      MentalHealthSystem.update(dt, player, gameState);
      RestSystem.update(dt, player, timeOfDay);
    },

    // Expose subsystems
    HungerSystem,
    ThirstSystem,
    TemperatureSystem,
    FatigueSystem,
    InjurySystem,
    DiseaseSystem,
    MentalHealthSystem,
    RestSystem
  };
})();
