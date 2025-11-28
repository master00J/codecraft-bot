import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET - Get user's referral code
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const discordId = session.user.discordId || session.user.id || session.user.sub
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 })
    }

    // Get referral code
    const { data: referralCode, error } = await supabaseAdmin
      .from('referral_codes')
      .select('*')
      .eq('discord_id', discordId)
      .single()

    if (error) {
      // Create one if doesn't exist
      const code = await generateUniqueCode(discordId)
      
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('discord_id', discordId)
        .single()

      const { data: newCode, error: insertError } = await supabaseAdmin
        .from('referral_codes')
        .insert({
          user_id: user?.id,
          discord_id: discordId,
          code: code
        })
        .select()
        .single()

      if (insertError) throw insertError

      return NextResponse.json({
        code: newCode,
        isNew: true
      })
    }

    return NextResponse.json({
      code: referralCode,
      isNew: false
    })

  } catch (error) {
    console.error('Error fetching referral code:', error)
    return NextResponse.json({
      error: 'Failed to fetch referral code',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

async function generateUniqueCode(discordId: string): Promise<string> {
  const base = discordId.substring(0, 6).toUpperCase()
  let code = base
  let attempts = 0

  while (attempts < 10) {
    const { data } = await supabaseAdmin
      .from('referral_codes')
      .select('id')
      .eq('code', code)
      .single()

    if (!data) {
      return code
    }

    // Add random suffix
    code = base + Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    attempts++
  }

  // Fallback to completely random
  return 'REF' + Math.random().toString(36).substring(2, 12).toUpperCase()
}

