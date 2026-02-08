/**
 * Pre-filled codes pool for a shop item (delivery_type = 'prefilled').
 * GET = list codes, POST = add codes (bulk), DELETE = remove one code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string; itemId: string }> }
) {
  const { guildId, itemId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId =
      (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: item, error: itemErr } = await supabaseAdmin
      .from('guild_shop_items')
      .select('id, delivery_type')
      .eq('guild_id', guildId)
      .eq('id', itemId)
      .maybeSingle();

    if (itemErr || !item || (item as { delivery_type?: string }).delivery_type !== 'prefilled') {
      return NextResponse.json({ error: 'Item not found or not a pre-filled code item' }, { status: 404 });
    }

    const { data: codes, error } = await supabaseAdmin
      .from('guild_shop_prefilled_codes')
      .select('id, code, created_at')
      .eq('guild_id', guildId)
      .eq('shop_item_id', itemId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Prefilled codes list error:', error);
      return NextResponse.json({ error: 'Failed to load codes' }, { status: 500 });
    }

    return NextResponse.json({ codes: codes ?? [] });
  } catch (e) {
    console.error('Prefilled codes GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; itemId: string }> }
) {
  const { guildId, itemId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId =
      (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: item, error: itemErr } = await supabaseAdmin
      .from('guild_shop_items')
      .select('id, delivery_type')
      .eq('guild_id', guildId)
      .eq('id', itemId)
      .maybeSingle();

    if (itemErr || !item || (item as { delivery_type?: string }).delivery_type !== 'prefilled') {
      return NextResponse.json({ error: 'Item not found or not a pre-filled code item' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const raw = body.codes ?? body.code;
    const toAdd: string[] = [];
    if (Array.isArray(raw)) {
      raw.forEach((c: unknown) => {
        if (typeof c === 'string' && c.trim()) toAdd.push(c.trim());
      });
    } else if (typeof raw === 'string') {
      raw.split(/[\n,;]+/).forEach((line) => {
        const t = line.trim();
        if (t) toAdd.push(t);
      });
    }

    if (toAdd.length === 0) {
      return NextResponse.json({ error: 'Provide codes (array or newline/comma-separated string)' }, { status: 400 });
    }

    const rows = toAdd.map((code) => ({
      guild_id: guildId,
      shop_item_id: itemId,
      code,
    }));

    const { data: inserted, error } = await supabaseAdmin
      .from('guild_shop_prefilled_codes')
      .insert(rows)
      .select('id, code');

    if (error) {
      console.error('Prefilled codes add error:', error);
      return NextResponse.json({ error: 'Failed to add codes' }, { status: 500 });
    }

    return NextResponse.json({ added: inserted?.length ?? toAdd.length, codes: inserted ?? [] });
  } catch (e) {
    console.error('Prefilled codes POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; itemId: string }> }
) {
  const { guildId, itemId } = await params;
  const { searchParams } = new URL(request.url);
  const codeId = searchParams.get('codeId');

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId =
      (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!codeId) {
      return NextResponse.json({ error: 'codeId query required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('guild_shop_prefilled_codes')
      .delete()
      .eq('id', codeId)
      .eq('guild_id', guildId)
      .eq('shop_item_id', itemId);

    if (error) {
      console.error('Prefilled code delete error:', error);
      return NextResponse.json({ error: 'Failed to delete code' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Prefilled codes DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
