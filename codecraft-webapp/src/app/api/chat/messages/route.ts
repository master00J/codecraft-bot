import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { conversation_id, message, guest_id } = await request.json()

    if (!conversation_id || !message?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let discordId = null
    let senderName = 'Guest'
    let senderId = guest_id || 'anonymous'
    let isAdmin = false

    if (session?.user) {
      // @ts-ignore
      discordId = session.user.discordId
      senderName = session.user.name || 'User'
      senderId = discordId

      // Check if admin
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('is_admin')
        .eq('discord_id', discordId)
        .single()
      
      isAdmin = user?.is_admin || false
    }

    // Verify conversation exists and user has access
    const { data: conversation } = await supabaseAdmin
      .from('chat_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single()

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Check if user owns this conversation or is admin
    const ownsConversation = 
      conversation.discord_id === discordId || 
      conversation.guest_id === guest_id

    if (!ownsConversation && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Insert message
    const { data: newMessage, error: messageError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        conversation_id,
        sender_id: senderId,
        sender_name: senderName,
        message: message.trim(),
        is_admin: isAdmin
      })
      .select()
      .single()

    if (messageError || !newMessage) {
      console.error('Error creating message:', messageError)
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      )
    }

    // Update conversation's last_message_at
    await supabaseAdmin
      .from('chat_conversations')
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id)

    // Trigger AI response for non-admin messages
    if (!isAdmin) {
      triggerAiResponse(conversation_id, message.trim()).catch(err => {
        console.error('AI response error:', err)
      })
    }

    return NextResponse.json({ message: newMessage })

  } catch (error) {
    console.error('Error in chat messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function triggerAiResponse(conversationId: string, userMessage: string) {
  try {
    // Fetch recent conversation history
    const { data: messages } = await supabaseAdmin
      .from('chat_messages')
      .select('message, is_admin, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10)

    const conversationHistory = (messages || []).reverse()

    // Call AI endpoint
    const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/chat/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        conversation_history: conversationHistory,
      }),
    })

    if (!aiResponse.ok) {
      throw new Error('AI API call failed')
    }

    const aiData = await aiResponse.json()

    if (aiData.success && aiData.response) {
      // Insert AI response as admin message
      await supabaseAdmin
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: 'ai_assistant',
          sender_name: 'CodeCraft AI',
          message: aiData.response,
          is_admin: true,
        })

      // Update conversation timestamp
      await supabaseAdmin
        .from('chat_conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId)
    }
  } catch (error) {
    console.error('Failed to generate AI response:', error)
    // Don't throw - we don't want to block the user's message
  }
}

