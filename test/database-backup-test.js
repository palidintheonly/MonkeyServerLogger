/**
 * Database Backup Utility Test
 * 
 * This script tests the functionality of our database backup utility,
 * ensuring it correctly creates and manages backups for both automatic
 * and manual operations.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { logger } = require('../src/utils/logger');
const databaseBackup = require('../src/utils/database-backup');
const { connectToDatabase } = require('../src/database/db');

async function testManualBackup() {
  logger.info('=== Testing manual database backup ===');
  
  try {
    // Create a manual backup of the main database
    const mainBackupPath = await databaseBackup.backupMainDatabase(true);
    
    if (mainBackupPath && fs.existsSync(mainBackupPath)) {
      logger.info(`✓ Manual main database backup created: ${mainBackupPath}`);
    } else {
      logger.error('× Failed to create manual main database backup');
    }
    
    // Create a manual backup of the dashboard database if it exists
    const dashboardBackupPath = await databaseBackup.backupDashboardDatabase(true);
    
    if (dashboardBackupPath && fs.existsSync(dashboardBackupPath)) {
      logger.info(`✓ Manual dashboard database backup created: ${dashboardBackupPath}`);
    } else {
      logger.info('ℹ Dashboard database backup not created (may not exist)');
    }
    
    return true;
  } catch (error) {
    logger.error(`× Error in manual backup test: ${error.message}`, { error });
    return false;
  }
}

async function testAutomatedBackup() {
  logger.info('\n=== Testing automated database backup ===');
  
  try {
    // Create an automated backup of all databases
    const backupPaths = await databaseBackup.backupAllDatabases(false);
    
    if (backupPaths && backupPaths.length > 0) {
      logger.info(`✓ Automated backups created: ${backupPaths.join(', ')}`);
      
      // Check that the files exist
      const allExist = backupPaths.every(p => fs.existsSync(p));
      if (allExist) {
        logger.info('✓ All backup files exist on disk');
      } else {
        logger.error('× Some backup files are missing on disk');
      }
    } else {
      logger.error('× Failed to create automated backups');
    }
    
    return true;
  } catch (error) {
    logger.error(`× Error in automated backup test: ${error.message}`, { error });
    return false;
  }
}

async function testBackupCleanup() {
  logger.info('\n=== Testing backup cleanup ===');
  
  try {
    // Create several test backup files
    const backupDir = databaseBackup.BACKUP_DIR;
    const testCount = 5;
    const testFiles = [];
    
    // Make sure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Create test backup files
    for (let i = 0; i < testCount; i++) {
      const timestamp = new Date(Date.now() - i * 60000).toISOString().replace(/:/g, '-');
      const filename = `test_backup_${timestamp}.sqlite`;
      const filePath = path.join(backupDir, filename);
      
      // Create an empty file
      fs.writeFileSync(filePath, `Test backup file ${i}`);
      testFiles.push(filePath);
      
      logger.info(`Created test backup file: ${filePath}`);
    }
    
    // Run the cleanup with a limit of 2 files
    const deletedCount = await databaseBackup.cleanupOldBackups(2);
    
    if (deletedCount > 0) {
      logger.info(`✓ Cleanup removed ${deletedCount} files`);
    } else {
      logger.error('× Cleanup did not remove any files');
    }
    
    // Count remaining test files
    const remainingFiles = testFiles.filter(f => fs.existsSync(f)).length;
    logger.info(`Remaining test files: ${remainingFiles} (should be 2)`);
    
    // Clean up any remaining test files
    testFiles.forEach(f => {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
      }
    });
    
    return true;
  } catch (error) {
    logger.error(`× Error in backup cleanup test: ${error.message}`, { error });
    return false;
  }
}

async function testSchemaExport() {
  logger.info('\n=== Testing database schema export ===');
  
  try {
    // Export the database schema
    const schemaFile = await databaseBackup.exportDatabaseSchema();
    
    if (schemaFile && fs.existsSync(schemaFile)) {
      logger.info(`✓ Schema exported successfully: ${schemaFile}`);
      
      // Check the content
      const content = fs.readFileSync(schemaFile, 'utf8');
      if (content.includes('CREATE TABLE') && content.length > 100) {
        logger.info('✓ Schema file contains valid SQL statements');
      } else {
        logger.warn('× Schema file content might be invalid');
      }
    } else {
      logger.error('× Failed to export schema');
    }
    
    return true;
  } catch (error) {
    logger.error(`× Error in schema export test: ${error.message}`, { error });
    return false;
  }
}

async function runAllTests() {
  try {
    logger.info('Starting database backup utility tests...');
    
    // Connect to database first
    await connectToDatabase();
    
    // Run tests
    await testManualBackup();
    await testAutomatedBackup();
    await testBackupCleanup();
    await testSchemaExport();
    
    logger.info('\n=== All database backup tests completed ===');
  } catch (error) {
    logger.error(`Error in database backup tests: ${error.message}`, { error });
  } finally {
    process.exit(0);
  }
}

// Start the tests
runAllTests();