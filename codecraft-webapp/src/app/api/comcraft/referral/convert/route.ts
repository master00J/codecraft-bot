import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * POST /api/comcraft/referral/convert
 * Mark a referral as converted and apply reward
 * Called when a referred user purchases Enterprise tier
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal API secret
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.INTERNAL_API_SECRET;

    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      discordId, 
      guildId, 
      subscriptionTier, 
      subscriptionDuration, 
      subscriptionPrice 
    } = body;

    if (!discordId || !guildId || !subscriptionTier) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      );
    }

    // Check if this is a valid conversion (Enterprise tier, min 1 month)
    const isValidConversion = subscriptionTier === 'enterprise' && 
                             (subscriptionDuration === undefined || subscriptionDuration >= 1);

    if (!isValidConversion) {
      return NextResponse.json({ 
        success: false, 
        message: 'Does not meet conversion requirements (must be Enterprise, ≥1 month)' 
      });
    }

    // Find the referral for this user
    const { data: referral, error: referralError } = await supabaseAdmin
      .from('referrals')
      .select('*, referral_codes(*)')
      .eq('referred_discord_id', discordId)
      .eq('conversion_status', 'signed_up')
      .single();

    if (referralError || !referral) {
      console.log('No active referral found for conversion:', discordId);
      return NextResponse.json({ 
        success: false, 
        message: 'No referral found' 
      });
    }

    // Prevent reward if already converted
    if (referral.reward_given) {
      return NextResponse.json({ 
        success: false, 
        message: 'Reward already given for this referral' 
      });
    }

    // Update referral to converted
    await supabaseAdmin
      .from('referrals')
      .update({
        conversion_status: 'converted',
        converted_at: new Date().toISOString(),
        referred_guild_id: guildId,
        subscription_tier: subscriptionTier,
        subscription_duration: subscriptionDuration || 1,
        subscription_price: subscriptionPrice || 29.99,
        updated_at: new Date().toISOString()
      })
      .eq('id', referral.id);

    // Update referral code stats
    await supabaseAdmin
      .from('referral_codes')
      .update({ 
        total_conversions: (referral.referral_codes.total_conversions || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', referral.referral_code_id);

    // Get referrer's guild (we need to know which guild to apply the reward to)
    // For now, we'll apply to their primary/first guild
    const { data: referrerGuild } = await supabaseAdmin
      .from('guild_configs')
      .select('guild_id')
      .eq('owner_discord_id', referral.referrer_discord_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!referrerGuild) {
      console.error('No guild found for referrer:', referral.referrer_discord_id);
      return NextResponse.json({ 
        success: false, 
        message: 'Referrer has no guild to apply reward to' 
      });
    }

    // Apply the reward using the database function
    const { data: rewardId, error: rewardError } = await supabaseAdmin
      .rpc('apply_referral_reward', {
        p_referrer_discord_id: referral.referrer_discord_id,
        p_referrer_guild_id: referrerGuild.guild_id,
        p_referral_id: referral.id,
        p_referred_discord_id: discordId
      });

    if (rewardError) {
      console.error('Error applying reward:', rewardError);
      return NextResponse.json(
        { error: 'Failed to apply reward' }, 
        { status: 500 }
      );
    }

    console.log('✅ Referral reward applied:', {
      referrer: referral.referrer_discord_id,
      referred: discordId,
      rewardId
    });

    // TODO: Send notification to referrer (Discord DM or in-app notification)

    return NextResponse.json({ 
      success: true, 
      rewardId,
      message: 'Referral converted and reward applied successfully' 
    });

  } catch (error) {
    console.error('Error in referral conversion:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

