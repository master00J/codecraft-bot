/**
 * Revoke a shop subscription now (admin): remove role and mark expired.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
const BOT_API_URL = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; subscriptionId: string }> }
) {
  const { guildId, subscriptionId } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const discordId = (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { data: sub, error: fetchErr } = await supabaseAdmin
      .from('guild_shop_subscriptions')
      .select('id, shop_item_id, discord_user_id, status')
      .eq('guild_id', guildId)
      .eq('id', subscriptionId)
      .maybeSingle();

    if (fetchErr || !sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    if ((sub as { status: string }).status !== 'active') {
      return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 });
    }

    const { data: item } = await supabaseAdmin
      .from('guild_shop_items')
      .select('discord_role_id')
      .eq('id', (sub as { shop_item_id: string }).shop_item_id)
      .maybeSingle();

    const roleId = item?.discord_role_id;
    const discordUserId = (sub as { discord_user_id: string }).discord_user_id;
    if (roleId) {
      await fetch(
        `${BOT_API_URL}/api/discord/${guildId}/users/${discordUserId}/roles/${roleId}`,
        { method: 'DELETE', headers: INTERNAL_SECRET ? { 'X-Internal-Secret': INTERNAL_SECRET } : {} }
      ).catch((e) => console.error('Revoke role error', e));
    }

    await supabaseAdmin
      .from('guild_shop_subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', subscriptionId);

    await supabaseAdmin.from('guild_shop_audit_log').insert({
      guild_id: guildId,
      action: 'subscription_revoked_by_admin',
      details: { subscription_id: subscriptionId, admin_discord_id: discordId },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Shop subscription revoke error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
