import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessagesSquare } from 'lucide-react';
import { crmChatApi, iframeApi, type ChatDeal } from '../services/api';
import './CrmChat.css';

const CHAT_TYPE = 'whatsapp';

export const CrmChat = () => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [deals, setDeals] = useState<ChatDeal[]>([]);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [openedDealId, setOpenedDealId] = useState<string | null>(null);
  const [showNewDealForm, setShowNewDealForm] = useState(false);
  const [newDealName, setNewDealName] = useState('');
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);

  const fetchDeals = useCallback(async (chatId: string) => {
    try {
      const result = await crmChatApi.dealsByChat(CHAT_TYPE, chatId);
      setDeals(result);
    } catch {
      setDeals([]);
    }
  }, []);

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
        use_events: { deals: true },
      });
      const token = new URL(res.url).searchParams.get('token');
      if (!token) {
        throw new Error('No token in generated iframe url');
      }
      setIframeSrc(`/embed/chat?token=${token}`);
      void fetchDeals(chatId);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to open chat');
    } finally {
      setGenerating(false);
    }
  }, [phone, generating, fetchDeals]);

  const handleCreateDeal = useCallback(async () => {
    const chatId = phone.trim();
    const dealName = newDealName.trim();
    if (!chatId || !dealName || creatingDeal) return;

    setCreatingDeal(true);
    setDealError(null);
    try {
      await crmChatApi.createDeal(CHAT_TYPE, chatId, dealName);
      await fetchDeals(chatId);
      setNewDealName('');
      setShowNewDealForm(false);
    } catch (err) {
      setDealError(err instanceof Error ? err.message : 'Failed to create deal');
    } finally {
      setCreatingDeal(false);
    }
  }, [phone, newDealName, creatingDeal, fetchDeals]);

  // Listen for Deals-dropdown postMessage events from the embedded iframe.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data as
        | { type?: string; data?: { entity?: { id?: string; name?: string } } }
        | null;
      if (!msg || typeof msg.type !== 'string') return;
      if (msg.type === 'WZ_CREATE_ENTITY') {
        setLastEvent('Received WZ_CREATE_ENTITY — opening new deal form');
        setShowNewDealForm(true);
      } else if (msg.type === 'WZ_OPEN_ENTITY') {
        const entity = msg.data?.entity;
        setLastEvent(`Received WZ_OPEN_ENTITY — deal "${entity?.name ?? ''}"`);
        if (entity?.id) setOpenedDealId(entity.id);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const dealsTarget = name.trim() || phone.trim();

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
        {genError && <div className="crm-chat-error">{genError}</div>}
      </div>

      {iframeSrc ? (
        <div className="crm-chat-body">
          <div className="crm-chat-iframe-wrap">
            <iframe
              src={iframeSrc}
              allow="microphone *; clipboard-write *"
              title="Embedded chat"
              className="crm-chat-iframe"
            />
          </div>

          <aside className="crm-deals-panel">
            <div className="crm-deals-header">Deals — {dealsTarget}</div>

            <div className="crm-deals-list">
              {deals.length === 0 && <div className="crm-deals-empty">No deals for this chat yet.</div>}
              {deals.map((deal) => (
                <div
                  key={deal.id}
                  className={`crm-deal-card ${deal.id === openedDealId ? 'highlighted' : ''}`}
                >
                  <div className="crm-deal-top">
                    <span className="crm-deal-name">{deal.name}</span>
                    <span className={`crm-deal-badge ${deal.closed ? 'closed' : 'open'}`}>
                      {deal.closed ? 'closed' : 'open'}
                    </span>
                  </div>
                  {deal.responsibleUserName && (
                    <div className="crm-deal-owner">{deal.responsibleUserName}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="crm-deals-actions">
              {showNewDealForm ? (
                <div className="crm-new-deal-form">
                  <input
                    type="text"
                    value={newDealName}
                    onChange={(e) => setNewDealName(e.target.value)}
                    placeholder="Deal name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateDeal();
                    }}
                  />
                  <div className="crm-new-deal-buttons">
                    <button
                      type="button"
                      className="crm-btn-primary"
                      onClick={handleCreateDeal}
                      disabled={!newDealName.trim() || creatingDeal}
                    >
                      {creatingDeal ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                    </button>
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      onClick={() => {
                        setShowNewDealForm(false);
                        setNewDealName('');
                        setDealError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {dealError && <div className="crm-chat-error">{dealError}</div>}
                </div>
              ) : (
                <button
                  type="button"
                  className="crm-btn-secondary crm-new-deal-trigger"
                  onClick={() => setShowNewDealForm(true)}
                >
                  + New deal
                </button>
              )}
            </div>

            <div className="crm-event-log">{lastEvent ?? 'No events received yet.'}</div>
          </aside>
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
