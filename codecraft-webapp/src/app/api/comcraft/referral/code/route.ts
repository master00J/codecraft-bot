import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/comcraft/referral/code
 * Get or create user's referral code
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore - custom fields
    const discordId = session.user.discordId;
    // @ts-ignore - custom fields
    const discordTag = session.user.discordTag || session.user.name || 'User';
    
    if (!discordId) {
      return NextResponse.json({ error: 'Missing Discord ID' }, { status: 401 });
    }

    // Check if user already has a referral code
    const { data: existingCode, error: fetchError } = await supabaseAdmin
      .from('referral_codes')
      .select('*')
      .eq('discord_id', discordId)
      .single();

    if (existingCode) {
      return NextResponse.json({ 
        success: true, 
        code: existingCode 
      });
    }

    // Generate new referral code
    const { data: generatedCode } = await supabaseAdmin
      .rpc('generate_referral_code', { p_discord_tag: discordTag });

    if (!generatedCode) {
      return NextResponse.json(
        { error: 'Failed to generate referral code' }, 
        { status: 500 }
      );
    }

    // Get user ID if exists
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    // Create new referral code
    const { data: newCode, error: insertError } = await supabaseAdmin
      .from('referral_codes')
      .insert({
        user_id: user?.id || null,
        discord_id: discordId,
        code: generatedCode,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating referral code:', insertError);
      return NextResponse.json(
        { error: 'Failed to create referral code' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      code: newCode 
    });

  } catch (error) {
    console.error('Error in referral code API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/comcraft/referral/code
 * Update referral code (e.g., regenerate)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore - custom fields
    const discordId = session.user.discordId;
    
    if (!discordId) {
      return NextResponse.json({ error: 'Missing Discord ID' }, { status: 401 });
    }
    
    const body = await request.json();
    const { action } = body;

    if (action === 'regenerate') {
      // @ts-ignore - custom fields
      const discordTag = session.user.discordTag || session.user.name || 'User';

      // Generate new code
      const { data: generatedCode } = await supabaseAdmin
        .rpc('generate_referral_code', { p_discord_tag: discordTag });

      if (!generatedCode) {
        return NextResponse.json(
          { error: 'Failed to generate new code' }, 
          { status: 500 }
        );
      }

      // Update existing code
      const { data: updatedCode, error: updateError } = await supabaseAdmin
        .from('referral_codes')
        .update({ code: generatedCode, updated_at: new Date().toISOString() })
        .eq('discord_id', discordId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating referral code:', updateError);
        return NextResponse.json(
          { error: 'Failed to update code' }, 
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true, 
        code: updatedCode 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error updating referral code:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

