/**
 * Comcraft Birthday Manager
 * Handles storing birthdays, settings and daily announcements
 */

const { createClient } = require('@supabase/supabase-js');
const configManager = require('../config-manager');

const DEFAULT_TEMPLATE = '🎂 Happy birthday {user}! Wishing you an amazing day!';
const DEFAULT_TIME = '09:00:00';

class BirthdayManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    this.announcementState = new Map(); // guildId -> { date: 'YYYY-MM-DD' }
    this.intervalHandle = null;
  }

  async getBirthdays(guildId) {
    const { data, error } = await this.supabase
      .from('comcraft_birthdays')
      .select('*')
      .eq('guild_id', guildId)
      .order('birthday', { ascending: true });

    if (error) {
      console.error('Error fetching birthdays:', error);
      return [];
    }

    return data || [];
  }

  async getBirthday(guildId, userId) {
    const { data, error } = await this.supabase
      .from('comcraft_birthdays')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching birthday:', error);
    }

    return data || null;
  }

  async setBirthday(guildId, user, birthdayString, options = {}) {
    const parsed = this.parseBirthday(birthdayString);
    if (!parsed) {
      return { success: false, error: 'Ongeldige datum. Gebruik formaat DD-MM of YYYY-MM-DD.' };
    }

    const birthdayISO = parsed.toISOString().split('T')[0];

    try {
      const { data, error } = await this.supabase
        .from('comcraft_birthdays')
        .upsert({
          guild_id: guildId,
          user_id: user.id,
          username: user.username,
          display_name: user.displayName || user.username,
          birthday: birthdayISO,
          timezone: options.timezone || null,
          is_private: options.is_private || false,
          notes: options.notes || null
        }, {
          onConflict: 'guild_id,user_id'
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, birthday: data };
    } catch (error) {
      console.error('Error setting birthday:', error);
      return { success: false, error: 'Could not save birthday.' };
    }
  }

  async removeBirthday(guildId, userId) {
    try {
      const { error } = await this.supabase
        .from('comcraft_birthdays')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error removing birthday:', error);
      return { success: false, error: 'Could not remove birthday.' };
    }
  }

  async getSettings(guildId) {
    const { data, error } = await this.supabase
      .from('guild_configs')
      .select(`
        birthdays_enabled,
        birthday_channel_id,
        birthday_role_id,
        birthday_message_template,
        birthday_ping_role,
        birthday_announcement_time,
        timezone
      `)
      .eq('guild_id', guildId)
      .single();

    if (error) {
      console.error('Error fetching birthday settings:', error);
      return null;
    }

    return data;
  }

  async updateSettings(guildId, updates) {
    try {
      const payload = { ...updates };
      const { error } = await this.supabase
        .from('guild_configs')
        .update(payload)
        .eq('guild_id', guildId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating birthday settings:', error);
      return { success: false, error: 'Could not update settings.' };
    }
  }

  parseBirthday(input) {
    if (!input || typeof input !== 'string') return null;
    const normalized = input.trim();

    // Accept YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const date = new Date(`${normalized}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    }

    // Accept DD-MM or DD/MM
    const shortMatch = normalized.match(/^(\d{1,2})[\-/](\d{1,2})$/);
    if (shortMatch) {
      const day = shortMatch[1].padStart(2, '0');
      const month = shortMatch[2].padStart(2, '0');
      const date = new Date(`2000-${month}-${day}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    }

    return null;
  }

  startScheduler(client) {
    if (this.intervalHandle) return;

    const run = async () => {
      try {
        await this.runAnnouncements(client);
      } catch (error) {
        console.error('Birthday scheduler error:', error);
      }
    };

    // Run shortly after startup, then every 15 minutes
    setTimeout(run, 30 * 1000);
    this.intervalHandle = setInterval(run, 15 * 60 * 1000);
  }

  stopScheduler() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async runAnnouncements(client) {
    for (const guild of client.guilds.cache.values()) {
      const hasFeature = await configManager.hasFeature(guild.id, 'birthday_manager');
      if (!hasFeature) {
        continue;
      }

      const settings = await this.getSettings(guild.id);
      if (!settings || !settings.birthdays_enabled || !settings.birthday_channel_id) {
        continue;
      }

      const timezone = settings.timezone || 'Europe/Amsterdam';
      const announceTime = settings.birthday_announcement_time || DEFAULT_TIME;

      if (!this.shouldAnnounceToday(guild.id, timezone, announceTime)) {
        continue;
      }

      const birthdays = await this.getBirthdays(guild.id);
      if (birthdays.length === 0) continue;

      const todayBirthdays = birthdays.filter(entry => {
        if (entry.is_private) return false;
        const parts = this.getDateParts(entry.birthday, timezone);
        const today = this.getDateParts(undefined, timezone);
        return parts.month === today.month && parts.day === today.day;
      });

      if (todayBirthdays.length === 0) continue;

      await this.announceGuildBirthdays(guild, todayBirthdays, settings);

      const currentYear = this.getDateParts(undefined, timezone).year;
      for (const entry of todayBirthdays) {
        await this.supabase
          .from('comcraft_birthdays')
          .update({ last_announced_year: currentYear, updated_at: new Date().toISOString() })
          .eq('id', entry.id);
      }
    }
  }

  shouldAnnounceToday(guildId, timezone, announceTime) {
    const nowParts = this.getDateParts(undefined, timezone);
    const [targetHour, targetMinute] = (announceTime || DEFAULT_TIME)
      .split(':')
      .map(part => parseInt(part, 10));

    if (Number.isNaN(targetHour) || Number.isNaN(targetMinute)) {
      return false;
    }

    if (nowParts.hour < targetHour || (nowParts.hour === targetHour && nowParts.minute < targetMinute)) {
      return false;
    }

    const currentDateKey = `${nowParts.year}-${nowParts.month.toString().padStart(2, '0')}-${nowParts.day.toString().padStart(2, '0')}`;
    const lastRun = this.announcementState.get(guildId);

    if (lastRun === currentDateKey) {
      return false;
    }

    this.announcementState.set(guildId, currentDateKey);
    return true;
  }

  getDateParts(dateInput, timezone) {
    const date = dateInput ? new Date(`${dateInput}T00:00:00.000Z`) : new Date();

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const part = type => parseInt(parts.find(p => p.type === type).value, 10);

    return {
      year: part('year'),
      month: part('month'),
      day: part('day'),
      hour: part('hour'),
      minute: part('minute')
    };
  }

  async announceGuildBirthdays(guild, entries, settings) {
    try {
      const channel = guild.channels.cache.get(settings.birthday_channel_id);
      if (!channel || !channel.isTextBased()) {
        console.warn(`Birthday channel invalid for guild ${guild.id}`);
        return;
      }

      const template = settings.birthday_message_template || DEFAULT_TEMPLATE;
      const timezone = settings.timezone || 'Europe/Amsterdam';
      const todayParts = this.getDateParts(undefined, timezone);

      let content = '';
      const embeds = [];

      for (const entry of entries) {
        const member = await guild.members.fetch(entry.user_id).catch(() => null);
        const mention = member ? member.toString() : `<@${entry.user_id}>`;
        const username = member ? member.displayName : entry.display_name || entry.username || 'Member';

        const age = this.estimateAge(entry.birthday, todayParts.year);
        const message = template
          .replace('{user}', mention)
          .replace('{username}', username)
          .replace('{age}', age ? age.toString() : '')
          .replace('{server}', guild.name);

        content += `${message}\n`;

        const embed = {
          title: '🎉 Happy Birthday!',
          description: message,
          color: 0xffc700,
          footer: { text: guild.name },
          timestamp: new Date().toISOString()
        };

        embeds.push(embed);

        if (settings.birthday_role_id && member) {
          await member.roles.add(settings.birthday_role_id).catch(err => console.warn('Failed to add birthday role:', err));

          // Schedule removal after 24 hours
          setTimeout(async () => {
            const freshMember = await guild.members.fetch(entry.user_id).catch(() => null);
            if (freshMember && freshMember.roles.cache.has(settings.birthday_role_id)) {
              await freshMember.roles.remove(settings.birthday_role_id).catch(() => {});
            }
          }, 24 * 60 * 60 * 1000);
        }
      }

      const ping = settings.birthday_ping_role && settings.birthday_role_id
        ? `<@&${settings.birthday_role_id}> `
        : '';

      await channel.send({
        content: `${ping}${content}`.trim(),
        embeds
      });
    } catch (error) {
      console.error(`Error announcing birthdays for guild ${guild.id}:`, error);
    }
  }

  estimateAge(birthday, currentYear) {
    if (!birthday || birthday.length < 4) return null;
    const yearPart = parseInt(birthday.slice(0, 4), 10);
    if (Number.isNaN(yearPart) || yearPart <= 1900) return null;
    return currentYear - yearPart;
  }
}

module.exports = new BirthdayManager();
