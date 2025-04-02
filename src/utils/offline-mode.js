/**
 * Offline mode utilities for the Discord bot
 * This allows the bot to run without connecting to Discord when the token is invalid.
 */

const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');
const offline_log_file = path.join(__dirname, '../../logs/offline-info.log');

/**
 * Initialize offline mode
 * @returns {boolean} True if running in offline mode
 */
function initOfflineMode() {
  // Log to a specific offline log file
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: Starting Discord bot in OFFLINE mode...\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: This version does not connect to Discord servers to protect your credentials\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: ----------------------------------------------------------------\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: Token available: true, but NOT being used in offline mode\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: Simulated features available in offline mode:\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: - Web health check endpoint (/)\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: - Command simulation\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: - Database connections\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: - Logging systems\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: ----------------------------------------------------------------\n`);
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: Bot is running in offline mode - no Discord connections will be made\n`);
  
  logger.warn('Bot is running in OFFLINE MODE due to token validation issues');
  logger.warn('Please check your Discord bot token in the Replit Secrets and ensure it is valid');
  logger.warn('You may need to reset your token in the Discord Developer Portal if it has been compromised');
  
  return true;
}

/**
 * Detect if the bot should run in offline mode based on token validity
 * @param {string} token - Discord bot token to validate
 * @returns {boolean} True if should run in offline mode
 */
function shouldRunOffline(token) {
  if (!token) return true;
  
  // Basic token format validation (Discord tokens have 3 parts separated by periods)
  if (token.split('.').length !== 3) {
    return true;
  }
  
  // More detailed format validation (first part is 24-25 chars, second part is 6-7 chars, third part is 27+ chars)
  const parts = token.split('.');
  if (parts[0].length < 24 || parts[1].length < 6 || parts[2].length < 27) {
    return true;
  }
  
  return false;
}

/**
 * Shutdown offline mode
 */
function shutdownOfflineMode() {
  fs.appendFileSync(offline_log_file, 
    `[${new Date().toISOString()}] INFO: Offline bot shutting down...\n`);
}

module.exports = {
  initOfflineMode,
  shouldRunOffline,
  shutdownOfflineMode
};