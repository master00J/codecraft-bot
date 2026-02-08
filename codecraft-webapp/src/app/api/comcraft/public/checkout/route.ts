/**
 * Public checkout: create Stripe Checkout Session or PayPal order using the guild's keys.
 * Used by payment links shared by server owners (e.g. in Discord). No auth required.
 * ?provider=stripe (default) or provider=paypal
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getPayPalAccessToken, createPayPalOrder } from '@/lib/comcraft/paypal';

export const dynamic = 'force-dynamic';

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 999;
const DEFAULT_CURRENCY = 'eur';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get('guildId');
  const amountParam = searchParams.get('amount');
  const currency = (searchParams.get('currency') || DEFAULT_CURRENCY).toLowerCase();
  const provider = (searchParams.get('provider') || 'stripe').toLowerCase();

  if (!guildId || !amountParam) {
    return NextResponse.json(
      { error: 'Missing guildId or amount. Use ?guildId=...&amount=5&currency=eur&provider=stripe|paypal' },
      { status: 400 }
    );
  }

  const amount = parseFloat(amountParam);
  if (Number.isNaN(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `Amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}` },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const successUrl = `${baseUrl}/comcraft/pay/thank-you`;
  const cancelUrl = `${baseUrl}/comcraft/pay?guildId=${guildId}&amount=${amount}&currency=${currency}`;

  if (provider === 'paypal') {
    const { data: config, error } = await supabaseAdmin
      .from('guild_paypal_config')
      .select('client_id, client_secret, enabled, sandbox')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error || !config?.client_id || !config?.client_secret || !config.enabled) {
      return NextResponse.json(
        { error: 'This server has not set up PayPal yet.' },
        { status: 400 }
      );
    }

    try {
      const accessToken = await getPayPalAccessToken(
        config.client_id,
        config.client_secret,
        config.sandbox !== false
      );
      const amountStr = amount.toFixed(2);
      const currencyCode = currency === 'eur' ? 'EUR' : currency === 'usd' ? 'USD' : currency.toUpperCase();
      const { approveUrl } = await createPayPalOrder({
        accessToken,
        sandbox: config.sandbox !== false,
        amountValue: amountStr,
        currencyCode,
        description: 'Support this server',
        returnUrl: successUrl,
        cancelUrl,
      });
      return NextResponse.redirect(approveUrl, 302);
    } catch (e) {
      console.error('PayPal checkout error:', e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'PayPal checkout failed' },
        { status: 500 }
      );
    }
  }

  // Stripe (default)
  const { data: config, error } = await supabaseAdmin
    .from('guild_stripe_config')
    .select('stripe_secret_key, enabled')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (error || !config?.stripe_secret_key || !config.enabled) {
    return NextResponse.json(
      { error: 'This server has not set up payments yet.' },
      { status: 400 }
    );
  }

  const unitAmount = Math.round(amount * 100);

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('line_items[0][quantity]', '1');
  params.append('line_items[0][price_data][currency]', currency);
  params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
  params.append('line_items[0][price_data][product_data][name]', 'Support this server');
  params.append('line_items[0][price_data][product_data][description]', 'Thank you for your support!');
  params.append('metadata[guild_id]', guildId);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripe_secret_key}`,
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

  if (data.url) {
    return NextResponse.redirect(data.url, 302);
  }

  return NextResponse.json(
    { error: 'No checkout URL returned' },
    { status: 500 }
  );
}
