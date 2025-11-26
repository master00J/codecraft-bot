/**
 * ComCraft Analytics Tracker
 * Tracks all events for comprehensive guild analytics
 */

const { createClient } = require('@supabase/supabase-js');

class AnalyticsTracker {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.eventQueue = [];
    this.flushInterval = 10000; // Flush every 10 seconds
    
    // Start background flush
    setInterval(() => this.flushQueue(), this.flushInterval);
  }

  /**
   * Track an event (queued for batch insert)
   */
  async trackEvent(eventType, guildId, userId, username, channelId = null, channelName = null, metadata = {}) {
    const now = new Date();
    
    this.eventQueue.push({
      event_type: eventType,
      guild_id: guildId,
      user_id: userId,
      username: username,
      channel_id: channelId,
      channel_name: channelName,
      metadata: metadata,
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
      event_date: now.toISOString().split('T')[0],
      created_at: now.toISOString()
    });

    // Flush immediately if queue is large
    if (this.eventQueue.length >= 100) {
      await this.flushQueue();
    }
  }

  /**
   * Flush event queue to database
   */
  async flushQueue() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const { error } = await this.supabase
        .from('analytics_events')
        .insert(events);

      if (error) {
        console.error('Error flushing analytics events:', error);
        // Re-add to queue on error
        this.eventQueue = [...events, ...this.eventQueue];
      } else {
        console.log(`📊 [Analytics] Flushed ${events.length} events to database`);
      }
    } catch (err) {
      console.error('Error in analytics flush:', err);
    }
  }

  // ================================================================
  // CONVENIENCE METHODS
  // ================================================================

  /**
   * Track message sent
   */
  async trackMessage(message) {
    await this.trackEvent(
      'message',
      message.guild.id,
      message.author.id,
      message.author.username,
      message.channel.id,
      message.channel.name,
      {
        content_length: message.content.length,
        has_attachments: message.attachments.size > 0,
        has_embeds: message.embeds.length > 0
      }
    );

    // Update daily stats
    await this.incrementDailyStat(message.guild.id, 'total_messages', 1);
    
    // Update user activity summary
    await this.updateUserActivity(message.guild.id, message.author.id, 'message');
    
    // Update hourly activity
    await this.updateHourlyActivity(message.guild.id, message.author.id);
    
    // Update channel stats
    await this.updateChannelStats(message.guild.id, message.channel.id, message.channel.name);
  }

  /**
   * Track member join
   */
  async trackMemberJoin(member) {
    await this.trackEvent(
      'join',
      member.guild.id,
      member.user.id,
      member.user.username,
      null,
      null,
      {
        account_age_days: Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24))
      }
    );

    // Create retention tracking record
    await this.supabase
      .from('member_retention')
      .upsert({
        guild_id: member.guild.id,
        user_id: member.user.id,
        joined_at: member.joinedAt || new Date().toISOString(),
        still_in_guild: true
      }, {
        onConflict: 'guild_id,user_id'
      });

    // Update daily stats
    await this.incrementDailyStat(member.guild.id, 'new_joins', 1);
    await this.incrementDailyStat(member.guild.id, 'net_growth', 1);
  }

  /**
   * Track member leave
   */
  async trackMemberLeave(member) {
    await this.trackEvent(
      'leave',
      member.guild.id,
      member.user.id,
      member.user.username,
      null,
      null,
      {
        days_in_guild: member.joinedTimestamp 
          ? Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24))
          : 0
      }
    );

    // Update retention record
    await this.supabase
      .from('member_retention')
      .update({
        still_in_guild: false,
        left_at: new Date().toISOString()
      })
      .eq('guild_id', member.guild.id)
      .eq('user_id', member.user.id);

    // Update daily stats
    await this.incrementDailyStat(member.guild.id, 'leaves', 1);
    await this.incrementDailyStat(member.guild.id, 'net_growth', -1);
  }

  /**
   * Track command usage
   */
  async trackCommand(interaction, commandName) {
    await this.trackEvent(
      'command',
      interaction.guild.id,
      interaction.user.id,
      interaction.user.username,
      interaction.channel?.id,
      interaction.channel?.name,
      {
        command: commandName
      }
    );

    // Update daily stats
    await this.incrementDailyStat(interaction.guild.id, 'total_commands', 1);

    await this.updateUserActivity(interaction.guild.id, interaction.user.id, 'command');
  }

  /**
   * Track reaction
   */
  async trackReaction(reaction, user) {
    if (!reaction.message.guild) return;

    await this.trackEvent(
      'reaction',
      reaction.message.guild.id,
      user.id,
      user.username,
      reaction.message.channel.id,
      reaction.message.channel.name,
      {
        emoji: reaction.emoji.name
      }
    );

    // Update daily stats
    await this.incrementDailyStat(reaction.message.guild.id, 'total_reactions', 1);

    await this.updateUserActivity(reaction.message.guild.id, user.id, 'reaction');
  }

  // ================================================================
  // AGGREGATION HELPERS
  // ================================================================

  /**
   * Update user activity summary
   */
  async updateUserActivity(guildId, userId, activityType) {
    const today = new Date().toISOString().split('T')[0];
    
    // Get existing record
    const { data: existing } = await this.supabase
      .from('user_activity_summary')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    const updates = {
      guild_id: guildId,
      user_id: userId,
      date: today,
      last_activity_at: new Date().toISOString(),
      messages_sent: existing?.messages_sent || 0,
      commands_used: existing?.commands_used || 0,
      reactions_given: existing?.reactions_given || 0
    };

    // Increment activity counters
    switch(activityType) {
      case 'message':
        updates.messages_sent = (existing?.messages_sent || 0) + 1;
        if (!existing) updates.first_message_at = new Date().toISOString();
        break;
      case 'command':
        updates.commands_used = (existing?.commands_used || 0) + 1;
        break;
      case 'reaction':
        updates.reactions_given = (existing?.reactions_given || 0) + 1;
        break;
    }

    // Check for first message (retention tracking)
    if (activityType === 'message') {
      await this.checkFirstMessage(guildId, userId);
    }

    await this.supabase
      .from('user_activity_summary')
      .upsert(updates, {
        onConflict: 'guild_id,user_id,date'
      });
  }

  /**
   * Check and record first message for retention
   */
  async checkFirstMessage(guildId, userId) {
    const { data: retention } = await this.supabase
      .from('member_retention')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (retention && !retention.first_message_at) {
      const now = new Date();
      const joined = new Date(retention.joined_at);
      const timeToFirstMessage = Math.floor((now - joined) / 1000); // Seconds

      await this.supabase
        .from('member_retention')
        .update({
          first_message_at: now.toISOString(),
          time_to_first_message: timeToFirstMessage
        })
        .eq('guild_id', guildId)
        .eq('user_id', userId);
    }
  }

  /**
   * Update hourly activity
   */
  async updateHourlyActivity(guildId, userId) {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getHours();

    // This is a simplified version - in production use proper SQL increment
    const { data: existing } = await this.supabase
      .from('hourly_activity')
      .select('*')
      .eq('guild_id', guildId)
      .eq('date', date)
      .eq('hour', hour)
      .single();

    if (existing) {
      await this.supabase
        .from('hourly_activity')
        .update({
          messages: existing.messages + 1,
          unique_users: existing.unique_users // Will update separately
        })
        .eq('id', existing.id);
    } else {
      await this.supabase
        .from('hourly_activity')
        .insert({
          guild_id: guildId,
          date,
          hour,
          messages: 1,
          unique_users: 1
        });
    }
  }

  /**
   * Increment daily stat
   */
  async incrementDailyStat(guildId, field, amount) {
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await this.supabase
      .from('analytics_daily_stats')
      .select('*')
      .eq('guild_id', guildId)
      .eq('date', today)
      .single();

    if (existing) {
      const updates = {};
      updates[field] = (existing[field] || 0) + amount;
      
      await this.supabase
        .from('analytics_daily_stats')
        .update(updates)
        .eq('id', existing.id);
    } else {
      const newRecord = {
        guild_id: guildId,
        date: today,
        total_members: 0,
        new_joins: 0,
        leaves: 0,
        net_growth: 0,
        total_messages: 0,
        unique_active_users: 0,
        total_voice_minutes: 0,
        total_reactions: 0,
        total_commands: 0
      };
      newRecord[field] = amount;
      
      await this.supabase
        .from('analytics_daily_stats')
        .insert(newRecord);
    }
  }

  /**
   * Update channel stats
   */
  async updateChannelStats(guildId, channelId, channelName) {
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await this.supabase
      .from('channel_stats')
      .select('*')
      .eq('guild_id', guildId)
      .eq('channel_id', channelId)
      .eq('date', today)
      .single();

    if (existing) {
      await this.supabase
        .from('channel_stats')
        .update({
          messages_count: (existing.messages_count || 0) + 1,
          channel_name: channelName
        })
        .eq('id', existing.id);
    } else {
      await this.supabase
        .from('channel_stats')
        .insert({
          guild_id: guildId,
          channel_id: channelId,
          channel_name: channelName,
          date: today,
          messages_count: 1,
          unique_users: 1
        });
    }
  }

  /**
   * Calculate retention for recent joins
   * Run this daily via cron
   */
  async calculateRetention(guildId = null) {
    console.log('📊 Calculating retention metrics...');

    const query = this.supabase
      .from('member_retention')
      .select('*')
      .eq('still_in_guild', true);

    if (guildId) {
      query.eq('guild_id', guildId);
    }

    const { data: members } = await query;

    if (!members) return;

    for (const member of members) {
      const joined = new Date(member.joined_at);
      const now = new Date();
      const hoursInGuild = (now - joined) / (1000 * 60 * 60);

      const updates = {};

      if (hoursInGuild >= 24 && !member.is_retained_24h) {
        updates.is_retained_24h = true;
      }

      if (hoursInGuild >= 24 * 7 && !member.is_retained_7d) {
        updates.is_retained_7d = true;
      }

      if (hoursInGuild >= 24 * 30 && !member.is_retained_30d) {
        updates.is_retained_30d = true;
      }

      if (Object.keys(updates).length > 0) {
        await this.supabase
          .from('member_retention')
          .update(updates)
          .eq('id', member.id);
      }
    }

    console.log(`✅ Retention calculated for ${members.length} members`);
  }
}

// Singleton
const analyticsTracker = new AnalyticsTracker();

module.exports = analyticsTracker;

