// Simple script to check token format
require('dotenv').config();

// Get token from environment variables
const token = process.env.TOKEN || process.env.DISCORD_BOT_TOKEN;

console.log(`Token available: ${!!token}`);

if (token) {
  console.log(`Token length: ${token.length}`);
  
  // Print the first 5 and last 5 characters only (for security)
  const firstFive = token.substring(0, 5);
  const lastFive = token.substring(token.length - 5);
  console.log(`Token preview: ${firstFive}...${lastFive}`);
  
  // Check if token has the typical Discord format (contains at least two periods)
  const periodCount = (token.match(/\./g) || []).length;
  console.log(`Number of periods in token: ${periodCount}`);
  
  if (periodCount >= 2) {
    console.log("Token format appears to be correct (contains at least 2 periods)");
    
    // Split the token by periods and show lengths of each part
    const parts = token.split('.');
    console.log(`Token has ${parts.length} parts separated by periods`);
    parts.forEach((part, index) => {
      console.log(`  Part ${index + 1} length: ${part.length}`);
    });
    
    console.log("Token appears to be valid! Using correct naming format.");
  } else {
    console.log("Token format appears to be invalid (Discord tokens typically contain at least 2 periods)");
    console.log("Please check your token in the Discord Developer Portal.");
  }
} else {
  console.log("No token found in environment variables.");
}