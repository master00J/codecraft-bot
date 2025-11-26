/**
 * Comcraft Duel Manager
 * Handles player vs player duels for coins
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class DuelManager {
  constructor(combatXPManager = null, inventoryManager = null) {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Active duels (in-memory for now)
    this.activeDuels = new Map(); // duelId -> duel data
    this.pendingChallenges = new Map(); // messageId -> challenge data
    
    // Combat XP Manager (optional)
    this.combatXPManager = combatXPManager;
    
    // Inventory Manager (optional)
    this.inventoryManager = inventoryManager;
    
    // Sprite Manager for animations
    try {
      const SpriteManager = require('../combat/sprite-manager');
      this.spriteManager = new SpriteManager();
    } catch (error) {
      console.error('Failed to load SpriteManager:', error);
      this.spriteManager = null;
    }
    
    // GIF Generator for animated battle GIFs
    this.gifGenerator = null;
    this.spritesLoaded = false;
    try {
      const DuelGifGenerator = require('../combat/duel-generator');
      const path = require('path');
      const spritePath = path.join(__dirname, '../combat/sprites');
      
      // Check if sprite path exists
      const fs = require('fs');
      if (!fs.existsSync(spritePath)) {
        console.warn(`⚠️ Sprite path does not exist: ${spritePath}`);
      } else {
        this.gifGenerator = new DuelGifGenerator({
          width: 400,
          height: 200,
          frameDelay: 100,
        });
        // Load sprites for GIF generator (async, but we'll check if loaded before using)
        this.gifGenerator.loadSprites(spritePath)
          .then(() => {
            this.spritesLoaded = true;
            console.log('✅ GIF generator sprites loaded successfully');
          })
          .catch(err => {
            console.error('Failed to load sprites for GIF generator:', err);
            this.spritesLoaded = false;
          });
      }
    } catch (error) {
      console.error('Failed to load DuelGifGenerator:', error);
      console.error('Error stack:', error.stack);
      this.gifGenerator = null;
      this.spritesLoaded = false;
    }
  }

  /**
   * Generate a unique duel ID
   */
  generateDuelId() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  /**
   * Create a challenge
   */
  async createChallenge(guildId, challengerId, challengedId, betAmount, economyManager) {
    // Validate bet amount
    if (betAmount <= 0) {
      return { success: false, error: 'Bet amount must be positive' };
    }

    // Check if challenger has enough coins
    const challengerEconomy = await economyManager.getUserEconomy(guildId, challengerId);
    if (!challengerEconomy || challengerEconomy.balance < betAmount) {
      return { success: false, error: `You need at least ${betAmount} coins to bet (you have ${challengerEconomy?.balance || 0})` };
    }

    // Check if challenged user has enough coins
    const challengedEconomy = await economyManager.getUserEconomy(guildId, challengedId);
    if (!challengedEconomy || challengedEconomy.balance < betAmount) {
      return { success: false, error: 'The challenged user does not have enough coins for this bet' };
    }

    const duelId = this.generateDuelId();

    return {
      success: true,
      duelId,
      challengerId,
      challengedId,
      betAmount,
    };
  }

  /**
   * Start a duel
   */
  async startDuel(guildId, duelId, challengerId, challengedId, betAmount, economyManager) {
    // Load combat stats if combat XP manager is available
    let player1CombatStats = null;
    let player2CombatStats = null;
    
    if (this.combatXPManager) {
      [player1CombatStats, player2CombatStats] = await Promise.all([
        this.combatXPManager.getCombatStats(guildId, challengerId),
        this.combatXPManager.getCombatStats(guildId, challengedId),
      ]);
    }

    // Deduct coins from both players
    const challenger = await economyManager.removeCoins(
      guildId,
      challengerId,
      betAmount,
      'duel_bet',
      `Duel bet for ${duelId}`
    );

    if (!challenger.success) {
      return { success: false, error: 'Failed to deduct coins from challenger' };
    }

    const challenged = await economyManager.removeCoins(
      guildId,
      challengedId,
      betAmount,
      'duel_bet',
      `Duel bet for ${duelId}`
    );

    if (!challenged.success) {
      // Refund challenger
      await economyManager.addCoins(
        guildId,
        challengerId,
        betAmount,
        'duel_refund',
        `Duel bet refund for ${duelId}`
      );
      return { success: false, error: 'Failed to deduct coins from challenged user' };
    }

    // Load item bonuses for both players
    let player1Bonuses = { damage: 0, defense: 0, hp: 0, crit: 0 };
    let player2Bonuses = { damage: 0, defense: 0, hp: 0, crit: 0 };

    if (this.inventoryManager) {
      try {
        const p1Inventory = await this.inventoryManager.getUserInventory(guildId, challengerId);
        const p2Inventory = await this.inventoryManager.getUserInventory(guildId, challengedId);
        
        if (p1Inventory) {
          player1Bonuses = p1Inventory.bonuses;
        }
        
        if (p2Inventory) {
          player2Bonuses = p2Inventory.bonuses;
        }
      } catch (error) {
        console.error('Error loading item bonuses for duel:', error);
        // Continue without bonuses
      }
    }

    // Create duel state
    const duel = {
      duelId,
      guildId,
      player1: {
        id: challengerId,
        hp: 100 + player1Bonuses.hp,
        maxHp: 100 + player1Bonuses.hp,
        combatLevel: player1CombatStats?.combat_level || 1,
        damageBonus: player1Bonuses.damage,
        defenseBonus: player1Bonuses.defense,
        critBonus: player1Bonuses.crit,
        damageDealt: 0,
        damageTaken: 0,
      },
      player2: {
        id: challengedId,
        hp: 100 + player2Bonuses.hp,
        maxHp: 100 + player2Bonuses.hp,
        combatLevel: player2CombatStats?.combat_level || 1,
        damageBonus: player2Bonuses.damage,
        defenseBonus: player2Bonuses.defense,
        critBonus: player2Bonuses.crit,
        damageDealt: 0,
        damageTaken: 0,
      },
      betAmount,
      totalPot: betAmount * 2,
      round: 0,
      maxRounds: 20,
      startTime: Date.now(),
      combatLog: [],
      gifRounds: [], // Store rounds for GIF generation
    };

    this.activeDuels.set(duelId, duel);

    return {
      success: true,
      duel,
    };
  }

  /**
   * Calculate damage for an attack
   * @param {Object} player - Player object with bonuses
   */
  calculateDamage(player) {
    // Random damage between 5 and 25
    const baseDamage = Math.floor(Math.random() * 21) + 5;
    
    // 10% base chance for critical hit + item crit bonus
    const critChance = 0.1 + (player.critBonus || 0) / 100;
    const isCrit = Math.random() < critChance;
    let damage = isCrit ? baseDamage * 2 : baseDamage;
    
    // Apply item damage bonus
    damage += (player.damageBonus || 0);
    
    // 15% chance to miss
    const didMiss = Math.random() < 0.15;
    
    return {
      damage: didMiss ? 0 : damage,
      isCrit,
      didMiss,
    };
  }

  /**
   * Process a round of combat
   */
  processRound(duel) {
    duel.round++;

    // Both players attack simultaneously (with their item bonuses)
    let p1Attack = this.calculateDamage(duel.player1);
    let p2Attack = this.calculateDamage(duel.player2);

    // Store HP before damage
    const p1HpBefore = duel.player1.hp;
    const p2HpBefore = duel.player2.hp;

    // Calculate incoming damage
    let p1IncomingDamage = 0;
    let p2IncomingDamage = 0;

    // Apply combat level multipliers if combat XP manager is available
    if (this.combatXPManager) {
      // Player 1 damage bonus and defense
      const p1DamageMultiplier = this.combatXPManager.getDamageMultiplier(duel.player1.combatLevel);
      const p1DefenseMultiplier = this.combatXPManager.getDefenseMultiplier(duel.player1.combatLevel);
      
      // Player 2 damage bonus and defense
      const p2DamageMultiplier = this.combatXPManager.getDamageMultiplier(duel.player2.combatLevel);
      const p2DefenseMultiplier = this.combatXPManager.getDefenseMultiplier(duel.player2.combatLevel);
      
      // Apply damage multipliers
      p1Attack.damage = Math.floor(p1Attack.damage * p1DamageMultiplier);
      p2Attack.damage = Math.floor(p2Attack.damage * p2DamageMultiplier);
      
      // Apply defense multipliers (reduce incoming damage)
      // Defense bonus from items directly reduces damage
      p1IncomingDamage = Math.max(0, Math.floor(p2Attack.damage * p1DefenseMultiplier) - (duel.player1.defenseBonus || 0));
      p2IncomingDamage = Math.max(0, Math.floor(p1Attack.damage * p2DefenseMultiplier) - (duel.player2.defenseBonus || 0));
      
      // Update damage values
      p1Attack.finalDamage = p2IncomingDamage;
      p2Attack.finalDamage = p1IncomingDamage;
      
      // Apply damage
      duel.player2.hp = Math.max(0, duel.player2.hp - p2IncomingDamage);
      duel.player1.hp = Math.max(0, duel.player1.hp - p1IncomingDamage);
      
      // Track damage dealt and taken
      duel.player1.damageDealt += p2IncomingDamage;
      duel.player1.damageTaken += p1IncomingDamage;
      duel.player2.damageDealt += p1IncomingDamage;
      duel.player2.damageTaken += p2IncomingDamage;
    } else {
      // No combat level bonuses, but still apply item defense bonuses
      p1IncomingDamage = Math.max(0, p2Attack.damage - (duel.player1.defenseBonus || 0));
      p2IncomingDamage = Math.max(0, p1Attack.damage - (duel.player2.defenseBonus || 0));
      
      // Update damage values
      p1Attack.finalDamage = p2IncomingDamage;
      p2Attack.finalDamage = p1IncomingDamage;
      
      duel.player2.hp = Math.max(0, duel.player2.hp - p2IncomingDamage);
      duel.player1.hp = Math.max(0, duel.player1.hp - p1IncomingDamage);
    }

    // Add to combat log
    const log = {
      round: duel.round,
      p1Attack,
      p2Attack,
      p1Hp: duel.player1.hp,
      p2Hp: duel.player2.hp,
    };
    duel.combatLog.push(log);
    
    // === SIMPLIFIED GIF ROUNDS ===
    // Store both attacks as separate rounds for the GIF
    // Player 1 attacks first (if didn't miss)
    if (!p1Attack.didMiss) {
      duel.gifRounds.push({
        attacker: 1,
        damage: p2IncomingDamage,
        p1Hp: p1HpBefore, // P1 HP stays same (they're attacking)
        p2Hp: p2HpBefore - p2IncomingDamage, // P2 takes damage
      });
    }

    // Player 2 attacks second (if didn't miss)
    if (!p2Attack.didMiss) {
      duel.gifRounds.push({
        attacker: 2,
        damage: p1IncomingDamage,
        p1Hp: duel.player1.hp, // Final P1 HP
        p2Hp: duel.player2.hp, // Final P2 HP
      });
    }

    // Check for winner
    let winner = null;
    let reason = null;

    if (duel.player1.hp <= 0 && duel.player2.hp <= 0) {
      // Draw - both died
      winner = 'draw';
      reason = 'Both fighters fell at the same time!';
    } else if (duel.player1.hp <= 0) {
      winner = duel.player2.id;
      reason = 'Player 2 wins!';
    } else if (duel.player2.hp <= 0) {
      winner = duel.player1.id;
      reason = 'Player 1 wins!';
    } else if (duel.round >= duel.maxRounds) {
      // Time out - whoever has more HP wins
      if (duel.player1.hp > duel.player2.hp) {
        winner = duel.player1.id;
        reason = 'Player 1 wins by health!';
      } else if (duel.player2.hp > duel.player1.hp) {
        winner = duel.player2.id;
        reason = 'Player 2 wins by health!';
      } else {
        winner = 'draw';
        reason = 'Draw - equal health!';
      }
    }

    return {
      log,
      winner,
      reason,
      isDone: winner !== null,
    };
  }

  /**
   * Finish a duel and award coins
   */
  async finishDuel(duelId, winner, economyManager) {
    const duel = this.activeDuels.get(duelId);
    if (!duel) {
      return { success: false, error: 'Duel not found' };
    }

    let combatXPResult = null;

    if (winner === 'draw') {
      // Refund both players
      await economyManager.addCoins(
        duel.guildId,
        duel.player1.id,
        duel.betAmount,
        'duel_draw',
        `Duel draw refund for ${duelId}`
      );
      await economyManager.addCoins(
        duel.guildId,
        duel.player2.id,
        duel.betAmount,
        'duel_draw',
        `Duel draw refund for ${duelId}`
      );
      
      // No XP for draws (but could add small participation XP in the future)
    } else {
      // Award pot to winner
      await economyManager.addCoins(
        duel.guildId,
        winner,
        duel.totalPot,
        'duel_win',
        `Duel win for ${duelId}`,
        {
          duel_id: duelId,
          opponent: winner === duel.player1.id ? duel.player2.id : duel.player1.id,
          bet_amount: duel.betAmount,
        }
      );
      
      // Award combat XP if combat XP manager is available
      if (this.combatXPManager) {
        const loserId = winner === duel.player1.id ? duel.player2.id : duel.player1.id;
        
        // Prepare damage stats
        const damageDealt = {
          [duel.player1.id]: duel.player1.damageDealt || 0,
          [duel.player2.id]: duel.player2.damageDealt || 0,
        };
        
        const damageTaken = {
          [duel.player1.id]: duel.player1.damageTaken || 0,
          [duel.player2.id]: duel.player2.damageTaken || 0,
        };
        
        combatXPResult = await this.combatXPManager.awardDuelXP(
          duel.guildId,
          winner,
          loserId,
          duel.betAmount,
          duelId,
          damageDealt,
          damageTaken
        );
      }
    }

    // Clear GIF rounds data
    if (duel.gifRounds) {
      duel.gifRounds = [];
    }
    
    this.activeDuels.delete(duelId);

    return { 
      success: true, 
      combatXP: combatXPResult 
    };
  }

  /**
   * Simulate the ENTIRE battle upfront and generate ONE GIF
   * This prevents flash/flicker because there are no message updates during fight
   */
  async simulateFullBattle(duel, player1User, player2User) {
    // Store original HP for GIF
    const originalP1Hp = duel.player1.hp;
    const originalP2Hp = duel.player2.hp;
    
    // Simulate all rounds until someone wins
    const allRounds = [];
    let winner = null;
    let reason = null;
    
    while (!winner && duel.round < duel.maxRounds) {
      const result = this.processRound(duel);
      
      // Get the last log entry
      const lastLog = duel.combatLog[duel.combatLog.length - 1];
      
      // Store round data for text summary
      allRounds.push({
        round: duel.round,
        p1Attack: lastLog.p1Attack,
        p2Attack: lastLog.p2Attack,
        p1Hp: duel.player1.hp,
        p2Hp: duel.player2.hp,
      });
      
      if (result.isDone) {
        winner = result.winner;
        reason = result.reason;
      }
    }
    
    // Determine winner number for GIF (1 or 2)
    let winnerNum = null;
    if (winner && winner !== 'draw') {
      winnerNum = winner === duel.player1.id ? 1 : 2;
    }
    
    // Generate ONE GIF with the entire battle
    let battleGif = null;
    if (this.gifGenerator && this.spritesLoaded && duel.gifRounds.length > 0) {
      try {
        const battleData = {
          player1: { name: player1User.username, maxHp: originalP1Hp },
          player2: { name: player2User.username, maxHp: originalP2Hp },
          rounds: duel.gifRounds, // All rounds - no limit
          winner: winnerNum,
        };
        
        console.log(`🎬 Generating full battle GIF with ${battleData.rounds.length} attacks (${duel.round} combat rounds)`);
        const gifBuffer = await this.gifGenerator.generateFullBattleGif(battleData);
        
        if (gifBuffer && gifBuffer.length > 0) {
          const { AttachmentBuilder } = require('discord.js');
          battleGif = new AttachmentBuilder(gifBuffer, {
            name: `battle_${duel.duelId}.gif`,
          });
          console.log(`✅ Battle GIF generated: ${gifBuffer.length} bytes`);
        }
      } catch (error) {
        console.error('Error generating battle GIF:', error);
      }
    }
    
    return {
      winner,
      reason,
      allRounds,
      totalRounds: duel.round,
      battleGif,
      finalP1Hp: duel.player1.hp,
      finalP2Hp: duel.player2.hp,
    };
  }

  /**
   * Generate health bar visual
   */
  generateHealthBar(hp, maxHp) {
    const percentage = hp / maxHp;
    const barLength = 10;
    const filledLength = Math.round(barLength * percentage);
    const emptyLength = barLength - filledLength;

    let bar = '';
    if (percentage > 0.5) {
      bar = '🟩'.repeat(filledLength) + '⬜'.repeat(emptyLength);
    } else if (percentage > 0.2) {
      bar = '🟨'.repeat(filledLength) + '⬜'.repeat(emptyLength);
    } else {
      bar = '🟥'.repeat(filledLength) + '⬜'.repeat(emptyLength);
    }

    return `${bar} ${hp}/${maxHp}`;
  }

  /**
   * Build challenge embed
   */
  async buildChallengeEmbed(challenger, challenged, betAmount, duelId, challengerData, challengedData) {
    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('⚔️ Duel Challenge!')
      .setDescription(`${challenger} has challenged ${challenged} to a duel!`)
      .addFields(
        {
          name: '💰 Bet Amount',
          value: `${betAmount} coins per player`,
          inline: true,
        },
        {
          name: '🏆 Total Prize Pool',
          value: `${betAmount * 2} coins`,
          inline: true,
        },
        {
          name: '🎲 Duel ID',
          value: `\`${duelId}\``,
          inline: true,
        }
      );

    // Add challenger stats
    if (challengerData) {
      const challengerInfo = [];
      challengerInfo.push(`⚡ Combat Level: **${challengerData.combatLevel || 1}**`);
      
      if (challengerData.equipped) {
        if (challengerData.equipped.weapon) {
          challengerInfo.push(`⚔️ ${challengerData.equipped.weapon.name}`);
        }
        if (challengerData.equipped.armor) {
          challengerInfo.push(`🛡️ ${challengerData.equipped.armor.name}`);
        }
        if (!challengerData.equipped.weapon && !challengerData.equipped.armor) {
          challengerInfo.push('_No gear equipped_');
        }
      }
      
      embed.addFields({
        name: `👤 ${challenger.username || 'Challenger'}`,
        value: challengerInfo.join('\n'),
        inline: true,
      });
    }

    // Add challenged stats
    if (challengedData) {
      const challengedInfo = [];
      challengedInfo.push(`⚡ Combat Level: **${challengedData.combatLevel || 1}**`);
      
      if (challengedData.equipped) {
        if (challengedData.equipped.weapon) {
          challengedInfo.push(`⚔️ ${challengedData.equipped.weapon.name}`);
        }
        if (challengedData.equipped.armor) {
          challengedInfo.push(`🛡️ ${challengedData.equipped.armor.name}`);
        }
        if (!challengedData.equipped.weapon && !challengedData.equipped.armor) {
          challengedInfo.push('_No gear equipped_');
        }
      }
      
      embed.addFields({
        name: `👤 ${challenged.username || 'Challenged'}`,
        value: challengedInfo.join('\n'),
        inline: true,
      });
    }

    embed.addFields({
      name: '📋 Rules',
      value: '• Both players start with 100 HP (+ gear bonuses)\n• Attacks deal 5-25 damage\n• 10% chance for critical hits (2x damage)\n• 15% chance to miss\n• First to 0 HP loses\n• Max 20 rounds',
    });

    embed.setFooter({ text: 'Accept or decline within 60 seconds' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`duel_accept_${duelId}`)
        .setLabel('⚔️ Accept Duel')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`duel_decline_${duelId}`)
        .setLabel('❌ Decline')
        .setStyle(ButtonStyle.Danger)
    );

    return { embed, components: [row] };
  }

  /**
   * Generate a GIF showing the last hit in the duel
   * @param {Object} duel - The duel object
   * @param {Object} player1User - Discord user object for player 1
   * @param {Object} player2User - Discord user object for player 2  
   * @param {Object} lastLog - The last combat log entry
   * @param {boolean} isFinal - Is this the final hit of the duel?
   * @param {string|null} winner - Winner user ID if final
   */
  /**
   * Generate GIF showing both players' attacks (turn-based like OSRS)
   * Random who attacks first each round
   */
  async generateLiveHitGif(duel, player1User, player2User, lastLog, isFinal = false, winner = null) {
    if (!this.gifGenerator || !this.spritesLoaded) {
      return null;
    }

    try {
      // Determine winner number (1 or 2) if final
      let winnerNum = null;
      if (isFinal && winner) {
        winnerNum = winner === duel.player1.id ? 1 : 2;
      }

      // Get damage from both attacks
      const p1Damage = lastLog.p1Attack.finalDamage || (lastLog.p1Attack.didMiss ? 0 : lastLog.p1Attack.damage);
      const p2Damage = lastLog.p2Attack.finalDamage || (lastLog.p2Attack.didMiss ? 0 : lastLog.p2Attack.damage);

      // Random who attacks first (like OSRS)
      const firstAttacker = Math.random() < 0.5 ? 1 : 2;

      const gifBuffer = await this.gifGenerator.generateLiveHitGif({
        player1: { name: player1User.username, maxHp: duel.player1.maxHp },
        player2: { name: player2User.username, maxHp: duel.player2.maxHp },
        p1Attack: {
          damage: p1Damage,
          isMiss: lastLog.p1Attack.didMiss || p1Damage === 0
        },
        p2Attack: {
          damage: p2Damage,
          isMiss: lastLog.p2Attack.didMiss || p2Damage === 0
        },
        p1HpAfter: duel.player1.hp,
        p2HpAfter: duel.player2.hp,
        firstAttacker: firstAttacker,
        isFinal: isFinal,
        winner: winnerNum,
      });

      if (!gifBuffer || gifBuffer.length === 0) {
        return null;
      }

      const { AttachmentBuilder } = require('discord.js');
      return new AttachmentBuilder(gifBuffer, {
        name: `duel_${duel.duelId}_r${duel.round}.gif`,
      });

    } catch (error) {
      console.error('Error generating live hit GIF:', error);
      return null;
    }
  }

  /**
   * Build duel status embed with sprite animations
   */
  async buildDuelEmbed(duel, player1User, player2User, lastLog) {
    const p1Bar = this.generateHealthBar(duel.player1.hp, duel.player1.maxHp);
    const p2Bar = this.generateHealthBar(duel.player2.hp, duel.player2.maxHp);

    let combatText = '';
    if (lastLog) {
      // Player 1 attack
      if (lastLog.p1Attack.didMiss) {
        combatText += `${player1User.username} attacked but **MISSED**!\n`;
      } else if (lastLog.p1Attack.isCrit) {
        const dmg = lastLog.p1Attack.finalDamage || lastLog.p1Attack.damage;
        combatText += `${player1User.username} landed a **CRITICAL HIT** for **${dmg}** damage! 💥\n`;
      } else {
        const dmg = lastLog.p1Attack.finalDamage || lastLog.p1Attack.damage;
        combatText += `${player1User.username} dealt **${dmg}** damage!\n`;
      }

      // Player 2 attack
      if (lastLog.p2Attack.didMiss) {
        combatText += `${player2User.username} attacked but **MISSED**!\n`;
      } else if (lastLog.p2Attack.isCrit) {
        const dmg = lastLog.p2Attack.finalDamage || lastLog.p2Attack.damage;
        combatText += `${player2User.username} landed a **CRITICAL HIT** for **${dmg}** damage! 💥\n`;
      } else {
        const dmg = lastLog.p2Attack.finalDamage || lastLog.p2Attack.damage;
        combatText += `${player2User.username} dealt **${dmg}** damage!\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⚔️ Grand Exchange - Combat Duel')
      .setDescription(`${player1User} vs ${player2User}`)
      .addFields(
        {
          name: `🥊 ${player1User.username}`,
          value: p1Bar,
          inline: false,
        },
        {
          name: `🥊 ${player2User.username}`,
          value: p2Bar,
          inline: false,
        },
        {
          name: `📊 Round ${duel.round}/${duel.maxRounds}`,
          value: combatText || 'The duel is about to begin...',
          inline: false,
        },
        {
          name: '💰 Prize Pool',
          value: `${duel.totalPot} coins`,
          inline: true,
        },
        {
          name: '🎲 Duel ID',
          value: `\`${duel.duelId}\``,
          inline: true,
        }
      )
      .setTimestamp();

    // Generate LIVE GIF showing the last hit
    let attachments = [];
    
    if (this.gifGenerator && this.spritesLoaded && lastLog) {
      try {
        const liveGif = await this.generateLiveHitGif(duel, player1User, player2User, lastLog, false, null);
        if (liveGif) {
          embed.setImage(`attachment://${liveGif.name}`);
          attachments.push(liveGif);
        }
      } catch (error) {
        console.error('Error generating live GIF:', error);
      }
    }

    return { embed, attachments };
  }

  /**
   * Build duel result embed
   */
  async buildResultEmbed(duel, player1User, player2User, winner, reason) {
    let winnerUser;
    let loserUser;
    let color = '#FFD700'; // Gold

    if (winner === 'draw') {
      color = '#808080'; // Gray
    } else if (winner === duel.player1.id) {
      winnerUser = player1User;
      loserUser = player2User;
    } else {
      winnerUser = player2User;
      loserUser = player1User;
    }

    const p1Bar = this.generateHealthBar(duel.player1.hp, duel.player1.maxHp);
    const p2Bar = this.generateHealthBar(duel.player2.hp, duel.player2.maxHp);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(winner === 'draw' ? '🤝 Duel Ended in a Draw!' : '🏆 Duel Victory!')
      .setDescription(winner === 'draw' 
        ? `The duel between ${player1User} and ${player2User} ended in a draw!\n\n${reason}`
        : `${winnerUser} has defeated ${loserUser} in combat!\n\n${reason}`
      )
      .addFields(
        {
          name: `🥊 ${player1User.username}`,
          value: p1Bar,
          inline: false,
        },
        {
          name: `🥊 ${player2User.username}`,
          value: p2Bar,
          inline: false,
        },
        {
          name: '📊 Final Stats',
          value: `Total Rounds: ${duel.round}\nDuration: ${Math.round((Date.now() - duel.startTime) / 1000)}s`,
          inline: true,
        },
        {
          name: winner === 'draw' ? '💰 Refunded' : '💰 Prize Won',
          value: winner === 'draw' ? `${duel.betAmount} coins each` : `${duel.totalPot} coins`,
          inline: true,
        }
      )
      .setFooter({ text: `Duel ID: ${duel.duelId}` })
      .setTimestamp();

    let attachments = [];

    if (this.gifGenerator && this.spritesLoaded && winner !== 'draw') {
      try {
        // Get the last log entry
        const lastLog = duel.combatLog[duel.combatLog.length - 1];
        
        if (lastLog) {
          // Generate final GIF with winner animation
          const finalGif = await this.generateLiveHitGif(duel, player1User, player2User, lastLog, true, winner);
          if (finalGif) {
            embed.setImage(`attachment://${finalGif.name}`);
            attachments.push(finalGif);
          }
        }
      } catch (error) {
        console.error('Error generating final GIF:', error);
      }
    }

    return { embed, attachments };
  }

  /**
   * Cancel a duel
   */
  cancelDuel(duelId) {
    this.activeDuels.delete(duelId);
  }

  /**
   * Get active duel
   */
  getDuel(duelId) {
    return this.activeDuels.get(duelId);
  }

  /**
   * Store pending challenge
   */
  storePendingChallenge(messageId, challengeData) {
    this.pendingChallenges.set(messageId, challengeData);
    
    // Auto-expire after 60 seconds
    setTimeout(() => {
      this.pendingChallenges.delete(messageId);
    }, 60000);
  }

  /**
   * Get pending challenge
   */
  getPendingChallenge(messageId) {
    return this.pendingChallenges.get(messageId);
  }

  /**
   * Remove pending challenge
   */
  removePendingChallenge(messageId) {
    this.pendingChallenges.delete(messageId);
  }
}

module.exports = DuelManager;

