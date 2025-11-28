'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import { Loader2, Shield, CreditCard, Bot, Plug, Wallet, Info, Check, Key } from 'lucide-react';
import { COMCRAFT_TIERS, ComcraftTierId } from '@/lib/comcraft/tiers';

interface PaymentProviderInfo {
  provider: string;
  display_name: string;
  is_active: boolean;
  auto_verification: boolean;
  config: Record<string, any> | null;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  address: string;
  instructions?: string;
  is_active: boolean;
  display_order: number;
}

interface GuildSummary {
  guild_id: string;
  guild_name: string;
  subscription_tier: string | null;
  subscription_active: boolean | null;
  active_license?: {
    id: string;
    tier: string;
    status: string;
    expires_at: string | null;
  } | null;
}

interface LicenseSummary {
  id: string;
  tier: string;
  status: string;
  max_guilds: number;
  slots_used: number;
  slots_total: number;
  assignments: Array<{ guild_id: string; guild_name: string | null; assigned_at: string }>;
}

interface SubscriptionTier {
  id: string;
  tier_name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  sort_order: number;
  is_active: boolean;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    CAD: 'C$',
    AUD: 'A$',
  };
  return symbols[currency.toUpperCase()] || currency;
}

export default function ComcraftCheckoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierParam = (searchParams.get('tier') || 'premium') as ComcraftTierId;
  const { toast } = useToast();

  const loginRequested = useRef(false);
  const [autoLoginInProgress, setAutoLoginInProgress] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [tierId, setTierId] = useState<ComcraftTierId>('premium');
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(false);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [manualMethods, setManualMethods] = useState<PaymentMethod[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [providers, setProviders] = useState<PaymentProviderInfo[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [notes, setNotes] = useState('');
  const [assignLater, setAssignLater] = useState(true);
  const [licenses, setLicenses] = useState<LicenseSummary[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [selectedLicenseByGuild, setSelectedLicenseByGuild] = useState<Record<string, string>>({});
  const [dbTier, setDbTier] = useState<SubscriptionTier | null>(null);
  const [tierLoading, setTierLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const loadTier = useCallback(async (tierName: string) => {
    try {
      setTierLoading(true);
      const response = await fetch('/api/comcraft/subscription-tiers');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load tiers');
      }
      const tier = (data.tiers || []).find((t: SubscriptionTier) => t.tier_name === tierName && t.is_active);
      if (tier) {
        setDbTier(tier);
      } else {
        // Fallback to hardcoded tier if not found in database
        console.warn(`Tier ${tierName} not found in database, using fallback`);
        setDbTier(null);
      }
    } catch (error: any) {
      console.error('Tier load error', error);
      // Don't show toast for tier loading errors, just use fallback
      setDbTier(null);
    } finally {
      setTierLoading(false);
    }
  }, []);

  const loadGuilds = useCallback(async () => {
    try {
      setGuildsLoading(true);
      const response = await fetch('/api/comcraft/guilds');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load guilds');
      }
      setGuilds(data.guilds || []);
      if (data.guilds?.length) {
        setSelectedGuildId((current) => {
          if (current) {
            return current;
          }
          return assignLater ? '' : data.guilds[0].guild_id;
        });
      }
    } catch (error: any) {
      console.error('Guild load error', error);
      toast({ title: 'Failed to load guilds', description: error.message, variant: 'destructive' });
    } finally {
      setGuildsLoading(false);
    }
  }, [toast, assignLater]);

  const loadProviders = useCallback(async () => {
    try {
      setProvidersLoading(true);
      const response = await fetch('/api/payment-providers');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load providers');
      }
      setProviders((data.providers || []).filter((p: PaymentProviderInfo) => p.is_active));
    } catch (error: any) {
      console.error('Provider load error', error);
      toast({ title: 'Failed to load payment providers', description: error.message, variant: 'destructive' });
    } finally {
      setProvidersLoading(false);
    }
  }, [toast]);

  const loadManualMethods = useCallback(async () => {
    try {
      setManualLoading(true);
      const response = await fetch('/api/payment-methods');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load manual payment methods');
      }
      setManualMethods(data.methods || []);
    } catch (error: any) {
      console.error('Manual method load error', error);
      toast({ title: 'Failed to load manual payment methods', description: error.message, variant: 'destructive' });
    } finally {
      setManualLoading(false);
    }
  }, [toast]);

  const loadLicenses = useCallback(async () => {
    try {
      setLicensesLoading(true);
      const response = await fetch('/api/comcraft/licenses');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load licenses');
      }
      const licenseList: LicenseSummary[] = data.licenses || [];
      setLicenses(licenseList);
      setSelectedLicenseByGuild((current) => {
        const updated = { ...current };
        licenseList.forEach((license) => {
          license.assignments?.forEach((assignment) => {
            updated[assignment.guild_id] = license.id;
          });
        });
        return updated;
      });
    } catch (error: any) {
      console.error('License load error', error);
      toast({ title: 'Failed to load licenses', description: error.message, variant: 'destructive' });
    } finally {
      setLicensesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (status === 'authenticated') {
      loginRequested.current = false;
      setAutoLoginInProgress(false);
      setAutoLoginAttempted(false);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('comcraftCheckoutAutoLogin');
      }
    }
  }, [status]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const attempted = sessionStorage.getItem('comcraftCheckoutAutoLogin') === 'done';
    setAutoLoginAttempted(attempted);
  }, []);

  useEffect(() => {
    if (status !== 'unauthenticated') {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const attempted = sessionStorage.getItem('comcraftCheckoutAutoLogin') === 'done';

    if (!attempted && !loginRequested.current) {
      loginRequested.current = true;
      setAutoLoginInProgress(true);
      sessionStorage.setItem('comcraftCheckoutAutoLogin', 'done');
      setAutoLoginAttempted(true);
      void signIn('discord', { callbackUrl: window.location.href });
    } else if (attempted) {
      setAutoLoginInProgress(false);
    }
  }, [status]);

  useEffect(() => {
    setTierId(COMCRAFT_TIERS[tierParam] ? tierParam : 'premium');
  }, [tierParam]);

  useEffect(() => {
    if (tierId) {
      void loadTier(tierId);
    }
  }, [tierId, loadTier]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    void loadGuilds();
    void loadProviders();
    void loadManualMethods();
    void loadLicenses();
    setLoading(false);
  }, [status, loadGuilds, loadProviders, loadManualMethods, loadLicenses]);

  // Use database tier if available, otherwise fallback to hardcoded tier
  const tier = useMemo(() => {
    if (dbTier) {
      // Convert database tier to the format expected by the UI
      const featuresList: string[] = [];
      if (dbTier.features) {
        // Get feature definitions from admin page to format feature names
        const featureLabels: Record<string, string> = {
          leveling: 'Advanced leveling system',
          welcome: 'Welcome flows',
          analytics: 'Analytics dashboard',
          moderation_basic: 'Basic moderation toolkit',
          moderation_advanced: 'Advanced moderation (auto-mod, filters)',
          custom_branding: 'Custom bot branding (name + avatar)',
          support_tickets: 'Support tickets',
          birthday_manager: 'Birthday manager',
          feedback_queue: 'Feedback queue',
          auto_roles: 'Auto roles & welcome messages',
          giveaways: 'Giveaways',
          ai_assistant: 'AI assistant',
          embed_builder: 'Embed builder',
          economy: 'Economy system',
          casino: 'Casino games',
          stream_notifications: 'Stream notifications',
          custom_commands: 'Unlimited custom commands',
        };
        
        Object.entries(dbTier.features).forEach(([key, enabled]) => {
          if (enabled) {
            featuresList.push(featureLabels[key] || key);
          }
        });
      }
      
      // Get max_guilds from database limits, or use a sensible default
      // Don't fall back to hardcoded tiers if database tier exists
      let maxGuilds = 1;
      if (dbTier.limits && typeof dbTier.limits.max_guilds === 'number') {
        maxGuilds = dbTier.limits.max_guilds;
      } else if (dbTier.limits && typeof dbTier.limits.max_guilds === 'string') {
        maxGuilds = parseInt(dbTier.limits.max_guilds, 10) || 1;
      }
      
      return {
        id: dbTier.tier_name as ComcraftTierId,
        name: dbTier.display_name,
        description: dbTier.description || '',
        priceMonthly: dbTier.price_monthly || 0,
        priceYearly: dbTier.price_yearly || 0,
        maxGuilds,
        features: featuresList.length > 0 ? featuresList : COMCRAFT_TIERS[tierId]?.features || [],
        bestFor: COMCRAFT_TIERS[tierId]?.bestFor || '',
      };
    }
    // Fallback to hardcoded tier
    return COMCRAFT_TIERS[tierId];
  }, [dbTier, tierId]);

  const currentPrice = useMemo(() => {
    if (billingPeriod === 'yearly') {
      return tier.priceYearly;
    }
    return tier.priceMonthly;
  }, [billingPeriod, tier]);

  const automatedProviders = useMemo(
    () => providers.filter((provider) => ['stripe', 'paypal', 'coinpayments', 'nowpayments'].includes(provider.provider)),
    [providers]
  );

  const hasAutomatedProviders = automatedProviders.length > 0;
  const hasManualMethods = manualMethods.length > 0;

  const availableLicenses = useMemo(() => {
    return licenses.filter((license) => license.status === 'active');
  }, [licenses]);

  const selectedGuildLabel = useMemo(() => {
    if (assignLater || !selectedGuildId) {
      return 'Assign later';
    }

    return guilds.find((guild) => guild.guild_id === selectedGuildId)?.guild_name || 'No guild selected';
  }, [assignLater, selectedGuildId, guilds]);

  const getAvailableLicenseOptions = (guildId: string) => {
    return availableLicenses.filter((license) => {
      const alreadyAssigned = license.assignments?.some((assignment) => assignment.guild_id === guildId);
      if (alreadyAssigned) {
        return true;
      }
      return license.slots_used < license.slots_total;
    });
  };

  const assignLicense = async (licenseId: string, guildId: string) => {
    try {
      const response = await fetch('/api/comcraft/licenses/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseId, guildId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign license');
      }
      toast({ title: 'License assigned', description: 'The guild now uses this license.' });
      await loadLicenses();
      await loadGuilds();
    } catch (error: any) {
      console.error('Assign license error', error);
      toast({ title: 'Failed to assign license', description: error.message, variant: 'destructive' });
    }
  };

  const releaseLicense = async (guildId: string) => {
    try {
      const response = await fetch('/api/comcraft/licenses/assign', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to release license');
      }
      toast({ title: 'License released', description: 'This guild is no longer assigned to a license.' });
      await loadLicenses();
      await loadGuilds();
    } catch (error: any) {
      console.error('Release license error', error);
      toast({ title: 'Failed to release license', description: error.message, variant: 'destructive' });
    }
  };

  const handleManualSignIn = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('comcraftCheckoutAutoLogin', 'done');
      setAutoLoginAttempted(true);
    }
    void signIn('discord', { callbackUrl: typeof window !== 'undefined' ? window.location.href : undefined });
  };

  const startCheckout = async () => {
    console.log('[Checkout] startCheckout called', {
      selectedProvider,
      tier: tier?.id,
      selectedGuildId,
      assignLater,
    });

    const targetGuildId = assignLater || !selectedGuildId ? null : selectedGuildId;

    if (!selectedProvider) {
      console.log('[Checkout] No provider selected');
      toast({
        title: 'Choose a payment method',
        description: 'Select an automated provider or manual instructions before continuing.',
        variant: 'destructive',
      });
      return;
    }

    if (!tier?.id) {
      console.error('[Checkout] No tier selected');
      toast({
        title: 'No tier selected',
        description: 'Please select a subscription tier.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('[Checkout] Starting checkout request...');
      setStartingCheckout(true);
      
      const payload = {
        guildId: targetGuildId,
        tier: tier.id,
        provider: selectedProvider,
        notes,
        billingPeriod,
      };
      
      console.log('[Checkout] Request payload:', payload);
      
      const response = await fetch('/api/comcraft/checkout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('[Checkout] Response status:', response.status);

      const data = await response.json();
      console.log('[Checkout] Response data:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start checkout');
      }

      if (data.action?.type === 'redirect') {
        console.log('[Checkout] Redirecting to:', data.action.url);
        window.location.href = data.action.url;
      } else if (data.action?.type === 'manual') {
        console.log('[Checkout] Manual payment flow');
        router.push(`/comcraft/checkout/success?provider=${selectedProvider}&manual=true&paymentId=${data.payment?.id}`);
      } else {
        console.error('[Checkout] Unknown action type:', data.action);
        toast({
          title: 'Unexpected response',
          description: 'Received an unexpected response from the server.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('[Checkout] Error:', error);
      toast({
        title: 'Failed to start checkout',
        description: error.message || 'Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setStartingCheckout(false);
    }
  };

  if (status === 'loading' || autoLoginInProgress) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Checking login</CardTitle>
              <CardDescription>Please wait while we verify your Discord session.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Login required</CardTitle>
              <CardDescription>Sign in with Discord to purchase a Comcraft subscription.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button onClick={handleManualSignIn} className="w-full">
                  Sign in with Discord
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-14 bg-muted/20">
        <div className="max-w-5xl mx-auto px-6 space-y-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-purple-600" />
              <div>
                <h1 className="text-3xl font-bold">Upgrade Comcraft</h1>
                <p className="text-muted-foreground">
                  Choose your guild, tier, and payment method. Your subscription activates automatically once the
                  payment is confirmed.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary" className="gap-1">
                <CreditCard className="h-3 w-3" /> Automated payments
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" /> Secure verification
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Wallet className="h-3 w-3" /> Manual methods supported
              </Badge>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{tier.name} tier</CardTitle>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Label htmlFor="billing-period" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Billing Period
                  </Label>
                  <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                    <Button
                      type="button"
                      variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setBillingPeriod('monthly')}
                      className="flex-1"
                    >
                      Monthly
                    </Button>
                    <Button
                      type="button"
                      variant={billingPeriod === 'yearly' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setBillingPeriod('yearly')}
                      className="flex-1"
                      disabled={tier.priceYearly === 0}
                    >
                      Yearly
                    </Button>
                  </div>
                </div>
                <div className="text-4xl font-bold flex items-baseline gap-2">
                  <span>
                    {currentPrice === 0
                      ? 'Free'
                      : `${getCurrencySymbol(dbTier?.currency || 'EUR')}${currentPrice.toFixed(2)}`}
                  </span>
                  {currentPrice > 0 && (
                    <span className="text-base text-muted-foreground">
                      per {billingPeriod === 'yearly' ? 'year' : 'month'}
                    </span>
                  )}
                </div>
                {billingPeriod === 'yearly' && tier.priceYearly > 0 && tier.priceMonthly > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Save {getCurrencySymbol(dbTier?.currency || 'EUR')}
                    {((tier.priceMonthly * 12) - tier.priceYearly).toFixed(2)} per year
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Includes up to <span className="font-semibold text-foreground">{tier.maxGuilds}</span> guilds per license.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Includes</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-2 items-start">
                      <Check className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your licenses</CardTitle>
              <CardDescription>Track available slots and assigned guilds per license.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {licensesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : licenses.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  You do not own any paid licenses yet. Purchase a tier to unlock additional guild slots.
                </div>
              ) : (
                licenses.map((license) => (
                  <div key={license.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-purple-600" />
                        <div>
                          <div className="font-semibold capitalize">{license.tier} license</div>
                          <div className="text-xs text-muted-foreground">
                            Status: {license.status}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{license.slots_used}/{license.slots_total} guilds</Badge>
                    </div>
                    {license.assignments && license.assignments.length > 0 ? (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="font-medium text-foreground text-sm">Assigned guilds</div>
                        {license.assignments.map((assignment) => (
                          <div key={assignment.guild_id} className="flex justify-between">
                            <span>{assignment.guild_name || assignment.guild_id}</span>
                            <span>{new Date(assignment.assigned_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No guilds assigned yet.</div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Select guild</CardTitle>
                <CardDescription>Choose which Discord server receives this upgrade.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {guildsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : guilds.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No guilds found. Invite the Comcraft bot to your server first.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {guilds.map((guild) => {
                      const licenseOptions = getAvailableLicenseOptions(guild.guild_id);
                      const selectedLicense = selectedLicenseByGuild[guild.guild_id] || '';
                      const activeLicense = guild.active_license;
                      return (
                        <div
                          key={guild.guild_id}
                          className={`border rounded-lg p-4 space-y-3 transition-all cursor-pointer ${
                            !assignLater && selectedGuildId === guild.guild_id ? 'border-primary bg-primary/5' : 'border-muted'
                          }`}
                          onClick={() => {
                            setAssignLater(false);
                            setSelectedGuildId(guild.guild_id);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{guild.guild_name || 'Unnamed server'}</div>
                              <div className="text-xs text-muted-foreground">
                                Current tier: {guild.subscription_active ? guild.subscription_tier ?? 'free' : 'inactive'}
                              </div>
                            </div>
                            <input
                              type="radio"
                              name="guild"
                              value={guild.guild_id}
                              checked={!assignLater && selectedGuildId === guild.guild_id}
                              onChange={() => {
                                setAssignLater(false);
                                setSelectedGuildId(guild.guild_id);
                              }}
                              className="h-4 w-4"
                              onClick={(event) => event.stopPropagation()}
                            />
                          </div>
                          <div className="border-t pt-3 space-y-2 text-xs text-muted-foreground">
                            {activeLicense ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between text-sm text-foreground">
                                  <span>Active license</span>
                                  <Badge variant="outline" className="capitalize">
                                    {activeLicense.tier}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    {activeLicense.expires_at ? `Expires ${new Date(activeLicense.expires_at).toLocaleDateString()}` : 'No expiry set'}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void releaseLicense(guild.guild_id);
                                    }}
                                  >
                                    Remove license
                                  </Button>
                                </div>
                              </div>
                            ) : licenseOptions.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                <div className="text-sm text-foreground font-medium">Assign a license</div>
                                <div className="flex gap-2 items-center">
                                  <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={selectedLicense}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      setSelectedLicenseByGuild((current) => ({ ...current, [guild.guild_id]: value }));
                                    }}
                                  >
                                    <option value="">Select a license</option>
                                    {licenseOptions.map((license) => (
                                      <option key={license.id} value={license.id}>
                                        {license.tier} ({license.slots_used}/{license.slots_total})
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={!selectedLicense}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (selectedLicense) {
                                        void assignLicense(selectedLicense, guild.guild_id);
                                      }
                                    }}
                                  >
                                    Assign
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm">
                                No available licenses. Purchase an additional license or release one from another guild.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <label
                      className={`border rounded-lg p-4 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        assignLater ? 'border-primary bg-primary/5' : 'border-muted'
                      }`}
                      onClick={() => {
                        setAssignLater(true);
                        setSelectedGuildId('');
                      }}
                    >
                      <div>
                        <div className="font-semibold">Assign later</div>
                        <div className="text-xs text-muted-foreground">
                          Purchase a license now and attach it to any guild afterwards.
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="guild"
                        value=""
                        checked={assignLater}
                        onChange={() => {
                          setAssignLater(true);
                          setSelectedGuildId('');
                        }}
                        className="h-4 w-4 mt-1"
                        onClick={(event) => event.stopPropagation()}
                      />
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment options</CardTitle>
                <CardDescription>Choose an automated provider or manual instructions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Payment Methods Accepted */}
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Accepted Payment Methods
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* PayPal */}
                    <div className="h-8 px-3 bg-white rounded flex items-center justify-center border">
                      <svg className="h-5" viewBox="0 0 124 33" xmlns="http://www.w3.org/2000/svg">
                        <path d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906zM66.654 13.075h-3.275a.57.57 0 0 0-.563.481l-.145.916-.229-.332c-.709-1.029-2.29-1.373-3.868-1.373-3.619 0-6.71 2.741-7.312 6.586-.313 1.918.132 3.752 1.22 5.031.998 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .562.66h2.95a.95.95 0 0 0 .939-.803l1.77-11.209a.568.568 0 0 0-.561-.658zm-4.565 6.374c-.316 1.871-1.801 3.127-3.695 3.127-.951 0-1.711-.305-2.199-.883-.484-.574-.668-1.391-.514-2.301.295-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.499.589.697 1.411.554 2.317zM84.096 13.075h-3.291a.954.954 0 0 0-.787.417l-4.539 6.686-1.924-6.425a.953.953 0 0 0-.912-.678h-3.234a.57.57 0 0 0-.541.754l3.625 10.638-3.408 4.811a.57.57 0 0 0 .465.9h3.287a.949.949 0 0 0 .781-.408l10.946-15.8a.57.57 0 0 0-.468-.895z" fill="#253B80"/>
                        <path d="M94.992 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.971-1.142-2.694-1.746-4.983-1.746zm.789 6.405c-.373 2.454-2.248 2.454-4.062 2.454h-1.031l.725-4.583a.568.568 0 0 1 .562-.481h.473c1.234 0 2.4 0 3.002.704.359.42.468 1.044.331 1.906zM115.434 13.075h-3.273a.567.567 0 0 0-.562.481l-.145.916-.23-.332c-.709-1.029-2.289-1.373-3.867-1.373-3.619 0-6.709 2.741-7.311 6.586-.312 1.918.131 3.752 1.219 5.031 1 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .564.66h2.949a.95.95 0 0 0 .938-.803l1.771-11.209a.571.571 0 0 0-.565-.658zm-4.565 6.374c-.314 1.871-1.801 3.127-3.695 3.127-.949 0-1.711-.305-2.199-.883-.484-.574-.666-1.391-.514-2.301.297-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.501.589.699 1.411.554 2.317z" fill="#179BD7"/>
                        <path d="M119.295 7.23l-2.807 17.858a.569.569 0 0 0 .562.658h2.822c.469 0 .867-.34.939-.803l2.768-17.536a.57.57 0 0 0-.562-.659h-3.16a.571.571 0 0 0-.562.482z" fill="#179BD7"/>
                      </svg>
                    </div>

                    {/* Visa */}
                    <div className="h-8 px-3 bg-white rounded flex items-center justify-center border">
                      <svg className="h-5" viewBox="0 0 48 16" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.558 9.174c-.009 2.264 2.016 3.528 3.556 4.281 1.583.774 2.114 1.269 2.109 1.96-.011 1.058-1.269 1.528-2.443 1.546-2.051.034-3.241-.553-4.19-0.996l-.738 3.453c.952.437 2.712.819 4.536.836 4.285 0 7.084-2.114 7.099-5.391.016-4.164-5.766-4.394-5.73-6.257.012-.566.553-1.17 1.735-1.324a7.733 7.733 0 0 1 4.039.708l.718-3.35a10.948 10.948 0 0 0-3.802-.692c-4.016 0-6.844 2.134-6.869 5.194zM28.803 14.69c.322-.87 1.549-4.203 1.549-4.203-.023.04.319-.871.516-1.435l.262 1.296s.745 3.606.9 4.357l-3.227-.015zm5.277-10.11h-3.298c-1.021 0-1.787.294-2.236 1.371L22.57 19.758h4.281s.701-1.939.859-2.365c.467 0 4.624.006 5.218.006.122.554.496 2.359.496 2.359h3.78L33.08 4.581zm-27.385.026l-.07.43c2.269.58 4.098 1.499 5.425 2.778l-2.224 10.899 4.316.006 6.415-14.113-4.309-.002-3.996 10.657-1.694-9.043c-.146-.718-.569-1.574-1.485-1.626a25.934 25.934 0 0 0-2.378.015z" fill="#1434CB"/>
                      </svg>
                    </div>

                    {/* Bancontact */}
                    <div className="h-8 px-3 bg-white rounded flex items-center justify-center border">
                      <svg className="h-5" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
                        <rect width="48" height="32" rx="4" fill="#005498"/>
                        <path d="M18 11.5C18 10.7 18.7 10 19.5 10h9c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-9c-.8 0-1.5-.7-1.5-1.5v-9zm2 2v5h8v-5h-8z" fill="white"/>
                        <path d="M24 16l-2 2h4l-2-2zm0 0l-2-2h4l-2 2z" fill="white"/>
                      </svg>
                    </div>

                    {/* iDEAL */}
                    <div className="h-8 px-3 bg-white rounded flex items-center justify-center border">
                      <svg className="h-5" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
                        <rect width="48" height="32" rx="4" fill="#CC0066"/>
                        <text x="24" y="20" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">iDEAL</text>
                      </svg>
                    </div>

                    {/* Google Pay */}
                    <div className="h-8 px-3 bg-white rounded flex items-center justify-center border">
                      <svg className="h-5" viewBox="0 0 61 25" xmlns="http://www.w3.org/2000/svg">
                        <path d="M25.464 11.932v5.506h-1.512v-13.8h4.008c.968 0 1.892.36 2.58 1.008.708.648 1.092 1.512 1.092 2.436 0 .948-.384 1.8-1.092 2.448-.688.648-1.612.996-2.58.996l-2.496.006zm0-5.7v4.248h2.544c.588 0 1.152-.24 1.56-.648.408-.408.636-.96.636-1.536 0-.576-.228-1.128-.636-1.536-.408-.408-.972-.648-1.56-.648l-2.544.12zM34.87 14.508c0-.924.36-1.812 1.008-2.46.648-.648 1.536-1.008 2.46-1.008s1.812.36 2.46 1.008c.648.648 1.008 1.536 1.008 2.46 0 .924-.36 1.812-1.008 2.46-.648.648-1.536 1.008-2.46 1.008s-1.812-.36-2.46-1.008c-.648-.648-1.008-1.536-1.008-2.46zm4.392-1.068c-.276-.276-.648-.432-1.056-.432-.408 0-.78.156-1.056.432-.276.276-.432.648-.432 1.056s.156.78.432 1.056c.276.276.648.432 1.056.432.408 0 .78-.156 1.056-.432.276-.276.432-.648.432-1.056s-.156-.78-.432-1.056zM51.742 11.376l-3.804 8.964c-.384.912-1.296 1.536-2.28 1.536h-.012c-.552 0-1.068-.228-1.44-.636l.756-1.26c.156.18.384.276.624.276.3 0 .564-.156.696-.42l.108-.252-3.456-8.208h1.62l2.496 6.012 2.496-6.012h1.596zM47.89 17.438v-9.252h1.512v9.252H47.89zM44.446 14.472v2.94h-1.512v-2.928c0-.936-.408-1.344-1.068-1.344-.708 0-1.308.492-1.308 1.56v2.712h-1.512v-6.036h1.512v.636c.372-.468.984-.756 1.68-.756 1.32 0 2.208.912 2.208 2.46v.756z" fill="#3C4043"/>
                        <path d="M18.264 10.584c0-.36-.024-.708-.084-1.044H10.8v1.968h4.188c-.18.972-.732 1.8-1.56 2.352v1.608h2.52c1.476-1.356 2.316-3.36 2.316-4.884z" fill="#4285F4"/>
                        <path d="M10.8 15.24c2.112 0 3.888-.696 5.184-1.884l-2.52-1.956c-.696.468-1.596.744-2.664.744-2.052 0-3.792-1.38-4.404-3.24H3.768v2.016c1.284 2.556 3.924 4.32 7.032 4.32z" fill="#34A853"/>
                        <path d="M6.396 11.904c-.156-.468-.252-.972-.252-1.488s.096-1.02.252-1.488V6.912H3.768C3.276 7.896 3 9.012 3 10.2s.276 2.304.768 3.288l2.628-2.016z" fill="#FBBC04"/>
                        <path d="M10.8 5.4c1.164 0 2.208.396 3.024 1.176l2.268-2.268C14.676 2.976 12.912 2.16 10.8 2.16 7.692 2.16 5.052 3.924 3.768 6.48l2.628 2.016C6.996 6.78 8.748 5.4 10.8 5.4z" fill="#EA4335"/>
                      </svg>
                    </div>

                    {/* EPS */}
                    <div className="h-8 px-3 bg-white rounded flex items-center justify-center border">
                      <svg className="h-5" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
                        <rect width="48" height="32" rx="4" fill="#C4122F"/>
                        <text x="24" y="20" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="white" textAnchor="middle">EPS</text>
                      </svg>
                    </div>
                  </div>
                </div>
                <Tabs defaultValue="automated" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="automated" disabled={!hasAutomatedProviders} className="gap-2">
                      <Plug className="h-4 w-4" /> Automated
                    </TabsTrigger>
                    <TabsTrigger value="manual" disabled={!hasManualMethods} className="gap-2">
                      <Wallet className="h-4 w-4" /> Manual
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="automated" className="space-y-3">
                    {providersLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : !hasAutomatedProviders ? (
                      <p className="text-sm text-muted-foreground">No automated providers are active.</p>
                    ) : (
                      automatedProviders.map((provider) => (
                        <label
                          key={provider.provider}
                          className={`border rounded-lg p-3 flex gap-2 items-center cursor-pointer transition ${
                            selectedProvider === provider.provider ? 'border-primary bg-primary/5' : 'border-muted'
                          }`}
                        >
                          <input
                            type="radio"
                            name="provider"
                            value={provider.provider}
                            checked={selectedProvider === provider.provider}
                            onChange={() => setSelectedProvider(provider.provider)}
                            className="h-4 w-4"
                          />
                          <div>
                            <div className="font-semibold">{provider.display_name}</div>
                            {provider.auto_verification && (
                              <div className="text-xs text-green-600">Auto-verification enabled</div>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-3">
                    {manualLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : !hasManualMethods ? (
                      <p className="text-sm text-muted-foreground">No manual payment methods configured.</p>
                    ) : (
                      manualMethods.map((method) => (
                        <label
                          key={method.id}
                          className={`border rounded-lg p-3 flex flex-col gap-1 cursor-pointer transition ${
                            selectedProvider === method.id ? 'border-primary bg-primary/5' : 'border-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="provider"
                              value={method.id}
                              checked={selectedProvider === method.id}
                              onChange={() => setSelectedProvider(method.id)}
                              className="h-4 w-4"
                            />
                            <div>
                              <div className="font-semibold">{method.name}</div>
                              <div className="text-xs text-muted-foreground">{method.type}</div>
                            </div>
                          </div>
                          {method.instructions && (
                            <div className="text-xs text-muted-foreground mt-2">{method.instructions}</div>
                          )}
                        </label>
                      ))
                    )}

                    {selectedProvider && manualMethods.find((m) => m.id === selectedProvider) && (
                      <div className="space-y-2">
                        <Label htmlFor="notes">Payment reference / notes</Label>
                        <Input
                          id="notes"
                          placeholder="Transaction ID or instructions"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                        />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Review & Confirm</CardTitle>
              <CardDescription>
                Payments are handled by trusted providers. Licenses activate automatically once verification succeeds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5" />
                <span>
                  We support PayPal, Stripe, CoinPayments, NOWPayments, and manual wallet methods. Configure providers in
                  the admin dashboard under <strong>Payments</strong>.
                </span>
              </div>
              <Separator />
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">Plan</div>
                  <div className="text-lg font-semibold">{tier.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Guild</div>
                  <div className="text-lg font-semibold">{selectedGuildLabel}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Payment</div>
                  <div className="text-lg font-semibold">
                    {selectedProvider ? selectedProvider : 'Select method'}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: selecteer "Assign later" als je de licentie nog niet direct aan een guild wilt koppelen. Je kunt dit later in het dashboard doen.
              </p>
              <Button className="w-full md:w-auto" disabled={startingCheckout} onClick={() => void startCheckout()}>
                {startingCheckout ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Proceed to Payment'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
