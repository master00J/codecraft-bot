/**
 * API: Guild Stripe config – server owners add their own Stripe keys.
 * Payments go directly to their Stripe account; Codecraft does not handle funds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId =
      (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('guild_stripe_config')
      .select('enabled, stripe_publishable_key, stripe_secret_key')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error) {
      console.error('Stripe config fetch error:', error);
      return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        enabled: false,
        publishableKey: '',
        hasKeys: false,
      });
    }

    return NextResponse.json({
      enabled: !!data.enabled,
      publishableKey: data.stripe_publishable_key || '',
      hasKeys: !!(data.stripe_publishable_key && data.stripe_secret_key),
    });
  } catch (e) {
    console.error('Stripe GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId =
      (session.user as any).discordId || session.user.id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const enabled = body.enabled === true;
    const publishableKey = typeof body.publishableKey === 'string' ? body.publishableKey.trim() : '';
    const secretKey = typeof body.secretKey === 'string' ? body.secretKey.trim() : null;

    const updateData: Record<string, unknown> = {
      enabled,
      updated_at: new Date().toISOString(),
    };
    if (publishableKey !== undefined) updateData.stripe_publishable_key = publishableKey || null;
    if (secretKey !== undefined) updateData.stripe_secret_key = secretKey || null;

    const { data: existing } = await supabaseAdmin
      .from('guild_stripe_config')
      .select('guild_id')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('guild_stripe_config')
        .update(updateData)
        .eq('guild_id', guildId);
      if (error) {
        console.error('Stripe config update error:', error);
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
      }
    } else {
      const { error } = await supabaseAdmin.from('guild_stripe_config').insert({
        guild_id: guildId,
        enabled,
        stripe_publishable_key: publishableKey || null,
        stripe_secret_key: secretKey || null,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error('Stripe config insert error:', error);
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Stripe POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
