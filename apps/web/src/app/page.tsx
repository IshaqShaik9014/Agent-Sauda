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
  Tag,
  BookOpen,
  Sliders,
  CheckSquare,
  Lock,
  Layers,
  Code2,
  ExternalLink,
  ChevronRight,
  Store
} from 'lucide-react';
import { AgentSaudaLogo } from '../components/AgentSaudaLogo';
import { RazorpayBadge } from '../components/RazorpayBadge';
import type { HealthResponse } from '@agent-sauda/domain';

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'architecture' | 'interactive'>('architecture');

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
      description: 'Negotiate bulk deals on Ergonomic Study Chairs with live warehouse stock, grounded return policies, and automated discount guardrails.',
      badge: 'Hero Demo Store',
      featuredPrice: '₹6,000 / unit'
    },
    {
      name: 'Apex Modern Furniture Co.',
      slug: 'apex-modern-furniture',
      category: 'Office & Commercial Furniture',
      description: 'Negotiate volume quotes for AeroMesh Task Chairs, Executive Desks, and Acoustic Dividers with instant quote validation.',
      badge: 'B2B Wholesale',
      featuredPrice: '₹8,500 / unit'
    },
    {
      name: 'Quantum Dynamics Tech',
      slug: 'quantum-dynamics',
      category: 'Enterprise Hardware',
      description: 'Negotiate high-value enterprise quantum processors, neural accelerators, and server clusters with manager review workflows.',
      badge: 'Tech Catalog',
      featuredPrice: '₹4,50,000 / unit'
    }
  ];

  const coreModules = [
    {
      icon: BookOpen,
      name: 'Merchant Knowledge (RAG)',
      desc: 'Retrieval on company policies, return windows, warranty, and FAQs.'
    },
    {
      icon: ShoppingBag,
      name: 'Product Catalog',
      desc: 'Real-time inventory stock, category metadata, and base pricing.'
    },
    {
      icon: Bot,
      name: 'AI Negotiation',
      desc: 'Multi-turn conversational sales reasoning powered by Gemini LLM.'
    },
    {
      icon: Sliders,
      name: 'Policy Engine',
      desc: 'Mathematical guardrails enforcing min margin & max discount rules.'
    },
    {
      icon: CheckSquare,
      name: 'Merchant Approval',
      desc: 'Human-in-the-loop (HITL) manual review for out-of-bounds quotes.'
    },
    {
      icon: Layers,
      name: 'Orders & Inventory',
      desc: 'Stock locking, reservation expiry timers, and fulfillment milestones.'
    },
    {
      icon: CreditCard,
      name: 'Payments (Razorpay)',
      desc: 'Paise-precision checkout, HMAC webhook verification, and instant receipts.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <AgentSaudaLogo size="md" subtitle="AI Commerce Infrastructure" theme="dark" />
          <RazorpayBadge theme="dark" />
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Merchant Portal</span>
            </Link>
            <Link
              href="/negotiate/abc-furniture"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition"
            >
              <span>Live Buyer Demo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center max-w-4xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold tracking-wide mb-6">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>AI Commerce Infrastructure &bull; Powered by Razorpay</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6">
            <span className="text-white block">AI agents negotiate.</span>
            <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Merchants stay in control.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl font-normal leading-relaxed mb-8">
            Turn your existing AI assistant into a commerce agent with merchant-grounded knowledge, controlled negotiation, approvals, and secure payments.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/negotiate/abc-furniture"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Launch Buyer Negotiation Demo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 border border-slate-800 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-700 transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Merchant Control Dashboard</span>
            </Link>

            <Link
              href="/admin/connect"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 border border-slate-800 px-5 py-3.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:border-slate-700 transition-all"
            >
              <Code2 className="w-4 h-4 text-purple-400" />
              <span>SDK & Embed Widget</span>
            </Link>
          </div>
        </section>

        {/* Hero Architecture Infographic Display */}
        <section className="mb-12">
          <div className="relative rounded-3xl border border-slate-800/80 bg-slate-950/60 p-3 sm:p-4 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl overflow-hidden group">
            {/* Ambient Background Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-1000 -z-10" />

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A]">
              <img
                src="/hero-img.png"
                alt="Agent Sauda 3-Step Commerce Architecture: Customer Chat -> Agent Sauda B2B Infrastructure -> Merchant Approvals, Razorpay Payments & Grounded Policies"
                className="w-full h-auto object-cover rounded-2xl transition duration-300"
              />
            </div>
          </div>
        </section>

        {/* Floating Dark Value Proposition Ribbon (matching hero-img.png bottom) */}
        <section className="mb-16">
          <div className="rounded-2xl bg-[#0B0F19] border border-slate-800 p-4 sm:p-6 shadow-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 items-center">
              {/* Prop 1 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Integrate in minutes</h4>
                  <p className="text-[11px] text-slate-400">Simple SDK & APIs</p>
                </div>
              </div>

              {/* Prop 2 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Merchant-controlled</h4>
                  <p className="text-[11px] text-slate-400">Set your own rules</p>
                </div>
              </div>

              {/* Prop 3 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">More sales, less work</h4>
                  <p className="text-[11px] text-slate-400">Let your AI assistant sell</p>
                </div>
              </div>

              {/* Prop 4 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Enterprise ready</h4>
                  <p className="text-[11px] text-slate-400">Secure, auditable, scalable</p>
                </div>
              </div>

              {/* CTA Button */}
              <div className="flex flex-col items-start lg:items-end justify-center">
                <Link
                  href="/admin/connect"
                  className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:opacity-95 transition"
                >
                  <span>Start Building</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <span className="text-[10px] text-slate-400 mt-1">
                  Give your AI assistant the power to sell.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 7 Core Architecture Modules of Agent Sauda */}
        <section className="mb-16">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <Layers className="w-6 h-6 text-indigo-400" />
              Agent Sauda B2B Commerce Infrastructure
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              7 decoupled subsystems providing enterprise negotiation guardrails and automated checkout
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {coreModules.map((mod, idx) => {
              const Icon = mod.icon;
              return (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900 transition group"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-110 transition">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{mod.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{mod.desc}</p>
                </div>
              );
            })}

            {/* 8th Card: Swagger API Direct Link */}
            <a
              href="http://localhost:4000/docs"
              target="_blank"
              rel="noreferrer"
              className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 hover:border-indigo-400 transition group flex flex-col justify-between"
            >
              <div>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 mb-3">
                  <Code2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Fastify OpenAPI Docs</span>
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Explore full REST endpoints for chat, quotes, policies, orders, and webhooks.
                </p>
              </div>
              <div className="mt-4 text-xs font-semibold text-indigo-400 flex items-center gap-1">
                <span>Open Swagger UI</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </a>
          </div>
        </section>

        {/* Featured Live Demo Stores */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-400" />
                Live Negotiation Storefronts
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Experience real multi-turn AI negotiation with live catalog items and guardrails
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {demoStores.map((store) => (
              <Link
                key={store.slug}
                href={`/negotiate/${store.slug}`}
                className="group relative flex flex-col justify-between p-6 rounded-2xl bg-slate-900/60 border border-slate-800/90 hover:border-indigo-500/60 hover:bg-slate-900 transition-all shadow-lg hover:shadow-indigo-950/30"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                      {store.badge}
                    </span>
                    <span className="text-xs font-mono text-slate-400 font-semibold">{store.featuredPrice}</span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {store.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {store.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-indigo-400">
                  <span>Launch Negotiation Chat</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Live System Status Card */}
        <section className="mb-16 p-6 rounded-2xl bg-slate-900/40 border border-slate-800 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-xl ${
                  health ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
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
                <h2 className="text-sm font-semibold text-white">
                  Fastify Backend Commerce Engine Status
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {loading
                    ? 'Connecting to http://localhost:4000/health...'
                    : health
                    ? `Connected: ${health.service} v${health.version} (${health.environment}) &bull; Razorpay Sandbox Ready`
                    : `API Connection: ${error || 'Offline'}`}
                </p>
              </div>
            </div>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Check Health</span>
            </button>
          </div>
        </section>

        {/* 3 Pillars of Agentic Commerce Security */}
        <section className="grid md:grid-cols-3 gap-5 mb-16">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">1. AI Reasoning Layer</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gemini LLM understands buyer intent, checks inventory via tools, answers policy questions, and generates structured counter-proposals.
            </p>
            <div className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-indigo-950/40 text-indigo-300 border border-indigo-900/50">
              Role: Proposal Authority Only
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">2. Deterministic Policy</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pure mathematical rules enforce minimum gross margins, max discount caps, and trigger HITL approvals for large out-of-bounds orders.
            </p>
            <div className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-emerald-950/40 text-emerald-300 border border-emerald-900/50">
              Decisions: ALLOW / COUNTER / APPROVE / REJECT
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">3. Money Movement & Fulfillment</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Razorpay payment integration with integer Paise precision, HMAC webhook idempotency, and 5-milestone real-time delivery tracking.
            </p>
            <div className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-blue-950/40 text-blue-300 border border-blue-900/50">
              Security: 100% Isolated from AI
            </div>
          </div>
        </section>

        {/* Core Architectural Law Callout */}
        <footer className="p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950/20 to-slate-950 border border-slate-800 text-center">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
            Core Architectural Law
          </p>
          <blockquote className="text-base sm:text-xl font-extrabold text-white my-3 max-w-3xl mx-auto leading-snug">
            &ldquo;THE AI MAY PROPOSE A MONEY ACTION, BUT THE AI MUST NEVER BE THE AUTHORITY THAT AUTHORIZES THE MONEY ACTION.&rdquo;
          </blockquote>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-400 mt-4 flex-wrap">
            <span>Deterministic Policy Guardrails</span>
            <span>&bull;</span>
            <span>Razorpay Secure Payments</span>
            <span>&bull;</span>
            <span>HITL Approvals</span>
            <span>&bull;</span>
            <span>Audit Trail Compliance</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
