/**
 * Comcraft Feedback Queue Manager
 * Handles configuration and submissions for sample/feedback queues.
 */

const { createClient } = require('@supabase/supabase-js');

class FeedbackQueueManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async getConfig(guildId) {
    const { data, error } = await this.supabase
      .from('comcraft_feedback_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Feedback queue: error fetching config', error);
    }

    return data || null;
  }

  async setConfig(guildId, config) {
    try {
      const defaults = {
        channel_id: null,
        message_id: null,
        button_role_id: null,
        modal_title: 'Submit your sample for feedback',
        modal_link_label: 'Sample link',
        modal_notes_label: 'Feedback request',
        modal_notes_required: false,
        extra_fields: [],
        queue_embed_title: '🎧 Sample Feedback Queue',
        queue_embed_description: 'Click the button below to submit your sample for feedback.\n\n• Provide a Soundcloud, YouTube, Dropbox... link\n• Optionally add context (genre, type of feedback)\n• Moderators pick submissions in order during feedback sessions',
        queue_embed_color: '#8B5CF6',
        queue_embed_footer: 'ComCraft Feedback Queue',
        queue_embed_thumbnail: null,
        queue_embed_image: null,
        queue_button_label: '🎵 Sample indienen',
        queue_button_style: 'primary',
        queue_button_emoji: null,
        notification_channel_id: null,
        notification_ping_role: null,
        notification_message: '🔔 New submission from {{user}} waiting for feedback!',
        created_by: null
      };

      const existing = await this.getConfig(guildId) || {};
      const payload = {
        ...defaults,
        ...existing,
        guild_id: guildId,
        updated_at: new Date().toISOString()
      };

      const entries = Object.entries(config || {});
      for (const [key, value] of entries) {
        if (value === undefined) continue;
        payload[key] = value;
      }

      const { data, error } = await this.supabase
        .from('comcraft_feedback_configs')
        .upsert(payload, { onConflict: 'guild_id' })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Feedback queue: error saving config', error);
      return { success: false, error: error.message };
    }
  }

  async createSubmission(payload) {
    try {
      const { data, error } = await this.supabase
        .from('comcraft_feedback_submissions')
        .insert({
          guild_id: payload.guild_id,
          user_id: payload.user_id,
      username: payload.username,
      display_name: payload.display_name,
          sample_url: payload.sample_url,
          user_notes: payload.user_notes || null,
          metadata: payload.metadata || {}
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Feedback queue: error creating submission', error);
      return { success: false, error: error.message };
    }
  }

  async claimNextSubmission(guildId, moderatorId) {
    try {
      const { data: pending, error } = await this.supabase
        .from('comcraft_feedback_submissions')
        .select('*')
        .eq('guild_id', guildId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!pending) {
        return { success: true, data: null };
      }

      const { data: updated, error: updateError } = await this.supabase
        .from('comcraft_feedback_submissions')
        .update({
          status: 'in_progress',
          claimed_by: moderatorId,
          claimed_at: new Date().toISOString()
        })
        .eq('id', pending.id)
        .select()
        .single();

      if (updateError) throw updateError;
      return { success: true, data: updated };
    } catch (error) {
      console.error('Feedback queue: error claiming submission', error);
      return { success: false, error: error.message };
    }
  }

  async completeSubmission(guildId, submissionId, moderatorId, notes) {
    try {
      const { data, error } = await this.supabase
        .from('comcraft_feedback_submissions')
        .update({
          status: 'completed',
          completed_by: moderatorId,
          completed_at: new Date().toISOString(),
          moderator_notes: notes || null
        })
        .eq('guild_id', guildId)
        .eq('id', submissionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Feedback queue: error completing submission', error);
      return { success: false, error: error.message };
    }
  }

  async skipSubmission(guildId, submissionId, moderatorId, reason) {
    try {
      const { data, error } = await this.supabase
        .from('comcraft_feedback_submissions')
        .update({
          status: 'skipped',
          completed_by: moderatorId,
          completed_at: new Date().toISOString(),
          moderator_notes: reason || null
        })
        .eq('guild_id', guildId)
        .eq('id', submissionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Feedback queue: error skipping submission', error);
      return { success: false, error: error.message };
    }
  }

  async listPending(guildId, limit = 10) {
    const { data, error } = await this.supabase
      .from('comcraft_feedback_submissions')
      .select('*')
      .eq('guild_id', guildId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Feedback queue: error listing pending submissions', error);
      return [];
    }

    return data || [];
  }
}

module.exports = new FeedbackQueueManager();
