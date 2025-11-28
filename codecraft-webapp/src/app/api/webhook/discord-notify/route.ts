import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Webhook endpoint to trigger Discord bot notifications
 * Called from webapp events to notify users via Discord DM
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal secret
    const secret = request.headers.get('X-Internal-Secret')
    if (secret !== process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, discordId, data } = await request.json()

    if (!type || !discordId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, discordId' },
        { status: 400 }
      )
    }

    // Send notification to Discord bot via webhook
    // The bot should have an HTTP server listening for these
    const botWebhookUrl = process.env.DISCORD_BOT_WEBHOOK_URL

    if (!botWebhookUrl) {
      console.warn('⚠️ DISCORD_BOT_WEBHOOK_URL not configured')
      return NextResponse.json({
        success: false,
        message: 'Bot webhook not configured'
      })
    }

    const response = await fetch(botWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DISCORD_BOT_TOKEN}`
      },
      body: JSON.stringify({
        type,
        discordId,
        data
      })
    })

    if (!response.ok) {
      throw new Error(`Bot webhook returned ${response.status}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent to Discord'
    })

  } catch (error) {
    console.error('Error sending Discord notification:', error)
    return NextResponse.json({
      error: 'Failed to send notification',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

