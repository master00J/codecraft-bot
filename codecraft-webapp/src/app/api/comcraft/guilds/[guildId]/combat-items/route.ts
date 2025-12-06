import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getGuildAccess(guildId: string, discordId: string) {
  const { data: guild, error: guildError } = await supabaseAdmin
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (guildError || !guild) {
    console.error('Guild lookup error:', guildError);
    return { allowed: false, reason: 'Guild not found' };
  }

  if (guild.owner_discord_id === discordId) {
    return { allowed: true };
  }

  const { data: authorized } = await supabaseAdmin
    .from('authorized_users')
    .select('user_id')
    .eq('guild_id', guildId)
    .eq('user_id', discordId)
    .maybeSingle();

  if (authorized) {
    return { allowed: true };
  }

  // Check if user is platform admin
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return { allowed: true };
  }

  console.log('Access denied for user', discordId, 'to guild', guildId);
  return { allowed: false, reason: 'Access denied' };
}

/**
 * GET /api/comcraft/guilds/[guildId]/combat-items
 * Fetch all combat items for a guild
 */
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

    // Get all combat items for this guild
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('guild_combat_items')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.error('Error fetching combat items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    // Map database fields to frontend fields
    const mappedItems = (items || []).map((item: any) => ({
      ...item,
      item_type: item.type, // Map: type → item_type
      crit_bonus: item.crit_chance_bonus, // Map: crit_chance_bonus → crit_bonus
      level_requirement: item.required_level, // Map: required_level → level_requirement
      is_available: item.is_active, // Map: is_active → is_available
      effect: item.effect_type, // Map: effect_type → effect
      current_stock: item.max_stock, // For display purposes
    }));

    return NextResponse.json({ items: mappedItems });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/combat-items:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comcraft/guilds/[guildId]/combat-items
 * Create or update a combat item
 */
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

    const body = await request.json();
    const { 
      id,
      name,
      description,
      item_type,
      rarity,
      price,
      damage_bonus,
      defense_bonus,
      hp_bonus,
      crit_bonus,
      level_requirement,
      max_stock,
      is_available,
      icon_url,
      effect,
      metadata
    } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!item_type || !['weapon', 'armor', 'consumable'].includes(item_type)) {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 });
    }

    if (!rarity || !['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(rarity)) {
      return NextResponse.json({ error: 'Invalid rarity' }, { status: 400 });
    }

    if (price === undefined || price < 0) {
      return NextResponse.json({ error: 'Price must be non-negative' }, { status: 400 });
    }

    // Build item data (map frontend field names to database field names)
    const itemData: any = {
      guild_id: guildId,
      name: name.trim(),
      description: description?.trim() || null,
      type: item_type, // Map: item_type → type
      rarity,
      price,
      damage_bonus: damage_bonus || 0,
      defense_bonus: defense_bonus || 0,
      hp_bonus: hp_bonus || 0,
      crit_chance_bonus: crit_bonus || 0, // Map: crit_bonus → crit_chance_bonus
      required_level: level_requirement || 1, // Map: level_requirement → required_level
      max_stock: max_stock || null,
      is_active: is_available !== undefined ? is_available : true, // Map: is_available → is_active
      icon_url: icon_url || null,
      effect_type: effect || null,
    };

    let result;
    if (id) {
      // Update existing item
      itemData.updated_at = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('guild_combat_items')
        .update(itemData)
        .eq('id', id)
        .eq('guild_id', guildId) // Ensure user can only update items in their guild
        .select()
        .single();

      if (error) {
        console.error('Error updating combat item:', error);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
      }

      result = data;
    } else {
      // Create new item
      const { data, error } = await supabaseAdmin
        .from('guild_combat_items')
        .insert(itemData)
        .select()
        .single();

      if (error) {
        console.error('Error creating combat item:', error);
        return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
      }

      result = data;
    }

    // Map database fields to frontend fields
    const mappedItem = result ? {
      ...result,
      item_type: result.type,
      crit_bonus: result.crit_chance_bonus,
      level_requirement: result.required_level,
      is_available: result.is_active,
      effect: result.effect_type,
      current_stock: result.max_stock,
    } : null;

    return NextResponse.json({ item: mappedItem, success: true });
  } catch (error: any) {
    console.error('Error in POST /api/comcraft/guilds/[guildId]/combat-items:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/comcraft/guilds/[guildId]/combat-items
 * Delete a combat item
 */
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

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id');

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Delete the item
    const { error } = await supabaseAdmin
      .from('guild_combat_items')
      .delete()
      .eq('id', itemId)
      .eq('guild_id', guildId); // Ensure user can only delete items in their guild

    if (error) {
      console.error('Error deleting combat item:', error);
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/comcraft/guilds/[guildId]/combat-items:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

