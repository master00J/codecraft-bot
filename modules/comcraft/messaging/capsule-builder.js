/**
 * Capsule Builder - Advanced Message Formatting System
 * 
 * Capsules are a more flexible way to create Discord messages with:
 * - Multiple embeds (Discord supports up to 10 per message)
 * - Components (buttons, select menus) anywhere
 * - Images in different sections
 * - Better organization than traditional embeds
 * 
 * This is similar to what Nightly bot offers with their "Capsules" feature.
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require('discord.js');

class CapsuleBuilder {
  constructor() {
    this.embeds = [];
    this.components = [];
    this.files = [];
    this.content = null;
  }

  /**
   * Add a text section (embed)
   */
  addSection(options = {}) {
    const embed = new EmbedBuilder();

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.color) embed.setColor(options.color);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    if (options.footer) {
      if (typeof options.footer === 'string') {
        embed.setFooter({ text: options.footer });
      } else {
        embed.setFooter(options.footer);
      }
    }
    if (options.timestamp) embed.setTimestamp(options.timestamp === true ? new Date() : options.timestamp);
    if (options.author) {
      if (typeof options.author === 'string') {
        embed.setAuthor({ name: options.author });
      } else {
        embed.setAuthor(options.author);
      }
    }
    if (options.fields) {
      options.fields.forEach(field => {
        embed.addFields(field);
      });
    }
    if (options.url) embed.setURL(options.url);

    this.embeds.push(embed);
    return this;
  }

  /**
   * Add an image section (embed with just an image)
   */
  addImage(imageUrl, options = {}) {
    const embed = new EmbedBuilder();
    
    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    embed.setImage(imageUrl);
    if (options.color) embed.setColor(options.color);

    this.embeds.push(embed);
    return this;
  }

  /**
   * Add a file attachment
   */
  addFile(filePath, name = null) {
    const attachment = new AttachmentBuilder(filePath);
    if (name) attachment.setName(name);
    this.files.push(attachment);
    return this;
  }

  /**
   * Add buttons row
   */
  addButtons(buttons) {
    const row = new ActionRowBuilder();
    
    buttons.forEach(button => {
      if (typeof button === 'string') {
        // Simple button: just customId
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(button)
            .setLabel(button)
            .setStyle(ButtonStyle.Primary)
        );
      } else {
        // Full button config
        const btn = new ButtonBuilder();
        if (button.customId) btn.setCustomId(button.customId);
        if (button.label) btn.setLabel(button.label);
        if (button.emoji) btn.setEmoji(button.emoji);
        if (button.style) btn.setStyle(button.style);
        else btn.setStyle(ButtonStyle.Primary);
        if (button.url) btn.setURL(button.url);
        if (button.disabled !== undefined) btn.setDisabled(button.disabled);
        
        row.addComponents(btn);
      }
    });

    this.components.push(row);
    return this;
  }

  /**
   * Add select menu
   */
  addSelectMenu(options) {
    const row = new ActionRowBuilder();
    const menu = new StringSelectMenuBuilder()
      .setCustomId(options.customId)
      .setPlaceholder(options.placeholder || 'Select an option...');

    if (options.options) {
      menu.addOptions(options.options);
    }
    if (options.minValues !== undefined) menu.setMinValues(options.minValues);
    if (options.maxValues !== undefined) menu.setMaxValues(options.maxValues);
    if (options.disabled !== undefined) menu.setDisabled(options.disabled);

    row.addComponents(menu);
    this.components.push(row);
    return this;
  }

  /**
   * Set message content (text above embeds)
   */
  setContent(content) {
    this.content = content;
    return this;
  }

  /**
   * Build the message payload
   */
  build() {
    const payload = {};

    if (this.content) payload.content = this.content;
    if (this.embeds.length > 0) payload.embeds = this.embeds;
    if (this.components.length > 0) payload.components = this.components;
    if (this.files.length > 0) payload.files = this.files;

    // Discord limit: max 10 embeds per message
    if (this.embeds.length > 10) {
      console.warn(`⚠️ Capsule has ${this.embeds.length} embeds, Discord limit is 10. Only first 10 will be sent.`);
      payload.embeds = this.embeds.slice(0, 10);
    }

    // Discord limit: max 5 action rows
    if (this.components.length > 5) {
      console.warn(`⚠️ Capsule has ${this.components.length} component rows, Discord limit is 5. Only first 5 will be sent.`);
      payload.components = this.components.slice(0, 5);
    }

    return payload;
  }

  /**
   * Send the capsule (requires channel or interaction)
   */
  async send(channelOrInteraction) {
    const payload = this.build();

    if (channelOrInteraction.reply || channelOrInteraction.followUp) {
      // It's an interaction
      if (channelOrInteraction.replied || channelOrInteraction.deferred) {
        return await channelOrInteraction.followUp(payload);
      } else {
        return await channelOrInteraction.reply(payload);
      }
    } else {
      // It's a channel
      return await channelOrInteraction.send(payload);
    }
  }

  /**
   * Create a capsule from a template
   */
  static create() {
    return new CapsuleBuilder();
  }

  /**
   * Create an announcement capsule
   */
  static announcement(title, description, imageUrl = null, buttons = []) {
    const capsule = new CapsuleBuilder();

    capsule.addSection({
      title: `📢 ${title}`,
      description: description,
      color: 0x5865F2,
      timestamp: true,
    });

    if (imageUrl) {
      capsule.addImage(imageUrl, {
        color: 0x5865F2,
      });
    }

    if (buttons.length > 0) {
      capsule.addButtons(buttons);
    }

    return capsule;
  }

  /**
   * Create a product/service showcase capsule
   */
  static showcase(title, description, features = [], imageUrl = null, price = null, buttons = []) {
    const capsule = new CapsuleBuilder();

    // Header section
    capsule.addSection({
      title: `✨ ${title}`,
      description: description,
      color: 0x00D26A,
      thumbnail: imageUrl, // Use thumbnail for header
    });

    // Features section
    if (features.length > 0) {
      const featuresText = features.map((f, i) => `${i + 1}. ${f}`).join('\n');
      capsule.addSection({
        title: '📋 Features',
        description: featuresText,
        color: 0x00D26A,
      });
    }

    // Price section
    if (price) {
      capsule.addSection({
        title: '💰 Pricing',
        description: price,
        color: 0xFFD700,
      });
    }

    // Full image if provided
    if (imageUrl) {
      capsule.addImage(imageUrl);
    }

    // Buttons
    if (buttons.length > 0) {
      capsule.addButtons(buttons);
    }

    return capsule;
  }

  /**
   * Create a leaderboard capsule
   */
  static leaderboard(title, entries = [], imageUrl = null) {
    const capsule = new CapsuleBuilder();

    // Header
    capsule.addSection({
      title: `🏆 ${title}`,
      color: 0xFFD700,
      timestamp: true,
    });

    // Leaderboard entries
    if (entries.length > 0) {
      const leaderboardText = entries
        .map((entry, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          return `${medal} **${entry.name}** - ${entry.value}`;
        })
        .join('\n');

      capsule.addSection({
        title: 'Rankings',
        description: leaderboardText,
        color: 0xFFD700,
      });
    }

    if (imageUrl) {
      capsule.addImage(imageUrl);
    }

    return capsule;
  }

  /**
   * Create a multi-step form capsule
   */
  static form(title, steps = [], buttons = []) {
    const capsule = new CapsuleBuilder();

    capsule.addSection({
      title: `📝 ${title}`,
      description: 'Fill out the form below:',
      color: 0x5865F2,
    });

    steps.forEach((step, index) => {
      capsule.addSection({
        title: `Step ${index + 1}: ${step.title}`,
        description: step.description || step.content,
        color: 0x5865F2,
      });
    });

    if (buttons.length > 0) {
      capsule.addButtons(buttons);
    }

    return capsule;
  }
}

module.exports = CapsuleBuilder;

