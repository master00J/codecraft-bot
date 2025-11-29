/**
 * API Route: Stock Market
 * /api/comcraft/guilds/[guildId]/economy/stock-market
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = supabaseAdmin;

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;

    // Get all stocks
    const { data: stocks, error: stocksError } = await supabase
      .from('stock_market_stocks')
      .select('*')
      .eq('guild_id', guildId)
      .order('symbol', { ascending: true });

    if (stocksError) {
      console.error('Error fetching stocks:', stocksError);
      return NextResponse.json({ error: 'Failed to fetch stocks' }, { status: 500 });
    }

    // Get market config
    const { data: config, error: configError } = await supabase
      .from('stock_market_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      console.error('Error fetching market config:', configError);
    }

    return NextResponse.json({
      stocks: stocks || [],
      config: config || null
    });
  } catch (error) {
    console.error('Error in stock market GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const body = await request.json();

    const { action, ...data } = body;

    if (action === 'create_stock') {
      const { symbol, name, description, emoji, base_price, volatility, total_shares } = data;

      if (!symbol || !name || !base_price) {
        return NextResponse.json(
          { error: 'symbol, name, and base_price are required' },
          { status: 400 }
        );
      }

      const { data: stock, error } = await supabase
        .from('stock_market_stocks')
        .insert({
          guild_id: guildId,
          symbol: symbol.toUpperCase(),
          name,
          description: description || null,
          emoji: emoji || null,
          base_price: parseFloat(base_price),
          current_price: parseFloat(base_price),
          volatility: parseFloat(volatility || 5),
          total_shares: parseInt(total_shares || 1000000),
          available_shares: parseInt(total_shares || 1000000),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating stock:', error);
        return NextResponse.json({ error: 'Failed to create stock' }, { status: 500 });
      }

      return NextResponse.json({ success: true, stock });
    } else if (action === 'update_stock') {
      const { stock_id, ...updates } = data;

      if (!stock_id) {
        return NextResponse.json({ error: 'stock_id is required' }, { status: 400 });
      }

      // Prepare update object
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.emoji !== undefined) updateData.emoji = updates.emoji;
      if (updates.volatility !== undefined) updateData.volatility = parseFloat(updates.volatility);
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.current_price !== undefined) updateData.current_price = parseFloat(updates.current_price);

      const { data: stock, error } = await supabase
        .from('stock_market_stocks')
        .update(updateData)
        .eq('id', stock_id)
        .eq('guild_id', guildId)
        .select()
        .single();

      if (error) {
        console.error('Error updating stock:', error);
        return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
      }

      return NextResponse.json({ success: true, stock });
    } else if (action === 'delete_stock') {
      const { stock_id } = data;

      if (!stock_id) {
        return NextResponse.json({ error: 'stock_id is required' }, { status: 400 });
      }

      const { error } = await supabase
        .from('stock_market_stocks')
        .delete()
        .eq('id', stock_id)
        .eq('guild_id', guildId);

      if (error) {
        console.error('Error deleting stock:', error);
        return NextResponse.json({ error: 'Failed to delete stock' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else if (action === 'update_config') {
      const { error } = await supabase
        .from('stock_market_configs')
        .upsert({
          guild_id: guildId,
          ...data
        }, {
          onConflict: 'guild_id'
        });

      if (error) {
        console.error('Error updating market config:', error);
        return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in stock market POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

