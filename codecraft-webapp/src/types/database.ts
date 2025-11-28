export type User = {
  id: string
  discord_id: string
  discord_tag: string
  email?: string
  avatar_url?: string
  is_admin: boolean
  created_at: string
  updated_at: string
}

export type Order = {
  id: string
  order_number: string
  user_id: string
  discord_channel_id?: string
  status: 'pending' | 'quote_sent' | 'quote_accepted' | 'contract_accepted' | 'in_progress' | 'completed' | 'cancelled'
  service_type: string
  service_details?: {
    description?: string
    budget?: string
    timeline?: string
    requirements?: string
  }
  price?: number
  payment_method?: string
  payment_status: 'pending' | 'awaiting_payment' | 'paid' | 'refunded'
  created_at: string
  completed_at?: string
}

export type Ticket = {
  id: string
  ticket_number: string
  user_id: string
  discord_channel_id?: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_at: string
  closed_at?: string
}

export type Message = {
  id: string
  ticket_id?: string
  order_id?: string
  sender_id: string
  content: string
  is_ai: boolean
  created_at: string
}

export type Review = {
  id: string
  order_id: string
  user_id: string
  rating: number
  comment?: string
  display_name?: string
  created_at: string
}

export type PortfolioItem = {
  id: string
  title: string
  category: string
  client?: string
  description?: string
  technologies: string[]
  features: string[]
  results?: string
  timeline?: string
  budget?: string
  image_url?: string
  display_order: number
  is_featured: boolean
  created_at: string
}

export type Suggestion = {
  id: string
  user_id: string
  discord_id: string
  discord_tag: string
  guild_id?: string
  title: string
  description: string
  category: 'bug' | 'feature' | 'improvement' | 'other'
  priority?: 'low' | 'medium' | 'high'
  status: 'pending' | 'under_review' | 'planned' | 'in_progress' | 'completed' | 'rejected'
  admin_notes?: string
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id'>>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'created_at'>
        Update: Partial<Omit<Order, 'id'>>
      }
      tickets: {
        Row: Ticket
        Insert: Omit<Ticket, 'id' | 'created_at'>
        Update: Partial<Omit<Ticket, 'id'>>
      }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'created_at'>
        Update: Partial<Omit<Message, 'id'>>
      }
      reviews: {
        Row: Review
        Insert: Omit<Review, 'id' | 'created_at'>
        Update: Partial<Omit<Review, 'id'>>
      }
      portfolio: {
        Row: PortfolioItem
        Insert: Omit<PortfolioItem, 'id' | 'created_at'>
        Update: Partial<Omit<PortfolioItem, 'id'>>
      }
      suggestions: {
        Row: Suggestion
        Insert: Omit<Suggestion, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Suggestion, 'id' | 'created_at'>>
      }
    }
  }
}
