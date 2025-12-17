import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getGuildAccess(guildId: string, discordId: string) {
  const { data: guild, error: guildError } = await supabaseAdmin
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (guildError || !guild) {
    return { allowed: false, reason: 'Guild not found' };
  }

  if (guild.owner_discord_id === discordId) {
    return { allowed: true };
  }

  // Check guild_authorized_users table (uses discord_id)
  const { data: authorizedGuild } = await supabaseAdmin
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (authorizedGuild) {
    return { allowed: true };
  }

  // Check authorized_users table (uses user_id)
  const { data: authorized } = await supabaseAdmin
    .from('authorized_users')
    .select('user_id')
    .eq('guild_id', guildId)
    .eq('user_id', discordId)
    .maybeSingle();

  if (authorized) {
    return { allowed: true };
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Access denied' };
}

// GET - Fetch all authorized roles for a guild
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

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all authorized roles
    const { data: authorizedRoles, error } = await supabaseAdmin
      .from('guild_authorized_roles')
      .select('*')
      .eq('guild_id', guildId)
      .order('added_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      authorizedRoles: authorizedRoles || [],
    });
  } catch (error: any) {
    console.error('Error fetching authorized roles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add an authorized role
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

    // @ts-ignore
    const requestingUserId = session.user.discordId || session.user.id || session.user.sub;
    if (!requestingUserId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, requestingUserId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { roleId } = body;

    if (!roleId) {
      return NextResponse.json({ error: 'Role ID required' }, { status: 400 });
    }

    // Add role to authorized list
    const { error: insertError } = await supabaseAdmin
      .from('guild_authorized_roles')
      .insert({
        guild_id: guildId,
        role_id: roleId,
        added_by: requestingUserId,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Role already authorized' }, { status: 400 });
      }
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      message: 'Role added successfully',
    });
  } catch (error: any) {
    console.error('Error adding authorized role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove an authorized role
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

    // @ts-ignore
    const requestingUserId = session.user.discordId || session.user.id || session.user.sub;
    if (!requestingUserId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, requestingUserId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');

    if (!roleId) {
      return NextResponse.json({ error: 'Role ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('guild_authorized_roles')
      .delete()
      .eq('guild_id', guildId)
      .eq('role_id', roleId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Role removed successfully',
    });
  } catch (error: any) {
    console.error('Error removing authorized role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}









