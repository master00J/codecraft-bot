/**
 * User Stats Manager
 * Tracks and manages user statistics for stats cards
 */

const { createClient } = require('@supabase/supabase-js');

class UserStatsManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Track active voice sessions in memory
    this.activeVoiceSessions = new Map(); // key: guildId:userId, value: { sessionId, joinedAt, channelId }
  }

  /**
   * Initialize or update user stats record
   */
  async initializeUserStats(guildId, userId, serverJoinedAt = null) {
    const { data: existing } = await this.supabase
      .from('user_stats')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Update server joined date if provided and not set
      if (serverJoinedAt && !existing.server_joined_at) {
        await this.supabase
          .from('user_stats')
          .update({ server_joined_at: serverJoinedAt })
          .eq('id', existing.id);
      }
      return existing;
    }

    // Create new record
    const { data: newRecord, error } = await this.supabase
      .from('user_stats')
      .insert({
        guild_id: guildId,
        user_id: userId,
        server_joined_at: serverJoinedAt || new Date().toISOString(),
        first_seen_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[UserStats] Error initializing user stats:', error);
      return null;
    }

    return newRecord;
  }

  /**
   * Track a message
   */
  async trackMessage(guildId, userId, channelId, channelName) {
    // Initialize stats if needed
    await this.initializeUserStats(guildId, userId);

    // Update total messages
    try {
      const { error } = await this.supabase.rpc('increment_user_stats_messages', {
        p_guild_id: guildId,
        p_user_id: userId
      });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      // Fallback if RPC doesn't exist
      const { data: existing } = await this.supabase
        .from('user_stats')
        .select('total_messages')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .single();

      await this.supabase
        .from('user_stats')
        .update({
          total_messages: (existing?.total_messages || 0) + 1,
          last_message_at: new Date().toISOString()
        })
        .eq('guild_id', guildId)
        .eq('user_id', userId);
    }

    // Update channel stats
    await this.updateChannelStats(guildId, userId, channelId, channelName, 'text');
  }

  /**
   * Track voice join
   */
  async trackVoiceJoin(guildId, userId, channelId, channelName) {
    // Initialize stats if needed
    await this.initializeUserStats(guildId, userId);

    const sessionKey = `${guildId}:${userId}`;
    
    // If user already has an active session, end it first
    if (this.activeVoiceSessions.has(sessionKey)) {
      await this.trackVoiceLeave(guildId, userId);
    }

    // Create new voice session
    const { data: session, error } = await this.supabase
      .from('voice_sessions')
      .insert({
        guild_id: guildId,
        user_id: userId,
        channel_id: channelId,
        channel_name: channelName,
        joined_at: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('[UserStats] Error creating voice session:', error);
      return null;
    }

    // Store in memory for quick access
    this.activeVoiceSessions.set(sessionKey, {
      sessionId: session.id,
      joinedAt: new Date(),
      channelId: channelId
    });

    // Update last voice activity
    await this.supabase
      .from('user_stats')
      .update({ last_voice_at: new Date().toISOString() })
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    return session;
  }

  /**
   * Track voice leave
   */
  async trackVoiceLeave(guildId, userId) {
    const sessionKey = `${guildId}:${userId}`;
    const activeSession = this.activeVoiceSessions.get(sessionKey);

    if (!activeSession) {
      return null;
    }

    const now = new Date();
    const durationSeconds = Math.floor((now - activeSession.joinedAt) / 1000);

    // Update session in database
    await this.supabase
      .from('voice_sessions')
      .update({
        left_at: now.toISOString(),
        duration_seconds: durationSeconds,
        is_active: false
      })
      .eq('id', activeSession.sessionId);

    // Update total voice seconds
    const { data: existing } = await this.supabase
      .from('user_stats')
      .select('total_voice_seconds')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    await this.supabase
      .from('user_stats')
      .update({
        total_voice_seconds: (existing?.total_voice_seconds || 0) + durationSeconds
      })
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    // Update channel voice stats
    if (activeSession.channelId) {
      await this.updateChannelStats(guildId, userId, activeSession.channelId, null, 'voice', durationSeconds);
    }

    // Remove from memory
    this.activeVoiceSessions.delete(sessionKey);

    return { durationSeconds };
  }

  /**
   * Update channel stats
   */
  async updateChannelStats(guildId, userId, channelId, channelName, channelType, voiceSeconds = 0) {
    const { data: existing } = await this.supabase
      .from('user_channel_stats')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('channel_id', channelId)
      .single();

    const updates = {
      guild_id: guildId,
      user_id: userId,
      channel_id: channelId,
      channel_type: channelType,
      last_activity_at: new Date().toISOString()
    };

    if (channelName) {
      updates.channel_name = channelName;
    }

    if (channelType === 'text') {
      updates.message_count = (existing?.message_count || 0) + 1;
    } else if (channelType === 'voice') {
      updates.voice_seconds = (existing?.voice_seconds || 0) + voiceSeconds;
    }

    await this.supabase
      .from('user_channel_stats')
      .upsert(updates, {
        onConflict: 'guild_id,user_id,channel_id'
      });
  }

  /**
   * Get user stats with ranks
   */
  async getUserStats(guildId, userId) {
    // Get base stats
    const { data: stats } = await this.supabase
      .from('user_stats')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (!stats) {
      await this.initializeUserStats(guildId, userId);
      // Retry fetch
      const { data: retryStats } = await this.supabase
        .from('user_stats')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .single();
      if (!retryStats) return null;
      return await this.enrichStats(guildId, userId, retryStats);
    }

    return await this.enrichStats(guildId, userId, stats);
  }

  /**
   * Enrich stats with ranks and period data
   */
  async enrichStats(guildId, userId, baseStats) {
    // Get message rank
    let messageRank = null;
    try {
      const { data, error } = await this.supabase.rpc('get_user_message_rank', {
        p_guild_id: guildId,
        p_user_id: userId
      });
      
      if (error || data === null || data === undefined) {
        throw new Error('RPC failed');
      }
      
      messageRank = data;
    } catch (error) {
      // Fallback: manual calculation
      const { data: allStats } = await this.supabase
        .from('user_stats')
        .select('user_id, total_messages')
        .eq('guild_id', guildId)
        .order('total_messages', { ascending: false });

      if (allStats && allStats.length > 0) {
        const rank = allStats.findIndex(s => s.user_id === userId) + 1;
        messageRank = rank > 0 ? rank : null;
      }
    }

    // Get voice rank
    let voiceRank = null;
    try {
      const { data, error } = await this.supabase.rpc('get_user_voice_rank', {
        p_guild_id: guildId,
        p_user_id: userId
      });
      
      if (error || data === null || data === undefined) {
        throw new Error('RPC failed');
      }
      
      voiceRank = data;
    } catch (error) {
      // Fallback: manual calculation
      const { data: allStats } = await this.supabase
        .from('user_stats')
        .select('user_id, total_voice_seconds')
        .eq('guild_id', guildId)
        .order('total_voice_seconds', { ascending: false });

      if (allStats && allStats.length > 0) {
        const rank = allStats.findIndex(s => s.user_id === userId) + 1;
        voiceRank = rank > 0 ? rank : null;
      }
    }

    // Get period stats
    const periods = await this.getPeriodStats(guildId, userId);

    // Get top channels
    const topChannels = await this.getTopChannels(guildId, userId, 5);

    return {
      ...baseStats,
      messageRank,
      voiceRank,
      periods,
      topChannels
    };
  }

  /**
   * Get stats for different time periods
   */
  async getPeriodStats(guildId, userId) {
    const now = new Date();
    
    const periods = {
      '1d': { days: 1 },
      '7d': { days: 7 },
      '14d': { days: 14 },
      '30d': { days: 30 }
    };

    const result = {};

    for (const [key, { days }] of Object.entries(periods)) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);

      // Get messages in period
      const { data: messagesData } = await this.supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: false })
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('event_type', 'message')
        .gte('created_at', startDate.toISOString());

      // Get voice time in period
      const { data: voiceData } = await this.supabase
        .from('voice_sessions')
        .select('duration_seconds')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .gte('joined_at', startDate.toISOString());

      const messages = messagesData?.length || 0;
      const voiceSeconds = voiceData?.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) || 0;

      result[key] = {
        messages,
        voiceHours: voiceSeconds / 3600,
        voiceSeconds
      };
    }

    return result;
  }

  /**
   * Get top channels for user
   */
  async getTopChannels(guildId, userId, limit = 5) {
    const { data: channels } = await this.supabase
      .from('user_channel_stats')
      .select('channel_id, channel_name, channel_type, message_count, voice_seconds')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .order('message_count', { ascending: false })
      .limit(limit);

    return channels || [];
  }

  /**
   * Get stats configuration
   */
  async getStatsConfig(guildId) {
    const { data: config } = await this.supabase
      .from('stats_config')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    return config || {
      guild_id: guildId,
      card_border_color: '#5865F2',
      card_theme: 'dark',
      show_message_rank: true,
      show_voice_rank: true,
      show_top_channels: true,
      show_charts: true,
      show_1d: true,
      show_7d: true,
      show_14d: true,
      show_30d: false,
      lookback_days: 14,
      timezone: 'UTC',
      enabled: true
    };
  }

  /**
   * Format hours to readable string
   */
  formatHours(hours) {
    if (!hours || hours === 0) return '0.00 hours';
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes} minutes`;
    }
    return `${hours.toFixed(2)} hours`;
  }

  /**
   * Clean up stale voice sessions (called periodically)
   */
  async cleanupStaleSessions() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find active sessions older than 1 hour
    const { data: staleSessions } = await this.supabase
      .from('voice_sessions')
      .select('*')
      .eq('is_active', true)
      .lt('joined_at', oneHourAgo.toISOString());

    if (!staleSessions || staleSessions.length === 0) return;

    for (const session of staleSessions) {
      const now = new Date();
      const durationSeconds = Math.floor((now - new Date(session.joined_at)) / 1000);

      // End the session
      await this.supabase
        .from('voice_sessions')
        .update({
          left_at: now.toISOString(),
          duration_seconds: durationSeconds,
          is_active: false
        })
        .eq('id', session.id);

      // Update total voice seconds
      const { data: existing } = await this.supabase
        .from('user_stats')
        .select('total_voice_seconds')
        .eq('guild_id', session.guild_id)
        .eq('user_id', session.user_id)
        .single();

      await this.supabase
        .from('user_stats')
        .update({
          total_voice_seconds: (existing?.total_voice_seconds || 0) + durationSeconds
        })
        .eq('guild_id', session.guild_id)
        .eq('user_id', session.user_id);

      // Remove from memory
      const sessionKey = `${session.guild_id}:${session.user_id}`;
      this.activeVoiceSessions.delete(sessionKey);
    }

    console.log(`[UserStats] Cleaned up ${staleSessions.length} stale voice sessions`);
  }
}

// Singleton
const userStatsManager = new UserStatsManager();

// Cleanup stale sessions every 30 minutes
setInterval(() => {
  userStatsManager.cleanupStaleSessions().catch(err => {
    console.error('[UserStats] Error cleaning up stale sessions:', err);
  });
}, 30 * 60 * 1000);

module.exports = userStatsManager;

