import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - Fetch all authorized users for a guild
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    const requestingUserId = session.user.discordId

    // Check if requesting user is owner or platform admin
    const { data: guild } = await supabaseAdmin
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single()

    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Check if user is platform admin
    const { data: platformUser } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('discord_id', requestingUserId)
      .maybeSingle()

    const isPlatformAdmin = platformUser?.is_admin === true
    const isGuildOwner = guild.owner_discord_id === requestingUserId

    if (!isPlatformAdmin && !isGuildOwner) {
      return NextResponse.json({ error: 'Only guild owner or platform admin can view admins' }, { status: 403 })
    }

    // Get all authorized users
    const { data: authorizedUsers, error } = await supabaseAdmin
      .from('guild_authorized_users')
      .select('*')
      .eq('guild_id', guildId)
      .order('added_at', { ascending: false })

    if (error) {
      throw error
    }

    // Also include owner in the list
    const ownerEntry = {
      id: null,
      guild_id: guildId,
      discord_id: guild.owner_discord_id,
      role: 'owner',
      added_by: null,
      added_at: null
    }

    return NextResponse.json({
      success: true,
      authorizedUsers: [ownerEntry, ...(authorizedUsers || [])]
    })

  } catch (error) {
    console.error('Error fetching authorized users:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Add admin to guild
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    const requestingUserId = session.user.discordId

    const { discordId: rawDiscordId, role = 'admin' } = await request.json()

    if (!rawDiscordId) {
      return NextResponse.json({ error: 'Discord ID required' }, { status: 400 })
    }

    // Normalize Discord ID to string (Discord IDs can be very large numbers)
    const discordId = String(rawDiscordId).trim()

    // Check if requesting user is owner or platform admin
    const { data: guild } = await supabaseAdmin
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single()

    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Check if user is platform admin
    const { data: platformUser } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('discord_id', requestingUserId)
      .single()

    const isPlatformAdmin = platformUser?.is_admin === true
    const isGuildOwner = guild.owner_discord_id === requestingUserId

    if (!isPlatformAdmin && !isGuildOwner) {
      return NextResponse.json({ error: 'Only guild owner or platform admin can add admins' }, { status: 403 })
    }

    // Add user to authorized list
    const { error: insertError } = await supabaseAdmin
      .from('guild_authorized_users')
      .insert({
        guild_id: guildId,
        discord_id: discordId,
        role: role,
        added_by: requestingUserId
      })

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'User already authorized' }, { status: 400 })
      }
      throw insertError
    }

    return NextResponse.json({
      success: true,
      message: 'Admin toegevoegd'
    })

  } catch (error) {
    console.error('Error adding admin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Remove admin from guild
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    const requestingUserId = session.user.discordId

    const { searchParams } = new URL(request.url)
    const discordId = searchParams.get('discordId')

    if (!discordId) {
      return NextResponse.json({ error: 'Discord ID required' }, { status: 400 })
    }

    // Check permissions (same as POST)
    const { data: guild } = await supabaseAdmin
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single()

    if (!guild || guild.owner_discord_id !== requestingUserId) {
      return NextResponse.json({ error: 'Only guild owner can remove admins' }, { status: 403 })
    }

    // Cannot remove owner
    if (discordId === guild.owner_discord_id) {
      return NextResponse.json({ error: 'Cannot remove guild owner' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('guild_authorized_users')
      .delete()
      .eq('guild_id', guildId)
      .eq('discord_id', discordId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Admin verwijderd'
    })

  } catch (error) {
    console.error('Error removing admin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

