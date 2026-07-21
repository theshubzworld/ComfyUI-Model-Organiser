import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider, useAuth } from './context/AuthContext'
import { isAuthEnabled } from './lib/supabase'
import AuthPage from './components/AuthPage'
import App from './App.jsx'
import './index.css'

function Root() {
  const { user, loading } = useAuth();

  // Auth not configured (local dev without env vars) → open access
  if (!isAuthEnabled) return <App />;

  // Still loading session from Supabase
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0c14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(168,85,247,0.3)',
          borderTop: '3px solid #a855f7',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not signed in → show auth page
  if (!user) return <AuthPage />;

  // Signed in → show app
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>
)
