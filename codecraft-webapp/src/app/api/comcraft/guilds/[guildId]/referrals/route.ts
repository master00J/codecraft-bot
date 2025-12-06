/**
 * API Route: Discord Referral System Configuration
 * /api/comcraft/guilds/[guildId]/referrals
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    // Check guild access
    const { data: guild } = await supabase
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single();

    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    const isOwner = guild.owner_discord_id === discordId;
    
    const { data: authorized } = await supabase
      .from('authorized_users')
      .select('role')
      .eq('guild_id', guildId)
      .eq('user_id', discordId)
      .maybeSingle();

    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .maybeSingle();

    const isPlatformAdmin = user?.is_admin === true;

    if (!isOwner && !authorized && !isPlatformAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get referral config
    const { data: config, error } = await supabase
      .from('discord_referral_config')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching referral config:', error);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    // Get referral stats
    const { data: stats } = await supabase
      .from('discord_referral_stats')
      .select('*')
      .eq('guild_id', guildId)
      .order('total_invites', { ascending: false })
      .limit(10);

    // Get recent referrals
    const { data: recentReferrals } = await supabase
      .from('discord_referrals')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get tiered rewards
    const { data: tiers } = await supabase
      .from('discord_referral_tiers')
      .select('*')
      .eq('guild_id', guildId)
      .order('min_invites', { ascending: true });

    // If no config exists, return default
    if (!config) {
      return NextResponse.json({
        success: true,
        config: {
          enabled: false,
          inviter_reward_type: 'none',
          inviter_reward_role_id: null,
          inviter_reward_coins: 0,
          inviter_reward_xp: 0,
          new_member_reward_type: 'none',
          new_member_reward_role_id: null,
          new_member_reward_coins: 0,
          new_member_reward_xp: 0,
          require_min_account_age_days: 0,
          require_min_members_invited: 1,
          cooldown_hours: 0,
          ignore_bots: true,
          log_channel_id: null
        },
        stats: stats || [],
        recentReferrals: recentReferrals || [],
        tiers: tiers || []
      });
    }

    return NextResponse.json({
      success: true,
      config,
      stats: stats || [],
      recentReferrals: recentReferrals || [],
      tiers: tiers || []
    });
  } catch (error) {
    console.error('Error in referral config API:', error);
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

    const { guildId } = params;
    const body = await request.json();

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    // Check guild access
    const { data: guild } = await supabase
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single();

    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    const isOwner = guild.owner_discord_id === discordId;
    
    const { data: authorized } = await supabase
      .from('authorized_users')
      .select('role')
      .eq('guild_id', guildId)
      .eq('user_id', discordId)
      .maybeSingle();

    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .maybeSingle();

    const isPlatformAdmin = user?.is_admin === true;

    if (!isOwner && !authorized && !isPlatformAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {
      guild_id: guildId,
      enabled: body.enabled || false,
      inviter_reward_type: body.inviter_reward_type || 'none',
      inviter_reward_role_id: body.inviter_reward_role_id || null,
      inviter_reward_coins: body.inviter_reward_coins || 0,
      inviter_reward_xp: body.inviter_reward_xp || 0,
      new_member_reward_type: body.new_member_reward_type || 'none',
      new_member_reward_role_id: body.new_member_reward_role_id || null,
      new_member_reward_coins: body.new_member_reward_coins || 0,
      new_member_reward_xp: body.new_member_reward_xp || 0,
      require_min_account_age_days: body.require_min_account_age_days || 0,
      require_min_members_invited: body.require_min_members_invited || 1,
      cooldown_hours: body.cooldown_hours || 0,
      ignore_bots: body.ignore_bots !== undefined ? body.ignore_bots : true,
      log_channel_id: body.log_channel_id || null,
      updated_at: new Date().toISOString()
    };

    // Upsert config
    const { error: upsertError } = await supabase
      .from('discord_referral_config')
      .upsert(updateData, {
        onConflict: 'guild_id'
      });

    if (upsertError) {
      console.error('Error saving referral config:', upsertError);
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    // Handle tiers if provided
    if (body.tiers && Array.isArray(body.tiers)) {
      // Delete existing tiers for this guild
      await supabase
        .from('discord_referral_tiers')
        .delete()
        .eq('guild_id', guildId);

      // Insert new tiers
      if (body.tiers.length > 0) {
        const tiersToInsert = body.tiers.map((tier: any, index: number) => ({
          guild_id: guildId,
          tier_name: tier.tier_name || `Tier ${index + 1}`,
          min_invites: tier.min_invites || 0,
          role_id: tier.role_id || null,
          coins: tier.coins || 0,
          xp: tier.xp || 0,
          order_index: tier.order_index !== undefined ? tier.order_index : index,
          enabled: tier.enabled !== undefined ? tier.enabled : true
        }));

        const { error: tiersError } = await supabase
          .from('discord_referral_tiers')
          .insert(tiersToInsert);

        if (tiersError) {
          console.error('Error saving tiers:', tiersError);
          return NextResponse.json({ error: 'Failed to save tiers' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in referral config update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

