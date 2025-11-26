/**
 * CodeCraft Webapp API Client
 * Connects Discord bot to the Next.js webapp
 */

const axios = require('axios');

class WebAppAPI {
  constructor() {
    this.baseUrl = process.env.WEBAPP_API_URL || 'https://codecraft-solutions.com';
    this.internalSecret = process.env.INTERNAL_API_SECRET;
    this.headers = {
      'Content-Type': 'application/json',
      'X-Internal-Secret': this.internalSecret
    };
  }

  // ==================== ORDERS ====================

  async getOrderByNumber(orderNumber) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/internal/orders/by-number`,
        {
          headers: this.headers,
          params: { orderNumber }
        }
      );
      return response.data.order || null;
    } catch (error) {
      console.error('Error fetching order by number:', error.message);
      return null;
    }
  }

  async getOrderDetails(orderId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/internal/orders/${orderId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching order details:', error.message);
      return null;
    }
  }

  async getUserOrders(discordId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/internal/orders/by-user`,
        {
          headers: this.headers,
          params: { discordId }
        }
      );
      return response.data.orders || [];
    } catch (error) {
      console.error('Error fetching user orders:', error.message);
      return [];
    }
  }

  async createOrder(orderData) {
    try {
      // This needs to be called with user's session - skip for now
      // Orders are created via webapp form
      return { success: false, message: 'Use webapp to create orders' };
    } catch (error) {
      console.error('Error creating order:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ==================== DEPLOYMENTS ====================

  async getBotDeployment(orderId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/admin/deployments`,
        { headers: this.headers }
      );
      
      const deployments = response.data.deployments || [];
      return deployments.find(d => d.order_id === orderId);
    } catch (error) {
      console.error('Error fetching deployment:', error.message);
      return null;
    }
  }

  async getUserBots(discordId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/admin/deployments`,
        { headers: this.headers }
      );
      
      const deployments = response.data.deployments || [];
      return deployments.filter(d => 
        d.orders && d.orders.users && d.orders.users.discord_tag.startsWith(discordId)
      );
    } catch (error) {
      console.error('Error fetching user bots:', error.message);
      return [];
    }
  }

  // ==================== PAYMENTS ====================

  async getPaymentStatus(orderId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/admin/payments`,
        { headers: this.headers }
      );
      
      const payments = response.data.payments || [];
      return payments.filter(p => p.order_id === orderId);
    } catch (error) {
      console.error('Error fetching payments:', error.message);
      return [];
    }
  }

  // ==================== QUOTES ====================

  async acceptQuote(quoteId, discordId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/internal/quotes/${quoteId}/accept`,
        { discordId },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error accepting quote:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getPaymentMethods() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/payment-methods`
      );
      return response.data.methods || [];
    } catch (error) {
      console.error('Error fetching payment methods:', error.message);
      return [];
    }
  }

  async createPayment(payload) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/internal/payments/create`,
        payload,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating payment:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ==================== PRICING ====================

  async getPricing() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/pricing`
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching pricing:', error.message);
      return null;
    }
  }

  // ==================== PORTFOLIO ====================

  async getPortfolio() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/portfolio`
      );
      
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching portfolio:', error.message);
      return [];
    }
  }

  // ==================== REFERRALS ====================

  async getReferralCode(discordId) {
    try {
      // Need special endpoint that accepts discord_id
      const response = await axios.post(
        `${this.baseUrl}/api/referral/code-by-discord`,
        { discordId },
        { headers: this.headers }
      );
      
      return response.data.code;
    } catch (error) {
      console.error('Error fetching referral code:', error.message);
      return null;
    }
  }

  async trackReferral(referralCode, referredDiscordId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/referral/track`,
        {
          referralCode,
          discordId: referredDiscordId
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error tracking referral:', error.message);
      return { success: false };
    }
  }

  // ==================== DISCOUNT CODES ====================

  async validateDiscountCode(code, orderValue = 0) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/discount-codes/validate`,
        {
          code,
          orderValue
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error validating discount code:', error.message);
      return { valid: false };
    }
  }

  // ==================== NOTIFICATIONS ====================

  async sendWebhookNotification(type, data) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/webhook/discord`,
        {
          type,
          data
        },
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error sending webhook:', error.message);
      return { success: false };
    }
  }
}

module.exports = new WebAppAPI();

