'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Product, User } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import Navbar from '../../../components/Navbar';
import { 
  Smartphone, 
  Battery, 
  MapPin, 
  MessageSquare, 
  ArrowLeft, 
  ShieldCheck, 
  ChevronRight, 
  Calendar, 
  ChevronLeft,
  UserCheck,
  Cpu
} from 'lucide-react';

interface ProductWithSeller extends Product {
  seller?: {
    id: string;
    name: string;
    avatarUrl: string;
    phone: string;
  };
}

export default function AdDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const id = params?.id as string;

  const [product, setProduct] = useState<ProductWithSeller | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isStartingChat, setIsStartingChat] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;

    const fetchProductDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<ProductWithSeller>(`/ads/${id}`);
        setProduct(data);
      } catch (err: any) {
        console.error('Erro ao buscar detalhes do anúncio:', err);
        setError('Anúncio não encontrado ou indisponível no momento.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id]);

  const handleStartChat = async () => {
    if (!product) return;

    // Se o usuário não estiver logado, redireciona para a página de login
    if (!user) {
      console.log('Usuário não autenticado. Redirecionando para login.');
      router.push('/login');
      return;
    }

    // Evitar que o usuário converse consigo mesmo
    if (user.id === product.userId) {
      alert('Você não pode iniciar um chat com o seu próprio anúncio!');
      return;
    }

    try {
      setIsStartingChat(true);
      // Fazer POST para criar ou abrir chat existente
      const response = await api.post<{ id: string }>('/chats', {
        productId: product.id,
        sellerId: product.userId,
      });

      console.log('Chat estabelecido com sucesso:', response.id);
      // Redireciona para o chat correspondente
      router.push(`/chat?id=${response.id}`);
    } catch (err: any) {
      console.error('Erro ao iniciar chat com o vendedor:', err);
      alert(err.message || 'Erro ao conectar com o vendedor. Tente novamente.');
    } finally {
      setIsStartingChat(false);
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  // Imagens padrão de fallback caso o anúncio não possua imagens cadastradas
  const images = product?.images && product.images.length > 0
    ? product.images
    : ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=85'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex flex-col justify-center items-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm font-semibold text-slate-500 animate-pulse">Carregando detalhes do anúncio...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 max-w-xl mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="bg-red-50 p-4 rounded-full border border-red-100 text-red-500 mb-4 shadow-sm">
            <Smartphone className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Ops! Anúncio Indisponível</h2>
          <p className="text-slate-500 text-sm mt-2 mb-6 leading-relaxed">
            {error || 'Não conseguimos carregar as informações deste produto. Ele pode ter sido vendido ou removido pelo anunciante.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition duration-150 active:scale-95 shadow-lg shadow-blue-500/10 cursor-pointer flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para a Vitrine</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-6 select-none">
          <span className="hover:text-blue-600 cursor-pointer transition" onClick={() => router.push('/')}>Marketplace</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="hover:text-blue-600 cursor-pointer transition uppercase">{product.brand}</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-600 truncate max-w-[200px]">{product.title}</span>
        </div>

        {/* Product Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* GALERIA DE IMAGENS - Esquerda (7 colunas) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Imagem Principal */}
            <div className="relative aspect-square sm:aspect-[4/3] w-full bg-white border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center shadow-sm">
              <img
                src={images[activeImageIndex]}
                alt={`${product.title} - Visualização ${activeImageIndex + 1}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-all duration-300"
              />
              
              {/* Navegação de imagem dentro da galeria via setas */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur border border-slate-200 p-2 rounded-full hover:bg-white shadow transition-all cursor-pointer select-none active:scale-90"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-700" />
                  </button>
                  <button
                    onClick={() => setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur border border-slate-200 p-2 rounded-full hover:bg-white shadow transition-all cursor-pointer select-none active:scale-90"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-700" />
                  </button>
                </>
              )}
            </div>

            {/* Miniaturas (Thumbnails) */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 bg-white shrink-0 transition-all ${
                      idx === activeImageIndex
                        ? 'border-blue-600 scale-95 shadow-md shadow-blue-500/10'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt={`Miniatura ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* FICHA TÉCNICA E CARD DE COMPRA - Direita (5 colunas) */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              
              {/* Categoria/Badge e Título */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-50 text-blue-600 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {product.brand}
                  </span>
                  <span className="bg-slate-100 text-slate-600 font-semibold text-[10px] px-2.5 py-1 rounded-full uppercase">
                    SEMINOVO
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  {product.title}
                </h1>
              </div>

              {/* Preço de Aquisição */}
              <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-400 block uppercase">Valor do Aparelho</span>
                  <span className="text-2xl sm:text-3xl font-black text-[#004ac6]">
                    {formatPrice(product.price)}
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  À vista
                </span>
              </div>

              {/* Características e Ficha Técnica de Hardware */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-150 rounded-xl p-3 flex items-center gap-2.5 bg-white shadow-xs">
                  <Cpu className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase leading-tight">Modelo</span>
                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{product.model || 'Padrão'}</span>
                  </div>
                </div>

                <div className="border border-slate-150 rounded-xl p-3 flex items-center gap-2.5 bg-white shadow-xs">
                  <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase leading-tight">Capacidade</span>
                    <span className="text-xs font-bold text-slate-800">{product.storage || '128 GB'}</span>
                  </div>
                </div>

                {product.batteryHealth !== undefined && (
                  <div className="border border-slate-150 rounded-xl p-3 flex items-center gap-2.5 bg-white shadow-xs">
                    <Battery className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase leading-tight">Saúde Bateria</span>
                      <span className="text-xs font-bold text-slate-800">{product.batteryHealth}%</span>
                    </div>
                  </div>
                )}

                <div className="border border-slate-150 rounded-xl p-3 flex items-center gap-2.5 bg-white shadow-xs">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase leading-tight">Localização</span>
                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{product.location || 'Brasil'}</span>
                  </div>
                </div>
              </div>

              {/* Informações de Compra e Contato Direto */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleStartChat}
                  disabled={isStartingChat}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/15 transition-all duration-150 active:scale-98 flex items-center justify-center gap-2 select-none cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{isStartingChat ? 'Aguarde, conectando...' : 'Conversar com o Vendedor'}</span>
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider text-center pt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Ambiente Protegido e Transação Garantida</span>
                </div>
              </div>

            </div>

            {/* CARD DO VENDEDOR INTEGRADO */}
            {product.seller && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <img
                  src={product.seller.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'}
                  alt={product.seller.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover border border-slate-100"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block">Anunciante</span>
                  <h4 className="text-sm font-bold text-slate-800 truncate">{product.seller.name}</h4>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                    Pessoa Física Verificada
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* DESCRIÇÃO COMPLETA DO EQUIDAMENTO AO FUNDO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mt-8 shadow-sm">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 border-b border-slate-150 pb-3 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-600" />
            <span>Descrição do Aparelho pelo Vendedor</span>
          </h2>
          <div className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed space-y-3 whitespace-pre-wrap font-sans">
            {product.description || 'Nenhum detalhe adicional fornecido pelo anunciante para este produto.'}
          </div>
        </div>

      </main>
    </div>
  );
}
