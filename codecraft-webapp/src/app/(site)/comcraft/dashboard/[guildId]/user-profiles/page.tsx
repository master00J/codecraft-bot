'use client';

/**
 * ComCraft - User Profile Builder Management Page
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Edit, Plus, Send, CheckCircle2, XCircle, GripVertical } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProfileForm {
  id: string;
  form_name: string;
  description?: string;
  channel_id: string;
  message_id?: string;
  thread_id?: string; // Optional: selected thread ID
  questions: Question[];
  thread_name_template: string;
  enabled: boolean;
  created_at: string;
}

type QuestionType = 'dropdown' | 'text' | 'number' | 'image';

interface Question {
  id: string;
  text: string;
  type: QuestionType; // 'dropdown', 'text', 'number', or 'image'
  options?: Option[]; // Only required for dropdown type
  placeholder?: string; // For text/number types
  minLength?: number; // For text type
  maxLength?: number; // For text type
  min?: number; // For number type
  max?: number; // For number type
  required?: boolean; // Optional, defaults to false
  maxSelections?: number; // For dropdown type: maximum number of options that can be selected (default: all)
  maxFileSize?: number; // For image type: maximum file size in MB (default: 10)
  allowedTypes?: string; // For image type: allowed MIME types (default: 'image/*')
}

interface Option {
  id: string;
  text: string;
  description?: string;
}

// Sortable Question Component
function SortableQuestion({
  question,
  qIdx,
  updateQuestion,
  addOption,
  removeOption,
  removeQuestion,
}: {
  question: Question;
  qIdx: number;
  updateQuestion: (questionId: string, field: keyof Question, value: any) => void;
  addOption: (questionId: string) => void;
  removeOption: (questionId: string, optionId: string) => void;
  removeQuestion: (questionId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-4 space-y-3 ${isDragging ? 'ring-2 ring-blue-500' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 space-y-3">
          <div className="flex gap-2 items-center">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <GripVertical className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <Input
                value={question.text}
                onChange={(e) => updateQuestion(question.id, 'text', e.target.value)}
                placeholder={`Question ${qIdx + 1} (e.g., "What country do you live in?")`}
              />
            </div>
            <Select 
              value={question.type || 'dropdown'} 
              onValueChange={(value: QuestionType) => updateQuestion(question.id, 'type', value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dropdown">Dropdown</SelectItem>
                <SelectItem value="text">Text Input</SelectItem>
                <SelectItem value="number">Number Input</SelectItem>
                <SelectItem value="image">Image Upload</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rest of the question configuration UI */}
          {/* Dropdown Type Configuration */}
          {(!question.type || question.type === 'dropdown') && (
            <div className="space-y-2 pl-4 border-l-2 border-gray-300">
              <div>
                <Label className="text-sm font-medium">Maximum Selections (optional)</Label>
                <Input
                  type="number"
                  value={question.maxSelections !== undefined ? question.maxSelections : ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                    updateQuestion(question.id, 'maxSelections', value);
                  }}
                  placeholder="No limit (all options can be selected)"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of options users can select. Leave empty for no limit.
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Options</Label>
                {(question.options || []).map((option, oIdx) => {
                  const currentOptions = question.options || [];
                  return (
                    <div key={option.id} className="flex gap-2">
                      <Input
                        value={option.text}
                        onChange={(e) => {
                          const updatedOptions = currentOptions.map(opt =>
                            opt.id === option.id ? { ...opt, text: e.target.value } : opt
                          );
                          updateQuestion(question.id, 'options', updatedOptions);
                        }}
                        placeholder={`Option ${oIdx + 1} (e.g., "USA")`}
                      />
                      {currentOptions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(question.id, option.id)}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addOption(question.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Option
                </Button>
              </div>
            </div>
          )}

          {/* Text Input Type Configuration */}
          {question.type === 'text' && (
            <div className="space-y-2 pl-4 border-l-2 border-blue-300">
              <div>
                <Label className="text-sm font-medium">Placeholder (optional)</Label>
                <Input
                  value={question.placeholder || ''}
                  onChange={(e) => updateQuestion(question.id, 'placeholder', e.target.value)}
                  placeholder="e.g., Enter your name"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-sm font-medium">Min Length</Label>
                  <Input
                    type="number"
                    value={question.minLength || ''}
                    onChange={(e) => updateQuestion(question.id, 'minLength', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="e.g., 2"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Max Length</Label>
                  <Input
                    type="number"
                    value={question.maxLength || ''}
                    onChange={(e) => updateQuestion(question.id, 'maxLength', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="e.g., 50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Number Input Type Configuration */}
          {question.type === 'number' && (
            <div className="space-y-2 pl-4 border-l-2 border-green-300">
              <div>
                <Label className="text-sm font-medium">Placeholder (optional)</Label>
                <Input
                  value={question.placeholder || ''}
                  onChange={(e) => updateQuestion(question.id, 'placeholder', e.target.value)}
                  placeholder="e.g., Enter your age"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-sm font-medium">Min Value</Label>
                  <Input
                    type="number"
                    value={question.min !== undefined ? question.min : ''}
                    onChange={(e) => updateQuestion(question.id, 'min', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g., 0"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Max Value</Label>
                  <Input
                    type="number"
                    value={question.max !== undefined ? question.max : ''}
                    onChange={(e) => updateQuestion(question.id, 'max', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g., 100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Image Upload Type Configuration */}
          {question.type === 'image' && (
            <div className="space-y-2 pl-4 border-l-2 border-purple-300">
              <p className="text-xs text-gray-500">
                Users will be able to upload an image file. Images are stored securely and displayed in their profile.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-sm font-medium">Max File Size (MB)</Label>
                  <Input
                    type="number"
                    value={question.maxFileSize || 10}
                    onChange={(e) => updateQuestion(question.id, 'maxFileSize', e.target.value ? parseInt(e.target.value) : 10)}
                    placeholder="10"
                    min="1"
                    max="25"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Allowed Types</Label>
                  <Input
                    value={question.allowedTypes || 'image/*'}
                    onChange={(e) => updateQuestion(question.id, 'allowedTypes', e.target.value)}
                    placeholder="image/*"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    e.g., image/*, image/png,image/jpeg
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Required checkbox for all types */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`required-${question.id}`}
              checked={question.required || false}
              onChange={(e) => updateQuestion(question.id, 'required', e.target.checked)}
              className="rounded"
            />
            <Label htmlFor={`required-${question.id}`} className="text-sm font-medium cursor-pointer">
              Required field
            </Label>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeQuestion(question.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}

export default function UserProfilesConfig() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [forms, setForms] = useState<ProfileForm[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingNewForm, setCreatingNewForm] = useState(false);
  const [editingForm, setEditingForm] = useState<ProfileForm | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for questions
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setNewForm((prev) => {
        const oldIndex = prev.questions.findIndex((q) => q.id === active.id);
        const newIndex = prev.questions.findIndex((q) => q.id === over.id);

        return {
          ...prev,
          questions: arrayMove(prev.questions, oldIndex, newIndex),
        };
      });
    }
  };

  const [newForm, setNewForm] = useState({
    formName: '',
    description: '',
    channelId: '',
    threadId: '',
    threadNameTemplate: '{username} Profile',
    questions: [] as Question[]
  });

  useEffect(() => {
    if (guildId) {
      fetchForms();
      fetchChannels();
    }
  }, [guildId]);

  const fetchForms = async () => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/user-profiles`);
      if (response.ok) {
        const data = await response.json();
        setForms(data.forms || []);
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile forms',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      console.log(`[User Profiles] Fetching channels for guild ${guildId}`);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/channels`);
      const data = await response.json();
      console.log(`[User Profiles] Channels API response:`, { 
        ok: response.ok, 
        success: data.success, 
        hasChannels: !!data.channels,
        channelsType: typeof data.channels 
      });
      
      if (response.ok && data.success && data.channels) {
        const textChannels = data.channels.text || [];
        console.log(`[User Profiles] Loaded ${textChannels.length} text channels`);
        setChannels(textChannels);
      } else if (response.ok && Array.isArray(data.channels)) {
        const textChannels = data.channels.filter((ch: any) => ch.type === 0 || ch.type === 5);
        console.log(`[User Profiles] Loaded ${textChannels.length} text channels (from array)`);
        setChannels(textChannels);
      } else {
        console.warn(`[User Profiles] Failed to load channels:`, data.error || 'Unknown error', data);
        setChannels([]);
      }
    } catch (error: any) {
      console.error('[User Profiles] Error fetching channels:', error);
      setChannels([]);
    }
  };

  const fetchThreads = async (channelId: string) => {
    if (!channelId) {
      setThreads([]);
      return;
    }

    setLoadingThreads(true);
    try {
      console.log(`[User Profiles] Fetching threads for channel ${channelId} in guild ${guildId}`);
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/channels/${channelId}/threads`);
      const data = await response.json();
      console.log(`[User Profiles] Threads API response:`, data);
      
      if (response.ok && data.success && Array.isArray(data.threads)) {
        setThreads(data.threads);
        console.log(`[User Profiles] Loaded ${data.threads.length} threads`);
      } else {
        console.warn(`[User Profiles] Failed to load threads:`, data.error || 'Unknown error');
        // Don't set empty array - keep existing threads if available
        // This allows the form to still work even if threads can't be loaded
        if (!threads.length) {
          setThreads([]);
        }
      }
    } catch (error: any) {
      console.error('Error fetching threads:', error);
      // Only clear threads if we don't have any cached
      // This prevents breaking the UI if the bot API is temporarily unavailable
      if (!threads.length) {
        setThreads([]);
      }
    } finally {
      setLoadingThreads(false);
    }
  };

  const addQuestion = () => {
    const questionId = `q${Date.now()}`;
    const newQuestion: Question = {
      id: questionId,
      text: '',
      type: 'dropdown', // Default to dropdown for backward compatibility
      options: [
        { id: `opt${Date.now()}_1`, text: '' },
        { id: `opt${Date.now()}_2`, text: '' }
      ]
    };
    setNewForm({
      ...newForm,
      questions: [...newForm.questions, newQuestion]
    });
  };

  const updateQuestion = (questionId: string, field: keyof Question, value: any) => {
    setNewForm({
      ...newForm,
      questions: newForm.questions.map(q => {
        if (q.id !== questionId) return q;
        
        const updated = { ...q, [field]: value };
        
        // If type changes, reset type-specific fields
        if (field === 'type') {
          if (value === 'dropdown') {
            // Switching to dropdown - ensure options exist
            updated.options = updated.options || [
              { id: `opt${Date.now()}_1`, text: '' },
              { id: `opt${Date.now()}_2`, text: '' }
            ];
            // Remove text/number specific fields
            delete updated.placeholder;
            delete updated.minLength;
            delete updated.maxLength;
            delete updated.min;
            delete updated.max;
          } else {
            // Switching to text/number - remove options
            delete updated.options;
          }
        }
        
        return updated;
      })
    });
  };

  const addOption = (questionId: string) => {
    const question = newForm.questions.find(q => q.id === questionId);
    if (!question) return;
    
    const optionId = `opt${Date.now()}`;
    const currentOptions = (question.type === 'dropdown' && question.options) ? question.options : [];
    updateQuestion(questionId, 'options', [
      ...currentOptions,
      { id: optionId, text: '' }
    ]);
  };

  const removeQuestion = (questionId: string) => {
    setNewForm({
      ...newForm,
      questions: newForm.questions.filter(q => q.id !== questionId)
    });
  };

  const removeOption = (questionId: string, optionId: string) => {
    const question = newForm.questions.find(q => q.id === questionId);
    if (!question || !question.options) return;
    
    const updatedOptions = question.options.filter(opt => opt.id !== optionId);
    updateQuestion(questionId, 'options', updatedOptions);
  };

  const saveForm = async () => {
    if (!newForm.formName || !newForm.channelId || newForm.questions.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in form name, channel, and add at least one question',
        variant: 'destructive'
      });
      return;
    }

    // Validate questions
    for (const question of newForm.questions) {
      if (!question.text) {
        toast({
          title: 'Validation Error',
          description: 'All questions must have text',
          variant: 'destructive'
        });
        return;
      }
      
      const questionType = question.type || 'dropdown';
      
      if (questionType === 'dropdown') {
        if (!question.options || question.options.length === 0) {
          toast({
            title: 'Validation Error',
            description: 'Dropdown questions must have at least one option',
            variant: 'destructive'
          });
          return;
        }
        for (const option of question.options) {
          if (!option.text) {
            toast({
              title: 'Validation Error',
              description: 'All options must have text',
              variant: 'destructive'
            });
            return;
          }
        }
      }
    }

    setSaving(true);
    try {
      const url = editingForm
        ? `/api/comcraft/guilds/${guildId}/user-profiles/${editingForm.id}`
        : `/api/comcraft/guilds/${guildId}/user-profiles`;
      
      const method = editingForm ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formName: newForm.formName,
          description: newForm.description,
          channelId: newForm.channelId,
          threadId: newForm.threadId || null, // Send null if empty
          questions: newForm.questions,
          threadNameTemplate: newForm.threadNameTemplate
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: editingForm ? 'Form updated successfully' : 'Form created successfully'
        });
        setCreatingNewForm(false);
        setEditingForm(null);
        setNewForm({
          formName: '',
          description: '',
          channelId: '',
          threadId: '',
          threadNameTemplate: '{username} Profile',
          questions: []
        });
        setThreads([]);
        fetchForms();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save form');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save form',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteForm = async (formId: string) => {
    if (!confirm('Are you sure you want to delete this form? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/user-profiles/${formId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Form deleted successfully'
        });
        fetchForms();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete form');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete form',
        variant: 'destructive'
      });
    }
  };

  const postMessage = async (formId: string) => {
    try {
      const response = await fetch(`/api/comcraft/guilds/${guildId}/user-profiles/${formId}/post-message`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: data.messageId ? 'Form message updated in Discord channel' : 'Form message posted to Discord channel'
        });
        fetchForms();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to post message');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to post message',
        variant: 'destructive'
      });
    }
  };

  const startEditing = (form: ProfileForm) => {
    setEditingForm(form);
    // Ensure all questions have a type field (default to 'dropdown' for backward compatibility)
    const questionsWithTypes = form.questions.map(q => ({
      ...q,
      type: (q as any).type || 'dropdown'
    }));
    setNewForm({
      formName: form.form_name,
      description: form.description || '',
      channelId: form.channel_id,
      threadId: form.thread_id || '',
      threadNameTemplate: form.thread_name_template,
      questions: questionsWithTypes
    });
    // Fetch threads for the channel when editing
    if (form.channel_id) {
      fetchThreads(form.channel_id);
    }
    setCreatingNewForm(true);
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">User Profile Builder</h1>
        <Button onClick={() => {
          setCreatingNewForm(true);
          setEditingForm(null);
          setNewForm({
            formName: '',
            description: '',
            channelId: '',
            threadId: '',
            threadNameTemplate: '{username} Profile',
            questions: []
          });
          setThreads([]);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Create Form
        </Button>
      </div>

      {creatingNewForm && (
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-bold">{editingForm ? 'Edit Form' : 'Create New Form'}</h2>
          
          <div>
            <Label>Form Name</Label>
            <Input
              value={newForm.formName}
              onChange={(e) => setNewForm({ ...newForm, formName: e.target.value })}
              placeholder="e.g., Member Profile"
            />
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea
              value={newForm.description}
              onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
              placeholder="Brief description of the form"
            />
          </div>

          <div>
            <Label>Channel</Label>
            <Select value={newForm.channelId} onValueChange={(value) => {
              setNewForm({ ...newForm, channelId: value, threadId: '' }); // Reset thread when channel changes
              fetchThreads(value); // Fetch threads for selected channel
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a channel" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newForm.channelId && (
            <div>
              <Label>Existing Thread (Optional)</Label>
              <Select 
                value={newForm.threadId || 'none'} 
                onValueChange={(value) => setNewForm({ ...newForm, threadId: value === 'none' ? '' : value })}
                disabled={loadingThreads}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingThreads ? "Loading threads..." : "Select an existing thread (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Create new thread</SelectItem>
                  {threads.map((thread) => (
                    <SelectItem key={thread.id} value={thread.id}>
                      #{thread.name} {thread.archived ? '(Archived)' : ''} ({thread.messageCount || 0} messages)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500 mt-1">
                Select an existing thread to add profiles to, or leave as "Create new thread" to create a new one
              </p>
            </div>
          )}

          {!newForm.threadId && (
            <div>
              <Label>Thread Name Template</Label>
              <Input
                value={newForm.threadNameTemplate}
                onChange={(e) => setNewForm({ ...newForm, threadNameTemplate: e.target.value })}
                placeholder="{username} Profile"
              />
              <p className="text-sm text-gray-500 mt-1">Use {"{username}"} or {"{displayName}"} for dynamic names (only used when creating a new thread)</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Questions</Label>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={newForm.questions.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                {newForm.questions.map((question, qIdx) => (
                  <SortableQuestion
                    key={question.id}
                    question={question}
                    qIdx={qIdx}
                    updateQuestion={updateQuestion}
                    addOption={addOption}
                    removeOption={removeOption}
                    removeQuestion={removeQuestion}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveForm} disabled={saving}>
              {saving ? 'Saving...' : editingForm ? 'Update Form' : 'Create Form'}
            </Button>
            <Button variant="outline" onClick={() => {
              setCreatingNewForm(false);
              setEditingForm(null);
            }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Existing Forms</h2>
        {forms.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            No profile forms created yet. Create one to get started!
          </Card>
        ) : (
          forms.map((form) => (
            <Card key={form.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold">{form.form_name}</h3>
                    {form.enabled ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="w-3 h-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </div>
                  {form.description && (
                    <p className="text-gray-600 mb-2">{form.description}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    {form.questions.length} question(s) • Channel: {channels.find(c => c.id === form.channel_id)?.name || form.channel_id}
                  </p>
                  {form.message_id && (
                    <p className="text-sm text-green-600 mt-1">✓ Message posted to Discord</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => postMessage(form.id)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {form.message_id ? 'Repost to Discord' : 'Post to Discord'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditing(form)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteForm(form.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

