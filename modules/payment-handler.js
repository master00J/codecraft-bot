/**
 * Payment Handler Module for CodeCraft Solutions
 * Manages payment processing and invoicing
 */

const { EmbedBuilder } = require('discord.js');

// Payment gateway configurations
const PAYMENT_METHODS = {
  stripe: {
    name: 'Credit/Debit Card',
    enabled: true,
    icon: '💳',
    description: 'Secure payment via Stripe',
    fee: '2.9% + $0.30'
  },
  paypal: {
    name: 'PayPal',
    enabled: true,
    icon: '💰',
    description: 'Pay with PayPal balance or linked accounts',
    fee: '2.9% + $0.30'
  },
  crypto: {
    name: 'Cryptocurrency',
    enabled: true,
    icon: '₿',
    description: 'Bitcoin, Ethereum, and other cryptocurrencies',
    fee: '1%',
    currencies: ['BTC', 'ETH', 'USDT', 'USDC']
  },
  bank: {
    name: 'Bank Transfer',
    enabled: true,
    icon: '🏦',
    description: 'Direct bank transfer (ACH/Wire)',
    fee: 'No fee',
    minAmount: 500
  }
};

/**
 * Initialize Stripe
 */
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const Stripe = require('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized');
  } catch (error) {
    console.error('❌ Stripe initialization failed:', error.message);
  }
}

/**
 * Initialize PayPal
 */
let paypal = null;
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  try {
    paypal = require('paypal-rest-sdk');
    paypal.configure({
      mode: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox',
      client_id: process.env.PAYPAL_CLIENT_ID,
      client_secret: process.env.PAYPAL_CLIENT_SECRET
    });
    console.log('✅ PayPal initialized');
  } catch (error) {
    console.error('❌ PayPal initialization failed:', error.message);
  }
}

/**
 * Initialize Coinbase Commerce
 */
let coinbase = null;
if (process.env.COINBASE_API_KEY) {
  try {
    const Commerce = require('coinbase-commerce-node');
    coinbase = Commerce.Client.init(process.env.COINBASE_API_KEY);
    console.log('✅ Coinbase Commerce initialized');
  } catch (error) {
    console.error('❌ Coinbase initialization failed:', error.message);
  }
}

/**
 * Process payment
 */
async function processPayment(order, paymentMethod, paymentDetails) {
  try {
    let result = null;
    
    switch (paymentMethod) {
      case 'stripe':
        result = await processStripePayment(order, paymentDetails);
        break;
      case 'paypal':
        result = await processPayPalPayment(order, paymentDetails);
        break;
      case 'crypto':
        result = await processCryptoPayment(order, paymentDetails);
        break;
      case 'bank':
        result = await processBankTransfer(order, paymentDetails);
        break;
      default:
        throw new Error('Invalid payment method');
    }
    
    return result;
    
  } catch (error) {
    console.error('Payment processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process Stripe payment
 */
async function processStripePayment(order, details) {
  if (!stripe) {
    return {
      success: false,
      error: 'Stripe not configured'
    };
  }
  
  try {
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.price * 100), // Convert to cents
      currency: 'usd',
      description: `CodeCraft Order ${order.order_number}`,
      metadata: {
        order_id: order.id,
        order_number: order.order_number
      }
    });
    
    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      instructions: 'Complete payment using the provided client secret'
    };
    
  } catch (error) {
    console.error('Stripe error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process PayPal payment
 */
async function processPayPalPayment(order, details) {
  if (!paypal) {
    return {
      success: false,
      error: 'PayPal not configured'
    };
  }
  
  try {
    const createPaymentJson = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      redirect_urls: {
        return_url: `${process.env.SHOP_WEBSITE}/payment/success`,
        cancel_url: `${process.env.SHOP_WEBSITE}/payment/cancel`
      },
      transactions: [{
        item_list: {
          items: [{
            name: `CodeCraft Order ${order.order_number}`,
            sku: order.order_number,
            price: order.price.toFixed(2),
            currency: 'USD',
            quantity: 1
          }]
        },
        amount: {
          currency: 'USD',
          total: order.price.toFixed(2)
        },
        description: `Payment for order ${order.order_number}`
      }]
    };
    
    return new Promise((resolve, reject) => {
      paypal.payment.create(createPaymentJson, (error, payment) => {
        if (error) {
          reject(error);
        } else {
          const approvalUrl = payment.links.find(link => link.rel === 'approval_url');
          resolve({
            success: true,
            paymentId: payment.id,
            approvalUrl: approvalUrl ? approvalUrl.href : null,
            instructions: 'Click the link to complete payment via PayPal'
          });
        }
      });
    });
    
  } catch (error) {
    console.error('PayPal error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process cryptocurrency payment
 */
async function processCryptoPayment(order, details) {
  if (!coinbase) {
    // Fallback to manual crypto payment
    return {
      success: true,
      manual: true,
      walletAddresses: {
        BTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        ETH: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb8',
        USDT: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9'
      },
      amount: order.price,
      instructions: 'Send payment to the provided wallet address and share transaction hash'
    };
  }
  
  try {
    const Charge = coinbase.resources.Charge;
    const chargeData = {
      name: `CodeCraft Order ${order.order_number}`,
      description: `Payment for order ${order.order_number}`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: order.price.toString(),
        currency: 'USD'
      },
      metadata: {
        order_id: order.id,
        order_number: order.order_number
      }
    };
    
    const charge = await Charge.create(chargeData);
    
    return {
      success: true,
      chargeId: charge.id,
      hostedUrl: charge.hosted_url,
      addresses: charge.addresses,
      instructions: 'Click the link or send crypto to the provided addresses'
    };
    
  } catch (error) {
    console.error('Coinbase error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process bank transfer
 */
async function processBankTransfer(order, details) {
  // Generate bank details for manual transfer
  return {
    success: true,
    manual: true,
    bankDetails: {
      accountName: 'CodeCraft Solutions LLC',
      accountNumber: 'XXXX-XXXX-1234',
      routingNumber: '123456789',
      swift: 'CODECRFT',
      reference: order.order_number
    },
    amount: order.price,
    instructions: 'Transfer funds to the provided account with the reference number'
  };
}

/**
 * Generate invoice
 */
function generateInvoice(order, customer) {
  const invoiceNumber = `INV-${order.order_number}`;
  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const invoice = {
    number: invoiceNumber,
    date: invoiceDate.toISOString(),
    dueDate: dueDate.toISOString(),
    customer: {
      name: customer.discord_tag,
      email: customer.email || 'Not provided',
      discordId: customer.discord_id
    },
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0
  };
  
  // Parse order details
  try {
    const details = JSON.parse(order.service_details);
    if (details.quote) {
      invoice.items = details.quote.items;
      invoice.subtotal = details.quote.subtotal;
      invoice.discount = details.quote.discount;
      invoice.total = details.quote.total;
    }
  } catch (error) {
    // Fallback
    invoice.items = [{
      name: order.service_type,
      price: order.price
    }];
    invoice.total = order.price;
  }
  
  return invoice;
}

/**
 * Generate payment embed
 */
function generatePaymentEmbed(order, invoice) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle(`💳 Payment Required - ${invoice.number}`)
    .setDescription(`Please complete payment for your order`)
    .addFields(
      { name: 'Order Number', value: order.order_number, inline: true },
      { name: 'Amount Due', value: `$${invoice.total.toFixed(2)}`, inline: true },
      { name: 'Due Date', value: new Date(invoice.dueDate).toLocaleDateString(), inline: true }
    );
  
  // Add items
  if (invoice.items && invoice.items.length > 0) {
    const itemsList = invoice.items.map(item => 
      `• ${item.name}: $${item.price.toFixed(2)}`
    ).join('\n');
    embed.addFields({ name: 'Items', value: itemsList, inline: false });
  }
  
  // Add payment methods
  const methods = Object.values(PAYMENT_METHODS)
    .filter(m => m.enabled)
    .map(m => `${m.icon} ${m.name}`)
    .join('\n');
  embed.addFields({ name: 'Payment Methods', value: methods, inline: false });
  
  embed.setFooter({ text: 'Select a payment method below' });
  embed.setTimestamp();
  
  return embed;
}

/**
 * Verify payment status
 */
async function verifyPayment(paymentMethod, paymentId) {
  try {
    switch (paymentMethod) {
      case 'stripe':
        if (!stripe) return { verified: false, error: 'Stripe not configured' };
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
        return { 
          verified: paymentIntent.status === 'succeeded',
          status: paymentIntent.status
        };
        
      case 'paypal':
        if (!paypal) return { verified: false, error: 'PayPal not configured' };
        return new Promise((resolve) => {
          paypal.payment.get(paymentId, (error, payment) => {
            if (error) {
              resolve({ verified: false, error: error.message });
            } else {
              resolve({
                verified: payment.state === 'approved',
                status: payment.state
              });
            }
          });
        });
        
      case 'crypto':
        if (!coinbase) return { verified: false, manual: true };
        const Charge = coinbase.resources.Charge;
        const charge = await Charge.retrieve(paymentId);
        return {
          verified: charge.status === 'confirmed',
          status: charge.status
        };
        
      case 'bank':
        // Manual verification required
        return { verified: false, manual: true };
        
      default:
        return { verified: false, error: 'Unknown payment method' };
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return { verified: false, error: error.message };
  }
}

/**
 * Process refund
 */
async function processRefund(order, amount, reason) {
  try {
    // Determine payment method from order
    const paymentMethod = order.payment_method;
    
    switch (paymentMethod) {
      case 'stripe':
        if (!stripe) throw new Error('Stripe not configured');
        const refund = await stripe.refunds.create({
          payment_intent: order.payment_id,
          amount: Math.round(amount * 100),
          reason: reason
        });
        return { success: true, refundId: refund.id };
        
      case 'paypal':
        // PayPal refund logic
        return { success: true, manual: true, instructions: 'Process refund via PayPal dashboard' };
        
      case 'crypto':
        // Crypto refunds are manual
        return { success: true, manual: true, instructions: 'Send refund to customer wallet' };
        
      case 'bank':
        // Bank refunds are manual
        return { success: true, manual: true, instructions: 'Process bank transfer refund' };
        
      default:
        throw new Error('Cannot process refund for this payment method');
    }
  } catch (error) {
    console.error('Refund error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  PAYMENT_METHODS,
  processPayment,
  generateInvoice,
  generatePaymentEmbed,
  verifyPayment,
  processRefund
};

