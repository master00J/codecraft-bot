/**
 * API Route: Game Verified Users List
 * /api/comcraft/guilds/[guildId]/game-verification/users
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

    const url = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

    const { data, error, count } = await supabaseAdmin
      .from('game_verified_users')
      .select('*', { count: 'exact' })
      .eq('guild_id', guildId)
      .order('verified_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching game verified users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
    return NextResponse.json({ users: data || [], count: count ?? 0, limit, offset });
  } catch (e: any) {
    console.error('Game verification users GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
