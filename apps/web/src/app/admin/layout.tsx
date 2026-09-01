'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSidebar } from '../../components/AdminSidebar';
import { auth, type AuthSession } from '../../lib/auth';
import { Loader2, Bell, Shield, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const activeSession = auth.getSession();
    setSession(activeSession);

    // If not logged in and not on login page, redirect
    if (!activeSession && pathname !== '/admin/login') {
      router.push('/admin/login');
    }

    setIsCheckingAuth(false);
  }, [pathname, router]);

  // Login page has its own standalone container
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-xs text-zinc-400">Verifying merchant authorization...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex antialiased">
      {/* Sidebar Navigation */}
      <AdminSidebar merchant={session?.merchant || null} />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-300">Store Workspace:</span>
            <span className="rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs font-bold text-emerald-400">
              {session?.merchant.name || 'Demo Store'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
              <Shield className="h-3 w-3" />
              <span>Policy Guard Active</span>
            </div>

            {session?.merchant?.slug && (
              <Link
                href={`/negotiate/${session.merchant.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <span>Storefront</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
