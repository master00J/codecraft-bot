/**
 * Service Catalog Module for CodeCraft Solutions
 * Manages available services and pricing
 */

const { EmbedBuilder } = require('discord.js');
const { 
  getSupabase, 
  isSupabaseAvailable, 
  getOrCreateUser,
  generateOrderNumber 
} = require('./supabase-client');

// Service catalog with detailed information
const SERVICES = {
  webshop: {
    id: 'webshop',
    name: 'E-Commerce Development',
    category: 'Web Development',
    description: 'Complete online store with payment processing',
    tiers: [
      {
        name: 'Starter Shop',
        price: 1500,
        features: [
          'Up to 100 products',
          'Basic design customization',
          'Single payment gateway',
          'Mobile responsive',
          'Basic SEO',
          'Order management',
          'Customer accounts'
        ],
        timeline: '2-3 weeks'
      },
      {
        name: 'Professional Shop',
        price: 3500,
        features: [
          'Unlimited products',
          'Custom design',
          'Multiple payment gateways',
          'Advanced SEO',
          'Inventory management',
          'Email automation',
          'Analytics dashboard',
          'Multi-language support',
          'Discount & coupon system'
        ],
        timeline: '3-5 weeks'
      },
      {
        name: 'Enterprise Shop',
        price: 7500,
        features: [
          'Everything in Professional',
          'Multi-vendor marketplace',
          'Advanced analytics',
          'Custom integrations',
          'API access',
          'Priority support',
          'Performance optimization',
          'Custom features on request'
        ],
        timeline: '6-8 weeks'
      }
    ]
  },
  
  discord_bot: {
    id: 'discord_bot',
    name: 'Discord Bot Development',
    category: 'Automation',
    description: 'Custom Discord bot for your community',
    tiers: [
      {
        name: 'Basic Bot',
        price: 300,
        features: [
          'Up to 10 custom commands',
          'Basic moderation',
          'Role management',
          'Welcome messages',
          'Auto-responses',
          'Simple games'
        ],
        timeline: '1 week'
      },
      {
        name: 'Advanced Bot',
        price: 800,
        features: [
          'Unlimited commands',
          'Advanced moderation',
          'Ticket system',
          'Economy system',
          'Music playback',
          'Custom embeds',
          'Logging system',
          'Web dashboard'
        ],
        timeline: '2-3 weeks'
      },
      {
        name: 'AI-Powered Bot',
        price: 1500,
        features: [
          'Everything in Advanced',
          'AI chat integration',
          'Natural language processing',
          'Smart auto-moderation',
          'Sentiment analysis',
          'Custom AI training',
          'Advanced analytics'
        ],
        timeline: '3-4 weeks'
      }
    ]
  },
  
  website: {
    id: 'website',
    name: 'Website Development',
    category: 'Web Development',
    description: 'Modern, responsive websites',
    tiers: [
      {
        name: 'Landing Page',
        price: 500,
        features: [
          'Single page design',
          'Mobile responsive',
          'Contact form',
          'SEO basics',
          'Social media links',
          'Fast loading'
        ],
        timeline: '3-5 days'
      },
      {
        name: 'Business Website',
        price: 1500,
        features: [
          '5-10 pages',
          'Custom design',
          'CMS integration',
          'Blog functionality',
          'SEO optimization',
          'Analytics setup',
          'Contact forms',
          'Gallery/Portfolio'
        ],
        timeline: '2-3 weeks'
      },
      {
        name: 'Web Application',
        price: 3000,
        features: [
          'Complex functionality',
          'User authentication',
          'Database integration',
          'API development',
          'Admin panel',
          'Real-time features',
          'Advanced security'
        ],
        timeline: '4-6 weeks'
      }
    ]
  },
  
  api: {
    id: 'api',
    name: 'API Development',
    category: 'Backend',
    description: 'RESTful APIs and backend services',
    tiers: [
      {
        name: 'Basic API',
        price: 1000,
        features: [
          'Up to 10 endpoints',
          'Basic authentication',
          'CRUD operations',
          'JSON responses',
          'Basic documentation',
          'Error handling'
        ],
        timeline: '1-2 weeks'
      },
      {
        name: 'Standard API',
        price: 2500,
        features: [
          'Unlimited endpoints',
          'JWT authentication',
          'Role-based access',
          'Rate limiting',
          'Webhooks',
          'Detailed documentation',
          'Testing suite',
          'Monitoring setup'
        ],
        timeline: '3-4 weeks'
      },
      {
        name: 'Enterprise API',
        price: 5000,
        features: [
          'Microservices architecture',
          'GraphQL support',
          'Advanced security',
          'Load balancing',
          'Caching layer',
          'CI/CD pipeline',
          'Performance optimization',
          'SLA guarantee'
        ],
        timeline: '6-8 weeks'
      }
    ]
  },
  
  custom: {
    id: 'custom',
    name: 'Custom Software',
    category: 'Custom',
    description: 'Tailored solutions for unique requirements',
    tiers: [
      {
        name: 'Consultation',
        price: 100,
        features: [
          '1-hour consultation',
          'Requirements analysis',
          'Technology recommendations',
          'Project roadmap',
          'Cost estimation'
        ],
        timeline: 'Immediate'
      },
      {
        name: 'Small Project',
        price: 2000,
        features: [
          'Custom solution',
          'Up to 100 hours',
          'Full documentation',
          'Testing included',
          '30-day support'
        ],
        timeline: '2-4 weeks'
      },
      {
        name: 'Large Project',
        price: 10000,
        features: [
          'Complex solution',
          'Unlimited scope',
          'Dedicated team',
          'Agile development',
          'Regular updates',
          '90-day support',
          'Training included'
        ],
        timeline: '2-6 months'
      }
    ]
  }
};

/**
 * Get complete service catalog
 */
function getServiceCatalog() {
  return SERVICES;
}

/**
 * Get specific service details
 */
function getService(serviceId) {
  return SERVICES[serviceId] || null;
}

/**
 * Generate service embed
 */
function generateServiceEmbed(serviceId, tierIndex = null) {
  const service = SERVICES[serviceId];
  if (!service) return null;
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${service.name}`)
    .setDescription(service.description);
  
  if (tierIndex !== null && service.tiers[tierIndex]) {
    // Show specific tier
    const tier = service.tiers[tierIndex];
    embed.addFields(
      { name: 'Package', value: tier.name, inline: true },
      { name: 'Price', value: `$${tier.price}`, inline: true },
      { name: 'Timeline', value: tier.timeline, inline: true },
      { name: 'Features', value: tier.features.map(f => `✓ ${f}`).join('\n'), inline: false }
    );
  } else {
    // Show all tiers
    service.tiers.forEach(tier => {
      embed.addFields({
        name: `${tier.name} - $${tier.price}`,
        value: `**Timeline:** ${tier.timeline}\n${tier.features.slice(0, 3).map(f => `• ${f}`).join('\n')}\n*...and ${tier.features.length - 3} more features*`,
        inline: false
      });
    });
  }
  
  embed.setFooter({ text: 'Use /order to start your project' });
  embed.setTimestamp();
  
  return embed;
}

/**
 * Calculate project quote
 */
function calculateQuote(services, options = {}) {
  let total = 0;
  let items = [];
  let timeline = 0;
  
  services.forEach(item => {
    const service = SERVICES[item.serviceId];
    if (!service) return;
    
    const tier = service.tiers[item.tierIndex || 0];
    if (!tier) return;
    
    let price = tier.price;
    
    // Apply quantity if applicable
    if (item.quantity) {
      price *= item.quantity;
    }
    
    items.push({
      name: `${service.name} - ${tier.name}`,
      price: price,
      timeline: tier.timeline
    });
    
    total += price;
    
    // Calculate max timeline (projects can run in parallel)
    const weeks = parseInt(tier.timeline) || 2;
    timeline = Math.max(timeline, weeks);
  });
  
  // Apply discounts
  let discount = 0;
  if (options.firstTime) {
    discount = total * 0.15; // 15% first-time discount
  } else if (items.length > 1) {
    discount = total * 0.20; // 20% bundle discount
  }
  
  // Apply rush delivery surcharge
  if (options.rush) {
    total *= 1.5; // 50% rush surcharge
    timeline = Math.ceil(timeline / 2); // Half the timeline
  }
  
  return {
    items,
    subtotal: total,
    discount,
    total: total - discount,
    timeline: `${timeline} weeks`,
    savings: discount > 0 ? `You save $${discount.toFixed(2)}!` : null
  };
}

/**
 * Create order from service selection
 */
async function createOrder(db, customerId, services, options = {}) {
  try {
    const orderNumber = generateOrderNumber();
    const quote = calculateQuote(services, options);
    
    // Try Supabase first
    if (isSupabaseAvailable()) {
      const supabase = getSupabase();
      
      // Get Discord user info
      const discordUser = options.discordUser || {};
      const discordId = discordUser.id || customerId;
      const discordTag = discordUser.tag || `User#${discordId.slice(-4)}`;
      
      // Get or create user in Supabase
      const user = await getOrCreateUser(discordId, discordTag);
      
      const serviceDetails = {
        services: services,
        quote: quote,
        options: options
      };
      
      // Insert order into Supabase
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user?.id || null,
          discord_id: discordId,
          service_type: services.map(s => s.serviceId).join(', '),
          service_name: services.map(s => SERVICES[s.serviceId]?.name || s.serviceId).join(', '),
          description: `Order for ${services.length} service(s)`,
          price: quote.total,
          budget: quote.total.toString(),
          timeline: quote.estimatedTimeline,
          status: 'pending',
          payment_status: 'pending',
          discord_channel_id: options.channelId || null
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating order in Supabase:', error);
        // Fall back to SQLite if Supabase fails
      } else {
        console.log(`✅ Order ${orderNumber} created in Supabase`);
        return {
          orderNumber,
          orderId: order.id,
          quote,
          database: 'supabase'
        };
      }
    }
    
    // Fallback to SQLite
    const stmt = db.prepare(`
      INSERT INTO orders (
        order_number, 
        customer_id, 
        service_type, 
        service_details, 
        price, 
        status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const serviceDetails = {
      services: services,
      quote: quote,
      options: options
    };
    
    const info = stmt.run(
      orderNumber,
      customerId,
      services.map(s => s.serviceId).join(', '),
      JSON.stringify(serviceDetails),
      quote.total,
      'pending'
    );
    
    return {
      success: true,
      orderId: info.lastInsertRowid,
      orderNumber,
      quote
    };
    
  } catch (error) {
    console.error('Error creating order:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get popular service bundles
 */
function getPopularBundles() {
  return [
    {
      name: 'Startup Package',
      description: 'Everything you need to launch online',
      services: [
        { serviceId: 'website', tierIndex: 1 },
        { serviceId: 'discord_bot', tierIndex: 0 }
      ],
      originalPrice: 1800,
      bundlePrice: 1440,
      savings: 360
    },
    {
      name: 'E-Commerce Complete',
      description: 'Full online business solution',
      services: [
        { serviceId: 'webshop', tierIndex: 1 },
        { serviceId: 'discord_bot', tierIndex: 1 },
        { serviceId: 'api', tierIndex: 0 }
      ],
      originalPrice: 5300,
      bundlePrice: 4240,
      savings: 1060
    },
    {
      name: 'Developer Special',
      description: 'Backend and automation tools',
      services: [
        { serviceId: 'api', tierIndex: 1 },
        { serviceId: 'discord_bot', tierIndex: 2 }
      ],
      originalPrice: 4000,
      bundlePrice: 3200,
      savings: 800
    }
  ];
}

module.exports = {
  getServiceCatalog,
  getService,
  generateServiceEmbed,
  calculateQuote,
  createOrder,
  getPopularBundles,
  SERVICES
};

