'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  RefreshCw,
  MessageSquare,
  Search,
  Package,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Mail,
  KeyRound,
  BadgeCheck,
  X
} from 'lucide-react';
import { OfferCard } from './OfferCard';
import { api, type PublicCatalogProduct } from '../lib/api';
import type { OfferResponse } from '@agent-sauda/domain';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  offer?: OfferResponse;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface BuyerProfile {
  name: string;
  phone: string;
  email: string;
  isVerified: boolean;
  verifiedAt?: string;
}

interface ChatInterfaceProps {
  merchantSlug: string;
  merchantName: string;
  initialProducts: PublicCatalogProduct[];
  selectedProduct?: PublicCatalogProduct | null;
  onProceedToCheckout?: (offerId: string) => void;
}

export function ChatInterface({
  merchantSlug,
  merchantName,
  initialProducts,
  selectedProduct,
  onProceedToCheckout
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingToolStatus, setStreamingToolStatus] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Buyer Identity & OTP Verification State
  const [buyerProfile, setBuyerProfile] = useState<BuyerProfile>({
    name: 'Ishaq Shaik',
    phone: '+91 98765 43210',
    email: 'ishaq@enterprise.com',
    isVerified: false
  });
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'INPUT' | 'OTP'>('INPUT');
  const [inputName, setInputName] = useState('Ishaq Shaik');
  const [inputPhone, setInputPhone] = useState('+91 98765 43210');
  const [inputEmail, setInputEmail] = useState('ishaq@enterprise.com');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [mockGeneratedOtp, setMockGeneratedOtp] = useState('849201');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('agent_sauda_buyer_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBuyerProfile(parsed);
        setInputName(parsed.name || 'Ishaq Shaik');
        setInputPhone(parsed.phone || '+91 98765 43210');
        setInputEmail(parsed.email || 'ishaq@enterprise.com');
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleSendOtp = () => {
    if (!inputPhone || !inputEmail) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setMockGeneratedOtp(code);
    setOtpStep('OTP');
  };

  const handleVerifyOtp = () => {
    setIsVerifyingOtp(true);
    setTimeout(() => {
      const verifiedData: BuyerProfile = {
        name: inputName.trim() || 'Verified Buyer',
        phone: inputPhone.trim(),
        email: inputEmail.trim(),
        isVerified: true,
        verifiedAt: new Date().toISOString()
      };
      setBuyerProfile(verifiedData);
      localStorage.setItem('agent_sauda_buyer_profile', JSON.stringify(verifiedData));
      setIsVerifyingOtp(false);
      setIsOtpModalOpen(false);
      setOtpStep('INPUT');

      setMessages((prev) => [
        ...prev,
        {
          id: `verified-${Date.now()}`,
          role: 'system',
          content: `🛡️ Buyer identity verified via OTP: ${verifiedData.name} (${verifiedData.phone}). High-ticket wholesale quotes unlocked!`,
          timestamp: new Date()
        }
      ]);
    }, 600);
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingToolStatus]);

  // Initial welcome message from AI Agent
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          role: 'assistant',
          content: `Hello! I'm the AI Sales Assistant for **${merchantName}**. I can answer product questions, check live warehouse stock, and negotiate bundle discounts with you within our store policy. How can I help you today?`,
          timestamp: new Date()
        }
      ]);
    }
  }, [merchantName]);

  // Pre-fill prompt when user selects a product from the catalog drawer
  useEffect(() => {
    if (selectedProduct) {
      setInputValue(
        `I'm interested in "${selectedProduct.title}" (Base Price: ₹${selectedProduct.basePrice.toLocaleString('en-IN')}). Can you offer me a discount if I buy 2 units?`
      );
    }
  }, [selectedProduct]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setStreamingToolStatus(null);

    const agentMessageId = `agent-${Date.now()}`;
    const initialAgentMessage: ChatMessageItem = {
      id: agentMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    try {
      // Initiate Server-Sent Events (SSE) streaming chat request
      const response = await fetch(`${apiUrl}/api/agent/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: text,
          customerName: 'Buyer',
          merchantSlug
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed with status ${response.status}`);
      }

      setMessages((prev) => [...prev, initialAgentMessage]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';
      let activeOfferObj: OfferResponse | undefined = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;

          let eventType = 'message';
          let eventData = '';

          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.replace('data: ', '').trim();
            }
          }

          if (eventType === 'text_delta') {
            try {
              const parsed = JSON.parse(eventData);
              accumulatedText += parsed.chunk || '';
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === agentMessageId
                    ? { ...msg, content: accumulatedText, isStreaming: true }
                    : msg
                )
              );
            } catch {
              accumulatedText += eventData;
            }
          } else if (eventType === 'tool_call') {
            try {
              const parsed = JSON.parse(eventData);
              if (parsed.tool === 'search_merchant_knowledge') {
                setStreamingToolStatus('📚 Searching store knowledge & return policies...');
              } else if (parsed.tool === 'check_inventory') {
                setStreamingToolStatus('📦 Checking warehouse inventory availability...');
              } else if (parsed.tool === 'propose_offer') {
                setStreamingToolStatus('🛡️ Evaluating deterministic profit margin policy...');
              } else if (parsed.tool === 'search_catalog') {
                setStreamingToolStatus('🔍 Querying official product specifications...');
              }
            } catch {}
          } else if (eventType === 'tool_result') {
            setStreamingToolStatus(null);
          } else if (eventType === 'offer_ready') {
            try {
              const parsed = JSON.parse(eventData);
              if (parsed.offer?.id) {
                const offerDetails = await api.getOffer(parsed.offer.id);
                activeOfferObj = offerDetails.offer;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === agentMessageId ? { ...msg, offer: activeOfferObj } : msg
                  )
                );
              }
            } catch {}
          } else if (eventType === 'done') {
            try {
              const parsed = JSON.parse(eventData);
              if (parsed.conversationId) {
                setConversationId(parsed.conversationId);
              }
            } catch {}
          }
        }
      }

      // Finalize streaming message state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === agentMessageId
            ? { ...msg, isStreaming: false, offer: activeOfferObj }
            : msg
        )
      );
    } catch (err: unknown) {
      console.warn('[ChatInterface] Streaming fallback to standard REST:', err);
      // Fallback to standard chat endpoint if streaming interrupted
      try {
        const fallbackRes = await api.sendChatMessage({
          conversationId,
          message: text,
          customerName: 'Buyer',
          merchantSlug
        });

        setConversationId(fallbackRes.conversationId);
        let fetchedOffer: OfferResponse | undefined = undefined;

        if (fallbackRes.activeOffer?.id) {
          try {
            const offerDetails = await api.getOffer(fallbackRes.activeOffer.id);
            fetchedOffer = offerDetails.offer;
          } catch {}
        }

        setMessages((prev) => [
          ...prev.filter((m) => m.id !== agentMessageId),
          {
            id: `agent-${Date.now()}`,
            role: 'assistant',
            content: fallbackRes.message,
            offer: fetchedOffer,
            timestamp: new Date()
          }
        ]);
      } catch (fallbackErr) {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== agentMessageId),
          {
            id: `error-${Date.now()}`,
            role: 'system',
            content: `⚠️ Failed to receive response: ${(fallbackErr as Error).message}`,
            timestamp: new Date()
          }
        ]);
      }
    } finally {
      setIsLoading(false);
      setStreamingToolStatus(null);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      await api.acceptOffer(offerId);
      // Update local message offer state to ACCEPTED
      setMessages((prev) =>
        prev.map((msg) =>
          msg.offer?.id === offerId
            ? { ...msg, offer: { ...msg.offer, status: 'ACCEPTED' as const } }
            : msg
        )
      );

      // Add system message
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'system',
          content: '🎉 Offer accepted! Converting to order and securing inventory reservation...',
          timestamp: new Date()
        }
      ]);

      if (onProceedToCheckout) {
        onProceedToCheckout(offerId);
      }
    } catch (err: unknown) {
      alert(`Could not accept offer: ${(err as Error).message}`);
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    try {
      await api.rejectOffer(offerId, 'Buyer declined in chat');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.offer?.id === offerId
            ? { ...msg, offer: { ...msg.offer, status: 'REJECTED' as const } }
            : msg
        )
      );
    } catch (err: unknown) {
      alert(`Could not decline offer: ${(err as Error).message}`);
    }
  };

  const quickPrompts = [
    'What products do you have available?',
    initialProducts[0]
      ? `Can you give me 5% off on "${initialProducts[0].title}"?`
      : 'Can you offer a 5% discount for 2 units?',
    'What is your 30-day return policy?'
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto w-full px-2 sm:px-4 py-3 antialiased">
      {/* Top Buyer Identity Banner */}
      <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/70 px-3.5 py-2 text-xs backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-2">
          {buyerProfile.isVerified ? (
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <BadgeCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Verified Buyer: {buyerProfile.name}</span>
              <span className="text-[10px] text-zinc-500 font-normal">({buyerProfile.phone})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <User className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <span>Guest Session: {buyerProfile.name}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setOtpStep('INPUT');
            setIsOtpModalOpen(true);
          }}
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all ${
            buyerProfile.isVerified
              ? 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white'
              : 'border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
          }`}
        >
          {buyerProfile.isVerified ? 'Edit Identity' : '⚡ Verify Identity (OTP)'}
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 rounded-2xl bg-slate-950/60 p-4 border border-slate-800/80 shadow-inner backdrop-blur-md">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-3.5 py-1.5 text-xs text-slate-300 font-medium shadow-sm">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white font-medium rounded-tr-none shadow-md shadow-indigo-950/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Embedded Offer Card Widget */}
                {msg.offer && (
                  <OfferCard
                    offer={msg.offer}
                    onAccept={handleAcceptOffer}
                    onReject={handleRejectOffer}
                    onProceedToCheckout={onProceedToCheckout}
                  />
                )}

                <div
                  className={`mt-1.5 text-[10px] text-right ${
                    isUser ? 'text-indigo-200/80' : 'text-slate-500'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Live Streaming Tool Badge & Typing Indicator */}
        {(isLoading || streamingToolStatus) && (
          <div className="flex gap-3 items-center text-xs text-slate-400">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 animate-pulse">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
              <span>{streamingToolStatus || 'Sauda AI is evaluating response...'}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-2 py-2.5 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-500 shrink-0">Suggestions:</span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className="shrink-0 text-xs px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 pt-1"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about products, return policies, or negotiate a price..."
            disabled={isLoading}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-40 transition"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      {/* Buyer Identity & OTP Verification Modal */}
      {isOtpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Buyer Identity Verification</h3>
                  <p className="text-[11px] text-slate-400">
                    Required for high-ticket wholesale negotiations & contractual offers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOtpModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {otpStep === 'INPUT' ? (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Full Name / Corporate Buyer</label>
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="e.g. Ishaq Shaik (TechCorp India)"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Mobile Number (for SMS / WhatsApp OTP)</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="tel"
                      value={inputPhone}
                      onChange={(e) => setInputPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Corporate Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="email"
                      value={inputEmail}
                      onChange={(e) => setInputEmail(e.target.value)}
                      placeholder="ishaq@company.com"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={!inputPhone || !inputEmail}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
                  >
                    Send 6-Digit OTP
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-300">
                  We sent a 6-digit verification code to <span className="font-mono text-indigo-400 font-bold">{inputPhone}</span>.
                </p>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Enter Verification Code</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      maxLength={6}
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value)}
                      placeholder="e.g. 849201"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-9 pr-3 py-2 text-xs text-white tracking-widest font-mono text-center focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Instant Fill Mock OTP Helper */}
                <div className="flex items-center justify-between rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-2.5 text-[11px]">
                  <span className="text-indigo-300 font-medium">Demo Simulation OTP:</span>
                  <button
                    type="button"
                    onClick={() => setEnteredOtp(mockGeneratedOtp)}
                    className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono font-bold hover:bg-indigo-500 transition"
                  >
                    Fill {mockGeneratedOtp}
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOtpStep('INPUT')}
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={isVerifyingOtp || !enteredOtp}
                    className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isVerifyingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    <span>Confirm & Verify</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
