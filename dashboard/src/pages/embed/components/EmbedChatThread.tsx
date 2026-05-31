import { useCallback, useEffect, useRef, useState } from 'react';
import { embedApi, type ChatMessage } from '../../../services/api';
import { useEmbedSocket } from '../hooks/useEmbedSocket';
import { EmbedChatHeader, type EmbedChatHeaderDeal } from './EmbedChatHeader';
import { EmbedMessageInput } from './EmbedMessageInput';
import '../EmbedChat.css';

export interface EmbedChatThreadProps {
  accessToken: string;
  sessionId: string;
  chatId: string;
  chatType: string;
  contactName: string;
  useDealsEvents: boolean;
  onOpenDeal: (deal: EmbedChatHeaderDeal) => void;
  onAddDeal: () => void;
}

const isEventForChat = (data: unknown, chatId: string): boolean =>
  typeof data === 'object' &&
  data !== null &&
  (data as { chatId?: unknown }).chatId === chatId;

const formatTime = (timestamp: number): string =>
  new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const EmbedChatThread = ({
  accessToken,
  sessionId,
  chatId,
  chatType,
  contactName,
  useDealsEvents,
  onOpenDeal,
  onAddDeal,
}: EmbedChatThreadProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [deals, setDeals] = useState<EmbedChatHeaderDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);

  const fetchDeals = useCallback(async () => {
    try {
      const result = await embedApi.dealsByChat(accessToken, chatType, chatId);
      if (cancelledRef.current) return;
      setDeals(result);
    } catch {
      if (cancelledRef.current) return;
      // Deals are supplementary; on failure just clear them.
      setDeals([]);
    }
  }, [accessToken, chatType, chatId]);

  const fetchMessages = useCallback(async () => {
    try {
      const result = await embedApi.messages(accessToken, sessionId, chatId);
      if (cancelledRef.current) return;
      // Backend returns newest-first; reverse for oldest-at-top display.
      setMessages([...result].reverse());
      setError(null);
    } catch {
      if (cancelledRef.current) return;
      setError('Failed to load messages.');
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [accessToken, sessionId, chatId]);

  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    void fetchMessages();
    void fetchDeals();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchMessages, fetchDeals]);

  useEffect(() => {
    const handler = (): void => {
      void fetchDeals();
    };
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('focus', handler);
    };
  }, [fetchDeals]);

  useEmbedSocket(accessToken, {
    onMessageReceived: (data) => {
      if (isEventForChat(data, chatId)) void fetchMessages();
    },
    onConversationUpdated: (data) => {
      if (isEventForChat(data, chatId)) void fetchMessages();
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      setSending(true);
      try {
        await embedApi.sendText(accessToken, sessionId, chatId, text);
        await fetchMessages();
      } catch {
        setError('Failed to send message.');
      } finally {
        setSending(false);
      }
    },
    [accessToken, sessionId, chatId, fetchMessages],
  );

  return (
    <div className="embed-chat-thread">
      <EmbedChatHeader
        contactName={contactName}
        chatId={chatId}
        chatType={chatType}
        deals={deals}
        useDealsEvents={useDealsEvents}
        onOpenDeal={onOpenDeal}
        onAddDeal={onAddDeal}
      />

      <div className="embed-thread">
        {loading ? (
          <div className="embed-thread-status">Loading…</div>
        ) : error && messages.length === 0 ? (
          <div className="embed-thread-status embed-thread-status--error">{error}</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`embed-msg-row ${message.direction === 'outgoing' ? 'outgoing' : 'incoming'}`}
            >
              <div className="embed-msg-bubble">
                <span className="embed-msg-body">
                  {message.body !== null ? message.body : <em>[{message.type}]</em>}
                </span>
                {message.timestamp !== null && (
                  <span className="embed-msg-time">{formatTime(message.timestamp)}</span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <EmbedMessageInput onSend={handleSend} disabled={sending} />
    </div>
  );
};
