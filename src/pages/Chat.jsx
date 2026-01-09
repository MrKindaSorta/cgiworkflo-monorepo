import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
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
} from 'lucide-react';

// Loading skeleton components
const ConversationSkeleton = () => (
  <div className="w-full p-4 flex items-start gap-3 animate-pulse">
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
  } = useChat();

  const [activeTab, setActiveTab] = useState('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Memoize to prevent re-renders when conversations array updates
  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  // CRITICAL: Only recalculate when THIS conversation's messages change
  const conversationMessages = activeConversationId ? messages[activeConversationId] || [] : [];

  // Simple auto-scroll to bottom on new messages
  useEffect(() => {
    if (conversationMessages.length > 0 && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Only auto-scroll if user is near the bottom (within 150px)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;

      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [conversationMessages.length]);

  // Always scroll to bottom when conversation changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [activeConversationId]);

  const getOtherParticipant = (conversation) => {
    if (conversation.type !== 'direct') return null;
    const participants = conversation.participants || [];
    const otherId = participants.find((p) => p.userId !== user.id)?.userId;
    return users.find((u) => u.id === otherId);
  };

  const getConversationName = useCallback((conversation) => {
    if (conversation.type === 'open') return 'Open Chat';
    if (conversation.type === 'group') return conversation.name || 'Unnamed Group';
    if (conversation.type === 'direct') {
      const otherUser = getOtherParticipant(conversation);
      return otherUser?.name || 'Unknown User';
    }
    return 'Unknown';
  }, [users, user.id]);

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

  const handleSendMessage = useCallback(async (content) => {
    if (!content.trim() || !activeConversationId || sending) return;

    try {
      await sendMessage(activeConversationId, content.trim());
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    }
  }, [activeConversationId, sending, sendMessage]);

  const handleFileUpload = useCallback(async (files, type = 'file') => {
    if (!files || files.length === 0 || !activeConversationId || uploading) return;

    setUploading(true);

    try {
      const fileCount = files.length;
      for (const file of files) {
        // Upload file to R2
        const uploadResponse = await api.uploads.uploadFile(file, type);
        const { url, filename, size: fileSize, type: fileType } = uploadResponse.data.data;

        // Send message with attachment
        const metadata = JSON.stringify({
          url,
          filename,
          size: fileSize,
          type: fileType,
        });

        const content = type === 'image' ? `📷 ${filename}` : `📎 ${filename}`;
        await sendMessage(activeConversationId, content, type === 'image' ? 'image' : 'file', metadata);
      }

      // Show success message
      if (fileCount === 1) {
        toast.success('File uploaded successfully!');
      } else {
        toast.success(`${fileCount} files uploaded successfully!`);
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [activeConversationId, uploading, sendMessage]);

  const getLastMessage = (conversation) => {
    const convMessages = getMessages(conversation.id);
    if (convMessages.length === 0) return '';

    const lastMsg = convMessages[convMessages.length - 1];
    const isOwn = lastMsg.senderId === user.id;
    const prefix = isOwn ? 'You: ' : '';
    const content =
      lastMsg.content.length > 40 ? lastMsg.content.substring(0, 40) + '...' : lastMsg.content;

    return prefix + content;
  };

  const ConversationItem = memo(({ conversation }) => {
    const isActive = selectedConversation?.id === conversation.id;
    const displayName = getConversationName(conversation);
    const lastMessage = getLastMessage(conversation);
    const hasUnread = conversation.unreadCount > 0;
    const lastMsgDate = new Date(conversation.updatedAt);
    const isToday = lastMsgDate.toDateString() === new Date().toDateString();
    const timeDisplay = isToday
      ? formatTime(conversation.updatedAt)
      : lastMsgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

    return (
      <button
        onClick={() => {
          setActiveConversationId(conversation.id);
          markAsRead(conversation.id);
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
        <div className="relative flex-shrink-0">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ${
              conversation.type === 'open'
                ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                : conversation.type === 'group'
                ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                : `bg-gradient-to-br ${getAvatarColor(conversation.id)}`
            }`}
          >
            {conversation.type === 'open' || conversation.type === 'group' ? (
              <Users className="w-7 h-7" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          {conversation.type === 'direct' && (() => {
            const participants = conversation.participants || [];
            const otherId = participants.find((p) => p.userId !== user.id)?.userId;
            const online = otherId ? isUserOnline(otherId) : false;

            return online && (
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
            );
          })()}
        </div>

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
    // Only re-render if conversation data actually changed
    return (
      prevProps.conversation.id === nextProps.conversation.id &&
      prevProps.conversation.updatedAt === nextProps.conversation.updatedAt &&
      prevProps.conversation.unreadCount === nextProps.conversation.unreadCount
    );
  });

  // Optimized MessageBubble using imported utilities
  const MessageBubble = memo(({ message, previousMessage, nextMessage }) => {
    const isOwn = message.senderId === user.id;
    const sender = users.find((u) => u.id === message.senderId) || { name: message.senderName || 'Unknown' };
    const isGrouped = shouldGroupMessage(message, previousMessage);
    const isLastInGroup = !shouldGroupMessage(nextMessage, message);
    const showDateSeparator = shouldShowDateSeparator(message, previousMessage);

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
              {formatDate(message.timestamp)}
            </div>
          </div>
        )}

        <div
          role="article"
          aria-label={`Message from ${sender?.name} at ${formatTime(message.timestamp)}`}
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
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.content) }}
                />
              )}
            </div>

            {isLastInGroup && (
              <div className="flex items-center gap-1.5 mt-1 px-1">
                <span className="text-[11px] text-gray-500 dark:text-gray-500">
                  {formatTime(message.timestamp)}
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
          </div>
        </div>
      </>
    );
  }, (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
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
                      toast.error('Failed to create conversation. Please try again.');
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
    if (!lightboxImage) return null;

    return (
      <div
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

  // Render conversation view JSX directly (no wrapper function)
  const displayName = selectedConversation ? getConversationName(selectedConversation) : '';
  const otherUser =
    selectedConversation?.type === 'direct'
      ? getOtherParticipant(selectedConversation)
      : null;

  const conversationViewContent = selectedConversation ? (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setActiveConversationId(null)}
              className="md:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="relative flex-shrink-0">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                  selectedConversation.type === 'open'
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                    : selectedConversation.type === 'group'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                    : `bg-gradient-to-br ${getAvatarColor(selectedConversation.id)}`
                }`}
              >
                {selectedConversation.type === 'open' || selectedConversation.type === 'group' ? (
                  <Users className="w-6 h-6" />
                ) : (
                  getInitials(displayName)
                )}
              </div>
              {selectedConversation.type === 'direct' && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
              )}
            </div>

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
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
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
        >
          {conversationMessages.length === 0 ? (
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
              {conversationMessages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  previousMessage={conversationMessages[idx - 1] || null}
                  nextMessage={conversationMessages[idx + 1] || null}
                />
              ))}
              <div ref={messagesEndRef} />
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
  ) : (
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
        <div className="p-3 md:p-4 md:p-3 md:p-4 md:p-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('chat.title')}
            </h1>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <Plus className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
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
            >
              {t('chat.openChat')}
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
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
              <ConversationItem key={conversation.id} conversation={conversation} />
            ))
          )}
        </div>
      </div>

      {/* Conversation View */}
      <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 overflow-hidden`}>
        {conversationViewContent}
      </div>

      {/* Modals */}
      <NewChatModal />
      <ImageLightbox />
      </div>
    </ErrorBoundary>
  );
};

export default Chat;
