import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import {
  MessageSquare,
  Users,
  Send,
  ArrowLeft,
  Search,
  MoreVertical,
  Phone,
  Video,
  Plus,
  X,
  Image,
  File,
  Camera,
  Paperclip,
  UserPlus,
} from 'lucide-react';

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
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const attachmentMenuRef = useRef(null);

  // Memoize to prevent re-renders when conversations array updates
  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId),
    [conversations, activeConversationId]
  );

  const conversationMessages = useMemo(
    () => (activeConversationId ? messages[activeConversationId] || [] : []),
    [activeConversationId, messages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages, selectedConversation]);

  // Keep input focused when conversation is active
  useEffect(() => {
    if (selectedConversation && inputRef.current && document.activeElement !== inputRef.current) {
      // Only focus if something else has focus (not during typing)
      const activeElement = document.activeElement;
      if (!activeElement || activeElement.tagName !== 'INPUT' || activeElement.type !== 'text') {
        inputRef.current.focus();
      }
    }
  }, [selectedConversation]);

  // Prevent focus loss by maintaining focus on the input
  const lastFocusedRef = useRef(false);
  useEffect(() => {
    if (!inputRef.current) return;

    const handleFocus = () => {
      lastFocusedRef.current = true;
    };

    const handleBlur = () => {
      lastFocusedRef.current = false;
    };

    const input = inputRef.current;
    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);

    return () => {
      input.removeEventListener('focus', handleFocus);
      input.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
        setShowAttachmentMenu(false);
      }
    };

    if (showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachmentMenu]);

  const getOtherParticipant = (conversation) => {
    if (conversation.type !== 'direct') return null;
    const participants = conversation.participants || [];
    const otherId = participants.find((p) => p.userId !== user.id)?.userId;
    return users.find((u) => u.id === otherId);
  };

  const getConversationName = (conversation) => {
    if (conversation.type === 'open') return 'Open Chat';
    if (conversation.type === 'group') return conversation.name || 'Unnamed Group';
    if (conversation.type === 'direct') {
      const otherUser = getOtherParticipant(conversation);
      return otherUser?.name || 'Unknown User';
    }
    return 'Unknown';
  };

  const filteredConversations = conversations
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

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
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

  const shouldShowDateSeparator = (currentMsg, previousMsg) => {
    if (!currentMsg) return false;
    if (!previousMsg) return true;
    const currentDate = new Date(currentMsg.timestamp).toDateString();
    const previousDate = new Date(previousMsg.timestamp).toDateString();
    return currentDate !== previousDate;
  };

  const shouldGroupMessage = (currentMsg, previousMsg) => {
    if (!previousMsg || !currentMsg) return false;
    if (currentMsg.senderId !== previousMsg.senderId) return false;
    const timeDiff = new Date(currentMsg.timestamp) - new Date(previousMsg.timestamp);
    return timeDiff < 60000;
  };

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversationId || sending) return;

    try {
      await sendMessage(activeConversationId, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  }, [newMessage, activeConversationId, sending, sendMessage]);

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

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (id) => {
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
    const index = parseInt(id) % colors.length;
    return colors[index];
  };

  const ConversationItem = ({ conversation }) => {
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
        className={`w-full p-3 md:p-4 flex items-start gap-3 transition-all duration-200 border-b ${
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/50 border-primary-200 dark:border-primary-800 border-l-4 border-l-primary-500 dark:border-l-primary-400'
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
                hasUnread ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {displayName}
            </h3>
            <span
              className={`text-xs ml-2 flex-shrink-0 ${
                hasUnread
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
                hasUnread
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
  };

  const MessageBubble = ({ message, previousMessage, nextMessage }) => {
    const isOwn = message.senderId === user.id;
    const sender = users.find((u) => u.id === message.senderId) || { name: message.senderName || 'Unknown' };
    const isGrouped = shouldGroupMessage(message, previousMessage);
    const isLastInGroup = !shouldGroupMessage(nextMessage, message);
    const showDateSeparator = shouldShowDateSeparator(message, previousMessage);

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
          className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${
            isGrouped ? 'mt-1' : 'mt-4'
          }`}
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
              className={`px-4 py-2.5 rounded-xl ${
                isOwn
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-md'
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
            >
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>

            {isLastInGroup && (
              <span className="text-[11px] text-gray-500 dark:text-gray-500 mt-1 px-1">
                {formatTime(message.timestamp)}
              </span>
            )}
          </div>
        </div>
      </>
    );
  };

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
                      alert('Failed to create conversation. Please try again.');
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

  // Attachment Menu Component
  const AttachmentMenu = () => {
    if (!showAttachmentMenu) return null;

    const attachmentOptions = [
      { icon: Image, label: 'Photo', color: 'from-blue-500 to-blue-600' },
      { icon: Camera, label: 'Camera', color: 'from-green-500 to-green-600' },
      { icon: File, label: 'Document', color: 'from-purple-500 to-purple-600' },
      { icon: Paperclip, label: 'File', color: 'from-orange-500 to-orange-600' },
    ];

    return (
      <div
        ref={attachmentMenuRef}
        className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]"
      >
        {attachmentOptions.map((option) => (
          <button
            key={option.label}
            onClick={() => {
              alert(`${option.label} attachment selected (mock)`);
              setShowAttachmentMenu(false);
            }}
            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <div
              className={`w-10 h-10 rounded-full bg-gradient-to-br ${option.color} text-white flex items-center justify-center shadow-md`}
            >
              <option.icon className="w-5 h-5" />
            </div>
            <span className="font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
          </button>
        ))}
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
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
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
              <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <Video className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 bg-gray-50 dark:bg-gray-900">
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
              {conversationMessages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  previousMessage={conversationMessages[index - 1]}
                  nextMessage={conversationMessages[index + 1]}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <form
          onSubmit={handleSendMessage}
          className="px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        >
          <div className="flex items-end gap-3 relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors flex-shrink-0"
              >
                <Plus className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
              <AttachmentMenu />
            </div>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={t('chat.typeMessage')}
                className="w-full px-5 py-3.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="p-3.5 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/25 flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
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
    <div className="fixed inset-0 top-16 bottom-16 md:static md:h-full flex flex-col md:flex-row bg-white dark:bg-gray-800 overflow-hidden">
      {/* Conversation List */}
      <div
        className={`${
          selectedConversation ? 'hidden md:flex' : 'flex'
        } md:w-96 flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700`}
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
          {filteredConversations.length === 0 ? (
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
      {conversationViewContent}

      {/* Modals */}
      <NewChatModal />
    </div>
  );
};

export default Chat;
