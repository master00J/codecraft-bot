import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get average response time from last 30 days
    const { data, error } = await supabaseAdmin
      .from('chat_response_stats')
      .select('*')
      .single()

    if (error) {
      console.error('Error fetching chat stats:', error)
      // Return default if view doesn't exist yet
      return NextResponse.json({
        avgResponseSeconds: 7200, // 2 hours default
        totalResponses: 0
      })
    }

    return NextResponse.json({
      avgResponseSeconds: data?.avg_response_seconds || 7200,
      medianResponseSeconds: data?.median_response_seconds || 7200,
      totalResponses: data?.total_responses || 0
    })

  } catch (error) {
    console.error('Error in chat stats:', error)
    return NextResponse.json({
      avgResponseSeconds: 7200,
      totalResponses: 0
    })
  }
}

