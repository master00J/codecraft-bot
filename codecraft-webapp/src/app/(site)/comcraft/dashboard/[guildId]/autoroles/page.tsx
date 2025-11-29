'use client';

/**
 * ComCraft Auto-Roles Dashboard
 * Create and manage self-assignable role menus
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/navigation';
import dynamic from 'next/dynamic';
import emojiData from '@emoji-mart/data';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const EmojiPicker = dynamic(() => import('@emoji-mart/react'), { ssr: false });

const QUICK_FLAG_EMOJIS = [
  { label: '🌍 World', emoji: '🌍' },
  { label: '🇪🇺 Europe', emoji: '🇪🇺' },
  { label: '🇺🇸 USA', emoji: '🇺🇸' },
  { label: '🇨🇦 Canada', emoji: '🇨🇦' },
  { label: '🇦🇺 Australia', emoji: '🇦🇺' },
  { label: '🇳🇿 New Zealand', emoji: '🇳🇿' },
  { label: '🇬🇧 UK', emoji: '🇬🇧' },
  { label: '🇧🇪 Belgium', emoji: '🇧🇪' },
  { label: '🇳🇱 Netherlands', emoji: '🇳🇱' },
  { label: '🇩🇪 Germany', emoji: '🇩🇪' },
  { label: '🇫🇷 France', emoji: '🇫🇷' },
  { label: '🇪🇸 Spain', emoji: '🇪🇸' },
  { label: '🇮🇹 Italy', emoji: '🇮🇹' },
  { label: '🇧🇷 Brazil', emoji: '🇧🇷' },
  { label: '🇲🇽 Mexico', emoji: '🇲🇽' },
  { label: '🇦🇷 Argentina', emoji: '🇦🇷' },
  { label: '🇯🇵 Japan', emoji: '🇯🇵' },
  { label: '🇨🇳 China', emoji: '🇨🇳' },
  { label: '🇮🇳 India', emoji: '🇮🇳' },
  { label: '🇿🇦 South Africa', emoji: '🇿🇦' }
];

export default function AutoRoles() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);

  // Create menu dialog
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [editingMenu, setEditingMenu] = useState<any>(null);
  const [newMenu, setNewMenu] = useState({
    menu_name: '',
    menu_type: 'buttons',
    channel_id: '',
    embed_title: 'Select Your Roles',
    embed_description: 'Klik op de buttons hieronder om jezelf roles toe te wijzen:',
    embed_color: '#5865F2',
    max_roles: 0,
    options: [] as any[]
  });

  // Add role option dialog
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleOption, setNewRoleOption] = useState({
    role_id: '',
    button_label: '',
    button_emoji: '',
    button_style: 'primary',
    description: '',
    is_verify_button: false
  });
const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [menusRes, rolesRes, channelsRes] = await Promise.all([
        fetch(`/api/comcraft/guilds/${guildId}/autoroles`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/roles`),
        fetch(`/api/comcraft/guilds/${guildId}/discord/channels`)
      ]);

      const [menusData, rolesData, channelsData] = await Promise.all([
        menusRes.json(),
        rolesRes.json(),
        channelsRes.json()
      ]);

      setMenus(menusData.menus || []);
      if (rolesData.success) setRoles(rolesData.roles || []);
      if (channelsData.success) setChannels(channelsData.channels?.text || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRoleToMenu = () => {
    // For verify button, role_id can be empty
    if (!newRoleOption.is_verify_button && !newRoleOption.role_id) {
      alert('Select a role first!');
      return;
    }

    let roleOption;
    if (newRoleOption.is_verify_button) {
      // Add verify button
      roleOption = {
        role_id: 'verify', // Special identifier for verify button
        role_name: 'Verify',
        button_label: newRoleOption.button_label || 'Verify',
        button_emoji: newRoleOption.button_emoji || '✅',
        button_style: newRoleOption.button_style,
        description: newRoleOption.description || null,
        is_verify_button: true
      };
    } else {
      // Add regular role
      const selectedRole = roles.find(r => r.id === newRoleOption.role_id);
      if (!selectedRole) return;

      roleOption = {
        role_id: newRoleOption.role_id,
        role_name: selectedRole.name,
        button_label: newRoleOption.button_label || selectedRole.name,
        button_emoji: newRoleOption.button_emoji,
        button_style: newRoleOption.button_style,
        description: newRoleOption.description,
        is_verify_button: false
      };
    }

    setNewMenu({
      ...newMenu,
      options: [...newMenu.options, roleOption]
    });

    setNewRoleOption({
      role_id: '',
      button_label: '',
      button_emoji: '',
      button_style: 'primary',
      description: '',
      is_verify_button: false
    });
  setShowEmojiPicker(false);
  setShowAddRole(false);
  };

  const removeRoleFromMenu = (index: number) => {
    setNewMenu({
      ...newMenu,
      options: newMenu.options.filter((_, i) => i !== index)
    });
  };

  const startEditMenu = (menu: any) => {
    setEditingMenu(menu);
    setNewMenu({
      menu_name: menu.menu_name,
      menu_type: menu.menu_type,
      channel_id: menu.channel_id,
      embed_title: menu.embed_title,
      embed_description: menu.embed_description,
      embed_color: menu.embed_color,
      max_roles: menu.max_roles,
      options: menu.options || []
    });
    setShowCreateMenu(true);
  };

  const createMenu = async () => {
    if (!newMenu.menu_name || !newMenu.channel_id) {
      alert('Menu name and channel are required!');
      return;
    }

    if (newMenu.options.length === 0) {
      alert('Add at least 1 role!');
      return;
    }

    try {
      const isEditing = !!editingMenu;
      const response = await fetch(`/api/comcraft/guilds/${guildId}/autoroles`, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEditing ? { ...newMenu, id: editingMenu.id } : newMenu)
      });

      const result = await response.json();

      if (result.success) {
        alert(isEditing ? '✅ Role menu updated!' : '✅ Role menu created and posted to Discord!');
        setShowCreateMenu(false);
        setEditingMenu(null);
        setNewMenu({
          menu_name: '',
          menu_type: 'buttons',
          channel_id: '',
          embed_title: 'Select Your Roles',
          embed_description: 'Click the buttons below to assign roles to yourself:',
          embed_color: '#5865F2',
          max_roles: 0,
          options: []
        });
        fetchData();
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving menu:', error);
      alert('❌ Error saving');
    }
  };

  const cancelEdit = () => {
    setShowCreateMenu(false);
    setEditingMenu(null);
    setNewMenu({
      menu_name: '',
      menu_type: 'buttons',
      channel_id: '',
      embed_title: 'Select Your Roles',
      embed_description: 'Click the buttons below to assign yourself roles:',
      embed_color: '#5865F2',
      max_roles: 0,
      options: []
    });
  };

  const deleteMenu = async (menuId: string) => {
    if (!confirm('Are you sure you want to delete this role menu?')) {
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/autoroles?id=${menuId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Role menu deleted!');
        fetchData();
      } else {
        alert(`❌ Error: ${result.error}`);
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
              <h1 className="text-3xl font-bold mb-2">🎭 Auto-Roles</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Let members choose roles themselves via buttons or reactions
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
                <div className="font-semibold mb-1">What are Auto-Roles?</div>
                <p className="text-gray-600 dark:text-gray-400">
                  Members can select roles themselves via interactive buttons, reactions, or dropdowns.
                  Perfect for notification settings, pronoun roles, game roles, etc!
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Create Menu Button */}
        <div className="mb-6">
          <Dialog open={showCreateMenu} onOpenChange={setShowCreateMenu}>
            <DialogTrigger asChild>
              <Button size="lg">➕ New Role Menu</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingMenu ? '✏️ Edit Role Menu' : '➕ Create New Role Menu'}</DialogTitle>
                <DialogDescription>
                  {editingMenu ? 'Update your role menu and post it to Discord' : 'Create an interactive role menu for your Discord server'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                {/* Basic Settings */}
                <div className="space-y-4">
                  <h3 className="font-semibold">⚙️ Basic Settings</h3>
                  
                  <div>
                    <Label htmlFor="menuName">Menu Name *</Label>
                    <Input
                      id="menuName"
                      value={newMenu.menu_name}
                      onChange={(e) => setNewMenu({...newMenu, menu_name: e.target.value})}
                      placeholder="Notification Roles"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="menuType">Menu Type</Label>
                      <Select value={newMenu.menu_type} onValueChange={(v) => setNewMenu({...newMenu, menu_type: v})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buttons">🔘 Buttons (Modern)</SelectItem>
                          <SelectItem value="dropdown">📋 Dropdown Menu</SelectItem>
                          <SelectItem value="reactions">👍 Reactions (Legacy)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="channel">Discord Channel *</Label>
                      <Select value={newMenu.channel_id} onValueChange={(v) => setNewMenu({...newMenu, channel_id: v})}>
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
                  </div>

                  <div>
                    <Label htmlFor="maxRoles">Max Roles</Label>
                    <Select value={newMenu.max_roles.toString()} onValueChange={(v) => setNewMenu({...newMenu, max_roles: parseInt(v)})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Unlimited</SelectItem>
                        <SelectItem value="1">1 (Single Choice)</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Embed Customization */}
                <div className="space-y-4">
                  <h3 className="font-semibold">🎨 Embed Styling</h3>
                  
                  <div>
                    <Label htmlFor="embedTitle">Embed Title</Label>
                    <Input
                      id="embedTitle"
                      value={newMenu.embed_title}
                      onChange={(e) => setNewMenu({...newMenu, embed_title: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="embedDescription">Embed Description</Label>
                    <Textarea
                      id="embedDescription"
                      value={newMenu.embed_description}
                      onChange={(e) => setNewMenu({...newMenu, embed_description: e.target.value})}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="embedColor">Embed Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={newMenu.embed_color}
                        onChange={(e) => setNewMenu({...newMenu, embed_color: e.target.value})}
                        className="w-20"
                      />
                      <Input
                        value={newMenu.embed_color}
                        onChange={(e) => setNewMenu({...newMenu, embed_color: e.target.value})}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Roles */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">🎭 Roles in Menu ({newMenu.options.length})</h3>
          <Dialog
            open={showAddRole}
            onOpenChange={(open) => {
              setShowAddRole(open);
              if (!open) {
                setShowEmojiPicker(false);
              }
            }}
          >
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">+ Add Role</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Role</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          {/* Verify Button Toggle */}
                          <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <input
                              type="checkbox"
                              id="isVerifyButton"
                              checked={newRoleOption.is_verify_button}
                              onChange={(e) => {
                                const isVerify = e.target.checked;
                                setNewRoleOption({
                                  ...newRoleOption,
                                  is_verify_button: isVerify,
                                  role_id: isVerify ? 'verify' : '',
                                  button_label: isVerify ? (newRoleOption.button_label || 'Verify') : newRoleOption.button_label
                                });
                              }}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="isVerifyButton" className="cursor-pointer flex-1">
                              <div className="font-semibold">✅ Verify Button</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Removes the unverified role when clicked (configure in Welcome settings)
                              </div>
                            </Label>
                          </div>

                          {!newRoleOption.is_verify_button && (
                            <div>
                              <Label>Discord Role *</Label>
                              <Select value={newRoleOption.role_id} onValueChange={(v) => setNewRoleOption({...newRoleOption, role_id: v})}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {roles.filter(r => !newMenu.options.find(opt => opt.role_id === r.id)).map((role: any) => (
                                    <SelectItem key={role.id} value={role.id}>
                                      {role.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div>
                            <Label>Button Label (optional)</Label>
                            <Input
                              value={newRoleOption.button_label}
                              onChange={(e) => setNewRoleOption({...newRoleOption, button_label: e.target.value})}
                              placeholder="Leave empty for role name"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Emoji (optional)</Label>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Input
                                value={newRoleOption.button_emoji}
                                onChange={(e) => setNewRoleOption({ ...newRoleOption, button_emoji: e.target.value })}
                                placeholder="Click 'Choose Emoji' or paste your own"
                                className="w-32 text-center"
                              />
                              {newRoleOption.button_emoji && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{newRoleOption.button_emoji}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setNewRoleOption({ ...newRoleOption, button_emoji: '' })}
                                  >
                                    🗑️
                                  </Button>
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                              >
                                😀 Choose Emoji
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {QUICK_FLAG_EMOJIS.map((flag) => (
                                <Button
                                  key={flag.emoji}
                                  size="sm"
                                  variant={newRoleOption.button_emoji === flag.emoji ? 'default' : 'outline'}
                                  onClick={() => setNewRoleOption({ ...newRoleOption, button_emoji: flag.emoji })}
                                >
                                  <span className="text-lg mr-1">{flag.emoji}</span>
                                  <span className="text-xs">{flag.label}</span>
                                </Button>
                              ))}
                            </div>
                            {showEmojiPicker && (
                              <div className="mt-2 border rounded-lg p-2 bg-white dark:bg-gray-900 max-h-72 overflow-hidden">
                                <EmojiPicker
                                  data={emojiData}
                                  onEmojiSelect={(emoji: any) => {
                                    setNewRoleOption({ ...newRoleOption, button_emoji: emoji.native });
                                    setShowEmojiPicker(false);
                                  }}
                                  previewPosition="none"
                                  theme="auto"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <Label>Button Style</Label>
                            <Select value={newRoleOption.button_style} onValueChange={(v) => setNewRoleOption({...newRoleOption, button_style: v})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="primary">🔵 Blue (Primary)</SelectItem>
                                <SelectItem value="secondary">⚫ Gray (Secondary)</SelectItem>
                                <SelectItem value="success">🟢 Green (Success)</SelectItem>
                                <SelectItem value="danger">🔴 Red (Danger)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Description (for dropdown)</Label>
                            <Input
                              value={newRoleOption.description}
                              onChange={(e) => setNewRoleOption({...newRoleOption, description: e.target.value})}
                              placeholder="Optional"
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button onClick={addRoleToMenu} className="flex-1">✅ Add</Button>
                            <Button variant="outline" onClick={() => setShowAddRole(false)}>Cancel</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {newMenu.options.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-gray-600">No roles added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {newMenu.options.map((opt: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-2">
                            {opt.button_emoji && <span>{opt.button_emoji}</span>}
                            <span className="font-semibold">{opt.role_name}</span>
                            {opt.is_verify_button && (
                              <Badge variant="outline" className="ml-2 text-xs">Verify Button</Badge>
                            )}
                            {opt.button_label !== opt.role_name && (
                              <span className="text-sm text-gray-500">({opt.button_label})</span>
                            )}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => removeRoleFromMenu(index)}>
                            🗑️
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Preview */}
                <div className="space-y-4">
                  <h3 className="font-semibold">👀 Preview</h3>
                  <div className="p-4 bg-gray-900 rounded-lg border-l-4" style={{ borderColor: newMenu.embed_color }}>
                    <div className="text-white">
                      <div className="font-bold text-lg mb-2" style={{ color: newMenu.embed_color }}>
                        {newMenu.embed_title}
                      </div>
                      <div className="text-sm text-gray-300 mb-3">
                        {newMenu.embed_description}
                      </div>
                      {newMenu.options.length > 0 && (
                        <div className="text-sm space-y-1 mb-3">
                          <div className="font-semibold">📋 Available Roles</div>
                          {newMenu.options.map((opt: any, i: number) => (
                            <div key={i}>
                              {opt.button_emoji || '•'} <strong>{opt.role_name}</strong>
                              {opt.description && ` - ${opt.description}`}
                            </div>
                          ))}
                        </div>
                      )}
                      {newMenu.max_roles > 0 && (
                        <div className="text-xs text-gray-400 mt-2">
                          You can select up to {newMenu.max_roles} role{newMenu.max_roles !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    
                    {/* Button Preview */}
                    {newMenu.menu_type === 'buttons' && newMenu.options.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {newMenu.options.map((opt: any, i: number) => (
                          <div 
                            key={i} 
                            className={`px-4 py-2 rounded ${
                              opt.button_style === 'primary' ? 'bg-blue-600' :
                              opt.button_style === 'success' ? 'bg-green-600' :
                              opt.button_style === 'danger' ? 'bg-red-600' :
                              'bg-gray-600'
                            } text-white text-sm font-semibold`}
                          >
                            {opt.button_emoji && <span className="mr-1">{opt.button_emoji}</span>}
                            {opt.button_label || opt.role_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Create/Update Button */}
                <div className="flex gap-2">
                  <Button onClick={createMenu} className="flex-1" size="lg">
                    {editingMenu ? '💾 Save & Update' : '🚀 Create & Post to Discord'}
                  </Button>
                  <Button variant="outline" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Existing Menus */}
        <div className="space-y-4">
          {menus.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">🎭</div>
              <h3 className="text-xl font-bold mb-2">No role menus yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first role menu to let members choose roles themselves!
              </p>
            </Card>
          ) : (
            menus.map((menu: any) => (
              <Card key={menu.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{menu.menu_name}</h3>
                      <Badge>{menu.menu_type}</Badge>
                      {menu.is_active ? (
                        <Badge className="bg-green-600">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      Channel: #{channels.find((ch: any) => ch.id === menu.channel_id)?.name || menu.channel_id}
                    </p>
                    <p className="text-sm text-gray-600">
                      {menu.options?.length || 0} roles • {menu.total_uses || 0} uses
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEditMenu(menu)}>
                      ✏️ Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteMenu(menu.id)}>
                      🗑️ Delete
                    </Button>
                  </div>
                </div>

                {/* Roles in Menu */}
                {menu.options && menu.options.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {menu.options.map((opt: any) => (
                      <Badge key={opt.id} variant="outline" className="text-sm">
                        {opt.button_emoji && <span className="mr-1">{opt.button_emoji}</span>}
                        {opt.role_name}
                        <span className="ml-1 text-xs text-gray-500">({opt.total_assigns || 0})</span>
                      </Badge>
                    ))}
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

