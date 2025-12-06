import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase, isAiFeatureEnabled, getGuildAccess } from '../helpers';

export const dynamic = 'force-dynamic';

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

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const { guildId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const featureEnabled = await isAiFeatureEnabled(guildId);
    if (!featureEnabled) {
      return NextResponse.json({ error: 'AI assistant is not enabled for this tier.' }, { status: 403 });
    }

    const body = await request.json();
    const title = body.title?.trim?.() || '';
    const content = body.content?.trim?.() || '';
    const tags = Array.isArray(body.tags) ? body.tags.slice(0, 5).map((tag: string) => String(tag).trim()).filter(Boolean) : null;
    const isPinned = Boolean(body.isPinned);

    if (!content) {
      return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
    }

    if (content.length > 6000) {
      return NextResponse.json({ error: 'Content exceeds 6000 characters.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ai_documents')
      .insert({
        guild_id: guildId,
        title: title || null,
        content,
        tags,
        is_pinned: isPinned,
      })
      .select('id, title, content, tags, is_pinned, created_at, updated_at')
      .single();

    if (error) {
      console.error('AI document insert error:', error);
      return NextResponse.json({ error: 'Failed to create document.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: data });
  } catch (error) {
    console.error('AI document POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

