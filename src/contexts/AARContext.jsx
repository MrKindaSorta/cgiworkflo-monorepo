import { createContext, useContext, useState, useEffect } from 'react';
import { mockAARs } from '../mocks/aars';
import { STORAGE_KEYS, getFromStorage, saveToStorage } from '../utils/localStorage';

const AARContext = createContext(null);

export const AARProvider = ({ children }) => {
  const [aars, setAARs] = useState([]);

  useEffect(() => {
    // Load AARs from localStorage or initialize with mock data
    const savedAARs = getFromStorage(STORAGE_KEYS.AARS);
    if (savedAARs) {
      setAARs(savedAARs);
    } else {
      setAARs(mockAARs);
      saveToStorage(STORAGE_KEYS.AARS, mockAARs);
    }
  }, []);

  const createAAR = (aarData) => {
    const newAAR = {
      ...aarData,
      id: Date.now().toString(),
      upvotes: 0,
      downvotes: 0,
      comments: [],
      views: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedAARs = [newAAR, ...aars];
    setAARs(updatedAARs);
    saveToStorage(STORAGE_KEYS.AARS, updatedAARs);
    return newAAR;
  };

  const updateAAR = (aarId, updates) => {
    const updatedAARs = aars.map((aar) =>
      aar.id === aarId ? { ...aar, ...updates, updatedAt: new Date().toISOString() } : aar
    );
    setAARs(updatedAARs);
    saveToStorage(STORAGE_KEYS.AARS, updatedAARs);
  };

  const deleteAAR = (aarId) => {
    const updatedAARs = aars.filter((aar) => aar.id !== aarId);
    setAARs(updatedAARs);
    saveToStorage(STORAGE_KEYS.AARS, updatedAARs);
  };

  const getAAR = (aarId) => {
    return aars.find((aar) => aar.id === aarId);
  };

  const upvoteAAR = (aarId, reason = '') => {
    const updatedAARs = aars.map((aar) =>
      aar.id === aarId ? { ...aar, upvotes: aar.upvotes + 1 } : aar
    );
    setAARs(updatedAARs);
    saveToStorage(STORAGE_KEYS.AARS, updatedAARs);
  };

  const downvoteAAR = (aarId, reason = '') => {
    const updatedAARs = aars.map((aar) =>
      aar.id === aarId ? { ...aar, downvotes: aar.downvotes + 1 } : aar
    );
    setAARs(updatedAARs);
    saveToStorage(STORAGE_KEYS.AARS, updatedAARs);
  };

  const addComment = (aarId, comment) => {
    const newComment = {
      id: Date.now().toString(),
      ...comment,
      thumbsUp: 0,
      thumbsDown: 0,
      createdAt: new Date().toISOString(),
    };
    const updatedAARs = aars.map((aar) =>
      aar.id === aarId ? { ...aar, comments: [...(aar.comments || []), newComment] } : aar
    );
    setAARs(updatedAARs);
    saveToStorage(STORAGE_KEYS.AARS, updatedAARs);
  };

  const incrementViews = (aarId) => {
    const updatedAARs = aars.map((aar) =>
      aar.id === aarId ? { ...aar, views: (aar.views || 0) + 1 } : aar
    );
    setAARs(updatedAARs);
    saveToStorage(STORAGE_KEYS.AARS, updatedAARs);
  };

  const searchAARs = (query, filters = {}) => {
    let filtered = [...aars];

    // Full-text search
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter((aar) => {
        return (
          aar.category?.toLowerCase().includes(lowerQuery) ||
          aar.subCategory?.toLowerCase().includes(lowerQuery) ||
          aar.model?.toLowerCase().includes(lowerQuery) ||
          aar.material?.toLowerCase().includes(lowerQuery) ||
          aar.damageDescription?.toLowerCase().includes(lowerQuery) ||
          aar.processDescription?.toLowerCase().includes(lowerQuery)
        );
      });
    }

    // Apply filters
    if (filters.category) {
      filtered = filtered.filter((aar) => aar.category === filters.category);
    }
    if (filters.subCategory) {
      filtered = filtered.filter((aar) => aar.subCategory === filters.subCategory);
    }
    if (filters.material) {
      filtered = filtered.filter((aar) => aar.material === filters.material);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter((aar) => new Date(aar.createdAt) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter((aar) => new Date(aar.createdAt) <= new Date(filters.dateTo));
    }

    // Sort by relevance or date
    if (filters.sortBy === 'upvotes') {
      filtered.sort((a, b) => b.upvotes - a.upvotes);
    } else if (filters.sortBy === 'views') {
      filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return filtered;
  };

  const value = {
    aars,
    createAAR,
    updateAAR,
    deleteAAR,
    getAAR,
    upvoteAAR,
    downvoteAAR,
    addComment,
    incrementViews,
    searchAARs,
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
