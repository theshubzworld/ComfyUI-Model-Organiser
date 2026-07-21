import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Loader2, Sparkles, Lock, Mail, User, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => { setError(''); setSuccess(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    reset();

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess('Account created! Check your email to confirm your account.');
        setMode('signin');
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // AuthContext will update automatically via onAuthStateChange
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccess('Password reset email sent! Check your inbox.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    reset();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0c14 0%, #12151f 50%, #0d1117 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', 'system-ui', sans-serif",
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow effects */}
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} color="#fff" />
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>SimplePod</span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>AI Model Storage Calculator</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '32px',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}>
          {/* Mode tabs */}
          {mode !== 'reset' && (
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '4px', marginBottom: '28px' }}>
              {['signin', 'signup'].map(m => (
                <button key={m} onClick={() => { setMode(m); reset(); }} style={{
                  flex: 1, padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s',
                  background: mode === m ? 'rgba(168,85,247,0.2)' : 'transparent',
                  color: mode === m ? '#c084fc' : '#64748b',
                  boxShadow: mode === m ? '0 0 0 1px rgba(168,85,247,0.3)' : 'none',
                }}>
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {mode === 'reset' && (
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px' }}>Reset Password</h2>
              <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Enter your email to receive a reset link</p>
            </div>
          )}

          {/* Alerts */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', marginBottom: '20px' }}>
              <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
              <span style={{ color: '#fca5a5', fontSize: '0.8rem' }}>{error}</span>
            </div>
          )}
          {success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '10px', marginBottom: '20px' }}>
              <CheckCircle2 size={16} color="#4ade80" style={{ flexShrink: 0 }} />
              <span style={{ color: '#86efac', fontSize: '0.8rem' }}>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#475569" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '12px 14px 12px 40px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            {/* Password (not shown in reset mode) */}
            {mode !== 'reset' && (
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="#475569" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                    minLength={mode === 'signup' ? 6 : undefined}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '12px 44px 12px 40px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: '#f1f5f9',
                      fontSize: '0.9rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '2px' }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === 'signin' && (
                  <button type="button" onClick={() => { setMode('reset'); reset(); }} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 0 0', float: 'right' }}>
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '4px',
                padding: '13px',
                background: loading ? 'rgba(168,85,247,0.4)' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'opacity 0.2s, transform 0.1s',
                boxShadow: '0 4px 15px rgba(168,85,247,0.3)',
              }}
              onMouseEnter={e => { if (!loading) e.target.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.target.style.opacity = '1'; }}
            >
              {loading
                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
                : mode === 'signin' ? <><ArrowRight size={18} /> Sign In</>
                : mode === 'signup' ? <><User size={18} /> Create Account</>
                : <><Mail size={18} /> Send Reset Link</>}
            </button>
          </form>

          {/* Divider + Google OAuth */}
          {mode !== 'reset' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                <span style={{ color: '#475569', fontSize: '0.75rem' }}>or continue with</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
              </div>

              <button
                onClick={handleGoogle}
                disabled={loading}
                style={{
                  width: '100%', padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#e2e8f0',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                {/* Google SVG */}
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {/* Back link for reset mode */}
          {mode === 'reset' && (
            <button type="button" onClick={() => { setMode('signin'); reset(); }} style={{ display: 'block', width: '100%', marginTop: '16px', background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer' }}>
              ← Back to Sign In
            </button>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.75rem', marginTop: '20px' }}>
          Secured by Supabase Auth • SimplePod v1.0
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #334155; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #12151f inset; -webkit-text-fill-color: #f1f5f9; }
      `}</style>
    </div>
  );
}
