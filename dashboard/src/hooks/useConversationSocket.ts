import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAuthToken } from '../services/api';

interface ConversationEvent {
  tenantId: string;
  sessionId: string;
  chatId: string;
  unreadCount?: number;
  assignedUserId?: string;
}

interface UseConversationSocketOptions {
  onNew?: (event: ConversationEvent) => void;
  onUpdated?: (event: ConversationEvent) => void;
  onAssigned?: (event: ConversationEvent) => void;
}

const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export function useConversationSocket(options: UseConversationSocketOptions = {}) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const socket: Socket = io(`${SOCKET_URL}/events`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Clerk session token, fetched fresh on each (re)connect handshake.
      auth: (cb: (data: { token: string | null }) => void) => {
        void getAuthToken().then(token => cb({ token }));
      },
    });

    const handleNew = (event: ConversationEvent) => optionsRef.current.onNew?.(event);
    const handleUpdated = (event: ConversationEvent) => optionsRef.current.onUpdated?.(event);
    const handleAssigned = (event: ConversationEvent) => optionsRef.current.onAssigned?.(event);

    socket.on('conversation.new', handleNew);
    socket.on('conversation.updated', handleUpdated);
    socket.on('conversation.assigned', handleAssigned);

    return () => {
      socket.off('conversation.new', handleNew);
      socket.off('conversation.updated', handleUpdated);
      socket.off('conversation.assigned', handleAssigned);
      socket.disconnect();
    };
  }, []);
}
