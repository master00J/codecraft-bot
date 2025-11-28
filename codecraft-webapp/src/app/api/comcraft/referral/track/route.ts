import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * POST /api/comcraft/referral/track
 * Track referral clicks and signups
 * Public endpoint (no auth required for clicks)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, action, discordId, guildId } = body;

    if (!code || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      );
    }

    // Get referral code
    const { data: referralCode, error: codeError } = await supabaseAdmin
      .from('referral_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (codeError || !referralCode) {
      return NextResponse.json(
        { error: 'Invalid referral code' }, 
        { status: 404 }
      );
    }

    // Get IP and user agent for fraud detection
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (action === 'click') {
      // Check if click already exists (prevent double counting)
      const { data: existingClick } = await supabaseAdmin
        .from('referrals')
        .select('id')
        .eq('referral_code', code.toUpperCase())
        .eq('ip_address', ip)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
        .single();

      if (existingClick) {
        // Already tracked this IP in last 24h
        return NextResponse.json({ 
          success: true, 
          message: 'Already tracked' 
        });
      }

      // Create referral record
      const { data: referral, error: insertError } = await supabaseAdmin
        .from('referrals')
        .insert({
          referrer_user_id: referralCode.user_id,
          referrer_discord_id: referralCode.discord_id,
          referral_code_id: referralCode.id,
          referral_code: code.toUpperCase(),
          ip_address: ip,
          user_agent: userAgent,
          conversion_status: 'clicked'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error tracking click:', insertError);
        return NextResponse.json(
          { error: 'Failed to track click' }, 
          { status: 500 }
        );
      }

      // Update referral code stats
      await supabaseAdmin
        .from('referral_codes')
        .update({ 
          total_clicks: (referralCode.total_clicks || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', referralCode.id);

      return NextResponse.json({ 
        success: true, 
        referralId: referral.id 
      });
    }

    if (action === 'signup') {
      if (!discordId) {
        return NextResponse.json(
          { error: 'Discord ID required for signup tracking' }, 
          { status: 400 }
        );
      }

      // Prevent self-referrals
      if (discordId === referralCode.discord_id) {
        return NextResponse.json(
          { error: 'Self-referrals are not allowed' }, 
          { status: 400 }
        );
      }

      // Find the referral record (by IP or create new)
      let { data: referral } = await supabaseAdmin
        .from('referrals')
        .select('*')
        .eq('referral_code', code.toUpperCase())
        .eq('ip_address', ip)
        .is('referred_discord_id', null)
        .single();

      if (!referral) {
        // Create new referral if no click was tracked
        const { data: newReferral, error: insertError } = await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_user_id: referralCode.user_id,
            referrer_discord_id: referralCode.discord_id,
            referral_code_id: referralCode.id,
            referral_code: code.toUpperCase(),
            referred_discord_id: discordId,
            referred_guild_id: guildId || null,
            ip_address: ip,
            user_agent: userAgent,
            conversion_status: 'signed_up',
            signed_up_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error tracking signup:', insertError);
          return NextResponse.json(
            { error: 'Failed to track signup' }, 
            { status: 500 }
          );
        }

        referral = newReferral;
      } else {
        // Update existing referral
        const { error: updateError } = await supabaseAdmin
          .from('referrals')
          .update({
            referred_discord_id: discordId,
            referred_guild_id: guildId || null,
            conversion_status: 'signed_up',
            signed_up_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', referral.id);

        if (updateError) {
          console.error('Error updating referral:', updateError);
          return NextResponse.json(
            { error: 'Failed to update referral' }, 
            { status: 500 }
          );
        }
      }

      // Update referral code stats
      await supabaseAdmin
        .from('referral_codes')
        .update({ 
          total_signups: (referralCode.total_signups || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', referralCode.id);

      return NextResponse.json({ 
        success: true, 
        referralId: referral.id 
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' }, 
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in referral tracking:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

