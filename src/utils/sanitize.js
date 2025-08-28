/**
 * Sanitize user input for logging to prevent log injection
 */
const sanitizeForLog = (input) => {
  if (typeof input !== 'string') {
    return String(input);
  }
  return encodeURIComponent(input);
};

/**
 * Sanitize object for logging
 */
const sanitizeObjectForLog = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeForLog(obj);
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = typeof value === 'string' ? sanitizeForLog(value) : value;
  }
  return sanitized;
};

module.exports = {
  sanitizeForLog,
  sanitizeObjectForLog
};