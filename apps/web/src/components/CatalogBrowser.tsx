'use client';

import React, { useState } from 'react';
import {
  X,
  Search,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { PublicCatalogProduct } from '../lib/api';

interface CatalogBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  products: PublicCatalogProduct[];
  onSelectProductForNegotiation: (product: PublicCatalogProduct) => void;
  merchantName?: string;
}

export function CatalogBrowser({
  isOpen,
  onClose,
  products,
  onSelectProductForNegotiation,
  merchantName = 'Merchant Store'
}: CatalogBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md border-l border-zinc-800 bg-zinc-950 p-6 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  {merchantName} Catalog
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Select a product to start price negotiation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search & Filter */}
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 py-2 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Category Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Products List */}
          <div className="mt-4 flex-1 overflow-y-auto divide-y divide-zinc-800/60 pr-1">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
                <AlertCircle className="h-8 w-8 mb-2 stroke-1" />
                <p className="text-xs">No matching products found.</p>
              </div>
            ) : (
              filteredProducts.map((prod) => (
                <div key={prod.id} className="py-3 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-100">{prod.title}</span>
                      <span className="text-xs font-bold text-emerald-400">
                        ₹{prod.basePrice.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {prod.description && (
                      <p className="mt-0.5 text-[11px] text-zinc-400 line-clamp-2">
                        {prod.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 border border-zinc-800">
                        {prod.category}
                      </span>
                      {prod.inStock ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> In Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectProductForNegotiation(prod);
                      onClose();
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500 hover:text-zinc-950 transition-all shadow-sm"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Negotiate Price</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
