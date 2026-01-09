import { memo } from 'react';
import DOMPurify from 'dompurify';
import { Clock, Check, XCircle, File } from 'lucide-react';

// Utility functions
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
  return timeDiff < 60000; // 1 minute
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

const MessageBubble = memo(({
  message,
  previousMessage,
  nextMessage,
  currentUserId,
  users,
  conversationType,
  onLightboxOpen,
}) => {
  const isOwn = message.senderId === currentUserId;
  const sender = users.find((u) => u.id === message.senderId) || { name: message.senderName || 'Unknown' };
  const isGrouped = shouldGroupMessage(message, previousMessage);
  const isLastInGroup = !shouldGroupMessage(nextMessage, message);
  const showDateSeparator = shouldShowDateSeparator(message, previousMessage);

  // Parse attachment metadata
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
        {/* Avatar for group/open chats */}
        {!isOwn && conversationType !== 'direct' ? (
          isGrouped ? (
            <div className="w-8 h-8 flex-shrink-0" />
          ) : (
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(
                message.senderId
              )} text-white flex items-center justify-center text-xs font-bold shadow`}
              style={{ willChange: 'transform' }}
            >
              {getInitials(sender?.name || 'U')}
            </div>
          )
        ) : null}

        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
          {/* Sender name for group messages */}
          {!isOwn && conversationType !== 'direct' && !isGrouped && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 px-1">
              {sender?.name}
            </span>
          )}

          {/* Message bubble */}
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
            style={{
              willChange: 'transform',
              transform: 'translateZ(0)', // GPU acceleration
            }}
          >
            {isImageAttachment ? (
              <div className="flex flex-col">
                <img
                  src={attachment.url}
                  alt={attachment.filename}
                  className="max-w-full max-h-96 rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => onLightboxOpen({ url: attachment.url, filename: attachment.filename })}
                  loading="lazy"
                  style={{
                    contentVisibility: 'auto',
                  }}
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

          {/* Timestamp and status */}
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
  // Aggressive custom comparison - only re-render if message content changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message._isPending === nextProps.message._isPending &&
    prevProps.message._failed === nextProps.message._failed &&
    prevProps.previousMessage?.id === nextProps.previousMessage?.id &&
    prevProps.nextMessage?.id === nextProps.nextMessage?.id &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.conversationType === nextProps.conversationType
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
