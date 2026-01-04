'use client';

/**
 * ComCraft Staff Applications Management Dashboard
 * Configure and manage staff applications for your Discord server
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, FileText, Settings, Trash2, Search, CheckCircle, XCircle, Clock, Users, Plus, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Application {
  id: string;
  guild_id: string;
  user_id: string;
  username: string;
  answers: {
    responses: string[];
    avatar?: string;
  };
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  message_id: string | null;
  thread_id: string | null;
  votes_for: number;
  votes_against: number;
  voters: Array<{ user_id: string; type: string; timestamp: string }>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface ApplicationConfig {
  id: string;
  guild_id: string;
  channel_id: string;
  questions: string[];
  enabled: boolean;
  min_age: number;
  cooldown_days: number;
  require_account_age_days: number;
  auto_thread: boolean;
  ping_role_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function ApplicationsDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<Application[]>([]);
  const [config, setConfig] = useState<ApplicationConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);

  // Config form state
  const [channelId, setChannelId] = useState('');
  const [questions, setQuestions] = useState<string[]>(['What is your age?', 'Why do you want to join our staff team?', 'Do you have any previous moderation experience?', 'How many hours per week can you dedicate to this role?', 'Tell us about yourself and why you would be a good fit.']);
  const [enabled, setEnabled] = useState(true);
  const [cooldownDays, setCooldownDays] = useState(7);
  const [accountAgeDays, setAccountAgeDays] = useState(30);
  const [autoThread, setAutoThread] = useState(true);
  const [pingRoleId, setPingRoleId] = useState('');

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  useEffect(() => {
    filterApplications();
  }, [applications, searchQuery, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch config, applications, and channels in parallel
      const [configResponse, appsResponse, channelsResponse] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/application-config`),
        fetch(`/api/comcraft/guilds/${guildId}/applications`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`)
      ]);

      const configData = await configResponse.json();
      const appsData = await appsResponse.json();
      const channelsData = await channelsResponse.json();
      
      if (configData.config) {
        setConfig(configData.config);
        setChannelId(configData.config.channel_id);
        setQuestions(configData.config.questions);
        setEnabled(configData.config.enabled);
        setCooldownDays(configData.config.cooldown_days);
        setAccountAgeDays(configData.config.require_account_age_days);
        setAutoThread(configData.config.auto_thread);
        setPingRoleId(configData.config.ping_role_id || '');
      }

      if (appsData.applications) {
        setApplications(appsData.applications);
      }

      if (channelsData.channels?.text) {
        setChannels(channelsData.channels.text);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load applications data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterApplications = () => {
    let filtered = applications;

    // Filter by status
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(app => app.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(app =>
        app.username.toLowerCase().includes(query) ||
        app.user_id.toLowerCase().includes(query) ||
        app.answers.responses.some(r => r.toLowerCase().includes(query))
      );
    }

    setFilteredApplications(filtered);
  };

  const saveConfig = async () => {
    if (!channelId) {
      toast({
        title: 'Error',
        description: 'Please enter a channel ID',
        variant: 'destructive',
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one question',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/application-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          questions,
          enabled,
          cooldown_days: cooldownDays,
          require_account_age_days: accountAgeDays,
          auto_thread: autoThread,
          ping_role_id: pingRoleId || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save config');

      const data = await response.json();
      setConfig(data.config);

      toast({
        title: 'Success',
        description: 'Application configuration saved successfully',
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteApplication = async () => {
    if (!applicationToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/applications?applicationId=${applicationToDelete.id}&guildId=${guildId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete application');

      setApplications(applications.filter(app => app.id !== applicationToDelete.id));
      toast({
        title: 'Success',
        description: 'Application deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting application:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete application',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setApplicationToDelete(null);
    }
  };

  const addQuestion = () => {
    if (questions.length < 5) {
      setQuestions([...questions, '']);
    } else {
      toast({
        title: 'Limit Reached',
        description: 'You can have a maximum of 5 questions (Discord modal limit)',
        variant: 'destructive',
      });
    }
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    } else {
      toast({
        title: 'Error',
        description: 'You must have at least one question',
        variant: 'destructive',
      });
    }
  };

  const updateQuestion = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      pending: { color: 'bg-yellow-500', label: 'Pending', icon: <Clock className="h-3 w-3" /> },
      approved: { color: 'bg-green-500', label: 'Approved', icon: <CheckCircle className="h-3 w-3" /> },
      rejected: { color: 'bg-red-500', label: 'Rejected', icon: <XCircle className="h-3 w-3" /> },
      withdrawn: { color: 'bg-gray-500', label: 'Withdrawn', icon: <XCircle className="h-3 w-3" /> },
    };

    const variant = variants[status] || variants.pending;
    return (
      <Badge className={`${variant.color} text-white flex items-center gap-1`}>
        {variant.icon}
        {variant.label}
      </Badge>
    );
  };

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/comcraft/dashboard/${guildId}`}>
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Staff Applications
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure and manage staff applications for your Discord server
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Applications</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold text-green-500">{stats.approved}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-2xl font-bold text-red-500">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="applications" className="w-full">
        <TabsList>
          <TabsTrigger value="applications">
            <FileText className="h-4 w-4 mr-2" />
            Applications
          </TabsTrigger>
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search applications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Votes</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reviewed By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No applications found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredApplications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{app.username}</p>
                            <p className="text-xs text-muted-foreground">{app.user_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(app.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">👍 {app.votes_for}</span>
                            <span className="text-red-600">👎 {app.votes_against}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(app.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {app.reviewed_by ? (
                            <div className="text-sm">
                              <p>{app.reviewed_by}</p>
                              <p className="text-xs text-muted-foreground">
                                {app.reviewed_at && new Date(app.reviewed_at).toLocaleDateString()}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setApplicationToDelete(app);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Application Settings</h2>
            <div className="space-y-6">
              {/* Basic Settings */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="channelId">Application Channel *</Label>
                  <Select
                    value={channelId}
                    onValueChange={setChannelId}
                  >
                    <SelectTrigger id="channelId">
                      <SelectValue placeholder="Select a channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.length === 0 ? (
                        <SelectItem value="placeholder" disabled>
                          No channels available
                        </SelectItem>
                      ) : (
                        channels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Applications will be posted in this channel
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enabled">Enable Applications</Label>
                    <p className="text-sm text-muted-foreground">Allow users to submit applications</p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoThread">Auto-create Threads</Label>
                    <p className="text-sm text-muted-foreground">Create a thread for each application</p>
                  </div>
                  <Switch
                    id="autoThread"
                    checked={autoThread}
                    onCheckedChange={setAutoThread}
                  />
                </div>
              </div>

              <Separator />

              {/* Advanced Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Requirements & Limits</h3>

                <div>
                  <Label htmlFor="cooldownDays">Cooldown Period (days)</Label>
                  <Input
                    id="cooldownDays"
                    type="number"
                    min="0"
                    value={cooldownDays}
                    onChange={(e) => setCooldownDays(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Days users must wait before applying again
                  </p>
                </div>

                <div>
                  <Label htmlFor="accountAgeDays">Minimum Account Age (days)</Label>
                  <Input
                    id="accountAgeDays"
                    type="number"
                    min="0"
                    value={accountAgeDays}
                    onChange={(e) => setAccountAgeDays(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum Discord account age required to apply
                  </p>
                </div>

                <div>
                  <Label htmlFor="pingRoleId">Ping Role ID (optional)</Label>
                  <Input
                    id="pingRoleId"
                    placeholder="Enter role ID to ping"
                    value={pingRoleId}
                    onChange={(e) => setPingRoleId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Role to ping when a new application is submitted
                  </p>
                </div>
              </div>

              <Separator />

              {/* Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Application Questions</h3>
                    <p className="text-sm text-muted-foreground">
                      Maximum 5 questions (Discord modal limit)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addQuestion}
                    disabled={questions.length >= 5}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>

                {questions.map((question, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor={`question-${index}`}>Question {index + 1}</Label>
                      <Textarea
                        id={`question-${index}`}
                        placeholder="Enter your question"
                        value={question}
                        onChange={(e) => updateQuestion(index, e.target.value)}
                        rows={2}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(index)}
                      disabled={questions.length <= 1}
                      className="mt-6"
                    >
                      <Minus className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <Button
                onClick={saveConfig}
                disabled={saving}
                className="w-full"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this application? This action cannot be undone.
              {applicationToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <p className="font-medium">{applicationToDelete.username}</p>
                  <p className="text-xs">{applicationToDelete.user_id}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteApplication}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
