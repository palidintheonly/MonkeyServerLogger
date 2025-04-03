const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

const EPHEMERAL_FLAG = '1 << 6';
const SOURCE_DIRS = ['src/commands', 'src/events'];

async function findJsFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...await findJsFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function processFile(filePath) {
  console.log(`Processing ${filePath}`);
  let content = await readFile(filePath, 'utf8');
  
  // Check if file contains "ephemeral: true"
  if (!content.includes('ephemeral: true')) {
    return 0;
  }
  
  // Replace ephemeral: true with flags
  const newContent = content.replace(/ephemeral:\s*true/g, `flags: ${EPHEMERAL_FLAG}`);
  
  if (content !== newContent) {
    await writeFile(filePath, newContent);
    const replacements = (newContent.match(/flags: 1 << 6/g) || []).length;
    console.log(`  Updated ${replacements} instances in ${filePath}`);
    return replacements;
  }
  
  return 0;
}

async function main() {
  try {
    let totalFiles = 0;
    let totalReplacements = 0;
    
    for (const dir of SOURCE_DIRS) {
      const files = await findJsFiles(dir);
      totalFiles += files.length;
      
      for (const file of files) {
        const replacements = await processFile(file);
        totalReplacements += replacements;
      }
    }
    
    console.log("\nSummary:");
    console.log(`Processed ${totalFiles} files`);
    console.log(`Made ${totalReplacements} replacements`);
    console.log('All ephemeral options updated to use flags successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
