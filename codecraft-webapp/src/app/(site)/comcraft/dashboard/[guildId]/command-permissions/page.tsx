'use client';

/**
 * Comcraft - Command permissions
 * Configure which roles can use which slash commands (e.g. /store, /shop only for admins).
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Shield, Minus, Loader2 } from 'lucide-react';

interface CommandPermission {
  command_name: string;
  label: string;
  allowed_role_ids: string[] | null;
}

interface DiscordRole {
  id: string;
  name: string;
  color?: number;
  position?: number;
}

export default function CommandPermissionsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [permissions, setPermissions] = useState<CommandPermission[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [permRes, rolesRes] = await Promise.all([
          fetch(`/api/comcraft/guilds/${guildId}/command-permissions`),
          fetch(`/api/comcraft/guilds/${guildId}/discord/roles`),
        ]);
        const permData = await permRes.json();
        const rolesData = await rolesRes.json();
        if (permData.success && permData.permissions) {
          setPermissions(permData.permissions);
        }
        if (rolesData.success && rolesData.roles) {
          setRoles(rolesData.roles);
        }
      } catch (e) {
        console.error(e);
        toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [guildId, toast]);

  const updateCommandRoles = (commandName: string, allowedRoleIds: string[] | null) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.command_name === commandName ? { ...p, allowed_role_ids: allowedRoleIds } : p
      )
    );
  };

  const addRole = (commandName: string, roleId: string) => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.command_name !== commandName) return p;
        const current = p.allowed_role_ids ?? [];
        if (current.includes(roleId)) return p;
        return { ...p, allowed_role_ids: [...current, roleId] };
      })
    );
  };

  const removeRole = (commandName: string, roleId: string) => {
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.command_name !== commandName) return p;
        const next = (p.allowed_role_ids ?? []).filter((id) => id !== roleId);
        return { ...p, allowed_role_ids: next.length ? next : null };
      })
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/command-permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: permissions.map((p) => ({
            command_name: p.command_name,
            allowed_role_ids: p.allowed_role_ids,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast({ title: 'Saved', description: 'Command permissions updated.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

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
          <Shield className="h-6 w-6" />
          Command permissions
        </h1>
        <p className="text-muted-foreground mt-1">
          Limit who can use specific slash commands. Leave &quot;Allowed roles&quot; empty to allow everyone. Users with the Administrator permission can always use the command.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Slash commands</CardTitle>
          <CardDescription>
            For each command, optionally select roles that are allowed to use it. Empty = everyone can use it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {permissions.map((perm) => (
            <div
              key={perm.command_name}
              className="flex flex-wrap items-start gap-4 py-3 border-b last:border-0"
            >
              <div className="min-w-[180px]">
                <Label className="font-mono text-sm">{perm.label}</Label>
              </div>
              <div className="flex-1 flex flex-wrap gap-2 items-center">
                <Select
                  value="__add__"
                  onValueChange={(v) => {
                    if (v && v !== '__add__') addRole(perm.command_name, v);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Add allowed role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__add__">Add role...</SelectItem>
                    {roles
                      .filter((r) => !(perm.allowed_role_ids ?? []).includes(r.id))
                      .map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    {roles.filter((r) => !(perm.allowed_role_ids ?? []).includes(r.id)).length === 0 && (
                      <SelectItem value="__none__" disabled>
                        All roles added (or clear for everyone)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {(perm.allowed_role_ids ?? []).length === 0 ? (
                  <span className="text-sm text-muted-foreground">Everyone</span>
                ) : (
                  (perm.allowed_role_ids ?? []).map((id) => {
                    const role = roles.find((r) => r.id === id);
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 pr-1">
                        {role?.name ?? id}
                        <button
                          type="button"
                          aria-label="Remove"
                          className="rounded-full hover:bg-muted p-0.5"
                          onClick={() => removeRole(perm.command_name, id)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })
                )}
              </div>
            </div>
          ))}
          <div className="pt-4">
            <Button onClick={save} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save permissions'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
