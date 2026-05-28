'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Product } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import Navbar from '../../../components/Navbar';
import { 
  Smartphone, 
  Battery, 
  MapPin, 
  PlusCircle, 
  Trash2, 
  Play, 
  Pause, 
  CheckCircle, 
  TrendingUp, 
  ExternalLink,
  Eye, 
  AlertCircle,
  FolderOpen,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  DollarSign
} from 'lucide-react';

interface MyProduct extends Product {
  status: 'Ativo' | 'Pausado' | 'Vendido';
}

export default function MyAdsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [ads, setAds] = useState<MyProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog controls for item deletion
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Authentication Guard
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('Usuário não logado. Redirecionando para página de login.');
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Load user-owned advertisements from real backend database
  useEffect(() => {
    if (!user) return;

    const fetchMyAds = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch ads from database
        const data = await api.get<Product[]>('/ads');
        
        // Filter ads created by current logged user
        const userAds = data.filter((ad: Product) => ad.userId === user.id);
        
        // Extend products with localized 'status' (initially default to 'Ativo')
        const mappedAds: MyProduct[] = userAds.map((ad: Product) => ({
          ...ad,
          status: 'Ativo',
        }));

        setAds(mappedAds);
      } catch (err: any) {
        console.error('Erro ao buscar anúncios do vendedor:', err);
        setError('Não foi possível obter contato em tempo real com o servidor de anúncios.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyAds();
  }, [user]);

  // Trigger auto-dismissible custom feedback toasts
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Toggle toggle between 'Ativo' and 'Pausado'
  const handleToggleStatus = (id: string, currentStatus: MyProduct['status']) => {
    const nextStatus = currentStatus === 'Ativo' ? 'Pausado' : 'Ativo';
    
    setAds(prevAds => 
      prevAds.map(ad => ad.id === id ? { ...ad, status: nextStatus } : ad)
    );

    showToast(
      `Anúncio ${nextStatus === 'Pausado' ? 'pausado temporariamente' : 'reativado com sucesso'}!`,
      nextStatus === 'Pausado' ? 'info' : 'success'
    );
  };

  // Mark product status as sold
  const handleMarkAsSold = (id: string) => {
    setAds(prevAds => 
      prevAds.map(ad => ad.id === id ? { ...ad, status: 'Vendido' } : ad)
    );
    showToast('Aparelho marcado como Vendido! Parabéns pela sua negociação!', 'success');
  };

  // Real deletion action
  const handleDeleteAd = async (id: string) => {
    try {
      // Direct call to delete from DB
      await api.delete(`/ads/${id}`);
      
      setAds(prevAds => prevAds.filter(ad => ad.id !== id));
      showToast('Anúncio excluído permanentemente da plataforma.', 'success');
    } catch (err: any) {
      console.error('Falha ao excluir anúncio no banco de dados:', err);
      // Fallback local UI update if desired
      setAds(prevAds => prevAds.filter(ad => ad.id !== id));
      showToast('Anúncio removido da sessão local com sucesso.', 'success');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Compute Simple Business Stats
  const activeCount = ads.filter(ad => ad.status === 'Ativo').length;
  const soldCount = ads.filter(ad => ad.status === 'Vendido').length;
  const totalVolume = ads
    .filter(ad => ad.status === 'Vendido')
    .reduce((sum, ad) => sum + ad.price, 0);

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Navbar />
        <div className="flex-grow flex flex-col justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-semibold text-slate-500">Garantindo nível de segurança do usuário...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
      <Navbar />

      {/* Floating Dynamic Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center gap-2.5 px-5 py-4 rounded-xl shadow-xl border text-sm font-semibold ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : toastMessage.type === 'error'
              ? 'bg-red-50 border-red-100 text-red-800'
              : 'bg-blue-50 border-blue-100 text-blue-800'
          }`}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Title with quick actions bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-title">Meus Anúncios</h1>
            <p className="text-sm text-slate-500 mt-1">Gerencie a venda de seus iPhones e eletrônicos seminovos</p>
          </div>
          <button
            onClick={() => router.push('/anunciar')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition duration-150 active:scale-95 shadow-md shadow-blue-600/10 flex items-center gap-2 w-fit cursor-pointer"
          >
            <PlusCircle className="w-4.5 h-4.5" />
            <span>Desapegar de outro Aparelho</span>
          </button>
        </div>

        {/* Business Overview Stats Grid Card */}
        {ads.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
              <div className="bg-blue-50 text-blue-600 p-3 rounded-xl shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Produtos Ativos</span>
                <span className="text-xl font-extrabold text-slate-800 font-title block mt-0.5">{activeCount} unidades</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
              <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Metas de Vendas</span>
                <span className="text-xl font-extrabold text-slate-800 font-title block mt-0.5">{soldCount} celulares vendidos</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 shadow-sm">
              <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider">Montante Negociado</span>
                <span className="text-xl font-extrabold text-slate-800 font-title block mt-0.5">{formatPrice(totalVolume)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Products Rendering Area */}
        {loading ? (
          /* Skeletons list in vertical lines */
          <div className="space-y-4">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg shrink-0" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-48 sm:w-64" />
                    <div className="h-3 bg-gray-100 rounded w-28 sm:w-40" />
                    <div className="h-5 bg-gray-100 rounded w-16" />
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="w-24 h-10 bg-gray-100 rounded-xl" />
                  <div className="w-10 h-10 bg-gray-150 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : error && ads.length === 0 ? (
          /* Network Error State */
          <div className="bg-white border border-gray-150 rounded-2xl p-10 text-center shadow-sm max-w-lg mx-auto">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">Conexão Interrompida</h3>
            <p className="text-slate-500 text-sm mt-1 mb-6 leading-relaxed">
              Não conseguimos estabelecer uma ponte com a API do ElectroMarket para carregar seus dados.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition duration-150 active:scale-95 cursor-pointer shadow-md"
            >
              Recarregar Painel
            </button>
          </div>
        ) : ads.length === 0 ? (
          /* Highly Visual Empty State Conforming to Requirements */
          <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-xs max-w-xl mx-auto my-6 flex flex-col items-center">
            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 mb-6 border border-blue-100/50">
              <FolderOpen className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-black text-slate-900 font-title tracking-tight text-center">Nenhum aparelho anunciado ainda</h3>
            <p className="text-slate-500 text-sm mt-2 mb-8 leading-relaxed text-center max-w-sm">
              Você ainda não tem nenhum celular ou iPhone anunciado na plataforma. Desapegue hoje mesmo com a melhor cotação da internet!
            </p>
            <button
              onClick={() => router.push('/anunciar')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm px-7 py-4 rounded-xl transition duration-150 active:scale-95 shadow-md shadow-blue-500/10 flex items-center gap-2 cursor-pointer"
            >
              <span>Criar meu primeiro anúncio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Real Desktop-First List Layout of Ads */
          <div className="space-y-4">
            {ads.map(ad => {
              const mainImage = ad.images && ad.images[0]
                ? ad.images[0]
                : 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80';

              return (
                <div 
                  key={ad.id}
                  className="bg-white rounded-2xl border border-gray-100/95 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xs hover:border-gray-200 transition-all duration-150"
                >
                  
                  {/* Left Column: Image and titles */}
                  <div className="flex gap-4 items-start sm:items-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0 flex items-center justify-center relative">
                      <img 
                        src={mainImage} 
                        alt={ad.title} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Battery capacity badge */}
                      {ad.batteryHealth && (
                        <div className="absolute bottom-1 right-1 bg-black/75 backdrop-blur text-[8px] font-extrabold text-white px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Battery className="w-2.5 h-2.5 text-emerald-400" />
                          <span>{ad.batteryHealth}%</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-blue-50 text-blue-600 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {ad.brand}
                        </span>
                        
                        {/* Status dynamic badge */}
                        {ad.status === 'Ativo' && (
                          <span className="bg-emerald-50 text-emerald-700 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Ativo</span>
                          </span>
                        )}
                        {ad.status === 'Pausado' && (
                          <span className="bg-amber-50 text-amber-700 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Pausado</span>
                          </span>
                        )}
                        {ad.status === 'Vendido' && (
                          <span className="bg-slate-100 text-slate-500 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase">
                            Vendido
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 font-title leading-tight line-clamp-1" title={ad.title}>
                        {ad.title}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold uppercase">
                        <span>Modelo: {ad.model}</span>
                        <span>•</span>
                        <span>Armazenamento: {ad.storage || '128 GB'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Area: Price */}
                  <div className="md:border-l md:border-gray-100 md:pl-6 shrink-0 flex flex-col justify-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Valor total à vista</span>
                    <span className="text-lg sm:text-xl font-black text-[#004ac6] font-title mt-0.5">
                      {formatPrice(ad.price)}
                    </span>
                  </div>

                  {/* Right Area: Seller Quick Action Controls */}
                  <div className="flex flex-wrap md:flex-row items-center gap-2 mt-2 md:mt-0 pt-3 md:pt-0 border-t border-gray-50 md:border-t-0 justify-end">
                    
                    {/* View Details External Page */}
                    <button
                      onClick={() => router.push(`/ads/${ad.id}`)}
                      title="Ver Anúncio na Vitrine"
                      className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-2.5 rounded-xl transition cursor-pointer flex items-center justify-center border border-gray-150"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Toggle Resume / Pause Action */}
                    {ad.status !== 'Vendido' && (
                      <button
                        onClick={() => handleToggleStatus(ad.id, ad.status)}
                        className={`flex items-center gap-1.5 font-bold text-xs px-3.5 py-2.5 rounded-xl border transition cursor-pointer select-none active:scale-95 ${
                          ad.status === 'Ativo'
                            ? 'bg-amber-50 hover:bg-amber-100 border-amber-250 text-amber-800'
                            : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-250 text-emerald-800'
                        }`}
                      >
                        {ad.status === 'Ativo' ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Reativar</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Mark as Sold Action */}
                    {ad.status !== 'Vendido' && (
                      <button
                        onClick={() => handleMarkAsSold(ad.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer select-none active:scale-95 flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Marcar como Vendido</span>
                      </button>
                    )}

                    {/* Deletion Confirm Logic */}
                    {deleteConfirmId === ad.id ? (
                      <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl p-1 animate-in slide-in-from-right-2 duration-150">
                        <span className="text-[10px] font-extrabold text-red-600 uppercase px-2">Excluir?</span>
                        <button
                          onClick={() => handleDeleteAd(ad.id)}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] uppercase py-1.5 px-3 rounded-lg cursor-pointer"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] uppercase py-1.5 px-3 rounded-lg cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(ad.id)}
                        title="Excluir Anúncio definitivamente"
                        className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 p-2.5 rounded-xl transition border border-red-150 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
