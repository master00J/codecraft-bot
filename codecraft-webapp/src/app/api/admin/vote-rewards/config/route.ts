/**
 * API Route: Vote Rewards Configuration (Admin)
 * GET /api/admin/vote-rewards/config - Get config
 * PATCH /api/admin/vote-rewards/config - Update config
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

// GET - Get vote rewards configuration
export async function GET() {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const { data: config, error: configError } = await supabase
      .from('vote_rewards_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Error fetching config:', configError);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    // Return default if no config exists
    const defaultConfig = {
      points_per_vote: 1,
      points_per_weekend_vote: 2,
      is_active: true
    };

    return NextResponse.json({
      success: true,
      config: config || defaultConfig
    });
  } catch (error) {
    console.error('Error in config GET route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update vote rewards configuration
export async function PATCH(request: NextRequest) {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const body = await request.json();
    const { points_per_vote, points_per_weekend_vote, is_active } = body;

    // Get existing config
    const { data: existingConfig } = await supabase
      .from('vote_rewards_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (points_per_vote !== undefined) updates.points_per_vote = points_per_vote;
    if (points_per_weekend_vote !== undefined) updates.points_per_weekend_vote = points_per_weekend_vote;
    if (is_active !== undefined) updates.is_active = is_active;

    let result;
    if (existingConfig) {
      // Update existing
      const { data, error: updateError } = await supabase
        .from('vote_rewards_config')
        .update(updates)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating config:', updateError);
        return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
      }
      result = data;
    } else {
      // Create new
      const { data, error: createError } = await supabase
        .from('vote_rewards_config')
        .insert({
          points_per_vote: points_per_vote || 1,
          points_per_weekend_vote: points_per_weekend_vote || 2,
          is_active: is_active !== undefined ? is_active : true
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating config:', createError);
        return NextResponse.json({ error: 'Failed to create config' }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({
      success: true,
      config: result
    });
  } catch (error) {
    console.error('Error in config PATCH route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

