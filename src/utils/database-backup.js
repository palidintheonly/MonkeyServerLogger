/**
 * Database Backup Utility
 * Provides functions for backing up and restoring the database
 */
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');
const { sequelize } = require('../database/db');

// Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backup');
const MANUAL_BACKUP_DIR = path.join(DATA_DIR, 'manual_backup');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

if (!fs.existsSync(MANUAL_BACKUP_DIR)) {
  fs.mkdirSync(MANUAL_BACKUP_DIR, { recursive: true });
}

/**
 * Create a timestamp-formatted string for backup filenames
 * @param {boolean} [includeTime=true] - Whether to include time in the timestamp
 * @returns {string} Formatted timestamp
 */
function getTimestamp(includeTime = true) {
  const now = new Date();
  
  if (includeTime) {
    return now.toISOString().replace(/:/g, '-');
  } else {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }
}

/**
 * Create a backup of a database file
 * @param {string} sourceFile - Path to the source database file
 * @param {string} targetDir - Directory where the backup should be saved
 * @param {boolean} [includeTime=true] - Whether to include time in backup filename
 * @returns {Promise<string>} Path to the created backup file
 */
async function backupDatabaseFile(sourceFile, targetDir, includeTime = true) {
  try {
    // Skip if source file doesn't exist
    if (!fs.existsSync(sourceFile)) {
      logger.warn(`Cannot backup ${sourceFile} as it does not exist`);
      return null;
    }
    
    // Generate target filename with timestamp
    const timestamp = getTimestamp(includeTime);
    const sourceFileName = path.basename(sourceFile);
    const backupFileName = includeTime ? 
      sourceFileName.replace('.sqlite', `_${timestamp}.sqlite`) : 
      `${sourceFileName.replace('.sqlite', '')}_${timestamp}.sqlite`;
    
    const backupPath = path.join(targetDir, backupFileName);
    
    // Copy the file
    fs.copyFileSync(sourceFile, backupPath);
    logger.info(`Database backup created: ${backupPath}`);
    
    return backupPath;
  } catch (error) {
    logger.error(`Error creating database backup: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Create a backup of the main database file
 * @param {boolean} [manual=false] - Whether this is a manual backup (vs scheduled)
 * @returns {Promise<string>} Path to the created backup file
 */
async function backupMainDatabase(manual = false) {
  const sourceFile = path.join(DATA_DIR, 'database.sqlite');
  const targetDir = manual ? MANUAL_BACKUP_DIR : BACKUP_DIR;
  
  return backupDatabaseFile(sourceFile, targetDir, !manual);
}

/**
 * Create a backup of the dashboard database file
 * @param {boolean} [manual=false] - Whether this is a manual backup (vs scheduled)
 * @returns {Promise<string>} Path to the created backup file
 */
async function backupDashboardDatabase(manual = false) {
  const sourceFile = path.join(DATA_DIR, 'dashboard.sqlite');
  const targetDir = manual ? MANUAL_BACKUP_DIR : BACKUP_DIR;
  
  return backupDatabaseFile(sourceFile, targetDir, !manual);
}

/**
 * Create a backup of both database files
 * @param {boolean} [manual=false] - Whether this is a manual backup (vs scheduled)
 * @returns {Promise<Array<string>>} Paths to the created backup files
 */
async function backupAllDatabases(manual = false) {
  const results = [];
  
  const mainBackup = await backupMainDatabase(manual);
  if (mainBackup) results.push(mainBackup);
  
  const dashboardBackup = await backupDashboardDatabase(manual);
  if (dashboardBackup) results.push(dashboardBackup);
  
  return results;
}

/**
 * Restore a database from a backup file
 * @param {string} backupFile - Path to the backup file
 * @param {string} targetFile - Path where the restored database should be saved
 * @returns {Promise<boolean>} Success or failure
 */
async function restoreDatabaseFromBackup(backupFile, targetFile) {
  try {
    // Validate backup file exists
    if (!fs.existsSync(backupFile)) {
      logger.error(`Cannot restore from ${backupFile} as it does not exist`);
      return false;
    }
    
    // Create a backup of the current database before restoring
    const currentBackup = await backupDatabaseFile(targetFile, BACKUP_DIR);
    logger.info(`Created safety backup before restore: ${currentBackup}`);
    
    // Close database connections
    await sequelize.close();
    logger.info('Closed database connection for restore operation');
    
    // Copy backup to target
    fs.copyFileSync(backupFile, targetFile);
    logger.info(`Restored database from ${backupFile} to ${targetFile}`);
    
    return true;
  } catch (error) {
    logger.error(`Error restoring database: ${error.message}`, { error });
    return false;
  }
}

/**
 * Clean up old automated backup files
 * @param {number} maxBackups - Maximum number of backups to keep
 * @returns {Promise<number>} Number of files deleted
 */
async function cleanupOldBackups(maxBackups = 7) {
  try {
    // Get all backup files
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.sqlite'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort newest to oldest
    
    if (files.length <= maxBackups) {
      logger.info(`No cleanup needed. Have ${files.length} backups, max is ${maxBackups}`);
      return 0;
    }
    
    // Delete oldest files beyond the max count
    const filesToDelete = files.slice(maxBackups);
    let deletedCount = 0;
    
    for (const file of filesToDelete) {
      try {
        fs.unlinkSync(file.path);
        logger.info(`Deleted old backup: ${file.path}`);
        deletedCount++;
      } catch (err) {
        logger.error(`Failed to delete backup ${file.path}: ${err.message}`);
      }
    }
    
    logger.info(`Cleaned up ${deletedCount} old backup files`);
    return deletedCount;
  } catch (error) {
    logger.error(`Error cleaning up old backups: ${error.message}`, { error });
    return 0;
  }
}

/**
 * Export schema of the database for reference
 * @returns {Promise<string>} Path to the schema file or null on failure
 */
async function exportDatabaseSchema() {
  try {
    const schemaFile = path.join(BACKUP_DIR, 'database_schema.sql');
    
    // Get all tables
    const tables = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    let schemaContent = '-- Database Schema Export\n';
    schemaContent += `-- Generated: ${new Date().toISOString()}\n\n`;
    
    for (const table of tables) {
      const tableName = table.name;
      
      // Get CREATE TABLE statement
      const createTableResult = await sequelize.query(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}';`,
        { type: sequelize.QueryTypes.SELECT }
      );
      
      if (createTableResult.length > 0 && createTableResult[0].sql) {
        schemaContent += `${createTableResult[0].sql};\n\n`;
      }
    }
    
    fs.writeFileSync(schemaFile, schemaContent);
    logger.info(`Database schema exported to ${schemaFile}`);
    
    return schemaFile;
  } catch (error) {
    logger.error(`Error exporting database schema: ${error.message}`, { error });
    return null;
  }
}

module.exports = {
  backupMainDatabase,
  backupDashboardDatabase,
  backupAllDatabases,
  restoreDatabaseFromBackup,
  cleanupOldBackups,
  exportDatabaseSchema,
  BACKUP_DIR,
  MANUAL_BACKUP_DIR
};