const { createClient } = require('@supabase/supabase-js');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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
        if (!question.id || !question.text) {
          throw new Error('Each question must have an id and text');
        }
        
        const questionType = question.type || 'dropdown';
        
        if (questionType === 'dropdown') {
          if (!Array.isArray(question.options) || question.options.length === 0) {
            throw new Error('Dropdown questions must have at least one option');
          }
          for (const option of question.options) {
            if (!option.id || !option.text) {
              throw new Error('Each option must have an id and text');
            }
          }
        }
        // Text and number types don't require options
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

      // Build components with select menus, buttons for text/number inputs
      const components = [];

      // Discord limits: max 5 action rows total (including submit button)
      // Max 25 options per select menu
      // Max 5 buttons per row
      const MAX_OPTIONS_PER_MENU = 25;
      const MAX_BUTTONS_PER_ROW = 5;
      let remainingRows = 4; // Leave room for submit button
      
      for (let i = 0; i < form.questions.length && remainingRows > 0; i++) {
        const question = form.questions[i];
        const questionType = question.type || 'dropdown';
        
        if (questionType === 'dropdown') {
          // Dropdown type - use select menus
          if (!question.options || question.options.length === 0) continue;

          // Split options into chunks of 25 if needed
          const optionChunks = [];
          for (let j = 0; j < question.options.length; j += MAX_OPTIONS_PER_MENU) {
            optionChunks.push(question.options.slice(j, j + MAX_OPTIONS_PER_MENU));
          }

          // Create a select menu for each chunk
          for (let chunkIndex = 0; chunkIndex < optionChunks.length && remainingRows > 0; chunkIndex++) {
            const chunk = optionChunks[chunkIndex];
            
            const menuOptions = chunk.map(option => {
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

            // Create placeholder text indicating which part this is (if multiple chunks)
            let placeholder = question.text.length > 100 ? question.text.substring(0, 97) + '...' : question.text;
            if (optionChunks.length > 1) {
              placeholder = `${placeholder} (Part ${chunkIndex + 1}/${optionChunks.length})`;
            }
            placeholder = placeholder.length > 100 ? placeholder.substring(0, 97) + '...' : placeholder;

            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId(`profile_select:${form.id}:${question.id}:${chunkIndex}`)
              .setPlaceholder(`Select options: ${placeholder}`)
              .setMinValues(0)
              .setMaxValues(menuOptions.length)
              .addOptions(menuOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            components.push(row);
            remainingRows--;
          }
        } else if (questionType === 'text' || questionType === 'number') {
          // Text/Number type - use button to open modal
          if (remainingRows <= 0) break;
          
          if (!question.text) {
            console.warn(`[Profile Manager] Question ${question.id || i} has no text, skipping`);
            continue;
          }
          
          const buttonLabel = question.text.length > 80 
            ? question.text.substring(0, 77) + '...' 
            : question.text;
          
          const button = new ButtonBuilder()
            .setCustomId(`profile_input:${form.id}:${question.id}`)
            .setLabel(buttonLabel)
            .setStyle(ButtonStyle.Primary);
          
          // Try to add to existing row if there's space, otherwise create new row
          let addedToRow = false;
          if (components.length > 0) {
            const lastRow = components[components.length - 1];
            const lastRowComponents = lastRow.components || [];
            if (lastRowComponents.length < MAX_BUTTONS_PER_ROW && lastRowComponents[0]?.type === ComponentType.Button) {
              lastRow.addComponents(button);
              addedToRow = true;
            }
          }
          
          if (!addedToRow) {
            const row = new ActionRowBuilder().addComponents(button);
            components.push(row);
            remainingRows--;
          }
        }
      }

      // Add submit button (always last)
      const submitRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`profile_submit:${form.id}`)
            .setLabel('Submit')
            .setStyle(ButtonStyle.Success)
        );
      components.push(submitRow);

      // Validate we have at least one question
      if (components.length === 1) { // Only submit button
        throw new Error('Form must have at least one question with options.');
      }

      // Warn if questions were skipped due to Discord's 5 action row limit
      const totalQuestionsUsed = components.length - 1; // Subtract submit button row
      if (form.questions && form.questions.length > 0) {
        // Count how many questions we could fit
        let questionsFitted = 0;
        let rowsUsed = 0;
        for (let i = 0; i < form.questions.length && rowsUsed < 4; i++) {
          const question = form.questions[i];
          const questionType = question.type || 'dropdown';
          
          let rowsNeeded = 1; // Default: 1 row per question
          
          if (questionType === 'dropdown') {
            if (!question.options || question.options.length === 0) continue;
            const optionChunks = Math.ceil(question.options.length / MAX_OPTIONS_PER_MENU);
            rowsNeeded = optionChunks;
          } else if (questionType === 'text' || questionType === 'number') {
            // Text/number questions take 1 row (but might be combined with buttons)
            rowsNeeded = 1;
          }
          
          if (rowsUsed + rowsNeeded <= 4) {
            questionsFitted++;
            rowsUsed += rowsNeeded;
          } else {
            break;
          }
        }
        
        if (questionsFitted < form.questions.length) {
          console.warn(`[Profile Manager] Form has ${form.questions.length} questions, but only ${questionsFitted} could fit within Discord's 5 action row limit (4 for questions + 1 for submit button). Remaining questions will not be displayed.`);
        }
      }

      console.log(`[Profile Manager] Sending message with ${components.length} action rows (${totalQuestionsUsed} question menus + submit button)`);

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
      console.error('[Profile Manager] Error fetching form:', error);
      return null;
    }

    // Ensure questions is always an array
    if (form.questions && !Array.isArray(form.questions)) {
      console.warn('[Profile Manager] Form questions is not an array, attempting to parse:', typeof form.questions);
      try {
        form.questions = typeof form.questions === 'string' ? JSON.parse(form.questions) : [];
      } catch (parseError) {
        console.error('[Profile Manager] Failed to parse questions:', parseError);
        form.questions = [];
      }
    } else if (!form.questions) {
      form.questions = [];
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
   * Update text/number input response for a question
   * @param {string} formId - Form ID
   * @param {string} questionId - Question ID
   * @param {string} inputValue - The text/number value entered by the user
   * @param {string} userId - User ID
   */
  async updateInputResponse(formId, questionId, inputValue, userId) {
    try {
      const form = await this.getForm(formId);
      if (!form) {
        throw new Error('Form not found');
      }

      // Get or create user response
      const response = await this.getOrCreateResponse(formId, form.guild_id, userId);

      // Update responses object
      const responses = response.responses || {};
      responses[questionId] = inputValue; // For text/number, store as string

      // Update in database
      const { error } = await this.supabase
        .from('user_profiles_responses')
        .update({
          responses: responses,
          updated_at: new Date().toISOString()
        })
        .eq('id', response.id);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('[Profile Manager] Error updating input response:', error);
      throw error;
    }
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
        throw new Error('No response found. Please fill out the form first.');
      }

      // Check if there are any answers (dropdown selections, text, or number inputs)
      const hasAnswers = Object.values(response.responses).some(
        value => {
          // Check if it's an array (dropdown) with items, or a string (text/number) with content
          if (Array.isArray(value)) {
            return value.length > 0;
          } else if (typeof value === 'string') {
            return value.trim().length > 0;
          }
          return false;
        }
      );
      
      if (!hasAnswers) {
        throw new Error('Please answer at least one question before submitting.');
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
        const questionType = question.type || 'dropdown';
        const questionResponse = response.responses[question.id];
        
        // Skip if no answer
        if (!questionResponse) {
          continue;
        }

        let answerText = '';

        if (questionType === 'dropdown') {
          // Dropdown type - response is array of option IDs
          const selectedOptionIds = Array.isArray(questionResponse) ? questionResponse : [];
          if (selectedOptionIds.length === 0) {
            continue; // Skip unanswered questions
          }

          const selectedOptions = (question.options || []).filter(opt => 
            selectedOptionIds.includes(opt.id)
          );

          // Join all selected options with comma
          answerText = selectedOptions
            .map(opt => opt.text)
            .join(', ');
        } else if (questionType === 'text' || questionType === 'number') {
          // Text/Number type - response is a string
          if (typeof questionResponse === 'string' && questionResponse.trim().length > 0) {
            answerText = questionResponse;
          } else {
            continue; // Skip empty answers
          }
        }

        if (answerText) {
          answerFields.push({
            name: question.text,
            value: answerText.length > 1024 ? answerText.substring(0, 1021) + '...' : answerText,
            inline: false
          });
        }
      }

      // Add User Answer section as a field with separator
      if (answerFields.length > 0) {
        embed.addFields({ name: '\u200B', value: '**User Answer**', inline: false });
        embed.addFields(...answerFields);
      }

      embed.setTimestamp(completedAt);

      // Get or create shared thread for this form
      let thread;
      
      // Check if form already has a thread_id stored (user-selected or previously created)
      if (form.thread_id) {
        try {
          // Try to fetch existing thread
          thread = await channel.threads.fetch(form.thread_id);
          if (!thread) {
            // Thread doesn't exist anymore
            console.log(`[Profile Manager] Thread ${form.thread_id} no longer exists`);
            // Only clear thread_id if it wasn't user-selected (we'll create new thread below)
            // For user-selected threads, we assume they want to keep trying to use it
            // But if it doesn't exist, we'll create a new one
          }
        } catch (error) {
          // Thread not found
          console.log(`[Profile Manager] Could not fetch thread ${form.thread_id}:`, error.message);
          // Thread might be archived or deleted, we'll create a new one
          thread = null;
        }
      }
      
      // If no thread exists yet (or thread was not found), create one
      if (!thread) {
        // Use a generic name for the shared thread (remove user-specific template)
        const threadName = (form.thread_name_template || 'User Profiles')
          .replace('{username}', 'Profiles')
          .replace('{displayName}', 'Profiles')
          .replace(/Profile$/, 'Profiles') // Change singular to plural if needed
          .slice(0, 100);
        
        if (formMessage && !formMessage.thread) {
          // Try to start thread from form message (first submission)
          try {
            thread = await formMessage.startThread({
              name: threadName,
              autoArchiveDuration: 1440, // 24 hours
            });
            console.log(`[Profile Manager] Created shared thread from form message: ${thread.id}`);
          } catch (error) {
            // If startThread fails, create thread in channel
            console.log(`[Profile Manager] Could not start thread from message, creating in channel instead:`, error.message);
            thread = await channel.threads.create({
              name: threadName,
              autoArchiveDuration: 1440,
            });
            console.log(`[Profile Manager] Created shared thread in channel: ${thread.id}`);
          }
        } else {
          // No form message or message already has thread, create thread in channel
          thread = await channel.threads.create({
            name: threadName,
            autoArchiveDuration: 1440,
          });
          console.log(`[Profile Manager] Created shared thread in channel: ${thread.id}`);
        }
        
        // Save thread_id to form
        await this.supabase
          .from('user_profiles_forms')
          .update({ thread_id: thread.id })
          .eq('id', formId);
      } else {
        console.log(`[Profile Manager] Using existing shared thread: ${thread.id}`);
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
      const { error: insertError } = await this.supabase
        .from('user_profiles_responses')
        .insert({
          form_id: formId,
          guild_id: form.guild_id,
          user_id: userId,
          responses: {},
          status: 'in_progress'
        });
      
      if (insertError) {
        // Ignore error if insert fails (might be duplicate, but that's ok)
        console.warn('Could not create new response for next submission:', insertError.message);
      }

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

      if (!form.questions || !Array.isArray(form.questions)) {
        console.warn(`[Profile Manager] Form ${formId} has no questions array, skipping update`);
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

      // Rebuild components (same logic as postFormMessage, but show current values)
      const components = [];
      const MAX_OPTIONS_PER_MENU = 25;
      const MAX_BUTTONS_PER_ROW = 5;
      let remainingRows = 4; // Leave room for submit button

      for (let i = 0; i < form.questions.length && remainingRows > 0; i++) {
        const question = form.questions[i];
        const questionType = question.type || 'dropdown';
        const questionValue = selectedOptions[question.id];
        
        if (questionType === 'dropdown') {
          // Dropdown type
          if (!question.options || question.options.length === 0) continue;
          
          const questionSelections = Array.isArray(questionValue) ? questionValue : [];

          // Split options into chunks of 25 if needed
          const optionChunks = [];
          for (let j = 0; j < question.options.length; j += MAX_OPTIONS_PER_MENU) {
            optionChunks.push(question.options.slice(j, j + MAX_OPTIONS_PER_MENU));
          }

          // Create a select menu for each chunk
          for (let chunkIndex = 0; chunkIndex < optionChunks.length && remainingRows > 0; chunkIndex++) {
            const chunk = optionChunks[chunkIndex];
            
            const menuOptions = chunk.map(option => {
              const label = option.text.length > 100 ? option.text.substring(0, 97) + '...' : option.text;
              const description = option.description 
                ? (option.description.length > 100 ? option.description.substring(0, 97) + '...' : option.description)
                : undefined;
              
              const menuOption = new StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setValue(`${question.id}:${option.id}`)
                .setDefault(questionSelections.includes(option.id));
              
              if (description) {
                menuOption.setDescription(description);
              }
              
              return menuOption;
            });

            if (menuOptions.length === 0) continue;

            let placeholder = question.text.length > 100 ? question.text.substring(0, 97) + '...' : question.text;
            if (optionChunks.length > 1) {
              placeholder = `${placeholder} (Part ${chunkIndex + 1}/${optionChunks.length})`;
            }
            placeholder = placeholder.length > 100 ? placeholder.substring(0, 97) + '...' : placeholder;

            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId(`profile_select:${form.id}:${question.id}:${chunkIndex}`)
              .setPlaceholder(`Select options: ${placeholder}`)
              .setMinValues(0)
              .setMaxValues(menuOptions.length)
              .addOptions(menuOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            components.push(row);
            remainingRows--;
          }
        } else if (questionType === 'text' || questionType === 'number') {
          // Text/Number type - show button with value indicator
          if (remainingRows <= 0) break;
          
          let buttonLabel = question.text.length > 80 
            ? question.text.substring(0, 77) + '...' 
            : question.text;
          
          // Add value indicator if filled
          if (questionValue && typeof questionValue === 'string') {
            const valuePreview = questionValue.length > 20 
              ? questionValue.substring(0, 17) + '...' 
              : questionValue;
            buttonLabel = `${buttonLabel}${valuePreview ? `: ${valuePreview}` : ''}`;
            buttonLabel = buttonLabel.length > 80 ? buttonLabel.substring(0, 77) + '...' : buttonLabel;
          }
          
          const button = new ButtonBuilder()
            .setCustomId(`profile_input:${form.id}:${question.id}`)
            .setLabel(buttonLabel)
            .setStyle(questionValue ? ButtonStyle.Success : ButtonStyle.Primary);
          
          // Try to add to existing row if there's space
          let addedToRow = false;
          if (components.length > 0) {
            const lastRow = components[components.length - 1];
            const lastRowComponents = lastRow.components || [];
            if (lastRowComponents.length < MAX_BUTTONS_PER_ROW && lastRowComponents[0]?.type === ComponentType.Button) {
              lastRow.addComponents(button);
              addedToRow = true;
            }
          }
          
          if (!addedToRow) {
            const row = new ActionRowBuilder().addComponents(button);
            components.push(row);
            remainingRows--;
          }
        }
      }

      // Add submit button
      const submitRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`profile_submit:${form.id}`)
            .setLabel('Submit')
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
      const questionType = question.type || 'dropdown';
      const questionResponse = response.responses[question.id];
      
      // Skip if no answer
      if (!questionResponse) {
        continue;
      }

      let answerText = '';

      if (questionType === 'dropdown') {
        // Dropdown type - response is array of option IDs
        const selectedOptionIds = Array.isArray(questionResponse) ? questionResponse : [];
        if (selectedOptionIds.length === 0) {
          continue; // Skip unanswered questions
        }

        const selectedOptions = (question.options || []).filter(opt => 
          selectedOptionIds.includes(opt.id)
        );

        answerText = selectedOptions
          .map(opt => opt.text)
          .join(', ');
      } else if (questionType === 'text' || questionType === 'number') {
        // Text/Number type - response is a string
        if (typeof questionResponse === 'string' && questionResponse.trim().length > 0) {
          answerText = questionResponse;
        } else {
          continue; // Skip empty answers
        }
      }

      if (answerText) {
        answerFields.push({
          name: question.text,
          value: answerText.length > 1024 ? answerText.substring(0, 1021) + '...' : answerText,
          inline: false
        });
      }
    }

    if (answerFields.length > 0) {
      embed.addFields({ name: '\u200B', value: '**User Answer**', inline: false });
      embed.addFields(...answerFields);
    } else {
      embed.setDescription('*No answers provided*');
    }

    // Link to the shared thread (all profiles are in the same thread)
    if (form.thread_id && form.channel_id) {
      embed.addFields({
        name: '🔗 Profile Thread',
        value: `[View All Profiles](https://discord.com/channels/${form.guild_id}/${form.channel_id}/${form.thread_id})`,
        inline: false
      });
    }

    embed.setTimestamp(response.completed_at ? new Date(response.completed_at) : new Date());

    return embed;
  }

  /**
   * Create a modal for text/number input questions
   */
  createInputModal(formId, questionId, question) {
    const questionType = question.type || 'text';
    const modal = new ModalBuilder()
      .setCustomId(`profile_modal:${formId}:${questionId}`)
      .setTitle(question.text.length > 45 ? question.text.substring(0, 42) + '...' : question.text);

    let inputStyle = TextInputStyle.Short;
    let inputPlaceholder = question.placeholder || (questionType === 'number' ? 'Enter a number' : 'Enter your answer');
    let inputLabel = question.text.length > 45 ? question.text.substring(0, 42) + '...' : question.text;
    
    // Use Paragraph style for longer text fields
    if (questionType === 'text' && (question.maxLength > 100 || !question.maxLength)) {
      inputStyle = TextInputStyle.Paragraph;
    }

    const textInput = new TextInputBuilder()
      .setCustomId('input_value')
      .setLabel(inputLabel)
      .setStyle(inputStyle)
      .setRequired(question.required || false);

    if (inputPlaceholder) {
      textInput.setPlaceholder(inputPlaceholder);
    }

    if (questionType === 'text') {
      if (question.minLength) {
        // Note: Discord modals don't support minLength validation, we'll validate in handler
        textInput.setMinLength(question.minLength);
      }
      if (question.maxLength) {
        textInput.setMaxLength(Math.min(question.maxLength, 4000)); // Discord max is 4000
      }
    } else if (questionType === 'number') {
      // Note: Discord doesn't have a number input type, we'll validate in handler
      if (question.maxLength) {
        textInput.setMaxLength(Math.min(question.maxLength, 4000));
      }
    }

    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    return modal;
  }
}

module.exports = UserProfileManager;

