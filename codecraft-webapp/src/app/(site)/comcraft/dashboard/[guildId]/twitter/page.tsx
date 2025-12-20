'use client';

/**
 * Twitter/X Monitor Dashboard
 * Manage Twitter account notifications
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TwitterMonitor {
  id: string;
  guild_id: string;
  channel_id: string;
  twitter_username: string;
  enabled: boolean;
  include_retweets: boolean;
  include_replies: boolean;
  notification_message: string | null;
  mention_role_id: string | null;
  last_tweet_at: string | null;
  last_check_at: string | null;
  created_at: string;
}

export default function TwitterDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [monitors, setMonitors] = useState<TwitterMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [monitorToDelete, setMonitorToDelete] = useState<string | null>(null);

  const [newMonitor, setNewMonitor] = useState({
    twitter_username: '',
    channel_id: '',
    include_retweets: false,
    include_replies: false,
    notification_message: '',
    mention_role_id: ''
  });

  useEffect(() => {
    if (guildId) {
      fetchMonitors();
    }
  }, [guildId]);

  const fetchMonitors = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/twitter`);
      const data = await response.json();
      setMonitors(data.monitors || []);
    } catch (error) {
      console.error('Error fetching Twitter monitors:', error);
      toast({
        title: 'Failed to load monitors',
        description: 'Could not fetch Twitter monitors',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createMonitor = async () => {
    if (!newMonitor.twitter_username || !newMonitor.channel_id) {
      toast({
        title: 'Missing details',
        description: 'Please provide both Twitter username and Discord channel ID',
        variant: 'destructive'
      });
      return;
    }

    try {
      setCreating(true);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/twitter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMonitor)
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Monitor added',
          description: `Now monitoring @${newMonitor.twitter_username.replace('@', '')}`,
        });
        setNewMonitor({
          twitter_username: '',
          channel_id: '',
          include_retweets: false,
          include_replies: false,
          notification_message: '',
          mention_role_id: ''
        });
        setShowForm(false);
        fetchMonitors();
      } else {
        toast({
          title: 'Failed to add monitor',
          description: data.error || 'Could not add Twitter monitor',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Create failed',
        description: 'An error occurred while adding the monitor',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleEnabled = async (monitorId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/twitter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitor_id: monitorId, enabled })
      });

      if (response.ok) {
        toast({
          title: enabled ? 'Monitor enabled' : 'Monitor disabled',
          description: enabled ? 'Tweets will be posted to Discord' : 'Monitoring paused',
        });
        fetchMonitors();
      } else {
        toast({
          title: 'Update failed',
          description: 'Could not update monitor status',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'An error occurred',
        variant: 'destructive'
      });
    }
  };

  const deleteMonitor = async () => {
    if (!monitorToDelete) return;

    try {
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/twitter?monitorId=${monitorToDelete}&guildId=${guildId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast({
          title: 'Monitor deleted',
          description: 'Twitter monitor has been removed',
        });
        fetchMonitors();
      } else {
        toast({
          title: 'Delete failed',
          description: 'Could not delete monitor',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setDeleteDialogOpen(false);
      setMonitorToDelete(null);
    }
  };

  const confirmDelete = (monitorId: string) => {
    setMonitorToDelete(monitorId);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading Twitter monitors...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Twitter/X Monitors</h1>
          <p className="text-muted-foreground mt-2">
            Automatically post new tweets from Twitter/X accounts to your Discord channels
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Monitor'}
        </Button>
      </div>

      {/* Add Monitor Form */}
      {showForm && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Add Twitter Monitor</h3>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="twitter_username">Twitter Username *</Label>
              <Input
                id="twitter_username"
                placeholder="@username or username"
                value={newMonitor.twitter_username}
                onChange={(e) => setNewMonitor({ ...newMonitor, twitter_username: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="channel_id">Discord Channel ID *</Label>
              <Input
                id="channel_id"
                placeholder="123456789012345678"
                value={newMonitor.channel_id}
                onChange={(e) => setNewMonitor({ ...newMonitor, channel_id: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Right-click channel → Copy Channel ID (Developer Mode required)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="include_retweets"
                checked={newMonitor.include_retweets}
                onCheckedChange={(checked) => setNewMonitor({ ...newMonitor, include_retweets: checked })}
              />
              <Label htmlFor="include_retweets" className="cursor-pointer">
                Include Retweets
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="include_replies"
                checked={newMonitor.include_replies}
                onCheckedChange={(checked) => setNewMonitor({ ...newMonitor, include_replies: checked })}
              />
              <Label htmlFor="include_replies" className="cursor-pointer">
                Include Replies
              </Label>
            </div>

            <div>
              <Label htmlFor="mention_role_id">Mention Role ID (Optional)</Label>
              <Input
                id="mention_role_id"
                placeholder="123456789012345678"
                value={newMonitor.mention_role_id}
                onChange={(e) => setNewMonitor({ ...newMonitor, mention_role_id: e.target.value })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Role to mention when posting tweets
              </p>
            </div>

            <div>
              <Label htmlFor="notification_message">Custom Message (Optional)</Label>
              <Input
                id="notification_message"
                placeholder="New tweet from {username}!"
                value={newMonitor.notification_message}
                onChange={(e) => setNewMonitor({ ...newMonitor, notification_message: e.target.value })}
              />
            </div>

            <Button onClick={createMonitor} disabled={creating} className="w-full">
              {creating ? 'Adding...' : 'Add Monitor'}
            </Button>
          </div>
        </Card>
      )}

      {/* Monitors List */}
      <div className="space-y-4">
        {monitors.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">🐦</div>
            <h3 className="text-xl font-semibold mb-2">No Twitter Monitors</h3>
            <p className="text-muted-foreground mb-4">
              Add a Twitter account to start receiving tweet notifications in Discord
            </p>
            <Button onClick={() => setShowForm(true)}>Add Your First Monitor</Button>
          </Card>
        ) : (
          monitors.map((monitor) => (
            <Card key={monitor.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">@{monitor.twitter_username}</h3>
                    <Badge variant={monitor.enabled ? 'default' : 'secondary'}>
                      {monitor.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                    {monitor.include_retweets && (
                      <Badge variant="outline">Retweets</Badge>
                    )}
                    {monitor.include_replies && (
                      <Badge variant="outline">Replies</Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>📺 Channel ID: {monitor.channel_id}</p>
                    {monitor.mention_role_id && (
                      <p>🔔 Mention Role: {monitor.mention_role_id}</p>
                    )}
                    {monitor.notification_message && (
                      <p>💬 Message: {monitor.notification_message}</p>
                    )}
                    {monitor.last_tweet_at && (
                      <p>
                        🕒 Last Tweet: {new Date(monitor.last_tweet_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={monitor.enabled}
                      onCheckedChange={(checked) => toggleEnabled(monitor.id, checked)}
                    />
                    <Label className="text-sm">
                      {monitor.enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => confirmDelete(monitor.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Twitter Monitor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop monitoring this Twitter account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteMonitor} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Help Section */}
      <Card className="p-6 bg-muted">
        <h3 className="font-semibold mb-2">ℹ️ How it works</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>• Add Twitter accounts to monitor for new tweets</li>
          <li>• Choose whether to include retweets and replies</li>
          <li>• New tweets are automatically posted to your Discord channel</li>
          <li>• Uses multiple methods (RapidAPI + Nitter RSS) for reliability</li>
          <li>• Checks for new tweets every 2 minutes</li>
        </ul>
      </Card>
    </div>
  );
}
