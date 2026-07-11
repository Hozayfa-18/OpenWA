import { SignIn } from '@clerk/clerk-react';
import { useTheme } from '../hooks/useTheme';
import './Login.css';

export function Login() {
  // Ensure the login screen honours a saved light/dark preference too
  // (otherwise it only follows the OS setting until the user signs in).
  useTheme();

  return (
    <div className="login-container">
      <div className="login-logo">
        <img src="/openwa_logo.webp" alt="OpenWA" className="logo-icon" />
      </div>
      <SignIn
        routing="hash"
        appearance={{
          variables: {
            colorPrimary: '#25d366',
            colorBackground: 'var(--bg-white)',
            colorText: 'var(--text-primary)',
            colorTextSecondary: 'var(--text-secondary)',
            colorInputBackground: 'var(--bg-light)',
            colorInputText: 'var(--text-primary)',
            borderRadius: 'var(--radius)',
            fontSize: '0.95rem',
            spacingUnit: '1.05rem',
          },
          elements: {
            rootBox: 'login-clerk-root',
            cardBox: 'login-clerk-cardbox',
            card: 'login-clerk-card',
          },
        }}
      />
    </div>
  );
}
