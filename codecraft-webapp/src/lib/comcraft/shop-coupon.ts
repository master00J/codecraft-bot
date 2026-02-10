/**
 * Validate guild shop coupon and compute discounted price in cents.
 */

import { supabaseAdmin } from '@/lib/supabase/server';

export type CouponResult =
  | { valid: true; finalCents: number; couponId: string }
  | { valid: false; error: string };

export async function validateCoupon(
  guildId: string,
  code: string,
  itemPriceCents: number,
  currency: string
): Promise<CouponResult> {
  const normalized = code.trim().toUpperCase().replace(/\s/g, '');
  if (!normalized) {
    return { valid: false, error: 'Code is required' };
  }

  const { data: coupon, error } = await supabaseAdmin
    .from('guild_shop_coupons')
    .select('id, discount_type, discount_value_cents, max_redemptions, redemption_count, valid_from, valid_until')
    .eq('guild_id', guildId)
    .eq('code', normalized)
    .maybeSingle();

  if (error || !coupon) {
    return { valid: false, error: 'Invalid or unknown code' };
  }

  const now = new Date().toISOString();
  const validFrom = (coupon as { valid_from: string | null }).valid_from;
  const validUntil = (coupon as { valid_until: string | null }).valid_until;
  if (validFrom && validFrom > now) {
    return { valid: false, error: 'This code is not yet valid' };
  }
  if (validUntil && validUntil < now) {
    return { valid: false, error: 'This code has expired' };
  }

  const maxRedemptions = (coupon as { max_redemptions: number | null }).max_redemptions;
  const redemptionCount = (coupon as { redemption_count: number }).redemption_count ?? 0;
  if (maxRedemptions != null && redemptionCount >= maxRedemptions) {
    return { valid: false, error: 'This code has reached its redemption limit' };
  }

  const discountType = (coupon as { discount_type: string }).discount_type;
  const discountValue = (coupon as { discount_value_cents: number }).discount_value_cents;

  let discountCents = 0;
  if (discountType === 'percentage') {
    discountCents = Math.floor((itemPriceCents * Math.min(100, discountValue)) / 100);
  } else {
    discountCents = Math.min(discountValue, itemPriceCents - 1);
  }

  const finalCents = Math.max(1, itemPriceCents - discountCents);

  return {
    valid: true,
    finalCents,
    couponId: (coupon as { id: string }).id,
  };
}
