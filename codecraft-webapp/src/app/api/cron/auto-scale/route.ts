import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getPterodactylClient } from '@/lib/pterodactyl/client'
import { analyzeScalingNeed, executeAutoScaling, logResourceCheck } from '@/lib/pterodactyl/auto-scaling'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds max execution

// Auto-scaling cron job
// Should be triggered every 5-10 minutes via Vercel Cron or external cron service
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🤖 Auto-scaling cron job started:', new Date().toISOString())

    const client = getPterodactylClient()
    const results = {
      checked: 0,
      scaled_up: 0,
      scaled_down: 0,
      errors: 0,
      details: [] as any[]
    }

    // Get all active deployments
    const { data: deployments, error: deploymentError } = await supabaseAdmin
      .from('bot_deployments')
      .select('*')
      .eq('status', 'active')

    if (deploymentError || !deployments) {
      throw new Error('Failed to fetch deployments')
    }

    // Check each deployment
    for (const deployment of deployments) {
      try {
        results.checked++

        // Get current resource usage
        const resources = await client.getServerResources(deployment.server_uuid)
        
        const currentUsage = {
          memory_percent: Math.round(
            ((resources.resources?.memory_bytes || 0) / 1024 / 1024 / deployment.memory_mb) * 100
          ),
          cpu_percent: Math.round(
            ((resources.resources?.cpu_absolute || 0) / deployment.cpu_percent) * 100
          ),
          disk_percent: Math.round(
            ((resources.resources?.disk_bytes || 0) / 1024 / 1024 / deployment.disk_mb) * 100
          )
        }

        // Log resource check
        await logResourceCheck(deployment.id, currentUsage)

        // Analyze if scaling is needed
        const decision = await analyzeScalingNeed(
          deployment.id,
          currentUsage,
          {
            memory_mb: deployment.memory_mb,
            cpu_percent: deployment.cpu_percent,
            disk_mb: deployment.disk_mb
          }
        )

        // Execute scaling if recommended
        if (decision.should_scale && decision.new_resources) {
          console.log(`📈 Scaling ${deployment.server_uuid} ${decision.direction}:`, decision.new_resources)
          
          const success = await executeAutoScaling(
            deployment.id,
            deployment.server_uuid,
            decision.new_resources
          )

          if (success) {
            if (decision.direction === 'up') {
              results.scaled_up++
            } else {
              results.scaled_down++
            }

            // Notify customer
            await notifyCustomerOfScaling(deployment, decision)
          } else {
            results.errors++
          }
        }

        results.details.push({
          deployment_id: deployment.id,
          server_name: deployment.pterodactyl_identifier,
          usage: currentUsage,
          decision: decision.reason,
          scaled: decision.should_scale
        })

      } catch (error) {
        console.error(`Error checking deployment ${deployment.id}:`, error)
        results.errors++
      }
    }

    console.log('✅ Auto-scaling cron job completed:', results)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    })

  } catch (error) {
    console.error('❌ Auto-scaling cron job failed:', error)
    return NextResponse.json({
      error: 'Cron job failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Notify customer when resources are scaled
async function notifyCustomerOfScaling(
  deployment: any,
  decision: any
): Promise<void> {
  try {
    // Get customer info
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, users(discord_id, email)')
      .eq('id', deployment.order_id)
      .single()

    if (!order) return

    // You could send Discord DM, email, or in-app notification here
    // For now, we'll just log to deployment_logs
    await supabaseAdmin
      .from('deployment_logs')
      .insert({
        deployment_id: deployment.id,
        action: 'customer_notification',
        status: 'success',
        details: {
          type: 'auto_scaling',
          direction: decision.direction,
          new_resources: decision.new_resources,
          message: `Your bot resources were automatically ${decision.direction === 'up' ? 'increased' : 'decreased'} based on usage patterns`
        },
        performed_by: 'system'
      })

    console.log(`📧 Customer notified of scaling for deployment ${deployment.id}`)
  } catch (error) {
    console.error('Failed to notify customer:', error)
  }
}

