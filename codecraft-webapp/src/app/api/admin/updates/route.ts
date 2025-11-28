/**
 * API Route: Admin Updates Management
 * /api/admin/updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// GET - Fetch all updates (including unpublished)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (!user?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all updates (including unpublished)
    const { data: updates, error } = await supabase
      .from('updates')
      .select('*')
      .order('release_date', { ascending: false })
      .order('order_index', { ascending: false });

    if (error) {
      console.error('Error fetching updates:', error);
      return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
    }

    // Get items for each update
    const updatesWithItems = await Promise.all(
      (updates || []).map(async (update) => {
        const { data: items } = await supabase
          .from('update_items')
          .select('*')
          .eq('update_id', update.id)
          .order('order_index', { ascending: true });

        return {
          ...update,
          items: items || []
        };
      })
    );

    return NextResponse.json({
      success: true,
      updates: updatesWithItems
    });
  } catch (error) {
    console.error('Error in admin updates API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new update
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    // Check if user is admin
    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (!user?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { version, title, release_date, description, type, is_major, featured_image_url, items } = body;

    // Create update
    const { data: update, error: updateError } = await supabase
      .from('updates')
      .insert({
        version,
        title,
        release_date: release_date || new Date().toISOString().split('T')[0],
        description,
        type: type || 'feature',
        is_major: is_major || false,
        featured_image_url,
        created_by: discordId,
        is_published: true
      })
      .select()
      .single();

    if (updateError) {
      console.error('Error creating update:', updateError);
      return NextResponse.json({ error: 'Failed to create update' }, { status: 500 });
    }

    // Create update items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((item: any, index: number) => ({
        update_id: update.id,
        title: item.title,
        description: item.description,
        category: item.category || 'feature',
        icon: item.icon || '✨',
        order_index: item.order_index !== undefined ? item.order_index : index
      }));

      const { error: itemsError } = await supabase
        .from('update_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Error creating update items:', itemsError);
        // Don't fail the whole request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      update
    });
  } catch (error) {
    console.error('Error in create update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

