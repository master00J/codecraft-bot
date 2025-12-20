'use client';

/**
 * Guild Dashboard Layout with Persistent Sidebar
 */

import { useParams, usePathname, useRouter } from 'next/navigation';
import { Link } from '@/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Video,
  Target,
  GripVertical,
  Check,
  X,
  Sparkles as SparklesIcon,
  FileText,
  Heart,
  UserCog,
  Star,
  ClipboardList
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
  tier?: string; // Required subscription tier (Free, Basic, Premium, Enterprise)
}

export default function GuildDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const guildId = params.guildId as string;
  const [currentHash, setCurrentHash] = useState<string>('');
  const [featureTiers, setFeatureTiers] = useState<Record<string, string>>({});
  const [menuOrder, setMenuOrder] = useState<string[] | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Fetch subscription tiers and determine required tier for each feature
  useEffect(() => {
    async function fetchFeatureTiers() {
      try {
        const response = await fetch('/api/comcraft/subscription-tiers');
        const data = await response.json();
        
        if (data.success && data.tiers) {
          // Map menu items to feature keys
          const featureMap: Record<string, string> = {
            'Leveling': 'leveling',
            'Moderation': 'moderation_basic',
            'Commands': 'custom_commands',
            'Streaming': 'streaming_twitch',
            'Birthdays': 'birthday_manager',
            'Feedback': 'feedback_queue',
            'Tickets': 'support_tickets',
            'Economy': 'economy',
            'Stock Market': 'stock_market',
            'Casino': 'casino',
            'Analytics': 'analytics',
            'Statistics': 'user_statistics',
            'Reactions': 'auto_reactions',
            'Events': 'events',
            'Giveaways': 'giveaways',
            'Auto Roles': 'auto_roles',
            'Embeds': 'embed_builder',
            'Combat Items': 'pvp_duels',
            'Game News': 'game_news',
            'Scheduled Messages': 'scheduled_messages',
            'Vote Kick': 'vote_kick',
            'Cam-Only Voice': 'cam_only_voice',
            'Quests': 'quests',
            'Polls': 'polls',
            'Maid Jobs': 'maid_jobs',
            'AI Assistant': 'ai_assistant',
            'Bot Settings': 'custom_branding',
          };

          // Determine the minimum tier required for each feature
          // Only check active tiers, sorted by sort_order (lowest first)
          const activeTiers = data.tiers
            .filter((tier: any) => tier.is_active !== false)
            .sort((a: any, b: any) => a.sort_order - b.sort_order);
          const tierOrder = ['free', 'basic', 'premium', 'enterprise'];
          
          const newFeatureTiers: Record<string, string> = {};
          
          Object.entries(featureMap).forEach(([menuItem, featureKey]) => {
            // Find the first (lowest) active tier where this feature is enabled
            for (const tier of activeTiers) {
              const features = tier.features as Record<string, boolean> | undefined;
              if (features && features[featureKey] === true) {
                newFeatureTiers[menuItem] = tier.display_name;
                break;
              }
            }
            // If no tier has this feature enabled, don't set it (will show no badge)
          });
          
          setFeatureTiers(newFeatureTiers);
        }
      } catch (error) {
        console.error('Error fetching feature tiers:', error);
      }
    }

    fetchFeatureTiers();
    
    // Refresh feature tiers every 5 minutes to reflect admin changes
    const interval = setInterval(() => {
      fetchFeatureTiers();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  // Check access to this guild
  useEffect(() => {
    async function checkAccess() {
      if (!guildId) {
        setCheckingAccess(false);
        setHasAccess(false);
        return;
      }

      try {
        const response = await fetch(`/api/comcraft/guilds/${guildId}/access`);
        const data = await response.json();
        
        if (data.allowed) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    }

    checkAccess();
  }, [guildId]);

  // Fetch menu order
  useEffect(() => {
    async function fetchMenuOrder() {
      try {
        const response = await fetch(`/api/comcraft/guilds/${guildId}/menu-order`);
        const data = await response.json();
        if (data.menuOrder) {
          setMenuOrder(data.menuOrder);
        }
      } catch (error) {
        console.error('Error fetching menu order:', error);
      }
    }

    if (guildId && hasAccess) {
      fetchMenuOrder();
    }
  }, [guildId, hasAccess]);

  // Save menu order
  const saveMenuOrder = async (newOrder: string[]) => {
    setSavingOrder(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/menu-order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuOrder: newOrder }),
      });

      if (response.ok) {
        setMenuOrder(newOrder);
        setIsReorderMode(false);
      } else {
        console.error('Failed to save menu order');
      }
    } catch (error) {
      console.error('Error saving menu order:', error);
    } finally {
      setSavingOrder(false);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const currentOrder = menuOrder || navigation.map(item => item.name);
      const oldIndex = currentOrder.indexOf(active.id as string);
      const newIndex = currentOrder.indexOf(over.id as string);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex);
        setMenuOrder(newOrder);
      }
    }
  };

  const defaultNavigation: NavItem[] = [
    { name: 'Overview', href: `/comcraft/dashboard/${guildId}`, icon: LayoutDashboard },
    { name: 'Leveling', href: `/comcraft/dashboard/${guildId}#leveling`, icon: TrendingUp, tier: featureTiers['Leveling'] },
    { name: 'Moderation', href: `/comcraft/dashboard/${guildId}#moderation`, icon: Shield, tier: featureTiers['Moderation'] },
    { name: 'Commands', href: `/comcraft/dashboard/${guildId}#commands`, icon: MessageSquare, tier: featureTiers['Commands'] },
    { name: 'Streaming', href: `/comcraft/dashboard/${guildId}#streaming`, icon: Tv, tier: featureTiers['Streaming'] },
    { name: 'Birthdays', href: `/comcraft/dashboard/${guildId}#birthdays`, icon: Calendar, tier: featureTiers['Birthdays'] },
    { name: 'Feedback', href: `/comcraft/dashboard/${guildId}#feedback`, icon: MessageCircle, tier: featureTiers['Feedback'] },
    { name: 'Tickets', href: `/comcraft/dashboard/${guildId}#tickets`, icon: Ticket, tier: featureTiers['Tickets'] },
    { name: 'Economy', href: `/comcraft/dashboard/${guildId}#economy`, icon: DollarSign, tier: featureTiers['Economy'] },
    { name: 'Stock Market', href: `/comcraft/dashboard/${guildId}/economy/stock-market`, icon: TrendingUp, tier: featureTiers['Stock Market'] },
    { name: 'Casino', href: `/comcraft/dashboard/${guildId}#casino`, icon: Gamepad2, tier: featureTiers['Casino'] },
    { name: 'Analytics', href: `/comcraft/dashboard/${guildId}#analytics`, icon: BarChart3, tier: featureTiers['Analytics'] },
    { name: 'Statistics', href: `/comcraft/dashboard/${guildId}/stats`, icon: BarChart3, tier: featureTiers['Statistics'] },
    { name: 'Reactions', href: `/comcraft/dashboard/${guildId}#auto-reactions`, icon: SmilePlus, tier: featureTiers['Reactions'] },
    { name: 'Events', href: `/comcraft/dashboard/${guildId}/events`, icon: Gift, tier: featureTiers['Events'] },
    { name: 'Giveaways', href: `/comcraft/dashboard/${guildId}/giveaways`, icon: Sparkles, tier: featureTiers['Giveaways'] },
    { name: 'Auto Roles', href: `/comcraft/dashboard/${guildId}/autoroles`, icon: Users, tier: featureTiers['Auto Roles'] },
    { name: 'Embeds', href: `/comcraft/dashboard/${guildId}/embeds`, icon: Zap, tier: featureTiers['Embeds'] },
    { name: 'Combat Items', href: `/comcraft/dashboard/${guildId}/combat-items`, icon: Swords, tier: featureTiers['Combat Items'] },
    { name: 'Game News', href: `/comcraft/dashboard/${guildId}/game-news`, icon: Newspaper, tier: featureTiers['Game News'] },
    { name: 'Scheduled Messages', href: `/comcraft/dashboard/${guildId}/scheduled-messages`, icon: Clock, tier: featureTiers['Scheduled Messages'] },
    { name: 'Vote Kick', href: `/comcraft/dashboard/${guildId}/vote-kick`, icon: Vote, tier: featureTiers['Vote Kick'] },
    { name: 'Cam-Only Voice', href: `/comcraft/dashboard/${guildId}/cam-only-voice`, icon: Video, tier: featureTiers['Cam-Only Voice'] },
    { name: 'Quests', href: `/comcraft/dashboard/${guildId}/quests`, icon: Target, tier: featureTiers['Quests'] },
    { name: 'Polls', href: `/comcraft/dashboard/${guildId}/polls`, icon: BarChart3, tier: featureTiers['Polls'] },
    { name: 'User Profiles', href: `/comcraft/dashboard/${guildId}/user-profiles`, icon: FileText, tier: featureTiers['User Profiles'] },
    { name: 'Maid Jobs', href: `/comcraft/dashboard/${guildId}/maid-jobs`, icon: SparklesIcon, tier: featureTiers['Maid Jobs'] },
    { name: 'Referrals', href: `/comcraft/dashboard/${guildId}/referrals`, icon: Gift, tier: featureTiers['Referrals'] },
    { name: 'Vouches', href: `/comcraft/dashboard/${guildId}/vouches`, icon: Star },
    { name: 'Applications', href: `/comcraft/dashboard/${guildId}/applications`, icon: ClipboardList },
    { name: 'AI Assistant', href: `/comcraft/dashboard/${guildId}/ai`, icon: Bot, tier: featureTiers['AI Assistant'] },
    { name: 'Bot Settings', href: `/comcraft/dashboard/${guildId}/bot-personalizer`, icon: Settings, tier: featureTiers['Bot Settings'] },
    { name: 'Authorized Users', href: `/comcraft/dashboard/${guildId}/authorized-users`, icon: UserCog },
  ];

  // Apply menu order if available
  const navigation = menuOrder && menuOrder.length > 0
    ? menuOrder
        .map(name => defaultNavigation.find(item => item.name === name))
        .filter((item): item is NavItem => item !== undefined)
        .concat(defaultNavigation.filter(item => !menuOrder.includes(item.name)))
    : defaultNavigation;

  // Sortable Nav Item Component (only used in reorder mode)
  function SortableNavItem({ item }: { item: NavItem }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.name });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const Icon = item.icon;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-grab active:cursor-grabbing',
          isDragging ? 'bg-blue-600/20' : 'bg-gray-800/50 hover:bg-gray-800'
        )}
      >
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-gray-500" />
        </div>
        <Icon className="h-5 w-5 flex-shrink-0 text-gray-400" />
        <span className="flex-1 text-gray-300">{item.name}</span>
        <div className="flex items-center gap-1.5">
          {item.tier && (
            <span className={cn(
              "px-2 py-0.5 text-xs font-semibold rounded-full border",
              item.tier === 'Free' 
                ? "bg-gray-500/20 text-gray-300 border-gray-500/30"
                : item.tier === 'Basic'
                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                : item.tier === 'Premium'
                ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
            )}>
              {item.tier}
            </span>
          )}
        </div>
      </div>
    );
  }

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

  // Show loading while checking access
  if (checkingAccess) {
    return (
      <div className="flex min-h-screen bg-[#0f1419] items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-2">Loading...</div>
        </div>
      </div>
    );
  }

  // Show access denied if no access
  if (hasAccess === false) {
    return (
      <div className="flex min-h-screen bg-[#0f1419] items-center justify-center">
        <div className="text-center max-w-md p-8">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            You don't have permission to access this server's dashboard.
          </p>
          <Link href="/comcraft/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f1419]">
      {/* Sidebar - Fixed Left */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-[#1a1f2e] border-r border-gray-800 overflow-y-auto flex flex-col z-50">
        {/* Header */}
        <div className="p-4 border-b border-gray-800">
          <Link href="/comcraft/dashboard" className="flex items-center gap-3 group mb-3">
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
          {!isReorderMode ? (
            <button
              onClick={() => {
                setIsReorderMode(true);
                if (!menuOrder) {
                  setMenuOrder(navigation.map(item => item.name));
                }
              }}
              className="w-full px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2 justify-center"
            >
              <GripVertical className="h-3 w-3" />
              Reorder Menu
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (menuOrder) {
                    saveMenuOrder(menuOrder);
                  }
                }}
                disabled={savingOrder}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2 justify-center disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                {savingOrder ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setIsReorderMode(false);
                  // Reload original order
                  fetch(`/api/comcraft/guilds/${guildId}/menu-order`)
                    .then(res => res.json())
                    .then(data => setMenuOrder(data.menuOrder || null))
                    .catch(() => setMenuOrder(null));
                }}
                className="px-3 py-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {isReorderMode ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={navigation.map(item => item.name)}
                strategy={verticalListSortingStrategy}
              >
                {navigation.map((item) => (
                  <SortableNavItem key={item.name} item={item} />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            navigation.map((item) => {
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
                  <div className="flex items-center gap-1.5">
                    {item.tier && (
                      <span className={cn(
                        "px-2 py-0.5 text-xs font-semibold rounded-full border",
                        item.tier === 'Free' 
                          ? "bg-gray-500/20 text-gray-300 border-gray-500/30"
                          : item.tier === 'Basic'
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                          : item.tier === 'Premium'
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                          : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                      )}>
                        {item.tier}
                      </span>
                    )}
                    {item.badge && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          {/* Donation Button */}
          <DonationButton />
          
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

// Donation Button Component
function DonationButton() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'EUR'>('EUR');
  
  // Currency symbols and preset amounts
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
  };
  
  const presetAmounts: Record<string, number[]> = {
    USD: [5, 10, 25, 50, 100],
    EUR: [5, 10, 25, 50, 100],
  };
  
  const currencySymbol = currencySymbols[currency] || '$';
  const amounts = presetAmounts[currency] || [5, 10, 25, 50, 100];

  const handleDonate = async () => {
    try {
      setLoading(true);

      // Determine amount
      let amount: number;
      if (selectedAmount === -1 && customAmount) {
        // Custom amount
        amount = parseFloat(customAmount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error('Please enter a valid donation amount');
        }
        if (amount < 1) {
          throw new Error(`Minimum donation amount is ${currencySymbol}1`);
        }
      } else if (selectedAmount && selectedAmount > 0) {
        // Preset amount
        amount = selectedAmount;
      } else {
        throw new Error('Please select or enter a donation amount');
      }

      const response = await fetch('/api/comcraft/donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency, provider: 'stripe' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create donation checkout');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Donation error:', error);
      toast({
        title: 'Donation Failed',
        description: error.message || 'Please try again or contact support.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs text-gray-400 text-center px-2">
          You like this bot? Feel free to donate and support this bot
        </p>
        <button
          onClick={() => setShowDialog(true)}
          disabled={loading}
          className="w-full px-4 py-3 bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 border border-pink-500/30 hover:border-pink-500/50 rounded-lg transition-all duration-200 flex items-center gap-2 justify-center group"
        >
          <Heart className={cn(
            "h-4 w-4 transition-colors",
            loading ? "text-gray-500" : "text-pink-400 group-hover:text-pink-300"
          )} fill={loading ? "none" : "currentColor"} />
          <span className={cn(
            "text-sm font-medium transition-colors",
            loading ? "text-gray-500" : "text-gray-300 group-hover:text-white"
          )}>
            Support ComCraft
          </span>
        </button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Support ComCraft</DialogTitle>
            <DialogDescription>
              Choose a donation amount to support the development of ComCraft
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Currency selector */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={(value: 'USD' | 'EUR') => {
                setCurrency(value);
                setSelectedAmount(null);
                setCustomAmount('');
              }}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">Euro (€) - All payment methods</SelectItem>
                  <SelectItem value="USD">US Dollar ($)</SelectItem>
                </SelectContent>
              </Select>
              {currency === 'EUR' && (
                <p className="text-xs text-gray-400">EUR enables iDEAL, Bancontact, EPS, and Google Pay</p>
              )}
            </div>

            {/* Preset amounts */}
            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="grid grid-cols-3 gap-2">
                {amounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setSelectedAmount(amount);
                      setCustomAmount('');
                    }}
                    className={cn(
                      "px-4 py-2 rounded-lg border transition-all",
                      selectedAmount === amount
                        ? "bg-pink-500/20 border-pink-500/50 text-pink-300"
                        : "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600"
                    )}
                  >
                    {currencySymbol}{amount}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setSelectedAmount(-1);
                    setCustomAmount('');
                  }}
                  className={cn(
                    "px-4 py-2 rounded-lg border transition-all",
                    selectedAmount === -1
                      ? "bg-pink-500/20 border-pink-500/50 text-pink-300"
                      : "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600"
                  )}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Custom amount input */}
            {selectedAmount === -1 && (
              <div className="space-y-2">
                <Label htmlFor="customAmount">Custom Amount ({currency})</Label>
                <Input
                  id="customAmount"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
                <p className="text-xs text-gray-400">Minimum donation: {currencySymbol}1.00</p>
              </div>
            )}

            {/* Selected amount display */}
            {selectedAmount !== null && selectedAmount !== -1 && (
              <div className="p-3 bg-pink-500/10 border border-pink-500/30 rounded-lg">
                <p className="text-sm text-gray-300">
                  Selected: <span className="font-semibold text-pink-300">{currencySymbol}{selectedAmount}</span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => setShowDialog(false)}
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDonate}
              disabled={loading || (selectedAmount === null) || (selectedAmount === -1 && !customAmount)}
              className="px-4 py-2 text-sm font-medium bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Donate Now'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

