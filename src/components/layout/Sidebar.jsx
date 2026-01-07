import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  LayoutDashboard,
  Search,
  FileText,
  MessageSquare,
  User,
  BarChart3,
  Palette,
  FileEdit,
  Users,
  LogOut,
  Sun,
  Moon,
  Globe,
  RefreshCw,
} from 'lucide-react';
import LanguageSelector from '../ui/LanguageSelector';

const Sidebar = ({ mobile = false, onItemClick = () => {} }) => {
  const { t } = useTranslation();
  const { currentUser, logout, hasPermission } = useAuth();
  const { theme, toggleTheme, branding } = useTheme();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard'), show: true },
    { path: '/browse', icon: Search, label: t('nav.browse'), show: true },
    { path: '/submit', icon: FileText, label: t('nav.submit'), show: true },
    { path: '/chat', icon: MessageSquare, label: t('nav.chat'), show: true },
    { path: '/profile', icon: User, label: t('nav.profile'), show: true },
    {
      path: '/analytics',
      icon: BarChart3,
      label: t('nav.analytics'),
      show: hasPermission('view_analytics') || hasPermission('all'),
    },
    {
      path: '/branding',
      icon: Palette,
      label: t('nav.branding'),
      show: hasPermission('branding') || hasPermission('all'),
    },
    {
      path: '/customize',
      icon: FileEdit,
      label: t('nav.customize'),
      show: hasPermission('custom_forms') || hasPermission('all'),
    },
    {
      path: '/users',
      icon: Users,
      label: t('nav.users'),
      show: hasPermission('all'),
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Logo / Brand */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        {branding.logo ? (
          <img src={branding.logo} alt={t('app.name')} className="h-10 w-auto" />
        ) : (
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('app.name')}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('app.tagline')}
            </p>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
            {currentUser?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {currentUser?.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {t(`auth.${currentUser?.role}`)}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map(
          (item) =>
            item.show && (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onItemClick}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`w-5 h-5 ${
                        isActive ? 'text-primary-600 dark:text-primary-400' : ''
                      }`}
                    />
                    <span className="text-sm font-medium">{item.label}</span>
                  </>
                )}
              </NavLink>
            )
        )}
      </nav>

      {/* Settings */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('settings.theme')}
          </span>
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

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('settings.language')}
          </span>
          <LanguageSelector />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            title="Hard Refresh"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-medium">Refresh</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
