/**
 * API Route: Test Twitch Subscriber Notification
 * /api/comcraft/guilds/[guildId]/streams/test-subscriber
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * POST - Send test subscriber notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, subscriberName, tier, cumulativeMonths } = body;

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }

    // Check if this guild has a custom bot running in a Docker container
    let botWebhookUrl = process.env.BOT_WEBHOOK_URL;
    let useCustomBot = false;
    
    try {
      const { data: customBot } = await supabaseAdmin
        .from('custom_bot_tokens')
        .select('runs_on_pterodactyl, pterodactyl_server_uuid, bot_online')
        .eq('guild_id', guildId)
        .single();
      
      if (customBot && customBot.runs_on_pterodactyl) {
        // This guild uses a custom bot in a Docker container
        // The main bot server will proxy the request to the container
        useCustomBot = true;
        console.log(`🔍 Guild ${guildId} uses custom bot in Docker container (UUID: ${customBot.pterodactyl_server_uuid})`);
        console.log(`   Bot status: ${customBot.bot_online ? 'Online' : 'Offline'}`);
      }
    } catch (dbError: any) {
      // If we can't check, continue with main bot
      console.log(`   Could not check custom bot status: ${dbError.message}`);
    }

    if (!botWebhookUrl) {
      return NextResponse.json({ 
        error: 'Bot webhook URL not configured',
        hint: 'Set BOT_WEBHOOK_URL in webapp .env'
      }, { status: 503 });
    }

    console.log(`🧪 Sending test subscriber notification for guild ${guildId}, notification ${notificationId}`);
    console.log(`   Months: ${cumulativeMonths || 1}`);
    console.log(`   Using: ${useCustomBot ? 'Custom bot (Docker container)' : 'Main bot'}`);

    const response = await fetch(`${botWebhookUrl}/api/twitch/test-subscriber`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
      },
      body: JSON.stringify({
        guild_id: guildId,
        notification_id: notificationId,
        subscriber_name: subscriberName || 'TestUser',
        tier: tier || '1000',
        cumulative_months: cumulativeMonths || 1,
        use_custom_bot: useCustomBot // Tell main bot server to proxy to custom bot if needed
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Failed to send test notification:', errorData);
      
      // If it's a fetch error (network issue), provide more helpful message
      if (errorData.error?.includes('fetch failed') || errorData.error?.includes('ECONNREFUSED')) {
        return NextResponse.json({ 
          error: 'Could not connect to bot server. The custom bot container may be offline or not accessible.',
          details: errorData,
          hint: useCustomBot ? 'Make sure the custom bot container is running and accessible.' : 'Make sure the main bot server is running.'
        }, { status: response.status || 503 });
      }
      
      return NextResponse.json({ 
        error: errorData.error || 'Failed to send test notification',
        details: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('✅ Test notification sent successfully');

    return NextResponse.json({ 
      success: true,
      message: 'Test subscriber notification sent successfully!'
    });
  } catch (error: any) {
    console.error('Error in test subscriber notification API:', error);
    
    // Check if it's a network/fetch error
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json({ 
        error: 'Could not connect to bot server. The bot may be offline or not accessible.',
        message: error.message 
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

