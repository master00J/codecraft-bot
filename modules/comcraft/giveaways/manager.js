const { createClient } = require('@supabase/supabase-js');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const FeatureGate = require('../feature-gate');
const configManager = require('../config-manager');

const GIVEAWAY_BUTTON_LABEL = '🎉 Join';
const GIVEAWAY_FEATURE = 'giveaways';

function formatTimestamp(date) {
  return Math.floor(date.getTime() / 1000);
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

class GiveawayManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.featureGate = new FeatureGate(configManager);
    this.schedulerHandle = null;
  }

  startScheduler() {
    if (this.schedulerHandle) {
      clearInterval(this.schedulerHandle);
    }

    const run = async () => {
      try {
        await this.processDueGiveaways();
      } catch (error) {
        console.error('Giveaway scheduler error:', error);
      }
    };

    // Initial run with slight delay to allow cache warm-up
    setTimeout(run, 15 * 1000);
    this.schedulerHandle = setInterval(run, 30 * 1000);
  }

  stopScheduler() {
    if (this.schedulerHandle) {
      clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
  }

  async processDueGiveaways() {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('giveaways')
      .select('*')
      .eq('ended', false)
      .lte('ends_at', now)
      .limit(25);

    if (error) {
      console.error('Error fetching due giveaways:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    for (const giveaway of data) {
      try {
        const hasFeature = await configManager.hasFeature(giveaway.guild_id, GIVEAWAY_FEATURE);
        if (!hasFeature) {
          // Feature disabled; mark as ended without announcing winners
          await this.supabase
            .from('giveaways')
            .update({ ended: true, winners: [] })
            .eq('id', giveaway.id);
          continue;
        }

        await this.endGiveaway(giveaway.id, { automated: true });
      } catch (error) {
        console.error(`Failed to process giveaway ${giveaway.id}:`, error);
      }
    }
  }

  buildActiveEmbed(giveaway, entryCount) {
    const endsAt = new Date(giveaway.ends_at);
    const hostMention = giveaway.host_id ? `<@${giveaway.host_id}>` : 'unknown';

    const color = typeof giveaway.embed_color === 'string' && /^#?[0-9a-f]{6}$/i.test(giveaway.embed_color.trim())
      ? giveaway.embed_color.trim().startsWith('#') ? giveaway.embed_color.trim() : `#${giveaway.embed_color.trim()}`
      : '#FACC15';

    const defaultLines = [
      `Hosted by ${hostMention}`,
      `Winners: **${giveaway.winner_count}**`,
      `Participants: **${entryCount}**`,
      `Ends: <t:${formatTimestamp(endsAt)}:R>`
    ];

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(giveaway.embed_title?.trim() || `🎉 Giveaway: ${giveaway.prize}`)
      .setDescription(giveaway.embed_description?.trim() || defaultLines.join('\n'))
      .setTimestamp(new Date(giveaway.created_at || Date.now()))
      .setFooter({ text: giveaway.embed_footer?.trim() || 'Click the button below to enter!' });

    if (giveaway.embed_image_url) {
      embed.setImage(giveaway.embed_image_url);
    }

    if (giveaway.embed_thumbnail_url) {
      embed.setThumbnail(giveaway.embed_thumbnail_url);
    }

    return embed;
  }

  buildEndedEmbed(giveaway, winners, entryCount) {
    const endsAt = new Date(giveaway.ends_at);
    const hostMention = giveaway.host_id ? `<@${giveaway.host_id}>` : 'unknown';

    const winnersText = winners.length > 0
      ? winners.map((id) => `<@${id}>`).join('\n')
      : 'No winners — not enough participants.';

    const color = typeof giveaway.embed_color === 'string' && /^#?[0-9a-f]{6}$/i.test(giveaway.embed_color.trim())
      ? giveaway.embed_color.trim().startsWith('#') ? giveaway.embed_color.trim() : `#${giveaway.embed_color.trim()}`
      : '#22C55E';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(giveaway.embed_title?.trim() || `🏁 Giveaway ended: ${giveaway.prize}`)
      .setDescription(giveaway.embed_description?.trim() || winnersText)
      .addFields(
        { name: 'Prize', value: giveaway.prize, inline: true },
        { name: 'Winners', value: winners.length.toString(), inline: true },
        { name: 'Participants', value: entryCount.toString(), inline: true }
      )
      .setFooter({
        text: giveaway.embed_footer?.trim()
          || `Hosted by ${hostMention.replace('<@', '').replace('>', '')} | Ended on ${endsAt.toLocaleString('en-GB')}`
      })
      .setTimestamp(new Date());

    if (giveaway.embed_image_url) {
      embed.setImage(giveaway.embed_image_url);
    }

    if (giveaway.embed_thumbnail_url) {
      embed.setThumbnail(giveaway.embed_thumbnail_url);
    }

    return embed;
  }

  buildJoinRow(giveawayId, giveaway, disabled = false) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_join_${giveawayId}`)
        .setLabel(giveaway?.join_button_label || GIVEAWAY_BUTTON_LABEL)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    );

    if (!disabled && giveaway?.cta_button_label && giveaway?.cta_button_url) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel(giveaway.cta_button_label)
          .setStyle(ButtonStyle.Link)
          .setURL(giveaway.cta_button_url)
      );
    }

    return row;
  }

  async fetchMessage(giveaway) {
    try {
      const channel = await this.client.channels.fetch(giveaway.channel_id);
      if (!channel || !channel.isTextBased()) {
        return null;
      }
      const message = await channel.messages.fetch(giveaway.message_id);
      return { channel, message };
    } catch (error) {
      console.warn(`Giveaway message not accessible (${giveaway.id}):`, error.message);
      return null;
    }
  }

  async createGiveaway(options) {
    const {
      guild,
      channel,
      host,
      hostName,
      prize,
      durationMinutes,
      winnerCount,
      requiredRoleId,
      embed = {},
      rewards = {}
    } = options;

    const hasFeature = await this.featureGate.checkFeature(guild.id, GIVEAWAY_FEATURE);
    if (!hasFeature) {
      return { success: false, error: 'Giveaways are not enabled for this license.' };
    }

    const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const draftGiveaway = {
      prize,
      winner_count: winnerCount,
      guild_id: guild.id,
      channel_id: channel.id,
      host_id: host.id,
      host_name: hostName || host.displayName || host.user?.tag || host.user?.username || 'unknown',
      required_role_id: requiredRoleId || null,
      embed_title: typeof embed.title === 'string' && embed.title.trim().length > 0 ? embed.title.trim() : null,
      embed_description: typeof embed.description === 'string' && embed.description.trim().length > 0 ? embed.description.trim() : null,
      embed_color: typeof embed.color === 'string' ? embed.color : null,
      embed_footer: typeof embed.footer === 'string' && embed.footer.trim().length > 0 ? embed.footer.trim() : null,
      embed_image_url: typeof embed.imageUrl === 'string' && embed.imageUrl.trim().length > 0 ? embed.imageUrl.trim() : null,
      embed_thumbnail_url: typeof embed.thumbnailUrl === 'string' && embed.thumbnailUrl.trim().length > 0 ? embed.thumbnailUrl.trim() : null,
      join_button_label: typeof embed.joinButtonLabel === 'string' && embed.joinButtonLabel.trim().length > 0 ? embed.joinButtonLabel.trim() : null,
      cta_button_label: typeof embed.linkLabel === 'string' && embed.linkLabel.trim().length > 0 ? embed.linkLabel.trim() : null,
      cta_button_url: typeof embed.linkUrl === 'string' && embed.linkUrl.trim().length > 0 ? embed.linkUrl.trim() : null,
      reward_role_id: typeof rewards.roleId === 'string' && rewards.roleId.trim().length > 0 ? rewards.roleId.trim() : null,
      reward_role_remove_after: Number.isFinite(rewards.roleRemoveAfter) ? Number(rewards.roleRemoveAfter) : null,
      reward_dm_message: typeof rewards.dmMessage === 'string' && rewards.dmMessage.trim().length > 0 ? rewards.dmMessage.trim() : null,
      reward_channel_id: typeof rewards.channelId === 'string' && rewards.channelId.trim().length > 0 ? rewards.channelId.trim() : null,
      reward_channel_message: typeof rewards.channelMessage === 'string' && rewards.channelMessage.trim().length > 0 ? rewards.channelMessage.trim() : null,
      entries: [],
      winners: [],
      ends_at: endsAt.toISOString(),
      created_at: new Date().toISOString()
    };

    const activeEmbed = this.buildActiveEmbed(draftGiveaway, 0);
    const row = this.buildJoinRow('preview', draftGiveaway);

    let message;
    try {
      message = await channel.send({ embeds: [activeEmbed], components: [row] });
    } catch (error) {
      console.error('Failed to send giveaway message:', error);
      return { success: false, error: 'Failed to post giveaway message.' };
    }

    const { data, error } = await this.supabase
      .from('giveaways')
      .insert({
        guild_id: guild.id,
        channel_id: channel.id,
        message_id: message.id,
        prize,
        winner_count: winnerCount,
        host_id: host.id,
        host_name: draftGiveaway.host_name,
        required_role_id: requiredRoleId || null,
        embed_title: draftGiveaway.embed_title,
        embed_description: draftGiveaway.embed_description,
        embed_color: draftGiveaway.embed_color,
        embed_footer: draftGiveaway.embed_footer,
        embed_image_url: draftGiveaway.embed_image_url,
        embed_thumbnail_url: draftGiveaway.embed_thumbnail_url,
        join_button_label: draftGiveaway.join_button_label,
        cta_button_label: draftGiveaway.cta_button_label,
        cta_button_url: draftGiveaway.cta_button_url,
        reward_role_id: draftGiveaway.reward_role_id,
        reward_role_remove_after: draftGiveaway.reward_role_remove_after,
        reward_dm_message: draftGiveaway.reward_dm_message,
        reward_channel_id: draftGiveaway.reward_channel_id,
        reward_channel_message: draftGiveaway.reward_channel_message,
        entries: [],
        winners: [],
        ends_at: endsAt.toISOString()
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating giveaway in database:', error);
      await message.delete().catch(() => {});
      return { success: false, error: 'Database error while saving the giveaway.' };
    }

    const updatedEmbed = this.buildActiveEmbed(data, 0);
    const updatedRow = this.buildJoinRow(data.id, data);
    await message.edit({ embeds: [updatedEmbed], components: [updatedRow] }).catch(() => {});

    return { success: true, giveaway: data };
  }

  async toggleEntry(giveawayId, member) {
    const { data: giveaway, error } = await this.supabase
      .from('giveaways')
      .select('*')
      .eq('id', giveawayId)
      .single();

    if (error || !giveaway) {
      return { success: false, message: 'This giveaway no longer exists.' };
    }

    if (giveaway.ended) {
      return { success: false, message: 'This giveaway has already ended.' };
    }

    if (giveaway.required_role_id && !member.roles.cache.has(giveaway.required_role_id)) {
      return { success: false, message: 'You are missing the required role to join this giveaway.' };
    }

    const entries = Array.isArray(giveaway.entries) ? [...giveaway.entries] : [];
    const alreadyJoined = entries.includes(member.id);

    if (alreadyJoined) {
      const filtered = entries.filter((id) => id !== member.id);
      await this.supabase
        .from('giveaways')
        .update({ entries: filtered })
        .eq('id', giveawayId);

      giveaway.entries = filtered;
      await this.updateActiveMessage(giveaway).catch(() => {});
      return { success: true, message: 'Your entry has been removed.', joined: false };
    }

    entries.push(member.id);
    await this.supabase
      .from('giveaways')
      .update({ entries })
      .eq('id', giveawayId);

    giveaway.entries = entries;
    await this.updateActiveMessage(giveaway).catch(() => {});

    // Track quest progress (giveaway_enter quest type)
    if (global.questManager && member.guild) {
      try {
        if (await global.questManager.isTracking(member.guild.id, 'giveaway_enter')) {
          await global.questManager.updateProgress(member.guild.id, member.id, 'giveaway_enter', {
            increment: 1
          });
        }
      } catch (error) {
        console.error('[Giveaway] Error tracking giveaway_enter quest:', error.message);
      }
    }

    return { success: true, message: 'You are now entered in this giveaway! 🎉', joined: true };
  }

  async updateActiveMessage(giveaway) {
    const fetched = await this.fetchMessage(giveaway);
    if (!fetched) return;

    const { message } = fetched;
    const embed = this.buildActiveEmbed(giveaway, giveaway.entries?.length || 0);
    const row = this.buildJoinRow(giveaway.id, giveaway);
    await message.edit({ embeds: [embed], components: [row] });
  }

  async endGiveaway(giveawayId, options = {}) {
    const { force = false, automated = false, reroll = false } = options;

    const { data: giveaway, error } = await this.supabase
      .from('giveaways')
      .select('*')
      .eq('id', giveawayId)
      .single();

    if (error || !giveaway) {
      return { success: false, error: 'Giveaway not found.' };
    }

    if (giveaway.ended && !force) {
      return { success: false, error: 'Giveaway has already finished.' };
    }

    const entries = Array.isArray(giveaway.entries) ? [...new Set(giveaway.entries)] : [];
    let winners = [];

    if (entries.length > 0) {
      const shuffled = shuffleArray(entries);
      winners = shuffled.slice(0, giveaway.winner_count);
    }

    const updatePayload = {
      ended: true,
      winners
    };

    const { error: updateError, data: updatedGiveaway } = await this.supabase
      .from('giveaways')
      .update(updatePayload)
      .eq('id', giveawayId)
      .select()
      .single();

    if (updateError || !updatedGiveaway) {
      console.error('Failed to update giveaway status:', updateError);
      return { success: false, error: 'Failed to update the giveaway.' };
    }

    const entryCount = entries.length;
    const fetched = await this.fetchMessage(updatedGiveaway);

    if (fetched) {
      const row = this.buildJoinRow(giveawayId, updatedGiveaway, true);
      const embed = this.buildEndedEmbed(updatedGiveaway, winners, entryCount);
      await fetched.message.edit({ embeds: [embed], components: [row] }).catch((err) => {
        console.warn('Failed to edit giveaway message on end:', err.message);
      });

      if (!automated) {
        await fetched.channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    await this.notifyWinners(updatedGiveaway, winners).catch(() => {});
    await this.applyRewards(updatedGiveaway, winners).catch(() => {});

    return { success: true, winners };
  }

  async rerollGiveaway(giveawayId) {
    const { data: giveaway, error } = await this.supabase
      .from('giveaways')
      .select('*')
      .eq('id', giveawayId)
      .single();

    if (error || !giveaway) {
      return { success: false, error: 'Giveaway not found.' };
    }

    if (!giveaway.ended) {
      return { success: false, error: 'You can only reroll after the giveaway has ended.' };
    }

    return this.endGiveaway(giveawayId, { force: true, reroll: true });
  }

  async notifyWinners(giveaway, winners) {
    if (!winners || winners.length === 0) {
      return;
    }

    let guildName = 'your server';
    let guild;
    try {
      guild = await this.client.guilds.fetch(giveaway.guild_id);
      if (guild) {
        guildName = guild.name;
      }
    } catch (error) {
      console.warn(`Could not fetch guild ${giveaway.guild_id} for winner notification:`, error.message);
    }

    const giveawayUrl = giveaway.channel_id && giveaway.message_id
      ? `https://discord.com/channels/${giveaway.guild_id}/${giveaway.channel_id}/${giveaway.message_id}`
      : null;

    for (const winnerId of winners) {
      try {
        const user = await this.client.users.fetch(winnerId);
        if (!user) continue;

        const lines = [];
        if (typeof giveaway.reward_dm_message === 'string' && giveaway.reward_dm_message.trim().length > 0) {
          lines.push(giveaway.reward_dm_message.trim());
        }

        lines.push(`Prize: **${giveaway.prize}**`);

        if (giveawayUrl) {
          lines.push(`[Open giveaway](${giveawayUrl})`);
        }

        const embed = new EmbedBuilder()
          .setColor('#22C55E')
          .setTitle(`🎉 You won a giveaway in ${guildName}!`)
          .setDescription(lines.join('\n\n'))
          .addFields({ name: 'Server', value: guildName, inline: true })
          .setFooter({ text: 'Congratulations from the server team!' })
          .setTimestamp(new Date());

        const components = [];
        if (giveawayUrl) {
          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Open giveaway message')
              .setStyle(ButtonStyle.Link)
              .setURL(giveawayUrl)
          );
          components.push(buttonRow);
        }

        await user.send({ embeds: [embed], components }).catch(() => {});
      } catch (error) {
        console.warn(`Could not DM winner ${winnerId}:`, error.message);
      }
    }
  }

  async applyRewards(giveaway, winners) {
    if (!winners || winners.length === 0) {
      return;
    }

    let guild = null;
    try {
      guild = await this.client.guilds.fetch(giveaway.guild_id);
    } catch (error) {
      console.warn(`Could not fetch guild ${giveaway.guild_id} for rewards:`, error.message);
      return;
    }

    if (giveaway.reward_role_id) {
      const role = await guild.roles.fetch(giveaway.reward_role_id).catch(() => null);

      if (!role) {
        console.warn(`Reward role ${giveaway.reward_role_id} not found in guild ${guild.id}`);
      } else {
        for (const winnerId of winners) {
          try {
            const member = await guild.members.fetch(winnerId).catch(() => null);
            if (!member) continue;

            await member.roles.add(role, 'Giveaway reward').catch((err) => {
              console.warn(`Failed to add reward role to ${winnerId}:`, err.message);
            });

            if (Number.isFinite(giveaway.reward_role_remove_after) && giveaway.reward_role_remove_after > 0) {
              const delay = giveaway.reward_role_remove_after * 60 * 1000;
              setTimeout(() => {
                member.roles.remove(role, 'Giveaway reward expired').catch(() => {});
              }, delay).unref?.();
            }
          } catch (error) {
            console.warn(`Reward assignment failed for ${winnerId}:`, error.message);
          }
        }
      }
    }

    if (giveaway.reward_channel_id && giveaway.reward_channel_message) {
      const channel = await guild.channels.fetch(giveaway.reward_channel_id).catch(() => null);
      if (channel?.isTextBased()) {
        const replacements = {
          '{winners}': winners.map((id) => `<@${id}>`).join(', '),
          '{prize}': giveaway.prize,
          '{guild}': guild.name || 'the server',
        };

        let message = giveaway.reward_channel_message;
        for (const [token, value] of Object.entries(replacements)) {
          message = message.replaceAll(token, value);
        }

        await channel.send(message).catch((error) => {
          console.warn('Failed to send reward channel message:', error.message);
        });
      } else {
        console.warn(`Reward channel ${giveaway.reward_channel_id} not accessible.`);
      }
    }
  }
}

module.exports = GiveawayManager;
