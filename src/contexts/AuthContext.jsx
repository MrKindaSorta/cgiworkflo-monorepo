import { createContext, useContext, useState, useEffect } from 'react';
import { mockUsers } from '../mocks/users';
import { STORAGE_KEYS, getFromStorage, saveToStorage } from '../utils/localStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState(mockUsers);

  useEffect(() => {
    // Load current user from localStorage
    const savedUser = getFromStorage(STORAGE_KEYS.CURRENT_USER);
    if (savedUser) {
      setCurrentUser(savedUser);
    }

    // Load users from localStorage or initialize with mock data
    const savedUsers = getFromStorage(STORAGE_KEYS.USERS);
    if (savedUsers) {
      setUsers(savedUsers);
    } else {
      saveToStorage(STORAGE_KEYS.USERS, mockUsers);
    }
  }, []);

  const login = (userData) => {
    setCurrentUser(userData);
    saveToStorage(STORAGE_KEYS.CURRENT_USER, userData);
  };

  const logout = () => {
    setCurrentUser(null);
    saveToStorage(STORAGE_KEYS.CURRENT_USER, null);
  };

  const createUser = (userData) => {
    const newUser = {
      ...userData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    saveToStorage(STORAGE_KEYS.USERS, updatedUsers);
    return newUser;
  };

  const updateUser = (userId, updates) => {
    const updatedUsers = users.map((user) =>
      user.id === userId ? { ...user, ...updates } : user
    );
    setUsers(updatedUsers);
    saveToStorage(STORAGE_KEYS.USERS, updatedUsers);

    // Update current user if it's the one being updated
    if (currentUser?.id === userId) {
      const updatedCurrentUser = { ...currentUser, ...updates };
      setCurrentUser(updatedCurrentUser);
      saveToStorage(STORAGE_KEYS.CURRENT_USER, updatedCurrentUser);
    }
  };

  const deleteUser = (userId) => {
    const updatedUsers = users.filter((user) => user.id !== userId);
    setUsers(updatedUsers);
    saveToStorage(STORAGE_KEYS.USERS, updatedUsers);
  };

  const hasPermission = (permission) => {
    if (!currentUser) return false;

    const permissions = {
      admin: ['all'],
      manager: ['view_aars', 'submit_aar', 'edit_aar', 'delete_aar', 'view_analytics', 'custom_forms', 'branding'],
      franchisee: ['view_aars', 'submit_aar', 'create_employee', 'edit_own_aar', 'delete_own_aar'],
      employee: ['view_aars', 'submit_aar', 'edit_own_aar'],
    };

    const userPermissions = permissions[currentUser.role] || [];
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };

  const value = {
    currentUser,
    users,
    login,
    logout,
    createUser,
    updateUser,
    deleteUser,
    hasPermission,
    isAuthenticated: !!currentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
