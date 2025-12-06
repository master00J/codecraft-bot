'use client';

/**
 * ComCraft Discord Referrals Dashboard
 * Configure referral rewards for Discord server invites
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, ArrowLeft, Gift, Users, TrendingUp, Plus, Trash2, Trophy } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

export default function ReferralsDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    enabled: false,
    inviter_reward_type: 'none',
    inviter_reward_role_id: null,
    inviter_reward_coins: 0,
    inviter_reward_xp: 0,
    new_member_reward_type: 'none',
    new_member_reward_role_id: null,
    new_member_reward_coins: 0,
    new_member_reward_xp: 0,
    require_min_account_age_days: 0,
    require_min_members_invited: 1,
    cooldown_hours: 0,
    ignore_bots: true,
    log_channel_id: null
  });
  const [stats, setStats] = useState<any[]>([]);
  const [recentReferrals, setRecentReferrals] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [referralsRes, rolesRes, channelsRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/referrals`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`)
      ]);

      const [referralsData, rolesData, channelsData] = await Promise.all([
        referralsRes.json(),
        rolesRes.json(),
        channelsRes.json()
      ]);

      if (referralsData.success) {
        setConfig(referralsData.config || config);
        setStats(referralsData.stats || []);
        setRecentReferrals(referralsData.recentReferrals || []);
        setTiers(referralsData.tiers || []);
      }

      if (rolesData.success) {
        setRoles(rolesData.roles || []);
      }

      if (channelsData.success) {
        setChannels(channelsData.channels?.text || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load referral configuration.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/referrals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, tiers })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Referral configuration saved successfully!'
        });
        await fetchData();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save configuration.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Overview
          </Link>
        </Button>

        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-8">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                  <Gift className="h-8 w-8" />
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
                  Discord Referrals
                </h1>
                <p className="text-muted-foreground max-w-xl">
                  Reward members for inviting others to your server! Give roles, coins, or XP to both the inviter and new members.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="referrals-enabled">Enable Referrals</Label>
                <Switch
                  id="referrals-enabled"
                  checked={config.enabled || false}
                  onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                />
              </div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="config" className="space-y-6">
          <TabsList>
            <TabsTrigger value="config">⚙️ Configuration</TabsTrigger>
            <TabsTrigger value="stats">📊 Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
            {config.enabled && (
              <>
                {/* Inviter Rewards */}
                <Card className="p-6 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Users className="h-6 w-6" />
                      Inviter Rewards
                    </h2>
                    <p className="text-muted-foreground">Rewards for the person who invites new members</p>
                  </div>

                  <Separator />

                  <div>
                    <Label>Reward Type</Label>
                    <Select
                      value={config.inviter_reward_type || 'none'}
                      onValueChange={(value) => setConfig({ ...config, inviter_reward_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="role">Role Only</SelectItem>
                        <SelectItem value="coins">Coins Only</SelectItem>
                        <SelectItem value="xp">XP Only</SelectItem>
                        <SelectItem value="both">Role + Coins/XP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(config.inviter_reward_type === 'role' || config.inviter_reward_type === 'both') && (
                    <div>
                      <Label>Role to Give</Label>
                      <Select
                        value={config.inviter_reward_role_id || ''}
                        onValueChange={(value) => setConfig({ ...config, inviter_reward_role_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              @{role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(config.inviter_reward_type === 'coins' || config.inviter_reward_type === 'both') && (
                    <div>
                      <Label>Coins to Give</Label>
                      <Input
                        type="number"
                        value={config.inviter_reward_coins || 0}
                        onChange={(e) => setConfig({ ...config, inviter_reward_coins: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                  )}

                  {(config.inviter_reward_type === 'xp' || config.inviter_reward_type === 'both') && (
                    <div>
                      <Label>XP to Give</Label>
                      <Input
                        type="number"
                        value={config.inviter_reward_xp || 0}
                        onChange={(e) => setConfig({ ...config, inviter_reward_xp: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                  )}
                </Card>

                {/* New Member Rewards */}
                <Card className="p-6 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <TrendingUp className="h-6 w-6" />
                      New Member Rewards
                    </h2>
                    <p className="text-muted-foreground">Rewards for the person who joins via invite</p>
                  </div>

                  <Separator />

                  <div>
                    <Label>Reward Type</Label>
                    <Select
                      value={config.new_member_reward_type || 'none'}
                      onValueChange={(value) => setConfig({ ...config, new_member_reward_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="role">Role Only</SelectItem>
                        <SelectItem value="coins">Coins Only</SelectItem>
                        <SelectItem value="xp">XP Only</SelectItem>
                        <SelectItem value="both">Role + Coins/XP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(config.new_member_reward_type === 'role' || config.new_member_reward_type === 'both') && (
                    <div>
                      <Label>Role to Give</Label>
                      <Select
                        value={config.new_member_reward_role_id || ''}
                        onValueChange={(value) => setConfig({ ...config, new_member_reward_role_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              @{role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(config.new_member_reward_type === 'coins' || config.new_member_reward_type === 'both') && (
                    <div>
                      <Label>Coins to Give</Label>
                      <Input
                        type="number"
                        value={config.new_member_reward_coins || 0}
                        onChange={(e) => setConfig({ ...config, new_member_reward_coins: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                  )}

                  {(config.new_member_reward_type === 'xp' || config.new_member_reward_type === 'both') && (
                    <div>
                      <Label>XP to Give</Label>
                      <Input
                        type="number"
                        value={config.new_member_reward_xp || 0}
                        onChange={(e) => setConfig({ ...config, new_member_reward_xp: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                  )}
                </Card>

                {/* Tiered Rewards */}
                <Card className="p-6 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Trophy className="h-6 w-6" />
                      Tiered Rewards
                    </h2>
                    <p className="text-muted-foreground">Reward users with different roles based on their invite count (e.g., 1 invite = Bronze, 5 invites = Silver)</p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    {tiers.map((tier, index) => (
                      <Card key={tier.id || index} className="p-4 bg-muted/50">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label>Tier Name</Label>
                            <Input
                              value={tier.tier_name || ''}
                              onChange={(e) => {
                                const newTiers = [...tiers];
                                newTiers[index].tier_name = e.target.value;
                                setTiers(newTiers);
                              }}
                              placeholder="e.g., Bronze, Silver, Gold"
                            />
                          </div>
                          <div>
                            <Label>Minimum Invites</Label>
                            <Input
                              type="number"
                              value={tier.min_invites || 0}
                              onChange={(e) => {
                                const newTiers = [...tiers];
                                newTiers[index].min_invites = parseInt(e.target.value) || 0;
                                setTiers(newTiers);
                              }}
                              min="0"
                            />
                          </div>
                          <div>
                            <Label>Role</Label>
                            <Select
                              value={tier.role_id || ''}
                              onValueChange={(value) => {
                                const newTiers = [...tiers];
                                newTiers[index].role_id = value;
                                setTiers(newTiers);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {roles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    @{role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label>Coins</Label>
                              <Input
                                type="number"
                                value={tier.coins || 0}
                                onChange={(e) => {
                                  const newTiers = [...tiers];
                                  newTiers[index].coins = parseInt(e.target.value) || 0;
                                  setTiers(newTiers);
                                }}
                                min="0"
                              />
                            </div>
                            <div>
                              <Label>XP</Label>
                              <Input
                                type="number"
                                value={tier.xp || 0}
                                onChange={(e) => {
                                  const newTiers = [...tiers];
                                  newTiers[index].xp = parseInt(e.target.value) || 0;
                                  setTiers(newTiers);
                                }}
                                min="0"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-3">
                            <Label htmlFor={`tier-enabled-${index}`}>Enabled</Label>
                            <Switch
                              id={`tier-enabled-${index}`}
                              checked={tier.enabled !== false}
                              onCheckedChange={(checked) => {
                                const newTiers = [...tiers];
                                newTiers[index].enabled = checked;
                                setTiers(newTiers);
                              }}
                            />
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              const newTiers = tiers.filter((_, i) => i !== index);
                              setTiers(newTiers);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTiers([...tiers, {
                          tier_name: '',
                          min_invites: 0,
                          role_id: null,
                          coins: 0,
                          xp: 0,
                          enabled: true,
                          order_index: tiers.length
                        }]);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Tier
                    </Button>
                  </div>
                </Card>

                {/* Settings */}
                <Card className="p-6 space-y-6">
                  <h2 className="text-2xl font-bold">Settings</h2>
                  <Separator />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Minimum Account Age (days)</Label>
                      <Input
                        type="number"
                        value={config.require_min_account_age_days || 0}
                        onChange={(e) => setConfig({ ...config, require_min_account_age_days: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Require accounts to be at least X days old</p>
                    </div>

                    <div>
                      <Label>Minimum Invites Before Rewards</Label>
                      <Input
                        type="number"
                        value={config.require_min_members_invited || 1}
                        onChange={(e) => setConfig({ ...config, require_min_members_invited: parseInt(e.target.value) || 1 })}
                        min="1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Give rewards after X successful invites</p>
                    </div>

                    <div>
                      <Label>Cooldown (hours)</Label>
                      <Input
                        type="number"
                        value={config.cooldown_hours || 0}
                        onChange={(e) => setConfig({ ...config, cooldown_hours: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Hours between rewards for same inviter</p>
                    </div>

                    <div>
                      <Label>Log Channel</Label>
                      <Select
                        value={config.log_channel_id || 'none'}
                        onValueChange={(value) => setConfig({ ...config, log_channel_id: value === 'none' ? null : value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {channels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              #{channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Label htmlFor="ignore-bots">Ignore Bot Invites</Label>
                    <Switch
                      id="ignore-bots"
                      checked={config.ignore_bots !== false}
                      onCheckedChange={(checked) => setConfig({ ...config, ignore_bots: checked })}
                    />
                  </div>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Configuration
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {!config.enabled && (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">Enable the referral system above to configure rewards.</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Top Inviters</h2>
              {stats.length > 0 ? (
                <div className="space-y-2">
                  {stats.map((stat, index) => (
                    <div key={stat.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">#{index + 1}</Badge>
                        <span className="font-medium">User ID: {stat.inviter_user_id}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {stat.total_invites} invites
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {stat.total_rewards_given} rewards
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No referral stats yet.</p>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Recent Referrals</h2>
              {recentReferrals.length > 0 ? (
                <div className="space-y-2">
                  {recentReferrals.map((referral) => (
                    <div key={referral.id} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Inviter: {referral.inviter_user_id}</p>
                          <p className="text-sm text-muted-foreground">New Member: {referral.new_member_user_id}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No recent referrals.</p>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

