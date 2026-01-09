/**
 * Chat Utility Functions
 * Shared utilities for chat components to prevent recreation on every render
 */

export const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '-';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  }
};

export const shouldShowDateSeparator = (currentMsg, previousMsg) => {
  if (!currentMsg) return false;
  if (!previousMsg) return true;
  const currentDate = new Date(currentMsg.timestamp).toDateString();
  const previousDate = new Date(previousMsg.timestamp).toDateString();
  return currentDate !== previousDate;
};

export const shouldGroupMessage = (currentMsg, previousMsg) => {
  if (!previousMsg || !currentMsg) return false;
  if (currentMsg.senderId !== previousMsg.senderId) return false;
  const timeDiff = new Date(currentMsg.timestamp) - new Date(previousMsg.timestamp);
  return timeDiff < 60000; // 1 minute
};

export const getInitials = (name) => {
  if (!name || name.trim() === '') return '?';
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '?';
};

export const getAvatarColor = (id) => {
  const colors = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-green-500 to-green-600',
    'from-yellow-500 to-yellow-600',
    'from-red-500 to-red-600',
    'from-indigo-500 to-indigo-600',
    'from-teal-500 to-teal-600',
  ];
  // Hash function that works with both numeric IDs and UUIDs
  const hash = String(id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % colors.length;
  return colors[index];
};
