/**
 * API Route: Guild analytics
 * /api/comcraft/guilds/[guildId]/analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    
    // Check if guild has analytics feature (Basic tier+)
    const { data: config } = await supabase
      .from('guild_configs')
      .select('subscription_tier')
      .eq('guild_id', guildId)
      .single();

    const tier = config?.subscription_tier || 'free';
    
    // Get tier features from database
    const { data: tierConfig } = await supabase
      .from('subscription_tiers')
      .select('features')
      .eq('tier_name', tier)
      .eq('is_active', true)
      .single();

    const features = tierConfig?.features || {};
    const hasAnalytics = features.analytics || false;

    if (!hasAnalytics) {
      return NextResponse.json({ 
        error: 'Premium feature required',
        message: 'Analytics Dashboard is only available starting from the Basic tier.',
        tier: tier,
        requiredTier: 'basic',
        upgradeUrl: 'https://codecraft-solutions.com/products/comcraft'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const dateString = startDate.toISOString().split('T')[0];

    // Parallel fetch all analytics data
    const [
      dailyStatsRes,
      topChannelsRes,
      retentionRes,
      hourlyActivityRes,
      topUsersRes,
      voiceSessionsRes,
      topVoiceUsersRes,
      topVoiceChannelsRes
    ] = await Promise.all([
      // Daily stats (messages, joins, leaves)
      supabase
        .from('analytics_daily_stats')
        .select('*')
        .eq('guild_id', guildId)
        .gte('date', dateString)
        .order('date', { ascending: true }),
      
      // Top channels (last 7 days)
      supabase
        .from('channel_stats')
        .select('*')
        .eq('guild_id', guildId)
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('messages_count', { ascending: false })
        .limit(10),
      
      // Retention metrics
      supabase
        .from('member_retention')
        .select('*')
        .eq('guild_id', guildId)
        .gte('joined_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Hourly activity (last 7 days for heatmap)
      supabase
        .from('hourly_activity')
        .select('*')
        .eq('guild_id', guildId)
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: true }),
      
      // Top users by XP
      supabase
        .from('user_levels')
        .select('*')
        .eq('guild_id', guildId)
        .order('xp', { ascending: false })
        .limit(10),
      
      // Voice sessions (for voice stats)
      supabase
        .from('voice_sessions')
        .select('*')
        .eq('guild_id', guildId)
        .gte('joined_at', startDate.toISOString())
        .eq('is_active', false),
      
      // Top voice users
      supabase
        .from('user_stats')
        .select('user_id, total_voice_seconds, last_voice_at')
        .eq('guild_id', guildId)
        .gt('total_voice_seconds', 0)
        .order('total_voice_seconds', { ascending: false })
        .limit(10),
      
      // Top voice channels (aggregate from voice_sessions for accurate channel names)
      supabase
        .from('voice_sessions')
        .select('channel_id, channel_name, duration_seconds')
        .eq('guild_id', guildId)
        .eq('is_active', false)
        .not('channel_id', 'is', null)
        .gte('joined_at', startDate.toISOString())
    ]);

    const dailyStats = dailyStatsRes.data || [];
    const topChannels = topChannelsRes.data || [];
    const retention = retentionRes.data || [];
    const hourlyActivity = hourlyActivityRes.data || [];
    const topUsers = topUsersRes.data || [];
    const voiceSessions = voiceSessionsRes.data || [];
    const topVoiceUsers = topVoiceUsersRes.data || [];
    const topVoiceChannelsRaw = topVoiceChannelsRes.data || [];

    // Calculate retention rates
    const totalJoined = retention.length;
    const withFirstMessage = retention.filter(r => r.first_message_at).length;
    const retained24h = retention.filter(r => r.is_retained_24h).length;
    const retained7d = retention.filter(r => r.is_retained_7d).length;
    const retained30d = retention.filter(r => r.is_retained_30d).length;

    const avgTimeToFirstMessage = retention
      .filter(r => r.time_to_first_message)
      .reduce((sum, r) => sum + r.time_to_first_message, 0) / withFirstMessage || 0;

    // Aggregate channel stats
    interface ChannelTotal {
      channel_id: string;
      channel_name: string;
      messages: number;
      unique_users: number;
    }
    
    const channelTotals = topChannels.reduce((acc: ChannelTotal[], ch: any) => {
      const existing = acc.find((a: ChannelTotal) => a.channel_id === ch.channel_id);
      if (existing) {
        existing.messages += ch.messages_count;
        existing.unique_users += ch.unique_users;
      } else {
        acc.push({
          channel_id: ch.channel_id,
          channel_name: ch.channel_name,
          messages: ch.messages_count,
          unique_users: ch.unique_users
        });
      }
      return acc;
    }, []);

    // Build heatmap data (hour x day)
    const heatmapData = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourData = hourlyActivity.filter(h => h.hour === hour);
      const avgMessages = hourData.length > 0
        ? hourData.reduce((sum, h) => sum + h.messages, 0) / hourData.length
        : 0;
      
      heatmapData.push({
        hour,
        messages: Math.round(avgMessages),
        unique_users: Math.round(
          hourData.reduce((sum, h) => sum + h.unique_users, 0) / (hourData.length || 1)
        )
      });
    }

    // Calculate totals
    const totalMessages = dailyStats.reduce((sum, day) => sum + (day.total_messages || 0), 0);
    const totalJoins = dailyStats.reduce((sum, day) => sum + (day.new_joins || 0), 0);
    const totalLeaves = dailyStats.reduce((sum, day) => sum + (day.leaves || 0), 0);

    // Calculate voice statistics
    const totalVoiceSeconds = voiceSessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);
    const totalVoiceMinutes = Math.floor(totalVoiceSeconds / 60);
    const totalVoiceHours = (totalVoiceSeconds / 3600).toFixed(1);
    const uniqueVoiceUsers = new Set(voiceSessions.map(s => s.user_id)).size;
    
    // Group voice sessions by date for daily chart
    const voiceByDate = voiceSessions.reduce((acc: any, session: any) => {
      if (!session.joined_at) return acc;
      const date = new Date(session.joined_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { seconds: 0, users: new Set(), sessions: 0 };
      }
      acc[date].seconds += session.duration_seconds || 0;
      acc[date].users.add(session.user_id);
      acc[date].sessions += 1;
      return acc;
    }, {});

    // Merge voice data into dailyStats
    const dailyStatsWithVoice = dailyStats.map((day: any) => {
      const dateStr = day.date.split('T')[0];
      const voiceData = voiceByDate[dateStr] || { seconds: 0, users: new Set(), sessions: 0 };
      return {
        ...day,
        voice_minutes: Math.floor(voiceData.seconds / 60),
        voice_hours: (voiceData.seconds / 3600).toFixed(2),
        unique_voice_users: voiceData.users.size || 0,
        voice_sessions: voiceData.sessions || 0
      };
    });

    // Aggregate top voice channels from voice_sessions (more accurate channel names)
    interface VoiceChannelTotal {
      channel_id: string;
      channel_name: string;
      total_seconds: number;
      total_hours: string;
      unique_users: number;
    }
    
    // First, build a map of unique users per channel
    const channelUserMap = new Map<string, Set<string>>();
    const channelNameMap = new Map<string, string>();
    
    voiceSessions.forEach((session: any) => {
      if (!session.channel_id) return;
      
      // Track unique users per channel
      if (!channelUserMap.has(session.channel_id)) {
        channelUserMap.set(session.channel_id, new Set());
      }
      if (session.user_id) {
        channelUserMap.get(session.channel_id)!.add(session.user_id);
      }
      
      // Track channel names (prefer non-null names)
      if (session.channel_name && (!channelNameMap.has(session.channel_id) || channelNameMap.get(session.channel_id) === 'Unknown Channel')) {
        channelNameMap.set(session.channel_id, session.channel_name);
      }
    });
    
    // Aggregate by channel
    const topVoiceChannelsMap = new Map<string, VoiceChannelTotal>();
    
    topVoiceChannelsRaw.forEach((session: any) => {
      if (!session.channel_id || !session.duration_seconds) return;
      
      const existing = topVoiceChannelsMap.get(session.channel_id);
      if (existing) {
        existing.total_seconds += session.duration_seconds || 0;
        existing.total_hours = (existing.total_seconds / 3600).toFixed(2);
      } else {
        topVoiceChannelsMap.set(session.channel_id, {
          channel_id: session.channel_id,
          channel_name: channelNameMap.get(session.channel_id) || session.channel_name || 'Unknown Channel',
          total_seconds: session.duration_seconds || 0,
          total_hours: ((session.duration_seconds || 0) / 3600).toFixed(2),
          unique_users: 0
        });
      }
    });
    
    // Add unique users count and convert to array
    const topVoiceChannels = Array.from(topVoiceChannelsMap.values()).map(ch => ({
      ...ch,
      unique_users: channelUserMap.get(ch.channel_id)?.size || 0
    })).sort((a, b) => b.total_seconds - a.total_seconds).slice(0, 10);

    // Get user stats with voice data for top voice users
    const topVoiceUsersWithStats = await Promise.all(
      topVoiceUsers.map(async (user: any) => {
        const { data: userLevel } = await supabase
          .from('user_levels')
          .select('username, voice_level, voice_xp')
          .eq('guild_id', guildId)
          .eq('user_id', user.user_id)
          .single();
        
        return {
          user_id: user.user_id,
          total_voice_seconds: user.total_voice_seconds,
          total_voice_hours: (user.total_voice_seconds / 3600).toFixed(1),
          total_voice_minutes: Math.floor(user.total_voice_seconds / 60),
          username: userLevel?.username || 'Unknown User',
          voice_level: userLevel?.voice_level || 0,
          voice_xp: userLevel?.voice_xp || 0
        };
      })
    );

    // Group voice sessions by hour for voice heatmap
    const voiceByHour: Record<number, { seconds: number; users: Set<string>; sessions: number }> = {};
    for (let hour = 0; hour < 24; hour++) {
      voiceByHour[hour] = { seconds: 0, users: new Set(), sessions: 0 };
    }
    
    voiceSessions.forEach((session: any) => {
      if (!session.joined_at) return;
      const hour = new Date(session.joined_at).getHours();
      voiceByHour[hour].seconds += session.duration_seconds || 0;
      voiceByHour[hour].users.add(session.user_id);
      voiceByHour[hour].sessions += 1;
    });

    // Calculate average voice activity per hour (over the selected time range)
    const voiceHourlyHeatmap = Object.entries(voiceByHour).map(([hour, data]) => {
      const daysInRange = days;
      const avgSecondsPerDay = daysInRange > 0 ? data.seconds / daysInRange : 0;
      const avgMinutesPerDay = avgSecondsPerDay / 60;
      return {
        hour: parseInt(hour),
        minutes: Math.round(avgMinutesPerDay),
        unique_users: Math.round(data.users.size / (daysInRange || 1)),
        sessions: Math.round(data.sessions / (daysInRange || 1))
      };
    });

    return NextResponse.json({
      // Daily trends
      dailyStats: dailyStatsWithVoice,
      
      // Totals
      totals: {
        messages: totalMessages,
        joins: totalJoins,
        leaves: totalLeaves,
        netGrowth: totalJoins - totalLeaves,
        users: topUsers.length,
        voiceMinutes: totalVoiceMinutes,
        voiceHours: totalVoiceHours,
        voiceSeconds: totalVoiceSeconds,
        uniqueVoiceUsers
      },
      
      // Top performers
      topChannels: channelTotals.slice(0, 10),
      topUsers,
      topVoiceChannels,
      topVoiceUsers: topVoiceUsersWithStats,
      
      // Retention
      retention: {
        totalJoined,
        withFirstMessage,
        conversionRate: totalJoined > 0 ? ((withFirstMessage / totalJoined) * 100).toFixed(1) : 0,
        retained24h,
        retained7d,
        retained30d,
        retention24hRate: totalJoined > 0 ? ((retained24h / totalJoined) * 100).toFixed(1) : 0,
        retention7dRate: totalJoined > 0 ? ((retained7d / totalJoined) * 100).toFixed(1) : 0,
        retention30dRate: totalJoined > 0 ? ((retained30d / totalJoined) * 100).toFixed(1) : 0,
        avgMinutesToFirstMessage: (avgTimeToFirstMessage / 60).toFixed(1)
      },
      
      // Activity heatmap
      hourlyHeatmap: heatmapData,
      voiceHourlyHeatmap
    });
  } catch (error) {
    console.error('Error in analytics API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

