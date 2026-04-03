// ══════════════════════════════════════════════════════════════
// PLAYER CUSTOMIZATION SYSTEM
// 6 customization features for player personalization
// ══════════════════════════════════════════════════════════════

const CustomizationSystem = (() => {
  'use strict';

  // ──────────────────────────────────────────────────────────────
  // 1. WEAPON ATTACHMENTS SYSTEM
  // ──────────────────────────────────────────────────────────────
  const WeaponAttachments = {
    attachments: {
      // Optics
      RED_DOT: { slot: 'OPTIC', aimBonus: 0.15, cost: 100 },
      HOLOGRAPHIC: { slot: 'OPTIC', aimBonus: 0.2, cost: 150 },
      ACOG: { slot: 'OPTIC', aimBonus: 0.3, zoom: 4, cost: 250 },
      THERMAL: { slot: 'OPTIC', aimBonus: 0.25, thermal: true, cost: 500 },
      
      // Barrels
      SUPPRESSOR: { slot: 'BARREL', silenced: true, damageMulti: 0.95, cost: 200 },
      EXTENDED_BARREL: { slot: 'BARREL', rangeBonus: 1.3, cost: 150 },
      COMPENSATOR: { slot: 'BARREL', recoilReduction: 0.3, cost: 120 },
      
      // Underbarrel
      FOREGRIP: { slot: 'UNDERBARREL', recoilReduction: 0.2, cost: 80 },
      BIPOD: { slot: 'UNDERBARREL', proneAccuracy: 0.4, cost: 100 },
      GRENADE_LAUNCHER: { slot: 'UNDERBARREL', grenades: true, cost: 300 },
      
      // Magazine
      EXTENDED_MAG: { slot: 'MAGAZINE', capacityMulti: 1.5, cost: 100 },
      FAST_MAG: { slot: 'MAGAZINE', reloadSpeed: 0.7, cost: 120 },
      DRUM_MAG: { slot: 'MAGAZINE', capacityMulti: 2.0, reloadSpeed: 1.3, cost: 200 },
      
      // Stock
      TACTICAL_STOCK: { slot: 'STOCK', aimSpeed: 0.85, cost: 90 },
      HEAVY_STOCK: { slot: 'STOCK', recoilReduction: 0.25, moveSpeed: 0.95, cost: 110 },
      
      // Laser
      LASER_SIGHT: { slot: 'LASER', hipfireBonus: 0.3, cost: 70 },
      TACTICAL_LIGHT: { slot: 'LASER', nightVision: true, cost: 80 }
    },

    equipped: new Map(), // weaponId -> { OPTIC: attachment, BARREL: attachment, ... }
    unlocked: new Set(),

    init() {
      this.equipped.clear();
      this.unlocked.clear();
      
      // Start with basic attachments unlocked
      this.unlocked.add('RED_DOT');
      this.unlocked.add('FOREGRIP');
    },

    attachToWeapon(weaponId, attachmentName) {
      const attachment = this.attachments[attachmentName];
      if (!attachment || !this.unlocked.has(attachmentName)) return false;

      if (!this.equipped.has(weaponId)) {
        this.equipped.set(weaponId, {});
      }

      this.equipped.get(weaponId)[attachment.slot] = attachmentName;
      return true;
    },

    removeAttachment(weaponId, slot) {
      if (this.equipped.has(weaponId)) {
        delete this.equipped.get(weaponId)[slot];
      }
    },

    getWeaponModifiers(weaponId) {
      const mods = {
        aimBonus: 0,
        rangeBonus: 1,
        recoilReduction: 0,
        damageMulti: 1,
        capacityMulti: 1,
        reloadSpeed: 1,
        aimSpeed: 1,
        moveSpeed: 1,
        hipfireBonus: 0,
        silenced: false,
        thermal: false,
        nightVision: false,
        grenades: false
      };

      if (!this.equipped.has(weaponId)) return mods;

      const attachedSlots = this.equipped.get(weaponId);
      Object.values(attachedSlots).forEach(attachName => {
        const att = this.attachments[attachName];
        if (!att) return;

        // Accumulate bonuses
        Object.keys(mods).forEach(key => {
          if (att[key] !== undefined) {
            if (key.includes('Multi') || key.includes('Bonus') || key.includes('Speed') || key.includes('Reduction')) {
              mods[key] *= att[key] || 1;
            } else {
              mods[key] = att[key];
            }
          }
        });
      });

      return mods;
    },

    unlockAttachment(attachmentName) {
      this.unlocked.add(attachmentName);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 2. ARMOR CUSTOMIZATION
  // ──────────────────────────────────────────────────────────────
  const ArmorCustomization = {
    armorSets: {
      LIGHT: { 
        defense: 1.1, speed: 1.1, stamina: 1.2, 
        slots: 2, weight: 10, cost: 200 
      },
      MEDIUM: { 
        defense: 1.3, speed: 1.0, stamina: 1.0, 
        slots: 3, weight: 20, cost: 500 
      },
      HEAVY: { 
        defense: 1.6, speed: 0.85, stamina: 0.8, 
        slots: 4, weight: 40, cost: 1000 
      },
      TACTICAL: { 
        defense: 1.2, speed: 1.05, stamina: 1.1, 
        slots: 5, weight: 15, cost: 800 
      },
      STEALTH: { 
        defense: 1.05, speed: 1.15, stamina: 1.3, 
        slots: 2, weight: 8, cost: 600, stealth: 0.3 
      }
    },

    armorPieces: {
      HELMET: { defense: 1.1, headshot: 0.7 },
      VEST: { defense: 1.3, chest: 0.6 },
      GLOVES: { defense: 1.05, reloadSpeed: 0.95 },
      BOOTS: { defense: 1.05, moveSpeed: 1.05 },
      KNEEPADS: { defense: 1.03, slide: true }
    },

    equipped: {
      set: null,
      pieces: {}
    },

    init() {
      this.equipped.set = 'MEDIUM';
      this.equipped.pieces = {};
    },

    equipArmorSet(setName) {
      if (!this.armorSets[setName]) return false;
      this.equipped.set = setName;
      return true;
    },

    equipPiece(pieceName) {
      if (!this.armorPieces[pieceName]) return false;
      this.equipped.pieces[pieceName] = true;
      return true;
    },

    getTotalModifiers() {
      const mods = { 
        defense: 1, 
        speed: 1, 
        stamina: 1, 
        stealth: 0,
        reloadSpeed: 1,
        moveSpeed: 1,
        headshotProtection: 0,
        chestProtection: 0,
        slide: false
      };

      // Apply set bonuses
      if (this.equipped.set && this.armorSets[this.equipped.set]) {
        const set = this.armorSets[this.equipped.set];
        mods.defense *= set.defense;
        mods.speed *= set.speed;
        mods.stamina *= set.stamina;
        if (set.stealth) mods.stealth += set.stealth;
      }

      // Apply piece bonuses
      Object.keys(this.equipped.pieces).forEach(pieceName => {
        const piece = this.armorPieces[pieceName];
        if (!piece) return;

        if (piece.defense) mods.defense *= piece.defense;
        if (piece.headshot) mods.headshotProtection = piece.headshot;
        if (piece.chest) mods.chestProtection = piece.chest;
        if (piece.reloadSpeed) mods.reloadSpeed *= piece.reloadSpeed;
        if (piece.moveSpeed) mods.moveSpeed *= piece.moveSpeed;
        if (piece.slide) mods.slide = true;
      });

      return mods;
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 3. CHARACTER APPEARANCE
  // ──────────────────────────────────────────────────────────────
  const CharacterAppearance = {
    options: {
      SKIN_TONE: ['LIGHT', 'MEDIUM', 'DARK', 'TAN'],
      FACE: ['SQUARE', 'ROUND', 'LONG', 'ANGULAR'],
      HAIR: ['SHORT', 'MEDIUM', 'LONG', 'BALD', 'PONYTAIL'],
      HAIR_COLOR: ['BLACK', 'BROWN', 'BLONDE', 'RED', 'GRAY'],
      FACIAL_HAIR: ['NONE', 'STUBBLE', 'BEARD', 'GOATEE', 'MUSTACHE'],
      EYES: ['BLUE', 'BROWN', 'GREEN', 'GRAY', 'HAZEL'],
      CAMO: ['WOODLAND', 'DESERT', 'URBAN', 'WINTER', 'MULTICAM', 'DIGITAL']
    },

    current: {
      SKIN_TONE: 'MEDIUM',
      FACE: 'SQUARE',
      HAIR: 'SHORT',
      HAIR_COLOR: 'BROWN',
      FACIAL_HAIR: 'STUBBLE',
      EYES: 'BROWN',
      CAMO: 'WOODLAND'
    },

    init() {
      // Default values already set
    },

    setOption(category, value) {
      if (!this.options[category] || !this.options[category].includes(value)) {
        return false;
      }
      this.current[category] = value;
      return true;
    },

    getAppearance() {
      return { ...this.current };
    },

    randomize() {
      Object.keys(this.options).forEach(category => {
        const choices = this.options[category];
        this.current[category] = choices[Math.floor(Math.random() * choices.length)];
      });
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 4. EMOTES & TAUNTS
  // ──────────────────────────────────────────────────────────────
  const EmoteSystem = {
    emotes: {
      SALUTE: { duration: 2, animation: 'SALUTE', sound: null },
      WAVE: { duration: 1.5, animation: 'WAVE', sound: null },
      THUMBS_UP: { duration: 1.5, animation: 'THUMBS_UP', sound: null },
      DANCE: { duration: 4, animation: 'DANCE', sound: 'MUSIC' },
      SIT: { duration: Infinity, animation: 'SIT', sound: null },
      POINT: { duration: 1, animation: 'POINT', sound: null },
      RELOAD_TRICK: { duration: 3, animation: 'RELOAD_TRICK', sound: 'CLICK' },
      TAUNT: { duration: 2, animation: 'TAUNT', sound: 'VOICE_TAUNT' }
    },

    taunts: [
      "Is that all you've got?",
      "Too easy!",
      "Come at me!",
      "Target eliminated.",
      "Nice try.",
      "You can do better than that.",
      "Mission accomplished.",
      "Piece of cake."
    ],

    unlocked: new Set(),
    currentEmote: null,

    init() {
      this.unlocked.clear();
      this.unlocked.add('SALUTE');
      this.unlocked.add('WAVE');
      this.currentEmote = null;
    },

    playEmote(emoteName) {
      const emote = this.emotes[emoteName];
      if (!emote || !this.unlocked.has(emoteName)) return false;

      this.currentEmote = {
        name: emoteName,
        ...emote,
        startTime: Date.now() / 1000
      };

      return true;
    },

    update(dt) {
      if (!this.currentEmote) return;

      const elapsed = (Date.now() / 1000) - this.currentEmote.startTime;
      if (elapsed >= this.currentEmote.duration) {
        this.currentEmote = null;
      }
    },

    cancelEmote() {
      this.currentEmote = null;
    },

    getRandomTaunt() {
      return this.taunts[Math.floor(Math.random() * this.taunts.length)];
    },

    unlockEmote(emoteName) {
      this.unlocked.add(emoteName);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 5. VICTORY POSES
  // ──────────────────────────────────────────────────────────────
  const VictoryPoses = {
    poses: {
      ARMS_CROSSED: { duration: 3, rarity: 'COMMON' },
      WEAPON_RAISE: { duration: 3, rarity: 'COMMON' },
      FIST_PUMP: { duration: 2.5, rarity: 'COMMON' },
      SALUTE_FORMAL: { duration: 3, rarity: 'UNCOMMON' },
      KNEEL_VICTORY: { duration: 4, rarity: 'UNCOMMON' },
      BACKFLIP: { duration: 2, rarity: 'RARE' },
      WEAPON_SPIN: { duration: 3, rarity: 'RARE' },
      CHAMPION_STANCE: { duration: 4, rarity: 'EPIC' },
      LEGENDARY_POSE: { duration: 5, rarity: 'LEGENDARY' }
    },

    equipped: 'ARMS_CROSSED',
    unlocked: new Set(),

    init() {
      this.unlocked.clear();
      this.unlocked.add('ARMS_CROSSED');
      this.unlocked.add('WEAPON_RAISE');
      this.equipped = 'ARMS_CROSSED';
    },

    equipPose(poseName) {
      if (!this.poses[poseName] || !this.unlocked.has(poseName)) return false;
      this.equipped = poseName;
      return true;
    },

    unlockPose(poseName) {
      if (!this.poses[poseName]) return false;
      this.unlocked.add(poseName);
      return true;
    },

    playVictoryPose() {
      return {
        pose: this.equipped,
        ...this.poses[this.equipped]
      };
    }
  };

  // ──────────────────────────────────────────────────────────────
  // 6. PLAYER CALLING CARDS
  // ──────────────────────────────────────────────────────────────
  const CallingCards = {
    cards: {
      BASIC: { 
        title: 'Recruit', 
        background: 'GRAY', 
        icon: 'STAR', 
        rarity: 'COMMON' 
      },
      VETERAN: { 
        title: 'Veteran', 
        background: 'BLUE', 
        icon: 'MEDAL', 
        rarity: 'UNCOMMON',
        requirement: 'LEVEL_10'
      },
      ELITE: { 
        title: 'Elite Operator', 
        background: 'PURPLE', 
        icon: 'SKULL', 
        rarity: 'RARE',
        requirement: 'LEVEL_25'
      },
      LEGENDARY: { 
        title: 'Legend', 
        background: 'GOLD', 
        icon: 'CROWN', 
        rarity: 'EPIC',
        requirement: 'PRESTIGE_1'
      },
      MASTER: { 
        title: 'Master of War', 
        background: 'RAINBOW', 
        icon: 'TROPHY', 
        rarity: 'LEGENDARY',
        requirement: 'PRESTIGE_5'
      },
      HEADHUNTER: { 
        title: 'Headhunter', 
        background: 'RED', 
        icon: 'CROSSHAIR', 
        rarity: 'RARE',
        requirement: '1000_HEADSHOTS'
      },
      SURVIVOR: { 
        title: 'Survivor', 
        background: 'GREEN', 
        icon: 'HEART', 
        rarity: 'UNCOMMON',
        requirement: '50_WAVES'
      },
      DESTROYER: { 
        title: 'Destroyer', 
        background: 'ORANGE', 
        icon: 'EXPLOSION', 
        rarity: 'RARE',
        requirement: '10000_DAMAGE'
      }
    },

    equipped: 'BASIC',
    unlocked: new Set(),

    init() {
      this.unlocked.clear();
      this.unlocked.add('BASIC');
      this.equipped = 'BASIC';
    },

    equipCard(cardName) {
      if (!this.cards[cardName] || !this.unlocked.has(cardName)) return false;
      this.equipped = cardName;
      return true;
    },

    unlockCard(cardName) {
      if (!this.cards[cardName]) return false;
      this.unlocked.add(cardName);
      return true;
    },

    checkUnlocks(playerStats) {
      Object.keys(this.cards).forEach(cardName => {
        const card = this.cards[cardName];
        if (!card.requirement || this.unlocked.has(cardName)) return;

        let shouldUnlock = false;

        // Parse requirement
        if (card.requirement.startsWith('LEVEL_')) {
          const reqLevel = parseInt(card.requirement.split('_')[1]);
          shouldUnlock = playerStats.level >= reqLevel;
        } else if (card.requirement.startsWith('PRESTIGE_')) {
          const reqPrestige = parseInt(card.requirement.split('_')[1]);
          shouldUnlock = playerStats.prestige >= reqPrestige;
        } else if (card.requirement.includes('HEADSHOTS')) {
          const reqHS = parseInt(card.requirement.split('_')[0]);
          shouldUnlock = playerStats.headshots >= reqHS;
        } else if (card.requirement.includes('WAVES')) {
          const reqWaves = parseInt(card.requirement.split('_')[0]);
          shouldUnlock = playerStats.wavesCompleted >= reqWaves;
        } else if (card.requirement.includes('DAMAGE')) {
          const reqDmg = parseInt(card.requirement.split('_')[0]);
          shouldUnlock = playerStats.totalDamage >= reqDmg;
        }

        if (shouldUnlock) {
          this.unlockCard(cardName);
        }
      });
    },

    getEquippedCard() {
      return {
        name: this.equipped,
        ...this.cards[this.equipped]
      };
    }
  };

  // ──────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────
  return {
    init() {
      WeaponAttachments.init();
      ArmorCustomization.init();
      CharacterAppearance.init();
      EmoteSystem.init();
      VictoryPoses.init();
      CallingCards.init();
    },

    update(dt, playerStats) {
      EmoteSystem.update(dt);
      CallingCards.checkUnlocks(playerStats);
    },

    // Expose subsystems
    WeaponAttachments,
    ArmorCustomization,
    CharacterAppearance,
    EmoteSystem,
    VictoryPoses,
    CallingCards
  };
})();
