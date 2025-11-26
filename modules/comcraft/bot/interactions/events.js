/**
 * Event Management Interaction Handlers
 * Handles RSVP button interactions for events
 */

const { EmbedBuilder } = require('discord.js');
const EventManager = require('../../events/manager');

function createEventHandlers({ client, featureGate, eventManager }) {
  /**
   * Handle RSVP button interactions
   */
  async function handleRSVPInteraction(interaction) {
    if (!interaction.isButton()) return false;

    const customId = interaction.customId;
    if (!customId.startsWith('event_rsvp_')) return false;

    // Parse: event_rsvp_{eventId}_{status}
    const parts = customId.split('_');
    if (parts.length !== 4) return false;

    const eventId = parts[2];
    const status = parts[3]; // going, maybe, not_going

    if (!['going', 'maybe', 'not_going'].includes(status)) {
      return false;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const discordTag = interaction.user.tag;

      const result = await eventManager.rsvpToEvent(eventId, userId, discordTag, status);

      if (!result.success) {
        await interaction.editReply({
          content: `❌ ${result.error || 'Failed to RSVP'}`,
          ephemeral: true
        });
        return true;
      }

      // Get updated event with RSVPs
      const { data: event } = await eventManager.supabase
        .from('events')
        .select('*, event_rsvps(*)')
        .eq('id', eventId)
        .single();

      if (!event) {
        await interaction.editReply({
          content: '✅ RSVP updated!',
          ephemeral: true
        });
        return true;
      }

      // Get RSVP counts
      const rsvps = event.event_rsvps || [];
      const goingCount = rsvps.filter(r => r.status === 'going').length;
      const maybeCount = rsvps.filter(r => r.status === 'maybe').length;
      const notGoingCount = rsvps.filter(r => r.status === 'not_going').length;

      // Check if event is full
      let fullMessage = '';
      if (event.max_participants && status === 'going' && goingCount >= event.max_participants) {
        fullMessage = '\n\n⚠️ **Event is now full!**';
      }

      const statusEmoji = {
        going: '✅',
        maybe: '❓',
        not_going: '❌'
      };

      const statusText = {
        going: 'Going',
        maybe: 'Maybe',
        not_going: 'Not Going'
      };

      const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji[status]} RSVP Updated`)
        .setDescription(`You are now marked as **${statusText[status]}** for **${event.title}**${fullMessage}`)
        .addFields([
          {
            name: '📊 Current RSVPs',
            value: `✅ **${goingCount}** Going\n❓ **${maybeCount}** Maybe\n❌ **${notGoingCount}** Not Going`,
            inline: false
          }
        ])
        .setColor(status === 'going' ? 0x00FF00 : status === 'maybe' ? 0xFFA500 : 0xFF0000)
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });

      // Update the original message if possible
      try {
        const originalMessage = await interaction.message.fetch();
        if (originalMessage && originalMessage.editable) {
          // Update embed with new RSVP counts
          const originalEmbed = originalMessage.embeds[0];
          if (originalEmbed) {
            const updatedEmbed = EmbedBuilder.from(originalEmbed);
            
            // Find and update RSVP field if it exists
            const fields = updatedEmbed.data.fields || [];
            const rsvpFieldIndex = fields.findIndex(f => f.name === '📊 RSVPs');
            
            if (rsvpFieldIndex >= 0) {
              fields[rsvpFieldIndex] = {
                name: '📊 RSVPs',
                value: `✅ **${goingCount}** Going\n❓ **${maybeCount}** Maybe\n❌ **${notGoingCount}** Not Going`,
                inline: true
              };
            } else {
              // Add RSVP field if it doesn't exist
              fields.push({
                name: '📊 RSVPs',
                value: `✅ **${goingCount}** Going\n❓ **${maybeCount}** Maybe\n❌ **${notGoingCount}** Not Going`,
                inline: true
              });
            }
            
            updatedEmbed.setFields(fields);
            await originalMessage.edit({ embeds: [updatedEmbed] });
          }
        }
      } catch (error) {
        // Ignore errors updating original message
        console.log('[EventHandlers] Could not update original message:', error.message);
      }

      return true;
    } catch (error) {
      console.error('[EventHandlers] Error handling RSVP:', error);
      await interaction.editReply({
        content: '❌ An error occurred while processing your RSVP.',
        ephemeral: true
      }).catch(() => {});
      return true;
    }
  }

  return {
    handleRSVPInteraction
  };
}

module.exports = createEventHandlers;

