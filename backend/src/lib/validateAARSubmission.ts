/**
 * Validates AAR submission data against custom form schema
 *
 * This module handles validation of AAR form submissions by:
 * - Checking required fields are present
 * - Validating field types match schema
 * - Evaluating conditional logic for fields
 * - Verifying file fields have corresponding uploads
 */

interface FormField {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
  options?: string[];
  conditional?: {
    enabled: boolean;
    operator: 'AND' | 'OR';
    conditions: Array<{
      fieldId: string;
      operator: string;
      value: any;
    }>;
  };
}

interface FormSchema {
  formId: string;
  version: string;
  fields: FormField[];
}

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface PhotoMetadata {
  filename: string;
  size: number;
  type: string;
}

/**
 * Validates AAR submission data against custom form schema
 */
export async function validateAARSubmission(
  formData: Record<string, any>,
  formSchema: FormSchema,
  photoMetadata: Record<string, PhotoMetadata[]> = {}
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];

  // Iterate through each field in the schema
  for (const field of formSchema.fields) {
    // Check if field should be visible based on conditional logic
    const isVisible = shouldShowField(field, formData);

    if (!isVisible) {
      // Skip validation for hidden fields
      continue;
    }

    // Get the value from form data
    const value = formData[field.id];

    // Check required fields
    if (field.required && isEmpty(value)) {
      errors.push({
        field: field.id,
        message: `${field.label} is required`,
      });
      continue;
    }

    // Skip further validation if field is empty and not required
    if (isEmpty(value)) {
      continue;
    }

    // Type-specific validation
    switch (field.type) {
      case 'text':
      case 'textarea':
        if (typeof value !== 'string') {
          errors.push({
            field: field.id,
            message: `${field.label} must be a string`,
          });
        } else {
          // Check minLength/maxLength
          if (field.validation?.minLength && value.length < field.validation.minLength) {
            errors.push({
              field: field.id,
              message: `${field.label} must be at least ${field.validation.minLength} characters`,
            });
          }
          if (field.validation?.maxLength && value.length > field.validation.maxLength) {
            errors.push({
              field: field.id,
              message: `${field.label} must be at most ${field.validation.maxLength} characters`,
            });
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number' && !isNumeric(value)) {
          errors.push({
            field: field.id,
            message: `${field.label} must be a number`,
          });
        } else {
          const numValue = typeof value === 'number' ? value : parseFloat(value);
          // Check min/max
          if (field.validation?.min !== undefined && numValue < field.validation.min) {
            errors.push({
              field: field.id,
              message: `${field.label} must be at least ${field.validation.min}`,
            });
          }
          if (field.validation?.max !== undefined && numValue > field.validation.max) {
            errors.push({
              field: field.id,
              message: `${field.label} must be at most ${field.validation.max}`,
            });
          }
        }
        break;

      case 'select':
      case 'smartselect':
        if (typeof value !== 'string') {
          errors.push({
            field: field.id,
            message: `${field.label} must be a string`,
          });
        }
        break;

      case 'multiselect':
      case 'smartmultiselect':
        if (!Array.isArray(value)) {
          errors.push({
            field: field.id,
            message: `${field.label} must be an array`,
          });
        }
        break;

      case 'date':
        // Validate date format (ISO string)
        if (typeof value !== 'string' || !isValidDate(value)) {
          errors.push({
            field: field.id,
            message: `${field.label} must be a valid date`,
          });
        }
        break;

      case 'dualfield':
        // Validate { value: string, unit: string }
        if (typeof value !== 'object' || !value.value || !value.unit) {
          errors.push({
            field: field.id,
            message: `${field.label} must have both value and unit`,
          });
        }
        break;

      case 'multidualfield':
        // Validate array of { value: string, unit: string }
        if (!Array.isArray(value)) {
          errors.push({
            field: field.id,
            message: `${field.label} must be an array`,
          });
        } else {
          for (let i = 0; i < value.length; i++) {
            if (!value[i].value || !value[i].unit) {
              errors.push({
                field: field.id,
                message: `${field.label} item ${i + 1} must have both value and unit`,
              });
            }
          }
        }
        break;

      case 'triplefield':
        // Validate { value: string, unit: string, amount: number }
        if (typeof value !== 'object' || !value.value || !value.unit || value.amount === undefined) {
          errors.push({
            field: field.id,
            message: `${field.label} must have value, unit, and amount`,
          });
        }
        break;

      case 'multitriplefield':
        // Validate array of { value: string, unit: string, amount: number }
        if (!Array.isArray(value)) {
          errors.push({
            field: field.id,
            message: `${field.label} must be an array`,
          });
        } else {
          for (let i = 0; i < value.length; i++) {
            if (!value[i].value || !value[i].unit || value[i].amount === undefined) {
              errors.push({
                field: field.id,
                message: `${field.label} item ${i + 1} must have value, unit, and amount`,
              });
            }
          }
        }
        break;

      case 'file':
        // Check if photos were uploaded for this field
        if (field.required && (!photoMetadata[field.id] || photoMetadata[field.id].length === 0)) {
          errors.push({
            field: field.id,
            message: `${field.label} requires at least one file`,
          });
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Determines if a field should be shown based on conditional logic
 */
function shouldShowField(field: FormField, formData: Record<string, any>): boolean {
  if (!field.conditional || !field.conditional.enabled) {
    return true; // Always show if no conditions
  }

  const { operator, conditions } = field.conditional;

  const results = conditions.map((condition) =>
    evaluateCondition(condition, formData)
  );

  if (operator === 'AND') {
    return results.every((result) => result === true);
  } else {
    // OR
    return results.some((result) => result === true);
  }
}

/**
 * Evaluates a single condition
 */
function evaluateCondition(
  condition: { fieldId: string; operator: string; value: any },
  formData: Record<string, any>
): boolean {
  const fieldValue = formData[condition.fieldId];
  const expectedValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === expectedValue;

    case 'notEquals':
      return fieldValue !== expectedValue;

    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(expectedValue);

    case 'startsWith':
      return typeof fieldValue === 'string' && fieldValue.startsWith(expectedValue);

    case 'endsWith':
      return typeof fieldValue === 'string' && fieldValue.endsWith(expectedValue);

    case 'greaterThan':
      return parseFloat(fieldValue) > parseFloat(expectedValue);

    case 'lessThan':
      return parseFloat(fieldValue) < parseFloat(expectedValue);

    case 'greaterThanOrEqual':
      return parseFloat(fieldValue) >= parseFloat(expectedValue);

    case 'lessThanOrEqual':
      return parseFloat(fieldValue) <= parseFloat(expectedValue);

    case 'oneOf':
      return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);

    case 'includes':
      return Array.isArray(fieldValue) && fieldValue.includes(expectedValue);

    case 'includesAny':
      return (
        Array.isArray(fieldValue) &&
        Array.isArray(expectedValue) &&
        expectedValue.some((val: any) => fieldValue.includes(val))
      );

    case 'includesAll':
      return (
        Array.isArray(fieldValue) &&
        Array.isArray(expectedValue) &&
        expectedValue.every((val: any) => fieldValue.includes(val))
      );

    case 'isEmpty':
      return isEmpty(fieldValue);

    case 'isNotEmpty':
      return !isEmpty(fieldValue);

    default:
      console.warn(`Unknown condition operator: ${condition.operator}`);
      return false;
  }
}

/**
 * Checks if a value is considered empty
 */
function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Checks if a value is numeric
 */
function isNumeric(value: any): boolean {
  if (typeof value === 'number') return !isNaN(value);
  if (typeof value === 'string') return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
  return false;
}

/**
 * Validates a date string
 */
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Extracts common fields from form data for indexing
 * These fields are stored in fixed columns for fast filtering
 */
export function extractCommonFields(formData: Record<string, any>): {
  category: string | null;
  material: string | null;
  damage_type: string | null;
} {
  return {
    category: formData.category || null,
    material: formData.material || null,
    damage_type: formData.damageType || formData.damage_type || null,
  };
}
