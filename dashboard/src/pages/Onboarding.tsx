import { CreateOrganization } from '@clerk/clerk-react';
import './Login.css';

// Shown to a signed-in user who has no active organization yet. Creating one
// provisions their tenant (they become owner) via the Clerk webhook / JIT path.
export function Onboarding() {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <img src="/openwa_logo.webp" alt="OpenWA" className="logo-icon" />
        </div>
        <CreateOrganization afterCreateOrganizationUrl="/" routing="hash" />
      </div>
    </div>
  );
}
