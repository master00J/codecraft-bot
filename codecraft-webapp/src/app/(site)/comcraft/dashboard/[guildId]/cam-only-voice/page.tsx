'use client';

/**
 * Cam-Only Voice Configuration Dashboard
 * Allows server owners to configure cam-only voice channel settings
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Video, Clock, Shield, X, AlertTriangle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ChannelTimeoutConfig {
  enabled: boolean;
  duration: number;
  unit: 'minutes' | 'hours' | 'days';
}

interface CamOnlyVoiceConfig {
  enabled: boolean;
  channel_ids: string[];
  grace_period_seconds: number;
  warning_enabled: boolean;
  max_warnings: number;
  exempt_roles: string[];
  exempt_users: string[];
  log_channel_id: string | null; // Legacy: global log channel (kept for backward compatibility)
  channel_log_channels?: Record<string, string>; // Per-voice-channel log channels: {voice_channel_id: log_channel_id}
  channel_timeouts?: Record<string, ChannelTimeoutConfig>; // Per-voice-channel timeouts: {voice_channel_id: {enabled: boolean, duration: number, unit: string}}
}

export default function CamOnlyVoicePage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<CamOnlyVoiceConfig | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [textChannels, setTextChannels] = useState<any[]>([]);
  const [logChannels, setLogChannels] = useState<any[]>([]); // Combined text + voice channels for log
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedExemptRoles, setSelectedExemptRoles] = useState<string[]>([]);
  const [selectedExemptUsers, setSelectedExemptUsers] = useState<string[]>([]);
  const [channelLogChannels, setChannelLogChannels] = useState<Record<string, string>>({}); // voice_channel_id -> log_channel_id
  const [channelTimeouts, setChannelTimeouts] = useState<Record<string, ChannelTimeoutConfig>>({}); // voice_channel_id -> timeout config

  useEffect(() => {
    fetchData();
  }, [guildId]);

  async function fetchData() {
    setLoading(true);
    let configRes: Response | null = null;
    let configLoaded = false;
    
    try {
      const [configResponse, channelsRes, rolesRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/cam-only-voice`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`)
      ]);

      configRes = configResponse;
      configLoaded = configRes.ok;

      const [configData, channelsData, rolesData] = await Promise.all([
        configRes.json(),
        channelsRes.json().catch(() => ({ success: false, channels: {} })),
        rolesRes.json().catch(() => ({ success: false, roles: [] }))
      ]);

      if (configData.config) {
        setConfig(configData.config);
        setSelectedChannels(configData.config.channel_ids || []);
        setSelectedExemptRoles(configData.config.exempt_roles || []);
        setSelectedExemptUsers(configData.config.exempt_users || []);
        setChannelLogChannels(configData.config.channel_log_channels || {});
        setChannelTimeouts(configData.config.channel_timeouts || {});
      }

      // Filter voice channels (handle errors gracefully)
      if (channelsData.success && channelsData.channels) {
        const voiceChannels = (channelsData.channels?.voice || []).filter((ch: any) => ch.type === 2);
        setChannels(voiceChannels);
        
        // Filter text channels
        const textChs = (channelsData.channels?.text || []).filter((ch: any) => ch.type === 0);
        setTextChannels(textChs);
        
        // Combine text and voice channels for log channel selection
        const combinedLogChannels = [
          ...textChs.map((ch: any) => ({ ...ch, channelType: 'text' })),
          ...voiceChannels.map((ch: any) => ({ ...ch, channelType: 'voice' }))
        ].sort((a, b) => {
          // Sort by type first (text before voice), then by name
          if (a.channelType !== b.channelType) {
            return a.channelType === 'text' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        setLogChannels(combinedLogChannels);
      } else {
        // If bot API is unavailable, set empty arrays
        setChannels([]);
        setTextChannels([]);
        setLogChannels([]);
        console.warn('Bot API unavailable - channels not loaded');
      }
      
      // Handle roles (handle errors gracefully)
      if (rolesData.success && rolesData.roles) {
        setRoles(rolesData.roles || []);
      } else {
        setRoles([]);
        console.warn('Bot API unavailable - roles not loaded');
      }
      
      // Show warning if bot API is unavailable but config loaded
      if (configLoaded && (!channelsData.success || !rolesData.success)) {
        toast({
          title: 'Warning',
          description: 'Bot API unavailable - some features may be limited',
          variant: 'default'
        });
      }
    } catch (error: any) {
      console.error('Error loading cam-only voice config:', error);
      
      // If config failed to load, create default config
      if (!config) {
        setConfig({
          enabled: false,
          channel_ids: [],
          grace_period_seconds: 10,
          warning_enabled: true,
          max_warnings: 2,
          exempt_roles: [],
          exempt_users: [],
          log_channel_id: null
        });
      }
      
      // Only show error toast if config failed to load
      if (!configLoaded) {
        toast({
          title: 'Error',
          description: 'Failed to load cam-only voice configuration',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/cam-only-voice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          channel_ids: selectedChannels,
          exempt_roles: selectedExemptRoles,
          exempt_users: selectedExemptUsers,
          channel_log_channels: channelLogChannels,
          channel_timeouts: channelTimeouts
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      toast({
        title: 'Success',
        description: 'Cam-only voice configuration saved'
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
          <p className="text-muted-foreground">Failed to load cam-only voice configuration</p>
          <Button onClick={fetchData} className="mt-4">Retry</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-500/5">
      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" size="sm" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>← Back to Dashboard</Link>
        </Button>

        {/* Header */}
        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-background shadow-lg">
                    📹
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Cam-Only Voice Configuration
                  </h1>
                  <p className="text-muted-foreground">
                    Require users to enable their camera to join voice channels
                  </p>
                </div>
              </div>
              <Button 
                onClick={saveConfig} 
                disabled={saving}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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
        </Card>

        {/* Main Configuration */}
        <Card className="p-6 space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label className="text-base font-semibold">Enable Cam-Only Voice</Label>
              <p className="text-sm text-muted-foreground">
                Require users to enable their camera to stay in voice channels
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          {config.enabled && (
            <>
              {/* Voice Channels */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Voice Channels
                </Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value && !selectedChannels.includes(value)) {
                      setSelectedChannels([...selectedChannels, value]);
                    }
                  }}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Select a voice channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Select voice channels that require camera. Leave empty to apply to all voice channels.
                </p>
                {selectedChannels.length > 0 && (
                  <div className="space-y-3 mt-2">
                    {selectedChannels.map((channelId) => {
                      const channel = channels.find((ch) => ch.id === channelId);
                      const currentLogChannel = channelLogChannels[channelId] || 'none';
                      const currentTimeout = channelTimeouts[channelId] || { enabled: false, duration: 30, unit: 'minutes' as const };
                      return (
                        <div key={channelId} className="p-3 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="flex items-center gap-1">
                              {channel?.name || channelId}
                            </Badge>
                            <button
                              onClick={() => {
                                setSelectedChannels(selectedChannels.filter((id) => id !== channelId));
                                const newLogChannels = { ...channelLogChannels };
                                delete newLogChannels[channelId];
                                setChannelLogChannels(newLogChannels);
                                const newTimeouts = { ...channelTimeouts };
                                delete newTimeouts[channelId];
                                setChannelTimeouts(newTimeouts);
                              }}
                              className="ml-2 hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          
                          {/* Log Channel */}
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Log Channel (optional)</Label>
                            <Select
                              value={currentLogChannel}
                              onValueChange={(value) => {
                                setChannelLogChannels({
                                  ...channelLogChannels,
                                  [channelId]: value === 'none' ? '' : value
                                });
                              }}
                            >
                              <SelectTrigger className="max-w-xs">
                                <SelectValue placeholder="Select a log channel" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {logChannels.map((logChannel) => (
                                  <SelectItem key={logChannel.id} value={logChannel.id}>
                                    <span className="flex items-center gap-2">
                                      {logChannel.channelType === 'voice' && '🔊'}
                                      {logChannel.channelType === 'text' && '💬'}
                                      {logChannel.name}
                                      {logChannel.channelType === 'voice' && <span className="text-xs text-muted-foreground">(Voice - Note: Voice channels cannot receive messages)</span>}
                                      {logChannel.channelType === 'text' && <span className="text-xs text-muted-foreground">(Text)</span>}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Timeout Configuration */}
                          <div className="space-y-2 border-t pt-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-medium">Timeout on Kick</Label>
                              <Switch
                                checked={currentTimeout.enabled}
                                onCheckedChange={(checked) => {
                                  setChannelTimeouts({
                                    ...channelTimeouts,
                                    [channelId]: {
                                      ...currentTimeout,
                                      enabled: checked
                                    }
                                  });
                                }}
                              />
                            </div>
                            {currentTimeout.enabled && (
                              <div className="grid grid-cols-2 gap-2 ml-4">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Duration</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={currentTimeout.duration}
                                    onChange={(e) => {
                                      setChannelTimeouts({
                                        ...channelTimeouts,
                                        [channelId]: {
                                          ...currentTimeout,
                                          duration: parseInt(e.target.value) || 1
                                        }
                                      });
                                    }}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Unit</Label>
                                  <Select
                                    value={currentTimeout.unit}
                                    onValueChange={(value: 'minutes' | 'hours' | 'days') => {
                                      setChannelTimeouts({
                                        ...channelTimeouts,
                                        [channelId]: {
                                          ...currentTimeout,
                                          unit: value
                                        }
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="minutes">Minutes</SelectItem>
                                      <SelectItem value="hours">Hours</SelectItem>
                                      <SelectItem value="days">Days</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground ml-4">
                              {currentTimeout.enabled 
                                ? `Users kicked from this channel will be timed out for ${currentTimeout.duration} ${currentTimeout.unit}`
                                : 'Users can rejoin immediately after being kicked'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Grace Period */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Grace Period (seconds)
                </Label>
                <Input
                  type="number"
                  min="5"
                  max="60"
                  value={config.grace_period_seconds}
                  onChange={(e) => setConfig({ ...config, grace_period_seconds: parseInt(e.target.value) || 10 })}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Time users have to enable their camera before being disconnected (default: 10 seconds)
                </p>
              </div>

              {/* Warnings */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">Enable Warnings</Label>
                  <p className="text-sm text-muted-foreground">
                    Warn users before disconnecting them
                  </p>
                </div>
                <Switch
                  checked={config.warning_enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, warning_enabled: checked })}
                />
              </div>

              {config.warning_enabled && (
                <div className="space-y-2 ml-4">
                  <Label className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Max Warnings
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="5"
                    value={config.max_warnings}
                    onChange={(e) => setConfig({ ...config, max_warnings: parseInt(e.target.value) || 2 })}
                    className="max-w-xs"
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum number of warnings before disconnecting (default: 2)
                  </p>
                </div>
              )}

              {/* Global Log Channel (Legacy - kept for backward compatibility) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Global Log Channel (Legacy)
                </Label>
                <Select
                  value={config.log_channel_id || 'none'}
                  onValueChange={(value) => setConfig({ ...config, log_channel_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Select a log channel (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {logChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <span className="flex items-center gap-2">
                          💬 {channel.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Default log channel for all voice channels (if no per-channel log channel is set). Note: Voice channels cannot receive messages, so only text channels will actually receive logs.
                </p>
              </div>

              {/* Exempt Roles */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Exempt Roles
                </Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value && !selectedExemptRoles.includes(value)) {
                      setSelectedExemptRoles([...selectedExemptRoles, value]);
                    }
                  }}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Select a role to exempt" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Roles that are exempt from the camera requirement
                </p>
                {selectedExemptRoles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedExemptRoles.map((roleId) => {
                      const role = roles.find((r) => r.id === roleId);
                      return (
                        <Badge key={roleId} variant="secondary" className="flex items-center gap-1">
                          {role?.name || roleId}
                          <button
                            onClick={() => setSelectedExemptRoles(selectedExemptRoles.filter((id) => id !== roleId))}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Exempt Users */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Exempt Users
                </Label>
                <p className="text-sm text-muted-foreground">
                  User exemptions can be managed via the Discord command: <code className="bg-muted px-1 py-0.5 rounded">/cam-only exempt</code>
                </p>
              </div>
            </>
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-blue-500/5 border-blue-500/20">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold">How it works</h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Users joining configured voice channels must enable their camera</li>
                <li>Users have a grace period to enable their camera before being disconnected</li>
                <li>If warnings are enabled, users will receive warnings before being disconnected</li>
                <li>Exempt roles and users are not required to enable their camera</li>
                <li>The bot monitors voice channels every 5 seconds to check camera status</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

