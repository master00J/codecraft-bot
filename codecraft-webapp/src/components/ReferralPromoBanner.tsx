'use client';

import { useState } from 'react';
import { Link } from '@/navigation';
import { Gift, X, Sparkles, ArrowRight } from 'lucide-react';

/**
 * Promotional banner for the referral program
 * Shows on dashboard to encourage participation
 */
export function ReferralPromoBanner() {
  const [dismissed, setDismissed] = useState(false);

  // Check if user has dismissed banner in this session
  if (typeof window !== 'undefined') {
    const wasDismissed = sessionStorage.getItem('referral_banner_dismissed');
    if (wasDismissed && !dismissed) {
      return null;
    }
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('referral_banner_dismissed', 'true');
    }
  };

  if (dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 mb-6 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
      
      {/* Content */}
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="bg-white/20 p-3 rounded-lg">
            <Gift className="w-8 h-8 text-white" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-white">
                💰 Earn By Sharing!
              </h3>
              <span className="inline-flex items-center gap-1 bg-yellow-400 text-yellow-900 text-xs font-semibold px-2 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                NEW
              </span>
            </div>
            <p className="text-purple-100 mb-3">
              Share Comcraft with your friends and get <strong className="text-white">1 week free Enterprise</strong> for 
              every person who buys Enterprise. Unlimited!
            </p>
            <Link href="/comcraft/account/referrals">
              <button className="bg-white text-purple-600 hover:bg-purple-50 px-6 py-2 rounded-lg font-semibold text-sm transition-all inline-flex items-center gap-2">
                View My Referral Link
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

