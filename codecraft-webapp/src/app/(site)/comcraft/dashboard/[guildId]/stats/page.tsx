'use client';

/**
 * Stats Configuration Dashboard
 * Allows server owners to customize user statistics cards
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, BarChart3, Image, Palette, Eye, Calendar, Globe } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

interface StatsConfig {
  guild_id: string;
  card_background_url: string | null;
  card_border_color: string;
  card_theme: 'dark' | 'light';
  show_message_rank: boolean;
  show_voice_rank: boolean;
  show_top_channels: boolean;
  show_charts: boolean;
  show_1d: boolean;
  show_7d: boolean;
  show_14d: boolean;
  show_30d: boolean;
  lookback_days: number;
  timezone: string;
  enabled: boolean;
}

export default function StatsConfigPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<StatsConfig | null>(null);

  useEffect(() => {
    fetchData();
  }, [guildId]);

  async function fetchData() {
    setLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/stats`);
      const data = await response.json();

      if (data.config) {
        setConfig(data.config);
      }
    } catch (error: any) {
      console.error('Error loading stats config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load stats configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/stats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      toast({
        title: 'Success',
        description: 'Stats configuration saved successfully'
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
          <p className="text-muted-foreground">Failed to load stats configuration</p>
          <Button onClick={fetchData} className="mt-4">Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-500/5">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="w-fit hover:bg-primary/10 mb-2">
              <Link href={`/comcraft/dashboard/${guildId}`}>← Back to Dashboard</Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Statistics Configuration</h1>
            <p className="text-muted-foreground mt-1">
              Customize how user statistics cards are displayed
            </p>
          </div>
          <Button onClick={saveConfig} disabled={saving} size="lg">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="display">Display Options</TabsTrigger>
            <TabsTrigger value="periods">Time Periods</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  General Settings
                </CardTitle>
                <CardDescription>
                  Enable or disable statistics tracking for your server
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enabled">Enable Statistics</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow users to view their statistics using the /stats command
                    </p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={config.enabled}
                    onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Settings */}
          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Card Appearance
                </CardTitle>
                <CardDescription>
                  Customize the visual appearance of statistics cards
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="card_theme">Card Theme</Label>
                  <Select
                    value={config.card_theme}
                    onValueChange={(value: 'dark' | 'light') =>
                      setConfig({ ...config, card_theme: value })
                    }
                  >
                    <SelectTrigger id="card_theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Choose between dark or light theme for the statistics cards
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="border_color">Border Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="border_color"
                      type="color"
                      value={config.card_border_color}
                      onChange={(e) => setConfig({ ...config, card_border_color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={config.card_border_color}
                      onChange={(e) => setConfig({ ...config, card_border_color: e.target.value })}
                      placeholder="#5865F2"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Color of the border around the statistics card (hex format)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background_url">Background Image URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="background_url"
                      type="url"
                      value={config.card_background_url || ''}
                      onChange={(e) =>
                        setConfig({ ...config, card_background_url: e.target.value || null })
                      }
                      placeholder="https://example.com/image.png"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setConfig({ ...config, card_background_url: null })}
                    >
                      Clear
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Optional background image URL for statistics cards. Leave empty for default gradient.
                  </p>
                  {config.card_background_url && (
                    <div className="mt-2">
                      <img
                        src={config.card_background_url}
                        alt="Background preview"
                        className="h-24 w-full object-cover rounded border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Display Options */}
          <TabsContent value="display" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Display Options
                </CardTitle>
                <CardDescription>
                  Choose what information to display on statistics cards
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show_message_rank">Show Message Rank</Label>
                    <p className="text-sm text-muted-foreground">
                      Display the user's message rank on the server
                    </p>
                  </div>
                  <Switch
                    id="show_message_rank"
                    checked={config.show_message_rank}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, show_message_rank: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show_voice_rank">Show Voice Rank</Label>
                    <p className="text-sm text-muted-foreground">
                      Display the user's voice activity rank on the server
                    </p>
                  </div>
                  <Switch
                    id="show_voice_rank"
                    checked={config.show_voice_rank}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, show_voice_rank: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show_top_channels">Show Top Channels</Label>
                    <p className="text-sm text-muted-foreground">
                      Display the user's most active channels
                    </p>
                  </div>
                  <Switch
                    id="show_top_channels"
                    checked={config.show_top_channels}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, show_top_channels: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="show_charts">Show Activity Charts</Label>
                    <p className="text-sm text-muted-foreground">
                      Display activity charts showing message and voice trends over time
                    </p>
                  </div>
                  <Switch
                    id="show_charts"
                    checked={config.show_charts}
                    onCheckedChange={(checked) => setConfig({ ...config, show_charts: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Time Periods */}
          <TabsContent value="periods" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Time Periods & Settings
                </CardTitle>
                <CardDescription>
                  Configure which time periods to display and statistics lookback period
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Display Periods</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose which time periods to show on statistics cards
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_1d" className="cursor-pointer">
                        24 Hours (1d)
                      </Label>
                      <Switch
                        id="show_1d"
                        checked={config.show_1d}
                        onCheckedChange={(checked) => setConfig({ ...config, show_1d: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_7d" className="cursor-pointer">
                        7 Days
                      </Label>
                      <Switch
                        id="show_7d"
                        checked={config.show_7d}
                        onCheckedChange={(checked) => setConfig({ ...config, show_7d: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_14d" className="cursor-pointer">
                        14 Days
                      </Label>
                      <Switch
                        id="show_14d"
                        checked={config.show_14d}
                        onCheckedChange={(checked) => setConfig({ ...config, show_14d: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="show_30d" className="cursor-pointer">
                        30 Days
                      </Label>
                      <Switch
                        id="show_30d"
                        checked={config.show_30d}
                        onCheckedChange={(checked) => setConfig({ ...config, show_30d: checked })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="lookback_days">Lookback Period (Days)</Label>
                  <Input
                    id="lookback_days"
                    type="number"
                    min="1"
                    max="90"
                    value={config.lookback_days}
                    onChange={(e) =>
                      setConfig({ ...config, lookback_days: parseInt(e.target.value) || 14 })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    How many days back to calculate statistics (1-90 days)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={config.timezone}
                    onValueChange={(value) => setConfig({ ...config, timezone: value })}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                      <SelectItem value="Europe/Berlin">Berlin (CET)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                      <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                      <SelectItem value="Australia/Sydney">Sydney (AEST)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Timezone for displaying dates and times on statistics cards
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
            <CardDescription className="text-xs">
              Use the /stats command in Discord to see a live preview of your statistics card
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

