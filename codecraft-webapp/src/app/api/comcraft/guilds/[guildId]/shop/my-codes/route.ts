/**
 * GET: Codes the logged-in user has purchased (code/prefilled items) that are not yet used.
 * So they can retrieve their code again if they closed the thank-you page.
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
      return NextResponse.json({ codes: [] }, { status: 200 });
    }

    const discordId =
      (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ codes: [] }, { status: 200 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ codes: [] }, { status: 200 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('guild_shop_codes')
      .select('id, code, shop_item_id, created_at')
      .eq('guild_id', guildId)
      .eq('buyer_discord_id', discordId)
      .is('used_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('My codes fetch error:', error);
      return NextResponse.json({ codes: [] }, { status: 200 });
    }

    const itemIds = Array.from(new Set((rows ?? []).map((r: { shop_item_id: string }) => r.shop_item_id)));
    let itemNames: Record<string, string> = {};
    if (itemIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('guild_shop_items')
        .select('id, name')
        .in('id', itemIds);
      (items ?? []).forEach((i: { id: string; name: string }) => {
        itemNames[i.id] = i.name;
      });
    }

    const codes = (rows ?? []).map((r: { id: string; code: string; shop_item_id: string; created_at: string }) => ({
      id: r.id,
      code: r.code,
      itemName: itemNames[r.shop_item_id] ?? null,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ codes });
  } catch (e) {
    console.error('My codes error:', e);
    return NextResponse.json({ codes: [] }, { status: 200 });
  }
}
