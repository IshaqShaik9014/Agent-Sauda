'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, ShieldCheck, Sparkles, LayoutDashboard, Store } from 'lucide-react';
import { AgentSaudaLogo } from './AgentSaudaLogo';
import { RazorpayBadge } from './RazorpayBadge';

interface NavbarProps {
  merchantName?: string;
  merchantSlug?: string;
  onOpenCatalog?: () => void;
  productsCount?: number;
}

export function Navbar({
  merchantName = 'Agent Sauda',
  merchantSlug,
  onOpenCatalog,
  productsCount = 0
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Store Name */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
            <AgentSaudaLogo size="sm" subtitle="AI Commerce Infrastructure" theme="dark" />
          </Link>

          {merchantSlug && (
            <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-slate-800">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-medium text-slate-300 border border-slate-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Store: <strong className="text-emerald-400 ml-1">{merchantName}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Razorpay Co-Branding Badge */}
        <div className="hidden lg:flex items-center">
          <RazorpayBadge theme="dark" />
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-2.5">
          {onOpenCatalog && (
            <button
              onClick={onOpenCatalog}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-colors"
            >
              <ShoppingBag className="h-4 w-4 text-emerald-400" />
              <span>Catalog</span>
              {productsCount > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                  {productsCount}
                </span>
              )}
            </button>
          )}

          <Link
            href="/negotiate/abc-furniture"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition"
          >
            <Store className="h-3.5 w-3.5 text-indigo-400" />
            <span>Demo Store</span>
          </Link>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30 transition"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-indigo-400" />
            <span>Merchant Portal</span>
          </Link>

          <a
            href="http://localhost:4000/docs"
            target="_blank"
            rel="noreferrer"
            className="hidden xl:inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
          >
            <span>Swagger API</span>
            <Sparkles className="h-3 w-3 text-amber-400" />
          </a>
        </div>
      </div>
    </header>
  );
}
