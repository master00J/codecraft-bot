/**
 * ComCraft Stock Market Manager
 * Handles stock trading, portfolio management, and market mechanics
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');

class StockMarketManager {
  constructor() {
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is required');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Get or create market config for guild
   */
  async getMarketConfig(guildId) {
    const { data, error } = await this.supabase
      .from('stock_market_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Create default config
      const { data: newConfig, error: insertError } = await this.supabase
        .from('stock_market_configs')
        .insert({
          guild_id: guildId,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating market config:', insertError);
        return null;
      }

      return newConfig;
    }

    return data || null;
  }

  /**
   * Get all active stocks for a guild
   */
  async getStocks(guildId) {
    const { data, error } = await this.supabase
      .from('stock_market_stocks')
      .select('*')
      .eq('guild_id', guildId)
      .eq('status', 'active')
      .order('symbol', { ascending: true });

    if (error) {
      console.error('Error fetching stocks:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get a specific stock
   */
  async getStock(guildId, stockSymbolOrId) {
    const query = stockSymbolOrId.length > 20
      ? this.supabase.from('stock_market_stocks').select('*').eq('id', stockSymbolOrId)
      : this.supabase.from('stock_market_stocks').select('*').eq('guild_id', guildId).eq('symbol', stockSymbolOrId.toUpperCase());

    const { data, error } = await query.single();

    if (error) {
      console.error('Error fetching stock:', error);
      return null;
    }

    return data;
  }

  /**
   * Get user portfolio for a guild
   */
  async getPortfolio(guildId, userId) {
    const { data, error } = await this.supabase
      .from('stock_market_portfolio')
      .select(`
        *,
        stock:stock_market_stocks(*)
      `)
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .gt('shares_owned', 0);

    if (error) {
      console.error('Error fetching portfolio:', error);
      return [];
    }

    // Calculate current value and profit/loss
    const portfolio = (data || []).map(holding => {
      const stock = holding.stock;
      const currentValue = holding.shares_owned * parseFloat(stock.current_price);
      const totalInvested = holding.total_invested;
      const profitLoss = currentValue - totalInvested;
      const profitLossPercent = totalInvested > 0 
        ? ((currentValue - totalInvested) / totalInvested) * 100 
        : 0;

      return {
        ...holding,
        current_value: currentValue,
        profit_loss: profitLoss,
        profit_loss_percent: profitLossPercent,
        stock
      };
    });

    return portfolio;
  }

  /**
   * Get total portfolio value for a user
   */
  async getPortfolioValue(guildId, userId) {
    const portfolio = await this.getPortfolio(guildId, userId);
    
    const totalValue = portfolio.reduce((sum, holding) => {
      return sum + (holding.current_value || 0);
    }, 0);

    const totalInvested = portfolio.reduce((sum, holding) => {
      return sum + (holding.total_invested || 0);
    }, 0);

    const totalProfitLoss = totalValue - totalInvested;
    const totalProfitLossPercent = totalInvested > 0 
      ? ((totalValue - totalInvested) / totalInvested) * 100 
      : 0;

    return {
      total_value: totalValue,
      total_invested: totalInvested,
      total_profit_loss: totalProfitLoss,
      total_profit_loss_percent: totalProfitLossPercent,
      holdings_count: portfolio.length
    };
  }

  /**
   * Buy stocks
   */
  async buyStock(guildId, userId, stockSymbolOrId, shares, economyManager) {
    try {
      // Get stock
      const stock = await this.getStock(guildId, stockSymbolOrId);
      if (!stock || stock.status !== 'active') {
        return { success: false, error: 'Stock not found or not available' };
      }

      // Check config
      const config = await this.getMarketConfig(guildId);
      if (!config || !config.market_enabled) {
        return { success: false, error: 'Stock market is disabled' };
      }

      // Calculate cost
      const pricePerShare = parseFloat(stock.current_price);
      const totalCost = shares * pricePerShare;
      const fee = config.trading_fee_percentage 
        ? (totalCost * (config.trading_fee_percentage / 100)) 
        : 0;
      const totalWithFee = totalCost + fee;

      // Check min/max order
      if (totalCost < config.min_order_amount) {
        return { 
          success: false, 
          error: `Minimum order amount is ${config.min_order_amount} coins` 
        };
      }
      if (totalCost > config.max_order_amount) {
        return { 
          success: false, 
          error: `Maximum order amount is ${config.max_order_amount} coins` 
        };
      }

      // Check if user has enough coins
      const userEconomy = await economyManager.getUserEconomy(guildId, userId);
      if (!userEconomy || userEconomy.balance < totalWithFee) {
        return { 
          success: false, 
          error: `Insufficient balance. You need ${totalWithFee.toFixed(2)} coins (${totalCost.toFixed(2)} + ${fee.toFixed(2)} fee)` 
        };
      }

      // Check available shares
      if (stock.available_shares < shares) {
        return { 
          success: false, 
          error: `Only ${stock.available_shares} shares available` 
        };
      }

      // Deduct coins
      const removeResult = await economyManager.removeCoins(
        guildId,
        userId,
        totalWithFee,
        'stock_purchase',
        `Bought ${shares} shares of ${stock.symbol} @ ${pricePerShare.toFixed(2)}`
      );

      if (!removeResult.success) {
        return { success: false, error: 'Failed to process payment' };
      }

      // Update or create portfolio holding
      const { data: existingHolding } = await this.supabase
        .from('stock_market_portfolio')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('stock_id', stock.id)
        .single();

      const newShares = (existingHolding?.shares_owned || 0) + shares;
      const oldTotalInvested = existingHolding?.total_invested || 0;
      const newTotalInvested = oldTotalInvested + totalCost;
      const newAveragePrice = newTotalInvested / newShares;

      if (existingHolding) {
        // Update existing holding
        await this.supabase
          .from('stock_market_portfolio')
          .update({
            shares_owned: newShares,
            average_buy_price: newAveragePrice,
            total_invested: newTotalInvested,
          })
          .eq('id', existingHolding.id);
      } else {
        // Create new holding
        await this.supabase
          .from('stock_market_portfolio')
          .insert({
            guild_id: guildId,
            user_id: userId,
            stock_id: stock.id,
            shares_owned: shares,
            average_buy_price: pricePerShare,
            total_invested: totalCost,
          });
      }

      // Update stock available shares
      await this.supabase
        .from('stock_market_stocks')
        .update({
          available_shares: stock.available_shares - shares
        })
        .eq('id', stock.id);

      // Log transaction
      await this.supabase
        .from('stock_market_transactions')
        .insert({
          guild_id: guildId,
          user_id: userId,
          stock_id: stock.id,
          transaction_type: 'buy',
          shares: shares,
          price_per_share: pricePerShare,
          total_cost: totalCost,
          transaction_fee: fee,
        });

      // Transaction is already logged by removeCoins

      return {
        success: true,
        shares: newShares,
        total_cost: totalCost,
        fee: fee,
        new_balance: removeResult.newBalance,
        stock: stock
      };
    } catch (error) {
      console.error('Error buying stock:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sell stocks
   */
  async sellStock(guildId, userId, stockSymbolOrId, shares, economyManager) {
    try {
      // Get stock
      const stock = await this.getStock(guildId, stockSymbolOrId);
      if (!stock || stock.status !== 'active') {
        return { success: false, error: 'Stock not found or not available' };
      }

      // Get user holding
      const { data: holding, error: holdingError } = await this.supabase
        .from('stock_market_portfolio')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('stock_id', stock.id)
        .single();

      if (holdingError || !holding || holding.shares_owned < shares) {
        return { 
          success: false, 
          error: `You don't have enough shares. You own ${holding?.shares_owned || 0} shares` 
        };
      }

      // Get config
      const config = await this.getMarketConfig(guildId);
      
      // Calculate proceeds
      const pricePerShare = parseFloat(stock.current_price);
      const totalValue = shares * pricePerShare;
      const fee = config.trading_fee_percentage 
        ? (totalValue * (config.trading_fee_percentage / 100)) 
        : 0;
      const proceeds = totalValue - fee;

      // Calculate profit/loss
      const averageBuyPrice = parseFloat(holding.average_buy_price);
      const totalCost = shares * averageBuyPrice;
      const profitLoss = proceeds - totalCost;
      const profitLossPercent = totalCost > 0 
        ? ((proceeds - totalCost) / totalCost) * 100 
        : 0;

      // Track quest progress (stock_profit quest type) - only track profits, not losses
      if (global.questManager && profitLoss > 0) {
        try {
          if (await global.questManager.isTracking(guildId, 'stock_profit')) {
            await global.questManager.updateProgress(guildId, userId, 'stock_profit', {
              increment: Math.floor(profitLoss) // Track profit amount
            });
          }
        } catch (error) {
          console.error('[StockMarket] Error tracking stock_profit quest:', error.message);
        }
      }

      // Add coins to user
      const addResult = await economyManager.addCoins(
        guildId,
        userId,
        proceeds,
        'stock_sale',
        `Sold ${shares} shares of ${stock.symbol} @ ${pricePerShare.toFixed(2)}`
      );

      if (!addResult.success) {
        return { success: false, error: 'Failed to process payment' };
      }

      // Update holding
      const newShares = holding.shares_owned - shares;
      if (newShares > 0) {
        // Update existing holding
        const newTotalInvested = holding.total_invested - totalCost;
        await this.supabase
          .from('stock_market_portfolio')
          .update({
            shares_owned: newShares,
            total_invested: newTotalInvested,
            total_profit_loss: (holding.total_profit_loss || 0) + profitLoss,
          })
          .eq('id', holding.id);
      } else {
        // Delete holding if all shares sold
        await this.supabase
          .from('stock_market_portfolio')
          .delete()
          .eq('id', holding.id);
      }

      // Update stock available shares
      await this.supabase
        .from('stock_market_stocks')
        .update({
          available_shares: stock.available_shares + shares
        })
        .eq('id', stock.id);

      // Log transaction
      await this.supabase
        .from('stock_market_transactions')
        .insert({
          guild_id: guildId,
          user_id: userId,
          stock_id: stock.id,
          transaction_type: 'sell',
          shares: shares,
          price_per_share: pricePerShare,
          total_cost: proceeds,
          profit_loss: profitLoss,
          profit_loss_percentage: profitLossPercent,
          transaction_fee: fee,
        });

      return {
        success: true,
        shares_remaining: newShares,
        proceeds: proceeds,
        fee: fee,
        profit_loss: profitLoss,
        profit_loss_percent: profitLossPercent,
        new_balance: addResult.newBalance,
        stock: stock
      };
    } catch (error) {
      console.error('Error selling stock:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update stock prices (called periodically)
   */
  async updateStockPrices(guildId) {
    try {
      const config = await this.getMarketConfig(guildId);
      if (!config || !config.auto_price_fluctuation) {
        return { success: false, error: 'Auto price fluctuation disabled' };
      }

      const stocks = await this.getStocks(guildId);
      const updates = [];

      for (const stock of stocks) {
        // Calculate price change
        const volatility = parseFloat(stock.volatility || 5) / 100;
        const changePercent = (Math.random() * 2 - 1) * volatility * (config.price_fluctuation_range || 5) / 100;
        const currentPrice = parseFloat(stock.current_price);
        let newPrice = currentPrice * (1 + changePercent);

        // Apply bounds
        newPrice = Math.max(parseFloat(stock.min_price || 1), newPrice);
        newPrice = Math.min(parseFloat(stock.max_price || 100000), newPrice);

        // Update price history (keep last 100 entries)
        const history = stock.price_history || [];
        history.push({
          price: newPrice,
          timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 entries
        const trimmedHistory = history.slice(-100);

        // Update stock
        await this.supabase
          .from('stock_market_stocks')
          .update({
            current_price: newPrice.toFixed(2),
            price_history: trimmedHistory
          })
          .eq('id', stock.id);

        // Process pending orders for this stock
        await this.processPendingOrders(guildId, stock.id, newPrice);

        // Check price alerts for this stock
        await this.checkPriceAlerts(guildId, stock.id, newPrice);

        updates.push({
          symbol: stock.symbol,
          old_price: currentPrice,
          new_price: newPrice,
          change_percent: changePercent * 100
        });
      }

      return { success: true, updates };
    } catch (error) {
      console.error('Error updating stock prices:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get transaction history for user
   */
  async getTransactionHistory(guildId, userId, limit = 20) {
    const { data, error } = await this.supabase
      .from('stock_market_transactions')
      .select(`
        *,
        stock:stock_market_stocks(symbol, name, emoji)
      `)
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get market leaderboard (richest portfolios)
   */
  async getMarketLeaderboard(guildId, limit = 10) {
    // Get all portfolios
    const { data: portfolios, error } = await this.supabase
      .from('stock_market_portfolio')
      .select(`
        *,
        stock:stock_market_stocks(symbol, name, current_price)
      `)
      .eq('guild_id', guildId)
      .gt('shares_owned', 0);

    if (error) {
      console.error('Error fetching portfolios:', error);
      return [];
    }

    // Calculate total value per user
    const userValues = {};
    
    (portfolios || []).forEach(holding => {
      const userId = holding.user_id;
      const stock = holding.stock;
      const currentValue = holding.shares_owned * parseFloat(stock.current_price);
      
      if (!userValues[userId]) {
        userValues[userId] = {
          user_id: userId,
          total_value: 0,
          holdings: []
        };
      }
      
      userValues[userId].total_value += currentValue;
      userValues[userId].holdings.push(holding);
    });

    // Sort by total value
    const leaderboard = Object.values(userValues)
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, limit);

    return leaderboard;
  }

  /**
   * Create a limit order (buy or sell at target price)
   */
  async createLimitOrder(guildId, userId, stockSymbolOrId, orderType, shares, targetPrice, expiresAt = null) {
    try {
      const stock = await this.getStock(guildId, stockSymbolOrId);
      if (!stock || stock.status !== 'active') {
        return { success: false, error: 'Stock not found or not available' };
      }

      // Validate order type
      const validTypes = ['limit_buy', 'limit_sell', 'stop_loss', 'stop_profit'];
      if (!validTypes.includes(orderType)) {
        return { success: false, error: 'Invalid order type' };
      }

      // For limit_sell and stop_loss, check if user has enough shares
      if (orderType === 'limit_sell' || orderType === 'stop_loss') {
        const { data: holding } = await this.supabase
          .from('stock_market_portfolio')
          .select('shares_owned')
          .eq('guild_id', guildId)
          .eq('user_id', userId)
          .eq('stock_id', stock.id)
          .single();

        if (!holding || holding.shares_owned < shares) {
          return { success: false, error: `You don't have enough shares. You own ${holding?.shares_owned || 0} shares` };
        }
      }

      // For limit_buy, check if user has enough balance (reserve it)
      if (orderType === 'limit_buy') {
        const config = await this.getMarketConfig(guildId);
        const totalCost = shares * parseFloat(targetPrice);
        const fee = config.trading_fee_percentage 
          ? (totalCost * (config.trading_fee_percentage / 100)) 
          : 0;
        const totalWithFee = totalCost + fee;

        // Note: We don't reserve coins here, but will check when order executes
        // In production, you might want to reserve coins
      }

      const { data: order, error } = await this.supabase
        .from('stock_market_orders')
        .insert({
          guild_id: guildId,
          user_id: userId,
          stock_id: stock.id,
          order_type: orderType,
          shares: shares,
          target_price: parseFloat(targetPrice),
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating limit order:', error);
        return { success: false, error: 'Failed to create order' };
      }

      return { success: true, order };
    } catch (error) {
      console.error('Error in createLimitOrder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's pending orders
   */
  async getUserOrders(guildId, userId, status = 'pending') {
    try {
      const { data: orders, error } = await this.supabase
        .from('stock_market_orders')
        .select(`
          *,
          stock:stock_market_stocks(symbol, name, emoji, current_price)
        `)
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user orders:', error);
        return [];
      }

      return orders || [];
    } catch (error) {
      console.error('Error in getUserOrders:', error);
      return [];
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(guildId, userId, orderId) {
    try {
      const { error } = await this.supabase
        .from('stock_market_orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) {
        console.error('Error cancelling order:', error);
        return { success: false, error: 'Failed to cancel order' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in cancelOrder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process pending orders when price updates
   */
  async processPendingOrders(guildId, stockId, currentPrice) {
    try {
      // Get all pending orders for this stock
      const { data: orders, error } = await this.supabase
        .from('stock_market_orders')
        .select(`
          *,
          stock:stock_market_stocks(symbol, name)
        `)
        .eq('guild_id', guildId)
        .eq('stock_id', stockId)
        .eq('status', 'pending');

      if (error || !orders || orders.length === 0) {
        return { processed: 0 };
      }

      let processed = 0;
      const price = parseFloat(currentPrice);

      for (const order of orders) {
        const targetPrice = parseFloat(order.target_price);
        let shouldExecute = false;

        // Check if order should execute based on type
        switch (order.order_type) {
          case 'limit_buy':
            // Buy when price drops to or below target
            shouldExecute = price <= targetPrice;
            break;
          case 'limit_sell':
            // Sell when price rises to or above target
            shouldExecute = price >= targetPrice;
            break;
          case 'stop_loss':
            // Sell when price drops to or below target (limit losses)
            shouldExecute = price <= targetPrice;
            break;
          case 'stop_profit':
            // Sell when price rises to or above target (lock in profits)
            shouldExecute = price >= targetPrice;
            break;
        }

        // Check expiration
        if (order.expires_at && new Date(order.expires_at) < new Date()) {
          await this.supabase
            .from('stock_market_orders')
            .update({ status: 'expired' })
            .eq('id', order.id);
          continue;
        }

        if (shouldExecute) {
          // Execute order (this would call buyStock or sellStock)
          // For now, we'll mark it as executed and let the price update handler process it
          await this.supabase
            .from('stock_market_orders')
            .update({ 
              status: 'executed',
              executed_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          processed++;
        }
      }

      return { processed };
    } catch (error) {
      console.error('Error processing pending orders:', error);
      return { processed: 0, error: error.message };
    }
  }

  /**
   * Create a price alert
   */
  async createPriceAlert(guildId, userId, stockSymbolOrId, alertType, targetPrice = null, changePercent = null) {
    try {
      const stock = await this.getStock(guildId, stockSymbolOrId);
      if (!stock || stock.status !== 'active') {
        return { success: false, error: 'Stock not found or not available' };
      }

      const validTypes = ['above', 'below', 'change_percent'];
      if (!validTypes.includes(alertType)) {
        return { success: false, error: 'Invalid alert type' };
      }

      if (alertType === 'change_percent' && !changePercent) {
        return { success: false, error: 'change_percent requires changePercent parameter' };
      }

      if ((alertType === 'above' || alertType === 'below') && !targetPrice) {
        return { success: false, error: `${alertType} requires targetPrice parameter` };
      }

      const { data: alert, error } = await this.supabase
        .from('stock_market_price_alerts')
        .insert({
          guild_id: guildId,
          user_id: userId,
          stock_id: stock.id,
          alert_type: alertType,
          target_price: targetPrice ? parseFloat(targetPrice) : null,
          change_percent: changePercent ? parseFloat(changePercent) : null,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        // If duplicate, return existing alert
        if (error.code === '23505') {
          const { data: existing } = await this.supabase
            .from('stock_market_price_alerts')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('stock_id', stock.id)
            .eq('alert_type', alertType)
            .eq('target_price', targetPrice || 0)
            .single();
          
          return { success: true, alert: existing, message: 'Alert already exists' };
        }
        
        console.error('Error creating price alert:', error);
        return { success: false, error: 'Failed to create alert' };
      }

      return { success: true, alert };
    } catch (error) {
      console.error('Error in createPriceAlert:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's price alerts
   */
  async getUserPriceAlerts(guildId, userId) {
    try {
      const { data: alerts, error } = await this.supabase
        .from('stock_market_price_alerts')
        .select(`
          *,
          stock:stock_market_stocks(symbol, name, emoji, current_price)
        `)
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching price alerts:', error);
        return [];
      }

      return alerts || [];
    } catch (error) {
      console.error('Error in getUserPriceAlerts:', error);
      return [];
    }
  }

  /**
   * Check and trigger price alerts
   */
  async checkPriceAlerts(guildId, stockId, currentPrice) {
    try {
      const { data: alerts, error } = await this.supabase
        .from('stock_market_price_alerts')
        .select(`
          *,
          stock:stock_market_stocks(symbol, name, emoji, current_price)
        `)
        .eq('guild_id', guildId)
        .eq('stock_id', stockId)
        .eq('is_active', true)
        .eq('notified', false);

      if (error || !alerts || alerts.length === 0) {
        return { triggered: [] };
      }

      const price = parseFloat(currentPrice);
      const triggered = [];

      for (const alert of alerts) {
        let shouldTrigger = false;

        switch (alert.alert_type) {
          case 'above':
            shouldTrigger = price >= parseFloat(alert.target_price);
            break;
          case 'below':
            shouldTrigger = price <= parseFloat(alert.target_price);
            break;
          case 'change_percent':
            // This would need previous price to calculate change
            // For now, we'll skip this type
            continue;
        }

        if (shouldTrigger) {
          await this.supabase
            .from('stock_market_price_alerts')
            .update({
              notified: true,
              notified_at: new Date().toISOString()
            })
            .eq('id', alert.id);

          triggered.push(alert);
        }
      }

      return { triggered };
    } catch (error) {
      console.error('Error checking price alerts:', error);
      return { triggered: [] };
    }
  }

  /**
   * Create a market event (IPO, Crash, Boom, etc.)
   */
  async createMarketEvent(guildId, eventType, title, description, stockId = null, priceMultiplier = 1.0, priceChangePercent = 0, durationMinutes = null) {
    try {
      const validTypes = ['ipo', 'split', 'crash', 'boom', 'dividend', 'news'];
      if (!validTypes.includes(eventType)) {
        return { success: false, error: 'Invalid event type' };
      }

      const endsAt = durationMinutes 
        ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
        : null;

      const { data: event, error } = await this.supabase
        .from('stock_market_events')
        .insert({
          guild_id: guildId,
          stock_id: stockId,
          event_type: eventType,
          title,
          description,
          price_multiplier: parseFloat(priceMultiplier),
          price_change_percentage: parseFloat(priceChangePercent),
          is_active: true,
          duration_minutes: durationMinutes,
          ends_at: endsAt
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating market event:', error);
        return { success: false, error: 'Failed to create event' };
      }

      // Apply event to stock prices if applicable
      if (stockId && (priceMultiplier !== 1.0 || priceChangePercent !== 0)) {
        const stock = await this.getStock(guildId, stockId);
        if (stock) {
          let newPrice = parseFloat(stock.current_price);
          
          if (priceMultiplier !== 1.0) {
            newPrice = newPrice * parseFloat(priceMultiplier);
          }
          
          if (priceChangePercent !== 0) {
            newPrice = newPrice * (1 + parseFloat(priceChangePercent) / 100);
          }

          await this.supabase
            .from('stock_market_stocks')
            .update({ current_price: newPrice })
            .eq('id', stockId);
        }
      }

      return { success: true, event };
    } catch (error) {
      console.error('Error in createMarketEvent:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get active market events
   */
  async getActiveMarketEvents(guildId, stockId = null) {
    try {
      let query = this.supabase
        .from('stock_market_events')
        .select(`
          *,
          stock:stock_market_stocks(symbol, name, emoji)
        `)
        .eq('guild_id', guildId)
        .eq('is_active', true);

      if (stockId) {
        query = query.eq('stock_id', stockId);
      }

      const { data: events, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching market events:', error);
        return [];
      }

      // Filter out expired events
      const now = new Date();
      const activeEvents = (events || []).filter(event => {
        if (!event.ends_at) return true; // Permanent event
        return new Date(event.ends_at) > now;
      });

      return activeEvents;
    } catch (error) {
      console.error('Error in getActiveMarketEvents:', error);
      return [];
    }
  }

  /**
   * Process dividends for a stock
   */
  async processDividends(guildId, stockId, economyManager) {
    try {
      const stock = await this.getStock(guildId, stockId);
      if (!stock || stock.status !== 'active') {
        return { success: false, error: 'Stock not found' };
      }

      const dividendRate = parseFloat(stock.dividend_rate || 0);
      if (dividendRate <= 0) {
        return { success: false, error: 'Stock has no dividend rate' };
      }

      // Get all shareholders
      const { data: holdings, error } = await this.supabase
        .from('stock_market_portfolio')
        .select('*')
        .eq('guild_id', guildId)
        .eq('stock_id', stockId)
        .gt('shares_owned', 0);

      if (error || !holdings || holdings.length === 0) {
        return { success: false, error: 'No shareholders found' };
      }

      const currentPrice = parseFloat(stock.current_price);
      const dividendPerShare = (currentPrice * dividendRate) / 100 / 12; // Monthly dividend (assuming monthly frequency)

      let totalPaid = 0;
      const payments = [];

      for (const holding of holdings) {
        const dividendAmount = dividendPerShare * parseInt(holding.shares_owned);
        
        if (dividendAmount > 0) {
          await economyManager.addCoins(
            guildId,
            holding.user_id,
            dividendAmount,
            'stock_dividend',
            `Dividend payment for ${stock.symbol} (${holding.shares_owned} shares)`
          );

          totalPaid += dividendAmount;
          payments.push({
            user_id: holding.user_id,
            shares: holding.shares_owned,
            amount: dividendAmount
          });
        }
      }

      // Update last dividend date
      await this.supabase
        .from('stock_market_stocks')
        .update({ last_dividend_date: new Date().toISOString() })
        .eq('id', stockId);

      return { 
        success: true, 
        totalPaid, 
        paymentsCount: payments.length,
        payments 
      };
    } catch (error) {
      console.error('Error processing dividends:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = StockMarketManager;

