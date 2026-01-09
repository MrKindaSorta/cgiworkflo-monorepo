import { useState, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Plus, Image, Camera, Paperclip } from 'lucide-react';

const MessageInput = memo(({ onSendMessage, sending, uploading, onFileUpload }) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const attachmentMenuRef = useRef(null);
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    onSendMessage(message.trim());
    setMessage('');
  };

  const handleFileSelect = (files, type) => {
    if (files && files.length > 0) {
      onFileUpload(Array.from(files), type);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex items-end gap-3 relative">
        {/* Attachment Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            disabled={uploading}
            className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors flex-shrink-0 disabled:opacity-50"
          >
            <Plus className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Attachment Menu */}
          {showAttachmentMenu && (
            <div
              ref={attachmentMenuRef}
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
            onChange={(e) => setMessage(e.target.value)}
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
        onChange={(e) => {
          handleFileSelect(e.target.files, 'image');
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          handleFileSelect(e.target.files, 'file');
          e.target.value = '';
        }}
      />
    </form>
  );
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;
