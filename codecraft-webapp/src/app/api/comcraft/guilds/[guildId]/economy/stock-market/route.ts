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
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const stockId = searchParams.get('stock_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get price history for a specific stock
    if (action === 'price_history' && stockId) {
      const { data: stock, error } = await supabase
        .from('stock_market_stocks')
        .select('price_history, symbol, name')
        .eq('id', stockId)
        .eq('guild_id', guildId)
        .single();

      if (error) {
        return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
      }

      const priceHistory = (stock.price_history || []) as Array<{ price: number; timestamp: string }>;
      return NextResponse.json({
        symbol: stock.symbol,
        name: stock.name,
        priceHistory: priceHistory.slice(-limit) // Last N entries
      });
    }

    // Get market activity log (transactions)
    if (action === 'activity_log') {
      const { data: transactions, error } = await supabase
        .from('stock_market_transactions')
        .select(`
          *,
          stock:stock_market_stocks(symbol, name, emoji)
        `)
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching activity log:', error);
        return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 });
      }

      return NextResponse.json({ transactions: transactions || [] });
    }

    // Get active market events
    if (action === 'events') {
      const { data: events, error } = await supabase
        .from('stock_market_events')
        .select(`
          *,
          stock:stock_market_stocks(symbol, name, emoji)
        `)
        .eq('guild_id', guildId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching market events:', error);
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
      }

      // Filter out expired events
      const now = new Date();
      const activeEvents = (events || []).filter(event => {
        if (!event.ends_at) return true;
        return new Date(event.ends_at) > now;
      });

      return NextResponse.json({ events: activeEvents });
    }

    // Get orders statistics
    if (action === 'orders_stats') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: allOrders, error: allError } = await supabase
        .from('stock_market_orders')
        .select('status, created_at, executed_at')
        .eq('guild_id', guildId);

      const { data: recentOrders, error: recentError } = await supabase
        .from('stock_market_orders')
        .select(`
          *,
          stock:stock_market_stocks(symbol, name, emoji)
        `)
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (allError || recentError) {
        console.error('Error fetching orders stats:', allError || recentError);
        return NextResponse.json({ error: 'Failed to fetch orders stats' }, { status: 500 });
      }

      const pending = (allOrders || []).filter(o => o.status === 'pending').length;
      const executed = (allOrders || []).filter(o => {
        if (o.status !== 'executed') return false;
        const executedDate = (o as any).executed_at || (o as any).created_at;
        return executedDate && new Date(executedDate) >= today;
      }).length;

      return NextResponse.json({
        pending,
        executed,
        total: allOrders?.length || 0,
        recent: recentOrders || []
      });
    }

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
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

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
    } else if (action === 'bulk_update') {
      const { stock_ids, updates } = data;

      if (!stock_ids || !Array.isArray(stock_ids) || stock_ids.length === 0) {
        return NextResponse.json({ error: 'stock_ids array is required' }, { status: 400 });
      }

      const updateData: any = {};
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.volatility !== undefined) updateData.volatility = parseFloat(updates.volatility);

      const { error } = await supabase
        .from('stock_market_stocks')
        .update(updateData)
        .in('id', stock_ids)
        .eq('guild_id', guildId);

      if (error) {
        console.error('Error bulk updating stocks:', error);
        return NextResponse.json({ error: 'Failed to bulk update stocks' }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: stock_ids.length });
    } else if (action === 'bulk_delete') {
      const { stock_ids } = data;

      if (!stock_ids || !Array.isArray(stock_ids) || stock_ids.length === 0) {
        return NextResponse.json({ error: 'stock_ids array is required' }, { status: 400 });
      }

      const { error } = await supabase
        .from('stock_market_stocks')
        .delete()
        .in('id', stock_ids)
        .eq('guild_id', guildId);

      if (error) {
        console.error('Error bulk deleting stocks:', error);
        return NextResponse.json({ error: 'Failed to bulk delete stocks' }, { status: 500 });
      }

      return NextResponse.json({ success: true, deleted: stock_ids.length });
    } else if (action === 'export') {
      // Export all stocks as JSON
      const { data: stocks, error } = await supabase
        .from('stock_market_stocks')
        .select('symbol, name, description, emoji, base_price, current_price, volatility, total_shares, status')
        .eq('guild_id', guildId)
        .order('symbol', { ascending: true });

      if (error) {
        console.error('Error exporting stocks:', error);
        return NextResponse.json({ error: 'Failed to export stocks' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        stocks: stocks || [],
        exported_at: new Date().toISOString()
      });
    } else if (action === 'import') {
      const { stocks: stocksToImport } = data;

      if (!stocksToImport || !Array.isArray(stocksToImport)) {
        return NextResponse.json({ error: 'stocks array is required' }, { status: 400 });
      }

      const stocksData = stocksToImport.map((stock: any) => ({
        guild_id: guildId,
        symbol: stock.symbol?.toUpperCase(),
        name: stock.name,
        description: stock.description || null,
        emoji: stock.emoji || null,
        base_price: parseFloat(stock.base_price || stock.current_price || 100),
        current_price: parseFloat(stock.current_price || stock.base_price || 100),
        volatility: parseFloat(stock.volatility || 5),
        total_shares: parseInt(stock.total_shares || 1000000),
        available_shares: parseInt(stock.total_shares || 1000000),
        status: stock.status || 'active'
      }));

      const { data: inserted, error } = await supabase
        .from('stock_market_stocks')
        .insert(stocksData)
        .select();

      if (error) {
        console.error('Error importing stocks:', error);
        return NextResponse.json({ error: 'Failed to import stocks' }, { status: 500 });
      }

      return NextResponse.json({ success: true, imported: inserted?.length || 0 });
    } else if (action === 'create_event') {
      const { event_type, title, description, stock_id, price_multiplier, price_change_percentage, duration_minutes } = data;

      if (!event_type || !title) {
        return NextResponse.json({ error: 'event_type and title are required' }, { status: 400 });
      }

      // This would need to be called from the bot, but we can create the event record
      const { data: event, error } = await supabase
        .from('stock_market_events')
        .insert({
          guild_id: guildId,
          stock_id: stock_id || null,
          event_type,
          title,
          description: description || null,
          price_multiplier: price_multiplier ? parseFloat(price_multiplier) : 1.0,
          price_change_percentage: price_change_percentage ? parseFloat(price_change_percentage) : 0,
          is_active: true,
          duration_minutes: duration_minutes ? parseInt(duration_minutes) : null,
          ends_at: duration_minutes ? new Date(Date.now() + duration_minutes * 60 * 1000).toISOString() : null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating market event:', error);
        return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
      }

      return NextResponse.json({ success: true, event });
    } else if (action === 'process_dividends') {
      const { stock_id } = data;

      if (!stock_id) {
        return NextResponse.json({ error: 'stock_id is required' }, { status: 400 });
      }

      // This would need to be called from the bot with economyManager
      // For now, just return success
      return NextResponse.json({ success: true, message: 'Dividend processing should be done via bot command' });
    } else if (action === 'deactivate_event') {
      const { event_id } = data;

      if (!event_id) {
        return NextResponse.json({ error: 'event_id is required' }, { status: 400 });
      }

      const { error } = await supabase
        .from('stock_market_events')
        .update({ is_active: false })
        .eq('id', event_id)
        .eq('guild_id', guildId);

      if (error) {
        console.error('Error deactivating event:', error);
        return NextResponse.json({ error: 'Failed to deactivate event' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in stock market POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

