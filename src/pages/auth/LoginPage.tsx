// ==============================================================================
// FINNEST - Authentication Portal (/login)
// Minimalist, production-grade prop-tech login and registration experience
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { Building2, ArrowRight, Lock, Mail, User, Phone } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const from = (location.state as any)?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (!res.success || !res.profile) {
          setError(res.error || 'Invalid credentials');
          setLoading(false);
          return;
        }

        // Navigate strictly based on authoritative verified role from profile
        if (res.profile.role === 'admin') {
          navigate(from || '/admin', { replace: true });
        } else {
          navigate(from || '/portal', { replace: true });
        }
      } else {
        const res = await signUp(email, password, fullName, phone);
        if (!res.success || !res.profile) {
          setError(res.error || 'Registration failed');
          setLoading(false);
          return;
        }

        // Newly registered accounts are normal users
        navigate(from || '/portal', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans text-slate-100">
      {/* Subtle Background Geometry */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl"></div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-3 shadow-inner">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            FinNest
          </h1>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            Digital property management, connected.
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 bg-slate-900/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-800">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-800/80 p-1 mb-6 border border-slate-700/50">
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signin' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register Parcel Owner
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Full Legal Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Aarav Sundaram"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Contact Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98400 00000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@finnest.io"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Access FinNest Portal' : 'Complete Registration'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-[11px] text-slate-500">
          FinNest Cadastral Registry &copy; {new Date().getFullYear()} &bull; Secure Land Record System
        </p>
      </div>
    </div>
  );
};
