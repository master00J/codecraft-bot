import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGuildAccess } from '@/lib/comcraft/access-control';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Slash commands that can be restricted by role (command_name as in Discord). */
export const RESTRICTABLE_COMMANDS = [
  { name: 'store', label: '/store' },
  { name: 'shop', label: '/shop (combat shop)' },
  { name: 'buy', label: '/buy' },
  { name: 'sell', label: '/sell' },
  { name: 'application', label: '/application' },
  { name: 'ticket', label: '/ticket' },
  { name: 'redeem', label: '/redeem' },
] as const;

// GET - List command permissions for the guild (all restrictable commands with their allowed_role_ids)
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

    const { data: rows, error } = await supabaseAdmin
      .from('guild_command_permissions')
      .select('command_name, allowed_role_ids')
      .eq('guild_id', guildId);

    if (error) throw error;

    const byCommand = (rows || []).reduce<Record<string, string[]>>((acc, row) => {
      const ids = Array.isArray(row.allowed_role_ids) ? row.allowed_role_ids : [];
      acc[row.command_name] = ids;
      return acc;
    }, {});

    const permissions = RESTRICTABLE_COMMANDS.map(({ name, label }) => ({
      command_name: name,
      label,
      allowed_role_ids: byCommand[name] ?? null,
    }));

    return NextResponse.json({
      success: true,
      permissions,
    });
  } catch (error: unknown) {
    console.error('Error fetching command permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update command permissions (body: { permissions: { command_name: string, allowed_role_ids: string[] | null }[] })
export async function PUT(
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

    const body = await request.json();
    const permissions = body.permissions as Array<{ command_name: string; allowed_role_ids: string[] | null }> | undefined;
    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: 'permissions array required' }, { status: 400 });
    }

    const validNames = new Set(RESTRICTABLE_COMMANDS.map(c => c.name));
    for (const p of permissions) {
      if (!validNames.has(p.command_name)) continue;
      const roleIds = p.allowed_role_ids == null || (Array.isArray(p.allowed_role_ids) && p.allowed_role_ids.length === 0)
        ? null
        : p.allowed_role_ids;
      const { error: upsertError } = await supabaseAdmin
        .from('guild_command_permissions')
        .upsert(
          {
            guild_id: guildId,
            command_name: p.command_name,
            allowed_role_ids: roleIds,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'guild_id,command_name' }
        );
      if (upsertError) throw upsertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error updating command permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
