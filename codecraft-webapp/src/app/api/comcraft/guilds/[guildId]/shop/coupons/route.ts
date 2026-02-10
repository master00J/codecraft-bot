/**
 * Shop coupons CRUD: list and create.
 * discount_type: percentage (value 1-100) or fixed (value in cents).
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
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const discordId = (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from('guild_shop_coupons')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Shop coupons fetch error:', error);
      return NextResponse.json({ error: 'Failed to load coupons' }, { status: 500 });
    }
    return NextResponse.json({ coupons: data ?? [] });
  } catch (e) {
    console.error('Shop coupons GET error:', e);
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
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const discordId = (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase().replace(/\s/g, '') : '';
    const discountType = body.discountType === 'fixed' ? 'fixed' : 'percentage';
    const discountValue = typeof body.discountValue === 'number' ? body.discountValue : (discountType === 'percentage' ? 10 : 100);
    const maxRedemptions = typeof body.maxRedemptions === 'number' && body.maxRedemptions > 0 ? body.maxRedemptions : null;
    const validUntil = typeof body.validUntil === 'string' && body.validUntil ? body.validUntil : null;

    if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 });
    if (discountType === 'percentage' && (discountValue < 1 || discountValue > 100)) {
      return NextResponse.json({ error: 'Percentage must be between 1 and 100' }, { status: 400 });
    }
    if (discountType === 'fixed' && discountValue < 1) {
      return NextResponse.json({ error: 'Fixed discount must be at least 1 cent' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('guild_shop_coupons')
      .insert({
        guild_id: guildId,
        code,
        discount_type: discountType,
        discount_value_cents: discountValue,
        max_redemptions: maxRedemptions,
        valid_until: validUntil,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A coupon with this code already exists' }, { status: 400 });
      console.error('Shop coupon insert error:', error);
      return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error('Shop coupons POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
