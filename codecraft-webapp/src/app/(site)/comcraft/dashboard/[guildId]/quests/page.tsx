'use client';

/**
 * ComCraft - Quests & Missions Management Page
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
import { Trash2, Edit, Plus, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';

interface Quest {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  category: string;
  quest_type: string;
  requirements: any;
  rewards: any;
  reset_type: string;
  reset_time?: string;
  reset_day_of_week?: number;
  enabled: boolean;
  visible: boolean;
  max_completions?: number;
  completion_cooldown_hours?: number;
  chain_id?: string | null;
  chain_position?: number | null;
  difficulty?: string;
  rarity?: string;
  deadline_at?: string | null;
  time_limit_hours?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  milestones?: Array<{ progress: number; rewards: { coins?: number; xp?: number }; message?: string }>;
}

export default function QuestsConfig() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [quests, setQuests] = useState<Quest[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('quests');

  // Quest Chains state
  const [chains, setChains] = useState<any[]>([]);
  const [newChain, setNewChain] = useState({
    name: '',
    description: '',
    emoji: '🔗',
    difficulty: 'normal' as 'easy' | 'normal' | 'hard' | 'expert',
    reward_bonus: 1.0,
    chain_rewards: { coins: 0, xp: 0 },
    enabled: true,
    quest_ids: [] as string[]
  });
  const [editingChain, setEditingChain] = useState<any | null>(null);

  // New quest form
  const [newQuest, setNewQuest] = useState({
    name: '',
    description: '',
    emoji: '📋',
    category: 'general',
    quest_type: 'message_count',
    target: 10,
    coins: 0,
    xp: 0,
    reset_type: 'never',
    reset_time: '00:00',
    reset_day_of_week: 0,
    enabled: true,
    visible: true,
    max_completions: null as number | null,
    completion_cooldown_hours: null as number | null,
    difficulty: 'normal' as 'easy' | 'normal' | 'hard' | 'expert',
    rarity: 'common' as 'common' | 'rare' | 'epic' | 'legendary',
    deadline_at: null as string | null,
    time_limit_hours: null as number | null,
    start_date: null as string | null,
    end_date: null as string | null,
    milestones: [] as Array<{ progress: number; rewards: { coins?: number; xp?: number }; message?: string }>
  });

  // Editing quest
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);

  useEffect(() => {
    if (guildId) {
      fetchQuests();
      fetchAnalytics();
      fetchChains();
    }
  }, [guildId]);

  const fetchQuests = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/quests`);
      if (response.ok) {
        const data = await response.json();
        setQuests(data.quests || []);
      }
    } catch (error) {
      console.error('Error fetching quests:', error);
      toast({
        title: 'Failed to load quests',
        description: 'Could not load quests. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/quests/analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchChains = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/quests/chains`);
      if (response.ok) {
        const data = await response.json();
        setChains(data.chains || []);
      }
    } catch (error) {
      console.error('Error fetching chains:', error);
      toast({
        title: 'Failed to load chains',
        description: 'Could not load quest chains. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const saveChain = async () => {
    setSaving(true);
    try {
      const chainData = {
        name: newChain.name,
        description: newChain.description || null,
        emoji: newChain.emoji,
        difficulty: newChain.difficulty,
        reward_bonus: newChain.reward_bonus,
        chain_rewards: newChain.chain_rewards,
        enabled: newChain.enabled,
        quest_ids: newChain.quest_ids
      };

      const url = `/api/comcraft/guilds/${guildId}/quests/chains`;
      const method = editingChain ? 'PATCH' : 'POST';
      const body = editingChain
        ? { id: editingChain.id, ...chainData }
        : chainData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast({
          title: editingChain ? 'Chain updated' : 'Chain created',
          description: `Quest chain "${newChain.name}" has been ${editingChain ? 'updated' : 'created'} successfully.`,
        });
        
        // Reset form
        setNewChain({
          name: '',
          description: '',
          emoji: '🔗',
          difficulty: 'normal',
          reward_bonus: 1.0,
          chain_rewards: { coins: 0, xp: 0 },
          enabled: true,
          quest_ids: []
        });
        setEditingChain(null);
        fetchChains();
        fetchQuests(); // Refresh quests to show chain assignments
      } else {
        throw new Error('Failed to save chain');
      }
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'Could not save quest chain. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteChain = async (chainId: string) => {
    if (!confirm('Are you sure you want to delete this quest chain? This will unlink all quests from the chain.')) {
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/quests/chains?id=${chainId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Chain deleted',
          description: 'The quest chain has been deleted successfully.',
        });
        fetchChains();
        fetchQuests();
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Could not delete the chain. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const startEditingChain = (chain: any) => {
    setEditingChain(chain);
    setNewChain({
      name: chain.name,
      description: chain.description || '',
      emoji: chain.emoji || '🔗',
      difficulty: (chain.difficulty || 'normal') as 'easy' | 'normal' | 'hard' | 'expert',
      reward_bonus: chain.reward_bonus || 1.0,
      chain_rewards: chain.chain_rewards || { coins: 0, xp: 0 },
      enabled: chain.enabled ?? true,
      quest_ids: chain.quests ? chain.quests.map((q: any) => q.id) : []
    });
    setActiveTab('chains');
  };

  const saveQuest = async () => {
    setSaving(true);
    try {
      const rewards: Record<string, number> = {};
      if (newQuest.coins > 0) {
        rewards.coins = newQuest.coins;
      }
      if (newQuest.xp > 0) {
        rewards.xp = newQuest.xp;
      }

      const questData: any = {
        name: newQuest.name,
        description: newQuest.description || null,
        emoji: newQuest.emoji,
        category: newQuest.category,
        quest_type: newQuest.quest_type,
        requirements: {
          target: newQuest.target
        },
        rewards: rewards,
        reset_type: newQuest.reset_type,
        reset_time: newQuest.reset_type !== 'never' ? newQuest.reset_time : null,
        reset_day_of_week: newQuest.reset_type === 'weekly' ? newQuest.reset_day_of_week : null,
        enabled: newQuest.enabled,
        visible: newQuest.visible,
        max_completions: newQuest.max_completions || null,
        completion_cooldown_hours: newQuest.completion_cooldown_hours || null,
        difficulty: newQuest.difficulty,
        rarity: newQuest.rarity,
        deadline_at: newQuest.deadline_at,
        time_limit_hours: newQuest.time_limit_hours || null,
        start_date: newQuest.start_date,
        end_date: newQuest.end_date,
        milestones: newQuest.milestones.length > 0 ? newQuest.milestones : null
      };

      const url = editingQuest
        ? `/api/comcraft/guilds/${guildId}/quests`
        : `/api/comcraft/guilds/${guildId}/quests`;
      
      const method = editingQuest ? 'PATCH' : 'POST';

      const body = editingQuest
        ? { id: editingQuest.id, ...questData }
        : questData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast({
          title: editingQuest ? 'Quest updated' : 'Quest created',
          description: `Quest "${newQuest.name}" has been ${editingQuest ? 'updated' : 'created'} successfully.`,
        });
        
        // Reset form
        setNewQuest({
          name: '',
          description: '',
          emoji: '📋',
          category: 'general',
          quest_type: 'message_count',
          target: 10,
          coins: 0,
          xp: 0,
          reset_type: 'never',
          reset_time: '00:00',
          reset_day_of_week: 0,
          enabled: true,
          visible: true,
          max_completions: null,
          completion_cooldown_hours: null,
          difficulty: 'normal',
          rarity: 'common',
          deadline_at: null,
          time_limit_hours: null,
          start_date: null,
          end_date: null,
          milestones: []
        });
        setEditingQuest(null);
        fetchQuests();
        fetchAnalytics();
      } else {
        throw new Error('Failed to save quest');
      }
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'Could not save the quest. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteQuest = async (questId: string) => {
    if (!confirm('Are you sure you want to delete this quest? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/quests?id=${questId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Quest deleted',
          description: 'The quest has been deleted successfully.',
        });
        fetchQuests();
        fetchAnalytics();
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Could not delete the quest. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const startEditing = (quest: Quest) => {
    setEditingQuest(quest);
    setNewQuest({
      name: quest.name,
      description: quest.description || '',
      emoji: quest.emoji || '📋',
      category: quest.category || 'general',
      quest_type: quest.quest_type,
      target: quest.requirements?.target || 10,
      coins: quest.rewards?.coins || 0,
      xp: quest.rewards?.xp || 0,
      reset_type: quest.reset_type || 'never',
      reset_time: quest.reset_time || '00:00',
      reset_day_of_week: quest.reset_day_of_week || 0,
      enabled: quest.enabled ?? true,
      visible: quest.visible ?? true,
      max_completions: quest.max_completions || null,
      completion_cooldown_hours: quest.completion_cooldown_hours || null,
      difficulty: ((quest as any).difficulty || 'normal') as 'easy' | 'normal' | 'hard' | 'expert',
      rarity: ((quest as any).rarity || 'common') as 'common' | 'rare' | 'epic' | 'legendary',
      deadline_at: (quest as any).deadline_at || null,
      time_limit_hours: (quest as any).time_limit_hours || null,
      start_date: (quest as any).start_date || null,
      end_date: (quest as any).end_date || null,
      milestones: (quest as any).milestones || []
    });
    setActiveTab('create');
  };

  const formatRewards = (rewards: any) => {
    const parts = [];
    if (rewards?.coins) parts.push(`${rewards.coins} coins`);
    if (rewards?.xp) parts.push(`${rewards.xp} XP`);
    if (rewards?.role_id) parts.push('Role reward');
    if (rewards?.item_id) parts.push('Item reward');
    return parts.join(', ') || 'None';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading quests...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Quests & Missions</h1>
        <p className="text-muted-foreground mt-2">
          Create and manage quests for your server members to complete for rewards.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="quests">Active Quests</TabsTrigger>
          <TabsTrigger value="create">{editingQuest ? 'Edit Quest' : 'Create Quest'}</TabsTrigger>
          <TabsTrigger value="chains">Quest Chains</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="quests" className="space-y-4">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Active Quests</h2>
              <Button onClick={() => {
                setEditingQuest(null);
                setActiveTab('create');
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Quest
              </Button>
            </div>

            {quests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No quests created yet. Create your first quest to get started!
              </div>
            ) : (
              <div className="space-y-4">
                {quests.map((quest) => (
                  <Card key={quest.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{quest.emoji || '📋'}</span>
                          <h3 className="text-lg font-semibold">{quest.name}</h3>
                          <Badge variant={quest.enabled ? 'default' : 'secondary'}>
                            {quest.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          <Badge variant="outline">{quest.category}</Badge>
                          <Badge variant="outline">{quest.quest_type}</Badge>
                        </div>
                        
                        {quest.description && (
                          <p className="text-sm text-muted-foreground mb-2">{quest.description}</p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                          <div>
                            <span className="font-medium">Target:</span>{' '}
                            {quest.requirements?.target || 0}
                          </div>
                          <div>
                            <span className="font-medium">Rewards:</span>{' '}
                            {formatRewards(quest.rewards)}
                          </div>
                          <div>
                            <span className="font-medium">Reset:</span>{' '}
                            {quest.reset_type === 'never' ? 'Never' : 
                             quest.reset_type === 'daily' ? 'Daily' :
                             quest.reset_type === 'weekly' ? 'Weekly' : 'Monthly'}
                          </div>
                          <div>
                            <span className="font-medium">Completions:</span>{' '}
                            {quest.max_completions || 'Unlimited'}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(quest)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteQuest(quest.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingQuest ? 'Edit Quest' : 'Create New Quest'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Quest Name *</Label>
                  <Input
                    id="name"
                    value={newQuest.name}
                    onChange={(e) => setNewQuest({ ...newQuest, name: e.target.value })}
                    placeholder="Send 50 Messages"
                  />
                </div>

                <div>
                  <Label htmlFor="emoji">Emoji</Label>
                  <Input
                    id="emoji"
                    value={newQuest.emoji}
                    onChange={(e) => setNewQuest({ ...newQuest, emoji: e.target.value })}
                    placeholder="📋"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newQuest.description}
                  onChange={(e) => setNewQuest({ ...newQuest, description: e.target.value })}
                  placeholder="Send 50 messages in any channel to complete this quest."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newQuest.category}
                    onValueChange={(value) => setNewQuest({ ...newQuest, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="special">Special</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="quest_type">Quest Type *</Label>
                  <Select
                    value={newQuest.quest_type}
                    onValueChange={(value) => setNewQuest({ ...newQuest, quest_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="message_count">Message Count</SelectItem>
                      <SelectItem value="voice_minutes">Voice Minutes</SelectItem>
                      <SelectItem value="coin_spend">Coin Spend</SelectItem>
                      <SelectItem value="coin_earn">Coin Earn</SelectItem>
                      <SelectItem value="xp_gain">XP Gain</SelectItem>
                      <SelectItem value="level_reach">Level Reach</SelectItem>
                      <SelectItem value="duel_win">Duel Win</SelectItem>
                      <SelectItem value="reaction_count">Reaction Count</SelectItem>
                      <SelectItem value="invite_count">Invite Count</SelectItem>
                      <SelectItem value="channel_visit">Channel Visit</SelectItem>
                      <SelectItem value="role_obtain">Role Obtain</SelectItem>
                      <SelectItem value="stock_profit">Stock Profit</SelectItem>
                      <SelectItem value="command_use">Command Use</SelectItem>
                      <SelectItem value="giveaway_enter">Giveaway Enter</SelectItem>
                      <SelectItem value="ticket_create">Ticket Create</SelectItem>
                      <SelectItem value="custom">Custom (Manual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Difficulty & Rarity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select
                    value={newQuest.difficulty || 'normal'}
                    onValueChange={(value) => setNewQuest({ ...newQuest, difficulty: value as 'easy' | 'normal' | 'hard' | 'expert' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="rarity">Rarity</Label>
                  <Select
                    value={newQuest.rarity || 'common'}
                    onValueChange={(value) => setNewQuest({ ...newQuest, rarity: value as 'common' | 'rare' | 'epic' | 'legendary' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rarity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Timer & Deadlines */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deadline">Deadline (Optional)</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={newQuest.deadline_at ? newQuest.deadline_at.slice(0, 16) : ''}
                    onChange={(e) => setNewQuest({ ...newQuest, deadline_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Quest must be completed before this date</p>
                </div>

                <div>
                  <Label htmlFor="time_limit">Time Limit (hours, Optional)</Label>
                  <Input
                    id="time_limit"
                    type="number"
                    min="1"
                    value={newQuest.time_limit_hours || ''}
                    onChange={(e) => setNewQuest({ ...newQuest, time_limit_hours: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="e.g., 24"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Time limit from when quest is started</p>
                </div>
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date (Optional)</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={newQuest.start_date ? newQuest.start_date.slice(0, 16) : ''}
                    onChange={(e) => setNewQuest({ ...newQuest, start_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">When quest becomes available</p>
                </div>

                <div>
                  <Label htmlFor="end_date">End Date (Optional)</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={newQuest.end_date ? newQuest.end_date.slice(0, 16) : ''}
                    onChange={(e) => setNewQuest({ ...newQuest, end_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">When quest expires</p>
                </div>
              </div>

              <div>
                <Label htmlFor="target">Target Value *</Label>
                <Input
                  id="target"
                  type="number"
                  value={newQuest.target}
                  onChange={(e) => setNewQuest({ ...newQuest, target: parseInt(e.target.value) || 0 })}
                  placeholder="50"
                  min={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The number of actions required to complete this quest.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coins">Coin Reward</Label>
                  <Input
                    id="coins"
                    type="number"
                    value={newQuest.coins}
                    onChange={(e) => setNewQuest({ ...newQuest, coins: parseInt(e.target.value) || 0 })}
                    placeholder="100"
                    min={0}
                  />
                </div>

                <div>
                  <Label htmlFor="xp">XP Reward</Label>
                  <Input
                    id="xp"
                    type="number"
                    value={newQuest.xp}
                    onChange={(e) => setNewQuest({ ...newQuest, xp: parseInt(e.target.value) || 0 })}
                    placeholder="50"
                    min={0}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="reset_type">Reset Type</Label>
                <Select
                  value={newQuest.reset_type}
                  onValueChange={(value) => setNewQuest({ ...newQuest, reset_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never (One-time)</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newQuest.reset_type !== 'never' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="reset_time">Reset Time</Label>
                    <Input
                      id="reset_time"
                      type="time"
                      value={newQuest.reset_time}
                      onChange={(e) => setNewQuest({ ...newQuest, reset_time: e.target.value })}
                    />
                  </div>

                  {newQuest.reset_type === 'weekly' && (
                    <div>
                      <Label htmlFor="reset_day">Day of Week</Label>
                      <Select
                        value={newQuest.reset_day_of_week?.toString()}
                        onValueChange={(value) => setNewQuest({ ...newQuest, reset_day_of_week: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max_completions">Max Completions (optional)</Label>
                  <Input
                    id="max_completions"
                    type="number"
                    value={newQuest.max_completions || ''}
                    onChange={(e) => setNewQuest({ 
                      ...newQuest, 
                      max_completions: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    placeholder="Leave empty for unlimited"
                    min={1}
                  />
                </div>

                <div>
                  <Label htmlFor="cooldown">Cooldown (hours, optional)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    value={newQuest.completion_cooldown_hours || ''}
                    onChange={(e) => setNewQuest({ 
                      ...newQuest, 
                      completion_cooldown_hours: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    placeholder="Hours between completions"
                    min={1}
                  />
                </div>
              </div>

              {/* Milestones Section */}
              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Milestones (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Set milestone rewards that users receive at specific progress percentages (e.g., 25%, 50%, 75%).
                </p>
                <div className="space-y-3">
                  {newQuest.milestones.map((milestone, index) => (
                    <Card key={index} className="p-3">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <Label>Progress %</Label>
                          <Input
                            type="number"
                            min="1"
                            max="99"
                            value={milestone.progress}
                            onChange={(e) => {
                              const updated = [...newQuest.milestones];
                              updated[index].progress = parseInt(e.target.value) || 0;
                              setNewQuest({ ...newQuest, milestones: updated });
                            }}
                            placeholder="25"
                          />
                        </div>
                        <div className="col-span-3">
                          <Label>Coins</Label>
                          <Input
                            type="number"
                            min="0"
                            value={milestone.rewards?.coins || 0}
                            onChange={(e) => {
                              const updated = [...newQuest.milestones];
                              if (!updated[index].rewards) updated[index].rewards = {};
                              updated[index].rewards.coins = parseInt(e.target.value) || 0;
                              setNewQuest({ ...newQuest, milestones: updated });
                            }}
                            placeholder="0"
                          />
                        </div>
                        <div className="col-span-3">
                          <Label>XP</Label>
                          <Input
                            type="number"
                            min="0"
                            value={milestone.rewards?.xp || 0}
                            onChange={(e) => {
                              const updated = [...newQuest.milestones];
                              if (!updated[index].rewards) updated[index].rewards = {};
                              updated[index].rewards.xp = parseInt(e.target.value) || 0;
                              setNewQuest({ ...newQuest, milestones: updated });
                            }}
                            placeholder="0"
                          />
                        </div>
                        <div className="col-span-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = newQuest.milestones.filter((_, i) => i !== index);
                              setNewQuest({ ...newQuest, milestones: updated });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewQuest({
                        ...newQuest,
                        milestones: [...newQuest.milestones, { progress: 25, rewards: { coins: 0, xp: 0 } }]
                      });
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Milestone
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="enabled"
                    checked={newQuest.enabled}
                    onCheckedChange={(checked) => setNewQuest({ ...newQuest, enabled: checked })}
                  />
                  <Label htmlFor="enabled">Enabled</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="visible"
                    checked={newQuest.visible}
                    onCheckedChange={(checked) => setNewQuest({ ...newQuest, visible: checked })}
                  />
                  <Label htmlFor="visible">Visible to Users</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={saveQuest} disabled={saving || !newQuest.name || !newQuest.quest_type}>
                  {saving ? 'Saving...' : editingQuest ? 'Update Quest' : 'Create Quest'}
                </Button>
                {editingQuest && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingQuest(null);
                      setNewQuest({
                        name: '',
                        description: '',
                        emoji: '📋',
                        category: 'general',
                        quest_type: 'message_count',
                        target: 10,
                        coins: 0,
                        xp: 0,
                        reset_type: 'never',
                        reset_time: '00:00',
                        reset_day_of_week: 0,
                        enabled: true,
                        visible: true,
                        max_completions: null,
                        completion_cooldown_hours: null,
                        difficulty: 'normal',
                        rarity: 'common',
                        deadline_at: null,
                        time_limit_hours: null,
                        start_date: null,
                        end_date: null,
                        milestones: []
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="chains" className="space-y-4">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Quest Chains</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Link multiple quests together. Users must complete quests in order to unlock the next quest in the chain.
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditingChain(null);
                  setNewChain({
                    name: '',
                    description: '',
                    emoji: '🔗',
                    difficulty: 'normal',
                    reward_bonus: 1.0,
                    chain_rewards: { coins: 0, xp: 0 },
                    enabled: true,
                    quest_ids: []
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Chain
              </Button>
            </div>

            {chains.length === 0 && !editingChain ? (
              <div className="text-center py-8 text-muted-foreground">
                No quest chains created yet. Create your first chain to link quests together!
              </div>
            ) : editingChain || newChain.name || newChain.quest_ids.length > 0 ? (
              <div className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="chain_name">Chain Name *</Label>
                    <Input
                      id="chain_name"
                      value={newChain.name}
                      onChange={(e) => setNewChain({ ...newChain, name: e.target.value })}
                      placeholder="Beginner Quest Line"
                    />
                  </div>
                  <div>
                    <Label htmlFor="chain_emoji">Emoji</Label>
                    <Input
                      id="chain_emoji"
                      value={newChain.emoji}
                      onChange={(e) => setNewChain({ ...newChain, emoji: e.target.value })}
                      placeholder="🔗"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="chain_description">Description</Label>
                  <Textarea
                    id="chain_description"
                    value={newChain.description}
                    onChange={(e) => setNewChain({ ...newChain, description: e.target.value })}
                    placeholder="A series of quests for new players to complete."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="chain_difficulty">Difficulty</Label>
                    <Select
                      value={newChain.difficulty}
                      onValueChange={(value) => setNewChain({ ...newChain, difficulty: value as 'easy' | 'normal' | 'hard' | 'expert' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="reward_bonus">Reward Bonus Multiplier</Label>
                    <Input
                      id="reward_bonus"
                      type="number"
                      step="0.1"
                      min="1"
                      value={newChain.reward_bonus}
                      onChange={(e) => setNewChain({ ...newChain, reward_bonus: parseFloat(e.target.value) || 1.0 })}
                      placeholder="1.0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Multiplier for completing entire chain (e.g., 1.5 = 50% bonus)</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-base font-semibold">Chain Completion Rewards (Optional)</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Additional rewards given when a user completes the entire chain.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Coins</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newChain.chain_rewards.coins || 0}
                        onChange={(e) => setNewChain({
                          ...newChain,
                          chain_rewards: { ...newChain.chain_rewards, coins: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>XP</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newChain.chain_rewards.xp || 0}
                        onChange={(e) => setNewChain({
                          ...newChain,
                          chain_rewards: { ...newChain.chain_rewards, xp: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-base font-semibold">Quest Order *</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select quests in the order they should be completed. Drag to reorder.
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3">
                    {newChain.quest_ids.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No quests selected. Select quests below to add them to the chain.
                      </div>
                    ) : (
                      newChain.quest_ids.map((questId, index) => {
                        const quest = quests.find(q => q.id === questId);
                        if (!quest) return null;
                        return (
                          <div key={questId} className="flex items-center gap-2 p-2 bg-muted rounded">
                            <span className="text-sm font-medium w-6">{index + 1}.</span>
                            <span className="text-lg">{quest.emoji}</span>
                            <span className="flex-1 text-sm">{quest.name}</span>
                            <div className="flex gap-1">
                              {index > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...newChain.quest_ids];
                                    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
                                    setNewChain({ ...newChain, quest_ids: updated });
                                  }}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                              )}
                              {index < newChain.quest_ids.length - 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = [...newChain.quest_ids];
                                    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
                                    setNewChain({ ...newChain, quest_ids: updated });
                                  }}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setNewChain({
                                    ...newChain,
                                    quest_ids: newChain.quest_ids.filter(id => id !== questId)
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="mt-3">
                    <Label>Available Quests</Label>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value && !newChain.quest_ids.includes(value)) {
                          setNewChain({
                            ...newChain,
                            quest_ids: [...newChain.quest_ids, value]
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a quest to add to chain..." />
                      </SelectTrigger>
                      <SelectContent>
                        {quests
                          .filter(q => !newChain.quest_ids.includes(q.id) && !q.chain_id)
                          .map((quest) => (
                            <SelectItem key={quest.id} value={quest.id}>
                              {quest.emoji} {quest.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="chain_enabled"
                      checked={newChain.enabled}
                      onCheckedChange={(checked) => setNewChain({ ...newChain, enabled: checked })}
                    />
                    <Label htmlFor="chain_enabled">Enabled</Label>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={saveChain}
                    disabled={saving || !newChain.name || newChain.quest_ids.length === 0}
                  >
                    {saving ? 'Saving...' : editingChain ? 'Update Chain' : 'Create Chain'}
                  </Button>
                  {(editingChain || newChain.name) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingChain(null);
                        setNewChain({
                          name: '',
                          description: '',
                          emoji: '🔗',
                          difficulty: 'normal',
                          reward_bonus: 1.0,
                          chain_rewards: { coins: 0, xp: 0 },
                          enabled: true,
                          quest_ids: []
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {chains.map((chain) => (
                  <Card key={chain.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{chain.emoji || '🔗'}</span>
                          <h3 className="text-lg font-semibold">{chain.name}</h3>
                          <Badge variant={chain.enabled ? 'default' : 'secondary'}>
                            {chain.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {chain.difficulty && (
                            <Badge variant={
                              chain.difficulty === 'easy' ? 'default' :
                              chain.difficulty === 'normal' ? 'secondary' :
                              chain.difficulty === 'hard' ? 'destructive' : 'outline'
                            }>
                              {chain.difficulty}
                            </Badge>
                          )}
                        </div>
                        
                        {chain.description && (
                          <p className="text-sm text-muted-foreground mb-2">{chain.description}</p>
                        )}

                        <div className="text-sm space-y-1">
                          <div>
                            <span className="font-medium">Quests:</span> {chain.total_quests || (chain.quests?.length || 0)}
                          </div>
                          {chain.reward_bonus && chain.reward_bonus > 1.0 && (
                            <div>
                              <span className="font-medium">Reward Bonus:</span> {((chain.reward_bonus - 1) * 100).toFixed(0)}%
                            </div>
                          )}
                          {chain.chain_rewards && (chain.chain_rewards.coins > 0 || chain.chain_rewards.xp > 0) && (
                            <div>
                              <span className="font-medium">Completion Rewards:</span>{' '}
                              {chain.chain_rewards.coins > 0 && `${chain.chain_rewards.coins} coins`}
                              {chain.chain_rewards.coins > 0 && chain.chain_rewards.xp > 0 && ' + '}
                              {chain.chain_rewards.xp > 0 && `${chain.chain_rewards.xp} XP`}
                            </div>
                          )}
                        </div>

                        {chain.quests && chain.quests.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted-foreground mb-1">Quest Order:</div>
                            <div className="flex flex-wrap gap-1">
                              {chain.quests
                                .sort((a: any, b: any) => (a.chain_position || 0) - (b.chain_position || 0))
                                .map((quest: any, idx: number) => (
                                  <Badge key={quest.id} variant="outline" className="text-xs">
                                    {idx + 1}. {quest.name}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingChain(chain)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteChain(chain.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Quest Analytics</h2>
            </div>

            {analytics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Total Quests</div>
                    <div className="text-2xl font-bold">{analytics.total_quests || 0}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Active Quests</div>
                    <div className="text-2xl font-bold">{analytics.active_quests || 0}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground">Total Completions</div>
                    <div className="text-2xl font-bold">{analytics.total_completions || 0}</div>
                  </Card>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Quest Performance</h3>
                  <div className="space-y-2">
                    {analytics.quest_stats && analytics.quest_stats.length > 0 ? (
                      analytics.quest_stats.map((stat: any) => (
                        <Card key={stat.quest_id} className="p-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-medium">{stat.quest_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {stat.category} • {stat.quest_type}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{stat.total_completions} completions</div>
                              {stat.last_completion && (
                                <div className="text-xs text-muted-foreground">
                                  Last: {new Date(stat.last_completion).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No completion data available yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Loading analytics...
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

