import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await request.json()
    const { guest_id, guest_name } = body

    let discordId = null
    let guestIdentifier = null

    if (session?.user) {
      // @ts-ignore
      discordId = session.user.discordId
    } else if (guest_id) {
      guestIdentifier = guest_id
    } else {
      return NextResponse.json(
        { error: 'No user identifier provided' },
        { status: 400 }
      )
    }

    // Check if user already has an open conversation
    let existingConv = null
    
    if (discordId) {
      const { data } = await supabaseAdmin
        .from('chat_conversations')
        .select('*')
        .eq('discord_id', discordId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      existingConv = data
    } else if (guestIdentifier) {
      const { data } = await supabaseAdmin
        .from('chat_conversations')
        .select('*')
        .eq('guest_id', guestIdentifier)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      existingConv = data
    }

    let conversationId = existingConv?.id

    // Create new conversation if none exists
    if (!conversationId) {
      const insertData: any = {
        status: 'open'
      }

      if (discordId) {
        insertData.discord_id = discordId
      } else {
        insertData.guest_id = guestIdentifier
        insertData.guest_name = guest_name || 'Guest'
      }

      const { data: newConv, error: convError } = await supabaseAdmin
        .from('chat_conversations')
        .insert(insertData)
        .select()
        .single()

      if (convError || !newConv) {
        console.error('Error creating conversation:', convError)
        return NextResponse.json(
          { error: 'Failed to create conversation' },
          { status: 500 }
        )
      }

      conversationId = newConv.id
    }

    // Fetch messages
    const { data: messages } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      conversation: { id: conversationId },
      messages: messages || []
    })

  } catch (error) {
    console.error('Error in chat init:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

