'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Plus, Trash2, Smile, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AutoReaction {
  id: string;
  trigger_words: string[];
  emoji_ids: string[];
  enabled: boolean;
  case_sensitive?: boolean;
  use_word_boundaries?: boolean;
  allowed_channels?: string[] | null;
  ignored_channels?: string[] | null;
  cooldown_seconds: number;
  trigger_count: number;
  last_triggered?: string | null;
  created_at: string;
}

interface AutoReactionsConfig {
  enabled: boolean;
  allowed_channels: string[];
  ignored_channels: string[];
  use_word_boundaries: boolean;
  case_sensitive: boolean;
}

export default function AutoReactionsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AutoReactionsConfig | null>(null);
  const [reactions, setReactions] = useState<AutoReaction[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [emojis, setEmojis] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReaction, setEditingReaction] = useState<AutoReaction | null>(null);
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([]);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // Form state for new/edit reaction
  const [triggerWords, setTriggerWords] = useState('');
  const [emojiIds, setEmojiIds] = useState('');
  const [reactionEnabled, setReactionEnabled] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    fetchData();
  }, [guildId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [reactionsRes, channelsRes, emojisRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/auto-reactions`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/emojis`),
      ]);

      const [reactionsData, channelsData, emojisData] = await Promise.all([
        reactionsRes.json(),
        channelsRes.json(),
        emojisRes.json(),
      ]);

      if (reactionsData.config) {
        setConfig(reactionsData.config);
      }

      if (reactionsData.reactions) {
        setReactions(reactionsData.reactions);
      }

      setChannels(channelsData.channels?.text || []);
      
      if (emojisData.success && emojisData.emojis) {
        setEmojis(emojisData.emojis);
      }
    } catch (error: any) {
      console.error('Error loading auto-reactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load auto-reactions configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/auto-reactions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save config');
      }

      toast({
        title: 'Success',
        description: 'Auto-reactions configuration saved',
      });
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveReaction() {
    if (!triggerWords.trim() || !emojiIds.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide trigger words and emoji(s)',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const triggerWordsArray = triggerWords
        .split(',')
        .map((word) => word.trim())
        .filter((word) => word.length > 0);

      const emojiIdsArray = emojiIds
        .split(',')
        .map((emoji) => emoji.trim())
        .filter((emoji) => emoji.length > 0);

      const reactionData = {
        trigger_words: triggerWordsArray,
        emoji_ids: emojiIdsArray,
        enabled: reactionEnabled,
        cooldown_seconds: cooldownSeconds,
      };

      const url = editingReaction
        ? `/api/comcraft/guilds/${guildId}/auto-reactions/${editingReaction.id}`
        : `/api/comcraft/guilds/${guildId}/auto-reactions`;

      const method = editingReaction ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reactionData),
      });

      if (!response.ok) {
        throw new Error('Failed to save reaction');
      }

      toast({
        title: 'Success',
        description: editingReaction ? 'Reaction updated' : 'Reaction created',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving reaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to save reaction',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteReaction(reactionId: string) {
    if (!confirm('Are you sure you want to delete this reaction?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/comcraft/guilds/${guildId}/auto-reactions/${reactionId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete reaction');
      }

      toast({
        title: 'Success',
        description: 'Reaction deleted',
      });

      fetchData();
    } catch (error: any) {
      console.error('Error deleting reaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete reaction',
        variant: 'destructive',
      });
    }
  }

  function openEditDialog(reaction: AutoReaction) {
    setEditingReaction(reaction);
    setTriggerWords(reaction.trigger_words.join(', '));
    setEmojiIds(reaction.emoji_ids.join(', '));
    setSelectedEmojis(reaction.emoji_ids || []);
    setReactionEnabled(reaction.enabled);
    setCooldownSeconds(reaction.cooldown_seconds);
    setIsDialogOpen(true);
  }

  function resetForm() {
    setEditingReaction(null);
    setTriggerWords('');
    setEmojiIds('');
    setSelectedEmojis([]);
    setReactionEnabled(true);
    setCooldownSeconds(0);
    setEmojiPickerOpen(false);
  }

  function toggleEmojiSelection(emojiId: string) {
    setSelectedEmojis((prev) => {
      if (prev.includes(emojiId)) {
        const updated = prev.filter((id) => id !== emojiId);
        setEmojiIds(updated.join(', '));
        return updated;
      } else {
        const updated = [...prev, emojiId];
        setEmojiIds(updated.join(', '));
        return updated;
      }
    });
  }

  // Common Unicode emojis that users might want
  const commonEmojis = [
    '😊', '😄', '😂', '🤣', '😍', '🥰', '😘', '😗', '😙', '😚',
    '☺️', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄',
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟',
    '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
    '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
  ];

  function addUnicodeEmoji(emoji: string) {
    if (!selectedEmojis.includes(emoji)) {
      const updated = [...selectedEmojis, emoji];
      setSelectedEmojis(updated);
      setEmojiIds(updated.join(', '));
    }
  }

  function openNewDialog() {
    resetForm();
    setIsDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Auto-Reactions</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure automatic emoji reactions based on trigger words in messages
        </p>
      </div>

      {/* Configuration */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-semibold">Configuration</h2>
          </div>
          <Button onClick={saveConfig} disabled={saving || !config}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>

        {config && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Enable Auto-Reactions</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable or disable auto-reactions for this server
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Use Word Boundaries</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Match whole words only (e.g., "morgen" won't match "goedemorgen")
                </p>
              </div>
              <Switch
                checked={config.use_word_boundaries}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, use_word_boundaries: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Case Sensitive</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Match trigger words with exact case
                </p>
              </div>
              <Switch
                checked={config.case_sensitive}
                onCheckedChange={(checked) => setConfig({ ...config, case_sensitive: checked })}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Reactions List */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smile className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-semibold">Reaction Rules</h2>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Reaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingReaction ? 'Edit Reaction' : 'Create New Reaction'}
                </DialogTitle>
                <DialogDescription>
                  Configure trigger words and emoji reactions. The bot will automatically react when
                  it detects these words in messages.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="triggerWords">
                    Trigger Words <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="triggerWords"
                    placeholder="goeiemorgen, goedemorgen, morning"
                    value={triggerWords}
                    onChange={(e) => setTriggerWords(e.target.value)}
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Comma-separated list of words that trigger the reaction
                  </p>
                </div>

                <div>
                  <Label htmlFor="emojiIds">
                    Emoji(s) <span className="text-red-500">*</span>
                  </Label>
                  
                  {/* Selected emojis display */}
                  {selectedEmojis.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                      {selectedEmojis.map((emojiId, idx) => {
                        // Check if it's a custom emoji (has : in format) or Unicode
                        const customEmoji = emojis.find((e: any) => e.id === emojiId || e.emojiId === emojiId);
                        const isUnicode = !emojiId.match(/^\d+$/) && !emojiId.includes(':');
                        
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-1 bg-white dark:bg-gray-700 px-2 py-1 rounded border border-gray-300 dark:border-gray-600"
                          >
                            {customEmoji ? (
                              <img
                                src={customEmoji.url}
                                alt={customEmoji.name}
                                className="w-6 h-6"
                                title={customEmoji.name}
                              />
                            ) : isUnicode ? (
                              <span className="text-2xl" title={emojiId}>
                                {emojiId}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500" title={emojiId}>
                                {emojiId}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleEmojiSelection(emojiId)}
                              className="text-red-500 hover:text-red-700 text-xs ml-1"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Emoji picker button */}
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                      className="w-full"
                    >
                      <Smile className="h-4 w-4 mr-2" />
                      {emojiPickerOpen ? 'Hide Emoji Picker' : 'Select Emojis'}
                    </Button>

                    {/* Emoji picker dropdown */}
                    {emojiPickerOpen && (
                      <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-white dark:bg-gray-800 max-h-96 overflow-y-auto">
                        {/* Server Emojis */}
                        {emojis.length > 0 && (
                          <div className="mb-4">
                            <Label className="text-sm font-semibold mb-2 block">Server Emojis</Label>
                            <div className="grid grid-cols-8 gap-2">
                              {emojis.map((emoji: any) => (
                                <button
                                  key={emoji.id}
                                  type="button"
                                  onClick={() => {
                                    // Store emoji ID (not reactionFormat) so backend can find it by ID
                                    toggleEmojiSelection(emoji.id);
                                  }}
                                  className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 border-2 transition ${
                                    selectedEmojis.includes(emoji.id)
                                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                      : 'border-transparent'
                                  }`}
                                  title={emoji.name}
                                >
                                  <img
                                    src={emoji.url}
                                    alt={emoji.name}
                                    className="w-8 h-8"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Common Unicode Emojis */}
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Common Emojis</Label>
                          <div className="grid grid-cols-10 gap-2">
                            {commonEmojis.map((emoji, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => addUnicodeEmoji(emoji)}
                                className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 border-2 transition text-2xl ${
                                  selectedEmojis.includes(emoji)
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                    : 'border-transparent'
                                }`}
                                title={emoji}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Manual input (fallback) */}
                    <Input
                      id="emojiIds"
                      placeholder="Or enter emoji IDs manually (comma-separated)"
                      value={emojiIds}
                      onChange={(e) => {
                        setEmojiIds(e.target.value);
                        // Parse comma-separated values
                        const parsed = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        setSelectedEmojis(parsed);
                      }}
                      className="mt-2"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Select emojis from the picker above, or enter emoji IDs manually
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="cooldown">Cooldown (seconds)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    min="0"
                    value={cooldownSeconds}
                    onChange={(e) => setCooldownSeconds(parseInt(e.target.value) || 0)}
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Minimum time between reactions in the same channel (0 = no cooldown)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled">Enabled</Label>
                  <Switch
                    id="enabled"
                    checked={reactionEnabled}
                    onCheckedChange={setReactionEnabled}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveReaction} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {reactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Smile className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reaction rules configured yet</p>
            <p className="text-sm mt-2">Click "Add Reaction" to create your first rule</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reactions.map((reaction) => (
              <Card key={reaction.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">
                        Trigger Words: {reaction.trigger_words.join(', ')}
                      </h3>
                      {reaction.enabled ? (
                        <Badge className="bg-green-500">Enabled</Badge>
                      ) : (
                        <Badge variant="outline">Disabled</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Emoji(s):</span>
                      <div className="flex gap-1">
                        {reaction.emoji_ids.map((emoji, index) => (
                          <span key={index} className="text-lg">
                            {emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>Cooldown: {reaction.cooldown_seconds}s</span>
                      <span>Triggered: {reaction.trigger_count} times</span>
                      {reaction.last_triggered && (
                        <span>
                          Last: {new Date(reaction.last_triggered).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(reaction)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteReaction(reaction.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

