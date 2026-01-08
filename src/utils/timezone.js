/**
 * Timezone Utilities
 * Convert UTC timestamps to user's local timezone
 */

/**
 * Format a UTC timestamp to user's local timezone
 * @param {string} utcTimestamp - ISO 8601 UTC timestamp
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted local datetime string
 */
export const formatLocalTime = (utcTimestamp, options = {}) => {
  if (!utcTimestamp) return '-';

  const date = new Date(utcTimestamp);

  // Check if valid date
  if (isNaN(date.getTime())) return '-';

  const {
    includeDate = true,
    includeTime = true,
    includeSeconds = false,
    dateStyle = 'medium', // 'short', 'medium', 'long', 'full'
    timeStyle = 'short', // 'short', 'medium', 'long', 'full'
  } = options;

  // Use Intl.DateTimeFormat for automatic timezone conversion
  const formatOptions = {};

  if (includeDate && includeTime) {
    formatOptions.dateStyle = dateStyle;
    formatOptions.timeStyle = includeSeconds ? 'medium' : timeStyle;
  } else if (includeDate) {
    formatOptions.dateStyle = dateStyle;
  } else if (includeTime) {
    formatOptions.timeStyle = includeSeconds ? 'medium' : timeStyle;
  }

  try {
    return new Intl.DateTimeFormat(navigator.language, formatOptions).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return date.toLocaleString();
  }
};

/**
 * Get relative time string (e.g., "2 hours ago", "just now")
 * @param {string} utcTimestamp - ISO 8601 UTC timestamp
 * @returns {string} - Relative time string
 */
export const getRelativeTime = (utcTimestamp) => {
  if (!utcTimestamp) return 'Never';

  const date = new Date(utcTimestamp);
  if (isNaN(date.getTime())) return 'Unknown';

  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  // Future dates
  if (diffMs < 0) {
    return 'In the future';
  }

  // Just now
  if (diffSec < 10) {
    return 'Just now';
  }

  // Seconds ago
  if (diffSec < 60) {
    return `${diffSec} second${diffSec !== 1 ? 's' : ''} ago`;
  }

  // Minutes ago
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  }

  // Hours ago
  if (diffHour < 24) {
    return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  }

  // Days ago
  if (diffDay < 7) {
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  }

  // Weeks ago
  if (diffWeek < 4) {
    return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
  }

  // Months ago
  if (diffMonth < 12) {
    return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  }

  // Years ago
  return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
};

/**
 * Format last login timestamp with both absolute and relative time
 * @param {string} utcTimestamp - ISO 8601 UTC timestamp
 * @returns {Object} - { full, relative, date, time }
 */
export const formatLastLogin = (utcTimestamp) => {
  if (!utcTimestamp) {
    return {
      full: 'Never logged in',
      relative: 'Never',
      date: '-',
      time: '-',
    };
  }

  const date = new Date(utcTimestamp);
  if (isNaN(date.getTime())) {
    return {
      full: 'Unknown',
      relative: 'Unknown',
      date: '-',
      time: '-',
    };
  }

  return {
    full: formatLocalTime(utcTimestamp, { includeDate: true, includeTime: true }),
    relative: getRelativeTime(utcTimestamp),
    date: formatLocalTime(utcTimestamp, { includeDate: true, includeTime: false }),
    time: formatLocalTime(utcTimestamp, { includeDate: false, includeTime: true }),
  };
};

/**
 * Get user's timezone
 * @returns {string} - IANA timezone identifier (e.g., 'America/New_York')
 */
export const getUserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Error getting timezone:', error);
    return 'UTC';
  }
};

/**
 * Get timezone offset string (e.g., 'UTC-5', 'UTC+0')
 * @returns {string} - Timezone offset string
 */
export const getTimezoneOffset = () => {
  const offset = -new Date().getTimezoneOffset() / 60;
  const sign = offset >= 0 ? '+' : '';
  return `UTC${sign}${offset}`;
};
