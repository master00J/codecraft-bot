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
      topUsersRes
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
        .limit(10)
    ]);

    const dailyStats = dailyStatsRes.data || [];
    const topChannels = topChannelsRes.data || [];
    const retention = retentionRes.data || [];
    const hourlyActivity = hourlyActivityRes.data || [];
    const topUsers = topUsersRes.data || [];

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

    return NextResponse.json({
      // Daily trends
      dailyStats,
      
      // Totals
      totals: {
        messages: totalMessages,
        joins: totalJoins,
        leaves: totalLeaves,
        netGrowth: totalJoins - totalLeaves,
        users: topUsers.length
      },
      
      // Top performers
      topChannels: channelTotals.slice(0, 10),
      topUsers,
      
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
      hourlyHeatmap: heatmapData
    });
  } catch (error) {
    console.error('Error in analytics API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

