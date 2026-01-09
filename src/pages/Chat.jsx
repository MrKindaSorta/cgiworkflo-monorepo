import { useState, useEffect, useRef, useMemo, memo, useCallback, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { api } from '../lib/api-client';
import ErrorBoundary from '../components/ErrorBoundary';
import MessageInput from './Chat/MessageInput';
import { formatTime, formatDate, shouldShowDateSeparator, shouldGroupMessage, getInitials, getAvatarColor } from '../utils/chatHelpers';
import {
  MessageSquare,
  Users,
  Send,
  ArrowLeft,
  Search,
  MoreVertical,
  Plus,
  X,
  Image,
  File,
  Camera,
  Paperclip,
  UserPlus,
  Clock,
  Check,
  XCircle,
  AlertCircle,
} from 'lucide-react';

// Loading skeleton components
const ConversationSkeleton = () => (
  <div className="w-full p-3 md:p-4 flex items-start gap-3 animate-pulse border-b border-gray-200 dark:border-gray-700">
    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
    </div>
  </div>
);

const MessageSkeleton = () => (
  <div className="flex items-end gap-2 mt-4 animate-pulse">
    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
    <div className="flex-1 max-w-[75%]">
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl w-full" />
    </div>
  </div>
);

// Reusable ConversationAvatar component
const ConversationAvatar = memo(({ conversation, displayName, size = 'md', showOnlineStatus = false, isOnline = false }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-base',
    lg: 'w-14 h-14 text-lg',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  const onlineIndicatorSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold shadow-md ${
          conversation.type === 'open'
            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
            : conversation.type === 'group'
            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
            : `bg-gradient-to-br ${getAvatarColor(conversation.id)}`
        }`}
      >
        {conversation.type === 'open' || conversation.type === 'group' ? (
          <Users className={iconSizes[size]} />
        ) : (
          getInitials(displayName)
        )}
      </div>
      {showOnlineStatus && isOnline && (
        <div className={`absolute bottom-0 right-0 ${onlineIndicatorSizes[size]} bg-green-500 border-2 border-white dark:border-gray-900 rounded-full`}></div>
      )}
    </div>
  );
});

const Chat = () => {
  const { t } = useTranslation();
  const { currentUser: user, users } = useAuth();
  const {
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    markAsRead,
    getMessages,
    createConversation,
    isUserOnline,
    loading,
    sending,
    syncError,
    retrySync,
  } = useChat();

  const [activeTab, setActiveTab] = useState('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [messageDisplayLimit, setMessageDisplayLimit] = useState(50); // Pagination: show last 50 messages
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const markAsReadTimeoutRef = useRef(null);
  const uploadAbortControllerRef = useRef(null);
  const messageQueueRef = useRef([]);
  const processingQueueRef = useRef(false);

  // NEW: Scroll behavior control refs
  const shouldScrollRef = useRef(false); // Control when to auto-scroll
  const previousScrollHeightRef = useRef(0); // For maintaining position during "load older"
  const isUserScrollingRef = useRef(false); // Track if user is manually scrolling
  const lastMessageCountRef = useRef(0); // Track message count changes

  // Stable refs for callback dependencies (prevent MessageInput remounting)
  const sendMessageRef = useRef(sendMessage);
  const activeConversationIdRef = useRef(activeConversationId);

  // Memoize to prevent re-renders when conversations array updates
  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  // CRITICAL: Only recalculate when THIS conversation's messages change
  // Memoized to prevent unnecessary re-renders when messages object reference changes
  const allConversationMessages = useMemo(
    () => (activeConversationId ? messages[activeConversationId] || [] : []),
    [messages, activeConversationId]
  );

  // Paginated messages: show only last N messages for performance
  const conversationMessages = useMemo(() => {
    const totalMessages = allConversationMessages.length;
    if (totalMessages <= messageDisplayLimit) {
      return allConversationMessages;
    }
    return allConversationMessages.slice(totalMessages - messageDisplayLimit);
  }, [allConversationMessages, messageDisplayLimit]);

  const hasMoreMessages = allConversationMessages.length > messageDisplayLimit;

  // Keep refs in sync with latest values
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Disable browser's automatic scroll restoration
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    return () => {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'auto';
      }
    };
  }, []);

  // ============================================================================
  // SMART SCROLL LOGIC - FIXED
  // ============================================================================

  // Scroll to bottom utility function
  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (!scrollContainerRef.current) return;

    // Use requestAnimationFrame to ensure DOM is painted
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    });
  }, []);

  // Check if user is at bottom of scroll container
  const isAtBottom = useCallback(() => {
    if (!scrollContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Within 100px of bottom
    return scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  // FIXED: Smart auto-scroll on messages change
  // Only scroll when: 1) Conversation changes 2) New message arrives and user is at bottom 3) User sends message
  useLayoutEffect(() => {
    if (!scrollContainerRef.current || conversationMessages.length === 0) return;

    const currentMessageCount = conversationMessages.length;
    const previousMessageCount = lastMessageCountRef.current;

    // Case 1: First load or conversation changed - scroll to bottom
    if (shouldScrollRef.current) {
      scrollToBottom('auto');
      shouldScrollRef.current = false;
      lastMessageCountRef.current = currentMessageCount;
      return;
    }

    // Case 2: New messages arrived
    if (currentMessageCount > previousMessageCount) {
      const newMessagesCount = currentMessageCount - previousMessageCount;

      // Check if last message is from current user (they just sent it)
      const lastMessage = conversationMessages[conversationMessages.length - 1];
      const isOwnMessage = lastMessage?.senderId === user?.id;

      // Auto-scroll if: user sent message OR user is already at bottom
      if (isOwnMessage || isAtBottom()) {
        scrollToBottom('smooth');
      }

      lastMessageCountRef.current = currentMessageCount;
    }
  }, [conversationMessages, scrollToBottom, isAtBottom, user?.id]);

  // Scroll to bottom when conversation changes (after DOM update)
  useEffect(() => {
    if (activeConversationId && conversationMessages.length > 0) {
      shouldScrollRef.current = true; // Set flag to scroll on next layout effect
      lastMessageCountRef.current = conversationMessages.length;
    }
  }, [activeConversationId, conversationMessages.length > 0]);

  // Handle mobile keyboard visibility changes (viewport resize)
  useEffect(() => {
    let resizeTimeout;

    const handleResize = () => {
      // Debounce resize events
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Only auto-scroll if user is typing (input focused) AND near bottom
        const inputFocused = document.activeElement?.tagName === 'INPUT' ||
                            document.activeElement?.tagName === 'TEXTAREA';

        if (inputFocused && isAtBottom()) {
          scrollToBottom('auto');
        }
      }, 100);
    };

    // Only use visualViewport for mobile keyboard detection
    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, [scrollToBottom, isAtBottom]);

  // Track user scrolling to prevent auto-scroll during manual scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let scrollTimeout;
    const handleScroll = () => {
      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Reset message display limit when conversation changes
  useEffect(() => {
    setMessageDisplayLimit(50);
  }, [activeConversationId]);

  // Debounced markAsRead when conversation changes
  useEffect(() => {
    // Clear any pending markAsRead
    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current);
    }

    let loadingTimeout; // Declare in outer scope for cleanup

    // Show loading state when switching conversations
    if (activeConversationId) {
      setLoadingConversation(true);

      // Simulate loading messages (in real scenario, this would wait for getMessages)
      loadingTimeout = setTimeout(() => {
        setLoadingConversation(false);
      }, 150); // Short delay for loading indicator

      markAsReadTimeoutRef.current = setTimeout(() => {
        markAsRead(activeConversationId);
      }, 300); // 300ms debounce
    } else {
      setLoadingConversation(false);
    }

    // SINGLE cleanup function that handles both timeouts
    return () => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [activeConversationId, markAsRead]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  // Memoized getOtherParticipant with proper dependencies
  const getOtherParticipant = useCallback((conversation) => {
    if (conversation.type !== 'direct') return null;
    const participants = conversation.participants || [];

    // Add validation for empty or malformed participants
    if (participants.length < 2) {
      console.warn('Direct conversation has less than 2 participants:', conversation.id);
      return null;
    }

    const otherId = participants.find((p) => p.userId !== user.id)?.userId;

    // Early return if otherId not found
    if (!otherId) {
      console.warn('Could not find other participant in conversation:', conversation.id);
      return null;
    }

    return users.find((u) => u.id === otherId);
  }, [users, user.id]);

  const getConversationName = useCallback((conversation) => {
    if (conversation.type === 'open') return 'Open Chat';
    if (conversation.type === 'group') return conversation.name || 'Unnamed Group';
    if (conversation.type === 'direct') {
      const otherUser = getOtherParticipant(conversation);
      return otherUser?.name || 'Unknown User';
    }
    return 'Unknown';
  }, [users, user.id]); // Removed getOtherParticipant to break circular dependency

  const filteredConversations = useMemo(() => {
    return conversations
      .filter((conv) => {
        if (activeTab === 'direct') return conv.type === 'direct';
        if (activeTab === 'groups') return conv.type === 'group';
        if (activeTab === 'open') return conv.type === 'open';
        return false;
      })
      .filter((conv) => {
        if (!searchQuery) return true;
        const name = getConversationName(conv).toLowerCase();
        return name.includes(searchQuery.toLowerCase());
      });
  }, [conversations, activeTab, searchQuery, getConversationName]);

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  // Process message queue to prevent rapid duplicates
  // STABLE: Uses refs to prevent MessageInput remounting
  const processMessageQueue = useCallback(async () => {
    if (processingQueueRef.current || messageQueueRef.current.length === 0) return;

    processingQueueRef.current = true;

    while (messageQueueRef.current.length > 0) {
      const { conversationId, content } = messageQueueRef.current[0];

      try {
        await sendMessageRef.current(conversationId, content); // Use ref instead of direct call
        messageQueueRef.current.shift(); // Remove successfully sent message
      } catch (error) {
        console.error('Failed to send message:', error);
        // Error toast already shown in ChatContext
        messageQueueRef.current.shift(); // Remove failed message from queue
      }
    }

    processingQueueRef.current = false;
  }, []); // Empty deps - stable callback!

  // STABLE: Uses refs to prevent MessageInput remounting
  const handleSendMessage = useCallback(async (content) => {
    if (!content.trim() || !activeConversationIdRef.current) return; // Use ref

    // Add to queue
    messageQueueRef.current.push({
      conversationId: activeConversationIdRef.current, // Use ref
      content: content.trim(),
    });

    // Process queue
    processMessageQueue();

    // Mark that we should scroll (user sent message)
    shouldScrollRef.current = true;
  }, [processMessageQueue]); // Only depends on processMessageQueue (which is now stable)

  // Retry failed message - STABLE
  const handleRetryMessage = useCallback(async (message) => {
    if (!message._failed || !message.content) return;

    // Add to queue for retry
    messageQueueRef.current.push({
      conversationId: message.conversationId || activeConversationIdRef.current, // Use ref
      content: message.content,
    });

    // Process queue
    processMessageQueue();
  }, [processMessageQueue]);

  // ============================================================================
  // FILE UPLOAD
  // ============================================================================

  const handleFileUpload = useCallback(async (files, type = 'file') => {
    if (!files || files.length === 0 || !activeConversationIdRef.current || uploading) return; // Use ref

    // Cancel any previous uploads
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
    }

    // Create new abort controller for this upload batch
    const abortController = new AbortController();
    uploadAbortControllerRef.current = abortController;

    // Capture conversationId at upload start to prevent race condition
    const targetConversationId = activeConversationIdRef.current; // Use ref

    setUploading(true);

    try {
      const fileCount = files.length;
      for (let i = 0; i < fileCount; i++) {
        // Check if upload was aborted
        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const file = files[i];
        // Upload file to R2
        const uploadResponse = await api.uploads.uploadFile(file, type);
        const { url, filename, size: fileSize, type: fileType } = uploadResponse.data.data;

        // Send message with attachment to the ORIGINAL conversation
        const metadata = JSON.stringify({
          url,
          filename,
          size: fileSize,
          type: fileType,
        });

        const content = type === 'image' ? `📷 ${filename}` : `📎 ${filename}`;
        await sendMessageRef.current(targetConversationId, content, type === 'image' ? 'image' : 'file', metadata); // Use ref
      }

      // Show success message
      if (fileCount === 1) {
        toast.success('File uploaded successfully!');
      } else {
        toast.success(`${fileCount} files uploaded successfully!`);
      }

      // Mark that we should scroll (user uploaded file)
      shouldScrollRef.current = true;
    } catch (error) {
      if (error.message === 'Upload cancelled') {
        toast.info('File upload cancelled');
      } else {
        console.error('Failed to upload file:', error);
        toast.error('Failed to upload file. Please try again.');
      }
    } finally {
      setUploading(false);
      if (uploadAbortControllerRef.current === abortController) {
        uploadAbortControllerRef.current = null;
      }
    }
  }, [uploading]); // Removed volatile dependencies - using refs instead

  // Cancel uploads when conversation changes
  useEffect(() => {
    return () => {
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort();
        uploadAbortControllerRef.current = null;
      }
    };
  }, [activeConversationId]);

  // ============================================================================
  // PAGINATION - IMPROVED with scroll position maintenance
  // ============================================================================

  const handleLoadOlderMessages = useCallback(() => {
    if (!scrollContainerRef.current) return;

    // Capture current scroll position BEFORE loading more messages
    const scrollContainer = scrollContainerRef.current;
    const previousScrollHeight = scrollContainer.scrollHeight;
    const previousScrollTop = scrollContainer.scrollTop;

    // Load more messages
    setMessageDisplayLimit((prev) => prev + 50);

    // After messages render, restore scroll position
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const newScrollHeight = scrollContainerRef.current.scrollHeight;
        const scrollHeightDifference = newScrollHeight - previousScrollHeight;

        // Maintain scroll position by adjusting for new content
        scrollContainerRef.current.scrollTop = previousScrollTop + scrollHeightDifference;
      }
    });
  }, []);

  // ============================================================================
  // MEMOIZED COMPONENTS
  // ============================================================================

  // Memoize last messages map to avoid repeated getMessages calls
  const lastMessagesMap = useMemo(() => {
    const map = {};
    conversations.forEach((conv) => {
      const convMessages = messages[conv.id] || [];
      if (convMessages.length === 0) {
        map[conv.id] = '';
      } else {
        const lastMsg = convMessages[convMessages.length - 1];
        const isOwn = lastMsg.senderId === user.id;
        const prefix = isOwn ? 'You: ' : '';
        const content =
          lastMsg.content.length > 40 ? lastMsg.content.substring(0, 40) + '...' : lastMsg.content;
        map[conv.id] = prefix + content;
      }
    });
    return map;
  }, [conversations, messages, user.id]);

  const ConversationItem = memo(({ conversation, lastMessage, isActive }) => {
    const displayName = getConversationName(conversation);
    const hasUnread = conversation.unreadCount > 0;
    const lastMsgDate = new Date(conversation.updatedAt);
    const isToday = lastMsgDate.toDateString() === new Date().toDateString();
    const timeDisplay = isToday
      ? formatTime(conversation.updatedAt)
      : lastMsgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

    // Check online status for direct messages
    const otherUserId = conversation.type === 'direct'
      ? conversation.participants?.find((p) => p.userId !== user.id)?.userId
      : null;
    const online = otherUserId ? isUserOnline(otherUserId) : false;

    return (
      <button
        onClick={() => {
          setActiveConversationId(conversation.id);
        }}
        aria-label={`Conversation with ${displayName}${
          hasUnread ? `, ${conversation.unreadCount} unread messages` : ''
        }`}
        aria-current={isActive ? 'true' : 'false'}
        className={`w-full p-3 md:p-4 flex items-start gap-3 transition-all duration-200 border-b ${
          isActive
            ? 'bg-primary-50/80 dark:bg-primary-900/15 border-primary-200 dark:border-primary-800/50 border-l-4 border-l-primary-500 dark:border-l-primary-500 shadow-sm dark:ring-1 dark:ring-primary-700/30'
            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/70'
        }`}
      >
        {/* Avatar */}
        <ConversationAvatar
          conversation={conversation}
          displayName={displayName}
          size="lg"
          showOnlineStatus={conversation.type === 'direct'}
          isOnline={online}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <h3
              className={`font-semibold truncate text-base ${
                isActive
                  ? 'text-primary-700 dark:text-primary-400'
                  : hasUnread
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {displayName}
            </h3>
            <span
              className={`text-xs ml-2 flex-shrink-0 ${
                isActive
                  ? 'text-primary-600 dark:text-primary-500 font-semibold'
                  : hasUnread
                  ? 'text-primary-600 dark:text-primary-400 font-semibold'
                  : 'text-gray-500 dark:text-gray-500'
              }`}
            >
              {timeDisplay}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-sm truncate ${
                isActive
                  ? 'text-primary-600 dark:text-gray-300 font-medium'
                  : hasUnread
                  ? 'text-gray-900 dark:text-gray-200 font-medium'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {lastMessage}
            </p>
            {hasUnread && (
              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
                {conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }, (prevProps, nextProps) => {
    // Only re-render if conversation data or active state actually changed
    return (
      prevProps.conversation.id === nextProps.conversation.id &&
      prevProps.conversation.updatedAt === nextProps.conversation.updatedAt &&
      prevProps.conversation.unreadCount === nextProps.conversation.unreadCount &&
      prevProps.lastMessage === nextProps.lastMessage &&
      prevProps.isActive === nextProps.isActive
    );
  });

  // Optimized MessageBubble using imported utilities
  const MessageBubble = memo(({ message, previousMessage, nextMessage, onRetry }) => {
    const isOwn = message.senderId === user.id;
    const sender = users.find((u) => u.id === message.senderId) || { name: message.senderName || 'Unknown' };
    const isGrouped = shouldGroupMessage(message, previousMessage);
    const isLastInGroup = !shouldGroupMessage(nextMessage, message);
    const showDateSeparator = shouldShowDateSeparator(message, previousMessage);

    // Memoize date formatting to prevent repeated Date object creation
    const formattedTime = useMemo(() => formatTime(message.timestamp), [message.timestamp]);
    const formattedDate = useMemo(() => formatDate(message.timestamp), [message.timestamp]);

    let attachment = null;
    if (message.metadata) {
      try {
        attachment = JSON.parse(message.metadata);
      } catch (e) {
        console.error('Failed to parse message metadata:', e);
      }
    }

    const isImageAttachment = message.messageType === 'image' && attachment;
    const isFileAttachment = message.messageType === 'file' && attachment;

    return (
      <>
        {showDateSeparator && (
          <div className="flex items-center justify-center my-6">
            <div className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
              {formattedDate}
            </div>
          </div>
        )}

        <div
          role="article"
          aria-label={`Message from ${sender?.name} at ${formattedTime}`}
          className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${
            isGrouped ? 'mt-1' : 'mt-4'
          }`}
          style={{
            contain: 'layout style paint',
            contentVisibility: 'auto',
          }}
        >
          {!isOwn && selectedConversation?.type !== 'direct' ? (
            isGrouped ? (
              <div className="w-8 h-8 flex-shrink-0" />
            ) : (
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(
                  message.senderId
                )} text-white flex items-center justify-center text-xs font-bold shadow`}
              >
                {getInitials(sender?.name || 'U')}
              </div>
            )
          ) : null}

          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
            {!isOwn && selectedConversation?.type !== 'direct' && !isGrouped && (
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 px-1">
                {sender?.name}
              </span>
            )}

            <div
              className={`${isImageAttachment ? 'p-0' : 'px-4 py-2.5'} rounded-xl ${
                isOwn
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              } ${
                isOwn
                  ? isGrouped
                    ? 'rounded-br-md'
                    : 'rounded-br-sm'
                  : isGrouped
                  ? 'rounded-bl-md'
                  : 'rounded-bl-sm'
              }`}
              style={{ willChange: 'transform', transform: 'translateZ(0)' }}
            >
              {isImageAttachment ? (
                <div className="flex flex-col">
                  <img
                    src={attachment.url}
                    alt={attachment.filename}
                    className="max-w-full max-h-96 rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxImage({ url: attachment.url, filename: attachment.filename })}
                    loading="lazy"
                  />
                  <p
                    className={`px-4 py-2 text-xs ${
                      isOwn ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {attachment.filename}
                  </p>
                </div>
              ) : isFileAttachment ? (
                <a
                  href={attachment.url}
                  download={attachment.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <File className="w-5 h-5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate">{attachment.filename}</p>
                    <p className={`text-xs ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                      {(attachment.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </a>
              ) : (
                <p
                  className="text-[15px] leading-relaxed whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(message.content, {
                      ALLOWED_TAGS: [], // Strip ALL HTML tags
                      ALLOWED_ATTR: [], // Strip ALL attributes
                    }),
                  }}
                />
              )}
            </div>

            {isLastInGroup && (
              <div className="flex items-center gap-1.5 mt-1 px-1">
                <span className="text-[11px] text-gray-500 dark:text-gray-500">
                  {formattedTime}
                </span>
                {isOwn && (
                  <span className="text-[11px]">
                    {message._isPending ? (
                      <Clock className="w-3 h-3 text-gray-400 animate-pulse" />
                    ) : message._failed ? (
                      <XCircle className="w-3 h-3 text-red-500" />
                    ) : (
                      <Check className="w-3 h-3 text-green-500" />
                    )}
                  </span>
                )}
              </div>
            )}

            {/* Retry button for failed messages */}
            {isOwn && message._failed && onRetry && (
              <button
                onClick={() => onRetry(message)}
                className="mt-2 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors flex items-center gap-1"
              >
                <XCircle className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        </div>
      </>
    );
  }, (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.timestamp === nextProps.message.timestamp &&
      prevProps.message.metadata === nextProps.message.metadata &&
      prevProps.message._isPending === nextProps.message._isPending &&
      prevProps.message._failed === nextProps.message._failed &&
      prevProps.previousMessage?.id === nextProps.previousMessage?.id &&
      prevProps.nextMessage?.id === nextProps.nextMessage?.id
    );
  });

  // New Chat Modal Component
  const NewChatModal = () => {
    if (!showNewChatModal) return null;

    const availableUsers = users.filter((u) => u.id !== user.id);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md m-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 md:p-4 md:p-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">New Conversation</h2>
            <button
              onClick={() => setShowNewChatModal(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 md:p-4 md:p-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select a user to start a conversation:
            </p>
            <div className="space-y-2">
              {availableUsers.map((availableUser) => (
                <button
                  key={availableUser.id}
                  onClick={async () => {
                    try {
                      const newConvId = await createConversation('direct', [availableUser.id]);
                      setActiveConversationId(newConvId);
                      setShowNewChatModal(false);
                    } catch (error) {
                      console.error('Failed to create conversation:', error);
                      // Error toast already shown in ChatContext
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <div
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(
                      availableUser.id
                    )} text-white flex items-center justify-center font-bold shadow-md`}
                  >
                    {getInitials(availableUser.name)}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {availableUser.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {availableUser.role}
                    </p>
                  </div>
                  <UserPlus className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Image Lightbox Component
  const ImageLightbox = () => {
    const previousFocusRef = useRef(null);

    // Handle ESC key press
    useEffect(() => {
      if (!lightboxImage) return;

      // Store previous focus element
      previousFocusRef.current = document.activeElement;

      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          setLightboxImage(null);
        }
      };

      document.addEventListener('keydown', handleEscape);

      // Cleanup and restore focus
      return () => {
        document.removeEventListener('keydown', handleEscape);
        if (previousFocusRef.current && previousFocusRef.current.focus) {
          previousFocusRef.current.focus();
        }
      };
    }, [lightboxImage]);

    if (!lightboxImage) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
        onClick={() => setLightboxImage(null)}
      >
        {/* Close button */}
        <button
          onClick={() => setLightboxImage(null)}
          className="absolute top-4 right-4 z-10 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors group"
          aria-label="Close lightbox"
        >
          <X className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
        </button>

        {/* Image container */}
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          <img
            src={lightboxImage.url}
            alt={lightboxImage.filename}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Filename display */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-full max-w-md mx-4">
            <p className="text-white text-sm font-medium truncate text-center">
              {lightboxImage.filename}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Extracted ConversationView Component
  const ConversationView = () => {
    if (!selectedConversation) {
      return (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 rounded-full flex items-center justify-center">
              <MessageSquare className="w-12 h-12 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('chat.selectConversation')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-sm">
              Choose a conversation from the list to start chatting
            </p>
          </div>
        </div>
      );
    }

    const displayName = getConversationName(selectedConversation);
    const otherUser =
      selectedConversation.type === 'direct'
        ? getOtherParticipant(selectedConversation)
        : null;

    return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setActiveConversationId(null)}
              className="md:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>

            <ConversationAvatar
              conversation={selectedConversation}
              displayName={displayName}
              size="md"
              showOnlineStatus={selectedConversation.type === 'direct' && !!otherUser}
              isOnline={otherUser ? isUserOnline(otherUser.id) : false}
            />

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-lg">
                {displayName}
              </h2>
              {selectedConversation.type === 'direct' && otherUser && (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Active now</p>
              )}
              {selectedConversation.type === 'group' && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedConversation.participants.length} members
                </p>
              )}
              {selectedConversation.type === 'open' && (
                <p className="text-sm text-gray-600 dark:text-gray-400">Public chat room</p>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {syncError && (
              <button
                onClick={retrySync}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                aria-label="Retry connection"
              >
                <AlertCircle className="w-4 h-4" />
                Retry
              </button>
            )}
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="More options"
            >
              <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 bg-gray-50 dark:bg-gray-900 mobile-scroll"
          style={{
            contain: 'layout style paint',
            willChange: 'scroll-position',
          }}
          role="log"
          aria-live="polite"
          aria-label="Messages"
        >
          {loadingConversation ? (
            <div className="space-y-4">
              <MessageSkeleton />
              <MessageSkeleton />
              <MessageSkeleton />
            </div>
          ) : conversationMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            <>
              {/* Load More Button */}
              {hasMoreMessages && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={handleLoadOlderMessages}
                    className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    aria-label={`Load ${allConversationMessages.length - messageDisplayLimit} older messages`}
                  >
                    Load older messages ({allConversationMessages.length - messageDisplayLimit} more)
                  </button>
                </div>
              )}

              {conversationMessages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  previousMessage={conversationMessages[idx - 1] || null}
                  nextMessage={conversationMessages[idx + 1] || null}
                  onRetry={handleRetryMessage}
                />
              ))}
              <div ref={messagesEndRef} aria-hidden="true" />
            </>
          )}
        </div>

        {/* Message Input - Isolated Component */}
        <MessageInput
          onSendMessage={handleSendMessage}
          sending={sending}
          uploading={uploading}
          onFileUpload={handleFileUpload}
        />
    </div>
    );
  };

  return (
    <ErrorBoundary>
      <div className="flex flex-col md:flex-row h-full overflow-hidden bg-white dark:bg-gray-800">
      {/* Conversation List */}
      <div
        className={`${
          selectedConversation ? 'hidden md:flex' : 'flex'
        } md:w-96 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-hidden`}
      >
        {/* Header */}
        <div className="p-3 md:p-4 lg:p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('chat.title')}
            </h1>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              aria-label="New conversation"
            >
              <Plus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Sync Error Banner */}
          {syncError && (
            <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <p className="text-sm text-orange-700 dark:text-orange-300 flex-1">
                {syncError}
              </p>
              <button
                onClick={retrySync}
                className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
              >
                Retry
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              aria-label="Search conversations"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-gray-100 dark:bg-gray-900 rounded-xl p-1.5">
            <button
              onClick={() => {
                setActiveTab('direct');
                setSearchQuery('');
              }}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'direct'
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              aria-pressed={activeTab === 'direct'}
            >
              {t('chat.directMessages')}
            </button>
            <button
              onClick={() => {
                setActiveTab('groups');
                setSearchQuery('');
              }}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'groups'
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              aria-pressed={activeTab === 'groups'}
            >
              {t('chat.groups')}
            </button>
            <button
              onClick={() => {
                setActiveTab('open');
                setSearchQuery('');
              }}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'open'
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              aria-pressed={activeTab === 'open'}
            >
              {t('chat.openChat')}
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto" role="list" aria-label="Conversations">
          {loading ? (
            <>
              <ConversationSkeleton />
              <ConversationSkeleton />
              <ConversationSkeleton />
            </>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {searchQuery ? 'No results found' : 'No conversations'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {searchQuery
                  ? 'Try a different search term'
                  : activeTab === 'direct'
                  ? t('chat.noDMs')
                  : activeTab === 'groups'
                  ? t('chat.noGroups')
                  : t('chat.startChatting')}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                lastMessage={lastMessagesMap[conversation.id] || ''}
                isActive={selectedConversation?.id === conversation.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Conversation View */}
      <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 overflow-hidden`}>
        <ConversationView />
      </div>

      {/* Modals */}
      <NewChatModal />
      <ImageLightbox />
      </div>
    </ErrorBoundary>
  );
};

export default Chat;
