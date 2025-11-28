'use client';

/**
 * Admin Updates Management Page
 * Allows admins to easily add, edit, and manage bot updates
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';
import { Loader2, Plus, Edit, Trash2, Save, Calendar, Sparkles, X } from 'lucide-react';

interface UpdateItem {
  id?: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  order_index: number;
}

interface Update {
  id: string;
  version: string;
  title: string;
  release_date: string;
  description: string;
  type: string;
  is_major: boolean;
  is_published: boolean;
  featured_image_url?: string;
  items: UpdateItem[];
}

export default function AdminUpdatesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<Update | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    version: '',
    title: '',
    release_date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'feature',
    is_major: false,
    is_published: true,
    featured_image_url: ''
  });

  const [formItems, setFormItems] = useState<UpdateItem[]>([]);

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/updates');
      const data = await response.json();
      if (data.success) {
        setUpdates(data.updates || []);
      }
    } catch (error) {
      console.error('Error fetching updates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load updates.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      version: '',
      title: '',
      release_date: new Date().toISOString().split('T')[0],
      description: '',
      type: 'feature',
      is_major: false,
      is_published: true,
      featured_image_url: ''
    });
    setFormItems([]);
    setEditingUpdate(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (update: Update) => {
    setEditingUpdate(update);
    setFormData({
      version: update.version,
      title: update.title,
      release_date: update.release_date,
      description: update.description || '',
      type: update.type,
      is_major: update.is_major,
      is_published: update.is_published,
      featured_image_url: update.featured_image_url || ''
    });
    setFormItems(update.items.map(item => ({ ...item })));
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.version || !formData.title) {
      toast({
        title: 'Validation Error',
        description: 'Version and title are required.',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const url = editingUpdate
        ? `/api/admin/updates/${editingUpdate.id}`
        : '/api/admin/updates';

      const method = editingUpdate ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: formItems
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: editingUpdate ? 'Update updated successfully!' : 'Update created successfully!'
        });
        setShowDialog(false);
        resetForm();
        fetchUpdates();
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error: any) {
      console.error('Error saving update:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save update.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this update?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/updates/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Update deleted successfully!'
        });
        fetchUpdates();
      } else {
        throw new Error(result.error || 'Failed to delete');
      }
    } catch (error: any) {
      console.error('Error deleting update:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete update.',
        variant: 'destructive'
      });
    }
  };

  const addItem = () => {
    setFormItems([
      ...formItems,
      {
        title: '',
        description: '',
        category: 'feature',
        icon: '✨',
        order_index: formItems.length
      }
    ]);
  };

  const removeItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof UpdateItem, value: any) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormItems(newItems);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'feature':
        return 'bg-blue-500/10 text-blue-600';
      case 'improvement':
        return 'bg-purple-500/10 text-purple-600';
      case 'bugfix':
        return 'bg-green-500/10 text-green-600';
      case 'security':
        return 'bg-red-500/10 text-red-600';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Header */}
        <Card className="border-2 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-background shadow-lg">
                    📝
                  </div>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-2">
                    Updates Management
                  </h1>
                  <p className="text-muted-foreground max-w-xl">
                    Manage bot updates and changelog entries. Add new features, improvements, and fixes.
                  </p>
                </div>
              </div>

              <Button onClick={openCreateDialog} className="bg-gradient-to-r from-primary to-purple-600">
                <Plus className="mr-2 h-4 w-4" />
                New Update
              </Button>
            </div>
          </div>
        </Card>

        {/* Updates List */}
        <div className="space-y-4">
          {updates.map((update) => (
            <Card key={update.id} className="border-2 shadow-lg">
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={`${getTypeColor(update.type)} capitalize`}>
                        {update.type}
                      </Badge>
                      <Badge variant="outline" className="font-mono">
                        v{update.version}
                      </Badge>
                      {update.is_major && (
                        <Badge className="bg-gradient-to-r from-primary to-purple-600 text-white">
                          Major
                        </Badge>
                      )}
                      {!update.is_published && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Draft
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold mb-2">{update.title}</h2>
                    {update.description && (
                      <p className="text-muted-foreground mb-3">{update.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(update.release_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        {update.items.length} {update.items.length === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => openEditDialog(update)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(update.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {updates.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground text-lg">No updates yet. Create your first update!</p>
            </Card>
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUpdate ? 'Edit Update' : 'Create New Update'}
              </DialogTitle>
              <DialogDescription>
                Add a new update or changelog entry for the bot
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="version">Version *</Label>
                  <Input
                    id="version"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="2.1.0"
                  />
                </div>
                <div>
                  <Label htmlFor="release_date">Release Date *</Label>
                  <Input
                    id="release_date"
                    type="date"
                    value={formData.release_date}
                    onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Welcome System Overhaul"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this update..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="improvement">Improvement</SelectItem>
                      <SelectItem value="bugfix">Bug Fix</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="breaking">Breaking Change</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="featured_image_url">Featured Image URL</Label>
                  <Input
                    id="featured_image_url"
                    value={formData.featured_image_url}
                    onChange={(e) => setFormData({ ...formData, featured_image_url: e.target.value })}
                    placeholder="https://example.com/image.png"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Label htmlFor="is_major">Major Update</Label>
                  <Switch
                    id="is_major"
                    checked={formData.is_major}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_major: checked })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="is_published">Published</Label>
                  <Switch
                    id="is_published"
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                  />
                </div>
              </div>

              <Separator />

              {/* Update Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-lg font-semibold">Update Items</Label>
                  <Button onClick={addItem} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-4">
                  {formItems.map((item, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex gap-3">
                            <div className="w-20">
                              <Label>Icon</Label>
                              <Input
                                value={item.icon}
                                onChange={(e) => updateItem(index, 'icon', e.target.value)}
                                placeholder="✨"
                                maxLength={2}
                              />
                            </div>
                            <div className="flex-1">
                              <Label>Title *</Label>
                              <Input
                                value={item.title}
                                onChange={(e) => updateItem(index, 'title', e.target.value)}
                                placeholder="Feature name"
                              />
                            </div>
                            <div className="w-32">
                              <Label>Category</Label>
                              <Select
                                value={item.category}
                                onValueChange={(value) => updateItem(index, 'category', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="feature">Feature</SelectItem>
                                  <SelectItem value="improvement">Improvement</SelectItem>
                                  <SelectItem value="bugfix">Bug Fix</SelectItem>
                                  <SelectItem value="security">Security</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label>Description</Label>
                            <Textarea
                              value={item.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              placeholder="Detailed description..."
                              rows={2}
                            />
                          </div>
                        </div>
                        <Button
                          onClick={() => removeItem(index)}
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}

                  {formItems.length === 0 && (
                    <Card className="p-8 text-center border-dashed">
                      <p className="text-muted-foreground">No items yet. Click "Add Item" to add features.</p>
                    </Card>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-purple-600">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {editingUpdate ? 'Update' : 'Create'}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

