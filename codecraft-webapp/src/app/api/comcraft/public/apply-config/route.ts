/**
 * Public API: get application config for the web apply form (name, questions, cooldown).
 * No auth required – used to render the form.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get('guildId');
  const configId = searchParams.get('configId');

  if (!guildId || !configId) {
    return NextResponse.json(
      { error: 'Missing guildId or configId. Use ?guildId=...&configId=...' },
      { status: 400 }
    );
  }

  const { data: config, error } = await supabaseAdmin
    .from('application_configs')
    .select('id, name, questions, cooldown_days, require_account_age_days, enabled')
    .eq('guild_id', guildId)
    .eq('id', configId)
    .maybeSingle();

  if (error) {
    console.error('Apply config fetch error:', error);
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }

  if (!config || !config.enabled) {
    return NextResponse.json({ error: 'Application type not found or disabled' }, { status: 404 });
  }

  return NextResponse.json({
    name: config.name || 'Staff',
    questions: config.questions || [],
    cooldown_days: config.cooldown_days ?? 7,
    require_account_age_days: config.require_account_age_days ?? 0,
  });
}
