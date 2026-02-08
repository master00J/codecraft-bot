'use client';

/**
 * ComCraft Shop – sell roles (or other items). Payments go to server Stripe; role assigned on success.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, ShoppingBag, Plus, Pencil, Trash2, Copy, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  price_amount_cents: number;
  currency: string;
  discord_role_id: string | null;
  delivery_type: 'role' | 'code' | 'prefilled';
  enabled: boolean;
  sort_order: number;
  created_at: string;
}

interface PrefilledCode {
  id: string;
  code: string;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
}

export default function ShopDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    priceAmountCents: 500,
    currency: 'eur',
    discordRoleId: '',
    deliveryType: 'role' as 'role' | 'code' | 'prefilled',
    enabled: true,
  });
  const [prefilledCodes, setPrefilledCodes] = useState<PrefilledCode[]>([]);
  const [prefilledCodesLoading, setPrefilledCodesLoading] = useState(false);
  const [prefilledAddText, setPrefilledAddText] = useState('');
  const [prefilledAdding, setPrefilledAdding] = useState(false);

  useEffect(() => {
    if (guildId) {
      loadItems();
      loadRoles();
    }
  }, [guildId]);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/shop`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Could not load shop items.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadRoles() {
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/discord/roles`);
      if (!res.ok) return;
      const data = await res.json();
      setRoles(data.roles ?? []);
    } catch {
      // ignore
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({
      name: '',
      description: '',
      priceAmountCents: 500,
      currency: 'eur',
      discordRoleId: roles[0]?.id ?? '',
      deliveryType: 'role',
      enabled: true,
    });
    setPrefilledCodes([]);
    setPrefilledAddText('');
    setDialogOpen(true);
  }

  async function addPrefilledCodes() {
    if (!editingId || !prefilledAddText.trim()) return;
    setPrefilledAdding(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/shop/${editingId}/prefilled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: prefilledAddText.trim().split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add codes');
      setPrefilledAddText('');
      const listRes = await fetch(`/api/comcraft/guilds/${guildId}/shop/${editingId}/prefilled`);
      const listData = await listRes.json();
      if (listRes.ok && Array.isArray(listData.codes)) setPrefilledCodes(listData.codes);
      toast({ title: 'Added', description: `${data.added ?? 0} code(s) added.` });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to add codes', variant: 'destructive' });
    } finally {
      setPrefilledAdding(false);
    }
  }

  async function removePrefilledCode(codeId: string) {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/shop/${editingId}/prefilled?codeId=${encodeURIComponent(codeId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setPrefilledCodes((prev) => prev.filter((c) => c.id !== codeId));
      toast({ title: 'Removed', description: 'Code removed from pool.' });
    } catch {
      toast({ title: 'Error', description: 'Could not remove code.', variant: 'destructive' });
    }
  }

  async function openEdit(item: ShopItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? '',
      priceAmountCents: item.price_amount_cents,
      currency: item.currency ?? 'eur',
      discordRoleId: item.discord_role_id ?? '',
      deliveryType: item.delivery_type ?? 'role',
      enabled: item.enabled,
    });
    setPrefilledCodes([]);
    setPrefilledAddText('');
    setDialogOpen(true);
    if ((item.delivery_type ?? '') === 'prefilled') {
      setPrefilledCodesLoading(true);
      try {
        const res = await fetch(`/api/comcraft/guilds/${guildId}/shop/${item.id}/prefilled`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.codes)) setPrefilledCodes(data.codes);
      } catch {
        // ignore
      } finally {
        setPrefilledCodesLoading(false);
      }
    }
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Name is required.', variant: 'destructive' });
      return;
    }
    if (form.deliveryType !== 'prefilled' && !form.discordRoleId) {
      toast({ title: 'Error', description: 'Select a Discord role for Role or Gift card items.', variant: 'destructive' });
      return;
    }
    if (form.priceAmountCents < 1) {
      toast({ title: 'Error', description: 'Price must be at least 1 cent.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priceAmountCents: form.priceAmountCents,
      currency: form.currency,
      discordRoleId: form.discordRoleId,
      deliveryType: form.deliveryType,
      enabled: form.enabled,
    };
      if (editingId) {
        const res = await fetch(`/api/comcraft/guilds/${guildId}/shop/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update');
        }
        toast({ title: 'Updated', description: 'Shop item updated.' });
      } else {
        const res = await fetch(`/api/comcraft/guilds/${guildId}/shop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create');
        }
        toast({ title: 'Created', description: 'Shop item added.' });
      }
      setDialogOpen(false);
      loadItems();
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

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/shop/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast({ title: 'Deleted', description: 'Shop item removed.' });
      setDeleteId(null);
      loadItems();
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Could not delete item.',
        variant: 'destructive',
      });
    }
  }

  function formatPrice(cents: number, currency: string) {
    const sym = currency.toUpperCase() === 'EUR' ? '€' : currency.toUpperCase() === 'USD' ? '$' : currency;
    return `${sym}${(cents / 100).toFixed(2)}`;
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
          <ShoppingBag className="h-8 w-8" />
          Shop
        </h1>
        <p className="text-muted-foreground mt-1">
          Sell roles (or other items). Users pay via Stripe; the role is assigned automatically after payment. Set up Stripe in Payments first and add a webhook for shop purchases.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Shop items</h2>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add item
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            No items yet. Add one to let users buy roles.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const role = roles.find((r) => r.id === item.discord_role_id);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">{item.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.delivery_type === 'prefilled' ? '—' : (role?.name ?? item.discord_role_id ?? '—')}
                    </TableCell>
                    <TableCell>
                      {item.delivery_type === 'prefilled' ? 'Pre-filled code' : item.delivery_type === 'code' ? 'Gift card' : 'Role'}
                    </TableCell>
                    <TableCell>{formatPrice(item.price_amount_cents, item.currency)}</TableCell>
                    <TableCell>{item.enabled ? 'Enabled' : 'Disabled'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Users can buy via the bot command <code className="bg-muted px-1 rounded">/store</code> in your server, or via your <strong>store page</strong> (link below). Configure the Stripe/PayPal webhook in Payments so roles are assigned after payment.
        </p>
        {items.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Store page (share this link):</span>
            <code className="text-xs break-all flex-1 min-w-0">
              {typeof window !== 'undefined' ? `${window.location.origin}/comcraft/store/${guildId}` : `…/comcraft/store/${guildId}`}
            </code>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const url = typeof window !== 'undefined' ? `${window.location.origin}/comcraft/store/${guildId}` : '';
                if (url) window.open(url, '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Open store
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = typeof window !== 'undefined' ? `${window.location.origin}/comcraft/store/${guildId}` : '';
                void navigator.clipboard.writeText(url).then(() => {
                  toast({ title: 'Copied', description: 'Store link copied to clipboard.' });
                });
              }}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy link
            </Button>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit item' : 'Add shop item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. VIP Role"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description for the product"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery type</Label>
              <Select
                value={form.deliveryType}
                onValueChange={(v: 'role' | 'code' | 'prefilled') => setForm((f) => ({ ...f, deliveryType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="role">Role (assign immediately after payment)</SelectItem>
                  <SelectItem value="code">Gift card (buyer gets a code to redeem for role)</SelectItem>
                  <SelectItem value="prefilled">Pre-filled code (you add codes to sell, e.g. Amazon gift cards)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Gift card: buyer gets a code to redeem for a role. Pre-filled: you add your own codes (e.g. Amazon); buyer receives one after payment.
              </p>
            </div>
            {form.deliveryType !== 'prefilled' && (
              <div className="space-y-2">
                <Label>Discord role (assigned on purchase or when code is redeemed)</Label>
                <Select
                  value={form.discordRoleId}
                  onValueChange={(v) => setForm((f) => ({ ...f, discordRoleId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.deliveryType === 'prefilled' && editingId && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                <Label>Codes to sell (one per purchase)</Label>
                {prefilledCodesLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Add codes (e.g. Amazon gift card codes). Buyers receive one code each after payment. Stock: {prefilledCodes.length}
                    </p>
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Paste codes (one per line or comma/semicolon separated)"
                        value={prefilledAddText}
                        onChange={(e) => setPrefilledAddText(e.target.value)}
                        rows={2}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={addPrefilledCodes}
                        disabled={prefilledAdding || !prefilledAddText.trim()}
                      >
                        {prefilledAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                      </Button>
                    </div>
                    {prefilledCodes.length > 0 && (
                      <ul className="max-h-32 overflow-y-auto space-y-1 text-sm">
                        {prefilledCodes.map((c) => (
                          <li key={c.id} className="flex items-center justify-between gap-2 font-mono bg-background px-2 py-1 rounded">
                            <span className="truncate">{c.code}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 text-destructive h-7"
                              onClick={() => removePrefilledCode(c.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
            {form.deliveryType === 'prefilled' && !editingId && (
              <p className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
                Save the item first, then click Edit to add codes to sell.
              </p>
            )}
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label>Price (cents)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.priceAmountCents}
                  onChange={(e) => setForm((f) => ({ ...f, priceAmountCents: parseInt(e.target.value, 10) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">e.g. 500 = €5.00</p>
              </div>
              <div className="space-y-2 w-24">
                <Label>Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eur">EUR</SelectItem>
                    <SelectItem value="usd">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete shop item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the item from the shop. Existing purchases are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && remove(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
