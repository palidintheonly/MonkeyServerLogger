const fs = require('fs');
const path = require('path');

// Files to update
const filesToUpdate = [
  'src/events/discord.interactionCreate.js',
  'src/commands/general/help.js',
  'src/commands/general/guilds.js',
  'src/commands/general/info.js',
  'src/commands/general/ping.js',
  'src/commands/admin/modmail-setup.js',
  'src/commands/admin/modmail-stats.js',
  'src/commands/admin/status.js'
];

// Function to update ephemeral to flags
function updateFile(filePath) {
  console.log(`Processing ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace "ephemeral: true" with "flags: 1 << 6" (bit shift for ephemeral flag)
  const updatedContent = content.replace(/ephemeral: true/g, 'flags: 1 << 6');
  
  if (content !== updatedContent) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`No changes needed in ${filePath}`);
  }
}

// Process all files
filesToUpdate.forEach(file => {
  try {
    updateFile(file);
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log('Update complete!');
