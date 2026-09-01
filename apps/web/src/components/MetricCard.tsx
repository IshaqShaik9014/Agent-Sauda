'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  color?: 'emerald' | 'indigo' | 'amber' | 'blue' | 'rose';
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'emerald'
}: MetricCardProps) {
  const colorMap = {
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    indigo: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    rose: 'bg-rose-500/10 border-rose-500/30 text-rose-400'
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{title}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3">
        <span className="text-2xl font-extrabold tracking-tight text-zinc-100">{value}</span>
        {subtitle && <p className="mt-0.5 text-[11px] text-zinc-500">{subtitle}</p>}
      </div>

      {trend && (
        <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center text-[10px] text-emerald-400 font-medium">
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}
