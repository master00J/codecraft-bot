/**
 * API Route: Embed Builder Management
 * /api/comcraft/guilds/[guildId]/embeds
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// GET - Fetch all saved embeds
export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: embeds, error } = await supabase
      .from('saved_embeds')
      .select('*')
      .eq('guild_id', params.guildId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching embeds:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ embeds: embeds || [] });
  } catch (error) {
    console.error('Error in embeds API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new embed
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
    const discordId = (session.user as any).discordId || (session.user as any).id || (session.user as any).sub;

    // Check if this is a capsule or regular embed
    const isCapsule = body.is_capsule || false;
    
    const insertData: any = {
      guild_id: params.guildId,
      created_by: discordId,
      name: body.name,
      template_type: body.template_type || 'custom',
      tags: body.tags || [],
      is_capsule: isCapsule,
    };

    if (isCapsule) {
      // Capsule format: multiple embeds + components
      insertData.capsule_type = body.capsule_type || 'custom';
      insertData.embeds = body.embeds || [];
      insertData.components = body.components || [];
      insertData.content = body.content || null;
      
      // Keep single embed fields for backward compatibility
      insertData.title = body.title || null;
      insertData.description = body.description || null;
      insertData.color = body.color || '#5865F2';
    } else {
      // Regular embed format (backward compatible)
      insertData.title = body.title;
      insertData.description = body.description;
      insertData.color = body.color || '#5865F2';
      insertData.url = body.url;
      insertData.thumbnail_url = body.thumbnail_url;
      insertData.image_url = body.image_url;
      insertData.footer_text = body.footer_text;
      insertData.footer_icon_url = body.footer_icon_url;
      insertData.author_name = body.author_name;
      insertData.author_icon_url = body.author_icon_url;
      insertData.author_url = body.author_url;
      insertData.show_timestamp = body.show_timestamp || false;
      insertData.fields = body.fields || [];
      insertData.components = body.components || [];
      
      // Convert single embed to capsule format for storage
      insertData.embeds = [{
        title: body.title,
        description: body.description,
        color: body.color || '#5865F2',
        url: body.url,
        thumbnail: body.thumbnail_url ? { url: body.thumbnail_url } : null,
        image: body.image_url ? { url: body.image_url } : null,
        footer: body.footer_text ? {
          text: body.footer_text,
          icon_url: body.footer_icon_url
        } : null,
        author: body.author_name ? {
          name: body.author_name,
          icon_url: body.author_icon_url,
          url: body.author_url
        } : null,
        fields: body.fields || [],
        timestamp: body.show_timestamp ? new Date().toISOString() : null
      }];
    }

    const { data: embed, error } = await supabase
      .from('saved_embeds')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating embed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, embed });
  } catch (error) {
    console.error('Error creating embed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update embed
export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const embedId = body.id;

    if (!embedId) {
      return NextResponse.json({ error: 'Embed ID required' }, { status: 400 });
    }

    // Check if this is a capsule or regular embed
    const isCapsule = body.is_capsule || false;
    
    const updateData: any = {
      name: body.name,
      template_type: body.template_type,
      tags: body.tags,
      updated_at: new Date().toISOString(),
      is_capsule: isCapsule,
    };

    if (isCapsule) {
      // Capsule format
      updateData.capsule_type = body.capsule_type || 'custom';
      updateData.embeds = body.embeds || [];
      updateData.components = body.components || [];
      updateData.content = body.content || null;
      
      // Keep single embed fields for backward compatibility
      updateData.title = body.title || null;
      updateData.description = body.description || null;
      updateData.color = body.color || '#5865F2';
    } else {
      // Regular embed format
      updateData.title = body.title;
      updateData.description = body.description;
      updateData.color = body.color;
      updateData.url = body.url;
      updateData.thumbnail_url = body.thumbnail_url;
      updateData.image_url = body.image_url;
      updateData.footer_text = body.footer_text;
      updateData.footer_icon_url = body.footer_icon_url;
      updateData.author_name = body.author_name;
      updateData.author_icon_url = body.author_icon_url;
      updateData.author_url = body.author_url;
      updateData.show_timestamp = body.show_timestamp;
      updateData.fields = body.fields;
      updateData.components = body.components;
      
      // Convert single embed to capsule format
      updateData.embeds = [{
        title: body.title,
        description: body.description,
        color: body.color,
        url: body.url,
        thumbnail: body.thumbnail_url ? { url: body.thumbnail_url } : null,
        image: body.image_url ? { url: body.image_url } : null,
        footer: body.footer_text ? {
          text: body.footer_text,
          icon_url: body.footer_icon_url
        } : null,
        author: body.author_name ? {
          name: body.author_name,
          icon_url: body.author_icon_url,
          url: body.author_url
        } : null,
        fields: body.fields || [],
        timestamp: body.show_timestamp ? new Date().toISOString() : null
      }];
    }

    const { error } = await supabase
      .from('saved_embeds')
      .update(updateData)
      .eq('id', embedId)
      .eq('guild_id', params.guildId);

    if (error) {
      console.error('Error updating embed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating embed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete embed
export async function DELETE(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const embedId = searchParams.get('id');

    if (!embedId) {
      return NextResponse.json({ error: 'Embed ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('saved_embeds')
      .delete()
      .eq('id', embedId)
      .eq('guild_id', params.guildId);

    if (error) {
      console.error('Error deleting embed:', error);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting embed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

