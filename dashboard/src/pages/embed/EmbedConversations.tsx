import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatShell, type ChatShellSelection } from '../../components/chat/ChatShell';
import { useEmbedSocket } from './hooks/useEmbedSocket';
import { embedApi, type Conversation } from '../../services/api';

interface EmbedConversationsProps {
  accessToken: string;
  scope: 'global' | 'card';
}

export const EmbedConversations = ({ accessToken, scope }: EmbedConversationsProps) => {
  const queryClient = useQueryClient();
  const isCard = scope === 'card';
  const [selected, setSelected] = useState<ChatShellSelection | null>(null);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['embed-conversations', accessToken],
    queryFn: () => embedApi.conversations(accessToken),
    refetchInterval: 30_000,
  });

  // Card scope: auto-select the single scoped conversation once it loads.
  useEffect(() => {
    if (isCard && !selected && conversations.length > 0) {
      setSelected({ sessionId: conversations[0].sessionId, chatId: conversations[0].chatId });
    }
  }, [isCard, selected, conversations]);

  const selectedConversation =
    conversations.find(
      (c) => c.sessionId === selected?.sessionId && c.chatId === selected?.chatId,
    ) ?? null;

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['embed-messages', accessToken, selected?.sessionId, selected?.chatId],
    queryFn: () => embedApi.messages(accessToken, selected?.sessionId ?? '', selected?.chatId ?? ''),
    enabled: selected !== null,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['embed-conversations', accessToken] });
    if (selected) {
      void queryClient.invalidateQueries({
        queryKey: ['embed-messages', accessToken, selected.sessionId, selected.chatId],
      });
    }
  }, [queryClient, accessToken, selected]);

  useEmbedSocket(accessToken, {
    onConversationNew: invalidate,
    onConversationUpdated: invalidate,
    onMessageReceived: invalidate,
  });

  const markReadMutation = useMutation({
    mutationFn: (c: Conversation) => embedApi.markRead(accessToken, c.sessionId, c.chatId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['embed-conversations', accessToken] }),
  });

  const sendReplyMutation = useMutation({
    mutationFn: ({ sessionId, chatId, text }: { sessionId: string; chatId: string; text: string }) =>
      embedApi.sendText(accessToken, sessionId, chatId, text),
    onSuccess: () => {
      setReplyText('');
      void queryClient.invalidateQueries({ queryKey: ['embed-conversations', accessToken] });
      if (selected) {
        void queryClient.invalidateQueries({
          queryKey: ['embed-messages', accessToken, selected.sessionId, selected.chatId],
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
    <div className="embed-conversations">
      <ChatShell
        showConversationList={!isCard}
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
        resolveMediaUrl={(m) => embedApi.mediaUrl(accessToken, m.sessionId, m.chatId, m.id)}
      />
    </div>
  );
};
