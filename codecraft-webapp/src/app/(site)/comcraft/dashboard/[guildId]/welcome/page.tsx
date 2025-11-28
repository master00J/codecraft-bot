'use client';

/**
 * ComCraft Welcome System Dashboard
 * Fully customizable welcome messages, DMs, leave messages, and auto-roles
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Eye, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface WelcomeConfig {
  welcome_enabled: boolean;
  welcome_channel_id: string;
  welcome_message: string;
  welcome_embed_enabled: boolean;
  welcome_embed_title: string;
  welcome_embed_description: string;
  welcome_embed_color: string;
  welcome_embed_image_url: string;
  welcome_embed_thumbnail_url: string;
  welcome_embed_footer_text: string;
  welcome_embed_footer_icon_url: string;
  welcome_embed_author_name: string;
  welcome_embed_author_icon_url: string;
  welcome_embed_author_url: string;
  welcome_embed_fields: Array<{ name: string; value: string; inline: boolean }>;
  welcome_buttons_enabled: boolean;
  welcome_buttons: Array<{ label: string; url: string; style: string; emoji: string }>;
  welcome_dm_enabled: boolean;
  welcome_dm_message: string;
  welcome_dm_embed_enabled: boolean;
  welcome_dm_embed_title: string;
  welcome_dm_embed_description: string;
  welcome_dm_embed_color: string;
  welcome_dm_embed_image_url: string;
  leave_enabled: boolean;
  leave_channel_id: string;
  leave_message: string;
  leave_embed_enabled: boolean;
  leave_embed_title: string;
  leave_embed_description: string;
  leave_embed_color: string;
  leave_embed_image_url: string;
  leave_embed_thumbnail_url: string;
  leave_embed_footer_text: string;
  leave_embed_footer_icon_url: string;
  autorole_enabled: boolean;
  autorole_ids: string[];
  autorole_delay: number;
  autorole_remove_on_leave: boolean;
  autorole_ignore_bots: boolean;
  welcome_delete_after: number;
  welcome_mention_user: boolean;
  welcome_mention_roles: string[];
  welcome_mention_everyone: boolean;
  welcome_mention_here: boolean;
  welcome_stats_enabled: boolean;
  welcome_show_account_age: boolean;
  welcome_show_join_position: boolean;
}

export default function WelcomeDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [config, setConfig] = useState<Partial<WelcomeConfig>>({
    welcome_enabled: false,
    welcome_embed_enabled: false,
    welcome_embed_color: '#5865F2',
    welcome_embed_fields: [],
    welcome_buttons_enabled: false,
    welcome_buttons: [],
    welcome_dm_enabled: false,
    welcome_dm_embed_enabled: false,
    welcome_dm_embed_color: '#5865F2',
    leave_enabled: false,
    leave_embed_enabled: false,
    leave_embed_color: '#FF0000',
    autorole_enabled: false,
    autorole_ids: [],
    autorole_delay: 0,
    autorole_remove_on_leave: false,
    autorole_ignore_bots: false,
    welcome_delete_after: 0,
    welcome_mention_user: true,
    welcome_mention_roles: [],
    welcome_mention_everyone: false,
    welcome_mention_here: false,
    welcome_stats_enabled: false,
    welcome_show_account_age: false,
    welcome_show_join_position: true,
  });

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, channelsRes, rolesRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/welcome`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`)
      ]);

      const [configData, channelsData, rolesData] = await Promise.all([
        configRes.json(),
        channelsRes.json(),
        rolesRes.json()
      ]);

      if (configData.success && configData.config) {
        setConfig({
          ...config,
          ...configData.config,
          welcome_embed_fields: configData.config.welcome_embed_fields || [],
          welcome_buttons: configData.config.welcome_buttons || [],
          autorole_ids: configData.config.autorole_ids || [],
          welcome_mention_roles: configData.config.welcome_mention_roles || [],
        });
      }

      if (channelsData.success) {
        setChannels(channelsData.channels?.text || []);
      }

      if (rolesData.success) {
        setRoles(rolesData.roles || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load welcome configuration.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/welcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          updated_at: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Welcome configuration saved successfully!'
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save configuration.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPreview = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/welcome/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Test Message Sent',
          description: 'A test welcome message has been sent to the configured channel.'
        });
      } else {
        toast({
          title: 'Test Failed',
          description: result.error || 'Failed to send test message.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error testing preview:', error);
      toast({
        title: 'Error',
        description: 'Failed to send test message.',
        variant: 'destructive'
      });
    }
  };

  const addEmbedField = () => {
    setConfig({
      ...config,
      welcome_embed_fields: [
        ...(config.welcome_embed_fields || []),
        { name: 'Field Name', value: 'Field Value', inline: false }
      ]
    });
  };

  const removeEmbedField = (index: number) => {
    const fields = [...(config.welcome_embed_fields || [])];
    fields.splice(index, 1);
    setConfig({ ...config, welcome_embed_fields: fields });
  };

  const updateEmbedField = (index: number, field: 'name' | 'value' | 'inline', value: string | boolean) => {
    const fields = [...(config.welcome_embed_fields || [])];
    fields[index] = { ...fields[index], [field]: value };
    setConfig({ ...config, welcome_embed_fields: fields });
  };

  const addButton = () => {
    setConfig({
      ...config,
      welcome_buttons: [
        ...(config.welcome_buttons || []),
        { label: 'Button Label', url: 'https://example.com', style: 'primary', emoji: '' }
      ]
    });
  };

  const removeButton = (index: number) => {
    const buttons = [...(config.welcome_buttons || [])];
    buttons.splice(index, 1);
    setConfig({ ...config, welcome_buttons: buttons });
  };

  const updateButton = (index: number, field: string, value: string) => {
    const buttons = [...(config.welcome_buttons || [])];
    buttons[index] = { ...buttons[index], [field]: value };
    setConfig({ ...config, welcome_buttons: buttons });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Overview
          </Link>
        </Button>

        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                    👋
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
                    Welcome System
                  </h1>
                  <p className="text-muted-foreground max-w-xl">
                    Create fully customizable welcome messages, DMs, leave messages, and auto-roles. Make every new member feel at home!
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleTestPreview}
                  variant="outline"
                  className="bg-background/50"
                  disabled={!config.welcome_enabled || !config.welcome_channel_id}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Test Preview
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
                      Save Configuration
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="welcome" className="space-y-6">
          <TabsList className="w-full grid grid-cols-4 bg-muted/50 p-2 rounded-lg">
            <TabsTrigger value="welcome" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              👋 Welcome Message
            </TabsTrigger>
            <TabsTrigger value="dm" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              📨 Direct Message
            </TabsTrigger>
            <TabsTrigger value="leave" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              👋 Leave Message
            </TabsTrigger>
            <TabsTrigger value="autorole" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              🎭 Auto-Roles
            </TabsTrigger>
          </TabsList>

          {/* WELCOME MESSAGE TAB */}
          <TabsContent value="welcome" className="space-y-6">
            <Card className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Welcome Message Settings</h2>
                  <p className="text-muted-foreground">Configure how new members are welcomed to your server</p>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="welcome-enabled">Enable Welcome Messages</Label>
                  <Switch
                    id="welcome-enabled"
                    checked={config.welcome_enabled || false}
                    onCheckedChange={(checked) => setConfig({ ...config, welcome_enabled: checked })}
                  />
                </div>
              </div>

              <Separator />

              {config.welcome_enabled && (
                <>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="welcome-channel">Welcome Channel *</Label>
                      <Select
                        value={config.welcome_channel_id || ''}
                        onValueChange={(value) => setConfig({ ...config, welcome_channel_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a channel" />
                        </SelectTrigger>
                        <SelectContent>
                          {channels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              #{channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-3">
                      <Label htmlFor="welcome-embed-enabled">Use Embed Format</Label>
                      <Switch
                        id="welcome-embed-enabled"
                        checked={config.welcome_embed_enabled || false}
                        onCheckedChange={(checked) => setConfig({ ...config, welcome_embed_enabled: checked })}
                      />
                    </div>

                    {config.welcome_embed_enabled ? (
                      <>
                        <div>
                          <Label htmlFor="welcome-embed-title">Embed Title</Label>
                          <Input
                            id="welcome-embed-title"
                            value={config.welcome_embed_title || ''}
                            onChange={(e) => setConfig({ ...config, welcome_embed_title: e.target.value })}
                            placeholder="Welcome {user}!"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Variables: {'{user}'}, {'{username}'}, {'{tag}'}, {'{server}'}, {'{membercount}'}
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="welcome-embed-description">Embed Description</Label>
                          <Textarea
                            id="welcome-embed-description"
                            value={config.welcome_embed_description || ''}
                            onChange={(e) => setConfig({ ...config, welcome_embed_description: e.target.value })}
                            placeholder="Welcome to {server}! We're glad to have you here."
                            rows={4}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="welcome-embed-color">Embed Color</Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                id="welcome-embed-color"
                                value={config.welcome_embed_color || '#5865F2'}
                                onChange={(e) => setConfig({ ...config, welcome_embed_color: e.target.value })}
                                className="w-20"
                              />
                              <Input
                                value={config.welcome_embed_color || '#5865F2'}
                                onChange={(e) => setConfig({ ...config, welcome_embed_color: e.target.value })}
                                placeholder="#5865F2"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="welcome-embed-image">Embed Image URL</Label>
                            <Input
                              id="welcome-embed-image"
                              value={config.welcome_embed_image_url || ''}
                              onChange={(e) => setConfig({ ...config, welcome_embed_image_url: e.target.value })}
                              placeholder="https://example.com/image.png"
                            />
                          </div>
                          <div>
                            <Label htmlFor="welcome-embed-thumbnail">Embed Thumbnail URL</Label>
                            <Input
                              id="welcome-embed-thumbnail"
                              value={config.welcome_embed_thumbnail_url || ''}
                              onChange={(e) => setConfig({ ...config, welcome_embed_thumbnail_url: e.target.value })}
                              placeholder="https://example.com/thumbnail.png"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="welcome-embed-author-name">Author Name</Label>
                          <Input
                            id="welcome-embed-author-name"
                            value={config.welcome_embed_author_name || ''}
                            onChange={(e) => setConfig({ ...config, welcome_embed_author_name: e.target.value })}
                            placeholder="Server Name"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="welcome-embed-author-icon">Author Icon URL</Label>
                            <Input
                              id="welcome-embed-author-icon"
                              value={config.welcome_embed_author_icon_url || ''}
                              onChange={(e) => setConfig({ ...config, welcome_embed_author_icon_url: e.target.value })}
                              placeholder="https://example.com/icon.png"
                            />
                          </div>
                          <div>
                            <Label htmlFor="welcome-embed-author-url">Author URL</Label>
                            <Input
                              id="welcome-embed-author-url"
                              value={config.welcome_embed_author_url || ''}
                              onChange={(e) => setConfig({ ...config, welcome_embed_author_url: e.target.value })}
                              placeholder="https://example.com"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label>Custom Embed Fields</Label>
                            <Button onClick={addEmbedField} size="sm" variant="outline">
                              <Plus className="h-4 w-4 mr-2" />
                              Add Field
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {(config.welcome_embed_fields || []).map((field, index) => (
                              <Card key={index} className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 space-y-3">
                                    <Input
                                      placeholder="Field Name"
                                      value={field.name}
                                      onChange={(e) => updateEmbedField(index, 'name', e.target.value)}
                                    />
                                    <Textarea
                                      placeholder="Field Value"
                                      value={field.value}
                                      onChange={(e) => updateEmbedField(index, 'value', e.target.value)}
                                      rows={2}
                                    />
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={field.inline}
                                        onChange={(e) => updateEmbedField(index, 'inline', e.target.checked)}
                                        className="rounded"
                                      />
                                      <Label className="text-sm">Inline (display side-by-side)</Label>
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() => removeEmbedField(index)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="welcome-embed-footer-text">Footer Text</Label>
                            <Input
                              id="welcome-embed-footer-text"
                              value={config.welcome_embed_footer_text || ''}
                              onChange={(e) => setConfig({ ...config, welcome_embed_footer_text: e.target.value })}
                              placeholder="Powered by ComCraft"
                            />
                          </div>
                          <div>
                            <Label htmlFor="welcome-embed-footer-icon">Footer Icon URL</Label>
                            <Input
                              id="welcome-embed-footer-icon"
                              value={config.welcome_embed_footer_icon_url || ''}
                              onChange={(e) => setConfig({ ...config, welcome_embed_footer_icon_url: e.target.value })}
                              placeholder="https://example.com/icon.png"
                            />
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center gap-3">
                          <Label htmlFor="welcome-buttons-enabled">Enable Buttons</Label>
                          <Switch
                            id="welcome-buttons-enabled"
                            checked={config.welcome_buttons_enabled || false}
                            onCheckedChange={(checked) => setConfig({ ...config, welcome_buttons_enabled: checked })}
                          />
                        </div>

                        {config.welcome_buttons_enabled && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <Label>Action Buttons</Label>
                              <Button onClick={addButton} size="sm" variant="outline" disabled={(config.welcome_buttons || []).length >= 5}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Button
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {(config.welcome_buttons || []).map((button, index) => (
                                <Card key={index} className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1 space-y-3">
                                      <Input
                                        placeholder="Button Label"
                                        value={button.label}
                                        onChange={(e) => updateButton(index, 'label', e.target.value)}
                                      />
                                      <Input
                                        placeholder="Button URL"
                                        value={button.url}
                                        onChange={(e) => updateButton(index, 'url', e.target.value)}
                                      />
                                      <div className="grid grid-cols-2 gap-3">
                                        <Select
                                          value={button.style}
                                          onValueChange={(value) => updateButton(index, 'style', value)}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="primary">Primary (Blue)</SelectItem>
                                            <SelectItem value="secondary">Secondary (Grey)</SelectItem>
                                            <SelectItem value="success">Success (Green)</SelectItem>
                                            <SelectItem value="danger">Danger (Red)</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <Input
                                          placeholder="Emoji (optional)"
                                          value={button.emoji}
                                          onChange={(e) => updateButton(index, 'emoji', e.target.value)}
                                        />
                                      </div>
                                    </div>
                                    <Button
                                      onClick={() => removeButton(index)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <Label htmlFor="welcome-message">Welcome Message</Label>
                        <Textarea
                          id="welcome-message"
                          value={config.welcome_message || ''}
                          onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                          placeholder="Welcome {user} to {server}!"
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Variables: {'{user}'}, {'{username}'}, {'{tag}'}, {'{server}'}, {'{membercount}'}
                        </p>
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-semibold">Advanced Options</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="welcome-delete-after">Delete After (seconds)</Label>
                          <Input
                            id="welcome-delete-after"
                            type="number"
                            value={config.welcome_delete_after || 0}
                            onChange={(e) => setConfig({ ...config, welcome_delete_after: parseInt(e.target.value) || 0 })}
                            placeholder="0 = never delete"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Label htmlFor="welcome-mention-user">Mention User</Label>
                          <Switch
                            id="welcome-mention-user"
                            checked={config.welcome_mention_user !== false}
                            onCheckedChange={(checked) => setConfig({ ...config, welcome_mention_user: checked })}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="welcome-mention-everyone">Mention @everyone</Label>
                          <Switch
                            id="welcome-mention-everyone"
                            checked={config.welcome_mention_everyone || false}
                            onCheckedChange={(checked) => setConfig({ ...config, welcome_mention_everyone: checked })}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="welcome-mention-here">Mention @here</Label>
                          <Switch
                            id="welcome-mention-here"
                            checked={config.welcome_mention_here || false}
                            onCheckedChange={(checked) => setConfig({ ...config, welcome_mention_here: checked })}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="welcome-stats-enabled">Show Statistics</Label>
                          <Switch
                            id="welcome-stats-enabled"
                            checked={config.welcome_stats_enabled || false}
                            onCheckedChange={(checked) => setConfig({ ...config, welcome_stats_enabled: checked })}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="welcome-show-join-position">Show Join Position</Label>
                          <Switch
                            id="welcome-show-join-position"
                            checked={config.welcome_show_join_position !== false}
                            onCheckedChange={(checked) => setConfig({ ...config, welcome_show_join_position: checked })}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="welcome-show-account-age">Show Account Age</Label>
                          <Switch
                            id="welcome-show-account-age"
                            checked={config.welcome_show_account_age || false}
                            onCheckedChange={(checked) => setConfig({ ...config, welcome_show_account_age: checked })}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="welcome-mention-roles">Mention Roles</Label>
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (value && !(config.welcome_mention_roles || []).includes(value)) {
                              setConfig({
                                ...config,
                                welcome_mention_roles: [...(config.welcome_mention_roles || []), value]
                              });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select roles to mention" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                @{role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(config.welcome_mention_roles || []).map((roleId) => {
                            const role = roles.find((r) => r.id === roleId);
                            return (
                              <Badge key={roleId} variant="secondary" className="cursor-pointer" onClick={() => {
                                setConfig({
                                  ...config,
                                  welcome_mention_roles: (config.welcome_mention_roles || []).filter((id) => id !== roleId)
                                });
                              }}>
                                @{role?.name || roleId} ×
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </TabsContent>

          {/* DM TAB */}
          <TabsContent value="dm" className="space-y-6">
            <Card className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Direct Message Settings</h2>
                  <p className="text-muted-foreground">Send a private welcome message to new members</p>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="dm-enabled">Enable Welcome DMs</Label>
                  <Switch
                    id="dm-enabled"
                    checked={config.welcome_dm_enabled || false}
                    onCheckedChange={(checked) => setConfig({ ...config, welcome_dm_enabled: checked })}
                  />
                </div>
              </div>

              <Separator />

              {config.welcome_dm_enabled && (
                <>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="dm-embed-enabled">Use Embed Format</Label>
                    <Switch
                      id="dm-embed-enabled"
                      checked={config.welcome_dm_embed_enabled || false}
                      onCheckedChange={(checked) => setConfig({ ...config, welcome_dm_embed_enabled: checked })}
                    />
                  </div>

                  {config.welcome_dm_embed_enabled ? (
                    <>
                      <div>
                        <Label htmlFor="dm-embed-title">Embed Title</Label>
                        <Input
                          id="dm-embed-title"
                          value={config.welcome_dm_embed_title || ''}
                          onChange={(e) => setConfig({ ...config, welcome_dm_embed_title: e.target.value })}
                          placeholder="Welcome to {server}!"
                        />
                      </div>
                      <div>
                        <Label htmlFor="dm-embed-description">Embed Description</Label>
                        <Textarea
                          id="dm-embed-description"
                          value={config.welcome_dm_embed_description || ''}
                          onChange={(e) => setConfig({ ...config, welcome_dm_embed_description: e.target.value })}
                          placeholder="Thanks for joining {server}! Here are some important links..."
                          rows={4}
                        />
                      </div>
                      <div>
                        <Label htmlFor="dm-embed-color">Embed Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            id="dm-embed-color"
                            value={config.welcome_dm_embed_color || '#5865F2'}
                            onChange={(e) => setConfig({ ...config, welcome_dm_embed_color: e.target.value })}
                            className="w-20"
                          />
                          <Input
                            value={config.welcome_dm_embed_color || '#5865F2'}
                            onChange={(e) => setConfig({ ...config, welcome_dm_embed_color: e.target.value })}
                            placeholder="#5865F2"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="dm-embed-image">Embed Image URL</Label>
                        <Input
                          id="dm-embed-image"
                          value={config.welcome_dm_embed_image_url || ''}
                          onChange={(e) => setConfig({ ...config, welcome_dm_embed_image_url: e.target.value })}
                          placeholder="https://example.com/image.png"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label htmlFor="dm-message">DM Message</Label>
                      <Textarea
                        id="dm-message"
                        value={config.welcome_dm_message || ''}
                        onChange={(e) => setConfig({ ...config, welcome_dm_message: e.target.value })}
                        placeholder="Welcome to {server}! We're glad to have you."
                        rows={6}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Variables: {'{user}'}, {'{username}'}, {'{tag}'}, {'{server}'}, {'{membercount}'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </Card>
          </TabsContent>

          {/* LEAVE MESSAGE TAB */}
          <TabsContent value="leave" className="space-y-6">
            <Card className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Leave Message Settings</h2>
                  <p className="text-muted-foreground">Configure messages when members leave your server</p>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="leave-enabled">Enable Leave Messages</Label>
                  <Switch
                    id="leave-enabled"
                    checked={config.leave_enabled || false}
                    onCheckedChange={(checked) => setConfig({ ...config, leave_enabled: checked })}
                  />
                </div>
              </div>

              <Separator />

              {config.leave_enabled && (
                <>
                  <div>
                    <Label htmlFor="leave-channel">Leave Channel *</Label>
                    <Select
                      value={config.leave_channel_id || ''}
                      onValueChange={(value) => setConfig({ ...config, leave_channel_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3">
                    <Label htmlFor="leave-embed-enabled">Use Embed Format</Label>
                    <Switch
                      id="leave-embed-enabled"
                      checked={config.leave_embed_enabled || false}
                      onCheckedChange={(checked) => setConfig({ ...config, leave_embed_enabled: checked })}
                    />
                  </div>

                  {config.leave_embed_enabled ? (
                    <>
                      <div>
                        <Label htmlFor="leave-embed-title">Embed Title</Label>
                        <Input
                          id="leave-embed-title"
                          value={config.leave_embed_title || ''}
                          onChange={(e) => setConfig({ ...config, leave_embed_title: e.target.value })}
                          placeholder="{user} left the server"
                        />
                      </div>
                      <div>
                        <Label htmlFor="leave-embed-description">Embed Description</Label>
                        <Textarea
                          id="leave-embed-description"
                          value={config.leave_embed_description || ''}
                          onChange={(e) => setConfig({ ...config, leave_embed_description: e.target.value })}
                          placeholder="We're sorry to see you go!"
                          rows={4}
                        />
                      </div>
                      <div>
                        <Label htmlFor="leave-embed-color">Embed Color</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            id="leave-embed-color"
                            value={config.leave_embed_color || '#FF0000'}
                            onChange={(e) => setConfig({ ...config, leave_embed_color: e.target.value })}
                            className="w-20"
                          />
                          <Input
                            value={config.leave_embed_color || '#FF0000'}
                            onChange={(e) => setConfig({ ...config, leave_embed_color: e.target.value })}
                            placeholder="#FF0000"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="leave-embed-image">Embed Image URL</Label>
                          <Input
                            id="leave-embed-image"
                            value={config.leave_embed_image_url || ''}
                            onChange={(e) => setConfig({ ...config, leave_embed_image_url: e.target.value })}
                            placeholder="https://example.com/image.png"
                          />
                        </div>
                        <div>
                          <Label htmlFor="leave-embed-thumbnail">Embed Thumbnail URL</Label>
                          <Input
                            id="leave-embed-thumbnail"
                            value={config.leave_embed_thumbnail_url || ''}
                            onChange={(e) => setConfig({ ...config, leave_embed_thumbnail_url: e.target.value })}
                            placeholder="https://example.com/thumbnail.png"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="leave-embed-footer-text">Footer Text</Label>
                          <Input
                            id="leave-embed-footer-text"
                            value={config.leave_embed_footer_text || ''}
                            onChange={(e) => setConfig({ ...config, leave_embed_footer_text: e.target.value })}
                            placeholder="Goodbye!"
                          />
                        </div>
                        <div>
                          <Label htmlFor="leave-embed-footer-icon">Footer Icon URL</Label>
                          <Input
                            id="leave-embed-footer-icon"
                            value={config.leave_embed_footer_icon_url || ''}
                            onChange={(e) => setConfig({ ...config, leave_embed_footer_icon_url: e.target.value })}
                            placeholder="https://example.com/icon.png"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <Label htmlFor="leave-message">Leave Message</Label>
                      <Textarea
                        id="leave-message"
                        value={config.leave_message || ''}
                        onChange={(e) => setConfig({ ...config, leave_message: e.target.value })}
                        placeholder="{user} has left the server."
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Variables: {'{user}'}, {'{username}'}, {'{tag}'}, {'{server}'}, {'{membercount}'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </Card>
          </TabsContent>

          {/* AUTO-ROLE TAB */}
          <TabsContent value="autorole" className="space-y-6">
            <Card className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Auto-Role Settings</h2>
                  <p className="text-muted-foreground">Automatically assign roles to new members</p>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="autorole-enabled">Enable Auto-Roles</Label>
                  <Switch
                    id="autorole-enabled"
                    checked={config.autorole_enabled || false}
                    onCheckedChange={(checked) => setConfig({ ...config, autorole_enabled: checked })}
                  />
                </div>
              </div>

              <Separator />

              {config.autorole_enabled && (
                <>
                  <div>
                    <Label htmlFor="autorole-roles">Roles to Assign</Label>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value && !(config.autorole_ids || []).includes(value)) {
                          setConfig({
                            ...config,
                            autorole_ids: [...(config.autorole_ids || []), value]
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select roles to assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            @{role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(config.autorole_ids || []).map((roleId) => {
                        const role = roles.find((r) => r.id === roleId);
                        return (
                          <Badge key={roleId} variant="secondary" className="cursor-pointer" onClick={() => {
                            setConfig({
                              ...config,
                              autorole_ids: (config.autorole_ids || []).filter((id) => id !== roleId)
                            });
                          }}>
                            @{role?.name || roleId} ×
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="autorole-delay">Delay (seconds)</Label>
                    <Input
                      id="autorole-delay"
                      type="number"
                      value={config.autorole_delay || 0}
                      onChange={(e) => setConfig({ ...config, autorole_delay: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Wait X seconds before assigning roles (helps prevent raid abuse)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Label htmlFor="autorole-ignore-bots">Ignore Bots</Label>
                      <Switch
                        id="autorole-ignore-bots"
                        checked={config.autorole_ignore_bots || false}
                        onCheckedChange={(checked) => setConfig({ ...config, autorole_ignore_bots: checked })}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label htmlFor="autorole-remove-on-leave">Remove Roles on Leave</Label>
                      <Switch
                        id="autorole-remove-on-leave"
                        checked={config.autorole_remove_on_leave || false}
                        onCheckedChange={(checked) => setConfig({ ...config, autorole_remove_on_leave: checked })}
                      />
                    </div>
                  </div>
                </>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

