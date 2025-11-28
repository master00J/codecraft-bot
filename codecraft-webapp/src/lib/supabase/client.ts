import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { User, Order, Ticket, PortfolioItem, Review } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const SUPABASE_MISSING_MESSAGE =
  'Supabase environment variables are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'

type GenericSupabaseClient = SupabaseClient<any, any, any>

function createMockClient(): GenericSupabaseClient {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get() {
      return () => {
        throw new Error(SUPABASE_MISSING_MESSAGE)
      }
    }
  }

  return new Proxy({}, handler) as unknown as GenericSupabaseClient
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false
      }
    })
  : createMockClient()

function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(SUPABASE_MISSING_MESSAGE)
  }
}

// Helper functions
export async function getUser(discordId: string) {
  ensureSupabaseConfigured()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('discord_id', discordId)
    .limit(1)
    .maybeSingle<User>()
  
  return { data, error }
}

export async function getUserOrders(userId: string) {
  ensureSupabaseConfigured()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<Order[]>()
  
  return { data, error }
}

export async function getOrderById(orderId: string) {
  ensureSupabaseConfigured()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .limit(1)
    .maybeSingle<Order>()
  
  return { data, error }
}

export async function getUserTickets(userId: string) {
  ensureSupabaseConfigured()
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<Ticket[]>()
  
  return { data, error }
}

export async function getPortfolioItems() {
  ensureSupabaseConfigured()
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .order('display_order', { ascending: true })
    .returns<PortfolioItem[]>()
  
  return { data, error }
}

export async function getReviews(limit = 10) {
  ensureSupabaseConfigured()
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<Review[]>()
  
  return { data, error }
}

export async function getAllOrders() {
  ensureSupabaseConfigured()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<Order[]>()
  
  return { data, error }
}
