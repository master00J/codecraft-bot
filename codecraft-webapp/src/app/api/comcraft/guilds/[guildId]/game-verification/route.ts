/**
 * API Route: Game Verification Config
 * /api/comcraft/guilds/[guildId]/game-verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getGuildAccess(guildId: string, discordId: string) {
  const { data: guild, error: guildError } = await supabaseAdmin
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (guildError || !guild) return { allowed: false, reason: 'Guild not found' };
  if (guild.owner_discord_id === discordId) return { allowed: true };

  const { data: authorized } = await supabaseAdmin
    .from('guild_authorized_users')
    .select('discord_id')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();
  if (authorized) return { allowed: true };

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();
  if (user?.is_admin) return { allowed: true };

  return { allowed: false, reason: 'Access denied' };
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
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('game_verification_config')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching game verification config:', error);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    const config = data || {
      guild_id: guildId,
      game_name: 'In-Game',
      unregistered_role_id: null,
      verified_role_id: null,
      one_time_only: true,
      enabled: false
    };
    return NextResponse.json({ config });
  } catch (e: any) {
    console.error('Game verification GET error:', e);
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
    const discordId = (session.user as any).discordId || (session.user as any).id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const payload: Record<string, unknown> = {
      guild_id: guildId,
      updated_at: new Date().toISOString()
    };
    if (typeof body.game_name === 'string') payload.game_name = body.game_name;
    if (body.unregistered_role_id !== undefined) payload.unregistered_role_id = body.unregistered_role_id || null;
    if (body.verified_role_id !== undefined) payload.verified_role_id = body.verified_role_id || null;
    if (typeof body.one_time_only === 'boolean') payload.one_time_only = body.one_time_only;
    if (typeof body.enabled === 'boolean') payload.enabled = body.enabled;

    const { data, error } = await supabaseAdmin
      .from('game_verification_config')
      .upsert(payload, { onConflict: 'guild_id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating game verification config:', error);
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }
    return NextResponse.json({ success: true, config: data });
  } catch (e: any) {
    console.error('Game verification PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
