import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/comcraft/referral/stats
 * Get user's referral statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore - custom fields
    const discordId = session.user.discordId;
    
    if (!discordId) {
      return NextResponse.json({ error: 'Missing Discord ID' }, { status: 401 });
    }

    // Get referral code with stats
    const { data: referralCode, error: codeError } = await supabaseAdmin
      .from('referral_codes')
      .select('*')
      .eq('discord_id', discordId)
      .single();

    if (codeError || !referralCode) {
      return NextResponse.json({ 
        error: 'No referral code found' 
      }, { status: 404 });
    }

    // Get detailed referral list
    const { data: referrals, error: referralsError } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('referrer_discord_id', discordId)
      .order('created_at', { ascending: false });

    if (referralsError) {
      console.error('Error fetching referrals:', referralsError);
    }

    // Get rewards
    const { data: rewards, error: rewardsError } = await supabaseAdmin
      .from('referral_rewards')
      .select('*')
      .eq('referrer_discord_id', discordId)
      .order('created_at', { ascending: false });

    if (rewardsError) {
      console.error('Error fetching rewards:', rewardsError);
    }

    // Calculate stats
    const stats = {
      code: referralCode.code,
      totalClicks: referralCode.total_clicks || 0,
      totalSignups: referralCode.total_signups || 0,
      totalConversions: referralCode.total_conversions || 0,
      totalRewards: referralCode.total_rewards_earned || 0,
      
      // Conversion rate
      conversionRate: referralCode.total_clicks > 0 
        ? ((referralCode.total_conversions / referralCode.total_clicks) * 100).toFixed(2)
        : 0,
      
      // Recent referrals
      recentReferrals: referrals?.slice(0, 10) || [],
      
      // Active rewards
      activeRewards: rewards?.filter(r => r.is_active) || [],
      
      // Total rewards history
      rewardsHistory: rewards || [],
      
      // Earnings calculation (for display)
      totalEarnings: {
        days: (referralCode.total_rewards_earned || 0) * 7,
        value: (referralCode.total_rewards_earned || 0) * 29.99, // Enterprise monthly price
      }
    };

    return NextResponse.json({ 
      success: true, 
      stats 
    });

  } catch (error) {
    console.error('Error fetching referral stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

