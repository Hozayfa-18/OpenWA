import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/PageHeader';
import { ChatShell } from '../components/chat/ChatShell';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useConversationSocket } from '../hooks/useConversationSocket';
import { conversationApi, messageApi, type Conversation } from '../services/api';

export function Conversations() {
  const { t } = useTranslation();
  useDocumentTitle(t('conversations.title'));
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<{ sessionId: string; chatId: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

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

  const sendReplyMutation = useMutation({
    mutationFn: ({ sessionId, chatId, text }: { sessionId: string; chatId: string; text: string }) =>
      messageApi.sendText(sessionId, chatId, text),
    onSuccess: () => {
      setReplyText('');
      if (selected) {
        void queryClient.invalidateQueries({
          queryKey: ['conversation-messages', selected.sessionId, selected.chatId],
        });
      }
      replyInputRef.current?.focus();
    },
  });

  const handleSendReply = useCallback(() => {
    const text = replyText.trim();
    if (!text || !selected || sendReplyMutation.isPending) return;
    sendReplyMutation.mutate({ sessionId: selected.sessionId, chatId: selected.chatId, text });
  }, [replyText, selected, sendReplyMutation]);

  return (
    <div className="conversations-page">
      <PageHeader title={t('conversations.title')} subtitle={t('conversations.subtitle')} />
      <ChatShell
        conversations={conversations}
        conversationsLoading={isLoading}
        selected={selected}
        onSelect={setSelected}
        selectedConversation={selectedConversation}
        messages={messages}
        messagesLoading={loadingMessages}
        replyText={replyText}
        onReplyTextChange={setReplyText}
        onSendReply={handleSendReply}
        sendPending={sendReplyMutation.isPending}
        replyInputRef={replyInputRef}
        onMarkRead={(c) => markReadMutation.mutate(c)}
        markReadPending={markReadMutation.isPending}
      />
    </div>
  );
}
