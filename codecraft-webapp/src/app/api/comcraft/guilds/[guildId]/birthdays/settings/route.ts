/**
 * API Route: Birthday Settings
 * /api/comcraft/guilds/[guildId]/birthdays/settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function assertAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (!guild) {
    throw NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  }

  if (guild.owner_discord_id === discordId) {
    return true;
  }

  const { data: authorized } = await supabase
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .single();

  if (authorized) {
    return true;
  }

  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();

  if (user?.is_admin) {
    return true;
  }

  throw NextResponse.json({ error: 'Access denied' }, { status: 403 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
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

    await assertAccess(params.guildId, discordId);

    const { data, error } = await supabase
      .from('guild_configs')
      .select(
        `birthdays_enabled,
         birthday_channel_id,
         birthday_role_id,
         birthday_message_template,
         birthday_ping_role,
         birthday_announcement_time`
      )
      .eq('guild_id', params.guildId)
      .single();

    if (error) {
      console.error('Error fetching birthday settings:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in birthday settings GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
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

    await assertAccess(params.guildId, discordId);

    const body = await request.json();

    const payload: Record<string, any> = {};

    if (typeof body.birthdays_enabled === 'boolean') {
      payload.birthdays_enabled = body.birthdays_enabled;
    }
    if ('birthday_channel_id' in body) {
      payload.birthday_channel_id = body.birthday_channel_id || null;
    }
    if ('birthday_role_id' in body) {
      payload.birthday_role_id = body.birthday_role_id || null;
    }
    if ('birthday_message_template' in body) {
      payload.birthday_message_template = body.birthday_message_template || 'Happy birthday {user}! 🎂';
    }
    if (typeof body.birthday_ping_role === 'boolean') {
      payload.birthday_ping_role = body.birthday_ping_role;
    }
    if ('birthday_announcement_time' in body) {
      payload.birthday_announcement_time = body.birthday_announcement_time || '09:00:00';
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('guild_configs')
      .update(payload)
      .eq('guild_id', params.guildId);

    if (error) {
      console.error('Error updating birthday settings:', error);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error updating birthday settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
