import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { iframeApi } from '../services/api';
import './CrmChat.css';

// Demonstrates the CRM-side integration: this page is the "CRM" host and it embeds
// the chat window iframe. The iframe renders the full Conversations UI (list + thread)
// in global scope, so it looks and works exactly like the dashboard Conversations page.
export const CrmChat = () => {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    iframeApi
      .generate({
        user: { id: 'dashboard-user', name: 'Dashboard User' },
        scope: 'global',
        use_events: { deals: false },
      })
      .then((res) => {
        if (cancelled) return;
        const token = new URL(res.url).searchParams.get('token');
        if (!token) throw new Error('No token in generated iframe url');
        setIframeSrc(`/embed/chat?token=${token}`);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load chat');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <div className="crm-chat-status crm-chat-status--error">{error}</div>;
  }

  if (!iframeSrc) {
    return (
      <div className="crm-chat-status">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div className="crm-chat-page">
      <iframe
        src={iframeSrc}
        allow="microphone *; clipboard-write *"
        title="Embedded chat"
        className="crm-chat-iframe"
      />
    </div>
  );
};
