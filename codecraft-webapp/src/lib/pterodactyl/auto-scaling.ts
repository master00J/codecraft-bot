// Intelligent Auto-Scaling System for Discord Bots

import { getPterodactylClient } from './client'
import { TIER_CONFIGS, PTERODACTYL_CONFIG } from './tier-config'
import { supabaseAdmin } from '@/lib/supabase/server'

interface ScalingDecision {
  should_scale: boolean
  direction: 'up' | 'down' | 'none'
  reason: string
  new_resources?: {
    memory: number
    cpu: number
    disk: number
  }
}

interface ResourceUsage {
  memory_percent: number
  cpu_percent: number
  disk_percent: number
}

// Thresholds for auto-scaling
const SCALING_THRESHOLDS = {
  // Scale up when usage exceeds these for 3+ checks
  scale_up: {
    memory: 85, // 85% RAM usage
    cpu: 85,    // 85% CPU usage
    disk: 80    // 80% disk usage
  },
  // Scale down when usage below these for 10+ checks
  scale_down: {
    memory: 30, // 30% RAM usage
    cpu: 30,    // 30% CPU usage
    disk: 30    // 30% disk usage
  },
  // Minimum checks before scaling
  checks_before_scale_up: 3,   // 3 checks = ~15 minutes
  checks_before_scale_down: 10 // 10 checks = ~50 minutes
}

// Resource increments
const RESOURCE_INCREMENTS = {
  memory_mb: 256, // +256MB per scale
  cpu_percent: 25, // +25% per scale
  disk_mb: 1024   // +1GB per scale
}

export async function analyzeScalingNeed(
  deploymentId: string,
  currentUsage: ResourceUsage,
  currentLimits: { memory_mb: number; cpu_percent: number; disk_mb: number }
): Promise<ScalingDecision> {
  
  // Get scaling history
  const { data: history } = await supabaseAdmin
    .from('deployment_logs')
    .select('*')
    .eq('deployment_id', deploymentId)
    .eq('action', 'resource_check')
    .order('created_at', { ascending: false })
    .limit(SCALING_THRESHOLDS.checks_before_scale_down)

  // Check if any resource is consistently high
  const highUsageCount = history?.filter(log => {
    const details = log.details as any
    return (
      details?.memory_percent > SCALING_THRESHOLDS.scale_up.memory ||
      details?.cpu_percent > SCALING_THRESHOLDS.scale_up.cpu ||
      details?.disk_percent > SCALING_THRESHOLDS.scale_up.disk
    )
  }).length || 0

  // Check if all resources are consistently low
  const lowUsageCount = history?.filter(log => {
    const details = log.details as any
    return (
      details?.memory_percent < SCALING_THRESHOLDS.scale_down.memory &&
      details?.cpu_percent < SCALING_THRESHOLDS.scale_down.cpu &&
      details?.disk_percent < SCALING_THRESHOLDS.scale_down.disk
    )
  }).length || 0

  // Decision: Scale UP
  if (highUsageCount >= SCALING_THRESHOLDS.checks_before_scale_up) {
    const highestResource = 
      currentUsage.memory_percent > 85 ? 'memory' :
      currentUsage.cpu_percent > 85 ? 'cpu' :
      currentUsage.disk_percent > 80 ? 'disk' : null

    return {
      should_scale: true,
      direction: 'up',
      reason: `High ${highestResource} usage detected for ${highUsageCount} consecutive checks`,
      new_resources: {
        memory: Math.min(
          currentLimits.memory_mb + RESOURCE_INCREMENTS.memory_mb,
          2048 // Max 2GB per bot
        ),
        cpu: Math.min(
          currentLimits.cpu_percent + RESOURCE_INCREMENTS.cpu_percent,
          200 // Max 200% per bot
        ),
        disk: Math.min(
          currentLimits.disk_mb + RESOURCE_INCREMENTS.disk_mb,
          10240 // Max 10GB per bot
        )
      }
    }
  }

  // Decision: Scale DOWN (cost optimization)
  if (lowUsageCount >= SCALING_THRESHOLDS.checks_before_scale_down) {
    // Get tier minimum resources
    const tierConfig = Object.values(TIER_CONFIGS).find(
      t => t.memory_mb === currentLimits.memory_mb
    )
    
    // Don't scale below tier minimum
    if (tierConfig) {
      return {
        should_scale: false,
        direction: 'none',
        reason: 'Already at tier minimum resources'
      }
    }

    return {
      should_scale: true,
      direction: 'down',
      reason: `Low resource usage for ${lowUsageCount} consecutive checks`,
      new_resources: {
        memory: Math.max(
          currentLimits.memory_mb - RESOURCE_INCREMENTS.memory_mb,
          512 // Min 512MB
        ),
        cpu: Math.max(
          currentLimits.cpu_percent - RESOURCE_INCREMENTS.cpu_percent,
          25 // Min 25%
        ),
        disk: Math.max(
          currentLimits.disk_mb - RESOURCE_INCREMENTS.disk_mb,
          2048 // Min 2GB
        )
      }
    }
  }

  // No scaling needed
  return {
    should_scale: false,
    direction: 'none',
    reason: 'Resource usage within acceptable range'
  }
}

export async function executeAutoScaling(
  deploymentId: string,
  subServerUuid: string,
  newResources: { memory: number; cpu: number; disk: number }
): Promise<boolean> {
  const client = getPterodactylClient()
  const parentUuid = PTERODACTYL_CONFIG.PARENT_SERVER_UUID

  if (!parentUuid) {
    console.error('Parent server UUID not configured')
    return false
  }

  try {
    // Get current deployment
    const { data: deployment } = await supabaseAdmin
      .from('bot_deployments')
      .select('*')
      .eq('id', deploymentId)
      .single()

    if (!deployment) {
      throw new Error('Deployment not found')
    }

    // Update resources via Splitter API
    await client.request(
      `/servers/${parentUuid}/splitter/${subServerUuid}`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: deployment.name || `bot_${subServerUuid.substring(0, 8)}`,
          cpu: newResources.cpu,
          memory: newResources.memory,
          disk: newResources.disk,
          egg_id: PTERODACTYL_CONFIG.DEFAULT_EGG_ID,
          copy_subusers: PTERODACTYL_CONFIG.COPY_SUBUSERS,
          localhost_networking: PTERODACTYL_CONFIG.LOCALHOST_NETWORKING
        })
      }
    )

    // Update database
    await supabaseAdmin
      .from('bot_deployments')
      .update({
        memory_mb: newResources.memory,
        cpu_percent: newResources.cpu,
        disk_mb: newResources.disk
      })
      .eq('id', deploymentId)

    // Log the scaling action
    await supabaseAdmin
      .from('deployment_logs')
      .insert({
        deployment_id: deploymentId,
        action: 'auto_scale',
        status: 'success',
        details: {
          old_resources: {
            memory: deployment.memory_mb,
            cpu: deployment.cpu_percent,
            disk: deployment.disk_mb
          },
          new_resources: newResources,
          reason: 'Auto-scaled based on usage'
        },
        performed_by: 'system'
      })

    console.log(`✅ Auto-scaled bot ${subServerUuid}:`, newResources)
    return true

  } catch (error) {
    console.error('Auto-scaling failed:', error)
    
    // Log failure
    await supabaseAdmin
      .from('deployment_logs')
      .insert({
        deployment_id: deploymentId,
        action: 'auto_scale',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        performed_by: 'system'
      })

    return false
  }
}

// Log resource check for history
export async function logResourceCheck(
  deploymentId: string,
  usage: ResourceUsage
): Promise<void> {
  await supabaseAdmin
    .from('deployment_logs')
    .insert({
      deployment_id: deploymentId,
      action: 'resource_check',
      status: 'success',
      details: usage,
      performed_by: 'system'
    })
}

