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

// GET - Fetch maid jobs statistics
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

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get total cleanings
    const { data: cleaningsData, error: cleaningsError } = await supabaseAdmin
      .from('maid_cleanings')
      .select('coins_earned, xp_earned')
      .eq('guild_id', guildId);

    // Get active sessions
    const { data: activeSessions, error: sessionsError } = await supabaseAdmin
      .from('maid_sessions')
      .select('id')
      .eq('guild_id', guildId)
      .eq('status', 'active');

    // Get total statistics (fallback to manual calculation if RPC doesn't exist)
    let statsData = null;
    try {
      const { data, error } = await supabaseAdmin
        .rpc('aggregate_maid_stats', { p_guild_id: guildId })
        .single();
      
      if (!error) {
        statsData = data;
      }
    } catch {
      // RPC doesn't exist, use manual calculation
      const { data } = await supabaseAdmin
        .from('maid_statistics')
        .select('total_cleanings, total_coins_earned, total_xp_earned')
        .eq('guild_id', guildId);
      statsData = data;
    }

    const totalCleanings = cleaningsData?.length || 0;
    const totalCoinsEarned = cleaningsData?.reduce((sum, c) => sum + (c.coins_earned || 0), 0) || 0;
    const totalXpEarned = cleaningsData?.reduce((sum, c) => sum + (c.xp_earned || 0), 0) || 0;
    const activeSessionsCount = activeSessions?.length || 0;

    const statistics = {
      total_cleanings: totalCleanings,
      active_sessions: activeSessionsCount,
      total_coins_earned: totalCoinsEarned,
      total_xp_earned: totalXpEarned
    };

    return NextResponse.json({ statistics });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/maid-jobs/statistics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

