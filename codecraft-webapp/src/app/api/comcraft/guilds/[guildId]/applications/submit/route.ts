/**
 * Submit an application from the web form (authenticated user).
 * Inserts into applications then calls bot to post the message to Discord.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Sign in with Discord to apply' }, { status: 401 });
    }

    const userId = (session.user as any).id ?? session.user?.sub ?? (session.user as any).discordId;
    const username = session.user?.name ?? (session.user as any).discordTag ?? 'Unknown';
    if (!userId) {
      return NextResponse.json({ error: 'Discord account not found' }, { status: 400 });
    }

    const body = await request.json();
    const { configId, answers } = body;
    if (!configId || !answers?.responses || !Array.isArray(answers.responses)) {
      return NextResponse.json({ error: 'Missing configId or answers.responses' }, { status: 400 });
    }

    const { data: config, error: configError } = await supabaseAdmin
      .from('application_configs')
      .select('*')
      .eq('guild_id', guildId)
      .eq('id', configId)
      .maybeSingle();

    if (configError || !config) {
      return NextResponse.json({ error: 'Application type not found' }, { status: 404 });
    }
    if (!config.enabled) {
      return NextResponse.json({ error: 'Applications are currently disabled for this role' }, { status: 400 });
    }

    // Cooldown
    const cooldownDays = config.cooldown_days ?? 7;
    if (cooldownDays > 0) {
      const { data: recent } = await supabaseAdmin
        .from('applications')
        .select('created_at')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('config_id', configId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (recent && recent.length > 0) {
        const last = new Date(recent[0].created_at).getTime();
        const minNext = last + cooldownDays * 24 * 60 * 60 * 1000;
        if (Date.now() < minNext) {
          const daysLeft = Math.ceil((minNext - Date.now()) / (24 * 60 * 60 * 1000));
          return NextResponse.json(
            { error: `You must wait ${daysLeft} more day(s) before applying again` },
            { status: 400 }
          );
        }
      }
    }

    const avatarUrl = (session.user as any).image ? String((session.user as any).image) : null;

    const { data: application, error: insertError } = await supabaseAdmin
      .from('applications')
      .insert({
        guild_id: guildId,
        config_id: configId,
        user_id: userId,
        username,
        answers: { responses: answers.responses, avatar: avatarUrl ?? undefined },
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Application insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save application' }, { status: 500 });
    }

    if (COMCRAFT_BOT_API && INTERNAL_SECRET) {
      const botRes = await fetch(`${COMCRAFT_BOT_API}/api/applications/post-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET,
        },
        body: JSON.stringify({ guildId, applicationId: application.id }),
      }).catch((err) => {
        console.error('Bot post-message error:', err);
        return null;
      });
      if (botRes && !botRes.ok) {
        const errData = await botRes.json().catch(() => ({}));
        console.error('Bot post-message failed:', errData);
      }
    }

    return NextResponse.json({ success: true, applicationId: application.id });
  } catch (e) {
    console.error('Applications submit error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
