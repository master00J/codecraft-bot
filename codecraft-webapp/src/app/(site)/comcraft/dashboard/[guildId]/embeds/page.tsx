'use client';

/**
 * ComCraft Visual Embed Builder
 * Create, save, and schedule beautiful Discord embeds
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CapsuleBuilderContent from './capsule-builder';

export default function EmbedBuilder() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [embeds, setEmbeds] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  // Builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingEmbed, setEditingEmbed] = useState<any>(null);
  const [builderMode, setBuilderMode] = useState<'embed' | 'capsule'>('embed'); // New: embed or capsule mode
  const [embed, setEmbed] = useState({
    name: '',
    template_type: 'custom',
    title: '',
    description: '',
    color: '#5865F2',
    url: '',
    thumbnail_url: '',
    image_url: '',
    footer_text: '',
    footer_icon_url: '',
    author_name: '',
    author_icon_url: '',
    author_url: '',
    show_timestamp: false,
    fields: [] as any[],
    components: [] as any[], // Action rows with buttons
    tags: [] as string[]
  });

  // Capsule state
  const [capsule, setCapsule] = useState({
    name: '',
    capsule_type: 'custom',
    content: '',
    embeds: [] as any[],
    components: [] as any[],
    tags: [] as string[]
  });

  // Field builder
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({
    name: '',
    value: '',
    inline: false
  });

  // Button builder
  const [showAddButton, setShowAddButton] = useState(false);
  const [editingButtonRow, setEditingButtonRow] = useState<number | null>(null);
  const [newButton, setNewButton] = useState({
    label: '',
    style: '1', // 1=Primary, 2=Secondary, 3=Success, 4=Danger, 5=Link
    custom_id: '',
    emoji: '',
    url: '',
    disabled: false
  });

  // Post dialog
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [postingEmbed, setPostingEmbed] = useState<any>(null);
  const [postChannel, setPostChannel] = useState('');
  const [mentionRole, setMentionRole] = useState('none');
  const [pinMessage, setPinMessage] = useState(false);

  // Schedule dialog
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [schedulingEmbed, setSchedulingEmbed] = useState<any>(null);
  const [scheduleType, setScheduleType] = useState('once');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('12:00');

  // Image upload
  const [uploading, setUploading] = useState(false);

  // Button presets for quick selection
  const buttonPresets: Record<string, { label: string; emoji: string; style: string }> = {
    'duel_challenge': { label: 'Challenge to Duel', emoji: '⚔️', style: '4' },
    'create_ticket': { label: 'Create Ticket', emoji: '🎫', style: '1' },
    'verify': { label: 'Verify', emoji: '✅', style: '3' },
    'quick_verify': { label: 'Quick Verify', emoji: '✅', style: '3' },
    'feedback_submit': { label: 'Submit Feedback', emoji: '💬', style: '1' },
  };

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [embedsRes, templatesRes, channelsRes, rolesRes, schedulesRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/embeds`),
        fetch(`/api/comcraft/embed-templates`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`),
        fetch(`/api/comcraft/guilds/${guildId}/embeds/schedule`)
      ]);

      const [embedsData, templatesData, channelsData, rolesData, schedulesData] = await Promise.all([
        embedsRes.json(),
        templatesRes.json(),
        channelsRes.json(),
        rolesRes.json(),
        schedulesRes.json()
      ]);

      setEmbeds(embedsData.embeds || []);
      setTemplates(templatesData.templates || []);
      if (channelsData.success) setChannels(channelsData.channels?.text || []);
      if (rolesData.success) setRoles(rolesData.roles || []);
      setSchedules(schedulesData.schedules || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setEditingEmbed(null);
    if (builderMode === 'capsule') {
      setCapsule({
        name: '',
        capsule_type: 'custom',
        content: '',
        embeds: [],
        components: [],
        tags: []
      });
    } else {
      setEmbed({
        name: '',
        template_type: 'custom',
        title: '',
        description: '',
        color: '#5865F2',
        url: '',
        thumbnail_url: '',
        image_url: '',
        footer_text: '',
        footer_icon_url: '',
        author_name: '',
        author_icon_url: '',
        author_url: '',
        show_timestamp: false,
        fields: [],
        components: [],
        tags: []
      });
    }
    setShowBuilder(true);
  };

  const startEdit = (savedEmbed: any) => {
    setEditingEmbed(savedEmbed);
    if (savedEmbed.is_capsule) {
      setBuilderMode('capsule');
      setCapsule({
        name: savedEmbed.name,
        capsule_type: savedEmbed.capsule_type || 'custom',
        content: savedEmbed.content || '',
        embeds: savedEmbed.embeds || [],
        components: savedEmbed.components || [],
        tags: savedEmbed.tags || []
      });
    } else {
      setBuilderMode('embed');
      setEmbed({
        name: savedEmbed.name,
        template_type: savedEmbed.template_type,
        title: savedEmbed.title,
        description: savedEmbed.description,
        color: savedEmbed.color,
        url: savedEmbed.url,
        thumbnail_url: savedEmbed.thumbnail_url,
        image_url: savedEmbed.image_url,
        footer_text: savedEmbed.footer_text,
        footer_icon_url: savedEmbed.footer_icon_url,
        author_name: savedEmbed.author_name,
        author_icon_url: savedEmbed.author_icon_url,
        author_url: savedEmbed.author_url,
        show_timestamp: savedEmbed.show_timestamp,
        fields: savedEmbed.fields || [],
        components: savedEmbed.components || [],
        tags: savedEmbed.tags || []
      });
    }
    setShowBuilder(true);
  };

  const loadTemplate = (template: any) => {
    setEmbed({
      ...embed,
      name: `${template.name} (Copy)`,
      template_type: template.category,
      title: template.title,
      description: template.embed_description || template.description, // Handle both formats
      color: template.color,
      fields: template.fields || [],
      footer_text: template.footer_text
    });
  };

  const addField = () => {
    if (!newField.name || !newField.value) {
      alert('Field name and value are required!');
      return;
    }

    setEmbed({
      ...embed,
      fields: [...embed.fields, newField]
    });

    setNewField({ name: '', value: '', inline: false });
    setShowAddField(false);
  };

  const removeField = (index: number) => {
    setEmbed({
      ...embed,
      fields: embed.fields.filter((_: any, i: number) => i !== index)
    });
  };

  // Button management functions
  const addButtonRow = () => {
    if (embed.components.length >= 5) {
      alert('Maximum 5 button rows allowed!');
      return;
    }
    setEmbed({
      ...embed,
      components: [...embed.components, { type: 1, components: [] }]
    });
  };

  const removeButtonRow = (rowIndex: number) => {
    setEmbed({
      ...embed,
      components: embed.components.filter((_: any, i: number) => i !== rowIndex)
    });
  };

  const addButton = (rowIndex: number) => {
    const row = embed.components[rowIndex];
    if (row.components.length >= 5) {
      alert('Maximum 5 buttons per row!');
      return;
    }

    if (newButton.style === '5') {
      // Link button requires URL
      if (!newButton.url) {
        alert('URL is required for Link buttons!');
        return;
      }
    } else {
      // Regular button requires label and custom_id
      if (!newButton.label || !newButton.custom_id) {
        alert('Label and Custom ID are required!');
        return;
      }
    }

    const button = {
      type: 2,
      style: parseInt(newButton.style),
      label: newButton.label,
      custom_id: newButton.style !== '5' ? newButton.custom_id : undefined,
      url: newButton.style === '5' ? newButton.url : undefined,
      emoji: newButton.emoji ? { name: newButton.emoji } : undefined,
      disabled: newButton.disabled
    };

    const updatedComponents = [...embed.components];
    updatedComponents[rowIndex] = {
      ...updatedComponents[rowIndex],
      components: [...updatedComponents[rowIndex].components, button]
    };

    setEmbed({
      ...embed,
      components: updatedComponents
    });

    setNewButton({ label: '', style: '1', custom_id: '', emoji: '', url: '', disabled: false });
    setShowAddButton(false);
    setEditingButtonRow(null);
  };

  const removeButton = (rowIndex: number, buttonIndex: number) => {
    const updatedComponents = [...embed.components];
    updatedComponents[rowIndex] = {
      ...updatedComponents[rowIndex],
      components: updatedComponents[rowIndex].components.filter((_: any, i: number) => i !== buttonIndex)
    };

    setEmbed({
      ...embed,
      components: updatedComponents
    });
  };

  const handleImageUpload = async (type: 'thumbnail' | 'image' | 'footer_icon' | 'author_icon') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/comcraft/guilds/${guildId}/embeds/upload-image`, {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          if (type === 'thumbnail') setEmbed({ ...embed, thumbnail_url: result.url });
          else if (type === 'image') setEmbed({ ...embed, image_url: result.url });
          else if (type === 'footer_icon') setEmbed({ ...embed, footer_icon_url: result.url });
          else if (type === 'author_icon') setEmbed({ ...embed, author_icon_url: result.url });
          
          alert('✅ Image uploaded!');
        } else {
          alert(`❌ Upload failed: ${result.error}`);
        }
      } catch (error) {
        alert('❌ Upload error');
      } finally {
        setUploading(false);
      }
    };

    input.click();
  };

  const saveEmbed = async () => {
    if (builderMode === 'capsule') {
      if (!capsule.name) {
        alert('Capsule name is required!');
        return;
      }

      try {
        const isEditing = !!editingEmbed;
        const payload = {
          is_capsule: true,
          capsule_type: capsule.capsule_type,
          name: capsule.name,
          content: capsule.content,
          embeds: capsule.embeds,
          components: capsule.components,
          tags: capsule.tags,
          ...(isEditing ? { id: editingEmbed.id } : {})
        };

        const response = await fetch(`/api/comcraft/guilds/${guildId}/embeds`, {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success || result.embed) {
          alert(isEditing ? '✅ Capsule updated!' : '✅ Capsule saved!');
          setShowBuilder(false);
          fetchData();
        } else {
          alert(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        alert('❌ Error saving capsule');
      }
    } else {
      if (!embed.name) {
        alert('Embed name is required!');
        return;
      }

      try {
        const isEditing = !!editingEmbed;
        const response = await fetch(`/api/comcraft/guilds/${guildId}/embeds`, {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isEditing ? { ...embed, id: editingEmbed.id, is_capsule: false } : { ...embed, is_capsule: false })
        });

        const result = await response.json();

        if (result.success || result.embed) {
          alert(isEditing ? '✅ Embed updated!' : '✅ Embed saved!');
          setShowBuilder(false);
          fetchData();
        } else {
          alert(`❌ Error: ${result.error}`);
        }
      } catch (error) {
        alert('❌ Error saving');
      }
    }
  };

  const postEmbed = async () => {
    if (!postChannel) {
      alert('Select a channel!');
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/embeds/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedId: postingEmbed.id,
          channelId: postChannel,
          mentionRoleId: (mentionRole && mentionRole !== 'none') ? mentionRole : undefined,
          pinMessage
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Embed posted to Discord!');
        setShowPostDialog(false);
        setPostingEmbed(null);
        setPostChannel('');
        setMentionRole('none');
        setPinMessage(false);
        fetchData(); // Refresh to update usage stats
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      alert('❌ Error posting');
    }
  };

  const deleteEmbed = async (embedId: string) => {
    if (!confirm('Are you sure you want to delete this embed?')) return;

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/embeds?id=${embedId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Embed deleted!');
        fetchData();
      }
    } catch (error) {
      alert('❌ Error deleting');
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
              <h1 className="text-3xl font-bold mb-2">📝 Embed & Capsule Builder</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Create beautiful Discord embeds or advanced capsules with multiple embeds, buttons, and more!
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/comcraft/dashboard/${guildId}`}>← Back</Link>
            </Button>
          </div>

          {/* Info Card */}
          <Card className="p-4 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="text-sm">
                <div className="font-semibold mb-1">What can you create?</div>
                <p className="text-gray-600 dark:text-gray-400">
                  <strong>Embeds:</strong> Single embed messages with images, fields, and styling.<br/>
                  <strong>Capsules:</strong> Advanced messages with multiple embeds, buttons, select menus, and more! (Like Nightly bot)
                </p>
              </div>
            </div>
          </Card>

          {/* Button ID Quick Reference */}
          <Card className="p-4 bg-green-50 dark:bg-green-900/20 mt-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔘</div>
              <div className="text-sm flex-1">
                <div className="font-semibold mb-2">Quick Button ID Reference</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">duel_challenge</code> - Duel</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">duel_accept_&lt;id&gt;</code> - Accept Duel</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">duel_decline_&lt;id&gt;</code> - Decline Duel</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">create_ticket</code> - Ticket</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">verify</code> - Verify</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">role_toggle_&lt;id&gt;</code> - Toggle Role</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">event_rsvp_&lt;id&gt;</code> - Event RSVP</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">giveaway_join_&lt;id&gt;</code> - Giveaway</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">shop_buy_&lt;id&gt;</code> - Shop Buy</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">casino_coinflip_&lt;id&gt;</code> - Coinflip</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">feedback_submit</code> - Feedback</div>
                  <div><code className="bg-white dark:bg-gray-800 px-1 rounded">votekick_vote_&lt;id&gt;</code> - Vote Kick</div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-2 text-xs">
                  💡 Click "📖 Button ID Reference" when adding a button for the complete list!
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Builder Dialog */}
        <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
          <DialogTrigger asChild>
            <div className="flex gap-2 mb-6">
              <Button size="lg" onClick={() => { setBuilderMode('embed'); startNew(); }}>
                ➕ Create Embed
              </Button>
              <Button size="lg" variant="outline" onClick={() => { setBuilderMode('capsule'); startNew(); }}>
                📦 Create Capsule
              </Button>
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEmbed 
                  ? (editingEmbed.is_capsule ? '✏️ Edit Capsule' : '✏️ Edit Embed')
                  : (builderMode === 'capsule' ? '📦 Create New Capsule' : '➕ Create New Embed')
                }
              </DialogTitle>
              <DialogDescription>
                {builderMode === 'capsule' 
                  ? 'Create advanced capsules with multiple embeds, buttons, and select menus'
                  : 'Use the visual builder to customize your embed'
                }
              </DialogDescription>
            </DialogHeader>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={builderMode === 'embed' ? 'default' : 'outline'}
                onClick={() => setBuilderMode('embed')}
                size="sm"
              >
                📝 Embed
              </Button>
              <Button
                variant={builderMode === 'capsule' ? 'default' : 'outline'}
                onClick={() => setBuilderMode('capsule')}
                size="sm"
              >
                📦 Capsule
              </Button>
            </div>

            {/* Conditional: Embed Builder or Capsule Builder */}
            {builderMode === 'capsule' ? (
              <CapsuleBuilderContent
                capsule={capsule}
                setCapsule={setCapsule}
                guildId={guildId}
                uploading={uploading}
                handleImageUpload={handleImageUpload}
                saveEmbed={saveEmbed}
                setShowBuilder={setShowBuilder}
                editingEmbed={editingEmbed}
              />
            ) : (
            <div className="grid md:grid-cols-2 gap-6 pt-4">
              {/* LEFT: Builder */}
              <div className="space-y-6">
                <h3 className="font-bold text-lg">⚙️ Builder</h3>

                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <Label>Embed Name (internal) *</Label>
                    <Input
                      value={embed.name}
                      onChange={(e) => setEmbed({ ...embed, name: e.target.value })}
                      placeholder="Server Rules"
                    />
                  </div>

                  <div>
                    <Label>Template Type</Label>
                    <Select value={embed.template_type} onValueChange={(v) => setEmbed({ ...embed, template_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom</SelectItem>
                        <SelectItem value="rules">Rules</SelectItem>
                        <SelectItem value="announcement">Announcement</SelectItem>
                        <SelectItem value="welcome">Welcome</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Embed Content */}
                <div className="space-y-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={embed.title}
                      onChange={(e) => setEmbed({ ...embed, title: e.target.value })}
                      placeholder="📜 Server Rules"
                    />
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={embed.description}
                      onChange={(e) => setEmbed({ ...embed, description: e.target.value })}
                      placeholder="Welcome to our community..."
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={embed.color}
                          onChange={(e) => setEmbed({ ...embed, color: e.target.value })}
                          className="w-20"
                        />
                        <Input
                          value={embed.color}
                          onChange={(e) => setEmbed({ ...embed, color: e.target.value })}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Title URL (optional)</Label>
                      <Input
                        value={embed.url}
                        onChange={(e) => setEmbed({ ...embed, url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>

                {/* Images */}
                <div className="space-y-4">
                  <h4 className="font-semibold">🖼️ Images</h4>
                  
                  <div>
                    <Label>Thumbnail (small, top right)</Label>
                    {embed.thumbnail_url ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <img src={embed.thumbnail_url} alt="Thumbnail" className="w-full h-32 object-cover rounded border" />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2"
                            onClick={() => setEmbed({ ...embed, thumbnail_url: '' })}
                          >
                            🗑️
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 break-all">{embed.thumbnail_url}</p>
                      </div>
                    ) : (
                      <Button onClick={() => handleImageUpload('thumbnail')} variant="outline" disabled={uploading} className="w-full">
                        {uploading ? '⏳ Uploading...' : '📤 Upload Thumbnail'}
                      </Button>
                    )}
                  </div>

                  <div>
                    <Label>Image (large, below embed)</Label>
                    {embed.image_url ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <img src={embed.image_url} alt="Main image" className="w-full h-48 object-cover rounded border" />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2"
                            onClick={() => setEmbed({ ...embed, image_url: '' })}
                          >
                            🗑️
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 break-all">{embed.image_url}</p>
                      </div>
                    ) : (
                      <Button onClick={() => handleImageUpload('image')} variant="outline" disabled={uploading} className="w-full">
                        {uploading ? '⏳ Uploading...' : '📤 Upload Main Image'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Author */}
                <div className="space-y-4">
                  <h4 className="font-semibold">👤 Author (optional)</h4>
                  
                  <div>
                    <Label>Author Name</Label>
                    <Input
                      value={embed.author_name}
                      onChange={(e) => setEmbed({ ...embed, author_name: e.target.value })}
                      placeholder="Bot Name"
                    />
                  </div>

                  <div>
                    <Label>Author Icon</Label>
                    {embed.author_icon_url ? (
                      <div className="space-y-2">
                        <div className="relative inline-block">
                          <img src={embed.author_icon_url} alt="Author icon" className="w-16 h-16 object-cover rounded-full border" />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute -top-2 -right-2"
                            onClick={() => setEmbed({ ...embed, author_icon_url: '' })}
                          >
                            🗑️
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 break-all">{embed.author_icon_url}</p>
                      </div>
                    ) : (
                      <Button onClick={() => handleImageUpload('author_icon')} variant="outline" disabled={uploading} size="sm">
                        {uploading ? '⏳' : '📤 Upload Icon'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="space-y-4">
                  <h4 className="font-semibold">🔖 Footer (optional)</h4>
                  
                  <div>
                    <Label>Footer Text</Label>
                    <Input
                      value={embed.footer_text}
                      onChange={(e) => setEmbed({ ...embed, footer_text: e.target.value })}
                      placeholder="ComCraft Bot"
                    />
                  </div>

                  <div>
                    <Label>Footer Icon</Label>
                    {embed.footer_icon_url ? (
                      <div className="space-y-2">
                        <div className="relative inline-block">
                          <img src={embed.footer_icon_url} alt="Footer icon" className="w-12 h-12 object-cover rounded-full border" />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute -top-2 -right-2"
                            onClick={() => setEmbed({ ...embed, footer_icon_url: '' })}
                          >
                            🗑️
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 break-all">{embed.footer_icon_url}</p>
                      </div>
                    ) : (
                      <Button onClick={() => handleImageUpload('footer_icon')} variant="outline" disabled={uploading} size="sm">
                        {uploading ? '⏳' : '📤 Upload Icon'}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="timestamp"
                      checked={embed.show_timestamp}
                      onChange={(e) => setEmbed({ ...embed, show_timestamp: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="timestamp" className="cursor-pointer">Show timestamp</Label>
                  </div>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">📋 Fields ({embed.fields.length})</h4>
                    <Dialog open={showAddField} onOpenChange={setShowAddField}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">+ Add Field</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>New Field</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div>
                            <Label>Field Name *</Label>
                            <Input
                              value={newField.name}
                              onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                              placeholder="Rule 1"
                            />
                          </div>
                          <div>
                            <Label>Field Value *</Label>
                            <Textarea
                              value={newField.value}
                              onChange={(e) => setNewField({ ...newField, value: e.target.value })}
                              placeholder="Be respectful..."
                              rows={3}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="inline"
                              checked={newField.inline}
                              onChange={(e) => setNewField({ ...newField, inline: e.target.checked })}
                              className="rounded"
                            />
                            <Label htmlFor="inline" className="cursor-pointer">Inline (side by side)</Label>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={addField} className="flex-1">✅ Add</Button>
                            <Button variant="outline" onClick={() => setShowAddField(false)}>Cancel</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {embed.fields.length === 0 ? (
                    <p className="text-sm text-gray-500">No fields added</p>
                  ) : (
                    <div className="space-y-2">
                      {embed.fields.map((field: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                          <div>
                            <div className="font-semibold">{field.name}</div>
                            <div className="text-sm text-gray-600">{field.value.substring(0, 50)}...</div>
                            {field.inline && <Badge variant="outline" className="text-xs mt-1">Inline</Badge>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removeField(index)}>🗑️</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Buttons/Components */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">🔘 Buttons ({embed.components.reduce((acc, row) => acc + row.components.length, 0)})</h4>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">📖 Button ID Reference</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>📖 Button ID Reference</DialogTitle>
                            <DialogDescription>
                              All available button Custom IDs for bot interactions
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div>
                              <h5 className="font-semibold mb-2">⚔️ Duels</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">duel_challenge</code>
                                  <span className="text-gray-600">- Open duel challenge modal</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">duel_accept_&lt;duelId&gt;</code>
                                  <span className="text-gray-600">- Accept duel challenge</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">duel_decline_&lt;duelId&gt;</code>
                                  <span className="text-gray-600">- Decline duel challenge</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-2">🎫 Tickets</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">create_ticket</code>
                                  <span className="text-gray-600">- Open ticket creation modal</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-2">✅ Verification</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">verify</code>
                                  <span className="text-gray-600">- Remove unverified role</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">quick_verify</code>
                                  <span className="text-gray-600">- Quick verification</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-2">👤 Role Management</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">role_toggle_&lt;roleId&gt;</code>
                                  <span className="text-gray-600">- Toggle role (add/remove)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">role_add_&lt;roleId&gt;</code>
                                  <span className="text-gray-600">- Add role</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">role_remove_&lt;roleId&gt;</code>
                                  <span className="text-gray-600">- Remove role</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">💡 Replace &lt;roleId&gt; with the Discord role ID</p>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-2">📅 Events</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">event_rsvp_&lt;eventId&gt;</code>
                                  <span className="text-gray-600">- RSVP for event</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-2">🎁 Giveaways</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">giveaway_join_&lt;giveawayId&gt;</code>
                                  <span className="text-gray-600">- Join giveaway</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-2">💰 Economy</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">shop_buy_&lt;itemId&gt;</code>
                                  <span className="text-gray-600">- Buy item from shop</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">shop_select_&lt;categoryId&gt;</code>
                                  <span className="text-gray-600">- Select shop category (select menu)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">equip_select_&lt;itemId&gt;</code>
                                  <span className="text-gray-600">- Equip item (select menu)</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-2">🎰 Casino</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_coinflip_&lt;userId&gt;</code>
                                  <span className="text-gray-600">- Open coinflip game</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_coinflip_bet_10_&lt;userId&gt;</code>
                                  <span className="text-gray-600">- Bet 10 coins on coinflip</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_coinflip_bet_50_&lt;userId&gt;</code>
                                  <span className="text-gray-600">- Bet 50 coins on coinflip</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_coinflip_bet_100_&lt;userId&gt;</code>
                                  <span className="text-gray-600">- Bet 100 coins on coinflip</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_coinflip_bet_custom_&lt;userId&gt;</code>
                                  <span className="text-gray-600">- Custom bet amount (opens modal)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_coinflip_play_&lt;amount&gt;_heads_&lt;userId&gt;</code>
                                  <span className="text-gray-600">- Play coinflip (heads)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_coinflip_play_&lt;amount&gt;_tails_&lt;userId&gt;</code>
                                  <span className="text-gray-600">- Play coinflip (tails)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_dice_&lt;gameId&gt;</code>
                                  <span className="text-gray-600">- Play dice game</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_slots_&lt;gameId&gt;</code>
                                  <span className="text-gray-600">- Play slots game</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_blackjack_&lt;gameId&gt;</code>
                                  <span className="text-gray-600">- Open blackjack game</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_blackjack_hit_&lt;gameId&gt;</code>
                                  <span className="text-gray-600">- Hit in blackjack</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_blackjack_stand_&lt;gameId&gt;</code>
                                  <span className="text-gray-600">- Stand in blackjack</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_stats_&lt;userId&gt;</code>
                                  <span className="text-gray-600">- View casino stats</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_leaderboard_&lt;guildId&gt;</code>
                                  <span className="text-gray-600">- View casino leaderboard</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">casino_bet_coinflip</code>
                                  <span className="text-gray-600">- Open coinflip bet menu</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">💡 Casino buttons require Premium license</p>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-2">💬 Feedback</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">feedback_submit</code>
                                  <span className="text-gray-600">- Open feedback submission modal</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">feedback_mark_complete_&lt;submissionId&gt;</code>
                                  <span className="text-gray-600">- Mark feedback as complete (admin)</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-semibold mb-2">🗳️ Moderation</h5>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">votekick_vote_&lt;targetId&gt;</code>
                                  <span className="text-gray-600">- Vote to kick user</span>
                                </div>
                              </div>
                            </div>
                            <div className="pt-4 border-t">
                              <h5 className="font-semibold mb-2">💡 Tips</h5>
                              <ul className="text-sm space-y-1 text-gray-600">
                                <li>• Use underscores instead of spaces</li>
                                <li>• For role/event/giveaway buttons: add ID at the end</li>
                                <li>• Get Role ID by: Right-click role → Copy ID (Developer Mode enabled)</li>
                                <li>• Always test your buttons in a test channel first</li>
                                <li>• Some buttons require Premium license (casino, feedback, etc.)</li>
                                <li>• Replace placeholders like &lt;userId&gt;, &lt;roleId&gt;, &lt;eventId&gt; with actual IDs</li>
                              </ul>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      {embed.components.length < 5 && (
                        <Button size="sm" variant="outline" onClick={addButtonRow}>
                          + Add Row
                        </Button>
                      )}
                    </div>
                  </div>

                  {embed.components.length === 0 ? (
                    <p className="text-sm text-gray-500">No buttons added. Max 5 rows, 5 buttons per row.</p>
                  ) : (
                    <div className="space-y-3">
                      {embed.components.map((row: any, rowIndex: number) => (
                        <div key={rowIndex} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold">Row {rowIndex + 1} ({row.components.length}/5 buttons)</span>
                            <Button size="sm" variant="ghost" onClick={() => removeButtonRow(rowIndex)}>🗑️</Button>
                          </div>
                          <div className="space-y-2">
                            {row.components.map((button: any, buttonIndex: number) => (
                              <div key={buttonIndex} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded">
                                <div className="flex items-center gap-2">
                                  {button.emoji && <span>{button.emoji.name || button.emoji}</span>}
                                  <span className="font-medium">{button.label || 'Unnamed'}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {button.style === 1 ? 'Primary' : 
                                     button.style === 2 ? 'Secondary' : 
                                     button.style === 3 ? 'Success' : 
                                     button.style === 4 ? 'Danger' : 'Link'}
                                  </Badge>
                                  {button.url && <span className="text-xs text-gray-500">🔗 {button.url.substring(0, 30)}...</span>}
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => removeButton(rowIndex, buttonIndex)}>🗑️</Button>
                              </div>
                            ))}
                            {row.components.length < 5 && (
                              <Dialog open={showAddButton && editingButtonRow === rowIndex} onOpenChange={(open) => {
                                setShowAddButton(open);
                                if (!open) setEditingButtonRow(null);
                              }}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="w-full" onClick={() => {
                                    setEditingButtonRow(rowIndex);
                                    setShowAddButton(true);
                                  }}>
                                    + Add Button
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>New Button</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <div>
                                      <Label>Button Style *</Label>
                                      <Select value={newButton.style} onValueChange={(v) => setNewButton({ ...newButton, style: v })}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="1">Primary (Blue)</SelectItem>
                                          <SelectItem value="2">Secondary (Gray)</SelectItem>
                                          <SelectItem value="3">Success (Green)</SelectItem>
                                          <SelectItem value="4">Danger (Red)</SelectItem>
                                          <SelectItem value="5">Link (URL)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label>Label *</Label>
                                      <Input
                                        value={newButton.label}
                                        onChange={(e) => setNewButton({ ...newButton, label: e.target.value })}
                                        placeholder="Click Me"
                                        maxLength={80}
                                      />
                                    </div>
                                    {newButton.style === '5' ? (
                                      <div>
                                        <Label>URL *</Label>
                                        <Input
                                          value={newButton.url}
                                          onChange={(e) => setNewButton({ ...newButton, url: e.target.value })}
                                          placeholder="https://..."
                                        />
                                      </div>
                                    ) : (
                                      <div>
                                        <Label>Custom ID *</Label>
                                        <div className="space-y-2">
                                          <Select 
                                            value={newButton.custom_id && buttonPresets[newButton.custom_id] ? newButton.custom_id : 'custom'} 
                                            onValueChange={(value) => {
                                              if (value && value !== 'custom') {
                                                const preset = buttonPresets[value];
                                                if (preset) {
                                                  setNewButton({
                                                    ...newButton,
                                                    custom_id: value,
                                                    label: preset.label || newButton.label,
                                                    emoji: preset.emoji || newButton.emoji,
                                                    style: preset.style || newButton.style
                                                  });
                                                }
                                              }
                                            }}
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select preset or type custom..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="custom">📝 Custom ID (type manually)</SelectItem>
                                              <SelectItem value="divider" disabled>━━━ Quick Actions ━━━</SelectItem>
                                              <SelectItem value="duel_challenge">⚔️ Duel Challenge</SelectItem>
                                              <SelectItem value="create_ticket">🎫 Create Ticket</SelectItem>
                                              <SelectItem value="verify">✅ Verify</SelectItem>
                                              <SelectItem value="quick_verify">✅ Quick Verify</SelectItem>
                                              <SelectItem value="divider2" disabled>━━━ Role Management ━━━</SelectItem>
                                              <SelectItem value="role_toggle_">👤 Toggle Role (add role ID)</SelectItem>
                                              <SelectItem value="role_add_">➕ Add Role (add role ID)</SelectItem>
                                              <SelectItem value="role_remove_">➖ Remove Role (add role ID)</SelectItem>
                                              <SelectItem value="divider3" disabled>━━━ Events & Activities ━━━</SelectItem>
                                              <SelectItem value="event_rsvp_">📅 Event RSVP (add event ID)</SelectItem>
                                              <SelectItem value="giveaway_join_">🎁 Join Giveaway (add giveaway ID)</SelectItem>
                                              <SelectItem value="divider4" disabled>━━━ Economy ━━━</SelectItem>
                                              <SelectItem value="shop_buy_">🛒 Buy Item (add item ID)</SelectItem>
                                              <SelectItem value="divider5" disabled>━━━ Feedback ━━━</SelectItem>
                                              <SelectItem value="feedback_submit">💬 Submit Feedback</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <Input
                                            value={newButton.custom_id}
                                            onChange={(e) => setNewButton({ ...newButton, custom_id: e.target.value })}
                                            placeholder="duel_challenge, create_ticket, role_toggle_123456..."
                                            maxLength={100}
                                          />
                                          <div className="text-xs text-gray-500 space-y-1">
                                            <p>💡 <strong>Tip:</strong> Select a preset above or type a custom ID</p>
                                            <p>📋 <strong>Format:</strong> Use underscores, e.g. <code>duel_challenge</code></p>
                                            <p>🔗 <strong>With ID:</strong> Add ID at end, e.g. <code>role_toggle_123456789</code></p>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    <div>
                                      <Label>Emoji (optional)</Label>
                                      <Input
                                        value={newButton.emoji}
                                        onChange={(e) => setNewButton({ ...newButton, emoji: e.target.value })}
                                        placeholder="✅"
                                        maxLength={2}
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        id="disabled"
                                        checked={newButton.disabled}
                                        onChange={(e) => setNewButton({ ...newButton, disabled: e.target.checked })}
                                        className="rounded"
                                      />
                                      <Label htmlFor="disabled" className="cursor-pointer">Disabled</Label>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button onClick={() => addButton(rowIndex)} className="flex-1">✅ Add</Button>
                                      <Button variant="outline" onClick={() => {
                                        setShowAddButton(false);
                                        setEditingButtonRow(null);
                                      }}>Cancel</Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <div className="flex gap-2">
                  <Button onClick={saveEmbed} className="flex-1" size="lg">
                    {editingEmbed ? '💾 Save' : '💾 Save as New'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowBuilder(false)}>
                    Cancel
                  </Button>
                </div>
              </div>

              {/* RIGHT: Preview */}
              <div className="space-y-6">
                <h3 className="font-bold text-lg">👀 Live Preview</h3>
                
                <div className="p-4 bg-gray-900 rounded-lg">
                  <div 
                    className="p-4 rounded border-l-4 relative" 
                    style={{ 
                      borderColor: embed.color,
                      backgroundColor: '#2f3136'
                    }}
                  >
                    {/* Thumbnail - EERST! (rechtsboven) */}
                    {embed.thumbnail_url && (
                      <div className="absolute top-4 right-4">
                        <img src={embed.thumbnail_url} alt="" className="w-20 h-20 object-cover rounded" />
                      </div>
                    )}

                    {/* Author */}
                    {embed.author_name && (
                      <div className="flex items-center gap-2 mb-2">
                        {embed.author_icon_url && (
                          <img src={embed.author_icon_url} alt="" className="w-6 h-6 rounded-full" />
                        )}
                        <span className="text-sm font-semibold text-white">{embed.author_name}</span>
                      </div>
                    )}

                    {/* Title */}
                    {embed.title && (
                      <div className="font-bold text-lg mb-2 text-white" style={{ marginRight: embed.thumbnail_url ? '90px' : '0' }}>
                        {embed.title}
                      </div>
                    )}

                    {/* Description */}
                    {embed.description && (
                      <div className="text-sm text-gray-300 mb-3 whitespace-pre-wrap" style={{ marginRight: embed.thumbnail_url ? '90px' : '0' }}>
                        {embed.description}
                      </div>
                    )}

                    {/* Fields */}
                    {embed.fields.length > 0 && (
                      <div className={`grid ${embed.fields.some((f: any) => f.inline) ? 'grid-cols-2' : 'grid-cols-1'} gap-2 mb-3`} style={{ marginRight: embed.thumbnail_url ? '90px' : '0', clear: embed.thumbnail_url ? 'none' : 'both' }}>
                        {embed.fields.map((field: any, i: number) => (
                          <div key={i} className={field.inline ? '' : 'col-span-full'}>
                            <div className="font-semibold text-sm text-white">{field.name}</div>
                            <div className="text-sm text-gray-300">{field.value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Large Image */}
                    {embed.image_url && (
                      <div className="mb-3 clear-both">
                        <img src={embed.image_url} alt="" className="max-w-full rounded" />
                      </div>
                    )}

                    {/* Footer */}
                    {(embed.footer_text || embed.show_timestamp) && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
                        {embed.footer_icon_url && (
                          <img src={embed.footer_icon_url} alt="" className="w-5 h-5 rounded-full" />
                        )}
                        <div className="text-xs text-gray-400">
                          {embed.footer_text}
                          {embed.footer_text && embed.show_timestamp && ' • '}
                          {embed.show_timestamp && new Date().toLocaleString('en-US')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Buttons Preview */}
                  {embed.components.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {embed.components.map((row: any, rowIndex: number) => (
                        <div key={rowIndex} className="flex gap-2 flex-wrap">
                          {row.components.map((button: any, buttonIndex: number) => {
                            const styleClasses = {
                              1: 'bg-blue-600 hover:bg-blue-700',
                              2: 'bg-gray-600 hover:bg-gray-700',
                              3: 'bg-green-600 hover:bg-green-700',
                              4: 'bg-red-600 hover:bg-red-700',
                              5: 'bg-blue-500 hover:bg-blue-600'
                            };
                            return (
                              <button
                                key={buttonIndex}
                                className={`px-4 py-2 rounded text-sm font-medium text-white ${styleClasses[button.style as keyof typeof styleClasses] || 'bg-gray-600'} ${button.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={button.disabled}
                              >
                                {button.emoji && <span className="mr-1">{button.emoji.name || button.emoji}</span>}
                                {button.label || 'Unnamed'}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Templates */}
                <div>
                  <h4 className="font-semibold mb-3">🎨 Templates (Click to load)</h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {templates.map((template: any) => (
                      <button
                        key={template.id}
                        onClick={() => loadTemplate(template)}
                        className="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                      >
                        <div className="font-semibold">{template.name}</div>
                        <div className="text-xs text-gray-600">{template.description}</div>
                        <Badge variant="outline" className="mt-1 text-xs">{template.category}</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Tabs */}
        <Tabs defaultValue="saved" className="space-y-6">
          <TabsList>
            <TabsTrigger value="saved">💾 Saved Embeds ({embeds.length})</TabsTrigger>
            <TabsTrigger value="scheduled">⏰ Scheduled ({schedules.filter((s:any) => s.status === 'pending').length})</TabsTrigger>
          </TabsList>

          {/* Saved Embeds */}
          <TabsContent value="saved" className="space-y-4">
            {embeds.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold mb-2">No embeds yet</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Create your first embed with the visual builder!
                </p>
              </Card>
            ) : (
              embeds.map((savedEmbed: any) => (
                <Card key={savedEmbed.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{savedEmbed.name}</h3>
                        <Badge>{savedEmbed.template_type}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {savedEmbed.title && `"${savedEmbed.title}"`}
                      </p>
                      <p className="text-sm text-gray-600">
                        Used {savedEmbed.times_used || 0} times
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setPostingEmbed(savedEmbed);
                          setShowPostDialog(true);
                        }}
                      >
                        📤 Post
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startEdit(savedEmbed)}>
                        ✏️ Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => deleteEmbed(savedEmbed.id)}>
                        🗑️
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Scheduled Embeds */}
          <TabsContent value="scheduled" className="space-y-4">
            {schedules.filter((s: any) => s.status === 'pending').length === 0 ? (
              <Card className="p-12 text-center">
                <div className="text-6xl mb-4">⏰</div>
                <h3 className="text-xl font-bold mb-2">No scheduled embeds</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Schedule embeds to automatically post them!
                </p>
              </Card>
            ) : (
              schedules
                .filter((s: any) => s.status === 'pending')
                .map((schedule: any) => (
                  <Card key={schedule.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold">{schedule.embed?.name}</h3>
                        <p className="text-sm text-gray-600">
                          {schedule.schedule_type === 'once' && `Once: ${new Date(schedule.next_send_at).toLocaleString('en-US')}`}
                          {schedule.schedule_type === 'daily' && `Daily at ${schedule.time_of_day}`}
                          {schedule.schedule_type === 'weekly' && `Weekly on day ${schedule.day_of_week}`}
                          {schedule.schedule_type === 'monthly' && `Monthly on the ${schedule.day_of_month}th`}
                        </p>
                        <p className="text-sm text-gray-600">
                          Channel: #{channels.find(c => c.id === schedule.channel_id)?.name}
                        </p>
                      </div>
                      <Badge>{schedule.schedule_type}</Badge>
                    </div>
                  </Card>
                ))
            )}
          </TabsContent>
        </Tabs>

        {/* Post Dialog */}
        <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>📤 Post Embed to Discord</DialogTitle>
              <DialogDescription>
                Embed: {postingEmbed?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Channel *</Label>
                <Select value={postChannel} onValueChange={setPostChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((ch: any) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        💬 {ch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Mention Role (optional)</Label>
                <Select value={mentionRole} onValueChange={setMentionRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="No mention" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No mention</SelectItem>
                    {roles.map((role: any) => (
                      <SelectItem key={role.id} value={role.id}>
                        @{role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pin"
                  checked={pinMessage}
                  onChange={(e) => setPinMessage(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="pin" className="cursor-pointer">Pin message</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={postEmbed} className="flex-1">📤 Post Now</Button>
                <Button variant="outline" onClick={() => setShowPostDialog(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

