# Server-Based Sharding Implementation

## Overview

This Discord bot implements a custom "one shard per server" sharding approach that allocates a dedicated shard to each Discord server (guild) the bot is connected to. This is different from standard Discord.js sharding, which distributes guilds across shards based on their ID.

## Advantages

1. **Improved Resource Isolation**: Each server gets its own dedicated resources, preventing heavy usage in one server from impacting others.

2. **Better Error Containment**: If an error occurs in one shard, it only affects that specific server, not multiple servers.

3. **Server-Specific Optimization**: Resource allocation can be tailored to each server's specific needs.

4. **Easier Debugging**: Issues can be traced to specific servers more easily since each has its own shard.

## Implementation Components

### 1. Shard Manager (`shard.js`)

The Shard Manager:
- Retrieves the list of guilds the bot is connected to
- Creates a mapping of guild IDs to shard IDs (one guild per shard)
- Saves this mapping to a file for reference by shards
- Creates and manages individual shards using Discord.js ShardingManager
- Passes the appropriate guild ID to each shard

Key functions:
- `getConnectedGuilds()`: Fetches all guilds the bot is connected to
- `setupShardManager()`: Creates the guild-to-shard mapping and initializes the manager
- `setupShardListeners()`: Sets up event handlers for shard lifecycle events
- `startManager()`: Spawns all shards and begins operation

### 2. Shard Entry Point (`bot.js`)

The Bot Entry Point:
- Parses command-line arguments to determine sharding mode
- Loads the guild-to-shard mapping file
- Identifies which guild is assigned to the current shard
- Sets environment variables to pass this information to the bot code
- Handles errors and restarts appropriately

### 3. Bot Initialization (`src/index.js`)

The Main Bot Code:
- Detects sharding mode (server-based, standard, or standalone)
- Configures the Discord.js client with appropriate sharding options
- Stores shard information on the client for reference by event handlers
- Adjusts behavior based on sharding mode

### 4. Event Handlers

Event handlers, particularly the ready event (`src/events/discord.ready.js`), use the sharding information to:
- Log appropriate startup information
- Set status messages specific to the sharding mode
- Register commands only for the assigned guild (in server-based mode)
- Implement guild-specific features

## Usage

To run the bot with server-based sharding:

```bash
node shard.js
```

This will:
1. Fetch the list of connected guilds
2. Create a mapping file (`guild_shard_map.json`)
3. Spawn one shard per guild
4. Start the bot with appropriate guild assignments

## Testing

Test files have been created to validate the sharding implementation:

1. `test/server-sharding-test.js`: Tests the core functionality of server-based sharding
2. `test/sharding-modes-test.js`: Comprehensively tests all three sharding modes

## Monitoring

Logs are tagged with shard and guild information for easy identification:
- Standalone mode: Standard logging
- Standard sharding: `STANDARD SHARD x/y` prefix
- Server-based sharding: `SERVER-DEDICATED SHARD x` with guild information