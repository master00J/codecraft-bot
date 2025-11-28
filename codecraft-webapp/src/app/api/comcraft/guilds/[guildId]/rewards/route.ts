/**
 * API Route: Level rewards management
 * /api/comcraft/guilds/[guildId]/rewards
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = supabaseAdmin;

export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('level_rewards')
      .insert({
        guild_id: guildId,
        ...body
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating reward:', error);
      return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 });
    }

    return NextResponse.json({ success: true, reward: data });
  } catch (error) {
    console.error('Error in create reward API:', error);
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
    const rewardId = searchParams.get('id');

    if (!rewardId) {
      return NextResponse.json({ error: 'Reward ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('level_rewards')
      .delete()
      .eq('id', rewardId);

    if (error) {
      console.error('Error deleting reward:', error);
      return NextResponse.json({ error: 'Failed to delete reward' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete reward API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

