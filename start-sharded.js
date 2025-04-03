/**
 * Discord Modmail Bot - Server-Based Sharding Starter
 * 
 * This script starts the bot in server-based sharding mode for production use.
 */
console.log('Starting Discord Modmail Bot with server-based sharding...');

// Load the sharding manager
require('./shard.js');

// This script will remain running as long as the shard manager is active
console.log('Shard manager initialized. Bot should be online shortly.');
console.log('Press Ctrl+C to stop all shards and exit.');