/**
 * Chat Context - PROPERLY STRUCTURED
 * Manages real-time chat state with smart polling
 *
 * STRUCTURE:
 * 1. State declarations
 * 2. Refs
 * 3. ALL callback functions (in dependency order)
 * 4. ALL useEffects
 * 5. Memoized context value
 * 6. Return
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api-client';
import toast from 'react-hot-toast';

const ChatContext = createContext(null);

// ============================================================================
// POLLING STATE MACHINE
// ============================================================================

const PollingState = {
  ACTIVE_CONVERSATION: 5000,
  BACKGROUND_MONITORING: 10000,
  IDLE: 15000,
  HIDDEN: 30000,
  OFFLINE: 60000,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const shallowEqual = (obj1, obj2) => {
  if (!obj1 || !obj2) return obj1 === obj2;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every((key) => obj1[key] === obj2[key]);
};

const messagesEqual = (arr1, arr2) => {
  if (!arr1 || !arr2) return arr1 === arr2;
  if (arr1.length !== arr2.length) return false;

  const checkCount = Math.min(5, arr1.length);
  for (let i = arr1.length - checkCount; i < arr1.length; i++) {
    const msg1 = arr1[i];
    const msg2 = arr2[i];

    if (
      msg1.id !== msg2.id ||
      msg1.content !== msg2.content ||
      msg1._isPending !== msg2._isPending ||
      msg1._failed !== msg2._failed
    ) {
      return false;
    }
  }

  return true;
};

// ============================================================================
// CHAT PROVIDER
// ============================================================================

export const ChatProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();

  // ============================================================================
  // STATE DECLARATIONS
  // ============================================================================
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [presence, setPresence] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(PollingState.BACKGROUND_MONITORING);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(null);
  const [conversationTimestamps, setConversationTimestamps] = useState({});

  // ============================================================================
  // REFS
  // ============================================================================
  const pollingTimeoutRef = useRef(null);
  const isPollingRef = useRef(false);
  const syncInProgressRef = useRef(false);
  const failureCountRef = useRef(0);
  const tabVisibleRef = useRef(true);
  const retryTimeoutRef = useRef(null);
  const conversationTimestampsRef = useRef(conversationTimestamps);
  const conversationsRef = useRef(conversations);
  const messagesRef = useRef(messages);

  // ============================================================================
  // CALLBACK FUNCTIONS (Defined in dependency order: bottom-up)
  // ============================================================================

  // Level 1: No function dependencies
  const loadMessages = useCallback(async (conversationId, options = {}) => {
    try {
      const response = await api.conversations.getMessages(conversationId, options);
      const msgs = response.data.data || [];
      console.log(`[ChatContext] Loaded ${msgs.length} messages for conversation ${conversationId}:`, msgs);

      setMessages((prev) => ({
        ...prev,
        [conversationId]: msgs,
      }));

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
      toast.error('Failed to load messages. Please try again.');
      return [];
    }
  }, []);

  const getMessages = useCallback((conversationId) => {
    return messages[conversationId] || [];
  }, [messages]);

  const getConversation = useCallback((conversationId) => {
    return conversations.find((c) => c.id === conversationId);
  }, [conversations]);

  const markAsRead = useCallback(async (conversationId) => {
    try {
      await api.conversations.markAsRead(conversationId);

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, unreadCount: 0, lastReadAt: new Date().toISOString() } : conv
        )
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, []);

  const isUserOnline = useCallback((userId) => {
    return presence[userId]?.isOnline || false;
  }, [presence]);

  const getUserLastSeen = useCallback((userId) => {
    return presence[userId]?.lastSeen || null;
  }, [presence]);

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
  }, [conversations]);

  const sendHeartbeat = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      await api.presence.heartbeat();
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, [isAuthenticated]);

  // Level 2: Depends on Level 1 functions
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.conversations.list();
      const convList = response.data.data || [];
      console.log('[ChatContext] Loaded conversations:', convList);
      setConversations(convList);

      const timestamps = {};
      convList.forEach((conv) => {
        timestamps[conv.id] = conv.lastMessageAt || conv.createdAt;
      });
      setConversationTimestamps(timestamps);

      setLastSyncTimestamp(new Date().toISOString());

      for (const conv of convList) {
        if (conv.lastMessageId) {
          await loadMessages(conv.id);
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load conversations. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  // Level 3: Depends on Level 2 functions
  const loadOpenChat = useCallback(async () => {
    try {
      const response = await api.conversations.getOpen();
      const openChatId = response.data.data.id;

      if (!conversationsRef.current.find((c) => c.id === openChatId)) {
        await loadConversations();
      }
    } catch (error) {
      console.error('Failed to load open chat:', error);
    }
  }, [loadConversations]);

  const createConversation = useCallback(async (type, participantIds, name = null) => {
    try {
      const data = { type, participantIds };
      if (name) {
        data.name = name;
      }

      console.log('[ChatContext] Creating conversation:', data);
      const response = await api.conversations.create(data);
      const newConvId = response.data.data.id;

      if (response.data.existed) {
        return newConvId;
      }

      await loadConversations();
      return newConvId;
    } catch (error) {
      console.error('[ChatContext] Failed to create conversation:', error);
      console.error('[ChatContext] Request data was:', { type, participantIds, name });
      if (error.response?.data) {
        console.error('[ChatContext] API error response:', error.response.data);
      }
      toast.error('Failed to create conversation. Please try again.');
      throw error;
    }
  }, [loadConversations]);

  // Sync chat (needs to be before sendMessage)
  const syncChat = useCallback(async () => {
    if (!isAuthenticated || syncInProgressRef.current) return;

    syncInProgressRef.current = true;

    try {
      const presenceUserIds = conversationsRef.current
        .filter((conv) => conv.type === 'direct')
        .flatMap((conv) => {
          const participants = conv.participants || [];
          return participants.map((p) => p.userId);
        })
        .filter((id) => id !== currentUser?.id);

      const syncData = {};

      if (lastSyncTimestamp) {
        syncData.lastSync = lastSyncTimestamp;
      }

      if (activeConversationId) {
        syncData.activeConversationId = activeConversationId;
      }

      const timestamps = conversationTimestampsRef.current;
      if (timestamps && Object.keys(timestamps).length > 0) {
        syncData.conversationTimestamps = timestamps;
      }

      const uniquePresenceIds = [...new Set(presenceUserIds)].filter(Boolean).slice(0, 50);
      if (uniquePresenceIds.length > 0) {
        syncData.presenceUserIds = uniquePresenceIds;
      }

      const response = await api.chat.sync(syncData);
      const data = response.data.data;

      if (data.conversations && data.conversations.length > 0) {
        startTransition(() => {
          setConversations((prev) => {
          let hasChanges = false;
          const updated = [...prev];

          data.conversations.forEach((newConv) => {
            const index = updated.findIndex((c) => c.id === newConv.id);
            if (index >= 0) {
              const existing = updated[index];
              const isChanged = !shallowEqual(existing, newConv);
              if (isChanged) {
                updated[index] = { ...existing, ...newConv };
                hasChanges = true;
              }
            } else {
              updated.push(newConv);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            updated.sort((a, b) => {
              const aTime = a.lastMessageAt || a.createdAt;
              const bTime = b.lastMessageAt || b.createdAt;
              if (!aTime) return 1;
              if (!bTime) return -1;
              return new Date(bTime) - new Date(aTime);
            });
          }

          return hasChanges ? updated : prev;
          });
        });
      }

      if (data.messages && Object.keys(data.messages).length > 0) {
        startTransition(() => {
          setMessages((prev) => {
          let hasChanges = false;
          const updated = { ...prev };
          const timestampUpdates = {};

          Object.keys(data.messages).forEach((convId) => {
            const newMessages = data.messages[convId];

            if (!updated[convId]) {
              updated[convId] = newMessages;
              hasChanges = true;
            } else {
              const existingIds = new Set(updated[convId].map((m) => m.id));
              const toAdd = newMessages.filter((m) => !existingIds.has(m.id));

              if (toAdd.length > 0) {
                const merged = [...updated[convId], ...toAdd].sort(
                  (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
                );

                if (!messagesEqual(updated[convId], merged)) {
                  updated[convId] = merged;
                  hasChanges = true;
                }
              }
            }

            if (newMessages.length > 0) {
              const lastMsg = newMessages[newMessages.length - 1];
              timestampUpdates[convId] = lastMsg.timestamp;
            }
          });

          if (Object.keys(timestampUpdates).length > 0) {
            queueMicrotask(() => {
              setConversationTimestamps((prev) => {
                const needsUpdate = Object.keys(timestampUpdates).some(
                  (key) => prev[key] !== timestampUpdates[key]
                );
                return needsUpdate ? { ...prev, ...timestampUpdates } : prev;
              });
            });
          }

          if (!hasChanges && Object.keys(data.messages).length > 0) {
            console.debug('[ChatContext] No message changes detected, returning same reference');
          }
          return hasChanges ? updated : prev;
          });
        });
      }

      if (data.presence && Object.keys(data.presence).length > 0) {
        startTransition(() => {
          setPresence((prev) => {
          let hasChanges = false;
          const updated = { ...prev };

          Object.keys(data.presence).forEach((userId) => {
            const newPresence = data.presence[userId];
            const oldPresence = prev[userId];

            if (!oldPresence ||
                oldPresence.isOnline !== newPresence.isOnline ||
                oldPresence.lastSeen !== newPresence.lastSeen) {
              updated[userId] = newPresence;
              hasChanges = true;
            }
          });

          return hasChanges ? updated : prev;
          });
        });
      }

      if (data.syncTimestamp && data.syncTimestamp !== lastSyncTimestamp) {
        setLastSyncTimestamp(data.syncTimestamp);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [isAuthenticated, lastSyncTimestamp, activeConversationId, currentUser?.id]);

  // Level 4: Depends on syncChat
  const sendMessage = useCallback(async (conversationId, content, messageType = 'text', metadata = null) => {
    try {
      setSending(true);

      const tempMessage = {
        id: `temp_${Date.now()}`,
        conversationId,
        senderId: currentUser?.id,
        content,
        messageType,
        metadata,
        timestamp: new Date().toISOString(),
        senderName: currentUser?.name,
        _isPending: true,
      };

      setMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), tempMessage],
      }));

      const payload = { content, messageType };
      if (metadata) {
        payload.metadata = metadata;
      }

      const response = await api.conversations.sendMessage(conversationId, payload);
      const actualMessage = response.data.data;

      if (!actualMessage.metadata && metadata) {
        actualMessage.metadata = metadata;
      }

      setMessages((prev) => ({
        ...prev,
        [conversationId]: prev[conversationId].map((m) => (m.id === tempMessage.id ? actualMessage : m)),
      }));

      setConversations((prev) =>
        prev.map((conv) => (conv.id === conversationId ? { ...conv, lastMessageAt: actualMessage.timestamp } : conv))
      );

      setTimeout(() => syncChat(), 500);
      return actualMessage;
    } catch (error) {
      console.error('Failed to send message:', error);

      setMessages((prev) => ({
        ...prev,
        [conversationId]: prev[conversationId].map((m) =>
          m._isPending ? { ...m, _isPending: false, _failed: true } : m
        ),
      }));

      toast.error('Failed to send message. You can retry.');
      throw error;
    } finally {
      setSending(false);
    }
  }, [currentUser?.id, syncChat]);

  const retrySync = useCallback(() => {
    failureCountRef.current = 0;
    setSyncError(null);
    syncChat();
  }, [syncChat]);

  // Polling functions (plain functions that reference syncChat)
  const startPolling = useCallback(() => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    pollChat();
  }, []); // Will be called from useEffect with pollChat defined inline

  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const pollChat = useCallback(async () => {
    if (!isPollingRef.current) return;

    try {
      await syncChat();
      failureCountRef.current = 0;
      setSyncError(null);
    } catch (error) {
      console.error('Polling error:', error);
      failureCountRef.current++;

      if (failureCountRef.current === 1 || failureCountRef.current % 5 === 0) {
        setSyncError(`Connection issue. Retrying... (${failureCountRef.current})`);

        setTimeout(() => {
          setSyncError(null);
        }, 3000);
      }

      if (failureCountRef.current > 3) {
        const backoffInterval = Math.min(60000, 5000 * Math.pow(2, failureCountRef.current - 3));
        console.warn(`[Chat] Backing off for ${backoffInterval}ms after ${failureCountRef.current} failures`);
        pollingTimeoutRef.current = setTimeout(pollChat, backoffInterval);
        return;
      }
    }

    pollingTimeoutRef.current = setTimeout(pollChat, pollingInterval);
  }, [syncChat, pollingInterval]);

  // ============================================================================
  // USE EFFECTS (After all functions are defined)
  // ============================================================================

  // Keep refs in sync with state
  useEffect(() => {
    conversationTimestampsRef.current = conversationTimestamps;
  }, [conversationTimestamps]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    loadConversations();
    loadOpenChat();
  }, [isAuthenticated, loadConversations, loadOpenChat]);

  // Polling setup
  useEffect(() => {
    if (!isAuthenticated) return;

    startPolling();

    return () => {
      stopPolling();
    };
  }, [isAuthenticated, pollingInterval, startPolling, stopPolling]);

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      tabVisibleRef.current = !document.hidden;

      if (document.hidden) {
        setPollingInterval(PollingState.HIDDEN);
      } else {
        if (activeConversationId) {
          setPollingInterval(PollingState.ACTIVE_CONVERSATION);
        } else {
          setPollingInterval(PollingState.BACKGROUND_MONITORING);
        }
        syncChat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeConversationId, syncChat]);

  // Adaptive polling interval
  useEffect(() => {
    if (!tabVisibleRef.current) return;

    if (activeConversationId) {
      setPollingInterval(PollingState.ACTIVE_CONVERSATION);
    } else {
      setPollingInterval(PollingState.BACKGROUND_MONITORING);
    }
  }, [activeConversationId]);

  // Send heartbeat every 2 minutes
  useEffect(() => {
    if (!isAuthenticated) return;

    sendHeartbeat();

    const heartbeatInterval = setInterval(sendHeartbeat, 120000);

    return () => clearInterval(heartbeatInterval);
  }, [isAuthenticated, sendHeartbeat]);

  // ============================================================================
  // CONTEXT VALUE (Memoized)
  // ============================================================================

  const value = useMemo(() => ({
    conversations,
    messages,
    activeConversationId,
    presence,
    loading,
    sending,
    syncError,
    createConversation,
    loadConversations,
    getConversation,
    setActiveConversationId,
    loadMessages,
    sendMessage,
    markAsRead,
    getMessages,
    isUserOnline,
    getUserLastSeen,
    getTotalUnreadCount,
    syncChat,
    retrySync,
  }), [
    conversations,
    messages,
    activeConversationId,
    presence,
    loading,
    sending,
    syncError,
    createConversation,
    loadConversations,
    getConversation,
    loadMessages,
    sendMessage,
    markAsRead,
    getMessages,
    isUserOnline,
    getUserLastSeen,
    getTotalUnreadCount,
    syncChat,
    retrySync,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
