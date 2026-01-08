/**
 * Chat Context
 * Manages real-time chat state with smart polling
 * Handles conversations, messages, and presence tracking
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api-client';

const ChatContext = createContext(null);

// ============================================================================
// POLLING STATE MACHINE
// ============================================================================

const PollingState = {
  ACTIVE_CONVERSATION: 2500, // 2.5s - Real-time feel when actively chatting
  BACKGROUND_MONITORING: 5000, // 5s - Check for new messages/conversations
  IDLE: 15000, // 15s - Reduced load when chat page open but inactive
  HIDDEN: 30000, // 30s - Battery-efficient when tab hidden
  OFFLINE: 60000, // 60s - Slowest when network issues detected
};

// ============================================================================
// CHAT PROVIDER
// ============================================================================

export const ChatProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({}); // { conversationId: [messages] }
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [presence, setPresence] = useState({}); // { userId: { isOnline, lastSeen } }
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Polling state
  const [pollingInterval, setPollingInterval] = useState(PollingState.BACKGROUND_MONITORING);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(null);
  const [conversationTimestamps, setConversationTimestamps] = useState({});

  // Refs for polling control
  const pollingTimeoutRef = useRef(null);
  const isPollingRef = useRef(false);
  const syncInProgressRef = useRef(false);
  const failureCountRef = useRef(0);
  const tabVisibleRef = useRef(true);

  // ============================================================================
  // INITIAL LOAD
  // ============================================================================
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    loadConversations();
    loadOpenChat();
  }, [isAuthenticated]);

  // ============================================================================
  // POLLING SETUP
  // ============================================================================
  useEffect(() => {
    if (!isAuthenticated) return;

    startPolling();

    return () => {
      stopPolling();
    };
  }, [isAuthenticated, pollingInterval]);

  // ============================================================================
  // TAB VISIBILITY DETECTION (Battery Optimization)
  // ============================================================================
  useEffect(() => {
    const handleVisibilityChange = () => {
      tabVisibleRef.current = !document.hidden;

      if (document.hidden) {
        setPollingInterval(PollingState.HIDDEN); // Slow down when hidden
      } else {
        // Resume active polling when tab becomes visible
        if (activeConversationId) {
          setPollingInterval(PollingState.ACTIVE_CONVERSATION);
        } else {
          setPollingInterval(PollingState.BACKGROUND_MONITORING);
        }
        // Immediate sync on tab focus
        syncChat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeConversationId]);

  // ============================================================================
  // ADAPTIVE POLLING INTERVAL (Based on Activity)
  // ============================================================================
  useEffect(() => {
    // Don't change interval if tab is hidden
    if (!tabVisibleRef.current) return;

    if (activeConversationId) {
      setPollingInterval(PollingState.ACTIVE_CONVERSATION); // Fast polling
    } else {
      setPollingInterval(PollingState.BACKGROUND_MONITORING); // Slower polling
    }
  }, [activeConversationId]);

  // ============================================================================
  // POLLING FUNCTIONS
  // ============================================================================

  const startPolling = () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    pollChat();
  };

  const stopPolling = () => {
    isPollingRef.current = false;
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  };

  const pollChat = async () => {
    if (!isPollingRef.current) return;

    try {
      await syncChat();
      failureCountRef.current = 0; // Reset on success
    } catch (error) {
      console.error('Polling error:', error);
      failureCountRef.current++;

      // Exponential backoff on repeated failures (5s, 10s, 20s, 40s, 60s max)
      if (failureCountRef.current > 3) {
        const backoffInterval = Math.min(60000, 5000 * Math.pow(2, failureCountRef.current - 3));
        console.warn(`[Chat] Backing off for ${backoffInterval}ms after ${failureCountRef.current} failures`);
        pollingTimeoutRef.current = setTimeout(pollChat, backoffInterval);
        return;
      }
    }

    // Schedule next poll
    pollingTimeoutRef.current = setTimeout(pollChat, pollingInterval);
  };

  // ============================================================================
  // BATCHED SYNC FUNCTION (Core of Smart Polling)
  // ============================================================================

  const syncChat = useCallback(async () => {
    if (!isAuthenticated || syncInProgressRef.current) return;

    syncInProgressRef.current = true;

    try {
      // Collect presence user IDs from DMs
      const presenceUserIds = conversations
        .filter((conv) => conv.type === 'direct')
        .flatMap((conv) => {
          const participants = conv.participants || [];
          return participants.map((p) => p.userId);
        })
        .filter((id) => id !== currentUser?.id);

      // Call batched sync endpoint
      const syncData = {};

      if (lastSyncTimestamp) {
        syncData.lastSync = lastSyncTimestamp;
      }

      if (activeConversationId) {
        syncData.activeConversationId = activeConversationId;
      }

      if (conversationTimestamps && Object.keys(conversationTimestamps).length > 0) {
        syncData.conversationTimestamps = conversationTimestamps;
      }

      const uniquePresenceIds = [...new Set(presenceUserIds)].filter(Boolean).slice(0, 50);
      if (uniquePresenceIds.length > 0) {
        syncData.presenceUserIds = uniquePresenceIds;
      }

      const response = await api.chat.sync(syncData);

      const data = response.data.data;

      // Update conversations
      if (data.conversations && data.conversations.length > 0) {
        setConversations((prev) => {
          const updated = [...prev];

          data.conversations.forEach((newConv) => {
            const index = updated.findIndex((c) => c.id === newConv.id);
            if (index >= 0) {
              updated[index] = { ...updated[index], ...newConv };
            } else {
              updated.push(newConv);
            }
          });

          // Sort by last message time
          updated.sort((a, b) => {
            const aTime = a.lastMessageAt || a.createdAt;
            const bTime = b.lastMessageAt || b.createdAt;
            if (!aTime) return 1;
            if (!bTime) return -1;
            return new Date(bTime) - new Date(aTime);
          });

          return updated;
        });
      }

      // Update messages
      if (data.messages && Object.keys(data.messages).length > 0) {
        setMessages((prev) => {
          const updated = { ...prev };

          Object.keys(data.messages).forEach((convId) => {
            const newMessages = data.messages[convId];

            if (!updated[convId]) {
              updated[convId] = newMessages;
            } else {
              // Merge new messages, avoid duplicates
              const existingIds = new Set(updated[convId].map((m) => m.id));
              const toAdd = newMessages.filter((m) => !existingIds.has(m.id));
              updated[convId] = [...updated[convId], ...toAdd].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            }

            // Update conversation timestamp for differential queries
            if (newMessages.length > 0) {
              const lastMsg = newMessages[newMessages.length - 1];
              setConversationTimestamps((prev) => ({
                ...prev,
                [convId]: lastMsg.timestamp,
              }));
            }
          });

          return updated;
        });
      }

      // Update presence
      if (data.presence && Object.keys(data.presence).length > 0) {
        setPresence((prev) => ({
          ...prev,
          ...data.presence,
        }));
      }

      // Update sync timestamp
      setLastSyncTimestamp(data.syncTimestamp);
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [isAuthenticated, lastSyncTimestamp, activeConversationId, conversationTimestamps, conversations, currentUser]);

  // ============================================================================
  // CONVERSATION MANAGEMENT
  // ============================================================================

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await api.conversations.list();
      const convList = response.data.data || [];
      setConversations(convList);

      // Initialize conversation timestamps
      const timestamps = {};
      convList.forEach((conv) => {
        timestamps[conv.id] = conv.lastMessageAt || conv.createdAt;
      });
      setConversationTimestamps(timestamps);

      setLastSyncTimestamp(new Date().toISOString());
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async (type, participantIds, name = null) => {
    try {
      const response = await api.conversations.create({
        type,
        participantIds,
        name,
      });

      const newConvId = response.data.data.id;

      // If conversation existed, just return it
      if (response.data.existed) {
        return newConvId;
      }

      // Reload conversations to get new one
      await loadConversations();

      return newConvId;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  };

  const loadOpenChat = async () => {
    try {
      const response = await api.conversations.getOpen();
      const openChatId = response.data.data.id;

      // Ensure open chat is in conversations list
      if (!conversations.find((c) => c.id === openChatId)) {
        await loadConversations();
      }
    } catch (error) {
      console.error('Failed to load open chat:', error);
    }
  };

  const getConversation = (conversationId) => {
    return conversations.find((c) => c.id === conversationId);
  };

  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================

  const loadMessages = async (conversationId, options = {}) => {
    try {
      const response = await api.conversations.getMessages(conversationId, options);
      const msgs = response.data.data || [];

      setMessages((prev) => ({
        ...prev,
        [conversationId]: msgs,
      }));

      // Update timestamp for differential queries
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        setConversationTimestamps((prev) => ({
          ...prev,
          [conversationId]: lastMsg.timestamp,
        }));
      }

      return msgs;
    } catch (error) {
      console.error('Failed to load messages:', error);
      return [];
    }
  };

  const sendMessage = async (conversationId, content, messageType = 'text') => {
    try {
      setSending(true);

      // Optimistic update - show message immediately
      const tempMessage = {
        id: `temp_${Date.now()}`,
        conversationId,
        senderId: currentUser?.id,
        content,
        messageType,
        timestamp: new Date().toISOString(),
        senderName: currentUser?.name,
        _isPending: true,
      };

      setMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), tempMessage],
      }));

      // Send to API
      const response = await api.conversations.sendMessage(conversationId, {
        content,
        messageType,
      });

      const actualMessage = response.data.data;

      // Replace temp message with actual
      setMessages((prev) => ({
        ...prev,
        [conversationId]: prev[conversationId].map((m) => (m.id === tempMessage.id ? actualMessage : m)),
      }));

      // Update conversation in list
      setConversations((prev) =>
        prev.map((conv) => (conv.id === conversationId ? { ...conv, lastMessageAt: actualMessage.timestamp } : conv))
      );

      // Trigger immediate sync to get updates from other users
      setTimeout(() => syncChat(), 500);

      return actualMessage;
    } catch (error) {
      console.error('Failed to send message:', error);

      // Remove optimistic message on failure
      setMessages((prev) => ({
        ...prev,
        [conversationId]: prev[conversationId].filter((m) => !m._isPending),
      }));

      throw error;
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      await api.conversations.markAsRead(conversationId);

      // Update local state
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, unreadCount: 0, lastReadAt: new Date().toISOString() } : conv
        )
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const getMessages = (conversationId) => {
    return messages[conversationId] || [];
  };

  // ============================================================================
  // PRESENCE MANAGEMENT
  // ============================================================================

  const sendHeartbeat = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      await api.presence.heartbeat();
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, [isAuthenticated]);

  // Send heartbeat every 2 minutes
  useEffect(() => {
    if (!isAuthenticated) return;

    // Send initial heartbeat
    sendHeartbeat();

    const heartbeatInterval = setInterval(sendHeartbeat, 120000); // 2 minutes

    return () => clearInterval(heartbeatInterval);
  }, [isAuthenticated, sendHeartbeat]);

  const isUserOnline = (userId) => {
    return presence[userId]?.isOnline || false;
  };

  const getUserLastSeen = (userId) => {
    return presence[userId]?.lastSeen || null;
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getTotalUnreadCount = () => {
    return conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
  };

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value = {
    conversations,
    messages,
    activeConversationId,
    presence,
    loading,
    sending,

    // Conversation management
    createConversation,
    loadConversations,
    getConversation,
    setActiveConversationId,

    // Message management
    loadMessages,
    sendMessage,
    markAsRead,
    getMessages,

    // Presence
    isUserOnline,
    getUserLastSeen,

    // Utilities
    getTotalUnreadCount,
    syncChat, // Expose for manual sync
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
