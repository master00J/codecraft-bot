'use client';

/**
 * ComCraft Discord Server Management
 * Full automated role & channel management
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

export default function ServerManagement() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [channels, setChannels] = useState<any>({});
  const [permissions, setPermissions] = useState<any>(null);
  const [quickSetupLoading, setQuickSetupLoading] = useState<string | null>(null);

  // Create role dialog
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRole, setNewRole] = useState({
    name: '',
    color: '#5865F2',
    hoist: false,
    mentionable: false
  });

  // Create channel dialog
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: '',
    type: 0, // Text channel
    topic: '',
    parent: ''
  });

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, channelsRes, permsRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/permissions`)
      ]);

      const [rolesData, channelsData, permsData] = await Promise.all([
        rolesRes.json(),
        channelsRes.json(),
        permsRes.json()
      ]);

      if (rolesData.success) setRoles(rolesData.roles || []);
      if (channelsData.success) setChannels(channelsData.channels || {});
      if (permsData.success) setPermissions(permsData.permissions || {});
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRole = async () => {
    if (!newRole.name) {
      toast({
        title: 'Role name required',
        description: 'Please provide a role name before creating it.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRole.name,
          color: parseInt(newRole.color.replace('#', ''), 16),
          hoist: newRole.hoist,
          mentionable: newRole.mentionable
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Role created',
          description: `The role "${newRole.name}" was created successfully.`
        });
        setShowCreateRole(false);
        setNewRole({ name: '', color: '#5865F2', hoist: false, mentionable: false });
        fetchData();
      } else {
        toast({
          title: 'Failed to create role',
          description: result.error || 'Something went wrong while creating the role.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error creating role:', error);
      toast({
        title: 'Failed to create role',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const createChannel = async () => {
    if (!newChannel.name) {
      toast({
        title: 'Channel name required',
        description: 'Please provide a channel name before creating it.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannel.name.toLowerCase().replace(/\s+/g, '-'),
          type: parseInt(newChannel.type.toString()),
          topic: newChannel.topic || null,
          parent: newChannel.parent || null
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Channel created',
          description: `The channel "#${newChannel.name}" was created successfully.`
        });
        setShowCreateChannel(false);
        setNewChannel({ name: '', type: 0, topic: '', parent: '' });
        fetchData();
      } else {
        toast({
          title: 'Failed to create channel',
          description: result.error || 'Something went wrong while creating the channel.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      toast({
        title: 'Failed to create channel',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const runQuickSetup = async (type: string) => {
    const confirmMessages = {
      leveling: 'This will create 5 level roles (Level 5, 10, 25, 50, 100). Continue?',
      streaming: 'This will create a #stream-alerts channel. Continue?',
      moderation: 'This will create a Muted role + #mod-logs channel. Continue?',
      welcome: 'This will create a #welcome channel. Continue?'
    };

    if (!confirm(confirmMessages[type as keyof typeof confirmMessages])) {
      return;
    }

    try {
      setQuickSetupLoading(type);

      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/quick-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Quick setup complete',
          description: `The "${type}" resources were created successfully.`
        });
        fetchData();
      } else {
        toast({
          title: 'Quick setup failed',
          description: result.error || 'Something went wrong while running the quick setup.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error in quick setup:', error);
      toast({
        title: 'Quick setup failed',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setQuickSetupLoading(null);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>← Back to Overview</Link>
        </Button>

        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                    ⚙️
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
                    Server Management
                  </h1>
                  <p className="text-muted-foreground max-w-xl">
                    Create roles, organize channels and run quick setup wizards to keep your Discord server structured and effortless to manage.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Badge className="bg-primary/10 text-primary px-4 py-2 border-0">Guild ID: {guildId}</Badge>
                <Badge variant="outline" className="px-4 py-2">Features: Roles • Channels • Quick Wizards</Badge>
              </div>
            </div>
          </div>
        </Card>

        {permissions && (
          <Card className="border-2 shadow-xl bg-gradient-to-r from-blue-500/10 to-primary/5">
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/20 rounded-xl text-2xl">🤖</div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">Bot Permissions Overview</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="flex items-center gap-2">{permissions.manageRoles ? '✅' : '❌'} Manage Roles</div>
                    <div className="flex items-center gap-2">{permissions.manageChannels ? '✅' : '❌'} Manage Channels</div>
                    <div className="flex items-center gap-2">{permissions.moderateMembers ? '✅' : '❌'} Moderate Members</div>
                    <div className="flex items-center gap-2">{permissions.administrator ? '✅' : '❌'} Administrator</div>
                  </div>
                </div>
              </div>
              {(!permissions.manageRoles || !permissions.manageChannels) && (
                <Badge variant="destructive" className="px-4 py-2">
                  ⚠️ Grant "Manage Roles" & "Manage Channels" so the bot can configure your server automatically.
                </Badge>
              )}
            </div>
          </Card>
        )}

        <Card className="border-2 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-6 border-b">
            <h2 className="text-xl font-bold flex items-center gap-3">
              <span className="p-2 bg-primary/10 rounded-lg">⚡</span>
              Quick Setup Wizards
            </h2>
            <p className="text-muted-foreground mt-2">
              Launch ready-to-use structures in seconds. Each wizard provisions the recommended roles and channels automatically.
            </p>
          </div>
          <div className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Button
                onClick={() => runQuickSetup('leveling')}
                className="justify-between h-16 bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90"
                disabled={quickSetupLoading !== null}
              >
                <span>⭐ Leveling System</span>
                <span className="text-xs text-white/80">
                  {quickSetupLoading === 'leveling' ? 'Running…' : 'Creates level 5, 10, 25, 50 & 100 roles'}
                </span>
              </Button>
              <Button
                onClick={() => runQuickSetup('streaming')}
                className="justify-between h-16 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90"
                disabled={quickSetupLoading !== null}
              >
                <span>🎮 Streaming Alerts</span>
                <span className="text-xs text-white/80">
                  {quickSetupLoading === 'streaming' ? 'Running…' : 'Creates #stream-alerts'}
                </span>
              </Button>
              <Button
                onClick={() => runQuickSetup('moderation')}
                className="justify-between h-16 bg-gradient-to-r from-rose-500 to-red-500 hover:opacity-90"
                disabled={quickSetupLoading !== null}
              >
                <span>🛡️ Moderation System</span>
                <span className="text-xs text-white/80">
                  {quickSetupLoading === 'moderation' ? 'Running…' : 'Creates Muted role + #mod-logs'}
                </span>
              </Button>
              <Button
                onClick={() => runQuickSetup('welcome')}
                className="justify-between h-16 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
                disabled={quickSetupLoading !== null}
              >
                <span>👋 Welcome System</span>
                <span className="text-xs text-white/80">
                  {quickSetupLoading === 'welcome' ? 'Running…' : 'Creates #welcome'}
                </span>
              </Button>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="roles" className="space-y-6">
          <TabsList className="w-full grid grid-cols-2 bg-muted/50 p-2 rounded-lg">
            <TabsTrigger value="roles" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              🎭 Roles ({roles.length})
            </TabsTrigger>
            <TabsTrigger value="channels" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              💬 Channels ({channels.all?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* ROLES TAB */}
          <TabsContent value="roles" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Role Management</h2>
              <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
                <DialogTrigger asChild>
                  <Button>➕ New Role</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                    <DialogDescription>
                      Create a new Discord role directly through the bot integration.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="roleName">Role Name *</Label>
                      <Input
                        id="roleName"
                        value={newRole.name}
                        onChange={(e) => setNewRole({...newRole, name: e.target.value})}
                        placeholder="VIP Members"
                      />
                    </div>
                    <div>
                      <Label htmlFor="roleColor">Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={newRole.color}
                          onChange={(e) => setNewRole({...newRole, color: e.target.value})}
                          className="w-20"
                        />
                        <Input
                          value={newRole.color}
                          onChange={(e) => setNewRole({...newRole, color: e.target.value})}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newRole.hoist}
                          onChange={(e) => setNewRole({...newRole, hoist: e.target.checked})}
                        />
                        <span className="text-sm">Display separately (hoist)</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newRole.mentionable}
                          onChange={(e) => setNewRole({...newRole, mentionable: e.target.checked})}
                        />
                        <span className="text-sm">Mentionable</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createRole} className="flex-1">
                        ✅ Create
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateRole(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Roles List */}
            <div className="space-y-2">
              {roles.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-gray-600">No roles found yet.</p>
                </Card>
              ) : (
                roles.map((role) => (
                  <Card key={role.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: `#${role.color.toString(16).padStart(6, '0')}` }}
                        />
                        <div>
                          <div className="font-semibold">{role.name}</div>
                          <div className="text-sm text-gray-600">
                            {role.members} members • Position {role.position}
                            {role.managed && ' • Managed'}
                            {role.hoist && ' • Hoisted'}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">ID: {role.id}</Badge>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* CHANNELS TAB */}
          <TabsContent value="channels" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Channel Management</h2>
              <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
                <DialogTrigger asChild>
                  <Button>➕ New Channel</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Channel</DialogTitle>
                    <DialogDescription>
                      Create a new Discord channel directly through the bot integration.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="channelName">Channel Name *</Label>
                      <Input
                        id="channelName"
                        value={newChannel.name}
                        onChange={(e) => setNewChannel({...newChannel, name: e.target.value})}
                        placeholder="general-chat"
                      />
                    </div>
                    <div>
                      <Label htmlFor="channelType">Type</Label>
                      <Select value={newChannel.type.toString()} onValueChange={(v) => setNewChannel({...newChannel, type: parseInt(v)})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">💬 Text Channel</SelectItem>
                          <SelectItem value="2">🔊 Voice Channel</SelectItem>
                          <SelectItem value="4">📁 Category</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="channelTopic">Topic (optional)</Label>
                      <Input
                        id="channelTopic"
                        value={newChannel.topic}
                        onChange={(e) => setNewChannel({...newChannel, topic: e.target.value})}
                        placeholder="Channel description..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="channelParent">Category (optional)</Label>
                      <Select value={newChannel.parent} onValueChange={(v) => setNewChannel({...newChannel, parent: v})}>
                        <SelectTrigger>
                          <SelectValue placeholder="No category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No category</SelectItem>
                          {channels.categories?.map((cat: any) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              📁 {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={createChannel} className="flex-1">
                        ✅ Create
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateChannel(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Channels List */}
            <div className="space-y-4">
              {/* Categories */}
              {channels.categories?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">📁 Categories</h3>
                  <div className="space-y-2">
                    {channels.categories.map((cat: any) => (
                      <Card key={cat.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">📁 {cat.name}</div>
                            <div className="text-sm text-gray-600">
                              Position {cat.position}
                            </div>
                          </div>
                          <Badge variant="outline">ID: {cat.id}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Channels */}
              {channels.text?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">💬 Text Channels</h3>
                  <div className="space-y-2">
                    {channels.text.map((ch: any) => (
                      <Card key={ch.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">💬 {ch.name}</div>
                            <div className="text-sm text-gray-600">
                              {ch.parentName && `In: ${ch.parentName} • `}
                              {ch.topic && `${ch.topic}`}
                            </div>
                          </div>
                          <Badge variant="outline">ID: {ch.id}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Voice Channels */}
              {channels.voice?.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">🔊 Voice Channels</h3>
                  <div className="space-y-2">
                    {channels.voice.map((ch: any) => (
                      <Card key={ch.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">🔊 {ch.name}</div>
                            <div className="text-sm text-gray-600">
                              {ch.parentName && `In: ${ch.parentName}`}
                            </div>
                          </div>
                          <Badge variant="outline">ID: {ch.id}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

