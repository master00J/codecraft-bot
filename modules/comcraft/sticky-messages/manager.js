/**
 * Comcraft Sticky Messages Manager
 * Keeps messages pinned at the bottom of channels
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');

class StickyMessagesManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Track last message IDs to avoid spam
    this.lastMessageIds = new Map(); // channelId -> messageId
    this.cooldowns = new Map(); // channelId -> timestamp
    this.COOLDOWN_MS = 3000; // 3 seconds cooldown between re-posts
  }

  /**
   * Initialize sticky messages - load from database
   */
  async initialize() {
    try {
      const { data: stickyMessages, error } = await this.supabase
        .from('sticky_messages')
        .select('*')
        .eq('enabled', true);

      if (error) {
        if (error.code === '42P01') {
          console.log('📌 Sticky messages table not found, skipping initialization');
          return;
        }
        console.error('Error loading sticky messages:', error);
        return;
      }

      if (stickyMessages && stickyMessages.length > 0) {
        stickyMessages.forEach(sticky => {
          this.lastMessageIds.set(sticky.channel_id, sticky.last_message_id);
        });
        console.log(`📌 Loaded ${stickyMessages.length} sticky message(s)`);
      }
    } catch (error) {
      console.error('Error initializing sticky messages:', error);
    }
  }

  /**
   * Handle new message in channel - repost sticky if needed
   */
  async handleMessage(message) {
    // Ignore bot messages and DMs
    if (message.author.bot || !message.guild) return;

    const channelId = message.channel.id;
    const guildId = message.guild.id;

    try {
      // Check if channel has a sticky message
      const { data: sticky, error } = await this.supabase
        .from('sticky_messages')
        .select('*')
        .eq('guild_id', guildId)
        .eq('channel_id', channelId)
        .eq('enabled', true)
        .single();

      if (error || !sticky) return;

      // Check cooldown to avoid spam
      const now = Date.now();
      const lastCooldown = this.cooldowns.get(channelId) || 0;
      if (now - lastCooldown < this.COOLDOWN_MS) {
        return;
      }

      // Delete old sticky message if it exists
      const oldMessageId = sticky.last_message_id || this.lastMessageIds.get(channelId);
      if (oldMessageId) {
        try {
          const oldMessage = await message.channel.messages.fetch(oldMessageId);
          await oldMessage.delete();
        } catch (err) {
          // Message might already be deleted, ignore
        }
      }

      // Post new sticky message
      const newMessage = await this.sendStickyMessage(message.channel, sticky);
      if (newMessage) {
        // Update last message ID in database
        await this.supabase
          .from('sticky_messages')
          .update({ 
            last_message_id: newMessage.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', sticky.id);

        this.lastMessageIds.set(channelId, newMessage.id);
        this.cooldowns.set(channelId, now);
      }
    } catch (error) {
      console.error('Error handling sticky message:', error);
    }
  }

  /**
   * Send sticky message to channel
   */
  async sendStickyMessage(channel, sticky) {
    try {
      const options = {
        content: sticky.message_content || null
      };

      // Add embed if data exists
      if (sticky.embed_data) {
        const embedData = sticky.embed_data;
        const embed = new EmbedBuilder();
        
        if (embedData.title) embed.setTitle(embedData.title);
        if (embedData.description) embed.setDescription(embedData.description);
        if (embedData.color) embed.setColor(embedData.color);
        if (embedData.footer) embed.setFooter({ text: embedData.footer });
        if (embedData.thumbnail) embed.setThumbnail(embedData.thumbnail);
        if (embedData.image) embed.setImage(embedData.image);
        if (embedData.fields && Array.isArray(embedData.fields)) {
          embedData.fields.forEach(field => {
            embed.addFields({ 
              name: field.name, 
              value: field.value, 
              inline: field.inline || false 
            });
          });
        }

        options.embeds = [embed];
      }

      return await channel.send(options);
    } catch (error) {
      console.error('Error sending sticky message:', error);
      return null;
    }
  }

  /**
   * Set sticky message for a channel
   */
  async setSticky(guildId, channelId, content, embedData = null) {
    try {
      // Upsert sticky message
      const { data, error } = await this.supabase
        .from('sticky_messages')
        .upsert({
          guild_id: guildId,
          channel_id: channelId,
          message_content: content,
          embed_data: embedData,
          enabled: true,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, sticky: data };
    } catch (error) {
      console.error('Error setting sticky message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove sticky message from channel
   */
  async removeSticky(guildId, channelId) {
    try {
      // Get sticky message info
      const { data: sticky } = await this.supabase
        .from('sticky_messages')
        .select('*')
        .eq('guild_id', guildId)
        .eq('channel_id', channelId)
        .single();

      // Delete from database
      const { error } = await this.supabase
        .from('sticky_messages')
        .delete()
        .eq('guild_id', guildId)
        .eq('channel_id', channelId);

      if (error) throw error;

      // Try to delete the message from Discord
      if (sticky?.last_message_id) {
        try {
          const channel = await this.client.channels.fetch(channelId);
          const message = await channel.messages.fetch(sticky.last_message_id);
          await message.delete();
        } catch (err) {
          // Message might already be deleted
        }
      }

      this.lastMessageIds.delete(channelId);
      this.cooldowns.delete(channelId);

      return { success: true };
    } catch (error) {
      console.error('Error removing sticky message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Toggle sticky message on/off
   */
  async toggleSticky(guildId, channelId, enabled) {
    try {
      const { error } = await this.supabase
        .from('sticky_messages')
        .update({ 
          enabled,
          updated_at: new Date().toISOString()
        })
        .eq('guild_id', guildId)
        .eq('channel_id', channelId);

      if (error) throw error;

      // If disabling, remove the message
      if (!enabled) {
        const { data: sticky } = await this.supabase
          .from('sticky_messages')
          .select('last_message_id')
          .eq('guild_id', guildId)
          .eq('channel_id', channelId)
          .single();

        if (sticky?.last_message_id) {
          try {
            const channel = await this.client.channels.fetch(channelId);
            const message = await channel.messages.fetch(sticky.last_message_id);
            await message.delete();
          } catch (err) {
            // Ignore
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error toggling sticky message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sticky message for channel
   */
  async getSticky(guildId, channelId) {
    try {
      const { data, error } = await this.supabase
        .from('sticky_messages')
        .select('*')
        .eq('guild_id', guildId)
        .eq('channel_id', channelId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, sticky: null };
        }
        throw error;
      }

      return { success: true, sticky: data };
    } catch (error) {
      console.error('Error getting sticky message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all sticky messages for a guild
   */
  async listStickies(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('sticky_messages')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, stickies: data || [] };
    } catch (error) {
      console.error('Error listing sticky messages:', error);
      return { success: false, error: error.message, stickies: [] };
    }
  }

  /**
   * Force refresh sticky message in channel
   */
  async refreshSticky(channelId) {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.guild) return { success: false, error: 'Channel not found' };

      const { data: sticky, error } = await this.supabase
        .from('sticky_messages')
        .select('*')
        .eq('guild_id', channel.guild.id)
        .eq('channel_id', channelId)
        .eq('enabled', true)
        .single();

      if (error || !sticky) {
        return { success: false, error: 'No sticky message found for this channel' };
      }

      // Delete old message
      if (sticky.last_message_id) {
        try {
          const oldMessage = await channel.messages.fetch(sticky.last_message_id);
          await oldMessage.delete();
        } catch (err) {
          // Ignore
        }
      }

      // Post new message
      const newMessage = await this.sendStickyMessage(channel, sticky);
      if (newMessage) {
        await this.supabase
          .from('sticky_messages')
          .update({ 
            last_message_id: newMessage.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', sticky.id);

        this.lastMessageIds.set(channelId, newMessage.id);
        return { success: true, message: newMessage };
      }

      return { success: false, error: 'Failed to send sticky message' };
    } catch (error) {
      console.error('Error refreshing sticky message:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = StickyMessagesManager;
