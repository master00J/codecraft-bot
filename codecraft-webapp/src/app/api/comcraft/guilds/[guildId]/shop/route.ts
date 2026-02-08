/**
 * Shop CRUD: list and create guild shop items (e.g. buyable roles).
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
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Shop items fetch error:', error);
      return NextResponse.json({ error: 'Failed to load shop items' }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    console.error('Shop GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

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
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const priceAmountCents = typeof body.priceAmountCents === 'number' ? body.priceAmountCents : undefined;
    const currency = typeof body.currency === 'string' ? body.currency.trim() || 'eur' : 'eur';
    const discordRoleId = typeof body.discordRoleId === 'string' ? body.discordRoleId.trim() : '';
    const enabled = body.enabled !== false;
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : 0;
    const deliveryType =
      body.deliveryType === 'prefilled' ? 'prefilled'
      : body.deliveryType === 'code' ? 'code' : 'role';

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (deliveryType !== 'prefilled' && !discordRoleId) {
      return NextResponse.json(
        { error: 'Select a Discord role for this item (required for Role and Gift card)' },
        { status: 400 }
      );
    }
    if (priceAmountCents == null || priceAmountCents < 1) {
      return NextResponse.json(
        { error: 'priceAmountCents must be a positive number' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('guild_shop_items')
      .insert({
        guild_id: guildId,
        name,
        description: description || null,
        price_amount_cents: priceAmountCents,
        currency,
        discord_role_id: deliveryType === 'prefilled' ? null : discordRoleId,
        enabled,
        sort_order: sortOrder,
        delivery_type: deliveryType,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Shop item insert error:', error);
      return NextResponse.json({ error: 'Failed to create shop item' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error('Shop POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
