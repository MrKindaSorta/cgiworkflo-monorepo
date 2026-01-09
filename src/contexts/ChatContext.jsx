/**
 * Chat Context - WebSocket Real-Time Implementation
 * Manages real-time chat state with WebSocket connections via Durable Objects
 *
 * STRUCTURE:
 * 1. State declarations
 * 2. Refs
 * 3. WebSocket management functions
 * 4. ALL callback functions (in dependency order)
 * 5. ALL useEffects
 * 6. Memoized context value
 * 7. Return
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api-client';
import toast from 'react-hot-toast';

const ChatContext = createContext(null);

// ============================================================================
// WEBSOCKET CONFIGURATION
// ============================================================================

// Detect mobile browser
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// FIXED: WebSocket URL includes /api prefix to match backend route registration
const WS_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/^https?:/, 'wss:') || 'wss://cgiworkflo-api.joshua-r-klimek.workers.dev/api';
const WS_RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000, 60000]; // Exponential backoff (added 60s for mobile)
const WS_PING_INTERVAL = isMobile() ? 15000 : 30000; // 15s on mobile, 30s desktop
const WS_MAX_QUEUE_SIZE = 100; // Max queued messages when offline

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
  const [typingUsers, setTypingUsers] = useState({}); // { conversationId: [{ userId, userName }] }
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState(null);
  const [isPolling, setIsPolling] = useState(false); // ADDED: Polling fallback state

  // ============================================================================
  // REFS
  // ============================================================================
  const wsRef = useRef(null); // WebSocket connection
  const wsReconnectAttemptsRef = useRef(0);
  const wsReconnectTimeoutRef = useRef(null);
  const wsPingIntervalRef = useRef(null);
  const messageQueueRef = useRef([]); // Queue messages when offline
  const conversationsRef = useRef(conversations);
  const messagesRef = useRef(messages);
  const activeConversationIdRef = useRef(activeConversationId);
  const sendWebSocketMessageRef = useRef(null); // Stable reference for WebSocket send
  const tempIdToServerIdMapRef = useRef(new Map()); // ADDED: Track tempId → serverId mappings for deduplication
  const pollingIntervalRef = useRef(null); // ADDED: Polling interval ID
  const lastSyncTimestampRef = useRef(null); // ADDED: Last sync timestamp for differential updates

  // ============================================================================
  // WEBSOCKET FUNCTIONS (Defined first, no dependencies)
  // ============================================================================

  /**
   * Connect to global WebSocket for all conversations
   * SECURITY: Uses short-lived auth code instead of JWT token in URL
   */
  const connectWebSocket = useCallback(async () => {
    if (!isAuthenticated || !currentUser) {
      console.log('[ChatContext] Cannot connect WS: not authenticated');
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      console.log('[ChatContext] Closing existing WebSocket connection');
      wsRef.current.close(1000, 'Reconnecting');
      wsRef.current = null;
    }

    try {
      // SECURITY FIX: Get short-lived auth code instead of using JWT in URL
      console.log('[ChatContext] Requesting WebSocket auth code');
      const authCodeResponse = await api.websocket.getAuthCode();
      const authCode = authCodeResponse.data.data.code;

      if (!authCode) {
        throw new Error('Failed to obtain WebSocket auth code');
      }

      const wsUrl = `${WS_BASE_URL}/ws/user?code=${encodeURIComponent(authCode)}`;
      console.log('[ChatContext] Connecting to global WebSocket (secure)');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[ChatContext] WebSocket connected');
        setWsConnected(true);
        setWsError(null);
        wsReconnectAttemptsRef.current = 0;

        // Start ping interval
        if (wsPingIntervalRef.current) {
          clearInterval(wsPingIntervalRef.current);
        }
        wsPingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, WS_PING_INTERVAL);

        // Send queued messages
        if (messageQueueRef.current.length > 0) {
          console.log(`[ChatContext] Sending ${messageQueueRef.current.length} queued messages`);
          messageQueueRef.current.forEach((msg) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(msg));
            }
          });
          messageQueueRef.current = [];
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('[ChatContext] Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[ChatContext] WebSocket error:', error);
        setWsError('Connection error');
      };

      ws.onclose = (event) => {
        console.log(`[ChatContext] WebSocket closed: code=${event.code}, reason=${event.reason}`);
        setWsConnected(false);

        // Clear ping interval
        if (wsPingIntervalRef.current) {
          clearInterval(wsPingIntervalRef.current);
          wsPingIntervalRef.current = null;
        }

        // Attempt reconnect if not a clean close
        if (event.code !== 1000 && isAuthenticated) {
          const delay = WS_RECONNECT_DELAYS[Math.min(wsReconnectAttemptsRef.current, WS_RECONNECT_DELAYS.length - 1)];
          console.log(`[ChatContext] Reconnecting in ${delay}ms (attempt ${wsReconnectAttemptsRef.current + 1})`);

          wsReconnectTimeoutRef.current = setTimeout(() => {
            wsReconnectAttemptsRef.current++;
            connectWebSocket();
          }, delay);
        }
      };
    } catch (error) {
      console.error('[ChatContext] Error creating WebSocket:', error);

      // Provide specific error message for auth code failures
      if (error.response?.status === 401) {
        setWsError('Authentication failed');
        console.log('[ChatContext] Auth code rejected - user may need to re-login');
      } else if (error.message?.includes('auth code')) {
        setWsError('Failed to obtain connection credentials');
      } else {
        setWsError('Failed to connect');
      }

      // Trigger reconnect attempt for transient failures
      if (isAuthenticated && wsReconnectAttemptsRef.current < WS_RECONNECT_DELAYS.length) {
        const delay = WS_RECONNECT_DELAYS[Math.min(wsReconnectAttemptsRef.current, WS_RECONNECT_DELAYS.length - 1)];
        console.log(`[ChatContext] Retrying connection in ${delay}ms (attempt ${wsReconnectAttemptsRef.current + 1})`);

        wsReconnectTimeoutRef.current = setTimeout(() => {
          wsReconnectAttemptsRef.current++;
          connectWebSocket();
        }, delay);
      }
    }
  }, [isAuthenticated, currentUser]);

  /**
   * Disconnect WebSocket
   */
  const disconnectWebSocket = useCallback(() => {
    console.log('[ChatContext] Disconnecting WebSocket');

    // Clear reconnect timeout
    if (wsReconnectTimeoutRef.current) {
      clearTimeout(wsReconnectTimeoutRef.current);
      wsReconnectTimeoutRef.current = null;
    }

    // Clear ping interval
    if (wsPingIntervalRef.current) {
      clearInterval(wsPingIntervalRef.current);
      wsPingIntervalRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, 'User closed connection');
      wsRef.current = null;
    }

    setWsConnected(false);
  }, []);

  /**
   * Poll chat sync API (fallback when WebSocket unavailable)
   * ADDED: HTTP polling fallback for production reliability
   */
  const pollChatSync = useCallback(async () => {
    if (!isAuthenticated || wsConnected) {
      return; // Skip if WebSocket is connected
    }

    try {
      // Build conversation timestamps for differential sync
      const conversationTimestamps = {};
      Object.keys(messagesRef.current).forEach(convId => {
        const msgs = messagesRef.current[convId];
        if (msgs.length > 0) {
          conversationTimestamps[convId] = msgs[msgs.length - 1].timestamp;
        }
      });

      // Get presence for visible users
      const presenceUserIds = [];
      conversationsRef.current.forEach(conv => {
        conv.participants?.forEach(p => {
          if (!presenceUserIds.includes(p.userId)) {
            presenceUserIds.push(p.userId);
          }
        });
      });

      const response = await api.chat.sync({
        lastSync: lastSyncTimestampRef.current,
        activeConversationId: activeConversationIdRef.current,
        conversationTimestamps,
        presenceUserIds: presenceUserIds.slice(0, 50), // Limit to 50
      });

      const {
        conversations: updatedConvs,
        messages: newMessages,
        presence: presenceUpdate,
        syncTimestamp,
      } = response.data.data;

      // Update conversations if any changed
      if (updatedConvs && updatedConvs.length > 0) {
        setConversations(prev => {
          const merged = [...prev];
          updatedConvs.forEach(updated => {
            const idx = merged.findIndex(c => c.id === updated.id);
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...updated };
            } else {
              merged.push(updated);
            }
          });
          return merged;
        });
      }

      // Update messages if any new ones
      if (newMessages && Object.keys(newMessages).length > 0) {
        setMessages(prev => {
          const updated = { ...prev };
          Object.entries(newMessages).forEach(([convId, msgs]) => {
            updated[convId] = [
              ...(prev[convId] || []),
              ...msgs,
            ];
          });
          return updated;
        });
      }

      // Update presence
      if (presenceUpdate && Object.keys(presenceUpdate).length > 0) {
        setPresence(prev => ({ ...prev, ...presenceUpdate }));
      }

      lastSyncTimestampRef.current = syncTimestamp;
    } catch (error) {
      console.error('[ChatContext] Polling error:', error);
      // Don't show error toast - polling errors are expected during network issues
    }
  }, [isAuthenticated, wsConnected]);

  /**
   * Send message via WebSocket (STABLE - uses ref pattern)
   */
  const sendWebSocketMessage = useCallback((message) => {
    sendWebSocketMessageRef.current?.(message);
  }, []); // TRULY stable - never changes

  // Initialize sendWebSocketMessageRef.current ONCE
  useEffect(() => {
    sendWebSocketMessageRef.current = (message) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        // Queue message if offline
        const currentQueueSize = messageQueueRef.current.length;

        if (currentQueueSize < WS_MAX_QUEUE_SIZE) {
          messageQueueRef.current.push(message);
          console.log(`[ChatContext] Message queued (offline), queue size: ${currentQueueSize + 1}/${WS_MAX_QUEUE_SIZE}`);

          // ADDED: Warn at 80% capacity
          const warningThreshold = Math.floor(WS_MAX_QUEUE_SIZE * 0.8);
          if (currentQueueSize >= warningThreshold && currentQueueSize < WS_MAX_QUEUE_SIZE - 1) {
            toast.warning(
              `Message queue filling up (${currentQueueSize + 1}/${WS_MAX_QUEUE_SIZE}). Connection issue?`,
              { duration: 5000 }
            );
          }
        } else {
          // Queue full - show actionable error
          console.error('[ChatContext] Message queue full, dropping message:', message);
          toast.error(
            <div>
              <p className="font-bold">Queue full - message not sent</p>
              <p className="text-sm mt-1">Check your connection or refresh the page</p>
            </div>,
            { duration: 10000 }
          );
        }
      }
    };
  }, []); // Only runs once

  /**
   * Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = useCallback((data) => {
    const { type, payload } = data;

    console.log(`[ChatContext] Received WS message: ${type}`, payload);

    switch (type) {
      case 'connected':
        console.log('[ChatContext] Connected to conversation:', payload.conversationId);
        break;

      case 'message':
        handleNewMessage(payload);
        break;

      case 'typing':
        handleTypingIndicator(payload);
        break;

      case 'presence':
        handlePresenceUpdate(payload);
        break;

      case 'read':
        handleReadReceipt(payload);
        break;

      case 'participant_joined':
      case 'participant_left':
        handleParticipantChange(payload, type);
        break;

      case 'pong':
        // Keepalive response
        break;

      case 'error':
        console.error('[ChatContext] Server error:', payload);
        toast.error(payload.message || 'An error occurred');
        break;

      default:
        console.warn('[ChatContext] Unknown message type:', type);
    }
  }, []);

  /**
   * Handle new message from WebSocket
   * FIXED: Added tempId Map for better deduplication and race condition handling
   */
  const handleNewMessage = useCallback((payload) => {
    const { conversationId, tempId, id: serverId } = payload;

    startTransition(() => {
      setMessages((prev) => {
        const convMessages = prev[conversationId] || [];

        // Track tempId → serverId mapping for deduplication
        if (tempId && serverId) {
          tempIdToServerIdMapRef.current.set(tempId, serverId);
        }

        // STEP 1: Check for duplicates by serverId FIRST (most important)
        const existsByServerId = convMessages.some((m) => m.id === serverId);
        if (existsByServerId) {
          return prev; // Already have this message
        }

        // STEP 2: Replace optimistic message if tempId exists
        if (tempId) {
          const tempIndex = convMessages.findIndex((m) => m.id === tempId);
          if (tempIndex >= 0) {
            // Found optimistic message - replace it
            const updated = [...convMessages];
            updated[tempIndex] = payload;
            return { ...prev, [conversationId]: updated };
          }

          // STEP 3: Check if tempId was already replaced (race condition)
          const mappedServerId = tempIdToServerIdMapRef.current.get(tempId);
          if (mappedServerId && mappedServerId === serverId) {
            // This message already replaced the optimistic one - don't add again
            console.log(`[ChatContext] Prevented duplicate: tempId ${tempId} already mapped to ${serverId}`);
            return prev;
          }

          // Optimistic message not found - it might have been cleared or never existed
          console.warn(
            `[ChatContext] tempId ${tempId} not found in conversation ${conversationId}. Adding as new message.`
          );
        }

        // STEP 4: Add as new message
        return {
          ...prev,
          [conversationId]: [...convMessages, payload],
        };
      });

      // Update conversation's lastMessageAt (only if changed)
      setConversations((prev) => {
        const index = prev.findIndex(c => c.id === conversationId);
        if (index === -1) return prev;

        const current = prev[index];
        if (current.lastMessageAt === payload.timestamp) {
          return prev; // No change, return same reference
        }

        // Only create new array when actually changing
        const updated = [...prev];
        updated[index] = { ...current, lastMessageAt: payload.timestamp };
        return updated;
      });

      // ADDED: Update sender's presence (implicit online status from message activity)
      if (payload.senderId && payload.senderId !== currentUser?.id) {
        setPresence(prev => ({
          ...prev,
          [payload.senderId]: {
            isOnline: true,
            lastSeen: new Date().toISOString(),
          },
        }));
      }
    });
  }, [currentUser?.id]);

  /**
   * Handle typing indicator
   * FIXED: Now processes typing for ALL conversations, not just active one
   */
  const handleTypingIndicator = useCallback((payload) => {
    const { userId, userName, isTyping, conversationId } = payload;

    // FIXED: Get conversationId from payload, not from active conversation ref
    if (!conversationId) {
      console.warn('[ChatContext] Typing indicator missing conversationId');
      return;
    }

    setTypingUsers((prev) => {
      const convTyping = prev[conversationId] || [];

      if (isTyping) {
        // Add user if not already in list
        const exists = convTyping.some((u) => u.userId === userId);
        if (!exists) {
          return {
            ...prev,
            [conversationId]: [...convTyping, { userId, userName }],
          };
        }
      } else {
        // Remove user from list
        const filtered = convTyping.filter((u) => u.userId !== userId);
        if (filtered.length !== convTyping.length) {
          return {
            ...prev,
            [conversationId]: filtered,
          };
        }
      }

      return prev;
    });
  }, []);

  /**
   * Handle presence update
   */
  const handlePresenceUpdate = useCallback((payload) => {
    const { userId, status, timestamp } = payload;

    setPresence((prev) => ({
      ...prev,
      [userId]: {
        isOnline: status === 'online',
        lastSeen: timestamp,
      },
    }));
  }, []);

  /**
   * Handle read receipt
   * OPTIMIZED: O(n) lookup using conversationId instead of O(n*m) search
   */
  const handleReadReceipt = useCallback((payload) => {
    const { messageId, userId, readAt, conversationId } = payload;

    // FIXED: Get conversationId from payload for targeted lookup
    if (!conversationId) {
      console.warn('[ChatContext] Read receipt missing conversationId, falling back to slow search');
      // Fallback to old behavior if conversationId not provided (backward compatibility)
      setMessages((prev) => {
        let updated = false;
        const newMessages = { ...prev };

        Object.keys(newMessages).forEach((convId) => {
          const msgIndex = newMessages[convId].findIndex((m) => m.id === messageId);
          if (msgIndex >= 0) {
            const msg = newMessages[convId][msgIndex];
            const readBy = msg.read_by ? JSON.parse(msg.read_by) : [];

            if (!readBy.some((r) => r.userId === userId)) {
              readBy.push({ userId, readAt });
              newMessages[convId] = [...newMessages[convId]];
              newMessages[convId][msgIndex] = {
                ...msg,
                read_by: JSON.stringify(readBy),
              };
              updated = true;
            }
          }
        });

        return updated ? newMessages : prev;
      });
      return;
    }

    // OPTIMIZED: Direct conversation lookup - O(n) instead of O(n*m)
    setMessages((prev) => {
      const convMessages = prev[conversationId];
      if (!convMessages) return prev;

      const msgIndex = convMessages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return prev;

      const msg = convMessages[msgIndex];
      const readBy = msg.read_by ? JSON.parse(msg.read_by) : [];

      // Check if already read by this user
      if (readBy.some((r) => r.userId === userId)) {
        return prev; // No change needed
      }

      // Add read receipt
      readBy.push({ userId, readAt });
      const updatedMessages = [...convMessages];
      updatedMessages[msgIndex] = {
        ...msg,
        read_by: JSON.stringify(readBy),
      };

      return {
        ...prev,
        [conversationId]: updatedMessages,
      };
    });
  }, []);

  /**
   * Handle participant joined/left
   */
  const handleParticipantChange = useCallback((payload, type) => {
    const { userId, userName, timestamp } = payload;
    const conversationId = activeConversationIdRef.current;

    console.log(`[ChatContext] Participant ${type === 'participant_joined' ? 'joined' : 'left'}:`, userName);

    // Optionally, add a system message
    // This could be done on the backend instead
  }, []);

  // ============================================================================
  // CALLBACK FUNCTIONS (Defined in dependency order)
  // ============================================================================

  const loadMessages = useCallback(async (conversationId, options = {}) => {
    try {
      const response = await api.conversations.getMessages(conversationId, options);
      const msgs = response.data.data || [];
      console.log(`[ChatContext] Loaded ${msgs.length} messages for conversation ${conversationId}`);

      setMessages((prev) => ({
        ...prev,
        [conversationId]: msgs,
      }));

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

      // Send read receipt via WebSocket for last message
      const convMessages = messages[conversationId];
      if (convMessages && convMessages.length > 0) {
        const lastMessage = convMessages[convMessages.length - 1];
        sendWebSocketMessage({
          type: 'read',
          payload: { messageId: lastMessage.id },
        });
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [messages, sendWebSocketMessage]);

  const isUserOnline = useCallback((userId) => {
    return presence[userId]?.isOnline || false;
  }, [presence]);

  const getUserLastSeen = useCallback((userId) => {
    return presence[userId]?.lastSeen || null;
  }, [presence]);

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
  }, [conversations]);

  const getTypingUsers = useCallback((conversationId) => {
    return typingUsers[conversationId] || [];
  }, [typingUsers]);

  // Utility: Check if conversations have actually changed
  const conversationsEqual = useCallback((arr1, arr2) => {
    if (!arr1 || !arr2) return arr1 === arr2;
    if (arr1.length !== arr2.length) return false;

    for (let i = 0; i < arr1.length; i++) {
      const c1 = arr1[i];
      const c2 = arr2[i];

      if (c1.id !== c2.id ||
          c1.lastMessageAt !== c2.lastMessageAt ||
          c1.unreadCount !== c2.unreadCount ||
          c1.updatedAt !== c2.updatedAt) {
        return false;
      }
    }
    return true;
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.conversations.list();
      const convList = response.data.data || [];
      console.log('[ChatContext] Loaded conversations:', convList);

      // ONLY update if data actually changed (prevents unnecessary re-renders)
      setConversations(prev => {
        if (conversationsEqual(prev, convList)) {
          console.debug('[ChatContext] Conversations unchanged, skipping update');
          return prev; // Same reference = no re-render
        }
        return convList;
      });

      // Load messages for each conversation (initial load)
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
  }, [loadMessages, conversationsEqual]);

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
      toast.error('Failed to create conversation. Please try again.');
      throw error;
    }
  }, [loadConversations]);

  const sendMessage = useCallback(async (conversationId, content, messageType = 'text', metadata = null) => {
    try {
      setSending(true);

      const tempId = `temp_${Date.now()}`;
      const tempMessage = {
        id: tempId,
        conversationId,
        senderId: currentUser?.id,
        content,
        messageType,
        metadata,
        timestamp: new Date().toISOString(),
        senderName: currentUser?.name,
        _isPending: true,
      };

      // Add optimistic message
      setMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), tempMessage],
      }));

      // Send via global WebSocket with conversationId
      sendWebSocketMessage({
        type: 'message',
        conversationId, // Include conversationId for global WebSocket
        payload: {
          content,
          messageType,
          metadata,
          tempId,
        },
      });

      return tempMessage;
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
  }, [currentUser?.id, currentUser?.name, sendWebSocketMessage]);

  const sendTypingIndicator = useCallback((conversationId, isTyping) => {
    sendWebSocketMessageRef.current?.({  // Use ref directly - STABLE
      type: 'typing',
      conversationId,
      payload: { isTyping },
    });
  }, []); // Empty dependencies - stable forever

  // ============================================================================
  // USE EFFECTS
  // ============================================================================

  // OPTIMIZED: Keep refs in sync with state (consolidated from 3 separate useEffects)
  useEffect(() => {
    conversationsRef.current = conversations;
    messagesRef.current = messages;
    activeConversationIdRef.current = activeConversationId;
  }, [conversations, messages, activeConversationId]);

  // ADDED: Cleanup old tempId mappings to prevent memory bloat
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const fiveMinutesAgo = now - 300000; // 5 minutes

      // Remove tempId mappings older than 5 minutes
      tempIdToServerIdMapRef.current.forEach((serverId, tempId) => {
        // tempId format: temp_TIMESTAMP_randomId
        if (tempId.startsWith('temp_')) {
          const timestampStr = tempId.split('_')[1];
          const timestamp = parseInt(timestampStr, 10);

          if (!isNaN(timestamp) && timestamp < fiveMinutesAgo) {
            tempIdToServerIdMapRef.current.delete(tempId);
          }
        }
      });

      const mapSize = tempIdToServerIdMapRef.current.size;
      if (mapSize > 0) {
        console.log(`[ChatContext] tempId map size: ${mapSize} entries`);
      }
    }, 60000); // Every 60 seconds

    return () => clearInterval(cleanupInterval);
  }, []);

  // ADDED: HTTP Polling Fallback - Start polling if WebSocket fails
  useEffect(() => {
    if (!isAuthenticated) {
      setIsPolling(false);
      return;
    }

    // If WebSocket is connected, stop polling
    if (wsConnected) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        setIsPolling(false);
      }
      return;
    }

    // Wait 30 seconds for WebSocket to connect before starting polling
    const fallbackTimer = setTimeout(() => {
      if (!wsConnected && isAuthenticated) {
        console.log('[ChatContext] WebSocket unavailable, starting polling fallback');
        setIsPolling(true);

        // Poll every 3 seconds
        pollingIntervalRef.current = setInterval(pollChatSync, 3000);

        // Do first poll immediately
        pollChatSync();
      }
    }, 30000); // 30 second delay

    return () => {
      clearTimeout(fallbackTimer);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, wsConnected, pollChatSync]);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    loadConversations();
    loadOpenChat();
  }, [isAuthenticated, loadConversations, loadOpenChat]);

  // Connect global WebSocket once when authenticated
  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      disconnectWebSocket();
      return;
    }

    // Connect to global user WebSocket (receives updates from ALL conversations)
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [isAuthenticated, currentUser, connectWebSocket, disconnectWebSocket]);

  // Handle visibility changes (mobile tab suspension / desktop tab switching)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page went to background
        console.log('[ChatContext] Page hidden, pausing ping to save battery');

        // Stop ping interval to save battery
        if (wsPingIntervalRef.current) {
          clearInterval(wsPingIntervalRef.current);
          wsPingIntervalRef.current = null;
        }
      } else {
        // Page came back to foreground
        console.log('[ChatContext] Page visible, checking connection');

        // Check if WebSocket is still alive
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // Restart ping interval
          wsPingIntervalRef.current = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, WS_PING_INTERVAL);

          // Send immediate ping to test connection
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } else {
          // Connection dead, reconnect
          console.log('[ChatContext] Connection lost during suspension, reconnecting');
          connectWebSocket();
        }

        // Reload conversations to catch up on any missed updates
        loadConversations();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, connectWebSocket, loadConversations]);

  // Handle network changes (WiFi ↔ Cellular switching on mobile)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleOnline = () => {
      console.log('[ChatContext] Network online, reconnecting WebSocket');
      setWsError(null);
      connectWebSocket();
    };

    const handleOffline = () => {
      console.log('[ChatContext] Network offline, disconnecting');
      setWsError('No network connection');
      disconnectWebSocket();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated, connectWebSocket, disconnectWebSocket]);

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
    wsConnected,
    wsError,
    isPolling, // ADDED: Expose polling state for UI
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
    getTypingUsers,
    sendTypingIndicator,
  }), [
    conversations,
    messages,
    activeConversationId,
    presence,
    loading,
    sending,
    wsConnected,
    wsError,
    isPolling, // ADDED: Include in dependencies
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
    getTypingUsers,
    sendTypingIndicator,
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
