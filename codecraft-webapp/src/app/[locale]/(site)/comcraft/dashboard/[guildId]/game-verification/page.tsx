'use client';

/**
 * Game Verification Dashboard (locale route)
 * Configure in-game username verification (e.g. FC26 Pro Clubs). One-time per user; admins can update usernames via /verify-set.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, ShieldCheck, Users, RefreshCw } from 'lucide-react';

interface GameVerificationConfig {
  guild_id: string;
  game_name: string;
  unregistered_role_id: string | null;
  verified_role_id: string | null;
  one_time_only: boolean;
  enabled: boolean;
}

interface VerifiedUser {
  id: string;
  user_id: string;
  in_game_username: string;
  verified_at: string;
}

export default function GameVerificationPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<GameVerificationConfig | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<VerifiedUser[]>([]);
  const [usersCount, setUsersCount] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (guildId) fetchData();
  }, [guildId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [configRes, rolesRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/game-verification`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`)
      ]);
      const [configData, rolesData] = await Promise.all([
        configRes.json(),
        rolesRes.json()
      ]);
      if (configData.config) setConfig(configData.config);
      setRoles(rolesData.roles || []);
    } catch (e: any) {
      toast({
        title: 'Error',
        description: 'Failed to load game verification configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/game-verification/users?limit=100`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setUsersCount(data.count ?? 0);
      }
    } catch (e: any) {
      toast({
        title: 'Error',
        description: 'Failed to load verified users',
        variant: 'destructive'
      });
    } finally {
      setUsersLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/game-verification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: 'Success', description: 'Game verification settings saved' });
      await fetchData();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Failed to load configuration</p>
          <Button onClick={fetchData} className="mt-4">Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-500/5">
      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" size="sm" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>← Back to Dashboard</Link>
        </Button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xl">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Game Verification</h1>
            <p className="text-muted-foreground">
              Verify members with their in-game username. One-time per user; admins can update names with <code className="text-xs bg-muted px-1 rounded">/verify-set</code>.
            </p>
          </div>
        </div>

        <Card className="border-2 shadow-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-lg">Enable Game Verification</div>
              <p className="text-sm text-muted-foreground">
                Members can use <code className="bg-muted px-1 rounded">/verify &lt;username&gt;</code> to get the verified role and set their nickname.
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
            />
          </div>

          {config.enabled && (
            <>
              <div className="space-y-2">
                <Label>Game name (e.g. FC26 Pro Clubs)</Label>
                <Input
                  value={config.game_name}
                  onChange={(e) => setConfig({ ...config, game_name: e.target.value || 'In-Game' })}
                  placeholder="e.g. FC26 Pro Clubs"
                />
                <p className="text-xs text-muted-foreground">Shown in messages and used for audit reasons.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unregistered role</Label>
                  <Select
                    value={config.unregistered_role_id || 'none'}
                    onValueChange={(v) => setConfig({ ...config, unregistered_role_id: v === 'none' ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role (skip)</SelectItem>
                      {roles.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Removed when the user verifies.</p>
                </div>
                <div className="space-y-2">
                  <Label>Verified role</Label>
                  <Select
                    value={config.verified_role_id || 'none'}
                    onValueChange={(v) => setConfig({ ...config, verified_role_id: v === 'none' ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role selected</SelectItem>
                      {roles.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Given when the user runs /verify.</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div>
                  <div className="font-semibold">One-time verification per user</div>
                  <p className="text-sm text-muted-foreground">
                    If enabled, users can only run /verify once. Admins can still change their in-game name with /verify-set.
                  </p>
                </div>
                <Switch
                  checked={config.one_time_only}
                  onCheckedChange={(v) => setConfig({ ...config, one_time_only: v })}
                />
              </div>
            </>
          )}

          <Button onClick={saveConfig} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save settings
          </Button>
        </Card>

        {config.enabled && (
          <Card className="border-2 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Verified users
              </h2>
              <Button variant="outline" size="sm" onClick={fetchUsers} disabled={usersLoading}>
                {usersLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Refresh
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              To update a member&apos;s in-game username, use <code className="bg-muted px-1 rounded">/verify-set @user &lt;username&gt;</code> in Discord (requires Manage Nicknames).
            </p>
            {users.length === 0 && !usersLoading ? (
              <p className="text-muted-foreground text-sm">No verified users yet. Ask members to use /verify in your server.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-3 gap-2 px-3 py-2 text-xs font-semibold bg-muted/40">
                  <div>User ID</div>
                  <div>In-game username</div>
                  <div>Verified at</div>
                </div>
                {users.map((u) => (
                  <div key={u.id} className="grid grid-cols-3 gap-2 px-3 py-2 text-sm border-t">
                    <div className="font-mono text-muted-foreground">{u.user_id}</div>
                    <div className="font-medium">{u.in_game_username}</div>
                    <div className="text-muted-foreground">{new Date(u.verified_at).toLocaleString()}</div>
                  </div>
                ))}
                {usersCount > users.length && (
                  <div className="px-3 py-2 text-xs text-muted-foreground border-t">
                    Showing {users.length} of {usersCount} verified users.
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
