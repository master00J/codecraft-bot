'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react';

interface PersonaFormState {
  assistantName: string;
  systemPrompt: string;
  styleGuidelines: string;
}

interface SettingsFormState {
  allowQuestions: boolean;
  allowModeration: boolean;
  defaultProvider: 'gemini' | 'claude' | 'deepseek';
  aiModel: string | null;
  chatEnabled: boolean;
  chatChannelId: string | null;
  allowedChannelIds: string[]; // Array of channel IDs where AI is allowed
  chatReplyInThread: boolean;
  memoryEnabled: boolean;
  memoryMaxEntries: number;
  memoryRetentionDays: number;
  webSearchEnabled: boolean;
}

function mapSettingsToForm(raw: any): SettingsFormState {
  const provider = raw?.default_provider === 'claude' ? 'claude' : raw?.default_provider === 'deepseek' ? 'deepseek' : 'gemini';
  return {
    allowQuestions: raw?.allow_question_command !== false,
    allowModeration: Boolean(raw?.allow_moderation),
    defaultProvider: provider,
    aiModel: raw?.ai_model || null,
    chatEnabled: Boolean(raw?.chat_enabled),
    chatChannelId: raw?.chat_channel_id || null,
    allowedChannelIds: Array.isArray(raw?.allowed_channel_ids) ? raw.allowed_channel_ids : [],
    chatReplyInThread: raw?.chat_reply_in_thread !== false,
    memoryEnabled: raw?.memory_enabled !== false,
    memoryMaxEntries: Number(raw?.memory_max_entries ?? 200),
    memoryRetentionDays: Number(raw?.memory_retention_days ?? 90),
    webSearchEnabled: raw?.web_search_enabled === true && provider === 'claude',
  };
}

interface AiDocument {
  id: string;
  title: string | null;
  content: string;
  is_pinned: boolean;
  updated_at: string;
  created_at: string;
}

interface AiMemory {
  id: string;
  type: string;
  label: string | null;
  summary: string;
  importance: number;
  updated_at: string;
  created_at: string;
}

interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  tokensInput: number;
  tokensOutput: number;
  tokensUsed: number;
  costUsd: number;
  limitTokens: number;
  remainingTokens: number | null;
  quotaExceeded: boolean;
  tierName?: string | null;
  subscriptionActive?: boolean;
  limitSource?: string;
}

interface UsageLog {
  id: string;
  createdAt: string;
  provider: string | null;
  model: string | null;
  taskType: string | null;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  costUsd: number;
}

export default function GuildAiPage() {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;
  const t = useTranslations('comcraft_ai');
  const locale = useLocale();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('persona');
  const [personaForm, setPersonaForm] = useState<PersonaFormState>({
    assistantName: '',
    systemPrompt: '',
    styleGuidelines: '',
  });
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    allowQuestions: true,
    allowModeration: false,
    defaultProvider: 'gemini',
    chatEnabled: false,
    chatChannelId: null,
    allowedChannelIds: [],
    chatReplyInThread: true,
    memoryEnabled: true,
    memoryMaxEntries: 200,
    memoryRetentionDays: 90,
    webSearchEnabled: false,
  });
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [documents, setDocuments] = useState<AiDocument[]>([]);
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoryTotal, setMemoryTotal] = useState(0);
  const [memoryTypeFilter, setMemoryTypeFilter] = useState<string>('all');
  const [savingPersona, setSavingPersona] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [creatingDocument, setCreatingDocument] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocPinned, setNewDocPinned] = useState(false);
  const [systemPromptLimit, setSystemPromptLimit] = useState(15000);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }),
    [locale]
  );
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale]
  );

  const formatNumber = useCallback((value: number) => numberFormatter.format(value), [numberFormatter]);
  const formatCurrency = useCallback((value: number) => currencyFormatter.format(value), [currencyFormatter]);
  const formatDateTime = useCallback((iso: string) => dateTimeFormatter.format(new Date(iso)), [dateTimeFormatter]);

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  async function fetchData() {
    setLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/ai`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to load AI configuration');
      }

      setFeatureEnabled(Boolean(data.featureEnabled));
      setPersonaForm({
        assistantName: data.persona?.assistant_name || '',
        systemPrompt: data.persona?.system_prompt || '',
        styleGuidelines: data.persona?.style_guidelines || '',
      });
      setSettingsForm(mapSettingsToForm(data.settings || {}));
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
      setUsageSummary(data.usageSummary || null);
      setUsageLogs(Array.isArray(data.usageLogs) ? data.usageLogs : []);
      setSystemPromptLimit(data.systemPromptLimit || 15000);
      await fetchChannels();
      fetchMemories();
    } catch (error: any) {
      console.error('AI fetch error:', error);
      toast({
        title: t('toast.loadError.title'),
        description: error.message || t('toast.loadError.description'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function fetchChannels() {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/channels`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load channels');
      }
      const textChannels = data.channels?.text || [];
      setChannels(
        textChannels.map((channel: any) => ({
          id: channel.id,
          name: `#${channel.name}`,
        }))
      );
    } catch (error) {
      console.error('Failed to load channels for AI page:', error);
    }
  }

  async function fetchMemories(currentType = memoryTypeFilter) {
    if (!guildId) return;
    setMemoriesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('offset', '0');
      if (currentType !== 'all') {
        params.set('type', currentType);
      }

      const response = await fetch(`/api/comcraft/guilds/${guildId}/ai/memories?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load memories');
      }
      setMemories(Array.isArray(data.memories) ? data.memories : []);
      setMemoryTotal(data.total || 0);
    } catch (error) {
      console.error('AI memories fetch error:', error);
    } finally {
      setMemoriesLoading(false);
    }
  }

  async function handleSavePersona() {
    setSavingPersona(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/ai`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: {
            assistant_name: personaForm.assistantName,
            system_prompt: personaForm.systemPrompt,
            style_guidelines: personaForm.styleGuidelines,
          },
          settings: {
            allow_question_command: settingsForm.allowQuestions,
            allow_moderation: settingsForm.allowModeration,
            default_provider: settingsForm.defaultProvider,
            ai_model: settingsForm.aiModel,
            chat_enabled: settingsForm.chatEnabled,
            chat_channel_id: settingsForm.chatChannelId,
            allowed_channel_ids: settingsForm.allowedChannelIds,
            chat_reply_in_thread: settingsForm.chatReplyInThread,
            memory_enabled: settingsForm.memoryEnabled,
            memory_max_entries: settingsForm.memoryMaxEntries,
            memory_retention_days: settingsForm.memoryRetentionDays,
            web_search_enabled: settingsForm.webSearchEnabled,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save persona');
      }
      toast({ title: t('toast.saved.title'), description: t('toast.saved.description') });
      await fetchChannels();
      fetchMemories();
    } catch (error: any) {
      toast({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.description'),
        variant: 'destructive',
      });
    } finally {
      setSavingPersona(false);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/ai`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            allow_question_command: settingsForm.allowQuestions,
            allow_moderation: settingsForm.allowModeration,
            default_provider: settingsForm.defaultProvider,
            ai_model: settingsForm.aiModel,
            chat_enabled: settingsForm.chatEnabled,
            chat_channel_id: settingsForm.chatChannelId,
            allowed_channel_ids: settingsForm.allowedChannelIds,
            chat_reply_in_thread: settingsForm.chatReplyInThread,
            memory_enabled: settingsForm.memoryEnabled,
            memory_max_entries: settingsForm.memoryMaxEntries,
            memory_retention_days: settingsForm.memoryRetentionDays,
            web_search_enabled: settingsForm.webSearchEnabled,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }
      if (data.settings) {
        setSettingsForm(mapSettingsToForm(data.settings));
      }
      toast({ title: t('toast.saved.title'), description: t('toast.saved.description') });
      fetchMemories();
    } catch (error: any) {
      toast({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.description'),
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleCreateDocument() {
    if (!newDocContent.trim()) {
      toast({ title: t('toast.validation.title'), description: t('toast.validation.contentRequired'), variant: 'destructive' });
      return;
    }
    setCreatingDocument(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/ai/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDocTitle.trim(),
          content: newDocContent.trim(),
          isPinned: newDocPinned,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create document');
      }
      setNewDocTitle('');
      setNewDocContent('');
      setNewDocPinned(false);
      setDocuments((prev) => [data.document, ...prev]);
      toast({ title: t('toast.saved.title'), description: t('toast.documentCreated') });
    } catch (error: any) {
      toast({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.description'),
        variant: 'destructive',
      });
    } finally {
      setCreatingDocument(false);
    }
  }

  async function handleUpdateDocument(documentId: string, fields: Partial<AiDocument>) {
    setSavingDocumentId(documentId);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/ai/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fields.title,
          content: fields.content,
          isPinned: fields.is_pinned,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update document');
      }
      setDocuments((prev) => prev.map((doc) => (doc.id === documentId ? data.document : doc)));
      toast({ title: t('toast.saved.title'), description: t('toast.saved.description') });
    } catch (error: any) {
      toast({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.description'),
        variant: 'destructive',
      });
    } finally {
      setSavingDocumentId(null);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    const confirmed = window.confirm(t('documents.deleteConfirm'));
    if (!confirmed) return;
    setSavingDocumentId(documentId);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/ai/documents/${documentId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete document');
      }
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      toast({ title: t('toast.deleted.title'), description: t('toast.deleted.description') });
    } catch (error: any) {
      toast({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.description'),
        variant: 'destructive',
      });
    } finally {
      setSavingDocumentId(null);
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/ai/memories/${memoryId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete memory');
      }
      toast({ title: t('memories.toastDeletedTitle'), description: t('memories.toastDeletedDescription') });
      fetchMemories();
    } catch (error: any) {
      toast({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.description'),
        variant: 'destructive',
      });
    }
  }

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }),
    [documents]
  );

  const isAiFeatureDisabled = !featureEnabled;

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-12 bg-gradient-to-br from-background via-background to-purple-500/10">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t('misc.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-br from-background via-background to-purple-500/10">
      <div className="w-full px-4 py-8 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit hover:bg-primary/10"
          onClick={() => router.push(`/comcraft/dashboard/${guildId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('actions.back')}
        </Button>

        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-8 flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                  🧠
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  {t('title')}
                </h1>
                <p className="text-muted-foreground max-w-2xl">{t('subtitle')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge className="bg-primary/10 text-primary px-4 py-2 border-0">
                {featureEnabled ? t('badges.enabled') : t('badges.disabled')}
              </Badge>
              <Badge variant="outline" className="px-4 py-2">
                {t('badges.memories', { count: memoryTotal })}
              </Badge>
              {usageSummary?.tierName && (
                <Badge variant="outline" className="px-4 py-2">
                  {t('usage.tierLabel', { tier: usageSummary.tierName })}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {!featureEnabled && (
          <Alert variant="destructive">
            <AlertTitle>{t('featureDisabled.title')}</AlertTitle>
            <AlertDescription>{t('featureDisabled.description')}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full grid grid-cols-2 md:grid-cols-5 bg-muted/50 p-2 rounded-lg">
            <TabsTrigger value="persona" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {t('tabs.persona')}
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {t('tabs.knowledge')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {t('tabs.settings')}
            </TabsTrigger>
            <TabsTrigger value="memories" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {t('tabs.memories')}
            </TabsTrigger>
            <TabsTrigger value="usage" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {t('tabs.usage')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="persona" className="space-y-6">
            <Card className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{t('persona.title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('persona.description')}</p>
                </div>
                <Badge variant="secondary">{t('persona.badge')}</Badge>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="assistant-name">{t('persona.assistantName')}</Label>
                  <Input
                    id="assistant-name"
                    value={personaForm.assistantName}
                    placeholder="ComCraft AI"
                    onChange={(event) => setPersonaForm((current) => ({ ...current, assistantName: event.target.value }))}
                    disabled={isAiFeatureDisabled}
                  />
                  <p className="text-xs text-muted-foreground">{t('persona.assistantNameHelp')}</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="system-prompt">{t('persona.systemPrompt')}</Label>
                    <span className={`text-xs ${personaForm.systemPrompt.length > systemPromptLimit ? 'text-destructive' : personaForm.systemPrompt.length > systemPromptLimit * 0.8 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                      {personaForm.systemPrompt.length.toLocaleString()} / {systemPromptLimit.toLocaleString()}
                    </span>
                  </div>
                  <Textarea
                    id="system-prompt"
                    value={personaForm.systemPrompt}
                    onChange={(event) => setPersonaForm((current) => ({ ...current, systemPrompt: event.target.value }))}
                    rows={8}
                    placeholder={t('persona.systemPlaceholder')}
                    disabled={isAiFeatureDisabled}
                    maxLength={systemPromptLimit}
                  />
                  <p className="text-xs text-muted-foreground">{t('persona.systemHelp')}</p>
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="style-guidelines">{t('persona.styleGuidelines')}</Label>
                <Textarea
                  id="style-guidelines"
                  value={personaForm.styleGuidelines}
                  onChange={(event) => setPersonaForm((current) => ({ ...current, styleGuidelines: event.target.value }))}
                  rows={6}
                  placeholder={t('persona.stylePlaceholder')}
                  disabled={isAiFeatureDisabled}
                />
                <p className="text-xs text-muted-foreground">{t('persona.styleHelp')}</p>
              </div>
              <Button onClick={handleSavePersona} disabled={savingPersona || isAiFeatureDisabled}>
                {savingPersona && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('persona.save')}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-6">
            <Card className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{t('documents.title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('documents.description')}</p>
                </div>
                <Badge variant="secondary">{t('documents.badge')}</Badge>
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t('documents.newTitle')}
                </h3>
                <Input
                  value={newDocTitle}
                  placeholder={t('documents.newPlaceholderTitle')}
                  onChange={(event) => setNewDocTitle(event.target.value)}
                  disabled={isAiFeatureDisabled}
                />
                <Textarea
                  value={newDocContent}
                  placeholder={t('documents.newPlaceholderContent')}
                  rows={4}
                  onChange={(event) => setNewDocContent(event.target.value)}
                  disabled={isAiFeatureDisabled}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="new-doc-pinned"
                      checked={newDocPinned}
                      onCheckedChange={setNewDocPinned}
                      disabled={isAiFeatureDisabled}
                    />
                    <Label htmlFor="new-doc-pinned">{t('documents.pinLabel')}</Label>
                  </div>
                  <Button onClick={handleCreateDocument} disabled={creatingDocument || isAiFeatureDisabled}>
                    {creatingDocument && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('documents.add')}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {sortedDocuments.map((doc) => (
                  <Card key={doc.id} className="space-y-3 p-4 border">
                    <div className="flex items-center justify-between gap-3">
                      <Input
                        value={doc.title || ''}
                        placeholder={t('documents.titlePlaceholder')}
                        onChange={(event) =>
                          setDocuments((prev) =>
                            prev.map((item) =>
                              item.id === doc.id ? { ...item, title: event.target.value } : item
                            )
                          )
                        }
                        disabled={isAiFeatureDisabled}
                      />
                      <div className="flex items-center gap-2">
                        {doc.is_pinned && <Badge variant="secondary">{t('documents.pinned')}</Badge>}
                        <Switch
                          checked={doc.is_pinned}
                          onCheckedChange={(checked) =>
                            setDocuments((prev) =>
                              prev.map((item) =>
                                item.id === doc.id ? { ...item, is_pinned: checked } : item
                              )
                            )
                          }
                          disabled={isAiFeatureDisabled}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={savingDocumentId === doc.id || isAiFeatureDisabled}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      rows={5}
                      value={doc.content}
                      onChange={(event) =>
                        setDocuments((prev) =>
                          prev.map((item) =>
                            item.id === doc.id ? { ...item, content: event.target.value } : item
                          )
                        )
                      }
                      disabled={isAiFeatureDisabled}
                    />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{t('documents.updatedAt', { date: new Date(doc.updated_at).toLocaleString(locale) })}</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateDocument(doc.id, documents.find((item) => item.id === doc.id)!)}
                        disabled={savingDocumentId === doc.id || isAiFeatureDisabled}
                      >
                        {savingDocumentId === doc.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        {t('documents.save')}
                      </Button>
                    </div>
                  </Card>
                ))}

                {sortedDocuments.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('documents.empty')}</p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{t('settings.title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('settings.description')}</p>
                </div>
                <Badge variant="secondary">{t('settings.badge')}</Badge>
              </div>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium">{t('settings.allowQuestions')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.allowQuestionsHelp')}</p>
                </div>
                <Switch
                  checked={settingsForm.allowQuestions}
                  onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, allowQuestions: checked }))}
                  disabled={isAiFeatureDisabled}
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium">{t('settings.allowModeration')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.allowModerationHelp')}</p>
                </div>
                <Switch
                  checked={settingsForm.allowModeration}
                  onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, allowModeration: checked }))}
                  disabled={isAiFeatureDisabled}
                />
              </div>

              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium">{t('settings.defaultProvider') || 'Default AI Provider'}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.defaultProviderHelp') || 'Choose which AI provider to use by default.'}
                  </p>
                </div>
                <Select
                  value={settingsForm.defaultProvider}
                  onValueChange={(value) =>
                    setSettingsForm((current) => ({ ...current, defaultProvider: (value as 'gemini' | 'claude' | 'deepseek') }))
                  }
                  disabled={isAiFeatureDisabled}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <div>
                  <Label htmlFor="ai-model">AI Model (Optional)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Select a specific model. Leave empty to use provider default.
                  </p>
                  <Select
                    value={settingsForm.aiModel || 'default'}
                    onValueChange={(value) =>
                      setSettingsForm((current) => ({ ...current, aiModel: value === 'default' ? null : value }))
                    }
                    disabled={isAiFeatureDisabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Provider Default</SelectItem>
                      {settingsForm.defaultProvider === 'gemini' && (
                        <>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                          <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                        </>
                      )}
                      {settingsForm.defaultProvider === 'claude' && (
                        <>
                          <SelectItem value="claude-3-5-haiku-latest">Claude 3.5 Haiku</SelectItem>
                          <SelectItem value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</SelectItem>
                          <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                        </>
                      )}
                      {settingsForm.defaultProvider === 'deepseek' && (
                        <>
                          <SelectItem value="deepseek-chat">DeepSeek Chat (V3.2)</SelectItem>
                          <SelectItem value="deepseek-reasoner">DeepSeek Reasoner (V3.2)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t('settings.aiChat')}</p>
                    <p className="text-sm text-muted-foreground">{t('settings.aiChatHelp')}</p>
                  </div>
                  <Switch
                    checked={settingsForm.chatEnabled}
                    onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, chatEnabled: checked }))}
                    disabled={isAiFeatureDisabled}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-chat-channel">{t('settings.aiChatChannel')}</Label>
                    <Select
                      value={settingsForm.chatChannelId || 'none'}
                      onValueChange={(value) =>
                        setSettingsForm((current) => ({
                          ...current,
                          chatChannelId: value === 'none' ? null : value,
                        }))
                      }
                      disabled={isAiFeatureDisabled || !settingsForm.chatEnabled}
                    >
                      <SelectTrigger id="ai-chat-channel">
                        <SelectValue placeholder={t('settings.selectChannel')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('settings.noChannel')}</SelectItem>
                        {channels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t('settings.aiChatChannelHelp')}</p>
                    <p className="text-xs text-muted-foreground mt-1">⚠️ Legacy option - Use "Allowed Channels" below for multiple channels</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Allowed Channels (optional)</Label>
                    <p className="text-xs text-muted-foreground">Select channels where AI Assistant is allowed to respond. Leave empty to allow all channels (when chat is enabled).</p>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value && !settingsForm.allowedChannelIds.includes(value)) {
                          setSettingsForm((current) => ({
                            ...current,
                            allowedChannelIds: [...current.allowedChannelIds, value],
                          }));
                        }
                      }}
                      disabled={isAiFeatureDisabled || !settingsForm.chatEnabled}
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue placeholder="Select a channel to allow" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels
                          .filter((ch) => !settingsForm.allowedChannelIds.includes(ch.id))
                          .map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              {channel.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {settingsForm.allowedChannelIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {settingsForm.allowedChannelIds.map((channelId) => {
                          const channel = channels.find((ch) => ch.id === channelId);
                          return (
                            <Badge key={channelId} variant="secondary" className="flex items-center gap-1">
                              {channel?.name || channelId}
                              <button
                                onClick={() => {
                                  setSettingsForm((current) => ({
                                    ...current,
                                    allowedChannelIds: current.allowedChannelIds.filter((id) => id !== channelId),
                                  }));
                                }}
                                className="ml-1 hover:text-destructive"
                                disabled={isAiFeatureDisabled}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium">{t('settings.aiChatThreads')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.aiChatThreadsHelp')}</p>
                    </div>
                    <Switch
                      checked={settingsForm.chatReplyInThread}
                      onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, chatReplyInThread: checked }))}
                      disabled={isAiFeatureDisabled || !settingsForm.chatEnabled}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t('settings.memory')}</p>
                    <p className="text-sm text-muted-foreground">{t('settings.memoryHelp')}</p>
                  </div>
                  <Switch
                    checked={settingsForm.memoryEnabled}
                    onCheckedChange={(checked) => setSettingsForm((current) => ({ ...current, memoryEnabled: checked }))}
                    disabled={isAiFeatureDisabled}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="memory-max">{t('settings.memoryMaxEntries')}</Label>
                    <Input
                      id="memory-max"
                      type="number"
                      min={50}
                      max={2000}
                      value={settingsForm.memoryMaxEntries}
                      onChange={(event) =>
                        setSettingsForm((current) => ({
                          ...current,
                          memoryMaxEntries: Number(event.target.value) || 0,
                        }))
                      }
                      disabled={isAiFeatureDisabled || !settingsForm.memoryEnabled}
                    />
                    <p className="text-xs text-muted-foreground">{t('settings.memoryMaxEntriesHelp')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memory-retention">{t('settings.memoryRetention')}</Label>
                    <Input
                      id="memory-retention"
                      type="number"
                      min={7}
                      max={365}
                      value={settingsForm.memoryRetentionDays}
                      onChange={(event) =>
                        setSettingsForm((current) => ({
                          ...current,
                          memoryRetentionDays: Number(event.target.value) || 0,
                        }))
                      }
                      disabled={isAiFeatureDisabled || !settingsForm.memoryEnabled}
                    />
                    <p className="text-xs text-muted-foreground">{t('settings.memoryRetentionHelp')}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium">{t('settings.webSearch')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.webSearchHelp')}</p>
                  {settingsForm.defaultProvider !== 'claude' && (
                    <p className="text-xs text-muted-foreground mt-2">{t('settings.webSearchRequiresClaude')}</p>
                  )}
                </div>
                <Switch
                  checked={settingsForm.webSearchEnabled}
                  onCheckedChange={(checked) =>
                    setSettingsForm((current) => ({ ...current, webSearchEnabled: checked }))
                  }
                  disabled={
                    isAiFeatureDisabled || settingsForm.defaultProvider !== 'claude'
                  }
                />
              </div>

              <Button onClick={handleSaveSettings} disabled={savingSettings || isAiFeatureDisabled}>
                {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('settings.save')}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <Card className="border-2 shadow-xl">
              <CardHeader>
                <CardTitle>{t('usage.title')}</CardTitle>
                <CardDescription>
                  {t('usage.description')}
                  {usageSummary?.tierName && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t('usage.tierLabel', { tier: usageSummary.tierName })}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {usageSummary ? (() => {
                  const limitTokens = usageSummary.limitTokens ?? -1;
                  const limitText = limitTokens >= 0 ? formatNumber(limitTokens) : t('usage.unlimited');
                  const usedText = formatNumber(usageSummary.tokensUsed);
                  const remainingText =
                    usageSummary.remainingTokens === null || limitTokens < 0
                      ? t('usage.unlimited')
                      : formatNumber(Math.max(usageSummary.remainingTokens, 0));
                  const usagePercent =
                    limitTokens > 0 ? Math.min((usageSummary.tokensUsed / limitTokens) * 100, 100) : 0;
                  return (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1 rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">{t('usage.limitLabel')}</div>
                          <div className="text-xl font-semibold">{limitText}</div>
                        </div>
                        <div className="space-y-1 rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">{t('usage.usedLabel')}</div>
                          <div className="text-xl font-semibold">{usedText}</div>
                        </div>
                        <div className="space-y-1 rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">{t('usage.remainingLabel')}</div>
                          <div className="text-xl font-semibold">{remainingText}</div>
                        </div>
                        <div className="space-y-1 rounded-lg border p-4">
                          <div className="text-sm text-muted-foreground">{t('usage.costLabel')}</div>
                          <div className="text-xl font-semibold">{formatCurrency(usageSummary.costUsd)}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{t('usage.progressLabel')}</span>
                          <span>
                            {limitTokens >= 0
                              ? `${usedText} / ${limitText} (${usagePercent.toFixed(1)}%)`
                              : usedText}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.max(0, Math.min(usagePercent, 100))}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        {t('usage.resetLabel', { date: formatDateTime(usageSummary.periodEnd) })}
                      </div>

                      {usageSummary.quotaExceeded && (
                        <Alert variant="destructive">
                          <AlertTitle>{t('usage.limitReachedTitle')}</AlertTitle>
                          <AlertDescription>
                            {t('usage.limitReachedDescription', { reset: formatDateTime(usageSummary.periodEnd) })}
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  );
                })() : (
                  <p className="text-sm text-muted-foreground">{t('usage.noData')}</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 shadow-xl">
              <CardHeader>
                <CardTitle>{t('usage.historyTitle')}</CardTitle>
                <CardDescription>{t('usage.historyDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                {usageLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('usage.historyEmpty')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-4 font-medium">{t('usage.table.date')}</th>
                          <th className="py-2 pr-4 font-medium">{t('usage.table.provider')}</th>
                          <th className="py-2 pr-4 font-medium">{t('usage.table.model')}</th>
                          <th className="py-2 pr-4 font-medium">{t('usage.table.task')}</th>
                          <th className="py-2 pr-4 font-medium">{t('usage.table.tokens')}</th>
                          <th className="py-2 pr-4 font-medium">{t('usage.table.cost')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageLogs.map((log) => (
                          <tr key={log.id} className="border-t border-border">
                            <td className="py-2 pr-4 align-top">{formatDateTime(log.createdAt)}</td>
                            <td className="py-2 pr-4 align-top">{log.provider || '—'}</td>
                            <td className="py-2 pr-4 align-top">{log.model || '—'}</td>
                            <td className="py-2 pr-4 align-top capitalize">{log.taskType || '—'}</td>
                            <td className="py-2 pr-4 align-top">
                              <div>{t('usage.tokensTotal', { value: formatNumber(log.tokensTotal) })}</div>
                              <div className="text-xs text-muted-foreground">
                                {t('usage.tokensBreakdown', {
                                  input: formatNumber(log.tokensInput),
                                  output: formatNumber(log.tokensOutput),
                                })}
                              </div>
                            </td>
                            <td className="py-2 pr-4 align-top">{formatCurrency(log.costUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memories" className="space-y-6">
            <Card className="space-y-6 p-6 border-2 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{t('memories.title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('memories.description', { count: memoryTotal })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={memoryTypeFilter}
                    onValueChange={(value) => {
                      setMemoryTypeFilter(value);
                      fetchMemories(value);
                    }}
                    disabled={memoriesLoading}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder={t('memories.filterAll')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('memories.filterAll')}</SelectItem>
                      <SelectItem value="interaction">{t('memories.filterInteraction')}</SelectItem>
                      <SelectItem value="event">{t('memories.filterEvent')}</SelectItem>
                      <SelectItem value="fact">{t('memories.filterFact')}</SelectItem>
                      <SelectItem value="summary">{t('memories.filterSummary')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" size="sm" onClick={() => fetchMemories()} disabled={memoriesLoading}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t('memories.refresh')}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {memoriesLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('memories.loading')}</span>
                  </div>
                )}

                {!memoriesLoading && memories.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('memories.empty')}</p>
                )}

                {!memoriesLoading &&
                  memories.map((memory) => (
                    <Card key={memory.id} className="p-4 border">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{memory.type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(memory.updated_at).toLocaleString(locale)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed">
                            {memory.label ? <strong>{memory.label}: </strong> : null}
                            {memory.summary}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">★ {memory.importance}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMemory(memory.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
