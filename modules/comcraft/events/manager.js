/**
 * Event Management System
 * Comprehensive event management with RSVP, reminders, and notifications
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

class EventManager {
  constructor(client) {
    this.client = client;
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️ [EventManager] Supabase credentials missing, event management disabled');
      this.supabase = null;
      return;
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    this.reminderIntervals = new Map(); // eventId -> interval
    console.log('✅ [EventManager] Initialized');
  }

  /**
   * Create a new event
   */
  async createEvent(guildId, eventData) {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .insert({
          guild_id: guildId,
          ...eventData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[EventManager] Error creating event:', error);
        return { success: false, error: error.message };
      }

      // Schedule reminders if auto_remind is enabled
      if (data.auto_remind && data.is_published) {
        this.scheduleReminders(data);
      }

      // Send announcement if published
      if (data.is_published) {
        await this.sendAnnouncement(data);
      }

      return { success: true, event: data };
    } catch (error) {
      console.error('[EventManager] Error in createEvent:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(eventId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .select()
        .single();

      if (error) {
        console.error('[EventManager] Error updating event:', error);
        return { success: false, error: error.message };
      }

      // Reschedule reminders if event changed
      if (data.auto_remind && data.is_published) {
        this.cancelReminders(eventId);
        this.scheduleReminders(data);
      }

      return { success: true, event: data };
    } catch (error) {
      console.error('[EventManager] Error in updateEvent:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId) {
    try {
      // Cancel reminders
      this.cancelReminders(eventId);

      const { error } = await this.supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) {
        console.error('[EventManager] Error deleting event:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('[EventManager] Error in deleteEvent:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get events for a guild
   */
  async getGuildEvents(guildId, filters = {}) {
    try {
      let query = this.supabase
        .from('events')
        .select('*, event_rsvps(*)')
        .eq('guild_id', guildId);

      if (filters.active !== undefined) {
        query = query.eq('is_active', filters.active);
      }

      if (filters.published !== undefined) {
        query = query.eq('is_published', filters.published);
      }

      if (filters.upcoming) {
        query = query.gte('start_time', new Date().toISOString());
      }

      query = query.order('start_time', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('[EventManager] Error fetching events:', error);
        return { success: false, error: error.message };
      }

      return { success: true, events: data || [] };
    } catch (error) {
      console.error('[EventManager] Error in getGuildEvents:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * RSVP to an event
   */
  async rsvpToEvent(eventId, userId, discordTag, status, notes = null) {
    try {
      // Get event to check requirements
      const { data: event } = await this.supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (!event) {
        return { success: false, error: 'Event not found' };
      }

      // Check if RSVP deadline passed
      if (event.rsvp_deadline && new Date(event.rsvp_deadline) < new Date()) {
        return { success: false, error: 'RSVP deadline has passed' };
      }

      // Check max participants
      if (event.max_participants && status === 'going') {
        const { count } = await this.supabase
          .from('event_rsvps')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .eq('status', 'going');

        if (count >= event.max_participants) {
          return { success: false, error: 'Event is full' };
        }
      }

      // Upsert RSVP
      const { data, error } = await this.supabase
        .from('event_rsvps')
        .upsert({
          event_id: eventId,
          user_id: userId,
          discord_tag: discordTag,
          status: status,
          notes: notes,
          rsvp_at: new Date().toISOString()
        }, {
          onConflict: 'event_id,user_id'
        })
        .select()
        .single();

      if (error) {
        console.error('[EventManager] Error creating RSVP:', error);
        return { success: false, error: error.message };
      }

      return { success: true, rsvp: data };
    } catch (error) {
      console.error('[EventManager] Error in rsvpToEvent:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get RSVPs for an event
   */
  async getEventRSVPs(eventId) {
    try {
      const { data, error } = await this.supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('rsvp_at', { ascending: false });

      if (error) {
        console.error('[EventManager] Error fetching RSVPs:', error);
        return { success: false, error: error.message };
      }

      return { success: true, rsvps: data || [] };
    } catch (error) {
      console.error('[EventManager] Error in getEventRSVPs:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send event announcement
   */
  async sendAnnouncement(event) {
    try {
      const guild = this.client.guilds.cache.get(event.guild_id);
      if (!guild) return;

      const channel = event.channel_id 
        ? guild.channels.cache.get(event.channel_id)
        : guild.systemChannel;

      if (!channel || !channel.isTextBased()) {
        console.log(`[EventManager] No valid channel for event ${event.id}`);
        return;
      }

      const embed = this.createEventEmbed(event);
      const components = this.createEventComponents(event.id, event.requires_rsvp);

      // Build mention string
      let mentionString = '';
      if (event.role_mentions && event.role_mentions.length > 0) {
        mentionString = event.role_mentions.map(id => `<@&${id}>`).join(' ') + ' ';
      }

      const message = await channel.send({
        content: `📅 **New Event: ${event.title}**\n\n${mentionString}Check out the details below!`,
        embeds: [embed],
        components: components
      });

      // Track notification
      await this.supabase
        .from('event_notifications_sent')
        .insert({
          event_id: event.id,
          channel_id: channel.id,
          message_id: message.id,
          notification_type: 'announcement'
        });

      return { success: true, messageId: message.id };
    } catch (error) {
      console.error('[EventManager] Error sending announcement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create event embed
   */
  createEventEmbed(event) {
    const startTime = new Date(event.start_time);
    const endTime = event.end_time ? new Date(event.end_time) : null;

    const embed = new EmbedBuilder()
      .setTitle(`📅 ${event.title}`)
      .setDescription(event.description || 'No description provided.')
      .setColor(this.hexToInt(event.color || '#5865F2'))
      .addFields([
        {
          name: '📅 Date & Time',
          value: `<t:${Math.floor(startTime.getTime() / 1000)}:F>\n<t:${Math.floor(startTime.getTime() / 1000)}:R>`,
          inline: true
        },
        {
          name: '🏷️ Type',
          value: event.event_type.charAt(0).toUpperCase() + event.event_type.slice(1),
          inline: true
        }
      ])
      .setTimestamp(startTime);

    if (endTime) {
      embed.addFields([
        {
          name: '⏰ Duration',
          value: this.formatDuration(startTime, endTime),
          inline: true
        }
      ]);
    }

    if (event.location) {
      embed.addFields([
        {
          name: '📍 Location',
          value: event.location,
          inline: false
        }
      ]);
    }

    if (event.max_participants) {
      embed.addFields([
        {
          name: '👥 Participants',
          value: `${event.max_participants} max`,
          inline: true
        }
      ]);
    }

    if (event.image_url) {
      embed.setImage(event.image_url);
    }

    if (event.role_requirements && event.role_requirements.length > 0) {
      embed.addFields([
        {
          name: '🔒 Requirements',
          value: `Required roles: ${event.role_requirements.length} role(s)`,
          inline: false
        }
      ]);
    }

    embed.setFooter({ 
      text: `Event ID: ${event.id.slice(0, 8)}`,
      iconURL: this.client.user?.displayAvatarURL()
    });

    return embed;
  }

  /**
   * Create event action components (buttons)
   */
  createEventComponents(eventId, requiresRsvp = true) {
    const row = new ActionRowBuilder();

    if (requiresRsvp) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`event_rsvp_${eventId}_going`)
          .setLabel('✅ Going')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`event_rsvp_${eventId}_maybe`)
          .setLabel('❓ Maybe')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`event_rsvp_${eventId}_not_going`)
          .setLabel('❌ Not Going')
          .setStyle(ButtonStyle.Danger)
      );
    }

    return row.components.length > 0 ? [row] : [];
  }

  /**
   * Schedule reminders for an event
   */
  scheduleReminders(event) {
    if (!event.auto_remind || !event.reminder_times || event.reminder_times.length === 0) {
      return;
    }

    const startTime = new Date(event.start_time);
    const now = new Date();

    // Cancel existing reminders
    this.cancelReminders(event.id);

    for (const minutesBefore of event.reminder_times) {
      const reminderTime = new Date(startTime.getTime() - (minutesBefore * 60 * 1000));

      if (reminderTime <= now) {
        continue; // Reminder time already passed
      }

      const delay = reminderTime.getTime() - now.getTime();

      const timeout = setTimeout(async () => {
        await this.sendReminder(event, minutesBefore);
      }, delay);

      // Store timeout
      if (!this.reminderIntervals.has(event.id)) {
        this.reminderIntervals.set(event.id, []);
      }
      this.reminderIntervals.get(event.id).push(timeout);
    }
  }

  /**
   * Cancel reminders for an event
   */
  cancelReminders(eventId) {
    const intervals = this.reminderIntervals.get(eventId);
    if (intervals) {
      intervals.forEach(clearTimeout);
      this.reminderIntervals.delete(eventId);
    }
  }

  /**
   * Send reminder for an event
   */
  async sendReminder(event, minutesBefore) {
    try {
      const guild = this.client.guilds.cache.get(event.guild_id);
      if (!guild) return;

      // Get all users who RSVP'd as "going" or "maybe"
      const { data: rsvps } = await this.supabase
        .from('event_rsvps')
        .select('user_id, discord_tag')
        .eq('event_id', event.id)
        .in('status', ['going', 'maybe']);

      if (!rsvps || rsvps.length === 0) {
        return; // No one to remind
      }

      const channel = event.channel_id 
        ? guild.channels.cache.get(event.channel_id)
        : guild.systemChannel;

      if (!channel || !channel.isTextBased()) {
        return;
      }

      const startTime = new Date(event.start_time);
      const timeString = minutesBefore >= 60 
        ? `${Math.floor(minutesBefore / 60)} hour(s)`
        : `${minutesBefore} minute(s)`;

      const embed = new EmbedBuilder()
        .setTitle(`⏰ Reminder: ${event.title}`)
        .setDescription(`This event starts in **${timeString}**!\n\n<t:${Math.floor(startTime.getTime() / 1000)}:F>`)
        .setColor(0xFFA500) // Orange
        .setTimestamp();

      const mentions = rsvps.map(rsvp => `<@${rsvp.user_id}>`).join(' ');

      await channel.send({
        content: `⏰ **Event Reminder**\n\n${mentions}`,
        embeds: [embed]
      });

      // Mark reminders as sent
      for (const rsvp of rsvps) {
        await this.supabase
          .from('event_reminders_sent')
          .insert({
            event_id: event.id,
            user_id: rsvp.user_id,
            reminder_minutes: minutesBefore
          });
      }

      console.log(`[EventManager] Sent reminder for event ${event.id} (${minutesBefore} min before)`);
    } catch (error) {
      console.error('[EventManager] Error sending reminder:', error);
    }
  }

  /**
   * Check and process upcoming events
   */
  async checkUpcomingEvents() {
    try {
      const now = new Date();
      const soon = new Date(now.getTime() + (5 * 60 * 1000)); // 5 minutes from now

      const { data: startingEvents } = await this.supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .eq('is_published', true)
        .gte('start_time', now.toISOString())
        .lte('start_time', soon.toISOString());

      if (!startingEvents || startingEvents.length === 0) {
        return;
      }

      for (const event of startingEvents) {
        await this.sendStartingSoonNotification(event);
      }
    } catch (error) {
      console.error('[EventManager] Error checking upcoming events:', error);
    }
  }

  /**
   * Send "starting soon" notification
   */
  async sendStartingSoonNotification(event) {
    try {
      const guild = this.client.guilds.cache.get(event.guild_id);
      if (!guild) return;

      const channel = event.channel_id 
        ? guild.channels.cache.get(event.channel_id)
        : guild.systemChannel;

      if (!channel || !channel.isTextBased()) {
        return;
      }

      // Check if already sent
      const { data: existing } = await this.supabase
        .from('event_notifications_sent')
        .select('id')
        .eq('event_id', event.id)
        .eq('notification_type', 'starting_soon')
        .single();

      if (existing) {
        return; // Already sent
      }

      const { data: rsvps } = await this.supabase
        .from('event_rsvps')
        .select('user_id')
        .eq('event_id', event.id)
        .in('status', ['going', 'maybe']);

      const mentions = rsvps && rsvps.length > 0
        ? rsvps.map(r => `<@${r.user_id}>`).join(' ')
        : '';

      const embed = new EmbedBuilder()
        .setTitle(`🚀 Event Starting Soon: ${event.title}`)
        .setDescription(`The event is starting now! ${event.location ? `\n📍 ${event.location}` : ''}`)
        .setColor(0x00FF00) // Green
        .setTimestamp();

      await channel.send({
        content: mentions ? `🚀 **Event Starting!**\n\n${mentions}` : '🚀 **Event Starting!**',
        embeds: [embed]
      });

      // Track notification
      await this.supabase
        .from('event_notifications_sent')
        .insert({
          event_id: event.id,
          channel_id: channel.id,
          message_id: 'starting_soon',
          notification_type: 'starting_soon'
        });
    } catch (error) {
      console.error('[EventManager] Error sending starting soon notification:', error);
    }
  }

  /**
   * Start scheduler for checking events
   */
  startScheduler() {
    if (!this.supabase) {
      console.log('⚠️ [EventManager] Scheduler disabled (Supabase not configured)');
      return;
    }

    // Check every minute for events starting soon
    this.schedulerInterval = setInterval(() => {
      this.checkUpcomingEvents();
    }, 60 * 1000);

    // Also check immediately
    this.checkUpcomingEvents();

    console.log('✅ [EventManager] Scheduler started');
  }

  /**
   * Stop scheduler
   */
  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }

    // Cancel all reminders
    for (const eventId of this.reminderIntervals.keys()) {
      this.cancelReminders(eventId);
    }

    console.log('🛑 [EventManager] Scheduler stopped');
  }

  /**
   * Helper: Convert hex color to integer
   */
  hexToInt(hex) {
    return parseInt(hex.replace('#', ''), 16);
  }

  /**
   * Helper: Format duration between two dates
   */
  formatDuration(start, end) {
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

module.exports = EventManager;

