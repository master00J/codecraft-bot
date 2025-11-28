'use client';

/**
 * Comcraft - Ticket Analytics Dashboard
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface StatsOverview {
  total: number;
  open: number;
  claimed: number;
  closed: number;
  last30Days: number;
}

interface Performance {
  avgResolutionTimeHours: number;
  avgResponseTimeMinutes: number;
  avgRating: number | null;
  totalRatings: number;
}

interface PriorityCounts {
  low: number;
  normal: number;
  high: number;
  urgent: number;
}

interface StaffMember {
  discord_id: string;
  username: string;
  tickets_handled: number;
  tickets_closed: number;
}

interface TicketsOverTime {
  [date: string]: number;
}

export default function TicketAnalyticsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<StatsOverview>({
    total: 0,
    open: 0,
    claimed: 0,
    closed: 0,
    last30Days: 0
  });
  const [performance, setPerformance] = useState<Performance>({
    avgResolutionTimeHours: 0,
    avgResponseTimeMinutes: 0,
    avgRating: null,
    totalRatings: 0
  });
  const [priority, setPriority] = useState<PriorityCounts>({
    low: 0,
    normal: 0,
    high: 0,
    urgent: 0
  });
  const [topStaff, setTopStaff] = useState<StaffMember[]>([]);
  const [ticketsOverTime, setTicketsOverTime] = useState<TicketsOverTime>({});

  useEffect(() => {
    if (guildId) {
      fetchAnalytics();
    }
  }, [guildId]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/stats`);
      const data = await response.json();
      
      if (response.ok) {
        setOverview(data.overview);
        setPerformance(data.performance);
        setPriority(data.priority);
        setTopStaff(data.topStaff || []);
        setTicketsOverTime(data.ticketsOverTime || {});
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load statistics',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load statistics',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    }
    return `${hours.toFixed(1)} hours`;
  };

  const getPerformanceColor = (value: number, type: 'resolution' | 'response') => {
    if (type === 'resolution') {
      if (value < 2) return 'text-green-600';
      if (value < 6) return 'text-blue-600';
      if (value < 12) return 'text-orange-600';
      return 'text-red-600';
    } else {
      if (value < 15) return 'text-green-600';
      if (value < 30) return 'text-blue-600';
      if (value < 60) return 'text-orange-600';
      return 'text-red-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">📊 Ticket Analytics</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Comprehensive analytics and performance metrics for your support workflow.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchAnalytics} variant="outline">
                🔄 Refresh
              </Button>
              <Button asChild>
                <Link href={`/comcraft/dashboard/${guildId}/tickets`}>← Back</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total</div>
            <div className="text-3xl font-bold">{overview.total}</div>
          </Card>
          <Card className="p-4 bg-green-50 dark:bg-green-900/20">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Open</div>
            <div className="text-3xl font-bold text-green-600">{overview.open}</div>
          </Card>
          <Card className="p-4 bg-blue-50 dark:bg-blue-900/20">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Claimed</div>
            <div className="text-3xl font-bold text-blue-600">{overview.claimed}</div>
          </Card>
          <Card className="p-4 bg-gray-50 dark:bg-gray-800">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Closed</div>
            <div className="text-3xl font-bold text-gray-600">{overview.closed}</div>
          </Card>
          <Card className="p-4 bg-purple-50 dark:bg-purple-900/20">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Last 30d</div>
            <div className="text-3xl font-bold text-purple-600">{overview.last30Days}</div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Performance Metrics */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">⚡ Performance</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Average response time
                  </span>
                  <span className={`text-2xl font-bold ${getPerformanceColor(performance.avgResponseTimeMinutes, 'response')}`}>
                    {Math.round(performance.avgResponseTimeMinutes)} min
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      performance.avgResponseTimeMinutes < 15 ? 'bg-green-500' :
                      performance.avgResponseTimeMinutes < 30 ? 'bg-blue-500' :
                      performance.avgResponseTimeMinutes < 60 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((performance.avgResponseTimeMinutes / 60) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Average resolution time
                  </span>
                  <span className={`text-2xl font-bold ${getPerformanceColor(performance.avgResolutionTimeHours, 'resolution')}`}>
                    {formatTime(performance.avgResolutionTimeHours)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      performance.avgResolutionTimeHours < 2 ? 'bg-green-500' :
                      performance.avgResolutionTimeHours < 6 ? 'bg-blue-500' :
                      performance.avgResolutionTimeHours < 12 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((performance.avgResolutionTimeHours / 24) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {performance.avgRating !== null && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Average rating
                    </span>
                    <span className="text-2xl font-bold text-yellow-500">
                      {performance.avgRating}/5 ⭐
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${(performance.avgRating / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Based on {performance.totalRatings} ratings
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Priority Distribution */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">🎯 Priority distribution</h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-600">URGENT</Badge>
                    <span className="text-sm">{priority.urgent} tickets</span>
                  </div>
                  <span className="font-bold">{overview.total > 0 ? Math.round((priority.urgent / overview.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-red-600 h-3 rounded-full"
                    style={{ width: `${overview.total > 0 ? (priority.urgent / overview.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500">HIGH</Badge>
                    <span className="text-sm">{priority.high} tickets</span>
                  </div>
                  <span className="font-bold">{overview.total > 0 ? Math.round((priority.high / overview.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-orange-500 h-3 rounded-full"
                    style={{ width: `${overview.total > 0 ? (priority.high / overview.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-400">NORMAL</Badge>
                    <span className="text-sm">{priority.normal} tickets</span>
                  </div>
                  <span className="font-bold">{overview.total > 0 ? Math.round((priority.normal / overview.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-blue-400 h-3 rounded-full"
                    style={{ width: `${overview.total > 0 ? (priority.normal / overview.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gray-400">LOW</Badge>
                    <span className="text-sm">{priority.low} tickets</span>
                  </div>
                  <span className="font-bold">{overview.total > 0 ? Math.round((priority.low / overview.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className="bg-gray-400 h-3 rounded-full"
                    style={{ width: `${overview.total > 0 ? (priority.low / overview.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Top Staff Members */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-6">🏆 Top Support Staff</h2>
          
          {topStaff.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No staff data available yet
            </div>
          ) : (
            <div className="space-y-3">
              {topStaff.map((staff, index) => (
                <div key={staff.discord_id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold w-10">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{staff.username}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {staff.tickets_handled} tickets handled • {staff.tickets_closed} closed
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-blue-600">
                      {staff.tickets_handled}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {Math.round((staff.tickets_closed / staff.tickets_handled) * 100)}% resolved
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Tickets Over Time */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6">📈 Tickets over time (last 30 days)</h2>
          
          {Object.keys(ticketsOverTime).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No data available
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(ticketsOverTime)
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                .slice(-14) // Last 14 days
                .map(([date, count]) => (
                  <div key={date} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(date).toLocaleDateString('en-GB', { 
                        day: '2-digit', 
                        month: 'short' 
                      })}
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6">
                        <div 
                          className="bg-blue-500 h-6 rounded-full flex items-center justify-end px-2 text-white text-xs font-semibold"
                          style={{ 
                            width: `${Math.max((count / Math.max(...Object.values(ticketsOverTime))) * 100, 5)}%` 
                          }}
                        >
                          {count > 0 && count}
                        </div>
                      </div>
                    </div>
                    <div className="w-12 text-right font-semibold">
                      {count}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

