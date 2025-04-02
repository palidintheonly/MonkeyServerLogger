// Script to fix double-nested flags issue in Discord.js v14
const fs = require('fs');
const path = require('path');

// Define the directory to recursively search
const rootDir = './src';

// Function to fix double-nested flags in a file
function fixDoubleNestedFlags(filePath) {
  try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has the double-nested flags syntax
    if (content.includes('flags: { flags: { ephemeral: true } }')) {
      console.log(`Fixing double-nested flags in: ${filePath}`);
      
      // Replace with the correct syntax
      content = content.replace(/flags: { flags: { ephemeral: true } }/g, 'ephemeral: true');
      
      // Write the corrected content back to the file
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

// Function to recursively search for js files and apply the fix
function processDirectory(dirPath) {
  let fixedFiles = 0;
  
  // Get all items in the directory
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      // Recursively process subdirectories
      fixedFiles += processDirectory(itemPath);
    } else if (stats.isFile() && item.endsWith('.js')) {
      // Process JavaScript files
      if (fixDoubleNestedFlags(itemPath)) {
        fixedFiles++;
      }
    }
  }
  
  return fixedFiles;
}

// Main execution
console.log('Starting to fix double-nested flags issue in Discord.js v14 code...');
const totalFixed = processDirectory(rootDir);
console.log(`Completed! Fixed ${totalFixed} files.`);