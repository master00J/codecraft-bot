import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const supabase = supabaseAdmin;

const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:3002';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
// Apply link in Discord embed: always point to production so the button works from any deployment
const APPLY_BASE_URL = process.env.PUBLIC_APP_URL || 'https://codecraft-solutions.com';

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

    // Get all application types (configs) for this guild
    const { data: configs, error } = await supabase
      .from('application_configs')
      .select('*')
      .eq('guild_id', guildId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching application configs:', error);
      return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
    }

    const list = configs || [];
    return NextResponse.json({
      config: list[0] || null,
      configs: list
    });
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
      id: configId,
      name: configName,
      channel_id,
      review_channel_id,
      questions,
      enabled,
      min_age,
      cooldown_days,
      require_account_age_days,
      auto_thread,
      ping_role_id,
      reward_role_id,
      reward_role_ids,
      embed_description
    } = body;

    if (!channel_id || !questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const name = (configName || 'Staff').trim() || 'Staff';
    const updateData = {
      channel_id,
      review_channel_id: review_channel_id ?? null,
      questions,
      enabled: enabled ?? true,
      min_age: min_age ?? 0,
      cooldown_days: cooldown_days ?? 7,
      require_account_age_days: require_account_age_days ?? 0,
      auto_thread: auto_thread ?? false,
      ping_role_id: ping_role_id ?? null,
      reward_role_id: reward_role_id ?? null,
      reward_role_ids: Array.isArray(reward_role_ids) && reward_role_ids.length > 0
        ? reward_role_ids.filter((id: unknown) => typeof id === 'string' && id.trim())
        : null,
      embed_description: typeof embed_description === 'string' ? embed_description.trim() || null : null,
      updated_at: new Date().toISOString()
    };

    let config;
    let err;

    if (configId) {
      const result = await supabase
        .from('application_configs')
        .update({ ...updateData, name })
        .eq('id', configId)
        .eq('guild_id', guildId)
        .select()
        .single();
      config = result.data;
      err = result.error;
    } else {
      const result = await supabase
        .from('application_configs')
        .upsert(
          { guild_id: guildId, name, ...updateData },
          { onConflict: 'guild_id,name' }
        )
        .select()
        .single();
      config = result.data;
      err = result.error;
    }

    if (err) {
      console.error('Error saving application config:', err);
      return NextResponse.json({
        error: 'Failed to save config',
        details: err.message
      }, { status: 500 });
    }

    // Log activity
    await logActivity(
      guildId,
      userId,
      'application_config_updated',
      'Updated staff application configuration'
    );

    // Send application message to Discord channel – link button to web form (no token limit for questions/answers)
    try {
      if (channel_id && enabled && config && COMCRAFT_BOT_API && INTERNAL_SECRET) {
        const roleName = config.name || name || 'Staff';
        const defaultDesc = `Use the button below to apply for **${roleName}**. You will fill in the form on our website (no character limits).`;
        const customDesc = (config.embed_description || '').trim();
        const description = customDesc
          ? `${defaultDesc}\n\n${customDesc}`.slice(0, 4096)
          : defaultDesc;
        const embed = {
          title: `📝 Apply for: ${roleName}`,
          description,
          color: '#5865F2',
          fields: [
            {
              name: '⏱️ Cooldown',
              value: `${cooldown_days} day(s) between applications`,
              inline: true
            },
            {
              name: '❓ Questions',
              value: `${questions.length} question(s)`,
              inline: true
            }
          ],
          footer: {
            text: `Applications for ${roleName} will be reviewed by the staff team`
          },
          timestamp: new Date().toISOString()
        };

        const applyUrl = `${APPLY_BASE_URL}/comcraft/apply/${guildId}?config=${config.id}`;
        const components = [
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 5, // Link
                label: `Apply: ${roleName}`.substring(0, 80),
                emoji: { name: '📝' },
                url: applyUrl
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
