/**
 * Server Setup Module for CodeCraft Solutions
 * Automatically creates a complete Discord server structure
 */

const { 
  ChannelType, 
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

/**
 * Setup complete server structure
 */
async function setupServer(guild) {
  try {
    console.log(`🚀 Starting server setup for ${guild.name}`);
    
    // Create roles
    const roles = await createRoles(guild);
    
    // Create categories and channels
    const channels = await createChannels(guild, roles);
    
    // Send welcome messages
    await sendWelcomeMessages(guild, channels);
    
    console.log(`✅ Server setup completed for ${guild.name}`);
    
    return {
      success: true,
      roles,
      channels
    };
  } catch (error) {
    console.error('Server setup error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create server roles
 */
async function createRoles(guild) {
  const roles = {};
  
  // Developer role (highest)
  roles.developer = await guild.roles.create({
    name: '👨‍💻 Developer',
    color: 0x5865F2,
    permissions: [
      PermissionFlagsBits.Administrator
    ],
    reason: 'CodeCraft setup - Developer role'
  });
  
  // Client role
  roles.client = await guild.roles.create({
    name: '💼 Client',
    color: 0x00FF00,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks
    ],
    reason: 'CodeCraft setup - Client role'
  });
  
  // Active Project role
  roles.activeProject = await guild.roles.create({
    name: '🔨 Active Project',
    color: 0xFFAA00,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory
    ],
    reason: 'CodeCraft setup - Active project role'
  });
  
  // Support Staff role
  roles.support = await guild.roles.create({
    name: '🎧 Support Staff',
    color: 0x9B59B6,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.MuteMembers,
      PermissionFlagsBits.MoveMembers
    ],
    reason: 'CodeCraft setup - Support staff role'
  });
  
  // Newsletter role
  roles.newsletter = await guild.roles.create({
    name: '📧 Newsletter',
    color: 0x3498DB,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory
    ],
    reason: 'CodeCraft setup - Newsletter subscriber role'
  });
  
  // Bot role (for the bot itself)
  roles.bot = await guild.roles.create({
    name: '🤖 CodeCraft Bot',
    color: 0xE91E63,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.UseExternalEmojis
    ],
    reason: 'CodeCraft setup - Bot role'
  });
  
  console.log('✅ Roles created');
  return roles;
}

/**
 * Create categories and channels
 */
async function createChannels(guild, roles) {
  const channels = {};
  
  // 1. WELCOME CATEGORY
  const welcomeCategory = await guild.channels.create({
    name: '👋 WELCOME',
    type: ChannelType.GuildCategory,
    position: 0
  });
  
  channels.welcome = await guild.channels.create({
    name: '🏠-welcome',
    type: ChannelType.GuildText,
    parent: welcomeCategory.id,
    topic: 'Welcome to CodeCraft Solutions! Start here for information about our services.',
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.SendMessages],
        allow: [PermissionFlagsBits.ViewChannel]
      }
    ]
  });
  
  channels.rules = await guild.channels.create({
    name: '📜-rules',
    type: ChannelType.GuildText,
    parent: welcomeCategory.id,
    topic: 'Server rules and guidelines',
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.SendMessages],
        allow: [PermissionFlagsBits.ViewChannel]
      }
    ]
  });
  
  channels.services = await guild.channels.create({
    name: '🛍️-services',
    type: ChannelType.GuildText,
    parent: welcomeCategory.id,
    topic: 'Browse our web development services',
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.SendMessages],
        allow: [PermissionFlagsBits.ViewChannel]
      }
    ]
  });
  
  channels.portfolio = await guild.channels.create({
    name: '💼-portfolio',
    type: ChannelType.GuildText,
    parent: welcomeCategory.id,
    topic: 'View our past projects and success stories'
  });
  
  channels.reviews = await guild.channels.create({
    name: '⭐-reviews',
    type: ChannelType.GuildText,
    parent: welcomeCategory.id,
    topic: 'Customer reviews and testimonials',
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.SendMessages],
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
      }
    ]
  });
  
  // 2. GENERAL CATEGORY
  const generalCategory = await guild.channels.create({
    name: '💬 GENERAL',
    type: ChannelType.GuildCategory,
    position: 1
  });
  
  channels.general = await guild.channels.create({
    name: '🗨️-general',
    type: ChannelType.GuildText,
    parent: generalCategory.id,
    topic: 'General discussion about web development'
  });
  
  channels.showcase = await guild.channels.create({
    name: '🎨-showcase',
    type: ChannelType.GuildText,
    parent: generalCategory.id,
    topic: 'Share your projects and get feedback'
  });
  
  channels.resources = await guild.channels.create({
    name: '📚-resources',
    type: ChannelType.GuildText,
    parent: generalCategory.id,
    topic: 'Useful resources, tutorials, and tools'
  });
  
  channels.announcements = await guild.channels.create({
    name: '📢-announcements',
    type: ChannelType.GuildText,
    parent: generalCategory.id,
    topic: 'Important updates and announcements',
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.SendMessages],
        allow: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roles.developer.id,
        allow: [PermissionFlagsBits.SendMessages]
      }
    ]
  });
  
  // 3. SUPPORT CATEGORY
  const supportCategory = await guild.channels.create({
    name: '🎫 SUPPORT',
    type: ChannelType.GuildCategory,
    position: 2
  });
  
  channels.createTicket = await guild.channels.create({
    name: '🎫-create-ticket',
    type: ChannelType.GuildText,
    parent: supportCategory.id,
    topic: 'Click the button below to create a support ticket',
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.SendMessages],
        allow: [PermissionFlagsBits.ViewChannel]
      }
    ]
  });
  
  channels.faq = await guild.channels.create({
    name: '❓-faq',
    type: ChannelType.GuildText,
    parent: supportCategory.id,
    topic: 'Frequently asked questions'
  });
  
  // 4. ORDERS CATEGORY
  const ordersCategory = await guild.channels.create({
    name: '📦 ORDERS',
    type: ChannelType.GuildCategory,
    position: 3,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roles.developer.id,
        allow: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roles.support.id,
        allow: [PermissionFlagsBits.ViewChannel]
      }
    ]
  });
  
  channels.ordersCategory = ordersCategory;
  
  // 5. PROJECTS CATEGORY
  const projectsCategory = await guild.channels.create({
    name: '🚀 ACTIVE PROJECTS',
    type: ChannelType.GuildCategory,
    position: 4,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roles.developer.id,
        allow: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roles.activeProject.id,
        allow: [PermissionFlagsBits.ViewChannel]
      }
    ]
  });
  
  channels.projectsCategory = projectsCategory;
  
  // 6. TEAM CATEGORY
  const teamCategory = await guild.channels.create({
    name: '👥 TEAM',
    type: ChannelType.GuildCategory,
    position: 5,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roles.developer.id,
        allow: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roles.support.id,
        allow: [PermissionFlagsBits.ViewChannel]
      }
    ]
  });
  
  channels.teamChat = await guild.channels.create({
    name: '💬-team-chat',
    type: ChannelType.GuildText,
    parent: teamCategory.id,
    topic: 'Internal team discussion'
  });
  
  channels.development = await guild.channels.create({
    name: '💻-development',
    type: ChannelType.GuildText,
    parent: teamCategory.id,
    topic: 'Development discussion and updates'
  });
  
  console.log('✅ Channels created');
  return channels;
}

/**
 * Send welcome messages in channels
 */
async function sendWelcomeMessages(guild, channels) {
  // Welcome message
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎉 Welcome to CodeCraft Solutions!')
    .setDescription(`**Your Partner in Modern Web Development**

We specialize in creating stunning web applications, powerful Discord bots, and custom software solutions that help your business thrive in the digital age.`)
    .addFields(
      {
        name: '🚀 Our Mission',
        value: 'To deliver cutting-edge web solutions that exceed expectations while maintaining transparent communication and competitive pricing.',
        inline: false
      },
      {
        name: '💡 What We Offer',
        value: `• **Web Shops** - Full e-commerce solutions
• **Discord Bots** - Custom automation for your server
• **Websites** - Modern, responsive designs
• **APIs** - Powerful backend services
• **Custom Software** - Tailored to your needs`,
        inline: false
      },
      {
        name: '🎯 Quick Start',
        value: `1️⃣ Check out <#${channels.services.id}> for our services
2️⃣ View our work in <#${channels.portfolio.id}>
3️⃣ Use \`/order\` to start your project
4️⃣ Create a \`/ticket\` for questions`,
        inline: false
      }
    )
    .setImage('https://via.placeholder.com/800x200/5865F2/FFFFFF?text=CodeCraft+Solutions')
    .setFooter({ text: 'Building the future, one line at a time' })
    .setTimestamp();
  
  await channels.welcome.send({ embeds: [welcomeEmbed] });
  
  // Rules message
  const rulesEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('📜 Server Rules & Guidelines')
    .setDescription('Please follow these rules to maintain a professional environment:')
    .addFields(
      {
        name: '1️⃣ Be Professional',
        value: 'Maintain respectful communication at all times.',
        inline: false
      },
      {
        name: '2️⃣ No Spam',
        value: 'Avoid repetitive messages or unsolicited promotions.',
        inline: false
      },
      {
        name: '3️⃣ Stay On Topic',
        value: 'Keep discussions relevant to web development and our services.',
        inline: false
      },
      {
        name: '4️⃣ Protect Privacy',
        value: 'Never share sensitive information publicly. Use tickets for private matters.',
        inline: false
      },
      {
        name: '5️⃣ No Harassment',
        value: 'Zero tolerance for harassment, discrimination, or inappropriate content.',
        inline: false
      },
      {
        name: '6️⃣ Use Appropriate Channels',
        value: 'Post in the correct channels for your topic.',
        inline: false
      },
      {
        name: '⚠️ Violations',
        value: 'Breaking rules may result in warnings, mutes, or bans.',
        inline: false
      }
    )
    .setFooter({ text: 'Thank you for helping us maintain a professional environment!' })
    .setTimestamp();
  
  await channels.rules.send({ embeds: [rulesEmbed] });
  
  // Services overview
  const servicesEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('🛍️ Our Services')
    .setDescription('Professional web development solutions for every need')
    .addFields(
      {
        name: '🛒 E-Commerce Development',
        value: `**Starting at $1,500**
• Complete online store setup
• Payment gateway integration
• Inventory management
• Admin dashboard
• Mobile responsive design`,
        inline: false
      },
      {
        name: '🤖 Discord Bot Development',
        value: `**Starting at $300**
• Custom commands
• Moderation tools
• Economy systems
• Music playback
• AI integration available`,
        inline: false
      },
      {
        name: '🌐 Website Development',
        value: `**Starting at $500**
• Modern responsive design
• SEO optimization
• Content management
• Analytics integration
• Fast loading times`,
        inline: false
      },
      {
        name: '⚙️ API & Backend Development',
        value: `**Starting at $1,000**
• RESTful API design
• Database architecture
• Authentication systems
• Third-party integrations
• Scalable infrastructure`,
        inline: false
      },
      {
        name: '💼 How to Order',
        value: 'Use `/order` command or create a `/ticket` to discuss your project!',
        inline: false
      }
    )
    .setFooter({ text: '15% off for first-time clients • 20% off for bundles' })
    .setTimestamp();
  
  await channels.services.send({ embeds: [servicesEmbed] });
  
  // FAQ message
  const faqEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('❓ Frequently Asked Questions')
    .setDescription('Quick answers to common questions')
    .addFields(
      {
        name: 'How long does development take?',
        value: 'Simple projects: 1-2 weeks\nMedium projects: 2-4 weeks\nComplex projects: 4-12 weeks',
        inline: false
      },
      {
        name: 'What payment methods do you accept?',
        value: 'Credit/Debit cards, PayPal, Cryptocurrency, Bank transfers, Payment plans available',
        inline: false
      },
      {
        name: 'Do you provide source code?',
        value: 'Yes! You own 100% of the code upon final payment.',
        inline: false
      },
      {
        name: 'Is support included?',
        value: 'All projects include 30 days of free support. Extended support packages available.',
        inline: false
      },
      {
        name: 'Can you work with existing code?',
        value: 'Yes, we can enhance, fix, or rebuild existing projects.',
        inline: false
      },
      {
        name: 'Do you sign NDAs?',
        value: 'Absolutely! We maintain strict confidentiality for all projects.',
        inline: false
      }
    )
    .setFooter({ text: 'Still have questions? Create a /ticket!' })
    .setTimestamp();
  
  await channels.faq.send({ embeds: [faqEmbed] });
  
  // Reviews welcome message
  const reviewsEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('⭐ Customer Reviews')
    .setDescription('See what our clients are saying about CodeCraft Solutions!')
    .addFields(
      {
        name: '📊 Why Reviews Matter',
        value: 'Real feedback from real customers helps you make informed decisions about your project.',
        inline: false
      },
      {
        name: '💡 How It Works',
        value: '1. Complete your project\n2. Receive review request\n3. Leave your honest feedback\n4. Help others choose quality service',
        inline: false
      },
      {
        name: '🎁 Leave a Review',
        value: 'After project completion, use the review button in your order channel or ask staff via `/ticket`',
        inline: false
      }
    )
    .setFooter({ text: 'All reviews are verified from actual customers' })
    .setTimestamp();
  
  await channels.reviews.send({ embeds: [reviewsEmbed] });
  
  // Create ticket button
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  
  const ticketEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎫 Need Help?')
    .setDescription(`Create a support ticket to:
• Ask questions about our services
• Discuss your project requirements
• Get technical support
• Request a custom quote
• Report issues

Our AI assistant and support team are ready to help!`)
    .setFooter({ text: 'Average response time: < 2 hours' })
    .setTimestamp();
  
  const ticketButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    );
  
  await channels.createTicket.send({ 
    embeds: [ticketEmbed], 
    components: [ticketButton] 
  });
  
  console.log('✅ Welcome messages sent');
}

module.exports = { setupServer };

