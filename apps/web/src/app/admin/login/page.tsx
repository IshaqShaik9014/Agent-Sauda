'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import {
  ShieldCheck,
  Zap,
  Lock,
  Mail,
  Store,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('ada@quantum-dynamics.io');
  const [password, setPassword] = useState('StrongPassword123!');
  const [name, setName] = useState('Ada Lovelace');
  const [merchantName, setMerchantName] = useState('Quantum Dynamics Tech');
  const [currency, setCurrency] = useState('INR');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isRegister) {
        const slug = merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
        const res = await api.register({
          email,
          password,
          name,
          merchantName,
          merchantSlug: slug,
          currency
        });

        auth.setSession({
          token: res.token,
          user: res.user,
          merchant: {
            id: res.merchant.id,
            name: res.merchant.name,
            slug: res.merchant.slug,
            currency: res.merchant.currency,
            role: 'OWNER'
          }
        });
      } else {
        const res = await api.login({ email, password });
        auth.setSession({
          token: res.token,
          user: res.user,
          merchant: {
            id: res.merchant.id,
            name: res.merchant.name,
            slug: res.merchant.slug,
            currency: res.merchant.currency,
            role: 'OWNER'
          }
        });
      }

      router.push('/admin');
    } catch (err: unknown) {
      setError((err as Error).message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const demoTimestamp = Date.now();
      const res = await api.register({
        email: `founder_${demoTimestamp}@demo-sauda.com`,
        password: 'StrongPassword123!',
        name: 'Demo Store Manager',
        merchantName: 'Quantum Dynamics Tech',
        merchantSlug: `quantum-dynamics-${demoTimestamp}`,
        currency: 'INR'
      });

      auth.setSession({
        token: res.token,
        user: res.user,
        merchant: {
          id: res.merchant.id,
          name: res.merchant.name,
          slug: res.merchant.slug,
          currency: res.merchant.currency,
          role: 'OWNER'
        }
      });

      router.push('/admin');
    } catch (err: unknown) {
      setError((err as Error).message || 'Could not launch demo store session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-950/40">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-zinc-100">
            AGENT SAUDA
          </span>
        </Link>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-zinc-100">
          {isRegister ? 'Register Your Storefront' : 'Merchant Control Center'}
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Deterministic Guardrails &bull; AI Sales Agent &bull; Autonomous Settlement
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          {/* Quick Demo Login Pill */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full mb-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-3 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>1-Click Demo Merchant Sign In (Instant Access)</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-zinc-900 px-2 text-zinc-500 font-bold tracking-wider">
                Or Sign In With Password
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ada Lovelace"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Store / Company Name
                  </label>
                  <div className="relative">
                    <Store className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      placeholder="e.g. Quantum Dynamics Tech"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merchant@example.com"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? 'Register & Setup Store' : 'Sign In to Dashboard'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Register / Login */}
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              {isRegister
                ? 'Already have an account? Sign in here'
                : 'Need to register a new merchant store? Click here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
