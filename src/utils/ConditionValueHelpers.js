/**
 * Condition Value Helpers
 * Utilities for normalizing and validating conditional logic values
 */

// Operators that require array values
const ARRAY_OPERATORS = ['oneOf', 'includesAny', 'includesAll'];

// Operators that don't need any value
const NO_VALUE_OPERATORS = ['isEmpty', 'isNotEmpty'];

/**
 * Normalize condition value based on operator and field type
 * Ensures values are in the correct format (string, number, or array)
 *
 * @param {string} operator - The comparison operator
 * @param {any} value - The raw value from input
 * @param {string} fieldType - The type of the referenced field
 * @returns {any} - Normalized value
 */
export function normalizeConditionValue(operator, value, fieldType) {
  // No value operators should return undefined
  if (NO_VALUE_OPERATORS.includes(operator)) {
    return undefined;
  }

  // Array operators should always return an array
  if (ARRAY_OPERATORS.includes(operator)) {
    if (Array.isArray(value)) {
      return value;
    }
    // Convert string to array (backward compatibility)
    if (typeof value === 'string' && value) {
      return [value];
    }
    return [];
  }

  // Number fields should return numbers for comparison operators
  if (fieldType === 'number' && ['greaterThan', 'lessThan', 'equals', 'notEquals'].includes(operator)) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }

  // Date fields should return ISO date strings
  if (fieldType === 'date' && value) {
    // Ensure it's a valid date string
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : value;
  }

  // Default: return as-is (string)
  return value;
}

/**
 * Get the default value for a condition based on field type and operator
 *
 * @param {string} fieldType - The type of the referenced field
 * @param {string} operator - The comparison operator
 * @returns {any} - Default value
 */
export function getDefaultConditionValue(fieldType, operator) {
  if (NO_VALUE_OPERATORS.includes(operator)) {
    return undefined;
  }

  if (ARRAY_OPERATORS.includes(operator)) {
    return [];
  }

  if (fieldType === 'number') {
    return '';
  }

  if (fieldType === 'date') {
    return '';
  }

  return '';
}

/**
 * Validate that a condition value is valid for its operator and field type
 *
 * @param {any} value - The condition value
 * @param {string} operator - The comparison operator
 * @param {object} referencedField - The field being referenced
 * @returns {{valid: boolean, error: string|null}} - Validation result
 */
export function validateConditionValue(value, operator, referencedField) {
  // No value operators don't need validation
  if (NO_VALUE_OPERATORS.includes(operator)) {
    return { valid: true, error: null };
  }

  // Array operators need at least one value
  if (ARRAY_OPERATORS.includes(operator)) {
    if (!Array.isArray(value) || value.length === 0) {
      return { valid: false, error: 'At least one value is required' };
    }
    return { valid: true, error: null };
  }

  // Other operators need a non-empty value
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: 'Value is required for this operator' };
  }

  // For select fields, validate value exists in options (non-smart fields only)
  if (
    (referencedField.type === 'select' || referencedField.type === 'multiselect') &&
    operator === 'equals' &&
    !referencedField.allowCreate
  ) {
    const options = referencedField.options || [];
    if (!options.includes(value)) {
      return {
        valid: false,
        error: `Value must be one of: ${options.join(', ')}`,
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Get appropriate placeholder text for value input based on field type
 *
 * @param {object} referencedField - The field being referenced
 * @param {string} operator - The comparison operator
 * @returns {string} - Placeholder text
 */
export function getPlaceholderText(referencedField, operator) {
  if (!referencedField) return 'Value';

  if (NO_VALUE_OPERATORS.includes(operator)) return '';

  if (ARRAY_OPERATORS.includes(operator)) {
    return 'Select values...';
  }

  switch (referencedField.type) {
    case 'select':
    case 'multiselect':
      return 'Select value...';

    case 'smartselect':
    case 'smartmultiselect':
      return 'Select or create...';

    case 'date':
      return 'Select date...';

    case 'number':
      return 'Enter number...';

    default:
      return 'Enter value...';
  }
}
