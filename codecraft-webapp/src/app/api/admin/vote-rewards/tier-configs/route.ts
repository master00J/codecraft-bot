/**
 * API Route: Tier Vote Rewards Configuration (Admin)
 * GET /api/admin/vote-rewards/tier-configs - Get all tier configs
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

// GET - Get all tier vote rewards configurations
export async function GET() {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    // Get all tiers
    const { data: tiers, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('id, tier_name, display_name, is_active')
      .order('sort_order', { ascending: true });

    if (tiersError) {
      console.error('Error fetching tiers:', tiersError);
      return NextResponse.json({ error: 'Failed to fetch tiers' }, { status: 500 });
    }

    // Get tier vote rewards configs
    const { data: tierConfigs, error: configsError } = await supabase
      .from('tier_vote_rewards')
      .select('*')
      .order('sort_order', { ascending: true });

    if (configsError) {
      console.error('Error fetching tier configs:', configsError);
      return NextResponse.json({ error: 'Failed to fetch tier configs' }, { status: 500 });
    }

    // Merge tiers with their configs
    const tiersWithConfigs = tiers?.map(tier => {
      const config = tierConfigs?.find(c => c.tier_id === tier.id);
      return {
        tier: {
          id: tier.id,
          tier_name: tier.tier_name,
          display_name: tier.display_name,
          is_active: tier.is_active
        },
        config: config ? {
          id: config.id,
          points_per_day: config.points_per_day,
          is_active: config.is_active,
          sort_order: config.sort_order
        } : null
      };
    }) || [];

    return NextResponse.json({
      success: true,
      tiers: tiersWithConfigs
    });
  } catch (error) {
    console.error('Error in tier-configs GET route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

