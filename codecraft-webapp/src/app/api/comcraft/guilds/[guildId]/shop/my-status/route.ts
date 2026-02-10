/**
 * For logged-in user: which shop items they own (one-time) or have active subscription.
 * Used by store front to show "Owned" / "Subscribed" and "Manage subscription".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ownedItemIds: [], subscriptions: [] }, { status: 200 });
    }

    const discordId =
      (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ ownedItemIds: [], subscriptions: [] }, { status: 200 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ ownedItemIds: [], subscriptions: [] }, { status: 200 });
    }

    const [ordersRes, codesRes, subsRes] = await Promise.all([
      supabaseAdmin
        .from('guild_shop_orders')
        .select('shop_item_id')
        .eq('guild_id', guildId)
        .eq('discord_user_id', discordId),
      supabaseAdmin
        .from('guild_shop_codes')
        .select('shop_item_id')
        .eq('guild_id', guildId)
        .eq('used_by_discord_id', discordId)
        .not('used_at', 'is', null),
      supabaseAdmin
        .from('guild_shop_subscriptions')
        .select('shop_item_id, current_period_end, stripe_subscription_id')
        .eq('guild_id', guildId)
        .eq('discord_user_id', discordId)
        .eq('status', 'active'),
    ]);

    const fromOrders = (ordersRes.data ?? []).map((r: { shop_item_id: string }) => r.shop_item_id);
    const fromCodes = (codesRes.data ?? []).map((r: { shop_item_id: string }) => r.shop_item_id);
    const ownedItemIds = Array.from(new Set([...fromOrders, ...fromCodes]));
    const subscriptions = (subsRes.data ?? []).map((r: { shop_item_id: string; current_period_end: string; stripe_subscription_id: string | null }) => ({
      itemId: r.shop_item_id,
      currentPeriodEnd: r.current_period_end,
      stripeSubscriptionId: r.stripe_subscription_id,
    }));

    return NextResponse.json({ ownedItemIds, subscriptions });
  } catch (e) {
    console.error('Shop my-status error:', e);
    return NextResponse.json({ ownedItemIds: [], subscriptions: [] }, { status: 200 });
  }
}
