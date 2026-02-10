/**
 * Inactive Kick Scheduler
 * Automatically kicks members who have been inactive for a configurable number of days.
 * Server owners enable this and set the inactivity threshold via the dashboard.
 */

const { createClient } = require('@supabase/supabase-js');

const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MIN_DAYS = 7;
const MAX_DAYS = 365;

class InactiveKickScheduler {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    this.interval = null;
    this.isRunning = false;
  }

  /**
   * Start the scheduler
   */
  start() {
    this.runOnce().catch((err) => {
      console.error('❌ [InactiveKick] Error in initial run:', err);
    });
    this.interval = setInterval(() => {
      this.runOnce().catch((err) => {
        console.error('❌ [InactiveKick] Error in scheduled run:', err);
      });
    }, RUN_INTERVAL_MS);
    console.log('✅ [InactiveKick] Scheduler started (runs every 6 hours)');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('🛑 [InactiveKick] Scheduler stopped');
  }

  /**
   * Run one pass: find guilds with auto-kick enabled and kick inactive members
   */
  async runOnce() {
    if (this.isRunning || !this.client?.guilds) {
      return;
    }
    this.isRunning = true;

    try {
      const { data: guildConfigs, error } = await this.supabase
        .from('guild_configs')
        .select('guild_id, auto_kick_inactive_days, auto_kick_effective_from')
        .eq('auto_kick_inactive_enabled', true)
        .not('auto_kick_inactive_days', 'is', null);

      if (error) {
        console.error('❌ [InactiveKick] Failed to fetch guild configs:', error);
        return;
      }

      if (!guildConfigs?.length) {
        this.isRunning = false;
        return;
      }

      const now = Date.now();
      for (const row of guildConfigs) {
        const days = parseInt(row.auto_kick_inactive_days, 10);
        if (days < MIN_DAYS || days > MAX_DAYS) continue;

        const effectiveFrom = row.auto_kick_effective_from ? new Date(row.auto_kick_effective_from).getTime() : null;
        if (effectiveFrom != null && now < effectiveFrom) continue;

        await this.processGuild(row.guild_id, days);
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single guild: fetch members, determine last activity, kick if inactive
   */
  async processGuild(guildId, inactiveDays) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    const me = guild.members.me;
    if (!me?.permissions.has('KickMembers')) {
      return;
    }

    const cutoffMs = inactiveDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - cutoffMs);

    let lastActivityByUser = {};
    const { data: userLevels } = await this.supabase
      .from('user_levels')
      .select('user_id, last_xp_gain')
      .eq('guild_id', guildId);

    if (userLevels?.length) {
      for (const row of userLevels) {
        const t = row.last_xp_gain ? new Date(row.last_xp_gain).getTime() : 0;
        lastActivityByUser[row.user_id] = t;
      }
    }

    let kicked = 0;
    let errors = 0;

    try {
      await guild.members.fetch({ force: false });
    } catch (e) {
      console.error(`❌ [InactiveKick] Failed to fetch members for ${guild.name} (${guildId}):`, e.message);
      return;
    }

    for (const [, member] of guild.members.cache) {
      if (member.user.bot) continue;
      if (member.id === guild.ownerId) continue;
      if (!member.kickable) continue;

      // Last activity = last message (user_levels) or join date if never sent a message (new members get full grace period)
      const lastActivityMs = lastActivityByUser[member.id] ?? (member.joinedAt ? member.joinedAt.getTime() : 0);
      const lastActivity = new Date(lastActivityMs);
      if (lastActivity >= cutoffDate) continue; // Skip: active recently (or joined recently)

      try {
        await member.kick(`Auto-kick: inactive for more than ${inactiveDays} days.`);
        kicked++;
        await this.logKick(guildId, member.id, member.user.username || member.user.tag, inactiveDays);
      } catch (e) {
        errors++;
        if (errors <= 3) {
          console.warn(`⚠️ [InactiveKick] Could not kick ${member.user.tag} in ${guild.name}:`, e.message);
        }
      }
    }

    if (kicked > 0 || errors > 0) {
      console.log(`✅ [InactiveKick] ${guild.name} (${guildId}): kicked ${kicked}, errors ${errors}`);
    }
  }

  /**
   * Log a kick to the database for dashboard display
   */
  async logKick(guildId, userId, username, inactiveDays) {
    try {
      await this.supabase.from('inactive_kick_logs').insert({
        guild_id: guildId,
        user_id: userId,
        username: username || null,
        inactive_days: inactiveDays
      });
    } catch (e) {
      console.warn(`⚠️ [InactiveKick] Failed to log kick for ${userId}:`, e.message);
    }
  }
}

module.exports = InactiveKickScheduler;
