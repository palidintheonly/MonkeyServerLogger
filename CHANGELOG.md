# Changelog

All notable changes to the MonkeyBytes Discord Modmail Bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-04-03 "The Royal Court"

### Added
- Custom server-based sharding implementation (one shard per server)
- Multiple sharding modes (standalone, standard, server-based)
- Version tracking system with dedicated version.js file
- Comprehensive logging system with separate files for different log levels
- Automatic database backup system with daily backups
- Better error recovery strategies with maximum restart attempts

### Fixed
- Fixed "Maximum call stack size exceeded" error in Guild model's deepMerge function
- Updated deprecated Discord.js interaction patterns (ephemeral property handling)
- Replaced "fetchReply" with "withResponse" pattern following Discord.js recommendations
- Enhanced database connection reliability
- Corrected multiple race conditions in event handling

### Changed
- Implemented custom shard management with three operation modes (standalone, standard, server-based)
- Enhanced logger to support shard-specific prefixes and metadata
- Modified event handlers to adapt behavior based on sharding mode
- Refactored command system for better error handling
- Improved modmail thread tracking with enhanced database models
- Enhanced embed consistency and visual presentation
- Optimized interaction handling for reduced latency
- Updated to latest Discord.js API standards

### Security
- Improved input validation for all user inputs
- Enhanced permission checking mechanisms
- Added safeguards against API abuse and rate limits
- Better error encapsulation to prevent information leakage

## [1.0.0] - 2025-03-15

### Added
- Initial release with basic modmail functionality
- Discord slash command support
- Modmail thread creation and management
- Admin commands for server setup
- Simple help and information commands