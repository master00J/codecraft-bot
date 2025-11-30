'use client';

/**
 * ComCraft Analytics Dashboard
 * Comprehensive guild statistics and insights
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function Analytics() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('30');
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [tierInfo, setTierInfo] = useState<any>(null);

  useEffect(() => {
    if (guildId) {
      fetchAnalytics();
    }
  }, [guildId, timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setPremiumRequired(false);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/analytics?days=${timeRange}`);
      const analyticsData = await response.json();
      
      // Check if premium feature is required (403 error)
      if (response.status === 403 && analyticsData.error === 'Premium feature required') {
        setPremiumRequired(true);
        setTierInfo(analyticsData);
        setData(null);
        return;
      }
      
      if (!response.ok) {
        console.error('API Error:', analyticsData);
        setData(null);
        return;
      }
      
      setData(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show premium required message
  if (premiumRequired && tierInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-2">🔒 Premium Feature</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              {tierInfo.message || 'The analytics dashboard is only available from the Basic tier upwards.'}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Current Tier</div>
                <div className="text-2xl font-bold capitalize">{tierInfo.tier || 'Free'}</div>
              </div>
              <div className="text-4xl">→</div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Required Tier</div>
                <div className="text-2xl font-bold capitalize text-blue-600">{tierInfo.requiredTier || 'Basic'}</div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <div className="text-sm font-semibold mb-2">With {tierInfo.requiredTier || 'Basic'} you unlock:</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Analytics Dashboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Advanced Moderation</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Welcome System</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>25 Custom Commands</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <a href={tierInfo.upgradeUrl || 'https://codecraft-solutions.com/products/comcraft'} target="_blank" rel="noopener noreferrer">
                Upgrade to {tierInfo.requiredTier || 'Basic'} →
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={`/comcraft/dashboard/${guildId}`}>← Back to dashboard</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">No data available</h2>
          <Button asChild>
            <Link href={`/comcraft/dashboard/${guildId}`}>← Back</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">📊 Analytics Dashboard</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Insights into your server activity and engagement
              </p>
            </div>
            <div className="flex gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button asChild variant="outline">
                <Link href={`/comcraft/dashboard/${guildId}`}>← Back</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Total Messages
            </div>
            <div className="text-3xl font-bold">{data.totals.messages.toLocaleString()}</div>
          </Card>

          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              New Members
            </div>
            <div className="text-3xl font-bold text-green-600">+{data.totals.joins}</div>
          </Card>

          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Members Left
            </div>
            <div className="text-3xl font-bold text-red-600">-{data.totals.leaves}</div>
          </Card>

          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Net Growth
            </div>
            <div className={`text-3xl font-bold ${data.totals.netGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.totals.netGrowth >= 0 ? '+' : ''}{data.totals.netGrowth}
            </div>
          </Card>
        </div>

        {/* Voice Metrics */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Total Voice Time
            </div>
            <div className="text-3xl font-bold text-purple-600">{data.totals.voiceHours || '0'}h</div>
            <div className="text-sm text-gray-500 mt-1">
              {data.totals.voiceMinutes || 0} minutes
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Unique Voice Users
            </div>
            <div className="text-3xl font-bold text-blue-600">{data.totals.uniqueVoiceUsers || 0}</div>
            <div className="text-sm text-gray-500 mt-1">
              Users who used voice
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Average Session Length
            </div>
            <div className="text-3xl font-bold text-indigo-600">
              {data.totals.uniqueVoiceUsers > 0 
                ? Math.floor((data.totals.voiceSeconds || 0) / data.totals.uniqueVoiceUsers / 60) 
                : 0} min
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Per user average
            </div>
          </Card>
        </div>

        {/* Daily Activity Chart */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">📈 Daily Activity</h2>
          {data.dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('en-US')}
                />
                <Legend />
                <Area type="monotone" dataKey="total_messages" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Messages" />
                <Area type="monotone" dataKey="unique_active_users" stroke="#10B981" fill="#10B981" fillOpacity={0.4} name="Active Users" />
                <Area type="monotone" dataKey="voice_minutes" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.4} name="Voice Minutes" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-600">
              <p>No activity registered yet</p>
              <p className="text-sm mt-2">Messages will appear here once there is activity</p>
            </div>
          )}
        </Card>

        {/* Member Growth Chart */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">👥 Member Growth</h2>
          {data.dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('en-US')} />
                <Legend />
                <Line type="monotone" dataKey="new_joins" stroke="#10B981" name="Joins" strokeWidth={2} />
                <Line type="monotone" dataKey="leaves" stroke="#EF4444" name="Leaves" strokeWidth={2} />
                <Line type="monotone" dataKey="net_growth" stroke="#3B82F6" name="Net" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-600">No member data yet</div>
          )}
        </Card>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Top Channels */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">🔥 Top Text Channels (Last 7 Days)</h2>
            {data.topChannels.length > 0 ? (
              <div className="space-y-3">
                {data.topChannels.map((channel: any, index: number) => (
                  <div key={channel.channel_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                      <div>
                        <div className="font-semibold">#{channel.channel_name}</div>
                        <div className="text-sm text-gray-600">
                          {channel.unique_users} users • {channel.messages} messages
                        </div>
                      </div>
                    </div>
                    <Badge>{channel.messages}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">No channel data yet</div>
            )}
          </Card>

          {/* Top Users */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">⭐ Top Active Members</h2>
            {data.topUsers.length > 0 ? (
              <div className="space-y-3">
                {data.topUsers.slice(0, 10).map((user: any, index: number) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </div>
                      <div>
                        <div className="font-semibold">{user.username}</div>
                        <div className="text-sm text-gray-600">
                          Level {user.level} • {user.total_messages} messages
                        </div>
                      </div>
                    </div>
                    <Badge>{user.xp} XP</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">No user data yet</div>
            )}
          </Card>
        </div>

        {/* Voice Activity Chart */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">🔊 Voice Activity Over Time</h2>
          {data.dailyStats.length > 0 && data.dailyStats.some((day: any) => day.voice_minutes > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('en-US')}
                  formatter={(value: any, name: string) => {
                    if (name === 'Voice Minutes') return [value, 'Minutes'];
                    if (name === 'Voice Users') return [value, 'Users'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="voice_minutes" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} name="Voice Minutes" />
                <Area type="monotone" dataKey="unique_voice_users" stroke="#A855F7" fill="#A855F7" fillOpacity={0.4} name="Voice Users" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-600">
              <p>No voice activity registered yet</p>
              <p className="text-sm mt-2">Voice statistics will appear here once members join voice channels</p>
            </div>
          )}
        </Card>

        {/* Voice Statistics */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Top Voice Channels */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">🎤 Top Voice Channels</h2>
            {data.topVoiceChannels && data.topVoiceChannels.length > 0 ? (
              <div className="space-y-3">
                {data.topVoiceChannels.map((channel: any, index: number) => (
                  <div key={channel.channel_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                      <div>
                        <div className="font-semibold">🎤 {channel.channel_name}</div>
                        <div className="text-sm text-gray-600">
                          {channel.unique_users || 0} users
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-purple-600">{channel.total_hours}h</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">No voice channel data yet</div>
            )}
          </Card>

          {/* Top Voice Users */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">🎙️ Top Voice Users</h2>
            {data.topVoiceUsers && data.topVoiceUsers.length > 0 ? (
              <div className="space-y-3">
                {data.topVoiceUsers.slice(0, 10).map((user: any, index: number) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </div>
                      <div>
                        <div className="font-semibold">{user.username || 'Unknown User'}</div>
                        <div className="text-sm text-gray-600">
                          Voice Level {user.voice_level || 0} • {user.total_voice_hours}h total
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-purple-600">{user.total_voice_hours}h</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">No voice user data yet</div>
            )}
          </Card>
        </div>

        {/* Voice Activity Heatmap */}
        {data.voiceHourlyHeatmap && data.voiceHourlyHeatmap.length > 0 && (
          <Card className="p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">🕐 Voice Activity by Hour (Average)</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              When do members use voice channels the most?
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.voiceHourlyHeatmap}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={(value) => `${value}:00`}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => `${value}:00`}
                  formatter={(value: any, name: string) => {
                    if (name === 'minutes') return [value, 'Minutes'];
                    if (name === 'unique_users') return [value, 'Unique Users'];
                    if (name === 'sessions') return [value, 'Sessions'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar dataKey="minutes" fill="#8B5CF6" name="Voice Minutes per Hour" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Retention Metrics */}
        <Card className="p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">🎯 Member Retention & Conversion</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-4">Retention Rates</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span>24 hour retention</span>
                  <Badge className="text-lg">{data.retention.retention24hRate}%</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span>7 day retention</span>
                  <Badge className="text-lg">{data.retention.retention7dRate}%</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span>30 day retention</span>
                  <Badge className="text-lg">{data.retention.retention30dRate}%</Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Conversion Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span>Join → First Message</span>
                  <Badge className="text-lg bg-green-600">{data.retention.conversionRate}%</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span>Avg. time to first message</span>
                  <Badge className="text-lg">{data.retention.avgMinutesToFirstMessage} min</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span>Total new members</span>
                  <Badge className="text-lg">{data.retention.totalJoined}</Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Hourly Activity Heatmap */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">🕐 Best Times (Average)</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            When is your server most active? Use this to plan events/streams!
          </p>
          {data.hourlyHeatmap.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.hourlyHeatmap}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={(value) => `${value}:00`}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => `${value}:00`}
                  formatter={(value, name) => [value, name === 'messages' ? 'Messages' : 'Active Users']}
                />
                <Legend />
                <Bar dataKey="messages" fill="#3B82F6" name="Messages per hour" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-600">No hourly data available yet</div>
          )}
          
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm">
              <strong>💡 Tip:</strong> The highest peak is the best time to:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Schedule streams (more viewers)</li>
                <li>Post important announcements</li>
                <li>Host events (more participation)</li>
                <li>Start giveaways</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

