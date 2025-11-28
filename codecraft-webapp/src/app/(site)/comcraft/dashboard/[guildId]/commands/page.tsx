'use client';

/**
 * Comcraft - Custom Commands Management
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export default function CustomCommands() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();
  
  const [commands, setCommands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [newCommand, setNewCommand] = useState({
    trigger: '',
    response: '',
    embed_enabled: false
  });

  useEffect(() => {
    if (guildId) {
      fetchCommands();
    }
  }, [guildId]);

  const fetchCommands = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/commands`);
      const data = await response.json();
      setCommands(data.commands || []);
    } catch (error) {
      console.error('Error fetching commands:', error);
    } finally {
      setLoading(false);
    }
  };

  const [creating, setCreating] = useState(false);

  const createCommand = async () => {
    if (!newCommand.trigger || !newCommand.response) {
      toast({
        title: 'Missing information',
        description: 'Trigger and response are required.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setCreating(true);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCommand)
      });

      if (response.ok) {
        toast({
          title: 'Command created',
          description: `!${newCommand.trigger} is now available to your members.`,
        });
        setNewCommand({ trigger: '', response: '', embed_enabled: false });
        setShowForm(false);
        fetchCommands();
      } else {
        const data = await response.json();
        toast({
          title: 'Create failed',
          description: data.error || 'We could not create this command.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Create failed',
        description: 'We could not create this command.',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  const deleteCommand = async (commandId: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/commands?id=${commandId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Command deleted',
          description: 'The command has been removed.',
        });
        fetchCommands();
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'We could not remove this command.',
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <Button asChild variant="ghost" className="w-fit hover:bg-primary/10">
          <Link href={`/comcraft/dashboard/${guildId}`}>← Back to Overview</Link>
        </Button>

        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-8 flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                  📝
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to紫色 bg-clip-text text-transparent">Custom Commands Studio</h1>
                <p className="text-muted-foreground max-w-2xl">
                  Craft tailored responses, automate onboarding flows or create fun mini-games. Everything is managed directly from your dashboard.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-primary/10 text-primary px-4 py-2 border-0">{commands.length} active commands</Badge>
              <Badge variant="outline" className="px-4 py-2">Variables: {'{user}'}, {'{username}'}, {'{server}'}, {'{membercount}'}</Badge>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Create new command</h2>
            <p className="text-muted-foreground">Triggers are automatically prefixed with your server prefix.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="lg">
            ➕ {showForm ? 'Cancel' : 'New Command'}
          </Button>
        </div>

        {/* New Command Form */}
        {showForm && (
          <Card className="p-6 mb-6 border-2 shadow-xl">
            <h2 className="text-xl font-bold mb-6">Define your command</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Command Trigger</Label>
                <Input 
                  value={newCommand.trigger}
                  onChange={(e) => setNewCommand({...newCommand, trigger: e.target.value.toLowerCase()})}
                  placeholder="hello"
                  />
                <p className="text-sm text-muted-foreground">
                  Members type: <code>!hello</code> (or your custom prefix).
                </p>
              </div>

              <div className="space-y-2">
                <Label>Response</Label>
                <Textarea 
                  value={newCommand.response}
                  onChange={(e) => setNewCommand({...newCommand, response: e.target.value})}
                  placeholder="Welcome {user}! Great to see you here!"
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Variables: {'{user}'}, {'{username}'}, {'{server}'}, {'{membercount}'}
                </p>
              </div>

              <div className="flex gap-4">
                <Button onClick={createCommand} disabled={creating}>
                  {creating ? 'Saving...' : '💾 Save Command'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Commands List */}
        <div className="space-y-4">
          {commands.length === 0 ? (
            <Card className="p-12 text-center border-2 shadow-lg bg-gradient-to-br from-muted/50 to-muted/20">
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-xl font-bold mb-2">No commands yet</h3>
              <p className="text-muted-foreground mb-4">
                Click "New Command" to create your first automation.
              </p>
            </Card>
          ) : (
            commands.map((cmd) => (
              <Card key={cmd.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">!{cmd.trigger}</h3>
                      <Badge>{cmd.uses} uses</Badge>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {cmd.response}
                    </p>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => deleteCommand(cmd.id)}
                  >
                    🗑️
                  </Button>
                </div>
                
                {cmd.last_used && (
                  <div className="text-sm text-muted-foreground">
                    Last used: {new Date(cmd.last_used).toLocaleDateString()}
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

