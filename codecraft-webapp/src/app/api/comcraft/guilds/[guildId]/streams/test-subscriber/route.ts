/**
 * API Route: Test Twitch Subscriber Notification
 * /api/comcraft/guilds/[guildId]/streams/test-subscriber
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST - Send test subscriber notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const body = await request.json();
    const { notificationId, subscriberName, tier, cumulativeMonths } = body;

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }

    // Send test request to bot
    const botWebhookUrl = process.env.BOT_WEBHOOK_URL;
    
    if (!botWebhookUrl) {
      return NextResponse.json({ 
        error: 'Bot webhook URL not configured',
        hint: 'Set BOT_WEBHOOK_URL in webapp .env'
      }, { status: 503 });
    }

    console.log(`🧪 Sending test subscriber notification for guild ${guildId}, notification ${notificationId}`);
    console.log(`   Months: ${cumulativeMonths || 1}`);

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
        cumulative_months: cumulativeMonths || 1
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to send test notification:', errorData);
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
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

