import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import CreatableSelect from 'react-select/creatable';
import { Plus, Trash2 } from 'lucide-react';

const DualField = ({ field, value, onChange, error }) => {
  const { theme } = useTheme();

  // For single dual field, value is { value: string, unit: string }
  // For multi dual field, value is [{ value: string, unit: string }, ...]
  const isMulti = field.type === 'multidualfield';

  // Initialize value appropriately
  const [items, setItems] = useState(
    isMulti
      ? value || [{ value: '', unit: '' }]
      : [value || { value: '', unit: '' }]
  );

  // Convert options array to react-select format
  const valueOptions = (field.options || []).map((opt) => ({
    value: opt,
    label: opt,
  }));

  // Handle item change
  const handleItemChange = (index, newValue, newUnit) => {
    const newItems = [...items];
    newItems[index] = {
      value: newValue !== undefined ? newValue : newItems[index].value,
      unit: newUnit !== undefined ? newUnit : newItems[index].unit,
    };
    setItems(newItems);

    // Update parent
    if (isMulti) {
      onChange(newItems);
    } else {
      onChange(newItems[0]);
    }
  };

  // Add new item (multi only)
  const addItem = () => {
    const newItems = [...items, { value: '', unit: '' }];
    setItems(newItems);
    onChange(newItems);
  };

  // Remove item (multi only)
  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems.length > 0 ? newItems : [{ value: '', unit: '' }]);
    onChange(newItems.length > 0 ? newItems : [{ value: '', unit: '' }]);
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

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            {/* Value - Smart Dropdown */}
            <div className="flex-1">
              <CreatableSelect
                isClearable
                options={valueOptions}
                value={item.value ? { value: item.value, label: item.value } : null}
                onChange={(selected) =>
                  handleItemChange(index, selected ? selected.value : '', undefined)
                }
                placeholder={field.placeholder || 'Search or create...'}
                formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                noOptionsMessage={() => 'Type to create new option'}
                styles={customStyles}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>

            {/* Unit - Fixed Dropdown */}
            <div className="w-32">
              <select
                value={item.unit}
                onChange={(e) => handleItemChange(index, undefined, e.target.value)}
                className="w-full px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="" className="dark:bg-gray-700 dark:text-white">
                  {field.unitLabel || 'Unit'}
                </option>
                {(field.unitOptions || []).map((unit) => (
                  <option key={unit} value={unit} className="dark:bg-gray-700 dark:text-white">
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Delete button for multi */}
            {isMulti && items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              </button>
            )}
          </div>
        ))}

        {/* Add button for multi */}
        {isMulti && (
          <button
            type="button"
            onClick={addItem}
            className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add Another</span>
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default DualField;
