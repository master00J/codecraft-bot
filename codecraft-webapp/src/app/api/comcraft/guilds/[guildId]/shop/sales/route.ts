/**
 * Recent sales for dashboard (from guild_shop_orders).
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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const { data: orders, error } = await supabaseAdmin
      .from('guild_shop_orders')
      .select('id, shop_item_id, discord_user_id, amount_cents, currency, delivery_type, created_at')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('Shop sales fetch error:', error);
      return NextResponse.json({ error: 'Failed to load sales' }, { status: 500 });
    }
    const itemIds = [...new Set((orders ?? []).map((o: { shop_item_id: string }) => o.shop_item_id))];
    let itemNames: Record<string, string> = {};
    if (itemIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('guild_shop_items')
        .select('id, name')
        .in('id', itemIds);
      (items ?? []).forEach((i: { id: string; name: string }) => { itemNames[i.id] = i.name; });
    }
    const sales = (orders ?? []).map((o: Record<string, unknown>) => ({
      id: o.id,
      shopItemId: o.shop_item_id,
      itemName: itemNames[(o.shop_item_id as string)] ?? null,
      discordUserId: o.discord_user_id,
      amountCents: o.amount_cents,
      currency: o.currency,
      deliveryType: o.delivery_type,
      createdAt: o.created_at,
    }));
    return NextResponse.json({ sales });
  } catch (e) {
    console.error('Shop sales GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
