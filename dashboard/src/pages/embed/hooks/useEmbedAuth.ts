import { useState, useEffect } from 'react';
import { iframeApi, type EmbedAuthResponse } from '../../../services/api';

type State =
  | { status: 'loading' }
  | { status: 'ready'; auth: EmbedAuthResponse }
  | { status: 'expired' }
  | { status: 'error'; message: string };

export const useEmbedAuth = (token: string | null): State => {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', message: 'No token provided' });
      return;
    }

    let cancelled = false;
    iframeApi
      .exchange(token)
      .then((auth) => {
        if (!cancelled) setState({ status: 'ready', auth });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('401') || msg.toLowerCase().includes('expired')) {
          setState({ status: 'expired' });
        } else if (msg.includes('404')) {
          setState({ status: 'error', message: 'Invalid session' });
        } else {
          setState({ status: 'error', message: msg });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return state;
};
