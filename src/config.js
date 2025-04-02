module.exports = {
  // Bot configuration
  bot: {
    name: 'Monkey Bytes',
    slogan: 'The Royal Court',
    defaultPrefix: '!',
    version: '1.0.0',
    ownerId: process.env.OWNER_ID || '',
    color: '#FFD700', // Royal gold color
  },
  
  // Logging system configuration
  logging: {
    categories: {
      MESSAGES: {
        name: 'Messages',
        description: 'Logs message creations, edits, and deletions',
        emoji: '💬',
        enabled: true,
      },
      MEMBERS: {
        name: 'Members',
        description: 'Logs member joins, leaves, and updates',
        emoji: '👥',
        enabled: true,
      },
      VOICE: {
        name: 'Voice',
        description: 'Logs voice channel activity',
        emoji: '🔊',
        enabled: true,
      },
      ROLES: {
        name: 'Roles',
        description: 'Logs role creations, deletions, and updates',
        emoji: '👑',
        enabled: true,
      },
      CHANNELS: {
        name: 'Channels',
        description: 'Logs channel creations, deletions, and updates',
        emoji: '📝',
        enabled: true,
      },
      SERVER: {
        name: 'Server',
        description: 'Logs server setting changes and other server-wide events',
        emoji: '🏰',
        enabled: true,
      },
    },
    defaultChannelName: 'monkey-logs',
  },
  
  // Embed configuration
  embeds: {
    footer: 'Monkey Bytes | The Royal Court',
    timestamp: true,
  },
  
  // Database configuration
  database: {
    retryAttempts: 5,
    retryDelay: 5000, // 5 seconds
  },
  
  // Cooldowns for commands (in seconds)
  cooldowns: {
    default: 3,
    setup: 30,
    management: 5,
  },
  
  // Modmail configuration
  modmail: {
    defaultCategoryName: 'MODMAIL TICKETS',
    defaultChannelName: 'modmail-tickets',
    supportRoleName: 'Staff',
    threadDeletionDelay: 10000, // 10 seconds
    blockNotificationCooldown: 3600000, // 1 hour in milliseconds
  },
};
