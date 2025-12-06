/**
 * API Route: Auto-Roles Management
 * /api/comcraft/guilds/[guildId]/autoroles
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:25836';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

// GET - Fetch all role menus
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: menus, error } = await supabase
      .from('role_menus')
      .select(`
        *,
        options:role_menu_options(*)
      `)
      .eq('guild_id', params.guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching role menus:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ menus: menus || [] });
  } catch (error) {
    console.error('Error in autoroles API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new role menu
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

    const body = await request.json();

    // Create menu
    const { data: menu, error: menuError } = await supabase
      .from('role_menus')
      .insert({
        guild_id: params.guildId,
        menu_name: body.menu_name,
        menu_type: body.menu_type || 'buttons',
        channel_id: body.channel_id,
        embed_title: body.embed_title,
        embed_description: body.embed_description,
        embed_color: body.embed_color || '#5865F2',
        max_roles: body.max_roles || 0,
        required_role_id: body.required_role_id || null
      })
      .select()
      .single();

    if (menuError) {
      console.error('Error creating menu:', menuError);
      return NextResponse.json({ error: menuError.message }, { status: 500 });
    }

    // Create options
    if (body.options && body.options.length > 0) {
      const options = body.options.map((opt: any, index: number) => ({
        menu_id: menu.id,
        guild_id: params.guildId,
        role_id: opt.role_id,
        role_name: opt.role_name,
        button_label: opt.button_label || opt.role_name,
        button_emoji: opt.button_emoji || null,
        button_style: opt.button_style || 'primary',
        description: opt.description || null,
        is_verify_button: opt.is_verify_button || false,
        position: index
      }));

      const { error: optionsError } = await supabase
        .from('role_menu_options')
        .insert(options);

      if (optionsError) {
        console.error('Error creating options:', optionsError);
        // Rollback menu creation
        await supabase.from('role_menus').delete().eq('id', menu.id);
        return NextResponse.json({ error: 'Failed to create options' }, { status: 500 });
      }
    }

    // Tell bot to post the menu to Discord
    try {
      const postResponse = await fetch(`${COMCRAFT_BOT_API}/api/autoroles/${menu.id}/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET!
        }
      });

      const postResult = await postResponse.json();
      
      if (!postResult.success) {
        console.error('Bot failed to post menu:', postResult.error);
        return NextResponse.json({ error: postResult.error || 'Bot kon de rolmenu niet plaatsen.' }, { status: 400 });
      }
    } catch (err) {
      console.error('Error calling bot API:', err);
    }

    return NextResponse.json({ success: true, menu });
  } catch (error) {
    console.error('Error creating role menu:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update role menu
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const menuId = body.id;

    if (!menuId) {
      return NextResponse.json({ error: 'Menu ID required' }, { status: 400 });
    }

    // Update menu
    const { error: menuError } = await supabase
      .from('role_menus')
      .update({
        menu_name: body.menu_name,
        menu_type: body.menu_type,
        channel_id: body.channel_id,
        embed_title: body.embed_title,
        embed_description: body.embed_description,
        embed_color: body.embed_color,
        max_roles: body.max_roles,
        required_role_id: body.required_role_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', menuId)
      .eq('guild_id', params.guildId);

    if (menuError) {
      console.error('Error updating menu:', menuError);
      return NextResponse.json({ error: menuError.message }, { status: 500 });
    }

    // Delete old options
    await supabase
      .from('role_menu_options')
      .delete()
      .eq('menu_id', menuId);

    // Insert new options
    if (body.options && body.options.length > 0) {
      const options = body.options.map((opt: any, index: number) => ({
        menu_id: menuId,
        guild_id: params.guildId,
        role_id: opt.role_id,
        role_name: opt.role_name,
        button_label: opt.button_label || opt.role_name,
        button_emoji: opt.button_emoji || null,
        button_style: opt.button_style || 'primary',
        description: opt.description || null,
        is_verify_button: opt.is_verify_button || false,
        position: index
      }));

      const { error: optionsError } = await supabase
        .from('role_menu_options')
        .insert(options);

      if (optionsError) {
        console.error('Error updating options:', optionsError);
        return NextResponse.json({ error: 'Failed to update options' }, { status: 500 });
      }
    }

    // Tell bot to update the menu in Discord
    try {
      const updateResponse = await fetch(`${COMCRAFT_BOT_API}/api/autoroles/${menuId}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET!
        }
      });

      const updateResult = await updateResponse.json();
      
      if (!updateResult.success) {
        console.error('Bot failed to update menu:', updateResult.error);
        return NextResponse.json({ error: updateResult.error || 'Bot kon de rolmenu niet bijwerken.' }, { status: 400 });
      }
    } catch (err) {
      console.error('Error calling bot API:', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating role menu:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete role menu
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const menuId = searchParams.get('id');

    if (!menuId) {
      return NextResponse.json({ error: 'Menu ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('role_menus')
      .delete()
      .eq('id', menuId)
      .eq('guild_id', params.guildId);

    if (error) {
      console.error('Error deleting menu:', error);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete autoroles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

