import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  GripVertical,
  Settings,
  Eye,
  Code,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  FileText,
  Upload,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
} from 'lucide-react';

// Field type definitions
const FIELD_TYPES = [
  { type: 'text', icon: Type, label: 'Text Input', group: 'Basic' },
  { type: 'textarea', icon: FileText, label: 'Text Area', group: 'Basic' },
  { type: 'number', icon: Hash, label: 'Number', group: 'Basic' },
  { type: 'select', icon: List, label: 'Dropdown', group: 'Basic' },
  { type: 'multiselect', icon: CheckSquare, label: 'Multi-Select', group: 'Basic' },
  { type: 'date', icon: Calendar, label: 'Date', group: 'Basic' },
  { type: 'file', icon: Upload, label: 'File Upload', group: 'Basic' },
];

// Section definitions for organizing fields
const SECTIONS = [
  { id: 'basic', name: 'Basic Information', order: 0 },
  { id: 'damage', name: 'Damage Information', order: 1 },
  { id: 'repair', name: 'Repair Details', order: 2 },
  { id: 'photos', name: 'Photos & Attachments', order: 3 },
];

// Default form schema
const DEFAULT_SCHEMA = {
  formId: 'aar-form',
  version: '1.0',
  sections: SECTIONS,
  fields: [
    {
      id: 'category',
      type: 'select',
      label: 'Category',
      placeholder: 'Select Category',
      required: true,
      order: 0,
      section: 'basic',
      options: ['Vehicle', 'Boat', 'Motorcycle', 'Apparel', 'Accessory', 'Furniture'],
    },
    {
      id: 'model',
      type: 'text',
      label: 'Model',
      placeholder: 'Enter model',
      required: true,
      order: 1,
      section: 'basic',
    },
    {
      id: 'year',
      type: 'number',
      label: 'Year',
      placeholder: 'Enter year',
      required: true,
      order: 2,
      section: 'basic',
      validation: { min: 1900, max: 2100 },
    },
    {
      id: 'damageType',
      type: 'select',
      label: 'Damage Type',
      placeholder: 'Select damage type',
      required: true,
      order: 0,
      section: 'damage',
      options: ['Scratch', 'Tear', 'Stain', 'Burn', 'Crack', 'Dent'],
    },
    {
      id: 'damageDescription',
      type: 'textarea',
      label: 'Damage Description',
      placeholder: 'Describe the damage in detail',
      required: true,
      order: 1,
      section: 'damage',
      validation: { minLength: 10 },
    },
    {
      id: 'repairTime',
      type: 'number',
      label: 'Repair Time (hours)',
      placeholder: 'Enter repair time',
      required: true,
      order: 0,
      section: 'repair',
      validation: { min: 0.1 },
    },
    {
      id: 'processDescription',
      type: 'textarea',
      label: 'Process Description',
      placeholder: 'Describe the repair process',
      required: true,
      order: 1,
      section: 'repair',
      validation: { minLength: 20 },
    },
    {
      id: 'beforePhotos',
      type: 'file',
      label: 'Before Photos',
      placeholder: 'Upload before photos',
      required: false,
      order: 0,
      section: 'photos',
      multiple: true,
      accept: 'image/*',
    },
    {
      id: 'afterPhotos',
      type: 'file',
      label: 'After Photos',
      placeholder: 'Upload after photos',
      required: false,
      order: 1,
      section: 'photos',
      multiple: true,
      accept: 'image/*',
    },
  ],
};

const Customize = () => {
  const { t } = useTranslation();
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [selectedField, setSelectedField] = useState(null);
  const [view, setView] = useState('builder'); // builder | preview | json
  const [expandedSections, setExpandedSections] = useState(
    SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: true }), {})
  );

  // Load schema from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('aar-form-schema');
    if (saved) {
      try {
        setSchema(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load schema:', e);
      }
    }
  }, []);

  // Save schema to localStorage
  const saveSchema = () => {
    localStorage.setItem('aar-form-schema', JSON.stringify(schema));
    alert('Form schema saved successfully!');
  };

  // Reset to default schema
  const resetSchema = () => {
    if (confirm('Are you sure you want to reset to default schema? This cannot be undone.')) {
      setSchema(DEFAULT_SCHEMA);
      localStorage.removeItem('aar-form-schema');
      setSelectedField(null);
    }
  };

  // Add new field
  const addField = (fieldType) => {
    const newField = {
      id: `field_${Date.now()}`,
      type: fieldType.type,
      label: `New ${fieldType.label}`,
      placeholder: `Enter ${fieldType.label.toLowerCase()}`,
      required: false,
      order: schema.fields.filter((f) => f.section === 'basic').length,
      section: 'basic',
      ...(fieldType.type === 'select' || fieldType.type === 'multiselect'
        ? { options: ['Option 1', 'Option 2', 'Option 3'] }
        : {}),
      ...(fieldType.type === 'file' ? { multiple: false, accept: 'image/*' } : {}),
      ...(fieldType.type === 'number' ? { validation: { min: 0 } } : {}),
      ...(fieldType.type === 'textarea' ? { validation: { minLength: 10 } } : {}),
    };

    setSchema({
      ...schema,
      fields: [...schema.fields, newField],
    });
    setSelectedField(newField);
  };

  // Delete field
  const deleteField = (fieldId) => {
    setSchema({
      ...schema,
      fields: schema.fields.filter((f) => f.id !== fieldId),
    });
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  };

  // Update field
  const updateField = (fieldId, updates) => {
    setSchema({
      ...schema,
      fields: schema.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)),
    });
    if (selectedField?.id === fieldId) {
      setSelectedField({ ...selectedField, ...updates });
    }
  };

  // Move field up/down
  const moveField = (fieldId, direction) => {
    const fieldIndex = schema.fields.findIndex((f) => f.id === fieldId);
    if (fieldIndex === -1) return;

    const field = schema.fields[fieldIndex];
    const sectionFields = schema.fields
      .filter((f) => f.section === field.section)
      .sort((a, b) => a.order - b.order);

    const sectionIndex = sectionFields.findIndex((f) => f.id === fieldId);
    if (
      (direction === 'up' && sectionIndex === 0) ||
      (direction === 'down' && sectionIndex === sectionFields.length - 1)
    ) {
      return;
    }

    const swapField = sectionFields[sectionIndex + (direction === 'up' ? -1 : 1)];
    const tempOrder = field.order;
    updateField(field.id, { order: swapField.order });
    updateField(swapField.id, { order: tempOrder });
  };

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Get fields for a section
  const getFieldsForSection = (sectionId) => {
    return schema.fields
      .filter((f) => f.section === sectionId)
      .sort((a, b) => a.order - b.order);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('nav.customize')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Customize the Submit AAR form fields and layout
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* View Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setView('builder')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'builder'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('preview')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'preview'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('json')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  view === 'json'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Code className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={resetSchema}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden md:inline">Reset</span>
            </button>

            <button
              onClick={saveSchema}
              className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span className="hidden md:inline">Save</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'builder' && (
          <div className="h-full grid grid-cols-1 md:grid-cols-12 gap-0">
            {/* Left Panel - Field Library */}
            <div className="md:col-span-3 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Field Library
              </h3>
              <div className="space-y-2">
                {FIELD_TYPES.map((fieldType) => (
                  <button
                    key={fieldType.type}
                    onClick={() => addField(fieldType)}
                    className="w-full flex items-center space-x-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left"
                  >
                    <fieldType.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {fieldType.label}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Center Panel - Form Builder */}
            <div className="md:col-span-6 overflow-y-auto p-4 md:p-6">
              <div className="space-y-4">
                {SECTIONS.map((section) => {
                  const sectionFields = getFieldsForSection(section.id);
                  return (
                    <div
                      key={section.id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      {/* Section Header */}
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {section.name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {sectionFields.length} fields
                          </span>
                          {expandedSections[section.id] ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Section Fields */}
                      {expandedSections[section.id] && (
                        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-2">
                          {sectionFields.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                              No fields in this section. Add fields from the library.
                            </p>
                          ) : (
                            sectionFields.map((field) => {
                              const FieldIcon =
                                FIELD_TYPES.find((ft) => ft.type === field.type)?.icon || Type;
                              return (
                                <div
                                  key={field.id}
                                  onClick={() => setSelectedField(field)}
                                  className={`flex items-center space-x-3 p-3 rounded-lg border ${
                                    selectedField?.id === field.id
                                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                  } cursor-pointer transition-colors`}
                                >
                                  <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                                  <FieldIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {field.label}
                                      {field.required && (
                                        <span className="text-red-500 ml-1">*</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {field.type}
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveField(field.id, 'up');
                                      }}
                                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                    >
                                      <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveField(field.id, 'down');
                                      }}
                                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                    >
                                      <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteField(field.id);
                                      }}
                                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Panel - Field Properties */}
            <div className="md:col-span-3 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-4">
              {selectedField ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Field Properties
                  </h3>

                  {/* Label */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      value={selectedField.label}
                      onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Placeholder */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Placeholder
                    </label>
                    <input
                      type="text"
                      value={selectedField.placeholder || ''}
                      onChange={(e) =>
                        updateField(selectedField.id, { placeholder: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Required */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="required"
                      checked={selectedField.required}
                      onChange={(e) =>
                        updateField(selectedField.id, { required: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label
                      htmlFor="required"
                      className="ml-2 text-xs font-medium text-gray-700 dark:text-gray-300"
                    >
                      Required field
                    </label>
                  </div>

                  {/* Section */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Section
                    </label>
                    <select
                      value={selectedField.section}
                      onChange={(e) => {
                        const newSection = e.target.value;
                        const sectionFields = getFieldsForSection(newSection);
                        updateField(selectedField.id, {
                          section: newSection,
                          order: sectionFields.length,
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    >
                      {SECTIONS.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Options for select/multiselect */}
                  {(selectedField.type === 'select' || selectedField.type === 'multiselect') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Options (one per line)
                      </label>
                      <textarea
                        value={selectedField.options?.join('\n') || ''}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            options: e.target.value.split('\n').filter((o) => o.trim()),
                          })
                        }
                        rows={5}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      />
                    </div>
                  )}

                  {/* Validation for number */}
                  {selectedField.type === 'number' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Min Value
                        </label>
                        <input
                          type="number"
                          value={selectedField.validation?.min || ''}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                min: parseFloat(e.target.value),
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Max Value
                        </label>
                        <input
                          type="number"
                          value={selectedField.validation?.max || ''}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                max: parseFloat(e.target.value),
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  {/* Validation for textarea */}
                  {selectedField.type === 'textarea' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Min Length
                      </label>
                      <input
                        type="number"
                        value={selectedField.validation?.minLength || ''}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            validation: {
                              ...selectedField.validation,
                              minLength: parseInt(e.target.value),
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      />
                    </div>
                  )}

                  {/* File upload settings */}
                  {selectedField.type === 'file' && (
                    <>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="multiple"
                          checked={selectedField.multiple || false}
                          onChange={(e) =>
                            updateField(selectedField.id, { multiple: e.target.checked })
                          }
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <label
                          htmlFor="multiple"
                          className="ml-2 text-xs font-medium text-gray-700 dark:text-gray-300"
                        >
                          Allow multiple files
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Accept (file types)
                        </label>
                        <input
                          type="text"
                          value={selectedField.accept || ''}
                          onChange={(e) =>
                            updateField(selectedField.id, { accept: e.target.value })
                          }
                          placeholder="image/*"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select a field to edit its properties
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'preview' && (
          <div className="h-full overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Preview Mode:</strong> This is how the Submit AAR form will look to users.
                  Changes are not saved until you click "Save" in builder mode.
                </p>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Submit AAR Preview
              </h2>

              <div className="space-y-6">
                {SECTIONS.map((section) => {
                  const sectionFields = getFieldsForSection(section.id);
                  if (sectionFields.length === 0) return null;

                  return (
                    <div
                      key={section.id}
                      className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm space-y-4"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {section.name}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sectionFields.map((field) => (
                          <div
                            key={field.id}
                            className={
                              field.type === 'textarea' || field.type === 'file'
                                ? 'md:col-span-2'
                                : ''
                            }
                          >
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            {field.type === 'text' && (
                              <input
                                type="text"
                                placeholder={field.placeholder}
                                disabled
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            )}

                            {field.type === 'number' && (
                              <input
                                type="number"
                                placeholder={field.placeholder}
                                disabled
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            )}

                            {field.type === 'textarea' && (
                              <textarea
                                rows={4}
                                placeholder={field.placeholder}
                                disabled
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            )}

                            {field.type === 'select' && (
                              <select
                                disabled
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="">{field.placeholder}</option>
                                {field.options?.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            )}

                            {field.type === 'date' && (
                              <input
                                type="date"
                                disabled
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            )}

                            {field.type === 'file' && (
                              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {field.placeholder || 'Drop files here or click to browse'}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {view === 'json' && (
          <div className="h-full overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-gray-900 rounded-xl p-6 overflow-x-auto">
                <pre className="text-sm text-green-400 font-mono">
                  {JSON.stringify(schema, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Customize;
