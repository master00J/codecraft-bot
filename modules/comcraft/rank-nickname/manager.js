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
   * Strip existing [PREFIX] (name) so we never double-wrap. Returns base name for the parentheses.
   */
  getBaseDisplayName(displayName) {
    if (!displayName || typeof displayName !== 'string') return 'User';
    const s = displayName.trim();
    const match = s.match(/^\[[^\]]+\]\s*\((.+)\)\s*$/);
    if (match) return match[1].trim() || s;
    return s;
  }

  /**
   * Get the configured role with highest position that the member has
   */
  getHighestConfiguredRole(member, config) {
    const roleIds = new Set(config.map(c => String(c.role_id).trim()));
    const memberRoles = member.roles.cache
      .filter(r => roleIds.has(r.id))
      .sort((a, b) => b.position - a.position);
    const topRole = memberRoles.first();
    if (!topRole) return null;
    const entry = config.find(c => String(c.role_id).trim() === topRole.id);
    return entry ? { role: topRole, prefix: String(entry.prefix || '').trim() } : null;
  }

  /**
   * Build nickname with prefix, max 32 chars. Uses base name (no double [PREFIX] ( [PREFIX] (name) )).
   */
  buildNickname(prefix, displayName) {
    const base = this.getBaseDisplayName(displayName) || 'User';
    const safePrefix = (prefix || '').trim().slice(0, 10);
    const raw = `[${safePrefix}] (${base})`;
    if (raw.length <= NICKNAME_MAX_LENGTH) return raw;
    const maxInner = NICKNAME_MAX_LENGTH - safePrefix.length - 5; // "[X] ()"
    const inner = base.slice(0, Math.max(0, maxInner));
    return `[${safePrefix}] (${inner})`;
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

    if (!newMember.manageable) {
      console.warn('[RankNickname] Cannot change nickname: bot role is below this member\'s highest role. Move the bot role above the rank roles.');
      return;
    }

    const newNick = this.buildNickname(match.prefix, newMember.displayName);
    if (newMember.nickname === newNick) return;

    try {
      await newMember.setNickname(newNick, 'Rank nickname (role prefix)');
    } catch (err) {
      console.warn('[RankNickname] Could not set nickname:', err.message);
    }
  }

  /**
   * Sync nicknames for all members who have a configured role.
   * Use when users already had the role before the prefix was set, or to fix missed updates.
   */
  async syncGuild(guildId) {
    if (!this.supabase) return { synced: 0, error: 'Database not configured' };
    const config = await this.getConfig(guildId);
    if (config.length === 0) return { synced: 0 };

    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return { synced: 0, error: 'Guild not found. Is the bot in the server?' };
    if (!guild.members.me?.permissions.has('ManageNicknames')) {
      return { synced: 0, error: 'Bot needs "Manage Nicknames" permission in this server.' };
    }

    let synced = 0;
    try {
      await guild.members.fetch();
    } catch (err) {
      console.warn('[RankNickname] Sync fetch members failed:', err.message);
      return { synced: 0, error: err.message || 'Failed to fetch members' };
    }

    for (const [, member] of guild.members.cache) {
      if (member.user.bot) continue;
      const match = this.getHighestConfiguredRole(member, config);
      if (!match) continue;
      if (!member.manageable) {
        console.warn(`[RankNickname] Skip ${member.user.tag}: bot role below member's role (move bot higher).`);
        continue;
      }
      const newNick = this.buildNickname(match.prefix, member.displayName);
      if (member.nickname === newNick) continue;
      try {
        await member.setNickname(newNick, 'Rank nickname sync');
        synced++;
      } catch (err) {
        console.warn(`[RankNickname] Sync failed for ${member.user.tag}:`, err.message);
      }
    }

    return { synced };
  }
}

module.exports = RankNicknameManager;
