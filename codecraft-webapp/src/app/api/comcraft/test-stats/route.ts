/**
 * TEST API Route: Debug Comcraft Statistics
 * GET /api/comcraft/test-stats
 * Returns detailed debug information
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function GET() {
  const debug: any = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  try {
    // Test 1: Check if we can connect to Supabase
    debug.checks.connection = 'Testing...';
    const { error: connectionError } = await supabase
      .from('guild_configs')
      .select('count')
      .limit(0);
    
    debug.checks.connection = connectionError ? `ERROR: ${connectionError.message}` : 'OK ✅';

    // Test 2: Get all guilds (no filter)
    debug.checks.allGuilds = 'Fetching...';
    const { data: allGuilds, error: allError } = await supabase
      .from('guild_configs')
      .select('guild_id, guild_name, member_count, is_active, subscription_tier');
    
    if (allError) {
      debug.checks.allGuilds = `ERROR: ${allError.message}`;
    } else {
      debug.checks.allGuilds = {
        count: allGuilds?.length || 0,
        guilds: allGuilds
      };
    }

    // Test 3: Get only active guilds
    debug.checks.activeGuilds = 'Fetching...';
    const { data: activeGuilds, error: activeError } = await supabase
      .from('guild_configs')
      .select('guild_id, guild_name, member_count, is_active, subscription_tier')
      .eq('is_active', true);
    
    if (activeError) {
      debug.checks.activeGuilds = `ERROR: ${activeError.message}`;
    } else {
      debug.checks.activeGuilds = {
        count: activeGuilds?.length || 0,
        guilds: activeGuilds,
        totalMembers: activeGuilds?.reduce((sum, g) => sum + (g.member_count || 0), 0) || 0
      };
    }

    // Test 4: Check if is_active column exists
    debug.checks.schemaCheck = 'Checking...';
    try {
      const { data: columns, error: schemaError } = await supabase
        .rpc('get_column_info', { table_name: 'guild_configs' });
      
      debug.checks.schemaCheck = schemaError 
        ? `Cannot check schema: ${schemaError.message || schemaError}` 
        : 'Column check OK';
    } catch (err) {
      debug.checks.schemaCheck = 'RPC not available (this is OK)';
    }

    // Test 5: Count tickets
    debug.checks.tickets = 'Counting...';
    const { count: ticketCount, error: ticketError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });
    
    debug.checks.tickets = ticketError 
      ? `ERROR: ${ticketError.message}` 
      : `${ticketCount || 0} tickets`;

    // Test 6: Count leveling users
    debug.checks.levelingUsers = 'Counting...';
    const { count: userCount, error: userError } = await supabase
      .from('user_levels')
      .select('*', { count: 'exact', head: true });
    
    debug.checks.levelingUsers = userError 
      ? `ERROR: ${userError.message}` 
      : `${userCount || 0} users`;

    return NextResponse.json({
      success: true,
      message: 'Debug information collected',
      debug
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      debug
    }, { status: 500 });
  }
}

