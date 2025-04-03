/**
 * Version Information
 * Contains version details for the Discord Modmail Bot
 */

module.exports = {
  version: '2.0.0',
  name: 'MonkeyBytes Discord Modmail Bot',
  codename: 'The Royal Court',
  buildDate: new Date().toISOString(),
  
  // Company branding
  company: 'MonkeyBytes',
  slogan: 'The Royal Court',
  
  // Major changes in this version
  changes: [
    'Fixed circular reference handling in Guild model',
    'Updated to latest Discord.js interaction patterns',
    'Enhanced database backup system',
    'Improved error handling and recovery',
    'Updated deprecated API calls to current standards'
  ]
};