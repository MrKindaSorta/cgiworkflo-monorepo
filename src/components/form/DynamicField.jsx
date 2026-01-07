import { Upload, X, Check } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useTheme } from '../../contexts/ThemeContext';
import Select, { components } from 'react-select';
import SmartSelect from './SmartSelect';
import DualField from './DualField';
import TripleField from './TripleField';

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

const DynamicField = ({ field, register, errors, watch, setValue, photos, setPhotos }) => {
  const fieldValue = watch(field.id);
  const { theme } = useTheme();

  // File upload handler
  const onDrop = (acceptedFiles) => {
    const newPhotos = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    const currentPhotos = photos[field.id] || [];
    setPhotos({
      ...photos,
      [field.id]: field.multiple ? [...currentPhotos, ...newPhotos] : newPhotos,
    });
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: field.accept ? { [field.accept]: [] } : undefined,
    multiple: field.multiple || false,
  });

  // Remove photo
  const removePhoto = (index) => {
    setPhotos({
      ...photos,
      [field.id]: (photos[field.id] || []).filter((_, i) => i !== index),
    });
  };

  // Render field based on type
  switch (field.type) {
    case 'text':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            {...register(field.id, {
              required: field.required ? `${field.label} is required` : false,
            })}
            placeholder={field.placeholder}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {errors[field.id] && (
            <p className="text-red-500 text-sm mt-1">{errors[field.id].message}</p>
          )}
        </div>
      );

    case 'number':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="number"
            step="0.01"
            {...register(field.id, {
              required: field.required ? `${field.label} is required` : false,
              valueAsNumber: true,
              min: field.validation?.min
                ? { value: field.validation.min, message: `Minimum value is ${field.validation.min}` }
                : undefined,
              max: field.validation?.max
                ? { value: field.validation.max, message: `Maximum value is ${field.validation.max}` }
                : undefined,
            })}
            placeholder={field.placeholder}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {errors[field.id] && (
            <p className="text-red-500 text-sm mt-1">{errors[field.id].message}</p>
          )}
        </div>
      );

    case 'textarea':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            rows={4}
            {...register(field.id, {
              required: field.required ? `${field.label} is required` : false,
              minLength: field.validation?.minLength
                ? {
                    value: field.validation.minLength,
                    message: `Minimum length is ${field.validation.minLength} characters`,
                  }
                : undefined,
            })}
            placeholder={field.placeholder}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {errors[field.id] && (
            <p className="text-red-500 text-sm mt-1">{errors[field.id].message}</p>
          )}
        </div>
      );

    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            {...register(field.id, {
              required: field.required ? `${field.label} is required` : false,
            })}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="" className="dark:bg-gray-700 dark:text-white">{field.placeholder || `Select ${field.label}`}</option>
            {field.options?.map((option) => (
              <option key={option} value={option} className="dark:bg-gray-700 dark:text-white">
                {option}
              </option>
            ))}
          </select>
          {errors[field.id] && (
            <p className="text-red-500 text-sm mt-1">{errors[field.id].message}</p>
          )}
        </div>
      );

    case 'multiselect': {
      // Convert options to react-select format
      const options = (field.options || []).map((opt) => ({ value: opt, label: opt }));
      const selectValue = (fieldValue || []).map((v) => ({ value: v, label: v }));

      // Custom styles for dark mode with mobile-optimized touch targets
      const customStyles = {
        control: (base, state) => ({
          ...base,
          backgroundColor: theme === 'dark' ? '#374151' : '#ffffff',
          borderColor: state.isFocused
            ? theme === 'dark' ? '#3b82f6' : '#3b82f6'
            : theme === 'dark' ? '#4b5563' : '#d1d5db',
          color: theme === 'dark' ? '#ffffff' : '#111827',
          minHeight: '52px', // Larger for mobile touch
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
          padding: '14px', // Larger touch target for mobile
          minHeight: '48px', // 44px+ minimum for mobile
          '&:active': {
            backgroundColor: theme === 'dark' ? '#374151' : '#e5e7eb',
          },
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
      };

      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Select
            isMulti
            options={options}
            value={selectValue}
            onChange={(selected) => setValue(field.id, (selected || []).map((s) => s.value))}
            placeholder={field.placeholder || `Select ${field.label}`}
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            components={{ Option: CheckboxOption }}
            styles={customStyles}
            className="react-select-container"
            classNamePrefix="react-select"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Click options to select/deselect. Dropdown stays open.
          </p>
          {errors[field.id] && (
            <p className="text-red-500 text-sm mt-1">{errors[field.id].message}</p>
          )}
        </div>
      );
    }

    case 'smartselect':
    case 'smartmultiselect':
      return (
        <SmartSelect
          field={field}
          value={fieldValue}
          onChange={(newValue) => setValue(field.id, newValue)}
          error={errors[field.id]?.message}
        />
      );

    case 'dualfield':
    case 'multidualfield':
      return (
        <DualField
          field={field}
          value={fieldValue}
          onChange={(newValue) => setValue(field.id, newValue)}
          error={errors[field.id]?.message}
        />
      );

    case 'triplefield':
    case 'multitriplefield':
      return (
        <TripleField
          field={field}
          value={fieldValue}
          onChange={(newValue) => setValue(field.id, newValue)}
          error={errors[field.id]?.message}
        />
      );

    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="date"
            {...register(field.id, {
              required: field.required ? `${field.label} is required` : false,
            })}
            min={field.validation?.minDate}
            max={field.validation?.maxDate}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {errors[field.id] && (
            <p className="text-red-500 text-sm mt-1">{errors[field.id].message}</p>
          )}
        </div>
      );

    case 'file':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div
            {...getRootProps()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 transition-colors"
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {field.placeholder || 'Drop files here or click to browse'}
            </p>
            {field.multiple && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                You can upload multiple files
              </p>
            )}
          </div>
          {(photos[field.id] || []).length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(photos[field.id] || []).map((photo, index) => (
                <div key={index} className="relative">
                  <img
                    src={photo.preview}
                    alt={`${field.label} ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {errors[field.id] && (
            <p className="text-red-500 text-sm mt-1">{errors[field.id].message}</p>
          )}
        </div>
      );

    default:
      return (
        <div>
          <p className="text-sm text-red-500">Unknown field type: {field.type}</p>
        </div>
      );
  }
};

export default DynamicField;
