'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ComcraftCheckoutSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Finalizing your payment...');

  const provider = searchParams.get('provider') || '';
  const paymentId = searchParams.get('paymentId') || '';
  const orderId = searchParams.get('orderId') || '';

  const payload = useMemo(() => {
    const data: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (!['provider', 'paymentId', 'orderId'].includes(key)) {
        data[key] = value;
      }
    });
    return data;
  }, [searchParams]);

  useEffect(() => {
    async function confirmPayment() {
      if (!provider || !paymentId || !orderId) {
        setStatus('error');
        setMessage('Missing payment information.');
        return;
      }

      if (provider === 'coinpayments' || provider === 'nowpayments') {
        setStatus('pending');
        setMessage('Payment received. Waiting for blockchain confirmation. You will be notified once it completes.');
        return;
      }

      try {
        const response = await fetch('/api/comcraft/checkout/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, paymentId, orderId, payload }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to confirm payment');
        }

        setStatus('success');
        setMessage('Payment confirmed! Your Comcraft tier has been activated.');
      } catch (error: any) {
        console.error('Checkout confirmation error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to confirm payment. Please contact support.');
      }
    }

    confirmPayment();
  }, [provider, paymentId, orderId, payload]);

  const icon = {
    loading: <Loader2 className="h-12 w-12 animate-spin text-blue-500" />,
    success: <CheckCircle2 className="h-12 w-12 text-green-500" />,
    pending: <Loader2 className="h-12 w-12 animate-spin text-amber-500" />,
    error: <AlertTriangle className="h-12 w-12 text-red-500" />,
  }[status];

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">{icon}</div>
          <CardTitle className="text-2xl font-bold">{status === 'success' ? 'Payment Successful' : status === 'pending' ? 'Awaiting Confirmation' : status === 'error' ? 'Payment Error' : 'Processing Payment'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">{message}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={() => router.push('/comcraft/dashboard')} className="w-full sm:w-auto">
              Open Dashboard
            </Button>
            <Button variant="outline" onClick={() => router.push('/products/comcraft')} className="w-full sm:w-auto">
              Back to Product Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
