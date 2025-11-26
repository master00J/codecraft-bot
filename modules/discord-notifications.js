/**
 * Discord Notifications Module
 * Sends notifications from webapp events to Discord users
 */

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

class DiscordNotifier {
  constructor(client) {
    this.client = client;
    this.webappUrl = process.env.WEBAPP_API_URL || 'https://codecraft-solutions.com';
  }

  // ==================== ORDER NOTIFICATIONS ====================

  async notifyOrderCreated(discordId, orderData) {
    try {
      const user = await this.client.users.fetch(discordId);
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Order Created Successfully!')
        .setDescription(`Your order **${orderData.order_number}** has been submitted.`)
        .addFields(
          { name: 'Service', value: orderData.service_name || orderData.service_type, inline: true },
          { name: 'Budget', value: `€${orderData.price || 'TBD'}`, inline: true },
          { name: 'Status', value: orderData.status, inline: true }
        )
        .setFooter({ text: 'We\'ll review and send you a quote soon!' })
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('View Order')
            .setStyle(ButtonStyle.Link)
            .setURL(`${this.webappUrl}/dashboard/orders/${orderData.id}`)
            .setEmoji('📦')
        );

      await user.send({ embeds: [embed], components: [row] });
      return { success: true };
    } catch (error) {
      console.error('Error sending order notification:', error);
      return { success: false, error: error.message };
    }
  }

  async notifyQuoteSent(discordId, quoteData) {
    try {
      const user = await this.client.users.fetch(discordId);
      
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Quote Received!')
        .setDescription(`We've prepared a quote for order **${quoteData.order_number}**`)
        .addFields(
          { name: '💰 Price', value: `€${quoteData.price}`, inline: true },
          { name: '⏰ Timeline', value: quoteData.timeline || 'TBD', inline: true },
          { name: '📝 Notes', value: quoteData.notes || 'None', inline: false }
        )
        .setFooter({ text: 'Review and accept the quote on the webapp' })
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Review Quote')
            .setStyle(ButtonStyle.Link)
            .setURL(`${this.webappUrl}/dashboard/orders/${quoteData.order_id}`)
            .setEmoji('📋')
        );

      await user.send({ embeds: [embed], components: [row] });
      return { success: true };
    } catch (error) {
      console.error('Error sending quote notification:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== PAYMENT NOTIFICATIONS ====================

  async notifyPaymentVerified(discordId, paymentData) {
    try {
      const user = await this.client.users.fetch(discordId);
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Payment Verified!')
        .setDescription('Your payment has been confirmed. We\'re starting work on your project!')
        .addFields(
          { name: 'Order', value: paymentData.order_number, inline: true },
          { name: 'Amount', value: `€${paymentData.amount}`, inline: true },
          { name: 'Status', value: 'Confirmed ✅', inline: true }
        )
        .setFooter({ text: 'You\'ll receive updates as we progress!' })
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Track Progress')
            .setStyle(ButtonStyle.Link)
            .setURL(`${this.webappUrl}/dashboard/orders/${paymentData.order_id}`)
            .setEmoji('📊')
        );

      await user.send({ embeds: [embed], components: [row] });
      return { success: true };
    } catch (error) {
      console.error('Error sending payment notification:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== DEPLOYMENT NOTIFICATIONS ====================

  async notifyBotDeployed(discordId, deploymentData) {
    try {
      const user = await this.client.users.fetch(discordId);
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🚀 Bot Deployed Successfully!')
        .setDescription('Your Discord bot is now live and ready to use!')
        .addFields(
          { name: '🤖 Server', value: deploymentData.server_name || 'Your Bot', inline: true },
          { name: '📍 Guild ID', value: deploymentData.discord_guild_id, inline: true },
          { name: '🎯 Tier', value: deploymentData.tier, inline: true },
          { name: '💾 Resources', value: `${deploymentData.memory_mb}MB RAM\n${deploymentData.cpu_percent}% CPU\n${deploymentData.disk_mb}MB Disk`, inline: false }
        )
        .setFooter({ text: 'Use /mybot to view live status and controls' })
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('View Bot Dashboard')
            .setStyle(ButtonStyle.Link)
            .setURL(`${this.webappUrl}/dashboard/bot/${deploymentData.order_id}`)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setLabel('Bot Controls')
            .setCustomId('bot_control_menu')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎛️')
        );

      await user.send({ embeds: [embed], components: [row] });
      return { success: true };
    } catch (error) {
      console.error('Error sending deployment notification:', error);
      return { success: false, error: error.message };
    }
  }

  async notifyBotOffline(discordId, botData) {
    try {
      const user = await this.client.users.fetch(discordId);
      
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️ Bot Offline Alert')
        .setDescription('Your Discord bot appears to be offline.')
        .addFields(
          { name: '🤖 Bot', value: botData.guild_id || 'Your Bot', inline: true },
          { name: '⏰ Since', value: new Date().toLocaleString(), inline: true },
          { name: '💡 Action', value: 'Check status or restart bot', inline: false }
        )
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('View Status')
            .setStyle(ButtonStyle.Link)
            .setURL(`${this.webappUrl}/dashboard/bot/${botData.order_id}`)
            .setEmoji('📊'),
          new ButtonBuilder()
            .setLabel('Restart Bot')
            .setCustomId(`restart_bot_${botData.order_id}`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄')
        );

      await user.send({ embeds: [embed], components: [row] });
      return { success: true };
    } catch (error) {
      console.error('Error sending offline alert:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== BILLING NOTIFICATIONS ====================

  async notifyPaymentDue(discordId, subscriptionData) {
    try {
      const user = await this.client.users.fetch(discordId);
      
      const daysUntilDue = Math.ceil(
        (new Date(subscriptionData.next_billing_date) - new Date()) / (1000 * 60 * 60 * 24)
      );

      const embed = new EmbedBuilder()
        .setColor(0xFFAA00)
        .setTitle('💳 Payment Due Soon')
        .setDescription(`Your subscription payment is due in **${daysUntilDue} day(s)**`)
        .addFields(
          { name: 'Plan', value: subscriptionData.plan_name, inline: true },
          { name: 'Amount', value: `€${subscriptionData.amount}`, inline: true },
          { name: 'Due Date', value: new Date(subscriptionData.next_billing_date).toLocaleDateString(), inline: true }
        )
        .setFooter({ text: 'Ensure payment is processed to avoid service interruption' })
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Update Payment Method')
            .setStyle(ButtonStyle.Link)
            .setURL(`${this.webappUrl}/dashboard`)
            .setEmoji('💳')
        );

      await user.send({ embeds: [embed], components: [row] });
      return { success: true };
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      return { success: false, error: error.message };
    }
  }

  async notifySubscriptionSuspended(discordId, subscriptionData) {
    try {
      const user = await this.client.users.fetch(discordId);
      
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚨 Subscription Suspended')
        .setDescription('Your subscription has been suspended due to failed payment.')
        .addFields(
          { name: 'Plan', value: subscriptionData.plan_name },
          { name: 'Outstanding', value: `€${subscriptionData.amount}` },
          { name: '⚠️ Action Required', value: 'Update payment method to reactivate service' }
        )
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Reactivate Subscription')
            .setStyle(ButtonStyle.Link)
            .setURL(`${this.webappUrl}/dashboard`)
            .setEmoji('🔄')
        );

      await user.send({ embeds: [embed], components: [row] });
      return { success: true };
    } catch (error) {
      console.error('Error sending suspension notice:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== REFERRAL NOTIFICATIONS ====================

  async notifyReferralEarned(discordId, referralData) {
    try {
      const user = await this.client.users.fetch(discordId);
      
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🎉 Referral Commission Earned!')
        .setDescription(`Someone used your referral link and placed an order!`)
        .addFields(
          { name: '💰 Earned', value: `€${referralData.amount}`, inline: true },
          { name: '📦 Order', value: referralData.order_number, inline: true },
          { name: '💵 Total Earnings', value: `€${referralData.total_earned}`, inline: true }
        )
        .setFooter({ text: 'Keep sharing to earn more!' })
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('View Referral Stats')
            .setStyle(ButtonStyle.Link)
            .setURL(`${this.webappUrl}/dashboard/referrals`)
            .setEmoji('📊')
        );

      await user.send({ embeds: [embed], components: [row] });
      return { success: true };
    } catch (error) {
      console.error('Error sending referral notification:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== SUPPORT NOTIFICATIONS ====================

  async notifyTicketResponse(discordId, ticketData) {
    try {
      const user = await this.client.users.fetch(discordId);
      
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('💬 New Support Response')
        .setDescription(`You have a new message in your support ticket.`)
        .addFields(
          { name: 'Subject', value: ticketData.subject || 'Support Ticket' }
        )
        .setFooter({ text: 'Click below to view and respond' })
        .setTimestamp();

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('View Conversation')
            .setStyle(ButtonStyle.Link)
            .setURL(`${this.webappUrl}/dashboard`)
            .setEmoji('💬')
        );

      await user.send({ embeds: [embed], components: [row] });
      return { success: true };
    } catch (error) {
      console.error('Error sending ticket notification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = DiscordNotifier;

