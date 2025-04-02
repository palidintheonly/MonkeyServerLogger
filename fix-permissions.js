// Script to fix permission flags in all JavaScript files
const fs = require('fs');
const path = require('path');
const util = require('util');
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

// Function to recursively get all JavaScript files in a directory
async function getJsFiles(dir) {
  const subdirs = await readdir(dir);
  const files = await Promise.all(subdirs.map(async (subdir) => {
    const res = path.resolve(dir, subdir);
    const stats = await stat(res);
    return stats.isDirectory() ? getJsFiles(res) : (res.endsWith('.js') ? res : null);
  }));
  return files.filter(Boolean).flat();
}

// Function to fix permissions in a file
function fixPermissionsInFile(filePath) {
  try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Replace the import
    content = content.replace(
      /const\s*{\s*([^}]*)PermissionFlagsBits([^}]*)\s*}\s*=\s*require\(['"]discord\.js['"]\);/g, 
      (match, before, after) => `const { ${before}PermissionsBitField${after} } = require('discord.js');`
    );
    
    // Replace all instances of PermissionFlagsBits with PermissionsBitField.Flags
    content = content.replace(/PermissionFlagsBits\./g, 'PermissionsBitField.Flags.');
    
    // Only write if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`Permissions fixed in ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

// Main function to process all files
async function main() {
  // Fix bot-functions.js first
  const botFunctionsPath = path.join(__dirname, 'src', 'bot-functions.js');
  fixPermissionsInFile(botFunctionsPath);
  
  // Fix all files in src/commands/management directory
  const managementDir = path.join(__dirname, 'src', 'commands', 'management');
  const managementFiles = await getJsFiles(managementDir);
  let fixCount = 0;
  
  for (const file of managementFiles) {
    if (fixPermissionsInFile(file)) {
      fixCount++;
    }
  }
  
  // Check the setup.js file as well
  const setupFilePath = path.join(__dirname, 'src', 'commands', 'setup.js');
  if (fixPermissionsInFile(setupFilePath)) {
    fixCount++;
  }
  
  console.log(`Fixed permissions in ${fixCount} management command files`);
}

main().catch(console.error);