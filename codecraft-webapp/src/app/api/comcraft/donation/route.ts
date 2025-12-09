import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requirePaymentProviderConfig } from '@/lib/payments/providers';

/**
 * Create a Stripe checkout session for a donation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId as string | undefined;

    if (!discordId) {
      return NextResponse.json({ error: 'No Discord account linked' }, { status: 400 });
    }

    const body = await request.json();
    const { amount, currency = 'USD', provider = 'stripe' } = body as {
      amount?: number;
      currency?: string;
      provider?: string;
    };

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid donation amount' }, { status: 400 });
    }

    // Ensure user exists
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    let userId = userData?.id;

    if (!userId) {
      // Create user if doesn't exist
      const { data: newUser, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          discord_id: discordId,
          username: session.user.name || 'Unknown',
          email: session.user.email || null,
        })
        .select('id')
        .single();

      if (userError || !newUser) {
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }

      userId = newUser.id;
    }

    // Get payment provider config
    const providerConfig = await requirePaymentProviderConfig(provider);
    const secretKey = providerConfig.config?.secretKey;

    if (!secretKey) {
      return NextResponse.json({ error: 'Payment provider not configured' }, { status: 500 });
    }

    const accountId = providerConfig.config?.accountId?.trim();

    // Create a simple payment record (optional, for tracking)
    const { data: paymentData, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: userId,
        discord_id: discordId,
        amount,
        currency: currency.toUpperCase(),
        provider,
        status: 'pending',
        metadata: {
          type: 'donation',
        },
      })
      .select('id')
      .single();

    if (paymentError || !paymentData) {
      console.error('Error creating payment record:', paymentError);
      // Continue anyway, payment record is optional for donations
    }

    // Create Stripe checkout session
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const successUrl = `${baseUrl}/comcraft/donation/success?paymentId=${paymentData?.id || 'none'}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/comcraft/donation/cancel?paymentId=${paymentData?.id || 'none'}`;

    const params = new URLSearchParams();
    // Add all available Stripe payment method types
    // Stripe will automatically show available methods based on customer location and currency
    const paymentMethodTypes = [
      'card',              // Credit/debit cards
      'paypal',            // PayPal
      'link',              // Stripe Link (saved payment methods)
      'bancontact',        // Belgium
      'ideal',             // Netherlands
      'eps',               // Austria
      'giropay',           // Germany
      'p24',               // Przelewy24 (Poland) - correct format
      'blik',              // Poland
      'sofort',            // Germany, Austria, Belgium
      'sepa_debit',        // SEPA Direct Debit (EU)
      'klarna',            // Buy now, pay later (EU, US)
      'affirm',            // Buy now, pay later (US)
      'cashapp',           // Cash App Pay (US)
      'us_bank_account',   // ACH Direct Debit (US)
      'acss_debit',        // Pre-authorized debits (Canada)
      'alipay',            // Alipay (China)
      'wechat_pay',        // WeChat Pay (China)
      'grabpay',           // GrabPay (Southeast Asia)
      'fpx',               // FPX (Malaysia)
      'customer_balance',  // Customer balance (for stored credits)
      'bacs_debit',        // BACS Direct Debit (UK)
      'au_becs_debit',     // BECS Direct Debit (Australia)
      'revolut_pay',       // Revolut Pay
      'mobilepay',         // MobilePay
      'swish',             // Swish (Sweden)
      'twint',             // TWINT (Switzerland)
      'satispay',          // Satispay (Italy)
    ];
    paymentMethodTypes.forEach((type, index) => {
      params.append(`payment_method_types[${index}]`, type);
    });

    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('billing_address_collection', 'auto');
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', currency.toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', Math.round(amount * 100).toString());
    params.append('line_items[0][price_data][product_data][name]', 'ComCraft Bot Donation');
    params.append('line_items[0][price_data][product_data][description]', 'Thank you for supporting ComCraft!');

    // Add metadata
    params.append('metadata[payment_id]', paymentData?.id || 'none');
    params.append('metadata[discord_id]', discordId);
    params.append('metadata[type]', 'donation');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-12-18.acacia',
    };

    if (accountId) {
      headers['Stripe-Context'] = `account_id=${accountId}`;
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers,
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Stripe session error:', data);
      return NextResponse.json(
        { error: data.error?.message || 'Failed to create donation checkout' },
        { status: 500 }
      );
    }

    // Update payment record with session ID if it exists
    if (paymentData?.id) {
      await supabaseAdmin
        .from('payments')
        .update({
          transaction_id: data.id,
          metadata: {
            type: 'donation',
            stripe: {
              sessionId: data.id,
            },
          },
        })
        .eq('id', paymentData.id);
    }

    return NextResponse.json({
      success: true,
      url: data.url,
      sessionId: data.id,
    });
  } catch (error) {
    console.error('Error creating donation checkout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

