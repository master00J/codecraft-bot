"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { MessageCircle, X, Send, Loader2, Minimize2, Maximize2, Bot, Headphones } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase/client"

interface Message {
  id: string
  message: string
  sender_name: string
  is_admin: boolean
  created_at: string
}

interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export function ChatWidget() {
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const pathname = usePathname()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const aiMessagesEndRef = useRef<HTMLDivElement>(null)

  // Check if we're in dashboard
  const isInDashboard = pathname?.includes('/dashboard/') || pathname?.includes('/comcraft/')

  // Chat tab state
  const [activeTab, setActiveTab] = useState<'support' | 'ai'>('support')
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [guestId, setGuestId] = useState<string>("")

  // Live Support state
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [avgResponseTime, setAvgResponseTime] = useState<string>("2 hours")

  // AI Assistant state
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [aiInput, setAiInput] = useState("")
  const [isAiThinking, setIsAiThinking] = useState(false)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const scrollAiToBottom = () => {
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    scrollAiToBottom()
  }, [aiMessages])

  // Initialize guest ID for anonymous users
  useEffect(() => {
    let id = localStorage.getItem('chat_guest_id')
    if (!id) {
      id = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('chat_guest_id', id)
    }
    setGuestId(id)
  }, [])

  // Fetch average response time
  useEffect(() => {
    fetchResponseStats()
  }, [])

  // Load or create conversation when chat opens
  useEffect(() => {
    if (isOpen && !conversationId && guestId) {
      initializeChat()
    }
  }, [isOpen, guestId])

  // Subscribe to realtime messages
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`chat:${conversationId}`, {
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
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('📨 New message received via postgres_changes:', payload)
          const newMsg = payload.new as Message
          setMessages(prev => {
            // Prevent duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          
          // Show notification if admin message and chat is closed
          if (newMsg.is_admin && !isOpen) {
            setUnreadCount(prev => prev + 1)
            toast({
              title: "New message from support",
              description: newMsg.message.substring(0, 50) + "..."
            })
          }
        }
      )
      .on('broadcast', { event: 'new_message' }, (payload) => {
        console.log('📨 New message received via broadcast:', payload)
        const newMsg = payload.payload as Message
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        
        // Show notification if admin message and chat is closed
        if (newMsg.is_admin && !isOpen) {
          setUnreadCount(prev => prev + 1)
          toast({
            title: "New message from support",
            description: newMsg.message.substring(0, 50) + "..."
          })
        }
      })
      .subscribe((status) => {
        console.log('📡 Chat subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, isOpen])

  const fetchResponseStats = async () => {
    try {
      const response = await fetch('/api/chat/stats')
      const data = await response.json()
      
      if (response.ok && data.avgResponseSeconds) {
        const seconds = data.avgResponseSeconds
        if (seconds < 60) {
          setAvgResponseTime(`${Math.round(seconds)} seconds`)
        } else if (seconds < 3600) {
          const minutes = Math.round(seconds / 60)
          setAvgResponseTime(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
        } else {
          const hours = Math.round(seconds / 3600)
          setAvgResponseTime(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
        }
      }
    } catch (error) {
      console.log('Could not fetch response stats:', error)
    }
  }

  const initializeChat = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/chat/init', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          guest_id: guestId,
          guest_name: session?.user?.name || localStorage.getItem('chat_guest_name')
        })
      })
      const data = await response.json()

      if (response.ok && data.conversation) {
        setConversationId(data.conversation.id)
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Error initializing chat:', error)
      toast({
        title: "Error",
        description: "Could not load chat",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return

    setIsSending(true)
    const messageToSend = newMessage
    setNewMessage("") // Clear input immediately
    
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: messageToSend,
          guest_id: guestId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      
      // Broadcast the new message to all subscribers (including self)
      if (data.message) {
        const channel = supabase.channel(`chat:${conversationId}`)
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

  const sendAiMessage = async () => {
    if (!aiInput.trim()) return

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: aiInput,
      created_at: new Date().toISOString()
    }

    setAiMessages(prev => [...prev, userMessage])
    setAiInput("")
    setIsAiThinking(true)

    try {
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_history: aiMessages.map(m => ({
            role: m.role,
            content: m.content
          })),
          context: {
            pathname,
            guildId: pathname?.match(/dashboard\/([^\/]+)/)?.[1],
          }
        })
      })

      if (!response.ok) throw new Error('AI request failed')

      const data = await response.json()

      const assistantMessage: AIMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString()
      }

      setAiMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsAiThinking(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (activeTab === 'ai') {
        sendAiMessage()
      } else {
        sendMessage()
      }
    }
  }

  const toggleOpen = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setUnreadCount(0)
      setIsMinimized(false)
    }
  }

  // Always show chat widget (also for guests)
  return (
    <>
      {/* Chat Widget */}
      {isOpen && (
        <div className={`fixed bottom-20 right-6 w-96 bg-background border rounded-lg shadow-2xl z-50 flex flex-col transition-all ${
          isMinimized ? 'h-14' : 'h-[600px]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">Support Chat</h3>
                <p className="text-xs opacity-90">Average response time: {avgResponseTime}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={toggleOpen}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageCircle className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Start a conversation with our support team
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.is_admin
                            ? 'bg-muted'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        {msg.is_admin && (
                          <p className="text-xs font-semibold mb-1 opacity-70">
                            {msg.sender_name} (Support)
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        <p className={`text-xs mt-1 ${msg.is_admin ? 'text-muted-foreground' : 'opacity-70'}`}>
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
              <div className="p-4 border-t bg-background">
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
          )}
        </div>
      )}

      {/* Floating Button */}
      <Button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {unreadCount}
              </Badge>
            )}
          </>
        )}
      </Button>
    </>
  )
}

