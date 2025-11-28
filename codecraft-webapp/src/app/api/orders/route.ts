import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Get all orders for current user
export async function GET(request: NextRequest) {
  try {
    // Get user from NextAuth session
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // @ts-ignore - custom field
    const discordUserId = session.user.discordId

    if (!discordUserId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 })
    }

    // Get user from Supabase
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordUserId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's orders
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Create new order
export async function POST(request: NextRequest) {
  try {
    // Get user from NextAuth session
    const session = await getServerSession(authOptions)
    
    console.log('📝 Order POST - Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      // @ts-ignore
      discordId: session?.user?.discordId
    })

    if (!session?.user) {
      console.error('❌ No session found')
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'You must be logged in to create an order. Please login via Discord.'
      }, { status: 401 })
    }
    
    // @ts-ignore - custom field
    const discordUserId = session.user.discordId
    
    if (!discordUserId) {
      return NextResponse.json({ 
        error: 'Invalid session',
        message: 'No Discord ID found in session'
      }, { status: 400 })
    }

    const body = await request.json()
    const { 
      serviceType, 
      serviceName, 
      projectName, 
      description,
      discordGuildId,
      budget, 
      timeline,
      price,
      additionalInfo,
      contactMethod,
      selected_addons,
      discount_code
    } = body

    console.log('Creating order:', body)

    // Get or create user in Supabase
    let user
    try {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('discord_id', discordUserId)
        .single()

      user = existingUser
    } catch (error) {
      console.log('User not found in DB, will use session data')
    }

    // Generate order number
    const orderNumber = `CC${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(-3).toUpperCase()}`

    // Create order in Supabase (if configured)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: order, error } = await supabaseAdmin
          .from('orders')
          .insert({
            order_number: orderNumber,
            user_id: user?.id || null,
            discord_id: discordUserId,
            discord_guild_id: discordGuildId || null,
            service_type: serviceType,
            service_name: serviceName,
            project_name: projectName,
            description: description,
            budget: budget,
            timeline: timeline,
            price: discount_code ? discount_code.final_price : (price ? parseFloat(price) : null),
            additional_info: additionalInfo,
            contact_method: contactMethod,
            selected_addons: selected_addons || [],
            status: 'pending',
            payment_status: 'pending',
          })
          .select()
          .single()

        if (error) {
          console.error('Supabase error:', error)
        } else {
          console.log('Order created in Supabase:', order)
          
          // If discount code was used, record it
          if (discount_code && order) {
            try {
              await supabaseAdmin
                .from('discount_code_usage')
                .insert({
                  discount_code_id: discount_code.id,
                  order_id: order.id,
                  user_discord_id: discordUserId,
                  discount_applied: discount_code.amount,
                  original_price: discount_code.original_price,
                  final_price: discount_code.final_price
                })
              
              console.log('✅ Discount code usage recorded')
            } catch (discountError) {
              console.error('⚠️ Failed to record discount usage:', discountError)
              // Don't fail the order if discount recording fails
            }
          }
        }
      } catch (supabaseError) {
        console.error('Error saving to Supabase:', supabaseError)
      }
    }

    // Optionally notify Discord bot
    if (process.env.DISCORD_WEBHOOK_URL) {
      try {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🆕 **New Order Received!**\n\n**Order:** ${orderNumber}\n**Service:** ${serviceName || serviceType}\n**Project:** ${projectName}\n**Budget:** $${budget}\n**Timeline:** ${timeline}\n\n${description}`,
          }),
        })
      } catch (webhookError) {
        console.error('Discord webhook error:', webhookError)
      }
    }

    return NextResponse.json({ 
      success: true,
      order_number: orderNumber,
      message: 'Order created successfully'
    })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
