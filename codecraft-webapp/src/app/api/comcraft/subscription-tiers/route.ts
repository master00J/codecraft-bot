/**
 * Public API: Subscription Tiers (for pricing display)
 * GET /api/comcraft/subscription-tiers - Get all active tiers
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const revalidate = 300; // Cache for 5 minutes

const supabase = supabaseAdmin;

export async function GET() {
  try {
    const { data: tiers, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      tiers: tiers || []
    });

  } catch (error: any) {
    console.error('Error fetching subscription tiers:', error);
    
    // Return default tiers on error
    return NextResponse.json({
      success: true,
      tiers: [
        {
          tier_name: 'free',
          display_name: 'Free',
          description: 'Perfect for small communities',
          price_monthly: 0,
          price_yearly: 0,
          currency: 'EUR',
          features: {
            leveling: true,
            moderation_basic: true,
            welcome: false
          },
          limits: {
            custom_commands: 5,
            stream_notifications: 1,
            xp_boost: 1.0
          }
        }
      ]
    });
  }
}

