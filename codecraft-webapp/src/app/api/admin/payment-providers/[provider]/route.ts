import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {

  const { provider } = await params;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const providerKey = params.provider;
    const payload = await request.json();

    console.log(`[Payment Provider API] Updating ${providerKey}:`, {
      is_active: payload.is_active,
      auto_verification: payload.auto_verification,
      config_keys: payload.config ? Object.keys(payload.config) : [],
    });

    // Get existing provider or create default
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('payment_providers')
      .select('*')
      .eq('provider', providerKey)
      .maybeSingle();

    const updateData: any = {
      provider: providerKey,
      updated_at: new Date().toISOString(),
    };

    // Always set display_name - required field
    // Priority: payload > existing > default
    updateData.display_name = payload.display_name || existing?.display_name || providerKey.charAt(0).toUpperCase() + providerKey.slice(1);

    // Always set is_active - use payload value if provided, otherwise keep existing or default to false
    if (typeof payload.is_active === 'boolean') {
      updateData.is_active = payload.is_active;
    } else if (existing && typeof existing.is_active === 'boolean') {
      updateData.is_active = existing.is_active;
    } else {
      updateData.is_active = false;
    }

    // Always set auto_verification - use payload value if provided, otherwise keep existing or default to false
    if (typeof payload.auto_verification === 'boolean') {
      updateData.auto_verification = payload.auto_verification;
    } else if (existing && typeof existing.auto_verification === 'boolean') {
      updateData.auto_verification = existing.auto_verification;
    } else {
      updateData.auto_verification = false;
    }

    // Update display_order
    if (payload.display_order !== undefined) {
      updateData.display_order = payload.display_order;
    }

    // Always set config - merge provided config with existing, or use existing, or default to empty object
    if (payload.config && typeof payload.config === 'object') {
      const existingConfig = existing?.config || {};
      // Merge: new values override existing (including empty strings), but keep existing keys that aren't in payload
      // This ensures that clearing a field (empty string) actually clears it
      updateData.config = { ...existingConfig, ...payload.config };
    } else if (existing?.config && typeof existing.config === 'object') {
      updateData.config = existing.config;
    } else {
      updateData.config = {};
    }

    console.log(`[Payment Provider API] Upserting ${providerKey} with data:`, {
      is_active: updateData.is_active,
      auto_verification: updateData.auto_verification,
      config_keys: updateData.config ? Object.keys(updateData.config) : [],
      has_secretKey: !!updateData.config?.secretKey,
      has_publishableKey: !!updateData.config?.publishableKey,
      has_webhookSecret: !!updateData.config?.webhookSecret,
    });

    // Use upsert to create or update
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('payment_providers')
      .upsert(updateData, { onConflict: 'provider' })
      .select('*')
      .single();

    if (updateError) {
      console.error('Error upserting payment provider:', updateError);
      throw updateError;
    }

    console.log(`[Payment Provider API] Successfully saved ${providerKey}:`, {
      is_active: updated.is_active,
      auto_verification: updated.auto_verification,
      config_keys: updated.config ? Object.keys(updated.config) : [],
    });

    return NextResponse.json({ success: true, provider: updated });
  } catch (error) {
    console.error('Error updating payment provider:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
