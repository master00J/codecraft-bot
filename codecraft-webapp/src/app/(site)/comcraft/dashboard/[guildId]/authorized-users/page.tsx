'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, Plus, Trash2, User, Crown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AuthorizedUser {
  id: string | null;
  guild_id: string;
  discord_id: string;
  role: string;
  added_by: string | null;
  added_at: string | null;
}

export default function AuthorizedUsersPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();
  
  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDiscordId, setNewDiscordId] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'moderator'>('admin');

  useEffect(() => {
    fetchAuthorizedUsers();
  }, [guildId]);

  const fetchAuthorizedUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/admins`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch authorized users');
      }

      setAuthorizedUsers(data.authorizedUsers || []);
    } catch (error: any) {
      console.error('Error fetching authorized users:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load authorized users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newDiscordId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a Discord ID',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: newDiscordId.trim(),
          role: newRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add user');
      }

      toast({
        title: 'Success',
        description: 'User added successfully',
      });

      setShowAddDialog(false);
      setNewDiscordId('');
      setNewRole('admin');
      fetchAuthorizedUsers();
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add user',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveUser = async (discordId: string, isOwner: boolean) => {
    if (isOwner) {
      toast({
        title: 'Error',
        description: 'Cannot remove the guild owner',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('Are you sure you want to remove this user?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/admins?discordId=${discordId}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove user');
      }

      toast({
        title: 'Success',
        description: 'User removed successfully',
      });

      fetchAuthorizedUsers();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove user',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Authorized Users</h1>
          <p className="text-muted-foreground">
            Manage which users and roles can access the dashboard
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Access</CardTitle>
          <CardDescription>
            Users listed here can access and manage the dashboard for this server
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authorizedUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No authorized users found. Add users to grant dashboard access.
            </div>
          ) : (
            <div className="space-y-2">
              {authorizedUsers.map((user) => {
                const isOwner = user.role === 'owner';
                return (
                  <div
                    key={user.discord_id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      {isOwner ? (
                        <Crown className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <User className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-200">
                            {user.discord_id}
                          </span>
                          <Badge
                            variant={
                              isOwner
                                ? 'default'
                                : user.role === 'admin'
                                ? 'secondary'
                                : 'outline'
                            }
                            className={
                              isOwner
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                : ''
                            }
                          >
                            {user.role === 'owner' ? 'Owner' : user.role === 'admin' ? 'Admin' : 'Moderator'}
                          </Badge>
                        </div>
                        {user.added_at && (
                          <p className="text-xs text-gray-400 mt-1">
                            Added {new Date(user.added_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {!isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(user.discord_id, false)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Authorized User</DialogTitle>
            <DialogDescription>
              Enter the Discord ID of the user you want to grant dashboard access to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="discordId">Discord User ID</Label>
              <Input
                id="discordId"
                placeholder="123456789012345678"
                value={newDiscordId}
                onChange={(e) => setNewDiscordId(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                Right-click a user in Discord and select "Copy User ID" (Developer Mode must be enabled)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole} onValueChange={(value: 'admin' | 'moderator') => setNewRole(value)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser}>Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

