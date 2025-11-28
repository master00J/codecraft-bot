import { supabaseAdmin } from '@/lib/supabase/server';

export async function markPaymentStatus(
  paymentId: string,
  status: 'pending' | 'confirmed' | 'rejected',
  metadataPatch?: Record<string, any>
) {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('payments')
    .select('metadata, order_id')
    .eq('id', paymentId)
    .single();

  if (fetchError || !existing) {
    throw fetchError || new Error('Payment not found');
  }

  const updates: Record<string, any> = { status };

  if (metadataPatch) {
    const mergedMetadata: Record<string, any> = { ...(existing.metadata || {}) };
    for (const [key, value] of Object.entries(metadataPatch)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        mergedMetadata[key] &&
        typeof mergedMetadata[key] === 'object' &&
        !Array.isArray(mergedMetadata[key])
      ) {
        mergedMetadata[key] = { ...mergedMetadata[key], ...value };
      } else {
        mergedMetadata[key] = value;
      }
    }
    updates.metadata = mergedMetadata;
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .update(updates)
    .eq('id', paymentId)
    .select('*, order_id')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function markOrderPaid(orderId: string, provider: string) {
  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'in_progress',
      payment_method: provider,
    })
    .eq('id', orderId);

  if (error) {
    throw error;
  }
}
