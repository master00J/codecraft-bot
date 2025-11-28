export type ComcraftTierId = 'free' | 'basic' | 'premium' | 'enterprise';

export interface ComcraftTier {
  id: ComcraftTierId;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxGuilds: number;
  features: string[];
  bestFor: string;
}

export const COMCRAFT_TIERS: Record<ComcraftTierId, ComcraftTier> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started. Includes leveling, moderation basics, and auto roles.',
    priceMonthly: 0,
    priceYearly: 0,
    maxGuilds: 1,
    features: [
      'Advanced leveling system',
      'Basic moderation toolkit',
      'Auto roles & welcome messages',
      'Stream notifications (1 channel)',
      'Web dashboard access',
    ],
    bestFor: 'Small communities that want to try Comcraft with core features.',
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'Unlock analytics, advanced moderation, and more automation.',
    priceMonthly: 4.99,
    priceYearly: 49.90,
    maxGuilds: 1,
    features: [
      'Everything in Free tier',
      'Advanced moderation (auto-mod, filters)',
      'Analytics dashboard',
      'Custom welcome messages',
      'Custom bot branding (name + avatar)',
    ],
    bestFor: 'Growing communities that want analytics and stronger moderation.',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Most popular tier with unlimited commands, branding, and priority support.',
    priceMonthly: 9.99,
    priceYearly: 99.90,
    maxGuilds: 3,
    features: [
      'Everything in Basic tier',
      'Unlimited custom commands',
      'Unlimited stream notifications',
      'Priority support',
      '1.5x XP boost across leveling',
    ],
    bestFor: 'Active communities with events, streams, and high engagement.',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For agencies, networks, or multi-server setups needing guaranteed uptime and integrations.',
    priceMonthly: 29.99,
    priceYearly: 299.90,
    maxGuilds: 10,
    features: [
      'Everything in Premium tier',
      'Multi-guild support',
      'Dedicated success manager',
      'Custom integrations & API access',
      '2.0x XP boost and SLA monitoring',
    ],
    bestFor: 'Brands or stream teams managing multiple active Discord servers.',
  },
};

export function getTierById(tierId: ComcraftTierId): ComcraftTier {
  return COMCRAFT_TIERS[tierId];
}

export function getTierMaxGuilds(tierId: ComcraftTierId): number {
  return COMCRAFT_TIERS[tierId]?.maxGuilds ?? 1;
}

