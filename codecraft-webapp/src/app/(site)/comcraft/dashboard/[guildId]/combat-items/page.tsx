'use client';

/**
 * Comcraft - Combat Item Builder
 * Create and manage custom items for PvP duels
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sword, Shield, Droplet, Plus, Trash2, Edit, AlertTriangle } from 'lucide-react';

interface CombatItem {
  id: string;
  guild_id: string;
  name: string;
  description: string | null;
  item_type: 'weapon' | 'armor' | 'consumable';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  price: number;
  damage_bonus: number;
  defense_bonus: number;
  hp_bonus: number;
  crit_bonus: number;
  level_requirement: number;
  max_stock: number | null;
  current_stock: number | null;
  is_available: boolean;
  icon_url: string | null;
  effect: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
}

const ITEM_TYPE_ICONS = {
  weapon: Sword,
  armor: Shield,
  consumable: Droplet,
};

const RARITY_COLORS = {
  common: 'bg-gray-500',
  uncommon: 'bg-green-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-orange-500',
};

export default function CombatItemsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [items, setItems] = useState<CombatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CombatItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'weapon' | 'armor' | 'consumable'>('all');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    item_type: 'weapon' as 'weapon' | 'armor' | 'consumable',
    rarity: 'common' as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary',
    price: 100,
    damage_bonus: 0,
    defense_bonus: 0,
    hp_bonus: 0,
    crit_bonus: 0,
    level_requirement: 1,
    max_stock: null as number | null,
    is_available: true,
    icon_url: '',
  });

  useEffect(() => {
    if (guildId) {
      fetchItems();
    }
  }, [guildId]);

  const fetchItems = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/combat-items`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Error fetching combat items:', error);
      toast({
        title: 'Failed to load items',
        description: 'Could not load combat items. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      item_type: 'weapon',
      rarity: 'common',
      price: 100,
      damage_bonus: 0,
      defense_bonus: 0,
      hp_bonus: 0,
      crit_bonus: 0,
      level_requirement: 1,
      max_stock: null,
      is_available: true,
      icon_url: '',
    });
    setEditingItem(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: CombatItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      item_type: item.item_type,
      rarity: item.rarity,
      price: item.price,
      damage_bonus: item.damage_bonus,
      defense_bonus: item.defense_bonus,
      hp_bonus: item.hp_bonus,
      crit_bonus: item.crit_bonus,
      level_requirement: item.level_requirement,
      max_stock: item.max_stock,
      is_available: item.is_available,
      icon_url: item.icon_url || '',
    });
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const saveItem = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter an item name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = {
        ...formData,
        id: editingItem?.id,
        current_stock: formData.max_stock,
      };

      const response = await fetch(`/api/comcraft/guilds/${guildId}/combat-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: editingItem ? 'Item updated' : 'Item created',
          description: `${formData.name} has been ${editingItem ? 'updated' : 'created'} successfully.`,
        });
        setIsDialogOpen(false);
        resetForm();
        fetchItems();
      } else {
        const error = await response.json();
        toast({
          title: 'Save failed',
          description: error.error || 'Could not save item. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Save failed',
        description: 'Could not save item. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/combat-items?id=${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Item deleted',
          description: 'The item has been removed successfully.',
        });
        setDeleteConfirm(null);
        fetchItems();
      } else {
        toast({
          title: 'Delete failed',
          description: 'Could not delete item. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: 'Could not delete item. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const filteredItems = items.filter(
    (item) => filter === 'all' || item.item_type === filter
  );

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading combat items...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Combat Item Builder</h1>
          <p className="text-muted-foreground mt-2">
            Create custom weapons, armor, and consumables for PvP duels
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Item' : 'Create New Item'}
              </DialogTitle>
              <DialogDescription>
                {editingItem
                  ? 'Update the item details below.'
                  : 'Fill in the details to create a new combat item.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Dragon Sword, Iron Shield, Health Potion"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the item..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item_type">Item Type *</Label>
                  <Select
                    value={formData.item_type}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, item_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weapon">⚔️ Weapon</SelectItem>
                      <SelectItem value="armor">🛡️ Armor</SelectItem>
                      <SelectItem value="consumable">🧪 Consumable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rarity">Rarity *</Label>
                  <Select
                    value={formData.rarity}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, rarity: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="uncommon">Uncommon</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (coins) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level_requirement">Level Requirement</Label>
                  <Input
                    id="level_requirement"
                    type="number"
                    min="1"
                    value={formData.level_requirement}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        level_requirement: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Combat Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="damage_bonus">💥 Damage Bonus</Label>
                    <Input
                      id="damage_bonus"
                      type="number"
                      min="0"
                      value={formData.damage_bonus}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          damage_bonus: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defense_bonus">🛡️ Defense Bonus</Label>
                    <Input
                      id="defense_bonus"
                      type="number"
                      min="0"
                      value={formData.defense_bonus}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defense_bonus: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hp_bonus">❤️ HP Bonus</Label>
                    <Input
                      id="hp_bonus"
                      type="number"
                      min="0"
                      value={formData.hp_bonus}
                      onChange={(e) =>
                        setFormData({ ...formData, hp_bonus: parseInt(e.target.value) || 0 })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="crit_bonus">🎯 Crit Chance Bonus (%)</Label>
                    <Input
                      id="crit_bonus"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.crit_bonus}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          crit_bonus: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <Label htmlFor="max_stock">Max Stock (leave empty for unlimited)</Label>
                <Input
                  id="max_stock"
                  type="number"
                  min="1"
                  value={formData.max_stock || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_stock: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="Unlimited"
                />
              </div>

              {/* Icon URL (optional) */}
              <div className="space-y-2">
                <Label htmlFor="icon_url">Icon URL (optional)</Label>
                <Input
                  id="icon_url"
                  value={formData.icon_url}
                  onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              {/* Available Toggle */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="is_available"
                  checked={formData.is_available}
                  onChange={(e) =>
                    setFormData({ ...formData, is_available: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="is_available" className="cursor-pointer">
                  ✅ Item is available for purchase in shop
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={saveItem}>
                {editingItem ? 'Update Item' : 'Create Item'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sword className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <Sword className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Weapons</p>
              <p className="text-2xl font-bold">
                {items.filter((i) => i.item_type === 'weapon').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Armor</p>
              <p className="text-2xl font-bold">
                {items.filter((i) => i.item_type === 'armor').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Droplet className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Consumables</p>
              <p className="text-2xl font-bold">
                {items.filter((i) => i.item_type === 'consumable').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
        <TabsList>
          <TabsTrigger value="all">All Items ({items.length})</TabsTrigger>
          <TabsTrigger value="weapon">
            Weapons ({items.filter((i) => i.item_type === 'weapon').length})
          </TabsTrigger>
          <TabsTrigger value="armor">
            Armor ({items.filter((i) => i.item_type === 'armor').length})
          </TabsTrigger>
          <TabsTrigger value="consumable">
            Consumables ({items.filter((i) => i.item_type === 'consumable').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {filteredItems.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No items yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first combat item to get started!
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Item
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const Icon = ITEM_TYPE_ICONS[item.item_type];
                return (
                  <Card key={item.id} className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{item.name}</h3>
                          <div className="flex gap-2 mt-1">
                            <Badge
                              className={`text-white ${RARITY_COLORS[item.rarity]}`}
                            >
                              {item.rarity}
                            </Badge>
                            <Badge
                              className={`text-white ${
                                item.is_available ? 'bg-green-600' : 'bg-gray-500'
                              }`}
                            >
                              {item.is_available ? '✅ Available' : '❌ Unavailable'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {item.description}
                      </p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Price:</span>
                        <span className="font-semibold">{item.price} 💰</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Level Required:</span>
                        <span className="font-semibold">{item.level_requirement}</span>
                      </div>
                      {item.damage_bonus > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Damage:</span>
                          <span className="font-semibold text-red-500">
                            +{item.damage_bonus} 💥
                          </span>
                        </div>
                      )}
                      {item.defense_bonus > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Defense:</span>
                          <span className="font-semibold text-blue-500">
                            +{item.defense_bonus} 🛡️
                          </span>
                        </div>
                      )}
                      {item.hp_bonus > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">HP:</span>
                          <span className="font-semibold text-green-500">
                            +{item.hp_bonus} ❤️
                          </span>
                        </div>
                      )}
                      {item.crit_bonus > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Crit:</span>
                          <span className="font-semibold text-yellow-500">
                            +{item.crit_bonus}% 🎯
                          </span>
                        </div>
                      )}
                      {item.max_stock && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Stock:</span>
                          <span className="font-semibold">
                            {item.current_stock}/{item.max_stock}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the item and
              remove it from all player inventories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteItem(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

