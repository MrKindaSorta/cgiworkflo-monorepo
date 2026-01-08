import { useTheme } from '../../contexts/ThemeContext';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

/**
 * SmartConditionValueInput - Adaptive input for conditional logic value entry
 *
 * Renders the appropriate input type based on the referenced field:
 * - Select fields → Dropdown with options
 * - Date fields → Date picker
 * - Number fields → Number input
 * - Smart fields → Creatable dropdown
 * - Text fields → Text input (default)
 */
const SmartConditionValueInput = ({
  referencedField,
  operator,
  value,
  onChange,
}) => {
  const { theme } = useTheme();

  // Operators that don't need value input
  const noValueOperators = ['isEmpty', 'isNotEmpty'];

  // Operators that require array values
  const arrayOperators = ['oneOf', 'includesAny', 'includesAll'];

  // If no field selected yet, show basic text input
  if (!referencedField) {
    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Value"
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
      />
    );
  }

  // Determine if we need multi-select based on operator
  const isArrayOperator = arrayOperators.includes(operator);

  // Compact custom styles for condition builder (smaller than regular forms)
  const getCompactCustomStyles = (includeMultiValue = false) => ({
    control: (base, state) => ({
      ...base,
      backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
      borderColor: state.isFocused
        ? theme === 'dark' ? '#3b82f6' : '#3b82f6'
        : theme === 'dark' ? '#4b5563' : '#d1d5db',
      color: theme === 'dark' ? '#ffffff' : '#111827',
      minHeight: '38px', // Compact for condition builder
      fontSize: '0.75rem', // text-xs
      boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
      '&:hover': {
        borderColor: theme === 'dark' ? '#6b7280' : '#9ca3af',
      },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
      border: theme === 'dark' ? '1px solid #4b5563' : '1px solid #d1d5db',
      zIndex: 50,
      fontSize: '0.75rem',
    }),
    menuList: (base) => ({
      ...base,
      backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
      maxHeight: '200px', // Compact list
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused
        ? theme === 'dark' ? '#4b5563' : '#f3f4f6'
        : theme === 'dark' ? '#374151' : '#ffffff',
      color: theme === 'dark' ? '#ffffff' : '#111827',
      cursor: 'pointer',
      padding: '8px 12px', // Compact padding
      fontSize: '0.75rem',
    }),
    singleValue: (base) => ({
      ...base,
      color: theme === 'dark' ? '#ffffff' : '#111827',
      fontSize: '0.75rem',
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: theme === 'dark' ? '#1f2937' : '#dbeafe',
      fontSize: '0.75rem',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: theme === 'dark' ? '#ffffff' : '#1e40af',
      fontSize: '0.75rem',
      padding: '2px 6px',
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: theme === 'dark' ? '#9ca3af' : '#6b7280',
      '&:hover': {
        backgroundColor: theme === 'dark' ? '#ef4444' : '#fee2e2',
        color: theme === 'dark' ? '#ffffff' : '#991b1b',
      },
    }),
    input: (base) => ({
      ...base,
      color: theme === 'dark' ? '#ffffff' : '#111827',
      fontSize: '0.75rem',
    }),
    placeholder: (base) => ({
      ...base,
      color: theme === 'dark' ? '#9ca3af' : '#6b7280',
      fontSize: '0.75rem',
    }),
  });

  // Render select field as native dropdown
  if (referencedField.type === 'select' && !isArrayOperator) {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
      >
        <option value="" className="dark:bg-gray-700 dark:text-white">
          Select value...
        </option>
        {(referencedField.options || []).map((opt) => (
          <option key={opt} value={opt} className="dark:bg-gray-700 dark:text-white">
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // Render select field with array operator as multi-select
  if ((referencedField.type === 'select' || referencedField.type === 'multiselect') && isArrayOperator) {
    const options = (referencedField.options || []).map((opt) => ({
      value: opt,
      label: opt,
    }));

    const selectValue = Array.isArray(value)
      ? value.map((v) => ({ value: v, label: v }))
      : [];

    return (
      <Select
        isMulti
        isClearable
        options={options}
        value={selectValue}
        onChange={(selected) => onChange((selected || []).map((s) => s.value))}
        placeholder="Select values..."
        styles={getCompactCustomStyles(true)}
        className="react-select-container"
        classNamePrefix="react-select"
      />
    );
  }

  // Render multiselect as multi-select
  if (referencedField.type === 'multiselect') {
    const options = (referencedField.options || []).map((opt) => ({
      value: opt,
      label: opt,
    }));

    const selectValue = Array.isArray(value)
      ? value.map((v) => ({ value: v, label: v }))
      : [];

    return (
      <Select
        isMulti
        isClearable
        options={options}
        value={selectValue}
        onChange={(selected) => onChange((selected || []).map((s) => s.value))}
        placeholder="Select values..."
        styles={getCompactCustomStyles(true)}
        className="react-select-container"
        classNamePrefix="react-select"
      />
    );
  }

  // Render smart select fields as creatable dropdown
  if (referencedField.type === 'smartselect' && !isArrayOperator) {
    const options = (referencedField.options || []).map((opt) => ({
      value: opt,
      label: opt,
    }));

    const selectValue = value ? { value, label: value } : null;

    return (
      <CreatableSelect
        isClearable
        options={options}
        value={selectValue}
        onChange={(selected) => onChange(selected ? selected.value : '')}
        placeholder="Select or create..."
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
        styles={getCompactCustomStyles(false)}
        className="react-select-container"
        classNamePrefix="react-select"
      />
    );
  }

  // Render smart multiselect or array operator as creatable multi-select
  if (
    referencedField.type === 'smartmultiselect' ||
    (referencedField.type === 'smartselect' && isArrayOperator)
  ) {
    const options = (referencedField.options || []).map((opt) => ({
      value: opt,
      label: opt,
    }));

    const selectValue = Array.isArray(value)
      ? value.map((v) => ({ value: v, label: v }))
      : [];

    return (
      <CreatableSelect
        isMulti
        isClearable
        options={options}
        value={selectValue}
        onChange={(selected) => onChange((selected || []).map((s) => s.value))}
        placeholder="Select or create..."
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
        styles={getCompactCustomStyles(true)}
        className="react-select-container"
        classNamePrefix="react-select"
      />
    );
  }

  // Render date fields as date picker
  if (referencedField.type === 'date') {
    return (
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        min={referencedField.validation?.minDate}
        max={referencedField.validation?.maxDate}
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
      />
    );
  }

  // Render number fields as number input
  if (referencedField.type === 'number') {
    return (
      <input
        type="number"
        step="0.01"
        value={value || ''}
        onChange={(e) => {
          const numValue = e.target.value ? parseFloat(e.target.value) : '';
          onChange(numValue);
        }}
        min={referencedField.validation?.min}
        max={referencedField.validation?.max}
        placeholder="Value"
        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
      />
    );
  }

  // Render file fields as disabled with message
  if (referencedField.type === 'file') {
    return (
      <div className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 italic">
        File fields cannot be used in conditions
      </div>
    );
  }

  // Default: text input for text, textarea, and dual/triple fields
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
    />
  );
};

export default SmartConditionValueInput;
