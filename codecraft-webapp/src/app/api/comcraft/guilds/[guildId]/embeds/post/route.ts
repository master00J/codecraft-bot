/**
 * API Route: Post Embed to Discord
 * /api/comcraft/guilds/[guildId]/embeds/post
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:25836';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

// POST - Post embed to Discord channel
export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { embedId, channelId, mentionRoleId, pinMessage } = body;

    if (!embedId || !channelId) {
      return NextResponse.json({ error: 'Embed ID and channel ID required' }, { status: 400 });
    }

    // Fetch embed
    const { data: embed, error: embedError } = await supabase
      .from('saved_embeds')
      .select('*')
      .eq('id', embedId)
      .eq('guild_id', params.guildId)
      .single();

    if (embedError || !embed) {
      return NextResponse.json({ error: 'Embed not found' }, { status: 404 });
    }

    // Prepare payload for bot API
    let payload: any = {
      guildId: params.guildId,
      channelId,
      mentionRoleId,
      pinMessage
    };

    if (embed.is_capsule) {
      // Capsule format: multiple embeds + components
      payload.isCapsule = true;
      payload.content = embed.content || null;
      payload.embeds = embed.embeds || [];
      payload.components = embed.components || [];
    } else {
      // Regular embed format (backward compatible)
      // If embeds array exists (from migration), use first embed
      if (embed.embeds && Array.isArray(embed.embeds) && embed.embeds.length > 0) {
        const firstEmbed = embed.embeds[0];
        payload.isCapsule = false;
        payload.embed = {
          title: firstEmbed.title || embed.title,
          description: firstEmbed.description || embed.description,
          color: firstEmbed.color || embed.color,
          url: firstEmbed.url || embed.url,
          thumbnail: firstEmbed.thumbnail?.url || (embed.thumbnail_url ? { url: embed.thumbnail_url } : undefined),
          image: firstEmbed.image?.url || (embed.image_url ? { url: embed.image_url } : undefined),
          footer: firstEmbed.footer || (embed.footer_text ? {
            text: embed.footer_text,
            icon_url: embed.footer_icon_url
          } : undefined),
          author: firstEmbed.author || (embed.author_name ? {
            name: embed.author_name,
            icon_url: embed.author_icon_url,
            url: embed.author_url
          } : undefined),
          fields: firstEmbed.fields || embed.fields || [],
          timestamp: firstEmbed.timestamp || (embed.show_timestamp ? new Date().toISOString() : undefined)
        };
      } else {
        // Old format (no embeds array)
        payload.isCapsule = false;
        payload.embed = {
          title: embed.title,
          description: embed.description,
          color: embed.color,
          url: embed.url,
          thumbnail: embed.thumbnail_url ? { url: embed.thumbnail_url } : undefined,
          image: embed.image_url ? { url: embed.image_url } : undefined,
          footer: embed.footer_text ? {
            text: embed.footer_text,
            icon_url: embed.footer_icon_url
          } : undefined,
          author: embed.author_name ? {
            name: embed.author_name,
            icon_url: embed.author_icon_url,
            url: embed.author_url
          } : undefined,
          fields: embed.fields || [],
          timestamp: embed.show_timestamp ? new Date().toISOString() : undefined
        };
        payload.components = embed.components || [];
      }
    }

    // Call bot API to post embed/capsule
    const botResponse = await fetch(`${COMCRAFT_BOT_API}/api/embeds/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': INTERNAL_SECRET!
      },
      body: JSON.stringify(payload)
    });

    const result = await botResponse.json();

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to post' }, { status: 500 });
    }

    // Update usage stats
    await supabase
      .from('saved_embeds')
      .update({
        times_used: (embed.times_used || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', embedId);

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('Error posting embed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

