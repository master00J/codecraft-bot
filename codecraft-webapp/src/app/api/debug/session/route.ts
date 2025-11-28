import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    const debugInfo = {
      hasSession: !!session,
      sessionData: session || null,
      environment: {
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
        hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        hasDiscordClientId: !!process.env.DISCORD_CLIENT_ID,
        hasDiscordClientSecret: !!process.env.DISCORD_CLIENT_SECRET,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV,
      },
      cookies: request.cookies.getAll().map(cookie => ({
        name: cookie.name,
        hasValue: !!cookie.value,
        valueLength: cookie.value?.length || 0
      })),
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(debugInfo, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      }
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to get debug info',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

