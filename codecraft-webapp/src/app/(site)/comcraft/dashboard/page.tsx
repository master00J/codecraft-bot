'use client';

/**
 * Comcraft Dashboard - Guild Selector
 * Display all servers where the user is owner
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Key, Loader2, RefreshCw, LogIn, Bot, CheckCircle, ArrowRight, ExternalLink, Coins, Gift } from 'lucide-react';
import { ReferralPromoBanner } from '@/components/ReferralPromoBanner';

interface Guild {
  id: string;
  guild_id: string;
  guild_name: string;
  guild_icon_url: string | null;
  subscription_tier: string;
  is_trial?: boolean;
  leveling_enabled: boolean;
  moderation_enabled: boolean;
  streaming_enabled: boolean;
  active_license?: {
    id: string;
    tier: string;
    status: string;
    expires_at: string | null;
  } | null;
}

interface LicenseSummary {
  id: string;
  tier: string;
  status: string;
  max_guilds: number;
  slots_used: number;
  slots_total: number;
  expires_at: string | null;
  assignments: Array<{ guild_id: string; guild_name: string | null; assigned_at: string }>;
}

export default function ComcraftDashboard() {
  const { data: session, status } = useSession();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [licenses, setLicenses] = useState<LicenseSummary[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [selectedLicenseByGuild, setSelectedLicenseByGuild] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const loadLicenses = useCallback(async () => {
    try {
      setLicensesLoading(true);
      const response = await fetch('/api/comcraft/licenses');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load licenses');
      }
      const licenseList: LicenseSummary[] = data.licenses || [];
      setLicenses(licenseList);
      setSelectedLicenseByGuild((current) => {
        const updated = { ...current };
        licenseList.forEach((license) => {
          license.assignments?.forEach((assignment) => {
            updated[assignment.guild_id] = license.id;
          });
        });
        return updated;
      });
    } catch (error: any) {
      console.error('License load error', error);
      toast({ title: 'Failed to load licenses', description: error.message, variant: 'destructive' });
    } finally {
      setLicensesLoading(false);
    }
  }, [toast]);

  const fetchGuilds = useCallback(async () => {
    try {
      setLoading(true);
      setUnauthorized(false);
      const response = await fetch('/api/comcraft/guilds');
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          setUnauthorized(true);
          return;
        }
        throw new Error(data.error || 'Failed to fetch guilds');
      }
      
      if (data.guilds && Array.isArray(data.guilds)) {
        // Validate and sanitize guild data
        const validGuilds = data.guilds
          .filter((g: any) => g && g.guild_id && (g.guild_name || typeof g.guild_name === 'string'))
          .map((g: any) => ({
            id: String(g.id || g.guild_id || ''),
            guild_id: String(g.guild_id || ''),
            guild_name: String(g.guild_name || 'Unknown Server'),
            guild_icon_url: g.guild_icon_url || null,
            subscription_tier: String(g.subscription_tier || 'free'),
            is_trial: Boolean(g.is_trial),
            leveling_enabled: Boolean(g.leveling_enabled),
            moderation_enabled: Boolean(g.moderation_enabled),
            streaming_enabled: Boolean(g.streaming_enabled),
            active_license: g.active_license ? {
              id: String(g.active_license.id || ''),
              tier: String(g.active_license.tier || 'Unknown'),
              status: String(g.active_license.status || 'active'),
              expires_at: g.active_license.expires_at || null
            } : null
          }));
        setGuilds(validGuilds);
        setUnauthorized(false);
      } else {
        setGuilds([]);
      }
    } catch (error) {
      console.error('Error fetching guilds:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncGuilds = useCallback(async () => {
    try {
      setLoading(true);
      setUnauthorized(false);
      // First, try to sync via POST endpoint
      const syncResponse = await fetch('/api/comcraft/guilds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (syncResponse.ok) {
        const syncData = await syncResponse.json();
        console.log('Sync response:', syncData);
        
        // Wait a bit for sync to complete, then fetch guilds
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else if (syncResponse.status === 401) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }
      
      // Then fetch guilds
      await fetchGuilds();
    } catch (error) {
      console.error('Error syncing guilds:', error);
      // Even if sync fails, try to fetch guilds anyway
      await fetchGuilds();
    }
  }, [fetchGuilds]);

  useEffect(() => {
    // Only fetch guilds if user is authenticated
    if (status === 'authenticated') {
      fetchGuilds();
      loadLicenses();
    } else if (status === 'unauthenticated') {
      setUnauthorized(true);
      setLoading(false);
    }
  }, [status, fetchGuilds, loadLicenses]);

  // Auto-refresh when no guilds are found (helps users see newly added servers)
  useEffect(() => {
    // Only auto-refresh if user is authenticated and has no guilds
    if (status === 'authenticated' && guilds.length === 0 && !loading && !unauthorized) {
      const interval = setInterval(() => {
        fetchGuilds();
      }, 10000); // Refresh every 10 seconds when no guilds found

      return () => clearInterval(interval);
    }
  }, [status, guilds.length, loading, unauthorized, fetchGuilds]);

  const availableLicenses = useMemo(() => {
    return licenses.filter((license) => license.status === 'active');
  }, [licenses]);

  const getAvailableLicenseOptions = (guildId: string) => {
    return availableLicenses.filter((license) => {
      const alreadyAssigned = license.assignments?.some((assignment) => assignment.guild_id === guildId);
      if (alreadyAssigned) {
        return true;
      }
      return license.slots_used < license.slots_total;
    });
  };

  const assignLicense = async (licenseId: string, guildId: string) => {
    try {
      const response = await fetch('/api/comcraft/licenses/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseId, guildId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign license');
      }
      toast({ title: 'License assigned', description: 'The guild now uses this license.' });
      await loadLicenses();
      await fetchGuilds();
    } catch (error: any) {
      console.error('Assign license error', error);
      toast({ title: 'Failed to assign license', description: error.message, variant: 'destructive' });
    }
  };

  const releaseLicense = async (guildId: string) => {
    try {
      const response = await fetch('/api/comcraft/licenses/assign', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to release license');
      }
      toast({ title: 'License released', description: 'This guild is no longer assigned to a license.' });
      await loadLicenses();
      await fetchGuilds();
    } catch (error: any) {
      console.error('Release license error', error);
      toast({ title: 'Failed to release license', description: error.message, variant: 'destructive' });
    }
  };

  const getTierColor = (tier: string | null | undefined, isTrial?: boolean) => {
    if (isTrial) {
      return 'bg-green-500'; // Green for trial
    }
    const tierStr = String(tier || 'free').toLowerCase();
    switch (tierStr) {
      case 'free': return 'bg-gray-500';
      case 'basic': return 'bg-blue-500';
      case 'premium': return 'bg-purple-500';
      case 'enterprise': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getTierDisplayName = (tier: string | null | undefined, isTrial?: boolean) => {
    if (isTrial) {
      return 'TRIAL';
    }
    return String(tier || 'free').toUpperCase();
  };

  const getDaysRemaining = (expiresAt: string | null): number | null => {
    if (!expiresAt) return null;
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatExpiryInfo = (expiresAt: string | null): { text: string; color: string } => {
    if (!expiresAt) {
      return { text: 'No expiry date', color: 'text-muted-foreground' };
    }
    
    const daysRemaining = getDaysRemaining(expiresAt);
    
    if (daysRemaining === null) {
      return { text: 'No expiry date', color: 'text-muted-foreground' };
    }
    
    if (daysRemaining < 0) {
      return { text: `Expired ${Math.abs(daysRemaining)} days ago`, color: 'text-red-600' };
    }
    
    if (daysRemaining === 0) {
      return { text: 'Expires today', color: 'text-red-600' };
    }
    
    if (daysRemaining <= 7) {
      return { text: `${daysRemaining} days remaining`, color: 'text-orange-600' };
    }
    
    if (daysRemaining <= 30) {
      return { text: `${daysRemaining} days remaining`, color: 'text-yellow-600' };
    }
    
    return { text: `${daysRemaining} days remaining`, color: 'text-green-600' };
  };

  // Show login prompt if user is not authenticated
  if (status === 'unauthenticated' || unauthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="border-2 border-border rounded-xl p-12 text-center max-w-lg shadow-sm">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
            <LogIn className="h-10 w-10 text-accent" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-primary tracking-tight">Login Required</h1>
          <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
            You need to log in with Discord to view your servers. After adding the bot via top.gg or Discord, log in here to see your servers and configure them.
          </p>
          <Button 
            onClick={() => {
              void signIn('discord', { callbackUrl: window.location.href });
            }}
            className="w-full h-12 rounded-lg shadow-sm hover:shadow-md transition-all"
            size="lg"
          >
            <LogIn className="h-5 w-5 mr-2" />
            Login with Discord
          </Button>
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              After logging in, you'll be able to see all servers where you've added ComCraft and where you are the owner.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && (status === 'loading' || status === 'authenticated')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Bot className="h-8 w-8 text-accent animate-pulse" />
            </div>
            <div className="absolute inset-0 animate-spin">
              <div className="h-16 w-16 rounded-2xl border-2 border-transparent border-t-accent mx-auto"></div>
            </div>
          </div>
          <p className="text-muted-foreground font-medium">Loading your servers...</p>
        </div>
      </div>
    );
  }

  if (guilds.length === 0 && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <Card className="border-2 border-border rounded-xl p-12 text-center max-w-2xl shadow-sm">
          <div className="mx-auto h-24 w-24 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
            <Bot className="h-12 w-12 text-accent" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-primary tracking-tight">No servers found</h1>
          <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
            You haven't added any servers where ComCraft is installed and where you are the owner.
          </p>
          
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <Button asChild className="h-12 rounded-lg shadow-sm hover:shadow-md transition-all">
              <a href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_COMCRAFT_CLIENT_ID || 'YOUR_CLIENT_ID'}&permissions=8&scope=bot%20applications.commands`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-5 w-5 mr-2" />
                Add ComCraft Bot
              </a>
            </Button>
            <Button 
              variant="outline" 
              className="h-12 border-2 rounded-lg hover:bg-muted transition-all" 
              onClick={() => {
                syncGuilds();
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Sync & Refresh
            </Button>
          </div>

          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-4 text-left">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-primary">💡 Quick tip:</strong> After adding the bot via top.gg or Discord, it may take a few seconds for your server to appear. The bot must be online for the server to be added to the database.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-left">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-primary">🔄 Auto-refresh:</strong> This page will automatically refresh every 10 seconds, or click "Sync & Refresh" to check now.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-primary">
                ComCraft Dashboard
              </h1>
              <p className="text-lg text-muted-foreground">
                Select a server to configure and manage
              </p>
            </div>
            <Button 
              variant="outline"
              size="lg"
              className="border-2 hover:bg-muted transition-all rounded-lg"
              onClick={() => {
                syncGuilds();
                loadLicenses();
              }}
              disabled={loading || licensesLoading}
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${(loading || licensesLoading) ? 'animate-spin' : ''}`} />
              Sync & Refresh
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border-2 border-border rounded-xl p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{guilds.length}</p>
                  <p className="text-sm text-muted-foreground">Active Servers</p>
                </div>
              </div>
            </div>
            
            <div className="bg-card border-2 border-border rounded-xl p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Key className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{availableLicenses.length}</p>
                  <p className="text-sm text-muted-foreground">Active Licenses</p>
                </div>
              </div>
            </div>
            
            <div className="bg-card border-2 border-border rounded-xl p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {guilds.filter(g => g.active_license).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Licensed Servers</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Program Promo Banner */}
        <ReferralPromoBanner />

        {/* Vote Rewards Promo Card */}
        <Card className="mb-6 border-2 border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 hover:shadow-lg transition-all">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                  <Coins className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Vote Rewards</h3>
                  <p className="text-muted-foreground">
                    Earn points by voting on Top.gg and redeem them for free tier unlocks!
                  </p>
                </div>
              </div>
              <Button
                asChild
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
                size="lg"
              >
                <Link href="/comcraft/account/vote-rewards">
                  <Gift className="h-5 w-5 mr-2" />
                  View Rewards
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guilds && Array.isArray(guilds) ? guilds
            .filter((guild) => guild && guild.guild_id && guild.guild_name && typeof guild.guild_name === 'string')
            .map((guild) => {
            const licenseOptions = getAvailableLicenseOptions(String(guild.guild_id || ''));
            const selectedLicense = selectedLicenseByGuild[String(guild.guild_id || '')] || '';
            const activeLicense = guild.active_license;
            
            return (
              <Card 
                key={guild.id}
                className="relative border-2 border-border hover:border-accent/50 hover:shadow-md transition-all duration-300 overflow-hidden group bg-card"
              >
                {/* Accent indicator */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/50 to-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    {guild.guild_icon_url ? (
                      <div 
                        className="relative cursor-pointer group/avatar"
                        onClick={() => router.push(`/comcraft/dashboard/${guild.guild_id}`)}
                      >
                        <img 
                          src={guild.guild_icon_url} 
                          alt={guild.guild_name}
                          className="w-16 h-16 rounded-xl ring-2 ring-border group-hover/avatar:ring-accent transition-all"
                        />
                        <div className="absolute inset-0 rounded-xl bg-accent/0 group-hover/avatar:bg-accent/10 transition-colors" />
                      </div>
                    ) : (
                      <div 
                        className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center text-accent text-2xl font-bold cursor-pointer hover:bg-accent/20 transition-colors ring-2 ring-border"
                        onClick={() => router.push(`/comcraft/dashboard/${guild.guild_id}`)}
                      >
                        {String(guild.guild_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h3 
                        className="font-bold text-lg text-primary group-hover:text-accent transition-colors mb-2 cursor-pointer truncate"
                        onClick={() => router.push(`/comcraft/dashboard/${guild.guild_id}`)}
                      >
                        {String(guild.guild_name || 'Unknown Server')}
                      </h3>
                      <Badge 
                        className={`${getTierColor(guild.subscription_tier || 'free', guild.is_trial)} text-white border-0`}
                        variant="secondary"
                      >
                        {getTierDisplayName(guild.subscription_tier || 'free', guild.is_trial)}
                      </Badge>
                    </div>
                  </div>

                  {/* Features Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-6">
                    <div className={`flex flex-col items-center p-3 rounded-lg border ${guild.leveling_enabled ? 'bg-accent/5 border-accent/20' : 'bg-muted/50 border-border'} transition-colors`}>
                      <div className={`text-xl mb-1 ${guild.leveling_enabled ? 'text-accent' : 'text-muted-foreground'}`}>
                        {guild.leveling_enabled ? '✓' : '○'}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">Leveling</span>
                    </div>
                    <div className={`flex flex-col items-center p-3 rounded-lg border ${guild.moderation_enabled ? 'bg-accent/5 border-accent/20' : 'bg-muted/50 border-border'} transition-colors`}>
                      <div className={`text-xl mb-1 ${guild.moderation_enabled ? 'text-accent' : 'text-muted-foreground'}`}>
                        {guild.moderation_enabled ? '✓' : '○'}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">Moderation</span>
                    </div>
                    <div className={`flex flex-col items-center p-3 rounded-lg border ${guild.streaming_enabled ? 'bg-accent/5 border-accent/20' : 'bg-muted/50 border-border'} transition-colors`}>
                      <div className={`text-xl mb-1 ${guild.streaming_enabled ? 'text-accent' : 'text-muted-foreground'}`}>
                        {guild.streaming_enabled ? '✓' : '○'}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">Streaming</span>
                    </div>
                  </div>

                  {/* License Management Section */}
                  <div className="pt-4 border-t border-border" onClick={(e) => e.stopPropagation()}>
                    {activeLicense ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                              <Key className="h-4 w-4 text-accent" />
                            </div>
                            <span className="font-semibold text-sm text-primary">Active License</span>
                          </div>
                          <Badge variant="outline" className="capitalize border-accent/50 text-accent">
                            {String(activeLicense.tier || 'Unknown')}
                          </Badge>
                        </div>
                      {activeLicense.expires_at ? (
                        <div className="space-y-1">
                          <div className={`text-xs font-medium ${formatExpiryInfo(activeLicense.expires_at).color}`}>
                            {formatExpiryInfo(activeLicense.expires_at).text}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Expires: {new Date(activeLicense.expires_at).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          No expiry date set
                        </div>
                      )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => void releaseLicense(guild.guild_id)}
                        >
                          Remove License
                        </Button>
                      </div>
                    ) : licenseOptions.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Key className="h-4 w-4 text-accent" />
                          </div>
                          <span className="text-sm font-semibold text-primary">Assign License</span>
                        </div>
                      <div className="flex gap-2">
                        <Select
                          value={selectedLicense}
                          onValueChange={(value) => {
                            setSelectedLicenseByGuild((current) => ({ ...current, [guild.guild_id]: value }));
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select license" />
                          </SelectTrigger>
                          <SelectContent>
                            {licenseOptions && Array.isArray(licenseOptions) ? licenseOptions
                              .filter((license) => license && license.id && license.tier)
                              .map((license) => {
                              const expiryInfo = formatExpiryInfo(license.expires_at);
                              return (
                                <SelectItem key={String(license.id)} value={String(license.id)}>
                                  <div className="flex flex-col">
                                    <span>
                                      {String(license.tier || 'Unknown')} ({Number(license.slots_used || 0)}/{Number(license.slots_total || 0)})
                                    </span>
                                    {license.expires_at && (
                                      <span className={`text-xs ${expiryInfo.color}`}>
                                        {expiryInfo.text}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            }) : null}
                          </SelectContent>
                        </Select>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="rounded-lg"
                            disabled={!selectedLicense}
                            onClick={() => {
                              if (selectedLicense) {
                                void assignLicense(selectedLicense, guild.guild_id);
                              }
                            }}
                          >
                            Assign
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <p className="text-xs text-muted-foreground">No available licenses</p>
                      </div>
                    )}
                  </div>

                  {/* Configure Button */}
                  <div className="pt-4 border-t border-border">
                    <Button 
                      className="w-full h-11 rounded-lg font-medium shadow-sm hover:shadow-md transition-all group/btn" 
                      onClick={() => router.push(`/comcraft/dashboard/${guild.guild_id}`)}
                    >
                      <span>Configure Server</span>
                      <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          }) : null}
        </div>
      </div>
    </div>
  );
}

