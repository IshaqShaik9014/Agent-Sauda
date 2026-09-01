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
  ExternalLink
} from 'lucide-react';

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
    <aside className="w-64 shrink-0 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between min-h-screen">
      <div>
        {/* Top Brand Header */}
        <div className="p-5 border-b border-zinc-800/80">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-tight text-zinc-100 block leading-tight">
                AGENT SAUDA
              </span>
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                Merchant Portal
              </span>
            </div>
          </Link>

          {/* Active Store Badge */}
          {merchant && (
            <div className="mt-4 rounded-xl bg-zinc-900/90 border border-zinc-800 p-2.5 flex items-center justify-between">
              <div className="truncate pr-2">
                <span className="text-[11px] font-bold text-zinc-200 block truncate">
                  {merchant.name}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">
                  {merchant.currency} &bull; {merchant.role}
                </span>
              </div>
              <Link
                href={`/negotiate/${merchant.slug}`}
                target="_blank"
                title="Open Public Storefront"
                className="p-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 transition-colors"
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
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-zinc-800/80">
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
