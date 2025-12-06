import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Get all scheduled messages for a guild
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

    const guildId = params.guildId

    // Verify user has access to this guild
    const { data: guild, error: guildError } = await supabaseAdmin
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single()

    if (guildError || !guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Check if user is owner or authorized
    const isOwner = guild.owner_discord_id === session.user.discordId
    if (!isOwner) {
      // Check if user is authorized
      const { data: authorized } = await supabaseAdmin
        .from('authorized_users')
        .select('role')
        .eq('guild_id', guildId)
        .eq('discord_id', session.user.discordId)
        .single()

      if (!authorized) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Get scheduled messages
    const { data: messages, error } = await supabaseAdmin
      .from('scheduled_messages')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching scheduled messages:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ messages: messages || [], success: true })
  } catch (error) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/scheduled-messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a new scheduled message
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

    const guildId = params.guildId
    const body = await request.json()

    // Verify user has access to this guild
    const { data: guild, error: guildError } = await supabaseAdmin
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single()

    if (guildError || !guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // Check if user is owner or authorized
    const isOwner = guild.owner_discord_id === session.user.discordId
    if (!isOwner) {
      // Check if user is authorized
      const { data: authorized } = await supabaseAdmin
        .from('authorized_users')
        .select('role')
        .eq('guild_id', guildId)
        .eq('discord_id', session.user.discordId)
        .single()

      if (!authorized) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Validate required fields
    if (!body.channelId || !body.scheduleType || !body.scheduleTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate next send time with timezone support
    const timezone = body.timezone || 'UTC'
    const [hours, minutes] = body.scheduleTime.split(':').map(Number)
    
    // Helper: Create a Date object representing a specific time in a specific timezone
    // This interprets the time as being in the given timezone and converts to UTC
    const createDateInTimezone = (year: number, month: number, day: number, hour: number, minute: number, tz: string): Date => {
      // Create a date string in ISO format
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
      
      // Method: Use Intl.DateTimeFormat to find what UTC time corresponds to this local time
      // We'll iterate to find the correct UTC time
      let candidateUTC = new Date(dateStr + 'Z') // Start with UTC assumption
      
      // Get what this UTC time displays as in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      
      // Try to find the correct UTC time by adjusting
      for (let attempts = 0; attempts < 3; attempts++) {
        const parts = formatter.formatToParts(candidateUTC)
        const tzHour = parseInt(parts.find(p => p.type === 'hour')!.value)
        const tzMinute = parseInt(parts.find(p => p.type === 'minute')!.value)
        
        const diffMinutes = (hour * 60 + minute) - (tzHour * 60 + tzMinute)
        
        if (Math.abs(diffMinutes) < 1) {
          break // Close enough
        }
        
        // Adjust candidate UTC by the difference
        candidateUTC = new Date(candidateUTC.getTime() + diffMinutes * 60 * 1000)
      }
      
      return candidateUTC
    }
    
    // Get current date/time in the specified timezone
    const now = new Date()
    const nowInTz = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now)
    
    const nowYear = parseInt(nowInTz.find(p => p.type === 'year')!.value)
    const nowMonth = parseInt(nowInTz.find(p => p.type === 'month')!.value) - 1
    const nowDay = parseInt(nowInTz.find(p => p.type === 'day')!.value)
    const nowHour = parseInt(nowInTz.find(p => p.type === 'hour')!.value)
    const nowMinute = parseInt(nowInTz.find(p => p.type === 'minute')!.value)
    
    // Create target time for today in the timezone, then convert to UTC
    let nextSend = createDateInTimezone(nowYear, nowMonth, nowDay, hours, minutes, timezone)
    
    // Check if time has passed today in the timezone
    const timePassed = nowHour > hours || (nowHour === hours && nowMinute >= minutes)

    if (body.scheduleType === 'daily') {
      if (timePassed) {
        // Schedule for tomorrow in the timezone
        const tomorrow = new Date(nowYear, nowMonth, nowDay + 1)
        const tomorrowInTz = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).formatToParts(tomorrow)
        const tomorrowYear = parseInt(tomorrowInTz.find(p => p.type === 'year')!.value)
        const tomorrowMonth = parseInt(tomorrowInTz.find(p => p.type === 'month')!.value) - 1
        const tomorrowDay = parseInt(tomorrowInTz.find(p => p.type === 'day')!.value)
        nextSend = createDateInTimezone(tomorrowYear, tomorrowMonth, tomorrowDay, hours, minutes, timezone)
      }
    } else if (body.scheduleType === 'weekly') {
      const days = body.scheduleDays || []
      if (days.length === 0) {
        return NextResponse.json({ error: 'Weekly schedule requires scheduleDays' }, { status: 400 })
      }
      const currentDayOfWeek = new Date(nowYear, nowMonth, nowDay).getDay()
      let daysUntilNext = null
      for (const day of days.sort((a: number, b: number) => a - b)) {
        if (day > currentDayOfWeek) {
          daysUntilNext = day - currentDayOfWeek
          break
        }
      }
      if (daysUntilNext === null) {
        daysUntilNext = (7 - currentDayOfWeek) + days[0]
      }
      const targetDate = new Date(nowYear, nowMonth, nowDay + daysUntilNext)
      const targetInTz = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(targetDate)
      const targetYear = parseInt(targetInTz.find(p => p.type === 'year')!.value)
      const targetMonth = parseInt(targetInTz.find(p => p.type === 'month')!.value) - 1
      const targetDay = parseInt(targetInTz.find(p => p.type === 'day')!.value)
      nextSend = createDateInTimezone(targetYear, targetMonth, targetDay, hours, minutes, timezone)
    } else if (body.scheduleType === 'custom') {
      // For custom cron, set to 1 hour from now as placeholder
      nextSend = new Date(now.getTime() + 60 * 60 * 1000)
    }

    // Create scheduled message
    const { data: message, error } = await supabaseAdmin
      .from('scheduled_messages')
      .insert({
        guild_id: guildId,
        channel_id: body.channelId,
        message_content: body.content || null,
        message_embed: body.embed || null,
        schedule_type: body.scheduleType,
        schedule_time: body.scheduleTime,
        schedule_days: body.scheduleDays || null,
        schedule_cron: body.scheduleCron || null,
        timezone: body.timezone || 'UTC',
        is_active: body.isActive !== false,
        created_by: session.user.discordId,
        next_send_at: nextSend.toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating scheduled message:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ message, success: true })
  } catch (error) {
    console.error('Error in POST /api/comcraft/guilds/[guildId]/scheduled-messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

