import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST - Track referral click/signup
export async function POST(request: NextRequest) {
  try {
    const { referralCode, discordId } = await request.json()

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      )
    }

    // Get referral code info
    const { data: codeData, error: codeError } = await supabaseAdmin
      .from('referral_codes')
      .select('*')
      .eq('code', referralCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (codeError || !codeData) {
      return NextResponse.json(
        { error: 'Invalid or inactive referral code' },
        { status: 400 }
      )
    }

    // Don't allow self-referral
    if (discordId && codeData.discord_id === discordId) {
      return NextResponse.json(
        { error: 'You cannot use your own referral code' },
        { status: 400 }
      )
    }

    // Check if already referred
    if (discordId) {
      const { data: existing } = await supabaseAdmin
        .from('referrals')
        .select('id')
        .eq('referrer_code_id', codeData.id)
        .eq('referred_discord_id', discordId)
        .single()

      if (existing) {
        return NextResponse.json({
          success: true,
          message: 'Already tracked',
          existing: true
        })
      }
    }

    // Get IP and User Agent
    const ip = request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const referer = request.headers.get('referer') || 'direct'

    // Create referral tracking (even if user not logged in yet)
    const { data: referral, error: referralError } = await supabaseAdmin
      .from('referrals')
      .insert({
        referrer_code_id: codeData.id,
        referrer_discord_id: codeData.discord_id,
        referred_discord_id: discordId || `temp_${Date.now()}`,
        ip_address: ip,
        user_agent: userAgent,
        landing_page: referer
      })
      .select()
      .single()

    if (referralError) throw referralError

    // Update total referrals count
    await supabaseAdmin
      .from('referral_codes')
      .update({
        total_referrals: codeData.total_referrals + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', codeData.id)

    return NextResponse.json({
      success: true,
      message: 'Referral tracked successfully',
      referralId: referral.id
    })

  } catch (error) {
    console.error('Error tracking referral:', error)
    return NextResponse.json({
      error: 'Failed to track referral',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

