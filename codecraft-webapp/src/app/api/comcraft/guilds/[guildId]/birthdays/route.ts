/**
 * API Route: Birthday Management
 * /api/comcraft/guilds/[guildId]/birthdays
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
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

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

    await assertAccess(guildId, discordId);

    const { data: birthdays, error } = await supabase
      .from('comcraft_birthdays')
      .select('*')
      .eq('guild_id', guildId)
      .order('birthday', { ascending: true });

    if (error) {
      console.error('Error fetching birthdays:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const { data: settings } = await supabase
      .from('guild_configs')
      .select(
        `birthdays_enabled,
         birthday_channel_id,
         birthday_role_id,
         birthday_message_template,
         birthday_ping_role,
         birthday_announcement_time`
      )
      .eq('guild_id', guildId)
      .single();

    return NextResponse.json({
      birthdays: birthdays || [],
      settings: settings || null
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in birthdays GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    await assertAccess(guildId, discordId);

    const body = await request.json();

    if (!body.user_id || !body.birthday) {
      return NextResponse.json({ error: 'user_id and birthday are required' }, { status: 400 });
    }

    const birthdayDate = new Date(body.birthday);
    if (Number.isNaN(birthdayDate.getTime())) {
      return NextResponse.json({ error: 'Invalid birthday date' }, { status: 400 });
    }

    const payload = {
      guild_id: guildId,
      user_id: body.user_id,
      username: body.username || null,
      display_name: body.display_name || null,
      birthday: birthdayDate.toISOString().split('T')[0],
      timezone: body.timezone || null,
      is_private: !!body.is_private,
      notes: body.notes || null
    };

    const { data, error } = await supabase
      .from('comcraft_birthdays')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error inserting birthday:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, birthday: data });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error creating birthday:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    await assertAccess(guildId, discordId);

    const body = await request.json();
    const birthdayId = body.id;

    if (!birthdayId) {
      return NextResponse.json({ error: 'Birthday ID required' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      username: body.username ?? null,
      display_name: body.display_name ?? null,
      timezone: body.timezone ?? null,
      is_private: body.is_private ?? false,
      notes: body.notes ?? null
    };

    if (body.birthday) {
      const birthdayDate = new Date(body.birthday);
      if (Number.isNaN(birthdayDate.getTime())) {
        return NextResponse.json({ error: 'Invalid birthday date' }, { status: 400 });
      }
      updates.birthday = birthdayDate.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('comcraft_birthdays')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', birthdayId)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating birthday:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, birthday: data });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error updating birthday:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    await assertAccess(guildId, discordId);

    const { searchParams } = new URL(request.url);
    const birthdayId = searchParams.get('id');

    if (!birthdayId) {
      return NextResponse.json({ error: 'Birthday ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('comcraft_birthdays')
      .delete()
      .eq('id', birthdayId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting birthday:', error);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error deleting birthday:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
