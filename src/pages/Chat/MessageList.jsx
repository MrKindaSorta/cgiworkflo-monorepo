import { useEffect, useRef, memo, useState, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import MessageBubble from './MessageBubble';

// Throttle function for scroll events
const throttle = (func, delay) => {
  let timeoutId;
  let lastRan;
  return function (...args) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (Date.now() - lastRan >= delay) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, delay - (Date.now() - lastRan));
    }
  };
};

const MessageList = memo(({ messages, currentUserId, users, conversationType, onLightboxOpen }) => {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const observerRef = useRef(null);

  // Smart auto-scroll - only when user is at bottom
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      // Use requestAnimationFrame for smooth scroll
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      });
    }
  }, [messages.length, isAtBottom]);

  // Optimized scroll detection with IntersectionObserver
  useEffect(() => {
    if (!messagesEndRef.current || !scrollContainerRef.current) return;

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer with optimized options
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsAtBottom(entry.isIntersecting);
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
        rootMargin: '0px 0px 50px 0px', // Trigger slightly before reaching bottom
      }
    );

    observerRef.current.observe(messagesEndRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [messages.length]); // Only recreate when message count changes

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 bg-gray-50 dark:bg-gray-900 mobile-scroll">
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="w-10 h-10 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            No messages yet. Start the conversation!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 bg-gray-50 dark:bg-gray-900 mobile-scroll"
      style={{
        contain: 'layout style paint',
        willChange: 'scroll-position',
      }}
    >
      {messages.map((msg, idx) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          previousMessage={messages[idx - 1] || null}
          nextMessage={messages[idx + 1] || null}
          currentUserId={currentUserId}
          users={users}
          conversationType={conversationType}
          onLightboxOpen={onLightboxOpen}
        />
      ))}
      <div ref={messagesEndRef} style={{ height: 1 }} />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if messages actually changed
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.messages[prevProps.messages.length - 1]?.id === nextProps.messages[nextProps.messages.length - 1]?.id &&
    prevProps.currentUserId === nextProps.currentUserId &&
    prevProps.conversationType === nextProps.conversationType
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
