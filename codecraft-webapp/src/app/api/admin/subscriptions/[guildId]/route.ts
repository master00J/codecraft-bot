/**
 * Admin API: Update guild subscription manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function ensureAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const discordId = (session.user as any).discordId;

  if (!discordId) {
    return { ok: false, status: 401, error: 'Missing Discord ID on session' };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();

  if (error) {
    console.error('Failed to verify admin user:', error);
    return { ok: false, status: 500, error: 'Failed to verify admin access' };
  }

  if (!user?.is_admin) {
    return { ok: false, status: 403, error: 'Admin access required' };
  }

  return { ok: true } as const;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const check = await ensureAdmin();
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const updates = await request.json();
    const payload: Record<string, any> = { subscription_updated_at: new Date().toISOString() };

    if (typeof updates.subscription_active === 'boolean') {
      payload.subscription_active = updates.subscription_active;
    }

    if (typeof updates.is_active === 'boolean') {
      payload.is_active = updates.is_active;
    }

    if (updates.subscription_tier) {
      payload.subscription_tier = updates.subscription_tier;
    }

    if (typeof updates.subscription_notes === 'string') {
      payload.subscription_notes = updates.subscription_notes;
    }

    if (Object.keys(payload).length === 1) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('guild_configs')
      .update(payload)
      .eq('guild_id', params.guildId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating subscription:', error);
      return NextResponse.json(
        { error: 'Failed to update subscription', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, guild: data });
  } catch (error: any) {
    console.error('Unexpected error updating subscription:', error);
    return NextResponse.json(
      { error: 'Unexpected server error', details: error?.message },
      { status: 500 }
    );
  }
}
