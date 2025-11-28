/**
 * API Route: Redeem Vote Points for Tier
 * POST /api/comcraft/vote-rewards/redeem
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = (session.user as any).discordId;
    if (!discordId) {
      return NextResponse.json({ error: 'Discord ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const { tierId, guildId } = body;

    if (!tierId || !guildId) {
      return NextResponse.json({ error: 'tierId and guildId are required' }, { status: 400 });
    }

    // Get user
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get tier info
    const { data: tier } = await supabase
      .from('subscription_tiers')
      .select('id, tier_name, display_name')
      .eq('id', tierId)
      .single();

    if (!tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    // Get tier vote rewards config
    const { data: tierReward } = await supabase
      .from('tier_vote_rewards')
      .select('*')
      .eq('tier_id', tierId)
      .eq('is_active', true)
      .single();

    if (!tierReward) {
      return NextResponse.json({ error: 'This tier is not available for vote rewards' }, { status: 400 });
    }

    // Get user's vote points
    const { data: votePoints } = await supabase
      .from('vote_points')
      .select('*')
      .eq('discord_user_id', discordId)
      .maybeSingle();

    const currentPoints = votePoints?.total_points || 0;

    if (currentPoints < tierReward.points_per_day) {
      return NextResponse.json({
        error: `Insufficient points. You need ${tierReward.points_per_day} points per day, but you only have ${currentPoints} points.`
      }, { status: 400 });
    }

    // Check if there's already an active unlock for this guild
    const { data: existingUnlock } = await supabase
      .from('vote_tier_unlocks')
      .select('*')
      .eq('discord_user_id', discordId)
      .eq('guild_id', guildId)
      .eq('is_active', true)
      .maybeSingle();

    if (existingUnlock) {
      return NextResponse.json({
        error: 'You already have an active tier unlock for this guild. Please wait for it to expire or cancel it first.'
      }, { status: 400 });
    }

    // Calculate how many days the user can afford
    const daysAffordable = Math.floor(currentPoints / tierReward.points_per_day);
    
    // For now, we'll start with 1 day and deduct daily
    // Calculate expires_at (1 day from now, but will be extended as points are deducted)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    // Create unlock
    const { data: unlock, error: unlockError } = await supabase
      .from('vote_tier_unlocks')
      .insert({
        user_id: userData.id,
        discord_user_id: discordId,
        guild_id: guildId,
        tier_id: tierId,
        tier_name: tier.tier_name,
        points_per_day: tierReward.points_per_day,
        expires_at: expiresAt.toISOString(),
        last_deduction_at: new Date().toISOString()
      })
      .select()
      .single();

    if (unlockError) {
      console.error('Error creating unlock:', unlockError);
      return NextResponse.json({ error: 'Failed to create unlock' }, { status: 500 });
    }

    // Deduct first day's points
    const newTotalPoints = currentPoints - tierReward.points_per_day;
    const newPointsSpent = (votePoints?.points_spent || 0) + tierReward.points_per_day;

    const { error: updateError } = await supabase
      .from('vote_points')
      .upsert({
        user_id: userData.id,
        discord_user_id: discordId,
        total_points: newTotalPoints,
        points_earned: votePoints?.points_earned || 0,
        points_spent: newPointsSpent,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'discord_user_id'
      });

    if (updateError) {
      console.error('Error updating vote points:', updateError);
      // Rollback unlock
      await supabase.from('vote_tier_unlocks').delete().eq('id', unlock.id);
      return NextResponse.json({ error: 'Failed to deduct points' }, { status: 500 });
    }

    // Log transaction
    await supabase
      .from('vote_points_transactions')
      .insert({
        user_id: userData.id,
        discord_user_id: discordId,
        transaction_type: 'spent',
        points: -tierReward.points_per_day,
        description: `Redeemed ${tier.display_name} tier for guild ${guildId}`,
        related_unlock_id: unlock.id
      });

    // Update guild config to use this tier
    const { error: guildUpdateError } = await supabase
      .from('guild_configs')
      .update({
        subscription_tier: tier.tier_name,
        subscription_status: 'active',
        subscription_expires_at: expiresAt.toISOString()
      })
      .eq('guild_id', guildId);

    if (guildUpdateError) {
      console.error('Error updating guild config:', guildUpdateError);
      // Don't fail the request, just log it
    }

    return NextResponse.json({
      success: true,
      unlock: {
        id: unlock.id,
        tierName: tier.display_name,
        guildId: guildId,
        pointsPerDay: tierReward.points_per_day,
        expiresAt: expiresAt.toISOString(),
        remainingPoints: newTotalPoints
      },
      message: `Successfully unlocked ${tier.display_name} tier for this guild! Points will be deducted daily.`
    });
  } catch (error) {
    console.error('Error in redeem route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

