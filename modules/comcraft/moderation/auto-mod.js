/**
 * Comcraft Auto-Moderation System
 * Filters spam, links, invites, caps, bad words, and AI-powered content moderation
 */

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const configManager = require('../config-manager');
const aiService = require('../ai');

class AutoMod {
  constructor() {
    this.spamCache = new Map(); // userId -> [timestamps]
    this.duplicateCache = new Map(); // userId -> [recent messages]
    this.joinCache = new Map(); // guildId -> [join timestamps]
  }

  /**
   * Check message against all filters
   */
  async checkMessage(message) {
    if (!message.guild || message.author.bot) return null;
    if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return null; // Don't auto-mod moderators
    }

    const config = await configManager.getModerationConfig(message.guild.id);
    console.log('[AutoMod] Config for', message.guild.id, ':', {
      automod_enabled: config?.automod_enabled,
      filter_spam: config?.filter_spam,
      filter_words: config?.filter_words?.length || 0
    });

    if (!config || !config.automod_enabled) {
      console.log('[AutoMod] Auto-mod disabled or no config');
      return null;
    }

    const violations = [];
    console.log('[AutoMod] Checking message from', message.author.tag, ':', message.content.substring(0, 50));

    // Check spam
    if (config.filter_spam && this.isSpam(message, config)) {
      violations.push('spam');
    }

    // Check links
    if (config.filter_links && this.hasLinks(message.content)) {
      violations.push('links');
    }

    // Check invites
    if (config.filter_invites && this.hasDiscordInvite(message.content)) {
      violations.push('discord_invite');
    }

    // Check caps
    if (config.filter_caps && this.hasExcessiveCaps(message.content, config)) {
      violations.push('caps');
    }

    // Check bad words
    if (config.filter_words && config.filter_words.length > 0) {
      if (this.hasBadWords(message.content, config.filter_words)) {
        violations.push('bad_words');
      }
    }

    // Check mention spam
    if (config.filter_mention_spam && this.hasMentionSpam(message, config)) {
      violations.push('mention_spam');
    }

    // Check emoji spam
    if (config.filter_emoji_spam && this.hasEmojiSpam(message.content, config)) {
      violations.push('emoji_spam');
    }

    // Check duplicate messages
    if (config.filter_duplicates && this.isDuplicate(message, config)) {
      violations.push('duplicate_message');
    }

    // Check AI content moderation (if enabled)
    if (config.ai_moderation_enabled && aiService.config.isAiEnabled()) {
      const aiViolation = await this.checkAiModeration(message.content, message.guild.id);
      if (aiViolation) {
        violations.push(`ai_${aiViolation}`);
      }
    }

    if (violations.length > 0) {
      console.log('[AutoMod] Violations detected:', violations);
    }

    return violations.length > 0 ? violations : null;
  }

  /**
   * Spam detection
   */
  isSpam(message, config) {
    const userId = message.author.id;
    const now = Date.now();
    const interval = (config.spam_interval || 5) * 1000;
    const maxMessages = config.spam_messages || 5;

    if (!this.spamCache.has(userId)) {
      this.spamCache.set(userId, []);
    }

    const timestamps = this.spamCache.get(userId);
    
    // Remove old timestamps
    const recentTimestamps = timestamps.filter(t => now - t < interval);
    recentTimestamps.push(now);
    
    this.spamCache.set(userId, recentTimestamps);

    return recentTimestamps.length > maxMessages;
  }

  /**
   * Link detection
   */
  hasLinks(content) {
    const linkRegex = /(https?:\/\/[^\s]+)/gi;
    return linkRegex.test(content);
  }

  /**
   * Discord invite detection
   */
  hasDiscordInvite(content) {
    const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)[a-zA-Z0-9]+/gi;
    return inviteRegex.test(content);
  }

  /**
   * Excessive caps detection
   */
  hasExcessiveCaps(content, config) {
    if (content.length < (config.caps_min_length || 10)) {
      return false;
    }

    const capsCount = (content.match(/[A-Z]/g) || []).length;
    const totalLetters = (content.match(/[a-zA-Z]/g) || []).length;

    if (totalLetters === 0) return false;

    const capsPercentage = (capsCount / totalLetters) * 100;
    return capsPercentage > (config.caps_threshold || 70);
  }

  /**
   * Bad words detection
   */
  hasBadWords(content, filterWords) {
    const lowerContent = content.toLowerCase();
    
    return filterWords.some(word => {
      const lowerWord = word.toLowerCase();
      return lowerContent.includes(lowerWord);
    });
  }

  /**
   * Handle violation
   */
  async handleViolation(message, violations) {
    try {
      const config = await configManager.getModerationConfig(message.guild.id);
      
      // Delete message
      await message.delete().catch(() => {});

      // Send warning
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Auto-Moderation')
        .setDescription(`${message.author}, your message was removed by auto-moderation.`)
        .addFields({
          name: 'Reason',
          value: this.getViolationText(violations)
        })
        .setTimestamp();

      const warning = await message.channel.send({ embeds: [embed] });
      
      // Delete warning after 5 seconds
      setTimeout(() => warning.delete().catch(() => {}), 5000);

      // Log to mod channel
      await this.logViolation(message, violations);

      // Apply auto-slowmode if spam detected
      if (violations.includes('spam') && config?.auto_slowmode_enabled) {
        await this.autoSlowmode(message.channel, config);
      }

      return true;
    } catch (error) {
      console.error('Error handling auto-mod violation:', error);
      return false;
    }
  }

  /**
   * Mention spam detection
   */
  hasMentionSpam(message, config) {
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    const maxMentions = config.max_mentions || 5;
    
    // Check for @everyone or @here abuse
    if (message.mentions.everyone) {
      return true;
    }
    
    return mentions > maxMentions;
  }

  /**
   * Emoji spam detection
   */
  hasEmojiSpam(content, config) {
    const emojiRegex = /<a?:\w+:\d+>|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojis = content.match(emojiRegex) || [];
    const maxEmojis = config.max_emojis || 10;
    
    return emojis.length > maxEmojis;
  }

  /**
   * Duplicate message detection
   */
  isDuplicate(message, config) {
    const userId = message.author.id;
    const content = message.content.toLowerCase().trim();
    
    if (!content || content.length < 5) return false;
    
    if (!this.duplicateCache.has(userId)) {
      this.duplicateCache.set(userId, []);
    }
    
    const userMessages = this.duplicateCache.get(userId);
    const now = Date.now();
    const timeWindow = (config.duplicate_time_window || 60) * 1000; // 60 seconds default
    
    // Clean old messages
    const recentMessages = userMessages.filter(msg => now - msg.timestamp < timeWindow);
    
    // Check if this message is a duplicate
    const isDupe = recentMessages.some(msg => msg.content === content);
    
    // Add current message
    recentMessages.push({ content, timestamp: now });
    this.duplicateCache.set(userId, recentMessages);
    
    return isDupe;
  }

  /**
   * AI-powered content moderation
   */
  async checkAiModeration(content, guildId) {
    try {
      const result = await aiService.runTask('moderate', { content }, {
        meta: { guildId, source: 'automod' }
      });
      
      if (result.flagged && Array.isArray(result.categories) && result.categories.length > 0) {
        // Return first flagged category
        return result.categories[0];
      }
      
      return null;
    } catch (error) {
      console.error('AI moderation error:', error);
      return null; // Don't block message if AI fails
    }
  }

  /**
   * Check for raid (mass joins)
   */
  async checkRaid(guild, config) {
    if (!config.anti_raid_enabled) return false;
    
    const guildId = guild.id;
    if (!this.joinCache.has(guildId)) {
      this.joinCache.set(guildId, []);
    }
    
    const joins = this.joinCache.get(guildId);
    const now = Date.now();
    const timeWindow = (config.raid_time_window || 10) * 1000; // 10 seconds default
    const maxJoins = config.raid_max_joins || 5;
    
    // Clean old joins
    const recentJoins = joins.filter(timestamp => now - timestamp < timeWindow);
    recentJoins.push(now);
    
    this.joinCache.set(guildId, recentJoins);
    
    return recentJoins.length > maxJoins;
  }

  /**
   * Get human-readable violation text
   */
  getViolationText(violations) {
    const texts = {
      spam: '🔴 Spam detected',
      links: '🔗 Unauthorized links',
      discord_invite: '📨 Discord invite',
      caps: '🔠 Excessive caps',
      bad_words: '🚫 Inappropriate language',
      mention_spam: '📢 Mention spam',
      emoji_spam: '😀 Emoji spam',
      duplicate_message: '📋 Duplicate message',
      ai_toxicity: '🤖 Toxic content (AI)',
      ai_hate: '🤖 Hate speech (AI)',
      ai_harassment: '🤖 Harassment (AI)',
      ai_violence: '🤖 Violent content (AI)',
      ai_sexual: '🤖 Sexual content (AI)',
      ai_spam: '🤖 Spam (AI)'
    };

    return violations.map(v => texts[v] || v).join('\n');
  }

  /**
   * Log violation to mod log channel
   */
  async logViolation(message, violations) {
    try {
      const config = await configManager.getModerationConfig(message.guild.id);
      if (!config || !config.mod_log_channel_id) return;

      const logChannel = message.guild.channels.cache.get(config.mod_log_channel_id);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🤖 Auto-Moderation Log')
        .setDescription(`Message removed in ${message.channel}`)
        .addFields(
          { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
          { name: 'Reason', value: this.getViolationText(violations), inline: true },
          { name: 'Content', value: message.content.substring(0, 1000) || '*No text*' }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error logging violation:', error);
    }
  }

  /**
   * Auto slowmode on spam detection
   */
  async autoSlowmode(channel, config) {
    if (!config.auto_slowmode_enabled) return false;
    
    try {
      const currentSlowmode = channel.rateLimitPerUser || 0;
      const targetSlowmode = config.auto_slowmode_duration || 5; // 5 seconds default
      
      if (currentSlowmode < targetSlowmode) {
        await channel.setRateLimitPerUser(targetSlowmode, 'Auto-moderation: spam detected');
        
        // Auto-remove slowmode after configured time
        const slowmodeDuration = (config.auto_slowmode_reset || 300) * 1000; // 5 minutes default
        setTimeout(async () => {
          try {
            await channel.setRateLimitPerUser(0, 'Auto-moderation: cooldown period ended');
          } catch (error) {
            console.error('Error removing auto-slowmode:', error);
          }
        }, slowmodeDuration);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error setting auto-slowmode:', error);
      return false;
    }
  }

  /**
   * Handle raid mode
   */
  async handleRaid(guild, config) {
    try {
      // Lock down server
      const everyoneRole = guild.roles.everyone;
      await everyoneRole.setPermissions(
        everyoneRole.permissions.remove([
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.CreatePublicThreads
        ]),
        'Anti-raid protection activated'
      );
      
      // Log to mod channel
      const logChannel = guild.channels.cache.get(config.mod_log_channel_id);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🚨 RAID DETECTED - Server Locked')
          .setDescription('Multiple users joined in a short time. Server has been locked down.')
          .addFields(
            { name: 'Action Taken', value: 'Removed send message permissions from @everyone' },
            { name: 'Next Steps', value: 'Review recent joins and manually unlock when safe' }
          )
          .setTimestamp();
        
        await logChannel.send({ embeds: [embed], content: '<@&' + config.mod_role_id + '>' });
      }
      
      return true;
    } catch (error) {
      console.error('Error handling raid:', error);
      return false;
    }
  }

  /**
   * Clear spam cache for user
   */
  clearSpamCache(userId) {
    this.spamCache.delete(userId);
    this.duplicateCache.delete(userId);
  }

  /**
   * Clear all caches
   */
  clearAllCache() {
    this.spamCache.clear();
    this.duplicateCache.clear();
    this.joinCache.clear();
  }

  /**
   * Get user moderation statistics
   */
  async getUserStats(guildId, userId) {
    const { data: logs } = await this.supabase
      .from('moderation_logs')
      .select('action, created_at')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    const stats = {
      total: logs?.length || 0,
      warns: logs?.filter(l => l.action === 'warn').length || 0,
      mutes: logs?.filter(l => l.action === 'mute').length || 0,
      kicks: logs?.filter(l => l.action === 'kick').length || 0,
      bans: logs?.filter(l => l.action === 'ban').length || 0,
      recent: logs?.slice(0, 5) || []
    };
    
    return stats;
  }
}

module.exports = new AutoMod();

