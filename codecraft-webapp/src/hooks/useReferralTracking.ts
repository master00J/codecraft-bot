'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

/**
 * Hook to track referral clicks and signups
 * Automatically called on any page with ?ref=CODE parameter
 */
export function useReferralTracking() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  useEffect(() => {
    const referralCode = searchParams.get('ref');
    
    if (!referralCode) return;

    // Track click immediately
    const trackClick = async () => {
      try {
        // Check if already tracked in this session
        const tracked = sessionStorage.getItem(`ref_tracked_${referralCode}`);
        if (tracked) return;

        const res = await fetch('/api/comcraft/referral/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            code: referralCode,
            action: 'click'
          })
        });

        if (res.ok) {
          sessionStorage.setItem(`ref_tracked_${referralCode}`, 'true');
          // Store for signup tracking
          sessionStorage.setItem('pending_referral_code', referralCode);
        }
      } catch (error) {
        console.error('Error tracking referral click:', error);
      }
    };

    trackClick();
  }, [searchParams]);

  // Track signup when user authenticates
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;

    const trackSignup = async () => {
      try {
        const pendingCode = sessionStorage.getItem('pending_referral_code');
        if (!pendingCode) return;

        const signedUp = sessionStorage.getItem(`ref_signed_up_${pendingCode}`);
        if (signedUp) return;

        const discordId = (session.user as any).discordId;
        if (!discordId) return;

        const res = await fetch('/api/comcraft/referral/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            code: pendingCode,
            action: 'signup',
            discordId
          })
        });

        if (res.ok) {
          sessionStorage.setItem(`ref_signed_up_${pendingCode}`, 'true');
          // Keep the code for conversion tracking (when they create a guild)
        }
      } catch (error) {
        console.error('Error tracking referral signup:', error);
      }
    };

    trackSignup();
  }, [session, status]);
}

