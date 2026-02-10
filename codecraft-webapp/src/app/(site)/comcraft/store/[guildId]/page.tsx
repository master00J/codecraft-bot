'use client';

/**
 * Public store page: browse and buy server shop items.
 * Categories, images, trust badges, testimonials, owned/subscribed status, coupons, stock.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ShoppingBag, LogIn, ShieldCheck, ImageIcon, Copy } from 'lucide-react';

interface StoreCategory {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

interface StoreItem {
  id: string;
  name: string;
  description: string | null;
  price_amount_cents: number;
  compare_at_price_cents?: number | null;
  currency: string;
  billing_type?: 'one_time' | 'subscription';
  subscription_interval?: string | null;
  subscription_interval_count?: number | null;
  image_url?: string | null;
  category_id?: string | null;
  stock_remaining?: number | null;
}

interface StoreSettings {
  storeName: string | null;
  storeDescription: string | null;
  storePrimaryColor: string;
  storeLogoUrl: string | null;
  storeFooterText: string | null;
  trustBadges?: { text: string }[] | null;
  testimonials?: { quote: string; author?: string }[] | null;
  termsUrl?: string | null;
  refundPolicyUrl?: string | null;
  termsContent?: string | null;
  refundPolicyContent?: string | null;
  currencyDisclaimer?: string | null;
}

interface MyStatus {
  ownedItemIds: string[];
  subscriptions: { itemId: string; currentPeriodEnd: string; stripeSubscriptionId: string | null }[];
}

interface MyCode {
  id: string;
  code: string;
  itemName: string | null;
  createdAt: string;
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
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [myStatus, setMyStatus] = useState<MyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [myCodes, setMyCodes] = useState<MyCode[]>([]);

  useEffect(() => {
    if (!guildId) return;
    fetch(`/api/comcraft/public/shop?guildId=${encodeURIComponent(guildId)}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
        setCategories(data.categories ?? []);
        setSettings(data.settings ?? null);
      })
      .catch(() => {
        setItems([]);
        setCategories([]);
        setSettings(null);
      })
      .finally(() => setLoading(false));
  }, [guildId]);

  useEffect(() => {
    if (!guildId || status !== 'authenticated') return;
    fetch(`/api/comcraft/guilds/${guildId}/shop/my-status`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setMyStatus(data))
      .catch(() => setMyStatus(null));
  }, [guildId, status]);

  useEffect(() => {
    if (!guildId || status !== 'authenticated') return;
    fetch(`/api/comcraft/guilds/${guildId}/shop/my-codes`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setMyCodes(data.codes ?? []))
      .catch(() => setMyCodes([]));
  }, [guildId, status]);

  useEffect(() => {
    if (settings?.storeName) {
      document.title = `${settings.storeName} | Store`;
    }
  }, [settings?.storeName]);

  const primaryColor = settings?.storePrimaryColor || '#5865F2';
  const filteredItems =
    selectedCategoryId == null
      ? items
      : items.filter((i) => i.category_id === selectedCategoryId);

  async function handleBuy(itemId: string) {
    if (status !== 'authenticated') {
      void signIn('discord', { callbackUrl: typeof window !== 'undefined' ? window.location.href : undefined });
      return;
    }
    setBuyingId(itemId);
    try {
      const res = await fetch(
        `/api/comcraft/guilds/${guildId}/shop/checkout?itemId=${encodeURIComponent(itemId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ couponCode: couponCode.trim() || undefined }),
        }
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
    } catch {
      toast({ title: 'Error', description: 'Something went wrong. Try again.', variant: 'destructive' });
    } finally {
      setBuyingId(null);
    }
  }

  async function handlePortal() {
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/shop/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ returnUrl: typeof window !== 'undefined' ? window.location.href : '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Could not open portal.', variant: 'destructive' });
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-5xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-20 w-20 mx-auto rounded-xl bg-muted" />
            <div className="h-8 w-32 mx-auto bg-muted rounded" />
            <div className="h-4 max-w-md mx-auto bg-muted rounded" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-10">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden rounded-xl">
                  <div className="aspect-video bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-5 w-3/4 bg-muted rounded" />
                    <div className="h-4 w-1/2 bg-muted rounded" />
                    <div className="h-10 w-full bg-muted rounded mt-4" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        <header className="text-center mb-10">
          {settings?.storeLogoUrl ? (
            <div className="relative w-20 h-20 mx-auto mb-4 rounded-xl overflow-hidden border-2 shadow-lg" style={{ borderColor: primaryColor }}>
              <Image src={settings.storeLogoUrl} alt="" fill className="object-cover" unoptimized sizes="80px" />
            </div>
          ) : (
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
              aria-hidden
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
          {settings?.currencyDisclaimer && (
            <p className="text-xs text-muted-foreground mt-1">{settings.currencyDisclaimer}</p>
          )}
        </header>

        {(settings?.trustBadges?.length ?? 0) > 0 && (
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            {(settings?.trustBadges ?? []).map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border bg-card"
                style={{ borderColor: `${primaryColor}40` }}
              >
                <ShieldCheck className="h-4 w-4" style={{ color: primaryColor }} aria-hidden />
                {b.text}
              </span>
            ))}
          </div>
        )}

        {(settings?.testimonials?.length ?? 0) > 0 && (
          <Card className="p-4 mb-8 rounded-xl border-2" style={{ borderColor: `${primaryColor}20` }}>
            <p className="text-sm font-medium mb-2" style={{ color: primaryColor }}>What others say</p>
            <div className="flex flex-wrap gap-4">
              {(settings?.testimonials ?? []).slice(0, 3).map((t, i) => (
                <blockquote key={i} className="text-sm text-muted-foreground max-w-xs">
                  &ldquo;{t.quote}&rdquo;
                  {t.author && <cite className="block mt-1 not-italic font-medium text-foreground">— {t.author}</cite>}
                </blockquote>
              ))}
            </div>
          </Card>
        )}

        {status !== 'authenticated' && (
          <Card className="p-4 mb-8 flex flex-wrap items-center justify-between gap-4 border-2" style={{ borderColor: `${primaryColor}40`, backgroundColor: `${primaryColor}08` }}>
            <div className="flex items-center gap-3">
              <LogIn className="h-5 w-5" style={{ color: primaryColor }} aria-hidden />
              <span className="text-sm font-medium">Sign in with Discord to purchase. Your role will be assigned automatically after payment.</span>
            </div>
            <Button
              onClick={() => signIn('discord', { callbackUrl: typeof window !== 'undefined' ? window.location.href : undefined })}
              style={{ backgroundColor: primaryColor }}
              className="hover:opacity-90 focus:ring-2 focus:ring-offset-2 min-h-[44px]"
              aria-label="Sign in with Discord to purchase"
            >
              Sign in with Discord
            </Button>
          </Card>
        )}

        {myStatus && myStatus.subscriptions.length > 0 && (
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={handlePortal}
              className="min-h-[44px]"
              style={{ borderColor: primaryColor }}
              aria-label="Manage your subscription"
            >
              Manage subscription
            </Button>
          </div>
        )}

        {myCodes.length > 0 && (
          <Card className="p-5 mb-8 rounded-xl border-2 shadow-sm">
            <h2 className="text-sm font-semibold mb-2">Your purchased codes</h2>
            <p className="text-xs text-muted-foreground mb-3">Codes you bought (e.g. Steam, gift cards). Copy and use them as instructed by the seller. If you closed the thank-you page, you can copy them here.</p>
            <div className="space-y-3">
              {myCodes.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                  {c.itemName && <span className="text-sm font-medium">{c.itemName}</span>}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <code className="flex-1 font-mono text-sm tracking-wider bg-background px-2 py-1.5 rounded border truncate">
                      {c.code}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        void navigator.clipboard.writeText(c.code).then(() => {
                          toast({ title: 'Copied', description: 'Code copied to clipboard.' });
                        });
                      }}
                      aria-label="Copy code"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Filter by category">
            <Button
              variant={selectedCategoryId === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategoryId(null)}
              style={selectedCategoryId === null ? { backgroundColor: primaryColor } : {}}
              aria-pressed={selectedCategoryId === null}
            >
              All
            </Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                variant={selectedCategoryId === c.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategoryId(c.id)}
                style={selectedCategoryId === c.id ? { backgroundColor: c.color ?? primaryColor } : { borderColor: c.color ?? primaryColor }}
                aria-pressed={selectedCategoryId === c.id}
              >
                {c.name}
              </Button>
            ))}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="coupon-store" className="text-sm text-muted-foreground mr-2">Coupon code (optional):</label>
          <input
            id="coupon-store"
            type="text"
            placeholder="DISCOUNT10"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="px-3 py-2 rounded-lg border bg-background text-sm max-w-[180px] focus:ring-2 focus:ring-offset-2"
            aria-label="Coupon code"
          />
        </div>

        {filteredItems.length === 0 ? (
          <Card className="p-12 text-center rounded-xl">
            <p className="text-muted-foreground">No items in this category. Try another filter or check back later.</p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {filteredItems.map((item) => {
              const isSub = item.billing_type === 'subscription';
              const owned = myStatus?.ownedItemIds?.includes(item.id);
              const sub = myStatus?.subscriptions?.find((s) => s.itemId === item.id);
              const priceLabel = isSub
                ? `${formatPrice(item.price_amount_cents, item.currency)}/${item.subscription_interval === 'year' ? 'year' : 'month'}`
                : formatPrice(item.price_amount_cents, item.currency);
              const soldOut = item.stock_remaining != null && item.stock_remaining <= 0;
              return (
                <Card
                  key={item.id}
                  className="overflow-hidden flex flex-col rounded-xl border-2 shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-offset-2"
                  role="listitem"
                >
                  <div className="relative aspect-video bg-muted flex items-center justify-center">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                      />
                    ) : (
                      <ImageIcon className="h-12 w-12 text-muted-foreground" aria-hidden />
                    )}
                    {soldOut && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <span className="font-semibold text-destructive">Sold out</span>
                      </div>
                    )}
                  </div>
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
                    {item.stock_remaining != null && item.stock_remaining > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">{item.stock_remaining} left</p>
                    )}
                    <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
                      <div>
                        {item.compare_at_price_cents != null && item.compare_at_price_cents > item.price_amount_cents && (
                          <span className="text-sm text-muted-foreground line-through mr-2">
                            {formatPrice(item.compare_at_price_cents, item.currency)}
                          </span>
                        )}
                        <span className="text-xl font-bold" style={{ color: primaryColor }}>{priceLabel}</span>
                        {isSub && (
                          <p className="text-xs text-muted-foreground mt-0.5">Recurring; cancel anytime. Role removed when subscription ends.</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {sub ? (
                          <Button
                            variant="outline"
                            onClick={handlePortal}
                            className="min-h-[44px]"
                            aria-label="Manage subscription"
                          >
                            Manage
                          </Button>
                        ) : owned && !isSub ? (
                          <span className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-muted">Owned</span>
                        ) : soldOut ? (
                          <Button disabled className="min-h-[44px]">Sold out</Button>
                        ) : (
                          <Button
                            onClick={() => handleBuy(item.id)}
                            disabled={buyingId !== null}
                            className="min-h-[44px] focus:ring-2 focus:ring-offset-2"
                            style={{ backgroundColor: primaryColor }}
                            aria-label={isSub ? 'Subscribe' : 'Buy'}
                          >
                            {buyingId === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : isSub ? (
                              'Subscribe'
                            ) : (
                              'Buy'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <footer className="mt-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          {settings?.storeFooterText && <p className="max-w-md">{settings.storeFooterText}</p>}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href={`/comcraft/store/${guildId}/terms`} className="underline focus:ring-2 focus:ring-offset-2 rounded">
              Terms of sale
            </Link>
            <Link href={`/comcraft/store/${guildId}/refund`} className="underline focus:ring-2 focus:ring-offset-2 rounded">
              Refund policy
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            <span>Payments go to the server owner. Powered by Codecraft.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
