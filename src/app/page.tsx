import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Product } from '../types';
import Navbar from '../components/Navbar';
import { Smartphone, Battery, MapPin, Search, Package, AlertCircle } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import ProductSkeletonGrid from '../components/ProductSkeletonGrid';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch advertisements from backend API
  useEffect(() => {
    const fetchAds = async () => {
      try {
        setLoading(true);
        setError(null);
        // Make the standard call to our Prisma-backed endpoint
        const data = await api.get<Product[]>('/ads');
        setProducts(data);
      } catch (err: any) {
        console.error('Erro ao buscar anúncios do backend:', err);
        setError(err.message || 'Não foi possível carregar os anúncios da vitrine.');
      } finally {
        setLoading(false);
      }
    };

    fetchAds();
  }, []);

  // Filter advertisements client-side based on Category and Search Query
  const filteredProducts = products.filter((product) => {
    // 1. Category Filter
    const matchesCategory =
      selectedCategory === 'Todos' ||
      (selectedCategory === 'iPhone' && product.brand.toLowerCase() === 'apple') ||
      (selectedCategory === 'Samsung' && product.brand.toLowerCase() === 'samsung') ||
      (selectedCategory === 'Xiaomi' && product.brand.toLowerCase() === 'xiaomi');

    // 2. Search Query Filter
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      product.title.toLowerCase().includes(query) ||
      (product.description && product.description.toLowerCase().includes(query)) ||
      product.brand.toLowerCase().includes(query) ||
      product.model.toLowerCase().includes(query) ||
      product.location.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  // Helper formatting for Brazilian Real Currency
  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Safe navigation action mimicking Next.js routing in current page state or logs
  const handleProductClick = (productId: string) => {
    console.log(`Redirecionando para o anúncio: /ads/${productId}`);
    // No iFrame, we can open the details panel, trigger a custom callback or router path
    if (typeof window !== 'undefined') {
      // Se estivéssemos usando Next.js Router: router.push(`/ads/${productId}`)
      // No simulador ou React SPA, podemos simplesmente lançar um custom event ou logar.
      const event = new CustomEvent('navigate_ad_details', { detail: { id: productId } });
      window.dispatchEvent(event);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sync with the global layout Navbar */}
      <Navbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Mobile Search input */}
        <div className="mb-6 md:hidden relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar iPhone, Galaxy, Pixels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none shadow-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
        </div>

        {/* Hero Section Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-10 text-white mb-8 shadow-lg shadow-blue-600/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-2xl -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-xl -ml-12 -mb-12"></div>
          <div className="relative z-10 max-w-lg">
            <span className="bg-blue-500/30 text-blue-100 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider font-sans">
              Campanha Troca Segura
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-2 sm:mt-3">
              Seminovos de Elite com Procedência.
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-2 leading-relaxed">
              Encontre iPhones, Galaxy e Pixels inspecionados com laudo de bateria original e segurança garantida pelo ElectroMarket.
            </p>
          </div>
        </div>

        {/* Categories Quick Filtering */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8 -mx-4 px-4 scrollbar-none">
          {[
            { id: 'Todos', label: 'Todos os Aparelhos', icon: <Package className="w-4 h-4" /> },
            { id: 'iPhone', label: 'iPhone (Apple)', icon: <Smartphone className="w-4 h-4" /> },
            { id: 'Samsung', label: 'Samsung', icon: <Smartphone className="w-4 h-4" /> },
            { id: 'Xiaomi', label: 'Xiaomi', icon: null }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition whitespace-nowrap border cursor-pointer border-slate-200 shadow-sm ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10'
                  : 'bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Section Heading info bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Vitrine Recente</h2>
            <p className="text-xs text-slate-500">Filtrando eletrônicos anunciados diretamente por donos</p>
          </div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {filteredProducts.length} disponíveis
          </span>
        </div>

        {/* Error Feedback */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center shadow-sm max-w-md mx-auto my-12">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-850">Não foi possível sincronizar</h3>
            <p className="text-xs text-red-650 mt-1 leading-normal">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition active:scale-95"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Dynamic Catalog State Flow (Loading, Empty, or Real Products) */}
        {!error && (
          loading ? (
            // Exibe seus Skeletons reais enquanto o banco de dados responde
            <ProductSkeletonGrid />
          ) : filteredProducts.length === 0 ? (
            // Se o banco responder e estiver vazio, exibe o Empty State real
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-lg mx-auto my-8">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800 font-sans">Nenhum aparelho disponível no momento</h3>
              <p className="text-slate-505 text-xs mt-1 leading-relaxed max-w-sm mx-auto">
                Experimente pesquisar outro termo ou redefinir seus filtros de categoria.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('Todos');
                  setSearchQuery('');
                }}
                className="mt-4 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-850 transition active:scale-95 cursor-pointer"
              >
                Limpar Filtros
              </button>
            </div>
          ) : (
            // Renderiza os produtos reais vindos da API
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} onClick={() => handleProductClick(product.id)} />
              ))}
            </div>
          )
        )}

      </main>
    </div>
  );
}
