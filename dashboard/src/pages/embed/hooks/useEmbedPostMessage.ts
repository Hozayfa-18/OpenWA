import { useCallback } from 'react';

export interface EmbedEntityData {
  chatType: string;
  chatId: string;
  channelId: string;
  userId: string;
  integrationId: string;
}

export interface EmbedDealEntity {
  id: string;
  name: string;
  link: string;
  closed: boolean;
  responsibleUserName: string;
}

export const useEmbedPostMessage = (enabled: boolean) => {
  const emitCreateEntity = useCallback(
    (data: EmbedEntityData) => {
      if (!enabled) return;
      window.parent.postMessage({ type: 'WZ_CREATE_ENTITY', data }, '*');
    },
    [enabled],
  );

  const emitOpenEntity = useCallback(
    (data: EmbedEntityData & { entity: EmbedDealEntity }) => {
      if (!enabled) return;
      window.parent.postMessage({ type: 'WZ_OPEN_ENTITY', data }, '*');
    },
    [enabled],
  );

  return { emitCreateEntity, emitOpenEntity };
};
