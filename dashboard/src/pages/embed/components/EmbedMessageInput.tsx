import { useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import '../EmbedChat.css';

export interface EmbedMessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const EmbedMessageInput = ({ onSend, disabled = false }: EmbedMessageInputProps) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const canSend = !disabled && text.trim().length > 0;

  return (
    <div className="embed-message-input">
      <textarea
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a message"
        rows={1}
      />
      <button
        type="button"
        className="embed-send-btn"
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
      >
        <Send size={18} aria-hidden="true" />
      </button>
    </div>
  );
};
