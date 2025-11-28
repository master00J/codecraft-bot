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

  if (guildError || !guild) {
    console.error('Guild lookup error:', guildError);
    return { allowed: false, reason: 'Guild not found' };
  }

  if (guild.owner_discord_id === discordId) {
    return { allowed: true };
  }

  const { data: authorized } = await supabaseAdmin
    .from('authorized_users')
    .select('user_id')
    .eq('guild_id', guildId)
    .eq('user_id', discordId)
    .maybeSingle();

  if (authorized) {
    return { allowed: true };
  }

  // Check if user is platform admin
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return { allowed: true };
  }

  console.log('Access denied for user', discordId, 'to guild', guildId);
  return { allowed: false, reason: 'Access denied' };
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

    const { guildId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get casino config
    const { data: config, error: configError } = await supabaseAdmin
      .from('casino_configs')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Error fetching casino config:', configError);
      return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
    }

    // Get casino stats (aggregated)
    const { data: statsData, error: statsError } = await supabaseAdmin
      .from('casino_history')
      .select('bet_amount, win_amount')
      .eq('guild_id', guildId);

    let stats = null;
    if (!statsError && statsData) {
      const totalGames = statsData.length;
      const totalWagered = statsData.reduce((sum, game) => sum + Number(game.bet_amount || 0), 0);
      const totalPayout = statsData.reduce((sum, game) => sum + Number(game.win_amount || 0), 0);
      const houseProfit = totalWagered - totalPayout;

      stats = {
        total_games: totalGames,
        total_wagered: totalWagered,
        total_payout: totalPayout,
        house_profit: houseProfit,
      };
    }

    return NextResponse.json({
      config: config || {
        guild_id: guildId,
        enabled_games: {
          dice: true,
          slots: true,
          coinflip: true,
          blackjack: true,
        },
        min_bet: 10,
        max_bet: 10000,
        house_edge: 0.05,
      },
      stats,
    });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/casino:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
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

    const { guildId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { enabled_games, min_bet, max_bet, house_edge } = body;

    // Validate input
    if (min_bet !== undefined && (min_bet < 1 || !Number.isInteger(min_bet))) {
      return NextResponse.json({ error: 'min_bet must be a positive integer' }, { status: 400 });
    }

    if (max_bet !== undefined && (max_bet < 1 || !Number.isInteger(max_bet))) {
      return NextResponse.json({ error: 'max_bet must be a positive integer' }, { status: 400 });
    }

    if (min_bet !== undefined && max_bet !== undefined && min_bet > max_bet) {
      return NextResponse.json({ error: 'min_bet cannot be greater than max_bet' }, { status: 400 });
    }

    if (house_edge !== undefined && (house_edge < 0 || house_edge > 0.5)) {
      return NextResponse.json({ error: 'house_edge must be between 0 and 0.5' }, { status: 400 });
    }

    // Check if config exists
    const { data: existingConfig } = await supabaseAdmin
      .from('casino_configs')
      .select('guild_id')
      .eq('guild_id', guildId)
      .maybeSingle();

    const updateData: any = {};
    if (enabled_games !== undefined) updateData.enabled_games = enabled_games;
    if (min_bet !== undefined) updateData.min_bet = min_bet;
    if (max_bet !== undefined) updateData.max_bet = max_bet;
    if (house_edge !== undefined) updateData.house_edge = house_edge;

    let result;
    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabaseAdmin
        .from('casino_configs')
        .update(updateData)
        .eq('guild_id', guildId)
        .select()
        .single();

      if (error) {
        console.error('Error updating casino config:', error);
        return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
      }

      result = data;
    } else {
      // Create new config
      const { data, error } = await supabaseAdmin
        .from('casino_configs')
        .insert({
          guild_id: guildId,
          enabled_games: enabled_games || {
            dice: true,
            slots: true,
            coinflip: true,
            blackjack: true,
          },
          min_bet: min_bet || 10,
          max_bet: max_bet || 10000,
          house_edge: house_edge || 0.05,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating casino config:', error);
        return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
      }

      result = data;
    }

    return NextResponse.json({ config: result, success: true });
  } catch (error: any) {
    console.error('Error in PATCH /api/comcraft/guilds/[guildId]/casino:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

