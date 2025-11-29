/**
 * Custom Bot Manager
 * Manages multiple bot instances for bot-personalizer feature
 * Each custom bot token gets its own bot instance
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

class CustomBotManager {
  constructor() {
    this.customBots = new Map(); // Map<guildId, Client>
    this.botConfigs = new Map(); // Map<guildId, config>
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️ CustomBotManager: Supabase not configured. Custom bots will not be started.');
      this.supabase = null;
    } else {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }

  /**
   * Get all custom bots from database that should be started
   * Returns bots where setup_completed = true and bot_token exists
   * EXCLUDES bots that run on Pterodactyl (they have their own containers)
   */
  async getCustomBotsToStart() {
    if (!this.supabase) {
      return { data: [], error: null };
    }

    try {
      // Get all bots where setup_completed = true
      // EXCLUDE bots that run on Pterodactyl (runs_on_pterodactyl = true)
      // Those bots have their own dedicated containers and shouldn't run here
      const { data: allBotsData, error: fetchError } = await this.supabase
        .from('custom_bot_tokens')
        .select('*')
        .eq('setup_completed', true)
        .or('runs_on_pterodactyl.is.null,runs_on_pterodactyl.eq.false');
      
      if (fetchError) {
        console.error('❌ [CustomBotManager] Error fetching custom bot tokens:', fetchError);
        return { data: [], error: fetchError };
      }
      
      // Filter out bots without a valid token (client-side filter)
      // Also double-check that Pterodactyl bots are excluded (in case DB query didn't filter them)
      const customBots = (allBotsData || []).filter(bot => {
        // Skip bots without valid token
        if (!bot.bot_token || bot.bot_token.trim().length === 0) {
          return false;
        }
        
        // Skip bots that run on Pterodactyl (they have dedicated containers)
        if (bot.runs_on_pterodactyl === true) {
          console.log(`⏭️ [CustomBotManager] Skipping bot for guild ${bot.guild_id} (${bot.bot_username || 'Unknown'}) - runs on Pterodactyl`);
          return false;
        }
        
        return true;
      });
      
      // Debug logging if bots found but none have tokens
      if (allBotsData && allBotsData.length > 0 && customBots.length === 0) {
        console.log(`⚠️ [CustomBotManager] Found ${allBotsData.length} bot(s) with setup_completed = true, but none have a valid token`);
        allBotsData.forEach(bot => {
          const tokenPreview = bot.bot_token ? `${bot.bot_token.substring(0, 10)}...` : 'null';
          console.log(`   - Guild: ${bot.guild_id}`);
          console.log(`     setup_completed: ${bot.setup_completed}`);
          console.log(`     is_active: ${bot.is_active}`);
          console.log(`     has_token: ${!!bot.bot_token}`);
          console.log(`     token_length: ${bot.bot_token ? bot.bot_token.length : 0}`);
          console.log(`     token_preview: ${tokenPreview}`);
          console.log(`     username: ${bot.bot_username || 'Unknown'}`);
        });
      }
      
      // Log summary
      if (customBots.length > 0) {
        console.log(`✅ [CustomBotManager] Found ${customBots.length} custom bot(s) with valid tokens to start`);
        customBots.forEach(bot => {
          console.log(`   - Guild: ${bot.guild_id}, Bot: ${bot.bot_username || 'Unknown'}, is_active: ${bot.is_active}, has_token: ${!!bot.bot_token}`);
        });
      }
      
      return { data: customBots, error: null };
    } catch (error) {
      console.error('❌ [CustomBotManager] Error in getCustomBotsToStart:', error);
      return { data: [], error };
    }
  }

  /**
   * Initialize and start all custom bots from database
   */
  async initialize() {
    if (!this.supabase) {
      console.warn('⚠️ CustomBotManager: Supabase not configured, skipping custom bot initialization');
      return;
    }

    try {
      console.log('🔄 [CustomBotManager] Loading custom bot tokens from database...');
      
      // Get all bots that should be started
      const { data: customBots, error } = await this.getCustomBotsToStart();

      if (error) {
        console.error('❌ [CustomBotManager] Error loading custom bot tokens:', error);
        console.error('   Error details:', JSON.stringify(error, null, 2));
        return;
      }

      if (!customBots || customBots.length === 0) {
        console.log('ℹ️ [CustomBotManager] No custom bots found in database');
        console.log('   Query: setup_completed = true AND bot_token IS NOT NULL');
        
        // Debug: Check what's actually in the database
        try {
          const { data: allBots, error: debugError } = await this.supabase
            .from('custom_bot_tokens')
            .select('guild_id, setup_completed, is_active, bot_token, bot_username')
            .limit(10);
          
          if (!debugError && allBots && allBots.length > 0) {
            console.log(`   📊 Found ${allBots.length} bot(s) in database (showing first 10):`);
            allBots.forEach(bot => {
              console.log(`      - Guild: ${bot.guild_id}, setup_completed: ${bot.setup_completed}, is_active: ${bot.is_active}, has_token: ${!!bot.bot_token}, token_length: ${bot.bot_token ? bot.bot_token.length : 0}, username: ${bot.bot_username || 'Unknown'}`);
            });
          } else if (allBots && allBots.length === 0) {
            console.log('   📊 No bots found in database at all');
          } else {
            console.log('   ⚠️ Could not check database contents:', debugError);
          }
        } catch (debugError) {
          console.log('   ⚠️ Could not check database contents:', debugError);
        }
        
        return;
      }

      console.log(`📊 [CustomBotManager] Found ${customBots.length} custom bot(s) to start`);
      console.log(`📋 [CustomBotManager] Custom bots to start: ${customBots.map(b => `${b.bot_username || 'Unknown'} (Guild: ${b.guild_id})`).join(', ')}`);

      let startedCount = 0;
      let failedCount = 0;

      for (const botConfig of customBots) {
        try {
          await this.startCustomBot(botConfig);
          startedCount++;
        } catch (error) {
          console.error(`❌ [CustomBotManager] Error starting custom bot for guild ${botConfig.guild_id}:`, error.message);
          failedCount++;
        }
      }

      console.log(`✅ [CustomBotManager] Initialization complete: ${startedCount} started, ${failedCount} failed`);
    } catch (error) {
      console.error('❌ [CustomBotManager] Error initializing custom bot manager:', error);
    }
  }

  /**
   * Start a custom bot instance
   */
  async startCustomBot(botConfig) {
    const { guild_id, bot_token, bot_application_id, bot_username } = botConfig;

    // Check if bot is already running
    if (this.customBots.has(guild_id)) {
      const existingClient = this.customBots.get(guild_id);
      const isOnline = existingClient && existingClient.isReady();
      console.log(`⚠️ [CustomBotManager] Custom bot for guild ${guild_id} (${bot_username}) is already ${isOnline ? 'online' : 'offline'}`);
      return;
    }

    try {
      console.log(`🚀 [CustomBotManager] Starting custom bot for guild ${guild_id} (${bot_username || 'Unknown'})...`);
      console.log(`   📋 Bot Application ID: ${bot_application_id || 'Unknown'}`);
      console.log(`   📋 Token: ${bot_token ? `${bot_token.substring(0, 10)}...` : 'Missing'}`);

      // Create a new Discord client for this custom bot
      const customClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.GuildMessageReactions,
          GatewayIntentBits.GuildVoiceStates
        ],
        partials: [Partials.Message, Partials.Channel, Partials.Reaction]
      });

      // Add additional event listeners for debugging (before setupBotHandlers)
      customClient.on('error', (error) => {
        console.error(`❌ [CustomBotManager] Error in custom bot for guild ${guild_id}:`, error.message);
        if (error.stack) {
          console.error(`   Stack:`, error.stack);
        }
      });

      customClient.on('warn', (warning) => {
        console.warn(`⚠️ [CustomBotManager] Warning in custom bot for guild ${guild_id}:`, warning);
      });

      customClient.on('reconnecting', () => {
        console.log(`🔄 [CustomBotManager] Custom bot for guild ${guild_id} reconnecting...`);
      });

      // Set up event handlers (same as main bot) - MUST be called before login
      console.log(`   🔧 Setting up event handlers...`);
      const handlers = await this.setupCustomBotEvents(customClient, botConfig);
      
      // Store handlers on client for later access (subscriber notifications, etc.)
      customClient.handlers = handlers;

      // Login with custom bot token
      console.log(`   🔐 Logging in to Discord...`);
      await customClient.login(bot_token);

      // Store bot instance
      this.customBots.set(guild_id, customClient);
      this.botConfigs.set(guild_id, botConfig);

      // Wait a bit for the bot to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if bot is ready
      if (customClient.isReady()) {
        console.log(`✅ [CustomBotManager] Custom bot for guild ${guild_id} (${customClient.user.tag}) started successfully`);
        console.log(`   📊 Bot is in ${customClient.guilds.cache.size} server(s)`);
      } else {
        console.log(`⏳ [CustomBotManager] Custom bot for guild ${guild_id} is starting (not ready yet)`);
      }

      // Update database status
      await this.updateBotStatus(guild_id, customClient.isReady(), customClient.guilds.cache.size);
    } catch (error) {
      console.error(`❌ [CustomBotManager] Error starting custom bot for guild ${guild_id}:`, error.message);
      if (error.stack) {
        console.error(`   Stack:`, error.stack);
      }
      await this.updateBotStatus(guild_id, false);
      throw error;
    }
  }

  /**
   * Set up event handlers for custom bot
   * Uses the same setup function as the main bot to ensure full functionality
   */
  async setupCustomBotEvents(client, botConfig) {
    const { guild_id, bot_application_id, bot_token } = botConfig;

    try {
      // Import the setup function
      const { setupBotHandlers } = require('./setup-bot-handlers');

      // Setup all handlers (same as main bot)
      // Use onReady callback to update database status when bot is ready
      const handlers = await setupBotHandlers(client, {
        isCustomBot: true,
        guildId: guild_id,
        botApplicationId: bot_application_id,
        botToken: bot_token, // Pass token for command registration
        onReady: async (client, { guildId }) => {
          // Update status in database when bot is ready
          console.log(`✅ [CustomBotManager] Custom bot ${client.user.tag} is READY for guild ${guildId}`);
          console.log(`   📊 Bot is in ${client.guilds.cache.size} server(s)`);
          console.log(`   📊 Bot ID: ${client.user.id}`);
          console.log(`   📊 Bot status: ${client.user.presence?.status || 'unknown'}`);
          
          // Check if bot is in the target guild
          const isInTargetGuild = client.guilds.cache.has(guildId);
          console.log(`   📊 Bot is in target guild (${guildId}): ${isInTargetGuild ? 'YES' : 'NO'}`);
          
          // Log all guilds the bot is in
          if (client.guilds.cache.size > 0) {
            client.guilds.cache.forEach(guild => {
              console.log(`   📋 Guild: ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
            });
          } else {
            console.log(`   ⚠️ Bot is not in any servers yet`);
          }
          
          // Load and apply custom bot presence from database
          if (this.supabase) {
            try {
              const { data: botConfig } = await this.supabase
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
                console.log(`📊 Custom bot presence applied: ${botConfig.bot_presence_type} - ${botConfig.bot_presence_text}`);
              }
            } catch (error) {
              console.error('❌ Error loading custom bot presence:', error);
            }
          }

          // Set up periodic presence update check (every 30 seconds)
          // This allows presence to be updated without bot restart
          setInterval(async () => {
            if (this.supabase && client.user) {
              try {
                const { data: botConfig } = await this.supabase
                  .from('custom_bot_tokens')
                  .select('bot_presence_type, bot_presence_text')
                  .eq('guild_id', guildId)
                  .single();

                if (botConfig && botConfig.bot_presence_text) {
                  const activityTypeMap = {
                    'playing': 0,
                    'streaming': 1,
                    'listening': 2,
                    'watching': 3,
                    'competing': 5
                  };
                  
                  const activityType = activityTypeMap[botConfig.bot_presence_type || 'watching'] || 3;
                  const currentActivity = client.user.presence?.activities?.[0];
                  
                  // Only update if different from current
                  if (!currentActivity || 
                      currentActivity.name !== botConfig.bot_presence_text || 
                      currentActivity.type !== activityType) {
                    client.user.setActivity(botConfig.bot_presence_text, { type: activityType });
                    console.log(`🔄 Updated custom bot presence: ${botConfig.bot_presence_type} - ${botConfig.bot_presence_text}`);
                  }
                }
              } catch (error) {
                // Silently ignore - bot might be offline or config might not exist yet
              }
            }
          }, 30000); // Check every 30 seconds
          
          // Update bot status and is_active in database
          await this.updateBotStatus(guildId, true, client.guilds.cache.size);
          
          // Update is_active based on whether bot is in the target guild
          if (this.supabase) {
            try {
              const { error: updateError } = await this.supabase
                .from('custom_bot_tokens')
                .update({
                  is_active: isInTargetGuild,
                  updated_at: new Date().toISOString()
                })
                .eq('guild_id', guildId);
              
              if (updateError) {
                console.error(`❌ [CustomBotManager] Error updating is_active for guild ${guildId}:`, updateError);
              } else {
                console.log(`✅ [CustomBotManager] Updated is_active for guild ${guildId}: ${isInTargetGuild}`);
              }
            } catch (error) {
              console.error(`❌ [CustomBotManager] Error updating is_active for guild ${guildId}:`, error);
            }
          }
        },
      });

      // Add guildCreate handler to update is_active when bot joins target guild
      client.on('guildCreate', async (guild) => {
        if (guild.id === guild_id) {
          console.log(`✅ [CustomBotManager] Custom bot joined target guild ${guild_id} (${guild.name})`);
          
          // Update is_active to true since bot is now in the target guild
          if (this.supabase) {
            try {
              const { error: updateError } = await this.supabase
                .from('custom_bot_tokens')
                .update({
                  is_active: true,
                  updated_at: new Date().toISOString()
                })
                .eq('guild_id', guild_id);
              
              if (updateError) {
                console.error(`❌ [CustomBotManager] Error updating is_active for guild ${guild_id}:`, updateError);
              } else {
                console.log(`✅ [CustomBotManager] Updated is_active for guild ${guild_id}: true (bot is in target guild)`);
              }
            } catch (error) {
              console.error(`❌ [CustomBotManager] Error updating is_active for guild ${guild_id}:`, error);
            }
          }
        }
      });

      // Add guildDelete handler to update is_active when bot leaves target guild
      client.on('guildDelete', async (guild) => {
        if (guild.id === guild_id) {
          console.log(`⚠️ [CustomBotManager] Custom bot left target guild ${guild_id} (${guild.name})`);
          
          // Update is_active to false since bot is no longer in the target guild
          if (this.supabase) {
            try {
              const { error: updateError } = await this.supabase
                .from('custom_bot_tokens')
                .update({
                  is_active: false,
                  updated_at: new Date().toISOString()
                })
                .eq('guild_id', guild_id);
              
              if (updateError) {
                console.error(`❌ [CustomBotManager] Error updating is_active for guild ${guild_id}:`, updateError);
              } else {
                console.log(`✅ [CustomBotManager] Updated is_active for guild ${guild_id}: false (bot left target guild)`);
              }
            } catch (error) {
              console.error(`❌ [CustomBotManager] Error updating is_active for guild ${guild_id}:`, error);
            }
          }
        }
      });

      // Add disconnect handler to update database status (additional to setupBotHandlers)
      client.on('disconnect', async () => {
        console.log(`🔌 [CustomBotManager] Custom bot for guild ${guild_id} disconnected`);
        console.log(`   📊 Bot was in ${client.guilds.cache.size} server(s)`);
        await this.updateBotStatus(guild_id, false);
      });

      console.log(`✅ [CustomBotManager] Custom bot handlers setup complete for guild ${guild_id}`);
      
      // Return handlers for storage in client object
      return handlers;
    } catch (error) {
      console.error(`❌ [CustomBotManager] Error setting up custom bot handlers for guild ${guild_id}:`, error.message);
      if (error.stack) {
        console.error(`   Stack:`, error.stack);
      }
      throw error;
    }
  }

  /**
   * Stop a custom bot instance
   */
  async stopCustomBot(guildId) {
    const client = this.customBots.get(guildId);
    const botConfig = this.botConfigs.get(guildId);
    
    if (!client) {
      console.log(`⚠️ [CustomBotManager] No custom bot found for guild ${guildId}`);
      return;
    }

    try {
      const botUsername = botConfig?.bot_username || 'Unknown';
      const isOnline = client.isReady();
      
      console.log(`🛑 [CustomBotManager] Stopping custom bot for guild ${guildId} (${botUsername})...`);
      console.log(`   📊 Bot was ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      console.log(`   📊 Bot was in ${client.guilds.cache.size} server(s)`);
      
      // Update database status
      await this.updateBotStatus(guildId, false);
      
      // Destroy client
      client.destroy();
      
      // Remove from maps
      this.customBots.delete(guildId);
      this.botConfigs.delete(guildId);
      
      console.log(`✅ [CustomBotManager] Custom bot for guild ${guildId} stopped successfully`);
    } catch (error) {
      console.error(`❌ [CustomBotManager] Error stopping custom bot for guild ${guildId}:`, error.message);
      if (error.stack) {
        console.error(`   Stack:`, error.stack);
      }
    }
  }

  /**
   * Update bot status in database
   */
  async updateBotStatus(guildId, isOnline, totalGuilds = null) {
    if (!this.supabase) return;

    try {
      const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
      console.log(`📊 [CustomBotManager] Updating bot status for guild ${guildId}: ${statusText}${totalGuilds !== null ? ` (${totalGuilds} servers)` : ''}`);

      const updateData = {
        bot_online: isOnline,
        last_seen: isOnline ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      };

      if (totalGuilds !== null) {
        updateData.total_guilds = totalGuilds;
      }

      const { error } = await this.supabase
        .from('custom_bot_tokens')
        .update(updateData)
        .eq('guild_id', guildId);

      if (error) {
        console.error(`❌ [CustomBotManager] Error updating bot status for guild ${guildId}:`, error);
      } else {
        console.log(`✅ [CustomBotManager] Bot status updated for guild ${guildId}: ${statusText}`);
      }
    } catch (error) {
      console.error(`❌ [CustomBotManager] Error updating bot status for guild ${guildId}:`, error);
    }
  }

  /**
   * Check if a guild has a custom bot
   */
  hasCustomBot(guildId) {
    return this.customBots.has(guildId);
  }

  /**
   * Get custom bot client for a guild
   */
  getCustomBotClient(guildId) {
    return this.customBots.get(guildId);
  }

  /**
   * Reload custom bots from database
   */
  async reload() {
    // Stop all existing bots
    for (const guildId of this.customBots.keys()) {
      await this.stopCustomBot(guildId);
    }

    // Reinitialize
    await this.initialize();
  }

  /**
   * Start polling for new custom bots
   */
  startPolling(intervalMs = 60000) {
    // Check for new custom bots every minute
    this.pollingInterval = setInterval(async () => {
      try {
        await this.checkForNewBots();
      } catch (error) {
        console.error('❌ Error checking for new custom bots:', error);
      }
    }, intervalMs);

    console.log(`🔄 Started polling for new custom bots (every ${intervalMs / 1000} seconds)`);
  }

  /**
   * Stop polling for new custom bots
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('🛑 Stopped polling for new custom bots');
    }
  }

  /**
   * Check for new custom bots in database and start them
   */
  async checkForNewBots() {
    if (!this.supabase) return;

    try {
      console.log(`🔄 [CustomBotManager] Checking for new custom bots...`);
      
      // Get all bots that should be started
      const { data: customBots, error } = await this.getCustomBotsToStart();

      if (error) {
        console.error('❌ [CustomBotManager] Error checking for new custom bots:', error);
        return;
      }

      if (!customBots || customBots.length === 0) {
        console.log(`ℹ️ [CustomBotManager] No active custom bots found in database`);
        return;
      }

      console.log(`📊 [CustomBotManager] Found ${customBots.length} active custom bot(s) in database`);
      console.log(`📊 [CustomBotManager] Currently running: ${this.customBots.size} custom bot(s)`);

      let startedCount = 0;
      let stoppedCount = 0;

      // Start bots that are not running yet
      for (const botConfig of customBots) {
        if (!this.customBots.has(botConfig.guild_id)) {
          try {
            console.log(`🔄 [CustomBotManager] Found new custom bot for guild ${botConfig.guild_id} (${botConfig.bot_username || 'Unknown'}), starting...`);
            await this.startCustomBot(botConfig);
            startedCount++;
          } catch (error) {
            console.error(`❌ [CustomBotManager] Error starting new custom bot for guild ${botConfig.guild_id}:`, error.message);
          }
        }
      }

      // Stop bots that are no longer in database, have setup_completed = false, or have no token
      for (const [guildId, client] of this.customBots.entries()) {
        const botConfig = customBots.find(b => b.guild_id === guildId);
        // Stop bot if:
        // 1. Not found in database
        // 2. setup_completed = false
        // 3. No bot_token
        if (!botConfig || !botConfig.setup_completed || !botConfig.bot_token) {
          const reason = !botConfig 
            ? 'not found in database' 
            : !botConfig.setup_completed 
            ? 'setup_completed = false' 
            : 'no bot_token';
          console.log(`🔄 [CustomBotManager] Custom bot for guild ${guildId} should be stopped (${reason}), stopping...`);
          await this.stopCustomBot(guildId);
          stoppedCount++;
        }
      }

      if (startedCount > 0 || stoppedCount > 0) {
        console.log(`✅ [CustomBotManager] Polling complete: ${startedCount} started, ${stoppedCount} stopped`);
      }
    } catch (error) {
      console.error('❌ [CustomBotManager] Error in checkForNewBots:', error);
    }
  }

  /**
   * Log status of all custom bots
   */
  async logBotStatus() {
    console.log(`\n📊 [CustomBotManager] ========== Custom Bot Status ==========`);
    console.log(`📊 [CustomBotManager] Total custom bots: ${this.customBots.size}`);
    
    if (this.customBots.size === 0) {
      console.log(`ℹ️ [CustomBotManager] No custom bots are currently running`);
      return;
    }

    let onlineCount = 0;
    let offlineCount = 0;

    for (const [guildId, client] of this.customBots.entries()) {
      const botConfig = this.botConfigs.get(guildId);
      const isOnline = client && client.isReady();
      const botUsername = botConfig?.bot_username || client?.user?.tag || 'Unknown';
      const botId = client?.user?.id || botConfig?.bot_application_id || 'Unknown';
      const guildCount = client?.guilds.cache.size || 0;
      const status = isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';

      if (isOnline) onlineCount++;
      else offlineCount++;

      console.log(`\n   ${status} Guild: ${guildId}`);
      console.log(`      Bot: ${botUsername} (${botId})`);
      console.log(`      Servers: ${guildCount}`);
      console.log(`      Last seen: ${botConfig?.last_seen ? new Date(botConfig.last_seen).toLocaleString() : 'Never'}`);
      
      if (isOnline && client.guilds.cache.size > 0) {
        client.guilds.cache.forEach(guild => {
          console.log(`      📋 - ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
        });
      }
    }

    console.log(`\n📊 [CustomBotManager] Summary: ${onlineCount} online, ${offlineCount} offline`);
    console.log(`📊 [CustomBotManager] =========================================\n`);
  }

  /**
   * Start periodic status logging
   */
  startStatusLogging(intervalMs = 300000) {
    // Log status every 5 minutes
    this.statusLoggingInterval = setInterval(async () => {
      try {
        await this.logBotStatus();
      } catch (error) {
        console.error('❌ [CustomBotManager] Error logging bot status:', error);
      }
    }, intervalMs);

    console.log(`📊 [CustomBotManager] Started periodic status logging (every ${intervalMs / 1000} seconds)`);
    
    // Log status immediately
    this.logBotStatus();
  }

  /**
   * Stop periodic status logging
   */
  stopStatusLogging() {
    if (this.statusLoggingInterval) {
      clearInterval(this.statusLoggingInterval);
      this.statusLoggingInterval = null;
      console.log('🛑 [CustomBotManager] Stopped periodic status logging');
    }
  }
}

module.exports = new CustomBotManager();

