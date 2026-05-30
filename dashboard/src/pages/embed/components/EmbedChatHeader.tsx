import { Plus } from 'lucide-react';
import type { EmbedDealEntity } from '../hooks/useEmbedPostMessage';
import '../EmbedChat.css';

export type EmbedChatHeaderDeal = Pick<
  EmbedDealEntity,
  'id' | 'name' | 'closed' | 'responsibleUserName'
>;

export interface EmbedChatHeaderProps {
  contactName: string;
  chatId: string;
  chatType: string;
  deals: EmbedChatHeaderDeal[];
  useDealsEvents: boolean;
  onOpenDeal: (deal: EmbedChatHeaderDeal) => void;
  onAddDeal: () => void;
}

const MAX_VISIBLE_DEALS = 5;

export const EmbedChatHeader = ({
  contactName,
  chatId,
  chatType,
  deals,
  useDealsEvents,
  onOpenDeal,
  onAddDeal,
}: EmbedChatHeaderProps) => {
  const visibleDeals = deals.slice(0, MAX_VISIBLE_DEALS);
  const overflowCount = deals.length - MAX_VISIBLE_DEALS;

  const chipClassName = (deal: EmbedChatHeaderDeal): string => {
    const classes = ['embed-deal-chip'];
    if (deal.closed) classes.push('closed');
    if (!useDealsEvents) classes.push('display-only');
    return classes.join(' ');
  };

  return (
    <header className="embed-chat-header">
      <div className="embed-chat-header__top">
        <span className="embed-contact-name">{contactName}</span>
        <span className="embed-chat-id">{chatId}</span>
        <span className="embed-channel-badge">{chatType}</span>
      </div>

      <div className="embed-deals-row">
        {visibleDeals.map((deal) =>
          useDealsEvents ? (
            <button
              key={deal.id}
              type="button"
              className={chipClassName(deal)}
              title={deal.responsibleUserName}
              onClick={() => onOpenDeal(deal)}
            >
              {deal.name}
            </button>
          ) : (
            <span
              key={deal.id}
              className={chipClassName(deal)}
              title={deal.responsibleUserName}
            >
              {deal.name}
            </span>
          ),
        )}

        {overflowCount > 0 && (
          <span className="embed-deal-chip embed-deal-chip--more">
            +{overflowCount} more
          </span>
        )}

        {useDealsEvents ? (
          <button
            type="button"
            className="embed-deal-chip embed-deal-chip--add"
            onClick={onAddDeal}
          >
            <Plus size={14} aria-hidden="true" />
            Add
          </button>
        ) : (
          <span className="embed-deal-chip embed-deal-chip--add display-only">
            <Plus size={14} aria-hidden="true" />
            Add
          </span>
        )}
      </div>
    </header>
  );
};
