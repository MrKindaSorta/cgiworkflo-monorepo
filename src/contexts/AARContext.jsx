import { createContext, useContext, useState } from 'react';
import { api } from '../lib/api-client';

const AARContext = createContext(null);

export const AARProvider = ({ children }) => {
  const [aars, setAARs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  /**
   * Load AARs from API with optional filters
   * @param {Object} filters - Filter parameters (search, category, material, damageType, dateFrom, dateTo, userId, sortBy, page, limit)
   * @returns {Promise} Resolves with AAR data and pagination info
   */
  const loadAARs = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.aars.list(filters);
      const { aars: loadedAARs, pagination: paginationInfo } = response.data.data;

      // If it's a paginated request (page > 1), append to existing, otherwise replace
      if (filters.page && filters.page > 1) {
        setAARs(prev => [...prev, ...loadedAARs]);
      } else {
        setAARs(loadedAARs);
      }

      setPagination(paginationInfo);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to load AARs';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create new AAR with form data and photos
   * @param {FormData} formData - FormData object containing form data, formId, formVersion, photos, and photoMetadata
   * @param {Object} config - Optional axios config for upload progress tracking
   * @returns {Promise} Resolves with created AAR data
   */
  const createAAR = async (formData, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.aars.create(formData, config);
      const createdAAR = response.data.data.aar;

      // Optionally prepend to local state (or reload from API)
      setAARs(prev => [createdAAR, ...prev]);

      return createdAAR;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to create AAR';
      const validationErrors = err.response?.data?.errors;
      setError(errorMessage);

      // Re-throw with validation errors if present
      const error = new Error(errorMessage);
      error.validationErrors = validationErrors;
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get single AAR by ID (with view tracking)
   * @param {string} aarId - AAR ID
   * @returns {Promise} Resolves with AAR data and photos
   */
  const getAAR = async (aarId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.aars.get(aarId);
      return response.data.data;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to load AAR';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update existing AAR
   * @param {string} aarId - AAR ID
   * @param {Object} updates - Updated data
   * @returns {Promise} Resolves with updated AAR data
   */
  const updateAAR = async (aarId, updates) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.aars.update(aarId, updates);
      const updatedAAR = response.data.data.aar;

      // Update local state
      setAARs(prev => prev.map(aar => (aar.id === aarId ? updatedAAR : aar)));

      return updatedAAR;
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update AAR';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Soft delete AAR
   * @param {string} aarId - AAR ID
   * @returns {Promise} Resolves when deletion is complete
   */
  const deleteAAR = async (aarId) => {
    setLoading(true);
    setError(null);
    try {
      await api.aars.delete(aarId);

      // Remove from local state
      setAARs(prev => prev.filter(aar => aar.id !== aarId));
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to delete AAR';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Search and filter AARs (convenience wrapper for loadAARs)
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @returns {Promise} Resolves with filtered AAR data
   */
  const searchAARs = async (query, filters = {}) => {
    return loadAARs({ search: query, ...filters });
  };

  /**
   * Upvote an AAR (to be implemented on backend)
   * @param {string} aarId - AAR ID
   * @param {string} reason - Optional reason for upvote
   */
  const upvoteAAR = async (aarId, reason = '') => {
    // TODO: Implement when backend endpoint is ready
    // POST /api/aars/:id/vote { voteType: 'upvote', reason }
    console.warn('upvoteAAR: Backend endpoint not yet implemented');

    // Optimistic update for now
    setAARs(prev =>
      prev.map(aar =>
        aar.id === aarId ? { ...aar, upvotes: aar.upvotes + 1 } : aar
      )
    );
  };

  /**
   * Downvote an AAR (to be implemented on backend)
   * @param {string} aarId - AAR ID
   * @param {string} reason - Optional reason for downvote
   */
  const downvoteAAR = async (aarId, reason = '') => {
    // TODO: Implement when backend endpoint is ready
    // POST /api/aars/:id/vote { voteType: 'downvote', reason }
    console.warn('downvoteAAR: Backend endpoint not yet implemented');

    // Optimistic update for now
    setAARs(prev =>
      prev.map(aar =>
        aar.id === aarId ? { ...aar, downvotes: aar.downvotes + 1 } : aar
      )
    );
  };

  /**
   * Add comment to an AAR (to be implemented on backend)
   * @param {string} aarId - AAR ID
   * @param {Object} comment - Comment data
   */
  const addComment = async (aarId, comment) => {
    // TODO: Implement when backend endpoint is ready
    // POST /api/aars/:id/comments { content }
    console.warn('addComment: Backend endpoint not yet implemented');
  };

  /**
   * Increment view count (handled automatically by getAAR on backend)
   * @param {string} aarId - AAR ID (deprecated - views are tracked server-side)
   */
  const incrementViews = (aarId) => {
    // Views are now tracked server-side when calling getAAR
    // This function is kept for backwards compatibility but does nothing
    console.info('Views are automatically tracked server-side');
  };

  const value = {
    // State
    aars,
    loading,
    error,
    pagination,

    // Methods
    loadAARs,
    createAAR,
    getAAR,
    updateAAR,
    deleteAAR,
    searchAARs,
    upvoteAAR,
    downvoteAAR,
    addComment,
    incrementViews, // Deprecated
  };

  return <AARContext.Provider value={value}>{children}</AARContext.Provider>;
};

export const useAAR = () => {
  const context = useContext(AARContext);
  if (!context) {
    throw new Error('useAAR must be used within an AARProvider');
  }
  return context;
};
