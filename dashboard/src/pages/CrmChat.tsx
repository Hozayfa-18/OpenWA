import { useCallback, useState } from 'react';
import { Loader2, MessagesSquare } from 'lucide-react';
import { iframeApi } from '../services/api';
import './CrmChat.css';

const CHAT_TYPE = 'whatsapp';

export const CrmChat = () => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleOpenChat = useCallback(async () => {
    const chatId = phone.trim();
    if (!chatId || generating) return;

    setGenerating(true);
    setGenError(null);
    try {
      const res = await iframeApi.generate({
        user: { id: 'dashboard-user', name: 'Dashboard User' },
        scope: 'card',
        filter: [{ chatType: CHAT_TYPE, chatId }],
        use_events: { deals: false },
      });
      const token = new URL(res.url).searchParams.get('token');
      if (!token) {
        throw new Error('No token in generated iframe url');
      }
      setIframeSrc(`/embed/chat?token=${token}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to open chat');
    } finally {
      setGenerating(false);
    }
  }, [phone, generating]);

  return (
    <div className="crm-chat-page">
      <div className="crm-chat-config">
        <div className="crm-chat-config-fields">
          <label className="crm-chat-field">
            <span>Phone (chatId)</span>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 14155551234"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleOpenChat();
              }}
            />
          </label>
          <label className="crm-chat-field">
            <span>Contact name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
          </label>
          <button
            type="button"
            className="crm-chat-open-btn"
            onClick={handleOpenChat}
            disabled={!phone.trim() || generating}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <MessagesSquare size={16} />}
            <span>{iframeSrc ? 'Reopen chat' : 'Open chat'}</span>
          </button>
        </div>
        <p className="crm-chat-hint">
          Enter a WhatsApp number to open the embedded chat for that contact.
        </p>
        {genError && <div className="crm-chat-error">{genError}</div>}
      </div>

      {iframeSrc ? (
        <div className="crm-chat-iframe-wrap">
          <iframe
            src={iframeSrc}
            allow="microphone *; clipboard-write *"
            title="Embedded chat"
            className="crm-chat-iframe"
          />
        </div>
      ) : (
        <div className="crm-chat-placeholder">
          <MessagesSquare size={44} />
          <p>Enter a phone number and open a chat to embed the CRM chat iframe.</p>
        </div>
      )}
    </div>
  );
};
