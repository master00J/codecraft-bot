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
import { Trash2, Edit, Plus, Send, CheckCircle2, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface ProfileForm {
  id: string;
  form_name: string;
  description?: string;
  channel_id: string;
  message_id?: string;
  questions: Question[];
  thread_name_template: string;
  enabled: boolean;
  created_at: string;
}

interface Question {
  id: string;
  text: string;
  options: Option[];
}

interface Option {
  id: string;
  text: string;
}

export default function UserProfilesConfig() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { toast } = useToast();

  const [forms, setForms] = useState<ProfileForm[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingNewForm, setCreatingNewForm] = useState(false);
  const [editingForm, setEditingForm] = useState<ProfileForm | null>(null);

  const [newForm, setNewForm] = useState({
    formName: '',
    description: '',
    channelId: '',
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
      const response = await fetch(`/api/comcraft/guilds/${guildId}/discord/channels`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.channels) {
          setChannels(data.channels.text || []);
        } else if (Array.isArray(data.channels)) {
          setChannels(data.channels.filter((ch: any) => ch.type === 0 || ch.type === 5));
        } else {
          setChannels([]);
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      setChannels([]);
    }
  };

  const addQuestion = () => {
    const questionId = `q${Date.now()}`;
    const newQuestion: Question = {
      id: questionId,
      text: '',
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

  const updateQuestion = (questionId: string, field: 'text' | 'options', value: any) => {
    setNewForm({
      ...newForm,
      questions: newForm.questions.map(q =>
        q.id === questionId
          ? field === 'text'
            ? { ...q, text: value }
            : { ...q, options: value }
          : q
      )
    });
  };

  const addOption = (questionId: string) => {
    const optionId = `opt${Date.now()}`;
    updateQuestion(questionId, 'options', [
      ...newForm.questions.find(q => q.id === questionId)!.options,
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
    updateQuestion(questionId, 'options', 
      newForm.questions.find(q => q.id === questionId)!.options.filter(opt => opt.id !== optionId)
    );
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
      if (!question.text || question.options.length === 0) {
        toast({
          title: 'Validation Error',
          description: 'All questions must have text and at least one option',
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
          threadNameTemplate: '{username} Profile',
          questions: []
        });
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
        toast({
          title: 'Success',
          description: 'Form message posted to Discord channel'
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
    setNewForm({
      formName: form.form_name,
      description: form.description || '',
      channelId: form.channel_id,
      threadNameTemplate: form.thread_name_template,
      questions: form.questions
    });
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
            threadNameTemplate: '{username} Profile',
            questions: []
          });
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
            <Select value={newForm.channelId} onValueChange={(value) => setNewForm({ ...newForm, channelId: value })}>
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

          <div>
            <Label>Thread Name Template</Label>
            <Input
              value={newForm.threadNameTemplate}
              onChange={(e) => setNewForm({ ...newForm, threadNameTemplate: e.target.value })}
              placeholder="{username} Profile"
            />
            <p className="text-sm text-gray-500 mt-1">Use {"{username}"} or {"{displayName}"} for dynamic names</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Questions</Label>
              <Button variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </div>

            {newForm.questions.map((question, qIdx) => (
              <Card key={question.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={question.text}
                      onChange={(e) => updateQuestion(question.id, 'text', e.target.value)}
                      placeholder={`Question ${qIdx + 1} (e.g., "What country do you live in?")`}
                    />
                    <div className="space-y-2">
                      {question.options.map((option, oIdx) => (
                        <div key={option.id} className="flex gap-2">
                          <Input
                            value={option.text}
                            onChange={(e) => {
                              const updatedOptions = question.options.map(opt =>
                                opt.id === option.id ? { ...opt, text: e.target.value } : opt
                              );
                              updateQuestion(question.id, 'options', updatedOptions);
                            }}
                            placeholder={`Option ${oIdx + 1} (e.g., "USA")`}
                          />
                          {question.options.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOption(question.id, option.id)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeQuestion(question.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
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
                  {!form.message_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => postMessage(form.id)}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Post to Discord
                    </Button>
                  )}
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

