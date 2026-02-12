/**
 * API: Guild PayPal config – server owners add their own PayPal app (Client ID + Secret).
 * Payments go directly to their PayPal account; Codecraft does not handle funds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
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
      .from('guild_paypal_config')
      .select('enabled, client_id, sandbox, webhook_id')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error) {
      console.error('PayPal config fetch error:', error);
      return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        enabled: false,
        clientId: '',
        hasKeys: false,
        sandbox: true,
      });
    }

    return NextResponse.json({
      enabled: !!data.enabled,
      clientId: data.client_id || '',
      hasKeys: !!data.client_id,
      sandbox: data.sandbox !== false,
      webhookId: data.webhook_id || '',
    });
  } catch (e) {
    console.error('PayPal GET error:', e);
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
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
    const clientSecret = typeof body.clientSecret === 'string' ? body.clientSecret.trim() : null;
    const sandbox = body.sandbox !== false;
    const webhookId = typeof body.webhookId === 'string' ? body.webhookId.trim() : null;

    const updateData: Record<string, unknown> = {
      enabled,
      sandbox,
      updated_at: new Date().toISOString(),
    };
    if (clientId !== undefined) updateData.client_id = clientId || null;
    // Only overwrite client_secret when the client sent the field (re-entered). Leave blank = keep current.
    if (body.hasOwnProperty('clientSecret')) updateData.client_secret = clientSecret || null;
    if (body.hasOwnProperty('webhookId')) updateData.webhook_id = webhookId || null;

    const { data: existing } = await supabaseAdmin
      .from('guild_paypal_config')
      .select('guild_id')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('guild_paypal_config')
        .update(updateData)
        .eq('guild_id', guildId);
      if (error) {
        console.error('PayPal config update error:', error);
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
      }
    } else {
      const { error } = await supabaseAdmin.from('guild_paypal_config').insert({
        guild_id: guildId,
        enabled,
        client_id: clientId || null,
        client_secret: clientSecret || null,
        sandbox,
        webhook_id: webhookId || null,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error('PayPal config insert error:', error);
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('PayPal POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
