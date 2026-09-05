'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, type MerchantSession } from '../lib/auth';
import {
  LayoutDashboard,
  Package,
  Sliders,
  CheckSquare,
  ShoppingBag,
  FileText,
  Store,
  LogOut,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Code2
} from 'lucide-react';
import { AgentSaudaLogo } from './AgentSaudaLogo';

interface AdminSidebarProps {
  merchant: MerchantSession | null;
}

export function AdminSidebar({ merchant }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    auth.clearSession();
    router.push('/admin/login');
  };

  const navItems = [
    {
      name: 'Overview & KPIs',
      href: '/admin',
      icon: LayoutDashboard,
      exact: true
    },
    {
      name: 'Catalog & Stock',
      href: '/admin/catalog',
      icon: Package
    },
    {
      name: 'Knowledge & RAG',
      href: '/admin/knowledge',
      icon: BookOpen
    },
    {
      name: 'Connect & SDK',
      href: '/admin/connect',
      icon: Code2
    },
    {
      name: 'Policy Guardrails',
      href: '/admin/policy',
      icon: Sliders
    },
    {
      name: 'HITL Approvals',
      href: '/admin/approvals',
      icon: CheckSquare
    },
    {
      name: 'Orders & Dispatch',
      href: '/admin/orders',
      icon: ShoppingBag
    },
    {
      name: 'Audit Compliance',
      href: '/admin/audit',
      icon: FileText
    }
  ];

  return (
    <aside className="w-64 shrink-0 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between min-h-screen">
      <div>
        {/* Top Brand Header */}
        <div className="p-4 border-b border-slate-800/80">
          <Link href="/admin" className="block">
            <AgentSaudaLogo size="sm" subtitle="Merchant Control Center" theme="dark" />
          </Link>

          {/* Active Store Badge */}
          {merchant && (
            <div className="mt-3.5 rounded-xl bg-slate-900/90 border border-slate-800 p-2.5 flex items-center justify-between">
              <div className="truncate pr-2">
                <span className="text-[11px] font-bold text-slate-200 block truncate">
                  {merchant.name}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {merchant.currency} &bull; {merchant.role}
                </span>
              </div>
              <Link
                href={`/negotiate/${merchant.slug}`}
                target="_blank"
                title="Open Public Storefront"
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-slate-800/80">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
