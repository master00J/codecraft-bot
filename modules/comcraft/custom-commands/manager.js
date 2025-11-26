/**
 * Comcraft Custom Commands Manager
 * Handle creation, execution, and management of custom commands
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');
const configManager = require('../config-manager');

class CustomCommandsManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.cache = new Map(); // guildId -> commands[]
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get all commands for a guild (cached)
   */
  async getGuildCommands(guildId) {
    const cacheKey = `commands:${guildId}`;
    
    if (this.cache.has(cacheKey)) {
      const { commands, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        return commands;
      }
    }

    const { data, error } = await this.supabase
      .from('custom_commands')
      .select('*')
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error fetching custom commands:', error);
      return [];
    }

    this.cache.set(cacheKey, {
      commands: data || [],
      timestamp: Date.now()
    });

    return data || [];
  }

  /**
   * Check if command exists
   */
  async commandExists(guildId, trigger) {
    const commands = await this.getGuildCommands(guildId);
    return commands.some(cmd => cmd.trigger.toLowerCase() === trigger.toLowerCase());
  }

  /**
   * Get specific command
   */
  async getCommand(guildId, trigger) {
    const commands = await this.getGuildCommands(guildId);
    return commands.find(cmd => cmd.trigger.toLowerCase() === trigger.toLowerCase());
  }

  /**
   * Create new custom command
   */
  async createCommand(guildId, trigger, response, options = {}) {
    try {
      // Check if command already exists
      if (await this.commandExists(guildId, trigger)) {
        return { success: false, error: 'Command bestaat al' };
      }

      // Check subscription limits
      const limits = await configManager.getSubscriptionLimits(guildId);
      if (limits && limits.custom_commands !== -1) {
        const currentCount = (await this.getGuildCommands(guildId)).length;
        if (currentCount >= limits.custom_commands) {
          return { 
            success: false, 
            error: `Limiet bereikt (${limits.custom_commands} commands). Upgrade je subscription!` 
          };
        }
      }

      const { data, error } = await this.supabase
        .from('custom_commands')
        .insert({
          guild_id: guildId,
          trigger: trigger.toLowerCase(),
          response,
          embed_enabled: options.embed_enabled || false,
          embed_title: options.embed_title,
          embed_description: options.embed_description,
          embed_color: options.embed_color || '#5865F2',
          embed_thumbnail_url: options.embed_thumbnail_url,
          embed_image_url: options.embed_image_url,
          embed_footer: options.embed_footer,
          embed_fields: options.embed_fields,
          allowed_roles: options.allowed_roles || [],
          allowed_channels: options.allowed_channels || [],
          created_by: options.created_by
        })
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      this.cache.delete(`commands:${guildId}`);

      return { success: true, data };
    } catch (error) {
      console.error('Error creating custom command:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update existing command
   */
  async updateCommand(guildId, trigger, updates) {
    try {
      const { data, error } = await this.supabase
        .from('custom_commands')
        .update(updates)
        .eq('guild_id', guildId)
        .eq('trigger', trigger.toLowerCase())
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      this.cache.delete(`commands:${guildId}`);

      return { success: true, data };
    } catch (error) {
      console.error('Error updating custom command:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete command
   */
  async deleteCommand(guildId, trigger) {
    try {
      const { error } = await this.supabase
        .from('custom_commands')
        .delete()
        .eq('guild_id', guildId)
        .eq('trigger', trigger.toLowerCase());

      if (error) throw error;

      // Invalidate cache
      this.cache.delete(`commands:${guildId}`);

      return { success: true };
    } catch (error) {
      console.error('Error deleting custom command:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute custom command
   */
  async executeCommand(message, command) {
    try {
      // Check channel permissions
      if (command.allowed_channels && command.allowed_channels.length > 0) {
        if (!command.allowed_channels.includes(message.channel.id)) {
          return false;
        }
      }

      // Check role permissions
      if (command.allowed_roles && command.allowed_roles.length > 0) {
        const hasRole = command.allowed_roles.some(roleId => 
          message.member.roles.cache.has(roleId)
        );
        if (!hasRole) {
          return false;
        }
      }

      // Update usage count
      await this.supabase
        .from('custom_commands')
        .update({
          uses: command.uses + 1,
          last_used: new Date().toISOString()
        })
        .eq('id', command.id);

      // Parse variables in response
      const parsedResponse = this.parseVariables(command.response, message);

      if (command.embed_enabled) {
        // Send as embed
        const embed = new EmbedBuilder()
          .setColor(command.embed_color || '#5865F2');

        if (command.embed_title) {
          embed.setTitle(this.parseVariables(command.embed_title, message));
        }

        if (command.embed_description) {
          embed.setDescription(this.parseVariables(command.embed_description, message));
        }

        if (command.embed_thumbnail_url) {
          embed.setThumbnail(command.embed_thumbnail_url);
        }

        if (command.embed_image_url) {
          embed.setImage(command.embed_image_url);
        }

        if (command.embed_footer) {
          embed.setFooter({ text: this.parseVariables(command.embed_footer, message) });
        }

        if (command.embed_fields && Array.isArray(command.embed_fields)) {
          command.embed_fields.forEach(field => {
            embed.addFields({
              name: this.parseVariables(field.name, message),
              value: this.parseVariables(field.value, message),
              inline: field.inline || false
            });
          });
        }

        await message.channel.send({ 
          content: parsedResponse || null,
          embeds: [embed] 
        });
      } else {
        // Send as plain text
        await message.channel.send(parsedResponse);
      }

      return true;
    } catch (error) {
      console.error('Error executing custom command:', error);
      return false;
    }
  }

  /**
   * Parse variables in text
   */
  parseVariables(text, message) {
    if (!text) return text;

    return text
      .replace(/{user}/g, message.author.toString())
      .replace(/{username}/g, message.author.username)
      .replace(/{tag}/g, message.author.tag)
      .replace(/{server}/g, message.guild.name)
      .replace(/{channel}/g, message.channel.toString())
      .replace(/{membercount}/g, message.guild.memberCount.toString())
      .replace(/{date}/g, new Date().toLocaleDateString('en-US'))
      .replace(/{time}/g, new Date().toLocaleTimeString('en-US'));
  }

  /**
   * Get command usage statistics
   */
  async getCommandStats(guildId) {
    const { data } = await this.supabase
      .from('custom_commands')
      .select('trigger, uses, last_used')
      .eq('guild_id', guildId)
      .order('uses', { ascending: false });

    return data || [];
  }

  /**
   * Import commands from another guild (admin feature)
   */
  async importCommands(sourceGuildId, targetGuildId) {
    try {
      const { data: commands } = await this.supabase
        .from('custom_commands')
        .select('*')
        .eq('guild_id', sourceGuildId);

      if (!commands || commands.length === 0) {
        return { success: false, error: 'No commands found' };
      }

      // Insert commands to target guild
      const newCommands = commands.map(cmd => ({
        ...cmd,
        guild_id: targetGuildId,
        id: undefined, // Let database generate new ID
        uses: 0,
        last_used: null
      }));

      const { error } = await this.supabase
        .from('custom_commands')
        .insert(newCommands);

      if (error) throw error;

      // Invalidate cache
      this.cache.delete(`commands:${targetGuildId}`);

      return { success: true, count: newCommands.length };
    } catch (error) {
      console.error('Error importing commands:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear cache
   */
  clearCache(guildId = null) {
    if (guildId) {
      this.cache.delete(`commands:${guildId}`);
    } else {
      this.cache.clear();
    }
  }
}

module.exports = new CustomCommandsManager();

