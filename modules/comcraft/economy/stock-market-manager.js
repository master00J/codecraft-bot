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
}

module.exports = StockMarketManager;

