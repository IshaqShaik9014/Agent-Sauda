'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  RefreshCw,
  MessageSquare
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
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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

    try {
      const response = await api.sendChatMessage({
        conversationId,
        message: text,
        customerName: 'Buyer'
      });

      setConversationId(response.conversationId);

      let fetchedOffer: OfferResponse | undefined = undefined;
      if (response.activeOffer?.id) {
        try {
          const offerDetails = await api.getOffer(response.activeOffer.id);
          fetchedOffer = offerDetails.offer;
        } catch {
          // If offer lookup fails, continue with text
        }
      }

      const agentMessage: ChatMessageItem = {
        id: `agent-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        offer: fetchedOffer,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, agentMessage]);
    } catch (err: unknown) {
      const errorMessage: ChatMessageItem = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `⚠️ Failed to get a response from sales agent: ${(err as Error).message}`,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
      ? `Can you give me 15% off on "${initialProducts[0].title}"?`
      : 'Can you offer a 10% volume discount for 3 units?',
    'What is your minimum margin policy?'
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto w-full px-2 sm:px-4 py-3">
      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 rounded-xl bg-zinc-950/40 p-4 border border-zinc-800/80 shadow-inner">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="rounded-lg bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
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
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-emerald-600 text-white font-medium rounded-tr-none shadow-md shadow-emerald-950/30'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none'
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
                    isUser ? 'text-emerald-200/80' : 'text-zinc-500'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 items-center text-xs text-zinc-400">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 animate-pulse">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              <span>Sauda AI is calculating offer margins...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
        <span className="text-[10px] font-semibold text-zinc-400 shrink-0 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-emerald-400" /> Suggestions:
        </span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="mt-2 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Propose a deal (e.g., 'Can I get 2 units for ₹90,000?')..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-3 pl-4 pr-10 text-xs text-zinc-100 placeholder-zinc-500 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-40 disabled:hover:bg-emerald-500"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}
