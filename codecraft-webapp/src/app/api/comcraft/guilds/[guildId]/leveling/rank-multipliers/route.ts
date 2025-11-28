/**
 * API Route: Rank XP Multipliers
 * /api/comcraft/guilds/[guildId]/leveling/rank-multipliers
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = supabaseAdmin;

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;

    // Get all rank multipliers for this guild
    const { data, error } = await supabase
      .from('rank_xp_multipliers')
      .select('*')
      .eq('guild_id', guildId)
      .order('multiplier', { ascending: false });

    if (error) {
      console.error('Error fetching rank multipliers:', error);
      return NextResponse.json({ error: 'Failed to fetch multipliers' }, { status: 500 });
    }

    return NextResponse.json({ multipliers: data || [] });
  } catch (error) {
    console.error('Error in rank multipliers GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const { role_id, role_name, multiplier, enabled = true } = body;

    if (!role_id || !multiplier) {
      return NextResponse.json(
        { error: 'role_id and multiplier are required' },
        { status: 400 }
      );
    }

    if (multiplier < 0.1 || multiplier > 10) {
      return NextResponse.json(
        { error: 'Multiplier must be between 0.1 and 10.0' },
        { status: 400 }
      );
    }

    // Upsert the rank multiplier
    const { data, error } = await supabase
      .from('rank_xp_multipliers')
      .upsert({
        guild_id: guildId,
        role_id,
        role_name: role_name || null,
        multiplier: parseFloat(multiplier),
        enabled: enabled !== false
      }, {
        onConflict: 'guild_id,role_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating/updating rank multiplier:', error);
      return NextResponse.json({ error: 'Failed to save multiplier' }, { status: 500 });
    }

    return NextResponse.json({ success: true, multiplier: data });
  } catch (error) {
    console.error('Error in rank multipliers POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('role_id');

    if (!roleId) {
      return NextResponse.json(
        { error: 'role_id parameter is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('rank_xp_multipliers')
      .delete()
      .eq('guild_id', guildId)
      .eq('role_id', roleId);

    if (error) {
      console.error('Error deleting rank multiplier:', error);
      return NextResponse.json({ error: 'Failed to delete multiplier' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in rank multipliers DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

