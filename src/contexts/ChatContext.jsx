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

const WS_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/^https?:/, 'wss:').replace(/\/api$/, '') || 'wss://cgiworkflo-api.joshua-r-klimek.workers.dev';
const WS_RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
const WS_PING_INTERVAL = 30000; // 30 seconds
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

  // ============================================================================
  // WEBSOCKET FUNCTIONS (Defined first, no dependencies)
  // ============================================================================

  /**
   * Connect to WebSocket for active conversation
   */
  const connectWebSocket = useCallback((conversationId) => {
    if (!isAuthenticated || !currentUser || !conversationId) {
      console.log('[ChatContext] Cannot connect WS: not authenticated or no conversation');
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      console.log('[ChatContext] Closing existing WebSocket connection');
      wsRef.current.close(1000, 'Switching conversation');
      wsRef.current = null;
    }

    try {
      const token = localStorage.getItem('authToken');
      const wsUrl = `${WS_BASE_URL}/ws/chat/${conversationId}?token=${encodeURIComponent(token)}`;

      console.log(`[ChatContext] Connecting to WebSocket: ${conversationId}`);

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
        if (event.code !== 1000 && activeConversationIdRef.current) {
          const delay = WS_RECONNECT_DELAYS[Math.min(wsReconnectAttemptsRef.current, WS_RECONNECT_DELAYS.length - 1)];
          console.log(`[ChatContext] Reconnecting in ${delay}ms (attempt ${wsReconnectAttemptsRef.current + 1})`);

          wsReconnectTimeoutRef.current = setTimeout(() => {
            wsReconnectAttemptsRef.current++;
            connectWebSocket(activeConversationIdRef.current);
          }, delay);
        }
      };
    } catch (error) {
      console.error('[ChatContext] Error creating WebSocket:', error);
      setWsError('Failed to connect');
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
   * Send message via WebSocket
   */
  const sendWebSocketMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message if offline
      if (messageQueueRef.current.length < WS_MAX_QUEUE_SIZE) {
        messageQueueRef.current.push(message);
        console.log('[ChatContext] Message queued (offline)');
      } else {
        console.warn('[ChatContext] Message queue full, dropping message');
        toast.error('Too many queued messages. Please try again.');
      }
    }
  }, []);

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
   */
  const handleNewMessage = useCallback((payload) => {
    const { conversationId, tempId } = payload;

    startTransition(() => {
      setMessages((prev) => {
        const convMessages = prev[conversationId] || [];

        // If tempId exists, replace optimistic message
        if (tempId) {
          const tempIndex = convMessages.findIndex((m) => m.id === tempId);
          if (tempIndex >= 0) {
            const updated = [...convMessages];
            updated[tempIndex] = payload;
            return { ...prev, [conversationId]: updated };
          }
        }

        // Add new message if not duplicate
        const exists = convMessages.some((m) => m.id === payload.id);
        if (!exists) {
          return {
            ...prev,
            [conversationId]: [...convMessages, payload],
          };
        }

        return prev;
      });

      // Update conversation's lastMessageAt
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? { ...conv, lastMessageAt: payload.timestamp }
            : conv
        )
      );
    });
  }, []);

  /**
   * Handle typing indicator
   */
  const handleTypingIndicator = useCallback((payload) => {
    const { userId, userName, isTyping } = payload;
    const conversationId = activeConversationIdRef.current;

    if (!conversationId) return;

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
   */
  const handleReadReceipt = useCallback((payload) => {
    const { messageId, userId, readAt } = payload;

    // Update message's read_by array
    setMessages((prev) => {
      let updated = false;
      const newMessages = { ...prev };

      Object.keys(newMessages).forEach((convId) => {
        const msgIndex = newMessages[convId].findIndex((m) => m.id === messageId);
        if (msgIndex >= 0) {
          const msg = newMessages[convId][msgIndex];
          const readBy = msg.read_by ? JSON.parse(msg.read_by) : [];

          // Add if not already there
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

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.conversations.list();
      const convList = response.data.data || [];
      console.log('[ChatContext] Loaded conversations:', convList);
      setConversations(convList);

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
  }, [loadMessages]);

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

      // Send via WebSocket
      sendWebSocketMessage({
        type: 'message',
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
    sendWebSocketMessage({
      type: 'typing',
      payload: { isTyping },
    });
  }, [sendWebSocketMessage]);

  // ============================================================================
  // USE EFFECTS
  // ============================================================================

  // Keep refs in sync with state
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    loadConversations();
    loadOpenChat();
  }, [isAuthenticated, loadConversations, loadOpenChat]);

  // Connect/disconnect WebSocket when active conversation changes
  useEffect(() => {
    if (!isAuthenticated || !activeConversationId) {
      disconnectWebSocket();
      return;
    }

    connectWebSocket(activeConversationId);

    return () => {
      disconnectWebSocket();
    };
  }, [isAuthenticated, activeConversationId, connectWebSocket, disconnectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

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
