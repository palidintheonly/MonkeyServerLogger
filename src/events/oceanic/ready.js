/**
 * Oceanic.js Ready Event
 */
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'ready',
  execute(client) {
    logger.info(`Oceanic.js client ready! Logged in as ${client.user.username}#${client.user.discriminator}`);
  }
};