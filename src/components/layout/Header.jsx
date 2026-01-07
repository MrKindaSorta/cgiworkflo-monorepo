import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Menu, Sun, Moon } from 'lucide-react';

const Header = ({ onMenuToggle }) => {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16">
      <div className="flex items-center justify-between h-full px-4">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Toggle menu"
        >
          <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>

        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('app.name')}
        </h1>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-gray-300" />
          ) : (
            <Moon className="w-5 h-5 text-gray-700" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
