"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MessageCircle, Send, Loader2, User, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase/client"

interface Conversation {
  id: string
  discord_id: string
  guest_id?: string
  guest_name?: string
  guest_email?: string
  status: string
  created_at: string
  last_message_at: string
  users?: {
    discord_tag?: string
    avatar_url?: string
  }
  unread_count?: number
}

interface Message {
  id: string
  message: string
  sender_name: string
  is_admin: boolean
  created_at: string
}

export default function AdminChatPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv)
      subscribeToMessages(selectedConv)
    }
  }, [selectedConv])

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/admin/chat/conversations')
      const data = await response.json()

      if (response.ok) {
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMessages = async (convId: string) => {
    try {
      const response = await fetch(`/api/admin/chat/conversations/${convId}`)
      const data = await response.json()

      if (response.ok) {
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const subscribeToMessages = (convId: string) => {
    const channel = supabase
      .channel(`chat:${convId}`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${convId}`
        },
        (payload) => {
          console.log('📨 Admin: New message via postgres_changes:', payload)
          const newMsg = payload.new as Message
          setMessages(prev => {
            // Prevent duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        }
      )
      .on('broadcast', { event: 'new_message' }, (payload) => {
        console.log('📨 Admin: New message via broadcast:', payload)
        const newMsg = payload.payload as Message
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
      })
      .subscribe((status) => {
        console.log('📡 Admin chat subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return

    setIsSending(true)
    const messageToSend = newMessage
    setNewMessage("") // Clear input immediately
    
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConv,
          message: messageToSend
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      
      // Broadcast the new message to all subscribers (including self)
      if (data.message) {
        const channel = supabase.channel(`chat:${selectedConv}`)
        await channel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: data.message
        })
      }
    } catch (error) {
      setNewMessage(messageToSend) // Restore message on error
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const selectedConversation = conversations.find(c => c.id === selectedConv)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Live Chat Support</h1>
        <p className="text-muted-foreground">Manage customer conversations</p>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
        {/* Conversations List */}
        <Card className="col-span-4 p-4 flex flex-col">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Conversations ({conversations.length})
          </h2>
          <Separator className="mb-4" />

          <div className="space-y-2 overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConv(conv.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedConv === conv.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <div>
                        <p className="font-medium text-sm">
                          {conv.users?.discord_tag || conv.guest_name || conv.guest_id || 'Anonymous'}
                        </p>
                        <p className={`text-xs flex items-center gap-1 ${
                          selectedConv === conv.id ? 'opacity-80' : 'text-muted-foreground'
                        }`}>
                          <Clock className="h-3 w-3" />
                          {new Date(conv.last_message_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={conv.status === 'open' ? 'default' : 'secondary'}>
                      {conv.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Messages Panel */}
        <Card className="col-span-8 flex flex-col">
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {selectedConversation?.users?.discord_tag || selectedConversation?.guest_name || selectedConversation?.guest_id || 'Anonymous'}
                    </h3>
                    {selectedConversation?.guest_email && (
                      <p className="text-xs text-muted-foreground">{selectedConversation.guest_email}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Started {new Date(selectedConversation?.created_at || '').toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={selectedConversation?.status === 'open' ? 'default' : 'secondary'}>
                    {selectedConversation?.status}
                  </Badge>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No messages yet</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.is_admin
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {!msg.is_admin && (
                          <p className="text-xs font-semibold mb-1 opacity-70">
                            {msg.sender_name}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p className={`text-xs mt-1 ${msg.is_admin ? 'opacity-70' : 'text-muted-foreground'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isSending}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isSending || !newMessage.trim()}
                    size="icon"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Select a conversation to start</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

