'use client';

/**
 * Admin: Subscription Tiers Management
 * Manage pricing, features, and limits for all subscription tiers
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, DollarSign, Check, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface SubscriptionTier {
  id: string;
  tier_name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  sort_order: number;
  is_active: boolean;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

interface FeatureDefinition {
  id: string;
  label: string;
  description: string;
  defaultEnabled?: boolean;
  requiredTier?: string;
}

interface LimitDefinition {
  id: string;
  label: string;
  description: string;
  defaultValue: number;
  step?: number;
  min?: number;
  allowUnlimited?: boolean;
}

const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    id: 'leveling',
    label: 'Leveling system',
    description: 'Enable XP gain, leaderboards, and level-up rewards for members.',
    defaultEnabled: true,
  },
  {
    id: 'welcome',
    label: 'Welcome flows',
    description: 'Send automated welcome messages and onboarding embeds to newcomers.',
    defaultEnabled: false,
  },
  {
    id: 'analytics',
    label: 'Analytics dashboard',
    description: 'Unlock guild analytics dashboards and reporting widgets.',
    defaultEnabled: false,
  },
  {
    id: 'moderation_basic',
    label: 'Moderation (basic)',
    description: 'Warn, mute, and kick commands plus logging of basic moderation actions.',
    defaultEnabled: true,
  },
  {
    id: 'moderation_advanced',
    label: 'Moderation (advanced)',
    description: 'Enable auto-mod filters, case management, and advanced moderation tooling.',
    defaultEnabled: false,
    requiredTier: 'Basic',
  },
  {
    id: 'custom_branding',
    label: 'Custom branding',
    description: 'Allow custom bot name, avatar, and embed footer styling per guild.',
    defaultEnabled: false,
  },
  {
    id: 'support_tickets',
    label: 'Support tickets',
    description: 'Provide the full ticket system (panels, transcripts, statistics).',
    defaultEnabled: false,
    requiredTier: 'Basic',
  },
  {
    id: 'birthday_manager',
    label: 'Birthday manager',
    description: 'Track member birthdays and send scheduled celebration announcements.',
    defaultEnabled: false,
  },
  {
    id: 'feedback_queue',
    label: 'Feedback queue',
    description: 'Unlock the music/feedback submission queue with moderation workflow.',
    defaultEnabled: false,
  },
  {
    id: 'auto_roles',
    label: 'Auto roles',
    description: 'Self-assigned roles via menus, buttons, or reactions.',
    defaultEnabled: true,
  },
  {
    id: 'giveaways',
    label: 'Giveaways',
    description: 'Run automated giveaways with scheduled endings and random winner selection.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'ai_assistant',
    label: 'AI assistant',
    description: 'Unlock the AI moderator and Q&A assistant with persona controls and knowledge base.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'embed_builder',
    label: 'Embed builder',
    description: 'Allow scheduling and posting custom embeds from the dashboard.',
    defaultEnabled: false,
  },
  {
    id: 'economy',
    label: 'Economy system',
    description: 'Enable coin economy with daily rewards, payments, and XP conversion.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'casino',
    label: 'Casino games',
    description: 'Unlock casino games: dice, slots, coinflip, and blackjack with betting system.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'pvp_duels',
    label: 'PvP Duels',
    description: 'Enable player vs player combat duels with coin betting and animated battles.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'stock_market',
    label: 'Stock Market',
    description: 'Complete stock trading system with limit orders, alerts, dividends, and market events.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'user_statistics',
    label: 'User Statistics',
    description: 'Comprehensive user activity tracking with beautiful stats cards, voice tracking, and analytics.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'game_news',
    label: 'Game News',
    description: 'Automatic game updates for League of Legends, Valorant, Fortnite, Minecraft, and CS2.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'auto_reactions',
    label: 'Auto Reactions',
    description: 'Automatically react with emojis when trigger words are detected in messages.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'cam_only_voice',
    label: 'Cam-Only Voice Channels',
    description: 'Enforce camera requirements in specific voice channels with grace periods and warnings.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
  {
    id: 'streaming_twitch',
    label: 'Twitch Streaming',
    description: 'Twitch live stream notifications and subscriber notifications with EventSub integration.',
    defaultEnabled: false,
    requiredTier: 'Basic',
  },
  {
    id: 'streaming_youtube',
    label: 'YouTube Streaming',
    description: 'YouTube live stream and video upload notifications.',
    defaultEnabled: false,
    requiredTier: 'Basic',
  },
  {
    id: 'rank_xp_multipliers',
    label: 'Rank XP Multipliers',
    description: 'Set custom XP multipliers for specific Discord roles to reward VIP members or staff.',
    defaultEnabled: false,
    requiredTier: 'Premium',
  },
];

const LIMIT_DEFINITIONS: LimitDefinition[] = [
  {
    id: 'custom_commands',
    label: 'Custom commands',
    description: 'Maximum number of custom commands a guild can create (-1 for unlimited).',
    defaultValue: 5,
    step: 1,
    allowUnlimited: true,
    min: -1,
  },
  {
    id: 'stream_notifications',
    label: 'Stream notifications',
    description: 'How many streamer notification feeds are allowed (-1 for unlimited).',
    defaultValue: 1,
    step: 1,
    allowUnlimited: true,
    min: -1,
  },
  {
    id: 'xp_boost',
    label: 'XP boost multiplier',
    description: 'Multiplier applied to XP gain for the leveling system (e.g. 1.5).',
    defaultValue: 1,
    step: 0.1,
    min: 0,
  },
  {
    id: 'ai_tokens_monthly',
    label: 'AI tokens per month',
    description: 'Maximum number of AI tokens this tier can spend each calendar month (-1 for unlimited).',
    defaultValue: 50000,
    step: 1000,
    allowUnlimited: true,
    min: -1,
  },
  {
    id: 'ai_system_prompt_chars',
    label: 'AI System Prompt Characters',
    description: 'Maximum number of characters allowed in the AI system prompt (e.g. 15000).',
    defaultValue: 15000,
    step: 1000,
    allowUnlimited: false,
    min: 1000,
  },
];

export default function SubscriptionTiersAdmin() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Vote rewards state
  const [voteRewardsConfig, setVoteRewardsConfig] = useState({
    points_per_vote: 1,
    points_per_weekend_vote: 2,
    is_active: true
  });
  const [tierVoteConfigs, setTierVoteConfigs] = useState<Record<string, { points_per_day: number; is_active: boolean }>>({});
  const [editingTierVoteConfig, setEditingTierVoteConfig] = useState<{ tierId: string; points_per_day: number } | null>(null);

  useEffect(() => {
    fetchTiers();
    fetchVoteRewardsConfig();
    fetchTierVoteConfigs();
  }, []);

  async function fetchVoteRewardsConfig() {
    try {
      const response = await fetch('/api/admin/vote-rewards/config');
      const data = await response.json();
      if (data.success && data.config) {
        setVoteRewardsConfig(data.config);
      }
    } catch (error) {
      console.error('Error fetching vote rewards config:', error);
    }
  }

  async function fetchTierVoteConfigs() {
    try {
      const response = await fetch('/api/admin/vote-rewards/tier-configs');
      const data = await response.json();
      if (data.success && data.tiers) {
        const configs: Record<string, { points_per_day: number; is_active: boolean }> = {};
        data.tiers.forEach((item: any) => {
          if (item.config) {
            configs[item.tier.id] = {
              points_per_day: item.config.points_per_day,
              is_active: item.config.is_active
            };
          }
        });
        setTierVoteConfigs(configs);
      }
    } catch (error) {
      console.error('Error fetching tier vote configs:', error);
    }
  }

  async function saveVoteRewardsConfig() {
    try {
      const response = await fetch('/api/admin/vote-rewards/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voteRewardsConfig)
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Vote rewards configuration saved'
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save vote rewards config',
        variant: 'destructive'
      });
    }
  }

  async function saveTierVoteConfig(tierId: string, pointsPerDay: number) {
    try {
      const response = await fetch(`/api/admin/vote-rewards/tier-configs/${tierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points_per_day: pointsPerDay })
      });
      const data = await response.json();
      if (data.success) {
        setTierVoteConfigs(prev => ({
          ...prev,
          [tierId]: { points_per_day: pointsPerDay, is_active: true }
        }));
        toast({
          title: 'Success',
          description: 'Tier vote rewards configuration saved'
        });
        setEditingTierVoteConfig(null);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save tier config',
        variant: 'destructive'
      });
    }
  }

  async function fetchTiers() {
    try {
      const response = await fetch('/api/admin/subscription-tiers');
      const data = await response.json();

      if (!response.ok) {
        console.error('API Error:', data);
        toast({
          title: 'Error',
          description: data.error || data.details || 'Failed to load subscription tiers',
          variant: 'destructive'
        });
        setTiers([]);
        return;
      }

      if (data.success) {
        setTiers(data.tiers || []);
      } else {
        console.error('Unexpected response:', data);
        setTiers([]);
      }
    } catch (error) {
      console.error('Error fetching tiers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription tiers',
        variant: 'destructive'
      });
      setTiers([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveTier(tierData: Partial<SubscriptionTier>) {
    try {
      const isEdit = !!tierData.id;
      const url = isEdit
        ? `/api/admin/subscription-tiers/${tierData.id}`
        : '/api/admin/subscription-tiers';

      const response = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tierData)
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `Tier ${isEdit ? 'updated' : 'created'} successfully`
        });
        fetchTiers();
        setIsDialogOpen(false);
        setEditingTier(null);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save tier',
        variant: 'destructive'
      });
    }
  }

  async function deleteTier(tierId: string) {
    if (!confirm('Are you sure you want to deactivate this tier?')) return;

    try {
      const response = await fetch(`/api/admin/subscription-tiers/${tierId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Tier deactivated successfully'
        });
        fetchTiers();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete tier',
        variant: 'destructive'
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Subscription Tiers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage pricing and features for all subscription tiers
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTier(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTier ? 'Edit Tier' : 'Add New Tier'}
              </DialogTitle>
              <DialogDescription>
                Configure pricing, features, and limits for this subscription tier
              </DialogDescription>
            </DialogHeader>
            <TierForm
              tier={editingTier}
              onSave={saveTier}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingTier(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Vote Rewards Configuration */}
      <Card className="p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Vote Rewards Configuration</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="points_per_vote">Points per Vote</Label>
            <Input
              id="points_per_vote"
              type="number"
              min="0"
              value={voteRewardsConfig.points_per_vote}
              onChange={(e) => setVoteRewardsConfig(prev => ({
                ...prev,
                points_per_vote: parseInt(e.target.value) || 0
              }))}
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Points users receive for each vote on Top.gg
            </p>
          </div>
          <div>
            <Label htmlFor="points_per_weekend_vote">Points per Weekend Vote</Label>
            <Input
              id="points_per_weekend_vote"
              type="number"
              min="0"
              value={voteRewardsConfig.points_per_weekend_vote}
              onChange={(e) => setVoteRewardsConfig(prev => ({
                ...prev,
                points_per_weekend_vote: parseInt(e.target.value) || 0
              }))}
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Points users receive for weekend votes (bonus)
            </p>
          </div>
        </div>
        <Button onClick={saveVoteRewardsConfig}>
          Save Vote Rewards Config
        </Button>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => (
          <Card key={tier.id} className={`p-6 ${!tier.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold mb-1">{tier.display_name}</h3>
                <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                  {tier.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingTier(tier);
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteTier(tier.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {tier.description}
            </p>

            <div className="mb-4 pb-4 border-b">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold">
                  {tier.currency === 'EUR' ? '€' : '$'}{tier.price_monthly}
                </span>
                <span className="text-gray-600">/month</span>
              </div>
              {tier.price_yearly > 0 && (
                <div className="text-sm text-gray-600">
                  or {tier.currency === 'EUR' ? '€' : '$'}{tier.price_yearly}/year
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold mb-2">Features</div>
                {Object.entries(tier.features).map(([key, value]) => {
                  // Find feature definition for better label
                  const featureDef = FEATURE_DEFINITIONS.find(f => f.id === key);
                  const label = featureDef?.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm mb-1">
                      {value ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-gray-400" />
                      )}
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Limits</div>
                {Object.entries(tier.limits).map(([key, value]) => (
                  <div key={key} className="text-sm text-gray-600 mb-1">
                    {key.replace(/_/g, ' ')}: <strong>{value === -1 ? '∞' : value}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Vote Rewards Configuration */}
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm font-semibold mb-2">Vote Rewards</div>
              {editingTierVoteConfig?.tierId === tier.id ? (
                <div className="space-y-2">
                  <Input
                    type="number"
                    min="0"
                    placeholder="Points per day"
                    value={editingTierVoteConfig.points_per_day}
                    onChange={(e) => setEditingTierVoteConfig(prev => prev ? {
                      ...prev,
                      points_per_day: parseInt(e.target.value) || 0
                    } : null)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveTierVoteConfig(tier.id, editingTierVoteConfig.points_per_day)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingTierVoteConfig(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {tierVoteConfigs[tier.id] ? (
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>{tierVoteConfigs[tier.id].points_per_day}</strong> points per day
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 mb-2">Not configured</div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingTierVoteConfig({
                      tierId: tier.id,
                      points_per_day: tierVoteConfigs[tier.id]?.points_per_day || 0
                    })}
                  >
                    {tierVoteConfigs[tier.id] ? 'Edit' : 'Configure'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TierForm({ 
  tier, 
  onSave, 
  onCancel 
}: { 
  tier: SubscriptionTier | null; 
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const buildInitialState = useCallback((sourceTier: SubscriptionTier | null) => {
    const baseFields = {
      tier_name: sourceTier?.tier_name || '',
      display_name: sourceTier?.display_name || '',
      description: sourceTier?.description || '',
      price_monthly: sourceTier?.price_monthly || 0,
      price_yearly: sourceTier?.price_yearly || 0,
      currency: sourceTier?.currency || 'EUR',
      sort_order: sourceTier?.sort_order || 0,
    };

    const sourceFeatures = sourceTier?.features || {};
    const sourceLimits = sourceTier?.limits || {};

    const featureSettings = FEATURE_DEFINITIONS.reduce<Record<string, boolean>>((acc, def) => {
      const raw = sourceFeatures[def.id];
      if (typeof raw === 'boolean') {
        acc[def.id] = raw;
      } else if (typeof raw === 'number') {
        acc[def.id] = raw > 0;
      } else {
        acc[def.id] = def.defaultEnabled ?? false;
      }
      return acc;
    }, {});

    const limitValues = LIMIT_DEFINITIONS.reduce<Record<string, string>>((acc, def) => {
      let value: number | undefined = typeof sourceLimits[def.id] === 'number' ? sourceLimits[def.id] : undefined;

      if (typeof value !== 'number') {
        const fallback = sourceFeatures[def.id];
        if (typeof fallback === 'number') {
          value = fallback;
        }
      }

      if (typeof value !== 'number' || Number.isNaN(value)) {
        value = def.defaultValue;
      }

      acc[def.id] = value.toString();
      return acc;
    }, {});

    const customFeatureEntries: Record<string, unknown> = { ...sourceFeatures };
    FEATURE_DEFINITIONS.forEach((def) => {
      delete customFeatureEntries[def.id];
    });
    LIMIT_DEFINITIONS.forEach((def) => {
      delete customFeatureEntries[def.id];
    });

    const customLimitEntries: Record<string, unknown> = { ...sourceLimits };
    LIMIT_DEFINITIONS.forEach((def) => {
      delete customLimitEntries[def.id];
    });

    const customFeaturesText = JSON.stringify(
      Object.keys(customFeatureEntries).length ? customFeatureEntries : {},
      null,
      2
    );
    const customLimitsText = JSON.stringify(
      Object.keys(customLimitEntries).length ? customLimitEntries : {},
      null,
      2
    );

    return {
      baseFields,
      featureSettings,
      limitValues,
      customFeaturesText,
      customLimitsText,
    };
  }, []);

  const initialState = useMemo(() => buildInitialState(tier), [tier, buildInitialState]);

  const [formData, setFormData] = useState(initialState.baseFields);
  const [featureSettings, setFeatureSettings] = useState<Record<string, boolean>>(initialState.featureSettings);
  const [limitInputs, setLimitInputs] = useState<Record<string, string>>(initialState.limitValues);
  const [customFeaturesText, setCustomFeaturesText] = useState(initialState.customFeaturesText);
  const [customLimitsText, setCustomLimitsText] = useState(initialState.customLimitsText);
  const [customFeaturesError, setCustomFeaturesError] = useState<string | null>(null);
  const [customLimitsError, setCustomLimitsError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(initialState.baseFields);
    setFeatureSettings(initialState.featureSettings);
    setLimitInputs(initialState.limitValues);
    setCustomFeaturesText(initialState.customFeaturesText);
    setCustomLimitsText(initialState.customLimitsText);
    setCustomFeaturesError(null);
    setCustomLimitsError(null);
  }, [initialState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;

    let parsedCustomFeatures: Record<string, unknown> = {};
    let parsedCustomLimits: Record<string, unknown> = {};

    const trimmedFeatures = customFeaturesText.trim();
    const trimmedLimits = customLimitsText.trim();

    try {
      if (trimmedFeatures.length > 0) {
        const parsed = JSON.parse(trimmedFeatures);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedCustomFeatures = parsed;
          setCustomFeaturesError(null);
        } else {
          throw new Error('Features JSON must be an object.');
        }
      } else {
        parsedCustomFeatures = {};
        setCustomFeaturesError(null);
      }
    } catch (error) {
      setCustomFeaturesError('Ongeldige JSON voor extra features.');
      hasError = true;
    }

    try {
      if (trimmedLimits.length > 0) {
        const parsed = JSON.parse(trimmedLimits);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedCustomLimits = parsed;
          setCustomLimitsError(null);
        } else {
          throw new Error('Limits JSON must be an object.');
        }
      } else {
        parsedCustomLimits = {};
        setCustomLimitsError(null);
      }
    } catch (error) {
      setCustomLimitsError('Ongeldige JSON voor extra limieten.');
      hasError = true;
    }

    const limitsPayload: Record<string, number> = {};

    for (const def of LIMIT_DEFINITIONS) {
      const rawInput = (limitInputs[def.id] ?? '').trim();
      let value: number;

      if (rawInput === '') {
        value = def.defaultValue;
      } else {
        value = Number(rawInput);
        if (Number.isNaN(value)) {
          setCustomLimitsError(`Waarde voor "${def.label}" is ongeldig.`);
          hasError = true;
          break;
        }
        if (def.allowUnlimited && value === -1) {
          // unlimited allowed
        } else if (typeof def.min === 'number' && value < def.min) {
          setCustomLimitsError(`Waarde voor "${def.label}" moet ≥ ${def.min}${def.allowUnlimited ? ' of -1' : ''}.`);
          hasError = true;
          break;
        }
      }

      limitsPayload[def.id] = value;
    }

    if (hasError) {
      return;
    }

    const featuresPayload: Record<string, unknown> = { ...parsedCustomFeatures };
    FEATURE_DEFINITIONS.forEach((def) => {
      featuresPayload[def.id] = !!featureSettings[def.id];
    });

    const finalLimits: Record<string, number> = {
      ...Object.keys(parsedCustomLimits).reduce<Record<string, number>>((acc, key) => {
        const value = parsedCustomLimits[key];
        if (typeof value === 'number' && !Number.isNaN(value)) {
          acc[key] = value;
        }
        return acc;
      }, {}),
      ...limitsPayload,
    };

    const payloadBase = tier?.id ? { ...formData, id: tier.id } : formData;

    onSave({
      ...payloadBase,
      features: featuresPayload,
      limits: finalLimits,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tier Name (slug)</Label>
          <Input
            value={formData.tier_name}
            onChange={(e) => setFormData({ ...formData, tier_name: e.target.value })}
            placeholder="e.g. premium"
            required
          />
        </div>
        <div>
          <Label>Display Name</Label>
          <Input
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="e.g. Premium"
            required
          />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Monthly Price ({formData.currency})</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.price_monthly}
            onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value || '0') })}
          />
        </div>
        <div>
          <Label>Yearly Price ({formData.currency})</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.price_yearly}
            onChange={(e) => setFormData({ ...formData, price_yearly: parseFloat(e.target.value || '0') })}
          />
        </div>
        <div>
          <Label>Sort Order</Label>
          <Input
            type="number"
            value={formData.sort_order}
            onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value || '0', 10) })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Features</Label>
          <p className="text-sm text-muted-foreground">
            Zet modules aan of uit per tier. Uitgeschakelde modules worden direct geblokkeerd voor deze licentie.
          </p>
        </div>
        <div className="space-y-3">
          {FEATURE_DEFINITIONS.map((feature) => (
            <div key={feature.id} className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div>
                <div className="font-medium leading-none">{feature.label}</div>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
                {feature.requiredTier && (
                  <p className="text-xs text-muted-foreground mt-1">Aanbevolen tier: {feature.requiredTier}+</p>
                )}
              </div>
              <Switch
                checked={!!featureSettings[feature.id]}
                onCheckedChange={(checked) =>
                  setFeatureSettings((current) => ({ ...current, [feature.id]: checked }))
                }
                aria-label={`Toggle ${feature.label}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Extra features (JSON, optioneel)</Label>
        <Textarea
          value={customFeaturesText}
          onChange={(event) => {
            setCustomFeaturesText(event.target.value);
            setCustomFeaturesError(null);
          }}
          onBlur={() => {
            try {
              const trimmed = customFeaturesText.trim();
              if (trimmed.length === 0) {
                setCustomFeaturesError(null);
                return;
              }
              const parsed = JSON.parse(trimmed);
              if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Invalid JSON');
              }
              setCustomFeaturesError(null);
            } catch (error) {
              setCustomFeaturesError('Controleer de JSON-structuur voor extra features.');
            }
          }}
          rows={4}
          className={`font-mono text-sm ${customFeaturesError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        />
        <p className="text-xs text-muted-foreground">
          Gebruik dit veld voor experimentele of maatwerk feature-flags die nog geen toggle hebben.
        </p>
        {customFeaturesError && <p className="text-xs text-destructive">{customFeaturesError}</p>}
      </div>

      <div className="space-y-3">
        <div>
          <Label>Limieten</Label>
          <p className="text-sm text-muted-foreground">
            Stel hard limits in voor resources. Laat leeg voor de standaardwaarde of gebruik -1 als "onbeperkt" wanneer toegestaan.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {LIMIT_DEFINITIONS.map((limit) => (
            <div key={limit.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium leading-none">{limit.label}</div>
                  <p className="text-sm text-muted-foreground">{limit.description}</p>
                </div>
                <div className="min-w-[8.5rem] sm:w-40">
                  <Input
                    type="number"
                    step={limit.step ?? 1}
                    value={limitInputs[limit.id] ?? ''}
                    onChange={(event) =>
                      setLimitInputs((current) => ({ ...current, [limit.id]: event.target.value }))
                    }
                    aria-label={`Limiet voor ${limit.label}`}
                    className="text-right"
                  />
                </div>
              </div>
              {limit.allowUnlimited ? (
                <p className="text-xs text-muted-foreground">Gebruik -1 voor onbeperkt.</p>
              ) : limit.min !== undefined ? (
                <p className="text-xs text-muted-foreground">Minimale waarde: {limit.min}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Extra limieten (JSON, optioneel)</Label>
        <Textarea
          value={customLimitsText}
          onChange={(event) => {
            setCustomLimitsText(event.target.value);
            setCustomLimitsError(null);
          }}
          onBlur={() => {
            try {
              const trimmed = customLimitsText.trim();
              if (trimmed.length === 0) {
                setCustomLimitsError(null);
                return;
              }
              const parsed = JSON.parse(trimmed);
              if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Invalid JSON');
              }
              setCustomLimitsError(null);
            } catch (error) {
              setCustomLimitsError('Controleer de JSON-structuur voor extra limieten.');
            }
          }}
          rows={4}
          className={`font-mono text-sm ${customLimitsError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        />
        <p className="text-xs text-muted-foreground">
          Gebruik dit veld voor aanvullende limieten (bijv. API-calls, seats) die nog niet standaard zijn.
        </p>
        {customLimitsError && <p className="text-xs text-destructive">{customLimitsError}</p>}
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1">
          {tier ? 'Update Tier' : 'Create Tier'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

