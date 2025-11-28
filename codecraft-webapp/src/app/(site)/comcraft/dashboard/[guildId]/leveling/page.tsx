'use client';

/**
 * Comcraft - Leveling Configuration Page
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export default function LevelingConfig() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();
  
  const [config, setConfig] = useState<any>({});
  const [rewards, setRewards] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New reward form
  const [newReward, setNewReward] = useState({
    level: 5,
    role_id: '',
    message: ''
  });

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/leveling`);
      const data = await response.json();
      setConfig(data.config || {});
      setRewards(data.rewards || []);
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leveling data:', error);
      toast({
        title: 'Failed to load data',
        description: 'We could not load the leveling configuration. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/leveling`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        toast({
          title: 'Changes saved',
          description: 'Your leveling configuration has been updated successfully.',
        });
      }
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'We could not save the configuration. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const addReward = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/rewards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: newReward.level,
          reward_type: 'role',
          role_id: newReward.role_id,
          message: newReward.message || null
        })
      });

      if (response.ok) {
        toast({
          title: 'Reward created',
          description: `Level ${newReward.level} reward has been added.`,
        });
        fetchData(); // Refresh
        setNewReward({ level: 5, role_id: '', message: '' });
      }
    } catch (error) {
      toast({
        title: 'Create failed',
        description: 'We could not add this reward. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const xpMin = config?.xp_min ?? 15;
  const xpMax = config?.xp_max ?? 25;
  const xpCooldown = config?.xp_cooldown ?? 60;
  const levelupEnabled = config?.levelup_message_enabled ?? false;
  const rewardsCount = rewards.length;
  const leaderboardCount = leaderboard.length;

  const deleteReward = async (rewardId: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/rewards?id=${rewardId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Reward deleted',
          description: 'The reward has been removed.',
        });
        fetchData();
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'We could not remove this reward. Please try again.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>← Back to Overview</Link>
        </Button>

        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                    📊
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
                    Leveling Control Center
                  </h1>
                  <p className="text-muted-foreground max-w-xl">
                    Fine-tune XP gain, automate reward roles and monitor the most active members in your community.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge className="bg-primary/10 text-primary px-4 py-2 border-0">XP Range: {xpMin} – {xpMax}</Badge>
                <Badge variant="outline" className="px-4 py-2">Cooldown: {xpCooldown}s</Badge>
                <Badge variant="outline" className="px-4 py-2">{rewardsCount} rewards • {leaderboardCount} leaderboard entries</Badge>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-2 shadow-lg p-5 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <div className="text-2xl mb-2">⚡</div>
            <p className="text-sm text-muted-foreground">XP per message</p>
            <p className="text-2xl font-bold">{xpMin} – {xpMax}</p>
          </Card>
          <Card className="border-2 shadow-lg p-5 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <div className="text-2xl mb-2">⏱️</div>
            <p className="text-sm text-muted-foreground">Cooldown</p>
            <p className="text-2xl font-bold">{xpCooldown}s</p>
          </Card>
          <Card className="border-2 shadow-lg p-5 bg-gradient-to-br from-green-500/10 to-green-500/5">
            <div className="text-2xl mb-2">🎁</div>
            <p className="text-sm text-muted-foreground">Active rewards</p>
            <p className="text-2xl font-bold">{rewardsCount}</p>
          </Card>
          <Card className="border-2 shadow-lg p-5 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
            <div className="text-2xl mb-2">💬</div>
            <p className="text-sm text-muted-foreground">Level-up messages</p>
            <p className="text-2xl font-bold">{levelupEnabled ? 'Enabled' : 'Disabled'}</p>
          </Card>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="w-full grid grid-cols-3 bg-muted/50 p-2 rounded-lg">
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Settings
            </TabsTrigger>
            <TabsTrigger value="rewards" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Rewards
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">XP Settings</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Minimum XP per message</Label>
                  <Input 
                    type="number"
                    value={config?.xp_min ?? 15}
                    onChange={(e) => setConfig({...config, xp_min: parseInt(e.target.value)})}
                    min={1}
                    max={100}
                  />
                  <p className="text-sm text-muted-foreground">
                    Default: 15 XP
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Maximum XP per message</Label>
                  <Input 
                    type="number"
                    value={config?.xp_max ?? 25}
                    onChange={(e) => setConfig({...config, xp_max: parseInt(e.target.value)})}
                    min={1}
                    max={100}
                  />
                  <p className="text-sm text-muted-foreground">
                    Default: 25 XP
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>XP cooldown (seconds)</Label>
                  <Input 
                    type="number"
                    value={config?.xp_cooldown ?? 60}
                    onChange={(e) => setConfig({...config, xp_cooldown: parseInt(e.target.value)})}
                    min={30}
                    max={300}
                  />
                  <p className="text-sm text-muted-foreground">
                    Prevents XP spam. Default: 60 seconds.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>
                    <input 
                      type="checkbox"
                      checked={config?.levelup_message_enabled || false}
                      onChange={(e) => setConfig({...config, levelup_message_enabled: e.target.checked})}
                      className="mr-2"
                    />
                    Level-up notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Send a message whenever a member levels up.
                  </p>
                </div>
              </div>
            </Card>

            {config?.levelup_message_enabled && (
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-6">Level-up Message</h2>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Message template</Label>
                    <Input 
                      value={config?.levelup_message_template || 'Congrats {user}! You just reached level {level}!'}
                      onChange={(e) => setConfig({...config, levelup_message_template: e.target.value})}
                      placeholder="Congrats {user}! You just reached level {level}!"
                    />
                    <p className="text-sm text-muted-foreground">
                      Available variables: {'{user}'}, {'{username}'}, {'{level}'}, {'{xp}'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      <input 
                        type="checkbox"
                        checked={config?.levelup_dm_enabled || false}
                        onChange={(e) => setConfig({...config, levelup_dm_enabled: e.target.checked})}
                        className="mr-2"
                      />
                      Send the message as a DM too
                    </Label>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button onClick={fetchData} variant="outline" disabled={saving}>
                Reset
              </Button>
              <Button onClick={saveConfig} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save'}
              </Button>
            </div>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Level Rewards</h2>
              <p className="text-muted-foreground mb-6">
                Automatically grant roles or send custom messages when members reach specific milestones.
              </p>

              {/* Add New Reward */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-4">Add New Reward</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Input 
                      type="number"
                      value={newReward.level}
                      onChange={(e) => setNewReward({...newReward, level: parseInt(e.target.value)})}
                      min={1}
                      max={999}
                      placeholder="5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Role ID</Label>
                    <Input 
                      value={newReward.role_id}
                      onChange={(e) => setNewReward({...newReward, role_id: e.target.value})}
                      placeholder="123456789012345678"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Custom message (optional)</Label>
                    <Input 
                      value={newReward.message}
                      onChange={(e) => setNewReward({...newReward, message: e.target.value})}
                      placeholder="You just unlocked a new role!"
                    />
                  </div>
                </div>
                <Button onClick={addReward} className="mt-4">
                  ➕ Add
                </Button>
              </div>

              {/* Rewards List */}
              <div className="space-y-3">
                {rewards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No rewards configured yet.
                  </div>
                ) : (
                  rewards.map((reward) => (
                    <div key={reward.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge className="bg-blue-600">Level {reward.level}</Badge>
                        <div>
                          <div className="font-semibold">Role ID: {reward.role_id}</div>
                          {reward.message && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              "{reward.message}"
                            </div>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteReward(reward.id)}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">🏆 Server Leaderboard</h2>
              
              {leaderboard.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leaderboard data yet. Engage your community to fill this board!
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((user, index) => (
                    <div key={user.id || index} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="text-2xl font-bold w-8">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                        {user.username?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{user.username || 'Unknown User'}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.total_messages || 0} messages
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">Level {user.level || 1}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {(user.xp || 0).toLocaleString()} XP
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

