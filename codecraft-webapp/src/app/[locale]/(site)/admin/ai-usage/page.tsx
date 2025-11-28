'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Brain, 
  TrendingUp, 
  DollarSign, 
  Zap,
  RefreshCw,
  Download,
  Activity
} from 'lucide-react';

interface GuildUsage {
  guildId: string;
  guildName: string;
  tier: string;
  status: string;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  costUsd: number;
  requestCount: number;
  providers: string[];
  models: string[];
  taskTypes: string[];
  lastUsed: string;
}

interface UsageData {
  period: {
    type: string;
    start: string;
    end: string;
  };
  totals: {
    totalGuilds: number;
    totalTokens: number;
    totalCost: number;
    totalRequests: number;
  };
  guilds: GuildUsage[];
  providerBreakdown: Record<string, { requests: number; tokens: number; cost: number }>;
}

export default function AiUsageAdminPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [sortBy, setSortBy] = useState('tokens');

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/ai-usage?period=${period}&sortBy=${sortBy}&limit=100`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        console.error('Failed to fetch AI usage data');
      }
    } catch (error) {
      console.error('Error fetching AI usage:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, sortBy]);

  const exportToCsv = () => {
    if (!data) return;

    const headers = [
      'Guild ID',
      'Guild Name',
      'Tier',
      'Status',
      'Total Tokens',
      'Input Tokens',
      'Output Tokens',
      'Cost (USD)',
      'Requests',
      'Providers',
      'Last Used'
    ];

    const rows = data.guilds.map(g => [
      g.guildId,
      g.guildName,
      g.tier,
      g.status,
      g.tokensTotal,
      g.tokensInput,
      g.tokensOutput,
      g.costUsd.toFixed(6),
      g.requestCount,
      g.providers.join(', '),
      new Date(g.lastUsed).toLocaleString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-usage-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'text-gray-500';
      case 'basic': return 'text-blue-500';
      case 'premium': return 'text-purple-500';
      case 'enterprise': return 'text-yellow-500';
      default: return 'text-gray-400';
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            AI Usage Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor AI token usage across all servers
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            onClick={exportToCsv}
            disabled={!data}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Time Period</label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Last 24 Hours</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Sort By</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tokens">Total Tokens</SelectItem>
              <SelectItem value="cost">Cost (USD)</SelectItem>
              <SelectItem value="requests">Request Count</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tokens</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatNumber(data.totals.totalTokens)}
                  </p>
                </div>
                <Zap className="w-10 h-10 text-blue-500 opacity-75" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold mt-1">
                    ${data.totals.totalCost.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-green-500 opacity-75" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatNumber(data.totals.totalRequests)}
                  </p>
                </div>
                <Activity className="w-10 h-10 text-purple-500 opacity-75" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Servers</p>
                  <p className="text-2xl font-bold mt-1">
                    {data.totals.totalGuilds}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-orange-500 opacity-75" />
              </div>
            </Card>
          </div>

          {/* Provider Breakdown */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Provider Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(data.providerBreakdown).map(([provider, stats]) => (
                <div key={provider} className="border rounded-lg p-4">
                  <h3 className="font-semibold capitalize mb-2">{provider}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Requests:</span>
                      <span className="font-medium">{formatNumber(stats.requests)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tokens:</span>
                      <span className="font-medium">{formatNumber(stats.tokens)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-medium">${stats.cost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Server Usage Table */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Server Usage Details</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Server</th>
                    <th className="text-left p-3 font-semibold">Tier</th>
                    <th className="text-right p-3 font-semibold">Tokens</th>
                    <th className="text-right p-3 font-semibold">Cost</th>
                    <th className="text-right p-3 font-semibold">Requests</th>
                    <th className="text-left p-3 font-semibold">Providers</th>
                    <th className="text-left p-3 font-semibold">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {data.guilds.map((guild) => (
                    <tr key={guild.guildId} className="border-b hover:bg-accent/50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{guild.guildName}</div>
                          <div className="text-xs text-muted-foreground">
                            {guild.guildId.substring(0, 18)}...
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`capitalize font-medium ${getTierColor(guild.tier)}`}>
                          {guild.tier}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        {formatNumber(guild.tokensTotal)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        ${guild.costUsd.toFixed(4)}
                      </td>
                      <td className="p-3 text-right">
                        {guild.requestCount}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {guild.providers.map(p => (
                            <span
                              key={p}
                              className="px-2 py-1 bg-accent rounded text-xs capitalize"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(guild.lastUsed).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

