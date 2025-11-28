import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // @ts-ignore
    const discordId = session.user.discordId

    // Verify admin
    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .single()

    if (!adminUser?.is_admin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin only' },
        { status: 403 }
      )
    }

    // Fetch all conversations with user info
    const { data: conversations, error } = await supabaseAdmin
      .from('chat_conversations')
      .select(`
        *,
        users!chat_conversations_user_id_fkey(discord_tag, avatar_url)
      `)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      )
    }

    return NextResponse.json({ conversations: conversations || [] })

  } catch (error) {
    console.error('Error in admin chat conversations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

