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
    .select('stripe_webhook_secret, stripe_secret_key')
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

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data?.object as { id?: string; current_period_end?: number };
    const subId = subscription?.id;
    const periodEnd = subscription?.current_period_end;
    if (!subId || periodEnd == null) return NextResponse.json({ received: true });

    const periodEndIso = new Date(periodEnd * 1000).toISOString();
    await supabaseAdmin
      .from('guild_shop_subscriptions')
      .update({ current_period_end: periodEndIso, updated_at: new Date().toISOString() })
      .eq('guild_id', guildId)
      .eq('stripe_subscription_id', subId);
    return NextResponse.json({ received: true });
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data?.object as { id?: string };
    const subId = subscription?.id;
    if (!subId) return NextResponse.json({ received: true });

    const { data: row, error: subErr } = await supabaseAdmin
      .from('guild_shop_subscriptions')
      .select('id, guild_id, shop_item_id, discord_user_id')
      .eq('guild_id', guildId)
      .eq('stripe_subscription_id', subId)
      .eq('status', 'active')
      .maybeSingle();

    if (subErr || !row) return NextResponse.json({ received: true });

    const { data: shopItem } = await supabaseAdmin
      .from('guild_shop_items')
      .select('discord_role_id')
      .eq('id', (row as { shop_item_id: string }).shop_item_id)
      .maybeSingle();

    const roleId = shopItem?.discord_role_id;
    const discordUserId = (row as { discord_user_id: string }).discord_user_id;

    if (roleId) {
      const botApiUrl = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
      const internalSecret = process.env.INTERNAL_API_SECRET;
      await fetch(
        `${botApiUrl}/api/discord/${guildId}/users/${discordUserId}/roles/${roleId}`,
        {
          method: 'DELETE',
          headers: internalSecret ? { 'X-Internal-Secret': internalSecret } : {},
        }
      ).catch((e) => console.error('Stripe webhook: failed to remove role', e));
    }

    await supabaseAdmin
      .from('guild_shop_subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', (row as { id: string }).id);

    await supabaseAdmin.from('guild_shop_audit_log').insert({
      guild_id: guildId,
      action: 'subscription_cancelled',
      details: { stripe_subscription_id: subId, shop_item_id: (row as { shop_item_id: string }).shop_item_id, discord_user_id: discordUserId },
    });

    return NextResponse.json({ received: true });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object as {
    id?: string;
    mode?: string;
    subscription?: string;
    metadata?: Record<string, string>;
    amount_total?: number;
    currency?: string;
  };
  const metadata = session?.metadata;
  const metaGuildId = metadata?.guild_id;
  const shopItemId = metadata?.shop_item_id;
  const discordId = metadata?.discord_id;
  const couponId = metadata?.coupon_id;

  if (!metaGuildId || !shopItemId || !discordId) {
    return NextResponse.json({ received: true });
  }

  if (metaGuildId !== guildId) {
    return NextResponse.json({ error: 'Guild ID mismatch' }, { status: 400 });
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from('guild_shop_items')
    .select('name, discord_role_id, delivery_type, billing_type, price_amount_cents, currency')
    .eq('guild_id', guildId)
    .eq('id', shopItemId)
    .maybeSingle();

  if (itemError || !item) {
    console.error('Stripe webhook: shop item not found', guildId, shopItemId);
    return NextResponse.json({ received: true });
  }

  const deliveryType = (item as { delivery_type?: string }).delivery_type || 'role';
  const billingType = (item as { billing_type?: string }).billing_type || 'one_time';
  const stripeSessionId = session?.id;
  const isSubscription = session?.mode === 'subscription' && billingType === 'subscription' && session?.subscription;
  const amountCents = session?.amount_total ?? (item as { price_amount_cents?: number }).price_amount_cents ?? 0;
  const currency = (session?.currency ?? (item as { currency?: string }).currency ?? 'eur').toLowerCase();

  if (couponId) {
    const { data: couponRow } = await supabaseAdmin
      .from('guild_shop_coupons')
      .select('redemption_count')
      .eq('id', couponId)
      .eq('guild_id', guildId)
      .single();
    const count = (couponRow as { redemption_count?: number } | null)?.redemption_count ?? 0;
    await supabaseAdmin
      .from('guild_shop_coupons')
      .update({ redemption_count: count + 1, updated_at: new Date().toISOString() })
      .eq('id', couponId)
      .eq('guild_id', guildId);
  }

  let orderId: string | null = null;
  const { data: orderRow } = await supabaseAdmin
    .from('guild_shop_orders')
    .insert({
      guild_id: guildId,
      shop_item_id: shopItemId,
      discord_user_id: discordId,
      amount_cents: amountCents,
      currency,
      delivery_type: deliveryType,
      stripe_session_id: stripeSessionId,
    })
    .select('id')
    .single();
  orderId = (orderRow as { id?: string } | null)?.id ?? null;

  await supabaseAdmin.from('guild_shop_audit_log').insert({
    guild_id: guildId,
    action: 'order_created',
    details: { shop_item_id: shopItemId, discord_user_id: discordId, stripe_session_id: stripeSessionId, order_id: orderId },
  });

  // Notify in configured Discord channel when someone purchases (e.g. private notifications channel).
  const itemName = (item as { name?: string })?.name || 'Premium';
  const { data: shopSettings } = await supabaseAdmin
    .from('guild_shop_settings')
    .select('purchase_notification_channel_id')
    .eq('guild_id', guildId)
    .maybeSingle();
  const notifChannelId = (shopSettings as { purchase_notification_channel_id?: string } | null)?.purchase_notification_channel_id;
  if (notifChannelId && notifChannelId.trim()) {
    const botApiUrl = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const amountStr = amountCents ? `€${(amountCents / 100).toFixed(2)}` : '';
    const typeLabel = isSubscription ? ' (subscription)' : '';
    const content = `🛒 <@${discordId}> purchased **${itemName}**${typeLabel}${amountStr ? ` — ${amountStr}` : ''}`;
    await fetch(`${botApiUrl}/api/discord/${guildId}/channels/${notifChannelId.trim()}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalSecret ? { 'X-Internal-Secret': internalSecret } : {}),
      },
      body: JSON.stringify({ content }),
    }).catch((e) => console.error('Stripe webhook: failed to send purchase notification', e));
  }

  if (deliveryType === 'prefilled' && stripeSessionId) {
    const { data: poolRow } = await supabaseAdmin
      .from('guild_shop_prefilled_codes')
      .select('id, code')
      .eq('guild_id', guildId)
      .eq('shop_item_id', shopItemId)
      .limit(1)
      .maybeSingle();

    if (poolRow) {
      await supabaseAdmin
        .from('guild_shop_prefilled_codes')
        .delete()
        .eq('id', (poolRow as { id: string }).id);
      await supabaseAdmin.from('guild_shop_codes').insert({
        guild_id: guildId,
        shop_item_id: shopItemId,
        code: (poolRow as { code: string }).code,
        discord_role_id: null,
        stripe_session_id: stripeSessionId,
        buyer_discord_id: discordId,
      });
    }
    return NextResponse.json({ received: true });
  }

  if (deliveryType === 'code' && stripeSessionId && item.discord_role_id) {
    const code = generateShopCode();
    const { error: insertErr } = await supabaseAdmin.from('guild_shop_codes').insert({
      guild_id: guildId,
      shop_item_id: shopItemId,
      code,
      discord_role_id: item.discord_role_id,
      stripe_session_id: stripeSessionId,
      buyer_discord_id: discordId,
    });
    if (insertErr) {
      console.error('Stripe webhook: failed to create code', guildId, shopItemId, insertErr);
    }
    return NextResponse.json({ received: true });
  }

  if (deliveryType === 'role' && item.discord_role_id) {
    if (isSubscription && session?.subscription && config?.stripe_secret_key) {
      const stripeSubRes = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
        headers: { Authorization: `Bearer ${config.stripe_secret_key}` },
      });
      const stripeSub = await stripeSubRes.json().catch(() => ({}));
      const periodEnd = stripeSub.current_period_end
        ? new Date((stripeSub.current_period_end as number) * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabaseAdmin.from('guild_shop_subscriptions').upsert(
        {
          guild_id: guildId,
          shop_item_id: shopItemId,
          discord_user_id: discordId,
          stripe_subscription_id: session.subscription,
          status: 'active',
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'guild_id,shop_item_id,discord_user_id' }
      );
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
    } else {
      await supabaseAdmin.from('guild_shop_audit_log').insert({
        guild_id: guildId,
        action: 'role_assigned',
        details: { shop_item_id: shopItemId, discord_user_id: discordId, stripe_session_id: stripeSessionId },
      });
    }
  }

  return NextResponse.json({ received: true });
}
