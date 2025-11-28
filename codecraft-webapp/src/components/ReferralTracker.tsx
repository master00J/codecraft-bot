'use client';

import { useReferralTracking } from '@/hooks/useReferralTracking';

/**
 * Client component to track referral codes
 * Must be used in a layout or page with Suspense boundary
 */
export function ReferralTracker() {
  useReferralTracking();
  return null;
}

