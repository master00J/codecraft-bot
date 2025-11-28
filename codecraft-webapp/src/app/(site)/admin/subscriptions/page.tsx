'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw } from 'lucide-react';

interface GuildSubscription {
  guild_id: string;
  guild_name: string | null;
  subscription_tier: string | null;
  subscription_active: boolean | null;
  subscription_notes: string | null;
  subscription_updated_at: string | null;
  is_active: boolean | null;
  owner_discord_id: string | null;
  owner_username: string | null;
  member_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  is_trial: boolean | null;
  trial_ends_at: string | null;
  license_expires_at: string | null;
}

const tierOptions = [
  { value: 'free', label: 'Free' },
  { value: 'basic', label: 'Basic' },
  { value: 'premium', label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
];

export default function AdminSubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [savingGuild, setSavingGuild] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [subscriptions, setSubscriptions] = useState<GuildSubscription[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/subscriptions');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load subscriptions');
      }

      setSubscriptions(data.subscriptions || []);
    } catch (error: any) {
      console.error('Failed to load subscriptions:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load subscriptions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return subscriptions;

    return subscriptions.filter((guild) => {
      return (
        guild.guild_id?.toLowerCase().includes(term) ||
        guild.guild_name?.toLowerCase().includes(term) ||
        guild.subscription_tier?.toLowerCase().includes(term)
      );
    });
  }, [subscriptions, search]);

  async function updateGuild(guildId: string, payload: Record<string, any>, successMessage = 'Subscription updated') {
    setSavingGuild(guildId);
    try {
      const response = await fetch(`/api/admin/subscriptions/${guildId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update subscription');
      }

      setSubscriptions((prev) =>
        prev.map((guild) => (guild.guild_id === guildId ? { ...guild, ...data.guild } : guild))
      );

      toast({ title: 'Success', description: successMessage });
    } catch (error: any) {
      console.error('Failed to update subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subscription',
        variant: 'destructive',
      });
    } finally {
      setSavingGuild(null);
    }
  }

  function getStatusBadge(guild: GuildSubscription) {
    const active = guild.subscription_active !== false;
    if (active) {
      return <Badge variant="secondary">Active</Badge>;
    }
    return <Badge variant="destructive">Disabled</Badge>;
  }

  function formatUpdatedAt(guild: GuildSubscription) {
    const dateString = guild.subscription_updated_at || guild.updated_at;
    if (!dateString) return 'Never';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return 'Unknown';
    }
  }

  function getLicenseExpiryInfo(guild: GuildSubscription) {
    if (!guild.license_expires_at) return null;
    
    const expiryDate = new Date(guild.license_expires_at);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `Expired ${Math.abs(diffDays)}d ago`, color: 'bg-red-600' };
    }
    
    if (diffDays === 0) {
      return { text: 'Expires today', color: 'bg-red-600' };
    }
    
    if (diffDays <= 7) {
      return { text: `${diffDays}d remaining`, color: 'bg-orange-600' };
    }
    
    if (diffDays <= 30) {
      return { text: `${diffDays}d remaining`, color: 'bg-yellow-600' };
    }
    
    return { text: `${diffDays}d remaining`, color: 'bg-blue-600' };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Comcraft Subscriptions</h1>
          <p className="text-muted-foreground">
            Manually enable, disable, or update Comcraft licenses for any guild.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search guilds..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-64"
          />
          <Button variant="outline" onClick={fetchSubscriptions} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Total Guilds</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{subscriptions.length}</p>
            <p className="text-sm text-muted-foreground">Tracked guilds in the system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Active Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {subscriptions.filter((guild) => guild.subscription_active !== false).length}
            </p>
            <p className="text-sm text-muted-foreground">Guilds with active access</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Premium Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {subscriptions.filter((guild) => guild.subscription_tier === 'premium' || guild.subscription_tier === 'enterprise').length}
            </p>
            <p className="text-sm text-muted-foreground">Premium & Enterprise customers</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Guild Licenses</CardTitle>
            <p className="text-sm text-muted-foreground">
              Toggle access, adjust tiers, or add internal notes per guild.
            </p>
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guild</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No guilds found.
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((guild) => {
                const saving = savingGuild === guild.guild_id;
                return (
                  <TableRow key={guild.guild_id} className="align-top">
                    <TableCell>
                      <div className="font-semibold flex items-center gap-2">
                        {guild.guild_name || 'Unknown Guild'}
                        {getStatusBadge(guild)}
                      </div>
                      <div className="text-xs text-muted-foreground">{guild.guild_id}</div>
                      {guild.owner_username && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Owner: {guild.owner_username}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        defaultValue={guild.subscription_tier || 'free'}
                        onValueChange={(value) =>
                          updateGuild(guild.guild_id, { subscription_tier: value }, 'Tier updated')
                        }
                        disabled={saving}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tierOptions.map((tier) => (
                            <SelectItem key={tier.value} value={tier.value}>
                              {tier.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-col gap-1 mt-1">
                        {guild.is_trial && guild.trial_ends_at && (
                          <Badge className="bg-green-600 text-white text-xs w-fit">
                            🎁 Trial ({Math.max(0, Math.ceil((new Date(guild.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d)
                          </Badge>
                        )}
                        {(() => {
                          const expiryInfo = getLicenseExpiryInfo(guild);
                          return expiryInfo ? (
                            <Badge className={`${expiryInfo.color} text-white text-xs w-fit`}>
                              🔑 License ({expiryInfo.text})
                            </Badge>
                          ) : null;
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Platform active: {guild.is_active === false ? 'No' : 'Yes'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={guild.subscription_active !== false}
                          onCheckedChange={(checked) =>
                            updateGuild(
                              guild.guild_id,
                              { subscription_active: checked },
                              checked ? 'License activated' : 'License disabled'
                            )
                          }
                          disabled={saving}
                        />
                        <span className="text-sm">{guild.subscription_active !== false ? 'Active' : 'Disabled'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {guild.member_count ?? '—'}
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <Textarea
                        defaultValue={guild.subscription_notes ?? ''}
                        placeholder="Internal notes..."
                        rows={3}
                        onBlur={(event) =>
                          updateGuild(
                            guild.guild_id,
                            { subscription_notes: event.target.value },
                            'Notes updated'
                          )
                        }
                        disabled={saving}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatUpdatedAt(guild)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateGuild(guild.guild_id, { is_active: !(guild.is_active !== false) }, 'Guild active flag updated')
                        }
                        disabled={saving}
                      >
                        Toggle Platform
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      Loading subscriptions...
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
