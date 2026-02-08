/**
 * Single shop item: get, update, delete.
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

    const { data, error } = await supabaseAdmin
      .from('guild_shop_items')
      .select('*')
      .eq('guild_id', guildId)
      .eq('id', itemId)
      .maybeSingle();

    if (error) {
      console.error('Shop item fetch error:', error);
      return NextResponse.json({ error: 'Failed to load item' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('Shop item GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = await request.json();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.name === 'string') update.name = body.name.trim();
    if (typeof body.description === 'string') update.description = body.description.trim() || null;
    if (typeof body.priceAmountCents === 'number' && body.priceAmountCents >= 0) {
      update.price_amount_cents = body.priceAmountCents;
    }
    if (typeof body.currency === 'string') update.currency = body.currency.trim() || 'eur';
    if (typeof body.discordRoleId === 'string') update.discord_role_id = body.discordRoleId.trim();
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
    if (typeof body.sortOrder === 'number') update.sort_order = body.sortOrder;
    if (body.deliveryType === 'code' || body.deliveryType === 'role') update.delivery_type = body.deliveryType;

    const { data, error } = await supabaseAdmin
      .from('guild_shop_items')
      .update(update)
      .eq('guild_id', guildId)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Shop item update error:', error);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('Shop item PATCH error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    const { error } = await supabaseAdmin
      .from('guild_shop_items')
      .delete()
      .eq('guild_id', guildId)
      .eq('id', itemId);

    if (error) {
      console.error('Shop item delete error:', error);
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Shop item DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
