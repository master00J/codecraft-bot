/**
 * API Route: Tier Vote Rewards Configuration (Admin)
 * PATCH /api/admin/vote-rewards/tier-configs/[tierId] - Update tier config
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

// PATCH - Update tier vote rewards configuration
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tierId: string }> }
) {

  const { tierId } = await params;

  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const body = await request.json();
    const { points_per_day, is_active } = body;

    // Get tier info
    const { data: tier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('id, tier_name, display_name')
      .eq('id', tierId)
      .single();

    if (tierError || !tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    // Check if config exists
    const { data: existingConfig } = await supabase
      .from('tier_vote_rewards')
      .select('*')
      .eq('tier_id', tierId)
      .maybeSingle();

    let result;
    if (existingConfig) {
      // Update existing
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      if (points_per_day !== undefined) {
        if (points_per_day < 0) {
          return NextResponse.json({ error: 'points_per_day must be >= 0' }, { status: 400 });
        }
        updates.points_per_day = points_per_day;
      }
      if (is_active !== undefined) updates.is_active = is_active;

      const { data, error: updateError } = await supabase
        .from('tier_vote_rewards')
        .update(updates)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating tier config:', updateError);
        return NextResponse.json({ error: 'Failed to update tier config' }, { status: 500 });
      }
      result = data;
    } else {
      // Create new
      if (points_per_day === undefined) {
        return NextResponse.json({ error: 'points_per_day is required' }, { status: 400 });
      }

      if (points_per_day < 0) {
        return NextResponse.json({ error: 'points_per_day must be >= 0' }, { status: 400 });
      }

      const { data, error: createError } = await supabase
        .from('tier_vote_rewards')
        .insert({
          tier_id: tierId,
          tier_name: tier.tier_name,
          points_per_day: points_per_day,
          is_active: is_active !== undefined ? is_active : true
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating tier config:', createError);
        return NextResponse.json({ error: 'Failed to create tier config' }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({
      success: true,
      config: result
    });
  } catch (error) {
    console.error('Error in tier-config PATCH route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

