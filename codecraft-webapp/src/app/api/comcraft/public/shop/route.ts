/**
 * Public shop listing: enabled items for a guild (for bot /shop and public store).
 * Does not expose discord_role_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get('guildId');

  if (!guildId) {
    return NextResponse.json(
      { error: 'Missing guildId. Use ?guildId=...' },
      { status: 400 }
    );
  }

  const [itemsResult, settingsResult] = await Promise.all([
    supabaseAdmin
      .from('guild_shop_items')
      .select('id, name, description, price_amount_cents, currency, delivery_type, billing_type, subscription_interval, subscription_interval_count')
      .eq('guild_id', guildId)
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('guild_shop_settings')
      .select('store_name, store_description, store_primary_color, store_logo_url, store_footer_text')
      .eq('guild_id', guildId)
      .maybeSingle(),
  ]);

  const { data: rows, error } = itemsResult;
  if (error) {
    console.error('Public shop fetch error:', error);
    return NextResponse.json({ error: 'Failed to load shop' }, { status: 500 });
  }

  const items = (rows ?? []) as { id: string; delivery_type?: string; billing_type?: string; subscription_interval?: string; subscription_interval_count?: number }[];
  const prefilledIds = items.filter((i) => i.delivery_type === 'prefilled').map((i) => i.id);

  let inStockPrefilled = new Set<string>();
  if (prefilledIds.length > 0) {
    const { data: counts } = await supabaseAdmin
      .from('guild_shop_prefilled_codes')
      .select('shop_item_id')
      .in('shop_item_id', prefilledIds);
    counts?.forEach((r: { shop_item_id: string }) => inStockPrefilled.add(r.shop_item_id));
  }

  const filtered = items
    .filter((i) => i.delivery_type !== 'prefilled' || inStockPrefilled.has(i.id))
    .map(({ delivery_type: _dt, ...rest }) => rest);

  const settings = settingsResult.data ?? null;

  return NextResponse.json({
    items: filtered,
    settings: settings ? {
      storeName: settings.store_name,
      storeDescription: settings.store_description,
      storePrimaryColor: settings.store_primary_color || '#5865F2',
      storeLogoUrl: settings.store_logo_url,
      storeFooterText: settings.store_footer_text,
    } : null,
  });
}
