'use client';

/**
 * ComCraft - Maid Jobs Management Page
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Plus, BarChart3, Settings, MessageSquare, XCircle, Save, TrendingUp, Users } from 'lucide-react';

interface MaidJobConfig {
  id?: string;
  enabled: boolean;
  maid_quarters_channel_id: string;
  channels_to_clean: string[];
  cleanings_per_role_upgrade: number;
  cooldown_minutes: number;
  coins_per_cleaning: number;
  xp_per_cleaning: number;
  role_rewards: Record<string, string>; // { "5": "role_id", "10": "role_id" }
}

interface RoleplayMessage {
  id: string;
  message: string;
  enabled: boolean;
  weight: number;
}

export default function MaidJobsConfig() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [config, setConfig] = useState<MaidJobConfig>({
    enabled: false,
    maid_quarters_channel_id: '',
    channels_to_clean: [],
    cleanings_per_role_upgrade: 5,
    cooldown_minutes: 5,
    coins_per_cleaning: 10,
    xp_per_cleaning: 5,
    role_rewards: {}
  });

  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [roleplayMessages, setRoleplayMessages] = useState<RoleplayMessage[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [newRoleReward, setNewRoleReward] = useState({ cleanings: '', roleId: '' });

  useEffect(() => {
    if (guildId) {
      fetchConfig();
      fetchChannels();
      fetchRoles();
      fetchRoleplayMessages();
      fetchStatistics();
    }
  }, [guildId]);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/maid-jobs/config`);
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setConfig({
            ...data.config,
            role_rewards: data.config.role_rewards || {}
          });
        }
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/channels`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.channels) {
          setChannels(data.channels.text || []);
        } else if (Array.isArray(data.channels)) {
          setChannels(data.channels.filter((ch: any) => ch.type === 0 || ch.type === 5));
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/roles`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.roles) {
          setRoles(data.roles.filter((r: any) => !r.managed || r.name === '@everyone'));
        } else if (Array.isArray(data.roles)) {
          setRoles(data.roles.filter((r: any) => !r.managed || r.name === '@everyone'));
        }
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchRoleplayMessages = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/maid-jobs/messages`);
      if (response.ok) {
        const data = await response.json();
        setRoleplayMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching roleplay messages:', error);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/maid-jobs/statistics`);
      if (response.ok) {
        const data = await response.json();
        setStatistics(data.statistics);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const saveConfig = async () => {
    if (!config.maid_quarters_channel_id) {
      toast({
        title: 'Validation Error',
        description: 'Please select a maid quarters channel.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/maid-jobs/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Maid jobs configuration saved successfully!',
        });
        fetchConfig();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save config');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const addRoleplayMessage = async () => {
    if (!newMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/maid-jobs/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage.trim(),
          enabled: true,
          weight: 1
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Roleplay message added!',
        });
        setNewMessage('');
        fetchRoleplayMessages();
      } else {
        throw new Error('Failed to add message');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add roleplay message',
        variant: 'destructive'
      });
    }
  };

  const deleteRoleplayMessage = async (id: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/maid-jobs/messages?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Message deleted',
        });
        fetchRoleplayMessages();
      } else {
        throw new Error('Failed to delete message');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive'
      });
    }
  };

  const toggleMessageEnabled = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/maid-jobs/messages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !enabled })
      });

      if (response.ok) {
        fetchRoleplayMessages();
      }
    } catch (error) {
      console.error('Error toggling message:', error);
    }
  };

  const addRoleReward = () => {
    if (!newRoleReward.cleanings || !newRoleReward.roleId) {
      toast({
        title: 'Error',
        description: 'Please enter cleanings and select a role',
        variant: 'destructive'
      });
      return;
    }

    setConfig({
      ...config,
      role_rewards: {
        ...config.role_rewards,
        [newRoleReward.cleanings]: newRoleReward.roleId
      }
    });

    setNewRoleReward({ cleanings: '', roleId: '' });
  };

  const removeRoleReward = (cleanings: string) => {
    const newRewards = { ...config.role_rewards };
    delete newRewards[cleanings];
    setConfig({
      ...config,
      role_rewards: newRewards
    });
  };

  const toggleChannelToClean = (channelId: string) => {
    const isSelected = config.channels_to_clean.includes(channelId);
    setConfig({
      ...config,
      channels_to_clean: isSelected
        ? config.channels_to_clean.filter(id => id !== channelId)
        : [...config.channels_to_clean, channelId]
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading maid jobs configuration...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">🧹 Maid Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Configure the maid job system - users clock in, clean channels, and earn rewards!
          </p>
        </div>
      </div>

      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cleanings</p>
                <p className="text-2xl font-bold">{statistics.total_cleanings || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold">{statistics.active_sessions || 0}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Coins Earned</p>
                <p className="text-2xl font-bold">{statistics.total_coins_earned || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">XP Earned</p>
                <p className="text-2xl font-bold">{statistics.total_xp_earned || 0}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
        </div>
      )}

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">⚙️ Settings</TabsTrigger>
          <TabsTrigger value="messages">💬 Roleplay Messages</TabsTrigger>
          <TabsTrigger value="rewards">🎁 Role Rewards</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Basic Configuration</h2>
                <p className="text-sm text-muted-foreground">Set up the maid job system</p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                />
                <Label>Enabled</Label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="maid_quarters">Maid Quarters Channel *</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Users must go to this channel to clock in
                </p>
                <Select
                  value={config.maid_quarters_channel_id}
                  onValueChange={(value) => setConfig({ ...config, maid_quarters_channel_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select maid quarters channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        #{channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Channels That Can Be Cleaned</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Select channels that can be cleaned. Leave empty to allow all channels.
                </p>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                  {channels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No channels available</p>
                  ) : (
                    channels.map((channel) => (
                      <div key={channel.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={config.channels_to_clean.includes(channel.id)}
                          onChange={() => toggleChannelToClean(channel.id)}
                          className="rounded"
                        />
                        <Label className="cursor-pointer">#{channel.name}</Label>
                      </div>
                    ))
                  )}
                </div>
                {config.channels_to_clean.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    All channels can be cleaned when list is empty
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coins_per_cleaning">Coins Per Cleaning</Label>
                  <Input
                    id="coins_per_cleaning"
                    type="number"
                    min={0}
                    value={config.coins_per_cleaning}
                    onChange={(e) => setConfig({ ...config, coins_per_cleaning: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <Label htmlFor="xp_per_cleaning">XP Per Cleaning</Label>
                  <Input
                    id="xp_per_cleaning"
                    type="number"
                    min={0}
                    value={config.xp_per_cleaning}
                    onChange={(e) => setConfig({ ...config, xp_per_cleaning: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cooldown">Cooldown (minutes)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Time before same channel can be cleaned again
                  </p>
                  <Input
                    id="cooldown"
                    type="number"
                    min={1}
                    value={config.cooldown_minutes}
                    onChange={(e) => setConfig({ ...config, cooldown_minutes: parseInt(e.target.value) || 5 })}
                  />
                </div>

                <div>
                  <Label htmlFor="cleanings_per_role">Cleanings Per Role Upgrade</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Default cleanings needed for role upgrades (can override per role)
                  </p>
                  <Input
                    id="cleanings_per_role"
                    type="number"
                    min={1}
                    value={config.cleanings_per_role_upgrade}
                    onChange={(e) => setConfig({ ...config, cleanings_per_role_upgrade: parseInt(e.target.value) || 5 })}
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={saveConfig} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Roleplay Messages</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Messages shown when users clean channels. These are randomly selected.
            </p>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., 'You cleaned behind some dusty paintings'"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addRoleplayMessage();
                    }
                  }}
                />
                <Button onClick={addRoleplayMessage}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Message
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {roleplayMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roleplay messages yet. Add one above!</p>
                ) : (
                  roleplayMessages.map((msg) => (
                    <div key={msg.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3 flex-1">
                        <Switch
                          checked={msg.enabled}
                          onCheckedChange={() => toggleMessageEnabled(msg.id, msg.enabled)}
                        />
                        <span className={msg.enabled ? '' : 'text-muted-foreground line-through'}>
                          {msg.message}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRoleplayMessage(msg.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Role Rewards</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Assign roles to users when they reach certain cleaning milestones.
            </p>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Cleanings required (e.g., 5)"
                  min={1}
                  value={newRoleReward.cleanings}
                  onChange={(e) => setNewRoleReward({ ...newRoleReward, cleanings: e.target.value })}
                />
                <Select
                  value={newRoleReward.roleId}
                  onValueChange={(value) => setNewRoleReward({ ...newRoleReward, roleId: value })}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addRoleReward}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Reward
                </Button>
              </div>

              <div className="space-y-2">
                {Object.keys(config.role_rewards).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No role rewards configured yet.</p>
                ) : (
                  Object.entries(config.role_rewards)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([cleanings, roleId]) => {
                      const role = roles.find(r => r.id === roleId);
                      return (
                        <div key={cleanings} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Badge variant="outline">{cleanings} cleanings</Badge>
                            <span>→</span>
                            <span>{role ? role.name : `Role ${roleId}`}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRoleReward(cleanings)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

