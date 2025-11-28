'use client';

/**
 * ComCraft Bot Personalizer (MEE6-style)
 * Let customers use their own Discord bot application
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BotPersonalizer() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [botConfig, setBotConfig] = useState<any>(null);
  const [botToken, setBotToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (guildId) {
      fetchBotConfig();
    }
  }, [guildId]);

  // Auto-refresh bot status if bot is offline/installing/starting
  useEffect(() => {
    if (botConfig?.setup_completed && !botConfig?.bot_online) {
      // Refresh faster when installing/starting, slower when just offline
      const isProvisioning = botConfig?.server_status === 'installing' || 
                             botConfig?.server_status === 'starting' ||
                             botConfig?.server_status === 'provisioning';
      
      const refreshInterval = isProvisioning ? 10000 : 30000; // 10s when provisioning, 30s when offline
      
      const interval = setInterval(() => {
        fetchBotConfig();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [botConfig?.setup_completed, botConfig?.bot_online, botConfig?.server_status]);

  const fetchBotConfig = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/bot-personalizer`);
      const data = await response.json();
      
      if (data.botConfig) {
        setBotConfig(data.botConfig);
        setStep(data.botConfig.setup_completed ? 4 : 1);
      }
    } catch (error) {
      console.error('Error fetching bot config:', error);
    } finally {
      setLoading(false);
    }
  };

  const enableBotPersonalizer = async () => {
    if (!botToken || botToken.length < 50) {
      alert('❌ Please enter a valid bot token!');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/bot-personalizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken })
      });

      const result = await response.json();

      if (result.success) {
        if (result.inviteUrl) {
          // Bot is not in guild - show invite link
          const shouldInvite = confirm(
            `✅ Bot token validated!\n\n` +
            `⚠️ The bot is not in your server yet.\n\n` +
            `Click OK to open the invite link in a new tab.`
          );
          
          if (shouldInvite && result.inviteUrl) {
            window.open(result.inviteUrl, '_blank');
            alert(
              '📋 Instructions:\n\n' +
              '1. Complete the bot invite in the new tab\n' +
              '2. Make sure to grant all required permissions\n' +
              '3. After inviting, refresh this page to see the bot status\n' +
              '4. Note: The bot may appear offline until our backend service starts it'
            );
          }
        } else {
          // Bot is in guild
          alert(
            '✅ Bot Personalizer enabled!\n\n' +
            'The bot is in your server.\n\n' +
            '⚠️ Important: The bot may appear offline until our backend service starts it with your token. This usually takes a few minutes.\n\n' +
            'You can refresh this page to check the bot status.'
          );
        }
        
        setBotToken('');
        // Wait a bit before fetching config to allow for status updates
        setTimeout(() => {
          fetchBotConfig();
        }, 2000);
      } else {
        // Show detailed error message
        if (result.inviteUrl) {
          const shouldInvite = confirm(
            `❌ ${result.error || 'Error'}\n\n` +
            `${result.message || ''}\n\n` +
            `Click OK to open the invite link.`
          );
          
          if (shouldInvite && result.inviteUrl) {
            window.open(result.inviteUrl, '_blank');
          }
        } else {
          alert(`❌ Error: ${result.error}\n\n${result.message || ''}`);
        }
      }
    } catch (error) {
      console.error('Error enabling bot personalizer:', error);
      alert('❌ Error enabling bot personalizer. Please check the console for details.');
    } finally {
      setSaving(false);
    }
  };

  const disableBotPersonalizer = async () => {
    if (!confirm('Are you sure you want to disable Bot Personalizer? The bot will return to default ComCraft branding.')) {
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/bot-personalizer`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Bot Personalizer disabled');
        fetchBotConfig();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Error disabling bot personalizer');
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">🤖 Bot Personalizer</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Use your own Discord bot application with ComCraft features
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/comcraft/dashboard/${guildId}`}>← Back</Link>
            </Button>
          </div>

          {/* Premium Feature Badge */}
          <Alert className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0">
            <AlertDescription>
              <div className="flex items-center gap-3">
                <div className="text-3xl">👑</div>
                <div>
                  <div className="font-bold">Premium Feature</div>
                  <div className="text-sm opacity-90">
                    Bot Personalizer is available for Pro & Business subscriptions
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {/* If Not Setup Yet - Show Setup Flow */}
        {!botConfig?.setup_completed ? (
          <div className="space-y-6">
            {/* Step 1: Create Application */}
            <Card className={`p-6 ${step >= 1 ? 'border-blue-500' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                  1
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2">Create a Discord Application</h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Go to Discord Developer Portal and create a new application.
                  </p>
                  <Button asChild>
                    <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">
                      🔗 Open Developer Portal
                    </a>
                  </Button>
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-2">
                    <div><strong>1.</strong> Click "New Application"</div>
                    <div><strong>2.</strong> Give your bot a name (e.g., "My Bot")</div>
                    <div><strong>3.</strong> Accept the policies and click "Create"</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Step 2: Enable Intents */}
            <Card className={`p-6 ${step >= 2 ? 'border-blue-500' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                  2
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2">⚠️ Enable Intents (IMPORTANT!)</h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    These are required for ComCraft features!
                  </p>
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg space-y-2 text-sm">
                    <div><strong>1.</strong> Go to "Bot" tab in Developer Portal</div>
                    <div><strong>2.</strong> Scroll to "Privileged Gateway Intents"</div>
                    <div><strong>3.</strong> Enable these 3 intents:</div>
                    <div className="ml-6 space-y-1">
                      <div>✅ <strong>Presence Intent</strong></div>
                      <div>✅ <strong>Server Members Intent</strong></div>
                      <div>✅ <strong>Message Content Intent</strong></div>
                    </div>
                    <div><strong>4.</strong> Save Changes</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Step 3: Get Token */}
            <Card className={`p-6 ${step >= 3 ? 'border-blue-500' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                  3
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2">Copy your Bot Token</h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Still in the "Bot" tab of Developer Portal:
                  </p>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-2 mb-4">
                    <div><strong>1.</strong> Click "Reset Token" or "Click to Reveal Token"</div>
                    <div><strong>2.</strong> Confirm with 2FA if prompted</div>
                    <div><strong>3.</strong> Copy the token (long string)</div>
                  </div>

                  <Alert className="mb-4 bg-red-50 dark:bg-red-900/20 border-red-200">
                    <AlertDescription>
                      <div className="flex items-start gap-2">
                        <div className="text-xl">⚠️</div>
                        <div className="text-sm">
                          <strong>WARNING:</strong> This token is super secret! 
                          Never share it with anyone. If your token leaks, regenerate it immediately.
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="botToken">Bot Token</Label>
                      <Input
                        id="botToken"
                        type="password"
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        placeholder="MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GaBcDe.fGhIjKlMnOpQrStUvWxYz..."
                        className="mt-1 font-mono"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Starts with "MT..." or "MQ..." and is 59-72 characters long
                      </p>
                    </div>

                    <Button 
                      onClick={enableBotPersonalizer} 
                      disabled={saving || !botToken}
                      size="lg"
                      className="w-full"
                    >
                      {saving ? '⏳ Validating and Activating...' : '🚀 Enable Bot Personalizer'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Why Use Bot Personalizer? */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">💡 Why Use Bot Personalizer?</h2>
              <div className="space-y-3 text-gray-600 dark:text-gray-400">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🎨</div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Custom Branding</div>
                    <div className="text-sm">Your bot gets your own name and avatar (via Developer Portal)</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">👑</div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Professional</div>
                    <div className="text-sm">No "ComCraft" branding - completely your brand!</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚡</div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">All Features</div>
                    <div className="text-sm">Full ComCraft functionality with your bot!</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🛡️</div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Secure</div>
                    <div className="text-sm">We host your bot - no own server needed!</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          // Already Setup - Show Management
          <div className="space-y-6">
            <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200">
              <div className="flex items-start gap-4">
                <div className="text-3xl">✅</div>
                <div className="flex-1">
                  <div className="font-bold text-lg mb-2">Bot Personalizer Active!</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You are now using your own Discord bot application with ComCraft features.
                  </p>
                </div>
              </div>
            </Card>

            {/* Server Status Card - NEW */}
            {botConfig.pterodactyl_server_id && (
              <Card className="p-6 border-2 border-blue-200 dark:border-blue-800">
                <h2 className="text-xl font-bold mb-4">🖥️ Server Status</h2>
                
                {/* Status Steps */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${botConfig.pterodactyl_server_id ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
                      {botConfig.pterodactyl_server_id ? '✓' : '1'}
                    </div>
                    <span className={botConfig.pterodactyl_server_id ? 'text-green-600 dark:text-green-400' : ''}>
                      Server Created
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                      botConfig.server_status === 'running' || botConfig.server_status === 'online' || botConfig.bot_online
                        ? 'bg-green-500 text-white' 
                        : botConfig.server_status === 'installing' 
                          ? 'bg-yellow-500 text-white animate-pulse' 
                          : 'bg-gray-300'
                    }`}>
                      {botConfig.server_status === 'running' || botConfig.server_status === 'online' || botConfig.bot_online ? '✓' : botConfig.server_status === 'installing' ? '⏳' : '2'}
                    </div>
                    <span className={
                      botConfig.server_status === 'running' || botConfig.server_status === 'online' || botConfig.bot_online
                        ? 'text-green-600 dark:text-green-400' 
                        : botConfig.server_status === 'installing' 
                          ? 'text-yellow-600 dark:text-yellow-400 animate-pulse' 
                          : ''
                    }>
                      {botConfig.server_status === 'installing' ? '📦 Installing bot files...' : 'Bot Files Installed'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                      botConfig.bot_online 
                        ? 'bg-green-500 text-white' 
                        : botConfig.server_status === 'starting'
                          ? 'bg-yellow-500 text-white animate-pulse'
                          : 'bg-gray-300'
                    }`}>
                      {botConfig.bot_online ? '✓' : botConfig.server_status === 'starting' ? '⏳' : '3'}
                    </div>
                    <span className={
                      botConfig.bot_online 
                        ? 'text-green-600 dark:text-green-400' 
                        : botConfig.server_status === 'starting'
                          ? 'text-yellow-600 dark:text-yellow-400 animate-pulse'
                          : ''
                    }>
                      {botConfig.server_status === 'starting' ? '🚀 Starting bot...' : botConfig.bot_online ? 'Bot Online!' : 'Bot Starting'}
                    </span>
                  </div>
                </div>

                {/* Current Status */}
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Current Status:</span>
                    <Badge className={
                      botConfig.bot_online ? 'bg-green-600' :
                      botConfig.server_status === 'installing' ? 'bg-yellow-600 animate-pulse' :
                      botConfig.server_status === 'starting' ? 'bg-blue-600 animate-pulse' :
                      botConfig.server_status === 'offline' || botConfig.server_status === 'error' ? 'bg-red-600' :
                      'bg-gray-600'
                    }>
                      {botConfig.bot_online ? '🟢 Online' :
                       botConfig.server_status === 'installing' ? '📦 Installing...' :
                       botConfig.server_status === 'starting' ? '🚀 Starting...' :
                       botConfig.server_status === 'offline' ? '🔴 Offline' :
                       botConfig.server_status === 'error' ? '❌ Error' :
                       '⏳ Provisioning...'}
                    </Badge>
                  </div>
                </div>

                {/* Auto-refresh notice */}
                {!botConfig.bot_online && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    ⏱️ Status updates automatically every 30 seconds
                  </p>
                )}
              </Card>
            )}

            {/* Bot Info */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">🤖 Your Custom Bot</h2>
              
              <div className="flex items-center gap-4 mb-6">
                {botConfig.bot_avatar_url && (
                  <img 
                    src={botConfig.bot_avatar_url} 
                    alt="Bot Avatar"
                    className="w-20 h-20 rounded-full"
                  />
                )}
                <div>
                  <div className="text-2xl font-bold">
                    {botConfig.bot_username}#{botConfig.bot_discriminator || '0000'}
                  </div>
                  <div className="flex gap-2 mt-1">
                    {botConfig.bot_online ? (
                      <Badge className="bg-green-600">🟢 Online</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-300">
                        ⚫ Offline
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {botConfig.total_guilds || 1} server{(botConfig.total_guilds || 1) !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  
                  {!botConfig.bot_online && (
                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">⚠️</div>
                        <div className="flex-1">
                          <div className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                            Bot is Offline
                          </div>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                            The bot appears to be offline. This is normal if:
                          </p>
                          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside mb-3">
                            <li>The bot was just added and our backend service hasn't started it yet (may take a few minutes)</li>
                            <li>The bot token is invalid or has been regenerated</li>
                            <li>The bot was removed from your server</li>
                            <li>There's a temporary issue with our backend service</li>
                          </ul>
                          <div className="text-sm text-yellow-700 dark:text-yellow-300">
                            <strong>What to do:</strong>
                          </div>
                          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-disc list-inside mt-1">
                            <li>Wait a few minutes and refresh this page to check again</li>
                            <li>Make sure the bot is still in your server</li>
                            <li>Verify that the bot token is still valid in Discord Developer Portal</li>
                            <li>If the issue persists, contact support</li>
                          </ul>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => fetchBotConfig()}
                          >
                            🔄 Refresh Status
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Application ID:</span>
                  <code className="font-mono">{botConfig.bot_application_id}</code>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Hosting Server:</span>
                  <span>{botConfig.host_server || 'Allocating...'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Status:</span>
                  <span>{botConfig.is_active ? '✅ Active' : '⏳ Starting...'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Last Seen:</span>
                  <span>{botConfig.last_seen ? new Date(botConfig.last_seen).toLocaleString('en-US') : 'Never'}</span>
                </div>
              </div>
            </Card>

            {/* Customization Info */}
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">🎨 Customize Bot Appearance</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                To change your bot's name, avatar, and status:
              </p>
              
              <div className="space-y-3 text-sm">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <strong>📝 Bot Name:</strong>
                  <div className="mt-2">
                    1. Go to <a href="https://discord.com/developers/applications" target="_blank" className="text-blue-600 underline">Developer Portal</a>
                    <br />2. Select your application
                    <br />3. Go to "Bot" tab → change name under "Username"
                    <br />4. Save Changes → name updates instantly!
                  </div>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <strong>🖼️ Bot Avatar:</strong>
                  <div className="mt-2">
                    1. Go to Developer Portal → your application
                    <br />2. Click on the bot avatar image
                    <br />3. Upload your custom avatar
                    <br />4. Save → avatar updates instantly!
                  </div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <strong>💭 Bot Status:</strong>
                  <div className="mt-2">
                    Status (e.g., "Playing: comcraft.gg") is automatically set by ComCraft.
                    <br />You can customize this via the bot configuration in the dashboard.
                  </div>
                </div>
              </div>
            </Card>

            {/* Danger Zone */}
            <Card className="p-6 border-red-200">
              <h2 className="text-xl font-bold mb-4 text-red-600">⚠️ Danger Zone</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                If you disable Bot Personalizer, your server will return to the default ComCraft bot.
                All your settings and data will be preserved.
              </p>
              <Button variant="destructive" onClick={disableBotPersonalizer}>
                🗑️ Disable Bot Personalizer
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

