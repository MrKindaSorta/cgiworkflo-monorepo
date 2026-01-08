import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Plus,
  Info,
} from 'lucide-react';
import SortableFieldItem from './SortableFieldItem';
import HelpTooltip from '../ui/HelpTooltip';

const SortableSectionItem = ({
  section,
  fields,
  isExpanded,
  onToggle,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  isFirstSection,
  isLastSection,
  selectedField,
  onSelectField,
  onDeleteField,
  getFieldIcon,
  getFieldDependents,
  isFieldCircular,
  getCircularPath,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    data: {
      type: 'section',
      section,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${
        isDragging ? 'shadow-xl' : ''
      }`}
    >
      {/* Section Header */}
      <div className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        {/* Drag Handle for Section */}
        <div
          {...attributes}
          {...listeners}
          className="mr-2 p-2 -m-2 cursor-grab active:cursor-grabbing touch-manipulation"
        >
          <ChevronUp className="w-4 h-4 text-gray-400" />
        </div>

        <button
          onClick={onToggle}
          className="flex-1 flex items-center justify-between"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {section.name}
          </h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {fields.length} fields
            </span>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>

        {/* Section Actions */}
        <div className="flex items-center space-x-1 ml-2">
          <HelpTooltip translationKey="customize.tooltips.sections.moveUp" side="top">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              disabled={isFirstSection}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </HelpTooltip>
          <HelpTooltip translationKey="customize.tooltips.sections.moveDown" side="top">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              disabled={isLastSection}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </HelpTooltip>
          <HelpTooltip translationKey="customize.tooltips.sections.edit" side="top">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20"
            >
              <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>
          </HelpTooltip>
          <HelpTooltip translationKey="customize.tooltips.sections.delete" side="top">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </HelpTooltip>
        </div>
      </div>

      {/* Section Fields */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-2">
          {fields.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                <Plus className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                No fields in this section yet
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Click fields from the Field Library on the left to add them to this section
              </p>
              <div className="flex items-center justify-center space-x-2 text-xs text-primary-600 dark:text-primary-400">
                <Info className="w-4 h-4" />
                <span>Tip: Start with basic fields like Text or Dropdown</span>
              </div>
            </div>
          ) : (
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {fields.map((field) => (
                <SortableFieldItem
                  key={field.id}
                  field={field}
                  fieldIcon={getFieldIcon(field.type)}
                  isSelected={selectedField?.id === field.id}
                  onSelect={() => onSelectField(field)}
                  onDelete={onDeleteField}
                  getFieldDependents={getFieldDependents}
                  isFieldCircular={isFieldCircular}
                  getCircularPath={getCircularPath}
                />
              ))}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
};

export default SortableSectionItem;
