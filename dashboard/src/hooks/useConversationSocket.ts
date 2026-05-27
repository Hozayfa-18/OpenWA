import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

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
  optionsRef.current = options;

  useEffect(() => {
    const apiKey = sessionStorage.getItem('openwa_api_key');
    if (!apiKey) return undefined;

    const socket: Socket = io(`${SOCKET_URL}/events`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      query: { apiKey },
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
