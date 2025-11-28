'use client';

/**
 * Vote Kick Configuration Dashboard
 * Allows server owners to configure vote kick settings
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
import { Loader2, Save, Users, Clock, Shield, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface VoteKickConfig {
  enabled: boolean;
  required_votes: number;
  vote_duration_seconds: number;
  cooldown_seconds: number;
  allowed_channels: string[];
  exempt_roles: string[];
  exempt_users: string[];
  log_channel_id: string | null;
}

export default function VoteKickPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<VoteKickConfig | null>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [selectedExemptRoles, setSelectedExemptRoles] = useState<string[]>([]);
  const [selectedExemptUsers, setSelectedExemptUsers] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [guildId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [configRes, channelsRes, rolesRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/vote-kick`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`)
      ]);

      const [configData, channelsData, rolesData] = await Promise.all([
        configRes.json(),
        channelsRes.json(),
        rolesRes.json()
      ]);

      if (configData.config) {
        setConfig(configData.config);
        setSelectedChannels(configData.config.allowed_channels || []);
        setSelectedExemptRoles(configData.config.exempt_roles || []);
        setSelectedExemptUsers(configData.config.exempt_users || []);
      }

      // Filter voice channels
      const voiceChannels = (channelsData.channels?.voice || []).filter((ch: any) => ch.type === 2);
      setChannels(voiceChannels);
      setRoles(rolesData.roles || []);
    } catch (error: any) {
      console.error('Error loading vote kick config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load vote kick configuration',
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
      const response = await fetch(`/api/comcraft/guilds/${guildId}/vote-kick`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          allowed_channels: selectedChannels,
          exempt_roles: selectedExemptRoles,
          exempt_users: selectedExemptUsers
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      toast({
        title: 'Success',
        description: 'Vote kick configuration saved'
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
          <p className="text-muted-foreground">Failed to load vote kick configuration</p>
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
                    🗳️
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Vote Kick Configuration
                  </h1>
                  <p className="text-muted-foreground">
                    Allow users to vote to kick members from voice channels
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
              <Label className="text-base font-semibold">Enable Vote Kick</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to vote kick members from voice channels
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
            />
          </div>

          {config.enabled && (
            <>
              {/* Required Votes */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Required Votes
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={config.required_votes}
                  onChange={(e) => setConfig({ ...config, required_votes: parseInt(e.target.value) || 3 })}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Minimum number of votes needed to kick a user (default: 3)
                </p>
              </div>

              {/* Vote Duration */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Vote Duration (seconds)
                </Label>
                <Input
                  type="number"
                  min="10"
                  max="300"
                  value={config.vote_duration_seconds}
                  onChange={(e) => setConfig({ ...config, vote_duration_seconds: parseInt(e.target.value) || 60 })}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  How long votes remain active (default: 60 seconds)
                </p>
              </div>

              {/* Cooldown */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Cooldown (seconds)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="3600"
                  value={config.cooldown_seconds}
                  onChange={(e) => setConfig({ ...config, cooldown_seconds: parseInt(e.target.value) || 300 })}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  Cooldown between vote kicks for the same user (default: 300 seconds / 5 minutes)
                </p>
              </div>

              {/* Allowed Channels */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Allowed Voice Channels
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
                  Select voice channels where vote kick is allowed. Leave empty to allow in all voice channels.
                </p>
                {selectedChannels.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedChannels.map((channelId) => {
                      const channel = channels.find((ch) => ch.id === channelId);
                      return (
                        <Badge key={channelId} variant="secondary" className="flex items-center gap-1">
                          {channel?.name || channelId}
                          <button
                            onClick={() => setSelectedChannels(selectedChannels.filter((id) => id !== channelId))}
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
                  Roles that cannot be vote kicked
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

              {/* Log Channel */}
              <div className="space-y-2">
                <Label>Log Channel (Optional)</Label>
                <Select
                  value={config.log_channel_id || 'none'}
                  onValueChange={(value) => setConfig({ ...config, log_channel_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Channel to log vote kick actions (optional)
                </p>
              </div>
            </>
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-blue-500/5 border-blue-500/20">
          <h3 className="font-semibold mb-2">How Vote Kick Works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• Users can use <code className="bg-muted px-1 rounded">/votekick</code> to start a vote kick</li>
            <li>• Other users in the same voice channel can vote using the buttons</li>
            <li>• If enough votes are reached, the user is automatically disconnected from the voice channel</li>
            <li>• Each user can only vote once per session</li>
            <li>• Users cannot vote on their own vote kick</li>
            <li>• Bots and server owners cannot be vote kicked</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

