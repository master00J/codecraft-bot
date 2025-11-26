/**
 * ComCraft Vote Kick Manager
 * Handles vote kick functionality for voice channels
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class VoteKickManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.activeSessions = new Map(); // In-memory cache for active sessions
  }

  /**
   * Get vote kick configuration for a guild
   */
  async getConfig(guildId) {
    const { data, error } = await this.supabase
      .from('vote_kick_config')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching vote kick config:', error);
      return null;
    }

    return data || {
      guild_id: guildId,
      enabled: false,
      required_votes: 3,
      vote_duration_seconds: 60,
      cooldown_seconds: 300,
      allowed_channels: [],
      exempt_roles: [],
      exempt_users: [],
      log_channel_id: null
    };
  }

  /**
   * Check if vote kick is enabled for a guild
   */
  async isEnabled(guildId) {
    const config = await this.getConfig(guildId);
    return config?.enabled || false;
  }

  /**
   * Check if a user can be vote kicked
   */
  async canBeVoteKicked(guild, member, channelId) {
    const config = await this.getConfig(guild.id);
    
    if (!config?.enabled) {
      return { allowed: false, reason: 'Vote kick is disabled for this server.' };
    }

    // Check if channel is allowed
    if (config.allowed_channels && config.allowed_channels.length > 0) {
      if (!config.allowed_channels.includes(channelId)) {
        return { allowed: false, reason: 'Vote kick is not allowed in this channel.' };
      }
    }

    // Check if user has exempt role
    if (config.exempt_roles && config.exempt_roles.length > 0) {
      const hasExemptRole = member.roles.cache.some(role => 
        config.exempt_roles.includes(role.id)
      );
      if (hasExemptRole) {
        return { allowed: false, reason: 'This user has a role that is exempt from vote kicks.' };
      }
    }

    // Check if user is exempt
    if (config.exempt_users && config.exempt_users.includes(member.id)) {
      return { allowed: false, reason: 'This user is exempt from vote kicks.' };
    }

    // Check if user is in a voice channel
    if (!member.voice.channel) {
      return { allowed: false, reason: 'User is not in a voice channel.' };
    }

    // Check if user is in the same channel as the command
    if (member.voice.channel.id !== channelId) {
      return { allowed: false, reason: 'User is not in this voice channel.' };
    }

    // Check if user is a bot
    if (member.user.bot) {
      return { allowed: false, reason: 'Bots cannot be vote kicked.' };
    }

    // Check if user is the server owner
    if (member.id === guild.ownerId) {
      return { allowed: false, reason: 'Server owner cannot be vote kicked.' };
    }

    return { allowed: true };
  }

  /**
   * Check if there's an active cooldown for a user
   */
  async checkCooldown(guildId, targetUserId) {
    const config = await this.getConfig(guildId);
    const cooldownSeconds = config?.cooldown_seconds || 300;

    // Check recent logs
    const { data } = await this.supabase
      .from('vote_kick_logs')
      .select('created_at')
      .eq('guild_id', guildId)
      .eq('target_user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const lastKick = new Date(data.created_at);
      const now = new Date();
      const secondsSince = (now - lastKick) / 1000;

      if (secondsSince < cooldownSeconds) {
        const remaining = Math.ceil(cooldownSeconds - secondsSince);
        return {
          onCooldown: true,
          remainingSeconds: remaining
        };
      }
    }

    return { onCooldown: false };
  }

  /**
   * Check if there's an active vote kick session for a user
   */
  async getActiveSession(guildId, targetUserId) {
    // Check cache first
    const cacheKey = `${guildId}:${targetUserId}`;
    if (this.activeSessions.has(cacheKey)) {
      const session = this.activeSessions.get(cacheKey);
      if (new Date(session.expires_at) > new Date()) {
        return session;
      } else {
        this.activeSessions.delete(cacheKey);
      }
    }

    // Check database
    const { data } = await this.supabase
      .from('vote_kick_sessions')
      .select('*')
      .eq('guild_id', guildId)
      .eq('target_user_id', targetUserId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      this.activeSessions.set(cacheKey, data);
      return data;
    }

    return null;
  }

  /**
   * Start a new vote kick session
   */
  async startVoteKick(guild, channel, targetMember, initiator) {
    const config = await this.getConfig(guild.id);
    
    if (!config?.enabled) {
      return { success: false, error: 'Vote kick is disabled for this server.' };
    }

    // Check if user can be vote kicked
    const canKick = await this.canBeVoteKicked(guild, targetMember, channel.id);
    if (!canKick.allowed) {
      return { success: false, error: canKick.reason };
    }

    // Check cooldown
    const cooldown = await this.checkCooldown(guild.id, targetMember.id);
    if (cooldown.onCooldown) {
      return {
        success: false,
        error: `This user is on cooldown. Please wait ${cooldown.remainingSeconds} more seconds.`
      };
    }

    // Check if there's already an active session
    const existingSession = await this.getActiveSession(guild.id, targetMember.id);
    if (existingSession) {
      return {
        success: false,
        error: 'There is already an active vote kick session for this user.'
      };
    }

    // Create session
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (config.vote_duration_seconds || 60));

    const { data: session, error } = await this.supabase
      .from('vote_kick_sessions')
      .insert({
        guild_id: guild.id,
        channel_id: channel.id,
        target_user_id: targetMember.id,
        initiator_user_id: initiator.id,
        required_votes: config.required_votes || 3,
        expires_at: expiresAt.toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating vote kick session:', error);
      return { success: false, error: 'Failed to create vote kick session.' };
    }

    // Cache session
    const cacheKey = `${guild.id}:${targetMember.id}`;
    this.activeSessions.set(cacheKey, session);

    return { success: true, session };
  }

  /**
   * Vote on an active session
   */
  async vote(sessionId, userId, voteType) {
    // Get session
    const { data: session, error: fetchError } = await this.supabase
      .from('vote_kick_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      return { success: false, error: 'Vote kick session not found.' };
    }

    // Check if session is still active
    if (session.status !== 'active') {
      return { success: false, error: 'This vote kick session is no longer active.' };
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      await this.expireSession(sessionId);
      return { success: false, error: 'This vote kick session has expired.' };
    }

    // Check if user already voted
    if (session.voters && session.voters.includes(userId)) {
      return { success: false, error: 'You have already voted on this session.' };
    }

    // Check if user is voting on themselves
    if (userId === session.target_user_id) {
      return { success: false, error: 'You cannot vote on your own vote kick.' };
    }

    // Update votes
    const newVotesFor = voteType === 'for' ? (session.votes_for || 0) + 1 : (session.votes_for || 0);
    const newVotesAgainst = voteType === 'against' ? (session.votes_against || 0) + 1 : (session.votes_against || 0);
    const newVoters = [...(session.voters || []), userId];

    const { data: updatedSession, error: updateError } = await this.supabase
      .from('vote_kick_sessions')
      .update({
        votes_for: newVotesFor,
        votes_against: newVotesAgainst,
        voters: newVoters,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating vote:', updateError);
      return { success: false, error: 'Failed to record vote.' };
    }

    // Check if required votes reached
    if (newVotesFor >= session.required_votes) {
      await this.passVoteKick(updatedSession);
      return { success: true, passed: true, session: updatedSession };
    }

    // Update cache
    const cacheKey = `${session.guild_id}:${session.target_user_id}`;
    this.activeSessions.set(cacheKey, updatedSession);

    return { success: true, passed: false, session: updatedSession };
  }

  /**
   * Pass a vote kick (enough votes reached)
   */
  async passVoteKick(session) {
    try {
      // Get guild and member
      // Note: This will be called from the command handler where we have access to the client
      
      // Update session status
      await this.supabase
        .from('vote_kick_sessions')
        .update({
          status: 'passed',
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);

      // Log to database
      await this.logVoteKick(session, 'passed', true);

      // Remove from cache
      const cacheKey = `${session.guild_id}:${session.target_user_id}`;
      this.activeSessions.delete(cacheKey);

      return { success: true };
    } catch (error) {
      console.error('Error passing vote kick:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Expire a vote kick session
   */
  async expireSession(sessionId) {
    const { data: session } = await this.supabase
      .from('vote_kick_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (session) {
      await this.supabase
        .from('vote_kick_sessions')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      await this.logVoteKick(session, 'expired', false);

      const cacheKey = `${session.guild_id}:${session.target_user_id}`;
      this.activeSessions.delete(cacheKey);
    }
  }

  /**
   * Cancel a vote kick session
   */
  async cancelSession(sessionId, cancelledBy) {
    const { data: session } = await this.supabase
      .from('vote_kick_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (session) {
      await this.supabase
        .from('vote_kick_sessions')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      const cacheKey = `${session.guild_id}:${session.target_user_id}`;
      this.activeSessions.delete(cacheKey);
    }
  }

  /**
   * Log vote kick to database
   */
  async logVoteKick(session, status, kicked) {
    try {
      // Get usernames (we'll need to fetch these from Discord or store them)
      await this.supabase
        .from('vote_kick_logs')
        .insert({
          guild_id: session.guild_id,
          channel_id: session.channel_id,
          target_user_id: session.target_user_id,
          target_username: 'Unknown', // Will be updated by command handler
          initiator_user_id: session.initiator_user_id,
          initiator_username: 'Unknown', // Will be updated by command handler
          votes_for: session.votes_for || 0,
          votes_against: session.votes_against || 0,
          total_voters: (session.voters || []).length,
          status: status,
          kicked: kicked
        });
    } catch (error) {
      console.error('Error logging vote kick:', error);
    }
  }

  /**
   * Clean up expired sessions (should be called periodically)
   */
  async cleanupExpiredSessions() {
    try {
      const { data: expiredSessions } = await this.supabase
        .from('vote_kick_sessions')
        .select('*')
        .eq('status', 'active')
        .lt('expires_at', new Date().toISOString());

      if (expiredSessions && expiredSessions.length > 0) {
        for (const session of expiredSessions) {
          await this.expireSession(session.id);
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Create vote kick embed
   */
  createVoteEmbed(session, targetMember, initiator, config) {
    const expiresAt = new Date(session.expires_at);
    const timeLeft = Math.max(0, Math.ceil((expiresAt - new Date()) / 1000));

    const embed = new EmbedBuilder()
      .setColor(0xFF6B6B)
      .setTitle('🗳️ Vote Kick')
      .setDescription(`Vote to kick **${targetMember.user.tag}** from the voice channel`)
      .addFields(
        {
          name: '👤 Target',
          value: `${targetMember.user.tag} (${targetMember.id})`,
          inline: true
        },
        {
          name: '🚀 Started by',
          value: `${initiator.tag}`,
          inline: true
        },
        {
          name: '⏱️ Time remaining',
          value: `${timeLeft}s`,
          inline: true
        },
        {
          name: '✅ Votes For',
          value: `${session.votes_for || 0}/${session.required_votes}`,
          inline: true
        },
        {
          name: '❌ Votes Against',
          value: `${session.votes_against || 0}`,
          inline: true
        },
        {
          name: '👥 Total Voters',
          value: `${(session.voters || []).length}`,
          inline: true
        }
      )
      .setFooter({ text: `Vote kick will pass with ${session.required_votes} votes` })
      .setTimestamp();

    return embed;
  }

  /**
   * Create vote buttons
   */
  createVoteButtons(sessionId) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`votekick_vote_${sessionId}_for`)
          .setLabel('Vote Kick')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`votekick_vote_${sessionId}_against`)
          .setLabel('Keep')
          .setStyle(ButtonStyle.Success)
          .setEmoji('❌')
      );
  }
}

module.exports = VoteKickManager;

