import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEmbedAuth } from './hooks/useEmbedAuth';
import { useEmbedPostMessage, type EmbedEntityData } from './hooks/useEmbedPostMessage';
import { EmbedChatThread } from './components/EmbedChatThread';
import { EmbedConversationList, type EmbedConversationSelection } from './components/EmbedConversationList';
import type { EmbedChatHeaderDeal } from './components/EmbedChatHeader';
import type { EmbedAuthPayload } from '../../services/api';
import { embedApi } from '../../services/api';
import './EmbedChat.css';

interface PostMessageEmitters {
  emitCreateEntity: (data: EmbedEntityData) => void;
  emitOpenEntity: (data: EmbedEntityData & { entity: { id: string; name: string; link: string; closed: boolean; responsibleUserName: string } }) => void;
}

const buildEntityData = (
  payload: EmbedAuthPayload,
  chatType: string,
  chatId: string,
  sessionId: string,
): EmbedEntityData => ({
  chatType,
  chatId,
  channelId: sessionId,
  userId: payload.crmUserId,
  integrationId: payload.tenantId,
});

const makeDealHandlers = (
  emitters: PostMessageEmitters,
  entity: EmbedEntityData,
) => ({
  onAddDeal: () => emitters.emitCreateEntity(entity),
  onOpenDeal: (deal: EmbedChatHeaderDeal) =>
    emitters.emitOpenEntity({
      ...entity,
      entity: {
        id: deal.id,
        name: deal.name,
        link: '#',
        closed: deal.closed,
        responsibleUserName: deal.responsibleUserName,
      },
    }),
});

interface CardChatProps {
  accessToken: string;
  payload: EmbedAuthPayload;
  chatType: string;
  chatId: string;
  fallbackSessionId: string;
  emitters: PostMessageEmitters;
}

const EmbedCardChat = ({ accessToken, payload, chatType, chatId, fallbackSessionId, emitters }: CardChatProps) => {
  const [resolved, setResolved] = useState<{ sessionId: string; contactName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    embedApi
      .conversations(accessToken)
      .then((list) => {
        if (cancelled) return;
        const conv = list.find((c) => c.chatId === chatId);
        if (conv) {
          setResolved({
            sessionId: conv.sessionId,
            contactName: conv.contactName || conv.phoneNumber || conv.chatId,
          });
        } else {
          setResolved({ sessionId: fallbackSessionId, contactName: chatId });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chat');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, chatId, fallbackSessionId]);

  if (error) return <div className="embed-fullscreen-status embed-fullscreen-status--error">{error}</div>;
  if (!resolved) return <div className="embed-fullscreen-status">Loading…</div>;

  const entity = buildEntityData(payload, chatType, chatId, resolved.sessionId);
  const handlers = makeDealHandlers(emitters, entity);

  return (
    <div className="embed-page">
      <EmbedChatThread
        accessToken={accessToken}
        sessionId={resolved.sessionId}
        chatId={chatId}
        chatType={chatType}
        contactName={resolved.contactName}
        useDealsEvents={payload.useDealsEvents}
        onOpenDeal={handlers.onOpenDeal}
        onAddDeal={handlers.onAddDeal}
      />
    </div>
  );
};

export const EmbedChatPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const authState = useEmbedAuth(token);
  const ready = authState.status === 'ready' ? authState.auth : null;
  const emitters = useEmbedPostMessage(ready?.payload.useDealsEvents ?? false);
  const [selected, setSelected] = useState<EmbedConversationSelection | null>(null);

  if (authState.status === 'loading') {
    return <div className="embed-fullscreen-status">Loading…</div>;
  }
  if (authState.status === 'expired') {
    return <div className="embed-fullscreen-status">This session has expired. Please reload the page.</div>;
  }
  if (authState.status === 'error') {
    return <div className="embed-fullscreen-status">Invalid session. Contact your administrator.</div>;
  }

  const { accessToken, payload } = authState.auth;

  if (payload.scope === 'card') {
    const chat = payload.filter?.[0] ?? payload.activeChat;
    if (!chat) {
      return <div className="embed-fullscreen-status">No chat specified for this session.</div>;
    }
    return (
      <EmbedCardChat
        accessToken={accessToken}
        payload={payload}
        chatType={chat.chatType}
        chatId={chat.chatId}
        fallbackSessionId={payload.activeChat?.channelId ?? ''}
        emitters={emitters}
      />
    );
  }

  // Global scope: list + thread
  const selectedEntity = selected
    ? buildEntityData(payload, 'whatsapp', selected.chatId, selected.sessionId)
    : null;
  const handlers = selectedEntity ? makeDealHandlers(emitters, selectedEntity) : null;

  return (
    <div className="embed-page embed-global-layout">
      <div className="embed-global-list">
        <EmbedConversationList
          accessToken={accessToken}
          selectedChatId={selected?.chatId ?? null}
          onSelect={setSelected}
        />
      </div>
      <div className="embed-global-thread">
        {selected && handlers ? (
          <EmbedChatThread
            accessToken={accessToken}
            sessionId={selected.sessionId}
            chatId={selected.chatId}
            chatType="whatsapp"
            contactName={selected.contactName}
            useDealsEvents={payload.useDealsEvents}
            onOpenDeal={handlers.onOpenDeal}
            onAddDeal={handlers.onAddDeal}
          />
        ) : (
          <div className="embed-fullscreen-status">Select a conversation</div>
        )}
      </div>
    </div>
  );
};
