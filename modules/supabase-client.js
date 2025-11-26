/**
 * Supabase Client Configuration for Discord Bot
 * Provides database connectivity for orders, tickets, users, etc.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
let supabase = null;

/**
 * Initialize Supabase connection
 * @returns {Object} Supabase client instance
 */
function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️  Supabase credentials not found. Database features will be limited.');
    console.warn('   Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env file');
    return null;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ Supabase client initialized successfully');
    return supabase;
  } catch (error) {
    console.error('❌ Error initializing Supabase:', error);
    return null;
  }
}

/**
 * Get Supabase client instance
 * @returns {Object|null} Supabase client or null if not initialized
 */
function getSupabase() {
  if (!supabase) {
    return initializeSupabase();
  }
  return supabase;
}

/**
 * Check if Supabase is available
 * @returns {boolean} True if Supabase is configured and working
 */
function isSupabaseAvailable() {
  return supabase !== null;
}

/**
 * Get or create user in Supabase
 * @param {string} discordId - Discord user ID
 * @param {string} discordTag - Discord username#discriminator
 * @param {string} [email] - User email (optional)
 * @param {string} [avatarUrl] - User avatar URL (optional)
 * @returns {Object|null} User object or null
 */
async function getOrCreateUser(discordId, discordTag, email = null, avatarUrl = null) {
  const client = getSupabase();
  if (!client) return null;

  try {
    // Try to get existing user
    const { data: existingUser, error: fetchError } = await client
      .from('users')
      .select('*')
      .eq('discord_id', discordId)
      .single();

    if (existingUser) {
      // Update user info if changed
      const { data: updatedUser } = await client
        .from('users')
        .update({
          discord_tag: discordTag,
          email: email || existingUser.email,
          avatar_url: avatarUrl || existingUser.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('discord_id', discordId)
        .select()
        .single();
      
      return updatedUser || existingUser;
    }

    // Create new user
    const { data: newUser, error: createError } = await client
      .from('users')
      .insert({
        discord_id: discordId,
        discord_tag: discordTag,
        email: email,
        avatar_url: avatarUrl,
        is_admin: false
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return null;
    }

    return newUser;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    return null;
  }
}

/**
 * Generate unique order number
 * @returns {string} Order number (e.g., CC123456ABC)
 */
function generateOrderNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).slice(-3).toUpperCase();
  return `CC${timestamp}${random}`;
}

/**
 * Generate unique ticket number
 * @returns {string} Ticket number (e.g., TC123456ABC)
 */
function generateTicketNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).slice(-3).toUpperCase();
  return `TC${timestamp}${random}`;
}

module.exports = {
  initializeSupabase,
  getSupabase,
  isSupabaseAvailable,
  getOrCreateUser,
  generateOrderNumber,
  generateTicketNumber
};

