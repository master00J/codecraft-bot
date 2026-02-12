/**
 * API Route: Rank Nickname Configuration
 * Optional: when a member has a configured role, nickname becomes [PREFIX] (Username)
 * GET = list, POST = add, DELETE = remove by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function checkGuildAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (!guild) return false;
  if (guild.owner_discord_id === discordId) return true;

  const { data: authorized } = await supabase
    .from('authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('user_id', discordId)
    .maybeSingle();

  if (authorized) return true;

  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  return user?.is_admin === true;
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

    const discordId = (session.user as any).discordId || (session.user as any).id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    if (!(await checkGuildAccess(guildId, discordId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('rank_nickname_config')
      .select('id, role_id, prefix')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching rank nickname config:', error);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    return NextResponse.json({ success: true, list: data || [] });
  } catch (error) {
    console.error('Error in rank nickname GET:', error);
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

    const discordId = (session.user as any).discordId || (session.user as any).id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    if (!(await checkGuildAccess(guildId, discordId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const role_id = body.role_id?.trim();
    const prefix = body.prefix?.trim().slice(0, 20) || '';

    if (!role_id || !prefix) {
      return NextResponse.json({ error: 'role_id and prefix are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('rank_nickname_config')
      .upsert(
        { guild_id: guildId, role_id, prefix },
        { onConflict: 'guild_id,role_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving rank nickname:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Error in rank nickname POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = (session.user as any).discordId || (session.user as any).id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    if (!(await checkGuildAccess(guildId, discordId))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id query param required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('rank_nickname_config')
      .delete()
      .eq('guild_id', guildId)
      .eq('id', id);

    if (error) {
      console.error('Error deleting rank nickname:', error);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in rank nickname DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
