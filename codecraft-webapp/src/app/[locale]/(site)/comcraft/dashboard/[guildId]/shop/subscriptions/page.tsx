'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, CreditCard } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface Sub {
  id: string;
  shopItemId: string;
  itemName: string | null;
  discordUserId: string;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: string;
  createdAt: string;
}

export default function ShopSubscriptionsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Sub[]>([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (guildId) load();
  }, [guildId, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/shop/subscriptions-list?status=${statusFilter}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setSubscriptions(data.subscriptions ?? []);
    } catch {
      toast({ title: 'Error', description: 'Could not load subscriptions.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function revokeNow(subId: string) {
    setRevoking(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/shop/subscriptions-list/${subId}/revoke`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to revoke');
      toast({ title: 'Revoked', description: 'Subscription ended and role removed.' });
      setRevokeId(null);
      load();
    } catch {
      toast({ title: 'Error', description: 'Could not revoke subscription.', variant: 'destructive' });
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Link href={`/comcraft/dashboard/${guildId}/shop`}>
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shop
          </Button>
        </Link>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CreditCard className="h-8 w-8" />
          Shop subscriptions
        </h1>
        <p className="text-muted-foreground mt-1">
          Active and past subscriptions. You can revoke a subscription now (removes role immediately).
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className="text-sm font-medium">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : subscriptions.length === 0 ? (
          <p className="text-muted-foreground py-8">No subscriptions match the filter.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Period end</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.itemName ?? s.shopItemId}</TableCell>
                  <TableCell className="font-mono text-xs">{s.discordUserId}</TableCell>
                  <TableCell>{s.status}</TableCell>
                  <TableCell>{new Date(s.currentPeriodEnd).toLocaleString()}</TableCell>
                  <TableCell>
                    {s.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setRevokeId(s.id)}
                      >
                        Revoke now
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={!!revokeId} onOpenChange={() => !revoking && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              The user will lose the role immediately. They will not be refunded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => revokeId && revokeNow(revokeId)}
              disabled={revoking}
            >
              {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
