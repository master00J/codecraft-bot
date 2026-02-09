'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/navigation';
import { ArrowLeft } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface GiveawayRecord {
  id: string;
  prize: string;
  winner_count: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  host_id: string | null;
  host_name: string | null;
  required_role_id: string | null;
  entries: string[] | null;
  winners: string[] | null;
  ends_at: string;
  ended: boolean;
  created_at: string;
}

interface RecurringGiveaway {
  id: string;
  guild_id: string;
  channel_id: string;
  prize: string;
  winner_count: number;
  duration_minutes: number;
  interval_hours: number;
  next_run_at: string;
  enabled: boolean;
  created_at: string;
}

interface DiscordChannel {
  id: string;
  name: string;
}

interface DiscordRole {
  id: string;
  name: string;
}

type DurationUnit = 'minutes' | 'hours' | 'days';
type IntervalUnit = 'hours' | 'days';

function toMinutes(value: number, unit: DurationUnit): number {
  if (unit === 'minutes') return Math.round(value);
  if (unit === 'hours') return Math.round(value * 60);
  return Math.round(value * 24 * 60); // days
}

function toIntervalHours(value: number, unit: IntervalUnit): number {
  return unit === 'hours' ? value : value * 24;
}

const DEFAULT_FORM = {
  prize: '',
  durationValue: 60,
  durationUnit: 'minutes' as DurationUnit,
  channelId: '',
  winnerCount: 1,
  requiredRoleId: 'none',
  embedTitle: '',
  embedDescription: '',
  embedColor: '',
  embedFooter: '',
  embedImageUrl: '',
  embedThumbnailUrl: '',
  joinButtonLabel: '',
  ctaButtonLabel: '',
  ctaButtonUrl: '',
  rewardRoleId: 'none',
  rewardRoleRemoveAfter: '',
  rewardDmMessage: '',
  rewardChannelId: 'none',
  rewardChannelMessage: '',
};

export default function GiveawaysPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const locale = useLocale();
  const t = useTranslations('comcraft_giveaways');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [activeGiveaways, setActiveGiveaways] = useState<GiveawayRecord[]>([]);
  const [endedGiveaways, setEndedGiveaways] = useState<GiveawayRecord[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);

  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [createLoading, setCreateLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'embed' | 'rewards'>('basic');

  const [recurringGiveaways, setRecurringGiveaways] = useState<RecurringGiveaway[]>([]);
  const [recurringForm, setRecurringForm] = useState({
    prize: '',
    channelId: '',
    durationValue: 60,
    durationUnit: 'minutes' as DurationUnit,
    winnerCount: 1,
    intervalPreset: '24' as string,
    intervalCustomValue: 24,
    intervalCustomUnit: 'hours' as IntervalUnit,
    firstRunAt: '',
  });
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringActionId, setRecurringActionId] = useState<string | null>(null);

  useEffect(() => {
    if (guildId) {
      void fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  useEffect(() => {
    const first = channels?.[0];
    if (first?.id) {
      if (!formState.channelId) {
        setFormState((current) => ({ ...current, channelId: first.id }));
      }
      setRecurringForm((f) => (f.channelId ? f : { ...f, channelId: first.id }));
    }
  }, [channels, formState.channelId]);

  const rolesMap = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((role) => map.set(role.id, role.name));
    return map;
  }, [roles]);

  const formatDateTime = (value: string) => {
    try {
      return new Date(value).toLocaleString(locale);
    } catch (error) {
      return value;
    }
  };

  const entriesLabel = (entries: string[] | null | undefined) => {
    const count = entries?.length || 0;
    return t('labels.entries', { count });
  };

  const resolvedColor = useMemo(() => {
    const raw = (formState.embedColor || '').trim();
    if (/^#?[0-9a-f]{6}$/i.test(raw)) {
      return raw.startsWith('#') ? raw : `#${raw}`;
    }
    return '#FACC15';
  }, [formState.embedColor]);

  const previewData = useMemo(() => {
    const winners = Number(formState.winnerCount) || 1;
    const participants = 42; // illustrative
    const baseDescription = [
      t('preview.defaultLineHost'),
      t('preview.defaultLineWinners', { winners }),
      t('preview.defaultLineParticipants', { count: participants }),
      t('preview.defaultLineEnds'),
    ].join('\n');

    const joinLabel = formState.joinButtonLabel?.trim() || t('preview.joinFallback');
    const channelName = (() => {
      if (!formState.channelId) {
        return t('preview.channelFallback');
      }
      const channel = channels.find((item) => item.id === formState.channelId);
      return channel ? channel.name : t('preview.channelFallback');
    })();

    return {
      title: formState.embedTitle?.trim() || (formState.prize ? `🎉 ${formState.prize}` : t('preview.defaultTitle')),
      description: formState.embedDescription?.trim() || baseDescription,
      footer: formState.embedFooter?.trim() || t('preview.defaultFooter'),
      imageUrl: formState.embedImageUrl?.trim() || null,
      thumbnailUrl: formState.embedThumbnailUrl?.trim() || null,
      joinLabel,
      linkLabel: formState.ctaButtonLabel?.trim() || null,
      linkUrl: formState.ctaButtonUrl?.trim() || null,
      channel: channelName,
      color: resolvedColor,
    };
  }, [formState, resolvedColor, channels, t]);

  const winnerMentions = (winnerIds: string[] | null | undefined) => {
    if (!winnerIds || winnerIds.length === 0) {
      return t('labels.noWinners');
    }

    return winnerIds.map((id) => `<@${id}>`).join(', ');
  };

  const refreshDefaultChannel = (channelList: DiscordChannel[]) => {
    const first = channelList?.[0];
    if (!formState.channelId && first?.id) {
      setFormState((current) => ({ ...current, channelId: first.id }));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [giveawaysRes, channelsRes, rolesRes, recurringRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/giveaways`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`),
        fetch(`/api/comcraft/guilds/${guildId}/giveaways/recurring`),
      ]);

      const giveawaysData = await giveawaysRes.json();
      const recurringData = await recurringRes.json();
      if (recurringRes.ok && Array.isArray(recurringData.recurring)) {
        setRecurringGiveaways(recurringData.recurring);
      }
      if (!giveawaysRes.ok) {
        throw new Error(giveawaysData.error || 'Failed to load giveaways');
      }

      setFeatureEnabled(giveawaysData.featureEnabled !== false);
      setActiveGiveaways(Array.isArray(giveawaysData.active) ? giveawaysData.active : []);
      setEndedGiveaways(Array.isArray(giveawaysData.ended) ? giveawaysData.ended : []);

      const channelsData = await channelsRes.json();
      if (channelsRes.ok && channelsData.success !== false) {
        const textChannels: DiscordChannel[] = Array.isArray(channelsData.channels?.text)
          ? channelsData.channels.text
              .filter((ch: any) => ch && ch.id)
              .map((channel: any) => ({ id: String(channel.id), name: String(channel.name ?? '') }))
          : [];
        setChannels(textChannels);
        refreshDefaultChannel(textChannels);
      }

      const rolesData = await rolesRes.json();
      if (rolesRes.ok && rolesData.success !== false) {
        const mappedRoles: DiscordRole[] = Array.isArray(rolesData.roles)
          ? rolesData.roles
              .filter((r: any) => r && r.id)
              .map((role: any) => ({ id: String(role.id), name: String(role.name ?? '') }))
          : [];
        setRoles(mappedRoles);
      }
    } catch (error: any) {
      console.error('Failed to load giveaway dashboard data:', error);
      toast({
        title: t('toast.loadError.title'),
        description: t('toast.loadError.description'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!featureEnabled) {
      toast({
        title: t('toast.featureDisabled.title'),
        description: t('toast.featureDisabled.description'),
        variant: 'destructive',
      });
      return;
    }

    if (!formState.prize.trim()) {
      toast({
        title: t('toast.validation.title'),
        description: t('toast.validation.prize'),
        variant: 'destructive',
      });
      return;
    }

    if (!formState.channelId) {
      toast({
        title: t('toast.validation.title'),
        description: t('toast.validation.channel'),
        variant: 'destructive',
      });
      return;
    }

    if (formState.ctaButtonUrl && !formState.ctaButtonLabel) {
      toast({
        title: t('toast.validation.title'),
        description: t('toast.validation.ctaLabel'),
        variant: 'destructive',
      });
      return;
    }

    if (formState.rewardChannelMessage && formState.rewardChannelId === 'none') {
      toast({
        title: t('toast.validation.title'),
        description: t('toast.validation.rewardChannel'),
        variant: 'destructive',
      });
      return;
    }

    if (formState.rewardRoleRemoveAfter) {
      const parsedRemove = Number(formState.rewardRoleRemoveAfter);
      if (!Number.isFinite(parsedRemove) || parsedRemove < 0 || parsedRemove > 43200) {
        toast({
          title: t('toast.validation.title'),
          description: t('toast.validation.rewardRoleDuration'),
          variant: 'destructive',
        });
        return;
      }
    }

    setCreateLoading(true);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/giveaways`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prize: formState.prize.trim(),
          durationMinutes: toMinutes(Number(formState.durationValue) || 60, formState.durationUnit),
          channelId: formState.channelId,
          winnerCount: Number(formState.winnerCount) || 1,
          requiredRoleId: formState.requiredRoleId === 'none' ? null : formState.requiredRoleId,
          embedTitle: formState.embedTitle,
          embedDescription: formState.embedDescription,
          embedColor: formState.embedColor,
          embedFooter: formState.embedFooter,
          embedImageUrl: formState.embedImageUrl,
          embedThumbnailUrl: formState.embedThumbnailUrl,
          joinButtonLabel: formState.joinButtonLabel,
          ctaButtonLabel: formState.ctaButtonLabel,
          ctaButtonUrl: formState.ctaButtonUrl,
          rewardRoleId: formState.rewardRoleId === 'none' ? null : formState.rewardRoleId,
          rewardRoleRemoveAfter: formState.rewardRoleRemoveAfter ? Number(formState.rewardRoleRemoveAfter) : null,
          rewardDmMessage: formState.rewardDmMessage,
          rewardChannelId: formState.rewardChannelId === 'none' ? null : formState.rewardChannelId,
          rewardChannelMessage: formState.rewardChannelMessage,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Failed to start giveaway');
      }

      toast({
        title: t('toast.started.title'),
        description: t('toast.started.description'),
      });

      setFormState(DEFAULT_FORM);
      setActiveTab('basic');
      await fetchData();
    } catch (error: any) {
      console.error('Failed to create giveaway:', error);
      toast({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.description'),
        variant: 'destructive',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAction = async (giveawayId: string, action: 'end' | 'reroll') => {
    setActionLoading(`${giveawayId}:${action}`);
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/giveaways/${giveawayId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Action failed');
      }

      toast({
        title: action === 'end' ? t('toast.ended.title') : t('toast.rerolled.title'),
        description: action === 'end'
          ? t('toast.ended.description')
          : t('toast.rerolled.description'),
      });

      await fetchData();
    } catch (error: any) {
      console.error('Failed to update giveaway:', error);
      toast({
        title: t('toast.error.title'),
        description: error.message || t('toast.error.description'),
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const isActionLoading = (giveawayId: string, action: 'end' | 'reroll') => {
    return actionLoading === `${giveawayId}:${action}`;
  };

  const handleReset = () => {
    setFormState((previous) => ({
      ...DEFAULT_FORM,
      channelId: previous.channelId || '',
    }));
    setActiveTab('basic');
  };

  const lookupChannelName = (channelId: string) => {
    const channel = channels.find((item) => item.id === channelId);
    return channel ? channel.name : t('labels.unknownChannel');
  };

  const INTERVAL_PRESETS: { value: number; label: string }[] = [
    { value: 6, label: t('recurring.interval6h') },
    { value: 12, label: t('recurring.interval12h') },
    { value: 24, label: t('recurring.interval24h') },
    { value: 48, label: t('recurring.interval48h') },
    { value: 168, label: t('recurring.intervalWeekly') },
  ];

  const recurringIntervalHours = recurringForm.intervalPreset === 'custom'
    ? toIntervalHours(Number(recurringForm.intervalCustomValue) || 24, recurringForm.intervalCustomUnit)
    : Number(recurringForm.intervalPreset) || 24;

  const handleCreateRecurring = async () => {
    if (!recurringForm.prize.trim() || !recurringForm.channelId) {
      toast({ title: t('toast.validation.title'), description: t('recurring.validationPrizeChannel'), variant: 'destructive' });
      return;
    }
    setRecurringSaving(true);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/giveaways/recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prize: recurringForm.prize.trim(),
          channelId: recurringForm.channelId,
          durationMinutes: toMinutes(Number(recurringForm.durationValue) || 60, recurringForm.durationUnit),
          winnerCount: recurringForm.winnerCount,
          intervalHours: recurringIntervalHours,
          firstRunAt: recurringForm.firstRunAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      toast({ title: t('recurring.toastCreated.title'), description: t('recurring.toastCreated.description') });
      setRecurringForm({
        prize: '',
        channelId: recurringForm.channelId,
        durationValue: 60,
        durationUnit: 'minutes',
        winnerCount: 1,
        intervalPreset: '24',
        intervalCustomValue: 24,
        intervalCustomUnit: 'hours',
        firstRunAt: '',
      });
      await fetchData();
    } catch (e: any) {
      toast({ title: t('toast.error.title'), description: e.message || t('toast.error.description'), variant: 'destructive' });
    } finally {
      setRecurringSaving(false);
    }
  };

  const handleToggleRecurring = async (id: string, enabled: boolean) => {
    setRecurringActionId(id);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/giveaways/recurring/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      await fetchData();
    } catch (e: any) {
      toast({ title: t('toast.error.title'), description: e.message, variant: 'destructive' });
    } finally {
      setRecurringActionId(null);
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    setRecurringActionId(id);
    try {
      const res = await fetch(`/api/comcraft/guilds/${guildId}/giveaways/recurring/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      toast({ title: t('recurring.toastDeleted.title'), description: t('recurring.toastDeleted.description') });
      await fetchData();
    } catch (e: any) {
      toast({ title: t('toast.error.title'), description: e.message, variant: 'destructive' });
    } finally {
      setRecurringActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
        >
          <Link href={`/comcraft/dashboard/${guildId}`} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('actions.back')}
          </Link>
        </Button>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleReset}>
              {t('actions.reset')}
            </Button>
            <Button onClick={handleCreate} disabled={createLoading || !featureEnabled}>
              {createLoading ? t('actions.saving') : t('actions.confirm')}
            </Button>
          </div>
        </div>
      </div>

      {!featureEnabled && (
        <Alert className="border-destructive/50">
          <AlertTitle>{t('featureDisabled.title')}</AlertTitle>
          <AlertDescription>{t('featureDisabled.description')}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-6 p-6">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{t('dialog.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('dialog.description')}</p>
          </div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-4">
                  <TabsList className="grid grid-cols-3">
                    <TabsTrigger value="basic">{t('tabs.basic')}</TabsTrigger>
                    <TabsTrigger value="embed">{t('tabs.embed')}</TabsTrigger>
                    <TabsTrigger value="rewards">{t('tabs.rewards')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="giveaway-prize">{t('fields.prize')}</Label>
                      <Input
                        id="giveaway-prize"
                        value={formState.prize}
                        placeholder={t('fields.prizePlaceholder')}
                        onChange={(event) => setFormState((current) => ({ ...current, prize: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="giveaway-duration">{t('fields.duration')}</Label>
                        <div className="flex gap-2">
                          <Input
                            id="giveaway-duration"
                            type="number"
                            min={1}
                            value={formState.durationValue}
                            onChange={(e) => setFormState((c) => ({ ...c, durationValue: Number(e.target.value) || 1 }))}
                            className="flex-1"
                          />
                          <Select
                            value={formState.durationUnit}
                            onValueChange={(v) => setFormState((c) => ({ ...c, durationUnit: v as DurationUnit }))}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="minutes">{t('fields.durationUnitMinutes')}</SelectItem>
                              <SelectItem value="hours">{t('fields.durationUnitHours')}</SelectItem>
                              <SelectItem value="days">{t('fields.durationUnitDays')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('fields.durationHelp')}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="giveaway-winners">{t('fields.winners')}</Label>
                        <Input
                          id="giveaway-winners"
                          type="number"
                          min={1}
                          max={25}
                          value={formState.winnerCount}
                          onChange={(event) => setFormState((current) => ({ ...current, winnerCount: Number(event.target.value) }))}
                        />
                        <p className="text-xs text-muted-foreground">{t('fields.winnersHelp')}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('fields.channel')}</Label>
                      <Select
                        value={formState.channelId}
                        onValueChange={(value) => setFormState((current) => ({ ...current, channelId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('fields.channelPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {channels.length === 0 && (
                            <SelectItem value="placeholder" disabled>
                              {t('fields.noChannels')}
                            </SelectItem>
                          )}
                          {channels.filter((ch) => ch?.id).map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              #{channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('fields.role')}</Label>
                      <Select
                        value={formState.requiredRoleId}
                        onValueChange={(value) => setFormState((current) => ({ ...current, requiredRoleId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('fields.noRole')}</SelectItem>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              @{role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="embed" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t('fields.embedTitle')}</Label>
                        <Input
                          value={formState.embedTitle}
                          onChange={(event) => setFormState((current) => ({ ...current, embedTitle: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('fields.embedColor')}</Label>
                        <Input
                          placeholder="#FACC15"
                          value={formState.embedColor}
                          onChange={(event) => setFormState((current) => ({ ...current, embedColor: event.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">{t('fields.embedColorHelp')}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('fields.embedDescription')}</Label>
                      <Textarea
                        rows={4}
                        value={formState.embedDescription}
                        onChange={(event) => setFormState((current) => ({ ...current, embedDescription: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t('fields.embedImageUrl')}</Label>
                        <Input
                          placeholder="https://..."
                          value={formState.embedImageUrl}
                          onChange={(event) => setFormState((current) => ({ ...current, embedImageUrl: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('fields.embedThumbnailUrl')}</Label>
                        <Input
                          placeholder="https://..."
                          value={formState.embedThumbnailUrl}
                          onChange={(event) => setFormState((current) => ({ ...current, embedThumbnailUrl: event.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t('fields.embedFooter')}</Label>
                        <Input
                          value={formState.embedFooter}
                          onChange={(event) => setFormState((current) => ({ ...current, embedFooter: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('fields.joinButtonLabel')}</Label>
                        <Input
                          value={formState.joinButtonLabel}
                          onChange={(event) => setFormState((current) => ({ ...current, joinButtonLabel: event.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">{t('fields.joinButtonHelp')}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t('fields.ctaButtonLabel')}</Label>
                        <Input
                          value={formState.ctaButtonLabel}
                          onChange={(event) => setFormState((current) => ({ ...current, ctaButtonLabel: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('fields.ctaButtonUrl')}</Label>
                        <Input
                          placeholder="https://..."
                          value={formState.ctaButtonUrl}
                          onChange={(event) => setFormState((current) => ({ ...current, ctaButtonUrl: event.target.value }))}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="rewards" className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t('fields.rewardRole')}</Label>
                        <Select
                          value={formState.rewardRoleId}
                          onValueChange={(value) => setFormState((current) => ({ ...current, rewardRoleId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('fields.noRole')}</SelectItem>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                @{role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('fields.rewardRoleRemove')}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={43200}
                          placeholder="0"
                          value={formState.rewardRoleRemoveAfter}
                          onChange={(event) => setFormState((current) => ({ ...current, rewardRoleRemoveAfter: event.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">{t('fields.rewardRoleHelp')}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{t('fields.rewardDmMessage')}</Label>
                      <Textarea
                        rows={3}
                        value={formState.rewardDmMessage}
                        onChange={(event) => setFormState((current) => ({ ...current, rewardDmMessage: event.target.value }))}
                        placeholder={t('fields.rewardDmPlaceholder')}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>{t('fields.rewardChannel')}</Label>
                        <Select
                          value={formState.rewardChannelId}
                          onValueChange={(value) => setFormState((current) => ({ ...current, rewardChannelId: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('fields.rewardChannelNone')}</SelectItem>
                            {channels.filter((ch) => ch?.id).map((channel) => (
                              <SelectItem key={channel.id} value={channel.id}>
                                #{channel.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t('fields.rewardChannelMessage')}</Label>
                        <Textarea
                          rows={3}
                          value={formState.rewardChannelMessage}
                          onChange={(event) => setFormState((current) => ({ ...current, rewardChannelMessage: event.target.value }))}
                          placeholder={t('fields.rewardChannelPlaceholder')}
                        />
                        <p className="text-xs text-muted-foreground">{t('fields.rewardChannelHelp')}</p>
                      </div>
                    </div>
                  </TabsContent>
          </Tabs>
        </Card>
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: previewData.color }} />
            <div className="space-y-4 p-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('preview.previewLabel')}
                </p>
                <h3 className="text-lg font-semibold leading-tight">{previewData.title}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">#{previewData.channel}</Badge>
                <span>{t('preview.winnerCount', { count: Number(formState.winnerCount) || 1 })}</span>
              </div>
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {previewData.description}
              </p>
              {previewData.imageUrl ? (
                <div className="overflow-hidden rounded-md border bg-muted/40">
                  <img
                    src={previewData.imageUrl}
                    alt={previewData.title}
                    className="h-32 w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="pointer-events-none">
                  {previewData.joinLabel}
                </Button>
                {previewData.linkLabel && previewData.linkUrl ? (
                  <Button size="sm" variant="outline" className="pointer-events-none">
                    {previewData.linkLabel}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{previewData.footer}</p>
            </div>
          </Card>
          {(formState.rewardRoleId !== 'none' ||
            formState.rewardDmMessage ||
            (formState.rewardChannelId !== 'none' && formState.rewardChannelMessage)) && (
            <Card className="space-y-2 p-4">
              <p className="text-sm font-medium">{t('preview.rewardSummaryTitle')}</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {formState.rewardRoleId !== 'none' && (
                  <li>{t('preview.rewardRole', { role: roles.find((r) => r.id === formState.rewardRoleId)?.name || 'role' })}</li>
                )}
                {formState.rewardDmMessage && <li>{t('preview.rewardDm')}</li>}
                {formState.rewardChannelId !== 'none' && formState.rewardChannelMessage && (
                  <li>{t('preview.rewardChannel', { channel: lookupChannelName(formState.rewardChannelId) })}</li>
                )}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{t('recurring.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('recurring.description')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="space-y-1.5">
            <Label>{t('recurring.prize')}</Label>
            <Input
              value={recurringForm.prize}
              onChange={(e) => setRecurringForm((f) => ({ ...f, prize: e.target.value }))}
              placeholder={t('fields.prizePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('recurring.channel')}</Label>
            <Select
              value={recurringForm.channelId}
              onValueChange={(v) => setRecurringForm((f) => ({ ...f, channelId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('fields.channelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {channels.filter((ch) => ch?.id).map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>#{ch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('recurring.duration')}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={recurringForm.durationValue}
                onChange={(e) => setRecurringForm((f) => ({ ...f, durationValue: Number(e.target.value) || 1 }))}
                className="flex-1"
              />
              <Select
                value={recurringForm.durationUnit}
                onValueChange={(v) => setRecurringForm((f) => ({ ...f, durationUnit: v as DurationUnit }))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">{t('fields.durationUnitMinutes')}</SelectItem>
                  <SelectItem value="hours">{t('fields.durationUnitHours')}</SelectItem>
                  <SelectItem value="days">{t('fields.durationUnitDays')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('recurring.interval')}</Label>
            <Select
              value={recurringForm.intervalPreset}
              onValueChange={(v) => setRecurringForm((f) => ({ ...f, intervalPreset: v, intervalCustomValue: v === 'custom' ? recurringForm.intervalCustomValue : Number(v) || 24, intervalCustomUnit: recurringForm.intervalCustomUnit }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                ))}
                <SelectItem value="custom">{t('recurring.intervalCustom')}</SelectItem>
              </SelectContent>
            </Select>
            {recurringForm.intervalPreset === 'custom' && (
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  max={recurringForm.intervalCustomUnit === 'days' ? 365 : 8760}
                  value={recurringForm.intervalCustomValue}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, intervalCustomValue: Number(e.target.value) || 1 }))}
                  className="flex-1"
                />
                <Select
                  value={recurringForm.intervalCustomUnit}
                  onValueChange={(v) => setRecurringForm((f) => ({ ...f, intervalCustomUnit: v as IntervalUnit }))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">{t('recurring.intervalUnitHours')}</SelectItem>
                    <SelectItem value="days">{t('recurring.intervalUnitDays')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button onClick={handleCreateRecurring} disabled={recurringSaving || !featureEnabled}>
            {recurringSaving ? t('actions.saving') : t('recurring.add')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('recurring.hint')}</p>
        {recurringGiveaways.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('recurring.empty')}</p>
        ) : (
          <div className="space-y-2">
            {recurringGiveaways.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <span className="font-medium">{r.prize}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    #{lookupChannelName(r.channel_id)} · {r.duration_minutes}m · {t('recurring.every', { hours: r.interval_hours })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t('recurring.nextRun')} {formatDateTime(r.next_run_at)}
                  </span>
                  <Button
                    size="sm"
                    variant={r.enabled ? 'secondary' : 'default'}
                    onClick={() => handleToggleRecurring(r.id, !r.enabled)}
                    disabled={recurringActionId === r.id}
                  >
                    {r.enabled ? t('recurring.disable') : t('recurring.enable')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteRecurring(r.id)}
                    disabled={recurringActionId === r.id}
                  >
                    {t('recurring.delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t('sections.activeTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('sections.activeDescription')}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : activeGiveaways.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('sections.activeEmpty')}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeGiveaways.map((giveaway) => (
              <Card key={giveaway.id} className="p-4 space-y-3 border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{giveaway.prize}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('labels.hostedBy', { host: giveaway.host_name || t('labels.unknownHost') })}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {t('labels.endsAt', { time: formatDateTime(giveaway.ends_at) })}
                  </Badge>
                </div>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>{entriesLabel(giveaway.entries)}</p>
                  <p>{t('labels.channel', { channel: `#${lookupChannelName(giveaway.channel_id)}` })}</p>
                  <p>
                    {t('labels.requiredRole', {
                      role: giveaway.required_role_id
                        ? `@${rolesMap.get(giveaway.required_role_id) || t('labels.unknownRole')}`
                        : t('labels.noRoleSelected'),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAction(giveaway.id, 'end')}
                    disabled={isActionLoading(giveaway.id, 'end')}
                  >
                    {isActionLoading(giveaway.id, 'end') ? t('actions.processing') : t('actions.end')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(giveaway.id, 'reroll')}
                    disabled={isActionLoading(giveaway.id, 'reroll')}
                  >
                    {isActionLoading(giveaway.id, 'reroll') ? t('actions.processing') : t('actions.reroll')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t('sections.endedTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('sections.endedDescription')}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : endedGiveaways.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('sections.endedEmpty')}</p>
        ) : (
          <div className="space-y-3">
            {endedGiveaways.map((giveaway) => (
              <Card key={giveaway.id} className="p-4 space-y-3 border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{giveaway.prize}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('labels.hostedBy', { host: giveaway.host_name || t('labels.unknownHost') })}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {t('labels.endedAt', { time: formatDateTime(giveaway.ends_at) })}
                  </Badge>
                </div>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>{entriesLabel(giveaway.entries)}</p>
                  <p>{t('labels.winners', { winners: winnerMentions(giveaway.winners) })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(giveaway.id, 'reroll')}
                    disabled={isActionLoading(giveaway.id, 'reroll')}
                  >
                    {isActionLoading(giveaway.id, 'reroll') ? t('actions.processing') : t('actions.reroll')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
