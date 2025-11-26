/**
 * Webhook Listener for Discord Bot
 * Receives notification requests from webapp
 */

const express = require('express');
const DiscordNotifier = require('./discord-notifications');

class WebhookListener {
  constructor(client, port = 3001) {
    this.client = client;
    this.port = port;
    this.app = express();
    this.notifier = new DiscordNotifier(client);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    
    // Security middleware - verify requests are from webapp
    this.app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      const expectedToken = `Bearer ${process.env.DISCORD_BOT_TOKEN}`;
      
      if (req.path === '/health') {
        return next(); // Health check doesn't need auth
      }
      
      if (authHeader !== expectedToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        bot: this.client.user?.tag || 'not ready',
        uptime: process.uptime()
      });
    });

    // Main webhook endpoint
    this.app.post('/notify', async (req, res) => {
      try {
        const { type, discordId, data } = req.body;
        
        if (!type || !discordId) {
          return res.status(400).json({ 
            error: 'Missing required fields: type, discordId' 
          });
        }

        console.log(`📬 Received notification: ${type} for ${discordId}`);

        let result;
        
        switch (type) {
          case 'order.created':
            result = await this.notifier.notifyOrderCreated(discordId, data);
            break;
          
          case 'quote.sent':
            result = await this.notifier.notifyQuoteSent(discordId, data);
            break;
          
          case 'payment.verified':
            result = await this.notifier.notifyPaymentVerified(discordId, data);
            break;
          
          case 'bot.deployed':
            result = await this.notifier.notifyBotDeployed(discordId, data);
            break;
          
          case 'bot.offline':
            result = await this.notifier.notifyBotOffline(discordId, data);
            break;
          
          case 'payment.due':
            result = await this.notifier.notifyPaymentDue(discordId, data);
            break;
          
          case 'subscription.suspended':
            result = await this.notifier.notifySubscriptionSuspended(discordId, data);
            break;
          
          case 'referral.earned':
            result = await this.notifier.notifyReferralEarned(discordId, data);
            break;
          
          case 'ticket.response':
            result = await this.notifier.notifyTicketResponse(discordId, data);
            break;
          
          default:
            console.warn(`Unknown notification type: ${type}`);
            return res.status(400).json({ 
              error: `Unknown notification type: ${type}` 
            });
        }

        if (result.success) {
          res.json({ 
            success: true, 
            message: 'Notification sent to Discord'
          });
        } else {
          res.status(500).json({ 
            success: false, 
            error: result.error 
          });
        }

      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ 
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // Bulk notify endpoint
    this.app.post('/notify-bulk', async (req, res) => {
      try {
        const { notifications } = req.body;
        
        if (!Array.isArray(notifications)) {
          return res.status(400).json({ 
            error: 'notifications must be an array' 
          });
        }

        const results = await Promise.allSettled(
          notifications.map(n => 
            this.notifier[`notify${n.type.replace('.', '')}`]?.(n.discordId, n.data)
          )
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        res.json({
          success: true,
          sent: successful,
          failed
        });

      } catch (error) {
        console.error('Error in bulk notification:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  start() {
    try {
      const server = this.app.listen(this.port, () => {
        console.log(`🎣 Webhook listener running on port ${this.port}`);
        console.log(`📬 Ready to receive notifications from webapp`);
      });

      server.on('error', (error) => {
        console.error('⚠️ Webhook listener error:', error);
      });
    } catch (error) {
      console.error('❌ Failed to start webhook listener:', error);
    }
  }
}

module.exports = WebhookListener;

