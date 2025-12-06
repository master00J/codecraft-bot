/**
 * API Route: Custom commands management
 * /api/comcraft/guilds/[guildId]/commands
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = supabaseAdmin;

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


    const { data: commands, error } = await supabase
      .from('custom_commands')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching commands:', error);
      return NextResponse.json({ error: 'Failed to fetch commands' }, { status: 500 });
    }

    return NextResponse.json({ commands: commands || [] });
  } catch (error) {
    console.error('Error in commands API:', error);
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

    // @ts-ignore
    const discordId = session.user.id || session.user.sub;

    const { data, error } = await supabase
      .from('custom_commands')
      .insert({
        guild_id: guildId,
        created_by: discordId,
        ...body
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating command:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, command: data });
  } catch (error) {
    console.error('Error in create command API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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
    const commandId = searchParams.get('id');
    const body = await request.json();

    if (!commandId) {
      return NextResponse.json({ error: 'Command ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('custom_commands')
      .update(body)
      .eq('id', commandId)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating command:', error);
      return NextResponse.json({ error: 'Failed to update command' }, { status: 500 });
    }

    return NextResponse.json({ success: true, command: data });
  } catch (error) {
    console.error('Error in update command API:', error);
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
    const commandId = searchParams.get('id');

    if (!commandId) {
      return NextResponse.json({ error: 'Command ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('custom_commands')
      .delete()
      .eq('id', commandId);

    if (error) {
      console.error('Error deleting command:', error);
      return NextResponse.json({ error: 'Failed to delete command' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete command API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

