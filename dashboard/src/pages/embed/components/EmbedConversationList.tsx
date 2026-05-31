import { useCallback, useEffect, useState } from 'react';
import { embedApi, type Conversation } from '../../../services/api';
import { useEmbedSocket } from '../hooks/useEmbedSocket';
import '../EmbedChat.css';

export interface EmbedConversationSelection {
  sessionId: string;
  chatId: string;
  contactName: string;
}

export interface EmbedConversationListProps {
  accessToken: string;
  selectedChatId: string | null;
  onSelect: (conv: EmbedConversationSelection) => void;
}

const displayNameOf = (conv: Conversation): string =>
  conv.contactName || conv.phoneNumber || conv.chatId;

const formatTime = (iso: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const EmbedConversationList = ({
  accessToken,
  selectedChatId,
  onSelect,
}: EmbedConversationListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(
    async (signal: { cancelled: boolean }): Promise<void> => {
      try {
        const data = await embedApi.conversations(accessToken);
        if (signal.cancelled) return;
        setConversations(data);
        setError(null);
      } catch (err) {
        if (signal.cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      } finally {
        if (!signal.cancelled) setLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    setLoading(true);
    void fetchConversations(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [fetchConversations]);

  const refetch = useCallback(() => {
    void fetchConversations({ cancelled: false });
  }, [fetchConversations]);

  useEmbedSocket(accessToken, {
    onConversationNew: refetch,
    onConversationUpdated: refetch,
  });

  if (loading) {
    return <div className="embed-conv-status">Loading…</div>;
  }

  if (error) {
    return <div className="embed-conv-status embed-conv-status--error">{error}</div>;
  }

  if (conversations.length === 0) {
    return <div className="embed-conv-status">No conversations</div>;
  }

  return (
    <div className="embed-conv-list">
      {conversations.map((conv) => {
        const name = displayNameOf(conv);
        const time = formatTime(conv.lastMessageAt);
        const isSelected = conv.chatId === selectedChatId;
        return (
          <button
            key={`${conv.sessionId}:${conv.chatId}`}
            type="button"
            className={`embed-conv-item${isSelected ? ' selected' : ''}`}
            onClick={() =>
              onSelect({ sessionId: conv.sessionId, chatId: conv.chatId, contactName: name })
            }
          >
            <span className="embed-conv-name">{name}</span>
            {time && <span className="embed-conv-time">{time}</span>}
            {conv.unreadCount > 0 && (
              <span className="embed-conv-unread">{conv.unreadCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
