/**
 * API Route: Subscription Tiers Management (Admin Only)
 * GET /api/admin/subscription-tiers - List all tiers
 * POST /api/admin/subscription-tiers - Create new tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function checkAdminAccess() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { isAdmin: false, error: 'Unauthorized' };
  }

  const discordId = (session.user as any).discordId;
  
  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();

  if (!user?.is_admin) {
    return { isAdmin: false, error: 'Admin access required' };
  }

  return { isAdmin: true };
}

// GET - List all subscription tiers
export async function GET() {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const { data: tiers, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .order('sort_order', { ascending: true });

    if (tiersError) {
      console.error('Supabase error fetching tiers:', tiersError);
      return NextResponse.json(
        { error: 'Database error', details: tiersError.message, code: tiersError.code },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${tiers?.length || 0} subscription tiers`);

    return NextResponse.json({
      success: true,
      tiers: tiers || []
    });

  } catch (error: any) {
    console.error('Error fetching tiers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tiers', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new tier
export async function POST(request: NextRequest) {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const body = await request.json();
    const {
      tier_name,
      display_name,
      description,
      price_monthly,
      price_yearly,
      currency,
      sort_order,
      features,
      limits
    } = body;

    // Validate required fields
    if (!tier_name || !display_name) {
      return NextResponse.json(
        { error: 'tier_name and display_name are required' },
        { status: 400 }
      );
    }

    const { data: tier, error: insertError } = await supabase
      .from('subscription_tiers')
      .insert({
        tier_name,
        display_name,
        description,
        price_monthly: price_monthly || 0,
        price_yearly: price_yearly || 0,
        currency: currency || 'EUR',
        sort_order: sort_order || 0,
        features: features || {},
        limits: limits || {},
        is_active: true
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Auto-sync tier knowledge for ComCraft server after tier creation
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';
      
      // Sync for ComCraft server (1435653730799190058)
      await fetch(`${baseUrl}/api/admin/sync-tier-knowledge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ guildId: '1435653730799190058' }),
      }).catch(err => {
        console.warn('[Tier Create] Failed to auto-sync tier knowledge:', err.message);
      });
    } catch (syncError) {
      // Don't fail the tier creation if sync fails
      console.warn('[Tier Create] Tier knowledge sync error:', syncError);
    }

    return NextResponse.json({
      success: true,
      tier
    });

  } catch (error: any) {
    console.error('Error creating tier:', error);
    return NextResponse.json(
      { error: 'Failed to create tier', details: error.message },
      { status: 500 }
    );
  }
}

