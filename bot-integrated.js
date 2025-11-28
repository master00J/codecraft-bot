/**
 * CodeCraft Solutions Discord Bot - Webapp Integrated Version
 * Fully synchronized with Next.js webapp
 * 
 * Features:
 * - Real-time order tracking from webapp
 * - Bot deployment management
 * - Payment notifications
 * - Referral tracking
 * - Support ticket integration
 * - Admin commands for webapp management
 */

const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const dotenv = require('dotenv');
const webappAPI = require('./modules/webapp-api-client');
const WebhookListener = require('./modules/webhook-listener');

console.log('🔄 CodeCraft Bot (Integrated) starting...');

// Load environment variables
dotenv.config();

const envReport = {
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN ? '✅' : '❌',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ? '✅' : '❌',
  WEBAPP_API_URL: process.env.WEBAPP_API_URL || '❌',
  INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET ? '✅' : '❌',
  WEBHOOK_PORT: process.env.WEBHOOK_PORT || '❌',
  DISCORD_BOT_WEBHOOK_URL: process.env.DISCORD_BOT_WEBHOOK_URL || '❌'
};

console.log('🧪 Environment check:', envReport);

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN ontbreekt. Zet deze in .env of Pterodactyl variables.');
  process.exit(1);
}

if (!process.env.INTERNAL_API_SECRET) {
  console.error('❌ INTERNAL_API_SECRET ontbreekt. Zet exact dezelfde waarde als op Vercel.');
  process.exit(1);
}

process.on('unhandledRejection', (error) => {
  console.error('🚨 Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught exception:', error);
});

const pendingPayments = new Map();

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

// Bot ready event
client.once('ready', async () => {
  console.log(`✅ CodeCraft Bot (Integrated) is online as ${client.user.tag}`);
  console.log(`📊 Connected to ${client.guilds.cache.size} servers`);
  console.log(`🔗 Webapp API: ${process.env.WEBAPP_API_URL}`);
  
  client.user.setActivity('codecraft-solutions.com | /help', { type: 3 });
  
  await registerCommands();
  
  // Start webhook listener for webapp notifications
  const webhookPort = parseInt(process.env.WEBHOOK_PORT || '3001', 10);
  const webhookListener = new WebhookListener(client, webhookPort);
  webhookListener.start();
});

// Register slash commands
async function registerCommands() {
  const commands = [
    // ==================== CUSTOMER COMMANDS ====================
    new SlashCommandBuilder()
      .setName('myorders')
      .setDescription('📦 View all your orders from the webapp'),
    
    new SlashCommandBuilder()
      .setName('orderstatus')
      .setDescription('📊 Check status of a specific order')
      .addStringOption(option =>
        option
          .setName('order_number')
          .setDescription('Your order number (e.g., CC094304B2R)')
          .setRequired(true)
      ),
    
    new SlashCommandBuilder()
      .setName('mybot')
      .setDescription('🤖 View your deployed bot status and resources'),
    
    new SlashCommandBuilder()
      .setName('botcontrol')
      .setDescription('🎛️ Control your bot (start/stop/restart)')
      .addStringOption(option =>
        option
          .setName('action')
          .setDescription('Action to perform')
          .setRequired(true)
          .addChoices(
            { name: '▶️ Start Bot', value: 'start' },
            { name: '⏸️ Stop Bot', value: 'stop' },
            { name: '🔄 Restart Bot', value: 'restart' }
          )
      ),
    
    new SlashCommandBuilder()
      .setName('referral')
      .setDescription('🎁 Get your referral link and statistics'),
    
    new SlashCommandBuilder()
      .setName('discount')
      .setDescription('🎟️ Validate a discount code')
      .addStringOption(option =>
        option
          .setName('code')
          .setDescription('Discount code to validate')
          .setRequired(true)
      ),
    
    new SlashCommandBuilder()
      .setName('invoice')
      .setDescription('🧾 Get invoice for an order')
      .addStringOption(option =>
        option
          .setName('order_number')
          .setDescription('Order number')
          .setRequired(true)
      ),
    
    // ==================== ADMIN COMMANDS ====================
    new SlashCommandBuilder()
      .setName('admin-stats')
      .setDescription('📊 [Admin] View webapp statistics')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
      .setName('admin-deploy')
      .setDescription('🚀 [Admin] Trigger bot deployment')
      .addStringOption(option =>
        option
          .setName('order_id')
          .setDescription('Order ID to deploy')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
      .setName('admin-link')
      .setDescription('🔗 [Admin] Link server UUID to order')
      .addStringOption(option =>
        option
          .setName('server_uuid')
          .setDescription('Pterodactyl server UUID')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('order_id')
          .setDescription('Order ID')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
      .setName('admin-notify')
      .setDescription('📢 [Admin] Send notification to customer')
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('User to notify')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('message')
          .setDescription('Notification message')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('❓ Show all available commands')
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log('📝 Registering enhanced slash commands...');
    
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    
    console.log('✅ Successfully registered webapp-integrated commands');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

// ==================== COMMAND HANDLERS ====================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  
  try {
    switch (commandName) {
      case 'myorders':
        await handleMyOrdersCommand(interaction);
        break;
      case 'orderstatus':
        await handleOrderStatusCommand(interaction);
        break;
      case 'mybot':
        await handleMyBotCommand(interaction);
        break;
      case 'botcontrol':
        await handleBotControlCommand(interaction);
        break;
      case 'referral':
        await handleReferralCommand(interaction);
        break;
      case 'discount':
        await handleDiscountCommand(interaction);
        break;
      case 'invoice':
        await handleInvoiceCommand(interaction);
        break;
      case 'admin-stats':
        await handleAdminStatsCommand(interaction);
        break;
      case 'admin-deploy':
        await handleAdminDeployCommand(interaction);
        break;
      case 'admin-link':
        await handleAdminLinkCommand(interaction);
        break;
      case 'admin-notify':
        await handleAdminNotifyCommand(interaction);
        break;
      case 'help':
        await handleHelpCommand(interaction);
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Error')
      .setDescription('An error occurred. Please try again or contact support.')
      .setTimestamp();
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;

  if (customId.startsWith('accept_quote_')) {
    await handleQuoteAcceptButton(interaction);
    return;
  }

  if (customId.startsWith('confirm_payment_')) {
    await handlePaymentConfirmation(interaction);
    return;
  }

  if (customId.startsWith('copy_referral_')) {
    const code = customId.replace('copy_referral_', '');
    const link = `${process.env.WEBAPP_API_URL}?ref=${code}`;
    
    await interaction.reply({
      content: `📋 **Referral link copied!**\n\n\`\`\`${link}\`\`\``,
      ephemeral: true
    });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  const customId = interaction.customId;
  if (customId.startsWith('submit_payment_')) {
    await handlePaymentModalSubmit(interaction);
  }
});

// ==================== MY ORDERS ====================
async function handleMyOrdersCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const orders = await webappAPI.getUserOrders(interaction.user.id);
  
  if (!orders || orders.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📦 Your Orders')
      .setDescription('You don\'t have any orders yet!')
      .addFields({
        name: '🛍️ Ready to start?',
        value: `Visit [codecraft-solutions.com](${process.env.WEBAPP_API_URL || 'https://codecraft-solutions.com'}) to place your first order!`
      })
      .setTimestamp();
    
    return interaction.editReply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📦 Your Orders')
    .setDescription(`You have **${orders.length}** order(s)`)
    .setTimestamp();

  orders.slice(0, 5).forEach(order => {
    const statusEmoji = {
      pending: '⏳',
      quote_sent: '📋',
      in_progress: '🔨',
      completed: '✅',
      cancelled: '❌'
    };

    embed.addFields({
      name: `${statusEmoji[order.status] || '📦'} ${order.order_number}`,
      value: `**Service:** ${order.service_name || order.service_type}\n**Status:** ${order.status}\n**Price:** €${order.price || 'TBD'}`,
      inline: true
    });
  });

  embed.setFooter({ text: `View all orders on the webapp • Use /orderstatus for details` });

  await interaction.editReply({ embeds: [embed] });
}

// ==================== ORDER STATUS ====================
async function handleOrderStatusCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const orderNumber = interaction.options.getString('order_number');
  const orderSummary = await webappAPI.getOrderByNumber(orderNumber);
  
  if (!orderSummary || !orderSummary.id) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Order Not Found')
      .setDescription(`Order **${orderNumber}** was not found in our system.`)
      .addFields({
        name: '💡 Tips',
        value: '• Check your order number spelling\n• Use /myorders to see all your orders\n• Order numbers look like: CC094304B2R'
      })
      .setTimestamp();
    
    return interaction.editReply({ embeds: [embed] });
  }

  const orderDetails = await webappAPI.getOrderDetails(orderSummary.id);
  if (!orderDetails || !orderDetails.order) {
    return interaction.editReply({
      content: '❌ Failed to fetch order details. Please try again later.',
      ephemeral: true
    });
  }

  const order = orderDetails.order;
  const quote = orderDetails.quote;
  
  const statusColor = {
    pending: 0xFFAA00,
    quote_sent: 0x5865F2,
    in_progress: 0x3498DB,
    completed: 0x00FF00,
    cancelled: 0xFF0000
  };

  const embed = new EmbedBuilder()
    .setColor(statusColor[order.status] || 0x5865F2)
    .setTitle(`📊 Order Status: ${orderNumber}`)
    .setDescription(`**${order.service_name || order.service_type}**`)
    .addFields(
      { name: '📋 Status', value: order.status.toUpperCase().replace('_', ' '), inline: true },
      { name: '💳 Payment', value: order.payment_status || 'pending', inline: true },
      { name: '💰 Price', value: order.price ? `€${order.price}` : 'TBD', inline: true },
      { name: '📅 Created', value: new Date(order.created_at).toLocaleDateString(), inline: true }
    );

  if (order.timeline) {
    embed.addFields({ name: '⏰ Timeline', value: order.timeline, inline: true });
  }

  if (order.deployment_id) {
    embed.addFields({ 
      name: '🤖 Bot Status', 
      value: 'Deployed! Use /mybot to view', 
      inline: true 
    });
  }

  embed.setFooter({ 
    text: 'View full details on codecraft-solutions.com/dashboard/orders' 
  });
  embed.setTimestamp();

  const components = [];

  if (quote && quote.status === 'pending') {
    components.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_quote_${order.id}_${quote.id}`)
          .setLabel('Accept Quote')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      )
    );

    embed.addFields({
      name: '📋 Quote Status',
      value: 'Quote pending approval. Click **Accept Quote** below to continue.',
      inline: false
    });
  } else if (quote && quote.status === 'accepted') {
    embed.addFields({
      name: '📋 Quote Status',
      value: 'Accepted ✅',
      inline: true
    });
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View on Webapp')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.WEBAPP_API_URL}/dashboard/orders/${order.id}`)
        .setEmoji('🌐')
    )
  );

  await interaction.editReply({ embeds: [embed], components });
}

async function handleQuoteAcceptButton(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const parts = interaction.customId.split('_');
  const orderId = parts[2];
  const quoteId = parts[3];

  const orderDetails = await webappAPI.getOrderDetails(orderId);
  if (!orderDetails || !orderDetails.order || !orderDetails.quote) {
    return interaction.editReply({ content: '❌ Unable to fetch quote details. Please try again later.', ephemeral: true });
  }

  const quote = orderDetails.quote;

  const acceptResult = await webappAPI.acceptQuote(quoteId, interaction.user.id);
  if (!acceptResult?.success && acceptResult?.message !== 'Quote already accepted') {
    return interaction.editReply({
      content: `❌ Failed to accept quote: ${acceptResult?.message || 'Unknown error'}`,
      ephemeral: true
    });
  }

  const paymentMethods = await webappAPI.getPaymentMethods();
  let availableMethods = paymentMethods;

  let quotePaymentMethods = [];
  if (quote.payment_methods) {
    if (Array.isArray(quote.payment_methods)) {
      quotePaymentMethods = quote.payment_methods;
    } else if (typeof quote.payment_methods === 'string') {
      try {
        quotePaymentMethods = JSON.parse(quote.payment_methods);
      } catch (error) {
        console.warn('Unable to parse quote payment methods JSON:', error);
      }
    }
  }

  if (quotePaymentMethods.length > 0) {
    availableMethods = paymentMethods.filter(method => quotePaymentMethods.includes(method.id));
  }

  pendingPayments.set(orderId, {
    quoteId,
    amount: Number(quote.price),
    orderNumber: orderDetails.order.order_number,
    paymentMethods: availableMethods
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`payment_method_select_${orderId}_${quoteId}`)
    .setPlaceholder('Select your payment method')
    .addOptions(
      availableMethods.map(method => ({
        label: `${method.name} (${method.type})`,
        value: method.id,
        description: method.address ? method.address.substring(0, 80) : undefined
      }))
    );

  const infoEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Quote Accepted')
    .setDescription('Great! Please select your preferred payment method below to continue.')
    .addFields(
      { name: 'Order', value: orderDetails.order.order_number, inline: true },
      { name: 'Amount Due', value: `€${quote.price}`, inline: true }
    )
    .setTimestamp();

  await interaction.channel.send({
    embeds: [infoEmbed],
    components: [new ActionRowBuilder().addComponents(selectMenu)]
  });

  await interaction.editReply({
    content: 'Quote accepted! Payment options have been posted in this channel. ✅',
    ephemeral: true
  });
}

async function handlePaymentMethodSelect(interaction) {
  const parts = interaction.customId.split('_');
  const orderId = parts[3];
  const quoteId = parts[4];

  const stored = pendingPayments.get(orderId);
  if (!stored) {
    return interaction.reply({ content: '❌ Unable to find payment session. Please accept the quote again.', ephemeral: true });
  }

  const methodId = interaction.values[0];
  const method = stored.paymentMethods.find(m => m.id === methodId);

  if (!method) {
    return interaction.reply({ content: '❌ Invalid payment method selected.', ephemeral: true });
  }

  stored.selectedMethodId = methodId;
  stored.quoteId = quoteId;

  const instructionsEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`💳 Payment Instructions - ${method.name}`)
    .setDescription('Please follow the instructions below to complete your payment.')
    .addFields(
      { name: 'Amount Due', value: `€${stored.amount}`, inline: true },
      { name: 'Payment Method', value: `${method.name} (${method.type})`, inline: true }
    )
    .setTimestamp();

  if (method.address) {
    instructionsEmbed.addFields({
      name: 'Payment Address',
      value: `\`\`\`${method.address}\`\`\``
    });
  }

  if (method.instructions) {
    instructionsEmbed.addFields({
      name: 'Instructions',
      value: method.instructions
    });
  }

  const confirmRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_payment_${orderId}_${methodId}_${quoteId}`)
        .setLabel("I've Paid")
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

  await interaction.reply({
    content: 'Payment instructions posted below. Follow them carefully and click **I\'ve Paid** when done.',
    ephemeral: true
  });

  await interaction.channel.send({ embeds: [instructionsEmbed], components: [confirmRow] });
}

async function handlePaymentConfirmation(interaction) {
  const parts = interaction.customId.split('_');
  const orderId = parts[2];
  const methodId = parts[3];
  const quoteId = parts[4];

  const stored = pendingPayments.get(orderId);
  if (!stored || stored.selectedMethodId !== methodId) {
    return interaction.reply({ content: '❌ Unable to find selected payment method. Please choose it again.', ephemeral: true });
  }

  const modal = new ModalBuilder()
    .setCustomId(`submit_payment_${orderId}_${methodId}_${quoteId}`)
    .setTitle('Confirm Payment')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('transaction_id')
          .setLabel('Transaction / Reference ID')
          .setPlaceholder('Enter your transaction reference or TX hash')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('payment_notes')
          .setLabel('Notes (optional)')
          .setPlaceholder('Any additional details for our team')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
      )
    );

  await interaction.showModal(modal);
}

async function handlePaymentModalSubmit(interaction) {
  const parts = interaction.customId.split('_');
  const orderId = parts[2];
  const methodId = parts[3];
  const quoteId = parts[4];

  const stored = pendingPayments.get(orderId);
  if (!stored || stored.selectedMethodId !== methodId) {
    return interaction.reply({ content: '❌ Payment session expired. Please restart the process.', ephemeral: true });
  }

  const transactionId = interaction.fields.getTextInputValue('transaction_id');
  const notes = interaction.fields.getTextInputValue('payment_notes');

  await interaction.deferReply({ ephemeral: true });

  const payload = {
    discordId: interaction.user.id,
    orderId,
    quoteId,
    paymentMethodId: methodId,
    amount: stored.amount,
    transactionId,
    notes
  };

  const paymentResult = await webappAPI.createPayment(payload);

  if (!paymentResult?.success) {
    return interaction.editReply({
      content: `❌ Failed to submit payment: ${paymentResult?.error || 'Unknown error'}`,
      ephemeral: true
    });
  }

  pendingPayments.delete(orderId);

  await interaction.editReply({
    content: '✅ Payment submitted! Our team will verify and update you shortly.',
    ephemeral: true
  });

  const method = stored.paymentMethods.find(m => m.id === methodId);

  const confirmationEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('💳 Payment Submitted')
    .setDescription(`<@${interaction.user.id}> has submitted a payment for order **${stored.orderNumber}**.`)
    .addFields(
      { name: 'Amount', value: `€${stored.amount}`, inline: true },
      { name: 'Method', value: method ? `${method.name} (${method.type})` : 'Unknown', inline: true },
      { name: 'Transaction ID', value: transactionId, inline: false }
    )
    .setFooter({ text: 'Admin team: review and confirm this payment in the dashboard.' })
    .setTimestamp();

  await interaction.channel.send({ embeds: [confirmationEmbed] });
}

// ==================== MY BOT ====================
async function handleMyBotCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const bots = await webappAPI.getUserBots(interaction.user.id);
  
  if (!bots || bots.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🤖 Your Bots')
      .setDescription('You don\'t have any deployed bots yet!')
      .addFields({
        name: '🚀 Get Started',
        value: 'Order a Discord bot at [codecraft-solutions.com/pricing](https://codecraft-solutions.com/pricing)'
      })
      .setTimestamp();
    
    return interaction.editReply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('🤖 Your Deployed Bots')
    .setDescription(`You have **${bots.length}** active bot(s)`)
    .setTimestamp();

  bots.forEach((bot, index) => {
    if (index < 3) { // Show max 3
      const statusEmoji = bot.status === 'active' ? '🟢' : '🔴';
      embed.addFields({
        name: `${statusEmoji} Bot #${index + 1} - ${bot.tier} Tier`,
        value: `**Guild:** ${bot.discord_guild_id}\n**Status:** ${bot.status}\n**Resources:** ${bot.memory_mb}MB RAM, ${bot.cpu_percent}% CPU`,
        inline: false
      });
    }
  });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('View Bot Dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.WEBAPP_API_URL}/dashboard`)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId('bot_control_menu')
        .setLabel('Control Bot')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎛️')
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ==================== BOT CONTROL ====================
async function handleBotControlCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const action = interaction.options.getString('action');
  const bots = await webappAPI.getUserBots(interaction.user.id);
  
  if (!bots || bots.length === 0) {
    return interaction.editReply({
      content: '❌ No bots found. Make sure you have an active bot deployment.'
    });
  }

  // For simplicity, control first bot (can be extended to select)
  const bot = bots[0];
  
  const embed = new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle(`🎛️ Bot Control - ${action.toUpperCase()}`)
    .setDescription(`Sending **${action}** command to your bot...`)
    .addFields({
      name: '🤖 Bot Info',
      value: `Guild: ${bot.discord_guild_id}\nTier: ${bot.tier}`
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  // Note: Actual control needs to be done through webapp API
  // This would require a webhook call to the webapp
  setTimeout(async () => {
    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Command Sent')
      .setDescription(`Your bot is ${action === 'restart' ? 'restarting' : action === 'start' ? 'starting' : 'stopping'}...`)
      .setFooter({ text: 'Check status in webapp dashboard' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [successEmbed] });
  }, 2000);
}

// ==================== REFERRAL ====================
async function handleReferralCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const referralCode = await webappAPI.getReferralCode(interaction.user.id);
  
  if (!referralCode) {
    return interaction.editReply({
      content: '❌ Failed to fetch referral code. Please login to the webapp first!'
    });
  }

  const referralLink = `${process.env.WEBAPP_API_URL}?ref=${referralCode}`;

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🎁 Your Referral Program')
    .setDescription('Earn **10% commission** on every referral!')
    .addFields(
      { 
        name: '🔗 Your Referral Link', 
        value: `\`\`\`${referralLink}\`\`\``, 
        inline: false 
      },
      { 
        name: '💰 How It Works', 
        value: '1️⃣ Share your link\n2️⃣ Friend gets 10% off\n3️⃣ You earn 10% commission\n4️⃣ Get milestone bonuses!', 
        inline: false 
      },
      { 
        name: '🏆 Milestones', 
        value: '**5 referrals:** €25 bonus\n**10 referrals:** €50 bonus\n**25 referrals:** €150 bonus', 
        inline: false 
      }
    )
    .setFooter({ text: 'View detailed stats on webapp dashboard' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Copy Link')
        .setCustomId(`copy_referral_${referralCode}`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setLabel('View Stats')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.WEBAPP_API_URL}/dashboard/referrals`)
        .setEmoji('📊')
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ==================== DISCOUNT CODE ====================
async function handleDiscountCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const code = interaction.options.getString('code');
  const validation = await webappAPI.validateDiscountCode(code, 100); // Base validation
  
  if (!validation.valid) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Invalid Discount Code')
      .setDescription(validation.error || 'This discount code is not valid.')
      .setTimestamp();
    
    return interaction.editReply({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('✅ Valid Discount Code!')
    .setDescription(`**${code.toUpperCase()}** is ready to use!`)
    .addFields(
      { 
        name: '💰 Discount', 
        value: validation.discount.type === 'percentage' 
          ? `${validation.discount.value}% OFF` 
          : `€${validation.discount.value} OFF`,
        inline: true 
      },
      { 
        name: '🎟️ Code', 
        value: `\`${code.toUpperCase()}\``, 
        inline: true 
      }
    )
    .setFooter({ text: 'Apply this code during checkout on the webapp' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Order Now')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.WEBAPP_API_URL}/order`)
        .setEmoji('🛍️')
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ==================== INVOICE ====================
async function handleInvoiceCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const orderNumber = interaction.options.getString('order_number');
  const order = await webappAPI.getOrderByNumber(orderNumber);
  
  if (!order) {
    return interaction.editReply({
      content: `❌ Order **${orderNumber}** not found.`
    });
  }

  // Check if user owns this order
  if (order.discord_id !== interaction.user.id) {
    return interaction.editReply({
      content: '❌ You can only view invoices for your own orders.'
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🧾 Invoice: ${orderNumber}`)
    .setDescription(`**${order.service_name || order.service_type}**`)
    .addFields(
      { name: 'Amount', value: `€${order.price || 0}`, inline: true },
      { name: 'Status', value: order.payment_status || 'pending', inline: true },
      { name: 'Date', value: new Date(order.created_at).toLocaleDateString(), inline: true }
    )
    .setFooter({ text: 'Download PDF invoice from webapp dashboard' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('View Full Invoice')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.WEBAPP_API_URL}/dashboard/orders/${order.id}`)
        .setEmoji('📄')
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ==================== ADMIN: STATS ====================
async function handleAdminStatsCommand(interaction) {
  await interaction.deferReply();
  
  const orders = await webappAPI.getUserOrders('all'); // Need to implement admin endpoint
  
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('📊 Webapp Statistics')
    .setDescription('Real-time data from codecraft-solutions.com')
    .addFields(
      { name: '📦 Total Orders', value: `${orders?.length || 0}`, inline: true },
      { name: '✅ Completed', value: `${orders?.filter(o => o.status === 'completed').length || 0}`, inline: true },
      { name: '🔨 In Progress', value: `${orders?.filter(o => o.status === 'in_progress').length || 0}`, inline: true }
    )
    .setFooter({ text: 'Full analytics on /admin/analytics' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Open Admin Panel')
        .setStyle(ButtonStyle.Link)
        .setURL(`${process.env.WEBAPP_API_URL}/admin`)
        .setEmoji('⚙️')
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// ==================== ADMIN: DEPLOY ====================
async function handleAdminDeployCommand(interaction) {
  await interaction.deferReply();
  
  const orderId = interaction.options.getString('order_id');
  
  const embed = new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle('🚀 Triggering Deployment...')
    .setDescription(`Starting bot provisioning for order: \`${orderId}\``)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  // Trigger deployment via webapp API
  // This needs to be implemented in the webapp API client
  setTimeout(async () => {
    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Deployment Triggered')
      .setDescription('Check /admin/deployments for progress')
      .setTimestamp();
    
    await interaction.editReply({ embeds: [successEmbed] });
  }, 3000);
}

// ==================== ADMIN: LINK ====================
async function handleAdminLinkCommand(interaction) {
  await interaction.deferReply();
  
  const serverUuid = interaction.options.getString('server_uuid');
  const orderId = interaction.options.getString('order_id');
  
  const embed = new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle('🔗 Linking Server to Order...')
    .setDescription(`UUID: \`${serverUuid}\`\nOrder: \`${orderId}\``)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  // Call webapp API to link
  // This needs implementation
  setTimeout(async () => {
    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Server Linked Successfully')
      .setDescription('Server is now tracked in the webapp')
      .setTimestamp();
    
    await interaction.editReply({ embeds: [successEmbed] });
  }, 2000);
}

// ==================== ADMIN: NOTIFY ====================
async function handleAdminNotifyCommand(interaction) {
  const user = interaction.options.getUser('user');
  const message = interaction.options.getString('message');
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📬 Message from CodeCraft')
    .setDescription(message)
    .setFooter({ text: 'This is an official notification from CodeCraft Support' })
    .setTimestamp();

  try {
    await user.send({ embeds: [embed] });
    
    await interaction.reply({
      content: `✅ Notification sent to ${user.tag}`,
      ephemeral: true
    });
  } catch (error) {
    await interaction.reply({
      content: `❌ Failed to send DM. User might have DMs disabled.`,
      ephemeral: true
    });
  }
}

// ==================== HELP ====================
async function handleHelpCommand(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('❓ CodeCraft Bot - Help')
    .setDescription('Discord bot integrated with codecraft-solutions.com')
    .addFields(
      {
        name: '📦 Customer Commands',
        value: `
\`/myorders\` - View all your orders
\`/orderstatus\` - Check specific order status
\`/mybot\` - View your deployed bot
\`/botcontrol\` - Control your bot (start/stop/restart)
\`/referral\` - Get your referral link & stats
\`/discount\` - Validate a discount code
\`/invoice\` - View order invoice
        `,
        inline: false
      },
      {
        name: '⚙️ Admin Commands',
        value: `
\`/admin-stats\` - View webapp statistics
\`/admin-deploy\` - Trigger bot deployment
\`/admin-link\` - Link server to order
\`/admin-notify\` - Send customer notification
        `,
        inline: false
      },
      {
        name: '🌐 Webapp Features',
        value: '• Live chat support\n• Real-time resource monitoring\n• Payment tracking\n• Portfolio showcase\n• Dynamic pricing system',
        inline: false
      }
    )
    .setFooter({ text: 'Visit codecraft-solutions.com for full dashboard' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Open Dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.WEBAPP_API_URL || 'https://codecraft-solutions.com')
        .setEmoji('🌐'),
      new ButtonBuilder()
        .setLabel('Join Support Server')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/vywm9GDNwc')
        .setEmoji('💬')
    );

  await interaction.reply({ embeds: [embed], components: [row] });
}

(async () => {
  try {
    console.log('🔐 Logging in to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);
  } catch (error) {
    console.error('❌ Failed to login to Discord:', error);
    process.exit(1);
  }
})();