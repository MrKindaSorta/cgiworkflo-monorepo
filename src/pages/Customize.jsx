import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api-client';
import { detectCircularDependencies } from '../utils/conditionalFields';
import { normalizeConditionValue } from '../utils/ConditionValueHelpers';
import { arrayMove } from '../utils/arrayMove';
import HelpTooltip from '../components/ui/HelpTooltip';
import SmartConditionValueInput from '../components/form/SmartConditionValueInput';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableSectionItem from '../components/customize/SortableSectionItem';
import { FieldDragOverlay, SectionDragOverlay } from '../components/customize/DragOverlays';
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
  Columns3,
  Grid3x3,
  Zap,
  ArrowRight,
  AlertTriangle,
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
  {
    type: 'triplefield',
    icon: Columns3,
    label: 'Custom Triple Field',
    group: 'Advanced',
    description: 'Combines value + unit + amount in one field. Example: "Red" (color) + "mL" (unit) + "250" (amount) = 250 mL of Red paint. Perfect for tracking materials with precise quantities.',
  },
  {
    type: 'multitriplefield',
    icon: Grid3x3,
    label: 'Multi Custom Triple Field',
    group: 'Advanced',
    description: 'Multiple rows of triple fields with + button. Each row tracks value + unit + amount. Example: Track multiple paint colors, each with unit and precise quantity. Perfect for complex material tracking.',
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
  formId: null, // Will be assigned when saved to database
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
  const [activeId, setActiveId] = useState(null);
  const [activeType, setActiveType] = useState(null); // 'field' or 'section'
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [pendingFieldType, setPendingFieldType] = useState(null);

  // Configure drag sensors (mouse, touch, keyboard)
  const sensors = useSensors(
    // Mouse sensor for desktop
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10, // 10px movement required to start drag
      },
    }),
    // Touch sensor for mobile (critical for 50%+ mobile usage)
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Hold for 250ms before drag starts
        tolerance: 5, // Allow 5px movement during delay
      },
    }),
    // Keyboard sensor for accessibility
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    // Validate for invalid conditions (empty fieldId or operator)
    const fieldsWithInvalidConditions = schema.fields.filter((field) => {
      if (!field.conditional || !field.conditional.enabled) {
        return false;
      }
      const { conditions = [] } = field.conditional;
      return conditions.some(
        (condition) => !condition || !condition.fieldId || !condition.operator
      );
    });

    if (fieldsWithInvalidConditions.length > 0) {
      const fieldNames = fieldsWithInvalidConditions
        .map((field) => field.label || field.id)
        .join(', ');

      alert(
        `Invalid conditions detected!\n\nThe following fields have incomplete conditional logic:\n${fieldNames}\n\nPlease complete or remove the conditional logic before saving.`
      );
      return;
    }

    // Validate for circular dependencies
    const circularFields = detectCircularDependencies(schema.fields);

    if (circularFields.length > 0) {
      const fieldNames = circularFields
        .map((id) => schema.fields.find((f) => f.id === id)?.label || id)
        .join(', ');

      alert(
        `Circular dependency detected!\n\nThe following fields have circular conditional dependencies:\n${fieldNames}\n\nPlease remove the circular conditions before saving.`
      );
      return;
    }

    try {
      setLoading(true);
      const response = await api.customForms.updateActive(
        schema,
        'AAR Submission Form',
        'Customized AAR submission form'
      );

      // Capture the returned formId and update the schema
      if (response.data.success && response.data.formId) {
        const updatedSchema = {
          ...schema,
          formId: response.data.formId,
        };
        setSchema(updatedSchema);

        // Keep localStorage in sync as backup
        localStorage.setItem('aar-form-schema', JSON.stringify(updatedSchema));
      } else {
        // Keep localStorage in sync as backup (without formId)
        localStorage.setItem('aar-form-schema', JSON.stringify(schema));
      }

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

  // Open add field modal
  const openAddFieldModal = (fieldType) => {
    setPendingFieldType(fieldType);
    setShowAddFieldModal(true);
  };

  // Close add field modal
  const closeAddFieldModal = () => {
    setPendingFieldType(null);
    setShowAddFieldModal(false);
  };

  // Add new field to selected section
  const addFieldToSection = (sectionId) => {
    if (!pendingFieldType) return;

    const newField = {
      id: `field_${Date.now()}`,
      type: pendingFieldType.type,
      label: `New ${pendingFieldType.label}`,
      placeholder: `Enter ${pendingFieldType.label.toLowerCase()}`,
      required: false,
      order: schema.fields.filter((f) => f.section === sectionId).length,
      section: sectionId,
      ...(pendingFieldType.type === 'select' || pendingFieldType.type === 'multiselect'
        ? { options: ['Option 1', 'Option 2', 'Option 3'] }
        : {}),
      ...(pendingFieldType.type === 'smartselect' || pendingFieldType.type === 'smartmultiselect'
        ? { options: [], allowCreate: true }
        : {}),
      ...(pendingFieldType.type === 'dualfield' || pendingFieldType.type === 'multidualfield'
        ? { options: [], unitOptions: ['Unit 1', 'Unit 2'], unitLabel: 'Unit', allowCreate: true }
        : {}),
      ...(pendingFieldType.type === 'triplefield' || pendingFieldType.type === 'multitriplefield'
        ? { options: [], unitOptions: ['Unit 1', 'Unit 2'], unitLabel: 'Unit', amountLabel: 'Amount', allowCreate: true }
        : {}),
      ...(pendingFieldType.type === 'file' ? { multiple: false, accept: 'image/*' } : {}),
      ...(pendingFieldType.type === 'number' ? { validation: { min: 0 } } : {}),
      ...(pendingFieldType.type === 'textarea' ? { validation: { minLength: 10 } } : {}),
    };

    setSchema({
      ...schema,
      fields: [...schema.fields, newField],
    });
    setSelectedField(newField);
    closeAddFieldModal();
  };

  // Delete field
  const deleteField = (fieldId) => {
    // Remove the field AND clean up any conditions referencing it
    const updatedFields = schema.fields
      .filter((f) => f.id !== fieldId) // Remove the field
      .map((f) => {
        // Clean up conditions in other fields that reference the deleted field
        if (f.conditional?.enabled) {
          const cleanedConditions = f.conditional.conditions.filter(
            (c) => c.fieldId !== fieldId
          );

          return {
            ...f,
            conditional: {
              ...f.conditional,
              conditions: cleanedConditions,
              enabled: cleanedConditions.length > 0,
            },
          };
        }
        return f;
      });

    setSchema({
      ...schema,
      fields: updatedFields,
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

  // Conditional logic management functions
  const addCondition = (fieldId) => {
    const field = schema.fields.find((f) => f.id === fieldId);
    if (!field) return;

    const newConditions = [
      ...(field.conditional?.conditions || []),
      { fieldId: '', operator: 'equals', value: '' },
    ];

    updateField(fieldId, {
      conditional: {
        ...field.conditional,
        enabled: true,
        operator: field.conditional?.operator || 'AND',
        conditions: newConditions,
      },
    });
  };

  const updateCondition = (fieldId, conditionIndex, updates) => {
    const field = schema.fields.find((f) => f.id === fieldId);
    if (!field) return;

    const newConditions = [...(field.conditional?.conditions || [])];
    const updatedCondition = {
      ...newConditions[conditionIndex],
      ...updates,
    };

    // Normalize value based on operator and referenced field type
    if (updates.value !== undefined) {
      const referencedField = schema.fields.find((f) => f.id === updatedCondition.fieldId);
      if (referencedField) {
        updatedCondition.value = normalizeConditionValue(
          updatedCondition.operator,
          updates.value,
          referencedField.type
        );
      }
    }

    newConditions[conditionIndex] = updatedCondition;

    updateField(fieldId, {
      conditional: {
        ...field.conditional,
        conditions: newConditions,
      },
    });
  };

  const removeCondition = (fieldId, conditionIndex) => {
    const field = schema.fields.find((f) => f.id === fieldId);
    if (!field) return;

    const newConditions = (field.conditional?.conditions || []).filter(
      (_, i) => i !== conditionIndex
    );

    updateField(fieldId, {
      conditional: {
        ...field.conditional,
        conditions: newConditions,
        enabled: newConditions.length > 0,
      },
    });
  };

  // Dependency visualization helpers
  const getFieldDependents = (fieldId) => {
    return schema.fields.filter(
      (f) =>
        f.conditional?.enabled &&
        f.conditional.conditions.some((c) => c.fieldId === fieldId)
    );
  };

  const isFieldCircular = (fieldId) => {
    const circularFields = detectCircularDependencies(schema.fields);
    return circularFields.includes(fieldId);
  };

  const getCircularPath = (fieldId) => {
    // Build dependency graph
    const dependencies = new Map();
    schema.fields.forEach((field) => {
      if (field.conditional?.enabled) {
        const deps = field.conditional.conditions
          .filter((c) => c.fieldId)
          .map((c) => c.fieldId);
        dependencies.set(field.id, deps);
      }
    });

    // Find the cycle using DFS
    const visited = new Set();
    const stack = new Set();
    const path = [];

    function findCycle(currentId) {
      if (stack.has(currentId)) {
        // Found cycle - build path string
        const cycleStart = path.indexOf(currentId);
        const cyclePath = path.slice(cycleStart);
        cyclePath.push(currentId); // Complete the cycle
        return cyclePath
          .map((id) => schema.fields.find((f) => f.id === id)?.label || id)
          .join(' → ');
      }

      if (visited.has(currentId)) return null;

      visited.add(currentId);
      stack.add(currentId);
      path.push(currentId);

      const deps = dependencies.get(currentId) || [];
      for (const depId of deps) {
        const result = findCycle(depId);
        if (result) return result;
      }

      stack.delete(currentId);
      path.pop();
      return null;
    }

    return findCycle(fieldId) || 'Circular dependency detected';
  };

  // Drag and drop handlers
  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    setActiveType(active.data.current?.type || 'field');
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // Handle field dragging
    if (activeType === 'field') {
      const activeField = schema.fields.find((f) => f.id === active.id);
      const overField = schema.fields.find((f) => f.id === over.id);

      if (!activeField || !overField) {
        setActiveId(null);
        setActiveType(null);
        return;
      }

      // Check if dragging within same section or between sections
      if (activeField.section === overField.section) {
        // Reorder within section
        const sectionFields = schema.fields
          .filter((f) => f.section === activeField.section)
          .sort((a, b) => a.order - b.order);

        const oldIndex = sectionFields.findIndex((f) => f.id === active.id);
        const newIndex = sectionFields.findIndex((f) => f.id === over.id);

        const reorderedFields = arrayMove(sectionFields, oldIndex, newIndex);

        // Update order values
        const updatedFields = schema.fields.map((f) => {
          if (f.section === activeField.section) {
            const newOrder = reorderedFields.findIndex((rf) => rf.id === f.id);
            return { ...f, order: newOrder };
          }
          return f;
        });

        setSchema({ ...schema, fields: updatedFields });
      } else {
        // Move to different section
        const targetSectionFields = schema.fields
          .filter((f) => f.section === overField.section)
          .sort((a, b) => a.order - b.order);

        const overIndex = targetSectionFields.findIndex((f) => f.id === over.id);

        // Update field's section and recalculate orders
        const updatedFields = schema.fields.map((f) => {
          if (f.id === active.id) {
            return { ...f, section: overField.section, order: overIndex };
          }
          if (f.section === overField.section && f.order >= overIndex) {
            return { ...f, order: f.order + 1 };
          }
          return f;
        });

        // Recalculate orders for source section
        const sourceSectionFields = updatedFields
          .filter((f) => f.section === activeField.section)
          .sort((a, b) => a.order - b.order);

        const finalFields = updatedFields.map((f) => {
          if (f.section === activeField.section) {
            const newOrder = sourceSectionFields.findIndex((sf) => sf.id === f.id);
            return { ...f, order: newOrder };
          }
          return f;
        });

        setSchema({ ...schema, fields: finalFields });
      }
    }

    // Handle section dragging
    if (activeType === 'section') {
      const oldIndex = schema.sections.findIndex((s) => s.id === active.id);
      const newIndex = schema.sections.findIndex((s) => s.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedSections = arrayMove(schema.sections, oldIndex, newIndex);

        // Update order values
        reorderedSections.forEach((s, i) => {
          s.order = i;
        });

        setSchema({ ...schema, sections: reorderedSections });
      }
    }

    setActiveId(null);
    setActiveType(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveType(null);
  };

  // Get active item for drag overlay
  const getActiveItem = () => {
    if (!activeId) return null;

    if (activeType === 'field') {
      return schema.fields.find((f) => f.id === activeId);
    }

    if (activeType === 'section') {
      return schema.sections.find((s) => s.id === activeId);
    }

    return null;
  };

  const activeItem = getActiveItem();

  // Helper to get field icon
  const getFieldIcon = (fieldType) => {
    return FIELD_TYPES.find((ft) => ft.type === fieldType)?.icon || Type;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
              <HelpTooltip translationKey="customize.tooltips.actions.builder" side="bottom">
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
              </HelpTooltip>
              <HelpTooltip translationKey="customize.tooltips.actions.preview" side="bottom">
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
              </HelpTooltip>
              <HelpTooltip translationKey="customize.tooltips.actions.json" side="bottom">
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
              </HelpTooltip>
            </div>

            <HelpTooltip translationKey="customize.tooltips.actions.reset" side="bottom">
              <button
                onClick={resetSchema}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden md:inline">{loading ? 'Resetting...' : 'Reset'}</span>
              </button>
            </HelpTooltip>

            <HelpTooltip translationKey="customize.tooltips.actions.save" side="bottom">
              <button
                onClick={saveSchema}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span className="hidden md:inline">{loading ? 'Saving...' : 'Save'}</span>
              </button>
            </HelpTooltip>
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
                  <div key={fieldType.type} className="relative">
                    <button
                      onClick={() => openAddFieldModal(fieldType)}
                      className="w-full flex items-center space-x-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left group"
                    >
                      <fieldType.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {fieldType.label}
                        </p>
                      </div>
                      <HelpTooltip
                        translationKey={`customize.tooltips.fieldTypes.${fieldType.type}`}
                        side="right"
                        iconColor="text-gray-400 dark:text-gray-500 group-hover:text-primary-500"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Center Panel - Form Builder */}
            <div className="md:col-span-6 overflow-y-auto p-4 md:p-6">
              {/* Add Section Button */}
              <div className="relative group mb-4">
                <button
                  onClick={() => openSectionModal()}
                  className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  <FolderPlus className="w-5 h-5" />
                  <span className="font-medium">Add New Section</span>
                  <HelpTooltip
                    translationKey="customize.tooltips.sections.add"
                    side="bottom"
                  />
                </button>
              </div>

              <div className="space-y-4">
                <SortableContext
                  items={schema.sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {schema.sections.map((section, index) => {
                    const sectionFields = getFieldsForSection(section.id);
                    return (
                      <SortableSectionItem
                        key={section.id}
                        section={section}
                        fields={sectionFields}
                        isExpanded={expandedSections[section.id]}
                        onToggle={() => toggleSection(section.id)}
                        onMoveUp={() => moveSectionUp(section.id)}
                        onMoveDown={() => moveSectionDown(section.id)}
                        onEdit={() => openSectionModal(section)}
                        onDelete={() => deleteSection(section.id)}
                        isFirstSection={index === 0}
                        isLastSection={index === schema.sections.length - 1}
                        selectedField={selectedField}
                        onSelectField={setSelectedField}
                        onDeleteField={deleteField}
                        getFieldIcon={getFieldIcon}
                        getFieldDependents={getFieldDependents}
                        isFieldCircular={isFieldCircular}
                        getCircularPath={getCircularPath}
                      />
                    );
                  })}
                </SortableContext>
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
                    <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <span>Label</span>
                      <HelpTooltip
                        translationKey="customize.tooltips.properties.label"
                        side="left"
                      />
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
                    <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <span>Placeholder</span>
                      <HelpTooltip
                        translationKey="customize.tooltips.properties.placeholder"
                        side="left"
                      />
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
                  <div className="flex items-center justify-between">
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
                    <HelpTooltip
                      translationKey="customize.tooltips.properties.required"
                      side="left"
                    />
                  </div>

                  {/* Section */}
                  <div>
                    <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <span>Section</span>
                      <HelpTooltip
                        translationKey="customize.tooltips.properties.section"
                        side="left"
                      />
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
                      <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <span>Options</span>
                        <HelpTooltip
                          translationKey="customize.tooltips.properties.options"
                          side="left"
                        />
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
                      <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <span>Initial Options</span>
                        <HelpTooltip
                          translationKey="customize.tooltips.properties.initialOptions"
                          side="left"
                        />
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
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Value Options (Searchable)</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.valueOptions"
                            side="left"
                          />
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
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Unit Label</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.unitLabel"
                            side="left"
                          />
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
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Unit Options (Fixed)</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.unitOptions"
                            side="left"
                          />
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

                  {/* Options for triple field types */}
                  {(selectedField.type === 'triplefield' || selectedField.type === 'multitriplefield') && (
                    <>
                      {/* Value Options (Smart Dropdown) */}
                      <div>
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Value Options (Searchable)</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.valueOptions"
                            side="left"
                          />
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
                          Users can search and create new values (e.g., paint colors)
                        </p>
                      </div>

                      {/* Unit Label */}
                      <div>
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Unit Label</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.unitLabel"
                            side="left"
                          />
                        </label>
                        <input
                          type="text"
                          value={selectedField.unitLabel || 'Unit'}
                          onChange={(e) =>
                            updateField(selectedField.id, { unitLabel: e.target.value })
                          }
                          placeholder="e.g., Unit, Measurement, Container"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Label for the unit dropdown
                        </p>
                      </div>

                      {/* Unit Options (Fixed Dropdown) */}
                      <div>
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Unit Options (Fixed)</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.unitOptions"
                            side="left"
                          />
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

                      {/* Amount Label */}
                      <div>
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Amount Label</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.amountLabel"
                            side="left"
                          />
                        </label>
                        <input
                          type="text"
                          value={selectedField.amountLabel || 'Amount'}
                          onChange={(e) =>
                            updateField(selectedField.id, { amountLabel: e.target.value })
                          }
                          placeholder="e.g., Amount, Quantity, Volume"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Label for the amount/quantity field
                        </p>
                      </div>
                    </>
                  )}

                  {/* Validation for number */}
                  {selectedField.type === 'number' && (
                    <>
                      <div>
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Min Value (Optional)</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.minValue"
                            side="left"
                          />
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
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Max Value (Optional)</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.maxValue"
                            side="left"
                          />
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
                      <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <span>Min Length (Optional)</span>
                        <HelpTooltip
                          translationKey="customize.tooltips.properties.minLength"
                          side="left"
                        />
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
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Min Date (Optional)</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.minDate"
                            side="left"
                          />
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
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Max Date (Optional)</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.maxDate"
                            side="left"
                          />
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
                      <div className="flex items-center justify-between">
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
                        <HelpTooltip
                          translationKey="customize.tooltips.properties.multiple"
                          side="left"
                        />
                      </div>
                      <div>
                        <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Accepted File Types</span>
                          <HelpTooltip
                            translationKey="customize.tooltips.properties.accept"
                            side="left"
                          />
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

                  {/* Conditional Logic */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Zap className="w-4 h-4 text-purple-500" />
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                          Conditional Logic
                        </h4>
                        <HelpTooltip
                          translationKey="customize.tooltips.conditional.toggle"
                          side="left"
                          iconColor="text-purple-400 dark:text-purple-500"
                        />
                      </div>
                      <input
                        type="checkbox"
                        id="conditional-enabled"
                        checked={selectedField.conditional?.enabled || false}
                        onChange={(e) =>
                          updateField(selectedField.id, {
                            conditional: {
                              enabled: e.target.checked,
                              operator: 'AND',
                              conditions: e.target.checked
                                ? [{ fieldId: '', operator: 'equals', value: '' }]
                                : [],
                            },
                          })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </div>

                    {selectedField.conditional?.enabled && (
                      <div className="space-y-3">
                        {/* Combine Operator */}
                        <div>
                          <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <span>Show field when:</span>
                            <HelpTooltip
                              translationKey="customize.tooltips.conditional.operator"
                              side="left"
                              maxWidth={400}
                            />
                          </label>
                          <select
                            value={selectedField.conditional?.operator || 'AND'}
                            onChange={(e) =>
                              updateField(selectedField.id, {
                                conditional: {
                                  ...selectedField.conditional,
                                  operator: e.target.value,
                                },
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                          >
                            <option value="AND" className="dark:bg-gray-800 dark:text-white">
                              ALL conditions match (AND)
                            </option>
                            <option value="OR" className="dark:bg-gray-800 dark:text-white">
                              ANY condition matches (OR)
                            </option>
                          </select>
                        </div>

                        {/* Conditions List */}
                        <div className="space-y-2">
                          {(selectedField.conditional?.conditions || []).map((condition, index) => (
                            <div
                              key={index}
                              className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg space-y-2 border border-gray-200 dark:border-gray-700"
                            >
                              {/* Field Selection */}
                              <div>
                                <label className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  <span>If this field:</span>
                                  <HelpTooltip
                                    translationKey="customize.tooltips.conditional.fieldSelect"
                                    side="left"
                                  />
                                </label>
                                <select
                                  value={condition.fieldId}
                                  onChange={(e) =>
                                    updateCondition(selectedField.id, index, {
                                      fieldId: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                                >
                                  <option value="" className="dark:bg-gray-700 dark:text-white">
                                    Select field...
                                  </option>
                                  {schema.fields
                                    .filter((f) => f.id !== selectedField.id)
                                    .map((f) => (
                                      <option
                                        key={f.id}
                                        value={f.id}
                                        className="dark:bg-gray-700 dark:text-white"
                                      >
                                        {f.label}
                                      </option>
                                    ))}
                                </select>
                              </div>

                              {/* Operator and Value */}
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Comparison:
                                  </label>
                                  <HelpTooltip
                                    translationKey="customize.tooltips.conditional.comparison"
                                    side="left"
                                    maxWidth={400}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <select
                                    value={condition.operator}
                                    onChange={(e) =>
                                      updateCondition(selectedField.id, index, {
                                        operator: e.target.value,
                                      })
                                    }
                                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
                                  >
                                    <optgroup label="Equality" className="dark:bg-gray-700 dark:text-white">
                                      <option value="equals" className="dark:bg-gray-700 dark:text-white">
                                        Equals
                                      </option>
                                      <option value="notEquals" className="dark:bg-gray-700 dark:text-white">
                                        Not Equals
                                      </option>
                                    </optgroup>

                                    <optgroup label="Comparison" className="dark:bg-gray-700 dark:text-white">
                                      <option value="greaterThan" className="dark:bg-gray-700 dark:text-white">
                                        Greater Than
                                      </option>
                                      <option value="lessThan" className="dark:bg-gray-700 dark:text-white">
                                        Less Than
                                      </option>
                                    </optgroup>

                                    <optgroup label="Text" className="dark:bg-gray-700 dark:text-white">
                                      <option value="contains" className="dark:bg-gray-700 dark:text-white">
                                        Contains
                                      </option>
                                      <option value="startsWith" className="dark:bg-gray-700 dark:text-white">
                                        Starts With
                                      </option>
                                      <option value="endsWith" className="dark:bg-gray-700 dark:text-white">
                                        Ends With
                                      </option>
                                    </optgroup>

                                    <optgroup label="Arrays" className="dark:bg-gray-700 dark:text-white">
                                      <option value="oneOf" className="dark:bg-gray-700 dark:text-white">
                                        One Of
                                      </option>
                                      <option value="includes" className="dark:bg-gray-700 dark:text-white">
                                        Includes
                                      </option>
                                      <option value="includesAny" className="dark:bg-gray-700 dark:text-white">
                                        Includes Any
                                      </option>
                                      <option value="includesAll" className="dark:bg-gray-700 dark:text-white">
                                        Includes All
                                      </option>
                                    </optgroup>

                                    <optgroup label="Existence" className="dark:bg-gray-700 dark:text-white">
                                      <option value="isEmpty" className="dark:bg-gray-700 dark:text-white">
                                        Is Empty
                                      </option>
                                      <option value="isNotEmpty" className="dark:bg-gray-700 dark:text-white">
                                        Is Not Empty
                                      </option>
                                    </optgroup>
                                  </select>

                                  {/* Value Input - Smart Adaptive */}
                                  {condition.operator !== 'isEmpty' &&
                                    condition.operator !== 'isNotEmpty' && (
                                      <SmartConditionValueInput
                                        referencedField={schema.fields.find((f) => f.id === condition.fieldId)}
                                        operator={condition.operator}
                                        value={condition.value}
                                        onChange={(newValue) =>
                                          updateCondition(selectedField.id, index, {
                                            value: newValue,
                                          })
                                        }
                                      />
                                    )}
                                </div>
                              </div>

                              {/* Remove Condition */}
                              <button
                                onClick={() => removeCondition(selectedField.id, index)}
                                className="w-full py-1.5 px-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center space-x-2 text-xs"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove Condition</span>
                              </button>
                            </div>
                          ))}

                          {/* Circular Dependency Warning */}
                          {isFieldCircular(selectedField.id) && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-start space-x-2">
                              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 text-xs">
                                <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                                  ⚠️ Circular Dependency Detected
                                </p>
                                <p className="text-amber-700 dark:text-amber-300 mb-2">
                                  {getCircularPath(selectedField.id)}
                                </p>
                                <p className="text-amber-600 dark:text-amber-400">
                                  Remove one of the conditions in this chain to fix.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Add Condition Button */}
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <HelpTooltip
                                translationKey="customize.tooltips.conditional.addCondition"
                                side="left"
                                maxWidth={400}
                              />
                            </div>
                            <button
                              onClick={() => addCondition(selectedField.id)}
                              className="w-full py-2 px-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center justify-center space-x-2"
                            >
                              <Plus className="w-4 h-4" />
                              <span className="text-sm font-medium">Add Condition</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                          ⚡ This field will only show when conditions are met
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 mb-4">
                    <Settings className="w-10 h-10 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                    Field Properties
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Click any field in the center panel to edit its properties here
                  </p>
                  <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs">
                    <Info className="w-4 h-4" />
                    <span>Properties include label, placeholder, validation, and conditional logic</span>
                  </div>
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
                              field.type === 'multidualfield' ||
                              field.type === 'triplefield' ||
                              field.type === 'multitriplefield'
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

                            {(field.type === 'triplefield' || field.type === 'multitriplefield') && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-12 gap-2">
                                  <div className="col-span-5 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-between">
                                    <span>{field.placeholder || 'Search or create...'}</span>
                                    <Sparkles className="w-4 h-4 text-primary-500" />
                                  </div>
                                  <select
                                    disabled
                                    className="col-span-3 px-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                  >
                                    <option className="dark:bg-gray-700 dark:text-white">
                                      {field.unitLabel || 'Unit'}
                                    </option>
                                  </select>
                                  <input
                                    type="number"
                                    disabled
                                    placeholder={field.amountLabel || 'Amount'}
                                    className="col-span-4 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  />
                                </div>
                                {field.type === 'multitriplefield' && (
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

      {/* Add Field Modal - Section Selection */}
      {showAddFieldModal && pendingFieldType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <pendingFieldType.icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Add {pendingFieldType.label}
                </h3>
              </div>
              <button
                onClick={closeAddFieldModal}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Select which section to add this field to:
              </label>
              <div className="space-y-2">
                {schema.sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => addFieldToSection(section.id)}
                    className="w-full flex items-center justify-between p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left group"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300">
                        {section.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {getFieldsForSection(section.id).length} existing fields
                      </p>
                    </div>
                    <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transform -rotate-90" />
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeAddFieldModal}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Drag Overlay */}
      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeId && activeType === 'field' && activeItem && (
          <FieldDragOverlay
            field={activeItem}
            fieldIcon={getFieldIcon(activeItem.type)}
          />
        )}
        {activeId && activeType === 'section' && activeItem && (
          <SectionDragOverlay
            section={activeItem}
            fieldCount={getFieldsForSection(activeItem.id).length}
          />
        )}
      </DragOverlay>
    </div>
    </DndContext>
  );
};

export default Customize;
