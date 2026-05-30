import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;

interface UseEmbedSocketOptions {
  onMessageReceived?: (data: unknown) => void;
  onConversationUpdated?: (data: unknown) => void;
  onConversationNew?: (data: unknown) => void;
}

export const useEmbedSocket = (
  accessToken: string | null,
  options: UseEmbedSocketOptions = {},
): void => {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!accessToken) return undefined;

    const socket: Socket = io(`${SOCKET_URL}/events`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      extraHeaders: { Authorization: `Bearer ${accessToken}` },
    });

    const handleMessage = (data: unknown) => optionsRef.current.onMessageReceived?.(data);
    const handleUpdated = (data: unknown) => optionsRef.current.onConversationUpdated?.(data);
    const handleNew = (data: unknown) => optionsRef.current.onConversationNew?.(data);

    socket.on('message.received', handleMessage);
    socket.on('conversation.updated', handleUpdated);
    socket.on('conversation.new', handleNew);

    return () => {
      socket.off('message.received', handleMessage);
      socket.off('conversation.updated', handleUpdated);
      socket.off('conversation.new', handleNew);
      socket.disconnect();
    };
  }, [accessToken]);
};
