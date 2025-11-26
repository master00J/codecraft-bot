/**
 * ComCraft Auto-Roles Manager
 * Self-assignable roles via buttons, reactions, or dropdowns
 */

const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const configManager = require('../config-manager');
const FeatureGate = require('../feature-gate');

const AUTO_ROLES_FEATURE = 'auto_roles';

class AutoRolesManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.featureGate = new FeatureGate(configManager);
  }

  /**
   * Post or update a role menu in Discord
   */
  async postRoleMenu(menuId) {
    try {
      console.log(`📝 Posting role menu ${menuId}...`);
      return await this._postOrUpdateMenu(menuId);
    } catch (error) {
      console.error('Error posting role menu:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update existing role menu in Discord
   */
  async updateRoleMenu(menuId) {
    try {
      console.log(`✏️  Updating role menu ${menuId}...`);
      return await this._postOrUpdateMenu(menuId);
    } catch (error) {
      console.error('Error updating role menu:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Internal method to post or update a role menu
   */
  async _postOrUpdateMenu(menuId) {
    try {

      // Fetch menu with options
      const { data: menu, error: menuError } = await this.supabase
        .from('role_menus')
        .select(`
          *,
          options:role_menu_options(*)
        `)
        .eq('id', menuId)
        .single();

      if (menuError || !menu) {
        console.error('Error fetching menu:', menuError);
        return { success: false, error: 'Menu not found' };
      }

      const guild = this.client.guilds.cache.get(menu.guild_id);
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const hasFeature = await this.featureGate.checkFeature(menu.guild_id, AUTO_ROLES_FEATURE);
      if (!hasFeature) {
        console.warn(`Auto-roles feature disabled for guild ${menu.guild_id}; skipping menu post.`);
        return { success: false, error: 'Auto-roles feature disabled for this guild' };
      }

      const channel = guild.channels.cache.get(menu.channel_id);
      if (!channel) {
        return { success: false, error: 'Channel not found' };
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(menu.embed_color || '#5865F2')
        .setTitle(menu.embed_title || 'Select Your Roles')
        .setDescription(menu.embed_description || 'Click the buttons below to assign yourself roles:')
        .setTimestamp();

      // Add role options to embed
      if (menu.options && menu.options.length > 0) {
        const rolesText = menu.options
          .sort((a, b) => a.position - b.position)
          .map(opt => {
            const emoji = opt.button_emoji || '•';
            return `${emoji} **${opt.role_name}**${opt.description ? ` - ${opt.description}` : ''}`;
          })
          .join('\n');
        
        embed.addFields({ 
          name: '📋 Beschikbare Roles', 
          value: rolesText 
        });
      }

      if (menu.max_roles > 0) {
        embed.setFooter({ 
          text: `Je kunt maximaal ${menu.max_roles} role${menu.max_roles !== 1 ? 's' : ''} selecteren` 
        });
      }

      // Build components based on menu type
      const components = [];

      if (menu.menu_type === 'buttons' && menu.options.length > 0) {
        // Button rows (max 5 buttons per row, max 5 rows)
        const sortedOptions = menu.options.sort((a, b) => a.position - b.position);
        
        for (let i = 0; i < sortedOptions.length; i += 5) {
          const row = new ActionRowBuilder();
          const buttonsInRow = sortedOptions.slice(i, i + 5);
          
          for (const option of buttonsInRow) {
            // Check if this is a verify button (special type)
            const isVerifyButton = option.is_verify_button === true;
            
            const button = new ButtonBuilder()
              .setCustomId(isVerifyButton ? `verify_${menu.id}` : `role_${menu.id}_${option.role_id}`)
              .setLabel(option.button_label || option.role_name || (isVerifyButton ? 'Verify' : 'Role'))
              .setStyle(this.getButtonStyle(option.button_style));
            
            if (option.button_emoji) {
              // Check if emoji is custom or unicode
              if (option.button_emoji.match(/^<:[a-zA-Z0-9_]+:[0-9]+>$/)) {
                // Custom emoji
                const emojiMatch = option.button_emoji.match(/^<:[a-zA-Z0-9_]+:([0-9]+)>$/);
                if (emojiMatch) {
                  button.setEmoji(emojiMatch[1]);
                }
              } else {
                // Unicode emoji
                button.setEmoji(option.button_emoji);
              }
            }
            
            row.addComponents(button);
          }
          
          components.push(row);
        }
      } else if (menu.menu_type === 'dropdown' && menu.options.length > 0) {
        // Dropdown select menu
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`role_menu_${menu.id}`)
          .setPlaceholder('Select your roles...')
          .setMinValues(0)
          .setMaxValues(menu.max_roles > 0 ? Math.min(menu.max_roles, menu.options.length) : menu.options.length);

        for (const option of menu.options.sort((a, b) => a.position - b.position)) {
          const selectOption = new StringSelectMenuOptionBuilder()
            .setLabel(option.role_name)
            .setValue(option.role_id);
          
          if (option.description) {
            selectOption.setDescription(option.description.substring(0, 100));
          }
          
          if (option.button_emoji) {
            selectOption.setEmoji(option.button_emoji);
          }
          
          selectMenu.addOptions(selectOption);
        }

        const row = new ActionRowBuilder().addComponents(selectMenu);
        components.push(row);
      }

      // Post or update message
      let message;
      if (menu.message_id) {
        // Try to edit existing message
        try {
          message = await channel.messages.fetch(menu.message_id);
          await message.edit({ embeds: [embed], components });
          console.log(`   ✅ Updated existing role menu message`);
        } catch (err) {
          // Message not found, create new one
          message = await channel.send({ embeds: [embed], components });
          console.log(`   ✅ Posted new role menu message (old one not found)`);
        }
      } else {
        // Create new message
        message = await channel.send({ embeds: [embed], components });
        console.log(`   ✅ Posted new role menu message`);
      }

      // Save message ID if new
      if (!menu.message_id || menu.message_id !== message.id) {
        await this.supabase
          .from('role_menus')
          .update({ message_id: message.id })
          .eq('id', menuId);
      }

      // If reaction roles, add reactions
      if (menu.menu_type === 'reactions' && menu.options.length > 0) {
        for (const option of menu.options.sort((a, b) => a.position - b.position)) {
          if (option.button_emoji) {
            try {
              await message.react(option.button_emoji);
            } catch (err) {
              console.error(`   ⚠️  Could not add reaction ${option.button_emoji}:`, err.message);
            }
          }
        }
        console.log(`   ✅ Added ${menu.options.length} reaction emojis`);
      }

      return { success: true, messageId: message.id };
    } catch (error) {
      console.error('Error in _postOrUpdateMenu:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle button interaction
   */
  async handleButtonInteraction(interaction) {
    const licenseActive = await this.featureGate.checkLicense(interaction.guildId);

    if (!licenseActive) {
      const embed = this.featureGate.createLicenseDisabledEmbed();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const hasFeature = await this.featureGate.checkFeature(interaction.guildId, AUTO_ROLES_FEATURE);

    if (!hasFeature) {
      const embed = this.featureGate.createUpgradeEmbed('Auto roles', 'Basic');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    try {
      const customId = interaction.customId;
      
      // Check if this is a verify button
      if (customId.startsWith('verify_')) {
        const menuId = customId.replace('verify_', '');
        
        // Get menu to verify it exists and is active
        const { data: menu } = await this.supabase
          .from('role_menus')
          .select('*')
          .eq('id', menuId)
          .single();

        if (!menu || !menu.is_active) {
          return interaction.reply({ 
            content: '❌ This role menu is no longer active.',
            ephemeral: true
          });
        }

        // Handle verification - remove unverified role
        const welcomeHandler = require('../welcome/handler');
        const result = await welcomeHandler.removeUnverifiedRole(interaction.member);

        if (!result.success) {
          return interaction.reply({
            content: result.error || '❌ An error occurred while removing the unverified role.',
            ephemeral: true
          });
        }

        if (result.removed) {
          return interaction.reply({
            content: `✅ You are now verified! The ${result.roleName || 'unverified'} role has been removed.`,
            ephemeral: true
          });
        } else {
          return interaction.reply({
            content: 'ℹ️ You don\'t have the unverified role, or it\'s not configured for this server.',
            ephemeral: true
          });
        }
      }
      
      if (!customId.startsWith('role_')) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const [_, menuId, roleId] = customId.split('_');

      // Get menu config
      const { data: menu } = await this.supabase
        .from('role_menus')
        .select('*')
        .eq('id', menuId)
        .single();

      if (!menu || !menu.is_active) {
        return await interaction.editReply({ 
          content: '❌ This role menu is no longer active.' 
        });
      }

      // Check required role
      if (menu.required_role_id) {
        if (!interaction.member.roles.cache.has(menu.required_role_id)) {
          return await interaction.editReply({ 
            content: '❌ You don\'t have the required role to use this.' 
          });
        }
      }

      // Get all options for this menu
      const { data: allOptions } = await this.supabase
        .from('role_menu_options')
        .select('*')
        .eq('menu_id', menuId);

      const targetOption = allOptions.find(opt => opt.role_id === roleId);
      if (!targetOption) {
        return await interaction.editReply({ content: '❌ Role not found' });
      }

      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) {
        return await interaction.editReply({ content: '❌ Role no longer exists' });
      }

      const hasRole = interaction.member.roles.cache.has(roleId);

      if (hasRole) {
        // Remove role
        await interaction.member.roles.remove(role);
        
        // Log
        await this.logRoleAssignment(
          interaction.guild.id,
          interaction.user.id,
          interaction.user.username,
          menuId,
          roleId,
          role.name,
          'removed',
          interaction.channel.id
        );

        // Update stats
        await this.supabase
          .from('role_menu_options')
          .update({ total_assigns: (targetOption.total_assigns || 0) - 1 })
          .eq('id', targetOption.id);

        await interaction.editReply({ 
          content: `✅ Role **${role.name}** removed!` 
        });
      } else {
        // Check max roles limit
        if (menu.max_roles > 0) {
          const menuRoleIds = allOptions.map(opt => opt.role_id);
          const userMenuRoles = interaction.member.roles.cache.filter(r => menuRoleIds.includes(r.id));
          
          if (userMenuRoles.size >= menu.max_roles) {
            // Remove all menu roles if single-choice
            if (menu.max_roles === 1) {
              await interaction.member.roles.remove(userMenuRoles);
            } else {
              return await interaction.editReply({ 
                content: `❌ You already have the maximum number of roles (${menu.max_roles}) from this menu!` 
              });
            }
          }
        }

        // Add role
        await interaction.member.roles.add(role);
        
        // Log
        await this.logRoleAssignment(
          interaction.guild.id,
          interaction.user.id,
          interaction.user.username,
          menuId,
          roleId,
          role.name,
          'assigned',
          interaction.channel.id
        );

        // Update stats
        await this.supabase
          .from('role_menu_options')
          .update({ total_assigns: (targetOption.total_assigns || 0) + 1 })
          .eq('id', targetOption.id);

        await this.supabase
          .from('role_menus')
          .update({ total_uses: (menu.total_uses || 0) + 1 })
          .eq('id', menuId);

        await interaction.editReply({ 
          content: `✅ Role **${role.name}** assigned!` 
        });
      }
    } catch (error) {
      console.error('Error handling button interaction:', error);
      await interaction.editReply({ content: '❌ Something went wrong' }).catch(() => {});
    }
  }

  /**
   * Handle dropdown/select menu interaction
   */
  async handleSelectMenuInteraction(interaction) {
    const licenseActive = await this.featureGate.checkLicense(interaction.guildId);

    if (!licenseActive) {
      const embed = this.featureGate.createLicenseDisabledEmbed();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const hasFeature = await this.featureGate.checkFeature(interaction.guildId, AUTO_ROLES_FEATURE);

    if (!hasFeature) {
      const embed = this.featureGate.createUpgradeEmbed('Auto roles', 'Basic');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    try {
      const customId = interaction.customId;
      
      if (!customId.startsWith('role_menu_')) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const menuId = customId.replace('role_menu_', '');
      const selectedRoleIds = interaction.values;

      // Get menu config
      const { data: menu } = await this.supabase
        .from('role_menus')
        .select('*')
        .eq('id', menuId)
        .single();

      if (!menu || !menu.is_active) {
        return await interaction.editReply({ content: '❌ This role menu is no longer active.' });
      }

      // Get all options
      const { data: allOptions } = await this.supabase
        .from('role_menu_options')
        .select('*')
        .eq('menu_id', menuId);

      const menuRoleIds = allOptions.map(opt => opt.role_id);

      // Remove all menu roles first
      const currentMenuRoles = interaction.member.roles.cache.filter(r => menuRoleIds.includes(r.id));
      if (currentMenuRoles.size > 0) {
        await interaction.member.roles.remove(currentMenuRoles);
      }

      // Add selected roles
      const addedRoles = [];
      for (const roleId of selectedRoleIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          await interaction.member.roles.add(role);
          addedRoles.push(role.name);
          
          const option = allOptions.find(opt => opt.role_id === roleId);
          if (option) {
            await this.supabase
              .from('role_menu_options')
              .update({ total_assigns: (option.total_assigns || 0) + 1 })
              .eq('id', option.id);
          }
        }
      }

      if (addedRoles.length > 0) {
        await interaction.editReply({ 
          content: `✅ Roles assigned: **${addedRoles.join(', ')}**` 
        });
      } else {
        await interaction.editReply({ 
          content: `✅ All roles removed!` 
        });
      }
    } catch (error) {
      console.error('Error handling select menu interaction:', error);
      await interaction.editReply({ content: '❌ Something went wrong' }).catch(() => {});
    }
  }

  /**
   * Handle reaction add/remove
   */
  async handleReaction(reaction, user, action) {
    try {
      if (user.bot) return;
      
      const licenseActive = await this.featureGate.checkLicense(reaction.message.guildId);

      if (!licenseActive) {
        return;
      }

      const hasFeature = await this.featureGate.checkFeature(reaction.message.guildId, AUTO_ROLES_FEATURE);

      if (!hasFeature) {
        return;
      }
      
      const guild = reaction.message.guild;
      if (!guild) return;

      // Find menu by message ID
      const { data: menu } = await this.supabase
        .from('role_menus')
        .select(`
          *,
          options:role_menu_options(*)
        `)
        .eq('message_id', reaction.message.id)
        .eq('menu_type', 'reactions')
        .eq('is_active', true)
        .single();

      if (!menu) return;

      // Find matching role by emoji
      const emojiString = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
      const option = menu.options.find(opt => opt.button_emoji === emojiString || opt.button_emoji === reaction.emoji.name);

      if (!option) return;

      const member = await guild.members.fetch(user.id);
      const role = guild.roles.cache.get(option.role_id);

      if (!role) return;

      if (action === 'add') {
        await member.roles.add(role);
        console.log(`✅ Auto-role: Gave ${role.name} to ${user.username}`);
        
        await this.logRoleAssignment(
          guild.id, user.id, user.username, menu.id, role.id, role.name, 'assigned', reaction.message.channel.id
        );
      } else {
        await member.roles.remove(role);
        console.log(`✅ Auto-role: Removed ${role.name} from ${user.username}`);
        
        await this.logRoleAssignment(
          guild.id, user.id, user.username, menu.id, role.id, role.name, 'removed', reaction.message.channel.id
        );
      }
    } catch (error) {
      console.error('Error handling reaction role:', error);
    }
  }

  /**
   * Log role assignment
   */
  async logRoleAssignment(guildId, userId, username, menuId, roleId, roleName, action, channelId) {
    await this.supabase
      .from('role_assignments_log')
      .insert({
        guild_id: guildId,
        user_id: userId,
        username: username,
        menu_id: menuId,
        role_id: roleId,
        role_name: roleName,
        action: action,
        channel_id: channelId
      });
  }

  /**
   * Get button style enum
   */
  getButtonStyle(styleString) {
    const styles = {
      'primary': ButtonStyle.Primary,
      'secondary': ButtonStyle.Secondary,
      'success': ButtonStyle.Success,
      'danger': ButtonStyle.Danger
    };
    return styles[styleString] || ButtonStyle.Primary;
  }

  /**
   * Get all role menus for a guild
   */
  async getGuildMenus(guildId) {
    const { data, error } = await this.supabase
      .from('role_menus')
      .select(`
        *,
        options:role_menu_options(*)
      `)
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching role menus:', error);
      return [];
    }

    return data || [];
  }
}

module.exports = AutoRolesManager;

