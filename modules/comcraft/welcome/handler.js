/**
 * Comcraft Welcome System
 * Handle member join/leave messages and auto-roles
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const configManager = require('../config-manager');

class WelcomeHandler {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Handle member join
   */
  async handleMemberJoin(member) {
    try {
      // Check if guild has welcome feature (Basic tier+)
      const hasWelcome = await configManager.hasFeature(member.guild.id, 'welcome');
      if (!hasWelcome) {
        console.log(`[Welcome] Guild ${member.guild.id} doesn't have welcome feature`);
        return;
      }

      const config = await configManager.getWelcomeConfig(member.guild.id);
      
      if (!config || !config.welcome_enabled) return;

      // Send welcome message
      if (config.welcome_channel_id) {
        await this.sendWelcomeMessage(member, config);
      }

      // Send DM
      if (config.welcome_dm_enabled && config.welcome_dm_message) {
        await this.sendWelcomeDM(member, config);
      }

      // Give auto-roles
      if (config.autorole_enabled && config.autorole_ids && config.autorole_ids.length > 0) {
        // Check if we should ignore bots
        if (config.autorole_ignore_bots && member.user.bot) {
          console.log(`[Welcome] Skipping auto-role for bot ${member.user.tag}`);
        } else {
          await this.giveAutoRoles(member, config);
        }
      }
    } catch (error) {
      console.error('Error handling member join:', error);
    }
  }

  /**
   * Send welcome message to channel
   */
  async sendWelcomeMessage(member, config) {
    try {
      const channel = member.guild.channels.cache.get(config.welcome_channel_id);
      if (!channel) return;

      // Get custom bot personalization
      const botPersonalization = await configManager.getBotPersonalization(member.guild.id);

      // Build mention string
      let mentionString = '';
      if (config.welcome_mention_everyone) {
        mentionString += '@everyone ';
      }
      if (config.welcome_mention_here) {
        mentionString += '@here ';
      }
      if (config.welcome_mention_user !== false) {
        mentionString += member.toString() + ' ';
      }
      if (config.welcome_mention_roles && config.welcome_mention_roles.length > 0) {
        const roleMentions = config.welcome_mention_roles
          .map(roleId => {
            const role = member.guild.roles.cache.get(roleId);
            return role ? role.toString() : null;
          })
          .filter(Boolean);
        if (roleMentions.length > 0) {
          mentionString += roleMentions.join(' ') + ' ';
        }
      }

      if (config.welcome_embed_enabled) {
        // Send as embed with full customization
        const embedColor = config.welcome_embed_color 
          ? this.parseColor(config.welcome_embed_color)
          : (botPersonalization.color || 0x5865F2);

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTimestamp();

        // Title
        if (config.welcome_embed_title) {
          embed.setTitle(this.parseVariables(config.welcome_embed_title, member));
        }

        // Description
        if (config.welcome_embed_description) {
          embed.setDescription(this.parseVariables(config.welcome_embed_description, member));
        }

        // Author
        if (config.welcome_embed_author_name) {
          embed.setAuthor({
            name: this.parseVariables(config.welcome_embed_author_name, member),
            iconURL: config.welcome_embed_author_icon_url || undefined,
            url: config.welcome_embed_author_url || undefined
          });
        }

        // Thumbnail (use custom or user avatar)
        if (config.welcome_embed_thumbnail_url) {
          embed.setThumbnail(config.welcome_embed_thumbnail_url);
        } else if (member.user.displayAvatarURL()) {
          embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        }

        // Image
        if (config.welcome_embed_image_url) {
          embed.setImage(config.welcome_embed_image_url);
        }

        // Custom fields
        if (config.welcome_embed_fields && Array.isArray(config.welcome_embed_fields)) {
          config.welcome_embed_fields.forEach(field => {
            if (field.name && field.value) {
              embed.addFields({
                name: this.parseVariables(field.name, member),
                value: this.parseVariables(field.value, member),
                inline: field.inline || false
              });
            }
          });
        }

        // Statistics fields (if enabled)
        if (config.welcome_stats_enabled) {
          const statsFields = [];
          
          if (config.welcome_show_join_position !== false) {
            statsFields.push({
              name: '👤 Member',
              value: member.user.tag,
              inline: true
            });
            statsFields.push({
              name: '📊 Position',
              value: `#${member.guild.memberCount}`,
              inline: true
            });
          }

          if (config.welcome_show_account_age) {
            const accountAge = this.getAccountAge(member.user.createdAt);
            statsFields.push({
              name: '📅 Account Age',
              value: accountAge,
              inline: true
            });
          }

          if (statsFields.length > 0) {
            embed.addFields(statsFields);
          }
        } else {
          // Default stats if not using custom fields
          if (!config.welcome_embed_fields || config.welcome_embed_fields.length === 0) {
            embed.addFields(
              { name: '👤 Member', value: member.user.tag, inline: true },
              { name: '📊 Member', value: `#${member.guild.memberCount}`, inline: true }
            );
          }
        }

        // Footer
        if (config.welcome_embed_footer_text || botPersonalization.footer) {
          embed.setFooter({
            text: this.parseVariables(
              config.welcome_embed_footer_text || botPersonalization.footer || '',
              member
            ),
            iconURL: config.welcome_embed_footer_icon_url || botPersonalization.avatarURL || undefined
          });
        }

        // Build message options
        const messageOptions = {
          content: mentionString.trim() || undefined,
          embeds: [embed]
        };

        // Add buttons if enabled
        if (config.welcome_buttons_enabled && config.welcome_buttons && config.welcome_buttons.length > 0) {
          const buttonRows = this.buildButtonRows(config.welcome_buttons, member);
          if (buttonRows.length > 0) {
            messageOptions.components = buttonRows;
          }
        }

        // Send message
        const sentMessage = await channel.send(messageOptions);

        // Delete after delay if configured
        if (config.welcome_delete_after && config.welcome_delete_after > 0) {
          setTimeout(async () => {
            try {
              await sentMessage.delete();
            } catch (error) {
              console.error('Error deleting welcome message:', error);
            }
          }, config.welcome_delete_after * 1000);
        }
      } else {
        // Send as plain message
        const message = this.parseVariables(
          config.welcome_message || 'Welcome {user} to {server}!',
          member
        );

        const fullMessage = mentionString.trim() 
          ? `${mentionString.trim()}\n${message}`
          : message;

        const sentMessage = await channel.send(fullMessage);

        // Delete after delay if configured
        if (config.welcome_delete_after && config.welcome_delete_after > 0) {
          setTimeout(async () => {
            try {
              await sentMessage.delete();
            } catch (error) {
              console.error('Error deleting welcome message:', error);
            }
          }, config.welcome_delete_after * 1000);
        }
      }
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }

  /**
   * Send welcome DM
   */
  async sendWelcomeDM(member, config) {
    try {
      if (config.welcome_dm_embed_enabled) {
        const embedColor = config.welcome_dm_embed_color 
          ? this.parseColor(config.welcome_dm_embed_color)
          : 0x5865F2;

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTimestamp();

        if (config.welcome_dm_embed_title) {
          embed.setTitle(this.parseVariables(config.welcome_dm_embed_title, member));
        }

        if (config.welcome_dm_embed_description) {
          embed.setDescription(this.parseVariables(config.welcome_dm_embed_description, member));
        }

        if (config.welcome_dm_embed_image_url) {
          embed.setImage(config.welcome_dm_embed_image_url);
        }

        if (member.user.displayAvatarURL()) {
          embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        }

        await member.user.send({ embeds: [embed] });
      } else {
        const message = this.parseVariables(
          config.welcome_dm_message || 'Welcome to {server}!',
          member
        );
        await member.user.send(message);
      }
    } catch (error) {
      // User has DMs disabled
      console.log(`Could not send welcome DM to ${member.user.tag}`);
    }
  }

  /**
   * Give auto-roles to member
   */
  async giveAutoRoles(member, config) {
    try {
      const delay = (config.autorole_delay || 0) * 1000;

      if (delay > 0) {
        setTimeout(async () => {
          await this.assignRoles(member, config.autorole_ids);
        }, delay);
      } else {
        await this.assignRoles(member, config.autorole_ids);
      }
    } catch (error) {
      console.error('Error giving auto-roles:', error);
    }
  }

  /**
   * Assign roles to member
   */
  async assignRoles(member, roleIds) {
    try {
      const roles = roleIds
        .map(id => member.guild.roles.cache.get(id))
        .filter(role => role !== undefined && role.editable);

      if (roles.length > 0) {
        await member.roles.add(roles);
        console.log(`✅ Gave auto-roles to ${member.user.tag}`);
      }
    } catch (error) {
      console.error('Error assigning roles:', error);
    }
  }

  /**
   * Remove roles from member (on leave)
   */
  async removeRoles(member, roleIds) {
    try {
      const roles = roleIds
        .map(id => member.guild.roles.cache.get(id))
        .filter(role => role !== undefined && role.editable);

      if (roles.length > 0) {
        await member.roles.remove(roles);
        console.log(`✅ Removed auto-roles from ${member.user.tag}`);
      }
    } catch (error) {
      console.error('Error removing roles:', error);
    }
  }

  /**
   * Remove unverified role when user verifies
   * This is called when a user completes verification (via button, command, etc.)
   */
  async removeUnverifiedRole(member) {
    try {
      const config = await configManager.getWelcomeConfig(member.guild.id);
      
      if (!config || !config.unverified_role_id) {
        // No unverified role configured, nothing to do
        return { success: true, removed: false };
      }

      const unverifiedRole = member.guild.roles.cache.get(config.unverified_role_id);
      
      if (!unverifiedRole) {
        console.warn(`[Welcome] Unverified role ${config.unverified_role_id} not found in guild ${member.guild.id}`);
        return { success: false, error: 'Unverified role not found' };
      }

      // Check if member has the role
      if (!member.roles.cache.has(config.unverified_role_id)) {
        // Member doesn't have the role, nothing to remove
        return { success: true, removed: false };
      }

      // Remove the role
      await member.roles.remove(unverifiedRole);
      console.log(`✅ Removed unverified role from ${member.user.tag} in ${member.guild.name}`);
      
      return { success: true, removed: true, roleName: unverifiedRole.name };
    } catch (error) {
      console.error('Error removing unverified role:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle member leave
   */
  async handleMemberLeave(member) {
    try {
      const config = await configManager.getWelcomeConfig(member.guild.id);
      
      if (!config || !config.leave_enabled || !config.leave_channel_id) return;

      const channel = member.guild.channels.cache.get(config.leave_channel_id);
      if (!channel) return;

      // Remove auto-roles if configured
      if (config.autorole_remove_on_leave && config.autorole_ids && config.autorole_ids.length > 0) {
        await this.removeRoles(member, config.autorole_ids);
      }

      if (config.leave_embed_enabled) {
        const embedColor = config.leave_embed_color 
          ? this.parseColor(config.leave_embed_color)
          : 0xFF0000;

        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTimestamp();

        if (config.leave_embed_title) {
          embed.setTitle(this.parseVariables(config.leave_embed_title, member));
        }

        if (config.leave_embed_description) {
          embed.setDescription(this.parseVariables(config.leave_embed_description, member));
        } else {
          embed.setDescription(this.parseVariables(
            config.leave_message || '{user} has left the server.',
            member
          ));
        }

        if (config.leave_embed_thumbnail_url) {
          embed.setThumbnail(config.leave_embed_thumbnail_url);
        } else if (member.user.displayAvatarURL()) {
          embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
        }

        if (config.leave_embed_image_url) {
          embed.setImage(config.leave_embed_image_url);
        }

        embed.addFields(
          { name: '👤 Member', value: member.user.tag, inline: true },
          { name: '📊 Members Left', value: member.guild.memberCount.toString(), inline: true }
        );

        if (config.leave_embed_footer_text) {
          embed.setFooter({
            text: this.parseVariables(config.leave_embed_footer_text, member),
            iconURL: config.leave_embed_footer_icon_url || undefined
          });
        }

        await channel.send({ embeds: [embed] });
      } else {
        const message = this.parseVariables(
          config.leave_message || '{user} has left the server.',
          member
        );
        await channel.send(message);
      }
    } catch (error) {
      console.error('Error handling member leave:', error);
    }
  }

  /**
   * Parse variables in text
   */
  parseVariables(text, member) {
    if (!text) return text;
    if (!member) return text; // For test previews

    const now = new Date();
    return text
      .replace(/{user}/g, member.toString())
      .replace(/{username}/g, member.user.username)
      .replace(/{tag}/g, member.user.tag)
      .replace(/{server}/g, member.guild.name)
      .replace(/{membercount}/g, member.guild.memberCount.toString())
      .replace(/{date}/g, now.toLocaleDateString('en-US'))
      .replace(/{time}/g, now.toLocaleTimeString('en-US'))
      .replace(/{timestamp}/g, Math.floor(now.getTime() / 1000).toString());
  }

  /**
   * Parse color string to number
   */
  parseColor(colorString) {
    if (!colorString) return 0x5865F2;
    if (typeof colorString === 'number') return colorString;
    
    // Remove # if present
    const hex = colorString.replace('#', '');
    return parseInt(hex, 16);
  }

  /**
   * Get account age as human-readable string
   */
  getAccountAge(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) return 'Less than a day';
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years !== 1 ? 's' : ''}`;
  }

  /**
   * Build button rows from config
   */
  buildButtonRows(buttons, member) {
    const rows = [];
    // For link buttons, only Primary and Secondary are valid
    // Success and Danger are only for interaction buttons
    const buttonStyleMap = {
      'primary': ButtonStyle.Primary,
      'secondary': ButtonStyle.Secondary,
      'success': ButtonStyle.Primary, // Link buttons don't support Success, use Primary
      'danger': ButtonStyle.Secondary // Link buttons don't support Danger, use Secondary
    };

    // Discord allows max 5 buttons per row, max 5 rows
    for (let i = 0; i < Math.min(buttons.length, 25); i += 5) {
      const row = new ActionRowBuilder();
      const rowButtons = buttons.slice(i, i + 5);
      
      rowButtons.forEach(button => {
        const buttonBuilder = new ButtonBuilder()
          .setLabel(this.parseVariables(button.label, member))
          .setURL(this.parseVariables(button.url, member))
          .setStyle(buttonStyleMap[button.style] || ButtonStyle.Primary);
        
        if (button.emoji) {
          buttonBuilder.setEmoji(button.emoji);
        }
        
        row.addComponents(buttonBuilder);
      });
      
      rows.push(row);
    }
    
    return rows;
  }

  /**
   * Test welcome message (for dashboard)
   */
  async testWelcomeMessage(guildId, memberId) {
    try {
      const config = await this.supabase
        .from('welcome_configs')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (!config.data) {
        return { success: false, error: 'Config not found' };
      }

      // This would be called from dashboard with sample data
      return { 
        success: true, 
        preview: {
          message: this.parseVariables(config.data.welcome_message || 'Welkom {user}!', null),
          embedTitle: config.data.welcome_embed_title,
          embedDescription: config.data.welcome_embed_description
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WelcomeHandler();

