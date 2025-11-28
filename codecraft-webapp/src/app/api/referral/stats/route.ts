import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - Get user's referral statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const discordId = session.user.discordId || session.user.id || session.user.sub
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 })
    }

    // Get referral code
    const { data: code, error: codeError } = await supabaseAdmin
      .from('referral_codes')
      .select('*')
      .eq('discord_id', discordId)
      .single()

    if (codeError || !code) {
      return NextResponse.json({
        error: 'No referral code found'
      }, { status: 404 })
    }

    // Get all referrals
    const { data: referrals, error: referralsError } = await supabaseAdmin
      .from('referrals')
      .select(`
        *,
        orders!referrals_first_order_id_fkey (
          id,
          order_number,
          price,
          created_at
        )
      `)
      .eq('referrer_code_id', code.id)
      .order('created_at', { ascending: false })

    if (referralsError) throw referralsError

    // Get rewards
    const { data: rewards, error: rewardsError } = await supabaseAdmin
      .from('referral_rewards')
      .select('*')
      .eq('referral_code_id', code.id)
      .order('created_at', { ascending: false })

    if (rewardsError) throw rewardsError

    // Calculate stats
    const totalClicks = code.total_referrals || 0
    const totalConversions = code.successful_conversions || 0
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0
    
    const pendingEarnings = rewards
      ?.filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0

    const paidEarnings = rewards
      ?.filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0

    const totalEarnings = code.total_earned || 0

    // Recent referrals (last 10)
    const recentReferrals = referrals?.slice(0, 10) || []

    return NextResponse.json({
      code: code.code,
      stats: {
        totalClicks,
        totalConversions,
        conversionRate: conversionRate.toFixed(2),
        totalEarnings,
        pendingEarnings,
        paidEarnings
      },
      referrals: recentReferrals,
      rewards: rewards || [],
      referralLink: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://codecraft-solutions.com'}?ref=${code.code}`
    })

  } catch (error) {
    console.error('Error fetching referral stats:', error)
    return NextResponse.json({
      error: 'Failed to fetch stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

