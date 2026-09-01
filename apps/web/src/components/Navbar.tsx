'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, ShoppingBag, ShieldCheck, Sparkles } from 'lucide-react';

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
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Store Name */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-zinc-100">
                Agent Sauda
              </span>
              <span className="text-[10px] text-zinc-400">
                AI Negotiation Platform
              </span>
            </div>
          </Link>

          {merchantSlug && (
            <div className="hidden sm:flex items-center gap-2 ml-4 pl-4 border-l border-zinc-800">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300 border border-zinc-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Store: <strong className="text-emerald-400 ml-1">{merchantName}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {onOpenCatalog && (
            <button
              onClick={onOpenCatalog}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-200 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-colors"
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

          <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 text-xs text-emerald-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Policy Guard Active</span>
          </div>

          <a
            href="http://localhost:4000/docs"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span>Swagger API</span>
            <Sparkles className="h-3 w-3 text-amber-400" />
          </a>
        </div>
      </div>
    </header>
  );
}
