import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Loader2, MessageSquare, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useConversationSocket } from '../hooks/useConversationSocket';
import { conversationApi, type ChatMessage, type Conversation } from '../services/api';
import './Conversations.css';

export function Conversations() {
  const { t } = useTranslation();
  useDocumentTitle(t('conversations.title'));
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<{ sessionId: string; chatId: string } | null>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationApi.list(),
    refetchInterval: 30_000,
  });

  const selectedConversation =
    conversations.find(
      conversation => conversation.sessionId === selected?.sessionId && conversation.chatId === selected.chatId,
    ) ?? null;

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['conversation-messages', selected?.sessionId, selected?.chatId],
    queryFn: () => conversationApi.messages(selected?.sessionId ?? '', selected?.chatId ?? ''),
    enabled: selected !== null,
  });

  const invalidateConversations = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    if (selected) {
      void queryClient.invalidateQueries({ queryKey: ['conversation-messages', selected.sessionId, selected.chatId] });
    }
  }, [queryClient, selected]);

  useConversationSocket({
    onNew: invalidateConversations,
    onUpdated: invalidateConversations,
    onAssigned: invalidateConversations,
  });

  const markReadMutation = useMutation({
    mutationFn: (conversation: Conversation) => conversationApi.markRead(conversation.sessionId, conversation.chatId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <div className="conversations-page">
      <PageHeader title={t('conversations.title')} subtitle={t('conversations.subtitle')} />

      <div className="chat-shell">
        <aside className="conversation-list-panel">
          <div className="conversation-list-header">
            <MessageSquare size={18} />
            <span>{t('conversations.listTitle')}</span>
          </div>

          <div className="conversation-list">
            {isLoading && (
              <div className="chat-loading">
                <Loader2 className="animate-spin" size={24} />
              </div>
            )}

            {!isLoading && conversations.length === 0 && (
              <div className="chat-empty">{t('conversations.emptyList')}</div>
            )}

            {conversations.map(conversation => (
              <ConversationRow
                key={`${conversation.sessionId}:${conversation.chatId}`}
                conversation={conversation}
                isSelected={conversation.sessionId === selected?.sessionId && conversation.chatId === selected.chatId}
                onSelect={() => setSelected({ sessionId: conversation.sessionId, chatId: conversation.chatId })}
              />
            ))}
          </div>
        </aside>

        <main className="message-thread-panel">
          {selectedConversation ? (
            <>
              <header className="thread-header">
                <div className="thread-title">
                  <strong>{selectedConversation.chatId}</strong>
                  {selectedConversation.assignedUserId && (
                    <span>
                      <UserCheck size={14} />
                      {selectedConversation.assignedUserId}
                    </span>
                  )}
                </div>
                <button
                  className="icon-btn"
                  type="button"
                  title={t('conversations.markRead')}
                  aria-label={t('conversations.markRead')}
                  onClick={() => markReadMutation.mutate(selectedConversation)}
                  disabled={markReadMutation.isPending || selectedConversation.unreadCount === 0}
                >
                  <CheckCheck size={17} />
                </button>
              </header>

              <div className="message-thread">
                {loadingMessages && (
                  <div className="chat-loading">
                    <Loader2 className="animate-spin" size={24} />
                  </div>
                )}
                {!loadingMessages && orderedMessages.length === 0 && (
                  <div className="chat-empty">{t('conversations.emptyMessages')}</div>
                )}
                {orderedMessages.map(message => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            </>
          ) : (
            <div className="thread-placeholder">
              <MessageSquare size={44} />
              <p>{t('conversations.selectPrompt')}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const time = new Date(conversation.lastMessageAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <button className={`conversation-row ${isSelected ? 'selected' : ''}`} type="button" onClick={onSelect}>
      <span className="conversation-main">
        <span className="conversation-chat-id">{conversation.chatId}</span>
        {conversation.assignedUserId && (
          <span className="conversation-assignee">
            <UserCheck size={12} />
            {conversation.assignedUserId}
          </span>
        )}
      </span>
      <span className="conversation-meta">
        <span>{time}</span>
        {conversation.unreadCount > 0 && <span className="unread-pill">{conversation.unreadCount}</span>}
      </span>
    </button>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isOutgoing = message.direction === 'outgoing';
  const time = message.timestamp
    ? new Date(message.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}>
      <div className="message-bubble">
        <div className="message-body">{message.body || <em>[{message.type}]</em>}</div>
        {time && <div className="message-time">{time}</div>}
      </div>
    </div>
  );
}
