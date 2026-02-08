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

  const { data, error } = await supabaseAdmin
    .from('guild_shop_items')
    .select('id, name, description, price_amount_cents, currency')
    .eq('guild_id', guildId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Public shop fetch error:', error);
    return NextResponse.json({ error: 'Failed to load shop' }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
