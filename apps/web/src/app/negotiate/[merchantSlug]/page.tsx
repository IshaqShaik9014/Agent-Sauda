'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '../../../components/Navbar';
import { ChatInterface } from '../../../components/ChatInterface';
import { CatalogBrowser } from '../../../components/CatalogBrowser';
import { api, type PublicCatalogProduct } from '../../../lib/api';
import { Loader2, Store, AlertCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ merchantSlug: string }>;
}

export default function NegotiatePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const merchantSlug = resolvedParams.merchantSlug;
  const router = useRouter();

  const [products, setProducts] = useState<PublicCatalogProduct[]>([]);
  const [merchantName, setMerchantName] = useState<string>(
    merchantSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PublicCatalogProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCatalog() {
      try {
        setIsLoading(true);
        const res = await api.getAgentCatalog({ merchantSlug });
        setProducts(res.products);
        if (res.products.length > 0 && res.products[0].merchant?.name) {
          setMerchantName(res.products[0].merchant.name);
        }
      } catch (err: unknown) {
        console.warn('Could not load live catalog from API, using demo fallback:', err);
        // Provide friendly demo fallback so UI is immediately interactive
        setProducts([
          {
            id: 'demo-prod-1',
            title: 'Quantum Computing Processor Q-1',
            slug: 'quantum-computing-processor-q-1',
            description: 'Next-gen enterprise computing processor.',
            category: 'Hardware',
            basePrice: 120000.0,
            inStock: true,
            merchant: {
              id: 'demo-merchant-id',
              name: merchantName,
              slug: merchantSlug,
              currency: 'INR'
            }
          },
          {
            id: 'demo-prod-2',
            title: 'Neural Core Accelerator v2',
            slug: 'neural-core-accelerator-v2',
            description: 'High throughput AI acceleration chip.',
            category: 'Processors',
            basePrice: 45000.0,
            inStock: true,
            merchant: {
              id: 'demo-merchant-id',
              name: merchantName,
              slug: merchantSlug,
              currency: 'INR'
            }
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    loadCatalog();
  }, [merchantSlug]);

  const handleProceedToCheckout = (offerId: string) => {
    router.push(`/checkout/${offerId}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-medium text-zinc-400">Loading {merchantName} Storefront...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased">
      {/* Top Navigation */}
      <Navbar
        merchantName={merchantName}
        merchantSlug={merchantSlug}
        onOpenCatalog={() => setIsCatalogOpen(true)}
        productsCount={products.length}
      />

      {/* Catalog Drawer */}
      <CatalogBrowser
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        products={products}
        onSelectProductForNegotiation={(prod) => {
          setSelectedProduct(prod);
          setIsCatalogOpen(false);
        }}
        merchantName={merchantName}
      />

      {/* Main Negotiation Container */}
      <main className="flex-1 flex flex-col justify-between">
        <ChatInterface
          merchantSlug={merchantSlug}
          merchantName={merchantName}
          initialProducts={products}
          selectedProduct={selectedProduct}
          onProceedToCheckout={handleProceedToCheckout}
        />
      </main>
    </div>
  );
}
