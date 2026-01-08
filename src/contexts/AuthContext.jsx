import { createContext, useContext, useState, useEffect } from 'react';
import { mockUsers } from '../mocks/users';
import { STORAGE_KEYS, getFromStorage, saveToStorage } from '../utils/localStorage';
import { api } from '../lib/api-client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState(mockUsers);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    // Load current user from localStorage
    const savedUser = getFromStorage(STORAGE_KEYS.CURRENT_USER);
    if (savedUser) {
      setCurrentUser(savedUser);
      // Load users from API if admin/manager
      if (savedUser.role === 'admin' || savedUser.role === 'manager') {
        loadUsers();
      }
    }

    // Fallback: Load users from localStorage for offline support
    const savedUsers = getFromStorage(STORAGE_KEYS.USERS);
    if (savedUsers && savedUsers.length > 0) {
      setUsers(savedUsers);
    }
  }, []);

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await api.users.list();
      const usersList = response.data.data || [];
      setUsers(usersList);
      // Cache users in localStorage for offline fallback
      saveToStorage(STORAGE_KEYS.USERS, usersList);
    } catch (error) {
      console.error('Error loading users:', error);
      // Fallback to localStorage or mock data
      const savedUsers = getFromStorage(STORAGE_KEYS.USERS);
      if (savedUsers && savedUsers.length > 0) {
        setUsers(savedUsers);
      } else {
        setUsers(mockUsers);
      }
    } finally {
      setUsersLoading(false);
    }
  };

  const login = (userData) => {
    setCurrentUser(userData);
    saveToStorage(STORAGE_KEYS.CURRENT_USER, userData);
  };

  const logout = () => {
    setCurrentUser(null);
    saveToStorage(STORAGE_KEYS.CURRENT_USER, null);
  };

  const createUser = async (userData) => {
    try {
      const response = await api.users.create(userData);
      const newUser = response.data.data;

      // Update local state
      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);
      saveToStorage(STORAGE_KEYS.USERS, updatedUsers);

      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      // Fallback to localStorage mode
      const newUser = {
        ...userData,
        id: `user_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);
      saveToStorage(STORAGE_KEYS.USERS, updatedUsers);
      return newUser;
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      const response = await api.users.update(userId, updates);
      const updatedUser = response.data.data;

      // Update local state
      const updatedUsers = users.map((user) =>
        user.id === userId ? updatedUser : user
      );
      setUsers(updatedUsers);
      saveToStorage(STORAGE_KEYS.USERS, updatedUsers);

      // Update current user if it's the one being updated
      if (currentUser?.id === userId) {
        const updatedCurrentUser = { ...currentUser, ...updates };
        setCurrentUser(updatedCurrentUser);
        saveToStorage(STORAGE_KEYS.CURRENT_USER, updatedCurrentUser);
      }

      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      // Fallback to localStorage mode
      const updatedUsers = users.map((user) =>
        user.id === userId ? { ...user, ...updates } : user
      );
      setUsers(updatedUsers);
      saveToStorage(STORAGE_KEYS.USERS, updatedUsers);

      if (currentUser?.id === userId) {
        const updatedCurrentUser = { ...currentUser, ...updates };
        setCurrentUser(updatedCurrentUser);
        saveToStorage(STORAGE_KEYS.CURRENT_USER, updatedCurrentUser);
      }
      throw error;
    }
  };

  const deleteUser = async (userId) => {
    try {
      await api.users.delete(userId);

      // Update local state
      const updatedUsers = users.filter((user) => user.id !== userId);
      setUsers(updatedUsers);
      saveToStorage(STORAGE_KEYS.USERS, updatedUsers);
    } catch (error) {
      console.error('Error deleting user:', error);
      // Fallback to localStorage mode
      const updatedUsers = users.filter((user) => user.id !== userId);
      setUsers(updatedUsers);
      saveToStorage(STORAGE_KEYS.USERS, updatedUsers);
      throw error;
    }
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
    usersLoading,
    login,
    logout,
    createUser,
    updateUser,
    deleteUser,
    loadUsers,
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
