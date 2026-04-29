import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { LoadingPage } from '@/shared/components/ui/LoadingSkeleton';
import { useAuth } from '../hooks/useAuth';

function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading, error: serverError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  if (authLoading) return <LoadingPage />;
  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const err = field === 'email' ? validateEmail(email) : validatePassword(password);
    setFieldErrors(prev => ({ ...prev, [field]: err ?? undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    setTouched({ email: true, password: true });
    setFieldErrors({ email: emailErr ?? undefined, password: passErr ?? undefined });
    if (emailErr || passErr) return;

    setSubmitting(true);
    try { await login(email, password); } catch { /* serverError shown via useAuth */ }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="w-full max-w-sm bg-bg-panel rounded-xl border border-border-subtle p-8 shadow-sm">
        <h1 className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2.5">
            <span className="relative w-9 h-9 rounded-lg shrink-0 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className="relative z-10">
                <rect x="3" y="1" width="8" height="12" rx="1" stroke="currentColor" strokeWidth="1.8" className="text-accent" />
                <line x1="5" y1="4.5" x2="9" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-accent" />
                <line x1="5" y1="6.5" x2="9" y2="6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-accent" />
                <line x1="5" y1="8.5" x2="7.5" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="text-accent" />
              </svg>
              <span className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-accent" />
              <span className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 border-accent" />
              <span className="absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 border-accent" />
              <span className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-accent" />
            </span>
            <span className="text-2xl font-bold tracking-tight text-accent">LF Talent Scan</span>
          </span>
        </h1>

        {serverError && <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-[13px] text-red-600">{serverError}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Email</label>
            <input type="text" value={email}
              onChange={(e) => { setEmail(e.target.value); if (touched.email) { setFieldErrors(prev => ({ ...prev, email: validateEmail(e.target.value) ?? undefined })); } }}
              onBlur={() => handleBlur('email')}
              className={`w-full px-3 py-2 bg-bg-primary border rounded-md text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-colors ${touched.email && fieldErrors.email ? 'border-red-400 focus:border-red-400' : 'border-border-default focus:border-accent'}`}
              placeholder="hr@lifull.com" />
            {touched.email && fieldErrors.email && <p className="mt-1 text-[12px] text-red-500">{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={(e) => { setPassword(e.target.value); if (touched.password) { setFieldErrors(prev => ({ ...prev, password: validatePassword(e.target.value) ?? undefined })); } }}
                onBlur={() => handleBlur('password')}
                className={`w-full px-3 py-2 pr-10 bg-bg-primary border rounded-md text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 transition-colors ${touched.password && fieldErrors.password ? 'border-red-400 focus:border-red-400' : 'border-border-default focus:border-accent'}`}
                placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {touched.password && fieldErrors.password && <p className="mt-1 text-[12px] text-red-500">{fieldErrors.password}</p>}
          </div>

          <button type="submit" disabled={submitting}
            className="w-full py-2 bg-accent text-white text-[13px] font-medium rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-[11px] text-text-muted text-center mt-6 pt-4 border-t border-border-subtle">AI-powered recruitment platform — automatically scan CVs, anonymize PII, match candidates to job descriptions, and score them using hybrid AI pipeline</p>
      </div>
    </div>
  );
}
