import { useTheme } from '../../contexts/ThemeContext';
import CreatableSelect from 'react-select/creatable';

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

  // Custom styles for dark mode
  const customStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
      borderColor: state.isFocused
        ? theme === 'dark' ? '#3b82f6' : '#3b82f6'
        : theme === 'dark' ? '#4b5563' : '#d1d5db',
      color: theme === 'dark' ? '#ffffff' : '#111827',
      minHeight: '48px',
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
      maxHeight: '200px',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? theme === 'dark' ? '#1f2937' : '#dbeafe'
        : state.isFocused
        ? theme === 'dark' ? '#4b5563' : '#f3f4f6'
        : theme === 'dark' ? '#374151' : '#ffffff',
      color: state.isSelected
        ? theme === 'dark' ? '#ffffff' : '#1e40af'
        : theme === 'dark' ? '#ffffff' : '#111827',
      cursor: 'pointer',
      padding: '12px',
      '&:active': {
        backgroundColor: theme === 'dark' ? '#1f2937' : '#bfdbfe',
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: theme === 'dark' ? '#ffffff' : '#111827',
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: theme === 'dark' ? '#1f2937' : '#dbeafe',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: theme === 'dark' ? '#ffffff' : '#1e40af',
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
        isMulti={field.type === 'smartmultiselect'}
        options={options}
        value={selectValue}
        onChange={handleChange}
        placeholder={field.placeholder || 'Search or create...'}
        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
        noOptionsMessage={() => 'Type to create new option'}
        styles={customStyles}
        className="react-select-container"
        classNamePrefix="react-select"
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default SmartSelect;
