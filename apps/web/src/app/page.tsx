'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Bot, CreditCard, Sparkles, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import type { HealthResponse } from '@agent-sauda/domain';

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/health`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data: HealthResponse = await res.json();
      setHealth(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      {/* Hero Header */}
      <header className="flex flex-col items-center text-center space-y-4 mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          Agentic Commerce & Guarded Negotiation
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          AGENT SAUDA
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl">
          &ldquo;AI agents negotiate. Merchants stay in control.&rdquo;
        </p>
      </header>

      {/* Live System Status Card */}
      <section className="mb-12 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${health ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : health ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Backend Fastify Service Status</h2>
              <p className="text-sm text-slate-400">
                {loading
                  ? 'Connecting to http://localhost:4000/health...'
                  : health
                  ? `Connected: ${health.service} v${health.version} (${health.environment})`
                  : `API Connection: ${error || 'Offline'}`}
              </p>
            </div>
          </div>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      {/* Architecture Separation Principle */}
      <section className="grid md:grid-cols-3 gap-6 mb-16">
        <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">1. AI Reasoning Layer</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            LLM handles natural language understanding, buyer intent, product discovery, and generates structured offer proposals.
          </p>
          <div className="text-xs font-mono px-2.5 py-1.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-900/50">
            Role: Proposal Only
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">2. Deterministic Policy</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Pure mathematical backend rules enforce margins, maximum discounts, order limits, and triggers human approvals.
          </p>
          <div className="text-xs font-mono px-2.5 py-1.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-900/50">
            Decisions: ALLOW / COUNTER / APPROVE / REJECT
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">3. Money Movement</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Razorpay test-mode execution, cryptographic webhook signatures, and explicit order state machine with full audit trails.
          </p>
          <div className="text-xs font-mono px-2.5 py-1.5 rounded bg-amber-950/40 text-amber-300 border border-amber-900/50">
            Security: Never touches LLM
          </div>
        </div>
      </section>

      {/* Core Rule Callout */}
      <footer className="p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 text-center">
        <p className="text-base font-semibold text-slate-200">
          Core Architectural Principle:
        </p>
        <blockquote className="text-xl md:text-2xl font-bold text-amber-400 my-2">
          &ldquo;THE AI MAY PROPOSE A MONEY ACTION, BUT THE AI MUST NEVER BE THE AUTHORITY THAT AUTHORIZES THE MONEY ACTION.&rdquo;
        </blockquote>
        <p className="text-sm text-slate-400 mt-2">
          Phase 1 Foundation Operational &bull; Ready for Phase 2 Database & Domain Modeling
        </p>
      </footer>
    </main>
  );
}
