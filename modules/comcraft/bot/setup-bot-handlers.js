/**
 * Bot Handlers Setup
 * Sets up all event handlers for a Discord bot client
 * Can be used for both main bot and custom bots
 */

const configManager = require('../config-manager');
const xpManager = require('../leveling/xp-manager');
const rankCardGenerator = require('../leveling/rank-card-generator');
const autoMod = require('../moderation/auto-mod');
const modActions = require('../moderation/actions');
const customCommands = require('../custom-commands/manager');
const welcomeHandler = require('../welcome/handler');
const TwitchMonitor = require('../streaming/twitch-monitor');
const TwitchEventSubManager = require('../streaming/twitch-eventsub-manager');
const YouTubeMonitor = require('../streaming/youtube-monitor');
const DiscordManager = require('../discord-manager');
const analyticsTracker = require('../analytics-tracker');
const AutoRolesManager = require('../autoroles/manager');
const birthdayManager = require('../birthdays/manager');
const feedbackQueueManager = require('../feedback/queue-manager');
const ticketManager = require('../tickets/manager');
const GiveawayManager = require('../giveaways/manager');
const FeatureGate = require('../feature-gate');
const aiService = require('../ai');
const memoryStore = require('../ai/memory-store');
const aiStore = require('../ai/store');
const aiUsageService = require('../ai/usage-service');
const { buildKnowledgeContext } = require('../ai/prompt-utils.js');
const createLicenseHelpers = require('./license');
const createAiHandlers = require('./ai');
const createMessageCreateHandler = require('./events/message-create');
const createTicketHandlers = require('./interactions/tickets');
const createFeedbackHandlers = require('./interactions/feedback');
const createEventHandlers = require('./interactions/events');
// Music player (with graceful error handling)
let MusicManager, MusicCommands;
try {
  MusicManager = require('../music/manager');
  MusicCommands = require('../music/commands');
} catch (error) {
  console.warn('⚠️ [CustomBot] Music player modules not available:', error.message);
  MusicManager = null;
  MusicCommands = null;
}

// Vote Kick (always available)
const VoteKickManager = require('../vote-kick/manager');
const VoteKickCommands = require('../vote-kick/commands');
const gameVerificationManager = require('../game-verification/manager');
const { 
  EmbedBuilder, 
  AttachmentBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');

/**
 * Setup all handlers for a Discord bot client
 * This function sets up all event handlers, managers, and features
 * @param {Client} client - Discord.js client instance
 * @param {Object} options - Setup options
 * @param {boolean} options.isCustomBot - Whether this is a custom bot (default: false)
 * @param {string} options.guildId - Guild ID for custom bot (optional, filters events to this guild)
 * @param {string} options.botApplicationId - Bot application ID for custom bot (optional)
 * @param {string} options.botToken - Bot token for custom bot (optional, needed for command registration)
 * @param {Function} options.onReady - Callback function called when bot is ready (optional)
 */
async function setupBotHandlers(client, options = {}) {
  const { isCustomBot = false, guildId = null, botApplicationId = null, botToken = null, onReady = null } = options;

  // Get client ID (for custom bots, use botApplicationId, otherwise use env)
  const clientId = isCustomBot && botApplicationId ? botApplicationId : process.env.DISCORD_CLIENT_ID;

  // Initialize Music Manager early (for both main bot and custom bots)
  let musicManager = null;
  let musicCommands = null;
  if (MusicManager && MusicCommands) {
    try {
      musicManager = new MusicManager(client);
      musicCommands = new MusicCommands(musicManager);
      // Store in client for easy access
      client.musicManager = musicManager;
      client.musicCommands = musicCommands;
      
      // Wait for player initialization (extractors loading)
      musicManager.initializePlayer().then(() => {
        console.log('🎵 [CustomBot] Music Manager initialized and ready');
      }).catch(error => {
        console.warn('⚠️ [CustomBot] Music Manager initialization failed:', error.message);
        console.warn('   Music commands will still be available but may not work');
      });
    } catch (error) {
      console.error('❌ [CustomBot] Failed to create Music Manager:', error.message);
      musicManager = null;
      musicCommands = null;
    }
  }

  // Initialize Vote Kick Manager (always available)
  const voteKickManager = new VoteKickManager();
  const voteKickCommands = new VoteKickCommands(voteKickManager);
  client.voteKickManager = voteKickManager;
  client.voteKickCommands = voteKickCommands;
  
  // Clean up expired sessions every 5 minutes
  setInterval(() => {
    voteKickManager.cleanupExpiredSessions();
  }, 5 * 60 * 1000);

  // Initialize Feature Gate
  const featureGate = new FeatureGate(configManager);
  const SUPPORT_TICKETS_FEATURE = 'support_tickets';
  const BIRTHDAY_MANAGER_FEATURE = 'birthday_manager';
  const FEEDBACK_QUEUE_FEATURE = 'feedback_queue';
  const AUTO_ROLES_FEATURE = 'auto_roles';
  const EMBED_BUILDER_FEATURE = 'embed_builder';
  const GIVEAWAYS_FEATURE = 'giveaways';

  // Create license helpers
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
    const EconomyManager = require('../economy/manager');
    if (EconomyManager && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      economyManager = new EconomyManager();
    }
  } catch (error) {
    console.warn('Economy Manager not available:', error.message);
  }

  // Create AI handlers
  const { runGuildAiPrompt, handleAskAiCommand, maybeHandleAiChatMessage } = createAiHandlers({
    aiService,
    aiStore,
    memoryStore,
    aiUsageService,
    featureGate,
    buildKnowledgeContext,
    chunkMessage: (text, size = 1900) => {
      if (!text) return [''];
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
      return chunks.map((chunk) => (chunk.length > 2000 ? chunk.slice(0, 2000) : chunk));
    },
    client,
    xpManager,
    economyManager,
  });

  // Initialize auto-reactions manager
  let getAutoReactionsManager = null;
  let autoReactionsManager = null;
  try {
    const path = require('path');
    const fs = require('fs');
    // From modules/comcraft/bot/setup-bot-handlers.js to modules/comcraft/auto-reactions/manager.js
    // __dirname = modules/comcraft/bot/
    // ../auto-reactions/manager = modules/comcraft/auto-reactions/manager
    const autoReactionsPath = path.join(__dirname, '../auto-reactions/manager');
    const autoReactionsPathWithExt = autoReactionsPath + '.js';
    console.log('🔄 [SetupBotHandlers] Loading Auto-Reactions Manager from:', autoReactionsPath);
    console.log('   __dirname:', __dirname);
    console.log('   Full path with .js:', autoReactionsPathWithExt);
    
    // Check if file exists
    if (fs.existsSync(autoReactionsPathWithExt)) {
      console.log('   ✅ File exists at:', autoReactionsPathWithExt);
    } else {
      console.log('   ❌ File does NOT exist at:', autoReactionsPathWithExt);
      // Try alternative paths
      const altPath1 = path.join(__dirname, '../../auto-reactions/manager.js');
      const altPath2 = path.join(process.cwd(), 'modules/comcraft/auto-reactions/manager.js');
      console.log('   Trying alternative path 1:', altPath1, fs.existsSync(altPath1) ? '✅ EXISTS' : '❌ NOT FOUND');
      console.log('   Trying alternative path 2:', altPath2, fs.existsSync(altPath2) ? '✅ EXISTS' : '❌ NOT FOUND');
    }
    
    getAutoReactionsManager = require(autoReactionsPath);
    if (getAutoReactionsManager) {
      autoReactionsManager = getAutoReactionsManager();
      console.log('✅ [SetupBotHandlers] Auto-Reactions Manager initialized');
      if (autoReactionsManager && autoReactionsManager.supabase) {
        console.log('✅ [SetupBotHandlers] Auto-Reactions Manager Supabase client ready');
      } else {
        console.log('⚠️ [SetupBotHandlers] Auto-Reactions Manager Supabase client not initialized');
      }
    }
  } catch (error) {
    console.warn('⚠️ [SetupBotHandlers] Auto-Reactions Manager not available:', error.message);
    console.warn('   Error code:', error.code);
    console.warn('   Error path:', error.path);
    getAutoReactionsManager = null;
  }

  // Create message create handler
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
  });

  // Create ticket handlers
  const {
    handleTicketCommand,
    handleTicketSetupCommand,
    handleTicketStatsCommand,
    handleTicketPanelCommand,
    handleTicketButton,
    handleTicketModal,
    handleTemplateSelect,
    isTicketButton,
    isTicketModal,
    isTicketSelectMenu,
  } = createTicketHandlers({ featureGate, ticketManager, supportFeatureKey: SUPPORT_TICKETS_FEATURE });

  // Create feedback handlers
  const {
    handleFeedbackCommand,
    handleFeedbackSubmitButton,
    handleFeedbackSubmitModal,
    handleFeedbackCompleteButton,
    setupFeedbackQueueMessage,
    notifyFeedbackCompletion,
  } = createFeedbackHandlers({ client, feedbackQueueManager, configManager });

  // Initialize managers
  const discordManager = new DiscordManager(client);
  const autoRolesManager = new AutoRolesManager(client);
  const giveawayManager = new GiveawayManager(client);

  // Initialize casino manager if available (economyManager already initialized above)
  let casinoManager = null;
  try {
    const CasinoManager = require('../casino/manager');
    if (CasinoManager && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      casinoManager = new CasinoManager();
    }
  } catch (error) {
    console.warn('Casino Manager not available:', error.message);
  }

  // Initialize Combat XP Manager first (needed by DuelManager)
  let combatXPManager = null;
  try {
    const CombatXPManager = require('../combat/xp-manager');
    if (CombatXPManager && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      combatXPManager = new CombatXPManager();
      console.log('⚔️ [CustomBot] Combat XP Manager initialized');
    } else {
      console.log('⚠️ [CustomBot] Combat XP Manager not initialized (missing CombatXPManager or env vars)');
    }
  } catch (error) {
    console.warn('❌ [CustomBot] Combat XP Manager not available:', error.message);
  }

  // Initialize Item Manager
  let itemManager = null;
  try {
    const ItemManager = require('../combat/item-manager');
    if (ItemManager && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      itemManager = new ItemManager();
      console.log('🛒 [CustomBot] Item Manager initialized');
    } else {
      console.log('⚠️ [CustomBot] Item Manager not initialized (missing ItemManager or env vars)');
    }
  } catch (error) {
    console.warn('❌ [CustomBot] Item Manager not available:', error.message);
  }

  // Initialize Inventory Manager
  let inventoryManager = null;
  try {
    const InventoryManager = require('../combat/inventory-manager');
    if (InventoryManager && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      inventoryManager = new InventoryManager();
      console.log('🎒 [CustomBot] Inventory Manager initialized');
    } else {
      console.log('⚠️ [CustomBot] Inventory Manager not initialized (missing InventoryManager or env vars)');
    }
  } catch (error) {
    console.warn('❌ [CustomBot] Inventory Manager not available:', error.message);
  }

  let duelManager = null;
  try {
    const DuelManager = require('../economy/duel-manager');
    if (DuelManager && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      duelManager = new DuelManager(combatXPManager, inventoryManager);
      console.log('⚔️ [CustomBot] Duel Manager initialized');
    } else {
      console.log('⚠️ [CustomBot] Duel Manager not initialized (missing DuelManager or env vars)');
    }
  } catch (error) {
    console.warn('❌ [CustomBot] Duel Manager not available:', error.message);
  }

  // Initialize streaming monitors
  let twitchMonitor = null;
  let youtubeMonitor = null;
  let twitchEventSubManager = null;

  if (process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    // For custom bots, pass null for customBotManager and the specific guildId
    // This ensures they only monitor notifications for their own guild
    twitchMonitor = new TwitchMonitor(client, null, guildId);
    console.log(`🔍 TwitchMonitor type: ${typeof twitchMonitor}, has startMonitoring: ${typeof twitchMonitor?.startMonitoring}`);
    twitchMonitor.startMonitoring();
    
    // Initialize EventSub manager for subscriber notifications
    twitchEventSubManager = new TwitchEventSubManager(twitchMonitor);
    console.log(`✅ [${client.user?.tag}] Twitch EventSub manager initialized`);
  }

  if (process.env.YOUTUBE_API_KEY) {
    youtubeMonitor = new YouTubeMonitor(client);
    youtubeMonitor.startMonitoring();
  }

  // Initialize birthday manager
  birthdayManager.startScheduler(client);

  // Initialize giveaway manager
  giveawayManager.startScheduler();

  // Initialize Game News Manager for custom bots
  try {
    const GameNewsManager = require('../game-news/manager');
    const gameNewsManager = new GameNewsManager(client);
    gameNewsManager.startScheduler();
    console.log('🎮 [CustomBot] Game News Manager initialized');
  } catch (error) {
    console.error('❌ [CustomBot] Failed to initialize Game News Manager:', error.message);
  }

  // Initialize Update Notifier for custom bots
  try {
    const UpdateNotifier = require('../updates/notifier');
    const updateNotifier = new UpdateNotifier(client);
    updateNotifier.startScheduler(60); // Check every 60 minutes
    console.log('📢 [CustomBot] Update Notifier initialized');
  } catch (error) {
    console.error('❌ [CustomBot] Failed to initialize Update Notifier:', error.message);
  }

  // Initialize Event Manager for custom bots
  let eventManager = null;
  try {
    const EventManager = require('../events/manager');
    eventManager = new EventManager(client);
    eventManager.startScheduler();
    console.log('📅 [CustomBot] Event Manager initialized');
    // Store globally for interaction handlers
    global.eventManager = eventManager;
  } catch (error) {
    console.error('❌ [CustomBot] Failed to initialize Event Manager:', error.message);
    global.eventManager = null;
  }

  // Initialize Scheduled Messages Manager
  try {
    const ScheduledMessagesManager = require('../scheduled-messages/manager');
    const scheduledMessagesManager = new ScheduledMessagesManager(client);
    scheduledMessagesManager.startScheduler();
    console.log('⏰ [CustomBot] Scheduled Messages Manager initialized');
  } catch (error) {
    console.error('❌ [CustomBot] Failed to initialize Scheduled Messages Manager:', error.message);
  }

  // Set up all event handlers
  setupEventHandlers(client, {
    isCustomBot,
    guildId,
    ensureGuildLicense,
    ensureInteractionLicense,
    ensureMessageLicense,
    handleMessageCreate,
    handleAskAiCommand,
    runGuildAiPrompt,
    configManager,
    ticketManager,
    handleTicketCommand,
    handleTicketSetupCommand,
    handleTicketStatsCommand,
    handleTicketPanelCommand,
    handleTicketButton,
    handleTicketModal,
    isTicketButton,
    isTicketModal,
    feedbackQueueManager,
    handleFeedbackCommand,
    handleFeedbackSubmitButton,
    handleFeedbackSubmitModal,
    handleFeedbackCompleteButton,
    welcomeHandler,
    autoRolesManager,
    giveawayManager,
    economyManager,
    casinoManager,
    duelManager,
    itemManager,
    inventoryManager,
    combatXPManager,
    featureGate,
    SUPPORT_TICKETS_FEATURE,
    BIRTHDAY_MANAGER_FEATURE,
    FEEDBACK_QUEUE_FEATURE,
    GIVEAWAYS_FEATURE,
    autoMod,
    xpManager,
    modActions,
    customCommands,
    analyticsTracker,
    clientId,
  });

  // Setup ready handler
  client.once('ready', async () => {
    // Register commands after bot is ready (token is now available)
    try {
      // Use botToken if provided (for custom bots), otherwise use client.token
      const token = botToken || client.token;
      await registerCommands(client, clientId, isCustomBot, guildId, token);
    } catch (error) {
      console.error('❌ Error registering commands in ready handler:', error);
    }
    const botTag = isCustomBot ? `${client.user.tag} (Custom)` : client.user.tag;
    console.log(`✅ Bot ${botTag} is online`);
    console.log(`📊 Serving ${client.guilds.cache.size} server(s)`);

    // Ensure temporary moderation actions also expire after restarts
    try {
      modActions.startExpirationWorker(client);
    } catch (e) {
      console.error('❌ Failed to start moderation expiration worker:', e);
    }

    // Set bot activity/presence
    // For custom bots, load from database if guildId is provided
    if (isCustomBot && guildId && configManager?.supabase) {
      try {
        const { data: botConfig } = await configManager.supabase
          .from('custom_bot_tokens')
          .select('bot_presence_type, bot_presence_text')
          .eq('guild_id', guildId)
          .single();

        if (botConfig && botConfig.bot_presence_text) {
          // Map presence types to Discord ActivityTypes
          const activityTypeMap = {
            'playing': 0,    // ActivityType.Playing
            'streaming': 1,  // ActivityType.Streaming
            'listening': 2,  // ActivityType.Listening
            'watching': 3,   // ActivityType.Watching
            'competing': 5   // ActivityType.Competing
          };
          
          const activityType = activityTypeMap[botConfig.bot_presence_type || 'watching'] || 3;
          client.user.setActivity(botConfig.bot_presence_text, { type: activityType });
          console.log(`📊 Custom bot presence set: ${botConfig.bot_presence_type} - ${botConfig.bot_presence_text}`);
        } else {
          // Default fallback for custom bots
          client.user.setActivity('codecraft-solutions.com | /help', { type: 3 });
        }
      } catch (error) {
        console.error('❌ Error loading custom bot presence:', error);
        // Fallback to default
        client.user.setActivity('codecraft-solutions.com | /help', { type: 3 });
      }
    } else {
      // Default for main bot
      client.user.setActivity('codecraft-solutions.com | /help', { type: 3 });
    }

    // Sync guilds to database (only for main bot or if guildId is specified)
    if (!isCustomBot) {
      await syncGuildsToDatabase(client, configManager);
    } else if (guildId) {
      // For custom bots, ensure the guild is in database
      try {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
          const owner = await guild.fetchOwner();
          await configManager.ensureGuild(guild, owner.id);
          console.log(`✅ Custom bot guild ${guildId} synced to database`);
        }
      } catch (error) {
        console.error(`❌ Error syncing custom bot guild ${guildId}:`, error);
      }
    }

    // Call onReady callback if provided (for custom bots to update database status)
    if (onReady && typeof onReady === 'function') {
      try {
        await onReady(client, { guildId, isCustomBot });
      } catch (error) {
        console.error(`❌ Error in onReady callback:`, error);
      }
    }

    console.log(`🚀 Bot ${botTag} setup complete!`);
  });

  return {
    discordManager,
    autoRolesManager,
    giveawayManager,
    economyManager,
    casinoManager,
    twitchMonitor,
    twitchEventSubManager,
    youtubeMonitor,
  };
}

/**
 * Set up all event handlers for a Discord bot client
 */
function setupEventHandlers(client, handlers) {
  const {
    isCustomBot,
    guildId,
    ensureGuildLicense,
    ensureInteractionLicense,
    ensureMessageLicense,
    handleMessageCreate,
    handleAskAiCommand,
    runGuildAiPrompt,
    configManager,
    ticketManager,
    handleTicketCommand,
    handleTicketSetupCommand,
    handleTicketStatsCommand,
    handleTicketPanelCommand,
    handleTicketButton,
    handleTicketModal,
    isTicketButton,
    isTicketModal,
    feedbackQueueManager,
    handleFeedbackCommand,
    handleFeedbackSubmitButton,
    handleFeedbackSubmitModal,
    handleFeedbackCompleteButton,
    welcomeHandler,
    autoRolesManager,
    giveawayManager,
    economyManager,
    casinoManager,
    duelManager,
    combatXPManager,
    itemManager,
    inventoryManager,
    featureGate,
    SUPPORT_TICKETS_FEATURE,
    BIRTHDAY_MANAGER_FEATURE,
    FEEDBACK_QUEUE_FEATURE,
    GIVEAWAYS_FEATURE,
    autoMod,
    xpManager,
    modActions,
    customCommands,
    analyticsTracker,
    clientId,
  } = handlers;

  // Guild Create handler
  client.on('guildCreate', async (guild) => {
    // For custom bots, only handle the specific guild
    if (isCustomBot && guildId && guild.id !== guildId) {
      return;
    }

    console.log(`✅ Bot joined new guild: ${guild.name} (${guild.id})`);

    try {
      let owner;
      try {
        owner = await guild.fetchOwner();
      } catch (error) {
        if (guild.ownerId) {
          owner = { id: guild.ownerId };
        } else {
          throw new Error('Could not fetch guild owner');
        }
      }

      const guildConfig = await configManager.ensureGuild(guild, owner.id);
      if (guildConfig) {
        console.log(`✅ Guild ${guild.id} successfully added to database`);
      }
    } catch (error) {
      console.error(`❌ Error ensuring guild ${guild.id} in database:`, error);
    }
  });

  // Guild Member Add handler
  client.on('guildMemberAdd', async (member) => {
    if (isCustomBot && guildId && member.guild.id !== guildId) {
      return;
    }

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

    // Track quest progress (invite_count quest type) - credit inviter if known
    if (global.questManager && member.guild) {
      try {
        // Try to get inviter from invites (Discord.js v14+ has invite tracking)
        let inviterId = null;
        try {
          const invites = await member.guild.invites.fetch();
          // Try to match invite by checking invite uses
          // Note: This is a simplified approach - full invite tracking requires caching
          // For now, we'll track when a user joins (they were invited by someone)
          // This could be enhanced with proper invite tracking
        } catch (inviteError) {
          // Invite fetching failed, skip
        }
        
        // If we have an inviter ID, track the quest
        // For now, skip invite tracking until proper invite system is implemented
        // if (inviterId && await global.questManager.isTracking(member.guild.id, 'invite_count')) {
        //   await global.questManager.updateProgress(member.guild.id, inviterId, 'invite_count', {
        //     increment: 1
        //   });
        // }
      } catch (error) {
        console.error('[GuildMemberAdd] Error tracking invite quest:', error.message);
      }
    }
  });

  // Guild Member Remove handler
  client.on('guildMemberRemove', async (member) => {
    if (isCustomBot && guildId && member.guild.id !== guildId) {
      return;
    }

    if (!(await ensureGuildLicense(member.guild.id))) return;
    await welcomeHandler.handleMemberLeave(member);
    await analyticsTracker.trackMemberLeave(member);
  });

  // Message Create handler
  client.on('messageCreate', handleMessageCreate);

  // Interaction Create handler
  client.on('interactionCreate', async (interaction) => {
    // Log ALL interactions for debugging
    console.log('[Interaction] Received interaction:', {
      type: interaction.type,
      isButton: interaction.isButton(),
      isModalSubmit: interaction.isModalSubmit(),
      isChatInputCommand: interaction.isChatInputCommand(),
      customId: interaction.customId || 'N/A',
      guildId: interaction.guildId || 'N/A',
      channelId: interaction.channelId || 'N/A',
      user: interaction.user?.tag || 'N/A'
    });

    if (isCustomBot && guildId && interaction.guildId !== guildId) {
      console.log('[Interaction] Skipping: custom bot filter');
      return;
    }

    const allowedCommands = ['help'];
    const licenseResult = await ensureInteractionLicense(interaction, { allowedCommands });
    console.log('[Interaction] License check result:', licenseResult, 'for interaction type:', interaction.type);
    
    if (!licenseResult) {
      console.log('[Interaction] License check failed for interaction:', interaction.customId);
      return;
    }

    console.log('[Interaction] After license check, checking interaction type...');
    console.log('[Interaction] isButton:', interaction.isButton(), 'isModalSubmit:', interaction.isModalSubmit(), 'isChatInputCommand:', interaction.isChatInputCommand());

    // Handle button interactions
    if (interaction.isButton()) {
      console.log('[Interaction] Button clicked, customId:', interaction.customId);
      
      if (isTicketButton(interaction.customId)) {
        await handleTicketButton(interaction);
        return;
      }

      // Handle vote kick buttons
      if (interaction.customId && interaction.customId.startsWith('votekick_vote_')) {
        if (client.voteKickCommands) {
          await client.voteKickCommands.handleVoteButton(interaction);
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

      // Duel button handlers
      if (interaction.customId.startsWith('duel_accept_') || interaction.customId.startsWith('duel_decline_')) {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guild?.id,
          'pvp_duels',
          'Premium'
        );
        if (!allowed) return;
        await handleDuelButton(interaction, duelManager, economyManager, client);
        return;
      }

      // Casino button handlers
      if (interaction.customId.startsWith('casino_')) {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guildId || interaction.guild?.id,
          'casino',
          'Premium'
        );
        if (!allowed) {
          return;
        }

        await handleCasinoButton(interaction, casinoManager, economyManager);
        return;
      }

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

      // Handle media reply buttons (route replies to another channel)
      if (interaction.customId && interaction.customId.startsWith('media_reply_')) {
        console.log('[Interaction] Media reply button detected, customId:', interaction.customId);
        try {
          await handleMediaReplyButton(interaction, configManager);
        } catch (handlerError) {
          console.error('[Interaction] Error in handleMediaReplyButton:', handlerError);
          console.error('[Interaction] Handler error stack:', handlerError.stack);
          // Try to reply if not already handled
          if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
            await interaction.reply({
              content: '❌ An error occurred while opening the reply modal.',
              ephemeral: true
            }).catch(err => {
              console.error('[Interaction] Failed to send error reply:', err);
            });
          }
        }
        return;
      }

      // Handle media delete buttons (delete webhook message)
      if (interaction.customId && interaction.customId.startsWith('media_delete_')) {
        console.log('[Interaction] Media delete button detected, customId:', interaction.customId);
        try {
          await handleMediaDeleteButton(interaction);
        } catch (handlerError) {
          console.error('[Interaction] Error in handleMediaDeleteButton:', handlerError);
          if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
            await interaction.reply({
              content: '❌ An error occurred while deleting the message.',
              ephemeral: true
            }).catch(() => {});
          }
        }
        return;
      }

      return await autoRolesManager.handleButtonInteraction(interaction);
    }

    // Handle modal submissions
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

      // Casino bet modal handlers
      if (interaction.customId.startsWith('casino_bet_')) {
        const allowed = await featureGate.checkFeatureOrReply(
          interaction,
          interaction.guildId || interaction.guild?.id,
          'casino',
          'Premium'
        );
        if (!allowed) {
          return;
        }

        await handleCasinoBetModal(interaction, casinoManager, economyManager);
        return;
      }

      // Media reply modal handler
      if (interaction.customId.startsWith('media_reply_modal_')) {
        await handleMediaReplyModal(interaction, configManager);
        return;
      }

      // Moderation appeal modal handler
      if (interaction.customId === 'appeal_submit_modal') {
        await handleAppealSubmitModal(interaction, modActions);
        return;
      }
    }

    // Handle select menus
    if (interaction.isStringSelectMenu()) {
      // Handle ticket template selection
      if (isTicketSelectMenu(interaction.customId)) {
        await handleTemplateSelect(interaction);
        return;
      }

      // Handle equip item selection
      if (interaction.customId.startsWith('equip_select_')) {
        return await handleEquipItemSelect(interaction, inventoryManager);
      }
      
      return await autoRolesManager.handleSelectMenuInteraction(interaction);
    }

    // Handle slash commands
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // Track command usage for analytics
    await analyticsTracker.trackCommand(interaction, commandName);

    try {
      // Debug log to check if duelManager is available
      if (commandName === 'challenge') {
        console.log('🔍 [Debug] Challenge command called, duelManager status:', duelManager ? 'initialized' : 'null/undefined');
      }
      
      await handleSlashCommand(interaction, {
        handleAskAiCommand,
        runGuildAiPrompt,
        configManager,
        ticketManager,
        handleTicketCommand,
        handleTicketSetupCommand,
        handleTicketStatsCommand,
        handleTicketPanelCommand,
        feedbackQueueManager,
        handleFeedbackCommand,
        giveawayManager,
        economyManager,
        casinoManager,
        duelManager,
        combatXPManager,
        itemManager,
        inventoryManager,
        autoRolesManager,
        featureGate,
        SUPPORT_TICKETS_FEATURE,
        BIRTHDAY_MANAGER_FEATURE,
        FEEDBACK_QUEUE_FEATURE,
        GIVEAWAYS_FEATURE,
        xpManager,
        modActions,
        customCommands,
        clientId,
        client,
        gameVerificationManager,
      });
    } catch (error) {
      console.error(`Error handling command ${commandName}:`, error);

      const errorMsg = {
        content: '❌ Something went wrong while executing this command.',
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMsg).catch(() => {});
      } else {
        await interaction.reply(errorMsg).catch(() => {});
      }
    }
  });

  // Message Reaction Add handler
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

    if (isCustomBot && guildId && reaction.message.guildId !== guildId) {
      return;
    }

    if (!reaction.message.guildId || !(await ensureGuildLicense(reaction.message.guildId))) return;

    await autoRolesManager.handleReaction(reaction, user, 'add');

    // Giveaway reactions
    await giveawayManager.handleReactionAdd(reaction, user);

    // Track quest progress (reaction_count quest type)
    if (global.questManager && reaction.message.guild) {
      try {
        if (await global.questManager.isTracking(reaction.message.guild.id, 'reaction_count')) {
          await global.questManager.updateProgress(reaction.message.guild.id, user.id, 'reaction_count', {
            increment: 1
          });
        }
      } catch (error) {
        console.error('[ReactionAdd] Error updating quest progress:', error.message);
      }
    }
  });

  // Guild Member Update handler (for role changes)
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (isCustomBot && guildId && newMember.guild.id !== guildId) {
      return;
    }

    if (!(await ensureGuildLicense(newMember.guild.id))) return;

    // Track quest progress (role_obtain quest type)
    if (global.questManager && newMember.guild) {
      try {
        const oldRoles = oldMember.roles.cache.map(r => r.id);
        const newRoles = newMember.roles.cache.map(r => r.id);
        const gainedRoles = newRoles.filter(r => !oldRoles.includes(r));

        if (gainedRoles.length > 0 && await global.questManager.isTracking(newMember.guild.id, 'role_obtain')) {
          for (const roleId of gainedRoles) {
            await global.questManager.updateProgress(newMember.guild.id, newMember.user.id, 'role_obtain', {
              roleId: roleId,
              increment: 1
            });
          }
        }
      } catch (error) {
        console.error('[GuildMemberUpdate] Error tracking role_obtain quest:', error.message);
      }
    }
  });

  // Message Reaction Remove handler
  client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        return;
      }
    }

    if (isCustomBot && guildId && reaction.message.guildId !== guildId) {
      return;
    }

    if (!reaction.message.guildId || !(await ensureGuildLicense(reaction.message.guildId))) return;

    await autoRolesManager.handleReaction(reaction, user, 'remove');

    // Giveaway reactions
    await giveawayManager.handleReactionRemove(reaction, user);
  });

  // Error handlers
  client.on('error', (error) => {
    console.error(`❌ Discord client error:`, error);
  });

  client.on('warn', (warning) => {
    console.warn(`⚠️ Discord client warning:`, warning);
  });

  client.on('disconnect', () => {
    console.log(`🔌 Bot disconnected`);
  });
}

/**
 * Handle slash commands
 * This function handles all slash commands for the bot
 */
async function handleSlashCommand(interaction, handlers) {
  const { commandName } = interaction;
  const {
    handleAskAiCommand,
    runGuildAiPrompt,
    configManager,
    ticketManager,
    handleTicketCommand,
    handleTicketSetupCommand,
    handleTicketStatsCommand,
    handleTicketPanelCommand,
    feedbackQueueManager,
    handleFeedbackCommand,
    giveawayManager,
    economyManager,
    casinoManager,
    duelManager,
    combatXPManager,
    itemManager,
    inventoryManager,
    autoRolesManager,
    featureGate,
    SUPPORT_TICKETS_FEATURE,
    BIRTHDAY_MANAGER_FEATURE,
    FEEDBACK_QUEUE_FEATURE,
    GIVEAWAYS_FEATURE,
    xpManager,
    modActions,
    customCommands,
    clientId,
    client,
    gameVerificationManager,
  } = handlers;

  // Import command handlers from bot-comcraft.js
  // Note: These handlers are defined in bot-comcraft.js and need to be extracted
  // For now, we'll import them dynamically or copy the logic

  switch (commandName) {
    // Leveling commands
    case 'rank':
      await handleRankCommand(interaction, xpManager);
      break;

    case 'leaderboard':
      await handleLeaderboardCommand(interaction, xpManager);
      break;

    case 'setxp':
      await handleSetXPCommand(interaction, xpManager);
      break;

    // Moderation commands
    case 'warn':
      await handleWarnCommand(interaction, modActions, featureGate);
      break;

    case 'mute':
      await handleMuteCommand(interaction, modActions);
      break;

    case 'unmute':
      await handleUnmuteCommand(interaction, modActions);
      break;

    case 'kick':
      await handleKickCommand(interaction, modActions);
      break;

    case 'ban':
      await handleBanCommand(interaction, modActions);
      break;

    case 'timeout':
      await handleTimeoutCommand(interaction, modActions);
      break;

    case 'untimeout':
      await handleUntimeoutCommand(interaction, modActions);
      break;

    case 'case':
      await handleCaseCommand(interaction, modActions);
      break;
    case 'appeal':
      await handleAppealCommand(interaction);
      break;

    case 'verify':
      await handleVerifyCommand(interaction, configManager, gameVerificationManager);
      break;

    case 'verify-set':
      await handleVerifySetCommand(interaction, configManager, gameVerificationManager);
      break;

    case 'close':
      await handleCloseCommand(interaction);
      break;

    case 'unlock':
      await handleUnlockCommand(interaction);
      break;

    // Custom commands
    case 'customcommand':
      await handleCustomCommandCommand(interaction, customCommands);
      break;

    // Birthday commands
    case 'birthday': {
      const birthdayAllowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guild?.id,
        BIRTHDAY_MANAGER_FEATURE,
        'Basic'
      );
      if (!birthdayAllowed) break;
      await handleBirthdayCommand(interaction, birthdayManager, configManager);
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
      await handleBirthdayConfigCommand(interaction, birthdayManager);
      break;
    }

    // Feedback commands
    case 'feedback':
      await handleFeedbackCommand(interaction);
      break;

    // Giveaway commands
    case 'giveaway':
      await handleGiveawayCommand(interaction, giveawayManager, featureGate, GIVEAWAYS_FEATURE);
      break;

    // AI commands
    case 'askai':
      await handleAskAiCommand(interaction);
      break;

    // Ticket commands
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
          ephemeral: true,
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
          ephemeral: true,
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
          ephemeral: true,
        });
      }

      await handleTicketPanelCommand(interaction);
      break;
    }

    // Economy commands
    case 'balance': {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guild?.id,
        'economy',
        'Premium'
      );
      if (!allowed) break;
      await handleBalanceCommand(interaction, economyManager);
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
      await handleDailyCommand(interaction, economyManager);
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
      await handlePayCommand(interaction, economyManager, client);
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
      await handleConvertCommand(interaction, economyManager, xpManager);
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
      await handleChallengeCommand(interaction, duelManager, economyManager, client, combatXPManager, inventoryManager);
      break;
    }

    // Combat XP commands
    case 'combatrank': {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guild?.id,
        'pvp_duels',
        'Premium'
      );
      if (!allowed) break;
      await handleCombatRankCommand(interaction, combatXPManager);
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
      await handleCombatLeaderboardCommand(interaction, combatXPManager);
      break;
    }

    // Shop commands
    case 'shop': {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guild?.id,
        'pvp_duels',
        'Premium'
      );
      if (!allowed) break;
      await handleShopCommand(interaction, itemManager, economyManager);
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
      await handleBuyCommand(interaction, itemManager, inventoryManager, economyManager);
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
      await handleSellCommand(interaction, itemManager, inventoryManager, economyManager);
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
      await handleInventoryCommand(interaction, inventoryManager);
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
      await handleEquipCommand(interaction, inventoryManager);
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
      await handleUnequipCommand(interaction, inventoryManager);
      break;
    }

    // Casino commands
    case 'casino': {
      const allowed = await featureGate.checkFeatureOrReply(
        interaction,
        interaction.guild?.id,
        'casino',
        'Premium'
      );
      if (!allowed) break;
      await handleCasinoCommand(interaction, casinoManager);
      break;
    }

    // Utility commands
    case 'help':
      await handleHelpCommand(interaction);
      break;

    case 'serverinfo':
      await handleServerInfoCommand(interaction);
      break;

    case 'dashboard':
      await handleDashboardCommand(interaction, configManager, clientId);
      break;

    // ============ MUSIC COMMANDS ============
    case 'play':
      // Check if interaction is already acknowledged
      if (interaction.deferred || interaction.replied) {
        console.warn('⚠️ [Music] Interaction already acknowledged before handlePlay call');
        console.warn(`   deferred: ${interaction.deferred}, replied: ${interaction.replied}`);
        console.warn(`   This is likely a race condition or duplicate handler call`);
        return;
      }
      
      // Check if music commands are available and initialized
      if (!musicCommands) {
        try {
          await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
        } catch (error) {
          console.error('❌ [Music] Failed to send error reply:', error.message);
        }
        return;
      }
      
      // Check if music manager is fully initialized
      if (musicManager && !musicManager.isFullyInitialized()) {
        try {
          await interaction.reply({ 
            content: '⏳ Music player is still initializing. Please try again in a few seconds.', 
            ephemeral: true 
          });
        } catch (error) {
          console.error('❌ [Music] Failed to send initialization message:', error.message);
        }
        return;
      }
      
      // Call handlePlay with error handling
      try {
        await musicCommands.handlePlay(interaction);
      } catch (error) {
        console.error('❌ [Music] Error in handlePlay:', error);
        console.error('   Stack:', error.stack);
        
        // Make sure to reply if not already acknowledged
        if (!interaction.deferred && !interaction.replied) {
          try {
            await interaction.reply({ 
              content: '❌ An error occurred while playing music. Please try again.', 
              ephemeral: true 
            });
          } catch (replyError) {
            console.error('❌ [Music] Failed to send error reply:', replyError.message);
          }
        } else if (interaction.deferred && !interaction.replied) {
          try {
            await interaction.editReply({ 
              content: '❌ An error occurred while playing music. Please try again.' 
            });
          } catch (editError) {
            console.error('❌ [Music] Failed to edit error reply:', editError.message);
          }
        }
      }
      break;

    case 'pause':
      if (musicCommands) await musicCommands.handlePause(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'resume':
      if (musicCommands) await musicCommands.handleResume(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'skip':
      if (musicCommands) await musicCommands.handleSkip(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'stop':
      if (musicCommands) await musicCommands.handleStop(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'queue':
      if (musicCommands) await musicCommands.handleQueue(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'nowplaying':
      if (musicCommands) await musicCommands.handleNowPlaying(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'volume':
      if (musicCommands) await musicCommands.handleVolume(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'shuffle':
      if (musicCommands) await musicCommands.handleShuffle(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'remove':
      if (musicCommands) await musicCommands.handleRemove(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'clear':
      if (musicCommands) await musicCommands.handleClear(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'loop':
      if (musicCommands) await musicCommands.handleLoop(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    case 'seek':
      if (musicCommands) await musicCommands.handleSeek(interaction);
      else await interaction.reply({ content: '❌ Music player not initialized', ephemeral: true });
      break;

    // ============ VOTE KICK COMMANDS ============
    case 'votekick':
      if (client.voteKickCommands) {
        await client.voteKickCommands.handleVoteKick(interaction);
      } else {
        await interaction.reply({ content: '❌ Vote kick system not initialized', ephemeral: true });
      }
      break;

    default:
      await interaction.reply({
        content: '❌ Unknown command',
        ephemeral: true,
      });
  }
}

/**
 * Command handler functions
 * These functions handle individual slash commands
 */

async function handleRankCommand(interaction, xpManager) {
  await interaction.deferReply();

  const user = interaction.options.getUser('user') || interaction.user;
  const rankData = await xpManager.getUserLevel(interaction.guild.id, user.id);

  // Get leveling config with customization
  const levelingConfig = await configManager.getLevelingConfig(interaction.guild.id);

  try {
    console.log(`[RankCommand] Generating rank card for ${user.username} (${user.id})`);
    console.log(`[RankCommand] Leveling config:`, {
      hasBackground: !!levelingConfig?.rank_card_background_url,
      backgroundUrl: levelingConfig?.rank_card_background_url,
      borderColor: levelingConfig?.rank_card_border_color,
      xpBarStyle: levelingConfig?.xp_bar_style,
      xpBarColor: levelingConfig?.xp_bar_color
    });

    // Generate rank card image
    const rankCardBuffer = await rankCardGenerator.generateRankCard({
      user: {
        username: user.username,
        avatarURL: user.displayAvatarURL({ size: 256, extension: 'png', forceStatic: true })
      },
      rankData: {
        level: rankData.level,
        rank: rankData.rank,
        xp: rankData.xp,
        xpForNext: rankData.xpForNext,
        totalMessages: rankData.totalMessages,
        voiceLevel: rankData.voiceLevel || 0,
        voiceXP: rankData.voiceXP || 0,
        voiceXPForNext: rankData.voiceXPForNext || 0
      },
      config: levelingConfig || {}
    });

    console.log(`[RankCommand] Rank card generated successfully, size: ${rankCardBuffer.length} bytes`);

    // Create attachment
    const attachment = new AttachmentBuilder(rankCardBuffer, { name: 'rank-card.png' });

    // Create embed with the generated image
    const borderColor = levelingConfig?.rank_card_border_color || '#5865F2';
    const embed = new EmbedBuilder()
      .setColor(borderColor)
      .setTitle(`📊 Rank Card - ${user.username}`)
      .setImage('attachment://rank-card.png')
      .setFooter({ text: `Rank #${rankData.rank} • Level ${rankData.level}${rankData.voiceLevel ? ` • Voice Level ${rankData.voiceLevel}` : ''} • ${rankData.totalMessages.toLocaleString()} Messages` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], files: [attachment] });
    console.log(`[RankCommand] Rank card sent successfully`);
  } catch (error) {
    console.error('[RankCommand] Error generating rank card:', error.message);
    console.error('[RankCommand] Error stack:', error.stack);
    console.log('[RankCommand] Falling back to embed format');
    
    // Fallback to embed if image generation fails
    const borderColor = levelingConfig?.rank_card_border_color || '#5865F2';
    const currentLevelXP = rankData.xp % rankData.xpForNext;
    const xpProgress = Math.floor((currentLevelXP / rankData.xpForNext) * 100);
    const xpBar = xpManager.generateXPBar(xpProgress, levelingConfig || {});
    
    const description = `**${user.username}**'s Leveling Stats\n\n` +
      `🏆 **Rank:** #${rankData.rank}\n` +
      `⭐ **Level:** ${rankData.level}\n` +
      `💬 **Messages:** ${rankData.totalMessages.toLocaleString()}`;
    
    const fields = [
      { 
        name: '📊 Text XP Progress', 
        value: `\`${xpBar}\` **${xpProgress}%**\n\`${currentLevelXP.toLocaleString()} / ${rankData.xpForNext.toLocaleString()} XP\`\n**Total XP:** ${rankData.xp.toLocaleString()}`, 
        inline: false 
      }
    ];

    // Add voice XP if available
    if (rankData.voiceXP !== undefined && rankData.voiceXPForNext !== undefined) {
      const voiceLevelXP = rankData.voiceXP % rankData.voiceXPForNext;
      const voiceXPProgress = rankData.voiceXPForNext > 0 
        ? Math.floor((voiceLevelXP / rankData.voiceXPForNext) * 100)
        : 0;
      const voiceXPBar = xpManager.generateXPBar(voiceXPProgress, levelingConfig || {});
      
      fields.push({
        name: '🔊 Voice XP Progress',
        value: `**Voice Level:** ${rankData.voiceLevel || 0}\n\`${voiceXPBar}\` **${voiceXPProgress}%**\n\`${voiceLevelXP.toLocaleString()} / ${rankData.voiceXPForNext.toLocaleString()} XP\`\n**Total Voice XP:** ${(rankData.voiceXP || 0).toLocaleString()}`,
        inline: false
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor(borderColor)
      .setTitle(`📊 Rank Card`)
      .setDescription(description)
      .setThumbnail(user.displayAvatarURL({ size: 256, dynamic: true }))
      .addFields(fields)
      .setFooter({ text: `Rank #${rankData.rank} • Level ${rankData.level}${rankData.voiceLevel ? ` • Voice Level ${rankData.voiceLevel}` : ''}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}

async function handleLeaderboardCommand(interaction, xpManager) {
  await interaction.deferReply();

  const leaderboard = await xpManager.getLeaderboard(interaction.guild.id, 10);

  if (leaderboard.length === 0) {
    return interaction.editReply('📊 No data available yet!');
  }

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(`🏆 ${interaction.guild.name} - Leaderboard`)
    .setDescription(
      leaderboard
        .map((user, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          return `${medal} **${user.username}** - Level ${user.level} (${user.xp} XP)`;
        })
        .join('\n')
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleSetXPCommand(interaction, xpManager) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

  const user = interaction.options.getUser('user');
  const xp = interaction.options.getInteger('xp');

  const success = await xpManager.setXP(interaction.guild.id, user.id, xp);

  if (success) {
    const level = xpManager.calculateLevel(xp);
    await interaction.reply({
      content: `✅ ${user.tag} is now level ${level} with ${xp} XP!`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: '❌ Something went wrong.',
      ephemeral: true,
    });
  }
}

async function handleWarnCommand(interaction, modActions, featureGate) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
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
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true,
    });
  }
}

async function handleMuteCommand(interaction, modActions) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

  const member = interaction.options.getMember('user');
  const duration = interaction.options.getInteger('duration');
  const reason = interaction.options.getString('reason');

  const result = await modActions.mute(interaction.guild, member, interaction.user, duration, reason);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${member.user.tag} has been muted. (Case #${result.caseId})`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true,
    });
  }
}

async function handleUnmuteCommand(interaction, modActions) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

  const member = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason');

  const result = await modActions.unmute(interaction.guild, member, interaction.user, reason);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${member.user.tag} has been unmuted. (Case #${result.caseId})`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true,
    });
  }
}

async function handleKickCommand(interaction, modActions) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

  const member = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason');

  const result = await modActions.kick(interaction.guild, member, interaction.user, reason);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${member.user.tag} has been kicked. (Case #${result.caseId})`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true,
    });
  }
}

async function handleBanCommand(interaction, modActions) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  const durationMinutes = interaction.options.getInteger('duration');
  const deleteDays = interaction.options.getInteger('days') || 0;

  const result = await modActions.banWithOptions(
    interaction.guild,
    user,
    interaction.user,
    reason,
    durationMinutes || null,
    deleteDays
  );

  if (result.success) {
    await interaction.reply({
      content: `✅ ${user.tag} has been banned. (Case #${result.caseId})`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true,
    });
  }
}

async function handleTimeoutCommand(interaction, modActions) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

  const member = interaction.options.getMember('user');
  const duration = interaction.options.getInteger('duration');
  const reason = interaction.options.getString('reason');

  const result = await modActions.timeout(interaction.guild, member, interaction.user, duration, reason);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${member.user.tag} has been timed out. (Case #${result.caseId})`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true,
    });
  }
}

async function handleUntimeoutCommand(interaction, modActions) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

  const member = interaction.options.getMember('user');
  const reason = interaction.options.getString('reason');

  const result = await modActions.untimeout(interaction.guild, member, interaction.user, reason);

  if (result.success) {
    await interaction.reply({
      content: `✅ ${member.user.tag} timeout removed. (Case #${result.caseId})`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true,
    });
  }
}

/**
 * Handle media reply button - opens modal to reply, then sends to reply channel
 */
async function handleMediaReplyButton(interaction, configManager) {
  // Check if interaction is already handled
  if (interaction.replied || interaction.deferred) {
    console.warn('[MediaReply] Interaction already replied/deferred');
    return;
  }

  try {
    console.log('[MediaReply] Button clicked, customId:', interaction.customId);
    console.log('[MediaReply] Interaction details:', {
      id: interaction.id,
      type: interaction.type,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user?.id,
      messageId: interaction.message?.id
    });
    
    // Use the message where the button was clicked (webhook message) as the original
    const originalMessage = interaction.message;
    
    if (!originalMessage) {
      console.error('[MediaReply] Original message not found');
      return await interaction.reply({
        content: '❌ Message not found.',
        ephemeral: true
      }).catch(err => {
        console.error('[MediaReply] Error replying:', err);
        console.error('[MediaReply] Reply error code:', err.code);
        console.error('[MediaReply] Reply error message:', err.message);
      });
    }

    // Create modal first (before async operations to respond within 3 seconds)
    console.log('[MediaReply] Creating modal for message:', originalMessage.id);
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    
    // Parse button ID to get original message ID and author ID
    const buttonIdParts = interaction.customId.replace('media_reply_', '').split('_');
    let modalId;
    if (buttonIdParts.length >= 3) {
      // Format: originalMessageId_channelId_originalAuthorId
      modalId = `${buttonIdParts[0]}_${buttonIdParts[1]}_${buttonIdParts[2]}`;
    } else {
      // Fallback to original message ID
      modalId = originalMessage.id;
    }
    
    const modal = new ModalBuilder()
      .setCustomId(`media_reply_modal_${modalId}`)
      .setTitle('💬 Reply to Media Post');

    const replyInput = new TextInputBuilder()
      .setCustomId('reply_text')
      .setLabel('Type your reply')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Type your reply here... Your reply will be sent to the configured reply channel.')
      .setRequired(true)
      .setMaxLength(2000);

    const firstActionRow = new ActionRowBuilder().addComponents(replyInput);
    modal.addComponents(firstActionRow);

    // Show modal immediately to respond within 3 seconds
    console.log('[MediaReply] Attempting to show modal...');
    console.log('[MediaReply] Modal customId:', modal.data.custom_id);
    console.log('[MediaReply] Interaction state before showModal:', {
      replied: interaction.replied,
      deferred: interaction.deferred,
      isRepliable: interaction.isRepliable(),
      isModal: interaction.isModalSubmit()
    });
    
    try {
      await interaction.showModal(modal);
      console.log('[MediaReply] ✅ Modal shown successfully');
    } catch (modalError) {
      console.error('[MediaReply] ❌ Error showing modal:', modalError);
      console.error('[MediaReply] Modal error details:', {
        name: modalError.name,
        message: modalError.message,
        code: modalError.code,
        stack: modalError.stack
      });
      
      // Try to reply with error message
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: `❌ Could not open modal: ${modalError.message || 'Unknown error'}`,
            ephemeral: true
          });
        } catch (replyError) {
          console.error('[MediaReply] Error sending error message:', replyError);
          console.error('[MediaReply] Reply error code:', replyError.code);
          console.error('[MediaReply] Reply error message:', replyError.message);
        }
      }
      throw modalError;
    }

    // Validate channel rules after showing modal (validation happens in modal submit handler)
    // This allows the modal to open even if there's a delay in fetching rules
    
  } catch (error) {
    console.error('[MediaReply] ❌ Error handling media reply button:', error);
    console.error('[MediaReply] Error name:', error.name);
    console.error('[MediaReply] Error message:', error.message);
    console.error('[MediaReply] Error code:', error.code);
    console.error('[MediaReply] Error stack:', error.stack);
    
    // Only try to reply if modal wasn't shown and interaction is still valid
    if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
      try {
        await interaction.reply({
          content: `❌ An error occurred: ${error.message || 'Unknown error'}`,
          ephemeral: true
        }).catch(replyErr => {
          console.error('[MediaReply] Failed to send error reply:', replyErr);
        });
      } catch (replyError) {
        console.error('[MediaReply] Error sending error message:', replyError);
        // If we can't reply, the interaction has likely expired
        if (replyError.code === 10062 || replyError.code === 40060 || 
            replyError.message?.includes('Unknown interaction') ||
            replyError.message?.includes('interaction has already been acknowledged')) {
          console.error('[MediaReply] Interaction expired or already acknowledged');
        }
      }
    } else {
      console.warn('[MediaReply] Cannot reply - interaction already handled or not repliable');
      console.warn('[MediaReply] Interaction state:', {
        replied: interaction.replied,
        deferred: interaction.deferred,
        isRepliable: interaction.isRepliable()
      });
    }
  }
}

/**
 * Handle media delete button - deletes webhook message if user is original poster
 */
async function handleMediaDeleteButton(interaction) {
  try {
    // Parse button ID: media_delete_<webhookMessageId>_<originalMessageId>_<originalAuthorId>
    const buttonIdParts = interaction.customId.replace('media_delete_', '').split('_');
    
    if (buttonIdParts.length < 3) {
      return interaction.reply({
        content: '❌ Invalid delete button format.',
        ephemeral: true
      });
    }
    
    const webhookMessageId = buttonIdParts[0];
    const originalAuthorId = buttonIdParts[2];
    
    // Check if user is the original poster
    if (interaction.user.id !== originalAuthorId) {
      return interaction.reply({
        content: '❌ You can only delete your own messages.',
        ephemeral: true
      });
    }
    
    // Fetch the webhook message
    const webhookMessage = await interaction.channel.messages.fetch(webhookMessageId).catch(() => null);
    if (!webhookMessage) {
      return interaction.reply({
        content: '❌ Message not found.',
        ephemeral: true
      });
    }
    
    // Check if bot can delete the message
    if (!webhookMessage.deletable) {
      return interaction.reply({
        content: '❌ I do not have permission to delete this message.',
        ephemeral: true
      });
    }
    
    // Delete the message
    await webhookMessage.delete();
    
    await interaction.reply({
      content: '✅ Message deleted.',
      ephemeral: true
    });
  } catch (error) {
    console.error('Error handling media delete button:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Er is een fout opgetreden bij het verwijderen van het bericht.',
        ephemeral: true
      }).catch(() => {});
    }
  }
}

/**
 * Handle media reply modal submission - sends reply to configured reply channel
 */
async function handleMediaReplyModal(interaction, configManager) {
  try {
    // Parse button ID: media_reply_<originalMessageId>_<channelId>_<originalAuthorId>
    const modalId = interaction.customId.replace('media_reply_modal_', '');
    const parts = modalId.split('_');
    
    // The modal ID should be the same format as button ID
    // For backward compatibility, check if it's just a message ID
    let originalMessageId, originalAuthorId;
    
    if (parts.length >= 3) {
      // New format: originalMessageId_channelId_originalAuthorId
      originalMessageId = parts[0];
      originalAuthorId = parts[2];
    } else {
      // Old format: just messageId
      originalMessageId = modalId;
      originalAuthorId = null;
    }
    
    const replyText = interaction.fields.getTextInputValue('reply_text');

    if (!replyText || !replyText.trim()) {
      return interaction.reply({
        content: '❌ Reply cannot be empty.',
        ephemeral: true
      });
    }

    // Fetch the webhook message (which contains the media)
    const originalMessage = await interaction.channel.messages.fetch(originalMessageId).catch(() => null);
    if (!originalMessage) {
      return interaction.reply({
        content: '❌ Original message not found.',
        ephemeral: true
      });
    }
    
    // Get original author ID from message if not in button ID
    if (!originalAuthorId) {
      // Try to get from webhook message (stored in embed or we need to parse from username)
      // For now, we'll try to fetch the original message from the database or use a fallback
      originalAuthorId = originalMessage.author?.id;
    }

    const channelRules = await configManager.getChannelModerationRules(interaction.guild.id, interaction.channel.id);
    if (!channelRules?.reply_channel_id) {
      return interaction.reply({
        content: '❌ Reply channel not configured for this channel.',
        ephemeral: true
      });
    }

    const replyChannel = interaction.guild.channels.cache.get(channelRules.reply_channel_id);
    if (!replyChannel) {
      return interaction.reply({
        content: '❌ Reply channel not found. Please contact an administrator.',
        ephemeral: true
      });
    }

    // Check if bot can send messages in reply channel
    if (!replyChannel.permissionsFor(interaction.guild.members.me)?.has(['SendMessages', 'ViewChannel'])) {
      return interaction.reply({
        content: '❌ I do not have permission to send messages in the reply channel.',
        ephemeral: true
      });
    }

    // Create embed with original message info and reply
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({
        name: `${interaction.user.tag} replied`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setDescription(replyText)
      .addFields(
        {
          name: '📎 Original Post',
          value: `[Jump to message](${originalMessage.url})`,
          inline: true
        },
        {
          name: '📤 From Channel',
          value: `${interaction.channel} (${interaction.channel.name})`,
          inline: true
        }
      )
      .setTimestamp();

    // Include original message content if available (truncated)
    if (originalMessage.content) {
      const truncatedContent = originalMessage.content.length > 500
        ? originalMessage.content.substring(0, 500) + '...'
        : originalMessage.content;
      embed.addFields({
        name: '💬 Original Content',
        value: truncatedContent,
        inline: false
      });
    }

    // Include first attachment/embed image if available
    if (originalMessage.attachments.size > 0) {
      const firstAttachment = originalMessage.attachments.first();
      if (firstAttachment.contentType?.startsWith('image/')) {
        embed.setImage(firstAttachment.url);
      }
    } else if (originalMessage.embeds.length > 0) {
      const firstEmbed = originalMessage.embeds[0];
      if (firstEmbed.image) {
        embed.setImage(firstEmbed.image.url);
      } else if (firstEmbed.thumbnail) {
        embed.setThumbnail(firstEmbed.thumbnail.url);
      }
    }

    // Ping both the replier and the original poster
    let mentionContent = `💬 Reply from ${interaction.user}`;
    if (originalAuthorId && originalAuthorId !== interaction.user.id) {
      try {
        const originalAuthor = await interaction.client.users.fetch(originalAuthorId).catch(() => null);
        if (originalAuthor) {
          mentionContent = `💬 ${interaction.user} replied to ${originalAuthor}`;
        }
      } catch (error) {
        console.error('[MediaReply] Error fetching original author:', error);
      }
    }
    
    const replyMessage = await replyChannel.send({
      content: mentionContent,
      embeds: [embed]
    });

    // Send notification to original poster if they're different from replier
    if (originalAuthorId && originalAuthorId !== interaction.user.id) {
      try {
        const originalAuthor = await interaction.client.users.fetch(originalAuthorId).catch(() => null);
        if (originalAuthor) {
          const { EmbedBuilder } = require('discord.js');
          const notificationEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('💬 New Reply to Your Post')
            .setDescription(`**${interaction.user.tag}** replied to your post in ${interaction.channel}`)
            .addFields(
              {
                name: '💬 Reply',
                value: replyText.length > 500 ? replyText.substring(0, 500) + '...' : replyText,
                inline: false
              },
              {
                name: '🔗 Jump to Reply',
                value: `[Click here](${replyMessage.url})`,
                inline: true
              },
              {
                name: '📎 Original Post',
                value: `[Click here](${originalMessage.url})`,
                inline: true
              }
            )
            .setTimestamp();
          
          await originalAuthor.send({ embeds: [notificationEmbed] }).catch(() => {
            // User has DMs disabled or blocked bot - that's okay
            console.log('[MediaReply] Could not send DM to original author');
          });
        }
      } catch (error) {
        console.error('[MediaReply] Error sending notification to original author:', error);
      }
    }

    await interaction.reply({
      content: `✅ Your reply has been sent to ${replyChannel}!`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error handling media reply modal:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred while sending your reply.',
        ephemeral: true
      }).catch(() => {});
    }
  }
}

async function handleCloseCommand(interaction) {
  // Check if user has ManageChannels permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ You do not have permission to manage channels.',
      ephemeral: true,
    });
  }

  // Check if bot has ManageChannels permission
  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ I do not have permission to manage channels.',
      ephemeral: true,
    });
  }

  const channel = interaction.channel;
  const reason = interaction.options.getString('reason') || 'No reason provided';

  try {
    // Lock the channel by removing SendMessages permission for @everyone
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false,
      AddReactions: false,
    });

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🔒 Channel Locked')
      .setDescription(`This channel has been locked by ${interaction.user.tag}`)
      .addFields(
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });
  } catch (error) {
    console.error('Error locking channel:', error);
    await interaction.reply({
      content: `❌ Error locking channel: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleUnlockCommand(interaction) {
  // Check if user has ManageChannels permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ You do not have permission to manage channels.',
      ephemeral: true,
    });
  }

  // Check if bot has ManageChannels permission
  if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return interaction.reply({
      content: '❌ I do not have permission to manage channels.',
      ephemeral: true,
    });
  }

  const channel = interaction.channel;
  const reason = interaction.options.getString('reason') || 'No reason provided';

  try {
    // Unlock the channel by allowing SendMessages permission for @everyone
    // Remove the permission overwrite to restore default permissions
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null,
      AddReactions: null,
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🔓 Channel Unlocked')
      .setDescription(`This channel has been unlocked by ${interaction.user.tag}`)
      .addFields(
        { name: 'Reason', value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });
  } catch (error) {
    console.error('Error unlocking channel:', error);
    await interaction.reply({
      content: `❌ Error unlocking channel: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleCaseCommand(interaction, modActions) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

  const caseId = interaction.options.getInteger('case');

  const caseData = await modActions.getCase(interaction.guild.id, caseId);

  if (!caseData) {
    return interaction.reply({
      content: `❌ Case #${caseId} not found.`,
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`📋 Case #${caseId}`)
    .addFields(
      { name: 'User', value: `<@${caseData.user_id}>`, inline: true },
      { name: 'Type', value: caseData.action || caseData.type || 'unknown', inline: true },
      { name: 'Reason', value: caseData.reason || 'No reason provided', inline: false },
      { name: 'Moderator', value: `<@${caseData.moderator_id}>`, inline: true },
      { name: 'Date', value: new Date(caseData.created_at).toLocaleString(), inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAppealCommand(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: '❌ Appeals can only be submitted inside a server.',
      ephemeral: true
    });
  }

  const caseId = interaction.options.getInteger('case');

  const caseInput = new TextInputBuilder()
    .setCustomId('appeal_case_id')
    .setLabel('Case ID (optional)')
    .setPlaceholder('e.g. 123')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  if (caseId) {
    caseInput.setValue(String(caseId));
  }

  const reasonInput = new TextInputBuilder()
    .setCustomId('appeal_reason')
    .setLabel('Why should this case be reviewed?')
    .setPlaceholder('Explain what happened and why you are appealing.')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const modal = new ModalBuilder()
    .setCustomId('appeal_submit_modal')
    .setTitle('Submit an Appeal')
    .addComponents(
      new ActionRowBuilder().addComponents(caseInput),
      new ActionRowBuilder().addComponents(reasonInput)
    );

  try {
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error showing appeal modal:', error);
    if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
      await interaction.reply({
        content: '❌ Unable to open the appeal form right now.',
        ephemeral: true
      }).catch(() => {});
    }
  }
}

async function handleAppealSubmitModal(interaction, modActions) {
  if (!interaction.guild) {
    return interaction.reply({
      content: '❌ Appeals can only be submitted inside a server.',
      ephemeral: true
    });
  }

  const caseIdRaw = interaction.fields.getTextInputValue('appeal_case_id')?.trim();
  const reason = interaction.fields.getTextInputValue('appeal_reason')?.trim();

  let caseId = null;
  if (caseIdRaw) {
    const parsed = parseInt(caseIdRaw, 10);
    if (!Number.isFinite(parsed)) {
      return interaction.reply({
        content: '❌ Case ID must be a number.',
        ephemeral: true
      });
    }
    caseId = parsed;
  }

  if (caseId) {
    const existingCase = await modActions.getCase(interaction.guild.id, caseId);
    if (!existingCase) {
      return interaction.reply({
        content: `❌ Case #${caseId} was not found.`,
        ephemeral: true
      });
    }
  }

  const result = await modActions.createAppeal(
    interaction.guild,
    interaction.user,
    caseId,
    reason || 'No reason provided',
    'discord'
  );

  if (!result.success) {
    return interaction.reply({
      content: `❌ Failed to submit appeal: ${result.error || 'Unknown error'}`,
      ephemeral: true
    });
  }

  return interaction.reply({
    content: '✅ Your appeal has been submitted. A moderator will review it soon.',
    ephemeral: true
  });
}

async function handleVerifyCommand(interaction, configManager, gameVerificationManager) {
  if (!interaction.guild) {
    return interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true
    });
  }
  const config = await configManager.getGameVerificationConfig(interaction.guild.id);
  if (!config || !config.enabled) {
    return interaction.reply({
      content: '❌ In-game verification is not enabled in this server.',
      ephemeral: true
    });
  }
  const username = interaction.options.getString('username').trim().slice(0, 32);
  if (!username) {
    return interaction.reply({
      content: '❌ Please provide a valid in-game username.',
      ephemeral: true
    });
  }
  if (config.one_time_only) {
    const existing = await gameVerificationManager.getVerifiedUser(interaction.guild.id, interaction.user.id);
    if (existing) {
      return interaction.reply({
        content: `❌ You are already verified as **${existing.in_game_username}**. Only an admin can update your in-game name.`,
        ephemeral: true
      });
    }
  }
  const member = interaction.member;
  if (!member) {
    return interaction.reply({
      content: '❌ Could not find your member data.',
      ephemeral: true
    });
  const me = interaction.guild.members.me;
  if (!me) {
    return interaction.reply({
      content: '❌ Bot member not found.',
      ephemeral: true
    });
  const unregId = config.unregistered_role_id;
  const verifiedId = config.verified_role_id;
  if (!verifiedId) {
    return interaction.reply({
      content: '❌ Verified role is not configured. Ask an admin to set it in the dashboard.',
      ephemeral: true
    });
  try {
    if (unregId && member.roles.cache.has(unregId)) {
      await member.roles.remove(unregId, `${config.game_name} verification`);
    }
    await member.roles.add(verifiedId, `${config.game_name} verification`);
    if (me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      await member.setNickname(username, `${config.game_name} verification`).catch(() => {});
    }
    const record = await gameVerificationManager.recordVerification(
      interaction.guild.id,
      interaction.user.id,
      username
    );
    if (!record.success) {
      console.error('[Verify] DB record error:', record.error);
    }
    const gameName = config.game_name || 'In-Game';
    return interaction.reply({
      content: `✅ You are now verified as **${username}** for ${gameName}. Your nickname has been updated.`,
      ephemeral: true
    });
  } catch (err) {
    console.error('[Verify] Error:', err);
    return interaction.reply({
      content: `❌ Verification failed: ${err.message || 'Unknown error'}. Make sure the bot has permission to manage roles and nicknames.`,
      ephemeral: true
    });
  }
}

async function handleVerifySetCommand(interaction, configManager, gameVerificationManager) {
  if (!interaction.guild) {
    return interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true
    });
  }
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames) &&
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need the "Manage Nicknames" permission to use this command.',
      ephemeral: true
    });
  const config = await configManager.getGameVerificationConfig(interaction.guild.id);
  if (!config || !config.enabled) {
    return interaction.reply({
      content: '❌ In-game verification is not enabled in this server.',
      ephemeral: true
    });
  const targetUser = interaction.options.getUser('user');
  const username = interaction.options.getString('username').trim().slice(0, 32);
  if (!username) {
    return interaction.reply({
      content: '❌ Please provide a valid in-game username.',
      ephemeral: true
    });
  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    return interaction.reply({
      content: '❌ User not found in this server.',
      ephemeral: true
    });
  const me = interaction.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageNicknames)) {
    return interaction.reply({
      content: '❌ I do not have permission to change nicknames.',
      ephemeral: true
    });
  try {
    await member.setNickname(username, `In-game username update by ${interaction.user.tag}`);
    const record = await gameVerificationManager.recordVerification(
      interaction.guild.id,
      targetUser.id,
      username
    );
    if (!record.success) {
      console.error('[VerifySet] DB error:', record.error);
    }
    configManager.clearGameVerificationCache(interaction.guild.id);
    return interaction.reply({
      content: `✅ Updated **${targetUser.tag}**'s in-game username to **${username}**.`,
      ephemeral: true
    });
  } catch (err) {
    console.error('[VerifySet] Error:', err);
    return interaction.reply({
      content: `❌ Update failed: ${err.message || 'Unknown error'}.`,
      ephemeral: true
    });
  }
}

async function handleCustomCommandCommand(interaction, customCommands) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'create') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ You do not have permission for this command.',
        ephemeral: true,
      });
    }

    const name = interaction.options.getString('name');
    const response = interaction.options.getString('response');

    const result = await customCommands.createCommand(interaction.guild.id, name, response, interaction.user.id);

    if (result.success) {
      await interaction.reply({
        content: `✅ Custom command "${name}" created!`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `❌ Error: ${result.error}`,
        ephemeral: true,
      });
    }
  } else if (subcommand === 'delete') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ You do not have permission for this command.',
        ephemeral: true,
      });
    }

    const name = interaction.options.getString('name');

    const result = await customCommands.deleteCommand(interaction.guild.id, name);

    if (result.success) {
      await interaction.reply({
        content: `✅ Custom command "${name}" deleted!`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `❌ Error: ${result.error}`,
        ephemeral: true,
      });
    }
  } else if (subcommand === 'list') {
    const commands = await customCommands.listCommands(interaction.guild.id);

    if (commands.length === 0) {
      return interaction.reply({
        content: '❌ No custom commands found.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📋 Custom Commands')
      .setDescription(commands.map((cmd) => `• ${cmd.name}`).join('\n'))
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleBirthdayCommand(interaction, birthdayManager, configManager) {
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

async function handleBirthdayConfigCommand(interaction, birthdayManager) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

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
      responseMessage = `🎭 Birthday role set to ${role}.`;
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
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return interaction.reply({
          content: '❌ Invalid time format. Use HH:MM (24-hour).',
          ephemeral: true,
        });
      }
      updates.birthday_announcement_time = time;
      responseMessage = `⏰ Birthday announcements will be sent around ${time}.`;
      break;
    }
    default:
      return interaction.reply({
        content: '❌ Unknown configuration option.',
        ephemeral: true,
      });
  }

  const result = await birthdayManager.updateSettings(guildId, updates);

  if (!result.success) {
    return interaction.reply({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
  }

  return interaction.reply({
    content: responseMessage,
    ephemeral: true,
  });
}

async function handleGiveawayCommand(interaction, giveawayManager, featureGate, GIVEAWAYS_FEATURE) {
  const subcommand = interaction.options.getSubcommand();
  const { PermissionFlagsBits } = require('discord.js');

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '❌ You do not have permission for this command.',
      ephemeral: true,
    });
  }

  const allowed = await featureGate.checkFeatureOrReply(
    interaction,
    interaction.guild?.id,
    GIVEAWAYS_FEATURE,
    'Premium'
  );
  if (!allowed) return;

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
        guild: interaction.guild,
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
        content: `🎉 Giveaway started in <#${giveaway.channel_id}>! ID: ${giveaway.id}.\nUse this ID to manage the giveaway (end/reroll).`,
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

async function handleBalanceCommand(interaction, economyManager) {
  if (!economyManager) {
    return interaction.reply({
      content: '❌ Economy system is not available.',
      ephemeral: true,
    });
  }

  const user = interaction.options.getUser('user') || interaction.user;

  const userEconomy = await economyManager.getUserEconomy(
    interaction.guild.id, 
    user.id,
    user.username,
    user.displayAvatarURL()
  );

  if (!userEconomy) {
    return interaction.reply({
      content: '❌ Failed to fetch balance.',
      ephemeral: true,
    });
  }

  await interaction.reply({
    content: `💰 ${user.tag} has ${economyManager.formatCoins(userEconomy.balance)} coins`,
    ephemeral: true,
  });
}

async function handleDailyCommand(interaction, economyManager) {
  if (!economyManager) {
    return interaction.reply({
      content: '❌ Economy system is not available.',
      ephemeral: true,
    });
  }

  const result = await economyManager.claimDaily(interaction.guild.id, interaction.user.id);

  if (result.success) {
    await interaction.reply({
      content: `✅ You claimed your daily reward! You received ${result.amount} coins.`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true,
    });
  }
}

async function handlePayCommand(interaction, economyManager, client) {
  if (!economyManager) {
    return interaction.reply({
      content: '❌ Economy system is not available.',
      ephemeral: true,
    });
  }

  const user = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');

  if (user.id === interaction.user.id) {
    return interaction.reply({
      content: '❌ You cannot pay yourself!',
      ephemeral: true,
    });
  }

  // Allow paying the bot itself, but not other bots
  const isBotPayment = client?.user && user.id === client.user.id;
  
  if (user.bot && !isBotPayment) {
    return interaction.reply({
      content: '❌ You cannot pay other bots! But you can tip me if you want... 😏💰',
      ephemeral: true,
    });
  }

  const result = await economyManager.transferCoins(
    interaction.guild.id, 
    interaction.user.id, 
    user.id, 
    amount,
    `Payment from ${interaction.user.username} to ${user.username}`
  );

  if (result.success) {
    let responseMsg = `✅ You paid ${user.tag} ${economyManager.formatCoins(amount)} coins!`;
    
    // Bot thank you message
    if (isBotPayment) {
      const thankYouResponses = [
        '\n\n💰 Thanks for the tip! I\'ll put these coins to good use! 😊',
        '\n\n🤖 Much appreciated! Now I can challenge more players! 💪',
        '\n\n⚡ Thanks! These coins will fuel my next duel! 🔥',
        '\n\n🎮 Generous! I won\'t forget this kindness! 💙',
      ];
      responseMsg += thankYouResponses[Math.floor(Math.random() * thankYouResponses.length)];
    }
    
    await interaction.reply({
      content: responseMsg,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `❌ Error: ${result.error}`,
      ephemeral: true,
    });
  }
}

async function handleConvertCommand(interaction, economyManager, xpManager) {
  await interaction.deferReply({ ephemeral: true });

  // Check if managers are initialized
  if (!economyManager) {
    return interaction.editReply({
      content: '❌ Economy system is not initialized.',
    });
  }

  if (!xpManager) {
    return interaction.editReply({
      content: '❌ XP system is not initialized.',
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

    // Perform the conversion
    const result = await economyManager.convertXP(guildId, userId, xpAmount, xpManager);

    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }

    // Build success embed
    const { EmbedBuilder } = require('discord.js');
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
      .setFooter({ text: `💡 Use /balance to check your coins, /rank to check your XP` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleConvertCommand:', error);
    return interaction.editReply({
      content: '❌ An error occurred while converting XP. Please try again later.',
    });
  }
}

async function handleChallengeCommand(interaction, duelManager, economyManager, client, combatXPManager, inventoryManager) {
  await interaction.deferReply();

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
      return await handleBotChallenge(
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
      content: '❌ An error occurred while creating the challenge.',
    });
  }
}

async function handleBotChallenge(interaction, duelManager, economyManager, client, challenger, betAmount, duelId, guildId) {
  try {
    // Generate AI response for accepting the challenge
    const aiService = require('../ai');
    const acceptanceResponses = [
      `⚔️ ${challenger.username} dares to challenge me? ACCEPTED! Prepare for defeat, mortal! 😤`,
      `🤖 Challenge accepted, ${challenger.username}! But don't cry when you lose your ${betAmount} coins! 💰`,
      `⚡ Bold move, ${challenger.username}! Let's see if you can handle the power of AI in combat! 🔥`,
      `🎮 Oh, you think you can beat me? Let's dance, ${challenger.username}! Time to show you who's boss! 💪`,
      `🎯 ${betAmount} coins? That's barely a warmup! Come at me, ${challenger.username}! 😎`,
    ];

    // Random selection or use AI if available
    let botResponse = acceptanceResponses[Math.floor(Math.random() * acceptanceResponses.length)];

    // Try to get AI-generated response
    try {
      const aiPrompt = `You are a confident, slightly cocky Discord bot named ${client.user.username}. ${challenger.username} just challenged you to a combat duel for ${betAmount} coins. Generate a SHORT (max 100 characters), fun, engaging acceptance message. Be playful, confident, and exciting. Include an emoji.`;
      
      const aiResponse = await aiService.generateResponse(aiPrompt, {
        maxTokens: 50,
        temperature: 0.9,
      });

      if (aiResponse && aiResponse.trim().length > 0 && aiResponse.trim().length <= 150) {
        botResponse = `⚔️ ${aiResponse.trim()}`;
      }
    } catch (aiError) {
      console.log('AI response failed, using fallback:', aiError.message);
    }

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

    // Initial message with bot's acceptance
    const initialEmbed = duelManager.buildDuelEmbed(duel, player1User, player2User, null);
    await interaction.editReply({
      content: botResponse,
      embeds: [initialEmbed],
    });

    // Wait a moment before starting combat
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Animate the combat
    const interval = setInterval(async () => {
      try {
        const roundResult = duelManager.processRound(duel);
        
        const updateEmbed = duelManager.buildDuelEmbed(duel, player1User, player2User, roundResult.log);
        
        // Add AI commentary occasionally
        let commentaryText = roundResult.isDone ? null : `⚔️ **Round ${duel.round}/${duel.maxRounds}**`;
        
        if (!roundResult.isDone && Math.random() < 0.3) {
          const comments = [
            '💥 *The crowd goes wild!*',
            '🔥 *What a hit!*',
            '⚡ *Incredible display of power!*',
            '🎯 *The tension is rising!*',
            '💪 *Both fighters giving it their all!*',
          ];
          commentaryText += ` ${comments[Math.floor(Math.random() * comments.length)]}`;
        }

        await interaction.editReply({
          content: commentaryText,
          embeds: [updateEmbed],
        });

        if (roundResult.isDone) {
          clearInterval(interval);
          
          await duelManager.finishDuel(duel.duelId, roundResult.winner, economyManager);
          
          // Generate AI response for the result
          let resultMessage = roundResult.winner === 'draw' 
            ? '🤝 **DUEL ENDED IN A DRAW!**'
            : `🏆 **${roundResult.winner === duel.player1.id ? player1User.username : player2User.username} WINS!**`;

          if (roundResult.winner === client.user.id) {
            const winResponses = [
              '\n\n😎 Ez! Better luck next time, human!',
              '\n\n🤖 Calculated. Predicted. Dominated.',
              '\n\n⚡ The power of AI prevails!',
              '\n\n💪 Maybe practice more before challenging me again?',
            ];
            resultMessage += winResponses[Math.floor(Math.random() * winResponses.length)];
          } else if (roundResult.winner === challenger.id) {
            const loseResponses = [
              '\n\n😤 Impossible! You got lucky this time...',
              '\n\n🤔 Interesting... I need to recalculate my strategy.',
              '\n\n😮 Well played, human. Well played indeed.',
              '\n\n👏 You earned those coins fair and square. Respect!',
            ];
            resultMessage += loseResponses[Math.floor(Math.random() * loseResponses.length)];
          }

          setTimeout(async () => {
            const resultEmbed = duelManager.buildResultEmbed(
              duel,
              player1User,
              player2User,
              roundResult.winner,
              roundResult.reason
            );
            
            await interaction.editReply({
              content: resultMessage,
              embeds: [resultEmbed],
            });
          }, 1500);
        }
      } catch (error) {
        console.error('Error in bot duel animation:', error);
        clearInterval(interval);
      }
    }, 2000);

  } catch (error) {
    console.error('Error in handleBotChallenge:', error);
    return interaction.editReply({
      content: '❌ An error occurred while starting the bot duel.',
    });
  }
}

/**
 * Handle verification button - removes unverified role when user verifies
 * This works for both main bot and custom bots
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

async function handleDuelButton(interaction, duelManager, economyManager, client) {
  const isAccept = interaction.customId.startsWith('duel_accept_');
  
  const challenge = duelManager.getPendingChallenge(interaction.message.id);
  if (!challenge) {
    return interaction.reply({
      content: '❌ This challenge has expired or is no longer valid.',
      ephemeral: true,
    });
  }

  if (interaction.user.id !== challenge.challengedId) {
    return interaction.reply({
      content: '❌ Only the challenged user can accept or decline this duel!',
      ephemeral: true,
    });
  }

  if (!isAccept) {
    duelManager.removePendingChallenge(interaction.message.id);
    
    const { EmbedBuilder } = require('discord.js');
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

    const player1User = await client.users.fetch(duel.player1.id);
    const player2User = await client.users.fetch(duel.player2.id);

    const initialEmbed = duelManager.buildDuelEmbed(duel, player1User, player2User, null);
    await interaction.editReply({
      content: `⚔️ **THE DUEL HAS BEGUN!**`,
      embeds: [initialEmbed],
      components: [],
    });

    const interval = setInterval(async () => {
      try {
        const roundResult = duelManager.processRound(duel);
        
        const updateEmbed = duelManager.buildDuelEmbed(duel, player1User, player2User, roundResult.log);
        
        await interaction.editReply({
          content: roundResult.isDone ? null : `⚔️ **Round ${duel.round}/${duel.maxRounds}**`,
          embeds: [updateEmbed],
        });

        if (roundResult.isDone) {
          clearInterval(interval);
          
          await duelManager.finishDuel(duel.duelId, roundResult.winner, economyManager);
          
          setTimeout(async () => {
            const resultEmbed = duelManager.buildResultEmbed(
              duel,
              player1User,
              player2User,
              roundResult.winner,
              roundResult.reason
            );
            
            await interaction.editReply({
              content: roundResult.winner === 'draw' 
                ? '🤝 **DUEL ENDED IN A DRAW!**'
                : `🏆 **${roundResult.winner === duel.player1.id ? player1User.username : player2User.username} WINS!**`,
              embeds: [resultEmbed],
            });
          }, 1500);
        }
      } catch (error) {
        console.error('Error in duel animation:', error);
        clearInterval(interval);
      }
    }, 2000);

  } catch (error) {
    console.error('Error in handleDuelButton:', error);
    return interaction.editReply({
      content: '❌ An error occurred while starting the duel.',
      embeds: [],
      components: [],
    });
  }
}

async function handleCombatRankCommand(interaction, combatXPManager) {
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

    const currentLevel = stats.combat_level;
    const currentXP = stats.combat_xp;
    const xpForNext = combatXPManager.xpForNextLevel(currentLevel);
    const xpForCurrent = combatXPManager.xpForLevel(currentLevel);
    const xpProgress = currentXP - xpForCurrent;
    const xpNeeded = xpForNext - xpForCurrent;
    const progressPercent = xpNeeded > 0 ? ((xpProgress / xpNeeded) * 100).toFixed(1) : 100;

    // Generate progress bar
    const barLength = 20;
    const filledLength = Math.round((xpProgress / xpNeeded) * barLength);
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

    const embed = new EmbedBuilder()
      .setColor('#FF4500')
      .setTitle(`⚔️ Combat Stats - ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🏆 Combat Level', value: `${currentLevel}`, inline: true },
        { name: '✨ Combat XP', value: `${currentXP.toLocaleString()}`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { 
          name: '📊 Progress to Next Level', 
          value: `${progressBar}\n${xpProgress.toLocaleString()} / ${xpNeeded.toLocaleString()} XP (${progressPercent}%)`, 
          inline: false 
        },
        { name: '⚔️ Duels Won', value: `${stats.duels_won}`, inline: true },
        { name: '💀 Duels Lost', value: `${stats.duels_lost}`, inline: true },
        { name: '📈 Win Rate', value: `${stats.win_rate}%`, inline: true },
        { name: '🔥 Current Streak', value: `${stats.current_win_streak}`, inline: true },
        { name: '🌟 Best Streak', value: `${stats.highest_win_streak}`, inline: true },
        { name: '🎯 Total Duels', value: `${stats.total_duels}`, inline: true }
      )
      .setFooter({ text: 'Keep dueling to level up and unlock better bonuses!' })
      .setTimestamp();

    // Add bonus info if they have a high level
    if (currentLevel >= 10) {
      const damageBonus = ((combatXPManager.getDamageMultiplier(currentLevel) - 1) * 100).toFixed(0);
      const defenseBonus = ((1 - combatXPManager.getDefenseMultiplier(currentLevel)) * 100).toFixed(0);
      embed.addFields({
        name: '💪 Combat Bonuses',
        value: `+${damageBonus}% Damage | ${defenseBonus}% Damage Reduction`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in handleCombatRankCommand:', error);
    return interaction.editReply({
      content: '❌ An error occurred while loading combat stats.',
    });
  }
}

async function handleCombatLeaderboardCommand(interaction, combatXPManager) {
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

async function handleCasinoCommand(interaction, casinoManager) {
  if (!casinoManager) {
    return interaction.reply({
      content: '❌ Casino system is not available.',
      ephemeral: true,
    });
  }

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

async function handleCasinoButton(interaction, casinoManager, economyManager) {
  if (!casinoManager || !economyManager) {
    return interaction.reply({
      content: '❌ Casino system is not available.',
      ephemeral: true,
    }).catch(() => {});
  }

  const customId = interaction.customId;
  const userId = interaction.user.id;
  const guildId = interaction.guild.id;
  const username = interaction.user.username;
  const avatarUrl = interaction.user.displayAvatarURL();

  // Game selection buttons - show bet modal (must be done BEFORE deferReply)
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

  // Blackjack buttons (hit, stand) - update the existing message
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

  // Coinflip menu button
  if (customId.startsWith('casino_coinflip_') && !customId.startsWith('casino_coinflip_bet_') && !customId.startsWith('casino_coinflip_play_')) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    
    await interaction.deferReply({ ephemeral: true });
    
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

  // Custom bet modal for coinflip
  if (customId.includes('_bet_custom_') && customId.includes('coinflip')) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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

  // Coinflip bet amount selected
  if (customId.startsWith('casino_coinflip_bet_') && !customId.includes('_bet_custom_')) {
    await interaction.deferReply({ ephemeral: true });
    
    const userId = interaction.user.id;
    const parts = customId.split('_');
    const betAmount = parseInt(parts[3]);
    const targetUserId = parts[4];

    if (targetUserId !== userId) {
      return interaction.editReply({
        content: '❌ This is not your interaction.',
      });
    }

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

  // Coinflip play - execute coinflip with GIF
  if (customId.startsWith('casino_coinflip_play_')) {
    await interaction.deferReply({ ephemeral: true });
    
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
    console.log(`🎲 [CustomBot] Calculated coinflip result: ${calculatedResult.coinResult} (choice: ${choice}, won: ${calculatedResult.won})`);

    // Now generate the GIF with the calculated result
    let gifBuffer = null;
    let coinflipGif = null;
    console.log(`🔍 [CustomBot] coinflipGenerator exists: ${!!casinoManager.coinflipGenerator}`);
    if (casinoManager.coinflipGenerator) {
      try {
        console.log(`🎬 [CustomBot] Generating coinflip GIF for ${username} (${choice} -> ${calculatedResult.coinResult})`);
        
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
        
        console.log(`🔍 [CustomBot] GIF buffer received: type=${typeof gifBuffer}, isBuffer=${Buffer.isBuffer(gifBuffer)}, length=${gifBuffer?.length || 0}`);
        if (gifBuffer && Buffer.isBuffer(gifBuffer) && gifBuffer.length > 0) {
          console.log(`✅ [CustomBot] Coinflip GIF generated: ${gifBuffer.length} bytes`);
          const header = gifBuffer.slice(0, 6).toString('ascii');
          console.log(`🔍 [CustomBot] GIF header: ${header} (expected: GIF89a or GIF87a)`);
          if (header.startsWith('GIF')) {
            coinflipGif = new AttachmentBuilder(gifBuffer, {
              name: 'coinflip.gif',
              description: 'Coinflip animation',
            });
            console.log(`✅ [CustomBot] AttachmentBuilder created for coinflip GIF`);
          } else {
            console.error('❌ [CustomBot] Invalid GIF format - header does not start with GIF');
            console.error(`   First 20 bytes (hex): ${gifBuffer.slice(0, 20).toString('hex')}`);
            gifBuffer = null; // Don't use invalid GIF
          }
        } else {
          console.warn('⚠️ [CustomBot] Coinflip GIF generation returned empty or invalid buffer');
          if (gifBuffer) {
            console.warn(`   Type: ${typeof gifBuffer}, IsBuffer: ${Buffer.isBuffer(gifBuffer)}, Length: ${gifBuffer?.length || 0}`);
          }
        }
      } catch (error) {
        console.error('❌ [CustomBot] Error generating coinflip GIF:', error);
        console.error('   Error message:', error.message);
        console.error('   Stack:', error.stack);
        gifBuffer = null; // Ensure it's null on error
        coinflipGif = null;
        // Continue - show result without GIF
      }
    } else {
      console.warn('⚠️ [CustomBot] casinoManager.coinflipGenerator is not initialized!');
      console.warn(`   casinoManager exists: ${!!casinoManager}`);
      console.warn(`   casinoManager.coinflipGenerator: ${casinoManager?.coinflipGenerator ? 'exists' : 'missing'}`);
    }

    // NOW execute the coinflip with the predetermined result
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
      console.error('❌ [CustomBot] Error executing coinflip:', error);
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
          console.log(`✅ [CustomBot] Showing coinflip GIF with "Flipping..." embed: ${gifBuffer.length} bytes`);
          
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
          console.log(`✅ [CustomBot] Coinflip GIF shown, waiting ${gifDuration}ms for animation...`);
          
          // Wait for GIF animation to complete
          await new Promise(resolve => setTimeout(resolve, gifDuration));
          
          console.log(`✅ [CustomBot] GIF animation complete, showing result...`);
        } else {
          console.error(`❌ [CustomBot] Invalid GIF header: ${header}`);
          // Skip GIF, show result immediately
        }
      } else {
        console.log(`⚠️ [CustomBot] No valid GIF attachment, showing result immediately`);
        // Skip GIF, show result immediately
      }
    } catch (error) {
      console.error('❌ [CustomBot] Error showing coinflip GIF:', error);
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
      console.log(`✅ [CustomBot] Coinflip result shown after GIF animation`);
    } catch (error) {
      console.error('❌ [CustomBot] Error sending coinflip result to Discord:', error);
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
        console.error('❌ [CustomBot] Complete failure to send coinflip result:', finalError);
      }
    }
    
    return;
  }

  // All other casino buttons need deferReply
  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply({
    content: '🎰 This casino feature is not yet implemented for custom bots.',
  });
}

async function handleCasinoBetModal(interaction, casinoManager, economyManager) {
  if (!casinoManager || !economyManager) {
    return interaction.reply({
      content: '❌ Casino system is not available.',
      ephemeral: true,
    }).catch(() => {});
  }

  const customId = interaction.customId;
  const gameType = customId.replace('casino_bet_', '');
  const betAmountInput = interaction.fields.getTextInputValue('bet_amount');
  const betAmount = parseInt(betAmountInput);

  if (isNaN(betAmount) || betAmount <= 0) {
    return interaction.reply({
      content: '❌ Invalid bet amount.',
      ephemeral: true,
    });
  }

  const userId = interaction.user.id;
  const guildId = interaction.guild.id;
  const username = interaction.user.username;

  await interaction.deferReply({ ephemeral: true });

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

  // Handle dice game with animated GIF
  if (gameType === 'dice') {
    console.log(`🎲 [Dice] Starting dice game for ${username}`);
    const result = await casinoManager.playDice(guildId, userId, username, betAmount);

    if (!result.success) {
      return interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }

    console.log(`🎲 [Dice] Game result:`, {
      playerRoll: result.playerRoll,
      houseRoll: result.houseRoll,
      result: result.result,
      hasGifBuffer: !!result.gifBuffer,
      gifBufferType: result.gifBuffer ? typeof result.gifBuffer : 'undefined',
      isBuffer: result.gifBuffer ? Buffer.isBuffer(result.gifBuffer) : false,
      gifBufferLength: result.gifBuffer?.length || 0,
    });

    // Check if we have a GIF to show
    let diceGif = null;
    if (result.gifBuffer) {
      console.log(`🎲 [Dice] GIF buffer exists, checking format...`);
      if (Buffer.isBuffer(result.gifBuffer) && result.gifBuffer.length > 0) {
        const header = result.gifBuffer.slice(0, 6).toString('ascii');
        console.log(`🎲 [Dice] GIF header: "${header}"`);
        if (header.startsWith('GIF')) {
          diceGif = new AttachmentBuilder(result.gifBuffer, {
            name: 'dice-roll.gif',
            description: 'Dice roll animation',
          });
          console.log(`✅ [Dice] GIF attachment created: ${result.gifBuffer.length} bytes`);
        } else {
          console.warn(`⚠️ [Dice] Invalid GIF header: "${header}"`);
        }
      } else {
        console.warn(`⚠️ [Dice] gifBuffer is not a valid Buffer or is empty`);
      }
    } else {
      console.warn(`⚠️ [Dice] No gifBuffer in result`);
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
    const playerEmoji = casinoManager.getDiceEmoji(result.playerRoll);
    const houseEmoji = casinoManager.getDiceEmoji(result.houseRoll);
    const resultColor = result.result === 'win' ? '#22C55E' : result.result === 'draw' ? '#F59E0B' : '#EF4444';
    const resultTitle = result.result === 'win' ? '🎉 You Won!' : result.result === 'draw' ? '🤝 Draw!' : '😢 You Lost';

    const resultEmbed = new EmbedBuilder()
      .setColor(resultColor)
      .setTitle(resultTitle)
      .setDescription(
        `🎲 **DICE ROLL** 🎲\n\n` +
        `**You:** ${playerEmoji} **${result.playerRoll}**\n` +
        `**House:** ${houseEmoji} **${result.houseRoll}**\n\n` +
        `${result.result === 'win' ? '✅ Your roll is higher!' : result.result === 'draw' ? '🤝 Both rolled the same!' : '❌ House rolled higher!'}`
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
            : `-${economyManager.formatCoins(betAmount)} coins`,
          inline: true,
        }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_dice_${userId}`)
        .setLabel('🎲 Roll Again')
        .setStyle(ButtonStyle.Primary)
    );

    return interaction.editReply({
      content: null,
      embeds: [resultEmbed],
      files: [], // Remove GIF from result
      components: [row],
    });
  }

  // Handle slots game with animated GIF
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
    
    const resultEmbed = new EmbedBuilder()
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
            : `-${economyManager.formatCoins(Math.abs(result.netResult))} coins`,
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

    return interaction.editReply({
      content: null,
      embeds: [resultEmbed],
      files: [], // Remove GIF from result
      components: [row],
    });
  }

  // Other game types not yet implemented for custom bots
  return interaction.editReply({
    content: `🎰 ${gameType} is not yet implemented for custom bots.`,
  });
}

async function handleHelpCommand(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🤖 Comcraft Commands')
    .setDescription('Available commands for Comcraft bot')
    .addFields(
      { name: '/help', value: 'Show this help message', inline: true },
      { name: '/askai', value: 'Ask the AI assistant', inline: true },
      { name: '/ticket', value: 'Create a support ticket', inline: true },
      { name: '/feedback', value: 'Submit feedback', inline: true },
      { name: '/giveaway', value: 'Manage giveaways', inline: true },
      { name: '/economy', value: 'Economy commands', inline: true },
      { name: '/casino', value: 'Casino games', inline: true },
      { name: '/autorole', value: 'Manage auto-roles', inline: true },
      { name: '/rank', value: 'Check your rank', inline: true },
      { name: '/leaderboard', value: 'View leaderboard', inline: true },
      { name: '/birthday', value: 'Set your birthday', inline: true },
      { name: '/customcommand', value: 'Manage custom commands', inline: true }
    )
    .setFooter({ text: 'Comcraft - Made for Content Creators' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleServerInfoCommand(interaction) {
  const guild = interaction.guild;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📊 ${guild.name} - Server Info`)
    .setThumbnail(guild.iconURL())
    .addFields(
      { name: 'Members', value: guild.memberCount.toString(), inline: true },
      { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
      { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
      { name: 'Created', value: guild.createdAt.toLocaleDateString(), inline: true },
      { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDashboardCommand(interaction, configManager, clientId) {
  const webappUrl = process.env.WEBAPP_URL || 'https://codecraft-solutions.com';
  const dashboardUrl = `${webappUrl}/comcraft/dashboard/${interaction.guild.id}`;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🌐 Comcraft Dashboard')
    .setDescription(`Configure your server: [Open Dashboard](${dashboardUrl})`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Format birthday display with timezone
 */
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

/**
 * Get upcoming birthdays sorted by date
 */
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

      return { ...entry, diff };
    })
    .sort((a, b) => a.diff - b.diff);

  return withDiff;
}

/**
 * Register slash commands for a bot
 */
async function registerCommands(client, clientId, isCustomBot = false, guildId = null, token = null) {
  const { SlashCommandBuilder, REST, Routes } = require('discord.js');

  // Use provided token, or fall back to client.token
  const botToken = token || client.token;
  
  if (!botToken) {
    console.error('❌ Cannot register commands: no token available');
    return;
  }

  // Get all command builders from bot-comcraft.js
  // Note: This is a simplified version - you'll need to copy all commands from bot-comcraft.js
  const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Show available commands'),
    new SlashCommandBuilder()
      .setName('askai')
      .setDescription('Ask the ComCraft AI assistant a question')
      .addStringOption((option) =>
        option
          .setName('prompt')
          .setDescription('Your question for the AI')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Check your rank')
      .addUserOption((option) => option.setName('user').setDescription('User to check').setRequired(false)),
    new SlashCommandBuilder().setName('leaderboard').setDescription('View leaderboard'),
    new SlashCommandBuilder()
      .setName('setxp')
      .setDescription('Set XP for a user (Admin only)')
      .addUserOption((option) => option.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption((option) => option.setName('xp').setDescription('XP amount').setRequired(true)),
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warn a user')
      .addUserOption((option) => option.setName('user').setDescription('User to warn').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true)),
    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Mute a user')
      .addUserOption((option) => option.setName('user').setDescription('User to mute').setRequired(true))
      .addIntegerOption((option) => option.setName('duration').setDescription('Duration in minutes').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)),
    new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Unmute a user')
      .addUserOption((option) => option.setName('user').setDescription('User to unmute').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)),
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a user')
      .addUserOption((option) => option.setName('user').setDescription('User to kick').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)),
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a user')
      .addUserOption((option) => option.setName('user').setDescription('User to ban').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false))
      .addIntegerOption((option) => option.setName('duration').setDescription('Ban duration in minutes (optional)').setRequired(false))
      .addIntegerOption((option) => option.setName('days').setDescription('Days of messages to delete (0-7)').setRequired(false)),
    new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Timeout a user (Discord native)')
      .addUserOption((option) => option.setName('user').setDescription('User to timeout').setRequired(true))
      .addIntegerOption((option) => option.setName('duration').setDescription('Duration in minutes').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)),
    new SlashCommandBuilder()
      .setName('untimeout')
      .setDescription('Remove timeout from a user')
      .addUserOption((option) => option.setName('user').setDescription('User to untimeout').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(false)),
    new SlashCommandBuilder()
      .setName('case')
      .setDescription('View a moderation case')
      .addIntegerOption((option) => option.setName('case').setDescription('Case ID').setRequired(true)),
    new SlashCommandBuilder()
      .setName('appeal')
      .setDescription('Submit a moderation appeal')
      .addIntegerOption((option) => option.setName('case').setDescription('Case ID (optional)').setRequired(false)),
    new SlashCommandBuilder()
      .setName('verify')
      .setDescription('Verify with your in-game username (one-time per server)')
      .addStringOption((option) =>
        option.setName('username').setDescription('Your in-game username').setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('verify-set')
      .setDescription('[Admin] Set or update a member\'s verified in-game username')
      .addUserOption((option) => option.setName('user').setDescription('User to update').setRequired(true))
      .addStringOption((option) =>
        option.setName('username').setDescription('New in-game username').setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('close')
      .setDescription('[Mod] Lock a channel so no one can send messages')
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason for closing the channel')
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName('unlock')
      .setDescription('[Mod] Unlock a channel so everyone can send messages again')
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason for unlocking the channel')
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName('customcommand')
      .setDescription('Manage custom commands')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('create')
          .setDescription('Create a custom command')
          .addStringOption((option) => option.setName('name').setDescription('Command name').setRequired(true))
          .addStringOption((option) => option.setName('response').setDescription('Command response').setRequired(true))
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('delete')
          .setDescription('Delete a custom command')
          .addStringOption((option) => option.setName('name').setDescription('Command name').setRequired(true))
      )
      .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List all custom commands')),
    // Birthday commands
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
              .addChannelTypes(require('discord.js').ChannelType.GuildText)
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
    new SlashCommandBuilder()
      .setName('feedback')
      .setDescription('[Mod] Manage the feedback queue')
      .setDefaultMemberPermissions(require('discord.js').PermissionFlagsBits.ManageMessages)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('setup')
          .setDescription('Place the queue message in a channel')
          .addChannelOption((option) =>
            option
              .setName('kanaal')
              .setDescription('Channel for the feedback queue')
              .addChannelTypes(require('discord.js').ChannelType.GuildText)
              .setRequired(true)
          )
          .addRoleOption((option) =>
            option
              .setName('rol')
              .setDescription('Optioneel: rol die nodig is om in te dienen')
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
              .setDescription('Optionele moderator-notitie')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('queue')
          .setDescription('Bekijk de wachtrij')
      ),
    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('[Admin] Manage giveaways')
      .setDefaultMemberPermissions(require('discord.js').PermissionFlagsBits.ManageGuild)
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
              .addChannelTypes(require('discord.js').ChannelType.GuildText)
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
      .setName('balance')
      .setDescription('Check your balance')
      .addUserOption((option) => option.setName('user').setDescription('User to check').setRequired(false)),
    new SlashCommandBuilder().setName('daily').setDescription('Claim your daily reward'),
    new SlashCommandBuilder()
      .setName('pay')
      .setDescription('Pay a user')
      .addUserOption((option) => option.setName('user').setDescription('User to pay').setRequired(true))
      .addIntegerOption((option) => option.setName('amount').setDescription('Amount').setRequired(true)),
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
    new SlashCommandBuilder().setName('casino').setDescription('🎰 Open the casino menu'),
    new SlashCommandBuilder().setName('serverinfo').setDescription('View server information'),
    new SlashCommandBuilder().setName('dashboard').setDescription('Get dashboard link'),
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
              .setDescription('Subject of the ticket')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('close')
          .setDescription('Close the current ticket')
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
          .setDescription('Add a user to the ticket')
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
          .setDescription('Remove a user from the ticket')
          .addUserOption((option) =>
            option
              .setName('user')
              .setDescription('User to remove')
              .setRequired(true)
          )
      ),
    new SlashCommandBuilder().setName('ticket-setup').setDescription('Setup ticket system (Admin only)'),
    new SlashCommandBuilder().setName('ticket-stats').setDescription('View ticket statistics (Admin only)'),
    new SlashCommandBuilder().setName('ticket-panel').setDescription('Create ticket panel (Admin only)'),
    new SlashCommandBuilder()
      .setName('autorole')
      .setDescription('Manage auto-roles')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('Add an auto-role')
          .addRoleOption((option) => option.setName('role').setDescription('Role').setRequired(true))
      ),
  ];

  // Add music commands if music manager is initialized
  if (musicCommands) {
    try {
      const musicCmds = musicCommands.getCommands();
      commands.push(...musicCmds);
      console.log(`✅ Added ${musicCmds.length} music commands to registration`);
    } catch (error) {
      console.warn('⚠️ Failed to add music commands:', error.message);
    }
  }

  // Add vote kick commands
  if (client.voteKickCommands) {
    try {
      const voteKickCmds = client.voteKickCommands.getCommands();
      commands.push(...voteKickCmds);
      console.log(`✅ Added ${voteKickCmds.length} vote kick commands to registration`);
    } catch (error) {
      console.warn('⚠️ Failed to add vote kick commands:', error.message);
    }
  }

  const commandsJson = commands.map((command) => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(botToken);

  try {
    console.log('📝 Registering slash commands...');

    // For custom bots, register commands for the specific guild (instant update)
    if (isCustomBot && guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`✅ Successfully registered slash commands for custom bot in guild ${guildId}`);
    } else if (process.env.GUILD_ID) {
      // For main bot, use GUILD_ID if set (instant update)
      await rest.put(Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), { body: commands });
      console.log(`✅ Successfully registered slash commands for guild ${process.env.GUILD_ID}`);
    } else {
      // Register commands globally (takes up to 1 hour)
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ Successfully registered slash commands globally (may take up to 1 hour to appear)');
    }
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

/**
 * Sync all guilds to database
 */
async function syncGuildsToDatabase(client, configManager) {
  console.log('🔄 Syncing all guilds to database...');
  let syncedCount = 0;
  let errorCount = 0;

  for (const guild of client.guilds.cache.values()) {
    try {
      let owner;
      try {
        owner = await guild.fetchOwner();
      } catch (error) {
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
}

// ================================================================
// SHOP COMMAND HANDLERS
// ================================================================

/**
 * Show shop with available items
 */
async function handleShopCommand(interaction, itemManager, economyManager) {
  if (!itemManager) {
    return interaction.reply({
      content: '❌ Shop system is niet beschikbaar.',
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
    .setDescription('Gebruik `/buy <item>` om een item te kopen!')
    .setTimestamp();

  // Group items by type
  const grouped = {
    weapon: [],
    armor: [],
    consumable: [],
  };

  for (const item of items) {
    grouped[item.item_type]?.push(item);
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
      if (item.crit_bonus) stats.push(`+${item.crit_bonus}%🎯`);

      const statsStr = stats.length > 0 ? ` [${stats.join(' ')}]` : '';
      const stock = item.max_stock ? ` (${item.current_stock}/${item.max_stock} in stock)` : '';

      return `**${item.name}** - ${economyManager.formatCoins(item.price)}${statsStr}${stock}`;
    });

    embed.addFields({ name: `${icon} ${title}`, value: lines.join('\n'), inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Buy an item from the shop
 */
async function handleBuyCommand(interaction, itemManager, inventoryManager, economyManager) {
  if (!itemManager || !inventoryManager || !economyManager) {
    return interaction.reply({
      content: '❌ Shop system is niet beschikbaar.',
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
    .setTitle('✅ Aankoop Succesvol!')
    .setDescription(`Je hebt **${quantity}x ${item.name}** gekocht voor ${economyManager.formatCoins(totalCost)}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Sell an item from inventory
 */
async function handleSellCommand(interaction, itemManager, inventoryManager, economyManager) {
  if (!itemManager || !inventoryManager || !economyManager) {
    return interaction.reply({
      content: '❌ Inventory system is niet beschikbaar.',
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
    .setTitle('💸 Verkoop Succesvol!')
    .setDescription(`Je hebt **${quantity}x ${item.name}** verkocht voor ${economyManager.formatCoins(totalValue)}`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * View player inventory
 */
async function handleInventoryCommand(interaction, inventoryManager) {
  if (!inventoryManager) {
    return interaction.reply({
      content: '❌ Inventory system is niet beschikbaar.',
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
    embed.addFields({ name: '⚡ Uitgerust', value: equipped.join('\n'), inline: false });
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
 * Equip a weapon or armor
 */
async function handleEquipCommand(interaction, inventoryManager) {
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
 * Handle equip item selection from select menu
 */
async function handleEquipItemSelect(interaction, inventoryManager) {
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
 * Unequip a weapon or armor
 */
async function handleUnequipCommand(interaction, inventoryManager) {
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

module.exports = { setupBotHandlers, handleMediaReplyButton };

