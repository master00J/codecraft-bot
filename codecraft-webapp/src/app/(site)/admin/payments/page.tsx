'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  Wallet,
  CreditCard,
  RefreshCw,
  Loader2,
  Check,
  X,
  Trash2,
  Shield,
  Bitcoin,
  Globe,
  Zap,
  Settings,
  Plus,
  Info,
} from 'lucide-react';

interface PaymentProvider {
  id: string;
  provider: string;
  display_name: string;
  is_active: boolean;
  auto_verification: boolean;
  config: Record<string, any> | null;
  display_order?: number;
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

interface ProviderState {
  is_active: boolean;
  auto_verification: boolean;
  config: Record<string, any>;
  saving?: boolean;
}

const PROVIDER_META: Record<string, {
  label: string;
  description: string;
  icon: React.ReactNode;
  docs?: string;
  fields: Array<{
    key: string;
    label: string;
    placeholder?: string;
    type?: 'text' | 'password';
    helper?: string;
  }>;
}> = {
  paypal: {
    label: 'PayPal',
    description: 'Configure PayPal REST credentials for automatic payment capture.',
    icon: <CreditCard className="h-6 w-6 text-blue-500" />,
    docs: 'https://developer.paypal.com',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'PayPal REST Client ID' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'PayPal REST Client Secret', type: 'password' },
      { key: 'webhookId', label: 'Webhook ID', placeholder: 'PayPal Webhook ID for IPN verification' },
    ],
  },
  stripe: {
    label: 'Stripe',
    description: 'Use Stripe for credit card payments with instant verification.',
    icon: <CreditCard className="h-6 w-6 text-purple-500" />,
    docs: 'https://dashboard.stripe.com',
    fields: [
      { key: 'secretKey', label: 'Secret Key', placeholder: 'sk_live_...', type: 'password' },
      { key: 'publishableKey', label: 'Publishable Key', placeholder: 'pk_live_...' },
      { key: 'webhookSecret', label: 'Webhook Secret', placeholder: 'whsec_...', type: 'password' },
      { key: 'accountId', label: 'Account ID (Organization only)', placeholder: 'acct_1SSzaVIBuWBNZEYL', helper: 'Only required if using an Organization API key. Leave empty for regular API keys. Find your Account ID in Stripe Dashboard → Organization → Accounts.' },
    ],
  },
  coinpayments: {
    label: 'CoinPayments',
    description: 'Automatically generate crypto invoices via CoinPayments.',
    icon: <Bitcoin className="h-6 w-6 text-orange-500" />,
    docs: 'https://www.coinpayments.net/',
    fields: [
      { key: 'merchantId', label: 'Merchant ID', placeholder: 'CoinPayments Merchant ID' },
      { key: 'ipnSecret', label: 'IPN Secret', placeholder: 'CoinPayments IPN Secret', type: 'password' },
      { key: 'publicKey', label: 'Public Key', placeholder: 'CoinPayments Public Key' },
      { key: 'privateKey', label: 'Private API Key', placeholder: 'CoinPayments Private Key', type: 'password' },
    ],
  },
  nowpayments: {
    label: 'NOWPayments',
    description: 'Accept 150+ cryptocurrencies with automatic conversion.',
    icon: <Zap className="h-6 w-6 text-green-500" />,
    docs: 'https://nowpayments.io',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'NOWPayments API Key', type: 'password' },
      { key: 'ipnSecret', label: 'IPN Secret', placeholder: 'NOWPayments IPN Secret', type: 'password' },
    ],
  },
  direct_wallet: {
    label: 'Direct Wallets',
    description: 'Configure static crypto wallet addresses with optional auto-verification.',
    icon: <Wallet className="h-6 w-6 text-amber-500" />,
    fields: [
      { key: 'btc', label: 'BTC Wallet', placeholder: 'Bitcoin address' },
      { key: 'eth', label: 'ETH Wallet', placeholder: 'Ethereum address' },
      { key: 'usdt_trc20', label: 'USDT (TRC20)', placeholder: 'USDT TRC20 address' },
      { key: 'usdt_erc20', label: 'USDT (ERC20)', placeholder: 'USDT ERC20 address' },
      { key: 'ltc', label: 'LTC Wallet', placeholder: 'Litecoin address' },
      { key: 'bnb', label: 'BNB Wallet', placeholder: 'BNB Smart Chain address' },
      { key: 'instructions', label: 'Payment Instructions', placeholder: 'Instructions shown to customers' },
    ],
  },
};

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>({});
  const [loadingProviders, setLoadingProviders] = useState(true);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [savingMethod, setSavingMethod] = useState(false);
  const [newMethod, setNewMethod] = useState({
    name: '',
    type: 'crypto',
    address: '',
    instructions: '',
  });

  useEffect(() => {
    void loadProviders();
    void fetchPaymentMethods();
  }, []);

  const loadProviders = async () => {
    setLoadingProviders(true);
    try {
      const response = await fetch('/api/admin/payment-providers');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load payment providers');
      }

      const list: PaymentProvider[] = data.providers || [];
      setProviders(list);

      const mapped: Record<string, ProviderState> = {};
      list.forEach((provider) => {
        console.log(`[Payment Provider] Loading ${provider.provider}:`, {
          is_active: provider.is_active,
          auto_verification: provider.auto_verification,
          config_keys: provider.config ? Object.keys(provider.config) : [],
          has_secretKey: !!provider.config?.secretKey,
          has_publishableKey: !!provider.config?.publishableKey,
          has_webhookSecret: !!provider.config?.webhookSecret,
        });
        mapped[provider.provider] = {
          is_active: provider.is_active,
          auto_verification: provider.auto_verification,
          config: provider.config || {},
        };
      });
      setProviderStates(mapped);
    } catch (error) {
      console.error('Failed to load payment providers:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load payment providers',
        variant: 'destructive',
      });
    } finally {
      setLoadingProviders(false);
    }
  };

  const fetchPaymentMethods = async () => {
    setLoadingMethods(true);
    try {
      const response = await fetch('/api/admin/payment-methods');
      const data = await response.json();
      if (response.ok) {
        setPaymentMethods(data.methods || []);
      } else {
        throw new Error(data.error || 'Failed to load payment methods');
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load payment methods',
        variant: 'destructive',
      });
    } finally {
      setLoadingMethods(false);
    }
  };

  const updateProviderState = (provider: string, partial: Partial<ProviderState>) => {
    setProviderStates((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        ...partial,
      },
    }));
  };

  const updateProviderConfig = (provider: string, key: string, value: string) => {
    setProviderStates((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        config: {
          ...(prev[provider]?.config || {}),
          [key]: value,
        },
      },
    }));
  };

  const handleSaveProvider = async (provider: string) => {
    const providerState = providerStates[provider];
    if (!providerState) return;

    updateProviderState(provider, { saving: true });

    try {
      const payload = {
        is_active: providerState.is_active,
        auto_verification: providerState.auto_verification,
        config: providerState.config,
      };

      console.log(`[Payment Provider] Saving ${provider}:`, payload);

      const response = await fetch(`/api/admin/payment-providers/${provider}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update provider');
      }

      console.log(`[Payment Provider] Saved ${provider}:`, data.provider);

      // Update state directly from API response to ensure consistency
      if (data.provider) {
        updateProviderState(provider, {
          is_active: data.provider.is_active,
          auto_verification: data.provider.auto_verification,
          config: data.provider.config || {},
        });
      }

      toast({
        title: 'Success',
        description: `${PROVIDER_META[provider]?.label || provider} settings saved`,
      });

      // Reload providers to ensure everything is in sync
      await loadProviders();
    } catch (error) {
      console.error('Failed to update provider:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update provider',
        variant: 'destructive',
      });
    } finally {
      updateProviderState(provider, { saving: false });
    }
  };

  const handleAddMethod = async () => {
    if (!newMethod.name || !newMethod.address) {
      toast({
        title: 'Error',
        description: 'Name and address are required',
        variant: 'destructive',
      });
      return;
    }

    setSavingMethod(true);
    try {
      const response = await fetch('/api/admin/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMethod,
          display_order: paymentMethods.length,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add payment method');
      }

      toast({
        title: 'Success',
        description: 'Payment method added successfully',
      });

      setNewMethod({ name: '', type: 'crypto', address: '', instructions: '' });
      await fetchPaymentMethods();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add payment method',
        variant: 'destructive',
      });
    } finally {
      setSavingMethod(false);
    }
  };

  const togglePaymentMethod = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/payment-methods/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment method');
      }

      toast({
        title: 'Success',
        description: `Payment method ${!currentStatus ? 'activated' : 'deactivated'}`,
      });

      await fetchPaymentMethods();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update payment method',
        variant: 'destructive',
      });
    }
  };

  const deletePaymentMethod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
      const response = await fetch(`/api/admin/payment-methods/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete payment method');
      }

      toast({
        title: 'Success',
        description: data.softDeleted
          ? 'Payment method deactivated (in use by existing payments)'
          : 'Payment method deleted successfully',
      });

      await fetchPaymentMethods();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete payment method',
        variant: 'destructive',
      });
    }
  };

  const stats = useMemo(() => {
    const totalProviders = providers.length;
    const activeProviders = providers.filter((p) => p.is_active).length;
    const autoProviders = providers.filter((p) => p.auto_verification).length;

    return { totalProviders, activeProviders, autoProviders };
  }, [providers]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Integrations</h1>
          <p className="text-muted-foreground">
            Configure automated payment providers and manual payment methods for customers.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void loadProviders();
            void fetchPaymentMethods();
          }}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loadingProviders || loadingMethods ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Providers</CardTitle>
            <CardDescription>Configured automated providers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalProviders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Active Providers</CardTitle>
            <CardDescription>Providers currently accepting payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeProviders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Auto-Verification</CardTitle>
            <CardDescription>Providers with automatic verification enabled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.autoProviders}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="providers" className="gap-2">
            <Wallet className="h-4 w-4" />
            Automated Providers
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Settings className="h-4 w-4" />
            Manual Methods
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-4">
          {loadingProviders ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {providers.map((provider) => {
                const meta = PROVIDER_META[provider.provider] || {
                  label: provider.display_name,
                  description: 'Configure payment provider settings.',
                  icon: <Globe className="h-6 w-6" />,
                  fields: [],
                };

                const state = providerStates[provider.provider] || {
                  is_active: false,
                  auto_verification: false,
                  config: {},
                };

                return (
                  <Card key={provider.provider} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{meta.icon}</div>
                        <div>
                          <CardTitle className="text-xl flex items-center gap-2">
                            {meta.label}
                            <Badge variant={state.is_active ? 'default' : 'secondary'}>
                              {state.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            {state.auto_verification && (
                              <Badge variant="outline" className="border-green-500 text-green-500">
                                Auto-Verify
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>{meta.description}</CardDescription>
                          {meta.docs && (
                            <a
                              href={meta.docs}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-muted-foreground underline flex items-center gap-1 mt-1"
                            >
                              <Info className="h-3 w-3" /> Documentation
                            </a>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label>Enable provider</Label>
                          <p className="text-xs text-muted-foreground">
                            Active providers appear in checkout and webhook flows.
                          </p>
                        </div>
                        <Switch
                          checked={state.is_active}
                          onCheckedChange={(checked) =>
                            updateProviderState(provider.provider, { is_active: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label>Automatic verification</Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically verify payments via webhooks.
                          </p>
                        </div>
                        <Switch
                          checked={state.auto_verification}
                          onCheckedChange={(checked) =>
                            updateProviderState(provider.provider, { auto_verification: checked })
                          }
                        />
                      </div>

                      {meta.fields.length > 0 && (
                        <div className="space-y-4">
                          {meta.fields.map((field) => (
                            <div key={field.key} className="space-y-2">
                              <Label htmlFor={`${provider.provider}-${field.key}`}>{field.label}</Label>
                              {field.type === 'password' ? (
                                <Input
                                  id={`${provider.provider}-${field.key}`}
                                  type="password"
                                  value={state.config?.[field.key] || ''}
                                  placeholder={field.placeholder}
                                  onChange={(event) =>
                                    updateProviderConfig(provider.provider, field.key, event.target.value)
                                  }
                                />
                              ) : (
                                <Input
                                  id={`${provider.provider}-${field.key}`}
                                  value={state.config?.[field.key] || ''}
                                  placeholder={field.placeholder}
                                  onChange={(event) =>
                                    updateProviderConfig(provider.provider, field.key, event.target.value)
                                  }
                                />
                              )}
                              {field.helper && (
                                <p className="text-xs text-muted-foreground">{field.helper}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        onClick={() => void handleSaveProvider(provider.provider)}
                        disabled={state.saving}
                        className="w-full gap-2"
                      >
                        {state.saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Saving
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" /> Save Configuration
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Manual Payment Method
              </CardTitle>
              <CardDescription>Manual methods are shown to customers alongside automated providers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="method-name">Method Name *</Label>
                  <Input
                    id="method-name"
                    placeholder="e.g., Bank Transfer NL, CashApp, Bitcoin"
                    value={newMethod.name}
                    onChange={(event) => setNewMethod((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="method-type">Type</Label>
                  <select
                    id="method-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={newMethod.type}
                    onChange={(event) => setNewMethod((prev) => ({ ...prev, type: event.target.value }))}
                  >
                    <option value="crypto">Cryptocurrency</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="paypal">PayPal</option>
                    <option value="stripe">Stripe</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="method-address">Address / Account *</Label>
                <Input
                  id="method-address"
                  placeholder="Wallet address, IBAN, email, or account identifier"
                  value={newMethod.address}
                  onChange={(event) => setNewMethod((prev) => ({ ...prev, address: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="method-instructions">Customer Instructions</Label>
                <Textarea
                  id="method-instructions"
                  placeholder="Optional instructions for the customer (e.g. reference to include, on-chain network, etc.)"
                  rows={3}
                  value={newMethod.instructions}
                  onChange={(event) => setNewMethod((prev) => ({ ...prev, instructions: event.target.value }))}
                />
              </div>

              <Button
                onClick={() => void handleAddMethod()}
                disabled={savingMethod || !newMethod.name || !newMethod.address}
                className="gap-2"
              >
                {savingMethod ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {savingMethod ? 'Adding...' : 'Add Payment Method'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Payment Methods</CardTitle>
              <CardDescription>These methods complement automated providers and appear during checkout.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMethods ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No manual payment methods configured.</p>
                  <p className="text-sm">Add a method above to make it available to customers.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex flex-col md:flex-row md:items-center md:justify-between border rounded-lg p-4 gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{method.name}</h4>
                          <Badge variant="outline">{method.type}</Badge>
                          <Badge variant={method.is_active ? 'default' : 'secondary'}>
                            {method.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono break-all">{method.address}</p>
                        {method.instructions && (
                          <p className="text-sm text-muted-foreground mt-1">{method.instructions}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void togglePaymentMethod(method.id, method.is_active)}
                          className="gap-2"
                        >
                          {method.is_active ? (
                            <>
                              <X className="h-4 w-4" /> Disable
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" /> Activate
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void deletePaymentMethod(method.id)}
                          className="gap-2"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Webhook & Verification Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Enable <strong>auto-verification</strong> for providers that support webhooks. We provide webhook
            endpoints at <code className="font-mono">/api/webhooks/payments/[provider]</code> to capture payment updates.
          </p>
          <p>
            • For PayPal and Stripe, create the webhook in your provider dashboard and copy the secret here.
          </p>
          <p>
            • For crypto wallets, auto-verification uses transaction monitoring via the configured API keys. You can
            still provide manual wallet addresses for customers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
