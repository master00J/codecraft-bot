import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requirePaymentProviderConfig } from '@/lib/payments/providers';
import { markPaymentStatus, markOrderPaid } from '@/lib/payments/state';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createLicenseForUser, assignLicenseToGuild } from '@/lib/comcraft/licenses';
import type { ComcraftTierId } from '@/lib/comcraft/tiers';

export const dynamic = 'force-dynamic';

async function finalizeOrder(orderId: string, provider: string, paymentId?: string) {
  await markOrderPaid(orderId, provider);
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, discord_guild_id, service_name, additional_info')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    console.error('Failed to load order during webhook finalize', orderId, error);
    return;
  }

  if (!order.user_id) {
    console.error('Order missing user_id during webhook finalize', orderId);
    return;
  }

  // Parse additional_info to get expiresAt and maxGuilds
  let expiresAt: string | null = null;
  let maxGuilds: number | undefined = undefined;
  if (order.additional_info) {
    try {
      const additionalInfo = JSON.parse(order.additional_info);
      expiresAt = additionalInfo.expiresAt || null;
      maxGuilds = additionalInfo.maxGuilds ? Number(additionalInfo.maxGuilds) : undefined;
    } catch (e) {
      console.warn('Failed to parse additional_info for order', orderId, e);
    }
  }

  try {
    const license = await createLicenseForUser({
      userId: order.user_id,
      tier: (order.service_name?.toLowerCase() || 'premium') as ComcraftTierId,
      paymentId,
      expiresAt,
      maxGuilds,
    });

    if (order.discord_guild_id) {
      await assignLicenseToGuild(license.id, order.discord_guild_id);
    }
  } catch (licenseError) {
    console.error('Failed to provision license during webhook finalize', orderId, licenseError);
  }
}

async function handleCoinPayments(request: NextRequest) {
  const rawBody = await request.text();
  const formData = new URLSearchParams(rawBody);
  const paymentId = formData.get('item_number');
  const status = parseInt(formData.get('status') || '0', 10);
  const txnId = formData.get('txn_id');

  if (!paymentId) {
    return NextResponse.json({ error: 'Missing payment id' }, { status: 400 });
  }

  const hmacHeader = request.headers.get('hmac');
  if (!hmacHeader) {
    return NextResponse.json({ error: 'Missing HMAC header' }, { status: 401 });
  }

  const providerConfig = await requirePaymentProviderConfig('coinpayments');
  const ipnSecret = providerConfig.config?.ipnSecret;

  if (!ipnSecret) {
    return NextResponse.json({ error: 'CoinPayments IPN secret not configured' }, { status: 500 });
  }

  const expectedHmac = crypto.createHmac('sha512', ipnSecret).update(rawBody).digest('hex');
  if (expectedHmac !== hmacHeader) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payment = await markPaymentStatus(paymentId, status >= 100 ? 'confirmed' : status < 0 ? 'rejected' : 'pending', {
    coinpayments: {
      txnId,
      status,
      status_text: formData.get('status_text'),
      amount: formData.get('amount'),
      currency: formData.get('currency'),
    },
  });

  if (status >= 100) {
    await finalizeOrder(payment.order_id, 'coinpayments', payment.id);
  }

  return NextResponse.json({ success: true });
}

async function handleNowPayments(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-nowpayments-sig');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const providerConfig = await requirePaymentProviderConfig('nowpayments');
  const ipnSecret = providerConfig.config?.ipnSecret;

  if (!ipnSecret) {
    return NextResponse.json({ error: 'NOWPayments IPN secret not configured' }, { status: 500 });
  }

  const expectedSig = crypto.createHmac('sha512', ipnSecret).update(rawBody).digest('hex');
  if (signature !== expectedSig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const paymentId = payload?.order_id;

  if (!paymentId) {
    return NextResponse.json({ error: 'Missing payment id' }, { status: 400 });
  }

  const status = (payload?.payment_status || '').toLowerCase();
  const isPaid = status === 'finished' || status === 'confirmed';
  const isFailed = status === 'expired' || status === 'failed';

  const payment = await markPaymentStatus(paymentId, isPaid ? 'confirmed' : isFailed ? 'rejected' : 'pending', {
    nowpayments: payload,
  });

  if (isPaid) {
    await finalizeOrder(payment.order_id, 'nowpayments', payment.id);
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {

  const { provider } = await params;

  try {
    switch (provider) {
      case 'coinpayments':
        return await handleCoinPayments(request);
      case 'nowpayments':
        return await handleNowPayments(request);
      default:
        return NextResponse.json({ error: 'Provider webhook not implemented' }, { status: 400 });
    }
  } catch (error) {
    console.error('Payment webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
