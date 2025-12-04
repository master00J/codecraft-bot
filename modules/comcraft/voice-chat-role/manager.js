/**
 * ComCraft Voice Chat Role Manager
 * Automatically assigns/removes a role when users join/leave voice channels
 */

const { createClient } = require('@supabase/supabase-js');
const configManager = require('../config-manager');

class VoiceChatRoleManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Get voice chat role configuration for a guild
   */
  async getConfig(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('voice_chat_role_config')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[VoiceChatRole] Error fetching config:', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('[VoiceChatRole] Error in getConfig:', error);
      return null;
    }
  }

  /**
   * Check if voice chat role is enabled for a guild
   */
  async isEnabled(guildId) {
    const config = await this.getConfig(guildId);
    return config?.enabled || false;
  }

  /**
   * Handle voice state update - assign/remove role
   */
  async handleVoiceStateUpdate(oldState, newState) {
    try {
      const guildId = newState.guild?.id || oldState.guild?.id;
      if (!guildId) return;

      const config = await this.getConfig(guildId);
      if (!config || !config.enabled || !config.role_id) {
        return;
      }

      const userId = newState.id || oldState.id;
      if (!userId) return;

      const guild = newState.guild || oldState.guild;
      if (!guild) return;

      const member = guild.members.cache.get(userId);
      if (!member || member.user.bot) return;

      const role = guild.roles.cache.get(config.role_id);
      if (!role) {
        console.warn(`[VoiceChatRole] Role ${config.role_id} not found in guild ${guildId}`);
        return;
      }

      // Check if bot can manage this role
      if (!role.editable || role.position >= guild.members.me.roles.highest.position) {
        console.warn(`[VoiceChatRole] Cannot manage role ${role.name} in guild ${guildId} - insufficient permissions`);
        return;
      }

      const wasInVoice = oldState.channelId !== null;
      const isInVoice = newState.channelId !== null;
      const hasRole = member.roles.cache.has(config.role_id);

      // User joined a voice channel
      if (!wasInVoice && isInVoice) {
        if (!hasRole) {
          try {
            await member.roles.add(role);
            console.log(`✅ [VoiceChatRole] Gave role ${role.name} to ${member.user.username} in ${guild.name}`);
          } catch (error) {
            console.error(`❌ [VoiceChatRole] Error giving role to ${member.user.username}:`, error.message);
          }
        }
      }
      // User left a voice channel
      else if (wasInVoice && !isInVoice) {
        if (hasRole) {
          try {
            await member.roles.remove(role);
            console.log(`✅ [VoiceChatRole] Removed role ${role.name} from ${member.user.username} in ${guild.name}`);
          } catch (error) {
            console.error(`❌ [VoiceChatRole] Error removing role from ${member.user.username}:`, error.message);
          }
        }
      }
      // User switched channels (already in voice, stays in voice)
      // No action needed - role should already be assigned
    } catch (error) {
      console.error('[VoiceChatRole] Error in handleVoiceStateUpdate:', error);
    }
  }

  /**
   * Set voice chat role configuration
   */
  async setConfig(guildId, enabled, roleId) {
    try {
      const { data, error } = await this.supabase
        .from('voice_chat_role_config')
        .upsert({
          guild_id: guildId,
          enabled: enabled,
          role_id: roleId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'guild_id'
        })
        .select()
        .single();

      if (error) {
        console.error('[VoiceChatRole] Error setting config:', error);
        return { success: false, error: error.message };
      }

      return { success: true, config: data };
    } catch (error) {
      console.error('[VoiceChatRole] Error in setConfig:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize roles for all users currently in voice channels
   * Called when the feature is enabled or the bot starts
   */
  async initializeVoiceRoles(guildId) {
    try {
      const config = await this.getConfig(guildId);
      if (!config || !config.enabled || !config.role_id) {
        return;
      }

      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return;

      const role = guild.roles.cache.get(config.role_id);
      if (!role) return;

      // Get all members currently in voice channels
      const membersInVoice = guild.members.cache.filter(member => 
        member.voice.channel && 
        !member.user.bot &&
        !member.voice.mute &&
        !member.voice.deaf &&
        !member.voice.selfMute &&
        !member.voice.selfDeaf
      );

      let assigned = 0;
      for (const member of membersInVoice.values()) {
        if (!member.roles.cache.has(config.role_id)) {
          try {
            await member.roles.add(role);
            assigned++;
          } catch (error) {
            console.error(`[VoiceChatRole] Error giving role to ${member.user.username}:`, error.message);
          }
        }
      }

      if (assigned > 0) {
        console.log(`✅ [VoiceChatRole] Initialized roles for ${assigned} members in ${guild.name}`);
      }
    } catch (error) {
      console.error('[VoiceChatRole] Error in initializeVoiceRoles:', error);
    }
  }
}

module.exports = VoiceChatRoleManager;

