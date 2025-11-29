'use client';

/**
 * Guild Dashboard Layout with Persistent Sidebar
 */

import { useParams, usePathname, useRouter } from 'next/navigation';
import { Link } from '@/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  MessageSquare,
  Zap,
  Users,
  Shield,
  Sparkles,
  Calendar,
  Gift,
  Ticket,
  DollarSign,
  Gamepad2,
  Tv,
  SmilePlus,
  Settings,
  Bot,
  MessageCircle,
  BarChart3,
  Swords,
  Newspaper,
  Clock,
  Vote,
  Video
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
}

export default function GuildDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const guildId = params.guildId as string;
  const [currentHash, setCurrentHash] = useState<string>('');

  // Track hash changes for active state
  useEffect(() => {
    const updateHash = () => {
      if (typeof window !== 'undefined') {
        setCurrentHash(window.location.hash.slice(1));
      }
    };

    // Set initial hash
    updateHash();

    // Listen for hash changes
    window.addEventListener('hashchange', updateHash);
    window.addEventListener('popstate', updateHash);
    
    return () => {
      window.removeEventListener('hashchange', updateHash);
      window.removeEventListener('popstate', updateHash);
    };
  }, []);

  const navigation: NavItem[] = [
    { name: 'Overview', href: `/comcraft/dashboard/${guildId}`, icon: LayoutDashboard },
    { name: 'Leveling', href: `/comcraft/dashboard/${guildId}#leveling`, icon: TrendingUp },
    { name: 'Moderation', href: `/comcraft/dashboard/${guildId}#moderation`, icon: Shield },
    { name: 'Commands', href: `/comcraft/dashboard/${guildId}#commands`, icon: MessageSquare },
    { name: 'Streaming', href: `/comcraft/dashboard/${guildId}#streaming`, icon: Tv },
    { name: 'Birthdays', href: `/comcraft/dashboard/${guildId}#birthdays`, icon: Calendar },
    { name: 'Feedback', href: `/comcraft/dashboard/${guildId}#feedback`, icon: MessageCircle },
    { name: 'Tickets', href: `/comcraft/dashboard/${guildId}#tickets`, icon: Ticket },
    { name: 'Economy', href: `/comcraft/dashboard/${guildId}#economy`, icon: DollarSign },
    { name: 'Stock Market', href: `/comcraft/dashboard/${guildId}/economy/stock-market`, icon: TrendingUp },
    { name: 'Casino', href: `/comcraft/dashboard/${guildId}#casino`, icon: Gamepad2 },
    { name: 'Analytics', href: `/comcraft/dashboard/${guildId}#analytics`, icon: BarChart3 },
    { name: 'Statistics', href: `/comcraft/dashboard/${guildId}/stats`, icon: BarChart3 },
    { name: 'Reactions', href: `/comcraft/dashboard/${guildId}#auto-reactions`, icon: SmilePlus },
    { name: 'Events', href: `/comcraft/dashboard/${guildId}/events`, icon: Gift },
    { name: 'Giveaways', href: `/comcraft/dashboard/${guildId}/giveaways`, icon: Sparkles },
    { name: 'Auto Roles', href: `/comcraft/dashboard/${guildId}/autoroles`, icon: Users },
    { name: 'Embeds', href: `/comcraft/dashboard/${guildId}/embeds`, icon: Zap },
    { name: 'Combat Items', href: `/comcraft/dashboard/${guildId}/combat-items`, icon: Swords },
    { name: 'Game News', href: `/comcraft/dashboard/${guildId}/game-news`, icon: Newspaper },
    { name: 'Scheduled Messages', href: `/comcraft/dashboard/${guildId}/scheduled-messages`, icon: Clock },
    { name: 'Vote Kick', href: `/comcraft/dashboard/${guildId}/vote-kick`, icon: Vote },
    { name: 'Cam-Only Voice', href: `/comcraft/dashboard/${guildId}/cam-only-voice`, icon: Video },
    { name: 'AI Assistant', href: `/comcraft/dashboard/${guildId}/ai`, icon: Bot },
    { name: 'Bot Settings', href: `/comcraft/dashboard/${guildId}/bot-personalizer`, icon: Settings },
  ];

  const isActive = (href: string) => {
    if (!pathname) return false;
    
    // Split href into path and hash
    const [hrefPath, hrefHash] = href.split('#');
    
    // Get current hash directly from window (more reliable than state)
    const actualHash = typeof window !== 'undefined' ? window.location.hash.slice(1) : currentHash;
    
    // For hash anchors on the same page (e.g., #leveling, #moderation)
    if (hrefHash && hrefPath === `/comcraft/dashboard/${guildId}`) {
      // Check if we're on the overview page and if the hash matches
      if (pathname === hrefPath) {
        return actualHash === hrefHash;
      }
      return false;
    }
    
    // For exact match (Overview without hash)
    if (hrefPath === `/comcraft/dashboard/${guildId}`) {
      return pathname === hrefPath && !actualHash;
    }
    
    // For other routes (like /tickets, /analytics), check if pathname starts with the href
    return pathname.startsWith(hrefPath);
  };

  return (
    <div className="flex min-h-screen bg-[#0f1419]">
      {/* Sidebar - Fixed Left */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-[#1a1f2e] border-r border-gray-800 overflow-y-auto flex flex-col z-50">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <Link href="/comcraft/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                ComCraft
              </div>
              <div className="text-xs text-gray-400">Dashboard</div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            // Handle click for hash anchors to navigate to overview page first
            const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
              const [path, hash] = item.href.split('#');
              if (hash) {
                e.preventDefault();
                
                // Check if we're already on the overview page
                const isOnOverviewPage = pathname === `/comcraft/dashboard/${guildId}`;
                
                if (isOnOverviewPage) {
                  // If already on overview page, just update the hash directly
                  // This will trigger the hashchange event which the page component listens to
                  window.location.hash = hash;
                } else {
                  // If not on overview page, navigate to it with the hash
                  router.push(`/comcraft/dashboard/${guildId}#${hash}`);
                }
              }
              // For regular links, let the Link component handle navigation
            };
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <Link
            href="/comcraft/dashboard"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>Back to Servers</span>
          </Link>
        </div>
      </aside>

      {/* Main Content - Offset by sidebar width */}
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}

