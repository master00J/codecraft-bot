/**
 * API Route: Individual Subscription Tier Management (Admin Only)
 * GET /api/admin/subscription-tiers/[tierId] - Get tier details
 * PATCH /api/admin/subscription-tiers/[tierId] - Update tier
 * DELETE /api/admin/subscription-tiers/[tierId] - Delete tier
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function checkAdminAccess() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { isAdmin: false, error: 'Unauthorized' };
  }

  const discordId = (session.user as any).discordId;
  
  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();

  if (!user?.is_admin) {
    return { isAdmin: false, error: 'Admin access required' };
  }

  return { isAdmin: true };
}

// GET - Get tier details
export async function GET(
  request: NextRequest,
  { params }: { params: { tierId: string } }
) {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const { data: tier, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', params.tierId)
      .single();

    if (tierError) throw tierError;

    return NextResponse.json({
      success: true,
      tier
    });

  } catch (error: any) {
    console.error('Error fetching tier:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tier', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update tier
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tierId: string } }
) {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const body = await request.json();
    
    const { data: tier, error: updateError } = await supabase
      .from('subscription_tiers')
      .update(body)
      .eq('id', params.tierId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Auto-sync tier knowledge for ComCraft server after tier update
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000';
      
      // Sync for ComCraft server (1435653730799190058)
      await fetch(`${baseUrl}/api/admin/sync-tier-knowledge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ guildId: '1435653730799190058' }),
      }).catch(err => {
        console.warn('[Tier Update] Failed to auto-sync tier knowledge:', err.message);
      });
    } catch (syncError) {
      // Don't fail the tier update if sync fails
      console.warn('[Tier Update] Tier knowledge sync error:', syncError);
    }

    return NextResponse.json({
      success: true,
      tier
    });

  } catch (error: any) {
    console.error('Error updating tier:', error);
    return NextResponse.json(
      { error: 'Failed to update tier', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete tier
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tierId: string } }
) {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    // Don't actually delete, just set inactive
    const { error: updateError } = await supabase
      .from('subscription_tiers')
      .update({ is_active: false })
      .eq('id', params.tierId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'Tier deactivated successfully'
    });

  } catch (error: any) {
    console.error('Error deleting tier:', error);
    return NextResponse.json(
      { error: 'Failed to delete tier', details: error.message },
      { status: 500 }
    );
  }
}

