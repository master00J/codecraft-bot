/**
 * Comcraft Ticket Manager
 * Handles support tickets and customer inquiries
 */

const { createClient } = require('@supabase/supabase-js');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');

class TicketManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    /**
     * Simple in-memory cache for ticket categories per guild
     * { [guildId]: { fetchedAt: number, categories: Array } }
     */
    this.categoryCache = new Map();
  }

  /**
   * Generate a unique ticket number
   */
  generateTicketNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'T';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Slugify text for channel names
   */
  slugify(text, fallback = 'request') {
    if (!text) return fallback;
    const slug = text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || fallback;
  }

  /**
   * Format duration between two timestamps
   */
  formatDuration(startTimestamp, endTimestamp) {
    const diff = endTimestamp - startTimestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get ticket by channel ID
   */
  async getTicketByChannel(channelId) {
    try {
      const { data, error } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('discord_channel_id', channelId)
        .is('deleted_at', null)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Ticket Manager: error fetching ticket by channel', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('Ticket Manager: error in getTicketByChannel', error);
      return null;
    }
  }

  /**
   * Archive a ticket (moves to archive category and closes)
   */
  async archiveTicket(channel, user) {
    try {
      const ticket = await this.getTicketByChannel(channel.id);
      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      if (ticket.archived) {
        return { success: false, error: 'Ticket is already archived' };
      }

      // Get config to find archive category
      const config = await this.getConfig(channel.guild.id);
      let archiveCategoryId = config?.archive_category_id || null;

      // If no archive category configured, try to find or create one
      if (!archiveCategoryId) {
        // Try to find existing archive category
        const archiveCategory = channel.guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && 
               (c.name.toLowerCase().includes('archive') || c.name.toLowerCase().includes('closed'))
        );

        if (archiveCategory) {
          archiveCategoryId = archiveCategory.id;
        } else {
          // Create archive category
          const newArchiveCategory = await channel.guild.channels.create({
            name: '📦 ARCHIVED TICKETS',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: channel.guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
              }
            ]
          });
          archiveCategoryId = newArchiveCategory.id;

          // Update config with new archive category
          await this.supabase
            .from('ticket_config')
            .update({ archive_category_id: archiveCategoryId })
            .eq('guild_id', channel.guild.id);
        }
      }

      // Move channel to archive category
      if (archiveCategoryId) {
        try {
          await channel.setParent(archiveCategoryId);
        } catch (error) {
          console.warn('Could not move channel to archive category:', error);
        }
      }

      // Get user ID from discord_id
      const { data: userData } = await this.supabase
        .from('users')
        .select('id')
        .eq('discord_id', user.id)
        .maybeSingle();

      // Update database
      const { error } = await this.supabase
        .from('tickets')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          archived_by: userData?.id || null,
          status: 'closed',
          closed_by_discord_id: user.id,
          closed_by_username: user.tag,
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (error) {
        console.error('Ticket Manager: error archiving ticket', error);
        return { success: false, error: 'Failed to archive ticket' };
      }

      // Close and lock the channel
      await channel.setName(`archived-${channel.name}`);
      await channel.permissionOverwrites.edit(channel.guild.id, {
        SendMessages: false,
        ViewChannel: false
      });

      // Send archive confirmation
      const archiveEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('📦 Ticket Archived')
        .setDescription(`This ticket has been archived and closed by ${user.tag}.`)
        .setTimestamp();

      await channel.send({ embeds: [archiveEmbed] }).catch(() => {});

      return { success: true };
    } catch (error) {
      console.error('Ticket Manager: error in archiveTicket', error);
      return { success: false, error: error.message || 'Failed to archive ticket' };
    }
  }

  /**
   * Unarchive a ticket
   */
  async unarchiveTicket(channel, user) {
    try {
      const ticket = await this.getTicketByChannel(channel.id);
      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      if (!ticket.archived) {
        return { success: false, error: 'Ticket is not archived' };
      }

      const { error } = await this.supabase
        .from('tickets')
        .update({
          archived: false,
          archived_at: null,
          archived_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (error) {
        console.error('Ticket Manager: error unarchiving ticket', error);
        return { success: false, error: 'Failed to unarchive ticket' };
      }

      return { success: true };
    } catch (error) {
      console.error('Ticket Manager: error in unarchiveTicket', error);
      return { success: false, error: error.message || 'Failed to unarchive ticket' };
    }
  }

  /**
   * Delete a ticket (soft delete)
   */
  async deleteTicket(channel, user) {
    try {
      const ticket = await this.getTicketByChannel(channel.id);
      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      if (ticket.deleted_at) {
        return { success: false, error: 'Ticket is already deleted' };
      }

      // Get user ID from discord_id
      const { data: userData } = await this.supabase
        .from('users')
        .select('id')
        .eq('discord_id', user.id)
        .maybeSingle();

      const { error } = await this.supabase
        .from('tickets')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userData?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (error) {
        console.error('Ticket Manager: error deleting ticket', error);
        return { success: false, error: 'Failed to delete ticket' };
      }

      return { success: true };
    } catch (error) {
      console.error('Ticket Manager: error in deleteTicket', error);
      return { success: false, error: error.message || 'Failed to delete ticket' };
    }
  }

  /**
   * Get ticket configuration for a guild
   */
  async getConfig(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('ticket_config')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Ticket Manager: error fetching config', error);
      }

      return data || null;
    } catch (error) {
      console.error('Ticket Manager: error in getConfig', error);
      return null;
    }
  }

  /**
   * Get ticket categories for a guild
   */
  async getCategories(guildId, { onlyActive = true } = {}) {
    try {
      const cacheKey = `${guildId}:${onlyActive ? 'active' : 'all'}`;
      const cached = this.categoryCache.get(cacheKey);

      // Reuse cache for 5 minutes
      if (cached && Date.now() - cached.fetchedAt < 5 * 60 * 1000) {
        return cached.categories;
      }

      let query = this.supabase
        .from('ticket_categories')
        .select('*')
        .eq('guild_id', guildId)
        .order('name', { ascending: true });

      if (onlyActive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        // If table doesn't exist yet, fail silently
        if (error.code !== 'PGRST116') {
          console.error('Ticket Manager: error fetching categories', error);
        }
        return [];
      }

      const categories = data || [];
      this.categoryCache.set(cacheKey, {
        fetchedAt: Date.now(),
        categories,
      });

      return categories;
    } catch (error) {
      console.error('Ticket Manager: error in getCategories', error);
      return [];
    }
  }

  /**
   * Get a single category by ID (scoped to guild)
   */
  async getCategoryById(guildId, categoryId) {
    if (!categoryId) return null;

    try {
      // Try cache first (both active and inactive)
      const cachedAll = this.categoryCache.get(`${guildId}:all`);
      if (cachedAll && Array.isArray(cachedAll.categories)) {
        const found = cachedAll.categories.find((c) => c.id === categoryId);
        if (found) return found;
      }

      const { data, error } = await this.supabase
        .from('ticket_categories')
        .select('*')
        .eq('guild_id', guildId)
        .eq('id', categoryId)
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Ticket Manager: error fetching category', error);
        }
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('Ticket Manager: error in getCategoryById', error);
      return null;
    }
  }

  /**
   * Update ticket configuration
   */
  async updateConfig(guildId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('ticket_config')
        .upsert({
          guild_id: guildId,
          ...updates,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'guild_id'
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Ticket Manager: error updating config', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new support ticket
   */
  async createTicket(guild, user, subject, description = null, categoryId = null) {
    try {
      // Generate ticket number
      const ticketNumber = this.generateTicketNumber();

      // Get config
      const config = await this.getConfig(guild.id);
      // Optional category (for multi-button panels)
      const category = categoryId
        ? await this.getCategoryById(guild.id, categoryId)
        : null;

      // Build welcome message (config base + optional category auto-response)
      let welcomeMessage = config?.welcome_message || '';

      if (category?.auto_response) {
        welcomeMessage = `${welcomeMessage}\n\n${category.auto_response}`;
      }

      // Effective subject (optionally prefixed with category label)
      const effectiveSubject = category
        ? `[${category.name}] ${subject}`
        : subject;

      // Resolve support category
      let supportCategory = null;
      if (category?.category_channel_id) {
        supportCategory =
          guild.channels.cache.get(category.category_channel_id) ||
          (await guild.channels.fetch(category.category_channel_id).catch(() => null));
      }

      if (!supportCategory && config?.support_category_id) {
        supportCategory =
          guild.channels.cache.get(config.support_category_id) ||
          (await guild.channels.fetch(config.support_category_id).catch(() => null));
      }

      if (!supportCategory) {
        supportCategory = guild.channels.cache.find(
          (c) => c.name === '🎫 SUPPORT' && c.type === ChannelType.GuildCategory
        );
      }

      if (!supportCategory) {
        return {
          success: false,
          error: 'Support category not found. Please run /ticket-setup first.',
        };
      }

      // Create channel name
      const subjectSlug = this.slugify(effectiveSubject, 'support').slice(0, 18);
      const userSlug = this.slugify(user.username || user.tag, 'client').slice(0, 12);
      const shortTicket = ticketNumber.toLowerCase().slice(-4);
      let channelName = `ticket-${subjectSlug}-${userSlug}-${shortTicket}`;
      if (channelName.length > 90) {
        channelName = channelName.slice(0, 90);
      }

      // Determine support role (category-specific overrides global)
      const supportRoleId = category?.support_role_id || config?.support_role_id || null;

      // Build permission overwrites
      const permissionOverwrites = [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          }
      ];

      if (supportRoleId) {
        permissionOverwrites.push({
          id: supportRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages
          ]
        });
      }

      // Create ticket channel
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: supportCategory.id,
        topic: `Support Ticket ${ticketNumber} | User:${user.tag} (${user.id}) | Subject:${effectiveSubject}`,
        permissionOverwrites
      });

      // Send welcome message
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎫 Support Ticket ${ticketNumber}`);
      
      // Only set description if welcome message is not empty
      if (welcomeMessage && welcomeMessage.trim()) {
        welcomeEmbed.setDescription(welcomeMessage);
      }
      
      welcomeEmbed
        .addFields(
          { name: 'Subject', value: effectiveSubject, inline: false },
          ...(category
            ? [{ name: 'Category', value: category.name, inline: true }]
            : []),
          { name: 'Status', value: '🟢 Open', inline: true },
          { name: 'Priority', value: '🔵 Normal', inline: true },
          { name: 'Created', value: new Date().toLocaleString('en-GB'), inline: true }
        )
        .setTimestamp();

      // Mention user + optional support role
      const mentions = [`<@${user.id}>`];
      if (supportRoleId) {
        mentions.push(`<@&${supportRoleId}>`);
      }

      // Create action buttons for ticket management
      const claimButton = new ButtonBuilder()
        .setCustomId('ticket_claim')
            .setLabel('Claim Ticket')
        .setEmoji('✋')
        .setStyle(ButtonStyle.Success);

      const closeButton = new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Close Ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger);

      const archiveButton = new ButtonBuilder()
        .setCustomId('ticket_archive')
        .setLabel('Archive')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Secondary);

      const deleteButton = new ButtonBuilder()
        .setCustomId('ticket_delete')
        .setLabel('Delete')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger);

      const actionRow = new ActionRowBuilder().addComponents(claimButton, closeButton, archiveButton, deleteButton);

      await ticketChannel.send({
        content: mentions.join(' '),
        embeds: [welcomeEmbed],
        components: [actionRow]
      });

      // Save ticket to database
      const { error: dbError } = await this.supabase
        .from('tickets')
        .insert({
          ticket_number: ticketNumber,
          guild_id: guild.id,
          discord_user_id: user.id,
          discord_username: user.tag,
          discord_channel_id: ticketChannel.id,
          subject: effectiveSubject,
          description: description,
          status: 'open',
          priority: 'normal',
          category_id: categoryId || null
        });

      if (dbError) {
        console.error('Ticket Manager: error saving to database', dbError);
      }

      console.log(`✅ Created ticket ${ticketNumber} for ${user.tag}`);

      return {
        success: true,
        ticketNumber,
        channelId: ticketChannel.id
      };

    } catch (error) {
      console.error('Ticket Manager: error creating ticket', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Close a support ticket
   */
  async closeTicket(channel, user, reason = 'Resolved') {
    try {
      const topic = channel.topic || '';
      const ticketNumberMatch = topic.match(/Support Ticket\s+(T[0-9A-Z]+)/i);
      const ticketNumber = ticketNumberMatch ? ticketNumberMatch[1] : 'UNKNOWN';
      const subjectMatch = topic.match(/Subject:(.*)$/);
      const subject = subjectMatch ? subjectMatch[1].trim() : 'No subject';
      const userIdMatch = topic.match(/\((\d{17,})\)/);
      let ticketOwnerId = userIdMatch ? userIdMatch[1] : null;

      if (!ticketOwnerId) {
        const ownerOverwrite = channel.permissionOverwrites.cache.find(
          overwrite => overwrite.type === 1 && overwrite.id !== channel.guild.id && overwrite.id !== channel.client.user.id
        );
        ticketOwnerId = ownerOverwrite?.id || null;
      }

      // Gather transcript (limit 500 messages)
      const fetchedMessages = [];
      let lastId;
      const limit = 500;
      while (fetchedMessages.length < limit) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const batch = await channel.messages.fetch(options);
        if (!batch.size) break;
        fetchedMessages.push(...batch.values());
        lastId = batch.last().id;
        if (batch.size < 100) break;
      }

      fetchedMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      
      // Format timestamp for readability
      const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      };

      // Build transcript with nice formatting
      const transcriptParts = [];
      
      // Header
      transcriptParts.push('═'.repeat(80));
      transcriptParts.push('  TICKET TRANSCRIPT');
      transcriptParts.push('═'.repeat(80));
      transcriptParts.push('');
      transcriptParts.push(`Ticket Number: ${ticketNumber}`);
      transcriptParts.push(`Subject: ${subject}`);
      transcriptParts.push(`Guild: ${channel.guild.name} (${channel.guild.id})`);
      transcriptParts.push(`Channel: #${channel.name} (${channel.id})`);
      transcriptParts.push(`Created: ${formatTimestamp(channel.createdTimestamp)}`);
      transcriptParts.push(`Closed: ${formatTimestamp(Date.now())}`);
      transcriptParts.push(`Closed By: ${user.tag} (${user.id})`);
      transcriptParts.push(`Close Reason: ${reason || 'No reason provided'}`);
      transcriptParts.push('');
      transcriptParts.push('─'.repeat(80));
      transcriptParts.push('  CONVERSATION LOG');
      transcriptParts.push('─'.repeat(80));
      transcriptParts.push('');

      // Messages
      if (fetchedMessages.length === 0) {
        transcriptParts.push('  No messages found in this ticket.');
        transcriptParts.push('');
      } else {
        fetchedMessages.forEach((msg, index) => {
          const timestamp = formatTimestamp(msg.createdTimestamp);
          const author = msg.author ? msg.author.tag : 'Unknown';
          const authorId = msg.author ? msg.author.id : 'Unknown';
          const isBot = msg.author?.bot || false;
          
          // Message header
          transcriptParts.push(`[${timestamp}] ${author}${isBot ? ' (BOT)' : ''} (${authorId})`);
          transcriptParts.push('─'.repeat(80));
          
          // Message content
          if (msg.content && msg.content.trim()) {
            // Split long messages into lines for better readability
            const contentLines = msg.content.split('\n');
            contentLines.forEach(line => {
              transcriptParts.push(`  ${line}`);
            });
          }
          
          // Attachments
        if (msg.attachments.size > 0) {
            transcriptParts.push('');
            transcriptParts.push('  📎 Attachments:');
            msg.attachments.forEach(att => {
              transcriptParts.push(`    • ${att.name || 'Unnamed'} (${att.size} bytes)`);
              transcriptParts.push(`      ${att.url}`);
            });
          }
          
          // Embeds
          if (msg.embeds.length > 0) {
            transcriptParts.push('');
            transcriptParts.push('  📋 Embeds:');
            msg.embeds.forEach((embed, embedIndex) => {
              if (embed.title) transcriptParts.push(`    [${embedIndex + 1}] Title: ${embed.title}`);
              if (embed.description) {
                const descLines = embed.description.split('\n');
                descLines.forEach(line => {
                  transcriptParts.push(`         ${line}`);
                });
              }
              if (embed.fields && embed.fields.length > 0) {
                embed.fields.forEach(field => {
                  transcriptParts.push(`         ${field.name}: ${field.value}`);
                });
              }
              if (embed.footer?.text) {
                transcriptParts.push(`         Footer: ${embed.footer.text}`);
              }
            });
          }
          
          // Reactions
          if (msg.reactions.cache.size > 0) {
            const reactions = [];
            msg.reactions.cache.forEach(reaction => {
              reactions.push(`${reaction.emoji.name || reaction.emoji} (${reaction.count})`);
            });
            transcriptParts.push('');
            transcriptParts.push(`  👍 Reactions: ${reactions.join(', ')}`);
          }
          
          transcriptParts.push('');
          transcriptParts.push('');
        });
      }

      // Footer
      transcriptParts.push('═'.repeat(80));
      transcriptParts.push('  END OF TRANSCRIPT');
      transcriptParts.push('═'.repeat(80));
      transcriptParts.push('');
      transcriptParts.push(`Total Messages: ${fetchedMessages.length}`);
      transcriptParts.push(`Generated: ${formatTimestamp(Date.now())}`);
      transcriptParts.push('');

      const transcriptString = transcriptParts.join('\n');
      const transcriptBuffer = Buffer.from(transcriptString, 'utf8');
      const fileName = `${ticketNumber.toLowerCase()}-transcript.txt`;
      const dmAttachment = new AttachmentBuilder(transcriptBuffer, { name: fileName });

      // Send transcript to ticket owner
      const ticketOwner = ticketOwnerId ? await channel.client.users.fetch(ticketOwnerId).catch(() => null) : null;

      if (ticketOwner) {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('🔒 Your Ticket Has Been Closed')
          .setDescription(`Ticket **${ticketNumber}** (${subject}) has been closed by ${user.tag}.`)
          .addFields(
            { name: 'Reason', value: reason || 'No reason provided', inline: false }
          )
          .setTimestamp();

        await ticketOwner.send({ embeds: [dmEmbed], files: [dmAttachment] }).catch(() => {
          console.warn(`Could not DM transcript to user ${ticketOwnerId}.`);
        });
      }

      // Send close message in channel
      const transcriptEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket has been closed.\n\n**Please provide feedback using the rating buttons below to finalize this ticket.**`)
        .addFields(
          { name: 'Closed By', value: user.tag, inline: true },
          { name: 'Reason', value: reason, inline: true },
          { name: 'Closed At', value: new Date().toLocaleString('en-GB'), inline: true }
        )
        .setFooter({ text: 'Thank you for contacting support!' })
        .setTimestamp();

      await channel.send({ embeds: [transcriptEmbed], files: [dmAttachment] });

      // Send transcript to transcript channel if configured
      const config = await this.getConfig(channel.guild.id);
      if (config?.transcript_channel_id) {
        try {
          const transcriptChannel = channel.guild.channels.cache.get(config.transcript_channel_id) ||
            await channel.guild.channels.fetch(config.transcript_channel_id).catch(() => null);

          if (transcriptChannel && transcriptChannel.isTextBased()) {
            const transcriptChannelEmbed = new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle(`📋 Transcript: ${ticketNumber}`)
              .setDescription(`Ticket transcript for **${subject}**`)
              .addFields(
                { name: 'Ticket Number', value: ticketNumber, inline: true },
                { name: 'Subject', value: subject, inline: true },
                { name: 'Created By', value: ticketOwnerId ? `<@${ticketOwnerId}>` : 'Unknown', inline: true },
                { name: 'Closed By', value: user.tag, inline: true },
                { name: 'Close Reason', value: reason || 'No reason provided', inline: false },
                { name: 'Total Messages', value: fetchedMessages.length.toString(), inline: true },
                { name: 'Duration', value: this.formatDuration(channel.createdTimestamp, Date.now()), inline: true }
              )
              .setTimestamp();

            await transcriptChannel.send({
              embeds: [transcriptChannelEmbed],
              files: [dmAttachment]
            });
          }
        } catch (error) {
          console.error('Error sending transcript to transcript channel:', error);
        }
      }

      // Get ticket from database to update
      const { data: ticket } = await this.supabase
        .from('tickets')
        .select('id')
        .eq('discord_channel_id', channel.id)
        .single();

      // Update database
      await this.supabase
        .from('tickets')
        .update({
          status: 'closed',
          closed_by_discord_id: user.id,
          closed_by_username: user.tag,
          closed_at: new Date().toISOString(),
          close_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('discord_channel_id', channel.id);

      // Send rating request in the ticket channel (channel stays open until feedback is given)
      if (ticket && ticketOwnerId) {
        try {
          const ratingEmbed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('⭐ Rate Your Support Experience')
            .setDescription(`We'd love to hear your feedback about ticket **${ticketNumber}**!\n\nPlease rate your experience to help us improve our service.\n\n*This ticket will be closed after you provide feedback.*`)
            .setFooter({ text: 'Your feedback helps us provide better support' })
            .setTimestamp();

          const ratingRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`ticket_rate_${ticket.id}_1`)
                .setEmoji('⭐')
                .setLabel('1')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`ticket_rate_${ticket.id}_2`)
                .setEmoji('⭐')
                .setLabel('2')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`ticket_rate_${ticket.id}_3`)
                .setEmoji('⭐')
                .setLabel('3')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`ticket_rate_${ticket.id}_4`)
                .setEmoji('⭐')
                .setLabel('4')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`ticket_rate_${ticket.id}_5`)
                .setEmoji('⭐')
                .setLabel('5')
                .setStyle(ButtonStyle.Success)
            );

          // Send rating request in the ticket channel
          await channel.send({
            embeds: [ratingEmbed],
            components: [ratingRow]
          }).catch((err) => {
            console.warn(`Could not send rating request in ticket channel ${channel.id}:`, err);
          });

          // Mark rating as requested
          await this.markRatingRequested(ticket.id);
        } catch (error) {
          console.error('Error sending rating request:', error);
        }
      } else {
        // No rating needed, close immediately
        await this.finalizeTicketChannel(channel, config);
      }

      console.log(`[Tickets] Closed ticket ${channel.name} (waiting for feedback)`);
      return true;

    } catch (error) {
      console.error('Ticket Manager: error closing ticket', error);
      return false;
    }
  }

  /**
   * Finalize ticket channel after rating (close and archive)
   */
  async finalizeTicketChannel(channel, config = null) {
    try {
      if (!config) {
        config = await this.getConfig(channel.guild.id);
      }

      // Archive channel (rename and lock)
      await channel.setName(`closed-${channel.name}`);
      await channel.permissionOverwrites.edit(channel.guild.id, {
        SendMessages: false,
        ViewChannel: false
      });

      // Delete after configured hours
      const autoCloseHours = config?.auto_close_hours || 24;

      setTimeout(async () => {
        try {
          await channel.delete('Ticket auto-deleted after configured time');
        } catch (error) {
          console.error('Error deleting ticket channel:', error);
        }
      }, autoCloseHours * 60 * 60 * 1000);

      console.log(`[Tickets] Finalized ticket channel ${channel.name}`);
      return true;
    } catch (error) {
      console.error('Ticket Manager: error finalizing ticket channel', error);
      return false;
    }
  }

  /**
   * Claim a ticket
   */
  async claimTicket(channel, user) {
    try {
      // Get ticket from database
      const { data: ticket, error: fetchError } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('discord_channel_id', channel.id)
        .single();

      if (fetchError || !ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      if (ticket.status === 'closed') {
        return { success: false, error: 'Cannot claim a closed ticket' };
      }

      if (ticket.claimed_by) {
        return { success: false, error: 'This ticket is already claimed' };
      }

      // Update channel permissions to ensure user has access
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ManageMessages: true
      });

      // Update database
      const { error: updateError } = await this.supabase
        .from('tickets')
        .update({
          claimed_by: user.id,
          claimed_by_username: user.tag,
          claimed_at: new Date().toISOString(),
          status: 'claimed',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (updateError) {
        console.error('Error claiming ticket:', updateError);
        return { success: false, error: 'Database error' };
      }

      // Send confirmation message
      const claimEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Ticket Claimed')
        .setDescription(`${user} has claimed this ticket and will assist you.`)
        .setTimestamp();

      await channel.send({ embeds: [claimEmbed] });

      console.log(`[Tickets] ${user.tag} claimed ticket ${ticket.ticket_number}`);
      return { success: true };

    } catch (error) {
      console.error('Ticket Manager: error claiming ticket', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unclaim a ticket
   */
  async unclaimTicket(channel, user) {
    try {
      // Get ticket from database
      const { data: ticket, error: fetchError } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('discord_channel_id', channel.id)
        .single();

      if (fetchError || !ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      if (!ticket.claimed_by) {
        return { success: false, error: 'This ticket is not claimed' };
      }

      // Update database
      const { error: updateError } = await this.supabase
        .from('tickets')
        .update({
          claimed_by: null,
          claimed_by_username: null,
          claimed_at: null,
          status: 'open',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (updateError) {
        console.error('Error unclaiming ticket:', updateError);
        return { success: false, error: 'Database error' };
      }

      // Send confirmation message
      const unclaimEmbed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('🔄 Ticket Unclaimed')
        .setDescription(`${user} has unclaimed this ticket. It is now available for other support members.`)
        .setTimestamp();

      await channel.send({ embeds: [unclaimEmbed] });

      console.log(`[Tickets] ${user.tag} unclaimed ticket ${ticket.ticket_number}`);
      return { success: true };

    } catch (error) {
      console.error('Ticket Manager: error unclaiming ticket', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log a message to ticket_messages when it is sent in a ticket channel
   */
  async logMessageIfTicketChannel(message) {
    try {
      const channel = message.channel;

      if (!channel || !channel.name) return;

      // Only consider channels that look like tickets
      if (
        !channel.name.startsWith('ticket-') &&
        !channel.name.startsWith('closed-ticket-')
      ) {
        return;
      }

      // Skip bot messages (they're already filtered in message-create handler, but double-check)
      if (message.author?.bot) {
        return;
      }

      const { data: ticket, error } = await this.supabase
        .from('tickets')
        .select('id')
        .eq('discord_channel_id', channel.id)
        .in('status', ['open', 'claimed', 'closed', 'resolved'])
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Ticket Manager: error resolving ticket for message logging', error);
        }
        return;
      }

      if (!ticket) {
        // Ticket not found in database - might be an old ticket or not set up yet
        return;
      }

      // Check if message already exists (prevent duplicates)
      const { data: existing } = await this.supabase
        .from('ticket_messages')
        .select('id')
        .eq('discord_message_id', message.id)
        .maybeSingle();

      if (existing) {
        // Message already logged, skip
        return;
      }

      const content = message.content || null;

      const { error: insertError } = await this.supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          discord_message_id: message.id,
          author_discord_id: message.author?.id || 'unknown',
          author_username: message.author?.tag || message.author?.username || 'Unknown',
          content,
          has_attachments: message.attachments?.size > 0,
          has_embeds: message.embeds?.length > 0,
        });

      if (insertError) {
        // If table doesn't exist yet, fail silently
        if (insertError.code === 'PGRST116') {
          return;
        }
        // If duplicate key error, that's okay (race condition)
        if (insertError.code === '23505') {
          return;
        }
        console.error('Ticket Manager: error logging ticket message', insertError);
      } else {
        // Successfully logged
        console.log(`[Tickets] Logged message ${message.id} for ticket ${ticket.id}`);
      }
    } catch (error) {
      console.error('Ticket Manager: error in logMessageIfTicketChannel', error);
    }
  }

  /**
   * Sync historical messages from a Discord channel to the database
   * Useful for tickets that existed before message logging was enabled
   */
  async syncHistoricalMessages(channel, ticketId) {
    try {
      if (!channel || !ticketId) {
        return { success: false, error: 'Channel and ticket ID required' };
      }

      // Get ticket to verify it exists
      const { data: ticket } = await this.supabase
        .from('tickets')
        .select('id')
        .eq('id', ticketId)
        .single();

      if (!ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      let syncedCount = 0;
      let skippedCount = 0;
      let lastMessageId = null;
      let hasMore = true;

      // Fetch messages in batches (Discord API limit is 100 per request)
      while (hasMore) {
        const options = { limit: 100 };
        if (lastMessageId) {
          options.before = lastMessageId;
        }

        const messages = await channel.messages.fetch(options);

        if (messages.size === 0) {
          hasMore = false;
          break;
        }

        // Process messages in reverse order (oldest first)
        const sortedMessages = Array.from(messages.values()).reverse();

        for (const message of sortedMessages) {
          // Skip bot messages
          if (message.author?.bot) {
            skippedCount++;
            continue;
          }

          // Check if message already exists
          const { data: existing } = await this.supabase
            .from('ticket_messages')
            .select('id')
            .eq('discord_message_id', message.id)
            .maybeSingle();

          if (existing) {
            skippedCount++;
            continue;
          }

          // Insert message
          const { error: insertError } = await this.supabase
            .from('ticket_messages')
            .insert({
              ticket_id: ticketId,
              discord_message_id: message.id,
              author_discord_id: message.author?.id || 'unknown',
              author_username: message.author?.tag || message.author?.username || 'Unknown',
              content: message.content || null,
              has_attachments: message.attachments?.size > 0,
              has_embeds: message.embeds?.length > 0,
            });

          if (insertError) {
            if (insertError.code === '23505') {
              // Duplicate key, skip
              skippedCount++;
            } else {
              console.error('Error syncing message:', insertError);
            }
          } else {
            syncedCount++;
          }

          lastMessageId = message.id;
        }

        // If we got less than 100 messages, we've reached the end
        if (messages.size < 100) {
          hasMore = false;
        }
      }

      console.log(`[Tickets] Synced ${syncedCount} messages, skipped ${skippedCount} for ticket ${ticketId}`);
      return {
        success: true,
        synced: syncedCount,
        skipped: skippedCount
      };
    } catch (error) {
      console.error('Ticket Manager: error syncing historical messages', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all tickets for a guild
   */
  async getGuildTickets(guildId, status = null) {
    try {
      let query = this.supabase
        .from('tickets')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ticket Manager: error fetching tickets', error);
      return [];
    }
  }

  /**
   * Get a single ticket by ID
   */
  async getTicket(ticketId) {
    try {
      const { data, error } = await this.supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ticket Manager: error fetching ticket', error);
      return null;
    }
  }

  /**
   * Get ticket statistics for a guild
   */
  async getStats(guildId) {
    try {
      const tickets = await this.getGuildTickets(guildId);

      return {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        claimed: tickets.filter(t => t.status === 'claimed').length,
        closed: tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length
      };
    } catch (error) {
      console.error('Ticket Manager: error getting stats', error);
      return { total: 0, open: 0, claimed: 0, closed: 0 };
    }
  }

  /**
   * Get ticket templates for a guild
   */
  async getTemplates(guildId, categoryId = null) {
    try {
      let query = this.supabase
        .from('ticket_templates')
        .select('*')
        .eq('guild_id', guildId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (categoryId) {
        query = query.or(`category_id.eq.${categoryId},category_id.is.null`);
      } else {
        query = query.is('category_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Ticket Manager: error fetching templates', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Ticket Manager: error in getTemplates', error);
      return [];
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplateById(templateId) {
    try {
      const { data, error } = await this.supabase
        .from('ticket_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Ticket Manager: error fetching template', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('Ticket Manager: error in getTemplateById', error);
      return null;
    }
  }

  /**
   * Process template variables
   */
  processTemplateVariables(template, variables = {}) {
    let subject = template.subject || '';
    let description = template.description_text || '';

    // Default variables
    const defaults = {
      username: variables.username || 'User',
      date: new Date().toLocaleDateString('nl-NL'),
      time: new Date().toLocaleTimeString('nl-NL'),
      datetime: new Date().toLocaleString('nl-NL'),
      ...variables
    };

    // Replace variables in subject and description
    Object.keys(defaults).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      subject = subject.replace(regex, defaults[key]);
      description = description.replace(regex, defaults[key]);
    });

    return { subject, description };
  }

  /**
   * Submit a ticket rating
   */
  async submitRating(ticketId, discordUserId, rating, feedback = null) {
    try {
      // Get ticket to verify ownership
      const { data: ticket, error: ticketError } = await this.supabase
        .from('tickets')
        .select('id, guild_id, discord_user_id')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        return { success: false, error: 'Ticket not found' };
      }

      if (ticket.discord_user_id !== discordUserId) {
        return { success: false, error: 'You can only rate your own tickets' };
      }

      // Check if already rated
      const { data: existing } = await this.supabase
        .from('ticket_ratings')
        .select('id')
        .eq('ticket_id', ticketId)
        .eq('discord_user_id', discordUserId)
        .maybeSingle();

      if (existing) {
        return { success: false, error: 'You have already rated this ticket' };
      }

      // Get user ID from discord_id
      const { data: userData } = await this.supabase
        .from('users')
        .select('id')
        .eq('discord_id', discordUserId)
        .maybeSingle();

      // Insert rating
      const { error: ratingError } = await this.supabase
        .from('ticket_ratings')
        .insert({
          ticket_id: ticketId,
          guild_id: ticket.guild_id,
          user_id: userData?.id || null,
          discord_user_id: discordUserId,
          rating: rating,
          feedback: feedback
        });

      if (ratingError) {
        console.error('Ticket Manager: error submitting rating', ratingError);
        return { success: false, error: 'Failed to submit rating' };
      }

      return { success: true };
    } catch (error) {
      console.error('Ticket Manager: error in submitRating', error);
      return { success: false, error: error.message || 'Failed to submit rating' };
    }
  }

  /**
   * Get ratings for a ticket
   */
  async getTicketRating(ticketId) {
    try {
      const { data, error } = await this.supabase
        .from('ticket_ratings')
        .select('*')
        .eq('ticket_id', ticketId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Ticket Manager: error fetching rating', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('Ticket Manager: error in getTicketRating', error);
      return null;
    }
  }

  /**
   * Get rating statistics for a guild
   */
  async getRatingStats(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('ticket_ratings')
        .select('rating')
        .eq('guild_id', guildId);

      if (error) {
        console.error('Ticket Manager: error fetching rating stats', error);
        return { average: 0, total: 0, distribution: {} };
      }

      if (!data || data.length === 0) {
        return { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
      }

      const total = data.length;
      const sum = data.reduce((acc, r) => acc + r.rating, 0);
      const average = sum / total;

      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      data.forEach(r => {
        distribution[r.rating] = (distribution[r.rating] || 0) + 1;
      });

      return { average: Math.round(average * 10) / 10, total, distribution };
    } catch (error) {
      console.error('Ticket Manager: error in getRatingStats', error);
      return { average: 0, total: 0, distribution: {} };
    }
  }

  /**
   * Mark rating as requested for a ticket
   */
  async markRatingRequested(ticketId) {
    try {
      const { error } = await this.supabase
        .from('tickets')
        .update({
          rating_requested: true,
          rating_requested_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) {
        console.error('Ticket Manager: error marking rating requested', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Ticket Manager: error in markRatingRequested', error);
      return false;
    }
  }
}

module.exports = new TicketManager();

