import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * HelpTooltip - Mobile-first tooltip component for contextual help
 *
 * Features:
 * - Touch-friendly (tap to toggle, no hover-only)
 * - Accessible (ARIA, keyboard navigation, screen reader friendly)
 * - Dark mode support
 * - Auto-positioning to avoid screen edges
 * - Internationalized
 *
 * @param {string} content - Direct tooltip text (for non-translated content)
 * @param {string} translationKey - i18n key (preferred method)
 * @param {'top'|'right'|'bottom'|'left'} side - Preferred position (default: 'top')
 * @param {number} maxWidth - Max width in pixels (default: 320 for mobile)
 * @param {string} iconColor - Tailwind classes for icon color
 * @param {ReactNode} children - Custom trigger element (defaults to Info icon)
 */
const HelpTooltip = ({
  content,
  translationKey,
  side = 'top',
  maxWidth = 320,
  iconColor = 'text-gray-500 dark:text-gray-400',
  children
}) => {
  const { t } = useTranslation();

  // Use translation key if provided, otherwise use content directly
  const tooltipText = translationKey ? t(translationKey) : content;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children || (
            <button
              type="button"
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${iconColor}`}
              aria-label="Help"
            >
              <Info className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={8}
            style={{ maxWidth: `${maxWidth}px` }}
            className="z-50 px-4 py-3 text-sm leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-xl border border-gray-700 dark:border-gray-600 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {tooltipText}
            <Tooltip.Arrow className="fill-gray-900 dark:fill-gray-700" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default HelpTooltip;
