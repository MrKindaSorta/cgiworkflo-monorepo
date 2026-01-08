import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
  Zap,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

const SortableFieldItem = ({
  field,
  fieldIcon: FieldIcon,
  isSelected,
  onSelect,
  onDelete,
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
    id: field.id,
    data: {
      type: 'field',
      field,
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
      onClick={onSelect}
      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? 'border-primary-500 bg-primary-100 dark:border-primary-500 dark:bg-gray-700'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      } ${isDragging ? 'shadow-xl' : ''}`}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="p-2 -m-2 cursor-grab active:cursor-grabbing touch-manipulation"
      >
        <GripVertical
          className={`w-4 h-4 ${
            isSelected
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-400'
          }`}
        />
      </div>

      {/* Field Icon */}
      <FieldIcon
        className={`w-5 h-5 ${
          isSelected
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-gray-600 dark:text-gray-400'
        }`}
      />

      {/* Field Info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            isSelected
              ? 'text-primary-900 dark:text-white'
              : 'text-gray-900 dark:text-white'
          }`}
        >
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </p>
        <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
          <p
            className={`text-xs truncate ${
              isSelected
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {field.type}
          </p>

          {/* Conditional Badge */}
          {field.conditional?.enabled && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              <Zap className="w-3 h-3" />
            </span>
          )}

          {/* Depended On By Badge */}
          {(() => {
            const dependents = getFieldDependents(field.id);
            if (dependents.length > 0) {
              const moreCount = dependents.length > 2 ? ` +${dependents.length - 2}` : '';
              return (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  title={`Depended on by: ${dependents.map((f) => f.label).join(', ')}`}
                >
                  <ArrowRight className="w-3 h-3 mr-0.5" />
                  {dependents.length}{moreCount}
                </span>
              );
            }
            return null;
          })()}

          {/* Circular Dependency Warning Badge */}
          {isFieldCircular(field.id) && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              title={getCircularPath(field.id)}
            >
              <AlertTriangle className="w-3 h-3 mr-0.5" />
              Circular
            </span>
          )}
        </div>
      </div>

      {/* Delete Button */}
      <div className="flex items-center space-x-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(field.id);
          }}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
        </button>
      </div>
    </div>
  );
};

export default SortableFieldItem;
