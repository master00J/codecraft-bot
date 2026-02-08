/**
 * PayPal API helpers: OAuth token and create order (for guild donations and shop).
 * Uses REST v2; no SDK dependency.
 */

const PAYPAL_SANDBOX = 'https://api-m.sandbox.paypal.com';
const PAYPAL_LIVE = 'https://api-m.paypal.com';

function baseUrl(sandbox: boolean) {
  return sandbox ? PAYPAL_SANDBOX : PAYPAL_LIVE;
}

export async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  sandbox: boolean
): Promise<string> {
  const url = `${baseUrl(sandbox)}/v1/oauth2/token`;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'PayPal auth failed');
  }
  return data.access_token;
}

export interface CreateOrderParams {
  accessToken: string;
  sandbox: boolean;
  amountValue: string;
  currencyCode: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  customId?: string;
}

export async function createPayPalOrder(params: CreateOrderParams): Promise<{ orderId: string; approveUrl: string }> {
  const {
    accessToken,
    sandbox,
    amountValue,
    currencyCode,
    description,
    returnUrl,
    cancelUrl,
    customId,
  } = params;

  const url = `${baseUrl(sandbox)}/v2/checkout/orders`;
  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: { currency_code: currencyCode, value: amountValue },
        description: description.slice(0, 127),
        ...(customId ? { custom_id: customId } : {}),
      },
    ],
    application_context: {
      return_url: returnUrl,
      cancel_url: cancelUrl,
      brand_name: 'Server support',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.details?.[0]?.description || 'PayPal create order failed');
  }

  const approveLink = data.links?.find((l: { rel: string }) => l.rel === 'approve');
  if (!approveLink?.href) {
    throw new Error('No approval URL in PayPal response');
  }

  return { orderId: data.id, approveUrl: approveLink.href };
}
