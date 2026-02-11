/**
 * Public shop listing: enabled items for a guild (for bot /shop and public store).
 * Returns categories, items (with image_url, compare_at_price_cents, category_id, stock_remaining), settings (trust, testimonials, terms, refund).
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

  const [itemsResult, settingsResult, categoriesResult] = await Promise.all([
    supabaseAdmin
      .from('guild_shop_items')
      .select('id, name, description, price_amount_cents, compare_at_price_cents, currency, delivery_type, billing_type, subscription_interval, subscription_interval_count, image_url, category_id')
      .eq('guild_id', guildId)
      .eq('enabled', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('guild_shop_settings')
      .select('store_name, store_description, store_primary_color, store_logo_url, store_footer_text, trust_badges_json, testimonials_json, terms_url, refund_policy_url, terms_content, refund_policy_content, currency_disclaimer, store_background_image_url, store_color_preset, store_secondary_color, store_background_color')
      .eq('guild_id', guildId)
      .maybeSingle(),
    supabaseAdmin
      .from('guild_shop_categories')
      .select('id, name, color, sort_order')
      .eq('guild_id', guildId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ]);

  const { data: rows, error } = itemsResult;
  if (error) {
    console.error('Public shop fetch error:', error);
    return NextResponse.json({ error: 'Failed to load shop' }, { status: 500 });
  }

  const items = (rows ?? []) as { id: string; delivery_type?: string; billing_type?: string; subscription_interval?: string; subscription_interval_count?: number; image_url?: string | null; compare_at_price_cents?: number | null; category_id?: string | null }[];
  const prefilledIds = items.filter((i) => i.delivery_type === 'prefilled').map((i) => i.id);

  let stockByItem: Record<string, number> = {};
  if (prefilledIds.length > 0) {
    const { data: prefilledRows } = await supabaseAdmin
      .from('guild_shop_prefilled_codes')
      .select('shop_item_id')
      .in('shop_item_id', prefilledIds);
    (prefilledRows ?? []).forEach((r: { shop_item_id: string }) => {
      stockByItem[r.shop_item_id] = (stockByItem[r.shop_item_id] ?? 0) + 1;
    });
  }

  const filtered = items
    .filter((i) => i.delivery_type !== 'prefilled' || (stockByItem[i.id] ?? 0) > 0)
    .map((item) => {
      const { delivery_type: _dt, ...rest } = item;
      const stockRemaining = item.delivery_type === 'prefilled' ? (stockByItem[item.id] ?? 0) : null;
      return { ...rest, stock_remaining: stockRemaining };
    });

  const settings = settingsResult.data ?? null;
  const categories = categoriesResult.data ?? [];

  return NextResponse.json({
    items: filtered,
    categories: categories as { id: string; name: string; color: string | null; sort_order: number }[],
    settings: settings ? {
      storeName: settings.store_name,
      storeDescription: settings.store_description,
      storePrimaryColor: settings.store_primary_color || '#5865F2',
      storeLogoUrl: settings.store_logo_url,
      storeFooterText: settings.store_footer_text,
      trustBadges: settings.trust_badges_json ?? null,
      testimonials: settings.testimonials_json ?? null,
      termsUrl: settings.terms_url ?? null,
      refundPolicyUrl: settings.refund_policy_url ?? null,
      termsContent: settings.terms_content ?? null,
      refundPolicyContent: settings.refund_policy_content ?? null,
      currencyDisclaimer: settings.currency_disclaimer ?? null,
      storeBackgroundImageUrl: settings.store_background_image_url ?? null,
      storeColorPreset: settings.store_color_preset ?? 'default',
      storeSecondaryColor: settings.store_secondary_color ?? null,
      storeBackgroundColor: settings.store_background_color ?? null,
    } : null,
  });
}
