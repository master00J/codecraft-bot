import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase, getGuildAccess, isAiFeatureEnabled } from '../../helpers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; documentId: string }> }
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

    const { guildId, documentId } = params;
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
    const tags = Array.isArray(body.tags) ? body.tags.slice(0, 5).map((tag: string) => String(tag).trim()).filter(Boolean) : undefined;
    const isPinned = body.isPinned !== undefined ? Boolean(body.isPinned) : undefined;

    if (content && content.length > 6000) {
      return NextResponse.json({ error: 'Content exceeds 6000 characters.' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== '') updatePayload.title = title;
    if (content) updatePayload.content = content;
    if (tags !== undefined) updatePayload.tags = tags;
    if (isPinned !== undefined) updatePayload.is_pinned = isPinned;

    const { data, error } = await supabase
      .from('ai_documents')
      .update(updatePayload)
      .eq('guild_id', guildId)
      .eq('id', documentId)
      .select('id, title, content, tags, is_pinned, created_at, updated_at')
      .single();

    if (error) {
      console.error('AI document update error:', error);
      return NextResponse.json({ error: 'Failed to update document.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: data });
  } catch (error) {
    console.error('AI document PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; documentId: string }> }
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

    const { guildId, documentId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const featureEnabled = await isAiFeatureEnabled(guildId);
    if (!featureEnabled) {
      return NextResponse.json({ error: 'AI assistant is not enabled for this tier.' }, { status: 403 });
    }

    const { error } = await supabase
      .from('ai_documents')
      .delete()
      .eq('guild_id', guildId)
      .eq('id', documentId);

    if (error) {
      console.error('AI document delete error:', error);
      return NextResponse.json({ error: 'Failed to delete document.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('AI document DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

