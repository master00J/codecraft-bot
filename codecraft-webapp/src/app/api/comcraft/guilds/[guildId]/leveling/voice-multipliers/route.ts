import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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


    // Fetch all voice multipliers for this guild
    const { data, error } = await supabase
      .from('rank_voice_xp_multipliers')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching voice multipliers:', error);
      return NextResponse.json({ error: 'Failed to fetch multipliers' }, { status: 500 });
    }

    return NextResponse.json({ multipliers: data || [] });
  } catch (error) {
    console.error('Error in voice multipliers GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Upsert the voice multiplier
    const { data, error } = await supabase
      .from('rank_voice_xp_multipliers')
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
      console.error('Error creating/updating voice multiplier:', error);
      return NextResponse.json({ error: 'Failed to save multiplier' }, { status: 500 });
    }

    return NextResponse.json({ success: true, multiplier: data });
  } catch (error) {
    console.error('Error in voice multipliers POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('role_id');

    if (!roleId) {
      return NextResponse.json(
        { error: 'role_id parameter is required' },
        { status: 400 }
      );
    }

    // Delete the voice multiplier
    const { error } = await supabase
      .from('rank_voice_xp_multipliers')
      .delete()
      .eq('guild_id', guildId)
      .eq('role_id', roleId);

    if (error) {
      console.error('Error deleting voice multiplier:', error);
      return NextResponse.json({ error: 'Failed to delete multiplier' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in voice multipliers DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

