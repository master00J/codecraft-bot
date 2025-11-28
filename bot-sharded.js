/**
 * Comcraft Bot - Sharded Version
 * This file manages multiple shards for the main bot
 * Use this when the bot is in 2500+ servers
 */

const { ShardingManager } = require('discord.js');
const path = require('path');

// Check if sharding is needed
const shardCount = process.env.SHARD_COUNT === 'auto' 
  ? 'auto' 
  : parseInt(process.env.SHARD_COUNT) || 1;

if (shardCount === 1) {
  console.log('ℹ️ Sharding disabled (SHARD_COUNT=1). Starting single instance...');
  // If no sharding needed, just start the bot directly
  require('./bot-comcraft.js');
} else {
  console.log(`🚀 Starting Comcraft Bot with ${shardCount === 'auto' ? 'auto' : shardCount} shard(s)...`);

  const manager = new ShardingManager('./bot-comcraft.js', {
    totalShards: shardCount,
    token: process.env.DISCORD_BOT_TOKEN,
    respawn: true, // Auto-respawn shards on crash
    mode: 'worker', // Use worker mode (worker threads, not child processes) - TOS compliant
  });

  manager.on('shardCreate', shard => {
    console.log(`✅ Launched shard ${shard.id} (${shard.id + 1}/${manager.totalShards})`);
    
    shard.on('ready', () => {
      console.log(`✅ Shard ${shard.id} is ready!`);
    });

    shard.on('error', error => {
      console.error(`❌ Shard ${shard.id} error:`, error);
    });

    shard.on('disconnect', () => {
      console.warn(`⚠️ Shard ${shard.id} disconnected`);
    });

    shard.on('reconnecting', () => {
      console.log(`🔄 Shard ${shard.id} reconnecting...`);
    });

    shard.on('death', () => {
      console.error(`💀 Shard ${shard.id} died`);
    });
  });

  manager.on('shardDisconnect', (event, id) => {
    console.warn(`⚠️ Shard ${id} disconnected:`, event);
  });

  manager.on('shardReconnecting', id => {
    console.log(`🔄 Shard ${id} reconnecting...`);
  });

  manager.on('shardReady', id => {
    console.log(`✅ Shard ${id} is ready!`);
  });

  manager.on('shardResume', id => {
    console.log(`🔄 Shard ${id} resumed`);
  });

  manager.spawn().catch(error => {
    console.error('❌ Error spawning shards:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT. Shutting down gracefully...');
    manager.shards.forEach(shard => {
      shard.kill();
    });
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM. Shutting down gracefully...');
    manager.shards.forEach(shard => {
      shard.kill();
    });
    process.exit(0);
  });
}

