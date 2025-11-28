'use client';

/**
 * ComCraft Scheduled Messages Dashboard
 * Create and manage messages that are sent at programmed times
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Plus, Trash2, Edit2, Clock, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface ScheduledMessage {
  id: string;
  guild_id: string;
  channel_id: string;
  message_content: string | null;
  message_embed: any | null;
  schedule_type: 'daily' | 'weekly' | 'custom';
  schedule_time: string;
  schedule_days: number[] | null;
  schedule_cron: string | null;
  timezone: string;
  is_active: boolean;
  last_sent_at: string | null;
  next_send_at: string;
  times_sent: number;
  created_at: string;
}

export default function ScheduledMessages() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);

  // Form state
  const [channelId, setChannelId] = useState('');
  const [content, setContent] = useState('');
  const [useEmbed, setUseEmbed] = useState(false);
  const [embedTitle, setEmbedTitle] = useState('');
  const [embedDescription, setEmbedDescription] = useState('');
  const [embedColor, setEmbedColor] = useState('#5865F2');
  const [embedImageUrl, setEmbedImageUrl] = useState('');
  const [embedThumbnailUrl, setEmbedThumbnailUrl] = useState('');
  const [embedAuthorName, setEmbedAuthorName] = useState('');
  const [embedAuthorIconUrl, setEmbedAuthorIconUrl] = useState('');
  const [embedAuthorUrl, setEmbedAuthorUrl] = useState('');
  const [embedFooterText, setEmbedFooterText] = useState('');
  const [embedFooterIconUrl, setEmbedFooterIconUrl] = useState('');
  const [embedFields, setEmbedFields] = useState<Array<{ name: string; value: string; inline: boolean }>>([]);
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [timezone, setTimezone] = useState('Europe/Amsterdam');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadMessages();
  }, [guildId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/scheduled-messages`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages || []);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load scheduled messages',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load scheduled messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addEmbedField = () => {
    setEmbedFields([...embedFields, { name: 'Field Name', value: 'Field Value', inline: false }]);
  };

  const removeEmbedField = (index: number) => {
    const fields = [...embedFields];
    fields.splice(index, 1);
    setEmbedFields(fields);
  };

  const updateEmbedField = (index: number, field: 'name' | 'value' | 'inline', value: string | boolean) => {
    const fields = [...embedFields];
    fields[index] = { ...fields[index], [field]: value };
    setEmbedFields(fields);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Build embed object if useEmbed is true
      let embed: any = null;
      if (useEmbed) {
        embed = {
          title: embedTitle || undefined,
          description: embedDescription || undefined,
          color: parseInt(embedColor.replace('#', ''), 16) || undefined,
          image: embedImageUrl ? { url: embedImageUrl } : undefined,
          thumbnail: embedThumbnailUrl ? { url: embedThumbnailUrl } : undefined,
          author: embedAuthorName ? {
            name: embedAuthorName,
            icon_url: embedAuthorIconUrl || undefined,
            url: embedAuthorUrl || undefined
          } : undefined,
          footer: embedFooterText ? {
            text: embedFooterText,
            icon_url: embedFooterIconUrl || undefined
          } : undefined,
          fields: embedFields.length > 0 ? embedFields : undefined,
          timestamp: new Date().toISOString()
        };
        // Remove undefined values
        Object.keys(embed).forEach(key => {
          if (embed[key as keyof typeof embed] === undefined) {
            delete embed[key as keyof typeof embed];
          }
        });
      }

      const payload = {
        channelId,
        content: useEmbed ? null : content,
        embed: useEmbed ? embed : null,
        scheduleType,
        scheduleTime,
        scheduleDays: scheduleType === 'weekly' ? scheduleDays : null,
        scheduleCron: scheduleType === 'custom' ? '0 9 * * *' : null, // Placeholder, should be configurable
        timezone,
        isActive,
      };

      const url = editingMessage
        ? `/api/comcraft/guilds/${guildId}/scheduled-messages/${editingMessage.id}`
        : `/api/comcraft/guilds/${guildId}/scheduled-messages`;

      const method = editingMessage ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success || response.ok) {
        toast({
          title: 'Success',
          description: editingMessage ? 'Scheduled message updated' : 'Scheduled message created',
        });
        setIsDialogOpen(false);
        resetForm();
        loadMessages();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save scheduled message',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving message:', error);
      toast({
        title: 'Error',
        description: 'Failed to save scheduled message',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled message?')) return;

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/scheduled-messages/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success || response.ok) {
        toast({
          title: 'Success',
          description: 'Scheduled message deleted',
        });
        loadMessages();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete scheduled message',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete scheduled message',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (message: ScheduledMessage) => {
    setEditingMessage(message);
    setChannelId(message.channel_id);
    
    // Check if message has embed
    if (message.message_embed) {
      const embed = typeof message.message_embed === 'string' 
        ? JSON.parse(message.message_embed) 
        : message.message_embed;
      
      setUseEmbed(true);
      setEmbedTitle(embed.title || '');
      setEmbedDescription(embed.description || '');
      setEmbedColor(embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#5865F2');
      setEmbedImageUrl(embed.image?.url || '');
      setEmbedThumbnailUrl(embed.thumbnail?.url || '');
      setEmbedAuthorName(embed.author?.name || '');
      setEmbedAuthorIconUrl(embed.author?.icon_url || '');
      setEmbedAuthorUrl(embed.author?.url || '');
      setEmbedFooterText(embed.footer?.text || '');
      setEmbedFooterIconUrl(embed.footer?.icon_url || '');
      setEmbedFields(embed.fields || []);
      setContent('');
    } else {
      setUseEmbed(false);
      setContent(message.message_content || '');
      // Reset embed fields
      setEmbedTitle('');
      setEmbedDescription('');
      setEmbedColor('#5865F2');
      setEmbedImageUrl('');
      setEmbedThumbnailUrl('');
      setEmbedAuthorName('');
      setEmbedAuthorIconUrl('');
      setEmbedAuthorUrl('');
      setEmbedFooterText('');
      setEmbedFooterIconUrl('');
      setEmbedFields([]);
    }
    
    setScheduleType(message.schedule_type);
    setScheduleTime(message.schedule_time);
    setScheduleDays(message.schedule_days || []);
    setTimezone(message.timezone);
    setIsActive(message.is_active);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingMessage(null);
    setChannelId('');
    setContent('');
    setUseEmbed(false);
    setEmbedTitle('');
    setEmbedDescription('');
    setEmbedColor('#5865F2');
    setEmbedImageUrl('');
    setEmbedThumbnailUrl('');
    setEmbedAuthorName('');
    setEmbedAuthorIconUrl('');
    setEmbedAuthorUrl('');
    setEmbedFooterText('');
    setEmbedFooterIconUrl('');
    setEmbedFields([]);
    setScheduleType('daily');
    setScheduleTime('09:00');
    setScheduleDays([]);
    setTimezone('Europe/Amsterdam');
    setIsActive(true);
  };

  const formatNextSend = (dateString: string, messageTimezone: string = 'UTC') => {
    const date = new Date(dateString);
    // Format in the message's timezone
    return date.toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: messageTimezone,
    });
  };

  const getScheduleDescription = (message: ScheduledMessage) => {
    if (message.schedule_type === 'daily') {
      return `Daily at ${message.schedule_time}`;
    } else if (message.schedule_type === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayNames = message.schedule_days?.map(d => days[d]).join(', ') || 'N/A';
      return `Weekly on ${dayNames} at ${message.schedule_time}`;
    } else {
      return `Custom schedule: ${message.schedule_cron || 'N/A'}`;
    }
  };

  const dayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Scheduled Messages</h1>
          <p className="text-gray-400 mt-1">Automatically send messages at programmed times</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Message
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1f2e] border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingMessage ? 'Edit' : 'Create'} Scheduled Message</DialogTitle>
              <DialogDescription className="text-gray-400">
                Configure when and where to send automated messages
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="channelId">Channel ID</Label>
                <Input
                  id="channelId"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="123456789012345678"
                  className="bg-[#0f1419] border-gray-700"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="useEmbed"
                  checked={useEmbed}
                  onCheckedChange={setUseEmbed}
                />
                <Label htmlFor="useEmbed">Use Embed Format</Label>
              </div>

              <Tabs value={useEmbed ? 'embed' : 'text'} onValueChange={(v) => setUseEmbed(v === 'embed')}>
                <TabsList className="grid w-full grid-cols-2 bg-[#0f1419]">
                  <TabsTrigger value="text">Plain Text</TabsTrigger>
                  <TabsTrigger value="embed">Embed</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-4">
                  <div>
                    <Label htmlFor="content">Message Content</Label>
                    <Textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Enter your message here..."
                      className="bg-[#0f1419] border-gray-700 min-h-[100px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="embed" className="space-y-4">
                  <div>
                    <Label htmlFor="embedTitle">Embed Title</Label>
                    <Input
                      id="embedTitle"
                      value={embedTitle}
                      onChange={(e) => setEmbedTitle(e.target.value)}
                      placeholder="Embed Title"
                      className="bg-[#0f1419] border-gray-700"
                    />
                  </div>

                  <div>
                    <Label htmlFor="embedDescription">Embed Description</Label>
                    <Textarea
                      id="embedDescription"
                      value={embedDescription}
                      onChange={(e) => setEmbedDescription(e.target.value)}
                      placeholder="Embed description text..."
                      className="bg-[#0f1419] border-gray-700 min-h-[100px]"
                    />
                  </div>

                  <div>
                    <Label htmlFor="embedColor">Embed Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        id="embedColor"
                        value={embedColor}
                        onChange={(e) => setEmbedColor(e.target.value)}
                        className="w-20 h-10 bg-[#0f1419] border-gray-700"
                      />
                      <Input
                        value={embedColor}
                        onChange={(e) => setEmbedColor(e.target.value)}
                        placeholder="#5865F2"
                        className="bg-[#0f1419] border-gray-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="embedImageUrl">Image URL</Label>
                      <Input
                        id="embedImageUrl"
                        value={embedImageUrl}
                        onChange={(e) => setEmbedImageUrl(e.target.value)}
                        placeholder="https://example.com/image.png"
                        className="bg-[#0f1419] border-gray-700"
                      />
                    </div>
                    <div>
                      <Label htmlFor="embedThumbnailUrl">Thumbnail URL</Label>
                      <Input
                        id="embedThumbnailUrl"
                        value={embedThumbnailUrl}
                        onChange={(e) => setEmbedThumbnailUrl(e.target.value)}
                        placeholder="https://example.com/thumbnail.png"
                        className="bg-[#0f1419] border-gray-700"
                      />
                    </div>
                  </div>

                  <Separator className="bg-gray-700" />

                  <div>
                    <Label htmlFor="embedAuthorName">Author Name</Label>
                    <Input
                      id="embedAuthorName"
                      value={embedAuthorName}
                      onChange={(e) => setEmbedAuthorName(e.target.value)}
                      placeholder="Author Name"
                      className="bg-[#0f1419] border-gray-700"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="embedAuthorIconUrl">Author Icon URL</Label>
                      <Input
                        id="embedAuthorIconUrl"
                        value={embedAuthorIconUrl}
                        onChange={(e) => setEmbedAuthorIconUrl(e.target.value)}
                        placeholder="https://example.com/icon.png"
                        className="bg-[#0f1419] border-gray-700"
                      />
                    </div>
                    <div>
                      <Label htmlFor="embedAuthorUrl">Author URL</Label>
                      <Input
                        id="embedAuthorUrl"
                        value={embedAuthorUrl}
                        onChange={(e) => setEmbedAuthorUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="bg-[#0f1419] border-gray-700"
                      />
                    </div>
                  </div>

                  <Separator className="bg-gray-700" />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Custom Fields</Label>
                      <Button onClick={addEmbedField} size="sm" variant="outline" className="border-gray-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Field
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {embedFields.map((field, index) => (
                        <Card key={index} className="p-4 bg-[#0f1419] border-gray-700">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-3">
                              <Input
                                placeholder="Field Name"
                                value={field.name}
                                onChange={(e) => updateEmbedField(index, 'name', e.target.value)}
                                className="bg-[#1a1f2e] border-gray-600"
                              />
                              <Textarea
                                placeholder="Field Value"
                                value={field.value}
                                onChange={(e) => updateEmbedField(index, 'value', e.target.value)}
                                rows={2}
                                className="bg-[#1a1f2e] border-gray-600"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={field.inline}
                                  onChange={(e) => updateEmbedField(index, 'inline', e.target.checked)}
                                  className="rounded border-gray-600 bg-[#1a1f2e]"
                                />
                                <Label className="text-sm text-gray-300">Inline (display side-by-side)</Label>
                              </div>
                            </div>
                            <Button
                              onClick={() => removeEmbedField(index)}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                      {embedFields.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No fields added yet</p>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-gray-700" />

                  <div>
                    <Label htmlFor="embedFooterText">Footer Text</Label>
                    <Input
                      id="embedFooterText"
                      value={embedFooterText}
                      onChange={(e) => setEmbedFooterText(e.target.value)}
                      placeholder="Footer text"
                      className="bg-[#0f1419] border-gray-700"
                    />
                  </div>

                  <div>
                    <Label htmlFor="embedFooterIconUrl">Footer Icon URL</Label>
                    <Input
                      id="embedFooterIconUrl"
                      value={embedFooterIconUrl}
                      onChange={(e) => setEmbedFooterIconUrl(e.target.value)}
                      placeholder="https://example.com/footer-icon.png"
                      className="bg-[#0f1419] border-gray-700"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div>
                <Label htmlFor="scheduleType">Schedule Type</Label>
                <Select value={scheduleType} onValueChange={(v: any) => setScheduleType(v)}>
                  <SelectTrigger className="bg-[#0f1419] border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom (Cron)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="scheduleTime">Time (HH:MM)</Label>
                <Input
                  id="scheduleTime"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="bg-[#0f1419] border-gray-700"
                />
              </div>

              {scheduleType === 'weekly' && (
                <div>
                  <Label>Days of Week</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {dayOptions.map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`day-${day.value}`}
                          checked={scheduleDays.includes(day.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setScheduleDays([...scheduleDays, day.value]);
                            } else {
                              setScheduleDays(scheduleDays.filter(d => d !== day.value));
                            }
                          }}
                          className="rounded border-gray-700 bg-[#0f1419]"
                        />
                        <Label htmlFor={`day-${day.value}`} className="text-sm">{day.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Europe/Amsterdam"
                  className="bg-[#0f1419] border-gray-700"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingMessage ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : messages.length === 0 ? (
        <Card className="bg-[#1a1f2e] border-gray-800 p-12 text-center">
          <Clock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Scheduled Messages</h3>
          <p className="text-gray-400 mb-4">Create your first scheduled message to get started</p>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Create Message
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {messages.map((message) => (
            <Card key={message.id} className="bg-[#1a1f2e] border-gray-800 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      Channel: {message.channel_id}
                    </h3>
                    <Badge variant={message.is_active ? 'default' : 'secondary'}>
                      {message.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {message.message_embed ? (
                    <div className="mb-2">
                      <Badge variant="outline" className="mb-2">Embed Message</Badge>
                      {(() => {
                        const embed = typeof message.message_embed === 'string' 
                          ? JSON.parse(message.message_embed) 
                          : message.message_embed;
                        return (
                          <div className="text-gray-300">
                            {embed.title && <p className="font-semibold">{embed.title}</p>}
                            {embed.description && <p className="text-sm">{embed.description.substring(0, 100)}{embed.description.length > 100 ? '...' : ''}</p>}
                            {!embed.title && !embed.description && <p className="text-gray-500 italic">(Embed configured)</p>}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-gray-300 mb-2">{message.message_content || '(No content)'}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {getScheduleDescription(message)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Next: {formatNextSend(message.next_send_at, message.timezone)}
                    </span>
                    {message.times_sent > 0 && (
                      <span>Sent {message.times_sent} time(s)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(message)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(message.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

