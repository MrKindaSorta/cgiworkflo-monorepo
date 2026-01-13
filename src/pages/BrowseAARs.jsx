import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAAR } from '../contexts/AARContext';
import { Search, Filter, TrendingUp, Eye } from 'lucide-react';

const BrowseAARs = () => {
  const { t } = useTranslation();
  const { aars, loading, error, loadAARs } = useAAR();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    sortBy: 'recent',
  });

  // Load AARs on mount and when filters change
  useEffect(() => {
    const loadData = async () => {
      try {
        await loadAARs({
          search: searchQuery,
          sortBy: filters.sortBy,
          category: filters.category || undefined,
        });
      } catch (err) {
        console.error('Failed to load AARs:', err);
      }
    };

    // Debounce search
    const timer = setTimeout(loadData, searchQuery ? 500 : 0);
    return () => clearTimeout(timer);
  }, [searchQuery, filters.sortBy, filters.category]);

  const filteredAARs = aars || [];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          {t('aar.browse')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Explore all After Action Reports
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-5 shadow-sm space-y-4">
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
            <option value="recent" className="dark:bg-gray-700 dark:text-white">Latest</option>
            <option value="upvotes" className="dark:bg-gray-700 dark:text-white">Most Upvoted</option>
            <option value="views" className="dark:bg-gray-700 dark:text-white">Most Viewed</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading AARs...</p>
        </div>
      )}

      {/* Results */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filteredAARs.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              No AARs found. {searchQuery && 'Try adjusting your search or filters.'}
            </div>
          ) : (
            filteredAARs.map((aar) => (
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
            <div className="p-3">
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
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default BrowseAARs;
