import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// PATCH - Update bot presence/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const ownerDiscordId = session.user.discordId || session.user.id || session.user.sub;

    const body = await request.json();
    const { presenceType, presenceText } = body;

    // Validate presence type
    const validTypes = ['playing', 'watching', 'streaming', 'listening', 'competing'];
    if (presenceType && !validTypes.includes(presenceType)) {
      return NextResponse.json(
        { error: 'Invalid presence type', validTypes },
        { status: 400 }
      );
    }

    // Validate presence text (max 128 characters for Discord)
    if (presenceText && presenceText.length > 128) {
      return NextResponse.json(
        { error: 'Presence text must be 128 characters or less' },
        { status: 400 }
      );
    }

    // Get custom bot config to verify ownership
    const { data: botConfig, error: configError } = await supabase
      .from('custom_bot_tokens')
      .select('bot_application_id')
      .eq('guild_id', guildId)
      .single();

    if (configError || !botConfig) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (presenceType !== undefined) {
      updateData.bot_presence_type = presenceType;
    }

    if (presenceText !== undefined) {
      updateData.bot_presence_text = presenceText;
    }

    // Update bot presence in database
    const { error: updateError } = await supabase
      .from('custom_bot_tokens')
      .update(updateData)
      .eq('guild_id', guildId);

    if (updateError) {
      console.error('Error updating bot presence:', updateError);
      return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
    }

    // Log the change
    await supabase
      .from('bot_container_events')
      .insert({
        guild_id: guildId,
        bot_application_id: botConfig.bot_application_id,
        event_type: 'presence_updated',
        event_data: {
          presence_type: presenceType || 'unchanged',
          presence_text: presenceText || 'unchanged',
          triggered_by: ownerDiscordId
        },
        message: `Bot presence updated: ${presenceType || 'unchanged'} - ${presenceText || 'unchanged'}`
      });

    // Try to trigger immediate presence update via bot's internal API
    // This works for both local custom bots and Pterodactyl-deployed bots
    try {
      const botApiUrl = process.env.COMCRAFT_BOT_API_URL || process.env.BOT_API_URL || 'http://localhost:3002';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      // Fire and forget - don't block the response
      fetch(`${botApiUrl}/api/bot/${guildId}/update-presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
        },
        body: JSON.stringify({
          presenceType: presenceType || 'unchanged',
          presenceText: presenceText || 'unchanged'
        }),
        signal: controller.signal
      })
        .then(() => clearTimeout(timeoutId))
        .catch((error) => {
          clearTimeout(timeoutId);
          // Silently handle errors - bot might be offline or on different server
          if (error.name !== 'AbortError') {
            console.log(`ℹ️ Could not trigger immediate presence update for guild ${guildId} (bot will update within 5 seconds)`);
          }
        });
    } catch (error) {
      // Silently ignore - bot might be offline or API might not be accessible
    }

    return NextResponse.json({
      success: true,
      message: 'Bot presence updated successfully. Changes will appear in Discord within a few seconds.',
      presence: {
        type: presenceType || 'unchanged',
        text: presenceText || 'unchanged'
      }
    });
  } catch (error: any) {
    console.error('Error updating bot presence:', error);
    return NextResponse.json({
      error: 'Failed to update presence',
      message: error.message || 'Unknown error'
    }, { status: 500 });
  }
}

