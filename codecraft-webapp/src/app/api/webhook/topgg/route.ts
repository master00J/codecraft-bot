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
      const authHeader = request.headers.get('authorization');
      console.log('📥 [Top.gg Webhook] Received data:', {
        hasAuthHeader: !!authHeader,
        hasAuthInBody: !!data.auth,
        authHeaderLength: authHeader?.length,
        authBodyLength: data.auth?.length,
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
    
    // Top.gg sends auth token in Authorization header (primary method)
    // Some implementations may also send it in body as 'auth' field (fallback)
    // Verify webhook authentication
    if (TOPGG_WEBHOOK_AUTH) {
      const authHeader = request.headers.get('authorization');
      const authInBody = data.auth;
      
      // Check Authorization header first (primary method)
      if (authHeader && authHeader === TOPGG_WEBHOOK_AUTH) {
        // Valid auth in header
        console.log('✅ [Top.gg Webhook] Authentication verified via Authorization header');
      } 
      // Fallback: check auth in body
      else if (authInBody && authInBody === TOPGG_WEBHOOK_AUTH) {
        // Valid auth in body
        console.log('✅ [Top.gg Webhook] Authentication verified via body auth field');
      }
      // No valid auth found
      else {
        console.warn('⚠️  [Top.gg Webhook] Missing or invalid auth token', {
          hasAuthHeader: !!authHeader,
          hasAuthBody: !!authInBody,
          authHeaderMatch: authHeader === TOPGG_WEBHOOK_AUTH,
          authBodyMatch: authInBody === TOPGG_WEBHOOK_AUTH
        });
        return NextResponse.json({ error: 'Missing or invalid authentication token' }, { status: 401 });
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

