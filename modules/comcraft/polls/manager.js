const { createClient } = require('@supabase/supabase-js');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

class PollManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.schedulerHandle = null;
    this.realTimeUpdateHandles = new Map(); // Map of pollId -> interval handle
    this.activePollsCache = new Map(); // Cache for active polls being updated
  }

  startScheduler() {
    if (this.schedulerHandle) {
      clearInterval(this.schedulerHandle);
    }

    const run = async () => {
      try {
        await this.processExpiredPolls();
        await this.sendReminders();
        await this.processUnpostedPolls();
        await this.updateActivePollMessages();
      } catch (error) {
        console.error('Poll scheduler error:', error);
      }
    };

    // Run every minute to check for expired polls and reminders
    setTimeout(run, 30 * 1000);
    this.schedulerHandle = setInterval(run, 60 * 1000);

    // Start real-time updates for active polls (every 30 seconds)
    this.startRealTimeUpdates();
  }

  startRealTimeUpdates() {
    // Clear existing intervals
    for (const handle of this.realTimeUpdateHandles.values()) {
      clearInterval(handle);
    }
    this.realTimeUpdateHandles.clear();

    // Set up interval to update active polls
    setInterval(async () => {
      try {
        await this.updateActivePollMessages();
      } catch (error) {
        console.error('Error in real-time poll updates:', error);
      }
    }, 30 * 1000); // Every 30 seconds
  }

  async updateActivePollMessages() {
    try {
      const { data: activePolls } = await this.supabase
        .from('polls')
        .select('id')
        .eq('status', 'active')
        .not('message_id', 'is', null)
        .limit(50);

      if (!activePolls || activePolls.length === 0) {
        return;
      }

      // Update each active poll's message
      for (const poll of activePolls) {
        try {
          await this.updatePollMessage(poll.id, false);
        } catch (error) {
          // Silently fail for individual polls to not break others
          console.error(`Failed to update poll ${poll.id}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error updating active poll messages:', error);
    }
  }

  stopScheduler() {
    if (this.schedulerHandle) {
      clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
  }

  async processExpiredPolls() {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('polls')
      .select('*')
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lte('expires_at', now)
      .limit(25);

    if (error) {
      console.error('Error fetching expired polls:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    for (const poll of data) {
      try {
        await this.closePoll(poll.id, null, true);
      } catch (error) {
        console.error(`Failed to close expired poll ${poll.id}:`, error);
      }
    }
  }

  async sendReminders() {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('polls')
      .select('*')
      .eq('status', 'active')
      .eq('reminder_enabled', true)
      .eq('reminder_sent', false)
      .not('expires_at', 'is', null)
      .lte('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString()) // 1 hour before expiry
      .limit(25);

    if (error || !data || data.length === 0) {
      return;
    }

    for (const poll of data) {
      try {
        await this.sendPollReminder(poll);
        await this.supabase
          .from('polls')
          .update({ reminder_sent: true })
          .eq('id', poll.id);
      } catch (error) {
        console.error(`Failed to send reminder for poll ${poll.id}:`, error);
      }
    }
  }

  async sendPollReminder(poll) {
    try {
      const guild = this.client.guilds.cache.get(poll.guild_id);
      if (!guild) return;

      const channel = guild.channels.cache.get(poll.channel_id);
      if (!channel || !channel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setTitle('⏰ Poll Ending Soon!')
        .setDescription(`**${poll.title}**\n\nThis poll will end in less than 1 hour. Don't forget to vote!`)
        .setColor(0xFFA500)
        .setTimestamp(new Date(poll.expires_at));

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending poll reminder:', error);
    }
  }

  async createPoll(guildId, channelId, userId, pollData) {
    try {
      const { title, description, pollType, votingType, options, expiresAt, allowChangeVote, requireRoles, weightedVoting, reminderEnabled, maxVotes } = pollData;

      // Create poll
      const { data: poll, error: pollError } = await this.supabase
        .from('polls')
        .insert({
          guild_id: guildId,
          created_by: userId,
          title,
          description: description || null,
          channel_id: channelId,
          poll_type: pollType || 'single',
          voting_type: votingType || 'public',
          allow_change_vote: allowChangeVote !== false,
          max_votes: maxVotes || 1,
          expires_at: expiresAt || null,
          require_roles: requireRoles || [],
          weighted_voting: weightedVoting || {},
          reminder_enabled: reminderEnabled || false,
          status: 'active'
        })
        .select()
        .single();

      if (pollError || !poll) {
        throw new Error(pollError?.message || 'Failed to create poll');
      }

      // Create poll options
      const optionRecords = options.map((opt, index) => ({
        poll_id: poll.id,
        option_text: opt.text,
        emoji: opt.emoji || null,
        option_order: index,
        vote_count: 0
      }));

      const { error: optionsError } = await this.supabase
        .from('poll_options')
        .insert(optionRecords);

      if (optionsError) {
        // Rollback poll creation
        await this.supabase.from('polls').delete().eq('id', poll.id);
        throw new Error(optionsError.message);
      }

      return poll;
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }

  async getPoll(pollId) {
    const { data: poll, error } = await this.supabase
      .from('polls')
      .select(`
        *,
        poll_options(*)
      `)
      .eq('id', pollId)
      .single();

    if (error || !poll) {
      return null;
    }

    // Sort options by order
    poll.poll_options = poll.poll_options.sort((a, b) => a.option_order - b.option_order);

    return poll;
  }

  async getPollWithResults(pollId) {
    const poll = await this.getPoll(pollId);
    if (!poll) return null;

    // Get votes for public polls (for anonymous, we only show counts)
    if (poll.voting_type === 'public') {
      const { data: votes } = await this.supabase
        .from('poll_votes')
        .select('*')
        .eq('poll_id', pollId);

      poll.votes = votes || [];
    }

    return poll;
  }

  async checkUserCanVote(poll, userId, guild) {
    // Check role requirements
    if (poll.require_roles && poll.require_roles.length > 0) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        throw new Error('Could not find member in server');
      }

      const hasRequiredRole = poll.require_roles.some(roleId => 
        member.roles.cache.has(roleId)
      );

      if (!hasRequiredRole) {
        const roleNames = await Promise.all(
          poll.require_roles.map(async (roleId) => {
            const role = guild.roles.cache.get(roleId);
            return role ? role.name : `Role ${roleId}`;
          })
        );
        throw new Error(`You need one of these roles to vote: ${roleNames.join(', ')}`);
      }
    }

    return true;
  }

  async calculateVoteWeight(poll, userId, guild) {
    // Default weight is 1.0
    let weight = 1.0;

    // Check weighted voting
    if (poll.weighted_voting && typeof poll.weighted_voting === 'object') {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        // Check each role and find highest weight
        for (const [roleId, roleWeight] of Object.entries(poll.weighted_voting)) {
          if (member.roles.cache.has(roleId)) {
            const weightValue = typeof roleWeight === 'number' ? roleWeight : parseFloat(roleWeight) || 1.0;
            if (weightValue > weight) {
              weight = weightValue;
            }
          }
        }
      }
    }

    return weight;
  }

  async vote(pollId, userId, optionIds, guild = null) {
    try {
      const poll = await this.getPoll(pollId);
      if (!poll) {
        throw new Error('Poll not found');
      }

      if (poll.status !== 'active') {
        throw new Error('Poll is not active');
      }

      if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
        throw new Error('Poll has expired');
      }

      // Get guild if not provided
      if (!guild) {
        guild = this.client.guilds.cache.get(poll.guild_id);
        if (!guild) {
          throw new Error('Guild not found');
        }
      }

      // Check role requirements
      await this.checkUserCanVote(poll, userId, guild);

      // Calculate vote weight
      const voteWeight = await this.calculateVoteWeight(poll, userId, guild);

      // Check if user already voted
      const { data: existingVote } = await this.supabase
        .from('poll_votes')
        .select('*')
        .eq('poll_id', pollId)
        .eq('user_id', userId)
        .single();

      if (existingVote && !poll.allow_change_vote) {
        throw new Error('You have already voted and vote changes are not allowed');
      }

      // Validate option IDs
      const validOptionIds = poll.poll_options.map(opt => opt.id);
      const invalidOptions = optionIds.filter(id => !validOptionIds.includes(id));
      if (invalidOptions.length > 0) {
        throw new Error('Invalid option IDs');
      }

      // Check max votes
      if (optionIds.length > poll.max_votes) {
        throw new Error(`You can only vote for up to ${poll.max_votes} option(s)`);
      }

      // Delete existing vote if changing
      if (existingVote) {
        await this.supabase
          .from('poll_votes')
          .delete()
          .eq('poll_id', pollId)
          .eq('user_id', userId);
      }

      // Insert new vote with weight
      const { error } = await this.supabase
        .from('poll_votes')
        .insert({
          poll_id: pollId,
          user_id: userId,
          option_ids: optionIds,
          vote_weight: voteWeight // Store weight for weighted voting
        });

      if (error) {
        throw new Error(error.message);
      }

      // Update vote counts with weighted voting
      await this.updatePollCounts(pollId);

      return { success: true, changed: !!existingVote, weight: voteWeight };
    } catch (error) {
      console.error('Error voting:', error);
      throw error;
    }
  }

  async updatePollCounts(pollId) {
    const poll = await this.getPoll(pollId);
    if (!poll) return;

    // Get all votes with weights
    const { data: votes } = await this.supabase
      .from('poll_votes')
      .select('option_ids, vote_weight')
      .eq('poll_id', pollId);

    // Update option vote counts with weighted voting
    for (const option of poll.poll_options) {
      let weightedCount = 0;
      
      if (votes && votes.length > 0) {
        for (const vote of votes) {
          if (vote.option_ids && vote.option_ids.includes(option.id)) {
            const weight = vote.vote_weight || 1.0;
            weightedCount += weight;
          }
        }
      }

      // Round to 2 decimal places for display
      weightedCount = Math.round(weightedCount * 100) / 100;

      await this.supabase
        .from('poll_options')
        .update({ vote_count: weightedCount })
        .eq('id', option.id);
    }

    // Update total votes (unique voters)
    const uniqueVoters = new Set(votes?.map(v => v.user_id) || []).size;

    await this.supabase
      .from('polls')
      .update({ total_votes: uniqueVoters })
      .eq('id', pollId);
  }

  async closePoll(pollId, closedBy, automated = false) {
    try {
      const poll = await this.getPollWithResults(pollId);
      if (!poll) {
        throw new Error('Poll not found');
      }

      if (poll.status === 'closed') {
        return poll;
      }

      // Update poll status
      const { error } = await this.supabase
        .from('polls')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: closedBy || null
        })
        .eq('id', pollId);

      if (error) {
        throw new Error(error.message);
      }

      // Update message if it exists
      if (poll.message_id) {
        await this.updatePollMessage(pollId, true);
      }

      return await this.getPollWithResults(pollId);
    } catch (error) {
      console.error('Error closing poll:', error);
      throw error;
    }
  }

  async buildPollEmbed(poll, showResults = false) {
    const pollData = showResults ? await this.getPollWithResults(poll.id || poll) : (poll.id ? poll : await this.getPoll(poll));
    if (!pollData) return null;

    const embed = new EmbedBuilder()
      .setTitle(pollData.title)
      .setColor(showResults ? 0x00FF00 : 0x5865F2);

    if (pollData.description) {
      embed.setDescription(pollData.description);
    }

    // Calculate total weighted votes for percentage calculation
    const totalWeightedVotes = pollData.poll_options.reduce((sum, opt) => sum + (parseFloat(opt.vote_count) || 0), 0);

    // Build options display
    const optionsText = pollData.poll_options.map((opt, index) => {
      const voteCount = parseFloat(opt.vote_count) || 0;
      const percentage = totalWeightedVotes > 0 
        ? ((voteCount / totalWeightedVotes) * 100).toFixed(1)
        : 0;
      
      const barLength = showResults ? Math.floor((voteCount / (totalWeightedVotes || 1)) * 20) : 0;
      const bar = showResults ? '█'.repeat(barLength) + '░'.repeat(20 - barLength) : '';
      
      const emoji = opt.emoji ? `${opt.emoji} ` : '';
      // Show weighted count if different from integer
      const countDisplay = showResults 
        ? voteCount % 1 === 0 
          ? ` **${voteCount}** (${percentage}%)` 
          : ` **${voteCount.toFixed(2)}** (${percentage}%)`
        : '';
      const progress = showResults ? `\n${bar}` : '';
      
      return `${emoji}**${String.fromCharCode(65 + index)}.** ${opt.option_text}${countDisplay}${progress}`;
    }).join('\n\n');

    embed.addFields({
      name: showResults ? '📊 Results' : '📝 Options',
      value: optionsText || 'No options available',
      inline: false
    });

    // Add role requirements info if present
    if (pollData.require_roles && pollData.require_roles.length > 0 && !showResults) {
      const guild = this.client.guilds.cache.get(pollData.guild_id);
      if (guild) {
        const roleNames = pollData.require_roles
          .map(roleId => {
            const role = guild.roles.cache.get(roleId);
            return role ? role.name : null;
          })
          .filter(Boolean);
        
        if (roleNames.length > 0) {
          embed.addFields({
            name: '🔒 Required Roles',
            value: roleNames.join(', '),
            inline: true
          });
        }
      }
    }

    // Footer info
    const footerParts = [];
    footerParts.push(`Total Voters: ${pollData.total_votes || 0}`);
    footerParts.push(`Type: ${pollData.poll_type === 'multiple' ? 'Multiple Choice' : 'Single Choice'}`);
    if (pollData.voting_type === 'anonymous') {
      footerParts.push('Anonymous');
    }
    if (pollData.weighted_voting && Object.keys(pollData.weighted_voting).length > 0) {
      footerParts.push('Weighted');
    }
    
    embed.setFooter({ text: footerParts.join(' • ') });

    // Expiry timestamp
    if (pollData.expires_at && pollData.status === 'active') {
      embed.setTimestamp(new Date(pollData.expires_at));
    } else if (pollData.closed_at) {
      embed.setTimestamp(new Date(pollData.closed_at));
    }

    return embed;
  }

  async createPollMessage(pollId) {
    try {
      const poll = await this.getPoll(pollId);
      if (!poll) {
        throw new Error('Poll not found');
      }

      const guild = this.client.guilds.cache.get(poll.guild_id);
      if (!guild) {
        throw new Error('Guild not found');
      }

      const channel = guild.channels.cache.get(poll.channel_id);
      if (!channel || !channel.isTextBased()) {
        throw new Error('Channel not found or invalid');
      }

      const embed = await this.buildPollEmbed(poll, false);
      if (!embed) {
        throw new Error('Failed to build poll embed');
      }

      // Create voting buttons
      const rows = this.createVotingButtons(poll);

      const message = await channel.send({
        embeds: [embed],
        components: rows
      });

      // Update poll with message ID
      await this.supabase
        .from('polls')
        .update({ message_id: message.id })
        .eq('id', pollId);

      // Add reaction emojis if using reaction-based voting
      if (poll.poll_options.length <= 10) {
        for (const option of poll.poll_options) {
          const emoji = option.emoji || String.fromCharCode(127462 + option.option_order); // A, B, C, etc.
          try {
            await message.react(emoji);
          } catch (error) {
            console.error('Error adding reaction:', error);
          }
        }
      }

      return message;
    } catch (error) {
      console.error('Error creating poll message:', error);
      throw error;
    }
  }

  createVotingButtons(poll) {
    const rows = [];
    const options = poll.poll_options || [];
    
    // Max 5 buttons per row, max 5 rows (25 buttons total)
    const maxButtons = 25;
    const buttonsPerRow = 5;
    
    for (let i = 0; i < Math.min(options.length, maxButtons); i += buttonsPerRow) {
      const row = new ActionRowBuilder();
      
      for (let j = i; j < Math.min(i + buttonsPerRow, options.length, maxButtons); j++) {
        const option = options[j];
        const label = option.option_text.length > 80 
          ? option.option_text.substring(0, 77) + '...' 
          : option.option_text;
        
        const button = new ButtonBuilder()
          .setCustomId(`poll_vote_${poll.id}_${option.id}`)
          .setLabel(label)
          .setStyle(ButtonStyle.Secondary);
        
        if (option.emoji) {
          button.setEmoji(option.emoji);
        }
        
        row.addComponents(button);
      }
      
      rows.push(row);
    }

    // Add control buttons
    const controlRow = new ActionRowBuilder();
    controlRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_results_${poll.id}`)
        .setLabel('View Results')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`poll_info_${poll.id}`)
        .setLabel('Info')
        .setStyle(ButtonStyle.Secondary)
    );

    if (poll.status === 'active') {
      controlRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_close_${poll.id}`)
          .setLabel('Close Poll')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true) // Only admins can close via command
      );
    }

    rows.push(controlRow);

    return rows;
  }

  async updatePollMessage(pollId, showResults = false) {
    try {
      const poll = await this.getPoll(pollId);
      if (!poll || !poll.message_id) {
        return;
      }

      const guild = this.client.guilds.cache.get(poll.guild_id);
      if (!guild) {
        return;
      }

      const channel = guild.channels.cache.get(poll.channel_id);
      if (!channel || !channel.isTextBased()) {
        return;
      }

      try {
        const message = await channel.messages.fetch(poll.message_id);
        const embed = await this.buildPollEmbed(poll, showResults || poll.status === 'closed');
        
        const components = showResults || poll.status === 'closed' 
          ? [] // Remove buttons when showing results or closed
          : this.createVotingButtons(poll);

        await message.edit({
          embeds: [embed],
          components: components
        });
      } catch (error) {
        if (error.code === 10008) {
          // Message not found, ignore
          console.log(`Poll message ${poll.message_id} not found, skipping update`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error updating poll message:', error);
    }
  }

  async getActivePolls(guildId, limit = 50) {
    const { data, error } = await this.supabase
      .from('polls')
      .select(`
        *,
        poll_options(*)
      `)
      .eq('guild_id', guildId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching active polls:', error);
      return [];
    }

    return data || [];
  }

  async getUserPolls(guildId, userId, limit = 50) {
    const { data, error } = await this.supabase
      .from('polls')
      .select(`
        *,
        poll_options(*)
      `)
      .eq('guild_id', guildId)
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user polls:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Process polls that don't have a message_id yet (created via dashboard)
   */
  async processUnpostedPolls() {
    try {
      const { data: polls, error } = await this.supabase
        .from('polls')
        .select(`
          *,
          poll_options(*)
        `)
        .eq('status', 'active')
        .is('message_id', null)
        .limit(10);

      if (error || !polls || polls.length === 0) {
        return;
      }

      for (const poll of polls) {
        try {
          // Sort options
          poll.poll_options = poll.poll_options.sort((a, b) => a.option_order - b.option_order);
          
          // Create poll message
          await this.createPollMessage(poll.id);
          console.log(`✅ Posted poll ${poll.id} to Discord`);
        } catch (error) {
          console.error(`Failed to post poll ${poll.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing unposted polls:', error);
    }
  }

  /**
   * Export poll results to CSV format
   */
  async exportPollResultsCSV(pollId) {
    const poll = await this.getPollWithResults(pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    const lines = [];
    lines.push(`Poll: ${poll.title}`);
    lines.push(`Status: ${poll.status}`);
    lines.push(`Total Voters: ${poll.total_votes || 0}`);
    lines.push(`Created: ${poll.created_at}`);
    lines.push('');
    lines.push('Option, Votes, Percentage');

    const totalWeightedVotes = poll.poll_options.reduce((sum, opt) => sum + (parseFloat(opt.vote_count) || 0), 0);

    for (const option of poll.poll_options) {
      const voteCount = parseFloat(option.vote_count) || 0;
      const percentage = totalWeightedVotes > 0 
        ? ((voteCount / totalWeightedVotes) * 100).toFixed(2)
        : '0.00';
      
      lines.push(`"${option.option_text}",${voteCount},${percentage}%`);
    }

    if (poll.voting_type === 'public' && poll.votes) {
      lines.push('');
      lines.push('Voter ID, Options Voted, Vote Weight');
      for (const vote of poll.votes) {
        const optionTexts = vote.option_ids
          .map(optId => {
            const opt = poll.poll_options.find(o => o.id === optId);
            return opt ? opt.option_text : 'Unknown';
          })
          .join('; ');
        
        lines.push(`${vote.user_id},"${optionTexts}",${vote.vote_weight || 1.0}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export poll results to JSON format
   */
  async exportPollResultsJSON(pollId) {
    const poll = await this.getPollWithResults(pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    const totalWeightedVotes = poll.poll_options.reduce((sum, opt) => sum + (parseFloat(opt.vote_count) || 0), 0);

    const exportData = {
      poll: {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        status: poll.status,
        poll_type: poll.poll_type,
        voting_type: poll.voting_type,
        total_voters: poll.total_votes || 0,
        total_weighted_votes: totalWeightedVotes,
        created_at: poll.created_at,
        expires_at: poll.expires_at,
        closed_at: poll.closed_at
      },
      options: poll.poll_options.map(opt => {
        const voteCount = parseFloat(opt.vote_count) || 0;
        const percentage = totalWeightedVotes > 0 
          ? (voteCount / totalWeightedVotes) * 100
          : 0;

        return {
          id: opt.id,
          text: opt.option_text,
          emoji: opt.emoji,
          votes: voteCount,
          percentage: parseFloat(percentage.toFixed(2)),
          order: opt.option_order
        };
      })
    };

    if (poll.voting_type === 'public' && poll.votes) {
      exportData.votes = poll.votes.map(vote => ({
        user_id: vote.user_id,
        option_ids: vote.option_ids,
        vote_weight: vote.vote_weight || 1.0,
        voted_at: vote.voted_at
      }));
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Get poll templates for a guild
   */
  async getPollTemplates(guildId, limit = 50) {
    const { data, error } = await this.supabase
      .from('poll_templates')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching poll templates:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create a poll from a template
   */
  async createPollFromTemplate(templateId, guildId, channelId, userId) {
    const { data: template, error } = await this.supabase
      .from('poll_templates')
      .select('*')
      .eq('id', templateId)
      .eq('guild_id', guildId)
      .single();

    if (error || !template) {
      throw new Error('Template not found');
    }

    const options = template.default_options.map((text, index) => ({
      text,
      emoji: null,
      order: index
    }));

    return await this.createPoll(guildId, channelId, userId, {
      title: template.title,
      description: template.description_text,
      pollType: template.poll_type,
      votingType: template.voting_type,
      options,
      requireRoles: template.require_roles || [],
      weightedVoting: template.weighted_voting || {},
      allowChangeVote: true,
      maxVotes: template.poll_type === 'multiple' ? options.length : 1
    });
  }

  /**
   * Save a poll as a template
   */
  async savePollAsTemplate(pollId, name, description = null) {
    const poll = await this.getPoll(pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    const { data: template, error } = await this.supabase
      .from('poll_templates')
      .insert({
        guild_id: poll.guild_id,
        created_by: poll.created_by,
        name,
        description,
        title: poll.title,
        description_text: poll.description,
        poll_type: poll.poll_type,
        voting_type: poll.voting_type,
        default_options: poll.poll_options.map(opt => opt.option_text),
        require_roles: poll.require_roles || [],
        weighted_voting: poll.weighted_voting || {}
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return template;
  }

  /**
   * Get poll analytics for a guild
   */
  async getPollAnalytics(guildId, startDate = null, endDate = null) {
    let query = this.supabase
      .from('polls')
      .select(`
        *,
        poll_options(*)
      `)
      .eq('guild_id', guildId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: polls, error } = await query;

    if (error) {
      console.error('Error fetching poll analytics:', error);
      return null;
    }

    const analytics = {
      total_polls: polls?.length || 0,
      active_polls: polls?.filter(p => p.status === 'active').length || 0,
      closed_polls: polls?.filter(p => p.status === 'closed').length || 0,
      total_votes: polls?.reduce((sum, p) => sum + (p.total_votes || 0), 0) || 0,
      average_votes_per_poll: 0,
      most_popular_polls: [],
      polls_by_type: {
        single: polls?.filter(p => p.poll_type === 'single').length || 0,
        multiple: polls?.filter(p => p.poll_type === 'multiple').length || 0
      },
      polls_by_voting_type: {
        public: polls?.filter(p => p.voting_type === 'public').length || 0,
        anonymous: polls?.filter(p => p.voting_type === 'anonymous').length || 0
      }
    };

    if (analytics.total_polls > 0) {
      analytics.average_votes_per_poll = (analytics.total_votes / analytics.total_polls).toFixed(2);
      
      // Get most popular polls (top 5 by votes)
      analytics.most_popular_polls = polls
        .sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0))
        .slice(0, 5)
        .map(p => ({
          id: p.id,
          title: p.title,
          votes: p.total_votes || 0
        }));
    }

    return analytics;
  }
}

module.exports = PollManager;

