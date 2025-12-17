'use client';

/**
 * Comcraft - Streaming & Social Media Notifications
 * Supports Twitch, YouTube, and TikTok
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function StreamingNotifications() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();
  
  // Streaming state
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingSubTemplate, setEditingSubTemplate] = useState<string | null>(null);
  const [subTemplateValue, setSubTemplateValue] = useState('');
  const [editingGiftedTemplate, setEditingGiftedTemplate] = useState<string | null>(null);
  const [giftedTemplateValue, setGiftedTemplateValue] = useState('');
  const [editingSubChannel, setEditingSubChannel] = useState<string | null>(null);
  const [subChannelValue, setSubChannelValue] = useState('');
  const [testingStream, setTestingStream] = useState<string | null>(null);
  const [testMonths, setTestMonths] = useState<number>(1);

  // TikTok state
  const [tiktokMonitors, setTiktokMonitors] = useState<any[]>([]);
  const [tiktokLoading, setTiktokLoading] = useState(true);
  const [showTikTokForm, setShowTikTokForm] = useState(false);
  const [creatingTikTok, setCreatingTikTok] = useState(false);
  const [editingTikTokMessage, setEditingTikTokMessage] = useState<string | null>(null);
  const [tiktokMessageValue, setTiktokMessageValue] = useState('');
  const [newTikTok, setNewTikTok] = useState({
    tiktok_username: '',
    channel_id: '',
    notification_message: '{username} just posted a new TikTok!',
    ping_role_id: ''
  });

  // Handle OAuth success/error from URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const streamerName = searchParams.get('streamer');
    const message = searchParams.get('message');

    if (success === 'twitch_connected' && streamerName) {
      toast({
        title: 'Twitch Connected! 🎉',
        description: `Successfully connected to ${streamerName}'s Twitch account. You can now enable subscriber notifications.`,
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      toast({
        title: 'Connection Failed',
        description: message || 'Could not connect to Twitch. Please try again.',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  const [newStream, setNewStream] = useState({
    platform: 'twitch',
    streamer_name: '',
    channel_id: '',
    message_template: '🔴 {streamer} is live right now!'
  });

  useEffect(() => {
    if (guildId) {
      fetchStreams();
      fetchTikTokMonitors();
    }
  }, [guildId]);

  const fetchStreams = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams`);
      const data = await response.json();
      setStreams(data.streams || []);
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTikTokMonitors = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tiktok`);
      const data = await response.json();
      setTiktokMonitors(data.monitors || []);
    } catch (error) {
      console.error('Error fetching TikTok monitors:', error);
    } finally {
      setTiktokLoading(false);
    }
  };

  // Stream CRUD functions
  const createStream = async () => {
    if (!newStream.streamer_name || !newStream.channel_id) {
      toast({
        title: 'Missing details',
        description: 'Please provide both the streamer name and the Discord channel ID.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setCreating(true);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newStream,
          streamer_id: newStream.streamer_name
        })
      });

      if (response.ok) {
        toast({
          title: 'Notification added',
          description: `${newStream.streamer_name} is now monitored.`,
        });
        setNewStream({
          platform: 'twitch',
          streamer_name: '',
          channel_id: '',
          message_template: '🔴 {streamer} is live right now!'
        });
        setShowForm(false);
        fetchStreams();
      }
    } catch (error) {
      toast({
        title: 'Create failed',
        description: 'We could not add this notification.',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteStream = async (streamId: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams?id=${streamId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Notification deleted',
          description: 'Streaming alerts have been removed.',
        });
        fetchStreams();
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'We could not delete this notification.',
        variant: 'destructive'
      });
    }
  };

  const toggleEnabled = async (streamId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams?id=${streamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        toast({
          title: enabled ? 'Notifications resumed' : 'Notifications paused',
          description: enabled ? 'This streamer will trigger alerts again.' : 'Alerts are paused for this streamer.',
        });
        fetchStreams();
      }
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'We could not update the notification status.',
        variant: 'destructive'
      });
    }
  };

  // TikTok CRUD functions
  const createTikTokMonitor = async () => {
    if (!newTikTok.tiktok_username || !newTikTok.channel_id) {
      toast({
        title: 'Missing details',
        description: 'Please provide both the TikTok username and Discord channel ID.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setCreatingTikTok(true);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tiktok`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTikTok)
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'TikTok monitor added',
          description: `@${newTikTok.tiktok_username.replace('@', '')} is now being monitored.`,
        });
        setNewTikTok({
          tiktok_username: '',
          channel_id: '',
          notification_message: '{username} just posted a new TikTok!',
          ping_role_id: ''
        });
        setShowTikTokForm(false);
        fetchTikTokMonitors();
      } else {
        toast({
          title: 'Failed to add monitor',
          description: data.error || data.message || 'Unknown error occurred.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Create failed',
        description: 'Could not add TikTok monitor.',
        variant: 'destructive'
      });
    } finally {
      setCreatingTikTok(false);
    }
  };

  const deleteTikTokMonitor = async (monitorId: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tiktok?id=${monitorId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Monitor removed',
          description: 'TikTok account is no longer being monitored.',
        });
        fetchTikTokMonitors();
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Could not remove TikTok monitor.',
        variant: 'destructive'
      });
    }
  };

  const toggleTikTokEnabled = async (monitorId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tiktok?id=${monitorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (response.ok) {
        toast({
          title: enabled ? 'Monitor resumed' : 'Monitor paused',
          description: enabled ? 'Notifications will be sent for new videos.' : 'Notifications are paused.',
        });
        fetchTikTokMonitors();
      }
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Could not update monitor status.',
        variant: 'destructive'
      });
    }
  };

  const updateTikTokMessage = async (monitorId: string, message: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tiktok?id=${monitorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_message: message })
      });

      if (response.ok) {
        toast({
          title: 'Message updated',
          description: 'Notification message has been saved.',
        });
        setEditingTikTokMessage(null);
        fetchTikTokMonitors();
      } else {
        throw new Error('Failed to update message');
      }
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message || 'Could not update message template.',
        variant: 'destructive'
      });
    }
  };

  // Twitch-specific functions
  const toggleSubscriberNotifications = async (streamId: string, enabled: boolean) => {
    try {
      if (enabled) {
        const response = await fetch(`/api/comcraft/guilds/${guildId}/streams/subscribers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId: streamId })
        });

        if (response.ok) {
          toast({
            title: 'Subscriber notifications enabled',
            description: 'You will now receive notifications when viewers subscribe.',
          });
          fetchStreams();
        } else {
          const data = await response.json();
          throw new Error(data.error || 'Failed to enable');
        }
      } else {
        const response = await fetch(`/api/comcraft/guilds/${guildId}/streams/subscribers?notificationId=${streamId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          toast({
            title: 'Subscriber notifications disabled',
            description: 'Subscriber alerts have been turned off.',
          });
          fetchStreams();
        }
      }
    } catch (error: any) {
      toast({
        title: 'Failed to update',
        description: error.message || 'Could not update subscriber notifications.',
        variant: 'destructive'
      });
    }
  };

  const updateSubscriberTemplate = async (streamId: string, template: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams?id=${streamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriber_message_template: template })
      });

      if (response.ok) {
        toast({
          title: 'Template updated',
          description: 'Subscriber message template has been saved.',
        });
        setEditingSubTemplate(null);
        fetchStreams();
      } else {
        throw new Error('Failed to update template');
      }
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message || 'Could not update message template.',
        variant: 'destructive'
      });
    }
  };

  const updateGiftedSubTemplate = async (streamId: string, template: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams?id=${streamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gifted_sub_message_template: template })
      });

      if (response.ok) {
        toast({
          title: 'Template updated',
          description: 'Gifted sub message template has been saved.',
        });
        setEditingGiftedTemplate(null);
        fetchStreams();
      } else {
        throw new Error('Failed to update template');
      }
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message || 'Could not update gifted sub template.',
        variant: 'destructive'
      });
    }
  };

  const updateSubscriberChannel = async (streamId: string, channelId: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams?id=${streamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriber_channel_id: channelId || null })
      });

      if (response.ok) {
        toast({
          title: 'Channel updated',
          description: channelId ? 'Subscriber notifications will be sent to the specified channel.' : 'Subscriber notifications will use the same channel as live notifications.',
        });
        setEditingSubChannel(null);
        fetchStreams();
      } else {
        throw new Error('Failed to update channel');
      }
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message || 'Could not update subscriber channel.',
        variant: 'destructive'
      });
    }
  };

  const testSubscriberNotification = async (streamId: string, streamerName: string) => {
    try {
      setTestingStream(streamId);
      
      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams/test-subscriber`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: streamId,
          subscriberName: 'TestUser',
          tier: '1000',
          cumulativeMonths: testMonths
        })
      });

      if (response.ok) {
        toast({
          title: 'Test notification sent! 🎉',
          description: `Check your Discord channel for the test subscriber notification (${testMonths} ${testMonths === 1 ? 'month' : 'months'}).`,
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send test notification');
      }
    } catch (error: any) {
      toast({
        title: 'Test failed',
        description: error.message || 'Could not send test notification.',
        variant: 'destructive'
      });
    } finally {
      setTestingStream(null);
    }
  };

  const testGiftedSubNotification = async (streamId: string, streamerName: string) => {
    try {
      setTestingStream(streamId);
      
      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams/test-gifted-sub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: streamId,
          gifterName: 'TestGifter',
          amount: 5,
          tier: '1000'
        })
      });

      if (response.ok) {
        toast({
          title: 'Test gifted sub sent! 🎁',
          description: 'Check your Discord channel for the test gifted subscription notification.',
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send test notification');
      }
    } catch (error: any) {
      toast({
        title: 'Test failed',
        description: error.message || 'Could not send test notification.',
        variant: 'destructive'
      });
    } finally {
      setTestingStream(null);
    }
  };

  const connectTwitch = (notificationId: string) => {
    window.location.href = `/api/comcraft/twitch/auth/start?notification_id=${notificationId}&guild_id=${guildId}`;
  };

  const disconnectTwitch = async (notificationId: string) => {
    try {
      const confirmed = confirm('Are you sure you want to disconnect your Twitch account? Subscriber notifications will be disabled.');
      if (!confirmed) return;

      const response = await fetch(`/api/comcraft/guilds/${guildId}/streams/${notificationId}/disconnect-twitch`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Twitch disconnected',
          description: 'Your Twitch account has been disconnected.',
        });
        fetchStreams();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (error: any) {
      toast({
        title: 'Disconnect failed',
        description: error.message || 'Could not disconnect Twitch account.',
        variant: 'destructive'
      });
    }
  };

  if (loading && tiktokLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-blue-500/5">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>← Back to Overview</Link>
        </Button>

        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-purple-500/10 p-8 flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                  📺
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Content Notifications Hub
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                  Automatically notify your community when their favorite creators go live or post new content. Supports Twitch, YouTube, and TikTok.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-blue-500/10 text-blue-500 px-4 py-2 border-0">{streams.length} streaming alerts</Badge>
              <Badge className="bg-pink-500/10 text-pink-500 px-4 py-2 border-0">{tiktokMonitors.length} TikTok monitors</Badge>
              <Badge variant="outline" className="px-4 py-2">💬 Custom Message Templates</Badge>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="streaming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="streaming" className="flex items-center gap-2">
              <span>🎮</span> Streaming (Twitch/YouTube)
            </TabsTrigger>
            <TabsTrigger value="tiktok" className="flex items-center gap-2">
              <span>🎵</span> TikTok
            </TabsTrigger>
          </TabsList>

          {/* STREAMING TAB */}
          <TabsContent value="streaming" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Streaming Alerts</h2>
                <p className="text-muted-foreground">Get notified when streamers go live on Twitch or YouTube.</p>
              </div>
              <Button onClick={() => setShowForm(!showForm)} size="lg">
                ➕ {showForm ? 'Cancel' : 'Add Streamer'}
              </Button>
            </div>

            {/* New Stream Form */}
            {showForm && (
              <Card className="p-6 mb-6 border-2 shadow-xl">
                <h2 className="text-xl font-bold mb-6">Configure streaming alert</h2>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={newStream.platform} onValueChange={(value) => setNewStream({...newStream, platform: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twitch">🎮 Twitch</SelectItem>
                        <SelectItem value="youtube">📺 YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Streamer name</Label>
                    <Input 
                      value={newStream.streamer_name}
                      onChange={(e) => setNewStream({...newStream, streamer_name: e.target.value})}
                      placeholder="xQc"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Discord channel ID</Label>
                    <Input 
                      value={newStream.channel_id}
                      onChange={(e) => setNewStream({...newStream, channel_id: e.target.value})}
                      placeholder="123456789012345678"
                    />
                    <p className="text-sm text-muted-foreground">
                      Right-click a channel → Copy ID (enable Developer Mode in Discord settings).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Message template</Label>
                    <Input 
                      value={newStream.message_template}
                      onChange={(e) => setNewStream({...newStream, message_template: e.target.value})}
                      placeholder="🔴 {streamer} is live right now!"
                    />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">Variables:</span> {'{streamer}'}, {'{game}'}, {'{viewers}'}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button onClick={createStream} disabled={creating}>
                      {creating ? 'Saving...' : '💾 Save Notification'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Streams List */}
            <div className="space-y-4">
              {streams.length === 0 ? (
                <Card className="p-12 text-center border-2 shadow-lg bg-gradient-to-br from-muted/50 to-muted/20">
                  <div className="text-6xl mb-4">📺</div>
                  <h3 className="text-xl font-bold mb-2">No streaming alerts yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first streamer to start alerting your community.
                  </p>
                </Card>
              ) : (
                streams.map((stream) => (
                  <Card key={stream.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">
                          {stream.platform === 'twitch' ? '🎮' : '📺'}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold">{stream.streamer_name}</h3>
                            {stream.is_live ? (
                              <Badge className="bg-red-600">🔴 LIVE</Badge>
                            ) : (
                              <Badge variant="outline">Offline</Badge>
                            )}
                            {!stream.enabled && (
                              <Badge variant="outline" className="bg-gray-500">Disabled</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Platform: {stream.platform.toUpperCase()}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Channel: <code>{stream.channel_id}</code>
                          </p>
                          {stream.total_notifications_sent > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {stream.total_notifications_sent} alerts sent
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toggleEnabled(stream.id, !stream.enabled)}
                        >
                          {stream.enabled ? '⏸️ Pause' : '▶️ Resume'}
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteStream(stream.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>

                    {/* Twitch Account Connection */}
                    {stream.platform === 'twitch' && (
                      <div className="mt-4 pt-4 border-t">
                        {!stream.twitch_user_id ? (
                          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">🔗</span>
                              <div className="flex-1">
                                <h4 className="font-semibold">Connect Your Twitch Account</h4>
                                <p className="text-sm text-muted-foreground">
                                  Connect your Twitch account to enable subscriber notifications
                                </p>
                              </div>
                            </div>
                            <Button onClick={() => connectTwitch(stream.id)} className="w-full">
                              <span className="mr-2">🎮</span> Connect Twitch Account
                            </Button>
                          </div>
                        ) : (
                          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">✅</span>
                                <div>
                                  <h4 className="font-semibold">Twitch Account Connected</h4>
                                  <p className="text-sm text-muted-foreground">
                                    <span className="font-medium text-foreground">{stream.twitch_display_name || stream.streamer_name}</span>
                                  </p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => disconnectTwitch(stream.id)}>
                                Disconnect
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Subscriber Notifications (Twitch only) */}
                    {stream.platform === 'twitch' && stream.twitch_user_id && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🎉</span>
                            <div>
                              <h4 className="font-semibold">Subscriber Notifications</h4>
                              <p className="text-sm text-muted-foreground">
                                Get notified when someone subscribes
                              </p>
                            </div>
                          </div>
                          <Switch 
                            checked={stream.subscriber_notifications_enabled || false}
                            onCheckedChange={(checked) => toggleSubscriberNotifications(stream.id, checked)}
                          />
                        </div>
                        
                        {stream.subscriber_notifications_enabled && (
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant={stream.eventsub_subscription_status === 'enabled' ? 'default' : 'secondary'}>
                                {stream.eventsub_subscription_status === 'enabled' ? '✅ Active' : `⏳ ${stream.eventsub_subscription_status || 'Pending'}`}
                              </Badge>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => testSubscriberNotification(stream.id, stream.streamer_name)}
                                disabled={testingStream === stream.id}
                              >
                                {testingStream === stream.id ? '⏳ Testing...' : '🧪 Test Notification'}
                              </Button>
                            </div>

                            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                              <Label htmlFor="test-months" className="text-sm text-muted-foreground whitespace-nowrap">
                                Test months:
                              </Label>
                              <Input 
                                id="test-months"
                                type="number" 
                                min="1"
                                max="999"
                                value={testMonths}
                                onChange={(e) => setTestMonths(parseInt(e.target.value) || 1)}
                                className="w-20 h-8"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* TIKTOK TAB */}
          <TabsContent value="tiktok" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">TikTok Video Notifications</h2>
                <p className="text-muted-foreground">Get notified when TikTok creators post new videos.</p>
              </div>
              <Button onClick={() => setShowTikTokForm(!showTikTokForm)} size="lg">
                ➕ {showTikTokForm ? 'Cancel' : 'Add TikTok Account'}
              </Button>
            </div>

            {/* New TikTok Form */}
            {showTikTokForm && (
              <Card className="p-6 mb-6 border-2 shadow-xl">
                <h2 className="text-xl font-bold mb-6">Add TikTok Monitor</h2>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>TikTok Username</Label>
                    <Input 
                      value={newTikTok.tiktok_username}
                      onChange={(e) => setNewTikTok({...newTikTok, tiktok_username: e.target.value})}
                      placeholder="@username or username"
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter the TikTok username (with or without @)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Discord Channel ID</Label>
                    <Input 
                      value={newTikTok.channel_id}
                      onChange={(e) => setNewTikTok({...newTikTok, channel_id: e.target.value})}
                      placeholder="123456789012345678"
                    />
                    <p className="text-sm text-muted-foreground">
                      Right-click a channel → Copy ID (enable Developer Mode in Discord settings).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Notification Message</Label>
                    <Input 
                      value={newTikTok.notification_message}
                      onChange={(e) => setNewTikTok({...newTikTok, notification_message: e.target.value})}
                      placeholder="{username} just posted a new TikTok!"
                    />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">Variables:</span> {'{username}'}, {'{url}'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Ping Role ID (Optional)</Label>
                    <Input 
                      value={newTikTok.ping_role_id}
                      onChange={(e) => setNewTikTok({...newTikTok, ping_role_id: e.target.value})}
                      placeholder="123456789012345678"
                    />
                    <p className="text-sm text-muted-foreground">
                      Optional: Role to ping when a new video is posted
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <Button onClick={createTikTokMonitor} disabled={creatingTikTok}>
                      {creatingTikTok ? 'Adding...' : '💾 Add Monitor'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowTikTokForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* TikTok Monitors List */}
            <div className="space-y-4">
              {tiktokMonitors.length === 0 ? (
                <Card className="p-12 text-center border-2 shadow-lg bg-gradient-to-br from-muted/50 to-muted/20">
                  <div className="text-6xl mb-4">🎵</div>
                  <h3 className="text-xl font-bold mb-2">No TikTok monitors yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add a TikTok account to start receiving notifications for new videos.
                  </p>
                </Card>
              ) : (
                tiktokMonitors.map((monitor) => (
                  <Card key={monitor.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">🎵</div>
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold">@{monitor.tiktok_username}</h3>
                            {monitor.enabled ? (
                              <Badge className="bg-green-600">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-500">Paused</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Channel: <code>{monitor.channel_id}</code>
                          </p>
                          {monitor.ping_role_id && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Ping Role: <code>{monitor.ping_role_id}</code>
                            </p>
                          )}
                          {monitor.last_checked && (
                            <p className="text-sm text-muted-foreground">
                              Last checked: {new Date(monitor.last_checked).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => toggleTikTokEnabled(monitor.id, !monitor.enabled)}
                        >
                          {monitor.enabled ? '⏸️ Pause' : '▶️ Resume'}
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => deleteTikTokMonitor(monitor.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>

                    {/* Message Template Editor */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label className="text-sm">Notification Message Template</Label>
                        {editingTikTokMessage === monitor.id ? (
                          <div className="space-y-2">
                            <Input 
                              value={tiktokMessageValue}
                              onChange={(e) => setTiktokMessageValue(e.target.value)}
                              placeholder="{username} just posted a new TikTok!"
                            />
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold">Variables:</span> {'{username}'}, {'{url}'}
                            </p>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => updateTikTokMessage(monitor.id, tiktokMessageValue)}
                              >
                                💾 Save
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setEditingTikTokMessage(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-mono bg-muted px-3 py-2 rounded flex-1">
                              {monitor.notification_message || '{username} just posted a new TikTok!'}
                            </p>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setEditingTikTokMessage(monitor.id);
                                setTiktokMessageValue(monitor.notification_message || '{username} just posted a new TikTok!');
                              }}
                            >
                              ✏️ Edit
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* TikTok Link */}
                    <div className="mt-4 pt-4 border-t">
                      <a 
                        href={`https://www.tiktok.com/@${monitor.tiktok_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600"
                      >
                        🔗 View TikTok Profile
                      </a>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
