'use client';

/**
 * ComCraft Payments – Stripe & PayPal
 * Server owners add their own keys; payments go directly to their account.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, ArrowLeft, CreditCard, ExternalLink, Copy, Check } from 'lucide-react';

const STRIPE_DASHBOARD_URL = 'https://dashboard.stripe.com/apikeys';
const PAYPAL_APPS_URL = 'https://developer.paypal.com/dashboard/applications';

export default function PaymentsDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayPal, setSavingPayPal] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [hasKeys, setHasKeys] = useState(false);
  const [linkAmount, setLinkAmount] = useState('5');
  const [linkCopied, setLinkCopied] = useState(false);
  const [stripeLinkCopied, setStripeLinkCopied] = useState(false);
  const [paypalLinkCopied, setPaypalLinkCopied] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [paypalHasKeys, setPaypalHasKeys] = useState(false);
  const [paypalSandbox, setPaypalSandbox] = useState(true);
  const [paypalWebhookId, setPaypalWebhookId] = useState('');
  const [paypalWebhookUrl, setPaypalWebhookUrl] = useState('');

  useEffect(() => {
    if (guildId) load();
  }, [guildId]);

  async function load() {
    setLoading(true);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const [stripeRes, paypalRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/stripe`),
        fetch(`/api/comcraft/guilds/${guildId}/paypal`),
      ]);
      if (stripeRes.ok) {
        const data = await stripeRes.json();
        setEnabled(!!data.enabled);
        setPublishableKey(data.publishableKey || '');
        setSecretKey('');
        setHasKeys(!!data.hasKeys);
        setWebhookSecret(data.webhookSecret || '');
        setWebhookUrl(`${base}/api/webhooks/stripe?guild_id=${guildId}`);
      }
      if (paypalRes.ok) {
        const data = await paypalRes.json();
        setPaypalEnabled(!!data.enabled);
        setPaypalClientId(data.clientId || '');
        setPaypalClientSecret('');
        setPaypalHasKeys(!!data.hasKeys);
        setPaypalSandbox(data.sandbox !== false);
        setPaypalWebhookId(data.webhookId || '');
        setPaypalWebhookUrl(`${base}/api/webhooks/paypal?guild_id=${guildId}`);
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Could not load payment settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { enabled, publishableKey: publishableKey.trim(), webhookSecret: webhookSecret.trim() };
      if (secretKey.trim()) body.secretKey = secretKey.trim();

      const res = await fetch(`/api/comcraft/guilds/${guildId}/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      setSecretKey('');
      setHasKeys(!!(publishableKey.trim() && (secretKey.trim() || hasKeys)));
      toast({ title: 'Saved', description: 'Stripe settings updated.' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to save.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function savePayPal() {
    setSavingPayPal(true);
    try {
      const body: Record<string, unknown> = {
        enabled: paypalEnabled,
        clientId: paypalClientId.trim(),
        sandbox: paypalSandbox,
        webhookId: paypalWebhookId.trim(),
      };
      if (paypalClientSecret.trim()) body.clientSecret = paypalClientSecret.trim();

      const res = await fetch(`/api/comcraft/guilds/${guildId}/paypal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      setPaypalClientSecret('');
      setPaypalHasKeys(!!paypalClientId.trim());
      toast({ title: 'Saved', description: 'PayPal settings updated.' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to save.',
        variant: 'destructive',
      });
    } finally {
      setSavingPayPal(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Link href={`/comcraft/dashboard/${guildId}`}>
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CreditCard className="h-8 w-8" />
          Payments (Stripe & PayPal)
        </h1>
        <p className="text-muted-foreground mt-1">
          Receive payments directly to your own Stripe or PayPal account. Codecraft does not handle funds.
        </p>
      </div>

      <Card className="p-6 max-w-xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Stripe payments</Label>
              <p className="text-sm text-muted-foreground">
                Allow this server to accept payments via your Stripe account
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium mb-1">How it works</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Create a free account at{' '}
                <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  stripe.com
                </a>
              </li>
              <li>Get your API keys from{' '}
                <a href={STRIPE_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                  Developers → API keys <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Paste the keys below. Your secret key is stored securely and never shown again.</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pk">Publishable key</Label>
            <Input
              id="pk"
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder="pk_live_... or pk_test_..."
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sk">Secret key</Label>
            <Input
              id="sk"
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={hasKeys ? '•••••••• (leave blank to keep current)' : 'sk_live_... or sk_test_...'}
              className="font-mono text-sm"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Only enter to set or change. We never display your secret key.
            </p>
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </Card>

      {(hasKeys && enabled) || (paypalHasKeys && paypalEnabled) ? (
        <Card className="p-6 max-w-xl">
          <h2 className="text-lg font-semibold mb-2">Payment links</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Share a link so people can support your server. Amount in €. The bot command <code className="bg-muted px-1 rounded">/donate</code> can show both options.
          </p>
          <div className="flex flex-wrap items-end gap-2 mb-4">
            <div className="flex-1 min-w-[120px] space-y-1">
              <Label htmlFor="link-amount">Amount (€)</Label>
              <Input
                id="link-amount"
                type="number"
                min="1"
                max="999"
                step="0.5"
                value={linkAmount}
                onChange={(e) => setLinkAmount(e.target.value)}
                className="w-24"
              />
            </div>
            {hasKeys && enabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const base = typeof window !== 'undefined' ? window.location.origin : '';
                  const url = `${base}/api/comcraft/public/checkout?guildId=${guildId}&amount=${encodeURIComponent(linkAmount || '5')}&currency=eur&provider=stripe`;
                  void navigator.clipboard.writeText(url).then(() => {
                    setStripeLinkCopied(true);
                    toast({ title: 'Copied', description: 'Stripe link copied.' });
                    setTimeout(() => setStripeLinkCopied(false), 2000);
                  });
                }}
              >
                {stripeLinkCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                Copy Stripe link
              </Button>
            )}
            {paypalHasKeys && paypalEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const base = typeof window !== 'undefined' ? window.location.origin : '';
                  const url = `${base}/api/comcraft/public/checkout?guildId=${guildId}&amount=${encodeURIComponent(linkAmount || '5')}&currency=eur&provider=paypal`;
                  void navigator.clipboard.writeText(url).then(() => {
                    setPaypalLinkCopied(true);
                    toast({ title: 'Copied', description: 'PayPal link copied.' });
                    setTimeout(() => setPaypalLinkCopied(false), 2000);
                  });
                }}
              >
                {paypalLinkCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                Copy PayPal link
              </Button>
            )}
          </div>
        </Card>
      ) : null}

      {hasKeys && enabled && (
        <Card className="p-6 max-w-xl">
          <h2 className="text-lg font-semibold mb-2">Shop webhook (for role assignment)</h2>
          <p className="text-sm text-muted-foreground mb-4">
            If you use the Shop to sell roles, add this webhook in Stripe so we can assign the role after payment. In Stripe Dashboard go to Developers → Webhooks → Add endpoint.
          </p>
          <div className="space-y-2 mb-4">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-sm" />
              <Button
                variant="outline"
                size="icon"
                title="Copy"
                onClick={() => {
                  void navigator.clipboard.writeText(webhookUrl).then(() => {
                    setLinkCopied(true);
                    toast({ title: 'Copied', description: 'Webhook URL copied.' });
                    setTimeout(() => setLinkCopied(false), 2000);
                  });
                }}
              >
                {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Signing secret</Label>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="whsec_... (from Stripe after adding the webhook)"
              className="font-mono text-sm"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              In Stripe, select event <code className="bg-muted px-1 rounded">checkout.session.completed</code> and paste the signing secret here.
            </p>
          </div>
          <Button onClick={save} disabled={saving} className="mt-4">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </Card>
      )}

      <Card className="p-6 max-w-xl">
        <h2 className="text-lg font-semibold mb-2">PayPal</h2>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable PayPal</Label>
              <p className="text-sm text-muted-foreground">
                Accept payments via your PayPal account
              </p>
            </div>
            <Switch checked={paypalEnabled} onCheckedChange={setPaypalEnabled} />
          </div>
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium mb-1">Setup</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Create an app at{' '}
                <a href={PAYPAL_APPS_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                  PayPal Developer Dashboard <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li><strong>Required for Shop:</strong> paste <strong>Client ID</strong> and <strong>Client Secret</strong> below, turn <strong>Enable PayPal</strong> on, then click <strong>Save PayPal</strong>. Without these, the store will show &quot;payments not set up&quot;.</li>
              <li>For role assignment after purchase: add the webhook URL in your PayPal app (event: Payment capture completed) and paste the Webhook ID here, then Save again.</li>
            </ol>
          </div>
          <div className="space-y-2">
            <Label>Client ID</Label>
            <Input
              value={paypalClientId}
              onChange={(e) => setPaypalClientId(e.target.value)}
              placeholder="From PayPal App credentials"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>Client Secret</Label>
            <Input
              type="password"
              value={paypalClientSecret}
              onChange={(e) => setPaypalClientSecret(e.target.value)}
              placeholder={paypalHasKeys ? '•••••••• (leave blank to keep current)' : 'Paste to set'}
              className="font-mono text-sm"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Sandbox (testing)</Label>
            <Switch checked={paypalSandbox} onCheckedChange={setPaypalSandbox} />
          </div>
          <Button onClick={savePayPal} disabled={savingPayPal}>
            {savingPayPal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save PayPal
          </Button>
        </div>
        {paypalHasKeys && paypalEnabled && (
          <>
            <hr className="my-4" />
            <h3 className="text-sm font-semibold mb-2">Shop webhook (for role assignment)</h3>
            <p className="text-xs text-muted-foreground mb-2">
              In your PayPal app, add webhook URL below and subscribe to <code className="bg-muted px-1 rounded">Payment capture completed</code>. Paste the Webhook ID here.
            </p>
            <div className="space-y-2 mb-2">
              <Label className="text-xs">Webhook URL</Label>
              <div className="flex gap-2">
                <Input readOnly value={paypalWebhookUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  title="Copy"
                  onClick={() => {
                    void navigator.clipboard.writeText(paypalWebhookUrl).then(() => {
                      toast({ title: 'Copied', description: 'PayPal webhook URL copied.' });
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Webhook ID</Label>
              <Input
                value={paypalWebhookId}
                onChange={(e) => setPaypalWebhookId(e.target.value)}
                placeholder="From PayPal after adding webhook"
                className="font-mono text-sm"
              />
            </div>
            <Button onClick={savePayPal} disabled={savingPayPal} variant="outline" className="mt-2">
              Save
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
