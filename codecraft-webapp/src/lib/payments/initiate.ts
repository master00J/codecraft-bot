import crypto from 'crypto';
import { PaymentProviderConfig } from './providers';
import { supabaseAdmin } from '@/lib/supabase/server';

interface InitiateOptions {
  order: any;
  payment: any;
  amount: number;
  currency: string;
  guildId: string | null;
  tier: string;
  billingPeriod?: 'monthly' | 'yearly';
  user: {
    discordId: string;
    email?: string | null;
    username?: string | null;
  };
  baseUrl: string;
}

export type InitiateResult =
  | { type: 'redirect'; url: string; providerData?: Record<string, any> }
  | { type: 'manual'; title: string; description: string; instructions: Array<{ label: string; value: string }> };

async function getPayPalToken(clientId: string, clientSecret: string, baseApiUrl: string) {
  const response = await fetch(`${baseApiUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with PayPal');
  }

  return response.json() as Promise<{ access_token: string }>;
}

async function initiatePayPal(config: PaymentProviderConfig, options: InitiateOptions): Promise<InitiateResult> {
  const clientId = config.config?.clientId;
  const clientSecret = config.config?.clientSecret;
  const environment = config.config?.environment === 'live' ? 'live' : 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured');
  }

  const apiBase = environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

  const { access_token } = await getPayPalToken(clientId, clientSecret, apiBase);

  const successUrl = `${options.baseUrl}/comcraft/checkout/success?provider=paypal&paymentId=${options.payment.id}&orderId=${options.order.id}`;
  const cancelUrl = `${options.baseUrl}/comcraft/checkout/cancel?provider=paypal&paymentId=${options.payment.id}&orderId=${options.order.id}`;

  const orderResponse = await fetch(`${apiBase}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: options.order.id,
          description: `Comcraft ${options.tier} subscription`,
          amount: {
            currency_code: options.currency.toUpperCase(),
            value: options.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'Comcraft',
        user_action: 'PAY_NOW',
        return_url: successUrl,
        cancel_url: cancelUrl,
      },
    }),
  });

  const orderData = await orderResponse.json();

  if (!orderResponse.ok) {
    console.error('PayPal order creation failed:', orderData);
    throw new Error(orderData?.message || 'Failed to create PayPal order');
  }

  const approvalLink = orderData.links?.find((link: any) => link.rel === 'approve');

  if (!approvalLink) {
    throw new Error('PayPal approval URL not found');
  }

  await supabaseAdmin
    .from('payments')
    .update({
      transaction_id: orderData.id,
      metadata: {
        ...(options.payment.metadata || {}),
        paypal: {
          environment,
          orderId: orderData.id,
        },
      },
    })
    .eq('id', options.payment.id);

  return {
    type: 'redirect',
    url: approvalLink.href,
  };
}

async function initiateStripe(config: PaymentProviderConfig, options: InitiateOptions): Promise<InitiateResult> {
  const secretKey = config.config?.secretKey;
  if (!secretKey) {
    throw new Error('Stripe secret key is not configured');
  }

  const accountId = config.config?.accountId?.trim();

  // Validate account ID format if provided
  if (accountId && !accountId.startsWith('acct_')) {
    throw new Error('Stripe Account ID must start with "acct_". Please check your configuration.');
  }

  const successUrl = `${options.baseUrl}/comcraft/checkout/success?provider=stripe&paymentId=${options.payment.id}&orderId=${options.order.id}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${options.baseUrl}/comcraft/checkout/cancel?provider=stripe&paymentId=${options.payment.id}&orderId=${options.order.id}`;

  const params = new URLSearchParams();
  
  // Add multiple payment method types
  // Stripe will automatically show available payment methods based on the customer's location and currency
  const paymentMethodTypes = ['card', 'paypal', 'bancontact', 'ideal', 'eps', 'blik'];
  paymentMethodTypes.forEach((type, index) => {
    params.append(`payment_method_types[${index}]`, type);
  });
  
  params.append('mode', 'payment');
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('billing_address_collection', 'auto');
  params.append('line_items[0][quantity]', '1');
  params.append('line_items[0][price_data][currency]', options.currency.toLowerCase());
  params.append('line_items[0][price_data][unit_amount]', Math.round(options.amount * 100).toString());
  
  const billingPeriodText = options.billingPeriod === 'yearly' ? 'Yearly' : 'Monthly';
  params.append('line_items[0][price_data][product_data][name]', `Comcraft ${options.tier} Subscription (${billingPeriodText})`);
  
  // Add billing period to metadata
  if (options.billingPeriod) {
    params.append('metadata[billing_period]', options.billingPeriod);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': '2024-12-18.acacia', // Stripe API version
  };

  // Add Stripe-Context header if using Organization API key
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
    
    // Provide more helpful error messages
    if (data.error?.type === 'invalid_request_error' && data.error?.message?.includes('account could not be found')) {
      throw new Error(
        'Stripe Account ID not found. Please verify:\n' +
        '1. The Account ID is correct (starts with "acct_")\n' +
        '2. The Account exists in your Organization\n' +
        '3. Your API key has access to this account\n' +
        '4. If using a regular (non-Organization) API key, leave the Account ID field empty'
      );
    }
    
    throw new Error(data.error?.message || 'Failed to create Stripe session');
  }

  await supabaseAdmin
    .from('payments')
    .update({
      transaction_id: data.id,
      metadata: {
        ...(options.payment.metadata || {}),
        stripe: {
          sessionId: data.id,
        },
      },
    })
    .eq('id', options.payment.id);

  return {
    type: 'redirect',
    url: data.url,
  };
}

async function initiateCoinPayments(config: PaymentProviderConfig, options: InitiateOptions): Promise<InitiateResult> {
  const merchantId = config.config?.merchantId;
  const publicKey = config.config?.publicKey;
  const privateKey = config.config?.privateKey;
  const ipnSecret = config.config?.ipnSecret;
  const payCurrency = (config.config?.currency || 'BTC').toLowerCase();

  if (!merchantId || !publicKey || !privateKey || !ipnSecret) {
    throw new Error('CoinPayments credentials are not configured');
  }

  const params: Record<string, string> = {
    cmd: 'create_transaction',
    merchant: merchantId,
    key: publicKey,
    version: '1',
    format: 'json',
    amount: options.amount.toFixed(2),
    currency1: options.currency.toUpperCase(),
    currency2: payCurrency,
    item_name: `Comcraft ${options.tier} Subscription`,
    item_number: options.payment.id,
    invoice: options.order.order_number,
    buyer_email: options.user.email || '',
    ipn_url: `${options.baseUrl}/api/webhooks/payments/coinpayments`,
    success_url: `${options.baseUrl}/comcraft/checkout/success?provider=coinpayments&paymentId=${options.payment.id}&orderId=${options.order.id}`,
    cancel_url: `${options.baseUrl}/comcraft/checkout/cancel?provider=coinpayments&paymentId=${options.payment.id}&orderId=${options.order.id}`,
  };

  const formBody = new URLSearchParams(params).toString();
  const hmac = crypto.createHmac('sha512', privateKey).update(formBody).digest('hex');

  const response = await fetch('https://www.coinpayments.net/api.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      HMAC: hmac,
    },
    body: formBody,
  });

  const data = await response.json();

  if (data.error !== 'ok') {
    console.error('CoinPayments API error:', data);
    throw new Error(data.error || 'Failed to create CoinPayments transaction');
  }

  await supabaseAdmin
    .from('payments')
    .update({
      transaction_id: data.result.txn_id,
      metadata: {
        ...(options.payment.metadata || {}),
        coinpayments: {
          txnId: data.result.txn_id,
          statusUrl: data.result.status_url,
          address: data.result.address,
          amount: data.result.amount,
          currency: payCurrency,
        },
      },
    })
    .eq('id', options.payment.id);

  return {
    type: 'redirect',
    url: data.result.status_url,
  };
}

async function initiateNowPayments(config: PaymentProviderConfig, options: InitiateOptions): Promise<InitiateResult> {
  const apiKey = config.config?.apiKey;

  if (!apiKey) {
    throw new Error('NOWPayments API key is not configured');
  }

  const payCurrency = (config.config?.payCurrency || 'btc').toLowerCase();

  const response = await fetch('https://api.nowpayments.io/v1/invoice', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: options.amount,
      price_currency: options.currency.toLowerCase(),
      pay_currency: payCurrency,
      order_id: options.payment.id,
      order_description: `Comcraft ${options.tier} Subscription`,
      ipn_callback_url: `${options.baseUrl}/api/webhooks/payments/nowpayments`,
      success_url: `${options.baseUrl}/comcraft/checkout/success?provider=nowpayments&paymentId=${options.payment.id}&orderId=${options.order.id}`,
      cancel_url: `${options.baseUrl}/comcraft/checkout/cancel?provider=nowpayments&paymentId=${options.payment.id}&orderId=${options.order.id}`,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('NOWPayments API error:', data);
    throw new Error(data.message || 'Failed to create NOWPayments invoice');
  }

  await supabaseAdmin
    .from('payments')
    .update({
      transaction_id: data.id?.toString(),
      metadata: {
        ...(options.payment.metadata || {}),
        nowpayments: {
          invoiceId: data.id,
          payAddress: data.pay_address,
          payAmount: data.pay_amount,
          payCurrency,
        },
      },
    })
    .eq('id', options.payment.id);

  return {
    type: 'redirect',
    url: data.invoice_url,
  };
}

async function initiateDirectWallet(config: PaymentProviderConfig): Promise<InitiateResult> {
  const instructions = [] as Array<{ label: string; value: string }>;
  const wallets = config.config || {};

  for (const key of ['btc', 'eth', 'usdt_trc20', 'usdt_erc20', 'ltc', 'bnb']) {
    if (wallets[key]) {
      instructions.push({
        label: key.toUpperCase().replace(/_/g, ' '),
        value: wallets[key],
      });
    }
  }

  if (wallets.instructions) {
    instructions.push({ label: 'Instructions', value: wallets.instructions });
  }

  return {
    type: 'manual',
    title: 'Direct Wallet Payment',
    description: 'Send the payment to one of the wallet addresses below and submit the transaction ID for verification.',
    instructions,
  };
}

export async function initiatePayment(providerConfig: PaymentProviderConfig, options: InitiateOptions): Promise<InitiateResult> {
  switch (providerConfig.provider) {
    case 'paypal':
      return initiatePayPal(providerConfig, options);
    case 'stripe':
      return initiateStripe(providerConfig, options);
    case 'coinpayments':
      return initiateCoinPayments(providerConfig, options);
    case 'nowpayments':
      return initiateNowPayments(providerConfig, options);
    case 'direct_wallet':
      return initiateDirectWallet(providerConfig);
    default:
      throw new Error(`Unsupported payment provider: ${providerConfig.provider}`);
  }
}
