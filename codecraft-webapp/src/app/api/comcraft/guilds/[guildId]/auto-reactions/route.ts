import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/comcraft/guilds/[guildId]/auto-reactions
 * Get auto-reactions configuration and rules for a guild
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;

    // Get config
    const { data: config, error: configError } = await supabaseAdmin
      .from('auto_reactions_configs')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Error fetching auto-reactions config:', configError);
      return NextResponse.json(
        { error: 'Failed to fetch config' },
        { status: 500 }
      );
    }

    // Get reactions
    const { data: reactions, error: reactionsError } = await supabaseAdmin
      .from('auto_reactions')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: true });

    if (reactionsError) {
      console.error('Error fetching auto-reactions:', reactionsError);
      return NextResponse.json(
        { error: 'Failed to fetch reactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      config: config || {
        guild_id: guildId,
        enabled: true,
        allowed_channels: [],
        ignored_channels: [],
        use_word_boundaries: true,
        case_sensitive: false,
      },
      reactions: reactions || [],
    });
  } catch (error) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/auto-reactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comcraft/guilds/[guildId]/auto-reactions
 * Create a new auto-reaction rule
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const body = await request.json();

    const { data: reaction, error } = await supabaseAdmin
      .from('auto_reactions')
      .insert({
        guild_id: guildId,
        trigger_words: body.trigger_words || [],
        emoji_ids: body.emoji_ids || [],
        enabled: body.enabled !== undefined ? body.enabled : true,
        case_sensitive: body.case_sensitive !== undefined ? body.case_sensitive : false,
        use_word_boundaries: body.use_word_boundaries !== undefined ? body.use_word_boundaries : true,
        allowed_channels: body.allowed_channels || null,
        ignored_channels: body.ignored_channels || null,
        cooldown_seconds: body.cooldown_seconds || 0,
        created_by: body.created_by || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating auto-reaction:', error);
      return NextResponse.json(
        { error: 'Failed to create reaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ reaction });
  } catch (error) {
    console.error('Error in POST /api/comcraft/guilds/[guildId]/auto-reactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/comcraft/guilds/[guildId]/auto-reactions
 * Update auto-reactions configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const body = await request.json();

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.allowed_channels !== undefined) updates.allowed_channels = body.allowed_channels;
    if (body.ignored_channels !== undefined) updates.ignored_channels = body.ignored_channels;
    if (body.use_word_boundaries !== undefined) updates.use_word_boundaries = body.use_word_boundaries;
    if (body.case_sensitive !== undefined) updates.case_sensitive = body.case_sensitive;

    const { data: config, error } = await supabaseAdmin
      .from('auto_reactions_configs')
      .upsert({
        guild_id: guildId,
        ...updates,
      }, {
        onConflict: 'guild_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating auto-reactions config:', error);
      return NextResponse.json(
        { error: 'Failed to update config' },
        { status: 500 }
      );
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error in PATCH /api/comcraft/guilds/[guildId]/auto-reactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

