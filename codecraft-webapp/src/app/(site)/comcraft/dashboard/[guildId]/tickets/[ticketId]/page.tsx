'use client';

/**
 * Comcraft - Single Ticket Details Page
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface Ticket {
  id: string;
  ticket_number: string;
  guild_id: string;
  discord_user_id: string;
  discord_username: string;
  discord_channel_id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  claimed_by_discord_id: string | null;
  claimed_by_username: string | null;
  claimed_at: string | null;
  closed_by_discord_id: string | null;
  closed_by_username: string | null;
  closed_at: string | null;
  close_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  discord_message_id: string;
  author_discord_id: string;
  author_username: string;
  content: string;
  has_attachments: boolean;
  has_embeds: boolean;
  created_at: string;
}

interface Rating {
  id: string;
  ticket_id: string;
  rating: number;
  feedback: string;
  created_at: string;
}

export default function TicketDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;
  const ticketId = params.ticketId as string;
  const { toast } = useToast();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [rating, setRating] = useState<Rating | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeReason, setCloseReason] = useState('Resolved from dashboard');

  useEffect(() => {
    if (guildId && ticketId) {
      fetchTicket();
    }
  }, [guildId, ticketId]);

  const fetchTicket = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`);
      const data = await response.json();
      
      if (response.ok) {
        setTicket(data.ticket);
        setMessages(data.messages || []);
        setRating(data.rating);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to load ticket',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to load ticket',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action: string, additionalData: any = {}) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...additionalData })
      });

      if (response.ok) {
        toast({
          title: 'Success!',
          description: `Action "${action}" completed successfully.`,
        });
        fetchTicket();
        if (action === 'close') {
          setShowCloseDialog(false);
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Action failed',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Action failed',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const deleteTicket = async () => {
    if (!confirm('Are you sure you want to permanently delete this ticket?')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Deleted!',
          description: 'Ticket has been removed permanently.',
        });
        router.push(`/comcraft/dashboard/${guildId}/tickets`);
      } else {
        toast({
          title: 'Error',
          description: 'Could not delete the ticket',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not delete the ticket',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      open: 'bg-green-500',
      claimed: 'bg-blue-500',
      closed: 'bg-gray-500',
      resolved: 'bg-purple-500'
    };
    return <Badge className={styles[status as keyof typeof styles] || 'bg-gray-500'}>
      {status.toUpperCase()}
    </Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      low: 'bg-gray-400',
      normal: 'bg-blue-400',
      high: 'bg-orange-500',
      urgent: 'bg-red-600'
    };
    return <Badge className={styles[priority as keyof typeof styles] || 'bg-blue-400'}>
      {priority.toUpperCase()}
    </Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">❌ Ticket not found</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This ticket either does not exist or you do not have permission to view it.
            </p>
            <Button asChild>
              <Link href={`/comcraft/dashboard/${guildId}/tickets`}>
                ← Back to tickets
              </Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{ticket.ticket_number}</h1>
                {getStatusBadge(ticket.status)}
                {getPriorityBadge(ticket.priority)}
              </div>
              <h2 className="text-xl text-gray-700 dark:text-gray-300">{ticket.subject}</h2>
            </div>
            <Button asChild variant="outline">
              <Link href={`/comcraft/dashboard/${guildId}/tickets`}>← Back</Link>
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Info */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">📋 Ticket information</h3>
              
              {ticket.description && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-gray-700 dark:text-gray-300">{ticket.description}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Created by:</span>
                  <div className="font-semibold">{ticket.discord_username || 'Unknown'}</div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Created on:</span>
                  <div className="font-semibold">{formatDate(ticket.created_at)}</div>
                </div>
                {ticket.claimed_by_username && (
                  <>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Claimed by:</span>
                      <div className="font-semibold">{ticket.claimed_by_username}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Claimed on:</span>
                      <div className="font-semibold">{ticket.claimed_at ? formatDate(ticket.claimed_at) : '-'}</div>
                    </div>
                  </>
                )}
                {ticket.closed_at && (
                  <>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Closed by:</span>
                      <div className="font-semibold">{ticket.closed_by_username || 'Unknown'}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Closed on:</span>
                      <div className="font-semibold">{formatDate(ticket.closed_at)}</div>
                    </div>
                  </>
                )}
                {ticket.close_reason && (
                  <div className="md:col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Close reason:</span>
                    <div className="font-semibold">{ticket.close_reason}</div>
                  </div>
                )}
              </div>
            </Card>

            {/* Messages */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">💬 Messages ({messages.length})</h3>
                {messages.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        const response = await fetch(`/api/comcraft/guilds/${guildId}/tickets/${ticketId}/sync-messages`, {
                          method: 'POST'
                        });
                        const data = await response.json();
                        if (response.ok) {
                          toast({
                            title: 'Success!',
                            description: `Synced ${data.synced || 0} messages from Discord.`,
                          });
                          fetchTicket();
                        } else {
                          toast({
                            title: 'Error',
                            description: data.error || 'Failed to sync messages',
                            variant: 'destructive'
                          });
                        }
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: 'Failed to sync messages',
                          variant: 'destructive'
                        });
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Syncing...' : '🔄 Sync Messages from Discord'}
                  </Button>
                )}
              </div>
              
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No messages found. Click "Sync Messages" to load messages from Discord.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {messages.map((message) => (
                    <div key={message.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{message.author_username}</span>
                        <span className="text-xs text-gray-500">
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {message.content || '(No text)'}
                      </p>
                      {message.has_attachments && (
                        <Badge variant="outline" className="mt-2">📎 Attachment</Badge>
                      )}
                      {message.has_embeds && (
                        <Badge variant="outline" className="mt-2">📋 Embed</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Rating */}
            {rating && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">⭐ User Rating</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl font-bold text-yellow-500">
                    {rating.rating}/5
                  </div>
                  <div className="text-2xl">
                    {'⭐'.repeat(rating.rating)}
                  </div>
                </div>
                {rating.feedback && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300">{rating.feedback}</p>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Sidebar - Actions */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">⚡ Actions</h3>
              
              <div className="space-y-3">
                {ticket.status === 'open' && (
                  <Button 
                    className="w-full"
                    onClick={() => performAction('claim')}
                    disabled={actionLoading}
                  >
                    🙋 Claim Ticket
                  </Button>
                )}

                {(ticket.status === 'open' || ticket.status === 'claimed') && (
                  <Button 
                    className="w-full"
                    variant="destructive"
                    onClick={() => setShowCloseDialog(true)}
                    disabled={actionLoading}
                  >
                    🔒 Close Ticket
                  </Button>
                )}

                {(ticket.status === 'closed' || ticket.status === 'resolved') && (
                  <Button 
                    className="w-full"
                    variant="secondary"
                    onClick={() => performAction('reopen')}
                    disabled={actionLoading}
                  >
                    🔓 Reopen ticket
                  </Button>
                )}

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select 
                    value={ticket.priority}
                    onValueChange={(value) => performAction('update_priority', { priority: value })}
                    disabled={actionLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <hr className="my-4" />

                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    const channelUrl = `https://discord.com/channels/${ticket.guild_id}/${ticket.discord_channel_id}`;
                    window.open(channelUrl, '_blank');
                  }}
                >
                  🔗 View channel in Discord
                </Button>

                <Button 
                  className="w-full"
                  variant="destructive"
                  onClick={deleteTicket}
                  disabled={actionLoading}
                >
                  🗑️ Delete ticket
                </Button>
              </div>
            </Card>

            {/* Quick Info */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">ℹ️ Ticket info</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Ticket ID:</span>
                  <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 break-all">
                    {ticket.id}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Discord Channel ID:</span>
                  <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 break-all">
                    {ticket.discord_channel_id}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">User ID:</span>
                  <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1 break-all">
                    {ticket.discord_user_id}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Close Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close ticket</DialogTitle>
            <DialogDescription>
              Are you sure you want to close this ticket?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="close-reason">Reason</Label>
              <Input
                id="close-reason"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="Issue resolved"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => performAction('close', { reason: closeReason })}
                disabled={actionLoading}
              >
                🔒 Close ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

