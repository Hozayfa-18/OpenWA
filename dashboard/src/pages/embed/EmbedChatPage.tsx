import { useSearchParams } from 'react-router-dom';
import { useEmbedAuth } from './hooks/useEmbedAuth';
import { EmbedConversations } from './EmbedConversations';

const statusStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  padding: 24,
  textAlign: 'center',
  font: '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#6b7280',
};

export const EmbedChatPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const authState = useEmbedAuth(token);

  if (authState.status === 'loading') return <div style={statusStyle}>Loading…</div>;
  if (authState.status === 'expired')
    return <div style={statusStyle}>This session has expired. Please reload the page.</div>;
  if (authState.status === 'error')
    return <div style={statusStyle}>Invalid session. Contact your administrator.</div>;

  return (
    <EmbedConversations
      accessToken={authState.auth.accessToken}
      scope={authState.auth.payload.scope}
    />
  );
};
