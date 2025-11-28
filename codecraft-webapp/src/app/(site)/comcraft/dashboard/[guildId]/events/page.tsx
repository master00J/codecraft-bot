'use client';

/**
 * Events Management Dashboard Page
 * Comprehensive event management with RSVP, reminders, and more
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { 
  Loader2, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Bell,
  CheckCircle,
  XCircle,
  HelpCircle,
  Save,
  X
} from 'lucide-react';

interface EventRSVP {
  id: string;
  user_id: string;
  discord_tag: string;
  status: 'going' | 'maybe' | 'not_going';
  notes?: string;
  rsvp_at: string;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time?: string;
  timezone: string;
  location?: string;
  channel_id?: string;
  voice_channel_id?: string;
  image_url?: string;
  color: string;
  max_participants?: number;
  is_recurring: boolean;
  recurrence_pattern?: string;
  recurrence_end_date?: string;
  requires_rsvp: boolean;
  rsvp_deadline?: string;
  auto_remind: boolean;
  reminder_times: number[];
  role_mentions: string[];
  role_requirements: string[];
  auto_create_voice: boolean;
  auto_delete_after_end: boolean;
  is_active: boolean;
  is_published: boolean;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  event_rsvps?: EventRSVP[];
}

export default function EventsPage() {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'general',
    start_time: '',
    end_time: '',
    timezone: 'UTC',
    location: '',
    channel_id: 'none',
    voice_channel_id: 'none',
    image_url: '',
    color: '#5865F2',
    max_participants: '',
    is_recurring: false,
    recurrence_pattern: 'weekly',
    requires_rsvp: true,
    rsvp_deadline: '',
    auto_remind: true,
    reminder_times: [60, 15],
    role_mentions: [] as string[],
    role_requirements: [] as string[],
    auto_create_voice: false,
    auto_delete_after_end: false,
    is_published: true
  });

  useEffect(() => {
    fetchData();
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsRes, channelsRes, rolesRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/events?upcoming=true`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`)
      ]);

      const eventsData = await eventsRes.json();
      const channelsData = await channelsRes.json();
      const rolesData = await rolesRes.json();

      if (eventsData.success) {
        setEvents(eventsData.events || []);
      }

      if (channelsData.channels?.text) {
        setChannels(channelsData.channels.text);
      }

      if (rolesData.roles) {
        setRoles(rolesData.roles);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load events',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      event_type: 'general',
      start_time: '',
      end_time: '',
      timezone: 'UTC',
      location: '',
      channel_id: 'none',
      voice_channel_id: 'none',
      image_url: '',
      color: '#5865F2',
      max_participants: '',
      is_recurring: false,
      recurrence_pattern: 'weekly',
      requires_rsvp: true,
      rsvp_deadline: '',
      auto_remind: true,
      reminder_times: [60, 15],
      role_mentions: [],
      role_requirements: [],
      auto_create_voice: false,
      auto_delete_after_end: false,
      is_published: true
    });
    setEditingEvent(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      start_time: new Date(event.start_time).toISOString().slice(0, 16),
      end_time: event.end_time ? new Date(event.end_time).toISOString().slice(0, 16) : '',
      timezone: event.timezone || 'UTC',
      location: event.location || '',
      channel_id: event.channel_id || 'none',
      voice_channel_id: event.voice_channel_id || 'none',
      image_url: event.image_url || '',
      color: event.color || '#5865F2',
      max_participants: event.max_participants?.toString() || '',
      is_recurring: event.is_recurring,
      recurrence_pattern: event.recurrence_pattern || 'weekly',
      requires_rsvp: event.requires_rsvp,
      rsvp_deadline: event.rsvp_deadline ? new Date(event.rsvp_deadline).toISOString().slice(0, 16) : '',
      auto_remind: event.auto_remind,
      reminder_times: event.reminder_times || [60, 15],
      role_mentions: event.role_mentions || [],
      role_requirements: event.role_requirements || [],
      auto_create_voice: event.auto_create_voice || false,
      auto_delete_after_end: event.auto_delete_after_end || false,
      is_published: event.is_published
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.start_time) {
      toast({
        title: 'Validation Error',
        description: 'Title and start time are required.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const url = editingEvent
        ? `/api/comcraft/guilds/${guildId}/events/${editingEvent.id}`
        : `/api/comcraft/guilds/${guildId}/events`;

      const method = editingEvent ? 'PATCH' : 'POST';

      const payload: any = {
        ...formData,
        channel_id: formData.channel_id === 'none' ? null : formData.channel_id,
        voice_channel_id: formData.voice_channel_id === 'none' ? null : formData.voice_channel_id,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        rsvp_deadline: formData.rsvp_deadline || null,
        end_time: formData.end_time || null
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: editingEvent ? 'Event updated successfully!' : 'Event created successfully!'
        });
        setShowDialog(false);
        resetForm();
        fetchData();
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error: any) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save event.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/events/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Event deleted successfully!'
        });
        fetchData();
      } else {
        throw new Error(result.error || 'Failed to delete');
      }
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete event.',
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRSVPCounts = (event: Event) => {
    const rsvps = event.event_rsvps || [];
    return {
      going: rsvps.filter(r => r.status === 'going').length,
      maybe: rsvps.filter(r => r.status === 'maybe').length,
      notGoing: rsvps.filter(r => r.status === 'not_going').length,
      total: rsvps.length
    };
  };

  const filteredEvents = events.filter(event => {
    const now = new Date();
    const startTime = new Date(event.start_time);

    if (activeTab === 'upcoming') {
      return startTime >= now && event.is_active;
    } else if (activeTab === 'past') {
      return startTime < now || !event.is_active;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-br from-background via-background to-primary/5">
      <div className="w-full px-4 py-8 space-y-6">
        {/* Header */}
        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                    📅
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
                    Event Management
                  </h1>
                  <p className="text-muted-foreground max-w-xl">
                    Create and manage events with RSVP, reminders, and automatic notifications.
                  </p>
                </div>
              </div>

              <Button onClick={openCreateDialog} className="bg-gradient-to-r from-primary to-purple-600">
                <Plus className="mr-2 h-4 w-4" />
                New Event
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">Upcoming Events</TabsTrigger>
            <TabsTrigger value="past">Past Events</TabsTrigger>
            <TabsTrigger value="all">All Events</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-6">
            {filteredEvents.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Events Found</h3>
                <p className="text-muted-foreground mb-4">
                  {activeTab === 'upcoming' 
                    ? 'Create your first event to get started!'
                    : 'No events match your filter.'}
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event
                </Button>
              </Card>
            ) : (
              filteredEvents.map((event) => {
                const rsvpCounts = getRSVPCounts(event);
                const isPast = new Date(event.start_time) < new Date();

                return (
                  <Card key={event.id} className="border-2 shadow-lg">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className="capitalize">
                              {event.event_type}
                            </Badge>
                            {event.is_recurring && (
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-600">
                                🔁 Recurring
                              </Badge>
                            )}
                            {!event.is_published && (
                              <Badge variant="outline" className="text-muted-foreground">
                                Draft
                              </Badge>
                            )}
                            {isPast && (
                              <Badge variant="outline" className="bg-gray-500/10 text-gray-600">
                                Past
                              </Badge>
                            )}
                          </div>
                          <h2 className="text-2xl font-bold mb-2">{event.title}</h2>
                          {event.description && (
                            <p className="text-muted-foreground mb-4">{event.description}</p>
                          )}
                          
                          <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold">Start:</span>
                              <span>{formatDate(event.start_time)}</span>
                            </div>
                            {event.end_time && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold">End:</span>
                                <span>{formatDate(event.end_time)}</span>
                              </div>
                            )}
                            {event.location && (
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>{event.location}</span>
                              </div>
                            )}
                            {event.max_participants && (
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>{rsvpCounts.going}/{event.max_participants} participants</span>
                              </div>
                            )}
                          </div>

                          {event.requires_rsvp && (
                            <div className="flex items-center gap-4 text-sm mb-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="font-semibold text-green-600">{rsvpCounts.going} Going</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <HelpCircle className="h-4 w-4 text-yellow-500" />
                                <span className="font-semibold text-yellow-600">{rsvpCounts.maybe} Maybe</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="font-semibold text-red-600">{rsvpCounts.notGoing} Not Going</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => openEditDialog(event)}
                            variant="outline"
                            size="sm"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDelete(event.id)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </DialogTitle>
              <DialogDescription>
                {editingEvent ? 'Update event details' : 'Create a new event with RSVP and reminders'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Event Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Community Gaming Night"
                  />
                </div>

                <div>
                  <Label htmlFor="event_type">Event Type</Label>
                  <Select
                    value={formData.event_type}
                    onValueChange={(value) => setFormData({ ...formData, event_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="gaming">Gaming</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="tournament">Tournament</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="color">Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Event description..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Date & Time *</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="end_time">End Date & Time</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="Europe/Brussels">Europe/Brussels (CET)</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Voice channel, external link, etc."
                  />
                </div>
              </div>

              {/* Channels */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="channel_id">Announcement Channel</Label>
                  <Select
                    value={formData.channel_id}
                    onValueChange={(value) => setFormData({ ...formData, channel_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">System Channel (Default)</SelectItem>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          #{channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="voice_channel_id">Voice Channel</Label>
                  <Select
                    value={formData.voice_channel_id}
                    onValueChange={(value) => setFormData({ ...formData, voice_channel_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {channels.filter(c => c.type === 2).map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* RSVP Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Label htmlFor="requires_rsvp">Require RSVP</Label>
                  <Switch
                    id="requires_rsvp"
                    checked={formData.requires_rsvp}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_rsvp: checked })}
                  />
                </div>

                {formData.requires_rsvp && (
                  <>
                    <div>
                      <Label htmlFor="max_participants">Max Participants</Label>
                      <Input
                        id="max_participants"
                        type="number"
                        value={formData.max_participants}
                        onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                        placeholder="Leave empty for unlimited"
                      />
                    </div>

                    <div>
                      <Label htmlFor="rsvp_deadline">RSVP Deadline</Label>
                      <Input
                        id="rsvp_deadline"
                        type="datetime-local"
                        value={formData.rsvp_deadline}
                        onChange={(e) => setFormData({ ...formData, rsvp_deadline: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Reminders */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Label htmlFor="auto_remind">Auto Remind</Label>
                  <Switch
                    id="auto_remind"
                    checked={formData.auto_remind}
                    onCheckedChange={(checked) => setFormData({ ...formData, auto_remind: checked })}
                  />
                </div>

                {formData.auto_remind && (
                  <div>
                    <Label>Reminder Times (minutes before event)</Label>
                    <div className="flex gap-2 mt-2">
                      {formData.reminder_times.map((time, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={time}
                            onChange={(e) => {
                              const newTimes = [...formData.reminder_times];
                              newTimes[index] = parseInt(e.target.value) || 0;
                              setFormData({ ...formData, reminder_times: newTimes });
                            }}
                            className="w-20"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newTimes = formData.reminder_times.filter((_, i) => i !== index);
                              setFormData({ ...formData, reminder_times: newTimes });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData({ 
                            ...formData, 
                            reminder_times: [...formData.reminder_times, 60] 
                          });
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Role Mentions */}
              <div>
                <Label>Roles to Mention</Label>
                <Select
                  value=""
                  onValueChange={(roleId) => {
                    if (!formData.role_mentions.includes(roleId)) {
                      setFormData({ 
                        ...formData, 
                        role_mentions: [...formData.role_mentions, roleId] 
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add a role to mention..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter(role => !formData.role_mentions.includes(role.id))
                      .map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          @{role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.role_mentions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.role_mentions.map((roleId) => {
                        const role = roles.find(r => r.id === roleId);
                        return role ? (
                          <Badge key={roleId} variant="secondary" className="flex items-center gap-1">
                            @{role.name}
                            <button
                              onClick={() => {
                                setFormData({ 
                                  ...formData, 
                                  role_mentions: formData.role_mentions.filter(id => id !== roleId) 
                                });
                              }}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

              {/* Advanced Options */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label htmlFor="is_recurring">Recurring Event</Label>
                  <Switch
                    id="is_recurring"
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                  />
                </div>

                {formData.is_recurring && (
                  <div>
                    <Label htmlFor="recurrence_pattern">Recurrence Pattern</Label>
                    <Select
                      value={formData.recurrence_pattern}
                      onValueChange={(value) => setFormData({ ...formData, recurrence_pattern: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Label htmlFor="is_published">Publish Immediately</Label>
                  <Switch
                    id="is_published"
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                </div>

                <div>
                  <Label htmlFor="image_url">Event Image URL</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.png"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-purple-600">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {editingEvent ? 'Update' : 'Create'}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

