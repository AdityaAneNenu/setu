// Safe JSON parsing utilities to prevent app crashes
// ================================================

/**
 * Safely parse JSON string without throwing errors
 * @param {string} jsonString - The JSON string to parse
 * @param {*} fallback - Default value if parsing fails (default: null)
 * @returns {*} Parsed value or fallback
 */
export const safeParse = (jsonString, fallback = null) => {
  if (jsonString === null || jsonString === undefined) {
    return fallback;
  }
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Safe JSON parse failed:', error.message);
    return fallback;
  }
};

/**
 * Safely stringify value without throwing errors
 * @param {*} value - The value to stringify
 * @param {string} fallback - Default string if stringify fails (default: '{}')
 * @returns {string} JSON string or fallback
 */
export const safeStringify = (value, fallback = '{}') => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn('Safe JSON stringify failed:', error.message);
    return fallback;
  }
};

/**
 * Parse JSON with object fallback
 * @param {string} jsonString - The JSON string to parse
 * @returns {Object} Parsed object or empty object
 */
export const parseObject = (jsonString) => safeParse(jsonString, {});

/**
 * Parse JSON with array fallback
 * @param {string} jsonString - The JSON string to parse
 * @returns {Array} Parsed array or empty array
 */
export const parseArray = (jsonString) => safeParse(jsonString, []);

export default {
  safeParse,
  safeStringify,
  parseObject,
  parseArray,
};
