import { NextRequest, NextResponse } from 'next/server';

/**
 * TEST Gifted Subscription Notification Proxy
 * Proxies test gifted sub requests to the Discord bot
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const { notificationId, gifterName, amount, tier } = await request.json();
    const guildId = params.guildId;

    console.log('🧪 Proxying test gifted sub notification request...');
    console.log('   Guild:', guildId);
    console.log('   Notification:', notificationId);
    console.log('   Gifter:', gifterName || 'TestGifter');
    console.log('   Amount:', amount || 1);
    console.log('   Tier:', tier || '1000');

    const botWebhookUrl = process.env.BOT_WEBHOOK_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (!botWebhookUrl || !internalSecret) {
      return NextResponse.json(
        { success: false, error: 'Bot webhook not configured' },
        { status: 500 }
      );
    }

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
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('   ❌ Bot returned error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('   ✅ Test gifted sub notification sent successfully');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in test gifted sub notification API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

