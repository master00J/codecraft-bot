import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * TEST Gifted Subscription Notification Proxy
 * Proxies test gifted sub requests to the Discord bot
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const { notificationId, gifterName, amount, tier } = await request.json();
    const guildId = params.guildId;

    console.log('🧪 Proxying test gifted sub notification request...');
    console.log('   Guild:', guildId);
    console.log('   Notification:', notificationId);
    console.log('   Gifter:', gifterName || 'TestGifter');
    console.log('   Amount:', amount || 1);
    console.log('   Tier:', tier || '1000');

    // Check if this guild has a custom bot running in a Docker container
    let useCustomBot = false;
    
    try {
      const { data: customBot } = await supabaseAdmin
        .from('custom_bot_tokens')
        .select('runs_on_pterodactyl, pterodactyl_server_uuid, bot_online')
        .eq('guild_id', guildId)
        .single();
      
      if (customBot && customBot.runs_on_pterodactyl) {
        useCustomBot = true;
        console.log(`🔍 Guild ${guildId} uses custom bot in Docker container (UUID: ${customBot.pterodactyl_server_uuid})`);
        console.log(`   Bot status: ${customBot.bot_online ? 'Online' : 'Offline'}`);
      }
    } catch (dbError: any) {
      console.log(`   Could not check custom bot status: ${dbError.message}`);
    }

    const botWebhookUrl = process.env.BOT_WEBHOOK_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (!botWebhookUrl || !internalSecret) {
      return NextResponse.json(
        { success: false, error: 'Bot webhook not configured' },
        { status: 500 }
      );
    }

    console.log(`   Using: ${useCustomBot ? 'Custom bot (Docker container)' : 'Main bot'}`);

    // Forward request to bot
    const response = await fetch(`${botWebhookUrl}/api/twitch/test-gifted-sub`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': internalSecret,
      },
      body: JSON.stringify({
        guild_id: guildId,
        notification_id: notificationId,
        gifter_name: gifterName || 'TestGifter',
        amount: amount || 1,
        tier: tier || '1000',
        use_custom_bot: useCustomBot // Tell main bot server to proxy to custom bot if needed
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('   ❌ Bot returned error:', data);
      
      // If it's a fetch error (network issue), provide more helpful message
      if (data.error?.includes('fetch failed') || data.error?.includes('ECONNREFUSED')) {
        return NextResponse.json({ 
          success: false,
          error: 'Could not connect to bot server. The custom bot container may be offline or not accessible.',
          details: data,
          hint: useCustomBot ? 'Make sure the custom bot container is running and accessible.' : 'Make sure the main bot server is running.'
        }, { status: response.status || 503 });
      }
      
      return NextResponse.json(data, { status: response.status });
    }

    console.log('   ✅ Test gifted sub notification sent successfully');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in test gifted sub notification API:', error);
    
    // Check if it's a network/fetch error
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { success: false, error: 'Could not connect to bot server. The bot may be offline or not accessible.', message: error.message },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

