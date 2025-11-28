'use client';

import { useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';

/**
 * Shows a welcome banner for users who arrived via a referral link
 */
export function ReferralWelcomeBanner() {
  const [show, setShow] = useState(false);
  const [referrerName, setReferrerName] = useState<string | null>(null);

  useEffect(() => {
    // Check if there's a referral code in sessionStorage
    const referralCode = sessionStorage.getItem('referral_code');
    const dismissed = sessionStorage.getItem('referral_banner_dismissed');
    
    if (referralCode && !dismissed) {
      setReferrerName(referralCode);
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem('referral_banner_dismissed', 'true');
  };

  if (!show || !referrerName) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-full mx-4">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top duration-500">
        <div className="bg-white/20 p-2 rounded-lg">
          <Gift className="w-6 h-6 text-white" />
        </div>
        
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">
            🎉 Welcome! You were referred by <span className="font-bold">{referrerName}</span>
          </p>
          <p className="text-purple-100 text-xs mt-0.5">
            Sign up and your referrer gets 1 week free Enterprise when you upgrade!
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

