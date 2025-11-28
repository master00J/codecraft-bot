import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Update a scheduled message
export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guildId = params.guildId
    const messageId = params.id
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

    // Verify message belongs to this guild
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('scheduled_messages')
      .select('*')
      .eq('id', messageId)
      .eq('guild_id', guildId)
      .single()

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 })
    }

    // Recalculate next_send_at if schedule changed
    let updates: any = { ...body }
    if (body.scheduleType || body.scheduleTime || body.scheduleDays || body.scheduleCron) {
      const schedule = {
        scheduleType: body.scheduleType || existing.schedule_type,
        scheduleTime: body.scheduleTime || existing.schedule_time,
        scheduleDays: body.scheduleDays || existing.schedule_days,
        scheduleCron: body.scheduleCron || existing.schedule_cron
      }

      const timezone = body.timezone || existing.timezone || 'UTC'
      const [hours, minutes] = schedule.scheduleTime.split(':').map(Number)
      
      // Helper: Create a Date object representing a specific time in a specific timezone
      const createDateInTimezone = (year: number, month: number, day: number, hour: number, minute: number, tz: string): Date => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
        let candidateUTC = new Date(dateStr + 'Z')
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
        for (let attempts = 0; attempts < 3; attempts++) {
          const parts = formatter.formatToParts(candidateUTC)
          const tzHour = parseInt(parts.find(p => p.type === 'hour')!.value)
          const tzMinute = parseInt(parts.find(p => p.type === 'minute')!.value)
          const diffMinutes = (hour * 60 + minute) - (tzHour * 60 + tzMinute)
          if (Math.abs(diffMinutes) < 1) break
          candidateUTC = new Date(candidateUTC.getTime() + diffMinutes * 60 * 1000)
        }
        return candidateUTC
      }
      
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
      
      let nextSend = createDateInTimezone(nowYear, nowMonth, nowDay, hours, minutes, timezone)
      const timePassed = nowHour > hours || (nowHour === hours && nowMinute >= minutes)

      if (schedule.scheduleType === 'daily') {
        if (timePassed) {
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
      } else if (schedule.scheduleType === 'weekly') {
        const days = schedule.scheduleDays || []
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
      }

      updates.next_send_at = nextSend.toISOString()
    }

    // Map field names
    const mappedUpdates: any = {}
    if (updates.channelId !== undefined) mappedUpdates.channel_id = updates.channelId
    if (updates.content !== undefined) mappedUpdates.message_content = updates.content
    if (updates.embed !== undefined) mappedUpdates.message_embed = updates.embed
    if (updates.scheduleType !== undefined) mappedUpdates.schedule_type = updates.scheduleType
    if (updates.scheduleTime !== undefined) mappedUpdates.schedule_time = updates.scheduleTime
    if (updates.scheduleDays !== undefined) mappedUpdates.schedule_days = updates.scheduleDays
    if (updates.scheduleCron !== undefined) mappedUpdates.schedule_cron = updates.scheduleCron
    if (updates.timezone !== undefined) mappedUpdates.timezone = updates.timezone
    if (updates.isActive !== undefined) mappedUpdates.is_active = updates.isActive
    if (updates.next_send_at !== undefined) mappedUpdates.next_send_at = updates.next_send_at

    // Update scheduled message
    const { data: message, error } = await supabaseAdmin
      .from('scheduled_messages')
      .update(mappedUpdates)
      .eq('id', messageId)
      .select()
      .single()

    if (error) {
      console.error('Error updating scheduled message:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ message, success: true })
  } catch (error) {
    console.error('Error in PATCH /api/comcraft/guilds/[guildId]/scheduled-messages/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Delete a scheduled message
export async function DELETE(
  request: NextRequest,
  { params }: { params: { guildId: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guildId = params.guildId
    const messageId = params.id

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

    // Verify message belongs to this guild
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('scheduled_messages')
      .select('*')
      .eq('id', messageId)
      .eq('guild_id', guildId)
      .single()

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Scheduled message not found' }, { status: 404 })
    }

    // Delete scheduled message
    const { error } = await supabaseAdmin
      .from('scheduled_messages')
      .delete()
      .eq('id', messageId)

    if (error) {
      console.error('Error deleting scheduled message:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/comcraft/guilds/[guildId]/scheduled-messages/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

