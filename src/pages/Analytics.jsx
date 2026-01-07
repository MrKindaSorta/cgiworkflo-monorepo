import { useTranslation } from 'react-i18next';
import { useAAR } from '../contexts/AARContext';
import { BarChart3, TrendingUp, FileText, Eye } from 'lucide-react';

const Analytics = () => {
  const { t } = useTranslation();
  const { aars } = useAAR();

  const totalAARs = aars.length;
  const totalViews = aars.reduce((sum, aar) => sum + (aar.views || 0), 0);
  const totalUpvotes = aars.reduce((sum, aar) => sum + aar.upvotes, 0);

  const categoryStats = aars.reduce((acc, aar) => {
    acc[aar.category] = (acc[aar.category] || 0) + 1;
    return acc;
  }, {});

  const materialStats = aars.reduce((acc, aar) => {
    acc[aar.material] = (acc[aar.material] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {t('analytics.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Comprehensive insights and metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total AARs</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {totalAARs}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Views</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {totalViews}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <Eye className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Upvotes</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {totalUpvotes}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            AARs by Category
          </h2>
          <div className="space-y-3">
            {Object.entries(categoryStats).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">{category}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full"
                      style={{ width: `${(count / totalAARs) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-8">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Materials Used
          </h2>
          <div className="space-y-3">
            {Object.entries(materialStats).map(([material, count]) => (
              <div key={material} className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">{material}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(count / totalAARs) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-8">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
