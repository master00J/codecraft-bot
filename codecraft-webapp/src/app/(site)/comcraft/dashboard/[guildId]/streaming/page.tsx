'use client';

/**
 * Comcraft - Streaming Notifications
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

export default function StreamingNotifications() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();
  
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
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      toast({
        title: 'Connection Failed',
        description: message || 'Could not connect to Twitch. Please try again.',
        variant: 'destructive',
      });
      // Clean URL
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
          streamer_id: newStream.streamer_name // Will be updated by bot
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

  const toggleSubscriberNotifications = async (streamId: string, enabled: boolean) => {
    try {
      if (enabled) {
        // Enable
        const response = await fetch(`/api/comcraft/guilds/${guildId}/streams/subscribers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId: streamId
          })
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
        // Disable
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
        body: JSON.stringify({
          subscriber_message_template: template
        })
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
        body: JSON.stringify({
          gifted_sub_message_template: template
        })
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
        body: JSON.stringify({
          subscriber_channel_id: channelId || null
        })
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
        headers: {
          'Content-Type': 'application/json'
        },
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
        headers: {
          'Content-Type': 'application/json'
        },
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
    // Redirect to OAuth start endpoint
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
        // Refresh data
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

  if (loading) {
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
                  🎮
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Streaming Alerts Hub
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                  Automatically notify your community when their favourite creators go live. Works with Twitch and YouTube out of the box.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-blue-500/10 text-blue-500 px-4 py-2 border-0">{streams.length} active alerts</Badge>
              <Badge variant="outline" className="px-4 py-2">Variables: {'{streamer}'}, {'{game}'}, {'{viewers}'}</Badge>
              <Badge variant="outline" className="px-4 py-2">💬 Custom Emoji Support</Badge>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Add new alert</h2>
            <p className="text-muted-foreground">Choose the platform, streamer and target channel. We’ll handle the rest.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="lg">
            ➕ {showForm ? 'Cancel' : 'New Notification'}
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
                  <span className="font-semibold">Variables:</span> {'{streamer}'}, {'{game}'}, {'{viewers}'}<br/>
                  <span className="font-semibold">Custom Emoji:</span> Right-click emoji → Copy Link → Paste (e.g., {'<:name:123456>'})
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
              <h3 className="text-xl font-bold mb-2">No notifications yet</h3>
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
                          <Badge variant="outline" className="bg-gray-500">Uitgeschakeld</Badge>
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

                {/* Twitch Account Connection (Twitch only) */}
                {stream.platform === 'twitch' && (
                  <div className="mt-4 pt-4 border-t">
                    {!stream.twitch_user_id ? (
                      /* Not Connected */
                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">🔗</span>
                          <div className="flex-1">
                            <h4 className="font-semibold">Connect Your Twitch Account</h4>
                            <p className="text-sm text-muted-foreground">
                              Connect your Twitch account to enable subscriber notifications and gifted subscription alerts
                            </p>
                          </div>
                        </div>
                        <Button 
                          onClick={() => connectTwitch(stream.id)}
                          className="w-full"
                        >
                          <span className="mr-2">🎮</span> Connect Twitch Account
                        </Button>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>✓ Secure OAuth2 connection</p>
                          <p>✓ Real-time subscriber notifications</p>
                          <p>✓ Gifted subscription alerts</p>
                          <p>✓ Tokens are stored securely and automatically refreshed</p>
                        </div>
                      </div>
                    ) : (
                      /* Connected */
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">✅</span>
                            <div>
                              <h4 className="font-semibold">Twitch Account Connected</h4>
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{stream.twitch_display_name || stream.streamer_name}</span>
                                {stream.twitch_connected_at && (
                                  <span> • Connected {new Date(stream.twitch_connected_at).toLocaleDateString()}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => disconnectTwitch(stream.id)}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Subscriber Notifications (Twitch only) */}
                {stream.platform === 'twitch' && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🎉</span>
                        <div>
                          <h4 className="font-semibold">Subscriber Notifications</h4>
                          <p className="text-sm text-muted-foreground">
                            Get notified when someone subscribes
                          </p>
                          {!stream.twitch_user_id && (
                            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                              ⚠️ Connect your Twitch account first to enable this feature
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch 
                        checked={stream.subscriber_notifications_enabled || false}
                        onCheckedChange={(checked) => toggleSubscriberNotifications(stream.id, checked)}
                        disabled={!stream.twitch_user_id}
                      />
                    </div>
                    
                    {stream.subscriber_notifications_enabled && (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {stream.eventsub_subscription_status && (
                              <Badge 
                                variant={stream.eventsub_subscription_status === 'enabled' ? 'default' : 'secondary'}
                              >
                                {stream.eventsub_subscription_status === 'enabled' ? '✅ Active' : `⏳ ${stream.eventsub_subscription_status}`}
                              </Badge>
                            )}
                            {stream.total_subscriber_notifications_sent > 0 && (
                              <span className="text-sm text-muted-foreground">
                                {stream.total_subscriber_notifications_sent} alerts sent
                              </span>
                            )}
                          </div>
                          
                          {/* Test Button */}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => testSubscriberNotification(stream.id, stream.streamer_name)}
                            disabled={testingStream === stream.id}
                          >
                            {testingStream === stream.id ? '⏳ Testing...' : '🧪 Test Notification'}
                          </Button>
                        </div>

                        {/* Test Settings */}
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
                          <span className="text-xs text-muted-foreground">
                            (1 = new sub, 12 = 1 year, 24 = 2 years)
                          </span>
                        </div>
                        
                        {/* Subscriber Channel Selector */}
                        <div className="space-y-2 pt-2 border-t">
                          <Label className="text-sm">Subscriber Notification Channel</Label>
                          {editingSubChannel === stream.id ? (
                            <div className="space-y-2">
                              <Input 
                                value={subChannelValue}
                                onChange={(e) => setSubChannelValue(e.target.value)}
                                placeholder={stream.channel_id + " (default)"}
                              />
                              <p className="text-xs text-muted-foreground">
                                Leave empty to use the same channel as live notifications ({stream.channel_id})
                              </p>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => updateSubscriberChannel(stream.id, subChannelValue)}
                                >
                                  💾 Save
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setEditingSubChannel(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="text-sm bg-muted px-3 py-2 rounded flex-1">
                                {stream.subscriber_channel_id ? (
                                  <><span className="font-mono">{stream.subscriber_channel_id}</span> <span className="text-muted-foreground">(custom)</span></>
                                ) : (
                                  <><span className="font-mono">{stream.channel_id}</span> <span className="text-muted-foreground">(same as live)</span></>
                                )}
                              </p>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setEditingSubChannel(stream.id);
                                  setSubChannelValue(stream.subscriber_channel_id || '');
                                }}
                              >
                                ✏️ Edit
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Message Template Editor */}
                        <div className="space-y-2 pt-2 border-t">
                          <Label className="text-sm">Subscriber Message Template</Label>
                          {editingSubTemplate === stream.id ? (
                            <div className="space-y-2">
                              <Input 
                                value={subTemplateValue}
                                onChange={(e) => setSubTemplateValue(e.target.value)}
                                placeholder="🎉 {subscriber} just subscribed to {streamer}!"
                              />
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">Variables:</span> {'{subscriber}'}, {'{streamer}'}, {'{tier}'}<br/>
                                <span className="font-semibold">Custom Emoji:</span> Right-click emoji → Copy Link → Paste (e.g., {'<:name:123456>'})
                              </p>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => updateSubscriberTemplate(stream.id, subTemplateValue)}
                                >
                                  💾 Save
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setEditingSubTemplate(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-mono bg-muted px-3 py-2 rounded flex-1">
                                {stream.subscriber_message_template || '🎉 {subscriber} just subscribed to {streamer}!'}
                              </p>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setEditingSubTemplate(stream.id);
                                  setSubTemplateValue(stream.subscriber_message_template || '🎉 {subscriber} just subscribed to {streamer}!');
                                }}
                              >
                                ✏️ Edit
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Gifted Sub Message Template Editor */}
                        <div className="space-y-2 pt-2 border-t">
                          <Label className="text-sm">Gifted Subscription Message Template</Label>
                          {editingGiftedTemplate === stream.id ? (
                            <div className="space-y-2">
                              <Input 
                                value={giftedTemplateValue}
                                onChange={(e) => setGiftedTemplateValue(e.target.value)}
                                placeholder="🎁 {gifter} just gifted {amount} sub(s)!"
                              />
                              <p className="text-xs text-muted-foreground">
                                <span className="font-semibold">Variables:</span> {'{gifter}'}, {'{amount}'}, {'{streamer}'}, {'{tier}'}<br/>
                                <span className="font-semibold">Custom Emoji:</span> Right-click emoji → Copy Link → Paste (e.g., {'<:name:123456>'})
                              </p>
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => updateGiftedSubTemplate(stream.id, giftedTemplateValue)}
                                >
                                  💾 Save
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setEditingGiftedTemplate(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-mono bg-muted px-3 py-2 rounded flex-1">
                                {stream.gifted_sub_message_template || '🎁 {gifter} just gifted {amount} sub(s)!'}
                              </p>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  setEditingGiftedTemplate(stream.id);
                                  setGiftedTemplateValue(stream.gifted_sub_message_template || '🎁 {gifter} just gifted {amount} sub(s)!');
                                }}
                              >
                                ✏️ Edit
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Test Gifted Sub Button */}
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm">Test Gifted Subscription</Label>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => testGiftedSubNotification(stream.id, stream.streamer_name)}
                              disabled={testingStream === stream.id}
                            >
                              {testingStream === stream.id ? '⏳ Testing...' : '🧪 Test Gift Notification'}
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground">
                            💡 Test a gifted subscription without actually purchasing subs
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

