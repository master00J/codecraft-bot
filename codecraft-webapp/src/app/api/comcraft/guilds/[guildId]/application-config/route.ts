import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const supabase = supabaseAdmin;

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

/**
 * Log activity to database
 */
async function logActivity(guildId: string, userId: string, action: string, details: string) {
  try {
    await supabase.from('activity_logs').insert({
      guild_id: guildId,
      user_id: userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get config
    const { data: config, error } = await supabase
      .from('application_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching application config:', error);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    return NextResponse.json({ config: config || null });
  } catch (error) {
    console.error('Error in application-config GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user?.id || session.user?.sub || 'unknown';
    const body = await request.json();
    const { 
      channel_id, 
      questions, 
      enabled, 
      min_age, 
      cooldown_days, 
      require_account_age_days, 
      auto_thread,
      ping_role_id 
    } = body;

    if (!channel_id || !questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from('application_configs')
      .select('guild_id')
      .eq('guild_id', guildId)
      .maybeSingle();

    const updateData = {
      channel_id,
      questions,
      enabled: enabled ?? true,
      min_age: min_age ?? 0,
      cooldown_days: cooldown_days ?? 7,
      require_account_age_days: require_account_age_days ?? 0,
      auto_thread: auto_thread ?? false,
      ping_role_id: ping_role_id ?? null,
      updated_at: new Date().toISOString()
    };

    let config;
    let error;

    if (existingConfig) {
      // Update existing config
      const result = await supabase
        .from('application_configs')
        .update(updateData)
        .eq('guild_id', guildId)
        .select()
        .single();
      
      config = result.data;
      error = result.error;
    } else {
      // Create new config
      const result = await supabase
        .from('application_configs')
        .insert({
          guild_id: guildId,
          ...updateData
        })
        .select()
        .single();
      
      config = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error saving application config:', error);
      return NextResponse.json({ 
        error: 'Failed to save config',
        details: error.message 
      }, { status: 500 });
    }

    // Log activity
    await logActivity(
      guildId,
      userId,
      'application_config_updated',
      'Updated staff application configuration'
    );

    // Send application message to Discord channel with Apply button
    try {
      if (channel_id && enabled && COMCRAFT_BOT_API && INTERNAL_SECRET) {
        const embed = {
          title: '📝 Staff Applications',
          description: 'Interesse om moderator te worden? Solliciteer hier!',
          color: '#5865F2',
          fields: [
            {
              name: '📋 Hoe werkt het?',
              value: 'Klik op de knop hieronder om te solliciteren. Je krijgt een formulier met vragen die je moet invullen.',
              inline: false
            },
            {
              name: '⏱️ Cooldown',
              value: `${cooldown_days} dag(en) tussen sollicitaties`,
              inline: true
            },
            {
              name: '❓ Vragen',
              value: `${questions.length} vraag(en)`,
              inline: true
            }
          ],
          footer: {
            text: 'Je sollicitatie wordt beoordeeld door het staff team'
          },
          timestamp: new Date().toISOString()
        };

        // Create Apply button in Discord format
        const components = [
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 1, // Primary
                label: 'Solliciteer Nu',
                emoji: {
                  name: '📝'
                },
                custom_id: 'application_apply_button'
              }
            ]
          }
        ];

        // Use the embeds/post endpoint to send the message with button
        const botResponse = await fetch(`${COMCRAFT_BOT_API}/api/embeds/post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': INTERNAL_SECRET
          },
          body: JSON.stringify({
            guildId,
            channelId: channel_id,
            isCapsule: false,
            embed: embed,
            components: components
          })
        }).catch((err) => {
          console.error('Error sending application message to Discord:', err);
          return null;
        });

        if (!botResponse || !botResponse.ok) {
          console.warn('Failed to send application message to Discord channel');
        }
      }
    } catch (error) {
      // Don't fail the request if Discord message fails
      console.error('Error sending Discord message:', error);
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error in application-config POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
