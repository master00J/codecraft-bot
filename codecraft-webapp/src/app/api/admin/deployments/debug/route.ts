import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPterodactylClient } from '@/lib/pterodactyl/client'
import { PTERODACTYL_CONFIG } from '@/lib/pterodactyl/tier-config'

export const dynamic = 'force-dynamic'

// Debug endpoint to check Pterodactyl configuration
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // @ts-ignore
    if (!session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const client = getPterodactylClient()
    const checks: any = {
      environment_variables: {
        PTERODACTYL_PANEL_URL: !!process.env.PTERODACTYL_PANEL_URL,
        PTERODACTYL_API_KEY: !!process.env.PTERODACTYL_API_KEY,
        PTERODACTYL_PARENT_SERVER_UUID: !!process.env.PTERODACTYL_PARENT_SERVER_UUID,
        PTERODACTYL_BOT_EGG_ID: !!process.env.PTERODACTYL_BOT_EGG_ID,
        WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET,
      },
      config_values: {
        panel_url: process.env.PTERODACTYL_PANEL_URL || 'NOT SET',
        parent_uuid: PTERODACTYL_CONFIG.PARENT_SERVER_UUID || 'NOT SET',
        egg_id: PTERODACTYL_CONFIG.DEFAULT_EGG_ID,
        api_key_length: process.env.PTERODACTYL_API_KEY?.length || 0
      },
      tests: {}
    }

    // Test 1: Account access
    try {
      const account = await client.getAccountInfo()
      checks.tests.account = {
        status: 'success',
        user_id: account.id,
        username: account.username
      }
    } catch (error) {
      checks.tests.account = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: List sub-servers
    try {
      const subServers = await client.listSubServers()
      checks.tests.list_subservers = {
        status: 'success',
        count: subServers.length,
        servers: subServers.map((s: any) => ({
          name: s.attributes?.name || s.name,
          uuid: s.attributes?.uuid || s.uuid
        }))
      }
    } catch (error) {
      checks.tests.list_subservers = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Available eggs
    try {
      const eggs = await client.getAvailableEggs()
      checks.tests.available_eggs = {
        status: 'success',
        count: eggs.length,
        eggs: eggs.map((e: any) => ({
          id: e.attributes?.id || e.id,
          name: e.attributes?.name || e.name
        }))
      }
    } catch (error) {
      checks.tests.available_eggs = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      status: 'debug_info',
      checks,
      recommendations: [
        !checks.environment_variables.PTERODACTYL_PARENT_SERVER_UUID && 'Set PTERODACTYL_PARENT_SERVER_UUID in Vercel!',
        !checks.environment_variables.PTERODACTYL_API_KEY && 'Set PTERODACTYL_API_KEY in Vercel!',
        checks.tests.account?.status === 'failed' && 'API Key is invalid or expired!',
        checks.tests.list_subservers?.status === 'failed' && 'Cannot access sub-servers - check PARENT_SERVER_UUID!',
      ].filter(Boolean)
    })

  } catch (error) {
    console.error('Error in debug endpoint:', error)
    return NextResponse.json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

