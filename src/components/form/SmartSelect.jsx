import { useTheme } from '../../contexts/ThemeContext';
import CreatableSelect from 'react-select/creatable';
import { components } from 'react-select';
import { Check } from 'lucide-react';

// Custom Option component with checkbox for multiselect
const CheckboxOption = (props) => {
  return (
    <components.Option {...props}>
      <div className="flex items-center space-x-3">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          props.isSelected
            ? 'bg-primary-500 border-primary-500'
            : 'border-gray-400 dark:border-gray-500'
        }`}>
          {props.isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <span className="flex-1">{props.label}</span>
      </div>
    </components.Option>
  );
};

const SmartSelect = ({ field, value, onChange, error }) => {
  const { theme } = useTheme();

  // Convert options array to react-select format
  const options = (field.options || []).map((opt) => ({
    value: opt,
    label: opt,
  }));

  // Convert value to react-select format
  const selectValue = field.type === 'smartmultiselect'
    ? (value || []).map((v) => ({ value: v, label: v }))
    : value
    ? { value, label: value }
    : null;

  // Handle change
  const handleChange = (selected) => {
    if (field.type === 'smartmultiselect') {
      onChange((selected || []).map((s) => s.value));
    } else {
      onChange(selected ? selected.value : '');
    }
  };

  const isMulti = field.type === 'smartmultiselect';

  // Custom styles for dark mode with mobile-optimized touch targets
  const customStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
      borderColor: state.isFocused
        ? theme === 'dark' ? '#3b82f6' : '#3b82f6'
        : theme === 'dark' ? '#4b5563' : '#d1d5db',
      color: theme === 'dark' ? '#ffffff' : '#111827',
      minHeight: '52px', // Larger for mobile
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
    }),
    menuList: (base) => ({
      ...base,
      backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
      maxHeight: '300px', // More options visible
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused
        ? theme === 'dark' ? '#4b5563' : '#f3f4f6'
        : theme === 'dark' ? '#374151' : '#ffffff',
      color: theme === 'dark' ? '#ffffff' : '#111827',
      cursor: 'pointer',
      padding: '14px', // Larger touch target
      minHeight: '48px', // 44px+ for mobile
      '&:active': {
        backgroundColor: theme === 'dark' ? '#374151' : '#e5e7eb',
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: theme === 'dark' ? '#ffffff' : '#111827',
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: theme === 'dark' ? '#1f2937' : '#dbeafe',
      minHeight: '32px', // Larger tags for mobile
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: theme === 'dark' ? '#ffffff' : '#1e40af',
      fontSize: '14px',
      padding: '6px 8px',
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: theme === 'dark' ? '#9ca3af' : '#6b7280',
      padding: '0 6px',
      '&:hover': {
        backgroundColor: theme === 'dark' ? '#ef4444' : '#fee2e2',
        color: theme === 'dark' ? '#ffffff' : '#991b1b',
      },
    }),
    input: (base) => ({
      ...base,
      color: theme === 'dark' ? '#ffffff' : '#111827',
    }),
    placeholder: (base) => ({
      ...base,
      color: theme === 'dark' ? '#9ca3af' : '#6b7280',
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: theme === 'dark' ? '#9ca3af' : '#6b7280',
    }),
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <CreatableSelect
        isClearable
        isMulti={isMulti}
        options={options}
        value={selectValue}
        onChange={handleChange}
        placeholder={field.placeholder || 'Search or create...'}
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
        noOptionsMessage={() => 'Type to create new option'}
        closeMenuOnSelect={!isMulti}
        hideSelectedOptions={false}
        components={isMulti ? { Option: CheckboxOption } : {}}
        styles={customStyles}
        className="react-select-container"
        classNamePrefix="react-select"
      />
      {isMulti && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Click options to select/deselect. Dropdown stays open.
        </p>
      )}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default SmartSelect;
