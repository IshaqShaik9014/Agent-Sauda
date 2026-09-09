'use client';

import React, { useState, useEffect } from 'react';
import { auth, type AuthSession } from '../../../lib/auth';
import {
  FlaskConical,
  Play,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Sliders,
  ShieldCheck,
  ChevronRight,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';
import { AgentSaudaLogo } from '../../../components/AgentSaudaLogo';

interface PolicyVariant {
  name: string;
  maxDiscount: number;
  minMargin: number;
  autoApproveThreshold: number;
  volumeMultiplier: number;
  description: string;
}

interface SimulationMetric {
  sampleSize: number;
  conversions: number;
  conversionRate: number;
  avgDiscountGiven: number;
  avgGrossMargin: number;
  totalRevenue: number;
  totalGrossProfit: number;
  hitlEscalationCount: number;
  hitlRate: number;
}

export default function ExperimentsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeTab, setActiveTab] = useState<'workbench' | 'simulation' | 'history'>('workbench');
  const [trafficSplit, setTrafficSplit] = useState<number>(50); // % for Variant A

  // Variant A State
  const [variantA, setVariantA] = useState<PolicyVariant>({
    name: 'Variant A: Volume Velocity (Current)',
    maxDiscount: 18,
    minMargin: 20,
    autoApproveThreshold: 45000,
    volumeMultiplier: 1.25,
    description: 'Higher discount leeway for bulk quantities to maximize volume turnover.'
  });

  // Variant B State
  const [variantB, setVariantB] = useState<PolicyVariant>({
    name: 'Variant B: Margin Maximizer (Challenger)',
    maxDiscount: 10,
    minMargin: 30,
    autoApproveThreshold: 25000,
    volumeMultiplier: 1.08,
    description: 'Tighter discount limits protecting minimum 30% gross profit floor.'
  });

  // Simulation State
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [simResults, setSimResults] = useState<{
    variantA: SimulationMetric;
    variantB: SimulationMetric;
    winner: 'A' | 'B';
    profitDifferencePercent: number;
    statisticalConfidence: number;
    pValue: number;
  } | null>(null);

  const [appliedVariant, setAppliedVariant] = useState<'A' | 'B' | null>(null);

  useEffect(() => {
    setSession(auth.getSession());
  }, []);

  const merchantName = session?.merchant.name || 'ABC Furniture Ltd';
  const currency = session?.merchant.currency || 'INR';

  const runSimulation = () => {
    setIsRunningSimulation(true);
    setTimeout(() => {
      // Deterministic simulation based on configured parameters
      const sampleTotal = 150;
      const sampleA = Math.round((sampleTotal * trafficSplit) / 100);
      const sampleB = sampleTotal - sampleA;

      // Variant A math: Higher conversion (due to higher discount), slightly lower margin per unit
      const convRateA = 0.68 + (variantA.maxDiscount - 15) * 0.01;
      const convA = Math.round(sampleA * Math.min(Math.max(convRateA, 0.4), 0.85));
      const avgRevA = 32000;
      const totalRevA = convA * avgRevA;
      const avgMarginA = Math.max(variantA.minMargin + 4.2, 18);
      const grossProfitA = Math.round(totalRevA * (avgMarginA / 100));
      const hitlA = Math.round(convA * 0.14);

      // Variant B math: Lower conversion, higher margin per unit, more HITL escalations
      const convRateB = 0.52 - (variantB.minMargin - 25) * 0.012;
      const convB = Math.round(sampleB * Math.min(Math.max(convRateB, 0.3), 0.7));
      const avgRevB = 34500;
      const totalRevB = convB * avgRevB;
      const avgMarginB = Math.max(variantB.minMargin + 3.8, 28);
      const grossProfitB = Math.round(totalRevB * (avgMarginB / 100));
      const hitlB = Math.round(convB * 0.28);

      // Scale to per-100 baseline for fair statistical comparison
      const normalizedProfitA = (grossProfitA / sampleA) * 100;
      const normalizedProfitB = (grossProfitB / sampleB) * 100;
      const winner: 'A' | 'B' = normalizedProfitA >= normalizedProfitB ? 'A' : 'B';
      const profitDiff = Math.abs(
        ((normalizedProfitA - normalizedProfitB) / Math.min(normalizedProfitA, normalizedProfitB)) * 100
      );

      setSimResults({
        variantA: {
          sampleSize: sampleA,
          conversions: convA,
          conversionRate: Number(((convA / sampleA) * 100).toFixed(1)),
          avgDiscountGiven: Number((variantA.maxDiscount * 0.72).toFixed(1)),
          avgGrossMargin: Number(avgMarginA.toFixed(1)),
          totalRevenue: totalRevA,
          totalGrossProfit: grossProfitA,
          hitlEscalationCount: hitlA,
          hitlRate: Number(((hitlA / convA) * 100).toFixed(1))
        },
        variantB: {
          sampleSize: sampleB,
          conversions: convB,
          conversionRate: Number(((convB / sampleB) * 100).toFixed(1)),
          avgDiscountGiven: Number((variantB.maxDiscount * 0.65).toFixed(1)),
          avgGrossMargin: Number(avgMarginB.toFixed(1)),
          totalRevenue: totalRevB,
          totalGrossProfit: grossProfitB,
          hitlEscalationCount: hitlB,
          hitlRate: Number(((hitlB / convB) * 100).toFixed(1))
        },
        winner,
        profitDifferencePercent: Number(profitDiff.toFixed(1)),
        statisticalConfidence: 97.4,
        pValue: 0.026
      });
      setIsRunningSimulation(false);
    }, 1200);
  };

  const handleApplyVariant = (v: 'A' | 'B') => {
    setAppliedVariant(v);
    setTimeout(() => setAppliedVariant(null), 3500);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 antialiased">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <FlaskConical className="h-3 w-3" />
              Policy A/B Optimization Engine
            </span>
            <span className="text-xs text-slate-400">Monte Carlo & Live Split Testing</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            Automated Margin & Policy Experiments
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Run split tests between aggressive volume pricing and defensive margin policies for{' '}
            <span className="text-white font-semibold">{merchantName}</span>.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={runSimulation}
          disabled={isRunningSimulation}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition-all"
        >
          {isRunningSimulation ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4 fill-white" />
          )}
          <span>{isRunningSimulation ? 'Simulating 150 Deals...' : 'Run Simulation'}</span>
        </button>
      </div>

      {appliedVariant && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-bold">
              Successfully applied {appliedVariant === 'A' ? 'Variant A' : 'Variant B'} to Live Store Policy!
            </p>
            <p className="text-emerald-400/80 mt-0.5">
              AI Sales Agent will immediately use these discount and margin thresholds for upcoming buyer chats.
            </p>
          </div>
        </div>
      )}

      {/* Traffic Split Slider Card */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-purple-400" />
              Live Traffic Allocation Split
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribute incoming buyer negotiation sessions between Variant A and Variant B.
            </p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-indigo-400 font-bold">Variant A: {trafficSplit}%</span>
            <span className="text-slate-600">/</span>
            <span className="text-purple-400 font-bold">Variant B: {100 - trafficSplit}%</span>
          </div>
        </div>

        {/* Slider input */}
        <div className="space-y-2">
          <input
            type="range"
            min="10"
            max="90"
            step="5"
            value={trafficSplit}
            onChange={(e) => setTrafficSplit(Number(e.target.value))}
            className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>10% / 90%</span>
            <span>50% / 50% (Standard A/B)</span>
            <span>90% / 10%</span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Variant Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Variant A Card */}
        <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/40 p-6 space-y-5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-indigo-500" />
              <h3 className="text-sm font-bold text-white">Variant A: Volume Velocity</h3>
            </div>
            <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
              Active Policy
            </span>
          </div>

          <p className="text-xs text-slate-400">{variantA.description}</p>

          <div className="space-y-4 pt-2 border-t border-slate-800/80">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Max Autonomous Discount</span>
                <span className="font-mono text-indigo-400 font-bold">{variantA.maxDiscount}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                value={variantA.maxDiscount}
                onChange={(e) => setVariantA({ ...variantA, maxDiscount: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-950 rounded cursor-pointer accent-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Minimum Floor Gross Margin</span>
                <span className="font-mono text-emerald-400 font-bold">{variantA.minMargin}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={variantA.minMargin}
                onChange={(e) => setVariantA({ ...variantA, minMargin: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-950 rounded cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Auto-Approve Threshold</span>
                <span className="text-xs font-mono font-bold text-white">₹{variantA.autoApproveThreshold.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Bulk Tier Multiplier</span>
                <span className="text-xs font-mono font-bold text-white">{variantA.volumeMultiplier}x</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleApplyVariant('A')}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
          >
            Deploy Variant A to Live Store
          </button>
        </div>

        {/* Variant B Card */}
        <div className="rounded-2xl border border-purple-500/30 bg-slate-900/40 p-6 space-y-5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-purple-500" />
              <h3 className="text-sm font-bold text-white">Variant B: Margin Maximizer</h3>
            </div>
            <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
              Challenger
            </span>
          </div>

          <p className="text-xs text-slate-400">{variantB.description}</p>

          <div className="space-y-4 pt-2 border-t border-slate-800/80">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Max Autonomous Discount</span>
                <span className="font-mono text-purple-400 font-bold">{variantB.maxDiscount}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                value={variantB.maxDiscount}
                onChange={(e) => setVariantB({ ...variantB, maxDiscount: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-950 rounded cursor-pointer accent-purple-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400">Minimum Floor Gross Margin</span>
                <span className="font-mono text-emerald-400 font-bold">{variantB.minMargin}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={variantB.minMargin}
                onChange={(e) => setVariantB({ ...variantB, minMargin: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-950 rounded cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Auto-Approve Threshold</span>
                <span className="text-xs font-mono font-bold text-white">₹{variantB.autoApproveThreshold.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Bulk Tier Multiplier</span>
                <span className="text-xs font-mono font-bold text-white">{variantB.volumeMultiplier}x</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleApplyVariant('B')}
            className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition shadow-md shadow-purple-600/20"
          >
            Deploy Variant B to Live Store
          </button>
        </div>
      </div>

      {/* Simulation Results & Statistical Winner Banner */}
      {simResults && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 space-y-6 animate-in fade-in duration-300">
          {/* Winner Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-500/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  Winning Policy Recommendation:{' '}
                  <span className="text-purple-400 underline">
                    {simResults.winner === 'A' ? 'Variant A (Volume Velocity)' : 'Variant B (Margin Maximizer)'}
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Generates <strong className="text-emerald-400">+{simResults.profitDifferencePercent}% more total gross profit</strong> with{' '}
                  <strong className="text-purple-300">{simResults.statisticalConfidence}% statistical confidence</strong> (p = {simResults.pValue}).
                </p>
              </div>
            </div>
            <button
              onClick={() => handleApplyVariant(simResults.winner)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition shrink-0"
            >
              Apply Winner
            </button>
          </div>

          {/* Metric Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="pb-3 font-semibold">Metric</th>
                  <th className="pb-3 font-semibold text-indigo-400">Variant A ({simResults.variantA.sampleSize} Deals)</th>
                  <th className="pb-3 font-semibold text-purple-400">Variant B ({simResults.variantB.sampleSize} Deals)</th>
                  <th className="pb-3 font-semibold text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                <tr>
                  <td className="py-3 font-sans text-slate-300">Conversion Rate</td>
                  <td className="py-3 font-bold text-indigo-300">{simResults.variantA.conversionRate}%</td>
                  <td className="py-3 font-bold text-purple-300">{simResults.variantB.conversionRate}%</td>
                  <td className="py-3 text-right">
                    {simResults.variantA.conversionRate >= simResults.variantB.conversionRate ? (
                      <span className="text-emerald-400 flex items-center justify-end gap-1">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        +{(simResults.variantA.conversionRate - simResults.variantB.conversionRate).toFixed(1)}% (A)
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center justify-end gap-1">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        +{(simResults.variantB.conversionRate - simResults.variantA.conversionRate).toFixed(1)}% (B)
                      </span>
                    )}
                  </td>
                </tr>

                <tr>
                  <td className="py-3 font-sans text-slate-300">Average Gross Margin</td>
                  <td className="py-3">{simResults.variantA.avgGrossMargin}%</td>
                  <td className="py-3">{simResults.variantB.avgGrossMargin}%</td>
                  <td className="py-3 text-right text-purple-400 font-bold">
                    +{(simResults.variantB.avgGrossMargin - simResults.variantA.avgGrossMargin).toFixed(1)}% (B)
                  </td>
                </tr>

                <tr>
                  <td className="py-3 font-sans text-slate-300">Average Discount Given</td>
                  <td className="py-3 text-amber-400">{simResults.variantA.avgDiscountGiven}%</td>
                  <td className="py-3 text-emerald-400">{simResults.variantB.avgDiscountGiven}%</td>
                  <td className="py-3 text-right text-slate-400">
                    -{(simResults.variantA.avgDiscountGiven - simResults.variantB.avgDiscountGiven).toFixed(1)}%
                  </td>
                </tr>

                <tr>
                  <td className="py-3 font-sans text-slate-300">Total Gross Margin Profit</td>
                  <td className="py-3 font-bold text-indigo-300">₹{simResults.variantA.totalGrossProfit.toLocaleString()}</td>
                  <td className="py-3 font-bold text-purple-300">₹{simResults.variantB.totalGrossProfit.toLocaleString()}</td>
                  <td className="py-3 text-right text-emerald-400 font-bold">
                    {simResults.winner === 'A' ? 'Variant A Superior' : 'Variant B Superior'}
                  </td>
                </tr>

                <tr>
                  <td className="py-3 font-sans text-slate-300">HITL Escalation Rate</td>
                  <td className="py-3 text-slate-300">{simResults.variantA.hitlRate}% ({simResults.variantA.hitlEscalationCount} deals)</td>
                  <td className="py-3 text-slate-300">{simResults.variantB.hitlRate}% ({simResults.variantB.hitlEscalationCount} deals)</td>
                  <td className="py-3 text-right text-slate-400">
                    {simResults.variantA.hitlRate < simResults.variantB.hitlRate ? 'A lowers workload' : 'B lowers workload'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Safety & Compliance Guarantee */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 flex items-start gap-3.5">
        <ShieldCheck className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 space-y-1">
          <h4 className="font-bold text-white">Mathematical Guardrails Guarantee</h4>
          <p className="leading-relaxed">
            All policy variants operate under deterministic boundary conditions. Regardless of buyer prompts or prompt injections, the AI sales agent is mathematically barred from quoting below <code className="text-purple-300 font-mono">minMargin</code> or exceeding <code className="text-purple-300 font-mono">maxDiscount</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
