/**
 * ComCraft Discord Manager
 * Manages Discord roles, channels, and server structure
 */

const { PermissionFlagsBits, ChannelType, OverwriteType } = require('discord.js');

class DiscordManager {
  constructor(client) {
    this.client = client;
  }

  // ================================================================
  // ROLE MANAGEMENT
  // ================================================================

  /**
   * Get all roles in a guild
   */
  async getRoles(guildId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const roles = guild.roles.cache
        .filter(role => role.id !== guild.id) // Exclude @everyone
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          permissions: role.permissions.bitfield.toString(),
          managed: role.managed,
          mentionable: role.mentionable,
          hoist: role.hoist,
          members: role.members.size
        }))
        .sort((a, b) => b.position - a.position);

      return { success: true, roles };
    } catch (error) {
      console.error('Error getting roles:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a user has a specific role
   */
  async checkUserHasRole(guildId, userId, roleId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return { success: false, error: 'User not found in guild' };
      }

      const hasRole = member.roles.cache.has(roleId);
      return { success: true, hasRole };
    } catch (error) {
      console.error('Error checking user role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new role
   */
  async createRole(guildId, options = {}) {
    try {
      console.log(`🎭 Creating role in guild ${guildId}:`, options);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      // Check bot permissions
      const botMember = guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return { success: false, error: 'Bot lacks Manage Roles permission' };
      }

      const role = await guild.roles.create({
        name: options.name || 'New Role',
        color: options.color || 0x5865F2,
        hoist: options.hoist || false,
        mentionable: options.mentionable || false,
        permissions: options.permissions || [],
        reason: `Created via ComCraft Dashboard by ${options.createdBy || 'Admin'}`
      });

      console.log(`   ✅ Role created: ${role.name} (${role.id})`);

      return {
        success: true,
        role: {
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position,
          permissions: role.permissions.bitfield.toString(),
          mentionable: role.mentionable,
          hoist: role.hoist
        }
      };
    } catch (error) {
      console.error(`   ❌ Error creating role:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Edit an existing role
   */
  async editRole(guildId, roleId, options = {}) {
    try {
      console.log(`🎭 Editing role ${roleId} in guild ${guildId}:`, options);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        return { success: false, error: 'Role not found' };
      }

      // Check if bot can manage this role
      const botMember = guild.members.me;
      if (role.position >= botMember.roles.highest.position) {
        return { success: false, error: 'Role is higher than bot\'s highest role' };
      }

      await role.edit({
        name: options.name || role.name,
        color: options.color !== undefined ? options.color : role.color,
        hoist: options.hoist !== undefined ? options.hoist : role.hoist,
        mentionable: options.mentionable !== undefined ? options.mentionable : role.mentionable,
        permissions: options.permissions || role.permissions,
        reason: `Edited via ComCraft Dashboard by ${options.editedBy || 'Admin'}`
      });

      console.log(`   ✅ Role edited: ${role.name}`);

      return { success: true, role: { id: role.id, name: role.name } };
    } catch (error) {
      console.error(`   ❌ Error editing role:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(guildId, roleId, deletedBy) {
    try {
      console.log(`🗑️  Deleting role ${roleId} in guild ${guildId}`);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const role = guild.roles.cache.get(roleId);
      if (!role) {
        return { success: false, error: 'Role not found' };
      }

      const botMember = guild.members.me;
      if (role.position >= botMember.roles.highest.position) {
        return { success: false, error: 'Role is higher than bot\'s highest role' };
      }

      await role.delete(`Deleted via ComCraft Dashboard by ${deletedBy || 'Admin'}`);

      console.log(`   ✅ Role deleted: ${role.name}`);

      return { success: true };
    } catch (error) {
      console.error(`   ❌ Error deleting role:`, error);
      return { success: false, error: error.message };
    }
  }

  // ================================================================
  // EMOJI MANAGEMENT
  // ================================================================

  /**
   * Get all emojis in a guild
   */
  async getEmojis(guildId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const emojis = guild.emojis.cache
        .map(emoji => ({
          id: emoji.id,
          name: emoji.name,
          animated: emoji.animated,
          url: emoji.url,
          identifier: emoji.identifier, // Format: name:id or a:name:id
          // For reactions, we need the format: <:name:id> or <a:name:id>
          reactionFormat: emoji.animated 
            ? `<a:${emoji.name}:${emoji.id}>`
            : `<:${emoji.name}:${emoji.id}>`,
          // For simple ID lookup
          emojiId: emoji.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return { success: true, emojis };
    } catch (error) {
      console.error('Error getting emojis:', error);
      return { success: false, error: error.message };
    }
  }

  // ================================================================
  // CHANNEL MANAGEMENT
  // ================================================================

  /**
   * Get all channels in a guild
   */
  async getChannels(guildId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const channels = guild.channels.cache
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          position: channel.position,
          parent: channel.parentId,
          parentName: channel.parent?.name || null,
          topic: channel.topic || null,
          nsfw: channel.nsfw || false
        }))
        .sort((a, b) => a.position - b.position);

      // Group by categories
      const categories = channels.filter(c => c.type === ChannelType.GuildCategory);
      const textChannels = channels.filter(c => c.type === ChannelType.GuildText);
      const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice);

      return {
        success: true,
        channels: {
          all: channels,
          categories,
          text: textChannels,
          voice: voiceChannels
        }
      };
    } catch (error) {
      console.error('Error getting channels:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all threads in a channel (including active and archived)
   */
  async getThreads(guildId, channelId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        console.error(`[Discord Manager] Guild ${guildId} not found`);
        return { success: false, error: 'Guild not found' };
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        console.error(`[Discord Manager] Channel ${channelId} not found in guild ${guildId}`);
        return { success: false, error: 'Channel not found' };
      }

      // Only text-based channels can have threads
      if (!channel.isTextBased() && channel.type !== ChannelType.GuildForum) {
        console.warn(`[Discord Manager] Channel ${channelId} does not support threads (type: ${channel.type})`);
        return { success: false, error: 'Channel does not support threads' };
      }

      console.log(`[Discord Manager] Fetching threads for channel ${channelId} (${channel.name})`);

      // Fetch all active threads
      let activeThreadsList = [];
      try {
        const activeThreads = await channel.threads.fetchActive();
        console.log(`[Discord Manager] fetchActive returned:`, {
          hasThreads: !!activeThreads,
          hasThreadsProperty: !!activeThreads.threads,
          threadsType: typeof activeThreads.threads,
          threadsValue: activeThreads.threads
        });
        
        // activeThreads.threads is a Collection, we need to convert it properly
        if (activeThreads && activeThreads.threads) {
          // Collection can be converted to array using Array.from or spread
          const threadsCollection = activeThreads.threads;
          
          // Try different methods to convert Collection to array
          let threadsArray = [];
          if (threadsCollection instanceof Map) {
            threadsArray = Array.from(threadsCollection.values());
          } else if (threadsCollection.values) {
            threadsArray = Array.from(threadsCollection.values());
          } else if (Array.isArray(threadsCollection)) {
            threadsArray = threadsCollection;
          } else if (typeof threadsCollection.forEach === 'function') {
            // If it's iterable, use forEach
            threadsCollection.forEach(thread => threadsArray.push(thread));
          } else {
            // Fallback: try to iterate
            for (const thread of threadsCollection) {
              threadsArray.push(thread);
            }
          }
          
          activeThreadsList = threadsArray.map(thread => ({
            id: thread.id,
            name: thread.name || 'Unnamed Thread',
            type: thread.type,
            parentId: thread.parentId,
            archived: thread.archived || false,
            locked: thread.locked || false,
            memberCount: thread.memberCount || 0,
            messageCount: thread.messageCount || 0,
            createdAt: thread.createdAt ? thread.createdAt.toISOString() : null,
          }));
        }
        
        console.log(`[Discord Manager] Found ${activeThreadsList.length} active threads`);
      } catch (error) {
        console.error(`[Discord Manager] Error fetching active threads:`, error);
        console.error(`[Discord Manager] Error stack:`, error.stack);
        // Continue with empty list
      }
      
      // Also try to fetch archived threads
      let archivedThreads = [];
      try {
        const archived = await channel.threads.fetchArchived({ fetchAll: false, limit: 50 });
        if (archived && archived.threads) {
          // Similar handling for archived threads
          const threadsCollection = archived.threads;
          let threadsArray = [];
          
          if (threadsCollection instanceof Map) {
            threadsArray = Array.from(threadsCollection.values());
          } else if (threadsCollection.values) {
            threadsArray = Array.from(threadsCollection.values());
          } else if (Array.isArray(threadsCollection)) {
            threadsArray = threadsCollection;
          } else if (typeof threadsCollection.forEach === 'function') {
            threadsCollection.forEach(thread => threadsArray.push(thread));
          } else {
            for (const thread of threadsCollection) {
              threadsArray.push(thread);
            }
          }
          
          archivedThreads = threadsArray.map(thread => ({
            id: thread.id,
            name: thread.name || 'Unnamed Thread',
            type: thread.type,
            parentId: thread.parentId,
            archived: true,
            locked: thread.locked || false,
            memberCount: thread.memberCount || 0,
            messageCount: thread.messageCount || 0,
            createdAt: thread.createdAt ? thread.createdAt.toISOString() : null,
          }));
          console.log(`[Discord Manager] Found ${archivedThreads.length} archived threads`);
        }
      } catch (error) {
        console.warn(`[Discord Manager] Could not fetch archived threads for channel ${channelId}:`, error.message);
        console.warn(`[Discord Manager] Archived threads error stack:`, error.stack);
        // Continue without archived threads
      }
      
      // Combine active and archived threads
      const allThreads = [...activeThreadsList, ...archivedThreads];
      
      // Remove duplicates (in case a thread appears in both)
      const uniqueThreads = Array.from(
        new Map(allThreads.map(thread => [thread.id, thread])).values()
      );

      console.log(`[Discord Manager] Total unique threads: ${uniqueThreads.length} (${activeThreadsList.length} active, ${archivedThreads.length} archived)`);

      return {
        success: true,
        threads: uniqueThreads.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      };
    } catch (error) {
      console.error(`[Discord Manager] Error in getThreads for channel ${channelId}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error fetching threads',
        threads: []
      };
    }
  }

  /**
   * Create a new channel
   */
  async createChannel(guildId, options = {}) {
    try {
      console.log(`💬 Creating channel in guild ${guildId}:`, options);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const botMember = guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return { success: false, error: 'Bot lacks Manage Channels permission' };
      }

      const channelOptions = {
        name: options.name || 'new-channel',
        type: options.type || ChannelType.GuildText,
        topic: options.topic || null,
        parent: options.parent || null,
        nsfw: options.nsfw || false,
        reason: `Created via ComCraft Dashboard by ${options.createdBy || 'Admin'}`
      };

      // Add permission overwrites if provided
      if (options.permissions) {
        channelOptions.permissionOverwrites = options.permissions;
      }

      const channel = await guild.channels.create(channelOptions);

      console.log(`   ✅ Channel created: #${channel.name} (${channel.id})`);

      return {
        success: true,
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          position: channel.position
        }
      };
    } catch (error) {
      console.error(`   ❌ Error creating channel:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Edit an existing channel
   */
  async editChannel(guildId, channelId, options = {}) {
    try {
      console.log(`💬 Editing channel ${channelId} in guild ${guildId}:`, options);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      await channel.edit({
        name: options.name || channel.name,
        topic: options.topic !== undefined ? options.topic : channel.topic,
        nsfw: options.nsfw !== undefined ? options.nsfw : channel.nsfw,
        parent: options.parent !== undefined ? options.parent : channel.parentId,
        reason: `Edited via ComCraft Dashboard by ${options.editedBy || 'Admin'}`
      });

      console.log(`   ✅ Channel edited: #${channel.name}`);

      return { success: true, channel: { id: channel.id, name: channel.name } };
    } catch (error) {
      console.error(`   ❌ Error editing channel:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a channel
   */
  async deleteChannel(guildId, channelId, deletedBy) {
    try {
      console.log(`🗑️  Deleting channel ${channelId} in guild ${guildId}`);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const channel = guild.channels.cache.get(channelId);
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      await channel.delete(`Deleted via ComCraft Dashboard by ${deletedBy || 'Admin'}`);

      console.log(`   ✅ Channel deleted: #${channel.name}`);

      return { success: true };
    } catch (error) {
      console.error(`   ❌ Error deleting channel:`, error);
      return { success: false, error: error.message };
    }
  }

  // ================================================================
  // PERMISSION TEMPLATES
  // ================================================================

  /**
   * Get permission template by name
   */
  getPermissionTemplate(templateName) {
    const templates = {
      // Moderation role
      moderator: [
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ViewAuditLog
      ],
      
      // Muted role (used for timeouts)
      muted: [],
      
      // Stream alerts channel permissions
      streamAlerts: [
        {
          id: this.client.user.id, // Bot
          allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
        }
      ],
      
      // Level role (basic permissions)
      levelRole: [
        PermissionFlagsBits.ChangeNickname,
        PermissionFlagsBits.UseExternalEmojis
      ],
      
      // VIP role
      vip: [
        PermissionFlagsBits.ChangeNickname,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.UseExternalStickers,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles
      ]
    };

    return templates[templateName] || [];
  }

  // ================================================================
  // QUICK SETUP WIZARDS
  // ================================================================

  /**
   * Quick Setup: Leveling System
   * Creates level roles: Level 5, Level 10, Level 25, Level 50, Level 100
   */
  async setupLevelingSystem(guildId, createdBy) {
    try {
      console.log(`⚡ Quick Setup: Leveling System for guild ${guildId}`);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const levels = [5, 10, 25, 50, 100];
      const colors = [0x3498db, 0x9b59b6, 0xe91e63, 0xf39c12, 0xffdf00]; // Blue → Gold gradient
      const createdRoles = [];

      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        const color = colors[i];

        const result = await this.createRole(guildId, {
          name: `Level ${level}`,
          color,
          hoist: true,
          mentionable: false,
          permissions: this.getPermissionTemplate('levelRole'),
          createdBy
        });

        if (result.success) {
          createdRoles.push({ level, roleId: result.role.id, roleName: result.role.name });
          console.log(`   ✅ Created: Level ${level} role`);
        } else {
          console.error(`   ❌ Failed to create Level ${level} role:`, result.error);
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`✅ Leveling system setup complete! Created ${createdRoles.length}/5 roles`);

      return { success: true, roles: createdRoles };
    } catch (error) {
      console.error('Error in leveling setup wizard:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Quick Setup: Streaming Alerts
   * Creates #stream-alerts channel with proper permissions
   */
  async setupStreamingAlerts(guildId, createdBy) {
    try {
      console.log(`⚡ Quick Setup: Streaming Alerts for guild ${guildId}`);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      // Create stream-alerts channel
      const result = await this.createChannel(guildId, {
        name: 'stream-alerts',
        type: ChannelType.GuildText,
        topic: '🔴 Live stream notifications - Managed by ComCraft',
        permissions: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.SendMessages] // Read-only for members
          },
          {
            id: this.client.user.id, // Bot
            allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
          }
        ],
        createdBy
      });

      if (result.success) {
        console.log(`   ✅ Created: #stream-alerts channel`);
        return { success: true, channel: result.channel };
      } else {
        return result;
      }
    } catch (error) {
      console.error('Error in streaming setup wizard:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Quick Setup: Moderation System
   * Creates Muted role and #mod-logs channel
   */
  async setupModerationSystem(guildId, createdBy) {
    try {
      console.log(`⚡ Quick Setup: Moderation System for guild ${guildId}`);

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const created = { role: null, channel: null };

      // 1. Create Muted role
      const roleResult = await this.createRole(guildId, {
        name: 'Muted',
        color: 0x95a5a6, // Gray
        hoist: false,
        mentionable: false,
        permissions: [],
        createdBy
      });

      if (roleResult.success) {
        created.role = roleResult.role;
        console.log(`   ✅ Created: Muted role`);

        // Apply muted role to all text channels (deny send messages)
        const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        
        for (const [channelId, channel] of channels) {
          try {
            await channel.permissionOverwrites.create(roleResult.role.id, {
              SendMessages: false,
              AddReactions: false,
              CreatePublicThreads: false,
              CreatePrivateThreads: false
            });
          } catch (err) {
            console.error(`   ⚠️  Could not apply muted to #${channel.name}:`, err.message);
          }
        }

        console.log(`   ✅ Applied muted permissions to ${channels.size} text channels`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2. Create mod-logs channel
      const channelResult = await this.createChannel(guildId, {
        name: 'mod-logs',
        type: ChannelType.GuildText,
        topic: '🛡️ Moderation action logs - Managed by ComCraft',
        permissions: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
          },
          {
            id: this.client.user.id, // Bot
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
          }
        ],
        createdBy
      });

      if (channelResult.success) {
        created.channel = channelResult.channel;
        console.log(`   ✅ Created: #mod-logs channel`);
      }

      console.log(`✅ Moderation system setup complete!`);

      return { success: true, created };
    } catch (error) {
      console.error('Error in moderation setup wizard:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Quick Setup: Welcome System
   * Creates #welcome channel
   */
  async setupWelcomeSystem(guildId, createdBy) {
    try {
      console.log(`⚡ Quick Setup: Welcome System for guild ${guildId}`);

      const result = await this.createChannel(guildId, {
        name: 'welcome',
        type: ChannelType.GuildText,
        topic: '👋 New member welcomes - Managed by ComCraft',
        permissions: [
          {
            id: guildId, // @everyone
            deny: [PermissionFlagsBits.SendMessages]
          },
          {
            id: this.client.user.id, // Bot
            allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
          }
        ],
        createdBy
      });

      if (result.success) {
        console.log(`   ✅ Created: #welcome channel`);
      }

      return result;
    } catch (error) {
      console.error('Error in welcome setup wizard:', error);
      return { success: false, error: error.message };
    }
  }

  // ================================================================
  // UTILITY
  // ================================================================

  /**
   * Check bot permissions in a guild
   */
  async checkBotPermissions(guildId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const botMember = guild.members.me;
      const permissions = botMember.permissions;

      return {
        success: true,
        permissions: {
          manageRoles: permissions.has(PermissionFlagsBits.ManageRoles),
          manageChannels: permissions.has(PermissionFlagsBits.ManageChannels),
          manageGuild: permissions.has(PermissionFlagsBits.ManageGuild),
          kickMembers: permissions.has(PermissionFlagsBits.KickMembers),
          banMembers: permissions.has(PermissionFlagsBits.BanMembers),
          moderateMembers: permissions.has(PermissionFlagsBits.ModerateMembers),
          administrator: permissions.has(PermissionFlagsBits.Administrator)
        },
        highestRole: {
          id: botMember.roles.highest.id,
          name: botMember.roles.highest.name,
          position: botMember.roles.highest.position
        }
      };
    } catch (error) {
      console.error('Error checking bot permissions:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = DiscordManager;

