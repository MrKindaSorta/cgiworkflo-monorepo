import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import Header from './Header';

const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isFullPageRoute = location.pathname === '/chat';

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Mobile Header - Fixed at top */}
      <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

      <div className="flex h-full">
        {/* Desktop Sidebar - Static on left */}
        <div className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-64">
            <Sidebar />
          </div>
        </div>

        {/* Main Content Area */}
        <div className={`flex-1 ${isFullPageRoute ? '' : 'overflow-y-auto'} pt-16 md:pt-0`}>
          <main className={`${isFullPageRoute ? 'h-full' : 'p-4 md:p-8 pb-20 md:pb-8'}`}>
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Fixed at bottom */}
      <MobileNav />

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black bg-opacity-50" />
          <div
            className="absolute top-0 left-0 w-64 h-full bg-white dark:bg-gray-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar mobile onItemClick={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
