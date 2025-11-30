/**
 * Top.gg Integration Manager
 * Handles bot statistics posting and vote rewards
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');

class TopGGManager {
  constructor(client, customBotManager = null) {
    this.client = client;
    this.customBotManager = customBotManager;
    this.topggToken = process.env.TOPGG_TOKEN;
    this.topggWebhookAuth = process.env.TOPGG_WEBHOOK_AUTH;
    this.discordBotListToken = process.env.DISCORDBOTLIST_TOKEN;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.postingInterval = null;
    this.isPosting = false;
  }

  /**
   * Initialize Top.gg integration
   */
  async initialize() {
    if (!this.topggToken) {
      console.log('⚠️  [Top.gg] No TOPGG_TOKEN found in environment, skipping Top.gg integration');
      return false;
    }

    try {
      // Install topgg-autoposter if not already installed
      let AutoPoster;
      try {
        // According to topgg-autoposter docs: const { AutoPoster } = require('topgg-autoposter');
        const topggAutoposter = require('topgg-autoposter');
        
        // Try different import patterns
        if (topggAutoposter.AutoPoster) {
          // Named export: { AutoPoster }
          AutoPoster = topggAutoposter.AutoPoster;
        } else if (topggAutoposter.default) {
          // Default export with AutoPoster property
          AutoPoster = topggAutoposter.default.AutoPoster || topggAutoposter.default;
        } else if (typeof topggAutoposter === 'function') {
          // The whole module is the function
          AutoPoster = topggAutoposter;
        } else {
          // Debug: log what we got
          console.error('❌ [Top.gg] Could not find AutoPoster in package');
          console.error('   Package type:', typeof topggAutoposter);
          console.error('   Package keys:', Object.keys(topggAutoposter || {}));
          throw new Error('AutoPoster not found in topgg-autoposter package');
        }
      } catch (error) {
        if (error.message.includes('Cannot find module')) {
          console.error('❌ [Top.gg] topgg-autoposter package not found. Install it with: npm install topgg-autoposter');
        } else {
          console.error('❌ [Top.gg] Error loading topgg-autoposter:', error.message);
        }
        return false;
      }

      // Check if AutoPoster is a function
      if (typeof AutoPoster !== 'function') {
        console.error('❌ [Top.gg] AutoPoster is not a function. Package structure may have changed.');
        console.error('   AutoPoster type:', typeof AutoPoster);
        return false;
      }

      // Start auto-posting for main bot
      const ap = AutoPoster(this.topggToken, this.client);

      ap.on('posted', () => {
        const serverCount = this.client.guilds.cache.size;
        const shardCount = this.client.shard?.count || 1;
        console.log(`✅ [Top.gg] Posted stats: ${serverCount} servers, ${shardCount} shard(s)`);
      });

      ap.on('error', (error) => {
        console.error('❌ [Top.gg] Error posting stats:', error.message);
      });

      // Post stats immediately
      await this.postStats();

      // Schedule periodic posting (every 30 minutes)
      this.postingInterval = setInterval(() => {
        this.postStats().catch(err => {
          console.error('❌ [Top.gg] Error in scheduled stats post:', err);
        });
      }, 30 * 60 * 1000); // 30 minutes

      console.log('✅ [Top.gg] Auto-poster initialized for main bot');
      return true;
    } catch (error) {
      console.error('❌ [Top.gg] Error initializing:', error);
      return false;
    }
  }

  /**
   * Manually post bot statistics to Top.gg
   */
  async postStats() {
    if (!this.topggToken || this.isPosting) {
      return;
    }

    this.isPosting = true;
    try {
      const serverCount = this.client.guilds.cache.size;
      const shardCount = this.client.shard?.count || 1;
      const shardId = this.client.shard?.ids?.[0] || 0;

      const response = await fetch(`https://top.gg/api/bots/${this.client.user.id}/stats`, {
        method: 'POST',
        headers: {
          'Authorization': this.topggToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          server_count: serverCount,
          shard_count: shardCount,
          shard_id: shardId
        })
      });

      if (response.ok) {
        console.log(`✅ [Top.gg] Posted stats: ${serverCount} servers`);
      } else {
        const errorText = await response.text();
        console.error(`❌ [Top.gg] Failed to post stats: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ [Top.gg] Error posting stats:', error);
    } finally {
      this.isPosting = false;
    }
  }

  /**
   * Handle vote webhook from Top.gg
   */
  async handleVote(data) {
    try {
      const { user, bot, type, isWeekend } = data;

      // Note: Webhook authentication is already verified by the API endpoint
      // This check is only for direct calls (not through Next.js handler)
      if (this.topggWebhookAuth && data.auth && data.auth !== this.topggWebhookAuth) {
        console.warn('⚠️  [Top.gg] Invalid webhook auth');
        return { success: false, error: 'Invalid authentication' };
      }

      // Only process votes for our bot
      if (bot !== this.client.user.id) {
        return { success: false, error: 'Not our bot' };
      }

      console.log(`📊 [Top.gg] Vote received from user ${user} (weekend: ${isWeekend})`);

      // Get or create user in database
      let { data: userData } = await this.supabase
        .from('users')
        .select('*')
        .eq('discord_id', user)
        .maybeSingle();

      if (!userData) {
        // User doesn't exist, try to fetch from Discord and create
        try {
          const discordUser = await this.client.users.fetch(user).catch(() => null);
          if (discordUser) {
            // Create user with Discord info
            const { data: newUser, error: createError } = await this.supabase
              .from('users')
              .insert({
                discord_id: user,
                discord_tag: discordUser.tag || `${discordUser.username}#${discordUser.discriminator || '0'}`,
                avatar_url: discordUser.displayAvatarURL() || null,
                is_admin: false
              })
              .select()
              .single();

            if (createError) {
              console.error(`❌ [Top.gg] Error creating user ${user}:`, createError);
              return { success: false, error: 'Failed to create user' };
            }

            userData = newUser;
            console.log(`✅ [Top.gg] Created user ${user} in database`);
          } else {
            console.log(`⚠️  [Top.gg] User ${user} not found in Discord and database`);
            return { success: false, error: 'User not found' };
          }
        } catch (error) {
          console.error(`❌ [Top.gg] Error fetching/creating user ${user}:`, error);
          return { success: false, error: 'Failed to process user' };
        }
      }

      // Log vote to database
      const { error: voteError } = await this.supabase
        .from('topgg_votes')
        .insert({
          user_id: userData.id,
          discord_user_id: user,
          bot_id: bot,
          is_weekend: isWeekend || false,
          voted_at: new Date().toISOString()
        });

      if (voteError) {
        console.error('❌ [Top.gg] Error logging vote:', voteError);
      }

      // Give vote rewards
      await this.giveVoteRewards(user, isWeekend);

      return { success: true };
    } catch (error) {
      console.error('❌ [Top.gg] Error handling vote:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Give rewards to user for voting (vote points)
   */
  async giveVoteRewards(discordUserId, isWeekend = false) {
    try {
      // Get vote rewards configuration
      const { data: config } = await this.supabase
        .from('vote_rewards_config')
        .select('*')
        .eq('is_active', true)
        .single();

      if (!config) {
        console.log('⚠️  [Top.gg] Vote rewards config not found, skipping points');
        return;
      }

      const pointsToAward = isWeekend ? config.points_per_weekend_vote : config.points_per_vote;

      // Get or create user
      let { data: userData } = await this.supabase
        .from('users')
        .select('id, discord_id')
        .eq('discord_id', discordUserId)
        .maybeSingle();

      if (!userData) {
        // User doesn't exist, try to fetch from Discord and create
        try {
          const discordUser = await this.client.users.fetch(discordUserId).catch(() => null);
          if (discordUser) {
            // Create user with Discord info
            const { data: newUser, error: createError } = await this.supabase
              .from('users')
              .insert({
                discord_id: discordUserId,
                discord_tag: discordUser.tag || `${discordUser.username}#${discordUser.discriminator || '0'}`,
                avatar_url: discordUser.displayAvatarURL() || null,
                is_admin: false
              })
              .select('id, discord_id')
              .single();

            if (createError) {
              console.error(`❌ [Top.gg] Error creating user ${discordUserId}:`, createError);
              return;
            }

            userData = newUser;
            console.log(`✅ [Top.gg] Created user ${discordUserId} in database for vote rewards`);
          } else {
            console.log(`⚠️  [Top.gg] User ${discordUserId} not found in Discord and database`);
            return;
          }
        } catch (error) {
          console.error(`❌ [Top.gg] Error fetching/creating user ${discordUserId}:`, error);
          return;
        }
      }

      // Get or create vote points record
      let { data: votePoints } = await this.supabase
        .from('vote_points')
        .select('*')
        .eq('discord_user_id', discordUserId)
        .maybeSingle();

      if (!votePoints) {
        // Create new vote points record
        const { data: newRecord, error: createError } = await this.supabase
          .from('vote_points')
          .insert({
            user_id: userData.id,
            discord_user_id: discordUserId,
            total_points: pointsToAward,
            points_earned: pointsToAward,
            points_spent: 0,
            last_vote_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ [Top.gg] Error creating vote points record:', createError);
          return;
        }
        votePoints = newRecord;
      } else {
        // Update existing record
        const { error: updateError } = await this.supabase
          .from('vote_points')
          .update({
            total_points: votePoints.total_points + pointsToAward,
            points_earned: votePoints.points_earned + pointsToAward,
            last_vote_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', votePoints.id);

        if (updateError) {
          console.error('❌ [Top.gg] Error updating vote points:', updateError);
          return;
        }

        votePoints.total_points += pointsToAward;
        votePoints.points_earned += pointsToAward;
      }

      // Log transaction
      await this.supabase
        .from('vote_points_transactions')
        .insert({
          user_id: userData.id,
          discord_user_id: discordUserId,
          transaction_type: 'earned',
          points: pointsToAward,
          description: `Vote reward${isWeekend ? ' (weekend bonus)' : ''}`
        });

      console.log(`✅ [Top.gg] Awarded ${pointsToAward} vote points to user ${discordUserId} (total: ${votePoints.total_points})`);

      // Send DM with thank you message
      const user = await this.client.users.fetch(discordUserId).catch(() => null);
      if (user) {
        const rewardEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🎉 Thank You for Voting!')
          .setDescription(
            `Thank you for voting for **${this.client.user.username}** on Top.gg!\n\n` +
            `${isWeekend ? '🎁 **Weekend Bonus!** You received double points!\n\n' : ''}` +
            `**Your Rewards:**\n` +
            `• **${pointsToAward} Vote Points** earned!\n` +
            `• Total Points: **${votePoints.total_points}**\n\n` +
            `💡 You can redeem these points for tier unlocks in the dashboard!\n\n` +
            `You can vote again in 12 hours at: https://top.gg/bot/${this.client.user.id}`
          )
          .setFooter({ text: 'Thank you for your support!' })
          .setTimestamp();

        try {
          await user.send({ embeds: [rewardEmbed] });
          console.log(`✅ [Top.gg] Sent vote reward message to ${user.tag}`);
        } catch (error) {
          console.log(`⚠️  [Top.gg] Could not DM user ${user.tag}:`, error.message);
          
          // Try to send in first shared guild instead
          const userGuilds = [];
          for (const [guildId, guild] of this.client.guilds.cache) {
            const member = await guild.members.fetch(discordUserId).catch(() => null);
            if (member) {
              userGuilds.push(guild);
              break; // Just need one
            }
          }
          
          if (userGuilds.length > 0) {
            const firstGuild = userGuilds[0];
            const systemChannel = firstGuild.systemChannel || firstGuild.channels.cache.find(c => c.type === 0);
            
            if (systemChannel) {
              try {
                await systemChannel.send({
                  content: `<@${discordUserId}>`,
                  embeds: [rewardEmbed]
                });
                console.log(`✅ [Top.gg] Sent vote reward message to ${user.tag} in ${firstGuild.name}`);
              } catch (err) {
                console.error(`❌ [Top.gg] Could not send message in guild:`, err);
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ [Top.gg] Error giving vote rewards:', error);
    }
  }

  /**
   * Get vote statistics
   */
  async getVoteStats(userId = null) {
    try {
      let query = this.supabase
        .from('topgg_votes')
        .select('*')
        .order('voted_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ [Top.gg] Error fetching vote stats:', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        votes: data || [],
        total: data?.length || 0,
        weekendVotes: data?.filter(v => v.is_weekend).length || 0
      };
    } catch (error) {
      console.error('❌ [Top.gg] Error getting vote stats:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Post commands list to discordbotlist.com
   * @param {Array} commands - Array of command JSON objects
   */
  async postCommandsToDiscordBotList(commands) {
    if (!this.discordBotListToken) {
      console.log('⚠️  [DiscordBotList] No DISCORDBOTLIST_TOKEN found, skipping command posting');
      return false;
    }

    if (!this.client || !this.client.user) {
      console.warn('⚠️  [DiscordBotList] Client or user not available, skipping command posting');
      return false;
    }

    const botId = this.client.user.id;

    try {
      const response = await fetch(`https://discordbotlist.com/api/v1/bots/${botId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.discordBotListToken
        },
        body: JSON.stringify(commands)
      });

      if (response.ok) {
        console.log(`✅ [DiscordBotList] Successfully posted ${commands.length} commands to discordbotlist.com`);
        return true;
      } else {
        const errorText = await response.text();
        console.error(`❌ [DiscordBotList] Failed to post commands: ${response.status} - ${errorText}`);
        return false;
      }
    } catch (error) {
      console.error('❌ [DiscordBotList] Error posting commands:', error.message);
      return false;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.postingInterval) {
      clearInterval(this.postingInterval);
      this.postingInterval = null;
    }
  }
}

module.exports = TopGGManager;

