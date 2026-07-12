import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SignedIn, SignedOut, useAuth, useOrganization, useClerk } from '@clerk/clerk-react';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { RoleProvider, useRole } from './hooks/useRole';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setTokenGetter } from './services/api';
import { mapClerkRoleToUi, isAdminRole } from './lib/roles';
import './App.css';

const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Sessions = lazy(() => import('./pages/Sessions').then(m => ({ default: m.Sessions })));
const Conversations = lazy(() => import('./pages/Conversations').then(m => ({ default: m.Conversations })));
const CrmChat = lazy(() => import('./pages/CrmChat').then((m) => ({ default: m.CrmChat })));
const Webhooks = lazy(() => import('./pages/Webhooks').then(m => ({ default: m.Webhooks })));
const Logs = lazy(() => import('./pages/Logs').then(m => ({ default: m.Logs })));
const ApiKeys = lazy(() => import('./pages/ApiKeys').then(m => ({ default: m.ApiKeys })));
const MessageTester = lazy(() => import('./pages/MessageTester').then(m => ({ default: m.MessageTester })));
const Infrastructure = lazy(() => import('./pages/Infrastructure').then(m => ({ default: m.Infrastructure })));
const Plugins = lazy(() => import('./pages/Plugins'));
const EmbedChatPage = lazy(() =>
  import('./pages/embed/EmbedChatPage').then((m) => ({ default: m.EmbedChatPage }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

function AppContent() {
  const { isLoaded, orgId, getToken } = useAuth();
  const { membership } = useOrganization();
  const { signOut } = useClerk();
  const { setRole, role } = useRole();

  // Feed the Clerk session token to the (non-React) API client for every request.
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);

  // Mirror the Clerk org role into the RBAC context used by the UI gates.
  useEffect(() => {
    if (membership?.role) setRole(mapClerkRoleToUi(membership.role));
  }, [membership?.role, setRole]);

  const loadingFallback = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Loader2 className="animate-spin" size={32} />
    </div>
  );

  if (!isLoaded) return loadingFallback;

  return (
    <>
      <SignedOut>
        <Suspense fallback={loadingFallback}><Login /></Suspense>
      </SignedOut>
      <SignedIn>
        {!orgId ? (
          <Suspense fallback={loadingFallback}><Onboarding /></Suspense>
        ) : (
          <ToastProvider>
            <BrowserRouter>
              <Suspense fallback={loadingFallback}>
                <Routes>
                  <Route path="/" element={<Layout onLogout={() => void signOut()} userRole={role} />}>
                    <Route index element={<Dashboard />} />
                    <Route path="sessions" element={<Sessions />} />
                    <Route path="conversations" element={<Conversations />} />
                    <Route path="crm-chat" element={<CrmChat />} />
                    <Route path="webhooks" element={<Webhooks />} />
                    {isAdminRole(role) && <Route path="api-keys" element={<ApiKeys />} />}
                    <Route path="logs" element={<Logs />} />
                    <Route path="message-tester" element={<MessageTester />} />
                    <Route path="infrastructure" element={<Infrastructure />} />
                    {isAdminRole(role) && <Route path="plugins" element={<Plugins />} />}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ToastProvider>
        )}
      </SignedIn>
    </>
  );
}

function App() {
  if (window.location.pathname.startsWith('/embed/')) {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading…</div>}>
            <BrowserRouter>
              <Routes>
                <Route path="/embed/chat" element={<EmbedChatPage />} />
              </Routes>
            </BrowserRouter>
          </Suspense>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RoleProvider>
          <AppContent />
        </RoleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
