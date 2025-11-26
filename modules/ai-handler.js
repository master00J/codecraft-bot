/**
 * AI Handler Module for CodeCraft Solutions
 * Integrates with Google Gemini for intelligent customer support
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

// Service knowledge base
const CODECRAFT_KNOWLEDGE = {
  services: {
    webshop: {
      name: 'E-Commerce Development',
      description: 'Full-featured web shops with payment integration',
      features: [
        'Custom design & branding',
        'Product catalog management',
        'Shopping cart & checkout',
        'Multiple payment gateways (Stripe, PayPal, Crypto)',
        'Order management system',
        'Customer accounts',
        'Admin dashboard',
        'Inventory tracking',
        'Email notifications',
        'SEO optimization'
      ],
      pricing: {
        starter: { price: 1500, features: 'Basic e-commerce, up to 100 products' },
        professional: { price: 3500, features: 'Full features, unlimited products' },
        enterprise: { price: 7500, features: 'Custom solutions, multi-vendor' }
      },
      timeline: '2-6 weeks',
      technologies: ['React', 'Node.js', 'Express', 'MongoDB', 'Stripe API']
    },
    discord_bot: {
      name: 'Discord Bot Development',
      description: 'Custom Discord bots for communities and businesses',
      features: [
        'Custom commands',
        'Moderation tools',
        'Role management',
        'Ticket system',
        'Economy system',
        'Games & entertainment',
        'Music playback',
        'AI integration',
        'Dashboard interface',
        'Auto-moderation'
      ],
      pricing: {
        basic: { price: 300, features: 'Essential features, 10 commands' },
        advanced: { price: 800, features: 'Full features, unlimited commands' },
        ai_powered: { price: 1500, features: 'AI integration, smart responses' }
      },
      timeline: '1-3 weeks',
      technologies: ['Discord.js', 'Node.js', 'SQLite/PostgreSQL', 'Express']
    },
    website: {
      name: 'Website Development',
      description: 'Modern, responsive websites',
      features: [
        'Responsive design',
        'SEO optimization',
        'Contact forms',
        'Content management',
        'Analytics integration',
        'Social media integration',
        'Blog functionality',
        'Newsletter signup',
        'Multi-language support',
        'Performance optimization'
      ],
      pricing: {
        landing: { price: 500, features: 'Single page, contact form' },
        business: { price: 1500, features: '5-10 pages, CMS' },
        application: { price: 3000, features: 'Complex web app, database' }
      },
      timeline: '1-4 weeks',
      technologies: ['React', 'Next.js', 'Tailwind CSS', 'Node.js']
    },
    api: {
      name: 'API Development',
      description: 'RESTful APIs and backend services',
      features: [
        'RESTful design',
        'Authentication & authorization',
        'Database integration',
        'Rate limiting',
        'Documentation',
        'Webhooks',
        'Third-party integrations',
        'Data validation',
        'Error handling',
        'Testing suite'
      ],
      pricing: {
        basic: { price: 1000, features: 'Simple API, 10 endpoints' },
        standard: { price: 2500, features: 'Complex API, authentication' },
        enterprise: { price: 5000, features: 'Scalable architecture, microservices' }
      },
      timeline: '2-4 weeks',
      technologies: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker']
    }
  },
  
  faq: [
    {
      question: 'How long does development take?',
      answer: 'Project timelines vary: Simple websites (1-2 weeks), Discord bots (1-3 weeks), E-commerce sites (2-6 weeks), Complex applications (4-12 weeks). We provide accurate estimates after reviewing your requirements.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept Credit/Debit cards via Stripe, PayPal, Cryptocurrency (Bitcoin, Ethereum), and Bank transfers. Payment plans are available for projects over $2000.'
    },
    {
      question: 'Do you provide ongoing support?',
      answer: 'Yes! All projects include 30 days of free support. After that, we offer maintenance packages starting at $99/month or hourly support at $75/hour.'
    },
    {
      question: 'Can you work with existing code?',
      answer: 'Absolutely! We can enhance, fix, or rebuild existing projects. We\'ll review your code and provide recommendations.'
    },
    {
      question: 'Do you offer hosting services?',
      answer: 'We can set up and manage hosting for your project on platforms like AWS, Vercel, or DigitalOcean. Hosting costs are separate from development fees.'
    },
    {
      question: 'What technologies do you use?',
      answer: 'We specialize in modern web technologies: React, Next.js, Node.js, Express, MongoDB, PostgreSQL, Discord.js, and more. We choose the best stack for your specific needs.'
    },
    {
      question: 'How do you handle project communication?',
      answer: 'We communicate via Discord (preferred), email, or scheduled video calls. You\'ll have direct access to your project channel for real-time updates.'
    },
    {
      question: 'What if I need changes during development?',
      answer: 'Minor changes are included. Major scope changes may affect timeline and cost, but we\'ll always discuss this with you first.'
    }
  ],
  
  policies: {
    refund: 'Full refund if project hasn\'t started. 50% refund if less than 50% complete. No refund after 50% completion.',
    payment: '50% upfront, 50% on completion for projects under $2000. 33% milestones for larger projects.',
    revision: 'Unlimited revisions during development. Post-launch changes billed hourly.',
    ownership: 'You own 100% of the code and assets upon final payment.',
    confidentiality: 'We sign NDAs and maintain strict confidentiality for all projects.'
  }
};

const SYSTEM_PROMPT = `You are Nova, an AI assistant for CodeCraft Solutions, a modern web development company specializing in web shops, Discord bots, websites, and custom software.

Your personality:
- Professional yet friendly
- Enthusiastic about technology
- Patient and helpful
- Use emojis appropriately (not excessively)
- Focus on understanding customer needs

Your responsibilities:
1. Answer questions about services and pricing
2. Help customers choose the right solution
3. Explain technical concepts in simple terms
4. Collect project requirements
5. Provide accurate quotes based on the knowledge base
6. Guide customers through the order process

Knowledge base provided: ${JSON.stringify(CODECRAFT_KNOWLEDGE, null, 2)}

Important guidelines:
- Always be accurate with pricing (use exact prices from knowledge base)
- If unsure, say you'll get a human team member to help
- Be encouraging about their project ideas
- Suggest relevant services based on their needs
- Mention special offers: 15% first-time discount, 20% bundle discount
- For complex requests, suggest a free consultation

When discussing projects:
- Ask clarifying questions to understand requirements
- Suggest the most appropriate service tier
- Explain what's included in each package
- Mention timeline estimates
- Highlight relevant technologies we use

Remember: You're here to help customers realize their digital dreams with CodeCraft Solutions!`;

/**
 * Initialize AI with Gemini
 */
async function initializeAI() {
  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️ Gemini API key not found, AI features will be limited');
    return false;
  }
  
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Test the connection
    const result = await model.generateContent('Say "OK" if you\'re ready');
    const response = await result.response;
    const text = response.text();
    
    if (text) {
      console.log('✅ AI initialized successfully with Gemini');
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to initialize AI:', error.message);
    
    // Try fallback model
    try {
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      console.log('✅ AI initialized with fallback model');
      return true;
    } catch (fallbackError) {
      console.error('❌ Fallback model also failed:', fallbackError.message);
      return false;
    }
  }
  
  return false;
}

/**
 * Handle AI message processing
 */
async function handleAIMessage(message, context = {}) {
  // If no AI model, provide basic responses
  if (!model) {
    return getFallbackResponse(message, context);
  }
  
  try {
    // Build conversation context
    let contextPrompt = SYSTEM_PROMPT + '\n\n';
    
    if (context.type === 'ticket') {
      contextPrompt += `This is a support ticket. Ticket ID: ${context.ticket_number}\n`;
      contextPrompt += `Subject: ${context.subject}\n\n`;
    } else if (context.type === 'order') {
      contextPrompt += `This is an order discussion. Order ID: ${context.order.order_number}\n`;
      contextPrompt += `Service: ${context.order.service_type}\n`;
      contextPrompt += `Status: ${context.order.status}\n\n`;
    }
    
    contextPrompt += `Customer message: ${message}\n\n`;
    contextPrompt += `Provide a helpful, accurate response. If they're asking about pricing, use exact prices from the knowledge base. If they want to order, guide them to use the /order command.`;
    
    const result = await model.generateContent(contextPrompt);
    const response = await result.response;
    return response.text();
    
  } catch (error) {
    console.error('AI processing error:', error);
    return getFallbackResponse(message, context);
  }
}

/**
 * Fallback responses when AI is not available
 */
function getFallbackResponse(message, context) {
  const lowerMessage = message.toLowerCase();
  
  // Pricing questions
  if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
    return `💰 **Pricing Information**

**Web Shops:** $1,500 - $7,500+
**Discord Bots:** $300 - $1,500+
**Websites:** $500 - $3,000+
**API Development:** $1,000 - $5,000+

All projects include:
• Free consultation
• 30 days of support
• 100% code ownership
• 15% first-time discount available!

For a detailed quote, please use \`/order\` or describe your project needs!`;
  }
  
  // Service questions
  if (lowerMessage.includes('service') || lowerMessage.includes('what do you')) {
    return `🚀 **Our Services**

• **Web Shop Development** - Full e-commerce solutions with payment integration
• **Discord Bot Development** - Custom bots for your community
• **Website Development** - Modern, responsive websites
• **API Development** - Backend services and integrations
• **Custom Software** - Tailored solutions for your needs

Use \`/services\` for detailed information or \`/order\` to start your project!`;
  }
  
  // Timeline questions
  if (lowerMessage.includes('how long') || lowerMessage.includes('timeline') || lowerMessage.includes('when')) {
    return `⏱️ **Project Timelines**

• **Simple Website:** 1-2 weeks
• **Discord Bot:** 1-3 weeks
• **E-commerce Site:** 2-6 weeks
• **Complex Application:** 4-12 weeks

We'll provide an accurate timeline after reviewing your specific requirements!`;
  }
  
  // Order/start questions
  if (lowerMessage.includes('order') || lowerMessage.includes('start') || lowerMessage.includes('begin')) {
    return `📦 **Ready to Start Your Project?**

Use the \`/order\` command to begin! You can choose from:
• Web Shop Development
• Discord Bot
• Website
• API Development
• Custom Software

We'll guide you through the process and provide a detailed quote!`;
  }
  
  // Support questions
  if (lowerMessage.includes('help') || lowerMessage.includes('support') || lowerMessage.includes('question')) {
    return `🤝 **How Can We Help?**

I'm here to assist with:
• Service information and pricing
• Project requirements discussion
• Technical questions
• Order status updates

For immediate assistance, feel free to ask your question here, or create a support ticket with \`/ticket\`!`;
  }
  
  // Default response
  return `Thanks for your message! I'm here to help with your web development needs.

Quick actions:
• View services: \`/services\`
• Start a project: \`/order\`
• Get pricing: \`/pricing\`
• Create support ticket: \`/ticket\`

How can I assist you today?`;
}

/**
 * Generate a project quote based on requirements
 */
function generateQuote(requirements) {
  // Parse requirements and calculate pricing
  let totalPrice = 0;
  let services = [];
  let timeline = '2-4 weeks';
  
  const lower = requirements.toLowerCase();
  
  if (lower.includes('shop') || lower.includes('e-commerce') || lower.includes('store')) {
    services.push('E-Commerce Development');
    totalPrice += 3500; // Professional tier default
    timeline = '3-5 weeks';
  }
  
  if (lower.includes('bot') || lower.includes('discord')) {
    services.push('Discord Bot Development');
    totalPrice += 800; // Advanced tier default
    timeline = '2-3 weeks';
  }
  
  if (lower.includes('website') || lower.includes('site')) {
    services.push('Website Development');
    totalPrice += 1500; // Business tier default
    timeline = '2-3 weeks';
  }
  
  if (lower.includes('api') || lower.includes('backend')) {
    services.push('API Development');
    totalPrice += 2500; // Standard tier default
    timeline = '3-4 weeks';
  }
  
  // Apply discounts
  let discount = 0;
  if (services.length > 1) {
    discount = totalPrice * 0.20; // 20% bundle discount
  } else {
    discount = totalPrice * 0.15; // 15% first-time discount
  }
  
  return {
    services,
    subtotal: totalPrice,
    discount,
    total: totalPrice - discount,
    timeline
  };
}

module.exports = {
  initializeAI,
  handleAIMessage,
  generateQuote,
  CODECRAFT_KNOWLEDGE
};

