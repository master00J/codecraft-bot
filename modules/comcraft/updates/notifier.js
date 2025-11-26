/**
 * Update Notifications Module
 * Sends automatic notifications to server owners when new updates are published
 */

const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

class UpdateNotifier {
  constructor(client) {
    this.client = client;
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️ [UpdateNotifier] Supabase credentials missing, update notifications disabled');
      this.supabase = null;
      return;
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('✅ [UpdateNotifier] Initialized');
  }

  /**
   * Check for new updates and send notifications
   */
  async checkAndNotify() {
    if (!this.supabase) {
      return;
    }

    try {
      // Get all published updates (not just from last 24 hours, but check if already sent)
      const { data: allUpdates, error } = await this.supabase
        .from('updates')
        .select('*, update_items(*)')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[UpdateNotifier] Error fetching updates:', error);
        return;
      }

      if (!allUpdates || allUpdates.length === 0) {
        return; // No updates
      }

      // Get all guilds that have update notifications enabled with their preferences
      const { data: guildConfigs, error: configError } = await this.supabase
        .from('guild_configs')
        .select('guild_id, update_notification_channel_id, update_notification_types, update_notification_role_ids')
        .eq('update_notifications_enabled', true);

      if (configError) {
        console.error('[UpdateNotifier] Error fetching guild configs:', configError);
        return;
      }

      if (!guildConfigs || guildConfigs.length === 0) {
        console.log('[UpdateNotifier] No guilds with notifications enabled');
        return;
      }

      // Filter updates that haven't been sent to all eligible guilds yet
      // Also filter by update type preferences
      const updatesToSend = [];
      
      for (const update of allUpdates) {
        // Check which guilds haven't received this update yet AND want this update type
        const { data: sentRecords } = await this.supabase
          .from('update_notifications_sent')
          .select('guild_id')
          .eq('update_id', update.id);

        const sentGuildIds = new Set((sentRecords || []).map(r => r.guild_id));
        
        // Filter guilds that want this update type
        const eligibleGuilds = guildConfigs.filter(config => {
          // Check if guild wants this update type
          const types = config.update_notification_types || ['feature', 'improvement', 'bugfix', 'security', 'breaking'];
          return types.includes(update.type);
        });

        const eligibleGuildIds = eligibleGuilds.map(c => c.guild_id);
        const unsentGuildIds = eligibleGuildIds.filter(id => !sentGuildIds.has(id));

        if (unsentGuildIds.length > 0) {
          const unsentConfigs = eligibleGuilds.filter(c => unsentGuildIds.includes(c.guild_id));
          updatesToSend.push({
            update,
            unsentGuildIds,
            unsentConfigs
          });
        }
      }

      if (updatesToSend.length === 0) {
        return; // All updates already sent
      }

      // Send notifications for each update
      for (const { update, unsentConfigs } of updatesToSend) {
        await this.sendUpdateNotification(update, unsentConfigs);
      }
    } catch (error) {
      // Silently handle errors
    }
  }

  /**
   * Send update notification to all eligible guilds
   */
  async sendUpdateNotification(update, guildConfigs) {
    let successCount = 0;
    let failCount = 0;

    for (const config of guildConfigs) {
      let sentVia = null;
      let channelId = null;

      try {
        const guild = this.client.guilds.cache.get(config.guild_id);
        
        if (!guild) {
          continue; // Guild not found (bot not in server)
        }

        // Check if already sent to this guild
        const { data: existing } = await this.supabase
          .from('update_notifications_sent')
          .select('id')
          .eq('update_id', update.id)
          .eq('guild_id', config.guild_id)
          .single();

        if (existing) {
          continue; // Already sent to this guild
        }

        // Get server owner
        const owner = await guild.fetchOwner().catch(() => null);
        
        if (!owner || !owner.user) {
          continue; // Could not fetch owner
        }

        // Build mention string
        const roleIds = config.update_notification_role_ids || [];
        let mentionString = '';
        
        if (roleIds.length > 0) {
          const roleMentions = roleIds.map(id => `<@&${id}>`).join(' ');
          mentionString = `${roleMentions} `;
        }
        
        // Always mention owner if no roles specified
        if (roleIds.length === 0) {
          mentionString = `<@${owner.user.id}> `;
        }

        // Create embed with button
        const embed = this.createUpdateEmbed(update, config.guild_id);
        const components = this.createUpdateComponents(update.id);

        // Determine where to send
        const customChannelId = config.update_notification_channel_id;
        let targetChannel = null;

        if (customChannelId) {
          // Use custom channel if specified
          targetChannel = guild.channels.cache.get(customChannelId);
          if (!targetChannel || !targetChannel.isTextBased()) {
            targetChannel = null;
          }
        }

        // If no custom channel or it's invalid, try DM first, then fallback
        if (!targetChannel) {
          try {
            await owner.user.send({
              embeds: [embed],
              components: components,
              content: `🎉 **New ComCraft Update Available!**\n\nYou're receiving this because you're the owner of **${guild.name}** and update notifications are enabled.\n\nYou can disable these notifications in your dashboard: https://codecraft-solutions.com/comcraft/dashboard/${config.guild_id}`
            });
            sentVia = 'dm';
            successCount++;
          } catch (dmError) {
            // If DM fails, try to send to a system channel or first available channel
            targetChannel = guild.systemChannel || 
                           guild.channels.cache.find(ch => 
                             ch.isTextBased() && 
                             ch.permissionsFor(guild.members.me)?.has(['SendMessages', 'EmbedLinks'])
                           );
          }
        }

        // Send to channel if we have one
        if (targetChannel && !sentVia) {
          try {
            await targetChannel.send({
              embeds: [embed],
              components: components,
              content: `🎉 **New ComCraft Update Available!**\n\n${mentionString}You're receiving this because update notifications are enabled for this server.\n\nYou can disable these notifications in your dashboard: https://codecraft-solutions.com/comcraft/dashboard/${config.guild_id}`
            });
            sentVia = 'channel';
            channelId = targetChannel.id;
            successCount++;
          } catch (channelError) {
            failCount++;
          }
        } else if (!sentVia) {
          failCount++;
        }

        // Record that notification was sent (only if successful)
        if (sentVia) {
          await this.supabase
            .from('update_notifications_sent')
            .insert({
              update_id: update.id,
              guild_id: config.guild_id,
              sent_via: sentVia,
              channel_id: channelId
            });
        }
      } catch (error) {
        failCount++;
      }
    }
  }

  /**
   * Create action row with buttons for update notification
   */
  createUpdateComponents(updateId) {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('View Full Changelog')
          .setURL(`https://codecraft-solutions.com/updates`)
          .setStyle(ButtonStyle.Link)
      );

    return [row];
  }

  /**
   * Create embed for update notification
   */
  createUpdateEmbed(update, guildId) {
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${update.title}`)
      .setDescription(update.description || 'A new update is available!')
      .setColor(update.is_major ? 0x5865F2 : 0x5865F2) // Discord blue
      .addFields([
        {
          name: '📦 Version',
          value: `v${update.version}`,
          inline: true
        },
        {
          name: '📅 Release Date',
          value: new Date(update.release_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          inline: true
        },
        {
          name: '🏷️ Type',
          value: update.type.charAt(0).toUpperCase() + update.type.slice(1),
          inline: true
        }
      ])
      .setTimestamp(new Date(update.release_date))
      .setFooter({ 
        text: 'ComCraft Updates',
        iconURL: this.client.user?.displayAvatarURL()
      });

    // Add update items if available
    if (update.update_items && update.update_items.length > 0) {
      const itemsList = update.update_items
        .slice(0, 10) // Limit to 10 items
        .map((item, index) => {
          const icon = item.icon || '✨';
          return `${icon} **${item.title}**${item.description ? `\n   ${item.description}` : ''}`;
        })
        .join('\n\n');

      embed.addFields([
        {
          name: `📋 What's New (${update.update_items.length} ${update.update_items.length === 1 ? 'item' : 'items'})`,
          value: itemsList.length > 1024 ? itemsList.substring(0, 1021) + '...' : itemsList,
          inline: false
        }
      ]);
    }

    // Add major update badge
    if (update.is_major) {
      embed.addFields([
        {
          name: '⭐',
          value: 'This is a **major update** with significant changes!',
          inline: false
        }
      ]);
    }

    return embed;
  }

  /**
   * Start periodic checking for updates
   */
  startScheduler(intervalMinutes = 60) {
    if (!this.supabase) {
      console.log('⚠️ [UpdateNotifier] Scheduler disabled (Supabase not configured)');
      return;
    }

    // Check immediately on start
    this.checkAndNotify();

    // Then check every X minutes
    this.schedulerInterval = setInterval(() => {
      this.checkAndNotify();
    }, intervalMinutes * 60 * 1000);

    console.log(`✅ [UpdateNotifier] Scheduler started (checks every ${intervalMinutes} minutes)`);
  }

  /**
   * Stop scheduler
   */
  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('🛑 [UpdateNotifier] Scheduler stopped');
    }
  }
}

module.exports = UpdateNotifier;

