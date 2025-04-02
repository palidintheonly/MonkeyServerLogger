/**
 * Utility functions for time/date handling
 */

/**
 * Convert a timestamp to GMT/BST format
 * @param {Date|number} timestamp - Timestamp to convert (Date object or milliseconds)
 * @param {boolean} includeSeconds - Whether to include seconds in output
 * @returns {string} Formatted date/time string with timezone
 */
function formatTimeGMT(timestamp, includeSeconds = true) {
  // Create Date object if timestamp is a number
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  // Determine if UK is in BST (British Summer Time) or GMT
  // BST runs from last Sunday in March to last Sunday in October
  const timezone = isDST(date) ? 'BST' : 'GMT';
  
  // Format the date with British format and timezone
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London'
  };
  
  // Add seconds if requested
  if (includeSeconds) {
    options.second = '2-digit';
  }
  
  // Format the date and add the timezone identifier
  return new Intl.DateTimeFormat('en-GB', options).format(date) + ' ' + timezone;
}

/**
 * Check if a date is in Daylight Saving Time (BST for UK)
 * @param {Date} date - Date to check
 * @returns {boolean} true if in DST/BST, false if in standard time (GMT)
 */
function isDST(date) {
  // Create Date objects for January 1 and July 1 of the same year
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  
  // Get timezone offsets in minutes
  const janOffset = jan.getTimezoneOffset();
  const julOffset = jul.getTimezoneOffset();
  
  // If timezone offset in January and July are different, the lower
  // offset value is the DST offset (since DST moves clocks forward)
  const dstOffset = Math.min(janOffset, julOffset);
  
  // Return whether current date's offset matches the DST offset
  return date.getTimezoneOffset() === dstOffset;
}

/**
 * Format uptime in a human-readable format
 * @param {number} ms - Milliseconds of uptime
 * @returns {string} Formatted uptime string (e.g., "5d 12h 30m 15s")
 */
function formatUptime(ms) {
  // Convert to seconds
  const totalSeconds = Math.floor(ms / 1000);
  
  // Calculate components
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  // Build display string
  let display = '';
  if (days > 0) display += `${days}d `;
  if (hours > 0 || days > 0) display += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) display += `${minutes}m `;
  display += `${seconds}s`;
  
  return display;
}

module.exports = {
  formatTimeGMT,
  isDST,
  formatUptime
};