# Monkey Bytes Discord Bot 👑

A comprehensive Discord logging and moderation bot for "The Royal Court" that tracks all server activities with configurable categories and channels.

## Features

### 📝 Comprehensive Logging

The bot logs all server activities including:
- **Messages**: Creations, edits, and deletions
- **Members**: Joins, leaves, and updates
- **Voice**: Voice channel activity
- **Roles**: Creations, deletions, and updates
- **Channels**: Creations, deletions, and updates
- **Server**: Server-wide events and setting changes

### ⚙️ Commands

#### Setup Command
- `/setup`: Initialize the bot for your server (restricted to server owners and administrators)
  - Creates a logging channel
  - Configures which log categories to enable
  - Sets up the logging system

#### Management Commands
- `/enable`: Enable specific logging categories
- `/disable`: Disable specific logging categories
- `/ignore`: Configure channels or roles to be ignored by the logging system
- `/categories`: View and manage logging categories
- `/logs`: Configure logging channels for different categories

#### Information Commands
- `/help`: Display help information and command usage
- `/ping`: Check the bot's latency
- `/stats`: View bot statistics

### 🔧 Configuration Options

- **Per-Category Logging**: Direct different event types to separate channels
- **Ignore Filters**: Exclude specific channels or roles from logging
- **Customizable Permissions**: Limit access to log commands

## Setup Instructions

1. **Invite the Bot**: Use the invitation link provided in the server
2. **Run the Setup Command**: Use `/setup` to initialize the bot
3. **Configure Categories**: Select which log categories to enable
4. **Set Up Channels**: Optionally configure separate channels for different log categories
5. **Set Ignore Rules**: Configure channels or roles to ignore if needed

## Command Usage Examples

### Setup
```
/setup
```
Follow the interactive prompts to configure the bot.

### Managing Log Channels
```
/logs setchannel [category] [channel]
```
Example: `/logs setchannel messages #message-logs`

### Ignoring Channels
```
/ignore channel [channel]
```
Example: `/ignore channel #bot-commands`

### View Command Help
```
/help [command]
```
Example: `/help logs`

## Hosting Information

The bot is hosted on Replit for 24/7 uptime. It uses a SQLite database to store server configurations and settings.

## Technical Details

- Built with Node.js and Discord.js v14
- Event-driven architecture for efficient event handling
- Custom embed builder for consistent message formatting
- Winston logger for internal logging
- Auto-scaling with Discord.js Sharding Manager

### Auto-Scaling Capabilities

The bot implements Discord.js Sharding Manager to efficiently scale across multiple servers:
- Custom sharding strategy that creates 1 shard for every guild (Discord-recommended approach)
- Optimal performance with dedicated resources per server
- Distributes server load across multiple processes
- Maintains performance as the bot grows in popularity
- Implements robust retry mechanism with exponential backoff for API rate limits
- Enhanced error handling and recovery for Discord API connections
- Collects and aggregates stats across all shards
- Handles inter-shard communication for global statistics

## Support

For support or questions, contact the Monkey Bytes team.

---

© 2025 Monkey Bytes - The Royal Court. All rights reserved.