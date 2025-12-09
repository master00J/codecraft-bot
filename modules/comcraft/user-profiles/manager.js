const { createClient } = require('@supabase/supabase-js');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

class UserProfileManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Create a new profile form
   */
  async createForm(guildId, formName, description, channelId, questions, threadNameTemplate) {
    try {
      // Validate questions structure
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('At least one question is required');
      }

      for (const question of questions) {
        if (!question.id || !question.text || !Array.isArray(question.options) || question.options.length === 0) {
          throw new Error('Each question must have an id, text, and at least one option');
        }
        for (const option of question.options) {
          if (!option.id || !option.text) {
            throw new Error('Each option must have an id and text');
          }
        }
      }

      const { data: form, error } = await this.supabase
        .from('user_profiles_forms')
        .insert({
          guild_id: guildId,
          form_name: formName,
          description: description || null,
          channel_id: channelId,
          questions: questions,
          thread_name_template: threadNameTemplate || '{username} Profile',
          enabled: true
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return form;
    } catch (error) {
      console.error('Error creating profile form:', error);
      throw error;
    }
  }

  /**
   * Post the form message to Discord channel
   */
  async postFormMessage(form, channel) {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`📋 ${form.form_name}`)
        .setColor(0x5865F2)
        .setDescription(form.description || 'Fill out your profile by selecting the options below:')
        .setFooter({ text: 'Click the checkboxes to select your answers, then click "Submit Profile" when done' })
        .setTimestamp();

      // Build form content with checkboxes
      let formContent = '';
      const components = [];

      // Discord limits: max 5 action rows, max 5 buttons per row = 25 buttons total
      let totalButtons = 0;
      const MAX_BUTTONS = 25;

      for (const question of form.questions) {
        formContent += `\n**${question.text}**\n`;
        
        let questionRow = new ActionRowBuilder();
        let buttonsInRow = 0;
        
        for (const option of question.options) {
          // Check if we've reached the button limit (max 25 buttons total, max 5 rows)
          if (totalButtons >= MAX_BUTTONS || components.length >= 5) {
            console.warn(`Button/row limit reached. Skipping remaining options.`);
            break;
          }

          // Discord button label limit is 80 characters
          const label = option.text.length > 80 ? option.text.substring(0, 77) + '...' : option.text;
          
          // Max 5 buttons per row
          if (buttonsInRow >= 5) {
            // Start a new row for this question
            components.push(questionRow);
            questionRow = new ActionRowBuilder();
            buttonsInRow = 0;
          }
          
          const button = new ButtonBuilder()
            .setCustomId(`profile_checkbox_${form.id}_${question.id}_${option.id}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('☐');
          
          questionRow.addComponents(button);
          buttonsInRow++;
          totalButtons++;
        }
        
        if (questionRow.components.length > 0 && components.length < 5) {
          components.push(questionRow);
        }
        formContent += '\n';
      }

      // Add submit button (only if we haven't reached the 5 row limit)
      if (components.length < 5) {
        const submitRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`profile_submit_${form.id}`)
              .setLabel('Submit Profile')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅')
          );
        components.push(submitRow);
      } else {
        console.warn('[Profile Manager] Cannot add submit button - reached maximum action rows (5)');
        throw new Error('Form has too many questions/options. Maximum 5 action rows allowed (including submit button).');
      }

      // Validate we have at least one component (submit button)
      if (components.length === 0) {
        throw new Error('No components to send. Form must have at least one question with options.');
      }

      // Ensure we don't exceed Discord's limit of 5 action rows (shouldn't happen now, but double-check)
      if (components.length > 5) {
        console.warn(`[Profile Manager] Too many action rows (${components.length}), limiting to 5`);
        components = components.slice(0, 5);
      }

      console.log(`[Profile Manager] Sending message with ${components.length} action rows, ${totalButtons} buttons total`);

      const message = await channel.send({
        embeds: [embed],
        components: components
      });

      console.log(`[Profile Manager] Message sent successfully: ${message.id}`);

      // Update form with message ID
      await this.supabase
        .from('user_profiles_forms')
        .update({ message_id: message.id })
        .eq('id', form.id);

      return message;
    } catch (error) {
      console.error('[Profile Manager] Error posting form message:', error);
      console.error('[Profile Manager] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get form by ID
   */
  async getForm(formId) {
    const { data: form, error } = await this.supabase
      .from('user_profiles_forms')
      .select('*')
      .eq('id', formId)
      .single();

    if (error || !form) {
      return null;
    }

    return form;
  }

  /**
   * Get all forms for a guild
   */
  async getForms(guildId) {
    const { data: forms, error } = await this.supabase
      .from('user_profiles_forms')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching forms:', error);
      return [];
    }

    return forms || [];
  }

  /**
   * Get or create user response
   */
  async getOrCreateResponse(formId, guildId, userId) {
    const { data: existing } = await this.supabase
      .from('user_profiles_responses')
      .select('*')
      .eq('form_id', formId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return existing;
    }

    const { data: response, error } = await this.supabase
      .from('user_profiles_responses')
      .insert({
        form_id: formId,
        guild_id: guildId,
        user_id: userId,
        responses: {},
        status: 'in_progress'
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return response;
  }

  /**
   * Toggle checkbox selection
   */
  async toggleCheckbox(formId, questionId, optionId, userId) {
    try {
      const form = await this.getForm(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      const response = await this.getOrCreateResponse(formId, form.guild_id, userId);

      const currentResponses = response.responses || {};
      const questionResponses = currentResponses[questionId] || [];

      // Toggle option
      let updatedResponses;
      if (questionResponses.includes(optionId)) {
        // Remove option
        updatedResponses = {
          ...currentResponses,
          [questionId]: questionResponses.filter(id => id !== optionId)
        };
      } else {
        // Add option
        updatedResponses = {
          ...currentResponses,
          [questionId]: [...questionResponses, optionId]
        };
      }

      // Update response
      const { error } = await this.supabase
        .from('user_profiles_responses')
        .update({
          responses: updatedResponses,
          updated_at: new Date().toISOString()
        })
        .eq('id', response.id);

      if (error) {
        throw new Error(error.message);
      }

      return updatedResponses;
    } catch (error) {
      console.error('Error toggling checkbox:', error);
      throw error;
    }
  }

  /**
   * Get user response with selected options
   */
  async getUserResponse(formId, userId) {
    const { data: response, error } = await this.supabase
      .from('user_profiles_responses')
      .select('*')
      .eq('form_id', formId)
      .eq('user_id', userId)
      .single();

    if (error || !response) {
      return null;
    }

    return response;
  }

  /**
   * Submit profile and create thread
   */
  async submitProfile(formId, userId, guild) {
    try {
      const form = await this.getForm(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      const response = await this.getUserResponse(formId, userId);
      if (!response) {
        throw new Error('No response found. Please select some options first.');
      }

      if (response.status === 'completed') {
        throw new Error('You have already submitted this profile.');
      }

      // Get channel
      const channel = await guild.channels.fetch(form.channel_id).catch(() => null);
      if (!channel) {
        throw new Error('Form channel not found');
      }

      // Get the form message
      let formMessage = null;
      if (form.message_id) {
        try {
          formMessage = await channel.messages.fetch(form.message_id);
        } catch (error) {
          console.warn('Could not fetch form message:', error.message);
        }
      }

      // Get user
      const user = await guild.members.fetch(userId).catch(() => null);
      if (!user) {
        throw new Error('User not found in server');
      }

      // Build profile content
      let profileContent = `# ${user.user.displayName}'s Profile\n\n`;
      
      for (const question of form.questions) {
        const selectedOptionIds = response.responses[question.id] || [];
        if (selectedOptionIds.length === 0) {
          continue; // Skip unanswered questions
        }

        const selectedOptions = question.options.filter(opt => 
          selectedOptionIds.includes(opt.id)
        );

        profileContent += `**${question.text}**\n`;
        for (const option of selectedOptions) {
          profileContent += `✅ ${option.text}\n`;
        }
        profileContent += '\n';
      }

      // Create thread
      let thread;
      if (formMessage) {
        const threadName = form.thread_name_template
          .replace('{username}', user.user.username)
          .replace('{displayName}', user.displayName)
          .slice(0, 100);
        
        thread = await formMessage.startThread({
          name: threadName,
          autoArchiveDuration: 1440, // 24 hours
        });
      } else {
        // Fallback: create thread from channel
        const threadName = form.thread_name_template
          .replace('{username}', user.user.username)
          .replace('{displayName}', user.displayName)
          .slice(0, 100);
        
        thread = await channel.threads.create({
          name: threadName,
          autoArchiveDuration: 1440,
        });
      }

      // Post profile in thread
      const threadMessage = await thread.send(profileContent);

      // Update response
      await this.supabase
        .from('user_profiles_responses')
        .update({
          status: 'completed',
          thread_id: thread.id,
          thread_message_id: threadMessage.id,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', response.id);

      return { thread, threadMessage };
    } catch (error) {
      console.error('Error submitting profile:', error);
      throw error;
    }
  }

  /**
   * Update form message with current selections (visual feedback)
   */
  async updateFormMessage(formId, userId) {
    try {
      const form = await this.getForm(formId);
      if (!form || !form.message_id) {
        return null;
      }

      const response = await this.getUserResponse(formId, userId);
      const selectedOptions = response?.responses || {};

      // Get channel and message
      const guild = this.client.guilds.cache.get(form.guild_id);
      if (!guild) return null;

      const channel = await guild.channels.fetch(form.channel_id).catch(() => null);
      if (!channel) return null;

      const message = await channel.messages.fetch(form.message_id).catch(() => null);
      if (!message) return null;

      // Rebuild components with visual feedback
      const components = [];
      for (const question of form.questions) {
        const questionRow = new ActionRowBuilder();
        const questionSelections = selectedOptions[question.id] || [];
        
        for (const option of question.options) {
          const isSelected = questionSelections.includes(option.id);
          const button = new ButtonBuilder()
            .setCustomId(`profile_checkbox_${form.id}_${question.id}_${option.id}`)
            .setLabel(option.text)
            .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(isSelected ? '☑️' : '☐');
          
          questionRow.addComponents(button);
        }
        components.push(questionRow);
      }

      // Add submit button
      const submitRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`profile_submit_${form.id}`)
            .setLabel('Submit Profile')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
        );
      components.push(submitRow);

      // Update message (only if components changed)
      await message.edit({
        components: components
      });

      return message;
    } catch (error) {
      console.error('Error updating form message:', error);
      return null;
    }
  }

  /**
   * Delete form
   */
  async deleteForm(formId) {
    const { error } = await this.supabase
      .from('user_profiles_forms')
      .delete()
      .eq('id', formId);

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }
}

module.exports = UserProfileManager;

