'use client';

/**
 * Comcraft Guild Dashboard - Optimized Single Page
 * All tabs in one component for instant switching
 */

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, ExternalLink, Bot, ArrowRight } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_FEEDBACK_DESCRIPTION = 'Click the button below to submit your sample for feedback.\n\n• Provide a Soundcloud, YouTube, Dropbox... link\n• Optionally add context (genre, type of feedback)\n• Moderators pick submissions in order during feedback sessions';
const DEFAULT_FEEDBACK_BUTTON_LABEL = '🎵 Submit Sample';
const DEFAULT_FEEDBACK_EMBED_TITLE = '🎧 Sample Feedback Queue';
const DEFAULT_FEEDBACK_COLOR = '#8B5CF6';
const DEFAULT_FEEDBACK_FOOTER = 'ComCraft Feedback Queue';
const DEFAULT_NOTIFICATION_MESSAGE = '🔔 New submission from {{user}} waiting for feedback!';

export default function GuildDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Lazy loading state
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({
    overview: true,
  });
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({});
  
  const [updateNotificationsEnabled, setUpdateNotificationsEnabled] = useState(true);
  const [updateNotificationsSaving, setUpdateNotificationsSaving] = useState(false);
  const [updateNotificationChannelId, setUpdateNotificationChannelId] = useState<string>('none');
  const [updateNotificationTypes, setUpdateNotificationTypes] = useState<string[]>(['feature', 'improvement', 'bugfix', 'security', 'breaking']);
  const [updateNotificationRoleIds, setUpdateNotificationRoleIds] = useState<string[]>([]);
  
  // Leveling customization state
  const [levelingConfig, setLevelingConfig] = useState<any>(null);
  const [levelingSaving, setLevelingSaving] = useState(false);
  const [xpBarImage, setXpBarImage] = useState<string>('');
  const [xpBarColor, setXpBarColor] = useState<string>('#5865F2');
  const [xpBarStyle, setXpBarStyle] = useState<'gradient' | 'solid' | 'image'>('gradient');
  const [rankCardBackground, setRankCardBackground] = useState<string>('');
  const [rankCardBorderColor, setRankCardBorderColor] = useState<string>('#5865F2');
  const [levelupAnimation, setLevelupAnimation] = useState<'none' | 'confetti' | 'fireworks' | 'sparkles'>('confetti');
  const [xpBarPosition, setXpBarPosition] = useState<'top' | 'bottom' | 'center'>('bottom');
  
  // Pre-loaded data for all tabs (lazy loaded)
  const [commands, setCommands] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);

  const { toast } = useToast();

  const defaultBirthdaySettings = {
    birthdays_enabled: false,
    birthday_channel_id: '',
    birthday_role_id: '',
    birthday_message_template: 'Happy birthday {user}! 🎂',
    birthday_ping_role: true,
    birthday_announcement_time: '09:00:00'
  };

const [birthdays, setBirthdays] = useState<any[]>([]);
const [birthdaySettings, setBirthdaySettings] = useState<any>(defaultBirthdaySettings);
const [channels, setChannels] = useState<any[]>([]);
const [roles, setRoles] = useState<any[]>([]);
const [feedbackConfig, setFeedbackConfig] = useState<any>(null);
const [feedbackPending, setFeedbackPending] = useState<any[]>([]);
const [feedbackInProgress, setFeedbackInProgress] = useState<any[]>([]);
const [feedbackCompleted, setFeedbackCompleted] = useState<any[]>([]);
const [feedbackSetupChannel, setFeedbackSetupChannel] = useState('none');
const [feedbackSetupRole, setFeedbackSetupRole] = useState('none');
const [feedbackActionLoading, setFeedbackActionLoading] = useState(false);
const [feedbackModalTitle, setFeedbackModalTitle] = useState('Submit your sample for feedback');
const [feedbackModalLinkLabel, setFeedbackModalLinkLabel] = useState('Sample link');
const [feedbackModalNotesEnabled, setFeedbackModalNotesEnabled] = useState(true);
const [feedbackModalNotesLabel, setFeedbackModalNotesLabel] = useState('Feedback request');
const [feedbackModalNotesRequired, setFeedbackModalNotesRequired] = useState(false);
const [feedbackExtraFields, setFeedbackExtraFields] = useState<any[]>([]);
const [feedbackModalSaving, setFeedbackModalSaving] = useState(false);
const [feedbackEmbedTitle, setFeedbackEmbedTitle] = useState(DEFAULT_FEEDBACK_EMBED_TITLE);
const [feedbackEmbedDescription, setFeedbackEmbedDescription] = useState(DEFAULT_FEEDBACK_DESCRIPTION);
const [feedbackEmbedColor, setFeedbackEmbedColor] = useState(DEFAULT_FEEDBACK_COLOR);
const [feedbackEmbedFooter, setFeedbackEmbedFooter] = useState(DEFAULT_FEEDBACK_FOOTER);
const [feedbackEmbedThumbnail, setFeedbackEmbedThumbnail] = useState('');
const [feedbackEmbedImage, setFeedbackEmbedImage] = useState('');
const [feedbackButtonLabel, setFeedbackButtonLabel] = useState(DEFAULT_FEEDBACK_BUTTON_LABEL);
const [feedbackButtonStyle, setFeedbackButtonStyle] = useState<'primary' | 'secondary' | 'success' | 'danger'>('primary');
const [feedbackButtonEmoji, setFeedbackButtonEmoji] = useState('');
const [feedbackQueueSaving, setFeedbackQueueSaving] = useState(false);
const [feedbackNotificationChannel, setFeedbackNotificationChannel] = useState('none');
const [feedbackNotificationRole, setFeedbackNotificationRole] = useState('none');
const [feedbackNotificationMessage, setFeedbackNotificationMessage] = useState(DEFAULT_NOTIFICATION_MESSAGE);
  const [birthdayForm, setBirthdayForm] = useState({
    id: '',
    user_id: '',
    username: '',
    display_name: '',
    birthday: '',
    timezone: '',
    is_private: 'false'
  });
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdaySettingsSaving, setBirthdaySettingsSaving] = useState(false);
  
  // Economy state
  const [economyConfig, setEconomyConfig] = useState<any>(null);
  const [economyStats, setEconomyStats] = useState<any>(null);
  const [economySaving, setEconomySaving] = useState(false);
  
  // Casino state
  const [casinoConfig, setCasinoConfig] = useState<any>(null);
  const [casinoStats, setCasinoStats] = useState<any>(null);
  const [casinoSaving, setCasinoSaving] = useState(false);
  
  // Discord invite link
  const [discordInviteLink, setDiscordInviteLink] = useState<string | null>(null);

  // Ref to track if we're updating from hash change to prevent loops
  const isUpdatingFromHash = React.useRef(false);

  // Format birthday date (supports both DD-MM and YYYY-MM-DD formats)
  const formatBirthday = (value?: string) => {
    if (!value) return 'Unknown';
    
    // YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB');
      }
    }
    
    // DD-MM format
    if (/^\d{2}-\d{2}$/.test(value)) {
      const [day, month] = value.split('-').map(Number);
      // Year doesn't matter, just for display
      const d = new Date(2000, month - 1, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      }
    }
    
    // Fallback: show raw value if it's something exotic
    return value;
  };

  // Fetch only essential data on mount
  useEffect(() => {
    if (guildId) {
      fetchEssentialData().catch(err => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Fatal error in fetchEssentialData:', err);
        }
        setLoading(false);
      });
    }
  }, [guildId]);

  // Fetch invite link when config is loaded
  useEffect(() => {
    if (config?.guild) {
      fetchDiscordInvite();
    }
  }, [config]);

  // Handle hash anchor navigation from sidebar
  useEffect(() => {
    const hashToTab: Record<string, string> = {
      'leveling': 'leveling',
      'moderation': 'moderation',
      'commands': 'commands',
      'streaming': 'streaming',
      'birthdays': 'birthdays',
      'feedback': 'feedback',
      'tickets': 'tickets',
      'economy': 'economy',
      'casino': 'casino',
      'analytics': 'analytics',
      'auto-reactions': 'auto-reactions',
    };

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove the #
      
      // Mark that we're updating from hash change to prevent loop
      isUpdatingFromHash.current = true;
      
      if (hash) {
        const tabValue = hashToTab[hash];
        if (tabValue) {
          setActiveTab((prevTab) => {
            // Only update if different to avoid unnecessary re-renders
            return prevTab !== tabValue ? tabValue : prevTab;
          });
          return;
        }
      }
      // If no hash, set to overview
      if (!hash) {
        setActiveTab((prevTab) => {
          return prevTab !== 'overview' ? 'overview' : prevTab;
        });
      }
    };

    // Check hash immediately and after a short delay (for initial load)
    handleHashChange();
    const timeoutId = setTimeout(handleHashChange, 100);

    // Listen for hash changes and popstate (browser back/forward)
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, [guildId]);

  // Update hash when tab changes (but only if hash doesn't already match to avoid loops)
  useEffect(() => {
    // Skip if we're updating from a hash change to avoid loops
    if (isUpdatingFromHash.current) {
      isUpdatingFromHash.current = false;
      return;
    }
    
    const tabToHash: Record<string, string> = {
      'leveling': 'leveling',
      'moderation': 'moderation',
      'commands': 'commands',
      'streaming': 'streaming',
      'birthdays': 'birthdays',
      'feedback': 'feedback',
      'tickets': 'tickets',
      'economy': 'economy',
      'casino': 'casino',
      'analytics': 'analytics',
      'auto-reactions': 'auto-reactions',
    };
    
    if (activeTab && activeTab !== 'overview') {
      const hash = tabToHash[activeTab];
      const currentHash = window.location.hash.slice(1);
      // Only update hash if it doesn't match to avoid conflicts
      if (hash && currentHash !== hash) {
        // Use replaceState to avoid triggering hashchange event
        window.history.replaceState(null, '', `#${hash}`);
      }
    } else if (activeTab === 'overview') {
      // Only remove hash if it exists and doesn't match a valid tab
      const currentHash = window.location.hash.slice(1);
      if (currentHash && !tabToHash[currentHash]) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [activeTab]);

  // Fetch Discord invite link
  const fetchDiscordInvite = async () => {
    // First, try to get invite link from config (if stored in database)
    if (config?.guild?.discord_invite_link) {
      setDiscordInviteLink(config.guild.discord_invite_link);
      return;
    }
    
    // Only try bot API if it's configured and not localhost (production)
    const botApiUrl = process.env.NEXT_PUBLIC_COMCRAFT_BOT_API_URL;
    if (botApiUrl && !botApiUrl.includes('localhost')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch(`${botApiUrl}/api/discord/${guildId}/invite`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data.inviteUrl && data.inviteUrl.startsWith('https://discord.gg/')) {
            setDiscordInviteLink(data.inviteUrl);
            return;
          }
        }
      } catch (error) {
        // Silently fail - bot API might not be available
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Bot API not available for invite link');
        }
      }
    }
    
    // If no invite link is available, don't set one (button won't show)
    setDiscordInviteLink(null);
  };

  // Fetch only essential data on initial load
  const fetchEssentialData = async () => {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) console.log('🔄 Fetching essential data for guild:', guildId);
    setLoading(true);
    
    try {
      // Only fetch config, channels, roles, and update notifications (needed for overview)
      const [configRes, channelsRes, rolesRes, updateNotificationsRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/config`).catch(e => {
          if (isDev) console.error('❌ Config fetch failed:', e);
          return { ok: false, json: async () => ({}) };
        }),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`).catch(e => {
          if (isDev) console.error('❌ Channels failed:', e);
          return { ok: false, json: async () => ({ channels: { text: [] } }) };
        }),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`).catch(e => {
          if (isDev) console.error('❌ Roles failed:', e);
          return { ok: false, json: async () => ({ roles: [] }) };
        }),
        fetch(`/api/comcraft/guilds/${guildId}/update-notifications`).catch(e => {
          if (isDev) console.error('❌ Update notifications failed:', e);
          return { ok: false, json: async () => ({ enabled: true }) };
        })
      ]);

      const [configData, channelsData, rolesData, updateNotificationsData] = await Promise.all([
        configRes.json().catch(e => { if (isDev) console.error('❌ Config JSON parse failed:', e); return {}; }),
        channelsRes.json().catch(e => { if (isDev) console.error('❌ Channels JSON failed:', e); return { channels: { text: [] } }; }),
        rolesRes.json().catch(e => { if (isDev) console.error('❌ Roles JSON failed:', e); return { roles: [] }; }),
        updateNotificationsRes.json().catch(e => { if (isDev) console.error('❌ Update notifications JSON failed:', e); return { enabled: true }; })
      ]);

      // Set essential data
      setConfig(configData);
      
      if (configData.guild) {
        // Bot personalization is handled on a separate page
      }

      if (updateNotificationsData) {
        setUpdateNotificationsEnabled(updateNotificationsData.enabled ?? true);
        setUpdateNotificationChannelId(updateNotificationsData.channelId || 'none');
        setUpdateNotificationTypes(updateNotificationsData.types || ['feature', 'improvement', 'bugfix', 'security', 'breaking']);
        setUpdateNotificationRoleIds(updateNotificationsData.roleIds || []);
      }

      if (channelsData?.channels?.text) {
        setChannels(channelsData.channels.text);
      }

      if (rolesData?.roles) {
        setRoles(rolesData.roles);
      }

      setLoading(false);
    } catch (error) {
      if (isDev) console.error('Error in fetchEssentialData:', error);
      setLoading(false);
    }
  };

  // Individual fetch functions for each tab (reusable)
  const fetchCommandsData = async () => {
    const isDev = process.env.NODE_ENV === 'development';
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/commands`).catch(e => {
        if (isDev) console.error('❌ Commands failed:', e);
        return { ok: false, json: async () => ({ commands: [] }) };
      });
      const data = await res.json().catch(() => ({ commands: [] }));
      setCommands(data.commands || []);
    } catch (error) {
      if (isDev) console.error('Error fetching commands:', error);
      throw error;
    }
  };

  const fetchStreamsData = async () => {
    const isDev = process.env.NODE_ENV === 'development';
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/streams`).catch(e => {
        if (isDev) console.error('❌ Streams failed:', e);
        return { ok: false, json: async () => ({ streams: [] }) };
      });
      const data = await res.json().catch(() => ({ streams: [] }));
      setStreams(data.streams || []);
    } catch (error) {
      if (isDev) console.error('Error fetching streams:', error);
      throw error;
    }
  };

  const fetchBirthdaysData = async () => {
    const isDev = process.env.NODE_ENV === 'development';
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/birthdays`).catch(e => {
        if (isDev) console.error('❌ Birthdays failed:', e);
        return { ok: false, json: async () => ({ birthdays: [], settings: {} }) };
      });
      const data = await res.json().catch(() => ({ birthdays: [], settings: {} }));
      setBirthdays(data.birthdays || []);
      setBirthdaySettings({
        ...defaultBirthdaySettings,
        ...(data.settings || {})
      });
    } catch (error) {
      if (isDev) console.error('Error fetching birthdays:', error);
      throw error;
    }
  };

  const fetchFeedbackData = async () => {
    const isDev = process.env.NODE_ENV === 'development';
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/feedback`).catch(e => {
        if (isDev) console.error('❌ Feedback failed:', e);
        return { ok: false, json: async () => ({ config: null, pending: [], inProgress: [], recentCompleted: [] }) };
      });
      const data = await res.json().catch(() => ({ config: null, pending: [], inProgress: [], recentCompleted: [] }));
      const cfg = data.config || null;
      setFeedbackConfig(cfg);
      setFeedbackPending(data.pending || []);
      setFeedbackInProgress(data.inProgress || []);
      setFeedbackCompleted(data.recentCompleted || []);
      
      if (cfg) {
        setFeedbackSetupChannel(cfg.channel_id || 'none');
        setFeedbackSetupRole(cfg.button_role_id || 'none');
        setFeedbackModalTitle(cfg.modal_title || 'Submit your sample for feedback');
        setFeedbackModalLinkLabel(cfg.modal_link_label || 'Sample link');
        const notesEnabled = cfg.modal_notes_label !== null;
        setFeedbackModalNotesEnabled(notesEnabled);
        setFeedbackModalNotesLabel(notesEnabled ? (cfg.modal_notes_label || 'Feedback request') : 'Feedback request');
        setFeedbackModalNotesRequired(notesEnabled ? !!cfg.modal_notes_required : false);
        setFeedbackExtraFields(Array.isArray(cfg.extra_fields) ? cfg.extra_fields : []);
        const rawColor = typeof cfg.queue_embed_color === 'string' && cfg.queue_embed_color.trim() !== ''
          ? cfg.queue_embed_color.trim()
          : DEFAULT_FEEDBACK_COLOR;
        setFeedbackEmbedTitle(typeof cfg.queue_embed_title === 'string' && cfg.queue_embed_title.trim().length > 0
          ? cfg.queue_embed_title
          : DEFAULT_FEEDBACK_EMBED_TITLE);
        setFeedbackEmbedDescription(typeof cfg.queue_embed_description === 'string' && cfg.queue_embed_description.trim().length > 0
          ? cfg.queue_embed_description
          : DEFAULT_FEEDBACK_DESCRIPTION);
        setFeedbackEmbedColor(rawColor.startsWith('#') ? rawColor : `#${rawColor}`);
        setFeedbackEmbedFooter(
          cfg.queue_embed_footer === null
            ? ''
            : (typeof cfg.queue_embed_footer === 'string' && cfg.queue_embed_footer.trim().length > 0
              ? cfg.queue_embed_footer
              : DEFAULT_FEEDBACK_FOOTER)
        );
        setFeedbackEmbedThumbnail(typeof cfg.queue_embed_thumbnail === 'string' ? cfg.queue_embed_thumbnail : '');
        setFeedbackEmbedImage(typeof cfg.queue_embed_image === 'string' ? cfg.queue_embed_image : '');
        const buttonLabelRaw = typeof cfg.queue_button_label === 'string' && cfg.queue_button_label.trim().length > 0
          ? cfg.queue_button_label
          : DEFAULT_FEEDBACK_BUTTON_LABEL;
        setFeedbackButtonLabel(buttonLabelRaw);
        const style = typeof cfg.queue_button_style === 'string' ? cfg.queue_button_style.toLowerCase() : 'primary';
        setFeedbackButtonStyle(['primary', 'secondary', 'success', 'danger'].includes(style) ? style as 'primary' | 'secondary' | 'success' | 'danger' : 'primary');
        setFeedbackButtonEmoji(typeof cfg.queue_button_emoji === 'string' ? cfg.queue_button_emoji : '');
        setFeedbackNotificationChannel(cfg.notification_channel_id || 'none');
        setFeedbackNotificationRole(cfg.notification_ping_role || 'none');
        setFeedbackNotificationMessage(
          typeof cfg.notification_message === 'string' && cfg.notification_message.trim().length > 0
            ? cfg.notification_message
            : DEFAULT_NOTIFICATION_MESSAGE
        );
      }
    } catch (error) {
      if (isDev) console.error('Error fetching feedback:', error);
      throw error;
    }
  };

  const fetchEconomyData = async () => {
    const isDev = process.env.NODE_ENV === 'development';
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/economy`).catch(e => {
        if (isDev) console.error('❌ Economy failed:', e);
        return { ok: false, json: async () => ({ config: null, stats: null }) };
      });
      const data = await res.json().catch(() => ({ config: null, stats: null }));
      setEconomyConfig(data.config || null);
      setEconomyStats(data.stats || null);
    } catch (error) {
      if (isDev) console.error('Error fetching economy:', error);
      throw error;
    }
  };

  const fetchCasinoData = async () => {
    const isDev = process.env.NODE_ENV === 'development';
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/casino`).catch(e => {
        if (isDev) console.error('❌ Casino failed:', e);
        return { ok: false, json: async () => ({ config: null, stats: null }) };
      });
      const data = await res.json().catch(() => ({ config: null, stats: null }));
      setCasinoConfig(data.config || null);
      setCasinoStats(data.stats || null);
    } catch (error) {
      if (isDev) console.error('Error fetching casino:', error);
      throw error;
    }
  };

  const fetchLevelingData = async () => {
    const isDev = process.env.NODE_ENV === 'development';
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/leveling`).catch(e => {
        if (isDev) console.error('❌ Leveling failed:', e);
        return { ok: false, json: async () => ({ config: {} }) };
      });
      const data = await res.json().catch(() => ({ config: {} }));
      setLevelingConfig(data.config || {});
      
      // Load customization settings
      if (data.config) {
        setXpBarImage(data.config.xp_bar_image_url || '');
        setXpBarColor(data.config.xp_bar_color || '#5865F2');
        setXpBarStyle(data.config.xp_bar_style || 'gradient');
        setRankCardBackground(data.config.rank_card_background_url || '');
        setRankCardBorderColor(data.config.rank_card_border_color || '#5865F2');
        setLevelupAnimation(data.config.levelup_animation || 'confetti');
        setXpBarPosition(data.config.xp_bar_position || 'bottom');
      }
    } catch (error) {
      if (isDev) console.error('Error fetching leveling:', error);
      throw error;
    }
  };

  // Lazy load data for specific tab
  const loadTabData = useCallback(async (tab: string) => {
    const isDev = process.env.NODE_ENV === 'development';
    setTabLoading(prev => ({ ...prev, [tab]: true }));
    
    try {
      switch(tab) {
        case 'commands':
          await fetchCommandsData();
          break;
        case 'streaming':
          await fetchStreamsData();
          break;
        case 'birthdays':
          await fetchBirthdaysData();
          break;
        case 'feedback':
          await fetchFeedbackData();
          break;
        case 'economy':
          await fetchEconomyData();
          break;
        case 'casino':
          await fetchCasinoData();
          break;
        case 'leveling':
          await fetchLevelingData();
          break;
      }
      
      setLoadedTabs(prev => ({ ...prev, [tab]: true }));
    } catch (error) {
      if (isDev) console.error(`Error loading ${tab} data:`, error);
      toast({
        title: 'Error',
        description: `Failed to load ${tab} data`,
        variant: 'destructive'
      });
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }));
    }
  }, [guildId, toast]);

  // Lazy load tab data when tab becomes active
  useEffect(() => {
    if (!activeTab || !config) return;
    if (loadedTabs[activeTab]) return;
    
    loadTabData(activeTab);
  }, [activeTab, loadedTabs, config, loadTabData]);

  const saveUpdateNotificationSettings = async (updates: {
    enabled?: boolean;
    channelId?: string | null;
    types?: string[];
    roleIds?: string[];
  }) => {
    setUpdateNotificationsSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/update-notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: updates.enabled !== undefined ? updates.enabled : updateNotificationsEnabled,
          channelId: updates.channelId !== undefined ? updates.channelId : (updateNotificationChannelId === 'none' ? null : updateNotificationChannelId),
          types: updates.types !== undefined ? updates.types : updateNotificationTypes,
          roleIds: updates.roleIds !== undefined ? updates.roleIds : updateNotificationRoleIds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update setting');
      }

      const result = await response.json();
      
      if (updates.enabled !== undefined) {
        setUpdateNotificationsEnabled(updates.enabled);
      }
      if (updates.channelId !== undefined) {
        setUpdateNotificationChannelId(updates.channelId || 'none');
      }
      if (updates.types !== undefined) {
        setUpdateNotificationTypes(updates.types);
      }
      if (updates.roleIds !== undefined) {
        setUpdateNotificationRoleIds(updates.roleIds);
      }

      toast({
        title: 'Settings Updated',
        description: 'Update notification settings have been saved'
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to update notification settings',
        variant: 'destructive'
      });
    } finally {
      setUpdateNotificationsSaving(false);
    }
  };


  const saveBirthdaySettings = async () => {
    setBirthdaySettingsSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/birthdays/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthdays_enabled: !!birthdaySettings.birthdays_enabled,
          birthday_channel_id: birthdaySettings.birthday_channel_id || null,
          birthday_role_id: birthdaySettings.birthday_role_id || null,
          birthday_message_template: birthdaySettings.birthday_message_template,
          birthday_ping_role: !!birthdaySettings.birthday_ping_role,
          birthday_announcement_time: birthdaySettings.birthday_announcement_time
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save birthday settings');
      }

      toast({
        title: 'Birthday settings saved',
        description: 'Changes have been applied successfully.'
      });

      // Refresh essential data and reload current tab if needed
      await fetchEssentialData();
      if (activeTab !== 'overview' && loadedTabs[activeTab]) {
        await loadTabData(activeTab);
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Saving failed',
        description: 'Could not update the birthday settings.',
        variant: 'destructive'
      });
    } finally {
      setBirthdaySettingsSaving(false);
    }
  };

  const createDefaultExtraField = () => ({
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `field_${Date.now()}`,
    label: 'Extra field',
    placeholder: '',
    required: false,
    style: 'short'
  });

  const handleAddFeedbackField = () => {
    setFeedbackExtraFields((prev) => {
      if (prev.length >= 3) return prev;
      return [...prev, createDefaultExtraField()];
    });
  };

  const handleUpdateFeedbackField = (id: string, key: 'label' | 'placeholder' | 'style' | 'required', value: any) => {
    setFeedbackExtraFields((prev) =>
      prev.map((field: any) =>
        field.id === id
          ? {
              ...field,
              [key]: key === 'label' || key === 'placeholder' ? (value as string).slice(0, key === 'label' ? 45 : 100) : value
            }
          : field
      )
    );
  };

  const handleRemoveFeedbackField = (id: string) => {
    setFeedbackExtraFields((prev) => prev.filter((field: any) => field.id !== id));
  };

  const handleSaveFeedbackModal = async () => {
    setFeedbackModalSaving(true);
    try {
      const payload = {
        modalTitle: feedbackModalTitle,
        modalLinkLabel: feedbackModalLinkLabel,
        modalNotesLabel: feedbackModalNotesEnabled ? feedbackModalNotesLabel : null,
        modalNotesRequired: feedbackModalNotesEnabled ? feedbackModalNotesRequired : false,
        extraFields: feedbackExtraFields
      };

      const response = await fetch(`/api/comcraft/guilds/${guildId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({ error: 'Failed to save feedback modal configuration.' }));

      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Failed to save feedback modal configuration.');
      }

      toast({
        title: 'Feedback modal saved',
        description: 'Users will see the new fields the next time they open the queue modal.'
      });
      // Refresh feedback tab data
      if (loadedTabs.feedback) {
        await loadTabData('feedback');
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Saving failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setFeedbackModalSaving(false);
    }
  };

  const handleSaveQueueMessage = async () => {
    setFeedbackQueueSaving(true);
    try {
      const payload = {
        embedTitle: feedbackEmbedTitle,
        embedDescription: feedbackEmbedDescription,
        embedColor: feedbackEmbedColor,
        embedFooter: feedbackEmbedFooter.trim() === '' ? null : feedbackEmbedFooter,
        embedThumbnail: feedbackEmbedThumbnail.trim() === '' ? null : feedbackEmbedThumbnail,
        embedImage: feedbackEmbedImage.trim() === '' ? null : feedbackEmbedImage,
        buttonLabel: feedbackButtonLabel,
        buttonEmoji: feedbackButtonEmoji.trim() === '' ? null : feedbackButtonEmoji.trim(),
        buttonStyle: feedbackButtonStyle,
        notificationChannelId: feedbackNotificationChannel === 'none' ? null : feedbackNotificationChannel,
        notificationPingRole: feedbackNotificationRole === 'none' ? null : feedbackNotificationRole,
        notificationMessage: feedbackNotificationMessage.trim() === ''
          ? DEFAULT_NOTIFICATION_MESSAGE
          : feedbackNotificationMessage
      };

      const response = await fetch(`/api/comcraft/guilds/${guildId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({ error: 'Failed to save queue message config.' }));

      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Failed to save queue message config.');
      }

      toast({
        title: 'Queue message saved',
        description: 'Repost the queue to apply the updated embed and button.'
      });
      // Refresh feedback tab data
      if (loadedTabs.feedback) {
        await loadTabData('feedback');
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Saving failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setFeedbackQueueSaving(false);
    }
  };

  const handleFeedbackSetup = async () => {
    if (!feedbackSetupChannel || feedbackSetupChannel === 'none') {
      toast({
        title: 'Select a channel',
        description: 'Choose the channel that should host the queue message.',
        variant: 'destructive'
      });
      return;
    }

    setFeedbackActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: feedbackSetupChannel,
          roleId: feedbackSetupRole === 'none' ? null : feedbackSetupRole
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Unable to update the feedback queue');
      }

      toast({
        title: 'Feedback queue posted',
        description: 'The pinned queue message has been updated in the selected channel.'
      });
      // Refresh feedback tab data
      if (loadedTabs.feedback) {
        await loadTabData('feedback');
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Queue update failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setFeedbackActionLoading(false);
    }
  };

  const handleFeedbackComplete = async (submissionId: string) => {
    const noteInput = typeof window !== 'undefined'
      ? window.prompt('Optional moderator note (press enter to skip).')
      : '';

    if (noteInput === null) {
      return;
    }

    setFeedbackActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/feedback/submissions/${submissionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: noteInput && noteInput.trim() !== '' ? noteInput.trim() : null
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Unable to complete submission');
      }

      toast({
        title: 'Submission completed',
        description: 'The submission has been marked as handled.'
      });
      // Refresh feedback tab data
      if (loadedTabs.feedback) {
        await loadTabData('feedback');
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Completion failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setFeedbackActionLoading(false);
    }
  };

  const resetBirthdayForm = () => {
    setBirthdayForm({
      id: '',
      user_id: '',
      username: '',
      display_name: '',
      birthday: '',
      timezone: '',
      is_private: 'false'
    });
  };

  const handleBirthdaySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!birthdayForm.user_id || !birthdayForm.birthday) {
      toast({
        title: 'Incomplete details',
        description: 'Please provide at least the user ID and birthday.',
        variant: 'destructive'
      });
      return;
    }

    setBirthdaySaving(true);

    const payload = {
      user_id: birthdayForm.user_id.trim(),
      username: birthdayForm.username.trim() || null,
      display_name: birthdayForm.display_name.trim() || null,
      birthday: birthdayForm.birthday.trim(),
      timezone: birthdayForm.timezone.trim() || null,
      is_private: birthdayForm.is_private === 'true'
    };

    try {
      const url = `/api/comcraft/guilds/${guildId}/birthdays`;
      const response = await fetch(url, {
        method: birthdayForm.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          birthdayForm.id
            ? { id: birthdayForm.id, ...payload }
            : payload
        )
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save birthday');
      }

      toast({
        title: birthdayForm.id ? 'Birthday updated' : 'Birthday added',
        description: 'Your changes have been saved.'
      });

      resetBirthdayForm();
      // Refresh birthdays tab data
      if (loadedTabs.birthdays) {
        await loadTabData('birthdays');
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not save the birthday.',
        variant: 'destructive'
      });
    } finally {
      setBirthdaySaving(false);
    }
  };

  const handleEditBirthday = (entry: any) => {
    setBirthdayForm({
      id: entry.id,
      user_id: entry.user_id,
      username: entry.username || '',
      display_name: entry.display_name || '',
      birthday: entry.birthday || '',
      timezone: entry.timezone || '',
      is_private: entry.is_private ? 'true' : 'false'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBirthday = async (id: string) => {
    if (!confirm('Are you sure you want to delete this birthday?')) {
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/birthdays?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete birthday');
      }

      toast({
        title: 'Birthday deleted',
        description: 'The entry has been removed.'
      });

      if (birthdayForm.id === id) {
        resetBirthdayForm();
      }

      // Refresh birthdays tab data
      if (loadedTabs.birthdays) {
        await loadTabData('birthdays');
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'Delete failed',
        description: 'Could not delete the birthday.',
        variant: 'destructive'
      });
    }
  };

  const renderMetadata = (metadata: any) => {
    if (!metadata || typeof metadata !== 'object') return null;

    const definitions = Array.isArray(feedbackConfig?.extra_fields) ? feedbackConfig.extra_fields : [];
    const normalized = definitions
      .map((field: any) => {
        const entry = metadata[field.id];
        if (entry === undefined || entry === null || entry === '') return null;

        if (typeof entry === 'object' && entry !== null && 'value' in entry) {
          const label = entry.label || field.label || 'Detail';
          const value = entry.value ?? '-';
          return (
            <div key={field.id} className="text-xs text-gray-500 dark:text-gray-400">
              <strong>{label}:</strong> {String(value)}
            </div>
          );
        }

        return (
          <div key={field.id} className="text-xs text-gray-500 dark:text-gray-400">
            <strong>{field.label || 'Detail'}:</strong> {String(entry)}
          </div>
        );
      })
      .filter(Boolean);

    if (normalized.length > 0) {
      return <div className="space-y-1">{normalized}</div>;
    }

    return Object.entries(metadata).map(([key, raw]: any) => {
      const label = typeof raw === 'object' && raw !== null && 'label' in raw ? raw.label : key;
      const value = typeof raw === 'object' && raw !== null && 'value' in raw ? raw.value : raw;
      return (
        <div key={key} className="text-xs text-gray-500 dark:text-gray-400">
          <strong>{label}:</strong> {String(value)}
        </div>
      );
    });
  };

  const selectedFeedbackRole = roles.find((role: any) => role.id === feedbackSetupRole);
  const previewRoleMention = selectedFeedbackRole ? `@${selectedFeedbackRole.name}` : '@role';
  const selectedNotificationChannel = channels.find((channel: any) => channel.id === feedbackNotificationChannel);
  const selectedNotificationRole = roles.find((role: any) => role.id === feedbackNotificationRole);
  const previewNotificationRoleMention = selectedNotificationRole ? `@${selectedNotificationRole.name}` : '@role';

  const previewFeedbackDescription = (() => {
    let text = feedbackEmbedDescription || '';
    if (!text.trim()) {
      text = DEFAULT_FEEDBACK_DESCRIPTION;
    }

    if (feedbackSetupRole && feedbackSetupRole !== 'none') {
      if (/\{\{\s*role\s*\}\}/gi.test(text)) {
        text = text.replace(/\{\{\s*role\s*\}\}/gi, previewRoleMention);
      } else {
        text = `${text}\n\n🔒 Only available to ${previewRoleMention} members.`;
      }
    } else {
      text = text.replace(/\{\{\s*role\s*\}\}/gi, '');
    }

    return text;
  })();

  const previewNotificationMessage = (() => {
    let message = feedbackNotificationMessage && feedbackNotificationMessage.trim().length > 0
      ? feedbackNotificationMessage
      : DEFAULT_NOTIFICATION_MESSAGE;

    message = message
      .replace(/\{\{\s*user\s*\}\}/gi, 'Jasonn')
      .replace(/\{\{\s*link\s*\}\}/gi, 'https://soundcloud.com/example')
      .replace(/\{\{\s*channel\s*\}\}/gi, selectedNotificationChannel ? `#${selectedNotificationChannel.name}` : '#feedback-queue')
      .replace(/\{\{\s*role\s*\}\}/gi, selectedNotificationRole ? previewNotificationRoleMention : '');

    if (selectedNotificationRole && !message.includes(previewNotificationRoleMention)) {
      message = `${previewNotificationRoleMention} ${message}`.trim();
    }

    return message;
  })();

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Bot className="h-8 w-8 text-accent animate-pulse" />
            </div>
            <div className="absolute inset-0 animate-spin">
              <div className="h-16 w-16 rounded-2xl border-2 border-transparent border-t-accent mx-auto"></div>
            </div>
          </div>
          <p className="text-muted-foreground font-medium">Loading server configuration...</p>
        </div>
      </div>
    );
  }

  if (!config || !config.guild) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <Card className="border-2 border-border rounded-xl p-12 text-center max-w-lg">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
            <Bot className="h-10 w-10 text-accent opacity-50" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-primary">Server not found</h2>
          <p className="text-muted-foreground text-lg mb-8">Unable to load guild configuration</p>
          <Button asChild className="h-11 rounded-lg">
            <Link href="/comcraft/dashboard">
              <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
              Back to Dashboard
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="container mx-auto max-w-full px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <Card className="border border-gray-800 rounded-xl overflow-hidden shadow-sm bg-[#1a1f2e]">
            <div className="bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 p-8">
              <div className="flex items-center gap-6">
                {config.guild?.guild_icon_url ? (
                  <div className="relative">
                    <img 
                      src={config.guild.guild_icon_url} 
                      alt={config.guild.guild_name}
                      className="w-20 h-20 rounded-2xl ring-2 ring-border"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center text-accent text-3xl font-bold ring-2 ring-border">
                    {config.guild?.guild_name?.charAt(0) || 'G'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight truncate">
                      {config.guild?.guild_name || 'Unknown Server'}
                    </h1>
                    {discordInviteLink && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="border-2 border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2] hover:text-white rounded-lg transition-all flex-shrink-0"
                      >
                        <a
                          href={discordInviteLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Join Server
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-accent text-white border-0 px-3 py-1 text-xs font-medium rounded-md">
                      {(config.guild?.subscription_tier || 'free').toUpperCase()} TIER
                    </Badge>
                    {config.guild?.is_trial && config.guild?.trial_ends_at && (
                      <Badge className="bg-green-600 text-white border-0 px-3 py-1 text-xs font-medium rounded-md">
                        {Math.max(0, Math.ceil((new Date(config.guild.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days trial left
                      </Badge>
                    )}
                    <Badge variant="outline" className="border-2 border-border px-3 py-1 text-xs font-medium rounded-md">
                      ID: {config.guild?.guild_id || guildId}
                    </Badge>
                    <Badge variant="outline" className="border-2 border-border px-3 py-1 text-xs font-medium rounded-md">
                      Language: {config.guild?.language?.toUpperCase() || 'EN'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Content Tabs - Navigation via sidebar */}
        <Card className="border border-gray-800 rounded-xl mb-8 shadow-sm bg-[#1a1f2e]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6 p-6">
            {/* Modern Stats Cards with Gradients */}
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="border border-gray-800 shadow-lg overflow-hidden group hover:shadow-xl transition-all bg-[#1a1f2e]">
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-purple-500/10 rounded-xl group-hover:scale-110 transition-transform">
                      <span className="text-2xl">🎖️</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-400 mb-1">
                    Subscription Tier
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {((config.guild?.subscription_tier || 'free').charAt(0).toUpperCase() + (config.guild?.subscription_tier || 'free').slice(1))}
                  </div>
                  {config.guild?.is_trial && config.guild?.trial_ends_at && (
                    <div className="mt-2 text-sm text-green-600 font-medium">
                      🎁 Trial active ({Math.max(0, Math.ceil((new Date(config.guild.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left)
                    </div>
                  )}
                </div>
              </Card>

              <Card className="border border-gray-800 shadow-lg overflow-hidden group hover:shadow-xl transition-all bg-[#1a1f2e]">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform">
                      <span className="text-2xl">🤖</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Bot Prefix
                  </div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                    {config.guild.prefix || '!'}
                  </div>
                </div>
              </Card>

              <Card className="border border-gray-800 shadow-lg overflow-hidden group hover:shadow-xl transition-all bg-[#1a1f2e]">
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform">
                      <span className="text-2xl">⚡</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    XP Boost
                  </div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                    {config.guild.xp_boost || 1.0}x
                  </div>
                </div>
              </Card>

              <Card className="border border-gray-800 shadow-lg overflow-hidden group hover:shadow-xl transition-all bg-[#1a1f2e]">
                <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 bg-orange-500/10 rounded-xl group-hover:scale-110 transition-transform">
                      <span className="text-2xl">🌐</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Language
                  </div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent uppercase">
                    {config.guild.language || 'NL'}
                  </div>
                </div>
              </Card>
            </div>


            {/* Update Notifications */}
            <Card className="p-6 border-2 shadow-lg">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                      <span className="text-2xl">📢</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Update Notifications</h2>
                      <p className="text-sm text-muted-foreground">
                        Receive automatic notifications when new bot updates are released
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={updateNotificationsEnabled}
                    onCheckedChange={async (checked) => {
                      await saveUpdateNotificationSettings({ enabled: checked });
                    }}
                    disabled={updateNotificationsSaving}
                  />
                  {updateNotificationsSaving && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>

              {updateNotificationsEnabled && (
                <div className="space-y-6 pt-4 border-t">
                  {/* Custom Channel */}
                  <div>
                    <Label className="mb-2 font-semibold">Notification Channel</Label>
                    <Select
                      value={updateNotificationChannelId}
                      onValueChange={async (value) => {
                        setUpdateNotificationChannelId(value);
                        await saveUpdateNotificationSettings({ channelId: value === 'none' ? null : value });
                      }}
                      disabled={updateNotificationsSaving}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">DM or System Channel (Default)</SelectItem>
                        {channels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Choose a specific channel for notifications, or use default (DM/system channel)
                    </p>
                  </div>

                  {/* Update Types */}
                  <div>
                    <Label className="mb-2 font-semibold">Update Types to Receive</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {['feature', 'improvement', 'bugfix', 'security', 'breaking'].map((type) => (
                        <div key={type} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <input
                            type="checkbox"
                            id={`update-type-${type}`}
                            checked={updateNotificationTypes.includes(type)}
                            onChange={async (e) => {
                              const newTypes = e.target.checked
                                ? [...updateNotificationTypes, type]
                                : updateNotificationTypes.filter(t => t !== type);
                              setUpdateNotificationTypes(newTypes);
                              await saveUpdateNotificationSettings({ types: newTypes });
                            }}
                            disabled={updateNotificationsSaving}
                            className="rounded border-gray-300 w-4 h-4 cursor-pointer"
                          />
                          <Label htmlFor={`update-type-${type}`} className="text-sm font-normal capitalize cursor-pointer flex-1">
                            {type === 'bugfix' ? 'Bug Fix' : type}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select which types of updates you want to receive notifications for
                    </p>
                  </div>

                  {/* Role Mentions */}
                  <div>
                    <Label className="mb-2 font-semibold">Roles to Mention</Label>
                    <Select
                      value=""
                      onValueChange={(roleId) => {
                        if (!updateNotificationRoleIds.includes(roleId)) {
                          const newRoleIds = [...updateNotificationRoleIds, roleId];
                          setUpdateNotificationRoleIds(newRoleIds);
                          saveUpdateNotificationSettings({ roleIds: newRoleIds });
                        }
                      }}
                      disabled={updateNotificationsSaving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add a role to mention..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roles
                          .filter(role => !updateNotificationRoleIds.includes(role.id))
                          .map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              @{role.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {updateNotificationRoleIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {updateNotificationRoleIds.map((roleId) => {
                          const role = roles.find(r => r.id === roleId);
                          return role ? (
                            <Badge key={roleId} variant="secondary" className="flex items-center gap-1">
                              @{role.name}
                              <button
                                onClick={async () => {
                                  const newRoleIds = updateNotificationRoleIds.filter(id => id !== roleId);
                                  setUpdateNotificationRoleIds(newRoleIds);
                                  await saveUpdateNotificationSettings({ roleIds: newRoleIds });
                                }}
                                className="ml-1 hover:text-destructive"
                                disabled={updateNotificationsSaving}
                              >
                                ×
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Select roles to mention in notifications (leave empty to only mention server owner)
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* Module Status */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Module Status</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${config.guild.leveling_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <div>
                    <div className="font-semibold">Leveling Systeem</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {config.guild.leveling_enabled ? 'Actief' : 'Inactief'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${config.guild.moderation_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <div>
                    <div className="font-semibold">Moderatie</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {config.guild.moderation_enabled ? 'Actief' : 'Inactief'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${streams.length > 0 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <div>
                    <div className="font-semibold">Streaming</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {streams.length > 0 ? `Actief (${streams.length} stream${streams.length > 1 ? 's' : ''})` : 'Inactief'}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Modern Quick Links with Gradient Cards */}
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-6 border-b">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <span className="p-2 bg-primary/10 rounded-lg">🚀</span>
                  Quick Access
                </h2>
                <p className="text-muted-foreground mt-2">Navigate to different sections of your dashboard</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* External Pages with Gradient Cards */}
                  <Link href={`/comcraft/dashboard/${guildId}/server`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-purple-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎨</div>
                        <h3 className="font-semibold text-base mb-1">Server Settings</h3>
                        <p className="text-xs text-muted-foreground">Manage server</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/bot-personalizer`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-yellow-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🤖</div>
                        <h3 className="font-semibold text-base mb-1">Bot Personalizer</h3>
                        <p className="text-xs text-muted-foreground">Customize bot</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/autoroles`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-pink-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎭</div>
                        <h3 className="font-semibold text-base mb-1">Auto-Roles</h3>
                        <p className="text-xs text-muted-foreground">Automatic roles</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/embeds`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-green-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-green-500/10 to-teal-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📝</div>
                        <h3 className="font-semibold text-base mb-1">Embed Builder</h3>
                        <p className="text-xs text-muted-foreground">Create embeds</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/giveaways`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-blue-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎁</div>
                        <h3 className="font-semibold text-base mb-1">Giveaways</h3>
                        <p className="text-xs text-muted-foreground">Run giveaways</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/ai`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-indigo-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🧠</div>
                        <h3 className="font-semibold text-base mb-1">AI Assistant</h3>
                        <p className="text-xs text-muted-foreground">AI features</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/game-news`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-red-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎮</div>
                        <h3 className="font-semibold text-base mb-1">Game News</h3>
                        <p className="text-xs text-muted-foreground">Game updates</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/combat-items`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-orange-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">⚔️</div>
                        <h3 className="font-semibold text-base mb-1">Combat Items</h3>
                        <p className="text-xs text-muted-foreground">Item shop builder</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/auto-reactions`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-yellow-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">😊</div>
                        <h3 className="font-semibold text-base mb-1">Auto-Reactions</h3>
                        <p className="text-xs text-muted-foreground">Emoji reactions</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/stats`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-blue-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📊</div>
                        <h3 className="font-semibold text-base mb-1">Statistics</h3>
                        <p className="text-xs text-muted-foreground">User stats cards</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/moderation`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-red-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🛡️</div>
                        <h3 className="font-semibold text-base mb-1">Moderation</h3>
                        <p className="text-xs text-muted-foreground">Manage moderation</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/suggestions`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-amber-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">💡</div>
                        <h3 className="font-semibold text-base mb-1">Suggestions</h3>
                        <p className="text-xs text-muted-foreground">Share ideas</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/events`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-blue-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📅</div>
                        <h3 className="font-semibold text-base mb-1">Events</h3>
                        <p className="text-xs text-muted-foreground">Manage events</p>
                      </div>
                    </Card>
                  </Link>

                  <Link href={`/comcraft/dashboard/${guildId}/welcome`}>
                    <Card className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-cyan-500/50 h-full hover:scale-105 duration-200">
                      <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-5">
                        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">👋</div>
                        <h3 className="font-semibold text-base mb-1">Welcome System</h3>
                        <p className="text-xs text-muted-foreground">Welcome messages</p>
                      </div>
                    </Card>
                  </Link>

                  {/* Tab Switchers */}
                  <Card 
                    className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-primary/50 h-full hover:scale-105 duration-200"
                    onClick={() => setActiveTab('leveling')}
                  >
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-5">
                      <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">⭐</div>
                      <h3 className="font-semibold text-base mb-1">Leveling</h3>
                      <p className="text-xs text-muted-foreground">XP system</p>
                    </div>
                  </Card>

                  <Card 
                    className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-primary/50 h-full hover:scale-105 duration-200"
                    onClick={() => setActiveTab('commands')}
                  >
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-5">
                      <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">💬</div>
                      <h3 className="font-semibold text-base mb-1">Commands</h3>
                      <p className="text-xs text-muted-foreground">Bot commands</p>
                    </div>
                  </Card>

                  <Card 
                    className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-primary/50 h-full hover:scale-105 duration-200"
                    onClick={() => setActiveTab('streaming')}
                  >
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-5">
                      <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎮</div>
                      <h3 className="font-semibold text-base mb-1">Streaming</h3>
                      <p className="text-xs text-muted-foreground">Notifications</p>
                    </div>
                  </Card>

                  <Card 
                    className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-primary/50 h-full hover:scale-105 duration-200"
                    onClick={() => setActiveTab('analytics')}
                  >
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-5">
                      <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📊</div>
                      <h3 className="font-semibold text-base mb-1">Analytics</h3>
                      <p className="text-xs text-muted-foreground">Statistics</p>
                    </div>
                  </Card>

                  <Card 
                    className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-primary/50 h-full hover:scale-105 duration-200"
                    onClick={() => setActiveTab('birthdays')}
                  >
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-5">
                      <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎂</div>
                      <h3 className="font-semibold text-base mb-1">Birthdays</h3>
                      <p className="text-xs text-muted-foreground">Birthday system</p>
                    </div>
                  </Card>

                  <Card 
                    className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-primary/50 h-full hover:scale-105 duration-200"
                    onClick={() => setActiveTab('feedback')}
                  >
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-5">
                      <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎧</div>
                      <h3 className="font-semibold text-base mb-1">Feedback</h3>
                      <p className="text-xs text-muted-foreground">Queue system</p>
                    </div>
                  </Card>

                  <Card 
                    className="group hover:shadow-xl transition-all cursor-pointer border-2 hover:border-primary/50 h-full hover:scale-105 duration-200"
                    onClick={() => setActiveTab('tickets')}
                  >
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-5">
                      <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🎫</div>
                      <h3 className="font-semibold text-base mb-1">Tickets</h3>
                      <p className="text-xs text-muted-foreground">Support system</p>
                    </div>
                  </Card>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* LEVELING TAB */}
          <TabsContent value="leveling" className="space-y-6 p-6">
            {tabLoading.leveling ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <Card className="border-2 shadow-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 p-8">
                    <div className="flex flex-col items-center text-center gap-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-2xl" />
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white text-4xl font-bold border-4 border-background shadow-xl">
                          ⭐
                        </div>
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-3">
                          Leveling Customization
                        </h2>
                        <p className="text-muted-foreground max-w-2xl">
                          Customize XP bars, rank cards, and level-up animations to make your server unique!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 space-y-8">
                    {/* XP Bar Customization */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <span>📊</span> XP Bar Customization
                      </h3>
                      
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>XP Bar Style</Label>
                            <Select value={xpBarStyle} onValueChange={(value: any) => setXpBarStyle(value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gradient">Gradient (Default)</SelectItem>
                                <SelectItem value="solid">Solid Color</SelectItem>
                                <SelectItem value="image">Custom Image</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Choose how your XP bar is displayed
                            </p>
                          </div>

                          {xpBarStyle !== 'image' && (
                            <div className="space-y-2">
                              <Label>XP Bar Color</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  value={xpBarColor}
                                  onChange={(e) => setXpBarColor(e.target.value)}
                                  className="w-20 h-10 p-1 cursor-pointer"
                                />
                                <Input
                                  value={xpBarColor}
                                  onChange={(e) => setXpBarColor(e.target.value)}
                                  placeholder="#5865F2"
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          )}

                          {xpBarStyle === 'image' && (
                            <div className="space-y-2">
                              <Label>XP Bar Image URL</Label>
                              <Input
                                value={xpBarImage}
                                onChange={(e) => setXpBarImage(e.target.value)}
                                placeholder="https://example.com/xp-bar.png"
                              />
                              <p className="text-xs text-muted-foreground">
                                Upload your custom XP bar image (recommended: 800x40px, transparent background)
                              </p>
                              {xpBarImage && (
                                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                  <img 
                                    src={xpBarImage} 
                                    alt="XP Bar Preview" 
                                    className="max-w-full h-10 object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>XP Bar Position</Label>
                            <Select value={xpBarPosition} onValueChange={(value: any) => setXpBarPosition(value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="top">Top</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="bottom">Bottom (Default)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Preview */}
                        <div className="space-y-2">
                          <Label>Preview</Label>
                          <div className="p-4 bg-gray-900 rounded-lg border-2" style={{ borderColor: rankCardBorderColor }}>
                            <div className="text-white space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                                  U
                                </div>
                                <div>
                                  <div className="font-bold">Username</div>
                                  <div className="text-sm text-gray-400">Level 25 • 12,450 XP</div>
                                </div>
                              </div>
                              
                              {xpBarPosition === 'top' && (
                                <div className="mt-2">
                                  {xpBarStyle === 'image' && xpBarImage ? (
                                    <img src={xpBarImage} alt="XP Bar" className="w-full h-4 object-cover rounded" />
                                  ) : (
                                    <div 
                                      className="h-4 rounded-full"
                                      style={{
                                        background: xpBarStyle === 'gradient' 
                                          ? `linear-gradient(90deg, ${xpBarColor} 0%, ${xpBarColor}dd 50%, ${xpBarColor}aa 100%)`
                                          : xpBarColor,
                                        width: '65%'
                                      }}
                                    />
                                  )}
                                </div>
                              )}
                              
                              {xpBarPosition === 'center' && (
                                <div className="my-2">
                                  {xpBarStyle === 'image' && xpBarImage ? (
                                    <img src={xpBarImage} alt="XP Bar" className="w-full h-4 object-cover rounded" />
                                  ) : (
                                    <div 
                                      className="h-4 rounded-full"
                                      style={{
                                        background: xpBarStyle === 'gradient' 
                                          ? `linear-gradient(90deg, ${xpBarColor} 0%, ${xpBarColor}dd 50%, ${xpBarColor}aa 100%)`
                                          : xpBarColor,
                                        width: '65%'
                                      }}
                                    />
                                  )}
                                </div>
                              )}
                              
                              {xpBarPosition === 'bottom' && (
                                <div className="mt-2">
                                  {xpBarStyle === 'image' && xpBarImage ? (
                                    <img src={xpBarImage} alt="XP Bar" className="w-full h-4 object-cover rounded" />
                                  ) : (
                                    <div 
                                      className="h-4 rounded-full"
                                      style={{
                                        background: xpBarStyle === 'gradient' 
                                          ? `linear-gradient(90deg, ${xpBarColor} 0%, ${xpBarColor}dd 50%, ${xpBarColor}aa 100%)`
                                          : xpBarColor,
                                        width: '65%'
                                      }}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rank Card Customization */}
                    <div className="space-y-4 border-t pt-6">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <span>🎴</span> Rank Card Customization
                      </h3>
                      
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Rank Card Background Image URL</Label>
                            <Input
                              value={rankCardBackground}
                              onChange={(e) => setRankCardBackground(e.target.value)}
                              placeholder="https://example.com/rank-card-bg.png"
                            />
                            <p className="text-xs text-muted-foreground">
                              Custom background for rank cards (recommended: 1000x300px)
                            </p>
                            {rankCardBackground && (
                              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                <img 
                                  src={rankCardBackground} 
                                  alt="Background Preview" 
                                  className="max-w-full h-24 object-cover rounded"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Rank Card Border Color</Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={rankCardBorderColor}
                                onChange={(e) => setRankCardBorderColor(e.target.value)}
                                className="w-20 h-10 p-1 cursor-pointer"
                              />
                              <Input
                                value={rankCardBorderColor}
                                onChange={(e) => setRankCardBorderColor(e.target.value)}
                                placeholder="#5865F2"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Rank Card Preview</Label>
                          <div 
                            className="p-4 rounded-lg border-2 relative overflow-hidden"
                            style={{ 
                              borderColor: rankCardBorderColor,
                              background: rankCardBackground 
                                ? `url(${rankCardBackground}) center/cover`
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            }}
                          >
                            <div className="relative z-10 text-white">
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-white">
                                  U
                                </div>
                                <div>
                                  <div className="font-bold text-lg">Username</div>
                                  <div className="text-sm opacity-90">Level 25 • Rank #3</div>
                                </div>
                              </div>
                              <div className="mt-3">
                                <div className="text-xs mb-1">12,450 / 15,000 XP</div>
                                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full"
                                    style={{ 
                                      width: '83%',
                                      background: xpBarStyle === 'gradient' 
                                        ? `linear-gradient(90deg, ${xpBarColor} 0%, ${xpBarColor}dd 100%)`
                                        : xpBarColor
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            {rankCardBackground && (
                              <div className="absolute inset-0 bg-black/30" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Level-up Animations */}
                    <div className="space-y-4 border-t pt-6">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <span>🎆</span> Level-up Animations
                      </h3>
                      
                      <div className="space-y-2">
                        <Label>Animation Type</Label>
                        <Select value={levelupAnimation} onValueChange={(value: any) => setLevelupAnimation(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="confetti">🎊 Confetti (Default)</SelectItem>
                            <SelectItem value="fireworks">🎆 Fireworks</SelectItem>
                            <SelectItem value="sparkles">✨ Sparkles</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Choose the animation that plays when a member levels up
                        </p>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button 
                        onClick={async () => {
                          setLevelingSaving(true);
                          try {
                            const response = await fetch(`/api/comcraft/guilds/${guildId}/leveling`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                ...levelingConfig,
                                xp_bar_image_url: xpBarImage || null,
                                xp_bar_color: xpBarColor,
                                xp_bar_style: xpBarStyle,
                                rank_card_background_url: rankCardBackground || null,
                                rank_card_border_color: rankCardBorderColor,
                                levelup_animation: levelupAnimation,
                                xp_bar_position: xpBarPosition
                              })
                            });

                            if (response.ok) {
                              toast({
                                title: 'Leveling customization saved',
                                description: 'Your customizations have been applied successfully!',
                              });
                              await fetchLevelingData();
                            } else {
                              throw new Error('Failed to save');
                            }
                          } catch (error) {
                            toast({
                              title: 'Save failed',
                              description: 'Could not save leveling customization. Please try again.',
                              variant: 'destructive'
                            });
                          } finally {
                            setLevelingSaving(false);
                          }
                        }}
                        disabled={levelingSaving}
                        className="min-w-[150px]"
                      >
                        {levelingSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Customization
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Link to Advanced Settings */}
                    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div>💡</div>
                      <div className="flex-1">
                        <p className="text-sm">
                          For XP ranges, rewards, and channel settings, visit the{' '}
                          <Link href={`/comcraft/dashboard/${guildId}/leveling`} className="font-semibold text-blue-600 hover:underline">
                            Advanced Leveling Settings
                          </Link>
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          {/* MODERATION TAB */}
          <TabsContent value="moderation" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">🛡️ Moderation Settings</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div>💡</div>
                  <p className="text-sm">
                    Configure auto-moderation, filters and logging on the dedicated page.
                  </p>
                </div>

                <Button asChild>
                  <Link href={`/comcraft/dashboard/${guildId}/moderation`}>
                    ⚙️ Moderation Dashboard
                  </Link>
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* COMMANDS TAB */}
          <TabsContent value="commands" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">💬 Custom Commands</h2>
              
              {tabLoading.commands ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : commands.length > 0 ? (
                <div className="space-y-3">
                  {commands.map((cmd: any) => (
                    <div key={cmd.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <code className="text-lg font-mono">!{cmd.trigger}</code>
                          <p className="text-sm text-gray-600 mt-1">{cmd.response}</p>
                          <p className="text-xs text-gray-500 mt-1">Used: {cmd.uses}x</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No custom commands yet</p>
                </div>
              )}

              <Button asChild className="mt-4">
                <Link href={`/comcraft/dashboard/${guildId}/commands`}>
                  ➕ Manage Commands
                </Link>
              </Button>
            </Card>
          </TabsContent>

          {/* STREAMING TAB */}
          <TabsContent value="streaming" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">🎮 Stream Notifications</h2>
              
              {streams.length > 0 ? (
                <div className="space-y-3">
                  {streams.map((stream: any) => (
                    <div key={stream.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{stream.platform === 'twitch' ? '🎮' : '📺'}</span>
                            <strong>{stream.streamer_name}</strong>
                            {stream.is_live && <Badge className="bg-red-600">🔴 LIVE</Badge>}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {stream.total_notifications_sent || 0} notifications sent
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No stream notifications yet</p>
                </div>
              )}

              <Button asChild className="mt-4">
                <Link href={`/comcraft/dashboard/${guildId}/streaming`}>
                  ➕ Manage Stream Notifications
                </Link>
              </Button>
            </Card>
          </TabsContent>

          {/* BIRTHDAYS TAB */}
          <TabsContent value="birthdays" className="space-y-6 p-6">
            {tabLoading.birthdays ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
            {/* Configuration Card with Gradient */}
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-pink-500/10 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-pink-500/20 rounded-full blur-xl" />
                      <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                        🎂
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                        Birthday Manager
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Celebrate your community with automated birthday announcements
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={saveBirthdaySettings} 
                    disabled={birthdaySettingsSaving}
                    className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                  >
                    {birthdaySettingsSaving ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Quick Stats */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="border-2 bg-gradient-to-br from-pink-500/5 to-transparent p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Total Birthdays</div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                      {birthdays.length}
                    </div>
                  </Card>
                  <Card className="border-2 bg-gradient-to-br from-purple-500/5 to-transparent p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Status</div>
                    <div className="text-xl font-bold">
                      {birthdaySettings.birthdays_enabled ? (
                        <Badge className="bg-green-600 text-white">✓ Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                  </Card>
                  <Card className="border-2 bg-gradient-to-br from-blue-500/5 to-transparent p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Announcement Time</div>
                    <div className="text-2xl font-bold">
                      {birthdaySettings.birthday_announcement_time || '09:00'}
                    </div>
                  </Card>
                </div>

                {/* Settings Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">System Status</Label>
                      <Select
                        value={birthdaySettings.birthdays_enabled ? 'true' : 'false'}
                        onValueChange={(value) =>
                          setBirthdaySettings((prev: any) => ({
                            ...prev,
                            birthdays_enabled: value === 'true'
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">✓ Enabled</SelectItem>
                          <SelectItem value="false">✗ Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Enable or disable automatic birthday announcements
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Announcement Channel</Label>
                      <Select
                        value={birthdaySettings.birthday_channel_id || 'none'}
                        onValueChange={(value) =>
                          setBirthdaySettings((prev: any) => ({
                            ...prev,
                            birthday_channel_id: value === 'none' ? null : value
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No channel selected</SelectItem>
                          {channels.map((channel: any) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              #{channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Channel where birthday announcements will be posted
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Birthday Role</Label>
                      <Select
                        value={birthdaySettings.birthday_role_id || 'none'}
                        onValueChange={(value) =>
                          setBirthdaySettings((prev: any) => ({
                            ...prev,
                            birthday_role_id: value === 'none' ? null : value
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No role</SelectItem>
                          {roles.map((role: any) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Role assigned to members on their birthday (removed after 24h)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Role Mention</Label>
                      <Select
                        value={birthdaySettings.birthday_ping_role ? 'true' : 'false'}
                        onValueChange={(value) =>
                          setBirthdaySettings((prev: any) => ({
                            ...prev,
                            birthday_ping_role: value === 'true'
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">✓ Mention role in message</SelectItem>
                          <SelectItem value="false">✗ No mention</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Ping the birthday role in announcement messages
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Announcement Time (24h format)</Label>
                      <Input
                        value={birthdaySettings.birthday_announcement_time || ''}
                        onChange={(event) =>
                          setBirthdaySettings((prev: any) => ({
                            ...prev,
                            birthday_announcement_time: event.target.value
                          }))
                        }
                        placeholder="09:00"
                      />
                      <p className="text-xs text-muted-foreground">
                        Time when birthday announcements are sent (HH:MM)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Message Template */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Message Template</Label>
                  <Textarea
                    value={birthdaySettings.birthday_message_template || ''}
                    onChange={(event) =>
                      setBirthdaySettings((prev: any) => ({
                        ...prev,
                        birthday_message_template: event.target.value
                      }))
                    }
                    rows={4}
                    placeholder="Happy birthday {user}! 🎂 Have an amazing day!"
                  />
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Available placeholders:</span>
                    <code className="px-2 py-1 bg-muted rounded">{'{user}'}</code>
                    <code className="px-2 py-1 bg-muted rounded">{'{username}'}</code>
                    <code className="px-2 py-1 bg-muted rounded">{'{age}'}</code>
                    <code className="px-2 py-1 bg-muted rounded">{'{server}'}</code>
                  </div>
                </div>
              </div>
            </Card>

            {/* Birthday Management Card */}
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">👥</div>
                    <div>
                      <h2 className="text-xl font-bold">Birthday List</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage birthdays for your community members
                      </p>
                    </div>
                  </div>
                  {birthdayForm.id && (
                    <Badge variant="outline" className="border-2">
                      Editing: {birthdayForm.display_name || birthdayForm.username || birthdayForm.user_id}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Add/Edit Form */}
                <form onSubmit={handleBirthdaySubmit} className="space-y-4 p-4 border-2 border-dashed rounded-lg bg-muted/20">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>User ID (Discord) *</Label>
                      <Input
                        value={birthdayForm.user_id}
                        onChange={(event) =>
                          setBirthdayForm((prev) => ({ ...prev, user_id: event.target.value }))
                        }
                        placeholder="123456789012345678"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Display Name</Label>
                      <Input
                        value={birthdayForm.display_name}
                        onChange={(event) =>
                          setBirthdayForm((prev) => ({ ...prev, display_name: event.target.value }))
                        }
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input
                        value={birthdayForm.username}
                        onChange={(event) =>
                          setBirthdayForm((prev) => ({ ...prev, username: event.target.value }))
                        }
                        placeholder="johndoe"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Birthday (DD-MM or YYYY-MM-DD) *</Label>
                      <Input
                        value={birthdayForm.birthday}
                        onChange={(event) =>
                          setBirthdayForm((prev) => ({ ...prev, birthday: event.target.value }))
                        }
                        placeholder="21-04 or 1994-04-21"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Input
                        value={birthdayForm.timezone}
                        onChange={(event) =>
                          setBirthdayForm((prev) => ({ ...prev, timezone: event.target.value }))
                        }
                        placeholder="Europe/Amsterdam"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Visibility</Label>
                      <Select
                        value={birthdayForm.is_private}
                        onValueChange={(value) =>
                          setBirthdayForm((prev) => ({ ...prev, is_private: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">🌐 Public (announce)</SelectItem>
                          <SelectItem value="true">🔒 Private (no announce)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button 
                      type="submit" 
                      disabled={birthdaySaving}
                      className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                    >
                      {birthdaySaving
                        ? 'Saving...'
                        : birthdayForm.id
                          ? '✓ Update Birthday'
                          : '+ Add Birthday'}
                    </Button>
                    {birthdayForm.id && (
                      <Button type="button" variant="outline" onClick={resetBirthdayForm}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>

                {/* Birthday List */}
                <div className="space-y-3">
                  {birthdays.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                      <div className="text-4xl mb-3">🎂</div>
                      <p className="text-muted-foreground">No birthdays added yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Add your first birthday using the form above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {birthdays.map((entry: any) => {
                        const displayName = entry.display_name || entry.username || entry.user_id;
                        const formattedDate = formatBirthday(entry.birthday);
                        return (
                          <Card key={entry.id} className="p-4 border-2 hover:shadow-lg transition-all">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                                  {displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-lg">{displayName}</div>
                                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                    <span>📅 {formattedDate}</span>
                                    <span>•</span>
                                    <span>🌍 {entry.timezone || config.guild?.timezone || 'Default'}</span>
                                    {entry.is_private && (
                                      <>
                                        <span>•</span>
                                        <Badge variant="secondary" className="text-xs">🔒 Private</Badge>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditBirthday(entry)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteBirthday(entry.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>
              </>
            )}
          </TabsContent>

          {/* FEEDBACK TAB */}
          <TabsContent value="feedback" className="space-y-6 p-6">
            {tabLoading.feedback ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
            {/* Modal Settings Card */}
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl" />
                      <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                        🎧
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        Feedback Queue Manager
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Customize submission modal and manage feedback requests
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleSaveFeedbackModal} 
                    disabled={feedbackModalSaving}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    {feedbackModalSaving ? 'Saving…' : 'Save Modal Settings'}
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Quick Stats */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="border-2 bg-gradient-to-br from-purple-500/5 to-transparent p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Pending</div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      {feedbackPending.length}
                    </div>
                  </Card>
                  <Card className="border-2 bg-gradient-to-br from-blue-500/5 to-transparent p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-1">In Progress</div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {feedbackInProgress.length}
                    </div>
                  </Card>
                  <Card className="border-2 bg-gradient-to-br from-green-500/5 to-transparent p-4">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Completed</div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                      {feedbackCompleted.length}
                    </div>
                  </Card>
                </div>

                {/* Modal Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span>📝</span>
                    <span>Submission Modal Fields</span>
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Modal Title</Label>
                      <Input
                        value={feedbackModalTitle}
                        onChange={(event) => setFeedbackModalTitle(event.target.value.slice(0, 45))}
                        placeholder="Submit your sample for feedback"
                      />
                      <p className="text-xs text-muted-foreground">
                        Title shown at the top of the submission form
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Link Field Label</Label>
                      <Input
                        value={feedbackModalLinkLabel}
                        onChange={(event) => setFeedbackModalLinkLabel(event.target.value.slice(0, 45))}
                        placeholder="Sample link"
                      />
                      <p className="text-xs text-muted-foreground">
                        Label for the URL input field
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Notes Field</Label>
                      <Select
                        value={feedbackModalNotesEnabled ? 'enabled' : 'disabled'}
                        onValueChange={(value) => setFeedbackModalNotesEnabled(value === 'enabled')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enabled">✓ Enabled</SelectItem>
                          <SelectItem value="disabled">✗ Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Allow producers to add context or requests
                      </p>
                    </div>
                    {feedbackModalNotesEnabled && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-base font-semibold">Notes Label</Label>
                          <Input
                            value={feedbackModalNotesLabel}
                            onChange={(event) => setFeedbackModalNotesLabel(event.target.value.slice(0, 45))}
                            placeholder="Feedback request"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-base font-semibold">Notes Required</Label>
                          <Select
                            value={feedbackModalNotesRequired ? 'required' : 'optional'}
                            onValueChange={(value) => setFeedbackModalNotesRequired(value === 'required')}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="optional">Optional</SelectItem>
                              <SelectItem value="required">Required</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Additional Fields */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <span>➕</span>
                        <span>Additional Fields</span>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Add up to 3 extra inputs (e.g. genre, BPM, stems link)
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddFeedbackField}
                      disabled={feedbackExtraFields.length >= 3}
                      className="border-2"
                    >
                      ➕ Add Field
                    </Button>
                  </div>

                  {feedbackExtraFields.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <p className="text-muted-foreground">No extra fields configured</p>
                      <p className="text-sm text-muted-foreground mt-1">Click "Add Field" to create custom inputs</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {feedbackExtraFields.map((field, index) => (
                        <Card key={field.id} className="p-4 border-2">
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="secondary">Field {index + 1}</Badge>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveFeedbackField(field.id)}
                            >
                              Remove
                            </Button>
                          </div>

                          <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Label</Label>
                              <Input
                                value={field.label}
                                onChange={(event) =>
                                  handleUpdateFeedbackField(field.id, 'label', event.target.value)
                                }
                                placeholder="e.g. Genre"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Placeholder</Label>
                              <Input
                                value={field.placeholder || ''}
                                onChange={(event) =>
                                  handleUpdateFeedbackField(field.id, 'placeholder', event.target.value)
                                }
                                placeholder="e.g. Bass House"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Input Type</Label>
                              <Select
                                value={field.style === 'paragraph' ? 'paragraph' : 'short'}
                                onValueChange={(value) =>
                                  handleUpdateFeedbackField(field.id, 'style', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="short">Short text</SelectItem>
                                  <SelectItem value="paragraph">Paragraph</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Required</Label>
                              <Select
                                value={field.required ? 'required' : 'optional'}
                                onValueChange={(value) =>
                                  handleUpdateFeedbackField(field.id, 'required', value === 'required')
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="optional">Optional</SelectItem>
                                  <SelectItem value="required">Required</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Queue Embed Customization Card */}
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">🎨</div>
                    <div>
                      <h2 className="text-xl font-bold">Queue Embed Customization</h2>
                      <p className="text-sm text-muted-foreground">
                        Design the embed and button that appear in Discord
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleSaveQueueMessage} 
                    disabled={feedbackQueueSaving}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {feedbackQueueSaving ? 'Saving…' : 'Save Embed Design'}
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* Notifications Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span>🔔</span>
                    <span>Notification Settings</span>
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Notification Channel</Label>
                      <Select
                        value={feedbackNotificationChannel}
                        onValueChange={(value) => setFeedbackNotificationChannel(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Use queue channel</SelectItem>
                          {channels.map((channel: any) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              #{channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Where the bot posts "new submission" alerts
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Ping Role (Optional)</Label>
                      <Select
                        value={feedbackNotificationRole}
                        onValueChange={(value) => setFeedbackNotificationRole(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No automatic ping</SelectItem>
                          {roles.map((role: any) => (
                            <SelectItem key={role.id} value={role.id}>
                              @{role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Role to mention in notification messages
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Notification Message</Label>
                    <Textarea
                      value={feedbackNotificationMessage}
                      onChange={(event) => setFeedbackNotificationMessage(event.target.value.slice(0, 500))}
                      rows={3}
                      placeholder={DEFAULT_NOTIFICATION_MESSAGE}
                    />
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Placeholders:</span>
                      <code className="px-2 py-1 bg-muted rounded">{'{{user}}'}</code>
                      <code className="px-2 py-1 bg-muted rounded">{'{{link}}'}</code>
                      <code className="px-2 py-1 bg-muted rounded">{'{{channel}}'}</code>
                      <code className="px-2 py-1 bg-muted rounded">{'{{role}}'}</code>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Message Preview</Label>
                    <div className="rounded-lg border-2 border-dashed bg-muted/30 p-4 text-sm space-y-2">
                      <div className="text-xs text-muted-foreground">
                        Will post in{' '}
                        {feedbackNotificationChannel === 'none'
                          ? 'the main queue channel'
                          : selectedNotificationChannel
                            ? `#${selectedNotificationChannel.name}`
                            : '#unknown-channel'}
                      </div>
                      <div className="whitespace-pre-line font-medium">
                        {previewNotificationMessage}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Embed Design Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span>🎨</span>
                    <span>Embed Design</span>
                  </h3>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Embed Title</Label>
                      <Input
                        value={feedbackEmbedTitle}
                        onChange={(event) => setFeedbackEmbedTitle(event.target.value.slice(0, 256))}
                        maxLength={256}
                        placeholder={DEFAULT_FEEDBACK_EMBED_TITLE}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Button Label</Label>
                      <Input
                        value={feedbackButtonLabel}
                        onChange={(event) => setFeedbackButtonLabel(event.target.value.slice(0, 80))}
                        maxLength={80}
                        placeholder={DEFAULT_FEEDBACK_BUTTON_LABEL}
                      />
                      <p className="text-xs text-muted-foreground">
                        Include an emoji or set it separately below
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Embed Description</Label>
                    <Textarea
                      value={feedbackEmbedDescription}
                      onChange={(event) => setFeedbackEmbedDescription(event.target.value.slice(0, 2048))}
                      rows={6}
                      placeholder={DEFAULT_FEEDBACK_DESCRIPTION}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use <code className="px-2 py-1 bg-muted rounded">{'{{role}}'}</code> to insert role mention automatically
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Embed Color</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="color"
                          value={feedbackEmbedColor}
                          onChange={(event) => setFeedbackEmbedColor(event.target.value)}
                          className="h-10 w-16 p-1 cursor-pointer"
                        />
                        <Input value={feedbackEmbedColor} readOnly className="bg-muted" />
                      </div>
                      <p className="text-xs text-muted-foreground">Hex color format (#RRGGBB)</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Button Style</Label>
                      <Select
                        value={feedbackButtonStyle}
                        onValueChange={(value) => setFeedbackButtonStyle(value as 'primary' | 'secondary' | 'success' | 'danger')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primary (blurple)</SelectItem>
                          <SelectItem value="secondary">Secondary (grey)</SelectItem>
                          <SelectItem value="success">Success (green)</SelectItem>
                          <SelectItem value="danger">Danger (red)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Footer Text (Optional)</Label>
                      <Input
                        value={feedbackEmbedFooter}
                        onChange={(event) => setFeedbackEmbedFooter(event.target.value.slice(0, 512))}
                        placeholder="Leave empty to hide footer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Button Emoji (Optional)</Label>
                      <Input
                        value={feedbackButtonEmoji}
                        onChange={(event) => setFeedbackButtonEmoji(event.target.value.slice(0, 32))}
                        placeholder="🎵"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Thumbnail URL (Optional)</Label>
                      <Input
                        value={feedbackEmbedThumbnail}
                        onChange={(event) => setFeedbackEmbedThumbnail(event.target.value.slice(0, 512))}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Image URL (Optional)</Label>
                      <Input
                        value={feedbackEmbedImage}
                        onChange={(event) => setFeedbackEmbedImage(event.target.value.slice(0, 512))}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                {/* Embed Preview */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Live Preview</Label>
                  <div
                    className="rounded-lg border-2 bg-[#2b2d31] text-sm text-gray-100 p-4 space-y-3 shadow-lg"
                    style={{ borderLeft: `4px solid ${feedbackEmbedColor}` }}
                  >
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="font-semibold text-white text-base">
                          {feedbackEmbedTitle || 'Embed title'}
                        </div>
                        <div className="whitespace-pre-line text-gray-200 text-sm leading-relaxed">
                          {previewFeedbackDescription || DEFAULT_FEEDBACK_DESCRIPTION}
                        </div>
                      </div>
                      {feedbackEmbedThumbnail && (
                        <img
                          src={feedbackEmbedThumbnail}
                          alt="Thumbnail"
                          className="w-16 h-16 rounded object-cover border border-gray-700"
                        />
                      )}
                    </div>
                    {feedbackEmbedImage && (
                      <div className="rounded-lg overflow-hidden border border-gray-800">
                        <img src={feedbackEmbedImage} alt="Image" className="w-full max-h-40 object-cover" />
                      </div>
                    )}
                    {feedbackEmbedFooter && (
                      <div className="flex items-center justify-between pt-2 text-xs text-gray-400 border-t border-gray-700">
                        <span>{feedbackEmbedFooter}</span>
                        <span>Now</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end mt-2">
                    <div className="inline-flex items-center gap-2 rounded-md bg-[#5865f2] text-white px-4 py-2 text-sm font-medium shadow">
                      {feedbackButtonEmoji && <span>{feedbackButtonEmoji}</span>}
                      <span>{feedbackButtonLabel || 'Submit'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Queue Management Card */}
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">📋</div>
                    <div>
                      <h2 className="text-xl font-bold">Submission Queue</h2>
                      <p className="text-sm text-muted-foreground">
                        Manage incoming submissions and track feedback sessions
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-2 px-4 py-2">
                    Pending: {feedbackPending.length}
                  </Badge>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Pending Submissions */}
                {feedbackPending.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <div className="text-4xl mb-3">📭</div>
                    <p className="text-muted-foreground">No pending submissions</p>
                    <p className="text-sm text-muted-foreground mt-1">Submissions will appear here when producers submit samples</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {feedbackPending.map((entry: any) => (
                      <Card key={entry.id} className="p-4 border-2 hover:shadow-lg transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold">
                                {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-base">
                                  {entry.display_name || entry.username || entry.user_id}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {entry.created_at ? new Date(entry.created_at).toLocaleString('en-GB') : 'Unknown'}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <a
                                href={entry.sample_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm break-all"
                              >
                                🔗 {entry.sample_url}
                              </a>
                              {entry.user_notes && (
                                <div className="text-sm">
                                  <span className="font-medium text-muted-foreground">Notes:</span>{' '}
                                  <span>{entry.user_notes}</span>
                                </div>
                              )}
                              {renderMetadata(entry.metadata)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleFeedbackComplete(entry.id)}
                            disabled={feedbackActionLoading}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            ✓ Complete
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* In Progress */}
                {feedbackInProgress.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span>⏳</span>
                      <span>Currently In Progress</span>
                    </h3>
                    <div className="space-y-2">
                      {feedbackInProgress.map((entry: any) => (
                        <Card key={entry.id} className="p-4 border-2 bg-blue-500/5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                              {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold">
                                {entry.display_name || entry.username || entry.user_id}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Claimed by {entry.claimed_by || 'Unknown'} •{' '}
                                {entry.claimed_at ? new Date(entry.claimed_at).toLocaleString('en-GB') : 'Unknown'}
                              </div>
                              {entry.user_notes && (
                                <div className="text-sm mt-1">Notes: {entry.user_notes}</div>
                              )}
                              {renderMetadata(entry.metadata)}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recently Completed */}
                {feedbackCompleted.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span>✅</span>
                      <span>Recently Completed</span>
                    </h3>
                    <div className="space-y-2">
                      {feedbackCompleted.map((entry: any) => (
                        <Card key={entry.id} className="p-4 border-2 bg-green-500/5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white font-bold">
                              {(entry.display_name || entry.username || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold">
                                {entry.display_name || entry.username || entry.user_id}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Completed by {entry.completed_by || 'unknown'} •{' '}
                                {entry.completed_at ? new Date(entry.completed_at).toLocaleString('en-GB') : 'Unknown'}
                              </div>
                              {entry.moderator_notes && (
                                <div className="text-sm mt-1 italic">Note: {entry.moderator_notes}</div>
                              )}
                              {renderMetadata(entry.metadata)}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Queue Setup Card */}
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">🚀</div>
                    <div>
                      <h2 className="text-xl font-bold">Deploy Queue Message</h2>
                      <p className="text-sm text-muted-foreground">
                        Post or refresh the pinned queue message in Discord
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleFeedbackSetup} 
                    disabled={feedbackActionLoading}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    {feedbackActionLoading ? 'Deploying…' : '🚀 Deploy Queue Message'}
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Queue Channel</Label>
                    <Select
                      value={feedbackSetupChannel}
                      onValueChange={(value) => setFeedbackSetupChannel(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select channel</SelectItem>
                        {channels.map((channel: any) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Channel where the queue message will be posted
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Required Role (Optional)</Label>
                    <Select
                      value={feedbackSetupRole}
                      onValueChange={(value) => setFeedbackSetupRole(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Everyone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Everyone can submit</SelectItem>
                        {roles.map((role: any) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Only members with this role can submit samples
                    </p>
                  </div>
                </div>
              </div>
            </Card>
              </>
            )}
          </TabsContent>

          {/* TICKETS TAB */}
          <TabsContent value="tickets" className="space-y-6 p-6">
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 p-8">
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl" />
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold border-4 border-background shadow-xl">
                      🎫
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
                      Support Ticket System
                    </h2>
                    <p className="text-muted-foreground max-w-2xl">
                      Manage support tickets, view statistics and configure your ticket system
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                {/* Feature Cards */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="border-2 bg-gradient-to-br from-blue-500/5 to-transparent p-6 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl">
                        📋
                      </div>
                      <h3 className="font-bold text-lg">Ticket Overview</h3>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Manage open tickets</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Status updates</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Quick search & filter</span>
                      </li>
                    </ul>
                  </Card>

                  <Card className="border-2 bg-gradient-to-br from-purple-500/5 to-transparent p-6 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-xl">
                        📊
                      </div>
                      <h3 className="font-bold text-lg">Analytics</h3>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Response times</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Staff performance</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Ticket trends</span>
                      </li>
                    </ul>
                  </Card>

                  <Card className="border-2 bg-gradient-to-br from-green-500/5 to-transparent p-6 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-xl">
                        ⚙️
                      </div>
                      <h3 className="font-bold text-lg">Configuration</h3>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Auto-close settings</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Welcome messages</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Support categories</span>
                      </li>
                    </ul>
                  </Card>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center gap-4 pt-4">
                  <Button 
                    asChild 
                    size="lg" 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                  >
                    <Link href={`/comcraft/dashboard/${guildId}/tickets`}>
                      🎫 Manage Tickets
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-2">
                    <Link href={`/comcraft/dashboard/${guildId}/tickets/analytics`}>
                      📊 View Analytics
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ECONOMY TAB */}
          <TabsContent value="economy" className="space-y-6 p-6">
            {tabLoading.economy ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 p-8">
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl" />
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-4xl font-bold border-4 border-background shadow-xl">
                      💰
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-3">
                      Economy Management
                    </h2>
                    <p className="text-muted-foreground max-w-2xl">
                      Configure daily rewards, payment limits, XP conversion, and manage economy settings
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <EconomyConfigSection 
                  guildId={guildId} 
                  config={economyConfig}
                  stats={economyStats}
                  onConfigChange={setEconomyConfig}
                  saving={economySaving}
                  onSavingChange={setEconomySaving}
                  onRefresh={async () => {
                    await loadTabData('economy');
                  }}
                />
              </div>
            </Card>
              </>
            )}
          </TabsContent>

          {/* CASINO TAB */}
          <TabsContent value="casino" className="space-y-6 p-6">
            {tabLoading.casino ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 p-8">
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-2xl" />
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-red-600 flex items-center justify-center text-white text-4xl font-bold border-4 border-background shadow-xl">
                      🎰
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-red-600 bg-clip-text text-transparent mb-3">
                      Casino Management
                    </h2>
                    <p className="text-muted-foreground max-w-2xl">
                      Configure casino games, bet limits, and manage statistics
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <CasinoConfigSection 
                  guildId={guildId} 
                  config={casinoConfig}
                  stats={casinoStats}
                  onConfigChange={setCasinoConfig}
                  saving={casinoSaving}
                  onSavingChange={setCasinoSaving}
                  onRefresh={async () => {
                    await loadTabData('casino');
                  }}
                />
              </div>
            </Card>
              </>
            )}
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-6 p-6">
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 p-8">
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl" />
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-4xl font-bold border-4 border-background shadow-xl">
                      📊
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-3">
                      Analytics Dashboard
                    </h2>
                    <p className="text-muted-foreground max-w-2xl">
                      View detailed statistics, charts and insights about your server activity
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                {/* Feature Cards */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-2 bg-gradient-to-br from-green-500/5 to-transparent p-6 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-xl">
                        📈
                      </div>
                      <h3 className="font-bold text-lg">Charts & Graphs</h3>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Daily activity trends</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Member growth tracking</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Hourly activity heatmap</span>
                      </li>
                    </ul>
                  </Card>

                  <Card className="border-2 bg-gradient-to-br from-blue-500/5 to-transparent p-6 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl">
                        🎯
                      </div>
                      <h3 className="font-bold text-lg">Metrics & Insights</h3>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Retention rates</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Top channels & users</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-green-600">✓</span>
                        <span>Peak activity times</span>
                      </li>
                    </ul>
                  </Card>
                </div>

                {/* Action Button */}
                <div className="flex justify-center pt-4">
                  <Button 
                    asChild 
                    size="lg" 
                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 shadow-lg"
                  >
                    <Link href={`/comcraft/dashboard/${guildId}/analytics`}>
                      🚀 Open Analytics Dashboard
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* AUTO-REACTIONS TAB */}
          <TabsContent value="auto-reactions" className="space-y-6 p-6">
            <Card className="border-2 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 p-8">
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-pink-500/20 rounded-full blur-2xl" />
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold border-4 border-background shadow-xl">
                      😊
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-3">
                      Auto-Reactions
                    </h2>
                    <p className="text-muted-foreground max-w-2xl">
                      Configure automatic emoji reactions based on trigger words in messages
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div>💡</div>
                  <p className="text-sm">
                    Configure auto-reactions on the dedicated page. Set trigger words and emoji reactions
                    that will automatically be added when users type specific words.
                  </p>
                </div>

                <div className="flex justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 shadow-lg">
                    <Link href={`/comcraft/dashboard/${guildId}/auto-reactions`}>
                      🚀 Open Auto-Reactions Settings
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
        </Card>
      </div>
    </div>
  );
}

// Economy Configuration Section Component
function EconomyConfigSection({ 
  guildId, 
  config, 
  stats, 
  onConfigChange, 
  saving, 
  onSavingChange,
  onRefresh 
}: { 
  guildId: string; 
  config: any; 
  stats: any; 
  onConfigChange: (config: any) => void; 
  saving: boolean; 
  onSavingChange: (saving: boolean) => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  
  const [dailyRewardBase, setDailyRewardBase] = useState(config?.daily_reward_base ?? 100);
  const [dailyStreakBonus, setDailyStreakBonus] = useState(config?.daily_streak_bonus ?? 10);
  const [dailyMaxStreak, setDailyMaxStreak] = useState(config?.daily_max_streak ?? 30);
  const [xpToCoinsRate, setXpToCoinsRate] = useState(config?.xp_to_coins_rate ?? 0.1);
  const [xpConversionEnabled, setXpConversionEnabled] = useState(config?.xp_conversion_enabled ?? true);
  const [maxBalance, setMaxBalance] = useState(config?.max_balance ?? 1000000000);
  const [minPayAmount, setMinPayAmount] = useState(config?.min_pay_amount ?? 1);
  const [maxPayAmount, setMaxPayAmount] = useState(config?.max_pay_amount ?? 1000000);
  const [economyEnabled, setEconomyEnabled] = useState(config?.economy_enabled ?? true);

  useEffect(() => {
    if (config) {
      setDailyRewardBase(config.daily_reward_base ?? 100);
      setDailyStreakBonus(config.daily_streak_bonus ?? 10);
      setDailyMaxStreak(config.daily_max_streak ?? 30);
      setXpToCoinsRate(config.xp_to_coins_rate ?? 0.1);
      setXpConversionEnabled(config.xp_conversion_enabled ?? true);
      setMaxBalance(config.max_balance ?? 1000000000);
      setMinPayAmount(config.min_pay_amount ?? 1);
      setMaxPayAmount(config.max_pay_amount ?? 1000000);
      setEconomyEnabled(config.economy_enabled ?? true);
    }
  }, [config]);

  const handleSave = async () => {
    onSavingChange(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/economy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_reward_base: dailyRewardBase,
          daily_streak_bonus: dailyStreakBonus,
          daily_max_streak: dailyMaxStreak,
          xp_to_coins_rate: xpToCoinsRate,
          xp_conversion_enabled: xpConversionEnabled,
          max_balance: maxBalance,
          min_pay_amount: minPayAmount,
          max_pay_amount: maxPayAmount,
          economy_enabled: economyEnabled,
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to save economy configuration');
      }

      toast({
        title: 'Success',
        description: 'Economy configuration saved'
      });

      onConfigChange(data.config);
      onRefresh();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save economy configuration',
        variant: 'destructive'
      });
    } finally {
      onSavingChange(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Economy Toggle */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Economy System</h3>
            <p className="text-sm text-muted-foreground">Enable or disable the economy system for this server</p>
          </div>
          <Switch
            checked={economyEnabled}
            onCheckedChange={setEconomyEnabled}
          />
        </div>
      </Card>

      {/* Daily Rewards */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Daily Rewards</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="dailyRewardBase">Base Daily Reward</Label>
            <Input
              id="dailyRewardBase"
              type="number"
              min="0"
              value={dailyRewardBase}
              onChange={(e) => setDailyRewardBase(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">Base coins given daily</p>
          </div>
          <div>
            <Label htmlFor="dailyStreakBonus">Streak Bonus</Label>
            <Input
              id="dailyStreakBonus"
              type="number"
              min="0"
              value={dailyStreakBonus}
              onChange={(e) => setDailyStreakBonus(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">Bonus coins per streak day</p>
          </div>
          <div>
            <Label htmlFor="dailyMaxStreak">Max Streak</Label>
            <Input
              id="dailyMaxStreak"
              type="number"
              min="1"
              value={dailyMaxStreak}
              onChange={(e) => setDailyMaxStreak(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground mt-1">Maximum streak bonus days</p>
          </div>
        </div>
      </Card>

      {/* XP Conversion */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">XP Conversion</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable XP Conversion</Label>
              <p className="text-sm text-muted-foreground">Allow users to convert XP to coins</p>
            </div>
            <Switch
              checked={xpConversionEnabled}
              onCheckedChange={setXpConversionEnabled}
            />
          </div>
          {xpConversionEnabled && (
            <div>
              <Label htmlFor="xpToCoinsRate">XP to Coins Rate</Label>
              <Input
                id="xpToCoinsRate"
                type="number"
                step="0.01"
                min="0"
                value={xpToCoinsRate}
                onChange={(e) => setXpToCoinsRate(parseFloat(e.target.value) || 0.1)}
              />
              <p className="text-xs text-muted-foreground mt-1">1 XP = {xpToCoinsRate} coins</p>
            </div>
          )}
        </div>
      </Card>

      {/* Payment Limits */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Payment Limits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minPayAmount">Minimum Payment</Label>
            <Input
              id="minPayAmount"
              type="number"
              min="1"
              value={minPayAmount}
              onChange={(e) => setMinPayAmount(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <Label htmlFor="maxPayAmount">Maximum Payment</Label>
            <Input
              id="maxPayAmount"
              type="number"
              min="1"
              value={maxPayAmount}
              onChange={(e) => setMaxPayAmount(parseInt(e.target.value) || 1000000)}
            />
          </div>
        </div>
      </Card>

      {/* Balance Limits */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Balance Limits</h3>
        <div>
          <Label htmlFor="maxBalance">Maximum Balance</Label>
          <Input
            id="maxBalance"
            type="number"
            min="1"
            value={maxBalance}
            onChange={(e) => setMaxBalance(parseInt(e.target.value) || 1000000000)}
          />
          <p className="text-xs text-muted-foreground mt-1">Maximum coins a user can have</p>
        </div>
      </Card>

      {/* Statistics */}
      {stats && (
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4">Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.total_users || 0}</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.total_balance || 0}</div>
              <div className="text-sm text-muted-foreground">Total Balance</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.total_earned || 0}</div>
              <div className="text-sm text-muted-foreground">Total Earned</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.total_transactions || 0}</div>
              <div className="text-sm text-muted-foreground">Transactions</div>
            </div>
          </div>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Casino Configuration Section Component
function CasinoConfigSection({ 
  guildId, 
  config, 
  stats, 
  onConfigChange, 
  saving, 
  onSavingChange,
  onRefresh 
}: { 
  guildId: string; 
  config: any; 
  stats: any; 
  onConfigChange: (config: any) => void; 
  saving: boolean; 
  onSavingChange: (saving: boolean) => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  
  const [enabledGames, setEnabledGames] = useState<Record<string, boolean>>({
    dice: config?.enabled_games?.dice ?? true,
    slots: config?.enabled_games?.slots ?? true,
    coinflip: config?.enabled_games?.coinflip ?? true,
    blackjack: config?.enabled_games?.blackjack ?? true,
  });
  
  const [minBet, setMinBet] = useState(config?.min_bet ?? 10);
  const [maxBet, setMaxBet] = useState(config?.max_bet ?? 10000);
  const [houseEdge, setHouseEdge] = useState(config?.house_edge ?? 0.05);

  useEffect(() => {
    if (config) {
      setEnabledGames({
        dice: config.enabled_games?.dice ?? true,
        slots: config.enabled_games?.slots ?? true,
        coinflip: config.enabled_games?.coinflip ?? true,
        blackjack: config.enabled_games?.blackjack ?? true,
      });
      setMinBet(config.min_bet ?? 10);
      setMaxBet(config.max_bet ?? 10000);
      setHouseEdge(config.house_edge ?? 0.05);
    }
  }, [config]);

  const handleSave = async () => {
    onSavingChange(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/casino`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled_games: enabledGames,
          min_bet: minBet,
          max_bet: maxBet,
          house_edge: houseEdge,
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to save casino configuration');
      }

      toast({
        title: 'Success',
        description: 'Casino configuration saved'
      });

      onConfigChange(data.config);
      onRefresh();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save casino configuration',
        variant: 'destructive'
      });
    } finally {
      onSavingChange(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Game Settings */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Game Settings</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="font-semibold">🎲 Dice</Label>
                <p className="text-sm text-muted-foreground">Dice game</p>
              </div>
              <Switch
                checked={enabledGames.dice}
                onCheckedChange={(checked) => setEnabledGames({ ...enabledGames, dice: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="font-semibold">🎰 Slots</Label>
                <p className="text-sm text-muted-foreground">Slots game</p>
              </div>
              <Switch
                checked={enabledGames.slots}
                onCheckedChange={(checked) => setEnabledGames({ ...enabledGames, slots: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="font-semibold">🪙 Coinflip</Label>
                <p className="text-sm text-muted-foreground">Coin flip</p>
              </div>
              <Switch
                checked={enabledGames.coinflip}
                onCheckedChange={(checked) => setEnabledGames({ ...enabledGames, coinflip: checked })}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="font-semibold">🃏 Blackjack</Label>
                <p className="text-sm text-muted-foreground">21 card game</p>
              </div>
              <Switch
                checked={enabledGames.blackjack}
                onCheckedChange={(checked) => setEnabledGames({ ...enabledGames, blackjack: checked })}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Bet Limits */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">Bet Limits</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minBet">Minimum Bet</Label>
            <Input
              id="minBet"
              type="number"
              min="1"
              value={minBet}
              onChange={(e) => setMinBet(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <Label htmlFor="maxBet">Maximum Bet</Label>
            <Input
              id="maxBet"
              type="number"
              min="1"
              value={maxBet}
              onChange={(e) => setMaxBet(parseInt(e.target.value) || 10000)}
            />
          </div>
        </div>
      </Card>

      {/* House Edge */}
      <Card className="p-6">
        <h3 className="text-xl font-bold mb-4">House Edge</h3>
        <div>
          <Label htmlFor="houseEdge">House Edge Percentage (0.01 = 1%)</Label>
          <Input
            id="houseEdge"
            type="number"
            step="0.01"
            min="0"
            max="0.5"
            value={houseEdge}
            onChange={(e) => setHouseEdge(parseFloat(e.target.value) || 0.05)}
          />
          <p className="text-sm text-muted-foreground mt-2">
            The house edge determines how much advantage the casino has. Default: 5% (0.05)
          </p>
        </div>
      </Card>

      {/* Statistics */}
      {stats && (
        <Card className="p-6">
          <h3 className="text-xl font-bold mb-4">Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.total_games || 0}</div>
              <div className="text-sm text-muted-foreground">Total Games</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.total_wagered || 0}</div>
              <div className="text-sm text-muted-foreground">Total Wagered</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.total_payout || 0}</div>
              <div className="text-sm text-muted-foreground">Total Payout</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.house_profit || 0}</div>
              <div className="text-sm text-muted-foreground">House Profit</div>
            </div>
          </div>
        </Card>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-gradient-to-r from-yellow-600 to-red-600 hover:from-yellow-700 hover:to-red-700"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
