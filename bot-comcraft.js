/**
 * ================================================================
 * COMCRAFT - Advanced Discord Bot Platform
 * MEE6-like bot for Content Creators
 * ================================================================
 */

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
  MessageFlags
} = require('discord.js');

const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
dotenv.config();

// Import Comcraft modules
const configManager = require('./modules/comcraft/config-manager');
const xpManager = require('./modules/comcraft/leveling/xp-manager');
const autoMod = require('./modules/comcraft/moderation/auto-mod');
const modActions = require('./modules/comcraft/moderation/actions');
const customCommands = require('./modules/comcraft/custom-commands/manager');
const welcomeHandler = require('./modules/comcraft/welcome/handler');
const TwitchMonitor = require('./modules/comcraft/streaming/twitch-monitor');
const TwitchEventSubManager = require('./modules/comcraft/streaming/twitch-eventsub-manager');
const YouTubeMonitor = require('./modules/comcraft/streaming/youtube-monitor');
const DiscordManager = require('./modules/comcraft/discord-manager');
const analyticsTracker = require('./modules/comcraft/analytics-tracker');
const AutoRolesManager = require('./modules/comcraft/autoroles/manager');
const birthdayManager = require('./modules/comcraft/birthdays/manager');
const feedbackQueueManager = require('./modules/comcraft/feedback/queue-manager');
const ticketManager = require('./modules/comcraft/tickets/manager');
const GiveawayManager = require('./modules/comcraft/giveaways/manager');
const FeatureGate = require('./modules/comcraft/feature-gate');
const GameNewsManager = require('./modules/comcraft/game-news/manager');
const UpdateNotifier = require('./modules/comcraft/updates/notifier');
const EventManager = require('./modules/comcraft/events/manager');
const aiService = require('./modules/comcraft/ai');
const memoryStore = require('./modules/comcraft/ai/memory-store');
const aiStore = require('./modules/comcraft/ai/store');
// CustomBotManager disabled - all custom bots now run on Pterodactyl VPS in separate containers
// const customBotManager = require('./modules/comcraft/bot/custom-bot-manager');
const customBotManager = null; // Set to null so all existing checks are skipped
const aiUsageService = require('./modules/comcraft/ai/usage-service');
const { buildKnowledgeContext } = require('./modules/comcraft/ai/prompt-utils.js');
const rankCardGenerator = require('./modules/comcraft/leveling/rank-card-generator');
const createLicenseHelpers = require('./modules/comcraft/bot/license');
const createAiHandlers = require('./modules/comcraft/bot/ai');
const createMessageCreateHandler = require('./modules/comcraft/bot/events/message-create');
const registerAiRoutes = require('./modules/comcraft/bot/routes/ai');
const createTicketHandlers = require('./modules/comcraft/bot/interactions/tickets');
const createFeedbackHandlers = require('./modules/comcraft/bot/interactions/feedback');
const createEventHandlers = require('./modules/comcraft/bot/interactions/events');
const TopGGManager = require('./modules/comcraft/topgg/manager');
const VoteRewardsScheduler = require('./modules/comcraft/vote-rewards/scheduler');
// Music commands removed - now handled by separate music-bot
// const MusicManager = require('./modules/comcraft/music/manager');
// const MusicCommands = require('./modules/comcraft/music/commands');
const VoteKickManager = require('./modules/comcraft/vote-kick/manager');
const VoteKickCommands = require('./modules/comcraft/vote-kick/commands');
const CamOnlyVoiceManager = require('./modules/comcraft/cam-only-voice/manager');
const camOnlyVoiceCommands = require('./modules/comcraft/cam-only-voice/commands');
const CamOnlyVoiceHandlers = require('./modules/comcraft/cam-only-voice/handlers');
const userStatsManager = require('./modules/comcraft/stats/user-stats-manager');
const statsCardGenerator = require('./modules/comcraft/stats/stats-card-generator');
const combatCardGenerator = require('./modules/comcraft/combat/combat-card-generator');
const StockMarketManager = require('./modules/comcraft/economy/stock-market-manager');
// Load auto-reactions manager with error handling
let getAutoReactionsManager;
try {
  const fs = require('fs');
  const path = require('path');
  
  console.log('🔄 [Startup] Loading Auto-Reactions Manager module...');
  console.log('   Current working directory:', process.cwd());
  console.log('   __dirname (bot-comcraft.js):', __dirname);
  
  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, './modules/comcraft/auto-reactions/manager'),
    path.join(process.cwd(), 'modules/comcraft/auto-reactions/manager'),
    path.join(__dirname, 'modules/comcraft/auto-reactions/manager'),
    './modules/comcraft/auto-reactions/manager',
  ];
  
  let modulePath = null;
  for (const testPath of possiblePaths) {
    const fullPath = testPath + '.js';
    if (fs.existsSync(fullPath)) {
      console.log(`   ✅ Found file at: ${fullPath}`);
      modulePath = testPath;
      break;
    } else {
      console.log(`   ❌ Not found: ${fullPath}`);
    }
  }
  
  if (!modulePath) {
    throw new Error('Auto-reactions manager file not found in any expected location');
  }
  
  getAutoReactionsManager = require(modulePath);
  console.log('✅ [Startup] Auto-Reactions Manager module loaded successfully');
  
  // Test if we can get an instance
  if (getAutoReactionsManager) {
    try {
      const testInstance = getAutoReactionsManager();
      if (testInstance) {
        console.log('✅ [Startup] Auto-Reactions Manager instance created');
        if (testInstance.supabase) {
          console.log('✅ [Startup] Auto-Reactions Manager Supabase client initialized');
        } else {
          console.log('⚠️ [Startup] Auto-Reactions Manager Supabase client not initialized (check env vars)');
        }
      }
    } catch (instanceError) {
      console.error('❌ [Startup] Error creating Auto-Reactions Manager instance:', instanceError.message);
    }
  }
} catch (error) {
  console.error('❌ [Startup] Failed to load Auto-Reactions Manager module:', error.message);
  console.error('   Error code:', error.code);
  console.error('   Error path:', error.path);
  if (error.stack) {
    console.error('   Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
  }
  getAutoReactionsManager = null;
  console.log('⚠️ [Startup] Auto-reactions will be disabled');
}
// Load managers with error handling
let EconomyManager, CasinoManager;
try {
  EconomyManager = require('./modules/comcraft/economy/manager');
  console.log('✓ EconomyManager module loaded');
} catch (error) {
  console.error('❌ Failed to load EconomyManager module:', error);
  EconomyManager = null;
}

try {
  CasinoManager = require('./modules/comcraft/casino/manager');
  console.log('✓ CasinoManager module loaded');
} catch (error) {
  console.error('❌ Failed to load CasinoManager module:', error);
  CasinoManager = null;
}

let DuelManager;
try {
  DuelManager = require('./modules/comcraft/economy/duel-manager');
  console.log('✓ DuelManager module loaded');
} catch (error) {
  console.error('❌ Failed to load DuelManager module:', error);
  DuelManager = null;
}

let CombatXPManager;
try {
  CombatXPManager = require('./modules/comcraft/combat/xp-manager');
  console.log('✓ CombatXPManager module loaded');
} catch (error) {
  console.error('❌ Failed to load CombatXPManager module:', error);
  CombatXPManager = null;
}

let ItemManager;
try {
  ItemManager = require('./modules/comcraft/combat/item-manager');
  console.log('✓ ItemManager module loaded');
} catch (error) {
  console.error('❌ Failed to load ItemManager module:', error);
  ItemManager = null;
}

let InventoryManager;
try {
  InventoryManager = require('./modules/comcraft/combat/inventory-manager');
  console.log('✓ InventoryManager module loaded');
} catch (error) {
  console.error('❌ Failed to load InventoryManager module:', error);
  InventoryManager = null;
}

const DISCORD_MESSAGE_LIMIT = 2000;

function chunkMessage(text, size = 1900) {
  if (!text) {
    return [''];
  }

  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > size) {
    let chunk = remaining.slice(0, size);
    const lastBreak = Math.max(chunk.lastIndexOf('\n'), chunk.lastIndexOf('. '), chunk.lastIndexOf(' '));
    if (lastBreak > 200) {
      chunk = chunk.slice(0, lastBreak + 1);
    }
    chunks.push(chunk.trim());
    remaining = remaining.slice(chunk.length).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks.map((chunk) => (chunk.length > DISCORD_MESSAGE_LIMIT ? chunk.slice(0, DISCORD_MESSAGE_LIMIT) : chunk));
}

console.log('🤖 Comcraft Bot Starting...');
console.log(`🧠 AI features ${aiService.config.isAiEnabled() ? 'enabled' : 'disabled'}`);

/**
 * Create a personalized embed for a guild
 * @param {string} guildId 
 * @returns {Promise<EmbedBuilder>} Configured embed with guild's custom branding
 */
async function createPersonalizedEmbed(guildId) {
  const personalization = await configManager.getBotPersonalization(guildId);
  
  const embed = new EmbedBuilder()
    .setColor(personalization.color)
    .setTimestamp()
    .setFooter({ 
      text: personalization.footer,
      iconURL: personalization.avatarURL || undefined
    });
  
  return embed;
}

// Environment check
const requiredEnv = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`❌ Missing required environment variable: ${env}`);
    process.exit(1);
  }
}

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Initialize Feature Gate
const featureGate = new FeatureGate(configManager);
const SUPPORT_TICKETS_FEATURE = 'support_tickets';
const BIRTHDAY_MANAGER_FEATURE = 'birthday_manager';
const FEEDBACK_QUEUE_FEATURE = 'feedback_queue';
const AUTO_ROLES_FEATURE = 'auto_roles';
const EMBED_BUILDER_FEATURE = 'embed_builder';
const GIVEAWAYS_FEATURE = 'giveaways';

const {
  isGuildLicensed,
  respondLicenseDisabled,
  ensureInteractionLicense,
  ensureMessageLicense,
  ensureGuildLicense,
} = createLicenseHelpers(configManager, featureGate);

// Initialize economy manager early (needed for AI handlers)
let economyManager = null;
try {
  const EconomyManager = require('./modules/comcraft/economy/manager');
  if (EconomyManager && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    economyManager = new EconomyManager();
  }
} catch (error) {
  console.warn('Economy Manager not available:', error.message);
}

// Initialize Stock Market Manager
let stockMarketManager = null;
try {
  if (StockMarketManager && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    stockMarketManager = new StockMarketManager();
    global.stockMarketManager = stockMarketManager;
  }
} catch (error) {
  console.warn('Stock Market Manager not available:', error.message);
}

const {
  runGuildAiPrompt,
  handleAskAiCommand,
  maybeHandleAiChatMessage,
} = createAiHandlers({
  aiService,
  aiStore,
  memoryStore,
  aiUsageService,
  featureGate,
  buildKnowledgeContext,
  chunkMessage,
  client,
  xpManager,
  economyManager,
});

const handleMessageCreate = createMessageCreateHandler({
  ensureMessageLicense,
  maybeHandleAiChatMessage,
  analyticsTracker,
  autoMod,
  customCommands,
  configManager,
  xpManager,
  getAutoReactionsManager, // Pass the auto-reactions manager getter
  ticketManager, // Pass ticket manager for transcript logging
  userStatsManager, // Pass user stats manager for tracking
});

const {
  handleTicketCommand,
  handleTicketSetupCommand,
  handleTicketStatsCommand,
  handleTicketPanelCommand,
  handleTicketButton,
  handleTicketModal,
  isTicketButton,
  isTicketModal,
} = createTicketHandlers({ featureGate, ticketManager, supportFeatureKey: SUPPORT_TICKETS_FEATURE });

const {
  handleFeedbackCommand,
  handleFeedbackSubmitButton,
  handleFeedbackSubmitModal,
  handleFeedbackCompleteButton,
  setupFeedbackQueueMessage,
  notifyFeedbackCompletion,
} = createFeedbackHandlers({ client, feedbackQueueManager, configManager });

// Initialize streaming monitors (economyManager already initialized above)
let twitchMonitor;
let twitchEventSubManager;
let youtubeMonitor;
let discordManager;
let autoRolesManager;
let giveawayManager;
let casinoManager;
let duelManager;
let combatXPManager;
let itemManager;
let inventoryManager;

// ================================================================
// BOT READY EVENT
// ================================================================
client.once('ready', async () => {
  console.log(`✅ Comcraft is online as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);

  client.user.setActivity('codecraft-solutions.com | /help', { type: 3 });

  // Emergency Audio Diagnostics
  console.log('\n🔍 === EMERGENCY AUDIO DIAGNOSTICS ===');
  
  // Test 1: FFmpeg capabilities
  console.log('\n1️⃣ Testing FFmpeg codecs...');
  try {
    const { execSync } = require('child_process');
    // Try system FFmpeg first, then static
    let ffmpegPath = 'ffmpeg';
    try {
      execSync('which ffmpeg', { encoding: 'utf8', stdio: 'pipe' });
      console.log('   Using system FFmpeg');
    } catch (e) {
      try {
        ffmpegPath = require('ffmpeg-static');
        console.log('   Using static FFmpeg:', ffmpegPath);
      } catch (e2) {
        throw new Error('No FFmpeg found (system or static)');
      }
    }
    
    const codecs = execSync(`${ffmpegPath} -codecs`, { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    console.log('✅ FFmpeg codecs loaded');
    if (codecs.includes('libopus')) {
      console.log('   ✅ libopus found');
    } else {
      console.log('   ❌ libopus MISSING');
    }
  } catch (e) {
    console.error('❌ FFmpeg -codecs failed:', e.message);
    console.error('   This may indicate FFmpeg is not properly installed');
  }
  
  // Test 2: Network egress to YouTube (test multiple endpoints)
  console.log('\n2️⃣ Testing YouTube connectivity...');
  const https = require('https');
  
  // Test 1: Main YouTube domain (most reliable)
  https.get('https://www.youtube.com', { timeout: 5000 }, (res) => {
    console.log('✅ Can reach YouTube (www.youtube.com)');
    console.log(`   Status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('❌ Cannot reach www.youtube.com:', err.message);
  });
  
  // Test 2: YouTube API endpoint
  setTimeout(() => {
    https.get('https://youtube.com', { timeout: 5000 }, (res) => {
      console.log('✅ Can reach YouTube (youtube.com)');
    }).on('error', (err) => {
      console.warn('⚠️ Cannot reach youtube.com:', err.message);
      console.warn('   This may indicate DNS/network issues on Railway');
      console.warn('   Note: youtubei extractor may still work via different routes');
    });
  }, 1000);
  
  // Test 3: FFmpeg can actually download (async, don't block startup)
  console.log('\n3️⃣ Testing FFmpeg HTTP downloading...');
  setTimeout(() => {
    try {
      const { spawn } = require('child_process');
      
      // Get FFmpeg path (system or static)
      let ffmpegPath = 'ffmpeg';
      try {
        const { execSync } = require('child_process');
        execSync('which ffmpeg', { encoding: 'utf8', stdio: 'pipe' });
      } catch (e) {
        try {
          ffmpegPath = require('ffmpeg-static');
          console.log('   Using static FFmpeg for test');
        } catch (e2) {
          console.error('❌ No FFmpeg found for test');
          return;
        }
      }
      
      const ffmpegTest = spawn(ffmpegPath, [
        '-i', 'https://www.youtube.com/watch?v=kffacxfA7G4',
        '-t', '1',
        '-f', 'null',
        '-'
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      
      let stderr = '';
      ffmpegTest.stderr.on('data', (data) => stderr += data.toString());
      
      ffmpegTest.on('close', (code) => {
        if (code === 0 || stderr.includes('Duration:') || stderr.includes('Stream #')) {
          console.log('✅ FFmpeg can download from YouTube');
        } else {
          console.error('❌ FFmpeg download failed');
          console.error('   Error:', stderr.substring(0, 300));
          console.error('   This may indicate network/CDN blocking');
        }
      });
      
      setTimeout(() => {
        if (!ffmpegTest.killed) {
          ffmpegTest.kill();
          console.log('⚠️ FFmpeg test timed out (this is normal for slow connections)');
        }
      }, 15000); // Timeout after 15s
    } catch (e) {
      console.error('❌ FFmpeg spawn failed:', e.message);
    }
  }, 2000); // Run after 2 seconds to not block startup
  
  console.log('🔍 === END DIAGNOSTICS ===\n');

  // Music Manager removed - now handled by separate music-bot
  // Music commands are no longer available in main bot
  
  // Initialize Vote Kick Manager
  try {
    const voteKickManager = new VoteKickManager();
    const voteKickCommands = new VoteKickCommands(voteKickManager);
    global.voteKickManager = voteKickManager;
    global.voteKickCommands = voteKickCommands;
    
    // Clean up expired sessions every 5 minutes
    setInterval(() => {
      voteKickManager.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error('❌ Failed to create Vote Kick Manager:', error.message);
    global.voteKickManager = null;
    global.voteKickCommands = null;
  }

  // Initialize Vote Kick (always available)
  const voteKickManager = new VoteKickManager();
  const voteKickCommands = new VoteKickCommands(voteKickManager);
  global.voteKickManager = voteKickManager;
  global.voteKickCommands = voteKickCommands;
  
  // Clean up expired sessions every 5 minutes
  setInterval(() => {
    voteKickManager.cleanupExpiredSessions();
  }, 5 * 60 * 1000);

  // Initialize Cam-Only Voice Manager
  let camOnlyVoiceManager = null;
  let camOnlyVoiceHandlers = null;
  try {
    camOnlyVoiceManager = new CamOnlyVoiceManager(client);
    camOnlyVoiceHandlers = new CamOnlyVoiceHandlers(camOnlyVoiceManager);
    await camOnlyVoiceManager.initialize();
    global.camOnlyVoiceManager = camOnlyVoiceManager;
    global.camOnlyVoiceHandlers = camOnlyVoiceHandlers;
    console.log('✅ Cam-Only Voice Manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Cam-Only Voice Manager:', error.message);
    global.camOnlyVoiceManager = null;
    global.camOnlyVoiceHandlers = null;
  }

  // Register slash commands (will include music commands if initialized)
  await registerCommands(client);

  // Ensure all guilds are in database
  console.log('🔄 Syncing all guilds to database...');
  let syncedCount = 0;
  let errorCount = 0;
  
  for (const guild of client.guilds.cache.values()) {
    try {
      let owner;
      try {
        owner = await guild.fetchOwner();
      } catch (error) {
        console.error(`❌ Error fetching owner for guild ${guild.id}:`, error);
        // Try to use guild.ownerId as fallback
        if (guild.ownerId) {
          owner = { id: guild.ownerId };
        } else {
          console.error(`⚠️ Skipping guild ${guild.id} - could not determine owner`);
          errorCount++;
          continue;
        }
      }
      
      const guildConfig = await configManager.ensureGuild(guild, owner.id);
      if (guildConfig) {
        syncedCount++;
        console.log(`✅ Synced guild: ${guild.name} (${guild.id})`);
      } else {
        console.error(`❌ Failed to sync guild: ${guild.name} (${guild.id})`);
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ Error syncing guild ${guild.id}:`, error);
      errorCount++;
    }
  }
  
  console.log(`✅ Guild sync complete: ${syncedCount} synced, ${errorCount} errors`);

  // Initialize Discord Manager
  discordManager = new DiscordManager(client);
  console.log('🎨 Discord Manager initialized');

  // Custom Bot Manager DISABLED - all custom bots now run on Pterodactyl VPS
  // This saves resources on the main bot's server
  // try {
  //   await customBotManager.initialize();
  //   console.log('🤖 Custom Bot Manager initialized');
  //   customBotManager.startPolling(60000);
  //   customBotManager.startStatusLogging(300000);
  // } catch (error) {
  //   console.error('❌ Error initializing Custom Bot Manager:', error);
  // }
  console.log('ℹ️  Custom Bot Manager disabled - bots run on Pterodactyl VPS');

  // Initialize Auto-Roles Manager
  autoRolesManager = new AutoRolesManager(client);
  console.log('🎭 Auto-Roles Manager initialized');

  // Start streaming monitors
  if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    // Main bot monitors ALL guilds (guildId = null) and uses customBotManager for notifications
    twitchMonitor = new TwitchMonitor(client, customBotManager, null);
    twitchMonitor.startMonitoring();
    
    // Initialize EventSub manager for subscriber notifications
    twitchEventSubManager = new TwitchEventSubManager(twitchMonitor);
    console.log('✅ Twitch EventSub manager initialized');
  }

  if (process.env.YOUTUBE_API_KEY) {
    youtubeMonitor = new YouTubeMonitor(client);
    youtubeMonitor.startMonitoring();
  }

  birthdayManager.startScheduler(client);
  console.log('🎂 Birthday manager initialized');

  giveawayManager = new GiveawayManager(client);
  giveawayManager.startScheduler();
  console.log('🎉 Giveaway Manager initialized');

  // Initialize Scheduled Messages Manager
  try {
    const ScheduledMessagesManager = require('./modules/comcraft/scheduled-messages/manager');
    const scheduledMessagesManager = new ScheduledMessagesManager(client);
    scheduledMessagesManager.startScheduler();
    console.log('⏰ Scheduled Messages Manager initialized');
    global.scheduledMessagesManager = scheduledMessagesManager;
  } catch (error) {
    console.error('❌ Failed to initialize Scheduled Messages Manager:', error.message);
  }

  // Initialize Game News Manager
  try {
    const gameNewsManager = new GameNewsManager(client);
    gameNewsManager.startScheduler();
    console.log('🎮 Game News Manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Game News Manager:', error.message);
  }

  // Initialize Update Notifier
  try {
    const updateNotifier = new UpdateNotifier(client);
    updateNotifier.startScheduler(60); // Check every 60 minutes
    console.log('📢 Update Notifier initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Update Notifier:', error.message);
  }

  // Music Manager is already initialized above (before command registration)

  // Initialize Event Manager
  try {
    const eventManager = new EventManager(client);
    eventManager.startScheduler();
    console.log('📅 Event Manager initialized');
    // Store globally for interaction handlers
    global.eventManager = eventManager;
  } catch (error) {
    console.error('❌ Failed to initialize Event Manager:', error.message);
  }

  // Initialize Top.gg Manager
  let topggManager;
  try {
    topggManager = new TopGGManager(client, customBotManager);
    await topggManager.initialize();
    global.topggManager = topggManager;
  } catch (error) {
    console.error('❌ Failed to initialize Top.gg Manager:', error.message);
  }

  // Initialize Stock Market Price Updater
  if (stockMarketManager) {
    try {
      // Update prices every 15 minutes for all guilds
      setInterval(async () => {
        try {
          // Get all guild IDs that have stocks
          const { data: stocks } = await stockMarketManager.supabase
            .from('stock_market_stocks')
            .select('guild_id')
            .eq('status', 'active');

          if (stocks && stocks.length > 0) {
            const uniqueGuilds = [...new Set(stocks.map(s => s.guild_id))];
            for (const guildId of uniqueGuilds) {
              const result = await stockMarketManager.updateStockPrices(guildId);
              
              // Send notifications for triggered price alerts
              if (result.success && result.updates) {
                for (const update of result.updates) {
                  // Get triggered alerts for this stock
                  const stock = await stockMarketManager.getStock(guildId, update.symbol);
                  if (stock) {
                    const alertsResult = await stockMarketManager.checkPriceAlerts(guildId, stock.id, update.new_price);
                    if (alertsResult.triggered && alertsResult.triggered.length > 0) {
                      // Send DM notifications to users
                      for (const alert of alertsResult.triggered) {
                        try {
                          const user = await client.users.fetch(alert.user_id);
                          if (user) {
                            const alertEmbed = new EmbedBuilder()
                              .setColor('#FFD700')
                              .setTitle('🔔 Price Alert Triggered!')
                              .setDescription(`**${stock.symbol}** has reached your target price!`)
                              .addFields(
                                {
                                  name: '💰 Current Price',
                                  value: `${update.new_price.toFixed(2)} coins`,
                                  inline: true,
                                },
                                {
                                  name: '🎯 Target Price',
                                  value: `${parseFloat(alert.target_price).toFixed(2)} coins`,
                                  inline: true,
                                },
                                {
                                  name: '📊 Change',
                                  value: `${update.change_percent >= 0 ? '+' : ''}${update.change_percent.toFixed(2)}%`,
                                  inline: true,
                                }
                              )
                              .setTimestamp();
                            
                            await user.send({ embeds: [alertEmbed] });
                          }
                        } catch (error) {
                          console.error(`Failed to send price alert to user ${alert.user_id}:`, error);
                        }
                      }
                    }
                  }
                }
              }
            }
            console.log(`📈 [Stock Market] Updated prices for ${uniqueGuilds.length} guild(s)`);
          }
        } catch (error) {
          console.error('❌ [Stock Market] Error updating prices:', error);
        }
      }, 15 * 60 * 1000); // 15 minutes
      
      console.log('📈 Stock Market Price Updater initialized (updates every 15 minutes)');
    } catch (error) {
      console.error('❌ Failed to initialize Stock Market Price Updater:', error.message);
    }
  }

  // Initialize Vote Rewards Scheduler
  try {
    const voteRewardsScheduler = new VoteRewardsScheduler();
    voteRewardsScheduler.start();
    global.voteRewardsScheduler = voteRewardsScheduler;
    console.log('🎁 Vote Rewards Scheduler initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Vote Rewards Scheduler:', error.message);
  }

  // Initialize User Stats Manager
  try {
    global.userStatsManager = userStatsManager;
    console.log('📊 User Stats Manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize User Stats Manager:', error.message);
    global.userStatsManager = null;
  }

  // Economy Manager is already initialized above (before AI handlers)
  if (economyManager) {
    console.log('💰 Economy Manager initialized');
  } else {
    console.warn('⚠️ Economy Manager not available');
  }

  // Initialize Combat XP Manager first (needed by DuelManager)
  try {
    if (!CombatXPManager) {
      throw new Error('CombatXPManager module not loaded');
    }
    
    combatXPManager = new CombatXPManager();
    console.log('⚔️ Combat XP Manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Combat XP Manager:', error);
    console.error('Error details:', error.message);
    combatXPManager = null;
  }

  // Initialize Item Manager
  try {
    if (!ItemManager) {
      throw new Error('ItemManager module not loaded');
    }
    
    itemManager = new ItemManager();
    console.log('🛒 Item Manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Item Manager:', error);
    console.error('Error details:', error.message);
    itemManager = null;
  }

  // Initialize Inventory Manager
  try {
    if (!InventoryManager) {
      throw new Error('InventoryManager module not loaded');
    }
    
    inventoryManager = new InventoryManager();
    console.log('🎒 Inventory Manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Inventory Manager:', error);
    console.error('Error details:', error.message);
    inventoryManager = null;
  }

  try {
    if (!DuelManager) {
      throw new Error('DuelManager module not loaded');
    }
    
    duelManager = new DuelManager(combatXPManager, inventoryManager);
    console.log('⚔️ Duel Manager initialized');
    
    // Verify that duelManager has the expected methods
    if (typeof duelManager.createChallenge !== 'function') {
      console.error('❌ DuelManager.createChallenge is not a function!');
      console.error('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(duelManager)));
      duelManager = null;
    } else {
      console.log('✅ DuelManager methods verified');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Duel Manager:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    duelManager = null;
  }

  try {
    if (!CasinoManager) {
      throw new Error('CasinoManager module not loaded');
    }
    
    // Check if required environment variables are set
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    }
    
    casinoManager = new CasinoManager();
    console.log('🎰 Casino Manager initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Casino Manager:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    casinoManager = null;
  }

  // Start Internal API Server
  const API_PORT = process.env.PORT || process.env.DISCORD_API_PORT || process.env.API_PORT || 3002;
  try {
    app.listen(API_PORT, '0.0.0.0', () => {
      console.log(`✅ Internal API server listening on port ${API_PORT}`);
      console.log(`📡 Health check: http://localhost:${API_PORT}/health`);
    });
  } catch (error) {
    console.error(`❌ Failed to start API server on port ${API_PORT}:`, error);
  }

  console.log('🚀 All systems operational!');
});

// ================================================================
// GUILD CREATE (Bot joins server)
// ================================================================
client.on('guildCreate', async (guild) => {
  console.log(`✅ Joined new guild: ${guild.name} (${guild.id})`);

  try {
    // Fetch owner with retry
    let owner;
    try {
      owner = await guild.fetchOwner();
      console.log(`👤 Guild owner: ${owner.user.tag} (${owner.id})`);
    } catch (error) {
      console.error(`❌ Error fetching guild owner for ${guild.id}:`, error);
      // Try to get owner from guild.ownerId if available
      if (guild.ownerId) {
        console.log(`⚠️ Using guild.ownerId as fallback: ${guild.ownerId}`);
        owner = { id: guild.ownerId };
      } else {
        throw new Error('Could not fetch guild owner');
      }
    }

    // Ensure guild is in database with retry
    try {
      const guildConfig = await configManager.ensureGuild(guild, owner.id);
      if (guildConfig) {
        console.log(`✅ Guild ${guild.id} successfully added to database`);
      } else {
        console.error(`❌ Failed to add guild ${guild.id} to database`);
      }
    } catch (error) {
      console.error(`❌ Error ensuring guild ${guild.id} in database:`, error);
      // Retry once after 2 seconds
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const guildConfig = await configManager.ensureGuild(guild, owner.id);
        if (guildConfig) {
          console.log(`✅ Guild ${guild.id} successfully added to database on retry`);
        } else {
          console.error(`❌ Failed to add guild ${guild.id} to database on retry`);
        }
      } catch (retryError) {
        console.error(`❌ Error ensuring guild ${guild.id} in database on retry:`, retryError);
      }
    }

    // Send welcome message to owner
    try {
      if (owner && owner.send) {
        const dashboardUrl = `${(process.env.WEBAPP_URL || 'https://codecraft-solutions.com')}/comcraft/dashboard/${guild.id}`;
        
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('🎉 Welcome to ComCraft!')
          .setDescription(
            `Thank you for adding **ComCraft** to **${guild.name}**!\n\n` +
            `ComCraft is a premium Discord bot designed specifically for content creators and community builders. ` +
            `You now have **30 days of free Enterprise tier access** to explore all features!`
          )
          .addFields(
            {
              name: '🚀 Getting Started',
              value: 
                `**1.** Visit your [Dashboard](${dashboardUrl})\n` +
                `**2.** Customize your bot settings\n` +
                `**3.** Explore all features during your trial`,
              inline: false
            },
            {
              name: '✨ Premium Features',
              value: 
                `• **Leveling System** - XP, ranks & rewards\n` +
                `• **AI Assistant** - ChatGPT & image generation\n` +
                `• **Stream Alerts** - Twitch & YouTube\n` +
                `• **Moderation** - Auto-mod & logging\n` +
                `• **Tickets** - Professional support system\n` +
                `• **Analytics** - Detailed server insights`,
              inline: false
            },
            {
              name: '🎮 Quick Commands',
              value: 
                `\`/help\` - View all commands\n` +
                `\`/setup\` - Quick setup wizard\n` +
                `\`/dashboard\` - Get your dashboard link`,
              inline: false
            },
            {
              name: '🔗 Important Links',
              value: 
                `[🌐 Web Dashboard](${dashboardUrl})\n` +
                `[📋 Terms of Service](https://codecraft-solutions.com/comcraft/terms)\n` +
                `[🔒 Privacy Policy](https://codecraft-solutions.com/comcraft/privacy)\n` +
                `[💬 Support Server](https://discord.gg/vywm9GDNwc)`,
              inline: false
            },
            {
              name: '💎 Trial Information',
              value: 
                `You have **30 days** to try all Enterprise features for free!\n` +
                `After the trial, choose a plan that fits your needs or continue with the free tier.`,
              inline: false
            }
          )
          .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
          .setFooter({ 
            text: 'ComCraft • Professional Discord Bot for Creators',
            iconURL: client.user.displayAvatarURL({ size: 64 })
          })
          .setTimestamp();

        await owner.send({ embeds: [embed] });
        console.log(`📧 Welcome message sent to owner ${owner.user.tag} (${owner.id})`);
      }
    } catch (e) {
      console.log(`⚠️ Could not send welcome DM to owner ${owner.id}:`, e.message);
    }

    // Send notification to admin log channel
    try {
      const logChannelId = process.env.GUILD_JOIN_LOG_CHANNEL_ID;
      if (logChannelId) {
        const logChannel = await client.channels.fetch(logChannelId);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🎉 New Server Added!')
            .setDescription(`ComCraft has been added to a new server!`)
            .addFields(
              {
                name: '🏰 Server Information',
                value: 
                  `**Name:** ${guild.name}\n` +
                  `**ID:** \`${guild.id}\`\n` +
                  `**Members:** ${guild.memberCount}\n` +
                  `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
                inline: true
              },
              {
                name: '👤 Server Owner',
                value: 
                  `**User:** ${owner.user ? owner.user.tag : 'Unknown'}\n` +
                  `**ID:** \`${owner.id}\`\n` +
                  `**Account Created:** ${owner.user ? `<t:${Math.floor(owner.user.createdTimestamp / 1000)}:R>` : 'Unknown'}`,
                inline: true
              },
              {
                name: '🔗 Quick Actions',
                value: 
                  `[View Dashboard](${process.env.WEBAPP_URL || 'https://codecraft-solutions.com'}/comcraft/dashboard/${guild.id})\n` +
                  `[Admin Panel](${process.env.WEBAPP_URL || 'https://codecraft-solutions.com'}/admin)`,
                inline: false
              }
            )
            .setThumbnail(guild.iconURL({ size: 256 }) || client.user.displayAvatarURL({ size: 256 }))
            .setFooter({ text: `Total Servers: ${client.guilds.cache.size}` })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
          console.log(`📊 Join notification sent to log channel`);
        }
      }
    } catch (logError) {
      console.log(`⚠️ Could not send to log channel:`, logError.message);
    }
  } catch (error) {
    console.error(`❌ Critical error in guildCreate event for ${guild.id}:`, error);
  }
});

// ================================================================
// GUILD DELETE (Bot removed from server)
// ================================================================
client.on('guildDelete', async (guild) => {
  console.log(`❌ Removed from guild: ${guild.name} (${guild.id})`);

  try {
    // Send notification to admin log channel
    const logChannelId = process.env.GUILD_JOIN_LOG_CHANNEL_ID;
    if (logChannelId) {
      const logChannel = await client.channels.fetch(logChannelId);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Server Removed')
          .setDescription(`ComCraft has been removed from a server.`)
          .addFields(
            {
              name: '🏰 Server Information',
              value: 
                `**Name:** ${guild.name}\n` +
                `**ID:** \`${guild.id}\`\n` +
                `**Members:** ${guild.memberCount || 'Unknown'}`,
              inline: true
            },
            {
              name: '📊 Statistics',
              value: 
                `**Remaining Servers:** ${client.guilds.cache.size}\n` +
                `**Removed:** <t:${Math.floor(Date.now() / 1000)}:R>`,
              inline: true
            }
          )
          .setThumbnail(guild.iconURL({ size: 256 }) || client.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: `Total Servers: ${client.guilds.cache.size}` })
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
        console.log(`📊 Remove notification sent to log channel`);
      }
    }

    // Note: Guild data remains in database for potential re-adds
    // You can add cleanup logic here if needed
  } catch (error) {
    console.error(`❌ Error in guildDelete event for ${guild.id}:`, error);
  }
});

// ================================================================
// MEMBER JOIN
// ================================================================
client.on('guildMemberAdd', async (member) => {
  if (!(await ensureGuildLicense(member.guild.id))) return;
  
  // Check for raid
  const config = await configManager.getModerationConfig(member.guild.id);
  if (config) {
    const isRaid = await autoMod.checkRaid(member.guild, config);
    if (isRaid) {
      await autoMod.handleRaid(member.guild, config);
      
      // Optionally kick the new member if raid mode is active
      if (config.raid_kick_new_members) {
        try {
          await member.kick('Anti-raid protection: suspicious join pattern');
        } catch (error) {
          console.error('Error kicking potential raid member:', error);
        }
      }
    }
  }
  
  await welcomeHandler.handleMemberJoin(member);
  await analyticsTracker.trackMemberJoin(member);
});

// ================================================================
// MEMBER LEAVE
// ================================================================
client.on('guildMemberRemove', async (member) => {
  if (!(await ensureGuildLicense(member.guild.id))) return;
  await welcomeHandler.handleMemberLeave(member);
  await analyticsTracker.trackMemberLeave(member);
});

// ================================================================
// VOICE STATE UPDATE (Cam-Only Voice + Stats Tracking)
// ================================================================
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    // Cam-only voice handling
    if (global.camOnlyVoiceManager) {
      await global.camOnlyVoiceManager.handleVoiceStateUpdate(oldState, newState);
    }

    // User stats tracking
    if (global.userStatsManager) {
      const guildId = newState.guild?.id || oldState.guild?.id;
      const userId = newState.id || oldState.id;

      if (!guildId || !userId) return;

      // User joined a voice channel
      if (!oldState.channelId && newState.channelId) {
        const channel = newState.channel;
        if (channel && channel.type === 2) { // Voice channel
          await global.userStatsManager.trackVoiceJoin(
            guildId,
            userId,
            channel.id,
            channel.name
          );
        }
      }

      // User left a voice channel
      if (oldState.channelId && !newState.channelId) {
        await global.userStatsManager.trackVoiceLeave(guildId, userId);
      }

      // User switched channels
      if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        // End old session
        await global.userStatsManager.trackVoiceLeave(guildId, userId);
        
        // Start new session
        const channel = newState.channel;
        if (channel && channel.type === 2) { // Voice channel
          await global.userStatsManager.trackVoiceJoin(
            guildId,
            userId,
            channel.id,
            channel.name
          );
        }
      }
    }
  } catch (error) {
    console.error('❌ [Voice State Update] Error:', error);
  }
});

// ================================================================
// MESSAGE CREATE (XP, Auto-mod, Custom commands)
// ================================================================
client.on('messageCreate', handleMessageCreate);

// ================================================================
// INTERACTIONS (Commands, Buttons, Select Menus)
// ================================================================
client.on('interactionCreate', async (interaction) => {
  // Handle casino interactions BEFORE license check to prevent timeout
  // For coinflip buttons that need defer, defer IMMEDIATELY
  if (interaction.isButton()) {
    const customId = interaction.customId;
    
    // Coinflip buttons that need immediate defer (all except custom bet modal)
    if (customId.startsWith('casino_coinflip_') && 
        !customId.includes('_bet_custom_')) {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      } catch (error) {
        // Interaction already expired, skip
        return;
      }
    }
    
    // Now handle the casino button
    if (customId.startsWith('casino_')) {
      await handleCasinoButton(interaction, featureGate);
      return;
    }
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith('casino_bet_')) {
    await handleCasinoBetModal(interaction);
    return;
  }

  const allowedCommands = ['help'];
  if (!(await ensureInteractionLicense(interaction, { allowedCommands }))) {
    return;
  }

  if (interaction.isButton()) {
    if (isTicketButton(interaction.customId)) {
      await handleTicketButton(interaction);
      return;
    }

    // Handle vote kick buttons
    if (interaction.customId && interaction.customId.startsWith('votekick_vote_')) {
      if (global.voteKickCommands) {
        await global.voteKickCommands.handleVoteButton(interaction);
      } else {
        await interaction.reply({ content: '❌ Vote kick system not initialized', ephemeral: true });
      }
      return;
    }

    if (interaction.customId === 'feedback_submit') {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guildId || interaction.guild?.id,
        FEEDBACK_QUEUE_FEATURE,
        'Premium'
      );
      if (!allowed) {
        return;
      }
      return await handleFeedbackSubmitButton(interaction);
    }

    if (interaction.customId.startsWith('feedback_mark_complete_')) {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guildId || interaction.guild?.id,
        FEEDBACK_QUEUE_FEATURE,
        'Premium'
      );
      if (!allowed) {
        return;
      }
      const submissionId = interaction.customId.replace('feedback_mark_complete_', '');
      return await handleFeedbackCompleteButton(interaction, submissionId);
    }

    if (interaction.customId.startsWith('giveaway_join_')) {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guildId || interaction.guild?.id,
        GIVEAWAYS_FEATURE,
        'Premium'
      );
      if (!allowed) {
        return;
      }

      const giveawayId = interaction.customId.replace('giveaway_join_', '');
      const result = await giveawayManager.toggleEntry(giveawayId, interaction.member);
      const responseMessage = result.message || (result.joined ? 'You joined this giveaway!' : 'Your entry has been removed.');

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: responseMessage, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: responseMessage, ephemeral: true }).catch(() => {});
      }
      return;
    }

      // Shop buy button handlers
      if (interaction.customId.startsWith('shop_buy_')) {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) return;
        await handleShopBuyButton(interaction);
        return;
      }

      // Duel button handlers
      if (interaction.customId.startsWith('duel_accept_') || interaction.customId.startsWith('duel_decline_')) {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) return;
        await handleDuelButton(interaction);
        return;
      }

    // Casino buttons are handled BEFORE license check (at the top of interactionCreate)
    // to prevent timeout issues

    // Event RSVP button handlers
    if (interaction.customId.startsWith('event_rsvp_')) {
      if (global.eventManager) {
        const eventHandlers = createEventHandlers({ 
          client, 
          featureGate, 
          eventManager: global.eventManager 
        });
        const handled = await eventHandlers.handleRSVPInteraction(interaction);
        if (handled) return;
      }
    }

    // Handle verification buttons (remove unverified role)
    if (interaction.customId === 'verify' || interaction.customId.startsWith('verify_')) {
      await handleVerificationButton(interaction);
      return;
    }

    // Handle duel challenge button from embed builder
    if (interaction.customId === 'duel_challenge' || interaction.customId.startsWith('duel_challenge_')) {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guild?.id,
        'pvp_duels',
        'Premium'
      );
      if (!allowed) return;
      
      await handleDuelChallengeButton(interaction);
      return;
    }

    return await autoRolesManager.handleButtonInteraction(interaction);
  }

  if (interaction.isModalSubmit()) {
    if (isTicketModal(interaction.customId)) {
      await handleTicketModal(interaction);
      return;
    }
    if (interaction.customId === 'feedback_submit_modal') {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guildId || interaction.guild?.id,
        FEEDBACK_QUEUE_FEATURE,
        'Premium'
      );
      if (!allowed) {
        return;
      }
      return await handleFeedbackSubmitModal(interaction);
    }

    // Handle duel challenge modal from embed builder
    if (interaction.customId === 'duel_challenge_modal') {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guild?.id,
        'pvp_duels',
        'Premium'
      );
      if (!allowed) return;
      
      await handleDuelChallengeModal(interaction);
      return;
    }

    // Casino bet modals are handled BEFORE license check (at the top of interactionCreate)
  }

  if (interaction.isStringSelectMenu()) {
    // Handle shop item selection
    if (interaction.customId.startsWith('shop_select_')) {
      return await handleShopItemSelect(interaction);
    }
    
    // Handle equip item selection
    if (interaction.customId.startsWith('equip_select_')) {
      return await handleEquipItemSelect(interaction);
    }
    
    return await autoRolesManager.handleSelectMenuInteraction(interaction);
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Track command usage for analytics
  await analyticsTracker.trackCommand(interaction, commandName);

  try {
    switch (commandName) {
      // ============ LEVELING COMMANDS ============
      case 'stats':
        await handleStatsCommand(interaction);
        break;

      case 'leaderboard':
        await handleLeaderboardCommand(interaction);
        break;

      case 'setxp':
        await handleSetXPCommand(interaction);
        break;

      // ============ MODERATION COMMANDS ============
      case 'warn':
        await handleWarnCommand(interaction);
        break;

      case 'mute':
        await handleMuteCommand(interaction);
        break;

      case 'unmute':
        await handleUnmuteCommand(interaction);
        break;

      case 'kick':
        await handleKickCommand(interaction);
        break;

      case 'ban':
        await handleBanCommand(interaction);
        break;

      case 'case':
        await handleCaseCommand(interaction);
        break;

      // ============ CUSTOM COMMANDS ============
      case 'customcommand':
        await handleCustomCommandCommand(interaction);
        break;

      case 'birthday': {
        const birthdayAllowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          BIRTHDAY_MANAGER_FEATURE,
          'Basic'
        );
        if (!birthdayAllowed) break;
        await handleBirthdayCommand(interaction);
        break;
      }

      case 'birthdayconfig': {
        const birthdayConfigAllowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          BIRTHDAY_MANAGER_FEATURE,
          'Basic'
        );
        if (!birthdayConfigAllowed) break;
        await handleBirthdayConfigCommand(interaction);
        break;
      }

      case 'feedback':
        await handleFeedbackCommand(interaction);
        break;

      case 'giveaway':
        await handleGiveawayCommand(interaction);
        break;

      case 'askai':
        await handleAskAiCommand(interaction);
        break;

      // ============ TICKET SYSTEM ============
      case 'ticket': {
        const allowed = await featureGate.checkFeature(interaction.guild.id, SUPPORT_TICKETS_FEATURE);
        if (!allowed) {
          const embed = featureGate.createUpgradeEmbed('Support Tickets', 'Basic');
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
          return;
        }

        await interaction.deferReply({ ephemeral: true });
        await handleTicketCommand(interaction);
        break;
      }

      case 'ticket-setup': {
        const allowed = await featureGate.checkFeature(interaction.guild.id, SUPPORT_TICKETS_FEATURE);
        if (!allowed) {
          const embed = featureGate.createUpgradeEmbed('Support Tickets', 'Basic');
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
          return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: '❌ You do not have permission for this command.',
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });
        await handleTicketSetupCommand(interaction);
        break;
      }

      case 'ticket-stats': {
        const allowed = await featureGate.checkFeature(interaction.guild.id, SUPPORT_TICKETS_FEATURE);
        if (!allowed) {
          const embed = featureGate.createUpgradeEmbed('Support Tickets', 'Basic');
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
          return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({
            content: '❌ You do not have permission for this command.',
            ephemeral: true
          });
        }

        await interaction.deferReply({ ephemeral: true });
        await handleTicketStatsCommand(interaction);
        break;
      }

      case 'ticket-panel': {
        const allowed = await featureGate.checkFeature(interaction.guild.id, SUPPORT_TICKETS_FEATURE);
        if (!allowed) {
          const embed = featureGate.createUpgradeEmbed('Support Tickets', 'Basic');
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
          return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({
            content: '❌ You do not have permission for this command.',
            ephemeral: true
          });
        }

        await handleTicketPanelCommand(interaction);
        break;
      }

      // ============ CUSTOM COMMANDS ============
      case 'customcommand':
        await handleCustomCommandCommand(interaction);
        break;

      case 'birthday': {
        const birthdayAllowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          BIRTHDAY_MANAGER_FEATURE,
          'Basic'
        );
        if (!birthdayAllowed) break;
        await handleBirthdayCommand(interaction);
        break;
      }

      case 'birthdayconfig': {
        const birthdayConfigAllowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          BIRTHDAY_MANAGER_FEATURE,
          'Basic'
        );
        if (!birthdayConfigAllowed) break;
        await handleBirthdayConfigCommand(interaction);
        break;
      }

      // ============ FEEDBACK COMMANDS ============
      case 'feedback':
        await handleFeedbackCommand(interaction);
        break;

      // ============ GIVEAWAYS COMMANDS ============
      case 'giveaway':
        await handleGiveawayCommand(interaction);
        break;

      // ============ ECONOMY COMMANDS ============
      case 'balance': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleBalanceCommand(interaction);
        break;
      }

      case 'daily': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleDailyCommand(interaction);
        break;
      }

      case 'pay': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handlePayCommand(interaction);
        break;
      }

      case 'convert': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleConvertCommand(interaction);
        break;
      }

      case 'challenge': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) break;
        await handleChallengeCommand(interaction);
        break;
      }

      // ============ COMBAT XP COMMANDS ============
      case 'combatrank': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) break;
        await handleCombatRankCommand(interaction);
        break;
      }

      case 'combatleaderboard': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) break;
        await handleCombatLeaderboardCommand(interaction);
        break;
      }

      // ============ SHOP COMMANDS ============
      case 'shop': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) break;
        await handleShopCommand(interaction);
        break;
      }

      case 'buy': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) break;
        await handleBuyCommand(interaction);
        break;
      }

      case 'sell': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) break;
        await handleSellCommand(interaction);
        break;
      }

      case 'inventory': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) break;
        await handleInventoryCommand(interaction);
        break;
      }

      case 'equip': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) break;
        await handleEquipCommand(interaction);
        break;
      }

      case 'unequip': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) break;
        await handleUnequipCommand(interaction);
        break;
      }

      // ============ CASINO COMMANDS ============
      case 'casino': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'casino',
          'Premium'
        );
        if (!allowed) break;
        await handleCasinoCommand(interaction);
        break;
      }

      // ============ STOCK MARKET COMMANDS ============
      case 'stocks': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStocksCommand(interaction);
        break;
      }

      case 'stock': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockCommand(interaction);
        break;
      }

      case 'stockbuy': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockBuyCommand(interaction);
        break;
      }

      case 'stocksell': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockSellCommand(interaction);
        break;
      }

      case 'portfolio': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handlePortfolioCommand(interaction);
        break;
      }

      case 'stockhistory': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockHistoryCommand(interaction);
        break;
      }

      case 'stockleaderboard': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockLeaderboardCommand(interaction);
        break;
      }

      // ============ STOCK MARKET COMMANDS ============
      case 'stocks': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStocksCommand(interaction);
        break;
      }

      case 'stock': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockCommand(interaction);
        break;
      }

      case 'stockbuy': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockBuyCommand(interaction);
        break;
      }

      case 'stocksell': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockSellCommand(interaction);
        break;
      }

      case 'portfolio': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handlePortfolioCommand(interaction);
        break;
      }

      case 'stockhistory': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockHistoryCommand(interaction);
        break;
      }

      case 'stockleaderboard': {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'economy',
          'Premium'
        );
        if (!allowed) break;
        await handleStockLeaderboardCommand(interaction);
        break;
      }

      // ============ UTILITY COMMANDS ============
      case 'help':
        await handleHelpCommand(interaction);
        break;

      case 'serverinfo':
        await handleServerInfoCommand(interaction);
        break;

      case 'dashboard':
        await handleDashboardCommand(interaction);
        break;

      // ============ MUSIC COMMANDS ============
      // Music commands removed - now handled by separate music-bot
      // Use the dedicated music bot for all music functionality
      case 'play':
      case 'pause':
      case 'resume':
      case 'skip':
      case 'stop':
      case 'queue':
      case 'nowplaying':
      case 'volume':
      case 'shuffle':
      case 'remove':
      case 'clear':
      case 'loop':
      case 'seek':
        await interaction.reply({ 
          content: '❌ Music commands are no longer available in this bot.\n\n🎵 Please use the dedicated music bot for music functionality.', 
          ephemeral: true 
        });
        break;

      // ============ VOTE KICK COMMANDS ============
      case 'votekick':
        if (global.voteKickCommands) {
          await global.voteKickCommands.handleVoteKick(interaction);
        } else {
          await interaction.reply({ content: '❌ Vote kick system not initialized', ephemeral: true });
        }
        break;

      // ============ CAM-ONLY VOICE COMMANDS ============
      case 'cam-only':
        if (!global.camOnlyVoiceHandlers) {
          return interaction.reply({ 
            content: '❌ Cam-only voice system not initialized', 
            ephemeral: true 
          });
        }

        // Check if it's a subcommand group (exempt) or regular subcommand
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        if (subcommandGroup === 'exempt') {
          // Handle exempt subcommand group
          await global.camOnlyVoiceHandlers.handleExempt(interaction);
        } else {
          // Handle regular subcommands
          const subcommand = interaction.options.getSubcommand(false);
          switch (subcommand) {
            case 'enable':
              await global.camOnlyVoiceHandlers.handleEnable(interaction);
              break;
            case 'disable':
              await global.camOnlyVoiceHandlers.handleDisable(interaction);
              break;
            case 'status':
              await global.camOnlyVoiceHandlers.handleStatus(interaction);
              break;
            default:
              await interaction.reply({ 
                content: '❌ Unknown subcommand', 
                ephemeral: true 
              });
          }
        }
        break;

      default:
        await interaction.reply({ 
          content: '❌ Unknown command', 
          ephemeral: true 
        });
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    
    // Only try to respond if interaction hasn't been acknowledged
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.reply({ 
      content: '❌ Something went wrong while executing this command.',
          flags: 64 // Ephemeral flag
        });
      } catch (replyError) {
        // If reply fails, interaction might already be acknowledged elsewhere
        console.error('Failed to send error reply:', replyError.message);
      }
    } else if (interaction.deferred && !interaction.replied) {
      // Interaction was deferred but not replied to yet
      try {
        await interaction.editReply({ 
          content: '❌ Something went wrong while executing this command.'
        });
      } catch (editError) {
        console.error('Failed to edit error reply:', editError.message);
      }
    }
    // If interaction.replied is true, don't try to respond again
  }
});

// ================================================================
// COMMAND HANDLERS
// ================================================================

async function handleStatsCommand(interaction) {
  await interaction.deferReply();

  const user = interaction.options.getUser('user') || interaction.user;
  
  if (!global.userStatsManager) {
    return interaction.editReply('❌ Stats tracking is not available at this time.');
  }

  try {
    // Get stats config
    const statsConfig = await global.userStatsManager.getStatsConfig(interaction.guild.id);
    
    if (!statsConfig.enabled) {
      return interaction.editReply('❌ Stats tracking is disabled for this server.');
    }

    // Get user stats (pass config so it can use lookback_days and period filters)
    const stats = await global.userStatsManager.getUserStats(interaction.guild.id, user.id, statsConfig);
    
    if (!stats) {
      return interaction.editReply('❌ No stats found for this user.');
    }

    // Get level and XP data
    let levelData = null;
    try {
      levelData = await xpManager.getUserLevel(interaction.guild.id, user.id);
    } catch (error) {
      console.error('[StatsCommand] Error fetching level data:', error);
    }

    // Get guild member for server joined date
    let member = null;
    try {
      member = await interaction.guild.members.fetch(user.id);
    } catch (error) {
      console.error('[StatsCommand] Error fetching member:', error);
    }

    // Generate stats card
    try {
      const avatarURL = user.displayAvatarURL({ 
        size: 256, 
        extension: 'png',
        forceStatic: true 
      });

      const statsCardBuffer = await statsCardGenerator.generateStatsCard({
        user: {
          username: user.username,
          avatarURL: avatarURL,
          guildName: interaction.guild.name
        },
        stats: {
          ...stats,
          server_joined_at: member?.joinedAt?.toISOString() || stats.server_joined_at,
          level: levelData?.level || 0,
          xp: levelData?.xp || 0,
          xpForNext: levelData?.xpForNext || 100,
          levelRank: levelData?.rank || null
        },
        config: statsConfig
      });

      const attachment = new AttachmentBuilder(statsCardBuffer, { name: 'stats-card.png' });

      // Send as standalone image without embed
      await interaction.editReply({ files: [attachment], embeds: [] });
    } catch (error) {
      console.error('[StatsCommand] Error generating stats card:', error);
      await interaction.editReply('❌ An error occurred while generating the stats card.');
    }
  } catch (error) {
    console.error('[StatsCommand] Error:', error);
    await interaction.editReply('❌ An error occurred while fetching stats.');
  }
}

async function handleLeaderboardCommand(interaction) {
  await interaction.deferReply();

  const leaderboard = await xpManager.getLeaderboard(interaction.guild.id, 10);

  if (leaderboard.length === 0) {
    return interaction.editReply('📊 Nog geen data beschikbaar!');
  }

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🏆 ${interaction.guild.name} - Leaderboard`)
    .setDescription(
      leaderboard.map((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${user.username}** - Level ${user.level} (${user.xp} XP)`;
      }).join('\n')
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSetXPCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ 
      content: '❌ You do not have permission for this command.',
      ephemeral: true 
    });
  }

  const user = interaction.options.getUser('user');
  const xp = interaction.options.getInteger('xp');

  const success = await xpManager.setXP(interaction.guild.id, user.id, xp);

  if (success) {
    const level = xpManager.calculateLevel(xp);
    await interaction.reply({
      content: `✅ ${user.tag} is now level ${level} with ${xp} XP!`,
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: '❌ Something went wrong.',
      ephemeral: true
    });
  }
}

async function handleWarnCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ 
      content: '❌ You do not have permission for this command.',
      ephemeral: true 
    });
  }

  // Check if guild has advanced moderation feature
  const hasAdvancedMod = await featureGate.checkFeatureOrReply(
    interaction,
    interaction.guild.id,
    'moderation_advanced',
    'Basic'
  );
  
  if (!hasAdvancedMod) return;

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');

  const result = await modActions.warn(interaction.guild, user, interaction.user, reason);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${user.tag} has been warned. (Case #${result.caseId})`,
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true
    });
  }
}

async function handleMuteCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ 
      content: '❌ You do not have permission for this command.',
      ephemeral: true 
    });
  }

  const member = interaction.options.getMember('user');
  const duration = interaction.options.getInteger('duration');
  const reason = interaction.options.getString('reason');

  const result = await modActions.mute(interaction.guild, member, interaction.user, duration, reason);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${member.user.tag} has been muted. (Case #${result.caseId})`,
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true
    });
  }
}

async function handleUnmuteCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ 
      content: '❌ You do not have permission for this command.',
      ephemeral: true 
    });
  }

  const member = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason');

  const result = await modActions.unmute(interaction.guild, member, interaction.user, reason);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${member.user.tag} has been unmuted. (Case #${result.caseId})`,
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true
    });
  }
}

async function handleKickCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ 
      content: '❌ You do not have permission for this command.',
      ephemeral: true 
    });
  }

  const member = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason');

  const result = await modActions.kick(interaction.guild, member, interaction.user, reason);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${member.user.tag} has been kicked. (Case #${result.caseId})`,
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true
    });
  }
}

async function handleBanCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.reply({ 
      content: '❌ You do not have permission for this command.',
      ephemeral: true 
    });
  }

  const user = interaction.options.getUser('user');
  const duration = interaction.options.getInteger('duration');
  const reason = interaction.options.getString('reason');

  const result = await modActions.ban(interaction.guild, user, interaction.user, reason, duration);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${user.tag} has been banned. (Case #${result.caseId})`,
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true
    });
  }
}

async function handleCaseCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ 
      content: '❌ You do not have permission for this command.',
      ephemeral: true 
    });
  }

  // Check if guild has advanced moderation feature
  const hasAdvancedMod = await featureGate.checkFeatureOrReply(
    interaction,
    interaction.guild.id,
    'moderation_advanced',
    'Basic'
  );
  
  if (!hasAdvancedMod) return;

  const caseId = interaction.options.getInteger('id');
  const caseData = await modActions.getCase(interaction.guild.id, caseId);

  if (!caseData) {
    return interaction.reply({
      content: `❌ Case #${caseId} not found.`,
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`📋 Case #${caseId}`)
    .addFields(
      { name: 'Action', value: caseData.action.toUpperCase(), inline: true },
      { name: 'User', value: `${caseData.username} (${caseData.user_id})`, inline: true },
      { name: 'Moderator', value: caseData.moderator_name, inline: true },
      { name: 'Reason', value: caseData.reason || 'No reason', inline: false }
    )
    .setTimestamp(new Date(caseData.created_at));

  if (caseData.duration) {
    embed.addFields({ name: 'Duration', value: `${caseData.duration} minutes`, inline: true });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCustomCommandCommand(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ 
      content: '❌ You do not have permission for this command.',
      ephemeral: true 
    });
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    const trigger = interaction.options.getString('trigger');
    const response = interaction.options.getString('response');

    // Check limit before creating
    const existingCommands = await customCommands.getGuildCommands(interaction.guild.id);
    const canCreate = await featureGate.checkLimitOrReply(
      interaction,
      interaction.guild.id,
      'custom_commands',
      existingCommands.length,
      'Custom Commands',
      'Basic'
    );
    
    if (!canCreate) return;

    const result = await customCommands.createCommand(
      interaction.guild.id,
      trigger,
      response,
      { created_by: interaction.user.id }
    );

    if (result.success) {
      await interaction.reply({
        content: `✅ Custom command \`${trigger}\` created!`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: `❌ Error: ${result.error}`,
        ephemeral: true
      });
    }
  } else if (subcommand === 'remove') {
    const trigger = interaction.options.getString('trigger');

    const result = await customCommands.deleteCommand(interaction.guild.id, trigger);

    if (result.success) {
      await interaction.reply({
        content: `✅ Custom command \`${trigger}\` removed!`,
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: `❌ Error: ${result.error}`,
        ephemeral: true
      });
    }
  } else if (subcommand === 'list') {
    const commands = await customCommands.getGuildCommands(interaction.guild.id);
    const limits = await featureGate.getLimits(interaction.guild.id);
    const maxCommands = limits.custom_commands;

    if (commands.length === 0) {
      return interaction.reply({
        content: `📝 No custom commands created yet. (0/${maxCommands === -1 ? '∞' : maxCommands})`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📝 Custom Commands')
      .setDescription(
        commands.map(cmd => `\`${cmd.trigger}\` - Used ${cmd.uses}x`).join('\n')
      )
      .setFooter({ text: `${commands.length}/${maxCommands === -1 ? '∞' : maxCommands} slots used` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleBirthdayCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  switch (subcommand) {
    case 'set': {
      await interaction.deferReply({ ephemeral: true });

      const date = interaction.options.getString('datum', true);
      const timezone = interaction.options.getString('timezone') || (await configManager.getGuildConfig(guildId))?.timezone;
      const isPrivate = interaction.options.getBoolean('private') || false;

      const result = await birthdayManager.setBirthday(
        guildId,
        interaction.user,
        date,
        { timezone, is_private: isPrivate }
      );

      if (!result.success) {
        return interaction.editReply({
          content: `❌ ${result.error}`
        });
      }

      return interaction.editReply({
        content: `🎉 Your birthday has been saved as ${date}!`
      });
    }
    case 'clear': {
      await interaction.deferReply({ ephemeral: true });
      const result = await birthdayManager.removeBirthday(guildId, interaction.user.id);
      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.error}` });
      }
      return interaction.editReply({ content: '🗑️ Your birthday has been removed.' });
    }
    case 'info': {
      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const entry = await birthdayManager.getBirthday(guildId, targetUser.id);

      if (!entry) {
        return interaction.editReply({
          content: `ℹ️ No birthday found for ${targetUser.username}.`
        });
      }

      const guildConfig = await configManager.getGuildConfig(guildId);
      const timezone = entry.timezone || guildConfig?.timezone || 'Europe/Amsterdam';

      const { displayDate, age } = formatBirthdayDisplay(entry.birthday, timezone);

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FFC700')
            .setTitle(`🎂 Birthday of ${targetUser.username}`)
            .addFields(
              { name: 'Date', value: displayDate, inline: true },
              { name: 'Age', value: age ? `${age} years` : 'Unknown', inline: true },
              { name: 'Visibility', value: entry.is_private ? 'Private' : 'Public', inline: true }
            )
        ],
        ephemeral: true
      });
    }
    case 'upcoming': {
      await interaction.deferReply({ ephemeral: true });
      const count = interaction.options.getInteger('aantal') || 5;

      const entries = await birthdayManager.getBirthdays(guildId);
      const guildConfig = await configManager.getGuildConfig(guildId);
      const timezone = guildConfig?.timezone || 'Europe/Amsterdam';

      const upcoming = getUpcomingBirthdays(entries, timezone).slice(0, count);

      if (upcoming.length === 0) {
        return interaction.editReply({ content: '📭 No birthdays found.' });
      }

      const lines = upcoming.map(entry => {
        const member = interaction.guild.members.cache.get(entry.user_id);
        const name = member ? member.displayName : entry.display_name || entry.username || entry.user_id;
        const { displayDate, age } = formatBirthdayDisplay(entry.birthday, timezone);
        return `• **${name}** – ${displayDate}${age ? ` (${age})` : ''}`;
      });

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF8B3D')
            .setTitle('🎂 Upcoming Birthdays')
            .setDescription(lines.join('\n'))
        ]
      });
    }
    default:
      return interaction.reply({
        content: '❌ Unknown subcommand.',
        ephemeral: true
      });
  }
}

async function handleBirthdayConfigCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  const updates = {};
  let responseMessage = '';

  switch (subcommand) {
    case 'enable': {
      const enabled = interaction.options.getBoolean('status', true);
      updates.birthdays_enabled = enabled;
      responseMessage = enabled ? '🎉 Birthdays are enabled.' : '⛔ Birthdays are disabled.';
      break;
    }
    case 'channel': {
      const channel = interaction.options.getChannel('kanaal', true);
      updates.birthday_channel_id = channel.id;
      responseMessage = `📢 Birthday announcements will be sent in ${channel}.`;
      break;
    }
    case 'role': {
      const role = interaction.options.getRole('rol', true);
      updates.birthday_role_id = role.id;
      responseMessage = `🎭 Birthday role ingesteld op ${role}.`;
      break;
    }
    case 'message': {
      const message = interaction.options.getString('template', true);
      updates.birthday_message_template = message;
      responseMessage = '📝 Birthday message template updated.';
      break;
    }
    case 'pingrole': {
      const shouldPing = interaction.options.getBoolean('status', true);
      updates.birthday_ping_role = shouldPing;
      responseMessage = shouldPing
        ? '🔔 Birthday role will be pinged.'
        : '🔕 Birthday role will no longer be pinged.';
      break;
    }
    case 'time': {
      const time = interaction.options.getString('uur', true);
      if (!/^\\d{2}:\\d{2}$/.test(time)) {
        return interaction.reply({
          content: '❌ Invalid time format. Use HH:MM (24-hour).',
          ephemeral: true
        });
      }
      updates.birthday_announcement_time = time;
      responseMessage = `⏰ Birthday announcements will be sent around ${time}.`;
      break;
    }
    default:
      return interaction.reply({
        content: '❌ Unknown configuration option.',
        ephemeral: true
      });
  }

  const result = await birthdayManager.updateSettings(guildId, updates);

  if (!result.success) {
    return interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true
    });
  }

  return interaction.reply({
    content: responseMessage,
    ephemeral: true
  });
}

function formatBirthdayDisplay(birthday, timezone) {
  const date = new Date(`${birthday}T00:00:00.000Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'Europe/Amsterdam',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const displayDate = formatter.format(date);

  const now = new Date();
  const nowYear = new Intl.DateTimeFormat('en-GB', { timeZone: timezone || 'Europe/Amsterdam', year: 'numeric' })
    .format(now);
  const birthYear = birthday.slice(0, 4);
  const age = /^\d{4}$/.test(birthYear) && parseInt(birthYear, 10) > 1900
    ? parseInt(nowYear, 10) - parseInt(birthYear, 10)
    : null;

  return { displayDate, age };
}

function getUpcomingBirthdays(entries, timezone) {
  const now = new Date();
  const tz = timezone || 'Europe/Amsterdam';
  const currentParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const currentMonth = parseInt(currentParts.find(p => p.type === 'month').value, 10);
  const currentDay = parseInt(currentParts.find(p => p.type === 'day').value, 10);

  const withDiff = entries
    .filter(entry => !entry.is_private)
    .map(entry => {
      const entryDate = new Date(`${entry.birthday}T00:00:00.000Z`);
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(entryDate);

      const month = parseInt(parts.find(p => p.type === 'month').value, 10);
      const day = parseInt(parts.find(p => p.type === 'day').value, 10);

      let diff = (month - currentMonth) * 31 + (day - currentDay);
      if (diff < 0) {
        diff += 12 * 31;
      }

      return { entry, diff };
    });

  return withDiff
    .sort((a, b) => a.diff - b.diff)
    .map(item => item.entry);
}

async function handleHelpCommand(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🤖 ComCraft - Help')
    .setDescription('A powerful Discord bot for content creators')
    .addFields(
      {
        name: '📊 Leveling',
        value: '`/stats` - View your stats and rank\n`/leaderboard` - Server leaderboard'
      },
      {
        name: '🛡️ Moderation',
        value: '`/warn` - Warn a user\n`/mute` - Mute a user\n`/kick` - Kick a user\n`/ban` - Ban a user'
      },
      {
        name: '🎫 Tickets',
        value: '`/ticket create` - Create a support ticket\n`/ticket-setup` - [Admin] Configure tickets\n`/ticket-stats` - [Admin] View statistics'
      },
      {
        name: '⚙️ Custom Commands',
        value: '`/customcommand add` - Add a command\n`/customcommand list` - View all commands'
      },
      {
        name: '🎂 Birthdays',
        value: '`/birthday set` - Set your birthday\n`/birthday upcoming` - View upcoming birthdays'
      },
      {
        name: '🌐 Dashboard',
        value: `Configure everything via:\n${process.env.WEBAPP_URL || 'https://codecraft-solutions.com'}/comcraft/dashboard`
      }
    )
    .setFooter({ text: 'ComCraft - Made for Content Creators' });

  await interaction.reply({ embeds: [embed] });
}

async function handleServerInfoCommand(interaction) {
  const guild = interaction.guild;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`📊 ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .addFields(
      { name: '👑 Owner', value: (await guild.fetchOwner()).user.tag, inline: true },
      { name: '👥 Members', value: guild.memberCount.toString(), inline: true },
      { name: '📅 Created', value: guild.createdAt.toLocaleDateString('en-US'), inline: true },
      { name: '💬 Channels', value: guild.channels.cache.size.toString(), inline: true },
      { name: '🎭 Roles', value: guild.roles.cache.size.toString(), inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleDashboardCommand(interaction) {
  const dashboardUrl = `${process.env.WEBAPP_URL || 'https://codecraft-solutions.com'}/comcraft/dashboard/${interaction.guild.id}`;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🌐 ComCraft Dashboard')
    .setDescription('Configure the bot via the online dashboard!')
    .addFields(
      { name: '🔗 Link', value: `[Click here](${dashboardUrl})` }
    );

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Open Dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(dashboardUrl)
        .setEmoji('🌐')
    );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleGiveawayCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;
  const guildId = guild.id;

  const allowed = await featureGate.checkFeatureOrReply(
    interaction,
    guildId,
    GIVEAWAYS_FEATURE,
    'Premium'
  );

  if (!allowed) {
    return;
  }

  switch (subcommand) {
    case 'start': {
      const prize = interaction.options.getString('prize', true).trim();
      const duration = interaction.options.getInteger('duration', true);
      const winners = interaction.options.getInteger('winners') || 1;
      const channelOption = interaction.options.getChannel('channel');
      const roleOption = interaction.options.getRole('role');

      const channel = channelOption || interaction.channel;
      if (!channel?.isTextBased()) {
        return interaction.reply({
          content: '❌ Please choose a text channel for the giveaway.',
          ephemeral: true,
        });
      }

      if (winners < 1 || winners > 25) {
        return interaction.reply({
          content: '❌ The number of winners must be between 1 and 25.',
          ephemeral: true,
        });
      }

      if (duration < 1 || duration > 10080) {
        return interaction.reply({
          content: '❌ Duration must be between 1 and 10080 minutes.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const result = await giveawayManager.createGiveaway({
        guild,
        channel,
        host: interaction.member,
        hostName: interaction.user.username,
        prize,
        durationMinutes: duration,
        winnerCount: winners,
        requiredRoleId: roleOption ? roleOption.id : null,
      });

      if (!result.success) {
        return interaction.editReply({
          content: `❌ ${result.error || 'The giveaway could not be started.'}`,
        });
      }

      const giveaway = result.giveaway;
      return interaction.editReply({
        content: `🎉 Giveaway started in <#${giveaway.channel_id}>! ID: ${giveaway.id}.
Use this ID to manage the giveaway (end/reroll).`,
      });
    }

    case 'end': {
      const giveawayId = interaction.options.getString('id', true);
      await interaction.deferReply({ ephemeral: true });

      const result = await giveawayManager.endGiveaway(giveawayId, { force: true });

      if (!result.success) {
        return interaction.editReply({
          content: `❌ ${result.error || 'Could not end the giveaway.'}`,
        });
      }

      const winners = result.winners || [];
      const winnerMentions = winners.length > 0 ? winners.map((id) => `<@${id}>`).join(', ') : 'No participants.';

      return interaction.editReply({
        content: `✅ Giveaway ended! Winners: ${winnerMentions}`,
      });
    }

    case 'reroll': {
      const giveawayId = interaction.options.getString('id', true);
      await interaction.deferReply({ ephemeral: true });

      const result = await giveawayManager.rerollGiveaway(giveawayId);

      if (!result.success) {
        return interaction.editReply({
          content: `❌ ${result.error || 'Could not select new winners.'}`,
        });
      }

      const winners = result.winners || [];
      const winnerMentions = winners.length > 0 ? winners.map((id) => `<@${id}>`).join(', ') : 'No participants.';

      return interaction.editReply({
        content: `🔁 Giveaway rerolled! New winners: ${winnerMentions}`,
      });
    }

    default:
      return interaction.reply({
        content: '❌ Unknown giveaway subcommand.',
        ephemeral: true,
      });
  }
}

// ================================================================
// ECONOMY COMMAND HANDLERS
// ================================================================

async function handleBalanceCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  // Check if economyManager is initialized
  if (!economyManager) {
    console.error('❌ Economy Manager not initialized');
    return interaction.editReply({
      content: '❌ Economy system is not initialized yet. Please try again in a moment.',
    });
  }

  const userId = interaction.user.id;
  const guildId = interaction.guild.id;
  const username = interaction.user.username;
  const avatarUrl = interaction.user.displayAvatarURL();

  try {
    const userEconomy = await economyManager.getUserEconomy(guildId, userId, username, avatarUrl);
    if (!userEconomy) {
      return interaction.editReply({
        content: '❌ Could not retrieve your economy data.',
      });
    }

    const balance = BigInt(userEconomy.balance);
    const totalEarned = BigInt(userEconomy.total_earned);
    const totalSpent = BigInt(userEconomy.total_spent);

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('💰 Your Balance')
      .setThumbnail(avatarUrl)
      .addFields(
        {
          name: '💵 Current Balance',
          value: `${economyManager.formatCoins(balance)} coins`,
          inline: true,
        },
        {
          name: '📈 Total Earned',
          value: `${economyManager.formatCoins(totalEarned)} coins`,
          inline: true,
        },
        {
          name: '📉 Total Spent',
          value: `${economyManager.formatCoins(totalSpent)} coins`,
          inline: true,
        },
        {
          name: '🔥 Daily Streak',
          value: `${userEconomy.daily_streak} days`,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleBalanceCommand:', error);
    return interaction.editReply({
      content: '❌ An error occurred while retrieving your balance. Please try again later.',
    });
  }
}

async function handleDailyCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  // Check if economyManager is initialized
  if (!economyManager) {
    console.error('❌ Economy Manager not initialized');
    return interaction.editReply({
      content: '❌ Economy system is not initialized yet. Please try again in a moment.',
    });
  }

  const userId = interaction.user.id;
  const guildId = interaction.guild.id;
  const username = interaction.user.username;
  const avatarUrl = interaction.user.displayAvatarURL();

  try {
    const result = await economyManager.claimDaily(guildId, userId, username, avatarUrl);

    if (!result.success) {
      if (result.hoursUntil) {
        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⏰ Daily Reward Not Available Yet')
          .setDescription(`You have already claimed your daily reward today!`)
          .addFields({
            name: '⏳ Next Claim',
            value: `<t:${Math.floor(new Date(result.nextClaim).getTime() / 1000)}:R>`,
          })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#22C55E')
      .setTitle('🎁 Daily Reward Claimed!')
      .setDescription(`You received **${economyManager.formatCoins(result.reward)} coins**!`)
      .addFields(
        {
          name: '🔥 Streak',
          value: `${result.streak} days${result.streakBroken ? ' (new streak!)' : ''}`,
          inline: true,
        },
        {
          name: '💰 New Balance',
          value: `${economyManager.formatCoins(result.newBalance)} coins`,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleDailyCommand:', error);
    return interaction.editReply({
      content: '❌ An error occurred while claiming your daily reward. Please try again later.',
    });
  }
}

async function handlePayCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  // Check if economyManager is initialized
  if (!economyManager) {
    console.error('❌ Economy Manager not initialized');
    return interaction.editReply({
      content: '❌ Economy system is not initialized yet. Please try again in a moment.',
    });
  }

  const userId = interaction.user.id;
  const targetUser = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);
  const guildId = interaction.guild.id;

  if (targetUser.id === userId) {
    return interaction.editReply({
      content: '❌ You cannot pay yourself!',
    });
  }

  // Allow paying the bot itself, but not other bots
  const isBotPayment = client?.user && targetUser.id === client.user.id;
  
  if (targetUser.bot && !isBotPayment) {
    return interaction.editReply({
      content: '❌ You cannot pay other bots! But you can tip me if you want... 😏💰',
    });
  }

  try {
    const result = await economyManager.transferCoins(
      guildId,
      userId,
      targetUser.id,
      amount,
      `Payment from ${interaction.user.username} to ${targetUser.username}`
    );

    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#22C55E')
      .setTitle('💸 Payment Completed')
      .setDescription(`You paid **${economyManager.formatCoins(amount)} coins** to ${targetUser}!`)
      .addFields({
        name: '💰 Your New Balance',
        value: `${economyManager.formatCoins(result.fromBalance)} coins`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // If paying the bot, have it thank the user
    if (isBotPayment) {
      const thankYouMessages = [
        `Thanks for the ${economyManager.formatCoins(amount)} coins, ${interaction.user.username}! 💰 You're too kind! 😊`,
        `Wow, ${economyManager.formatCoins(amount)} coins?! Thanks ${interaction.user.username}! 🙏 I'll put this to good use! 💪`,
        `Much appreciated, ${interaction.user.username}! Got ${economyManager.formatCoins(amount)} coins richer! 🤑💸`,
        `${interaction.user.username} just tipped me ${economyManager.formatCoins(amount)} coins! Legend! 🏆`,
        `Thank you ${interaction.user.username}! ${economyManager.formatCoins(amount)} coins closer to my dream of... wait, what do bots dream of? 🤖💭`,
      ];
      const randomThankYou = thankYouMessages[Math.floor(Math.random() * thankYouMessages.length)];
      
      try {
        await interaction.followUp({ content: randomThankYou });
      } catch (error) {
        console.error('Error sending bot thank you message:', error);
      }
    }
  } catch (error) {
    console.error('Error in handlePayCommand:', error);
    return interaction.editReply({
      content: '❌ An error occurred while processing the payment. Please try again later.',
    });
  }
}

async function handleConvertCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  // Check if managers are initialized
  if (!economyManager) {
    console.error('❌ Economy Manager not initialized');
    return interaction.editReply({
      content: '❌ Economy system is not initialized. Try again in a moment.',
    });
  }

  if (!xpManager) {
    console.error('❌ XP Manager not initialized');
    return interaction.editReply({
      content: '❌ XP system is not initialized. Try again in a moment.',
    });
  }

  const userId = interaction.user.id;
  const xpAmount = interaction.options.getInteger('amount', true);
  const guildId = interaction.guild.id;

  try {
    // Get economy config to show conversion rate
    const config = await economyManager.getEconomyConfig(guildId);
    if (!config) {
      return interaction.editReply({
        content: '❌ Economy config not found for this server.',
      });
    }

    if (!config.xp_conversion_enabled) {
      return interaction.editReply({
        content: '❌ XP conversion is disabled on this server.',
      });
    }

    // Get user's current XP
    const userLevel = await xpManager.getUserLevel(guildId, userId);
    if (!userLevel || userLevel.xp === 0) {
      return interaction.editReply({
        content: '❌ You don\'t have any XP to convert! Chat in the server to earn XP first.',
      });
    }

    // Calculate coins they would get
    const coinsToReceive = Math.floor(xpAmount * config.xp_to_coins_rate);

    // Perform the conversion
    const result = await economyManager.convertXP(guildId, userId, xpAmount, xpManager);

    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }

    // Build success embed
    const embed = new EmbedBuilder()
      .setColor('#3B82F6')
      .setTitle('🔄 XP Converted Successfully!')
      .setDescription(`You converted **${xpAmount} XP** into **${economyManager.formatCoins(result.coinsAdded)} coins**!`)
      .addFields(
        {
          name: '✨ XP Used',
          value: `${xpAmount} XP`,
          inline: true,
        },
        {
          name: '💰 Coins Received',
          value: `${economyManager.formatCoins(result.coinsAdded)} coins`,
          inline: true,
        },
        {
          name: '📊 Conversion Rate',
          value: `${config.xp_to_coins_rate} coins per XP`,
          inline: true,
        },
        {
          name: '💵 New Balance',
          value: `${economyManager.formatCoins(result.newBalance)} coins`,
          inline: true,
        },
        {
          name: '⭐ XP Remaining',
          value: `${userLevel.xp - xpAmount} XP`,
          inline: true,
        },
        {
          name: '🎯 Current Level',
          value: `Level ${result.newLevel}${result.levelChanged ? ` (was ${result.oldLevel})` : ''}`,
          inline: true,
        }
      )
      .setFooter({ text: `💡 Use /balance to check your coins, /stats to check your stats and XP` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleConvertCommand:', error);
    return interaction.editReply({
      content: '❌ An error occurred while converting XP. Please try again later.',
    });
  }
}

async function handleChallengeCommand(interaction) {
  await interaction.deferReply();

  // Check if managers are initialized
  if (!duelManager) {
    return interaction.editReply({
      content: '❌ Duel system is not initialized.',
    });
  }

  if (!economyManager) {
    return interaction.editReply({
      content: '❌ Economy system is not initialized.',
    });
  }

  const challenger = interaction.user;
  const opponent = interaction.options.getUser('opponent', true);
  const betAmount = interaction.options.getInteger('bet', true);
  const guildId = interaction.guild.id;

  // Validation
  if (opponent.id === challenger.id) {
    return interaction.editReply({
      content: '❌ You cannot challenge yourself!',
    });
  }

  // Check if challenging the bot itself
  const isBotChallenge = opponent.id === client.user.id;

  if (opponent.bot && !isBotChallenge) {
    return interaction.editReply({
      content: '❌ You cannot challenge other bots! But you can challenge me if you dare... 😏',
    });
  }

  try {
    // Create the challenge
    const challenge = await duelManager.createChallenge(
      guildId,
      challenger.id,
      opponent.id,
      betAmount,
      economyManager
    );

    if (!challenge.success) {
      return interaction.editReply({
        content: `❌ ${challenge.error}`,
      });
    }

    // If challenging the bot, auto-accept with AI response
    if (isBotChallenge) {
      return await handleBotChallengeMainBot(
        interaction,
        duelManager,
        economyManager,
        client,
        challenger,
        betAmount,
        challenge.duelId,
        guildId
      );
    }

    // Get combat stats and equipped items for both players
    let challengerData = null;
    let challengedData = null;

    try {
      // Get challenger combat level
      let challengerCombatLevel = 1;
      if (combatXPManager) {
        const challengerStats = await combatXPManager.getCombatStats(guildId, challenger.id);
        challengerCombatLevel = challengerStats?.combat_level || 1;
      }

      // Get challenged combat level
      let challengedCombatLevel = 1;
      if (combatXPManager) {
        const challengedStats = await combatXPManager.getCombatStats(guildId, opponent.id);
        challengedCombatLevel = challengedStats?.combat_level || 1;
      }

      // Get equipped items
      let challengerEquipped = { weapon: null, armor: null };
      let challengedEquipped = { weapon: null, armor: null };
      
      if (inventoryManager) {
        challengerEquipped = await inventoryManager.getEquippedItems(guildId, challenger.id);
        challengedEquipped = await inventoryManager.getEquippedItems(guildId, opponent.id);
      }

      challengerData = {
        combatLevel: challengerCombatLevel,
        equipped: challengerEquipped,
      };

      challengedData = {
        combatLevel: challengedCombatLevel,
        equipped: challengedEquipped,
      };
    } catch (error) {
      console.error('Error fetching player data for challenge embed:', error);
    }

    // Build challenge embed with player data
    const { embed, components } = await duelManager.buildChallengeEmbed(
      challenger,
      opponent,
      betAmount,
      challenge.duelId,
      challengerData,
      challengedData
    );

    const message = await interaction.editReply({
      content: `${opponent}, you have been challenged by ${challenger}!`,
      embeds: [embed],
      components,
    });

    // Store the pending challenge
    duelManager.storePendingChallenge(message.id, {
      duelId: challenge.duelId,
      challengerId: challenger.id,
      challengedId: opponent.id,
      betAmount,
      guildId,
      channelId: interaction.channel.id,
    });

  } catch (error) {
    console.error('Error in handleChallengeCommand:', error);
    return interaction.editReply({
      content: '❌ An error occurred while creating the challenge. Please try again later.',
    });
  }
}

// Handle duel challenge button from embed builder
async function handleDuelChallengeButton(interaction) {
  if (!duelManager) {
    return interaction.reply({
      content: '❌ Duel system is not available.',
      ephemeral: true
    });
  }

  if (!economyManager) {
    return interaction.reply({
      content: '❌ Economy system is not available.',
      ephemeral: true
    });
  }

  // Show modal to select opponent and bet amount
  const modal = new ModalBuilder()
    .setCustomId('duel_challenge_modal')
    .setTitle('⚔️ Challenge to Duel');

  const opponentInput = new TextInputBuilder()
    .setCustomId('opponent')
    .setLabel('Opponent (User ID, mention, or username)')
    .setPlaceholder('@username or user ID')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(100);

  const betInput = new TextInputBuilder()
    .setCustomId('bet_amount')
    .setLabel('Bet Amount (coins)')
    .setPlaceholder('100')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(opponentInput),
    new ActionRowBuilder().addComponents(betInput)
  );

  await interaction.showModal(modal);
}

// Handle duel challenge modal submission
async function handleDuelChallengeModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!duelManager) {
    return interaction.editReply({
      content: '❌ Duel system is not available.',
    });
  }

  if (!economyManager) {
    return interaction.editReply({
      content: '❌ Economy system is not available.',
    });
  }

  try {
    const opponentInput = interaction.fields.getTextInputValue('opponent');
    const betAmountInput = interaction.fields.getTextInputValue('bet_amount');
    
    const betAmount = parseInt(betAmountInput);
    if (isNaN(betAmount) || betAmount <= 0) {
      return interaction.editReply({
        content: '❌ Invalid bet amount. Please enter a positive number.',
      });
    }

    // Try to resolve opponent from input (could be mention, user ID, or username)
    let opponent = null;
    
    // Try to extract user ID from mention
    const mentionMatch = opponentInput.match(/<@!?(\d+)>/);
    if (mentionMatch) {
      try {
        opponent = await interaction.guild.members.fetch(mentionMatch[1]).then(m => m.user);
      } catch (e) {
        // User not found
      }
    }
    
    // Try as user ID
    if (!opponent && /^\d+$/.test(opponentInput.trim())) {
      try {
        opponent = await interaction.guild.members.fetch(opponentInput.trim()).then(m => m.user);
      } catch (e) {
        // User not found
      }
    }
    
    // Try to find by username
    if (!opponent) {
      const username = opponentInput.trim().toLowerCase();
      const members = await interaction.guild.members.fetch();
      const found = members.find(m => 
        m.user.username.toLowerCase() === username || 
        m.user.displayName.toLowerCase() === username ||
        m.user.tag.toLowerCase() === username
      );
      if (found) opponent = found.user;
    }

    if (!opponent) {
      return interaction.editReply({
        content: '❌ Could not find that user. Please use a mention (@username), user ID, or exact username.',
      });
    }

    const challenger = interaction.user;
    const guildId = interaction.guild.id;

    // Validation
    if (opponent.id === challenger.id) {
      return interaction.editReply({
        content: '❌ You cannot challenge yourself!',
      });
    }

    // Check if challenging the bot itself
    const isBotChallenge = opponent.id === client.user.id;

    if (opponent.bot && !isBotChallenge) {
      return interaction.editReply({
        content: '❌ You cannot challenge other bots! But you can challenge me if you dare... 😏',
      });
    }

    // Create the challenge
    const challenge = await duelManager.createChallenge(
      guildId,
      challenger.id,
      opponent.id,
      betAmount,
      economyManager
    );

    if (!challenge.success) {
      return interaction.editReply({
        content: `❌ ${challenge.error}`,
      });
    }

    // If challenging the bot, auto-accept with AI response
    if (isBotChallenge) {
      return await handleBotChallengeMainBot(
        interaction,
        duelManager,
        economyManager,
        client,
        challenger,
        betAmount,
        challenge.duelId,
        guildId
      );
    }

    // Get combat stats and equipped items for both players
    let challengerData = null;
    let challengedData = null;

    try {
      // Get challenger combat level
      let challengerCombatLevel = 1;
      if (combatXPManager) {
        const challengerStats = await combatXPManager.getCombatStats(guildId, challenger.id);
        challengerCombatLevel = challengerStats?.combat_level || 1;
      }

      // Get challenged combat level
      let challengedCombatLevel = 1;
      if (combatXPManager) {
        const challengedStats = await combatXPManager.getCombatStats(guildId, opponent.id);
        challengedCombatLevel = challengedStats?.combat_level || 1;
      }

      // Get equipped items
      let challengerEquipped = { weapon: null, armor: null };
      let challengedEquipped = { weapon: null, armor: null };
      
      if (inventoryManager) {
        challengerEquipped = await inventoryManager.getEquippedItems(guildId, challenger.id);
        challengedEquipped = await inventoryManager.getEquippedItems(guildId, opponent.id);
      }

      challengerData = {
        combatLevel: challengerCombatLevel,
        equipped: challengerEquipped,
      };

      challengedData = {
        combatLevel: challengedCombatLevel,
        equipped: challengedEquipped,
      };
    } catch (error) {
      console.error('Error fetching player data for challenge embed:', error);
    }

    // Build challenge embed with player data
    const { embed, components } = await duelManager.buildChallengeEmbed(
      challenger,
      opponent,
      betAmount,
      challenge.duelId,
      challengerData,
      challengedData
    );

    const message = await interaction.channel.send({
      content: `${opponent}, you have been challenged by ${challenger}!`,
      embeds: [embed],
      components,
    });

    // Store the pending challenge
    duelManager.storePendingChallenge(message.id, {
      duelId: challenge.duelId,
      challengerId: challenger.id,
      challengedId: opponent.id,
      betAmount,
      guildId,
      channelId: interaction.channel.id,
    });

    await interaction.editReply({
      content: `✅ Duel challenge sent to ${opponent}! Check the channel to see if they accept.`,
    });

  } catch (error) {
    console.error('Error in handleDuelChallengeModal:', error);
    return interaction.editReply({
      content: '❌ An error occurred while creating the challenge. Please try again later.',
    });
  }
}

async function handleBotChallengeMainBot(interaction, duelManager, economyManager, client, challenger, betAmount, duelId, guildId) {
  try {
    // Acceptance responses
    const acceptanceResponses = [
      `⚔️ ${challenger.username} dares to challenge me? ACCEPTED! Prepare for defeat, mortal! 😤`,
      `🤖 Challenge accepted, ${challenger.username}! But don't cry when you lose your ${betAmount} coins! 💰`,
      `⚡ Bold move, ${challenger.username}! Let's see if you can handle the power of AI in combat! 🔥`,
      `🎮 Oh, you think you can beat me? Let's dance, ${challenger.username}! Time to show you who's boss! 💪`,
      `🎯 ${betAmount} coins? That's barely a warmup! Come at me, ${challenger.username}! 😎`,
    ];

    const botResponse = acceptanceResponses[Math.floor(Math.random() * acceptanceResponses.length)];

    // Auto-accept: Start the duel immediately
    const startResult = await duelManager.startDuel(
      guildId,
      duelId,
      challenger.id,
      client.user.id,
      betAmount,
      economyManager
    );

    if (!startResult.success) {
      return interaction.editReply({
        content: `❌ Failed to start duel: ${startResult.error}`,
      });
    }

    const duel = startResult.duel;
    const player1User = challenger;
    const player2User = client.user;

    // === NEW: Simulate ENTIRE battle upfront and generate ONE GIF ===
    const battleResult = await duelManager.simulateFullBattle(duel, player1User, player2User);
    
    // Build the duel embed with the full battle GIF
    const battleEmbed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('⚔️ DUEL IN PROGRESS!')
      .setDescription(`**${player1User.username}** vs **${player2User.username}**\n\n💰 Pot: **${duel.totalPot}** coins`)
      .setTimestamp();
    
    // If we have a battle GIF, use it
    const files = battleResult.battleGif ? [battleResult.battleGif] : [];
    if (battleResult.battleGif) {
      battleEmbed.setImage(`attachment://battle_${duel.duelId}.gif`);
    }
    
    // Post the battle GIF - this plays through without updates!
        await interaction.editReply({
      content: botResponse,
      embeds: [battleEmbed],
      files: files,
        });

    // Calculate how long the GIF will play
    const gifPlayTime = Math.min(battleResult.allRounds.length * 800 + 2000, 15000);
          
    // Wait for the GIF to finish playing, then show results
    setTimeout(async () => {
      try {
        await duelManager.finishDuel(duel.duelId, battleResult.winner, economyManager);
          
          // Generate response for the result
        let resultMessage = battleResult.winner === 'draw' 
            ? '🤝 **DUEL ENDED IN A DRAW!**'
          : `🏆 **${battleResult.winner === duel.player1.id ? player1User.username : player2User.username} WINS!**`;

        if (battleResult.winner === client.user.id) {
            const winResponses = [
              '\n\n😎 Ez! Better luck next time, human!',
              '\n\n🤖 Calculated. Predicted. Dominated.',
              '\n\n⚡ The power of AI prevails!',
              '\n\n💪 Maybe practice more before challenging me again?',
            ];
            resultMessage += winResponses[Math.floor(Math.random() * winResponses.length)];
        } else if (battleResult.winner === challenger.id) {
            const loseResponses = [
              '\n\n😤 Impossible! You got lucky this time...',
              '\n\n🤔 Interesting... I need to recalculate my strategy.',
              '\n\n😮 Well played, human. Well played indeed.',
              '\n\n👏 You earned those coins fair and square. Respect!',
            ];
            resultMessage += loseResponses[Math.floor(Math.random() * loseResponses.length)];
          }

        // Build result embed
        const resultEmbed = new EmbedBuilder()
          .setColor(battleResult.winner === 'draw' ? '#808080' : '#FFD700')
          .setTitle(battleResult.winner === 'draw' ? '🤝 Draw!' : '🏆 Victory!')
          .setDescription(resultMessage)
          .addFields(
            {
              name: `${player1User.username}`,
              value: `❤️ ${battleResult.finalP1Hp}/${duel.player1.maxHp} HP`,
              inline: true,
            },
            {
              name: `${player2User.username}`,
              value: `❤️ ${battleResult.finalP2Hp}/${duel.player2.maxHp} HP`,
              inline: true,
            },
            {
              name: '💰 Pot',
              value: `${duel.totalPot} coins`,
              inline: true,
            }
          )
          .setTimestamp();
        
        if (battleResult.battleGif) {
          resultEmbed.setImage(`attachment://battle_${duel.duelId}.gif`);
        }
            
            await interaction.editReply({
              content: resultMessage,
              embeds: [resultEmbed],
          files: [],
            });
      } catch (error) {
        console.error('Error showing bot duel result:', error);
      }
    }, gifPlayTime);

  } catch (error) {
    console.error('Error in handleBotChallengeMainBot:', error);
    return interaction.editReply({
      content: '❌ An error occurred while starting the bot duel.',
    });
  }
}

/**
 * Handle verification button - removes unverified role when user verifies
 */
async function handleVerificationButton(interaction) {
  try {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true
      });
    }

    // Remove unverified role
    const result = await welcomeHandler.removeUnverifiedRole(interaction.member);

    if (!result.success) {
      return interaction.reply({
        content: result.error || '❌ An error occurred while removing the unverified role.',
        ephemeral: true
      });
    }

    if (result.removed) {
      // Role was removed successfully
      return interaction.reply({
        content: `✅ You are now verified! The ${result.roleName || 'unverified'} role has been removed.`,
        ephemeral: true
      });
    } else {
      // User doesn't have the unverified role (already verified or not configured)
      return interaction.reply({
        content: 'ℹ️ You don\'t have the unverified role, or it\'s not configured for this server.',
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Error handling verification button:', error);
    return interaction.reply({
      content: '❌ An error occurred during verification.',
      ephemeral: true
    });
  }
}

async function handleDuelButton(interaction) {
  const isAccept = interaction.customId.startsWith('duel_accept_');
  const duelId = interaction.customId.replace(isAccept ? 'duel_accept_' : 'duel_decline_', '');

  // Get the pending challenge
  const challenge = duelManager.getPendingChallenge(interaction.message.id);
  if (!challenge) {
    return interaction.reply({
      content: '❌ This challenge has expired or is no longer valid.',
      ephemeral: true,
    });
  }

  // Only the challenged user can accept/decline
  if (interaction.user.id !== challenge.challengedId) {
    return interaction.reply({
      content: '❌ Only the challenged user can accept or decline this duel!',
      ephemeral: true,
    });
  }

  if (!isAccept) {
    // Declined
    duelManager.removePendingChallenge(interaction.message.id);
    
    const declineEmbed = new EmbedBuilder()
      .setColor('#808080')
      .setTitle('❌ Duel Declined')
      .setDescription(`<@${challenge.challengedId}> has declined the duel challenge.`)
      .setTimestamp();

    return interaction.update({
      content: null,
      embeds: [declineEmbed],
      components: [],
    });
  }

  // Accepted - start the duel!
  await interaction.deferUpdate();
  
  try {
    const startResult = await duelManager.startDuel(
      challenge.guildId,
      challenge.duelId,
      challenge.challengerId,
      challenge.challengedId,
      challenge.betAmount,
      economyManager
    );

    if (!startResult.success) {
      return interaction.editReply({
        content: `❌ Failed to start duel: ${startResult.error}`,
        embeds: [],
        components: [],
      });
    }

    const duel = startResult.duel;
    duelManager.removePendingChallenge(interaction.message.id);

    // Get user objects
    const player1User = await client.users.fetch(duel.player1.id);
    const player2User = await client.users.fetch(duel.player2.id);

    // === NEW: Simulate ENTIRE battle upfront and generate ONE GIF ===
    const battleResult = await duelManager.simulateFullBattle(duel, player1User, player2User);
    
    // Build the duel embed with the full battle GIF
    const battleEmbed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('⚔️ DUEL IN PROGRESS!')
      .setDescription(`**${player1User.username}** vs **${player2User.username}**\n\n💰 Pot: **${duel.totalPot}** coins`)
      .setTimestamp();
    
    // If we have a battle GIF, use it
    const files = battleResult.battleGif ? [battleResult.battleGif] : [];
    if (battleResult.battleGif) {
      battleEmbed.setImage(`attachment://battle_${duel.duelId}.gif`);
    }
    
    // Post the battle GIF - this plays through without updates!
        await interaction.editReply({
      content: `⚔️ **THE DUEL HAS BEGUN!** Watch the battle unfold...`,
      embeds: [battleEmbed],
      files: files,
      components: [],
    });
    
    // Calculate how long the GIF will play (roughly 200ms per attack frame * ~4 frames per attack * number of attacks)
    const gifPlayTime = Math.min(battleResult.allRounds.length * 800 + 2000, 15000); // Max 15 seconds
    
    // Wait for the GIF to finish playing, then show results
    setTimeout(async () => {
      try {
          // Award winner
        await duelManager.finishDuel(duel.duelId, battleResult.winner, economyManager);
        
        // Build result message
        let resultMessage = battleResult.winner === 'draw' 
          ? '🤝 **DUEL ENDED IN A DRAW!**'
          : `🏆 **${battleResult.winner === duel.player1.id ? player1User.username : player2User.username} WINS!**`;
        
        // Build result embed
        const resultEmbed = new EmbedBuilder()
          .setColor(battleResult.winner === 'draw' ? '#808080' : '#FFD700')
          .setTitle(battleResult.winner === 'draw' ? '🤝 Draw!' : '🏆 Victory!')
          .setDescription(resultMessage)
          .addFields(
            {
              name: `${player1User.username}`,
              value: `❤️ ${battleResult.finalP1Hp}/${duel.player1.maxHp} HP`,
              inline: true,
            },
            {
              name: `${player2User.username}`,
              value: `❤️ ${battleResult.finalP2Hp}/${duel.player2.maxHp} HP`,
              inline: true,
            },
            {
              name: '💰 Pot',
              value: `${duel.totalPot} coins`,
              inline: true,
            },
            {
              name: '📊 Rounds',
              value: `${battleResult.totalRounds}`,
              inline: true,
            }
          )
          .setTimestamp();
        
        // Keep the GIF in the result
        if (battleResult.battleGif) {
          resultEmbed.setImage(`attachment://battle_${duel.duelId}.gif`);
        }
            
            await interaction.editReply({
          content: resultMessage,
              embeds: [resultEmbed],
          files: [], // Don't re-upload, Discord caches it
            });
      } catch (error) {
        console.error('Error showing duel result:', error);
      }
    }, gifPlayTime);

  } catch (error) {
    console.error('Error in handleDuelButton:', error);
    return interaction.editReply({
      content: '❌ An error occurred while starting the duel.',
      embeds: [],
      components: [],
    });
  }
}

// ================================================================
// COMBAT XP COMMAND HANDLERS
// ================================================================

async function handleCombatRankCommand(interaction) {
  await interaction.deferReply();

  if (!combatXPManager) {
    return interaction.editReply({
      content: '❌ Combat XP system is not available.',
    });
  }

  const targetUser = interaction.options.getUser('user') || interaction.user;
  const guildId = interaction.guild.id;

  try {
    const stats = await combatXPManager.getCombatStats(guildId, targetUser.id);
    
    if (!stats) {
      return interaction.editReply({
        content: '❌ Failed to load combat stats.',
      });
    }

    // Debug: Log stats to see what we're getting
    console.log('[CombatRankCommand] Stats received:', {
      combat_xp: stats.combat_xp,
      combat_level: stats.combat_level,
      duels_won: stats.duels_won,
      duels_lost: stats.duels_lost
    });

    // Generate combat stats card
    try {
      const avatarURL = targetUser.displayAvatarURL({ 
        size: 256, 
        extension: 'png',
        forceStatic: true 
      });

      const combatCardBuffer = await combatCardGenerator.generateCombatCard({
        user: {
          username: targetUser.username,
          avatarURL: avatarURL
        },
        stats: stats,
        xpManager: combatXPManager
      });

      const attachment = new AttachmentBuilder(combatCardBuffer, { name: 'combat-stats.png' });

      // Send as standalone image without embed
      await interaction.editReply({ files: [attachment], embeds: [] });
    } catch (error) {
      console.error('[CombatRankCommand] Error generating combat card:', error);
      await interaction.editReply('❌ An error occurred while generating the combat stats card.');
    }
  } catch (error) {
    console.error('Error in handleCombatRankCommand:', error);
    return interaction.editReply({
      content: '❌ An error occurred while loading combat stats.',
    });
  }
}

async function handleCombatLeaderboardCommand(interaction) {
  await interaction.deferReply();

  if (!combatXPManager) {
    return interaction.editReply({
      content: '❌ Combat XP system is not available.',
    });
  }

  const guildId = interaction.guild.id;
  const page = interaction.options.getInteger('page') || 1;
  const perPage = 10;

  try {
    const leaderboard = await combatXPManager.getLeaderboard(guildId, perPage * page, 'combat_level');
    
    if (leaderboard.length === 0) {
      return interaction.editReply({
        content: '📊 No combat stats available yet. Start dueling to appear on the leaderboard!',
      });
    }

    // Paginate results
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const pageData = leaderboard.slice(startIndex, endIndex);

    if (pageData.length === 0) {
      return interaction.editReply({
        content: '❌ No more entries on that page.',
      });
    }

    const description = pageData
      .map((user, index) => {
        const rank = startIndex + index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const streak = user.current_win_streak > 0 ? ` 🔥${user.current_win_streak}` : '';
        return `${medal} **${user.username}**\n` +
               `└ Level ${user.combat_level} • ${user.combat_xp.toLocaleString()} XP • ${user.win_rate}% WR${streak}`;
      })
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`🏆 Combat Leaderboard - ${interaction.guild.name}`)
      .setDescription(description)
      .setFooter({ text: `Page ${page} • Keep dueling to climb the ranks!` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleCombatLeaderboardCommand:', error);
    return interaction.editReply({
      content: '❌ An error occurred while loading the leaderboard.',
    });
  }
}

// ================================================================
// CASINO COMMAND HANDLERS
// ================================================================

async function handleCasinoCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const guildId = interaction.guild.id;
  const username = interaction.user.username;

  const menu = await casinoManager.buildCasinoMenu(guildId, userId);

  await interaction.editReply({
    embeds: [menu.embed],
    components: menu.components,
  });
}

// ================================================================
// CASINO BUTTON HANDLERS
// ================================================================

async function handleCasinoButton(interaction, featureGate) {
  const customId = interaction.customId;
  
  // Coinflip button - check if already deferred (deferred in interactionCreate)
  if (customId.startsWith('casino_coinflip_') && !customId.startsWith('casino_coinflip_bet_') && !customId.startsWith('casino_coinflip_play_')) {
    // Already deferred in interactionCreate, just get variables
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;
  const username = interaction.user.username;
    
    // Check feature access after defer
    const hasFeature = await featureGate.checkFeature(guildId, 'casino');
    if (!hasFeature) {
      return interaction.editReply({
        content: '❌ Casino is a Premium feature. Upgrade to access this feature!',
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🪙 Coinflip')
      .setDescription('Choose your bet and prediction:')
      .addFields({
        name: '📝 Step 1',
        value: 'Click on a bet button below',
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_coinflip_bet_10_${userId}`)
        .setLabel('10 coins')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`casino_coinflip_bet_50_${userId}`)
        .setLabel('50 coins')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`casino_coinflip_bet_100_${userId}`)
        .setLabel('100 coins')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`casino_coinflip_bet_custom_${userId}`)
        .setLabel('Custom')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // Game selection buttons - show bet modal IMMEDIATELY (no async operations before modal!)
  // Feature check will be done in the modal submit handler
  // Note: Exclude blackjack hit/stand actions (they have gameId in customId)
  if (customId.startsWith('casino_dice_') || 
      customId.startsWith('casino_slots_') || 
      (customId.startsWith('casino_blackjack_') && 
       !customId.startsWith('casino_blackjack_hit_') && 
       !customId.startsWith('casino_blackjack_stand_'))) {
    const gameType = customId.split('_')[1];
    const modal = casinoManager.buildBetModal(gameType);
    return interaction.showModal(modal);
  }

  // Custom bet modal - show IMMEDIATELY (no async operations before modal!)
  // Feature check will be done in the modal submit handler
  if (customId.includes('_bet_custom_')) {
      const modal = new ModalBuilder()
        .setCustomId('casino_bet_coinflip')
        .setTitle('🪙 Coinflip - Custom Bet');

      const betInput = new TextInputBuilder()
        .setCustomId('bet_amount')
        .setLabel('Bet Amount')
        .setPlaceholder('Enter amount to bet...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

      modal.addComponents(new ActionRowBuilder().addComponents(betInput));
      return interaction.showModal(modal);
    }

  // Coinflip bet amount selected - already deferred in interactionCreate
  if (customId.startsWith('casino_coinflip_bet_') && !customId.includes('_bet_custom_')) {
    // Already deferred in interactionCreate, just get variables
    const userId = interaction.user.id;
    const parts = customId.split('_');
    const betAmount = parseInt(parts[3]);
    const targetUserId = parts[4];

    if (targetUserId !== userId) {
      return interaction.editReply({
        content: '❌ This is not your interaction.',
      });
    }

    // Store bet amount and show heads/tails choice
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🪙 Coinflip')
      .setDescription(`Bet: **${betAmount} coins**\n\nChoose your prediction:`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_coinflip_play_${betAmount}_heads_${userId}`)
        .setLabel('Heads')
        .setEmoji('🪙')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`casino_coinflip_play_${betAmount}_tails_${userId}`)
        .setLabel('Tails')
        .setEmoji('🪙')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // Coinflip play - already deferred in interactionCreate
  if (customId.startsWith('casino_coinflip_play_')) {
    // Already deferred in interactionCreate, just get variables
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const username = interaction.user.username;
    const parts = customId.split('_');
    const betAmount = parseInt(parts[3]);
    const choice = parts[4];
    const targetUserId = parts[5];

    if (targetUserId !== userId) {
      return interaction.editReply({
        content: '❌ This is not your interaction.',
      });
    }

    // Show "Flipping..." embed first
    const loadingEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🪙 Flipping Coin...')
      .setDescription('The coin is spinning!')
      .addFields({
        name: '💰 Bet Amount',
        value: `${economyManager.formatCoins(betAmount)} coins`,
        inline: true,
      },
      {
        name: '🎯 Your Choice',
        value: choice.toUpperCase(),
        inline: true,
      })
      .setTimestamp();

    try {
    await interaction.editReply({ embeds: [loadingEmbed] });
    } catch (error) {
      console.error('❌ Error showing loading embed:', error);
    }

    // First, validate bet and balance (but don't execute yet)
    const config = await casinoManager.getCasinoConfig(guildId);
    if (!config || !config.coinflip_enabled) {
      return interaction.editReply({
        content: `❌ Coinflip is disabled`,
      });
    }

    if (betAmount < config.min_bet || betAmount > config.max_bet) {
      return interaction.editReply({
        content: `❌ Bet must be between ${config.min_bet.toLocaleString()} and ${config.max_bet.toLocaleString()} coins`,
      });
    }

    const userEconomy = await economyManager.getUserEconomy(guildId, userId, username);
    if (!userEconomy || BigInt(userEconomy.balance) < BigInt(betAmount)) {
      return interaction.editReply({
        content: `❌ Insufficient balance`,
      });
    }

    // Calculate result (without executing - no balance update yet)
    const calculatedResult = casinoManager.calculateCoinflipResult(guildId, userId, username, betAmount, choice);
    console.log(`🎲 Calculated coinflip result: ${calculatedResult.coinResult} (choice: ${choice}, won: ${calculatedResult.won})`);

    // Now generate the GIF with the calculated result (this takes time, so "Flipping..." will be visible)
    // Add timeout to prevent hanging
    let gifBuffer = null;
    let coinflipGif = null;
    console.log(`🔍 coinflipGenerator exists: ${!!casinoManager.coinflipGenerator}`);
    if (casinoManager.coinflipGenerator) {
      try {
        console.log(`🎬 Generating coinflip GIF for ${username} (${choice} -> ${calculatedResult.coinResult})`);
        
        // Add timeout (10 seconds max for GIF generation)
        const gifPromise = casinoManager.coinflipGenerator.generateCoinflipGif({
          playerName: username,
          playerChoice: choice,
          result: calculatedResult.coinResult,
          betAmount,
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('GIF generation timeout (10s)')), 10000)
        );
        
        gifBuffer = await Promise.race([gifPromise, timeoutPromise]);
        
        console.log(`🔍 GIF buffer received: type=${typeof gifBuffer}, isBuffer=${Buffer.isBuffer(gifBuffer)}, length=${gifBuffer?.length || 0}`);
        
        // Additional validation
        if (!gifBuffer) {
          console.error('❌ GIF buffer is null or undefined');
        } else if (!Buffer.isBuffer(gifBuffer)) {
          console.error(`❌ GIF buffer is not a Buffer, type: ${typeof gifBuffer}`);
        } else if (gifBuffer.length === 0) {
          console.error('❌ GIF buffer is empty (0 bytes)');
        }
        if (gifBuffer && Buffer.isBuffer(gifBuffer) && gifBuffer.length > 0) {
          console.log(`✅ Coinflip GIF generated: ${gifBuffer.length} bytes`);
          // Debug: Check GIF header (should start with GIF89a or GIF87a)
          const header = gifBuffer.slice(0, 6).toString('ascii');
          console.log(`🔍 GIF header: ${header} (expected: GIF89a or GIF87a)`);
          if (header.startsWith('GIF')) {
            // Create AttachmentBuilder immediately after validation
            coinflipGif = new AttachmentBuilder(gifBuffer, {
              name: 'coinflip.gif',
              description: 'Coinflip animation',
            });
            console.log(`✅ AttachmentBuilder created for coinflip GIF`);
          } else {
            console.error('❌ Invalid GIF format - header does not start with GIF');
            console.error(`   First 20 bytes: ${gifBuffer.slice(0, 20).toString('hex')}`);
            gifBuffer = null; // Don't use invalid GIF
          }
        } else {
          console.warn('⚠️ Coinflip GIF generation returned empty or invalid buffer');
          if (gifBuffer) {
            console.warn(`   Type: ${typeof gifBuffer}, IsBuffer: ${Buffer.isBuffer(gifBuffer)}, Length: ${gifBuffer?.length || 0}`);
          }
        }
      } catch (error) {
        console.error('❌ Error generating coinflip GIF:', error);
        console.error('   Error message:', error.message);
        console.error('   Stack:', error.stack);
        gifBuffer = null; // Ensure it's null on error
        coinflipGif = null;
        // Continue - show result without GIF
      }
    } else {
      console.warn('⚠️ casinoManager.coinflipGenerator is not initialized!');
      console.warn(`   casinoManager exists: ${!!casinoManager}`);
      console.warn(`   casinoManager.coinflipGenerator: ${casinoManager?.coinflipGenerator ? 'exists' : 'missing'}`);
    }

    // NOW execute the coinflip with the predetermined result (update balance, log, etc.)
    let coinflipResult;
    try {
      coinflipResult = await casinoManager.executeCoinflip(guildId, userId, username, betAmount, choice, {
        coinResult: calculatedResult.coinResult
      });
      
      if (!coinflipResult.success) {
        return interaction.editReply({
          content: `❌ ${coinflipResult.error}`,
        });
      }
    } catch (error) {
      console.error('❌ Error executing coinflip:', error);
      return interaction.editReply({
        content: `❌ Error: ${error.message}`,
      });
    }

    // STEP 1: Show GIF with "Flipping..." embed (NO result text yet)
    // GIF duration: ~3.5 seconds (50 frames × 70ms = 3500ms)
    const gifDuration = 4000; // 4 seconds to be safe
    
    try {
      if (coinflipGif && gifBuffer) {
        const header = gifBuffer.slice(0, 6).toString('ascii');
        if (header.startsWith('GIF')) {
          console.log(`✅ Showing coinflip GIF with "Flipping..." embed: ${gifBuffer.length} bytes`);
          
          // Create embed with GIF but NO result text - just "Flipping..."
          const flippingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🪙 Flipping Coin...')
            .setDescription('The coin is spinning!')
            .addFields({
              name: '💰 Bet Amount',
              value: `${economyManager.formatCoins(betAmount)} coins`,
              inline: true,
            },
            {
              name: '🎯 Your Choice',
              value: choice.toUpperCase(),
              inline: true,
            })
            .setTimestamp();
          
          flippingEmbed.setImage('attachment://coinflip.gif');
          
          // Show GIF with "Flipping..." embed
          await interaction.editReply({ 
            content: null,
            embeds: [flippingEmbed], 
            components: [],
            files: [coinflipGif]
          });
          console.log(`✅ Coinflip GIF shown, waiting ${gifDuration}ms for animation...`);
          
          // Wait for GIF animation to complete
          await new Promise(resolve => setTimeout(resolve, gifDuration));
          
          console.log(`✅ GIF animation complete, showing result...`);
        } else {
          console.error(`❌ Invalid GIF header: ${header}`);
          // Skip GIF, show result immediately
        }
      } else {
        console.log(`⚠️ No valid GIF attachment, showing result immediately`);
        // Skip GIF, show result immediately
      }
    } catch (error) {
      console.error('❌ Error showing coinflip GIF:', error);
      // Continue to show result
    }

    // STEP 2: Now show the result embed (without GIF, since it already played)
    const matchIndicator = coinflipResult.result === 'win' ? '✅' : '❌';
    
    const embed = new EmbedBuilder()
      .setColor(coinflipResult.result === 'win' ? '#22C55E' : '#EF4444')
      .setTitle(coinflipResult.result === 'win' ? '🎉 You Won!' : '😢 You Lost')
      .setDescription(
        `🪙 **COINFLIP** 🪙\n\n` +
        `**Result:** ${coinflipResult.coinResult.toUpperCase()}\n` +
        `**Your Choice:** ${coinflipResult.choice.toUpperCase()}\n` +
        `${matchIndicator} ${coinflipResult.result === 'win' ? '**MATCH!**' : '**NO MATCH**'}`
      )
      .addFields(
        {
          name: '💰 Bet Amount',
          value: `${economyManager.formatCoins(betAmount)} coins`,
          inline: true,
        },
        {
          name: coinflipResult.result === 'win' ? '🎁 Win Amount' : '💸 Loss',
          value: coinflipResult.result === 'win'
            ? `+${economyManager.formatCoins(coinflipResult.netResult)} coins`
            : `-${economyManager.formatCoins(Math.abs(coinflipResult.netResult))} coins`,
          inline: true,
        }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_coinflip_${userId}`)
        .setLabel('Play Again')
        .setStyle(ButtonStyle.Primary)
    );

    // Show result embed (without GIF, since it already played)
    try {
      await interaction.editReply({ 
        content: null,
        embeds: [embed], 
        components: [row]
      });
      console.log(`✅ Coinflip result shown after GIF animation`);
    } catch (error) {
      console.error('❌ Error sending coinflip result to Discord:', error);
      console.error('   Error code:', error.code);
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
      
      // Last resort: try to send a simple message
      try {
        await interaction.editReply({ 
          content: `🪙 **Result:** ${coinflipResult.coinResult.toUpperCase()} | **Your Choice:** ${coinflipResult.choice.toUpperCase()} | ${coinflipResult.result === 'win' ? '✅ WIN!' : '❌ LOSS'}`,
          embeds: [],
          components: []
        });
      } catch (finalError) {
        console.error('❌ Complete failure to send coinflip result:', finalError);
      }
    }
  }

  // Blackjack buttons (hit, stand) - update the existing message
  // MUST be checked BEFORE deferReply to avoid interaction already replied error
  if (customId.startsWith('casino_blackjack_hit_') || customId.startsWith('casino_blackjack_stand_')) {
    // Use deferUpdate() to update the existing message instead of creating a new reply
    await interaction.deferUpdate();
    
    const parts = customId.split('_');
    const action = parts[2];
    const gameId = parts.slice(3).join('_');

    if (action === 'hit') {
      const result = await casinoManager.hitBlackjack(gameId);

      if (!result.success) {
        return interaction.editReply({
          content: `❌ ${result.error}`,
          components: [],
        });
      }

      if (result.bust) {
        const playerCardsDisplay = result.playerCards.map(card => 
          `${casinoManager.getCardEmoji(card)} ${casinoManager.formatCardValue(card)}`
        ).join(' ');
        
        const embed = new EmbedBuilder()
          .setColor('#EF4444')
          .setTitle('💥 Bust!')
          .setDescription(
            `\`\`\`\n` +
            `🃏 BLACKJACK 🃏\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `\n` +
            `  YOUR HAND\n` +
            `  ${playerCardsDisplay}\n` +
            `  Value: **${result.playerValue}** ❌\n` +
            `\n` +
            `  💥 BUST! You Lost!\n` +
            `\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `\`\`\``
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`casino_blackjack_${userId}`)
            .setLabel('Play Again')
            .setStyle(ButtonStyle.Primary)
        );
        
        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      // Update game state - show new hand
      const game = casinoManager.activeGames.get(gameId);
      const playerCardsDisplay = result.playerCards.map(card => 
        `${casinoManager.getCardEmoji(card)} ${casinoManager.formatCardValue(card)}`
      ).join(' ');
      const dealerCardDisplay = `${casinoManager.getCardEmoji(game.dealerCards[0])} ${casinoManager.formatCardValue(game.dealerCards[0])}`;
      
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🃏 Blackjack')
        .setDescription(
          `\`\`\`\n` +
          `🃏 BLACKJACK 🃏\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `\n` +
          `  YOUR HAND\n` +
          `  ${playerCardsDisplay}\n` +
          `  Value: **${result.playerValue}**\n` +
          `\n` +
          `  DEALER HAND\n` +
          `  ${dealerCardDisplay} 🂠 ?\n` +
          `  Value: **${game.dealerCards[0]}**\n` +
          `\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `\`\`\``
        )
        .addFields({
          name: '💰 Bet Amount',
          value: `${economyManager.formatCoins(game.betAmount)} coins`,
          inline: true,
        })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`casino_blackjack_hit_${gameId}`)
          .setLabel('Hit')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`casino_blackjack_stand_${gameId}`)
          .setLabel('Stand')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (action === 'stand') {
      try {
        const result = await casinoManager.standBlackjack(gameId);

        if (!result.success) {
          return interaction.editReply({
            content: `❌ ${result.error}`,
            components: [],
          });
        }

        const playerCardsDisplay = result.playerCards.map(card => 
          `${casinoManager.getCardEmoji(card)} ${casinoManager.formatCardValue(card)}`
        ).join(' ');
        const dealerCardsDisplay = result.dealerCards.map(card => 
          `${casinoManager.getCardEmoji(card)} ${casinoManager.formatCardValue(card)}`
        ).join(' ');
        
        const embed = new EmbedBuilder()
          .setColor(result.result === 'win' ? '#22C55E' : result.result === 'draw' ? '#FFA500' : '#EF4444')
          .setTitle(
            result.result === 'win'
              ? '🎉 You Won!'
              : result.result === 'draw'
              ? '🤝 Push!'
              : '😢 You Lost'
          )
          .setDescription(
            `\`\`\`\n` +
            `🃏 BLACKJACK 🃏\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `\n` +
            `  YOUR HAND\n` +
            `  ${playerCardsDisplay}\n` +
            `  Value: **${result.playerValue}**\n` +
            `\n` +
            `  DEALER HAND\n` +
            `  ${dealerCardsDisplay}\n` +
            `  Value: **${result.dealerValue}**\n` +
            `\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `\`\`\``
          )
          .addFields(
            {
              name: '💰 Bet Amount',
              value: `${economyManager.formatCoins(result.betAmount)} coins`,
              inline: true,
            },
            {
              name: result.result === 'win' ? '🎁 Win Amount' : result.result === 'draw' ? '↩️ Returned' : '💸 Loss',
              value:
                result.result === 'win'
                  ? `+${economyManager.formatCoins(result.netResult)} coins`
                  : result.result === 'draw'
                  ? `${economyManager.formatCoins(result.betAmount)} coins`
                  : `-${economyManager.formatCoins(result.netResult)} coins`,
              inline: true,
            }
          )
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`casino_blackjack_${userId}`)
            .setLabel('Play Again')
            .setStyle(ButtonStyle.Primary)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      } catch (error) {
        console.error('Error in standBlackjack handler:', error);
        return interaction.editReply({
          content: `❌ An error occurred: ${error.message}`,
          components: [],
        });
      }
    }
  }

  // All other handlers need deferReply
  await interaction.deferReply({ ephemeral: true });

  // Casino menu buttons
  if (customId === `casino_stats_${userId}`) {
    const stats = await casinoManager.getUserStats(guildId, userId);
    
    if (!stats) {
      return interaction.editReply({
        content: '❌ You have no casino statistics yet.',
      });
    }

    const totalProfit = BigInt(stats.total_won) - BigInt(stats.total_lost);
    const winRate = stats.total_games > 0 
      ? ((stats.total_won / stats.total_bet) * 100).toFixed(1)
      : '0.0';

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📊 Casino Statistics')
      .setThumbnail(avatarUrl)
      .addFields(
        {
          name: '🎮 Total Games',
          value: stats.total_games.toString(),
          inline: true,
        },
        {
          name: '💰 Total Wagered',
          value: economyManager.formatCoins(stats.total_bet),
          inline: true,
        },
        {
          name: '📈 Total Won',
          value: economyManager.formatCoins(stats.total_won),
          inline: true,
        },
        {
          name: '📉 Total Lost',
          value: economyManager.formatCoins(stats.total_lost),
          inline: true,
        },
        {
          name: '💵 Net Profit/Loss',
          value: `${totalProfit >= 0 ? '+' : ''}${economyManager.formatCoins(totalProfit)}`,
          inline: true,
        },
        {
          name: '🎯 Win Rate',
          value: `${winRate}%`,
          inline: true,
        },
        {
          name: '🏆 Biggest Win',
          value: economyManager.formatCoins(stats.biggest_win),
          inline: true,
        },
        {
          name: '💔 Biggest Loss',
          value: economyManager.formatCoins(stats.biggest_loss),
          inline: true,
        }
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  if (customId === `casino_leaderboard_${guildId}`) {
    const leaderboard = await casinoManager.getLeaderboard(guildId, 10);

    if (leaderboard.length === 0) {
      return interaction.editReply({
        content: '❌ No casino statistics available yet.',
      });
    }

    const leaderboardText = leaderboard
      .map((entry, index) => {
        const profit = BigInt(entry.total_won) - BigInt(entry.total_lost);
        return `${index + 1}. <@${entry.user_id}> - ${economyManager.formatCoins(entry.total_won)} won (${profit >= 0 ? '+' : ''}${economyManager.formatCoins(profit)})`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 Casino Leaderboard')
      .setDescription(leaderboardText)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
}

// ================================================================
// STOCK MARKET COMMAND HANDLERS
// ================================================================

async function handleStocksCommand(interaction) {
  await interaction.deferReply({ ephemeral: false });

  if (!stockMarketManager || !economyManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const stocks = await stockMarketManager.getStocks(guildId);

  if (stocks.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('📈 Stock Market')
      .setDescription('❌ No stocks available yet.\n\nAdministrators can add stocks in the dashboard.')
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  const stocksList = stocks.map((stock, index) => {
    const change = parseFloat(stock.current_price) - parseFloat(stock.base_price);
    const changePercent = ((change / parseFloat(stock.base_price)) * 100).toFixed(2);
    const emoji = change >= 0 ? '📈' : '📉';
    const sign = change >= 0 ? '+' : '';

    return `${emoji} **${stock.emoji || '📊'} ${stock.symbol}** - ${stock.name}\n` +
           `   Price: **${parseFloat(stock.current_price).toFixed(2)}** coins\n` +
           `   Change: ${sign}${changePercent}% (${sign}${change.toFixed(2)})\n` +
           `   Volatility: ${stock.volatility}%\n`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('📈 Stock Market - All Stocks')
    .setDescription(stocksList)
    .setFooter({ text: 'Use /stock <symbol> to view details • Use /stockbuy to invest' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockCommand(interaction) {
  await interaction.deferReply({ ephemeral: false });

  if (!stockMarketManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const symbol = interaction.options.getString('symbol').toUpperCase();

  const stock = await stockMarketManager.getStock(guildId, symbol);

  if (!stock || stock.status !== 'active') {
    return interaction.editReply({ 
      content: `❌ Stock "${symbol}" not found or not available. Use /stocks to see all available stocks.` 
    });
  }

  const change = parseFloat(stock.current_price) - parseFloat(stock.base_price);
  const changePercent = ((change / parseFloat(stock.base_price)) * 100).toFixed(2);
  const sign = change >= 0 ? '+' : '';
  const color = change >= 0 ? '#00FF00' : '#FF0000';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${stock.emoji || '📊'} ${stock.symbol} - ${stock.name}`)
    .setDescription(stock.description || 'No description available')
    .addFields(
      {
        name: '💰 Current Price',
        value: `${parseFloat(stock.current_price).toFixed(2)} coins`,
        inline: true,
      },
      {
        name: '📊 Base Price',
        value: `${parseFloat(stock.base_price).toFixed(2)} coins`,
        inline: true,
      },
      {
        name: '📈 Price Change',
        value: `${sign}${changePercent}% (${sign}${change.toFixed(2)})`,
        inline: true,
      },
      {
        name: '⚡ Volatility',
        value: `${stock.volatility}%`,
        inline: true,
      },
      {
        name: '📦 Available Shares',
        value: `${stock.available_shares.toLocaleString()} / ${stock.total_shares.toLocaleString()}`,
        inline: true,
      },
      {
        name: '💎 Status',
        value: stock.status.charAt(0).toUpperCase() + stock.status.slice(1),
        inline: true,
      }
    )
    .setFooter({ text: `IPO Date: ${new Date(stock.ipo_date).toLocaleDateString()}` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockBuyCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!stockMarketManager || !economyManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const symbol = interaction.options.getString('symbol').toUpperCase();
  const shares = interaction.options.getInteger('shares');

  const result = await stockMarketManager.buyStock(guildId, userId, symbol, shares, economyManager);

  if (!result.success) {
    return interaction.editReply({ content: `❌ ${result.error}` });
  }

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ Stock Purchase Successful')
    .setDescription(`You bought **${shares} shares** of **${result.stock.symbol}**`)
    .addFields(
      {
        name: '💰 Price per Share',
        value: `${parseFloat(result.stock.current_price).toFixed(2)} coins`,
        inline: true,
      },
      {
        name: '💵 Total Cost',
        value: `${economyManager.formatCoins(Math.floor(result.total_cost))} coins`,
        inline: true,
      },
      {
        name: '💸 Transaction Fee',
        value: `${economyManager.formatCoins(Math.floor(result.fee))} coins`,
        inline: true,
      },
      {
        name: '📦 Total Shares Owned',
        value: `${result.shares} shares`,
        inline: true,
      },
      {
        name: '💰 New Balance',
        value: `${economyManager.formatCoins(result.new_balance)} coins`,
        inline: true,
      }
    )
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockSellCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!stockMarketManager || !economyManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const symbol = interaction.options.getString('symbol').toUpperCase();
  const shares = interaction.options.getInteger('shares');

  const result = await stockMarketManager.sellStock(guildId, userId, symbol, shares, economyManager);

  if (!result.success) {
    return interaction.editReply({ content: `❌ ${result.error}` });
  }

  const color = result.profit_loss >= 0 ? '#00FF00' : '#FF0000';
  const profitEmoji = result.profit_loss >= 0 ? '📈' : '📉';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('✅ Stock Sale Successful')
    .setDescription(`You sold **${shares} shares** of **${result.stock.symbol}**`)
    .addFields(
      {
        name: '💰 Price per Share',
        value: `${parseFloat(result.stock.current_price).toFixed(2)} coins`,
        inline: true,
      },
      {
        name: '💵 Proceeds',
        value: `${economyManager.formatCoins(Math.floor(result.proceeds))} coins`,
        inline: true,
      },
      {
        name: '💸 Transaction Fee',
        value: `${economyManager.formatCoins(Math.floor(result.fee))} coins`,
        inline: true,
      },
      {
        name: `${profitEmoji} Profit/Loss`,
        value: `${result.profit_loss >= 0 ? '+' : ''}${economyManager.formatCoins(Math.floor(result.profit_loss))} coins (${result.profit_loss_percent >= 0 ? '+' : ''}${result.profit_loss_percent.toFixed(2)}%)`,
        inline: true,
      },
      {
        name: '📦 Shares Remaining',
        value: `${result.shares_remaining} shares`,
        inline: true,
      },
      {
        name: '💰 New Balance',
        value: `${economyManager.formatCoins(result.new_balance)} coins`,
        inline: true,
      }
    )
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handlePortfolioCommand(interaction) {
  await interaction.deferReply({ ephemeral: false });

  if (!stockMarketManager || !economyManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;

  const portfolio = await stockMarketManager.getPortfolio(guildId, userId);
  const portfolioValue = await stockMarketManager.getPortfolioValue(guildId, userId);

  if (portfolio.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('💼 Stock Portfolio')
      .setDescription(`**${targetUser.username}** has no stock holdings yet.\n\nUse /stocks to view available stocks and /stockbuy to start investing!`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  const holdingsList = portfolio.map((holding, index) => {
    const stock = holding.stock;
    const profitEmoji = holding.profit_loss >= 0 ? '📈' : '📉';
    const sign = holding.profit_loss >= 0 ? '+' : '';

    return `${index + 1}. **${stock.emoji || '📊'} ${stock.symbol}** - ${stock.name}\n` +
           `   Shares: ${holding.shares_owned} • Avg Price: ${parseFloat(holding.average_buy_price).toFixed(2)}\n` +
           `   Current Value: **${economyManager.formatCoins(Math.floor(holding.current_value))}** coins\n` +
           `   ${profitEmoji} P/L: ${sign}${economyManager.formatCoins(Math.floor(holding.profit_loss))} (${sign}${holding.profit_loss_percent.toFixed(2)}%)\n`;
  }).join('\n');

  const color = portfolioValue.total_profit_loss >= 0 ? '#00FF00' : '#FF0000';
  const totalEmoji = portfolioValue.total_profit_loss >= 0 ? '📈' : '📉';
  const totalSign = portfolioValue.total_profit_loss >= 0 ? '+' : '';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`💼 Stock Portfolio - ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .setDescription(holdingsList)
    .addFields(
      {
        name: '💰 Total Portfolio Value',
        value: `${economyManager.formatCoins(Math.floor(portfolioValue.total_value))} coins`,
        inline: true,
      },
      {
        name: '💵 Total Invested',
        value: `${economyManager.formatCoins(Math.floor(portfolioValue.total_invested))} coins`,
        inline: true,
      },
      {
        name: `${totalEmoji} Total Profit/Loss`,
        value: `${totalSign}${economyManager.formatCoins(Math.floor(portfolioValue.total_profit_loss))} coins\n(${totalSign}${portfolioValue.total_profit_loss_percent.toFixed(2)}%)`,
        inline: true,
      }
    )
    .setFooter({ text: `${portfolioValue.holdings_count} holding(s)` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockHistoryCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!stockMarketManager || !economyManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const limit = interaction.options.getInteger('limit') || 20;

  const history = await stockMarketManager.getTransactionHistory(guildId, userId, limit);

  if (history.length === 0) {
    return interaction.editReply({ 
      content: '📜 You have no stock transactions yet. Start trading with /stockbuy!' 
    });
  }

  const historyList = history.slice(0, 20).map((tx, index) => {
    const stock = tx.stock;
    const type = tx.transaction_type === 'buy' ? '💰 Buy' : '💸 Sell';
    const date = new Date(tx.created_at).toLocaleDateString();

    let line = `${index + 1}. ${type} - **${stock?.symbol || 'N/A'}**\n`;
    line += `   ${tx.shares} shares @ ${parseFloat(tx.price_per_share).toFixed(2)} coins\n`;
    line += `   Total: ${economyManager.formatCoins(Math.floor(parseFloat(tx.total_cost)))} coins\n`;
    
    if (tx.transaction_type === 'sell' && tx.profit_loss !== null) {
      const profitEmoji = parseFloat(tx.profit_loss) >= 0 ? '📈' : '📉';
      const sign = parseFloat(tx.profit_loss) >= 0 ? '+' : '';
      line += `   ${profitEmoji} P/L: ${sign}${economyManager.formatCoins(Math.floor(parseFloat(tx.profit_loss)))} (${sign}${parseFloat(tx.profit_loss_percentage).toFixed(2)}%)\n`;
    }
    
    line += `   ${date}\n`;
    return line;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('📜 Stock Transaction History')
    .setDescription(historyList.length > 2000 ? historyList.substring(0, 1950) + '...' : historyList)
    .setFooter({ text: `Showing last ${Math.min(limit, history.length)} transactions` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockLeaderboardCommand(interaction) {
  await interaction.deferReply({ ephemeral: false });

  if (!stockMarketManager || !economyManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const leaderboard = await stockMarketManager.getMarketLeaderboard(guildId, 10);

  if (leaderboard.length === 0) {
    return interaction.editReply({ 
      content: '🏆 No portfolios found yet. Start trading to appear on the leaderboard!' 
    });
  }

  const leaderboardText = leaderboard
    .map((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${medal} <@${entry.user_id}> - **${economyManager.formatCoins(Math.floor(entry.total_value))} coins**\n`;
    })
    .join('');

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 Stock Market Leaderboard')
    .setDescription(leaderboardText)
    .setFooter({ text: 'Ranked by total portfolio value' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockOrderCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!stockMarketManager || !economyManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const orderType = interaction.options.getString('type');
  const symbol = interaction.options.getString('symbol').toUpperCase();
  const shares = interaction.options.getInteger('shares');
  const targetPrice = interaction.options.getNumber('target_price');
  const expiresStr = interaction.options.getString('expires');

  let expiresAt = null;
  if (expiresStr) {
    const hours = expiresStr.match(/(\d+)h/i)?.[1];
    const days = expiresStr.match(/(\d+)d/i)?.[1];
    if (hours) {
      expiresAt = new Date(Date.now() + parseInt(hours) * 60 * 60 * 1000);
    } else if (days) {
      expiresAt = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000);
    }
  }

  const result = await stockMarketManager.createLimitOrder(
    guildId,
    userId,
    symbol,
    orderType,
    shares,
    targetPrice,
    expiresAt
  );

  if (!result.success) {
    return interaction.editReply({ content: `❌ ${result.error}` });
  }

  const orderTypeNames = {
    'limit_buy': 'Limit Buy',
    'limit_sell': 'Limit Sell',
    'stop_loss': 'Stop Loss',
    'stop_profit': 'Stop Profit'
  };

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ Order Created')
    .setDescription(`**${orderTypeNames[orderType]}** order for **${symbol}**`)
    .addFields(
      {
        name: '📦 Shares',
        value: shares.toString(),
        inline: true,
      },
      {
        name: '💰 Target Price',
        value: `${targetPrice.toFixed(2)} coins`,
        inline: true,
      },
      {
        name: '⏰ Expires',
        value: expiresAt ? new Date(expiresAt).toLocaleString('en-US') : 'Never',
        inline: true,
      }
    )
    .setFooter({ text: `Order ID: ${result.order.id.slice(0, 8)}...` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockOrdersCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!stockMarketManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const orders = await stockMarketManager.getUserOrders(guildId, userId, 'pending');

  if (orders.length === 0) {
    return interaction.editReply({ 
      content: '📋 You have no pending orders. Use /stockorder to create one!' 
    });
  }

  const ordersList = orders.map((order, index) => {
    const stock = order.stock;
    const orderTypeNames = {
      'limit_buy': '📈 Limit Buy',
      'limit_sell': '📉 Limit Sell',
      'stop_loss': '🛑 Stop Loss',
      'stop_profit': '🎯 Stop Profit'
    };

    let line = `${index + 1}. ${orderTypeNames[order.order_type] || order.order_type} - **${stock?.symbol || 'N/A'}**\n`;
    line += `   ${order.shares} shares @ ${parseFloat(order.target_price).toFixed(2)} coins\n`;
    line += `   Current: ${parseFloat(stock?.current_price || 0).toFixed(2)} coins\n`;
    if (order.expires_at) {
      line += `   Expires: ${new Date(order.expires_at).toLocaleString('en-US')}\n`;
    }
    line += `   ID: \`${order.id.slice(0, 8)}...\`\n`;
    return line;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('📋 Your Pending Orders')
    .setDescription(ordersList.length > 2000 ? ordersList.substring(0, 1950) + '...' : ordersList)
    .setFooter({ text: `${orders.length} pending order(s)` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockCancelOrderCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!stockMarketManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const orderId = interaction.options.getString('order_id');

  const result = await stockMarketManager.cancelOrder(guildId, userId, orderId);

  if (!result.success) {
    return interaction.editReply({ content: `❌ ${result.error || 'Failed to cancel order'}` });
  }

  return interaction.editReply({ 
    content: '✅ Order cancelled successfully.' 
  });
}

async function handleStockAlertCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!stockMarketManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const symbol = interaction.options.getString('symbol').toUpperCase();
  const alertType = interaction.options.getString('type');
  const targetPrice = interaction.options.getNumber('target_price');

  const result = await stockMarketManager.createPriceAlert(
    guildId,
    userId,
    symbol,
    alertType,
    targetPrice,
    null
  );

  if (!result.success) {
    return interaction.editReply({ content: `❌ ${result.error}` });
  }

  const alertTypeNames = {
    'above': 'Price Above',
    'below': 'Price Below'
  };

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ Price Alert Created')
    .setDescription(`You will be notified when **${symbol}** reaches **${targetPrice.toFixed(2)} coins**`)
    .addFields(
      {
        name: '🔔 Alert Type',
        value: alertTypeNames[alertType] || alertType,
        inline: true,
      },
      {
        name: '💰 Target Price',
        value: `${targetPrice.toFixed(2)} coins`,
        inline: true,
      }
    )
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockAlertsCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!stockMarketManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;
  const alerts = await stockMarketManager.getUserPriceAlerts(guildId, userId);

  if (alerts.length === 0) {
    return interaction.editReply({ 
      content: '🔔 You have no active price alerts. Use /stockalert to create one!' 
    });
  }

  const alertsList = alerts.map((alert, index) => {
    const stock = alert.stock;
    const alertTypeNames = {
      'above': '📈 Above',
      'below': '📉 Below'
    };

    let line = `${index + 1}. **${stock?.symbol || 'N/A'}** - ${stock?.name || 'Unknown'}\n`;
    line += `   ${alertTypeNames[alert.alert_type] || alert.alert_type}: ${parseFloat(alert.target_price || 0).toFixed(2)} coins\n`;
    line += `   Current: ${parseFloat(stock?.current_price || 0).toFixed(2)} coins\n`;
    if (alert.notified) {
      line += `   ✅ Already notified\n`;
    }
    return line;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🔔 Your Price Alerts')
    .setDescription(alertsList.length > 2000 ? alertsList.substring(0, 1950) + '...' : alertsList)
    .setFooter({ text: `${alerts.length} active alert(s)` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleStockEventsCommand(interaction) {
  await interaction.deferReply({ ephemeral: false });

  if (!stockMarketManager) {
    return interaction.editReply({ content: '❌ Stock market system is not available.' });
  }

  const guildId = interaction.guild.id;
  const events = await stockMarketManager.getActiveMarketEvents(guildId);

  if (events.length === 0) {
    return interaction.editReply({ 
      content: '📰 No active market events at the moment.' 
    });
  }

  const eventsList = events.map((event, index) => {
    const stock = event.stock;
    const eventEmojis = {
      'ipo': '🚀',
      'crash': '💥',
      'boom': '📈',
      'split': '✂️',
      'dividend': '💰',
      'news': '📰'
    };

    let line = `${index + 1}. ${eventEmojis[event.event_type] || '📊'} **${event.title}**\n`;
    if (stock) {
      line += `   Stock: ${stock.emoji || '📊'} ${stock.symbol}\n`;
    }
    if (event.description) {
      line += `   ${event.description}\n`;
    }
    if (event.price_multiplier !== 1.0) {
      line += `   Price Impact: ${((event.price_multiplier - 1) * 100).toFixed(1)}%\n`;
    }
    if (event.price_change_percentage !== 0) {
      line += `   Price Change: ${event.price_change_percentage > 0 ? '+' : ''}${event.price_change_percentage}%\n`;
    }
    if (event.ends_at) {
      line += `   Ends: ${new Date(event.ends_at).toLocaleString('en-US')}\n`;
    }
    return line;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('📰 Active Market Events')
    .setDescription(eventsList.length > 2000 ? eventsList.substring(0, 1950) + '...' : eventsList)
    .setFooter({ text: `${events.length} active event(s)` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleCasinoBetModal(interaction) {
  // DEFER IMMEDIATELY - Discord gives only 3 seconds!
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to defer casino bet modal:', error.message);
    return; // Interaction expired
  }

  const customId = interaction.customId;
  const gameType = customId.replace('casino_bet_', '');
  const betAmountInput = interaction.fields.getTextInputValue('bet_amount');
  const betAmount = parseInt(betAmountInput);

  if (isNaN(betAmount) || betAmount <= 0) {
    return interaction.editReply({
      content: '❌ Invalid bet amount.',
    });
  }

  const userId = interaction.user.id;
  const guildId = interaction.guild.id;
  const username = interaction.user.username;
  const avatarUrl = interaction.user.displayAvatarURL();

  // Check feature access after defer
  const hasFeature = await featureGate.checkFeature(guildId, 'casino');
  if (!hasFeature) {
    return interaction.editReply({
      content: '❌ Casino is a Premium feature. Upgrade to access this feature!',
    });
  }

  if (gameType === 'dice') {
    console.log(`🎲 [Dice] Starting dice game for ${username}`);
    const result = await casinoManager.playDice(guildId, userId, username, betAmount);

    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }

    console.log(`🎲 [Dice] Game result: playerRoll=${result.playerRoll}, houseRoll=${result.houseRoll}, hasGif=${!!result.gifBuffer}`);

    // Check if we have a GIF to show
    let diceGif = null;
    if (result.gifBuffer && Buffer.isBuffer(result.gifBuffer) && result.gifBuffer.length > 0) {
      const header = result.gifBuffer.slice(0, 6).toString('ascii');
      if (header.startsWith('GIF')) {
        diceGif = new AttachmentBuilder(result.gifBuffer, {
          name: 'dice-roll.gif',
          description: 'Dice roll animation',
        });
        console.log(`✅ [Dice] GIF attachment created: ${result.gifBuffer.length} bytes`);
      }
    }

    // GIF animation duration (~3.5 seconds for longer roll)
    const gifDuration = 3500;

    if (diceGif) {
      // STEP 1: Show GIF with "Rolling..." embed
      const rollingEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎲 Rolling Dice...')
        .setDescription('The dice are tumbling!')
        .addFields({
          name: '💰 Bet Amount',
          value: `${economyManager.formatCoins(betAmount)} coins`,
          inline: true,
        })
        .setImage('attachment://dice-roll.gif')
        .setTimestamp();

      await interaction.editReply({
        content: null,
        embeds: [rollingEmbed],
        files: [diceGif],
        components: [],
      });

      // Wait for GIF to play
      await new Promise(resolve => setTimeout(resolve, gifDuration));
    }

    // STEP 2: Show result embed
    const playerDice = casinoManager.getDiceEmoji(result.playerRoll);
    const houseDice = casinoManager.getDiceEmoji(result.houseRoll);
    const comparison = result.playerRoll > result.houseRoll ? '>' : result.playerRoll < result.houseRoll ? '<' : '=';
    
    const embed = new EmbedBuilder()
      .setColor(result.result === 'win' ? '#22C55E' : result.result === 'draw' ? '#FFA500' : '#EF4444')
      .setTitle(
        result.result === 'win'
          ? '🎉 You Won!'
          : result.result === 'draw'
          ? '🤝 Draw - Push!'
          : '😢 You Lost'
      )
      .setDescription(
        `\`\`\`\n` +
        `🎲 DICE GAME 🎲\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `\n` +
        `  YOU     ${playerDice}  ${result.playerRoll}\n` +
        `           ${comparison}\n` +
        `  HOUSE   ${houseDice}  ${result.houseRoll}\n` +
        `\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `\`\`\``
      )
      .addFields(
        {
          name: '💰 Bet Amount',
          value: `${economyManager.formatCoins(betAmount)} coins`,
          inline: true,
        },
        {
          name: result.result === 'win' ? '🎁 Win Amount' : result.result === 'draw' ? '↩️ Returned' : '💸 Loss',
          value: result.result === 'win' 
            ? `+${economyManager.formatCoins(result.netResult)} coins`
            : result.result === 'draw'
            ? `${economyManager.formatCoins(betAmount)} coins`
            : `-${economyManager.formatCoins(result.netResult)} coins`,
          inline: true,
        }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_dice_${userId}`)
        .setLabel('🎲 Play Again')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.editReply({ 
      content: null,
      embeds: [embed], 
      files: [], // Remove GIF from result
      components: [row] 
    });
  }

  if (gameType === 'slots') {
    console.log(`🎰 [Slots] Starting slots game for ${username}`);
    const result = await casinoManager.playSlots(guildId, userId, username, betAmount);

    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }

    console.log(`🎰 [Slots] Game result: reels=${result.reels.join(',')}, hasGif=${!!result.gifBuffer}`);

    // Check if we have a GIF to show
    let slotsGif = null;
    if (result.gifBuffer && Buffer.isBuffer(result.gifBuffer) && result.gifBuffer.length > 0) {
      const header = result.gifBuffer.slice(0, 6).toString('ascii');
      if (header.startsWith('GIF')) {
        slotsGif = new AttachmentBuilder(result.gifBuffer, {
          name: 'slots-spin.gif',
          description: 'Slots spin animation',
        });
        console.log(`✅ [Slots] GIF attachment created: ${result.gifBuffer.length} bytes`);
      }
    }

    // GIF animation duration (~5 seconds for longer visibility)
    const gifDuration = 5000;

    if (slotsGif) {
      // STEP 1: Show GIF with "Spinning..." embed
      const spinningEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎰 Spinning...')
        .setDescription('The reels are spinning!')
        .addFields({
          name: '💰 Bet Amount',
          value: `${economyManager.formatCoins(betAmount)} coins`,
          inline: true,
        })
        .setImage('attachment://slots-spin.gif')
        .setTimestamp();

      await interaction.editReply({
        content: null,
        embeds: [spinningEmbed],
        files: [slotsGif],
        components: [],
      });

      // Wait for GIF to play
      await new Promise(resolve => setTimeout(resolve, gifDuration));
    }

    // STEP 2: Show result embed (3x3 grid)
    // reels is now [[row1, row2, row3], [row1, row2, row3], [row1, row2, row3]]
    const topRow = `${result.reels[0][0]} │ ${result.reels[1][0]} │ ${result.reels[2][0]}`;
    const middleRow = `${result.reels[0][1]} │ ${result.reels[1][1]} │ ${result.reels[2][1]}`;
    const bottomRow = `${result.reels[0][2]} │ ${result.reels[1][2]} │ ${result.reels[2][2]}`;
    
    let winText = '❌ No matching symbols';
    if (result.result === 'win' && result.winningLines) {
      const lineNames = result.winningLines.map(l => l.name).join(', ');
      winText = `✨ **${result.winningLines.length} winning line(s)**: ${lineNames}`;
    }
    
    const embed = new EmbedBuilder()
      .setColor(result.result === 'win' ? '#22C55E' : '#EF4444')
      .setTitle(result.result === 'win' ? `🎰 ${result.multiplier >= 10 ? 'JACKPOT!' : result.multiplier >= 5 ? 'BIG WIN!' : 'WIN!'}` : '🎰 No Win')
      .setDescription(
        `🎰 **SLOTS** 🎰\n\n` +
        `**${topRow}**\n` +
        `**${middleRow}**\n` +
        `**${bottomRow}**\n\n` +
        `${winText}`
      )
      .addFields(
        {
          name: '💰 Bet Amount',
          value: `${economyManager.formatCoins(betAmount)} coins`,
          inline: true,
        },
        ...(result.result === 'win' ? [{
          name: '✨ Multiplier',
          value: `**${result.multiplier}x**`,
          inline: true,
        }] : []),
        {
          name: result.result === 'win' ? '🎁 Win Amount' : '💸 Loss',
          value: result.result === 'win'
            ? `+${economyManager.formatCoins(result.netResult)} coins`
            : `-${economyManager.formatCoins(result.netResult)} coins`,
          inline: true,
        }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_slots_${userId}`)
        .setLabel('🎰 Spin Again')
        .setStyle(ButtonStyle.Primary)
    );

    // Keep GIF in result if it exists
    if (slotsGif) {
      embed.setImage('attachment://slots-spin.gif');
      return interaction.editReply({ 
        content: null,
        embeds: [embed], 
        files: [slotsGif], // Keep GIF in result
        components: [row] 
      });
    }

    return interaction.editReply({ 
      content: null,
      embeds: [embed], 
      files: [],
      components: [row] 
    });
  }

  if (gameType === 'blackjack') {
    const result = await casinoManager.playBlackjack(guildId, userId, username, betAmount);

    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }

    const playerCardsDisplay = result.playerCards.map(card => 
      `${casinoManager.getCardEmoji(card)} ${casinoManager.formatCardValue(card)}`
    ).join(' ');
    const dealerCardDisplay = `${casinoManager.getCardEmoji(result.dealerCards[0])} ${casinoManager.formatCardValue(result.dealerCards[0])}`;
    
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🃏 Blackjack')
      .setDescription(
        `\`\`\`\n` +
        `🃏 BLACKJACK 🃏\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `\n` +
        `  YOUR HAND\n` +
        `  ${playerCardsDisplay}\n` +
        `  Value: **${result.playerValue}**\n` +
        `\n` +
        `  DEALER HAND\n` +
        `  ${dealerCardDisplay} 🂠 ?\n` +
        `  Value: **${result.dealerValue}**\n` +
        `\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `\`\`\``
      )
      .addFields({
        name: '💰 Bet Amount',
        value: `${economyManager.formatCoins(betAmount)} coins`,
        inline: true,
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_blackjack_hit_${result.gameId}`)
        .setLabel('Hit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`casino_blackjack_stand_${result.gameId}`)
        .setLabel('Stand')
        .setStyle(ButtonStyle.Success)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  if (gameType === 'coinflip') {
    // Validate bet amount against config
    const config = await casinoManager.getCasinoConfig(guildId);
    if (!config || !config.coinflip_enabled) {
      return interaction.editReply({
        content: '❌ Coinflip is disabled',
      });
    }

    if (betAmount < config.min_bet || betAmount > config.max_bet) {
      return interaction.editReply({
        content: `❌ Bet must be between ${config.min_bet.toLocaleString()} and ${config.max_bet.toLocaleString()} coins`,
      });
    }

    // Check balance
    const userEconomy = await economyManager.getUserEconomy(guildId, userId, username);
    if (!userEconomy || BigInt(userEconomy.balance) < BigInt(betAmount)) {
      return interaction.editReply({
        content: '❌ Insufficient balance',
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🪙 Coinflip')
      .setDescription(`Bet: **${betAmount} coins**\n\nChoose your prediction:`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_coinflip_play_${betAmount}_heads_${userId}`)
        .setLabel('Heads')
        .setEmoji('🪙')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`casino_coinflip_play_${betAmount}_tails_${userId}`)
        .setLabel('Tails')
        .setEmoji('🪙')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
  }
}

// ================================================================
// REGISTER SLASH COMMANDS
// ================================================================
async function registerCommands(clientInstance) {
  const commandBuilders = [
    // Leveling
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Check your rank')
      .addUserOption((option) => option.setName('user').setDescription('User to check').setRequired(false)),
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('View detailed user statistics')
      .addUserOption((option) => option.setName('user').setDescription('User to check stats for').setRequired(false)),

    new SlashCommandBuilder().setName('leaderboard').setDescription('View the server leaderboard'),

    new SlashCommandBuilder()
      .setName('setxp')
      .setDescription('[Admin] Set a user\'s XP')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('xp')
          .setDescription('Amount of XP')
          .setRequired(true)
      ),

    // Moderation
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('[Mod] Warn a user')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User to warn')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('[Mod] Mute a user')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User to mute')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('duration')
          .setDescription('Duration in minutes (empty = permanent)')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('[Mod] Unmute a user')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User to unmute')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('[Mod] Kick a user')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User to kick')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('[Mod] Ban a user')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User to ban')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('duration')
          .setDescription('Duration in minutes (empty = permanent)')
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('case')
      .setDescription('[Mod] View a moderation case')
      .addIntegerOption((option) =>
        option
          .setName('id')
          .setDescription('Case ID')
          .setRequired(true)
      ),

    // Custom Commands
    new SlashCommandBuilder()
      .setName('customcommand')
      .setDescription('[Admin] Manage custom commands')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('Add a custom command')
          .addStringOption((option) =>
            option
              .setName('trigger')
              .setDescription('Command name')
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('response')
              .setDescription('Command response')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('remove')
          .setDescription('Remove a custom command')
          .addStringOption((option) =>
            option
              .setName('trigger')
              .setDescription('Command name')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('View all custom commands')
      ),

    // Birthdays
    new SlashCommandBuilder()
      .setName('birthday')
      .setDescription('Manage your birthday')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('set')
          .setDescription('Set your birthday')
          .addStringOption((option) =>
            option
              .setName('datum')
              .setDescription('Birthday (DD-MM or YYYY-MM-DD)')
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('timezone')
              .setDescription('Optional: custom timezone (e.g. Europe/Amsterdam)')
              .setRequired(false)
          )
          .addBooleanOption((option) =>
            option
              .setName('private')
              .setDescription('Make birthday announcement private (no announcement)')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('clear')
          .setDescription('Remove your birthday')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('info')
          .setDescription('View a birthday')
          .addUserOption((option) =>
            option
              .setName('user')
              .setDescription('User to view')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('upcoming')
          .setDescription('View upcoming birthdays')
          .addIntegerOption((option) =>
            option
              .setName('aantal')
              .setDescription('Number of birthdays to show (default 5)')
              .setRequired(false)
          )
      ),

    new SlashCommandBuilder()
      .setName('birthdayconfig')
      .setDescription('[Admin] Configure birthday announcements')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('enable')
          .setDescription('Enable or disable birthdays')
          .addBooleanOption((option) =>
            option
              .setName('status')
              .setDescription('true = on, false = off')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('channel')
          .setDescription('Set the announcement channel')
          .addChannelOption((option) =>
            option
              .setName('kanaal')
              .setDescription('Text channel for birthdays')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('role')
          .setDescription('Set the birthday role')
          .addRoleOption((option) =>
            option
              .setName('rol')
              .setDescription('Role to assign to birthday users')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('message')
          .setDescription('Customize the birthday message')
          .addStringOption((option) =>
            option
              .setName('template')
              .setDescription('Use {user}, {username}, {age}, {server}')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('pingrole')
          .setDescription('Ping the birthday role in announcements')
          .addBooleanOption((option) =>
            option
              .setName('status')
              .setDescription('true = ping, false = no ping')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('time')
          .setDescription('Set the announcement time (HH:MM)')
          .addStringOption((option) =>
            option
              .setName('uur')
              .setDescription('Time in 24-hour format, e.g. 09:00')
              .setRequired(true)
          )
      ),

    // Feedback queue
    new SlashCommandBuilder()
      .setName('feedback')
      .setDescription('[Mod] Manage the feedback queue')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('setup')
          .setDescription('Place the queue message in a channel')
          .addChannelOption((option) =>
            option
              .setName('kanaal')
              .setDescription('Channel for the feedback queue')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true)
          )
          .addRoleOption((option) =>
            option
              .setName('rol')
              .setDescription('Optional: role required to submit')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('next')
          .setDescription('Claim the next submission in the queue')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('complete')
          .setDescription('Mark a submission as completed')
          .addStringOption((option) =>
            option
              .setName('submission_id')
              .setDescription('ID of the submission')
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('notitie')
              .setDescription('Optional moderator note')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('queue')
          .setDescription('View the queue')
      ),

    // Ticket System
    new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Manage support tickets')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('create')
          .setDescription('Create a new support ticket')
          .addStringOption((option) =>
            option
              .setName('onderwerp')
              .setDescription('What do you need help with?')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('close')
          .setDescription('[Mod] Close this ticket')
          .addStringOption((option) =>
            option
              .setName('reden')
              .setDescription('Reason for closing')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('[Mod] Add a user to this ticket')
          .addUserOption((option) =>
            option
              .setName('user')
              .setDescription('User to add')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('remove')
          .setDescription('[Mod] Remove a user from this ticket')
          .addUserOption((option) =>
            option
              .setName('user')
              .setDescription('User to remove')
              .setRequired(true)
          )
      ),

    new SlashCommandBuilder()
      .setName('ticket-setup')
      .setDescription('[Admin] Configure the ticket system')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName('ticket-stats')
      .setDescription('[Admin] View ticket statistics')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
      .setName('ticket-panel')
      .setDescription('[Admin] Place a ticket panel in a channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addChannelOption((option) =>
        option
          .setName('kanaal')
          .setDescription('Channel to place the panel in (leave empty for current channel)')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      ),

    // Utility
    new SlashCommandBuilder().setName('help').setDescription('View all commands'),

    new SlashCommandBuilder().setName('serverinfo').setDescription('View server information'),

    new SlashCommandBuilder().setName('dashboard').setDescription('Get your ComCraft dashboard link'),

    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('[Admin] Manage giveaways')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('start')
          .setDescription('Start a new giveaway')
          .addStringOption((option) =>
            option
              .setName('prize')
              .setDescription('What prize can people win?')
              .setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName('duration')
              .setDescription('Duration in minutes (1 - 10080)')
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(10080)
          )
          .addIntegerOption((option) =>
            option
              .setName('winners')
              .setDescription('Number of winners (default 1)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(25)
          )
          .addChannelOption((option) =>
            option
              .setName('channel')
              .setDescription('Channel to post the giveaway in')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)
          )
          .addRoleOption((option) =>
            option
              .setName('role')
              .setDescription('Required role to participate')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('end')
          .setDescription('End an active giveaway')
          .addStringOption((option) =>
            option
              .setName('id')
              .setDescription('Giveaway ID (see start-response)')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('reroll')
          .setDescription('Reroll winners for a giveaway')
          .addStringOption((option) =>
            option
              .setName('id')
              .setDescription('Giveaway ID (see start-response)')
              .setRequired(true)
          )
      ),

    new SlashCommandBuilder()
      .setName('askai')
      .setDescription('Ask the ComCraft AI assistant a question')
      .addStringOption((option) =>
        option
          .setName('prompt')
          .setDescription('Your question for the AI')
          .setRequired(true)
      ),

    // ============ ECONOMY COMMANDS ============
    new SlashCommandBuilder()
      .setName('balance')
      .setDescription('💰 View your balance'),

    new SlashCommandBuilder()
      .setName('daily')
      .setDescription('🎁 Claim your daily reward'),

    new SlashCommandBuilder()
      .setName('pay')
      .setDescription('💸 Pay someone coins')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User to pay')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('amount')
          .setDescription('Hoeveel coins')
          .setRequired(true)
          .setMinValue(1)
      ),

    new SlashCommandBuilder()
      .setName('convert')
      .setDescription('🔄 Convert XP to coins')
      .addIntegerOption((option) =>
        option
          .setName('amount')
          .setDescription('Amount of XP to convert')
          .setRequired(true)
          .setMinValue(1)
      ),

    new SlashCommandBuilder()
      .setName('challenge')
      .setDescription('⚔️ Challenge someone to a duel for coins')
      .addUserOption((option) =>
        option
          .setName('opponent')
          .setDescription('The user to challenge')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('bet')
          .setDescription('Amount of coins to bet')
          .setRequired(true)
          .setMinValue(10)
      ),

    // ============ COMBAT XP COMMANDS ============
    new SlashCommandBuilder()
      .setName('combatrank')
      .setDescription('⚔️ View combat level and PvP statistics')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User to check (defaults to yourself)')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('combatleaderboard')
      .setDescription('🏆 View top fighters in this server')
      .addIntegerOption((option) =>
        option
          .setName('page')
          .setDescription('Page number to view')
          .setRequired(false)
          .setMinValue(1)
      ),

    // ============ SHOP COMMANDS ============
    new SlashCommandBuilder()
      .setName('shop')
      .setDescription('🛒 Browse the combat item shop')
      .addStringOption((option) =>
        option
          .setName('filter')
          .setDescription('Filter by item type')
          .setRequired(false)
          .addChoices(
            { name: '⚔️ Weapons', value: 'weapon' },
            { name: '🛡️ Armor', value: 'armor' },
            { name: '🧪 Consumables', value: 'consumable' }
          )
      ),

    new SlashCommandBuilder()
      .setName('buy')
      .setDescription('💰 Buy an item from the shop')
      .addStringOption((option) =>
        option
          .setName('item')
          .setDescription('Item name or ID')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('quantity')
          .setDescription('Quantity to buy (default: 1)')
          .setRequired(false)
          .setMinValue(1)
      ),

    new SlashCommandBuilder()
      .setName('sell')
      .setDescription('💸 Sell an item from your inventory')
      .addStringOption((option) =>
        option
          .setName('item')
          .setDescription('Item name or ID')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('quantity')
          .setDescription('Quantity to sell (default: 1)')
          .setRequired(false)
          .setMinValue(1)
      ),

    new SlashCommandBuilder()
      .setName('inventory')
      .setDescription('🎒 View your combat inventory')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User to view (defaults to yourself)')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('equip')
      .setDescription('⚔️ Equip a weapon or armor (interactive menu)'),

    new SlashCommandBuilder()
      .setName('unequip')
      .setDescription('📤 Unequip an item')
      .addStringOption((option) =>
        option
          .setName('slot')
          .setDescription('Slot to unequip')
          .setRequired(true)
          .addChoices(
            { name: '⚔️ Weapon', value: 'weapon' },
            { name: '🛡️ Armor', value: 'armor' }
          )
      ),

    // ============ CASINO COMMANDS ============
    new SlashCommandBuilder()
      .setName('casino')
      .setDescription('🎰 Open het casino menu'),

    // ============ STOCK MARKET COMMANDS ============
    new SlashCommandBuilder()
      .setName('stocks')
      .setDescription('📈 View all available stocks'),

    new SlashCommandBuilder()
      .setName('stock')
      .setDescription('📊 View details of a specific stock')
      .addStringOption((option) =>
        option
          .setName('symbol')
          .setDescription('Stock symbol (e.g., COMCRAFT)')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('stockbuy')
      .setDescription('💰 Buy stocks')
      .addStringOption((option) =>
        option
          .setName('symbol')
          .setDescription('Stock symbol to buy')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('shares')
          .setDescription('Number of shares to buy')
          .setRequired(true)
          .setMinValue(1)
      ),

    new SlashCommandBuilder()
      .setName('stocksell')
      .setDescription('💸 Sell stocks')
      .addStringOption((option) =>
        option
          .setName('symbol')
          .setDescription('Stock symbol to sell')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('shares')
          .setDescription('Number of shares to sell')
          .setRequired(true)
          .setMinValue(1)
      ),

    new SlashCommandBuilder()
      .setName('portfolio')
      .setDescription('💼 View your stock portfolio')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('User to check portfolio for')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('stockhistory')
      .setDescription('📜 View your stock transaction history')
      .addIntegerOption((option) =>
        option
          .setName('limit')
          .setDescription('Number of transactions to show')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(50)
      ),

    new SlashCommandBuilder()
      .setName('stockleaderboard')
      .setDescription('🏆 View stock market leaderboard (richest portfolios)'),

    new SlashCommandBuilder()
      .setName('stockorder')
      .setDescription('📋 Create a limit order or stop-loss order')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Order type')
          .setRequired(true)
          .addChoices(
            { name: 'Limit Buy', value: 'limit_buy' },
            { name: 'Limit Sell', value: 'limit_sell' },
            { name: 'Stop Loss', value: 'stop_loss' },
            { name: 'Stop Profit', value: 'stop_profit' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('symbol')
          .setDescription('Stock symbol')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('shares')
          .setDescription('Number of shares')
          .setRequired(true)
          .setMinValue(1)
      )
      .addNumberOption((option) =>
        option
          .setName('target_price')
          .setDescription('Target price to execute order')
          .setRequired(true)
          .setMinValue(0.01)
      )
      .addStringOption((option) =>
        option
          .setName('expires')
          .setDescription('Expiration (e.g., 24h, 7d, 30d)')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('stockorders')
      .setDescription('📋 View your pending orders'),

    new SlashCommandBuilder()
      .setName('stockcancelorder')
      .setDescription('❌ Cancel a pending order')
      .addStringOption((option) =>
        option
          .setName('order_id')
          .setDescription('Order ID to cancel')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('stockalert')
      .setDescription('🔔 Create a price alert')
      .addStringOption((option) =>
        option
          .setName('symbol')
          .setDescription('Stock symbol')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Alert type')
          .setRequired(true)
          .addChoices(
            { name: 'Price Above', value: 'above' },
            { name: 'Price Below', value: 'below' }
          )
      )
      .addNumberOption((option) =>
        option
          .setName('target_price')
          .setDescription('Target price to trigger alert')
          .setRequired(true)
          .setMinValue(0.01)
      ),

    new SlashCommandBuilder()
      .setName('stockalerts')
      .setDescription('🔔 View your active price alerts'),

    new SlashCommandBuilder()
      .setName('stockevents')
      .setDescription('📰 View active market events'),
  ];

  // Music commands removed - now handled by separate music-bot
  // Music commands are no longer registered in main bot

  // Add vote kick commands
  if (global.voteKickCommands) {
    const voteKickCmds = global.voteKickCommands.getCommands();
    commandBuilders.push(...voteKickCmds);
    console.log(`✅ Added ${voteKickCmds.length} vote kick commands to registration`);
  }

  // Add cam-only voice commands
  if (camOnlyVoiceCommands && Array.isArray(camOnlyVoiceCommands)) {
    commandBuilders.push(...camOnlyVoiceCommands);
    console.log(`✅ Added ${camOnlyVoiceCommands.length} cam-only voice commands to registration`);
  }

  const commands = commandBuilders.map((command) => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  // Use the actual bot's application ID, not a hardcoded one
  if (!clientInstance || !clientInstance.user) {
    console.error('❌ [Commands] Cannot register commands: client instance or user not available');
    return;
  }

  const applicationId = clientInstance.user.id;
  console.log(`📝 [Commands] Registering commands for application: ${applicationId}`);

  try {
    console.log('📝 Registering global slash commands...');

    await rest.put(
      Routes.applicationCommands(applicationId),
      { body: commands }
    );

    console.log('✅ Global commands registered');

    if (clientInstance) {
      const guilds = clientInstance.guilds.cache.map((guild) => guild.id);
      for (const guildId of guilds) {
        try {
          console.log(`📝 Registering guild commands for ${guildId}...`);
          await rest.put(
            Routes.applicationGuildCommands(applicationId, guildId),
            { body: commands }
          );
          console.log(`✅ Guild commands registered for ${guildId}`);
        } catch (guildError) {
          // Don't crash on guild command registration errors
          if (guildError.code === 20012 || guildError.status === 403) {
            console.warn(`⚠️ [Commands] Not authorized to register commands for guild ${guildId}. Skipping.`);
          } else {
            console.error(`❌ [Commands] Failed to register commands for guild ${guildId}:`, guildError.message);
          }
        }
      }
    }
  } catch (error) {
    // Don't crash the bot on command registration errors
    if (error.code === 20012 || error.status === 403) {
      console.warn('⚠️ [Commands] Not authorized to register global commands for this application.');
      console.warn('   This usually means the bot token does not have the "applications.commands" scope.');
      console.warn('   The bot will continue running, but slash commands may not be available.');
      console.warn('   Consider using guild commands instead (which are already being registered).');
    } else {
      console.error('❌ [Commands] Error registering commands:', error.message);
      console.error('   Error code:', error.code);
      console.error('   Error status:', error.status);
      console.warn('   The bot will continue running, but slash commands may not be available.');
    }
    // Don't throw or exit - let the bot continue running
  }
}

// ================================================================
// DISCORD MANAGEMENT API (for webapp)
// ================================================================

const app = express();
app.use(bodyParser.json());

// Health check endpoint (must be before authentication middleware)
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
    },
    discord: {
      status: client.ws.status,
      ping: client.ws.ping,
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      shard: client.shard ? {
        id: client.shard.ids[0],
        total: client.shard.count,
      } : null,
    },
    customBots: customBotManager ? {
      count: customBotManager.customBots.size,
      active: Array.from(customBotManager.customBots.values()).filter(bot => bot.isReady()).length,
    } : null,
    timestamp: new Date().toISOString(),
  };

  // Check database connection
  try {
    await configManager.getGuildConfig('health-check-test');
    health.database = 'connected';
  } catch (error) {
    // If it's a "not found" error, that's fine - database is working
    if (error.code === 'PGRST116' || error.message?.includes('not found')) {
      health.database = 'connected';
    } else {
      health.database = 'error';
      health.status = 'unhealthy';
    }
  }

  // Check Redis connection (if available)
  if (process.env.REDIS_URL) {
    try {
      const getRedisCache = require('./modules/comcraft/cache/redis-cache');
      const redisCache = getRedisCache();
      if (redisCache && redisCache.isConnected) {
        health.redis = 'connected';
      } else {
        health.redis = 'disconnected';
        // Redis is optional, so don't mark as unhealthy
      }
    } catch (error) {
      health.redis = 'error';
      // Redis is optional, so don't mark as unhealthy
    }
  }

  // Determine status code
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Security middleware
const validateInternalRequest = (req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.use(validateInternalRequest);

registerAiRoutes({
  app,
  aiService,
  featureGate,
  aiStore,
  buildKnowledgeContext,
});

// Get guild roles
app.get('/api/discord/:guildId/roles', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      // Try to find custom bot for this guild
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Roles API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.getRoles(guildId);
    
  res.json(result);
  } catch (error) {
    console.error('Error in roles API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Create role
app.post('/api/discord/:guildId/roles', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Roles API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.createRole(guildId, req.body);
    
  res.json(result);
  } catch (error) {
    console.error('Error in create role API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Edit role
app.patch('/api/discord/:guildId/roles/:roleId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Roles API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.editRole(guildId, req.params.roleId, req.body);
    
  res.json(result);
  } catch (error) {
    console.error('Error in edit role API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Delete role
app.delete('/api/discord/:guildId/roles/:roleId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Roles API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.deleteRole(guildId, req.params.roleId, req.body?.deletedBy);
    
  res.json(result);
  } catch (error) {
    console.error('Error in delete role API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Get guild channels
app.get('/api/discord/:guildId/channels', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      // Try to find custom bot for this guild
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Channels API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.getChannels(guildId);
    
  res.json(result);
  } catch (error) {
    console.error('Error in channels API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Get guild emojis
app.get('/api/discord/:guildId/emojis', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Emojis API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.getEmojis(guildId);
    
  res.json(result);
  } catch (error) {
    console.error('Error in emojis API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Test welcome message
app.post('/api/welcome/test', async (req, res) => {
  try {
    const { guildId, config, testUserId } = req.body;

    if (!guildId || !config || !testUserId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      // Try to find custom bot for this guild
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Welcome Test] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found. Make sure the bot (main or custom) is in the server.' });
    }

    const user = await botClient.users.fetch(testUserId).catch(() => null);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create a test member object
    let member = guild.members.cache.get(testUserId);
    if (!member) {
      // Try to fetch the member
      try {
        member = await guild.members.fetch(testUserId);
      } catch (error) {
        // If member is not in guild, create a mock member object for testing
        member = {
          user: user,
          guild: guild,
          toString: () => `<@${user.id}>`
        };
      }
    }

    // Temporarily save the config to database for the test
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Save config temporarily
    await supabase
      .from('welcome_configs')
      .upsert({
        guild_id: guildId,
        ...config,
        updated_at: new Date().toISOString()
      });

    // Send test welcome message
    await welcomeHandler.sendWelcomeMessage(member, config);

    res.json({ success: true });
  } catch (error) {
    console.error('Error in welcome test API:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Send event announcement
app.post('/api/events/:eventId/announce', async (req, res) => {
  try {
    const { eventId } = req.params;
    const secret = req.headers['x-internal-secret'];

    if (secret !== process.env.INTERNAL_API_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get event from database (use configManager's supabase for consistency)
    const { data: event, error } = await configManager.supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(event.guild_id);
    let eventManager = global.eventManager;
    
    if (!guild && customBotManager) {
      // Try to find custom bot for this guild
      const customBot = customBotManager.customBots.get(event.guild_id);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(event.guild_id);
        // For custom bots, we need to get the event manager from the custom bot's context
        // For now, we'll create a temporary EventManager instance
        const EventManager = require('./modules/comcraft/events/manager');
        eventManager = new EventManager(customBot);
        console.log(`🤖 [Event Announce] Using custom bot for guild ${event.guild_id}`);
      }
    }

    if (!guild) {
      return res.status(404).json({ error: 'Guild not found. Make sure the bot (main or custom) is in the server.' });
    }

    if (!eventManager) {
      // Create EventManager if it doesn't exist
      const EventManager = require('./modules/comcraft/events/manager');
      eventManager = new EventManager(botClient);
    }

    // Send announcement
    const result = await eventManager.sendAnnouncement(event);

    if (result.success) {
      res.json({ success: true, messageId: result.messageId });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error in event announce API:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create channel
app.post('/api/discord/:guildId/channels', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Channels API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.createChannel(guildId, req.body);
    
  res.json(result);
  } catch (error) {
    console.error('Error in create channel API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Edit channel
app.patch('/api/discord/:guildId/channels/:channelId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Channels API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.editChannel(guildId, req.params.channelId, req.body);
    
  res.json(result);
  } catch (error) {
    console.error('Error in edit channel API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Delete channel
app.delete('/api/discord/:guildId/channels/:channelId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Channels API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.deleteChannel(guildId, req.params.channelId, req.body?.deletedBy);
    
  res.json(result);
  } catch (error) {
    console.error('Error in delete channel API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Quick setup wizards
app.post('/api/discord/:guildId/quick-setup/:type', async (req, res) => {
  try {
  const { guildId, type } = req.params;
  const { createdBy } = req.body;

    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Quick Setup API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);

  let result;
  switch (type) {
    case 'leveling':
        result = await manager.setupLevelingSystem(guildId, createdBy);
      break;
    case 'streaming':
        result = await manager.setupStreamingAlerts(guildId, createdBy);
      break;
    case 'moderation':
        result = await manager.setupModerationSystem(guildId, createdBy);
      break;
    case 'welcome':
        result = await manager.setupWelcomeSystem(guildId, createdBy);
      break;
    default:
      result = { success: false, error: 'Unknown setup type' };
  }

  res.json(result);
  } catch (error) {
    console.error('Error in quick-setup API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Check bot permissions
app.get('/api/discord/:guildId/permissions', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Permissions API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Use the appropriate DiscordManager for the bot client
    const DiscordManager = require('./modules/comcraft/discord-manager');
    const manager = new DiscordManager(botClient);
    const result = await manager.checkBotPermissions(guildId);
    
  res.json(result);
  } catch (error) {
    console.error('Error in permissions API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Post role menu to Discord
app.post('/api/autoroles/:menuId/post', async (req, res) => {
  try {
    // First, get the menu to find the guild ID
    const { data: menu } = await autoRolesManager.supabase
      .from('role_menus')
      .select('guild_id')
      .eq('id', req.params.menuId)
      .single();

    if (!menu) {
      return res.json({ success: false, error: 'Menu not found' });
    }

    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(menu.guild_id);
    
    if (!guild && customBotManager) {
      // Try to find custom bot for this guild
      const customBot = customBotManager.customBots.get(menu.guild_id);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(menu.guild_id);
        console.log(`🤖 [AutoRoles Post] Using custom bot for guild ${menu.guild_id}`);
      }
    }

    if (!guild) {
      return res.json({ success: false, error: 'Guild not found. Make sure the bot (main or custom) is in the server.' });
    }

    // Use the appropriate AutoRolesManager for the bot client
    const AutoRolesManager = require('./modules/comcraft/autoroles/manager');
    const manager = new AutoRolesManager(botClient);
    const result = await manager.postRoleMenu(req.params.menuId);
    
  res.json(result);
  } catch (error) {
    console.error('Error in autoroles post API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Update existing role menu in Discord
app.post('/api/autoroles/:menuId/update', async (req, res) => {
  try {
    // First, get the menu to find the guild ID
    const { data: menu } = await autoRolesManager.supabase
      .from('role_menus')
      .select('guild_id')
      .eq('id', req.params.menuId)
      .single();

    if (!menu) {
      return res.json({ success: false, error: 'Menu not found' });
    }

    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(menu.guild_id);
    
    if (!guild && customBotManager) {
      // Try to find custom bot for this guild
      const customBot = customBotManager.customBots.get(menu.guild_id);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(menu.guild_id);
        console.log(`🤖 [AutoRoles Update] Using custom bot for guild ${menu.guild_id}`);
      }
    }

    if (!guild) {
      return res.json({ success: false, error: 'Guild not found. Make sure the bot (main or custom) is in the server.' });
    }

    // Use the appropriate AutoRolesManager for the bot client
    const AutoRolesManager = require('./modules/comcraft/autoroles/manager');
    const manager = new AutoRolesManager(botClient);
    const result = await manager.updateRoleMenu(req.params.menuId);
    
  res.json(result);
  } catch (error) {
    console.error('Error in autoroles update API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

app.post('/api/feedback/:guildId/setup', async (req, res) => {
  try {
  const { guildId } = req.params;
  const { channelId, roleId, createdBy, createdByName } = req.body || {};

  const licenseActive = await featureGate.checkLicense(guildId);
  if (!licenseActive) {
    return res.status(403).json({ success: false, error: 'License inactive for this guild' });
  }

  const hasFeature = await featureGate.checkFeature(guildId, FEEDBACK_QUEUE_FEATURE);
  if (!hasFeature) {
    return res.status(403).json({ success: false, error: 'Feedback queue feature disabled for this guild' });
  }

  if (!channelId) {
    return res.status(400).json({ success: false, error: 'channelId is vereist' });
  }

    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Feedback Setup API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.status(404).json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Create feedback handlers with the appropriate client
    const FeedbackQueueManager = require('./modules/comcraft/feedback/queue-manager');
    const feedbackManagerForBot = new FeedbackQueueManager(botClient);
    const feedbackHandlersForBot = createFeedbackHandlers({ 
      client: botClient, 
      feedbackQueueManager: feedbackManagerForBot, 
      configManager 
    });

    const result = await feedbackHandlersForBot.setupFeedbackQueueMessage(
    guildId,
    channelId,
    roleId || null,
    createdBy || 'dashboard',
    createdByName || 'Dashboard'
  );

  if (!result.success) {
    return res.status(500).json(result);
  }

  res.json(result);
  } catch (error) {
    console.error('Error in feedback setup API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

app.post('/api/feedback/:guildId/submissions/:submissionId/complete', async (req, res) => {
  try {
  const { guildId, submissionId } = req.params;
  const { moderatorId, moderatorName, note } = req.body || {};

  const licenseActive = await featureGate.checkLicense(guildId);
  if (!licenseActive) {
    return res.status(403).json({ success: false, error: 'License inactive for this guild' });
  }

  const hasFeature = await featureGate.checkFeature(guildId, FEEDBACK_QUEUE_FEATURE);
  if (!hasFeature) {
    return res.status(403).json({ success: false, error: 'Feedback queue feature disabled for this guild' });
  }

    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Feedback Complete API] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.status(404).json({ 
        success: false, 
        error: 'Guild not found. Make sure the bot (main or custom) is in the server.' 
      });
    }

    // Create feedback handlers with the appropriate client
    const FeedbackQueueManager = require('./modules/comcraft/feedback/queue-manager');
    const feedbackManagerForBot = new FeedbackQueueManager(botClient);
    const feedbackHandlersForBot = createFeedbackHandlers({ 
      client: botClient, 
      feedbackQueueManager: feedbackManagerForBot, 
      configManager 
    });

    const result = await feedbackManagerForBot.completeSubmission(
    guildId,
    submissionId,
    moderatorId || 'dashboard',
    note || null
  );

  if (!result.success) {
    return res.status(400).json(result);
  }

    await feedbackHandlersForBot.notifyFeedbackCompletion(guildId, result.data, moderatorName || 'Dashboard');

  res.json({ success: true, submission: result.data });
  } catch (error) {
    console.error('Error in feedback complete API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// Post embed to Discord channel
app.post('/api/embeds/post', async (req, res) => {
  try {
    const { guildId, channelId, embed, isCapsule, embeds, components, content, mentionRoleId, pinMessage } = req.body;

    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    
    if (!guild && customBotManager) {
      // Try to find custom bot for this guild
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        console.log(`🤖 [Embed Post] Using custom bot for guild ${guildId}`);
      }
    }

    if (!guild) {
      return res.json({ success: false, error: 'Guild not found. Make sure the bot (main or custom) is in the server.' });
    }

    const licenseActive = await featureGate.checkLicense(guildId);
    if (!licenseActive) {
      return res.status(403).json({ success: false, error: 'License inactive for this guild' });
    }

    const embedsAllowed = await featureGate.checkFeature(guildId, EMBED_BUILDER_FEATURE);
    if (!embedsAllowed) {
      return res.status(403).json({ success: false, error: 'Embed builder feature disabled for this guild' });
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.json({ success: false, error: 'Channel not found or not text-based' });
    }

    // Handle Capsules (multiple embeds + components)
    if (isCapsule && embeds && Array.isArray(embeds)) {
      const CapsuleBuilder = require('./modules/comcraft/messaging/capsule-builder');
      const capsule = CapsuleBuilder.create();

      // Add content if provided
      if (content) {
        capsule.setContent(content);
      }

      // Add all embeds
      for (const embedData of embeds.slice(0, 10)) { // Max 10 embeds
        const embedOptions = {
          title: embedData.title,
          description: embedData.description,
          color: embedData.color,
          url: embedData.url,
          thumbnail: embedData.thumbnail?.url,
          image: embedData.image?.url,
          footer: embedData.footer ? {
            text: embedData.footer.text,
            icon_url: embedData.footer.icon_url
          } : undefined,
          author: embedData.author ? {
            name: embedData.author.name,
            icon_url: embedData.author.icon_url,
            url: embedData.author.url
          } : undefined,
          fields: embedData.fields || [],
          timestamp: embedData.timestamp ? new Date(embedData.timestamp) : undefined
        };

        // Convert color string to int if needed
        if (embedOptions.color && typeof embedOptions.color === 'string') {
          embedOptions.color = parseInt(embedOptions.color.replace('#', ''), 16);
        }

        capsule.addSection(embedOptions);
      }

      // Add components (buttons/select menus)
      if (components && Array.isArray(components)) {
        for (const componentRow of components.slice(0, 5)) { // Max 5 rows
          if (componentRow.type === 1 || !componentRow.type) { // ActionRow or raw array
            const buttons = [];
            const componentsInRow = componentRow.components || componentRow;
            
            for (const component of componentsInRow) {
              if (component.type === 2 || (!component.type && component.custom_id)) { // Button
                const buttonData = {
                  customId: component.custom_id || component.customId,
                  label: component.label,
                  style: component.style,
                  url: component.url,
                  disabled: component.disabled || false
                };
                
                // Handle emoji (can be object with name or just string)
                if (component.emoji) {
                  if (typeof component.emoji === 'object' && component.emoji.name) {
                    buttonData.emoji = component.emoji.name;
                  } else if (typeof component.emoji === 'string') {
                    buttonData.emoji = component.emoji;
                  }
                }
                
                buttons.push(buttonData);
              } else if (component.type === 3 || (!component.type && component.options)) { // Select Menu
                capsule.addSelectMenu({
                  customId: component.custom_id || component.customId,
                  placeholder: component.placeholder || 'Select an option...',
                  options: component.options || [],
                  minValues: component.min_values || component.minValues || 1,
                  maxValues: component.max_values || component.maxValues || 1,
                  disabled: component.disabled || false
                });
              }
            }
            if (buttons.length > 0) {
              capsule.addButtons(buttons);
            }
          }
        }
      }

      // Build and send capsule
      const payload = capsule.build();
      
      // Add role mention to content if provided
      if (mentionRoleId) {
        payload.content = (payload.content || '') + ` <@&${mentionRoleId}>`;
      }

      const message = await channel.send(payload);

      if (pinMessage) {
        try {
          await message.pin();
        } catch (err) {
          console.error('Failed to pin message:', err);
        }
      }

      console.log(`📦 Posted capsule (${embeds.length} embeds) to ${guild.name}/#${channel.name} (using ${botClient === client ? 'main' : 'custom'} bot)`);
      return res.json({ success: true, messageId: message.id });
    }

    // Handle regular embed (backward compatible)
    if (!embed) {
      return res.json({ success: false, error: 'Embed or capsule data required' });
    }

    // Validate that embed has at least title or description
    if (!embed.title && !embed.description && (!embed.fields || embed.fields.length === 0)) {
      return res.json({ success: false, error: 'Embed must have at least a title, description, or fields' });
    }

    let colorInt = 0x5865f2;
    if (embed.color) {
      colorInt = parseInt(embed.color.replace('#', ''), 16);
    }

    // Build embed object, only including non-empty fields
    const discordEmbed = {};
    
    if (embed.title) discordEmbed.title = embed.title;
    if (embed.description) discordEmbed.description = embed.description;
    if (embed.url) discordEmbed.url = embed.url;
    if (colorInt) discordEmbed.color = colorInt;
    
    // Handle thumbnail (can be object with url or just url string)
    if (embed.thumbnail) {
      if (typeof embed.thumbnail === 'object' && embed.thumbnail.url) {
        discordEmbed.thumbnail = { url: embed.thumbnail.url };
      } else if (typeof embed.thumbnail === 'string') {
        discordEmbed.thumbnail = { url: embed.thumbnail };
      }
    }
    
    // Handle image (can be object with url or just url string)
    if (embed.image) {
      if (typeof embed.image === 'object' && embed.image.url) {
        discordEmbed.image = { url: embed.image.url };
      } else if (typeof embed.image === 'string') {
        discordEmbed.image = { url: embed.image };
      }
    }
    
    // Handle footer
    if (embed.footer) {
      if (typeof embed.footer === 'object') {
        const footerObj = {};
        if (embed.footer.text) footerObj.text = embed.footer.text;
        if (embed.footer.icon_url) footerObj.icon_url = embed.footer.icon_url;
        if (Object.keys(footerObj).length > 0) {
          discordEmbed.footer = footerObj;
        }
      }
    }
    
    // Handle author
    if (embed.author) {
      if (typeof embed.author === 'object') {
        const authorObj = {};
        if (embed.author.name) authorObj.name = embed.author.name;
        if (embed.author.icon_url) authorObj.icon_url = embed.author.icon_url;
        if (embed.author.url) authorObj.url = embed.author.url;
        if (Object.keys(authorObj).length > 0) {
          discordEmbed.author = authorObj;
        }
      }
    }
    
    // Handle fields (must be array)
    if (embed.fields && Array.isArray(embed.fields) && embed.fields.length > 0) {
      // Filter out invalid fields and ensure required properties
      const validFields = embed.fields
        .filter(field => field && (field.name || field.value))
        .map(field => ({
          name: field.name || '\u200b', // Zero-width space if empty
          value: field.value || '\u200b',
          inline: field.inline === true
        }));
      
      if (validFields.length > 0) {
        discordEmbed.fields = validFields;
      }
    }
    
    // Handle timestamp
    if (embed.timestamp) {
      discordEmbed.timestamp = embed.timestamp;
    }

    // Handle components (buttons/action rows)
    let messageComponents = [];
    if (components && Array.isArray(components) && components.length > 0) {
      // Validate and convert components to Discord format
      for (const row of components) {
        if (row.type === 1 && row.components && Array.isArray(row.components)) {
          // ActionRow
          const actionRow = new ActionRowBuilder();
          
          for (const button of row.components) {
            if (button.type === 2) {
              // Button
              const buttonBuilder = new ButtonBuilder();
              
              if (button.style === 5) {
                // Link button
                if (button.url) {
                  buttonBuilder.setURL(button.url);
                  buttonBuilder.setStyle(ButtonStyle.Link);
                } else {
                  continue; // Skip invalid link button
                }
              } else {
                // Regular button
                if (!button.custom_id) {
                  continue; // Skip buttons without custom_id
                }
                
                const styleMap = {
                  1: ButtonStyle.Primary,
                  2: ButtonStyle.Secondary,
                  3: ButtonStyle.Success,
                  4: ButtonStyle.Danger
                };
                
                buttonBuilder
                  .setCustomId(button.custom_id)
                  .setStyle(styleMap[button.style] || ButtonStyle.Primary);
              }
              
              if (button.label) {
                buttonBuilder.setLabel(button.label);
              }
              
              if (button.emoji) {
                if (typeof button.emoji === 'string') {
                  buttonBuilder.setEmoji(button.emoji);
                } else if (button.emoji.name) {
                  buttonBuilder.setEmoji(button.emoji.name);
                }
              }
              
              if (button.disabled) {
                buttonBuilder.setDisabled(true);
              }
              
              actionRow.addComponents(buttonBuilder);
            }
          }
          
          if (actionRow.components.length > 0) {
            messageComponents.push(actionRow);
          }
        }
      }
    }

    let messageContent = content || '';
    if (mentionRoleId) {
      messageContent = (messageContent ? messageContent + ' ' : '') + `<@&${mentionRoleId}>`;
    }

    const message = await channel.send({
      content: messageContent || undefined,
      embeds: [discordEmbed],
      components: messageComponents.length > 0 ? messageComponents : undefined,
    });

    if (pinMessage) {
      try {
        await message.pin();
      } catch (err) {
        console.error('Failed to pin message:', err);
      }
    }

    console.log(`📝 Posted embed to ${guild.name}/#${channel.name} (using ${botClient === client ? 'main' : 'custom'} bot)`);
    res.json({ success: true, messageId: message.id });
  } catch (error) {
    console.error('Error posting embed/capsule:', error);
    res.json({ success: false, error: error.message });
  }
});


// NOTE: API server is now started in the 'ready' event handler (see above)
// This ensures all managers are initialized before the API becomes available

// ================================================================
// REACTION ROLES
// ================================================================
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Error fetching reaction:', error);
      return;
    }
  }

  if (!reaction.message.guildId || !(await ensureGuildLicense(reaction.message.guildId))) return;

  await autoRolesManager.handleReaction(reaction, user, 'add');
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      return;
    }
  }

  if (!reaction.message.guildId || !(await ensureGuildLicense(reaction.message.guildId))) return;

  await autoRolesManager.handleReaction(reaction, user, 'remove');
});

// ================================================================
// SHOP COMMAND HANDLERS
// ================================================================

/**
 * Show shop with available items
 */
async function handleShopCommand(interaction) {
  if (!itemManager) {
    return interaction.reply({
      content: '❌ Shop system is not available.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const filter = interaction.options.getString('filter');
  const items = await itemManager.getAvailableItems(interaction.guild.id, filter);

  if (!items || items.length === 0) {
    return interaction.editReply({
      content: '🛒 The shop is currently empty. Ask an administrator to add items!',
    });
  }

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🛒 Combat Item Shop')
    .setDescription('Select an item from the menu below to purchase!')
    .setTimestamp();

  // Group items by type
  const grouped = {
    weapon: [],
    armor: [],
    consumable: [],
  };

  for (const item of items) {
    const itemType = item.type || item.item_type;
    if (grouped[itemType]) {
      grouped[itemType].push(item);
    }
  }

  // Add fields for each type
  for (const [type, typeItems] of Object.entries(grouped)) {
    if (typeItems.length === 0) continue;

    const icon = type === 'weapon' ? '⚔️' : type === 'armor' ? '🛡️' : '🧪';
    const title = type === 'weapon' ? 'Weapons' : type === 'armor' ? 'Armor' : 'Consumables';

    const lines = typeItems.map((item) => {
      const stats = [];
      if (item.damage_bonus) stats.push(`+${item.damage_bonus}💥`);
      if (item.defense_bonus) stats.push(`+${item.defense_bonus}🛡️`);
      if (item.hp_bonus) stats.push(`+${item.hp_bonus}❤️`);
      const critBonus = item.crit_chance_bonus || item.crit_bonus;
      if (critBonus) stats.push(`+${critBonus}%🎯`);

      const statsStr = stats.length > 0 ? ` [${stats.join(' ')}]` : '';
      const stock = item.max_stock ? ` (${item.max_stock} in stock)` : '';

      return `**${item.name}** - ${economyManager.formatCoins(item.price)}${statsStr}${stock}`;
    });

    embed.addFields({ name: `${icon} ${title}`, value: lines.join('\n'), inline: false });
  }

  // Create select menu with items (max 25)
  const selectOptions = items.slice(0, 25).map((item) => {
    const itemType = item.type || item.item_type;
    const icon = itemType === 'weapon' ? '⚔️' : itemType === 'armor' ? '🛡️' : '🧪';
    const rarity = (item.rarity || 'common').toUpperCase();
    
    return {
      label: item.name.substring(0, 100),
      value: item.id,
      description: `${economyManager.formatCoins(item.price)} - ${rarity}`.substring(0, 100),
      emoji: icon,
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`shop_select_${interaction.user.id}`)
    .setPlaceholder('Choose an item to purchase...')
    .addOptions(selectOptions);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * Handle shop item selection from select menu
 */
async function handleShopItemSelect(interaction) {
  if (!itemManager || !economyManager) {
    return interaction.reply({
      content: '❌ Shop system is not available.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const itemId = interaction.values[0];
  const item = await itemManager.getItem(itemId);

  if (!item) {
    return interaction.editReply({
      content: '❌ This item no longer exists!',
    });
  }

  // Check user's balance
  const userEconomy = await economyManager.getUserEconomy(
    interaction.guild.id,
    interaction.user.id,
    interaction.user.username,
    interaction.user.displayAvatarURL()
  );

  const embed = new EmbedBuilder()
    .setColor(itemManager.getRarityColor(item.rarity))
    .setTitle(`${itemManager.getDefaultEmoji(item.type)} ${item.name}`)
    .setDescription(item.description || 'No description available.')
    .addFields(
      { name: '💰 Price', value: economyManager.formatCoins(item.price), inline: true },
      { name: '🏆 Rarity', value: (item.rarity || 'common').toUpperCase(), inline: true },
      { name: '💵 Your Balance', value: economyManager.formatCoins(userEconomy.balance), inline: true }
    );

  // Add stats if available
  const stats = [];
  if (item.damage_bonus) stats.push(`💥 **Damage:** +${item.damage_bonus}`);
  if (item.defense_bonus) stats.push(`🛡️ **Defense:** +${item.defense_bonus}`);
  if (item.hp_bonus) stats.push(`❤️ **HP:** +${item.hp_bonus}`);
  const critBonus = item.crit_chance_bonus || item.crit_bonus;
  if (critBonus) stats.push(`🎯 **Crit:** +${critBonus}%`);
  if (item.required_level && item.required_level > 1) {
    stats.push(`⭐ **Required Level:** ${item.required_level}`);
  }

  if (stats.length > 0) {
    embed.addFields({ name: '📊 Stats', value: stats.join('\n'), inline: false });
  }

  // Add stock info
  if (item.max_stock) {
    embed.addFields({ 
      name: '📦 Stock', 
      value: `${item.max_stock} available`, 
      inline: true 
    });
  }

  // Create buy buttons for different quantities
  const row = new ActionRowBuilder();

  // Only show buttons if user can afford at least 1
  if (userEconomy.balance >= item.price) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_buy_${itemId}_1_${interaction.user.id}`)
        .setLabel('Buy 1x')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛒')
    );

    // Show buy 5 if can afford
    if (userEconomy.balance >= item.price * 5) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_buy_${itemId}_5_${interaction.user.id}`)
          .setLabel('Buy 5x')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛒')
      );
    }

    // Show buy 10 if can afford
    if (userEconomy.balance >= item.price * 10) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_buy_${itemId}_10_${interaction.user.id}`)
          .setLabel('Buy 10x')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🛒')
      );
    }
  } else {
    embed.setFooter({ text: '❌ You don\'t have enough coins for this item!' });
  }

  const components = row.components.length > 0 ? [row] : [];

  await interaction.editReply({ embeds: [embed], components });
}

/**
 * Handle shop buy button click
 */
async function handleShopBuyButton(interaction) {
  if (!itemManager || !inventoryManager || !economyManager) {
    return interaction.reply({
      content: '❌ Shop system is not available.',
      ephemeral: true,
    });
  }

  // Parse button ID: shop_buy_${itemId}_${quantity}_${userId}
  const parts = interaction.customId.split('_');
  const itemId = parts[2];
  const quantity = parseInt(parts[3]);
  const userId = parts[4];

  // Verify user
  if (interaction.user.id !== userId) {
    return interaction.reply({
      content: '❌ This is not your shop session!',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const result = await inventoryManager.purchaseItem(
    interaction.guild.id,
    interaction.user.id,
    itemId,
    quantity,
    {
      username: interaction.user.username,
      avatar: interaction.user.displayAvatarURL(),
    }
  );

  if (!result.success) {
    return interaction.editReply({
      content: `❌ ${result.error}`,
    });
  }

  const item = result.item;
  const totalCost = result.totalCost;

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ Purchase Successful!')
    .setDescription(`You bought **${quantity}x ${item.name}** for ${economyManager.formatCoins(totalCost)}`)
    .setFooter({ text: `You now have ${result.newQuantity}x ${item.name} in your inventory` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle equip item selection from select menu
 */
async function handleEquipItemSelect(interaction) {
  if (!inventoryManager) {
    return interaction.reply({
      content: '❌ Inventory system is not available.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const itemId = interaction.values[0];

  const result = await inventoryManager.equipItem(
    interaction.guild.id,
    interaction.user.id,
    itemId
  );

  if (!result.success) {
    return interaction.editReply({
      content: `❌ ${result.error}`,
    });
  }

  const item = result.equipped;
  const icon = item.type === 'weapon' ? '⚔️' : '🛡️';

  // Build stats display
  const stats = [];
  if (item.damage_bonus) stats.push(`💥 **Damage:** +${item.damage_bonus}`);
  if (item.defense_bonus) stats.push(`🛡️ **Defense:** +${item.defense_bonus}`);
  if (item.hp_bonus) stats.push(`❤️ **HP:** +${item.hp_bonus}`);
  const critBonus = item.crit_chance_bonus || item.crit_bonus;
  if (critBonus) stats.push(`🎯 **Crit:** +${critBonus}%`);

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle(`${icon} Item Equipped!`)
    .setDescription(`You equipped **${item.name}**!`)
    .setTimestamp();

  if (stats.length > 0) {
    embed.addFields({ name: '📊 Stats', value: stats.join('\n'), inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Buy an item from the shop
 */
async function handleBuyCommand(interaction) {
  if (!itemManager || !inventoryManager || !economyManager) {
    return interaction.reply({
      content: '❌ Shop system is not available.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const itemName = interaction.options.getString('item', true);
  const quantity = interaction.options.getInteger('quantity') || 1;

  const result = await inventoryManager.purchaseItem(
    interaction.guild.id,
    interaction.user.id,
    itemName,
    quantity,
    {
      username: interaction.user.username,
      avatar: interaction.user.displayAvatarURL(),
    }
  );

  if (!result.success) {
    return interaction.editReply({
      content: `❌ ${result.error}`,
    });
  }

  const item = result.item;
  const totalCost = result.totalCost;

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('✅ Purchase Successful!')
    .setDescription(`You bought **${quantity}x ${item.name}** for ${economyManager.formatCoins(totalCost)}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Sell an item from inventory
 */
async function handleSellCommand(interaction) {
  if (!itemManager || !inventoryManager || !economyManager) {
    return interaction.reply({
      content: '❌ Inventory system is not available.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const itemName = interaction.options.getString('item', true);
  const quantity = interaction.options.getInteger('quantity') || 1;

  const result = await inventoryManager.sellItem(
    interaction.guild.id,
    interaction.user.id,
    itemName,
    quantity
  );

  if (!result.success) {
    return interaction.editReply({
      content: `❌ ${result.error}`,
    });
  }

  const item = result.item;
  const totalValue = result.totalValue;

  const embed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('💸 Sale Successful!')
    .setDescription(`You sold **${quantity}x ${item.name}** for ${economyManager.formatCoins(totalValue)}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * View player inventory
 */
async function handleInventoryCommand(interaction) {
  if (!inventoryManager) {
    return interaction.reply({
      content: '❌ Inventory system is not available.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const user = interaction.options.getUser('user') || interaction.user;
  const inventory = await inventoryManager.getUserInventory(interaction.guild.id, user.id);

  if (!inventory || inventory.items.length === 0) {
    return interaction.editReply({
      content: `🎒 ${user.username} has no items in their inventory yet!`,
    });
  }

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`🎒 ${user.username}'s Inventory`)
    .setTimestamp();

  // Show equipped items
  if (inventory.equipped.weapon || inventory.equipped.armor) {
    const equipped = [];
    if (inventory.equipped.weapon) {
      equipped.push(`⚔️ **${inventory.equipped.weapon.name}**`);
    }
    if (inventory.equipped.armor) {
      equipped.push(`🛡️ **${inventory.equipped.armor.name}**`);
    }
    embed.addFields({ name: '⚡ Equipped', value: equipped.join('\n'), inline: false });
  }

  // Show combat bonuses
  const bonuses = inventory.bonuses;
  const bonusLines = [];
  if (bonuses.damage > 0) bonusLines.push(`💥 Damage: +${bonuses.damage}`);
  if (bonuses.defense > 0) bonusLines.push(`🛡️ Defense: +${bonuses.defense}`);
  if (bonuses.hp > 0) bonusLines.push(`❤️ HP: +${bonuses.hp}`);
  if (bonuses.crit > 0) bonusLines.push(`🎯 Crit: +${bonuses.crit}%`);

  if (bonusLines.length > 0) {
    embed.addFields({ name: '📊 Combat Bonuses', value: bonusLines.join('\n'), inline: false });
  }

  // Group items by type
  const grouped = {
    weapon: [],
    armor: [],
    consumable: [],
  };

  for (const invItem of inventory.items) {
    grouped[invItem.item.type]?.push(invItem);
  }

  // Add fields for each type
  for (const [type, typeItems] of Object.entries(grouped)) {
    if (typeItems.length === 0) continue;

    const icon = type === 'weapon' ? '⚔️' : type === 'armor' ? '🛡️' : '🧪';
    const title = type === 'weapon' ? 'Weapons' : type === 'armor' ? 'Armor' : 'Consumables';

    const lines = typeItems.map((invItem) => {
      const item = invItem.item;
      const stats = [];
      if (item.damage_bonus) stats.push(`+${item.damage_bonus}💥`);
      if (item.defense_bonus) stats.push(`+${item.defense_bonus}🛡️`);
      if (item.hp_bonus) stats.push(`+${item.hp_bonus}❤️`);
      const critBonus = item.crit_chance_bonus || item.crit_bonus;
      if (critBonus) stats.push(`+${critBonus}%🎯`);

      const statsStr = stats.length > 0 ? ` [${stats.join(' ')}]` : '';
      const qty = invItem.quantity > 1 ? ` x${invItem.quantity}` : '';

      return `**${item.name}**${qty}${statsStr}`;
    });

    embed.addFields({ name: `${icon} ${title}`, value: lines.join('\n'), inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Equip a weapon or armor (interactive with select menu)
 */
async function handleEquipCommand(interaction) {
  if (!inventoryManager) {
    return interaction.reply({
      content: '❌ Inventory system is not available.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  // Get user's inventory
  const inventory = await inventoryManager.getUserInventory(
    interaction.guild.id,
    interaction.user.id
  );

  if (!inventory || inventory.items.length === 0) {
    return interaction.editReply({
      content: '❌ You have no items to equip!',
    });
  }

  // Filter only weapons and armor
  const equipableItems = inventory.items.filter(
    (invItem) => invItem.item.type === 'weapon' || invItem.item.type === 'armor'
  );

  if (equipableItems.length === 0) {
    return interaction.editReply({
      content: '❌ You have no weapons or armor to equip!',
    });
  }

  // Create select menu options
  const selectOptions = equipableItems.slice(0, 25).map((invItem) => {
    const item = invItem.item;
    const icon = item.type === 'weapon' ? '⚔️' : '🛡️';
    const stats = [];
    if (item.damage_bonus) stats.push(`+${item.damage_bonus}💥`);
    if (item.defense_bonus) stats.push(`+${item.defense_bonus}🛡️`);
    if (item.hp_bonus) stats.push(`+${item.hp_bonus}❤️`);
    
    const description = stats.length > 0 ? stats.join(' ') : item.type.toUpperCase();

    return {
      label: item.name,
      value: item.id,
      description: description.substring(0, 100),
      emoji: icon,
    };
  });

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('⚡ Equip Item')
    .setDescription('Select an item to equip from the menu below:')
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`equip_select_${interaction.user.id}`)
    .setPlaceholder('Choose an item to equip...')
    .addOptions(selectOptions);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * Unequip a weapon or armor
 */
async function handleUnequipCommand(interaction) {
  if (!inventoryManager) {
    return interaction.reply({
      content: '❌ Inventory system is niet beschikbaar.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const slot = interaction.options.getString('slot', true);

  const result = await inventoryManager.unequipItem(
    interaction.guild.id,
    interaction.user.id,
    slot
  );

  if (!result.success) {
    return interaction.editReply({
      content: `❌ ${result.error}`,
    });
  }

  const icon = slot === 'weapon' ? '⚔️' : '🛡️';

  const embed = new EmbedBuilder()
    .setColor('#FFA500')
    .setTitle(`${icon} Item Removed!`)
    .setDescription(`Your ${slot} has been removed!`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * View combat rank (duplicate - keeping for backwards compatibility)
 * This is now handled by the main handleCombatRankCommand function above
 * @deprecated - Use the main handleCombatRankCommand instead
 */

/**
 * View combat leaderboard (existing - keeping for reference)
 */
async function handleCombatLeaderboardCommand(interaction) {
  if (!combatXPManager) {
    return interaction.reply({
      content: '❌ Combat XP system is niet beschikbaar.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const page = interaction.options.getInteger('page') || 1;
  const leaderboard = await combatXPManager.getLeaderboard(interaction.guild.id, page);

  if (leaderboard.length === 0) {
    return interaction.editReply('📊 Nog geen combat data beschikbaar!');
  }

  const embed = new EmbedBuilder()
    .setColor('#FF4500')
    .setTitle(`⚔️ ${interaction.guild.name} - Combat Leaderboard (Page ${page})`)
    .setDescription(
      leaderboard
        .map((user, index) => {
          const rank = (page - 1) * 10 + index + 1;
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
          const winRate = user.total_duels > 0
            ? Math.round((user.duels_won / user.total_duels) * 100)
            : 0;
          return `${medal} **${user.username}** - Lvl ${user.combat_level} (${user.duels_won}W/${user.duels_lost}L - ${winRate}%)`;
        })
        .join('\n')
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ================================================================
// ERROR HANDLING
// ================================================================
process.on('unhandledRejection', (error) => {
  console.error('🚨 Unhandled promise rejection:', error);
  console.error('   Stack:', error.stack);
  // Don't exit - just log the error to prevent crashes
  // Railway will restart if needed
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught exception:', error);
  console.error('   Stack:', error.stack);
  // Don't exit immediately - try to log and continue
  // Railway will handle restarts if needed
});

// ================================================================
// START BOT
// ================================================================
(async () => {
  try {
    console.log('🔐 Logging in to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);
  } catch (error) {
    console.error('❌ Failed to login:', error);
    process.exit(1);
  }
})();

app.post('/api/giveaways/start', async (req, res) => {
  try {
    const {
      guildId,
      channelId,
      prize,
      durationMinutes,
      winnerCount = 1,
      requiredRoleId = null,
      actorId,
      actorName,
      embed = {},
      rewards = {},
    } = req.body || {};

    if (!guildId || !channelId || !prize || !durationMinutes) {
      return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const licenseActive = await featureGate.checkLicense(guildId);
    if (!licenseActive) {
      return res.status(403).json({ success: false, error: 'License inactive for this guild' });
    }

    const featureEnabled = await featureGate.checkFeature(guildId, GIVEAWAYS_FEATURE);
    if (!featureEnabled) {
      return res.status(403).json({ success: false, error: 'Giveaways feature disabled for this guild' });
    }

    // Check if this guild uses a custom bot
    let botClient = client;
    let guild = client.guilds.cache.get(guildId);
    let giveawayManagerToUse = giveawayManager;
    
    if (!guild && customBotManager) {
      // Try to find custom bot for this guild
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        botClient = customBot;
        guild = customBot.guilds.cache.get(guildId);
        // Get giveaway manager from custom bot handlers
        if (customBot.handlers && customBot.handlers.giveawayManager) {
          giveawayManagerToUse = customBot.handlers.giveawayManager;
          console.log(`🎉 [Giveaways API] Using custom bot for guild ${guildId}`);
        }
      }
    }

    // If still no guild, try fetching
    if (!guild) {
      guild = await botClient.guilds.fetch(guildId).catch(() => null);
    }

    if (!guild) {
      return res.status(404).json({ success: false, error: 'Guild not found. Make sure the bot (main or custom) is in the server.' });
    }

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ success: false, error: 'Channel not found or not text-based' });
    }

    let hostMember = null;
    if (actorId) {
      hostMember = await guild.members.fetch(actorId).catch(() => null);
    }

    const host = hostMember || botClient.user;
    if (!host) {
      return res.status(400).json({ success: false, error: 'Unable to determine giveaway host.' });
    }

    if (requiredRoleId) {
      const hasRole = await guild.roles.fetch(requiredRoleId).catch(() => null);
      if (!hasRole) {
        return res.status(400).json({ success: false, error: 'Required role not found in this guild.' });
      }
    }

    const durationValue = Number(durationMinutes);
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid duration.' });
    }

    const winnersValue = Number(winnerCount) || 1;
    if (!Number.isFinite(winnersValue) || winnersValue < 1 || winnersValue > 25) {
      return res.status(400).json({ success: false, error: 'Winner count must be between 1 and 25.' });
    }

    const sanitizedEmbed = {
      title: typeof embed.title === 'string' && embed.title.trim().length > 0 ? embed.title.trim().slice(0, 256) : undefined,
      description: typeof embed.description === 'string' && embed.description.trim().length > 0 ? embed.description.trim().slice(0, 4000) : undefined,
      color: typeof embed.color === 'string' && /^#?[0-9a-f]{6}$/i.test(embed.color.trim()) ? embed.color.trim().startsWith('#') ? embed.color.trim() : `#${embed.color.trim()}` : undefined,
      footer: typeof embed.footer === 'string' && embed.footer.trim().length > 0 ? embed.footer.trim().slice(0, 256) : undefined,
      imageUrl: typeof embed.imageUrl === 'string' && embed.imageUrl.trim().length > 0 ? embed.imageUrl.trim() : undefined,
      thumbnailUrl: typeof embed.thumbnailUrl === 'string' && embed.thumbnailUrl.trim().length > 0 ? embed.thumbnailUrl.trim() : undefined,
      joinButtonLabel: typeof embed.joinButtonLabel === 'string' && embed.joinButtonLabel.trim().length > 0 ? embed.joinButtonLabel.trim().slice(0, 40) : undefined,
      linkLabel: typeof embed.linkLabel === 'string' && embed.linkLabel.trim().length > 0 ? embed.linkLabel.trim().slice(0, 80) : undefined,
      linkUrl: typeof embed.linkUrl === 'string' && embed.linkUrl.trim().length > 0 ? embed.linkUrl.trim() : undefined,
    };

    if (sanitizedEmbed.linkUrl && !/^https?:\/\//i.test(sanitizedEmbed.linkUrl)) {
      return res.status(400).json({ success: false, error: 'Button URL must start with http:// or https://.' });
    }

    const sanitizedRewards = {
      roleId: typeof rewards.roleId === 'string' && rewards.roleId.trim().length > 0 ? rewards.roleId.trim() : null,
      roleRemoveAfter: rewards.roleRemoveAfter !== undefined && rewards.roleRemoveAfter !== null ? Number(rewards.roleRemoveAfter) : null,
      dmMessage: typeof rewards.dmMessage === 'string' && rewards.dmMessage.trim().length > 0 ? rewards.dmMessage.trim().slice(0, 4000) : null,
      channelId: typeof rewards.channelId === 'string' && rewards.channelId.trim().length > 0 ? rewards.channelId.trim() : null,
      channelMessage: typeof rewards.channelMessage === 'string' && rewards.channelMessage.trim().length > 0 ? rewards.channelMessage.trim().slice(0, 2000) : null,
    };

    if (sanitizedRewards.roleRemoveAfter !== null && (!Number.isFinite(sanitizedRewards.roleRemoveAfter) || sanitizedRewards.roleRemoveAfter < 0 || sanitizedRewards.roleRemoveAfter > 43200)) {
      return res.status(400).json({ success: false, error: 'Role removal delay must be between 0 and 43200 minutes.' });
    }

    if (sanitizedRewards.channelMessage && !sanitizedRewards.channelId) {
      return res.status(400).json({ success: false, error: 'Reward announcement channel is required when a message is provided.' });
    }

    if (sanitizedRewards.roleId) {
      const targetRole = await guild.roles.fetch(sanitizedRewards.roleId).catch(() => null);
      if (!targetRole) {
        return res.status(400).json({ success: false, error: 'Reward role not found in this guild.' });
      }
    }

    if (sanitizedRewards.channelId) {
      const rewardChannel = await guild.channels.fetch(sanitizedRewards.channelId).catch(() => null);
      if (!rewardChannel || !rewardChannel.isTextBased()) {
        return res.status(400).json({ success: false, error: 'Reward announcement channel is invalid.' });
      }
    }

    const result = await giveawayManagerToUse.createGiveaway({
      guild,
      channel,
      host,
      hostName: actorName || host.displayName,
      prize,
      durationMinutes: durationValue,
      winnerCount: winnersValue,
      requiredRoleId,
      embed: sanitizedEmbed,
      rewards: sanitizedRewards,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({ success: true, giveaway: result.giveaway });
  } catch (error) {
    console.error('API giveaway start error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/giveaways/:giveawayId/end', async (req, res) => {
  try {
    const { guildId } = req.body || {};
    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID missing.' });
    }

    const licenseActive = await featureGate.checkLicense(guildId);
    if (!licenseActive) {
      return res.status(403).json({ success: false, error: 'License inactive for this guild' });
    }

    const featureEnabled = await featureGate.checkFeature(guildId, GIVEAWAYS_FEATURE);
    if (!featureEnabled) {
      return res.status(403).json({ success: false, error: 'Giveaways feature disabled for this guild' });
    }

    // Check if this guild uses a custom bot
    let giveawayManagerToUse = giveawayManager;
    if (customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        if (customBot.handlers && customBot.handlers.giveawayManager) {
          giveawayManagerToUse = customBot.handlers.giveawayManager;
          console.log(`🎉 [Giveaways API] Using custom bot for guild ${guildId}`);
        }
      }
    }

    const result = await giveawayManagerToUse.endGiveaway(req.params.giveawayId, { force: true });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({ success: true, winners: result.winners || [] });
  } catch (error) {
    console.error('API giveaway end error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/giveaways/:giveawayId/reroll', async (req, res) => {
  try {
    const { guildId } = req.body || {};
    if (!guildId) {
      return res.status(400).json({ success: false, error: 'Guild ID missing.' });
    }

    const licenseActive = await featureGate.checkLicense(guildId);
    if (!licenseActive) {
      return res.status(403).json({ success: false, error: 'License inactive for this guild' });
    }

    const featureEnabled = await featureGate.checkFeature(guildId, GIVEAWAYS_FEATURE);
    if (!featureEnabled) {
      return res.status(403).json({ success: false, error: 'Giveaways feature disabled for this guild' });
    }

    // Check if this guild uses a custom bot
    let giveawayManagerToUse = giveawayManager;
    if (customBotManager) {
      const customBot = customBotManager.customBots.get(guildId);
      if (customBot && customBot.isReady && customBot.isReady()) {
        if (customBot.handlers && customBot.handlers.giveawayManager) {
          giveawayManagerToUse = customBot.handlers.giveawayManager;
          console.log(`🎉 [Giveaways API] Using custom bot for guild ${guildId}`);
        }
      }
    }

    const result = await giveawayManagerToUse.rerollGiveaway(req.params.giveawayId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({ success: true, winners: result.winners || [] });
  } catch (error) {
    console.error('API giveaway reroll error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ====================
// Twitch Subscriber Webhooks
// ====================

// Handle subscriber notifications from webapp
app.post('/api/twitch/subscriber', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ success: false, error: 'Missing data' });
    }

    console.log('🎉 Received Twitch subscriber notification:');
    console.log(`   Broadcaster: ${data.broadcaster_name}`);
    console.log(`   Subscriber: ${data.subscriber_name}`);
    console.log(`   Tier: ${data.tier}`);
    console.log(`   Is Gift: ${data.is_gift}`);

    // Get guild from main bot or custom bots
    let guild = client.guilds.cache.get(data.guild_id);
    let botClient = client;
    
    // If not found in main bot, check custom bots
    if (!guild && customBotManager) {
      // customBots.get() returns the Discord client directly
      const customBotClient = customBotManager.customBots.get(data.guild_id);
      if (customBotClient && customBotClient.isReady && customBotClient.isReady()) {
        guild = customBotClient.guilds.cache.get(data.guild_id);
        botClient = customBotClient;
        console.log(`   ✅ Using custom bot for guild ${data.guild_id}`);
      }
    }
    
    if (!guild) {
      console.error('   ❌ Guild not found:', data.guild_id);
      return res.status(404).json({ success: false, error: 'Guild not found' });
    }

    // Use subscriber_channel_id if set, otherwise fall back to channel_id
    const channelId = data.subscriber_channel_id || data.channel_id;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.error('   ❌ Channel not found:', channelId);
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    console.log(`   ✅ Using channel: #${channel.name} (${channelId})`);

    // Build embed
    const tierEmoji = data.tier === '3000' ? '💎' : data.tier === '2000' ? '⭐' : '🌟';
    const tierName = data.tier === '3000' ? 'Tier 3' : data.tier === '2000' ? 'Tier 2' : 'Tier 1';
    
    // Build description with months info
    let description = '';
    if (data.is_gift) {
      description = `**${data.subscriber_name}** received a gift subscription from the community! 🎁`;
    } else {
      const months = data.cumulative_months || 1;
      if (months === 1) {
        description = `**${data.subscriber_name}** just subscribed!`;
      } else if (months < 12) {
        description = `**${data.subscriber_name}** subscribed for **${months} months**! 🎉`;
      } else {
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        if (remainingMonths === 0) {
          description = `**${data.subscriber_name}** subscribed for **${years} ${years === 1 ? 'year' : 'years'}**! 🎊`;
        } else {
          description = `**${data.subscriber_name}** subscribed for **${years}y ${remainingMonths}m**! 🎊`;
        }
      }
    }
    
    const embedTitle = data.is_gift ? '🎁 Gift Subscription Received!' : `${tierEmoji} New Subscriber!`;
    
    const embed = new EmbedBuilder()
      .setColor('#9146FF') // Twitch purple
      .setTitle(embedTitle)
      .setDescription(description)
      .addFields(
        { name: '👤 Subscriber', value: data.subscriber_name, inline: true },
        { name: '🎯 Tier', value: tierName, inline: true },
        { name: '📺 Channel', value: data.broadcaster_name, inline: true }
      )
      .setTimestamp()
      .setFooter({ 
        text: 'Twitch', 
        iconURL: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png' 
      });

    // Add months field if > 1 month
    if (data.cumulative_months && data.cumulative_months > 1) {
      embed.addFields({
        name: '📅 Subscription',
        value: `${data.cumulative_months} ${data.cumulative_months === 1 ? 'month' : 'months'} total`,
        inline: true
      });
    }

    // Parse message template
    let content = data.message_template || '🎉 {subscriber} just subscribed to {streamer}!';
    content = content
      .replace('{subscriber}', data.subscriber_name)
      .replace('{streamer}', data.broadcaster_name)
      .replace('{tier}', tierName);

    // Add role ping if configured
    if (data.role_to_ping) {
      content = `<@&${data.role_to_ping}> ${content}`;
    }

    // Check if bot has permission to send embeds
    const botPermissions = channel.permissionsFor(botClient.user);
    const canEmbed = botPermissions && botPermissions.has('EmbedLinks');
    
    // Send message (with or without embed based on permissions)
    let message;
    if (canEmbed) {
      message = await channel.send({
        content,
        embeds: [embed]
      });
      console.log('   ✅ Subscriber notification sent to Discord (with embed)');
    } else {
      // Fallback: send rich text without embed
      const fallbackContent = `${content}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `${tierEmoji} **New Subscriber!**\n\n` +
        `${description}\n\n` +
        `📺 **Channel:** ${data.broadcaster_name}\n` +
        `🎯 **Tier:** ${tierName}\n` +
        (data.cumulative_months && data.cumulative_months > 1 ? `📅 **Subscription:** ${data.cumulative_months} ${data.cumulative_months === 1 ? 'month' : 'months'} total\n` : '') +
        `━━━━━━━━━━━━━━━━`;
      
      message = await channel.send({ content: fallbackContent });
      console.log('   ⚠️ Subscriber notification sent without embed (missing Embed Links permission)');
    }

    // Update event in database with message ID
    try {
      await configManager.supabase
        .from('twitch_subscriber_events')
        .update({
          discord_message_id: message.id,
          discord_channel_id: channel.id,
          notification_sent: true,
          notification_sent_at: new Date().toISOString()
        })
        .eq('id', data.event_id);
    } catch (dbError) {
      console.error('   ⚠️ Failed to update event in database:', dbError);
      // Don't fail the request
    }

    return res.json({ success: true, message_id: message.id });
  } catch (error) {
    console.error('Error handling subscriber notification:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Handle gifted subscriber notifications from webapp
app.post('/api/twitch/gifted-subscriber', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ success: false, error: 'Missing data' });
    }

    console.log('🎁 Received Twitch gifted subscription notification:');
    console.log(`   Broadcaster: ${data.broadcaster_name}`);
    console.log(`   Gifter: ${data.gifter_display_name}`);
    console.log(`   Total gifts: ${data.total_gifts}`);
    console.log(`   Tier: ${data.tier}`);
    console.log(`   Is anonymous: ${data.is_anonymous}`);

    // Get guild from main bot or custom bots
    let guild = client.guilds.cache.get(data.guild_id);
    let botClient = client;
    
    // If not found in main bot, check custom bots
    if (!guild && customBotManager) {
      const customBotClient = customBotManager.customBots.get(data.guild_id);
      if (customBotClient && customBotClient.isReady && customBotClient.isReady()) {
        guild = customBotClient.guilds.cache.get(data.guild_id);
        botClient = customBotClient;
        console.log(`   ✅ Using custom bot for guild ${data.guild_id}`);
      }
    }
    
    if (!guild) {
      console.error('   ❌ Guild not found:', data.guild_id);
      return res.status(404).json({ success: false, error: 'Guild not found' });
    }

    // Use subscriber_channel_id if set, otherwise fall back to channel_id
    const channelId = data.subscriber_channel_id || data.channel_id;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.error('   ❌ Channel not found:', channelId);
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }
    console.log(`   ✅ Using channel: #${channel.name} (${channelId})`);

    // Build embed
    const tierEmoji = data.tier === '3000' ? '💎' : data.tier === '2000' ? '⭐' : '🌟';
    const tierName = data.tier === '3000' ? 'Tier 3' : data.tier === '2000' ? 'Tier 2' : 'Tier 1';
    
    const gifterName = data.is_anonymous ? 'Anonymous' : data.gifter_display_name;
    const giftAmount = data.total_gifts || 1;
    const gifterEmoji = data.is_anonymous ? '❓' : '🎅';
    
    const embed = new EmbedBuilder()
      .setColor('#9146FF') // Twitch purple
      .setTitle(`🎁 Gifted Subscriptions!`)
      .setDescription(`${giftAmount} ${tierName} ${giftAmount === 1 ? 'subscription' : 'subscriptions'} gifted to the community!`)
      .addFields(
        { name: `${gifterEmoji} Gifted by`, value: gifterName, inline: true },
        { name: '🎁 Amount', value: `${giftAmount} ${giftAmount === 1 ? 'sub' : 'subs'}`, inline: true },
        { name: '🎯 Tier', value: tierName, inline: true },
        { name: '📺 Channel', value: data.broadcaster_name, inline: false }
      )
      .setTimestamp()
      .setFooter({ 
        text: 'Twitch', 
        iconURL: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png' 
      });

    // Parse message template
    let content = data.message_template || '🎁 {gifter} just gifted {amount} sub(s)!';
    content = content
      .replace(/{gifter}/g, gifterName)
      .replace(/{amount}/g, giftAmount.toString())
      .replace(/{streamer}/g, data.broadcaster_name)
      .replace(/{tier}/g, tierName);

    // Add role ping if configured
    if (data.role_to_ping) {
      content = `<@&${data.role_to_ping}> ${content}`;
    }

    // Check if bot has permission to send embeds
    const botPermissions = channel.permissionsFor(botClient.user);
    const canEmbed = botPermissions && botPermissions.has('EmbedLinks');

    // Send message (with or without embed based on permissions)
    let message;
    if (canEmbed) {
      message = await channel.send({
        content,
        embeds: [embed]
      });
      console.log('   ✅ Gifted sub notification sent to Discord (with embed)');
    } else {
      // Fallback: send rich text without embed
      const fallbackContent = `${content}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🎁 **Gifted Subscriptions!**\n\n` +
        `${giftAmount} ${tierName} ${giftAmount === 1 ? 'subscription' : 'subscriptions'} gifted to the community!\n\n` +
        `${gifterEmoji} **Gifted by:** ${gifterName}\n` +
        `🎁 **Amount:** ${giftAmount} ${giftAmount === 1 ? 'sub' : 'subs'}\n` +
        `🎯 **Tier:** ${tierName}\n` +
        `📺 **Channel:** ${data.broadcaster_name}\n` +
        `━━━━━━━━━━━━━━━━`;
      
      message = await channel.send({ content: fallbackContent });
      console.log('   ⚠️ Gifted sub notification sent without embed (missing Embed Links permission)');
    }

    // Update event in database to include Discord message ID
    try {
      await supabase
        .from('twitch_subscriber_events')
        .update({ discord_message_id: message.id })
        .eq('id', data.event_id);
    } catch (dbError) {
      console.error('   ⚠️ Failed to update event in database:', dbError);
      // Don't fail the request
    }

    return res.json({ success: true, message_id: message.id });
  } catch (error) {
    console.error('Error handling gifted sub notification:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Enable subscriber notifications (called from dashboard)
app.post('/api/twitch/enable-subscriber-notifications', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !data.notification_id) {
      return res.status(400).json({ success: false, error: 'Missing notification_id' });
    }

    // Get the correct EventSub manager (main bot or custom bot)
    let eventSubManager = twitchEventSubManager;
    
    // Check if this is for a custom bot
    if (data.guild_id && customBotManager) {
      const customBot = customBotManager.customBots.get(data.guild_id);
      if (customBot && customBot.handlers && customBot.handlers.twitchEventSubManager) {
        eventSubManager = customBot.handlers.twitchEventSubManager;
        console.log(`🔔 [CustomBot] Using custom bot EventSub manager for guild ${data.guild_id}`);
      }
    }
    
    if (!eventSubManager) {
      return res.status(503).json({ 
        success: false, 
        error: 'Twitch EventSub manager not initialized' 
      });
    }

    console.log(`🔔 Enabling subscriber notifications for notification ${data.notification_id}...`);

    const result = await eventSubManager.enableSubscriberNotifications(data.notification_id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error enabling subscriber notifications:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// TEST ENDPOINT - Trigger fake subscriber notification
app.post('/api/twitch/test-subscriber', async (req, res) => {
  try {
    const { guild_id, notification_id, subscriber_name, tier, cumulative_months } = req.body;
    
    if (!guild_id || !notification_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing guild_id or notification_id' 
      });
    }

    console.log('🧪 TEST: Simulating subscriber notification...');
    console.log(`   Months: ${cumulative_months || 1}`);

    // Get notification details from database
    const { data: notification, error } = await configManager.supabase
      .from('stream_notifications')
      .select('*')
      .eq('id', notification_id)
      .eq('guild_id', guild_id)
      .single();

    if (error || !notification) {
      return res.status(404).json({ 
        success: false, 
        error: 'Notification not found' 
      });
    }


    // Create fake subscriber data
    const testData = {
      event_id: 'test-' + Date.now(),
      notification_id: notification_id,
      guild_id: guild_id,
      channel_id: notification.channel_id,
      subscriber_channel_id: notification.subscriber_channel_id,
      role_to_ping: notification.role_to_ping,
      message_template: notification.subscriber_message_template,
      broadcaster_name: notification.streamer_name,
      subscriber_name: subscriber_name || 'TestUser',
      subscriber_display_name: subscriber_name || 'TestUser',
      tier: tier || '1000',
      is_gift: false,
      cumulative_months: cumulative_months || 1,
      streak_months: cumulative_months || 1,
    };

    // Get guild from main bot or custom bots
    let guild = client.guilds.cache.get(guild_id);
    let botClient = client;
    
    console.log(`🔍 Looking for guild ${guild_id}:`);
    console.log(`  Main bot has guild: ${!!guild}`);
    
    if (!guild && customBotManager) {
      // customBots.get() returns the Discord client directly, not an object with a client property
      const customBotClient = customBotManager.customBots.get(guild_id);
      console.log(`  Custom bot exists: ${!!customBotClient}`);
      console.log(`  Custom bot is ready: ${!!(customBotClient && customBotClient.isReady && customBotClient.isReady())}`);
      
      if (customBotClient && customBotClient.isReady && customBotClient.isReady()) {
        guild = customBotClient.guilds.cache.get(guild_id);
        console.log(`  Custom bot has guild: ${!!guild}`);
        console.log(`  Custom bot guilds: ${customBotClient.guilds.cache.map(g => g.id).join(', ')}`);
        botClient = customBotClient;
      }
    }
    
    if (!guild) {
      console.log(`❌ Guild ${guild_id} not found in any bot`);
      console.log(`  Available custom bots: ${customBotManager ? Array.from(customBotManager.customBots.keys()).join(', ') : 'none'}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Guild not found. Is the custom bot started and in the server?' 
      });
    }
    
    console.log(`✅ Found guild in ${botClient === client ? 'main' : 'custom'} bot`);

    // Use subscriber_channel_id if set, otherwise fall back to channel_id
    const channelId = testData.subscriber_channel_id || testData.channel_id;
    const channel = guild.channels.cache.get(channelId);
    
    if (!channel) {
      return res.status(404).json({ 
        success: false, 
        error: 'Channel not found' 
      });
    }

    // Build embed
    const tierEmoji = testData.tier === '3000' ? '💎' : testData.tier === '2000' ? '⭐' : '🌟';
    const tierName = testData.tier === '3000' ? 'Tier 3' : testData.tier === '2000' ? 'Tier 2' : 'Tier 1';
    
    // Build description with months info
    let testDescription = '';
    if (testData.is_gift) {
      testDescription = `**${testData.subscriber_name}** received a gift subscription!`;
    } else {
      const months = testData.cumulative_months || 1;
      if (months === 1) {
        testDescription = `**${testData.subscriber_name}** just subscribed!`;
      } else if (months < 12) {
        testDescription = `**${testData.subscriber_name}** subscribed for **${months} months**! 🎉`;
      } else {
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        if (remainingMonths === 0) {
          testDescription = `**${testData.subscriber_name}** subscribed for **${years} ${years === 1 ? 'year' : 'years'}**! 🎊`;
        } else {
          testDescription = `**${testData.subscriber_name}** subscribed for **${years}y ${remainingMonths}m**! 🎊`;
        }
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor('#9146FF')
      .setTitle(`${tierEmoji} New Subscriber! (TEST)`)
      .setDescription(testDescription)
      .addFields(
        { name: '📺 Channel', value: testData.broadcaster_name, inline: true },
        { name: '🎯 Tier', value: tierName, inline: true }
      )
      .setTimestamp()
      .setFooter({ 
        text: 'Twitch (Test Mode)', 
        iconURL: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png' 
      });

    // Add months field if > 1 month
    if (testData.cumulative_months && testData.cumulative_months > 1) {
      embed.addFields({
        name: '📅 Subscription',
        value: `${testData.cumulative_months} ${testData.cumulative_months === 1 ? 'month' : 'months'} total`,
        inline: true
      });
    }

    // Parse message template
    let content = testData.message_template || '🎉 {subscriber} just subscribed to {streamer}!';
    content = content
      .replace('{subscriber}', testData.subscriber_name)
      .replace('{streamer}', testData.broadcaster_name)
      .replace('{tier}', tierName);

    // Add role ping if configured
    if (testData.role_to_ping) {
      content = `<@&${testData.role_to_ping}> ${content}`;
    }

    // Check if bot has permission to send embeds
    const botPermissions = channel.permissionsFor(botClient.user);
    const canEmbed = botPermissions && botPermissions.has('EmbedLinks');
    
    // Send test message (with or without embed based on permissions)
    let message;
    if (canEmbed) {
      message = await channel.send({
        content,
        embeds: [embed]
      });
      console.log('   ✅ TEST subscriber notification sent (with embed)!');
    } else {
      // Fallback: send rich text without embed
      const fallbackContent = `${content}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `${tierEmoji} **New Subscriber! (TEST)**\n\n` +
        `${testDescription}\n\n` +
        `📺 **Channel:** ${testData.broadcaster_name}\n` +
        `🎯 **Tier:** ${tierName}\n` +
        (testData.cumulative_months && testData.cumulative_months > 1 ? `📅 **Subscription:** ${testData.cumulative_months} ${testData.cumulative_months === 1 ? 'month' : 'months'} total\n` : '') +
        `━━━━━━━━━━━━━━━━`;
      
      message = await channel.send({ content: fallbackContent });
      console.log('   ⚠️ TEST subscriber notification sent without embed (missing Embed Links permission)');
    }

    return res.json({ 
      success: true, 
      message_id: message.id,
      message: 'Test subscriber notification sent successfully!'
    });
  } catch (error) {
    console.error('Error sending test subscriber notification:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// TEST ENDPOINT - Trigger fake gifted subscription notification
app.post('/api/twitch/test-gifted-sub', async (req, res) => {
  try {
    const { guild_id, notification_id, gifter_name, amount, tier } = req.body;
    
    if (!guild_id || !notification_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing guild_id or notification_id' 
      });
    }

    console.log('🧪 TEST: Simulating gifted subscription notification...');
    console.log(`   Gifter: ${gifter_name || 'TestGifter'}`);
    console.log(`   Amount: ${amount || 1}`);
    console.log(`   Tier: ${tier || '1000'}`);

    // Get notification details from database
    const { data: notification, error } = await configManager.supabase
      .from('stream_notifications')
      .select('*')
      .eq('id', notification_id)
      .eq('guild_id', guild_id)
      .single();

    if (error || !notification) {
      return res.status(404).json({ 
        success: false, 
        error: 'Notification not found' 
      });
    }

    // Create fake gifted sub data
    const testData = {
      event_id: 'test-gifted-' + Date.now(),
      notification_id: notification_id,
      guild_id: guild_id,
      channel_id: notification.channel_id,
      subscriber_channel_id: notification.subscriber_channel_id,
      role_to_ping: notification.role_to_ping,
      message_template: notification.gifted_sub_message_template || '{gifter} just gifted {amount} sub(s) to {streamer}\'s channel! 🎁',
      broadcaster_name: notification.streamer_name,
      gifter_name: gifter_name || 'TestGifter',
      gifter_display_name: gifter_name || 'TestGifter',
      total_gifts: amount || 1,
      tier: tier || '1000',
      is_anonymous: false,
    };

    // Get guild from main bot or custom bots
    let guild = client.guilds.cache.get(guild_id);
    let botClient = client;
    
    console.log(`🔍 Looking for guild ${guild_id}:`);
    console.log(`  Main bot has guild: ${!!guild}`);
    
    if (!guild && customBotManager) {
      const customBotClient = customBotManager.customBots.get(guild_id);
      console.log(`  Custom bot exists: ${!!customBotClient}`);
      console.log(`  Custom bot is ready: ${!!(customBotClient && customBotClient.isReady && customBotClient.isReady())}`);
      
      if (customBotClient && customBotClient.isReady && customBotClient.isReady()) {
        guild = customBotClient.guilds.cache.get(guild_id);
        console.log(`  Custom bot has guild: ${!!guild}`);
        botClient = customBotClient;
      }
    }
    
    if (!guild) {
      console.log(`❌ Guild ${guild_id} not found in any bot`);
      return res.status(404).json({ 
        success: false, 
        error: 'Guild not found. Is the custom bot started and in the server?' 
      });
    }
    
    console.log(`✅ Found guild in ${botClient === client ? 'main' : 'custom'} bot`);

    // Use subscriber_channel_id if set, otherwise fall back to channel_id
    const channelId = testData.subscriber_channel_id || testData.channel_id;
    const channel = guild.channels.cache.get(channelId);
    
    if (!channel) {
      return res.status(404).json({ 
        success: false, 
        error: 'Channel not found' 
      });
    }

    // Parse message template
    let testDescription = testData.message_template
      .replace('{gifter}', testData.gifter_display_name)
      .replace('{amount}', testData.total_gifts.toString())
      .replace('{streamer}', testData.broadcaster_name)
      .replace('{tier}', testData.tier === '1000' ? 'Tier 1' : testData.tier === '2000' ? 'Tier 2' : 'Tier 3');

    // Get tier emoji and name
    const tierEmoji = testData.tier === '1000' ? '⭐' : testData.tier === '2000' ? '💎' : '👑';
    const tierName = testData.tier === '1000' ? 'Tier 1' : testData.tier === '2000' ? 'Tier 2' : 'Tier 3';

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('🎁 Subscription Gifts! (TEST)')
      .setDescription(testDescription)
      .setColor(0x9146FF) // Twitch purple
      .addFields([
        { name: '🎅 Gifter', value: testData.gifter_display_name, inline: true },
        { name: '🎁 Gifts', value: testData.total_gifts.toString(), inline: true },
        { name: '🎯 Tier', value: tierName, inline: true },
        { name: '📺 Channel', value: testData.broadcaster_name, inline: false }
      ])
      .setTimestamp()
      .setFooter({ text: 'Twitch Subscriber' });

    // Prepare message content with optional role ping
    let content = '';
    if (testData.role_to_ping && testData.role_to_ping.trim() !== '') {
      content = `<@&${testData.role_to_ping}>`;
    }

    // Check if bot has permission to send embeds
    const botPermissions = channel.permissionsFor(botClient.user);
    const canEmbed = botPermissions && botPermissions.has('EmbedLinks');

    // Send message
    let message;
    if (canEmbed) {
      message = await channel.send({
        content,
        embeds: [embed]
      });
      console.log('   ✅ TEST gifted sub notification sent (with embed)!');
    } else {
      // Fallback: send rich text without embed
      const fallbackContent = `${content}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `🎁 **Subscription Gifts! (TEST)**\n\n` +
        `${testDescription}\n\n` +
        `🎅 **Gifter:** ${testData.gifter_display_name}\n` +
        `🎁 **Gifts:** ${testData.total_gifts}\n` +
        `🎯 **Tier:** ${tierName}\n` +
        `📺 **Channel:** ${testData.broadcaster_name}\n` +
        `━━━━━━━━━━━━━━━━`;
      
      message = await channel.send({ content: fallbackContent });
      console.log('   ⚠️ TEST gifted sub notification sent without embed (missing Embed Links permission)');
    }

    return res.json({ 
      success: true, 
      message_id: message.id,
      message: 'Test gifted subscription notification sent successfully!'
    });
  } catch (error) {
    console.error('Error sending test gifted sub notification:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Disable subscriber notifications (called from dashboard)
app.post('/api/twitch/disable-subscriber-notifications', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !data.notification_id) {
      return res.status(400).json({ success: false, error: 'Missing notification_id' });
    }

    // Get the correct EventSub manager (main bot or custom bot)
    let eventSubManager = twitchEventSubManager;
    
    // Check if this is for a custom bot
    if (data.guild_id && customBotManager) {
      const customBot = customBotManager.customBots.get(data.guild_id);
      if (customBot && customBot.handlers && customBot.handlers.twitchEventSubManager) {
        eventSubManager = customBot.handlers.twitchEventSubManager;
        console.log(`🔕 [CustomBot] Using custom bot EventSub manager for guild ${data.guild_id}`);
      }
    }
    
    if (!eventSubManager) {
      return res.status(503).json({ 
        success: false, 
        error: 'Twitch EventSub manager not initialized' 
      });
    }

    console.log(`🔕 Disabling subscriber notifications for notification ${data.notification_id}...`);

    const result = await eventSubManager.disableSubscriberNotifications(data.notification_id);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error disabling subscriber notifications:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Sync historical messages for a ticket
app.post('/internal/tickets/:ticketId/sync-messages', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { guildId, channelId } = req.body;

    if (!guildId || !channelId) {
      return res.status(400).json({ success: false, error: 'Missing guildId or channelId' });
    }

    // Get the guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ success: false, error: 'Guild not found' });
    }

    // Get the channel
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    // Sync messages using ticketManager
    const result = await ticketManager.syncHistoricalMessages(channel, ticketId);

    if (result.success) {
      return res.json({
        success: true,
        synced: result.synced,
        skipped: result.skipped,
        message: `Synced ${result.synced} messages, skipped ${result.skipped}`
      });
    } else {
      return res.status(500).json({ success: false, error: result.error || 'Failed to sync messages' });
    }
  } catch (error) {
    console.error('Error syncing messages via API:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Close ticket from dashboard
app.post('/internal/tickets/:ticketId/close', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { guildId, channelId, reason, closedBy, closedByUsername } = req.body;

    if (!guildId || !channelId) {
      return res.status(400).json({ success: false, error: 'Missing guildId or channelId' });
    }

    // Get the guild
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return res.status(404).json({ success: false, error: 'Guild not found' });
    }

    // Get the channel
    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Channel not found' });
    }

    // Get user object (if closedBy is provided)
    let user = null;
    if (closedBy) {
      try {
        user = await guild.members.fetch(closedBy).catch(() => null);
        if (!user) {
          // Create a minimal user object
          user = {
            id: closedBy,
            tag: closedByUsername || 'Dashboard User',
            username: closedByUsername?.split('#')[0] || 'Dashboard User'
          };
        }
      } catch (error) {
        // Use minimal user object
        user = {
          id: closedBy,
          tag: closedByUsername || 'Dashboard User',
          username: closedByUsername?.split('#')[0] || 'Dashboard User'
        };
      }
    } else {
      // Default to bot user
      user = client.user;
    }

    // Close the ticket using ticketManager
    const success = await ticketManager.closeTicket(channel, user, reason || 'Closed from dashboard');

    if (success) {
      return res.json({ success: true, message: 'Ticket closed successfully' });
    } else {
      return res.status(500).json({ success: false, error: 'Failed to close ticket' });
    }
  } catch (error) {
    console.error('Error closing ticket via API:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Top.gg webhook endpoint
app.post('/webhook/topgg', async (req, res) => {
  try {
    const data = req.body;
    
    // Check internal secret if provided (from Next.js webhook handler)
    const internalSecret = req.headers['x-internal-secret'];
    const expectedSecret = process.env.INTERNAL_API_SECRET;
    
    // If internal secret is provided and matches, skip Top.gg auth check
    // (Next.js handler already verified Top.gg auth)
    if (internalSecret && expectedSecret) {
      if (internalSecret !== expectedSecret) {
        console.warn('⚠️  [Top.gg Webhook] Invalid internal secret');
        return res.status(401).json({ success: false, error: 'Invalid authentication' });
      }
      // Internal secret is valid, proceed (Top.gg auth was already checked by Next.js)
    } else {
      // No internal secret, this is a direct call from Top.gg
      // Check Top.gg webhook auth in body
      const topggWebhookAuth = process.env.TOPGG_WEBHOOK_AUTH;
      if (topggWebhookAuth && data.auth !== topggWebhookAuth) {
        console.warn('⚠️  [Top.gg Webhook] Invalid Top.gg auth');
        return res.status(401).json({ success: false, error: 'Invalid authentication' });
      }
    }

    if (!global.topggManager) {
      return res.status(503).json({ success: false, error: 'Top.gg manager not initialized' });
    }

    const result = await global.topggManager.handleVote(data);

    if (result.success) {
      return res.json({ success: true });
    } else {
      return res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error handling Top.gg webhook:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = client;