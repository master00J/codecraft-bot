'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Gift, 
  Link2, 
  Users, 
  TrendingUp, 
  Award, 
  Copy, 
  CheckCircle2,
  Clock,
  DollarSign,
  RefreshCw
} from 'lucide-react';

interface ReferralCode {
  id: string;
  code: string;
  total_clicks: number;
  total_signups: number;
  total_conversions: number;
  total_rewards_earned: number;
  is_active: boolean;
  created_at: string;
}

interface ReferralStats {
  code: string;
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  totalRewards: number;
  conversionRate: string;
  recentReferrals: any[];
  activeRewards: any[];
  rewardsHistory: any[];
  totalEarnings: {
    days: number;
    value: number;
  };
}

export default function ReferralsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [enterpriseMonthlyPrice, setEnterpriseMonthlyPrice] = useState(29.99);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      loadReferralData();
    }
  }, [status, router]);

  // Fetch real Enterprise tier price from public API
  useEffect(() => {
    const fetchEnterprisePrice = async () => {
      try {
        const res = await fetch('/api/public/pricing');
        if (res.ok) {
          const data = await res.json();
          const enterpriseTier = data.tiers?.find((t: any) => t.tier_name === 'enterprise');
          if (enterpriseTier?.price_monthly) {
            setEnterpriseMonthlyPrice(enterpriseTier.price_monthly);
          }
        }
      } catch (error) {
        console.error('Failed to fetch tier pricing:', error);
      }
    };
    fetchEnterprisePrice();
  }, []);

  const loadReferralData = async () => {
    try {
      setLoading(true);

      // Get or create referral code
      const codeRes = await fetch('/api/comcraft/referral/code');
      if (codeRes.ok) {
        const codeData = await codeRes.json();
        setReferralCode(codeData.code);
      }

      // Get stats
      const statsRes = await fetch('/api/comcraft/referral/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReferralLink = () => {
    if (!referralCode) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}?ref=${referralCode.code}`;
  };

  const copyLink = async () => {
    const link = getReferralLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const regenerateCode = async () => {
    if (!confirm('Are you sure you want to generate a new code? Your old link will stop working.')) {
      return;
    }

    try {
      setRegenerating(true);
      const res = await fetch('/api/comcraft/referral/code', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' })
      });

      if (res.ok) {
        await loadReferralData();
      }
    } catch (error) {
      console.error('Error regenerating code:', error);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Gift className="w-8 h-8 text-purple-400" />
            Affiliate Program
          </h1>
          <p className="text-gray-400 mt-2">
            Earn 1 week free Enterprise tier for every referral who buys Enterprise!
          </p>
        </div>

        {/* Referral Link Card */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Your Referral Link
            </h2>
            <button
              onClick={regenerateCode}
              disabled={regenerating}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              New Code
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <code className="text-blue-400 text-lg break-all">{getReferralLink()}</code>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyLink}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Link
                </>
              )}
            </button>
            
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out Comcraft Discord Bot! ${getReferralLink()}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Share on X
            </a>
          </div>

          <div className="mt-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
            <p className="text-sm text-purple-300">
              💡 <strong>Your code:</strong> <code className="bg-purple-900/50 px-2 py-1 rounded">{referralCode?.code}</code>
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total Clicks */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Clicks</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.totalClicks}</p>
                  </div>
                  <Users className="w-10 h-10 text-blue-400 opacity-75" />
                </div>
              </div>

              {/* Total Signups */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Signups</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.totalSignups}</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-green-400 opacity-75" />
                </div>
              </div>

              {/* Total Conversions */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Conversions</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.totalConversions}</p>
                    <p className="text-xs text-gray-500 mt-1">{stats.conversionRate}% rate</p>
                  </div>
                  <Award className="w-10 h-10 text-yellow-400 opacity-75" />
                </div>
              </div>

              {/* Total Rewards */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Earned</p>
                    <p className="text-3xl font-bold text-white mt-1">{stats.totalRewards}</p>
                    <p className="text-xs text-gray-500 mt-1">{stats.totalEarnings.days} days free</p>
                  </div>
                  <Gift className="w-10 h-10 text-purple-400 opacity-75" />
                </div>
              </div>
            </div>

            {/* Earnings Card */}
            <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-6 mb-6 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">💰 Total Value Earned</h3>
                  <p className="text-3xl font-bold text-purple-300">
                    €{stats.totalEarnings.value.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Based on Enterprise price (€{enterpriseMonthlyPrice.toFixed(2)}/month)
                  </p>
                </div>
                <DollarSign className="w-16 h-16 text-purple-400 opacity-50" />
              </div>
            </div>

            {/* Active Rewards */}
            {stats.activeRewards.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-400" />
                  Active Rewards
                </h3>
                <div className="space-y-3">
                  {stats.activeRewards.map((reward: any) => {
                    const expiresAt = new Date(reward.expires_at);
                    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={reward.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">1 Week Free Enterprise</p>
                          <p className="text-sm text-gray-400">
                            Expires: {expiresAt.toLocaleDateString('en-US')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 font-semibold">{daysLeft} days left</p>
                          <p className="text-xs text-gray-500">Guild: {reward.referrer_guild_id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Referrals */}
            {stats.recentReferrals.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Referrals</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Date</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Reward</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentReferrals.map((referral: any) => {
                        const statusColors = {
                          clicked: 'bg-blue-900 text-blue-300',
                          signed_up: 'bg-yellow-900 text-yellow-300',
                          converted: 'bg-green-900 text-green-300',
                          expired: 'bg-gray-700 text-gray-400'
                        };

                        const statusLabels = {
                          clicked: 'Clicked',
                          signed_up: 'Signed Up',
                          converted: 'Converted',
                          expired: 'Expired'
                        };

                        return (
                          <tr key={referral.id} className="border-b border-gray-700/50">
                            <td className="py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[referral.conversion_status as keyof typeof statusColors]}`}>
                                {statusLabels[referral.conversion_status as keyof typeof statusLabels]}
                              </span>
                            </td>
                            <td className="py-3 text-gray-300 text-sm">
                              {new Date(referral.created_at).toLocaleDateString('en-US')}
                            </td>
                            <td className="py-3 text-gray-300 text-sm">
                              {referral.subscription_tier || '-'}
                            </td>
                            <td className="py-3">
                              {referral.reward_given ? (
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                              ) : (
                                <span className="text-gray-500 text-sm">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* How it Works */}
            {stats.totalConversions === 0 && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">How It Works</h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      1
                    </div>
                    <div>
                      <p className="text-white font-medium">Share your link</p>
                      <p className="text-sm text-gray-400">Share your unique referral link with friends and communities</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      2
                    </div>
                    <div>
                      <p className="text-white font-medium">They buy Enterprise</p>
                      <p className="text-sm text-gray-400">When they purchase at least 1 month Enterprise tier</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      3
                    </div>
                    <div>
                      <p className="text-white font-medium">You get 1 week free!</p>
                      <p className="text-sm text-gray-400">You automatically get 1 week free Enterprise tier</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

