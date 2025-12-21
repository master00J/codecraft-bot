/**
 * Feature Gate Utility
 * Centralized feature checking and upgrade messaging
 */

const { EmbedBuilder } = require('discord.js');

class FeatureGate {
  constructor(configManager) {
    this.configManager = configManager;
  }

  /**
   * Check if guild has an active license
   */
  async checkLicense(guildId) {
    if (typeof this.configManager.isSubscriptionActive === 'function') {
      return await this.configManager.isSubscriptionActive(guildId);
    }
    return true;
  }

  /**
   * Check if guild has access to a feature
   */
  async checkFeature(guildId, featureName) {
    return await this.configManager.hasFeature(guildId, featureName);
  }

  /**
   * Get subscription limits for a guild
   */
  async getLimits(guildId) {
    return await this.configManager.getSubscriptionLimits(guildId);
  }

  /**
   * Get guild's current tier
   */
  async getTier(guildId) {
    if (typeof this.configManager.getEffectiveTier === 'function') {
      return await this.configManager.getEffectiveTier(guildId);
    }
    const config = await this.configManager.getGuildConfig(guildId);
    return config?.subscription_tier || 'free';
  }

  /**
   * Create upgrade required embed
   */
  createUpgradeEmbed(featureName, requiredTier = 'Premium') {
    // Determine pricing based on required tier
    let pricing = '';
    let benefits = '';
    
    if (requiredTier === 'Basic') {
      pricing = '**€1.99/month** or €9.99/year';
      benefits = '• Advanced Moderation\n• 25 Custom Commands\n• 5 Stream Notifications\n• Analytics Dashboard';
    } else if (requiredTier === 'Premium') {
      pricing = '**€2.99/month** or €19.99/year';
      benefits = '• Unlimited Commands\n• Unlimited Streams\n• Custom Bot Branding\n• XP Boost (1.5x)\n• Economy & Casino\n• Priority Support';
    } else if (requiredTier === 'Enterprise') {
      pricing = '**€4.99/month** or €39.99/year';
      benefits = '• Everything in Premium\n• Multi-Guild Support (5 guilds)\n• API Access\n• 15M AI Tokens/month\n• All Features Unlocked';
    } else {
      // Default to Premium
      pricing = '**€2.99/month** or €19.99/year';
      benefits = '• Unlimited Commands\n• Unlimited Streams\n• Custom Bot Branding\n• XP Boost (1.5x)\n• Economy & Casino\n• Priority Support';
    }

    return new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('🔒 Premium Feature')
      .setDescription(`**${featureName}** is only available from the **${requiredTier}** tier and up.`)
      .addFields(
        {
          name: '📊 Upgrade Benefits',
          value: benefits
        },
        {
          name: '💰 Pricing',
          value: pricing
        },
        {
          name: '🔗 Upgrade Now',
          value: '[View all plans →](https://codecraft-solutions.com/nl/admin/subscription-tiers)'
        }
      )
      .setFooter({ text: 'Comcraft Premium – Unlock more features!' })
      .setTimestamp();
  }

  /**
   * Create license disabled embed
   */
  createLicenseDisabledEmbed() {
    return new EmbedBuilder()
      .setColor('#F97316')
      .setTitle('🔒 License Disabled')
      .setDescription('This guild’s Comcraft license is currently disabled. Contact the owner or upgrade to restore access.')
      .addFields(
        {
          name: '📌 What happened?',
          value: 'The license was manually disabled from the admin panel or the guild is inactive.'
        },
        {
          name: '✅ How to fix it',
          value: 'Ask the owner to enable the license in the admin dashboard or reach out to CodeCraft support.'
        },
        {
          name: '🔗 Need help?',
          value: '[Contact CodeCraft support](https://codecraft-solutions.com/contact)'
        }
      )
      .setFooter({ text: 'License inactive – feature usage blocked.' })
      .setTimestamp();
  }

  /**
   * Create limit reached embed
   */
  createLimitEmbed(featureName, current, max, requiredTier = 'Premium') {
    return new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('⚠️ Limit Reached')
      .setDescription(`You have reached your limit for **${featureName}**.`)
      .addFields(
        {
          name: '📊 Current Usage',
          value: `${current}/${max === -1 ? '∞' : max} used`,
          inline: true
        },
        {
          name: '🎯 Upgrade for more',
          value: requiredTier === 'Basic' ? '25 items' : 'Unlimited!',
          inline: true
        },
        {
          name: '💡 What can you do?',
          value: `• Remove old items\n• Upgrade to ${requiredTier} for ${max === -1 ? 'unlimited' : 'more'} capacity`
        },
        {
          name: '🔗 Upgrade Now',
          value: '[View all plans →](https://codecraft-solutions.com/products/comcraft)'
        }
      )
      .setFooter({ text: 'Upgrade for unlimited access!' })
      .setTimestamp();
  }

  /**
   * Check feature and reply if blocked
   * Returns true if feature is available, false if blocked
   */
  async checkFeatureOrReply(interaction, guildId, featureName, requiredTier = 'Premium') {
    const licenseActive = await this.checkLicense(guildId);
    if (!licenseActive) {
      const embed = this.createLicenseDisabledEmbed();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return false;
    }

    const hasFeature = await this.checkFeature(guildId, featureName);
    
    if (!hasFeature) {
      const embed = this.createUpgradeEmbed(featureName, requiredTier);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return false;
    }
    
    return true;
  }

  /**
   * Check limit and reply if exceeded
   * Returns true if under limit, false if exceeded
   */
  async checkLimitOrReply(interaction, guildId, limitName, currentUsage, featureName, requiredTier = 'Premium') {
    const licenseActive = await this.checkLicense(guildId);
    if (!licenseActive) {
      const embed = this.createLicenseDisabledEmbed();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return false;
    }

    const limits = await this.getLimits(guildId);
    const maxLimit = limits[limitName];
    
    // -1 means unlimited
    if (maxLimit === -1) {
      return true;
    }
    
    if (currentUsage >= maxLimit) {
      const embed = this.createLimitEmbed(featureName, currentUsage, maxLimit, requiredTier);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return false;
    }
    
    return true;
  }

  /**
   * Get tier info embed
   */
  async getTierInfoEmbed(guildId) {
    const tier = await this.getTier(guildId);
    const limits = await this.getLimits(guildId);
    
    const tierNames = {
      free: '🆓 Free',
      basic: '⭐ Basic',
      premium: '💎 Premium',
      enterprise: '🏢 Enterprise'
    };
    
    const tierColors = {
      free: '#95A5A6',
      basic: '#3498DB',
      premium: '#9B59B6',
      enterprise: '#E74C3C'
    };

    const embed = new EmbedBuilder()
      .setColor(tierColors[tier] || '#95A5A6')
      .setTitle(`${tierNames[tier] || tier} Tier`)
      .setDescription('Your current subscription tier and limits')
      .addFields(
        {
          name: '📊 Limits',
          value: Object.entries(limits)
            .map(([key, value]) => `• ${key.replace(/_/g, ' ')}: ${value === -1 ? '∞' : value}`)
            .join('\n')
        },
        {
          name: '🔗 More info',
          value: '[View all features →](https://codecraft-solutions.com/products/comcraft)'
        }
      )
      .setTimestamp();

    return embed;
  }
}

module.exports = FeatureGate;

