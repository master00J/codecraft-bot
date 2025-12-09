const { createClient } = require('@supabase/supabase-js');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
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
        .setDescription(form.description || 'Fill out your profile by selecting your answers from the dropdowns below, then click "Submit Profile" when done.')
        .setFooter({ text: 'Use the dropdowns to select your answers, then click "Submit Profile" when done' })
        .setTimestamp();

      // Build components with select menus
      const components = [];

      // Discord limits: max 5 action rows (one per question + submit button)
      // Max 25 options per select menu
      const MAX_QUESTIONS = 4; // Leave room for submit button
      
      for (let i = 0; i < Math.min(form.questions.length, MAX_QUESTIONS); i++) {
        const question = form.questions[i];
        
        // Discord select menu max: 25 options per menu
        if (question.options.length > 25) {
          console.warn(`[Profile Manager] Question "${question.text}" has ${question.options.length} options, but Discord limits select menus to 25. Only the first 25 will be shown.`);
        }
        
        const menuOptions = question.options.slice(0, 25).map(option => {
          const label = option.text.length > 100 ? option.text.substring(0, 97) + '...' : option.text;
          const description = option.description 
            ? (option.description.length > 100 ? option.description.substring(0, 97) + '...' : option.description)
            : undefined;
          
          const menuOption = new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(`${question.id}:${option.id}`); // Format: questionId:optionId
          
          if (description) {
            menuOption.setDescription(description);
          }
          
          return menuOption;
        });

        if (menuOptions.length === 0) continue;

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`profile_select:${form.id}:${question.id}`)
          .setPlaceholder(`Select options for: ${question.text.length > 100 ? question.text.substring(0, 97) + '...' : question.text}`)
          .setMinValues(0) // Allow deselecting all
          .setMaxValues(menuOptions.length) // Allow selecting all options
          .addOptions(menuOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        components.push(row);
      }

      // Add submit button (always last)
      const submitRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`profile_submit:${form.id}`)
            .setLabel('Submit Profile')
            .setStyle(ButtonStyle.Success)
        );
      components.push(submitRow);

      // Validate we have at least one question
      if (components.length === 1) { // Only submit button
        throw new Error('Form must have at least one question with options.');
      }

      // Warn if questions were skipped
      if (form.questions.length > MAX_QUESTIONS) {
        console.warn(`[Profile Manager] Form has ${form.questions.length} questions, but only ${MAX_QUESTIONS} are supported. Skipping remaining questions.`);
      }

      console.log(`[Profile Manager] Sending message with ${components.length} action rows (${components.length - 1} questions + submit button)`);

      // Check if form already has a message posted
      let message;
      if (form.message_id) {
        try {
          // Try to fetch and update existing message
          const existingMessage = await channel.messages.fetch(form.message_id).catch(() => null);
          if (existingMessage) {
            console.log(`[Profile Manager] Updating existing message ${form.message_id}`);
            await existingMessage.edit({
              embeds: [embed],
              components: components
            });
            message = existingMessage;
            console.log(`[Profile Manager] Message updated successfully: ${message.id}`);
          } else {
            // Message doesn't exist anymore, create new one
            console.log(`[Profile Manager] Existing message ${form.message_id} not found, creating new message`);
            message = await channel.send({
              embeds: [embed],
              components: components
            });
            console.log(`[Profile Manager] New message sent successfully: ${message.id}`);
            
            // Update form with new message ID
            await this.supabase
              .from('user_profiles_forms')
              .update({ message_id: message.id })
              .eq('id', form.id);
          }
        } catch (error) {
          // If update fails, create a new message
          console.warn(`[Profile Manager] Failed to update existing message, creating new one:`, error.message);
          message = await channel.send({
            embeds: [embed],
            components: components
          });
          console.log(`[Profile Manager] New message sent successfully: ${message.id}`);
          
          // Update form with new message ID
          await this.supabase
            .from('user_profiles_forms')
            .update({ message_id: message.id })
            .eq('id', form.id);
        }
      } else {
        // No existing message, create new one
        message = await channel.send({
          embeds: [embed],
          components: components
        });
        console.log(`[Profile Manager] Message sent successfully: ${message.id}`);

        // Update form with message ID
        await this.supabase
          .from('user_profiles_forms')
          .update({ message_id: message.id })
          .eq('id', form.id);
      }

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
      .select('*')
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
   * Returns the most recent in_progress response, or creates a new one
   */
  async getOrCreateResponse(formId, guildId, userId) {
    // First try to get the most recent in_progress response
    const { data: existingResponses } = await this.supabase
      .from('user_profiles_responses')
      .select('*')
      .eq('form_id', formId)
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingResponses && existingResponses.length > 0) {
      return existingResponses[0];
    }

    // No in_progress response found, create a new one
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
   * Update select menu selections for a question
   * @param {string} formId - Form ID
   * @param {string} questionId - Question ID
   * @param {string[]} selectedValues - Array of values in format "questionId:optionId"
   * @param {string} userId - User ID
   */
  async updateSelectMenuSelections(formId, questionId, selectedValues, userId) {
    try {
      const form = await this.getForm(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      const response = await this.getOrCreateResponse(formId, form.guild_id, userId);

      if (!response) {
        throw new Error('Failed to get or create response');
      }

      const currentResponses = response.responses || {};
      
      // Parse selected values (format: questionId:optionId)
      // Filter to only include values that match the current questionId
      const selectedOptionIds = selectedValues
        .filter(value => {
          const parts = value.split(':');
          // Value format is questionId:optionId, so check if questionId matches
          return parts.length === 2 && parts[0] === questionId;
        })
        .map(value => {
          const parts = value.split(':');
          return parts[1]; // Return just the optionId
        });

      // Update responses for this question
      const updatedResponses = {
        ...currentResponses,
        [questionId]: selectedOptionIds
      };

      // Update response in database
      const { error } = await this.supabase
        .from('user_profiles_responses')
        .update({
          responses: updatedResponses,
          updated_at: new Date().toISOString()
        })
        .eq('id', response.id);

      if (error) {
        console.error('Error updating select menu selections in database:', error);
        throw new Error(error.message);
      }

      return updatedResponses;
    } catch (error) {
      console.error('Error updating select menu selections:', error);
      throw error;
    }
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
   * Returns the most recent in_progress response, or creates a new one if none exists
   */
  async getUserResponse(formId, userId) {
    // First try to get the most recent in_progress response
    const { data: responses, error } = await this.supabase
      .from('user_profiles_responses')
      .select('*')
      .eq('form_id', formId)
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1);

    if (responses && responses.length > 0) {
      return responses[0];
    }

    // If no in_progress response exists, try to get any response (for backwards compatibility)
    const { data: anyResponse, error: anyError } = await this.supabase
      .from('user_profiles_responses')
      .select('*')
      .eq('form_id', formId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (anyResponse) {
      return anyResponse;
    }

    return null;
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
      if (!response || !response.responses || Object.keys(response.responses).length === 0) {
        throw new Error('No response found. Please select some options first.');
      }

      // Check if there are any selected options
      const hasSelectedOptions = Object.values(response.responses).some(
        optionIds => Array.isArray(optionIds) && optionIds.length > 0
      );
      
      if (!hasSelectedOptions) {
        throw new Error('Please select at least one option before submitting.');
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

      // Calculate submission count (how many times this user has completed this form)
      const { count: submissionCount } = await this.supabase
        .from('user_profiles_responses')
        .select('*', { count: 'exact', head: true })
        .eq('form_id', formId)
        .eq('user_id', userId)
        .eq('status', 'completed');

      const currentSubmissionNumber = (submissionCount || 0) + 1;

      // Calculate duration (time spent filling out the form)
      const createdAt = new Date(response.created_at);
      const completedAt = new Date();
      const durationSeconds = Math.floor((completedAt - createdAt) / 1000);

      // Get ordinal suffix for submission number
      const getOrdinal = (n) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };

      // Build embed with user info and submission details
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: `${user.user.displayName} (${user.user.id})`,
          iconURL: user.user.displayAvatarURL({ dynamic: true, size: 256 })
        })
        .addFields(
          {
            name: '📊 Submission Info',
            value: 
              `**Count:** This is user ${getOrdinal(currentSubmissionNumber)} submission\n` +
              `**Duration:** Spent ${durationSeconds} seconds to answer\n` +
              `**Status:** Accepted by ${user.user.displayName} (${user.user.id}) <t:${Math.floor(completedAt.getTime() / 1000)}:R>`,
            inline: false
          }
        );

      // Build User Answer section
      let answerFields = [];
      for (const question of form.questions) {
        const selectedOptionIds = response.responses[question.id] || [];
        if (selectedOptionIds.length === 0) {
          continue; // Skip unanswered questions
        }

        const selectedOptions = question.options.filter(opt => 
          selectedOptionIds.includes(opt.id)
        );

        // Join all selected options with comma, or show single option
        const answerText = selectedOptions
          .map(opt => opt.text)
          .join(', ');

        answerFields.push({
          name: question.text,
          value: answerText,
          inline: false
        });
      }

      // Add User Answer section as a field with separator
      if (answerFields.length > 0) {
        embed.addFields({ name: '\u200B', value: '**User Answer**', inline: false });
        embed.addFields(...answerFields);
      }

      embed.setTimestamp(completedAt);

      // Create thread
      let thread;
      const threadName = form.thread_name_template
        .replace('{username}', user.user.username)
        .replace('{displayName}', user.displayName)
        .slice(0, 100);
      
      if (formMessage) {
        // Check if message already has a thread
        try {
          // Try to fetch existing thread if any
          if (formMessage.thread) {
            // Message already has a thread, create new thread in channel instead
            console.log(`[Profile Manager] Message ${formMessage.id} already has a thread, creating new thread in channel`);
            thread = await channel.threads.create({
              name: threadName,
              autoArchiveDuration: 1440,
            });
          } else {
            // Try to start thread from message
            thread = await formMessage.startThread({
              name: threadName,
              autoArchiveDuration: 1440, // 24 hours
            });
          }
        } catch (error) {
          // If startThread fails (e.g., message already has thread), create thread in channel
          if (error.message && error.message.includes('thread')) {
            console.log(`[Profile Manager] Cannot start thread from message (already has thread), creating in channel instead`);
            thread = await channel.threads.create({
              name: threadName,
              autoArchiveDuration: 1440,
            });
          } else {
            throw error;
          }
        }
      } else {
        // No form message, create thread from channel
        thread = await channel.threads.create({
          name: threadName,
          autoArchiveDuration: 1440,
        });
      }

      // Post profile embed in thread
      const threadMessage = await thread.send({ embeds: [embed] });

      // Update response to completed
      await this.supabase
        .from('user_profiles_responses')
        .update({
          status: 'completed',
          thread_id: thread.id,
          thread_message_id: threadMessage.id,
          completed_at: completedAt.toISOString(),
          updated_at: completedAt.toISOString()
        })
        .eq('id', response.id);

      // Create a new in_progress response so user can submit again
      await this.supabase
        .from('user_profiles_responses')
        .insert({
          form_id: formId,
          guild_id: form.guild_id,
          user_id: userId,
          responses: {},
          status: 'in_progress'
        })
        .catch(err => {
          // Ignore error if insert fails (might be duplicate, but that's ok)
          console.warn('Could not create new response for next submission:', err.message);
        });

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

      // Rebuild components with select menus (showing current selections)
      const components = [];
      const MAX_QUESTIONS = 4;

      for (let i = 0; i < Math.min(form.questions.length, MAX_QUESTIONS); i++) {
        const question = form.questions[i];
        const questionSelections = selectedOptions[question.id] || [];
        
        // Build menu options with default values for selected ones
        const menuOptions = question.options.slice(0, 25).map(option => {
          const label = option.text.length > 100 ? option.text.substring(0, 97) + '...' : option.text;
          const description = option.description 
            ? (option.description.length > 100 ? option.description.substring(0, 97) + '...' : option.description)
            : undefined;
          
          const menuOption = new StringSelectMenuOptionBuilder()
            .setLabel(label)
            .setValue(`${question.id}:${option.id}`)
            .setDefault(questionSelections.includes(option.id)); // Show as selected if user has chosen it
          
          if (description) {
            menuOption.setDescription(description);
          }
          
          return menuOption;
        });

        if (menuOptions.length === 0) continue;

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`profile_select:${form.id}:${question.id}`)
          .setPlaceholder(`Select options for: ${question.text.length > 100 ? question.text.substring(0, 97) + '...' : question.text}`)
          .setMinValues(0)
          .setMaxValues(menuOptions.length)
          .addOptions(menuOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        components.push(row);
      }

      // Add submit button
      const submitRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`profile_submit:${form.id}`)
            .setLabel('Submit Profile')
            .setStyle(ButtonStyle.Success)
        );
      components.push(submitRow);

      // Update message with current selections
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

  /**
   * Get user's completed profile for a form
   * @param {string} formId - Form ID
   * @param {string} userId - User ID
   * @returns {Object|null} - The most recent completed response
   */
  async getUserProfile(formId, userId) {
    const { data: responses } = await this.supabase
      .from('user_profiles_responses')
      .select('*')
      .eq('form_id', formId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    if (responses && responses.length > 0) {
      return responses[0];
    }

    return null;
  }

  /**
   * Get all completed profiles for a form
   * @param {string} formId - Form ID
   * @param {number} limit - Maximum number of profiles to return
   * @returns {Array} - Array of completed responses
   */
  async getFormProfiles(formId, limit = 50) {
    const { data: responses } = await this.supabase
      .from('user_profiles_responses')
      .select('*')
      .eq('form_id', formId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(limit);

    return responses || [];
  }

  /**
   * Build profile embed for display
   * @param {Object} form - Form object
   * @param {Object} response - Response object
   * @param {Object} user - Discord user/member object
   * @returns {EmbedBuilder} - Discord embed
   */
  async buildProfileEmbed(form, response, user) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: `${user.user?.displayName || user.displayName || 'Unknown'} (${user.user?.id || user.id})`,
        iconURL: user.user?.displayAvatarURL?.({ dynamic: true, size: 256 }) || user.displayAvatarURL?.({ dynamic: true, size: 256 }) || undefined
      });

    // Calculate submission count and duration (same as in submitProfile)
    const { count: submissionCount } = await this.supabase
      .from('user_profiles_responses')
      .select('*', { count: 'exact', head: true })
      .eq('form_id', form.id)
      .eq('user_id', user.user?.id || user.id)
      .eq('status', 'completed')
      .lte('completed_at', response.completed_at || new Date().toISOString());

    const submissionNumber = submissionCount || 1;

    // Get ordinal suffix
    const getOrdinal = (n) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    // Calculate duration
    const createdAt = new Date(response.created_at);
    const completedAt = response.completed_at ? new Date(response.completed_at) : new Date();
    const durationSeconds = Math.floor((completedAt - createdAt) / 1000);

    // Add submission info (same format as in thread)
    if (response.completed_at) {
      embed.addFields({
        name: '📊 Submission Info',
        value: 
          `**Count:** This is user ${getOrdinal(submissionNumber)} submission\n` +
          `**Duration:** Spent ${durationSeconds} seconds to answer\n` +
          `**Status:** Accepted by ${user.user?.displayName || user.displayName || 'Unknown'} (${user.user?.id || user.id}) <t:${Math.floor(completedAt.getTime() / 1000)}:R>`,
        inline: false
      });
    }

    // Add User Answer section
    let answerFields = [];
    for (const question of form.questions) {
      const selectedOptionIds = response.responses[question.id] || [];
      if (selectedOptionIds.length === 0) {
        continue; // Skip unanswered questions
      }

      const selectedOptions = question.options.filter(opt => 
        selectedOptionIds.includes(opt.id)
      );

      const answerText = selectedOptions
        .map(opt => opt.text)
        .join(', ');

      answerFields.push({
        name: question.text,
        value: answerText || '*No answer*',
        inline: false
      });
    }

    if (answerFields.length > 0) {
      embed.addFields({ name: '\u200B', value: '**User Answer**', inline: false });
      embed.addFields(...answerFields);
    } else {
      embed.setDescription('*No answers provided*');
    }

    if (response.thread_id && form.channel_id) {
      embed.addFields({
        name: '🔗 Profile Thread',
        value: `[View Full Profile](https://discord.com/channels/${form.guild_id}/${form.channel_id}/${response.thread_id})`,
        inline: false
      });
    }

    embed.setTimestamp(response.completed_at ? new Date(response.completed_at) : new Date());

    return embed;
  }
}

module.exports = UserProfileManager;

