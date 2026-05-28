'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Product } from '../../../types';
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
  ChevronLeft,
  UserCheck,
  Cpu,
  Phone,
  Eye,
  Info
} from 'lucide-react';

interface ProductWithSeller extends Product {
  seller?: {
    id: string;
    name: string;
    avatarUrl: string;
    phone: string;
  };
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const id = params?.id as string;

  const [product, setProduct] = useState<ProductWithSeller | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isStartingChat, setIsStartingChat] = useState<boolean>(false);
  const [showPhone, setShowPhone] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;

    const fetchProductDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        // GET details of the product including the seller information
        const data = await api.get<ProductWithSeller>(`/ads/${id}`);
        setProduct(data);
      } catch (err: any) {
        console.error('Erro ao buscar detalhes do anúncio:', err);
        setError('Não conseguimos localizar as informações deste aparelho. Ele pode ter sido removido ou vendido.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id]);

  const handleStartChat = async () => {
    if (!product) return;

    // Verificação se usuário está logado
    if (!user) {
      console.log('Usuário não logado. Redirecionando para login.');
      router.push('/login');
      return;
    }

    // Evita o usuário conversar consigo mesmo
    if (user.id === product.userId) {
      alert('Você não pode negociar consigo mesmo ou iniciar um chat no seu próprio anúncio.');
      return;
    }

    try {
      setIsStartingChat(true);
      // Cria ou abre o chat existente no back-end
      const response = await api.post<{ id: string }>('/chats', {
        productId: product.id,
        sellerId: product.userId,
      });

      console.log('Chat estabelecido com sucesso:', response.id);
      router.push(`/chat?id=${response.id}`);
    } catch (err: any) {
      console.error('Erro ao iniciar chat com o vendedor:', err);
      alert(err.message || 'Houve um problema ao conectar com o vendedor. Tente novamente.');
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

  const formatPhoneNumber = (phoneStr?: string) => {
    if (!phoneStr) return '(11) 99999-9999';
    // Remove non-numeric characters
    const cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
    return phoneStr;
  };

  const images = product?.images && product.images.length > 0
    ? product.images
    : ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <div className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full flex flex-col justify-center items-center">
          <div className="w-10 h-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-semibold text-slate-500 animate-pulse">Obtendo especificações do produto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <div className="flex-grow max-w-lg mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-red-500 mb-4 shadow-sm">
            <Smartphone className="w-12 h-12" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 font-title">Anúncio Não Encontrado</h2>
          <p className="text-slate-500 text-sm mt-2 mb-6 leading-relaxed">
            {error || 'Não conseguimos carregar as informações deste produto.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-[#2563eb] hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition duration-150 active:scale-95 shadow-md flex items-center gap-2 cursor-pointer"
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
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-6 select-none max-w-full overflow-hidden truncate">
          <span className="hover:text-[#2563eb] cursor-pointer transition shrink-0" onClick={() => router.push('/')}>Vitrine</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="hover:text-[#2563eb] cursor-pointer transition uppercase shrink-0">{product.brand}</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-slate-600 truncate max-w-[150px] sm:max-w-[300px]">{product.title}</span>
        </div>

        {/* Product Details Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LADO ESQUERDO: GALERIA E DESCRIÇÃO COMPLETAS (7 Colunas) */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Imagem Principal & Galeria */}
            <div className="space-y-4">
              <div className="relative aspect-square sm:aspect-[4/3] w-full bg-white border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center shadow-sm group">
                <img
                  src={images[activeImageIndex]}
                  alt={`${product.title} - Imagem ${activeImageIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                />
                
                {/* Image Navigation Arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur border border-slate-200 p-2 rounded-full hover:bg-white shadow transition-all active:scale-90 cursor-pointer text-slate-700"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur border border-slate-200 p-2 rounded-full hover:bg-white shadow transition-all active:scale-90 cursor-pointer text-slate-700"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnails below */}
              {images.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
                  {images.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 bg-white shrink-0 transition ${
                        idx === activeImageIndex
                          ? 'border-[#2563eb] shadow-sm scale-95'
                          : 'border-slate-200 hover:border-slate-350'
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

            {/* Product description (Below gallery on Left Column) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3.5 flex items-center gap-2 font-title">
                <Smartphone className="w-5 h-5 text-[#2563eb]" />
                <span>Descrição do Produto</span>
              </h2>
              <div className="mt-4 text-sm text-slate-600 leading-relaxed font-sans whitespace-pre-wrap select-text">
                {product.description || 'O anunciante não incluiu informações textuais detalhadas sobre o estado deste aparelho.'}
              </div>
            </div>

          </div>

          {/* LADO DIREITO: CARD FIXO/STICKY (5 Colunas) */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              
              {/* Product Badges and Title */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="bg-blue-50 text-[#2563eb] font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {product.brand}
                  </span>
                  <span className="bg-slate-100 text-slate-500 font-bold text-[10px] px-2.5 py-1 rounded-full uppercase">
                    Original Inspecionado
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold font-title text-slate-900 leading-tight">
                  {product.title}
                </h1>
              </div>

              {/* Boxed Highlighted Price */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Valor total à vista</span>
                  <span className="text-2xl sm:text-3xl font-black font-title text-[#004ac6]">
                    {formatPrice(product.price)}
                  </span>
                </div>
                <div className="bg-emerald-50 text-emerald-700 py-1 px-2.5 rounded-lg text-[10px] font-extrabold uppercase">
                  Pix / Dinheiro
                </div>
              </div>

              {/* Technical Grid Specs */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                <div className="border border-slate-150 rounded-xl p-3 flex items-center gap-2.5 bg-white shadow-xs">
                  <Cpu className="w-4 h-4 text-[#2563eb] shrink-0" />
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase leading-tight">Modelo</span>
                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{product.model || 'Padrão'}</span>
                  </div>
                </div>

                <div className="border border-slate-150 rounded-xl p-3 flex items-center gap-2.5 bg-white shadow-xs">
                  <Smartphone className="w-4 h-4 text-[#2563eb] shrink-0" />
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase leading-tight">Armazenamento</span>
                    <span className="text-xs font-bold text-slate-800">{product.storage || '128 GB'}</span>
                  </div>
                </div>

                {product.batteryHealth !== undefined && (
                  <div className="border border-slate-150 rounded-xl p-3 flex items-center gap-2.5 bg-white shadow-xs">
                    <Battery className="w-4 h-4 text-[#2563eb] shrink-0" />
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold uppercase leading-tight">Saúde da Bateria</span>
                      <span className="text-xs font-bold text-slate-800">{product.batteryHealth}%</span>
                    </div>
                  </div>
                )}

                <div className="border border-slate-150 rounded-xl p-3 flex items-center gap-2.5 bg-white shadow-xs">
                  <MapPin className="w-4 h-4 text-[#2563eb] shrink-0" />
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase leading-tight">Localidade</span>
                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{product.location || 'Brasil'}</span>
                  </div>
                </div>
              </div>

              {/* Sticky Card CTA Buttons */}
              <div className="space-y-3 pt-2">
                
                {/* Primary: Chat Negociação */}
                <button
                  onClick={handleStartChat}
                  disabled={isStartingChat}
                  className="w-full bg-[#2563eb] hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 select-none cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{isStartingChat ? 'Carregando conexão de bate-papo...' : 'Conversar no Chat'}</span>
                </button>

                {/* Secondary: Reveal Phone Number button */}
                {showPhone ? (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 flex items-center justify-between text-slate-800 animate-in fade-in slide-in-from-top-1.5 duration-200">
                    <div className="flex items-center gap-2 font-mono text-sm font-bold">
                      <Phone className="w-4 h-4 text-[rgb(37,99,235)] shrink-0" />
                      <span>{formatPhoneNumber(product.seller?.phone)}</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      WhatsApp Disponível
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPhone(true)}
                    className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-sm py-3 px-4 rounded-xl transition duration-150 active:scale-98 flex items-center justify-center gap-2 select-none cursor-pointer"
                  >
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span>Ver Telefone</span>
                  </button>
                )}

                {/* Security verification details */}
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center pt-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Ambiente ElectroMarket Protegido</span>
                </div>
              </div>

            </div>

            {/* Seller Info Block */}
            {product.seller && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <img
                  src={product.seller.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'}
                  alt={product.seller.name}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-slate-100"
                />
                <div className="flex-grow min-w-0">
                  <span className="text-[9px] font-extrabold text-[#2563eb] uppercase tracking-widest block">Vendedor do aparelho</span>
                  <h4 className="text-sm font-bold text-slate-800 truncate leading-tight">{product.seller.name}</h4>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#2563eb]" />
                    Membro original verificado
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

      </main>
    </div>
  );
}
