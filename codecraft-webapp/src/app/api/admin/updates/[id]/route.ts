/**
 * API Route: Admin Update Management (Single)
 * /api/admin/updates/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// PATCH - Update an update
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const body = await request.json();
    const { items, ...updateData } = body;

    // Update the update
    const { data: update, error: updateError } = await supabase
      .from('updates')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating update:', updateError);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      // Delete existing items
      await supabase
        .from('update_items')
        .delete()
        .eq('update_id', id);

      // Insert new items
      if (items.length > 0) {
        const itemsToInsert = items.map((item: any, index: number) => ({
          update_id: id,
          title: item.title,
          description: item.description,
          category: item.category || 'feature',
          icon: item.icon || '✨',
          order_index: item.order_index !== undefined ? item.order_index : index
        }));

        await supabase
          .from('update_items')
          .insert(itemsToInsert);
      }
    }

    return NextResponse.json({
      success: true,
      update
    });
  } catch (error) {
    console.error('Error in update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete an update
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;

    // Delete update (items will be deleted via CASCADE)
    const { error } = await supabase
      .from('updates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting update:', error);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

