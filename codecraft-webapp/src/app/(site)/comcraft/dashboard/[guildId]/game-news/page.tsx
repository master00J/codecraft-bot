'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface GameSource {
  id: string;
  game_id: string;
  game_name: string;
  game_icon_url: string | null;
  api_type: string;
  status: string;
  last_check_at: string | null;
}

interface Subscription {
  id: string;
  guild_id: string;
  channel_id: string;
  game_id: string;
  enabled: boolean;
  notification_role_id: string | null;
  filters: {
    types: string[];
  };
  created_at: string;
  game_news_sources: {
    game_name: string;
    game_icon_url: string | null;
  };
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface Role {
  id: string;
  name: string;
  color: number;
}

export default function GameNewsPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [games, setGames] = useState<GameSource[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add subscription form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedGame, setSelectedGame] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>(['all']);

  useEffect(() => {
    fetchData();
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gamesRes, subsRes, channelsRes, rolesRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/game-news/games`),
        fetch(`/api/comcraft/guilds/${guildId}/game-news/subscriptions`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`),
      ]);

      if (gamesRes.ok) {
        const data = await gamesRes.json();
        setGames(data.games || []);
      }

      if (subsRes.ok) {
        const data = await subsRes.json();
        setSubscriptions(data.subscriptions || []);
      }

      if (channelsRes.ok) {
        const data = await channelsRes.json();
        // Bot API returns { success, channels: { all, text, voice, categories } }
        // We only want text channels (already filtered by bot)
        if (data.success && data.channels) {
          setChannels(data.channels.text || []);
        } else if (Array.isArray(data.channels)) {
          // Fallback: if channels is already an array
          setChannels(data.channels.filter((ch: Channel) => ch.type === 0 || ch.type === 5));
        } else {
          setChannels([]);
        }
      }

      if (rolesRes.ok) {
        const data = await rolesRes.json();
        // Roles might also have success property
        if (data.success && Array.isArray(data.roles)) {
          setRoles(data.roles);
        } else if (Array.isArray(data.roles)) {
          setRoles(data.roles);
        } else {
          setRoles([]);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubscription = async () => {
    if (!selectedGame || !selectedChannel) {
      alert('Please select a game and channel');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/game-news/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: selectedGame,
          channelId: selectedChannel,
          notificationRoleId: selectedRole || null,
          filters: { types: selectedFilters },
        }),
      });

      if (response.ok) {
        await fetchData();
        setShowAddForm(false);
        setSelectedGame('');
        setSelectedChannel('');
        setSelectedRole('');
        setSelectedFilters(['all']);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add subscription');
      }
    } catch (error) {
      console.error('Error adding subscription:', error);
      alert('Failed to add subscription');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubscription = async (subId: string, enabled: boolean) => {
    try {
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/game-news/subscriptions/${subId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !enabled }),
        }
      );

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
    }
  };

  const handleDeleteSubscription = async (subId: string) => {
    if (!confirm('Are you sure you want to delete this subscription?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/game-news/subscriptions/${subId}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting subscription:', error);
    }
  };

  const toggleFilter = (filter: string) => {
    if (filter === 'all') {
      setSelectedFilters(['all']);
    } else {
      let newFilters = selectedFilters.filter(f => f !== 'all');
      if (newFilters.includes(filter)) {
        newFilters = newFilters.filter(f => f !== filter);
      } else {
        newFilters.push(filter);
      }
      setSelectedFilters(newFilters.length === 0 ? ['all'] : newFilters);
    }
  };

  const availableGames = games.filter(
    game => !subscriptions.some(sub => sub.game_id === game.game_id)
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading game news settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🎮 Game News</h1>
        <p className="text-gray-600">
          Get automatic updates for your favorite games posted directly to Discord
        </p>
      </div>

      {/* Warning if database not configured */}
      {!loading && games.length === 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              ⚠️ Database Configuration Required
            </CardTitle>
            <CardDescription className="text-amber-700">
              The game news feature tables haven't been created yet. Please run the database migration:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block bg-amber-100 p-3 rounded text-sm text-amber-900 mb-2">
              psql -h [host] -U [user] -d [database] -f codecraft-webapp/game-news-schema.sql
            </code>
            <p className="text-sm text-amber-700">
              After running the migration, restart the bot and refresh this page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Warning if channels/roles not loaded (bot not running) */}
      {!loading && games.length > 0 && channels.length === 0 && roles.length === 0 && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              ℹ️ Bot Not Connected
            </CardTitle>
            <CardDescription className="text-blue-700">
              Unable to load Discord channels and roles. The Discord bot needs to be running to configure subscriptions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-700 mb-2">
              To start using the Game News feature:
            </p>
            <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
              <li>Ensure the bot is running and connected to this server</li>
              <li>Check that the bot has the required permissions</li>
              <li>Refresh this page to load channels and roles</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Active Subscriptions */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Subscriptions</CardTitle>
              <CardDescription>
                Games you're currently tracking ({subscriptions.length})
              </CardDescription>
            </div>
            {availableGames.length > 0 && (
              <Button onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? 'Cancel' : '+ Add Game'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">No game subscriptions yet</p>
              <p className="text-sm">
                Add a game to start receiving news updates in your Discord server
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map(sub => {
                const channel = channels.find(ch => ch.id === sub.channel_id);
                const role = roles.find(r => r.id === sub.notification_role_id);
                
                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {sub.game_news_sources.game_icon_url ? (
                        <img
                          src={sub.game_news_sources.game_icon_url}
                          alt={sub.game_news_sources.game_name}
                          className="w-12 h-12 rounded object-cover bg-gray-100"
                          onError={(e) => {
                            // Hide the broken image and show fallback
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-12 h-12 rounded bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-md ${sub.game_news_sources.game_icon_url ? 'hidden' : ''}`}>
                        {sub.game_news_sources?.game_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">
                          {sub.game_news_sources.game_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          #{channel?.name || 'Unknown Channel'}
                          {role && (
                            <span className="ml-2">
                              • Pings @{role.name}
                            </span>
                          )}
                        </p>
                        <div className="flex gap-2 mt-1">
                          {sub.filters.types.includes('all') ? (
                            <Badge variant="secondary">All Updates</Badge>
                          ) : (
                            sub.filters.types.map(type => (
                              <Badge key={type} variant="secondary">
                                {type}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {sub.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <Switch
                          checked={sub.enabled}
                          onCheckedChange={() =>
                            handleToggleSubscription(sub.id, sub.enabled)
                          }
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteSubscription(sub.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Subscription Form */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add Game Subscription</CardTitle>
            <CardDescription>
              Choose a game and configure where to post updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Game Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Select Game</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {availableGames.map(game => (
                  <button
                    key={game.game_id}
                    onClick={() => setSelectedGame(game.game_id)}
                    className={`p-4 border rounded-lg text-left hover:bg-gray-50 transition ${
                      selectedGame === game.game_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {game.game_icon_url ? (
                        <img
                          src={game.game_icon_url}
                          alt={game.game_name}
                          className="w-10 h-10 rounded object-cover bg-gray-100"
                          onError={(e) => {
                            // Hide the broken image and show fallback
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-10 h-10 rounded bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md ${game.game_icon_url ? 'hidden' : ''}`}>
                        {game.game_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{game.game_name}</p>
                        <p className="text-xs text-gray-500">{game.api_type}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Channel Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Post to Channel *
              </label>
              <select
                value={selectedChannel}
                onChange={e => setSelectedChannel(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">Select a channel...</option>
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Selection (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Ping Role (Optional)
              </label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">No role ping</option>
                {roles.map(role => (
                  <option key={role.id} value={role.id}>
                    @{role.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                The bot will mention this role when posting news
              </p>
            </div>

            {/* Filter Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">
                News Types to Post
              </label>
              <div className="flex flex-wrap gap-2">
                {['all', 'patch', 'event', 'maintenance', 'hotfix', 'news'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => toggleFilter(filter)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedFilters.includes(filter)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select which types of updates to receive. "All" includes everything.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleAddSubscription}
                disabled={!selectedGame || !selectedChannel || saving}
                className="flex-1"
              >
                {saving ? 'Adding...' : 'Add Subscription'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedGame('');
                  setSelectedChannel('');
                  setSelectedRole('');
                  setSelectedFilters(['all']);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>✅ Bot checks for new game updates every 30 minutes</p>
            <p>✅ Automatically posts news to your selected channel</p>
            <p>✅ Smart duplicate detection (never posts the same news twice)</p>
            <p>✅ Filter by update type (patches, events, etc.)</p>
            <p>✅ Optional role pinging to notify your community</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supported Games</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>🎮 <strong>League of Legends</strong> - Patch notes & events</p>
            <p>🎯 <strong>Valorant</strong> - Agent updates & patches</p>
            <p>🏝️ <strong>Fortnite</strong> - Shop updates & events</p>
            <p>⛏️ <strong>Minecraft</strong> - Snapshots & releases</p>
            <p>🔫 <strong>Counter-Strike 2</strong> - Updates & patches</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

