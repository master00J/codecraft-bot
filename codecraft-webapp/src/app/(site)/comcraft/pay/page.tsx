'use client';

/**
 * Pay landing: redirects to Stripe checkout using public API.
 * URL: /comcraft/pay?guildId=...&amount=5&currency=eur
 */

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function PayPage() {
  const searchParams = useSearchParams();
  const guildId = searchParams.get('guildId');
  const amount = searchParams.get('amount');
  const currency = searchParams.get('currency') || 'eur';

  useEffect(() => {
    if (!guildId || !amount) return;
    const url = `/api/comcraft/public/checkout?guildId=${encodeURIComponent(guildId)}&amount=${encodeURIComponent(amount)}&currency=${encodeURIComponent(currency)}`;
    window.location.href = url;
  }, [guildId, amount, currency]);

  if (!guildId || !amount) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">Invalid link. Use a payment link from the server.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-muted-foreground">Redirecting to payment…</p>
    </div>
  );
}
