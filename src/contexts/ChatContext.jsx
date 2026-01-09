/**
 * Chat Context - OPTIMIZED VERSION
 * Manages real-time chat state with smart polling
 * Handles conversations, messages, and presence tracking
 *
 * KEY FIXES:
 * - Deep message comparison to prevent unnecessary re-renders
 * - Non-intrusive presence updates (only when changed)
 * - Better error handling with retry logic
 * - Optimized state updates to prevent input field clearing
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback, startTransition } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api-client';
import toast from 'react-hot-toast';

const ChatContext = createContext(null);

// ============================================================================
// POLLING STATE MACHINE
// ============================================================================

const PollingState = {
  ACTIVE_CONVERSATION: 5000, // 5s - Balanced real-time feel without constant flickering
  BACKGROUND_MONITORING: 10000, // 10s - Check for new messages/conversations
  IDLE: 15000, // 15s - Reduced load when chat page open but inactive
  HIDDEN: 30000, // 30s - Battery-efficient when tab hidden
  OFFLINE: 60000, // 60s - Slowest when network issues detected
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Shallow equality check - more efficient than JSON.stringify
const shallowEqual = (obj1, obj2) => {
  if (!obj1 || !obj2) return obj1 === obj2;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every((key) => obj1[key] === obj2[key]);
};

// Deep equality check for messages arrays
const messagesEqual = (arr1, arr2) => {
  if (!arr1 || !arr2) return arr1 === arr2;
  if (arr1.length !== arr2.length) return false;

  // Compare last 5 messages deeply (most likely to change)
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
  // STATE MANAGEMENT
  // ============================================================================
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({}); // { conversationId: [messages] }
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [presence, setPresence] = useState({}); // { userId: { isOnline, lastSeen } }
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [syncError, setSyncError] = useState(null);

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
  const retryTimeoutRef = useRef(null);

  // Refs for stable dependencies (prevent syncChat recreation)
  const conversationTimestampsRef = useRef(conversationTimestamps);
  const conversationsRef = useRef(conversations);
  const messagesRef = useRef(messages);

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
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const pollChat = async () => {
    if (!isPollingRef.current) return;

    try {
      await syncChat();
      failureCountRef.current = 0; // Reset on success
      setSyncError(null); // Clear any previous errors
    } catch (error) {
      console.error('Polling error:', error);
      failureCountRef.current++;

      // Show error toast only on first failure or every 5 failures
      if (failureCountRef.current === 1 || failureCountRef.current % 5 === 0) {
        setSyncError(`Connection issue. Retrying... (${failureCountRef.current})`);

        // Auto-dismiss error toast after 3 seconds
        setTimeout(() => {
          setSyncError(null);
        }, 3000);
      }

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
  // BATCHED SYNC FUNCTION (Core of Smart Polling) - OPTIMIZED
  // ============================================================================

  const syncChat = useCallback(async () => {
    if (!isAuthenticated || syncInProgressRef.current) return;

    syncInProgressRef.current = true;

    try {
      // Collect presence user IDs from DMs (use ref to avoid dependency)
      const presenceUserIds = conversationsRef.current
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

      // Use ref to avoid dependency
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

      // Update conversations - wrap in startTransition for non-urgent updates
      if (data.conversations && data.conversations.length > 0) {
        startTransition(() => {
          setConversations((prev) => {
          let hasChanges = false;
          const updated = [...prev];

          data.conversations.forEach((newConv) => {
            const index = updated.findIndex((c) => c.id === newConv.id);
            if (index >= 0) {
              // Check if conversation actually changed
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

          // Only sort if changes were made
          if (hasChanges) {
            updated.sort((a, b) => {
              const aTime = a.lastMessageAt || a.createdAt;
              const bTime = b.lastMessageAt || b.createdAt;
              if (!aTime) return 1;
              if (!bTime) return -1;
              return new Date(bTime) - new Date(aTime);
            });
          }

          // CRITICAL: Return same reference if nothing changed
          return hasChanges ? updated : prev;
          });
        });
      }

      // Update messages - wrap in startTransition with DEEP comparison
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
              // Merge new messages, avoid duplicates
              const existingIds = new Set(updated[convId].map((m) => m.id));
              const toAdd = newMessages.filter((m) => !existingIds.has(m.id));

              // Only update array if there are new messages to add
              if (toAdd.length > 0) {
                const merged = [...updated[convId], ...toAdd].sort(
                  (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
                );

                // Deep comparison - only update if messages actually changed
                if (!messagesEqual(updated[convId], merged)) {
                  updated[convId] = merged;
                  hasChanges = true;
                }
              }
            }

            // Collect timestamp updates
            if (newMessages.length > 0) {
              const lastMsg = newMessages[newMessages.length - 1];
              timestampUpdates[convId] = lastMsg.timestamp;
            }
          });

          // Batch timestamp update AFTER messages using queueMicrotask
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

          // CRITICAL: Only return new object if something actually changed
          if (!hasChanges && Object.keys(data.messages).length > 0) {
            console.debug('[ChatContext] No message changes detected, returning same reference');
          }
          return hasChanges ? updated : prev;
          });
        });
      }

      // Update presence - wrap in startTransition with SMART comparison
      // ONLY update if presence actually changed (non-intrusive)
      if (data.presence && Object.keys(data.presence).length > 0) {
        startTransition(() => {
          setPresence((prev) => {
          let hasChanges = false;
          const updated = { ...prev };

          Object.keys(data.presence).forEach((userId) => {
            const newPresence = data.presence[userId];
            const oldPresence = prev[userId];

            // Deep comparison for presence objects
            if (!oldPresence ||
                oldPresence.isOnline !== newPresence.isOnline ||
                oldPresence.lastSeen !== newPresence.lastSeen) {
              updated[userId] = newPresence;
              hasChanges = true;
            }
          });

          // CRITICAL: Only return new object if something changed
          return hasChanges ? updated : prev;
          });
        });
      }

      // Update sync timestamp only if it actually changed
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

  // ============================================================================
  // CONVERSATION MANAGEMENT
  // ============================================================================

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await api.conversations.list();
      const convList = response.data.data || [];
      console.log('[ChatContext] Loaded conversations:', convList);
      setConversations(convList);

      // Initialize conversation timestamps
      const timestamps = {};
      convList.forEach((conv) => {
        timestamps[conv.id] = conv.lastMessageAt || conv.createdAt;
      });
      setConversationTimestamps(timestamps);

      setLastSyncTimestamp(new Date().toISOString());

      // Auto-load messages for all conversations with data
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
  };

  const createConversation = async (type, participantIds, name = null) => {
    try {
      const data = {
        type,
        participantIds,
      };

      // Only include name if it's provided (for groups)
      if (name) {
        data.name = name;
      }

      console.log('[ChatContext] Creating conversation:', data);
      const response = await api.conversations.create(data);

      const newConvId = response.data.data.id;

      // If conversation existed, just return it
      if (response.data.existed) {
        return newConvId;
      }

      // Reload conversations to get new one
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

  const getConversation = useCallback((conversationId) => {
    return conversations.find((c) => c.id === conversationId);
  }, [conversations]);

  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================

  const loadMessages = async (conversationId, options = {}) => {
    try {
      const response = await api.conversations.getMessages(conversationId, options);
      const msgs = response.data.data || [];
      console.log(`[ChatContext] Loaded ${msgs.length} messages for conversation ${conversationId}:`, msgs);

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
      toast.error('Failed to load messages. Please try again.');
      return [];
    }
  };

  const sendMessage = async (conversationId, content, messageType = 'text', metadata = null) => {
    try {
      setSending(true);

      // Optimistic update - show message immediately
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

      // Send to API - only include metadata if it exists
      const payload = {
        content,
        messageType,
      };

      if (metadata) {
        payload.metadata = metadata;
      }

      const response = await api.conversations.sendMessage(conversationId, payload);

      const actualMessage = response.data.data;

      // Ensure metadata is preserved (in case API doesn't return it)
      if (!actualMessage.metadata && metadata) {
        actualMessage.metadata = metadata;
      }

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

      // Mark message as failed instead of removing
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
  };

  const markAsRead = useCallback(async (conversationId) => {
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
      // Don't show error toast for this - it's not critical
    }
  }, []); // Empty deps - uses setState updater, all values stable

  const getMessages = useCallback((conversationId) => {
    return messages[conversationId] || [];
  }, [messages]);

  // ============================================================================
  // PRESENCE MANAGEMENT - NON-INTRUSIVE
  // ============================================================================

  const sendHeartbeat = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      await api.presence.heartbeat();
    } catch (error) {
      console.error('Heartbeat failed:', error);
      // Don't show error - heartbeat is not critical
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

  const isUserOnline = useCallback((userId) => {
    return presence[userId]?.isOnline || false;
  }, [presence]);

  const getUserLastSeen = useCallback((userId) => {
    return presence[userId]?.lastSeen || null;
  }, [presence]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
  }, [conversations]);

  // Manual retry for failed syncs
  const retrySync = useCallback(() => {
    failureCountRef.current = 0; // Reset failure count
    setSyncError(null);
    syncChat();
  }, [syncChat]);

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
    syncError,

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
    retrySync, // Manual retry
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
