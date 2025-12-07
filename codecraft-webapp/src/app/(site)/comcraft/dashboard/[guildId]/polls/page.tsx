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
import { Trash2, Edit, Plus, BarChart3, Clock, CheckCircle2, XCircle, Download, FileText, Save, TrendingUp, Users, Shield } from 'lucide-react';

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
    weighted_voting: {} as Record<string, number>,
    reminder_enabled: false
  });

  const [roles, setRoles] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (guildId) {
      fetchPolls();
      fetchChannels();
      fetchRoles();
      fetchTemplates();
      fetchAnalytics();
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

  const fetchRoles = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/roles`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.roles) {
          setRoles(data.roles.filter((r: any) => !r.managed || r.name === '@everyone'));
        } else if (Array.isArray(data.roles)) {
          setRoles(data.roles.filter((r: any) => !r.managed || r.name === '@everyone'));
        } else {
          setRoles([]);
        }
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      setRoles([]);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/polls/templates`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/polls?action=analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
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
        weighted_voting: newPoll.weighted_voting,
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
          weighted_voting: {},
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

  const exportPoll = async (pollId: string, format: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/polls?id=${pollId}&action=export&format=${format}`);
      if (response.ok) {
        if (format === 'csv') {
          const text = await response.text();
          const blob = new Blob([text], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `poll-${pollId}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        } else {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `poll-${pollId}.json`;
          a.click();
          window.URL.revokeObjectURL(url);
        }
        toast({
          title: 'Success',
          description: `Poll exported as ${format.toUpperCase()}`,
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export poll',
        variant: 'destructive'
      });
    }
  };

  const saveAsTemplate = async (pollId: string) => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return;

    const name = prompt('Template name:');
    if (!name) return;

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/polls/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poll_id: pollId,
          name,
          description: poll.description || null
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Template saved successfully',
        });
        fetchTemplates();
      } else {
        throw new Error('Failed to save template');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save template',
        variant: 'destructive'
      });
    }
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

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Polls</p>
                <p className="text-2xl font-bold">{analytics.total_polls}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Polls</p>
                <p className="text-2xl font-bold">{analytics.active_polls}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Votes</p>
                <p className="text-2xl font-bold">{analytics.total_votes}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Votes/Poll</p>
                <p className="text-2xl font-bold">{analytics.average_votes_per_poll}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          {templates.length > 0 && <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>}
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

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="reminder_enabled"
                          checked={newPoll.reminder_enabled}
                          onCheckedChange={(checked) => setNewPoll({ ...newPoll, reminder_enabled: checked })}
                        />
                        <Label htmlFor="reminder_enabled">Enable reminder (1 hour before expiry)</Label>
                      </div>

                      <div>
                        <Label>Required Roles (Optional)</Label>
                        <p className="text-sm text-muted-foreground mb-2">
                          Users need at least one of these roles to vote
                        </p>
                        <Select
                          onValueChange={(roleId) => {
                            if (!newPoll.require_roles.includes(roleId)) {
                              setNewPoll({
                                ...newPoll,
                                require_roles: [...newPoll.require_roles, roleId]
                              });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role to require" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.filter(r => !newPoll.require_roles.includes(r.id)).map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {newPoll.require_roles.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {newPoll.require_roles.map((roleId) => {
                              const role = roles.find(r => r.id === roleId);
                              return role ? (
                                <Badge key={roleId} variant="secondary" className="flex items-center gap-1">
                                  {role.name}
                                  <button
                                    onClick={() => {
                                      setNewPoll({
                                        ...newPoll,
                                        require_roles: newPoll.require_roles.filter(r => r !== roleId)
                                      });
                                    }}
                                    className="ml-1"
                                  >
                                    <XCircle className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>

                      <div>
                        <Label>Weighted Voting (Optional)</Label>
                        <p className="text-sm text-muted-foreground mb-2">
                          Assign vote weights to roles (e.g., admins vote counts as 2x)
                        </p>
                        <div className="space-y-2">
                          {roles.filter(r => r.name !== '@everyone').slice(0, 10).map((role) => (
                            <div key={role.id} className="flex items-center gap-2">
                              <Label htmlFor={`weight_${role.id}`} className="flex-1">
                                {role.name}:
                              </Label>
                              <Input
                                id={`weight_${role.id}`}
                                type="number"
                                step="0.1"
                                min="0.1"
                                max="10"
                                className="w-20"
                                placeholder="1.0"
                                value={newPoll.weighted_voting[role.id] || ''}
                                onChange={(e) => {
                                  const weight = parseFloat(e.target.value) || 0;
                                  if (weight > 0) {
                                    setNewPoll({
                                      ...newPoll,
                                      weighted_voting: {
                                        ...newPoll.weighted_voting,
                                        [role.id]: weight
                                      }
                                    });
                                  } else {
                                    const newWeights = { ...newPoll.weighted_voting };
                                    delete newWeights[role.id];
                                    setNewPoll({
                                      ...newPoll,
                                      weighted_voting: newWeights
                                    });
                                  }
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportPoll(poll.id, 'json')}
                          title="Export as JSON"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportPoll(poll.id, 'csv')}
                          title="Export as CSV"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {poll.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => saveAsTemplate(poll.id)}
                            title="Save as template"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        )}
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

        <TabsContent value="templates" className="space-y-4">
          {templates.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No templates found</h3>
              <p className="text-muted-foreground mb-4">
                Save polls as templates to quickly reuse them later.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{template.name}</h3>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Title: {template.title}</span>
                        <span>•</span>
                        <span>{template.poll_type === 'multiple' ? 'Multiple' : 'Single'} Choice</span>
                        <span>•</span>
                        <span>{template.default_options.length} options</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        // Use template to create new poll
                        const templatePoll = {
                          title: template.title,
                          description: template.description_text || '',
                          poll_type: template.poll_type,
                          voting_type: template.voting_type,
                          options: template.default_options.map((text: string) => ({ text })),
                          require_roles: template.require_roles || [],
                          weighted_voting: template.weighted_voting || {}
                        };
                        setNewPoll({
                          ...templatePoll,
                          channel_id: '',
                          expires_at: '',
                          expires_in_hours: '',
                          allow_change_vote: true,
                          max_votes: template.poll_type === 'multiple' ? template.default_options.length : 1,
                          reminder_enabled: false
                        });
                        setCreatingNewPoll(true);
                        setActiveTab('active');
                      }}
                    >
                      Use Template
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

