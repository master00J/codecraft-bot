'use client';

/**
 * ComCraft Payments – Stripe integration
 * Server owners add their own Stripe keys; payments go directly to their account.
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

export default function PaymentsDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [hasKeys, setHasKeys] = useState(false);
  const [linkAmount, setLinkAmount] = useState('5');
  const [linkCopied, setLinkCopied] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (guildId) load();
  }, [guildId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/stripe`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEnabled(!!data.enabled);
      setPublishableKey(data.publishableKey || '');
      setSecretKey(''); // Never show existing secret
      setHasKeys(!!data.hasKeys);
      setWebhookSecret(data.webhookSecret || '');
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      setWebhookUrl(`${base}/api/webhooks/stripe?guild_id=${guildId}`);
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
      toast({
        title: 'Saved',
        description: 'Payment settings updated.',
      });
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
          Payments (Stripe)
        </h1>
        <p className="text-muted-foreground mt-1">
          Receive payments directly to your own Stripe account. Codecraft does not handle funds.
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

      {hasKeys && enabled && (
        <Card className="p-6 max-w-xl">
          <h2 className="text-lg font-semibold mb-2">Payment link</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Share this link so people can support your server. They can open it in a browser and pay with card or other methods. Money goes to your Stripe account.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px] space-y-1">
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
            <Button
              variant="outline"
              size="icon"
              title="Copy link"
              onClick={() => {
                const base = typeof window !== 'undefined' ? window.location.origin : '';
                const url = `${base}/api/comcraft/public/checkout?guildId=${guildId}&amount=${encodeURIComponent(linkAmount || '5')}&currency=eur`;
                void navigator.clipboard.writeText(url).then(() => {
                  setLinkCopied(true);
                  toast({ title: 'Copied', description: 'Payment link copied to clipboard.' });
                  setTimeout(() => setLinkCopied(false), 2000);
                });
              }}
            >
              {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Link: {typeof window !== 'undefined' ? `${window.location.origin}/api/comcraft/public/checkout?guildId=${guildId}&amount=${linkAmount || '5'}&currency=eur` : '…'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            You can also use the bot command <code className="bg-muted px-1 rounded">/donate</code> in your server to show a support link.
          </p>
        </Card>
      )}

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
    </div>
  );
}
