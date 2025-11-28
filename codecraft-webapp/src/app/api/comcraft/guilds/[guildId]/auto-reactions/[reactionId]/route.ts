import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * PATCH /api/comcraft/guilds/[guildId]/auto-reactions/[reactionId]
 * Update an auto-reaction rule
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string; reactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId, reactionId } = params;
    const body = await request.json();

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.trigger_words !== undefined) updates.trigger_words = body.trigger_words;
    if (body.emoji_ids !== undefined) updates.emoji_ids = body.emoji_ids;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.case_sensitive !== undefined) updates.case_sensitive = body.case_sensitive;
    if (body.use_word_boundaries !== undefined) updates.use_word_boundaries = body.use_word_boundaries;
    if (body.allowed_channels !== undefined) updates.allowed_channels = body.allowed_channels;
    if (body.ignored_channels !== undefined) updates.ignored_channels = body.ignored_channels;
    if (body.cooldown_seconds !== undefined) updates.cooldown_seconds = body.cooldown_seconds;

    const { data: reaction, error } = await supabaseAdmin
      .from('auto_reactions')
      .update(updates)
      .eq('id', reactionId)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating auto-reaction:', error);
      return NextResponse.json(
        { error: 'Failed to update reaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reaction });
  } catch (error) {
    console.error('Error in PATCH /api/comcraft/guilds/[guildId]/auto-reactions/[reactionId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/comcraft/guilds/[guildId]/auto-reactions/[reactionId]
 * Delete an auto-reaction rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { guildId: string; reactionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId, reactionId } = params;

    const { error } = await supabaseAdmin
      .from('auto_reactions')
      .delete()
      .eq('id', reactionId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting auto-reaction:', error);
      return NextResponse.json(
        { error: 'Failed to delete reaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/comcraft/guilds/[guildId]/auto-reactions/[reactionId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

