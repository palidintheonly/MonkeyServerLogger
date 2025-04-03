# MonkeyBytes Discord Modmail Bot 📬

**Version 2.0.0 - The Royal Court**

A dedicated Discord modmail bot by MonkeyBytes that enables users to contact server staff through direct messages, with support for multiple servers and comprehensive moderation tools.

## Features

### 📬 Modmail System

- **Cross-Server Support**: Users can contact any server where modmail is enabled
- **Server Selection**: If a user is in multiple servers with modmail enabled, they can select which server to contact
- **Thread Management**: Staff can reply to, close, and generate transcripts of modmail conversations
- **User Experience**: Clean, intuitive interface for users to communicate with server staff

### ⚙️ Commands

#### Admin Commands
- `/modmail-setup`: Configure modmail for your server
  - Enable/disable the modmail system
  - Set up custom welcome messages
  - Configure modmail channels and categories

- `/modmail-stats`: View statistics about modmail usage
  - Overview of active and closed threads
  - Usage statistics by timeframe
  - User engagement metrics

- `/status`: Display bot status information
  - Uptime and performance metrics
  - Memory usage and response times
  - Server connectivity information

#### General Commands
- `/guilds`: View a list of servers where you can use modmail
- `/help`: Get information about available commands
- `/info`: View information about the bot
- `/ping`: Check the bot's latency

### 🛡️ Safety & Privacy

- **Data Protection**: All conversations are stored securely
- **Transcript Generation**: Staff can generate HTML transcripts of conversations
- **Automated Backups**: Regular database backups to prevent data loss

## Setup Instructions

1. **Invite the Bot**: Use the official invitation link
2. **Run the Setup Command**: Use `/modmail-setup enable` to initialize modmail
3. **Configure Settings**: Customize your modmail experience
4. **Inform Your Members**: Let your server members know they can contact staff via DM

## Command Usage Examples

### Setting Up Modmail
```
/modmail-setup enable
```

### Checking Modmail Status
```
/modmail-setup status
```

### Viewing Modmail Statistics
```
/modmail-stats overview
```

### Checking Bot Status
```
/status
```

## Technical Information

The bot is built with modern technologies for reliability and performance:

### Core Technologies
- **Node.js & Discord.js v14**: Latest Discord API features and optimizations
- **Custom Server-Based Sharding**: One shard per server for improved reliability and resource isolation
- **SQLite Database**: Efficient and reliable data storage with automated backups
- **Custom Embed Builder**: Professional and consistent message formatting
- **Winston Logger**: Comprehensive logging for troubleshooting and monitoring

### Recent Improvements
- **Server-Based Sharding**: Implemented custom one-shard-per-server approach for better resource allocation
- **Enhanced Database Reliability**: Fixed circular reference handling in Guild model
- **API Compatibility**: Updated to latest Discord.js interaction patterns
- **Deprecation Fixes**: Replaced deprecated API calls with current standards
- **Robust Error Handling**: Improved error recovery and exception management

### Data Security
- **Automated Backups**: Regular database backups performed every 24 hours
- **Safe Deepmerge Implementation**: Prevents stack overflow with circular references
- **Input Validation**: Comprehensive validation on all user inputs
- **Error Recovery**: Graceful handling of API errors and rate limits

## Deployment

The bot is hosted on Replit for 24/7 uptime with automated monitoring and restart capabilities.

## Sharding

This bot implements three different sharding modes:

### 1. Standalone Mode (No Sharding)
For small deployments with few servers, the bot can run without sharding. This is the default mode.

### 2. Standard Discord.js Sharding
For medium-sized deployments, the bot can use Discord.js's built-in sharding manager which distributes guilds across shards based on guild ID.

### 3. Server-Based Sharding
For optimal performance and reliability, the bot implements a custom "one shard per server" approach:
- Each Discord server gets its own dedicated shard
- Complete resource isolation between servers
- Enhanced error containment (issues in one server won't affect others)
- Improved ability to handle server-specific load patterns

See [SHARDING.md](SHARDING.md) for detailed documentation on the server-based sharding implementation.

## Support

For support or questions about the bot, contact the development team through Discord.

## Contributing

Contributions are welcome! Please see the [CHANGELOG.md](CHANGELOG.md) for recent updates.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

© 2025 MonkeyBytes - The Royal Court. Released under MIT License.