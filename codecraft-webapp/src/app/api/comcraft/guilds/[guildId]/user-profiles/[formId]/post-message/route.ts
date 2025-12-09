import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getGuildAccess(guildId: string, discordId: string) {
  const { data: guild, error: guildError } = await supabaseAdmin
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (guildError || !guild) {
    return { allowed: false, reason: 'Guild not found' };
  }

  if (guild.owner_discord_id === discordId) {
    return { allowed: true };
  }

  const { data: authorized } = await supabaseAdmin
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (authorized) {
    return { allowed: true };
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Access denied' };
}

// POST - Post the form message to Discord channel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; formId: string }> }
) {
  const { guildId, formId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get form
    const { data: form, error: formError } = await supabaseAdmin
      .from('user_profiles_forms')
      .select('*')
      .eq('id', formId)
      .eq('guild_id', guildId)
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Call bot API to post message
    const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
    const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

    if (!INTERNAL_SECRET) {
      return NextResponse.json(
        { error: 'Internal API secret not configured' },
        { status: 500 }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let response;
    try {
      response = await fetch(`${COMCRAFT_BOT_API}/api/profile/post-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET
        },
        body: JSON.stringify({
          formId: form.id,
          guildId: form.guild_id
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Bot API timeout - is the bot running?' },
          { status: 500 }
        );
      }
      if (error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { error: 'Bot API connection refused - is the bot running?' },
          { status: 500 }
        );
      }
      throw error;
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text().catch(() => 'Unknown error');
        return NextResponse.json(
          { error: errorText || 'Failed to post message to Discord' },
          { status: response.status }
        );
      }
      return NextResponse.json(
        { error: errorData.error || errorData.message || 'Failed to post message to Discord' },
        { status: response.status }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      console.error('Error parsing bot API response:', error);
      return NextResponse.json(
        { error: 'Invalid response from bot API' },
        { status: 500 }
      );
    }

    if (!data || !data.success) {
      return NextResponse.json(
        { error: data?.error || data?.message || 'Failed to post message to Discord' },
        { status: 500 }
      );
    }

    // Update form with message ID
    await supabaseAdmin
      .from('user_profiles_forms')
      .update({ message_id: data.messageId })
      .eq('id', formId);

    return NextResponse.json({ success: true, messageId: data.messageId });
  } catch (error: any) {
    console.error('Error in POST /api/comcraft/guilds/[guildId]/user-profiles/[formId]/post-message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

