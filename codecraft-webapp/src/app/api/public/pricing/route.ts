/**
 * Public API Route: Get subscription tier pricing
 * GET /api/public/pricing
 * No authentication required - safe for public pages
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch only public pricing info (no sensitive data)
    const { data: tiers, error } = await supabaseAdmin
      .from('subscription_tiers')
      .select('tier_name, price_monthly, price_yearly, currency')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching public pricing:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pricing' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      tiers: tiers || []
    });

  } catch (error) {
    console.error('Error in public pricing API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

