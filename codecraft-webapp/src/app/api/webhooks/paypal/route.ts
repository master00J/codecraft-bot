/**
 * PayPal webhook for guild shop: on PAYMENT.CAPTURE.COMPLETED, assign the purchased role.
 * URL: https://yourapp.com/api/webhooks/paypal?guild_id=GUILD_ID
 * Server owner adds this URL in PayPal Developer Dashboard and pastes the Webhook ID in Payments page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getPayPalAccessToken } from '@/lib/comcraft/paypal';
import { generateShopCode } from '@/lib/comcraft/shop-codes';

export const dynamic = 'force-dynamic';

const PAYPAL_SANDBOX = 'https://api-m.sandbox.paypal.com';
const PAYPAL_LIVE = 'https://api-m.paypal.com';

function baseUrl(sandbox: boolean) {
  return sandbox ? PAYPAL_SANDBOX : PAYPAL_LIVE;
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get('guild_id');
  if (!guildId) {
    return NextResponse.json(
      { error: 'Missing guild_id query. Use .../api/webhooks/paypal?guild_id=YOUR_GUILD_ID' },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const transmissionId = request.headers.get('paypal-transmission-id');
  const transmissionTime = request.headers.get('paypal-transmission-time');
  const certUrl = request.headers.get('paypal-cert-url');
  const authAlgo = request.headers.get('paypal-auth-algo');
  const transmissionSig = request.headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return NextResponse.json({ error: 'Missing PayPal webhook headers' }, { status: 400 });
  }

  const { data: config, error: configError } = await supabaseAdmin
    .from('guild_paypal_config')
    .select('client_id, client_secret, webhook_id, sandbox')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (configError || !config?.client_id || !config?.client_secret || !config?.webhook_id) {
    console.error('PayPal webhook: no config or webhook_id for guild', guildId);
    return NextResponse.json(
      { error: 'PayPal webhook not configured for this guild. Add Webhook ID in Dashboard → Payments.' },
      { status: 400 }
    );
  }

  const accessToken = await getPayPalAccessToken(
    config.client_id,
    config.client_secret,
    config.sandbox !== false
  );

  const verifyRes = await fetch(`${baseUrl(config.sandbox !== false)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: config.webhook_id,
      webhook_event: JSON.parse(rawBody),
    }),
  });

  const verifyData = await verifyRes.json();
  if (verifyData.verification_status !== 'SUCCESS') {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { event_type?: string; resource?: { custom_id?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return NextResponse.json({ received: true });
  }

  const customId = event.resource?.custom_id;
  if (!customId) {
    return NextResponse.json({ received: true });
  }

  let payload: { guild_id?: string; shop_item_id?: string; discord_id?: string };
  try {
    payload = JSON.parse(customId);
  } catch {
    return NextResponse.json({ received: true });
  }

  const { guild_id: metaGuildId, shop_item_id: shopItemId, discord_id: discordId } = payload;
  if (!metaGuildId || !shopItemId || !discordId || metaGuildId !== guildId) {
    return NextResponse.json({ received: true });
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from('guild_shop_items')
    .select('name, discord_role_id, delivery_type')
    .eq('guild_id', guildId)
    .eq('id', shopItemId)
    .maybeSingle();

  if (itemError || !item) {
    console.error('PayPal webhook: shop item not found', guildId, shopItemId);
    return NextResponse.json({ received: true });
  }

  const deliveryType = (item as { delivery_type?: string }).delivery_type || 'role';
  const resource = event.resource as {
    id?: string;
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
  const paypalCaptureId = resource?.id;
  const paypalOrderId = resource?.supplementary_data?.related_ids?.order_id;
  const amountValue = resource?.amount?.value;
  const currencyCode = resource?.amount?.currency_code ?? 'eur';
  const amountStr = amountValue ? `${currencyCode.toUpperCase()} ${amountValue}` : '';
  const amountCents = amountValue != null ? Math.round(parseFloat(amountValue) * 100) : 0;
  const currency = currencyCode?.toLowerCase() ?? 'eur';

  // Log order in guild_shop_orders so "Recent sales" shows PayPal purchases too.
  const { data: orderRow } = await supabaseAdmin
    .from('guild_shop_orders')
    .insert({
      guild_id: guildId,
      shop_item_id: shopItemId,
      discord_user_id: discordId,
      amount_cents: amountCents,
      currency,
      delivery_type: deliveryType,
      paypal_capture_id: paypalCaptureId ?? null,
    })
    .select('id')
    .single();
  const orderId = (orderRow as { id?: string } | null)?.id ?? null;
  await supabaseAdmin.from('guild_shop_audit_log').insert({
    guild_id: guildId,
    action: 'order_created',
    details: { shop_item_id: shopItemId, discord_user_id: discordId, paypal_capture_id: paypalCaptureId, order_id: orderId },
  });

  if (deliveryType === 'prefilled' && paypalCaptureId) {
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
        paypal_capture_id: paypalCaptureId,
        paypal_order_id: paypalOrderId ?? null,
        buyer_discord_id: discordId,
      });
    }
    return NextResponse.json({ received: true });
  }

  if (deliveryType === 'code' && paypalCaptureId && item.discord_role_id) {
    const code = generateShopCode();
    const { error: insertErr } = await supabaseAdmin.from('guild_shop_codes').insert({
      guild_id: guildId,
      shop_item_id: shopItemId,
      code,
      discord_role_id: item.discord_role_id,
      paypal_capture_id: paypalCaptureId,
      paypal_order_id: paypalOrderId ?? null,
      buyer_discord_id: discordId,
    });
    if (insertErr) {
      console.error('PayPal webhook: failed to create code', guildId, shopItemId, insertErr);
    }
    return NextResponse.json({ received: true });
  }

  if (deliveryType === 'role' && item.discord_role_id) {
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
      console.error('PayPal webhook: failed to add role', guildId, discordId, item.discord_role_id, err);
    } else {
      await supabaseAdmin.from('guild_shop_audit_log').insert({
        guild_id: guildId,
        action: 'role_assigned',
        details: { shop_item_id: shopItemId, discord_user_id: discordId, paypal_capture_id: paypalCaptureId },
      });
    }
  }

  // Notify in configured Discord channel (same as Stripe).
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
    const content = `🛒 <@${discordId}> purchased **${itemName}**${amountStr ? ` — ${amountStr}` : ''}`;
    await fetch(`${botApiUrl}/api/discord/${guildId}/channels/${notifChannelId.trim()}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalSecret ? { 'X-Internal-Secret': internalSecret } : {}),
      },
      body: JSON.stringify({ content }),
    }).catch((e) => console.error('PayPal webhook: failed to send purchase notification', e));
  }

  return NextResponse.json({ received: true });
}
