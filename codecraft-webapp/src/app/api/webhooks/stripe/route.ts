/**
 * Stripe webhook for guild shop: on checkout.session.completed, assign the purchased role.
 * URL must include guild_id so we can load that guild's webhook secret:
 *   https://yourapp.com/api/webhooks/stripe?guild_id=GUILD_ID
 * Server owner adds this URL in Stripe Dashboard and pastes the signing secret in our Payments page.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { generateShopCode } from '@/lib/comcraft/shop-codes';

export const dynamic = 'force-dynamic';

function verifyStripeSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const parts = signature.split(',');
  let t: string | null = null;
  let v1: string | null = null;
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') t = value;
    if (key === 'v1') v1 = value;
  }
  if (!t || !v1 || !secret) return false;
  const signedPayload = `${t}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  const a = Buffer.from(v1, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get('guild_id');
  if (!guildId) {
    return NextResponse.json(
      { error: 'Missing guild_id query. Use URL: .../api/webhooks/stripe?guild_id=YOUR_GUILD_ID' },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 401 });
  }

  const { data: config, error: configError } = await supabaseAdmin
    .from('guild_stripe_config')
    .select('stripe_webhook_secret')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (configError || !config?.stripe_webhook_secret) {
    console.error('Stripe webhook: no webhook secret for guild', guildId);
    return NextResponse.json(
      { error: 'Webhook not configured for this guild. Add the signing secret in Dashboard > Payments.' },
      { status: 400 }
    );
  }

  if (!verifyStripeSignature(rawBody, signature, config.stripe_webhook_secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { type: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object;
  const metadata = session?.metadata as Record<string, string> | undefined;
  const metaGuildId = metadata?.guild_id;
  const shopItemId = metadata?.shop_item_id;
  const discordId = metadata?.discord_id;

  if (!metaGuildId || !shopItemId || !discordId) {
    return NextResponse.json({ received: true });
  }

  if (metaGuildId !== guildId) {
    return NextResponse.json({ error: 'Guild ID mismatch' }, { status: 400 });
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from('guild_shop_items')
    .select('discord_role_id, delivery_type')
    .eq('guild_id', guildId)
    .eq('id', shopItemId)
    .maybeSingle();

  if (itemError || !item?.discord_role_id) {
    console.error('Stripe webhook: shop item not found', guildId, shopItemId);
    return NextResponse.json({ received: true });
  }

  const deliveryType = (item as { delivery_type?: string }).delivery_type || 'role';
  const stripeSessionId = (session as { id?: string }).id;

  if (deliveryType === 'code' && stripeSessionId) {
    const code = generateShopCode();
    const { error: insertErr } = await supabaseAdmin.from('guild_shop_codes').insert({
      guild_id: guildId,
      shop_item_id: shopItemId,
      code,
      discord_role_id: item.discord_role_id,
      stripe_session_id: stripeSessionId,
    });
    if (insertErr) {
      console.error('Stripe webhook: failed to create code', guildId, shopItemId, insertErr);
    }
    return NextResponse.json({ received: true });
  }

  const botApiUrl = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
  const internalSecret = process.env.INTERNAL_API_SECRET;

  const addRoleRes = await fetch(
    `${botApiUrl}/api/discord/${guildId}/users/${discordId}/roles`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalSecret ? { 'X-Internal-Secret': internalSecret } : {}),
      },
      body: JSON.stringify({ roleId: item.discord_role_id }),
    }
  );

  if (!addRoleRes.ok) {
    const err = await addRoleRes.json().catch(() => ({}));
    console.error('Stripe webhook: failed to add role', guildId, discordId, item.discord_role_id, err);
  }

  return NextResponse.json({ received: true });
}
