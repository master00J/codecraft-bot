import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { assignLicenseToGuild, releaseLicenseFromGuild } from '@/lib/comcraft/licenses';

export const dynamic = 'force-dynamic';

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const user = session.user as Record<string, any>;
  const discordId = user.discordId || user.id || user.sub;

  if (!discordId) {
    throw new Error('Unauthorized');
  }

  // Get user UUID from users table
  const { data: dbUser, error: userError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (userError || !dbUser) {
    throw new Error('User not found');
  }

  return {
    session,
    userId: dbUser.id, // UUID from database
    discordId,
  };
}

async function ensureGuildAccess(guildId: string, discordId: string) {
  const { data: guild, error } = await supabaseAdmin
    .from('guild_configs')
    .select('guild_id, guild_name, owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (error || !guild) {
    throw new Error('Guild not found');
  }

  if (guild.owner_discord_id === discordId) {
    return guild;
  }

  const { data: authRecord } = await supabaseAdmin
    .from('guild_authorized_users')
    .select('id')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (!authRecord) {
    throw new Error('Forbidden');
  }

  return guild;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, discordId } = await requireSession();
    const body = await request.json();
    const { licenseId, guildId } = body as { licenseId?: string; guildId?: string };

    if (!licenseId || !guildId) {
      return NextResponse.json({ error: 'Missing licenseId or guildId' }, { status: 400 });
    }

    const { data: license, error: licenseError } = await supabaseAdmin
      .from('comcraft_licenses')
      .select('*')
      .eq('id', licenseId)
      .single();

    if (licenseError || !license) {
      return NextResponse.json({ error: 'License not found' }, { status: 404 });
    }

    if (license.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const guild = await ensureGuildAccess(guildId, discordId);

    const assignedLicense = await assignLicenseToGuild(licenseId, guildId, {
      guildName: guild.guild_name,
    });

    return NextResponse.json({ success: true, license: assignedLicense });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Guild not found') {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'License has no available guild slots') {
      return NextResponse.json({ 
        error: 'License has no available guild slots',
        message: 'This license has reached its maximum number of assigned guilds. Please release a license from another guild first or upgrade your license tier.'
      }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Selected license is not active') {
      return NextResponse.json({ 
        error: 'License is not active',
        message: 'The selected license is not active. Please select an active license.'
      }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Selected license has expired') {
      return NextResponse.json({ 
        error: 'License has expired',
        message: 'The selected license has expired. Please renew or select a different license.'
      }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.error('Error assigning license to guild:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { discordId } = await requireSession();
    const body = await request.json();
    const { guildId } = body as { guildId?: string };

    if (!guildId) {
      return NextResponse.json({ error: 'Missing guildId' }, { status: 400 });
    }

    await ensureGuildAccess(guildId, discordId);
    await releaseLicenseFromGuild(guildId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'Guild not found') {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error releasing license from guild:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
