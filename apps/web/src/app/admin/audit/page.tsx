'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '../../../lib/auth';
import { api, type AuditEventItem } from '../../../lib/api';
import {
  FileText,
  ShieldCheck,
  RefreshCw,
  Loader2,
  AlertCircle,
  Filter,
  User,
  Bot,
  Cpu,
  Clock
} from 'lucide-react';

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAuditEvents = async (refresh = false) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      if (refresh) setIsRefreshing(true);
      const res = await api.getAuditTrail(activeMerchant.id, {
        entityType: entityFilter || undefined,
        limit: 100
      });
      setEvents(res.events);
    } catch (err: unknown) {
      alert(`Could not load audit trail: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAuditEvents();
  }, [entityFilter]);

  const getActorBadge = (actorType: string) => {
    switch (actorType) {
      case 'AI_AGENT':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">
            <Bot className="h-3 w-3" /> AI AGENT
          </span>
        );
      case 'USER':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
            <User className="h-3 w-3" /> USER / BUYER
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300 border border-zinc-700">
            <Cpu className="h-3 w-3" /> SYSTEM
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-400" />
            Immutable Forensic Audit Trail
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Cryptographic provenance and regulatory compliance log of every money and policy event
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">All Subsystems</option>
            <option value="ORDER">Orders</option>
            <option value="PAYMENT">Payments</option>
            <option value="POLICY">Policy Guardrails</option>
            <option value="INVENTORY">Inventory</option>
            <option value="APPROVAL">HITL Approvals</option>
            <option value="OFFER">Negotiation Offers</option>
          </select>

          <button
            onClick={() => loadAuditEvents(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl overflow-hidden backdrop-blur-sm">
        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
            <p className="text-xs text-zinc-400">Loading audit log...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400">
            No audit events found for selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-4 font-semibold">Timestamp</th>
                  <th className="p-4 font-semibold">Action</th>
                  <th className="p-4 font-semibold">Actor</th>
                  <th className="p-4 font-semibold">Target Entity</th>
                  <th className="p-4 font-semibold">Reason & Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-zinc-800/20">
                    <td className="p-4 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'medium'
                      })}
                    </td>
                    <td className="p-4 font-semibold text-emerald-400 font-mono">
                      {evt.action}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {getActorBadge(evt.actorType)}
                    </td>
                    <td className="p-4 text-zinc-300 font-mono text-[11px]">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400 font-sans mr-1">
                        {evt.entityType}
                      </span>
                      {evt.entityId.slice(0, 8)}...
                    </td>
                    <td className="p-4 text-zinc-300 max-w-[300px]">
                      {evt.reason || 'Automated policy lifecycle action'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
