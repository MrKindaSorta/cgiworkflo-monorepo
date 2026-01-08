import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAAR } from '../contexts/AARContext';
import { FileText, Eye, TrendingUp, Calendar } from 'lucide-react';

const Dashboard = () => {
  const { t } = useTranslation();
  const { currentUser, hasPermission } = useAuth();
  const { aars } = useAAR();

  // Get recent AARs (last 10)
  const recentAARs = [...aars].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

  // Calculate stats
  const today = new Date();
  const todayStart = new Date(today.setHours(0, 0, 0, 0));
  const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const aarsToday = aars.filter((aar) => new Date(aar.createdAt) >= todayStart).length;
  const aarsThisWeek = aars.filter((aar) => new Date(aar.createdAt) >= weekStart).length;
  const aarsThisMonth = aars.filter((aar) => new Date(aar.createdAt) >= monthStart).length;
  const totalViews = aars.reduce((sum, aar) => sum + (aar.views || 0), 0);

  const showStats = hasPermission('view_analytics') || hasPermission('all');

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          {t('dashboard.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Welcome back, {currentUser?.name}!
        </p>
      </div>

      {/* Stats Grid */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dashboard.stats.today')}
                </p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {aarsToday}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dashboard.stats.week')}
                </p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {aarsThisWeek}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dashboard.stats.month')}
                </p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {aarsThisMonth}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dashboard.stats.views')}
                </p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {totalViews}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Eye className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent AARs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-3 md:p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
            {t('dashboard.recentAARs')}
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {recentAARs.length > 0 ? (
            recentAARs.map((aar) => (
              <Link
                key={aar.id}
                to={`/aar/${aar.id}`}
                className="block p-3 md:p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                      {aar.category} - {aar.subCategory} {aar.model}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {aar.year} • {aar.color} • {aar.material}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2 line-clamp-2">
                      {aar.damageDescription}
                    </p>
                  </div>
                  <div className="ml-4 flex flex-col items-end space-y-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(aar.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {aar.upvotes}
                      </span>
                      <span className="flex items-center">
                        <Eye className="w-3 h-3 mr-1" />
                        {aar.views || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="p-4 md:p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">No AARs yet. Create your first one!</p>
              <Link
                to="/submit"
                className="inline-block mt-4 text-primary-600 dark:text-primary-400 hover:underline"
              >
                {t('aar.submit')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
