'use client';

import React, { useState, useEffect } from 'react';
import { auth } from '../../../lib/auth';
import { api, type AdminProduct } from '../../../lib/api';
import {
  Package,
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Tag,
  Boxes,
  X
} from 'lucide-react';

export default function AdminCatalogPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Product Form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [basePrice, setBasePrice] = useState('50000');
  const [costPrice, setCostPrice] = useState('30000');
  const [initialStock, setInitialStock] = useState('10');
  const [location, setLocation] = useState('Warehouse A');

  const loadCatalog = async (refresh = false) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      if (refresh) setIsRefreshing(true);
      const res = await api.getMerchantCatalog(activeMerchant.id);
      setProducts(res.products);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load catalog');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    try {
      setIsSubmitting(true);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);

      await api.createProduct(activeMerchant.id, {
        title,
        slug,
        category,
        basePrice: parseFloat(basePrice),
        costPrice: parseFloat(costPrice),
        initialStock: parseInt(initialStock, 10),
        location
      });

      setIsAddModalOpen(false);
      setTitle('');
      await loadCatalog(true);
    } catch (err: unknown) {
      alert(`Could not create product: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestock = async (productId: string) => {
    const activeMerchant = auth.getActiveMerchant();
    if (!activeMerchant) return;

    const currentProd = products.find((p) => p.id === productId);
    const currentUnits = currentProd?.inventory?.availableUnits || 0;

    const unitsToAdd = prompt(`Current stock: ${currentUnits} units.\nEnter additional units to add:`, '10');
    if (!unitsToAdd || isNaN(parseInt(unitsToAdd, 10))) return;

    try {
      await api.updateInventory(activeMerchant.id, productId, {
        availableUnits: currentUnits + parseInt(unitsToAdd, 10)
      });
      await loadCatalog(true);
    } catch (err: unknown) {
      alert(`Restock failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Catalog & Inventory Management
          </h1>
          <p className="text-xs text-zinc-400">
            Manage product pricing, cost baselines, and real-time warehouse inventory
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadCatalog(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl overflow-hidden backdrop-blur-sm">
        {isLoading ? (
          <div className="flex h-48 flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
            <p className="text-xs text-zinc-400">Loading catalog...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 space-y-3">
            <Package className="h-8 w-8 mx-auto text-zinc-600" />
            <p>Your store has no products yet. Add your first product to start negotiating!</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-zinc-950"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Product</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-4 font-semibold">Product</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold text-right">Base Price</th>
                  <th className="p-4 font-semibold text-right">Cost Price</th>
                  <th className="p-4 font-semibold text-right">Gross Margin</th>
                  <th className="p-4 font-semibold text-center">Available Stock</th>
                  <th className="p-4 font-semibold text-center">Reserved</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {products.map((prod) => {
                  const marginPct =
                    prod.basePrice > 0
                      ? Math.round(((prod.basePrice - prod.costPrice) / prod.basePrice) * 100)
                      : 0;

                  return (
                    <tr key={prod.id} className="hover:bg-zinc-800/20">
                      <td className="p-4 font-medium text-zinc-100 max-w-[200px] truncate">
                        <div className="font-semibold text-zinc-100">{prod.title}</div>
                        <span className="text-[10px] font-mono text-zinc-500">{prod.slug}</span>
                      </td>
                      <td className="p-4 text-zinc-400">{prod.category}</td>
                      <td className="p-4 text-right font-bold text-zinc-100">
                        ₹{prod.basePrice.toLocaleString('en-IN')}
                      </td>
                      <td className="p-4 text-right font-mono text-zinc-400">
                        ₹{prod.costPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-400">
                        {marginPct}%
                      </td>
                      <td className="p-4 text-center">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400 border border-emerald-500/20">
                          {prod.inventory?.availableUnits || 0} units
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono text-amber-400">
                        {prod.inventory?.reservedUnits || 0}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleRestock(prod.id)}
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
                        >
                          + Restock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-400" />
                Add Product to Catalog
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Product Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Neural Processor Core"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Warehouse Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Base Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    required
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Create & Publish to AI Catalog</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
