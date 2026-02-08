/**
 * Get a purchased code by Stripe session_id or PayPal order_id (for thank-you page).
 * Public: no auth required; used after redirect from payment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const paypalOrderId = searchParams.get('paypal_order_id');
  const guildId = searchParams.get('guild_id');

  if (!guildId || (!sessionId && !paypalOrderId)) {
    return NextResponse.json(
      { error: 'Missing guild_id and (session_id or paypal_order_id)' },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from('guild_shop_codes')
    .select('code')
    .eq('guild_id', guildId)
    .is('used_at', null);

  if (sessionId) {
    query = query.eq('stripe_session_id', sessionId);
  } else if (paypalOrderId) {
    query = query.eq('paypal_order_id', paypalOrderId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Code-by-session fetch error:', error);
    return NextResponse.json({ error: 'Failed to load code' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ code: null, itemName: null });
  }

  return NextResponse.json({
    code: (data as { code: string }).code,
    itemName: null,
  });
}
