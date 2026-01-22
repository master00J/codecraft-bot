import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

// Webhook to receive updates from Discord bot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    // Verify webhook secret (support bot token or internal secret)
    const authHeader = request.headers.get('authorization')
    const internalSecret = request.headers.get('x-internal-secret')
    const botToken = process.env.DISCORD_BOT_TOKEN
    const expectedAuth = botToken ? `Bearer ${botToken}` : null
    const internalKey = process.env.INTERNAL_API_SECRET

    const isAuthorized =
      (expectedAuth && authHeader === expectedAuth) ||
      (internalKey && internalSecret === internalKey)

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    switch (type) {
      case 'order.created':
        // Sync order to Supabase
        await supabaseAdmin.from('orders').insert({
          order_number: data.order_number,
          user_id: data.user_id,
          discord_channel_id: data.channel_id,
          service_type: data.service_type,
          service_details: data.service_details,
          status: 'pending',
          payment_status: 'pending',
        } as any)
        break

      case 'order.updated':
        // Update order in Supabase
        await supabaseAdmin
          .from('orders')
          .update({
            status: data.status,
            price: data.price,
            payment_status: data.payment_status,
            payment_method: data.payment_method,
          } as any)
          .eq('order_number', data.order_number)
        break

      case 'ticket.created':
        // Sync ticket to Supabase
        await supabaseAdmin.from('tickets').insert({
          ticket_number: data.ticket_number,
          user_id: data.user_id,
          discord_channel_id: data.channel_id,
          subject: data.subject,
          status: 'open',
          priority: data.priority || 'normal',
        } as any)
        break

      case 'ticket.updated':
        // Update ticket
        await supabaseAdmin
          .from('tickets')
          .update({
            status: data.status,
          } as any)
          .eq('ticket_number', data.ticket_number)
        break

      case 'review.created':
        // Sync review
        await supabaseAdmin.from('reviews').insert({
          order_id: data.order_id,
          user_id: data.user_id,
          rating: data.rating,
          comment: data.comment,
          display_name: data.display_name,
        } as any)
        break
      case 'timeclock.clock_in': {
        const { guild_id, user_id, clock_in_at } = data || {}

        if (!guild_id || !user_id) {
          return NextResponse.json({ error: 'Missing guild_id or user_id' }, { status: 400 })
        }

        const { data: activeEntry } = await supabaseAdmin
          .from('employee_time_entries')
          .select('id')
          .eq('guild_id', guild_id)
          .eq('user_id', user_id)
          .eq('status', 'active')
          .maybeSingle()

        if (!activeEntry) {
          await supabaseAdmin.from('employee_time_entries').insert({
            guild_id,
            user_id,
            clock_in_at: clock_in_at || new Date().toISOString(),
            status: 'active',
            source: 'bot',
          } as any)
        }
        break
      }

      case 'timeclock.clock_out': {
        const { guild_id, user_id, clock_out_at } = data || {}

        if (!guild_id || !user_id) {
          return NextResponse.json({ error: 'Missing guild_id or user_id' }, { status: 400 })
        }

        const { data: activeEntry } = await supabaseAdmin
          .from('employee_time_entries')
          .select('id')
          .eq('guild_id', guild_id)
          .eq('user_id', user_id)
          .eq('status', 'active')
          .maybeSingle()

        if (activeEntry?.id) {
          await supabaseAdmin
            .from('employee_time_entries')
            .update({
              clock_out_at: clock_out_at || new Date().toISOString(),
              status: 'completed',
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', activeEntry.id)
        }
        break
      }

      default:
        console.warn(`Unknown webhook type: ${type}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
