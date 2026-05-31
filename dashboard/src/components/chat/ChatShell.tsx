import { useMemo } from 'react';
import type { RefObject } from 'react';
import { CheckCheck, Loader2, MessageSquare, Send, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage, Conversation } from '../../services/api';
import './chat.css';

// eslint-disable-next-line react-refresh/only-export-components -- shared helper reused by the embed
export const formatPhone = (phone: string): string => (phone.startsWith('+') ? phone : `+${phone}`);

// eslint-disable-next-line react-refresh/only-export-components -- shared helper reused by the embed
export const displayName = (conversation: Conversation): string =>
  conversation.contactName ?? (conversation.phoneNumber ? formatPhone(conversation.phoneNumber) : conversation.chatId);

// Phone number shown as a secondary line, only when the primary line is a name
const contactSubtitle = (conversation: Conversation): string | null =>
  conversation.contactName && conversation.phoneNumber ? formatPhone(conversation.phoneNumber) : null;

export interface ChatShellSelection {
  sessionId: string;
  chatId: string;
}

export interface ChatShellProps {
  showConversationList?: boolean;
  conversations: Conversation[];
  conversationsLoading: boolean;
  selected: ChatShellSelection | null;
  onSelect: (selection: ChatShellSelection) => void;
  selectedConversation: Conversation | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  replyText: string;
  onReplyTextChange: (value: string) => void;
  onSendReply: () => void;
  sendPending: boolean;
  replyInputRef: RefObject<HTMLTextAreaElement | null>;
  onMarkRead: (conversation: Conversation) => void;
  markReadPending: boolean;
}

export function ChatShell({
  showConversationList = true,
  conversations,
  conversationsLoading,
  selected,
  onSelect,
  selectedConversation,
  messages,
  messagesLoading,
  replyText,
  onReplyTextChange,
  onSendReply,
  sendPending,
  replyInputRef,
  onMarkRead,
  markReadPending,
}: ChatShellProps) {
  const { t } = useTranslation();
  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <div className={`chat-shell${showConversationList === false ? ' chat-shell--single' : ''}`}>
      {showConversationList !== false && (
        <aside className="conversation-list-panel">
          <div className="conversation-list-header">
            <MessageSquare size={18} />
            <span>{t('conversations.listTitle')}</span>
          </div>

          <div className="conversation-list">
            {conversationsLoading && (
              <div className="chat-loading">
                <Loader2 className="animate-spin" size={24} />
              </div>
            )}

            {!conversationsLoading && conversations.length === 0 && (
              <div className="chat-empty">{t('conversations.emptyList')}</div>
            )}

            {conversations.map(conversation => (
              <ConversationRow
                key={`${conversation.sessionId}:${conversation.chatId}`}
                conversation={conversation}
                isSelected={conversation.sessionId === selected?.sessionId && conversation.chatId === selected.chatId}
                onSelect={() => onSelect({ sessionId: conversation.sessionId, chatId: conversation.chatId })}
              />
            ))}
          </div>
        </aside>
      )}

      <main className="message-thread-panel">
        {selectedConversation ? (
          <>
            <header className="thread-header">
              <div className="thread-title">
                <strong>{displayName(selectedConversation)}</strong>
                {selectedConversation.contactName && selectedConversation.phoneNumber && (
                  <span className="thread-subtitle">{formatPhone(selectedConversation.phoneNumber)}</span>
                )}
                <span className="thread-subtitle">{selectedConversation.sessionId}</span>
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
                onClick={() => onMarkRead(selectedConversation)}
                disabled={markReadPending || selectedConversation.unreadCount === 0}
              >
                <CheckCheck size={17} />
              </button>
            </header>

            <div className="message-thread">
              {messagesLoading && (
                <div className="chat-loading">
                  <Loader2 className="animate-spin" size={24} />
                </div>
              )}
              {!messagesLoading && orderedMessages.length === 0 && (
                <div className="chat-empty">{t('conversations.emptyMessages')}</div>
              )}
              {orderedMessages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>

            <div className="reply-bar">
              <textarea
                ref={replyInputRef}
                className="reply-input"
                placeholder={t('conversations.replyPlaceholder', 'Type a message…')}
                value={replyText}
                rows={1}
                onChange={e => onReplyTextChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSendReply();
                  }
                }}
                disabled={sendPending}
              />
              <button
                className="send-btn"
                type="button"
                onClick={onSendReply}
                disabled={!replyText.trim() || sendPending}
                aria-label="Send"
              >
                {sendPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
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
        <span className="conversation-chat-id">{displayName(conversation)}</span>
        {contactSubtitle(conversation) && (
          <span className="conversation-subtitle">{contactSubtitle(conversation)}</span>
        )}
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
