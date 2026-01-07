import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Search,
  FileText,
  MessageSquare,
  User,
} from 'lucide-react';

const MobileNav = () => {
  const { t } = useTranslation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { path: '/browse', icon: Search, label: t('nav.browse') },
    { path: '/submit', icon: FileText, label: t('nav.submit') },
    { path: '/chat', icon: MessageSquare, label: t('nav.chat') },
    { path: '/profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full space-y-1 ${
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;
