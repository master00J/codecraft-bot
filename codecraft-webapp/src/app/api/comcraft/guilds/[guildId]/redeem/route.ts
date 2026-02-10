/**
 * Redeem a shop code (gift card). Session required; assigns the role to the logged-in user.
 * Rate limited per IP.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';
import { checkRateLimit, getIdentifier } from '@/lib/comcraft/rate-limit';

export const dynamic = 'force-dynamic';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    let discordId: string | null = null;

    const internalSecret = request.headers.get('x-internal-secret');
    if (!internalSecret || internalSecret !== INTERNAL_SECRET) {
      const id = getIdentifier(request);
      const { allowed } = checkRateLimit(`redeem:${id}`);
      if (!allowed) {
        return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 });
      }
    }
    if (INTERNAL_SECRET && internalSecret === INTERNAL_SECRET) {
      const body = await request.json();
      discordId = typeof body.discordId === 'string' ? body.discordId.trim() : null;
      if (!discordId) {
        return NextResponse.json(
          { error: 'Internal call requires body.discordId' },
          { status: 400 }
        );
      }
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: 'Sign in with Discord to redeem a code' }, { status: 401 });
      }
      discordId =
        (session.user as any).discordId || session.user.id || (session.user as any).sub;
      if (!discordId) {
        return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
      }
      const access = await getGuildAccess(guildId, discordId);
      if (!access.allowed) {
        return NextResponse.json(
          { error: 'You must be a member of this server to redeem the code here' },
          { status: 403 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase().replace(/\s/g, '') : '';
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const { data: row, error: fetchError } = await supabaseAdmin
      .from('guild_shop_codes')
      .select('id, discord_role_id, used_at, expires_at')
      .eq('guild_id', guildId)
      .eq('code', code)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Invalid or unknown code' }, { status: 404 });
    }

    const roleId = (row as { discord_role_id: string | null }).discord_role_id;
    if (!roleId) {
      return NextResponse.json({
        error: 'This code was a product code (e.g. a gift card). It is not redeemable for a role here.',
      }, { status: 400 });
    }

    if ((row as { used_at: string | null }).used_at) {
      return NextResponse.json({ error: 'This code has already been used' }, { status: 400 });
    }

    const expiresAt = (row as { expires_at: string | null }).expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This code has expired' }, { status: 400 });
    }
    const botApiUrl = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';

    const addRoleRes = await fetch(
      `${botApiUrl}/api/discord/${guildId}/users/${discordId}/roles`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(INTERNAL_SECRET ? { 'X-Internal-Secret': INTERNAL_SECRET } : {}),
        },
        body: JSON.stringify({ roleId }),
      }
    );

    if (!addRoleRes.ok) {
      const err = await addRoleRes.json().catch(() => ({}));
      console.error('Redeem: failed to add role', guildId, discordId, err);
      return NextResponse.json(
        { error: err.error || 'Could not assign role. Try again or contact the server.' },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from('guild_shop_codes')
      .update({
        used_at: new Date().toISOString(),
        used_by_discord_id: discordId,
      })
      .eq('id', (row as { id: string }).id);

    return NextResponse.json({ success: true, message: 'Code redeemed! You received the role.' });
  } catch (e) {
    console.error('Redeem error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
