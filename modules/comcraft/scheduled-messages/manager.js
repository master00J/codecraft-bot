/**
 * ComCraft Scheduled Messages Manager
 * Send messages at programmed times (daily, weekly, custom schedules)
 */

const { EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const configManager = require('../config-manager');
const FeatureGate = require('../feature-gate');

const SCHEDULED_MESSAGES_FEATURE = 'scheduled_messages';

class ScheduledMessagesManager {
  constructor(client) {
    this.client = client;
    this.supabase = null;
    this.schedulerInterval = null;
    this.featureGate = new FeatureGate(configManager);

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      console.log('✅ [ScheduledMessages] Supabase client initialized');
    } else {
      console.warn('⚠️ [ScheduledMessages] Supabase not configured - SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    }
  }

  /**
   * Create a new scheduled message
   */
  async createScheduledMessage(data) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { data: message, error } = await this.supabase
        .from('scheduled_messages')
        .insert({
          guild_id: data.guildId,
          channel_id: data.channelId,
          message_content: data.content,
          message_embed: data.embed || null,
          schedule_type: data.scheduleType, // 'daily', 'weekly', 'custom'
          schedule_time: data.scheduleTime, // HH:MM format (e.g., "14:30")
          schedule_days: data.scheduleDays || null, // Array of day numbers (0=Sunday, 6=Saturday) for weekly
          schedule_cron: data.scheduleCron || null, // Cron expression for custom schedules
          timezone: data.timezone || 'UTC',
          is_active: data.isActive !== false,
          created_by: data.createdBy || null,
          last_sent_at: null,
          next_send_at: this.calculateNextSendTime(data),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating scheduled message:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Scheduled message created: ${message.id}`);
      return { success: true, data: message };
    } catch (error) {
      console.error('Error in createScheduledMessage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a scheduled message
   */
  async updateScheduledMessage(messageId, updates) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      // If schedule changed, recalculate next_send_at
      if (updates.scheduleType || updates.scheduleTime || updates.scheduleDays || updates.scheduleCron) {
        const { data: existing } = await this.supabase
          .from('scheduled_messages')
          .select('*')
          .eq('id', messageId)
          .single();

        if (existing) {
          const merged = { ...existing, ...updates };
          updates.next_send_at = this.calculateNextSendTime(merged);
        }
      }

      const { data: message, error } = await this.supabase
        .from('scheduled_messages')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        console.error('Error updating scheduled message:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Scheduled message updated: ${messageId}`);
      return { success: true, data: message };
    } catch (error) {
      console.error('Error in updateScheduledMessage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a scheduled message
   */
  async deleteScheduledMessage(messageId) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { error } = await this.supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.error('Error deleting scheduled message:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Scheduled message deleted: ${messageId}`);
      return { success: true };
    } catch (error) {
      console.error('Error in deleteScheduledMessage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all scheduled messages for a guild
   */
  async getScheduledMessages(guildId) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured', data: [] };
    }

    try {
      const { data: messages, error } = await this.supabase
        .from('scheduled_messages')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching scheduled messages:', error);
        return { success: false, error: error.message, data: [] };
      }

      return { success: true, data: messages || [] };
    } catch (error) {
      console.error('Error in getScheduledMessages:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Calculate next send time based on schedule with timezone support
   */
  calculateNextSendTime(schedule) {
    const timezone = schedule.timezone || 'UTC';
    const [hours, minutes] = schedule.scheduleTime.split(':').map(Number);
    
    // Helper: Create a Date object representing a specific time in a specific timezone
    const createDateInTimezone = (year, month, day, hour, minute, tz) => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
      let candidateUTC = new Date(dateStr + 'Z');
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      for (let attempts = 0; attempts < 3; attempts++) {
        const parts = formatter.formatToParts(candidateUTC);
        const tzHour = parseInt(parts.find(p => p.type === 'hour').value);
        const tzMinute = parseInt(parts.find(p => p.type === 'minute').value);
        const diffMinutes = (hour * 60 + minute) - (tzHour * 60 + tzMinute);
        if (Math.abs(diffMinutes) < 1) break;
        candidateUTC = new Date(candidateUTC.getTime() + diffMinutes * 60 * 1000);
      }
      return candidateUTC;
    };
    
    // Get current date/time in the specified timezone
    const now = new Date();
    const nowInTz = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);
    
    const nowYear = parseInt(nowInTz.find(p => p.type === 'year').value);
    const nowMonth = parseInt(nowInTz.find(p => p.type === 'month').value) - 1;
    const nowDay = parseInt(nowInTz.find(p => p.type === 'day').value);
    const nowHour = parseInt(nowInTz.find(p => p.type === 'hour').value);
    const nowMinute = parseInt(nowInTz.find(p => p.type === 'minute').value);
    
    // Create target time for today in the timezone, then convert to UTC
    let nextSend = createDateInTimezone(nowYear, nowMonth, nowDay, hours, minutes, timezone);
    
    // Check if time has passed today in the timezone
    const timePassed = nowHour > hours || (nowHour === hours && nowMinute >= minutes);

    if (schedule.scheduleType === 'daily') {
      if (timePassed) {
        // Schedule for tomorrow in the timezone
        const tomorrow = new Date(nowYear, nowMonth, nowDay + 1);
        const tomorrowInTz = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).formatToParts(tomorrow);
        const tomorrowYear = parseInt(tomorrowInTz.find(p => p.type === 'year').value);
        const tomorrowMonth = parseInt(tomorrowInTz.find(p => p.type === 'month').value) - 1;
        const tomorrowDay = parseInt(tomorrowInTz.find(p => p.type === 'day').value);
        nextSend = createDateInTimezone(tomorrowYear, tomorrowMonth, tomorrowDay, hours, minutes, timezone);
      }
    } else if (schedule.scheduleType === 'weekly') {
      const days = schedule.scheduleDays || [];
      if (days.length === 0) return null;

      const currentDayOfWeek = new Date(nowYear, nowMonth, nowDay).getDay();
      let daysUntilNext = null;

      for (const day of days.sort((a, b) => a - b)) {
        if (day > currentDayOfWeek) {
          daysUntilNext = day - currentDayOfWeek;
          break;
        }
      }

      if (daysUntilNext === null) {
        daysUntilNext = (7 - currentDayOfWeek) + days[0];
      }
      
      const targetDate = new Date(nowYear, nowMonth, nowDay + daysUntilNext);
      const targetInTz = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(targetDate);
      const targetYear = parseInt(targetInTz.find(p => p.type === 'year').value);
      const targetMonth = parseInt(targetInTz.find(p => p.type === 'month').value) - 1;
      const targetDay = parseInt(targetInTz.find(p => p.type === 'day').value);
      nextSend = createDateInTimezone(targetYear, targetMonth, targetDay, hours, minutes, timezone);
    } else if (schedule.scheduleType === 'custom' && schedule.scheduleCron) {
      // For cron, we'll calculate on first run
      // For now, set to 1 hour from now as placeholder
      nextSend = new Date(now.getTime() + 60 * 60 * 1000);
    }

    return nextSend.toISOString();
  }

  /**
   * Check and send scheduled messages
   */
  async checkAndSendMessages() {
    if (!this.supabase) {
      console.log('⚠️ [ScheduledMessages] Supabase not configured, skipping check');
      return;
    }

    try {
      const now = new Date();
      const nowISO = now.toISOString();

      // Get all active scheduled messages
      const { data: allMessages, error: fetchError } = await this.supabase
        .from('scheduled_messages')
        .select('*')
        .eq('is_active', true);

      if (fetchError) {
        console.error('❌ [ScheduledMessages] Error fetching scheduled messages:', fetchError);
        return;
      }

      if (!allMessages || allMessages.length === 0) {
        return;
      }

      // Filter messages that are due (check in memory for better debugging)
      const dueMessages = allMessages.filter(msg => {
        const nextSend = new Date(msg.next_send_at);
        const isDue = nextSend <= now;
        if (isDue) {
          console.log(`⏰ [ScheduledMessages] Message ${msg.id} is due: next_send_at=${msg.next_send_at}, now=${nowISO}`);
        }
        return isDue;
      });

      if (dueMessages.length === 0) {
        return;
      }

      console.log(`📅 [ScheduledMessages] Found ${dueMessages.length} message(s) to send`);

      for (const message of dueMessages) {
        try {
          await this.sendScheduledMessage(message);
        } catch (error) {
          console.error(`❌ [ScheduledMessages] Error sending message ${message.id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ [ScheduledMessages] Error in checkAndSendMessages:', error);
    }
  }

  /**
   * Send a scheduled message
   */
  async sendScheduledMessage(message) {
    try {
      const guild = this.client.guilds.cache.get(message.guild_id);
      if (!guild) {
        console.warn(`⚠️ [ScheduledMessages] Guild ${message.guild_id} not found`);
        return;
      }

      // Check feature gate
      const hasFeature = await this.featureGate.checkFeature(message.guild_id, SCHEDULED_MESSAGES_FEATURE);
      if (!hasFeature) {
        console.log(`⚠️ [ScheduledMessages] Feature disabled for guild ${message.guild_id}`);
        return;
      }

      const channel = guild.channels.cache.get(message.channel_id);
      if (!channel) {
        console.warn(`⚠️ [ScheduledMessages] Channel ${message.channel_id} not found`);
        return;
      }

      // Send message
      if (message.message_embed) {
        // Send embed
        const embedData = typeof message.message_embed === 'string' 
          ? JSON.parse(message.message_embed) 
          : message.message_embed;
        
        const embed = new EmbedBuilder();
        if (embedData.title) embed.setTitle(embedData.title);
        if (embedData.description) embed.setDescription(embedData.description);
        if (embedData.color) embed.setColor(embedData.color);
        if (embedData.image?.url) embed.setImage(embedData.image.url);
        if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);
        if (embedData.author) {
          embed.setAuthor({
            name: embedData.author.name,
            iconURL: embedData.author.icon_url,
            url: embedData.author.url
          });
        }
        if (embedData.footer) {
          embed.setFooter({
            text: embedData.footer.text,
            iconURL: embedData.footer.icon_url
          });
        }
        if (embedData.fields && Array.isArray(embedData.fields)) {
          embed.addFields(embedData.fields);
        }
        if (embedData.timestamp) embed.setTimestamp(new Date(embedData.timestamp));
        
        await channel.send({ embeds: [embed] });
      } else if (message.message_content) {
        // Send plain text
        await channel.send(message.message_content);
      } else {
        console.warn(`⚠️ [ScheduledMessages] Message ${message.id} has no content or embed`);
        return;
      }

      // Update last_sent_at and calculate next_send_at
      const schedule = {
        scheduleType: message.schedule_type,
        scheduleTime: message.schedule_time,
        scheduleDays: message.schedule_days,
        scheduleCron: message.schedule_cron,
        timezone: message.timezone || 'UTC'
      };
      const nextSend = this.calculateNextSendTime(schedule);

      await this.supabase
        .from('scheduled_messages')
        .update({
          last_sent_at: new Date().toISOString(),
          next_send_at: nextSend,
          times_sent: (message.times_sent || 0) + 1
        })
        .eq('id', message.id);

      console.log(`✅ [ScheduledMessages] Sent scheduled message ${message.id} to ${channel.name}`);
    } catch (error) {
      console.error(`❌ [ScheduledMessages] Error sending message ${message.id}:`, error);
      throw error;
    }
  }

  /**
   * Start scheduler (checks every minute)
   */
  startScheduler() {
    if (!this.supabase) {
      console.log('⚠️ [ScheduledMessages] Scheduler disabled (Supabase not configured)');
      console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
      console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
      return;
    }

    if (!this.client || !this.client.isReady()) {
      console.log('⚠️ [ScheduledMessages] Scheduler disabled (Discord client not ready)');
      return;
    }

    // Check every minute for due messages
    this.schedulerInterval = setInterval(() => {
      this.checkAndSendMessages();
    }, 60 * 1000);

    // Also check immediately
    this.checkAndSendMessages();

    console.log('✅ [ScheduledMessages] Scheduler started (checks every minute)');
    console.log(`   Bot is ready: ${this.client.isReady()}`);
    console.log(`   Guilds cached: ${this.client.guilds.cache.size}`);
  }

  /**
   * Stop scheduler
   */
  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    console.log('🛑 [ScheduledMessages] Scheduler stopped');
  }
}

module.exports = ScheduledMessagesManager;

