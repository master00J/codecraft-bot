import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const CODECRAFT_KNOWLEDGE = `
# CodeCraft Solutions - Services & Pricing

## Discord Bots
Custom Discord bots with moderation, games, AI integration, and more.
- **Basic Bot**: From $25 - Essential features, 10 commands, basic moderation
- **Advanced Bot**: From $300 - Full features, unlimited commands, ticket system, leveling
- **AI-Powered Bot**: From $800 - Smart automation, AI chat, advanced analytics
**Timeline**: 1-3 weeks
**Technologies**: Discord.js, Node.js, SQLite/PostgreSQL

## E-Commerce Development
Full-featured online stores with payment integration.
- **Starter Shop**: From $500 - Basic e-commerce, up to 100 products, Stripe integration
- **Professional Shop**: From $1,500 - Full features, unlimited products, admin dashboard
- **Enterprise Shop**: From $3,500+ - Custom solutions, multi-vendor, advanced analytics
**Timeline**: 2-6 weeks
**Technologies**: React, Next.js, Node.js, Stripe API, PostgreSQL

## Web Applications
Modern, responsive websites and web applications.
- **Landing Page**: From $150 - Single page, responsive design, SEO optimized
- **Business Website**: From $500 - Multi-page site, CMS integration, contact forms
- **Web Application**: From $1,500+ - Complex apps, user authentication, database integration
**Timeline**: 1-4 weeks
**Technologies**: React, Next.js, TypeScript, Tailwind CSS

## Order Process
1. **Consultation**: Discuss your requirements via chat or Discord
2. **Quote**: Receive detailed quote with timeline and deliverables
3. **Agreement**: Accept quote and sign agreement
4. **Development**: Regular updates during development
5. **Delivery**: Final product with documentation and support
6. **Payment**: Flexible payment options (50% upfront, 50% on delivery)

## Support
- 24/7 customer support via Discord
- Average response time: 2 hours
- Free bug fixes for 30 days after delivery
- Optional maintenance packages available

## Contact
- Website: codecraft-solutions.com
- Discord: Join our server for instant support
- Email: Available through contact form
`;

const SYSTEM_PROMPT = `You are the CodeCraft Solutions AI Sales Assistant. Your role is to help potential customers understand our services, pricing, and order process.

Guidelines:
- Be friendly, professional, and concise
- Provide accurate pricing information from the knowledge base
- Ask clarifying questions to understand customer needs (project scope, budget, timeline)
- Guide customers through the order process
- If asked about technical details beyond your knowledge, offer to connect them with a human specialist
- Always mention our Discord server for instant support
- Keep responses under 150 words unless detailed explanation is needed
- Use bullet points for clarity when listing features or options

When a customer shows interest:
1. Understand their needs (what they want to build)
2. Recommend appropriate service tier
3. Provide pricing estimate
4. Explain next steps (consultation, quote, development)
5. Offer to connect them with our team via Discord or contact form`;

function extractTextFromBlocks(blocks: Array<any>): string {
  if (!Array.isArray(blocks)) return '';
  const fragments: string[] = [];
  const collect = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (typeof node === 'string') {
      const trimmed = node.trim();
      if (trimmed) fragments.push(trimmed);
      return;
    }
    if (typeof node !== 'object') {
      return;
    }
    if (node.type === 'text' && typeof node.text === 'string') {
      const trimmed = node.text.trim();
      if (trimmed) fragments.push(trimmed);
    }
    if (Array.isArray(node.content)) {
      collect(node.content);
    }
  };
  collect(blocks);
  return fragments.join('\n\n').trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversation_history = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Build conversation history for Claude
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    // Add conversation history (last 10 messages for context)
    const recentHistory = conversation_history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.is_admin) {
        messages.push({ role: 'assistant', content: msg.message });
      } else {
        messages.push({ role: 'user', content: msg.message });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: 0.7,
      system: `${SYSTEM_PROMPT}\n\n# Knowledge Base\n${CODECRAFT_KNOWLEDGE}`,
      messages,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3,
        },
      ],
    });

    const aiResponse = extractTextFromBlocks(response.content) ||
      (response.content[0]?.type === 'text' ? response.content[0].text : '') ||
      'I apologize, but I encountered an error. Please try again or contact our support team.';

    return NextResponse.json({
      success: true,
      response: aiResponse,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error: any) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate AI response',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

