/**
 * API Route: Vote Points
 * GET /api/comcraft/vote-points - Get user's vote points balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = (session.user as any).discordId;
    if (!discordId) {
      return NextResponse.json({ error: 'Discord ID not found' }, { status: 400 });
    }

    // Get vote points balance
    const { data: votePoints, error } = await supabase
      .from('vote_points')
      .select('*')
      .eq('discord_user_id', discordId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching vote points:', error);
      return NextResponse.json({ error: 'Failed to fetch vote points' }, { status: 500 });
    }

    // If no record exists, return default values
    const points = votePoints || {
      total_points: 0,
      points_earned: 0,
      points_spent: 0,
      last_vote_at: null
    };

    return NextResponse.json({
      success: true,
      points: points.total_points || 0,
      pointsEarned: points.points_earned || 0,
      pointsSpent: points.points_spent || 0,
      lastVoteAt: points.last_vote_at
    });
  } catch (error) {
    console.error('Error in vote-points route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

