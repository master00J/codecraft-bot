'use client';

/**
 * Public store page: browse and buy server shop items (roles, etc.).
 * Sign in with Discord to purchase; payment via Stripe or PayPal.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ShoppingBag, LogIn, ShieldCheck } from 'lucide-react';

interface StoreItem {
  id: string;
  name: string;
  description: string | null;
  price_amount_cents: number;
  currency: string;
}

function formatPrice(cents: number, currency: string) {
  const sym = currency?.toUpperCase() === 'EUR' ? '€' : currency?.toUpperCase() === 'USD' ? '$' : currency || '€';
  return `${sym}${(cents / 100).toFixed(2)}`;
}

export default function StorePage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    fetch(`/api/comcraft/public/shop?guildId=${encodeURIComponent(guildId)}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [guildId]);

  async function handleBuy(itemId: string) {
    if (status !== 'authenticated') {
      void signIn('discord', { callbackUrl: typeof window !== 'undefined' ? window.location.href : undefined });
      return;
    }
    setBuyingId(itemId);
    try {
      const res = await fetch(
        `/api/comcraft/guilds/${guildId}/shop/checkout?itemId=${encodeURIComponent(itemId)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: 'Checkout failed',
          description: data.error || 'Could not start checkout. Make sure you are in the server.',
          variant: 'destructive',
        });
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      toast({ title: 'Error', description: 'No checkout URL received.', variant: 'destructive' });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Something went wrong. Try again.',
        variant: 'destructive',
      });
    } finally {
      setBuyingId(null);
    }
  }

  async function handleRedeem() {
    const code = redeemCode.trim();
    if (!code) return;
    if (status !== 'authenticated') {
      void signIn('discord', { callbackUrl: typeof window !== 'undefined' ? window.location.href : undefined });
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Redeem failed', description: data.error || 'Invalid or used code.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Code redeemed!', description: 'You received the role.' });
      setRedeemCode('');
    } catch {
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    } finally {
      setRedeeming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-gradient-to-b from-background to-muted/30">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading store…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mb-4">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Server Store</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Support the server and get roles or perks. Pay with card or PayPal; you’ll get your role right after payment.
          </p>
        </header>

        {status !== 'authenticated' && (
          <Card className="p-4 mb-8 flex flex-wrap items-center justify-between gap-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-3">
              <LogIn className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Sign in with Discord to purchase. Your role will be assigned automatically after payment.</span>
            </div>
            <Button onClick={() => signIn('discord', { callbackUrl: typeof window !== 'undefined' ? window.location.href : undefined })}>
              Sign in with Discord
            </Button>
          </Card>
        )}

        <Card className="p-4 mb-8">
          <h2 className="text-sm font-semibold mb-2">Redeem a code</h2>
          <p className="text-xs text-muted-foreground mb-3">Have a gift card? Enter it below. You must be signed in and in the server.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="XXXX-XXXX-XXXX"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-md border bg-background text-sm font-mono"
            />
            <Button onClick={handleRedeem} disabled={redeeming || !redeemCode.trim()}>
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redeem'}
            </Button>
          </div>
        </Card>

        {items.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No items in the store right now. Check back later.</p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden flex flex-col">
                <div className="p-6 flex-1 flex flex-col">
                  <h2 className="text-lg font-semibold">{item.name}</h2>
                  {item.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3 flex-1">{item.description}</p>
                  )}
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <span className="text-xl font-bold text-primary">{formatPrice(item.price_amount_cents, item.currency)}</span>
                    <Button
                      onClick={() => handleBuy(item.id)}
                      disabled={buyingId !== null}
                      className="shrink-0"
                    >
                      {buyingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Buy'
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <footer className="mt-12 text-center text-sm text-muted-foreground flex flex-wrap items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span>Payments go to the server owner. Powered by Codecraft.</span>
        </footer>
      </div>
    </div>
  );
}
