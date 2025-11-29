'use client';

/**
 * ComCraft - Polls & Voting Management Page
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Edit, Plus, BarChart3, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Poll {
  id: string;
  title: string;
  description?: string;
  channel_id: string;
  message_id?: string;
  poll_type: 'single' | 'multiple';
  voting_type: 'public' | 'anonymous';
  status: 'active' | 'closed' | 'cancelled';
  total_votes: number;
  expires_at?: string;
  created_at: string;
  poll_options: PollOption[];
}

interface PollOption {
  id: string;
  option_text: string;
  emoji?: string;
  vote_count: number;
  option_order: number;
}

export default function PollsConfig() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [polls, setPolls] = useState<Poll[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [creatingNewPoll, setCreatingNewPoll] = useState(false);

  const [newPoll, setNewPoll] = useState({
    title: '',
    description: '',
    channel_id: '',
    poll_type: 'single' as 'single' | 'multiple',
    voting_type: 'public' as 'public' | 'anonymous',
    options: ['', ''] as string[],
    expires_at: '',
    expires_in_hours: '',
    allow_change_vote: true,
    max_votes: 1,
    require_roles: [] as string[],
    reminder_enabled: false
  });

  useEffect(() => {
    if (guildId) {
      fetchPolls();
      fetchChannels();
    }
  }, [guildId, activeTab]);

  const fetchPolls = async () => {
    try {
      const status = activeTab === 'active' ? 'active' : activeTab === 'closed' ? 'closed' : 'all';
      const response = await fetch(`/api/comcraft/guilds/${guildId}/polls?status=${status}`);
      if (response.ok) {
        const data = await response.json();
        setPolls(data.polls || []);
      }
    } catch (error) {
      console.error('Error fetching polls:', error);
      toast({
        title: 'Error',
        description: 'Failed to load polls',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/channels`);
      if (response.ok) {
        const data = await response.json();
        // Bot API returns { success, channels: { all, text, voice, categories } }
        // We only want text channels (already filtered by bot)
        if (data.success && data.channels) {
          setChannels(data.channels.text || []);
        } else if (Array.isArray(data.channels)) {
          // Fallback: if channels is already an array
          setChannels(data.channels.filter((ch: any) => ch.type === 0 || ch.type === 5));
        } else {
          setChannels([]);
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      setChannels([]);
    }
  };

  const savePoll = async () => {
    if (!newPoll.title || !newPoll.channel_id || newPoll.options.filter(o => o.trim()).length < 2) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in title, select a channel, and provide at least 2 options.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const options = newPoll.options.filter(o => o.trim()).map(text => ({ text: text.trim() }));
      
      let expires_at = null;
      if (newPoll.expires_in_hours && parseInt(newPoll.expires_in_hours) > 0) {
        const hours = parseInt(newPoll.expires_in_hours);
        expires_at = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      }

      const pollData = {
        title: newPoll.title,
        description: newPoll.description || null,
        channel_id: newPoll.channel_id,
        poll_type: newPoll.poll_type,
        voting_type: newPoll.voting_type,
        options,
        expires_at,
        allow_change_vote: newPoll.allow_change_vote,
        max_votes: newPoll.max_votes,
        require_roles: newPoll.require_roles,
        reminder_enabled: newPoll.reminder_enabled
      };

      const response = await fetch(`/api/comcraft/guilds/${guildId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pollData)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Poll created successfully! It will be posted to the selected channel.',
        });
        
        // Reset form
        setNewPoll({
          title: '',
          description: '',
          channel_id: '',
          poll_type: 'single',
          voting_type: 'public',
          options: ['', ''],
          expires_at: '',
          expires_in_hours: '',
          allow_change_vote: true,
          max_votes: 1,
          require_roles: [],
          reminder_enabled: false
        });
        setCreatingNewPoll(false);
        fetchPolls();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create poll');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create poll',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/polls?id=${pollId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Poll deleted successfully',
        });
        fetchPolls();
      } else {
        throw new Error('Failed to delete poll');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete poll',
        variant: 'destructive'
      });
    }
  };

  const closePoll = async (pollId: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/polls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pollId, status: 'closed' })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Poll closed successfully',
        });
        fetchPolls();
      } else {
        throw new Error('Failed to close poll');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to close poll',
        variant: 'destructive'
      });
    }
  };

  const addOption = () => {
    if (newPoll.options.length < 25) {
      setNewPoll({ ...newPoll, options: [...newPoll.options, ''] });
    }
  };

  const removeOption = (index: number) => {
    if (newPoll.options.length > 2) {
      const newOptions = newPoll.options.filter((_, i) => i !== index);
      setNewPoll({ ...newPoll, options: newOptions });
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...newPoll.options];
    newOptions[index] = value;
    setNewPoll({ ...newPoll, options: newOptions });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading polls...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Polls & Voting</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage polls with real-time results, anonymous voting, and scheduled reminders.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreatingNewPoll(true);
            setNewPoll({
              title: '',
              description: '',
              channel_id: '',
              poll_type: 'single',
              voting_type: 'public',
              options: ['', ''],
              expires_at: '',
              expires_in_hours: '',
              allow_change_vote: true,
              max_votes: 1,
              require_roles: [],
              reminder_enabled: false
            });
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Poll
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {polls.length === 0 && !creatingNewPoll ? (
            <Card className="p-8 text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No polls found</h3>
              <p className="text-muted-foreground mb-4">
                {activeTab === 'active' 
                  ? 'Create your first poll to start gathering opinions from your community!'
                  : 'No polls in this category yet.'}
              </p>
              <Button onClick={() => setCreatingNewPoll(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Poll
              </Button>
            </Card>
          ) : (
            <>
              {creatingNewPoll && (
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Create New Poll</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="poll_title">Poll Title *</Label>
                      <Input
                        id="poll_title"
                        value={newPoll.title}
                        onChange={(e) => setNewPoll({ ...newPoll, title: e.target.value })}
                        placeholder="What's your favorite color?"
                      />
                    </div>

                    <div>
                      <Label htmlFor="poll_description">Description (optional)</Label>
                      <Textarea
                        id="poll_description"
                        value={newPoll.description}
                        onChange={(e) => setNewPoll({ ...newPoll, description: e.target.value })}
                        placeholder="Additional context for the poll..."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="poll_channel">Channel *</Label>
                        <Select
                          value={newPoll.channel_id}
                          onValueChange={(value) => setNewPoll({ ...newPoll, channel_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select channel" />
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

                      <div>
                        <Label htmlFor="poll_type">Poll Type</Label>
                        <Select
                          value={newPoll.poll_type}
                          onValueChange={(value: 'single' | 'multiple') => 
                            setNewPoll({ 
                              ...newPoll, 
                              poll_type: value,
                              max_votes: value === 'multiple' ? 2 : 1
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Single Choice</SelectItem>
                            <SelectItem value="multiple">Multiple Choice</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="voting_type">Voting Type</Label>
                        <Select
                          value={newPoll.voting_type}
                          onValueChange={(value: 'public' | 'anonymous') => 
                            setNewPoll({ ...newPoll, voting_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="anonymous">Anonymous</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {newPoll.poll_type === 'multiple' && (
                        <div>
                          <Label htmlFor="max_votes">Max Votes</Label>
                          <Input
                            id="max_votes"
                            type="number"
                            min={1}
                            max={newPoll.options.length}
                            value={newPoll.max_votes}
                            onChange={(e) => setNewPoll({ ...newPoll, max_votes: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Poll Options *</Label>
                      <div className="space-y-2 mt-2">
                        {newPoll.options.map((option, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={option}
                              onChange={(e) => updateOption(index, e.target.value)}
                              placeholder={`Option ${index + 1}`}
                            />
                            {newPoll.options.length > 2 && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => removeOption(index)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {newPoll.options.length < 25 && (
                          <Button
                            variant="outline"
                            onClick={addOption}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Option
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expires_in_hours">Duration (hours, 0 = no expiry)</Label>
                        <Input
                          id="expires_in_hours"
                          type="number"
                          min={0}
                          value={newPoll.expires_in_hours}
                          onChange={(e) => setNewPoll({ ...newPoll, expires_in_hours: e.target.value })}
                          placeholder="24"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-8">
                        <Switch
                          id="allow_change_vote"
                          checked={newPoll.allow_change_vote}
                          onCheckedChange={(checked) => setNewPoll({ ...newPoll, allow_change_vote: checked })}
                        />
                        <Label htmlFor="allow_change_vote">Allow vote changes</Label>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="reminder_enabled"
                        checked={newPoll.reminder_enabled}
                        onCheckedChange={(checked) => setNewPoll({ ...newPoll, reminder_enabled: checked })}
                      />
                      <Label htmlFor="reminder_enabled">Enable reminder (1 hour before expiry)</Label>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={savePoll}
                        disabled={saving}
                      >
                        {saving ? 'Creating...' : 'Create Poll'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCreatingNewPoll(false);
                          setNewPoll({
                            title: '',
                            description: '',
                            channel_id: '',
                            poll_type: 'single',
                            voting_type: 'public',
                            options: ['', ''],
                            expires_at: '',
                            expires_in_hours: '',
                            allow_change_vote: true,
                            max_votes: 1,
                            require_roles: [],
                            reminder_enabled: false
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              <div className="space-y-4">
                {polls.map((poll) => (
                  <Card key={poll.id} className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{poll.title}</h3>
                          <Badge variant={poll.status === 'active' ? 'default' : 'secondary'}>
                            {poll.status}
                          </Badge>
                          <Badge variant="outline">{poll.poll_type === 'multiple' ? 'Multiple' : 'Single'}</Badge>
                          <Badge variant="outline">{poll.voting_type === 'anonymous' ? 'Anonymous' : 'Public'}</Badge>
                        </div>
                        {poll.description && (
                          <p className="text-muted-foreground mb-2">{poll.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Total Votes: {poll.total_votes || 0}</span>
                          {poll.expires_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires: {formatDate(poll.expires_at)}
                            </span>
                          )}
                          {poll.message_id && (
                            <a
                              href={`https://discord.com/channels/${guildId}/${poll.channel_id}/${poll.message_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              View Poll
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {poll.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => closePoll(poll.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Close
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deletePoll(poll.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Options & Results:</h4>
                      {poll.poll_options.map((option, index) => {
                        const percentage = poll.total_votes > 0
                          ? ((option.vote_count / poll.total_votes) * 100).toFixed(1)
                          : 0;
                        return (
                          <div key={option.id} className="flex items-center gap-2">
                            <span className="w-6 text-sm font-medium">
                              {String.fromCharCode(65 + index)}.
                            </span>
                            <div className="flex-1">
                              <div className="flex justify-between text-sm mb-1">
                                <span>{option.emoji} {option.option_text}</span>
                                <span className="text-muted-foreground">
                                  {option.vote_count} votes ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

