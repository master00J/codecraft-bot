'use client';

/**
 * Public store page: browse and buy server shop items (roles, subscriptions, etc.).
 * Sign in with Discord to purchase; payment via Stripe or PayPal.
 * Supports store branding (name, description, color, logo, footer).
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ShoppingBag, LogIn, ShieldCheck, BadgeCheck } from 'lucide-react';

interface StoreItem {
  id: string;
  name: string;
  description: string | null;
  price_amount_cents: number;
  currency: string;
  billing_type?: 'one_time' | 'subscription';
  subscription_interval?: string | null;
  subscription_interval_count?: number | null;
}

interface StoreSettings {
  storeName: string | null;
  storeDescription: string | null;
  storePrimaryColor: string;
  storeLogoUrl: string | null;
  storeFooterText: string | null;
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
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    fetch(`/api/comcraft/public/shop?guildId=${encodeURIComponent(guildId)}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setSettings(data.settings ?? null);
      })
      .catch(() => { setItems([]); setSettings(null); })
      .finally(() => setLoading(false));
  }, [guildId]);

  const primaryColor = settings?.storePrimaryColor || '#5865F2';

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
          {settings?.storeLogoUrl ? (
            <div className="relative w-20 h-20 mx-auto mb-4 rounded-xl overflow-hidden border-2 shadow-lg" style={{ borderColor: primaryColor }}>
              <Image src={settings.storeLogoUrl} alt="" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
            >
              <ShoppingBag className="h-8 w-8" />
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {settings?.storeName || 'Server Store'}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            {settings?.storeDescription || 'Support the server and get roles or perks. Pay with card or PayPal; your role is assigned automatically.'}
          </p>
        </header>

        {status !== 'authenticated' && (
          <Card className="p-4 mb-8 flex flex-wrap items-center justify-between gap-4 border-2" style={{ borderColor: `${primaryColor}40`, backgroundColor: `${primaryColor}08` }}>
            <div className="flex items-center gap-3">
              <LogIn className="h-5 w-5" style={{ color: primaryColor }} />
              <span className="text-sm font-medium">Sign in with Discord to purchase. Your role will be assigned automatically after payment.</span>
            </div>
            <Button
              onClick={() => signIn('discord', { callbackUrl: typeof window !== 'undefined' ? window.location.href : undefined })}
              style={{ backgroundColor: primaryColor }}
              className="hover:opacity-90"
            >
              Sign in with Discord
            </Button>
          </Card>
        )}

        <Card className="p-5 mb-8 rounded-xl border-2 shadow-sm">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4" style={{ color: primaryColor }} />
            Redeem a code
          </h2>
          <p className="text-xs text-muted-foreground mb-3">Have a gift card? Enter it below. You must be signed in and in the server.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="XXXX-XXXX-XXXX"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border bg-background text-sm font-mono"
            />
            <Button
              onClick={handleRedeem}
              disabled={redeeming || !redeemCode.trim()}
              style={{ backgroundColor: primaryColor }}
              className="hover:opacity-90"
            >
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redeem'}
            </Button>
          </div>
        </Card>

        {items.length === 0 ? (
          <Card className="p-12 text-center rounded-xl">
            <p className="text-muted-foreground">No items in the store right now. Check back later.</p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const isSub = item.billing_type === 'subscription';
              const priceLabel = isSub
                ? `${formatPrice(item.price_amount_cents, item.currency)}/${item.subscription_interval === 'year' ? 'year' : 'month'}`
                : formatPrice(item.price_amount_cents, item.currency);
              return (
                <Card key={item.id} className="overflow-hidden flex flex-col rounded-xl border-2 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold">{item.name}</h2>
                      {isSub && (
                        <span
                          className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                        >
                          Subscription
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3 flex-1">{item.description}</p>
                    )}
                    <div className="mt-4 flex items-end justify-between gap-4">
                      <div>
                        <span className="text-xl font-bold" style={{ color: primaryColor }}>{priceLabel}</span>
                        {isSub && (
                          <p className="text-xs text-muted-foreground mt-0.5">Recurring; cancel anytime. Role removed when subscription ends.</p>
                        )}
                      </div>
                      <Button
                        onClick={() => handleBuy(item.id)}
                        disabled={buyingId !== null}
                        className="shrink-0"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {buyingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isSub ? (
                          'Subscribe'
                        ) : (
                          'Buy'
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <footer className="mt-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          {settings?.storeFooterText && (
            <p className="max-w-md">{settings.storeFooterText}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Payments go to the server owner. Powered by Codecraft.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
