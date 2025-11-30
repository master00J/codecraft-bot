/**
 * Comcraft Casino Manager
 * Handles casino games with button-based interactions
 */

const { createClient } = require('@supabase/supabase-js');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const FeatureGate = require('../feature-gate');
const configManager = require('../config-manager');

// Import EconomyManager with validation
let EconomyManager;
try {
  const economyModule = require('../economy/manager');
  EconomyManager = economyModule;
  
  if (!EconomyManager || typeof EconomyManager !== 'function') {
    console.error('❌ EconomyManager export issue:');
    console.error('  Type:', typeof EconomyManager);
    console.error('  Value:', EconomyManager);
    throw new Error('EconomyManager is not exported as a class. Got type: ' + typeof EconomyManager);
  }
  console.log('✓ EconomyManager imported successfully in CasinoManager');
} catch (error) {
  console.error('❌ Failed to import EconomyManager in CasinoManager:', error);
  throw error;
}

// Import CoinflipGenerator for animated GIFs
let CoinflipGenerator;
try {
  CoinflipGenerator = require('./coinflip-generator');
  console.log('✓ CoinflipGenerator imported successfully');
} catch (error) {
  console.warn('⚠️ CoinflipGenerator not available:', error.message);
}

// Import DiceGifGenerator for animated dice rolls
let DiceGifGenerator;
try {
  DiceGifGenerator = require('./dice-generator');
  console.log('✓ DiceGifGenerator imported successfully');
} catch (error) {
  console.warn('⚠️ DiceGifGenerator not available:', error.message);
}

// Import SlotsGifGenerator for animated slots
let SlotsGifGenerator;
try {
  SlotsGifGenerator = require('./slots-generator');
  console.log('✓ SlotsGifGenerator imported successfully');
} catch (error) {
  console.warn('⚠️ SlotsGifGenerator not available:', error.message);
}

// Import RouletteGenerator for animated roulette
let RouletteGenerator;
try {
  RouletteGenerator = require('./roulette-generator');
  console.log('✓ RouletteGenerator imported successfully');
} catch (error) {
  console.warn('⚠️ RouletteGenerator not available:', error.message);
}

class CasinoManager {
  constructor() {
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is required for CasinoManager');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for CasinoManager');
    }
    
    try {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      this.featureGate = new FeatureGate(configManager);
      
      // Check if EconomyManager is a valid constructor
      if (!EconomyManager || typeof EconomyManager !== 'function') {
        throw new Error('EconomyManager is not a valid constructor. Received: ' + typeof EconomyManager);
      }
      
      this.economyManager = new EconomyManager();
      this.activeGames = new Map(); // Store active game states (e.g., blackjack hands)
      
      // Initialize coinflip generator for animated GIFs
      if (CoinflipGenerator) {
        this.coinflipGenerator = new CoinflipGenerator({
          width: 300,
          height: 180,
          frameDelay: 70,
        });
        console.log('✓ CoinflipGenerator initialized');
      }
      
      // Initialize dice generator for animated dice rolls
      if (DiceGifGenerator) {
        this.diceGifGenerator = new DiceGifGenerator({
          width: 300,
          height: 180,
          frameDelay: 80,
        });
        console.log('✓ DiceGifGenerator initialized');
      }
      
      // Initialize slots generator for animated slots (3x3 grid)
      if (SlotsGifGenerator) {
        this.slotsGifGenerator = new SlotsGifGenerator({
          width: 320,
          height: 240, // Taller for 3 rows
          frameDelay: 80,
          spinFrames: 35, // Longer spin for better visibility
          resultFrames: 12,
        });
        console.log('✓ SlotsGifGenerator initialized (3x3 grid)');
      }
      
      // Initialize roulette generator for animated roulette wheel
      if (RouletteGenerator) {
        this.rouletteGenerator = new RouletteGenerator({
          width: 400,
          height: 400,
          frameDelay: 50,
          spinFrames: 60,
          decelerationFrames: 30,
          resultFrames: 20,
        });
        console.log('✓ RouletteGenerator initialized');
      }
    } catch (error) {
      console.error('Error creating CasinoManager:', error);
      throw error;
    }
  }

  /**
   * Get or create casino config for guild
   */
  async getCasinoConfig(guildId) {
    const { data, error } = await this.supabase
      .from('casino_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Create default config
      const { data: newData, error: insertError } = await this.supabase
        .from('casino_configs')
        .insert({
          guild_id: guildId,
          casino_enabled: true,
          min_bet: 10,
          max_bet: 100000,
          dice_enabled: true,
          slots_enabled: true,
          coinflip_enabled: true,
          blackjack_enabled: true,
          roulette_enabled: true,
          house_edge: 5.0,
          game_cooldown: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating casino config:', insertError);
        return null;
      }

      return newData;
    }

    if (error) {
      console.error('Error fetching casino config:', error);
      return null;
    }

    return data;
  }

  /**
   * Check if casino is enabled for guild
   */
  async isCasinoEnabled(guildId) {
    const hasFeature = await configManager.hasFeature(guildId, 'casino');
    if (!hasFeature) return false;

    const config = await this.getCasinoConfig(guildId);
    return config?.casino_enabled !== false;
  }

  /**
   * Build casino menu embed with game buttons
   */
  async buildCasinoMenu(guildId, userId) {
    const config = await this.getCasinoConfig(guildId);
    if (!config) {
      return {
        embed: new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('❌ Casino Error')
          .setDescription('Casino configuration not found. Please contact an administrator.'),
        components: [],
      };
    }

    const userEconomy = await this.economyManager.getUserEconomy(guildId, userId);
    const balance = userEconomy ? BigInt(userEconomy.balance) : BigInt(0);

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🎰 Casino')
      .setDescription('Choose a game to play!')
      .addFields(
        {
          name: '💰 Your Balance',
          value: `${this.economyManager.formatCoins(balance)} coins`,
          inline: true,
        },
        {
          name: '📊 Min/Max Bet',
          value: `${config.min_bet.toLocaleString()} - ${config.max_bet.toLocaleString()}`,
          inline: true,
        },
        {
          name: '🏠 House Edge',
          value: `${config.house_edge}%`,
          inline: true,
        }
      )
      .setFooter({ text: 'Premium & Enterprise feature' })
      .setTimestamp();

    const row = new ActionRowBuilder();

    if (config.dice_enabled) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`casino_dice_${userId}`)
          .setLabel('🎲 Dice')
          .setStyle(ButtonStyle.Primary)
      );
    }

    if (config.slots_enabled) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`casino_slots_${userId}`)
          .setLabel('🎰 Slots')
          .setStyle(ButtonStyle.Primary)
      );
    }

    if (config.coinflip_enabled) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`casino_coinflip_${userId}`)
          .setLabel('🪙 Coinflip')
          .setStyle(ButtonStyle.Primary)
      );
    }

    if (config.blackjack_enabled) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`casino_blackjack_${userId}`)
          .setLabel('🃏 Blackjack')
          .setStyle(ButtonStyle.Primary)
      );
    }

    // Roulette is enabled by default if not set (for backward compatibility)
    if (config.roulette_enabled !== false) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`casino_roulette_${userId}`)
          .setLabel('🎡 Roulette')
          .setStyle(ButtonStyle.Primary)
      );
    }

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_stats_${userId}`)
        .setLabel('📊 Statistieken')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`casino_leaderboard_${guildId}`)
        .setLabel('🏆 Leaderboard')
        .setStyle(ButtonStyle.Secondary)
    );

    return {
      embed,
      components: [row, row2],
    };
  }

  /**
   * Handle dice game
   */
  async playDice(guildId, userId, username, betAmount) {
    const config = await this.getCasinoConfig(guildId);
    if (!config || !config.dice_enabled) {
      return { success: false, error: 'Dice is disabled' };
    }

    // Validate bet
    if (betAmount < config.min_bet || betAmount > config.max_bet) {
      return {
        success: false,
        error: `Bet must be between ${config.min_bet.toLocaleString()} and ${config.max_bet.toLocaleString()} coins`,
      };
    }

    // Check balance
    const userEconomy = await this.economyManager.getUserEconomy(guildId, userId, username);
    if (!userEconomy || BigInt(userEconomy.balance) < BigInt(betAmount)) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Roll dice (1-6)
    const playerRoll = Math.floor(Math.random() * 6) + 1;
    const houseRoll = Math.floor(Math.random() * 6) + 1;

    let result = 'loss';
    let winAmount = 0;

    if (playerRoll > houseRoll) {
      // Win: 2x bet (minus house edge)
      const payout = Math.floor(betAmount * 2 * (1 - config.house_edge / 100));
      winAmount = payout;
      result = 'win';
    } else if (playerRoll === houseRoll) {
      // Draw: return bet
      winAmount = betAmount;
      result = 'draw';
    }
    // Loss: betAmount is already deducted

    // Update balance
    if (result === 'win') {
      const netWin = winAmount - betAmount;
      await this.economyManager.addCoins(
        guildId,
        userId,
        netWin,
        'casino_win',
        `Dice game: Rolled ${playerRoll} vs ${houseRoll}`,
        { game_type: 'dice', player_roll: playerRoll, house_roll: houseRoll }
      );
    } else if (result === 'draw') {
      // Return bet
      await this.economyManager.addCoins(
        guildId,
        userId,
        betAmount,
        'casino_draw',
        `Dice game: Draw (both ${playerRoll})`,
        { game_type: 'dice', roll: playerRoll }
      );
    } else {
      // Loss: remove bet
      await this.economyManager.removeCoins(
        guildId,
        userId,
        betAmount,
        'casino_loss',
        `Dice game: Rolled ${playerRoll} vs ${houseRoll}`,
        { game_type: 'dice', player_roll: playerRoll, house_roll: houseRoll }
      );
    }

    // Log game
    await this.logGame(guildId, userId, username, 'dice', betAmount, winAmount, result, {
      player_roll: playerRoll,
      house_roll: houseRoll,
    });

    // Update stats
    await this.updateStats(guildId, userId, 'dice', betAmount, winAmount, result);

    // Generate animated dice roll GIF
    let gifBuffer = null;
    if (this.diceGifGenerator) {
      try {
        const gifResult = await this.diceGifGenerator.roll({
          player1: username,
          player2: 'House',
          roll1: playerRoll,
          roll2: houseRoll,
          betAmount: betAmount,
        });
        gifBuffer = gifResult.buffer;
        console.log(`✅ DiceGifGenerator: Created GIF buffer of ${gifBuffer.length} bytes`);
      } catch (gifError) {
        console.warn('⚠️ Failed to generate dice GIF:', gifError.message);
      }
    } else {
      console.warn('⚠️ DiceGifGenerator not initialized');
    }

    return {
      success: true,
      result,
      playerRoll,
      houseRoll,
      betAmount,
      winAmount,
      netResult: result === 'win' ? winAmount - betAmount : result === 'draw' ? 0 : -betAmount,
      gifBuffer, // Animated dice roll GIF
    };
  }

  /**
   * Handle slots game
   */
  async playSlots(guildId, userId, username, betAmount) {
    const config = await this.getCasinoConfig(guildId);
    if (!config || !config.slots_enabled) {
      return { success: false, error: 'Slots is disabled' };
    }

    if (betAmount < config.min_bet || betAmount > config.max_bet) {
      return {
        success: false,
        error: `Bet must be between ${config.min_bet.toLocaleString()} and ${config.max_bet.toLocaleString()} coins`,
      };
    }

    const userEconomy = await this.economyManager.getUserEconomy(guildId, userId, username);
    if (!userEconomy || BigInt(userEconomy.balance) < BigInt(betAmount)) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Slot symbols: 🍒 🍋 🍊 🍇 🔔 ⭐ 💎 🎁 (bonus)
    const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '🎁'];
    
    // Generate 3x3 grid (3 reels, each with 3 rows)
    const reels = [
      [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ],
      [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ],
      [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ]
    ];

    let result = 'loss';
    let winAmount = 0;
    let multiplier = 0;
    let winningLines = [];

    // Check for wins on multiple paylines
    // Payline 1: Top row (reels[0][0], reels[1][0], reels[2][0])
    // Payline 2: Middle row (reels[0][1], reels[1][1], reels[2][1])
    // Payline 3: Bottom row (reels[0][2], reels[1][2], reels[2][2])
    // Payline 4: Diagonal top-left to bottom-right
    // Payline 5: Diagonal top-right to bottom-left
    
    const paylines = [
      { name: 'Top Row', symbols: [reels[0][0], reels[1][0], reels[2][0]], row: 0 },
      { name: 'Middle Row', symbols: [reels[0][1], reels[1][1], reels[2][1]], row: 1 },
      { name: 'Bottom Row', symbols: [reels[0][2], reels[1][2], reels[2][2]], row: 2 },
      { name: 'Diagonal ↘', symbols: [reels[0][0], reels[1][1], reels[2][2]], row: -1 },
      { name: 'Diagonal ↙', symbols: [reels[0][2], reels[1][1], reels[2][0]], row: -1 },
    ];

    // Check for bonus trigger (3 bonus symbols on any payline)
    let bonusTriggered = false;
    let bonusSpins = 0;
    
    // Check each payline
    for (const line of paylines) {
      const [s1, s2, s3] = line.symbols;
      let lineMultiplier = 0;

      // Check for bonus trigger (3 bonus symbols)
      if (s1 === '🎁' && s2 === '🎁' && s3 === '🎁') {
        bonusTriggered = true;
        // Random bonus spins between 3 and 10
        bonusSpins = Math.floor(Math.random() * 8) + 3; // 3-10 spins
        lineMultiplier = 0; // Bonus doesn't pay on the trigger spin
      } else if (s1 === s2 && s2 === s3) {
        // Three of a kind
        if (s1 === '💎') {
          lineMultiplier = 10; // Jackpot
        } else if (s1 === '⭐') {
          lineMultiplier = 5;
        } else if (s1 === '🔔') {
          lineMultiplier = 3;
        } else {
          lineMultiplier = 2;
        }
      } else if (s1 === s2 || s2 === s3 || s1 === s3) {
        // Two of a kind
        lineMultiplier = 1.5;
      }

      if (lineMultiplier > 0) {
        winningLines.push({
          name: line.name,
          symbols: line.symbols,
          multiplier: lineMultiplier,
          row: line.row
        });
        
        // Use highest multiplier
        if (lineMultiplier > multiplier) {
          multiplier = lineMultiplier;
        }
      }
    }

    // Calculate total win (can win on multiple lines!)
    if (winningLines.length > 0) {
      // Sum all winning lines
      const totalMultiplier = winningLines.reduce((sum, line) => sum + line.multiplier, 0);
      const payout = Math.floor(betAmount * totalMultiplier * (1 - config.house_edge / 100));
      winAmount = payout;
      result = 'win';
      multiplier = totalMultiplier; // Total multiplier from all lines
    }

    // Update balance
    if (result === 'win') {
      const netWin = winAmount - betAmount;
      const reelDisplay = reels.map(r => r.join(' ')).join(' | ');
      await this.economyManager.addCoins(
        guildId,
        userId,
        netWin,
        'casino_win',
        `Slots: ${winningLines.length} line(s) - ${winningLines.map(l => l.name).join(', ')}`,
        { game_type: 'slots', reels: reels, multiplier, winningLines }
      );
    } else {
      const reelDisplay = reels.map(r => r.join(' ')).join(' | ');
      await this.economyManager.removeCoins(
        guildId,
        userId,
        betAmount,
        'casino_loss',
        `Slots: No win`,
        { game_type: 'slots', reels: reels }
      );
    }

    // Log game
    await this.logGame(guildId, userId, username, 'slots', betAmount, winAmount, result, {
      reels: reels,
      multiplier: multiplier || 0,
      winningLines: winningLines.length,
    });

    // Update stats
    await this.updateStats(guildId, userId, 'slots', betAmount, winAmount, result);

    // Generate animated slots GIF
    let gifBuffer = null;
    if (this.slotsGifGenerator) {
      try {
        const gifResult = await this.slotsGifGenerator.spin({
          playerName: username,
          reels: reels, // Now 3x3 grid
          result: result,
          multiplier: multiplier,
          betAmount: betAmount,
          winAmount: winAmount,
          winningLines: winningLines,
        });
        gifBuffer = gifResult.buffer;
        console.log(`✅ SlotsGifGenerator: Created GIF buffer of ${gifBuffer.length} bytes`);
      } catch (gifError) {
        console.warn('⚠️ Failed to generate slots GIF:', gifError.message);
      }
    } else {
      console.warn('⚠️ SlotsGifGenerator not initialized');
    }

    return {
      success: true,
      result,
      reels: reels, // 3x3 grid
      betAmount,
      winAmount,
      multiplier,
      winningLines,
      netResult: result === 'win' ? winAmount - betAmount : -betAmount,
      gifBuffer, // Animated slots GIF
      bonusTriggered, // Whether bonus was triggered
      bonusSpins, // Number of bonus spins (if triggered)
    };
  }

  /**
   * Execute bonus spins (free spins without bet)
   */
  async playBonusSpins(guildId, userId, username, originalBetAmount, numberOfSpins) {
    const config = await this.getCasinoConfig(guildId);
    if (!config || !config.slots_enabled) {
      return { success: false, error: 'Slots is disabled' };
    }

    const bonusResults = [];
    let totalWinAmount = 0;
    let totalNetResult = 0;

    // Slot symbols: 🍒 🍋 🍊 🍇 🔔 ⭐ 💎 (no bonus symbol in bonus spins)
    const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎'];

    for (let spin = 0; spin < numberOfSpins; spin++) {
      // Generate 3x3 grid
      const reels = [
        [
          symbols[Math.floor(Math.random() * symbols.length)],
          symbols[Math.floor(Math.random() * symbols.length)],
          symbols[Math.floor(Math.random() * symbols.length)]
        ],
        [
          symbols[Math.floor(Math.random() * symbols.length)],
          symbols[Math.floor(Math.random() * symbols.length)],
          symbols[Math.floor(Math.random() * symbols.length)]
        ],
        [
          symbols[Math.floor(Math.random() * symbols.length)],
          symbols[Math.floor(Math.random() * symbols.length)],
          symbols[Math.floor(Math.random() * symbols.length)]
        ]
      ];

      let result = 'loss';
      let winAmount = 0;
      let multiplier = 0;
      let winningLines = [];

      const paylines = [
        { name: 'Top Row', symbols: [reels[0][0], reels[1][0], reels[2][0]], row: 0 },
        { name: 'Middle Row', symbols: [reels[0][1], reels[1][1], reels[2][1]], row: 1 },
        { name: 'Bottom Row', symbols: [reels[0][2], reels[1][2], reels[2][2]], row: 2 },
        { name: 'Diagonal ↘', symbols: [reels[0][0], reels[1][1], reels[2][2]], row: -1 },
        { name: 'Diagonal ↙', symbols: [reels[0][2], reels[1][1], reels[2][0]], row: -1 },
      ];

      // Check each payline
      for (const line of paylines) {
        const [s1, s2, s3] = line.symbols;
        let lineMultiplier = 0;

        if (s1 === s2 && s2 === s3) {
          // Three of a kind
          if (s1 === '💎') {
            lineMultiplier = 10;
          } else if (s1 === '⭐') {
            lineMultiplier = 5;
          } else if (s1 === '🔔') {
            lineMultiplier = 3;
          } else {
            lineMultiplier = 2;
          }
        } else if (s1 === s2 || s2 === s3 || s1 === s3) {
          // Two of a kind
          lineMultiplier = 1.5;
        }

        if (lineMultiplier > 0) {
          winningLines.push({
            name: line.name,
            symbols: line.symbols,
            multiplier: lineMultiplier,
            row: line.row
          });
          
          if (lineMultiplier > multiplier) {
            multiplier = lineMultiplier;
          }
        }
      }

      // Calculate win
      if (winningLines.length > 0) {
        const totalMultiplier = winningLines.reduce((sum, line) => sum + line.multiplier, 0);
        const payout = Math.floor(originalBetAmount * totalMultiplier * (1 - config.house_edge / 100));
        winAmount = payout;
        result = 'win';
        multiplier = totalMultiplier;
      }

      // Add winnings (bonus spins are free, so we only add wins)
      if (result === 'win') {
        await this.economyManager.addCoins(
          guildId,
          userId,
          winAmount,
          'casino_win',
          `Slots Bonus Spin ${spin + 1}/${numberOfSpins}: ${winningLines.length} line(s)`,
          { game_type: 'slots_bonus', reels: reels, multiplier, winningLines, spin: spin + 1 }
        );
        totalWinAmount += winAmount;
        totalNetResult += winAmount;
      }

      // Log bonus spin
      await this.logGame(guildId, userId, username, 'slots_bonus', 0, winAmount, result, {
        reels: reels,
        multiplier: multiplier || 0,
        winningLines: winningLines.length,
        spin: spin + 1,
        totalSpins: numberOfSpins,
      });

      bonusResults.push({
        spin: spin + 1,
        reels,
        result,
        winAmount,
        multiplier,
        winningLines,
        netResult: result === 'win' ? winAmount : 0,
      });
    }

    // Update stats (use original bet amount for stats)
    await this.updateStats(guildId, userId, 'slots', originalBetAmount, totalWinAmount, totalWinAmount > 0 ? 'win' : 'loss');

    return {
      success: true,
      bonusResults,
      totalWinAmount,
      totalNetResult,
      numberOfSpins,
    };
  }

  /**
   * Calculate coinflip result without executing (for GIF generation)
   */
  calculateCoinflipResult(guildId, userId, username, betAmount, choice) {
    // Flip coin
    const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = coinResult === choice;
    
    return {
      coinResult,
      won,
      choice,
      betAmount,
    };
  }

  /**
   * Execute coinflip (without GIF generation)
   * @param {string} guildId
   * @param {string} userId
   * @param {string} username
   * @param {number} betAmount
   * @param {string} choice - 'heads' or 'tails'
   * @param {object} options - Optional: { coinResult } to use a predetermined result
   */
  async executeCoinflip(guildId, userId, username, betAmount, choice, options = {}) {
    const config = await this.getCasinoConfig(guildId);
    if (!config || !config.coinflip_enabled) {
      return { success: false, error: 'Coinflip is disabled' };
    }

    if (betAmount < config.min_bet || betAmount > config.max_bet) {
      return {
        success: false,
        error: `Bet must be between ${config.min_bet.toLocaleString()} and ${config.max_bet.toLocaleString()} coins`,
      };
    }

    const userEconomy = await this.economyManager.getUserEconomy(guildId, userId, username);
    if (!userEconomy || BigInt(userEconomy.balance) < BigInt(betAmount)) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Flip coin (use predetermined result if provided)
    const coinResult = options.coinResult || (Math.random() < 0.5 ? 'heads' : 'tails');
    const won = coinResult === choice;

    let winAmount = 0;
    if (won) {
      // Win: 2x bet (minus house edge)
      const payout = Math.floor(betAmount * 2 * (1 - config.house_edge / 100));
      winAmount = payout;
      const netWin = winAmount - betAmount;
      await this.economyManager.addCoins(
        guildId,
        userId,
        netWin,
        'casino_win',
        `Coinflip: ${coinResult} (you chose ${choice})`,
        { game_type: 'coinflip', result: coinResult, choice }
      );
    } else {
      // Loss
      await this.economyManager.removeCoins(
        guildId,
        userId,
        betAmount,
        'casino_loss',
        `Coinflip: ${coinResult} (you chose ${choice})`,
        { game_type: 'coinflip', result: coinResult, choice }
      );
    }

    // Log game
    await this.logGame(
      guildId,
      userId,
      username,
      'coinflip',
      betAmount,
      winAmount,
      won ? 'win' : 'loss',
      { result: coinResult, choice }
    );

    // Update stats
    await this.updateStats(guildId, userId, 'coinflip', betAmount, winAmount, won ? 'win' : 'loss');

    return {
      success: true,
      result: won ? 'win' : 'loss',
      coinResult,
      choice,
      betAmount,
      winAmount,
      netResult: won ? winAmount - betAmount : -betAmount,
    };
  }

  /**
   * Handle coinflip game (with GIF generation)
   * This is kept for backwards compatibility
   */
  async playCoinflip(guildId, userId, username, betAmount, choice) {
    // Execute coinflip first
    const result = await this.executeCoinflip(guildId, userId, username, betAmount, choice);
    
    if (!result.success) {
      return result;
    }

    // Generate animated GIF
    let gifBuffer = null;
    if (this.coinflipGenerator) {
      try {
        console.log(`🎬 Generating coinflip GIF for ${username} (${choice} -> ${result.coinResult})`);
        gifBuffer = await this.coinflipGenerator.generateCoinflipGif({
          playerName: username,
          playerChoice: choice,
          result: result.coinResult,
          betAmount,
        });
        if (gifBuffer && Buffer.isBuffer(gifBuffer) && gifBuffer.length > 0) {
          console.log(`✅ Coinflip GIF generated: ${gifBuffer.length} bytes`);
        } else {
          console.warn('⚠️ Coinflip GIF generation returned empty buffer');
        }
      } catch (error) {
        console.error('❌ Error generating coinflip GIF:', error);
      }
    } else {
      console.warn('⚠️ CoinflipGenerator not initialized');
    }

    return {
      ...result,
      gifBuffer, // Animated GIF buffer
    };
  }

  /**
   * Handle blackjack game (simplified version)
   */
  async playBlackjack(guildId, userId, username, betAmount) {
    const config = await this.getCasinoConfig(guildId);
    if (!config || !config.blackjack_enabled) {
      return { success: false, error: 'Blackjack is disabled' };
    }

    if (betAmount < config.min_bet || betAmount > config.max_bet) {
      return {
        success: false,
        error: `Bet must be between ${config.min_bet.toLocaleString()} and ${config.max_bet.toLocaleString()} coins`,
      };
    }

    const userEconomy = await this.economyManager.getUserEconomy(guildId, userId, username);
    if (!userEconomy || BigInt(userEconomy.balance) < BigInt(betAmount)) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Remove bet upfront
    await this.economyManager.removeCoins(guildId, userId, betAmount, 'casino_bet', 'Blackjack bet placed');

    // Deal initial cards
    const playerCards = [this.drawCard(), this.drawCard()];
    const dealerCards = [this.drawCard(), this.drawCard()];

    const gameId = `${guildId}_${userId}_${Date.now()}`;
    this.activeGames.set(gameId, {
      guildId,
      userId,
      username,
      betAmount,
      playerCards,
      dealerCards,
      dealerHidden: true,
      playerStand: false,
      dealerStand: false,
      createdAt: Date.now(),
    });

    return {
      success: true,
      gameId,
      playerCards,
      dealerCards: [dealerCards[0], '?'], // Hide second card
      playerValue: this.calculateHand(playerCards),
      dealerValue: this.calculateHand([dealerCards[0]]),
    };
  }

  /**
   * Get dice emoji for number (1-6)
   */
  getDiceEmoji(number) {
    const diceEmojis = {
      1: '⚀',
      2: '⚁',
      3: '⚂',
      4: '⚃',
      5: '⚄',
      6: '⚅'
    };
    return diceEmojis[number] || '🎲';
  }

  /**
   * Get card emoji representation
   */
  getCardEmoji(cardValue) {
    if (cardValue === 11 || cardValue === 1) return '🂡'; // Ace
    if (cardValue === 10) return '🂪'; // 10
    if (cardValue === 9) return '🂩';
    if (cardValue === 8) return '🂨';
    if (cardValue === 7) return '🂧';
    if (cardValue === 6) return '🂦';
    if (cardValue === 5) return '🂥';
    if (cardValue === 4) return '🂤';
    if (cardValue === 3) return '🂣';
    if (cardValue === 2) return '🂢';
    return '🂠'; // Unknown
  }

  /**
   * Format card value for display
   */
  formatCardValue(cardValue) {
    if (cardValue === 11 || cardValue === 1) return 'A';
    if (cardValue === 10) return '10';
    return cardValue.toString();
  }

  /**
   * Draw a card (1-11, where 11 is Ace)
   */
  drawCard() {
    const value = Math.floor(Math.random() * 13) + 1;
    return Math.min(value, 10); // Face cards are 10, Ace is 11 (handled in calculateHand)
  }

  /**
   * Calculate hand value (handles Aces)
   */
  calculateHand(cards) {
    let value = 0;
    let aces = 0;

    for (const card of cards) {
      if (card === 11 || card === 1) {
        aces++;
        value += 11;
      } else {
        value += card;
      }
    }

    // Adjust for Aces
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  }

  /**
   * Hit in blackjack
   */
  async hitBlackjack(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game || game.playerStand) {
      return { success: false, error: 'Invalid game or already standing' };
    }

    const newCard = this.drawCard();
    game.playerCards.push(newCard);
    const playerValue = this.calculateHand(game.playerCards);

    if (playerValue > 21) {
      // Bust
      game.playerStand = true;
      game.dealerStand = true;
      this.activeGames.delete(gameId);

      // Log loss
      await this.logGame(
        game.guildId,
        game.userId,
        game.username,
        'blackjack',
        game.betAmount,
        0,
        'loss',
        { player_cards: game.playerCards, dealer_cards: game.dealerCards, player_bust: true }
      );

      await this.updateStats(game.guildId, game.userId, 'blackjack', game.betAmount, 0, 'loss');

      return {
        success: true,
        bust: true,
        playerCards: game.playerCards,
        playerValue,
        result: 'loss',
      };
    }

    this.activeGames.set(gameId, game);

    return {
      success: true,
      playerCards: game.playerCards,
      playerValue,
      bust: false,
    };
  }

  /**
   * Stand in blackjack
   */
  async standBlackjack(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) {
      return { success: false, error: 'Invalid game' };
    }

    game.playerStand = true;
    game.dealerHidden = false;

    // Dealer plays
    let dealerValue = this.calculateHand(game.dealerCards);
    while (dealerValue < 17) {
      game.dealerCards.push(this.drawCard());
      dealerValue = this.calculateHand(game.dealerCards);
    }

    game.dealerStand = true;

    const playerValue = this.calculateHand(game.playerCards);
    const config = await this.getCasinoConfig(game.guildId);

    let result = 'loss';
    let winAmount = 0;

    if (dealerValue > 21) {
      // Dealer busts
      result = 'win';
      winAmount = Math.floor(game.betAmount * 2 * (1 - config.house_edge / 100));
    } else if (playerValue > dealerValue) {
      // Player wins
      result = 'win';
      winAmount = Math.floor(game.betAmount * 2 * (1 - config.house_edge / 100));
    } else if (playerValue === dealerValue) {
      // Push (return bet)
      result = 'draw';
      winAmount = game.betAmount;
    }

    // Update balance
    if (result === 'win') {
      const netWin = winAmount - game.betAmount;
      await this.economyManager.addCoins(
        game.guildId,
        game.userId,
        netWin,
        'casino_win',
        `Blackjack: ${playerValue} vs ${dealerValue}`,
        { game_type: 'blackjack', player_cards: game.playerCards, dealer_cards: game.dealerCards }
      );
    } else if (result === 'draw') {
      await this.economyManager.addCoins(
        game.guildId,
        game.userId,
        game.betAmount,
        'casino_draw',
        `Blackjack: Push (${playerValue})`,
        { game_type: 'blackjack', player_cards: game.playerCards, dealer_cards: game.dealerCards }
      );
    }

    // Log game
    await this.logGame(
      game.guildId,
      game.userId,
      game.username,
      'blackjack',
      game.betAmount,
      winAmount,
      result,
      {
        player_cards: game.playerCards,
        dealer_cards: game.dealerCards,
        player_value: playerValue,
        dealer_value: dealerValue,
      }
    );

    await this.updateStats(game.guildId, game.userId, 'blackjack', game.betAmount, winAmount, result);

    this.activeGames.delete(gameId);

    return {
      success: true,
      playerCards: game.playerCards,
      dealerCards: game.dealerCards,
      playerValue,
      dealerValue,
      result,
      betAmount: game.betAmount,
      winAmount,
      netResult: result === 'win' ? winAmount - game.betAmount : result === 'draw' ? 0 : -game.betAmount,
    };
  }

  /**
   * Log game to database
   */
  async logGame(guildId, userId, username, gameType, betAmount, winAmount, result, gameData) {
    await this.supabase.from('casino_history').insert({
      guild_id: guildId,
      user_id: userId,
      username: username,
      game_type: gameType,
      bet_amount: betAmount,
      win_amount: winAmount,
      result: result,
      game_data: gameData || {},
    });
  }

  /**
   * Update casino statistics
   */
  async updateStats(guildId, userId, gameType, betAmount, winAmount, result) {
    const { data: existing } = await this.supabase
      .from('casino_stats')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    const profit = result === 'win' ? winAmount - betAmount : result === 'draw' ? 0 : -betAmount;

    if (existing) {
      // Handle undefined values for new game types (e.g., roulette)
      const existingProfit = existing[`${gameType}_profit`] ?? 0;
      const existingGames = existing[`${gameType}_games`] ?? 0;
      const existingWins = existing[`${gameType}_wins`] ?? 0;
      
      const updates = {
        total_games: (existing.total_games ?? 0) + 1,
        total_bet: (BigInt(existing.total_bet ?? 0) + BigInt(betAmount)).toString(),
        total_won: result === 'win' ? (BigInt(existing.total_won ?? 0) + BigInt(winAmount)).toString() : (existing.total_won ?? 0).toString(),
        total_lost: result === 'loss' ? (BigInt(existing.total_lost ?? 0) + BigInt(betAmount)).toString() : (existing.total_lost ?? 0).toString(),
        [`${gameType}_games`]: existingGames + 1,
        [`${gameType}_wins`]: result === 'win' ? existingWins + 1 : existingWins,
        [`${gameType}_profit`]: (BigInt(existingProfit) + BigInt(profit)).toString(),
        updated_at: new Date().toISOString(),
      };

      if (result === 'win' && winAmount > existing.biggest_win) {
        updates.biggest_win = winAmount;
      }
      if (result === 'loss' && betAmount > existing.biggest_loss) {
        updates.biggest_loss = betAmount;
      }

      await this.supabase.from('casino_stats').update(updates).eq('id', existing.id);
    } else {
      await this.supabase.from('casino_stats').insert({
        guild_id: guildId,
        user_id: userId,
        total_games: 1,
        total_bet: betAmount,
        total_won: result === 'win' ? winAmount : 0,
        total_lost: result === 'loss' ? betAmount : 0,
        [`${gameType}_games`]: 1,
        [`${gameType}_wins`]: result === 'win' ? 1 : 0,
        [`${gameType}_profit`]: profit,
        biggest_win: result === 'win' ? winAmount : 0,
        biggest_loss: result === 'loss' ? betAmount : 0,
      });
    }
  }

  /**
   * Get user casino statistics
   */
  async getUserStats(guildId, userId) {
    const { data, error } = await this.supabase
      .from('casino_stats')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      return null; // No stats yet
    }

    if (error) {
      console.error('Error fetching casino stats:', error);
      return null;
    }

    return data;
  }

  /**
   * Get casino leaderboard
   */
  async getLeaderboard(guildId, limit = 10) {
    const { data, error } = await this.supabase
      .from('casino_stats')
      .select('user_id, username, total_won, total_lost, total_games')
      .eq('guild_id', guildId)
      .order('total_won', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching casino leaderboard:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Build bet amount modal
   */
  buildBetModal(gameType) {
    const modal = new ModalBuilder()
      .setCustomId(`casino_bet_${gameType}`)
      .setTitle(`🎰 ${gameType.charAt(0).toUpperCase() + gameType.slice(1)} - Place Bet`);

    const betInput = new TextInputBuilder()
      .setCustomId('bet_amount')
      .setLabel('Bet Amount')
      .setPlaceholder('Enter amount to bet...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);

    modal.addComponents(new ActionRowBuilder().addComponents(betInput));

    return modal;
  }

  /**
   * Get number color for roulette
   */
  getRouletteNumberColor(number) {
    if (number === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(number) ? 'red' : 'black';
  }

  /**
   * Play roulette game
   */
  async playRoulette(guildId, userId, username, betAmount, betType, betValue) {
    const config = await this.getCasinoConfig(guildId);
    if (!config || !config.roulette_enabled) {
      return { success: false, error: 'Roulette is disabled' };
    }

    if (betAmount < config.min_bet || betAmount > config.max_bet) {
      return {
        success: false,
        error: `Bet must be between ${config.min_bet.toLocaleString()} and ${config.max_bet.toLocaleString()} coins`,
      };
    }

    const userEconomy = await this.economyManager.getUserEconomy(guildId, userId, username);
    if (!userEconomy || BigInt(userEconomy.balance) < BigInt(betAmount)) {
      return { success: false, error: 'Insufficient balance' };
    }

    // Generate winning number (0-36)
    const winningNumber = Math.floor(Math.random() * 37);
    const winningColor = this.getRouletteNumberColor(winningNumber);
    const winningOddEven = winningNumber === 0 ? null : (winningNumber % 2 === 1 ? 'odd' : 'even');
    const winningHighLow = winningNumber === 0 ? null : (winningNumber <= 18 ? 'low' : 'high');

    // Calculate if bet won
    let won = false;
    let payoutMultiplier = 0;

    switch (betType) {
      case 'straight':
        // Bet on specific number (0-36) - 35:1 payout
        won = parseInt(betValue) === winningNumber;
        payoutMultiplier = won ? 35 : 0;
        break;
      case 'color':
        // Bet on red or black - 1:1 payout
        won = betValue === winningColor;
        payoutMultiplier = won ? 1 : 0;
        break;
      case 'odd_even':
        // Bet on odd or even - 1:1 payout
        won = betValue === winningOddEven;
        payoutMultiplier = won ? 1 : 0;
        break;
      case 'high_low':
        // Bet on 1-18 (low) or 19-36 (high) - 1:1 payout
        won = betValue === winningHighLow;
        payoutMultiplier = won ? 1 : 0;
        break;
      case 'dozen':
        // Bet on 1-12, 13-24, or 25-36 - 2:1 payout
        const dozen = parseInt(betValue);
        if (dozen === 1) won = winningNumber >= 1 && winningNumber <= 12;
        else if (dozen === 2) won = winningNumber >= 13 && winningNumber <= 24;
        else if (dozen === 3) won = winningNumber >= 25 && winningNumber <= 36;
        payoutMultiplier = won ? 2 : 0;
        break;
      case 'column':
        // Bet on column (1st, 2nd, or 3rd column) - 2:1 payout
        const column = parseInt(betValue);
        const column1 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
        const column2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
        const column3 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
        if (column === 1) won = column1.includes(winningNumber);
        else if (column === 2) won = column2.includes(winningNumber);
        else if (column === 3) won = column3.includes(winningNumber);
        payoutMultiplier = won ? 2 : 0;
        break;
      default:
        return { success: false, error: 'Invalid bet type' };
    }

    // Calculate win amount
    let winAmount = 0;
    let result = 'loss';
    if (won) {
      winAmount = Math.floor(betAmount * (payoutMultiplier + 1) * (1 - config.house_edge / 100));
      result = 'win';
      const netWin = winAmount - betAmount;
      await this.economyManager.addCoins(
        guildId,
        userId,
        netWin,
        'casino_win',
        `Roulette: ${betType} bet on ${betValue} - Won ${winningNumber}`,
        { game_type: 'roulette', winningNumber, betType, betValue, payoutMultiplier }
      );
    } else {
      await this.economyManager.removeCoins(
        guildId,
        userId,
        betAmount,
        'casino_loss',
        `Roulette: ${betType} bet on ${betValue} - Lost (${winningNumber})`,
        { game_type: 'roulette', winningNumber, betType, betValue }
      );
    }

    // Log game
    await this.logGame(guildId, userId, username, 'roulette', betAmount, winAmount, result, {
      winningNumber,
      betType,
      betValue,
      payoutMultiplier,
    });

    // Update stats
    await this.updateStats(guildId, userId, 'roulette', betAmount, winAmount, result);

    // Generate animated roulette GIF
    let gifBuffer = null;
    if (this.rouletteGenerator) {
      try {
        const gifResult = await this.rouletteGenerator.spin({
          winningNumber,
          betAmount,
          betType,
          playerName: username,
        });
        gifBuffer = gifResult.buffer;
        console.log(`✅ RouletteGenerator: Created GIF buffer of ${gifBuffer.length} bytes`);
      } catch (gifError) {
        console.warn('⚠️ Failed to generate roulette GIF:', gifError.message);
      }
    } else {
      console.warn('⚠️ RouletteGenerator not initialized');
    }

    return {
      success: true,
      result,
      winningNumber,
      winningColor,
      winningOddEven,
      winningHighLow,
      betType,
      betValue,
      betAmount,
      winAmount,
      payoutMultiplier,
      netResult: result === 'win' ? winAmount - betAmount : -betAmount,
      gifBuffer, // Animated roulette GIF
    };
  }
}

module.exports = CasinoManager;

