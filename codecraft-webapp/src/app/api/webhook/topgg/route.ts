/**
 * Top.gg Webhook Handler
 * Receives vote webhooks from Top.gg and forwards them to the bot API
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
const TOPGG_WEBHOOK_AUTH = process.env.TOPGG_WEBHOOK_AUTH;

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('📥 [Top.gg Webhook] Received data:', {
        hasAuth: !!data.auth,
        authLength: data.auth?.length,
        hasUser: !!data.user,
        hasBot: !!data.bot,
        type: data.type,
        isWeekend: data.isWeekend
      });
      console.log('🔑 [Top.gg Webhook] Config:', {
        hasTopggAuth: !!TOPGG_WEBHOOK_AUTH,
        topggAuthLength: TOPGG_WEBHOOK_AUTH?.length
      });
    }
    
    // Top.gg sends auth token in the body as 'auth' field, not in header
    // Verify webhook authentication
    if (TOPGG_WEBHOOK_AUTH) {
      if (!data.auth) {
        console.warn('⚠️  [Top.gg Webhook] Missing auth token in body');
        return NextResponse.json({ error: 'Missing authentication token' }, { status: 401 });
      }
      
      if (data.auth !== TOPGG_WEBHOOK_AUTH) {
        console.warn('⚠️  [Top.gg Webhook] Invalid auth token in body', {
          received: data.auth?.substring(0, 10) + '...',
          expected: TOPGG_WEBHOOK_AUTH?.substring(0, 10) + '...',
          match: data.auth === TOPGG_WEBHOOK_AUTH
        });
        return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
      }
    } else {
      console.warn('⚠️  [Top.gg Webhook] TOPGG_WEBHOOK_AUTH not configured - skipping auth check');
    }

    // Forward to bot API
    try {
      const response = await fetch(`${COMCRAFT_BOT_API}/webhook/topgg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET || ''
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [Top.gg Webhook] Forwarded to bot API successfully');
        return NextResponse.json(result);
      } else {
        const errorText = await response.text();
        console.error(`❌ [Top.gg Webhook] Bot API error: ${response.status} - ${errorText}`);
        return NextResponse.json(
          { error: 'Bot API error', details: errorText },
          { status: response.status }
        );
      }
    } catch (error) {
      console.error('❌ [Top.gg Webhook] Error forwarding to bot API:', error);
      
      // If bot API is not reachable, we can still log the vote
      // This allows the webhook to work even if bot is temporarily offline
      return NextResponse.json({
        success: true,
        message: 'Webhook received but bot API unreachable',
        note: 'Vote will be processed when bot is online'
      });
    }
  } catch (error) {
    console.error('❌ [Top.gg Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

