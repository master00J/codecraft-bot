/**
 * API Route: Test Welcome Message
 * /api/comcraft/guilds/[guildId]/welcome/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
    const config = await request.json();

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    // Check guild access
    const { data: guild } = await supabase
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single();

    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    const isOwner = guild.owner_discord_id === discordId;
    
    const { data: authorized } = await supabase
      .from('authorized_users')
      .select('role')
      .eq('guild_id', guildId)
      .eq('user_id', discordId)
      .maybeSingle();

    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .maybeSingle();

    const isPlatformAdmin = user?.is_admin === true;

    if (!isOwner && !authorized && !isPlatformAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Call bot API to send test message
    const botApiUrl = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
    const botResponse = await fetch(`${botApiUrl}/api/welcome/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
      },
      body: JSON.stringify({
        guildId,
        config,
        testUserId: discordId
      })
    });

    if (!botResponse.ok) {
      const error = await botResponse.json();
      return NextResponse.json({ 
        success: false, 
        error: error.error || 'Failed to send test message' 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in welcome test API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

