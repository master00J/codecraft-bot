/**
 * API Route: Vouches/Reputation management
 * /api/comcraft/guilds/[guildId]/vouches
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = supabaseAdmin;

/**
 * Log activity to database
 */
async function logActivity(data: any) {
  try {
    await supabase.from('activity_logs').insert(data);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase
      .from('vouches')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by user if specified
    if (userId) {
      query = query.or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
    }

    const { data: vouches, error } = await query;

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ vouches: [] });
      }
      console.error('Error fetching vouches:', error);
      return NextResponse.json({ error: 'Failed to fetch vouches' }, { status: 500 });
    }

    return NextResponse.json({ vouches: vouches || [] });
  } catch (error) {
    console.error('Error in vouches API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vouchId = searchParams.get('id');

    if (!vouchId) {
      return NextResponse.json({ error: 'Vouch ID required' }, { status: 400 });
    }

    // @ts-ignore
    const actorId = session.user.discordId || session.user.id || session.user.sub;
    const actorName = session.user.name || 'Unknown';

    // Get vouch info before deleting
    const { data: vouch } = await supabase
      .from('vouches')
      .select('*')
      .eq('id', vouchId)
      .single();

    const { error } = await supabase
      .from('vouches')
      .delete()
      .eq('id', vouchId);

    if (error) {
      console.error('Error deleting vouch:', error);
      return NextResponse.json({ error: 'Failed to delete vouch' }, { status: 500 });
    }

    // Log deletion
    if (vouch) {
      console.log(`🗑️ [VOUCH] ${actorName} removed vouch from ${vouch.from_user_id} to ${vouch.to_user_id} in guild ${vouch.guild_id}`);
      
      await logActivity({
        action_type: 'vouch.removed',
        action_category: 'moderation',
        description: `Removed vouch (${vouch.rating}⭐)`,
        actor_id: actorId,
        actor_name: actorName,
        target_type: 'vouch',
        target_id: vouchId,
        target_name: `${vouch.from_user_id} → ${vouch.to_user_id}`,
        guild_id: vouch.guild_id,
        status: 'success',
        metadata: {
          rating: vouch.rating,
          comment: vouch.comment
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete vouch API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
