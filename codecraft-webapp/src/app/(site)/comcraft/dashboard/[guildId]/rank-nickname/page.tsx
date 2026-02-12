'use client';

/**
 * Rank Nickname Dashboard
 * Optional: when a member has a configured role, their nickname becomes [PREFIX] (Username).
 * e.g. Cadet -> [CDT] (Jantje)
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, User, RefreshCw } from 'lucide-react';

interface RankNicknameItem {
  id: string;
  role_id: string;
  prefix: string;
}

interface DiscordRole {
  id: string;
  name: string;
}

export default function RankNicknamePage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<RankNicknameItem[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [newRoleId, setNewRoleId] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (guildId) fetchData();
  }, [guildId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [listRes, rolesRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/rank-nickname`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`)
      ]);
      const listData = await listRes.json();
      const rolesData = await rolesRes.json();
      if (listData.success && listData.list) setList(listData.list);
      setRoles(rolesData.roles || []);
    } catch (e: any) {
      toast({
        title: 'Error',
        description: 'Failed to load rank nickname configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function addEntry() {
    if (!newRoleId.trim() || !newPrefix.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Select a role and enter a prefix (e.g. CDT)',
        variant: 'destructive'
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/rank-nickname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: newRoleId, prefix: newPrefix.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      toast({ title: 'Added', description: `Nickname prefix for role saved` });
      setNewRoleId('');
      setNewPrefix('');
      await fetchData();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'Failed to add',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/rank-nickname?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast({ title: 'Removed', description: 'Prefix removed' });
      await fetchData();
    } catch (e: any) {
      toast({
        title: 'Error',
        description: 'Failed to remove',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/rank-nickname/sync`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      let desc = data.synced !== undefined ? `${data.synced} nickname(s) updated.` : 'Nicknames synced.';
      if (data.skippedHierarchy > 0) desc += ` ${data.skippedHierarchy} skipped (bot role below member – move bot role above rank roles).`;
      toast({ title: 'Sync done', description: desc });
    } catch (e: any) {
      toast({
        title: 'Sync failed',
        description: e.message || 'Could not sync. Check bot permission "Manage Nicknames" and that the bot is in the server.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  }

  const roleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || roleId;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" />
          Rank Nickname
        </h1>
        <p className="text-muted-foreground mt-1">
          When a member has one of these roles, their server nickname is set to <strong>[Prefix] (Username)</strong>.
          For example: role Cadet with prefix <strong>CDT</strong> → <strong>[CDT] (Jantje)</strong>. Optional: only guilds that add mappings use this.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Add role prefix</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label>Role</Label>
            <Select value={newRoleId} onValueChange={setNewRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles
                  .filter(r => !list.some(l => l.role_id === r.id))
                  .map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                {roles.filter(r => !list.some(l => l.role_id === r.id)).length === 0 && (
                  <SelectItem value="__none__" disabled>All roles configured or no roles</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 w-28">
            <Label>Prefix</Label>
            <Input
              placeholder="e.g. CDT"
              value={newPrefix}
              onChange={e => setNewPrefix(e.target.value)}
              maxLength={20}
            />
          </div>
          <Button onClick={addEntry} disabled={saving || !newRoleId || !newPrefix.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2">Add</span>
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="font-semibold">Configured role prefixes</h2>
          {list.length > 0 && (
            <Button variant="outline" size="sm" onClick={syncNow} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync nicknames now
            </Button>
          )}
        </div>
        {list.length === 0 ? (
          <p className="text-muted-foreground">No role prefixes yet. Add one above to enable rank nicknames for this server.</p>
        ) : (
          <ul className="space-y-2">
            {list.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                <span>
                  <strong>{roleName(item.role_id)}</strong> → <code className="bg-muted px-1 rounded">[{item.prefix}] (Username)</code>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(item.id)}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-sm text-muted-foreground">
        The bot needs <strong>Manage Nicknames</strong> and its role must be <strong>above</strong> the rank roles in Server settings → Roles (otherwise Discord blocks nickname changes). Nicknames are set when a member <strong>gains</strong> one of these roles. If someone already had the role before you added the prefix, click <strong>Sync nicknames now</strong> above or remove and re-assign the role.
      </p>
    </div>
  );
}
