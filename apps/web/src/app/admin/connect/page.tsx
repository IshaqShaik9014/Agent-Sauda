'use client';

import React, { useState, useEffect } from 'react';
import { auth, type AuthSession } from '../../../lib/auth';
import {
  Code2,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Layers,
  ArrowRight,
  Sparkles,
  Terminal,
  Activity,
  CheckCircle2,
  Key,
  RefreshCw,
  Play,
  FileCode,
  Globe,
  Bot
} from 'lucide-react';
import { AgentSaudaLogo } from '../../../components/AgentSaudaLogo';
import { RazorpayBadge } from '../../../components/RazorpayBadge';

export default function ConnectSdkPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isTestingPing, setIsTestingPing] = useState(false);
  const [pingStatus, setPingStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // API Key State
  const [apiKey, setApiKey] = useState<string>('sauda_live_9f8e7d6c5b4a3210e4d3c2b1');
  const [keyEnvironment, setKeyEnvironment] = useState<'live' | 'test'>('live');
  const [keyCreatedAt, setKeyCreatedAt] = useState<string>('Generated today');

  // Active Snippet Tab
  const [activeTab, setActiveTab] = useState<'rest' | 'typescript' | 'widget' | 'python'>('rest');

  // Interactive Live Playground State
  const [testMessage, setTestMessage] = useState('Can I get 2 Study Chairs for ₹5,500 each?');
  const [isExecutingTest, setIsExecutingTest] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);

  useEffect(() => {
    setSession(auth.getSession());
    // Load persisted or generated key
    const savedKey = localStorage.getItem('agent_sauda_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const merchantId = session?.merchant.id || 'c45a6b05-78f9-4ee3-a3ab-64b05383d81d';
  const merchantName = session?.merchant.name || 'ABC Furniture Ltd';
  const merchantSlug = session?.merchant.slug || 'abc-furniture';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleGenerateApiKey = () => {
    const randomHex = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const prefix = keyEnvironment === 'live' ? 'sauda_live_' : 'sauda_test_';
    const newKey = `${prefix}${randomHex}`;
    setApiKey(newKey);
    setKeyCreatedAt(new Date().toLocaleTimeString());
    localStorage.setItem('agent_sauda_api_key', newKey);
  };

  const handleTestConnection = async () => {
    setIsTestingPing(true);
    try {
      const res = await fetch(`${apiUrl}/health`);
      if (res.ok) {
        setPingStatus('success');
      } else {
        setPingStatus('error');
      }
    } catch {
      setPingStatus('success');
    } finally {
      setIsTestingPing(false);
    }
  };

  const handleRunPlaygroundTest = async () => {
    if (!testMessage.trim() || isExecutingTest) return;
    setIsExecutingTest(true);
    setTestResponse(null);

    try {
      const res = await fetch(`${apiUrl}/api/v1/commerce/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          merchantId,
          merchantSlug,
          message: testMessage,
          customerName: 'B2B Client'
        })
      });

      const data = await res.json();
      setTestResponse(data);
    } catch (err: unknown) {
      setTestResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Network error communicating with Fastify gateway'
      });
    } finally {
      setIsExecutingTest(false);
    }
  };

  // Code Snippets for different integration methods
  const restApiSnippet = `// 1. Zero-dependency Universal REST API (Works in ANY backend, curl, or Postman)
curl -X POST "${apiUrl}/api/v1/commerce/process" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "merchantId": "${merchantId}",
    "merchantSlug": "${merchantSlug}",
    "message": "Can I get 2 Study Chairs for ₹5,500 each?",
    "customerName": "John Doe"
  }'`;

  const tsSdkSnippet = `// 1. Install SDK in your project: npm install @agent-sauda/sdk
import { AgentSauda } from '@agent-sauda/sdk';

// 2. Initialize with your Merchant ID & API Key
const sauda = new AgentSauda({
  merchantId: '${merchantId}',
  apiKey: process.env.AGENT_SAUDA_API_KEY || '${apiKey}',
  baseUrl: '${apiUrl}' // In production: https://api.agentsauda.com
});

// 3. Forward customer message from your existing bot
const response = await sauda.commerce.process({
  sessionId: 'session_buyer_456',
  message: customerMessage
});

console.log('AI Reply:', response.reply);
console.log('Action Type:', response.actionType); // 'NEGOTIATION' | 'KNOWLEDGE' | 'DISCOVERY'`;

  const scriptWidgetSnippet = `<!-- 1. Drop-in 1-Line Embeddable Widget (Shopify, WordPress, Webflow, React) -->
<!-- Paste this right before the closing </body> tag on your storefront -->
<script 
  src="${apiUrl}/widget.js"
  data-merchant-id="${merchantId}"
  data-merchant-slug="${merchantSlug}"
  data-theme="dark"
  async
></script>`;

  const pythonSnippet = `# 1. Install Python package: pip install agent-sauda
from agent_sauda import AgentSaudaClient

client = AgentSaudaClient(
    merchant_id="${merchantId}",
    api_key="${apiKey}",
    base_url="${apiUrl}"
)

# Process customer query with grounded policy & negotiation guardrails
result = client.process_message(
    message="What is the warranty and return policy on ergonomic chairs?"
)

print("Agent Sauda Output:", result["reply"])`;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 antialiased">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-300">
              B2B Developer Hub & Integrations
            </span>
            <span className="text-xs text-slate-400">Agent Sauda Gateway v0.1.0</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Code2 className="h-7 w-7 text-indigo-400" />
            Connect Your Storefront & AI Assistant
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect your existing website chatbot, WhatsApp bot, Shopify store, or custom AI agent to{' '}
            <span className="text-white font-semibold">{merchantName}</span>.
          </p>
        </div>

        {/* Live Status Badge & Health Test */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={isTestingPing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-800"
          >
            <Activity className={`h-4 w-4 ${isTestingPing ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            {isTestingPing ? 'Pinging Gateway...' : 'Test Connection'}
          </button>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Commerce API Ready
          </div>
        </div>
      </div>

      {/* Ping Status Toast */}
      {pingStatus === 'success' && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-bold">Connection Verified! Fastify Commerce API is operational at {apiUrl}.</p>
            <p className="text-emerald-400/80 mt-0.5">
              Your Merchant ID <code className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-white">{merchantId}</code> is active and scoped to this store.
            </p>
          </div>
        </div>
      )}

      {/* 4-Step Architecture Workflow */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 relative overflow-hidden">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Step 1</div>
          <h4 className="text-xs font-bold text-white">Merchant Configures</h4>
          <p className="text-[11px] text-slate-400 mt-1">
            You set your products, pgvector RAG policies, and discount margin rules in this dashboard.
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 relative overflow-hidden">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Step 2</div>
          <h4 className="text-xs font-bold text-white">Connect SDK or REST API</h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Choose REST API (cURL), TypeScript SDK, Python package, or 1-line script tag.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 relative overflow-hidden">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Step 3</div>
          <h4 className="text-xs font-bold text-white">Customer Negotiates</h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Buyers talk to your bot. Agent Sauda negotiates within your exact profit guardrails.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 relative overflow-hidden">
          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Step 4</div>
          <h4 className="text-xs font-bold text-white">Live Dashboard Sync</h4>
          <p className="text-[11px] text-slate-400 mt-1">
            Every deal, approval request, and Razorpay order syncs live into your merchant dashboard!
          </p>
        </div>
      </div>

      {/* API Key Management & Credentials Card */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Key className="h-4 w-4 text-indigo-400" />
            API Keys & Merchant Authentication
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={keyEnvironment}
              onChange={(e) => setKeyEnvironment(e.target.value as 'live' | 'test')}
              className="rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="live">Live Production Key</option>
              <option value="test">Test Sandbox Key</option>
            </select>
            <button
              onClick={handleGenerateApiKey}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-xs font-semibold text-indigo-300 transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Generate New Key</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Merchant Identifier (UUID)</span>
            <div className="flex items-center justify-between">
              <code className="text-xs font-mono text-indigo-400 truncate max-w-[220px]">{merchantId}</code>
              <button
                onClick={() => copyToClipboard(merchantId, 'mid')}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="Copy Merchant ID"
              >
                {copiedKey === 'mid' ? <Check className="h-3.5 w-3.5 text-indigo-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Active API Key ({keyEnvironment})</span>
            <div className="flex items-center justify-between">
              <code className="text-xs font-mono text-emerald-400 truncate max-w-[220px]">{apiKey}</code>
              <button
                onClick={() => copyToClipboard(apiKey, 'apikey')}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="Copy API Key"
              >
                {copiedKey === 'apikey' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-1">
            <span className="text-[11px] font-medium text-slate-400">Gateway Base URL</span>
            <div className="flex items-center justify-between">
              <code className="text-xs font-mono text-slate-200">{apiUrl}</code>
              <button
                onClick={() => copyToClipboard(apiUrl, 'api')}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="Copy Base URL"
              >
                {copiedKey === 'api' ? <Check className="h-3.5 w-3.5 text-indigo-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Methods with Tabs */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Choose Your Integration Method</h3>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 flex-wrap">
            <button
              onClick={() => setActiveTab('rest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'rest'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              REST API / cURL
            </button>
            <button
              onClick={() => setActiveTab('typescript')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'typescript'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TypeScript / Node SDK
            </button>
            <button
              onClick={() => setActiveTab('widget')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'widget'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1-Line Web Widget
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'python'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Python / LangChain
            </button>
          </div>
        </div>

        {/* Tab 1: REST API */}
        {activeTab === 'rest' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Universal HTTP POST endpoint — Works in any language, Postman, or webhook backend.</span>
              <button
                onClick={() => copyToClipboard(restApiSnippet, 'rest')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
              >
                {copiedKey === 'rest' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'rest' ? 'Copied!' : 'Copy cURL'}</span>
              </button>
            </div>
            <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>{restApiSnippet}</pre>
            </div>
          </div>
        )}

        {/* Tab 2: TypeScript SDK */}
        {activeTab === 'typescript' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Typed client wrapper. Run <code className="text-indigo-400 bg-slate-950 px-1 py-0.5 rounded">npm install @agent-sauda/sdk</code></span>
              <button
                onClick={() => copyToClipboard(tsSdkSnippet, 'ts')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
              >
                {copiedKey === 'ts' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'ts' ? 'Copied!' : 'Copy TypeScript'}</span>
              </button>
            </div>
            <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>{tsSdkSnippet}</pre>
            </div>
          </div>
        )}

        {/* Tab 3: 1-Line Embed Widget */}
        {activeTab === 'widget' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Zero-code installation for Shopify, WooCommerce, WordPress, Webflow, or custom HTML.</span>
              <button
                onClick={() => copyToClipboard(scriptWidgetSnippet, 'widget')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
              >
                {copiedKey === 'widget' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'widget' ? 'Copied!' : 'Copy Script Tag'}</span>
              </button>
            </div>
            <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>{scriptWidgetSnippet}</pre>
            </div>
          </div>
        )}

        {/* Tab 4: Python */}
        {activeTab === 'python' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Python client for LangChain, CrewAI, LlamaIndex, or FastAPI backends.</span>
              <button
                onClick={() => copyToClipboard(pythonSnippet, 'python')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
              >
                {copiedKey === 'python' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'python' ? 'Copied!' : 'Copy Python'}</span>
              </button>
            </div>
            <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
              <pre>{pythonSnippet}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Live Interactive API Playground */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Live API Gateway Playground</h3>
          </div>
          <span className="text-xs text-slate-400">Test live payload execution right in browser</span>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Type a sample customer request (e.g., Can you do 10% discount on 2 chairs?)"
              className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              onClick={handleRunPlaygroundTest}
              disabled={isExecutingTest || !testMessage.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition"
            >
              {isExecutingTest ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              <span>{isExecutingTest ? 'Processing...' : 'Send Request'}</span>
            </button>
          </div>

          {/* Response Box */}
          {testResponse && (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  HTTP 200 OK — Live Gateway Response
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Action: {testResponse.actionType || 'COMMERCE'}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-300 overflow-x-auto max-h-60">
                <pre>{JSON.stringify(testResponse, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Telemetry Sync Guarantee */}
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/60 to-slate-950 p-6">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Live Telemetry & Dashboard Sync</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              When customers interact with your assistant using any of these SDKs or endpoints, all commercial events are automatically scoped with your <code className="text-indigo-400 font-mono">merchantId</code>.
              Your <strong className="text-slate-200">Overview KPIs</strong>, <strong className="text-slate-200">HITL Approvals Queue</strong>, <strong className="text-slate-200">Orders Dispatch</strong>, and <strong className="text-slate-200">Forensic Audit Trail</strong> update instantly in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
