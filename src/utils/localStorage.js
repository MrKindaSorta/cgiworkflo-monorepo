// LocalStorage utilities for data persistence

const STORAGE_KEYS = {
  USERS: 'cgiworkflo_users',
  AARS: 'cgiworkflo_aars',
  MESSAGES: 'cgiworkflo_messages',
  CONVERSATIONS: 'cgiworkflo_conversations',
  NOTIFICATIONS: 'cgiworkflo_notifications',
  CURRENT_USER: 'cgiworkflo_current_user',
  BRANDING: 'cgiworkflo_branding',
  CUSTOM_FORMS: 'cgiworkflo_custom_forms',
};

export const getFromStorage = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return null;
  }
};

export const saveToStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
    return false;
  }
};

export const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing ${key} from localStorage:`, error);
    return false;
  }
};

export const clearAllStorage = () => {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return false;
  }
};

export { STORAGE_KEYS };
