'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Bot,
  CreditCard,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  MessageSquare,
  ShoppingBag,
  Zap,
  Tag
} from 'lucide-react';
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

  const demoStores = [
    {
      name: 'ABC Furniture Ltd',
      slug: 'abc-furniture',
      category: 'Ergonomic Seating & Desks',
      description: 'Negotiate bulk deals on Ergonomic Study Chairs with live warehouse stock and automated policy checks.',
      badge: 'Hero Demo'
    },
    {
      name: 'Apex Modern Furniture Co.',
      slug: 'apex-modern-furniture',
      category: 'Office & Commercial Furniture',
      description: 'Negotiate volume quotes for AeroMesh Task Chairs, Executive Desks, and Acoustic Dividers.',
      badge: 'B2B Wholesale'
    },
    {
      name: 'Quantum Dynamics Tech',
      slug: 'quantum-dynamics',
      category: 'Enterprise Hardware',
      description: 'Negotiate enterprise quantum processors, neural accelerators, and server clusters.',
      badge: 'Tech Catalog'
    }
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 antialiased">
      {/* Hero Header */}
      <header className="flex flex-col items-center text-center space-y-4 mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          Autonomous AI Negotiation &bull; Deterministic Policy Guardrails
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          AGENT SAUDA
        </h1>
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl font-light">
          &ldquo;AI agents negotiate. Merchants stay in control.&rdquo;
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/negotiate/abc-furniture"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all hover:scale-105"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Launch Buyer Negotiation Demo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Merchant Control Dashboard</span>
          </Link>

          <a
            href="http://localhost:4000/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700 transition-all"
          >
            <span>Explore Swagger API Docs</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </a>
        </div>

        {/* Hero Architecture Infographic */}
        <div className="relative w-full max-w-5xl mt-6 rounded-2xl overflow-hidden border border-zinc-800/90 shadow-2xl shadow-emerald-950/40 bg-zinc-950/80 p-2 sm:p-3 backdrop-blur-md group">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 via-transparent to-indigo-500/5 pointer-events-none rounded-2xl" />
          <img
            src="/hero-img.png"
            alt="Agent Sauda — AI agents negotiate. Merchants stay in control. B2B Commerce Architecture"
            className="w-full h-auto rounded-xl shadow-lg border border-zinc-800/60"
          />
        </div>
      </header>

      {/* Featured Live Demo Stores */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              Live Negotiation Storefronts
            </h2>
            <p className="text-xs text-zinc-400">
              Select a demo store to start an interactive price negotiation with Sauda AI
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {demoStores.map((store) => (
            <Link
              key={store.slug}
              href={`/negotiate/${store.slug}`}
              className="group relative flex flex-col justify-between p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all shadow-md hover:shadow-emerald-950/20"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {store.badge}
                  </span>
                  <span className="text-[11px] text-zinc-500">{store.category}</span>
                </div>
                <h3 className="text-base font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                  {store.name}
                </h3>
                <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                  {store.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>Start Negotiation</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Live System Status Card */}
      <section className="mb-14 p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                health ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : health ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Backend Fastify Service Status
              </h2>
              <p className="text-xs text-zinc-400">
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
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Check Health</span>
          </button>
        </div>
      </section>

      {/* Architecture Separation Principle */}
      <section className="grid md:grid-cols-3 gap-5 mb-14">
        <div className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800 space-y-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Bot className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-zinc-100">1. AI Reasoning Layer</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Gemini LLM understands buyer intent, checks inventory via tools, and generates structured counter-proposals.
          </p>
          <div className="text-[11px] font-mono px-2 py-1 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-900/50">
            Role: Proposal Authority Only
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800 space-y-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-zinc-100">2. Deterministic Policy</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Pure mathematical rules enforce minimum gross margins, max discount caps, and trigger HITL approvals for large orders.
          </p>
          <div className="text-[11px] font-mono px-2 py-1 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-900/50">
            Decisions: ALLOW / COUNTER / APPROVE / REJECT
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800 space-y-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <CreditCard className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-zinc-100">3. Money Movement & Fulfillment</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Razorpay payment integration with integer Paise precision, HMAC webhook idempotency, and 5-milestone tracking.
          </p>
          <div className="text-[11px] font-mono px-2 py-1 rounded bg-amber-950/40 text-amber-300 border border-amber-900/50">
            Security: 100% Isolated from AI
          </div>
        </div>
      </section>

      {/* Core Rule Callout */}
      <footer className="p-6 rounded-2xl bg-gradient-to-r from-zinc-950 via-emerald-950/20 to-zinc-950 border border-zinc-800 text-center">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
          Core Architectural Law
        </p>
        <blockquote className="text-lg md:text-xl font-bold text-amber-400 my-2">
          &ldquo;THE AI MAY PROPOSE A MONEY ACTION, BUT THE AI MUST NEVER BE THE AUTHORITY THAT AUTHORIZES THE MONEY ACTION.&rdquo;
        </blockquote>
        <p className="text-xs text-zinc-500 mt-2">
          14 Phases Complete &bull; Phase 15 Buyer Chat Active &bull; Next: Phase 16 Buyer Checkout UI
        </p>
      </footer>
    </main>
  );
}
