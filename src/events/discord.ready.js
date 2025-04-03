/**
 * Discord.js Ready Event
 */
const { logger } = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    logger.info(`Discord.js client ready! Logged in as ${client.user.tag}`);
  }
};