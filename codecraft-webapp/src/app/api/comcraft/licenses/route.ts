import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as Record<string, any>;
  const discordId = user.discordId || user.id || user.sub;

  if (!discordId) {
    return NextResponse.json({ error: 'Missing Discord ID' }, { status: 400 });
  }

  try {
    // First, get the user UUID from the users table using Discord ID
    const { data: dbUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (userError) {
      console.error('Failed to find user by Discord ID', discordId, userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!dbUser) {
      // User doesn't exist in database yet, return empty licenses
      return NextResponse.json({ licenses: [], discordId });
    }

    const userId = dbUser.id;

    // Now get licenses using the UUID
    const { data: licenses, error: licensesError } = await supabaseAdmin
      .from('comcraft_licenses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (licensesError) {
      console.error('Failed to load licenses for user', userId, licensesError);
      // If table doesn't exist, return empty array instead of error
      if (licensesError.code === '42P01' || licensesError.message?.includes('does not exist')) {
        console.warn('comcraft_licenses table does not exist, returning empty licenses');
        return NextResponse.json({ licenses: [], discordId });
      }
      return NextResponse.json({ error: 'Database error', details: licensesError.message }, { status: 500 });
    }

    // If no licenses, return early
    if (!licenses || licenses.length === 0) {
      return NextResponse.json({ licenses: [], discordId });
    }

    // Fetch assignments separately to avoid nested select issues
    const licenseIds = licenses.map((l: any) => l.id);
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('comcraft_license_guilds')
      .select('license_id, guild_id, guild_name, assigned_at')
      .in('license_id', licenseIds);

    if (assignmentsError) {
      console.warn('Failed to load license assignments:', assignmentsError);
      // Continue without assignments if table doesn't exist
    }

    // Group assignments by license_id
    const assignmentsByLicense = new Map<string, any[]>();
    if (assignments) {
      assignments.forEach((assignment: any) => {
        const licenseId = assignment.license_id;
        if (!assignmentsByLicense.has(licenseId)) {
          assignmentsByLicense.set(licenseId, []);
        }
        assignmentsByLicense.get(licenseId)!.push({
          guild_id: assignment.guild_id,
          guild_name: assignment.guild_name,
          assigned_at: assignment.assigned_at
        });
      });
    }

    // Fetch tier limits for each unique tier
    const uniqueTiers = Array.from(new Set(licenses.map((l: any) => l.tier).filter(Boolean)));
    const tierLimitsMap = new Map<string, number>();
    
    if (uniqueTiers.length > 0) {
      try {
        const { data: tiers, error: tiersError } = await supabaseAdmin
          .from('subscription_tiers')
          .select('tier_name, limits')
          .in('tier_name', uniqueTiers)
          .eq('is_active', true);
        
        if (!tiersError && tiers) {
          tiers.forEach((tier: any) => {
            try {
              // Handle limits as JSONB - could be object or already parsed
              let limits = tier.limits;
              if (typeof limits === 'string') {
                limits = JSON.parse(limits);
              }
              const maxGuilds = limits?.max_guilds;
              if (maxGuilds !== undefined && maxGuilds !== null) {
                tierLimitsMap.set(tier.tier_name, typeof maxGuilds === 'number' ? maxGuilds : parseInt(String(maxGuilds), 10) || 1);
              }
            } catch (parseError) {
              console.warn('Error parsing tier limits for', tier.tier_name, parseError);
            }
          });
        }
      } catch (tierError) {
        console.warn('Error fetching tier limits:', tierError);
        // Continue without tier limits
      }
    }

    const licenseData = licenses.map((license: any) => {
      // Use tier limits if available, otherwise fall back to license max_guilds
      const tierMaxGuilds = tierLimitsMap.get(license.tier);
      const slotsTotal = tierMaxGuilds !== undefined ? tierMaxGuilds : (license.max_guilds || 1);
      const licenseAssignments = assignmentsByLicense.get(license.id) || [];
      
      return {
        ...license,
        assignments: licenseAssignments,
        slots_used: licenseAssignments.length,
        slots_total: slotsTotal,
        is_owner: true,
      };
    });

    return NextResponse.json({ licenses: licenseData, discordId });
  } catch (error) {
    console.error('Unexpected error loading licenses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
