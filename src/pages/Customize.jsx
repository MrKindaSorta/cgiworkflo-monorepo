import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';
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
  FolderPlus,
  Edit2,
  X,
  Sparkles,
  Layers,
  Split,
  ListPlus,
  Info,
} from 'lucide-react';

// Field type definitions with descriptions
const FIELD_TYPES = [
  {
    type: 'text',
    icon: Type,
    label: 'Text Input',
    group: 'Basic',
    description: 'Single-line text input for short responses like names, models, or IDs. Supports placeholder text and can be marked as required.',
  },
  {
    type: 'textarea',
    icon: FileText,
    label: 'Text Area',
    group: 'Basic',
    description: 'Multi-line text input for longer descriptions or detailed notes. You can set a minimum character length requirement.',
  },
  {
    type: 'number',
    icon: Hash,
    label: 'Number',
    group: 'Basic',
    description: 'Numeric input field for quantities, measurements, or counts. Supports decimal values and min/max validation.',
  },
  {
    type: 'select',
    icon: List,
    label: 'Dropdown',
    group: 'Basic',
    description: 'Standard dropdown menu with fixed options defined by admin. Users select one option from the list you provide.',
  },
  {
    type: 'multiselect',
    icon: CheckSquare,
    label: 'Multi-Select',
    group: 'Basic',
    description: 'Dropdown that allows selecting multiple options. Useful for selecting multiple tools, materials, or categories from a fixed list.',
  },
  {
    type: 'date',
    icon: Calendar,
    label: 'Date',
    group: 'Basic',
    description: 'Date picker for selecting dates. You can set minimum and maximum date constraints to restrict the date range.',
  },
  {
    type: 'file',
    icon: Upload,
    label: 'File Upload',
    group: 'Basic',
    description: 'File upload field with drag-and-drop support. Configure to accept specific file types (images, PDFs, etc.) and allow single or multiple files.',
  },
  {
    type: 'smartselect',
    icon: Sparkles,
    label: 'Smart Dropdown',
    group: 'Smart',
    description: 'Searchable dropdown that learns from submissions. Users can search existing options OR create new ones on the fly. The options list grows automatically as users submit AARs.',
  },
  {
    type: 'smartmultiselect',
    icon: Layers,
    label: 'Smart Multi-Select',
    group: 'Smart',
    description: 'Multi-select version of Smart Dropdown. Users can search and select multiple existing options, or create new ones. Perfect for dynamic lists that expand over time.',
  },
  {
    type: 'dualfield',
    icon: Split,
    label: 'Custom Dual Field',
    group: 'Advanced',
    description: 'Combines a searchable/creatable dropdown with a fixed unit selector. Example: "Red" + "mL" for tracking colors with volumes. Perfect for materials, paints, or chemicals with measurements.',
  },
  {
    type: 'multidualfield',
    icon: ListPlus,
    label: 'Multi Custom Dual Field',
    group: 'Advanced',
    description: 'Multiple rows of dual fields with + button to add more. Each row has a searchable value and fixed unit. Example: Track multiple colors used, each with different volumes.',
  },
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
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({ id: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [hoveredFieldType, setHoveredFieldType] = useState(null);

  // Load schema from API (with localStorage fallback)
  useEffect(() => {
    const loadFormSchema = async () => {
      try {
        const response = await api.customForms.getActive();

        if (response.data.form) {
          // Use database schema
          setSchema(response.data.form.schema);
        } else {
          // No form in database yet - check localStorage for migration
          const localSchema = localStorage.getItem('aar-form-schema');
          if (localSchema) {
            // Will be migrated on first save
            setSchema(JSON.parse(localSchema));
          } else {
            // Use default schema
            setSchema(DEFAULT_SCHEMA);
          }
        }
      } catch (error) {
        console.error('Error loading form:', error);
        // Fallback to localStorage
        const localSchema = localStorage.getItem('aar-form-schema');
        if (localSchema) {
          setSchema(JSON.parse(localSchema));
        } else {
          setSchema(DEFAULT_SCHEMA);
        }
      }
    };

    loadFormSchema();
  }, []);

  // Save schema to database
  const saveSchema = async () => {
    try {
      setLoading(true);
      await api.customForms.updateActive(
        schema,
        'AAR Submission Form',
        'Customized AAR submission form'
      );

      // Keep localStorage in sync as backup
      localStorage.setItem('aar-form-schema', JSON.stringify(schema));

      alert('Form schema saved successfully!');
    } catch (error) {
      console.error('Error saving form:', error);
      alert('Failed to save form. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Reset to default schema
  const resetSchema = async () => {
    if (!confirm('Are you sure you want to reset to default schema? This cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await api.customForms.reset(DEFAULT_SCHEMA);
      setSchema(DEFAULT_SCHEMA);
      localStorage.removeItem('aar-form-schema');
      setSelectedField(null);
      alert('Form reset to default successfully!');
    } catch (error) {
      console.error('Error resetting form:', error);
      alert('Failed to reset form. Please try again.');
    } finally {
      setLoading(false);
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
      ...(fieldType.type === 'smartselect' || fieldType.type === 'smartmultiselect'
        ? { options: [], allowCreate: true }
        : {}),
      ...(fieldType.type === 'dualfield' || fieldType.type === 'multidualfield'
        ? { options: [], unitOptions: ['Unit 1', 'Unit 2'], unitLabel: 'Unit', allowCreate: true }
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

  // Section management functions
  const openSectionModal = (section = null) => {
    if (section) {
      setEditingSection(section);
      setSectionForm({ id: section.id, name: section.name });
    } else {
      setEditingSection(null);
      setSectionForm({ id: '', name: '' });
    }
    setShowSectionModal(true);
  };

  const closeSectionModal = () => {
    setShowSectionModal(false);
    setEditingSection(null);
    setSectionForm({ id: '', name: '' });
  };

  const saveSection = () => {
    if (!sectionForm.name.trim()) {
      alert('Section name is required');
      return;
    }

    if (editingSection) {
      // Update existing section
      setSchema({
        ...schema,
        sections: schema.sections.map((s) =>
          s.id === editingSection.id ? { ...s, name: sectionForm.name } : s
        ),
      });
    } else {
      // Create new section
      const newId = sectionForm.id || `section_${Date.now()}`;

      // Check if ID already exists
      if (schema.sections.find((s) => s.id === newId)) {
        alert('Section ID already exists. Please use a unique ID.');
        return;
      }

      const newSection = {
        id: newId,
        name: sectionForm.name,
        order: schema.sections.length,
      };

      setSchema({
        ...schema,
        sections: [...schema.sections, newSection],
      });

      // Auto-expand the new section
      setExpandedSections((prev) => ({ ...prev, [newId]: true }));
    }

    closeSectionModal();
  };

  const deleteSection = (sectionId) => {
    // Check if section has fields
    const hasFields = schema.fields.some((f) => f.section === sectionId);

    if (hasFields) {
      if (!confirm('This section has fields. Deleting it will move all fields to the first section. Continue?')) {
        return;
      }

      // Move fields to first section
      const firstSectionId = schema.sections[0].id;
      setSchema({
        ...schema,
        sections: schema.sections.filter((s) => s.id !== sectionId),
        fields: schema.fields.map((f) =>
          f.section === sectionId ? { ...f, section: firstSectionId } : f
        ),
      });
    } else {
      if (!confirm('Are you sure you want to delete this section?')) {
        return;
      }

      setSchema({
        ...schema,
        sections: schema.sections.filter((s) => s.id !== sectionId),
      });
    }

    // Remove from expanded sections
    setExpandedSections((prev) => {
      const newExpanded = { ...prev };
      delete newExpanded[sectionId];
      return newExpanded;
    });
  };

  const moveSectionUp = (sectionId) => {
    const index = schema.sections.findIndex((s) => s.id === sectionId);
    if (index <= 0) return;

    const newSections = [...schema.sections];
    [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];

    // Update order values
    newSections.forEach((s, i) => {
      s.order = i;
    });

    setSchema({ ...schema, sections: newSections });
  };

  const moveSectionDown = (sectionId) => {
    const index = schema.sections.findIndex((s) => s.id === sectionId);
    if (index === -1 || index >= schema.sections.length - 1) return;

    const newSections = [...schema.sections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];

    // Update order values
    newSections.forEach((s, i) => {
      s.order = i;
    });

    setSchema({ ...schema, sections: newSections });
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
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden md:inline">{loading ? 'Resetting...' : 'Reset'}</span>
            </button>

            <button
              onClick={saveSchema}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span className="hidden md:inline">{loading ? 'Saving...' : 'Save'}</span>
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
                  <div key={fieldType.type} className="relative group">
                    <button
                      onClick={() => addField(fieldType)}
                      className="w-full flex items-center space-x-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left"
                    >
                      <fieldType.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {fieldType.label}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredFieldType(hoveredFieldType === fieldType.type ? null : fieldType.type);
                        }}
                        onMouseEnter={() => setHoveredFieldType(fieldType.type)}
                        onMouseLeave={() => setHoveredFieldType(null)}
                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Info className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      </button>
                    </button>

                    {/* Tooltip */}
                    {hoveredFieldType === fieldType.type && (
                      <div className="absolute left-full ml-2 top-0 z-50 w-80 p-4 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-xl border border-gray-700 dark:border-gray-600">
                        <div className="flex items-start space-x-2 mb-2">
                          <fieldType.icon className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                          <h4 className="text-sm font-bold text-white">{fieldType.label}</h4>
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          {fieldType.description}
                        </p>
                        <div className="absolute left-0 top-4 -ml-2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-8 border-r-gray-900 dark:border-r-gray-800"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Center Panel - Form Builder */}
            <div className="md:col-span-6 overflow-y-auto p-4 md:p-6">
              {/* Add Section Button */}
              <button
                onClick={() => openSectionModal()}
                className="w-full mb-4 flex items-center justify-center space-x-2 p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <FolderPlus className="w-5 h-5" />
                <span className="font-medium">Add New Section</span>
              </button>

              <div className="space-y-4">
                {schema.sections.map((section) => {
                  const sectionFields = getFieldsForSection(section.id);
                  return (
                    <div
                      key={section.id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      {/* Section Header */}
                      <div className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="flex-1 flex items-center justify-between"
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

                        {/* Section Actions */}
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSectionUp(section.id);
                            }}
                            disabled={schema.sections.findIndex((s) => s.id === section.id) === 0}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSectionDown(section.id);
                            }}
                            disabled={
                              schema.sections.findIndex((s) => s.id === section.id) ===
                              schema.sections.length - 1
                            }
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openSectionModal(section);
                            }}
                            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20"
                            title="Edit section"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSection(section.id);
                            }}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Delete section"
                          >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>

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
                                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    selectedField?.id === field.id
                                      ? 'border-primary-500 bg-primary-100 dark:border-primary-500 dark:bg-gray-700'
                                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                  }`}
                                >
                                  <GripVertical className={`w-4 h-4 cursor-move ${
                                    selectedField?.id === field.id
                                      ? 'text-primary-600 dark:text-primary-400'
                                      : 'text-gray-400'
                                  }`} />
                                  <FieldIcon className={`w-5 h-5 ${
                                    selectedField?.id === field.id
                                      ? 'text-primary-600 dark:text-primary-400'
                                      : 'text-gray-600 dark:text-gray-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${
                                      selectedField?.id === field.id
                                        ? 'text-primary-900 dark:text-white'
                                        : 'text-gray-900 dark:text-white'
                                    }`}>
                                      {field.label}
                                      {field.required && (
                                        <span className="text-red-500 ml-1">*</span>
                                      )}
                                    </p>
                                    <p className={`text-xs truncate ${
                                      selectedField?.id === field.id
                                        ? 'text-primary-700 dark:text-primary-300'
                                        : 'text-gray-500 dark:text-gray-400'
                                    }`}>
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
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      Field Properties
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs font-medium">
                        {selectedField.type}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ID: {selectedField.id}
                      </span>
                    </div>
                  </div>

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
                      {schema.sections.map((section) => (
                        <option key={section.id} value={section.id} className="dark:bg-gray-800 dark:text-white">
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Options for select/multiselect */}
                  {(selectedField.type === 'select' || selectedField.type === 'multiselect') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Options
                      </label>
                      <div className="space-y-2">
                        {(selectedField.options || []).map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...(selectedField.options || [])];
                                newOptions[index] = e.target.value;
                                updateField(selectedField.id, { options: newOptions });
                              }}
                              placeholder={`Option ${index + 1}`}
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                            />
                            <button
                              onClick={() => {
                                const newOptions = (selectedField.options || []).filter((_, i) => i !== index);
                                updateField(selectedField.id, { options: newOptions });
                              }}
                              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newOptions = [...(selectedField.options || []), ''];
                            updateField(selectedField.id, { options: newOptions });
                          }}
                          className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center justify-center space-x-2"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-medium">Add Option</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Options for smart select/multiselect */}
                  {(selectedField.type === 'smartselect' || selectedField.type === 'smartmultiselect') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Initial Options
                      </label>
                      <div className="space-y-2">
                        {(selectedField.options || []).map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...(selectedField.options || [])];
                                newOptions[index] = e.target.value;
                                updateField(selectedField.id, { options: newOptions });
                              }}
                              placeholder={`Option ${index + 1}`}
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                            />
                            <button
                              onClick={() => {
                                const newOptions = (selectedField.options || []).filter((_, i) => i !== index);
                                updateField(selectedField.id, { options: newOptions });
                              }}
                              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newOptions = [...(selectedField.options || []), ''];
                            updateField(selectedField.id, { options: newOptions });
                          }}
                          className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center justify-center space-x-2"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-medium">Add Option</span>
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Users can also search and create new options when submitting AARs
                      </p>
                    </div>
                  )}

                  {/* Options for dual field types */}
                  {(selectedField.type === 'dualfield' || selectedField.type === 'multidualfield') && (
                    <>
                      {/* Value Options (Smart Dropdown) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Value Options (Searchable)
                        </label>
                        <div className="space-y-2">
                          {(selectedField.options || []).map((option, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...(selectedField.options || [])];
                                  newOptions[index] = e.target.value;
                                  updateField(selectedField.id, { options: newOptions });
                                }}
                                placeholder={`Option ${index + 1}`}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                              />
                              <button
                                onClick={() => {
                                  const newOptions = (selectedField.options || []).filter((_, i) => i !== index);
                                  updateField(selectedField.id, { options: newOptions });
                                }}
                                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newOptions = [...(selectedField.options || []), ''];
                              updateField(selectedField.id, { options: newOptions });
                            }}
                            className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center justify-center space-x-2"
                          >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm font-medium">Add Value Option</span>
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Users can search and create new values (e.g., color names)
                        </p>
                      </div>

                      {/* Unit Label */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Unit Label
                        </label>
                        <input
                          type="text"
                          value={selectedField.unitLabel || 'Unit'}
                          onChange={(e) =>
                            updateField(selectedField.id, { unitLabel: e.target.value })
                          }
                          placeholder="e.g., Unit, Measurement, Size"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Label for the unit dropdown
                        </p>
                      </div>

                      {/* Unit Options (Fixed Dropdown) */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Unit Options (Fixed)
                        </label>
                        <div className="space-y-2">
                          {(selectedField.unitOptions || []).map((option, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...(selectedField.unitOptions || [])];
                                  newOptions[index] = e.target.value;
                                  updateField(selectedField.id, { unitOptions: newOptions });
                                }}
                                placeholder={`Unit ${index + 1}`}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                              />
                              <button
                                onClick={() => {
                                  const newOptions = (selectedField.unitOptions || []).filter((_, i) => i !== index);
                                  updateField(selectedField.id, { unitOptions: newOptions });
                                }}
                                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              const newOptions = [...(selectedField.unitOptions || []), ''];
                              updateField(selectedField.id, { unitOptions: newOptions });
                            }}
                            className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center justify-center space-x-2"
                          >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm font-medium">Add Unit Option</span>
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Fixed unit options (e.g., mL, Quart, oz, grams, kg)
                        </p>
                      </div>
                    </>
                  )}

                  {/* Validation for number */}
                  {selectedField.type === 'number' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Min Value (Optional)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={selectedField.validation?.min ?? ''}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                min: e.target.value ? parseFloat(e.target.value) : undefined,
                              },
                            })
                          }
                          placeholder="No minimum"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Max Value (Optional)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={selectedField.validation?.max ?? ''}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                max: e.target.value ? parseFloat(e.target.value) : undefined,
                              },
                            })
                          }
                          placeholder="No maximum"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                    </>
                  )}

                  {/* Validation for textarea */}
                  {selectedField.type === 'textarea' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Min Length (Optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={selectedField.validation?.minLength ?? ''}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            validation: {
                              ...selectedField.validation,
                              minLength: e.target.value ? parseInt(e.target.value) : undefined,
                            },
                          })
                        }
                        placeholder="No minimum"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Minimum number of characters required
                      </p>
                    </div>
                  )}

                  {/* Validation for date */}
                  {selectedField.type === 'date' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Min Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={selectedField.validation?.minDate ?? ''}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                minDate: e.target.value || undefined,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Earliest allowed date
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Max Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={selectedField.validation?.maxDate ?? ''}
                          onChange={(e) =>
                            updateField(selectedField.id, {
                              validation: {
                                ...selectedField.validation,
                                maxDate: e.target.value || undefined,
                              },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Latest allowed date
                        </p>
                      </div>
                    </>
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
                          Accepted File Types
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
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Examples: image/*, .pdf, .doc,.docx, video/*
                        </p>
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
                {schema.sections.map((section) => {
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
                              field.type === 'textarea' ||
                              field.type === 'file' ||
                              field.type === 'dualfield' ||
                              field.type === 'multidualfield'
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
                                <option value="" className="dark:bg-gray-700 dark:text-white">{field.placeholder}</option>
                                {field.options?.map((option) => (
                                  <option key={option} value={option} className="dark:bg-gray-700 dark:text-white">
                                    {option}
                                  </option>
                                ))}
                              </select>
                            )}

                            {(field.type === 'smartselect' || field.type === 'smartmultiselect') && (
                              <div className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex items-center justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{field.placeholder || 'Search or create...'}</span>
                                <div className="flex items-center space-x-1">
                                  <Sparkles className="w-4 h-4 text-primary-500" />
                                  <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">Smart</span>
                                </div>
                              </div>
                            )}

                            {field.type === 'date' && (
                              <input
                                type="date"
                                disabled
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            )}

                            {(field.type === 'dualfield' || field.type === 'multidualfield') && (
                              <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                  <div className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-between">
                                    <span>{field.placeholder || 'Search or create...'}</span>
                                    <Sparkles className="w-4 h-4 text-primary-500" />
                                  </div>
                                  <select
                                    disabled
                                    className="w-32 px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                  >
                                    <option className="dark:bg-gray-700 dark:text-white">
                                      {field.unitLabel || 'Unit'}
                                    </option>
                                  </select>
                                </div>
                                {field.type === 'multidualfield' && (
                                  <button
                                    disabled
                                    className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 flex items-center justify-center space-x-2"
                                  >
                                    <Plus className="w-4 h-4" />
                                    <span className="text-sm font-medium">Add Another</span>
                                  </button>
                                )}
                              </div>
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

      {/* Section Modal */}
      {showSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingSection ? 'Edit Section' : 'Create New Section'}
              </h3>
              <button
                onClick={closeSectionModal}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Section Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                  placeholder="e.g., Basic Information"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>

              {!editingSection && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Section ID (optional)
                  </label>
                  <input
                    type="text"
                    value={sectionForm.id}
                    onChange={(e) => setSectionForm({ ...sectionForm, id: e.target.value })}
                    placeholder="Auto-generated if left empty"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Used internally to identify this section. Leave empty to auto-generate.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeSectionModal}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSection}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
              >
                {editingSection ? 'Save Changes' : 'Create Section'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customize;
