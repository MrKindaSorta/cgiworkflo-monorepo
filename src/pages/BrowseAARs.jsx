import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAAR } from '../contexts/AARContext';
import { Search, Filter, TrendingUp, Eye } from 'lucide-react';

const BrowseAARs = () => {
  const { t } = useTranslation();
  const { aars, searchAARs } = useAAR();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    sortBy: 'date',
  });

  const filteredAARs = searchAARs(searchQuery, filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          {t('aar.browse')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Explore all After Action Reports
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option value="date" className="dark:bg-gray-700 dark:text-white">Latest</option>
            <option value="upvotes" className="dark:bg-gray-700 dark:text-white">Most Upvoted</option>
            <option value="views" className="dark:bg-gray-700 dark:text-white">Most Viewed</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filteredAARs.map((aar) => (
          <Link
            key={aar.id}
            to={`/aar/${aar.id}`}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-video bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              {aar.photos?.after?.[0] ? (
                <img
                  src={aar.photos.after[0]}
                  alt={`${aar.category} ${aar.model}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-gray-400">No Image</span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {aar.category} - {aar.subCategory} {aar.model}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {aar.year} • {aar.material}
              </p>
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  {aar.upvotes}
                </span>
                <span className="flex items-center">
                  <Eye className="w-4 h-4 mr-1" />
                  {aar.views || 0}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredAARs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No AARs found</p>
        </div>
      )}
    </div>
  );
};

export default BrowseAARs;
