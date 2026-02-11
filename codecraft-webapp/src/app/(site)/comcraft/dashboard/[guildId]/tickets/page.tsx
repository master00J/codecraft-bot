'use client';

/**
 * Comcraft - Tickets Management Page
 * Full ticket system dashboard
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Minus } from 'lucide-react';

interface Ticket {
  id: string;
  ticket_number: string;
  guild_id: string;
  discord_user_id: string;
  discord_username: string;
  discord_channel_id: string;
  subject: string;
  description: string;
  status: 'open' | 'claimed' | 'closed' | 'resolved';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  claimed_by_discord_id: string | null;
  claimed_by_username: string | null;
  claimed_at: string | null;
  closed_by_discord_id: string | null;
  closed_by_username: string | null;
  closed_at: string | null;
  close_reason: string | null;
  archived: boolean;
  archived_at: string | null;
  deleted_at: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketConfig {
  guild_id: string;
  enabled: boolean;
  support_category_id: string | null;
  archive_category_id: string | null;
  log_channel_id: string | null;
  transcript_channel_id: string | null;
  panel_channel_id: string | null;
  panel_message_id: string | null;
  support_role_id: string | null;
  auto_close_hours: number;
  max_open_tickets_per_user: number;
  ticket_counter: number;
  welcome_message: string;
  panel_embed_title: string | null;
  panel_embed_description: string | null;
  panel_embed_color: string | null;
  panel_embed_footer: string | null;
  panel_embed_thumbnail_url: string | null;
  panel_embed_image_url: string | null;
  panel_button_label: string | null;
  panel_button_emoji: string | null;
}

interface Statistics {
  total: number;
  open: number;
  claimed: number;
  closed: number;
}

interface TicketCategory {
  id: string;
  guild_id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  category_channel_id: string | null;
  support_role_id: string | null;
  required_role_ids: string[] | null;
  auto_response: string | null;
  is_active: boolean;
  created_at: string;
}

interface TicketTemplate {
  id: string;
  guild_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  subject: string;
  description_text: string | null;
  variables: Record<string, any> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export default function TicketsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    total: 0,
    open: 0,
    claimed: 0,
    closed: 0
  });
  const [ratingStats, setRatingStats] = useState<{
    average: number;
    total: number;
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  }>({
    average: 0,
    total: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  });
  const [config, setConfig] = useState<TicketConfig | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Category management state
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TicketCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryEmoji, setCategoryEmoji] = useState('');
  const [categorySupportRoleId, setCategorySupportRoleId] = useState('none');
  const [categoryRequiredRoleIds, setCategoryRequiredRoleIds] = useState<string[]>([]);
  const [categoryAutoResponse, setCategoryAutoResponse] = useState('');
  const [categoryIsActive, setCategoryIsActive] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);

  // Config state
  const [configSaving, setConfigSaving] = useState(false);
  const [configEnabled, setConfigEnabled] = useState(true);
  const [configAutoClose, setConfigAutoClose] = useState(24);
  const [configMaxTickets, setConfigMaxTickets] = useState(3);
  const [configWelcomeMessage, setConfigWelcomeMessage] = useState('');

  // Template management state
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TicketTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateDescriptionText, setTemplateDescriptionText] = useState('');
  const [templateCategoryId, setTemplateCategoryId] = useState<string>('none');
  const [templateIsActive, setTemplateIsActive] = useState(true);
  const [configPanelTitle, setConfigPanelTitle] = useState('');
  const [configPanelDescription, setConfigPanelDescription] = useState('');
  const [configPanelColor, setConfigPanelColor] = useState('#5865F2');
  const [configPanelFooter, setConfigPanelFooter] = useState('');
  const [configPanelThumbnail, setConfigPanelThumbnail] = useState('');
  const [configPanelImage, setConfigPanelImage] = useState('');
  const [configPanelButtonLabel, setConfigPanelButtonLabel] = useState('');
  const [configPanelButtonEmoji, setConfigPanelButtonEmoji] = useState('');
  const [configArchiveCategoryId, setConfigArchiveCategoryId] = useState('none');
  const [discordCategories, setDiscordCategories] = useState<any[]>([]);

  useEffect(() => {
    if (guildId) {
      fetchTickets();
    }
  }, [guildId, showArchived, showDeleted]);

  useEffect(() => {
    filterTickets();
  }, [tickets, statusFilter, searchQuery, showArchived, showDeleted]);

  useEffect(() => {
    if (config) {
      setConfigEnabled(config.enabled);
      setConfigAutoClose(config.auto_close_hours);
      setConfigMaxTickets(config.max_open_tickets_per_user);
      setConfigWelcomeMessage(config.welcome_message);
      setConfigPanelTitle(config.panel_embed_title ?? '');
      setConfigPanelDescription(config.panel_embed_description ?? '');
      setConfigPanelColor(config.panel_embed_color ?? '#5865F2');
      setConfigPanelFooter(config.panel_embed_footer ?? '');
      setConfigPanelThumbnail(config.panel_embed_thumbnail_url ?? '');
      setConfigPanelImage(config.panel_embed_image_url ?? '');
      setConfigPanelButtonLabel(config.panel_button_label ?? '');
      setConfigPanelButtonEmoji(config.panel_button_emoji ?? '');
      setConfigArchiveCategoryId(config.archive_category_id || 'none');
    }
  }, [config]);

  const fetchTickets = async () => {
    try {
      const params = new URLSearchParams();
      // Always fetch archived tickets so they're available in the archived tab
      params.append('includeArchived', 'true');
      if (showDeleted) params.append('includeDeleted', 'true');
      
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets?${params.toString()}`);
      const data = await response.json();
      
      setTickets(data.tickets || []);
      setStatistics(data.statistics || { total: 0, open: 0, claimed: 0, closed: 0 });
      setConfig(data.config);
      setCategories(data.categories || []);

      // Fetch rating statistics
      try {
        const ratingResponse = await fetch(`/api/comcraft/guilds/${guildId}/tickets/ratings/stats`);
        if (ratingResponse.ok) {
          const ratingData = await ratingResponse.json();
          setRatingStats(ratingData);
        }
      } catch (error) {
        console.error('Error fetching rating stats:', error);
      }
      
      // Fetch roles for the guild
      const rolesResponse = await fetch(`/api/comcraft/guilds/${guildId}/discord/roles`);
      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setRoles(rolesData.roles || []);
      }

      // Fetch Discord categories
      const categoriesResponse = await fetch(`/api/comcraft/guilds/${guildId}/discord/categories`);
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        setDiscordCategories(categoriesData.categories || []);
      }

      // Fetch templates
      await fetchTemplates();
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tickets',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/templates`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    // Filter by archived/deleted status
    if (!showArchived && !showDeleted) {
      // Show only active tickets (not archived, not deleted)
      filtered = filtered.filter(t => !t.archived && !t.deleted_at);
    } else if (showArchived && !showDeleted) {
      // Show archived tickets (but not deleted)
      filtered = filtered.filter(t => t.archived && !t.deleted_at);
    } else if (!showArchived && showDeleted) {
      // Show deleted tickets (but not archived)
      filtered = filtered.filter(t => !t.archived && t.deleted_at);
    } else if (showArchived && showDeleted) {
      // Show both archived and deleted
      filtered = filtered.filter(t => t.archived || t.deleted_at);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.ticket_number.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query) ||
        t.discord_username?.toLowerCase().includes(query)
      );
    }

    setFilteredTickets(filtered);
  };

  const claimTicket = async (ticketId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim' })
      });

      if (response.ok) {
        toast({
          title: 'Ticket claimed!',
          description: 'You are now assigned to this ticket.',
        });
        fetchTickets();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Could not claim the ticket',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not claim the ticket',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const closeTicket = async (ticketId: string, reason: string = 'Resolved from dashboard') => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', reason })
      });

      if (response.ok) {
        toast({
          title: 'Ticket closed!',
          description: 'The ticket has been closed successfully.',
        });
        fetchTickets();
        setSelectedTicket(null);
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Could not close the ticket',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not close the ticket',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const reopenTicket = async (ticketId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' })
      });

      if (response.ok) {
        toast({
          title: 'Ticket reopened!',
          description: 'The ticket is active again.',
        });
        fetchTickets();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Could not reopen the ticket',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not reopen the ticket',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const updatePriority = async (ticketId: string, priority: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_priority', priority })
      });

      if (response.ok) {
        toast({
          title: 'Priority updated!',
          description: `Priority changed to ${priority}`,
        });
        fetchTickets();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not update the priority',
        variant: 'destructive'
      });
    }
  };

  const archiveTicket = async (ticketId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' })
      });

      if (response.ok) {
        toast({
          title: 'Ticket archived!',
          description: 'The ticket has been archived.',
        });
        fetchTickets();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Could not archive the ticket',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not archive the ticket',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const unarchiveTicket = async (ticketId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unarchive' })
      });

      if (response.ok) {
        toast({
          title: 'Ticket unarchived!',
          description: 'The ticket has been unarchived.',
        });
        fetchTickets();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Could not unarchive the ticket',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not unarchive the ticket',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Ticket deleted!',
          description: 'The ticket has been deleted.',
        });
        fetchTickets();
        setSelectedTicket(null);
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Could not delete the ticket',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not delete the ticket',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const bulkArchiveByCategory = async (categoryId: string) => {
    if (!confirm(`Are you sure you want to archive all tickets in this category?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', categoryId })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Tickets archived!',
          description: data.message || `Archived ${data.count} ticket(s)`,
        });
        fetchTickets();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Could not archive tickets',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not archive tickets',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const bulkDeleteByCategory = async (categoryId: string) => {
    if (!confirm(`Are you sure you want to delete all tickets in this category? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', categoryId })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Tickets deleted!',
          description: data.message || `Deleted ${data.count} ticket(s)`,
        });
        fetchTickets();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Could not delete tickets',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not delete tickets',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: configEnabled,
          autoCloseHours: configAutoClose,
          maxOpenTicketsPerUser: configMaxTickets,
          welcomeMessage: configWelcomeMessage,
          panelEmbedTitle: configPanelTitle.trim() || null,
          panelEmbedDescription: configPanelDescription.trim() || null,
          panelEmbedColor: configPanelColor.trim() || null,
          panelEmbedFooter: configPanelFooter.trim() || null,
          panelEmbedThumbnailUrl: configPanelThumbnail.trim() || null,
          panelEmbedImageUrl: configPanelImage.trim() || null,
          panelButtonLabel: configPanelButtonLabel.trim() || null,
          panelButtonEmoji: configPanelButtonEmoji.trim() || null,
          archiveCategoryId: configArchiveCategoryId === 'none' ? null : configArchiveCategoryId
        })
      });

      if (response.ok) {
        toast({
          title: 'Saved!',
          description: 'Ticket configuration updated',
        });
        fetchTickets();
      } else {
        toast({
          title: 'Error',
          description: 'Could not save configuration',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not save configuration',
        variant: 'destructive'
      });
    } finally {
      setConfigSaving(false);
    }
  };

  const openCategoryDialog = (category: TicketCategory | null = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
      setCategoryDescription(category.description || '');
      setCategoryEmoji(category.emoji || '');
      setCategorySupportRoleId(category.support_role_id || 'none');
      setCategoryRequiredRoleIds(Array.isArray(category.required_role_ids) ? category.required_role_ids : []);
      setCategoryAutoResponse(category.auto_response || '');
      setCategoryIsActive(category.is_active);
    } else {
      setEditingCategory(null);
      setCategoryName('');
      setCategoryDescription('');
      setCategoryEmoji('');
      setCategorySupportRoleId('none');
      setCategoryRequiredRoleIds([]);
      setCategoryAutoResponse('');
      setCategoryIsActive(true);
    }
    setShowCategoryDialog(true);
  };

  const saveCategory = async () => {
    if (!categoryName.trim()) {
      toast({
        title: 'Error',
        description: 'Category name is required',
        variant: 'destructive'
      });
      return;
    }

    setActionLoading(true);
    try {
      const url = editingCategory
        ? `/api/comcraft/guilds/${guildId}/tickets/categories/${editingCategory.id}`
        : `/api/comcraft/guilds/${guildId}/tickets/categories`;
      
      const method = editingCategory ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
          emoji: categoryEmoji.trim() || null,
          supportRoleId: categorySupportRoleId && categorySupportRoleId !== 'none' ? categorySupportRoleId : null,
          requiredRoleIds: categoryRequiredRoleIds.length > 0 ? categoryRequiredRoleIds : null,
          autoResponse: categoryAutoResponse.trim() || null,
          isActive: categoryIsActive
        })
      });

      if (response.ok) {
        toast({
          title: 'Success!',
          description: `Category ${editingCategory ? 'updated' : 'created'} successfully`,
        });
        setShowCategoryDialog(false);
        fetchTickets();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to save category',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save category',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? Existing tickets will not be affected.')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/categories/${categoryId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Deleted!',
          description: 'Category has been removed',
        });
        fetchTickets();
      } else {
        toast({
          title: 'Error',
          description: 'Could not delete category',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not delete category',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-green-500',
      claimed: 'bg-blue-500',
      closed: 'bg-gray-500',
      resolved: 'bg-purple-500'
    };
    return <Badge className={styles[status as keyof typeof styles]}>{status.toUpperCase()}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      low: 'bg-gray-400',
      normal: 'bg-blue-400',
      high: 'bg-orange-500',
      urgent: 'bg-red-600'
    };
    return <Badge className={styles[priority as keyof typeof styles]}>{priority.toUpperCase()}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2">🎫 Support Tickets</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage and track every support request
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total</div>
              <div className="text-3xl font-bold">{statistics.total}</div>
            </Card>
            <Card className="p-4 bg-green-50 dark:bg-green-900/20">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Open</div>
              <div className="text-3xl font-bold text-green-600">{statistics.open}</div>
            </Card>
            <Card className="p-4 bg-blue-50 dark:bg-blue-900/20">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Claimed</div>
              <div className="text-3xl font-bold text-blue-600">{statistics.claimed}</div>
            </Card>
            <Card className="p-4 bg-gray-50 dark:bg-gray-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Closed</div>
              <div className="text-3xl font-bold text-gray-600">{statistics.closed}</div>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="tickets" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="archived">📦 Archived</TabsTrigger>
            <TabsTrigger value="templates">📋 Templates</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          {/* Tickets List Tab */}
          <TabsContent value="tickets" className="space-y-6">
            {/* Filters */}
            <Card className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="🔍 Search tickets… (number, subject, member)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Status filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="claimed">Claimed</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={fetchTickets} variant="outline">
                    🔄 Refresh
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={showArchived ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowArchived(!showArchived)}
                  >
                    {showArchived ? '✓' : ''} Show Archived
                  </Button>
                  <Button
                    variant={showDeleted ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowDeleted(!showDeleted)}
                  >
                    {showDeleted ? '✓' : ''} Show Deleted
                  </Button>
                </div>
              </div>
            </Card>

            {/* Tickets List */}
            <div className="space-y-3">
              {filteredTickets.length === 0 ? (
                <Card className="p-8 text-center text-gray-500">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'No tickets match the current filters'
                    : 'No tickets have been created yet'}
                </Card>
              ) : (
                filteredTickets.map((ticket) => (
                  <Card key={ticket.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Ticket Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xl font-bold text-blue-600">
                            {ticket.ticket_number}
                          </span>
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                        </div>
                        
                        <h3 className="text-lg font-semibold mb-1">{ticket.subject}</h3>
                        
                        <div className="flex flex-col md:flex-row md:items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span>👤 {ticket.discord_username || 'Unknown'}</span>
                          <span className="hidden md:inline">•</span>
                          <span>📅 {formatDate(ticket.created_at)}</span>
                          {ticket.claimed_by_username && (
                            <>
                              <span className="hidden md:inline">•</span>
                              <span>🙋 Claimed by {ticket.claimed_by_username}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {ticket.status === 'open' && (
                          <Button 
                            size="sm"
                            onClick={() => claimTicket(ticket.id)}
                            disabled={actionLoading}
                          >
                            🙋 Claim
                          </Button>
                        )}
                        
                        {(ticket.status === 'open' || ticket.status === 'claimed') && (
                          <Button 
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedTicket(ticket);
                            }}
                            disabled={actionLoading}
                          >
                            🔒 Close
                          </Button>
                        )}

                        {(ticket.status === 'closed' || ticket.status === 'resolved') && (
                          <Button 
                            size="sm"
                            variant="secondary"
                            onClick={() => reopenTicket(ticket.id)}
                            disabled={actionLoading}
                          >
                            🔓 Reopen
                          </Button>
                        )}

                        {ticket.archived ? (
                          <Button 
                            size="sm"
                            variant="secondary"
                            onClick={() => unarchiveTicket(ticket.id)}
                            disabled={actionLoading}
                          >
                            📦 Unarchive
                          </Button>
                        ) : (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => archiveTicket(ticket.id)}
                            disabled={actionLoading}
                          >
                            📦 Archive
                          </Button>
                        )}

                        {!ticket.deleted_at && (
                          <Button 
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteTicket(ticket.id)}
                            disabled={actionLoading}
                          >
                            🗑️ Delete
                          </Button>
                        )}

                        <Select 
                          value={ticket.priority}
                          onValueChange={(value) => updatePriority(ticket.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <Link href={`/comcraft/dashboard/${guildId}/tickets/${ticket.id}`}>
                            👁️ Details
                          </Link>
                        </Button>
                      </div>
                    </div>

                    {ticket.description && (
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {ticket.description}
                        </p>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Archived Tickets Tab */}
          <TabsContent value="archived" className="space-y-6">
            <Card className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="🔍 Search archived tickets…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Status filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="claimed">Claimed</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => {
                    setShowArchived(true);
                    setShowDeleted(false);
                    fetchTickets();
                  }} variant="outline">
                    🔄 Refresh
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={showDeleted ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setShowDeleted(!showDeleted);
                      fetchTickets();
                    }}
                  >
                    {showDeleted ? '✓' : ''} Show Deleted
                  </Button>
                </div>
              </div>
            </Card>

            {/* Archived Tickets List */}
            <div className="space-y-3">
              {(() => {
                // Filter to show only archived tickets
                let archivedTickets = tickets.filter(t => t.archived && !t.deleted_at);
                
                // Apply status filter
                if (statusFilter !== 'all') {
                  archivedTickets = archivedTickets.filter(t => t.status === statusFilter);
                }

                // Apply search filter
                if (searchQuery) {
                  const query = searchQuery.toLowerCase();
                  archivedTickets = archivedTickets.filter(t => 
                    t.ticket_number.toLowerCase().includes(query) ||
                    t.subject.toLowerCase().includes(query) ||
                    t.discord_username?.toLowerCase().includes(query)
                  );
                }

                return archivedTickets.length === 0 ? (
                  <Card className="p-8 text-center text-gray-500">
                    {searchQuery || statusFilter !== 'all'
                      ? 'No archived tickets match the current filters'
                      : 'No archived tickets yet'}
                  </Card>
                ) : (
                  archivedTickets.map((ticket) => (
                    <Card key={ticket.id} className="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl font-bold text-blue-600">
                              {ticket.ticket_number}
                            </span>
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                            <Badge className="bg-orange-500">📦 Archived</Badge>
                          </div>
                          
                          <h3 className="text-lg font-semibold mb-1">{ticket.subject}</h3>
                          
                          <div className="flex flex-col md:flex-row md:items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span>👤 {ticket.discord_username || 'Unknown'}</span>
                            <span className="hidden md:inline">•</span>
                            <span>📅 {formatDate(ticket.created_at)}</span>
                            {ticket.archived_at && (
                              <>
                                <span className="hidden md:inline">•</span>
                                <span>📦 Archived: {formatDate(ticket.archived_at)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button 
                            size="sm"
                            variant="secondary"
                            onClick={() => unarchiveTicket(ticket.id)}
                            disabled={actionLoading}
                          >
                            📂 Unarchive
                          </Button>

                          {!ticket.deleted_at && (
                            <Button 
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteTicket(ticket.id)}
                              disabled={actionLoading}
                            >
                              🗑️ Delete
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <Link href={`/comcraft/dashboard/${guildId}/tickets/${ticket.id}`}>
                              👁️ Details
                            </Link>
                          </Button>
                        </div>
                      </div>

                      {ticket.description && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {ticket.description}
                          </p>
                        </div>
                      )}
                    </Card>
                  ))
                );
              })()}
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">Ticket Templates</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Create reusable templates to speed up ticket creation
                  </p>
                </div>
                <Button onClick={() => {
                  setEditingTemplate(null);
                  setTemplateName('');
                  setTemplateDescription('');
                  setTemplateSubject('');
                  setTemplateDescriptionText('');
                  setTemplateCategoryId('none');
                  setTemplateIsActive(true);
                  setShowTemplateDialog(true);
                }}>
                  ➕ New Template
                </Button>
              </div>

              <div className="space-y-3">
                {templates.length === 0 ? (
                  <Card className="p-4 text-center text-gray-500">
                    No templates found. Create your first template to get started!
                  </Card>
                ) : (
                  templates.map((template) => (
                    <Card key={template.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{template.name}</h3>
                            {!template.is_active && (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                            {template.category_id && (
                              <Badge variant="outline">
                                {categories.find(c => c.id === template.category_id)?.name || 'Unknown Category'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            <strong>Subject:</strong> {template.subject}
                          </p>
                          {template.description_text && (
                            <p className="text-sm text-gray-500 dark:text-gray-500 mb-2 line-clamp-2">
                              {template.description_text}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">
                            Created {new Date(template.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingTemplate(template);
                              setTemplateName(template.name);
                              setTemplateDescription(template.description || '');
                              setTemplateSubject(template.subject);
                              setTemplateDescriptionText(template.description_text || '');
                              setTemplateCategoryId(template.category_id || 'none');
                              setTemplateIsActive(template.is_active);
                              setShowTemplateDialog(true);
                            }}
                          >
                            ✏️ Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              if (!confirm('Are you sure you want to delete this template?')) return;
                              try {
                                const response = await fetch(
                                  `/api/comcraft/guilds/${guildId}/tickets/templates/${template.id}`,
                                  { method: 'DELETE' }
                                );
                                if (response.ok) {
                                  toast({
                                    title: 'Template deleted',
                                    description: 'The template has been deleted successfully.',
                                  });
                                  fetchTemplates();
                                } else {
                                  throw new Error('Failed to delete template');
                                }
                              } catch (error) {
                                toast({
                                  title: 'Error',
                                  description: 'Failed to delete template',
                                  variant: 'destructive'
                                });
                              }
                            }}
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </Card>

            {/* Template Dialog */}
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Edit Template' : 'Create New Template'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingTemplate
                      ? 'Update the template details below.'
                      : 'Create a reusable template for ticket creation. Users can select this template when creating tickets.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Template Name *</Label>
                    <Input
                      id="template-name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Bug Report, Feature Request"
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-description">Description (optional)</Label>
                    <Input
                      id="template-description"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Brief description of this template"
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-category">Category (optional)</Label>
                    <Select value={templateCategoryId} onValueChange={setTemplateCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (General Template)</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.emoji} {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="template-subject">Subject *</Label>
                    <Input
                      id="template-subject"
                      value={templateSubject}
                      onChange={(e) => setTemplateSubject(e.target.value)}
                      placeholder="Default ticket subject"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This will be used as the default subject when users select this template.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="template-description-text">Description Text</Label>
                    <Textarea
                      id="template-description-text"
                      value={templateDescriptionText}
                      onChange={(e) => setTemplateDescriptionText(e.target.value)}
                      placeholder="Default ticket description/message"
                      rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This will be pre-filled in the ticket description when users select this template.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="template-active"
                      checked={templateIsActive}
                      onChange={(e) => setTemplateIsActive(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="template-active" className="cursor-pointer">
                      Template is active (visible to users)
                    </Label>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowTemplateDialog(false);
                        setEditingTemplate(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!templateName || !templateSubject) {
                          toast({
                            title: 'Validation Error',
                            description: 'Name and subject are required',
                            variant: 'destructive'
                          });
                          return;
                        }
                        try {
                          const url = editingTemplate
                            ? `/api/comcraft/guilds/${guildId}/tickets/templates/${editingTemplate.id}`
                            : `/api/comcraft/guilds/${guildId}/tickets/templates`;
                          const method = editingTemplate ? 'PATCH' : 'POST';
                          const body = {
                            name: templateName,
                            description: templateDescription || null,
                            subject: templateSubject,
                            description_text: templateDescriptionText || null,
                            category_id: templateCategoryId && templateCategoryId !== 'none' ? templateCategoryId : null,
                            is_active: templateIsActive
                          };
                          const response = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                          });
                          if (response.ok) {
                            toast({
                              title: editingTemplate ? 'Template updated' : 'Template created',
                              description: `The template has been ${editingTemplate ? 'updated' : 'created'} successfully.`,
                            });
                            setShowTemplateDialog(false);
                            setEditingTemplate(null);
                            fetchTemplates();
                          } else {
                            const error = await response.json();
                            throw new Error(error.error || 'Failed to save template');
                          }
                        } catch (error) {
                          toast({
                            title: 'Error',
                            description: error instanceof Error ? error.message : 'Failed to save template',
                            variant: 'destructive'
                          });
                        }
                      }}
                    >
                      {editingTemplate ? 'Update Template' : 'Create Template'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">Ticket Categories</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Create different ticket types with custom settings and auto-responses
                  </p>
                </div>
                <Button onClick={() => openCategoryDialog()}>
                  ➕ New Category
                </Button>
              </div>

              {categories.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg mb-2">No categories yet</p>
                  <p className="text-sm">Create categories to offer different ticket types (Support, Bug Report, Sales, etc.)</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.map((category) => (
                    <Card key={category.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {category.emoji && <span className="text-2xl">{category.emoji}</span>}
                            <h3 className="text-lg font-semibold">{category.name}</h3>
                            {!category.is_active && (
                              <Badge className="bg-gray-400">Inactive</Badge>
                            )}
                          </div>
                          {category.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {category.description}
                            </p>
                          )}
                          {category.auto_response && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                              <span className="font-medium">Auto-response:</span> {category.auto_response}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCategoryDialog(category)}
                            disabled={actionLoading}
                          >
                            ✏️ Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => bulkArchiveByCategory(category.id)}
                            disabled={actionLoading}
                          >
                            📦 Archive All
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => bulkDeleteByCategory(category.id)}
                            disabled={actionLoading}
                          >
                            🗑️ Delete All
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteCategory(category.id)}
                            disabled={actionLoading}
                          >
                            🗑️ Delete Category
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            {/* Category Dialog */}
            <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? 'Edit Category' : 'New Category'}
                  </DialogTitle>
                  <DialogDescription>
                    Configure a ticket category with custom settings
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g. Support, Bug Report, Sales"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={categoryDescription}
                      onChange={(e) => setCategoryDescription(e.target.value)}
                      placeholder="Brief description of this ticket type"
                      rows={2}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Emoji</Label>
                      <Input
                        value={categoryEmoji}
                        onChange={(e) => setCategoryEmoji(e.target.value)}
                        placeholder="🎫"
                        maxLength={10}
                      />
                      <p className="text-xs text-gray-500">
                        Used on the ticket panel button
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="flex items-center gap-2 h-10">
                        <input
                          type="checkbox"
                          id="category-active"
                          checked={categoryIsActive}
                          onChange={(e) => setCategoryIsActive(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="category-active" className="cursor-pointer">
                          Active
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Support Role</Label>
                    <Select
                      value={categorySupportRoleId}
                      onValueChange={setCategorySupportRoleId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role to notify (optional)" />
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
                    <p className="text-xs text-gray-500">
                      This role will be mentioned when a ticket of this type is created
                    </p>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label className="text-base font-medium">Who can open this ticket type?</Label>
                    <div className="flex flex-wrap gap-2">
                      <Select
                        value="__add__"
                        onValueChange={(v) => {
                          if (v && v !== '__add__' && !categoryRequiredRoleIds.includes(v)) {
                            setCategoryRequiredRoleIds([...categoryRequiredRoleIds, v]);
                          }
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Everyone (default)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__add__">Everyone (no restriction)</SelectItem>
                          {roles
                            .filter((r: any) => !categoryRequiredRoleIds.includes(r.id))
                            .map((r: any) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          {roles.filter((r: any) => !categoryRequiredRoleIds.includes(r.id)).length === 0 && (
                            <SelectItem value="__none__" disabled>All roles added</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {categoryRequiredRoleIds.map((id) => {
                        const role = roles.find((r: any) => r.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="gap-1 pr-1">
                            {role?.name ?? id}
                            <button
                              type="button"
                              aria-label="Remove"
                              className="rounded-full hover:bg-muted p-0.5"
                              onClick={() => setCategoryRequiredRoleIds(categoryRequiredRoleIds.filter((r) => r !== id))}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500">
                      If you add roles, only members with at least one of these roles can open this ticket type (e.g. Premium tickets for Premium role). Leave empty for Standard — everyone can open.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Auto-response</Label>
                    <Textarea
                      value={categoryAutoResponse}
                      onChange={(e) => setCategoryAutoResponse(e.target.value)}
                      placeholder="Automatic message sent when a ticket of this type is created"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowCategoryDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={saveCategory}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Saving...' : 'Save Category'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-6">Ticket System Configuration</h2>

            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  id="ticket-enabled"
                  checked={configEnabled}
                  onChange={(e) => setConfigEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <Label htmlFor="ticket-enabled" className="text-base">
                  Ticket system enabled
                </Label>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Auto-close time (hours)</Label>
                  <Input
                    type="number"
                    value={configAutoClose}
                    onChange={(e) => setConfigAutoClose(parseInt(e.target.value) || 0)}
                    min={1}
                    max={168}
                  />
                  <p className="text-sm text-gray-500">
                    Tickets are automatically closed after this period (default: 24 hours).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Maximum open tickets per user</Label>
                  <Input
                    type="number"
                    value={configMaxTickets}
                    onChange={(e) => setConfigMaxTickets(parseInt(e.target.value) || 0)}
                    min={1}
                    max={10}
                  />
                  <p className="text-sm text-gray-500">
                    Prevent spam by limiting simultaneous open tickets per member (default: 3).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Welcome message</Label>
                <Input
                  value={configWelcomeMessage}
                  onChange={(e) => setConfigWelcomeMessage(e.target.value)}
                  placeholder="Thanks for reaching out! Our team will respond shortly."
                />
                <p className="text-sm text-gray-500">
                  Shown at the top of every new ticket to greet the requester.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Archive Category</Label>
                <Select
                  value={configArchiveCategoryId}
                  onValueChange={setConfigArchiveCategoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select archive category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category (auto-create if needed)</SelectItem>
                    {discordCategories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  Archived tickets will be moved to this category. If not set, a category will be created automatically when needed.
                </p>
              </div>

              <div className="space-y-4 border-t pt-6">
                <div>
                  <h3 className="text-lg font-semibold">Ticket panel appearance</h3>
                  <p className="text-sm text-gray-500">
                    Customise the embed and button that /ticket-setup posts in Discord.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Panel title</Label>
                    <Input
                      value={configPanelTitle}
                      onChange={(e) => setConfigPanelTitle(e.target.value)}
                      placeholder="🎫 Need help from the team?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Embed color (hex)</Label>
                    <Input
                      value={configPanelColor}
                      onChange={(e) => setConfigPanelColor(e.target.value)}
                      placeholder="#5865F2"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Panel description</Label>
                    <Textarea
                      value={configPanelDescription}
                      onChange={(e) => setConfigPanelDescription(e.target.value)}
                      placeholder="Click the button below to open a private support ticket with our staff."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Footer text</Label>
                    <Input
                      value={configPanelFooter}
                      onChange={(e) => setConfigPanelFooter(e.target.value)}
                      placeholder="Support Tickets"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Thumbnail URL</Label>
                    <Input
                      value={configPanelThumbnail}
                      onChange={(e) => setConfigPanelThumbnail(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Image URL</Label>
                    <Input
                      value={configPanelImage}
                      onChange={(e) => setConfigPanelImage(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Button label</Label>
                    <Input
                      value={configPanelButtonLabel}
                      onChange={(e) => setConfigPanelButtonLabel(e.target.value)}
                      placeholder="Open Ticket"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Button emoji</Label>
                    <Input
                      value={configPanelButtonEmoji}
                      onChange={(e) => setConfigPanelButtonEmoji(e.target.value)}
                      placeholder="🎫"
                      maxLength={8}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={fetchTickets}>
                  Reset
                </Button>
                <Button onClick={saveConfig} disabled={configSaving}>
                  {configSaving ? 'Saving…' : '💾 Save changes'}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-blue-50 dark:bg-blue-900/20">
            <h3 className="font-semibold mb-2">ℹ️ Setup in Discord</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Quick reminders for rolling the ticket panel out to your community:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>Run <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">/ticket-setup</code> in the target server.</li>
              <li>The bot will create the support category (🎫 SUPPORT) and panel channel if needed.</li>
              <li>Members can open tickets by pressing the button in the panel.</li>
              <li>Moderators can claim, close, and manage tickets directly in Discord.</li>
            </ol>
          </Card>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">📊 Ticket Statistics</h2>
                <Button asChild>
                  <Link href={`/comcraft/dashboard/${guildId}/tickets/analytics`}>
                    View analytics →
                  </Link>
                </Button>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Total tickets
                  </div>
                  <div className="text-3xl font-bold">{statistics.total}</div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Active tickets
                  </div>
                  <div className="text-3xl font-bold text-green-600">
                    {statistics.open + statistics.claimed}
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Resolved tickets
                  </div>
                  <div className="text-3xl font-bold text-blue-600">
                    {statistics.closed}
                  </div>
                </div>
              </div>

              {/* Rating Statistics */}
              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">⭐ Satisfaction Ratings</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Average Rating
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-3xl font-bold text-yellow-600">
                        {ratingStats.average > 0 ? ratingStats.average.toFixed(1) : 'N/A'}
                      </div>
                      {ratingStats.average > 0 && (
                        <div className="text-lg">⭐</div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {ratingStats.total} {ratingStats.total === 1 ? 'rating' : 'ratings'}
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Rating Distribution
                    </div>
                    <div className="space-y-2">
                      {[5, 4, 3, 2, 1].map(rating => (
                        <div key={rating} className="flex items-center gap-2">
                          <span className="text-sm w-8">{rating}⭐</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-yellow-500 h-2 rounded-full"
                              style={{
                                width: ratingStats.total > 0
                                  ? `${(ratingStats.distribution[rating as keyof typeof ratingStats.distribution] / ratingStats.total) * 100}%`
                                  : '0%'
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400 w-8 text-right">
                            {ratingStats.distribution[rating as keyof typeof ratingStats.distribution]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center text-gray-500">
                <p>Visit the analytics page for detailed charts and staff metrics.</p>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Close Ticket Dialog */}
      {selectedTicket && (
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close ticket</DialogTitle>
              <DialogDescription>
                Are you sure you want to close ticket {selectedTicket.ticket_number}?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Reason (optional)</Label>
                <Input
                  id="close-reason"
                  placeholder="Issue resolved"
                  defaultValue="Resolved from dashboard"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    const reason = (document.getElementById('close-reason') as HTMLInputElement)?.value;
                    closeTicket(selectedTicket.id, reason);
                  }}
                  disabled={actionLoading}
                >
                  🔒 Close ticket
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

