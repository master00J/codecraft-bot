/**
 * List shop subscriptions for dashboard (admin). Revoke via PATCH on subscriptions/[id].
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const discordId = (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'active';
    const { data: rows, error } = await supabaseAdmin
      .from('guild_shop_subscriptions')
      .select('id, shop_item_id, discord_user_id, stripe_subscription_id, status, current_period_end, created_at')
      .eq('guild_id', guildId)
      .in('status', statusFilter === 'all' ? ['active', 'cancelled', 'expired'] : [statusFilter])
      .order('current_period_end', { ascending: false });
    if (error) {
      console.error('Shop subscriptions fetch error:', error);
      return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 });
    }
    const itemIds = Array.from(new Set((rows ?? []).map((r: { shop_item_id: string }) => r.shop_item_id)));
    let itemNames: Record<string, string> = {};
    if (itemIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('guild_shop_items')
        .select('id, name')
        .in('id', itemIds);
      (items ?? []).forEach((i: { id: string; name: string }) => { itemNames[i.id] = i.name; });
    }
    const subscriptions = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      shopItemId: r.shop_item_id,
      itemName: itemNames[(r.shop_item_id as string)] ?? null,
      discordUserId: r.discord_user_id,
      stripeSubscriptionId: r.stripe_subscription_id,
      status: r.status,
      currentPeriodEnd: r.current_period_end,
      createdAt: r.created_at,
    }));
    return NextResponse.json({ subscriptions });
  } catch (e) {
    console.error('Shop subscriptions GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
