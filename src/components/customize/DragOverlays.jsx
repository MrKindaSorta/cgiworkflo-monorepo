import { GripVertical } from 'lucide-react';

/**
 * FieldDragOverlay - Floating preview when dragging a field
 */
export const FieldDragOverlay = ({ field, fieldIcon: FieldIcon }) => {
  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg border border-primary-500 bg-white dark:bg-gray-800 shadow-2xl opacity-90 min-w-[200px] max-w-[300px]">
      <GripVertical className="w-4 h-4 text-primary-600 dark:text-primary-400" />
      <FieldIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{field.type}</p>
      </div>
    </div>
  );
};

/**
 * SectionDragOverlay - Floating preview when dragging a section
 */
export const SectionDragOverlay = ({ section, fieldCount }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-primary-500 shadow-2xl p-4 opacity-90 min-w-[250px] max-w-[400px]">
      <div className="flex items-center space-x-3">
        <GripVertical className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {section.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {fieldCount} field{fieldCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
};
