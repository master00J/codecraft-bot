'use client';

/**
 * Capsule Builder Component
 * Advanced builder for creating capsules with multiple embeds, buttons, and select menus
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CapsuleBuilderProps {
  capsule: any;
  setCapsule: (capsule: any) => void;
  guildId: string;
  uploading: boolean;
  handleImageUpload: (type: 'thumbnail' | 'image' | 'footer_icon' | 'author_icon') => Promise<void>;
  saveEmbed: () => void;
  setShowBuilder: (show: boolean) => void;
  editingEmbed: any;
}

export default function CapsuleBuilderContent({
  capsule,
  setCapsule,
  guildId,
  uploading,
  handleImageUpload,
  saveEmbed,
  setShowBuilder,
  editingEmbed
}: CapsuleBuilderProps) {
  const [editingEmbedIndex, setEditingEmbedIndex] = useState<number | null>(null);
  const [showAddEmbed, setShowAddEmbed] = useState(false);
  const [showAddButton, setShowAddButton] = useState(false);
  const [showAddSelectMenu, setShowAddSelectMenu] = useState(false);
  const [newEmbed, setNewEmbed] = useState<any>({
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
    fields: []
  });
  const [newButton, setNewButton] = useState<any>({
    customId: '',
    label: '',
    style: 1, // Primary
    emoji: '',
    url: '',
    disabled: false
  });
  const [newSelectMenu, setNewSelectMenu] = useState<any>({
    customId: '',
    placeholder: 'Select an option...',
    options: [],
    minValues: 1,
    maxValues: 1
  });

  const addEmbed = () => {
    if (!newEmbed.title && !newEmbed.description) {
      alert('Embed must have at least a title or description!');
      return;
    }

    const embedData = {
      title: newEmbed.title,
      description: newEmbed.description,
      color: newEmbed.color,
      url: newEmbed.url,
      thumbnail: newEmbed.thumbnail_url ? { url: newEmbed.thumbnail_url } : null,
      image: newEmbed.image_url ? { url: newEmbed.image_url } : null,
      footer: newEmbed.footer_text ? {
        text: newEmbed.footer_text,
        icon_url: newEmbed.footer_icon_url
      } : null,
      author: newEmbed.author_name ? {
        name: newEmbed.author_name,
        icon_url: newEmbed.author_icon_url,
        url: newEmbed.author_url
      } : null,
      fields: newEmbed.fields || [],
      timestamp: newEmbed.show_timestamp ? new Date().toISOString() : null
    };

    setCapsule({
      ...capsule,
      embeds: [...capsule.embeds, embedData]
    });

    setNewEmbed({
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
      fields: []
    });
    setShowAddEmbed(false);
  };

  const removeEmbed = (index: number) => {
    setCapsule({
      ...capsule,
      embeds: capsule.embeds.filter((_: any, i: number) => i !== index)
    });
  };

  const addButton = () => {
    if (!newButton.customId || !newButton.label) {
      alert('Button custom ID and label are required!');
      return;
    }

    // Check if we need a new component row
    const lastRow = capsule.components[capsule.components.length - 1];
    const needsNewRow = !lastRow || 
      lastRow.type !== 1 || 
      (lastRow.components && lastRow.components.length >= 5) ||
      (lastRow.components && lastRow.components.some((c: any) => c.type === 3)); // Has select menu

    const buttonComponent = {
      type: 2, // Button
      style: newButton.style,
      label: newButton.label,
      custom_id: newButton.customId,
      ...(newButton.emoji && { emoji: { name: newButton.emoji } }),
      ...(newButton.url && { url: newButton.url }),
      disabled: newButton.disabled || false
    };

    if (needsNewRow) {
      setCapsule({
        ...capsule,
        components: [...capsule.components, {
          type: 1, // ActionRow
          components: [buttonComponent]
        }]
      });
    } else {
      const updatedComponents = [...capsule.components];
      updatedComponents[updatedComponents.length - 1].components.push(buttonComponent);
      setCapsule({
        ...capsule,
        components: updatedComponents
      });
    }

    setNewButton({
      customId: '',
      label: '',
      style: 1,
      emoji: '',
      url: '',
      disabled: false
    });
    setShowAddButton(false);
  };

  const addSelectMenu = () => {
    if (!newSelectMenu.customId || newSelectMenu.options.length === 0) {
      alert('Select menu custom ID and at least one option are required!');
      return;
    }

    const selectComponent = {
      type: 3, // Select Menu
      custom_id: newSelectMenu.customId,
      placeholder: newSelectMenu.placeholder,
      options: newSelectMenu.options,
      min_values: newSelectMenu.minValues,
      max_values: newSelectMenu.maxValues,
      disabled: false
    };

    // Select menus must be in their own row
    setCapsule({
      ...capsule,
      components: [...capsule.components, {
        type: 1, // ActionRow
        components: [selectComponent]
      }]
    });

    setNewSelectMenu({
      customId: '',
      placeholder: 'Select an option...',
      options: [],
      minValues: 1,
      maxValues: 1
    });
    setShowAddSelectMenu(false);
  };

  const removeComponent = (rowIndex: number) => {
    setCapsule({
      ...capsule,
      components: capsule.components.filter((_: any, i: number) => i !== rowIndex)
    });
  };

  const addSelectOption = () => {
    const label = prompt('Option label:');
    const value = prompt('Option value:');
    const description = prompt('Option description (optional):');

    if (label && value) {
      setNewSelectMenu({
        ...newSelectMenu,
        options: [...newSelectMenu.options, {
          label,
          value,
          description: description || undefined
        }]
      });
    }
  };

  const loadTemplate = (templateType: string) => {
    switch (templateType) {
      case 'announcement':
        setCapsule({
          ...capsule,
          capsule_type: 'announcement',
          content: '📢 Important Announcement!',
          embeds: [{
            title: '📢 New Update!',
            description: 'We have exciting news to share!',
            color: '#5865F2',
            timestamp: new Date().toISOString()
          }],
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 1,
              label: 'Learn More',
              custom_id: 'announcement_learn_more'
            }, {
              type: 2,
              style: 2,
              label: 'Dismiss',
              custom_id: 'announcement_dismiss'
            }]
          }]
        });
        break;
      case 'showcase':
        setCapsule({
          ...capsule,
          capsule_type: 'showcase',
          embeds: [
            {
              title: '✨ Premium Membership',
              description: 'Upgrade to premium for exclusive features!',
              color: '#00D26A',
              thumbnail: null
            },
            {
              title: '📋 Features',
              description: '✅ Feature 1\n✅ Feature 2\n✅ Feature 3',
              color: '#00D26A'
            },
            {
              title: '💰 Pricing',
              description: '**Price:** €9.99/month',
              color: '#FFD700'
            }
          ],
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 3,
              label: 'Buy Now',
              custom_id: 'showcase_buy',
              emoji: { name: '💳' }
            }, {
              type: 2,
              style: 2,
              label: 'Learn More',
              custom_id: 'showcase_info'
            }]
          }]
        });
        break;
      case 'leaderboard':
        setCapsule({
          ...capsule,
          capsule_type: 'leaderboard',
          embeds: [
            {
              title: '🏆 Top Players',
              color: '#FFD700',
              timestamp: new Date().toISOString()
            },
            {
              title: 'Rankings',
              description: '🥇 Player1 - 10,000 XP\n🥈 Player2 - 9,500 XP\n🥉 Player3 - 9,000 XP',
              color: '#FFD700'
            }
          ]
        });
        break;
    }
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <Label>Capsule Name (internal) *</Label>
          <Input
            value={capsule.name}
            onChange={(e) => setCapsule({ ...capsule, name: e.target.value })}
            placeholder="Server Announcement"
          />
        </div>

        <div>
          <Label>Capsule Type</Label>
          <Select 
            value={capsule.capsule_type} 
            onValueChange={(v) => {
              setCapsule({ ...capsule, capsule_type: v });
              if (v !== 'custom' && capsule.embeds.length === 0) {
                loadTemplate(v);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom</SelectItem>
              <SelectItem value="announcement">Announcement</SelectItem>
              <SelectItem value="showcase">Showcase</SelectItem>
              <SelectItem value="leaderboard">Leaderboard</SelectItem>
              <SelectItem value="form">Form</SelectItem>
            </SelectContent>
          </Select>
          {capsule.capsule_type !== 'custom' && (
            <p className="text-xs text-gray-500 mt-1">
              Template loaded! Customize as needed.
            </p>
          )}
        </div>

        <div>
          <Label>Message Content (optional - appears above embeds)</Label>
          <Textarea
            value={capsule.content}
            onChange={(e) => setCapsule({ ...capsule, content: e.target.value })}
            placeholder="📢 Important announcement!"
            rows={2}
          />
        </div>
      </div>

      {/* Embeds Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">📋 Embeds ({capsule.embeds.length}/10)</h4>
          {capsule.embeds.length < 10 && (
            <Button size="sm" variant="outline" onClick={() => setShowAddEmbed(true)}>
              + Add Embed
            </Button>
          )}
        </div>

        {capsule.embeds.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-gray-500">No embeds added yet. Add your first embed!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {capsule.embeds.map((embed: any, index: number) => (
              <Card key={index} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold">
                      {embed.title || `Embed ${index + 1}`}
                    </div>
                    <div className="text-sm text-gray-600">
                      {embed.description?.substring(0, 50)}...
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingEmbedIndex(index)}>
                      ✏️
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeEmbed(index)}>
                      🗑️
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Components Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">🎛️ Components ({capsule.components.length}/5)</h4>
          <div className="flex gap-2">
            {capsule.components.length < 5 && (
              <>
                <Button size="sm" variant="outline" onClick={() => setShowAddButton(true)}>
                  + Button
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddSelectMenu(true)}>
                  + Select Menu
                </Button>
              </>
            )}
          </div>
        </div>

        {capsule.components.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-gray-500">No components added. Add buttons or select menus!</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {capsule.components.map((row: any, rowIndex: number) => (
              <Card key={rowIndex} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 flex-wrap">
                    {row.components?.map((comp: any, compIndex: number) => (
                      <Badge key={compIndex} variant="outline">
                        {comp.type === 2 ? `🔘 ${comp.label}` : `📋 ${comp.placeholder}`}
                      </Badge>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeComponent(rowIndex)}>
                    🗑️
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <h4 className="font-semibold">👀 Preview</h4>
        <Card className="p-4 bg-gray-900">
          {capsule.content && (
            <div className="text-white mb-2">{capsule.content}</div>
          )}
          {capsule.embeds.length === 0 ? (
            <p className="text-gray-500 text-sm">No embeds to preview</p>
          ) : (
            <div className="space-y-2">
              {capsule.embeds.map((embed: any, index: number) => (
                <div
                  key={index}
                  className="p-3 rounded border-l-4"
                  style={{
                    borderColor: embed.color || '#5865F2',
                    backgroundColor: '#2f3136'
                  }}
                >
                  {embed.title && (
                    <div className="font-bold text-white mb-1">{embed.title}</div>
                  )}
                  {embed.description && (
                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                      {embed.description}
                    </div>
                  )}
                  {embed.fields && embed.fields.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {embed.fields.map((field: any, fIdx: number) => (
                        <div key={fIdx}>
                          <div className="font-semibold text-sm text-white">{field.name}</div>
                          <div className="text-sm text-gray-300">{field.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {capsule.components.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-400 mb-2">Components:</div>
              <div className="flex gap-2 flex-wrap">
                {capsule.components.map((row: any, rIdx: number) =>
                  row.components?.map((comp: any, cIdx: number) => (
                    <Badge key={`${rIdx}-${cIdx}`} variant="outline" className="text-xs">
                      {comp.type === 2 ? `🔘 ${comp.label}` : `📋 ${comp.placeholder}`}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          )}
        </Card>
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

      {/* Add Embed Dialog */}
      <Dialog open={showAddEmbed} onOpenChange={setShowAddEmbed}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Embed Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newEmbed.title}
                onChange={(e) => setNewEmbed({ ...newEmbed, title: e.target.value })}
                placeholder="Section Title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newEmbed.description}
                onChange={(e) => setNewEmbed({ ...newEmbed, description: e.target.value })}
                placeholder="Section description..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={newEmbed.color}
                    onChange={(e) => setNewEmbed({ ...newEmbed, color: e.target.value })}
                    className="w-20"
                  />
                  <Input
                    value={newEmbed.color}
                    onChange={(e) => setNewEmbed({ ...newEmbed, color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label>Image URL</Label>
                <Input
                  value={newEmbed.image_url}
                  onChange={(e) => setNewEmbed({ ...newEmbed, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addEmbed} className="flex-1">Add Embed</Button>
              <Button variant="outline" onClick={() => setShowAddEmbed(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Button Dialog */}
      <Dialog open={showAddButton} onOpenChange={setShowAddButton}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Button</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Custom ID *</Label>
              <Input
                value={newButton.customId}
                onChange={(e) => setNewButton({ ...newButton, customId: e.target.value })}
                placeholder="button_action_1"
              />
            </div>
            <div>
              <Label>Label *</Label>
              <Input
                value={newButton.label}
                onChange={(e) => setNewButton({ ...newButton, label: e.target.value })}
                placeholder="Click Me!"
              />
            </div>
            <div>
              <Label>Style</Label>
              <Select 
                value={newButton.style.toString()} 
                onValueChange={(v) => setNewButton({ ...newButton, style: parseInt(v) })}
              >
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
            {newButton.style === 5 && (
              <div>
                <Label>URL</Label>
                <Input
                  value={newButton.url}
                  onChange={(e) => setNewButton({ ...newButton, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={addButton} className="flex-1">Add Button</Button>
              <Button variant="outline" onClick={() => setShowAddButton(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Select Menu Dialog */}
      <Dialog open={showAddSelectMenu} onOpenChange={setShowAddSelectMenu}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Select Menu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Custom ID *</Label>
              <Input
                value={newSelectMenu.customId}
                onChange={(e) => setNewSelectMenu({ ...newSelectMenu, customId: e.target.value })}
                placeholder="select_option"
              />
            </div>
            <div>
              <Label>Placeholder</Label>
              <Input
                value={newSelectMenu.placeholder}
                onChange={(e) => setNewSelectMenu({ ...newSelectMenu, placeholder: e.target.value })}
                placeholder="Select an option..."
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Options ({newSelectMenu.options.length})</Label>
                <Button size="sm" variant="outline" onClick={addSelectOption}>
                  + Add Option
                </Button>
              </div>
              {newSelectMenu.options.length === 0 ? (
                <p className="text-sm text-gray-500">No options added yet</p>
              ) : (
                <div className="space-y-2">
                  {newSelectMenu.options.map((opt: any, idx: number) => (
                    <Card key={idx} className="p-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{opt.label}</div>
                          <div className="text-xs text-gray-500">{opt.value}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNewSelectMenu({
                              ...newSelectMenu,
                              options: newSelectMenu.options.filter((_: any, i: number) => i !== idx)
                            });
                          }}
                        >
                          🗑️
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={addSelectMenu} className="flex-1" disabled={newSelectMenu.options.length === 0}>
                Add Select Menu
              </Button>
              <Button variant="outline" onClick={() => setShowAddSelectMenu(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

