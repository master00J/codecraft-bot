/**
 * API Route: Updates/Changelog
 * /api/updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function GET(request: NextRequest) {
  try {
    // Get all published updates with their items
    const { data: updates, error } = await supabase
      .from('updates')
      .select('*')
      .eq('is_published', true)
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
    console.error('Error in updates API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

