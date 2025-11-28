import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * POST /api/comcraft/subscriptions/upgrade
 * Upgrade a guild's subscription tier
 * Automatically detects and processes referral conversions
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { 
      guildId, 
      tier, 
      duration = 1, // months
      price,
      paymentMethod 
    } = body;

    if (!guildId || !tier) {
      return NextResponse.json(
        { error: 'Missing required fields' }, 
        { status: 400 }
      );
    }

    // Verify user owns this guild
    const { data: guild, error: guildError } = await supabaseAdmin
      .from('guild_configs')
      .select('*')
      .eq('guild_id', guildId)
      .eq('owner_discord_id', discordId)
      .single();

    if (guildError || !guild) {
      return NextResponse.json(
        { error: 'Guild not found or access denied' }, 
        { status: 403 }
      );
    }

    // Calculate expiry date
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (duration * 30 * 24 * 60 * 60 * 1000));

    // Update subscription
    const { data: updatedGuild, error: updateError } = await supabaseAdmin
      .from('guild_configs')
      .update({
        subscription_tier: tier,
        subscription_status: 'active',
        subscription_expires_at: expiresAt.toISOString(),
        subscription_started_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('guild_id', guildId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return NextResponse.json(
        { error: 'Failed to upgrade subscription' }, 
        { status: 500 }
      );
    }

    // Check if this is a qualifying referral conversion
    if (tier === 'enterprise' && duration >= 1) {
      try {
        // Call referral conversion API
        const conversionRes = await fetch(
          `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/comcraft/referral/convert`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET}`
            },
            body: JSON.stringify({
              discordId,
              guildId,
              subscriptionTier: tier,
              subscriptionDuration: duration,
              subscriptionPrice: price || 29.99
            })
          }
        );

        if (conversionRes.ok) {
          const conversionData = await conversionRes.json();
          console.log('✅ Referral conversion processed:', conversionData);
        } else {
          console.log('ℹ️ No referral conversion (likely not a referred user)');
        }
      } catch (conversionError) {
        // Don't fail the upgrade if referral tracking fails
        console.error('Error processing referral conversion:', conversionError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      guild: updatedGuild,
      message: 'Subscription upgraded successfully'
    });

  } catch (error) {
    console.error('Error in subscription upgrade:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

