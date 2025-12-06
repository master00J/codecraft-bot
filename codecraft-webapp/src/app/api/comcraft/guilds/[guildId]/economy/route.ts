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

    // Get economy config
    const { data: config, error: configError } = await supabaseAdmin
      .from('economy_configs')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Error fetching economy config:', configError);
      return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
    }

    // Get economy stats (aggregated)
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('user_economy')
      .select('balance, total_earned')
      .eq('guild_id', guildId);

    const { data: transactionsData, error: transactionsError } = await supabaseAdmin
      .from('economy_transactions')
      .select('id')
      .eq('guild_id', guildId);

    let stats = null;
    if (!usersError && usersData) {
      const totalUsers = usersData.length;
      const totalBalance = usersData.reduce((sum, user) => sum + Number(user.balance || 0), 0);
      const totalEarned = usersData.reduce((sum, user) => sum + Number(user.total_earned || 0), 0);
      const totalTransactions = transactionsData?.length || 0;

      stats = {
        total_users: totalUsers,
        total_balance: totalBalance,
        total_earned: totalEarned,
        total_transactions: totalTransactions,
      };
    }

    return NextResponse.json({
      config: config || {
        guild_id: guildId,
        daily_reward_base: 100,
        daily_streak_bonus: 10,
        daily_max_streak: 30,
        xp_to_coins_rate: 0.1,
        xp_conversion_enabled: true,
        max_balance: 1000000000,
        min_pay_amount: 1,
        max_pay_amount: 1000000,
        economy_enabled: true,
      },
      stats,
    });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/economy:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
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

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      daily_reward_base, 
      daily_streak_bonus, 
      daily_max_streak, 
      xp_to_coins_rate, 
      xp_conversion_enabled,
      max_balance,
      min_pay_amount,
      max_pay_amount,
      economy_enabled
    } = body;

    // Validate input
    if (daily_reward_base !== undefined && (daily_reward_base < 0 || !Number.isInteger(daily_reward_base))) {
      return NextResponse.json({ error: 'daily_reward_base must be a non-negative integer' }, { status: 400 });
    }

    if (daily_streak_bonus !== undefined && (daily_streak_bonus < 0 || !Number.isInteger(daily_streak_bonus))) {
      return NextResponse.json({ error: 'daily_streak_bonus must be a non-negative integer' }, { status: 400 });
    }

    if (daily_max_streak !== undefined && (daily_max_streak < 1 || !Number.isInteger(daily_max_streak))) {
      return NextResponse.json({ error: 'daily_max_streak must be a positive integer' }, { status: 400 });
    }

    if (xp_to_coins_rate !== undefined && (xp_to_coins_rate < 0 || xp_to_coins_rate > 100)) {
      return NextResponse.json({ error: 'xp_to_coins_rate must be between 0 and 100' }, { status: 400 });
    }

    if (max_balance !== undefined && (max_balance < 1 || !Number.isInteger(max_balance))) {
      return NextResponse.json({ error: 'max_balance must be a positive integer' }, { status: 400 });
    }

    if (min_pay_amount !== undefined && (min_pay_amount < 1 || !Number.isInteger(min_pay_amount))) {
      return NextResponse.json({ error: 'min_pay_amount must be a positive integer' }, { status: 400 });
    }

    if (max_pay_amount !== undefined && (max_pay_amount < 1 || !Number.isInteger(max_pay_amount))) {
      return NextResponse.json({ error: 'max_pay_amount must be a positive integer' }, { status: 400 });
    }

    if (min_pay_amount !== undefined && max_pay_amount !== undefined && min_pay_amount > max_pay_amount) {
      return NextResponse.json({ error: 'min_pay_amount cannot be greater than max_pay_amount' }, { status: 400 });
    }

    // Check if config exists
    const { data: existingConfig } = await supabaseAdmin
      .from('economy_configs')
      .select('guild_id')
      .eq('guild_id', guildId)
      .maybeSingle();

    const updateData: any = {};
    if (daily_reward_base !== undefined) updateData.daily_reward_base = daily_reward_base;
    if (daily_streak_bonus !== undefined) updateData.daily_streak_bonus = daily_streak_bonus;
    if (daily_max_streak !== undefined) updateData.daily_max_streak = daily_max_streak;
    if (xp_to_coins_rate !== undefined) updateData.xp_to_coins_rate = xp_to_coins_rate;
    if (xp_conversion_enabled !== undefined) updateData.xp_conversion_enabled = xp_conversion_enabled;
    if (max_balance !== undefined) updateData.max_balance = max_balance;
    if (min_pay_amount !== undefined) updateData.min_pay_amount = min_pay_amount;
    if (max_pay_amount !== undefined) updateData.max_pay_amount = max_pay_amount;
    if (economy_enabled !== undefined) updateData.economy_enabled = economy_enabled;

    let result;
    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabaseAdmin
        .from('economy_configs')
        .update(updateData)
        .eq('guild_id', guildId)
        .select()
        .single();

      if (error) {
        console.error('Error updating economy config:', error);
        return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
      }

      result = data;
    } else {
      // Create new config
      const { data, error } = await supabaseAdmin
        .from('economy_configs')
        .insert({
          guild_id: guildId,
          daily_reward_base: daily_reward_base || 100,
          daily_streak_bonus: daily_streak_bonus || 10,
          daily_max_streak: daily_max_streak || 30,
          xp_to_coins_rate: xp_to_coins_rate || 0.1,
          xp_conversion_enabled: xp_conversion_enabled !== undefined ? xp_conversion_enabled : true,
          max_balance: max_balance || 1000000000,
          min_pay_amount: min_pay_amount || 1,
          max_pay_amount: max_pay_amount || 1000000,
          economy_enabled: economy_enabled !== undefined ? economy_enabled : true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating economy config:', error);
        return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
      }

      result = data;
    }

    return NextResponse.json({ config: result, success: true });
  } catch (error: any) {
    console.error('Error in PATCH /api/comcraft/guilds/[guildId]/economy:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

