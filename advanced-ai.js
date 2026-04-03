// ══════════════════════════════════════════════════════════════
// ADVANCED AI SYSTEM
// 6 sophisticated AI behaviors for dynamic enemy combat
// ══════════════════════════════════════════════════════════════

const AdvancedAI = (() => {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // 1. SQUAD TACTICS SYSTEM
  // ──────────────────────────────────────────────────────────────
  const SquadTactics = {
    squads: [],
    
    init() {
      this.squads = [];
    },

    createSquad(leader, members) {
      const squad = {
        id: this.squads.length,
        leader,
        members: [leader, ...members],
        formation: 'WEDGE', // WEDGE, LINE, COLUMN, CIRCLE
        stance: 'AGGRESSIVE', // AGGRESSIVE, DEFENSIVE, FLANKING, RETREAT
        cohesion: 1.0,
        objective: null
      };

      // Mark all members
      squad.members.forEach(m => {
        m.squadId = squad.id;
        m.isLeader = m === leader;
      });

      this.squads.push(squad);
      return squad;
    },

    update(dt, player) {
      this.squads.forEach(squad => {
        // Remove dead members
        squad.members = squad.members.filter(m => m.hp > 0);
        
        if (squad.members.length === 0) {
          squad.disbanded = true;
          return;
        }

        // Leader died - promote new one
        if (!squad.members.includes(squad.leader)) {
          squad.leader = squad.members[0];
          squad.leader.isLeader = true;
        }

        // Update formation positions
        this.updateFormation(squad);

        // Squad-level decisions
        this.makeSquadDecision(squad, player);

        // Cohesion check
        this.updateCohesion(squad);
      });

      // Remove disbanded squads
      this.squads = this.squads.filter(s => !s.disbanded);
    },

    updateFormation(squad) {
      const leader = squad.leader;
      const spacing = 3;

      switch (squad.formation) {
        case 'WEDGE':
          squad.members.forEach((m, i) => {
            if (m === leader) {
              m.formationPos = { x: 0, z: 0 };
            } else {
              const side = i % 2 === 0 ? 1 : -1;
              const row = Math.floor((i - 1) / 2) + 1;
              m.formationPos = {
                x: side * spacing * row,
                z: -spacing * row
              };
            }
          });
          break;

        case 'LINE':
          squad.members.forEach((m, i) => {
            const offset = (i - squad.members.length / 2) * spacing;
            m.formationPos = { x: offset, z: 0 };
          });
          break;

        case 'COLUMN':
          squad.members.forEach((m, i) => {
            m.formationPos = { x: 0, z: -i * spacing };
          });
          break;

        case 'CIRCLE':
          squad.members.forEach((m, i) => {
            const angle = (i / squad.members.length) * Math.PI * 2;
            const radius = spacing * 2;
            m.formationPos = {
              x: Math.cos(angle) * radius,
              z: Math.sin(angle) * radius
            };
          });
          break;
      }

      // Apply formation to world positions
      squad.members.forEach(m => {
        if (m.formationPos) {
          const leaderYaw = leader.yaw || 0;
          const cos = Math.cos(leaderYaw);
          const sin = Math.sin(leaderYaw);
          
          m.targetX = leader.x + m.formationPos.x * cos - m.formationPos.z * sin;
          m.targetZ = leader.z + m.formationPos.x * sin + m.formationPos.z * cos;
        }
      });
    },

    makeSquadDecision(squad, player) {
      const avgHP = squad.members.reduce((sum, m) => sum + m.hp, 0) / squad.members.length;
      const avgMaxHP = squad.members.reduce((sum, m) => sum + (m.maxHP || 100), 0) / squad.members.length;
      const healthPercent = avgHP / avgMaxHP;

      // Decision making
      if (healthPercent < 0.3) {
        squad.stance = 'RETREAT';
        squad.formation = 'COLUMN';
      } else if (healthPercent < 0.6) {
        squad.stance = 'DEFENSIVE';
        squad.formation = 'CIRCLE';
      } else {
        const distToPlayer = Math.sqrt(
          Math.pow(squad.leader.x - player.position.x, 2) + 
          Math.pow(squad.leader.z - player.position.z, 2)
        );

        if (distToPlayer > 20) {
          squad.stance = 'FLANKING';
          squad.formation = 'WEDGE';
        } else {
          squad.stance = 'AGGRESSIVE';
          squad.formation = 'LINE';
        }
      }

      // Apply stance to members
      squad.members.forEach(m => {
        m.squadStance = squad.stance;
      });
    },

    updateCohesion(squad) {
      // Measure how well squad stays together
      let totalDist = 0;
      const center = {
        x: squad.members.reduce((sum, m) => sum + m.x, 0) / squad.members.length,
        z: squad.members.reduce((sum, m) => sum + m.z, 0) / squad.members.length
      };

      squad.members.forEach(m => {
        const dx = m.x - center.x;
        const dz = m.z - center.z;
        totalDist += Math.sqrt(dx*dx + dz*dz);
      });

      const avgDist = totalDist / squad.members.length;
      squad.cohesion = Math.max(0, 1 - avgDist / 20);
    },

    getSquads() {
      return this.squads;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 2. DYNAMIC DIFFICULTY ADJUSTMENT
  // ──────────────────────────────────────────────────────────────
  const DynamicDifficulty = {
    difficulty: 1.0, // 0.5 = easy, 1.0 = normal, 2.0 = hard
    adjustmentRate: 0.05,
    performanceWindow: [],
    windowSize: 10,
    
    init() {
      this.difficulty = 1.0;
      this.performanceWindow = [];
    },

    recordPerformance(event) {
      // event: { type: 'PLAYER_DEATH' | 'PLAYER_KILL' | 'WAVE_COMPLETE' | 'WAVE_FAILED', timestamp }
      this.performanceWindow.push(event);
      
      if (this.performanceWindow.length > this.windowSize) {
        this.performanceWindow.shift();
      }
    },

    update(dt) {
      if (this.performanceWindow.length < 3) return;

      // Analyze recent performance
      const recentEvents = this.performanceWindow.slice(-5);
      let playerScore = 0;

      recentEvents.forEach(e => {
        switch (e.type) {
          case 'PLAYER_KILL':
            playerScore += 1;
            break;
          case 'PLAYER_DEATH':
            playerScore -= 5;
            break;
          case 'WAVE_COMPLETE':
            playerScore += 3;
            break;
          case 'WAVE_FAILED':
            playerScore -= 3;
            break;
        }
      });

      // Adjust difficulty
      if (playerScore > 5) {
        // Player doing very well - increase difficulty
        this.difficulty = Math.min(2.5, this.difficulty + this.adjustmentRate * dt);
      } else if (playerScore < -3) {
        // Player struggling - decrease difficulty
        this.difficulty = Math.max(0.4, this.difficulty - this.adjustmentRate * dt);
      } else {
        // Drift towards 1.0
        if (this.difficulty > 1.0) {
          this.difficulty = Math.max(1.0, this.difficulty - this.adjustmentRate * 0.5 * dt);
        } else {
          this.difficulty = Math.min(1.0, this.difficulty + this.adjustmentRate * 0.5 * dt);
        }
      }
    },

    getMultipliers() {
      return {
        enemyDamage: this.difficulty,
        enemyHealth: this.difficulty * 0.8,
        enemyAccuracy: Math.min(1.5, this.difficulty * 0.9),
        enemySpeed: Math.min(1.3, this.difficulty * 0.7),
        spawnRate: Math.min(2.0, this.difficulty * 1.2)
      };
    },

    getDifficulty() {
      return this.difficulty;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 3. BEHAVIOR TREE SYSTEM
  // ──────────────────────────────────────────────────────────────
  const BehaviorTrees = {
    trees: new Map(),
    
    init() {
      this.trees.clear();
      this.createDefaultTree();
    },

    createDefaultTree() {
      // Simple behavior tree structure
      const tree = {
        root: {
          type: 'SELECTOR', // Try children until one succeeds
          children: [
            {
              type: 'SEQUENCE', // All must succeed
              children: [
                { type: 'CONDITION', check: 'IS_LOW_HEALTH' },
                { type: 'ACTION', action: 'SEEK_COVER' }
              ]
            },
            {
              type: 'SEQUENCE',
              children: [
                { type: 'CONDITION', check: 'CAN_SEE_ENEMY' },
                { type: 'SELECTOR',
                  children: [
                    {
                      type: 'SEQUENCE',
                      children: [
                        { type: 'CONDITION', check: 'IN_RANGE' },
                        { type: 'ACTION', action: 'SHOOT' }
                      ]
                    },
                    { type: 'ACTION', action: 'MOVE_TO_RANGE' }
                  ]
                }
              ]
            },
            {
              type: 'ACTION',
              action: 'PATROL'
            }
          ]
        }
      };

      this.trees.set('DEFAULT', tree);
    },

    evaluate(enemy, tree, player) {
      const node = tree || this.trees.get('DEFAULT').root;
      return this.evaluateNode(node, enemy, player);
    },

    evaluateNode(node, enemy, player) {
      switch (node.type) {
        case 'SELECTOR':
          // Try each child until one succeeds
          for (const child of node.children) {
            if (this.evaluateNode(child, enemy, player)) {
              return true;
            }
          }
          return false;

        case 'SEQUENCE':
          // All children must succeed
          for (const child of node.children) {
            if (!this.evaluateNode(child, enemy, player)) {
              return false;
            }
          }
          return true;

        case 'CONDITION':
          return this.checkCondition(node.check, enemy, player);

        case 'ACTION':
          return this.executeAction(node.action, enemy, player);

        default:
          return false;
      }
    },

    checkCondition(check, enemy, player) {
      switch (check) {
        case 'IS_LOW_HEALTH':
          return enemy.hp < (enemy.maxHP || 100) * 0.3;

        case 'CAN_SEE_ENEMY':
          const dx = player.position.x - enemy.x;
          const dz = player.position.z - enemy.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          return dist < (enemy.visionRange || 40);

        case 'IN_RANGE':
          const dx2 = player.position.x - enemy.x;
          const dz2 = player.position.z - enemy.z;
          const dist2 = Math.sqrt(dx2*dx2 + dz2*dz2);
          return dist2 < (enemy.attackRange || 20);

        default:
          return false;
      }
    },

    executeAction(action, enemy, player) {
      enemy.behaviorAction = action;
      return true;
    },

    update(dt, enemies, player) {
      enemies.forEach(e => {
        this.evaluate(e, null, player);
      });
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 4. FORMATION MOVEMENT
  // ──────────────────────────────────────────────────────────────
  const FormationMovement = {
    formations: {
      VEE: { positions: [[0,0], [-2,-2], [2,-2], [-4,-4], [4,-4]] },
      LINE: { positions: [[0,0], [-2,0], [2,0], [-4,0], [4,0]] },
      COLUMN: { positions: [[0,0], [0,-2], [0,-4], [0,-6], [0,-8]] },
      DIAMOND: { positions: [[0,0], [-2,-2], [2,-2], [0,-4]] },
      BOX: { positions: [[-1,-1], [1,-1], [1,-3], [-1,-3]] }
    },
    
    init() {
      // Nothing to initialize
    },

    assignFormation(group, formationType) {
      const formation = this.formations[formationType];
      if (!formation) return;

      group.forEach((enemy, i) => {
        if (i < formation.positions.length) {
          enemy.formationOffset = {
            x: formation.positions[i][0],
            z: formation.positions[i][1]
          };
        }
        enemy.formationType = formationType;
      });
    },

    update(dt, enemies) {
      // Group enemies by formation type
      const groups = new Map();
      
      enemies.forEach(e => {
        if (e.formationType) {
          if (!groups.has(e.formationType)) {
            groups.set(e.formationType, []);
          }
          groups.get(e.formationType).push(e);
        }
      });

      // Update positions based on formation
      groups.forEach((group, formationType) => {
        if (group.length === 0) return;

        const leader = group[0];
        
        group.forEach(e => {
          if (e.formationOffset && e !== leader) {
            const leaderYaw = leader.yaw || 0;
            const cos = Math.cos(leaderYaw);
            const sin = Math.sin(leaderYaw);
            
            e.formationTargetX = leader.x + e.formationOffset.x * cos - e.formationOffset.z * sin;
            e.formationTargetZ = leader.z + e.formationOffset.x * sin + e.formationOffset.z * cos;
          }
        });
      });
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 5. FLANKING AI
  // ──────────────────────────────────────────────────────────────
  const FlankingAI = {
    flankingEnemies: new Set(),
    
    init() {
      this.flankingEnemies.clear();
    },

    initiateFlank(enemy, player) {
      if (this.flankingEnemies.has(enemy)) return false;

      // Calculate flank position (90 degrees to player's facing)
      const playerYaw = player.cameraYaw || 0;
      const flankDirection = enemy.id % 2 === 0 ? Math.PI/2 : -Math.PI/2;
      const flankAngle = playerYaw + flankDirection;
      const flankDist = 15;

      enemy.flankTarget = {
        x: player.position.x + Math.cos(flankAngle) * flankDist,
        z: player.position.z + Math.sin(flankAngle) * flankDist
      };

      enemy.flanking = true;
      this.flankingEnemies.add(enemy);
      return true;
    },

    update(dt, enemies, player) {
      this.flankingEnemies.forEach(enemy => {
        if (enemy.hp <= 0) {
          this.flankingEnemies.delete(enemy);
          return;
        }

        // Check if reached flank position
        if (enemy.flankTarget) {
          const dx = enemy.x - enemy.flankTarget.x;
          const dz = enemy.z - enemy.flankTarget.z;
          const dist = Math.sqrt(dx*dx + dz*dz);

          if (dist < 3) {
            // Reached position - now engage
            enemy.flanking = false;
            enemy.flankComplete = true;
            this.flankingEnemies.delete(enemy);
          }
        }
      });

      // Randomly assign flanking to enemies
      enemies.forEach(e => {
        if (!e.flanking && !this.flankingEnemies.has(e) && Math.random() < 0.01 * dt) {
          const dx = e.x - player.position.x;
          const dz = e.z - player.position.z;
          const dist = Math.sqrt(dx*dx + dz*dz);
          
          if (dist > 10 && dist < 30) {
            this.initiateFlank(e, player);
          }
        }
      });
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 6. SUPPRESSION FIRE
  // ──────────────────────────────────────────────────────────────
  const SuppressionFire = {
    suppressingEnemies: new Set(),
    
    init() {
      this.suppressingEnemies.clear();
    },

    startSuppression(enemy, target) {
      enemy.suppressing = true;
      enemy.suppressionTarget = target;
      enemy.suppressionAmmo = 60; // Rounds to fire
      enemy.suppressionRate = 10; // Rounds per second
      this.suppressingEnemies.add(enemy);
    },

    update(dt, player) {
      this.suppressingEnemies.forEach(enemy => {
        if (enemy.hp <= 0 || enemy.suppressionAmmo <= 0) {
          enemy.suppressing = false;
          this.suppressingEnemies.delete(enemy);
          return;
        }

        // Fire suppressive rounds
        const roundsThisFrame = enemy.suppressionRate * dt;
        enemy.suppressionAmmo = Math.max(0, enemy.suppressionAmmo - roundsThisFrame);

        // Create suppression zone around target
        const dx = player.position.x - enemy.x;
        const dz = player.position.z - enemy.z;
        const dist = Math.sqrt(dx*dx + dz*dz);

        if (dist < 25) {
          // Player is suppressed
          player.suppressed = true;
          player.suppressionLevel = (player.suppressionLevel || 0) + 10 * dt;
          
          // Effects
          player.accuracyPenalty = Math.min(0.7, player.suppressionLevel / 100);
          player.screenShake = Math.min(0.3, player.suppressionLevel / 200);
        }
      });

      // Decay suppression
      if (player.suppressionLevel > 0) {
        player.suppressionLevel = Math.max(0, player.suppressionLevel - 20 * dt);
        
        if (player.suppressionLevel === 0) {
          player.suppressed = false;
          player.accuracyPenalty = 0;
          player.screenShake = 0;
        }
      }
    }
  };

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────
  return {
    init() {
      SquadTactics.init();
      DynamicDifficulty.init();
      BehaviorTrees.init();
      FormationMovement.init();
      FlankingAI.init();
      SuppressionFire.init();
    },

    update(dt, gameState) {
      const { player, enemies } = gameState;
      
      // Add null checks for safety
      const safeEnemies = enemies || [];
      
      SquadTactics.update(dt, player);
      DynamicDifficulty.update(dt);
      BehaviorTrees.update(dt, safeEnemies, player);
      FormationMovement.update(dt, safeEnemies);
      FlankingAI.update(dt, safeEnemies, player);
      SuppressionFire.update(dt, player);
    },

    // Expose subsystems
    SquadTactics,
    DynamicDifficulty,
    BehaviorTrees,
    FormationMovement,
    FlankingAI,
    SuppressionFire
  };
})();
