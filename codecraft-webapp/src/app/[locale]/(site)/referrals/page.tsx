'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Link } from '@/navigation';
import { 
  Gift, 
  Users, 
  TrendingUp, 
  Award,
  CheckCircle,
  ArrowRight,
  Sparkles,
  DollarSign,
  Share2,
  Zap
} from 'lucide-react';

export default function ReferralProgramPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [enterprisePrice, setEnterprisePrice] = useState(7.50); // Default fallback (weekly price)

  const exampleCode = session ? 'YOUR2024' : 'EMMA2024';
  const exampleLink = `${typeof window !== 'undefined' ? window.location.origin : 'https://codecraft-solutions.com'}?ref=${exampleCode}`;

  // Fetch real Enterprise tier price from public API
  useEffect(() => {
    const fetchEnterprisePrice = async () => {
      try {
        const res = await fetch('/api/public/pricing');
        if (res.ok) {
          const data = await res.json();
          const enterpriseTier = data.tiers?.find((t: any) => t.tier_name === 'enterprise');
          if (enterpriseTier?.price_monthly) {
            // Convert monthly price to weekly (1 week = monthly / 4)
            setEnterprisePrice(enterpriseTier.price_monthly / 4);
          }
        }
      } catch (error) {
        console.error('Failed to fetch tier pricing:', error);
      }
    };
    fetchEnterprisePrice();
  }, []);

  // Calculate earnings based on real price
  const calculateEarnings = (weeks: number) => {
    return (weeks * enterprisePrice).toFixed(2);
  };

  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(exampleLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 mb-6">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 text-sm font-medium">Earn Money By Sharing</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Become a Partner of
              <span className="bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent"> Comcraft</span>
            </h1>
            
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Earn <strong className="text-white">1 week free Enterprise</strong> for every person you refer 
              who purchases at least 1 month of Enterprise. Unlimited!
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {session ? (
                <Link href="/comcraft/account/referrals">
                  <button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-2 transition-all transform hover:scale-105">
                    View My Dashboard
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </Link>
              ) : (
                <button 
                  onClick={() => router.push('/auth/signin')}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-2 transition-all transform hover:scale-105"
                >
                  Start Earning Now
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
              
              <button 
                onClick={copyExample}
                className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center gap-2 transition-all border border-gray-700"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-5 h-5" />
                    Example Link
                  </>
                )}
              </button>
            </div>

            {/* Example Link Display */}
            <div className="mt-8 max-w-2xl mx-auto">
              <div className="bg-gray-800/50 border border-purple-500/30 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-2">Your unique referral link:</p>
                <code className="text-purple-400 text-sm break-all">{exampleLink}</code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Why Join?
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 hover:border-purple-500/50 transition-all">
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
              <Gift className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">1 Week Free</h3>
            <p className="text-gray-400">
              For every successful referral, get <strong className="text-white">1 week free Enterprise</strong> tier 
              (worth €{enterprisePrice.toFixed(2)}). No limit!
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 hover:border-blue-500/50 transition-all">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Automatic</h3>
            <p className="text-gray-400">
              No hassle. Share your link, when someone buys you get your 
              reward <strong className="text-white">automatically</strong>. Simple and fast.
            </p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 hover:border-green-500/50 transition-all">
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Unlimited Earnings</h3>
            <p className="text-gray-400">
              No maximum. Refer 10 people? <strong className="text-white">10 weeks free</strong>. 
              Refer 50? <strong className="text-white">50 weeks!</strong> Scale your earnings.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-800/30 border-y border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-white text-center mb-4">
            How Does It Work?
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            Start earning in 3 simple steps
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-500/30 rounded-xl p-8">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Share Your Link</h3>
                <p className="text-gray-300">
                  Log in and get your unique referral link. Share it on social media, Discord, YouTube, or wherever you want!
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ArrowRight className="w-8 h-8 text-purple-500/50" />
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-500/30 rounded-xl p-8">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">They Buy Enterprise</h3>
                <p className="text-gray-300">
                  When someone comes through your link and buys at least 1 month Enterprise, it counts as a conversion!
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                <ArrowRight className="w-8 h-8 text-blue-500/50" />
              </div>
            </div>

            <div>
              <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-500/30 rounded-xl p-8">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">You Get It Free!</h3>
                <p className="text-gray-300">
                  You instantly get 1 week free Enterprise added to your account. Automatic, no action needed!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats/Social Proof */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Potential Earnings
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-purple-400 mb-2">5</div>
              <p className="text-gray-400 mb-1">Referrals</p>
              <p className="text-2xl font-semibold text-white">5 Weeks Free</p>
              <p className="text-green-400 text-sm">= €{calculateEarnings(5)} value</p>
            </div>
            
            <div>
              <div className="text-5xl font-bold text-blue-400 mb-2">10</div>
              <p className="text-gray-400 mb-1">Referrals</p>
              <p className="text-2xl font-semibold text-white">10 Weeks Free</p>
              <p className="text-green-400 text-sm">= €{calculateEarnings(10)} value</p>
            </div>
            
            <div>
              <div className="text-5xl font-bold text-green-400 mb-2">25</div>
              <p className="text-gray-400 mb-1">Referrals</p>
              <p className="text-2xl font-semibold text-white">25 Weeks Free</p>
              <p className="text-green-400 text-sm">= €{calculateEarnings(25)} value</p>
            </div>
          </div>
        </div>
      </div>

      {/* Requirements */}
      <div className="bg-gray-800/30 border-t border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Requirements
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <p>Referred person must purchase <strong className="text-white">at least 1 month Enterprise</strong> tier</p>
            </div>
            <div className="flex items-start gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <p>Reward is added <strong className="text-white">automatically</strong> after successful purchase</p>
            </div>
            <div className="flex items-start gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <p><strong className="text-white">No limit</strong> on number of referrals - earn unlimited!</p>
            </div>
            <div className="flex items-start gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <p>Self-referrals are <strong className="text-white">not allowed</strong> (fraud prevention)</p>
            </div>
            <div className="flex items-start gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <p>Track your progress in real-time via the <strong className="text-white">referral dashboard</strong></p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-center">
          <Award className="w-16 h-16 text-white mx-auto mb-6" />
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready To Start?
          </h2>
          <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of partners who are already earning by sharing Comcraft with their community!
          </p>
          
          {session ? (
            <Link href="/comcraft/account/referrals">
              <button className="bg-white text-purple-600 hover:bg-gray-100 px-10 py-5 rounded-lg font-bold text-xl transition-all transform hover:scale-105 inline-flex items-center gap-3">
                Go To My Referral Dashboard
                <ArrowRight className="w-6 h-6" />
              </button>
            </Link>
          ) : (
            <button 
              onClick={() => router.push('/auth/signin')}
              className="bg-white text-purple-600 hover:bg-gray-100 px-10 py-5 rounded-lg font-bold text-xl transition-all transform hover:scale-105 inline-flex items-center gap-3"
            >
              Login & Start Now
              <ArrowRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
