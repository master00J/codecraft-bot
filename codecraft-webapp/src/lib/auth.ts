import { NextAuthOptions } from 'next-auth'
import DiscordProvider from 'next-auth/providers/discord'
import { supabaseAdmin } from './supabase/server'

const nextAuthSecret = process.env.NEXTAUTH_SECRET || 'placeholder-nextauth-secret'
const discordClientId = process.env.DISCORD_CLIENT_ID
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET

if (!process.env.NEXTAUTH_SECRET) {
  console.warn(
    'NEXTAUTH_SECRET is not configured. Falling back to a placeholder secret for build-time compatibility. ' +
    'Set NEXTAUTH_SECRET in your environment for production.'
  )
}

if (!discordClientId || !discordClientSecret) {
  console.error('❌ Discord credentials not set!')
  console.log('Required: DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET')
}

console.log('🔧 Auth config loaded:', {
  hasNextAuthSecret: !!nextAuthSecret,
  hasDiscordClientId: !!discordClientId,
  hasDiscordClientSecret: !!discordClientSecret,
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
})

// Force OAuth callbacks to always use the correct URL
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'https://codecraft-solutions.com'

export const authOptions: NextAuthOptions = {
  // Always use the configured URL for OAuth callbacks
  ...(NEXTAUTH_URL && { url: NEXTAUTH_URL }),
  
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: 'identify',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // First time JWT callback runs (during sign in)
      if (account?.provider === 'discord' && profile) {
        const discordProfile = profile as any
        
        console.log('🔐 Discord OAuth - Creating/updating user:', discordProfile.username)
        console.log('Discord profile:', {
          id: discordProfile.id,
          username: discordProfile.username,
          discriminator: discordProfile.discriminator
        })
        
        // ALWAYS set Discord info in token (even if Supabase fails)
        token.discordId = discordProfile.id
        token.discordTag = `${discordProfile.username}#${discordProfile.discriminator || '0'}`
        token.isAdmin = false
        
        // Also store in sub for fallback
        token.sub = discordProfile.id
        
        try {
          // Upsert user in Supabase
          if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const { data: existingUser } = await supabaseAdmin
              .from('users')
              .select('*')
              .eq('discord_id', discordProfile.id)
              .single()

            let dbUser
            if (existingUser) {
              // Update existing user
              const { data: updated } = await supabaseAdmin
                .from('users')
                .update({
                  discord_tag: `${discordProfile.username}#${discordProfile.discriminator || '0'}`,
                  email: discordProfile.email || existingUser.email,
                  avatar_url: discordProfile.avatar
                    ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`
                    : existingUser.avatar_url,
                  updated_at: new Date().toISOString()
                })
                .eq('discord_id', discordProfile.id)
                .select()
                .single()
              
              dbUser = updated || existingUser
            } else {
              // Create new user
              const { data: newUser } = await supabaseAdmin
                .from('users')
                .insert({
                  discord_id: discordProfile.id,
                  discord_tag: `${discordProfile.username}#${discordProfile.discriminator || '0'}`,
                  email: discordProfile.email || null,
                  avatar_url: discordProfile.avatar
                    ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png`
                    : null,
                  is_admin: false
                })
                .select()
                .single()
              
              dbUser = newUser
            }

            // Update token with Supabase data
            if (dbUser) {
              token.id = dbUser.id
              token.isAdmin = dbUser.is_admin || false
              console.log('✅ User synced to Supabase:', dbUser.discord_tag, 'Admin:', dbUser.is_admin)
            } else {
              console.log('⚠️ User not in Supabase but continuing anyway')
            }
          } else {
            console.log('⚠️ Supabase not configured - using Discord data only')
          }
        } catch (error) {
          console.error('❌ Error syncing user to Supabase:', error)
          console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
          // Continue anyway - token already has Discord data
          console.log('✅ Continuing with Discord data despite Supabase error')
        }
      }

      console.log('✅ JWT token generated successfully')
      return token
    },
    async session({ session, token }) {
      console.log('📦 Session callback - Token contents:', {
        id: token.id,
        discordId: token.discordId,
        discordTag: token.discordTag,
        isAdmin: token.isAdmin,
        sub: token.sub,
        name: token.name
      })

      if (session.user) {
        // @ts-ignore - Add custom fields
        session.user.id = token.id as string || token.sub as string
        // @ts-ignore - Use sub as fallback for discordId
        session.user.discordId = token.discordId as string || token.sub as string
        // @ts-ignore
        session.user.discordTag = token.discordTag as string || token.name as string
        // @ts-ignore
        session.user.isAdmin = token.isAdmin as boolean || false

        // @ts-ignore - Logging custom fields
        const { id, discordId, discordTag, isAdmin } = session.user
        console.log('✅ Session user after mapping:', { id, discordId, discordTag, isAdmin })
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  // Let NextAuth handle cookie configuration automatically
  // This ensures correct secure prefixes in production
  debug: process.env.NODE_ENV === 'development', // Only debug in development
  secret: nextAuthSecret,
}

