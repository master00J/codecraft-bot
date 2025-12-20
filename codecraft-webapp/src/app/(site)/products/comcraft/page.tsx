'use client';

/**
 * Comcraft Bot - Product Showcase Page
 * Professional landing page for the Comcraft Discord Bot
 */

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Link } from '@/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  ArrowRight,
  Bot,
  BarChart3,
  Shield,
  Tv,
  Users,
  Zap,
  MessageSquare,
  Sparkles,
  Check,
  Star,
  Activity,
  Gift,
  Calendar,
  Ticket,
  Loader2,
  Wallet,
  CreditCard,
  Bitcoin,
  Newspaper,
  Smile,
  Coins,
  Settings,
  TrendingUp,
  Video,
  Award,
  Clock,
  Image as ImageIcon,
  MessageSquarePlus,
  Twitter,
  Pin,
  ClipboardList,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import { COMCRAFT_TIERS, ComcraftTierId } from '@/lib/comcraft/tiers';

interface ComcraftStats {
  activeServers: number;
  totalMembers: number;
  uptimePercentage: number;
  ticketsHandled: number;
}

interface SubscriptionTier {
  tier_name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  sort_order: number;
}

interface GuildConfig {
  guild_id: string;
  guild_name: string | null;
  subscription_tier: string | null;
  subscription_active: boolean | null;
}

interface PaymentProviderInfo {
  provider: string;
  display_name: string;
  auto_verification: boolean;
}

interface ManualInstruction {
  label: string;
  value: string;
}

export default function ComcraftProductPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [stats, setStats] = useState<ComcraftStats>({
    activeServers: 0,
    totalMembers: 0,
    uptimePercentage: 99.9,
    ticketsHandled: 0
  });
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [hasExistingGuilds, setHasExistingGuilds] = useState<boolean | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/comcraft/public-stats');
        const data = await response.json();
        
        if (data.success && data.stats) {
          setStats({
            activeServers: data.stats.activeServers || 0,
            totalMembers: data.stats.totalMembers || 0,
            uptimePercentage: data.stats.uptimePercentage || 99.9,
            ticketsHandled: data.stats.ticketsHandled || 0
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    async function fetchTiers() {
      try {
        const response = await fetch('/api/comcraft/subscription-tiers');
        const data = await response.json();
        
        if (data.success && data.tiers) {
          setTiers(data.tiers);
        }
      } catch (error) {
        console.error('Error fetching tiers:', error);
      } finally {
        setTiersLoading(false);
      }
    }

    fetchStats();
    fetchTiers();
  }, []);

  useEffect(() => {
    async function fetchGuildOwnership() {
      if (!session) {
        setHasExistingGuilds(null);
        return;
      }
      try {
        const response = await fetch('/api/comcraft/guilds');
        if (!response.ok) {
          throw new Error('Failed to fetch guilds');
        }
        const data = await response.json();
        const guilds = Array.isArray(data.guilds) ? data.guilds : [];
        setHasExistingGuilds(guilds.length > 0);
      } catch (error) {
        console.error('Error fetching user guilds:', error);
        setHasExistingGuilds(null);
      }
    }

    void fetchGuildOwnership();
  }, [session]);

  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_COMCRAFT_CLIENT_ID || ''}&permissions=8&scope=bot%20applications.commands`;

  const startCheckout = (tierId: string) => {
    if (tierId === 'enterprise' && hasExistingGuilds === false) {
      window.open(inviteUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!session) {
      signIn('discord');
      return;
    }
    router.push(`/comcraft/checkout?tier=${tierId}`);
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 pt-20 pb-32">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
                <Bot className="h-3 w-3 mr-1" />
                Premium Discord Bot
              </Badge>
              <h1 className="text-5xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Comcraft
              </h1>
              <p className="text-2xl text-gray-600 dark:text-gray-300 mb-4 font-semibold">
                The Ultimate Discord Bot for Content Creators
              </p>
              <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
                Level up your community with advanced leveling, moderation, stream notifications, and a beautiful web dashboard. Everything you need to grow your Discord server.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700" asChild>
                  <a href={`https://discord.com/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_COMCRAFT_CLIENT_ID || ''}&permissions=8&scope=bot%20applications.commands`} target="_blank" rel="noopener noreferrer">
                    <Bot className="mr-2 h-5 w-5" />
                    Add to Discord
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
                  <Link href="/comcraft/dashboard">
                    <BarChart3 className="mr-2 h-5 w-5" />
                    Open Dashboard
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Free to start</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Web dashboard included</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>24/7 support</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>New servers get 30 days of Enterprise</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl"></div>
              <Card className="relative p-8 shadow-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
                {loading ? (
                  <div className="space-y-6 animate-pulse">
                    <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="bg-blue-600 p-3 rounded-full">
                        <Activity className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Active Servers</div>
                        <div className="text-2xl font-bold">{stats.activeServers.toLocaleString()}+</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="bg-purple-600 p-3 rounded-full">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Members Managed</div>
                        <div className="text-2xl font-bold">{stats.totalMembers.toLocaleString()}+</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                      <div className="bg-pink-600 p-3 rounded-full">
                        <Zap className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Uptime</div>
                        <div className="text-2xl font-bold">{stats.uptimePercentage}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
              Features
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Powerful features designed specifically for content creators and community managers
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-blue-500">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg w-fit mb-4">
                <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Advanced Leveling System</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Fully customizable XP system with level rewards, role rewards, and beautiful leaderboards. Keep your members engaged and coming back.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom XP rates per channel</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Automatic role rewards</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Rank-based XP multipliers</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Global & server leaderboards</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-purple-500">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg w-fit mb-4">
                <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Smart Moderation</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Keep your server safe with auto-moderation, warns, mutes, kicks, bans, and comprehensive logging.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Auto-mod (spam, links, bad words)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Warn & mute system</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Detailed mod logs</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-pink-500">
              <div className="bg-pink-100 dark:bg-pink-900/30 p-3 rounded-lg w-fit mb-4">
                <Tv className="h-8 w-8 text-pink-600 dark:text-pink-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Stream Notifications</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Automatic notifications when you go live on Twitch or YouTube with beautiful custom embeds.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Twitch integration</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>YouTube integration</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom notification messages</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-green-500">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg w-fit mb-4">
                <MessageSquare className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Custom Commands</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create unlimited custom commands with embeds, variables, and advanced features.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Unlimited commands (Premium)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Embed builder</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Variables & placeholders</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-yellow-500">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg w-fit mb-4">
                <Users className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Welcome & Auto-Roles</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Welcome new members with custom messages and automatically assign roles.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom welcome messages</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Auto-assign roles</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Reaction roles</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-indigo-500">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-lg w-fit mb-4">
                <Activity className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Analytics Dashboard</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Track your server growth and member activity with detailed analytics and insights.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Member growth charts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Activity heatmaps</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Engagement metrics</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-orange-500">
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg w-fit mb-4">
                <Gift className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Giveaways</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Run engaging giveaways to boost community participation with automatic winner selection.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Easy giveaway setup</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Automatic winner selection</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Requirements & restrictions</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-teal-500">
              <div className="bg-teal-100 dark:bg-teal-900/30 p-3 rounded-lg w-fit mb-4">
                <Calendar className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Event Management</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Comprehensive event management system with RSVP, automatic reminders, and Discord announcements. Perfect for gaming nights, tournaments, and community events.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>RSVP system with Going/Maybe/Not Going</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Automatic reminders (customizable times)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Recurring events & role mentions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Interactive RSVP buttons in Discord</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-cyan-500">
              <div className="bg-cyan-100 dark:bg-cyan-900/30 p-3 rounded-lg w-fit mb-4">
                <Sparkles className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Birthday Manager</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Never miss a member's birthday with automatic announcements and special roles.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Auto birthday announcements</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Temporary birthday role</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom messages</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-red-500">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg w-fit mb-4">
                <Ticket className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Support Tickets</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Professional ticket system with transcripts, categories, and dashboard management.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Private ticket channels</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Ticket transcripts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Web dashboard</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-emerald-500">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-lg w-fit mb-4">
                <Newspaper className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Game News</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Automatic game updates and patch notes for popular games. Keep your community informed with the latest news.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>League of Legends, Valorant, Fortnite</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Minecraft, CS2 & more</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom filters & notifications</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-amber-500">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-lg w-fit mb-4">
                <Smile className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Auto-Reactions</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Automatically react to messages with custom emojis based on trigger words. Make your server more engaging.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom trigger words</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Server emoji support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Cooldown system</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-violet-500">
              <div className="bg-violet-100 dark:bg-violet-900/30 p-3 rounded-lg w-fit mb-4">
                <Coins className="h-8 w-8 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Economy & Casino</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Full-featured economy system with virtual currency, casino games, and leaderboards. Boost engagement.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Blackjack, Slots, Roulette</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Daily rewards & missions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Economy leaderboards</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-red-500">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg w-fit mb-4">
                <Zap className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">PvP Duels</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Challenge members to epic combat duels with coin betting. Animated battles with health bars and critical hits.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Real-time animated combat</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Coin betting & winner takes all</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Health bars, crits & misses</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-slate-500">
              <div className="bg-slate-100 dark:bg-slate-900/30 p-3 rounded-lg w-fit mb-4">
                <Settings className="h-8 w-8 text-slate-600 dark:text-slate-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Custom Bots</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Run your own branded bot with custom profile, status, and colors. Perfect for professional communities.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom bot name & avatar</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Branded embeds & colors</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>All Comcraft features included</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-rose-500">
              <div className="bg-rose-100 dark:bg-rose-900/30 p-3 rounded-lg w-fit mb-4">
                <TrendingUp className="h-8 w-8 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Stock Market System</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Advanced stock trading simulation with real-time price updates, limit orders, dividends, and market events. Engage your community with a complete economy experience.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Buy & sell stocks with real-time prices</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Limit orders & stop-loss protection</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Market events (IPOs, crashes, dividends)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Price alerts & portfolio tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Price charts & market leaderboards</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-blue-500">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg w-fit mb-4">
                <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">User Statistics & Analytics</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Comprehensive user activity tracking with beautiful stats cards. Track messages, voice activity, ranks, and more with customizable themes and visualizations.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Message & voice activity tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Beautiful customizable stats cards</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Server ranks & top channels</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Daily activity charts & insights</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-purple-500">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg w-fit mb-4">
                <Video className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Cam-Only Voice Channels</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Enforce camera requirements in specific voice channels with configurable grace periods, warnings, and automatic disconnection. Perfect for meetings and video calls.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Require camera in selected channels</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Configurable grace period & warnings</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Timeout system for repeated violations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Exempt roles & per-channel logging</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-indigo-500">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-lg w-fit mb-4">
                <Award className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Rank-Based XP Multipliers</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Reward specific Discord roles with custom XP multipliers. VIP members, staff, and premium roles can earn XP faster than regular members.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom multipliers per role</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Combines with tier bonuses</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Easy role selection in dashboard</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-orange-500">
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg w-fit mb-4">
                <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Scheduled Messages</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Schedule announcements, reminders, and messages to be sent automatically at specific times or intervals. Perfect for regular updates and community management.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Schedule messages at specific times</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Recurring messages & intervals</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Rich embed support & variables</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-pink-500">
              <div className="bg-pink-100 dark:bg-pink-900/30 p-3 rounded-lg w-fit mb-4">
                <ImageIcon className="h-8 w-8 text-pink-600 dark:text-pink-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Embed Builder</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create stunning Discord embeds with our visual editor. Design custom messages, announcements, and notifications with colors, images, fields, and more.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Visual embed editor</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom colors, images & thumbnails</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Fields, footers & timestamps</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-green-500">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg w-fit mb-4">
                <MessageSquarePlus className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Feedback & Suggestions System</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Let members submit feedback and suggestions directly through Discord. Manage, review, and respond to community input from the dashboard.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Easy submission via commands</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Dashboard management & review</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Status tracking & responses</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-sky-500">
              <div className="bg-sky-100 dark:bg-sky-900/30 p-3 rounded-lg w-fit mb-4">
                <Twitter className="h-8 w-8 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Twitter/X Monitor</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Automatically post new tweets from Twitter/X accounts to your Discord channels. Monitor multiple accounts with custom notifications and filters.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Monitor unlimited Twitter accounts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Filter retweets & replies</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom notifications & role mentions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Automatic checks every 2 minutes</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-yellow-500">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg w-fit mb-4">
                <Star className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Vouch & Reputation System</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Let community members vouch for each other with 1-5 star ratings and comments. Build trust and showcase top contributors with reputation leaderboards.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>1-5 star rating system</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Optional comments & reviews</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Top reputation leaderboards</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Admin management dashboard</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-emerald-500">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-lg w-fit mb-4">
                <Pin className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Sticky Messages</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Pin important messages that automatically stay at the bottom of your channels. Perfect for rules, announcements, and persistent information.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Auto-repost on new messages</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Rich embed support</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Per-channel configuration</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Easy enable/disable toggle</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all border-2 hover:border-blue-500">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg w-fit mb-4">
                <ClipboardList className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Staff Applications</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Professional staff recruitment system with custom questions, voting system, and approval workflow. Streamline your hiring process with comprehensive application management.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Custom application questions</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Voting system for staff</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Approve/reject with reasons</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Cooldowns & account age requirements</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Dashboard management & analytics</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Power Modules Section */}
      <section className="py-24 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-slate-950">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
              Deep Dive
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Built for Content Creators</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Comcraft bundles every system you need to run a thriving community: AI assistance, enterprise-grade auto-moderation, creator workflows, and advanced monetisation tools—all managed from a single dashboard.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <Card className="p-8 border-0 shadow-xl bg-white/80 dark:bg-gray-900/60 backdrop-blur">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-6 w-6 text-purple-500" />
                <h3 className="text-2xl font-semibold">AI-Powered Assistant</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Claude and Gemini integrations deliver real-time coaching for members, automated FAQs, and on-demand web search when information is missing. Personas, memory, and document curation keep responses consistent per guild.
              </p>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 mt-0.5" />Trainable personas with knowledge base and pin priority</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 mt-0.5" />Live chat widget with AI-to-human handover</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 mt-0.5" />Per-guild web search toggle plus complete audit logging</li>
              </ul>
            </Card>

            <Card className="p-8 border-0 shadow-xl bg-white/80 dark:bg-gray-900/60 backdrop-blur">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-blue-500" />
                <h3 className="text-2xl font-semibold">Enterprise Auto-Moderation</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                The new auto-mod engine combines AI content moderation with granular filters for spam, links, invites, caps and toxic behaviour. It detects raids, triggers slowmode automatically and can auto-ban members after configurable warning thresholds.
              </p>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 mt-0.5" />Anti-raid protection (mass joins, auto-lockdown, optional auto-kick)</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 mt-0.5" />Mention, emoji and duplicate spam filters with cooldown windows</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 mt-0.5" />Moderator hub with warns, strikes, auto-ban and live metrics</li>
              </ul>
            </Card>

            <Card className="p-8 border-0 shadow-xl bg-white/80 dark:bg-gray-900/60 backdrop-blur">
              <div className="flex items-center gap-3 mb-4">
                <Tv className="h-6 w-6 text-rose-500" />
                <h3 className="text-2xl font-semibold">Creator Automation Suite</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Automate every touchpoint around your brand: multi-platform livestream alerts, feedback and ticket workflows, birthdays, giveaways and subscriptions backed by Supabase for customer analytics.
              </p>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 mt-0.5" />Feedback and ticket dashboards with analytics and transcript exports</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 mt-0.5" />Integrated premium trials, licensing, and usage logging</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-green-500 mt-0.5" />Automation hooks for role rewards, workflows, and webhooks</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Trial Section */}
      <section className="py-24 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4" variant="secondary">
                30-Day Enterprise Trial
              </Badge>
              <h2 className="text-4xl font-bold mb-4">Try Every Feature Risk-Free</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                Every new guild automatically unlocks the Enterprise package for 30 days. All AI capabilities, advanced auto-mod, unlimited custom commands and premium analytics are enabled the moment you install Comcraft.
              </p>
              <ul className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex gap-3"><Check className="h-5 w-5 text-green-500 mt-0.5" />No credit card required—upgrade only when your team is ready to scale.</li>
                <li className="flex gap-3"><Check className="h-5 w-5 text-green-500 mt-0.5" />Automatic downgrade to Free after the trial with zero data loss.</li>
                <li className="flex gap-3"><Check className="h-5 w-5 text-green-500 mt-0.5" />Keep every configuration, workflow and AI memory if you upgrade later.</li>
              </ul>
            </div>
            <Card className="p-8 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10 border-2 border-blue-500/20">
              <h3 className="text-2xl font-semibold mb-6">What&apos;s included during the trial?</h3>
              <ul className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-3"><Check className="h-5 w-5 text-green-500 mt-0.5" />Enterprise AI quota with Claude 3.5 Haiku + Gemini 1.5 Pro, including web search and extended memory</li>
                <li className="flex gap-3"><Check className="h-5 w-5 text-green-500 mt-0.5" />Full moderation suite (auto-ban, raid detection, moderation analytics, escalation workflows)</li>
                <li className="flex gap-3"><Check className="h-5 w-5 text-green-500 mt-0.5" />Unlimited tickets, feedback, giveaways and stream alerts with automated transcripts</li>
                <li className="flex gap-3"><Check className="h-5 w-5 text-green-500 mt-0.5" />Premium analytics dashboards, usage stats, and branding controls for every embed</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
              Pricing
            </Badge>
            <h2 className="text-4xl font-bold mb-4">Choose Your Plan</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Start free and upgrade as you grow. All plans include the web dashboard and 24/7 support.
            </p>
          </div>
          
          {tiersLoading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
              {tiers.map((tier) => {
                const isPremium = tier.tier_name === 'premium';
                const isFree = tier.price_monthly === 0;
                const currencySymbol = tier.currency === 'EUR' ? '€' : '$';
                
                return (
                  <Card 
                    key={tier.tier_name} 
                    className={`p-8 border-2 hover:shadow-xl transition-shadow ${
                      isPremium ? 'border-purple-500 relative' : ''
                    }`}
                  >
                    {isPremium && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
                          <Star className="h-3 w-3 mr-1" />
                          MOST POPULAR
                        </Badge>
                      </div>
                    )}
                    
                    <h3 className="text-2xl font-bold mb-2">{tier.display_name}</h3>
                    <div className="text-4xl font-bold mb-1">
                      {currencySymbol}{tier.price_monthly.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {tier.price_monthly === 0 ? 'forever' : 'per month'}
                    </div>
                    {tier.price_yearly > 0 && (
                      <div className="text-xs text-gray-500 mb-4">
                        or {currencySymbol}{tier.price_yearly.toFixed(2)}/year
                      </div>
                    )}
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      {tier.description}
                    </p>
                    
                    <ul className="space-y-3 mb-8 text-sm">
                      {Object.entries(tier.features).filter(([, enabled]) => enabled).map(([key]) => (
                        <li key={key} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{key.replace(/_/g, ' ')}</span>
                        </li>
                      ))}
                      
                      {Object.entries(tier.limits).slice(0, 3).map(([key, value]) => (
                        <li key={key} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>
                            {value === -1 ? 'Unlimited' : value}x {key.replace(/_/g, ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                    
                    {isFree ? (
                      <Button className="w-full" variant="outline" asChild>
                        <Link href="/comcraft/dashboard">Get Started</Link>
                      </Button>
                    ) : (
                      <Button
                        className={`w-full ${
                          isPremium
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                            : ''
                        }`}
                        onClick={() => startCheckout(tier.tier_name)}
                      >
                        {tier.tier_name === 'enterprise' ? 'Try Enterprise' : `Choose ${tier.display_name}`}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6 lg:px-8">
          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 border-0 p-12 md:p-16 text-white text-center">
            <div className="absolute inset-0 bg-grid-white/10"></div>
            <div className="relative z-10">
              <Sparkles className="h-12 w-12 mx-auto mb-6" />
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Level Up Your Server?</h2>
              <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                Join thousands of content creators using Comcraft to grow their communities. Install today, explore the full Enterprise stack for 30 days, and upgrade only when you&apos;re ready.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" className="text-lg px-8 py-6" asChild>
                  <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                    <Bot className="mr-2 h-5 w-5" />
                    Add to Discord - Start Trial
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-lg px-8 py-6" asChild>
                  <a href="https://discord.gg/vywm9GDNwc" target="_blank" rel="noopener noreferrer">
                    <Users className="mr-2 h-5 w-5" />
                    Join Our Discord
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Legal Links Section */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center">
            <p className="text-sm text-muted-foreground">
              By using ComCraft, you agree to our
            </p>
            <div className="flex gap-4">
              <Link href="/comcraft/terms">
                <Button variant="link" className="text-sm">
                  Terms of Service
                </Button>
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link href="/comcraft/privacy">
                <Button variant="link" className="text-sm">
                  Privacy Policy
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}