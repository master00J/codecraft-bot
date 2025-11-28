'use client';

/**
 * Vote Rewards Page
 * Users can view their vote points, redeem tiers, and see active unlocks
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Coins, Gift, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface VotePoints {
  points: number;
  pointsEarned: number;
  pointsSpent: number;
  lastVoteAt: string | null;
}

interface Tier {
  id: string;
  tier_name: string;
  display_name: string;
  description: string;
  is_active: boolean;
}

interface TierConfig {
  tier: Tier;
  config: {
    points_per_day: number;
    is_active: boolean;
  } | null;
}

interface Unlock {
  id: string;
  guild_id: string;
  guildName: string;
  tier_id: string;
  tier_name: string;
  points_per_day: number;
  unlocked_at: string;
  expires_at: string;
  is_active: boolean;
}

export default function VoteRewardsPage() {
  const [points, setPoints] = useState<VotePoints | null>(null);
  const [tiers, setTiers] = useState<TierConfig[]>([]);
  const [unlocks, setUnlocks] = useState<Unlock[]>([]);
  const [guilds, setGuilds] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchPoints(),
        fetchTiers(),
        fetchUnlocks(),
        fetchGuilds()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPoints() {
    try {
      const response = await fetch('/api/comcraft/vote-points');
      const data = await response.json();
      if (data.success) {
        setPoints({
          points: data.points,
          pointsEarned: data.pointsEarned,
          pointsSpent: data.pointsSpent,
          lastVoteAt: data.lastVoteAt
        });
      }
    } catch (error) {
      console.error('Error fetching points:', error);
    }
  }

  async function fetchTiers() {
    try {
      const response = await fetch('/api/admin/vote-rewards/tier-configs');
      const data = await response.json();
      if (data.success && data.tiers && Array.isArray(data.tiers)) {
        // Filter only tiers with active configs and ensure all required fields exist
        const availableTiers = data.tiers
          .filter((item: TierConfig) => 
            item && 
            item.config && 
            item.config.is_active && 
            item.tier && 
            item.tier.is_active &&
            item.tier.display_name &&
            item.tier.description &&
            typeof item.tier.display_name === 'string' &&
            typeof item.tier.description === 'string'
          )
          .map((item: TierConfig) => ({
            tier: {
              id: String(item.tier.id || ''),
              tier_name: String(item.tier.tier_name || ''),
              display_name: String(item.tier.display_name || 'Unknown Tier'),
              description: String(item.tier.description || ''),
              is_active: Boolean(item.tier.is_active)
            },
            config: {
              points_per_day: Number(item.config?.points_per_day || 0),
              is_active: Boolean(item.config?.is_active || false)
            }
          }));
        setTiers(availableTiers);
      } else {
        setTiers([]);
      }
    } catch (error) {
      console.error('Error fetching tiers:', error);
      setTiers([]);
    }
  }

  async function fetchUnlocks() {
    try {
      const response = await fetch('/api/comcraft/vote-rewards/unlocks');
      const data = await response.json();
      if (data.success && data.unlocks && Array.isArray(data.unlocks)) {
        const validUnlocks = data.unlocks
          .filter((u: any) => u && u.id && u.tier_name)
          .map((u: any) => ({
            id: String(u.id || ''),
            guild_id: String(u.guild_id || ''),
            guildName: String(u.guildName || u.guild_id || 'Unknown Guild'),
            tier_id: String(u.tier_id || ''),
            tier_name: String(u.tier_name || 'Unknown Tier'),
            points_per_day: Number(u.points_per_day || 0),
            unlocked_at: String(u.unlocked_at || new Date().toISOString()),
            expires_at: String(u.expires_at || new Date().toISOString()),
            is_active: Boolean(u.is_active)
          }));
        setUnlocks(validUnlocks);
      } else {
        setUnlocks([]);
      }
    } catch (error) {
      console.error('Error fetching unlocks:', error);
      setUnlocks([]);
    }
  }

  async function fetchGuilds() {
    try {
      const response = await fetch('/api/comcraft/guilds');
      const data = await response.json();
      if (data.success && data.guilds && Array.isArray(data.guilds)) {
        const validGuilds = data.guilds
          .filter((g: any) => g && g.guild_id)
          .map((g: any) => ({
            id: g.guild_id || '',
            name: (g.guild_name || g.guild_id || 'Unknown Guild').toString()
          }));
        setGuilds(validGuilds);
      } else {
        setGuilds([]);
      }
    } catch (error) {
      console.error('Error fetching guilds:', error);
      setGuilds([]);
    }
  }

  async function redeemTier() {
    if (!selectedTier || !selectedGuild) {
      toast({
        title: 'Error',
        description: 'Please select both a tier and a guild',
        variant: 'destructive'
      });
      return;
    }

    setRedeeming(true);
    try {
      const response = await fetch('/api/comcraft/vote-rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: selectedTier,
          guildId: selectedGuild
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message || 'Tier unlocked successfully!'
        });
        setIsRedeemDialogOpen(false);
        setSelectedTier(null);
        setSelectedGuild('');
        fetchData(); // Refresh all data
      } else {
        throw new Error(data.error || 'Failed to redeem tier');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to redeem tier',
        variant: 'destructive'
      });
    } finally {
      setRedeeming(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getDaysRemaining(expiresAt: string) {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full">

      {/* Points Balance */}
      <Card className="p-6 mb-8 w-full">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Coins className="h-6 w-6 text-yellow-500" />
              Your Vote Points
            </h2>
            <div className="text-4xl font-bold text-primary mb-2">
              {points?.points || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total earned: {points?.pointsEarned || 0} • Total spent: {points?.pointsSpent || 0}
            </div>
            {points?.lastVoteAt && (
              <div className="text-sm text-gray-500 mt-1">
                Last vote: {formatDate(points.lastVoteAt)}
              </div>
            )}
          </div>
          <div className="text-right">
            <a
              href={`https://top.gg/bot/${process.env.NEXT_PUBLIC_DISCORD_BOT_ID || process.env.NEXT_PUBLIC_COMCRAFT_CLIENT_ID || '1436442594715373610'}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button>
                <Gift className="h-4 w-4 mr-2" />
                Vote on Top.gg
              </Button>
            </a>
          </div>
        </div>
      </Card>

      {/* Available Tiers */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Available Tiers</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers && Array.isArray(tiers) && tiers.length > 0 ? tiers
            .filter((item) => item && item.tier && item.config && item.tier.id && item.tier.display_name)
            .map((item) => {
            const tier = item.tier;
            const config = item.config;
            const canAfford = (points?.points || 0) >= (config?.points_per_day || 0);

            return (
              <Card key={tier?.id || `tier-${Math.random()}`} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{tier?.display_name || 'Unknown Tier'}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {tier?.description || 'No description available'}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-bold text-primary">
                      {config?.points_per_day || 0}
                    </span>
                    <span className="text-gray-600">points per day</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Points are deducted daily while the tier is active
                  </p>
                </div>

                <Dialog open={isRedeemDialogOpen && selectedTier === tier.id} onOpenChange={(open) => {
                  setIsRedeemDialogOpen(open);
                  if (!open) {
                    setSelectedTier(null);
                    setSelectedGuild('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      className="w-full"
                      disabled={!canAfford}
                      onClick={() => {
                        setSelectedTier(tier.id);
                        setIsRedeemDialogOpen(true);
                      }}
                    >
                      {canAfford ? 'Redeem Tier' : 'Insufficient Points'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Redeem {tier?.display_name || 'Tier'} Tier</DialogTitle>
                      <DialogDescription>
                        Select a guild where you want to apply this tier unlock
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Select Guild
                        </label>
                        <Select value={selectedGuild} onValueChange={setSelectedGuild}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a guild" />
                          </SelectTrigger>
                          <SelectContent>
                            {guilds && Array.isArray(guilds) && guilds.length > 0 ? (
                              guilds
                                .filter((guild) => guild && guild.id && typeof guild.id === 'string')
                                .map((guild) => (
                                  <SelectItem key={String(guild.id)} value={String(guild.id)}>
                                    {String(guild.name || guild.id || 'Unknown Guild')}
                                  </SelectItem>
                                ))
                            ) : (
                              <SelectItem value="no-guilds" disabled>
                                No guilds available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                        <div className="text-sm">
                          <div className="flex justify-between mb-2">
                            <span>Cost per day:</span>
                            <strong>{config?.points_per_day || 0} points</strong>
                          </div>
                          <div className="flex justify-between mb-2">
                            <span>Your points:</span>
                            <strong>{points?.points || 0} points</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Days affordable:</span>
                            <strong>
                              {config?.points_per_day ? Math.floor((points?.points || 0) / config.points_per_day) : 0} days
                            </strong>
                          </div>
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        onClick={redeemTier}
                        disabled={!selectedGuild || redeeming}
                      >
                        {redeeming ? 'Processing...' : 'Confirm Redeem'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </Card>
            );
          }) : (
            <Card className="p-6 col-span-full text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No tiers available for redemption yet. Check back later!
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Active Unlocks */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Active Unlocks</h2>
        {!unlocks || !Array.isArray(unlocks) || unlocks.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              You don't have any active tier unlocks yet.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Redeem a tier above to get started!
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {unlocks
              .filter((unlock) => unlock && unlock.id && unlock.tier_name)
              .map((unlock) => {
              const daysRemaining = getDaysRemaining(String(unlock.expires_at || new Date().toISOString()));
              const isExpiringSoon = daysRemaining <= 1;

              return (
                <Card key={unlock.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{unlock.tier_name || 'Unknown Tier'}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {unlock.guildName || unlock.guild_id || 'Unknown Guild'}
                      </p>
                    </div>
                    <Badge variant={isExpiringSoon ? 'destructive' : 'default'}>
                      {isExpiringSoon ? 'Expiring Soon' : 'Active'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-600">
                        {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Coins className="h-4 w-4 text-yellow-500" />
                      <span className="text-gray-600">
                        {unlock.points_per_day} points per day
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Unlocked: {formatDate(unlock.unlocked_at)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Expires: {formatDate(unlock.expires_at)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

