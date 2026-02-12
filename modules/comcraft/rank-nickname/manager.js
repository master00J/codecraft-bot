/**
 * Rank Nickname Manager
 * When a member has a configured role, their server nickname is set to [PREFIX] (Username).
 * e.g. role "Cadet" with prefix "CDT" -> nickname "[CDT] (Jantje)"
 * Optional per guild: only guilds with rank_nickname_config rows use this feature.
 */

const { createClient } = require('@supabase/supabase-js');

const NICKNAME_MAX_LENGTH = 32;

class RankNicknameManager {
  constructor(client) {
    this.client = client;
    this.supabase = null;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    }
  }

  /**
   * Get all role->prefix mappings for a guild
   */
  async getConfig(guildId) {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('rank_nickname_config')
      .select('role_id, prefix')
      .eq('guild_id', guildId);

    if (error) {
      console.error('[RankNickname] Error fetching config:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Only run when roles actually changed (not on nickname-only updates)
   */
  rolesChanged(oldMember, newMember) {
    const oldIds = oldMember.roles.cache.map(r => r.id).sort().join(',');
    const newIds = newMember.roles.cache.map(r => r.id).sort().join(',');
    return oldIds !== newIds;
  }

  /**
   * Get the configured role with highest position that the member has
   */
  getHighestConfiguredRole(member, config) {
    const roleIds = new Set(config.map(c => c.role_id));
    const memberRoles = member.roles.cache
      .filter(r => roleIds.has(r.id))
      .sort((a, b) => b.position - a.position);
    const topRole = memberRoles.first();
    if (!topRole) return null;
    const entry = config.find(c => c.role_id === topRole.id);
    return entry ? { role: topRole, prefix: entry.prefix } : null;
  }

  /**
   * Build nickname with prefix, max 32 chars
   */
  buildNickname(prefix, displayName) {
    const raw = `[${prefix}] (${displayName || 'User'})`;
    if (raw.length <= NICKNAME_MAX_LENGTH) return raw;
    const maxInner = NICKNAME_MAX_LENGTH - prefix.length - 5; // "[XXX] ()"
    const inner = (displayName || 'User').slice(0, Math.max(0, maxInner));
    return `[${prefix}] (${inner})`;
  }

  /**
   * Handle member update (role or nickname change). Only act when roles changed and we have config.
   */
  async handleMemberUpdate(oldMember, newMember) {
    if (!this.supabase) return;
    if (newMember.user.bot) return;
    if (!this.rolesChanged(oldMember, newMember)) return;

    const guildId = newMember.guild.id;
    const config = await this.getConfig(guildId);
    if (config.length === 0) return;

    const guild = newMember.guild;
    if (!guild.members.me?.permissions.has('ManageNicknames')) return;

    const match = this.getHighestConfiguredRole(newMember, config);
    if (!match) return;

    const newNick = this.buildNickname(match.prefix, newMember.displayName);
    if (newMember.nickname === newNick) return;

    try {
      await newMember.setNickname(newNick, 'Rank nickname (role prefix)');
    } catch (err) {
      console.warn('[RankNickname] Could not set nickname:', err.message);
    }
  }
}

module.exports = RankNicknameManager;
