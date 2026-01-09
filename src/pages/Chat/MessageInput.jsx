import { useState, useRef, memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Plus, Image, Camera, Paperclip } from 'lucide-react';

const MessageInput = memo(({ onSendMessage, sending, uploading, onFileUpload, onTyping }) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const attachmentMenuRef = useRef(null);
  const attachmentButtonRef = useRef(null);
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Debug: Track component renders
  useEffect(() => {
    console.debug('[MessageInput] Component rendered/mounted');
  });

  // Click-away and ESC key detection for attachment menu
  useEffect(() => {
    if (!showAttachmentMenu) return;

    const handleClickOutside = (event) => {
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(event.target) &&
        attachmentButtonRef.current &&
        !attachmentButtonRef.current.contains(event.target)
      ) {
        setShowAttachmentMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowAttachmentMenu(false);
        attachmentButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showAttachmentMenu]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    // Stop typing indicator
    if (isTypingRef.current && onTyping) {
      onTyping(false);
      isTypingRef.current = false;
    }

    onSendMessage(message.trim());
    setMessage('');
  };

  // Handle typing indicator
  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    if (!onTyping) return;

    // If user is typing, send typing indicator
    if (value.length > 0 && !isTypingRef.current) {
      onTyping(true);
      isTypingRef.current = true;
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current && onTyping) {
        onTyping(false);
        isTypingRef.current = false;
      }
    }, 3000);
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && onTyping) {
        onTyping(false);
      }
    };
  }, [onTyping]);

  // MIME type validation
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  const ALLOWED_FILE_TYPES = [
    ...ALLOWED_IMAGE_TYPES,
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
  ];

  const validateFile = (file, type) => {
    const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_FILE_TYPES;

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type "${file.type}" is not allowed. ${type === 'image' ? 'Only images are allowed.' : 'Only documents, images, and archives are allowed.'}`,
      };
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File "${file.name}" is too large. Maximum size is 10MB.`,
      };
    }

    return { valid: true };
  };

  const handleFileSelect = (files, type) => {
    if (files && files.length > 0) {
      const fileArray = Array.from(files);

      // Validate all files
      for (const file of fileArray) {
        const validation = validateFile(file, type);
        if (!validation.valid) {
          // Show error toast (assuming toast is available globally)
          console.error('File validation failed:', validation.error);
          alert(validation.error); // Fallback to alert if toast not available
          return;
        }
      }

      onFileUpload(fileArray, type);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex items-end gap-3 relative">
        {/* Attachment Button */}
        <div className="relative">
          <button
            ref={attachmentButtonRef}
            type="button"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            disabled={sending || uploading}
            aria-label="Attach files"
            aria-expanded={showAttachmentMenu}
            aria-haspopup="menu"
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors flex-shrink-0 disabled:opacity-50"
          >
            <Plus className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Attachment Menu */}
          {showAttachmentMenu && (
            <div
              ref={attachmentMenuRef}
              role="menu"
              aria-label="Attachment options"
              className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]"
            >
              <button
                type="button"
                onClick={() => {
                  photoInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                disabled={uploading}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                  <Image className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">Photo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  cameraInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                disabled={uploading}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white flex items-center justify-center shadow-md">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">Camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowAttachmentMenu(false);
                }}
                disabled={uploading}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center shadow-md">
                  <Paperclip className="w-5 h-5" />
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100">File</span>
              </button>

              {uploading && (
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 text-center">
                  Uploading...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={message}
            onChange={handleInputChange}
            placeholder={t('chat.typeMessage')}
            aria-label="Message input"
            aria-describedby={sending ? 'sending-status' : undefined}
            disabled={sending || uploading}
            className="w-full px-5 py-3.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-50"
          />
          {sending && <span id="sending-status" className="sr-only">Sending message</span>}
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!message.trim() || sending || uploading}
          className="p-3.5 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/25 flex-shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          handleFileSelect(e.target.files, 'image');
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          handleFileSelect(e.target.files, 'image');
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          handleFileSelect(e.target.files, 'file');
          e.target.value = '';
        }}
      />
    </form>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if props actually changed
  // This prevents re-renders when parent updates but props remain functionally the same
  return (
    prevProps.sending === nextProps.sending &&
    prevProps.uploading === nextProps.uploading &&
    prevProps.onSendMessage === nextProps.onSendMessage &&
    prevProps.onFileUpload === nextProps.onFileUpload &&
    prevProps.onTyping === nextProps.onTyping
  );
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;
