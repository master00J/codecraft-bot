'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Shield, Brain, Zap, Users, Ban, Hash, Plus, Trash2 } from 'lucide-react';

interface ModerationConfig {
  automod_enabled: boolean;
  filter_spam: boolean;
  filter_links: boolean;
  filter_invites: boolean;
  filter_caps: boolean;
  filter_mention_spam: boolean;
  filter_emoji_spam: boolean;
  filter_duplicates: boolean;
  filter_words: string[];
  ai_moderation_enabled: boolean;
  spam_messages: number;
  spam_interval: number;
  caps_threshold: number;
  caps_min_length: number;
  max_mentions: number;
  max_emojis: number;
  duplicate_time_window: number;
  auto_slowmode_enabled: boolean;
  auto_slowmode_duration: number;
  auto_slowmode_reset: number;
  anti_raid_enabled: boolean;
  raid_time_window: number;
  raid_max_joins: number;
  raid_kick_new_members: boolean;
  auto_ban_enabled: boolean;
  auto_ban_threshold: number;
  auto_ban_duration: number | null;
  muted_role_id: string | null;
  mod_log_channel_id: string | null;
  mod_role_id: string | null;
}

export default function ModerationPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ModerationConfig | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [badWordsInput, setBadWordsInput] = useState('');
  const [channelRules, setChannelRules] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [guildId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [configRes, channelsRes, rolesRes, channelRulesRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/moderation`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`),
        fetch(`/api/comcraft/guilds/${guildId}/moderation/channels`)
      ]);

      const [configData, channelsData, rolesData, channelRulesData] = await Promise.all([
        configRes.json(),
        channelsRes.json(),
        rolesRes.json(),
        channelRulesRes.json()
      ]);

      if (configData.config) {
        setConfig(configData.config);
        setBadWordsInput((configData.config.filter_words || []).join(', '));
      }

      setChannels(channelsData.channels?.text || []);
      setRoles(rolesData.roles || []);
      setChannelRules(channelRulesData.rules || []);
    } catch (error: any) {
      console.error('Error loading moderation config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load moderation configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveChannelRule(rule: any) {
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/moderation/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      const data = await res.json();
      if (data.success) {
        setChannelRules(channelRules.map(r => r.id === rule.id ? data.rule : r));
        toast({
          title: 'Success',
          description: 'Channel rule updated',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update rule',
        variant: 'destructive'
      });
    }
  }

  async function saveConfig() {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/moderation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          filter_words: badWordsInput.split(',').map(w => w.trim()).filter(Boolean)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      toast({
        title: 'Success',
        description: 'Moderation configuration saved'
      });

      await fetchData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Failed to load moderation configuration</p>
          <Button onClick={fetchData} className="mt-4">Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-red-500/5 py-6 px-4 sm:px-6 lg:px-8">
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between mb-4">
          <Button asChild variant="ghost" size="sm" className="w-fit hover:bg-primary/10">
            <Link href={`/comcraft/dashboard/${guildId}`}>← Back to Dashboard</Link>
          </Button>
        </div>

        {/* Header */}
        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-500/10 via-purple-500/10 to-red-500/10 p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-background shadow-lg">
                    🛡️
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-purple-600 bg-clip-text text-transparent">
                    Moderation Control Center
                  </h1>
                  <p className="text-muted-foreground">
                    Advanced auto-moderation with AI-powered content filtering
                  </p>
                </div>
              </div>
              <Button 
                onClick={saveConfig} 
                disabled={saving}
                className="bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700"
              >
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

          {/* Stats */}
          <div className="p-6 border-b">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="border-2 bg-gradient-to-br from-red-500/5 to-transparent p-4">
                <div className="text-sm font-medium text-muted-foreground mb-1">Auto-Mod Status</div>
                <div className="text-2xl font-bold">
                  {config.automod_enabled ? (
                    <Badge className="bg-green-600 text-white">✓ Active</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </Card>
              <Card className="border-2 bg-gradient-to-br from-purple-500/5 to-transparent p-4">
                <div className="text-sm font-medium text-muted-foreground mb-1">AI Moderation</div>
                <div className="text-2xl font-bold">
                  {config.ai_moderation_enabled ? (
                    <Badge className="bg-blue-600 text-white">🤖 Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </Card>
              <Card className="border-2 bg-gradient-to-br from-blue-500/5 to-transparent p-4">
                <div className="text-sm font-medium text-muted-foreground mb-1">Anti-Raid</div>
                <div className="text-2xl font-bold">
                  {config.anti_raid_enabled ? (
                    <Badge className="bg-orange-600 text-white">🚨 Active</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </Card>
              <Card className="border-2 bg-gradient-to-br from-green-500/5 to-transparent p-4">
                <div className="text-sm font-medium text-muted-foreground mb-1">Auto-Ban</div>
                <div className="text-2xl font-bold">
                  {config.auto_ban_enabled ? (
                    <Badge className="bg-red-600 text-white">⚡ Active</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </Card>

        {/* Configuration Tabs */}
        <Tabs defaultValue="filters" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 bg-muted/50 p-2">
            <TabsTrigger value="filters">
              <Shield className="mr-2 h-4 w-4" />
              Filters
            </TabsTrigger>
            <TabsTrigger value="channels">
              <Hash className="mr-2 h-4 w-4" />
              Channels
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Brain className="mr-2 h-4 w-4" />
              AI Moderation
            </TabsTrigger>
            <TabsTrigger value="automation">
              <Zap className="mr-2 h-4 w-4" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="raid">
              <Users className="mr-2 h-4 w-4" />
              Anti-Raid
            </TabsTrigger>
            <TabsTrigger value="actions">
              <Ban className="mr-2 h-4 w-4" />
              Actions
            </TabsTrigger>
          </TabsList>

          {/* FILTERS TAB */}
          <TabsContent value="filters" className="space-y-6">
            <Card className="border-2 shadow-xl p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Content Filters</h2>
                  <p className="text-muted-foreground">
                    Configure which types of content should be automatically filtered
                  </p>
                </div>

                {/* Master Toggle */}
                <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-muted/20">
                  <div>
                    <div className="font-semibold text-lg">Enable Auto-Moderation</div>
                    <p className="text-sm text-muted-foreground">Master switch for all auto-mod features</p>
                  </div>
                  <Switch
                    checked={config.automod_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, automod_enabled: checked })}
                  />
                </div>

                {/* Filter Toggles */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Spam Messages</div>
                      <p className="text-xs text-muted-foreground">Detect rapid message sending</p>
                    </div>
                    <Switch
                      checked={config.filter_spam}
                      onCheckedChange={(checked) => setConfig({ ...config, filter_spam: checked })}
                      disabled={!config.automod_enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Links</div>
                      <p className="text-xs text-muted-foreground">Block unauthorized URLs</p>
                    </div>
                    <Switch
                      checked={config.filter_links}
                      onCheckedChange={(checked) => setConfig({ ...config, filter_links: checked })}
                      disabled={!config.automod_enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Discord Invites</div>
                      <p className="text-xs text-muted-foreground">Prevent server advertising</p>
                    </div>
                    <Switch
                      checked={config.filter_invites}
                      onCheckedChange={(checked) => setConfig({ ...config, filter_invites: checked })}
                      disabled={!config.automod_enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Excessive Caps</div>
                      <p className="text-xs text-muted-foreground">CAPS LOCK abuse</p>
                    </div>
                    <Switch
                      checked={config.filter_caps}
                      onCheckedChange={(checked) => setConfig({ ...config, filter_caps: checked })}
                      disabled={!config.automod_enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Mention Spam</div>
                      <p className="text-xs text-muted-foreground">Mass @mentions</p>
                    </div>
                    <Switch
                      checked={config.filter_mention_spam}
                      onCheckedChange={(checked) => setConfig({ ...config, filter_mention_spam: checked })}
                      disabled={!config.automod_enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Emoji Spam</div>
                      <p className="text-xs text-muted-foreground">Excessive emojis</p>
                    </div>
                    <Switch
                      checked={config.filter_emoji_spam}
                      onCheckedChange={(checked) => setConfig({ ...config, filter_emoji_spam: checked })}
                      disabled={!config.automod_enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Duplicate Messages</div>
                      <p className="text-xs text-muted-foreground">Repeated content</p>
                    </div>
                    <Switch
                      checked={config.filter_duplicates}
                      onCheckedChange={(checked) => setConfig({ ...config, filter_duplicates: checked })}
                      disabled={!config.automod_enabled}
                    />
                  </div>
                </div>

                {/* Thresholds */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold text-lg">Filter Thresholds</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Spam: Messages</Label>
                      <Input
                        type="number"
                        value={config.spam_messages}
                        onChange={(e) => setConfig({ ...config, spam_messages: parseInt(e.target.value) || 5 })}
                        min={2}
                        max={20}
                      />
                      <p className="text-xs text-muted-foreground">Max messages in time window</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Spam: Time Window (seconds)</Label>
                      <Input
                        type="number"
                        value={config.spam_interval}
                        onChange={(e) => setConfig({ ...config, spam_interval: parseInt(e.target.value) || 5 })}
                        min={1}
                        max={60}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Caps: Threshold (%)</Label>
                      <Input
                        type="number"
                        value={config.caps_threshold}
                        onChange={(e) => setConfig({ ...config, caps_threshold: parseInt(e.target.value) || 70 })}
                        min={50}
                        max={100}
                      />
                      <p className="text-xs text-muted-foreground">Percentage of caps to trigger</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Caps: Min Length</Label>
                      <Input
                        type="number"
                        value={config.caps_min_length}
                        onChange={(e) => setConfig({ ...config, caps_min_length: parseInt(e.target.value) || 10 })}
                        min={5}
                        max={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Mentions</Label>
                      <Input
                        type="number"
                        value={config.max_mentions}
                        onChange={(e) => setConfig({ ...config, max_mentions: parseInt(e.target.value) || 5 })}
                        min={1}
                        max={20}
                      />
                      <p className="text-xs text-muted-foreground">Max @mentions per message</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Max Emojis</Label>
                      <Input
                        type="number"
                        value={config.max_emojis}
                        onChange={(e) => setConfig({ ...config, max_emojis: parseInt(e.target.value) || 10 })}
                        min={5}
                        max={50}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Duplicate Time Window (seconds)</Label>
                      <Input
                        type="number"
                        value={config.duplicate_time_window}
                        onChange={(e) => setConfig({ ...config, duplicate_time_window: parseInt(e.target.value) || 60 })}
                        min={10}
                        max={300}
                      />
                    </div>
                  </div>
                </div>

                {/* Bad Words */}
                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-base font-semibold">Banned Words</Label>
                  <Textarea
                    value={badWordsInput}
                    onChange={(e) => setBadWordsInput(e.target.value)}
                    placeholder="word1, word2, word3"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of words to filter. Case-insensitive.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* CHANNEL-SPECIFIC RULES TAB */}
          <TabsContent value="channels" className="space-y-6">
            <Card className="border-2 shadow-xl p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Channel-Specific Rules</h2>
                  <p className="text-muted-foreground">
                    Configure different moderation settings per channel. Override general settings for specific channels.
                  </p>
                </div>

                {/* Add New Rule */}
                <Card className="border-2 p-4 bg-muted/20">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-2">
                        <Label>Select Channel</Label>
                        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a channel..." />
                          </SelectTrigger>
                          <SelectContent>
                            {channels
                              .filter(ch => !channelRules.some(r => r.channel_id === ch.id))
                              .map(ch => (
                                <SelectItem key={ch.id} value={ch.id}>
                                  #{ch.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={async () => {
                          if (!selectedChannel) {
                            toast({
                              title: 'Error',
                              description: 'Please select a channel',
                              variant: 'destructive'
                            });
                            return;
                          }
                          const channel = channels.find(ch => ch.id === selectedChannel);
                          const newRule = {
                            channel_id: selectedChannel,
                            channel_name: channel?.name || '',
                            enabled: true,
                            images_only: false,
                            text_only: false,
                            links_only: false,
                            no_links: false,
                            filter_spam: null,
                            filter_links: null,
                            filter_invites: null,
                            filter_caps: null,
                            filter_mention_spam: null,
                            filter_emoji_spam: null,
                            filter_duplicates: null,
                            filter_words: null
                          };
                          
                          try {
                            const res = await fetch(`/api/comcraft/guilds/${guildId}/moderation/channels`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(newRule)
                            });
                            const data = await res.json();
                            if (data.success) {
                              setChannelRules([...channelRules, data.rule]);
                              setSelectedChannel('');
                              toast({
                                title: 'Success',
                                description: 'Channel rule created',
                              });
                            }
                          } catch (error) {
                            toast({
                              title: 'Error',
                              description: 'Failed to create rule',
                              variant: 'destructive'
                            });
                          }
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Rule
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Existing Rules */}
                {channelRules.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Hash className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No channel-specific rules configured</p>
                    <p className="text-sm mt-2">Add a rule above to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {channelRules.map((rule) => {
                      const channel = channels.find(ch => ch.id === rule.channel_id);
                      return (
                        <Card key={rule.id} className="border-2 p-4">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="font-semibold text-lg">
                                #{channel?.name || rule.channel_name || 'Unknown Channel'}
                              </h3>
                              <p className="text-sm text-muted-foreground">Channel-specific moderation rules</p>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await fetch(
                                    `/api/comcraft/guilds/${guildId}/moderation/channels?channel_id=${rule.channel_id}`,
                                    { method: 'DELETE' }
                                  );
                                  const data = await res.json();
                                  if (data.success) {
                                    setChannelRules(channelRules.filter(r => r.id !== rule.id));
                                    toast({
                                      title: 'Success',
                                      description: 'Channel rule deleted',
                                    });
                                  }
                                } catch (error) {
                                  toast({
                                    title: 'Error',
                                    description: 'Failed to delete rule',
                                    variant: 'destructive'
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="space-y-4">
                            {/* Content Restrictions */}
                            <div>
                              <Label className="text-base font-semibold mb-2 block">Content Restrictions</Label>
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <div className="font-medium">Images Only</div>
                                    <p className="text-xs text-muted-foreground">Only allow images, block text</p>
                                  </div>
                                  <Switch
                                    checked={rule.images_only || false}
                                    onCheckedChange={async (checked) => {
                                      const updated = { ...rule, images_only: checked };
                                      await saveChannelRule(updated);
                                    }}
                                  />
                                </div>
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <div className="font-medium">Text Only</div>
                                    <p className="text-xs text-muted-foreground">Only allow text, block images</p>
                                  </div>
                                  <Switch
                                    checked={rule.text_only || false}
                                    onCheckedChange={async (checked) => {
                                      const updated = { ...rule, text_only: checked };
                                      await saveChannelRule(updated);
                                    }}
                                  />
                                </div>
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <div className="font-medium">Links Only</div>
                                    <p className="text-xs text-muted-foreground">Only allow messages with links</p>
                                  </div>
                                  <Switch
                                    checked={rule.links_only || false}
                                    onCheckedChange={async (checked) => {
                                      const updated = { ...rule, links_only: checked };
                                      await saveChannelRule(updated);
                                    }}
                                  />
                                </div>
                                <div className="flex items-center justify-between p-3 border rounded-lg">
                                  <div>
                                    <div className="font-medium">No Links</div>
                                    <p className="text-xs text-muted-foreground">Block all links</p>
                                  </div>
                                  <Switch
                                    checked={rule.no_links || false}
                                    onCheckedChange={async (checked) => {
                                      const updated = { ...rule, no_links: checked };
                                      await saveChannelRule(updated);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Filter Overrides */}
                            <div>
                              <Label className="text-base font-semibold mb-2 block">Filter Overrides (null = use general)</Label>
                              <div className="grid md:grid-cols-2 gap-3">
                                {[
                                  { key: 'filter_spam', label: 'Spam Filter', desc: 'Override spam detection' },
                                  { key: 'filter_links', label: 'Links Filter', desc: 'Override link blocking' },
                                  { key: 'filter_invites', label: 'Invites Filter', desc: 'Override invite blocking' },
                                  { key: 'filter_caps', label: 'Caps Filter', desc: 'Override caps detection' },
                                  { key: 'filter_mention_spam', label: 'Mention Spam', desc: 'Override mention spam' },
                                  { key: 'filter_emoji_spam', label: 'Emoji Spam', desc: 'Override emoji spam' },
                                  { key: 'filter_duplicates', label: 'Duplicates', desc: 'Override duplicate detection' },
                                  { key: 'filter_words', label: 'Word Filter', desc: 'Override word filter' }
                                ].map(({ key, label, desc }) => {
                                  const value = rule[key];
                                  return (
                                    <div key={key} className="p-3 border rounded-lg">
                                      <div className="font-medium text-sm mb-1">{label}</div>
                                      <p className="text-xs text-muted-foreground mb-2">{desc}</p>
                                      <Select
                                        value={value === null ? 'inherit' : value ? 'enabled' : 'disabled'}
                                        onValueChange={async (newValue) => {
                                          const updated = {
                                            ...rule,
                                            [key]: newValue === 'inherit' ? null : newValue === 'enabled'
                                          };
                                          await saveChannelRule(updated);
                                        }}
                                      >
                                        <SelectTrigger className="h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="inherit">Use General</SelectItem>
                                          <SelectItem value="enabled">Enabled</SelectItem>
                                          <SelectItem value="disabled">Disabled</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* AI MODERATION TAB */}
          <TabsContent value="ai" className="space-y-6">
            <Card className="border-2 shadow-xl p-6">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl">
                    🤖
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">AI-Powered Moderation</h2>
                    <p className="text-muted-foreground">
                      Use Claude/Gemini AI to detect toxic, hateful, and inappropriate content
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-blue-500/5">
                  <div>
                    <div className="font-semibold text-lg">Enable AI Content Filtering</div>
                    <p className="text-sm text-muted-foreground">
                      AI analyzes messages for toxicity, hate speech, harassment, violence, and NSFW content
                    </p>
                  </div>
                  <Switch
                    checked={config.ai_moderation_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, ai_moderation_enabled: checked })}
                    disabled={!config.automod_enabled}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-2 p-4 bg-gradient-to-br from-blue-500/5 to-transparent">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Detects</span>
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Toxic language</li>
                      <li>• Hate speech</li>
                      <li>• Harassment</li>
                      <li>• Violent content</li>
                      <li>• Sexual/NSFW content</li>
                      <li>• Advanced spam patterns</li>
                    </ul>
                  </Card>

                  <Card className="border-2 p-4 bg-gradient-to-br from-purple-500/5 to-transparent">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="text-blue-600">ℹ️</span>
                      <span>Requirements</span>
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• AI features enabled</li>
                      <li>• Valid API key configured</li>
                      <li>• Premium tier or higher</li>
                      <li>• Sufficient token quota</li>
                    </ul>
                  </Card>
                </div>

                <div className="p-4 border-2 border-dashed rounded-lg bg-yellow-500/5">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> AI moderation uses your monthly token quota. Each message check costs ~100-200 tokens.
                    Monitor usage in the AI dashboard.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* AUTOMATION TAB */}
          <TabsContent value="automation" className="space-y-6">
            <Card className="border-2 shadow-xl p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Automated Actions</h2>
                  <p className="text-muted-foreground">
                    Configure automatic responses to violations
                  </p>
                </div>

                {/* Auto-Slowmode */}
                <div className="space-y-4 p-4 border-2 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-lg">Auto-Slowmode</div>
                      <p className="text-sm text-muted-foreground">
                        Automatically apply slowmode when spam is detected
                      </p>
                    </div>
                    <Switch
                      checked={config.auto_slowmode_enabled}
                      onCheckedChange={(checked) => setConfig({ ...config, auto_slowmode_enabled: checked })}
                      disabled={!config.automod_enabled}
                    />
                  </div>

                  {config.auto_slowmode_enabled && (
                    <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label>Slowmode Duration (seconds)</Label>
                        <Input
                          type="number"
                          value={config.auto_slowmode_duration}
                          onChange={(e) => setConfig({ ...config, auto_slowmode_duration: parseInt(e.target.value) || 5 })}
                          min={1}
                          max={21600}
                        />
                        <p className="text-xs text-muted-foreground">Rate limit per user</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Reset After (seconds)</Label>
                        <Input
                          type="number"
                          value={config.auto_slowmode_reset}
                          onChange={(e) => setConfig({ ...config, auto_slowmode_reset: parseInt(e.target.value) || 300 })}
                          min={60}
                          max={3600}
                        />
                        <p className="text-xs text-muted-foreground">Time until slowmode is removed</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto-Ban */}
                <div className="space-y-4 p-4 border-2 rounded-lg bg-red-500/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-lg">Auto-Ban on Warnings</div>
                      <p className="text-sm text-muted-foreground">
                        Automatically ban users after reaching warning threshold
                      </p>
                    </div>
                    <Switch
                      checked={config.auto_ban_enabled}
                      onCheckedChange={(checked) => setConfig({ ...config, auto_ban_enabled: checked })}
                    />
                  </div>

                  {config.auto_ban_enabled && (
                    <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label>Warning Threshold</Label>
                        <Input
                          type="number"
                          value={config.auto_ban_threshold}
                          onChange={(e) => setConfig({ ...config, auto_ban_threshold: parseInt(e.target.value) || 3 })}
                          min={2}
                          max={10}
                        />
                        <p className="text-xs text-muted-foreground">Warnings before auto-ban</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Ban Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={config.auto_ban_duration || ''}
                          onChange={(e) => setConfig({ ...config, auto_ban_duration: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="Leave empty for permanent"
                          min={1}
                        />
                        <p className="text-xs text-muted-foreground">Empty = permanent ban</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ANTI-RAID TAB */}
          <TabsContent value="raid" className="space-y-6">
            <Card className="border-2 shadow-xl p-6">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-xl">
                    🚨
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Anti-Raid Protection</h2>
                    <p className="text-muted-foreground">
                      Detect and respond to coordinated raid attempts
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-orange-500/5">
                  <div>
                    <div className="font-semibold text-lg">Enable Anti-Raid</div>
                    <p className="text-sm text-muted-foreground">
                      Monitor join patterns and lock down server during raids
                    </p>
                  </div>
                  <Switch
                    checked={config.anti_raid_enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, anti_raid_enabled: checked })}
                  />
                </div>

                {config.anti_raid_enabled && (
                  <>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Time Window (seconds)</Label>
                        <Input
                          type="number"
                          value={config.raid_time_window}
                          onChange={(e) => setConfig({ ...config, raid_time_window: parseInt(e.target.value) || 10 })}
                          min={5}
                          max={60}
                        />
                        <p className="text-xs text-muted-foreground">Detection window</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Max Joins</Label>
                        <Input
                          type="number"
                          value={config.raid_max_joins}
                          onChange={(e) => setConfig({ ...config, raid_max_joins: parseInt(e.target.value) || 5 })}
                          min={3}
                          max={20}
                        />
                        <p className="text-xs text-muted-foreground">Joins to trigger raid mode</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Kick New Members</Label>
                        <Switch
                          checked={config.raid_kick_new_members}
                          onCheckedChange={(checked) => setConfig({ ...config, raid_kick_new_members: checked })}
                        />
                        <p className="text-xs text-muted-foreground">Auto-kick during raid</p>
                      </div>
                    </div>

                    <div className="p-4 border-2 border-dashed rounded-lg bg-red-500/5">
                      <h3 className="font-semibold mb-2">⚠️ Raid Response Actions</h3>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Removes @everyone send message permissions</li>
                        <li>• Pings mod team with alert</li>
                        <li>• Optionally kicks new joiners</li>
                        <li>• Logs raid attempt to mod channel</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* ACTIONS TAB */}
          <TabsContent value="actions" className="space-y-6">
            <Card className="border-2 shadow-xl p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Moderation Settings</h2>
                  <p className="text-muted-foreground">
                    Configure roles and channels for moderation actions
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Muted Role</Label>
                    <Select
                      value={config.muted_role_id || 'none'}
                      onValueChange={(value) => setConfig({ ...config, muted_role_id: value === 'none' ? null : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select muted role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No role selected</SelectItem>
                        {roles.map((role: any) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Role assigned to muted users (remove send permissions)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Mod Log Channel</Label>
                    <Select
                      value={config.mod_log_channel_id || 'none'}
                      onValueChange={(value) => setConfig({ ...config, mod_log_channel_id: value === 'none' ? null : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select log channel" />
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
                      Channel where moderation actions are logged
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Moderator Role</Label>
                    <Select
                      value={config.mod_role_id || 'none'}
                      onValueChange={(value) => setConfig({ ...config, mod_role_id: value === 'none' ? null : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select mod role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No role selected</SelectItem>
                        {roles.map((role: any) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Role to ping for raid alerts and urgent issues
                    </p>
                  </div>
                </div>

                <div className="p-4 border-2 border-dashed rounded-lg">
                  <h3 className="font-semibold mb-2">💡 Setup Tips</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Create a "Muted" role with no send message permissions</li>
                    <li>• Set up a private #mod-logs channel for staff only</li>
                    <li>• Assign a moderator role for raid alerts</li>
                    <li>• Test filters in a private channel first</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
