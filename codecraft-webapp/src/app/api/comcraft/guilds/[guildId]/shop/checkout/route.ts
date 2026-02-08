/**
 * Create Stripe Checkout Session for a shop item.
 * Authenticated: uses session discordId. Or internal call with body.discordId (e.g. from bot).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    let discordId: string | null = null;

    const internalSecret = request.headers.get('x-internal-secret');
    if (INTERNAL_SECRET && internalSecret === INTERNAL_SECRET) {
      const body = await request.json();
      discordId = typeof body.discordId === 'string' ? body.discordId.trim() : null;
      if (!discordId) {
        return NextResponse.json(
          { error: 'Internal call requires body.discordId' },
          { status: 400 }
        );
      }
    } else {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      discordId =
        (session.user as any).discordId || session.user.id || (session.user as any).sub;
      if (!discordId) {
        return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
      }
      const access = await getGuildAccess(guildId, discordId);
      if (!access.allowed) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    if (!itemId) {
      return NextResponse.json({ error: 'itemId query required' }, { status: 400 });
    }

    const { data: item, error: itemError } = await supabaseAdmin
      .from('guild_shop_items')
      .select('id, name, description, price_amount_cents, currency, discord_role_id, enabled')
      .eq('guild_id', guildId)
      .eq('id', itemId)
      .eq('enabled', true)
      .maybeSingle();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Shop item not found or disabled' }, { status: 404 });
    }

    const { data: stripeConfig, error: configError } = await supabaseAdmin
      .from('guild_stripe_config')
      .select('stripe_secret_key, enabled')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (configError || !stripeConfig?.stripe_secret_key || !stripeConfig.enabled) {
      return NextResponse.json(
        { error: 'This server has not set up payments yet.' },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const successUrl = `${baseUrl}/comcraft/pay/thank-you?shop=1`;
    const cancelUrl = `${baseUrl}/comcraft/pay?guildId=${guildId}&shop=1`;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('customer_email', ''); // optional; Stripe can collect
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', (item.currency || 'eur').toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(item.price_amount_cents));
    params.append('line_items[0][price_data][product_data][name]', item.name);
    if (item.description) {
      params.append('line_items[0][price_data][product_data][description]', item.description);
    }
    params.append('metadata[guild_id]', guildId);
    params.append('metadata[shop_item_id]', item.id);
    params.append('metadata[discord_id]', discordId);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeConfig.stripe_secret_key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-12-18.acacia',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Stripe checkout error:', data);
      return NextResponse.json(
        { error: data.error?.message || 'Failed to create checkout' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.url, sessionId: data.id });
  } catch (e) {
    console.error('Shop checkout error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
