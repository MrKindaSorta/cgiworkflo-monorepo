/**
 * Conditional Fields Utility
 * Handles evaluation of conditional logic for dynamic form fields
 */

// ============================================================================
// OPERATORS
// ============================================================================

export const OPERATORS = {
  // String/Number comparisons
  equals: (fieldValue, targetValue) => {
    return String(fieldValue) === String(targetValue);
  },

  notEquals: (fieldValue, targetValue) => {
    return String(fieldValue) !== String(targetValue);
  },

  greaterThan: (fieldValue, targetValue) => {
    const numField = parseFloat(fieldValue);
    const numTarget = parseFloat(targetValue);
    return !isNaN(numField) && !isNaN(numTarget) && numField > numTarget;
  },

  lessThan: (fieldValue, targetValue) => {
    const numField = parseFloat(fieldValue);
    const numTarget = parseFloat(targetValue);
    return !isNaN(numField) && !isNaN(numTarget) && numField < numTarget;
  },

  greaterThanOrEqual: (fieldValue, targetValue) => {
    const numField = parseFloat(fieldValue);
    const numTarget = parseFloat(targetValue);
    return !isNaN(numField) && !isNaN(numTarget) && numField >= numTarget;
  },

  lessThanOrEqual: (fieldValue, targetValue) => {
    const numField = parseFloat(fieldValue);
    const numTarget = parseFloat(targetValue);
    return !isNaN(numField) && !isNaN(numTarget) && numField <= numTarget;
  },

  // String operations
  contains: (fieldValue, targetValue) => {
    if (!fieldValue || !targetValue) return false;
    return String(fieldValue).toLowerCase().includes(String(targetValue).toLowerCase());
  },

  startsWith: (fieldValue, targetValue) => {
    if (!fieldValue || !targetValue) return false;
    return String(fieldValue).toLowerCase().startsWith(String(targetValue).toLowerCase());
  },

  endsWith: (fieldValue, targetValue) => {
    if (!fieldValue || !targetValue) return false;
    return String(fieldValue).toLowerCase().endsWith(String(targetValue).toLowerCase());
  },

  // Array/Multiselect operations
  oneOf: (fieldValue, targetValue) => {
    // Check if fieldValue is one of the targetValue array
    if (!Array.isArray(targetValue)) return false;
    return targetValue.includes(fieldValue);
  },

  includes: (fieldValue, targetValue) => {
    // Check if array fieldValue includes targetValue
    if (!Array.isArray(fieldValue)) return false;
    return fieldValue.includes(targetValue);
  },

  includesAny: (fieldValue, targetValue) => {
    // Check if array fieldValue includes any of targetValue array
    if (!Array.isArray(fieldValue) || !Array.isArray(targetValue)) return false;
    return fieldValue.some((v) => targetValue.includes(v));
  },

  includesAll: (fieldValue, targetValue) => {
    // Check if array fieldValue includes all of targetValue array
    if (!Array.isArray(fieldValue) || !Array.isArray(targetValue)) return false;
    return targetValue.every((v) => fieldValue.includes(v));
  },

  // Existence checks
  isEmpty: (fieldValue) => {
    if (fieldValue === null || fieldValue === undefined) return true;
    if (typeof fieldValue === 'string' && fieldValue.trim() === '') return true;
    if (Array.isArray(fieldValue) && fieldValue.length === 0) return true;
    if (typeof fieldValue === 'object' && Object.keys(fieldValue).length === 0) return true;
    return false;
  },

  isNotEmpty: (fieldValue) => {
    return !OPERATORS.isEmpty(fieldValue);
  },
};

// ============================================================================
// CONDITION EVALUATION
// ============================================================================

/**
 * Evaluate a single condition
 * @param {Object} condition - The condition object { fieldId, operator, value }
 * @param {Object} formValues - All current form values
 * @returns {boolean} - Whether the condition is met
 */
export function evaluateCondition(condition, formValues) {
  if (!condition || !condition.fieldId || !condition.operator) {
    console.warn('Invalid condition:', condition);
    return true; // Default to showing field if condition invalid
  }

  const fieldValue = formValues[condition.fieldId];
  const operator = OPERATORS[condition.operator];

  if (!operator) {
    console.warn(`Unknown operator: ${condition.operator}`);
    return true; // Default to showing field if operator unknown
  }

  try {
    return operator(fieldValue, condition.value);
  } catch (error) {
    console.error('Error evaluating condition:', error, condition);
    return true; // Default to showing field on error
  }
}

/**
 * Check if a field should be shown based on its conditional logic
 * @param {Object} field - The field object with potential conditional property
 * @param {Object} formValues - All current form values
 * @returns {boolean} - Whether the field should be displayed
 */
export function shouldShowField(field, formValues) {
  // If no conditional logic, always show
  if (!field.conditional || !field.conditional.enabled) {
    return true;
  }

  const { conditions = [], operator = 'AND' } = field.conditional;

  // No conditions defined, show field
  if (conditions.length === 0) {
    return true;
  }

  // Evaluate each condition
  const results = conditions.map((condition) => evaluateCondition(condition, formValues));

  // Combine results based on operator
  if (operator === 'AND') {
    return results.every((r) => r === true);
  } else if (operator === 'OR') {
    return results.some((r) => r === true);
  }

  // Default to showing if operator unknown
  return true;
}

// ============================================================================
// DEPENDENCY ANALYSIS
// ============================================================================

/**
 * Get all field IDs that a field depends on (via conditional logic)
 * @param {Object} field - The field object
 * @returns {string[]} - Array of field IDs this field depends on
 */
export function getFieldDependencies(field) {
  if (!field.conditional || !field.conditional.enabled) {
    return [];
  }

  return field.conditional.conditions
    .filter((c) => c.fieldId)
    .map((c) => c.fieldId);
}

/**
 * Detect circular dependencies in field conditions
 * @param {Object[]} fields - Array of all fields
 * @returns {string[]} - Array of field IDs involved in circular dependencies
 */
export function detectCircularDependencies(fields) {
  // Build dependency graph
  const dependencies = new Map();
  fields.forEach((field) => {
    if (field.conditional?.enabled) {
      const deps = field.conditional.conditions
        .filter((c) => c.fieldId)
        .map((c) => c.fieldId);
      dependencies.set(field.id, deps);
    }
  });

  // Detect cycles using DFS
  function hasCycle(fieldId, visited = new Set(), stack = new Set()) {
    if (stack.has(fieldId)) return true; // Cycle detected
    if (visited.has(fieldId)) return false;

    visited.add(fieldId);
    stack.add(fieldId);

    const deps = dependencies.get(fieldId) || [];
    for (const depId of deps) {
      if (hasCycle(depId, visited, stack)) {
        return true;
      }
    }

    stack.delete(fieldId);
    return false;
  }

  // Check each field for cycles
  const circularFields = [];
  for (const fieldId of dependencies.keys()) {
    if (hasCycle(fieldId)) {
      circularFields.push(fieldId);
    }
  }

  return circularFields;
}

/**
 * Validate conditional logic for a field
 * @param {Object} field - The field to validate
 * @param {Object[]} allFields - Array of all fields in the schema
 * @returns {Object} - Validation result { valid: boolean, errors: string[] }
 */
export function validateFieldConditions(field, allFields) {
  const errors = [];

  if (!field.conditional || !field.conditional.enabled) {
    return { valid: true, errors: [] };
  }

  const fieldIds = new Set(allFields.map((f) => f.id));

  // Check each condition
  field.conditional.conditions.forEach((condition, index) => {
    // Check if referenced field exists
    if (condition.fieldId && !fieldIds.has(condition.fieldId)) {
      errors.push(`Condition ${index + 1} references non-existent field: ${condition.fieldId}`);
    }

    // Check if referencing self
    if (condition.fieldId === field.id) {
      errors.push(`Condition ${index + 1} cannot reference the field itself`);
    }

    // Check if operator is valid
    if (condition.operator && !OPERATORS[condition.operator]) {
      errors.push(`Condition ${index + 1} has invalid operator: ${condition.operator}`);
    }

    // Check if value is provided for operators that need it
    const operatorsNeedingValue = [
      'equals',
      'notEquals',
      'greaterThan',
      'lessThan',
      'contains',
      'startsWith',
      'endsWith',
      'oneOf',
      'includes',
      'includesAny',
      'includesAll',
    ];

    if (
      operatorsNeedingValue.includes(condition.operator) &&
      (condition.value === undefined || condition.value === null || condition.value === '')
    ) {
      errors.push(`Condition ${index + 1} requires a value for operator: ${condition.operator}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
